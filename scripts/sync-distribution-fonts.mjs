import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import * as hb from 'harfbuzzjs';
import {distributions} from './debian-font-sources.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),cache=path.join(root,'.font-cache');
await mkdir(cache,{recursive:true});
const probe=process.argv.includes('--probe');
async function obtain(url,local) {
  let bytes=await readFile(local).catch(()=>null);
  if(!bytes){const r=await fetch(url,{signal:AbortSignal.timeout(60000)});if(!r.ok)throw new Error(`HTTP ${r.status}: ${url}`);bytes=Buffer.from(await r.arrayBuffer());await writeFile(local,bytes);}
  return bytes;
}
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const tar=process.platform==='win32'?path.join(process.env.SystemRoot||'C:\\Windows','System32','tar.exe'):'tar';
function list(archive){return execFileSync(tar,['-tf',path.relative(root,archive)],{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024}).trim().split(/\r?\n/);}
function extract(archive,name){return execFileSync(tar,['-xOf',path.relative(root,archive),name],{cwd:root,maxBuffer:64*1024*1024});}
const catalog=JSON.parse(await readFile(path.join(root,'src/data/fonts.json'),'utf8'));
const knownNames=new Set(catalog.fonts.map(f=>f.family.toLowerCase()));
const knownHashes=new Set();
for(const f of catalog.fonts)for(const file of f.files)knownHashes.add(sha(await readFile(path.join(root,'public',file.path))));
const additions=[],rejections=[];
for(const config of distributions) {
  const sourcePackage=config.sourcePackage||config.package,sourceVersion=config.sourceVersion||config.version;
  const base=`https://deb.debian.org/debian/pool/main/${sourcePackage[0]}/${sourcePackage}/`;
  const binary=`${config.package}_${config.version}_all.deb`;
  const archive=path.join(cache,binary),binaryBytes=await obtain(base+encodeURIComponent(binary),archive);
  const member=list(archive).find(n=>/^data\.tar\./.test(n));if(!member)throw new Error(`No data archive: ${binary}`);
  const dataArchive=path.join(cache,`${config.package}-${member}`);
  await writeFile(dataArchive,extract(archive,member));
  const names=list(dataArchive),copyrightFile=names.find(n=>n.endsWith(`/doc/${config.package}/copyright`));
  if(!copyrightFile)throw new Error(`Missing original copyright: ${binary}`);
  const copyright=extract(dataArchive,copyrightFile).toString('utf8');
  console.log(`\n${config.package}: ${copyright.slice(0,550).replaceAll('\n',' ')}; font-exception=${/exception|resulting document|does not.*document/is.test(copyright)}`);
  const grouped=new Map();
  for(const name of names.filter(n=>/\.(ttf|otf)$/i.test(n))) {
    const bytes=extract(dataArchive,name),hash=sha(bytes);
    if(knownHashes.has(hash))continue;
    const face=new hb.Face(new hb.Blob(Uint8Array.from(bytes).buffer)),font=new hb.Font(face);
    const chars=new Set(face.collectUnicodes());
    if(![0x627,0x628,0x645].every(c=>chars.has(c)))continue;
    const os2=face.referenceTable('OS/2'),os2View=os2?new DataView(os2.buffer,os2.byteOffset,os2.byteLength):null;
    if(os2View&&os2.length>=64&&(os2View.getUint16(62)&1))continue; // italic faces
    let family=face.getName(16,'en')||face.getName(1,'en');
    if(!family)family=path.posix.basename(name).replace(/\.(otf|ttf)$/i,'');
    // These language-localized faces share the same base Arabic design.
    if(/^PakType Naskh Basic (Farsi|SA|Sindhi|Urdu)$/i.test(family))continue;
    if(knownNames.has(family.toLowerCase()))continue;
    const buffer=new hb.Buffer();buffer.addText('العربية في الحروف حياة');buffer.guessSegmentProperties();hb.shape(font,buffer);
    const glyphs=buffer.getGlyphInfosAndPositions();
    if(glyphs.some(g=>g.codepoint===0)||!glyphs.some(g=>font.glyphToPath(g.codepoint))) {rejections.push({family,reason:'missing glyphs or outlines'});continue;}
    // Prove contextual Arabic joining. Glyph sequences for the two beys must differ.
    const pair=new hb.Buffer();pair.addText('بب');pair.guessSegmentProperties();hb.shape(font,pair);
    if(pair.getGlyphInfos().every(g=>g.codepoint===font.nominalGlyph(0x628))) {rejections.push({family,reason:'no Arabic joining'});continue;}
    const weight=os2View&&os2.length>=6?os2View.getUint16(4):400;
    const english=Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789').every(c=>chars.has(c.codePointAt(0)));
    const record={name:path.posix.basename(name),bytes,hash,weight:Math.max(1,Math.min(1000,weight||400)),english};
    if(!grouped.has(family))grouped.set(family,[]);
    grouped.get(family).push(record);knownHashes.add(hash);
  }
  console.log(`Accepted ${grouped.size} families: ${[...grouped.keys()].join(', ')}`);
  if(probe)continue;
  if(!grouped.size)continue;
  const sourceDir=path.join(root,'public/font-sources',config.package);await mkdir(sourceDir,{recursive:true});
  const dscName=`${sourcePackage}_${sourceVersion}.dsc`;
  const dsc=(await obtain(base+encodeURIComponent(dscName),path.join(cache,dscName))).toString('utf8');
  const block=/Checksums-Sha256:\n((?: [^\n]+\n)+)/.exec(dsc)?.[1];if(!block)throw new Error(`No source checksums: ${dscName}`);
  const sourceFiles=[];
  for(const line of block.trim().split('\n')) {
    const [expected,size,name]=line.trim().split(/\s+/);
    if(!/^[a-f0-9]{64}$/.test(expected)||name.includes('/')||name.includes('..'))throw new Error('Unsafe source descriptor');
    const bytes=await obtain(base+encodeURIComponent(name),path.join(cache,name));
    if(sha(bytes)!==expected||bytes.length!==Number(size))throw new Error(`Source checksum mismatch: ${name}`);
    await copyFile(path.join(cache,name),path.join(sourceDir,name));sourceFiles.push(`font-sources/${config.package}/${name}`);
  }
  await writeFile(path.join(sourceDir,dscName),dsc);sourceFiles.push(`font-sources/${config.package}/${dscName}`);
  // Preserve upstream embedding exceptions and complete licenses verbatim.
  const upstreamNotices=[];
  for(const archivePath of sourceFiles.filter(f=>/\.tar\./.test(f))) {
    const archive=path.join(root,'public',archivePath);
    for(const name of list(archive).filter(n=>/(?:^|\/)(README(?:\.[\w-]+)?|COPYING[^/]*|LICEN[CS]E[^/]*|OFL[^/]*|Copyright|AUTHORS[^/]*)$/i.test(n)&&!n.endsWith('/'))) {
      const notice=extract(archive,name);
      if(notice.length<1024*1024)upstreamNotices.push(`Source member: ${name}\n\n${notice.toString('utf8')}\n`);
    }
  }
  const noticesName='UPSTREAM-NOTICES.txt';
  await writeFile(path.join(sourceDir,noticesName),upstreamNotices.join('\n\n'));
  sourceFiles.push(`font-sources/${config.package}/${noticesName}`);
  for(const [family,inputs] of grouped) {
    const id=family.toLowerCase().replace(/[^a-z0-9]/g,'');
    if(!id||catalog.fonts.some(f=>f.id===id)||additions.some(f=>f.id===id)) {rejections.push({family,reason:'duplicate family id'});continue;}
    const dir=path.join(root,'public/fonts',id);await mkdir(dir,{recursive:true});
    await writeFile(path.join(dir,'COPYRIGHT.txt'),copyright);
    const fullLicenses=[]; // Complete originals are in UPSTREAM-NOTICES and source archives.
    const files=[];
    // One upright file per weight; format duplicates do not inflate counts.
    const usedWeights=new Set();
    for(const input of inputs)if(!usedWeights.has(input.weight)) {
      usedWeights.add(input.weight);await writeFile(path.join(dir,input.name),input.bytes);
      files.push({path:`fonts/${id}/${input.name}`,weight:input.weight,variable:false});
    }
    additions.push({id,family,category:config.category,weights:[...usedWeights].sort((a,b)=>a-b),weightRange:null,files,designers:[],
      license:`fonts/${id}/COPYRIGHT.txt`,extraLicenses:fullLicenses,sourceFiles,source:'open',sourceUrl:`https://packages.debian.org/${config.package}`,
      revision:`${config.version}; sha256:${sha(binaryBytes)}`,languages:inputs.every(f=>f.english)?['ar','en']:['ar'],color:false,collection:config.package});
    knownNames.add(family.toLowerCase());
  }
}
console.log('Rejected:',JSON.stringify(rejections));
if(!probe) {
  catalog.fonts.push(...additions);catalog.updated=new Date().toISOString().slice(0,10);
  await writeFile(path.join(root,'src/data/fonts.json'),JSON.stringify(catalog,null,2)+'\n');
  console.log(`Added ${additions.length}; Arabic total ${catalog.fonts.filter(f=>f.languages.includes('ar')).length}.`);
}
