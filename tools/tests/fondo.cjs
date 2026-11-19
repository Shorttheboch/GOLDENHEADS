// Fondos del espacio (cielo, planeta y rocas, sin nave ni HUD) en vertical 9:16, para usar fuera del juego. No es una prueba: solo hace imágenes en out/fondo_*.png.
// HEADS_FONDO='[{"n":"a","pos":[x,y,z],"dir":[x,y,z],"fov":50,"roll":0}]' cambia las vistas; HEADS_FONDO_W / _H el tamaño (1080x1920); HEADS_FONDO_LIST=1 imprime las rocas.
const {chromium}=require('playwright');const fs=require('fs');const {BASE,ARGS,shot}=require('./lib.cjs');
const W=+(process.env.HEADS_FONDO_W||1080),H=+(process.env.HEADS_FONDO_H||1920),DPR=+(process.env.HEADS_FONDO_DPR||1);
const VIEWS=JSON.parse(process.env.HEADS_FONDO||'null')||[{"n":"1_abierto","pos":[3,4,34],"dir":[-0.3,-0.13,-1],"fov":75,"roll":-0.035},{"n":"2_dos_rocas","pos":[2.11,10.55,33.55],"dir":[-0.551,-0.541,-0.721],"fov":75,"roll":-0.06},{"n":"3_roca_cerca","pos":[19.81,17.23,19.44],"dir":[-0.551,-0.321,-0.721],"fov":68,"roll":0}];
(async()=>{const b=await chromium.launch({args:ARGS});const p=await b.newPage({viewport:{width:W,height:H},deviceScaleFactor:DPR});p.on('pageerror',e=>console.log('ERR',e.message));
  await p.goto(BASE+'/test.html');
  await p.waitForFunction(()=>document.getElementById('play')&&!document.getElementById('play').disabled,null,{timeout:300000});await p.waitForTimeout(1500);
  if(process.env.HEADS_FONDO_LIST){console.log(JSON.stringify(await p.evaluate(()=>{const o=[];__scene.traverse(m=>{if(m.isMesh&&m.material&&m.material.customProgramCacheKey&&m.material.customProgramCacheKey()==='rock94'){m.geometry.computeBoundingSphere();o.push([...m.position.toArray().map(v=>+v.toFixed(1)),+m.geometry.boundingSphere.radius.toFixed(1)]);}});return o;})));}
  for(const v of VIEWS){const data=await p.evaluate(v=>{const THREE=__THREE,c=__camera;c.layers.set(1);c.position.fromArray(v.pos);const d=new THREE.Vector3().fromArray(v.dir).normalize();c.up.set(0,1,0);c.lookAt(c.position.clone().add(d));c.rotateZ(v.roll||0);
      c.fov=v.fov||58;c.aspect=innerWidth/innerHeight;c.updateProjectionMatrix();c.updateMatrixWorld(true);window.__noRender=0;__composer.render();const cv=__composer.renderer.domElement;return [cv.toDataURL('image/png'),cv.width,cv.height];},v);
    fs.writeFileSync(shot('fondo_'+v.n+'.png'),Buffer.from(data[0].split(',')[1],'base64'));console.log('fondo_'+v.n+'.png',data[1],data[2]);}
  await b.close();})();
