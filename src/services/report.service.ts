import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const ReportService = {
  // Récupérer tous les signalements
  getAllReports: async () => {
    return await prisma.report.findMany({
      include: { bin: true }
    });
  },

  // Créer un signalement lié à un bac spécifique
  createReport: async (data: { binId: string; description?: string; imageUrl?: string }) => {
    return await prisma.report.create({
      data: {
        binId: data.binId,
        description: data.description,
        imageUrl: data.imageUrl,
        status: 'PENDING'
      }
    });
  }
};