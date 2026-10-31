// v74: crab, egg, EXTRA POWER pistol (gun2) and Incineradora (spider_biped) download in the background after the menu is ready (lateStart in src/game/28-load.js).
// This test holds those four downloads and checks that
//  1) the menu (JUGAR) does not wait for them, and nothing is flagged as loaded;
//  2) while the crab is held the Escupidora does not spawn (its timer stops, no wrong model); when it arrives it spawns with the crab rig;
//  3) while the biped is held the Incineradora does not spawn; when it arrives it does;
//  4) while the egg is held no egg is laid (tryLayEgg says no); with it, the egg is the real model, not the placeholder sphere;
//  5) EXTRA POWER cannot start without its pistol, and starts with it;
//  6) a model that fails (twice) does not hang the game: its old fallback applies (Escupidora with the spider rig).
// Run on dist-test.
const {chromium}=require('playwright');
const {BASE,ARGS}=require('./lib.cjs');
let bad=0;const ok=(c,m,i)=>{console.log((c?'  ok   ':'  FAIL ')+m+(i!==undefined?'  '+JSON.stringify(i):''));if(!c)bad++;};
const NAMES=['crab','spider_biped','egg','gun2'];
(async()=>{
 const b=await chromium.launch({args:ARGS});
 const boot=async(mode)=>{ // mode: 'hold' (gates closed until released) · 'fail' (crab aborted)
   const pg=await b.newPage({viewport:{width:960,height:540}});pg.errs=[];pg.on('pageerror',e=>pg.errs.push(e.message));
   const gate={},open={};for(const n of NAMES){gate[n]=new Promise(r=>{open[n]=r;});}
   pg.release=n=>open[n]();pg.requests=[];
   await pg.route(/assets\/models\/(crab|spider_biped|egg|gun2)\.glb/,async r=>{const n=r.request().url().match(/models\/(.*)\.glb/)[1];pg.requests.push(n);
     if(mode==='fail'&&n==='crab'){await r.abort();return;}
     if(mode==='hold'){await gate[n];}
     await r.continue();});
   await pg.addInitScript(()=>{let s=20261031;Math.random=()=>{s=(s*1664525+1013904223)%4294967296;return s/4294967296;};});
   const t0=Date.now();
   await pg.goto(BASE+'/test.html');
   await pg.waitForFunction(()=>document.getElementById('play')&&!document.getElementById('play').disabled,null,{timeout:300000});
   pg.tMenu=Date.now()-t0;
   await pg.evaluate(()=>document.getElementById('play').click());
   await pg.evaluate(()=>{window.__noRender=1;__step(10);window.__noRender=0;});
   return pg;};
 const step=async(pg,s)=>{for(let t=0;t<s;t+=1){await pg.evaluate(()=>{__heads.P.hp=100;__heads.P.inv=0.5;});await pg.evaluate(n=>__step(n),Math.round(Math.min(1,s-t)/0.05));}}; // 1 s at a time, the astronaut stays healthy
 const late=pg=>pg.evaluate(()=>JSON.stringify(__late.s)).then(JSON.parse);
 const waitLate=(pg,k,v)=>pg.waitForFunction(([k,v])=>__late.s[k]===v,[k,v],{timeout:60000});

 console.log('1) menu does not wait for the held models');
 let p=await boot('hold');
 ok(true,'JUGAR enabled with the four downloads still held',{ms:p.tMenu});
 ok(JSON.stringify(await late(p))===JSON.stringify({gun2:0,crab:0,egg:0,bip:0}),'nothing flagged as loaded',await late(p));
 await p.waitForTimeout(1500);
 ok(p.requests.length===1||p.requests.length===4,'the background download started (first request is held)',p.requests);

 console.log('2) Escupidora waits for the crab');
 await p.evaluate(()=>{__heads.WB.bossT=0.5;});await step(p,3);
 let r=await p.evaluate(()=>({bossT:__heads.WB.bossT,sp:__heads.spiders.filter(s=>s.kind==='spitter').length,cine:__heads.CINE.on}));
 ok(r.sp===0&&!r.cine&&Math.abs(r.bossT-0.5)<1e-6,'3 s with the crab held: no spitter, timer stopped',r);
 p.release('gun2');await waitLate(p,'gun2',1);p.release('crab');await waitLate(p,'crab',1);
 await step(p,1.5);
 r=await p.evaluate(()=>{const s=__heads.spiders.find(s=>s.kind==='spitter');return {sp:!!s,crab:s?!!s.mesh.userData.rig.crab:null,bossT:__heads.WB.bossT};});
 ok(r.sp&&r.crab===true&&r.bossT===0,'crab arrived: the spitter spawns with the crab rig',r);

 console.log('3) Incineradora waits for the biped');
 // (same page: the cinematic of the spitter is over after a few seconds)
 await step(p,8);
 await p.evaluate(()=>{__heads.WB.incT=0.5;});await step(p,3);
 r=await p.evaluate(()=>({incs:__heads.INCS.length,incT:__heads.WB.incT}));
 ok(r.incs===0&&Math.abs(r.incT-0.5)<1e-6,'3 s with the biped held: no Incineradora, timer stopped',r);
 p.release('spider_biped');await waitLate(p,'bip',1);await step(p,1.5);
 r=await p.evaluate(()=>({incs:__heads.INCS.length,bones:__heads.INCS[0]?Object.keys(__heads.INCS[0].B.bones).length:0}));
 ok(r.incs===1&&r.bones>20,'biped arrived: the Incineradora spawns, rigged',r);

 console.log('4) egg waits for its model');
 // four spiders crawling far from the astronaut: tryLayEgg has everything it needs except the model
 await p.evaluate(()=>{window.__noSpawn=1;__heads.P.pos.set(0,25,40);for(let i=0;i<4;i++){const s=__heads.spawnSpider('hunter');s.state='crawl';s.cd=99;}});await step(p,0.1);
 r=await p.evaluate(()=>({lay:__heads.tryLayEgg(),eggs:__heads.EGGS.length}));
 ok(r.lay===false&&r.eggs===0,'tryLayEgg says no while the egg model is held (with spiders ready to lay)',r);
 p.release('egg');await waitLate(p,'egg',1);
 r=await p.evaluate(()=>{const lay=__heads.tryLayEgg();const e=__heads.EGGS[0];const m=e&&e.g.children[0];return {lay,eggs:__heads.EGGS.length,real:!!m&&!(m.isMesh&&m.geometry.type==='SphereGeometry')};});
 ok(r.lay===true&&r.eggs===1&&r.real,'egg arrived: the same call lays the real model, not the placeholder sphere',r);

 console.log('5) EXTRA POWER needs its pistol');
 r=await p.evaluate(()=>({g2:!!__xp.XP.g2,g1:!!__xp.XP.g1}));
 ok(r.g2&&r.g1,'gun2 is attached next to the pistol once loaded',r);
 await p.close();

 p=await boot('hold');
 await p.evaluate(()=>{__xp.xpStart();});
 r=await p.evaluate(()=>({on:__xp.XP.on,g2:!!__xp.XP.g2}));
 ok(r.on===false&&r.g2===false,'xpStart does nothing while gun2 is held',r);
 await p.evaluate(()=>{__T.startWave(3);});await step(p,0.3); // round 4: from here a kill streak earns EXTRA POWER
 await p.evaluate(()=>{for(let i=0;i<8;i++)__xp.xpKill(false,1);}); // a full streak with no pistol: nothing happens, nothing breaks
 r=await p.evaluate(()=>({on:__xp.XP.on,streak:__xp.XP.streak}));
 ok(r.on===false&&r.streak>=5,'a full kill streak without the pistol starts nothing',r);
 p.release('gun2');await waitLate(p,'gun2',1);
 await p.evaluate(()=>{__xp.xpKill(false,1);});
 r=await p.evaluate(()=>({on:__xp.XP.on,g2vis:__xp.XP.g2&&__xp.XP.g2.visible}));
 ok(r.on===true,'after gun2 arrives the next kill starts EXTRA POWER',r);
 ok(p.errs.length===0,'no page errors',p.errs.slice(0,3));
 await p.close();

 console.log('6) a failed download falls back, never hangs');
 p=await boot('fail');
 await waitLate(p,'crab',2);
 ok((await late(p)).crab===2,'crab marked failed after the retry',await late(p));
 await p.evaluate(()=>{__heads.WB.bossT=0.5;});await step(p,2);
 r=await p.evaluate(()=>{const s=__heads.spiders.find(s=>s.kind==='spitter');return {sp:!!s,crab:s?!!s.mesh.userData.rig.crab:null};});
 ok(r.sp&&r.crab===false,'the Escupidora still comes (spider rig, as before v74 when the crab failed)',r);
 ok(p.errs.length===0,'no page errors',p.errs.slice(0,3));
 await p.close();

 await b.close();
 console.log(bad?'FAILED '+bad:'ALL OK');process.exit(bad?1:0);})();
