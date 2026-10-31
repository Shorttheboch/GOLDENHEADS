// Markers (v71): the on-screen markers that point at things (rescue "N POR RESCATAR", hold "BODEGA", breach "ROTURA") must not sit on top of each other
// when they get stuck to the same screen edge, nor on top of the PC hints / tank (PC) or in the FIRE / pause corners (phone).
// Floating clusters + breaches are put together on one side of the ship (a "heavy" scene: 5 clusters + 4 breaches + the hold, and a "light" one:
// 3 clusters + 1 breach + the hold); the camera turns all the way round in 15° steps and at every step every visible marker box (and the arrow of the
// edge ones) is measured. Then a slow turn (1° a frame) counts the "jolts": a marker that moved on screen 40+ px more in one frame than the thing it points at (frames here are 50 ms, 3x a real one: a glide counts too).
// Run on dist-test:   tools/run-test.sh dist-test tools/tests/markers.cjs      (PC 1920x1080, then phone 844x390)
//   HEADS_ONLY=pc|phone · HEADS_TURNS=0,5,9 (only those turns) · HEADS_SCENE=heavy|light · HEADS_NOSTAB=1 · HEADS_LANG=en · HEADS_STABONLY=1 (only the slow turn) · HEADS_DEBUG=1 (list the worst jolts) · HEADS_TURN=<n> (heavy screenshot at n*15°, default 210)
// Screenshots: <pc|phone>_markers.png (heavy, turn 210), <pc|phone>_markers_b.png (heavy, the turn with most markers at an edge), <pc|phone>_markers_light.png.
// Exit code 1 if any marker overlaps another marker, a keepout, or leaves the screen.
const {chromium}=require('playwright');
const {BASE,ARGS,shot}=require('./lib.cjs');
const LANG=process.env.HEADS_LANG||'es',ONLY=process.env.HEADS_ONLY||'',STAB=!!process.env.HEADS_STABONLY;
const area=(A,B)=>Math.max(0,Math.min(A[2],B[2])-Math.max(A[0],B[0]))*Math.max(0,Math.min(A[3],B[3])-Math.max(A[1],B[1]));
// everything visible that is a marker, and the things markers must keep clear of
const collect=()=>{__step(1);const W=innerWidth,H=innerHeight,q=id=>document.getElementById(id); // (one more frame right before measuring: the pass and the measure see the same sizes)
  const vis=el=>el&&!el.hidden&&getComputedStyle(el).display!=='none'&&getComputedStyle(el).visibility!=='hidden';
  const rc=el=>{const r=el.getBoundingClientRect();return [r.left,r.top,r.right,r.bottom].map(v=>+v.toFixed(1));};
  const mk=[],add=(kind,el)=>{if(!vis(el))return;const ar=el.classList.contains('off')?el.querySelector('.ar'):null;
    mk.push({kind,txt:el.textContent.trim().replace(/\s+/g,' '),box:rc(el),off:el.classList.contains('off'),arrow:ar&&vis(ar)?rc(ar):null});};
  for(const el of document.querySelectorAll('#h4m .mk'))add('rescue',el);
  add('hold',q('hBod'));
  for(const el of document.querySelectorAll('#bMk .mk'))add('breach',el);
  const keep={};for(const id of ['pcKeys','hTk']){const el=q(id);if(vis(el)&&el.getBoundingClientRect().width>0)keep[id]=rc(el);}
  for(const id of ['tip','sub']){const el=q(id);if(vis(el)&&el.classList.contains('show')&&!el.classList.contains('wHide')&&el.getBoundingClientRect().width>2)keep[id]=rc(el);} // the hint card and the radio line
  return {W,H,mk,keep,st:__T.state,cine:!!__heads.CINE.on};};
