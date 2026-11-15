// v89: the HEADS patch on the astronaut's chest (tools/parche/, public/assets/models/astronaut.glb). Checks that the model brings it (a skinned
// mesh on the body's skeleton, material M_Patch with the 512 px texture, alpha mask, not metallic, a faint emission), that the old black circle is gone
// and the patch bends with the suit around it, and takes pictures: the front view (Q / VER) and a close-up, on PC and phone (tools/tests/out/parche_*.png).
//   npm run build:test && tools/run-test.sh dist-test tools/tests/parche.cjs
const {chromium}=require('playwright');
const {BASE,ARGS,shot}=require('./lib.cjs');
let bad=0;const ok=(c,m,i)=>{console.log((c?'  ok   ':'  FAIL ')+m+(i!==undefined&&!c?'  '+JSON.stringify(i):''));if(!c)bad++;};
const PLAT={pc:{viewport:{width:1600,height:900},deviceScaleFactor:2},phone:{viewport:{width:844,height:390},deviceScaleFactor:2,isMobile:true,hasTouch:true}};
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
  ok(m.img&&m.img[0]===512&&m.img[1]===512&&m.srgb==='srgb'&&m.emis,`${plat}: its texture is the 512 px WebP (sRGB), also a faint emission`,m);
  ok(m.alphaTest===0.5&&m.metal===0&&!m.transparent&&m.tris<700,`${plat}: alpha mask 0.5, not metallic, opaque pass, ${m.tris} triangles`,m);
  // where it is and how it bends: the old black puck is gone from the black mesh (no black triangle left near the patch), and every patch vertex
  // moves like the suit next to it (skinned offset from the bind pose compared with the nearest suit vertex within 1.5 cm), now and after moving
  const where=()=>p.evaluate(()=>{const THREE=__THREE,P=__heads.P;let patch=null,black=null,suit=null;
    P.model.traverse(o=>{if(!o.isMesh)return;const n=o.material.name;if(n==='M_Patch')patch=o;if(n==='M_Glove_Black'&&o.isSkinnedMesh)black=o;if(n==='M_Suit_Gold'&&o.isSkinnedMesh&&!suit)suit=o;});
    const g=patch.geometry,pa=g.attributes.position,c=new THREE.Vector3(),cb=new THREE.Vector3(),v=new THREE.Vector3(),u=new THREE.Vector3();
    for(let i=0;i<pa.count;i++){patch.getVertexPosition(i,v);patch.localToWorld(v);c.add(v);cb.add(u.fromBufferAttribute(pa,i));}c.divideScalar(pa.count);cb.divideScalar(pa.count);
    const bg=black.geometry,bi=bg.index;let near=0;for(let k=0;k<bi.count;k++){u.fromBufferAttribute(bg.attributes.position,bi.getX(k));if(u.distanceTo(cb)<0.05)near++;}
    const sg=suit.geometry,sa=sg.attributes.position,cand=[];for(let j=0;j<sa.count;j++){u.fromBufferAttribute(sa,j);if(u.distanceTo(cb)<0.1)cand.push(j);}
    // the patch's own plane, skinned (centre and two far-apart vertices), for the part of the drift across the suit (in or out of it)
    const sk=[];for(let i=0;i<pa.count;i++){const q=new THREE.Vector3();patch.getVertexPosition(i,q);sk.push(q);}
    const uvA=g.attributes.uv,inn=sk.filter((q,i)=>Math.hypot(uvA.getX(i)-0.5,uvA.getY(i)-0.5)<0.35),cs=inn.reduce((a,q)=>a.add(q),new THREE.Vector3()).divideScalar(inn.length);
    let A=inn[0];for(const q of inn)if(q.distanceTo(cs)>A.distanceTo(cs))A=q;let B=inn[0],bs=0;for(const q of inn){const x=q.clone().sub(cs).cross(A.clone().sub(cs)).length();if(x>bs){bs=x;B=q;}}
    const nrm=A.clone().sub(cs).cross(B.clone().sub(cs)).normalize(),spl=patch.worldToLocal(P.bones.Spine2.getWorldPosition(new THREE.Vector3()));if(nrm.dot(cs.clone().sub(spl))<0)nrm.negate(); // (outwards)
    let drift=0,driftN=0,sink=0,lift=0,pairs=0;const s=P.model.scale.x,bi0=new THREE.Vector3(),bj=new THREE.Vector3(),si=new THREE.Vector3(),sj=new THREE.Vector3();
    for(let i=0;i<pa.count;i++){bi0.fromBufferAttribute(pa,i);let best=1e9,jb=-1;for(const j of cand){const d=u.fromBufferAttribute(sa,j).distanceTo(bi0);if(d<best){best=d;jb=j;}}
      if(jb<0||best>0.015)continue;pairs++;bj.fromBufferAttribute(sa,jb);patch.getVertexPosition(i,si);suit.getVertexPosition(jb,sj);
      const dv=si.sub(bi0).sub(sj.sub(bj)),dn=dv.dot(nrm)*s;drift=Math.max(drift,dv.length()*s);driftN=Math.max(driftN,Math.abs(dn));sink=Math.max(sink,-dn);lift=Math.max(lift,dn);}
    // ripples: how far each inside vertex (UV within 0.33 of the centre) moves from the average move of its mesh neighbours. A patch that
    // bends smoothly has next to nothing there; one that ripples (weights jumping from vertex to vertex) does
    const uvR=g.attributes.uv,ix=g.index,nb=new Map();for(let k=0;k<ix.count;k+=3){const t=[ix.getX(k),ix.getX(k+1),ix.getX(k+2)];for(const x of t)for(const y of t)if(x!==y){if(!nb.has(x))nb.set(x,new Set());nb.get(x).add(y);}}
    // only the patch itself: the largest connected piece (the swoosh tips are small pieces of suit)
    const seen=new Set();let big=[];for(const st of nb.keys()){if(seen.has(st))continue;const comp=[st];seen.add(st);for(let h=0;h<comp.length;h++)for(const y of nb.get(comp[h]))if(!seen.has(y)){seen.add(y);comp.push(y);}if(comp.length>big.length)big=comp;}
    const inPatch=new Set(big);
    const disp=i=>{const q=new THREE.Vector3();patch.getVertexPosition(i,q);return q.sub(u.fromBufferAttribute(pa,i));};
    let warp=0,ins=0;for(const [i,ns] of nb){if(!inPatch.has(i)||Math.hypot(uvR.getX(i)-0.5,uvR.getY(i)-0.5)>=0.33)continue;ins++;const m=new THREE.Vector3();for(const j of ns)m.add(disp(j));m.divideScalar(ns.size);
      warp=Math.max(warp,disp(i).sub(m).length()*s);}
    return {c:c.toArray(),blackNear:near,drift,driftN,sink,lift,pairs,warp,ins,patchV:big.length};});
  const w0=await where();
  ok(w0.blackNear===0,`${plat}: the old black circle is gone (black triangle corners within 5 cm: ${w0.blackNear})`,w0);
  // (the patch is 2.5 mm over the suit with a 4 mm skirt under its edge: it may sink a little less than 2.5 mm and lift a little less than 4)
  ok(w0.pairs>60&&w0.sink<0.002&&w0.lift<0.0035,`${plat}: the patch stays on the suit (${w0.pairs} vertices checked against the suit next to them: at most ${(w0.sink*1000).toFixed(1)} mm into it, ${(w0.lift*1000).toFixed(1)} mm off it, ${(w0.drift*1000).toFixed(1)} mm in all)`,w0);
  ok(w0.ins>100&&w0.warp<0.0005,`${plat}: it does not ripple (${w0.ins} vertices inside, at most ${(w0.warp*1000).toFixed(2)} mm off the move of their neighbours)`,w0);
  await p.evaluate(()=>{const P=__heads.P;P.pos.x+=1.5;P.pos.y+=0.7;});await p.waitForTimeout(700);
  const w1=await where();const moved=Math.hypot(w1.c[0]-w0.c[0],w1.c[1]-w0.c[1],w1.c[2]-w0.c[2]);
  ok(moved>1&&w1.sink<0.002&&w1.lift<0.0035&&w1.warp<0.0005,`${plat}: it moves with the astronaut (moved ${moved.toFixed(2)} m, ${(w1.sink*1000).toFixed(1)} mm into the suit, ${(w1.lift*1000).toFixed(1)} mm off it, ripples ${(w1.warp*1000).toFixed(2)} mm)`,w1);
  // pictures: front view (Q on PC, VER on the phone), then a close-up from the patch's own normal
  await p.evaluate(()=>{__heads.inp.view=true;});await p.waitForTimeout(2200);
  await p.screenshot({path:shot(`parche_${plat}_frente.png`)});
  const look=(dist,turn,lift)=>p.evaluate(([dist,turn,lift])=>{const THREE=__THREE,P=__heads.P;let patch=null;P.model.traverse(o=>{if(o.isMesh&&o.material.name==='M_Patch')patch=o;});
    const g=patch.geometry,v=new THREE.Vector3(),c=new THREE.Vector3();let n=0;
    for(let i=0;i<g.attributes.position.count;i++){patch.getVertexPosition(i,v);patch.localToWorld(v);c.add(v);n++;}c.divideScalar(n);
    // facing: the plane of the skinned patch (two far-apart vertices around the centre), pointing away from the spine
    let A=null,B=null,da=0;const tmp=[];for(let i=0;i<n;i++){const q=new THREE.Vector3();patch.getVertexPosition(i,q);patch.localToWorld(q);tmp.push(q);const d=q.distanceTo(c);if(d>da&&d<0.06){da=d;A=q;}}
    let db=0;for(const q of tmp){const d1=q.distanceTo(c);if(d1>0.03&&d1<0.06){const s=Math.abs(q.clone().sub(c).normalize().cross(A.clone().sub(c).normalize()).length());if(s>db){db=s;B=q;}}}
    const nrm=A.clone().sub(c).cross(B.clone().sub(c)).normalize();const sp=P.bones.Spine2.getWorldPosition(new THREE.Vector3());if(nrm.dot(c.clone().sub(sp))<0)nrm.negate();
    nrm.applyAxisAngle(new THREE.Vector3(0,1,0),turn);const eye=c.clone().addScaledVector(nrm,dist).add(new THREE.Vector3(0,lift,0));
    window.__camOv=eye.sub(P.pos);window.__camLook=c.clone().sub(P.pos);},[dist,turn,lift]);
  await look(0.5,0,0);await p.waitForTimeout(900);
  await p.screenshot({path:shot(`parche_${plat}_cerca.png`)});
  if(plat==='pc'){ // detail pictures for review, without the HUD: straight on and from the side (3200x1800 render, the middle cropped)
    await p.evaluate(()=>{const cv=document.querySelector('canvas');for(const e of document.body.children)if(!e.contains(cv))e.style.visibility='hidden';});
    const clip={x:400,y:150,width:800,height:600};
    await look(0.3,0,0);await p.waitForTimeout(900);await p.screenshot({path:shot('parche_pc_detalle_frente.png'),clip});
    await look(0.32,0.75,0.08);await p.waitForTimeout(900);await p.screenshot({path:shot('parche_pc_detalle_lado.png'),clip});}
  ok(p.errs.length===0,`${plat}: no page errors`,p.errs.slice(0,3));await ctx.close();}
 console.log(bad?('FAILED '+bad):'ALL OK');await b.close();process.exitCode=bad?1:0;})();
