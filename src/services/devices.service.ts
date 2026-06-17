import crypto from 'crypto';
import { Prisma, PrismaClient } from '@prisma/client';

import { CreateDeviceInput } from '@/schemas/devices.schemas';
import { MqttMeasurementPayload, MqttStatusPayload } from '@/iot/mqtt.schemas';
import { logger } from '@utils/logger';

const prisma = new PrismaClient();

function createMqttPassword(): string {
  return crypto.randomBytes(24).toString('base64url');
}

function getBinStatus(fillLevel: number, temperature?: number): string {
  if ((temperature ?? 0) > 60) return 'CRITICAL';
  if (fillLevel > 90) return 'FULL';
  if (fillLevel >= 50) return 'HALF';
  return 'EMPTY';
}

async function createNotification(input: {
  type: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  message: string;
  deviceId?: string;
  binId?: string;
  metadata?: Prisma.InputJsonValue;
}) {
  return prisma.notification.create({
    data: {
      type: input.type,
      severity: input.severity,
      title: input.title,
      message: input.message,
      deviceId: input.deviceId,
      binId: input.binId,
      metadata: input.metadata,
    },
  });
}

export const DevicesService = {
  listDevices: async () => {
    return prisma.device.findMany({
      include: { bin: true },
      orderBy: { createdAt: 'desc' },
    });
  },

  getDeviceById: async (id: string) => {
    return prisma.device.findUnique({
      where: { id },
      include: {
        bin: true,
        measurements: {
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
      },
    });
  },

  getMeasurements: async (id: string, limit = 100) => {
    const device = await prisma.device.findUnique({ where: { id } });
    if (!device) return null;

    return prisma.measurement.findMany({
      where: { deviceId: device.deviceId },
      orderBy: { timestamp: 'desc' },
      take: Math.min(Math.max(limit, 1), 500),
    });
  },

  createDevice: async (input: CreateDeviceInput) => {
    if (input.bin_id) {
      const bin = await prisma.bin.findUnique({ where: { id: input.bin_id } });
      if (!bin) {
        throw new Error('BIN_NOT_FOUND');
      }
    }

    const mqttPassword = createMqttPassword();

    return prisma.device.create({
      data: {
        deviceId: input.device_id,
        name: input.name,
        mqttUsername: input.device_id,
        mqttPassword,
        binId: input.bin_id,
      },
      include: { bin: true },
    });
  },

  associateDevice: async (id: string, binId: string | null) => {
    if (binId) {
      const bin = await prisma.bin.findUnique({ where: { id: binId } });
      if (!bin) {
        throw new Error('BIN_NOT_FOUND');
      }
    }

    return prisma.device.update({
      where: { id },
      data: { binId },
      include: { bin: true },
    });
  },

  deleteDevice: async (id: string) => {
    return prisma.device.delete({ where: { id } });
  },

  processMeasurement: async (payload: MqttMeasurementPayload) => {
    const device = await prisma.device.findUnique({
      where: { deviceId: payload.device_id },
      include: { bin: true },
    });

    if (!device) {
      logger.warn('MQTT measurement rejected: unknown device', {
        device_id: payload.device_id,
      });
      throw new Error('DEVICE_NOT_FOUND');
    }

    const measurement = await prisma.$transaction(async (tx) => {
      const created = await tx.measurement.create({
        data: {
          deviceId: payload.device_id,
          binId: device.binId,
          timestamp: payload.timestamp,
          fillLevel: payload.fill_level,
          fillCentral: payload.fill_central,
          fillLateral: payload.fill_lateral,
          temperature: payload.temperature,
          batteryVoltage: payload.battery_voltage,
          batteryPercent: payload.battery_percent,
          lidOpensSinceLast: payload.lid_opens_since_last,
          alertType: payload.alert_type,
          rssiWifi: payload.rssi_wifi,
        },
      });

      if (device.binId) {
        await tx.bin.update({
          where: { id: device.binId },
          data: {
            fillLevel: payload.fill_level,
            status: getBinStatus(payload.fill_level, payload.temperature),
            lastMeasurementAt: payload.timestamp,
          },
        });
      }

      await tx.device.update({
        where: { deviceId: payload.device_id },
        data: {
          lastSeenAt: payload.timestamp,
          batteryVoltage: payload.battery_voltage,
          batteryPercent: payload.battery_percent,
          status: 'ONLINE',
        },
      });

      return created;
    });

    if (payload.alert_type) {
      await createNotification({
        type: 'DEVICE_ALERT',
        severity: 'WARNING',
        title: `Alerte device ${payload.device_id}`,
        message: `Alerte MQTT recue: ${payload.alert_type}`,
        deviceId: payload.device_id,
        binId: device.binId ?? undefined,
        metadata: { alert_type: payload.alert_type },
      });
    }

    if (payload.fill_level > 90 || (payload.temperature ?? 0) > 60) {
      await createNotification({
        type: 'URGENT_MEASUREMENT',
        severity: 'CRITICAL',
        title: `Intervention urgente ${payload.device_id}`,
        message: `Seuil critique: remplissage ${payload.fill_level}% / temperature ${payload.temperature ?? 'n/a'}`,
        deviceId: payload.device_id,
        binId: device.binId ?? undefined,
        metadata: {
          fill_level: payload.fill_level,
          temperature: payload.temperature,
        },
      });
    }

    logger.info('MQTT measurement processed', {
      device_id: payload.device_id,
      measurement_id: measurement.id,
      fill_level: payload.fill_level,
    });

    return measurement;
  },

  processStatus: async (payload: MqttStatusPayload) => {
    const device = await prisma.device.findUnique({ where: { deviceId: payload.device_id } });
    if (!device) {
      logger.warn('MQTT status rejected: unknown device', {
        device_id: payload.device_id,
      });
      throw new Error('DEVICE_NOT_FOUND');
    }

    return prisma.device.update({
      where: { deviceId: payload.device_id },
      data: {
        status: payload.status,
        lastSeenAt: payload.timestamp,
        batteryVoltage: payload.battery_voltage,
        batteryPercent: payload.battery_percent,
      },
    });
  },

  markOfflineAndNotify: async (deviceId: string, reason: string) => {
    const device = await prisma.device.update({
      where: { deviceId },
      data: { status: 'OFFLINE' },
    });

    await createNotification({
      type: 'DEVICE_OFFLINE',
      severity: 'WARNING',
      title: `Device hors ligne ${deviceId}`,
      message: reason,
      deviceId,
      binId: device.binId ?? undefined,
    });

    return device;
  },

  notifyBattery: async (deviceId: string, batteryPercent: number, critical: boolean) => {
    const device = await prisma.device.findUnique({ where: { deviceId } });
    if (!device) return null;

    return createNotification({
      type: critical ? 'BATTERY_CRITICAL' : 'BATTERY_LOW',
      severity: critical ? 'CRITICAL' : 'WARNING',
      title: critical ? `Batterie critique ${deviceId}` : `Batterie faible ${deviceId}`,
      message: `Batterie a ${batteryPercent}%`,
      deviceId,
      binId: device.binId ?? undefined,
      metadata: { battery_percent: batteryPercent },
    });
  },

  getDevicesForAnomalyScan: async () => {
    return prisma.device.findMany({
      where: {
        OR: [
          { status: 'ONLINE' },
          { batteryPercent: { lt: 20 } },
        ],
      },
    });
  },
};
