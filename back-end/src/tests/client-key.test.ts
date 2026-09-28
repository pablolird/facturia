import type { Request } from 'express';
import { describe, expect, it } from 'vitest';

import { clientKey } from '../auth/auth.router.js';

function fakeReq(ip: string, headers: Record<string, string> = {}): Request {
  return { ip, headers } as unknown as Request;
}

describe('clientKey', () => {
  it("uses Vercel's forwarded client IP when present", () => {
    expect(clientKey(fakeReq('18.228.0.1', { 'x-vercel-forwarded-for': '181.91.2.3' }))).toBe('181.91.2.3');
  });

  it('falls back to req.ip without the Vercel header', () => {
    expect(clientKey(fakeReq('181.91.2.3'))).toBe('181.91.2.3');
  });

  it('ignores a Vercel header that is not a single IP', () => {
    expect(clientKey(fakeReq('181.91.2.3', { 'x-vercel-forwarded-for': '1.1.1.1, 2.2.2.2' }))).toBe('181.91.2.3');
  });

  it('groups IPv6 clients by subnet so address rotation does not evade limits', () => {
    const a = clientKey(fakeReq('10.0.0.1', { 'x-vercel-forwarded-for': '2001:db8:1:1::1' }));
    const b = clientKey(fakeReq('10.0.0.1', { 'x-vercel-forwarded-for': '2001:db8:1:1::ffff' }));
    expect(a).toBe(b);
  });
});
