// v92: puts the astronaut's normal map (puffer fabric, seams, zips, laces) into astronaut.glb.
//
//   node tools/astro-normal/add_normal_glb.mjs --src <astronaut with the HEADS patch>.glb --tex tools/astro-normal/normal_2048.jpg --out public/assets/models/astronaut.glb
//   node tools/astro-normal/add_normal_glb.mjs --src ... --tex tools/astro-normal/normal_1024.jpg --out public/assets/models/astronaut_mobile.glb
//
// The whole chain (see the design doc, v92):
//   1) Blender: astronaut_body exported with ONE uv map, UV_game (the one the normal map was baked on), with tangents and meshopt
//      (export_tangents, export_meshopt_compression_enable). The first commit of v92 keeps that export as public/assets/models/astronaut.glb.
//   2) node tools/parche/make_patch_glb.mjs (v89) adds the HEADS patch on the chest (it reads that commit).
//   3) this tool: one JPEG image (4:4:4, see make_normal_web.py) as the normalTexture of the body materials (gold suit, black gloves,
//      helmet metal, black visor, black zips, zip pulls). Every primitive that uses one must have TEXCOORD_0 and TANGENT (three then uses the baked tangents,
//      the same MikkTSpace ones Blender baked with). The backpack uses the gold suit material too but has no UVs: it gets its own copy of the
//      material without the normal map (M_Suit_Gold_Pack; the game treats it like the suit because the name has "Suit" in it).
//      And the finish of the metal (FINISH): the helmet's grey metal was a dark, rough mirror (base 0.29, roughness 0.5) that only showed the
//      purple nebula blurred; now polished silver like Santi's references. The zips (M_Zip_Black, tape and teeth; M_Zip_Pull, sliders and tabs)
//      are their own materials since v92 (Blender, on the export copy of the mesh: the grey pieces of the jacket under z 1.5), black like the
//      references instead of grey metal.
// It only appends: the image goes at the end of the binary chunk, nothing else in it moves. It refuses a file that already has a normal map.
import fs from 'fs';
import path from 'path';

const args=process.argv.slice(2),opt=(k,d)=>{const i=args.indexOf('--'+k);return i<0?d:args[i+1];};
const SRC=opt('src'),TEX=opt('tex'),OUT=opt('out');
if(!SRC||!TEX||!OUT){console.error('usage: add_normal_glb.mjs --src in.glb --tex normal.jpg --out out.glb');process.exit(2);}
const NORMAL_MATS=['M_Suit_Gold','M_Glove_Black','M_Metal_Grey','M_Visor_Black','M_Zip_Black','M_Zip_Pull'];
const FINISH={M_Metal_Grey:{base:[0.6,0.6,0.61],metal:1,rough:0.2}};

function readGLB(b){if(b.readUInt32LE(0)!==0x46546C67)throw new Error('not a glb');let off=12,json=null,bin=null;
  while(off<b.length){const len=b.readUInt32LE(off),type=b.readUInt32LE(off+4),data=b.subarray(off+8,off+8+len);
    if(type===0x4E4F534A)json=JSON.parse(data.toString('utf8'));else if(type===0x004E4942)bin=Buffer.from(data);off+=8+len;}
  return {json,bin};}
function writeGLB(json,bin){
  const js=Buffer.from(JSON.stringify(json),'utf8'),jp=Buffer.concat([js,Buffer.alloc((4-js.length%4)%4,0x20)]);
  const bp=Buffer.concat([bin,Buffer.alloc((4-bin.length%4)%4,0)]);
  const h=Buffer.alloc(12);h.writeUInt32LE(0x46546C67,0);h.writeUInt32LE(2,4);h.writeUInt32LE(12+8+jp.length+8+bp.length,8);
  const c1=Buffer.alloc(8);c1.writeUInt32LE(jp.length,0);c1.writeUInt32LE(0x4E4F534A,4);
  const c2=Buffer.alloc(8);c2.writeUInt32LE(bp.length,0);c2.writeUInt32LE(0x004E4942,4);
  return Buffer.concat([h,c1,jp,c2,bp]);}

const {json}=readGLB(fs.readFileSync(path.resolve(SRC)));let {bin}=readGLB(fs.readFileSync(path.resolve(SRC)));
if((json.materials||[]).some(m=>m.normalTexture))throw new Error('the source already has a normal map');
const img=fs.readFileSync(path.resolve(TEX));
if(img[0]!==0xFF||img[1]!==0xD8)throw new Error('the texture must be a JPEG');
const W=img.readUInt16BE(img.indexOf(Buffer.from([0xFF,0xC0]))+7)||0;

// the image at the end of buffer 0 (the binary chunk)
const pad=(4-bin.length%4)%4;bin=Buffer.concat([bin,Buffer.alloc(pad),img]);
const bv=json.bufferViews.push({buffer:0,byteOffset:bin.length-img.length,byteLength:img.length})-1;
json.buffers[0].byteLength=bin.length;
json.images=json.images||[];json.samplers=json.samplers||[];json.textures=json.textures||[];
const im=json.images.push({name:'astronaut_normal',mimeType:'image/jpeg',bufferView:bv})-1;
const sm=json.samplers.push({magFilter:9729,minFilter:9987,wrapS:33071,wrapT:33071})-1;
const tx=json.textures.push({sampler:sm,source:im})-1;

// materials: the four body ones get the map; a primitive without UVs/tangents that shares one gets a copy without it
const mIx=n=>json.materials.findIndex(m=>m.name===n);
const want=new Set(NORMAL_MATS.map(n=>{const i=mIx(n);if(i<0)throw new Error('no material '+n);return i;}));
const copies=new Map();
for(const mesh of json.meshes)for(const p of mesh.primitives){
  if(!want.has(p.material))continue;
  if(p.attributes.TEXCOORD_0!==undefined&&p.attributes.TANGENT!==undefined)continue;
  if(mesh.name==='NEW_body')throw new Error('a body primitive has no UVs or tangents: export with UV_game and export_tangents');
  if(!copies.has(p.material)){const c=JSON.parse(JSON.stringify(json.materials[p.material]));c.name+=mesh.name==='NEW_backpack'?'_Pack':'_NoMap';copies.set(p.material,json.materials.push(c)-1);}
  console.log(`  ${mesh.name}: ${json.materials[p.material].name} -> ${json.materials[copies.get(p.material)].name} (no UVs)`);
  p.material=copies.get(p.material);}
for(const i of want)json.materials[i].normalTexture={index:tx};
for(const [n,f] of Object.entries(FINISH)){const m=json.materials[mIx(n)];if(!m)throw new Error('no material '+n);
  const pbr=m.pbrMetallicRoughness=m.pbrMetallicRoughness||{};pbr.baseColorFactor=[...f.base,1];pbr.metallicFactor=f.metal;pbr.roughnessFactor=f.rough;}

fs.writeFileSync(path.resolve(OUT),writeGLB(json,bin));
console.log(`${OUT}: ${fs.statSync(path.resolve(OUT)).size} bytes; normal map ${W}x${W} (${img.length} bytes) on ${[...want].map(i=>json.materials[i].name).join(', ')}`);
