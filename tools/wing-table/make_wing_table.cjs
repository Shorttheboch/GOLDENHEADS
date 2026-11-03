// v79: bakes the REAL height of the wings and nacelles (the first surface of ship.glb under a point, seen from above) into the table that
// src/game/05-wing-table.js reads (wingY / wingNormal). wingTop() (05-rocks.js) is the top of a 0.2 m voxel: on the real wing it is +0.15 m too high
// on average (up to +0.23 on the spiders' walk) and it jumps in 0.2 m steps, so the spiders that walk out on the wings floated and popped.
//
//   node tools/wing-table/make_wing_table.cjs                     (writes the table block of src/game/05-wing-table.js)
//   node tools/wing-table/make_wing_table.cjs --check-only        (measures the table in the file against the real ship, writes nothing)
//        [--ship public/assets/models/ship.glb] [--mobile public/assets/models/ship_mobile.glb] [--out src/game/05-wing-table.js]
//
// Needs no browser and no extra package (three, already a dependency, reads the .glb; the textures are dropped, only geometry is used).
// Run it again whenever ship.glb or the WV voxel map (05-rocks.js) changes. It also checks that ship_mobile.glb has the same geometry.
// One node per 0.2 m column of WV (the centre of the column); 0 = no wing there (wingTop() is null) or unknown. Height = Y0 + Q * value.
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..','..');
const args=process.argv.slice(2),opt=(k,d)=>{const i=args.indexOf('--'+k);return i<0?d:args[i+1];};
const SHIP=path.resolve(ROOT,opt('ship','public/assets/models/ship.glb')),MOBILE=path.resolve(ROOT,opt('mobile','public/assets/models/ship_mobile.glb'));
const OUT=path.resolve(ROOT,opt('out','src/game/05-wing-table.js')),ROCKS=path.resolve(ROOT,'src/game/05-rocks.js'),CHECK_ONLY=args.includes('--check-only');
const XA=2.4,XB=9.2;                // |x| range of the table (the spiders' feet reach |x| 3.2 .. 8.5)
const BEGIN='/*TABLE:BEGIN*/',END='/*TABLE:END*/';

function readGLB(file){const b=fs.readFileSync(file);if(b.readUInt32LE(0)!==0x46546C67)throw new Error('not a glb: '+file);let off=12,json=null,bin=null;
  while(off<b.length){const len=b.readUInt32LE(off),type=b.readUInt32LE(off+4),data=b.subarray(off+8,off+8+len);
    if(type===0x4E4F534A)json=JSON.parse(data.toString('utf8'));else if(type===0x004E4942)bin=Buffer.from(data);off+=8+len;}
  return {json,bin};}
// world-space triangles of every mesh in the file (Float32Array, 9 per triangle); the textures are removed first so three can parse it in node
async function loadTris(file,THREE,GLTFLoader,MeshoptDecoder){
  const {json,bin}=readGLB(file);delete json.images;delete json.textures;delete json.samplers;
  const strip=o=>{for(const k of Object.keys(o))if(k.endsWith('Texture'))delete o[k];};
  for(const m of json.materials||[]){strip(m);if(m.pbrMetallicRoughness)strip(m.pbrMetallicRoughness);if(m.extensions)for(const e of Object.values(m.extensions))if(e&&typeof e==='object')strip(e);}
  let js=Buffer.from(JSON.stringify(json),'utf8');js=Buffer.concat([js,Buffer.alloc((4-js.length%4)%4,0x20)]);const bb=Buffer.concat([bin,Buffer.alloc((4-bin.length%4)%4,0)]);
  const h=Buffer.alloc(12);h.writeUInt32LE(0x46546C67,0);h.writeUInt32LE(2,4);h.writeUInt32LE(12+8+js.length+8+bb.length,8);
  const c1=Buffer.alloc(8);c1.writeUInt32LE(js.length,0);c1.writeUInt32LE(0x4E4F534A,4);const c2=Buffer.alloc(8);c2.writeUInt32LE(bb.length,0);c2.writeUInt32LE(0x004E4942,4);
  const glb=Buffer.concat([h,c1,js,c2,bb]);const ab=glb.buffer.slice(glb.byteOffset,glb.byteOffset+glb.byteLength);
  const loader=new GLTFLoader();loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf=await new Promise((res,rej)=>loader.parse(ab,'',res,rej));gltf.scene.updateMatrixWorld(true);
  const out=[],a=new THREE.Vector3();
  gltf.scene.traverse(o=>{if(!o.isMesh||!o.geometry)return;const g=o.geometry,pos=g.attributes.position,ix=g.index,n=ix?ix.count:pos.count;
    for(let i=0;i<n;i++){a.fromBufferAttribute(pos,ix?ix.getX(i):i).applyMatrix4(o.matrixWorld);out.push(a.x,a.y,a.z);}});
  return Float32Array.from(out);}
