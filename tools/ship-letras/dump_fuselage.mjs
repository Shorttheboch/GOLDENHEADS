// v100: the fuselage triangles of ship.glb with their UVs, for make_letras.py. Writes a Float32 file, 15 floats per triangle:
// 3 x (x, y, z, u, v) in the model's own space (glTF: +Y up, nose toward +Z). Only the primitives with material M_HEADS_Ship_Fuselage.
//   node tools/ship-letras/dump_fuselage.mjs public/assets/models/ship.glb out.f32
import fs from 'fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/examples/jsm/libs/meshopt_decoder.module.js';
const [inF,outF]=process.argv.slice(2);
const b=fs.readFileSync(inF);let off=12,json=null,bin=null;
while(off<b.length){const len=b.readUInt32LE(off),type=b.readUInt32LE(off+4),d=b.subarray(off+8,off+8+len);
  if(type===0x4E4F534A)json=JSON.parse(d.toString('utf8'));else if(type===0x004E4942)bin=Buffer.from(d);off+=8+len;}
delete json.images;delete json.textures;delete json.samplers;
const strip=o=>{for(const k of Object.keys(o))if(k.endsWith('Texture'))delete o[k];};
for(const m of json.materials||[]){strip(m);if(m.pbrMetallicRoughness)strip(m.pbrMetallicRoughness);}
let js=Buffer.from(JSON.stringify(json),'utf8');js=Buffer.concat([js,Buffer.alloc((4-js.length%4)%4,0x20)]);const bb=Buffer.concat([bin,Buffer.alloc((4-bin.length%4)%4,0)]);
const h=Buffer.alloc(12);h.writeUInt32LE(0x46546C67,0);h.writeUInt32LE(2,4);h.writeUInt32LE(12+8+js.length+8+bb.length,8);
const c1=Buffer.alloc(8);c1.writeUInt32LE(js.length,0);c1.writeUInt32LE(0x4E4F534A,4);const c2=Buffer.alloc(8);c2.writeUInt32LE(bb.length,0);c2.writeUInt32LE(0x004E4942,4);
const glb=Buffer.concat([h,c1,js,c2,bb]);
const loader=new GLTFLoader();loader.setMeshoptDecoder(MeshoptDecoder);
const gltf=await new Promise((res,rej)=>loader.parse(glb.buffer.slice(glb.byteOffset,glb.byteOffset+glb.byteLength),'',res,rej));
gltf.scene.updateMatrixWorld(true);
const out=[],a=new THREE.Vector3();
gltf.scene.traverse(o=>{if(!o.isMesh)return;const mats=Array.isArray(o.material)?o.material:[o.material];
  console.log('mesh',o.name,mats.map(m=>m.name).join(','),o.geometry.index?o.geometry.index.count/3:0);
  if(!mats.some(m=>m.name==='M_HEADS_Ship_Fuselage'))return;
  const g=o.geometry,pos=g.attributes.position,uv=g.attributes.uv,ix=g.index;
  const groups=g.groups.length?g.groups:[{start:0,count:ix.count,materialIndex:0}];
  for(const gr of groups){if(mats[gr.materialIndex].name!=='M_HEADS_Ship_Fuselage')continue;
    for(let i=gr.start;i<gr.start+gr.count;i++){const k=ix.getX(i);a.fromBufferAttribute(pos,k).applyMatrix4(o.matrixWorld);out.push(a.x,a.y,a.z,uv.getX(k),uv.getY(k));}}});
fs.writeFileSync(outF,Buffer.from(Float32Array.from(out).buffer));console.log('fuselage triangles',out.length/15);
