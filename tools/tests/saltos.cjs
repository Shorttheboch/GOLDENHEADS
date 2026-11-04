// Normal spiders' jumps (v83): a spider that pounces at the astronaut must never end up inside the ship (Santi saw them go into the body, mostly at the nose).
// The check is INDEPENDENT of the game's own collision (hullPoint / hullOff / pushOutOfShip / wingAt): like camera.cjs and spitter.cjs it reads the real triangles of
// the loaded ship (CT.near / CT.outside from camera.cjs' pageLib; rocks ignored) and measures the signed distance of the spider's SKINNED-MESH VERTICES
// (body, abdomen, fangs = "parts"; upper leg segments = "legs"; lower leg + claw = "feet") to them: negative = inside the ship.
// Only the normal spiders (hunter, flanker, lurker, brood); the Escupidora has its own test (spitter.cjs) and stays as it is.
// Parts:   cases   a spider is put on a hull spot (all round the hull: top, sides, belly, by the wings, tail, the nose up to its tip) with the astronaut hanging at a target
//                  (straight out, sideways, along the hull, the far side of the ship, in front of the nose, under the nose) and, in the 'dodge' targets, jumping to the other
//                  side of the ship the moment the spider launches (its pounce homes in on you: the curve can cut through the hull). The game decides itself when and
//                  whether to pounce (line of sight, crawling round first); every frame of the jump is measured: crouch, take-off, flight, the miss (drift), the silk
//                  thread back and the landing (0.5 s after it is back on the hull).
//          dyn     a seeded stretch of round 7 with spiders spawning as usual (they also come down from space on their silk) and the astronaut hopping round the ship
//                  (nose included) every 1.5 s; every jump frame of every spider is measured.
// "Jump frames" = windup (crouch), leap, drift, return (silk) and the first 0.5 s back on the hull after a jump. The nose = the spider (its root) at z > 17.
// Fails (exit 1) unless HEADS_BASE=1, if over all jump frames body/abdomen/fangs are >5 cm inside more than LIM.pct % of the time (also at the nose alone), or deeper
// than LIM.worst anywhere, or a case flies through the hull (segment of the root path crossing the real triangles), or the page throws.
// Run:  tools/run-test.sh dist-test tools/tests/saltos.cjs        (a few minutes; HEADS_ONLY=cases|dyn · HEADS_N=<spots step, default 1> · HEADS_SEC=<dyn seconds, 60>
//       HEADS_SEED=<n> · HEADS_TAG=<file tag> · HEADS_BASE=1 (measure only, never fail: for the code before v83) · HEADS_SHOTS=1 (also 6 screenshots of nose pounces: saltos_*.png)
//       HEADS_JF=0 (v83 build with its jump fix switched off, JUMP_FIX.on in 41-saltos.js: an A/B in the same build)
// Output: tools/tests/out/saltos_<tag>.json (every case, the worst frames)
const fs=require('fs'),path=require('path');
const {chromium}=require('playwright');
const {BASE,ARGS,shot}=require('./lib.cjs');
const ONLY=process.env.HEADS_ONLY||'',NSTEP=+(process.env.HEADS_N||1),SEC=+(process.env.HEADS_SEC||60),SEED=+(process.env.HEADS_SEED||5),TAG=process.env.HEADS_TAG||'new',ISBASE=!!process.env.HEADS_BASE,SHOTS=!!process.env.HEADS_SHOTS;
const LIM={pct:0.5,      // % of the jump frames with body/abdomen/fangs more than 5 cm inside (overall and at the nose). Before v83: 9.4 % (nose 11 %); v83: 0.05 % (nose 0.03 %)
  worst:-0.2,            // m: the deepest body/abdomen/fang vertex in any jump frame (v83: -0.16, one crouch frame by a wing root, where the hull map stops short of the fairing)
  through:0};            // cases whose spider root crosses the real hull between two frames
