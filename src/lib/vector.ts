import bidiFactory from 'bidi-js';
import { normalizeFont } from './fonts';
const bidi=bidiFactory();
export interface VectorOptions {size:number;weight:number;color:string;background:string|null;align:'right'|'center'|'left';direction?:'rtl'|'ltr';attribution?:string}
type Run={text:string;direction:'rtl'|'ltr'};

/** Reorder runs, never codepoints inside Arabic before shaping. */
export function visualRuns(text:string,direction:'rtl'|'ltr'='rtl'):Run[] {
  if (!text) return [];
  const levels=bidi.getEmbeddingLevels(text,direction);
  const runs:(Run & {start:number;end:number})[]=[];
  let start=0;
  for(let i=1;i<=text.length;i++) {
    if(i===text.length || levels.levels[i]!==levels.levels[start]) {
      runs.push({text:text.slice(start,i),direction:levels.levels[start]%2?'rtl':'ltr',start,end:i-1});
      start=i;
    }
  }
  const indices=Array.from({length:text.length},(_,i)=>i);
  for(const [a,b] of bidi.getReorderSegments(text,levels)) {
    indices.splice(a,b-a+1,...indices.slice(a,b+1).reverse());
  }
  const ids=new Set(indices.map(i=>runs.findIndex(r=>i>=r.start&&i<=r.end)));
  return [...ids].map(i=>({text:runs[i].text,direction:runs[i].direction}));
}

interface Glyph {id:number;path:string;x:number;y:number;bounds:{left:number;right:number;top:number;bottom:number}|null}
class MissingGlyphError extends Error {}
export async function shapeLine(bytes:ArrayBuffer,text:string,weight:number,outlines=true,direction:'rtl'|'ltr'='rtl') {
  const hb=await import('harfbuzzjs');
  const face=new hb.Face(new hb.Blob(await normalizeFont(bytes)));
  const font=new hb.Font(face);
  if(face.getAxisInfos().wght) font.setVariations([new hb.Variation('wght',weight)]);
  const glyphs:Glyph[]=[];
  let cursor=0;
  for(const run of visualRuns(text,direction)) {
    const buffer=new hb.Buffer();
    buffer.addText(run.text);
    buffer.guessSegmentProperties();
    buffer.setDirection(run.direction==='rtl'?hb.Direction.RTL:hb.Direction.LTR);
    if(/\p{Script=Arabic}/u.test(run.text)) buffer.setLanguage('ar');
    hb.shape(font,buffer);
    for(const glyph of buffer.getGlyphInfosAndPositions()) {
      if(glyph.codepoint===0) throw new MissingGlyphError('هذا الخط لا يدعم بعض أحرف النص. غيّر النص أو اختر خطاً آخر.');
      const x=cursor+(glyph.xOffset||0), y=glyph.yOffset||0;
      const ext=outlines?font.glyphExtents(glyph.codepoint):undefined;
      const path=outlines?font.glyphToPath(glyph.codepoint):'';
      glyphs.push({id:glyph.codepoint,path,x,y,bounds:ext&&path ? {
        left:x+ext.xBearing,right:x+ext.xBearing+ext.width,
        top:-y-ext.yBearing,bottom:-y-ext.yBearing-ext.height,
      }:null});
      cursor+=glyph.xAdvance||0;
    }
  }
  return {glyphs,width:cursor,upem:face.upem,extents:font.hExtents()};
}

/** HarfBuzz can decompose a character absent from cmap into supported glyphs. */
export async function hasMissingGlyphs(bytes:ArrayBuffer,text:string,weight:number,direction:'rtl'|'ltr'='rtl'):Promise<boolean> {
  try {
    for(const line of text.replace(/\r\n?/g,'\n').split('\n'))await shapeLine(bytes,line,weight,false,direction);
    return false;
  }catch(e){if(e instanceof MissingGlyphError)return true;throw e;}
}

export function escapeXml(text:string):string {
  return text.replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]!));
}

export async function createVector(bytes:ArrayBuffer,text:string,options:VectorOptions):Promise<string> {
  const validColor=(s:string)=>/^#[0-9a-f]{6}$/i.test(s);
  if(!text.trim() || text.length>2000) throw new Error('أدخل نصاً بين حرف واحد و2000 حرف.');
  if(!validColor(options.color) || (options.background!==null&&!validColor(options.background))) throw new Error('لون غير صالح.');
  if(!Number.isFinite(options.size) || options.size<1 || options.size>200 || !Number.isFinite(options.weight)) throw new Error('قياس الخط غير صالح.');
  const lines=await Promise.all(text.replace(/\r\n?/g,'\n').split('\n').map(line=>shapeLine(bytes,line,options.weight,true,options.direction||'rtl')));
  const scale=options.size/lines[0].upem;
  const maxWidth=Math.max(...lines.map(l=>l.width))*scale;
  const e=lines[0].extents;
  const lineHeight=Math.max(options.size*1.9,(e.ascender-e.descender+e.lineGap)*scale);
  let left=0,right=maxWidth,top=-e.ascender*scale,bottom=(lines.length-1)*lineHeight-e.descender*scale;
  const paths:string[]=[];
  for(let i=0;i<lines.length;i++) {
    const line=lines[i], width=line.width*scale;
    const offset=options.align==='right' ? maxWidth-width : options.align==='center' ? (maxWidth-width)/2 : 0;
    for(const g of line.glyphs) {
      if(!g.path) continue;
      const x=offset+g.x*scale, y=i*lineHeight-g.y*scale;
      paths.push(`<path d="${g.path}" transform="translate(${x.toFixed(3)} ${y.toFixed(3)}) scale(${scale.toFixed(8)} ${(-scale).toFixed(8)})"/>`);
      if(g.bounds) {
        left=Math.min(left,offset+g.bounds.left*scale);right=Math.max(right,offset+g.bounds.right*scale);
        top=Math.min(top,i*lineHeight+g.bounds.top*scale);bottom=Math.max(bottom,i*lineHeight+g.bounds.bottom*scale);
      }
    }
  }
  if(!paths.length) throw new Error('لا توجد حروف قابلة للرسم في النص.');
  const pad=options.size*.35, x=left-pad, y=top-pad, width=Math.ceil(right-left+2*pad),height=Math.ceil(bottom-top+2*pad);
  const bg=options.background ? `<rect x="${x.toFixed(3)}" y="${y.toFixed(3)}" width="${width}" height="${height}" fill="${options.background}"/>` : '';
  const metadata=options.attribution?`<metadata>${escapeXml(options.attribution.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,''))}</metadata>`:'';
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${x.toFixed(3)} ${y.toFixed(3)} ${width} ${height}" role="img"><title>${escapeXml(text)}</title>${metadata}${bg}<g fill="${options.color}">${paths.join('')}</g></svg>`;
}
