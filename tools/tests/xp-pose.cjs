// v77: the EXTRA POWER power-up pose. Run on dist-test:   tools/run-test.sh dist-test tools/tests/xp-pose.cjs      (PC 960x540, then phone 844x390)
//   HEADS_ONLY=pc|phone · HEADS_NOSHOTS=1 (no pictures) · HEADS_TITLESHOT=1 (also one full-page screenshot with the title on, if the machine has memory for it)
// The game loop is stopped and stepped by hand (0.05 s per step), so every number below is the same on every run. Checks, once on PC and once on a phone:
//   1) the pose happens: at mid-pose the gun is above the shoulder, points straight up, the elbow is bent ~90 deg with the upper arm out to the side; before and after it is at the aim
//   2) the beam exists during it (and not before / after); the old pistol and the plasma gun are both there only while the scan runs; the ring at the end
//   3) it lasts ~1 s, the world runs at ~0.4x for ~0.5 s (eased), the camera pushes in and comes back
//   4) the astronaut cannot be hurt during the pose (damagePlayer, direct hp loss) and cannot shoot; both work again after it
//   5) the 20 s of plasma only start running after the pose
//   6) the title: first time only (stored in localStorage), none the second time, ?xp forces it; the old message is gone; the voice line is asked for every time
//   7) the camera never ends up inside the ship while the pose pushes in (player with his back to the hull)
//   8) no page errors
// Pictures of the pose (the 3D canvas) at 0, 0.25, 0.5, 0.75 and 1.0 s: tools/tests/out/xp_pose_<pc|phone>_<NNN>.png (all at quality level 3: no MSAA, so the browser needs less memory)
const {chromium}=require('playwright');
const fs=require('fs');
const {BASE,ARGS,shot,lateReady}=require('./lib.cjs');
let bad=0;const ok=(c,m,i)=>{console.log((c?'  ok   ':'  FAIL ')+m+(i!==undefined?'  '+JSON.stringify(i):''));if(!c)bad++;};
const ONLY=process.env.HEADS_ONLY||'',NOSHOTS=!!process.env.HEADS_NOSHOTS,TITLESHOT=!!process.env.HEADS_TITLESHOT;
const R2=v=>Math.round(v*100)/100;
const Q='q=3'; // forced quality level 3 (no MSAA, half-size bloom): same game, lighter on memory

