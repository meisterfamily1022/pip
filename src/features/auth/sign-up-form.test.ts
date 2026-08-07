import { pipBrand } from '@/brand/pip-brand';
import { AuthService } from '@/server/auth/auth-service';
import { loadAuthConfig } from '@/server/auth/config';
import { RecordingMailSender } from '@/server/auth/mail';
import { LocalDevelopmentAuthStorage, resetAuthStorageForTests } from '@/server/auth/storage';
import {
  errorSummary,
  hasErrors,
  householdNameSuggestions,
  validateHouseholdName,
  validateSignUp,
  type SignUpFields,
} from './sign-up-form';

const valid: SignUpFields = {
  firstName: 'Sam',
  email: 'parent@example.com',
  password: 'correct-horse-battery',
  acceptedTerms: true,
};

describe('sign-up validation', () => {
  it('accepts a complete form', () => {
    expect(hasErrors(validateSignUp(valid))).toBe(false);
  });

  it('requires a first name', () => {
    expect(validateSignUp({ ...valid, firstName: '   ' }).firstName).toBeTruthy();
  });

  it('rejects an unusable email address', () => {
    for (const email of ['', 'nope', 'a@b', 'spaces in@example.com']) {
      expect(validateSignUp({ ...valid, email }).email).toBeTruthy();
    }
  });

  it('states the password rule rather than failing silently', () => {
    const errors = validateSignUp({ ...valid, password: 'short' });
    expect(errors.password).toMatch(/at least 8 characters/i);
  });

  it('treats unchecked consent as a validation failure, never a default', () => {
    expect(validateSignUp({ ...valid, acceptedTerms: false }).acceptedTerms).toBeTruthy();
  });

  it('summarises errors in the order the fields appear', () => {
    const errors = validateSignUp({ firstName: '', email: 'nope', password: 'x', acceptedTerms: false });
    expect(errorSummary(errors)).toHaveLength(4);
    expect(errorSummary(errors)[0]).toMatch(/first name/i);
    expect(errorSummary(errors)[3]).toMatch(/terms/i);
  });

  it('never asks for anything about a child', () => {
    const fields = Object.keys(valid);
    expect(fields).toEqual(['firstName', 'email', 'password', 'acceptedTerms']);
    for (const field of fields) {
      expect(field).not.toMatch(/child|birth|age|school|diagnos/i);
    }
  });
});

describe('household naming', () => {
  it('offers a personal suggestion first, then neutral ones', () => {
    const suggestions = householdNameSuggestions('Sam');
    expect(suggestions[0]).toBe(`Sam's ${pipBrand.name}`);
    expect(suggestions).toContain('The Playroom');
    expect(suggestions).toContain('Home');
  });

  it('falls back to a neutral suggestion when no name is known', () => {
    expect(householdNameSuggestions('  ')[0]).toBe(`Our ${pipBrand.name}`);
  });

  it('requires a name and rejects an overlong one', () => {
    expect(validateHouseholdName('')).toBeTruthy();
    expect(validateHouseholdName('   ')).toBeTruthy();
    expect(validateHouseholdName('x'.repeat(61))).toBeTruthy();
    expect(validateHouseholdName('The Playroom')).toBeNull();
  });
});

describe('account creation end to end', () => {
  beforeEach(() => {
    resetAuthStorageForTests();
  });

  const build = () => {
    const mail = new RecordingMailSender();
    const storage = new LocalDevelopmentAuthStorage();
    const config = loadAuthConfig({ PIP_SESSION_SECRET: 's', PIP_ONE_TIME_SECRET: 'o' });
    return { service: new AuthService({ mail, storage, config }), mail, storage };
  };

  const codeFrom = (mail: RecordingMailSender): string => {
    const latest = [...mail.sent].reverse().find((email) => email.kind === 'verification');
    if (!latest || latest.kind !== 'verification') throw new Error('no verification email');
    return latest.code;
  };

  it('creates the account, confirms it, and names the household', async () => {
    const { service, mail } = build();

    await service.signUp({ ...valid, email: 'parent@example.com' });
    const session = await service.verifyEmail('parent@example.com', codeFrom(mail));
    expect(session.context.emailVerified).toBe(true);

    const renamed = await service.renameHousehold(session.token, session.context.householdId, 'The Playroom');
    expect(renamed.name).toBe('The Playroom');
  });

  it('gives the household a sensible default before it is named', async () => {
    const { service, mail, storage } = build();
    await service.signUp({ ...valid, email: 'parent@example.com' });
    const session = await service.verifyEmail('parent@example.com', codeFrom(mail));

    const household = await storage.households.get(session.context.householdId);
    expect(household?.name).toBe(`Sam's ${pipBrand.name}`);
  });

  it('creates exactly one household even when sign-up is retried', async () => {
    const { service, mail, storage } = build();

    await service.signUp({ ...valid, email: 'parent@example.com' });
    // A parent who taps twice, or retries after a dropped response.
    await service.signUp({ ...valid, email: 'parent@example.com' });

    const session = await service.verifyEmail('parent@example.com', codeFrom(mail));
    expect(await storage.households.listForAccount(session.context.accountId)).toHaveLength(1);
  });

  it('settles on the same name when naming is retried', async () => {
    const { service, mail } = build();
    await service.signUp({ ...valid, email: 'parent@example.com' });
    const session = await service.verifyEmail('parent@example.com', codeFrom(mail));

    await service.renameHousehold(session.token, session.context.householdId, 'Home');
    const second = await service.renameHousehold(session.token, session.context.householdId, 'Home');
    expect(second.name).toBe('Home');
  });

  it('refuses to name a household the session does not belong to', async () => {
    const { service, mail } = build();
    await service.signUp({ ...valid, email: 'owner@example.com' });
    const owner = await service.verifyEmail('owner@example.com', codeFrom(mail));

    await service.signUp({ ...valid, email: 'intruder@example.com' });
    const intruder = await service.verifyEmail('intruder@example.com', codeFrom(mail));

    await expect(
      service.renameHousehold(intruder.token, owner.context.householdId, 'Taken Over'),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('rejects an empty or overlong household name at the service boundary', async () => {
    const { service, mail } = build();
    await service.signUp({ ...valid, email: 'parent@example.com' });
    const session = await service.verifyEmail('parent@example.com', codeFrom(mail));

    for (const name of ['', '   ', 'x'.repeat(61)]) {
      await expect(service.renameHousehold(session.token, session.context.householdId, name)).rejects.toMatchObject({
        code: 'INVALID_REQUEST',
      });
    }
  });
});
