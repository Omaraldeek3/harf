import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Icon } from './Icons';
export function Dialog({title,onClose,children,wide=false}:{title:string;onClose:()=>void;children:ReactNode;wide?:boolean}) {
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const d=ref.current!;d.showModal();return()=>d.close();},[]);
  return <dialog ref={ref} className={`dialog ${wide?'dialog-wide':''}`} aria-label={title} onCancel={onClose} onClick={e=>{if(e.target===ref.current)onClose();}}>
    <div className="dialog-inner"><div className="dialog-header"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="أغلق النافذة"><Icon name="close"/></button></div>{children}</div>
  </dialog>;
}
