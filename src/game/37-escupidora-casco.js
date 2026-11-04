/* ================= v78: la Escupidora (el cangrejo) ya no se mete en el casco =================
   Todo lo de este archivo es SOLO para el rig del cangrejo (R.crab). Arañas, acechadora, Incineradora y huevos no pasan por aquí.
   Medido contra los triángulos reales de ship.glb (tools/tests/spitter.cjs), la Escupidora se hundía en el casco por varias causas a la vez:
     1. el cuerpo bajaba hasta 0.12·escala siguiendo los pies sobre el casco convexo, y abdomen y colmillos cuelgan más que el cuerpo;
     2. la garra de cada pie cuelga 0.057·escala por debajo del punto de IK, que iba justo sobre la superficie;
     3. el salto arrancaba a 0.5 m del casco con el cangrejo puesto "en pie" respecto al mundo (el abdomen entraba en el casco desde un lado o desde abajo);
     4. la cuerda de seda lo arrastraba hasta el propio punto de anclaje, de morro, sin la altura de camino;
     5. la agachada del ataque (cabeza -0.4 rad y cuerpo -0.13·escala) y la pose de comer (abdomen +0.34 rad) se sumaban a un cuerpo ya bajo: hasta 0.75 m dentro;
     6. pilones y raíces de ala: el margen de 2 casillas (0.5 m) no cubría un cangrejo de hasta 6.6 m de ancho.
   Arreglo: (1)(2) cota inferior y pie levantado, (3)(4) salto y retorno con la altura de camino y la orientación respecto al casco, (5) el cangrejo conserva solo
   una parte de esos gestos (wp, wh, ep, eh), (6) margen que crece con la escala y punto de aparición libre, y para todo lo demás (el rebote del aterrizaje, el último
   fotograma de la caída, morro y cola de la nave…) una red de seguridad: tras la pose se miran unos 100 puntos del cuerpo, el abdomen y los colmillos contra el casco
   (elipse + mapa medido), alas, góndolas y pilones, y se sube el modelo (R.inner, no el grupo: ver crabClear) lo justo. */
const CRAB_FIX={
  fclamp:1,   // 1: un objetivo de pie por debajo de la superficie sube a ella (0 solo para pruebas A/B)
  foot:0.065, // pies: el objetivo del IK sube 0.065·escala sobre el casco (la garra cuelga 0.057·escala)
  wp:0.3,     // fracción del cabeceo hacia abajo (-0.4) de la agachada del ataque que conserva el cangrejo
  wh:0,       // fracción de lo que baja el cuerpo (-0.13) en esa agachada
  ep:0.3,     // lo mismo para la pose de comer: fracción del cabeceo (+0.34) que conserva
  eh:0,       // ...y de lo que baja el cuerpo (-0.11)
  hLo:-0.04,  // lo máximo (unidades del modelo) que el cuerpo baja siguiendo los pies; el resto de arañas conservan -0.12
  mar:0.05,   // m que la red deja entre los puntos del cuerpo y el casco (la superficie del modelo queda ~3 cm dentro de la malla real)
  rel:0.15,   // s: tiempo con el que la red suelta lo que ya no hace falta
  cap:0.5,    // la red nunca sube el cuerpo más de cap·escala m (si hace falta más, el cangrejo está donde no debía: lo resuelve el margen del mapa)
  pad0:5.5, padS:2, // margen del mapa del casco (casillas de 0.25 m / 2.8°) = pad0 + padS·escala: con eso patas y pies quedan fuera de alas y pilones (medido: 9 a 1.75, 11 a 2.7)
  leapBlend:0.4 // s que tarda el salto en pasar de "vientre al casco" a "arriba del mundo"
};
const isCrabS=s=>{const r=s.mesh.userData.rig;return !!(r&&r.crab);};
// margen (casillas de 0.25 m) con el que un bicho de esa escala evita los pilones/alas del mapa del casco
const spPad=s=>s.mesh.scale.x>1.3?(isCrabS(s)?Math.max(2,Math.round(CRAB_FIX.pad0+CRAB_FIX.padS*s.mesh.scale.x)):2):1;

// ---- pies: el objetivo de la punta sube sobre la superficie (las garras no se clavan)
const _cfq=new THREE.Vector3(),_cfn=new THREE.Vector3(),_cfT=new THREE.Vector3();
function crabFoot(T,sc){if(T.z<-23||T.z>23)return T;const hp=hullParam(T);
  if(hullBlocked(hp.z,hp.th,0)){const f=freeSpot(hp.z,hp.th,0);hullPoint(f[0],f[1],_cfq,_cfn);return _cfT.copy(_cfq).addScaledVector(_cfn,CRAB_FIX.foot*sc);} // la casilla es ala/pilón: el pie se apoya junto a ella, no dentro
  hullPoint(hp.z,hp.th,_cfq,_cfn);const d=(T.x-_cfq.x)*_cfn.x+(T.y-_cfq.y)*_cfn.y+(T.z-_cfq.z)*_cfn.z;
  _cfT.copy(T);if(d<0&&CRAB_FIX.fclamp)_cfT.addScaledVector(_cfn,-d); // un objetivo dentro del casco (el pie arrastrado por una cuerda de IK o por el gesto de amenaza) vuelve a la superficie
  return _cfT.addScaledVector(_cfn,CRAB_FIX.foot*sc);}

