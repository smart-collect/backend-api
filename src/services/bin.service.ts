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
  },

  // Mettre à jour le statut d'un bac (pour ESP32)
  updateBinStatus: async (deviceId: string, data: { fillLevel?: number; distance1?: number; distance2?: number; isAlert?: boolean }) => {
    // Trouver le device par deviceId
    const device = await prisma.device.findUnique({
      where: { deviceId },
      include: { bin: true }
    });

    if (!device || !device.bin) {
      return null;
    }

    const bin = device.bin;

    // Déterminer le statut basé sur le niveau de remplissage
    let status = 'EMPTY';
    if (data.fillLevel && data.fillLevel >= 90) {
      status = 'FULL';
    } else if (data.fillLevel && data.fillLevel >= 70) {
      status = 'ALMOST_FULL';
    } else if (data.fillLevel && data.fillLevel >= 50) {
      status = 'HALF_FULL';
    }

    // Mettre à jour le bac
    const updatedBin = await prisma.bin.update({
      where: { id: bin.id },
      data: {
        fillLevel: data.fillLevel,
        status: status,
        lastMeasurementAt: new Date(),
      }
    });

    // Mettre à jour le device (lastSeenAt)
    await prisma.device.update({
      where: { id: device.id },
      data: {
        status: 'ONLINE',
        lastSeenAt: new Date(),
      }
    });

    // Créer une mesure si des distances sont fournies
    if (data.distance1 !== undefined) {
      await prisma.measurement.create({
        data: {
          deviceId: device.deviceId,
          binId: bin.id,
          timestamp: new Date(),
          fillLevel: data.fillLevel || 0,
          fillCentral: data.distance1,
          fillLateral: data.distance2,
          alertType: data.isAlert ? 'FULL' : null,
        }
      });
    }

    return updatedBin;
  }
};