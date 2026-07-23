"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const usersController_1 = require("../controllers/usersController");
const router = (0, express_1.Router)();
// Public verification route (For checking approval QR codes)
router.get('/documents/verify/:id', usersController_1.verifyDocument);
// Authenticated user routes
router.post('/notifications/read', auth_1.requireAuth, usersController_1.markNotificationRead);
// Admin-only user management routes
router.post('/admin/users', auth_1.requireAuth, auth_1.requireAdmin, usersController_1.createUser);
router.put('/admin/users/:id', auth_1.requireAuth, auth_1.requireAdmin, usersController_1.updateUser);
router.delete('/admin/users/:id', auth_1.requireAuth, auth_1.requireAdmin, usersController_1.deleteUser);
router.post('/admin/users/import', auth_1.requireAuth, auth_1.requireAdmin, usersController_1.bulkImportEmployees);
exports.default = router;
