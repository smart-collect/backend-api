import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  bin: {
    groupBy: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
  },
  report: {
    groupBy: vi.fn(),
    count: vi.fn(),
  },
  tour: {
    findMany: vi.fn(),
  },
  $queryRaw: vi.fn(),
}));

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => prismaMock),
}));

const { StatsService } = await import('../src/services/stats.service');
const { default: app } = await import('../src/index');

const BIN_ID = '22222222-2222-2222-2222-222222222222';

function token(role: 'citizen' | 'agent' | 'admin'): string {
  return jwt.sign(
    {
      sub: `${role}-1`,
      email: `${role}@smartcollect.test`,
      role,
    },
    'test_jwt_secret_change_me_32_chars_min',
    { expiresIn: '15m' },
  );
}

function setupDashboardMocks(): void {
  prismaMock.bin.groupBy.mockResolvedValue([
    { status: 'EMPTY', _count: { _all: 80 } },
    { status: 'HALF', _count: { _all: 20 } },
    { status: 'FULL', _count: { _all: 15 } },
    { status: 'CRITICAL', _count: { _all: 2 } },
  ]);
  prismaMock.bin.count.mockImplementation(async (args?: { where?: { OR?: unknown } }) => {
    if (args?.where?.OR) return 8;
    return 120;
  });
  prismaMock.report.groupBy.mockResolvedValue([
    { status: 'PENDING', _count: { _all: 12 } },
    { status: 'VALIDATED', _count: { _all: 5 } },
    { status: 'RESOLVED', _count: { _all: 40 } },
  ]);
  prismaMock.report.count.mockImplementation(async (args?: { where?: { status?: string; createdAt?: unknown } }) => {
    if (args?.where?.status === 'RESOLVED') return 3;
    if (args?.where?.status === 'REJECTED') return 1;
    if (args?.where?.createdAt) return 126;
    return 0;
  });
  prismaMock.tour.findMany.mockResolvedValue([
    {
      startedAt: new Date('2026-06-16T08:00:00.000Z'),
      completedAt: new Date('2026-06-16T10:30:00.000Z'),
    },
    {
      startedAt: new Date('2026-06-15T09:00:00.000Z'),
      completedAt: new Date('2026-06-15T11:00:00.000Z'),
    },
  ]);
}

