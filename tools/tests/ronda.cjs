// Start at any round (v80): ?ronda=N (or ?round=N) starts the game straight at round N, with the bosses counted as if rounds 1..N-1 had been played.
// Checks, on PC 960x540 (dist-test):
//  - no ?ronda: a normal game (round 1, intro scene set up)
//  - ?ronda=4 / ?round=7: that round at once, no opening film, no intro scene, "RONDA N" message, REINTENTAR starts the same round again
//  - the boss counts: round 6 (no Escupidora met yet: the first one comes, with her scene), round 8 (2 Escupidoras met, the first Incineradora comes),
//    round 9 (Incineradora met, the first egg is planned), round 12 (5 Escupidoras, 2 Incineradoras)
//  - a test game never sets the record (heads_best_v3) and never goes to the online ranking (RANK.on false)
// Run: npm run build:test && tools/run-test.sh dist-test tools/tests/ronda.cjs
const {chromium}=require('playwright');
const {BASE,ARGS,lateReady}=require('./lib.cjs');
let bad=0;const ok=(c,m,i)=>{console.log((c?'  ok   ':'  FAIL ')+m+(i!==undefined?'  '+JSON.stringify(i):''));if(!c)bad++;};
(async()=>{
 const b=await chromium.launch({args:ARGS});const allErrs=[];
 const boot=async q=>{const p=await b.newPage({viewport:{width:960,height:540}});p.on('pageerror',e=>allErrs.push(q+': '+e.message));
   p.on('crash',()=>{console.log('PAGE CRASHED (out of memory?)');process.exit(3);});
   await p.addInitScript(()=>{window.__noOpening=0;window.__noCine=0;}); // like the real game: the film and the scenes are on
   await p.goto(BASE+'/test.html'+q);
   await p.waitForFunction(()=>document.getElementById('play')&&!document.getElementById('play').disabled,null,{timeout:300000});
   await p.evaluate(()=>document.getElementById('play').click());await p.waitForTimeout(400);
   await p.evaluate(()=>{window.__noRender=1;});return p;};
 const st=p=>p.evaluate(()=>({wave:__T.wave,round:__T.wave+1,state:__T.state,n:__ronda.n,spitN:__ronda.spitN,incN:__ronda.incN,spitFirstW:__ronda.spitFirstW,eggPlan:__ronda.eggPlan,
   film:!document.getElementById('opening').hidden,cine:__heads.CINE.on,cineMode:__heads.CINE.mode||null,rankOn:__ronda.rankOn,msg:document.getElementById('msg').textContent.trim(),
   spiders:__heads.spiders.map(s=>s.kind+':'+s.state)}));

 console.log('1) no ?ronda: a normal game');
 let p=await boot('');let r=await st(p);
 ok(r.n===0&&r.round===1,'round 1',r);
 ok(r.film||r.cine,'the opening film (or the intro scene) is on as always',{film:r.film,cine:r.cine});
 await p.close();

 console.log('2) ?ronda=4: round 4 at once');
 p=await boot('?ronda=4');r=await st(p);
 ok(r.n===4&&r.round===4,'starts at round 4',r);
 ok(!r.film,'no opening film');ok(!r.cine,'no intro scene');
 ok(/RONDA 4/.test(r.msg),'"RONDA 4" message',r.msg);
 ok(r.spitN===0&&r.incN===0&&r.spitFirstW===-1,'no boss met yet',{spitN:r.spitN,incN:r.incN,spitFirstW:r.spitFirstW});
 ok(r.rankOn===false,'online ranking off for the test game');
 ok(!r.spiders.some(s=>s.endsWith(':perch')),'no intro spiders on the wings',r.spiders);
 // record: a test game never writes it; REINTENTAR starts round 4 again
 await p.evaluate(()=>{localStorage.setItem('heads_best_v3',JSON.stringify({score:5,round:1}));__T.score=99999;__MUS().endGame(false,'dead');});
 await p.waitForTimeout(800);
 const rec=await p.evaluate(()=>JSON.parse(localStorage.getItem('heads_best_v3')));
 ok(rec&&rec.score===5,'the record is not touched by a test game',rec);
 await p.evaluate(()=>{document.getElementById('again').click();});await p.waitForTimeout(400);
 r=await st(p);ok(r.round===4&&r.state==='play','REINTENTAR starts round 4 again',{round:r.round,state:r.state});
 await p.close();

 console.log('3) ?round=7 (English name) works the same');
 p=await boot('?round=7');r=await st(p);
 ok(r.round===7&&r.spitN===1&&r.spitFirstW===5,'round 7, one Escupidora already met (round 6)',r);
 await p.close();

 console.log('4) ?ronda=6: the first Escupidora comes, with her scene');
 p=await boot('?ronda=6');r=await st(p);
 ok(r.round===6&&r.spitN===0,'round 6, no Escupidora met yet',r);
 await lateReady(p);
 let got=null;for(let i=0;i<40&&!got;i++){await p.evaluate(()=>{__heads.P.hp=100;__heads.P.inv=0.5;for(const pa of __T.PATCHES)pa.hp=25;__T.cargo=5000;__step(20);});got=await p.evaluate(()=>__heads.spiders.some(s=>s.kind==='spitter')?{spitN:__ronda.spitN,spitFirstW:__ronda.spitFirstW,cine:__heads.CINE.on,mode:__heads.CINE.mode}:null);}
 ok(got&&got.spitN===1&&got.spitFirstW===5,'the Escupidora arrives as the first one (spitFirstW = round 6)',got);
 ok(got&&got.cine&&got.mode==='boss','with her scene',got);
 await p.close();

 console.log('5) ?ronda=8: two Escupidoras met, the first Incineradora comes');
 p=await boot('?ronda=8');r=await st(p);
 ok(r.round===8&&r.spitN===2&&r.incN===0,'round 8: 2 Escupidoras met, no Incineradora yet',r);
 await lateReady(p);
 got=null;for(let i=0;i<40&&!got;i++){await p.evaluate(()=>{__heads.P.hp=100;__heads.P.inv=0.5;for(const pa of __T.PATCHES)pa.hp=25;__T.cargo=5000;__step(20);});got=await p.evaluate(()=>__heads.INCS.length?{incN:__ronda.incN,cine:__heads.CINE.on}:null);}
 ok(got&&got.incN===1,'the Incineradora arrives as the first one',got);
 await p.close();

 console.log('6) ?ronda=9: the first egg is planned');
 p=await boot('?ronda=9');r=await st(p);
 ok(r.round===9&&r.spitN===2&&r.incN===1&&r.spitFirstW===5,'round 9: 2 Escupidoras and 1 Incineradora met',r);
 ok(r.eggPlan>=1,'an egg is planned in this round (2 rounds after the first Escupidora, skipping the Incineradora round)',r.eggPlan);
 await lateReady(p);
 got=null;for(let i=0;i<120&&!got;i++){await p.evaluate(()=>{__heads.P.hp=100;__heads.P.inv=0.5;for(const pa of __T.PATCHES)pa.hp=25;__T.cargo=5000;__step(20);});got=await p.evaluate(()=>__heads.EGGS.length?{eggs:__heads.EGGS.length,t:+__heads.WB.rt.toFixed(1)}:null);} // the astronaut and the ship stay healthy (the ship used to fall first now and then)
 ok(!!got,'an egg is laid',got||await p.evaluate(()=>({state:__T.state,toSpawn:__T.toSpawn,rt:__heads.WB.rt,eggPlan:__ronda.eggPlan,late:__late.s,spiders:__heads.spiders.map(s=>s.kind+':'+s.state)})));
 await p.close();

 console.log('7) ?ronda=12: the counts further on');
 p=await boot('?ronda=12');r=await st(p);
 ok(r.round===12&&r.spitN===5&&r.incN===2,'round 12: 5 Escupidoras (6, 7, 9, 10x2) and 2 Incineradoras (8, 11) met',r);
 await p.close();

 ok(allErrs.length===0,'no page errors',allErrs.slice(0,4));
 await b.close();
 console.log(bad?`${bad} FAILED`:'ALL OK');process.exit(bad?1:0);
})();
