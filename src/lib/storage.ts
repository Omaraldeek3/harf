export function readSaved<T>(key:string,fallback:T,validate:(value:unknown)=>value is T):T {
  try {const value:unknown=JSON.parse(localStorage.getItem(key)||'null');return validate(value)?value:fallback;} catch {return fallback;}
}
export function savePreference(key:string,value:unknown) {try{localStorage.setItem(key,JSON.stringify(value));}catch{/* Private browsing can disable storage. */}}
export const stringList=(value:unknown):value is string[]=>Array.isArray(value)&&value.length<1000&&value.every(v=>typeof v==='string');
