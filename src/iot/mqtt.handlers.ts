import { ZodError } from 'zod';

import { mqttMeasurementSchema, mqttStatusSchema } from '@/iot/mqtt.schemas';
import { DevicesService } from '@services/devices.service';
import { logger } from '@utils/logger';

function parseJsonPayload(payload: Buffer): unknown {
  const raw = payload.toString('utf8');
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new Error('INVALID_JSON');
  }
}

function getTopicKind(topic: string): 'data' | 'status' | 'alert' | null {
  const parts = topic.split('/');
  if (parts.length !== 3 || parts[0] !== 'devices') return null;

  const kind = parts[2];
  if (kind === 'data' || kind === 'status' || kind === 'alert') return kind;
  return null;
}

export async function handleMqttMessage(topic: string, payload: Buffer): Promise<void> {
  const kind = getTopicKind(topic);
  if (!kind) {
    logger.warn('MQTT message ignored: unsupported topic', { topic });
    return;
  }

  try {
    const json = parseJsonPayload(payload);

    if (kind === 'status') {
      const statusPayload = mqttStatusSchema.parse(json);
      await DevicesService.processStatus(statusPayload);
      logger.info('MQTT status processed', {
        topic,
        device_id: statusPayload.device_id,
        status: statusPayload.status,
      });
      return;
    }

    const measurementPayload = mqttMeasurementSchema.parse(json);
    await DevicesService.processMeasurement(measurementPayload);
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn('MQTT message rejected: validation failed', {
        topic,
        errors: error.flatten(),
      });
      return;
    }

    const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
    logger.error('MQTT message processing failed', {
      topic,
      error: message,
    });
  }
}
