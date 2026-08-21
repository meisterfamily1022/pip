import { supabase } from '@/lib/supabase';

import type { ConflictReason, SyncEntity, WriteIntent } from './conflict-resolution';
import type { CasResult, RemoteHouseholdGateway, RemoteRow } from './remote-gateway';

/**
 * The real transport, against the schema in
 * `supabase/migrations/20260819000000_household_backup.sql`.
 *
 * Every method here is a thin, direct translation of one thing that schema
 * guarantees — the CAS write is a plain `UPDATE ... WHERE revision = ?`
 * because the server-side trigger is what actually assigns revisions, not
 * this file. Undeployed: there is no project this can be exercised against
 * from this environment. `sync-service.test.ts` and `image-pipeline.test.ts`
 * prove the protocol and the orchestration against `FakeHouseholdGateway`,
 * which implements the identical `RemoteHouseholdGateway` contract; this file
 * is what stands behind that contract once a project exists to deploy it to.
 */

const TABLES: Record<SyncEntity, string> = {
  room: 'rooms',
  storage_spot: 'storage_spots',
  toy: 'toys',
  child_profile: 'child_profiles',
  play_session: 'play_sessions',
};

type RemoteRecordRow = {
  local_id: number;
  revision: number;
  deleted_at: string | null;
  [column: string]: unknown;
};

function toIntent(entity: SyncEntity, row: RemoteRecordRow): WriteIntent {
  if (row.deleted_at) return { kind: 'delete' };
  if (entity === 'toy') return { kind: 'edit', photoPath: (row.image_path as string | null) ?? null };
  if (entity === 'play_session') return { kind: 'edit', sessionActive: row.status === 'active' };
  return { kind: 'edit' };
}

export const supabaseHouseholdGateway: RemoteHouseholdGateway = {
  async findOrCreateHousehold(localHouseholdId, name) {
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) throw new Error('Sign in to back up your household.');

    const { data, error } = await supabase
      .from('households')
      .upsert(
        { owner_id: auth.user.id, local_id: localHouseholdId, name },
        { onConflict: 'owner_id,local_id', ignoreDuplicates: false },
      )
      .select('id')
      .single();
    if (error || !data) throw new Error('Your household could not be connected. Please try again.');
    return { remoteHouseholdId: data.id as string };
  },

  async writeRecord(remoteHouseholdId, entity, localId, expectedRevision, intent, data = {}) {
    const table = TABLES[entity];
    const body: Record<string, unknown> = intent.kind === 'delete'
      ? { deleted_at: new Date().toISOString() }
      : { ...data, deleted_at: null };

    if (expectedRevision === null) {
      // First write for this record: insert. A concurrent first write from
      // another device racing this one is caught by the (household_id,
      // local_id) unique constraint, surfaced here as a conflict so the
      // caller re-fetches and resolves rather than crashing.
      const { data: inserted, error } = await supabase
        .from(table)
        .insert({ household_id: remoteHouseholdId, local_id: localId, ...body })
        .select('revision')
        .single();
      if (!error && inserted) return { outcome: 'applied', revision: inserted.revision as number };
      // Fall through to conflict below.
    } else {
      const { data: updated, error } = await supabase
        .from(table)
        .update(body)
        .eq('household_id', remoteHouseholdId)
        .eq('local_id', localId)
        .eq('revision', expectedRevision)
        .select('revision')
        .maybeSingle();
      if (!error && updated) return { outcome: 'applied', revision: updated.revision as number };
    }

    const { data: current, error: fetchError } = await supabase
      .from(table)
      .select('*')
      .eq('household_id', remoteHouseholdId)
      .eq('local_id', localId)
      .maybeSingle<RemoteRecordRow>();
    if (fetchError || !current) throw new Error(`Could not resolve a sync conflict for ${entity} ${localId}.`);
    return { outcome: 'conflict', server: { revision: current.revision, intent: toIntent(entity, current) } };
  },

  async archiveConflict(remoteHouseholdId, entity, localId, reason: ConflictReason, archived) {
    const { error } = await supabase.from('conflict_archive').insert({
      household_id: remoteHouseholdId,
      entity,
      entity_local_id: localId,
      reason,
      archived_data: archived,
    });
    if (error) throw new Error('A recovered record could not be archived.');
  },

  async archiveImagePath(remoteHouseholdId, toyLocalId, imagePath) {
    const { error } = await supabase.from('toy_image_history').insert({
      household_id: remoteHouseholdId,
      toy_local_id: toyLocalId,
      image_path: imagePath,
    });
    if (error) throw new Error('A replaced photo could not be kept in history.');
  },

  async fetchChangesSince(remoteHouseholdId, revision) {
    const rows: RemoteRow[] = [];
    for (const [entity, table] of Object.entries(TABLES) as [SyncEntity, string][]) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('household_id', remoteHouseholdId)
        .gt('revision', revision)
        .order('revision', { ascending: true })
        .returns<RemoteRecordRow[]>();
      if (error) throw new Error(`Could not pull ${entity} changes.`);
      for (const row of data ?? []) {
        rows.push({
          entity,
          localId: row.local_id,
          revision: row.revision,
          deletedAt: row.deleted_at,
          intent: toIntent(entity, row),
          data: row,
        });
      }
    }
    return rows.sort((a, b) => a.revision - b.revision);
  },

  async uploadImage(remoteHouseholdId, toyLocalId, localUri) {
    const response = await fetch(localUri);
    const blob = await response.blob();
    const extension = localUri.split('.').pop()?.split('?')[0] ?? 'jpg';
    const path = `${remoteHouseholdId}/${toyLocalId}-${Date.now()}.${extension}`;
    const { error } = await supabase.storage.from('toy-images').upload(path, blob, { upsert: false });
    if (error) throw new Error('This photo could not be backed up. Please try again.');
    return { path };
  },

  async downloadImage(_remoteHouseholdId, path) {
    const { data, error } = await supabase.storage.from('toy-images').download(path);
    if (error || !data) throw new Error('This photo could not be restored.');
    const { Directory, File, Paths } = await import('expo-file-system');
    const directory = new Directory(Paths.cache, 'pip-restore');
    if (!directory.exists) directory.create({ intermediates: true, idempotent: true });
    const destination = new File(directory, `${Date.now()}-${path.replace(/\//g, '-')}`);
    const buffer = await data.arrayBuffer();
    destination.write(new Uint8Array(buffer));
    return { tempUri: destination.uri };
  },
};