// ---- cuerpo: lo que le falta a tH para que no baje más de CRAB_FIX.hLo (animSpider ya le ha sumado clamp(ha·0.6,-0.12,0.12))
function crabHAdj(R,g,upW,sc){let ha=0;for(const L of R.legs)ha+=(_sc.subVectors(L.f,g.position).dot(upW)/sc+R.spd.rootOff)/8;
  return Math.max(0,CRAB_FIX.hLo-Math.max(ha*0.6,-0.12));}

// ---- salto: orientación del vientre al casco hacia "arriba del mundo" durante CRAB_FIX.leapBlend s
const _lo1=new THREE.Vector3(),_lo2=new THREE.Vector3(),_lq=new THREE.Quaternion(),_lq2=new THREE.Quaternion();
function crabLeapOrient(s){if(s.state!=='leap'||!s.leapN||s.t>=CRAB_FIX.leapBlend||!isCrabS(s))return false;
  const w=s.t/CRAB_FIX.leapBlend,up=_lo1.copy(s.leapN).lerp(UP,w*w).normalize(),f=_lo2.copy(s.vel).normalize();f.addScaledVector(up,-f.dot(up));
  if(f.lengthSq()<0.01){f.copy(s.face||_lo2.set(0,0,1));f.addScaledVector(up,-f.dot(up));}
  orient(s.mesh,f.normalize(),up);return true;}
// ---- retorno por la seda: el centro llega a la altura de camino sobre el anclaje y el vientre mira al casco
function crabReelAim(s,SK,d){hullPoint(SK.z,SK.th,_cfq,_cfn);SK.n=SK.n||new THREE.Vector3();SK.n.copy(_cfn);
  d.addScaledVector(_cfn,s.mesh.userData.rig.spd.rootOff*s.mesh.scale.x);}
function crabReelOrient(s,SK,d,dt){if(!SK.n||!isCrabS(s))return false;
  const f=_lo2.copy(d).addScaledVector(SK.n,-d.dot(SK.n));if(f.lengthSq()<0.01){f.copy(s.face||_lo2.set(0,0,1));f.addScaledVector(SK.n,-f.dot(SK.n));}
  f.normalize();if(!s.face)s.face=new THREE.Vector3();s.face.copy(f);
  _lq.copy(s.mesh.quaternion);orient(s.mesh,f,SK.n);_lq2.copy(s.mesh.quaternion);s.mesh.quaternion.copy(_lq).slerp(_lq2,1-Math.exp(-14*dt));return true;}

// ---- red de seguridad
// Puntos de prueba: unos 100 vértices repartidos (muestreo del más lejano) por el cuerpo, el abdomen y los colmillos, cada uno atado a su hueso:
// su posición en el mundo es hueso.matrixWorld · local, con local = boneInverse · bindMatrix · vértice (se calcula una vez por cangrejo).
function crabProbes(R){
  const sms=[];R.inner.traverse(o=>{if(o.isSkinnedMesh)sms.push(o);});
  const K={body:24,abdomen:56,fang_L:8,fang_R:8},cand={body:[],abdomen:[],fang_L:[],fang_R:[]},v=new THREE.Vector3();
  for(const sm of sms){const pos=sm.geometry.attributes.position,si=sm.geometry.attributes.skinIndex,sw=sm.geometry.attributes.skinWeight,bones=sm.skeleton.bones;
    for(let i=0;i<pos.count;i+=3){let bi=-1,bw=0;for(let k=0;k<4;k++){const w=sw.getComponent(i,k);if(w>bw){bw=w;bi=si.getComponent(i,k);}}
      if(bw<0.97)continue;const nm=bones[bi].name;if(!cand[nm])continue;
      v.fromBufferAttribute(pos,i).applyMatrix4(sm.bindMatrix);cand[nm].push({sm,i,bi,x:v.x,y:v.y,z:v.z});}}
  const pts=[];
  for(const nm in cand){const c=cand[nm];if(!c.length)continue;let cx=0,cy=0,cz=0;for(const q of c){cx+=q.x;cy+=q.y;cz+=q.z;}cx/=c.length;cy/=c.length;cz/=c.length;
    const dmin=new Float32Array(c.length).fill(1e9),pick=[];let far=0,fd=-1;
    for(let j=0;j<c.length;j++){const d=(c[j].x-cx)**2+(c[j].y-cy)**2+(c[j].z-cz)**2;if(d>fd){fd=d;far=j;}}
    for(let n=0;n<K[nm]&&n<c.length;n++){pick.push(far);const a=c[far];let nf=0,nd=-1;
      for(let j=0;j<c.length;j++){const d=(c[j].x-a.x)**2+(c[j].y-a.y)**2+(c[j].z-a.z)**2;if(d<dmin[j])dmin[j]=d;if(dmin[j]>nd){nd=dmin[j];nf=j;}}far=nf;}
    for(const j of pick){const q=c[j],sm=q.sm,m=new THREE.Matrix4().multiplyMatrices(sm.skeleton.boneInverses[q.bi],sm.bindMatrix);
      const l=new THREE.Vector3().fromBufferAttribute(sm.geometry.attributes.position,q.i).applyMatrix4(m);
      pts.push({b:sm.skeleton.bones[q.bi],x:l.x,y:l.y,z:l.z});}}
  return pts;}
