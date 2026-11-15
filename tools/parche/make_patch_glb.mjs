// v89: puts the HEADS patch (tools/parche/parche.webp, made by make_patch_tex.py) on the black circle of the astronaut's chest.
//
//   node tools/parche/make_patch_glb.mjs [--src <astronaut without patch>.glb] [--out public/assets/models/astronaut.glb] [--check]
//
// The astronaut has no textures (flat materials) and the black circle is part of the black material (M_Glove_Black). This tool does not touch
// any existing byte of the file: it appends one more primitive to the body mesh (same skin), with its own small material M_Patch (the 1024x512
// WebP, alpha MASK, non-metallic, a little of the texture as emission so it reads in the dark). That primitive is a copy of the triangles you see
// from the front over the patch area (the black disc and, where the red swoosh leaves the circle, the gold suit), lifted 0.5 mm along their
// normals, with planar UVs on the disc's plane: the disc's triangles use the left half of the texture (the circle), the suit's the right half
// (only the swoosh tips: the suit moves a little differently from the disc when the astronaut bends, and must never show the inside of the circle).
//  1) the disc = the black connected piece near DISC_AT; its plane (PCA), centre (circle fit of its rim) and radius give the projection, so the
//     texture's circle lands exactly on it (image right = the astronaut's left = +x, image up = +y);
//  2) every front-facing triangle of the suit and the black material inside the texture square is rasterised on a 512 grid with its height
//     along the disc normal; only the frontmost triangle at each texel counts: a black triangle is kept if it is frontmost at some texel of the
//     circle, a suit triangle if it is frontmost at some texel of the tips (alpha >= 0.5);
//  3) EXT_texture_webp (required: the game already needs WebP for its menus and HUD).
// By default it starts from the astronaut of v88 (git show bcde206:public/assets/models/astronaut.glb), so it can be run again after the patch is in.
import fs from 'fs';
import path from 'path';
import {execSync} from 'child_process';
import {fileURLToPath} from 'url';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const HERE=path.dirname(fileURLToPath(import.meta.url)),ROOT=path.resolve(HERE,'..','..');
const args=process.argv.slice(2),opt=(k,d)=>{const i=args.indexOf('--'+k);return i<0?d:args[i+1];};
const PRISTINE='bcde206';                          // v88: the last astronaut without the patch
const OUT=path.resolve(ROOT,opt('out','public/assets/models/astronaut.glb')),CHECK=args.includes('--check');
const TEX=path.join(HERE,'parche.webp'),META=JSON.parse(fs.readFileSync(path.join(HERE,'parche.json'),'utf8'));
const DISC_AT=new THREE.Vector3(0.115,1.443,0.079); // the black circle on the left of the chest (mesh space of NEW_body, Blender export)
const LIFT=0.0005,GRID=512,MIN_NDOT=0.2,MATERIAL={name:'M_Patch',rough:0.62,emissive:0.3};

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
let SIDE=RD/META.r;                                // model units covered by one half of the texture (its circle radius r maps to the disc)
const toUV=q=>{w.copy(q).sub(disc.c);return [0.5+w.dot(U)/SIDE,0.5-w.dot(UP)/SIDE,w.dot(N)];};
console.log(`disc: ${disc.tris.length} triangles, centre ${disc.c.toArray().map(x=>x.toFixed(4))}, normal ${N.toArray().map(x=>x.toFixed(3))}, outer radius ${RD.toFixed(4)}`);

// 2) frontmost triangles over the textured texels
const alphaPx=await (async()=>{ // the texture's alpha (2*GRID x GRID), decoded with sharp (already in node_modules) or PIL as a fallback
  let a;try{const sharp=(await import('sharp')).default;const {data,info}=await sharp(TEX).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    if(info.width!==2*GRID||info.height!==GRID)throw new Error('texture is not '+2*GRID+'x'+GRID);a=new Uint8Array(2*GRID*GRID);for(let i=0;i<a.length;i++)a[i]=data[i*4+3];}
  catch(e){a=new Uint8Array(execSync(`python3 -c "from PIL import Image;import sys;sys.stdout.buffer.write(Image.open(sys.argv[1]).convert('RGBA').getchannel('A').tobytes())" "${TEX}"`,{maxBuffer:8<<20}));}
  if(a.length!==2*GRID*GRID)throw new Error('texture is not '+2*GRID+'x'+GRID);return a;})();
