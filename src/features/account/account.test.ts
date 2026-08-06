import { LOCAL_HOUSEHOLD_ID, runMigrations } from '@/database/migrations';
import { RealSqliteConnection } from '@/database/real-sqlite-connection.test-helper';
import { ensureSettings } from '@/repositories/settings-repository';
import { AuthService } from '@/server/auth/auth-service';
import { AUTH_DEFAULTS, loadAuthConfig } from '@/server/auth/config';
import { RecordingMailSender } from '@/server/auth/mail';
import { LocalDevelopmentAuthStorage, resetAuthStorageForTests } from '@/server/auth/storage';
import { EXPORT_FORMAT_VERSION, buildHouseholdExport, exportFileName, serialiseExport } from './export-service';

/* --------------------------------------------------------------- exporting */

type Fixture = { database: RealSqliteConnection };

async function setUp(): Promise<Fixture> {
  const database = new RealSqliteConnection();
  await runMigrations(database);
  await ensureSettings(database);

  await database.runAsync(
    "INSERT INTO rooms (name, household_id, created_at, updated_at) VALUES ('Playroom', ?, '2026-01-01', '2026-01-01');",
    LOCAL_HOUSEHOLD_ID,
  );
  await database.runAsync(
    "INSERT INTO storage_spots (room_id, name, household_id, created_at, updated_at) VALUES (1, 'Blue Bin', ?, '2026-01-01', '2026-01-01');",
    LOCAL_HOUSEHOLD_ID,
  );
  await database.runAsync(
    `INSERT INTO toys (name, image_uri, room_id, storage_spot_id, household_id, created_at, updated_at)
     VALUES ('Magnetic Tiles', 'file:///photos/tiles.jpg', 1, 1, ?, '2026-01-01', '2026-01-01');`,
    LOCAL_HOUSEHOLD_ID,
  );
  await database.runAsync(
    "INSERT INTO toy_categories (toy_id, category, created_at) VALUES (1, 'building', '2026-01-01');",
  );
  await database.runAsync(
    "INSERT INTO child_profiles (name, household_id, created_at, updated_at) VALUES ('Maya', ?, '2026-01-01', '2026-01-01');",
    LOCAL_HOUSEHOLD_ID,
  );
  await database.runAsync(
    `INSERT INTO play_sessions (child_id, toy_id, status, started_at, completed_at, household_id, created_at, updated_at)
     VALUES (1, 1, 'completed', '2026-02-01', '2026-02-01', ?, '2026-02-01', '2026-02-01');`,
    LOCAL_HOUSEHOLD_ID,
  );

  return { database };
}

const clock = { now: () => new Date('2026-08-06T12:00:00.000Z') };

describe('data export', () => {
  let fixture: Fixture;

  beforeEach(async () => {
    fixture = await setUp();
  });

  afterEach(() => {
    fixture.database.close();
  });

  it('includes the whole library with names resolved, not foreign keys', async () => {
    const data = await buildHouseholdExport(fixture.database, LOCAL_HOUSEHOLD_ID, clock);

    expect(data.formatVersion).toBe(EXPORT_FORMAT_VERSION);
    expect(data.rooms).toEqual([{ id: 1, name: 'Playroom', storageSpots: [{ id: 1, name: 'Blue Bin' }] }]);
    expect(data.toys[0]).toMatchObject({
      name: 'Magnetic Tiles',
      room: 'Playroom',
      storageSpot: 'Blue Bin',
      categories: ['building'],
    });
    expect(data.children[0]).toMatchObject({ name: 'Maya', choiceLimit: 3 });
    expect(data.playHistory).toEqual([
      { toy: 'Magnetic Tiles', child: 'Maya', startedAt: '2026-02-01', completedAt: '2026-02-01' },
    ]);
  });

  it('references photos by path rather than embedding them', async () => {
    const data = await buildHouseholdExport(fixture.database, LOCAL_HOUSEHOLD_ID, clock);
    expect(data.toys[0].photoPath).toBe('file:///photos/tiles.jpg');
    // A library of hundreds of photos must not become a base64 wall.
    expect(serialiseExport(data)).not.toMatch(/base64|data:image/i);
  });

  it('contains no secret of any kind', async () => {
    const payload = serialiseExport(await buildHouseholdExport(fixture.database, LOCAL_HOUSEHOLD_ID, clock));
    expect(payload).not.toMatch(/password|passwordHash|scrypt\$|token|parent_pin|verificationCode|codeHash/i);
  });

  it('exports Guest play with no child rather than inventing one', async () => {
    await fixture.database.runAsync(
      `INSERT INTO play_sessions (child_id, toy_id, status, started_at, completed_at, household_id, created_at, updated_at)
       VALUES (NULL, 1, 'completed', '2026-03-01', '2026-03-01', ?, '2026-03-01', '2026-03-01');`,
      LOCAL_HOUSEHOLD_ID,
    );

    const data = await buildHouseholdExport(fixture.database, LOCAL_HOUSEHOLD_ID, clock);
    expect(data.playHistory.find((entry) => entry.startedAt === '2026-03-01')?.child).toBeNull();
  });

  it('is valid JSON with a filename a parent will recognise later', async () => {
    const data = await buildHouseholdExport(fixture.database, LOCAL_HOUSEHOLD_ID, clock);
    expect(() => JSON.parse(serialiseExport(data))).not.toThrow();
    expect(exportFileName(data)).toBe('pip-export-2026-08-06.json');
  });

  it('refuses to export a household that does not exist', async () => {
    await expect(buildHouseholdExport(fixture.database, 'hh_missing', clock)).rejects.toThrow(
      'There is nothing to export yet.',
    );
  });

  it('marks sample toys so an export cannot be mistaken for a real library', async () => {
    await fixture.database.runAsync(
      `INSERT INTO toys (name, room_id, storage_spot_id, household_id, is_sample, created_at, updated_at)
       VALUES ('Sample Blocks', 1, 1, ?, 1, '2026-01-01', '2026-01-01');`,
      LOCAL_HOUSEHOLD_ID,
    );
    const data = await buildHouseholdExport(fixture.database, LOCAL_HOUSEHOLD_ID, clock);
    expect(data.toys.find((toy) => toy.name === 'Sample Blocks')?.isSample).toBe(true);
    expect(data.toys.find((toy) => toy.name === 'Magnetic Tiles')?.isSample).toBe(false);
  });
});

