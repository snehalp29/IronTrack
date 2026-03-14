import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('shared package entrypoints', () => {
  it('points runtime and types to compiled dist artifacts', () => {
    const packageJsonRaw = readFileSync(
      new URL('../../package.json', import.meta.url),
      'utf8',
    );
    const packageJson = JSON.parse(packageJsonRaw) as {
      main?: string;
      types?: string;
    };

    expect(packageJson.main).toBe('dist/index.js');
    expect(packageJson.types).toBe('dist/index.d.ts');
  });
});
