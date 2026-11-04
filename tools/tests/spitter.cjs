// Spitter (Escupidora, v78): the crab must stay out of the ship's hull.
// The check is INDEPENDENT of the game's own collision (hullPoint / hullOff / wingAt / the safety net in 37-escupidora-casco.js): it reads the real triangles of
// the loaded ship.glb (the same grid as camera.cjs: CT.near / CT.outside from its pageLib) and measures the signed distance of the crab's SKINNED-MESH VERTICES
// (body, abdomen, fangs = "parts"; upper leg segments = "legs"; lower leg + claw = "feet") to them: negative = inside the ship. Rocks are ignored.
// Parts:   static   the crab stands (crawl pose) at a grid of hull spots the game lets it reach (margin of the map = __spPad), both facings (along the ship / round it),
//                   at the three scales 1.75 (1st Escupidora) / 2.05 / 2.7 (biggest); plus the pounce crouch (windup), the eating pose and the threat pose at fewer spots;
//          leaps    forced pounces from spots all round the hull (top, both sides, belly, nose, tail), measured every frame while it launches and flies off;
//          dynamic  one run per scale with a fixed seed: it falls onto the hull, holds its threat pose, crawls, crouches, pounces, drifts, comes back on its silk thread
//                   (a "bait" astronaut is teleported near / mid / far so every state happens), measured every 4th frame.
// Fails (exit 1) if, over the tables below: crab parts go >LIM.partsPct of the time / spots more than 5 cm inside, anything goes deeper than LIM.partsWorst,
// the leap launches go deeper than LIM.leapWorst, feet or legs sink, or the lowest-hanging foot floats too far (median over spots), or the page throws.
// Run:  tools/run-test.sh dist-test tools/tests/spitter.cjs        (≈10 min on the software GPU with the machine to yourself; with a loaded machine it can pass the 900 s of
//       run-test.sh or lose the page to the memory limit (exit 3): run it by phases, HEADS_ONLY=static, HEADS_ONLY=leap and HEADS_ONLY=dyn, each in its own run)
//   HEADS_SC=1.75,2.05,2.7 · HEADS_SEC=<dynamic seconds per scale, default 14> · HEADS_ONLY=static|leap|dyn · HEADS_SEED=<n> · HEADS_TAG=<file tag>
//   HEADS_POSES=crawl,windup,eat,idle (static poses to measure) · HEADS_CF='{"hLo":0}' (try other CRAB_FIX values: a dev knob, the checked-in numbers are what the limits are set for)
// Output: tools/tests/out/spitter_<tag>.json (every sample)
const fs=require('fs'),path=require('path');
const {chromium}=require('playwright');
const {BASE,ARGS,shot,lateReady}=require('./lib.cjs');
const SCALES=(process.env.HEADS_SC||'1.75,2.05,2.7').split(',').map(Number),SEC=+(process.env.HEADS_SEC||14),ONLY=process.env.HEADS_ONLY||'',SEED=+(process.env.HEADS_SEED||3),TAG=process.env.HEADS_TAG||'new',POSES=(process.env.HEADS_POSES||'crawl,windup,eat,idle').split(',');
const GEN={1.75:1,2.05:3,2.7:8}; // the spitter of that scale (the formula in spawnSpitter)
// limits (see the numbers of v78 in CLAUDE.md; the version before v78 breaks all of them by a wide margin)
const LIM={
  partsPct:3,      // % of the spots / of the time with body, abdomen or fangs more than 5 cm inside
  partsWorst:-0.15,// m: the deepest any of them goes in any spot / frame, except the leap launches
  leapWorst:-0.10, // m: deepest of body/abdomen/fangs in the first 0.75 s of a pounce
  legsPct:4,       // % of the spots with an upper leg more than 5 cm inside
  feetPct:6,       // % of the spots with a foot more than 5 cm inside (crawl, windup, threat pose)
  eatFeetPct:16,   // the same while eating: the front legs rake 2.8·scale m ahead of the body and reach the pylons that the walkable map keeps away from the body only (v78: 14% at 2.05)
  feetWorst:-0.35, // m: deepest foot in any of those spots (v78: -0.29, a crawl spot beside a pylon; before v78: -1.3)
  floatMed:0.25,   // m: median over spots of the gap of the HIGHEST-hanging of the 8 feet (its lowest vertex) to the hull in the crawl pose: legs that cannot reach a curved flank hang up to 0.5 m
                   // (v78: 0.11 / 0.14 / 0.21 at 1.75 / 2.05 / 2.7 on this grid; before v78 about 0.0, but with the body and feet 5-130 cm inside). It only guards against the whole crab floating off the hull.
};
// ---------------------------------------------------------------- runs in the page
function pageSP(SEEDV,GENS){
  const T=__THREE,H=__heads,P=H.P,D={};
  D.hold=()=>{window.__noSpawn=1;__T.showcase=0;__T.toSpawn=3;H.WB.bossT=1e9;H.WB.incT=0;H.WB.spitQ=[];for(const s of [...H.spiders])if(s.kind!=='spitter')H.killSpider(s);P.inv=1e9;P.hp=100;};
  D.step=(n,dt)=>{for(let i=0;i<n;i++){D.hold();__step(1,dt);D.hold();}};
  D.sp=()=>H.spiders.find(s=>s.kind==='spitter');
  D.init=s=>{const R=s.mesh.userData.rig;const sms=[];R.inner.traverse(o=>{if(o.isSkinnedMesh)sms.push(o);});D.items=[];
    for(const sm of sms){const g=sm.geometry,si=g.attributes.skinIndex,sw=g.attributes.skinWeight,names=sm.skeleton.bones.map(b=>b.name);
      for(let i=0;i<g.attributes.position.count;i+=2){let bi=-1,bw=-1;for(let k=0;k<4;k++){const w=sw.getComponent(i,k);if(w>bw){bw=w;bi=si.getComponent(i,k);}}
        const nm=names[bi]||'?',c=nm==='body'?0:nm==='abdomen'?1:/^fang/.test(nm)?2:/^leg_.*_[012]$/.test(nm)?3:/^leg_.*_[34]$/.test(nm)?4:5;
        if(c<5)D.items.push({sm,i,c,nm});}}
    D.s=s;return D.items.length;};
  const v=new T.Vector3(),pv=new T.Vector3();
  // signed distance of a world point to the real ship (negative inside), capped at ±0.6 away from any triangle
  D.sd=(x,y,z)=>{const n=CT.near(x,y,z,0.6);if(n.d<9)return CT.outside(x,y,z)?n.d:-n.d;
    pv.set(x,y,z);const hp=__hullParam(pv),[q,nn]=__hullPoint(hp.z,hp.th);if((x-q.x)*nn.x+(y-q.y)*nn.y+(z-q.z)*nn.z>0.3)return 0.6;
    return CT.outside(x,y,z)?0.6:-Math.max(0.6,CT.near(x,y,z,8).d);};
  // min distance per class (0 body, 1 abdomen, 2 fangs, 3 upper leg, 4 foot) + the lowest-hanging foot (highest "lowest vertex" over the 8 legs)
  D.measure=(stride)=>{const s=D.s;s.mesh.updateMatrixWorld(true);const m=[9,9,9,9,9],leg={};
    for(let k=0;k<D.items.length;k+=stride){const it=D.items[k];it.sm.getVertexPosition(it.i,v);v.applyMatrix4(it.sm.matrixWorld);const d=D.sd(v.x,v.y,v.z);
      if(d<m[it.c])m[it.c]=d;if(it.c===4){const L=it.nm.slice(4,6);if(leg[L]===undefined||d<leg[L])leg[L]=d;}}
    let fl=-9;for(const L in leg)if(leg[L]>fl)fl=leg[L];
    return {m:m.map(x=>+x.toFixed(3)),fl:+fl.toFixed(3),lt:+((s.mesh.userData.rig.liftN)||0).toFixed(3)};};
  D.place=(z,th,sc,face)=>{const s=D.sp(),R=s.mesh.userData.rig;s.mesh.scale.setScalar(sc);s.z=z;s.th=th;const [q,n]=__hullPoint(z,th);s.pos.copy(q);
    const fw=face==='z'?new T.Vector3(0,0,1):new T.Vector3(-Math.sin(th),Math.cos(th),0);fw.addScaledVector(n,-fw.dot(n)).normalize();s.face=fw.clone();
    s.state='crawl';s.idleT=0;s.spd=0;s.cd=99;s.landK=0;s.fall=null;s.patch=null;s.t=0;s.silk=null;s.leapN=null;R.init=false;D.fw=fw;D.n=n;D.q=q;D.orient();
    s.mesh.position.copy(q).addScaledVector(n,R.spd.rootOff*sc);}; // the game sets this every frame while crawling / eating, but NOT while winding up: a pose that starts at once in 'windup' needs it
  D.orient=()=>{const s=D.sp(),fw=D.fw,up=D.n,r=new T.Vector3().crossVectors(up,fw).normalize(),u=new T.Vector3().crossVectors(fw,r).normalize();s.mesh.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(r,u,fw));};
  // hold a pose for n frames: crawl (standing), windup (the pounce crouch, fully down), eat (front legs rake the hull), idle (threat pose)
  D.pose=(pose,n)=>{const s=D.sp(),Pl=H.P;
    for(let i=0;i<n;i++){
      if(pose==='windup'){s.state='windup';s.atk='spit';s.windT=1e9;s.t=0.97e9;s.idleT=0;Pl.pos.copy(D.q).addScaledVector(D.fw,9).addScaledVector(D.n,5);}
      else if(pose==='idle'){s.state='windup';s.idleT=5;s.idle0=1;s.windT=0.4;s.t=0.4;Pl.pos.copy(D.q).addScaledVector(D.fw,9).addScaledVector(D.n,5);}
      else if(pose==='eat'){s.state='eat';s.idleT=0;if(!s.patch||s.patch.hp<=0)s.patch=__T.PATCHES.reduce((a,c)=>c.pos.distanceTo(D.q)<a.pos.distanceTo(D.q)?c:a);Pl.pos.set(0,60,0);}
      else{s.state='crawl';s.idleT=0;D.orient();Pl.pos.copy(D.q).addScaledVector(D.fw,9).addScaledVector(D.n,5);}
      s.cd=99;Pl.vel.set(0,0,0);D.hold();__step(1,1/60);D.hold();s.cd=99;if(pose==='crawl')D.orient();}};
  D.padOf=sc=>{const s=D.sp();s.mesh.scale.setScalar(sc);return window.__spPad?window.__spPad(s):2;};
  D.spot=(z,th,sc,face,pose,settle)=>{const pad=D.padOf(sc);if(H.hullBlocked(z,th,pad))return null;D.place(z,th,sc,face);D.pose(pose,settle);return D.measure(2);};
  // a pounce from a spot: the astronaut hangs out in the air, the crab crouches 0.4 s and launches; every frame of the next 0.75 s is measured
  D.leap=(z,th,sc,face,dir)=>{const pad=D.padOf(sc);if(H.hullBlocked(z,th,pad))return null;D.place(z,th,sc,face);D.pose('crawl',25);const s=D.sp(),Pl=H.P;
    const out=new T.Vector3(),tg=new T.Vector3().crossVectors(D.n,D.fw).normalize();
    if(dir==='out')out.copy(D.q).addScaledVector(D.n,12).addScaledVector(D.fw,3);else out.copy(D.q).addScaledVector(D.n,4).addScaledVector(tg,11);
    Pl.pos.copy(out);Pl.vel.set(0,0,0);s.state='windup';s.atk='pounce';s.windT=0.3;s.t=0.3;s.idleT=0;s.cd=99;
    const res={worst:9,worstLeg:9,st:[],frames:0};
    for(let f=0;f<45;f++){Pl.pos.copy(out);Pl.vel.set(0,0,0);D.hold();__step(1,1/60);D.hold();s.hp=s.maxHp;if(f%2===0){const m=D.measure(3);const w=Math.min(m.m[0],m.m[1],m.m[2]);if(w<res.worst)res.worst=w;if(m.m[3]<res.worstLeg)res.worstLeg=m.m[3];res.frames++;}
      if(!res.st.length||res.st[res.st.length-1]!==s.state)res.st.push(s.state);if(!D.sp())break;}
    res.worst=+res.worst.toFixed(3);res.worstLeg=+res.worstLeg.toFixed(3);return res;};
  // dynamic: seeded; the bait astronaut makes it land, threaten, crawl, crouch, pounce, drift, return
  D.dynStart=(sc)=>{let x=SEEDV*2654435761>>>0;Math.random=()=>{x=(x+0x6D2B79F5)>>>0;let t=Math.imul(x^x>>>15,1|x);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
    D.hold();for(const o of [...H.spiders])if(o.kind==='spitter')H.killSpider(o,false,true);P.pos.set(0,14,3);P.vel.set(0,0,0);const s=H.spawnSpitter();s.mesh.scale.setScalar(sc);s.gen=GENS[sc]||1;D.init(s);
    D.bait=new T.Vector3(0,14,3);D.phase=0;D.phaseT=0;D.f=0;D.sched=[['near',6],['mid',4],['near',5],['far',8],['near',6],['mid',4]];
    D.setBait=kind=>{const s=D.sp();if(!s)return;const [q,n]=__hullPoint(s.z,s.th);
      if(kind==='near')D.bait.copy(q).addScaledVector(n,4+Math.random()*2).add(new T.Vector3((Math.random()-0.5)*3,0,(Math.random()-0.5)*3));
      else if(kind==='mid'){const z2=s.z>4?s.z-16:s.z+16;const [q2,n2]=__hullPoint(Math.max(-12,Math.min(19,z2)),s.th);D.bait.copy(q2).addScaledVector(n2,6);}
      else D.bait.set(q.x*3,q.y*3+5,s.z>4?-48:48);};
    D.setBait('near');};
  D.frame=()=>{D.phaseT+=1/60;const ph=D.sched[D.phase%D.sched.length];if(D.phaseT>ph[1]){D.phase++;D.phaseT=0;D.setBait(D.sched[D.phase%D.sched.length][0]);}
    if(D.sched[D.phase%D.sched.length][0]==='near'&&Math.abs(D.phaseT%1.5)<1/60)D.setBait('near');
    D.hold();P.pos.copy(D.bait);P.vel.set(0,0,0);__step(1,1/60);D.hold();D.f++;const s=D.sp();if(!s)return {gone:1};s.hp=s.maxHp;
    const st=s.state+(s.state==='windup'?(s.idleT>0?':idle':':'+(s.atk||'?')):'');const o={f:D.f,st,sc:s.mesh.scale.x};
    if(D.f%4===0||s.state==='fall'||s.state==='leap'||s.state==='return'){const m=D.measure(3);o.m=m.m;o.fl=m.fl;o.lt=m.lt;o.parts=Math.min(m.m[0],m.m[1],m.m[2]);}
    return o;};
  window.SP=D;return true;
}
// ---------------------------------------------------------------- Node side
(async()=>{
  const fsrc=fs.readFileSync(path.join(__dirname,'camera.cjs'),'utf8');
  const i0=fsrc.indexOf('function pageLib(SEEDV){'),i1=fsrc.indexOf('// ---------------------------------------------------------------- Node side');
  if(i0<0||i1<0)throw new Error('spitter: pageLib not found in camera.cjs');
  const rk='const rockLive=k=>RK[k].R.mesh.visible&&RK[k].R.fade>0.5;';let libSrc=fsrc.slice(i0,i1);
  if(!libSrc.includes(rk))throw new Error('spitter: rockLive anchor not found in camera.cjs');libSrc=libSrc.replace(rk,'const rockLive=k=>false;');
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
  await lateReady(p);
  console.log('page lib',JSON.stringify(await p.evaluate('('+libSrc+')(7)')));
  await p.evaluate('('+pageSP.toString()+')('+SEED+','+JSON.stringify(GEN)+')');
  await p.evaluate(()=>CT.prime());
  await p.evaluate(()=>{const H=__heads;SP.hold();H.P.pos.set(0,14,3);H.P.vel.set(0,0,0);const s=H.spawnSpitter();SP.init(s);for(let i=0;i<90;i++)SP.step(1,1/60);return s.state;});
  const hasPad=await p.evaluate(()=>typeof window.__spPad==='function');
  if(!hasPad){console.log('FAIL: window.__spPad is missing (test hook of 37-escupidora-casco.js: run npm run build:test)');process.exit(1);}
  if(process.env.HEADS_CF)await p.evaluate(o=>Object.assign(window.__crabFix,o),JSON.parse(process.env.HEADS_CF));
  const res={static:[],leap:[],dyn:{}},fails=[];
  const med=a=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[Math.floor(s.length/2)]:NaN;};
  const pct=(a,f)=>a.length?Math.round(100*a.filter(f).length/a.length):0;
  const line=(...a)=>console.log(...a);
  // ---------------------------------------------------------------- static
  if(!ONLY||ONLY==='static'){
    const ZS=[-12,-6,0,6,12,16,19],NTH=6,FACES=['z','t'];
    for(const sc of SCALES){
      const pad=await p.evaluate(sc=>SP.padOf(sc),sc);
      const spots=[];for(const face of FACES)for(const z of ZS)for(let k=0;k<NTH;k++)spots.push({face,z,th:+(k/NTH*Math.PI*2+(face==='t'?0.2:0)).toFixed(3)});
      for(const pose of POSES){
        const sub=pose==='crawl'?spots:spots.filter((_,i)=>i%3===0);const rows=[];
        for(const sp of sub){const r=await p.evaluate(({sp,sc,pose})=>SP.spot(sp.z,sp.th,sc,sp.face,pose,pose==='crawl'?40:50),{sp,sc,pose});if(r)rows.push({sc,pose,...sp,...r});}
        res.static.push(...rows);
        const parts=rows.map(r=>Math.min(r.m[0],r.m[1],r.m[2]));const worst=rows.length?rows[parts.indexOf(Math.min(...parts))]:null;
        const legs=rows.map(r=>r.m[3]),feet=rows.map(r=>r.m[4]),fl=rows.map(r=>r.fl),lt=rows.map(r=>r.lt);
        line(`static  ${String(sc).padEnd(4)} ${pose.padEnd(6)} pad ${pad} spots ${String(rows.length).padStart(3)} | parts <-5cm ${String(pct(parts,x=>x<-0.05)).padStart(3)}% worst ${Math.min(...parts).toFixed(3)}${worst?` (z ${worst.z} th ${worst.th} ${worst.face})`:''} | legs <-5cm ${pct(legs,x=>x<-0.05)}% worst ${Math.min(...legs).toFixed(3)} | feet <-5cm ${pct(feet,x=>x<-0.05)}% worst ${Math.min(...feet).toFixed(3)} | float med ${med(fl).toFixed(3)} max ${Math.max(...fl).toFixed(3)} | net lift med ${med(lt).toFixed(2)} max ${Math.max(...lt).toFixed(2)}`);
        if(!rows.length){fails.push(`static ${sc} ${pose}: no spot could be measured`);continue;}
        const tag=`static ${sc} ${pose}`;
        if(pct(parts,x=>x<-0.05)>LIM.partsPct)fails.push(`${tag}: ${pct(parts,x=>x<-0.05)}% of the spots have body/abdomen/fangs >5 cm inside (limit ${LIM.partsPct}%)`);
        if(Math.min(...parts)<LIM.partsWorst)fails.push(`${tag}: parts as deep as ${Math.min(...parts).toFixed(3)} m (limit ${LIM.partsWorst})`);
        if(pct(legs,x=>x<-0.05)>LIM.legsPct)fails.push(`${tag}: ${pct(legs,x=>x<-0.05)}% of the spots have an upper leg >5 cm inside (limit ${LIM.legsPct}%)`);
        const fpLim=pose==='eat'?LIM.eatFeetPct:LIM.feetPct;
        if(pct(feet,x=>x<-0.05)>fpLim)fails.push(`${tag}: ${pct(feet,x=>x<-0.05)}% of the spots have a foot >5 cm inside (limit ${fpLim}%)`);
        if(Math.min(...feet)<LIM.feetWorst)fails.push(`${tag}: a foot as deep as ${Math.min(...feet).toFixed(3)} m (limit ${LIM.feetWorst})`);
        if(pose==='crawl'&&med(fl)>LIM.floatMed)fails.push(`${tag}: the lowest-hanging foot floats ${med(fl).toFixed(3)} m above the hull (median, limit ${LIM.floatMed})`);
      }
    }
  }
  // ---------------------------------------------------------------- forced pounces
  if(!ONLY||ONLY==='leap'){
    const SPOTS=[[-10,1.57],[-10,3.6],[0,1.57],[0,4.71],[6,0.4],[6,2.9],[6,5.9],[14,1.57],[14,3.14],[19,1.57]];
    for(const sc of SCALES){const rows=[];
      for(const [z,th] of SPOTS)for(const dir of ['out','side']){const r=await p.evaluate(({z,th,sc,dir})=>SP.leap(z,th,sc,'z',dir),{z,th,sc,dir});if(r)rows.push({sc,z,th,dir,...r});}
      res.leap.push(...rows);
      const w=rows.map(r=>r.worst),wl=rows.map(r=>r.worstLeg);const iw=w.indexOf(Math.min(...w));
      line(`leaps   ${String(sc).padEnd(4)} launches ${String(rows.length).padStart(2)} | parts worst ${Math.min(...w).toFixed(3)}${rows[iw]?` (z ${rows[iw].z} th ${rows[iw].th} ${rows[iw].dir})`:''} | upper legs worst ${Math.min(...wl).toFixed(3)} | states seen ${[...new Set(rows.flatMap(r=>r.st))].join('>')}`);
      if(rows.length<10)fails.push(`leaps ${sc}: only ${rows.length} launches could be measured`);
      if(rows.length&&Math.min(...w)<LIM.leapWorst)fails.push(`leaps ${sc}: body/abdomen/fangs as deep as ${Math.min(...w).toFixed(3)} m in a pounce launch (limit ${LIM.leapWorst})`);
    }
  }
  // ---------------------------------------------------------------- dynamic
  if(!ONLY||ONLY==='dyn'){
    for(const sc of SCALES){
      await p.evaluate(sc=>SP.dynStart(sc),sc);const log=[];const nF=Math.round(SEC*60);
      // the scenario is seeded, but any change in how the game draws random numbers shifts it: if no pounce happened in SEC seconds, run up to 10 s more until one does
      let leapt=false;for(let f=0;f<nF||(!leapt&&f<nF+600);f++){const o=await p.evaluate(()=>SP.frame());log.push(o);if(o.st&&o.st.startsWith('leap'))leapt=true;if(o.gone)break;}
      res.dyn[sc]=log;
      const ms=log.filter(o=>o.m);const wt=o=>1; // every sample counts the same (they are 4 frames apart except in the fast states, which are sampled every frame: weight by frames)
      const byState={};for(let i=0;i<ms.length;i++){const k=ms[i].st.split(':')[0];const nxt=i+1<ms.length?ms[i+1].f:ms[i].f+1;const w=Math.min(nxt-ms[i].f,8);(byState[k]=byState[k]||[]).push({...ms[i],w});}
      const all=Object.values(byState).flat(),W=all.reduce((a,o)=>a+o.w,0);
      const tw=(arr,f)=>{const T=arr.reduce((a,o)=>a+o.w,0);return T?100*arr.filter(f).reduce((a,o)=>a+o.w,0)/T:0;};
      line(`dynamic ${String(sc).padEnd(4)} ${log.length} frames (${(log.length/60).toFixed(0)} s), states: ${Object.entries(byState).map(([k,a])=>k+' '+(a.reduce((x,o)=>x+o.w,0)/60).toFixed(1)+'s').join(', ')}`);
      for(const [k,a] of Object.entries(byState)){const wp=Math.min(...a.map(o=>o.parts));const wf=Math.min(...a.map(o=>o.m[4]));const wl=Math.min(...a.map(o=>o.m[3]));
        line(`        ${k.padEnd(8)} parts <-5cm ${tw(a,o=>o.parts<-0.05).toFixed(1).padStart(5)}% worst ${wp.toFixed(3)} | legs worst ${wl.toFixed(3)} | feet worst ${wf.toFixed(3)} | net lift max ${Math.max(...a.map(o=>o.lt)).toFixed(2)}`);
        if(wp<LIM.partsWorst&&k!=='leap')fails.push(`dynamic ${sc} ${k}: parts as deep as ${wp.toFixed(3)} m (limit ${LIM.partsWorst})`);
        if(k==='leap'&&wp<LIM.leapWorst)fails.push(`dynamic ${sc} leap: parts as deep as ${wp.toFixed(3)} m (limit ${LIM.leapWorst})`);}
      const pAll=tw(all,o=>o.parts<-0.05);line(`        ALL      parts <-5cm ${pAll.toFixed(1)}% of the time`);
      if(!ms.length)fails.push(`dynamic ${sc}: no samples`);
      if(pAll>LIM.partsPct)fails.push(`dynamic ${sc}: ${pAll.toFixed(1)}% of the time body/abdomen/fangs are >5 cm inside (limit ${LIM.partsPct}%)`);
      for(const need of ['fall','crawl','leap'])if(!byState[need])fails.push(`dynamic ${sc}: the run never reached the state '${need}' (the scenario changed?)`);
    }
  }
  if(errs.length)fails.push('page errors: '+errs.slice(0,3).join(' | '));
  fs.writeFileSync(shot(`spitter_${TAG}.json`),JSON.stringify(res));
  console.log(`done in ${((Date.now()-t0)/1000).toFixed(0)} s`);
  global.__fin=1;await b.close();
  if(fails.length){console.log('FAIL');for(const f of fails)console.log(' -',f);process.exit(1);}
  console.log('OK: the Escupidora stays out of the hull');
})();
