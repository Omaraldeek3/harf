import {describe,it,expect} from 'vitest';
import {readFile} from 'node:fs/promises';
import catalog from '../src/data/fonts.json';
import {auditArabic} from '../scripts/font-audit.mjs';
import {repositories,libraryArchives,directFonts} from '../scripts/curated-font-sources.mjs';
import JSZip from 'jszip';
async function bytes(id:string) {
  const font=catalog.fonts.find(f=>f.id===id)!;
  return readFile(new URL(`../public/${font.files.find(f=>f.variable||f.weight===400)?.path||font.files[0].path}`,import.meta.url));
}
describe('Arabic source audit',()=>{
  it('pins the original repositories and verifies downloaded font/archive hashes',()=>{
    for(const source of repositories)expect(source.revision).toMatch(/^[a-f0-9]{40}$/);
    for(const source of [...libraryArchives,...directFonts])expect(source.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(directFonts.find(f=>f.family==='LaylaDigital')?.filename).toBe('LaylaDigital.ttf');
  });
  it('checks actual Arabic shaping and available variable weights',async()=>{
    const info=auditArabic(await bytes('cairo'));
    expect(info.family).toBe('Cairo');expect(info.english).toBe(true);
    expect(info.weights).toContain(700);expect(info.weightRange).toEqual([200,1000]);
  });
  it('rejects a Latin-only font even if its source label says Arabic',async()=>{
    const awaited=await bytes('inter');
    expect(()=>auditArabic(awaited)).toThrow('No Arabic coverage');
  });
  it('recognizes the same Arabic design across different names and color packaging',async()=>{
    expect(auditArabic(await bytes('cairo')).fingerprint).toBe(auditArabic(await bytes('cairoplay')).fingerprint);
  });
  it('keeps different Arabic designs distinct',async()=>{
    expect(auditArabic(await bytes('cairo')).fingerprint).not.toBe(auditArabic(await bytes('tajawal')).fingerprint);
  });
  it('verifies every new family and prevents duplicate Arabic designs',async()=>{
    const additions=catalog.fonts.filter(f=>'curatedSource' in f&&f.curatedSource);
    expect(additions.length).toBeGreaterThanOrEqual(70);
    const fingerprints=new Set<string>();
    for(const entry of additions) {
      const info=auditArabic(await bytes(entry.id));
      expect(info.fingerprint,entry.family).toBe(entry.arabicFingerprint);
      expect(fingerprints.has(info.fingerprint),`${entry.family} repeats an Arabic design`).toBe(false);
      fingerprints.add(info.fingerprint);
      expect(entry.extraLicenses?.length).toBeGreaterThan(0);
      for(const file of [entry.license,...(entry.extraLicenses||[])]) {
        const notice=await readFile(new URL(`../public/${file}`,import.meta.url));
        expect(notice.length).toBeGreaterThan(100);expect(notice.length).toBeLessThan(1024*1024);
        expect(notice.toString()).not.toMatch(/Source member: .*\.(jpe?g|png|gif|pdf)/i);
      }
    }
  },30000);
  it('ships editable font sources and build data for copyleft creator fonts',async()=>{
    const sources=catalog.fonts.filter(f=>'curatedSource' in f&&f.curatedSource&&['AGPL-3.0','CRULP'].includes(f.licenseKind));
    expect(sources.length).toBeGreaterThan(5);
    for(const entry of sources) {
      expect(entry.sourceFiles?.length).toBeGreaterThan(0);
      for(const file of entry.sourceFiles||[]) {
        const zip=await JSZip.loadAsync(await readFile(new URL(`../public/${file}`,import.meta.url)));
        expect(Object.keys(zip.files).some(n=>/\.sfd$|\.glyphs$|\.glif$|\.glyphspackage\/.*\.glyph$/.test(n)),entry.family).toBe(true);
        expect(Object.keys(zip.files).some(n=>/\.(jpe?g|png|gif|pdf)$/i.test(n)),entry.family).toBe(false);
        expect(zip.file('HARF-SOURCE-BUNDLE.txt')).not.toBeNull();
      }
    }
  });
});
