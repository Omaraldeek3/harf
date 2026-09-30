import JSZip from 'jszip';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const zip=new JSZip();
const excluded=new Set(['node_modules','dist','test-results','playwright-report','.font-cache','.git']);
let files=0;
async function collect(dir,relative='') {
  for(const entry of await readdir(dir,{withFileTypes:true})) {
    if(excluded.has(entry.name)||entry.name.endsWith('.tsbuildinfo')||entry.name.endsWith('.log'))continue;
    const name=path.posix.join(relative,entry.name),local=path.join(dir,entry.name);
    if(entry.isDirectory())await collect(local,name);
    else {zip.file(name,await readFile(local));files++;}
  }
}
await collect(root);
const target=fileURLToPath(new URL('../../harf-source.zip',import.meta.url));
await writeFile(target,await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:6}}));
console.log(`Source archive: ${target} (${files} files, dependencies and build output excluded).`);
