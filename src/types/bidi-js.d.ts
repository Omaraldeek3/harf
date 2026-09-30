declare module 'bidi-js' {
  interface Levels { levels: Uint8Array; paragraphs: {start:number;end:number;level:number}[] }
  interface Bidi {
    getEmbeddingLevels(text:string,direction?:'rtl'|'ltr'):Levels;
    getReorderSegments(text:string,levels:Levels,start?:number,end?:number):[number,number][];
  }
  export default function bidiFactory():Bidi;
}
