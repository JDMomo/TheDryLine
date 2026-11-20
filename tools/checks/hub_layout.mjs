// The authored home area (the Junction, five screens by three storeys): props must fit the WORLD, labels must fit a camera view centered on their prop,
// and no unrelated prop boxes may overlap. The lock-chart rows remain internally readable.
export default async ({ page }) => {
  const res = await page.evaluate(() => {
    const D=G.debug,U=G.util,bad=[],cv=document.createElement('canvas');cv.width=960;cv.height=544;const ctx=cv.getContext('2d');
    let nProps=0,nBoxes=0;
    for(const seed of [1,5,9,33,77]) for(const nb of [0,2,4]){
      D.newRun(seed);for(const r of ['r1','r2','r3','r4'].slice(4-nb))G.run.beaten[r]=true;
      const room=G.rooms.current,W=room.cols*G.C.T,H=room.rows*G.C.T,all=[];
      room.props.forEach((pr,i)=>{for(const b of G.props.boxes(pr,ctx))all.push(Object.assign({i,type:pr.type,region:pr.data&&pr.data.region,px:pr.x,py:pr.y},b));nProps++;});
      nBoxes+=all.length;
      const tag=b=>b.type+(b.region?' '+b.region:'')+(b.text?' "'+b.text+'"':'')+' ['+[b.x0,b.y0,b.x1,b.y1].map(Math.round)+']';
      for(let a=0;a<all.length;a++){
        const A=all[a];
        if(A.x0<0||A.x1>W||A.y0<0||A.y1>H)bad.push('seed '+seed+'/'+nb+': outside hub world '+tag(A));
        const cam=Math.max(0,Math.min(W-G.C.W,A.px-G.C.W/2)), camY=Math.max(0,Math.min(H-G.C.H,A.py-G.C.H/2));
        if(A.x0<cam||A.x1>cam+G.C.W||A.y0<camY||A.y1>camY+G.C.H)bad.push('seed '+seed+'/'+nb+': not visible when approached '+tag(A)+' cam '+Math.round(cam)+','+Math.round(camY));
        for(let b=a+1;b<all.length;b++){const B=all[b];if(A.i===B.i)continue;if(U.overlap(A,B))bad.push('seed '+seed+'/'+nb+': '+tag(A)+' overlaps '+tag(B));}
      }
      const board=room.props.find(p=>p.type==='board'),L=G.props.boxes(board,ctx),panel=L.find(b=>b.kind==='body');
      for(const r of Object.values(G.regionDefs)){
        const nm=L.find(b=>b.text===r.name);if(!nm){bad.push('board has no row for '+r.name);continue;}
        const cuts=L.filter(b=>b.text==='cut'&&b.y0===nm.y0);
        if(cuts.length!==3)bad.push(r.name+': '+cuts.length+' cuts on row');
        for(const c of cuts)if(nm.x1+2>c.x0)bad.push('board row '+r.name+' runs into cuts');
        if(nm.x0<panel.x0+4||nm.y1>panel.y1-3||cuts.some(c=>c.x1>panel.x1-4))bad.push('board row '+r.name+' clipped');
      }
      const gates=room.props.filter(p=>p.type==='gate').sort((a,b)=>a.x-b.x);
      if(gates.length!==5)bad.push('Junction has '+gates.length+' gates, wanted 5');
      // gates stand at their routes' mouths on different storeys: no two closer than 7 tiles (straight-line distance)
      for(let i=0;i<gates.length;i++)for(let j=i+1;j<gates.length;j++){const d=Math.hypot(gates[i].x-gates[j].x,gates[i].y-gates[j].y);if(d<7*G.C.T)bad.push('gates '+gates[i].data.region+'/'+gates[j].data.region+' are too menu-like/close: '+Math.round(d)+'px');}
    }
    return {bad,nProps,nBoxes};
  });
  if(res.bad.length)throw new Error(res.bad.length+' problems: '+[...new Set(res.bad)].slice(0,8).join(' | '));
  return res.nProps+' hub props, '+res.nBoxes+' boxes: world-space, approach-visible, non-overlapping';
};