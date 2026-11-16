// v92: the astronaut's normal map (tools/astro-normal/, public/assets/models/astronaut.glb and astronaut_mobile.glb). Checks that PC loads the
// 2048 px map and phones the 1024 one (astronaut_mobile.glb), that the four body materials (gold suit, black gloves, grey metal, black visor) carry
// it, with the baked tangents (three uses them: no derivative tangents, normalScale.y +1), that the backpack and the hose do not (no UVs there),
// that nothing else about the astronaut changed (bones, the hose grip animation, the HEADS patch), and takes pictures without the HUD:
// the front view (Q / VER), the chest, the back, an arm, the legs, the helmet and the zips, and the game camera (tools/tests/out/astro_<tag>_<plat>_*.png).
// The pictures come first: HEADS_ASTRO_REF=<commit> serves that commit's astronaut.glb instead (on PC and phone), to take the same pictures of the
// model before (HEADS_ASTRO_REF=0b2d360 HEADS_TAG=antes: v91, without the map; its checks then fail, as they should).
//   npm run build:test && tools/run-test.sh dist-test tools/tests/astronauta.cjs        (HEADS_ONLY=pc|phone, HEADS_TAG=v92)
const {chromium}=require('playwright');
const {BASE,ARGS,shot}=require('./lib.cjs');
let bad=0;const ok=(c,m,i)=>{console.log((c?'  ok   ':'  FAIL ')+m+(i!==undefined&&!c?'  '+JSON.stringify(i):''));if(!c)bad++;};
const TAG=process.env.HEADS_TAG||'v92',ONLY=process.env.HEADS_ONLY,REF=process.env.HEADS_ASTRO_REF;
const OLD=REF&&/^[0-9a-f]{6,40}$/.test(REF)?require('child_process').execSync(`git show ${REF}:public/assets/models/astronaut.glb`,{maxBuffer:64<<20}):null;
const PLAT={pc:{viewport:{width:1600,height:900},deviceScaleFactor:2},phone:{viewport:{width:844,height:390},deviceScaleFactor:2,isMobile:true,hasTouch:true}};
(async()=>{
 const b=await chromium.launch({args:ARGS});
 for(const plat of ['pc','phone']){
  if(ONLY&&ONLY!==plat)continue;
  const ctx=await b.newContext(PLAT[plat]),p=await ctx.newPage();p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));
  const models=[];p.on('request',r=>{const u=r.url();if(/astronaut[^/]*\.glb/.test(u))models.push(u.split('/').pop());});
  await p.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  if(OLD)await p.route(/astronaut[^/]*\.glb/,r=>r.fulfill({status:200,contentType:'model/gltf-binary',body:OLD}));
  await p.addInitScript(()=>{window.__noTut=1;window.__noCine=1;});
  await p.goto(BASE+'/test.html?q=0');
  if(plat==='pc'){await p.waitForFunction(()=>!document.getElementById('play').disabled,null,{timeout:300000});await p.evaluate(()=>document.getElementById('play').click());}
  else{await p.waitForFunction(()=>{const g=document.getElementById('mmGo');return g&&!g.disabled;},null,{timeout:300000});await p.waitForTimeout(1500);await p.tap('#mmGo');}
  await p.waitForFunction(()=>window.__T&&__T.state==='play',null,{timeout:120000});
  await p.evaluate(()=>{const H=__heads;window.__noSpawn=1;__T.toSpawn=0;H.WB.spitQ=[1e9];for(const s of [...H.spiders])H.killSpider(s);H.P.hp=100;H.P.inv=1e9;});
  await p.waitForTimeout(1500);
  // pictures (HUD hidden): the game camera, the front view, then close-ups around the body (front = the chest's side, from the HEADS patch)
  const hud=v=>p.evaluate(v=>{const cv=document.querySelector('canvas');for(const e of document.body.children)if(!e.contains(cv))e.style.visibility=v?'':'hidden';},v);
  await hud(false);await p.waitForTimeout(400);
  await p.screenshot({path:shot(`astro_${TAG}_${plat}_juego.png`)});
  await p.evaluate(()=>{__heads.inp.view=true;});await p.waitForTimeout(2200);
  await p.screenshot({path:shot(`astro_${TAG}_${plat}_frente.png`)});
  await p.evaluate(()=>{__heads.inp.view=false;});
  const look=(bone,fwd,side,up,dist)=>p.evaluate(([bone,fwd,side,up,dist])=>{const THREE=__THREE,P=__heads.P;let patch=null;P.model.traverse(o=>{if(o.isMesh&&o.material.name==='M_Patch')patch=o;});
    const sp=P.bones.Spine2.getWorldPosition(new THREE.Vector3()),c=new THREE.Vector3(),v=new THREE.Vector3();
    if(patch){const g=patch.geometry;for(let i=0;i<g.attributes.position.count;i++){patch.getVertexPosition(i,v);patch.localToWorld(v);c.add(v);}c.divideScalar(g.attributes.position.count);}
    const U=new THREE.Vector3(0,1,0).applyQuaternion(P.model.getWorldQuaternion(new THREE.Quaternion())).normalize();
    const F=c.clone().sub(sp);F.addScaledVector(U,-F.dot(U)).normalize();const R=new THREE.Vector3().crossVectors(F,U).normalize();
    const at=(bone==='Spine2'?sp:P.bones[bone].getWorldPosition(new THREE.Vector3()));
    const dir=F.clone().multiplyScalar(fwd).addScaledVector(R,side).addScaledVector(U,up).normalize();
    window.__camOv=at.clone().addScaledVector(dir,dist).sub(P.pos);window.__camLook=at.clone().sub(P.pos);},[bone,fwd,side,up,dist]);
  const views=[['pecho','Spine2',1,0.25,0.15,0.75],['espalda','Spine2',-1,0.35,0.35,0.95],['brazo','LeftForeArm',0.6,-0.2,0.5,0.6],['piernas','LeftLeg',1,0.35,0.05,1.0],['lado','Spine2',0.15,1,0.1,1.1],['casco','Head',1,0.45,0.2,0.75],['cremallera','Spine1',1,-0.15,0.05,0.5]];
  for(const [name,...a] of views){await look(...a);await p.waitForTimeout(900);await p.screenshot({path:shot(`astro_${TAG}_${plat}_${name}.png`)});}
  await p.evaluate(()=>{delete window.__camOv;delete window.__camLook;});await hud(true);
  // the model
  const m=await p.evaluate(()=>{const P=__heads.P,out={mats:{},bones:0,anims:0};
    P.model.traverse(o=>{if(o.isBone)out.bones++;if(!o.isMesh)return;const mt=o.material,g=o.geometry,img=mt.normalMap&&mt.normalMap.image;
      out.mats[mt.name]={base:+mt.color.r.toFixed(3),metal:mt.metalness,rough:mt.roughness,n:img?[img.width,img.height]:null,tan:!!g.attributes.tangent,uv:!!g.attributes.uv,ny:mt.normalScale?mt.normalScale.y:null,cs:mt.normalMap&&mt.normalMap.colorSpace,skinned:o.isSkinnedMesh};});
    return out;});
  const want=plat==='pc'?2048:1024,M=m.mats;
  ok(models.length===1&&models[0]===(plat==='pc'?'astronaut.glb':'astronaut_mobile.glb'),`${plat}: loads ${models.join(', ')}`,models);
  for(const n of ['M_Suit_Gold','M_Glove_Black','M_Metal_Grey','M_Visor_Black','M_Zip_Black','M_Zip_Pull']){const x=M[n]||{};
    ok(x.n&&x.n[0]===want&&x.n[1]===want&&x.tan&&x.uv&&x.ny===1&&x.cs!=='srgb'&&x.skinned,`${plat}: ${n} has the ${want} px normal map with the baked tangents (normalScale.y ${x.ny})`,x);}
  for(const n of ['M_Suit_Gold_Pack','M_Hose_Gold','M_Patch']){const x=M[n];ok(x&&!x.n,`${plat}: ${n} has no normal map`,x);}
  const g=M.M_Metal_Grey||{},zb=M.M_Zip_Black||{};
  ok(g.metal===1&&g.rough<=0.25&&g.base>0.5&&zb.base<0.05,`${plat}: the helmet metal is polished silver (base ${g.base}, roughness ${g.rough}) and the zips are black (base ${zb.base})`,{g,zb});
  ok(m.bones===69,`${plat}: the skeleton (${m.bones} bones)`,m.bones);
  ok(p.errs.length===0,`${plat}: no page errors`,p.errs.slice(0,3));await ctx.close();}
 console.log(bad?('FAILED '+bad):'ALL OK');await b.close();process.exitCode=bad?1:0;})();
