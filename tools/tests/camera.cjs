// Camera (v72): the third-person follow camera must never end up inside the ship or a rock (and never right up against a surface).
// The check is INDEPENDENT of the game's own collision (camSolid/hullAB/wingAt/rockAt): it reads the real triangles of the loaded ship.glb
// (every mesh under the ship root, world space) and of the rock meshes, and measures against those:
//   wall  : the segment astronaut head (P.pos + 0.5 up) -> camera crosses ship/rock triangles (the view is blocked or the camera is inside; hits within 15 cm of the head are ignored)
//   near  : the camera is closer than 12 cm (near12) / 5 cm (near05) to some triangle (the near plane is 5 cm: it slices the surface)
//   arm   : camera distance to the head, and arm/wanted (how far the spring arm had to come in)
// A triangle grid (1 m cells) gives exact point-triangle distances and Moller-Trumbore segment hits; a few random segments are cross-checked against THREE.Raycaster.
// Cases: (1) static: stratified astronaut spots all round the ship (nose, tail, hull top/belly/side, pylons, the gap between hull and nacelle,
// nacelle top/under/side) and by rocks, each with 16 camera yaw/pitch settings, settled 1.1 s; (2) orbit: camera turned 360 deg at 90 deg/s, three pitches, 60 fps;
// (3) flights: the astronaut skims the surface at 1 m for 6 s (60 fps) while the camera turns (spin / sway / behind), measuring per frame the camera jump
// relative to the head (cm) and the arm-length reversals (jitter). Spiders are held off, rocks are frozen (worldV = 0).
// Run on dist-test:   tools/run-test.sh dist-test tools/tests/camera.cjs        (PC 1280x720, then phone 844x390)
//   HEADS_ONLY=pc|phone · HEADS_TAG=base|new (file names) · HEADS_PER=<spots per group, default 10> · HEADS_ROCKS=<rock spots, default 20> · HEADS_COMBOS=<yaw/pitch settings per spot, default 16>
//   HEADS_ORBITS=<n, default 10> · HEADS_FLIGHTS=<n, default 18> · HEADS_SEED=<n> · HEADS_NOORBIT=1 · HEADS_NOFLIGHT=1 · HEADS_NOSTATIC=1
//   HEADS_SHOTS=1 : only the screenshot cases (PC 1280x720): tools/tests/out/cam_<case>_<tag>.png (tag default 'after')
//   HEADS_BASE=1  : do not fail (used on the old code, which has no camera collision)
//   HEADS_CASE='{"name":"x","pos":[x,y,z],"yaw":a,"pitch":b}' with HEADS_SHOTS=1 : one screenshot at that spot · HEADS_COVER=1 : only how well camSolid covers the real surface · HEADS_TRACE=1 / HEADS_FULLTRACE=1 : frames around the biggest camera pops / every flight frame (in the json)
// Output: tools/tests/out/camera_<pc|phone>_<tag>.json. Exit code 1 if on any sample the view is blocked or the camera is nearer than 5 cm to a surface, or the page errors.
const {chromium}=require('playwright');
const fs=require('fs');
const {BASE,ARGS,OUT,shot}=require('./lib.cjs');
const ONLY=process.env.HEADS_ONLY||'',TAG=process.env.HEADS_TAG||'new',SHOTS=!!process.env.HEADS_SHOTS,ISBASE=!!process.env.HEADS_BASE;
const PER=+(process.env.HEADS_PER||10),NROCK=+(process.env.HEADS_ROCKS||20),NCOMBO=+(process.env.HEADS_COMBOS||16),NORB=+(process.env.HEADS_ORBITS||10),NFLY=+(process.env.HEADS_FLIGHTS||18),SEED=+(process.env.HEADS_SEED||7);

