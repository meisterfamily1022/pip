import Constants from 'expo-constants';
import * as Application from 'expo-application';

import { areQaDiagnosticsEnabled, formatReleaseIdentity, getReleaseIdentity } from './release-identity';

jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: null } }));
jest.mock('expo-application', () => ({ __esModule: true, nativeBuildVersion: null }));

const mockedConstants = Constants as unknown as { expoConfig: unknown };
const mockedApplication = Application as unknown as { nativeBuildVersion: string | null };

function stampConfig(pipRelease: unknown, version = '1.0.0'): void {
  mockedConstants.expoConfig = { version, extra: { pipRelease } };
}

describe('release identity', () => {
  beforeEach(() => {
    mockedConstants.expoConfig = null;
    mockedApplication.nativeBuildVersion = null;
  });

  it('reports the stamped commit and the installed binary build number', () => {
    stampConfig({ commit: 'ffef2eaa0dbd47a8b0e4d2c5a1b3f6d9e8c7b6a5', branch: 'main', dirty: false, builtAt: '2026-08-18T00:00:00.000Z' });
    mockedApplication.nativeBuildVersion = '13';

    const identity = getReleaseIdentity();

    expect(identity.buildNumber).toBe('13');
    expect(identity.commitShort).toBe('ffef2ea');
    expect(identity.branch).toBe('main');
    expect(identity.version).toBe('1.0.0');
  });

  it('does not pretend to know a revision that was never stamped', () => {
    stampConfig(undefined);

    const identity = getReleaseIdentity();

    expect(identity.commit).toBe('unknown');
    expect(identity.commitShort).toBe('unknown');
    expect(identity.buildNumber).toBe('unknown');
  });

  it('marks a bundle built from a dirty tree, which matches no commit', () => {
    stampConfig({ commit: 'abc1234def', branch: 'main', dirty: true });
    mockedApplication.nativeBuildVersion = '14';

    expect(formatReleaseIdentity(getReleaseIdentity())).toBe('Pip 1.0.0 (14) · abc1234-dirty · main');
  });

  it('keeps diagnostics off unless the build profile opted in', () => {
    stampConfig({ commit: 'abc1234', qaDiagnostics: false });

    expect(getReleaseIdentity().qaDiagnostics).toBe(false);
  });

  it('renders diagnostics for an internal QA build that opted in', () => {
    stampConfig({ commit: 'abc1234', qaDiagnostics: true });

    expect(getReleaseIdentity().qaDiagnostics).toBe(true);
    expect(areQaDiagnosticsEnabled()).toBe(true);
  });
});
