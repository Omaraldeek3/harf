// Mirror original, licensed Google Fonts and creator repositories.
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import * as hb from 'harfbuzzjs';
import JSZip from 'jszip';
import { sources } from './open-font-sources.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const headers = { 'User-Agent': 'harf-open-source-font-sync' };
async function get(url, binary = false) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(url, { headers, signal: AbortSignal.timeout(60000) });
      if (!r.ok) throw new Error(`${r.status}: ${url}`);
      return binary ? Buffer.from(await r.arrayBuffer()) : await r.text();
    } catch (e) { if (attempt === 2) throw e; }
  }
}

const catalog = JSON.parse((await get('https://fonts.google.com/metadata/fonts')).replace(/^\)\]\}'\s*/, ''));
const arabicFamilies = catalog.familyMetadataList.filter(f => f.subsets.includes('arabic') && f.isOpenSource);
const latinFamilies = catalog.familyMetadataList.filter(f=>f.subsets.includes('latin')&&!f.subsets.includes('arabic')&&f.isOpenSource&&f.size<3000000)
  .sort((a,b)=>a.popularity-b.popularity||a.family.localeCompare(b.family)).slice(0,200);
const families=[...arabicFamilies,...latinFamilies];
// Resolve a commit once; every mirrored asset comes from the same revision.
const commit = JSON.parse(await get('https://api.github.com/repos/google/fonts/commits/main')).sha;
const tree = JSON.parse(await get(`https://api.github.com/repos/google/fonts/git/trees/${commit}?recursive=1`)).tree;
const entries = [];
const classifiers = { 'Sans Serif': 'عصري', Serif: 'نسخي', Display: 'عرض', Handwriting: 'يدوي', Monospace: 'ثابت' };
const preferred = ['Cairo', 'Amiri', 'Tajawal', 'Alexandria', 'Noto Kufi Arabic', 'IBM Plex Sans Arabic', 'Aref Ruqaa', 'Lemonada', 'Inter', 'Roboto', 'Open Sans', 'Montserrat', 'Poppins', 'Lato', 'Playfair Display', 'Merriweather', 'Manrope', 'DM Sans'];

function inspect(data) {
  const face=new hb.Face(new hb.Blob(Uint8Array.from(data).buffer));
  const chars=new Set(face.collectUnicodes()),languages=[];
  if([0x627,0x628,0x645].every(c=>chars.has(c)))languages.push('ar');
  if(Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789').every(c=>chars.has(c.codePointAt(0))))languages.push('en');
  const axis=face.getAxisInfos().wght,os2=face.referenceTable('OS/2');
  const weight=os2?.length>=6?new DataView(os2.buffer,os2.byteOffset,os2.byteLength).getUint16(4):400;
  return {languages,weight:weight||400,axis};
}

async function sync(family) {
  const id = family.family.toLowerCase().replace(/[^a-z0-9]/g, '');
  const metadataPath = tree.find(t => ['ofl','apache','ufl'].some(folder=>t.path===`${folder}/${id}/METADATA.pb`))?.path;
  if (!metadataPath) throw new Error(`Cannot locate official metadata for ${family.family}`);
  const dir = path.posix.dirname(metadataPath);
  const raw = `https://raw.githubusercontent.com/google/fonts/${commit}/${dir}`;
  const metadata = await get(`${raw}/METADATA.pb`);
  const faces = [...metadata.matchAll(/fonts\s*\{([\s\S]*?)\n\}/g)].map(m => ({
    style: /style:\s*"([^"]+)"/.exec(m[1])?.[1],
    weight: Number(/weight:\s*(\d+)/.exec(m[1])?.[1]),
    file: /filename:\s*"([^"]+)"/.exec(m[1])?.[1],
  })).filter(f => f.style === 'normal' && f.file && !/Italic/i.test(f.file));
  if (!faces.length) throw new Error(`No upright font: ${family.family}`);
  const licensePath = tree.find(t => ['OFL.txt','LICENSE.txt','UFL.txt'].some(name=>t.path===`${dir}/${name}`))?.path;
  if (!licensePath) throw new Error(`Missing license: ${family.family}`);
  const outDir = path.join(root, 'public/fonts', id);
  await mkdir(outDir, { recursive: true });
  const licenseName = path.posix.basename(licensePath);
  await writeFile(path.join(outDir, licenseName), await get(`https://raw.githubusercontent.com/google/fonts/${commit}/${licensePath}`));
  const files = [];
  for (const face of faces) {
    const target = path.join(outDir, face.file);
    // Reuse only bytes that came from this pinned revision.
    const existing = await readFile(path.join(outDir, '.revision'), 'utf8').catch(() => '');
    if (existing !== commit || !(await readFile(target).catch(() => null))) {
      await writeFile(target, await get(`${raw}/${encodeURIComponent(face.file)}`, true));
    }
    files.push({ path: `fonts/${id}/${face.file}`, weight: face.weight, variable: face.file.includes('[') });
  }
  await writeFile(path.join(outDir, '.revision'), commit);
  const hasVariable = files.some(f => f.variable);
  const weights = hasVariable
    ? Object.keys(family.fonts).filter(w => /^\d+$/.test(w)).map(Number)
    : [...new Set(files.map(f => f.weight))];
  const axis = family.axes.find(a => a.tag === 'wght');
  const supported=inspect(await readFile(path.join(root,'public',files[0].path))).languages;
  const required=family.subsets.includes('arabic')?'ar':'en';
  if(!supported.includes(required))throw new Error(`Actual character coverage mismatch: ${family.family} (${required})`);
  const entry = { id, family: family.family, category: classifiers[family.category] || 'عرض', weights: weights.sort((a,b)=>a-b), files,
    weightRange: hasVariable && axis ? [axis.min, axis.max] : null,
    designers: family.designers, license: `fonts/${id}/${licenseName}`, source: 'google', languages:supported,
    sourceUrl:`https://github.com/google/fonts/tree/${commit}/${dir}`,revision:commit,
    color: !!family.colorCapabilities?.length };
  entries.push(entry);
  console.log(`✓ ${family.family} (${files.length} files)`);
}