// ---------------------------------------------------------------- runs in the page
function pageLib(SEEDV){
  const T=__THREE,H=__heads,P=H.P,CAMERA=__camera,IS_TOUCH=matchMedia('(pointer:coarse)').matches;
  const rngf=s=>()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
  // ---- the ship's triangles (world space, once)
  let root=__scene.getObjectByName('SM_HEADS_Ship_Body')||__scene.getObjectByName('SM_HEADS_Ship_TailFan_Rotor');while(root&&root.parent&&root.parent!==__scene)root=root.parent;
  root.updateMatrixWorld(true);
  const tr=[];{const a=new T.Vector3();root.traverse(o=>{if(!o.isMesh||!o.geometry)return;const g=o.geometry,pos=g.attributes.position,ix=g.index,n=ix?ix.count:pos.count;
    for(let i=0;i<n;i+=3)for(let k=0;k<3;k++){a.fromBufferAttribute(pos,ix?ix.getX(i+k):i+k).applyMatrix4(o.matrixWorld);tr.push(a.x,a.y,a.z);}});}
  const S=Float32Array.from(tr),NT=S.length/9;tr.length=0;
  const MR=[];{let c=0;root.traverse(o=>{if(!o.isMesh||!o.geometry)return;const g=o.geometry,n=(g.index?g.index.count:g.attributes.position.count)/3;MR.push([c,c+n,o.name]);c+=n;});}
  const meshOf=t=>{for(const r of MR)if(t>=r[0]&&t<r[1])return r[2];return 'rock';};
  const C=1.0,mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
  for(let i=0;i<S.length;i+=3)for(let k=0;k<3;k++){mn[k]=Math.min(mn[k],S[i+k]);mx[k]=Math.max(mx[k],S[i+k]);}
  for(let k=0;k<3;k++)mn[k]-=0.05;
  const G=[Math.ceil((mx[0]-mn[0])/C)+1,Math.ceil((mx[1]-mn[1])/C)+1,Math.ceil((mx[2]-mn[2])/C)+1],NC=G[0]*G[1]*G[2];
  const cstart=new Int32Array(NC+1),R6=new Int32Array(6);
  const triCells=t=>{const o=t*9;let x0=1e9,y0=1e9,z0=1e9,x1=-1e9,y1=-1e9,z1=-1e9;for(let k=0;k<3;k++){const x=S[o+k*3],y=S[o+k*3+1],z=S[o+k*3+2];if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;if(z<z0)z0=z;if(z>z1)z1=z;}
    R6[0]=Math.floor((x0-mn[0])/C);R6[1]=Math.floor((y0-mn[1])/C);R6[2]=Math.floor((z0-mn[2])/C);R6[3]=Math.floor((x1-mn[0])/C);R6[4]=Math.floor((y1-mn[1])/C);R6[5]=Math.floor((z1-mn[2])/C);};
  for(let t=0;t<NT;t++){triCells(t);for(let z=R6[2];z<=R6[5];z++)for(let y=R6[1];y<=R6[4];y++)for(let x=R6[0];x<=R6[3];x++)cstart[(z*G[1]+y)*G[0]+x+1]++;}
  for(let i=0;i<NC;i++)cstart[i+1]+=cstart[i];
  const cids=new Int32Array(cstart[NC]),cfill=cstart.slice(0,NC);
  for(let t=0;t<NT;t++){triCells(t);for(let z=R6[2];z<=R6[5];z++)for(let y=R6[1];y<=R6[4];y++)for(let x=R6[0];x<=R6[3];x++)cids[cfill[(z*G[1]+y)*G[0]+x]++]=t;}
  const stamp=new Int32Array(NT);let stampN=0;
  // ---- rocks (local triangles; the meshes only translate)
  const RK=H.ROCKS.map(R=>{const g=R.mesh.geometry,pos=g.attributes.position,ix=g.index,n=ix?ix.count:pos.count,a=[];
    for(let i=0;i<n;i++){const v=ix?ix.getX(i):i;a.push(pos.getX(v),pos.getY(v),pos.getZ(v));}return {R,A:Float32Array.from(a),nt:n/3};});
  const rockLive=k=>RK[k].R.mesh.visible&&RK[k].R.fade>0.5;
  // ---- point-triangle
  let QX=0,QY=0,QZ=0;
  function ptTri(px,py,pz,A,o){const ax=A[o],ay=A[o+1],az=A[o+2],bx=A[o+3],by=A[o+4],bz=A[o+5],cx=A[o+6],cy=A[o+7],cz=A[o+8];
    const abx=bx-ax,aby=by-ay,abz=bz-az,acx=cx-ax,acy=cy-ay,acz=cz-az,apx=px-ax,apy=py-ay,apz=pz-az;
    const d1=abx*apx+aby*apy+abz*apz,d2=acx*apx+acy*apy+acz*apz;
    if(d1<=0&&d2<=0){QX=ax;QY=ay;QZ=az;return apx*apx+apy*apy+apz*apz;}
    const bpx=px-bx,bpy=py-by,bpz=pz-bz,d3=abx*bpx+aby*bpy+abz*bpz,d4=acx*bpx+acy*bpy+acz*bpz;
    if(d3>=0&&d4<=d3){QX=bx;QY=by;QZ=bz;return bpx*bpx+bpy*bpy+bpz*bpz;}
    const vc=d1*d4-d3*d2;
    if(vc<=0&&d1>=0&&d3<=0){const v=d1/(d1-d3);QX=ax+abx*v;QY=ay+aby*v;QZ=az+abz*v;}
    else{const cpx=px-cx,cpy=py-cy,cpz=pz-cz,d5=abx*cpx+aby*cpy+abz*cpz,d6=acx*cpx+acy*cpy+acz*cpz;
      if(d6>=0&&d5<=d6){QX=cx;QY=cy;QZ=cz;return cpx*cpx+cpy*cpy+cpz*cpz;}
      const vb=d5*d2-d1*d6;
      if(vb<=0&&d2>=0&&d6<=0){const w=d2/(d2-d6);QX=ax+acx*w;QY=ay+acy*w;QZ=az+acz*w;}
      else{const va=d3*d6-d5*d4;
        if(va<=0&&(d4-d3)>=0&&(d5-d6)>=0){const w=(d4-d3)/((d4-d3)+(d5-d6));QX=bx+(cx-bx)*w;QY=by+(cy-by)*w;QZ=bz+(cz-bz)*w;}
        else{const den=1/(va+vb+vc),v=vb*den,w=vc*den;QX=ax+abx*v+acx*w;QY=ay+aby*v+acy*w;QZ=az+abz*v+acz*w;}}}
    const dx=px-QX,dy=py-QY,dz=pz-QZ;return dx*dx+dy*dy+dz*dz;}
  // nearest surface within r of p: {d (9 when none), q}
  const NR={d:9,qx:0,qy:0,qz:0};
  function near(px,py,pz,r){let best=r*r,found=false,bx=0,by=0,bz=0;stampN++;
    const x0=Math.max(0,Math.floor((px-r-mn[0])/C)),y0=Math.max(0,Math.floor((py-r-mn[1])/C)),z0=Math.max(0,Math.floor((pz-r-mn[2])/C)),
      x1=Math.min(G[0]-1,Math.floor((px+r-mn[0])/C)),y1=Math.min(G[1]-1,Math.floor((py+r-mn[1])/C)),z1=Math.min(G[2]-1,Math.floor((pz+r-mn[2])/C));
    for(let z=z0;z<=z1;z++)for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const c=(z*G[1]+y)*G[0]+x;
      for(let i=cstart[c];i<cstart[c+1];i++){const t=cids[i];if(stamp[t]===stampN)continue;stamp[t]=stampN;const d2=ptTri(px,py,pz,S,t*9);if(d2<best){best=d2;found=true;bx=QX;by=QY;bz=QZ;}}}
    for(let k=0;k<RK.length;k++){if(!rockLive(k))continue;const m=RK[k].R.mesh.position,cx=px-m.x,cy=py-m.y,cz=pz-m.z;
      if(Math.hypot(cx,cy,cz)>RK[k].R.rmax+r)continue;const A=RK[k].A;
      for(let t=0;t<RK[k].nt;t++){const d2=ptTri(cx,cy,cz,A,t*9);if(d2<best){best=d2;found=true;bx=QX+m.x;by=QY+m.y;bz=QZ+m.z;}}}
    NR.d=found?Math.sqrt(best):9;NR.qx=bx;NR.qy=by;NR.qz=bz;return NR;}
  // ---- segment-triangle (double sided)
  let HT=0,HTRI=-1;
  function mt(ox,oy,oz,dx,dy,dz,A,o){const ax=A[o],ay=A[o+1],az=A[o+2],e1x=A[o+3]-ax,e1y=A[o+4]-ay,e1z=A[o+5]-az,e2x=A[o+6]-ax,e2y=A[o+7]-ay,e2z=A[o+8]-az;
    const px=dy*e2z-dz*e2y,py=dz*e2x-dx*e2z,pz=dx*e2y-dy*e2x,det=e1x*px+e1y*py+e1z*pz;if(det>-1e-12&&det<1e-12)return false;const inv=1/det;
    const sx=ox-ax,sy=oy-ay,sz=oz-az,u=(sx*px+sy*py+sz*pz)*inv;if(u<-1e-6||u>1+1e-6)return false;
    const qx=sy*e1z-sz*e1y,qy=sz*e1x-sx*e1z,qz=sx*e1y-sy*e1x,v=(dx*qx+dy*qy+dz*qz)*inv;if(v<-1e-6||u+v>1+1e-6)return false;
    HT=(e2x*qx+e2y*qy+e2z*qz)*inv;return true;}
  // first hit distance along a->b that is >= skip (or -1). any=true: stops at the first one found
  function segHit(ax,ay,az,bx,by,bz,skip,any){const dx=bx-ax,dy=by-ay,dz=bz-az,L=Math.hypot(dx,dy,dz);if(L<1e-9)return -1;const ux=dx/L,uy=dy/L,uz=dz/L;let best=1e9;
    // ship: walk the grid cells (Amanatides-Woo)
    {const o=[ax,ay,az],d=[dx,dy,dz];let t0=0,t1=1,ok=true;
      for(let k=0;k<3;k++){const lo=mn[k],hi=mn[k]+G[k]*C;if(Math.abs(d[k])<1e-12){if(o[k]<lo||o[k]>hi){ok=false;break;}}else{let ta=(lo-o[k])/d[k],tb=(hi-o[k])/d[k];if(ta>tb){const q=ta;ta=tb;tb=q;}t0=Math.max(t0,ta);t1=Math.min(t1,tb);if(t0>t1){ok=false;break;}}}
      if(ok){const ci=[0,0,0],st=[0,0,0],tM=[0,0,0],tD=[0,0,0];
        for(let k=0;k<3;k++){const p=o[k]+d[k]*(t0+1e-9);ci[k]=Math.max(0,Math.min(G[k]-1,Math.floor((p-mn[k])/C)));
          if(d[k]>0){st[k]=1;tM[k]=(mn[k]+(ci[k]+1)*C-o[k])/d[k];tD[k]=C/d[k];}else if(d[k]<0){st[k]=-1;tM[k]=(mn[k]+ci[k]*C-o[k])/d[k];tD[k]=-C/d[k];}else{st[k]=0;tM[k]=1e9;tD[k]=1e9;}}
        stampN++;
        for(;;){const c=(ci[2]*G[1]+ci[1])*G[0]+ci[0];
          for(let i=cstart[c];i<cstart[c+1];i++){const t=cids[i];if(stamp[t]===stampN)continue;stamp[t]=stampN;
            if(mt(ax,ay,az,ux,uy,uz,S,t*9)&&HT>=skip&&HT<=L&&HT<best){best=HT;HTRI=t;if(any)return best;}}
          const k=tM[0]<tM[1]?(tM[0]<tM[2]?0:2):(tM[1]<tM[2]?1:2);
          if(tM[k]*1>t1||best<=tM[k]*L)break;ci[k]+=st[k];tM[k]+=tD[k];if(ci[k]<0||ci[k]>=G[k])break;}}}
    // rocks
    for(let k=0;k<RK.length;k++){if(!rockLive(k))continue;const m=RK[k].R.mesh.position,ox=ax-m.x,oy=ay-m.y,oz=az-m.z;
      const tc=Math.max(0,Math.min(L,-(ox*ux+oy*uy+oz*uz))),qx=ox+ux*tc,qy=oy+uy*tc,qz=oz+uz*tc;if(Math.hypot(qx,qy,qz)>RK[k].R.rmax)continue;
      for(let t=0;t<RK[k].nt;t++)if(mt(ox,oy,oz,ux,uy,uz,RK[k].A,t*9)&&HT>=skip&&HT<=L&&HT<best){best=HT;HTRI=-2;if(any)return best;}}
    return best<1e8?best:-1;}
  const AX=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
  const outside=(x,y,z)=>{for(const a of AX)if(segHit(x,y,z,x+a[0]*70,y+a[1]*70,z+a[2]*70,0,true)<0)return true;return false;};
  // ---- cross-check against THREE.Raycaster (double sided, ship + rocks): hit / no hit and distance
  function crossCheck(n){const rc=new T.Raycaster(),rnd=rngf(SEEDV+99),mats=[],objs=[root,...RK.filter((_,k)=>rockLive(k)).map(r=>r.R.mesh)];let bad=0,hits=0,maxErr=0;
    for(const o of objs)o.traverse(m=>{if(m.isMesh&&m.material){mats.push([m.material,m.material.side]);m.material.side=T.DoubleSide;}});
    root.updateMatrixWorld(true);for(const r of RK)r.R.mesh.updateMatrixWorld(true);
    for(let i=0;i<n;i++){let a,b;do{a=new T.Vector3((rnd()-0.5)*40,(rnd()-0.5)*24,(rnd()-0.5)*50);}while(false);b=new T.Vector3((rnd()-0.5)*40,(rnd()-0.5)*24,(rnd()-0.5)*50);
      const d=b.clone().sub(a),L=d.length();d.normalize();rc.set(a,d);rc.near=0;rc.far=L;const hit=rc.intersectObjects(objs,true);const mine=segHit(a.x,a.y,a.z,b.x,b.y,b.z,0,false);
      const r1=hit.length?hit[0].distance:-1;if(r1>=0)hits++;if((r1<0)!==(mine<0)||(r1>=0&&Math.abs(r1-mine)>0.002)){bad++;}else if(r1>=0)maxErr=Math.max(maxErr,Math.abs(r1-mine));}
    for(const [m,s] of mats)m.side=s;return {n,hits,bad,maxErr};}
  // ---- area-weighted surface sample
  const cum=new Float64Array(NT);let acc=0;for(let t=0;t<NT;t++){const o=t*9,e1x=S[o+3]-S[o],e1y=S[o+4]-S[o+1],e1z=S[o+5]-S[o+2],e2x=S[o+6]-S[o],e2y=S[o+7]-S[o+1],e2z=S[o+8]-S[o+2];
    acc+=0.5*Math.hypot(e1y*e2z-e1z*e2y,e1z*e2x-e1x*e2z,e1x*e2y-e1y*e2x);cum[t]=acc;}
  function triNormal(A,o,out){const e1x=A[o+3]-A[o],e1y=A[o+4]-A[o+1],e1z=A[o+5]-A[o+2],e2x=A[o+6]-A[o],e2y=A[o+7]-A[o+1],e2z=A[o+8]-A[o+2];
    let nx=e1y*e2z-e1z*e2y,ny=e1z*e2x-e1x*e2z,nz=e1x*e2y-e1y*e2x;const l=Math.hypot(nx,ny,nz)||1;out[0]=nx/l;out[1]=ny/l;out[2]=nz/l;}
  function surfPt(A,o,rnd,out){let u=rnd(),v=rnd();if(u+v>1){u=1-u;v=1-v;}out[0]=A[o]+(A[o+3]-A[o])*u+(A[o+6]-A[o])*v;out[1]=A[o+1]+(A[o+4]-A[o+1])*u+(A[o+7]-A[o+1])*v;out[2]=A[o+2]+(A[o+5]-A[o+2])*u+(A[o+8]-A[o+2])*v;}
  const GROUPS=['nose','tail','hull_top','hull_belly','hull_side','pylon','gap','nac_top','nac_under','nac_side'];
  function label(p,n){const ax=Math.abs(p[0]);
    if(p[2]>14.5)return 'nose';if(p[2]<-14.5&&ax<6)return 'tail';
    if(ax>4.7&&ax<6.6&&p[2]<-2&&p[2]>-8.2&&Math.abs(n[1])<0.6)return 'pylon';
    if(ax>6.0){if(n[1]>0.5)return 'nac_top';if(n[1]<-0.5)return 'nac_under';return n[0]*Math.sign(p[0])<-0.3?'gap':'nac_side';}
    if(ax>4.65)return null;
    if(n[1]>0.5)return 'hull_top';if(n[1]<-0.5)return 'hull_belly';return 'hull_side';}
  const MINCLEAR=0.55;
  function genSpots(perGroup,nRock,seed){const rnd=rngf(seed),spots=[],cnt={};for(const g of GROUPS)cnt[g]=0;const nm=[0,0,0],p=[0,0,0];let tries=0;
    for(;;){if(GROUPS.every(g=>cnt[g]>=perGroup)||tries++>60000)break;
      const u=rnd()*acc;let lo=0,hi=NT-1;while(lo<hi){const m=(lo+hi)>>1;if(cum[m]<u)lo=m+1;else hi=m;}
      surfPt(S,lo*9,rnd,p);triNormal(S,lo*9,nm);const dd=0.7+rnd()*0.9,sg0=rnd()<0.5?1:-1;
      for(const sg of [sg0,-sg0]){const n2=[nm[0]*sg,nm[1]*sg,nm[2]*sg],g=label(p,n2);if(!g||cnt[g]>=perGroup)continue;
        const x=p[0]+n2[0]*dd,y=p[1]+n2[1]*dd,z=p[2]+n2[2]*dd;if(Math.abs(x)>14||Math.abs(y)>12||Math.abs(z)>28)continue;
        if(near(x,y,z,MINCLEAR+0.01).d<MINCLEAR)continue;if(!outside(x,y,z))continue;
        cnt[g]++;spots.push({g,pos:[x,y,z],n:n2,off:dd});break;}}
    // rocks: the visible ones near the ship, each sampled in turn
    const rk=RK.map((_,k)=>k).filter(k=>rockLive(k)&&RK[k].R.mesh.position.length()<45);let rc=0;tries=0;
    while(rc<nRock&&rk.length&&tries++<4000){const k=rk[rc%rk.length],r=RK[k],t=Math.floor(rnd()*r.nt),m=r.R.mesh.position;surfPt(r.A,t*9,rnd,p);triNormal(r.A,t*9,nm);
      const wp=[p[0]+m.x,p[1]+m.y,p[2]+m.z];if(nm[0]*p[0]+nm[1]*p[1]+nm[2]*p[2]<0){nm[0]=-nm[0];nm[1]=-nm[1];nm[2]=-nm[2];} // outward from the rock centre
      const dd=0.7+rnd()*0.9,x=wp[0]+nm[0]*dd,y=wp[1]+nm[1]*dd,z=wp[2]+nm[2]*dd;
      if(near(x,y,z,MINCLEAR+0.01).d<MINCLEAR||!outside(x,y,z))continue;spots.push({g:'rock',pos:[x,y,z],n:[nm[0],nm[1],nm[2]],off:dd});rc++;}
    return spots;}
  // ---- game control
  // no spiders, and the round never ends (a huge boss timer keeps the 'round cleared' branch shut: no break, no next round, no 'showcase' swing of the camera to the front)
  const hold=()=>{window.__noSpawn=1;__T.showcase=0;__T.toSpawn=3;H.WB.bossT=1e9;H.WB.incT=0;for(const s of [...H.spiders])H.killSpider(s);P.inv=1e9;P.hp=100;};
  function prime(){let n=0;while(n<600){hold();__step(5,0.05);n+=5;if(!__T.inBreak&&Math.abs(__T.camOrbit)<0.05&&n>=20)break;}hold();__step(5,0.05);return {frames:n+5,inBreak:__T.inBreak,orbit:+__T.camOrbit.toFixed(3),state:__T.state,wave:__T.wave};}
  const stepN=(n,dt)=>{hold();__step(n,dt);};
  function wantArm(){const yaw=P.yaw,pit=P.pitch,cp=Math.cos(pit),fx=-Math.sin(yaw)*cp,fy=Math.sin(pit),fz=-Math.cos(yaw)*cp,rx=Math.cos(yaw),rz=-Math.sin(yaw),sh=IS_TOUCH?0.8:0.98,dd=IS_TOUCH?2.55:3.3;
    return Math.hypot(rx*sh-fx*dd,-fy*dd,rz*sh-fz*dd);}
  function meas(){CAMERA.updateMatrixWorld();const hx=P.pos.x,hy=P.pos.y+0.5,hz=P.pos.z,c=CAMERA.position;
    const arm=Math.hypot(c.x-hx,c.y-hy,c.z-hz),hit=segHit(hx,hy,hz,c.x,c.y,c.z,0.15,false),nr=near(c.x,c.y,c.z,0.4);
    const o={arm,want:wantArm(),hit,md:nr.d};if(hit>=0){const dx=(c.x-hx)/arm,dy=(c.y-hy)/arm,dz=(c.z-hz)/arm;o.hp=[hx+dx*hit,hy+dy*hit,hz+dz*hit].map(v=>+v.toFixed(2));o.hm=HTRI>=0?meshOf(HTRI):'rock';}
    if(nr.d<0.12){o.np=[nr.qx,nr.qy,nr.qz].map(v=>+v.toFixed(2));}
    return o;}
  const rec=(m)=>({arm:+m.arm.toFixed(3),r:+(m.arm/m.want).toFixed(3),wall:m.hit>=0?1:0,hitAt:m.hit>=0?+m.hit.toFixed(2):null,md:+m.md.toFixed(3),hp:m.hp,hm:m.hm,np:m.np,cam:CAMERA.position.toArray().map(v=>+v.toFixed(2)),head:[P.pos.x,P.pos.y+0.5,P.pos.z].map(v=>+v.toFixed(2))});
  function place(pos,yaw,pitch){P.pos.set(pos[0],pos[1],pos[2]);P.vel.set(0,0,0);P.yaw=yaw;P.pitch=pitch;}
  let SPOTS=[];
  // static sweep over the camera settings of one spot
  function runSpot(i,ncombo){const sp=SPOTS[i],rnd=rngf(SEEDV*131+i),y0=rnd()*Math.PI*2,out=[];
    const combos=[];for(let k=0;k<8;k++)combos.push([y0+k*Math.PI/4,0.1]);for(let k=0;k<4;k++)combos.push([y0+Math.PI/8+k*Math.PI/2,-0.55]);for(let k=0;k<4;k++)combos.push([y0+3*Math.PI/8+k*Math.PI/2,0.6]);
    // fewer settings: spread them over the list
    const sel=ncombo>=combos.length?combos:combos.filter((_,k)=>Math.floor(k*ncombo/combos.length)!==Math.floor((k+1)*ncombo/combos.length)||k===combos.length-1).slice(0,ncombo);
    place(sp.pos,sel[0][0],sel[0][1]);stepN(8,0.05);
    const pos0=P.pos.clone();const clear=near(P.pos.x,P.pos.y+0.25,P.pos.z,1.5).d,ins=!outside(P.pos.x,P.pos.y,P.pos.z)||!outside(P.pos.x,P.pos.y+0.5,P.pos.z);
    if(ins||clear<0.3)return {i,g:sp.g,invalid:1,clear,ins:ins?1:0,moved:+P.pos.distanceTo(new T.Vector3(...sp.pos)).toFixed(2)};
    for(const [yw,pt] of sel){P.yaw=yw;P.pitch=pt;stepN(22,0.05);const m=meas();out.push({yaw:+yw.toFixed(2),pitch:pt,...rec(m)});}
    return {i,g:sp.g,pos:[+pos0.x.toFixed(2),+pos0.y.toFixed(2),+pos0.z.toFixed(2)],clear:+clear.toFixed(2),moved:+pos0.distanceTo(new T.Vector3(...sp.pos)).toFixed(2),s:out};}
  // 360 deg orbit of the camera at 60 fps, three pitches
  function runOrbit(i){const sp=SPOTS[i],out={i,g:sp.g,n:0,wall:0,near12:0,near05:0,minMd:9,minArm:9,jumpMax:0,rev:0,pitches:[]};
    place(sp.pos,0,0.1);stepN(10,0.05);const ins=!outside(P.pos.x,P.pos.y,P.pos.z)||!outside(P.pos.x,P.pos.y+0.5,P.pos.z)||near(P.pos.x,P.pos.y+0.25,P.pos.z,1.5).d<0.3;if(ins)return {i,g:sp.g,invalid:1};
    for(const pt of [0.1,-0.55,0.6]){P.pitch=pt;P.yaw=0;stepN(40,0.05);let prev=null,pa=null,ls=0;
      for(let f=0;f<240;f++){P.yaw=f*1.5*Math.PI/180;P.pitch=pt;stepN(1,1/60);const m=meas();out.n++;if(m.hit>=0)out.wall++;if(m.md<0.12)out.near12++;if(m.md<0.05)out.near05++;out.minMd=Math.min(out.minMd,m.md);out.minArm=Math.min(out.minArm,m.arm);
        const rel=[CAMERA.position.x-P.pos.x,CAMERA.position.y-P.pos.y-0.5,CAMERA.position.z-P.pos.z];if(prev)out.jumpMax=Math.max(out.jumpMax,Math.hypot(rel[0]-prev[0],rel[1]-prev[1],rel[2]-prev[2]));prev=rel;
        if(pa!==null){const d=m.arm-pa;if(Math.abs(d)>0.015){const s=Math.sign(d);if(ls&&s!==ls)out.rev++;ls=s;}}pa=m.arm;}}
    out.minMd=+out.minMd.toFixed(3);out.minArm=+out.minArm.toFixed(2);out.jumpMax=+(out.jumpMax*100).toFixed(1);return out;}
  // a flight along the surface at a fixed clearance, with the camera turning: mode 'spin' | 'sway' | 'behind'
  function runFlight(i,mode,seedF,trace){const rnd=rngf(seedF),sp=SPOTS[i%SPOTS.length],dc=0.85+rnd()*0.5,v=4+rnd()*3,frames=360,dt=1/60;
    const p=new T.Vector3(...sp.pos),dir=new T.Vector3(rnd()-0.5,rnd()-0.5,rnd()-0.5).normalize(),nrm=new T.Vector3(),q=new T.Vector3(),tmp=new T.Vector3();
    place(sp.pos,0,0.1);stepN(10,0.05);
    const o={i,g:sp.g,mode,n:0,wall:0,near12:0,near05:0,minMd:9,minArm:9,maxArm:0,jumpMax:0,j10:0,j25:0,j50:0,rev:0,rev3:0,popIn:0,shrink:0,grow:0,worst:null,invalid:0,sp:0,walls:[]};
    let omega=(rnd()<0.5?-1:1)*0.7,prev=null,pa=null,ls=0,ls3=0,yaw=rnd()*6.28,wasIn=0;const tr=[],cm=window.__cam&&window.__cam.CAM;let prevP=null;
    for(let f=-30;f<frames;f++){const t=Math.max(0,f)*dt; // (30 frames of warm-up first, not measured: the camera starts settled)
      const nr=near(p.x,p.y,p.z,3);let nn=false;if(nr.d<3){q.set(nr.qx,nr.qy,nr.qz);nrm.copy(p).sub(q);const l=nrm.length();if(l>1e-4){nrm.multiplyScalar(1/l);nn=true;}}
      if(nn){dir.addScaledVector(nrm,-dir.dot(nrm));if(dir.lengthSq()<1e-6)dir.crossVectors(nrm,tmp.set(0,1,0));dir.normalize();
        if(f%100===99)omega=-omega*(0.6+rnd()*0.8);const a=omega*dt;tmp.crossVectors(nrm,dir);dir.multiplyScalar(Math.cos(a)).addScaledVector(tmp,Math.sin(a)).normalize();}
      p.addScaledVector(dir,v*dt);
      if(nn){const n2=near(p.x,p.y,p.z,3);if(n2.d<dc){q.set(n2.qx,n2.qy,n2.qz);tmp.copy(p).sub(q);const l=tmp.length();if(l>1e-4){p.addScaledVector(tmp,Math.min(0.12,dc-n2.d)/l);}}}
      if(Math.abs(p.x)>30&&p.x*dir.x>0)dir.x=-dir.x;if(Math.abs(p.y)>22&&p.y*dir.y>0)dir.y=-dir.y;if(Math.abs(p.z)>45&&p.z*dir.z>0)dir.z=-dir.z; // keep to the neighbourhood of the ship
      if(mode==='spin')yaw+=70*Math.PI/180*dt;else if(mode==='sway')yaw=Math.atan2(-dir.x,-dir.z)+1.2*Math.sin(t*2.1);else yaw=Math.atan2(-dir.x,-dir.z);
      const pit=0.1+0.4*Math.sin(t*1.3);
      P.pos.copy(p);P.vel.set(0,0,0);P.yaw=yaw;P.pitch=pit;stepN(1,dt);
      if(f<0)continue;
      if(!outside(P.pos.x,P.pos.y,P.pos.z)){o.invalid++;continue;}
      const m=meas();o.n++;if(m.hit>=0){o.wall++;if(o.walls.length<3)o.walls.push({f,arm:+m.arm.toFixed(2),at:+m.hit.toFixed(2),hp:m.hp,hm:m.hm,cam:CAMERA.position.toArray().map(v=>+v.toFixed(2))});}if(m.md<0.12)o.near12++;if(m.md<0.05)o.near05++;o.minMd=Math.min(o.minMd,m.md);o.minArm=Math.min(o.minArm,m.arm);o.maxArm=Math.max(o.maxArm,m.arm);
      const rel=[CAMERA.position.x-P.pos.x,CAMERA.position.y-P.pos.y-0.5,CAMERA.position.z-P.pos.z];
      if(prev){const j=Math.hypot(rel[0]-prev[0],rel[1]-prev[1],rel[2]-prev[2]);if(j>o.jumpMax){o.jumpMax=j;o.worst={f,j:+(j*100).toFixed(1),arm:+m.arm.toFixed(2),want:+m.want.toFixed(2)};}if(j>0.10)o.j10++;if(j>0.25)o.j25++;if(j>0.5)o.j50++;}
      prev=rel;
      if(pa!==null){const d=m.arm-pa;if(Math.abs(d)>0.015){const s=Math.sign(d);if(ls&&s!==ls)o.rev++;ls=s;}if(Math.abs(d)>0.03){const s=Math.sign(d);if(ls3&&s!==ls3)o.rev3++;ls3=s;}if(d<-0.25)o.popIn++;o.shrink=Math.max(o.shrink,-d);o.grow=Math.max(o.grow,d);}
      pa=m.arm;if(cm)tr.push({f,arm:+m.arm.toFixed(2),S:+cm.S.toFixed(2),L:+cm.L.toFixed(2),v:+(P.pos.distanceTo(prevP||P.pos)/dt).toFixed(1),cam:CAMERA.position.toArray().map(x=>+x.toFixed(2)),head:[P.pos.x,P.pos.y+0.5,P.pos.z].map(x=>+x.toFixed(2)),yaw:+yaw.toFixed(2),pit:+pit.toFixed(2)});prevP=P.pos.clone();}
    if(trace&&tr.length){o.full=tr.map(t=>[t.f,t.arm,t.S,t.L,t.yaw,t.v]);}
    if(tr.length){let bi=0,bd=0;for(let i=1;i<tr.length;i++){const d=tr[i-1].arm-tr[i].arm;if(d>bd){bd=d;bi=i;}}o.trace=tr.slice(Math.max(0,bi-3),bi+3);}
    o.sp=0;o.shrink=+(o.shrink*100).toFixed(1);o.grow=+(o.grow*100).toFixed(1);o.minMd=+o.minMd.toFixed(3);o.minArm=+o.minArm.toFixed(2);o.maxArm=+o.maxArm.toFixed(2);o.jumpMax=+(o.jumpMax*100).toFixed(1);return o;}
  // cost of camArm per call (new code only): head/pivot/camera of real spots, 3 ms-scale timings averaged over many calls
  function costArm(){if(!window.__cam)return null;const {camArm,CAM}=window.__cam,hd=new T.Vector3(),pv=new T.Vector3(),cm=new T.Vector3(),res={};
    const run=(name,idxs)=>{const cases=[];for(const i of idxs){const sp=SPOTS[i];if(!sp)continue;for(let k=0;k<8;k++){const yw=k*Math.PI/4,pt=0.1,cp=Math.cos(pt),fx=-Math.sin(yw)*cp,fy=Math.sin(pt),fz=-Math.cos(yw)*cp,rx=Math.cos(yw),rz=-Math.sin(yw),dd=IS_TOUCH?2.55:3.3,sh=IS_TOUCH?0.8:0.98;
        hd.set(sp.pos[0],sp.pos[1]+0.5,sp.pos[2]);pv.set(sp.pos[0]+rx*sh,sp.pos[1]+0.5,sp.pos[2]+rz*sh);cm.set(pv.x-fx*dd,pv.y-fy*dd,pv.z-fz*dd);cases.push([hd.clone(),pv.clone(),cm.clone()]);}}
      for(let r=0;r<20;r++)for(const c of cases)camArm(c[0],c[1],c[2],1/60); // warm up
      const n=Math.max(1,Math.ceil(4000/cases.length));let t0=performance.now();for(let r=0;r<n;r++)for(const c of cases)camArm(c[0],c[1],c[2],1/60);const ms=(performance.now()-t0)/(n*cases.length);res[name]=+ms.toFixed(4);};
    const all=SPOTS.map((_,i)=>i),nearHull=all.filter(i=>SPOTS[i].g!=='rock');
    { // free space (nothing near): the common case
      const cases=[];for(let k=0;k<8;k++){const yw=k*Math.PI/4;hd.set(0,30,20);pv.set(Math.cos(yw)*0.98,30.5,20-Math.sin(yw)*0.98);cm.set(pv.x+Math.sin(yw)*3.3,30.5,pv.z+Math.cos(yw)*3.3);cases.push([hd.clone(),pv.clone(),cm.clone()]);}
      for(let r=0;r<20;r++)for(const c of cases)camArm(c[0],c[1],c[2],1/60);const n=500;let t0=performance.now();for(let r=0;r<n;r++)for(const c of cases)camArm(c[0],c[1],c[2],1/60);res.free_space_ms_per_call=+((performance.now()-t0)/(n*cases.length)).toFixed(4);}
    run('near_hull_ms_per_call',nearHull);run('near_rock_ms_per_call',all.filter(i=>SPOTS[i].g==='rock'));return res;}
  // how well does the game's own solid (camSolid) cover the real mesh? points just outside the real surface (0..0.3 m, independent triangles) that camSolid(p,0.3) calls free = holes
  function coverage(n,pad){if(!window.__cam)return null;const {camSolid}=window.__cam,rnd=rngf(SEEDV+5),v=new T.Vector3(),nm=[0,0,0],p=[0,0,0],byG={};let miss=0,tot=0,fp=0,fpTot=0;const missPts=[];
    while(tot<n){const u=rnd()*acc;let lo=0,hi=NT-1;while(lo<hi){const m=(lo+hi)>>1;if(cum[m]<u)lo=m+1;else hi=m;}
      surfPt(S,lo*9,rnd,p);triNormal(S,lo*9,nm);const sg=rnd()<0.5?1:-1,dd=rnd()*0.3,q=[p[0]+nm[0]*sg*dd,p[1]+nm[1]*sg*dd,p[2]+nm[2]*sg*dd];
      if(!outside(q[0],q[1],q[2]))continue;const d=near(q[0],q[1],q[2],0.5).d;if(d>pad)continue;
      const g=label(p,[nm[0]*sg,nm[1]*sg,nm[2]*sg]);if(!g)continue;tot++;byG[g]=byG[g]||{n:0,miss:0};byG[g].n++;
      v.set(q[0],q[1],q[2]);if(!camSolid(v,pad)){miss++;byG[g].miss++;if(missPts.length<12)missPts.push({p:q.map(x=>+x.toFixed(2)),d:+d.toFixed(3),g});}}
    // false positives: free points (true clearance > pad+0.6) that camSolid(pad) calls solid
    for(let i=0;i<n;i++){const x=(rnd()-0.5)*26,y=(rnd()-0.5)*18,z=(rnd()-0.5)*50;const d=near(x,y,z,pad+0.6).d;if(d<9)continue;if(!outside(x,y,z))continue;fpTot++;v.set(x,y,z);if(camSolid(v,pad))fp++;}
    return {tot,miss,byG,missPts,fpTot,fp};}
  // frame cost of a whole tick (to compare the arm against the rest)
  function tickCost(){const sp=SPOTS[0];place(sp.pos,0,0.1);stepN(10,0.05);const t0=performance.now();stepN(60,1/60);return +((performance.now()-t0)/60).toFixed(2);}
  window.CT={prime,near,segHit,outside,meas,rec,place,stepN,genSpots,crossCheck,runSpot,runOrbit,runFlight,costArm,tickCost,coverage,wantArm,
    setSpots:s=>{SPOTS=s;return SPOTS.length;},spots:()=>SPOTS,info:()=>({NT,rocks:RK.filter((_,k)=>rockLive(k)).length,grid:G,IS_TOUCH,cellsUsed:cstart[NC]})};
  return window.CT.info();
}