// phone: the corners tcAvoid() protects (marker centre inside) — the FIRE / pause buttons
const zoneHit=(o,m)=>{const x=(m.box[0]+m.box[2])/2,y=(m.box[1]+m.box[3])/2;return (x>o.W-170&&y>o.H-160)||(x<100&&y<74);};
(async()=>{
 const b=await chromium.launch({args:ARGS});let fail=0;
 const runs=[['pc',{viewport:{width:1920,height:1080}}],['phone',{viewport:{width:844,height:390},deviceScaleFactor:2,isMobile:true,hasTouch:true}]].filter(r=>!ONLY||r[0]===ONLY);
 for(const [name,opt] of runs){
  console.log('=====',name,opt.viewport.width+'x'+opt.viewport.height);
  const ctx=await b.newContext(opt),p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  p.on('crash',()=>{console.log('PAGE CRASHED');process.exit(3);});b.on('disconnected',()=>{if(!global.__fin){console.log('BROWSER GONE (out of memory?)');process.exit(3);}});
  await p.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  await p.addInitScript(l=>{window.__noTip=0;window.__noTut=1;if(l==='en')window.__lang='en';},LANG);
  await p.goto(BASE+'/test.html?q=3');
  if(name==='pc'){await p.waitForFunction(()=>document.getElementById('play')&&!document.getElementById('play').disabled,null,{timeout:300000});await p.evaluate(()=>document.getElementById('play').click());}
  else{await p.waitForFunction(()=>{const g=document.getElementById('mmGo');return g&&!g.disabled;},null,{timeout:300000});await p.waitForTimeout(1500);await p.tap('#mmGo');}
  const step=s=>p.evaluate(n=>__step(n),Math.round(s/0.05));
  await p.evaluate(()=>document.fonts.ready);await step(1.5);
  // a scene: no spiders, a tank in the backpack (so the hold shows), `cl` floating clusters and `br` breaches, all in one corner of the ship
  const mkScene=async(cl,br)=>{
    await p.evaluate(([cl,br])=>{window.__noSpawn=1;__T.toSpawn=3;__heads.WB.bossT=0;__heads.WB.incT=0;for(const s of [...__heads.spiders])__heads.killSpider(s);const P=__heads.P,T=__THREE; // (3 spiders 'still to come' that never do: the round never ends, so no break, next round or boss cinematic)
      for(const pa of __T.PATCHES)pa.hp=25; // every plate whole again
      P.carry=24;__T.PCK&&(__T.PCK.c0=24);P.inv=1e9;__T.cargo=5000;
      const all=__T.PATCHES.slice(),piv=all.sort((a,c)=>(c.pos.x+c.pos.y*0.5)-(a.pos.x+a.pos.y*0.5))[0],acc=[];
      for(const pa of __T.PATCHES.slice().sort((a,c)=>a.pos.distanceTo(piv.pos)-c.pos.distanceTo(piv.pos))){if(acc.every(o=>o.pos.distanceTo(pa.pos)>5.5))acc.push(pa);if(acc.length>=6)break;}
      window.__acc=acc;for(const pa of acc.slice(0,cl))__T.leakFrom(pa,14);for(const pa of acc.slice(0,br))pa.hp=0;
      // the player floats away from the hull, looking at the corner from far off: the markers climb onto the edges as he turns
      const c=acc.reduce((s,pa)=>s.add(pa.pos),new T.Vector3()).multiplyScalar(1/acc.length);window.__P0=c.clone().add(new T.Vector3(34,10,-14));
      P.pos.copy(window.__P0);P.vel.set(0,0,0);window.__c=c;},[cl,br]);};
  const turnTo=async k=>{await p.evaluate(k=>{const P=__heads.P,c=window.__c;P.pos.copy(window.__P0);P.vel.set(0,0,0);const d=c.clone().sub(P.pos);
      P.yaw=Math.atan2(-d.x,-d.z)+k*Math.PI/12;P.pitch=0;window.__noSpawn=1;for(const s of [...__heads.spiders])__heads.killSpider(s);__T.toSpawn=3;__heads.WB.bossT=0;__heads.WB.incT=0;
      const m=document.getElementById('msg');if(m)m.style.display='none';},k);
    await step(0.6);await p.evaluate(()=>{const P=__heads.P;P.pos.copy(window.__P0);P.vel.set(0,0,0);});await step(0.1);};
  const snap=async fname=>{await p.evaluate(()=>{window.__manual=1;});await p.waitForTimeout(250);await p.evaluate(()=>__render());await p.waitForTimeout(300);
    await p.screenshot({path:shot(fname),timeout:180000});await p.evaluate(()=>{window.__manual=0;});};
  for(const [sn,cl,br] of [['heavy',5,4],['light',3,1]].filter(x=>!process.env.HEADS_SCENE||x[0]===process.env.HEADS_SCENE)){
    await mkScene(cl,br);
    console.log('--- scene',sn,'(clusters',cl,'breaches',br+')');
    if(!STAB){
      const turns=process.env.HEADS_TURNS?process.env.HEADS_TURNS.split(',').map(Number):[...Array(24).keys()];
      const poses=[];for(const k of turns){await turnTo(k);poses.push({k,...(await p.evaluate(collect))});}
      let nMk=0,pairs=0,arrowHits=0,keepHits=0,offscr=0,maxMk=0,best=null;const rows=[];
      for(const o of poses){const M=o.mk;maxMk=Math.max(maxMk,M.length);nMk+=M.length;let pp=0,ah=0,kh=0,os=0;const bad=[];
        for(let i=0;i<M.length;i++){
          const [l,t,r,bm]=M[i].box;if(l<-1||t<-1||r>o.W+1||bm>o.H+1){os++;bad.push('OUT '+M[i].kind+' '+M[i].txt);}
          for(let j=i+1;j<M.length;j++)if(area(M[i].box,M[j].box)>4){pp++;bad.push(M[i].kind+'['+M[i].txt+']×'+M[j].kind+'['+M[j].txt+']');}
          for(let j=0;j<M.length;j++)if(i!==j&&M[i].arrow&&area(M[i].arrow,M[j].box)>4){ah++;bad.push('ARROW of '+M[i].kind+'['+M[i].txt+'] over '+M[j].kind+'['+M[j].txt+']');}
          for(const id in o.keep)if(area(M[i].box,o.keep[id])>4){kh++;bad.push(M[i].kind+'['+M[i].txt+'] over #'+id);}
          if(name==='phone'&&zoneHit(o,M[i])){kh++;bad.push(M[i].kind+'['+M[i].txt+'] in the FIRE / pause corner');}}
        pairs+=pp;arrowHits+=ah;keepHits+=kh;offscr+=os;const off=M.filter(m=>m.off).length;
        if(process.env.HEADS_DEBUG&&(pp||ah||kh))for(const m of M)console.log('    ',m.kind.padEnd(6),m.txt.padEnd(24),'box',m.box.map(Math.round).join(','),m.off?'edge':'screen','arrow',m.arrow?m.arrow.map(Math.round).join(','):'-');
        rows.push({deg:o.k*15,st:o.st+(o.cine?'+cine':''),n:M.length,off,pairs:pp,arrowOnBox:ah,onKeepout:kh,outOfScreen:os,bad});
        if(!best||off>best.off)best={k:o.k,off};}
      for(const r of rows)console.log('turn',String(r.deg).padStart(3),r.st,'markers',r.n,'(at edge '+r.off+')','box×box',r.pairs,'arrow×box',r.arrowOnBox,'keepout',r.onKeepout,'out',r.outOfScreen,r.bad.length?JSON.stringify(r.bad.slice(0,4)):'');
      console.log('TOTAL',name,sn,JSON.stringify({turns:rows.length,markersSeen:nMk,maxMarkersAtOnce:maxMk,boxOverlaps:pairs,arrowOnBox:arrowHits,onKeepoutsOrCorners:keepHits,outOfScreen:offscr,keepouts:Object.keys(poses[0].keep)}));
      if(pairs||keepHits||offscr)fail=1;
      if(sn==='heavy'){const k=process.env.HEADS_TURN!=null?+process.env.HEADS_TURN:14;await turnTo(k);console.log('screenshot turn',k*15);await snap(name+'_markers.png');
        if(best.k!==k){await turnTo(best.k);console.log('screenshot turn',best.k*15,'(most markers at an edge: '+best.off+')');await snap(name+'_markers_b.png');}}
      else{await turnTo(best.k);console.log('screenshot turn',best.k*15);await snap(name+'_markers_light.png');}
    }
    if(process.env.HEADS_NOSTAB)continue;
    // stability: turn slowly (1° a frame, 120 frames)
    await p.evaluate(()=>{const P=__heads.P,c=window.__c;P.pos.copy(window.__P0);P.vel.set(0,0,0);const d=c.clone().sub(P.pos);window.__y0=Math.atan2(-d.x,-d.z)+Math.PI/2;P.yaw=window.__y0;P.pitch=0;});await step(0.8);
    const J=await p.evaluate(()=>{const prev=new Map(),hp=new Map(),ev=[],tl={};let jolts=0,worst=0,sum=0,n=0,flips=0,hidden=0;
      for(let f=0;f<120;f++){const P=__heads.P;P.pos.copy(window.__P0);P.vel.set(0,0,0);P.yaw=window.__y0+f*Math.PI/180;P.pitch=0;for(const s of [...__heads.spiders])__heads.killSpider(s);__T.toSpawn=3;__heads.WB.bossT=0;__heads.WB.incT=0;__step(1);
        for(const el of document.querySelectorAll('#h4m .mk,#hBod,#bMk .mk')){const hid=!!(el._dc&&el._dc.hide);if(hp.has(el)&&hp.get(el)!==hid)flips++;hp.set(el,hid);if(hid)hidden++;
          {const id=el.id||(el.classList.contains('brk')?'brk':'rsc')+[...el.parentNode.children].indexOf(el);tl[id]=(tl[id]||'')+(hid?'h':el.hidden||!el._s?'.':(el._dc&&(Math.abs(el._dc.tx)+Math.abs(el._dc.ty)>1))?'m':'o');}
          if(el.hidden||!el._s){prev.delete(el);continue;}const x=parseFloat(el.style.left),y=parseFloat(el.style.top),pv=prev.get(el);
          if(pv){const bs=Math.hypot(el._s.px-pv[2],el._s.py-pv[3]),ps=Math.hypot(x-pv[0],y-pv[1]),ex=ps-bs;sum+=Math.max(0,ex);n++;
            if(ex>40&&bs<160){jolts++;worst=Math.max(worst,ex);ev.push({f,t:el.id||el.textContent.trim().replace(/\s+/g,' ').slice(0,16),from:pv.slice(0,2).map(Math.round),to:[x,y].map(Math.round),baseStep:Math.round(bs),extra:Math.round(ex)});}}
          prev.set(el,[x,y,el._s.px,el._s.py]);}}
      ev.sort((a,b)=>b.extra-a.extra);return {markerFrames:n,jolts,worstExtraPx:Math.round(worst),avgExtraPxPerMarkerFrame:+(sum/Math.max(1,n)).toFixed(2),rescueHiddenFrames:hidden,hideShowFlips:flips,tl,ev:ev.slice(0,10)};});
    console.log('stability',name,sn,JSON.stringify({...J,ev:undefined,tl:undefined}));if(process.env.HEADS_DEBUG){for(const e of J.ev)console.log('  jolt',JSON.stringify(e));console.log('  timeline per marker, 1 char a frame (o natural, m moved, h hidden for lack of room, . not in use):');for(const k in J.tl)console.log('   ',k.padEnd(6),J.tl[k]);}
  }
  console.log('errors',JSON.stringify(errs.slice(0,5)));if(errs.length)fail=1;
  await ctx.close();}
 global.__fin=1;await b.close();console.log(fail?'FAIL':'PASS');process.exit(fail);})();