describe('Stats API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    StatsService.clearDashboardCache();
    setupDashboardMocks();
  });

  it('refuse /stats/dashboard sans JWT', async () => {
    await request(app).get('/stats/dashboard').expect(401);
  });

  it('refuse /stats/dashboard pour un citoyen', async () => {
    await request(app)
      .get('/stats/dashboard')
      .set('Authorization', `Bearer ${token('citizen')}`)
      .expect(403);
  });

  it('retourne le dashboard pour un agent', async () => {
    const response = await request(app)
      .get('/stats/dashboard')
      .set('Authorization', `Bearer ${token('agent')}`)
      .expect(200);

    expect(response.body.data.bins).toMatchObject({
      total: 120,
      normal: 80,
      almost_full: 20,
      full: 15,
      fire: 2,
      offline: 8,
    });
    expect(response.body.data.reports).toMatchObject({
      pending: 12,
      assigned: 5,
      collected_today: 3,
      rejected_total: 1,
    });
    expect(response.body.data.performance.avg_collection_time_hours).toBe(2.25);
    expect(response.body.data.performance.reports_per_day_avg).toBe(4.2);
  });

  it('retourne le dashboard pour un admin', async () => {
    await request(app)
      .get('/stats/dashboard')
      .set('Authorization', `Bearer ${token('admin')}`)
      .expect(200);

    expect(prismaMock.bin.groupBy).toHaveBeenCalled();
  });

  it('retourne l historique d un bac', async () => {
    prismaMock.bin.findUnique.mockResolvedValue({ id: BIN_ID });
    prismaMock.$queryRaw.mockResolvedValue([
      { date: new Date('2026-06-01T00:00:00.000Z'), fill_level: 42.5 },
      { date: new Date('2026-06-02T00:00:00.000Z'), fill_level: 55.0 },
    ]);

    const response = await request(app)
      .get(`/stats/bins/${BIN_ID}/history?days=30`)
      .set('Authorization', `Bearer ${token('agent')}`)
      .expect(200);

    expect(prismaMock.bin.findUnique).toHaveBeenCalledWith({
      where: { id: BIN_ID },
      select: { id: true },
    });
    expect(response.body.data).toEqual([
      { date: '2026-06-01', fill_level: 42.5 },
      { date: '2026-06-02', fill_level: 55.0 },
    ]);
  });

  it('utilise days=30 par defaut pour l historique', async () => {
    prismaMock.bin.findUnique.mockResolvedValue({ id: BIN_ID });
    prismaMock.$queryRaw.mockResolvedValue([]);

    await request(app)
      .get(`/stats/bins/${BIN_ID}/history`)
      .set('Authorization', `Bearer ${token('agent')}`)
      .expect(200);

    expect(prismaMock.$queryRaw).toHaveBeenCalled();
  });

  it('rejette un parametre days invalide', async () => {
    await request(app)
      .get(`/stats/bins/${BIN_ID}/history?days=0`)
      .set('Authorization', `Bearer ${token('agent')}`)
      .expect(400);

    expect(prismaMock.bin.findUnique).not.toHaveBeenCalled();
  });

  it('retourne 404 si le bac est introuvable', async () => {
    prismaMock.bin.findUnique.mockResolvedValue(null);

    const response = await request(app)
      .get(`/stats/bins/${BIN_ID}/history`)
      .set('Authorization', `Bearer ${token('agent')}`)
      .expect(404);

    expect(response.body.error.code).toBe('BIN_NOT_FOUND');
  });

  it('retourne la heatmap des signalements', async () => {
    prismaMock.$queryRaw.mockResolvedValue([
      { latitude: 4.0512, longitude: 9.7678, count: 14n },
      { latitude: 4.0521, longitude: 9.7687, count: 8n },
    ]);

    const response = await request(app)
      .get('/stats/reports/heatmap')
      .set('Authorization', `Bearer ${token('agent')}`)
      .expect(200);

    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
    expect(response.body.data).toEqual([
      { latitude: 4.0512, longitude: 9.7678, count: 14 },
      { latitude: 4.0521, longitude: 9.7687, count: 8 },
    ]);
  });

  it('refuse la heatmap pour un citoyen', async () => {
    await request(app)
      .get('/stats/reports/heatmap')
      .set('Authorization', `Bearer ${token('citizen')}`)
      .expect(403);

    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
  });
});

describe('StatsService cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    StatsService.clearDashboardCache();
    setupDashboardMocks();
  });

  it('met en cache le dashboard pendant 30 secondes', async () => {
    await StatsService.getDashboard();
    await StatsService.getDashboard();

    expect(prismaMock.bin.groupBy).toHaveBeenCalledTimes(1);
    expect(prismaMock.tour.findMany).toHaveBeenCalledTimes(1);
  });

  it('recharge le dashboard apres expiration du cache', async () => {
    vi.useFakeTimers();

    await StatsService.getDashboard();
    vi.advanceTimersByTime(31_000);
    await StatsService.getDashboard();

    expect(prismaMock.bin.groupBy).toHaveBeenCalledTimes(2);
    expect(prismaMock.tour.findMany).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });
});

describe('StatsService helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    StatsService.clearDashboardCache();
    setupDashboardMocks();
  });

  it('calcule la moyenne de collecte et les reports par jour', async () => {
    const dashboard = await StatsService.getDashboard();

    expect(dashboard.performance.avg_collection_time_hours).toBe(2.25);
    expect(dashboard.performance.reports_per_day_avg).toBe(4.2);
  });

  it('leve BIN_NOT_FOUND pour un historique inconnu', async () => {
    prismaMock.bin.findUnique.mockResolvedValue(null);

    await expect(StatsService.getBinHistory(BIN_ID, 30)).rejects.toThrow('BIN_NOT_FOUND');
  });
});
