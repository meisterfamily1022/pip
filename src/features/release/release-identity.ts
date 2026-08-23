import Constants from 'expo-constants';
import * as Application from 'expo-application';

/**
 * Which build is this, really.
 *
 * Answers the one question that stale-bundle confusion turns into a guessing
 * game: the app on this device right now — what version is it, what build
 * number, and which commit was its JavaScript bundled from.
 *
 * `version` and `commit` come from the config stamped at build time
 * (`app.config.ts`). `buildNumber` is read from the installed binary itself
 * rather than from config, because with EAS remote versioning the number is
 * assigned during the build and is not present in the committed source at all.
 * Reading the binary is also the stronger evidence: it describes the artefact
 * that is actually installed, not the one the source expected to produce.
 */
export type ReleaseIdentity = {
  version: string;
  buildNumber: string;
  commit: string;
  commitShort: string;
  branch: string;
  /** The build machine's tree had uncommitted changes; the bundle matches no commit. */
  dirty: boolean;
  builtAt: string;
  /** False in App Store builds. Gates every surface that renders this. */
  qaDiagnostics: boolean;
};

type StampedRelease = Partial<{
  commit: string;
  branch: string;
  dirty: boolean;
  builtAt: string;
  qaDiagnostics: boolean;
}>;

const UNKNOWN = 'unknown';

function stamp(): StampedRelease {
  const extra = Constants.expoConfig?.extra as { pipRelease?: StampedRelease } | undefined;
  return extra?.pipRelease ?? {};
}

export function getReleaseIdentity(): ReleaseIdentity {
  const release = stamp();
  const commit = release.commit ?? UNKNOWN;
  return {
    version: Constants.expoConfig?.version ?? UNKNOWN,
    // Null on simulators built without a number, and on web.
    buildNumber: Application.nativeBuildVersion ?? UNKNOWN,
    commit,
    commitShort: commit === UNKNOWN ? UNKNOWN : commit.slice(0, 7),
    branch: release.branch ?? UNKNOWN,
    dirty: release.dirty ?? false,
    builtAt: release.builtAt ?? UNKNOWN,
    qaDiagnostics: release.qaDiagnostics === true,
  };
}

/**
 * Whether build details may be rendered.
 *
 * Development always qualifies. Beyond that it takes an explicit build-profile
 * opt-in, so an internal QA build can show its revision while the App Store
 * build of the same source cannot.
 */
export function areQaDiagnosticsEnabled(): boolean {
  return __DEV__ || getReleaseIdentity().qaDiagnostics;
}

/** One line for a QA screenshot or a bug report. */
export function formatReleaseIdentity(identity: ReleaseIdentity): string {
  const suffix = identity.dirty ? '-dirty' : '';
  return `Pip ${identity.version} (${identity.buildNumber}) · ${identity.commitShort}${suffix} · ${identity.branch}`;
}
