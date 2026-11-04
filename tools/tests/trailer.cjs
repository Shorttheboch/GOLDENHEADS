// v84: trailer mode (?trailer, src/game/42-trailer.js). Run on dist-test:   tools/run-test.sh dist-test tools/tests/trailer.cjs
//   HEADS_ONLY=main|neg|ronda|vert (one part) · HEADS_SHOTS=0 (no pictures)
// The game runs in real time here (slow motion and the freeze act on the loop's own clock, so they cannot be stepped by hand); every key is a real key event.
//   main   (?trailer, PC 960x540) no metrics request at all and no ranking call even with both switched on for the test, no stats question, no save reminder,
//          music off (M still switches it), help panel (H), cursor hidden in play; 1 god mode (hits, laser / burn damage over time, a swarm biting) ·
//          2 ship freeze (bites happen, plates and cargo stay) · 3 every HUD element and message hidden and back · 4 slow motion 1/2 and 1/4 of world time ·
//          5 freeze: nothing moves while the free camera flies · 6 free camera: moves, looks (drag), zooms, never shoots or dashes, the astronaut stays,
//          and it comes back to exactly the camera it left · U I O P J K spawns in front of you on the hull (waiting for a model still on its way) ·
//          T with the boss scene · L clears everything with no points, drops or banners · 0 holds the round · 7 EXTRA POWER pose twice in a row ·
//          8 cargo to full · 9 a plate breaks and leaks (also with 2 on: cargo floored, no game over)
//   neg    (no ?trailer) every trailer key changes nothing (positions, hp, cargo, plates, camera, HUD, classes, spawns), no help panel, metrics still go out
//   ronda  (?trailer&ronda=14) both work together
//   vert   (?trailer&vertical) 1080x1920 picture and canvas in a 1080x1920 window (HUD laid out in portrait, no overlaps), letterboxed in 1920x1080
//          (HUD hidden by default), &escala=2 = 2160x3840; pictures in the test's out dir: trailer_*.png
const {chromium}=require('playwright');
const {BASE,ARGS,shot,lateReady}=require('./lib.cjs');
let bad=0;const ok=(c,m,i)=>{console.log((c?'  ok   ':'  FAIL ')+m+(i!==undefined?'  '+JSON.stringify(i).slice(0,600):''));if(!c)bad++;};
const ONLY=process.env.HEADS_ONLY||'',SHOTS=process.env.HEADS_SHOTS!=='0';
const API=/\/api\/(m|run|scores|auth|save|me|nick|forget)\b/;

async function boot(b,q,{w=960,h=540,init}={}){
  const ctx=await b.newContext({viewport:{width:w,height:h}});const p=await ctx.newPage();p.errs=[];p.api=[];
  p.on('pageerror',e=>p.errs.push(e.message));p.on('crash',()=>{console.log('PAGE CRASHED (out of memory?)');process.exit(3);});
  await p.route('**/api/**',r=>{p.api.push(r.request().url().replace(/^https?:\/\/[^/]+/,''));r.fulfill({status:204,body:''});});
  await p.addInitScript(()=>{window.__noMetrics=0;window.__rankOn=1;}); // both on for the test: the trailer must still send nothing
  if(init)await p.addInitScript(init);
  await p.goto(BASE+'/test.html'+q);
  await p.waitForFunction(()=>document.getElementById('play')&&!document.getElementById('play').disabled,null,{timeout:300000});
  return p;}
const play=async p=>{await p.evaluate(()=>document.getElementById('play').click());await p.waitForFunction(()=>window.__T&&__T.state==='play',null,{timeout:60000});await p.waitForTimeout(600);};
const key=async(p,k,ms=120)=>{await p.keyboard.press(k);await p.waitForTimeout(ms);};
const frames=(p,n=3)=>p.evaluate(n=>new Promise(r=>{let k=0;const f=()=>{if(++k>=n)r();else requestAnimationFrame(f);};requestAnimationFrame(f);}),n);
const V=a=>a.map(x=>Math.round(x*1000)/1000);
// is a world point on screen (in front of the camera)?
const inView=(p,pts)=>p.evaluate(pts=>{const T=__THREE,c=__camera;c.updateMatrixWorld();return pts.map(a=>{const v=new T.Vector3(...a).project(c);return v.z<1&&Math.abs(v.x)<1&&Math.abs(v.y)<1;});},pts);
const camPose=p=>p.evaluate(()=>{const c=__camera;return {p:c.position.toArray(),q:c.quaternion.toArray(),fov:c.fov};});
const angQ=(a,b)=>{const d=Math.abs(a[0]*b[0]+a[1]*b[1]+a[2]*b[2]+a[3]*b[3]);return 2*Math.acos(Math.min(1,d));};
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
// a quiet start: hold the round, no spiders, the astronaut beside the ship looking at its flank (so "in front, on the hull" is on screen)
async function stage(p){
  await p.evaluate(()=>{const P=__heads.P;P.pos.set(9.5,2.2,3);P.vel.set(0,0,0);P.yaw=Math.PI/2;P.pitch=-0.12;P.hp=100;P.inv=0;__T.showcase=0;});
  await p.waitForTimeout(1200);}
