import { Request, Response } from 'express';
import { BinService } from '../services/bin.service';

export const BinController = {
  // Récupérer tous les bacs
  getAllBins: async (_req: Request, res: Response) => {
    try {
      const bins = await BinService.getAllBins();
      res.status(200).json(bins);
    } catch (error) {
      res.status(500).json({ error: 'Erreur lors de la récupération des bacs' });
    }
  },

  // Créer un nouveau bac
  createBin: async (req: Request, res: Response) => {
    try {
      const { longitude, latitude } = req.body;
      if (!longitude || !latitude) {
         res.status(400).json({ error: 'La longitude et la latitude sont requises' });
         return;
      }
      const newBin = await BinService.createBin({ longitude, latitude });
      res.status(201).json(newBin);
    } catch (error) {
      res.status(500).json({ error: 'Erreur lors de la création du bac' });
    }
  },

  // Mettre à jour le statut d'un bac (pour ESP32)
  updateBinStatus: async (req: Request, res: Response) => {
    try {
      const { deviceId, fill, d1, d2, alert } = req.body;
      
      if (!deviceId) {
        res.status(400).json({ error: 'deviceId est requis' });
        return;
      }

      const updatedBin = await BinService.updateBinStatus(deviceId, {
        fillLevel: fill,
        distance1: d1,
        distance2: d2,
        isAlert: alert,
      });

      if (!updatedBin) {
        res.status(404).json({ error: 'Bac non trouvé' });
        return;
      }

      res.status(200).json({ success: true, bin: updatedBin });
    } catch (error) {
      res.status(500).json({ error: 'Erreur lors de la mise à jour du statut' });
    }
  }
};
