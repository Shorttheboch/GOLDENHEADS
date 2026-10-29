// Every file the game asks for arrives (no 404), and sounds, voices and art decode, in Spanish and English, PC and phone. Run on dist-test.
const {chromium}=require('playwright');
const {BASE,ARGS,shot}=require('./lib.cjs');
(async()=>{
 const b=await chromium.launch({args:ARGS});
 for(const [lang,touch] of [['es',false],['en',false],['es',true]]){
  const ctx=await b.newContext(touch?{viewport:{width:844,height:390},isMobile:true,hasTouch:true}:{viewport:{width:1280,height:720}});const p=await ctx.newPage();
  const errs=[],bad=[],got={};p.on('pageerror',e=>errs.push(e.message));
  p.on('response',r=>{const u=r.url();if(r.status()>=400)bad.push(r.status()+' '+u);const m=u.match(/\/assets\/([^?]*)/);if(m){const k=m[1].split('/').slice(0,m[1].includes('/')?(m[1].startsWith('ui/')||m[1].startsWith('vo/')?2:1):1).join('/');got[k]=(got[k]||0)+1;}});
  p.on('requestfailed',r=>{if(!/fonts\.g/.test(r.url()))bad.push('failed '+r.url());});
  await p.addInitScript(l=>{window.__lang=l;},lang);
  await p.goto(BASE+'/test.html');
  await p.waitForFunction(()=>document.getElementById('play')&&!document.getElementById('play').disabled,null,{timeout:300000});
  await p.evaluate(()=>document.getElementById('play').click());await p.evaluate(()=>{window.__noRender=1;__step(20);window.__noRender=0;});await p.waitForTimeout(8000);
  const info=await p.evaluate(()=>{const S=window.__SFXB&&__SFXB();const css=getComputedStyle(document.documentElement);
    return {sfxKeys:S?Object.keys(S).length:-1,sfxBufs:S?Object.values(S).reduce((n,v)=>n+(Array.isArray(v)?v.length:1),0):-1,vo:__VO().n,
      mira:css.getPropertyValue('--mira').slice(0,60),dash:!!document.getElementById('dBase').naturalWidth,
      mobMenu:document.getElementById('mmLImg')?document.getElementById('mmLImg').naturalWidth:null,text:document.getElementById('menuGo')?document.getElementById('menuGo').textContent:''};});
  console.log(lang,touch?'phone':'pc',JSON.stringify(info));
  console.log('  files by folder',JSON.stringify(got));
  console.log('  bad',JSON.stringify(bad.slice(0,10)),'errors',JSON.stringify(errs.slice(0,3)));
  await ctx.close();}
 await b.close();})();
