// Watercolor static props should load and take the sprite-first rendering path.
export default async({page})=>{
 const r=await page.evaluate(async()=>{
   const keys=['prop_trunk','prop_ticket','prop_sign','prop_post'],bad=[];
   for(let i=0;i<80&&!keys.every(k=>G.sprites[k]);i++)await new Promise(r=>setTimeout(r,20));
   for(const k of keys){const im=G.sprites[k];if(!im||!im.naturalWidth||!im.naturalHeight)bad.push(k+' missing');}
   const cv=document.createElement('canvas');cv.width=240;cv.height=180;const ctx=cv.getContext('2d');
   for(const k of keys)if(G.sprites[k])try{if(!G.art.draw(k,ctx,{x:100,y:150,w:48,h:70}))bad.push(k+' did not use sprite path');}catch(e){bad.push(k+' draw threw '+e.message);}
   return {bad,sizes:Object.fromEntries(keys.filter(k=>G.sprites[k]).map(k=>[k,[G.sprites[k].naturalWidth,G.sprites[k].naturalHeight]])),errors:G.errors.slice()};
 });
 if(r.bad.length)throw new Error(r.bad.join(' | '));if(r.errors.length)throw new Error('G.errors: '+r.errors.join(' | '));
 return 'watercolor trunk/ticket/sign/signal-post sprites loaded: '+JSON.stringify(r.sizes);
};