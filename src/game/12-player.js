/* ================= PLAYER ================= */
const P={pos:new THREE.Vector3(),vel:new THREE.Vector3(),yaw:0,pitch:0,hp:CFG.hpMax,dust:0,fireT:0,inv:0,
  model:null,bones:{},rest:{},hose:[],hoseOff:new THREE.Vector3(),nozzleLocal:new THREE.Vector3(),mixer:null};
// Embedded GLB textures become blob: URLs; fetch() of those is blocked in the hosted page,
// so remember each Blob and decode it directly with createImageBitmap.
const blobMap=new Map();const _cou=URL.createObjectURL.bind(URL);
URL.createObjectURL=o=>{const u=_cou(o);if(o instanceof Blob)blobMap.set(u,o);return u;};
const _ibl=THREE.ImageBitmapLoader.prototype.load;
THREE.ImageBitmapLoader.prototype.load=function(url,onLoad,onProgress,onError){
  const b=blobMap.get(url);if(!b)return _ibl.call(this,url,onLoad,onProgress,onError);
  createImageBitmap(b,Object.assign({},this.options,{colorSpaceConversion:'none'})).then(img=>{onLoad&&onLoad(img);this.manager.itemEnd(url);},e=>{onError&&onError(e);this.manager.itemError(url);this.manager.itemEnd(url);});
  this.manager.itemStart(url);return {};};
const loader=new GLTFLoader();loader.setMeshoptDecoder(MeshoptDecoder);
const loadMod=p=>window.__A&&window.__A[p]!==undefined?Promise.resolve({default:window.__A[p]}):import(/* @vite-ignore */ new URL(p,document.baseURI).href);
// v61: assets are real files (assets/models, assets/sfx, assets/vo, assets/ui); the small assets/*.js manifests list their paths.
// A base64 string (the old packaging, still used by a single-file build through window.__A) keeps working.
const isAssetPath=s=>typeof s==='string'&&/^(assets\/|\.\/|\/|https?:)/.test(s);
const assetBuf=s=>isAssetPath(s)?fetch(new URL(s,document.baseURI).href).then(r=>{if(!r.ok)throw new Error(r.status+' '+s);return r.arrayBuffer();})
  :Promise.resolve(Uint8Array.from(atob(s),c=>c.charCodeAt(0)).buffer);
