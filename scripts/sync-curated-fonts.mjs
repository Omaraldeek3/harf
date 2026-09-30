import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {inflateRawSync} from 'node:zlib';
import JSZip from 'jszip';
import {auditArabic} from './font-audit.mjs';
import {repositories,libraryArchives,directFonts} from './curated-font-sources.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),cache=path.join(root,'.font-cache');
const probe=process.argv.includes('--probe'),catalogPath=path.join(root,'src/data/fonts.json');
const catalog=JSON.parse(await readFile(catalogPath,'utf8')),knownNames=new Set(catalog.fonts.map(f=>f.family.toLowerCase()));
const designs=new Map(),additions=[],rejected=[];
await mkdir(cache,{recursive:true});
for(const entry of catalog.fonts.filter(f=>f.languages.includes('ar'))) {
  const file=entry.files.find(f=>f.variable)||entry.files.find(f=>f.weight===400)||entry.files[0];
  try {designs.set(auditArabic(await readFile(path.join(root,'public',file.path))).fingerprint,entry.family);}catch { /* Earlier families may have intentionally limited coverage. */ }
}
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
async function obtain(url,name,expected,range) {
  const local=path.join(cache,name);
  let data=await readFile(local).catch(()=>null);
  if(!data) {
    if(range) {
      // Fetch only the selected font from the 3 GB collection; verify its exact
      // original bytes below. Never fall back to downloading the entire archive.
      const part=async(a,b)=>{
        const r=await fetch(url,{headers:{Range:`bytes=${a}-${b}`},signal:AbortSignal.timeout(30000)});
        if(r.status!==206){await r.body?.cancel();throw new Error(`Byte ranges unavailable: ${url}`);}
        const bytes=Buffer.from(await r.arrayBuffer());if(bytes.length!==b-a+1)throw new Error('Truncated archive range');return bytes;
      };
      const header=await part(range.offset,range.offset+29);
      if(header.readUInt32LE(0)!==0x04034b50||header.readUInt16LE(8)!==8)throw new Error('Unsupported ZIP member');
      const start=range.offset+30+header.readUInt16LE(26)+header.readUInt16LE(28);
      data=inflateRawSync(await part(start,start+range.compressed-1),{maxOutputLength:32*1024*1024});
    }else {
      const r=await fetch(url,{signal:AbortSignal.timeout(60000),headers:{'User-Agent':'harf-open-font-sync'}});
      if(!r.ok)throw new Error(`HTTP ${r.status}: ${url}`);
      data=Buffer.from(await r.arrayBuffer());
    }
    await writeFile(local,data);
  }
  if(expected&&digest(data)!==expected)throw new Error(`Archive checksum mismatch: ${name}`);
  return data;
}
const noticeName=n=>/^(?:OFL(?:-[\w-]+)?|LICEN[CS]E(?:[_-][\w-]+)?|COPYING(?:\.[\w-]+)?|COPYRIGHT(?:[_-][\w-]+)?|FONTLOG|AUTHORS|CONTRIBUTORS)(?:\.(?:txt|md|rst))?$/i.test(path.posix.basename(n));
function licenseKind(text) {
  if(/GNU AFFERO GENERAL PUBLIC LICENSE/.test(text))return 'AGPL-3.0';
  if(/SIL OPEN FONT LICENSE|SIL Open Font License/.test(text))return 'OFL-1.1';
  if(/Apache License/.test(text))return 'Apache-2.0';
  if(/Bitstream Vera|DejaVu/.test(text))return 'Bitstream';
  if(/CRULP/.test(text)&&/Permission is hereby granted/.test(text))return 'CRULP';
  throw new Error('No recognized redistribution license');
}
async function addArchive(source) {
  const name=source.id||(source.repo?source.repo.replace('/','-'):source.slug);
  const url=source.fileUrl||(source.repo?`https://codeload.github.com/${source.repo}/zip/${source.revision}`:source.archive);
  const bytes=await obtain(url,`${name}-${source.revision||source.sha256}.${source.fileUrl?'ttf':'zip'}`,source.sha256,source.range);
  let zip;
  if(source.fileUrl) {
    const info=auditArabic(bytes);
    // The author distributes these TTFs with the complete license in name ID 13.
    if(!info.license.includes('SIL OPEN FONT LICENSE')||!info.license.includes('PERMISSION & CONDITIONS')||!info.license.includes('DISCLAIMER'))throw new Error(`Incomplete embedded original license: ${name}`);
    zip=new JSZip();zip.file(source.filename,bytes);zip.file('LICENSE.txt',info.license);
  }else zip=await JSZip.loadAsync(bytes);
  const names=Object.keys(zip.files).filter(n=>!zip.files[n].dir&&!n.startsWith('__MACOSX/'));
  if(source.repo&&zip.comment!==source.revision)throw new Error(`Repository revision mismatch: ${name}`);
  const prefix=source.repo?names[0].split('/')[0]+'/':'';
  const licenses=source.repo?[prefix+source.license]:names.filter(n=>/(?:^|\/)(OFL\.txt|LICENSE[^/]*|COPYING[^/]*)$/i.test(n));
  if(!licenses.length||licenses.some(n=>!zip.file(n)))throw new Error(`No original license file: ${name}`);
  const licenseTexts=await Promise.all(licenses.map(n=>zip.file(n).async('string')));
  if(licenseTexts.some(t=>/Apache License/.test(t))&&!licenseTexts.some(t=>/TERMS AND CONDITIONS FOR USE/.test(t)))licenseTexts.push(await readFile(path.join(root,'node_modules/playwright/LICENSE'),'utf8'));
  const kind=licenseKind(licenseTexts.join('\n'));
  const notices=await Promise.all(names.filter(noticeName).map(async n=>{
    const text=await zip.file(n).async('string');
    if(Buffer.byteLength(text)>1024*1024)throw new Error(`Unexpectedly large license notice: ${n}`);
    return `Source member: ${n}\n\n${text}\n`;
  }));
  const revision=source.revision||`${source.version?source.version+'; ':''}sha256:${digest(bytes)}`;
  const writeNotices=async(dir,inputs)=>{
    await mkdir(dir,{recursive:true});
    await writeFile(path.join(dir,'LICENSE.txt'),licenseTexts.join('\n\n'));
    await writeFile(path.join(dir,'UPSTREAM-NOTICES.txt'),notices.join('\n\n')+inputs.map(f=>`Original font: ${f.file}\nCopyright: ${f.info.copyright}\nDesigner: ${f.info.designer}\nLicense metadata: ${f.info.license}\nLicense URL: ${f.info.licenseUrl}\n`).join('\n'));
  };
  let preferredSource;
  const writeSources=async()=>{
    if(kind!=='AGPL-3.0'&&kind!=='CRULP')return [];
    const archiveFile=`font-sources/${name}/${name}-${source.revision}.zip`;
    if(!probe) {
      if(!preferredSource) {
        // Preserve the font vectors, feature data, build files and original
        // licenses byte-for-byte. Reference photographs and publication PDFs
        // are not font build inputs and are not bundled as font software.
        const bundle=new JSZip(),omitted=[];
        for(const file of names) {
          if(/\.(jpe?g|png|webp|gif|pdf)$/i.test(file)){omitted.push(file);continue;}
          bundle.file(file,await zip.file(file).async('nodebuffer'));
        }
        bundle.file('HARF-SOURCE-BUNDLE.txt',`Corresponding font source snapshot\nOriginal: ${url}\nCommit: ${source.revision}\n\nFont sources, build files and original licenses are preserved without edits. Reference graphics and publication PDFs are omitted. Background image references in editor source files may therefore point to images available only in the original repository.\n\nOmitted reference assets:\n${omitted.join('\n')}\n`);
        preferredSource=await bundle.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:6}});
      }
      await mkdir(path.join(root,'public/font-sources',name),{recursive:true});
      await writeFile(path.join(root,'public',archiveFile),preferredSource);
    }
    return [archiveFile];
  };
  const groups=source.fonts||[{files:names.filter(n=>/\.(ttf|otf)$/i.test(n)&&!/Italic|Oblique|BdIt/i.test(n))}];
  const grouped=new Map();
  for(const group of groups)for(const input of group.files) {
    const member=source.repo?prefix+input:input;
    if(!zip.file(member))throw new Error(`Missing font file: ${name}/${input}`);
    const data=await zip.file(member).async('nodebuffer');
    let info;
    try {info=auditArabic(data);}catch(e){rejected.push({source:name,file:input,reason:e.message});continue;}
    if(info.italic&&!source.allowItalic)continue;
    const family=group.family||info.family;
    if(!family)throw new Error(`Missing family name: ${input}`);
    if(!grouped.has(family))grouped.set(family,[]);
    grouped.get(family).push({data,info,file:path.posix.basename(input)});
  }
  for(const [family,inputs] of grouped) {
    if(knownNames.has(family.toLowerCase())) {
      const existing=catalog.fonts.find(f=>f.family.toLowerCase()===family.toLowerCase());
      if(!probe&&existing?.curatedSource===name&&existing.revision===revision) {
        await writeNotices(path.join(root,'public/fonts',existing.id),inputs);
        await writeSources();
      }
      continue;
    }
    const sorted=inputs.sort((a,b)=>Math.abs(a.info.weight-400)-Math.abs(b.info.weight-400));
    const info=sorted[0].info,duplicate=designs.get(info.fingerprint);
    if(duplicate){rejected.push({source:name,family,reason:`same Arabic design as ${duplicate}`});continue;}
    const id=family.toLowerCase().replace(/[^a-z0-9]/g,'');
    if(!id||catalog.fonts.some(f=>f.id===id)||additions.some(f=>f.id===id))throw new Error(`Family id conflict: ${family}`);
    const chosen=[],weights=new Set();
    for(const input of sorted)if(!weights.has(input.info.weight)) {
      chosen.push(input);for(const weight of input.info.weights)weights.add(weight);
      if(input.info.weightRange)break;
    }
    const dir=path.join(root,'public/fonts',id);
    if(!probe) {
      await writeNotices(dir,inputs);
      for(const file of chosen)await writeFile(path.join(dir,file.file),file.data);
    }
    const sourceFiles=await writeSources();
    additions.push({id,family,category:source.category,weights:[...weights].sort((a,b)=>a-b),weightRange:info.weightRange,
      files:chosen.map(f=>({path:`fonts/${id}/${f.file}`,weight:f.info.weight,variable:!!f.info.weightRange})),
      designers:[...new Set(inputs.map(f=>f.info.designer).filter(Boolean))],license:`fonts/${id}/LICENSE.txt`,extraLicenses:[`fonts/${id}/UPSTREAM-NOTICES.txt`],sourceFiles,
      source:'open',sourceUrl:source.sourceUrl||(source.repo?`https://github.com/${source.repo}/tree/${source.revision}`:`https://fontlibrary.org/en/font/${source.slug}`),
      revision,languages:chosen.every(f=>f.info.english)?['ar','en']:['ar'],color:false,
      licenseKind:kind,curatedSource:name,arabicFingerprint:info.fingerprint});
    knownNames.add(family.toLowerCase());designs.set(info.fingerprint,family);
    console.log(`Accepted: ${family} (${chosen.length} files; ${kind})`);
  }
}
// Sequential addition makes duplicate selection deterministic.
for(const source of [...repositories,...libraryArchives,...directFonts])await addArchive(source);
console.log('Rejected:',JSON.stringify(rejected));
console.log(`New distinct Arabic families: ${additions.length}`);
if(!probe) {
  catalog.fonts.push(...additions);catalog.updated=new Date().toISOString().slice(0,10);
  await writeFile(catalogPath,JSON.stringify(catalog,null,2)+'\n');
  console.log(`Arabic total: ${catalog.fonts.filter(f=>f.languages.includes('ar')).length}`);
}
