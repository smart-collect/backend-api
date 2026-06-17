import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const listDevices = vi.fn();
const createDevice = vi.fn();

vi.mock('@services/devices.service', () => ({
  DevicesService: {
    listDevices,
    createDevice,
    getDeviceById: vi.fn(),
    getMeasurements: vi.fn(),
    associateDevice: vi.fn(),
    deleteDevice: vi.fn(),
  },
}));

const { default: app } = await import('../src/index');

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

describe('Devices API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('refuse /devices sans JWT', async () => {
    await request(app)
      .get('/devices')
      .expect(401);
  });

  it('liste les devices pour un agent', async () => {
    listDevices.mockResolvedValue([
      {
        id: 'device-db-id',
        deviceId: 'esp32-001',
        name: 'ESP32 Akwa',
        status: 'ONLINE',
      },
    ]);

    const response = await request(app)
      .get('/devices')
      .set('Authorization', `Bearer ${token('agent')}`)
      .expect(200);

    expect(response.body).toHaveProperty('success', true);
    expect(response.body.data).toHaveLength(1);
  });

  it('cree un device uniquement pour admin', async () => {
    createDevice.mockResolvedValue({
      id: 'device-db-id',
      deviceId: 'esp32-001',
      name: 'ESP32 Akwa',
      mqttUsername: 'esp32-001',
      mqttPassword: 'generated-secret',
    });

    await request(app)
      .post('/devices')
      .set('Authorization', `Bearer ${token('agent')}`)
      .send({ device_id: 'esp32-001', name: 'ESP32 Akwa' })
      .expect(403);

    const response = await request(app)
      .post('/devices')
      .set('Authorization', `Bearer ${token('admin')}`)
      .send({ device_id: 'esp32-001', name: 'ESP32 Akwa' })
      .expect(201);

    expect(response.body.data).toMatchObject({
      deviceId: 'esp32-001',
      mqttUsername: 'esp32-001',
    });
  });
});
