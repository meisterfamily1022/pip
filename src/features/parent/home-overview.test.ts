import type { ChildProfile } from '@/domain/models';
import type { ActivePlaySession } from '@/repositories/play-sessions-repository';

import {
  buildHomeOverview,
  describeRemainingSetup,
  formatElapsed,
  greetingForHour,
  STARTER_TOY_TARGET,
} from './home-overview';

function child(id: number, name: string): ChildProfile {
  return {
    id,
    householdId: 'household-1',
    name,
    avatarId: 'circle-dot',
    accentColorId: 'mint',
    ageRange: null,
    choiceLimit: 3,
    readingSupport: 'pictures-words',
    displayOrder: id,
    hiddenAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function session(id: number, childId: number, childName: string): ActivePlaySession {
  return {
    id,
    childId,
    childName,
    toyId: id * 10,
    toy: null,
    status: 'active',
    startedAt: '2026-01-01T09:00:00.000Z',
    completedAt: null,
    cleanupStartedAt: null,
    helpRequested: false,
    parentOverrideUsed: false,
    createdAt: '2026-01-01T09:00:00.000Z',
    updatedAt: '2026-01-01T09:00:00.000Z',
  };
}

const complete = {
  children: [child(1, 'Ada')],
  sessions: [],
  toyCount: STARTER_TOY_TARGET,
  roomCount: 1,
  spotCount: 1,
  childModeUsed: true,
};

describe('Parent Home overview', () => {
  it('hides the setup card once nothing is left to do', () => {
    expect(buildHomeOverview(complete).setup).toBeNull();
  });

  it('lists only the steps a new household still owes, and where each one leads', () => {
    const overview = buildHomeOverview({
      children: [child(1, 'Ada')],
      sessions: [],
      toyCount: 0,
      roomCount: 1,
      spotCount: 2,
      childModeUsed: false,
    });
    expect(overview.setup?.remaining).toBe(2);
    const outstanding = overview.setup?.steps.filter((step) => !step.done) ?? [];
    expect(outstanding.map((step) => step.id)).toEqual(['toys', 'child-mode']);
    expect(outstanding.map((step) => step.href)).toEqual(['/parent/first-toy', '/parent/select-child']);
  });

  it('names the first child in the Child Mode step so the invitation is concrete', () => {
    const overview = buildHomeOverview({ ...complete, childModeUsed: false });
    expect(overview.setup?.steps.find((step) => step.id === 'child-mode')?.label).toBe('Try Child Mode with Ada');
  });

  it('still offers the Child Mode step before any child exists', () => {
    const overview = buildHomeOverview({ ...complete, children: [], childModeUsed: false });
    expect(overview.setup?.steps.find((step) => step.id === 'child-mode')?.label).toBe('Try Child Mode');
  });

  it('counts photographing toys as done only at the starter target', () => {
    const short = buildHomeOverview({ ...complete, childModeUsed: false, toyCount: STARTER_TOY_TARGET - 1 });
    expect(short.setup?.steps.find((step) => step.id === 'toys')?.done).toBe(false);
    const met = buildHomeOverview({ ...complete, childModeUsed: false, toyCount: STARTER_TOY_TARGET });
    expect(met.setup?.steps.find((step) => step.id === 'toys')?.done).toBe(true);
  });

  it('marks a child as playing only while they hold an active checkout', () => {
    const overview = buildHomeOverview({
      ...complete,
      children: [child(1, 'Ada'), child(2, 'Bo'), child(3, 'Wren')],
      sessions: [session(1, 1, 'Ada'), session(2, 2, 'Bo')],
    });
    expect(overview.handoff.map((entry) => [entry.child.name, entry.playing])).toEqual([
      ['Ada', true], ['Bo', true], ['Wren', false],
    ]);
  });

  it('carries every active checkout through, including one whose toy record is missing', () => {
    const overview = buildHomeOverview({ ...complete, sessions: [session(9, 1, 'Ada')] });
    expect(overview.checkouts).toHaveLength(1);
    expect(overview.checkouts[0].toy).toBeNull();
  });
});

describe('elapsed play time', () => {
  const start = '2026-01-01T09:00:00.000Z';
  const at = (minutes: number) => Date.parse(start) + (minutes * 60_000);

  it.each([
    [0, 'Just now'],
    [0.5, 'Just now'],
    [1, '1 min'],
    [40, '40 min'],
    [59, '59 min'],
    [60, '1 hr'],
    [125, '2 hr'],
    [60 * 24, '1 day'],
    [60 * 50, '2 days'],
  ])('says %p minutes as %p', (minutes, expected) => {
    expect(formatElapsed(start, at(minutes))).toBe(expected);
  });

  it('never reports negative time when a clock moves backwards', () => {
    expect(formatElapsed(start, at(-90))).toBe('Just now');
  });

  it('degrades to a safe phrase rather than NaN on an unparseable timestamp', () => {
    expect(formatElapsed('not-a-date', Date.parse(start))).toBe('Just now');
  });
});

describe('supporting copy', () => {
  it.each([
    [1, 'Ada', 'One thing left before Ada can choose a toy.'],
    [2, 'Ada', 'Two things left before Ada can choose a toy.'],
    [3, undefined, '3 things left before your child can choose a toy.'],
  ])('describes %p remaining steps', (remaining, name, expected) => {
    expect(describeRemainingSetup(remaining, name)).toBe(expected);
  });

  it.each([[0, 'Good morning'], [11, 'Good morning'], [12, 'Good afternoon'], [17, 'Good afternoon'], [18, 'Good evening'], [23, 'Good evening']])(
    'greets hour %p with %p',
    (hour, expected) => {
      expect(greetingForHour(hour)).toBe(expected);
    },
  );
});
