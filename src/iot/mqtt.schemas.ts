import { z } from 'zod';

export const mqttMeasurementSchema = z.object({
  device_id: z.string().min(3),
  timestamp: z.coerce.date(),
  fill_level: z.number().min(0).max(100),
  fill_central: z.number().min(0).max(100).optional(),
  fill_lateral: z.number().min(0).max(100).optional(),
  temperature: z.number().min(-40).max(125).optional(),
  battery_voltage: z.number().positive().optional(),
  battery_percent: z.number().int().min(0).max(100).optional(),
  lid_opens_since_last: z.number().int().min(0).optional(),
  alert_type: z.string().min(1).max(80).optional(),
  rssi_wifi: z.number().int().optional(),
});

export const mqttStatusSchema = z.object({
  device_id: z.string().min(3),
  timestamp: z.coerce.date().default(() => new Date()),
  status: z.enum(['ONLINE', 'OFFLINE']).default('ONLINE'),
  battery_voltage: z.number().positive().optional(),
  battery_percent: z.number().int().min(0).max(100).optional(),
  rssi_wifi: z.number().int().optional(),
});

export type MqttMeasurementPayload = z.infer<typeof mqttMeasurementSchema>;
export type MqttStatusPayload = z.infer<typeof mqttStatusSchema>;
