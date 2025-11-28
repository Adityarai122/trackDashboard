import express from 'express';
import orderController from '../controllers/orderController.js';

const router = express.Router();

router.get('/search', orderController.searchOrders);
router.get('/all', orderController.getAllOrders);
router.get('/pending', orderController.getPendingOrders);
router.get('/stats', orderController.getDashboardStats); // New Analytics Route

export default router;