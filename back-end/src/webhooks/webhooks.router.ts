import express, { type IRouter, Router } from 'express';

import { clerkWebhook } from './webhooks.controller.js';

const router: IRouter = Router();
// Signature verification needs the exact bytes Clerk signed, so this router is mounted before
// the global JSON parser and reads the raw body
router.post('/clerk', express.raw({ type: 'application/json', limit: '1mb' }), clerkWebhook);
export default router;
