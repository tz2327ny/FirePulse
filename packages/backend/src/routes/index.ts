import { Router } from 'express';
import authRoutes from './auth.js';
import participantRoutes from './participants.js';
import classRoutes from './classes.js';
import sessionRoutes from './sessions.js';
import deviceRoutes from './devices.js';
import receiverRoutes from './receivers.js';
import telemetryRoutes from './telemetry.js';
import alertRoutes from './alerts.js';
import settingsRoutes from './settings.js';
import rehabRoutes from './rehab.js';
import userRoutes from './users.js';
import auditRoutes from './audit.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/participants', participantRoutes);
router.use('/classes', classRoutes);
router.use('/sessions', sessionRoutes);
router.use('/devices', deviceRoutes);
router.use('/receivers', receiverRoutes);
router.use('/telemetry', telemetryRoutes);
router.use('/alerts', alertRoutes);
router.use('/settings', settingsRoutes);
router.use('/rehab', rehabRoutes);
router.use('/users', userRoutes);
router.use('/audit-log', auditRoutes);

export default router;