// v61: start all the downloads of a sound list at once (the browser fetches them in parallel); the decoding still goes in the original order
const assetBufs=D=>{const o={};for(const [id,arr] of Object.entries(D))if(id.slice(0,2)!=='__'&&Array.isArray(arr))o[id]=arr.map(s=>{const q=assetBuf(s);q.catch(()=>{});return q;});return o;};
async function loadGLB(url,onP){
  const A=window.__A&&window.__A[url+'.js'];
  const bin=A!==undefined?Uint8Array.from(atob(A),c=>c.charCodeAt(0)).buffer:await assetBuf(url.replace(/^assets\//,'assets/models/'));
  onP&&onP({loaded:1,total:1});
  return new Promise((res,rej)=>loader.parse(bin,'',res,rej));}

// fully rigged fingers: 3 joints per finger + thumb
const FINGERS=['Thumb','Index','Middle','Ring','Pinky'].flatMap(f=>[f+'1',f+'2',f+'3']);
function setupAstronaut(gltf){
  const m=gltf.scene;P.model=m;scene.add(m);m.scale.setScalar(AS);m.updateMatrixWorld(true);
  m.traverse(o=>{if(o.isMesh){o.frustumCulled=false;const mt=o.material;
    if(mt&&/Glass/i.test(mt.name)){o.material=new THREE.MeshStandardMaterial({color:0x9fb8c8,metalness:0,roughness:0.04,transparent:true,opacity:0.22,depthWrite:false,envMapIntensity:2.5});o.renderOrder=2;}
    else if(mt){mt.envMapIntensity=1.0;if(/Suit|Hose/.test(mt.name))mt.roughness=Math.min(mt.roughness,0.3);if(mt.isMeshStandardMaterial)minRough(mt,0.08);}o.castShadow=true;o.receiveShadow=true;}});
  const need=['LeftUpLeg','RightUpLeg','LeftLeg','RightLeg','LeftFoot','RightFoot','LeftArm','LeftForeArm','LeftHand','LeftHand_end','RightArm','RightForeArm','RightHand','RightHand_end','Hose_Grip','Spine1','Spine2','Head',
    ...FINGERS.map(f=>'LeftHand'+f),...FINGERS.map(f=>'RightHand'+f)];
  for(const n of need){const b=m.getObjectByName(n);if(b){P.bones[n]=b;P.rest[n]=b.quaternion.clone();}}
  for(let i=0;i<10;i++){const b=m.getObjectByName('Hose_0'+i);P.hose.push(b);P.rest['Hose_0'+i]=b.quaternion.clone();}
  m.updateMatrixWorld(true);
  P.len={};for(const [a,c] of [['RightArm','RightForeArm'],['RightForeArm','RightHand'],['LeftArm','LeftForeArm'],['LeftForeArm','LeftHand']])
    P.len[a]=P.bones[a].getWorldPosition(new THREE.Vector3()).distanceTo(P.bones[c].getWorldPosition(new THREE.Vector3()));
  // backpack tank: glowing gold fill behind the backpack glass panel (Blender coords x -0.116..0.136, y .366-.384, z 1.264-1.514)
  {const piv=new THREE.Group();piv.position.set(0.01*AS,1.272*AS,-0.374*AS);piv.scale.setScalar(AS);scene.add(piv);
   const g=new THREE.BoxGeometry(0.228,0.234,0.016,1,6,1).translate(0,0.117,0);
   const mat=new THREE.ShaderMaterial({uniforms:{uLevel:{value:0},uTime:{value:0},uSuck:{value:0}},
     vertexShader:'varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
     fragmentShader:`uniform float uLevel,uTime,uSuck;varying vec3 vP;
       float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
       void main(){float y=vP.y/0.234,x=vP.x/0.228+0.5;
         float surf=uLevel+0.018*sin(x*17.+uTime*(2.+uSuck*6.))+0.01*sin(x*33.-uTime*4.7);if(y>surf||uLevel<0.004)discard;
         vec3 col=mix(vec3(0.22,0.1,0.015),vec3(0.62,0.34,0.06),0.35+0.65*y);
         float g=0.;for(int k=0;k<3;k++){float fk=float(k),sc=70.+fk*38.;
           vec2 q=vec2(x,y)*sc+vec2(uTime*(0.25+0.15*fk)*(1.+uSuck*4.),-uTime*(0.05+0.04*fk)*(1.+uSuck*6.));
           vec2 id=floor(q),f=fract(q)-0.5;float r=h(id+fk*7.13);vec2 o=vec2(h(id+3.1),h(id+5.7))-0.5;
           g+=smoothstep(0.3,0.,length(f-o*0.5))*step(0.25,r)*(0.55+0.45*sin(uTime*(5.+r*6.)+r*40.));}
         col+=vec3(1.,0.66,0.2)*g*0.7;col+=vec3(1.,0.62,0.2)*smoothstep(0.035,0.,surf-y)*0.6;
         gl_FragColor=vec4(col*0.95,1.);
         #include <tonemapping_fragment>
         #include <colorspace_fragment>
       }`});
   const fill=new THREE.Mesh(g,mat);piv.add(fill);
   const glow=new THREE.PointLight(0xffb040,0,0.9,2);glow.position.set(0,0.117,-0.12);piv.add(glow);
   piv.updateMatrixWorld(true);P.bones.Spine2.attach(piv);
   P.tank={piv,fill,mat,glow,base:piv.scale.clone(),level:0};
   // v64 (Santi): charge screen in the recessed panel under the glass (Blender "backpack": x -0.1015..0.1222, y 0.3486, z 1.0984..1.2407, facing +Y = backwards).
   // A simple load bar (load, not a battery): black when the tank is empty, the blue bar fills left to right and the light grows with the load;
   // full = all lit and pulsing. Soft glow around the bar (off on the lowest quality levels; the bloom adds more where the device can afford it). PC and phone.
   {const sm=new THREE.ShaderMaterial({uniforms:{uLevel:{value:0},uTime:{value:0},uSuck:{value:0},uGlow:{value:1}},
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`uniform float uLevel,uTime,uSuck,uGlow;varying vec2 vUv;
        float sdBox(vec2 p,vec2 b,float r){vec2 q=abs(p)-b+r;return length(max(q,0.))+min(max(q.x,q.y),0.)-r;}
        void main(){vec2 p=(vUv-0.5)*vec2(1.6,1.);float lv=clamp(uLevel,0.,1.),full=step(0.985,lv),pulse=full*(0.5+0.5*sin(uTime*4.));
          vec3 blue=vec3(0.04,0.36,1.);float light=lv*(0.85+0.15*uSuck)+0.4*pulse;
          vec3 col=vec3(0.0015,0.002,0.004)+blue*(0.03*lv+0.05*pulse);         // the screen: black, a faint blue as it fills
          col*=0.86+0.14*sin(vUv.y*260.);                                         // faint scanlines
          float tr=sdBox(p,vec2(0.6,0.085),0.085);                               // the bar's track
          col+=blue*smoothstep(0.01,0.,abs(tr)-0.008)*(0.04+0.55*light);       // thin outline, almost invisible when empty
          float fx=(p.x+0.57)/1.14,inside=step(tr,-0.022),fill=inside*step(fx,lv);
          float sheen=0.78+0.22*sin(fx*36.-uTime*(3.+uSuck*9.));                 // a slow shimmer running along the load
          col+=blue*fill*(0.55+0.5*lv)*sheen*(1.+0.6*pulse);
          col+=vec3(0.45,0.82,1.)*inside*smoothstep(0.03,0.,abs(fx-lv))*step(0.01,lv)*(1.-full)*0.7; // brighter leading edge
          col+=blue*exp(-max(tr,0.)*13.)*(0.22*lv+0.35*pulse)*0.65*uGlow;      // soft glow around the bar
          gl_FragColor=vec4(col,1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`});
    const scr=new THREE.Mesh(new THREE.PlaneGeometry(0.214,0.134),sm); // a hair inside the 0.224 x 0.142 recess, so its rim stays visible
    scr.rotation.y=Math.PI;scr.position.set(0.0003,-0.1024,0.0239);piv.add(scr);P.scr=scr;}}
  // effector offset: grip head expressed in Hose_09 space (bind pose)
  const g=P.bones.Hose_Grip.getWorldPosition(new THREE.Vector3());P.hoseOff.copy(P.hose[9].worldToLocal(g.clone()));
  // nozzle points model-forward (+Z) in bind pose -> store in grip-local space
  const q=P.bones.Hose_Grip.getWorldQuaternion(new THREE.Quaternion()).invert();
  const mq=m.getWorldQuaternion(new THREE.Quaternion());
  P.nozzleLocal.set(0,0,1).applyQuaternion(mq).applyQuaternion(q).normalize();
  // fist pose from Blender action (left), mirrored delta onto right
  const clip=gltf.animations.find(a=>/Grip/i.test(a.name));
  if(clip){P.mixer=new THREE.AnimationMixer(m);P.mixer.clipAction(clip).play();P.mixer.update(0);
    for(const n of FINGERS){const L=P.bones['LeftHand'+n];if(L)P.rest['grip_'+n]=L.quaternion.clone();}
    P.mixer.stopAllAction();P.mixer=null;}
  // the grip runs through the fist (nozzle out of the index side); barrel made longer and a little thicker around the fist centre
  {const G=P.bones.Hose_Grip;G.updateMatrix();
   const M=G.matrix.clone().multiply(new THREE.Matrix4().makeTranslation(0,0.09+0.05,0)).multiply(new THREE.Matrix4().makeScale(1.12,1.4,1.12)).multiply(new THREE.Matrix4().makeTranslation(0,-0.09,0));
   M.decompose(G.position,G.quaternion,G.scale);G.updateMatrixWorld(true);P.nozzleLocal.set(0,1,0);}
}
const Q=new THREE.Quaternion(),Q2=new THREE.Quaternion(),V1=new THREE.Vector3(),V2=new THREE.Vector3(),V3=new THREE.Vector3();
function aimBone(bone,childPos,dir,amount=1){
  const bp=bone.getWorldPosition(V1);V2.subVectors(childPos,bp).normalize();
  Q.setFromUnitVectors(V2,dir);if(amount<1)Q.slerp(Q2.identity(),1-amount);
  const wq=bone.getWorldQuaternion(new THREE.Quaternion());const nw=Q.clone().multiply(wq);
  const pq=bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();bone.quaternion.copy(pq.multiply(nw));bone.updateMatrixWorld(true);}
function childPos(name){return P.bones[name].getWorldPosition(new THREE.Vector3());}
function rotW(bone,axis,ang){Q.setFromAxisAngle(axis,ang);const wq=bone.getWorldQuaternion(new THREE.Quaternion());
  const pq=bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();bone.quaternion.copy(pq.multiply(Q.multiply(wq)));bone.updateMatrixWorld(true);}
const clamp=THREE.MathUtils.clamp;
// ---- zero-g body dynamics: damped springs driven by the astronaut's acceleration ----
const AN={pitch:0.3,pitchV:0,roll:0,rollV:0,yaw:0,yawV:0,init:false,acc:new THREE.Vector3(),prevVel:new THREE.Vector3(),
  lag:new THREE.Vector3(),lagV:new THREE.Vector3(),aF:0,aR:0,vF:0,vR:0,twist:0,puffT:0};
function spring(x,v,target,k,z,dt){v+=(k*(target-x)-2*Math.sqrt(k)*z*v)*dt;return [x+v*dt,v];}
const _a1=new THREE.Vector3(),_fw=new THREE.Vector3(),_rt=new THREE.Vector3();
function animateBody(dt,t){
  if(!AN.init){AN.init=true;AN.yaw=P.yaw;AN.prevVel.copy(P.vel);}
  if(dt>0){_a1.subVectors(P.vel,AN.prevVel).multiplyScalar(1/Math.max(dt,1e-3));AN.acc.lerp(_a1,1-Math.exp(-10*dt));}
  AN.prevVel.copy(P.vel);
  _fw.set(-Math.sin(P.yaw),0,-Math.cos(P.yaw));_rt.set(Math.cos(P.yaw),0,-Math.sin(P.yaw));
  const vF=P.vel.dot(_fw)/CFG.maxSpeed,vR=P.vel.dot(_rt)/CFG.maxSpeed,aF=AN.acc.dot(_fw),aR=AN.acc.dot(_rt),aU=AN.acc.y;
  // hips follow the aim a beat late with a soft overshoot; the chest leads (spine twist)
  [AN.yaw,AN.yawV]=spring(AN.yaw,AN.yawV,P.yaw,60,0.75,dt);
  if(P.yaw-AN.yaw>1.3){AN.yaw=P.yaw-1.3;AN.yawV=Math.max(AN.yawV,0);}else if(P.yaw-AN.yaw<-1.3){AN.yaw=P.yaw+1.3;AN.yawV=Math.min(AN.yawV,0);} // the body never lags more than ~75 deg
  // lean: flatter when cruising forward, dives into a push, sits back on a brake, banks into side thrust and turns
  const pitchT=0.26+clamp(vF,-0.5,1)*0.5+clamp(aF*0.03,-0.55,0.45)-clamp(aU*0.012,-0.15,0.15);
  const rollT=clamp(vR,-1,1)*0.28+clamp(aR*0.028,-0.45,0.45)-clamp(AN.yawV*0.07,-0.3,0.3);
  [AN.pitch,AN.pitchV]=spring(AN.pitch,AN.pitchV,pitchT,40,0.45,dt);
  [AN.roll,AN.rollV]=spring(AN.roll,AN.rollV,rollT,40,0.45,dt);
  const bob=Math.sin(t*1.3)*0.05,dp=Math.sin(t*0.7)*0.035,dr=Math.sin(t*0.53+1)*0.035;
  P.rig.position.copy(P.pos).addScaledVector(UP,bob);
  P.rig.rotation.set(AN.pitch+dp,AN.yaw+Math.PI,AN.roll+dr,'YXZ'); // +roll = head toward the character's rightP.rig.updateMatrixWorld(true);
  // hands trail behind every push (secondary motion)
  _a1.copy(AN.acc).multiplyScalar(-0.012).clampLength(0,0.2);
  for(const c of ['x','y','z'])[AN.lag[c],AN.lagV[c]]=spring(AN.lag[c],AN.lagV[c],_a1[c],55,0.42,dt);
  const sp=Math.min(1,P.vel.length()/CFG.maxSpeed);
  P.swim=(P.swim||0)+dt*(1.2+sp*5);P.kick=THREE.MathUtils.damp(P.kick||0,sp,4,dt);
  AN.aF=aF;AN.aR=aR;AN.vF=vF;AN.vR=vR;AN.twist=clamp(P.yaw-AN.yaw,-0.9,0.9);
  poseLegs(t);thrusterPuffs(dt);}
function poseLegs(t){
  const B=P.bones;if(!B.LeftUpLeg)return;
  for(const n of ['LeftUpLeg','RightUpLeg','LeftLeg','RightLeg','LeftFoot','RightFoot'])B[n].quaternion.copy(P.rest[n]);
  P.model.updateMatrixWorld(true);
  const q=P.rig.quaternion,ax=new THREE.Vector3(1,0,0).applyQuaternion(q).negate(),fw=new THREE.Vector3(0,0,1).applyQuaternion(q);
  const brake=clamp(-AN.aF*0.03,0,0.75),lat=clamp(-AN.aR*0.02-AN.vR*0.25,-0.4,0.4);
  const amp=0.05+P.kick*0.3,ph=P.swim;
  for(const [up,lo,ft,o,side] of [['LeftUpLeg','LeftLeg','LeftFoot',0,-1],['RightUpLeg','RightLeg','RightFoot',Math.PI,1]]){
    const w=Math.sin(ph+o),drift=Math.sin(t*0.6+o*1.7)*0.07;
    rotW(B[up],fw,LEGSIGN.lat*(lat+side*(0.06+brake*0.14)));                      // swing against side thrust, open up on a brake
    rotW(B[up],ax,-0.14-P.kick*0.12+LEGSIGN.brake*brake*0.9+w*amp+drift);           // flutter when moving, knees come up when braking
    rotW(B[lo],ax,-(0.38+brake*0.75+P.kick*0.12+(Math.sin(ph+o-0.9)*0.5+0.5)*amp*0.8)); // knee
    rotW(B[ft],ax,-0.45*P.kick-0.2+brake*0.25);}}
const LEGSIGN={lat:-1,brake:1};
// two-bone IK: put the hand on `target`, elbow bent toward `pole`
function ik2(upN,loN,handN,target,pole){
  const B=P.bones,S=B[upN].getWorldPosition(new THREE.Vector3()),L1=P.len[upN],L2=P.len[loN];
  const dir=new THREE.Vector3().subVectors(target,S);let d=dir.length();dir.multiplyScalar(1/Math.max(d,1e-4));
  d=clamp(d,Math.abs(L1-L2)+0.02,(L1+L2)*0.995);
  const a=(L1*L1-L2*L2+d*d)/(2*d),h=Math.sqrt(Math.max(0,L1*L1-a*a));
  const pd=new THREE.Vector3().subVectors(pole,S);pd.addScaledVector(dir,-pd.dot(dir)).normalize();
  const E=S.clone().addScaledVector(dir,a).addScaledVector(pd,h),T=S.clone().addScaledVector(dir,d);
  aimBone(B[upN],childPos(loN),E.clone().sub(S).normalize());
  aimBone(B[loN],childPos(handN),T.sub(E).normalize());}
const HG={tw:0.75,rF:0.14,rR:-0.03,rU:-0.5,hA:0.4,hU:-0.24,pU:-0.3,pR:-0.2,pF:-1,sU:-0.45,sR:-1.3,sF:-0.25,gU:-0.2,gR:-0.07,gA:0.42,gRake:0.26,m:new THREE.Matrix4()}; // hose-hand pose
for(const k of ['rF','rR','rU','hA','hU','gU','gR','gA'])HG[k]*=AS; // offsets are in metres: follow the astronaut's scale
// forearm roll (pronation/supination): move most of the wrist twist into the forearm so the wrist does not pinch
const _rf=new THREE.Quaternion();
function spreadTwist(side,k){const B=P.bones,h=B[side+'Hand'],f=B[side+'ForeArm'],qr=P.rest[side+'Hand'];
  const d=qr.clone().invert().multiply(h.quaternion),ax=B[side+'Hand_end'].position.clone().normalize();
  let a=2*Math.atan2(d.x*ax.x+d.y*ax.y+d.z*ax.z,d.w);if(a>Math.PI)a-=2*Math.PI;if(a<-Math.PI)a+=2*Math.PI;
  const af=h.position.clone().normalize(),sg=Math.sign(ax.clone().applyQuaternion(qr).dot(af))||1;
  _rf.setFromAxisAngle(af,k*a*sg);f.quaternion.multiply(_rf);h.quaternion.premultiply(_rf.invert());f.updateMatrixWorld(true);}
function poseArms(aimDir,sucking,dt,leftDir,t=0){
  const B=P.bones;if(!B.LeftArm)return;
  for(const n of ['LeftArm','LeftForeArm','LeftHand','RightArm','RightForeArm','RightHand','Spine1','Spine2','Head'])if(B[n])B[n].quaternion.copy(P.rest[n]);
  // fists
  if(P.rest.grip_Index1)for(const n of FINGERS){if(!P.rest['grip_'+n])continue;
    B['LeftHand'+n].quaternion.copy(P.rest['grip_'+n]);
    const delta=P.rest['LeftHand'+n].clone().invert().multiply(P.rest['grip_'+n]);delta.y*=-1;delta.z*=-1;
    B['RightHand'+n].quaternion.copy(P.rest['RightHand'+n]).multiply(delta);}
  // spine: breathing + follows the aim pitch, chest leads the turn, leans into side thrust
  const breath=Math.sin(t*1.25)*0.03,s=P.pitch*0.35;
  B.Spine1.rotateX(-s*0.5+breath);B.Spine2.rotateX(-s*0.5+breath*0.6);if(B.Head)B.Head.rotateX(-P.pitch*0.2);
  P.model.updateMatrixWorld(true);
  const q=P.rig.quaternion,bU=new THREE.Vector3(0,1,0).applyQuaternion(q),bF=new THREE.Vector3(0,0,1).applyQuaternion(q);
  rotW(B.Spine1,bU,AN.twist*0.45);rotW(B.Spine2,bU,AN.twist*0.45);
  rotW(B.Spine2,bF,clamp(AN.aR*0.008,-0.14,0.14));
  if(B.Head)rotW(B.Head,bU,AN.twist*0.1);
  const SR=childPos('RightArm'),SL=childPos('LeftArm'),bR=new THREE.Vector3().subVectors(SR,SL).normalize();
  const reachR=P.len.RightArm+P.len.RightForeArm,reachL=P.len.LeftArm+P.len.LeftForeArm;
  // right hand: pistol at chest height, elbow bent and tucked; the fist is oriented so the pistol grip runs through it
  P.shotT=Math.max(0,(P.shotT||0)-dt);P.gunBlend=1;
  // aiming up: push the arm further out and a little to the side so the pistol stays clear of the helmet
  const upA=Math.max(0,aimDir.dot(bU));
  const rT=SR.clone().addScaledVector(bU,HG.gU).addScaledVector(bR,HG.gR+0.14*AS*upA).addScaledVector(aimDir,HG.gA+(0.3*upA-0.06*(P.recoil||0))*AS).add(AN.lag);
  ik2('RightArm','RightForeArm','RightHand',rT,SR.clone().addScaledVector(bU,-1).addScaledVector(bF,-0.6).addScaledVector(bR,0.6));
  {if(!P.rg){ // fist frame in RightHand space: hole axis (little finger -> index), hand axis (wrist -> knuckles), hole centre
     B.RightHand.updateMatrixWorld(true);const loc=n=>B.RightHand.worldToLocal(childPos(n));
     const hand=loc('RightHand_end').normalize(),hole=loc('RightHandIndex1').sub(loc('RightHandPinky1'));hole.addScaledVector(hand,-hole.dot(hand)).normalize();
     const c=loc('RightHandIndex3').add(loc('RightHandPinky3')).multiplyScalar(0.5);
     P.rg={hand,hole,side:new THREE.Vector3().crossVectors(hand,hole),c,m:new THREE.Matrix4(),w:new THREE.Matrix4()};}
   const G=P.rg,fa=childPos('RightHand').sub(childPos('RightForeArm')).normalize();
   const hole=bU.clone().addScaledVector(aimDir,-bU.dot(aimDir)).normalize().addScaledVector(aimDir,HG.gRake).normalize(); // grip raked like a real pistol
   const hand=fa.addScaledVector(hole,-fa.dot(hole)).normalize(),side=new THREE.Vector3().crossVectors(hand,hole); // knuckles continue the forearm
   G.m.makeBasis(G.hand,G.hole,G.side).invert();G.w.makeBasis(hand,hole,side).multiply(G.m);
   const q=new THREE.Quaternion().setFromRotationMatrix(G.w),pq=B.RightHand.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
   B.RightHand.quaternion.copy(pq.multiply(q));spreadTwist('Right',HG.tw);B.RightHand.updateMatrixWorld(true);
   P.gripW=(P.gripW||new THREE.Vector3()).copy(G.c);B.RightHand.localToWorld(P.gripW);P.gripHole=(P.gripHole||new THREE.Vector3()).copy(hole);}
  // left hand holds the hose grip like a torch: the nozzle continues the forearm, thumb on top, hose back under the wrist.
  // relaxed: arm down by the side, fist at the hip pointing ahead · sucking/welding: arm straight out along the aim
  P.leftBlend=THREE.MathUtils.damp(P.leftBlend||0,sucking?1:0,10,dt);
  const ld=leftDir||aimDir;
  const relaxedT=SL.clone().addScaledVector(bF,HG.rF).addScaledVector(bU,HG.rU+Math.sin(t*0.9)*0.02).addScaledVector(bR,HG.rR+Math.sin(t*0.7)*0.015).add(AN.lag);
  const holdT=SL.clone().addScaledVector(ld,HG.hA).addScaledVector(bU,HG.hU).add(AN.lag);
  const lT=relaxedT.lerp(holdT,P.leftBlend);
  const lb=P.leftBlend;ik2('LeftArm','LeftForeArm','LeftHand',lT,SL.clone().addScaledVector(bU,HG.pU+(HG.sU-HG.pU)*lb).addScaledVector(bR,HG.pR+(HG.sR-HG.pR)*lb).addScaledVector(bF,HG.pF+(HG.sF-HG.pF)*lb));
  // nozzle direction: relaxed = the forearm line tipped a little forward · sucking/welding = exactly the aim
  const fa=childPos('LeftHand').sub(childPos('LeftForeArm')).normalize();
  const nd=bF.clone().multiplyScalar(0.85).addScaledVector(bU,-0.5).normalize().lerp(ld,P.leftBlend).normalize();
  // relaxed: keep the nozzle at least ~55 deg off the forearm line so the wrist never folds over
  if(P.leftBlend<0.99){const c=THREE.MathUtils.clamp(fa.dot(nd),-1,1),mn=0.96;if(Math.acos(c)<mn){let pp=nd.clone().addScaledVector(fa,-c);if(pp.lengthSq()<1e-4)pp.copy(bF).addScaledVector(fa,-bF.dot(fa));pp.normalize();
    nd.lerp(fa.clone().multiplyScalar(Math.cos(mn)).addScaledVector(pp,Math.sin(mn)),1-P.leftBlend).normalize();}}
  // grip frame: +Y (nozzle, through the fist) = nd; -X (wrist -> knuckles) continues the forearm as far as possible
  const hx=fa.clone().addScaledVector(nd,-fa.dot(nd));if(hx.lengthSq()<1e-4)hx.copy(bU).addScaledVector(nd,-bU.dot(nd));hx.normalize();
  const gx=hx.negate(),gz=new THREE.Vector3().crossVectors(gx,nd);
  HG.m.makeBasis(gx,nd,gz);const hW=new THREE.Quaternion().setFromRotationMatrix(HG.m).multiply(B.Hose_Grip.quaternion.clone().invert());
  P.hoseDown=(P.hoseDown||new THREE.Vector3()).copy(bU).negate();P.hoseBack=(P.hoseBack||new THREE.Vector3()).copy(bF).negate();
  const pq=B.LeftHand.parent.getWorldQuaternion(new THREE.Quaternion()).invert();B.LeftHand.quaternion.copy(pq.multiply(hW));spreadTwist('Left',HG.tw);
  B.LeftHand.updateMatrixWorld(true);
  solveHose();}
// backpack thruster puffs: fire opposite to the push
const PUFFS=[];let puffI=0;
const gasTex=glowTex('rgba(255,255,255,0.95)','rgba(225,232,240,0.38)');
{const mat=new THREE.SpriteMaterial({map:gasTex,color:0xffffff,depthWrite:false,transparent:true,opacity:0});
 for(let i=0;i<240;i++){const s=new THREE.Sprite(mat.clone());s.visible=false;scene.add(s);PUFFS.push({s,life:0,max:1,size:0.1,vel:new THREE.Vector3(),a:0.6});}}
// one gas puff: starts small and dense at the nozzle, expands and thins out as it slows down
function puff(pos,vel,size=0.14,life=0.5,alpha=0.45,grow=0.6){const p=PUFFS[puffI++%PUFFS.length];p.grow=grow;p.s.position.copy(pos);p.vel.copy(vel);
  p.life=p.max=life*(0.8+Math.random()*0.4);p.size=size;p.a=alpha;p.s.visible=true;p.s.material.rotation=Math.random()*6.28;}
// nozzles sit on the backpack, shifted toward the side opposite the push (a push to the right fires the left-hand jets)
function jetOrigins(dir){const c=P.bones.Spine2.getWorldPosition(new THREE.Vector3()),q=P.rig.quaternion;
  const back=new THREE.Vector3(0,0,-1).applyQuaternion(q),rt=new THREE.Vector3(-1,0,0).applyQuaternion(q),up=new THREE.Vector3(0,1,0).applyQuaternion(q);
  const base=c.addScaledVector(back,0.3).addScaledVector(up,-0.05);if(dir)base.addScaledVector(dir,-0.28);
  const side=dir?new THREE.Vector3().crossVectors(dir,up).normalize():rt;if(side.lengthSq()<0.01)side.copy(rt);
  return [-1,1].map(sd=>base.clone().addScaledVector(side,sd*0.13));}
// cold-gas jets: a soft, flickering cone out of each backpack nozzle, strongest when a push starts, a faint stream while you keep pushing
const JETS=[];
{const pr=[];for(let i=0;i<=12;i++){const y=i/12;pr.push(new THREE.Vector2(0.025+0.3*Math.pow(y,0.62),y));}const g=new THREE.LatheGeometry(pr,24);/* nozzle at y=0, plume opening along +Y */
 const mk=(w,a)=>new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
   uniforms:{uK:{value:0},uT:{value:0},uA:{value:a}},
   vertexShader:`varying float vY,vA;varying vec3 vN,vV,vX;void main(){vY=position.y;vA=atan(position.z,position.x);vec4 mv=modelViewMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vV=normalize(-mv.xyz);vX=normalize((modelViewMatrix*vec4(0.,1.,0.,0.)).xyz);gl_Position=projectionMatrix*mv;}`,
   fragmentShader:`uniform float uK,uT,uA;varying float vY,vA;varying vec3 vN,vV,vX;
     float h(float x){return fract(sin(x*127.1)*43758.5);}
     void main(){float y=clamp(vY,0.,1.);vec3 V=normalize(vV);float al=abs(dot(normalize(vX),V));
       float edge=mix(pow(abs(dot(normalize(vN),V)),${w}),0.55,al*al);   /* end-on: a soft disc instead of nothing */
       float st=0.72+0.28*sin(vA*5.+y*9.-uT*38.)*sin(vA*3.-y*6.+uT*21.);  /* streaks in the gas */
       float fl=0.85+0.15*sin(uT*71.+y*23.)+0.1*(h(floor(uT*40.)+floor(y*9.))-.5);
       float a=pow(1.-y,2.)*smoothstep(0.,.05,y)*edge*st*fl*uK*uA;
       vec3 c=mix(vec3(1.,1.,1.),vec3(.62,.72,.95),y);gl_FragColor=vec4(c*a,a);}`});
 for(let i=0;i<2;i++){const outer=new THREE.Mesh(g,mk('1.0',0.5)),core=new THREE.Mesh(g,mk('2.4',0.9));core.scale.set(0.38,0.75,0.38);outer.add(core);
   outer.visible=false;outer.frustumCulled=false;core.frustumCulled=false;outer.renderOrder=5;scene.add(outer);JETS.push({m:outer,core,k:0});}}
