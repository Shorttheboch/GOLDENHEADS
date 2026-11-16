// v89: puts the HEADS patch (tools/parche/parche.webp, made by make_patch_tex.py) on the astronaut's chest, where the black circle was.
//
//   node tools/parche/make_patch_glb.mjs [--src <astronaut without patch>.glb] [--out public/assets/models/astronaut.glb] [--check]
//
// The astronaut has no textures (flat materials); the black circle is a small black puck (72 triangles of M_Glove_Black) sitting in a hole of
// the suit. Printed on that puck as it is, the patch came apart when the astronaut moved (the puck is skinned a little differently from the
// suit: black edges poked out and the swoosh tips on the suit slid away from the circle), and the puck is a flat disc up to ~1 cm off the curved
// chest, which hid the base of the swoosh tips from an angle. So:
//  1) the puck = the black connected piece near DISC_AT; its plane (PCA), centre (circle fit of its rim) and visible size give the projection
//     (image right = the astronaut's left = +x, image up = +y). Its triangles leave the black primitive (a new, plain index accessor for that
//     primitive; the meshopt data stays as it is, the puck's vertices are just no longer used). In its place goes a thin patch mesh (RINGS x
//     SEGS) that follows the chest THICK above the suit, with a short skirt at the edge and skin weights blended from the nearest suit
//     vertices, so it bends like the suit around it;
//     Outside the circle a few more rings carry the three swoosh tips (only the triangles under them are kept), so the tips are part of the
//     patch and never come away from it;
//  2) the suit and the patch are rasterised on a 512 grid with their height along the patch normal: every textured texel must have the patch
//     on top (no hole, no suit coming through);
//  3) the patch goes into one more primitive of the body mesh (same skin), with planar UVs (the circle's edge and skirt clamped just inside
//     the circle: they show the stitched border) and its own small material M_Patch (512 px
//     WebP, alpha MASK, not metallic, a little of the texture as emission so it reads in the dark); EXT_texture_webp is required (the game
//     already needs WebP for its menus and HUD).
// No existing byte of the binary changes: the new data is appended. By default it starts from the astronaut of v88
// (git show 1137b24:public/assets/models/astronaut.glb; until v91 bcde206), so it can be run again after the patch is in. Since v92 the
// result goes on to tools/astro-normal/add_normal_glb.mjs (the normal map) before it is the game's astronaut.glb.
import fs from 'fs';
import path from 'path';
import {execSync} from 'child_process';
import {fileURLToPath} from 'url';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const HERE=path.dirname(fileURLToPath(import.meta.url)),ROOT=path.resolve(HERE,'..','..');
const args=process.argv.slice(2),opt=(k,d)=>{const i=args.indexOf('--'+k);return i<0?d:args[i+1];};
const PRISTINE='1137b24';                          // v92: the Blender export with UV_game, tangents, the zips' own materials and rigid zip pulls, without the patch (v89-v91: bcde206, v88)
const OUT=path.resolve(ROOT,opt('out','public/assets/models/astronaut.glb')),CHECK=args.includes('--check');
const TEX=path.join(HERE,'parche.webp'),META=JSON.parse(fs.readFileSync(path.join(HERE,'parche.json'),'utf8'));
const DISC_AT=new THREE.Vector3(0.115,1.443,0.079); // the black circle on the left of the chest (mesh space of NEW_body, Blender export)
const PATCH_FIT=1.3,EDGE_BLEND=[0.6,0.95],TIP_RINGS=5,THICK=0.0025,SKIRT=0.004,RINGS=6,SEGS=40,GRID=512,MIN_NDOT=0.2,MATERIAL={name:'M_Patch',rough:0.62,emissive:0.3};

const src=opt('src',null);
const glb=src?fs.readFileSync(path.resolve(src)):execSync(`git show ${PRISTINE}:public/assets/models/astronaut.glb`,{cwd:ROOT,maxBuffer:64<<20});
function readGLB(b){if(b.readUInt32LE(0)!==0x46546C67)throw new Error('not a glb');let off=12,json=null,bin=null;
  while(off<b.length){const len=b.readUInt32LE(off),type=b.readUInt32LE(off+4),data=b.subarray(off+8,off+8+len);
    if(type===0x4E4F534A)json=JSON.parse(data.toString('utf8'));else if(type===0x004E4942)bin=Buffer.from(data);off+=8+len;}
  return {json,bin};}
