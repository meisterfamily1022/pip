/**
 * Route guard decisions for every surface in the app.
 *
 * The rules live here as one pure function so they can be unit tested and so a
 * new surface cannot quietly acquire different behaviour. `RootLayout` renders
 * whatever this returns.
 *
 * Two failure modes this is written to avoid:
 *
 * - **Redirect loops.** A guard must never send a group to a destination that
 *   the same guard would bounce again. `assertNoRedirectLoop` in the tests
 *   walks every state to prove it terminates.
 * - **Blank public pages.** The marketing surface must render before the local
 *   database has opened, otherwise a visitor (or a crawler) waits on SQLite
 *   that they never needed.
 */

/** Expo Router group segment, i.e. `segments[0]`. */
export type RouteGroup = '(public)' | '(auth)' | '(onboarding)' | '(parent)' | '(child)' | undefined;

/** Where the parent account session stands. Local-only use reports `signedOut`. */
export type SessionStatus = 'restoring' | 'signedOut' | 'signedIn' | 'expired';

export type GuardInput = {
  group: RouteGroup;
  /**
   * Whether this route is a public marketing surface.
   *
   * Passed in rather than derived from `group` alone because the web root `/`
   * is the landing page while the native root is app startup. The caller knows
   * the platform; this module stays pure.
   */
  isPublic: boolean;
  /** Local startup (database, settings, PIN) has finished. */
  initialized: boolean;
  initializationError: string | null;
  onboardingComplete: boolean;
  childModeLocked: boolean;
  sessionStatus: SessionStatus;
};

/**
 * Every destination a guard may send someone to. Kept as a literal union so it
 * satisfies Expo Router's typed routes and so a typo cannot become a dead link.
 */
export type GuardRedirect = '/sign-in' | '/onboarding' | '/parent/home' | '/child/home' | '/child/parent-return';

export type GuardDecision =
  | { kind: 'render' }
  | { kind: 'launching' }
  | { kind: 'error'; message: string }
  | { kind: 'redirect'; href: GuardRedirect };

/**
 * Public routes are the landing page and legal pages. They never depend on
 * local state, so they render immediately and are never redirected away from.
 */
export function isPublicGroup(group: RouteGroup): boolean {
  return group === '(public)';
}

export function resolveRouteGuard(input: GuardInput): GuardDecision {
  // Public pages short-circuit everything: no startup wait, no guard, no
  // redirect. A visitor who has never opened the app still gets the page.
  if (input.isPublic) return { kind: 'render' };

  if (!input.initialized) return { kind: 'launching' };
  if (input.initializationError) return { kind: 'error', message: input.initializationError };

  // Never render household data until the encrypted session has been restored.
  if (input.sessionStatus === 'restoring') return { kind: 'launching' };

  // Signing in is meaningless when a session already exists.
  if (input.sessionStatus === 'signedIn' && input.group === '(auth)') {
    return { kind: 'redirect', href: input.childModeLocked ? '/child/home' : '/parent/home' };
  }

  if (input.sessionStatus !== 'signedIn' && (input.group === '(onboarding)' || input.group === '(parent)' || input.group === '(child)')) {
    return { kind: 'redirect', href: '/sign-in' };
  }

  // Local setup gates the product surfaces. Auth routes stay reachable so a
  // returning parent can sign in before completing setup on a new device.
  if (!input.onboardingComplete && (input.group === '(parent)' || input.group === '(child)')) {
    return { kind: 'redirect', href: '/onboarding' };
  }

  if (input.onboardingComplete && input.group === '(onboarding)') {
    return { kind: 'redirect', href: input.childModeLocked ? '/child/home' : '/parent/home' };
  }

  // Child Mode is a soft lock: Parent Mode is reachable only back through the
  // PIN return screen, which lives in the child group and so is not re-guarded.
  if (input.childModeLocked && input.group === '(parent)') {
    return { kind: 'redirect', href: '/child/parent-return' };
  }

  return { kind: 'render' };
}

/** The group a redirect target belongs to, used to prove guards terminate. */
export function groupForHref(href: string): RouteGroup {
  if (href.startsWith('/parent')) return '(parent)';
  if (href.startsWith('/child')) return '(child)';
  if (href.startsWith('/onboarding')) return '(onboarding)';
  if (href.startsWith('/sign-in') || href.startsWith('/sign-up')) return '(auth)';
  return '(public)';
}