const _jq=new THREE.Quaternion(),_jy=new THREE.Vector3(0,1,0);
function setJets(dir,k,t){const os=dir?jetOrigins(dir):null;
  for(let i=0;i<2;i++){const J=JETS[i];J.k=THREE.MathUtils.damp(J.k,k,k>J.k?30:12,1/60);const on=J.k>0.02&&os;J.m.visible=!!on;if(!on)continue;
    J.m.position.copy(os[i]);_jq.setFromUnitVectors(_jy,V3.copy(dir).negate());J.m.quaternion.copy(_jq);
    const L=0.4+0.8*J.k,W=0.55+0.6*J.k;J.m.scale.set(W,L,W);J.m.position.addScaledVector(dir,0.12);
    for(const m of [J.m.material,J.core.material]){m.uniforms.uK.value=Math.min(1.2,J.k);m.uniforms.uT.value=t+i*3.1;}}}
function thrusterPuffs(dt){
  // a short hiss of gas when a push starts (or changes direction), not a constant smoke trail
  if(state==='play'&&!CINE.on&&P.thrust&&P.thrust.lengthSq()>0.05&&P.bones.Spine2){const dir=P.thrust.clone().normalize();
    if(!AN.jetDir||AN.jetDir.dot(dir)<0.7){AN.jetT=0.28;sfx('tss');}AN.jetDir=(AN.jetDir||new THREE.Vector3()).lerp(dir,0.35).normalize();
    AN.jetT=Math.max(0,AN.jetT-dt);AN.jetS=dir;setJets(AN.jetDir,AN.jetT>0?1:0.32,performance.now()/1000);hissLevel(AN.jetT>0?0.9:0.35);
    // a few fine wisps peel off the end of the jet
    AN.puffT-=dt;if(AN.puffT<=0){AN.puffT=AN.jetT>0?0.03:0.09;for(const o of jetOrigins(dir))
      puff(o.addScaledVector(dir,-0.5),dir.clone().multiplyScalar(-(3+Math.random()*2)).add(P.vel).add(_a1.randomDirection().multiplyScalar(0.25)),0.05,0.45,AN.jetT>0?0.13:0.07,0.5);}}
  else{AN.jetDir=null;AN.jetT=0;AN.puffT=0;setJets(null,0,0);hissLevel(0);}
  for(const p of PUFFS){if(p.life<=0)continue;p.life-=dt;const k=Math.max(0,p.life/p.max);p.s.position.addScaledVector(p.vel,dt);p.vel.multiplyScalar(Math.exp(-3.4*dt));
    p.s.scale.setScalar(p.size+(1-k)*(p.grow??0.6));p.s.material.opacity=p.a*k*k;if(p.life<=0)p.s.visible=false;}}
