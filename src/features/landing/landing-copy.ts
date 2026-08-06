import { pipBrand } from '@/brand/pip-brand';

/**
 * Landing page copy and feature claims.
 *
 * Kept out of the component so every public claim is in one auditable place and
 * can be tested. The brief was written when the product was called PlayMap;
 * that name is legacy now, so the copy is rewritten to read naturally for a
 * one-syllable brand rather than find-and-replaced.
 */

export const landingHero = {
  headline: 'Less searching. Less overwhelm. More time to play.',
  body: `${pipBrand.name} gives your family a simple visual library of the toys you already own — so children can choose what to play with, grown-ups can find where things belong, and tidying up becomes part of the routine.`,
  primaryCta: 'Join early access',
  secondaryCta: 'See how it works',
} as const;

export const landingProblem = {
  heading: "Finding a toy shouldn't create more work than playing with it.",
  points: [
    { title: 'Toys disappear', body: 'Into bins, under beds, behind the sofa. Out of sight, out of rotation.' },
    { title: 'Too many choices', body: 'An overflowing toy box can be harder to start with than an empty one.' },
    { title: 'You become the search engine', body: 'Every "where is my…" comes back to a grown-up.' },
    { title: 'Tidy up is abstract', body: '"Put it away" means nothing without somewhere specific to put it.' },
  ],
} as const;

export const landingSteps = {
  heading: 'How it works',
  steps: [
    { title: 'Photograph a toy', body: 'One at a time, or add a batch of photos at once.' },
    { title: 'Give it a home', body: 'Say which room, shelf, basket, or bin it belongs in.' },
    { title: 'Offer a few choices', body: 'Your child sees one, three, or five options — never the whole toy box.' },
    { title: 'Show where it goes', body: 'When play is done, the toy comes with directions home.' },
  ],
} as const;

export const landingFamilies = {
  heading: 'Designed for real families',
  points: [
    'For children who do better with fewer choices.',
    'For homes where toys migrate between rooms.',
    'For routines that need less friction.',
    'For families sharing one toy library between several children.',
  ],
  // Rewritten from the brief's "Create a PlayMap for your whole family", which
  // does not survive the rename.
  body: `Set up ${pipBrand.name} for your whole family. Each child gets their own visual profile, choice settings, and play history, while everyone shares one household toy library.`,
} as const;

/**
 * Feature claims.
 *
 * `available` marks what a visitor can actually do today. The page renders only
 * available features, so the landing page cannot promise something the app does
 * not yet do. Flip a flag on in the prompt that ships the feature.
 */
export type LandingFeature = {
  id: string;
  title: string;
  body: string;
  available: boolean;
};

export const landingFeatures: readonly LandingFeature[] = [
  { id: 'library', title: 'Visual toy library', body: 'Every toy you own, as a photo you can actually recognise.', available: true },
  { id: 'camera', title: 'In-app camera', body: 'Photograph a toy without leaving the app.', available: true },
  { id: 'bulk', title: 'Bulk photo upload', body: 'Add a whole shelf at once and sort the details later.', available: true },
  { id: 'locations', title: 'Rooms and storage spots', body: 'Playroom, blue bin, bottom shelf — wherever it really lives.', available: true },
  { id: 'child-mode', title: 'Child Mode', body: 'A calm, photo-led screen made for small hands.', available: true },
  { id: 'suggestions', title: 'Toy suggestions', body: 'A short list to choose from, not an overwhelming grid.', available: true },
  { id: 'cleanup', title: 'Tidy-up guidance', body: 'Where the toy goes, shown before the next choice.', available: true },
  { id: 'pin', title: 'Grown-up PIN', body: 'Parent settings stay behind a four-digit PIN.', available: true },
  { id: 'hidden', title: 'Hidden and archived toys', body: 'Keep some things out of rotation without deleting them.', available: true },
  { id: 'profiles', title: 'Multiple child profiles', body: 'Each child gets their own choices and play history.', available: true },
  { id: 'per-child', title: 'Per-child settings', body: 'Choice count and reading support, tuned per child.', available: true },
  { id: 'guest', title: 'Guest mode', body: 'A visiting friend can play without creating a profile.', available: true },
];

export function availableFeatures(): readonly LandingFeature[] {
  return landingFeatures.filter((feature) => feature.available);
}

/**
 * Privacy claims.
 *
 * Each must be literally true of the shipped build. There is no backup or sync
 * yet, so the page says photos stay on the device and promises nothing about
 * syncing. When sync lands, this copy changes with it.
 */
export const landingPrivacy = {
  heading: "Your child's play doesn't need to become advertising data.",
  points: [
    'Toy photos stay on your device.',
    'No public profiles and no social feed.',
    'No advertising, and nothing sold to anyone.',
    'No account needed to try it.',
    'Children never sign in or create accounts.',
  ],
  note: 'When accounts and backup arrive, you will choose whether to turn them on.',
} as const;

export const landingFinalCta = {
  heading: 'Give every toy a home, and every child an easier way to choose.',
  body: `${pipBrand.name} is in development. Join early access and we will email you when it is ready to try.`,
} as const;

export const earlyAccessForm = {
  heading: 'Join early access',
  body: 'One email when Pip is ready. Nothing else.',
  emailLabel: 'Email address',
  consentLabel: 'Email me when Pip is ready to try.',
  submitLabel: 'Join early access',
  successHeading: "You're on the list",
  successBody: 'We will be in touch when Pip is ready. Thanks for the interest.',
} as const;

export const landingNav = {
  // Sign In is deliberately absent: web sign-in has no destination yet, and the
  // page must not offer a link that goes nowhere.
  links: [
    { id: 'how', label: 'How it works' },
    { id: 'families', label: 'For families' },
    { id: 'privacy', label: 'Safety & privacy' },
  ],
} as const;
