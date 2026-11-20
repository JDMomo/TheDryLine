// Story and Route Board journal: discoveries are per-run, deduplicated, objective changes, notes browse left/right.
export default async ({page})=>{
  const r=await page.evaluate(()=>{
    const D=G.debug,bad=[];
    D.newRun(1201);D.god(true);
    if(!G.story)bad.push('G.story missing');
    const s=G.run.story;
    if(!s||!s.notes.length)bad.push('hub did not create opening story note');
    const opening=s&&s.notes.length?s.notes[0]:null;
    if(!opening||!/Last Timetable/i.test(opening.title+' '+opening.text))bad.push('opening does not establish Last Timetable');

    const before=s.notes.length;
    G.story.wardenFell('r1');const after=s.notes.length;G.story.wardenFell('r1');
    if(after!==before+1||s.notes.length!==after)bad.push('Warden aftermath did not add exactly one deduplicated note');

    const obj1=G.story.objective();G.run.beaten.r1=true;G.run.beaten.r2=true;G.run.beaten.r3=true;G.run.beaten.r4=true;
    const obj4=G.story.objective();
    if(obj1===obj4||!/Terminus|Long Clock/i.test(obj4))bad.push('objective did not advance after four Wardens');

    // Seed a few discovered notes and prove the board's browse cursor wraps.
    G.story.wardenFell('r2');G.story.wardenFell('r3');
    const n=G.story.notes().length;G.map.open();const latest=G.map.note;
    G.map.step({left:true,right:false});const prev=G.map.note;
    G.map.step({left:false,right:true});const back=G.map.note;
    if(n>1&&(prev===latest||back!==latest))bad.push('Route Board note browsing failed '+JSON.stringify({n,latest,prev,back}));

    // Authored room names should hide behind map visit state, but the source names must exist.
    for(const id of ['r1_dock','r2_shaft','r3_trestle','r4_concourse','final_gearworks'])
      if(!G.story.roomName(id)||G.story.roomName(id)===id)bad.push('missing authored room name '+id);

    // Draw title and map with story active: catches long-text or missing-state exceptions.
    const ctx=document.getElementById('game').getContext('2d');
    try{G.menus.title(ctx);}catch(e){bad.push('title draw threw '+e.message);}
    G.state='map';try{G.map.draw(ctx);}catch(e){bad.push('map draw threw '+e.message);}
    return {bad,n,opening,obj1,obj4,errors:G.errors.slice()};
  });
  if(r.bad.length)throw new Error(r.bad.join(' | '));
  if(r.errors.length)throw new Error('G.errors: '+r.errors.join(' | '));
  return r.n+' discovered notes browse correctly; objectives progress to Terminus';
};