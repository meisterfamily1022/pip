import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

/**
 * Who is calling, established against the auth server rather than the token.
 *
 * This exists because of a specific, measured gap. Deleting a Supabase user
 * does not revoke access tokens already issued to them: a JWT stays
 * cryptographically valid until `exp`, and PostgREST and Storage both keep
 * answering `200 []` for a deleted user rather than rejecting the request.
 * Nothing leaks, because RLS matches no rows — but "RLS returns nothing" is
 * not revocation, and any future table with a broader policy would be exposed
 * for the remainder of the token's lifetime.
 *
 * `auth.getUser(token)` asks GoTrue whether the subject still exists, so a
 * deleted account is refused immediately instead of at expiry. Every Edge
 * Function doing anything sensitive must identify its caller through here, so
 * that check is one import rather than something each new function has to
 * remember to repeat.
 *
 * The returned id is the *only* legitimate subject for the request. Never take
 * an account id from a request body, query string, or path.
 */

export type Caller = {
  readonly accountId: string;
  /** Service-role client. Authorised for anything; give it only vetted ids. */
  readonly admin: SupabaseClient;
};

export class CallerRejected extends Error {
  constructor(readonly status: number, readonly body: Record<string, unknown>) {
    super(String(body.error ?? 'rejected'));
  }
}

export function bearerToken(request: Request): string {
  const header = request.headers.get('Authorization') ?? '';
  return header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
}

export async function authenticateCaller(request: Request, rejection: string): Promise<Caller> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    throw new CallerRejected(500, { error: 'Function is not configured.' });
  }

  const token = bearerToken(request);
  if (!token) throw new CallerRejected(401, { error: rejection });

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  // The round trip is the point. A locally decoded token cannot tell you the
  // account behind it still exists.
  const { data, error } = await admin.auth.getUser(token);
  const accountId = data?.user?.id;
  if (error || !accountId) throw new CallerRejected(401, { error: rejection });

  return { accountId, admin };
}
