import type { FontEntry } from './fonts';
export type Language='ar'|'en';
export function fontsForLanguage(fonts:FontEntry[],language:Language):FontEntry[] {
  const matches=fonts.filter(f=>(f.languages||['ar']).includes(language));
  return language==='en'?matches.sort((a,b)=>Number(a.languages?.includes('ar'))-Number(b.languages?.includes('ar'))):matches;
}
export function textDirection(language:Language):'rtl'|'ltr' {return language==='ar'?'rtl':'ltr';}
export function categoryLabel(category:string,language:Language) {return language==='en'&&category==='نسخي'?'كلاسيكي':category;}
