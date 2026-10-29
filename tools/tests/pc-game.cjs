// PC: a full game with the test hooks (rounds, eating, welding, delivering, losing the ship, restart). Run on dist-test.
const {chromium}=require('playwright');
const {BASE,ARGS,shot}=require('./lib.cjs');
(async()=>{
 const b=await chromium.launch({args:ARGS});
 const p=await b.newPage({viewport:{width:960,height:540}});
 const logs=[];p.on('console',m=>{if(m.type()==='error'||m.type()==='warning')logs.push(m.type()+': '+m.text())});p.on('pageerror',e=>logs.push('PAGEERR '+e.message+'\n'+e.stack));
 await p.goto(BASE+'/test.html');
 await p.waitForFunction(()=>document.getElementById('play')&&!document.getElementById('play').disabled,null,{timeout:180000});
 await p.evaluate(()=>document.getElementById('play').click());
 const H=()=>p.evaluate(()=>({st:__T.state,wave:__T.wave,brk:__T.inBreak,score:__T.score,cargo:__T.cargo,carry:__heads.P.carry,hp:Math.round(__heads.P.hp),
   zones:__T.ZONES.map(Z=>Z.name[0]+Math.round(Z.patches.reduce((s,p)=>s+p.hp,0))+(Z.nest?'N':'')+(Z.eaters?'*'+Z.eaters:'')).join(' '),
   sp:__heads.spiders.map(s=>s.kind.slice(0,2)+':'+s.state).join(' '),loose:document.getElementById('cargoLine').textContent,rep:__T.repairs,pts:__heads.pts,calm:__heads.WB.calm,tut:document.getElementById('tut').textContent.slice(0,40),round:document.getElementById('round').textContent}));
 const step=s=>p.evaluate(n=>__step(n),Math.round(s/0.05));
 const god=()=>p.evaluate(()=>{__heads.P.hp=100;__heads.P.inv=0.5;});
 const killAll=()=>p.evaluate(()=>{for(const s of [...__heads.spiders])__heads.killSpider(s);});
 await step(1);console.log('t0',JSON.stringify(await H()));
 // round 1: clear it
 for(let k=0;k<40;k++){await god();await killAll();await step(0.5);const h=await H();if(h.brk){console.log('r1 clear',JSON.stringify(h));break;}}
 await p.evaluate(()=>{__T.skip=true;});await step(0.2);console.log('r2 start',JSON.stringify(await H()));
 // round 2: let them eat, astronaut parked far away
 await p.evaluate(()=>{__heads.P.pos.set(0,25,40);});
 for(let k=0;k<6;k++){await god();await p.evaluate(()=>{__heads.P.pos.set(0,25,40);__heads.P.vel.set(0,0,0);});await step(3);console.log('eat',k,JSON.stringify(await H()));}
 // picture of the chewed hull
 await p.evaluate(()=>{const pa=__T.PATCHES.filter(p=>p.hp<25).sort((a,b)=>a.hp-b.hp)[0];window.__pa=pa;const P=__heads.P;
   P.pos.copy(pa.pos).addScaledVector(pa.n,2.6);P.vel.set(0,0,0);const d=pa.pos.clone().sub(P.pos);P.yaw=Math.atan2(-d.x,-d.z);P.pitch=Math.atan2(d.y,Math.hypot(d.x,d.z));});
 await step(0.6);await p.evaluate(()=>{window.__manual=1;});await p.waitForTimeout(300);await p.evaluate(()=>requestAnimationFrame(()=>__render()));await p.waitForTimeout(300);
 await p.screenshot({path:shot('pc_eat.png'),timeout:180000});await p.evaluate(()=>{window.__manual=0;});
 await killAll();await step(0.3);
 // repair by holding F
 await p.evaluate(()=>{const pa=window.__pa;const P=__heads.P;P.pos.copy(pa.pos).addScaledVector(pa.n,2.2);P.vel.set(0,0,0);});
 const r0=await H();await p.keyboard.down('KeyF');await step(1.0);
 await p.evaluate(()=>{window.__manual=1;});await p.waitForTimeout(300);await p.evaluate(()=>__render());await p.screenshot({path:shot('pc_weld.png'),timeout:180000});await p.evaluate(()=>{window.__manual=0;});
 await step(2.5);await p.keyboard.up('KeyF');await step(0.1);console.log('repair hold',r0.rep,'->',JSON.stringify(await H()));
 // perfect: release inside band
 const ok=await p.evaluate(()=>{const pa=__T.PATCHES.find(p=>p.hp<25);if(!pa)return 'none';window.__pa=pa;const P=__heads.P;P.pos.copy(pa.pos).addScaledVector(pa.n,2.2);P.vel.set(0,0,0);return pa.hp;});
 console.log('next patch hp',ok);
 if(ok!=='none'){await p.keyboard.down('KeyF');await step(0.1);
   await p.evaluate(()=>{const R=__T.R;if(R.pa)R.pa.prog=R.band+0.05;});await p.keyboard.up('KeyF');await step(0.1);console.log('perfect?',JSON.stringify(await H()));}
 // delivery
 await p.evaluate(()=>{__heads.P.carry=30;__heads.P.pos.copy(__T.HATCH).add({x:1.4,y:0,z:0});__heads.P.vel.set(0,0,0);});const c0=(await H()).cargo;await step(1.5);
 console.log('deliver',c0,'->',(await H()).cargo);
 // finish round 2 and check score
 for(let k=0;k<60;k++){await god();await killAll();await step(0.5);const h=await H();if(h.brk){console.log('r2 clear',JSON.stringify(h));break;}}
 // play several more rounds quickly to see the curve
 for(let r=0;r<4;r++){await p.evaluate(()=>{__T.skip=true;});await step(0.2);
   for(let k=0;k<80;k++){await god();await killAll();await step(0.5);const h=await H();if(h.brk||h.st!=='play'){console.log('round',h.wave+1,JSON.stringify(h));break;}}}
 // ship lost
 await p.evaluate(()=>{__T.skip=true;for(const pa of __T.PATCHES)pa.hp=0.3;});await step(0.3);
 await p.evaluate(()=>{__heads.P.pos.set(0,25,40);});
 for(let k=0;k<90;k++){await god();await step(0.5);const h=await H();if(h.st!=='play'){console.log('end',JSON.stringify(h));break;}}
 console.log('endT',await p.evaluate(()=>document.getElementById('endT').textContent+' | '+document.getElementById('endS').textContent+' | '+document.getElementById('record').textContent));
 await p.waitForTimeout(400);await p.screenshot({path:shot('pc_end.png'),timeout:180000});
 await p.keyboard.press('Enter');await step(0.3);console.log('restart',JSON.stringify(await H()));
 console.log(logs.filter(l=>!/fonts|ERR_TUNNEL|net::|GPU stall|swiftshader/i.test(l)).slice(0,20).join('\n'));
 await b.close();})();