const repoRevisions=new Map();
async function syncOpen(source) {
  const {family,repo}=source,id=family.toLowerCase().replace(/[^a-z0-9]/g,'');
  if(entries.some(f=>f.id===id))throw new Error(`Duplicate family: ${family}`);
  if(!repoRevisions.has(repo))repoRevisions.set(repo,JSON.parse(await get(`https://api.github.com/repos/${repo}/commits/HEAD`)).sha);
  const revision=repoRevisions.get(repo);if(!revision)throw new Error(`Missing revision: ${repo}`);
  const raw=`https://raw.githubusercontent.com/${repo}/${revision}/`,outDir=path.join(root,'public/fonts',id);
  await mkdir(outDir,{recursive:true});
  const license=await get(raw+source.license);
  if(!/Open Font License|Bitstream Vera Fonts|Apache License/i.test(license))throw new Error(`Unrecognized license: ${family}`);
  const licenseName=path.posix.basename(source.license);
  await writeFile(path.join(outDir,licenseName),license);
  const extraLicenses=[];
  if(/Apache License/i.test(license)) {
    const notice='Apache-2.0.txt';
    await writeFile(path.join(outDir,notice),await readFile(path.join(root,'node_modules/playwright/LICENSE')));
    extraLicenses.push(`fonts/${id}/${notice}`);
  }
  const inputs=[];
  if(source.archive) {
    const zip=await JSZip.loadAsync(await get(source.archive,true));
    for(const [name,file] of Object.entries(zip.files))if(!file.dir&&/\.(otf|ttf)$/i.test(name)&&!/Italic/i.test(name))inputs.push({name:path.posix.basename(name),data:await file.async('nodebuffer')});
  }else {
    for(const file of source.files) {
      const name=path.posix.basename(file),target=path.join(outDir,name);
      const old=await readFile(path.join(outDir,'.revision'),'utf8').catch(()=>'');
      const data=old===revision?await readFile(target).catch(()=>null):null;
      inputs.push({name,data:data||await get(raw+file.split('/').map(encodeURIComponent).join('/'),true)});
    }
  }
  const files=[],weights=new Set();let weightRange=null,languages=null;
  for(const input of inputs) {
    const info=inspect(input.data);
    if(!info.languages.includes('ar'))throw new Error(`Arabic coverage missing: ${family}`);
    languages=languages?languages.filter(l=>info.languages.includes(l)):info.languages;
    await writeFile(path.join(outDir,input.name),input.data);
    if(info.axis) {
      weightRange=[info.axis.min,info.axis.max];
      for(const w of [info.axis.min,100,200,300,400,500,600,700,800,900,info.axis.max])if(w>=info.axis.min&&w<=info.axis.max)weights.add(w);
    }else weights.add(info.weight);
    files.push({path:`fonts/${id}/${input.name}`,weight:info.weight,variable:!!info.axis});
  }
  if(!files.length)throw new Error(`No compiled fonts: ${family}`);
  await writeFile(path.join(outDir,'.revision'),revision);
  entries.push({id,family,category:source.category,weights:[...weights].sort((a,b)=>a-b),files,weightRange,designers:[],license:`fonts/${id}/${licenseName}`,extraLicenses,
    languages,source:'open',sourceUrl:`https://github.com/${repo}`,revision,color:false});
  console.log(`✓ ${family} (independent, ${files.length} files)`);
}

// Small worker pool avoids overloading the source.
let cursor = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
  while (cursor < families.length) await sync(families[cursor++]);
}));
for(const source of sources)await syncOpen(source);
entries.sort((a,b) => {
  const ai=preferred.indexOf(a.family), bi=preferred.indexOf(b.family);
  return (ai<0 ? 1000 : ai) - (bi<0 ? 1000 : bi) || a.family.localeCompare(b.family);
});
await mkdir(path.join(root, 'src/data'), { recursive: true });
await writeFile(path.join(root, 'src/data/fonts.json'), JSON.stringify({ updated: new Date().toISOString().slice(0,10), commit, fonts: entries }, null, 2)+'\n');
console.log(`Complete: ${entries.length} unique families; Arabic ${entries.filter(f=>f.languages.includes('ar')).length}; English ${entries.filter(f=>f.languages.includes('en')).length}.`);
