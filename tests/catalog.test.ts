import { describe, expect, it } from 'vitest';
import catalog from '../src/data/fonts.json';
import { readFile, stat } from 'node:fs/promises';
import { inspectFont } from '../src/lib/fonts';
describe('official bundled catalog',()=>{
  it('has unique families with actual Arabic coverage and licenses',async()=>{
    expect(catalog.fonts.length).toBeGreaterThan(50);
    expect(new Set(catalog.fonts.map(f=>f.id)).size).toBe(catalog.fonts.length);
    for(const f of catalog.fonts) {
      expect((await stat(new URL(`../public/${f.license}`,import.meta.url))).size).toBeGreaterThan(100);
      for(const file of f.files) {
        const data=Uint8Array.from(await readFile(new URL(`../public/${file.path}`,import.meta.url))).buffer;
        const info=await inspectFont(data);
        if(f.languages.includes('ar'))expect(info.arabic,`${f.family} must actually cover Arabic`).toBe(true);
        if(f.languages.includes('en'))expect(info.english,`${f.family} must actually cover English`).toBe(true);
      }
    }
  },30000);
  it('expands Arabic and includes a substantial English catalog',()=>{
    expect(catalog.fonts.filter(f=>f.languages.includes('ar')).length).toBeGreaterThanOrEqual(230);
    expect(catalog.fonts.filter(f=>f.languages.includes('en')).length).toBeGreaterThanOrEqual(200);
    expect(catalog.fonts.every(f=>f.sourceUrl&&f.revision&&f.license)).toBe(true);
  });
  it('retains corresponding source archives and upstream licenses for classic families',async()=>{
    const classic=catalog.fonts.filter(f=>'collection' in f&&f.collection);
    expect(classic.length).toBeGreaterThan(60);
    for(const f of classic) {
      expect(f.sourceFiles?.length).toBeGreaterThan(2);
      for(const file of f.sourceFiles||[])expect((await stat(new URL(`../public/${file}`,import.meta.url))).size).toBeGreaterThan(0);
    }
  });
});
