/* ================= LOAD ================= */
// v74: phones get ship_mobile.glb (same model, every texture at most 2048 px: 4.7 MB instead of 6.5 and ~117 MB of texture memory instead of ~252 with the 4K ship)
const SHIP_URL=isTouch?'assets/ship_mobile.glb':'assets/ship.glb';
(async()=>{
  try{
    const prog={a:0,s:0};const upd=()=>$('load').textContent=`Cargando modelos ${Math.round((prog.a+prog.s)/2*100)}%`;
    loadMod('assets/hud4.js').then(m=>{const H=m.default,pcOnly=isTouch&&window.HUD?'#hVit,#hScore,#hTank,#hTk,#hTop,#pcKeys':null; // v66: phones skip the PC panels' art
      for(const el of document.querySelectorAll('img[data-k]'))if(H[el.dataset.k]&&!(pcOnly&&el.closest(pcOnly)))el.src=H[el.dataset.k];
      const rs=document.documentElement.style;rs.setProperty('--mira',`url(${H['mira']})`);rs.setProperty('--fill-en',`url(${H['energia-relleno']})`);rs.setProperty('--ico-en',`url(${H['icono-energia']})`);
      HUD4.art=H;}).catch(e=>console.warn('hud4 art',e));
    loadMod('assets/endui.js').then(m=>{const E=m.default;$('endPanel').style.setProperty('--end-frame',`url(${E.frame})`);$('again').style.setProperty('--end-btn',`url(${E.button})`);
      try{new FontFace('TekturE',`url(${E.font})`,{weight:'400 900'}).load().then(f=>document.fonts.add(f)).catch(e=>console.warn('end font',e));}catch(e){}}).catch(e=>console.warn('end ui',e));
    // v74: only what round 1 needs gates the menu (ship, astronaut, spider, pistol); crab, egg, EXTRA POWER pistol and Incineradora come later (lateStart below)
    const [ship,astro,spi,gun]=await Promise.all([
      loadGLB(SHIP_URL,e=>{if(e.total){prog.s=e.loaded/e.total;upd();}}),
      loadGLB('assets/astronaut.glb',e=>{if(e.total){prog.a=e.loaded/e.total;upd();}}),
      loadGLB('assets/spider.glb').catch(e=>{console.warn('spider glb',e);return null;}),
      loadGLB('assets/gun.glb').catch(e=>{console.warn('gun glb',e);return null;})]);SPIDER_GLB=spi;
    // Santi's pistol (GUN_v1): origin in the grip where the fist goes, barrel along +Z, muzzle at the glowing mouth
    if(gun){for(const c of [...pistol.children])if(c!==muzzle)c.visible=false;const g=gun.scene;
      P.gunMats=[];g.traverse(o=>{if(o.isMesh){o.castShadow=true;const m=o.material;m.envMapIntensity=1.1;minRough(m,0.18);if(m.emissive)P.gunMats.push([m,m.emissiveIntensity]);}});
      pistol.add(g);muzzle.position.set(0,0.0887,0.345);PGRIP.set(0,0,0);XP.g1=g;}
    ship.scene.traverse(o=>{if(o.isMesh&&o.material){o.castShadow=true;o.receiveShadow=true;let m=o.material;
      // a thin clear lacquer over the baked gold makes highlights read as polished metal (desktop only)
      if(!isTouch){const pm=new THREE.MeshPhysicalMaterial();THREE.MeshStandardMaterial.prototype.copy.call(pm,m);pm.clearcoat=0.35;pm.clearcoatRoughness=0.14;o.material=m=pm;}
      m.envMapIntensity=1.0;minRough(m,0.2);const an=Math.min(isTouch?4:8,renderer.capabilities.getMaxAnisotropy());for(const k of ['map','normalMap','roughnessMap','metalnessMap','aoMap'])if(m[k]){m[k].anisotropy=an;m[k].needsUpdate=true;}}});scene.add(ship.scene);
    for(const [n,sp] of [['SM_HEADS_Ship_TailFan_Rotor',2.2],['SM_HEADS_Ship_ExhaustTurbine_L',6],['SM_HEADS_Ship_ExhaustTurbine_R',-6],['SM_HEADS_Ship_Spinner_L',1.5],['SM_HEADS_Ship_Spinner_R',-1.5]]){const o=ship.scene.getObjectByName(n);if(o)ROTORS.push([o,sp]);}
    setupAstronaut(astro);P.rig=new THREE.Group();scene.add(P.rig);P.rig.add(P.model);P.model.position.set(0,-1.0*AS,0);P.pos.set(10,1.2,9);P.yaw=Math.PI/2+0.35;P.pitch=0.12;
    scene.traverse(o=>{if(o.isLight)o.layers.enable(1);});
    $('load').textContent='';$('play').disabled=false;$('play').textContent='JUGAR';
    lateStart(gun);
  }catch(err){$('load').textContent='No se pudieron cargar los modelos. Recarga la página.';console.error(err);}
})();

// v74: the models round 1 does not need download in the background as soon as the menu is ready: one file at a time, in the order the game asks for them
// (EXTRA POWER pistol: round 4 · Escupidora: round 6 · Incineradora: round 8 · egg: round 9), at low priority so the sounds and the opening film of JUGAR go first.
// Each one flips LATE.s[k] when it is in (1) or has failed twice (2, the old fallback applies); whoever needs it checks lateOk(k) (13-spiders.js) and waits.
function lateStart(gun){
  const jobs=[
    ['gun2','assets/gun2.glb',gltf=>{ // EXTRA POWER gun (GUN2_v1): same grip point and hand transform as the pistol, only the model changes
      if(!gun)return;const g=gltf.scene;P.gun2Mats=[];g.traverse(o=>{if(o.isMesh){o.castShadow=true;const m=o.material;m.envMapIntensity=1.1;minRough(m,0.18);if(m.emissive)P.gun2Mats.push([m,m.emissiveIntensity]);}});
      g.visible=false;pistol.add(g);XP.g2=g;}],
    ['crab','assets/crab.glb',gltf=>{CRAB_GLB=gltf;}],
    ['bip','assets/spider_biped.glb',gltf=>{BIPED_GLB=gltf;}],
    ['egg','assets/egg.glb',gltf=>{EGG_GLB=gltf;gltf.scene.traverse(o=>{if(o.isMesh){o.material.envMapIntensity=1.0;}});}]];
  (async()=>{for(const [k,url,use] of jobs){let gltf=null;
    for(let i=0;i<2&&!gltf;i++){try{gltf=await loadGLB(url,null,true);}catch(e){console.warn(k+' glb',e);if(!i)await new Promise(r=>setTimeout(r,3000));}}
    try{if(gltf)use(gltf);LATE.s[k]=gltf?1:2;}catch(e){console.warn(k+' glb',e);LATE.s[k]=2;}}})();}
