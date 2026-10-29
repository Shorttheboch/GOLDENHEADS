/* ================= FEEDBACK (juice) ================= */
let shakeAmp=0,hitStop=0;function shake(a){shakeAmp=Math.min(0.6,Math.max(shakeAmp,a));}
const fxLayer=$('fxLayer');const _pv=new THREE.Vector3();
function floatText(p,txt,cls){_pv.copy(p).project(camera);if(_pv.z>1||Math.abs(_pv.x)>1.05||Math.abs(_pv.y)>1.05)return;
  const d=document.createElement('div');d.className='ft '+cls;d.textContent=txt;
  d.style.left=((_pv.x+1)/2*innerWidth)+'px';d.style.top=((1-_pv.y)/2*innerHeight)+'px';fxLayer.appendChild(d);setTimeout(()=>d.remove(),1200);}
const flashLight=new THREE.PointLight(0xff6030,0,16,2);scene.add(flashLight);let flashT=0;
function deathFlash(p){flashLight.position.copy(p);flashT=1;}
const muzzleFlash=new THREE.Sprite(new THREE.SpriteMaterial({color:new THREE.Color(4,4,4),map:glowTex('rgba(255,250,220,1)','rgba(255,150,60,.7)'),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));
muzzleFlash.scale.setScalar(0.55);muzzleFlash.visible=false;scene.add(muzzleFlash);let muzzleT=0;
// anamorphic streaks: thin horizontal lines on the brightest sources (sprites always face the lens, so they stay horizontal on screen)
const streakTex=(()=>{const c=document.createElement('canvas');c.width=256;c.height=16;const x=c.getContext('2d');
  const g=x.createLinearGradient(0,0,256,0);g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(0.42,'rgba(255,255,255,.55)');g.addColorStop(0.5,'rgba(255,255,255,1)');g.addColorStop(0.58,'rgba(255,255,255,.55)');g.addColorStop(1,'rgba(255,255,255,0)');
  x.fillStyle=g;x.fillRect(0,0,256,16);x.globalCompositeOperation='destination-in';const v=x.createLinearGradient(0,0,0,16);v.addColorStop(0,'rgba(0,0,0,0)');v.addColorStop(0.5,'rgba(0,0,0,1)');v.addColorStop(1,'rgba(0,0,0,0)');
  x.fillStyle=v;x.fillRect(0,0,256,16);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;})();
function mkStreak(col,sx,sy){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:streakTex,color:col,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));s.scale.set(sx,sy,1);s.visible=false;s.renderOrder=4;scene.add(s);return s;}
const STREAK={muz:mkStreak(new THREE.Color(2.4,1.7,0.9),2.2,0.045),weld:mkStreak(new THREE.Color(0.8,2.3,2.1),3.0,0.06)};
const FLARE={k:0,el:null,v:new THREE.Vector3(),a:new THREE.Vector3()};let fovK=0;
function updateLook(dt,t){GRADE.uniforms.uTime.value=t;
  // streaks ride on the muzzle flash and on the weld spark
  STREAK.muz.visible=muzzleFlash.visible;if(STREAK.muz.visible){STREAK.muz.material.color.setRGB(...(XP.on?[0.7,1.9,3.0]:[2.4,1.7,0.9]));STREAK.muz.position.copy(muzzleFlash.position);STREAK.muz.scale.x=1.6+Math.random()*1.2;}
  const wv=weldLight.intensity>0&&state==='play';STREAK.weld.visible=wv;if(wv){STREAK.weld.position.copy(weldLight.position);STREAK.weld.scale.x=2.2+Math.random()*1.6;STREAK.weld.material.opacity=0.6+Math.random()*0.4;}
  // sun flare: only while the sun is in frame and nothing (hull, wings, rocks) stands in front of it
  if(!FLARE.el){FLARE.el=$('flare');FLARE.parts=[...FLARE.el.children];}
  let want=0;const v=FLARE.v.copy(camera.position).addScaledVector(SUN_DIR,900).project(camera);
  if(v.z<1&&Math.abs(v.x)<1.3&&Math.abs(v.y)<1.3&&(state==='play'||state==='menu')){
    const occ=shipBetween(camera.position,FLARE.a.copy(camera.position).addScaledVector(SUN_DIR,26))||shipBetween(camera.position,FLARE.a.copy(camera.position).addScaledVector(SUN_DIR,80));
    want=occ?0:1-THREE.MathUtils.smoothstep(Math.max(Math.abs(v.x),Math.abs(v.y)),0.8,1.3);}
  FLARE.k=THREE.MathUtils.damp(FLARE.k,want,want<FLARE.k?12:4,dt);
  if(FLARE.k>0.01){const W=innerWidth,H=innerHeight,sx=(v.x+1)/2*W,sy=(1-v.y)/2*H,cx=W/2,cy=H/2,[fs,fc,...gh]=FLARE.parts;
    fs.style.left=sx+'px';fs.style.top=sy+'px';fc.style.left=sx+'px';fc.style.top=sy+'px';
    [0.55,1.15,1.55,1.95].forEach((k,i)=>{gh[i].style.left=(sx+(cx-sx)*k)+'px';gh[i].style.top=(sy+(cy-sy)*k)+'px';});
    FLARE.el.style.opacity=(FLARE.k*0.85).toFixed(3);}else if(FLARE.el.style.opacity!=='0')FLARE.el.style.opacity='0';}
const nozzleGlow=new THREE.Sprite(new THREE.SpriteMaterial({map:dotTex,color:new THREE.Color(0xffc860).multiplyScalar(2.6),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true,opacity:0}));
nozzleGlow.scale.setScalar(0.4);scene.add(nozzleGlow);
const WHITE=new THREE.Color(1,1,1);

