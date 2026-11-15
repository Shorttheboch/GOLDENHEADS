// v91 (Santi): once the FIRST Incineradora fires its chest beam, the beam turns slowly and only so far from where it started, so you can get
// out of it (with the dash, easily); Incineradora II, III... as before. Here the beam is fired at an astronaut ~14 m away who then moves sideways
// at a steady speed (or dashes first) or keeps still; measured: how fast the beam turns (m/s at his distance), how far from where it started, and
// how long he stays in it. The first one with gen 1, then the same one as gen 2 (the old behaviour).
//   npm run build:test && tools/run-test.sh dist-test tools/tests/rayo.cjs
const {chromium}=require('playwright');
const {BASE,ARGS,lateReady}=require('./lib.cjs');
(async()=>{
 const b=await chromium.launch({args:ARGS});const errs=[];
 const p=await b.newPage({viewport:{width:960,height:540}});p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(()=>{window.__noTut=1;window.__noCine=1;let s=20261115;Math.random=()=>{s=(s*1664525+1013904223)%4294967296;return s/4294967296;};});
 await p.goto(BASE+'/test.html?q=3');
 await p.waitForFunction(()=>document.getElementById('play')&&!document.getElementById('play').disabled,null,{timeout:300000});await lateReady(p);
 await p.evaluate(()=>document.getElementById('play').click());
 await p.waitForFunction(()=>window.__T&&__T.state==='play',null,{timeout:120000});
 let bad=0;const ok=(c,m,i)=>{console.log((c?'  ok   ':'  FAIL ')+m+(i!==undefined&&!c?'  '+JSON.stringify(i):''));if(!c)bad++;};
 // an Incineradora on the hull, nothing else around; wait until it has landed and walks
 const st=await p.evaluate(()=>{window.__noSpawn=1;for(const s of [...__heads.spiders])__heads.killSpider(s);__heads.WB.spitQ=[1e9];const e=window.__inc=__heads.spawnInc(false);
   for(let i=0;i<400&&e.st!=='stalk';i++){__step(1);__heads.P.hp=100;}return {st:e.st,gen:e.gen};});
 ok(st.st==='stalk'&&st.gen===1,`the first Incineradora is down and walking (gen ${st.gen})`,st);
 const run=(gen,mode)=>p.evaluate(([gen,mode])=>{const T=__THREE,P=__heads.P,e=__inc,dt=0.05;e.gen=gen;
   for(const k of ['beam','leap','melee','hop','swim','guard'])if(k in e.cds)e.cds[k]=99;
   const o=e.pos.clone().addScaledVector(e.n,2.4),fwd=e.face.clone().addScaledVector(e.n,-e.face.dot(e.n)).normalize();
   const start=o.clone().addScaledVector(fwd,13).addScaledVector(e.n,4),dir=start.clone().sub(o).normalize(),side=new T.Vector3().crossVectors(e.n,dir).normalize();
   P.pos.copy(start);P.vel.set(0,0,0);e.st='charge';e.t=0;e.aim.copy(dir);
   let beamT=0,hitT=0,maxSweep=0,arc=0,prev=null,tt=0,dist=start.distanceTo(o);
   for(let i=0;i<160;i++){const firing=e.st==='beam';
     if(firing){const v=mode==='still'?0:(mode==='dash'&&tt<0.25?17:6);P.pos.addScaledVector(side,v*dt);tt+=dt;}
     P.vel.set(0,0,0);P.inv=0;P.hp=100;__step(1,dt);P.vel.set(0,0,0);
     if(e.st==='beam'||firing){beamT+=dt;if(P.hp<100)hitT+=dt;
       if(prev){const a=Math.acos(Math.min(1,Math.max(-1,prev.dot(e.aim))));maxSweep=Math.max(maxSweep,a/dt*dist);}prev=e.aim.clone();
       if(e.aim0)arc=Math.max(arc,Math.acos(Math.min(1,Math.max(-1,e.aim.dot(e.aim0))))*180/Math.PI);}
     if(e.st==='beamEnd'||e.st==='stalk'&&beamT>0)break;}
   P.hp=100;e.st='stalk';e.t=0;return {beamT:+beamT.toFixed(2),hitT:+hitT.toFixed(2),sweep:+maxSweep.toFixed(2),arc:+arc.toFixed(1),dist:+dist.toFixed(1)};},[gen,mode]);
 const r1s=await run(1,'still'),r1w=await run(1,'walk'),r1d=await run(1,'dash'),r2w=await run(2,'walk'),r2s=await run(2,'still');
 console.log(JSON.stringify({first_still:r1s,first_walk:r1w,first_dash:r1d,second_walk:r2w,second_still:r2s}));
 ok(r1s.beamT>1.4&&r1s.hitT>1.4,`I: standing still, the beam hits all the time (${r1s.hitT} of ${r1s.beamT} s)`,r1s);
 ok(r1w.sweep<=4.3&&r1w.arc<=32,`I: it follows at ${r1w.sweep} m/s at most (was ~7.5) and turns ${r1w.arc}° at most from where it started (limit 31.5°)`,r1w);
 ok(r1w.hitT<=0.6,`I: moving sideways at 6 m/s you are out of it after ${r1w.hitT} s`,r1w);
 ok(r1d.hitT<=0.35,`I: with a dash you are out of it after ${r1d.hitT} s`,r1d);
 ok(r2w.sweep>6&&r2w.hitT>=1.0,`II: as before, it follows at ${r2w.sweep} m/s and keeps you ${r2w.hitT} s of ${r2w.beamT} s at 6 m/s`,r2w);
 ok(errs.length===0,'no page errors',errs.slice(0,3));
 console.log(bad?('FAILED '+bad):'ALL OK');await b.close();process.exitCode=bad?1:0;})();
