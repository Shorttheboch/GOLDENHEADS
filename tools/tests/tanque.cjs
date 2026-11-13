// «TANQUE LLENO» (v86): the notice when the backpack tank is full (src/game/42-tanque.js). PC 1280x720 and phone 844x390, Spanish and English.
// Runs (each a fresh page = a fresh device unless said):
//   pc       ES, the round-start cinematic ON (__noCine=0): nothing while it plays, nothing below capacity, then the first-time notice (title, voice 'tank_full',
//            marker pulse, cyan trail that goes round the hull and is gone after ~4 s, backpack flash, no tutorial card, the game not paused, heads_tank_seen),
//            the marker label while full and after unloading, the nozzle refusing (no intake, gas + sparks), the short notice on the next fill (no title, no voice),
//            the reminder after 20 s and then every 22 s, the voice rule (90 s, never two full events in a row) and a quick refill (marker pulse only)
//   phone    ES: first time (touch line «Toca BODEGA y te lleva»), tapping BODEGA stops the reminder clock, the short notice on the alert line, auto-suction refused
//   pc-en    EN: title, line, marker label and short notice in English
//   phone-en EN with ?tanque on a device that has seen it: every fill gets the big notice, nothing remembered
//   pc-seen  ES on a device that has seen it (heads_tank_seen=1): the first fill gets the short notice only
// HEADS_ONLY=pc,phone,pc-en,phone-en,pc-seen (default all) · HEADS_NOSHOT=1 skips the screenshots
// Screenshots (tools/tests/out/): tanque_pc_primera.png · tanque_phone_primera.png (first time, with the trail) · tanque_pc_corto.png · tanque_phone_corto.png (short notice)
//   · tanque_pc_marcador.png · tanque_phone_marcador.png (the marker while full) · tanque_pc_en_primera.png
// Run: npm run build:test && tools/run-test.sh dist-test tools/tests/tanque.cjs
const {chromium}=require('playwright');
const {BASE,ARGS,shot}=require('./lib.cjs');
const ONLY=(process.env.HEADS_ONLY||'pc,phone,pc-en,phone-en,pc-seen').split(',');
const SHOTS=!process.env.HEADS_NOSHOT;
let bad=0;const ok=(c,m,i)=>{console.log((c?'  ok   ':'  FAIL ')+m+(i!==undefined?'  '+JSON.stringify(i):''));if(!c)bad++;};
setTimeout(()=>{console.log('WATCHDOG: too slow, giving up');process.exit(2);},1400000);
const PLAT={pc:{viewport:{width:1280,height:720}},phone:{viewport:{width:844,height:390},deviceScaleFactor:1,isMobile:true,hasTouch:true}};

