// v100 (not a test): photos of «HEADS» on the spine of the ship as the game draws it (same materials and environment light as the character sheets of
// tools/tests/ficha.cjs on the ficha branch): the game's own camera, then the ship alone from the left side, from above and close up.
// Writes out/letras_<TAG>_<view>.jpg. Uses the real 4K ship (the request for ship_test.glb is answered with public/assets/models/ship.glb, or $SHIP).
// Needs a graphics card: in a software renderer the 4K maps crash the page.
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');const {BASE,ARGS,shot,lateReady,ROOT}=require('./lib.cjs');
const PX=+(process.env.HEADS_FICHA_PX||2560),DPR=2,VP=Math.round(PX/DPR);
const DIR=process.argv[2]||process.env.HEADS_DIR||'dist-test';
(async()=>{const b=await chromium.launch({args:ARGS});
 const ctx=await b.newContext({viewport:{width:VP,height:VP},deviceScaleFactor:DPR});const p=await ctx.newPage();
 p.on('pageerror',e=>console.log('ERR',e.message));
 const shipFile=process.env.SHIP||path.join(ROOT,'public','assets','models','ship.glb');console.log('ship file',shipFile);
 await p.route(/ship_test\.glb/,r=>r.fulfill({status:200,contentType:'model/gltf-binary',body:fs.readFileSync(shipFile)}));
 await p.addInitScript(()=>{window.__lang='es';window.__grain=0.012;});
 await p.goto(BASE+'/test.html');
 await p.waitForFunction(()=>document.getElementById('play')&&!document.getElementById('play').disabled,null,{timeout:300000});
 await lateReady(p);
 await p.evaluate(()=>document.getElementById('play').click());
 await p.waitForFunction(()=>window.__T&&__T.state==='play',null,{timeout:120000});
 await p.evaluate(()=>__step(60));
 // the game's own camera, HUD hidden
 await p.evaluate(()=>{for(const el of document.querySelectorAll('body>*:not(canvas)'))el.style.visibility='hidden';});
 {const d=await p.evaluate(()=>{__composer.render();return __composer.renderer.domElement.toDataURL('image/jpeg',0.92);});fs.writeFileSync(shot('letras_'+(process.env.TAG||'x')+'_juego.jpg'),Buffer.from(d.split(',')[1],'base64'));}
 // the game scene (its sky, sun and bloom) seen from a few places a player looks from: behind the astronaut on the spine, beside the ship, above it
 for(const [n,pos,at] of [['juego_lomo',[3.5,7.5,13],[0,3.6,0]],['juego_lado',[16,6,4],[0,3,0.5]],['juego_arriba',[-6,16,-14],[0,3.5,1]]]){
  const d=await p.evaluate(({pos,at})=>{window.__manual=1;window.__noRender=1;const c=__composer.passes[0].camera;c.position.set(...pos);c.lookAt(...at);c.updateMatrixWorld(true);
    __composer.render();return __composer.renderer.domElement.toDataURL('image/jpeg',0.92);},{pos,at});
  fs.writeFileSync(shot('letras_'+(process.env.TAG||'x')+'_'+n+'.jpg'),Buffer.from(d.split(',')[1],'base64'));}
 await p.evaluate(()=>{for(const el of document.querySelectorAll('body>*:not(canvas)'))el.style.visibility='';});
 await p.evaluate(()=>{const H=__heads;window.__noSpawn=1;__T.toSpawn=0;for(const s of [...H.spiders])H.killSpider(s);});
 await p.evaluate(()=>__step(40));
 // ---- studio
 await p.evaluate(()=>{const THREE=__THREE,r=__composer.renderer,G=window.__GRADE;window.__manual=1;window.__noRender=1;
  for(const el of document.querySelectorAll('body>*:not(canvas)'))el.style.visibility='hidden';
  G.uniforms.uVig.value=0.1;G.uniforms.uCA.value=0;G.uniforms.uGrain.value=0.01;
  const S=new THREE.Scene();S.environment=__scene.environment;S.environmentIntensity=__scene.environmentIntensity??1;
  const c=document.createElement('canvas');c.width=16;c.height=512;const g=c.getContext('2d');const gr=g.createLinearGradient(0,0,0,512);
  gr.addColorStop(0,'#1b1a22');gr.addColorStop(0.55,'#0d0d12');gr.addColorStop(1,'#060608');g.fillStyle=gr;g.fillRect(0,0,16,512);
  const bg=new THREE.CanvasTexture(c);bg.colorSpace=THREE.SRGBColorSpace;S.background=bg;
  const key=new THREE.DirectionalLight(0xfff0dc,3.0),fill=new THREE.DirectionalLight(0xa9bcff,1.0),rim=new THREE.DirectionalLight(0xffd6a0,2.4),amb=new THREE.HemisphereLight(0x8e88aa,0x1a1612,0.35);
  key.castShadow=true;key.shadow.mapSize.set(4096,4096);key.shadow.bias=-0.0004;key.shadow.normalBias=0.02;
  S.add(key,key.target,fill,fill.target,rim,rim.target,amb);
  const cam=new THREE.PerspectiveCamera(26,1,0.01,500);
  window.__ST={S,key,fill,rim,cam,pivot:null};
  __composer.passes[0].scene=S;__composer.passes[0].camera=cam;
 });
 const shotOf=async(name,{target,dir,dist,fov=26,up=null,lightFrom=null})=>{
  const data=await p.evaluate(({target,dir,dist,fov,up,lightFrom})=>{const THREE=__THREE,{S,key,fill,rim,cam}=__ST;
    const t=new THREE.Vector3(...target),d=new THREE.Vector3(...dir).normalize();cam.fov=fov;cam.aspect=1;cam.near=Math.max(0.01,dist/200);cam.far=dist*20;
    cam.position.copy(t).addScaledVector(d,dist);cam.up.set(...(up||[0,1,0]));cam.lookAt(t);cam.updateProjectionMatrix();cam.updateMatrixWorld(true);
    // lights follow the camera: key from front-left-above, fill from the right, rim from behind
    const right=new THREE.Vector3().crossVectors(d,new THREE.Vector3(0,1,0));if(right.lengthSq()<1e-4)right.set(1,0,0);right.normalize();
    const R=__ST.radius||2;const place=(L,v)=>{L.position.copy(t).addScaledVector(v.normalize(),R*4);L.target.position.copy(t);L.target.updateMatrixWorld();};
    place(key,d.clone().multiplyScalar(0.8).addScaledVector(right,-0.75).add(new THREE.Vector3(0,0.9,0)));
    place(fill,d.clone().multiplyScalar(0.6).addScaledVector(right,0.9).add(new THREE.Vector3(0,0.15,0)));
    place(rim,d.clone().multiplyScalar(-1).add(new THREE.Vector3(0,0.7,0)).addScaledVector(right,0.3));
    const sc=key.shadow.camera;sc.left=-R*1.2;sc.right=R*1.2;sc.top=R*1.2;sc.bottom=-R*1.2;sc.near=R*0.5;sc.far=R*8;sc.updateProjectionMatrix();
    __composer.render();return __composer.renderer.domElement.toDataURL('image/jpeg',0.93);},{target,dir,dist,fov,up,lightFrom});
  fs.writeFileSync(shot('letras_'+(process.env.TAG||'x')+'_'+name+'.jpg'),Buffer.from(data.split(',')[1],'base64'));console.log('ficha_'+name);};
 // directions around a subject: forward f (horizontal), side = f x up
 const around=(f,deg,el=6)=>{const a=deg*Math.PI/180,e=el*Math.PI/180;const fx=f[0],fz=f[2];const sx=-fz,sz=fx; // right-hand side
   const x=fx*Math.cos(a)+sx*Math.sin(a),z=fz*Math.cos(a)+sz*Math.sin(a);return [x*Math.cos(e),Math.sin(e),z*Math.cos(e)];};
 const fit=(h,fov=26)=>h/2/Math.tan(fov*Math.PI/360)*1.18;

 // ======== ship
 const SH=await p.evaluate(()=>{const THREE=__THREE,{S}=__ST;let o=__scene.getObjectByName('SM_HEADS_Ship_Body');if(!o)return null;while(o.parent&&o.parent!==__scene)o=o.parent;
   S.attach(o);o.traverse(m=>{if(m.isMesh){m.castShadow=true;m.receiveShadow=true;for(const mt of [].concat(m.material))for(const k of ['map','normalMap','roughnessMap','metalnessMap','aoMap'])if(mt[k]){mt[k].anisotropy=8;mt[k].needsUpdate=true;}}});
   o.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(o);const c=box.getCenter(new THREE.Vector3()),s=box.getSize(new THREE.Vector3());
   __ST.radius=Math.max(s.x,s.y,s.z)*0.6;__ST.key.shadow.mapSize.set(4096,4096);return {c:c.toArray(),s:s.toArray()};});
 console.log('ship',JSON.stringify(SH));
 if(SH){const [X,Y,Z]=SH.s;
  await shotOf('tres_cuartos',{target:SH.c,dir:[0.72,0.36,0.7],dist:fit(Z*0.82*0.92)});
  await shotOf('arriba',{target:SH.c,dir:[0.001,1,0.001],dist:fit(Math.max(X,Z)*0.92),up:[0,0,1]});
  await shotOf('lomo',{target:[0,3.4,0.5],dir:[0.75,0.6,0.35],dist:fit(15)});
  await shotOf('detalle',{target:[0.2,3.75,2.6],dir:[0.5,0.75,0.4],dist:fit(4.5)});
  await shotOf('detalle_d',{target:[0,3.77,-3.2],dir:[0.35,0.9,-0.2],dist:fit(3.2)});}
 await b.close();console.log('done');})();