const HUD_IDS=['hTop','hVit','hScore','hTank','hTk','cross','msg','sub','tip','pcKeys','hint','boss','round','combo','tut','xpT','xpS','eggT','h4m','eMk','fxLayer','dep','rep','ammo','pwr','lbT','lbB','hp','dash','dust','hatchInd','repPrompt'];
const opac=(p,ids)=>p.evaluate(ids=>Object.fromEntries(ids.map(i=>{const e=document.getElementById(i);return [i,e?getComputedStyle(e).opacity:null];})),ids);

async function main(b){
  console.log('\n=== main: ?trailer (PC 960x540) ===');
  const p=await boot(b,'?trailer');
  let r=await p.evaluate(()=>({cls:document.body.className,ask:!!document.getElementById('mtAsk'),help:!!document.getElementById('trHelp'),helpHidden:document.getElementById('trHelp').hidden,
    want:window.menuMusic?menuMusic.info().want:null,mt:__trailer.MT.on,qa:__trailer.QA.lvl}));
  ok(/\btrailer\b/.test(r.cls),'body.trailer',r.cls);ok(!r.ask,'no anonymous-stats question in the menu');ok(r.help&&r.helpHidden,'help panel there, hidden at start');
  ok(r.want===false,'menu music off');ok(r.mt===false,'metrics off');ok(r.qa===0,'quality level 0 (locked)',r.qa);
  await play(p);
  r=await p.evaluate(()=>({mus:__trailer.musicOn,cur:getComputedStyle(document.getElementById('c')).cursor,cls:document.body.className,rank:__ronda.rankOn,qaOn:__trailer.QA.on}));
  ok(r.mus===false,'game music starts off',r);ok(r.cur==='none'&&/trPlay/.test(r.cls),'mouse cursor hidden while playing',r);ok(r.rank===false,'online ranking off');ok(r.qaOn===false,'automatic quality off');
  await key(p,'KeyM');ok(await p.evaluate(()=>__trailer.musicOn)===true,'M switches the game music on');await key(p,'KeyM');ok(await p.evaluate(()=>__trailer.musicOn)===false,'... and off again');
  await key(p,'KeyH');r=await p.evaluate(()=>{const H=document.getElementById('trHelp');return {hidden:H.hidden,txt:H.innerText,vis:H.getBoundingClientRect().width>50};});
  ok(!r.hidden&&r.vis&&/MODO TRÁILER/.test(r.txt)&&/INVENCIBLE/.test(r.txt)&&/CÁMARA LIBRE/.test(r.txt),'H shows the help panel',r.txt.slice(0,80));
  if(SHOTS)await p.screenshot({path:shot('trailer_help.png')});
  await key(p,'KeyH');ok(await p.evaluate(()=>document.getElementById('trHelp').hidden),'H hides it');
  await key(p,'Digit0');ok(await p.evaluate(()=>__trailer.TRA.hold),'0 holds the round');
  await key(p,'KeyL');await stage(p);
  ok(await p.evaluate(()=>__heads.spiders.length===0&&__heads.INCS.length===0),'L cleared the opening spiders');

  console.log('-- 1 god mode');
  await p.evaluate(()=>{__T.damagePlayer(10,new __THREE.Vector3(1,0,0));});
  r=await p.evaluate(()=>__heads.P.hp);ok(r<100,'(control) a hit hurts without it',r);
  await p.evaluate(()=>{__heads.P.hp=100;__heads.P.inv=0;});
  await key(p,'Digit1');ok(await p.evaluate(()=>__trailer.TRA.god),'1 = god mode on');
  await p.evaluate(()=>{__T.damagePlayer(40,new __THREE.Vector3(1,0,0));});r=await p.evaluate(()=>({hp:__heads.P.hp,inv:__heads.P.inv}));ok(r.hp===100,'a hit takes nothing',r);
  await p.evaluate(()=>{__heads.P.hp=37;__heads.P.burn=3;});await frames(p,3);r=await p.evaluate(()=>({hp:__heads.P.hp,burn:__heads.P.burn}));
  ok(r.hp>=99&&!(r.burn>0),'damage over time (laser, burns) is floored every frame',r);
  // a real swarm right on top of the astronaut for 5 s
  await key(p,'KeyI');
  r=await p.evaluate(()=>new Promise(res=>{let mn=100,n=0;const t0=performance.now();const f=()=>{mn=Math.min(mn,__heads.P.hp);n++;if(performance.now()-t0<5000&&__T.state==='play')requestAnimationFrame(f);else res({mn,n,state:__T.state,sp:__heads.spiders.length,leaps:__heads.spiders.filter(s=>s.state==='leap'||s.state==='drift').length});};f();}));
  ok(r.mn>=97&&r.state==='play','5 s among a swarm: the suit never drops (min hp), still playing',r);
  await key(p,'KeyL');

  console.log('-- 2 ship freeze');
  r=await p.evaluate(()=>{const pa=__T.PATCHES[0];pa.hp=25;__heads.damagePatch(pa,5);const h=pa.hp;pa.hp=25;pa.leak=0;pa.prog=0;return h;});ok(r===20,'(control) a bite takes 5 hp without it',r);
  await key(p,'Digit2');ok(await p.evaluate(()=>__trailer.TRA.ship),'2 = ship freeze on');
  // a devourer chewing a plate far from you (the bites happen: alarm, eat state), and cargo floor
  r=await p.evaluate(()=>{const P=__heads.P,PA=__T.PATCHES.slice().sort((a,b)=>b.pos.distanceTo(P.pos)-a.pos.distanceTo(P.pos))[0];
    for(const Z of __T.ZONES)Z.alarmT=0;const s=__heads.spawnSpider('lurker');s.z=PA.z-0.3;s.th=PA.th;__hullPoint(s.z,s.th)[0];s.pos.copy(__hullPoint(s.z,s.th)[0]);s.mesh.position.copy(s.pos);
    s.patch=PA;s.state='eat';s.t=0;s.aggro=0;s.cd=99;window.__eatPa=PA;window.__eatS=s;return {d:PA.pos.distanceTo(P.pos),z:PA.zone.name};});
  const c0=await p.evaluate(()=>__T.cargo);
  r=await p.evaluate(()=>new Promise(res=>{let eat=0,n=0,mc=1e9;const t0=performance.now();const f=()=>{n++;if(window.__eatS.state==='eat')eat++;mc=Math.min(mc,__T.cargo);if(performance.now()-t0<3000)requestAnimationFrame(f);else res({eat,n,hp:__eatPa.hp,alarm:__eatPa.zone.alarmT>0,mc,all:__T.PATCHES.every(x=>x.hp===25),state:__T.state});};f();}));
  ok(r.eat>r.n*0.5&&r.alarm,'the spider bites (eating, alarm went off)',r);ok(r.hp===25&&r.all,'no plate loses hp',r);ok(r.mc>=c0,'the cargo never goes down',{c0,min:r.mc});
  await key(p,'KeyL');

  console.log('-- 3 HUD');
  const op0=await opac(p,HUD_IDS);
  await key(p,'Digit3');
  r=await p.evaluate(()=>document.body.classList.contains('trNoHud'));ok(r,'3 = HUD hidden (body.trNoHud)');
  const op1=await opac(p,HUD_IDS);ok(Object.values(op1).every(v=>v===null||v==='0'),'every HUD element and message has opacity 0',op1);
  r=await p.evaluate(()=>({c:getComputedStyle(document.getElementById('c')).opacity,toast:getComputedStyle(document.getElementById('trToast')).display}));
  ok(r.c==='1'&&r.toast==='none','the picture stays; no notices while hidden',r);
  // the red 3D sign above the last spiders (round 2+, nothing left to come, 2 spiders or fewer)
  await p.evaluate(()=>{__T.startWave(1);__T.toSpawn=0;window.__mk=__heads.spawnSpider('hunter');});await frames(p,3);
  r=await p.evaluate(()=>{const m=window.__mk.mesh.userData.mark;return m?m.visible:null;});ok(r===false,'the red 3D sign above the last spiders is hidden too',r);
  if(SHOTS){await key(p,'KeyU',600);await p.screenshot({path:shot('trailer_pc_clean.png')});}
  await key(p,'Digit3');const op2=await opac(p,HUD_IDS),ST=['hTop','hVit','hScore','hTank','hTk','cross'];
  ok(ST.every(i=>op2[i]===op0[i]),'3 again: the HUD as it was',{op0,op2});
  r=await p.evaluate(()=>{const m=window.__mk.mesh.userData.mark;return m?m.visible:null;});ok(r===true,'... the red sign too',r);
  if(SHOTS)await p.screenshot({path:shot('trailer_pc_hud.png')});
  await key(p,'KeyL');

  console.log('-- 4 slow motion · 5 freeze');
  const rate=()=>p.evaluate(()=>new Promise(res=>{const a=__T.playT,t0=performance.now();setTimeout(()=>res((__T.playT-a)/((performance.now()-t0)/1000)),1500);}));
  const r1=await rate();await key(p,'Digit4');const r2=await rate();await key(p,'Digit4');const r3=await rate();
  ok(Math.abs(r2/r1-0.5)<0.1,'4: world at 1/2',{r1,r2,k:r2/r1});ok(Math.abs(r3/r1-0.25)<0.07,'4 again: world at 1/4',{r3,k:r3/r1});
  await key(p,'Digit4');r=await p.evaluate(()=>__trailer.TRA.slow);ok(r===1,'4 again: back to 1x',r);
  await key(p,'KeyU');await key(p,'KeyU');await p.waitForTimeout(400);
  await key(p,'Digit5');ok(await p.evaluate(()=>__trailer.TRA.pause),'5 = world frozen');
  const snapW=()=>p.evaluate(()=>({sp:__heads.spiders.map(s=>s.mesh.position.toArray()),pt:__T.playT,rot:__heads.P.pos.toArray()}));
  const w0=await snapW();await p.waitForTimeout(1000);const w1=await snapW();
  const mv=Math.max(...w0.sp.map((a,i)=>dist(a,w1.sp[i])));ok(mv<0.01&&w1.pt-w0.pt<0.01,'nothing moves in 1 s (spiders, game clock)',{mv,dt:w1.pt-w0.pt});

  console.log('-- 6 free camera');
  const cam0=await camPose(p);
  await key(p,'Digit6');ok(await p.evaluate(()=>__trailer.TRA.fc&&document.body.classList.contains('trFree')),'6 = free camera on');
  await p.keyboard.down('KeyW');await p.waitForTimeout(700);await p.keyboard.up('KeyW');
  let cam1=await camPose(p);ok(dist(cam1.p,cam0.p)>0.5,'it flies while the world is frozen (W)',{moved:dist(cam1.p,cam0.p)});
  const w2=await snapW();ok(Math.max(...w0.sp.map((a,i)=>dist(a,w2.sp[i])))<0.01,'... and the world is still frozen');
  await key(p,'Digit6');let cam2=await camPose(p);
  ok(dist(cam2.p,cam0.p)<1e-3&&angQ(cam2.q,cam0.q)<1e-3&&Math.abs(cam2.fov-cam0.fov)<0.01,'6 again: exactly the camera it left',{dp:dist(cam2.p,cam0.p),da:angQ(cam2.q,cam0.q)});
  await key(p,'Digit5');ok(!(await p.evaluate(()=>__trailer.TRA.pause)),'5 again: the world runs');
  // running world: the free camera moves, looks, zooms, changes speed; the astronaut does nothing (no move, no dash, no shot, no turn)
  await key(p,'KeyL');await p.evaluate(()=>{__heads.P.vel.set(0,0,0);});await p.waitForTimeout(500);
  const a0=await p.evaluate(()=>({pos:__heads.P.pos.toArray(),yaw:__heads.P.yaw,pitch:__heads.P.pitch,shots:__heads.stats.shots,cd:__heads.P.dashCD}));
  await key(p,'Digit6');const f0=await p.evaluate(()=>({yaw:__trailer.FC.yaw,fov:__trailer.FC.fov,base:__trailer.FC.base}));
  await p.keyboard.down('ShiftLeft');await p.keyboard.down('KeyD');await p.keyboard.down('Space');await p.waitForTimeout(500);await p.keyboard.up('Space');await p.keyboard.up('KeyD');await p.keyboard.up('ShiftLeft');
  await p.mouse.move(480,270);await p.mouse.down();await p.mouse.move(560,250,{steps:6});await p.mouse.up();await p.mouse.click(480,270);
  await key(p,'ArrowLeft',300);await key(p,'Comma');await key(p,'Comma');await p.mouse.wheel(0,-120);await p.waitForTimeout(300);
  const a1=await p.evaluate(()=>({pos:__heads.P.pos.toArray(),yaw:__heads.P.yaw,pitch:__heads.P.pitch,shots:__heads.stats.shots,cd:__heads.P.dashCD,vel:__heads.P.vel.length()}));
  const f1=await p.evaluate(()=>({yaw:__trailer.FC.yaw,fov:__trailer.FC.fov,base:__trailer.FC.base,cam:__camera.position.toArray(),fovCam:__camera.fov}));
  ok(Math.abs(f1.yaw-f0.yaw)>0.05,'mouse drag / arrows turn the free camera',{f0,f1});ok(Math.abs(f1.fov-f0.fov-4)<0.01&&Math.abs(f1.fovCam-f1.fov)<0.01,', , zooms out (fov +4)',f1.fov);
  ok(f1.base>f0.base,'the wheel changes its speed',f1.base);
  ok(dist(a0.pos,a1.pos)<0.05&&a1.yaw===a0.yaw&&a1.pitch===a0.pitch&&a1.shots===a0.shots&&a1.vel<0.2,'the astronaut stays: no move, no turn, no dash (Shift), no shot (click)',{a0,a1});
  await key(p,'Digit6');await p.waitForTimeout(300);
  r=await p.evaluate(()=>({d:__camera.position.distanceTo(__heads.P.pos),fov:__camera.fov}));ok(r.d>2&&r.d<5&&Math.abs(r.fov-62)<4,'back to the follow camera',r);

  console.log('-- spawns in front, on the hull');
  await lateReady(p);await key(p,'KeyL');await stage(p);
  const spot=await p.evaluate(()=>{const [z,th]=__trailer.trSpot();return __hullPoint(z,th)[0].toArray();});
  ok((await inView(p,[spot]))[0],'the spawn spot (view x hull) is on screen',spot);
  const cnt=()=>p.evaluate(()=>({sp:__heads.spiders.length,inc:__heads.INCS.length,egg:__heads.EGGS.length,kinds:__heads.spiders.map(s=>s.kind)}));
  let c=await cnt();await key(p,'KeyU',200);
  r=await p.evaluate(()=>{const s=__heads.spiders[__heads.spiders.length-1],q=__hullPoint(s.z,s.th)[0];return {kind:s.kind,state:s.state,onHull:s.pos.distanceTo(q),pos:s.pos.toArray()};});
  ok(r.kind==='hunter'&&r.onHull<0.05,'U: one spider on the hull',r);ok((await inView(p,[r.pos]))[0]&&dist(r.pos,spot)<3,'... in front of you',{d:dist(r.pos,spot)});
  c=await cnt();await key(p,'KeyI',200);let c2=await cnt();
  r=await p.evaluate(n=>__heads.spiders.slice(n).map(s=>s.pos.toArray()),c.sp);const iv=await inView(p,r);
  ok(c2.sp-c.sp===14,'I: a swarm of 14',c2.sp-c.sp);ok(iv.filter(Boolean).length>=iv.length*0.7,'... mostly in view',iv.filter(Boolean).length+'/'+iv.length);
  // O: the Escupidora, waiting while its model is "still downloading"
  await p.evaluate(()=>{window.__late.s.crab=0;});c=await cnt();await key(p,'KeyO',300);
  r=await p.evaluate(()=>({q:__trailer.TRQ.length,sp:__heads.spiders.filter(s=>s.kind==='spitter').length}));ok(r.q===1&&r.sp===0,'O while the crab is downloading: queued, nothing yet',r);
  await p.evaluate(()=>{window.__late.s.crab=1;});await frames(p,3);
  r=await p.evaluate(()=>{const s=__heads.spiders.find(s=>s.kind==='spitter');return s?{state:s.state,tgt:s.fall?s.fall.tgt.toArray():null,q:__trailer.TRQ.length}:null;});
  ok(r&&r.state==='fall'&&r.q===0,'... it comes once the model is in, falling from the sky',r);
  if(r&&r.tgt){ok((await inView(p,[r.tgt]))[0]&&dist(r.tgt,spot)<5,'... onto the spot in front of you',{d:dist(r.tgt,spot)});}
  c=await cnt();await key(p,'KeyP',300);r=await p.evaluate(()=>{const e=__heads.INCS[__heads.INCS.length-1];return e?{st:e.st,tgt:e.fall?e.fall.tgt.toArray():null}:null;});
  ok(r&&r.st==='fall','P: an Incineradora falls',r);if(r&&r.tgt)ok((await inView(p,[r.tgt]))[0]&&dist(r.tgt,spot)<5,'... onto the spot in front of you',{d:dist(r.tgt,spot)});
  c=await cnt();await key(p,'KeyJ',300);c2=await cnt();r=await p.evaluate(()=>{const e=__heads.EGGS[__heads.EGGS.length-1];return e?e.pos.toArray():null;});
  ok(c2.egg-c.egg===1&&r&&(await inView(p,[r]))[0],'J: an egg in front of you',r);ok(!(await p.evaluate(()=>__heads.CINE.on)),'... without its scene (T off)');
  c=await cnt();await key(p,'KeyK',300);c2=await cnt();ok(c2.sp-c.sp===8&&c2.kinds.slice(c.sp).every(k=>k==='brood'),'K: a brood of 8 crías',c2.kinds.slice(c.sp));
  if(SHOTS){await p.waitForTimeout(1500);await p.screenshot({path:shot('trailer_pc_spawns.png')});}
  // let the bosses land and spit a little, then clear everything
  await p.waitForTimeout(2500);
  const s0=await p.evaluate(()=>({score:__T.score,pts:__heads.pts,drops:__heads.DROPS.length,combo:document.getElementById('combo').textContent,kills:__heads.stats.kills,wave:__T.wave,acid:__heads.ACID.length}));
  await key(p,'KeyL',300);
  r=await p.evaluate(()=>({sp:__heads.spiders.length,inc:__heads.INCS.length,egg:__heads.EGGS.length,acid:__heads.ACID.length,score:__T.score,pts:__heads.pts,drops:__heads.DROPS.length,combo:document.getElementById('combo').textContent,kills:__heads.stats.kills,boss:document.getElementById('boss').hidden,state:__T.state}));
  ok(r.sp===0&&r.inc===0&&r.egg===0&&r.acid===0,'L: spiders, crías, Escupidora, Incineradora, eggs and acid all gone',r);
  ok(r.score===s0.score&&r.pts===s0.pts&&r.drops===s0.drops&&r.combo===s0.combo&&r.kills===s0.kills,'... no points, no drops, no banner, no kills counted',{s0,r});
  ok(r.boss&&r.state==='play','... boss bar gone, still playing',r);
  // T: the Escupidora with her first-time scene
  await key(p,'KeyT');ok(await p.evaluate(()=>__trailer.TRA.cine),'T = boss scenes on');
  await key(p,'KeyO',300);r=await p.evaluate(()=>({on:__heads.CINE.on,mode:__heads.CINE.mode}));ok(r.on&&r.mode==='boss','O with T: the Escupidora comes with her scene',r);
  await key(p,'KeyL',300);r=await p.evaluate(()=>({on:__heads.CINE.on,cine:document.body.classList.contains('cine')}));ok(!r.on&&!r.cine,'L also ends a boss scene cleanly',r);
  await key(p,'KeyT');

  console.log('-- 0 hold');
  await p.evaluate(()=>{__T.toSpawn=6;__heads.WB.bossT=1.5;});const h0=await p.evaluate(()=>({w:__T.wave,ts:__T.toSpawn,bt:__heads.WB.bossT}));
  await p.waitForTimeout(3000);
  r=await p.evaluate(()=>({sp:__heads.spiders.length,w:__T.wave,ts:__T.toSpawn,bt:__heads.WB.bossT,brk:__T.inBreak}));
  ok(r.sp===0&&r.w===h0.w&&r.ts===6&&r.bt===1.5&&!r.brk,'held: no spawns, no boss timer, no round advance in 3 s',r);
  await key(p,'Digit0');await p.waitForTimeout(3000);
  r=await p.evaluate(()=>({sp:__heads.spiders.length,ts:__T.toSpawn}));ok(r.sp>0||r.ts<6,'0 again: the round carries on (spiders come)',r);
  await key(p,'Digit0');await key(p,'KeyL');await p.evaluate(()=>{__heads.WB.bossT=0;});

  console.log('-- 7 EXTRA POWER');
  const pose=()=>p.evaluate(()=>new Promise(res=>{const X=__xp.XP;let k=0,seen=X.pp>=0;const t0=performance.now();
    const f=()=>{if(X.pp>=0)seen=true;k=Math.max(k,X.k);if(performance.now()-t0<2500&&!(seen&&X.pp<0))requestAnimationFrame(f);else res({seen,k,on:X.on,end:X.pp<0});};f();}));
  await key(p,'Digit7',30);let x1=await pose();await key(p,'Digit7',30);let x2=await pose();
  ok(x1.seen&&x1.k>0.8&&x1.end&&x1.on,'7: EXTRA POWER with the whole pose',x1);ok(x2.seen&&x2.k>0.8&&x2.end&&x2.on,'7 again right after: the pose plays again',x2);

  console.log('-- 8 cargo · 9 plate');
  await p.evaluate(()=>{__T.cargo=300;});await key(p,'Digit8');ok(await p.evaluate(()=>__T.cargo)===1000,'8: cargo back to full');
  await key(p,'Digit2');ok(!(await p.evaluate(()=>__trailer.TRA.ship)),'(ship freeze off)');
  const b0=await p.evaluate(()=>({broken:__T.PATCHES.filter(x=>x.hp<=0).length,loose:__trailer.looseCount(),cargo:__T.cargo}));
  await key(p,'Digit9',400);
  const b1=await p.evaluate(()=>{const pa=__T.PATCHES.filter(x=>x.hp<=0);return {broken:pa.length,loose:__trailer.looseCount(),cargo:__T.cargo,pos:pa.map(x=>x.pos.toArray())};});
  ok(b1.broken===b0.broken+1,'9: one plate breaks',b1.broken);ok(b1.loose>b0.loose&&b1.cargo<b0.cargo,'... and the trichomes leak out (loose up, cargo down)',{b0,b1:{loose:b1.loose,cargo:b1.cargo}});
  ok((await inView(p,[b1.pos[b1.pos.length-1]]))[0],'... a plate in view');
  if(SHOTS){await p.waitForTimeout(500);await p.screenshot({path:shot('trailer_pc_leak.png')});}
  await key(p,'Digit2');const fc0=await p.evaluate(()=>__T.cargo);
  await key(p,'Digit9',400);r=await p.evaluate(()=>({broken:__T.PATCHES.filter(x=>x.hp<=0).length,loose:__trailer.looseCount()}));
  ok(r.broken===b1.broken+1&&r.loose>b1.loose,'9 with 2 on: it still breaks and leaks',r);
  await p.waitForTimeout(1500);ok(await p.evaluate(()=>__T.cargo)>=fc0,'... but the cargo on board does not go down',{fc0});
  for(let i=0;i<16;i++)await key(p,'Digit9',60);await p.waitForTimeout(800);
  r=await p.evaluate(()=>({broken:__T.PATCHES.filter(x=>x.hp<=0).length,ship:__trailer.shipHp(),state:__T.state}));ok(r.broken===16&&r.state==='play','every plate broken with 2 on: no game over',r);

  console.log('-- the end of a game: no ranking, no save reminder');
  await p.evaluate(()=>{__MUS().endGame(false,'dead');});await p.waitForTimeout(1500);
  r=await p.evaluate(()=>({state:__T.state,cls:document.body.className,tabs:!document.getElementById('endTabs').hidden&&document.getElementById('endBox').classList.contains('rk')}));
  ok(r.state==='dead'&&!/trPlay/.test(r.cls),'game over: the cursor is back',r);ok(!r.tabs,'no ranking panel on the end plate',r);
  await key(p,'KeyR',800);r=await p.evaluate(()=>({state:__T.state,acct:document.getElementById('acct').hidden}));ok(r.state==='play'&&r.acct,'R retries at once: no «¿GUARDAMOS TU PUNTUACIÓN?»',r);
  ok(p.api.length===0,'not a single /api request in the whole session (metrics, ranking, accounts)',p.api);
  ok(p.errs.length===0,'no page errors',p.errs.slice(0,4));
  await p.context().close();}

