import { z } from 'zod';

export const binHistoryQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

export type BinHistoryQuery = z.infer<typeof binHistoryQuerySchema>;

export interface DashboardBinsStats {
  total: number;
  normal: number;
  almost_full: number;
  full: number;
  fire: number;
  offline: number;
}

export interface DashboardReportsStats {
  pending: number;
  assigned: number;
  collected_today: number;
  rejected_total: number;
}

export interface DashboardPerformanceStats {
  avg_collection_time_hours: number;
  reports_per_day_avg: number;
}

export interface DashboardStats {
  bins: DashboardBinsStats;
  reports: DashboardReportsStats;
  performance: DashboardPerformanceStats;
}

export interface BinHistoryPoint {
  date: string;
  fill_level: number;
}

export interface HeatmapZone {
  latitude: number;
  longitude: number;
  count: number;
}
