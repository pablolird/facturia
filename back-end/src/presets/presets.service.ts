import type { Pool, PoolClient } from 'pg';

import pool from '../db/db.js';
import type { Preset } from './presets.types.js';

export async function listPresets(userId: string): Promise<Preset[]> {
  const { rows } = await pool.query<Preset>(
    'SELECT * FROM presets WHERE user_id = $1 ORDER BY created_at DESC',
    [userId],
  );
  return rows;
}

export async function getPreset(id: string, userId: string): Promise<Preset | null> {
  const { rows } = await pool.query<Preset>(
    'SELECT * FROM presets WHERE id = $1 AND user_id = $2',
    [id, userId],
  );
  return rows[0] ?? null;
}

export interface PresetPayload {
  name: string;
  business_name?: string | undefined;
  ruc?: string | undefined;
  timbrado?: string | undefined;
  address?: string | undefined;
  city?: string | undefined;
  phone?: string | undefined;
  email?: string | undefined;
  logo_data?: string | undefined;
}

// `db` lets callers create the preset inside their own transaction
export async function createPreset(
  userId: string,
  data: PresetPayload,
  db: Pool | PoolClient = pool,
): Promise<Preset> {
  const { rows } = await db.query<Preset>(
    `INSERT INTO presets (user_id, name, business_name, ruc, timbrado, address, city, phone, email, logo_data)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      userId,
      data.name,
      data.business_name ?? null,
      data.ruc ?? null,
      data.timbrado ?? null,
      data.address ?? null,
      data.city ?? null,
      data.phone ?? null,
      data.email ?? null,
      data.logo_data ?? null,
    ],
  );
  return rows[0]!;
}

export interface UpdatePresetPayload {
  name?: string | undefined;
  business_name?: string | undefined;
  ruc?: string | undefined;
  timbrado?: string | undefined;
  address?: string | undefined;
  city?: string | undefined;
  phone?: string | undefined;
  email?: string | undefined;
  logo_data?: string | undefined;
}

export async function updatePreset(
  id: string,
  userId: string,
  data: UpdatePresetPayload,
): Promise<Preset | null> {
  const fields = Object.keys(data) as (keyof UpdatePresetPayload)[];
  if (fields.length === 0) return getPreset(id, userId);

  const setClauses = fields.map((f, i) => `${f} = $${i + 3}`).join(', ');
  const values = fields.map((f) => data[f] ?? null);

  const { rows } = await pool.query<Preset>(
    `UPDATE presets SET ${setClauses}, updated_at = NOW()
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [id, userId, ...values],
  );
  return rows[0] ?? null;
}

export async function deletePreset(id: string, userId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    'DELETE FROM presets WHERE id = $1 AND user_id = $2',
    [id, userId],
  );
  return (rowCount ?? 0) > 0;
}
