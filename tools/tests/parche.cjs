// v89: the HEADS patch on the astronaut's chest (tools/parche/, public/assets/models/astronaut.glb). Checks that the model brings it (a skinned
// mesh on the body's skeleton, material M_Patch with the 1024x512 texture: disc | tips, alpha mask, not metallic), that it follows the body when it moves and that
// it sits over the black circle, and takes pictures: the front view (Q / VER) and a close-up, on PC and phone (tools/tests/out/parche_*.png).
//   npm run build:test && tools/run-test.sh dist-test tools/tests/parche.cjs
const {chromium}=require('playwright');
const {BASE,ARGS,shot}=require('./lib.cjs');
let bad=0;const ok=(c,m,i)=>{console.log((c?'  ok   ':'  FAIL ')+m+(i!==undefined&&!c?'  '+JSON.stringify(i):''));if(!c)bad++;};
const PLAT={pc:{viewport:{width:1600,height:900}},phone:{viewport:{width:844,height:390},deviceScaleFactor:2,isMobile:true,hasTouch:true}};
(async()=>{
 const b=await chromium.launch({args:ARGS});
 for(const plat of ['pc','phone']){
  const ctx=await b.newContext(PLAT[plat]),p=await ctx.newPage();p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));
  await p.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  await p.addInitScript(()=>{window.__noTut=1;window.__noCine=1;});
  await p.goto(BASE+'/test.html?q=0');
  if(plat==='pc'){await p.waitForFunction(()=>!document.getElementById('play').disabled,null,{timeout:300000});await p.evaluate(()=>document.getElementById('play').click());}
  else{await p.waitForFunction(()=>{const g=document.getElementById('mmGo');return g&&!g.disabled;},null,{timeout:300000});await p.waitForTimeout(1500);await p.tap('#mmGo');}
  await p.waitForFunction(()=>window.__T&&__T.state==='play',null,{timeout:120000});
  await p.evaluate(()=>{const H=__heads;window.__noSpawn=1;__T.toSpawn=0;H.WB.spitQ=[1e9];for(const s of [...H.spiders])H.killSpider(s);H.P.hp=100;H.P.inv=1e9;});
  // the model
  const m=await p.evaluate(()=>{const P=__heads.P;let patch=null,body=null;P.model.traverse(o=>{if(!o.isMesh)return;if(o.material.name==='M_Patch')patch=o;if(o.material.name==='M_Suit_Gold'&&o.isSkinnedMesh&&!body)body=o;});
    if(!patch)return {patch:false};const mt=patch.material,img=mt.map&&mt.map.image;
    return {patch:true,skinned:patch.isSkinnedMesh,sameSkel:!!body&&patch.skeleton===body.skeleton,img:img?[img.width,img.height]:null,alphaTest:mt.alphaTest,metal:mt.metalness,rough:mt.roughness,
      tris:patch.geometry.index.count/3,srgb:mt.map&&mt.map.colorSpace,transparent:mt.transparent,emis:!!mt.emissiveMap&&mt.emissiveMap.image===mt.map.image&&mt.emissive.r>0.1&&mt.emissive.r<0.6};});
  ok(m.patch&&m.skinned&&m.sameSkel,`${plat}: the patch is a skinned mesh on the astronaut's skeleton`,m);
  ok(m.img&&m.img[0]===1024&&m.img[1]===512&&m.srgb==='srgb'&&m.emis,`${plat}: its texture is the 1024x512 WebP (sRGB), also a faint emission`,m);
  ok(m.alphaTest===0.5&&m.metal===0&&!m.transparent&&m.tris<200,`${plat}: alpha mask 0.5, not metallic, opaque pass, ${m.tris} triangles`,m);
  // where it is: over the black circle (the black disc's centre, skinned, in world space) and it moves with the chest
  const where=()=>p.evaluate(()=>{const THREE=__THREE,P=__heads.P;let patch=null,black=null;P.model.traverse(o=>{if(o.isMesh&&o.material.name==='M_Patch')patch=o;if(o.isMesh&&o.material.name==='M_Glove_Black')black=o;});
    const c=new THREE.Vector3(),v=new THREE.Vector3();let n=0;const g=patch.geometry;
    for(let i=0;i<g.attributes.position.count;i++){patch.getVertexPosition(i,v);patch.localToWorld(v);c.add(v);n++;}c.divideScalar(n);
    // the black disc: black vertices within 7 cm of the patch centre
    const bc=new THREE.Vector3();let bn=0;const bg=black.geometry;for(let i=0;i<bg.attributes.position.count;i++){black.getVertexPosition(i,v);black.localToWorld(v);if(v.distanceTo(c)<0.07){bc.add(v);bn++;}}
    if(bn)bc.divideScalar(bn);return {c:c.toArray(),d:bn?c.distanceTo(bc):null,bn};});
  const w0=await where();
  ok(w0.bn>20&&w0.d<0.02,`${plat}: it sits on the black circle (${w0.bn} black vertices around it, centres ${(w0.d*100).toFixed(1)} cm apart)`,w0);
  await p.evaluate(()=>{const P=__heads.P;P.pos.x+=1.5;P.pos.y+=0.7;});await p.waitForTimeout(700);
  const w1=await where();const moved=Math.hypot(w1.c[0]-w0.c[0],w1.c[1]-w0.c[1],w1.c[2]-w0.c[2]);
  ok(moved>1&&w1.d<0.02,`${plat}: it moves with the astronaut (moved ${moved.toFixed(2)} m, still on the circle)`,w1);
  // pictures: front view (Q on PC, VER on the phone), then a close-up from the patch's own normal
  await p.evaluate(()=>{__heads.inp.view=true;});await p.waitForTimeout(2200);
  await p.screenshot({path:shot(`parche_${plat}_frente.png`)});
  await p.evaluate(()=>{const THREE=__THREE,P=__heads.P;let patch=null;P.model.traverse(o=>{if(o.isMesh&&o.material.name==='M_Patch')patch=o;});
    const g=patch.geometry,v=new THREE.Vector3(),c=new THREE.Vector3();let n=0;
    for(let i=0;i<g.attributes.position.count;i++){patch.getVertexPosition(i,v);patch.localToWorld(v);c.add(v);n++;}c.divideScalar(n);
    // facing: the plane of the skinned patch (two far-apart vertices around the centre), pointing away from the spine
    let A=null,B=null,da=0;const tmp=[];for(let i=0;i<n;i++){const q=new THREE.Vector3();patch.getVertexPosition(i,q);patch.localToWorld(q);tmp.push(q);const d=q.distanceTo(c);if(d>da&&d<0.06){da=d;A=q;}}
    let db=0;for(const q of tmp){const d1=q.distanceTo(c);if(d1>0.03&&d1<0.06){const s=Math.abs(q.clone().sub(c).normalize().cross(A.clone().sub(c).normalize()).length());if(s>db){db=s;B=q;}}}
    const nrm=A.clone().sub(c).cross(B.clone().sub(c)).normalize();const sp=P.bones.Spine2.getWorldPosition(new THREE.Vector3());if(nrm.dot(c.clone().sub(sp))<0)nrm.negate();
    const eye=c.clone().addScaledVector(nrm,0.5);
    window.__camOv=eye.sub(P.pos);window.__camLook=c.clone().sub(P.pos);});
  await p.waitForTimeout(900);
  await p.screenshot({path:shot(`parche_${plat}_cerca.png`)});
  ok(p.errs.length===0,`${plat}: no page errors`,p.errs.slice(0,3));await ctx.close();}
 console.log(bad?('FAILED '+bad):'ALL OK');await b.close();process.exitCode=bad?1:0;})();
