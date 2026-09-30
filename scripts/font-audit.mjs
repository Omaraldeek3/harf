import * as hb from 'harfbuzzjs';
import {createHash} from 'node:crypto';

const alphabet='ابتثجحخدذرزسشصضطظعغفقكلمنهوي ءةى';
function shape(font,text) {
  const buffer=new hb.Buffer();buffer.addText(text);buffer.guessSegmentProperties();
  hb.shape(font,buffer);return buffer.getGlyphInfosAndPositions();
}

/** Inspect the actual font, including shaping, instead of trusting its label. */
export function auditArabic(bytes) {
  if(bytes.length<12||bytes.length>32*1024*1024)throw new Error('Invalid font size');
  const face=new hb.Face(new hb.Blob(Uint8Array.from(bytes).buffer));
  if(!face.upem)throw new Error('Unreadable font');
  const font=new hb.Font(face),chars=new Set(face.collectUnicodes());
  if(![0x627,0x628,0x645].every(c=>chars.has(c)))throw new Error('No Arabic coverage');
  const axis=face.getAxisInfos().wght;
  const os2=face.referenceTable('OS/2'),view=os2?new DataView(os2.buffer,os2.byteOffset,os2.byteLength):null;
  const weight=axis?Math.max(axis.min,Math.min(axis.max,400)):Math.max(1,Math.min(1000,view&&os2.length>=6?view.getUint16(4)||400:400));
  if(axis)font.setVariations([new hb.Variation('wght',weight)]);
  const glyphs=shape(font,alphabet+' العربية في الحروف حياة');
  if(glyphs.some(g=>g.codepoint===0))throw new Error('Incomplete Arabic alphabet');
  if(!glyphs.some(g=>font.glyphToPath(g.codepoint)))throw new Error('No vector outlines');
  if(shape(font,'بب').every(g=>g.codepoint===font.nominalGlyph(0x628)))throw new Error('No contextual Arabic joining');
  // Font names, Latin glyphs, numeral replacements and packaging cannot inflate
  // the Arabic family count. Normalize outlines and spacing to em units.
  const normalize=n=>Number((n/face.upem).toFixed(6));
  const geometry=glyphs.map(g=>({
    path:font.glyphToPath(g.codepoint).replace(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi,n=>String(normalize(Number(n)))),
    advance:[normalize(g.xAdvance),normalize(g.yAdvance)],offset:[normalize(g.xOffset),normalize(g.yOffset)],
  }));
  const fingerprint=createHash('sha256').update(JSON.stringify(geometry)).digest('hex');
  const weights=axis?[...new Set([axis.min,...[100,200,300,400,500,600,700,800,900].filter(w=>w>=axis.min&&w<=axis.max),axis.max])].sort((a,b)=>a-b):[weight];
  return {fingerprint,family:(face.getName(16,'en')||face.getName(1,'en')||'').trim(),weight,weights,weightRange:axis?[axis.min,axis.max]:null,
    italic:!!(view&&os2.length>=64&&(view.getUint16(62)&1)),
    english:Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789').every(c=>chars.has(c.codePointAt(0))),
    copyright:face.getName(0,'en')||'',designer:face.getName(9,'en')||'',license:face.getName(13,'en')||'',licenseUrl:face.getName(14,'en')||''};
}
