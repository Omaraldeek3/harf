export interface FontAudit {
  fingerprint:string;family:string;weight:number;weights:number[];weightRange:number[]|null;
  italic:boolean;english:boolean;copyright:string;designer:string;license:string;licenseUrl:string;
}
export function auditArabic(bytes:Uint8Array):FontAudit;
