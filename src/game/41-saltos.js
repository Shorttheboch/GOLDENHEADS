/* ================= v83: los saltos de las arañas ya no se meten en la nave =================
   Solo las arañas normales (cazadora, flanqueadora, acechadora, crías, ladrona). La Escupidora (R.crab) sigue con lo suyo de v78 (37-escupidora-casco.js) y la
   Incineradora no salta así. Santi las vio meterse en el cuerpo de la nave al saltar hacia él, sobre todo en la punta. Medido contra los triángulos reales de
   ship.glb (tools/tests/saltos.cjs), las causas eran varias a la vez:
     1. el casco del juego (hullPoint) es una elipse por cortes con la normal SIN la pendiente a lo largo de la nave: en la punta (y en la cola) la superficie cae
        15-30° y la araña quedaba "de pie" respecto a la elipse, con el abdomen o la cabeza dentro de la pendiente (al agacharse para saltar, comiendo, al aterrizar);
     2. el despegue: salía a 0.5 m del casco y en el mismo fotograma se giraba hacia donde salta con "arriba" = arriba del mundo: el abdomen (1.2·escala por detrás)
        quedaba dentro del casco las primeras décimas;
     3. la vista (shipBetween) mira 10 puntos sueltos de la recta con la elipse encogida (0.9): rectas rasantes y las que cruzan la punta cerca de la araña pasaban;
     4. en el vuelo, el choque miraba solo el centro contra la elipse + 0.3 m (no el casco real, que en la panza y la punta sobresale de la elipse), dibujaba el
        fotograma antes de empujar y no miraba cabeza ni abdomen; al aterrizar se quedaba con la orientación del vuelo;
     5. la seda de vuelta la llevaba de cabeza hasta el propio punto de anclaje: colmillos y cabeza entraban en el casco al llegar.
   Arreglo: (1) spUp, la normal de verdad (con la pendiente de la elipse a lo largo de z), para orientar y apoyar a la araña en el casco; (2) despegue desde la altura
   a la que camina, con el vientre hacia el casco, girando hacia el vuelo según se aleja (jumpOrient); (3) leapClear, la recta del salto contra el casco real (elipse +
   mapa medido, góndolas, alas) cada 0.3 m, antes de agacharse y otra vez al saltar: si está tapada, no salta; (4)(5) jumpProbe, unos puntos del cuerpo (cabeza,
   colmillos, tórax, abdomen) contra el casco real en salto, deriva y seda: si alguno entra, la araña entera sale lo justo (de golpe) y, pasado el despegue, aterriza
   ahí mismo orientada al casco; la seda llega a la altura de camino y gira el vientre hacia el casco al acercarse. */
const JUMP_FIX={on:1,
  blend:0.4,   // s: como mucho, lo que tarda el despegue en pasar de "vientre al casco" a la orientación de vuelo (antes, si ya está lejos del casco)
  rise:1.5,    // la orientación de vuelo entra del todo cuando el centro está a rise·escala m del casco
  mar:0.05,    // m que los puntos del cuerpo dejan con el casco real
  los:0.3,     // m (·escala) que la recta del salto deja con el casco a partir de 1.5 m del despegue (antes, solo no tocarlo)
  land:0.6,    // s de salto en los que tocar el casco no lo hace aterrizar (resbala): como antes
  reel:2.2};   // m (·escala): a esa distancia del anclaje la seda empieza a girar el vientre hacia el casco
const isJumpS=s=>JUMP_FIX.on&&!isCrabS(s);
// ---- 1. la normal de verdad: la elipse x=a(z)cosθ, y=c(z)+b(z)sinθ tiene normal (b cosθ, a sinθ, -(a sinθ (c'+b' sinθ) + a' b cos²θ)) (pendientes a', b', c' sobre ±0.5 m)
function spUp(z,th,out){const e=0.5,A0=hullAB(z-e),A1=hullAB(z+e),A=hullAB(z),da=(A1[0]-A0[0])/(2*e),db=(A1[1]-A0[1])/(2*e),dc=(A1[2]-A0[2])/(2*e),co=Math.cos(th),si=Math.sin(th);
  return out.set(A[1]*co,A[0]*si,-(A[0]*si*(dc+db*si)+da*A[1]*co*co)).normalize();}
