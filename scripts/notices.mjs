// Preserve upstream notices when distributing a static build.
import { mkdir, readFile, readdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const pkg=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
const seen=new Set();
async function collect(name) {
  if(seen.has(name))return;seen.add(name);
  const dir=path.join(root,'node_modules',name);
  const metadata=JSON.parse(await readFile(path.join(dir,'package.json'),'utf8'));
  const out=path.join(root,'public/notices',name);
  await mkdir(out,{recursive:true});
  for(const file of await readdir(dir)) {
    if(/^(license|copying|notice)(\.|_|$)/i.test(file)) await copyFile(path.join(dir,file),path.join(out,file));
  }
  for(const dependency of Object.keys(metadata.dependencies||{})) await collect(dependency);
}
for(const dependency of Object.keys(pkg.dependencies))await collect(dependency);
await copyFile(path.join(root,'LICENSE'),path.join(root,'public/notices/Harf-LICENSE.txt'));
console.log(`Preserved notices for ${seen.size} runtime packages.`);
