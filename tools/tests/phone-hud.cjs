// Phone HUD (v62, Santi's design): mounts on touch, replaces the old phone HUD, follows the game, weld tap, pause, ES/EN. Run on dist-test.
// Screenshots: phone_hud_<lang>_<moment>.png
const {chromium}=require('playwright');
const {BASE,ARGS,shot}=require('./lib.cjs');
(async()=>{
 const b=await chromium.launch({args:ARGS});
 for(const lang of ['es','en']){
  const ctx=await b.newContext({viewport:{width:844,height:390},deviceScaleFactor:2,isMobile:true,hasTouch:true});const p=await ctx.newPage();
  const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.addInitScript(l=>{window.__lang=l;},lang);
  await p.goto(BASE+'/test.html?q=3');
  await p.waitForFunction(()=>{const g=document.getElementById('mmGo');return g&&!g.disabled;},null,{timeout:300000});
  const before=await p.evaluate(()=>({mounted:!!document.querySelector('.hudm'),hm:document.body.classList.contains('hm')}));
  await p.tap('#mmGo');
  const step=s=>p.evaluate(n=>__step(n),Math.round(s/0.05));
  const snap=async name=>{await p.evaluate(()=>{window.__manual=1;});await p.waitForTimeout(250);await p.evaluate(()=>__render());await p.waitForTimeout(350);
    await p.screenshot({path:shot('phone_hud_'+lang+'_'+name+'.png'),timeout:180000});await p.evaluate(()=>{window.__manual=0;});};
  const st=()=>p.evaluate(()=>{const q=id=>document.getElementById(id),cs=id=>getComputedStyle(q(id));
    return {hm:document.body.classList.contains('hm'),show:document.querySelector('.hudm').style.display!=='none',
      oldHidden:['hTop','hScore','hVit','hTank','cross','rep','sub','tPause'].every(id=>cs(id).display==='none'),
      suit:q('hud-suit-pc').textContent,ship:q('hud-ship-pc').textContent,tri:q('hud-tri-n').textContent,triFill:q('hud-tri-bar').style.getPropertyValue('--v'),
      fuga:q('hud-fuga').classList.contains('off')?'-':q('hud-fuga-t').textContent,resc:q('hud-resc').classList.contains('off')?'-':q('hud-resc-t').textContent,
      pts:q('hud-pts').textContent,rnd:q('hud-rnd').textContent,en:q('hud-en').textContent+' '+q('hud-en-l').textContent,kills:q('hud-kills').textContent,
      xh:q('hud-xh').className,weld:q('hud-weld').className,font:document.fonts.check('700 20px "Saira Condensed"'),
      game:{hp:Math.round(__heads.P.hp),cargo:__T.cargo,wave:__T.wave,brk:__T.inBreak,kills:__heads.stats?__heads.stats.kills:null}};});
  await step(0.5);console.log(lang,'mount',JSON.stringify(before),'->',JSON.stringify(await st()));
  // combat: hurt the suit, chew a plate, aim right at a spider
  await p.evaluate(()=>{__heads.P.hp=58;__heads.P.lastHit=1e9;const pa=__T.PATCHES[5];pa.hp=0;});
  await step(1.2);
  await p.evaluate(()=>{const s=__heads.spiders[0];if(!s)return;const P=__heads.P,c=__camera.position,d=s.mesh.position.clone().sub(c);P.yaw=Math.atan2(-d.x,-d.z);P.pitch=Math.atan2(d.y,Math.hypot(d.x,d.z));});
  await step(0.1);console.log(lang,'combat',JSON.stringify(await st()));await snap('a_combate');
  // a crew line in the subtitles
  await p.evaluate(()=>window.HUD.say('PILOTO','¡Capitán, nos atacan!',8000));await step(0.3);await snap('b_subtitulo');
  // welding next to a breach (the phone welds on its own while facing it)
  await p.evaluate(()=>{for(const s of [...__heads.spiders])__heads.killSpider(s);window.__noSpawn=1;const pa=__T.PATCHES[5];pa.hp=0;const P=__heads.P;
    P.pos.copy(pa.pos).addScaledVector(pa.n,2.0);P.vel.set(0,0,0);const d=pa.pos.clone().sub(P.pos);P.yaw=Math.atan2(-d.x,-d.z);P.pitch=Math.atan2(d.y,Math.hypot(d.x,d.z));window.__pa=pa;});
  await step(0.5);console.log(lang,'weld',JSON.stringify(await st()));await snap('c_soldando');
  // tap the weld bar inside the golden band = perfect weld
  const perf0=await p.evaluate(()=>__heads.stats.perfect);
  await p.evaluate(()=>{const R=__T.R;if(R.pa)R.pa.prog=R.band+0.02;});
  const wb=await p.evaluate(()=>{const r=document.getElementById('hud-weld').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2];});
  await p.touchscreen.tap(wb[0],wb[1]);await step(0.1);
  console.log(lang,'weld tap',JSON.stringify({perfect:[perf0,await p.evaluate(()=>__heads.stats.perfect)],patchHp:await p.evaluate(()=>Math.round(window.__pa.hp)),weld:await p.evaluate(()=>document.getElementById('hud-weld').className)}));
  // break between rounds: the enemies box shows the countdown
  for(let k=0;k<30;k++){await p.evaluate(()=>{for(const s of [...__heads.spiders])__heads.killSpider(s);__T.toSpawn=0;});await step(0.5);if(await p.evaluate(()=>__T.inBreak))break;}
  await step(0.5);console.log(lang,'break',JSON.stringify(await st()));await snap('d_respiro');
  // next round: big RONDA banner
  await p.evaluate(()=>{__T.skip=true;window.__noSpawn=0;});await step(0.6);console.log(lang,'next round',JSON.stringify(await st()));await snap('e_ronda');
  // pause button of the new HUD opens the pause menu
  const pb=await p.evaluate(()=>{const r=document.getElementById('hud-pause').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2];});
  await p.touchscreen.tap(pb[0],pb[1]);await p.waitForTimeout(400);
  console.log(lang,'pause',JSON.stringify(await p.evaluate(()=>({menu:!document.getElementById('tPauseM').hidden,paused:__TC.paused}))));await p.screenshot({path:shot('phone_hud_'+lang+'_f_pausa.png'),timeout:180000});
  await p.tap('#tPauseM [data-a=go]');await p.waitForTimeout(300);
  // end of the game: the HUD goes away with the end plate
  await p.evaluate(()=>{__heads.P.inv=0;__T.damagePlayer(999,new __THREE.Vector3(0,1,0));});for(let k=0;k<10;k++){await step(0.5);if(await p.evaluate(()=>__T.state)!=='play')break;}
  console.log(lang,'end',JSON.stringify(await p.evaluate(()=>({state:__T.state,hudShown:document.querySelector('.hudm').style.display!=='none'}))));
  console.log(lang,'errors',JSON.stringify(errs.slice(0,5)));
  await ctx.close();}
 await b.close();})();
