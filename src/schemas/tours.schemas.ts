import { z } from 'zod';

export const tourBinInputSchema = z.object({
  id: z.string().uuid(),
  order_index: z.number().int().min(0),
});

export const createTourSchema = z.object({
  name: z.string().min(2).max(120),
  agent_id: z.string().min(1).max(80),
  bin_ids: z.array(tourBinInputSchema).min(1).max(100),
}).superRefine((data, ctx) => {
  const orderIndexes = data.bin_ids.map((b) => b.order_index);
  const binIds = data.bin_ids.map((b) => b.id);

  if (new Set(orderIndexes).size !== orderIndexes.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'order_index doit etre unique pour chaque bac',
      path: ['bin_ids'],
    });
  }

  if (new Set(binIds).size !== binIds.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Chaque bac ne peut apparaitre qu\'une seule fois',
      path: ['bin_ids'],
    });
  }
});

export const generateTourSchema = z.object({
  agent_id: z.string().min(1).max(80),
  max_bins: z.number().int().min(1).max(100).default(20),
  priority: z.enum(['full_first', 'nearest_first']).default('full_first'),
});

export type CreateTourInput = z.infer<typeof createTourSchema>;
export type GenerateTourInput = z.infer<typeof generateTourSchema>;
