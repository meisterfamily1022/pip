import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { pipBrand } from '@/brand/pip-brand';
import {
  EarlyAccessService,
  EarlyAccessValidationError,
  LocalDevelopmentEarlyAccessRepository,
  resetEarlyAccessForTests,
} from '@/server/early-access/early-access-service';
import {
  availableFeatures,
  earlyAccessForm,
  landingFamilies,
  landingFeatures,
  landingFinalCta,
  landingFooterLinks,
  landingHero,
  landingNav,
  landingPrivacy,
  landingProblem,
  landingSteps,
} from './landing-copy';

const allCopy = (): string =>
  [
    landingHero.headline,
    landingHero.body,
    landingHero.primaryCta,
    landingHero.secondaryCta,
    landingProblem.heading,
    ...landingProblem.points.flatMap((point) => [point.title, point.body]),
    landingSteps.heading,
    ...landingSteps.steps.flatMap((step) => [step.title, step.body]),
    landingFamilies.heading,
    landingFamilies.body,
    ...landingFamilies.points,
    ...landingFeatures.flatMap((feature) => [feature.title, feature.body]),
    landingPrivacy.heading,
    ...landingPrivacy.points,
    landingPrivacy.note,
    landingFinalCta.heading,
    landingFinalCta.body,
    earlyAccessForm.heading,
    earlyAccessForm.body,
    earlyAccessForm.consentLabel,
    earlyAccessForm.successBody,
    ...landingNav.links.map((link) => link.label),
  ].join('\n');

describe('landing copy', () => {
  it('never shows the legacy project name', () => {
    expect(allCopy()).not.toMatch(/PlayMap/i);
  });

  it('speaks as Pip', () => {
    expect(allCopy()).toContain(pipBrand.name);
  });

  it('offers early access rather than a download or sign-in', () => {
    // There is no App Store listing and no web sign-in destination yet, so the
    // page must not imply either.
    expect(landingHero.primaryCta.toLowerCase()).toContain('early access');
    expect(allCopy()).not.toMatch(/download on the app store|get it on google play|testflight/i);

    // Downloads are still not offered: there is no App Store listing.
    const offers = [
      ...landingNav.links.map((link) => link.label),
      landingHero.primaryCta,
      landingHero.secondaryCta,
      earlyAccessForm.submitLabel,
    ].join('\n');
    expect(offers).not.toMatch(/download/i);
  });

  it('points every footer link at a route that exists', () => {
    // A privacy link that 404s is worse than no privacy link at all.
    const appDir = join(__dirname, '..', '..', 'app');
    for (const link of landingFooterLinks) {
      const route = link.href.replace(/^\//, '');
      const candidates = [
        join(appDir, `${route}.tsx`),
        join(appDir, route, 'index.tsx'),
      ];
      expect(candidates.some((candidate) => existsSync(candidate))).toBe(true);
    }
  });

  it('offers sign in now that the screen exists', () => {
    // Held back until Prompt 10 built the destination, so the link is real.
    expect(landingNav.signIn.href).toBe('/sign-in');
    expect(landingNav.signIn.label).toMatch(/sign in/i);
  });

  it('never claims backup or syncing exists today', () => {
    // The privacy points are the load-bearing claims, so nothing there may
    // promise a capability the build does not have.
    expect(landingPrivacy.points.join(' ')).not.toMatch(/backup|back(ed)? up|sync/i);
    expect(landingFeatures.filter((feature) => feature.available).map((f) => `${f.title} ${f.body}`).join(' ')).not.toMatch(
      /backup|sync/i,
    );

    // Where backup is mentioned at all, it must read as future, not present.
    expect(landingPrivacy.note).toMatch(/when .*(arrive|ready)/i);
  });

  it('claims photos stay on the device, which matches the shipped build', () => {
    expect(landingPrivacy.points.join(' ')).toMatch(/stay on your device/i);
  });

  it('makes no legal compliance claims', () => {
    expect(allCopy()).not.toMatch(/COPPA|GDPR|HIPAA|SOC ?2|compliant/i);
  });
});

describe('feature claims', () => {
  it('advertises every feature, now that all of them are built', () => {
    const shown = availableFeatures().map((feature) => feature.id);
    expect(shown).toContain('child-mode');
    expect(shown).toContain('library');
    // Every advertised feature now exists: profiles and per-child settings from
    // the management screens, Guest from Child Mode entry.
    expect(shown).toContain('profiles');
    expect(shown).toContain('per-child');
    expect(shown).toContain('guest');
  });

  it('keeps every feature id unique', () => {
    expect(new Set(landingFeatures.map((feature) => feature.id)).size).toBe(landingFeatures.length);
  });

  it('gives every feature a title and a description', () => {
    for (const feature of landingFeatures) {
      expect(feature.title.length).toBeGreaterThan(0);
      expect(feature.body.length).toBeGreaterThan(0);
    }
  });
});

describe('early access registration', () => {
  beforeEach(() => {
    resetEarlyAccessForTests();
  });

  const build = (): { service: EarlyAccessService; repository: LocalDevelopmentEarlyAccessRepository } => {
    const repository = new LocalDevelopmentEarlyAccessRepository();
    return { service: new EarlyAccessService(repository), repository };
  };

  it('records a valid address', async () => {
    const { service, repository } = build();
    await expect(service.register({ email: 'parent@example.com', acceptedUpdates: true })).resolves.toEqual({
      registered: true,
    });
    expect(await repository.count()).toBe(1);
  });

  it('requires explicit consent', async () => {
    const { service } = build();
    await expect(service.register({ email: 'parent@example.com', acceptedUpdates: false })).rejects.toBeInstanceOf(
      EarlyAccessValidationError,
    );
  });

  it('rejects an unusable address', async () => {
    const { service } = build();
    for (const email of ['', 'not-an-email', 'a@b', `${'x'.repeat(250)}@example.com`]) {
      await expect(service.register({ email, acceptedUpdates: true })).rejects.toBeInstanceOf(EarlyAccessValidationError);
    }
  });

  it('treats a repeat submission as success without duplicating', async () => {
    const { service, repository } = build();
    await service.register({ email: 'parent@example.com', acceptedUpdates: true });
    await expect(service.register({ email: 'PARENT@example.com', acceptedUpdates: true })).resolves.toEqual({
      registered: true,
    });
    expect(await repository.count()).toBe(1);
  });

  it('accepts and discards a honeypot submission', async () => {
    const { service, repository } = build();
    await expect(
      service.register({ email: 'bot@example.com', acceptedUpdates: true, honeypot: 'Acme Inc' }),
    ).resolves.toEqual({ registered: true });
    expect(await repository.count()).toBe(0);
  });

  it('stores only the address and a timestamp', async () => {
    const { service, repository } = build();
    await service.register({ email: 'Parent@Example.com', acceptedUpdates: true });
    const stored = await repository.get('parent@example.com');
    expect(Object.keys(stored ?? {}).sort()).toEqual(['createdAt', 'email', 'emailKey']);
  });
});
