import { beforeEach, describe, expect, it, vi } from 'vitest';

const processMeasurement = vi.fn();
const processStatus = vi.fn();

vi.mock('@services/devices.service', () => ({
  DevicesService: {
    processMeasurement,
    processStatus,
  },
}));

describe('MQTT handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('valide et traite une mesure device data', async () => {
    const { handleMqttMessage } = await import('../src/iot/mqtt.handlers');

    await handleMqttMessage(
      'devices/esp32-001/data',
      Buffer.from(JSON.stringify({
        device_id: 'esp32-001',
        timestamp: '2026-06-16T12:00:00.000Z',
        fill_level: 91,
        fill_central: 90,
        fill_lateral: 92,
        temperature: 34,
        battery_voltage: 3.9,
        battery_percent: 72,
        lid_opens_since_last: 3,
        alert_type: 'FULL',
        rssi_wifi: -63,
      })),
    );

    expect(processMeasurement).toHaveBeenCalledWith(expect.objectContaining({
      device_id: 'esp32-001',
      fill_level: 91,
      battery_percent: 72,
    }));
  });

  it('rejette une mesure invalide sans appeler le service', async () => {
    const { handleMqttMessage } = await import('../src/iot/mqtt.handlers');

    await handleMqttMessage(
      'devices/esp32-001/data',
      Buffer.from(JSON.stringify({
        device_id: 'esp32-001',
        timestamp: '2026-06-16T12:00:00.000Z',
        fill_level: 140,
      })),
    );

    expect(processMeasurement).not.toHaveBeenCalled();
  });

  it('traite un statut MQTT', async () => {
    const { handleMqttMessage } = await import('../src/iot/mqtt.handlers');

    await handleMqttMessage(
      'devices/esp32-001/status',
      Buffer.from(JSON.stringify({
        device_id: 'esp32-001',
        status: 'ONLINE',
        battery_percent: 44,
      })),
    );

    expect(processStatus).toHaveBeenCalledWith(expect.objectContaining({
      device_id: 'esp32-001',
      status: 'ONLINE',
    }));
  });
});
