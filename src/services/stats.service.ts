import { PrismaClient } from '@prisma/client';

import {
  BinHistoryPoint,
  DashboardStats,
  HeatmapZone,
} from '@/schemas/stats.schemas';

const prisma = new PrismaClient();

const DASHBOARD_CACHE_TTL_MS = 30_000;
const ZONE_SIZE_DEGREES = 0.0009; // ~100 mètres en latitude

let dashboardCache: { data: DashboardStats; expiresAt: number } | null = null;

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function countByStatus(
  groups: Array<{ status: string; _count: { _all: number } }>,
  status: string,
): number {
  return groups.find((group) => group.status === status)?._count._all ?? 0;
}

function roundHours(value: number): number {
  return Math.round(value * 100) / 100;
}

function computeAvgCollectionHours(
  tours: Array<{ startedAt: Date | null; completedAt: Date | null }>,
): number {
  const durations = tours
    .filter((tour) => tour.startedAt && tour.completedAt)
    .map((tour) => (tour.completedAt!.getTime() - tour.startedAt!.getTime()) / 3_600_000);

  if (durations.length === 0) return 0;
  return roundHours(durations.reduce((sum, hours) => sum + hours, 0) / durations.length);
}

function computeReportsPerDayAvg(reportsInWindow: number, windowDays: number): number {
  if (reportsInWindow === 0) return 0;
  return roundHours(reportsInWindow / windowDays);
}

async function buildDashboardStats(): Promise<DashboardStats> {
  const todayStart = startOfToday();
  const thirtyDaysAgo = daysAgo(30);

  const [
    binStatusGroups,
    totalBins,
    offlineBins,
    reportStatusGroups,
    collectedToday,
    rejectedTotal,
    completedTours,
    reportsLast30Days,
  ] = await Promise.all([
    prisma.bin.groupBy({
      by: ['status'],
      _count: { _all: true },
    }),
    prisma.bin.count(),
    prisma.bin.count({
      where: {
        OR: [
          { devices: { none: {} } },
          { devices: { every: { status: 'OFFLINE' } } },
        ],
      },
    }),
    prisma.report.groupBy({
      by: ['status'],
      _count: { _all: true },
    }),
    prisma.report.count({
      where: {
        status: 'RESOLVED',
        createdAt: { gte: todayStart },
      },
    }),
    prisma.report.count({
      where: { status: 'REJECTED' },
    }),
    prisma.tour.findMany({
      where: {
        status: 'COMPLETED',
        startedAt: { not: null },
        completedAt: { not: null },
      },
      select: {
        startedAt: true,
        completedAt: true,
      },
    }),
    prisma.report.count({
      where: { createdAt: { gte: thirtyDaysAgo } },
    }),
  ]);

  return {
    bins: {
      total: totalBins,
      normal: countByStatus(binStatusGroups, 'EMPTY'),
      almost_full: countByStatus(binStatusGroups, 'HALF'),
      full: countByStatus(binStatusGroups, 'FULL'),
      fire: countByStatus(binStatusGroups, 'CRITICAL'),
      offline: offlineBins,
    },
    reports: {
      pending: countByStatus(reportStatusGroups, 'PENDING'),
      assigned: countByStatus(reportStatusGroups, 'VALIDATED'),
      collected_today: collectedToday,
      rejected_total: rejectedTotal,
    },
    performance: {
      avg_collection_time_hours: computeAvgCollectionHours(completedTours),
      reports_per_day_avg: computeReportsPerDayAvg(reportsLast30Days, 30),
    },
  };
}

export const StatsService = {
  clearDashboardCache(): void {
    dashboardCache = null;
  },

  getDashboard: async (): Promise<DashboardStats> => {
    const now = Date.now();
    if (dashboardCache && dashboardCache.expiresAt > now) {
      return dashboardCache.data;
    }

    const data = await buildDashboardStats();
    dashboardCache = {
      data,
      expiresAt: now + DASHBOARD_CACHE_TTL_MS,
    };

    return data;
  },

  getAlerts: async () => {
    const criticalBins = await prisma.bin.findMany({
      where: { status: 'CRITICAL' },
      include: { devices: true },
      take: 10,
    });

    return criticalBins.map((bin) => ({
      id: bin.id,
      type: 'FULL',
      message: `Bac critique à ${Math.round(bin.fillLevel)}%`,
      meta: `Lat: ${bin.latitude.toFixed(4)}, Lon: ${bin.longitude.toFixed(4)}`,
      severity: 'CRITICAL',
      href: `/dashboard/bins/${bin.id}`,
    }));
  },

  getNeighborhoodStats: async () => {
    const [totalBins, halfFullBins, criticalBins] = await Promise.all([
      prisma.bin.count(),
      prisma.bin.count({ where: { status: 'HALF' } }),
      prisma.bin.count({ where: { status: 'CRITICAL' } }),
    ]);

    return {
      totalBins,
      almostFull: halfFullBins,
      activeAlerts: criticalBins,
    };
  },

  getBinHistory: async (binId: string, days: number): Promise<BinHistoryPoint[]> => {
    const bin = await prisma.bin.findUnique({
      where: { id: binId },
      select: { id: true },
    });

    if (!bin) {
      throw new Error('BIN_NOT_FOUND');
    }

    const since = daysAgo(days);

    const rows = await prisma.$queryRaw<Array<{ date: Date; fill_level: number }>>`
      SELECT
        DATE("timestamp") AS date,
        ROUND(AVG("fillLevel")::numeric, 1)::float AS fill_level
      FROM "Measurement"
      WHERE "binId" = ${binId}
        AND "timestamp" >= ${since}
      GROUP BY DATE("timestamp")
      ORDER BY date ASC
    `;

    return rows.map((row) => ({
      date: row.date.toISOString().slice(0, 10),
      fill_level: Number(row.fill_level),
    }));
  },

  getReportsHeatmap: async (): Promise<HeatmapZone[]> => {
    const rows = await prisma.$queryRaw<Array<{ latitude: number; longitude: number; count: bigint }>>`
      SELECT
        (FLOOR(b."latitude" / ${ZONE_SIZE_DEGREES}) * ${ZONE_SIZE_DEGREES} + ${ZONE_SIZE_DEGREES / 2})::float AS latitude,
        (FLOOR(b."longitude" / ${ZONE_SIZE_DEGREES}) * ${ZONE_SIZE_DEGREES} + ${ZONE_SIZE_DEGREES / 2})::float AS longitude,
        COUNT(*)::bigint AS count
      FROM "Report" r
      INNER JOIN "Bin" b ON r."binId" = b."id"
      GROUP BY
        FLOOR(b."latitude" / ${ZONE_SIZE_DEGREES}),
        FLOOR(b."longitude" / ${ZONE_SIZE_DEGREES})
      ORDER BY count DESC
    `;

    return rows.map((row) => ({
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      count: Number(row.count),
    }));
  },
};
