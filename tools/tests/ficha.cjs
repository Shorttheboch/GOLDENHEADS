// Character sheets (not a test): the astronaut, the normal spider and the ship as the game draws them (same models, materials, environment light and
// post-processing: bloom, grade), in a dark studio with key / fill / rim light, from several sides, plus close-ups of the faces and the guns.
// Writes out/ficha_<subject>_<view>.jpg (square, HEADS_FICHA_PX per side, 2560 by default). The test build is used for its hooks, but the ship is the
// real 4K one (the request for ship_test.glb is answered with ship.glb) and texture anisotropy goes back to 8. Best on a machine with a graphics card.
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');const {BASE,ARGS,shot,lateReady,ROOT}=require('./lib.cjs');
const PX=+(process.env.HEADS_FICHA_PX||2560),DPR=2,VP=Math.round(PX/DPR);
const DIR=process.argv[2]||process.env.HEADS_DIR||'dist-test';
(async()=>{const b=await chromium.launch({args:ARGS});
 const ctx=await b.newContext({viewport:{width:VP,height:VP},deviceScaleFactor:DPR});const p=await ctx.newPage();
 p.on('pageerror',e=>console.log('ERR',e.message));
 const shipFile=[path.join(ROOT,DIR,'assets','models','ship.glb'),path.join(ROOT,DIR,'assets','ship.glb'),path.join(ROOT,'public','assets','models','ship.glb')].find(f=>fs.existsSync(f));
 await p.route(/ship_test\.glb/,r=>r.fulfill({status:200,contentType:'model/gltf-binary',body:fs.readFileSync(shipFile)}));
 await p.addInitScript(()=>{window.__lang='es';window.__grain=0.012;});
 await p.goto(BASE+'/test.html');
 await p.waitForFunction(()=>document.getElementById('play')&&!document.getElementById('play').disabled,null,{timeout:300000});
 await lateReady(p);
 await p.evaluate(()=>document.getElementById('play').click());
 await p.waitForFunction(()=>window.__T&&__T.state==='play',null,{timeout:120000});
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
  fs.writeFileSync(shot('ficha_'+name+'.jpg'),Buffer.from(data.split(',')[1],'base64'));console.log('ficha_'+name);};
 // directions around a subject: forward f (horizontal), side = f x up
 const around=(f,deg,el=6)=>{const a=deg*Math.PI/180,e=el*Math.PI/180;const fx=f[0],fz=f[2];const sx=-fz,sz=fx; // right-hand side
   const x=fx*Math.cos(a)+sx*Math.sin(a),z=fz*Math.cos(a)+sz*Math.sin(a);return [x*Math.cos(e),Math.sin(e),z*Math.cos(e)];};
 const fit=(h,fov=26)=>h/2/Math.tan(fov*Math.PI/360)*1.18;

 // ======== astronaut
 const A=await p.evaluate(()=>{const THREE=__THREE,P=__heads.P,{S}=__ST,pis=window.__pistol;
   const piv=new THREE.Group();S.add(piv);piv.attach(P.rig);piv.attach(pis);__ST.pivot=piv;
   P.rig.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;}});pis.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
   const box=new THREE.Box3();P.model.updateMatrixWorld(true);const v=new THREE.Vector3();
   P.model.traverse(o=>{if(o.isSkinnedMesh){const pos=o.geometry.attributes.position;for(let i=0;i<pos.count;i+=7){o.getVertexPosition(i,v);o.localToWorld(v);box.expandByPoint(v);}}});
   const c=box.getCenter(new THREE.Vector3()),s=box.getSize(new THREE.Vector3());
   const f=new THREE.Vector3(0,0,1).applyQuaternion(pis.getWorldQuaternion(new THREE.Quaternion()));f.y=0;f.normalize();
   const head=new THREE.Vector3();P.bones.Head.getWorldPosition(head);
   const mz=new THREE.Vector3(0,0.0887,0.2).applyMatrix4(pis.matrixWorld); // middle of the gun
   const gz=new THREE.Vector3(0,0,1).applyQuaternion(pis.getWorldQuaternion(new THREE.Quaternion())).normalize();
   __ST.radius=Math.max(s.x,s.y,s.z)*0.6;
   return {c:c.toArray(),s:s.toArray(),f:f.toArray(),head:head.toArray(),gun:mz.toArray(),gz:gz.toArray()};});
 console.log('astro',JSON.stringify(A));
 const aH=Math.max(A.s[1],Math.hypot(A.s[0],A.s[2])*0.75);
 for(const [n,deg] of [['frente',0],['tres_cuartos',40],['lado_der',90],['espalda_tres_cuartos',140],['espalda',180],['lado_izq',270]])
   await shotOf('astronauta_'+n,{target:A.c,dir:around(A.f,deg),dist:fit(aH)});
 // helmet ("face"): the head bone sits low in the helmet
 const hd=[A.head[0],A.head[1]+0.09,A.head[2]];
 await shotOf('astronauta_casco_frente',{target:hd,dir:around(A.f,0,4),dist:fit(0.52)});
 await shotOf('astronauta_casco_tres_cuartos',{target:hd,dir:around(A.f,35,8),dist:fit(0.52)});
 await shotOf('astronauta_casco_perfil',{target:hd,dir:around(A.f,90,4),dist:fit(0.52)});
 // the gun in the hand, and on its own (EXTRA POWER too)
 const gside=[-A.gz[2],0,A.gz[0]];
 await shotOf('astronauta_arma_mano',{target:[A.gun[0]-A.gz[0]*0.06,A.gun[1]-0.03,A.gun[2]-A.gz[2]*0.06],dir:[gside[0]*0.85+A.gz[0]*0.3,0.3,gside[2]*0.85+A.gz[2]*0.3],dist:fit(0.42)});
 await shotOf('astronauta_arma_mano_otro_lado',{target:[A.gun[0]-A.gz[0]*0.06,A.gun[1]-0.03,A.gun[2]-A.gz[2]*0.06],dir:[-gside[0]*0.85+A.gz[0]*0.3,0.25,-gside[2]*0.85+A.gz[2]*0.3],dist:fit(0.42)});
 await p.evaluate(()=>{const {S}=__ST;__ST.pivot.visible=false;const pis=window.__pistol;const g=new __THREE.Group();S.add(g);__ST.gunSolo=g;
   const box=new __THREE.Box3();const kids=pis.children.filter(c=>c.isGroup||c.type==='Group'||c.isObject3D);
   const vis=pis.children.find(c=>c.visible&&c.children&&c.children.length&&c.type!=='Object3D')||pis;const cl=vis.clone(true);cl.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
   cl.position.set(0,0,0);cl.quaternion.identity();cl.scale.setScalar(1);g.add(cl);g.updateMatrixWorld(true);box.setFromObject(cl);const c=box.getCenter(new __THREE.Vector3());cl.position.sub(c);
   __ST.gun1=cl;__ST.radius=box.getSize(new __THREE.Vector3()).length()*0.6;
   const g2=pis.children.find(c=>c!==vis&&c.children&&c.children.length&&c.type!=='Object3D'&&!c.visible);
   if(g2){const c2=g2.clone(true);c2.visible=true;c2.traverse(o=>{o.visible=true;if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});c2.position.set(0,0,0);c2.quaternion.identity();c2.scale.setScalar(1);
     g.add(c2);g.updateMatrixWorld(true);const b2=new __THREE.Box3().setFromObject(c2);c2.position.sub(b2.getCenter(new __THREE.Vector3()));c2.visible=false;__ST.gun2=c2;}
   return 1;});
 const gunR=await p.evaluate(()=>__ST.radius);
 await shotOf('arma_perfil',{target:[0,0,0],dir:[1,0.05,0],dist:fit(gunR*1.5)});
 await shotOf('arma_tres_cuartos',{target:[0,0,0],dir:[0.8,0.45,0.6],dist:fit(gunR*1.5)});
 await shotOf('arma_tres_cuartos_atras',{target:[0,0,0],dir:[-0.75,0.4,-0.6],dist:fit(gunR*1.5)});
 const has2=await p.evaluate(()=>{if(!__ST.gun2)return 0;__ST.gun1.visible=false;__ST.gun2.visible=true;const b=new __THREE.Box3().setFromObject(__ST.gun2);__ST.radius=b.getSize(new __THREE.Vector3()).length()*0.6;return __ST.radius;});
 if(has2){await shotOf('arma_xp_perfil',{target:[0,0,0],dir:[1,0.05,0],dist:fit(has2*1.5)});await shotOf('arma_xp_tres_cuartos',{target:[0,0,0],dir:[0.8,0.45,0.6],dist:fit(has2*1.5)});}
 await p.evaluate(()=>{__ST.gunSolo.visible=false;});

 // ======== spider (hunter)
 const SP=await p.evaluate(()=>{const THREE=__THREE,{S}=__ST;const g=window.__makeSpider('hunter');S.attach(g);g.position.set(0,0,0);g.quaternion.identity();g.updateMatrixWorld(true);
   g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;}});
   const box=new THREE.Box3(),v=new THREE.Vector3();g.traverse(o=>{if(o.isSkinnedMesh){const pos=o.geometry.attributes.position;for(let i=0;i<pos.count;i+=5){o.getVertexPosition(i,v);o.localToWorld(v);box.expandByPoint(v);}}});
   const R=g.userData.rig;const head=R.body.localToWorld(R.headL.clone());const body=new THREE.Vector3();R.body.getWorldPosition(body);
   const c=box.getCenter(new THREE.Vector3()),s=box.getSize(new THREE.Vector3());const f=head.clone().sub(body);f.y=0;f.normalize();
   __ST.radius=Math.max(s.x,s.y,s.z)*0.6;__ST.spider=g;return {c:c.toArray(),s:s.toArray(),f:f.toArray(),head:head.toArray()};});
 console.log('spider',JSON.stringify(SP));
 const sW=Math.max(SP.s[0],SP.s[2])*0.78;
 for(const [n,deg,el] of [['frente',0,10],['tres_cuartos',40,18],['lado',90,8],['espalda',180,12],['tres_cuartos_atras',140,22]])
   await shotOf('arana_'+n,{target:SP.c,dir:around(SP.f,deg,el),dist:fit(sW)});
 await shotOf('arana_arriba',{target:SP.c,dir:[SP.f[0]*0.02,1,SP.f[2]*0.02],dist:fit(Math.max(SP.s[0],SP.s[2])*0.95),up:SP.f});
 const sr=Math.max(SP.s[0],SP.s[2]);
 await shotOf('arana_cara_frente',{target:SP.head,dir:around(SP.f,0,6),dist:fit(sr*0.32)});
 await shotOf('arana_cara_tres_cuartos',{target:[SP.head[0]-SP.f[0]*0.12,SP.head[1]+0.03,SP.head[2]-SP.f[2]*0.12],dir:around(SP.f,38,16),dist:fit(sr*0.5)});
 await p.evaluate(()=>{__ST.spider.visible=false;});

 // ======== ship
 const SH=await p.evaluate(()=>{const THREE=__THREE,{S}=__ST;let o=__scene.getObjectByName('SM_HEADS_Ship_Body');if(!o)return null;while(o.parent&&o.parent!==__scene)o=o.parent;
   S.attach(o);o.traverse(m=>{if(m.isMesh){m.castShadow=true;m.receiveShadow=true;for(const mt of [].concat(m.material))for(const k of ['map','normalMap','roughnessMap','metalnessMap','aoMap'])if(mt[k]){mt[k].anisotropy=8;mt[k].needsUpdate=true;}}});
   o.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(o);const c=box.getCenter(new THREE.Vector3()),s=box.getSize(new THREE.Vector3());
   __ST.radius=Math.max(s.x,s.y,s.z)*0.6;__ST.key.shadow.mapSize.set(4096,4096);return {c:c.toArray(),s:s.toArray()};});
 console.log('ship',JSON.stringify(SH));
 if(SH){const L=Math.max(SH.s[0],SH.s[1],SH.s[2]);
  // the nose (cockpit) points to +Z: «frente» looks at it from +Z. Each view is framed on the size the ship has from that side.
  const [X,Y,Z]=SH.s;
  for(const [n,dir,ext] of [['frente',[0,0.1,1],X*1.12],['atras',[0,0.1,-1],X*1.12],['lado_der',[-1,0.05,0],Math.max(Z,Y)],['lado_izq',[1,0.05,0],Math.max(Z,Y)],
      ['tres_cuartos',[0.72,0.36,0.7],Z*0.82],['tres_cuartos_izq',[-0.72,0.36,0.7],Z*0.82],['tres_cuartos_atras',[0.7,0.38,-0.72],Z*0.82],['arriba',[0.001,1,0.001],Math.max(X,Z)],['abajo',[0.001,-1,0.001],Math.max(X,Z)]])
   await shotOf('nave_'+n,{target:SH.c,dir,dist:fit(ext*0.92),up:(n==='arriba'||n==='abajo')?[0,0,1]:null});}
 await b.close();console.log('done');})();
