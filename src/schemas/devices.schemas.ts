import { z } from 'zod';

export const createDeviceSchema = z.object({
  device_id: z.string().min(3).max(80),
  name: z.string().min(2).max(120),
  bin_id: z.string().uuid().optional(),
});

export const associateDeviceSchema = z.object({
  bin_id: z.string().uuid().nullable(),
});

export type CreateDeviceInput = z.infer<typeof createDeviceSchema>;
export type AssociateDeviceInput = z.infer<typeof associateDeviceSchema>;
