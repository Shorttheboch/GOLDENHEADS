// Incinerator (v67): easier to kill, runs across the hull, its own entrance. v69: it SWIMS whenever it leaves the hull (Swim_Start/Loop/Slash/Turn180/Land)
// and it GRABS ROCKS (lands on them with Swim_Land, stays glued, fires the laser once, leaves with Swim_Start).
// Swim: flip continuity, speeds per phase, claw frames, chase turn, smooth return and landing. Rocks: landing, glue to a drifting rock, laser, pounce, never the same rock
// twice in a row, at most 2 rock stops per trip, death on a rock.
// Run on dist-test. Screenshots: inc_cine_<t>.png, inc_v69_swim / slash / turn / land .png, inc_v69_rock_side / rock_front .png
const {chromium}=require('playwright');
const {BASE,ARGS,shot}=require('./lib.cjs');
// helpers installed inside a page: run frames holding the astronaut where it floats, heal it, count the damage; rocks put out of the way (z=400: faded out, not usable)
const HELPERS=()=>{window.__keep=()=>{const P=__heads.P;const d=Math.max(0,100-P.hp);P.hp=100;return d;};window.__hold=null;window.__inv0=0;window.__beamOK=0;
  window.__go=(n,fn)=>{const e=__inc,P=__heads.P;for(let i=0;i<n;i++){__step(1);window.__fd=__keep();window.__dmg=(window.__dmg||0)+window.__fd;P.vel.set(0,0,0);if(window.__hold)P.pos.copy(window.__hold);if(window.__inv0)P.inv=0;if(!window.__beamOK)e.cds.beam=99;if(fn&&fn(i)===true)return i;}return -1;};
  window.__bw=(e,k)=>e.B.bones[k].getWorldPosition(new __THREE.Vector3());
  window.__hh=p=>{const hq=__hullParam(p),[q,n]=__hullPoint(hq.z,hq.th);return p.clone().sub(q).dot(n);};
  window.__ang=(a,b)=>Math.acos(Math.min(1,Math.max(-1,a.dot(b))))*180/Math.PI;
  window.__launch=(up,side)=>{const P=__heads.P,T=__THREE,e=__inc;e.cds.leap=0;e.cds.beam=99;e.cds.melee=0;e.st='stalk';e.sl=0;e.sa=0;e.rk=null;e.rockStops=0;e.lastRock=null;
    const o=e.pos.clone().addScaledVector(e.n,up).add(new T.Vector3(side,0,0));window.__hold=o;P.pos.copy(o);P.vel.set(0,0,0);P.inv=0;window.__dmg=0;return o.toArray().map(x=>+x.toFixed(1));};
  window.__hide=()=>{for(const R of __heads.ROCKS){R.c.set(0,0,400);R.mesh.position.copy(R.c);}};
  // rock i at the hull spot (z,th), `up` m above the hull
  window.__put=(i,z,th,up)=>{const R=__heads.ROCKS[i],[q,n]=__hullPoint(z,th);R.c.copy(q).addScaledVector(n,up);R.mesh.position.copy(R.c);R.leaving=false;return [q,n];};
  // it swims to rock 4 (12 m over the hull spot z 4, th 1.57) with you floating beyond it; returns when it stands on it
  window.__toRock=()=>{const H=__heads,P=H.P,e=__inc,R=H.ROCKS[4];window.__hide();const [q,n]=window.__put(4,4,1.57,12);__step(2);
    e.pos.copy(q);e.n.copy(n);e.z=4;e.th=1.57;e.face.set(1,0,0).addScaledVector(n,-n.x).normalize();e.roam=null;e.rk=null;e.rockStops=0;e.lastRock=null;e.cds.leap=0;e.cds.melee=0;e.cds.beam=99;
    const dir=R.c.clone().sub(q).normalize(),far=R.c.clone().addScaledVector(dir,R.rmax+14);window.__hold=far;P.pos.copy(far);P.vel.set(0,0,0);P.inv=0;window.__dmg=0;
    e.st='swimStart';e.t=0;e.sa=0;e.B.play('Swim_Start',0.2);window.__go(260,()=>e.st==='rock');return e.st==='rock';};
  window.__home=()=>{window.__hold=null;window.__inv0=0;window.__go(700,i=>i>10&&__inc.st==='stalk');}; // let it finish the trip and walk again
  window.__hide();__step(2);};
