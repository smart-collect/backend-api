import { Router } from 'express';
import { BinController } from '../controllers/bin.controller';

const router = Router();

// Route pour récupérer tous les bacs
router.get('/', BinController.getAllBins);

// Route pour créer un nouveau bac
router.post('/', BinController.createBin);

export default router;