const {json,bin}=readGLB(glb);
if((json.materials||[]).some(m=>m.name===MATERIAL.name))throw new Error('the source already has the patch: use --src with the astronaut without it');
const meshIx=json.meshes.findIndex(m=>m.name==='NEW_body');if(meshIx<0)throw new Error('no NEW_body mesh');
const matIx=n=>json.materials.findIndex(m=>m.name===n);
const SUIT=matIx('M_Suit_Gold'),BLACK=matIx('M_Glove_Black');

// decoded geometry of the body primitives (three reads the meshopt data; same order as json.meshes[meshIx].primitives)
const ab=glb.buffer.slice(glb.byteOffset,glb.byteOffset+glb.byteLength);
const loader=new GLTFLoader();loader.setMeshoptDecoder(MeshoptDecoder);
const gltf=await new Promise((res,rej)=>loader.parse(ab,'',res,rej));
const meshObj=await gltf.parser.getDependency('mesh',meshIx);
const parts=[];meshObj.traverse(o=>{if(o.isMesh)parts.push(o);});
if(parts.length!==json.meshes[meshIx].primitives.length)throw new Error('primitive count mismatch');
const geoOf=mi=>{const k=json.meshes[meshIx].primitives.findIndex(p=>p.material===mi);return parts[k].geometry;};
const gSuit=geoOf(SUIT),gBlack=geoOf(BLACK);

// 1) the disc: the black connected piece around DISC_AT
function components(geo){const p=geo.attributes.position,ix=geo.index,nT=ix.count/3,key=new Map(),W=new Int32Array(p.count);
  for(let i=0;i<p.count;i++){const k=Math.round(p.getX(i)*1e4)+','+Math.round(p.getY(i)*1e4)+','+Math.round(p.getZ(i)*1e4);if(!key.has(k))key.set(k,key.size);W[i]=key.get(k);}
  const par=Int32Array.from({length:key.size},(_,i)=>i),f=x=>{while(par[x]!==x){par[x]=par[par[x]];x=par[x];}return x;};
  for(let t=0;t<nT;t++){const a=f(W[ix.getX(t*3)]),b=f(W[ix.getX(t*3+1)]),c=f(W[ix.getX(t*3+2)]);par[a]=b;par[f(b)]=f(c);}
  const C=new Map();for(let t=0;t<nT;t++){const r=f(W[ix.getX(t*3)]);if(!C.has(r))C.set(r,[]);C.get(r).push(t);}return [...C.values()];}
const v=new THREE.Vector3(),w=new THREE.Vector3();
let disc=null,best=1e9;
for(const ts of components(gBlack)){const vs=new Set();for(const t of ts)for(let k=0;k<3;k++)vs.add(gBlack.index.getX(t*3+k));
  const c=new THREE.Vector3();for(const i of vs)c.add(v.fromBufferAttribute(gBlack.attributes.position,i));c.divideScalar(vs.size);
  const d=c.distanceTo(DISC_AT);if(d<best){best=d;disc={tris:ts,verts:[...vs],c};}}