// the WV voxel map out of 05-rocks.js (the game's own wingTop())
function readWV(){const s=fs.readFileSync(ROCKS,'utf8');
  const m=/const WV=\{X0:(-?[\d.]+),Y0:(-?[\d.]+),Z0:(-?[\d.]+),R:([\d.]+),NX:(\d+),NY:(\d+),NZ:(\d+),bits:Uint8Array\.from\(atob\("([^"]+)"\)/.exec(s);
  if(!m)throw new Error('WV not found in '+ROCKS);
  const WV={X0:+m[1],Y0:+m[2],Z0:+m[3],R:+m[4],NX:+m[5],NY:+m[6],NZ:+m[7],bits:Uint8Array.from(Buffer.from(m[8],'base64'))};
  WV.top=(x,z)=>{const ix=Math.floor((x-WV.X0)/WV.R),iz=Math.floor((z-WV.Z0)/WV.R);if(ix<0||iz<0||ix>=WV.NX||iz>=WV.NZ)return null;
    for(let iy=WV.NY-1;iy>=0;iy--){const i=(iz*WV.NY+iy)*WV.NX+ix;if((WV.bits[i>>3]>>(i&7)&1)===1)return WV.Y0+(iy+1)*WV.R;}return null;};
  return WV;}
// first surface under (x,z) seen from above: the highest triangle point below ymax (2D grid of the triangles' xz boxes)
function makeCaster(S){const NT=S.length/9,C=0.5;let x0=1e9,z0=1e9,x1=-1e9,z1=-1e9;
  for(let i=0;i<S.length;i+=3){x0=Math.min(x0,S[i]);x1=Math.max(x1,S[i]);z0=Math.min(z0,S[i+2]);z1=Math.max(z1,S[i+2]);}
  const NX=Math.ceil((x1-x0)/C)+1,NZ=Math.ceil((z1-z0)/C)+1,cells=new Array(NX*NZ);
  for(let t=0;t<NT;t++){const o=t*9;let a=1e9,b=-1e9,c=1e9,d=-1e9;for(let k=0;k<3;k++){a=Math.min(a,S[o+k*3]);b=Math.max(b,S[o+k*3]);c=Math.min(c,S[o+k*3+2]);d=Math.max(d,S[o+k*3+2]);}
    for(let iz=Math.floor((c-z0)/C);iz<=Math.floor((d-z0)/C);iz++)for(let ix=Math.floor((a-x0)/C);ix<=Math.floor((b-x0)/C);ix++)(cells[iz*NX+ix]||(cells[iz*NX+ix]=[])).push(t);}
  return function top(x,z,ymax){const ix=Math.floor((x-x0)/C),iz=Math.floor((z-z0)/C);if(ix<0||iz<0||ix>=NX||iz>=NZ)return null;const L=cells[iz*NX+ix];if(!L)return null;let best=null;
    for(const t of L){const o=t*9,ax=S[o],ay=S[o+1],az=S[o+2],bx=S[o+3],by=S[o+4],bz=S[o+5],cx=S[o+6],cy=S[o+7],cz=S[o+8];
      const den=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);if(Math.abs(den)<1e-9)continue;
      const l1=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/den,l2=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/den,l3=1-l1-l2,e=-1e-6;
      if(l1<e||l2<e||l3<e)continue;const y=l1*ay+l2*by+l3*cy;if(y<=ymax&&(best===null||y>best))best=y;}
    return best;};}

