import { describe, expect, it } from 'vitest';
import { inspectFont, resolveWeight } from '../src/lib/fonts';
import { readFile } from 'node:fs/promises';
import { woffEncode } from 'woff-lib/woff/encode';

describe('real font weights', () => {
  it('chooses the closest supported weight, preferring lighter on ties', () => {
    expect(resolveWeight([400, 700], 600)).toBe(700);
    expect(resolveWeight([400, 700], 550)).toBe(400);
    expect(resolveWeight([400], 900)).toBe(400);
  });
  it('rejects an empty weight list', () => expect(() => resolveWeight([], 400)).toThrow());
});

describe('font validation', () => {
  it('rejects corrupt font data', async () => {
    await expect(inspectFont(new Uint8Array([1, 2, 3]).buffer)).rejects.toThrow();
  });
  it('recognizes a real bundled Arabic font', async () => {
    const bytes = await readFile(new URL('../public/fonts/amiri/Amiri-Regular.ttf', import.meta.url));
    const info = await inspectFont(Uint8Array.from(bytes).buffer);
    expect(info.arabic).toBe(true);
    expect(info.weights).toContain(400);
  });
  it('decodes WOFF and WOFF2 imports without losing Arabic coverage', async()=>{
    const ttf=Uint8Array.from(await readFile(new URL('../public/fonts/amiri/Amiri-Regular.ttf',import.meta.url)));
    const woff2=await readFile(new URL('./fixtures/Amiri-Arabic.woff2',import.meta.url));
    for(const compressed of [await woffEncode(ttf),woff2]) {
      const result=await inspectFont(Uint8Array.from(compressed).buffer);
      expect(result.arabic).toBe(true);expect(result.weights).toContain(400);
    }
  });
});
