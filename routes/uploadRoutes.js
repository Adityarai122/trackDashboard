import express from 'express';
import multer from 'multer';
import uploadController from '../controllers/uploadController.js';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// Upload for Pending Orders (Updates PendingOrder Collection)
router.post('/pending', upload.single('file'), (req, res) =>
  uploadController.uploadFile(req, res, 'PENDING')
);

// Upload for Dispatched Orders (Updates Order Collection & Cleans PendingOrder)
router.post('/dispatched', upload.single('file'), (req, res) =>
  uploadController.uploadFile(req, res, 'DISPATCHED')
);

export default router;