import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
for(const script of ['sync-fonts.mjs','sync-distribution-fonts.mjs','sync-curated-fonts.mjs'])execFileSync(process.execPath,[`scripts/${script}`],{cwd:root,stdio:'inherit'});