// ---------------------------------------------------------------- runs in the page
function pageLib(){
  window.__tkLib={
    // no spiders and none to come, and the round stays open (a spitter «queued» for ever): no round messages, no bosses, no cinematics while the test runs
    clear(){const H=__heads;window.__noSpawn=1;__T.toSpawn=3;H.WB.bossT=0;H.WB.incT=0;H.WB.incSp=0;H.WB.spitQ=[1e9];for(const s of [...H.spiders])H.killSpider(s);H.P.hp=100;H.P.inv=1e9;},
    // 9 m out to the side of the hold and a bit above, looking at it: the trail and the hold marker in frame
    place(turn){const P=__heads.P,h=__T.HATCH;P.pos.set(h.x+9,h.y+3.5,h.z+9);P.vel.set(0,0,0);const d=h.clone().sub(P.pos);P.yaw=Math.atan2(-d.x,-d.z)-(turn||0);P.pitch=Math.atan2(d.y,Math.hypot(d.x,d.z));},
    // far from the hold (nothing unloads), looking away from the ship
    far(){const P=__heads.P;P.pos.set(0,20,34);P.vel.set(0,0,0);P.yaw=0;P.pitch=0;},
    st(){const t=document.getElementById('tkT'),m=document.getElementById('msg'),a=document.getElementById('mAlert'),b=document.getElementById('hBod'),tut=document.getElementById('tut'),K=__tank.TK,TT=__tank.TKT;
      let lit=0;for(let i=0;i<TT.N;i++)if(TT.col[i*3]>0.05)lit++;
      return {go:t.classList.contains('go'),tl:((t.querySelector('.g3')||{}).dataset||{}).t||'',ts:t.querySelector('.tkTs').textContent,big:+K.big.toFixed(2),pulse:+K.pulse.toFixed(2),
        n:K.n,log:K.log.join(','),at:K.at.join(','),pend:K.pend,nest:__T.ZONES[2].nest,full:K.full,remT:+K.remT.toFixed(1),
        msg:m.textContent,msgTk:m.classList.contains('tk'),alert:a?a.textContent:'',alertOn:!!(a&&a.classList.contains('on')),alertTk:!!(a&&a.classList.contains('tk')),
        bodTk:b.classList.contains('tk'),bodHidden:b.hidden,lbl:[...b.querySelector('span').childNodes].map(n=>n.textContent.trim()).filter(Boolean).join(' '),lleno:b.classList.contains('lleno'),
        tut:tut.classList.contains('show')?tut.textContent:'',say:K.voN,sayLog:(window.__sayLog||[]).includes('tank_full'),
        trail:TT.on&&TT.core.visible,lit,flash:__heads.P.scr?+__heads.P.scr.material.uniforms.uFlash.value.toFixed(2):-1,
        seen:localStorage.getItem('heads_tank_seen'),cine:__heads.CINE.on,playT:+__T.playT.toFixed(2),rej:K.rejN,carry:__heads.P.carry,cap:__tank.cap,loose:__heads.looseCount()};},
    // the trail's path against the real hull (camSolid: the ellipse moved out by the measured map, nacelles, pylons, wings, rocks), 4 samples per segment
    // (the astronaut is moved there and one frame is run, so the backpack is there too; the rocks are left out for the check: the trail does not dodge them)
    pathCheck(pos){const P=__heads.P,T=__THREE;if(pos){P.pos.set(...pos);P.vel.set(0,0,0);__step(1,0.05);}const L=__tank.path(),p=__tank.TKT.p,K=__tank.TKT.K;let hits=0,n=0,worst=null;const q=new T.Vector3(),a=new T.Vector3(),b=new T.Vector3();
      const R=__heads.ROCKS.splice(0);
      try{for(let k=1;k<=K;k++){a.fromArray(p,k*3-3);b.fromArray(p,k*3);for(let s=0;s<4;s++){q.lerpVectors(a,b,s/4);if(k===1&&s<2)continue;if(k===K&&s>1)continue;n++;if(__cam.camSolid(q,0.15)){hits++;worst=worst||q.toArray().map(v=>+v.toFixed(2));}}}}
      finally{__heads.ROCKS.push(...R);}
      return {L:+L.toFixed(1),hits,n,worst,end:+b.fromArray(p,K*3).distanceTo(__T.HATCH).toFixed(2)};},
    // where the title sits once it is fully in (its animation frozen at 1.1 s), against the crosshair the player sees and the message / alert line above it
    titleBox(){const t=document.getElementById('tkT'),i=t.querySelector('.tkIn'),had=t.classList.contains('go');t.classList.add('go');i.style.animationDelay='-1.1s';i.style.animationPlayState='paused';
      const e=i.getBoundingClientRect(),c=document.getElementById(document.body.classList.contains('hm')?'hud-xh':'cross').getBoundingClientRect();
      const m=document.getElementById('msg'),mt=parseFloat(getComputedStyle(m).top)||0,a=document.getElementById('mAlert'),at=a?parseFloat(getComputedStyle(a).top):0;
      i.style.animationDelay='';i.style.animationPlayState='';if(!had)t.classList.remove('go');
      return {top:Math.round(e.top),bot:Math.round(e.bottom),l:Math.round(e.left),r:Math.round(e.right),crossTop:Math.round(c.top),W:innerWidth,H:innerHeight,
        msgTop:Math.round(mt),alertBot:document.body.classList.contains('hm')?Math.round((a?at:94)+30):0};}, // (the alert line: 94 px down, ~30 px tall with its second line)
    nozzle(){const P=__heads.P;return P.bones.Hose_Grip.localToWorld(new __THREE.Vector3(0,0.17,0));},
  };
}

