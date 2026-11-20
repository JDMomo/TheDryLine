// Title presentation: story-first front door, essential controls only, full manual stays in Pause -> Controls.
export default async({page})=>{
 const r=await page.evaluate(()=>{
  const bad=[],ctx=document.getElementById('game').getContext('2d'),labels=[],old=G.art.label;
  G.art.label=(ctx,t,...rest)=>{labels.push(String(t));return old(ctx,t,...rest);};
  try{G.menus.title(ctx);}catch(e){bad.push('title draw threw '+e.message);}
  G.art.label=old;
  const all=labels.join(' | ');
  for(const word of ['The Dry Line','CANCELLATION','Long Clock','PRESS ANY KEY'])if(!all.includes(word))bad.push('title missing '+word);
  if(all.includes('Mend (hold)')||all.includes('Switch token'))bad.push('title regressed into full controls table');
  for(const word of ['Move','Jump','Slash','Map'])if(!all.includes(word))bad.push('quick controls missing '+word);
  return {bad,labels,errors:G.errors.slice()};
 });
 if(r.bad.length)throw new Error(r.bad.join(' | '));
 if(r.errors.length)throw new Error('G.errors: '+r.errors.join(' | '));
 return 'title is story-first with watercolor hero and four essential controls';
};