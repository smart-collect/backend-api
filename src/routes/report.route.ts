import { Router } from 'express';
import { ReportController } from '../controllers/report.controller';

const router = Router();

// Route pour récupérer tous les signalements
router.get('/', ReportController.getAllReports);

// Route pour créer un signalement
router.post('/', ReportController.createReport);

export default router;