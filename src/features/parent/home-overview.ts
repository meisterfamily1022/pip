import type { ChildProfile } from '@/domain/models';
import type { ActivePlaySession } from '@/repositories/play-sessions-repository';

/**
 * What Parent Home shows, worked out away from the screen so the rules can be
 * tested: which setup steps remain, how long each toy has been out, and which
 * children are free to be handed the phone.
 */

export type SetupStep = {
  id: 'child' | 'room';
  label: string;
  done: boolean;
  /** Where tapping the step leads, when there is something left to do. */
  href?: string;
  actionLabel?: string;
};

export type HomeOverview = {
  /** Present only while setup is genuinely unfinished. */
  setup: { remaining: number; steps: SetupStep[] } | null;
  libraryMilestone: { count: number; target: number; childModeUsed: boolean } | null;
  checkouts: ActivePlaySession[];
  handoff: { child: ChildProfile; playing: boolean }[];
  toyCount: number;
  roomCount: number;
  spotCount: number;
};

/** How many toys Pip suggests photographing before Child Mode feels worthwhile. */
export const STARTER_TOY_TARGET = 5;

/**
 * Elapsed time, rounded the way a parent would say it out loud. Under an hour
 * it counts minutes; past that, whole hours. Nothing counts down, and nothing
 * turns red — this is information, not a deadline.
 */
export function formatElapsed(startedAt: string, now: number): string {
  const started = Date.parse(startedAt);
  if (Number.isNaN(started)) return 'Just now';
  const minutes = Math.floor(Math.max(0, now - started) / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}

export function buildHomeOverview(input: {
  children: readonly ChildProfile[];
  sessions: readonly ActivePlaySession[];
  toyCount: number;
  roomCount: number;
  spotCount: number;
  /** True once a child has actually been handed the phone at least once. */
  childModeUsed: boolean;
}): HomeOverview {
  const { children, sessions, toyCount, roomCount, spotCount, childModeUsed } = input;
  const steps: SetupStep[] = [
    { id: 'child', label: 'Add a child', done: children.length > 0, href: '/parent/children', actionLabel: 'Add' },
    { id: 'room', label: 'Add a room', done: roomCount > 0, href: '/parent/locations', actionLabel: 'Add' },
  ];

  const remaining = steps.filter((step) => !step.done).length;

  const playingChildIds = new Set(sessions.map((session) => session.childId));

  return {
    // Once everything is done the card disappears rather than sitting there
    // fully ticked, which would be one more thing to read past every morning.
    setup: remaining === 0 ? null : { remaining, steps },
    libraryMilestone: toyCount >= STARTER_TOY_TARGET ? null : { count: toyCount, target: STARTER_TOY_TARGET, childModeUsed },
    checkouts: [...sessions],
    handoff: children.map((child) => ({ child, playing: playingChildIds.has(child.id) })),
    toyCount,
    roomCount,
    spotCount,
  };
}

/** Setup is useful housekeeping, not a false gate on choosing a toy. */
export function describeRemainingSetup(remaining: number, childName?: string): string {
  const count = remaining === 1 ? 'One thing' : remaining === 2 ? 'Two things' : `${remaining} things`;
  const who = childName ? `for ${childName}` : 'for your family';
  return `${count} left to set up ${who}.`;
}

/** "Good morning" / "Good afternoon" / "Good evening", from the local hour. */
export function greetingForHour(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}
