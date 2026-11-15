// v89: the HEADS patch on the astronaut's chest (tools/parche/, public/assets/models/astronaut.glb). Checks that the model brings it (a skinned
// mesh on the body's skeleton, material M_Patch with the 512 px texture, alpha mask, not metallic, a faint emission), that the old black circle is gone,
// that the suit never comes through the patch in the game's pose and that it bends in one smooth piece, and takes pictures: the front view (Q / VER) and a close-up, on PC and phone (tools/tests/out/parche_*.png).
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
  // where it is and how it bends, in the pose the game has just now: the old black puck is gone from the black mesh (no black triangle left
  // near the patch); the suit never comes through the patch (rays from each face vertex of the patch, along the patch normal, against the posed
  // suit triangles around it: the gap, 2.5 mm in the bind pose, must stay above -0.5 mm; the skirt must stay under the suit); and it bends in
  // one smooth piece (a quadratic map from its flat bind layout to the posed one fits the middle of the patch to a fraction of a millimetre)
  const where=()=>p.evaluate(()=>{const THREE=__THREE,P=__heads.P;let patch=null,black=null,suit=null;
    P.model.traverse(o=>{if(!o.isMesh)return;const n=o.material.name;if(n==='M_Patch')patch=o;if(n==='M_Glove_Black'&&o.isSkinnedMesh)black=o;if(n==='M_Suit_Gold'&&o.isSkinnedMesh&&!suit)suit=o;});
    const s=P.model.scale.x,g=patch.geometry,pa=g.attributes.position,uv=g.attributes.uv,ix=g.index,u=new THREE.Vector3();
    const bind=i=>new THREE.Vector3().fromBufferAttribute(pa,i),posed=i=>{const q=new THREE.Vector3();patch.getVertexPosition(i,q);return q;};
    // the patch itself = the largest connected piece of the primitive (the swoosh tips are small pieces of suit)
    const nb=new Map();for(let k=0;k<ix.count;k+=3){const t=[ix.getX(k),ix.getX(k+1),ix.getX(k+2)];for(const x of t)for(const y of t)if(x!==y){if(!nb.has(x))nb.set(x,new Set());nb.get(x).add(y);}}
    const seen=new Set();let big=[];for(const st of nb.keys()){if(seen.has(st))continue;const comp=[st];seen.add(st);for(let h=0;h<comp.length;h++)for(const y of nb.get(comp[h]))if(!seen.has(y)){seen.add(y);comp.push(y);}if(comp.length>big.length)big=comp;}
    const cb=big.reduce((a,i)=>a.add(bind(i)),new THREE.Vector3()).divideScalar(big.length),c=patch.localToWorld(big.reduce((a,i)=>a.add(posed(i)),new THREE.Vector3()).divideScalar(big.length));
    const bg=black.geometry,bi=bg.index;let near=0;for(let k=0;k<bi.count;k++){u.fromBufferAttribute(bg.attributes.position,bi.getX(k));if(u.distanceTo(cb)<0.05)near++;}
    // plane of a set of points (PCA by power iteration), normal pointing away from the spine
    const plane=(pts,out)=>{const m=pts.reduce((a,q)=>a.add(q),new THREE.Vector3()).divideScalar(pts.length),C=[[0,0,0],[0,0,0],[0,0,0]];
      for(const q of pts){const d=q.clone().sub(m).toArray();for(let a=0;a<3;a++)for(let b=0;b<3;b++)C[a][b]+=d[a]*d[b];}
      const mul=x=>new THREE.Vector3(C[0][0]*x.x+C[0][1]*x.y+C[0][2]*x.z,C[1][0]*x.x+C[1][1]*x.y+C[1][2]*x.z,C[2][0]*x.x+C[2][1]*x.y+C[2][2]*x.z);
      let e1=new THREE.Vector3(1,0.3,0.2);for(let i=0;i<100;i++)e1=mul(e1).normalize();let e2=new THREE.Vector3(0.2,1,0.3);for(let i=0;i<100;i++){e2=mul(e2);e2.addScaledVector(e1,-e2.dot(e1)).normalize();}
      const n=new THREE.Vector3().crossVectors(e1,e2).normalize();if(n.dot(m.clone().sub(out))<0)n.negate();return {m,e1,e2,n};};
    const spl=patch.worldToLocal(P.bones.Spine2.getWorldPosition(new THREE.Vector3())),spb=new THREE.Vector3(0,1.3,-0.1);
    const PB=plane(big.map(bind),spb),PP=plane(big.map(posed),spl);
    // posed suit triangles around the patch
    const sg=suit.geometry,sa=sg.attributes.position,si=sg.index,sk=new Map(),tri=[];const sp=j=>{if(!sk.has(j)){const q=new THREE.Vector3();suit.getVertexPosition(j,q);sk.set(j,q);}return sk.get(j);};
    for(let k=0;k<si.count;k+=3){const t=[si.getX(k),si.getX(k+1),si.getX(k+2)];if(t.every(j=>u.fromBufferAttribute(sa,j).distanceTo(cb)<0.09))tri.push(t);}
    const ray=new THREE.Ray(),hit=new THREE.Vector3();
    const gapAt=(o,n,posedPose)=>{let best=null;ray.set(o.clone().addScaledVector(n,0.03),n.clone().negate());
      for(const t of tri){const [A,B,C]=posedPose?t.map(sp):t.map(j=>new THREE.Vector3().fromBufferAttribute(sa,j));if(ray.intersectTriangle(A,B,C,false,hit)){const d=0.03-hit.distanceTo(ray.origin);if(Math.abs(d)<0.02&&(best===null||d<best))best=d;}}
      return best;}; // (distance from the suit up to the point, along n; the suit surface nearest to the point's side)
    let minGap=1e9,skirtUp=-1e9,faces=0;
    for(const i of big){const gb=gapAt(bind(i),PB.n,false);if(gb===null)continue;const gp=gapAt(posed(i),PP.n,true);if(gp===null)continue;
      if(gb>0.001){faces++;minGap=Math.min(minGap,gp*s);}else if(gb<-0.002)skirtUp=Math.max(skirtUp,gp*s);}
    // ripples: quadratic fit, posed position as a function of the flat bind coordinates, over the middle (UV within 0.22 of the centre)
    const mid=big.filter(i=>Math.hypot(uv.getX(i)-0.5,uv.getY(i)-0.5)<0.22),X=[],Y=[];
    for(const i of mid){const d=bind(i).sub(PB.m),x=d.dot(PB.e1)*20,y=d.dot(PB.e2)*20;X.push([1,x,y,x*x,x*y,y*y]);Y.push(posed(i).toArray());}
    const M=Array.from({length:6},()=>Array(6).fill(0)),R=[0,1,2].map(()=>Array(6).fill(0));
    for(let n=0;n<X.length;n++)for(let a=0;a<6;a++){for(let b=0;b<6;b++)M[a][b]+=X[n][a]*X[n][b];for(let k=0;k<3;k++)R[k][a]+=X[n][a]*Y[n][k];}
    const solve=(A,bv)=>{const m=A.map((r,i)=>[...r,bv[i]]);for(let cc=0;cc<6;cc++){let pv=cc;for(let r=cc+1;r<6;r++)if(Math.abs(m[r][cc])>Math.abs(m[pv][cc]))pv=r;[m[cc],m[pv]]=[m[pv],m[cc]];
      for(let r=0;r<6;r++)if(r!==cc){const f=m[r][cc]/m[cc][cc];for(let k=cc;k<7;k++)m[r][k]-=f*m[cc][k];}}return m.map((r,i)=>r[6]/r[i]);};
    const th=[0,1,2].map(k=>solve(M,R[k]));let warp=0;
    for(let n=0;n<X.length;n++){let e=0;for(let k=0;k<3;k++){const f=th[k].reduce((acc,t,a)=>acc+t*X[n][a],0);e+=(f-Y[n][k])**2;}warp=Math.max(warp,Math.sqrt(e)*s);}
    return {c:c.toArray(),blackNear:near,minGap,skirtUp,faces,warp,mid:mid.length,patchV:big.length,suitTris:tri.length};});
  const w0=await where();
  ok(w0.blackNear===0,`${plat}: the old black circle is gone (black triangle corners within 5 cm: ${w0.blackNear})`,w0);
  ok(w0.faces>25&&w0.minGap>-0.0005,`${plat}: the suit never comes through the patch (${w0.faces} points over the suit: the closest is ${(w0.minGap*1000).toFixed(1)} mm over it; 2.2 mm in the bind pose)`,w0);
  ok(w0.skirtUp<0.0005,`${plat}: the skirt stays under the suit (highest ${(w0.skirtUp*1000).toFixed(1)} mm)`,w0);
  ok(w0.mid>40&&w0.warp<0.0006,`${plat}: it bends in one smooth piece (${w0.mid} vertices in the middle, at most ${(w0.warp*1000).toFixed(2)} mm off a smooth bend)`,w0);
  await p.evaluate(()=>{const P=__heads.P;P.pos.x+=1.5;P.pos.y+=0.7;});await p.waitForTimeout(700);
  const w1=await where();const moved=Math.hypot(w1.c[0]-w0.c[0],w1.c[1]-w0.c[1],w1.c[2]-w0.c[2]);
  ok(moved>1&&w1.minGap>-0.0005&&w1.skirtUp<0.0005&&w1.warp<0.0006,`${plat}: it moves with the astronaut (moved ${moved.toFixed(2)} m; closest ${(w1.minGap*1000).toFixed(1)} mm over the suit, skirt ${(w1.skirtUp*1000).toFixed(1)} mm, ${(w1.warp*1000).toFixed(2)} mm off a smooth bend)`,w1);
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
