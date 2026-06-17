import { Router } from 'express';

import { ToursController } from '@controllers/tours.controller';
import { requireAuth, requireRole } from '@middleware/auth';

const router = Router();

router.use(requireAuth);
router.use(requireRole('agent', 'admin'));

/**
 * @swagger
 * tags:
 *   name: Tours
 *   description: Gestion des tournées de collecte
 */

/**
 * @swagger
 * /tours:
 *   get:
 *     summary: Liste les tournées
 *     description: Un agent voit ses tournées, un admin voit toutes les tournées.
 *     tags: [Tours]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des tournées
 *       401:
 *         description: Non authentifié
 *       403:
 *         description: Rôle insuffisant
 */
router.get('/', ToursController.listTours);

/**
 * @swagger
 * /tours/generate:
 *   post:
 *     summary: Génère une tournée automatiquement
 *     description: V1 — priorité FULL puis tri position (glouton simple) ou plus proche voisin.
 *     tags: [Tours]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [agent_id]
 *             properties:
 *               agent_id:
 *                 type: string
 *               max_bins:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 100
 *                 default: 20
 *               priority:
 *                 type: string
 *                 enum: [full_first, nearest_first]
 *                 default: full_first
 *     responses:
 *       201:
 *         description: Tournée générée
 *       403:
 *         description: Agent ne peut générer que pour lui-même
 *       422:
 *         description: Aucun bac éligible
 */
router.post('/generate', ToursController.generateTour);

/**
 * @swagger
 * /tours:
 *   post:
 *     summary: Crée une tournée manuellement
 *     tags: [Tours]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, agent_id, bin_ids]
 *             properties:
 *               name:
 *                 type: string
 *               agent_id:
 *                 type: string
 *               bin_ids:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [id, order_index]
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     order_index:
 *                       type: integer
 *     responses:
 *       201:
 *         description: Tournée créée
 *       400:
 *         description: Payload invalide
 */
router.post('/', ToursController.createTour);

/**
 * @swagger
 * /tours/{id}:
 *   get:
 *     summary: Détail d'une tournée avec bacs ordonnés
 *     tags: [Tours]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Détail de la tournée
 *       404:
 *         description: Tournée introuvable
 */
router.get('/:id', ToursController.getTour);

/**
 * @swagger
 * /tours/{id}/start:
 *   post:
 *     summary: Démarre une tournée (IN_PROGRESS)
 *     tags: [Tours]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Tournée démarrée
 *       409:
 *         description: Statut invalide
 */
router.post('/:id/start', ToursController.startTour);

/**
 * @swagger
 * /tours/{id}/complete:
 *   post:
 *     summary: Termine une tournée
 *     tags: [Tours]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Tournée terminée
 *       409:
 *         description: La tournée doit être en cours
 */
router.post('/:id/complete', ToursController.completeTour);

/**
 * @swagger
 * /tours/{id}/bins/{bin_id}/visit:
 *   post:
 *     summary: Marque un bac comme visité
 *     tags: [Tours]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: bin_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Bac visité, tournée mise à jour
 *       404:
 *         description: Bac absent de la tournée
 *       409:
 *         description: Bac déjà visité ou tournée non en cours
 */
router.post('/:id/bins/:bin_id/visit', ToursController.visitBin);

export default router;
