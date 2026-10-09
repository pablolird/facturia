import { Router, type IRouter } from 'express';

import { authenticate } from '../auth/auth.middleware.js';
import { deleteAccount, updateProfile } from './users.controller.js';

const router: IRouter = Router();
router.use(authenticate);
router.patch('/me', updateProfile);
router.delete('/me', deleteAccount);
export default router;
