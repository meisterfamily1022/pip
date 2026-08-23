import { execSync } from 'node:child_process';

import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Stamps the source revision this bundle was built from into the app.
 *
 * Pip ships its JavaScript inside the binary and has no OTA update channel, so
 * an installed build is frozen at whatever was bundled the moment it was made.
 * That is exactly the condition under which "I changed the UI but the app looks
 * the same" is impossible to diagnose from the outside: the source, the commit
 * and the running app can all disagree and nothing on screen says so.
 *
 * The stamp is read at config-evaluation time — once, on the build machine —
 * and travels in `extra`, where `expo-constants` can read it back at runtime.
 * It is only ever *shown* behind the QA flag below.
 */

/** EAS exposes the checked-out commit; locally we ask git. Never fail a build over it. */
function readGit(command: string, fallback: string): string {
  try {
    return execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || fallback;
  } catch {
    return fallback;
  }
}

function sourceRevision(): { commit: string; branch: string; dirty: boolean } {
  const easCommit = process.env.EAS_BUILD_GIT_COMMIT_HASH;
  return {
    commit: easCommit || readGit('git rev-parse HEAD', 'unknown'),
    branch: process.env.EAS_BUILD_GIT_BRANCH || readGit('git rev-parse --abbrev-ref HEAD', 'unknown'),
    // A dirty build is the single most common cause of a bundle that matches no
    // commit at all, so it is worth surfacing rather than rounding off.
    dirty: !easCommit && readGit('git status --porcelain', '') !== '',
  };
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const revision = sourceRevision();
  return {
    ...(config as ExpoConfig),
    extra: {
      ...config.extra,
      pipRelease: {
        ...revision,
        builtAt: new Date().toISOString(),
        // Set per EAS profile. Absent in production, so App Store builds carry
        // the stamp but never render it.
        qaDiagnostics: process.env.EXPO_PUBLIC_PIP_QA_DIAGNOSTICS === '1',
      },
    },
  };
};
