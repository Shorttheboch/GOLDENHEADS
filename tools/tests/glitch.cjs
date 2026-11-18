// diagnostic (v93): does the game itself ever draw a black block into its canvas (bottom-left part of the picture)? Reads the canvas back right
// after every frame, on the menu and in a round, while the quality level and the window size change all the time. Prints what it finds.
const {chromium}=require('playwright');const fs=require('fs'),path=require('path');
const {BASE,ARGS,OUT}=require('./lib.cjs');
const INIT=()=>{const raf=window.requestAnimationFrame.bind(window),G=window.__gl={on:0,n:0,bad:[],prev:null,shots:[]};
  window.requestAnimationFrame=cb=>raf(ts=>{cb(ts);if(!G.on)return;const r=window.__composer&&window.__composer.renderer;if(!r)return;
    const gl=r.getContext(),W=gl.drawingBufferWidth,H=gl.drawingBufferHeight,NX=16,NY=12,px=new Uint8Array(4),L=[];
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    for(let j=0;j<NY;j++)for(let i=0;i<NX;i++){gl.readPixels(Math.floor((i+0.5)/NX*W),Math.floor((j+0.5)/NY*H),1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);L.push(px[0]+px[1]+px[2]);}
    // cells that are pure black now and were not in the last frame; a block = many of them at once
    let nb=0,minI=99,maxI=-1,minJ=99,maxJ=-1;if(G.prev&&G.prev.length===L.length)for(let k=0;k<L.length;k++)if(L[k]===0&&G.prev[k]>6){nb++;const i=k%NX,j=(k/NX)|0;minI=Math.min(minI,i);maxI=Math.max(maxI,i);minJ=Math.min(minJ,j);maxJ=Math.max(maxJ,j);}
    const zero=L.filter(v=>v===0).length;
    if(nb>=12||zero>=L.length*0.2){G.bad.push({n:G.n,nb,zero,box:[minI,maxI,minJ,maxJ],W,H,lvl:window.__QA.lvl,tag:G.tag});if(G.shots.length<4)G.shots.push(r.domElement.toDataURL('image/jpeg',0.7));}
    G.prev=L;G.n++;});};
(async()=>{
 const b=await chromium.launch({args:ARGS});
 for(const [w,h] of [[1570,1270],[3440,1215]]){
   const ctx=await b.newContext({viewport:{width:w,height:h}}),p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
   await p.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());await p.addInitScript(INIT);
   await p.goto(BASE+'/test.html?ronda=6');
   await p.waitForFunction(()=>document.getElementById('play')&&!document.getElementById('play').disabled,null,{timeout:300000});
   const stress=async(tag,sec)=>{await p.evaluate(t=>{__gl.tag=t;__gl.prev=null;__gl.on=1;},tag);const t0=Date.now();let k=0;
     while(Date.now()-t0<sec*1000){await p.evaluate(l=>__qaSet(l),[0,1,3,2,5,0,4,1][k%8]);await p.waitForTimeout(260);
       if(k%5===4){await p.setViewportSize({width:w-(k%10===4?240:0),height:h-(k%10===4?130:0)});await p.waitForTimeout(200);}k++;}
     await p.evaluate(()=>{__gl.on=0;});};
   await stress('menu',14);
   await p.evaluate(()=>document.getElementById('play').click());await p.waitForFunction(()=>window.__T&&__T.state==='play',null,{timeout:120000});
   await p.evaluate(()=>{const P=__heads.P;setInterval(()=>{P.hp=100;P.inv=5;},200);});
   await stress('game',22);
   const r=await p.evaluate(()=>({n:__gl.n,bad:__gl.bad.slice(0,12),nbad:__gl.bad.length,shots:__gl.shots}));
   console.log(`${w}x${h}: ${r.n} frames read, ${r.nbad} with a black block`,JSON.stringify(r.bad),errs.length?'ERR '+errs[0]:'');
   fs.mkdirSync(OUT,{recursive:true});r.shots.forEach((s,i)=>fs.writeFileSync(path.join(OUT,`glitch_${w}_${i}.jpg`),Buffer.from(s.split(',')[1],'base64')));
   await ctx.close();}
 await b.close();})();
