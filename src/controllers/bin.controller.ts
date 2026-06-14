import { Request, Response } from 'express';
import { BinService } from '../services/bin.service';

export const BinController = {
  // Récupérer tous les bacs
  getAllBins: async (req: Request, res: Response) => {
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
  }
};