/* ------------------------------------------------------- account deletion */

const PASSWORD = 'correct-horse-battery';

describe('account deletion', () => {
  beforeEach(() => {
    resetAuthStorageForTests();
  });

  const build = () => {
    const mail = new RecordingMailSender();
    const storage = new LocalDevelopmentAuthStorage();
    const config = loadAuthConfig({ PIP_SESSION_SECRET: 's', PIP_ONE_TIME_SECRET: 'o' });
    const clockState = { current: new Date('2026-08-06T12:00:00.000Z') };
    const service = new AuthService({
      mail,
      storage,
      config,
      clock: { now: () => clockState.current },
    });
    return { service, mail, storage, clockState };
  };

  const register = async (service: AuthService, mail: RecordingMailSender): Promise<string> => {
    await service.signUp({
      email: 'parent@example.com',
      firstName: 'Sam',
      password: PASSWORD,
      acceptedTerms: true,
    });
    const latest = [...mail.sent].reverse().find((email) => email.kind === 'verification');
    if (!latest || latest.kind !== 'verification') throw new Error('no verification email');
    const session = await service.verifyEmail('parent@example.com', latest.code);
    return session.token;
  };

  it('deletes the account and stops the session working', async () => {
    const { service, mail, storage } = build();
    const token = await register(service, mail);

    await service.deleteAccount(token);

    expect(await storage.accounts.findByEmail('parent@example.com')).toBeUndefined();
    await expect(service.authenticate(token)).rejects.toMatchObject({ code: 'SESSION_INVALID' });
  });

  it('requires a recent password confirmation, not merely a valid session', async () => {
    const { service, mail, clockState } = build();
    const token = await register(service, mail);

    // A session that has been open a while: valid, but not recently confirmed.
    clockState.current = new Date(clockState.current.getTime() + AUTH_DEFAULTS.reauthenticationWindowMs + 1000);
    await expect(service.deleteAccount(token)).rejects.toMatchObject({ code: 'REAUTHENTICATION_REQUIRED' });

    await service.reauthenticate(token, PASSWORD);
    await expect(service.deleteAccount(token)).resolves.toMatchObject({ deletedAccountId: expect.any(String) });
  });

  it('frees the address so it can be used again', async () => {
    const { service, mail } = build();
    const token = await register(service, mail);
    await service.deleteAccount(token);

    await expect(
      service.signUp({ email: 'parent@example.com', firstName: 'Sam', password: PASSWORD, acceptedTerms: true }),
    ).resolves.toEqual({ verificationRequired: true });
  });

  it('revokes every session, not just the one that asked', async () => {
    const { service, mail } = build();
    const first = await register(service, mail);
    const second = await service.signIn('parent@example.com', PASSWORD);

    await service.deleteAccount(first);

    // The other device must lose access immediately, not when its token expires.
    await expect(service.authenticate(second.token)).rejects.toMatchObject({ code: 'SESSION_INVALID' });
  });

  it('refuses without a session at all', async () => {
    const { service } = build();
    await expect(service.deleteAccount('pip_not.a.token')).rejects.toMatchObject({ code: 'SESSION_INVALID' });
  });
});
