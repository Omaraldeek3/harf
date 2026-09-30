import type { CSSProperties } from 'react';
export type IconName='search'|'heart'|'plus'|'download'|'vector'|'sun'|'moon'|'close'|'arrow'|'grid'|'check'|'folder'|'info'|'compare'|'right'|'center'|'left';
const paths:Record<IconName,React.ReactNode>={
  search:<><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></>,
  heart:<path d="M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 22l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>,
  plus:<path d="M12 5v14M5 12h14"/>,download:<><path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4"/></>,
  vector:<><rect x="8" y="3" width="8" height="6" rx="1"/><path d="m8 6-5 12m13-12 5 12M12 9v9"/><circle cx="3" cy="20" r="2"/><circle cx="12" cy="20" r="2"/><circle cx="21" cy="20" r="2"/></>,
  sun:<><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></>,
  moon:<path d="M20.8 13a9 9 0 0 1-9.8-9.8A9 9 0 1 0 20.8 13Z"/>,
  close:<path d="m6 6 12 12M6 18 18 6"/>,arrow:<path d="M20 12H4m6-6-6 6 6 6"/>,
  grid:<><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  check:<path d="m4 12 5 5L20 6"/>,folder:<path d="M3 7V5h6l2 3h10v12H3V7Z"/>,
  info:<><circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-11v1"/></>,
  compare:<><rect x="3" y="5" width="7" height="14" rx="1"/><rect x="14" y="5" width="7" height="14" rx="1"/></>,
  right:<path d="M3 5h18M9 10h12M3 15h18M9 20h12"/>,
  center:<path d="M3 5h18M6 10h12M3 15h18M6 20h12"/>,
  left:<path d="M3 5h18M3 10h12M3 15h18M3 20h12"/>,
};
export function Icon({name,size=18,style}:{name:IconName;size?:number;style?:CSSProperties}) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={style}>{paths[name]}</svg>;
}
