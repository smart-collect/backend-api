import { DevicesService } from '@services/devices.service';
import { logger } from '@utils/logger';

const OFFLINE_AFTER_MS = 30 * 60 * 1000;
const ANOMALY_SCAN_INTERVAL_MS = 5 * 60 * 1000;

export async function runAnomalyScan(now = new Date()): Promise<void> {
  const devices = await DevicesService.getDevicesForAnomalyScan();
  const offlineBefore = new Date(now.getTime() - OFFLINE_AFTER_MS);

  for (const device of devices) {
    if (device.status === 'ONLINE' && (!device.lastSeenAt || device.lastSeenAt < offlineBefore)) {
      await DevicesService.markOfflineAndNotify(
        device.deviceId,
        `Aucune mesure recue depuis plus de 30 minutes pour ${device.deviceId}`,
      );
      logger.warn('Device marked offline by anomaly scan', {
        device_id: device.deviceId,
        last_seen_at: device.lastSeenAt,
      });
    }

    if (typeof device.batteryPercent === 'number' && device.batteryPercent < 20) {
      await DevicesService.notifyBattery(device.deviceId, device.batteryPercent, device.batteryPercent < 10);
      logger.warn('Battery anomaly detected', {
        device_id: device.deviceId,
        battery_percent: device.batteryPercent,
      });
    }
  }
}

export function startAnomalyDetector(): NodeJS.Timeout {
  logger.info('Starting IoT anomaly detector', {
    interval_ms: ANOMALY_SCAN_INTERVAL_MS,
  });

  void runAnomalyScan().catch((error: unknown) => {
    logger.error('Initial anomaly scan failed', error);
  });

  return setInterval(() => {
    void runAnomalyScan().catch((error: unknown) => {
      logger.error('Anomaly scan failed', error);
    });
  }, ANOMALY_SCAN_INTERVAL_MS);
}