// ---- el casco real bajo un punto: el punto q de la superficie (elipse del corte de su z + mapa medido) y la normal de verdad; devuelve la distancia con signo (+ fuera)
const _jsq=new THREE.Vector3(),_jsn=new THREE.Vector3(),_jsm=new THREE.Vector3();
function jumpSurf(p,q,n){const z=THREE.MathUtils.clamp(p.z,HZ0,HZ1);if(p.z>HZ1+0.05||p.z<HZ0-0.05){q.copy(p);n.set(0,0,Math.sign(p.z));return 9;}
  const [a,b,c]=hullAB(z),th=Math.atan2((p.y-c)/b,p.x/a);q.set(a*Math.cos(th),c+b*Math.sin(th),z);spUp(z,th,n);
  if(z>-14.6&&z<21.6){const o=hullOff(z,th);if(o>0){_jsm.set(Math.cos(th)/a,Math.sin(th)/b,0).normalize();q.addScaledVector(_jsm,o);}}
  return _jsm.subVectors(p,q).dot(n);}
// góndolas y pilones (cápsulas) y alas (vóxeles): ¿p está a menos de m de ellas?
function jumpSolid(p,m){for(const e of ENGINES){_w.subVectors(e.b,e.a);const t=THREE.MathUtils.clamp(_v.subVectors(p,e.a).dot(_w)/_w.lengthSq(),0,1);if(p.distanceTo(_w.multiplyScalar(t).add(e.a))<e.r+m)return true;}
  return wingAt(p);}
// ---- 3. ¿la recta del salto (del despegue a b) pasa limpia del casco real, las góndolas y las alas? Cada 0.3 m; cerca del despegue basta con no tocarlo
const _jlp=new THREE.Vector3();
function leapClear(a,b,sc){const L=a.distanceTo(b),n=Math.max(2,Math.ceil(L/0.3));
  for(let k=1;k<n;k++){const u=k/n,p=_jlp.lerpVectors(a,b,u),from=u*L,need=from<1.5?0.02:JUMP_FIX.los*sc;
    if(Math.abs(p.z)<HZ1+0.5&&jumpSurf(p,_jsq,_jsn)<need)return false;
    if(from>0.8&&jumpSolid(p,from<1.5?0:0.15*sc))return false;}
  return true;}
// el punto de despegue: la altura a la que camina, a lo largo de la normal de verdad
function jumpFrom(s,out,n){hullPoint(s.z,s.th,out);spUp(s.z,s.th,n);return out.addScaledVector(n,s.mesh.userData.rig?s.mesh.userData.rig.spd.rootOff*s.mesh.scale.x:0.28);}
// ---- 2. orientación en el despegue: del vientre al casco (arriba = normal de verdad, delante = el salto sobre ese plano) a la de vuelo (delante = velocidad,
// arriba = el mundo), según se aleja del casco (rise) y como mucho en blend s; una mezcla de cuaterniones, sin saltos en ningún extremo
const _sjq1=new THREE.Quaternion(),_sjq2=new THREE.Quaternion(),_jf=new THREE.Vector3(),_ju=new THREE.Vector3();
function jumpOrient(s){if(s.state!=='leap'||!s.jumpN)return false;const sc=s.mesh.scale.x;
  const h=jumpSurf(s.pos,_jsq,_jsn),w=Math.min(1,Math.max(s.t/JUMP_FIX.blend,(h-0.28*sc)/(JUMP_FIX.rise*sc)));if(w>=1){s.jumpN=null;return false;}
  const f=_jf.copy(s.vel).normalize();f.addScaledVector(s.jumpN,-f.dot(s.jumpN));if(f.lengthSq()<0.01)f.copy(s.face||_jf.set(0,0,1)).addScaledVector(s.jumpN,-_jf.dot(s.jumpN));
  orient(s.mesh,f.normalize(),s.jumpN);_sjq1.copy(s.mesh.quaternion);
  orient(s.mesh,_ju.copy(s.vel).normalize(),UP);_sjq2.copy(s.mesh.quaternion);
  const k=w*w*(3-2*w);s.mesh.quaternion.copy(_sjq1).slerp(_sjq2,k);return true;}