async function run(mode){
 const phone=mode==='phone';
 console.log('\n=== '+mode+' ===');
 const b=await chromium.launch({args:ARGS});
 const ctx=await b.newContext(phone?{viewport:{width:844,height:390},isMobile:true,hasTouch:true}:{viewport:{width:960,height:540}});
 const errs=[];
 const boot=async(q)=>{
   const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));
   await p.addInitScript(()=>{let s=20261102;Math.random=()=>{s=(s*1664525+1013904223)%4294967296;return s/4294967296;};});
   await p.goto(BASE+'/test.html?'+(q?q+'&':'')+Q);
   await p.waitForFunction(()=>document.getElementById('play')&&!document.getElementById('play').disabled,null,{timeout:300000});
   await lateReady(p);
   if(phone){await p.waitForFunction(()=>document.getElementById('mobMenu').classList.contains('go'),null,{timeout:120000});await p.waitForTimeout(2500);await p.tap('#mmGo');}
   else await p.evaluate(()=>document.getElementById('play').click());
   // from the click on, nothing draws by itself: the real-time loop ends after its next frame (it is told not to render it) and only __step moves the game and only __render draws
   await p.evaluate(()=>{window.__manual=1;window.__noRender=1;});
   await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   await p.evaluate(()=>{__step(10);});
   // no spiders attack, but one is parked far away so the round stays open (no break, no showcase camera, the 20 s keep running)
   await p.evaluate(()=>{window.__noSpawn=1;for(const s of [...__heads.spiders])__heads.killSpider(s);const sp=__heads.spawnSpider('hunter');sp.state='crawl';sp.cd=1e9;
     const P=__heads.P;P.hp=100;P.inv=0;P.vel.set(0,0,0);__T.showcase=0;__step(10);});
   return p;};
 const step=(p,s)=>p.evaluate(n=>{__T.showcase=0;__step(n);},Math.round(s/0.05));
 // everything worth measuring in one call
 const snap=p=>p.evaluate(()=>{const T=__THREE,X=__xp.XP,H=__heads,P=H.P,B=P.bones,wp=n=>B[n].getWorldPosition(new T.Vector3());
   const S=wp('RightArm'),E=wp('RightForeArm'),Hd=wp('RightHand'),pi=X.g1.parent,gp=pi.getWorldPosition(new T.Vector3()),ax=new T.Vector3(0,0,1).applyQuaternion(pi.getWorldQuaternion(new T.Quaternion()));
   const u1=E.clone().sub(S).normalize(),u2=Hd.clone().sub(E).normalize(),F=X.fx;
   return {pp:X.pp,k:X.k,ts:X.ts,push:X.push,on:X.on,t:X.t,
     gunUp:gp.y-S.y,gunAxisUp:ax.y,handUp:Hd.y-S.y,handOut:Math.hypot(Hd.x-S.x,Hd.z-S.z),upperArmUp:u1.y,elbowDeg:Math.acos(Math.max(-1,Math.min(1,u1.dot(u2))))*180/Math.PI,forearmUp:u2.y,
     beam:!!(F&&F.beam.visible),scan:!!(F&&F.scan.visible),ringB:!!(F&&F.ringB.visible),g1:X.g1.visible,g2:X.g2.visible,
     cpNew:X.cpNew.constant,cpOld:X.cpOld.constant,
     hp:P.hp,inv:P.inv,fireT:P.fireT,shots:H.stats.shots,fov:__camera.fov};});
 const title=p=>p.evaluate(()=>{const e=document.getElementById('xpT');return {go:e.classList.contains('go'),big:(e.querySelector('.xpTl .g3')||{dataset:{}}).dataset.t||'',sub:e.querySelector('.xpTs').textContent};});
 // what the screen says: the big message, and on a phone its feed / alert
 const msgState=p=>p.evaluate(()=>({msg:document.getElementById('msg').textContent,feed:(document.getElementById('mFeed')||{children:[]}).children.length,alert:(document.getElementById('mAlert')||{className:''}).className}));
 const sayN=p=>p.evaluate(()=>(window.__sayLog||[]).filter(x=>x==='xp_on').length);
 const reset=p=>p.evaluate(()=>{__xp.xpEnd(true);__xp.XP.pp=-1;__xp.XP.k=0;const P=__heads.P;P.hp=100;P.inv=0;__T.showcase=0;__step(10);});
 // a picture of the 3D canvas (read right after drawing it, in the same task)
 const dump=async(p,name)=>{if(NOSHOTS)return;const d=await p.evaluate(()=>{__render();return document.getElementById('c').toDataURL('image/png');});fs.writeFileSync(shot(name),Buffer.from(d.split(',')[1],'base64'));};

 // ---------------------------------------------------------------- first activation on this device
 let p=await boot('');
 let r=await p.evaluate(()=>({g2:!!__xp.XP.g2,stored:localStorage.getItem('heads_xp_seen'),state:__T.state}));
 ok(r.g2&&r.state==='play'&&r.stored===null,'game running, gun2 loaded, nothing stored yet',r);
 const m0=await msgState(p),say0=await sayN(p);
 const s0=await snap(p);
 await p.evaluate(()=>{__xp.xpStart();});
 let t=await title(p);
 ok(t.go&&t.big==='EXTRA POWER'&&t.sub==='Plasma 20 s · atraviesa arañas','first time: the title is on («EXTRA POWER» + «Plasma 20 s · atraviesa arañas»)',t);
 ok((await p.evaluate(()=>localStorage.getItem('heads_xp_seen')))==='1','... and it is remembered on this device');
 const en=await p.evaluate(()=>{const I=window.I18N,l=I.lang;I.lang='en';const r=[TR('EXTRA POWER'),TR('Plasma 20 s · atraviesa arañas')];I.lang=l;return r;});
 ok(en[0]==='EXTRA POWER'&&en[1]==='Plasma 20 s · pierces spiders','English: «EXTRA POWER» / «Plasma 20 s · pierces spiders»',en);
 ok(await sayN(p)===say0+1,'the voice line (xp_on) is asked for');
 const m1=await msgState(p);
 ok(JSON.stringify(m0)===JSON.stringify(m1),'the old «EXTRA POWER · Plasma» message is gone (no showMsg, no phone feed entry)',{m0,m1});
 // run the pose in 0.05 s steps
 const rows=[];
 const PICS=[0.25,0.5,0.75];
 let tt=0;
 await dump(p,'xp_pose_'+mode+'_000.png');
 let hurt=null,hpFloor=null,hpPend=null;
 await p.evaluate(()=>{__heads.inp.fire=true;}); // the fire button is held all through the pose: no shot may come out
 for(let i=1;i<=26;i++){
   await step(p,0.05);tt=R2(tt+0.05);const s=await snap(p);rows.push({u:tt,...s});
   if(hpPend!==null){hpFloor=hpPend-s.hp;hpPend=null;}                       // (a direct hp loss one step ago: fire / acid over time)
   if(Math.abs(tt-0.45)<1e-6){                                                 // in the middle of the pose: try to get hurt
     const hp0=s.hp;
     await p.evaluate(()=>{__T.damagePlayer(25,new (__THREE.Vector3)(0,0,1));});
     hurt=hp0-(await snap(p)).hp;
     await p.evaluate(()=>{__heads.P.hp-=20;});hpPend=hp0;
   }
   if(PICS.some(x=>Math.abs(x-tt)<1e-6))await dump(p,'xp_pose_'+mode+'_'+String(Math.round(tt*100)).padStart(3,'0')+'.png');
   if(rows[rows.length-1].pp<0)break;}
 await p.evaluate(()=>{__heads.inp.fire=false;});
 const fired=rows.filter(x=>x.pp>=0).slice(-1)[0].shots-s0.shots;
 const end=rows[rows.length-1];
 await dump(p,'xp_pose_'+mode+'_100.png');
 console.log('  (u/k/ts/beam/gunUp/axisUp/elbow°):',rows.filter((_,i)=>i%2===1).map(x=>[x.u,R2(x.k),R2(x.ts),x.beam?1:0,R2(x.gunUp),R2(x.gunAxisUp),Math.round(x.elbowDeg)].join('/')).join('  '));
 // 1) the pose
 const mid=rows.filter(x=>x.u>=0.3&&x.u<=0.6&&!x.note);
 const m=mid[Math.floor(mid.length/2)];
 ok(!!m&&m.gunUp>0.15&&m.gunAxisUp>0.97,'mid-pose: the gun is above the shoulder and points straight up',m&&{gunUp:R2(m.gunUp),axisUp:R2(m.gunAxisUp)});
 ok(!!m&&m.handOut>0.2&&Math.abs(m.upperArmUp)<0.35,'mid-pose: the upper arm goes out to the side, roughly horizontal',m&&{out:R2(m.handOut),upperArmUp:R2(m.upperArmUp)});
 ok(!!m&&m.elbowDeg>75&&m.elbowDeg<105&&m.forearmUp>0.9,'mid-pose: elbow bent ~90 deg, forearm vertical',m&&{elbow:R2(m.elbowDeg),forearmUp:R2(m.forearmUp)});
 ok(Math.abs(s0.gunAxisUp)<0.6&&s0.handUp<0.1,'before: the gun is at the normal aim, not up',{axisUp:R2(s0.gunAxisUp),handUp:R2(s0.handUp)});
 ok(end.pp<0&&Math.abs(end.gunAxisUp)<0.6&&end.k===0,'after: the arm is back at the aim',{axisUp:R2(end.gunAxisUp)});
 // 2) beam and the swap of the two guns
 const bm=rows.filter(x=>x.beam);
 ok(bm.length>=8&&bm[0].u>=0.1&&bm[0].u<=0.35,'the beam shows up during the pose (not at the start)',{frames:bm.length,from:bm[0]&&bm[0].u,to:bm.length&&bm[bm.length-1].u});
 ok(!end.beam&&!end.scan,'no beam / scan left after it');
 const early=rows.find(x=>x.u>=0.15&&!x.note),late=rows.find(x=>x.u>=0.7&&!x.note);
 ok(early.g1&&!early.g2,'before the scan: only the old pistol is shown',{g1:early.g1,g2:early.g2});
 ok(!late.g1&&late.g2,'after the scan: only the plasma gun',{g1:late.g1,g2:late.g2});
 ok(rows.some(x=>x.scan&&x.g1&&x.g2),'during the scan both guns are there (the front cuts one and shows the other)');
 ok(rows.some(x=>x.ringB),'the ring / shockwave at the end');
 // 3) timing
 const slow=rows.filter(x=>x.ts<0.7&&!x.note).length*0.05,minTs=Math.min(...rows.map(x=>x.ts));
 ok(end.pp<0&&tt>=0.95&&tt<=1.15,'the pose lasts about a second',{seconds:tt});
 ok(minTs>=0.38&&minTs<=0.45&&slow>=0.3&&slow<=0.7,'the world slows to ~0.4x for ~0.5 s',{minTs:R2(minTs),secondsBelow0_7:R2(slow)});
 ok(rows[0].ts>0.9&&end.ts===1,'... eased in (starts near 1) and out (ends at 1)',{first:R2(rows[0].ts),last:end.ts});
 const pushMax=Math.max(...rows.map(x=>x.push));
 ok(pushMax>0.3&&end.push===0,'the camera pushes in and comes back',{max:R2(pushMax)});
 const fovMin=Math.min(...rows.map(x=>x.fov));
 ok(fovMin<s0.fov-1.5&&Math.abs(end.fov-s0.fov)<1.2,'... with a slightly narrower lens that goes back',{fov0:R2(s0.fov),min:R2(fovMin),end:R2(end.fov)});
 // 4) cannot shoot, cannot be hurt
 ok(fired===0,'no shot comes out during the pose (fire held all along)',{shots:fired});
 ok(hurt===0,'damagePlayer(25) in the middle of the pose does nothing',{lost:hurt});
 ok(hpFloor<=0.5,'a direct hp loss (fire / acid over time) is floored during the pose',{lost:R2(hpFloor)});
 ok(rows.filter(x=>x.pp>=0).every(x=>x.inv>0.05),'invulnerable all along (inv > 0)');
 // 5) the 20 s
 ok(rows.filter(x=>x.pp>=0).every(x=>x.t===20),'the 20 s do not run during the pose');
 await step(p,1.0);
 let a=await snap(p);
 ok(a.on&&a.t<19.2&&a.t>18.5,'... and run right after it',{t:R2(a.t)});
 // after the pose: shooting and damage work again
 await p.evaluate(()=>{__heads.P.inv=0;__heads.inp.fire=true;});const sh1=a.shots;await step(p,0.4);await p.evaluate(()=>{__heads.inp.fire=false;});
 a=await snap(p);ok(a.shots-sh1>=2,'after the pose the plasma gun shoots',{shots:a.shots-sh1});
 const hpA=a.hp;await p.evaluate(()=>{__heads.P.inv=0;__T.damagePlayer(10,new (__THREE.Vector3)(0,0,1));});a=await snap(p);
 ok(hpA-a.hp===10,'... and damage works again',{lost:hpA-a.hp});
 ok(a.cpNew>=1e5&&a.cpOld>=1e5,'the clipping planes are back out of the way (both guns whole)',{cpNew:a.cpNew,cpOld:a.cpOld});
 // 6) second time: no title, no text; the voice again
 await reset(p);
 const m2a=await msgState(p),sayB=await sayN(p);
 await p.evaluate(()=>{__xp.xpStart();});
 let seenGo=false,seenMsg=false;
 for(let i=0;i<24;i++){await step(p,0.05);const tt2=await title(p);if(tt2.go)seenGo=true;const mm=await msgState(p);if(mm.msg!==m2a.msg||mm.feed!==m2a.feed||mm.alert!==m2a.alert)seenMsg=true;}
 ok(!seenGo,'second time: the title does not show');
 ok(!seenMsg,'second time: no text at all (no message, no phone feed / alert)');
 ok(await sayN(p)===sayB+1,'second time: the voice line is asked for again');
 ok((await snap(p)).pp<0,'second time: the pose itself ran as well');
 // and the pose happens every time: third activation, mid-pose
 await reset(p);await p.evaluate(()=>{__xp.xpStart();});await step(p,0.45);const m3=await snap(p);
 ok(m3.gunAxisUp>0.97&&m3.gunUp>0.15,'the pose happens every time (third activation, mid-pose)',{axisUp:R2(m3.gunAxisUp),gunUp:R2(m3.gunUp)});
 // an already-active EXTRA POWER picked up again only refills (no new pose)
 await step(p,1.0);await p.evaluate(()=>{__xp.XP.t=5;__xp.xpStart();});a=await snap(p);
 ok(a.pp<0&&a.t===20&&a.on,'a second prize while it is active only refills the 20 s (no new pose)',{pp:a.pp,t:a.t});

 // ---------------------------------------------------------------- 7) camera against the hull: the pose pushes the camera in; with the astronaut's back to the hull the spring arm is short
 await reset(p); // (same page as above: one boot less)
 await p.evaluate(()=>{const T=__THREE,H=__heads,P=H.P,cam=__camera;
   let r=__scene.getObjectByName('SM_HEADS_Ship_Body')||__scene.getObjectByName('SM_HEADS_Ship_TailFan_Rotor');while(r&&r.parent&&r.parent!==__scene)r=r.parent;
   const meshes=[];r.traverse(o=>{if(o.isMesh)meshes.push(o);});r.updateMatrixWorld(true);
   const rc=new T.Raycaster();
   window.__blockedAt=()=>{const head=P.pos.clone().add(new T.Vector3(0,0.5,0)),d=cam.position.clone().sub(head),L=d.length();rc.set(head,d.normalize());rc.far=L;
     const hit=rc.intersectObjects(meshes,false).filter(h=>h.distance>0.15);return hit.length?hit[0].distance:0;};});
 // beside the ship (the +x flank, mid-hull), 1.4 m out, looking away from the hull: the camera sits between the astronaut and the hull
 const place=await p.evaluate(()=>{const P=__heads.P;const [hp,hn]=__hullPoint(0,0);P.pos.copy(hp).addScaledVector(hn,1.4);P.vel.set(0,0,0);P.yaw=Math.atan2(-hn.x,-hn.z);P.pitch=0.05;
   return {at:P.pos.toArray().map(v=>Math.round(v*100)/100),n:hn.toArray().map(v=>Math.round(v*100)/100)};});
 await step(p,1.2);
 const base=await p.evaluate(()=>({blocked:__blockedAt(),solid:__cam.camSolid(__camera.position,0.05),arm:__camera.position.distanceTo(__heads.P.pos.clone().add(new (__THREE.Vector3)(0,0.5,0)))}));
 await p.evaluate(()=>{__xp.xpStart();});
 let worst=0,inside=0,minArm=9,maxArm=0;
 for(let i=0;i<22;i++){await step(p,0.05);const c=await p.evaluate(()=>({b:__blockedAt(),solid:__cam.camSolid(__camera.position,0.05),d:__camera.position.distanceTo(__heads.P.pos.clone().add(new (__THREE.Vector3)(0,0.5,0)))}));
   worst=Math.max(worst,c.b);if(c.solid)inside++;minArm=Math.min(minArm,c.d);maxArm=Math.max(maxArm,c.d);}
 ok(worst===0&&inside===0,'camera against the hull during the pose: nothing between the head and the camera, never inside / 5 cm from the ship',{place,before:{arm:R2(base.arm),blocked:base.blocked,solid:base.solid},blockedAt:R2(worst),insideFrames:inside,armMin:R2(minArm),armMax:R2(maxArm)});
 await p.close();

 // ---------------------------------------------------------------- ?xp forces the title even though the device has seen it
 p=await boot('xp');
 ok((await p.evaluate(()=>localStorage.getItem('heads_xp_seen')))==='1','(this device has already seen it)');
 await p.evaluate(()=>{__xp.xpStart();});t=await title(p);
 ok(t.go&&t.big==='EXTRA POWER','?xp forces the title even if it was seen',t);
 if(TITLESHOT){await step(p,0.5);await p.evaluate(()=>{const e=document.getElementById('xpT');e.style.animationDelay='-0.8s';e.style.animationPlayState='paused';__render();});await p.waitForTimeout(500);
   await p.screenshot({path:shot('xp_pose_'+mode+'_title.png'),timeout:180000});}
 await step(p,1.2);await reset(p);await p.evaluate(()=>{__xp.xpStart();});t=await title(p);
 ok(t.go,'... every time');
 await p.close();

 ok(errs.length===0,'no page errors',errs.slice(0,3));
 await b.close();}

(async()=>{
 if(ONLY!=='phone')await run('pc');
 if(ONLY!=='pc')await run('phone');
 console.log(bad?'\nFAILED '+bad:'\nALL OK');process.exit(bad?1:0);})();
