/* ================= LOAD ================= */
(async()=>{
  try{
    const prog={a:0,s:0};const upd=()=>$('load').textContent=`Cargando modelos ${Math.round((prog.a+prog.s)/2*100)}%`;
    loadMod('assets/hud4.js').then(m=>{const H=m.default;for(const el of document.querySelectorAll('img[data-k]'))if(H[el.dataset.k])el.src=H[el.dataset.k];
      const rs=document.documentElement.style;rs.setProperty('--mira',`url(${H['mira']})`);rs.setProperty('--fill-en',`url(${H['energia-relleno']})`);rs.setProperty('--ico-en',`url(${H['icono-energia']})`);
      HUD4.art=H;}).catch(e=>console.warn('hud4 art',e));
    loadMod('assets/endui.js').then(m=>{const E=m.default;$('endPanel').style.setProperty('--end-frame',`url(${E.frame})`);$('again').style.setProperty('--end-btn',`url(${E.button})`);
      try{new FontFace('TekturE',`url(${E.font})`,{weight:'400 900'}).load().then(f=>document.fonts.add(f)).catch(e=>console.warn('end font',e));}catch(e){}}).catch(e=>console.warn('end ui',e));
    loadMod('assets/hud.js').then(m=>{const H=m.default;$('dBase').src=H.base;$('dSegs').src=H.segs;
      for(let k=0;k<4;k++)$('dz'+k).firstChild.src=H['z'+k];}).catch(e=>console.warn('hud art',e));
    const [ship,astro,spi,crb,gun,egg,bip,gun2]=await Promise.all([
      loadGLB('assets/ship.glb',e=>{if(e.total){prog.s=e.loaded/e.total;upd();}}),
      loadGLB('assets/astronaut.glb',e=>{if(e.total){prog.a=e.loaded/e.total;upd();}}),
      loadGLB('assets/spider.glb').catch(e=>{console.warn('spider glb',e);return null;}),
      loadGLB('assets/crab.glb').catch(e=>{console.warn('crab glb',e);return null;}),
      loadGLB('assets/gun.glb').catch(e=>{console.warn('gun glb',e);return null;}),
      loadGLB('assets/egg.glb').catch(e=>{console.warn('egg glb',e);return null;}),
      loadGLB('assets/spider_biped.glb').catch(e=>{console.warn('biped glb',e);return null;}),
      loadGLB('assets/gun2.glb').catch(e=>{console.warn('gun2 glb',e);return null;})]);SPIDER_GLB=spi;CRAB_GLB=crb;EGG_GLB=egg;BIPED_GLB=bip;
    if(egg)egg.scene.traverse(o=>{if(o.isMesh){o.material.envMapIntensity=1.0;}});
    // Santi's pistol (GUN_v1): origin in the grip where the fist goes, barrel along +Z, muzzle at the glowing mouth
    if(gun){for(const c of [...pistol.children])if(c!==muzzle)c.visible=false;const g=gun.scene;
      P.gunMats=[];g.traverse(o=>{if(o.isMesh){o.castShadow=true;const m=o.material;m.envMapIntensity=1.1;minRough(m,0.18);if(m.emissive)P.gunMats.push([m,m.emissiveIntensity]);}});
      pistol.add(g);muzzle.position.set(0,0.0887,0.345);PGRIP.set(0,0,0);XP.g1=g;}
    // EXTRA POWER gun (GUN2_v1): same grip point and hand transform as the pistol, only the model changes
    if(gun2&&gun){const g=gun2.scene;P.gun2Mats=[];g.traverse(o=>{if(o.isMesh){o.castShadow=true;const m=o.material;m.envMapIntensity=1.1;minRough(m,0.18);if(m.emissive)P.gun2Mats.push([m,m.emissiveIntensity]);}});
      g.visible=false;pistol.add(g);XP.g2=g;}
    ship.scene.traverse(o=>{if(o.isMesh&&o.material){o.castShadow=true;o.receiveShadow=true;let m=o.material;
      // a thin clear lacquer over the baked gold makes highlights read as polished metal (desktop only)
      if(!isTouch){const pm=new THREE.MeshPhysicalMaterial();THREE.MeshStandardMaterial.prototype.copy.call(pm,m);pm.clearcoat=0.35;pm.clearcoatRoughness=0.14;o.material=m=pm;}
      m.envMapIntensity=1.0;minRough(m,0.2);const an=Math.min(isTouch?4:8,renderer.capabilities.getMaxAnisotropy());for(const k of ['map','normalMap','roughnessMap','metalnessMap','aoMap'])if(m[k]){m[k].anisotropy=an;m[k].needsUpdate=true;}}});scene.add(ship.scene);
    for(const [n,sp] of [['SM_HEADS_Ship_TailFan_Rotor',2.2],['SM_HEADS_Ship_ExhaustTurbine_L',6],['SM_HEADS_Ship_ExhaustTurbine_R',-6],['SM_HEADS_Ship_Spinner_L',1.5],['SM_HEADS_Ship_Spinner_R',-1.5]]){const o=ship.scene.getObjectByName(n);if(o)ROTORS.push([o,sp]);}
    setupAstronaut(astro);P.rig=new THREE.Group();scene.add(P.rig);P.rig.add(P.model);P.model.position.set(0,-1.0*AS,0);P.pos.set(10,1.2,9);P.yaw=Math.PI/2+0.35;P.pitch=0.12;
    scene.traverse(o=>{if(o.isLight)o.layers.enable(1);});
    $('load').textContent='';$('play').disabled=false;$('play').textContent='JUGAR';
  }catch(err){$('load').textContent='No se pudieron cargar los modelos. Recarga la página.';console.error(err);}
})();