if(!disc||best>0.03)throw new Error('black disc not found near '+DISC_AT.toArray());
const DP=disc.verts.map(i=>new THREE.Vector3().fromBufferAttribute(gBlack.attributes.position,i));
// plane by PCA (normal = smallest spread), facing +z
const cov=[[0,0,0],[0,0,0],[0,0,0]];for(const q of DP){const d=q.clone().sub(disc.c).toArray();for(let a=0;a<3;a++)for(let b=0;b<3;b++)cov[a][b]+=d[a]*d[b];}
const mul=x=>new THREE.Vector3(cov[0][0]*x.x+cov[0][1]*x.y+cov[0][2]*x.z,cov[1][0]*x.x+cov[1][1]*x.y+cov[1][2]*x.z,cov[2][0]*x.x+cov[2][1]*x.y+cov[2][2]*x.z);
let e1=new THREE.Vector3(1,0.3,0.1).normalize();for(let i=0;i<200;i++)e1=mul(e1).normalize();
let e2=new THREE.Vector3(0.2,1,0.1);for(let i=0;i<200;i++){e2=mul(e2);e2.addScaledVector(e1,-e2.dot(e1)).normalize();}
const N=new THREE.Vector3().crossVectors(e1,e2).normalize();if(N.z<0)N.negate();
const U=new THREE.Vector3(1,0,0).addScaledVector(N,-N.x).normalize(),UP=new THREE.Vector3().crossVectors(N,U).normalize();
// centre: circle fit of the rim (the outer half of the disc's vertices in plane coordinates), radius = farthest vertex from it
const pl=q=>{w.copy(q).sub(disc.c);return [w.dot(U),w.dot(UP),w.dot(N)];};
const P2=DP.map(pl),rim=P2.filter(p=>Math.hypot(p[0],p[1])>0.03);
{const A=[],B=[];for(const [x,y] of rim){A.push([2*x,2*y,1]);B.push(x*x+y*y);}
  // normal equations 3x3
  const M=[[0,0,0],[0,0,0],[0,0,0]],r=[0,0,0];for(let i=0;i<A.length;i++)for(let a=0;a<3;a++){r[a]+=A[i][a]*B[i];for(let b=0;b<3;b++)M[a][b]+=A[i][a]*A[i][b];}
  const det=m=>m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1])-m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0])+m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0]);
  const D=det(M),sol=[0,1,2].map(k=>det(M.map((row,i)=>row.map((x,j)=>j===k?r[i]:x)))/D);
  disc.c.addScaledVector(U,sol[0]).addScaledVector(UP,sol[1]);}
const P3=DP.map(pl),RD=Math.max(...P3.map(p=>Math.hypot(p[0],p[1])));
let SIDE=RD/META.r;                                // model units covered by the texture (its circle radius r maps to the patch radius)
const toUV=q=>{w.copy(q).sub(disc.c);return [0.5+w.dot(U)/SIDE,0.5-w.dot(UP)/SIDE,w.dot(N)];};
console.log(`black circle: ${disc.tris.length} triangles, centre ${disc.c.toArray().map(x=>x.toFixed(4))}, normal ${N.toArray().map(x=>x.toFixed(3))}, outer radius ${RD.toFixed(4)}`);

// 2) frontmost suit triangles over the textured texels
const alphaPx=await (async()=>{ // the texture's alpha, decoded with sharp (already in node_modules) or PIL as a fallback
  let a;try{const sharp=(await import('sharp')).default;const {data,info}=await sharp(TEX).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    a=new Uint8Array(info.width*info.height);for(let i=0;i<a.length;i++)a[i]=data[i*4+3];}
  catch(e){a=new Uint8Array(execSync(`python3 -c "from PIL import Image;import sys;sys.stdout.buffer.write(Image.open(sys.argv[1]).convert('RGBA').getchannel('A').tobytes())" "${TEX}"`,{maxBuffer:8<<20}));}
  if(a.length!==GRID*GRID)throw new Error('texture is not '+GRID+'x'+GRID);return a;})();
let zbuf,owner,cand;
function raster(sources){zbuf=new Float32Array(GRID*GRID).fill(-1e9);owner=new Int32Array(GRID*GRID).fill(-1);cand=[];
 for(const [g,tag,skip] of sources){const p=g.attributes.position,n=g.attributes.normal,ix=g.index;
  for(let t=0;t<ix.count/3;t++){if(skip&&skip.has(t))continue;const id=[ix.getX(t*3),ix.getX(t*3+1),ix.getX(t*3+2)];const uv=[];let ok=true,nd=0;
    for(const i of id){const q=toUV(v.fromBufferAttribute(p,i));uv.push(q);nd+=w.fromBufferAttribute(n,i).dot(N)/3;if(q[2]<-0.04||q[2]>0.05)ok=false;}
    if(!ok||nd<MIN_NDOT)continue;
    const minU=Math.min(uv[0][0],uv[1][0],uv[2][0]),maxU=Math.max(uv[0][0],uv[1][0],uv[2][0]),minV=Math.min(uv[0][1],uv[1][1],uv[2][1]),maxV=Math.max(uv[0][1],uv[1][1],uv[2][1]);
    if(maxU<0||minU>1||maxV<0||minV>1)continue;
    const ci=cand.length;cand.push({g,tag,id,uv,hit:0});
    const x0=Math.max(0,Math.floor(minU*GRID)),x1=Math.min(GRID-1,Math.ceil(maxU*GRID)),y0=Math.max(0,Math.floor(minV*GRID)),y1=Math.min(GRID-1,Math.ceil(maxV*GRID));
    const [a,b,c]=uv,den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(den)<1e-12)continue;
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const px=(x+0.5)/GRID,py=(y+0.5)/GRID;
      const l1=((b[1]-c[1])*(px-c[0])+(c[0]-b[0])*(py-c[1]))/den,l2=((c[1]-a[1])*(px-c[0])+(a[0]-c[0])*(py-c[1]))/den,l3=1-l1-l2;
      if(l1<-1e-4||l2<-1e-4||l3<-1e-4)continue;const h=l1*a[2]+l2*b[2]+l3*c[2],k=y*GRID+x;if(h>zbuf[k]){zbuf[k]=h;owner[k]=ci;}}}}}
