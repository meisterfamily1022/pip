import { playmapTheme as theme } from "@/theme/playmap-theme";

/**
 * The safe built-in avatar set for child profiles.
 *
 * Avatars are drawn from geometry rather than photographs or uploads, so no
 * image of a child is ever stored. Each avatar carries a spoken `label`, and
 * the picker renders shape plus name, so a profile is never identified by
 * colour alone — that matters for the accessibility requirement and for
 * children who cannot yet read.
 */

/** Outer silhouette of the avatar badge. */
export type AvatarShape = "circle" | "rounded" | "arch" | "petal";

/** Mark drawn inside the silhouette. */
export type AvatarMotif = "dot" | "ring" | "bar" | "pair" | "cross" | "corner";

export type ChildAvatar = {
  id: string;
  /** Spoken name, e.g. "Ring badge". Used as the accessibility label. */
  label: string;
  shape: AvatarShape;
  motif: AvatarMotif;
};

export const CHILD_AVATARS: readonly ChildAvatar[] = [
  { id: "circle-dot", label: "Dot circle", shape: "circle", motif: "dot" },
  { id: "circle-ring", label: "Ring circle", shape: "circle", motif: "ring" },
  { id: "rounded-bar", label: "Bar square", shape: "rounded", motif: "bar" },
  { id: "rounded-pair", label: "Two dots square", shape: "rounded", motif: "pair" },
  { id: "arch-dot", label: "Dot arch", shape: "arch", motif: "dot" },
  { id: "arch-cross", label: "Cross arch", shape: "arch", motif: "cross" },
  { id: "petal-ring", label: "Ring petal", shape: "petal", motif: "ring" },
  { id: "petal-corner", label: "Corner petal", shape: "petal", motif: "corner" },
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

export const ACCENT_COLORS: readonly AccentColor[] = [
  { id: "mint", label: "Mint", background: theme.colors.surfaceMint, foreground: theme.colors.brandInk },
  { id: "sage", label: "Sage", background: theme.colors.surfaceSage, foreground: "#3C4A38" },
  { id: "yellow", label: "Sunshine", background: theme.colors.surfaceYellow, foreground: theme.colors.warning },
  { id: "lavender", label: "Lavender", background: theme.colors.surfaceLavender, foreground: "#4A3A73" },
  { id: "blush", label: "Blush", background: theme.colors.surfaceBlush, foreground: theme.colors.error },
  { id: "sky", label: "Sky", background: theme.colors.brandPrimarySoft, foreground: theme.colors.brandInk },
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
