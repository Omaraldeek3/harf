import type { FontEntry } from './fonts';
import { assetUrl } from './fonts';

export function saveFile(blob:Blob,name:string) {
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}

export async function downloadFamily(entry:FontEntry) {
  if(entry.source!=='google'&&entry.source!=='open') throw new Error('تنزيل الخطوط متاح للعائلات الحرة المرفقة فقط.');
  const {default:JSZip}=await import('jszip');
  const zip=new JSZip();
  await Promise.all([...entry.files.map(f=>f.path),entry.license,...(entry.extraLicenses||[]),...(entry.sourceFiles||[])].map(async file=>{
    const r=await fetch(assetUrl(file),{signal:AbortSignal.timeout(30000)}).catch(()=>{throw new Error('تعذّر تجهيز التنزيل. تحقق من الاتصال وأعد المحاولة.');});
    if(!r.ok) throw new Error('تعذّر تجهيز التنزيل. أعد المحاولة.');
    zip.file(file.split('/').at(-1)!,await r.arrayBuffer());
  }));
  zip.file('SOURCE.txt',`Font: ${entry.family}\nSource: ${entry.sourceUrl||'https://github.com/google/fonts'}\nRevision: ${entry.revision||'See the catalog'}\nLicense: see the included license file(s).\nDownloaded with Harf, the font preview tool.\n`);
  saveFile(await zip.generateAsync({type:'blob',compression:'DEFLATE'}),`${entry.family.replace(/[^\w-]/g,'-')}.zip`);
}

/** Retain the original copyright and full copyleft font license in SVG outlines. */
export async function vectorAttribution(entry:FontEntry):Promise<string|undefined> {
  if(entry.licenseKind!=='AGPL-3.0')return undefined;
  const notices=await Promise.all([entry.license,...(entry.extraLicenses||[])].map(async file=>{
    const response=await fetch(assetUrl(file),{signal:AbortSignal.timeout(30000)});
    if(!response.ok)throw new Error('تعذّر تحميل إشعارات رخصة الخط. أعد محاولة التصدير.');
    return response.text();
  }));
  return `Font: ${entry.family}\nFont license: ${entry.licenseKind}\nOriginal editable source: ${entry.sourceUrl}\nRevision: ${entry.revision}\n\n${notices.join('\n\n')}`;
}