// size: the black puck is a polygon whose outer bevel dips under the suit, so seen from the front the black circle ends a little inside its
// outer radius. Pass 1 measures that visible edge along 720 rays from the centre; the patch gets its median radius (the size the black
// circle looked), and pass 2 decides which suit triangles carry the patch.
const discTris=new Set(disc.tris);
raster([[gSuit,'suit'],[gBlack,'black']]);
{const rays=[];for(let k=0;k<720;k++){const an=k/720*Math.PI*2;let last=0;
   for(let r=0;r<0.5;r+=0.25/GRID){const x=Math.floor((0.5+Math.cos(an)*r)*GRID),y=Math.floor((0.5-Math.sin(an)*r)*GRID);const o=owner[y*GRID+x];if(o<0||cand[o].tag!=='black')break;last=r;}
   rays.push(last*SIDE);}
 rays.sort((a,b)=>a-b);const RV=rays[rays.length>>1];
 console.log(`visible black edge: ${rays[0].toFixed(4)} .. ${rays[rays.length-1].toFixed(4)} m, median ${RV.toFixed(4)}: the patch's circle`);
 SIDE=RV/META.r;}
// the patch mesh: polar rings over the circle, THICK above the suit (the suit's height under each point interpolated from the front-facing
// suit vertices around and inside the hole: 8 nearest in the plane, inverse squared distance), a skirt down to SKIRT below the suit at the
// edge (the patch's thickness, in the black of its border), and outside the circle a few more rings, kept only where the swoosh tips are:
// the tips are part of the patch (same height, same weights), so they never come away from the circle
const sP=gSuit.attributes.position,sN=gSuit.attributes.normal,sJ=gSuit.attributes.skinIndex,sW=gSuit.attributes.skinWeight,near=[];
for(let i=0;i<sP.count;i++){v.fromBufferAttribute(sP,i);if(v.distanceTo(disc.c)<0.12&&w.fromBufferAttribute(sN,i).dot(N)>0.2)near.push(i);}
const RC=META.r*SIDE,samples=[];for(const i of near){const q=pl(v.fromBufferAttribute(sP,i));if(Math.hypot(q[0],q[1])<RC+0.015&&Math.abs(q[2])<0.03)samples.push(q);}
function suitH(x,y){const d=samples.map(q=>[q[2],(q[0]-x)**2+(q[1]-y)**2]).sort((a,b)=>a[1]-b[1]).slice(0,8);let sw=0,sh=0;for(const [h,d2] of d){const f=1/Math.max(1e-10,d2);sw+=f;sh+=h*f;}return sh/sw;}
// skin weights. The old puck was 100 % LeftShoulder while the suit around it blends Spine1, Spine2, LeftShoulder, LeftArm, Neck and Head and
// changes a lot from one vertex to the next: copying the nearest suit vertices made the patch ripple when the shoulder moved (and a Gaussian
// field bent it out of shape); one set of weights for the whole patch kept it flat but let the suit come through it or leave it by 1 cm.
// So each joint's weight is a plane over the patch (least squares on the suit vertices within PATCH_FIT circle radii): the middle follows
// the suit's overall bend and slope with no ripples; towards the edge (EDGE_BLEND, in circle radii) it turns into the weights of the nearest
// suit vertices (8, inverse squared distance), so the edge and the swoosh tips stay on the suit around them. Normalised.
const _sw=new THREE.Vector3();
const top4=acc=>{const top=[...acc].sort((a,b)=>b[1]-a[1]).slice(0,4),sum=top.reduce((s,x)=>s+x[1],0);while(top.length<4)top.push([0,0]);return {j:top.map(x=>x[0]),w:top.map(x=>x[1]/sum)};};
function exactWeights(i){const acc=new Map();for(let k=0;k<4;k++){const j=sJ.getComponent(i,k),x=sW.getComponent(i,k);if(x>0)acc.set(j,(acc.get(j)||0)+x);}return acc;}
function mixWeights(a,b,t){const acc=new Map(),sa=[...a.values()].reduce((s,x)=>s+x,0),sb=[...b.values()].reduce((s,x)=>s+x,0);
  for(const [j,x] of a)acc.set(j,(acc.get(j)||0)+x/sa*t);for(const [j,x] of b)acc.set(j,(acc.get(j)||0)+x/sb*(1-t));return acc;}
