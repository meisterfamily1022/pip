// Permanently deletes the calling account.
//
// Account deletion has to be done with the service role — a signed-in user
// cannot remove their own auth record — but it must only ever delete the
// caller. So the request's own JWT is validated first and the id it yields is
// the only id used afterwards; nothing is taken from the request body.
//
// Order matters: photographs are removed before the auth record. Every table
// referencing auth.users cascades on delete, but storage objects do not, so
// deleting the user first would leave the photos behind with no owner able to
// reach them.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const PHOTO_BUCKET = 'toy-photos';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const authorization = request.headers.get('Authorization') ?? '';
  const accessToken = authorization.toLowerCase().startsWith('bearer ') ? authorization.slice(7).trim() : '';
  if (!accessToken) return json({ error: 'authentication_required' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'service_misconfigured' }, 500);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Validated against the auth server rather than merely decoded, so an expired
  // or forged token cannot delete anyone.
  const { data: caller, error: callerError } = await admin.auth.getUser(accessToken);
  if (callerError || !caller.user) return json({ error: 'authentication_required' }, 401);
  const accountId = caller.user.id;

  // Storage has no cascade, so the account's photos are listed and removed
  // explicitly. Paged, because an established library can exceed one page.
  let removedPhotos = 0;
  for (let page = 0; ; page += 1) {
    const { data: objects, error: listError } = await admin.storage
      .from(PHOTO_BUCKET)
      .list(accountId, { limit: 100, offset: page * 100 });
    if (listError) return json({ error: 'photo_cleanup_failed', detail: listError.message }, 500);
    if (!objects || objects.length === 0) break;

    const paths = objects.map((object) => `${accountId}/${object.name}`);
    const { error: removeError } = await admin.storage.from(PHOTO_BUCKET).remove(paths);
    if (removeError) return json({ error: 'photo_cleanup_failed', detail: removeError.message }, 500);
    removedPhotos += paths.length;

    // Removing from the front shifts the remaining objects back into this page.
    if (objects.length < 100) break;
    page -= 1;
  }

  // Every public table keyed on the account cascades from here.
  const { error: deleteError } = await admin.auth.admin.deleteUser(accountId);
  if (deleteError) return json({ error: 'account_deletion_failed', detail: deleteError.message }, 500);

  return json({ deleted: true, accountId, removedPhotos }, 200);
});
