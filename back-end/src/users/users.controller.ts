import type { Request, Response } from 'express';
import { z } from 'zod';

import { deleteClerkUser } from '../auth/clerk.js';
import { deleteUser, updateUserName } from './users.service.js';

const updateNameSchema = z.object({
  name: z.string().min(2).max(50),
});

export async function updateProfile(req: Request, res: Response): Promise<void> {
  const result = updateNameSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: z.flattenError(result.error) });
    return;
  }
  const updated = await updateUserName(req.user!.id, result.data.name);
  res.json({ name: updated.username });
}

// Clerk first: if that fails the local data is kept and the user can retry, instead of ending up
// with a live Clerk login that silently re-provisions an empty account
export async function deleteAccount(req: Request, res: Response): Promise<void> {
  await deleteClerkUser(req.user!.clerkUserId);
  await deleteUser(req.user!.id);
  res.status(204).send();
}
