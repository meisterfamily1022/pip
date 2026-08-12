import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('native auth route entries', () => {
  it('never imports web route modules into the iOS navigation stack', () => {
    for (const route of ['sign-in', 'sign-up', 'verify-email']) {
      const source = readFileSync(resolve(process.cwd(), `src/app/(auth)/${route}.tsx`), 'utf8');
      expect(source).not.toContain(`./${route}.web`);
      expect(source).toContain('@/features/auth/');
    }
  });
});
