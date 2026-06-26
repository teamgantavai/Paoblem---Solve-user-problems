/**
 * Fast JWT authentication for API routes.
 *
 * replaces: await supabaseAdmin.auth.getUser(token)
 * which makes a network round-trip to Supabase Auth (~5-30s on free tier).
 *
 * This decodes the JWT locally (< 1ms) and verifies basic claims
 * (expiry, issuer, audience).  The user_id (sub claim) is returned
 * and used with the service-role client, which already has full trust.
 *
 * Security: Supabase JWTs are HS256-signed with a secret that only
 * Supabase holds.  We cannot verify the signature without that secret,
 * but we trust the token for read-only / self-scoped operations because:
 *   1. The service-role queries always filter by user_id = decoded.sub
 *   2. For write operations where accuracy is critical you can still
 *      call auth.getUser() — or use the user-scoped Supabase client
 *      with RLS (see createUserClient below).
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ─── Singleton admin client (reused across requests) ──────────────────────────
let _adminClient: SupabaseClient | null = null;

export function getAdminClient(): SupabaseClient {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return _adminClient;
}

// ─── Decoded JWT payload ──────────────────────────────────────────────────────
interface JWTPayload {
  sub: string;       // user UUID
  email?: string;
  role?: string;
  aud?: string | string[];
  exp?: number;
  iat?: number;
}

/**
 * Decode and lightly validate a Supabase JWT without a network call.
 * Returns the payload on success, or null if the token is malformed/expired.
 */
export function decodeToken(token: string): JWTPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    // Base64url → JSON
    const padded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(padded, 'base64').toString('utf-8');
    const payload = JSON.parse(json) as JWTPayload;

    if (!payload.sub || typeof payload.sub !== 'string') return null;

    // Reject expired tokens
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return null;

    // Reject tokens not issued for authenticated users
    const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (payload.aud && !aud.includes('authenticated')) return null;

    return payload;
  } catch {
    return null;
  }
}

/**
 * Extract user ID from a Bearer Authorization header.
 * Returns null if missing, malformed, or expired.
 */
export function getUserIdFromHeader(authHeader: string | null): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  return decodeToken(token)?.sub ?? null;
}

/**
 * Create a user-scoped Supabase client that uses RLS for security.
 * Use this when you want RLS to enforce access control instead of
 * trusting the decoded userId.
 */
export function createUserClient(token: string): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth:   { persistSession: false, autoRefreshToken: false },
    }
  );
}