function ccdTo(H,last,effFn,target,iters,k){
  for(let it=0;it<iters;it++)for(let i=last;i>=0;i--){
    const eff=effFn(),bp=H[i].getWorldPosition(new THREE.Vector3());
    const a=eff.sub(bp),b=target.clone().sub(bp);if(a.lengthSq()<1e-8||b.lengthSq()<1e-8)continue;
    Q.setFromUnitVectors(a.normalize(),b.normalize());Q.slerp(Q2.identity(),k);
    const wq=H[i].getWorldQuaternion(new THREE.Quaternion());const pq=H[i].parent.getWorldQuaternion(new THREE.Quaternion()).invert();
    H[i].quaternion.copy(pq.multiply(Q.multiply(wq)));H[i].updateMatrixWorld(true);}}
function solveHose(){
  // the hose is laid along a route: backpack -> sag by the hip -> under the elbow -> along the underside of the forearm -> into the base of the grip
  const H=P.hose,B=P.bones,G=B.Hose_Grip,target=G.getWorldPosition(new THREE.Vector3());
  const ax=new THREE.Vector3(0,1,0).applyQuaternion(G.getWorldQuaternion(new THREE.Quaternion()));
  const dn=P.hoseDown||new THREE.Vector3(0,-1,0);
  const A=H[0].getWorldPosition(new THREE.Vector3()),el=B.LeftForeArm.getWorldPosition(new THREE.Vector3()),wr=B.LeftHand.getWorldPosition(new THREE.Vector3());
  const L9=P.hoseOff.length(),gIn=target.clone().addScaledVector(ax,-L9);
  const gOut=gIn.clone().addScaledVector(ax,-0.12);
  if(!P.hseg){P.hseg=[];for(let i=0;i<9;i++)P.hseg.push(H[i].getWorldPosition(new THREE.Vector3()).distanceTo(H[i+1].getWorldPosition(new THREE.Vector3())));P.hlen=P.hseg.reduce((a,c)=>a+c,0);}
  // slack hangs as a sag between the backpack and the elbow
  const direct=A.distanceTo(gOut)+0.12,slack=Math.max(0,P.hlen-direct);
  const M=A.clone().lerp(gOut,0.5).addScaledVector(dn,0.12+slack*0.45).addScaledVector(P.hoseBack||dn,0.04+slack*0.15);
  const curve=new THREE.CatmullRomCurve3([A,M,gOut,gIn],false,'centripetal');const CL=curve.getLength();
  let s=0;const pt=new THREE.Vector3();
  for(let i=0;i<9;i++){s+=P.hseg[i];curve.getPointAt(Math.min(1,s/CL),pt);
    const bp=H[i].getWorldPosition(new THREE.Vector3()),cp=H[i+1].getWorldPosition(new THREE.Vector3());
    const a=cp.sub(bp),d=pt.clone().sub(bp);if(a.lengthSq()<1e-8||d.lengthSq()<1e-8)continue;
    Q.setFromUnitVectors(a.normalize(),d.normalize());
    const wq=H[i].getWorldQuaternion(new THREE.Quaternion()),pq=H[i].parent.getWorldQuaternion(new THREE.Quaternion()).invert();
    H[i].quaternion.copy(pq.multiply(Q.multiply(wq)));H[i].updateMatrixWorld(true);}
  // last link points into the grip, then a light pass closes any gap
  ccdTo(H,9,()=>H[9].localToWorld(P.hoseOff.clone()),target,1,0);
  ccdTo(H,9,()=>H[9].localToWorld(P.hoseOff.clone()),target,2,0.5);
}


