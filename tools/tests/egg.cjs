// Egg (v76): the first egg of a device is shown in a short cinematic (once), and every egg carries a marker with a countdown ring (always).
// Cinematic (src/game/36-huevo.js): when the first egg is laid the lens cuts to a close, slightly high shot of the spider laying it, the world stands still, a big title shows in the
// middle («¡LAS ARAÑAS ESTÁN PONIENDO HUEVOS!» / «Destrúyelos antes de que eclosionen», EN «THE SPIDERS ARE LAYING EGGS!» / «Destroy them before they hatch»), a click / tap / key skips it,
// and the lens comes back to the astronaut. Remembered per device in localStorage ('heads_egg_seen'); ?huevo forces it on the first egg of every game.
// Marker (#eMk .mk.egg): red egg with a ring that empties over the 7.5 s to hatching, through the ship, stuck to the screen edge with an arrow off screen, kept apart from the hold / breach / rescue markers.
// Checks, per platform (PC 1024x576, phone 844x390):
//   1 first egg: title (ES) shown and centred, the egg and the spider in frame, the camera outside the ship and the rocks (INDEPENDENT of the game's camSolid: THREE.Raycaster on the ship meshes and the
//     rocks, both ways, + 14 short rays for "closer than 12 cm"), the world frozen (hatch timer, play time, spiders, rocks, round timers) while the egg grows and throbs, skip works (click / tap / key),
//     the camera comes back smoothly (no jump) or dips to black when the ship is in the way, then everything runs again; the old «¡UN HUEVO!» message does not show
//   2 the marker: on screen above the egg, ring empties with the hatch timer, pulse and `urg` near the end, stuck to the edge with an arrow when the egg is off screen, visible through the ship,
//     gone when the egg is destroyed and when it hatches
//   3 markers never overlap: eggs + hold + breaches + rescue clusters in one corner of the ship, the camera turns all the way round (every visible marker box and the arrow of the edge ones are measured,
//     also against the PC key hints / tank and the phone corners)
//   4 a second egg in the same game does not run the cinematic; after a reload (new game) it does not either; ?huevo forces it (on the first egg of that game only), also with the ship in the way
//   5 EN: the title in English (screenshot)  ·  no page errors
// Run on dist-test:   tools/run-test.sh dist-test tools/tests/egg.cjs       (HEADS_ONLY=pc|phone · HEADS_NOEN=1 skips the English run · HEADS_NOOVL=1 skips the overlap sweep)
// HEADS_NOSHOT=1 · HEADS_SHOT=<names>  (see snap)
// Screenshots (tools/tests/out/): egg_<pc|phone>_<es|en>_cine.png (title fully on) · egg_<pc|phone>_es_cine_b.png (early: the egg is still growing) · egg_<pc|phone>_marker.png · egg_<pc|phone>_marker_edge.png · egg_<pc|phone>_marker_ship.png
const {chromium}=require('playwright');
const {BASE,ARGS,shot,lateReady}=require('./lib.cjs');
const ONLY=process.env.HEADS_ONLY||'';
// HEADS_PART=cine,marker,eggs,overlap,reload,en (default all): the parts can run alone, each one sets its own scene up (a slow or crowded machine can kill a long run: a short one has a better chance)
const PARTS=new Set((process.env.HEADS_PART||'cine,marker,eggs,overlap,reload,en').split(',')),has=n=>PARTS.has(n);
// HEADS_MEM=1: after every check, the memory of this test's own Chromium processes (tells a leak from other agents' browsers eating the machine)
const memNow=()=>{try{const rows=require('child_process').execSync('ps -eo pid=,ppid=,rss=,args=').toString().trim().split('\n').map(l=>{const m=/^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/.exec(l);return m&&{pid:+m[1],ppid:+m[2],rss:+m[3],a:m[4]};}).filter(Boolean);
  const set=new Set([process.pid]);let ch=true;while(ch){ch=false;for(const r of rows)if(!set.has(r.pid)&&set.has(r.ppid)){set.add(r.pid);ch=true;}}
  return rows.filter(r=>set.has(r.pid)&&/headless_shell/.test(r.a)).map(r=>{const t=/--type=(\S+)/.exec(r.a);return (t?t[1]:'main')+' '+Math.round(r.rss/1024);}).filter(x=>/^(renderer|main|gpu-process) /.test(x)).join(' | ');}catch(e){return '?';}};
let bad=0;const ok=(c,m,i)=>{console.log((c?'  ok   ':'  FAIL ')+m+(i!==undefined?'  '+JSON.stringify(i):'')+(process.env.HEADS_MEM?'   [MB '+memNow()+']':''));if(!c)bad++;};
// (smaller than the usual 1280x720 / dsf 2: every frame drawn by the software GPU costs memory and time, and a crowded machine kills Chromium; the checks are all in CSS pixels or relative to the screen)
const PLAT={pc:{viewport:{width:1024,height:576}},phone:{viewport:{width:844,height:390},deviceScaleFactor:1,isMobile:true,hasTouch:true}};
const ES_T='¡LAS ARAÑAS ESTÁN PONIENDO HUEVOS!',ES_S='Destrúyelos antes de que eclosionen',EN_T='THE SPIDERS ARE LAYING EGGS!',EN_S='Destroy them before they hatch';