const at=(x,y,h)=>disc.c.clone().addScaledVector(U,x).addScaledVector(UP,y).addScaledVector(N,h);
const WFIT=(()=>{const rows=[];for(const i of near){const q=pl(_sw.fromBufferAttribute(sP,i));if(Math.hypot(q[0],q[1])>RC*PATCH_FIT)continue;rows.push([q[0]/RC,q[1]/RC,i]);}
  const joints=new Set();for(const [,,i] of rows)for(let k=0;k<4;k++)if(sW.getComponent(i,k)>0)joints.add(sJ.getComponent(i,k));
  const M=[[0,0,0],[0,0,0],[0,0,0]];for(const [x,y] of rows){const r=[1,x,y];for(let a=0;a<3;a++)for(let b=0;b<3;b++)M[a][b]+=r[a]*r[b];}
  const det=m=>m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1])-m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0])+m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0]),D=det(M);
  const fit=new Map();for(const j of joints){const r=[0,0,0];for(const [x,y,i] of rows){let wj=0;for(let k=0;k<4;k++)if(sJ.getComponent(i,k)===j)wj+=sW.getComponent(i,k);r[0]+=wj;r[1]+=wj*x;r[2]+=wj*y;}
    fit.set(j,[0,1,2].map(k=>det(M.map((row,ii)=>row.map((xx,jj)=>jj===k?r[ii]:xx)))/D));}
  console.log(`weight planes: ${rows.length} suit vertices within ${PATCH_FIT} radii, ${joints.size} joints`);return fit;})();
// the same 4 joints over the whole patch (the 4 with the most weight on the suit there): a joint swapping in and out of the top 4 from one
// vertex to the next made a crease (Neck turns with the aim)
const JOINTS4=(()=>{const tot=new Map();for(const [j,c] of WFIT)tot.set(j,c[0]);return new Set([...tot].sort((a,b)=>b[1]-a[1]).slice(0,4).map(x=>x[0]));})();
const only4=acc=>{for(const j of [...acc.keys()])if(!JOINTS4.has(j))acc.delete(j);return acc;};
function planeWeights(x,y){const acc=new Map();for(const [j,c] of WFIT){const wj=c[0]+c[1]*x+c[2]*y;if(wj>0)acc.set(j,wj);}return only4(acc);}
function nearWeights(q){const d=near.map(i=>[i,_sw.fromBufferAttribute(sP,i).distanceTo(q)]).sort((a,b)=>a[1]-b[1]).slice(0,8),acc=new Map();
  for(const [i,dd] of d){const f=1/Math.max(1e-6,dd*dd);for(let k=0;k<4;k++){const j=sJ.getComponent(i,k),x=sW.getComponent(i,k)*f;if(x>0)acc.set(j,(acc.get(j)||0)+x);}}return only4(acc);}
function patchWeights(q){const p2=pl(q),x=p2[0]/RC,y=p2[1]/RC,e=smoothstep(EDGE_BLEND[0],EDGE_BLEND[1],Math.hypot(x,y));
  return e<=0?planeWeights(x,y):mixWeights(nearWeights(q),planeWeights(x,y),e);}
const smoothstep=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
{const names=json.skins[0].joints.map(j=>json.nodes[j].name);for(const [nm,x,y] of [['centre',0,0],['top',0,1],['right',1,0],['bottom',0,-1],['left',-1,0]]){
   const t=top4(patchWeights(at(x*RC,y*RC,0)));console.log(`  ${nm}: `+t.j.map((j,k)=>t.w[k]>0.005?names[j]+' '+t.w[k].toFixed(2):'').filter(Boolean).join(', '));}}
