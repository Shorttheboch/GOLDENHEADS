/* ================= DUST PARTICLES ================= */
const CLOUDS=[[1.5,6.5,3,2.2],[-4,7.5,-1,2.4],[5,9,-4,2.6],[-2,11,6,2.2],[7,4.5,10,2.0],[-7,5,4,2.3],[2,13.5,-2,2.5],[-6,9,-8,2.4],[3,3,-12,2.0]];
const PER=90, DN=CLOUDS.length*PER;
const dCap=new Uint8Array(DN);const dPos=new Float32Array(DN*3),dVel=new Float32Array(DN*3),dAlive=new Uint8Array(DN),dHome=new Float32Array(DN*3);
const dAge=new Float32Array(DN),dMag=new Uint8Array(DN),dFree=new Float32Array(DN); // dFree (v65): seconds before a grain shaken loose by a dash can be vacuumed again // seconds afloat · pulled home by the magnet prize
const dGeo=new THREE.BufferGeometry();dGeo.setAttribute('position',new THREE.BufferAttribute(dPos,3));
const dMat=new THREE.PointsMaterial({size:0.24,map:dotTex,color:new THREE.Color(0xffc860).multiplyScalar(1.6),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});
// each unit of cargo is drawn as a small cluster of grains, so a leak reads as a dense cloud without inflating the count
const DK=10,dOff=new Float32Array(DN*DK*3),cPos=new Float32Array(DN*DK*3);
for(let i=0;i<DN*DK;i++){const v=new THREE.Vector3().randomDirection().multiplyScalar(0.1+Math.pow(Math.random(),0.7)*0.6);dOff[i*3]=v.x;dOff[i*3+1]=v.y;dOff[i*3+2]=v.z;cPos[i*3+1]=-9999;}
const cGeo=new THREE.BufferGeometry();cGeo.setAttribute('position',new THREE.BufferAttribute(cPos,3));
dMat.size=isTouch?0.25:0.19;dMat.color.setHex(0xf2c25a);dMat.blending=THREE.NormalBlending;dMat.opacity=0.9; // v65: bigger grains on phones (small screen)
const dust=new THREE.Points(cGeo,dMat);dust.frustumCulled=false;scene.add(dust);
function updateClusters(t){for(let i=0;i<DN;i++){const base=i*DK*3;
    if(!dAlive[i]){if(cPos[base+1]!==-9999)for(let k=0;k<DK;k++)cPos[base+k*3+1]=-9999;continue;}
    const j=i*3,sw=(dCap[i]||dMag[i]?0.25:1)*(1+Math.sin(t*0.8+i*1.7)*0.25);
    for(let k=0;k<DK;k++){const o=base+k*3;cPos[o]=dPos[j]+dOff[o]*sw;cPos[o+1]=dPos[j+1]+dOff[o+1]*sw;cPos[o+2]=dPos[j+2]+dOff[o+2]*sw;}}
  cGeo.attributes.position.needsUpdate=true;}
// golden mist pouring out of damaged hull patches (purely visual)
const mistTex=glowTex('rgba(255,214,130,0.85)','rgba(255,176,60,0.28)');const MIST=[];let mistI=0;
{const m=new THREE.SpriteMaterial({map:mistTex,color:0xffd590,depthWrite:false,transparent:true,opacity:0});
 for(let i=0;i<240;i++){const s=new THREE.Sprite(m.clone());s.visible=false;scene.add(s);MIST.push({s,life:0,max:1,vel:new THREE.Vector3(),s0:0.4,a:0.3});}}
function mist(pos,n,dir,speed=1.6){const p=MIST[mistI++%MIST.length];p.s.position.copy(pos).add(_mv.randomDirection().multiplyScalar(0.25));
  p.vel.copy(dir).multiplyScalar(speed*(0.7+Math.random()*0.6)).add(_mv.randomDirection().multiplyScalar(0.35));
  if(p.acid){p.acid=false;p.s.material.color.setHex(0xffd590);}p.life=p.max=2+Math.random()*1.4;p.s0=0.5+Math.random()*0.35;p.a=0.34+Math.random()*0.18;p.s.visible=true;p.s.material.rotation=Math.random()*6.28;}
const _mv=new THREE.Vector3();
function updateMist(dt){for(const p of MIST){if(p.life<=0)continue;p.life-=dt;const k=p.life/p.max;p.s.position.addScaledVector(p.vel,dt);p.vel.multiplyScalar(Math.exp(-0.9*dt));
    p.s.scale.setScalar(p.s0+(1-k)*2.4);p.s.material.opacity=p.a*Math.min(1,(1-k)*6)*k;if(p.life<=0)p.s.visible=false;}}
// soft golden haze drawn from the same particles: overlapping halos merge each leak into one glowing cloud
const dHaze=new THREE.Points(dGeo,new THREE.PointsMaterial({size:1.1,map:dotTex,color:new THREE.Color(0xffb840).multiplyScalar(0.45),transparent:true,opacity:0.18,depthWrite:false,blending:THREE.AdditiveBlending}));
dHaze.frustumCulled=false;scene.add(dHaze);if(isTouch)dHaze.material.opacity=0.24; // v65: a bit more glow around them on phones
function resetDust(){dAlive.fill(0);dCap.fill(0);for(let i=0;i<DN;i++)dPos[i*3+1]=-9999;dGeo.attributes.position.needsUpdate=true;if(typeof cPos!=='undefined'){for(let i=0;i<DN*DK;i++)cPos[i*3+1]=-9999;cGeo.attributes.position.needsUpdate=true;}}
resetDust();
let lostN=0;
// put n units of product back into space at p (reuses free particle slots) -> returns how many fit
function spawnLoose(p,n,speed=3,dir=null){
  let k=0;for(let i=0;i<DN&&k<n;i++){if(dAlive[i])continue;const j=i*3;const v=new THREE.Vector3().randomDirection();const r=0.15+Math.cbrt(Math.random())*0.75; // compact cloud
    dPos[j]=p.x+v.x*0.3;dPos[j+1]=p.y+v.y*0.3;dPos[j+2]=p.z+v.z*0.3;
    if(dir){const a=0.3+Math.pow(Math.random(),0.8)*3.8,w=0.25+a*0.32; // a plume leaving the hole, wider as it goes
      dHome[j]=p.x+dir.x*a+v.x*w;dHome[j+1]=p.y+dir.y*a+v.y*w;dHome[j+2]=p.z+dir.z*a+v.z*w;
      const s=speed*(0.6+Math.random()*0.8);dVel[j]=dir.x*s+v.x*0.4;dVel[j+1]=dir.y*s+v.y*0.4;dVel[j+2]=dir.z*s+v.z*0.4;}
    else{dHome[j]=p.x+v.x*r;dHome[j+1]=p.y+v.y*r;dHome[j+2]=p.z+v.z*r;
    const s=speed*(0.5+Math.random());dVel[j]=v.x*s;dVel[j+1]=v.y*s;dVel[j+2]=v.z*s;}dAlive[i]=1;dCap[i]=0;dAge[i]=0;dMag[i]=0;k++;}
  dGeo.attributes.position.needsUpdate=true;return k;}
function nearestDust(p,maxD){let best=maxD*maxD,bi=-1;
  for(let i=0;i<DN;i+=3){if(!dAlive[i])continue;const j=i*3,dx=dPos[j]-p.x,dy=dPos[j+1]-p.y,dz=dPos[j+2]-p.z,d=dx*dx+dy*dy+dz*dz;if(d<best){best=d;bi=j;}}
  return bi<0?null:new THREE.Vector3(dPos[bi],dPos[bi+1],dPos[bi+2]);}


