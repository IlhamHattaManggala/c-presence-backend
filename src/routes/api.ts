import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import {
  createUser,
  updateUser,
  deleteUser,
  bulkImportEmployees,
  verifyDocument,
  markNotificationRead
} from '../controllers/usersController';

const router = Router();

// Public verification route (For checking approval QR codes)
router.get('/documents/verify/:id', verifyDocument);

// Authenticated user routes
router.post('/notifications/read', requireAuth, markNotificationRead);

// Admin-only user management routes
router.post('/admin/users', requireAuth, requireAdmin, createUser);
router.put('/admin/users/:id', requireAuth, requireAdmin, updateUser);
router.delete('/admin/users/:id', requireAuth, requireAdmin, deleteUser);
router.post('/admin/users/import', requireAuth, requireAdmin, bulkImportEmployees);

export default router;
