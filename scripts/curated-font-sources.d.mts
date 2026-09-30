interface Repository {repo:string;revision:string;license:string;fonts:{family:string;files:string[]}[];category:string}
interface LibraryArchive {slug:string;archive:string;sha256:string;category:string}
interface DirectFont {id:string;family:string;fileUrl:string;filename:string;sha256:string;category:string;sourceUrl:string;range?:{offset:number;compressed:number};version?:string;allowItalic?:boolean}
export const repositories:Repository[];
export const libraryArchives:LibraryArchive[];
export const directFonts:DirectFont[];