(async()=>{
 const b=await chromium.launch({args:ARGS});
 b.on('disconnected',()=>{if(!global.__fin){console.log('BROWSER GONE (out of memory?)');process.exit(3);}});
 const step=(p,s)=>p.evaluate(n=>__step(n),Math.round(s/0.05));
 const ev=(p,f,a)=>p.evaluate(f,a);
 const st=p=>ev(p,()=>__tkLib.st());
 const open=async(plat,{lang='es',query='?q=3',cine=false,seen=false}={})=>{
   const ctx=await b.newContext(PLAT[plat]),p=await ctx.newPage();p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));p.on('crash',()=>{console.log('PAGE CRASHED');process.exit(3);});
   await p.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
   await p.addInitScript(pageLib);
   await p.addInitScript(o=>{window.__noTut=1;window.__noCine=o.cine?0:1;if(o.lang==='en')window.__lang='en';if(o.seen)try{localStorage.setItem('heads_tank_seen','1');}catch(_){}},{lang,cine,seen});
   p.plat=plat;await p.goto(BASE+'/test.html'+query);
   if(plat==='pc'){await p.waitForFunction(()=>document.getElementById('play')&&!document.getElementById('play').disabled,null,{polling:250,timeout:300000});await p.evaluate(()=>{document.getElementById('play').click();window.__manual=1;window.__noRender=1;});}
   else{await p.waitForFunction(()=>{const g=document.getElementById('mmGo');return g&&!g.disabled;},null,{polling:250,timeout:300000});await p.waitForTimeout(1500);await p.tap('#mmGo');await p.evaluate(()=>{window.__manual=1;window.__noRender=1;});}
   await p.evaluate(()=>{const o=window.__step;const w=(n,dt)=>{o(n,dt);window.__manual=1;window.__noRender=1;};window.__step=w;});
   await step(p,0.3);return p;};
 const snap=async(p,name)=>{if(!SHOTS)return;await ev(p,()=>{window.__manual=1;});await p.waitForTimeout(600);await ev(p,()=>__render());await p.waitForTimeout(250);
   await p.screenshot({path:shot(name),timeout:240000});await ev(p,()=>{window.__manual=1;window.__noRender=1;});};
 // the first-time moment, staged for a picture: trail ~1 s in, title frozen fully in, marker pulsing, screen flashing
 const snapFirst=async(p,name)=>{if(!SHOTS)return;
   await ev(p,()=>{__tkLib.clear();__tkLib.place();__tank.trailStart();__tank.TKT.t=0.95;__tank.TK.pulse=3;__tank.TK.flash=1.2;const e=document.getElementById('tkT');e.classList.add('go');const i=e.querySelector('.tkIn');i.style.animationDelay='-1.1s';i.style.animationPlayState='paused';});
   await step(p,0.05);await snap(p,name);
   await ev(p,()=>{const e=document.getElementById('tkT'),i=e.querySelector('.tkIn');i.style.animationDelay='';i.style.animationPlayState='';e.classList.remove('go');__tank.TKT.t=99;});await step(p,0.05);};
 const unload=async p=>{await ev(p,()=>{__heads.P.carry=0;});await step(p,0.2);};
 const fill=async(p,s=0.3)=>{await ev(p,()=>{__heads.P.carry=__CFG.tankCap;});await step(p,s);return st(p);};
 const waitShort=async p=>{let r;for(let i=0;i<14;i++){r=await st(p);if(p.plat==='pc'?(r.msgTk&&/TANQUE LLENO · ve a la bodega|TANK FULL · go to the hold/.test(r.msg)):(r.alertOn&&r.alertTk))break;await step(p,0.25);}return r;};
 let r,r0;

 // ================================================================ PC, ES
 if(ONLY.includes('pc')){console.log('===== pc ES (round-start cinematic on)');
  const p=await open('pc',{cine:true});
  r=await ev(p,()=>({cine:__heads.CINE.on,mode:__heads.CINE.mode,seen:localStorage.getItem('heads_tank_seen')}));
  ok(r.cine&&r.mode==='intro'&&r.seen===null,'a fresh device, the round-start cinematic is playing',r);
  console.log('1) nothing below capacity, nothing during a cinematic');
  await ev(p,()=>{__heads.P.carry=__CFG.tankCap-1;});await step(p,0.6);r=await st(p);
  ok(r.n===0&&!r.full&&!r.go&&!r.pend&&r.say===0&&!r.lleno,'59 / 60: nothing',r);
  await ev(p,()=>{__heads.P.carry=__CFG.tankCap;});await step(p,1.0);r=await st(p);
  ok(r.cine&&r.full&&r.pend&&r.n===0&&!r.go&&r.say===0&&!r.trail&&!r.msgTk,'full during the cinematic: waits (no title, voice, trail or message)',r);
  for(let i=0;i<12&&(await ev(p,()=>__heads.CINE.on));i++)await step(p,0.6);
  await ev(p,()=>__tkLib.clear());
  r=await st(p);
  console.log('2) the first time on the device');
  ok(!r.cine&&r.log==='big'&&!r.pend,'the cinematic ends: the big notice fires',{log:r.log,cine:r.cine});
  ok(r.go&&r.tl==='¡TANQUE LLENO!'&&r.ts==='Llévalo a la BODEGA de la nave','title «¡TANQUE LLENO!» + «Llévalo a la BODEGA de la nave» (real text)',{tl:r.tl,ts:r.ts});
  ok(r.say===1&&r.sayLog,'the pilot says it (voice key tank_full requested from say())',{say:r.say,sayLog:r.sayLog});
  ok(r.bodTk&&!r.bodHidden,'the hold marker pulses (#hBod.tk)',{tk:r.bodTk,hidden:r.bodHidden});
  ok(r.trail&&r.lit>=8,'the cyan trail is on (beads lit)',{trail:r.trail,lit:r.lit});
  ok(r.flash>0,'the backpack screen flashes (uFlash)',{flash:r.flash});
  ok(!/Tanque lleno/i.test(r.tut),'no tutorial card «Tanque lleno» on top of it',{tut:r.tut});
  ok(r.seen==='1','remembered on the device (heads_tank_seen)',{seen:r.seen});
  {const q=await ev(p,()=>__tkLib.titleBox());ok(q.bot<=q.crossTop+2&&q.top>=q.msgTop+40&&q.l>=0&&q.r<=q.W,'the title sits under the message line and above the crosshair',q);}
  r0=r;await step(p,0.5);r=await st(p);
  ok(!r.cine&&r.playT-r0.playT>0.4,'the game is not paused (play time runs)',{dPlay:+(r.playT-r0.playT).toFixed(2)});
  r=await ev(p,()=>{const o={},T=__THREE,P=__heads.P,p0=P.pos.clone();
    for(const [k,v] of [['nose',[0,6,30]],['other side',[-11,1,2]],['above',[0,9,-4]],['under the wing',[9,-4,-9]],['behind',[3,2,-34]],['far',[30,12,40]]])o[k]=__tkLib.pathCheck(v);
    P.pos.copy(p0);__tank.path();return o;});
  ok(Object.values(r).every(o=>o.hits===0&&o.end<0.8),'the trail goes round the hull, nacelles and wings and ends at the hold (6 places)',r);
  r=await st(p);ok(r.lbl==='BODEGA LLENO · DESCARGAR'&&r.lleno,'marker label «BODEGA / LLENO · DESCARGAR» while full',{lbl:r.lbl});
  await step(p,3.4);r=await st(p);
  ok(!r.trail&&r.big===0&&!r.bodTk,'about 4 s later: trail gone, title time over, marker back to its usual pulse',{trail:r.trail,big:r.big,bodTk:r.bodTk,pulse:r.pulse});
  await p.waitForTimeout(3300);r=await st(p);ok(!r.go,'the title has gone (animation over)',{go:r.go});
  await snapFirst(p,'tanque_pc_primera.png');
  await ev(p,()=>__tkLib.place(-0.35));await step(p,0.6);await snap(p,'tanque_pc_marcador.png');
  console.log('3) the nozzle refuses while full');
  await ev(p,()=>{__tkLib.far();});await step(p,0.2);
  r0=await ev(p,()=>{const n=__tkLib.nozzle(),P=__heads.P;__heads.spawnLoose(n.clone().addScaledVector(P._nd,1.0),24,0.1);__heads.inp.suck=true;return __tkLib.st();});
  await step(p,1.2);r=await st(p);await ev(p,()=>{__heads.inp.suck=false;});
  ok(r.carry===60&&r.cap===0&&r.loose===r0.loose,'right click with a full tank: nothing is pulled in (carry 60, nothing in the stream, the trichomes stay out)',{carry:r.carry,cap:r.cap,loose:[r0.loose,r.loose]});
  ok(r.rej-r0.rej>=2&&r.rej-r0.rej<=4,'the nozzle coughs (gas + sparks), throttled (every 0.45 s)',{rej:r.rej-r0.rej});
  console.log('4) not full: nothing');
  await unload(p);r=await st(p);
  ok(!r.full&&!r.lleno&&r.lbl==='BODEGA DEPOSITAR','unloaded: the marker reads «BODEGA / DEPOSITAR» again',{lbl:r.lbl});
  r0=await ev(p,()=>{__heads.P.carry=20;__heads.inp.suck=true;return __tkLib.st();});await step(p,0.6);r=await st(p);await ev(p,()=>{__heads.inp.suck=false;});
  ok(r.rej===r0.rej&&r.n===r0.n&&r.carry>20&&r.carry<60,'vacuuming with room: it pulls, no refusal, no notice',{carry:r.carry,rej:r.rej-r0.rej});
  await unload(p);await step(p,6);
  console.log('5) the next fill: the short notice');
  r0=await st(p);r=await fill(p);r=await waitShort(p);
  ok(/big,short$/.test(r.log)&&!r.go&&r.big===0,'no big title the second time',{log:r.log,go:r.go});
  ok(r.msgTk&&/TANQUE LLENO · ve a la bodega/.test(r.msg),'«TANQUE LLENO · ve a la bodega» on the message line, in cyan',{msg:r.msg,tk:r.msgTk});
  ok(r.bodTk,'the marker pulses',{bodTk:r.bodTk,hidden:r.bodHidden,nest:r.nest,pulse:r.pulse,at:r.at,playT:r.playT});
  ok(r.say===1,'no voice (it spoke in the last full event)',{say:r.say});
  await ev(p,()=>__tkLib.place());await step(p,0.1);await snap(p,'tanque_pc_corto.png');await ev(p,()=>__tkLib.far());
  console.log('6) the reminder');
  const lastAt=async()=>{const x=await st(p);const at=x.at.split(',').map(Number);return {x,t:at[at.length-1]};};
  const stepTo=async t=>{const now=(await st(p)).playT;if(t>now)await step(p,t-now);return st(p);};
  let q=await lastAt();const tS=q.t;ok(/short$/.test(q.x.log),'(the short notice is the last one)',{log:q.x.log,at:q.x.at});
  r=await stepTo(tS+19.4);ok(/short$/.test(r.log),'still quiet 19.4 s after it',{log:r.log,at:r.at,playT:r.playT});
  r=await stepTo(tS+20.4);ok(/short,remind$/.test(r.log)&&r.bodTk&&r.msgTk,'about 20 s full without unloading: a reminder (marker pulse + short notice)',{log:r.log,at:r.at,bodTk:r.bodTk});
  q=await lastAt();const tR=q.t;ok(Math.abs(tR-tS-20)<0.2,'… 20 s after the notice',{dt:+(tR-tS).toFixed(2)});
  r=await stepTo(tR+21.4);ok(/short,remind$/.test(r.log),'not again before 22 s',{log:r.log,at:r.at});
  r=await stepTo(tR+22.4);ok(/short,remind,remind$/.test(r.log),'and again ~22 s later',{log:r.log,at:r.at});
  ok(r.say===1,'no voice in the reminders here (the event before spoke)',{say:r.say});
  console.log('7) the voice rule');
  await unload(p);await ev(p,()=>{__T.playT+=95;});r=await fill(p);
  ok(r.say===2&&/short$/.test(r.log),'95 s later, after a full event without voice: the voice plays again',{say:r.say,log:r.log});
  await unload(p);await step(p,9);r=await fill(p);
  ok(r.say===2&&/short,short$/.test(r.log),'the next full event: no voice (it spoke in the last one)',{say:r.say,log:r.log});
  await unload(p);await step(p,1);r0=await st(p);r=await fill(p);
  ok(/gap$/.test(r.log)&&r.n===r0.n&&r.bodTk,'filled again 1 s after a notice: only the marker pulses',{log:r.log});
  ok(p.errs.length===0,'no page errors (pc)',p.errs.slice(0,4));
  await p.context().close();}

 // ================================================================ phone, ES
 if(ONLY.includes('phone')){console.log('===== phone ES');
  const p=await open('phone');
  await ev(p,()=>{__tkLib.clear();__tkLib.place();});await step(p,0.3);
  r=await fill(p);
  ok(r.log==='big'&&r.go&&r.tl==='¡TANQUE LLENO!'&&r.ts==='Toca BODEGA y te lleva','first time: title + the touch line «Toca BODEGA y te lleva»',{log:r.log,tl:r.tl,ts:r.ts});
  ok(r.say===1&&r.bodTk&&r.trail&&r.lit>=8&&r.flash>0&&r.seen==='1','voice, marker pulse, trail, flash, remembered',{say:r.say,bodTk:r.bodTk,trail:r.trail,lit:r.lit,flash:r.flash,seen:r.seen});
  r=await ev(p,()=>__tkLib.titleBox());
  ok(r.bot<=r.crossTop+2&&r.l>=0&&r.r<=r.W&&r.top>=r.alertBot-2,'the title sits between the alert line and the crosshair, inside the screen',r);
  await step(p,0.4);r=await st(p);
  console.log('tap BODEGA: the reminder clock stops while it flies you there');
  const bx=await ev(p,()=>{const e=document.getElementById('hBod'),q=e.getBoundingClientRect();return e.hidden?null:{x:q.left+q.width/2,y:q.top+q.height/2};});
  if(bx){await p.touchscreen.tap(bx.x,bx.y);await step(p,0.1);}
  r0=await ev(p,()=>({ap:!!(__TC.ap&&__TC.ap.hatch),remT:__tank.TK.remT}));ok(r0.ap,'tapping the marker starts the flight to the hold',r0);
  await step(p,0.8);r=await ev(p,()=>({ap:!!(__TC.ap&&__TC.ap.hatch),remT:__tank.TK.remT,dep:__heads.P.depActive}));ok(r.ap&&r.remT===r0.remT,'no reminder time counted while flying there',{before:r0.remT,after:r.remT,ap:r.ap});
  await ev(p,()=>{__TC.ap=null;__tkLib.far();});await step(p,3.5);
  await snapFirst(p,'tanque_phone_primera.png');
  await ev(p,()=>__tkLib.place(-0.35));await step(p,0.6);await snap(p,'tanque_phone_marcador.png');
  await ev(p,()=>__tkLib.far());
  console.log('auto-suction near trichomes is refused');
  r0=await ev(p,()=>{const P=__heads.P;__heads.spawnLoose(P.pos.clone().add(new __THREE.Vector3(1.5,0,-1.5)),20,0.1);return __tkLib.st();});
  await step(p,1.2);r=await st(p);
  ok(r.carry===60&&r.cap===0&&r.loose===r0.loose&&r.rej-r0.rej>=2,'full: nothing pulled in, the nozzle coughs',{carry:r.carry,cap:r.cap,rej:r.rej-r0.rej});
  await unload(p);await step(p,9);
  r=await fill(p);r=await waitShort(p);
  ok(/big,short$/.test(r.log)&&!r.go,'next fill: the short notice, no title',{log:r.log});
  ok(r.alertOn&&r.alertTk&&/TANQUE LLENO · ve a la bodega/.test(r.alert)&&/Toca BODEGA y te lleva/.test(r.alert),'on the alert line (v63), cyan: «TANQUE LLENO · ve a la bodega» / «Toca BODEGA y te lleva»',{alert:r.alert,on:r.alertOn});
  ok(r.bodTk&&r.say===1,'marker pulse, no voice',{bodTk:r.bodTk,say:r.say});
  await ev(p,()=>{__tkLib.place();document.getElementById('mAlert').style.opacity='1';});await step(p,0.1);await snap(p,'tanque_phone_corto.png');await ev(p,()=>{document.getElementById('mAlert').style.opacity='';});
  ok(p.errs.length===0,'no page errors (phone)',p.errs.slice(0,4));
  await p.context().close();}

 // ================================================================ PC, EN
 if(ONLY.includes('pc-en')){console.log('===== pc EN');
  const p=await open('pc',{lang:'en'});
  await ev(p,()=>{__tkLib.clear();__tkLib.far();});await step(p,0.3);
  r=await fill(p);
  ok(r.log==='big'&&r.tl==='TANK FULL!'&&r.ts==="Take it to the ship's HOLD",'title «TANK FULL!» + «Take it to the ship\'s HOLD»',{tl:r.tl,ts:r.ts});
  ok(r.lbl==='HOLD FULL · UNLOAD','marker «HOLD / FULL · UNLOAD»',{lbl:r.lbl});
  await snapFirst(p,'tanque_pc_en_primera.png');
  await unload(p);r=await st(p);ok(r.lbl==='HOLD DEPOSIT','back to «HOLD / DEPOSIT»',{lbl:r.lbl});
  await step(p,9);r=await fill(p);r=await waitShort(p);
  ok(r.msgTk&&/TANK FULL · go to the hold/.test(r.msg),'short notice «TANK FULL · go to the hold»',{msg:r.msg});
  ok(p.errs.length===0,'no page errors (pc-en)',p.errs.slice(0,4));
  await p.context().close();}

 // ================================================================ phone, EN, ?tanque on a device that has seen it
 if(ONLY.includes('phone-en')){console.log('===== phone EN ?tanque (device has seen it)');
  const p=await open('phone',{lang:'en',seen:true,query:'?q=3&tanque'});
  await ev(p,()=>{__tkLib.clear();__tkLib.far();});await step(p,0.3);
  r=await fill(p);
  ok(r.log==='big'&&r.tl==='TANK FULL!'&&r.ts==='Tap HOLD and it takes you there','?tanque: the big notice although the device has seen it, touch line in English',{log:r.log,tl:r.tl,ts:r.ts});
  await unload(p);await step(p,9);r=await fill(p);
  ok(r.log==='big,big'&&r.say===2,'?tanque: the big notice again on the next fill',{log:r.log,say:r.say});
  ok(r.seen==='1','nothing else remembered (still «1»)',{seen:r.seen});
  ok(p.errs.length===0,'no page errors (phone-en)',p.errs.slice(0,4));
  await p.context().close();}

 // ================================================================ PC, ES, a device that has seen it
 if(ONLY.includes('pc-seen')){console.log('===== pc ES, device has seen it');
  const p=await open('pc',{seen:true});
  await ev(p,()=>{__tkLib.clear();__tkLib.far();});await step(p,0.3);
  r=await fill(p);r=await waitShort(p);
  ok(r.log==='short'&&!r.go&&!r.trail&&r.msgTk,'first fill of this game: the short notice only (no title, no trail)',{log:r.log,go:r.go,trail:r.trail});
  ok(r.say===1,'the first full event of the game may speak (voice rule)',{say:r.say});
  ok(p.errs.length===0,'no page errors (pc-seen)',p.errs.slice(0,4));
  await p.context().close();}

 global.__fin=1;await b.close();
 console.log(bad?`${bad} FAILED`:'ALL OK');process.exit(bad?1:0);
})();
