// v100: puts textures back into a .glb by name: every <image name>.jpg found in <dir> replaces the embedded image of that name.
// Like tools/ship-mobile/make_ship_mobile.cjs, every other byte (the meshopt geometry, names, materials) is copied as is,
// so the hull maps and the wing table measured from ship.glb stay valid.
//   node tools/ship-letras/put_textures.cjs public/assets/models/ship.glb <dir> [out.glb]      (out defaults to the input)
const fs=require('fs'),path=require('path');
function readGLB(file){const b=fs.readFileSync(file);if(b.readUInt32LE(0)!==0x46546C67)throw new Error('not a glb: '+file);let off=12,json=null,bin=null;
  while(off<b.length){const len=b.readUInt32LE(off),type=b.readUInt32LE(off+4),data=b.subarray(off+8,off+8+len);
    if(type===0x4E4F534A)json=JSON.parse(data.toString('utf8'));else if(type===0x004E4942)bin=Buffer.from(data);off+=8+len;}return {json,bin};}
function writeGLB(file,json,bin){let js=Buffer.from(JSON.stringify(json),'utf8');js=Buffer.concat([js,Buffer.alloc((4-js.length%4)%4,0x20)]);
  const bb=Buffer.concat([bin,Buffer.alloc((4-bin.length%4)%4,0)]);const h=Buffer.alloc(12);h.writeUInt32LE(0x46546C67,0);h.writeUInt32LE(2,4);h.writeUInt32LE(12+8+js.length+8+bb.length,8);
  const c1=Buffer.alloc(8);c1.writeUInt32LE(js.length,0);c1.writeUInt32LE(0x4E4F534A,4);const c2=Buffer.alloc(8);c2.writeUInt32LE(bb.length,0);c2.writeUInt32LE(0x004E4942,4);
  fs.writeFileSync(file,Buffer.concat([h,c1,js,c2,bb]));}
const [inF,dir,outF=inF]=process.argv.slice(2);if(!inF||!dir){console.error('usage: node put_textures.cjs in.glb dir [out.glb]');process.exit(1);}
const {json,bin}=readGLB(inF);const imgViews=new Set(json.images.map(im=>im.bufferView));const geom=[];
json.bufferViews.forEach((v,i)=>{if(imgViews.has(i))return;const e=v.extensions&&v.extensions.EXT_meshopt_compression;
  if(e){if(e.buffer!==0)throw new Error('meshopt view '+i+' in buffer '+e.buffer);geom.push(e);}else if(v.buffer===0)throw new Error('uncompressed non-image view '+i+' in buffer 0');});
const geomStart=Math.min(...geom.map(e=>e.byteOffset));
const parts=[];let cur=0,n=0;const align=()=>{const p=(8-cur%8)%8;if(p){parts.push(Buffer.alloc(p));cur+=p;}};
for(const im of json.images){const v=json.bufferViews[im.bufferView];let out=bin.subarray(v.byteOffset,v.byteOffset+v.byteLength);
  const f=path.join(dir,im.name+'.jpg');if(fs.existsSync(f)){const nb=fs.readFileSync(f);console.log(im.name.padEnd(28),(out.length/1024).toFixed(0)+' KB ->',(nb.length/1024).toFixed(0)+' KB');out=nb;n++;}
  align();v.byteOffset=cur;v.byteLength=out.length;parts.push(out);cur+=out.length;}
align();const delta=cur-geomStart;parts.push(bin.subarray(geomStart));for(const e of geom)e.byteOffset+=delta;
const nb=Buffer.concat(parts);json.buffers[0].byteLength=nb.length;writeGLB(outF,json,nb);
console.log('replaced',n,'images; wrote',outF,(fs.statSync(outF).size/1048576).toFixed(2)+' MB');
