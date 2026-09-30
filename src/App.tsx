import { useEffect, useMemo, useRef, useState } from 'react';
import catalog from './data/fonts.json';
import { FontCard, type PreviewSettings } from './components/FontCard';
import { Dialog } from './components/Dialog';
import { Icon } from './components/Icons';
import { assetUrl, fontBytes, inspectFont, type FontEntry } from './lib/fonts';
import { downloadFamily, saveFile } from './lib/download';
import { readSaved, savePreference, stringList } from './lib/storage';
import { fontsForLanguage, textDirection, categoryLabel, type Language } from './lib/languages';
const bundledFonts=catalog.fonts as FontEntry[];
const arabicFonts=fontsForLanguage(bundledFonts,'ar'),englishFonts=fontsForLanguage(bundledFonts,'en');
const englishExamples=['Every word deserves a beautiful typeface.','The quick brown fox jumps over the lazy dog.','Design with purpose. Create with character.','Aa Bb Cc — Typography 2026!'];
const examples=['في الحروف حياة، وفي الكلمات حكاية.','كلّ فكرة جميلة تبدأ بحرف.','العَرَبِيَّةُ لُغَةٌ تُشْبِهُ الشِّعْرَ.','تصميم عربي — Design 2026'];
interface LocalFontData {family:string;fullName:string;style:string;postscriptName:string;blob:()=>Promise<Blob>}
type FontWindow=Window & {queryLocalFonts?:()=>Promise<LocalFontData[]>};