// ---- 4. puntos del cuerpo (en el espacio del grupo, a escala 1; el modelo va -rootOff abajo): colmillos, cabeza, tórax por debajo y a los lados, abdomen (punta,
// panza, lados, arriba). Con un poco de holgura por el muelle del abdomen y el cabeceo del vuelo.
const JUMP_PTS=[[0,0.02,0.47],[0,-0.13,0.3],[0,-0.14,0.05],[0.24,-0.06,0.12],[-0.24,-0.06,0.12],[0,-0.05,-1.27],[0,-0.27,-0.7],[0.5,0.02,-0.66],[-0.5,0.02,-0.66],[0,0.56,-0.66],[0,0.3,-1.1],[0,-0.2,-1.05]].map(a=>new THREE.Vector3(...a));
const _jpw=new THREE.Vector3(),_jpn=new THREE.Vector3(),_jpq=new THREE.Vector3(),_sjN=new THREE.Vector3(),_sjL=new THREE.Vector3();
// cuánto hay que sacar a la araña (a lo largo de la normal del casco bajo su centro) para que ningún punto quede dentro del casco (con mar); 0 si nada entra.
// Góndolas y pilones (cápsulas) y alas (vóxeles) van aparte: lo que haga falta para sacar los puntos de ellas se suma en _sjX (un desplazamiento, no a lo largo de N)
const _sjX=new THREE.Vector3(),_sjc=new THREE.Vector3(),_sjd=new THREE.Vector3();
function jumpNeed(s,N){const g=s.mesh,sc=g.scale.x;let e=0;_sjX.set(0,0,0);let ex=0,ey=0,ez=0;
  for(const P of JUMP_PTS){_jpw.copy(P).multiplyScalar(sc).applyQuaternion(g.quaternion).add(g.position);
    if(Math.abs(_jpw.z)<HZ1+0.05){const d=jumpSurf(_jpw,_jpq,_jpn);if(d<JUMP_FIX.mar){const t=(JUMP_FIX.mar-d)/Math.max(0.35,_jpn.dot(N));if(t>e)e=t;}}
    for(const E of ENGINES){_sjc.subVectors(E.b,E.a);const u=THREE.MathUtils.clamp(_sjd.subVectors(_jpw,E.a).dot(_sjc)/_sjc.lengthSq(),0,1);_sjc.multiplyScalar(u).add(E.a);
      _sjd.subVectors(_jpw,_sjc);const L=_sjd.length(),need=E.r+JUMP_FIX.mar-L;if(need>0&&L>1e-4){_sjd.multiplyScalar(need/L);ex=Math.abs(_sjd.x)>Math.abs(ex)?_sjd.x:ex;ey=Math.abs(_sjd.y)>Math.abs(ey)?_sjd.y:ey;ez=Math.abs(_sjd.z)>Math.abs(ez)?_sjd.z:ez;}}
    if(Math.abs(_jpw.x)>3.5&&wingAt(_jpw)){const up=g.position.y>_jpw.y-0.05?1:-1;let k=0;while(k<12&&wingAt(_jpw)){_jpw.y+=0.1*up;k++;}const dy=(0.1*k+JUMP_FIX.mar)*up;if(Math.abs(dy)>Math.abs(ey))ey=dy;}}
  _sjX.set(ex,ey,ez);if(_sjX.lengthSq()>(2.5*sc)**2)_sjX.setLength(2.5*sc);
  return Math.min(e,2.5*sc);}