setTimeout(()=>{console.log('WATCHDOG: too slow, giving up');process.exit(2);},1700000);
// ---------------------------------------------------------------- runs in the page
function pageSJ(SEEDV){
  const T=__THREE,H=__heads,P=H.P,D={keep:new Set()};
  let rs=SEEDV*2654435761>>>0;const rnd=()=>{rs=(rs+0x6D2B79F5)>>>0;let t=Math.imul(rs^rs>>>15,1|rs);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
  D.seed=s=>{rs=s>>>0;Math.random=rnd;};
  D.hold=(spawn)=>{window.__noSpawn=spawn?0:1;__T.showcase=0;if(!spawn)__T.toSpawn=3;H.WB.bossT=1e9;H.WB.incT=0;H.WB.spitQ=[];H.WB.spit=true;
    for(const s of [...H.spiders])if(!spawn&&!D.keep.has(s)||s.kind==='spitter'||s.kind==='thief')H.killSpider(s,false,true);
    P.inv=1e9;P.hp=100;P.carry=0;};
  // skinned vertices of a spider, classed by their main bone
  D.items=s=>{const R=s.mesh.userData.rig;if(!R)return null;if(s._it)return s._it;const sms=[];R.inner.traverse(o=>{if(o.isSkinnedMesh)sms.push(o);});const out=[];
    for(const sm of sms){const g=sm.geometry,si=g.attributes.skinIndex,sw=g.attributes.skinWeight,names=sm.skeleton.bones.map(b=>b.name);
      for(let i=0;i<g.attributes.position.count;i+=3){let bi=-1,bw=-1;for(let k=0;k<4;k++){const w=sw.getComponent(i,k);if(w>bw){bw=w;bi=si.getComponent(i,k);}}
        const nm=names[bi]||'?',c=nm==='body'?0:nm==='abdomen'?1:/^fang/.test(nm)?2:/^leg_.*_[012]$/.test(nm)?3:/^leg_.*_[34]$/.test(nm)?4:5;
        if(c<5)out.push({sm,i,c});}}
    return s._it=out;};
  const v=new T.Vector3(),pv=new T.Vector3();
  // signed distance of a world point to the real ship (negative inside), capped at ±0.6 away from any triangle
  D.sd=(x,y,z)=>{const n=CT.near(x,y,z,0.6);if(n.d<9)return CT.outside(x,y,z)?n.d:-n.d;
    pv.set(x,y,z);const hp=__hullParam(pv),[q,nn]=__hullPoint(hp.z,hp.th);if((x-q.x)*nn.x+(y-q.y)*nn.y+(z-q.z)*nn.z>0.3)return 0.6;
    if(Math.abs(z)>23.5||Math.hypot(x,y)>12)return 0.6;
    return CT.outside(x,y,z)?0.6:-Math.max(0.6,CT.near(x,y,z,8).d);};
  // min signed distance per class (0 body, 1 abdomen, 2 fangs, 3 upper legs, 4 feet) and of the root
  D.measure=(s,stride)=>{const r0=s.mesh.position,sc=s.mesh.scale.x;
    if(CT.near(r0.x,r0.y,r0.z,2.4*sc).d>=9&&(Math.abs(r0.z)>23.5||Math.hypot(r0.x,r0.y)>12||CT.outside(r0.x,r0.y,r0.z)))return {m:[0.6,0.6,0.6,0.6,0.6],root:0.6,wp:null}; // nothing of the spider can reach a triangle
    s.mesh.updateMatrixWorld(true);const m=[9,9,9,9,9],its=D.items(s);let wp=null,wd=9;
    for(let k=0;k<its.length;k+=stride){const it=its[k];it.sm.getVertexPosition(it.i,v);v.applyMatrix4(it.sm.matrixWorld);
      // cheap skip: far from the ship's box
      if(Math.abs(v.x)>12.2||v.y>4.6||v.y<-4.6||v.z>24.1||v.z<-24.1){continue;}
      const d=D.sd(v.x,v.y,v.z);if(d<m[it.c])m[it.c]=d;if(it.c<3&&d<wd){wd=d;wp=[v.x,v.y,v.z];}}
    const r=s.mesh.position;const root=(Math.abs(r.x)>12.2||Math.abs(r.y)>4.6||Math.abs(r.z)>24.1)?0.6:D.sd(r.x,r.y,r.z);
    return {m,root,wp};};
  const phaseOf=(s)=>{const st=s.state;if(st==='windup')return s.idleT>0?null:'windup';if(st==='leap')return s.t<0.3?'takeoff':'flight';if(st==='drift')return 'drift';if(st==='return')return 'silk';
    if((st==='crawl'||st==='rock'||st==='eat')&&s._landT!=null&&s._landT<0.5)return 'land';return null;};
  const JUMPY=new Set(['leap','drift','return']);
  // per-frame bookkeeping of one spider; returns the frame sample when it is a jump frame
  D.track=(s,dt,stride)=>{const st=s.state;if(s._ps!==st){if(JUMPY.has(s._ps)&&!JUMPY.has(st))s._landT=0;if(s._ps==='windup'&&st==='crawl')D.aborts=(D.aborts||0)+1;if(st==='leap'&&s._ps!=='leap'){s._launch={z:s.z,th:s.th,p:s.pos.toArray(),pl:P.pos.toArray()};s._leaps=(s._leaps||0)+1;}s._ps=st;}
    else if(s._landT!=null)s._landT+=dt;
    const ph=phaseOf(s);if(!ph)return null;const mm=D.measure(s,stride);const parts=Math.min(mm.m[0],mm.m[1],mm.m[2]);
    // the root path crossing the real hull between two frames (a pass THROUGH the ship, whatever the vertices say)
    let thru=0;const r=s.mesh.position;if(s._rp&&JUMPY.has(st)){const a=s._rp;const L=Math.hypot(r.x-a[0],r.y-a[1],r.z-a[2]);if(L>1e-4&&L<4&&CT.segHit(a[0],a[1],a[2],r.x,r.y,r.z,0,true)>=0&&CT.outside(a[0],a[1],a[2]))thru=1;}
    s._rp=[r.x,r.y,r.z];
    return {ph,parts,legs:mm.m[3],feet:mm.m[4],root:mm.root,thru,z:+s.pos.z.toFixed(2),nose:s.pos.z>17?1:0,kind:s.kind,wp:mm.wp?mm.wp.map(x=>+x.toFixed(2)):null};};
  // one case: a spider on a hull spot, the astronaut at a target; up to `secs` of game time, ended 0.6 s after it is back on the hull from its first jump
  D.target=(z,th,tg)=>{const [q,n]=__hullPoint(z,th),t1=new T.Vector3(-Math.sin(th),Math.cos(th),0).addScaledVector(n,-0).normalize(),o=new T.Vector3();
    if(tg==='out')o.copy(q).addScaledVector(n,7).addScaledVector(t1,1.5);
    else if(tg==='side')o.copy(q).addScaledVector(n,3.5).addScaledVector(t1,10);
    else if(tg==='along'){const z2=z>4?z-12:z+12;const [q2,n2]=__hullPoint(z2,th);o.copy(q2).addScaledVector(n2,3);}
    else if(tg==='far'){const [q2,n2]=__hullPoint(z,th+Math.PI);o.copy(q2).addScaledVector(n2,4);}
    else if(tg==='nose')o.set((rnd()-0.5)*4,-1.2+(rnd()-0.5)*3,26.5+rnd()*3);
    else if(tg==='under')o.set((rnd()-0.5)*3,-5.5,Math.min(21,z+1.5));
    else if(tg==='dodge'||tg==='dodgeNose')o.copy(q).addScaledVector(n,6).addScaledVector(t1,2);
    return o;};
  D.runCase=(c)=>{D.seed(c.seed);D.keep.clear();D.hold(false);const s=H.spawnSpider(c.kind);D.keep.add(s);
    s.z=c.z;s.th=c.th;const [q,n]=__hullPoint(c.z,c.th);s.pos.copy(q);s.state='crawl';s.t=0;s.cd=0.2;s.aggro=3;s.patch=null;s.idleT=0;s.silk=null;s.vel.set(0,0,0);s.mesh.position.copy(q);
    const tgt=D.target(c.z,c.th,c.tg);P.pos.copy(tgt);P.vel.set(0,0,0);let dodged=false;
    const res={...c,frames:0,bad:0,nose:0,noseBad:0,worst:9,worstPh:'',worstWp:null,worstZ:0,legsWorst:9,feetWorst:9,thru:0,leaps:0,launch:null,phases:{},phBad:{},end:'',tr:[]};
    const dt=1/60;let after=-1;
    for(let f=0;f<c.secs*60;f++){D.hold(false);if(!H.spiders.includes(s)){res.end='gone';break;}
      if(!dodged&&s.state==='leap'&&(c.tg==='dodge'||c.tg==='dodgeNose')&&s.t>0.08){dodged=true; // the astronaut dashes round to the other side of the ship (or under the nose)
        if(c.tg==='dodge'){const [q2,n2]=__hullPoint(c.z+(rnd()-0.5)*3,c.th+Math.PI*(0.75+rnd()*0.5));P.pos.copy(q2).addScaledVector(n2,3.5);}
        else P.pos.set((rnd()-0.5)*2,-3.8,Math.min(22,c.z+3));}
      P.vel.set(0,0,0);__step(1,dt);D.hold(false);if(!H.spiders.includes(s)){res.end='gone';break;}
      s.hp=99;const o=D.track(s,dt,3);
      if(c.trace)res.tr.push({f,st:s.state,t:+s.t.toFixed(2),z:+s.z.toFixed(2),th:+s.th.toFixed(2),pos:s.pos.toArray().map(x=>+x.toFixed(2)),mp:s.mesh.position.toArray().map(x=>+x.toFixed(2)),
        up:new T.Vector3(0,1,0).applyQuaternion(s.mesh.quaternion).toArray().map(x=>+x.toFixed(2)),fw:new T.Vector3(0,0,1).applyQuaternion(s.mesh.quaternion).toArray().map(x=>+x.toFixed(2)),
        lift:+((s.mesh.userData.rig&&s.mesh.userData.rig.jlift)||0).toFixed(3),jl:+(s.jl||0).toFixed(2),ph:o?o.ph:'',parts:o?+o.parts.toFixed(3):null,wp:o?o.wp:null,P:P.pos.toArray().map(x=>+x.toFixed(1))});
      if(o){res.frames++;res.phases[o.ph]=(res.phases[o.ph]||0)+1;if(o.parts<-0.05){res.bad++;res.phBad[o.ph]=(res.phBad[o.ph]||0)+1;}if(o.nose){res.nose++;if(o.parts<-0.05)res.noseBad++;}if(o.thru)res.thru++;
        if(o.parts<res.worst){res.worst=o.parts;res.worstPh=o.ph;res.worstWp=o.wp;res.worstZ=o.z;}if(o.legs<res.legsWorst)res.legsWorst=o.legs;if(o.feet<res.feetWorst)res.feetWorst=o.feet;}
      if(s._launch&&!res.launch){res.launch={z:+s._launch.z.toFixed(2),th:+s._launch.th.toFixed(2),p:s._launch.p.map(x=>+x.toFixed(2)),pl:s._launch.pl.map(x=>+x.toFixed(2))};
        const a=s._launch.p,b=s._launch.pl;const hit=CT.segHit(a[0],a[1],a[2],b[0],b[1],b[2],0.3,true);res.launch.losHit=hit>=0?+hit.toFixed(2):-1;}
      if(s._leaps&&s._landT!=null&&s._landT>0.6){res.end='landed';break;}}
    res.leaps=s._leaps||0;if(!res.end)res.end=res.leaps?'timeout':'noleap';res.state=s.state;
    for(const k of ['worst','legsWorst','feetWorst'])res[k]=+res[k].toFixed(3);
    D.keep.clear();for(const o of [...H.spiders])H.killSpider(o,false,true);return res;};
  // dynamic: round 7, spawning on, the astronaut hops round the ship
  D.dynStart=()=>{D.aborts=0;D.seed(SEEDV*7+1);D.keep.clear();for(const o of [...H.spiders])H.killSpider(o,false,true);__T.startWave(6);D.dyn={f:0,next:0,acc:{frames:0,bad:0,nose:0,noseBad:0,worst:9,worstPh:'',worstZ:0,worstWp:null,thru:0,legsWorst:9,leaps:0,phases:{},phBad:{},byKind:{}}};return true;};
  D.dynRun=(n)=>{const A=D.dyn.acc,dt=1/60;
    for(let i=0;i<n;i++){D.dyn.f++;
      if(D.dyn.f>=D.dyn.next){D.dyn.next=D.dyn.f+90;const z=-13+rnd()*35,th=rnd()*Math.PI*2,[q,nn]=__hullPoint(Math.min(21.5,z),th);P.pos.copy(q).addScaledVector(nn,2.5+rnd()*7);if(z>21.5)P.pos.z+=rnd()*5;}
      P.vel.set(0,0,0);D.hold(true);__T.toSpawn=Math.max(__T.toSpawn,4);__step(1,dt);D.hold(true);
      for(const s of H.spiders){if(s.kind==='spitter')continue;const o=D.track(s,dt,4);if(!o)continue;A.frames++;A.phases[o.ph]=(A.phases[o.ph]||0)+1;
        const K=A.byKind[o.kind]=A.byKind[o.kind]||{frames:0,bad:0};K.frames++;
        if(o.parts<-0.05){A.bad++;K.bad++;A.phBad[o.ph]=(A.phBad[o.ph]||0)+1;}if(o.nose){A.nose++;if(o.parts<-0.05)A.noseBad++;}if(o.thru)A.thru++;
        if(o.parts<A.worst){A.worst=o.parts;A.worstPh=o.ph;A.worstZ=o.z;A.worstWp=o.wp;}if(o.legs<A.legsWorst)A.legsWorst=o.legs;}
      for(const s of H.spiders)if(s.state==='leap'&&s._ps==='leap'&&s.t<dt*1.5)A.leaps++;}
    return {f:D.dyn.f,sp:H.spiders.length,wave:__T.wave};};
  // a screenshot of a pounce from the nose, seen from the side (HEADS_SHOTS)
  D.shotCase=(c,frac)=>{D.seed(c.seed);D.keep.clear();D.hold(false);const s=H.spawnSpider(c.kind);D.keep.add(s);
    s.z=c.z;s.th=c.th;const [q]=__hullPoint(c.z,c.th);s.pos.copy(q);s.state='crawl';s.t=0;s.cd=0.2;s.aggro=3;s.patch=null;s.idleT=0;s.mesh.position.copy(q);
    P.pos.copy(D.target(c.z,c.th,c.tg));P.vel.set(0,0,0);let n=0,best=null;
    for(let f=0;f<c.secs*60;f++){D.hold(false);P.vel.set(0,0,0);__step(1,1/60);s.hp=99;if(s.state==='leap'||s.state==='drift'||s.state==='return'){n++;if(n>=frac){best=s.mesh.position.clone();break;}}}
    if(!best)best=s.mesh.position.clone();const cam=best.clone().add(new T.Vector3(7.5,1.8,-1.5));window.__shotCam={pos:cam.toArray(),look:best.toArray()};
    window.__noRender=0;__render();window.__noRender=1;return {st:s.state,p:best.toArray().map(x=>+x.toFixed(2))};};
  window.SJ=D;return true;
}
// ---------------------------------------------------------------- Node side
(async()=>{
  const fsrc=fs.readFileSync(path.join(__dirname,'camera.cjs'),'utf8');
  const i0=fsrc.indexOf('function pageLib(SEEDV){'),i1=fsrc.indexOf('// ---------------------------------------------------------------- Node side');
  if(i0<0||i1<0)throw new Error('saltos: pageLib not found in camera.cjs');
  const rk='const rockLive=k=>RK[k].R.mesh.visible&&RK[k].R.fade>0.5;';let libSrc=fsrc.slice(i0,i1);
  if(!libSrc.includes(rk))throw new Error('saltos: rockLive anchor not found in camera.cjs');libSrc=libSrc.replace(rk,'const rockLive=k=>false;');
  const errs=[];const t0=Date.now();
  const b=await chromium.launch({args:ARGS});
  const p=await (await b.newContext({viewport:{width:960,height:540}})).newPage();
  p.on('pageerror',e=>{errs.push(e.message);console.log('PAGEERROR',e.message);});
  p.on('crash',()=>{console.log('PAGE CRASHED (out of memory?) — run it again');process.exit(3);});
  await p.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  await p.addInitScript(()=>{window.__noTip=0;window.__noTut=1;});
  await p.goto(BASE+'/test.html?q=5');
  await p.waitForFunction(()=>document.getElementById('play')&&!document.getElementById('play').disabled,null,{timeout:300000});
  await p.evaluate(()=>document.getElementById('play').click());
  await p.evaluate(()=>document.fonts.ready);
  await p.evaluate(()=>{window.__manual=1;window.__CFG.worldV=0;});await p.waitForTimeout(2500);
  await p.evaluate(()=>{window.__noRender=1;__step(10);});
  console.log('page lib',JSON.stringify(await p.evaluate('('+libSrc+')(7)')));
  await p.evaluate('('+pageSJ.toString()+')('+SEED+')');
  console.log('prime',JSON.stringify(await p.evaluate(()=>CT.prime())));
  await p.evaluate(()=>__T.startWave(6));
  if(process.env.HEADS_JF!==undefined){const on=+process.env.HEADS_JF;const ok2=await p.evaluate(on=>{if(!__heads.JUMP_FIX)return false;__heads.JUMP_FIX.on=on;return true;},on);console.log('JUMP_FIX.on =',on,ok2?'':'(no JUMP_FIX in this build)');}
  const res={cases:[],dyn:null},fails=[];const line=(...a)=>console.log(...a);
  const pc=(a,b)=>b?(100*a/b).toFixed(2):'0.00';
  // ---------------------------------------------------------------- cases
  const sum=(rows)=>{const o={cases:rows.length,leapt:0,frames:0,bad:0,nose:0,noseBad:0,worst:9,noseWorst:9,thru:0,thruCases:0,legsWorst:9};
    for(const r of rows){if(r.leaps)o.leapt++;o.frames+=r.frames;o.bad+=r.bad;o.nose+=r.nose;o.noseBad+=r.noseBad;o.thru+=r.thru;if(r.thru)o.thruCases++;if(r.worst<o.worst)o.worst=r.worst;if(r.z>17&&r.worst<o.noseWorst)o.noseWorst=r.worst;if(r.legsWorst<o.legsWorst)o.legsWorst=r.legsWorst;}return o;};
  if(!ONLY||ONLY==='cases'){
    const ZS=[-12,-7,-2,3,8,12,15,17,18.5,19.5,20.5,21.2,21.5],NTH=10,KINDS=['hunter','lurker','flanker','hunter','brood'];
    const TGS=['out','side','along','far','dodge'],NOSE_TGS=['nose','under','dodgeNose','out','far','side'];
    const spots=[];for(const z of ZS)for(let k=0;k<NTH;k++){const th=+(k/NTH*Math.PI*2+0.17).toFixed(3);spots.push([z,th]);}
    const free=await p.evaluate(sp=>sp.map(([z,th])=>!__heads.hullBlocked(z,th,1)),spots);
    const cases=[];let ci=0;
    spots.forEach(([z,th],i)=>{if(!free[i]||i%NSTEP)return;const tgs=z>=17?NOSE_TGS:TGS;
      for(let j=0;j<(z>=17?4:2);j++){const tg=tgs[(i+j*3)%tgs.length];cases.push({z,th,tg,kind:KINDS[ci%KINDS.length],seed:1000+ci,secs:6});ci++;}});
    line(`cases: ${cases.length} (${spots.filter((_,i)=>free[i]).length} walkable spots of ${spots.length})`);
    const ONLYC=process.env.HEADS_CASES?new Set(process.env.HEADS_CASES.split(',').map(Number)):null; // HEADS_CASES=215,25: only those cases (index in the full list), each traced frame by frame
    for(let ci=0;ci<cases.length;ci++){const c=cases[ci];if(ONLYC&&!ONLYC.has(ci))continue;if(ONLYC)c.trace=1;const r=await p.evaluate(c=>SJ.runCase(c),c);res.cases.push(r);
      if(ONLYC){line(`--- case ${ci}`,JSON.stringify({z:c.z,th:c.th,tg:c.tg,kind:c.kind,worst:r.worst,ph:r.worstPh}));for(const q of r.tr)line(JSON.stringify(q));}}
    const all=sum(res.cases),nose=sum(res.cases.filter(r=>r.z>=17));
    const tab=(name,o)=>line(`${name.padEnd(9)} cases ${String(o.cases).padStart(4)} jumped ${String(o.leapt).padStart(4)} | jump frames ${String(o.frames).padStart(6)} | parts <-5cm ${pc(o.bad,o.frames).padStart(6)}% worst ${o.worst.toFixed(3)} | nose frames ${o.nose} parts <-5cm ${pc(o.noseBad,o.nose)}% | through the hull: ${o.thru} frames in ${o.thruCases} cases | upper legs worst ${o.legsWorst.toFixed(3)}`);
    tab('ALL',all);tab('nose z>=17',nose);
    for(const tg of [...new Set(cases.map(c=>c.tg))])tab('  '+tg,sum(res.cases.filter(r=>r.tg===tg)));
    for(const k of [...new Set(cases.map(c=>c.kind))])tab('  '+k,sum(res.cases.filter(r=>r.kind===k)));
    // by phase (frames of all cases)
    {const ph={},pb={};for(const r of res.cases){for(const [k,n] of Object.entries(r.phases))ph[k]=(ph[k]||0)+n;for(const [k,n] of Object.entries(r.phBad||{}))pb[k]=(pb[k]||0)+n;}
     line('  by phase (jump frames, % with parts >5 cm inside):',Object.keys(ph).map(k=>`${k} ${ph[k]} ${pc(pb[k]||0,ph[k])}%`).join(' | '));
     const nc=res.cases.filter(r=>r.z>=17),phn={},pbn={};for(const r of nc){for(const [k,n] of Object.entries(r.phases))phn[k]=(phn[k]||0)+n;for(const [k,n] of Object.entries(r.phBad||{}))pbn[k]=(pbn[k]||0)+n;}
     line('  by phase, cases from the nose:',Object.keys(phn).map(k=>`${k} ${phn[k]} ${pc(pbn[k]||0,phn[k])}%`).join(' | '));}
    const worst=[...res.cases].sort((a,b)=>a.worst-b.worst).slice(0,12);
    line('  worst cases:');for(const r of worst)line(`    ${r.worst.toFixed(3)} ${r.worstPh.padEnd(7)} at z ${r.worstZ} | from z ${r.z} th ${r.th} ${r.kind} -> ${r.tg} | launch ${r.launch?`z ${r.launch.z} los-hit ${r.launch.losHit}`:'-'} | bad ${r.bad}/${r.frames} thru ${r.thru} end ${r.end} | vertex ${JSON.stringify(r.worstWp)}`);
    res.sumCases={all,nose};
    if(all.leapt<cases.length*0.5)fails.push(`only ${all.leapt} of ${cases.length} cases pounced (the scenario changed?)`);
    if(+pc(all.bad,all.frames)>LIM.pct)fails.push(`${pc(all.bad,all.frames)}% of the jump frames have body/abdomen/fangs >5 cm inside the ship (limit ${LIM.pct}%)`);
    if(+pc(nose.noseBad,nose.nose)>LIM.pct)fails.push(`at the nose ${pc(nose.noseBad,nose.nose)}% of the jump frames have body/abdomen/fangs >5 cm inside (limit ${LIM.pct}%)`);
    if(all.worst<LIM.worst)fails.push(`body/abdomen/fangs as deep as ${all.worst.toFixed(3)} m in a jump (limit ${LIM.worst})`);
    if(all.thruCases>LIM.through)fails.push(`${all.thruCases} cases fly THROUGH the hull (root path crosses the real triangles)`);
  }
  // ---------------------------------------------------------------- dynamic
  if(!ONLY||ONLY==='dyn'){
    await p.evaluate(()=>SJ.dynStart());const nF=Math.round(SEC*60);let st=null;
    for(let f=0;f<nF;f+=120)st=await p.evaluate(n=>SJ.dynRun(n),Math.min(120,nF-f));
    const A=await p.evaluate(()=>SJ.dyn.acc);res.dyn=A;
    A.aborts=await p.evaluate(()=>SJ.aborts||0);
    line(`dynamic  ${SEC} s of round ${st.wave+1}: ${A.leaps} pounces (${A.aborts} crouches given up: you went behind the ship), ${A.frames} jump frames ${JSON.stringify(A.phases)} | parts <-5cm ${pc(A.bad,A.frames)}% worst ${A.worst.toFixed(3)} (${A.worstPh} z ${A.worstZ}) | nose frames ${A.nose} parts <-5cm ${pc(A.noseBad,A.nose)}% | through the hull ${A.thru} | upper legs worst ${A.legsWorst.toFixed(3)} | by kind ${JSON.stringify(A.byKind)}`);
    line('  by phase:',Object.keys(A.phases).map(k=>`${k} ${A.phases[k]} ${pc(A.phBad[k]||0,A.phases[k])}%`).join(' | '));
    if(A.leaps<5)fails.push(`dynamic: only ${A.leaps} pounces (the scenario changed?)`);
    if(+pc(A.bad,A.frames)>LIM.pct)fails.push(`dynamic: ${pc(A.bad,A.frames)}% of the jump frames have body/abdomen/fangs >5 cm inside (limit ${LIM.pct}%)`);
    if(A.worst<LIM.worst)fails.push(`dynamic: body/abdomen/fangs as deep as ${A.worst.toFixed(3)} m (limit ${LIM.worst})`);
    if(A.thru>LIM.through)fails.push(`dynamic: ${A.thru} frames of a spider passing through the hull`);
  }
  if(SHOTS){
    const SC=[{z:20.5,th:1.74,tg:'nose',kind:'hunter'},{z:21.2,th:4.57,tg:'under',kind:'lurker'},{z:19.5,th:3.31,tg:'nose',kind:'lurker'},{z:18.5,th:0.17,tg:'far',kind:'hunter'},{z:21.5,th:2.37,tg:'dodgeNose',kind:'hunter'},{z:15,th:1.74,tg:'far',kind:'lurker'}];
    await p.evaluate(()=>{window.__noRender=0;});
    for(let i=0;i<SC.length;i++){const c={...SC[i],seed:77+i,secs:6};const r=await p.evaluate(c=>SJ.shotCase(c,14),c);await p.screenshot({path:shot(`saltos_${i}_${c.tg}_${TAG}.png`)});line('shot',i,JSON.stringify(c),JSON.stringify(r));}
  }
  if(errs.length)fails.push('page errors: '+errs.slice(0,3).join(' | '));
  fs.mkdirSync(path.dirname(shot('x')),{recursive:true});fs.writeFileSync(shot(`saltos_${TAG}.json`),JSON.stringify(res));
  console.log(`done in ${((Date.now()-t0)/1000).toFixed(0)} s`);
  await b.close();
  if(fails.length&&!ISBASE){console.log('FAIL');for(const f of fails)console.log(' -',f);process.exit(1);}
  if(fails.length){console.log('(HEADS_BASE: would fail)\n - '+fails.join('\n - '));process.exit(0);}
  console.log('OK: the spiders jump without going into the ship');process.exit(0); // (the watchdog timer would keep node alive)
})();
