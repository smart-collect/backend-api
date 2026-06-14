import { Request, Response } from 'express';
import { ReportService } from '../services/report.service';

export const ReportController = {
  // Récupérer tous les signalements
  getAllReports: async (req: Request, res: Response) => {
    try {
      const reports = await ReportService.getAllReports();
      res.status(200).json(reports);
    } catch (error) {
      res.status(500).json({ error: 'Erreur lors de la récupération des signalements' });
    }
  },

  // Créer un signalement
  createReport: async (req: Request, res: Response) => {
    try {
      const { binId, description, imageUrl } = req.body;
      if (!binId) {
        res.status(400).json({ error: "L'identifiant du bac (binId) est requis" });
        return;
      }
      const newReport = await ReportService.createReport({ binId, description, imageUrl });
      res.status(201).json(newReport);
    } catch (error) {
      res.status(500).json({ error: 'Erreur lors de la création du signalement' });
    }
  }
};