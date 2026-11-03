// Bosses (v83): from round 14 an Incineradora round brings everything together, and the bosses drop a gift at half life.
//  ronda   1. ?ronda=14: the Incineradora comes as always; no Escupidora during its entrance (timer, fall, landing, roar); one Escupidora comes down mid-round with
//             «¡CUIDADO ARRIBA!» when the Incineradora is first below 60 % (not at 65 %) …
//          2. … or 35 s into the round if it is never hurt (not before);
//          3. the round stays open while that Escupidora is still to come (the crab model held back: everything else dead, no break) and it comes once it can;
//          4. eggs: allowed in round 14 and 17 under the usual rules (40 tries of the round's plan), never in rounds 8 and 11; an egg really is laid in round 14 (and not
//             while the Incineradora is arriving);
//          5. ?ronda=8 and ?ronda=11 unchanged: no Escupidora ever comes, even with the Incineradora below 60 % for 40 s; ?ronda=14 / 17 count the Escupidoras met
//  regalo  6. Escupidora II: no gift even at 30 %; Escupidora III: nothing at 55 %, ONE prize when it drops below 50 % (with the prize cap of the round used up), none more at 30 %;
//             a second Escupidora (IV) at the same time gives its own; the gift lives 20 s and is REPARACIÓN TOTAL or TODO A BORDO, chosen by giftPick
//          7. the Incineradora (the first one): nothing at 51 %, one gift below 50 %, none more
//          8. giftPick in set-ups: nothing wrong -> REPARACIÓN TOTAL; a damaged plate -> REPARACIÓN; 10 trichomes adrift (under 12) -> REPARACIÓN; 40 adrift and a sound hull -> TODO A BORDO;
//             40 adrift + 1 hole (25) -> TODO A BORDO; + a 2nd hole (50) -> REPARACIÓN; 40 adrift + 3 damaged plates (24) -> TODO A BORDO, 6 (48) -> REPARACIÓN; only fix / mag ever
// Run: npm run build:test && tools/run-test.sh dist-test tools/tests/jefes.cjs     (HEADS_ONLY=ronda|regalo)
const {chromium}=require('playwright');
const {BASE,ARGS,lateReady}=require('./lib.cjs');
const ONLY=process.env.HEADS_ONLY||'';
let bad=0;const ok=(c,m,i)=>{console.log((c?'  ok   ':'  FAIL ')+m+(i!==undefined?'  '+JSON.stringify(i):''));if(!c)bad++;};
setTimeout(()=>{console.log('WATCHDOG: too slow, giving up');process.exit(2);},1300000);
(async()=>{
 const b=await chromium.launch({args:ARGS});const allErrs=[];
 const boot=async q=>{const p=await b.newPage({viewport:{width:960,height:540}});p.on('pageerror',e=>allErrs.push(q+': '+e.message));
   p.on('crash',()=>{console.log('PAGE CRASHED (out of memory?)');process.exit(3);});
   await p.goto(BASE+'/test.html'+q);
   await p.waitForFunction(()=>document.getElementById('play')&&!document.getElementById('play').disabled,null,{timeout:300000});
   await p.evaluate(()=>document.getElementById('play').click());await p.waitForTimeout(400);
   await p.evaluate(()=>{window.__manual=1;window.__noRender=1;
     // keep the astronaut, the ship and the cargo healthy, nobody shoots: only the round's own clock moves things on
     window.__safe=()=>{const H=__heads;H.P.hp=100;H.P.inv=0.5;for(const pa of __T.PATCHES)pa.hp=25;__T.cargo=900;};
     window.__run=(n,dt)=>{for(let i=0;i<n;i++){__safe();__step(1,dt||1/30);}};});
   await lateReady(p);return p;};
 const W=p=>p.evaluate(()=>({round:__T.wave+1,rt:+(__heads.WB.rt||0).toFixed(1),incSp:__heads.WB.incSp,inBreak:__T.inBreak,state:__T.state,
   inc:__heads.INCS.map(e=>e.st+':'+Math.round(100*e.hp/e.maxHp)),spit:__heads.spiders.filter(s=>s.kind==='spitter').map(s=>s.state+':g'+s.gen),
   msg:document.getElementById('msg').textContent.trim(),eggs:__heads.EGGS.length,plan:__ronda.eggPlan,spitN:__ronda.spitN,incN:__ronda.incN}));
 const intro=p=>p.evaluate(()=>__heads.WB.incT>0||__heads.INCS.some(e=>e.st==='fall'||e.st==='arrive'||e.st==='roar'));
 // step until the Incineradora has arrived; fail if an Escupidora shows up during its entrance
 const arrive=async(p,tag)=>{let spitDuring=false,saw=false;for(let i=0;i<200;i++){const r=await p.evaluate(()=>{__run(10);const H=__heads;
     return {intro:H.WB.incT>0||H.INCS.some(e=>e.st==='fall'||e.st==='arrive'||e.st==='roar'),n:H.INCS.length,spit:H.spiders.some(s=>s.kind==='spitter')};});
     if(r.n)saw=true;if(r.intro&&r.spit)spitDuring=true;if(saw&&!r.intro)break;}
   ok(saw,tag+': the Incineradora comes',await W(p));ok(!spitDuring,tag+': no Escupidora during the Incineradora\'s entrance');};

 if(!ONLY||ONLY==='ronda'){
  console.log('1) ?ronda=14: the Escupidora comes when the Incineradora drops below 60 %');
  let p=await boot('?ronda=14');let r=await W(p);
  ok(r.round===14&&r.incSp===1,'round 14 starts with an Escupidora to come',r);
  ok(r.spitN===9&&r.incN===2,'?ronda=14 counts 9 Escupidoras and 2 Incineradoras met',{spitN:r.spitN,incN:r.incN});
  await arrive(p,'round 14');
  await p.evaluate(()=>{const e=__heads.INCS[0];e.hp=Math.ceil(e.maxHp*0.65);});
  await p.evaluate(()=>{__run(40);__heads.INCS[0].hp=Math.ceil(__heads.INCS[0].maxHp*0.65);});r=await W(p);
  ok(r.spit.length===0&&r.incSp===1&&r.rt<35,'at 65 % nothing yet',r);
  await p.evaluate(()=>{const e=__heads.INCS[0];e.hp=Math.floor(e.maxHp*0.59);__run(3);});r=await W(p);
  ok(r.spit.length===1&&/^fall/.test(r.spit[0])&&r.incSp===0,'below 60 %: one Escupidora falls',r);
  ok(/CUIDADO ARRIBA/.test(r.msg),'with «¡CUIDADO ARRIBA!»',r.msg);
  ok(r.spit[0]&&/g10$/.test(r.spit[0]),'it is the 10th Escupidora met (X)',r.spit);
  await p.evaluate(()=>__run(150));r=await W(p);ok(r.spit.length===1,'only one',r.spit);
  await p.close();

  console.log('2) ?ronda=14, the Incineradora never hurt: the Escupidora comes at 35 s');
  p=await boot('?ronda=14');await arrive(p,'round 14 (time)');
  let at=null,early=false;for(let i=0;i<120&&!at;i++){const q=await p.evaluate(()=>{__run(15);__heads.INCS[0]&&(__heads.INCS[0].hp=__heads.INCS[0].maxHp);
      return {rt:__heads.WB.rt,sp:__heads.spiders.some(s=>s.kind==='spitter')};});if(q.sp){at=q.rt;if(q.rt<34.9)early=true;}}
  ok(at!==null&&!early&&at<36,'it comes at 35 s of the round (not before)',{at});
  await p.close();

  console.log('3) the round stays open while the Escupidora is still to come');
  p=await boot('?ronda=14');await arrive(p,'round 14 (open)');
  await p.evaluate(()=>{__late.s.crab=0; // the crab model "still downloading": the Escupidora has to wait
    window.__noSpawn=1;__T.toSpawn=0;for(const s of [...__heads.spiders])__heads.killSpider(s,false,true);const e=__heads.INCS[0];__heads.incDamage(e,99999,'body',new __THREE.Vector3(0,0,1),e.pos.clone());});
  await p.evaluate(()=>__run(300));r=await W(p);
  ok(!r.inBreak&&r.incSp===1&&r.inc.every(x=>/^dead/.test(x))&&r.spit.length===0,'everything dead, Escupidora pending: no break, the round is still on',r);
  await p.evaluate(()=>{__late.s.crab=1;__run(4);});r=await W(p);
  ok(r.spit.length===1&&!r.inBreak,'the crab is in: the Escupidora comes at once',r);
  await p.close();

  console.log('4) eggs: round 14 and 17 may have them, 8 and 11 never');
  p=await boot('?ronda=14');
  const eg=await p.evaluate(()=>{const o={};for(const w of [7,10,13,16]){let n=0;for(let k=0;k<40;k++){__ronda.eggLastW=-9;__ronda.spitFirstWv=5;__T.startWave(w);if(__ronda.eggPlan>0)n++;}o['round'+(w+1)]=n;}return o;});
  ok(eg.round8===0&&eg.round11===0,'rounds 8 and 11: never an egg planned',eg);
  ok(eg.round14>=28&&eg.round17>=28,'rounds 14 and 17: planned like any round (90 % when the last egg was 4+ rounds ago)',eg);
  await p.close();
  p=await boot('?ronda=14');r=await W(p);
  if(r.plan>0){let laid=null,inIntro=false;for(let i=0;i<400&&!laid;i++){const q=await p.evaluate(()=>{__run(10);const H=__heads;return {eggs:H.EGGS.length,intro:H.WB.incT>0||H.INCS.some(e=>e.st==='fall'||e.st==='arrive'||e.st==='roar'),rt:H.WB.rt};});
      if(q.eggs){laid=q;inIntro=q.intro;}}
    ok(!!laid,'an egg is laid in round 14',laid||await W(p));ok(!inIntro,'not while the Incineradora is arriving',laid);}
  else console.log('  (this run planned no egg in round 14: 1 in 10; part 4 above covers the rule)');
  await p.close();

  for(const n of [8,11]){
   console.log(`5) ?ronda=${n}: as before (no Escupidora, no egg)`);
   p=await boot('?ronda='+n);r=await W(p);
   ok(r.incSp===0&&r.plan===0,`round ${n}: no Escupidora to come, no egg`,r);
   await arrive(p,'round '+n);
   let seen=false;for(let i=0;i<80;i++){const q=await p.evaluate(()=>{__run(15);const e=__heads.INCS[0];if(e&&e.st!=='dead')e.hp=Math.floor(e.maxHp*0.5);return __heads.spiders.some(s=>s.kind==='spitter');});if(q)seen=true;}
   ok(!seen,`round ${n}: no Escupidora in 40 s with the Incineradora at 50 %`);
   await p.close();}
  p=await boot('?ronda=17');r=await W(p);ok(r.spitN===14&&r.incN===3&&r.incSp===1,'?ronda=17: 14 Escupidoras (one in round 14) and 3 Incineradoras met, one to come',r);await p.close();
 }

 if(!ONLY||ONLY==='regalo'){
  console.log('6) the gift of the Escupidoras (III and later)');
  let p=await boot('?ronda=7');
  await p.evaluate(()=>{window.__noSpawn=1;__T.toSpawn=3;__heads.WB.spitQ=[];__heads.WB.bossT=0;__heads.WB.spit=true;for(const s of [...__heads.spiders])__heads.killSpider(s,false,true);});
  const land=()=>p.evaluate(()=>{for(let i=0;i<200;i++){__run(5);if(__heads.spiders.every(s=>s.kind!=='spitter'||s.state!=='fall'))break;}return __heads.spiders.filter(s=>s.kind==='spitter').map(s=>s.state);});
  const drops=()=>p.evaluate(()=>__heads.DROPS.map(d=>({k:d.k,gift:d.gift,life:d.life})));
  await p.evaluate(()=>{__heads.spawnSpitter();});await land();
  await p.evaluate(()=>{const s=__heads.spiders.find(s=>s.kind==='spitter');s.hp=Math.floor(s.maxHp*0.3);__run(4);});
  let d=await drops();ok(await p.evaluate(()=>__heads.spiders.find(s=>s.kind==='spitter').gen)===2&&d.length===0,'Escupidora II at 30 %: no gift',d);
  await p.evaluate(()=>{const s=__heads.spiders.find(s=>s.kind==='spitter');__heads.killSpider(s,false,true);for(const d of [...__heads.DROPS])d.t=99;__run(2);});
  // III: the prize cap of the round used up and a prize just dropped; lots of cargo adrift, a sound hull -> TODO A BORDO
  await p.evaluate(()=>{__heads.spawnSpitter();});await land();
  const s3=await p.evaluate(()=>{const s=__heads.spiders.find(s=>s.kind==='spitter');s.hp=Math.ceil(s.maxHp*0.55);__run(4);__heads.dropsRound=999;__heads.lastDrop=__T.playT;
    __heads.spawnLoose(new __THREE.Vector3(0,9,4),60,0.3);return {gen:s.gen,n:__heads.DROPS.length,pick:__heads.giftPick()};});
  ok(s3.gen===3&&s3.n===0,'Escupidora III at 55 %: nothing yet',s3);
  await p.evaluate(()=>{const s=__heads.spiders.find(s=>s.kind==='spitter');s.hp=Math.floor(s.maxHp*0.49);__T.cargo=900;const H=__heads,P=H.P;H.P.hp=100;H.P.inv=0.5;__step(1,1/30);});
  d=await drops();const g3=await p.evaluate(()=>{const d=__heads.DROPS[0];if(!d)return null;const b=d.base,hp=__hullParam(b),[q,n]=__hullPoint(hp.z,hp.th);return {k:d.k,gift:d.gift,life:d.life,dr:__heads.dropsRound,out:+((b.x-q.x)*n.x+(b.y-q.y)*n.y+(b.z-q.z)*n.z).toFixed(2),r:+b.length().toFixed(1),toP:+b.distanceTo(__heads.P.pos).toFixed(1)};});
  ok(d.length===1&&g3&&g3.gift,'below 50 %: ONE gift, though the round\'s prize cap is used up',{d,g3});
  ok(g3&&g3.k==='mag'&&s3.pick==='mag','60 trichomes adrift, sound hull: TODO A BORDO',g3);
  ok(g3&&g3.life===20&&g3.dr===999,'it lives 20 s and does not count against the prize cap',g3);
  ok(g3&&g3.out>0.8&&g3.r<36,'it floats clear of the hull and within reach',g3);
  await p.evaluate(()=>{const s=__heads.spiders.find(s=>s.kind==='spitter');s.hp=Math.floor(s.maxHp*0.3);__run(4);});
  d=await drops();ok(d.length===1,'at 30 %: no second gift from the same Escupidora',d);
  // IV at the same time: its own gift; holes everywhere -> REPARACIÓN TOTAL
  await p.evaluate(()=>{__heads.spawnSpitter();});await land();
  const g4=await p.evaluate(()=>{const ss=__heads.spiders.filter(s=>s.kind==='spitter');const s=ss.find(s=>s.gen===4);__T.cargo=900;
    for(const pa of __T.PATCHES.slice(0,6))pa.hp=0;const pick=__heads.giftPick();s.hp=Math.floor(s.maxHp*0.45);__heads.P.inv=0.5;__step(1,1/30);
    return {n:ss.length,gens:ss.map(s=>s.gen),pick,drops:__heads.DROPS.map(d=>d.k+(d.gift?':gift':''))};});
  ok(g4.n===2&&g4.drops.length===2,'two Escupidoras at once: the second (IV) gives its own gift',g4);
  ok(g4.drops[1]==='fix:gift'&&g4.pick==='fix','six holes against 60 adrift: REPARACIÓN TOTAL',g4);
  await p.close();

  console.log('7) the gift of the Incineradora (every one, the first included)');
  p=await boot('?ronda=8');await arrive(p,'round 8 (gift)');
  await p.evaluate(()=>{window.__noSpawn=1;for(const d of [...__heads.DROPS])d.t=99;__run(2);const e=__heads.INCS[0];e.hp=Math.ceil(e.maxHp*0.51);__run(4);});
  let n=await p.evaluate(()=>__heads.DROPS.filter(d=>d.gift).length);ok(n===0,'at 51 %: nothing',n);
  await p.evaluate(()=>{const e=__heads.INCS[0];e.hp=Math.floor(e.maxHp*0.49);__run(2);});
  let gi=await p.evaluate(()=>({gen:__heads.INCS[0].gen,drops:__heads.DROPS.filter(d=>d.gift).map(d=>d.k)}));
  ok(gi.gen===1&&gi.drops.length===1&&['fix','mag'].includes(gi.drops[0]),'below 50 %: one gift (REPARACIÓN TOTAL or TODO A BORDO)',gi);
  await p.evaluate(()=>{const e=__heads.INCS[0];e.hp=Math.floor(e.maxHp*0.2);__run(4);});
  n=await p.evaluate(()=>__heads.DROPS.filter(d=>d.gift).length);ok(n===1,'at 20 %: no second gift',n);
  await p.close();

  console.log('8) giftPick: which prize');
  p=await boot('?ronda=6');
  const ch=await p.evaluate(()=>{const H=__heads,PA=__T.PATCHES,full=()=>{for(const pa of PA)pa.hp=25;},o={},V=new __THREE.Vector3(0,10,4);
    const nb=PA.filter(pa=>pa.zone.name!=='BODEGA');
    full();o.nothing=[H.giftPick(),H.looseCount()];
    nb[0].hp=10;o.damaged=H.giftPick();full();
    H.spawnLoose(V,10,0.2);o.adrift10=[H.giftPick(),H.looseCount()];
    H.spawnLoose(V,30,0.2);o.adrift40=[H.giftPick(),H.looseCount()];
    nb[0].hp=0;o.hole1=[H.giftPick(),+H.giftLoss().toFixed(1)];
    nb[1].hp=0;o.hole2=[H.giftPick(),+H.giftLoss().toFixed(1)];full();
    for(const pa of nb.slice(0,3))pa.hp=5;o.dmg3=[H.giftPick(),+H.giftLoss().toFixed(1)];
    for(const pa of nb.slice(0,6))pa.hp=5;o.dmg6=[H.giftPick(),+H.giftLoss().toFixed(1)];full();
    const seen=new Set();for(let k=0;k<300;k++){for(const pa of PA)pa.hp=Math.random()<0.3?Math.floor(Math.random()*26):25;seen.add(H.giftPick());}o.only=[...seen].sort();return o;});
  ok(ch.nothing[0]==='fix'&&ch.nothing[1]===0,'nothing wrong: REPARACIÓN TOTAL',ch.nothing);
  ok(ch.damaged==='fix','a damaged plate: REPARACIÓN TOTAL',ch.damaged);
  ok(ch.adrift10[0]==='fix'&&ch.adrift10[1]===10,'10 adrift (under the 12 that make TODO A BORDO useful): REPARACIÓN TOTAL',ch.adrift10);
  ok(ch.adrift40[0]==='mag'&&ch.adrift40[1]===40,'40 adrift, sound hull: TODO A BORDO',ch.adrift40);
  ok(ch.hole1[0]==='mag'&&ch.hole1[1]===25,'40 adrift + one hole (25): TODO A BORDO',ch.hole1);
  ok(ch.hole2[0]==='fix'&&ch.hole2[1]===50,'40 adrift + two holes (50): REPARACIÓN TOTAL',ch.hole2);
  ok(ch.dmg3[0]==='mag'&&ch.dmg3[1]===24,'40 adrift + 3 plates at 5/25 (24): TODO A BORDO',ch.dmg3);
  ok(ch.dmg6[0]==='fix'&&ch.dmg6[1]===48,'40 adrift + 6 plates at 5/25 (48): REPARACIÓN TOTAL',ch.dmg6);
  ok(JSON.stringify(ch.only)==='["fix","mag"]','only REPARACIÓN TOTAL or TODO A BORDO, ever',ch.only);
  await p.close();
 }
 ok(allErrs.length===0,'no page errors',allErrs.slice(0,4));
 await b.close();
 console.log(bad?`${bad} FAILED`:'ALL OK');process.exit(bad?1:0);
})();
