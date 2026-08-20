import { createClient } from 'jsr:@supabase/supabase-js@2';

/**
 * Deletes the calling user's Pip account and everything it owns.
 *
 * Removing an auth user needs the service-role key, which cannot ship in a
 * mobile bundle — hence this function. Its whole security posture rests on one
 * rule: the account to delete comes from the verified JWT and never from the
 * request. There is no user id in the body, no admin override, and no path
 * parameter, so there is nothing for a caller to tamper with.
 *
 * Order matters. Storage objects are removed first, because deleting the
 * household rows loses the only record of which objects belonged to whom and
 * would strand the photographs in the bucket forever. Database rows follow via
 * the cascade from auth.users, and the user last.
 *
 * Deploy:
 *   supabase functions deploy delete-account --project-ref <ref>
 * SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by the platform.
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Function is not configured.' }, 500);

  const authorization = request.headers.get('Authorization') ?? '';
  const token = authorization.toLowerCase().startsWith('bearer ') ? authorization.slice(7).trim() : '';
  if (!token) return json({ error: 'Sign in to delete your account.' }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  // The only place the account under deletion is decided.
  const { data: caller, error: callerError } = await admin.auth.getUser(token);
  const userId = caller?.user?.id;
  if (callerError || !userId) return json({ error: 'Sign in to delete your account.' }, 401);

  const { data: households, error: householdError } = await admin
    .from('households')
    .select('id')
    .eq('owner_id', userId);
  if (householdError) return json({ error: 'Your account was not deleted. Please try again.' }, 500);

  // Photographs first: after the rows are gone, nothing records which objects
  // belonged to this account and they could never be found again.
  for (const household of households ?? []) {
    const { data: objects } = await admin.storage.from('toy-images').list(household.id, { limit: 1000 });
    const paths = (objects ?? []).map((object) => `${household.id}/${object.name}`);
    if (paths.length > 0) {
      const { error: removeError } = await admin.storage.from('toy-images').remove(paths);
      if (removeError) return json({ error: 'Your account was not deleted. Please try again.' }, 500);
    }
  }

  // Cascades from auth.users through households to every descendant row.
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) return json({ error: 'Your account was not deleted. Please try again.' }, 500);

  return json({ deleted: true }, 200);
});
