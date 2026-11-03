// Spiders on the ship (v79): the spiders must STAND on the hull and on the wings (body clear of the surface, legs holding it up, feet on it), not sink into it
// or glue themselves to it. Measured against the REAL triangles of the loaded ship.glb (every mesh under the ship root, world space; a 1 m triangle grid gives exact
// point-triangle distances and double-sided Moller-Trumbore rays) and the real rock mesh, independent of the game's own hull / wing / rock maps (hullPoint, wingY, rockR).
// Before v79 (v74 numbers, 5 cinematic samples): the abdomen of the back hunters was 7-9 cm INSIDE the hull and the chest of the eater 14 cm inside; the two wing
// hunters floated 12-14 cm over the wing on a level body (22 deg off the surface), their height jumped 20 cm in one frame (0.2 m voxel steps of wingTop()).
//   1. cinematic: the 5 opening spiders (eater/lurker, 2 back hunters, 2 wing hunters) at t = 0.4 1.5 3.0 4.5 6.2 s (60 fps), and the root height frame by frame
//   2. play: the astronaut parked high above the hull, the same 5 crawl and perch for 4.5 s (3 samples)
//   3. wing: the two wing hunters walk their whole path out on the wing, there and back (72 samples each, turning points included): feet on the wing, body along it
//   4. rock: a hunter and an eater walking on a big rock (the body must not sink into the real rock mesh)
// Per spider: root height over the surface (expected rootOff*scale), angle between its up and the surface normal, lowest vertices of the front (cephalothorax) and the back
// (abdomen) of the body over the surface (signed distance: negative = inside), hips, knees and where the planted feet are (height of the claw tip over the surface).
// Run on dist-test:   tools/run-test.sh dist-test tools/tests/aranas.cjs        (480x270 so it fits in the shared machine; a few minutes with the software GPU)
//   HEADS_SHOTSET=cine|play (with HEADS_SHOTS: only the cinematic shots, or only the play-phase ones; default all)
//   HEADS_TAG=new|before (file names) · HEADS_BASE=1 (do not fail: for the old code; the 'wing' phase needs the __wingTop hook) · HEADS_PHASES=cine,play,wing,rock · HEADS_W / HEADS_H (viewport)
//   HEADS_SHOTS=1 : only the screenshots, tools/tests/out/aranas_<case>_<tag>.png (800x450, HUD hidden): the cinematic camera (t = 4, 5.5), the wing hunter and a back hunter from
//   the side and from three quarters, the eater, a play-phase hunter from the side and from three quarters
// Output: tools/tests/out/aranas_<tag>.json. Exit code 1 if a threshold fails (or the page errors), 3 if Chromium was killed for lack of memory.
const {chromium}=require('playwright');
const fs=require('fs');
const path=require('path');
const {BASE,ARGS,OUT}=require('./lib.cjs');
const TAG=process.env.HEADS_TAG||'new',ISBASE=!!process.env.HEADS_BASE,SHOTS=!!process.env.HEADS_SHOTS,SET=process.env.HEADS_SHOTSET||'all',PHASES=(process.env.HEADS_PHASES||'cine,play,wing,rock').split(',');
const VW=+(process.env.HEADS_W||(SHOTS?800:480)),VH=+(process.env.HEADS_H||(SHOTS?450:270));
setTimeout(()=>{console.log('WATCHDOG: too slow, giving up');process.exit(2);},1500000);

