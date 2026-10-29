/* ================= SHIP ZONES (what the spiders eat) ================= */
// tail -> nose. Each zone has 4 hull patches; a patch is chewed open by spiders and welded shut by the astronaut.
const ZONES=[{name:'MOTORES',art:'LOS ',z0:-14.5,z1:-8},{name:'REACTOR',art:'EL ',z0:-8,z1:0},{name:'BODEGA',art:'LA ',z0:0,z1:11},{name:'CABINA',art:'LA ',z0:11,z1:21.5}];
const PATCHES=[];
const PATCH_VS=`attribute float aR;varying float vR;void main(){vR=aR;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const PATCH_FS=`uniform float uLevel,uBroken,uTime;varying float vR;
  void main(){if(vR>uLevel)discard;float e=smoothstep(uLevel-.2,uLevel,vR);float pulse=.6+.4*sin(uTime*6.);
    vec3 inner=mix(vec3(.004,.002,.001),vec3(.16,.012,.0)*pulse,uBroken*smoothstep(.45,1.,vR));
    vec3 rim=mix(vec3(3.2,1.2,.25),vec3(3.6,.35,.15)*pulse,uBroken);
    gl_FragColor=vec4(mix(inner,rim,e),1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
// jagged disc conformed to the hull ellipse; aR = 0 centre .. 1 rim (the shader opens it from the centre out)
function buildPatchGeo(z,th){const SEG=22,RING=6,R=[];for(let i=0;i<SEG;i++)R.push(0.74*(0.62+Math.random()*0.6)*(i%2?0.88:1.08));
  const pos=[],ar=[],idx=[],p=new THREE.Vector3(),n=new THREE.Vector3();
  hullPoint(z,th,p,n);p.addScaledVector(n,0.015);pos.push(p.x,p.y,p.z);ar.push(0);
  for(let k=1;k<=RING;k++)for(let i=0;i<SEG;i++){const a=i/SEG*Math.PI*2,r=R[i]*k/RING,u=Math.cos(a)*r*1.3,v=Math.sin(a)*r;
    const zz=z+v,[ha,hb]=hullAB(zz);hullPoint(zz,th+u*2/(ha+hb),p,n);p.addScaledVector(n,0.015);pos.push(p.x,p.y,p.z);ar.push(k/RING);}
  for(let i=0;i<SEG;i++)idx.push(0,1+i,1+(i+1)%SEG);
  for(let k=1;k<RING;k++){const o0=1+(k-1)*SEG,o1=1+k*SEG;for(let i=0;i<SEG;i++){const i1=(i+1)%SEG;idx.push(o0+i,o1+i,o1+i1,o0+i,o1+i1,o0+i1);}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('aR',new THREE.Float32BufferAttribute(ar,1));
  g.setIndex(idx);g.computeBoundingSphere();g.userData.R=R;return g;}
// torn hull plating: thin curled petals rooted on the rim of the breach, bending outward as it opens
const PETAL_PULSE={value:0};
const PETAL_MAT=[false,true].map(hot=>{const m=new THREE.MeshStandardMaterial({color:0xffffff,metalness:0.95,roughness:0.4,side:THREE.DoubleSide,vertexColors:true,flatShading:false,emissive:0x1c1004,emissiveIntensity:1,envMapIntensity:0.85});
  if(hot){m.onBeforeCompile=sh=>{sh.uniforms.uPulse=PETAL_PULSE;
    sh.vertexShader='attribute float aHot;varying float vHot;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvHot=aHot;');
    sh.fragmentShader='uniform float uPulse;varying float vHot;\n'+sh.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=vec3(3.2,0.85,0.16)*vHot*uPulse;');};
   m.customProgramCacheKey=()=>'petalHot';}
  return m;});
function petalGeo(len,w,phi,curl){const S=8,pos=[],col=[],hot=[],idx=[];let x=-0.03,y=-0.03,a=phi;const cup=0.22+Math.random()*0.18,tw=(Math.random()-0.5)*0.5;
  for(let s=0;s<=S;s++){const k=s/S,tip=s===S;
    let ww=w*Math.pow(1-k,0.75)*(0.8+0.4*Math.random())+0.004;if(tip)ww=0.004;const j=(Math.random()-0.5)*w*0.22+(tip?(Math.random()-0.5)*w*0.5:0);
    const nx=-Math.sin(a),ny=Math.cos(a),cz=Math.sin(k*3.1+tw*6)*w*0.05; // across-strip bulge (cupped like bent sheet metal)
    const e=ww*(0.5+0.12*(Math.random()-0.5));
    pos.push(x,y,-e+j+cz, x+nx*cup*ww*0.5,y+ny*cup*ww*0.5,j+cz, x,y,e+j+cz);
    const c=(1-0.3*k),edge=0.5*c,sc=0.82+0.18*Math.random();
    col.push(edge*0.9,edge*0.58,edge*0.24, c*0.9*sc,c*0.64*sc,c*0.28*sc, edge*0.9,edge*0.58,edge*0.24);hot.push(k*k*0.8,k*k,k*k*0.8);
    if(s<S){x+=Math.cos(a)*len/S;y+=Math.sin(a)*len/S;a+=curl*0.5*(0.6+0.8*Math.random());}}
  for(let s=0;s<S;s++){const o=s*3;idx.push(o,o+3,o+1,o+1,o+3,o+4, o+1,o+4,o+2,o+2,o+4,o+5);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
  g.setAttribute('aHot',new THREE.Float32BufferAttribute(hot,1));g.setIndex(idx);g.computeVertexNormals();return g;}
function buildPetals(pa){const R=pa.mesh.geometry.userData.R,K=11;pa.petals=[];
  for(let i=0;i<K;i++){const a=(i+0.2+Math.random()*0.6)/K*Math.PI*2,fi=a/(Math.PI*2)*R.length,i0=Math.floor(fi)%R.length,i1=(i0+1)%R.length,f=fi-Math.floor(fi);
    const m=new THREE.Mesh(petalGeo(THREE.MathUtils.randFloat(0.3,0.85),THREE.MathUtils.randFloat(0.28,0.48),THREE.MathUtils.randFloat(0.22,0.62),THREE.MathUtils.randFloat(0.15,0.32)),PETAL_MAT[0]);
    m.visible=false;world.add(m);pa.petals.push({m,a,r:R[i0]*(1-f)+R[i1]*f,th0:0.08+0.72*Math.random()});}
  pa.petalD=-1;}
function updatePetals(pa){const d=pa.hp<=0?1:1-pa.hp/CFG.patchHp;if(Math.abs(d-pa.petalD)<0.004&&(pa.hp<=0)===pa.petalB)return;pa.petalD=d;pa.petalB=pa.hp<=0;
  const L=0.25+0.75*d,p=V1,n=V2,c=V3;hullPoint(pa.z,pa.th,c);
  for(const q of pa.petals){const g=pa.hp<=0?1:THREE.MathUtils.clamp((d-q.th0)/0.18,0,1);q.m.visible=g>0.02&&d>0.02;if(!q.m.visible)continue;
    const r=q.r*L*0.96,u=Math.cos(q.a)*r*1.3,v=Math.sin(q.a)*r,zz=pa.z+v,[ha,hb]=hullAB(zz);hullPoint(zz,pa.th+u*2/(ha+hb),p,n);
    const out=p.clone().sub(c);out.addScaledVector(n,-out.dot(n)).normalize();const sd=new THREE.Vector3().crossVectors(out,n);
    M4.makeBasis(out,n,sd);q.m.quaternion.setFromRotationMatrix(M4);q.m.position.copy(p);q.m.scale.set(g,g,0.4+0.6*g);q.m.material=PETAL_MAT[pa.hp<=0?1:0];}}
{const TH=[0.3,1.15,2.0,2.85];
 ZONES.forEach((Z,zi)=>{Z.idx=zi;Z.patches=[];Z.nest=false;Z.eaters=0;Z.alarmT=0;Z.bite=null;
  for(let k=0;k<4;k++){const z=Z.z0+(k+0.5)/4*(Z.z1-Z.z0);let th=TH[(k*2+zi)%4];
    const clear=th2=>{const q=hullPoint(z,th2,new THREE.Vector3());if(q.distanceTo(HATCH)<2.8)return false; // keep the hatch clear
      for(const e of ENGINES){_w.subVectors(e.b,e.a);const k=THREE.MathUtils.clamp(_v.subVectors(q,e.a).dot(_w)/_w.lengthSq(),0,1);
        if(q.distanceTo(_w.multiplyScalar(k).add(e.a))<e.r+1.4)return false;}return true;}; // ...and away from pylons / nacelles
    for(let tries=0;tries<8&&!clear(th);tries++)th+=th<Math.PI/2?0.22:-0.22;
    const mat=new THREE.ShaderMaterial({vertexShader:PATCH_VS,fragmentShader:PATCH_FS,uniforms:{uLevel:{value:0},uBroken:{value:0},uTime:{value:0}},
      side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
    const mesh=new THREE.Mesh(buildPatchGeo(z,th),mat);mesh.visible=false;world.add(mesh);
    const n=new THREE.Vector3(),pos=hullPoint(z,th,new THREE.Vector3(),n);
    const pa={zone:Z,z,th,pos,n,hp:CFG.patchHp,mesh,mat,prog:0,leak:0,sparkT:Math.random()};buildPetals(pa);Z.patches.push(pa);PATCHES.push(pa);}});}
const zoneHp=Z=>Z.patches.reduce((s,p)=>s+p.hp,0)/(Z.patches.length*CFG.patchHp);
const shipHp=()=>PATCHES.reduce((s,p)=>s+p.hp,0)/(PATCHES.length*CFG.patchHp);
// the worse the hull, the faster every breach bleeds: x1 above 85 % ... x2 at 20 %
// v35: no more 'damaged ship bleeds faster' (too much to read); instead the first rounds simply leak less
function leakMult(){return 1;}
function leakScale(){return [0.6,0.75,0.85,0.95][wave]??1;}
let cargo=0,score=0,repairs=0;
// trichomes escape through a hole into space (they can be vacuumed back)
function leakFrom(pa,n){n=Math.min(n,cargo);if(n<=0)return;cargo-=n;
  const k=spawnLoose(_lk.copy(pa.pos).addScaledVector(pa.n,0.3),n,1.6,pa.n);lostN+=n-k;tutorialEvent('leak');
}
const _lk=new THREE.Vector3();
function damagePatch(pa,dmg){if(pa.hp<=0||state!=='play')return;const before=pa.hp;pa.hp=Math.max(0,pa.hp-dmg);
  pa.leak+=(before-pa.hp)*CFG.leakPerHp*(pa.zone.name==='BODEGA'?CFG.bodegaLeak:1)*leakScale();
  if(pa.leak>=1){const n=Math.floor(pa.leak);pa.leak-=n;leakFrom(pa,n);}
  const Z=pa.zone;if(Z.alarmT<=0){Z.alarmT=7;sfx('alarm');tutorialEvent('eat');say(ZONE_VO[Z.name],3,{cd:12});}
  if(pa.hp===0){burst(pa.pos,0xff5020,10);sfx('crack',pa.pos);
    if(!Z.nest&&Z.patches.every(p=>p.hp<=0)){Z.nest=true;toSpawn+=2;WB.left+=2;
      showMsg('¡NIDO EN '+Z.art+Z.name+'!','Las arañas entran por ahí · repárala para cerrarlo',3);sfx('nest');shake(0.2);
      if(Z.name==='BODEGA'){tutorialEvent('nestBodega');say('zn_hold_nest',4);}}}
  if(shipHp()<=0)endGame(false,'ship');}
function repairPatch(pa,perfect,free=false){pa.hp=CFG.patchHp;pa.prog=0;pa.leak=0;const Z=pa.zone;
  if(!free){repairs++;if(perfect)stats.perfect++;addPts(perfect?PTS.perfect:PTS.repair);}
  if(Z.nest){Z.nest=false;if(!free){showMsg(Z.name+' SELLADA','Nido cerrado',2);say('zn_sealed',3);}}
  burst(_lk.copy(pa.pos).addScaledVector(pa.n,0.2),perfect?0xffe08a:0x7fffd0,perfect?28:14);
  if(free)return;
  floatText(_lk.copy(pa.pos).addScaledVector(pa.n,0.8),(perfect?'¡PERFECTO! +':'REPARADO +')+ptsVal(perfect?PTS.perfect:PTS.repair),'gain');sfx(perfect?'perfect':'repaired',pa.pos);
  if(perfect)shake(0.06);}
// eating turns: only a handful of spiders chew the hull at the same time (2 early on, slowly up to 6)
const eatSlots=()=>Math.min(8,3+Math.floor(wave/2));
function eatSlotFree(s){let n=0;for(const o of spiders)if(o!==s&&o.patch&&o.patch.hp>0)n++;return n<eatSlots();}
function pickPatch(s){let best=null,bw=-1;
  for(const pa of PATCHES){if(pa.hp<=0)continue;let taken=0;for(const o of spiders)if(o!==s&&o.patch===pa)taken++;if(taken>=2)continue;
    const w=(0.4+Math.random())/(1+Math.abs(pa.z-s.z)*0.15+taken*1.5);if(w>bw){bw=w;best=pa;}}
  return best;}
// repair state + weld visuals
const R={pa:null,on:false,band:0.55,useBand:true,weldT:0,sfxT:0};
const weldLight=new THREE.PointLight(0x9fffe8,0,7,2);scene.add(weldLight);
const weldBeam=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),new THREE.LineBasicMaterial({color:new THREE.Color(2,4,3.6)}));
weldBeam.frustumCulled=false;weldBeam.visible=false;scene.add(weldBeam);

