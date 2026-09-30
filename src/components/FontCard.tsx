import { useEffect, useRef, useState } from 'react';
import { cssFamily, fontBytes, loadFont, resolveWeight, type FontEntry } from '../lib/fonts';
import { Icon } from './Icons';
import { categoryLabel } from '../lib/languages';
export interface PreviewSettings {text:string;size:number;weight:number;color:string;paper:string;align:'right'|'center'|'left';direction:'rtl'|'ltr'}
interface Props {
  entry:FontEntry;settings:PreviewSettings;favorite:boolean;selected:boolean;
  onFavorite:()=>void;onCompare:()=>void;onExport:()=>void;onDownload:()=>void;
  comparison?:boolean;busy:boolean;
}

export function FontCard({entry,settings,favorite,selected,onFavorite,onCompare,onExport,onDownload,comparison=false,busy}:Props) {
  const ref=useRef<HTMLElement>(null);
  const [visible,setVisible]=useState(comparison);
  const [status,setStatus]=useState<'loading'|'ready'|'error'>('loading');
  const [error,setError]=useState('');const [missing,setMissing]=useState(false);const [retry,setRetry]=useState(0);
  const weight=resolveWeight(entry.weights,settings.weight);
  useEffect(()=>{
    if(visible||!ref.current)return;
    const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){setVisible(true);observer.disconnect();}},{rootMargin:'250px'});
    observer.observe(ref.current);return()=>observer.disconnect();
  },[visible]);
  useEffect(()=>{
    if(!visible)return;
    let current=true;setStatus('loading');
    Promise.all([loadFont(entry,weight),fontBytes(entry,weight).then(async b=>(await import('../lib/vector')).hasMissingGlyphs(b,settings.text,weight,settings.direction))])
      .then(([,absent])=>{if(current){setStatus('ready');setMissing(absent);}})
      .catch(e=>{if(current){setStatus('error');setError(e instanceof Error?e.message:'تعذّر تحميل الخط.');}});
    return()=>{current=false;};
  },[entry,visible,weight,settings.text,settings.direction,retry]);
  return <article ref={ref} className={`font-card ${selected?'is-selected':''} ${comparison?'comparison-card':''}`} data-testid={`font-${entry.id}`}>
    <div className="card-header">
      <div><h3><bdi>{entry.family}</bdi></h3><span className="card-type">{categoryLabel(entry.category,settings.direction==='rtl'?'ar':'en')} <span className="type-dot">·</span> {entry.source==='google'?'Google Fonts':entry.source==='open'?'مفتوح المصدر':entry.source==='local'?'خط من جهازك':'خط مستورد'}{entry.licenseKind==='AGPL-3.0'&&<> · <bdi>{entry.licenseKind}</bdi></>}</span></div>
      <button className={`icon-button favorite-button ${favorite?'active':''}`} onClick={onFavorite} aria-label={`${favorite?'أزل':'أضف'} ${entry.family} ${favorite?'من':'إلى'} المفضلة`} aria-pressed={favorite}><Icon name="heart"/></button>
    </div>
    <div className="preview-area" style={{backgroundColor:settings.paper,color:settings.color,textAlign:settings.align}}>
      {status==='ready' ? <p dir={settings.direction} data-testid="font-preview" style={{fontFamily:`"${cssFamily(entry)}"`,fontSize:settings.size,fontWeight:weight}}>{settings.text||(settings.direction==='rtl'?'اكتب شيئاً جميلاً':'Write something beautiful')}</p>
        :status==='error'?<div className="font-error"><p>{error}</p><button className="text-button" onClick={()=>setRetry(n=>n+1)}>أعد المحاولة</button></div>
        :<span className="font-loading"><span className="loading-dot"/>{visible?'جارٍ تحميل الخط':'تظهر المعاينة عند التمرير'}</span>}
      {status==='ready'&&missing&&<span className="glyph-warning">بعض الأحرف غير متاحة في هذا الخط</span>}
    </div>
    <div className="card-footer">
      <button className={`compare-button ${selected?'active':''}`} onClick={onCompare} aria-pressed={selected} aria-label={`${selected?'أزل':'قارن'} ${entry.family}`}><Icon name={selected?'check':'plus'} size={15}/>{selected?'في المقارنة':'قارن'}</button>
      <div className="card-actions">
        <span className="weight-label"><bdi>{weight}</bdi></span>
        {(entry.source==='google'||entry.source==='open')&&<button className="icon-button" title="تنزيل العائلة مع الرخصة" aria-label={`نزّل عائلة ${entry.family}`} onClick={onDownload} disabled={busy}><Icon name="download" size={17}/></button>}
        <button className="export-button" aria-label={`صدّر ${entry.family} كـ SVG`} title="تصدير مسارات أحادية اللون" onClick={onExport} disabled={busy||status!=='ready'||missing||!settings.text.trim()}><Icon name="vector" size={15}/><bdi>SVG</bdi></button>
      </div>
    </div>
  </article>;
}
