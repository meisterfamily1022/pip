const collapseWhitespace = (value: string | null | undefined): string => value?.trim().replace(/\s+/g, ' ') ?? '';

/**
 * Repairs the common accidental all-lowercase entry without rewriting a
 * deliberately mixed-case name such as "McKay" or "iZzy".
 */
export function displayChildName(value: string | null | undefined, fallback = 'Your child'): string {
  const name = collapseWhitespace(value);
  if (!name) return fallback;
  const letters = name.match(/\p{L}/gu) ?? [];
  const hasLetter = letters.length > 0;
  const hasUppercase = letters.some((letter) => letter !== letter.toLocaleLowerCase());
  if (!hasLetter || hasUppercase) return name;
  return name.replace(/(^|[\s'-])(\p{L})/gu, (_, boundary: string, letter: string) => `${boundary}${letter.toLocaleUpperCase()}`);
}

/** Names remain canonical; presentation only removes accidental whitespace. */
export function displayToyName(value: string | null | undefined, fallback = 'This toy'): string {
  return collapseWhitespace(value) || fallback;
}

export type LocationPresentation = {
  room: string | null;
  spot: string | null;
  compact: string | null;
  instruction: string;
  accessibilityLabel: string;
};

/**
 * One safe formatter for every room/spot combination. It never invents a
 * location, emits empty separators, or assumes whether a spot is "on" or "in".
 */
export function presentLocation(roomValue: string | null | undefined, spotValue: string | null | undefined): LocationPresentation {
  const room = collapseWhitespace(roomValue) || null;
  const spot = collapseWhitespace(spotValue) || null;
  if (room && spot) {
    return {
      room,
      spot,
      compact: `${room} · ${spot}`,
      instruction: `${spot}, in ${room}`,
      accessibilityLabel: `Storage spot ${spot}, in ${room}`,
    };
  }
  if (room) return { room, spot: null, compact: room, instruction: `In ${room}`, accessibilityLabel: `Room ${room}` };
  if (spot) return { room: null, spot, compact: spot, instruction: spot, accessibilityLabel: `Storage spot ${spot}` };
  return {
    room: null,
    spot: null,
    compact: null,
    instruction: 'Ask a grown-up where it lives.',
    accessibilityLabel: 'Location not added',
  };
}

export function countLabel(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
