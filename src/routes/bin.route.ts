import { Router } from 'express';
import { BinController } from '../controllers/bin.controller';

const router = Router();

// Route pour récupérer tous les bacs
router.get('/', BinController.getAllBins);

// Route pour créer un nouveau bac
router.post('/', BinController.createBin);

// Route pour mettre à jour le statut d'un bac (pour ESP32)
router.post('/status', BinController.updateBinStatus);

export default router;