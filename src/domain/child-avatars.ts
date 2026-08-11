import type { PipIconName } from "@/components/pip-icon";
import { pipAvatarPalette } from "@/theme/playmap-theme";

/**
 * The safe built-in avatar set for child profiles.
 *
 * Each avatar is a drawn character with a spoken name — "Teddy bear", "Fish" —
 * so a profile is never identified by colour alone. Nothing is uploaded or
 * photographed: no image of a child is ever stored.
 *
 * The `id` values are a data contract. They are written into `child_profiles`
 * and must keep resolving for households created before the redesign, so the
 * redesign changed the artwork each id draws and left the ids alone.
 */

/** The character drawn inside the badge. */
export type AvatarCharacter = Extract<
  PipIconName,
  "bear" | "chick" | "star" | "fish" | "balloon" | "cat" | "rocket" | "flower"
>;

export type ChildAvatar = {
  id: string;
  /** Spoken name, e.g. "Teddy bear". Used as the accessibility label. */
  label: string;
  character: AvatarCharacter;
};

export const CHILD_AVATARS: readonly ChildAvatar[] = [
  { id: "circle-dot", label: "Teddy bear", character: "bear" },
  { id: "circle-ring", label: "Chick", character: "chick" },
  { id: "rounded-bar", label: "Star", character: "star" },
  { id: "rounded-pair", label: "Fish", character: "fish" },
  { id: "arch-dot", label: "Balloon", character: "balloon" },
  { id: "arch-cross", label: "Cat", character: "cat" },
  { id: "petal-ring", label: "Rocket", character: "rocket" },
  { id: "petal-corner", label: "Flower", character: "flower" },
];

export const DEFAULT_AVATAR_ID = CHILD_AVATARS[0].id;

export function findChildAvatar(id: string | null | undefined): ChildAvatar {
  return CHILD_AVATARS.find((avatar) => avatar.id === id) ?? CHILD_AVATARS[0];
}

export type AccentColor = {
  id: string;
  /** Spoken colour name, so the choice is never conveyed by swatch alone. */
  label: string;
  /** Badge fill. */
  background: string;
  /** Motif and text drawn on the fill; chosen for contrast against it. */
  foreground: string;
};

/**
 * Six grounds, each paired with an ink that clears 4.5:1 against it. The ids
 * are stored on the profile, so they are fixed even though the redesign
 * retuned every value.
 */
export const ACCENT_COLORS: readonly AccentColor[] = [
  { id: "mint", label: "Mint", background: pipAvatarPalette[3].surface, foreground: pipAvatarPalette[3].ink },
  { id: "sage", label: "Sage", background: pipAvatarPalette[1].surface, foreground: pipAvatarPalette[1].ink },
  { id: "yellow", label: "Sunshine", background: pipAvatarPalette[2].surface, foreground: pipAvatarPalette[2].ink },
  { id: "lavender", label: "Lavender", background: pipAvatarPalette[4].surface, foreground: pipAvatarPalette[4].ink },
  { id: "blush", label: "Blush", background: pipAvatarPalette[5].surface, foreground: pipAvatarPalette[5].ink },
  { id: "sky", label: "Sky", background: pipAvatarPalette[0].surface, foreground: pipAvatarPalette[0].ink },
];

export const DEFAULT_ACCENT_COLOR_ID = ACCENT_COLORS[0].id;

export function findAccentColor(id: string | null | undefined): AccentColor {
  return ACCENT_COLORS.find((color) => color.id === id) ?? ACCENT_COLORS[0];
}

/**
 * Broad age bands. Deliberately coarse: the product never stores a birthday,
 * and these only tune wording and choice defaults.
 */
export const AGE_RANGES = ["2-3", "4-5", "6-7", "8+"] as const;
export type AgeRange = (typeof AGE_RANGES)[number];

export function isAgeRange(value: string): value is AgeRange {
  return (AGE_RANGES as readonly string[]).includes(value);
}

/** How much text accompanies pictures in Child Mode. */
export const READING_SUPPORTS = ["pictures", "pictures-words", "pictures-words-audio"] as const;
export type ReadingSupport = (typeof READING_SUPPORTS)[number];

export const READING_SUPPORT_LABELS: Record<ReadingSupport, string> = {
  pictures: "Pictures only",
  "pictures-words": "Pictures and words",
  "pictures-words-audio": "Pictures, words, and spoken labels",
};

export const DEFAULT_READING_SUPPORT: ReadingSupport = "pictures-words";

export function isReadingSupport(value: string): value is ReadingSupport {
  return (READING_SUPPORTS as readonly string[]).includes(value);
}

/** Choice counts the parent may offer a child, matching the existing setting. */
export const CHOICE_COUNTS = [1, 3, 5] as const;
export type ChoiceCount = (typeof CHOICE_COUNTS)[number];

export const DEFAULT_CHOICE_COUNT: ChoiceCount = 3;

export function isChoiceCount(value: number): value is ChoiceCount {
  return (CHOICE_COUNTS as readonly number[]).includes(value);
}