// ---------------------------------------------------------------- Node side
const pct=(a,p)=>{if(!a.length)return null;const s=[...a].sort((x,y)=>x-y);return s[Math.min(s.length-1,Math.floor(p*s.length))];};
const sum=(a,f)=>a.reduce((s,x)=>s+f(x),0);
(async()=>{
 const b=await chromium.launch({args:ARGS});let fail=0;const results={};
 const runs=[['pc',{viewport:{width:1280,height:720}}],['phone',{viewport:{width:844,height:390},isMobile:true,hasTouch:true}]].filter(r=>(!ONLY||r[0]===ONLY)&&(!SHOTS||r[0]==='pc'));
 for(const [name,opt] of runs){
  console.log('=====',name,opt.viewport.width+'x'+opt.viewport.height,'tag',TAG);
  const ctx=await b.newContext(opt),p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  p.on('crash',()=>{console.log('PAGE CRASHED');process.exit(3);});b.on('disconnected',()=>{if(!global.__fin){console.log('BROWSER GONE (out of memory?)');process.exit(3);}});
  await p.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  await p.addInitScript(()=>{window.__noTip=0;window.__noTut=1;});
  await p.goto(BASE+'/test.html?q=3');
  if(name==='pc'){await p.waitForFunction(()=>document.getElementById('play')&&!document.getElementById('play').disabled,null,{timeout:300000});await p.evaluate(()=>document.getElementById('play').click());}
  else{await p.waitForFunction(()=>{const g=document.getElementById('mmGo');return g&&!g.disabled;},null,{timeout:300000});await p.waitForTimeout(1500);await p.tap('#mmGo');}
  await p.evaluate(()=>document.fonts.ready);
  // stop the real-time loop (only __step moves the game from now on) and freeze the rocks
  await p.evaluate(()=>{window.__manual=1;window.__CFG.worldV=0;});await p.waitForTimeout(2500);
  await p.evaluate(()=>{window.__noRender=1;__step(10);});
  console.log('state before settling the camera',JSON.stringify(await p.evaluate(()=>({state:__T.state,orbit:+__T.camOrbit.toFixed(2),wave:__T.wave}))));
  const info=await p.evaluate(pageLib,SEED);console.log('page lib',JSON.stringify(info));
  console.log('prime (round held open, camera in the normal follow mode)',JSON.stringify(await p.evaluate(()=>CT.prime())));
  const cc=await p.evaluate(()=>CT.crossCheck(40));console.log('cross-check vs THREE.Raycaster',JSON.stringify(cc));if(cc.bad>0){console.log('FAIL: the independent check disagrees with the Raycaster');fail=1;}

  if(SHOTS){
   // ---- screenshot cases at fixed spots (same numbers in every build)
   const cases=[['hull_back',{pos:[5.8,0.4,2.0],yaw:-Math.PI/2,pitch:0.1}],['nacelle_under',{pos:[9.0,-3.95,-6.0],yaw:0,pitch:-0.5}],['gap',{pos:[5.4,-0.6,-11.0],yaw:-Math.PI/2,pitch:0.15}],['belly',{pos:[0,-5.2,3.0],yaw:0,pitch:-0.6}],['rock',null]];
   if(process.env.HEADS_CASE){const e=JSON.parse(process.env.HEADS_CASE);cases.length=0;cases.push([e.name||'case',e]);} // HEADS_CASE='{"name":"tight","pos":[x,y,z],"yaw":a,"pitch":b}': only that one
   for(const [cn,c0] of cases){
    const c=c0||await p.evaluate(()=>{const R=__heads.ROCKS.filter(R=>R.mesh.visible&&R.fade>0.9).sort((a,b)=>a.c.length()-b.c.length())[0],dir=new __THREE.Vector3(R.c.x,R.c.y,0).normalize();
      // stand 1.2 m off the rock surface (found with the independent triangles), on the side away from the ship axis, looking away from the rock
      const hit=CT.segHit(R.c.x+dir.x*12,R.c.y+dir.y*12,R.c.z,R.c.x,R.c.y,R.c.z,0,false),pos=R.c.clone().addScaledVector(dir,12-hit+1.2);
      return {pos:[pos.x,pos.y,pos.z],yaw:Math.atan2(-dir.x,-dir.z),pitch:0.1,rock:R.c.toArray().map(v=>+v.toFixed(1))};});
    const m=await p.evaluate(c=>{CT.place(c.pos,c.yaw,c.pitch);CT.stepN(30,0.05);return {...CT.rec(CT.meas()),pyaw:+__heads.P.yaw.toFixed(2),ppitch:+__heads.P.pitch.toFixed(2),orbit:+__T.camOrbit.toFixed(2),pos:__heads.P.pos.toArray().map(v=>+v.toFixed(2))};},c);
    console.log('shot case',cn,JSON.stringify(m));
    await p.evaluate(()=>{window.__manual=1;});await p.waitForTimeout(250);await p.evaluate(()=>{window.__noRender=0;__render();});await p.waitForTimeout(400);
    await p.screenshot({path:shot('cam_'+cn+'_'+(process.env.HEADS_TAG||'after')+'.png'),timeout:180000});await p.evaluate(()=>{window.__noRender=1;});
   }
   console.log('errors',JSON.stringify(errs.slice(0,5)));if(errs.length)fail=1;await ctx.close();continue;}

  const R={name,tag:TAG,info,cross:cc};
  R.tickMs=await p.evaluate(()=>{CT.setSpots([{g:'x',pos:[0,30,20]}]);return CT.tickCost();});console.log('game tick cost, no render (ms/frame)',R.tickMs);
  const t0=Date.now();
  const nSp=await p.evaluate(([per,nr,seed])=>CT.setSpots(CT.genSpots(per,nr,seed)),[PER,NROCK,SEED]);
  const groupsN=await p.evaluate(()=>{const c={};for(const s of CT.spots())c[s.g]=(c[s.g]||0)+1;return c;});console.log('spots',nSp,JSON.stringify(groupsN),'('+((Date.now()-t0)/1000).toFixed(1)+' s)');R.spots=groupsN;

  if(process.env.HEADS_COVER){const cv=await p.evaluate(()=>CT.coverage(6000,0.3));console.log('COVERAGE (real surface within 0.3 m, camSolid(0.3) says free = hole)',JSON.stringify({tot:cv.tot,miss:cv.miss,byG:cv.byG,fpTot:cv.fpTot,fp:cv.fp}));for(const m of cv.missPts)console.log('   hole',JSON.stringify(m));await ctx.close();continue;}
  // ---- 1. static
  if(!process.env.HEADS_NOSTATIC){
   const rows=[];let invalid=0;const t1=Date.now();
   for(let i=0;i<nSp;i++){const r=await p.evaluate(([i,n])=>CT.runSpot(i,n),[i,NCOMBO]);if(r.invalid){invalid++;rows.push(r);}else rows.push(r);if(i%25===24)console.log('  static',i+1,'/',nSp,((Date.now()-t1)/1000).toFixed(0)+' s');}
   const groups={};let all=[];
   for(const r of rows){if(r.invalid)continue;for(const s of r.s){s.g=r.g;all.push(s);}}
   const gs=[...new Set(all.map(s=>s.g))];
   const agg=ss=>({n:ss.length,wall:sum(ss,s=>s.wall),near12:sum(ss,s=>s.md<0.12?1:0),near05:sum(ss,s=>s.md<0.05?1:0),
     armLt1:sum(ss,s=>s.arm<1?1:0),armLt06:sum(ss,s=>s.arm<0.6?1:0),minMd:+Math.min(...ss.map(s=>s.md)).toFixed(3),minArm:+Math.min(...ss.map(s=>s.arm)).toFixed(2),medRatio:pct(ss.map(s=>s.r),0.5),p10Ratio:pct(ss.map(s=>s.r),0.1),shortPct:+(100*sum(ss,s=>s.r<0.97?1:0)/ss.length).toFixed(0)});
   for(const g of gs)groups[g]=agg(all.filter(s=>s.g===g));
   R.static={total:agg(all),groups,spotsInvalid:invalid,spotsValid:rows.length-invalid,
     worst:all.filter(s=>s.wall||s.md<0.12).sort((a,b)=>(b.wall-a.wall)||(a.md-b.md)).slice(0,8)};
   console.log('STATIC',name,TAG,JSON.stringify(R.static.total),'invalid spots',invalid);
   for(const g of gs){const a=groups[g];console.log('  ',g.padEnd(11),'n',String(a.n).padStart(4),'wall',String(a.wall).padStart(4),'near<12',String(a.near12).padStart(4),'near<5',String(a.near05).padStart(4),'minDist',a.minMd,'minArm',a.minArm,'median arm/wanted',a.medRatio,'p10',a.p10Ratio,'shortened%',a.shortPct);}
   for(const w of R.static.worst)console.log('  worst',JSON.stringify(w));
   if(R.static.total.wall||R.static.total.near05)if(!ISBASE)fail=1;
   R.staticRaw=rows;
  }
  // ---- 2. orbit
  if(!process.env.HEADS_NOORBIT){
   const idx=await p.evaluate(n=>{const s=CT.spots(),by={};s.forEach((x,i)=>(by[x.g]=by[x.g]||[]).push(i));const gs=Object.keys(by),out=[];for(let k=0;out.length<n&&k<n*4;k++){const g=gs[k%gs.length],l=by[g];out.push(l[Math.floor(k/gs.length)%l.length]);}return [...new Set(out)];},NORB);
   const rows=[];for(const i of idx)rows.push(await p.evaluate(i=>CT.runOrbit(i),i));
   const ok=rows.filter(r=>!r.invalid);
   const T={spots:ok.length,frames:sum(ok,r=>r.n),wall:sum(ok,r=>r.wall),near12:sum(ok,r=>r.near12),near05:sum(ok,r=>r.near05),minMd:Math.min(...ok.map(r=>r.minMd)),minArm:Math.min(...ok.map(r=>r.minArm)),jumpMaxCm:Math.max(...ok.map(r=>r.jumpMax)),reversals:sum(ok,r=>r.rev)};
   R.orbit={total:T,rows:ok};console.log('ORBIT',name,TAG,JSON.stringify(T));for(const r of ok.filter(r=>r.wall||r.near12))console.log('   ',r.g,'spot',r.i,'wall',r.wall,'near12',r.near12,'near05',r.near05,'minDist',r.minMd);
   if(T.wall||T.near05)if(!ISBASE)fail=1;
  }
  // ---- 3. flights
  if(!process.env.HEADS_NOFLIGHT){
   const rows=[],modes=['spin','sway','behind'];
   for(let k=0;k<NFLY;k++){const o=await p.evaluate(([i,m,s,t])=>CT.runFlight(i,m,s,t),[k*7+3,modes[k%3],SEED*1000+k,!!process.env.HEADS_FULLTRACE]);rows.push(o);}
   const part=ms=>{const ok=rows.filter(r=>(!ms||r.mode===ms));return {flights:ok.length,frames:sum(ok,r=>r.n),wall:sum(ok,r=>r.wall),near12:sum(ok,r=>r.near12),near05:sum(ok,r=>r.near05),minMd:+Math.min(...ok.map(r=>r.minMd)).toFixed(3),minArm:Math.min(...ok.map(r=>r.minArm)),
     jumpMaxCm:Math.max(...ok.map(r=>r.jumpMax)),maxShrinkCmPerFrame:Math.max(...ok.map(r=>r.shrink)),maxGrowCmPerFrame:Math.max(...ok.map(r=>r.grow)),j10:sum(ok,r=>r.j10),j25:sum(ok,r=>r.j25),j50:sum(ok,r=>r.j50),popIn:sum(ok,r=>r.popIn),reversals1_5cm:sum(ok,r=>r.rev),reversals3cm:sum(ok,r=>r.rev3),revPerMin:+(sum(ok,r=>r.rev)/(sum(ok,r=>r.n)/3600)).toFixed(1),invalidFrames:sum(ok,r=>r.invalid)};};
   R.flight={total:part(),spin:part('spin'),sway:part('sway'),behind:part('behind'),rows};
   console.log('FLIGHTS',name,TAG,JSON.stringify(R.flight.total));for(const m of modes)console.log('   ',m.padEnd(7),JSON.stringify(R.flight[m]));
   if(process.env.HEADS_TRACE)for(const r of rows.filter(r=>r.trace&&r.shrink>100).slice(0,4)){console.log('  TRACE',r.g,r.mode,'shrink',r.shrink);for(const t of r.trace)console.log('     ',JSON.stringify(t));}
   const w=[...rows].sort((a,b)=>b.jumpMax-a.jumpMax).slice(0,3);console.log('  biggest jumps',JSON.stringify(w.map(r=>({g:r.g,mode:r.mode,jump:r.jumpMax,worst:r.worst}))));
   if(R.flight.total.wall||R.flight.total.near05)if(!ISBASE)fail=1;
  }
  // ---- cost
  R.cost=await p.evaluate(()=>CT.costArm());console.log('camArm cost',JSON.stringify(R.cost));
  console.log('errors',JSON.stringify(errs.slice(0,5)));if(errs.length)fail=1;R.errors=errs.slice(0,5);
  results[name]=R;fs.mkdirSync(OUT,{recursive:true});fs.writeFileSync(require('path').join(OUT,'camera_'+name+'_'+TAG+'.json'),JSON.stringify(R));
  await ctx.close();}
 global.__fin=1;await b.close();console.log(fail?'FAIL':'PASS');process.exit(fail);})();
