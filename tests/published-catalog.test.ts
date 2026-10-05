import { describe, expect, it } from 'vitest';
import { readFile, stat } from 'node:fs/promises';
import catalog from '../src/data/fonts.json';

// Cut Studio's Arabic lettering offers Harf's fonts from this file.
describe('the Arabic catalogue other tools read', () => {
  it('lists every Arabic outline font, with each file on disk', async () => {
    const published = JSON.parse(await readFile(new URL('../public/catalog/arabic.json', import.meta.url), 'utf8'));
    const expected = catalog.fonts.filter(f => f.languages.includes('ar') && !f.color);
    expect(published.count).toBe(expected.length);
    expect(published.fonts.map((f: { id: string }) => f.id).sort()).toEqual(expected.map(f => f.id).sort());
    for (const font of published.fonts) {
      expect(font.licence).toBeTruthy();
      expect((await stat(new URL(`../public/${font.licenceFile}`, import.meta.url))).size).toBeGreaterThan(100);
      for (const file of font.files) expect((await stat(new URL(`../public/${file.path}`, import.meta.url))).size).toBeGreaterThan(1000);
    }
  });

  it('is served to other sites, fonts included', async () => {
    const vercel = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
    for (const source of ['/fonts/(.*)', '/catalog/(.*)']) {
      const rule = vercel.headers.find((h: { source: string }) => h.source === source);
      expect(rule.headers).toContainEqual({ key: 'Access-Control-Allow-Origin', value: '*' });
    }
  });
});