// where there is suit under the patch (around the hole and under the tips) its real top is used: the suit alone is rasterised and each
// vertex takes the highest suit within 3 mm (the interpolation left folds of the suit above the tips, or reached up to the collar); over the
// hole, the interpolation
raster([[gSuit,'suit']]);const hS=zbuf.slice();
function suitTop(x,y){const cu=0.5+x/SIDE,cv=0.5-y/SIDE,rad=Math.ceil(0.003/SIDE*GRID);let best=-1e9;
  for(let yy=Math.floor(cv*GRID)-rad;yy<=Math.floor(cv*GRID)+rad;yy++)for(let xx=Math.floor(cu*GRID)-rad;xx<=Math.floor(cu*GRID)+rad;xx++){if(xx<0||yy<0||xx>=GRID||yy>=GRID)continue;best=Math.max(best,hS[yy*GRID+xx]);}return best;}
const surf=(x,y)=>{const t=suitTop(x,y);return t>-1e8?t:suitH(x,y);};
const dPos=[at(0,0,surf(0,0)+THICK)],dIdx=[];
for(let r=1;r<=RINGS;r++)for(let k=0;k<SEGS;k++){const an=k/SEGS*Math.PI*2,rr=RC*r/RINGS,x=Math.cos(an)*rr,y=Math.sin(an)*rr;dPos.push(at(x,y,surf(x,y)+THICK));}
const ring=(r,k)=>1+(r-1)*SEGS+(k%SEGS);
for(let k=0;k<SEGS;k++)dIdx.push(0,ring(1,k),ring(1,k+1));
for(let r=1;r<RINGS;r++)for(let k=0;k<SEGS;k++)dIdx.push(ring(r,k),ring(r+1,k),ring(r+1,k+1),ring(r,k),ring(r+1,k+1),ring(r,k+1));
const sk0=dPos.length;for(let k=0;k<SEGS;k++){const an=k/SEGS*Math.PI*2,x=Math.cos(an)*RC,y=Math.sin(an)*RC;dPos.push(at(x,y,suitH(x,y)-SKIRT));}
for(let k=0;k<SEGS;k++){const a=ring(RINGS,k),b=ring(RINGS,k+1),c=sk0+k,d=sk0+(k+1)%SEGS;dIdx.push(a,c,d,a,d,b);}
// the tips: rings from the circle out to the farthest tip pixel (their own vertices: their UVs are not clamped to the circle)
let TIP_OUT=1;for(let k=0;k<GRID*GRID;k++)if(alphaPx[k]>=64)TIP_OUT=Math.max(TIP_OUT,Math.hypot((k%GRID+0.5)/GRID-0.5,((k/GRID|0)+0.5)/GRID-0.5)/META.r);TIP_OUT+=0.02;
const an0=dPos.length,TR=TIP_RINGS,tring=(r,k)=>an0+r*SEGS+(k%SEGS);
for(let r=0;r<=TR;r++)for(let k=0;k<SEGS;k++){const an=k/SEGS*Math.PI*2,rr=RC*(1+(TIP_OUT-1)*r/TR),x=Math.cos(an)*rr,y=Math.sin(an)*rr;dPos.push(at(x,y,surf(x,y)+THICK));}
const tipTris=[];for(let r=0;r<TR;r++)for(let k=0;k<SEGS;k++)tipTris.push([tring(r,k),tring(r+1,k),tring(r+1,k+1)],[tring(r,k),tring(r+1,k+1),tring(r,k+1)]);
const uvOf=i=>toUV(dPos[i]);
const coversTip=t=>{const uv=t.map(uvOf),[a,b,c]=uv,den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(den)<1e-12)return false;
  const x0=Math.max(0,Math.floor(Math.min(a[0],b[0],c[0])*GRID)-1),x1=Math.min(GRID-1,Math.ceil(Math.max(a[0],b[0],c[0])*GRID)+1),y0=Math.max(0,Math.floor(Math.min(a[1],b[1],c[1])*GRID)-1),y1=Math.min(GRID-1,Math.ceil(Math.max(a[1],b[1],c[1])*GRID)+1);
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const px=(x+0.5)/GRID,py=(y+0.5)/GRID,l1=((b[1]-c[1])*(px-c[0])+(c[0]-b[0])*(py-c[1]))/den,l2=((c[1]-a[1])*(px-c[0])+(a[0]-c[0])*(py-c[1]))/den;
    if(l1<-0.05||l2<-0.05||1-l1-l2<-0.05)continue;if(alphaPx[y*GRID+x]>=64)return true;}return false;}; // (a little margin: no tip pixel lost at a triangle edge)
