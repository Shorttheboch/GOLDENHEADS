// v74: public/assets/models/ship_mobile.glb = ship.glb with smaller textures, for phones (the game loads it when isTouch).
// ONLY the six embedded JPEGs are replaced: every other byte of the file (the meshopt-compressed geometry, node names, materials, samplers, extensions)
// is copied as is, so the model, the names and the hull maps measured from ship.glb are identical.
//
//   cd tools/ship-mobile && npm i --no-save sharp          (sharp is only needed to make the file; it is not a dependency of the game)
//   node make_ship_mobile.cjs ../../public/assets/models/ship.glb ../../public/assets/models/ship_mobile.glb [--max 2048] [--quality 88]
//        [--size T_Ship_Fuselage_ORM=1024,T_Ship_Engines_BaseColor=1024]      (extra per-texture sizes; --max caps everything else)
//
// Defaults: --max 2048 (the two 4096 maps become 2048, the rest stay), JPEG quality 88 (the original maps are 88-90), normal maps 4:4:4, the others 4:2:0.
const fs=require('fs');
const path=require('path');
const sharp=require(require.resolve('sharp',{paths:[__dirname,process.cwd()]}));

function readGLB(file){
  const b=fs.readFileSync(file);
  if(b.readUInt32LE(0)!==0x46546C67)throw new Error('not a glb: '+file);
  let off=12,json=null,bin=null;
  while(off<b.length){const len=b.readUInt32LE(off),type=b.readUInt32LE(off+4),data=b.subarray(off+8,off+8+len);
    if(type===0x4E4F534A)json=JSON.parse(data.toString('utf8'));else if(type===0x004E4942)bin=Buffer.from(data);off+=8+len;}
  return {json,bin};
}
function writeGLB(file,json,bin){
  let js=Buffer.from(JSON.stringify(json),'utf8');js=Buffer.concat([js,Buffer.alloc((4-js.length%4)%4,0x20)]);
  const bb=Buffer.concat([bin,Buffer.alloc((4-bin.length%4)%4,0)]);
  const h=Buffer.alloc(12);h.writeUInt32LE(0x46546C67,0);h.writeUInt32LE(2,4);h.writeUInt32LE(12+8+js.length+8+bb.length,8);
  const c1=Buffer.alloc(8);c1.writeUInt32LE(js.length,0);c1.writeUInt32LE(0x4E4F534A,4);
  const c2=Buffer.alloc(8);c2.writeUInt32LE(bb.length,0);c2.writeUInt32LE(0x004E4942,4);
  fs.writeFileSync(file,Buffer.concat([h,c1,js,c2,bb]));
}

(async()=>{
  const args=process.argv.slice(2),pos=args.filter(a=>!a.startsWith('--')&&!/^--/.test(args[args.indexOf(a)-1]||''));
  const opt=(k,d)=>{const i=args.indexOf('--'+k);return i<0?d:args[i+1];};
  const [inF,outF]=pos;if(!inF||!outF){console.error('usage: node make_ship_mobile.cjs in.glb out.glb [--max 2048] [--quality 88] [--size Name=px,...]');process.exit(1);}
  const MAX=+opt('max',2048),Q=+opt('quality',88);
  const sizes=Object.fromEntries((opt('size','')||'').split(',').filter(Boolean).map(s=>{const [k,v]=s.split('=');return [k,+v];}));
  const {json,bin}=readGLB(inF);
  const imgViews=new Set(json.images.map(im=>im.bufferView));
  // everything that is not an image must be a meshopt bufferView that points into buffer 0 through its extension (or live in another buffer)
  const geom=[];
  json.bufferViews.forEach((v,i)=>{if(imgViews.has(i))return;const e=v.extensions&&v.extensions.EXT_meshopt_compression;
    if(e){if(e.buffer!==0)throw new Error('meshopt view '+i+' in buffer '+e.buffer);geom.push(e);}else if(v.buffer===0)throw new Error('uncompressed non-image view '+i+' in buffer 0');});
  const geomStart=Math.min(...geom.map(e=>e.byteOffset));
  if(geomStart<Math.max(...[...imgViews].map(i=>json.bufferViews[i].byteOffset+json.bufferViews[i].byteLength)))throw new Error('images and geometry overlap');
  const parts=[];let cur=0;const align=()=>{const p=(8-cur%8)%8;if(p){parts.push(Buffer.alloc(p));cur+=p;}};
  for(const im of json.images){
    const v=json.bufferViews[im.bufferView],src=bin.subarray(v.byteOffset,v.byteOffset+v.byteLength);
    const meta=await sharp(src).metadata();
    const want=Math.min(sizes[im.name]||MAX,meta.width);   // never upscale
    let out=src,note='kept';
    if(want<meta.width){
      out=await sharp(src).resize(want,want,{kernel:'lanczos3'}).jpeg({quality:Q,mozjpeg:true,chromaSubsampling:/Normal/.test(im.name)?'4:4:4':'4:2:0'}).toBuffer();note='-> '+want;}
    align();v.byteOffset=cur;v.byteLength=out.length;parts.push(out);cur+=out.length;
    console.log(im.name.padEnd(28),meta.width+'x'+meta.height,(src.length/1024).toFixed(0).padStart(6)+' KB ',note.padEnd(8),(out.length/1024).toFixed(0).padStart(6)+' KB');
  }
  align();const delta=cur-geomStart;
  parts.push(bin.subarray(geomStart));
  for(const e of geom)e.byteOffset+=delta;
  const nb=Buffer.concat(parts);json.buffers[0].byteLength=nb.length;
  writeGLB(outF,json,nb);
  console.log('wrote',outF,(fs.statSync(outF).size/1048576).toFixed(2)+' MB (was '+(fs.statSync(inF).size/1048576).toFixed(2)+' MB)');
})().catch(e=>{console.error(e);process.exit(1);});
