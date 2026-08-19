import {
  groupForHref,
  isPublicGroup,
  resolveRouteGuard,
  type GuardInput,
  type RouteGroup,
  type SessionStatus,
} from "./route-guards";

const ready: Omit<GuardInput, "group"> = {
  isPublic: false,
  initialized: true,
  initializationError: null,
  onboardingComplete: true,
  childModeLocked: false,
  sessionStatus: "signedIn",
  pendingVerificationStatus: "none",
};

const GROUPS: RouteGroup[] = ["(public)", "(auth)", "(onboarding)", "(parent)", "(child)", undefined];
const SESSIONS: SessionStatus[] = ["restoring", "signedOut", "signedIn", "expired"];

describe("public routes", () => {
  it("renders before local startup finishes", () => {
    expect(resolveRouteGuard({ ...ready, group: "(public)", isPublic: true, initialized: false })).toEqual({ kind: "render" });
  });

  it("renders even when local startup failed", () => {
    const decision = resolveRouteGuard({
      ...ready,
      group: "(public)",
      isPublic: true,
      initialized: true,
      initializationError: "Database is unavailable.",
    });
    expect(decision).toEqual({ kind: "render" });
  });

  it("is never redirected away from, in any state", () => {
    for (const sessionStatus of SESSIONS) {
      for (const onboardingComplete of [true, false]) {
        for (const childModeLocked of [true, false]) {
          const decision = resolveRouteGuard({
            group: "(public)",
            isPublic: true,
            initialized: false,
            initializationError: "boom",
            onboardingComplete,
            childModeLocked,
            sessionStatus,
            pendingVerificationStatus: "none",
          });
          expect(decision.kind).toBe("render");
        }
      }
    }
  });

  it("identifies the public group", () => {
    expect(isPublicGroup("(public)")).toBe(true);
    expect(isPublicGroup("(parent)")).toBe(false);
  });
});

describe("startup gating", () => {
  it("shows the launch state until local startup finishes", () => {
    expect(resolveRouteGuard({ ...ready, group: "(parent)", initialized: false })).toEqual({ kind: "launching" });
  });

  it("surfaces a startup failure instead of a blank screen", () => {
    expect(
      resolveRouteGuard({ ...ready, group: "(parent)", initializationError: "Database is unavailable." }),
    ).toEqual({ kind: "error", message: "Database is unavailable." });
  });

  it("waits for pending-verification restoration before choosing a native root", () => {
    expect(resolveRouteGuard({ ...ready, group: undefined, pendingVerificationStatus: "restoring" })).toEqual({ kind: "launching" });
  });

  it("opens completed local-only setup without requiring an account", () => {
    expect(resolveRouteGuard({ ...ready, group: undefined, sessionStatus: "signedOut" })).toEqual({ kind: "redirect", href: "/parent/home" });
    expect(resolveRouteGuard({ ...ready, group: "(auth)", sessionStatus: "signedOut" })).toEqual({ kind: "render" });
  });

  it("resumes a pending email only at verification", () => {
    expect(resolveRouteGuard({ ...ready, group: undefined, sessionStatus: "signedOut", pendingVerificationStatus: "pending" })).toEqual({
      kind: "redirect",
      href: "/verify-email",
    });
    expect(resolveRouteGuard({ ...ready, group: "(auth)", sessionStatus: "signedOut", pendingVerificationStatus: "pending" })).toEqual({ kind: "render" });
  });

  it("sends a restored session to exactly one valid app destination", () => {
    expect(resolveRouteGuard({ ...ready, group: undefined })).toEqual({ kind: "redirect", href: "/parent/home" });
    expect(resolveRouteGuard({ ...ready, group: undefined, childModeLocked: true })).toEqual({ kind: "redirect", href: "/child/home" });
    expect(resolveRouteGuard({ ...ready, group: undefined, onboardingComplete: false })).toEqual({ kind: "redirect", href: "/onboarding" });
  });
});

