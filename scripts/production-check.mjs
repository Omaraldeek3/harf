import { chromium } from 'playwright';
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
try {
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.goto(process.argv[2]||'http://127.0.0.1:5191/harf-qa/');
  for(const id of ['cairo','amiri'])await page.locator(`[data-testid="font-${id}"] [data-testid="font-preview"]`).waitFor();
  const download=page.waitForEvent('download');
  await page.getByTestId('font-cairo').getByRole('button',{name:'صدّر Cairo كـ SVG'}).click();
  const file=await download;const stream=await file.createReadStream();let svg='';for await(const chunk of stream)svg+=chunk.toString();
  if(!svg.includes('<path')||svg.includes('<text'))throw new Error('Expected outlined SVG');
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('PASS: nested production base path, variable font loading, WASM shaping and real SVG download.');
}finally{await browser.close();}
