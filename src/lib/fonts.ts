export type FontSource = 'google' | 'open' | 'local' | 'upload';
export interface FontEntry {
  id: string;
  family: string;
  category: string;
  weights: number[];
  weightRange: number[] | null;
  files: { path: string; weight: number; variable: boolean }[];
  designers: string[];
  license: string;
  source: FontSource;
  languages?: ('ar'|'en')[];
  sourceUrl?: string;
  revision?: string;
  extraLicenses?: string[];
  sourceFiles?: string[];
  collection?: string;
  licenseKind?: string;
  curatedSource?: string;
  arabicFingerprint?: string;
  color?: boolean;
  bytes?: ArrayBuffer;
}

export function resolveWeight(weights: number[], requested: number): number {
  if (!weights.length) throw new Error('لا توجد أوزان متاحة لهذا الخط.');
  return [...weights].sort((a,b) => Math.abs(a-requested)-Math.abs(b-requested) || a-b)[0];
}

export function assetUrl(file: string): string {
  // Keep commas literal: Vite's public-file middleware does not resolve %2C.
  return `${import.meta.env.BASE_URL}${file.split('/').map(p=>encodeURIComponent(p).replace(/%2C/gi,',')).join('/')}`;
}

/** Bound table offsets before handing untrusted data to the shaping engine. */
function validateSfnt(bytes: ArrayBuffer): void {
  if (bytes.byteLength < 12 || bytes.byteLength > 32 * 1024 * 1024) throw new Error('ملف الخط غير صالح أو أكبر من 32 ميغابايت.');
  const v = new DataView(bytes);
  const magic = v.getUint32(0);
  if (magic !== 0x00010000 && magic !== 0x4f54544f && magic !== 0x74727565) throw new Error('صيغة الخط غير مدعومة. استخدم TTF أو OTF أو WOFF أو WOFF2.');
  const tables = v.getUint16(4);
  if (!tables || tables > 256 || 12+tables*16 > bytes.byteLength) throw new Error('جدول الخط تالف.');
  const tags = new Set<string>();
  for (let i=0;i<tables;i++) {
    const p=12+i*16, offset=v.getUint32(p+8), length=v.getUint32(p+12);
    if (offset+length > bytes.byteLength) throw new Error('ملف الخط ناقص أو تالف.');
    tags.add(String.fromCharCode(...new Uint8Array(bytes,p,4)));
  }
  if (!tags.has('cmap') || !tags.has('head') || !(tags.has('glyf') || tags.has('CFF ') || tags.has('CFF2'))) throw new Error('الملف لا يحتوي على خط قابل للرسم.');
}

export async function normalizeFont(bytes: ArrayBuffer): Promise<ArrayBuffer> {
  if (bytes.byteLength < 12 || bytes.byteLength > 32*1024*1024) throw new Error('ملف الخط غير صالح أو أكبر من 32 ميغابايت.');
  const sig=new DataView(bytes).getUint32(0);
  if (sig===0x774f4646 || sig===0x774f4632) {
    // Reject compressed inputs declaring an excessive decompressed size.
    if (bytes.byteLength < 48 || new DataView(bytes).getUint32(16)>32*1024*1024) throw new Error('حجم الخط المضغوط غير صالح.');
    const decoded = sig===0x774f4646
      ? await (await import('woff-lib/woff/decode')).woffDecode(bytes)
      : await (await import('woff-lib/woff2/decode')).woff2Decode(bytes);
    bytes = Uint8Array.from(decoded).buffer;
  }
  validateSfnt(bytes);
  return bytes;
}

export async function inspectFont(input: ArrayBuffer) {
  const bytes=await normalizeFont(input);
  const hb=await import('harfbuzzjs');
  const face=new hb.Face(new hb.Blob(bytes));
  const chars=new Set(face.collectUnicodes());
  if (!chars.size || !face.upem) throw new Error('تعذّر قراءة الخط.');
  const axis=face.getAxisInfos().wght;
  const os2=face.referenceTable('OS/2');
  const rawWeight=os2 && os2.length>=6 ? new DataView(os2.buffer,os2.byteOffset,os2.byteLength).getUint16(4) : 400;
  const weight=Math.max(1,Math.min(1000,rawWeight||400));
  const weights=axis ? [...new Set([axis.min, ...[100,200,300,400,500,600,700,800,900].filter(w=>w>=axis.min&&w<=axis.max), axis.max])].sort((a,b)=>a-b) : [weight];
  const english=Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789').every(c=>chars.has(c.codePointAt(0)!));
  return { bytes, arabic: [0x627,0x628,0x645].every(c=>chars.has(c)), english, weights, weightRange: axis ? [axis.min,axis.max] : null };
}

const cache=new Map<string,Promise<ArrayBuffer>>();
export function fontFile(entry: FontEntry, weight: number) {
  const actual=resolveWeight(entry.weights,weight);
  const file=entry.files.find(f=>f.variable) || entry.files.find(f=>f.weight===actual);
  if (!file && !entry.bytes) throw new Error('ملف هذا الوزن غير متاح.');
  return file;
}

export function fontBytes(entry: FontEntry, weight: number): Promise<ArrayBuffer> {
  if (entry.bytes) return Promise.resolve(entry.bytes);
  const file=fontFile(entry,weight)!;
  if (!cache.has(file.path)) {
    const promise=fetch(assetUrl(file.path), { signal: AbortSignal.timeout(30000) }).then(r=>{
      if (!r.ok) throw new Error('تعذّر تحميل الخط. تحقق من الاتصال وأعد المحاولة.');
      return r.arrayBuffer();
    }).then(bytes=>{validateSfnt(bytes);return bytes;}).catch(e=>{cache.delete(file.path);throw new Error(e instanceof Error&&/\p{Script=Arabic}/u.test(e.message)?e.message:'تعذّر تحميل الخط. تحقق من الاتصال وأعد المحاولة.');});
    cache.set(file.path,promise);
  }
  return cache.get(file.path)!;
}

const faces=new Map<string,Promise<void>>();
export function cssFamily(entry: FontEntry) { return `harf-${entry.id}`; }
export async function loadFont(entry: FontEntry, weight: number): Promise<number> {
  const actual=resolveWeight(entry.weights,weight);
  const key=`${entry.id}-${entry.weightRange ? 'variable' : actual}`;
  if (!faces.has(key)) {
    const promise=fontBytes(entry,actual).then(async bytes=>{
      const font=new FontFace(cssFamily(entry),bytes,{weight:entry.weightRange ? entry.weightRange.join(' ') : String(actual), style:'normal'});
      await font.load();
      document.fonts.add(font);
    }).catch(e=>{faces.delete(key);throw e;});
    faces.set(key,promise);
  }
  await faces.get(key);
  return actual;
}