// cuánto hay que subir p a lo largo de n (la normal del casco bajo el cangrejo) para que quede fuera del casco (elipse + mapa medido, con margen mar)
// y fuera de alas, góndolas y pilones (vóxeles reales); 0 si ya está fuera. Siempre hacia fuera del casco: nunca empuja hacia dentro.
const _cpq=new THREE.Vector3(),_cpn=new THREE.Vector3(),_cpd=new THREE.Vector3(),_cpp=new THREE.Vector3();
function crabNeed(p,mar,n){let t=0;
  for(let it=0;it<6;it++){_cpp.copy(p).addScaledVector(n,t);let moved=false;
    if(_cpp.z>-23&&_cpp.z<23){const [a,b,c]=hullAB(_cpp.z),th=Math.atan2((_cpp.y-c)/b,_cpp.x/a);hullPoint(_cpp.z,th,_cpq,_cpn);
      const d=mar-_cpd.subVectors(_cpp,_cpq).dot(_cpn);
      if(d>1e-4){t+=d/Math.max(0.3,_cpn.dot(n));_cpp.copy(p).addScaledVector(n,t);moved=true;}}
    if(wingAt(_cpp)){for(let k=0;k<40&&wingAt(_cpp);k++){_cpp.addScaledVector(n,0.1);t+=0.1;}moved=true;}
    if(!moved)break;}
  return t;}
// tras la pose del cuerpo (animSpider ya ha puesto huesos y actualizado matrixWorld): sube el cuerpo entero, a lo largo de la normal del casco bajo su centro,
// lo que haga falta para que ninguno de los puntos quede dentro. Sube de golpe (nunca se ve dentro) y suelta despacio (rel) lo que ya no hace falta.
// La subida se aplica a R.inner.position (el modelo dentro del grupo), NO al grupo: en algunos estados (la agachada del ataque) nadie rehace mesh.position cada
// fotograma y la subida se habría ido sumando; así la reponemos nosotros cada fotograma y ni s.pos, ni mesh.position, ni la velocidad del rig (R.pp) se enteran.
const _ccn=new THREE.Vector3(),_ccq=new THREE.Vector3(),_ccl=new THREE.Vector3(),_ccr=new THREE.Quaternion();
function crabClear(s,R,g,dt){
  const C=R.cc||(R.cc={pts:crabProbes(R),lt:0,w:null,on:false}),inn=R.inner,y0=-R.spd.rootOff;
  if(!C.w)C.w=C.pts.map(()=>new THREE.Vector3());
  if(C.on){inn.position.set(0,y0,0);g.updateMatrixWorld(true);C.on=false;} // quita la subida del fotograma anterior (las matrices de arriba aún la llevan)
  const gp=g.position;
  if(Math.abs(gp.z)>34||gp.x*gp.x+gp.y*gp.y>400){C.lt=0;R.liftN=0;return;} // lejos de la nave (la caída desde el cielo)
  const hp=hullParam(gp);hullPoint(hp.z,hp.th,_ccq,_ccn);
  C.lt*=Math.exp(-dt/CRAB_FIX.rel);if(C.lt<1e-4)C.lt=0;
  const W=C.w,n=C.pts.length;let e=0;
  for(let i=0;i<n;i++){const P=C.pts[i];W[i].set(P.x,P.y,P.z).applyMatrix4(P.b.matrixWorld).addScaledVector(_ccn,C.lt);const t=crabNeed(W[i],CRAB_FIX.mar,_ccn);if(t>e)e=t;}
  e=Math.min(e,Math.max(0,CRAB_FIX.cap*g.scale.x-C.lt));
  if(e>0){C.lt+=e;for(let i=0;i<n;i++)W[i].addScaledVector(_ccn,e);}
  R.liftN=C.lt;
  if(C.lt>1e-4){_ccl.copy(_ccn).multiplyScalar(C.lt).applyQuaternion(_ccr.copy(g.quaternion).invert()).divideScalar(g.scale.x);
    inn.position.set(0,y0,0).add(_ccl);g.updateMatrixWorld(true);C.on=true;}}
