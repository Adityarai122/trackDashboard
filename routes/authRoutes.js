import express from 'express';
import authController from '../controllers/authController.js';

const router = express.Router();

router.post('/send-otp', authController.sendOtp);
router.post('/verify-otp', authController.verifyOtp);

export default router;