const tipKeep=tipTris.filter(coversTip);for(const t of tipKeep)dIdx.push(...t);
const gDisc=new THREE.BufferGeometry();gDisc.setAttribute('position',new THREE.Float32BufferAttribute(dPos.flatMap(q=>q.toArray()),3));gDisc.setIndex(dIdx);gDisc.computeVertexNormals();
// (the skirt takes the normals of the rim above it: shaded like the patch's edge, not like a wall facing sideways)
for(let k=0;k<SEGS;k++){const n=new THREE.Vector3().fromBufferAttribute(gDisc.attributes.normal,ring(RINGS,k));gDisc.attributes.normal.setXYZ(sk0+k,n.x,n.y,n.z);}
{const fr=[...Array(an0).keys()].filter(i=>i<sk0).map(i=>pl(dPos[i])[2]);
 console.log(`patch mesh: ${dIdx.length/3} triangles (${tipKeep.length} of them for the tips, out to ${TIP_OUT.toFixed(2)} radii), ${(THICK*1000).toFixed(1)} mm over the suit (its face ${Math.min(...fr).toFixed(4)}..${Math.max(...fr).toFixed(4)} m on the old puck's normal; the puck went up to 0.0054)`);}
raster([[gSuit,'suit'],[gDisc,'patch']]);
console.log(`the texture covers ${SIDE.toFixed(4)} m (the patch is ${(2*RC*100).toFixed(1)} cm across in the model, ${(2*RC*88).toFixed(1)} cm in the game)`);
let covered=0,holes=0,poke=0;
for(let k=0;k<GRID*GRID;k++){if(alphaPx[k]<128)continue;covered++;if(owner[k]<0){holes++;continue;}if(cand[owner[k]].tag==='suit')poke++;}
console.log(`textured texels ${covered}: with nothing under them ${holes}, where the suit is above the patch ${poke}`);
if(holes>covered*0.002)throw new Error('the patch does not cover its texture: '+holes+' texels without surface');
if(poke>covered*0.003)throw new Error('the suit comes through the patch at '+poke+' texels: raise THICK');
const keep=[];for(let t=0;t<dIdx.length/3;t++)keep.push({g:gDisc,tag:'patch',id:[dIdx[t*3],dIdx[t*3+1],dIdx[t*3+2]]});
const RMAX=0.985*META.r;

// 3) the new primitive's vertices (one per source vertex, lifted along its normal) and the black primitive without the puck
const vmap=new Map(),pos=[],nor=[],uvs=[],jnt=[],wgt=[],idx=[];
for(const c of keep){const g=c.g,tri=[];
  for(const i of c.id){let o=vmap.get(i);
    if(o===undefined){o=pos.length/3;vmap.set(i,o);v.fromBufferAttribute(g.attributes.position,i);w.fromBufferAttribute(g.attributes.normal,i);
      pos.push(v.x,v.y,v.z);nor.push(w.x,w.y,w.z);
      const q=toUV(v),du=q[0]-0.5,dv=q[1]-0.5,r=Math.hypot(du,dv),f=i<an0&&r>RMAX?RMAX/r:1;uvs.push(0.5+du*f,0.5+dv*f); // (the circle's edge and skirt: just inside the circle, the stitched border)
      const sw=top4(patchWeights(v));jnt.push(...sw.j);wgt.push(...sw.w);}
    tri.push(o);}
  idx.push(...tri);}
const nV=pos.length/3;if(nV>65535)throw new Error('too many vertices');
const blackIdx=[];for(let t=0;t<gBlack.index.count/3;t++)if(!discTris.has(t))for(let k=0;k<3;k++)blackIdx.push(gBlack.index.getX(t*3+k));
console.log(`patch primitive: ${nV} vertices, ${idx.length/3} triangles; black primitive: ${gBlack.index.count/3} -> ${blackIdx.length/3} triangles`);
if(CHECK)process.exit(0);

