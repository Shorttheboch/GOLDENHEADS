// Incinerator (v67): easier to kill, runs across the hull, swims through space after you clawing, smooth return, its own entrance.
// Run on dist-test. Screenshots: inc_cine_<t>.png, inc_swim.png
const {chromium}=require('playwright');
const {BASE,ARGS,shot}=require('./lib.cjs');
(async()=>{
 const b=await chromium.launch({args:ARGS});
 const p=await b.newPage({viewport:{width:1280,height:720}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto(BASE+'/test.html?q=3');
 await p.waitForFunction(()=>document.getElementById('play')&&!document.getElementById('play').disabled,null,{timeout:300000});
 await p.evaluate(()=>document.getElementById('play').click());
 const step=s=>p.evaluate(n=>__step(n),Math.round(s/0.05));
 const snap=async name=>{await p.evaluate(()=>{window.__manual=1;});await p.waitForTimeout(200);await p.evaluate(()=>__render());await p.waitForTimeout(300);await p.screenshot({path:shot(name),timeout:180000});await p.evaluate(()=>{window.__manual=0;});};
 await step(1);
 // 1) the entrance: a higher lens for the fall, then a push-in to its face
 await p.evaluate(()=>{window.__noSpawn=1;for(const s of [...__heads.spiders])__heads.killSpider(s);window.__inc=__heads.spawnInc(true);});
 for(const [t,name] of [[0.9,'a_cae'],[1.4,'b_golpe'],[1.6,'c_zoom'],[1.6,'d_cara']]){await step(t);
   const c=await p.evaluate(()=>({t:+__heads.CINE.t.toFixed(2),on:__heads.CINE.on,st:__inc.st,fov:+__camera.fov.toFixed(1),camToHead:+__camera.position.distanceTo(__inc.bHead.getWorldPosition(new __THREE.Vector3())).toFixed(2)}));
   console.log('cine',name,JSON.stringify(c));await snap('inc_cine_'+name+'.png');}
 await step(1.5);console.log('after cine',JSON.stringify(await p.evaluate(()=>({on:__heads.CINE.on,st:__inc.st,hp:__inc.hp,maxHp:__inc.maxHp}))));
 // keep the astronaut alive for the measurements (damage is counted, then healed every frame)
 await p.evaluate(()=>{window.__keep=()=>{const P=__heads.P;const d=Math.max(0,100-P.hp);P.hp=100;return d;};});
 // 2) it runs across the hull: you stand on the ship, ~10 m away; its clips and running speed over 12 s
 const runs=await p.evaluate(()=>{const e=__inc,P=__heads.P,T=__THREE;e.cds.beam=99;e.cds.leap=99;
   const hp=__hullParam(e.pos);const [q,n]=__hullPoint(hp.z+10,hp.th);P.pos.copy(q).addScaledVector(n,1.0);P.vel.set(0,0,0);
   const seen={},sp=[];let last=e.pos.clone(),dmg=0;for(let i=0;i<240;i++){__step(1);dmg+=__keep();P.vel.set(0,0,0);P.pos.copy(q).addScaledVector(n,1.0);e.cds.beam=99;
     const c=e.B.curName;seen[c]=(seen[c]||0)+1;if(e.st==='stalk'&&c==='Run')sp.push(e.pos.distanceTo(last)/0.05);last.copy(e.pos);}
   sp.sort((a,b)=>a-b);return {clips:seen,runFrames:sp.length,runSpeed:sp.length?+sp[sp.length>>1].toFixed(2):0,state:__T.state};});
 console.log('on the hull 12 s',JSON.stringify(runs));
 // 3) you float far off the ship: it swims after you and claws, then has to go back
 const sw=await p.evaluate(()=>{const P=__heads.P,T=__THREE,e=__inc;e.cds.leap=0;e.cds.beam=99;e.cds.melee=0;e.st='stalk';
   const o=e.pos.clone().addScaledVector(e.n,18).add(new T.Vector3(5,0,0));P.pos.copy(o);P.vel.set(0,0,0);P.inv=0;
   const log=[];let st='',dmg=0,maxOut=0,claws=0;for(let i=0;i<320;i++){__step(1);dmg+=__keep();P.vel.set(0,0,0);P.pos.copy(o);P.inv=0;e.cds.beam=99;
     if(e.st!==st){st=e.st;log.push(st+'@'+(i*0.05).toFixed(1));}
     if(e.st==='swim'){maxOut=Math.max(maxOut,e.pos.distanceTo(e.sw.o));if(e.B.curName==='JumpSlash'&&e.B.at&&e.atk)claws++;}}
   return {log,damage:+dmg.toFixed(1),maxOut:+maxOut.toFixed(1),state:__T.state};});
 console.log('swim',JSON.stringify(sw));
 // the return: no jumps in position or in its back direction from frame to frame
 const back=await p.evaluate(()=>{const e=__inc,P=__heads.P;e.cds.leap=0;e.cds.beam=99;e.st='stalk';const o=e.pos.clone().addScaledVector(e.n,14);P.pos.copy(o);P.vel.set(0,0,0);
   let maxJ=0,maxTurn=0,lp=null,ln=null,phase=[];for(let i=0;i<300;i++){__step(1);__keep();P.vel.set(0,0,0);P.pos.copy(o);e.cds.beam=99;
     if(e.st==='back'){if(lp){maxJ=Math.max(maxJ,e.pos.distanceTo(lp));maxTurn=Math.max(maxTurn,Math.acos(Math.min(1,e.n.dot(ln))));}lp=e.pos.clone();ln=e.n.clone();}else lp=null;
     if(!phase.length||phase[phase.length-1]!==e.st)phase.push(e.st);}
   return {phase,maxStepPerFrame:+maxJ.toFixed(3),maxTurnDegPerFrame:+(maxTurn*180/Math.PI).toFixed(2)};});
 console.log('back',JSON.stringify(back));
 await p.evaluate(()=>{const e=__inc,P=__heads.P;const o=e.pos.clone().addScaledVector(e.n,16);P.pos.copy(o);e.cds.leap=0;e.st='stalk';for(let i=0;i<40;i++){__step(1);__keep();P.pos.copy(o);P.vel.set(0,0,0);}});
 await snap('inc_swim.png');
 // 4) easier to kill: body shots from the front at ~6.7 shots/s (one every 3 frames), as a player would
 const kill=await p.evaluate(()=>{const e=__inc,P=__heads.P;e.st='stalk';e.cds.guard=0;let shots=0,frames=0;const o=e.pos.clone().addScaledVector(e.n,1.2).addScaledVector(e.face,8);
   while(e.st!=='dead'&&shots<400){P.pos.copy(o);P.vel.set(0,0,0);__keep();if(frames%3===0){const c=e.pos.clone().addScaledVector(e.n,1.5);__heads.incDamage(e,1,'body',e.face.clone().negate(),c);shots++;}__step(1);frames++;}
   return {shots,seconds:+(frames*0.05).toFixed(1),maxHp:e.maxHp};});
 console.log('body shots to kill',JSON.stringify(kill));
 console.log('errors',JSON.stringify(errs.slice(0,5)));
 await b.close();})();
