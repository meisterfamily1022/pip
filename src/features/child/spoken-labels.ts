import * as Speech from 'expo-speech';

import { isReadingSupport, type ReadingSupport } from '@/domain/child-avatars';

/**
 * Spoken toy names, for children who do not read yet.
 *
 * Speech is always something the child asks for by pressing a button — Pip
 * never speaks on its own, never on arrival at a screen, and never twice over
 * itself. That keeps it usable in a room with other people in it, and keeps it
 * from competing with VoiceOver for anyone who already has that on.
 */
export function readingSupportOf(value: string | null | undefined): ReadingSupport {
  return value && isReadingSupport(value) ? value : 'pictures-words';
}

export function showsToyNames(support: ReadingSupport): boolean {
  return support !== 'pictures';
}

export function offersSpokenLabels(support: ReadingSupport): boolean {
  return support === 'pictures-words-audio';
}

/** Speaks a toy name, cutting off anything already being said. */
export function speakToyName(name: string): void {
  try {
    Speech.stop();
    Speech.speak(name, { rate: 0.92 });
  } catch {
    // A device with no speech engine is not a reason to break the screen; the
    // photo and the name are still there.
  }
}
