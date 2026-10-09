import { createHash } from 'node:crypto';

const GMAIL_DOMAINS = new Set(['gmail.com', 'googlemail.com']);

// Collapses addresses that deliver to the same inbox: "+tag" suffixes everywhere, and for Gmail
// also dots in the local part and the googlemail.com alias. Must stay in sync with the
// trial_claims backfill in migration 009.
export function canonicalEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf('@');
  if (at === -1) return normalized;

  let local = normalized.slice(0, at).split('+')[0]!;
  let domain = normalized.slice(at + 1);
  if (GMAIL_DOMAINS.has(domain)) {
    local = local.replaceAll('.', '');
    domain = 'gmail.com';
  }
  return `${local}@${domain}`;
}

export function trialEmailHash(email: string): string {
  return createHash('sha256').update(canonicalEmail(email), 'utf8').digest('hex');
}
