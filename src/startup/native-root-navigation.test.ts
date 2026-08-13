import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('native root navigation ownership', () => {
  it('keeps the root Stack mounted while the guard performs an idempotent replace', () => {
    const layout = readFileSync(resolve(process.cwd(), 'src/app/_layout.tsx'), 'utf8');

    expect(layout).toContain('<Stack screenOptions={{ headerShown: false }} />');
    expect(layout).toContain('router.replace(redirectHref)');
    expect(layout).toContain('lastRedirect.current === redirectKey');
    expect(layout).not.toContain('<Redirect');
  });

  it('does not let the native index route start or redirect independently', () => {
    const index = readFileSync(resolve(process.cwd(), 'src/app/index.tsx'), 'utf8');

    expect(index).not.toContain('initializeApp()');
    expect(index).not.toContain('router.replace');
  });
});
