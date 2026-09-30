import { test, expect } from '@playwright/test';
import catalog from '../src/data/fonts.json' with {type:'json'};
test('search, editing, favorites and comparison work together',async({page})=>{
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'لكلّ كلمة، خطٌّ يليق بها.'})).toBeVisible();
  await page.getByLabel('النص الذي تريد معاينته').fill('تصميم عربي جميل');
  await page.getByLabel('ابحث عن خط').fill('Cairo');
  const card=page.getByTestId('font-cairo');
  await expect(card.getByTestId('font-preview')).toHaveText('تصميم عربي جميل');
  await card.getByRole('button',{name:'أضف Cairo إلى المفضلة',exact:true}).click();
  await card.getByRole('button',{name:'قارن Cairo',exact:true}).click();
  await page.getByLabel('ابحث عن خط').fill('Amiri');
  await page.getByTestId('font-amiri').getByRole('button',{name:'قارن Amiri',exact:true}).click();
  await page.getByRole('button',{name:'افتح المقارنة'}).click();
  await expect(page.getByRole('dialog',{name:'مقارنة الخطوط'})).toBeVisible();
  await expect(page.getByRole('dialog').getByTestId('font-preview')).toHaveCount(2);
  await page.keyboard.press('Escape');
  await page.reload();
  await page.getByRole('button',{name:'المفضلة',exact:true}).click();
  await expect(page.getByTestId('font-cairo')).toBeVisible();
  await expect(page.locator('article.font-card')).toHaveCount(1);
});
test('exports actual paths and downloads a licensed font archive',async({page})=>{
  await page.goto('/');
  const card=page.getByTestId('font-amiri');
  await expect(card.getByRole('button',{name:'صدّر Amiri كـ SVG'})).toBeEnabled({timeout:30000});
  const event=page.waitForEvent('download');
  await card.getByRole('button',{name:'صدّر Amiri كـ SVG'}).click();
  const file=await event;
  expect(file.suggestedFilename()).toContain('.svg');
  const stream=await file.createReadStream();let svg='';for await(const chunk of stream!)svg+=chunk.toString();
  expect(svg).toContain('<path');expect(svg).not.toContain('<text');
  const archiveEvent=page.waitForEvent('download');
  await card.getByRole('button',{name:'نزّل عائلة Amiri'}).click();
  const archive=await archiveEvent;expect(archive.suggestedFilename()).toContain('.zip');
  const archiveStream=await archive.createReadStream();const chunks:Buffer[]=[];for await(const chunk of archiveStream!)chunks.push(Buffer.from(chunk));
  const {default:JSZip}=await import('jszip');const zip=await JSZip.loadAsync(Buffer.concat(chunks));
  expect(Object.keys(zip.files)).toContain('OFL.txt');expect(Object.keys(zip.files)).toContain('Amiri-Regular.ttf');
});
test('every bundled family loads successfully in the browser',async({page})=>{
  test.setTimeout(120000);await page.goto('/');
  for(const font of catalog.fonts.filter(f=>f.languages.includes('ar'))) {
    const card=page.getByTestId(`font-${font.id}`);await card.scrollIntoViewIfNeeded();
    await expect(card.getByTestId('font-preview')).toBeVisible({timeout:15000});
  }
});
test('English section preserves its own text, LTR direction and outlined export',async({page})=>{
  await page.goto('/');await page.getByLabel('النص الذي تريد معاينته').fill('كلماتي العربية');
  await page.getByRole('button',{name:'الخطوط الإنجليزية',exact:true}).click();
  await page.getByLabel('ابحث عن خط').fill('Inter');const card=page.getByTestId('font-inter');
  await expect(card.getByTestId('font-preview')).toBeVisible();
  await expect(card.getByTestId('font-preview')).toHaveAttribute('dir','ltr');
  await page.getByLabel('النص الذي تريد معاينته').fill('Hello 2026!');
  await expect(card.getByRole('button',{name:'صدّر Inter كـ SVG'})).toBeEnabled();
  const event=page.waitForEvent('download');await card.getByRole('button',{name:'صدّر Inter كـ SVG'}).click();
  const file=await event;const stream=await file.createReadStream();let svg='';for await(const chunk of stream!)svg+=chunk.toString();
  expect(svg).toContain('<path');expect(svg).toContain('Hello 2026!');expect(svg).not.toContain('<text');
  await page.getByRole('button',{name:'الخطوط العربية',exact:true}).click();
  await expect(page.getByLabel('النص الذي تريد معاينته')).toHaveValue('كلماتي العربية');
  await page.getByRole('button',{name:'الخطوط الإنجليزية',exact:true}).click();
  await expect(page.getByLabel('النص الذي تريد معاينته')).toHaveValue('Hello 2026!');
});
test('language sections and modal feedback keep their layout without reduced motion',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});await page.goto('/');
  expect(await page.locator('.language-switch').evaluate(e=>getComputedStyle(e).display)).toBe('grid');
  await page.getByTestId('font-cairo').getByRole('button',{name:'قارن Cairo',exact:true}).click();
  await page.getByTestId('font-amiri').getByRole('button',{name:'قارن Amiri',exact:true}).click();
  await page.getByRole('button',{name:'افتح المقارنة'}).click();
  const dialog=page.getByRole('dialog',{name:'مقارنة الخطوط'});
  expect(await dialog.locator('[role="status"]').evaluate(e=>getComputedStyle(e).position)).toBe('static');
});
test('importing an English-only font selects the English local section',async({page})=>{
  await page.goto('/');
  const inter=catalog.fonts.find(f=>f.id==='inter')!;
  await page.getByLabel('استيراد ملفات الخطوط').setInputFiles(`public/${inter.files[0].path}`);
  await expect(page.getByRole('button',{name:'الخطوط الإنجليزية',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('article.font-card')).toHaveCount(1);
  await expect(page.locator('article.font-card').getByTestId('font-preview')).toHaveAttribute('dir','ltr');
});
test('English families all load without changing the Arabic interface direction',async({page})=>{
  test.setTimeout(180000);await page.goto('/');await page.getByRole('button',{name:'الخطوط الإنجليزية',exact:true}).click();
  await expect(page.locator('html')).toHaveAttribute('dir','rtl');
  for(const font of catalog.fonts.filter(f=>f.languages.includes('en'))) {
    const card=page.getByTestId(`font-${font.id}`);await card.scrollIntoViewIfNeeded();
    await expect(card.getByTestId('font-preview')).toBeVisible({timeout:15000});
  }
});
test('independent Arabic families download with their original license and source',async({page})=>{
  await page.goto('/');await page.getByLabel('ابحث عن خط').fill('Shabnam');
  const card=page.getByTestId('font-shabnam');await expect(card.getByTestId('font-preview')).toBeVisible();
  const event=page.waitForEvent('download');await card.getByRole('button',{name:'نزّل عائلة Shabnam'}).click();
  const file=await event;const stream=await file.createReadStream();const chunks:Buffer[]=[];for await(const chunk of stream!)chunks.push(Buffer.from(chunk));
  const {default:JSZip}=await import('jszip');const zip=await JSZip.loadAsync(Buffer.concat(chunks));
  expect(Object.keys(zip.files)).toContain('LICENSE');expect(Object.keys(zip.files)).toContain('Apache-2.0.txt');
  expect(await zip.file('SOURCE.txt')!.async('string')).toContain('rastikerdar/shabnam-font');
});
test('classic Arabic family includes full notices and corresponding source in downloads',async({page})=>{
  await page.goto('/');await page.getByLabel('ابحث عن خط').fill('AlArabiya');
  const card=page.getByTestId('font-alarabiya');await expect(card.getByTestId('font-preview')).toBeVisible();
  const event=page.waitForEvent('download');await card.getByRole('button',{name:'نزّل عائلة AlArabiya'}).click();
  const file=await event;const stream=await file.createReadStream();const chunks:Buffer[]=[];for await(const chunk of stream!)chunks.push(Buffer.from(chunk));
  const {default:JSZip}=await import('jszip');const zip=await JSZip.loadAsync(Buffer.concat(chunks));
  expect(Object.keys(zip.files)).toContain('COPYRIGHT.txt');
  expect(Object.keys(zip.files)).toContain('fonts-arabeyes_2.1.orig.tar.xz');
  expect(await zip.file('UPSTREAM-NOTICES.txt')!.async('string')).toContain('special exception');
});

test('copyleft creator fonts export notices and download editable source',async({page})=>{
  await page.goto('/');await page.getByLabel('النص الذي تريد معاينته').fill('حرف');
  await page.getByLabel('ابحث عن خط').fill('Raqq');const card=page.getByTestId('font-raqq');
  await expect(card.getByRole('button',{name:'صدّر Raqq كـ SVG',exact:true})).toBeEnabled();
  const svgEvent=page.waitForEvent('download');await card.getByRole('button',{name:'صدّر Raqq كـ SVG',exact:true}).click();
  const svgStream=await(await svgEvent).createReadStream();let svg='';for await(const chunk of svgStream!)svg+=chunk.toString();
  expect(svg).toContain('<path');expect(svg).toContain('<metadata>');expect(svg).toContain('GNU AFFERO GENERAL PUBLIC LICENSE');
  expect(svg).toContain('aliftype/raqq/tree/');expect(svg).not.toContain('<text');
  expect(await page.evaluate(xml=>new DOMParser().parseFromString(xml,'image/svg+xml').querySelector('parsererror')===null,svg)).toBe(true);
  const event=page.waitForEvent('download');await card.getByRole('button',{name:'نزّل عائلة Raqq',exact:true}).click();
  const stream=await(await event).createReadStream();const chunks:Buffer[]=[];for await(const chunk of stream!)chunks.push(Buffer.from(chunk));
  const {default:JSZip}=await import('jszip');const zip=await JSZip.loadAsync(Buffer.concat(chunks));
  expect(Object.keys(zip.files)).toContain('LICENSE.txt');expect(Object.keys(zip.files)).toContain('UPSTREAM-NOTICES.txt');
  const archive=Object.keys(zip.files).find(n=>/^aliftype-raqq-.*\.zip$/.test(n))!;
  const original=await JSZip.loadAsync(await zip.file(archive)!.async('nodebuffer'));
  expect(Object.keys(original.files).some(n=>/\.glyphspackage\/glyphs\/.*\.glyph$/.test(n))).toBe(true);
  await page.getByLabel('ابحث عن خط').fill('Astrolabe');
  const nextEvent=page.waitForEvent('download');
  await page.getByTestId('font-astrolabe').getByRole('button',{name:'صدّر Astrolabe كـ SVG',exact:true}).click();
  const nextStream=await(await nextEvent).createReadStream();let nextSvg='';for await(const chunk of nextStream!)nextSvg+=chunk.toString();
  expect(nextSvg).toContain('GNU AFFERO GENERAL PUBLIC LICENSE');
  expect(Buffer.byteLength(nextSvg)).toBeLessThan(1024*1024);
  expect(nextSvg).not.toMatch(/Source member: .*\.jpg/);
});

test('new variable, display and pan-Unicode families export actual Arabic paths',async({page})=>{
  await page.goto('/');await page.getByLabel('النص الذي تريد معاينته').fill('حرف');
  for(const id of ['mikhak','layladigital','kurintosans']) {
    const entry=catalog.fonts.find(f=>f.id===id)!;await page.getByLabel('ابحث عن خط').fill(entry.family);
    const card=page.getByTestId(`font-${id}`),button=card.getByRole('button',{name:`صدّر ${entry.family} كـ SVG`,exact:true});
    await expect(button).toBeEnabled();const event=page.waitForEvent('download');await button.click();
    const stream=await(await event).createReadStream();let svg='';for await(const chunk of stream!)svg+=chunk.toString();
    expect(svg).toContain('<path');expect(svg).not.toMatch(/NaN|undefined/);
  }
});
test('a failed font request can be retried',async({page})=>{
  let blocked=true;
  await page.route('**/fonts/cairo/*',route=>blocked?route.abort():route.continue());
  await page.goto('/');const card=page.getByTestId('font-cairo');
  await expect(card.getByRole('button',{name:'أعد المحاولة'})).toBeVisible();
  blocked=false;await card.getByRole('button',{name:'أعد المحاولة'}).click();
  await expect(card.getByTestId('font-preview')).toBeVisible();
});
test('unsupported characters block misleading SVG export',async({page})=>{
  await page.goto('/');await page.getByLabel('النص الذي تريد معاينته').fill('حرف 🦄');
  const card=page.getByTestId('font-amiri');
  await expect(card.getByText('بعض الأحرف غير متاحة في هذا الخط')).toBeVisible();
  await expect(card.getByRole('button',{name:'صدّر Amiri كـ SVG'})).toBeDisabled();
});
test('valid font upload stays local and a denied font permission recovers',async({page})=>{
  await page.setViewportSize({width:1280,height:600});
  await page.addInitScript(()=>Object.defineProperty(window,'queryLocalFonts',{value:async()=>{throw new DOMException('denied','NotAllowedError');},configurable:true}));
  await page.goto('/');await page.getByRole('button',{name:'اكتشف خطوط جهازك',exact:true}).click();
  await expect(page.locator('[role="status"]')).toContainText('لم يسمح');
  await page.getByLabel('استيراد ملفات الخطوط').setInputFiles('public/fonts/amiri/Amiri-Regular.ttf');
  await expect(page.locator('article.font-card')).toHaveCount(1);
  await expect(page.locator('article.font-card').getByTestId('font-preview')).toBeVisible();
  await expect(page.locator('article.font-card').getByRole('button',{name:'صدّر Amiri-Regular كـ SVG'})).toBeEnabled();
});
test('WOFF2 import supports the same real path exporter',async({page})=>{
  await page.goto('/');await page.getByLabel('النص الذي تريد معاينته').fill('حرف');
  await page.getByLabel('استيراد ملفات الخطوط').setInputFiles('tests/fixtures/Amiri-Arabic.woff2');
  await expect(page.locator('article.font-card')).toHaveCount(1);
  await expect(page.locator('article.font-card').getByTestId('font-preview')).toBeVisible();
  await expect(page.locator('article.font-card').getByRole('button',{name:'صدّر Amiri-Arabic كـ SVG'})).toBeEnabled();
});
test('composition supported by the shaper does not block export',async({page})=>{
  await page.goto('/');await page.getByLabel('النص الذي تريد معاينته').fill('حرف Ḥarf');
  await page.getByLabel('ابحث عن خط').fill('Lemonada');const card=page.getByTestId('font-lemonada');
  await expect(card.getByRole('button',{name:'صدّر Lemonada كـ SVG'})).toBeEnabled();
});
test('comparison modal exposes download failure feedback',async({page})=>{
  await page.route('**/fonts/amiri/OFL.txt',route=>route.abort());
  await page.goto('/');
  await page.getByTestId('font-cairo').getByRole('button',{name:'قارن Cairo',exact:true}).click();
  await page.getByTestId('font-amiri').getByRole('button',{name:'قارن Amiri',exact:true}).click();
  await page.getByRole('button',{name:'افتح المقارنة'}).click();
  const dialog=page.getByRole('dialog',{name:'مقارنة الخطوط'});
  await dialog.getByRole('button',{name:'نزّل عائلة Amiri'}).click();
  await expect(dialog.locator('[role="status"]')).toBeVisible();
  await expect(dialog.locator('[role="status"]')).not.toContainText('جارٍ');
});
test('malformed preferences and invalid imports recover safely',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('harf-favorites','invalid json'));
  await page.addInitScript(()=>Object.defineProperty(window,'queryLocalFonts',{value:undefined,configurable:true}));
  await page.goto('/');
  await page.getByLabel('استيراد ملفات الخطوط').setInputFiles({name:'broken.ttf',mimeType:'font/ttf',buffer:Buffer.from('invalid')});
  await expect(page.locator('[role="status"]')).toContainText('غير صالح');
  await page.getByRole('button',{name:'خطوط الجهاز',exact:true}).click();
  await page.getByRole('button',{name:'اكتشف خطوط جهازك',exact:true}).click();
  await expect(page.locator('[role="status"]')).toContainText('لا يدعم');
  await expect(page.getByRole('button',{name:'أو استورد ملف خط',exact:false})).toBeVisible();
});
test('mobile has no horizontal overflow and exposes controls',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  await expect(page.getByLabel('النص الذي تريد معاينته')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
test('dark mode changes page background and inherited text contrast',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'فعّل الوضع الداكن'}).click();
  expect(await page.evaluate(()=>getComputedStyle(document.documentElement).backgroundColor)).toBe('rgb(22, 31, 27)');
  expect(await page.evaluate(()=>getComputedStyle(document.documentElement).color)).toBe('rgb(238, 234, 221)');
  await page.reload();await expect(page.getByRole('button',{name:'فعّل الوضع الفاتح'})).toBeVisible();
});
