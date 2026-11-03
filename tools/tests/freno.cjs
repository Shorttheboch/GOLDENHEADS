// Emergency brake on the leaks (v83): with little cargo left the hull leaks slower (leakMult in src/game/08-ship-zones.js).
// Checks (PC 960x540, ?ronda=5 so the first-round leak discount is gone; no spiders, nothing else moves the cargo):
//   1. 1000 on board: x1 · 290 (below 30 %): it ramps to x0.5 in about 1 s, smoothly (monotonic, no step bigger than a smoothstep allows), never before
//      · 90 (below 10 %): on to x0.35 in about 1 s · 500: back to x1 in about 1 s
//   2. chewing (damagePatch): the same 10 hp of damage lets out 8 trichomes at x1 and 4 at x0.5 (16 / 8 in the hold, x1.6)
//   3. broken plates (the slow leak in 31-loop.js): 8 holes for 20 s let out about half as much at 26 % as at 95 % on board
//   4. the HUD (PC): «N FUGAS» with no «PÉRDIDA ×» while braking; the cargo bar in its low state (the same 30 % as «¡LA CARGA SE AGOTA!»)
//   5. nothing else: a bite that spills the tank (P.carry) spills the same at any cargo level
// Run: npm run build:test && tools/run-test.sh dist-test tools/tests/freno.cjs
const {chromium}=require('playwright');
const {BASE,ARGS}=require('./lib.cjs');
let bad=0;const ok=(c,m,i)=>{console.log((c?'  ok   ':'  FAIL ')+m+(i!==undefined?'  '+JSON.stringify(i):''));if(!c)bad++;};
setTimeout(()=>{console.log('WATCHDOG: too slow, giving up');process.exit(2);},600000);
(async()=>{
 const b=await chromium.launch({args:ARGS});const errs=[];
 const p=await b.newPage({viewport:{width:960,height:540}});p.on('pageerror',e=>errs.push(e.message));
 p.on('crash',()=>{console.log('PAGE CRASHED (out of memory?)');process.exit(3);});
 await p.goto(BASE+'/test.html?ronda=5');
 await p.waitForFunction(()=>document.getElementById('play')&&!document.getElementById('play').disabled,null,{timeout:300000});
 await p.evaluate(()=>document.getElementById('play').click());await p.waitForTimeout(400);
 await p.evaluate(()=>{window.__manual=1;window.__noRender=1;window.__noSpawn=1;
   window.__hold=()=>{const H=__heads;__T.toSpawn=3;H.WB.bossT=0;H.WB.incT=0;for(const s of [...H.spiders])H.killSpider(s,false,true);H.P.hp=100;H.P.inv=1e9;H.P.pos.set(0,14,30);H.P.vel.set(0,0,0);};
   window.__go=(n)=>{const a=[];for(let i=0;i<n;i++){__hold();__step(1,1/60);a.push(__heads.leakMult);}return a;};
   __hold();__step(5,1/60);});
 console.log('1) the multiplier and its ramp');
 const ramp=async(cargo,n)=>p.evaluate(({cargo,n})=>{__T.cargo=cargo;return __go(n);},{cargo,n});
 let a=await ramp(1000,30);ok(a.every(v=>v===1),'1000 on board: x1',a.slice(-1));
 const check=(a,from,to,name)=>{const mono=a.every((v,i)=>i===0||(to<from?v<=a[i-1]+1e-9:v>=a[i-1]-1e-9));let step=0;for(let i=1;i<a.length;i++)step=Math.max(step,Math.abs(a[i]-a[i-1]));
   const maxStep=1.5*Math.abs(to-from)/60+1e-6; // a 1 s smoothstep: steepest slope 1.5 x the change per second
   const half=a[29],k=(half-from)/(to-from);
   ok(mono,name+': monotonic');ok(step<=maxStep,name+': no jump (largest step per frame within a 1 s smoothstep)',{step:+step.toFixed(4),maxStep:+maxStep.toFixed(4)});
   ok(k>0.3&&k<0.7,name+': halfway after about 0.5 s',{at05s:+half.toFixed(3)});ok(Math.abs(a[44]-to)>1e-3&&Math.abs(a[a.length-1]-to)<1e-9,name+': there after 1 s, not before',{at075s:+a[44].toFixed(3),end:a[a.length-1]});};
 a=await ramp(290,75);check(a,1,0.5,'below 30 %  x1 -> x0.5');
 a=await ramp(90,75);check(a,0.5,0.35,'below 10 %  x0.5 -> x0.35');
 a=await ramp(500,75);check(a,0.35,1,'back up     x0.35 -> x1');
 a=await ramp(300,10);ok(a.every(v=>v===1)||a[a.length-1]>0.99,'exactly 30 %: no brake (the line is «below 30 %»)',a.slice(-1));

 console.log('2) chewing a plate');
 const chew=await p.evaluate(()=>{const H=__heads,PA=__T.PATCHES,o={};
   const one=(cargo,zone)=>{__T.cargo=cargo;__go(70);for(const pa of PA){pa.hp=25;pa.leak=0;}const pa=PA.find(q=>(q.zone.name==='BODEGA')===(zone==='hold'));const c0=__T.cargo;H.damagePatch(pa,10);const out=c0-__T.cargo;pa.hp=25;pa.leak=0;return [out,+H.leakMult.toFixed(3)];};
   o.x1=one(900,'');o.x05=one(250,'');o.x035=one(60,'');o.hold1=one(900,'hold');o.hold05=one(250,'hold');return o;});
 ok(chew.x1[0]===8&&chew.x1[1]===1,'10 hp chewed at 90 %: 8 trichomes out',chew.x1);
 ok(chew.x05[0]===4&&chew.x05[1]===0.5,'the same at 25 %: 4',chew.x05);
 ok(chew.x035[0]===2&&chew.x035[1]===0.35,'the same at 6 %: 2 (2.8)',chew.x035);
 ok(chew.hold1[0]===12&&chew.hold05[0]===6,'in the hold (x1.6): 12 -> 6 (12.8 -> 6.4)',{a:chew.hold1,b:chew.hold05});

 console.log('3) broken plates');
 const leak=await p.evaluate(()=>{const PA=__T.PATCHES,brk=PA.filter((_,i)=>i%2===0);
   const run=(cargo)=>{for(const pa of PA){pa.hp=25;pa.leak=0;}__T.cargo=cargo;__go(70);for(const pa of brk)pa.hp=0;const c0=__T.cargo;const m=[];for(let i=0;i<20;i++){m.push(__go(60).pop());}const out=c0-__T.cargo;for(const pa of PA){pa.hp=25;pa.leak=0;}return {out,c0,m:[...new Set(m.map(v=>+v.toFixed(3)))]};};
   return {hi:run(950),lo:run(260)};});
 const ratio=leak.lo.out/leak.hi.out;
 ok(leak.hi.out>120&&leak.hi.m.join()==='1','95 %: 8 holes for 20 s let out the usual amount (~200)',leak.hi);
 ok(leak.lo.m.join()==='0.5','26 %: braking at x0.5 the whole time',leak.lo);
 ok(ratio>0.38&&ratio<0.62,'about half as much',{ratio:+ratio.toFixed(2)});

 console.log('4) HUD and message');
 const hud=await p.evaluate(()=>{const PA=__T.PATCHES;PA[0].hp=0;PA[2].hp=0;__T.cargo=200;__go(80);
   return {t:document.getElementById('hLeakT').textContent,low:document.getElementById('hCargoBar').classList.contains('low')};});
 ok(/2 FUGAS/.test(hud.t)&&!/×/.test(hud.t),'«2 FUGAS», no «PÉRDIDA ×»',hud.t);
 ok(hud.low,'the cargo bar is in its low state (same 30 %)',hud);

 console.log('5) nothing else');
 const spill=await p.evaluate(()=>{for(const pa of __T.PATCHES)pa.hp=25;const H=__heads,P=H.P,o=[];
   for(const cargo of [900,150]){__T.cargo=cargo;__go(70);P.carry=40;P.inv=0;__T.damagePlayer(5,new __THREE.Vector3(1,0,0));o.push(40-P.carry);P.inv=1e9;P.carry=0;}return o;});
 ok(spill[0]===spill[1]&&spill[0]>0,'a bite spills the same from the tank at 90 % and at 15 %',spill);

 ok(errs.length===0,'no page errors',errs.slice(0,4));
 await b.close();
 console.log(bad?`${bad} FAILED`:'ALL OK');process.exit(bad?1:0);
})();
