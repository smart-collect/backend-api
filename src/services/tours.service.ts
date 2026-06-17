import { Bin, PrismaClient } from '@prisma/client';

import { CreateTourInput, GenerateTourInput } from '@/schemas/tours.schemas';

const prisma = new PrismaClient();

const COLLECTIBLE_STATUSES = ['FULL', 'CRITICAL', 'HALF'] as const;

function statusPriority(status: string): number {
  if (status === 'FULL') return 0;
  if (status === 'CRITICAL') return 1;
  if (status === 'HALF') return 2;
  return 3;
}

function haversineKm(a: Pick<Bin, 'latitude' | 'longitude'>, b: Pick<Bin, 'latitude' | 'longitude'>): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(h));
}

function sortFullFirst(bins: Bin[]): Bin[] {
  return [...bins].sort((a, b) => {
    const priorityDiff = statusPriority(a.status) - statusPriority(b.status);
    if (priorityDiff !== 0) return priorityDiff;
    if (a.latitude !== b.latitude) return a.latitude - b.latitude;
    return a.longitude - b.longitude;
  });
}

function sortNearestFirst(bins: Bin[]): Bin[] {
  const prioritized = sortFullFirst(bins);
  if (prioritized.length <= 1) return prioritized;

  const result: Bin[] = [];
  const remaining = [...prioritized];
  let current = remaining.shift()!;
  result.push(current);

  while (remaining.length > 0) {
    let nearestIndex = 0;
    let nearestDistance = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const distance = haversineKm(current, remaining[i]!);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = i;
      }
    }

    current = remaining.splice(nearestIndex, 1)[0]!;
    result.push(current);
  }

  return result;
}

async function getTourOrThrow(tourId: string) {
  const tour = await prisma.tour.findUnique({
    where: { id: tourId },
    include: {
      bins: {
        include: { bin: true },
        orderBy: { orderIndex: 'asc' },
      },
    },
  });

  if (!tour) {
    throw new Error('TOUR_NOT_FOUND');
  }

  return tour;
}

function assertTourAccess(tour: { agentId: string }, agentId: string, isAdmin: boolean): void {
  if (!isAdmin && tour.agentId !== agentId) {
    throw new Error('TOUR_FORBIDDEN');
  }
}

async function assertBinsExist(binIds: string[]): Promise<void> {
  const bins = await prisma.bin.findMany({
    where: { id: { in: binIds } },
    select: { id: true },
  });

  if (bins.length !== binIds.length) {
    throw new Error('BIN_NOT_FOUND');
  }
}

export const ToursService = {
  listTours: async (agentId: string, isAdmin: boolean) => {
    return prisma.tour.findMany({
      where: isAdmin ? undefined : { agentId },
      include: {
        bins: {
          include: { bin: true },
          orderBy: { orderIndex: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  getTourById: async (tourId: string, agentId: string, isAdmin: boolean) => {
    const tour = await getTourOrThrow(tourId);
    assertTourAccess(tour, agentId, isAdmin);
    return tour;
  },

  createTour: async (input: CreateTourInput) => {
    await assertBinsExist(input.bin_ids.map((bin) => bin.id));

    return prisma.tour.create({
      data: {
        name: input.name,
        agentId: input.agent_id,
        bins: {
          create: input.bin_ids.map((bin) => ({
            binId: bin.id,
            orderIndex: bin.order_index,
          })),
        },
      },
      include: {
        bins: {
          include: { bin: true },
          orderBy: { orderIndex: 'asc' },
        },
      },
    });
  },

  generateTour: async (input: GenerateTourInput) => {
    const candidates = await prisma.bin.findMany({
      where: { status: { in: [...COLLECTIBLE_STATUSES] } },
    });

    const sorted =
      input.priority === 'nearest_first'
        ? sortNearestFirst(candidates)
        : sortFullFirst(candidates);

    const selected = sorted.slice(0, input.max_bins);

    if (selected.length === 0) {
      throw new Error('NO_BINS_AVAILABLE');
    }

    const dateLabel = new Date().toISOString().slice(0, 10);

    return prisma.tour.create({
      data: {
        name: `Tournée auto ${dateLabel}`,
        agentId: input.agent_id,
        bins: {
          create: selected.map((bin, index) => ({
            binId: bin.id,
            orderIndex: index,
          })),
        },
      },
      include: {
        bins: {
          include: { bin: true },
          orderBy: { orderIndex: 'asc' },
        },
      },
    });
  },

  startTour: async (tourId: string, agentId: string, isAdmin: boolean) => {
    const tour = await getTourOrThrow(tourId);
    assertTourAccess(tour, agentId, isAdmin);

    if (tour.status !== 'PLANNED') {
      throw new Error('TOUR_INVALID_STATUS');
    }

    return prisma.tour.update({
      where: { id: tourId },
      data: {
        status: 'IN_PROGRESS',
        startedAt: new Date(),
      },
      include: {
        bins: {
          include: { bin: true },
          orderBy: { orderIndex: 'asc' },
        },
      },
    });
  },

  visitBin: async (tourId: string, binId: string, agentId: string, isAdmin: boolean) => {
    const tour = await getTourOrThrow(tourId);
    assertTourAccess(tour, agentId, isAdmin);

    if (tour.status !== 'IN_PROGRESS') {
      throw new Error('TOUR_NOT_IN_PROGRESS');
    }

    const tourBin = tour.bins.find((item) => item.binId === binId);
    if (!tourBin) {
      throw new Error('BIN_NOT_IN_TOUR');
    }

    if (tourBin.status === 'VISITED') {
      throw new Error('BIN_ALREADY_VISITED');
    }

    const now = new Date();

    await prisma.$transaction([
      prisma.tourBin.update({
        where: { id: tourBin.id },
        data: {
          status: 'VISITED',
          visitedAt: now,
        },
      }),
      prisma.bin.update({
        where: { id: binId },
        data: {
          status: 'EMPTY',
          fillLevel: 0,
          lastMeasurementAt: now,
        },
      }),
    ]);

    return getTourOrThrow(tourId);
  },

  completeTour: async (tourId: string, agentId: string, isAdmin: boolean) => {
    const tour = await getTourOrThrow(tourId);
    assertTourAccess(tour, agentId, isAdmin);

    if (tour.status !== 'IN_PROGRESS') {
      throw new Error('TOUR_NOT_IN_PROGRESS');
    }

    return prisma.tour.update({
      where: { id: tourId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
      include: {
        bins: {
          include: { bin: true },
          orderBy: { orderIndex: 'asc' },
        },
      },
    });
  },
};
