import { beforeAll, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { createVector, shapeLine, visualRuns } from '../src/lib/vector';
import catalog from '../src/data/fonts.json';
let font:ArrayBuffer;
beforeAll(async()=>{font=Uint8Array.from(await readFile(new URL('../public/fonts/amiri/Amiri-Regular.ttf',import.meta.url))).buffer;});
describe('Arabic shaping and vector export',()=>{
  it('keeps English punctuation on its LTR side',()=>{
    expect(visualRuns('Hello 2026!','ltr').map(r=>r.text).join('')).toBe('Hello 2026!');
    expect(visualRuns('(Harf) 2026','ltr').every(r=>r.direction==='ltr')).toBe(true);
  });
  it('preserves logical Latin text in mixed visual runs',()=>{
    const runs=visualRuns('مرحبا ABC 123');
    expect(runs.map(r=>r.text).join('')).toContain('ABC 123');
    expect(runs.at(-1)?.direction).toBe('rtl');
  });
  it('uses joined glyphs instead of isolated Arabic letters',async()=>{
    const joined=await shapeLine(font,'سلام',400);
    const isolated=await shapeLine(font,'س ل ا م',400);
    expect(joined.glyphs.map(g=>g.id)).not.toEqual(isolated.glyphs.filter(g=>g.path).map(g=>g.id));
    expect(joined.glyphs.every(g=>g.id!==0)).toBe(true);
  });
  it('exports paths and escapes user text in metadata',async()=>{
    const svg=await createVector(font,'العَرَبِيَّة < & " جميلة\nHello 123',{size:48,weight:400,color:'#203b30',background:null,align:'right'});
    expect(svg).toContain('<path');expect(svg).not.toContain('<text');
    expect(svg).toContain('&lt;');expect(svg).toContain('&amp;');
    expect(svg).toContain('viewBox=');expect(svg).not.toContain('NaN');
  });
  it('preserves font licensing notices as escaped SVG metadata',async()=>{
    const attribution='Font: Raqq\nLicense: AGPL-3.0\nCopyright <author> & original source';
    const svg=await createVector(font,'حرف',{size:48,weight:400,color:'#000000',background:null,align:'right',attribution});
    expect(svg).toContain('<metadata>');expect(svg).toContain('AGPL-3.0');
    expect(svg).toContain('&lt;author&gt; &amp; original source');expect(svg).not.toContain('<author>');
  });
  it('rejects unsupported glyphs instead of exporting tofu',async()=>{
    await expect(createVector(font,'مرحبا 🦄',{size:48,weight:400,color:'#000000',background:null,align:'right'})).rejects.toThrow();
  });
  it('rejects empty text and unsafe color attributes',async()=>{
    await expect(createVector(font,' ',{size:48,weight:400,color:'#000000',background:null,align:'right'})).rejects.toThrow();
    await expect(createVector(font,'سلام',{size:48,weight:400,color:'"/><script/>',background:null,align:'right'})).rejects.toThrow();
  });
  it('uses different real outlines for variable weights',async()=>{
    const path=catalog.fonts.find(f=>f.id==='cairo')!.files[0].path;
    const cairo=Uint8Array.from(await readFile(new URL(`../public/${path}`,import.meta.url))).buffer;
    const light=await shapeLine(cairo,'حرف',200),bold=await shapeLine(cairo,'حرف',800);
    expect(light.glyphs.map(g=>g.path)).not.toEqual(bold.glyphs.map(g=>g.path));
  });
  it('exports visible outlines from every bundled family',async()=>{
    for(const entry of catalog.fonts) {
      const bytes=Uint8Array.from(await readFile(new URL(`../public/${entry.files[0].path}`,import.meta.url))).buffer;
      const ar=entry.languages.includes('ar');
      const svg=await createVector(bytes,ar?'حرف':'Harf 2026!',{size:48,weight:400,color:'#000000',background:null,align:'right',direction:ar?'rtl':'ltr'});
      expect(svg,entry.family).toContain('<path');
      expect(svg,entry.family).not.toMatch(/NaN|undefined/);
    }
  },30000);
});
