import { expect, it } from 'vitest';
import { fontsForLanguage, textDirection } from '../src/lib/languages';
import type { FontEntry } from '../src/lib/fonts';
it('separates Arabic and English while retaining bilingual fonts in both sections',()=>{
  const fonts=[{id:'ar',languages:['ar']},{id:'en',languages:['en']},{id:'both',languages:['ar','en']}] as unknown as FontEntry[];
  expect(fontsForLanguage(fonts,'ar').map(f=>f.id)).toEqual(['ar','both']);
  expect(fontsForLanguage(fonts,'en').map(f=>f.id)).toEqual(['en','both']);
  expect(textDirection('en')).toBe('ltr');expect(textDirection('ar')).toBe('rtl');
});
