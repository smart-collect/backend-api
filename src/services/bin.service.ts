import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const BinService = {
  // Récupérer tous les bacs à ordures
  getAllBins: async () => {
    return await prisma.bin.findMany({
      include: { reports: true }
    });
  },

  // Créer un nouveau bac
  createBin: async (data: { longitude: number; latitude: number }) => {
    return await prisma.bin.create({
      data: {
        longitude: data.longitude,
        latitude: data.latitude,
        status: 'EMPTY'
      }
    });
  }
};