// tras mover a la araña en salto o deriva: la saca del casco real si hace falta; pasado el despegue, tocar el casco = aterrizar ahí, ya orientada al casco
function jumpCollide(s){const g=s.mesh,sc=g.scale.x;
  if(Math.abs(s.pos.z)>HZ1+2.5*sc||s.pos.x*s.pos.x+s.pos.y*s.pos.y>(6+2.5*sc)**2)return false;
  const h=jumpSurf(s.pos,_jsq,_jsn),N=_sjN.copy(_jsn);let e=jumpNeed(s,N);
  const root=(g.userData.rig?g.userData.rig.spd.rootOff:0.28)*sc;if(h<root*0.9)e=Math.max(e,root*0.9-h); // el centro, a la altura de camino como poco
  const side=_sjX.lengthSq()>1e-8;if(side){s.pos.add(_sjX);const L=_sjX.length(),vx=s.vel.dot(_sjX)/L;if(vx<0)s.vel.addScaledVector(_sjX,-vx*1.3/L);g.position.copy(s.pos);}
  if(e<=0)return false;
  s.pos.addScaledVector(N,e);g.position.copy(s.pos);const vn=s.vel.dot(N);if(vn<0)s.vel.addScaledVector(N,-vn*1.3);
  if(s.state==='leap'&&s.t<JUMP_FIX.land)return false;
  if(h+e>root+0.5*sc)return false; // only the abdomen or a leg brushed it on the way past: it slides on (landing from there would be a visible jump down)
  jumpLand(s,s.pos);return true;}
// aterriza: en la casilla libre más cercana, mirando hacia donde iba, el vientre al casco
function jumpLand(s,p){const hp=hullParam(p);[s.z,s.th]=freeSpot(hp.z,hp.th,spPad(s));s.state='crawl';s.jumpN=null;
  const W=waveDef(wave);s.cd=THREE.MathUtils.randFloat(W.cd[0],W.cd[1]);
  const n=spUp(s.z,s.th,_sjL);hullPoint(s.z,s.th,s.pos);const f=_jf.copy(s.vel.lengthSq()>0.01?s.vel:(s.face||_jf.set(0,0,1)));f.addScaledVector(n,-f.dot(n));
  if(f.lengthSq()<1e-4)f.set(-n.y,n.x,0);f.normalize();s.face=(s.face||new THREE.Vector3()).copy(f);orient(s.mesh,f,n);
  s.mesh.position.copy(s.pos).addScaledVector(n,(s.mesh.userData.rig?s.mesh.userData.rig.spd.rootOff:0.28)*s.mesh.scale.x);s.stillP=null;}
// ---- 5. la seda: el centro va a la altura de camino sobre el anclaje y, al acercarse, el vientre gira hacia el casco (giro suave); los puntos del cuerpo no entran
function jumpReelAim(s,SK,d){if(!SK.jn){SK.jn=spUp(SK.z,SK.th,new THREE.Vector3());}d.addScaledVector(SK.jn,(s.mesh.userData.rig?s.mesh.userData.rig.spd.rootOff:0.28)*s.mesh.scale.x);}
function jumpReelOrient(s,SK,d,L,dt){const sc=s.mesh.scale.x,n=SK.jn;
  orient(s.mesh,_jf.copy(d).normalize(),UP);_sjq2.copy(s.mesh.quaternion); // como antes: de cabeza hacia el anclaje
  const f=_ju.copy(d).addScaledVector(n,-d.dot(n));if(f.lengthSq()<0.01)f.copy(s.face||_ju.set(0,0,1)).addScaledVector(n,-_ju.dot(n));f.normalize();
  orient(s.mesh,f,n);_sjq1.copy(s.mesh.quaternion);if(!s.face)s.face=new THREE.Vector3();s.face.copy(f);
  const w=THREE.MathUtils.clamp(1-(L-0.4)/(JUMP_FIX.reel*sc),0,1);SK.jw=Math.max(SK.jw||0,w*w*(3-2*w)); // no vuelve atrás
  s.mesh.quaternion.copy(_sjq2).slerp(_sjq1,SK.jw);
  jumpSurf(s.pos,_jsq,_jsn);const N=_sjN.copy(_jsn),e=jumpNeed(s,N);if(e>0)s.pos.addScaledVector(N,e);if(_sjX.lengthSq()>1e-8)s.pos.add(_sjX);s.mesh.position.copy(s.pos);return true;}