(async()=>{
 const b=await chromium.launch({args:ARGS});const errs=[];
 const boot=async()=>{const pg=await b.newPage({viewport:{width:960,height:540}});pg.on('pageerror',e=>errs.push(e.message));
   await pg.addInitScript(()=>{let s=20261030;Math.random=()=>{s=(s*1664525+1013904223)%4294967296;return s/4294967296;};}); // fixed seed: the run is repeatable (steps have a fixed dt)
   await pg.goto(BASE+'/test.html?q=3');
   await pg.waitForFunction(()=>document.getElementById('play')&&!document.getElementById('play').disabled,null,{timeout:300000});await pg.evaluate(()=>document.getElementById('play').click());return pg;};
 const p=await boot();
 const fails=[];const check=(name,ok,info)=>{console.log((ok?'ok   ':'FAIL ')+name+(info!==undefined?'  '+JSON.stringify(info):''));if(!ok)fails.push(name);};
 const step=s=>p.evaluate(n=>__step(n),Math.round(s/0.05));
 await step(1);
 // 1) the entrance: a higher lens for the fall, then a push-in to its face
 await p.evaluate(()=>{window.__noSpawn=1;for(const s of [...__heads.spiders])__heads.killSpider(s);window.__inc=__heads.spawnInc(true);});
 for(const [t,name] of [[0.9,'a_cae'],[1.4,'b_golpe'],[1.6,'c_zoom'],[1.6,'d_cara']]){await step(t);
   const c=await p.evaluate(()=>({t:+__heads.CINE.t.toFixed(2),on:__heads.CINE.on,st:__inc.st,fov:+__camera.fov.toFixed(1),camToHead:+__camera.position.distanceTo(__inc.bHead.getWorldPosition(new __THREE.Vector3())).toFixed(2)}));
   console.log('cine',name,JSON.stringify(c));}
 await step(1.5);console.log('after cine',JSON.stringify(await p.evaluate(()=>({on:__heads.CINE.on,st:__inc.st,hp:__inc.hp,maxHp:__inc.maxHp}))));
 // keep the astronaut alive for the measurements (damage is counted, then healed every frame); rocks out of the way until section 5
 await p.evaluate(HELPERS);
 // 2) it runs across the hull: you stand on the ship, ~10 m away; its clips and running speed over 12 s
 const runs=await p.evaluate(()=>{const e=__inc,P=__heads.P,T=__THREE;e.cds.beam=99;e.cds.leap=99;
   const hp=__hullParam(e.pos);const [q,n]=__hullPoint(hp.z+10,hp.th);P.pos.copy(q).addScaledVector(n,1.0);P.vel.set(0,0,0);
   const seen={},sp=[];let last=e.pos.clone(),dmg=0;for(let i=0;i<240;i++){__step(1);dmg+=__keep();P.vel.set(0,0,0);P.pos.copy(q).addScaledVector(n,1.0);e.cds.beam=99;
     const c=e.B.curName;seen[c]=(seen[c]||0)+1;if(e.st==='stalk'&&c==='Run')sp.push(e.pos.distanceTo(last)/0.05);last.copy(e.pos);}
   sp.sort((a,b)=>a-b);return {clips:seen,runFrames:sp.length,runSpeed:sp.length?+sp[sp.length>>1].toFixed(2):0,state:__T.state};});
 console.log('on the hull 12 s',JSON.stringify(runs));
 // 3) v69: it SWIMS whenever it leaves the hull (Swim_Start -> Swim_Loop (+ Swim_Slash / Swim_Turn180) -> Swim_Land -> stalk)
 // 3a) the flip handoff, numerically and with no game logic: Swim_Turn180 at its end in the OLD entity frame must look exactly like Swim_Turn180_R at its end in the NEW frame
 const flipChk=await p.evaluate(()=>{const T=__THREE,B1=__makeBiped(3),B2=__makeBiped(3);__scene.add(B1.g,B2.g);const F=B1.flip,dur=B1.acts.Swim_Turn180.getClip().duration;
   const nn=new T.Vector3(0.3,0.8,-0.5).normalize(),ff=new T.Vector3(0.7,-0.2,0.6);ff.addScaledVector(nn,-ff.dot(nn)).normalize();const xx=new T.Vector3().crossVectors(nn,ff);
   B1.g.position.set(4,-7,12);B1.g.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(xx,nn,ff));
   // the new frame = old frame turned 180 degrees about its up and moved by the pivot shift along the OLD axes
   B2.g.quaternion.copy(B1.g.quaternion).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),Math.PI));
   B2.g.position.copy(B1.g.position).addScaledVector(xx,F[0]*3).addScaledVector(nn,F[1]*3).addScaledVector(ff,F[2]*3);
   B1.set('Swim_Turn180',dur);B2.set('Swim_Turn180_R',dur);B1.update(0.01);B2.update(0.01);B1.g.updateMatrixWorld(true);B2.g.updateMatrixWorld(true);
   let max=0,mk='',n=0,sum=0;for(const k of Object.keys(B1.bones)){if(k==='root')continue;const a=B1.bones[k].getWorldPosition(new T.Vector3()),b=B2.bones[k].getWorldPosition(new T.Vector3()),d=a.distanceTo(b);sum+=d;n++;if(d>max){max=d;mk=k;}}
   // and without the pivot shift (what a plain 180 degree flip would give)
   B2.g.position.copy(B1.g.position);B2.g.updateMatrixWorld(true);let noShift=0;for(const k of ['pelvis','head']){noShift=Math.max(noShift,B1.bones[k].getWorldPosition(new T.Vector3()).distanceTo(B2.bones[k].getWorldPosition(new T.Vector3())));}
   __scene.remove(B1.g,B2.g);return {bones:n,maxDiffCm:+(max*100).toFixed(3),maxBone:mk,meanDiffCm:+(sum/n*100).toFixed(3),pivotShiftModel:F,plainFlipNoShiftPelvisHeadErrCm:+(noShift*100).toFixed(1),clipOk:!!B1.acts.Swim_Turn180_R};});
 console.log('flip continuity (all bones except the unskinned root)',JSON.stringify(flipChk));
 check('flip: max world-space bone difference < 1 cm',flipChk.clipOk&&flipChk.maxDiffCm<1,flipChk.maxDiffCm);
 // 3b) you float ~16 m off the ship: the whole trip, frame by frame
 const swim=await p.evaluate(()=>{const P=__heads.P,e=__inc;window.__launch(16,5);window.__inv0=1;
   const log=[],ph={},hits=[],land={maxStep:0,maxFaceDeg:0,maxNDeg:0,maxPelvisStepOverDrift:0,minH:99,frames:0,arrive:null},flips=[];let last='',pr=false,lp,lf,ln,lpel,lhead,lclip='',seenLand=false;
   const n0=window.__go(500,i=>{const k=e.st+'/'+e.B.curName+(e.st==='swim'?'/'+e.sw.sm:e.st==='swimBack'?'/'+e.lp.sm:'');
     if(k!==last){last=k;log.push((i*0.05).toFixed(2)+' '+k);}
     if(e.st==='swim'||(e.st==='swimStart'&&e.sa)){const key=e.st==='swimStart'?'start':e.sw.sm;const q=(ph[key]=ph[key]||{n:0,sum:0,min:99,max:0});const v=e.vel.length();q.n++;q.sum+=v;q.min=Math.min(q.min,v);q.max=Math.max(q.max,v);}
     // claw frames: every swing that lands (the invulnerability is zeroed here, so all 3 show)
     if(window.__fd>0.01)hits.push({t:+(i*0.05).toFixed(2),dmg:+window.__fd.toFixed(1),clipFrame:+(e.B.cur.time*24).toFixed(1),clip:e.B.curName});
     const pel=window.__bw(e,'pelvis'),head=window.__bw(e,'head');
     if(lclip==='Swim_Turn180'&&e.B.curName==='Swim_Loop'&&lpel)flips.push({t:+(i*0.05).toFixed(2),pelvisJumpCm:+(pel.distanceTo(lpel)*100).toFixed(1),headJumpCm:+(head.distanceTo(lhead)*100).toFixed(1),driftCm:+(e.vel.length()*0.05*100).toFixed(1),facingChangeDeg:+window.__ang(e.face,lf).toFixed(1)});
     // the return and the landing: how smooth
     const ret=(e.st==='swimBack'&&e.lp&&e.lp.sm==='path')||(e.st==='swimLand');
     if(ret){land.frames++;if(pr){land.maxStep=Math.max(land.maxStep,e.pos.distanceTo(lp));land.maxFaceDeg=Math.max(land.maxFaceDeg,window.__ang(e.face,lf));land.maxNDeg=Math.max(land.maxNDeg,window.__ang(e.n,ln));land.maxPelvisStepOverDrift=Math.max(land.maxPelvisStepOverDrift,pel.distanceTo(lpel)-e.pos.distanceTo(lp));}
       if(!e.sl)land.minH=Math.min(land.minH,window.__hh(e.pos));
       if(e.sl&&!land.arrive){const h=__hullParam(e.pos),hn=__hullPoint(h.z,h.th)[1];land.arrive={t:+(i*0.05).toFixed(2),clip:e.B.curName,clipFrame:+(e.B.cur.time*24).toFixed(1),upVsHullNormalDeg:+window.__ang(e.n,hn).toFixed(2),faceDotUp:+e.face.dot(e.n).toFixed(4)};}}
     if(e.st==='swimLand')seenLand=true;
     pr=ret;lp=e.pos.clone();lf=e.face.clone();ln=e.n.clone();lpel=pel;lhead=head;lclip=e.B.curName;
     if(seenLand&&e.st==='stalk'){return true;}});
   const stat=o=>Object.fromEntries(Object.entries(o).map(([k,q])=>[k,{frames:q.n,mean:+(q.sum/q.n).toFixed(2),min:+q.min.toFixed(2),max:+q.max.toFixed(2)}]));
   window.__inv0=0;
   return {seconds:+(n0*0.05).toFixed(2),log,speedsMS:stat(ph),slashClawFrames:hits,flips,landing:{...land,maxStep:+land.maxStep.toFixed(3),maxFaceDeg:+land.maxFaceDeg.toFixed(2),maxNDeg:+land.maxNDeg.toFixed(2),maxPelvisStepOverDrift:+land.maxPelvisStepOverDrift.toFixed(3),minH:+land.minH.toFixed(2)},damage:+window.__dmg.toFixed(1)};});
 console.log('swim trip',JSON.stringify(swim,null,1));
 const seq=swim.log.map(x=>x.split(' ')[1]);const inOrder=(a,b)=>{let i=0;for(const s of b){i=a.findIndex((x,k)=>k>=i&&x.startsWith(s));if(i<0)return false;}return true;};
 check('swim sequence: Swim_Start -> Swim_Loop -> Swim_Slash -> Swim_Land -> stalk',inOrder(seq,['swimStart/Swim_Start','swim/Swim_Loop/loop','swim/Swim_Slash/slash','swimLand/Swim_Land','stalk']),swim.log);
 check('swim lasts 5-12 s',swim.seconds>=5&&swim.seconds<=12,swim.seconds);
 check('landing: per-frame turn of body and back < 40 degrees (it was 177 before the fix; tight U-turn cases reach ~33)',swim.landing.maxFaceDeg<40&&swim.landing.maxNDeg<40,[swim.landing.maxFaceDeg,swim.landing.maxNDeg]);
 check('landing: per-frame root step < 0.45 m (<= 9 m/s)',swim.landing.maxStep<0.45,swim.landing.maxStep);
 check('landing: arrives upright on the hull (back = hull normal) at ~frame 8-10 of Swim_Land',swim.landing.arrive&&swim.landing.arrive.upVsHullNormalDeg<2&&swim.landing.arrive.clipFrame>=7&&swim.landing.arrive.clipFrame<=11,swim.landing.arrive);
 check('landing: the root never dips into the hull (> -25 cm, the touchdown pose is a bit low)',swim.landing.minH>-0.25,swim.landing.minH);
 check('swim: Swim_Turn180 flips happened with a small pelvis jump (< 20 cm)',swim.flips.length>=1&&swim.flips.every(f=>f.pelvisJumpCm<20),swim.flips);
 // 3b2) cruise: the player keeps 44 m ahead of it so it never slashes or turns; speed over the loop
 const cruise=await p.evaluate(()=>{const P=__heads.P,e=__inc;window.__launch(44,0);window.__inv0=0;
   const sp=[],log=[];let last='',t0=-1,pos0=null,posN=null,tN=0,puffs=0,lf=0;
   window.__go(300,i=>{const k=e.st+'/'+e.B.curName+(e.st==='swim'?'/'+e.sw.sm:e.st==='swimBack'?'/'+e.lp.sm:'');if(k!==last){last=k;log.push((i*0.05).toFixed(2)+' '+k);}
     if(e.st==='swim'&&e.sw.sm==='loop'){if(t0<0){t0=i;pos0=e.sc.clone();}posN=e.sc.clone();tN=i;sp.push(e.vel.length());if(lf<11&&e.sw.fr>=11)puffs++;lf=e.sw.fr;}
     if(e.st==='swim')window.__hold=e.sc.clone().addScaledVector(e.sdir,44);
     if(e.st==='swimBack')return true;});
   const sum=sp.reduce((a,b)=>a+b,0);window.__hold=null;
   return {log,frames:sp.length,meanMS:+(sum/sp.length).toFixed(2),minMS:+Math.min(...sp).toFixed(2),maxMS:+Math.max(...sp).toFixed(2),avgByDistanceMS:+(posN.distanceTo(pos0)/((tN-t0)*0.05)).toFixed(2),strokes:puffs,strokesPerSec:+(puffs/(sp.length*0.05)).toFixed(2)};});
 console.log('cruise (straight, nobody to slash)',JSON.stringify(cruise));
 check('cruise: average ~7.5 m/s (6.8-8.2), min >= 5, max <= 11',cruise.meanMS>=6.8&&cruise.meanMS<=8.2&&cruise.minMS>=5&&cruise.maxMS<=11,[cruise.meanMS,cruise.minMS,cruise.maxMS]);
 await p.evaluate(()=>window.__home());
 // 3b3) a swimmer that always has you ~4.5 m ahead: one slash, all three claws (f9, f16, f27) land
 const claws=await p.evaluate(()=>{const P=__heads.P,e=__inc;window.__launch(16,0);window.__inv0=1;const hits=[];let slashT=-1;
   window.__go(200,i=>{if(e.st==='swim'){window.__hold=e.sc.clone().addScaledVector(e.face,4.5);}
     if(e.st==='swim'&&e.sw.sm==='slash'&&slashT<0)slashT=i;
     if(window.__fd>0.01)hits.push({clipFrame:+(e.B.cur.time*24).toFixed(1),dmg:+window.__fd.toFixed(1)});
     return slashT>=0&&e.sw.sm==='loop';});
   window.__inv0=0;window.__hold=null;return {hits};});
 console.log('slash claws',JSON.stringify(claws));
 check('slash: 3 claws of 10 damage near frames 9, 16, 27',claws.hits.length===3&&claws.hits.every(h=>h.dmg===10)&&Math.abs(claws.hits[0].clipFrame-9)<3.5&&Math.abs(claws.hits[1].clipFrame-16)<3.5&&Math.abs(claws.hits[2].clipFrame-27)<3.5,claws.hits);
 await p.evaluate(()=>window.__home());
 // 3c) the natural invulnerability (0.9 s) is left alone: how much damage does one slash really do?
 const dm=await p.evaluate(()=>{const e=__inc;window.__launch(10,3);window.__inv0=0;window.__dmg=0;const hits=[];let seen=false;
   const n0=window.__go(500,i=>{if(window.__fd>0.01)hits.push({t:+(i*0.05).toFixed(2),dmg:+window.__fd.toFixed(1),clipFrame:+(e.B.cur.time*24).toFixed(1)});if(e.st==='swimLand')seen=true;return seen&&e.st==='stalk';});
   return {hits,total:+window.__dmg.toFixed(1)};});
 console.log('damage with the normal 0.9 s invulnerability',JSON.stringify(dm));
 // 3d) you get behind it while it chases: Swim_Turn180, the flip, and it carries on
 const trn=await p.evaluate(()=>{const P=__heads.P,e=__inc,T=__THREE;window.__launch(16,5);window.__inv0=0;const log=[],sp=[];let last='',lclip='',lpel,lhead,lf,flip=null,afterT=0,t0=-1,minSp=99,nTurns=0;
   const n0=window.__go(400,i=>{const k=e.st+'/'+e.B.curName+(e.st==='swim'?'/'+e.sw.sm:'');if(k!==last){last=k;log.push((i*0.05).toFixed(2)+' '+k);}
     if(e.st==='swim'&&e.sw.sm==='loop'&&e.sw.t>0.8&&t0<0){t0=i;window.__hold=e.sc.clone().addScaledVector(e.face,-14);} // you are now far behind its back (before it is near enough to slash)
     if(e.st==='swim'&&e.sw.sm==='turn'){minSp=Math.min(minSp,e.vel.length());}
     const pel=window.__bw(e,'pelvis'),head=window.__bw(e,'head');
     if(lclip==='Swim_Turn180'&&e.B.curName==='Swim_Loop'){nTurns++;flip={t:+(i*0.05).toFixed(2),pelvisJumpCm:+(pel.distanceTo(lpel)*100).toFixed(1),headJumpCm:+(head.distanceTo(lhead)*100).toFixed(1),driftCm:+(e.vel.length()*0.05*100).toFixed(1),facingChangeDeg:+window.__ang(e.face,lf).toFixed(1),speedAtFlip:+e.vel.length().toFixed(2)};afterT=i;}
     if(flip&&i>afterT+30)return true;
     lclip=e.B.curName;lpel=pel;lhead=head;lf=e.face.clone();});
   return {log,turnMinSpeed:+minSp.toFixed(2),flip};});
 console.log('chase turn',JSON.stringify(trn,null,1));
 await p.evaluate(()=>window.__home());
 check('chase turn: brakes to ~1.5 m/s and flips 180 degrees',trn.turnMinSpeed<=1.8&&trn.flip&&Math.abs(trn.flip.facingChangeDeg-180)<2,[trn.turnMinSpeed,trn.flip&&trn.flip.facingChangeDeg]);
 // back on the hull: it walks again (you stand on the ship, so it does not take off)
 await p.evaluate(()=>{window.__home();const e=__inc,P=__heads.P;e.cds.leap=99;e.cds.melee=99;const hp=__hullParam(e.pos);const [q,n]=__hullPoint(hp.z,hp.th+0.6);window.__hold=q.clone().addScaledVector(n,1.0);window.__go(40);});
 const after=await p.evaluate(()=>({st:__inc.st,clip:__inc.B.curName,sa:__inc.sa,sl:__inc.sl,hp:__inc.hp}));console.log('after the trips',JSON.stringify(after));
 check('back on the hull after the trips (stalk, nothing stuck)',after.st==='stalk'&&!after.sa&&!after.sl,after);
 await p.evaluate(()=>{window.__hold=null;});
 // 5) v69: it grabs ROCKS. Rock 4 is put 12 m over the hull spot (z 4, th 1.57); the player floats beyond it so its swim crosses the rock.
 // 5a) swim -> Swim_Land on the rock -> glued to a drifting rock -> faces you, fires the laser ONCE -> Swim_Start -> swim -> Swim_Land on the hull
 const rt=await p.evaluate(()=>{const H=__heads,P=H.P,e=__inc,T=__THREE,R=H.ROCKS[4],rocks=H.ROCKS;window.__hide();const [q,n]=window.__put(4,4,1.57,12);__step(2);
   e.pos.copy(q);e.n.copy(n);e.z=4;e.th=1.57;e.face.set(1,0,0).addScaledVector(n,-n.x).normalize();e.roam=null;e.rk=null;e.rockStops=0;e.lastRock=null;e.cds.leap=0;e.cds.melee=0;e.cds.beam=99;
   const dir=R.c.clone().sub(q).normalize(),far=R.c.clone().addScaledVector(dir,R.rmax+14);window.__hold=far;P.pos.copy(far);P.vel.set(0,0,0);P.inv=0;window.__dmg=0;
   e.st='swimStart';e.t=0;e.sa=0;e.B.play('Swim_Start',0.2);
   const log=[],ev={};let last='',t=0,pr=false,lp,lf,ln;const land={maxStep:0,maxFaceDeg:0,maxNDeg:0};
   const step=()=>{window.__go(1);t++;const k=e.st+'/'+e.B.curName+(e.st==='swim'?'/'+e.sw.sm:e.st==='swimBack'?'/'+e.lp.sm+(e.lp.ref?'*rock':''):'')+(e.rk?'+glued':'');if(k!==last){last=k;log.push((t*0.05).toFixed(2)+' '+k);}
     const ret=(e.st==='swimBack'&&e.lp&&e.lp.sm==='path')||e.st==='swimLand';if(ret&&pr){land.maxStep=Math.max(land.maxStep,e.pos.distanceTo(lp));land.maxFaceDeg=Math.max(land.maxFaceDeg,window.__ang(e.face,lf));land.maxNDeg=Math.max(land.maxNDeg,window.__ang(e.n,ln));}
     pr=ret;lp=e.pos.clone();lf=e.face.clone();ln=e.n.clone();};
   // 1. to the rock
   for(let i=0;i<200&&e.st!=='rock';i++)step();
   ev.onRockAt=+(t*0.05).toFixed(2);ev.onRock=e.st==='rock'&&e.rk&&e.rk.R===R;ev.stayS=e.rk?+e.rk.stay.toFixed(1):null;ev.landJumps={maxStep:+land.maxStep.toFixed(3),maxFaceDeg:+land.maxFaceDeg.toFixed(1),maxNDeg:+land.maxNDeg.toFixed(1)};
   if(!ev.onRock)return {log,ev};
   ev.upVsRockNormalDeg=+window.__ang(e.n,e.pos.clone().sub(R.c).normalize()).toFixed(1); // (the radial direction is only close to the normal)
   e.rk.stay=99;window.__mr=window.__mr||Math.random;Math.random=()=>0.99; // from here on: no second rock stop
   // 2. glue: the rock drifts 1.2 m/s in z and 0.4 m/s in x for 3 s (the game's own drift is 0.6 m/s)
   const off0=e.pos.clone().sub(R.c);let maxDrift=0;
   for(let i=0;i<60;i++){R.c.z-=0.06;R.c.x+=0.02;R.mesh.position.copy(R.c);step();maxDrift=Math.max(maxDrift,e.pos.clone().sub(R.c).distanceTo(off0));}
   ev.glueMaxDriftCm=+(maxDrift*100).toFixed(2);ev.rockMovedM=+(Math.hypot(3.6,1.2)).toFixed(1);
   // 3. you appear in the clear: it turns toward you and fires the laser once
   const pl=e.pos.clone().addScaledVector(e.n,16).addScaledVector(new T.Vector3().crossVectors(e.n,e.face).normalize(),10);window.__hold=pl;P.pos.copy(pl);window.__beamOK=1;e.cds.beam=0;
   let shots=0,sawBeam=false,prev='';
   for(let i=0;i<200;i++){step();if(e.st==='charge'&&prev!=='charge')shots++;prev=e.st;if(e.st==='beam')sawBeam=true;if(e.st==='rock'&&sawBeam&&i>10)break;}
   ev.laserShots=shots;ev.backToRock=e.st==='rock';
   e.cds.beam=0;for(let i=0;i<80;i++){step();if(e.st==='charge'&&prev!=='charge')shots++;prev=e.st;}
   ev.laserShotsAfterWaiting=shots;ev.stillOnRock=e.st==='rock';window.__beamOK=0;
   const tp=pl.clone().sub(e.pos);tp.addScaledVector(e.n,-tp.dot(e.n)).normalize();ev.faceVsPlayerDeg=+window.__ang(e.face,tp).toFixed(1);
   // 4. it leaves (time up): Swim_Start off the rock, swims after you, then back to the hull (Math.random is pinned so no second rock)
   e.rk.stay=0;const h2=e.pos.clone().addScaledVector(e.n,22);window.__hold=h2;P.pos.copy(h2);
   for(let i=0;i<500;i++){step();if(e.st==='stalk')break;}
   Math.random=window.__mr;ev.end=e.st;ev.totalS=+(t*0.05).toFixed(2);ev.rockStopsOnHull=e.rockStops;ev.rkCleared=e.rk===null;
   const hp=__hullParam(e.pos);ev.endHullHeightM=+window.__hh(e.pos).toFixed(2);
   return {log,ev};});
 console.log('rock trip',JSON.stringify(rt,null,1));
 check('rock: swim -> Swim_Land on the rock -> rock (glued)',rt.ev.onRock,rt.log.slice(0,8));
 check('rock: landing per-frame turn < 40 degrees (face) / 30 (back), step < 0.45 m',rt.ev.landJumps.maxFaceDeg<40&&rt.ev.landJumps.maxNDeg<30&&rt.ev.landJumps.maxStep<0.45,rt.ev.landJumps);
 check('rock: stays on it 4-7 s by itself (stay)',rt.ev.stayS>=4&&rt.ev.stayS<=7,rt.ev.stayS);
 check('rock: glued to a moving rock, drift < 5 cm over 3 s',rt.ev.glueMaxDriftCm<5,rt.ev.glueMaxDriftCm);
 check('rock: fires the laser exactly once, then back to the rock',rt.ev.laserShots===1&&rt.ev.laserShotsAfterWaiting===1&&rt.ev.backToRock&&rt.ev.stillOnRock,[rt.ev.laserShots,rt.ev.laserShotsAfterWaiting]);
 check('rock: faces you (within 10 degrees)',rt.ev.faceVsPlayerDeg<10,rt.ev.faceVsPlayerDeg);
 const rs=rt.log.map(x=>x.split(' ')[1]);
 check('rock: sequence swim -> Swim_Land(rock) -> laser -> Swim_Start -> swim -> Swim_Land(hull) -> stalk',inOrder(rs,['swimStart/Swim_Start','swim/Swim_Loop/loop','swimBack/Swim_Loop/path*rock','swimLand/Swim_Land','rock/Idle+glued','charge/','beamStart/','beam/','beamEnd/','rock/','swimStart/Swim_Start+glued','swim/Swim_Loop/loop','swimLand/Swim_Land','stalk']),rt.log);
 check('rock: ends on the hull, nothing stuck',rt.ev.end==='stalk'&&rt.ev.rkCleared&&rt.ev.rockStopsOnHull===0&&Math.abs(rt.ev.endHullHeightM)<0.1,[rt.ev.end,rt.ev.rkCleared,rt.ev.rockStopsOnHull,rt.ev.endHullHeightM]);
 // 5b) two rocks: never the same rock twice in a row, and at most 2 rock stops per trip (the third return goes to the hull even with a rock beside it)
 const two=await p.evaluate(()=>{const H=__heads,P=H.P,e=__inc,T=__THREE,rocks=H.ROCKS,out={};window.__hide();
   const A=rocks[4],B=rocks[9],C=rocks[7];const [q,n]=window.__put(4,4,1.57,17);__step(2);
   e.pos.copy(q);e.n.copy(n);e.z=4;e.th=1.57;e.face.set(1,0,0).addScaledVector(n,-n.x).normalize();e.roam=null;e.rk=null;e.rockStops=0;e.lastRock=null;e.cds.leap=0;e.cds.melee=0;e.cds.beam=99;
   const dir=A.c.clone().sub(q).normalize(),far=A.c.clone().addScaledVector(dir,A.rmax+14);window.__hold=far;P.pos.copy(far);P.vel.set(0,0,0);P.inv=0;
   e.st='swimStart';e.t=0;e.sa=0;e.B.play('Swim_Start',0.2);
   const log=[];let last='',t=0;const mr=window.__mr||Math.random;window.__mr=mr;
   const step=()=>{window.__go(1);t++;const k=e.st+(e.st==='swimBack'?'/'+e.lp.sm+(e.lp.ref?'*'+rocks.indexOf(e.lp.ref):''):'')+(e.rk?'@'+rocks.indexOf(e.rk.R):'');if(k!==last){last=k;log.push((t*0.05).toFixed(2)+' '+k);}};
   for(let i=0;i<260&&e.st!=='rock';i++)step();
   out.firstStopOnA=e.st==='rock'&&e.rk.R===A;if(!out.firstStopOnA){out.log=log;return out;}
   // leave A, you float to its side; once it swims, put rock X 11 m beside it and force the return (Math.random pinned to 0 = "take a rock if you may"); A is nearer than X
   const leaveAndReturn=(X,beside)=>{e.rk.stay=0;const sd0=new T.Vector3().crossVectors(e.n,e.face).normalize(),pl=e.pos.clone().addScaledVector(sd0,24).addScaledVector(e.n,5);window.__hold=pl;P.pos.copy(pl);
     for(let i=0;i<120&&!(e.st==='swim'&&e.sw.t>0.8);i++)step();
     const f=e.face.clone(),sd=new T.Vector3().crossVectors(e.n,e.face).normalize(),last0=e.lastRock;
     X.c.copy(e.sc).addScaledVector(sd,beside).addScaledVector(f,3);X.mesh.position.copy(X.c);
     const nearLast=last0?e.sc.distanceTo(last0.c):null,nearX=e.sc.distanceTo(X.c);
     Math.random=()=>0;e.sw.T=0;step();Math.random=mr;
     return {state:e.st,ref:e.lp?rocks.indexOf(e.lp.ref):null,lastRockIdx:rocks.indexOf(last0),centreDistLastM:nearLast&&+nearLast.toFixed(1),centreDistNewM:+nearX.toFixed(1)};};
   out.r1=leaveAndReturn(B,11);
   for(let i=0;i<400&&e.st!=='rock'&&e.st!=='stalk';i++)step();
   out.secondStopOnB=e.st==='rock'&&e.rk&&e.rk.R===B;out.rockStopsAfterTwo=e.rockStops;
   if(!out.secondStopOnB){out.log=log;return out;}
   out.r2=leaveAndReturn(C,8);
   for(let i=0;i<500&&e.st!=='stalk';i++)step();
   out.end=e.st;out.rockStopsOnHull=e.rockStops;out.log=log;window.__hold=null;return out;});
 console.log('two rocks',JSON.stringify(two,null,1));
 check('rocks: first stop on rock A',two.firstStopOnA);
 check('rocks: the return picks rock B, not A (A, the one it just left, is nearer)',two.r1&&two.r1.ref===9&&two.r1.lastRockIdx===4&&two.r1.centreDistLastM<two.r1.centreDistNewM,two.r1);
 check('rocks: second stop on B, two stops counted',two.secondStopOnB&&two.rockStopsAfterTwo===2,[two.secondStopOnB,two.rockStopsAfterTwo]);
 check('rocks: after two stops it returns to the hull even with a rock beside it',two.r2&&two.r2.ref===-1&&two.end==='stalk'&&two.rockStopsOnHull===0,[two.r2,two.end,two.rockStopsOnHull]);
 // 5c) pounce: you come within ~6 m of the perched creature and it leaves at once
 const pounce=await p.evaluate(()=>{const H=__heads,P=H.P,e=__inc,rocks=H.ROCKS;window.__hide();const [q,n]=window.__put(4,4,1.57,12);__step(2);
   e.pos.copy(q);e.n.copy(n);e.z=4;e.th=1.57;e.face.set(1,0,0).addScaledVector(n,-n.x).normalize();e.roam=null;e.rk=null;e.rockStops=0;e.lastRock=null;e.cds.leap=0;e.cds.melee=0;e.cds.beam=99;
   const R=rocks[4],dir=R.c.clone().sub(q).normalize(),far=R.c.clone().addScaledVector(dir,R.rmax+14);window.__hold=far;P.pos.copy(far);P.vel.set(0,0,0);P.inv=0;
   e.st='swimStart';e.t=0;e.sa=0;e.B.play('Swim_Start',0.2);
   window.__go(260,()=>e.st==='rock');if(e.st!=='rock')return {landed:false};
   e.rk.stay=99;const t0=e.clk;const near=e.pos.clone().addScaledVector(e.n,4);window.__hold=near;P.pos.copy(near);
   const n0=window.__go(10,()=>e.st==='swimStart');
   const res={landed:true,leftWithinFrames:n0+1,state:e.st,clip:e.B.curName,distM:+e.pos.distanceTo(near).toFixed(1)};
   window.__hold=e.pos.clone().addScaledVector(e.n,25);window.__go(300,()=>e.st==='swim'||e.st==='swimBack');res.thenState=e.st;res.rkAfterLaunch=e.rk===null;
   return res;});
 console.log('pounce',JSON.stringify(pounce));
 check('rock: you within 6 m -> it leaves with Swim_Start at once, glue released at the push',pounce.landed&&pounce.leftWithinFrames<=2&&pounce.clip==='Swim_Start'&&pounce.rkAfterLaunch,pounce);
 // 5d) standing on the rock: Idle, the back along the rock normal, the toe tips near the surface (the hull baseline with the same IK is 0.1-0.25 m; on a lumpy rock 0-0.5 m)
 const stand=await p.evaluate(()=>{const e=__inc,H=__heads,T=__THREE;window.__hold=null;if(e.st!=='rock')window.__toRock();
   if(e.rk){e.rk.stay=999;const P=H.P,pl=e.pos.clone().addScaledVector(e.n,16).addScaledVector(new T.Vector3().crossVectors(e.n,e.face).normalize(),10);window.__hold=pl;P.pos.copy(pl);window.__go(40);}
   const clr=w=>{let lo=-3,hi=6;for(let k=0;k<14;k++){const m=(lo+hi)/2;if(H.rockAt(w,m))hi=m;else lo=m;}return +hi.toFixed(2);};
   // true distance to the lumpy surface (closest of ~200 surface points around the radial direction), not just along the radius
   const R=e.rk?e.rk.R:H.ROCKS[4],surfR=d=>{let lo=0,hi=R.rmax+3;for(let k=0;k<16;k++){const m=(lo+hi)/2;if(H.rockAt(R.c.clone().addScaledVector(d,m),0)===R)lo=m;else hi=m;}return hi;};
   const near=C=>{const d=C.clone().sub(R.c).normalize(),u=new T.Vector3().crossVectors(d,Math.abs(d.y)<0.9?new T.Vector3(0,1,0):new T.Vector3(1,0,0)).normalize(),v=new T.Vector3().crossVectors(d,u);
     let best=1e9;for(let a=-0.7;a<=0.71;a+=0.1)for(let b=-0.7;b<=0.71;b+=0.1){const dd=d.clone().addScaledVector(u,a).addScaledVector(v,b).normalize();best=Math.min(best,C.distanceTo(R.c.clone().addScaledVector(dd,surfR(dd))));}
     return +(H.rockAt(C,0)===R?-best:best).toFixed(2);};
   const toes=Object.keys(e.B.bones).filter(k=>/^toe\d_03[LR]$/.test(k)).map(k=>near(e.B.bones[k].getWorldPosition(new T.Vector3())));
   const root=clr(e.pos);window.__hold=null;
   return {st:e.st,clip:e.B.curName,onRock:!!e.rk,rootClearanceM:root,toeTipClearanceM:toes};});
 console.log('on the rock',JSON.stringify(stand));
 check('rock: stands on it idle, root on the surface, toe tips over the stone (none sunk > 5 cm, the lowest within 35 cm, none above 65 cm: the rock is lumpy and the legs have a limited reach)',stand.st==='rock'&&stand.clip==='Idle'&&Math.abs(stand.rootClearanceM)<0.05&&stand.toeTipClearanceM.length>0&&stand.toeTipClearanceM.every(c=>c>-0.05&&c<0.65)&&Math.min(...stand.toeTipClearanceM)<0.35,stand);
 // 6) easier to kill: body shots from the front at ~6.7 shots/s (one every 3 frames), as a player would
 await p.evaluate(()=>{const e=__inc;window.__hold=null;e.rk=null;e.rockStops=0;e.lastRock=null;window.__hide();const hp=__hullParam(e.pos);const [q,n]=__hullPoint(2,1.57);e.pos.copy(q);e.n.copy(n);e.z=2;e.th=1.57;e.sa=0;e.sl=0;e.st='stalk';});
 const kill=await p.evaluate(()=>{const e=__inc,P=__heads.P;e.st='stalk';e.cds.guard=0;let shots=0,frames=0;const o=e.pos.clone().addScaledVector(e.n,1.2).addScaledVector(e.face,8);
   while(e.st!=='dead'&&shots<400){P.pos.copy(o);P.vel.set(0,0,0);__keep();if(frames%3===0){const c=e.pos.clone().addScaledVector(e.n,1.5);__heads.incDamage(e,1,'body',e.face.clone().negate(),c);shots++;}__step(1);frames++;}
   return {shots,seconds:+(frames*0.05).toFixed(1),maxHp:e.maxHp};});
 console.log('body shots to kill',JSON.stringify(kill));
 // 7) death on a rock: a new one lands on rock 4, dies there (Death_Collapse, attached to the drifting rock), then it is removed as usual
 await step(5);
 await p.evaluate(()=>{window.__noSpawn=1;window.__inc=__heads.spawnInc(false);window.__inc.cds.leap=999;window.__hold=null;}); // no hull-to-hull leap while it settles
 await p.evaluate(()=>{window.__go(300,()=>__inc.st==='stalk');});
 const dead=await p.evaluate(()=>{const H=__heads,P=H.P,e=__inc,R=H.ROCKS[4];if(e.st!=='stalk')return {ready:false,st:e.st};window.__hide();const [q,n]=window.__put(4,4,1.57,12);__step(2);
   e.pos.copy(q);e.n.copy(n);e.z=4;e.th=1.57;e.face.set(1,0,0).addScaledVector(n,-n.x).normalize();e.roam=null;e.rk=null;e.rockStops=0;e.lastRock=null;e.cds.leap=0;e.cds.melee=0;e.cds.beam=99;
   const dir=R.c.clone().sub(q).normalize(),far=R.c.clone().addScaledVector(dir,R.rmax+14);window.__hold=far;P.pos.copy(far);P.vel.set(0,0,0);P.inv=0;
   e.st='swimStart';e.t=0;e.sa=0;e.B.play('Swim_Start',0.2);window.__go(260,()=>e.st==='rock');if(e.st!=='rock')return {ready:true,landed:false,st:e.st};
   e.rk.stay=99;window.__go(10);const off0=e.pos.clone().sub(R.c);
   e.hp=1; // a power-up from the earlier kill may be active (damage fixed at 5): one point of life left is enough either way
   __heads.incDamage(e,9999,'body',e.face.clone().negate(),e.pos.clone().addScaledVector(e.n,1.5));
   const res={ready:true,landed:true,stAfterShot:e.st,clip:e.B.curName,deadFly:!!e.deadFly,airStateDuringDeath:false};let maxDrift=0,gone=-1;
   for(let i=0;i<120;i++){R.c.z-=0.06;R.mesh.position.copy(R.c);window.__go(1);if(e.st==='dead')maxDrift=Math.max(maxDrift,e.pos.clone().sub(R.c).distanceTo(off0));if(e.st==='gone'){gone=i;break;}}
   res.clipsDuringDeath=e.B.curName;res.glueDriftCm=+(maxDrift*100).toFixed(2);res.removedAfterS=gone<0?null:+((gone+1)*0.05).toFixed(2);res.stillListed=__heads.INCS.includes(e);return res;});
 console.log('death on a rock',JSON.stringify(dead));
 check('rock: dies on it (Death_Collapse / Death_Shot, not flying), stays glued, then is removed',dead.landed&&/^Death_/.test(dead.clip)&&!dead.deadFly&&dead.glueDriftCm<5&&dead.removedAfterS>2.5&&dead.removedAfterS<4.2&&!dead.stillListed,dead);

 // 8) pictures, each group on a fresh page (world up is up in the swim pictures; on the rock the camera's up is the rock normal under the creature, so the rock is the ground).
 await p.close();
 const group=async(name,fn)=>{let pg=null;try{pg=await boot();await pg.evaluate(()=>{window.__noSpawn=1;for(const s of [...__heads.spiders])__heads.killSpider(s);if(!window.__cineHud){const st=document.createElement('style');st.textContent='body.cine *{transition:none!important}';document.head.appendChild(st);window.__cineHud=1;}if(name!=='entrance')document.body.classList.add('cine');});await fn(pg);}catch(err){console.log('pictures',name,'stopped:',err.message.split('\n')[0]);}try{if(pg)await pg.close();}catch(e){}};
 const snapOn=async(pg,name)=>{try{await pg.evaluate(()=>{window.__manual=1;return new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));}); // no game frame may come after ours
   await pg.evaluate(()=>{__render();return new Promise(r=>requestAnimationFrame(r));});await pg.screenshot({path:shot(name),timeout:150000});await pg.evaluate(()=>{window.__manual=0;});console.log('picture',name);return true;}catch(err){console.log('picture',name,'failed:',err.message.split('\n')[0]);throw err;}};
 const ready=async pg=>{await pg.evaluate(()=>{window.__inc=__heads.spawnInc(false);});await pg.evaluate(HELPERS);await pg.evaluate(()=>window.__go(260,()=>__inc.st==='stalk'));};
 await group('entrance',async pg=>{await pg.evaluate(()=>{window.__inc=__heads.spawnInc(true);});
   for(const [t,name] of [[0.9,'a_cae'],[1.4,'b_golpe'],[1.6,'c_zoom'],[1.6,'d_cara']]){await pg.evaluate(n=>__step(n),Math.round(t/0.05));await snapOn(pg,'inc_cine_'+name+'.png');}});
 await group('swim',async pg=>{await ready(pg);
   const side=(d,up)=>pg.evaluate(([d,up])=>{const e=__inc,T=__THREE,c=e.st==='swim'||e.st==='swimBack'||e.st==='swimStart'?e.sc.clone():e.pos.clone().addScaledVector(e.n,1.5),x=new T.Vector3().crossVectors(e.n,e.face).normalize();
     window.__shotCam={pos:c.clone().addScaledVector(x,d).addScaledVector(e.n,up).toArray(),look:c.toArray()};return {st:e.st,clip:e.B.curName,frame:+(e.B.cur.time*24).toFixed(1),bodyElevationDeg:+(90-window.__ang(e.face,new T.Vector3(0,1,0))).toFixed(1)};},[d,up]);
   const until=(cond,max)=>pg.evaluate(([c,m])=>window.__go(m,new Function('i','const e=__inc;return ('+c+')')),[cond,max]);
   await pg.evaluate(()=>{window.__launch(8,26);window.__inv0=0;}); // you float far off to the side: it swims level
   console.log('shot swim: after',await until("e.st==='swim'&&e.sw.sm==='loop'&&e.sw.t>1.2&&e.B.cur.time*24>16",200),'frames',JSON.stringify(await side(10,0.6)));await snapOn(pg,'inc_v69_swim.png');
   console.log('shot slash: after',await until("e.st==='swim'&&e.sw.sm==='slash'&&e.B.cur.time*24>15",200),'frames',JSON.stringify(await side(11,0.6)));await snapOn(pg,'inc_v69_slash.png');
   await pg.evaluate(()=>{window.__hold=__inc.sc.clone().addScaledVector(__inc.face,-14);});
   console.log('shot turn: after',await until("e.st==='swim'&&e.sw.sm==='turn'&&e.B.cur.time*24>13",200),'frames',JSON.stringify(await side(10,0.6)));await snapOn(pg,'inc_v69_turn.png');
   await pg.evaluate(()=>{window.__hold=null;});await until("e.st==='swimBack'||e.st==='swimLand'",600);
   console.log('shot land hook: after',await until("e.st==='swimLand'&&e.sl&&e.B.cur.time*24>9",600),'frames',JSON.stringify(await side(12,1.5)));await snapOn(pg,'inc_v69_land.png');});
 await group('rock',async pg=>{await ready(pg);
   console.log('on the rock for the pictures',await pg.evaluate(()=>{const ok=window.__toRock(),e=__inc,P=__heads.P;if(ok){e.rk.stay=999;const pl=e.pos.clone().addScaledVector(e.n,16).addScaledVector(new __THREE.Vector3().crossVectors(e.n,e.face).normalize(),10);window.__hold=pl;P.pos.copy(pl);window.__go(40);}return ok;}));
   const cams=await pg.evaluate(()=>{const e=__inc,T=__THREE,H=__heads,side=new T.Vector3().crossVectors(e.n,e.face).normalize(),c=e.pos.clone().addScaledVector(e.n,1.5);
     const pick=angs=>{for(const a of angs){const r=a*Math.PI/180;for(const dist of [5.5,4.5,7,8.5]){const d=side.clone().multiplyScalar(Math.cos(r)).addScaledVector(e.face,Math.sin(r)),pos=c.clone().addScaledVector(d,dist).addScaledVector(e.n,-0.9);
       if(!H.rockAt(pos,1.4))return {pos:pos.toArray(),look:c.toArray(),up:e.n.toArray()};}}return null;};
     return {side:pick([0,180,20,-20,160,200,40,-40]),front:pick([90,70,110,50,130,270,250,290])};}); // lens positions outside every rock
   for(const k of ['side','front']){if(!cams[k]){console.log('no free lens position for',k);continue;}
     await pg.evaluate(c=>{window.__shotCam=c;__camera.up.fromArray(c.up);},cams[k]);await snapOn(pg,'inc_v69_rock_'+k+'.png');}});
 console.log('errors',JSON.stringify(errs.slice(0,5)));
 check('no page errors',errs.length===0,errs.slice(0,3));
 console.log(fails.length?'FAILED: '+fails.join(' | '):'all checks passed');
 if(fails.length)process.exitCode=1;
 await b.close();})();