const aDisc=k=>alphaPx[(k/GRID|0)*2*GRID+k%GRID],aTips=k=>alphaPx[(k/GRID|0)*2*GRID+GRID+k%GRID];
let zbuf,owner,cand;
function raster(){zbuf=new Float32Array(GRID*GRID).fill(-1e9);owner=new Int32Array(GRID*GRID).fill(-1);cand=[];
for(const [g,tag] of [[gSuit,'suit'],[gBlack,'black']]){const p=g.attributes.position,n=g.attributes.normal,ix=g.index;
  for(let t=0;t<ix.count/3;t++){const id=[ix.getX(t*3),ix.getX(t*3+1),ix.getX(t*3+2)];const uv=[];let ok=true,nd=0;
    for(const i of id){const q=toUV(v.fromBufferAttribute(p,i));uv.push(q);nd+=w.fromBufferAttribute(n,i).dot(N)/3;if(q[2]<-0.04||q[2]>0.05)ok=false;}
    if(!ok||nd<MIN_NDOT)continue;
    const minU=Math.min(uv[0][0],uv[1][0],uv[2][0]),maxU=Math.max(uv[0][0],uv[1][0],uv[2][0]),minV=Math.min(uv[0][1],uv[1][1],uv[2][1]),maxV=Math.max(uv[0][1],uv[1][1],uv[2][1]);
    if(maxU<0||minU>1||maxV<0||minV>1)continue;
    const ci=cand.length;cand.push({g,tag,id,uv,hit:0,off:tag==='suit'?0.5:0});
    const x0=Math.max(0,Math.floor(minU*GRID)),x1=Math.min(GRID-1,Math.ceil(maxU*GRID)),y0=Math.max(0,Math.floor(minV*GRID)),y1=Math.min(GRID-1,Math.ceil(maxV*GRID));
    const [a,b,c]=uv,den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(den)<1e-12)continue;
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const px=(x+0.5)/GRID,py=(y+0.5)/GRID;
      const l1=((b[1]-c[1])*(px-c[0])+(c[0]-b[0])*(py-c[1]))/den,l2=((c[1]-a[1])*(px-c[0])+(a[0]-c[0])*(py-c[1]))/den,l3=1-l1-l2;
      if(l1<-1e-4||l2<-1e-4||l3<-1e-4)continue;const h=l1*a[2]+l2*b[2]+l3*c[2],k=y*GRID+x;if(h>zbuf[k]){zbuf[k]=h;owner[k]=ci;}}}}}
// the disc is a polygon whose outer bevel dips under the suit: seen from the front, the black circle ends a little inside its outer radius.
// Pass 1 finds that visible edge (from the centre outwards along 720 rays, where the suit takes over), pass 2 maps the texture's circle onto it,
// so the whole stitched border shows and the original black disc makes a hairline margin around it.
raster();
{const rays=[];for(let k=0;k<720;k++){const an=k/720*Math.PI*2;let last=0;
   for(let r=0;r<0.5;r+=0.25/GRID){const x=Math.floor((0.5+Math.cos(an)*r)*GRID),y=Math.floor((0.5-Math.sin(an)*r)*GRID);const o=owner[y*GRID+x];if(o<0||cand[o].tag!=='black')break;last=r;}
   rays.push(last*SIDE);}
 rays.sort((a,b)=>a-b);const RV=rays[Math.floor(rays.length*0.03)];
 console.log(`visible black edge: ${rays[0].toFixed(4)} .. ${rays[rays.length-1].toFixed(4)} m (3rd percentile ${RV.toFixed(4)}); the texture's circle goes there`);
 SIDE=RV/META.r;}
raster();
console.log(`one half of the texture covers ${SIDE.toFixed(4)} m (the patch is ${(2*META.r*SIDE*100).toFixed(1)} cm across in the model, ${(2*META.r*SIDE*88).toFixed(1)} cm in the game)`);
let covered=0,holes=0,suitOverDisc=0;
for(let k=0;k<GRID*GRID;k++){const o=owner[k],d=aDisc(k)>=128,t=aTips(k)>=128;if(!d&&!t)continue;covered++;if(o<0){holes++;continue;}const c=cand[o];
  if(d&&c.tag==='black')c.hit++;else if(d&&c.tag==='suit')suitOverDisc++;if(t&&c.tag==='suit')c.hit++;}
const keep=cand.filter(c=>c.hit>0);
console.log(`candidates ${cand.length}, kept ${keep.length} (suit ${keep.filter(c=>c.tag==='suit').length} under the tips, black ${keep.filter(c=>c.tag==='black').length} of the disc); textured texels ${covered}, with no surface under them ${holes}, circle texels where the suit is in front of the disc ${suitOverDisc}`);
if(holes>covered*0.002)throw new Error('the patch does not sit on the model: '+holes+' texels without surface');

// 3) the new primitive's vertices (one per source vertex, lifted along its normal)
const vmap=new Map(),pos=[],nor=[],uvs=[],jnt=[],wgt=[],idx=[];
for(const c of keep){const g=c.g,tri=[];
  for(const i of c.id){const key=(c.tag==='suit'?'s':'b')+i;let o=vmap.get(key);
    if(o===undefined){o=pos.length/3;vmap.set(key,o);v.fromBufferAttribute(g.attributes.position,i);w.fromBufferAttribute(g.attributes.normal,i);
      const q=toUV(v);v.addScaledVector(w,LIFT);pos.push(v.x,v.y,v.z);nor.push(w.x,w.y,w.z);uvs.push(c.off+q[0]*0.5,q[1]); // (left half: disc · right half: tips)
      const J=g.attributes.skinIndex,Wt=g.attributes.skinWeight;for(let k=0;k<4;k++){jnt.push(J.getComponent(i,k));wgt.push(Wt.getComponent(i,k));}}
    tri.push(o);}
  idx.push(...tri);}
const nV=pos.length/3;if(nV>65535)throw new Error('too many vertices');
console.log(`patch primitive: ${nV} vertices, ${idx.length/3} triangles`);
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