async function neg(b){
  console.log('\n=== neg: no ?trailer ===');
  const p=await boot(b,'');
  let r=await p.evaluate(()=>({cls:document.body.className,help:!!document.getElementById('trHelp'),toast:!!document.getElementById('trToast'),tr:window.__trailer===undefined,ask:!!document.getElementById('mtAsk')}));
  ok(!/\btr[A-Z]|\btrailer\b/.test(r.cls)&&!r.help&&!r.toast&&r.tr,'no trailer class, no help panel, no notice element',r);ok(r.ask,'the stats question is there as always');
  await play(p);await lateReady(p);await p.waitForTimeout(800);
  r=await p.evaluate(()=>({cur:getComputedStyle(document.getElementById('c')).cursor,mus:__MUS().on}));ok(r.cur!=='none'&&r.mus===true,'cursor and music as always',r);
  // stop the loop: nothing moves between the two pictures but the keys
  await p.evaluate(()=>{window.__manual=1;});await p.waitForTimeout(200);
  const snap=()=>p.evaluate(()=>{const H=__heads,P=H.P,c=__camera,R=v=>Math.round(v*1e6)/1e6,A=a=>a.map(R);
    return JSON.stringify({pos:A(P.pos.toArray()),yaw:R(P.yaw),pitch:R(P.pitch),hp:P.hp,vel:A(P.vel.toArray()),sp:H.spiders.map(s=>s.kind+A(s.pos.toArray())),eggs:H.EGGS.length,incs:H.INCS.length,acid:H.ACID.length,
      cargo:__T.cargo,plates:__T.PATCHES.map(x=>x.hp),cam:A(c.position.toArray()),q:A(c.quaternion.toArray()),fov:c.fov,cls:document.body.className,xp:__xp.XP.on,xpp:__xp.XP.pp,wave:__T.wave,toSpawn:__T.toSpawn,
      cine:H.CINE.on,shots:H.stats.shots,mus:__MUS().on,help:!!document.getElementById('trHelp'),op:['hTop','cross','msg','tip'].map(i=>getComputedStyle(document.getElementById(i)).opacity)});});
  const s0=await snap();
  for(const k of ['Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9','Digit0','KeyU','KeyI','KeyO','KeyP','KeyJ','KeyK','KeyL','KeyT','KeyH','KeyZ','Comma','Period'])await p.keyboard.press(k);
  await p.mouse.wheel(0,-120);await p.waitForTimeout(300);
  const s1=await snap();ok(s0===s1,'every trailer key (and the wheel) changes nothing: positions, hp, spawns, cargo, plates, camera, HUD, classes',s0===s1?undefined:{s0:s0.slice(0,300),s1:s1.slice(0,300)});
  // a few frames later still nothing of the trailer (no queued spawn, no time scale, normal camera)
  const n0=await p.evaluate(()=>__heads.spiders.length);
  await p.evaluate(()=>{__step(30);});
  r=await p.evaluate(()=>({sp:__heads.spiders.length,eggs:__heads.EGGS.length,incs:__heads.INCS.length,cls:document.body.className,d:__camera.position.distanceTo(__heads.P.pos)}));
  ok(r.sp<=n0+2&&r.eggs===0&&r.incs===0&&!/\btr[A-Z]/.test(r.cls)&&r.d>2&&r.d<4.5,'30 frames later: no spawns of its own, follow camera',r);
  await p.waitForTimeout(500);
  ok(p.api.some(u=>/\/api\/m\b/.test(u)),'metrics still go out (/api/m at the start of the game)',p.api);
  ok(p.errs.length===0,'no page errors',p.errs.slice(0,4));
  await p.context().close();}

