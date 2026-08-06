import {
  clearSession,
  getSessionSnapshot,
  markSessionExpired,
  resetSessionStateForTests,
  restoreSession,
  setAuthenticatedSession,
  setOffline,
  subscribeSession,
  type AuthenticatedAccount,
} from "./session-state";
import {
  ACCENT_COLORS,
  AGE_RANGES,
  CHILD_AVATARS,
  CHOICE_COUNTS,
  DEFAULT_READING_SUPPORT,
  READING_SUPPORT_LABELS,
  findAccentColor,
  findChildAvatar,
  isAgeRange,
  isChoiceCount,
  isReadingSupport,
} from "@/domain/child-avatars";

const account: AuthenticatedAccount = {
  accountId: "acct_1",
  householdId: "hh_1",
  firstName: "Sam",
  email: "sam@example.com",
  emailVerified: true,
};

describe("session state", () => {
  beforeEach(() => {
    resetSessionStateForTests();
  });

  it("starts out restoring so guards do not flash a signed-out surface", () => {
    expect(getSessionSnapshot().status).toBe("restoring");
  });

  it("settles to signed out when there is no stored session", async () => {
    await restoreSession(async () => null);
    expect(getSessionSnapshot()).toEqual({ status: "signedOut", account: null, offline: false });
  });

  it("settles to signed in when a session is restored", async () => {
    await restoreSession(async () => account);
    expect(getSessionSnapshot()).toMatchObject({ status: "signedIn", account, offline: false });
  });

  it("treats a failed restore as signed out and offline, never as a crash", async () => {
    await restoreSession(async () => {
      throw new Error("network down");
    });
    expect(getSessionSnapshot()).toEqual({ status: "signedOut", account: null, offline: true });
  });

  it("restores only once per app start", async () => {
    const restorer = jest.fn(async () => account);
    await restoreSession(restorer);
    await restoreSession(restorer);
    expect(restorer).toHaveBeenCalledTimes(1);
  });

  it("notifies subscribers on change and stops after unsubscribe", async () => {
    const listener = jest.fn();
    const unsubscribe = subscribeSession(listener);
    await restoreSession(async () => null);
    expect(listener).toHaveBeenCalled();

    unsubscribe();
    const before = listener.mock.calls.length;
    setAuthenticatedSession(account);
    expect(listener.mock.calls.length).toBe(before);
  });

  it("expires a session without discarding it silently", () => {
    setAuthenticatedSession(account);
    markSessionExpired();
    expect(getSessionSnapshot()).toMatchObject({ status: "expired", account: null });
  });

  it("clears a session on sign out", () => {
    setAuthenticatedSession(account);
    clearSession();
    expect(getSessionSnapshot()).toEqual({ status: "signedOut", account: null, offline: false });
  });

  it("tracks offline independently of sign-in state", () => {
    setAuthenticatedSession(account);
    setOffline(true);
    expect(getSessionSnapshot()).toMatchObject({ status: "signedIn", offline: true });
  });
});

describe("child avatar catalog", () => {
  it("gives every avatar and colour a distinct id and a spoken label", () => {
    expect(new Set(CHILD_AVATARS.map((a) => a.id)).size).toBe(CHILD_AVATARS.length);
    expect(new Set(ACCENT_COLORS.map((c) => c.id)).size).toBe(ACCENT_COLORS.length);
    for (const avatar of CHILD_AVATARS) expect(avatar.label.length).toBeGreaterThan(0);
    for (const color of ACCENT_COLORS) expect(color.label.length).toBeGreaterThan(0);
  });

  it("distinguishes avatars by shape and motif, not colour", () => {
    const signatures = CHILD_AVATARS.map((avatar) => `${avatar.shape}/${avatar.motif}`);
    expect(new Set(signatures).size).toBe(CHILD_AVATARS.length);
  });

  it("falls back to a usable avatar and colour for unknown or missing ids", () => {
    expect(findChildAvatar(null)).toEqual(CHILD_AVATARS[0]);
    expect(findChildAvatar("not-a-real-avatar")).toEqual(CHILD_AVATARS[0]);
    expect(findAccentColor(undefined)).toEqual(ACCENT_COLORS[0]);
  });

  it("validates the coarse child preference values", () => {
    expect(AGE_RANGES.every(isAgeRange)).toBe(true);
    expect(isAgeRange("2026-01-01")).toBe(false);
    expect(CHOICE_COUNTS.every(isChoiceCount)).toBe(true);
    expect(isChoiceCount(4)).toBe(false);
    expect(isReadingSupport(DEFAULT_READING_SUPPORT)).toBe(true);
    expect(isReadingSupport("audio-only")).toBe(false);
  });

  it("labels every reading support option", () => {
    for (const key of Object.keys(READING_SUPPORT_LABELS)) {
      expect(isReadingSupport(key)).toBe(true);
    }
  });
});