// ---------------------------------------------------------------- runs in the page (installed before the game loads, survives reloads)
function pageLib(){
  window.__egLib={
    // one spider crawling on the hull at (z,th) a good way from the astronaut; the rest gone; the round stays open (3 spiders "still to come" that never do)
    place(z,th,kind,look){window.__noCine=0;window.__noSpawn=1;__T.toSpawn=3;__heads.WB.bossT=0;__heads.WB.incT=0;for(const s of [...__heads.spiders])__heads.killSpider(s);
      const [pp,nn]=__hullPoint(z,th),P=__heads.P,T=__THREE;
      const s=__heads.spawnSpider(kind||'hunter');s.state='crawl';s.cd=99;s.z=z;s.th=th;s.pos.copy(pp);s.mesh.position.copy(pp);
      P.pos.copy(pp).addScaledVector(nn,9).add(new T.Vector3(0,0,14));P.vel.set(0,0,0);P.hp=100;P.inv=1e9;
      if(look!==false){const d=pp.clone().sub(P.pos);P.yaw=Math.atan2(-d.x,-d.z);P.pitch=Math.atan2(d.y,Math.hypot(d.x,d.z));}
      window.__sp=s;return pp.toArray();},
    // what must stand still during the cinematic
    world(){return {eggT:__heads.EGGS.map(e=>e.t),playT:__T.playT,toSpawn:__T.toSpawn,sp:__heads.spiders.map(s=>s.pos.toArray()),rocks:__heads.ROCKS.map(R=>R.c.z),cargo:__T.cargo,hp:__heads.P.hp,
      egg:__heads.EGGS.map(e=>({ph:e.ph,sc:e.g.scale.x,gt:e.gt}))};},
    // the camera against the REAL meshes (not camSolid): the way camera -> egg must not cross the ship or a rock, and the camera must not sit closer than 12 cm to a surface
    cam(){__camera.updateMatrixWorld(true);const T=__THREE,cam=__camera.position.clone(),e=__heads.EGGS[0],rc=new T.Raycaster();
      let root=__scene.getObjectByName('SM_HEADS_Ship_Body')||__scene.getObjectByName('SM_HEADS_Ship_TailFan_Rotor');while(root&&root.parent&&root.parent!==__scene)root=root.parent;
      root.updateMatrixWorld(true);const objs=[root,...__heads.ROCKS.filter(R=>R.mesh.visible).map(R=>{R.mesh.updateMatrixWorld(true);return R.mesh;})];
      const hit=(a,b)=>{const d=b.clone().sub(a),L=d.length();d.normalize();for(const [o,dd] of [[a,d],[b,d.clone().negate()]]){rc.set(o,dd);rc.far=L;const h=rc.intersectObjects(objs,true);if(h.length)return h[0].distance;}return -1;};
      const tgt=e.pos.clone().addScaledVector(cam.clone().sub(e.pos).normalize(),0.45); // (the egg itself sits on the hull: the last 45 cm do not count)
      const wall=hit(cam,tgt);let near=1e9;
      for(const v of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1],[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,-1],[0,1,1],[0,-1,-1]]){rc.set(cam,new T.Vector3(...v).normalize());rc.far=0.12;const h=rc.intersectObjects(objs,true);if(h.length)near=Math.min(near,h[0].distance);}
      const ndc=p=>{const q=p.clone().project(__camera);return {x:+q.x.toFixed(2),y:+q.y.toFixed(2),z:+q.z.toFixed(3)};};
      const s=window.__sp&&__heads.spiders.includes(window.__sp)?window.__sp:null;
      return {wall,near:near>1e8?null:+near.toFixed(3),camSolid:__cam.camSolid(cam,0.1),dEgg:+cam.distanceTo(e.pos).toFixed(2),egg:ndc(e.pos),spider:s?ndc(s.mesh.position):null,dSp:s?+s.mesh.position.distanceTo(e.pos).toFixed(2):null,fov:+__camera.fov.toFixed(1)};},
    // a segment against the ship and the rocks (is the egg hidden behind the ship?)
    blocked(a,b){const T=__THREE,rc=new T.Raycaster();let root=__scene.getObjectByName('SM_HEADS_Ship_Body')||__scene.getObjectByName('SM_HEADS_Ship_TailFan_Rotor');while(root&&root.parent&&root.parent!==__scene)root=root.parent;
      root.updateMatrixWorld(true);const A=new T.Vector3(...a),B=new T.Vector3(...b),d=B.clone().sub(A),L=d.length();d.normalize();rc.set(A,d);rc.far=L-0.5;return rc.intersectObject(root,true).length>0;},
    title(){const el=document.getElementById('eggT'),r=el.getBoundingClientRect(),cs=getComputedStyle(el);
      const tr=n=>{const g=document.createRange();g.selectNodeContents(el.querySelector(n));return g.getBoundingClientRect();},rb=tr('b'),rs=tr('small'); // (the element spans the whole width: measure the text)
      const l=Math.min(rb.left,rs.left),rr=Math.max(rb.right,rs.right);
      return {cls:el.className,op:+cs.opacity,b:el.querySelector('b').textContent,s:el.querySelector('small').textContent,cx:+(((l+rr)/2)/innerWidth).toFixed(3),cy:+((r.top+r.bottom)/2/innerHeight).toFixed(3),w:+((rr-l)/innerWidth).toFixed(2),lines:Math.round(rb.height/parseFloat(getComputedStyle(el.querySelector('b')).lineHeight)),
        bodyCine:document.body.classList.contains('cine'),fade:document.getElementById('eggFade').className,lb:getComputedStyle(document.querySelector('#lbB span')).opacity};},
    markers(){const rc=el=>{const r=el.getBoundingClientRect();return [r.left,r.top,r.right,r.bottom].map(v=>+v.toFixed(1));};
      return [...document.querySelectorAll('#eMk .mk')].map(el=>{const cs=getComputedStyle(el),ar=el.querySelector('.ar'),sc=/scale\(([\d.]+)\)/.exec(el.querySelector('.ei').style.transform);
        return {hidden:el.hidden,show:!el.hidden&&cs.display!=='none'&&cs.visibility!=='hidden',op:+cs.opacity,off:el.classList.contains('off'),urg:el.classList.contains('urg'),box:rc(el),arrow:ar&&getComputedStyle(ar).display!=='none'?rc(ar):null,
          arc:+el.querySelector('.arc').style.strokeDashoffset,pulse:sc?+sc[1]:1,ptr:cs.pointerEvents,txt:el.textContent.trim()};});},
    eggScreen(i){__camera.updateMatrixWorld(true);const q=__heads.EGGS[i||0].pos.clone().project(__camera);return {x:(q.x+1)/2*innerWidth,y:(1-q.y)/2*innerHeight,z:q.z};},
    aimAt(p){const P=__heads.P,d=new __THREE.Vector3(...p).sub(P.pos);P.yaw=Math.atan2(-d.x,-d.z);P.pitch=Math.atan2(d.y,Math.hypot(d.x,d.z));},
  };
}
const area=(A,B)=>Math.max(0,Math.min(A[2],B[2])-Math.max(A[0],B[0]))*Math.max(0,Math.min(A[3],B[3])-Math.max(A[1],B[1]));