// ---------------------------------------------------------------- runs in the page (window.DG)
const pageLib=`

(function(){
  const T=__THREE,H=__heads;
  let root=__scene.getObjectByName('SM_HEADS_Ship_Body')||__scene.getObjectByName('SM_HEADS_Ship_TailFan_Rotor');
  while(root&&root.parent&&root.parent!==__scene)root=root.parent;
  root.updateMatrixWorld(true);
  const tr=[];{const a=new T.Vector3();root.traverse(o=>{if(!o.isMesh||!o.geometry)return;const g=o.geometry,pos=g.attributes.position,ix=g.index,n=ix?ix.count:pos.count;
    for(let i=0;i<n;i+=3)for(let k=0;k<3;k++){a.fromBufferAttribute(pos,ix?ix.getX(i+k):i+k).applyMatrix4(o.matrixWorld);tr.push(a.x,a.y,a.z);}});}
  const S=Float32Array.from(tr),NT=S.length/9;tr.length=0;
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
  const NR={d:9,qx:0,qy:0,qz:0};
  function near(px,py,pz,r){let best=r*r,found=false,bx=0,by=0,bz=0;stampN++;
    const x0=Math.max(0,Math.floor((px-r-mn[0])/C)),y0=Math.max(0,Math.floor((py-r-mn[1])/C)),z0=Math.max(0,Math.floor((pz-r-mn[2])/C)),
      x1=Math.min(G[0]-1,Math.floor((px+r-mn[0])/C)),y1=Math.min(G[1]-1,Math.floor((py+r-mn[1])/C)),z1=Math.min(G[2]-1,Math.floor((pz+r-mn[2])/C));
    for(let z=z0;z<=z1;z++)for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const c=(z*G[1]+y)*G[0]+x;
      for(let i=cstart[c];i<cstart[c+1];i++){const t=cids[i];if(stamp[t]===stampN)continue;stamp[t]=stampN;const d2=ptTri(px,py,pz,S,t*9);if(d2<best){best=d2;found=true;bx=QX;by=QY;bz=QZ;}}}
    NR.d=found?Math.sqrt(best):9;NR.qx=bx;NR.qy=by;NR.qz=bz;return NR;}
  // ---- ray (double sided) through the grid (Amanatides-Woo)
  let HT=0;
  function mt(ox,oy,oz,dx,dy,dz,A,o){const ax=A[o],ay=A[o+1],az=A[o+2],e1x=A[o+3]-ax,e1y=A[o+4]-ay,e1z=A[o+5]-az,e2x=A[o+6]-ax,e2y=A[o+7]-ay,e2z=A[o+8]-az;
    const px=dy*e2z-dz*e2y,py=dz*e2x-dx*e2z,pz=dx*e2y-dy*e2x,det=e1x*px+e1y*py+e1z*pz;if(det>-1e-12&&det<1e-12)return false;const inv=1/det;
    const sx=ox-ax,sy=oy-ay,sz=oz-az,u=(sx*px+sy*py+sz*pz)*inv;if(u<-1e-6||u>1+1e-6)return false;
    const qx=sy*e1z-sz*e1y,qy=sz*e1x-sx*e1z,qz=sx*e1y-sy*e1x,v=(dx*qx+dy*qy+dz*qz)*inv;if(v<-1e-6||u+v>1+1e-6)return false;
    HT=(e2x*qx+e2y*qy+e2z*qz)*inv;return true;}
  const CR={t:-1,nx:0,ny:1,nz:0};
  function cast(o,d,L){const ax=o.x,ay=o.y,az=o.z,ux=d.x,uy=d.y,uz=d.z,dx=ux*L,dy=uy*L,dz=uz*L;let best=1e9,bt=-1;
    const oo=[ax,ay,az],dd=[dx,dy,dz];let t0=0,t1=1,ok=true;
    for(let k=0;k<3;k++){const lo=mn[k],hi=mn[k]+G[k]*C;if(Math.abs(dd[k])<1e-12){if(oo[k]<lo||oo[k]>hi){ok=false;break;}}else{let ta=(lo-oo[k])/dd[k],tb=(hi-oo[k])/dd[k];if(ta>tb){const q=ta;ta=tb;tb=q;}t0=Math.max(t0,ta);t1=Math.min(t1,tb);if(t0>t1){ok=false;break;}}}
    if(ok){const ci=[0,0,0],st=[0,0,0],tM=[0,0,0],tD=[0,0,0];
      for(let k=0;k<3;k++){const p=oo[k]+dd[k]*(t0+1e-9);ci[k]=Math.max(0,Math.min(G[k]-1,Math.floor((p-mn[k])/C)));
        if(dd[k]>0){st[k]=1;tM[k]=(mn[k]+(ci[k]+1)*C-oo[k])/dd[k];tD[k]=C/dd[k];}else if(dd[k]<0){st[k]=-1;tM[k]=(mn[k]+ci[k]*C-oo[k])/dd[k];tD[k]=-C/dd[k];}else{st[k]=0;tM[k]=1e9;tD[k]=1e9;}}
      stampN++;
      for(;;){const c=(ci[2]*G[1]+ci[1])*G[0]+ci[0];
        for(let i=cstart[c];i<cstart[c+1];i++){const t=cids[i];if(stamp[t]===stampN)continue;stamp[t]=stampN;
          if(mt(ax,ay,az,ux,uy,uz,S,t*9)&&HT>=0&&HT<=L&&HT<best){best=HT;bt=t;}}
        const k=tM[0]<tM[1]?(tM[0]<tM[2]?0:2):(tM[1]<tM[2]?1:2);
        if(tM[k]>t1||best<=tM[k]*L)break;ci[k]+=st[k];tM[k]+=tD[k];if(ci[k]<0||ci[k]>=G[k])break;}}
    if(bt<0){CR.t=-1;return CR;}
    const o9=bt*9,e1x=S[o9+3]-S[o9],e1y=S[o9+4]-S[o9+1],e1z=S[o9+5]-S[o9+2],e2x=S[o9+6]-S[o9],e2y=S[o9+7]-S[o9+1],e2z=S[o9+8]-S[o9+2];
    let nx=e1y*e2z-e1z*e2y,ny=e1z*e2x-e1x*e2z,nz=e1x*e2y-e1y*e2x;const nl=Math.hypot(nx,ny,nz)||1;nx/=nl;ny/=nl;nz/=nl;
    if(nx*ux+ny*uy+nz*uz>0){nx=-nx;ny=-ny;nz=-nz;} // face the ray origin
    CR.t=best;CR.nx=nx;CR.ny=ny;CR.nz=nz;return CR;}
  const _o=new T.Vector3(),_d=new T.Vector3();
  const HR={h:null,nx:0,ny:1,nz:0};
  // height of p above the surface, measured along unit 'up' (null when no surface below)
  function height(p,up,back){back=back??1.5;_o.copy(p).addScaledVector(up,back);_d.copy(up).negate();
    const r=cast(_o,_d,back+4);if(r.t<0){HR.h=null;return HR;}HR.h=r.t-back;HR.nx=r.nx;HR.ny=r.ny;HR.nz=r.nz;return HR;}

  // ---- the spider model in its rest (bind) pose: where is the body, in model units (origin on the ground)?
  function bodyVerts(rig){ // indices of the body / abdomen / fang vertices of Spider_mesh (dominant bone)
    if(rig._bv)return rig._bv;let sm=null;rig.inner.traverse(o=>{if(o.isSkinnedMesh&&o.name==='Spider_mesh')sm=o;});
    const si=sm.geometry.attributes.skinIndex,sw=sm.geometry.attributes.skinWeight,bones=sm.skeleton.bones,body=[],legs=[];
    for(let i=0;i<si.count;i++){let bi=-1,bw=-1;for(let k=0;k<4;k++){const w=sw.getComponent(i,k);if(w>bw){bw=w;bi=si.getComponent(i,k);}}
      const nm=bones[bi].name;(/^leg_/.test(nm)?legs:body).push(i);}
    rig._bv={sm,body,legs};return rig._bv;}
  const _v=new T.Vector3(),_u=new T.Vector3(),_n=new T.Vector3(),_w=new T.Vector3();
  const r3=x=>Math.round(x*1000)/1000;
  // all about one spider, right now
  function measure(s,opt){opt=opt||{};
    const g=s.mesh,rig=g.userData.rig,sc=g.scale.x;g.updateMatrixWorld(true);
    const up=_u.set(0,1,0).applyQuaternion(g.quaternion).clone();
    const out={kind:s.kind,state:s.state,sc,rootOff:rig.spd.rootOff};
    // 1) the root (group origin) over the surface; the model expects it rootOff*sc above the foot plane
    const hr=height(g.position,up);out.rootH=hr.h===null?null:r3(hr.h);out.rootExpect=r3(rig.spd.rootOff*sc);
    const nrm=new T.Vector3(hr.nx,hr.ny,hr.nz);out.nTilt=r3(Math.acos(Math.min(1,Math.max(-1,nrm.dot(up))))*180/Math.PI); // surface normal vs the spider's up (deg)
    out.up=up.toArray().map(r3);out.n=nrm.toArray().map(r3);
    // 2) bones
    const bp=rig.body.getWorldPosition(new T.Vector3()),ap=rig.abd.getWorldPosition(new T.Vector3());
    const hb=height(bp,nrm.clone().dot(up)>0.5?up:nrm);out.cephBoneH=hb.h===null?null:r3(hb.h);
    const ha=height(ap,up);out.abdBoneH=ha.h===null?null:r3(ha.h);
    // 3) body mesh: lowest vertex above the real surface (nearest-triangle distance; also the height along up)
    const bv=bodyVerts(rig);bv.sm.skeleton.update();bv.sm.updateMatrixWorld(true);
    let minD=9,minDf=9,minDa=9;let lo=9,loF=9,loA=9;const fr=[],bk=[];
    for(const i of bv.body){bv.sm.getVertexPosition(i,_v);_v.applyMatrix4(bv.sm.matrixWorld);const pj=_v.x*up.x+_v.y*up.y+_v.z*up.z;_w.copy(_v);g.worldToLocal(_w);
      (_w.z>0.05?fr:bk).push([pj,_v.x,_v.y,_v.z]);}
    fr.sort((a,b)=>a[0]-b[0]);bk.sort((a,b)=>a[0]-b[0]);
    const one=(arr,isF)=>{let m=9,l=9;for(let k=0;k<Math.min(arr.length,opt.nLow||100);k++){const a=arr[k];_v.set(a[1],a[2],a[3]);const hh=height(_v,up,0.6).h;if(hh!==null&&hh<l)l=hh;
        let dd=near(_v.x,_v.y,_v.z,1.0).d;if(hh!==null&&hh<0)dd=-dd;if(dd<m)m=dd;}return [m,l];};
    const [mF,lF]=one(fr),[mA,lA]=one(bk);minDf=mF;minDa=mA;loF=lF;loA=lA;minD=Math.min(mF,mA);lo=Math.min(lF,lA);
    out.bellyGap=r3(minD);out.cephGap=r3(minDf);out.abdGap=r3(minDa);out.lowestVertH=r3(lo);out.cephLowH=r3(loF);out.abdLowH=r3(loA);
    // 4) feet and legs
    const legs=[];
    for(const L of rig.legs){
      const tip=L.bs[4].localToWorld(L.tipL.clone()),hip=L.bs[0].getWorldPosition(new T.Vector3()),P=L.bs.map(b=>b.getWorldPosition(new T.Vector3()));P.push(tip);
      const ht=height(tip,up,0.6).h,hh=height(hip,up,1.0).h;
      const tn=near(tip.x,tip.y,tip.z,0.6).d;
      let kneeMax=-9,kneeI=0;const hs=P.map((p,i)=>{const h=height(p,up,1.2).h;return h===null?-9:h;});
      for(let i=1;i<=4;i++)if(hs[i]>kneeMax){kneeMax=hs[i];kneeI=i;}
      // joint angles (deg, 180 = straight)
      const ang=[];for(let i=1;i<=4;i++){const a=P[i].clone().sub(P[i-1]).normalize(),b=P[i+1].clone().sub(P[i]).normalize();ang.push(Math.round(Math.acos(Math.min(1,Math.max(-1,a.dot(b))))*180/Math.PI));}
      let tot=0;for(let i=0;i<5;i++)tot+=P[i].distanceTo(P[i+1]);
      const reach=hip.distanceTo(tip)/tot;
      // horizontal (in the surface plane) distance hip -> tip
      const dv=tip.clone().sub(hip);dv.addScaledVector(up,-dv.dot(up));
      legs.push({n:L.n,tipH:ht===null?null:r3(ht),tipNear:r3(tn),hipH:hh===null?null:r3(hh),kneeH:r3(kneeMax),kneeJ:kneeI,reach:r3(reach),run:r3(dv.length()),turn:ang,step:L.step?1:0});
    }
    out.legs=legs;
    const th=legs.map(l=>l.tipH).filter(v=>v!==null);
    out.feet={mean:r3(th.reduce((a,b)=>a+b,0)/th.length),min:r3(Math.min(...th)),max:r3(Math.max(...th)),on3cm:th.filter(v=>Math.abs(v)<0.03).length,above3:th.filter(v=>v>=0.03).length,below3:th.filter(v=>v<=-0.03).length,
      meanGround:r3(legs.filter(l=>!l.step).map(l=>l.tipH).reduce((a,b)=>a+b,0)/Math.max(1,legs.filter(l=>!l.step).length))};
    out.reach=r3(legs.reduce((a,l)=>a+l.reach,0)/8);out.hipH=r3(legs.reduce((a,l)=>a+(l.hipH||0),0)/8);out.kneeH=r3(legs.reduce((a,l)=>a+l.kneeH,0)/8);
    out.kneeAng=r3(legs.reduce((a,l)=>a+(l.turn[1]),0)/8);
    out.run=r3(legs.reduce((a,l)=>a+l.run,0)/8);
    out.bd=r3(rig.bd.h);out.bdP=r3(rig.bd.p);
    return out;}
  // the bind pose reference (model units): spawn a fresh spider far away and read its body before the first animSpider
  function restRef(kind){const s=H.spawnSpider(kind);const g=s.mesh,rig=g.userData.rig;g.position.set(0,0,0);g.quaternion.identity();g.updateMatrixWorld(true);
    const bv=bodyVerts(rig);bv.sm.skeleton.update();bv.sm.updateMatrixWorld(true);
    let lo=9,hi=-9,loFront=9,loAbd=9;for(const i of bv.body){bv.sm.getVertexPosition(i,_v);_v.applyMatrix4(bv.sm.matrixWorld);const y=_v.y+rig.spd.rootOff*g.scale.x; // group origin is rootOff above the ground plane
      const zl=_v.z;if(y<lo)lo=y;if(y>hi)hi=y;if(zl>0.05){if(y<loFront)loFront=y;}else{if(y<loAbd)loAbd=y;}}
    const res={bodyLow:r3(lo),bodyHigh:r3(hi),cephLow:r3(loFront),abdLow:r3(loAbd),n:bv.body.length,legV:bv.legs.length,
      cephBoneY:r3(rig.body.getWorldPosition(new T.Vector3()).y+rig.spd.rootOff*g.scale.x),abdBoneY:r3(rig.abd.getWorldPosition(new T.Vector3()).y+rig.spd.rootOff*g.scale.x)};
    const lg=rig.legs.map(L=>{const P=L.bs.map(b=>b.getWorldPosition(new T.Vector3()));const tip=L.bs[4].localToWorld(L.tipL.clone());P.push(tip);const o=rig.spd.rootOff*g.scale.x;
      return {n:L.n,hipY:r3(P[0].y+o),kneeY:r3(Math.max(P[1].y,P[2].y,P[3].y)+o),tipY:r3(tip.y+o),segLen:r3(L.len.reduce((a,b)=>a+b,0)),tipXZ:r3(Math.hypot(tip.x-P[0].x,tip.z-P[0].z))};});
    res.legs=lg;
    H.spiders.splice(H.spiders.indexOf(s),1);__scene.remove(s.mesh);return res;}

  // ---- a spider on a rock: clearance of its lowest body vertices over the REAL rock mesh (a ray from far outside along the direction to the rock centre hits the surface first)
  const _rc=new T.Raycaster(),_c=new T.Vector3(),_dd=new T.Vector3();
  function rockGap(s){const R=s.rock,g=s.mesh,rig=g.userData.rig;g.updateMatrixWorld(true);R.mesh.updateMatrixWorld(true);_c.copy(R.mesh.position);
    const bv=bodyVerts(rig);bv.sm.skeleton.update();bv.sm.updateMatrixWorld(true);const V=[];
    for(const i of bv.body){bv.sm.getVertexPosition(i,_v);_v.applyMatrix4(bv.sm.matrixWorld);V.push([_v.distanceTo(_c),_v.x,_v.y,_v.z]);}
    V.sort((a,b)=>a[0]-b[0]);let worst=9,worstF=9,worstA=9;
    for(let k=0;k<Math.min(V.length,150);k++){const a=V[k];_v.set(a[1],a[2],a[3]);_dd.subVectors(_v,_c).normalize();_rc.set(_o.copy(_c).addScaledVector(_dd,R.rmax*2+4),_d.copy(_dd).negate());
      const h=_rc.intersectObject(R.mesh,false);if(!h.length)continue;const gap=a[0]-(R.rmax*2+4-h[0].distance);if(gap<worst)worst=gap;
      g.worldToLocal(_w.copy(_v));if(_w.z>0.05){if(gap<worstF)worstF=gap;}else if(gap<worstA)worstA=gap;}
    return {gap:r3(worst),cephGap:r3(worstF),abdGap:r3(worstA),state:s.state,sc:g.scale.x,rmax:R.rmax};}
  window.DG={near,cast,height,measure,restRef,rockGap,S,NT};
})();
`;

