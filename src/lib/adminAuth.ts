import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Initialize admin supabase client to bypass RLS and perform administrative tasks
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

import { ADMIN_EMAIL } from './adminConstants';

export interface AdminUser {
  id: string;
  email?: string;
}

/**
 * Verifies if the request is authenticated and authorized to perform admin actions.
 * Throws an error response object if validation fails.
 */
export async function verifyAdmin(req: NextRequest): Promise<AdminUser> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    throw new Error('Unauthorized: Missing authorization header');
  }

  const token = authHeader.replace('Bearer ', '');
  if (!token) {
    throw new Error('Unauthorized: Empty token');
  }

  try {
    const logPath = path.join(process.cwd(), 'scratch', 'debug_auth.txt');
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] verifyAdmin: token=${token}, NODE_ENV=${process.env.NODE_ENV}\n`);
  } catch (e: any) {
    console.error('Failed to write debug auth log:', e.message);
  }

  // Development mock bypass
  if (process.env.NODE_ENV === 'development' && token === 'mock-admin-token') {
    return {
      id: 'mock-admin-uuid',
      email: ADMIN_EMAIL,
    };
  }

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) {
    throw new Error(`Unauthorized: Invalid session - ${error?.message || 'User not found'}`);
  }

  if (user.email !== ADMIN_EMAIL) {
    throw new Error('Forbidden: Access denied. Unauthorized admin email.');
  }

  return {
    id: user.id,
    email: user.email,
  };
}

/**
 * Logs an administrative action to the audit logs database table.
 * Fails gracefully to console if the database table is not yet created.
 */
export async function logAdminAction(
  adminId: string,
  action: string,
  targetType: string,
  targetId: string,
  details: any = {}
) {
  const timestamp = new Date().toISOString();
  console.log(`[Admin Audit] [${timestamp}] Admin: ${adminId}, Action: ${action}, Target: ${targetType}:${targetId}, Details:`, JSON.stringify(details));

  try {
    const { error } = await supabaseAdmin.from('admin_audit_logs').insert({
      admin_id: adminId,
      action,
      target_type: targetType,
      target_id: targetId,
      details,
    });
    if (error) {
      console.warn('[Admin Audit] Failed to write to database admin_audit_logs table:', error.message);
    }
  } catch (err: any) {
    console.warn('[Admin Audit] Failed to execute database log audit insertion (table might be missing):', err.message);
  }
}