// append to the binary chunk (buffer 0) without touching a byte of what is there
let BIN=bin;const views=json.bufferViews,acc=json.accessors;
function push(buf,target){const pad=(4-BIN.length%4)%4;if(pad)BIN=Buffer.concat([BIN,Buffer.alloc(pad)]);const off=BIN.length;BIN=Buffer.concat([BIN,buf]);
  const bv={buffer:0,byteOffset:off,byteLength:buf.length};if(target)bv.target=target;views.push(bv);return views.length-1;}
function accessor(arr,ctor,ct,type,target,extra){const ta=ctor.from(arr);const bv=push(Buffer.from(ta.buffer,ta.byteOffset,ta.byteLength),target);
  const n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[type];acc.push({bufferView:bv,componentType:ct,count:arr.length/n,type,...extra});return acc.length-1;}
const mn=[0,1,2].map(k=>Math.min(...pos.filter((_,i)=>i%3===k))),mx=[0,1,2].map(k=>Math.max(...pos.filter((_,i)=>i%3===k)));
const prim={attributes:{
    POSITION:accessor(pos,Float32Array,5126,'VEC3',34962,{min:mn,max:mx}),
    NORMAL:accessor(nor,Float32Array,5126,'VEC3',34962),
    TEXCOORD_0:accessor(uvs,Float32Array,5126,'VEC2',34962),
    JOINTS_0:accessor(jnt,Uint8Array,5121,'VEC4',34962),
    WEIGHTS_0:accessor(wgt,Float32Array,5126,'VEC4',34962)},
  indices:accessor(idx,Uint16Array,5123,'SCALAR',34963)};
{const bp=json.meshes[meshIx].primitives.find(p=>p.material===BLACK);bp.indices=accessor(blackIdx,Uint16Array,5123,'SCALAR',34963);}
const img=fs.readFileSync(TEX);const imgView=push(img,null);
(json.images||(json.images=[])).push({bufferView:imgView,mimeType:'image/webp',name:'parche_heads'});
(json.samplers||(json.samplers=[])).push({magFilter:9729,minFilter:9987,wrapS:33071,wrapT:33071});
(json.textures||(json.textures=[])).push({sampler:json.samplers.length-1,extensions:{EXT_texture_webp:{source:json.images.length-1}}});
json.materials.push({name:MATERIAL.name,alphaMode:'MASK',alphaCutoff:0.5,
  pbrMetallicRoughness:{baseColorTexture:{index:json.textures.length-1},metallicFactor:0,roughnessFactor:MATERIAL.rough},
  emissiveTexture:{index:json.textures.length-1},emissiveFactor:[MATERIAL.emissive,MATERIAL.emissive,MATERIAL.emissive]});
prim.material=json.materials.length-1;json.meshes[meshIx].primitives.push(prim);
for(const k of ['extensionsUsed','extensionsRequired']){json[k]=json[k]||[];if(!json[k].includes('EXT_texture_webp'))json[k].push('EXT_texture_webp');}
{const pad=(4-BIN.length%4)%4;if(pad)BIN=Buffer.concat([BIN,Buffer.alloc(pad)]);}
json.buffers[0].byteLength=BIN.length;
let js=Buffer.from(JSON.stringify(json),'utf8');js=Buffer.concat([js,Buffer.alloc((4-js.length%4)%4,0x20)]);
const h=Buffer.alloc(12);h.writeUInt32LE(0x46546C67,0);h.writeUInt32LE(2,4);h.writeUInt32LE(12+8+js.length+8+BIN.length,8);
const c1=Buffer.alloc(8);c1.writeUInt32LE(js.length,0);c1.writeUInt32LE(0x4E4F534A,4);const c2=Buffer.alloc(8);c2.writeUInt32LE(BIN.length,0);c2.writeUInt32LE(0x004E4942,4);
const out=Buffer.concat([h,c1,js,c2,BIN]);fs.writeFileSync(OUT,out);
console.log(`wrote ${path.relative(ROOT,OUT)}: ${glb.length} -> ${out.length} bytes (+${out.length-glb.length}; texture ${img.length})`);
