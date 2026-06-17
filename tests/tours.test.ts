import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const listTours = vi.fn();
const getTourById = vi.fn();
const createTour = vi.fn();
const generateTour = vi.fn();
const startTour = vi.fn();
const visitBin = vi.fn();
const completeTour = vi.fn();

vi.mock('@services/tours.service', () => ({
  ToursService: {
    listTours,
    getTourById,
    createTour,
    generateTour,
    startTour,
    visitBin,
    completeTour,
  },
}));

const { default: app } = await import('../src/index');

const AGENT_ID = 'agent-1';
const ADMIN_ID = 'admin-1';
const TOUR_ID = '11111111-1111-1111-1111-111111111111';
const BIN_ID = '22222222-2222-2222-2222-222222222222';

function token(role: 'citizen' | 'agent' | 'admin', sub?: string): string {
  return jwt.sign(
    {
      sub: sub ?? `${role}-1`,
      email: `${role}@smartcollect.test`,
      role,
    },
    'test_jwt_secret_change_me_32_chars_min',
    { expiresIn: '15m' },
  );
}

const sampleTour = {
  id: TOUR_ID,
  name: 'Tournée Akwa',
  agentId: AGENT_ID,
  status: 'PLANNED',
  bins: [
    {
      orderIndex: 0,
      binId: BIN_ID,
      status: 'PENDING',
      bin: { id: BIN_ID, status: 'FULL', fillLevel: 92 },
    },
  ],
};

describe('Tours API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('refuse /tours sans JWT', async () => {
    await request(app).get('/tours').expect(401);
  });

  it('refuse /tours pour un citoyen', async () => {
    await request(app)
      .get('/tours')
      .set('Authorization', `Bearer ${token('citizen')}`)
      .expect(403);
  });

  it('liste les tournées pour un agent', async () => {
    listTours.mockResolvedValue([sampleTour]);

    const response = await request(app)
      .get('/tours')
      .set('Authorization', `Bearer ${token('agent', AGENT_ID)}`)
      .expect(200);

    expect(listTours).toHaveBeenCalledWith(AGENT_ID, false);
    expect(response.body.data).toHaveLength(1);
  });

  it('liste toutes les tournées pour un admin', async () => {
    listTours.mockResolvedValue([sampleTour]);

    await request(app)
      .get('/tours')
      .set('Authorization', `Bearer ${token('admin', ADMIN_ID)}`)
      .expect(200);

    expect(listTours).toHaveBeenCalledWith(ADMIN_ID, true);
  });

  it('retourne le détail d une tournée', async () => {
    getTourById.mockResolvedValue(sampleTour);

    const response = await request(app)
      .get(`/tours/${TOUR_ID}`)
      .set('Authorization', `Bearer ${token('agent', AGENT_ID)}`)
      .expect(200);

    expect(getTourById).toHaveBeenCalledWith(TOUR_ID, AGENT_ID, false);
    expect(response.body.data.bins[0].orderIndex).toBe(0);
  });

  it('crée une tournée manuelle pour un agent sur lui-même', async () => {
    createTour.mockResolvedValue(sampleTour);

    const response = await request(app)
      .post('/tours')
      .set('Authorization', `Bearer ${token('agent', AGENT_ID)}`)
      .send({
        name: 'Tournée Akwa',
        agent_id: AGENT_ID,
        bin_ids: [{ id: BIN_ID, order_index: 0 }],
      })
      .expect(201);

    expect(createTour).toHaveBeenCalled();
    expect(response.body.data.name).toBe('Tournée Akwa');
  });

  it('refuse la création pour un autre agent', async () => {
    await request(app)
      .post('/tours')
      .set('Authorization', `Bearer ${token('agent', AGENT_ID)}`)
      .send({
        name: 'Tournée Akwa',
        agent_id: 'autre-agent',
        bin_ids: [{ id: BIN_ID, order_index: 0 }],
      })
      .expect(403);

    expect(createTour).not.toHaveBeenCalled();
  });

  it('génère une tournée auto pour un agent', async () => {
    generateTour.mockResolvedValue({ ...sampleTour, name: 'Tournée auto 2026-06-16' });

    const response = await request(app)
      .post('/tours/generate')
      .set('Authorization', `Bearer ${token('agent', AGENT_ID)}`)
      .send({ agent_id: AGENT_ID, max_bins: 5, priority: 'full_first' })
      .expect(201);

    expect(generateTour).toHaveBeenCalledWith({
      agent_id: AGENT_ID,
      max_bins: 5,
      priority: 'full_first',
    });
    expect(response.body.data.name).toContain('Tournée auto');
  });

  it('démarre une tournée', async () => {
    startTour.mockResolvedValue({ ...sampleTour, status: 'IN_PROGRESS' });

    const response = await request(app)
      .post(`/tours/${TOUR_ID}/start`)
      .set('Authorization', `Bearer ${token('agent', AGENT_ID)}`)
      .expect(200);

    expect(startTour).toHaveBeenCalledWith(TOUR_ID, AGENT_ID, false);
    expect(response.body.data.status).toBe('IN_PROGRESS');
  });

  it('marque un bac comme visité', async () => {
    visitBin.mockResolvedValue({
      ...sampleTour,
      status: 'IN_PROGRESS',
      bins: [{ ...sampleTour.bins[0], status: 'VISITED' }],
    });

    const response = await request(app)
      .post(`/tours/${TOUR_ID}/bins/${BIN_ID}/visit`)
      .set('Authorization', `Bearer ${token('agent', AGENT_ID)}`)
      .expect(200);

    expect(visitBin).toHaveBeenCalledWith(TOUR_ID, BIN_ID, AGENT_ID, false);
    expect(response.body.data.bins[0].status).toBe('VISITED');
  });

  it('termine une tournée', async () => {
    completeTour.mockResolvedValue({ ...sampleTour, status: 'COMPLETED' });

    const response = await request(app)
      .post(`/tours/${TOUR_ID}/complete`)
      .set('Authorization', `Bearer ${token('agent', AGENT_ID)}`)
      .expect(200);

    expect(completeTour).toHaveBeenCalledWith(TOUR_ID, AGENT_ID, false);
    expect(response.body.data.status).toBe('COMPLETED');
  });

  it('rejette un payload de création invalide', async () => {
    await request(app)
      .post('/tours')
      .set('Authorization', `Bearer ${token('agent', AGENT_ID)}`)
      .send({
        name: 'T',
        agent_id: AGENT_ID,
        bin_ids: [],
      })
      .expect(400);

    expect(createTour).not.toHaveBeenCalled();
  });
});