(async()=>{
  const threeDir=path.join(ROOT,'node_modules','three'),imp=f=>import(require('url').pathToFileURL(path.join(threeDir,f)).href);
  const THREE=await imp('build/three.module.js');
  const {GLTFLoader}=await imp('examples/jsm/loaders/GLTFLoader.js');
  const {MeshoptDecoder}=await imp('examples/jsm/libs/meshopt_decoder.module.js');
  const WV=readWV(),YMAX=WV.Y0+WV.NY*WV.R+0.3;
  // ---- the mobile ship must have the same geometry (only its textures differ)
  const S=await loadTris(SHIP,THREE,GLTFLoader,MeshoptDecoder);
  if(fs.existsSync(MOBILE)){const M=await loadTris(MOBILE,THREE,GLTFLoader,MeshoptDecoder);let same=M.length===S.length;if(same)for(let i=0;i<S.length;i++)if(Math.abs(S[i]-M[i])>1e-6){same=false;break;}
    console.log('ship_mobile.glb geometry vs ship.glb:',same?'identical ('+(S.length/9)+' triangles)':'DIFFERENT');if(!same){console.error('ship_mobile.glb has other geometry: regenerate it (tools/ship-mobile)');process.exit(1);}}
  const top=makeCaster(S);
  const real=(x,z)=>top(x,z,YMAX);
  let blockSrc=null,tiles=null,Q=0,Y0=0;
  if(CHECK_ONLY){ // read the table that is in the file (evaluated as written)
    const src=fs.readFileSync(OUT,'utf8'),i=src.indexOf(BEGIN),j=src.indexOf(END);if(i<0||j<0)throw new Error('table markers not found in '+OUT);
    const WT=new Function('atob','return '+/const WT=([\s\S]*?);\s*$/.exec(src.slice(i+BEGIN.length,j).trim())[1].replace(/Uint8Array\.from\(atob\(("[^"]*")\),c=>c\.charCodeAt\(0\)\)/g,'Uint8Array.from(atob($1),c=>c.charCodeAt(0))'))(s=>Buffer.from(s,'base64').toString('latin1'));
    tiles=WT.tiles;Q=WT.Q;Y0=WT.Y0;}
  else{
    // ---- which columns have a wing: the z range of WV columns inside |x| XA..XB
    let iz0=1e9,iz1=-1;for(let iz=0;iz<WV.NZ;iz++)for(let ix=0;ix<WV.NX;ix++){const xc=WV.X0+(ix+0.5)*WV.R;if(Math.abs(xc)<XA||Math.abs(xc)>XB)continue;
      if(WV.top(xc,WV.Z0+(iz+0.5)*WV.R)!==null){iz0=Math.min(iz0,iz);iz1=Math.max(iz1,iz);}}
    iz0=Math.max(0,iz0-1);iz1=Math.min(WV.NZ-1,iz1+1);
    // ---- the real top at every column centre
    const raw=[];let lo=1e9,hi=-1e9,miss=0,off=0,maxOff=0;
    for(const sx of [-1,1]){const ixs=[];for(let ix=0;ix<WV.NX;ix++){const xc=WV.X0+(ix+0.5)*WV.R;if(sx*xc>=XA&&sx*xc<=XB)ixs.push(ix);}
      const nx=ixs.length,nz=iz1-iz0+1,h=new Float32Array(nx*nz).fill(NaN),known=new Uint8Array(nx*nz);
      for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const x=WV.X0+(ixs[i]+0.5)*WV.R,z=WV.Z0+(iz0+j+0.5)*WV.R,vt=WV.top(x,z);if(vt===null)continue;
        const y=real(x,z);known[j*nx+i]=1; // 1 = a wing column; h stays NaN when the ray misses (filled from the neighbours below)
        if(y===null){miss++;continue;}
        const d=vt-y;if(d<-0.05||d>0.6){off++;maxOff=Math.max(maxOff,Math.abs(d));} // the voxel top and the real top should agree within a column's height (or a bit more on a slope)
        h[j*nx+i]=y;}
      // columns whose ray missed: mean of the neighbours that hit, else the voxel top minus 0.1
      for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){if(!known[j*nx+i]||!Number.isNaN(h[j*nx+i]))continue;let s=0,n=0;
        for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){const a=i+di,b=j+dj;if(a<0||b<0||a>=nx||b>=nz)continue;const v=h[b*nx+a];if(!Number.isNaN(v)&&!(di===0&&dj===0)){s+=v;n++;}}
        h[j*nx+i]=n?s/n:WV.top(WV.X0+(ixs[i]+0.5)*WV.R,WV.Z0+(iz0+j+0.5)*WV.R)-0.1;}
      for(let k=0;k<h.length;k++)if(known[k]){lo=Math.min(lo,h[k]);hi=Math.max(hi,h[k]);}
      raw.push({sx,ixs,iz0,nx,nz,h,known});}
    Q=Math.max(0.005,Math.ceil((hi-lo+0.02)/254/0.0005)*0.0005);Y0=Math.floor((lo-Q)/0.01)*0.01;
    tiles=raw.map(r=>{const d=new Uint8Array(r.nx*r.nz);for(let k=0;k<d.length;k++)if(r.known[k])d[k]=Math.max(1,Math.min(255,Math.round((r.h[k]-Y0)/Q)));
      return {x0:+(WV.X0+(r.ixs[0]+0.5)*WV.R).toFixed(3),z0:+(WV.Z0+(r.iz0+0.5)*WV.R).toFixed(3),nx:r.nx,nz:r.nz,d};});
    console.log(`columns: ray misses ${miss}, voxel top vs real top out of [-5 cm, +60 cm]: ${off} (max ${(maxOff*100).toFixed(0)} cm)`);
    console.log(`heights ${lo.toFixed(2)} .. ${hi.toFixed(2)} m, Q ${Q}, Y0 ${Y0}, tiles`,tiles.map(t=>`${t.nx}x${t.nz}@(${t.x0},${t.z0})`).join(' '));
    const b64=d=>Buffer.from(d).toString('base64');
    blockSrc=`${BEGIN}\n// generated by tools/wing-table/make_wing_table.cjs from ship.glb (do not edit by hand): a node per 0.2 m column of WV, x0/z0 = centre of the first node, Y0 + Q * value metres, 0 = no wing\n`+
      `const WT={S:${WV.R},Y0:${+Y0.toFixed(4)},Q:${+Q.toFixed(4)},tiles:[${tiles.map(t=>`{x0:${t.x0},z0:${t.z0},nx:${t.nx},nz:${t.nz},d:Uint8Array.from(atob("${b64(t.d)}"),c=>c.charCodeAt(0))}`).join(',')}]};\n${END}`;
    for(const t of tiles)t.d=Uint8Array.from(t.d);
  }
  // ---- how well does the table (bilinear, as the game reads it) reproduce the real surface, against what wingTop() gives today
  const lookup=(x,z)=>{const vt=WV.top(x,z);if(vt===null)return null;
    for(const T of tiles){const fx=(x-T.x0)/WV.R,fz=(z-T.z0)/WV.R;if(fx<-0.5||fz<-0.5||fx>T.nx-0.5||fz>T.nz-0.5)continue;
      const cx=Math.min(T.nx-1,Math.max(0,fx)),cz=Math.min(T.nz-1,Math.max(0,fz));let i=Math.floor(cx),j=Math.floor(cz);if(i>=T.nx-1)i=T.nx-2;if(j>=T.nz-1)j=T.nz-2;
      const u=cx-i,v=cz-j,o=j*T.nx+i,w=[(1-u)*(1-v),u*(1-v),(1-u)*v,u*v],q=[T.d[o],T.d[o+1],T.d[o+T.nx],T.d[o+T.nx+1]];let sw=0,sh=0;
      for(let k=0;k<4;k++)if(q[k]){sw+=w[k];sh+=w[k]*q[k];}if(sw>1e-6)return Y0+Q*sh/sw;break;}
    return vt-0.1;};
  let s=12345;const rnd=()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};
  const stat=(name,xa,xb)=>{const e=[],ev=[];let n=0;for(let k=0;k<20000;k++){const sx=rnd()<0.5?-1:1,x=sx*(xa+rnd()*(xb-xa)),z=WV.Z0+rnd()*WV.NZ*WV.R,vt=WV.top(x,z);if(vt===null)continue;const r=real(x,z);if(r===null)continue;
      n++;e.push(lookup(x,z)-r);ev.push(vt-r);}
    const abs=a=>a.map(Math.abs).sort((p,q)=>p-q),ae=abs(e),av=abs(ev),mean=a=>a.reduce((p,q)=>p+q,0)/a.length,cm=v=>(v*100).toFixed(1);
    console.log(`${name}: ${n} points | table: mean abs ${cm(mean(ae))} cm, bias ${cm(mean(e))} cm, p95 ${cm(ae[Math.floor(n*0.95)])} cm, max ${cm(ae[n-1])} cm, below the real surface (>2 cm) ${(e.filter(v=>v<-0.02).length/n*100).toFixed(1)} % | wingTop(): mean abs ${cm(mean(av))} cm, bias ${cm(mean(ev))} cm, p95 ${cm(av[Math.floor(n*0.95)])} cm, max ${cm(av[n-1])} cm`);
    return {mean:mean(ae),bias:mean(e),max:ae[n-1]};};
  stat('spiders walk  (|x| 4.4 .. 7.3)',4.4,7.3);
  const wide=stat('feet reach    (|x| 3.2 .. 8.5)',3.2,8.5);
  {const B=[];for(let k=0;k<20000;k++){const sx=rnd()<0.5?-1:1,ax=3+rnd()*5.6,x=sx*ax,z=WV.Z0+rnd()*WV.NZ*WV.R;if(WV.top(x,z)===null)continue;const r=real(x,z);if(r===null)continue;const b=Math.floor((ax-3)/0.6);
      (B[b]||(B[b]={n:0,sum:0,big:0,low:0}));B[b].n++;const e=lookup(x,z)-r;B[b].sum+=Math.abs(e);if(Math.abs(e)>0.1)B[b].big++;if(e<-0.05)B[b].low++;}
    console.log('by |x| (mean abs cm / share >10 cm / share lower than the real surface by >5 cm):',B.map((v,i)=>v?`${(3+i*0.6).toFixed(1)}: ${(v.sum/v.n*100).toFixed(1)}/${(v.big/v.n*100).toFixed(1)}%/${(v.low/v.n*100).toFixed(1)}%`:'').filter(Boolean).join(' | '));}
  if(wide.mean>0.015||Math.abs(wide.bias)>0.01){console.error('the table does not follow the real wing well enough (mean abs > 1.5 cm or bias > 1 cm)');process.exit(1);}
  if(!CHECK_ONLY){let src=fs.readFileSync(OUT,'utf8');const i=src.indexOf(BEGIN),j=src.indexOf(END);if(i<0||j<0)throw new Error('table markers not found in '+OUT);
    src=src.slice(0,i)+blockSrc+src.slice(j+END.length);fs.writeFileSync(OUT,src);console.log('written',path.relative(ROOT,OUT),(blockSrc.length/1024).toFixed(1)+' KB of table');}
})().catch(e=>{console.error('FAIL',e);process.exit(1);});