// ---------------------------------------------------------------- the browser side
(async()=>{
 const b=await chromium.launch({args:ARGS});
 if(process.env.HEADS_MEM)setInterval(()=>console.log('   . ['+Math.round(process.uptime())+'s] '+memNow()),4000).unref();
 b.on('disconnected',()=>{if(!global.__fin){console.log('BROWSER GONE (out of memory?)');process.exit(3);}});
 const open=async(name,{lang='es',query='?q=3'}={})=>{
   const ctx=await b.newContext(PLAT[name]),p=await ctx.newPage();p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));p.on('crash',()=>{console.log('PAGE CRASHED');process.exit(3);});
   await p.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
   await p.addInitScript(pageLib);
   // no screenshots: hide the 3D canvas, so the browser never has to compose a frame with it (the first one costs ~1 GB on the software GPU; checks only need the page's text and boxes)
   if(!SHOTS.length)await p.addInitScript(()=>{const st=document.createElement('style');st.textContent='canvas{display:none!important}#eggT,#eggT *,#eggFade,#lbB,#lbB *{transition:none!important}';// (and no CSS transitions on the cinematic's own parts: without drawn frames they would never advance)
  document.addEventListener('DOMContentLoaded',()=>document.head.appendChild(st));});
   await p.addInitScript(l=>{window.__noTut=1;window.__noCine=1;if(l==='en')window.__lang='en';},lang); // __noCine=1 while booting (no round-start cinematic); place() turns it to 0: from then on the egg cinematic is on
   p.name=name;p.ctx=ctx;
   try{await load(p,query,50000);}catch(e){if(e&&e.slow&&(open.tries=(open.tries||0)+1)<=5){console.log('   (slow start on a busy machine: memory was piling up; closing this page and starting again, '+open.tries+'/5)');await ctx.close();return open(name,{lang,query});}throw e;}
   open.tries=0;return p;};
 const stage=t=>{if(process.env.HEADS_MEM)console.log('   ['+Math.round(process.uptime())+'s] '+t+'   [MB '+memNow()+']');};
 const load=async(p,query,maxLate)=>{
   stage('goto');await p.goto(BASE+'/test.html'+query);stage('loaded');
   if(p.name==='pc'){await p.waitForFunction(()=>document.getElementById('play')&&!document.getElementById('play').disabled,null,{polling:250,timeout:300000});await p.evaluate(()=>{document.getElementById('play').click();window.__manual=1;window.__noRender=1;});}
   else{await p.waitForFunction(()=>{const g=document.getElementById('mmGo');return g&&!g.disabled;},null,{polling:250,timeout:300000});await p.waitForTimeout(1500);await p.tap('#mmGo');await p.evaluate(()=>{window.__manual=1;window.__noRender=1;});}
   // (__manual=1 + __noRender=1 right after JUGAR: the live loop stops and nothing is drawn while the late models come in; only __step() runs the game from then on. On a crowded machine the first
   //  frames drawn meanwhile made Chromium pile up memory (30 MB/s in the page and the browser) until it was killed. __step() and __render() switch drawing back on when the test wants it.)
   stage('JUGAR pressed');const t0=Date.now();for(;;){if(await p.evaluate(()=>!!(window.__late&&Object.values(window.__late.s).every(v=>v!==0))))break;if(maxLate&&Date.now()-t0>maxLate)throw Object.assign(new Error('slow start'),{slow:true});await p.waitForTimeout(400);}stage('late models in');await p.evaluate(()=>document.fonts.ready);await p.evaluate(()=>{if(window.__step.__wrapped)return;const o=window.__step;const w=(n,dt)=>{o(n,dt);window.__manual=1;window.__noRender=1;};w.__wrapped=1;window.__step=w;});await step(p,1.5);stage('booted');};
 const step=(p,s)=>p.evaluate(n=>__step(n),Math.round(s/0.05));
 // Screenshots: HEADS_NOSHOT=1 skips them all (the checks need no drawing, and the first frame drawn by the software GPU costs ~1 GB: on a crowded machine that is what gets Chromium killed),
 // HEADS_SHOT=cine_b,marker_edge,... takes only those (the part of the file name after egg_<pc|phone>_ and before .png)
 const SHOTS=process.env.HEADS_NOSHOT?[]:(process.env.HEADS_SHOT||'all').split(',');
 const snap=async(p,fname)=>{const key=fname.replace(/^egg_(pc|phone)_/,'').replace(/\.png$/,'');if(!SHOTS.includes('all')&&!SHOTS.includes(key))return;
   await p.evaluate(()=>{window.__manual=1;});await p.waitForTimeout(700);await p.evaluate(()=>__render());await p.waitForTimeout(200);
   await p.screenshot({path:shot(fname),timeout:240000});await p.evaluate(()=>{window.__manual=1;window.__noRender=1;});};
 const ev=(p,f,a)=>p.evaluate(f,a);
 const skip=async p=>{if(p.name==='pc')await p.keyboard.press('Enter');else await p.touchscreen.tap(420,200);};
 const cineState=p=>p.evaluate(()=>({on:__heads.CINE.on,mode:__heads.CINE.mode,t:+__heads.CINE.t.toFixed(2),dur:__heads.CINE.dur}));

 for(const name of ['pc','phone'].filter(n=>!ONLY||n===ONLY)){
  console.log('=====',name,PLAT[name].viewport.width+'x'+PLAT[name].viewport.height);
  let p=await open(name);
  let r,t1,m,sc;const W=PLAT[name].viewport.width,H=PLAT[name].viewport.height;
  // an egg laid without the cinematic (for the parts that do not start from it)
  const ensureEgg=async()=>{if(await ev(p,()=>__heads.EGGS.length))return;await ev(p,()=>{__heads.EGGC.seen=true;__egLib.place(2,Math.PI/2);});await step(p,1.0);await ev(p,()=>__heads.tryLayEgg());await step(p,0.6);};

  // ---------------- 1) the first egg: cinematic
  if(has('cine')){
  console.log('1) the first egg of the device runs the cinematic');
  r=await ev(p,()=>({seen:localStorage.getItem('heads_egg_seen'),cine:__heads.CINE.on}));
  ok(r.seen===null&&!r.cine,'a fresh device: nothing remembered, no cinematic running',r);
  await ev(p,()=>__egLib.place(2,Math.PI/2));await step(p,1.0);
  r=await ev(p,()=>({lay:__heads.tryLayEgg(),cine:__heads.CINE.on,mode:__heads.CINE.mode,dur:__heads.CINE.dur,eggs:__heads.EGGS.length,stats:__heads.stats.eggs,seen:localStorage.getItem('heads_egg_seen'),cls:document.body.className}));
  ok(r.lay===true&&r.cine&&r.mode==='egg'&&r.eggs===1&&r.stats===1,'tryLayEgg() lays the egg and starts the egg cinematic',r);
  ok(r.dur>=2.2&&r.dur<=3.2,'about 2.5 s long',{dur:r.dur});
  ok(r.seen==='1','remembered on the device (localStorage heads_egg_seen)',{seen:r.seen});
  ok(/\bcine\b/.test(r.cls),'body.cine (the HUD hides like in the other cinematics)',{cls:r.cls});
  const w0=await ev(p,()=>__egLib.world());
  await step(p,0.2);t1=await ev(p,()=>__egLib.title());
  ok(t1.cls.indexOf('on')<0&&t1.op<0.2,'the title is not up yet at 0.2 s (it comes in a moment after the cut)',{cls:t1.cls,op:t1.op});
  await step(p,0.3);await p.waitForTimeout(900);await snap(p,'egg_'+name+'_es_cine_b.png');
  await step(p,0.5);await p.waitForTimeout(900); // t ≈ 1.0 s
  await p.waitForFunction(()=>{const e=document.getElementById('eggT');return e&&+getComputedStyle(e).opacity>0.95;},null,{timeout:30000}).catch(()=>{}); // (the CSS transition can lag on a crowded machine)
  t1=await ev(p,()=>__egLib.title());const cs=await cineState(p);
  ok(cs.on&&cs.t>0.9&&cs.t<1.2,'still running at 1.0 s',cs);
  ok(t1.b===ES_T&&t1.s===ES_S,'the title text is real text in Spanish',{b:t1.b,s:t1.s});
  ok(/\bon\b/.test(t1.cls)&&t1.op>0.95,'the title is fully shown',{cls:t1.cls,op:t1.op});
  ok(Math.abs(t1.cx-0.5)<0.02&&t1.cy>0.25&&t1.cy<0.55,'centred (horizontally in the middle, vertically around the middle) on '+name,{cx:t1.cx,cy:t1.cy});
  ok(t1.w<=0.95,'does not run off the screen',{w:t1.w});
  ok(t1.bodyCine&&+t1.lb>0.9,'the skip hint is up',{lb:t1.lb});
  const cam=await ev(p,()=>__egLib.cam());
  ok(cam.wall===-1,'the way from the camera to the egg crosses no ship or rock triangle (real meshes)',cam);
  ok(cam.near===null&&cam.camSolid===false,'the camera is not within 12 cm of the ship or a rock',cam);
  ok(cam.dEgg>1.8&&cam.dEgg<8,'close shot (camera '+cam.dEgg+' m from the egg)',{dEgg:cam.dEgg});
  ok(Math.abs(cam.egg.x)<0.85&&Math.abs(cam.egg.y)<0.9&&cam.egg.z<1,'the egg is in frame',cam.egg);
  ok(cam.spider&&Math.abs(cam.spider.x)<1&&Math.abs(cam.spider.y)<1&&cam.spider.z<1,'the spider that laid it is in frame (it is '+cam.dSp+' m from the egg)',cam.spider);
  await snap(p,'egg_'+name+'_es_cine.png');
  const w1=await ev(p,()=>__egLib.world());
  ok(w1.eggT[0]===0&&w0.eggT[0]===0,'the hatch timer did not advance',{t:w1.eggT});
  ok(Math.abs(w1.playT-w0.playT)<0.02&&w1.toSpawn===w0.toSpawn,'play time and the round did not advance (1.0 s of cinematic = '+(w1.playT-w0.playT).toFixed(4)+' s of game)',{d:w1.playT-w0.playT});
  ok(w1.sp.every((q,i)=>Math.hypot(q[0]-w0.sp[i][0],q[1]-w0.sp[i][1],q[2]-w0.sp[i][2])<0.03),'the spiders stand still',{});
  ok(w1.rocks.every((z,i)=>Math.abs(z-w0.rocks[i])<0.01),'the rocks stand still',{});
  ok(w1.egg[0].ph>w0.egg[0].ph+0.5&&w1.egg[0].sc>0.6,'...while the egg grows and throbs',{from:w0.egg[0],to:w1.egg[0]});
  r=await ev(p,()=>({msg:(document.getElementById('msg')||{}).textContent+'|'+((document.getElementById('mAlert')||{}).textContent||'')+'|'+((document.getElementById('mFeed')||{}).textContent||''),n:document.querySelectorAll('.ft').length}));
  ok(!/UN HUEVO/.test(r.msg),'the old «¡UN HUEVO!» message did not show',{msg:r.msg.slice(0,80)});
  ok(await ev(p,()=>__heads.P.vel.length()===0&&__heads.P.inv>=1),'the astronaut is held and safe during it',{});

  console.log('   skip ('+(name==='pc'?'Enter key':'tap')+') and the way back');
  // watch the camera frame by frame from the skip to the end
  await skip(p);await step(p,0.05);
  const bk=await ev(p,()=>{const cur=__camera.position.clone(),seq=[],E=__heads.EGGC;let prev=cur,mx=0,bl='';
    for(let i=0;i<20&&__heads.CINE.on;i++){__step(1);if(E.blend)bl=E.blend;const q=__camera.position.clone();const d=q.distanceTo(prev);mx=Math.max(mx,d);seq.push(+d.toFixed(2));prev=q;}
    return {on:__heads.CINE.on,blend:bl,maxJump:+mx.toFixed(2),seq,fadeOn:document.getElementById('eggFade').className};});
  ok(!bk.on,'a skip ends the cinematic within 0.7 s',{on:bk.on,frames:bk.seq.length});
  // (the shot can be 15+ m from the astronaut: the glide is eased over 0.7 s, so a 50 ms test frame can cover 2 m; a jump is one frame with the whole distance)
  ok(bk.blend==='lerp'||bk.blend==='cut','the way back was chosen ('+bk.blend+')',{blend:bk.blend});
  ok(bk.blend!=='lerp'||(bk.seq.length>=8&&bk.maxJump<0.2*bk.seq.reduce((a,c)=>a+c,0)),'the lens glides back in many small steps (biggest step '+bk.maxJump+' m of '+bk.seq.reduce((a,c)=>a+c,0).toFixed(1)+' m)',{seq:bk.seq});
  await p.waitForTimeout(500);
  const fol=await ev(p,()=>({cine:document.body.classList.contains('cine'),title:document.getElementById('eggT').className,fade:document.getElementById('eggFade').className,dCam:+__camera.position.distanceTo(__heads.P.pos).toFixed(2),fov:+__camera.fov.toFixed(1)}));
  ok(!fol.cine&&fol.title.indexOf('on')<0&&fol.fade.indexOf('on')<0,'cinematic classes are gone',fol);
  ok(fol.dCam<5&&fol.fov>=61,'back on the follow camera behind the astronaut',fol);
  const w2=await ev(p,()=>__egLib.world());await step(p,1.0);const w3=await ev(p,()=>__egLib.world());
  ok(w3.eggT[0]>0.9&&w3.playT-w2.playT>0.9,'the game runs again: hatch timer and play time advance',{eggT:w3.eggT[0],dPlay:+(w3.playT-w2.playT).toFixed(2)});
  ok(await ev(p,()=>document.querySelectorAll('#eMk .mk:not([hidden])').length)===1,'the egg marker is up right after the cinematic',{});
  }

  // ---------------- 2) the marker
  if(has('marker')){
  if(!has('cine'))await ensureEgg();
  console.log('2) the egg marker');
  await ev(p,()=>{const e=__heads.EGGS[0];__egLib.aimAt(e.pos.toArray());});await step(p,0.3);
  m=await ev(p,()=>__egLib.markers());sc=await ev(p,()=>__egLib.eggScreen());
  ok(m.length===1&&m[0].show&&m[0].op>0.99&&!m[0].off,'one marker, shown, on screen (not at the edge)',m[0]);
  {const cx=(m[0].box[0]+m[0].box[2])/2,cy=(m[0].box[1]+m[0].box[3])/2;
   ok(Math.abs(cx-sc.x)<70&&cy<sc.y&&sc.y-cy<150,'it hangs just above the egg ('+Math.round(cx-sc.x)+' px across, '+Math.round(sc.y-cy)+' px above)',{cx,cy,egg:sc});
   ok(m[0].box[0]>=0&&m[0].box[2]<=W&&m[0].box[1]>=0&&m[0].box[3]<=H,'fully inside the screen',m[0].box);}
  ok(m[0].ptr==='none'&&m[0].txt==='','not tappable, and no text of its own',{ptr:m[0].ptr,txt:m[0].txt});
  await snap(p,'egg_'+name+'_marker.png');
  // the ring empties with the hatch timer
  const rt=async()=>ev(p,()=>({t:__heads.EGGS[0]?__heads.EGGS[0].t:-1,m:__egLib.markers()[0]}));
  let a0=await rt();await step(p,0.9);let a1=await rt();await step(p,0.9);let a2=await rt(); // (hatching is at 7.5 s: a0 ≈ 1.3 s, a1 ≈ 2.2, a2 ≈ 3.1)
  const exp=x=>-(x.t/7.5)*100;
  ok(a0.m.arc<=0&&a1.m.arc<a0.m.arc&&a2.m.arc<a1.m.arc,'the ring empties as time passes ('+a0.m.arc+' → '+a1.m.arc+' → '+a2.m.arc+')',{});
  ok([a0,a1,a2].every(x=>Math.abs(x.m.arc-exp(x))<2.5),'and follows the hatch timer (7.5 s): offset = −t/7.5·100',[a0,a1,a2].map(x=>({t:+x.t.toFixed(2),arc:x.m.arc,want:+exp(x).toFixed(1)})));
  ok(!a1.m.urg&&!a2.m.urg,'calm at the start (not yet urgent)',{});
  // the pulse: same heartbeat as the egg, faster and stronger near the end
  const pul=async()=>ev(p,()=>{const o={ph:[],sc:[]};for(let i=0;i<20;i++){__step(1);const e=__heads.EGGS[0];if(!e)break;o.ph.push(e.ph);o.sc.push(__egLib.markers()[0].pulse);}return {dph:o.ph.length?o.ph[o.ph.length-1]-o.ph[0]:0,max:Math.max(...o.sc),min:Math.min(...o.sc),n:o.ph.length};});
  const early=await pul();await step(p,1.3);const late=await pul(); // (early ≈ 3.1-4.1 s, late ≈ 5.4-6.4 s; it hatches at 7.5)
  const lm=await rt();
  ok(late.dph>early.dph*1.25,'it throbs faster near the end ('+early.dph.toFixed(2)+' → '+late.dph.toFixed(2)+' beats in 1 s)',{early,late});
  ok(late.max>1.03&&late.min<late.max,'the icon pulses (scale '+late.min+'–'+late.max+')',{early,late});
  ok(lm.m&&lm.m.urg,'the last 2.2 s: urgent look (gold ring, blinking)',{t:lm.t,urg:lm.m&&lm.m.urg});
  // off screen: the astronaut turns his back on the egg
  await ev(p,()=>{const e=__heads.EGGS[0];e.t=Math.min(e.t,2);__egLib.aimAt(e.pos.toArray());__heads.P.yaw+=Math.PI*0.75;});await step(p,0.8);
  m=await ev(p,()=>__egLib.markers());
  ok(m.length===1&&m[0].show&&m[0].off&&m[0].arrow,'egg off screen: the marker sticks to the edge with an arrow',{off:m[0].off,arrow:!!m[0].arrow,box:m[0].box});
  ok(m[0].box[0]>=0&&m[0].box[2]<=W&&m[0].box[1]>=0&&m[0].box[3]<=H&&(m[0].arrow?m[0].arrow[0]>=-1&&m[0].arrow[2]<=W+1&&m[0].arrow[1]>=-1&&m[0].arrow[3]<=H+1:true),'marker and arrow inside the screen',m[0]);
  await snap(p,'egg_'+name+'_marker_edge.png');
  // through the ship: the astronaut is under the ship, the egg on top of it
  const sh=await ev(p,()=>{const e=__heads.EGGS[0];const P=__heads.P;P.pos.set(e.pos.x*0.2,-13,e.pos.z-4);P.vel.set(0,0,0);__egLib.aimAt(e.pos.toArray());e.t=Math.min(e.t,2);
    return {blocked:__egLib.blocked(P.pos.toArray(),e.pos.toArray()),egg:e.pos.toArray()};});
  await step(p,0.6);
  m=await ev(p,()=>__egLib.markers());sc=await ev(p,()=>__egLib.eggScreen());
  ok(sh.blocked,'(the ship is between the camera and the egg)',sh);
  ok(m[0]&&m[0].show&&m[0].op>0.99,'the marker still shows through the ship',m[0]);
  await snap(p,'egg_'+name+'_marker_ship.png');
  }

  // ---------------- 4) a second egg: no cinematic
  if(has('eggs')){
  if(!has('cine')&&!has('marker'))await ensureEgg();
  console.log('4) second egg, destroyed, hatched');
  await ev(p,()=>{__egLib.place(-3,Math.PI/2+0.4,'flanker');});await step(p,0.8);
  r=await ev(p,()=>({lay:__heads.tryLayEgg(),cine:__heads.CINE.on,eggs:__heads.EGGS.length,stats:__heads.stats.eggs}));
  ok(r.lay===true&&!r.cine&&r.eggs>=1,'a second egg in the same game: laid, no cinematic',r);
  await step(p,0.5);
  // a marker for each egg
  m=await ev(p,()=>__egLib.markers());ok(m.filter(x=>x.show).length===await ev(p,()=>__heads.EGGS.length),'one marker per egg',{markers:m.filter(x=>x.show).length});
  // destroyed: the marker goes
  const n0=await ev(p,()=>__heads.EGGS.length);await ev(p,()=>{__heads.destroyEgg(__heads.EGGS[0]);});await step(p,0.15);
  m=await ev(p,()=>__egLib.markers());
  ok(await ev(p,()=>__heads.EGGS.length)===n0-1&&m.filter(x=>x.show).length===n0-1,'an egg destroyed: its marker is gone',{eggs:n0-1,shown:m.filter(x=>x.show).length});
  // hatched: the marker goes
  await ev(p,()=>{__heads.P.pos.set(0,25,40);__heads.P.inv=1e9;});
  for(let k=0;k<12&&(await ev(p,()=>__heads.EGGS.length))>0;k++){await ev(p,()=>{__heads.P.hp=100;});await step(p,1.0);}
  m=await ev(p,()=>__egLib.markers());
  ok(await ev(p,()=>__heads.EGGS.length)===0&&m.filter(x=>x.show).length===0,'an egg hatched: its marker is gone',{shown:m.filter(x=>x.show).length});
  }

  // ---------------- 3) markers never overlap (eggs + hold + breaches + rescue, one corner of the ship, the camera turns all the way round)
  if(has('overlap')&&!process.env.HEADS_NOOVL){
   console.log('3) the markers keep apart (turning all the way round)');
   await ev(p,()=>{window.__noCine=1;}); // (eggs laid directly here: no cinematic)
   await ev(p,()=>{window.__noSpawn=1;__T.toSpawn=3;__heads.WB.bossT=0;__heads.WB.incT=0;for(const s of [...__heads.spiders])__heads.killSpider(s);const P=__heads.P,T=__THREE;
     for(const pa of __T.PATCHES)pa.hp=25;P.carry=24;__T.PCK&&(__T.PCK.c0=24);P.inv=1e9;__T.cargo=5000;
     const piv=__T.PATCHES.slice().sort((a,c)=>(c.pos.x+c.pos.y*0.5)-(a.pos.x+a.pos.y*0.5))[0],acc=[];
     for(const pa of __T.PATCHES.slice().sort((a,c)=>a.pos.distanceTo(piv.pos)-c.pos.distanceTo(piv.pos))){if(acc.every(o=>o.pos.distanceTo(pa.pos)>5.5))acc.push(pa);if(acc.length>=6)break;}
     for(const pa of acc.slice(0,3))__T.leakFrom(pa,14);for(const pa of acc.slice(0,3))pa.hp=0; // three breaches + their clusters
     for(const pa of acc.slice(1,4))__heads.layEgg(pa.z+0.7,pa.th+0.12); // three eggs in the same corner
     const c=acc.reduce((s,pa)=>s.add(pa.pos),new T.Vector3()).multiplyScalar(1/acc.length);window.__P0=c.clone().add(new T.Vector3(34,10,-14));window.__c=c;P.pos.copy(window.__P0);});
   const collect=()=>p.evaluate(()=>{__step(1);const W=innerWidth,H=innerHeight,q=id=>document.getElementById(id);
     const vis=el=>el&&!el.hidden&&getComputedStyle(el).display!=='none'&&getComputedStyle(el).visibility!=='hidden';
     const rc=el=>{const r=el.getBoundingClientRect();return [r.left,r.top,r.right,r.bottom].map(v=>+v.toFixed(1));};
     const mk=[],add=(kind,el)=>{if(!vis(el))return;const ar=el.classList.contains('off')?el.querySelector('.ar'):null;mk.push({kind,txt:el.textContent.trim().replace(/\s+/g,' '),box:rc(el),off:el.classList.contains('off'),arrow:ar&&vis(ar)?rc(ar):null});};
     for(const el of document.querySelectorAll('#eMk .mk'))add('egg',el);for(const el of document.querySelectorAll('#h4m .mk'))add('rescue',el);add('hold',q('hBod'));for(const el of document.querySelectorAll('#bMk .mk'))add('breach',el);
     const keep={};for(const id of ['pcKeys','hTk']){const el=q(id);if(vis(el)&&el.getBoundingClientRect().width>0)keep[id]=rc(el);}
     for(const id of ['tip','sub']){const el=q(id);if(vis(el)&&el.classList.contains('show')&&!el.classList.contains('wHide')&&el.getBoundingClientRect().width>2)keep[id]=rc(el);}
     return {W,H,mk,keep};});
   const turnTo=async k=>{await p.evaluate(k=>{const P=__heads.P,c=window.__c;P.pos.copy(window.__P0);P.vel.set(0,0,0);const d=c.clone().sub(P.pos);P.yaw=Math.atan2(-d.x,-d.z)+k*Math.PI/12;P.pitch=0;
       window.__noSpawn=1;for(const s of [...__heads.spiders])__heads.killSpider(s);__T.toSpawn=3;__heads.WB.bossT=0;__heads.WB.incT=0;for(const e of __heads.EGGS)e.t=0; // (the eggs never hatch during the sweep)
       const mm=document.getElementById('msg');if(mm)mm.style.display='none';},k);await step(p,0.6);await p.evaluate(()=>{const P=__heads.P;P.pos.copy(window.__P0);P.vel.set(0,0,0);for(const e of __heads.EGGS)e.t=0;});await step(p,0.1);};
   let pairs=0,arrowHits=0,keepHits=0,outS=0,nEgg=0,nEdge=0,maxMk=0,best=null;const rows=[];
   for(let k=0;k<24;k+=1){await turnTo(k);const o=await collect(),M=o.mk;maxMk=Math.max(maxMk,M.length);let pp=0,ah=0,kh=0,os=0;const badl=[];
     for(let i=0;i<M.length;i++){const [l,t,rr,bm]=M[i].box;if(l<-1||t<-1||rr>o.W+1||bm>o.H+1){os++;badl.push('OUT '+M[i].kind);}
       if(M[i].kind==='egg'){nEgg++;if(M[i].off)nEdge++;}
       for(let j=i+1;j<M.length;j++)if(area(M[i].box,M[j].box)>4){pp++;badl.push(M[i].kind+'×'+M[j].kind);}
       for(let j=0;j<M.length;j++)if(i!==j&&M[i].arrow&&area(M[i].arrow,M[j].box)>4){ah++;badl.push('ARROW of '+M[i].kind+' over '+M[j].kind);}
       for(const id in o.keep)if(area(M[i].box,o.keep[id])>4){kh++;badl.push(M[i].kind+' over #'+id);}
       if(name==='phone'){const x=(M[i].box[0]+M[i].box[2])/2,y=(M[i].box[1]+M[i].box[3])/2;if((x>o.W-170&&y>o.H-160)||(x<100&&y<74)){kh++;badl.push(M[i].kind+' in the FIRE / pause corner');}}}
     pairs+=pp;arrowHits+=ah;keepHits+=kh;outS+=os;const edge=M.filter(m=>m.off).length;rows.push({deg:k*15,n:M.length,edge,pp,ah,kh,os,badl});if(!best||edge>best.edge)best={k,edge};}
   for(const x of rows.filter(x=>x.pp||x.ah||x.kh||x.os))console.log('   turn',x.deg,'markers',x.n,'box×box',x.pp,'arrow×box',x.ah,'keepout',x.kh,'out',x.os,JSON.stringify(x.badl.slice(0,4)));
   ok(pairs===0&&arrowHits===0&&keepHits===0&&outS===0,'no marker overlaps another, a keep-out or leaves the screen ('+rows.length+' turns, up to '+maxMk+' markers at once, '+nEgg+' egg marker sightings, '+nEdge+' of them at an edge)',{pairs,arrowHits,keepHits,outS});
   ok(nEgg>=20&&nEdge>=3,'the sweep really saw egg markers on screen and at the edge',{nEgg,nEdge});
   await turnTo(best.k);await snap(p,'egg_'+name+'_markers_all.png');
   for(const e of await ev(p,()=>__heads.EGGS.slice().map((e,i)=>i)))void e;
   await ev(p,()=>{for(const e of [...__heads.EGGS])__heads.destroyEgg(e);window.__noCine=0;});
  }
  ok(p.errs.length===0,'no page errors (first load)',p.errs.slice(0,3));

  // ---------------- 4b) a reload = a new game on the same device: remembered, no cinematic
  if(has('reload')){
  if(!has('cine'))await ev(p,()=>localStorage.setItem('heads_egg_seen','1')); // (the remembering itself is part of 'cine')
  await load(p,'?q=3');
  r=await ev(p,()=>({seen:localStorage.getItem('heads_egg_seen')}));
  ok(r.seen==='1','after a reload the device still remembers it',r);
  await ev(p,()=>__egLib.place(2,Math.PI/2));await step(p,1.0);
  r=await ev(p,()=>({lay:__heads.tryLayEgg(),cine:__heads.CINE.on,eggs:__heads.EGGS.length,msg:document.getElementById('msg').innerHTML+'|'+((document.getElementById('mAlert')||{}).textContent||'')+'|'+((document.getElementById('mFeed')||{}).textContent||'')}));
  ok(r.lay===true&&!r.cine&&r.eggs===1,'a new game on the same device: the first egg has no cinematic',{lay:r.lay,cine:r.cine,eggs:r.eggs});
  await step(p,0.4);
  ok(/UN HUEVO/.test(await ev(p,()=>document.getElementById('msg').textContent+'|'+((document.getElementById('mAlert')||{}).textContent||'')+'|'+((document.getElementById('mFeed')||{}).textContent||''))),'...and gets the usual «¡UN HUEVO!» message instead',{});
  ok(await ev(p,()=>document.querySelectorAll('#eMk .mk:not([hidden])').length)===1,'...with its marker',{});

  // ---------------- 4c) ?huevo forces it, ship in the way (the far side of the ship: the way back must not cross it)
  await load(p,'?q=3&huevo');
  ok(await ev(p,()=>localStorage.getItem('heads_egg_seen'))==='1','(still remembered; ?huevo does not need or change it)',{});
  // the astronaut on top of the ship, the spider on its belly (z=-4: more than 4 m from the side hatch, or tryLayEgg() would not pick it): the lens that sees the egg is under the ship
  await ev(p,()=>{__egLib.place(-4,-Math.PI/2,'hunter',false);const P=__heads.P;P.pos.set(0,9,2);P.vel.set(0,0,0);});await step(p,1.0);
  r=await ev(p,()=>{const lay=__heads.tryLayEgg();return {lay,cine:__heads.CINE.on,mode:__heads.CINE.mode,late:JSON.stringify(__late.s),seen:__heads.EGGC.seen,sp:lay?undefined:__heads.spiders.map(s=>({k:s.kind,st:s.state,dP:+s.pos.distanceTo(__heads.P.pos).toFixed(1),dH:+s.pos.distanceTo(__T.HATCH).toFixed(1)}))};});
  ok(r.lay===true&&r.cine&&r.mode==='egg','?huevo: the cinematic runs again on the first egg',r);
  if(!r.lay)throw new Error('no egg could be laid: '+JSON.stringify(r));
  await step(p,0.6);const c2=await ev(p,()=>__egLib.cam());
  ok(c2.wall===-1&&c2.near===null&&c2.camSolid===false,'also with the egg on the belly (far side): the lens is outside the ship',c2);
  const fb=await ev(p,()=>{const E=__heads.EGGC;let prev=__camera.position.clone(),mx=0,fade=false,seq=[];
    let bl='';for(let i=0;i<90&&__heads.CINE.on;i++){__step(1);if(E.blend)bl=E.blend;const q=__camera.position.clone();mx=Math.max(mx,q.distanceTo(prev));prev=q;if(document.getElementById('eggFade').classList.contains('on'))fade=true;}
    return {on:__heads.CINE.on,blend:bl,maxJump:+mx.toFixed(2),fade};});
  ok(!fb.on,'it ends by itself',fb);
  ok(fb.blend==='cut'?fb.fade:true,'the way back from the far side: '+(fb.blend==='cut'?'the ship is in the way, so a quick dip to black (no flight through the hull)':'a glide that crosses neither ship nor rocks')+' (blend: '+fb.blend+', biggest step '+fb.maxJump+' m)',fb);
  await step(p,0.6);
  await ev(p,()=>{__egLib.place(-3,Math.PI/2+0.4,'flanker');});await step(p,0.8);
  r=await ev(p,()=>({lay:__heads.tryLayEgg(),cine:__heads.CINE.on}));
  ok(r.lay===true&&!r.cine,'?huevo: only the first egg of the game (a second one has none)',r);
  ok(await ev(p,()=>localStorage.getItem('heads_egg_seen'))==='1','still remembered',{});
  ok(p.errs.length===0,'no page errors (reload and ?huevo)',p.errs.slice(0,3));
  }

  // ---------------- 5) English
  if(has('en')&&!process.env.HEADS_NOEN){
   try{await p.ctx.close();}catch(e){}
   console.log('5) English');
   p=await open(name,{lang:'en'});
   await ev(p,()=>__egLib.place(2,Math.PI/2));await step(p,1.0);
   r=await ev(p,()=>({lay:__heads.tryLayEgg(),cine:__heads.CINE.on}));ok(r.lay&&r.cine,'EN: the first egg of a fresh device runs the cinematic',r);
   await step(p,1.0);await p.waitForFunction(()=>{const e=document.getElementById('eggT');return e&&+getComputedStyle(e).opacity>0.95;},null,{timeout:30000}).catch(()=>{});await p.waitForTimeout(300);t1=await ev(p,()=>__egLib.title()); // (polls until the title has faded in: on a crowded machine the CSS transition can lag behind)
   ok(t1.b===EN_T&&t1.s===EN_S&&/\bon\b/.test(t1.cls)&&t1.op>0.95,'EN title: «'+t1.b+'» / «'+t1.s+'»',{b:t1.b,s:t1.s,op:t1.op});
   ok(Math.abs(t1.cx-0.5)<0.02&&t1.cy>0.25&&t1.cy<0.55&&t1.w<=0.95,'EN title centred and inside the screen',{cx:t1.cx,cy:t1.cy,w:t1.w});
   await snap(p,'egg_'+name+'_en_cine.png');
   ok(p.errs.length===0,'no page errors (EN)',p.errs.slice(0,3));
   await p.ctx.close();}
 }
 global.__fin=1;await b.close();
 console.log(bad?'FAILED '+bad:'ALL OK');process.exit(bad?1:0);})();