describe("onboarding gating", () => {
  it("sends product surfaces to onboarding until setup is complete", () => {
    for (const group of ["(parent)", "(child)"] as const) {
      expect(resolveRouteGuard({ ...ready, group, onboardingComplete: false })).toEqual({
        kind: "redirect",
        href: "/onboarding",
      });
    }
  });

  it("keeps auth reachable before setup, so a returning parent can sign in", () => {
    expect(resolveRouteGuard({ ...ready, group: "(auth)", onboardingComplete: false, sessionStatus: "signedOut" })).toEqual({ kind: "render" });
  });

  it("takes a newly verified parent directly from auth to onboarding", () => {
    expect(resolveRouteGuard({ ...ready, group: "(auth)", onboardingComplete: false })).toEqual({
      kind: "redirect",
      href: "/onboarding",
    });
  });

  it("sends a completed parent out of onboarding", () => {
    expect(resolveRouteGuard({ ...ready, group: "(onboarding)" })).toEqual({ kind: "redirect", href: "/parent/home" });
  });

  it("preserves the explicit first-toy handoff when setup just completed", () => {
    expect(resolveRouteGuard({ ...ready, group: "(onboarding)", postOnboardingDestination: "/parent/first-toy" })).toEqual({
      kind: "redirect",
      href: "/parent/first-toy",
    });
  });

  it("returns a locked child to Child Mode rather than Parent Home", () => {
    expect(resolveRouteGuard({ ...ready, group: "(onboarding)", childModeLocked: true })).toEqual({
      kind: "redirect",
      href: "/child/home",
    });
  });
});

describe("child mode lock", () => {
  it("routes Parent Mode through the PIN return screen while locked", () => {
    expect(resolveRouteGuard({ ...ready, group: "(parent)", childModeLocked: true })).toEqual({
      kind: "redirect",
      href: "/child/parent-return",
    });
  });

  it("puts the account surface behind the PIN, like the rest of Parent Mode", () => {
    // Account & data lives in the (parent) group precisely so it inherits this.
    // A child must never reach sign-out, account switching or the adult's email.
    expect(groupForHref("/parent/account")).toBe("(parent)");
    expect(resolveRouteGuard({ ...ready, group: groupForHref("/parent/account"), childModeLocked: true })).toEqual({
      kind: "redirect",
      href: "/child/parent-return",
    });
  });

  it("leaves the child group reachable while locked", () => {
    expect(resolveRouteGuard({ ...ready, group: "(child)", childModeLocked: true })).toEqual({ kind: "render" });
  });
});

describe("session status", () => {
  it("holds the auth group while a session is restoring, to avoid a signed-out flash", () => {
    expect(resolveRouteGuard({ ...ready, group: "(auth)", sessionStatus: "restoring" })).toEqual({ kind: "launching" });
  });

  it("holds household surfaces while a session is restoring", () => {
    expect(resolveRouteGuard({ ...ready, group: "(parent)", sessionStatus: "restoring" })).toEqual({ kind: "launching" });
  });

  it("sends a signed-in parent away from sign-in", () => {
    expect(resolveRouteGuard({ ...ready, group: "(auth)", sessionStatus: "signedIn" })).toEqual({
      kind: "redirect",
      href: "/parent/home",
    });
  });

  it("lets an expired session reach sign-in to recover", () => {
    expect(resolveRouteGuard({ ...ready, group: "(auth)", sessionStatus: "expired" })).toEqual({ kind: "render" });
  });

  it("keeps completed local-only household data reachable while signed out", () => {
    expect(resolveRouteGuard({ ...ready, group: "(parent)", sessionStatus: "signedOut" })).toEqual({ kind: "render" });
  });
});

describe("redirect loops", () => {
  /**
   * Follows the guard from every reachable state until it stops redirecting.
   * A cycle, or a chain that will not settle, fails here rather than hanging a
   * device in a redirect storm.
   */
  it("terminates from every combination of state and group", () => {
    for (const group of GROUPS) {
      for (const sessionStatus of SESSIONS) {
        for (const onboardingComplete of [true, false]) {
          for (const childModeLocked of [true, false]) {
            const seen: string[] = [];
            let current = group;

            for (let hop = 0; hop <= GROUPS.length + 1; hop += 1) {
              const decision = resolveRouteGuard({
                group: current,
                isPublic: isPublicGroup(current),
                initialized: true,
                initializationError: null,
                onboardingComplete,
                childModeLocked,
                sessionStatus,
                pendingVerificationStatus: "none",
              });
              if (decision.kind !== "redirect") break;

              const state = `${String(current)}->${decision.href}`;
              expect(seen).not.toContain(state);
              seen.push(state);
              current = groupForHref(decision.href);

              expect(hop).toBeLessThan(GROUPS.length);
            }
          }
        }
      }
    }
  });

  it("maps redirect targets back to their group", () => {
    expect(groupForHref("/parent/home")).toBe("(parent)");
    expect(groupForHref("/child/parent-return")).toBe("(child)");
    expect(groupForHref("/onboarding")).toBe("(onboarding)");
    expect(groupForHref("/sign-in")).toBe("(auth)");
    expect(groupForHref("/verify-email")).toBe("(auth)");
    expect(groupForHref("/")).toBe("(public)");
  });
});
