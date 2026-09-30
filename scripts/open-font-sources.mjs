// Original creator repositories only. Keep full original notices and source revisions.
export const sources=[
  ...['Shabnam','Sahel','Samim','Tanha','Gandom','Nahid'].map(family=>({
    family,repo:`rastikerdar/${family.toLowerCase()}-font`,category:'عصري',license:'LICENSE',
    files:family==='Shabnam'?['dist/Shabnam.ttf','dist/Shabnam-Light.ttf','dist/Shabnam-Medium.ttf','dist/Shabnam-Bold.ttf','dist/Shabnam-Thin.ttf']:
      family==='Sahel'?['dist/Sahel.ttf','dist/Sahel-Light.ttf','dist/Sahel-SemiBold.ttf','dist/Sahel-Bold.ttf','dist/Sahel-Black.ttf']:
      family==='Samim'?['dist/Samim.ttf','dist/Samim-Medium.ttf','dist/Samim-Bold.ttf']:[`dist/${family}.ttf`],
  })),
  {family:'Arad',repo:'MohamadDarvishi/Arad',category:'عصري',license:'OFL.txt',files:['Fonts/Main_Fonts/AradVF.ttf']},
  {family:'FiraGO',repo:'bBoxType/FiraGO',category:'عصري',license:'OFL.txt',files:['Fonts/FiraGO_TTF_1001/Roman/FiraGO-Regular.ttf','Fonts/FiraGO_TTF_1001/Roman/FiraGO-Bold.ttf']},
  ...['Noto Sans Arabic UI','Noto Naskh Arabic UI'].map(family=>({family,repo:'notofonts/noto-fonts',category:family.includes('Naskh')?'نسخي':'عصري',license:'LICENSE',
    files:[`hinted/ttf/${family.replaceAll(' ','')}/${family.replaceAll(' ','')}-Regular.ttf`,`hinted/ttf/${family.replaceAll(' ','')}/${family.replaceAll(' ','')}-Bold.ttf`]})),
  {family:'Kawkab Mono',repo:'aiaf/kawkab-mono',category:'ثابت',license:'OFL.txt',release:'v0.501',
    archive:'https://github.com/aiaf/kawkab-mono/releases/download/v0.501/kawkab-mono-0.501.zip'},
];