// ---------------------------------------------------------------- the test
const NAMES=['eater (lurker)','back hunter A','back hunter B','wing hunter +x','wing hunter -x'];
const f3=v=>v==null?'-':(+v).toFixed(3);
const fmt=m=>`${m.name.padEnd(15)} ${m.state.padEnd(6)} root=${f3(m.rootH)}/${m.rootExpect} tilt=${f3(m.nTilt)} cephGap=${f3(m.cephGap)} abdGap=${f3(m.abdGap)} hip=${m.hipH} knee=${m.kneeH} | feet planted=${f3(m.feet.meanGround)} min=${f3(m.feet.min)} max=${f3(m.feet.max)} on3cm=${m.feet.on3cm}/8 | bd=${m.bd}`;
(async()=>{
 const b=await chromium.launch({args:ARGS});
 const p=await b.newPage({viewport:{width:VW,height:VH}});
 let errs=0,fails=0;
 p.on('crash',()=>{console.log('PAGE CRASHED (out of memory?)');process.exit(3);});
 p.on('pageerror',e=>{errs++;console.log('PAGEERR',e.message);});
 p.on('console',m=>{if(m.type()==='error'&&!/ERR_TUNNEL|Failed to load resource/.test(m.text())){errs++;console.log('ERR',m.text());}});
 await p.addInitScript(()=>{window.__noCine=0;window.__noOpening=1;window.__noTut=1;});
 await p.goto(BASE+'/test.html');
 await p.waitForFunction(()=>document.getElementById('play')&&!document.getElementById('play').disabled,null,{timeout:180000});
 if(SHOTS)await p.addStyleTag({content:'body.noui *:not(canvas){visibility:hidden !important} body.noui canvas{visibility:visible !important}'});
 await p.evaluate(()=>document.getElementById('play').click());
 await p.evaluate(()=>{window.__manual=1;});await p.waitForTimeout(1500); // the real-time loop dies: from now on only __step moves the game
 await p.evaluate(pageLib);
 const step=n=>p.evaluate(n=>{__step(n,1/60);return __heads.CINE.t;},n);
 const log={tag:TAG};
 const checks=[];
 const chk=(name,val,lo,hi)=>{const ok=Number.isFinite(val)&&(lo==null||val>=lo)&&(hi==null||val<=hi);checks.push({name,val:Number.isFinite(val)?+val.toFixed(4):null,lo,hi,ok});
   console.log((ok?'PASS ':'FAIL ')+name+' = '+f3(val)+'  (need '+(lo!=null?'>= '+lo:'')+(lo!=null&&hi!=null?' and ':'')+(hi!=null?'<= '+hi:'')+')');if(!ok)fails++;};
 const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
 const pick=(rows,idx,fn)=>{const o=[];for(const r of rows)for(const i of idx){const v=fn(r.r[i]);if(v!=null&&Number.isFinite(v))o.push(v);}return o;};
 // ---------------------------------------------------------------- screenshots only
 if(SHOTS){
  const shot=async(name,cam)=>{if(SET!=='all'&&(SET==='play')!==name.startsWith('play_'))return; // HEADS_SHOTSET=cine|play: half of the shots per run (the page needs ~2.3 GB)
    await p.evaluate(c=>{const T=__THREE,H=__heads;window.__manual=1;
     if(!c){window.__shotCam=null;}else{const s=H.spiders[c.spider],g=s.mesh;g.updateMatrixWorld(true);const to=v=>new T.Vector3(...v).applyQuaternion(g.quaternion).add(g.position);window.__shotCam={pos:to(c.at).toArray(),look:to(c.look).toArray()};}},cam);
    await p.evaluate(()=>{requestAnimationFrame(()=>__render());});await p.waitForTimeout(500);
    await p.screenshot({path:path.join(OUT,'aranas_'+name+'_'+TAG+'.png'),timeout:180000});console.log('shot',name);};
  let t=0;const to=async T=>{while(t<T-1e-3)t=await step(Math.min(10,Math.max(1,Math.round((T-t)*60))));};
  await p.evaluate(()=>document.body.classList.add('noui'));
  await to(1.0);await shot('eater_side',{spider:0,at:[3.0,0.8,0],look:[0,0.6,0]});
  await to(3.0);
  await shot('wing_side',{spider:3,at:[2.4,0.55,0],look:[0,0.45,0]});await shot('wing_34',{spider:3,at:[1.7,0.7,1.9],look:[0,0.4,0]});
  await shot('back_side',{spider:1,at:[2.4,0.55,0],look:[0,0.45,0]});await shot('back_34',{spider:1,at:[1.7,0.7,1.9],look:[0,0.4,0]});
  await to(3.9);await shot('cine_t4',null);await to(5.5);await shot('cine_t55',null);
  if(SET==='cine'){try{await Promise.race([b.close(),new Promise(r=>setTimeout(r,8000))]);}catch(e){}process.exit(errs?1:0);}
  await p.evaluate(()=>{window.__noSpawn=1;for(const i of [3,4])if(__heads.spiders[i]&&__heads.spiders[i].state==='perch')__heads.spiders[i].perchT=999;}); // before the cinematic ends (startFight), like the play phase below
  await p.evaluate(()=>{while(__heads.CINE.on&&__heads.CINE.t<6.5)__step(6,1/60);}); // CINE.t stops at the end of the cinematic: loop on CINE.on, not on the time
  for(let j=0;j<2;j++)await p.evaluate(()=>{for(let i=0;i<15;i++){__heads.P.pos.set(0,26,3);__heads.P.vel.set(0,0,0);__heads.P.inv=1;__step(4,1/60);}});
  const pk=await p.evaluate(()=>{let bi=-1,by=-9;__heads.spiders.forEach((s,i)=>{if(s.kind==='hunter'&&s.state==='crawl'&&s.mesh.position.y>by&&i<3){by=s.mesh.position.y;bi=i;}});return bi;});
  if(pk>=0){await shot('play_side',{spider:pk,at:[2.4,0.55,0],look:[0,0.45,0]});await shot('play_34',{spider:pk,at:[1.7,0.7,1.9],look:[0,0.4,0]});}
  try{await Promise.race([b.close(),new Promise(r=>setTimeout(r,8000))]);}catch(e){}
  process.exit(errs?1:0);
 }
 // ---------------------------------------------------------------- 1. the opening cinematic
 const ref=await p.evaluate(()=>({hunter:DG.restRef('hunter'),lurker:DG.restRef('lurker')}));
 log.ref=ref;console.log('REST pose hunter: abdomen',ref.hunter.abdLow,'cephalothorax',ref.hunter.cephLow,'hip',ref.hunter.legs[0].hipY,'knee',ref.hunter.legs[0].kneeY,'(m over the ground plane)');
 const sampleAll=async tag=>{const r=await p.evaluate(()=>__heads.spiders.slice(0,5).map(s=>DG.measure(s)));r.forEach((m,i)=>{m.name=NAMES[i];});log[tag.split(' ')[0]]=log[tag.split(' ')[0]]||[];log[tag.split(' ')[0]].push({tag,r});return {tag,r};};
 if(PHASES.includes('cine')){
  const rec=[[],[],[],[],[]],T=[0.4,1.5,3.0,4.5,6.2],rows=[];let ti=0,states=[];
  for(let k=0;k<400&&ti<T.length;k++){
   const r=await p.evaluate(n=>{const H=__heads,out=[];for(let i=0;i<n;i++){__step(1,1/60);out.push(H.spiders.slice(0,5).map(s=>{const g=s.mesh,up=new __THREE.Vector3(0,1,0).applyQuaternion(g.quaternion);return DG.height(g.position,up).h;}));}return {t:H.CINE.t,rows:out};},6);
   r.rows.forEach(row=>row.forEach((v,i)=>rec[i].push(v)));
   if(r.t>=T[ti]){const s=await sampleAll('cine t='+r.t.toFixed(2));rows.push(s);console.log('--- cine t='+r.t.toFixed(2));s.r.forEach(m=>console.log(fmt(m)));ti++;}}
  const pop=rec.map(a=>{a=a.filter(v=>v!==null);let mx=0;for(let k=1;k<a.length;k++)mx=Math.max(mx,Math.abs(a[k]-a[k-1]));return mx;});
  log.pop=pop;console.log('root height jump per frame, max (m):',NAMES.map((n,i)=>n+' '+f3(pop[i])).join(' | '));
  const stOk=rows.every(s=>s.r[3].state==='perch'&&s.r[4].state==='perch'&&s.r[1].state==='crawl'&&s.r[2].state==='crawl');
  chk('cinematic: both wing hunters walk on the wings and both back hunters crawl (1 = yes)',stOk?1:0,1,1);
  // back hunters on the hull
  chk('cine back hunters: abdomen gap, mean of all samples (m, negative = inside the hull)',mean(pick(rows,[1,2],m=>m.abdGap)),-0.02,0.12);
  chk('cine back hunters: abdomen gap, worst sample (before v79: -0.11; it varies with where they spawn)',Math.min(...pick(rows,[1,2],m=>m.abdGap)),-0.07,null);
  chk('cine back hunters: cephalothorax gap, mean (rest 0.162)',mean(pick(rows,[1,2],m=>m.cephGap)),0.13,0.26);
  chk('cine back hunters: hips, mean (rest 0.183)',mean(pick(rows,[1,2],m=>m.hipH)),0.16,0.30);
  chk('cine back hunters: planted feet over the hull, mean (hull map is 2.5 cm off the real hull)',mean(pick(rows,[1,2],m=>m.feet.meanGround)),-0.04,0.07);
  // the eater: its crouch stays, the chest is not inside the hull
  chk('cine eater: cephalothorax gap, mean (the crouch keeps it low, it must not be inside)',mean(pick(rows,[0],m=>m.cephGap)),-0.02,0.10);
  chk('cine eater: abdomen gap, mean',mean(pick(rows,[0],m=>m.abdGap)),-0.02,null);
  // the wing hunters
  chk('cine wing hunters: root height jump, max per frame (m)',Math.max(pop[3],pop[4]),0,0.01);
  chk('cine wing hunters: tilt of the body vs the wing surface, mean (deg)',mean(pick(rows,[3,4],m=>m.nTilt)),0,6);
  chk('cine wing hunters: tilt, worst sample (deg)',Math.max(...pick(rows,[3,4],m=>m.nTilt)),0,12);
  chk('cine wing hunters: root height over the wing minus expected, mean abs (m)',mean(pick(rows,[3,4],m=>Math.abs(m.rootH-m.rootExpect))),0,0.04);
  chk('cine wing hunters: abdomen gap, worst sample',Math.min(...pick(rows,[3,4],m=>m.abdGap)),0.0,null);
  chk('cine wing hunters: planted feet over the wing, mean of all samples (m)',mean(pick(rows,[3,4],m=>m.feet.meanGround)),-0.03,0.04);
  chk('cine wing hunters: planted feet over the wing, worst sample (m)',Math.max(...pick(rows,[3,4],m=>m.feet.meanGround)),null,0.06);
 }
 // ---------------------------------------------------------------- 2. play: the astronaut is far away, the same spiders crawl and perch
 if(PHASES.includes('play')){
  await p.evaluate(()=>{window.__noSpawn=1;for(const i of [0,1,2])if(__heads.spiders[i])__heads.spiders[i].cd=999;for(const i of [3,4])if(__heads.spiders[i]&&__heads.spiders[i].state==='perch')__heads.spiders[i].perchT=999;}); // nobody leaps at the parked astronaut: the hunters keep crawling
  const t0=await step(1);if(t0<6.4)await p.evaluate(()=>{while(__heads.CINE.t<6.5&&__heads.CINE.on)__step(6,1/60);});
  const rows=[];
  for(let j=0;j<3;j++){
   await p.evaluate(()=>{for(let i=0;i<15;i++){__heads.P.pos.set(0,26,3);__heads.P.vel.set(0,0,0);__heads.P.inv=1;for(const k of [0,1,2])if(__heads.spiders[k]&&__heads.spiders[k].state==='crawl')__heads.spiders[k].cd=999;__step(6,1/60);}});
   const s=await sampleAll('play +'+((j+1)*1.5)+'s');rows.push(s);console.log('--- play '+((j+1)*1.5)+' s after');s.r.forEach(m=>console.log(fmt(m)));}
  chk('play: both back hunters keep crawling in all samples (1 = yes)',rows.every(x=>x.r[1].state==='crawl'&&x.r[2].state==='crawl')?1:0,1,1);
  chk('play back hunters: abdomen gap, mean (m)',mean(pick(rows,[1,2],m=>m.abdGap)),-0.02,0.15);
  chk('play back hunters: cephalothorax gap, mean (rest 0.162)',mean(pick(rows,[1,2],m=>m.cephGap)),0.13,0.28);
  chk('play back hunters: hips, mean (rest 0.183)',mean(pick(rows,[1,2],m=>m.hipH)),0.16,0.30);
  chk('play wing hunters: tilt of the body vs the wing surface, mean (deg)',mean(pick(rows,[3,4],m=>m.nTilt)),0,6);
  chk('play wing hunters: root height over the wing minus expected, mean abs (m)',mean(pick(rows,[3,4],m=>Math.abs(m.rootH-m.rootExpect))),0,0.04);
  chk('play wing hunters: planted feet over the wing, mean (m)',mean(pick(rows,[3,4],m=>m.feet.meanGround)),-0.03,0.04);
  chk('play wing hunters: planted feet over the wing, worst sample (m)',Math.max(...pick(rows,[3,4],m=>m.feet.meanGround)),null,0.08);
  chk('play eater/lurker crawling or eating: abdomen gap, mean (m)',mean(pick(rows,[0],m=>m.abdGap)),-0.03,null);
  chk('play eater/lurker crawling or eating: cephalothorax gap, mean (m)',mean(pick(rows,[0],m=>m.cephGap)),-0.02,null);
 }
 // ---------------------------------------------------------------- 3. the wing hunters walk the whole wing path, both wings, there and back
 // They walk a straight line out of (5.8, -7) along (-0.3, 1) and turn round at |x| < 4.4, at the end of the wing or at |x| > 7.3 (updateSpider, 'perch'):
 // start them at the far end of that line and let them walk it twice (sampled every 0.4 s), edges and turning points included.
 if(PHASES.includes('wing')){
  await p.evaluate(()=>{window.__noSpawn=1;});
  if(!PHASES.includes('cine')&&!PHASES.includes('play'))await p.evaluate(()=>{while(__heads.CINE.on&&__heads.CINE.t<6.5)__step(6,1/60);});
  const st=await p.evaluate(()=>{const H=__heads,out=[],dn=Math.hypot(0.3,1);
   for(const idx of [3,4]){const s=H.spiders[idx],sx=idx===3?1:-1;if(!s||s.state!=='perch'){out.push(null);continue;}
    let u0=null;for(let u=-5.4;u<=0;u+=0.05){const x=sx*(5.8-0.3/dn*u),z=-7+u/dn;if(Math.abs(x)<=7.25&&__wingTop(x,z)!==null){u0=u;break;}}
    if(u0===null){out.push(null);continue;}
    s.perch.x=sx*(5.8-0.3/dn*u0);s.perch.z=-7+u0/dn;s.perch.dx=-0.3*sx;s.perch.dz=1;s.perchT=999;out.push(+u0.toFixed(2));}
   for(let i=0;i<10;i++){H.P.pos.set(0,26,3);H.P.vel.set(0,0,0);H.P.inv=1;for(const k of [3,4])if(H.spiders[k])H.spiders[k].perchT=999;__step(6,1/60);} // settle
   return out;});
  console.log('wing walk: start of the line (u, m from the spawn point):',JSON.stringify(st));
  const rows=[];
  for(let k=0;k<72;k++){
   const r=await p.evaluate(()=>{const H=__heads;for(let i=0;i<4;i++){H.P.pos.set(0,26,3);H.P.vel.set(0,0,0);H.P.inv=1;for(const j of [3,4])if(H.spiders[j])H.spiders[j].perchT=999;__step(6,1/60);}
     return [3,4].map(j=>{const s=H.spiders[j];if(!s||s.state!=='perch')return {skip:s?s.state:'gone'};const m=DG.measure(s);m.at=[+s.perch.x.toFixed(2),+s.perch.z.toFixed(2)];return m;});});
   r.forEach((m,i)=>{if(!m.skip){m.name=NAMES[3+i];rows.push({tag:'wing walk '+k,r:{3:m,4:m}});}});}
  log.wing=rows;
  const ms=rows.map(r=>r.r[3]);
  console.log('wing walk:',ms.length,'samples (both wings); position, planted feet over the wing / tilt (deg) / root minus expected (m) / abdomen gap / cephalothorax gap:');
  ms.forEach((m,i)=>{if(i%4===0)console.log('  ',m.at.join(',').padEnd(12),'feet',f3(m.feet.meanGround),'tilt',f3(m.nTilt),'root',f3(m.rootH-m.rootExpect),'abd',f3(m.abdGap),'ceph',f3(m.cephGap));});
  const xs=ms.map(m=>m.at[0]*(m.at[0]<0?-1:1)),zs=ms.map(m=>m.at[1]);
  console.log('wing walk: covered |x| '+f3(Math.min(...xs))+' to '+f3(Math.max(...xs))+', z '+f3(Math.min(...zs))+' to '+f3(Math.max(...zs)));
  chk('wing walk: samples measured (count)',ms.length,100,null);
  chk('wing walk: planted feet over the wing, mean (m)',mean(ms.map(m=>m.feet.meanGround)),-0.03,0.04);
  chk('wing walk: planted feet over the wing, worst sample (m)',Math.max(...ms.map(m=>m.feet.meanGround)),null,0.08);
  chk('wing walk: planted feet under the wing, worst sample (m)',Math.min(...ms.map(m=>m.feet.meanGround)),-0.07,null);
  chk('wing walk: tilt of the body vs the wing surface, mean (deg)',mean(ms.map(m=>m.nTilt)),0,6);
  chk('wing walk: tilt, worst sample (deg)',Math.max(...ms.map(m=>m.nTilt)),0,12);
  chk('wing walk: root height over the wing minus expected, mean abs (m)',mean(ms.map(m=>Math.abs(m.rootH-m.rootExpect))),0,0.04);
  chk('wing walk: root height over the wing minus expected, worst sample (m)',Math.max(...ms.map(m=>Math.abs(m.rootH-m.rootExpect))),0,0.1);
  chk('wing walk: abdomen gap, worst sample (m)',Math.min(...ms.map(m=>m.abdGap)),-0.01,null);
 }

 // ---------------------------------------------------------------- 4. a hunter and an eater on a rock
 if(PHASES.includes('rock')){
  const setup=await p.evaluate(()=>{const H=__heads;window.__CFG.worldV=0;window.__noSpawn=1;let R=null;
    for(const r of H.ROCKS)if(r.mesh.visible&&r.fade>0.9&&Math.abs(r.c.z)<30&&(!R||r.rmax>R.rmax))R=r;
    if(!R)return null;
    H.P.pos.set(R.c.x+60,R.c.y,R.c.z);H.P.vel.set(0,0,0);H.P.inv=1;
    const out=[];for(const [kind,dir] of [['hunter',[0,1,0]],['lurker',[1,0.2,0.4]]]){const s=H.spawnSpider(kind),d=new __THREE.Vector3(...dir).normalize();
      s.pos.copy(R.c).addScaledVector(d,R.rmax*1.1);s.mesh.position.copy(s.pos);H.landOnRock(s,R);s.cd=999;out.push(H.spiders.indexOf(s));}
    window.__rockR=R;return {idx:out,rmax:R.rmax,c:R.c.toArray()};});
  if(!setup){console.log('SKIP rock phase: no rock in range');}
  else{
   const rows=[];console.log('rock: radius',f3(setup.rmax),'centre',setup.c.map(f3).join(','));
   for(let j=0;j<3;j++){
    await p.evaluate(idx=>{const H=__heads;for(let i=0;i<10;i++){H.P.pos.set(window.__rockR.c.x+60,window.__rockR.c.y,window.__rockR.c.z);H.P.inv=1;for(const k of idx)if(H.spiders[k])H.spiders[k].cd=999;__step(6,1/60);}},setup.idx);
    const r=await p.evaluate(idx=>idx.map(k=>{const s=__heads.spiders[k];return s&&s.state==='rock'?DG.rockGap(s):{state:s?s.state:'gone'};}),setup.idx);
    rows.push({tag:'rock +'+(j+1)+'s',r});console.log('--- rock +'+(j+1)+' s',JSON.stringify(r));}
   log.rock=rows;
   const onRock=rows.every(x=>x.r.every(m=>m.state==='rock'));chk('rock: both spiders stay on the rock (1 = yes)',onRock?1:0,1,1);
   if(onRock){
    chk('rock: hunter, lowest body vertex over the real rock mesh, worst sample (m; the rock is lumpy)',Math.min(...rows.map(x=>x.r[0].gap)),-0.06,null);
    chk('rock: hunter, lowest body vertex over the real rock mesh, mean (m)',mean(rows.map(x=>x.r[0].gap)),-0.02,null);
    chk('rock: eater, lowest body vertex over the real rock mesh, worst sample (m)',Math.min(...rows.map(x=>x.r[1].gap)),-0.06,null);}
  }
 }
 chk('no page errors (count)',errs,0,0);
 log.checks=checks;fs.writeFileSync(path.join(OUT,'aranas_'+TAG+'.json'),JSON.stringify(log));
 console.log(fails?`${fails} check(s) FAILED`:'ALL OK');
 try{await Promise.race([b.close(),new Promise(r=>setTimeout(r,8000))]);}catch(e){}
 process.exit(fails&&!ISBASE?1:0);
})();
