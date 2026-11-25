import { expect, it } from 'vitest';
import config from '../../vite.config';
it('builds at the GitHub Pages subpath', () => {
  expect(config.base).toBe('/piano-practice/');
});