async function ronda(b){
  console.log('\n=== ronda: ?trailer&ronda=14 ===');
  const p=await boot(b,'?trailer&ronda=14');await play(p);await lateReady(p);
  let r=await p.evaluate(()=>({wave:__T.wave,rank:__ronda.rankOn,mt:__trailer.MT.on,cls:document.body.className,mus:__trailer.musicOn}));
  ok(r.wave===13&&r.rank===false&&r.mt===false&&/trailer/.test(r.cls)&&r.mus===false,'round 14, ranking and metrics off, trailer on',r);
  await key(p,'Digit0');await key(p,'Digit1');await key(p,'KeyL');await stage(p);
  const n=await p.evaluate(()=>__heads.spiders.length);await key(p,'KeyU');await key(p,'KeyP',300);
  r=await p.evaluate(()=>({sp:__heads.spiders.length,inc:__heads.INCS.length,god:__trailer.TRA.god,hold:__trailer.TRA.hold}));
  ok(r.sp===n+1&&r.inc===1&&r.god&&r.hold,'keys work there too (spider, Incineradora, god, hold)',r);
  ok(p.api.length===0,'no /api request',p.api);ok(p.errs.length===0,'no page errors',p.errs.slice(0,4));
  await p.context().close();}

async function vert(b){
  console.log('\n=== vert: ?trailer&vertical ===');
  let p=await boot(b,'?trailer&vertical',{w:1080,h:1920});
  let r=await p.evaluate(()=>{const c=document.getElementById('c'),R=c.getBoundingClientRect();return {w:c.width,h:c.height,cw:R.width,ch:R.height,l:R.left,t:R.top,cls:document.body.className,fov:__camera.fov,asp:__camera.aspect};});
  ok(r.w===1080&&r.h===1920,'1080x1920 picture',r);ok(Math.abs(r.cw-1080)<0.5&&Math.abs(r.ch-1920)<0.5&&Math.abs(r.l)<0.5&&Math.abs(r.t)<0.5,'it fills a 1080x1920 window 1:1',r);
  ok(!/trNoHud/.test(r.cls)&&/trV/.test(r.cls),'HUD shown by default in an exact window',r.cls);
  await play(p);await lateReady(p);await key(p,'Digit0');await key(p,'Digit1');await key(p,'KeyL');await stage(p);
  r=await p.evaluate(()=>({fov:__camera.fov,d:__camera.position.distanceTo(__heads.P.pos),w:__renderer.domElement.width,h:__renderer.domElement.height}));
  ok(Math.abs(r.fov-76)<3&&r.w===1080&&r.h===1920,'portrait lens and size kept in play (quality never shrinks it)',r);
  // the astronaut well in frame: near the middle, not cut
  r=await p.evaluate(()=>{const T=__THREE,P=__heads.P,c=__camera;c.updateMatrixWorld();const a=P.pos.clone().project(c),hd=P.pos.clone().add(new T.Vector3(0,0.75,0)).project(c),ft=P.pos.clone().add(new T.Vector3(0,-0.85,0)).project(c);
    return {x:a.x,y:a.y,head:hd.y,feet:ft.y,h:(hd.y-ft.y)/2};});
  ok(Math.abs(r.x)<0.45&&r.head<0.9&&r.feet>-0.95&&r.h>0.1,'the astronaut is framed (centre x, whole height on screen, a good size)',r);
  // HUD panels inside the window and not on top of each other
  r=await p.evaluate(()=>{const ids=['hTop','hVit','hScore','hTank','hTk','pcKeys','round','msg'],R={};for(const i of ids){const e=document.getElementById(i);if(!e||e.hidden)continue;const b=e.getBoundingClientRect();
      if(b.width<2||b.height<2||getComputedStyle(e).display==='none')continue;R[i]=[b.left,b.top,b.right,b.bottom].map(Math.round);}
    const ov=[];const k=Object.keys(R);for(let i=0;i<k.length;i++)for(let j=i+1;j<k.length;j++){const a=R[k[i]],c=R[k[j]];if(Math.min(a[2],c[2])-Math.max(a[0],c[0])>2&&Math.min(a[3],c[3])-Math.max(a[1],c[1])>2)ov.push(k[i]+'/'+k[j]);}
    const out=k.filter(i=>R[i][0]<-1||R[i][1]<-1||R[i][2]>innerWidth+1||R[i][3]>innerHeight+1);return {R,ov,out};});
  ok(r.ov.length===0,'portrait HUD: no panels on top of each other',r);ok(r.out.length===0,'portrait HUD: all inside the window',r.out);
  await key(p,'KeyI',200);await key(p,'KeyO',200);await p.waitForTimeout(2500);
  if(SHOTS)await p.screenshot({path:shot('trailer_vert_hud.png')});
  await key(p,'Digit3',300);if(SHOTS)await p.screenshot({path:shot('trailer_vert_clean.png')});
  await key(p,'Digit7',700);if(SHOTS)await p.screenshot({path:shot('trailer_vert_xp.png')});
  await key(p,'Digit5');await key(p,'Digit6');await p.keyboard.down('KeyA');await p.keyboard.down('KeyC');await p.waitForTimeout(600);await p.keyboard.up('KeyC');await p.keyboard.up('KeyA');
  await key(p,'ArrowRight',350);await p.waitForTimeout(300);if(SHOTS)await p.screenshot({path:shot('trailer_vert_free.png')});
  ok(p.errs.length===0,'no page errors (vertical)',p.errs.slice(0,4));
  await p.context().close();
  // letterboxed in a landscape window
  p=await boot(b,'?trailer&vertical',{w:1920,h:1080});
  r=await p.evaluate(()=>{const c=document.getElementById('c'),R=c.getBoundingClientRect();return {w:c.width,h:c.height,cw:R.width,ch:R.height,l:R.left,cls:document.body.className};});
  ok(r.w===1080&&r.h===1920&&Math.abs(r.ch-1080)<0.5&&Math.abs(r.cw-607.5)<0.5&&Math.abs(r.l-(1920-607.5)/2)<0.5,'in 1920x1080: the same picture, centred and scaled to fit',r);
  ok(/trNoHud/.test(r.cls),'HUD hidden by default when letterboxed',r.cls);
  await play(p);await key(p,'KeyL');await stage(p);await key(p,'KeyI',1500);if(SHOTS)await p.screenshot({path:shot('trailer_vert_letterbox.png')});
  ok(p.errs.length===0,'no page errors (letterbox)',p.errs.slice(0,4));await p.context().close();
  // x2
  p=await boot(b,'?trailer&vertical&escala=2',{w:1080,h:1920});
  r=await p.evaluate(()=>{const c=document.getElementById('c'),R=c.getBoundingClientRect();return {w:c.width,h:c.height,cw:R.width,ch:R.height};});
  ok(r.w===2160&&r.h===3840&&Math.abs(r.cw-1080)<0.5,'&escala=2: 2160x3840 picture in the 1080x1920 window',r);
  await play(p);await p.waitForTimeout(1500);r=await p.evaluate(()=>({w:__renderer.domElement.width,h:__renderer.domElement.height,pr:__renderer.getPixelRatio()}));
  ok(r.w===2160&&r.h===3840&&r.pr===2,'... kept while playing',r);
  if(SHOTS){const d=await p.evaluate(()=>{__render();return document.getElementById('c').toDataURL('image/jpeg',0.9);});require('fs').writeFileSync(shot('trailer_vert_x2.jpg'),Buffer.from(d.split(',')[1],'base64'));}
  ok(p.errs.length===0,'no page errors (x2)',p.errs.slice(0,4));await p.context().close();}

(async()=>{
  const b=await chromium.launch({args:ARGS});
  try{
    if(!ONLY||ONLY==='main')await main(b);
    if(!ONLY||ONLY==='neg')await neg(b);
    if(!ONLY||ONLY==='ronda')await ronda(b);
    if(!ONLY||ONLY==='vert')await vert(b);
  }catch(e){console.log('  FAIL exception: '+(e&&e.stack||e));bad++;}
  await b.close();console.log(bad?`${bad} FAILED`:'ALL OK');process.exit(bad?1:0);})();
