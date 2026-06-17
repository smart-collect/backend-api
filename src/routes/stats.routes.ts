import { Router } from 'express';

import { StatsController } from '@controllers/stats.controller';
import { requireAuth, requireRole } from '@middleware/auth';

const router = Router();

router.use(requireAuth);
router.use(requireRole('agent', 'admin'));

/**
 * @swagger
 * tags:
 *   name: Stats
 *   description: Statistiques et tableaux de bord
 */

/**
 * @swagger
 * /stats/dashboard:
 *   get:
 *     summary: Tableau de bord agrégé
 *     description: Cache mémoire 30s. Réservé aux agents et admins.
 *     tags: [Stats]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistiques dashboard
 */
router.get('/dashboard', StatsController.getDashboard);

/**
 * @swagger
 * /stats/reports/heatmap:
 *   get:
 *     summary: Heatmap des signalements par zone (~100m)
 *     tags: [Stats]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Zones agrégées avec compteur
 */
router.get('/reports/heatmap', StatsController.getReportsHeatmap);

/**
 * @swagger
 * /stats/bins/{id}/history:
 *   get:
 *     summary: Historique du niveau de remplissage d'un bac
 *     tags: [Stats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 365
 *           default: 30
 *     responses:
 *       200:
 *         description: Série temporelle journalière
 *       404:
 *         description: Bac introuvable
 */
router.get('/bins/:id/history', StatsController.getBinHistory);

export default router;
