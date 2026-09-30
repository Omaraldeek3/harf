// Optional maintenance utility. Tests consume the checked-in binary, not the network.
import { writeFile } from 'node:fs/promises';
const url='https://fonts.gstatic.com/s/amiri/v30/J7aRnpd8CGxBHpUrtLMA7w.woff2';
const response=await fetch(url,{signal:AbortSignal.timeout(30000)});
if(!response.ok)throw new Error(`HTTP ${response.status}`);
const bytes=Buffer.from(await response.arrayBuffer());
if(bytes.toString('ascii',0,4)!=='wOF2')throw new Error('Not a WOFF2 font');
await writeFile(new URL('../tests/fixtures/Amiri-Arabic.woff2',import.meta.url),bytes);
console.log(`Saved official WOFF2 fixture: ${bytes.length} bytes.`);