export default function App() {
  const [settings,setSettings]=useState<PreviewSettings>({text:examples[0],size:42,weight:400,color:'#243c32',paper:'#fcfaf5',align:'center',direction:'rtl'});
  const [language,setLanguage]=useState<Language>('ar');
  const savedTexts=useRef({ar:examples[0],en:englishExamples[0]});
  const [query,setQuery]=useState('');const [category,setCategory]=useState('الكل');
  const [tab,setTab]=useState<'all'|'favorites'|'local'>('all');
  const [extraFonts,setExtraFonts]=useState<FontEntry[]>([]);
  const [favorites,setFavorites]=useState(()=>readSaved('harf-favorites',[],stringList));
  const [selected,setSelected]=useState<string[]>([]);
  const [dialog,setDialog]=useState<'compare'|'about'|null>(null);
  const [status,setStatus]=useState('');const [busy,setBusy]=useState(false);const [localBusy,setLocalBusy]=useState(false);
  const [transparent,setTransparent]=useState(true);
  const [dark,setDark]=useState(()=>readSaved('harf-dark',false,(v):v is boolean=>typeof v==='boolean'));
  const upload=useRef<HTMLInputElement>(null);
  useEffect(()=>{document.documentElement.dataset.theme=dark?'dark':'light';savePreference('harf-dark',dark);},[dark]);
  useEffect(()=>{savePreference('harf-favorites',favorites);},[favorites]);
  const allFonts=useMemo(()=>[...bundledFonts,...extraFonts],[extraFonts]);
  const selectedFonts=allFonts.filter(f=>selected.includes(f.id));
  const activeFonts=fontsForLanguage(allFonts,language);
  const favoriteCount=activeFonts.filter(f=>favorites.includes(f.id)).length;
  const filtered=activeFonts.filter(f=>{
    if(tab==='favorites'&&!favorites.includes(f.id))return false;
    if(tab==='local'&&f.source!=='local'&&f.source!=='upload')return false;
    return (category==='الكل'||categoryLabel(f.category,language)===category)&&f.family.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  });
  const update=<K extends keyof PreviewSettings>(key:K,value:PreviewSettings[K])=>setSettings(s=>({...s,[key]:value}));
  function changeLanguage(next:Language) {
    if(next===language)return;
    savedTexts.current[language]=settings.text;
    setLanguage(next);setSettings(s=>({...s,text:savedTexts.current[next],direction:textDirection(next)}));
    setCategory('الكل');setQuery('');setSelected([]);
  }
  const sampleTexts=language==='ar'?examples:englishExamples;
  const favorite=(id:string)=>setFavorites(items=>items.includes(id)?items.filter(v=>v!==id):[...items,id]);
  const compare=(id:string)=>{
    if(selected.includes(id)){setSelected(ids=>ids.filter(v=>v!==id));return;}
    if(selected.length===4){setStatus('يمكن مقارنة أربعة خطوط في المرة الواحدة. أزل أحدها لإضافة خط آخر.');return;}
    setSelected(ids=>[...ids,id]);
  };
  async function exportFont(entry:FontEntry) {
    setBusy(true);setStatus(`جارٍ تجهيز مسارات ${entry.family}…`);
    try {
      const {createVector}=await import('./lib/vector');
      const {resolveWeight}=await import('./lib/fonts');
      const weight=resolveWeight(entry.weights,settings.weight);
      const {vectorAttribution}=await import('./lib/download');
      const attribution=await vectorAttribution(entry);
      const svg=await createVector(await fontBytes(entry,weight),settings.text,{...settings,weight,background:transparent?null:settings.paper,attribution});
      saveFile(new Blob([svg],{type:'image/svg+xml;charset=utf-8'}),`${entry.family.replace(/[^\w-]/g,'-')}-${weight}.svg`);
      setStatus('تم تصدير SVG بمسارات حقيقية. الملف يحافظ على الأسطر التي أدخلتها، دون التفاف تلقائي.');
    }catch(e){setStatus(e instanceof Error?e.message:'تعذّر تصدير النص.');}finally{setBusy(false);}
  }
  async function download(entry:FontEntry) {
    setBusy(true);setStatus(`جارٍ تجهيز عائلة ${entry.family} مع رخصتها…`);
    try{await downloadFamily(entry);setStatus('تم تنزيل الخط بأوزانه المتاحة مع ملف الرخصة.');}
    catch(e){setStatus(e instanceof Error?e.message:'تعذّر تنزيل الخط.');}finally{setBusy(false);}
  }
  async function importFiles(files:FileList|null) {
    if(!files?.length)return;
    setLocalBusy(true);const added:FontEntry[]=[];const errors:string[]=[];
    for(const file of Array.from(files).slice(0,20)) {
      try {
        if(file.size>32*1024*1024)throw new Error('الحد الأقصى 32 ميغابايت لكل ملف.');
        const info=await inspectFont(await file.arrayBuffer());
        if(!info.arabic&&!info.english)throw new Error('الخط لا يغطي العربية أو الإنجليزية.');
        added.push({id:`upload-${crypto.randomUUID()}`,family:file.name.replace(/\.(ttf|otf|woff2?)$/i,''),category:'مستورد',weights:info.weights,weightRange:info.weightRange,
          files:[],designers:[],license:'',source:'upload',bytes:info.bytes,languages:[...(info.arabic?['ar' as const]:[]),...(info.english?['en' as const]:[])]});
      }catch(e){errors.push(`${file.name}: ${e instanceof Error&&/\p{Script=Arabic}/u.test(e.message)?e.message:'ملف غير صالح أو تالف.'}`);}
    }
    setExtraFonts(previous=>[...previous,...added]);
    if(added.length&&!added.some(f=>f.languages?.includes(language)))changeLanguage(added[0].languages![0]);
    setTab('local');setCategory('الكل');setQuery('');
    setStatus([added.length?`تم استيراد ${added.length} خط. ملفاتك تبقى في المتصفح فقط.`:'',...errors,files.length>20?'يمكن استيراد 20 ملفاً في المرة الواحدة.':''].filter(Boolean).join(' '));
    setLocalBusy(false);if(upload.current)upload.current.value='';
  }
  async function accessLocalFonts() {
    const queryLocalFonts=(window as FontWindow).queryLocalFonts;
    if(!queryLocalFonts){setStatus('متصفحك لا يدعم قراءة خطوط الجهاز. استخدم استيراد ملفات الخطوط، أو افتح الأداة في Chrome أو Edge على الكمبيوتر.');return;}
    setLocalBusy(true);setStatus('جارٍ فحص خطوط الجهاز العربية والإنجليزية…');
    try {
      // Call before any asynchronous work so the browser retains user activation.
      const available=await queryLocalFonts.call(window);
      const families=new Map<string,LocalFontData>();
      for(const f of available) {
        if(/italic|oblique/i.test(f.style))continue;
        if(!families.has(f.family)||/^(regular|normal|book)$/i.test(f.style))families.set(f.family,f);
      }
      const added:FontEntry[]=[];let checked=0;
      for(const f of [...families.values()].slice(0,500)) {
        if(extraFonts.some(e=>e.id===`local-${f.postscriptName}`))continue;
        try {
          const blob=await f.blob();if(blob.size>32*1024*1024)continue;
          const info=await inspectFont(await blob.arrayBuffer());
          if(info.arabic||info.english)added.push({id:`local-${f.postscriptName}`,family:f.family,category:'محلي',weights:info.weights,weightRange:info.weightRange,files:[],designers:[],license:'',source:'local',bytes:info.bytes,languages:[...(info.arabic?['ar' as const]:[]),...(info.english?['en' as const]:[])]});
        }catch{/* Unsupported fonts and collections are omitted. */}
        if(++checked%15===0)setStatus(`فُحصت ${checked} عائلة، ووُجد ${added.length} خط مدعوم…`);
      }
      setExtraFonts(p=>[...p,...added]);setTab('local');setCategory('الكل');setQuery('');
      setStatus(added.length?`أُضيف ${added.length} خط من جهازك. تُعرض الوجهة المستقيمة المتاحة لكل عائلة. راعِ رخصة الخط عند تصديره.`:'لا توجد خطوط جديدة قابلة للقراءة. يمكنك استيراد ملفات الخطوط يدوياً.');
    }catch{setStatus('لم يسمح المتصفح بقراءة خطوط الجهاز. يمكنك إعادة المحاولة أو استيراد ملفات الخطوط يدوياً.');}
    finally{setLocalBusy(false);}
  }
  function card(entry:FontEntry,comparison=false) {
    return <FontCard key={entry.id} entry={entry} settings={settings} favorite={favorites.includes(entry.id)} selected={selected.includes(entry.id)} busy={busy} comparison={comparison}
      onFavorite={()=>favorite(entry.id)} onCompare={()=>compare(entry.id)} onExport={()=>void exportFont(entry)} onDownload={()=>void download(entry)}/>;
  }
  function statusMessage(inDialog=false) {
    return <div className={`status-message ${inDialog?'inline-status':''} ${status?'shown':''}`} role="status" aria-live="polite">{status&&<><span>{status}</span><button className="icon-button" aria-label="أغلق الرسالة" onClick={()=>setStatus('')}><Icon name="close" size={16}/></button></>}</div>;
  }
  return <>
    <a className="skip-link" href="#studio">انتقل إلى المعاين</a>
    <header className="site-header"><div className="header-inner">
      <a className="brand" href="#" aria-label="حرف، الصفحة الرئيسية"><span className="brand-mark"><img src={assetUrl('favicon.svg')} alt="" width="43" height="43"/></span><span className="brand-word">حرف<span>مساحة للخطوط</span></span></a>
      <nav aria-label="التنقل الرئيسي"><a className="nav-current" href="#studio">معاين الخطوط</a><button onClick={()=>setDialog('about')}>عن حرف <Icon name="arrow" size={15}/></button></nav>
      <div className="header-tools"><span className="open-source"><span/>مجاني ومفتوح المصدر</span><button className="icon-button theme-button" onClick={()=>setDark(v=>!v)} aria-label={dark?'فعّل الوضع الفاتح':'فعّل الوضع الداكن'}><Icon name={dark?'sun':'moon'} size={20}/></button></div>
    </div></header>
    <main className="page-shell">
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy"><div className="eyebrow"><span className="tiny-star">✳</span> الحرف الجميل يصنع الفرق</div>
          <h1 id="hero-title">لكلّ كلمة، <span>خطٌّ يليق بها.</span></h1>
          <p>اكتب فكرتك، وجرّبها بخطوط عربية وإنجليزية مختلفة.<br/>قارن، اختر، وخذ الحرف الجميل إلى تصميمك.</p>
          <div className="hero-meta"><span><bdi>{arabicFonts.length}</bdi> عائلة عربية</span><span className="meta-separator"/><span><bdi>{englishFonts.length}</bdi> عائلة إنجليزية</span><span className="meta-separator"/><span>تحميل وتصدير فيكتور</span></div>
        </div>
        <div className="hero-art" aria-hidden="true"><div className="art-caption"><span>الحرف، بأكثر من روح.</span><span className="art-index">01 — {bundledFonts.length}</span></div><div className="letter-study"><span className="study-letter one">ح</span><span className="study-letter two">ح</span><span className="study-letter three">ح</span></div><div className="art-bottom"><span>حكاية تبدأ من هنا</span><span>ـــــ</span></div></div>
      </section>
      <section className="studio" id="studio" aria-label="معاين الخطوط">
        <aside className="settings-panel">
          <div className="panel-heading"><span className="step-number">01</span><h2>ابدأ بكلماتك</h2><span className="panel-spark">✦</span></div>
          <label className="field-label" htmlFor="preview-text">نص المعاينة</label>
          <div className="text-editor"><textarea dir={settings.direction} id="preview-text" aria-label="النص الذي تريد معاينته" value={settings.text} onChange={e=>update('text',e.target.value)} maxLength={2000} spellCheck={false}/><span className="character-count"><bdi>{settings.text.length} / 2000</bdi></span></div>
          <div className="example-row"><span>تحتاج إلهاماً؟</span><button className="text-button" onClick={()=>update('text',sampleTexts[(sampleTexts.indexOf(settings.text)+1)%sampleTexts.length])}>جرّب نصاً <Icon name="arrow" size={13}/></button></div>
          <div className="panel-rule"/>
          <div className="control-header"><label htmlFor="font-size">حجم الخط</label><output htmlFor="font-size"><bdi>{settings.size} px</bdi></output></div>
          <input id="font-size" type="range" min="18" max="96" step="1" value={settings.size} onChange={e=>update('size',Number(e.target.value))}/>
          <div className="range-endpoints"><span>صغير</span><span>كبير</span></div>
          <div className="setting-row"><label htmlFor="font-weight">وزن الخط</label><select id="font-weight" value={settings.weight} onChange={e=>update('weight',Number(e.target.value))}>{[[200,'خفيف'],[300,'رفيع'],[400,'عادي'],[500,'متوسط'],[600,'شبه عريض'],[700,'عريض'],[800,'ثقيل'],[900,'أسود']].map(([w,label])=><option key={w} value={w}>{label} — {w}</option>)}</select></div>
          <p className="small-note">يُستخدم أقرب وزن متاح فعلياً لكل خط.</p>
          <div className="setting-row"><span>المحاذاة</span><div className="alignment-group">{(['right','center','left'] as const).map(a=><button key={a} className={settings.align===a?'active':''} onClick={()=>update('align',a)} aria-label={`محاذاة ${a==='right'?'لليمين':a==='left'?'لليسار':'للوسط'}`} aria-pressed={settings.align===a}><Icon name={a} size={17}/></button>)}</div></div>
          <div className="panel-rule"/>
          <div className="color-row"><label htmlFor="text-color">لون النص</label><div className="color-control"><bdi>{settings.color.toUpperCase()}</bdi><input id="text-color" type="color" value={settings.color} onChange={e=>update('color',e.target.value)}/></div></div>
          <div className="color-row"><label htmlFor="paper-color">لون الخلفية</label><div className="color-control"><bdi>{settings.paper.toUpperCase()}</bdi><input id="paper-color" type="color" value={settings.paper} onChange={e=>update('paper',e.target.value)}/></div></div>
          <label className="checkbox-row"><input type="checkbox" checked={transparent} onChange={e=>setTransparent(e.target.checked)}/>خلفية شفافة عند تصدير SVG</label>
          <div className="panel-rule"/>
          <button className="local-button" disabled={localBusy} onClick={()=>void accessLocalFonts()}><Icon name="folder"/>{localBusy?'جارٍ فحص الخطوط…':'اكتشف خطوط جهازك'}<Icon name="arrow" size={16}/></button>
          <button className="import-button" disabled={localBusy} onClick={()=>upload.current?.click()}>أو استورد ملف خط <span className="file-types"><bdi>TTF · OTF · WOFF</bdi></span></button>
          <input className="visually-hidden" type="file" ref={upload} accept=".ttf,.otf,.woff,.woff2" multiple aria-label="استيراد ملفات الخطوط" onChange={e=>void importFiles(e.target.files)}/>
          <p className="privacy-note"><Icon name="info" size={14}/>نصوصك وملفاتك تبقى في متصفحك.</p>
        </aside>
        <div className="library">
          <div className="library-heading"><div className="library-title"><span className="step-number">02</span><h2>اكتشف الخط المناسب</h2></div><span className="results-count"><bdi>{filtered.length}</bdi> خطاً</span></div>
          <div className="language-switch" role="group" aria-label="لغة الخطوط"><button className={language==='ar'?'active':''} aria-pressed={language==='ar'} aria-label="الخطوط العربية" onClick={()=>changeLanguage('ar')}><span className="language-letter">ع</span><span>الخطوط العربية</span><bdi>{arabicFonts.length}</bdi></button><button className={language==='en'?'active':''} aria-pressed={language==='en'} aria-label="الخطوط الإنجليزية" onClick={()=>changeLanguage('en')}><span className="language-letter latin-letter">Aa</span><span>الخطوط الإنجليزية</span><bdi>{englishFonts.length}</bdi></button></div>
          <div className="library-toolbar"><div className="library-tabs" role="group" aria-label="مصدر الخطوط"><button className={tab==='all'?'active':''} onClick={()=>{setTab('all');setCategory('الكل');}}><Icon name="grid" size={15}/>كل الخطوط</button><button className={tab==='favorites'?'active':''} onClick={()=>{setTab('favorites');setCategory('الكل');}} aria-label="المفضلة"><Icon name="heart" size={15}/>المفضلة{favoriteCount>0&&<span className="tab-count">{favoriteCount}</span>}</button><button className={tab==='local'?'active':''} onClick={()=>{setTab('local');setCategory('الكل');}}>خطوط الجهاز</button></div>
            <div className="search-box"><Icon name="search" size={17}/><input aria-label="ابحث عن خط" placeholder="ابحث عن اسم خط…" value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button className="icon-button" aria-label="امسح البحث" onClick={()=>setQuery('')}><Icon name="close" size={14}/></button>}</div></div>
          <div className="category-row" aria-label="تصنيف الخطوط">{['الكل','عصري',language==='ar'?'نسخي':'كلاسيكي','عرض','يدوي','ثابت'].map(c=><button key={c} className={category===c?'active':''} aria-pressed={category===c} onClick={()=>setCategory(c)}>{c}</button>)}<span className="library-tip">اختر <Icon name="plus" size={12}/> للمقارنة</span></div>
          {filtered.length?<div className="font-grid">{filtered.map(f=>card(f))}</div>:<div className="empty-state"><span className="empty-letter">ح</span><h3>{tab==='local'?'خطوطك، في مكانها.':tab==='favorites'?'احتفظ بالخطوط التي تحبها.':'لم نجد خطاً بهذا الاسم.'}</h3><p>{tab==='local'?'اكتشف خطوط جهازك أو استورد ملفات الخطوط من لوحة الإعدادات.':tab==='favorites'?'اضغط على القلب بجانب أي خط لإضافته إلى المفضلة.':'جرّب اسماً آخر أو غيّر التصنيف.'}</p><button className="text-button" onClick={()=>{setQuery('');setCategory('الكل');setTab('all');}}>استعرض كل الخطوط <Icon name="arrow" size={14}/></button></div>}
          <div className="library-end"><span>✦</span><p>الكلمات نفسها. احتمالات لا تنتهي.</p></div>
        </div>
      </section>
      <footer className="site-footer"><div><span className="footer-brand">حرف</span><span>صُنع لكل من يحب جمال العربية.</span></div><div><button onClick={()=>setDialog('about')}>الرخصة والخصوصية</button><span>مصادر حرة، منها <a href="https://fonts.google.com/" target="_blank" rel="noreferrer"><bdi>Google Fonts</bdi></a></span></div></footer>
    </main>
    {selected.length>0&&<div className="comparison-tray"><div><Icon name="compare" size={20}/><span><bdi>{selected.length}</bdi> من <bdi>4</bdi> خطوط للمقارنة</span><div className="tray-fonts">{selectedFonts.map(f=><button key={f.id} onClick={()=>compare(f.id)} aria-label={`أزل ${f.family} من المقارنة`}><bdi>{f.family}</bdi><Icon name="close" size={12}/></button>)}</div></div><button className="primary-button" aria-label="افتح المقارنة" disabled={selected.length<2} onClick={()=>setDialog('compare')}>قارن الخطوط <Icon name="arrow" size={16}/></button></div>}
    {dialog!=='compare'&&statusMessage()}
    {dialog==='compare'&&<Dialog title="مقارنة الخطوط" wide onClose={()=>setDialog(null)}><p className="dialog-note">الكلمات والإعدادات نفسها، لتختار الخط الذي يناسب فكرتك.</p>{statusMessage(true)}<div className="comparison-grid">{selectedFonts.map(f=>card(f,true))}</div>{selectedFonts.length<2&&<p>اختر خطين على الأقل للمقارنة.</p>}</Dialog>}
    {dialog==='about'&&<Dialog title="عن حرف" onClose={()=>setDialog(null)}><div className="about-content"><p className="about-lead">مساحة صغيرة، لاحتمالات عربية كبيرة.</p><p>حرف أداة مجانية مفتوحة المصدر لمعاينة الخطوط العربية والإنجليزية ومقارنتها. يحتوي الفهرس على <bdi>{arabicFonts.length}</bdi> عائلة عربية و<bdi>{englishFonts.length}</bdi> عائلة إنجليزية متحقق منها، مع رخصها الأصلية.</p><h3>خصوصيتك</h3><p>الخطوط مرفقة بالموقع. لا نستخدم تتبعاً أو حسابات ولا نرسل نصوصك أو ملفاتك إلى خادم. نحفظ المفضلة والمظهر في متصفحك فقط. الملفات المستوردة تُزال عند إعادة تحميل الصفحة.</p><h3>خطوط الجهاز</h3><p>اكتشاف الخطوط متاح في المتصفحات الداعمة مثل Chrome وEdge على الكمبيوتر، عبر HTTPS أو localhost وبإذنك. نستورد الوجهة المستقيمة المتاحة لكل عائلة، ونتحقق من تغطية العربية والإنجليزية. استيراد TTF وOTF وWOFF وWOFF2 متاح كبديل.</p><h3>تصدير دقيق</h3><p>يستخدم التصدير HarfBuzz لتشكيل الحروف، وينتج SVG بمسارات حقيقية لا يحتاج إلى تثبيت الخط. التصدير أحادي اللون، ويحافظ على الأسطر المكتوبة دون التفاف تلقائي. الأحرف غير المدعومة تمنع التصدير بدلاً من استبدالها.</p><h3>الرخص</h3><p>كود حرف برخصة MIT. الخطوط لها رخصها الخاصة المرفقة بالتنزيل. تأكد من حقك في استخدام الخطوط المحلية وتصديرها؛ وجودها على الجهاز لا يجعلها مجانية.</p><a className="text-button" href="https://github.com/google/fonts" target="_blank" rel="noreferrer">مستودع الخطوط الرسمي <Icon name="arrow" size={14}/></a></div></Dialog>}
  </>;
}
