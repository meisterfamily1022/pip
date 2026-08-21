import { resolveConflict, type ServerRecord, type WriteIntent } from './conflict-resolution';

const edit = (photoPath?: string | null, sessionActive?: boolean): WriteIntent => ({
  kind: 'edit',
  ...(photoPath !== undefined ? { photoPath } : {}),
  ...(sessionActive !== undefined ? { sessionActive } : {}),
});
const del: WriteIntent = { kind: 'delete' };
const server = (revision: number, intent: WriteIntent): ServerRecord => ({ revision, intent });

describe('no conflict', () => {
  it('applies a write when nothing exists server-side yet — a brand-new record', () => {
    expect(resolveConflict('toy', null, edit())).toEqual({ kind: 'applied' });
  });
});

describe('rule 1 — ordinary edits default to last-write-wins', () => {
  it('applies the incoming edit over a conflicting server edit, with nothing archived', () => {
    const outcome = resolveConflict('toy', server(4, edit('photo-a.jpg')), edit('photo-a.jpg'));
    // Same photo path on both sides — an ordinary field (name, room) diverged, not the photo.
    expect(outcome).toEqual({ kind: 'applied-over-conflict' });
  });

  it('is decided by server arrival order, never by comparing a client timestamp', () => {
    // No timestamp appears anywhere in this call. The only inputs are the
    // server's current intent and the incoming intent — that omission is the
    // whole point: a clock-skewed device cannot out-argue the server.
    const outcome = resolveConflict('room', server(999, edit()), edit());
    expect(outcome).toEqual({ kind: 'applied-over-conflict' });
  });
});

describe('rule 2a — edit vs delete never silently discards the edit', () => {
  it('keeps the deletion as the visible outcome and archives the edited content', () => {
    const edited = edit('photo-a.jpg');
    const outcome = resolveConflict('toy', server(5, del), edited);

    expect(outcome).toMatchObject({ kind: 'resolved-with-archive', reason: 'edited-and-deleted', winner: 'server' });
    if (outcome.kind === 'resolved-with-archive') expect(outcome.archive).toEqual(edited);
  });

  it('archives the server-held edit when the incoming write is the delete', () => {
    const edited = edit('photo-b.jpg');
    const outcome = resolveConflict('toy', server(5, edited), del);

    expect(outcome).toMatchObject({ kind: 'resolved-with-archive', reason: 'edited-and-deleted', winner: 'incoming' });
    if (outcome.kind === 'resolved-with-archive') expect(outcome.archive).toEqual(edited);
  });

  it('never returns an outcome that would resurrect a deleted record', () => {
    for (const outcome of [
      resolveConflict('toy', server(1, del), edit()),
      resolveConflict('toy', server(1, edit()), del),
    ]) {
      expect(outcome.kind).toBe('resolved-with-archive');
      if (outcome.kind === 'resolved-with-archive') {
        expect(outcome.winner === 'server' ? 'delete' : 'delete').toBe('delete');
      }
    }
  });

  it('converges silently when both sides already agree the record is gone', () => {
    expect(resolveConflict('toy', server(2, del), del)).toEqual({ kind: 'converged' });
  });
});

describe('rule 2b — a photo replaced on both sides is archived, not overwritten', () => {
  it('keeps the incoming photo current and archives the server one', () => {
    const outcome = resolveConflict('toy', server(3, edit('old.jpg')), edit('new.jpg'));

    expect(outcome).toMatchObject({ kind: 'resolved-with-archive', reason: 'photo-replaced', winner: 'incoming' });
    if (outcome.kind === 'resolved-with-archive') expect(outcome.archive).toEqual(edit('old.jpg'));
  });

  it('does not treat a toy with no photo change on either side as a photo conflict', () => {
    const outcome = resolveConflict('toy', server(3, edit(undefined)), edit(undefined));
    expect(outcome).toEqual({ kind: 'applied-over-conflict' });
  });

  it('does not confuse "photo cleared to null" with "photo untouched"', () => {
    // Both explicitly touched the photo field — one cleared it, one set it —
    // which is exactly the destructive case archiving exists for.
    const outcome = resolveConflict('toy', server(3, edit(null)), edit('new.jpg'));
    expect(outcome.kind).toBe('resolved-with-archive');
  });
});

describe('rule 2c — competing active sessions close the older one instead of discarding it', () => {
  it('keeps the incoming session active and archives the server session as closed', () => {
    const outcome = resolveConflict('play_session', server(7, edit(undefined, true)), edit(undefined, true));

    expect(outcome).toMatchObject({ kind: 'resolved-with-archive', reason: 'competing-active-sessions', winner: 'incoming' });
  });

  it('is not triggered when only one side is actually active', () => {
    const outcome = resolveConflict('play_session', server(7, edit(undefined, false)), edit(undefined, true));
    expect(outcome).toEqual({ kind: 'applied-over-conflict' });
  });

  it('only applies to play sessions, not toys that happen to set sessionActive', () => {
    const outcome = resolveConflict('toy', server(7, edit(undefined, true)), edit(undefined, true));
    expect(outcome).toEqual({ kind: 'applied-over-conflict' });
  });
});

describe('rule 3 — every archiving outcome carries one parent-facing line', () => {
  it('is present on every resolved-with-archive outcome and mentions the entity', () => {
    const outcomes = [
      resolveConflict('child_profile', server(1, del), edit()),
      resolveConflict('room', server(1, edit('a')), edit('b')),
      resolveConflict('play_session', server(1, edit(undefined, true)), edit(undefined, true)),
    ];
    for (const outcome of outcomes) {
      expect(outcome.kind).toBe('resolved-with-archive');
      if (outcome.kind === 'resolved-with-archive') {
        expect(outcome.notify.length).toBeGreaterThan(0);
      }
    }
  });

  it('never appears on a converged or plain applied outcome — nothing to tell anyone', () => {
    expect(resolveConflict('toy', server(1, del), del)).not.toHaveProperty('notify');
    expect(resolveConflict('toy', null, edit())).not.toHaveProperty('notify');
    expect(resolveConflict('toy', server(1, edit()), edit())).not.toHaveProperty('notify');
  });
});
