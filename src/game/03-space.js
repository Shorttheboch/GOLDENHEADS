// ---- space environment: procedural nebula sky + gas giant + sun, used for the background AND for metal reflections ----
const SUN_DIR=new THREE.Vector3(40,30,20).normalize();
const PLANET_DIR=new THREE.Vector3(-0.55,-0.42,-0.72).normalize();
const NOISE_GLSL=`float h3(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float n3(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
  return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*n3(p);p*=2.03;a*=.5;}return s;}`;
function skyMat(sunHDR){return new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{uSun:{value:SUN_DIR},uHDR:{value:sunHDR}},
  vertexShader:`varying vec3 vDir;void main(){vDir=position;vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;}`,
  fragmentShader:`uniform vec3 uSun;uniform float uHDR;varying vec3 vDir;${NOISE_GLSL}
  void main(){vec3 d=normalize(vDir);
    float band=exp(-pow(dot(d,normalize(vec3(.35,.82,-.45)))*3.,2.));
    float f=fbm(d*2.6+vec3(4.,1.,7.)),g=fbm(d*6.+f*2.3);
    vec3 col=vec3(.003,.003,.010);
    col+=vec3(.22,.06,.46)*pow(f,3.)*1.5*(.3+band);
    col+=vec3(.02,.24,.42)*pow(g,4.)*1.4*band;
    float s=max(dot(d,uSun),0.);
    col+=vec3(.9,.6,.3)*pow(s,24.)*.35+vec3(1.,.75,.45)*pow(s,300.)*1.5;
    col+=vec3(1.,.93,.8)*smoothstep(.99955,.9998,s)*uHDR;
    gl_FragColor=vec4(col,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`});}
function planetMat(){return new THREE.ShaderMaterial({uniforms:{uSun:{value:SUN_DIR}},
  vertexShader:`varying vec3 vN;varying vec3 vW;varying vec3 vL;void main(){vN=normalize(mat3(modelMatrix)*normal);vL=position;
    vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
  fragmentShader:`uniform vec3 uSun;varying vec3 vN;varying vec3 vW;varying vec3 vL;${NOISE_GLSL}
  void main(){vec3 n=normalize(vN),p=normalize(vL);
    float lat=p.y+.08*fbm(p*5.);float bands=fbm(vec3(lat*11.,p.x*.8,p.z*.8));
    vec3 base=mix(vec3(.16,.05,.32),vec3(.05,.14,.36),smoothstep(.35,.65,bands));
    base=mix(base,vec3(.20,.55,.70),smoothstep(.62,.8,fbm(p*3.+bands))*.55);
    float l=max(dot(n,uSun),0.);vec3 V=normalize(cameraPosition-vW);float fr=pow(1.-max(dot(n,V),0.),2.6);
    vec3 col=base*(.015+l*1.05)+vec3(.25,.6,1.)*fr*(.12+l*1.3);
    gl_FragColor=vec4(col,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`});}
// visible sky + planet
{const sky=new THREE.Mesh(new THREE.SphereGeometry(1200,48,24),skyMat(18));sky.renderOrder=-2;sky.frustumCulled=false;scene.add(sky);
 const pl=new THREE.Mesh(new THREE.SphereGeometry(330,64,48),planetMat());pl.position.copy(PLANET_DIR).multiplyScalar(950);pl.renderOrder=-1;scene.add(pl);}
// reflections: same universe rendered into a PMREM environment (sun is HDR so gold gets real highlights)
const pmrem=new THREE.PMREMGenerator(renderer);
{const es=new THREE.Scene();es.add(new THREE.Mesh(new THREE.SphereGeometry(50,48,24),skyMat(25)));
 const pl=new THREE.Mesh(new THREE.SphereGeometry(16,48,32),planetMat());pl.position.copy(PLANET_DIR).multiplyScalar(42);es.add(pl);
 scene.environment=pmrem.fromScene(es,0.015,0.1,200).texture;}
scene.environmentIntensity=1.0;
// lights: warm key sun with soft shadows that follow the player, violet planet bounce, faint warm rim
const sun=new THREE.DirectionalLight(0xfff0d8,3.4);sun.position.copy(SUN_DIR).multiplyScalar(60);scene.add(sun);scene.add(sun.target);
sun.castShadow=true;sun.shadow.mapSize.set(isTouch?1024:2048,isTouch?1024:2048);
{const sc=sun.shadow.camera;sc.left=-15;sc.right=15;sc.top=15;sc.bottom=-15;sc.near=1;sc.far=140;}
sun.shadow.bias=-0.0003;sun.shadow.normalBias=0.035;
scene.add(new THREE.HemisphereLight(0x4a3a8a,0x081428,0.35));
const bounce=new THREE.DirectionalLight(0x6a58ff,0.55);bounce.position.copy(PLANET_DIR).multiplyScalar(50);scene.add(bounce);
const rim=new THREE.DirectionalLight(0xff7040,0.45);rim.position.set(-30,-10,-40);scene.add(rim);
// near-mirror texels (window glass) turn the sun into a blinding glint: keep a floor on roughness
// and cap the HDR output so a sun glint blooms as a sparkle, not a white-out
function minRough(m,v,cap=1.8){m.onBeforeCompile=sh=>{sh.fragmentShader=sh.fragmentShader
  .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\n\troughnessFactor=max(roughnessFactor,'+v.toFixed(3)+');')
  .replace('#include <opaque_fragment>','outgoingLight=min(outgoingLight,vec3('+cap.toFixed(2)+'));\n#include <opaque_fragment>');};
  m.customProgramCacheKey=()=>'minR'+v+'_'+cap;m.needsUpdate=true;}
// v69: the same glint problem on a clearcoat (MeshPhysicalMaterial, clearcoat roughness 0.06): a facet that lines up with the sun reaches HDR 400-1100 in ONE pixel,
// and the bloom turns it into a glowing white square. Cap only the reflected specular terms (base + clearcoat), never the emissive glow (the Incineradora drives it up to 4x)
function capSpec(m,cap=1.5){const c=cap.toFixed(2);m.onBeforeCompile=sh=>{sh.fragmentShader=sh.fragmentShader
  .replace('vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;','vec3 totalSpecular = min(reflectedLight.directSpecular + reflectedLight.indirectSpecular,vec3('+c+'));')
  .replace('( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;','min(( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat,vec3('+c+'));');};
  m.customProgramCacheKey=()=>'capSpec'+c;m.needsUpdate=true;}
// soft "character light" riding with the camera, so the side of the astronaut we look at never goes black
const camFill=new THREE.DirectionalLight(0xffe2c0,0.7);scene.add(camFill);scene.add(camFill.target);
// stars: plain sharp points, no glow — lots of tiny faint ones, a few slightly bigger; a bit denser along the nebula's band
{const axis=new THREE.Vector3(.35,.82,-.45).normalize(),v=new THREE.Vector3(),T=[[.8,.88,1.1],[1,.98,.95],[1,.98,.95],[1,.94,.84],[1,.86,.7]];
 for(const [n,size,b0,b1] of [[isTouch?5000:9000,1.05,0.18,0.75],[isTouch?160:260,2.0,0.55,1.0]]){
   const p=new Float32Array(n*3),c=new Float32Array(n*3);
   for(let i=0;i<n;){v.randomDirection();const band=Math.exp(-Math.pow(v.dot(axis)*3.2,2));if(Math.random()>0.45+0.55*band)continue;
     v.multiplyScalar(600+Math.random()*300);p.set([v.x,v.y,v.z],i*3);const t=T[Math.floor(Math.random()*T.length)],br=b0+(b1-b0)*Math.pow(Math.random(),2.2);
     c.set([t[0]*br,t[1]*br,t[2]*br],i*3);i++;}
   const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p,3));g.setAttribute('color',new THREE.BufferAttribute(c,3));
   scene.add(new THREE.Points(g,new THREE.PointsMaterial({size,sizeAttenuation:false,vertexColors:true,depthWrite:false})));}}
// far asteroid belt: two cheap instanced layers (one draw call each), dark and hazy so they read as out of reach
const BELT=[];
{const g0=new THREE.IcosahedronGeometry(1,2);g0.deleteAttribute('normal');g0.deleteAttribute('uv');const g=mergeVertices(g0),p=g.attributes.position,v=new THREE.Vector3();
 for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);const n=1+0.24*Math.sin(v.x*3.1+1.3)*Math.sin(v.y*2.6+0.4)+0.13*Math.sin(v.z*5.3+v.x*2.0)+0.08*Math.sin(v.y*7.1-v.z*3.3);v.multiplyScalar(n);p.setXYZ(i,v.x,v.y,v.z);}
 g.computeVertexNormals();
 const haze={value:new THREE.Color(0.022,0.014,0.05)};
 const mat=new THREE.MeshStandardMaterial({color:0x5a4c55,roughness:0.95,metalness:0.05,transparent:true});
 mat.onBeforeCompile=sh=>{sh.uniforms.uHaze=haze;sh.fragmentShader='uniform vec3 uHaze;\n'+sh.fragmentShader.replace('#include <opaque_fragment>','float hz=smoothstep(40.,520.,length(vViewPosition));outgoingLight=mix(outgoingLight,uHaze,hz*0.5);diffuseColor.a*=1.-hz*0.72;\n#include <opaque_fragment>');};
 mat.customProgramCacheKey=()=>'belt';
 const rnd=(()=>{let x=11;return()=>(x=(x*16807)%2147483647)/2147483647;})(),gs=()=>{let s=0;for(let k=0;k<4;k++)s+=rnd();return s/2-1;};
 const BA=0.62; // tilt of the belt across the sky
 for(const [n,r0,r1,zR,s0,s1] of [[isTouch?16:26,85,220,300,0.9,3.2],[isTouch?80:130,240,560,660,3,11]]){
   const im=new THREE.InstancedMesh(g,mat,n);im.frustumCulled=false;im.castShadow=false;im.receiveShadow=false;scene.add(im);
   const L={im,n,zR,x:new Float32Array(n),y:new Float32Array(n),z:new Float32Array(n),s:new Float32Array(n),q:[]};
   for(let i=0;i<n;i++){const band=rnd()<0.78,th=band?BA+(rnd()<0.5?0:Math.PI)+gs()*0.24:rnd()*Math.PI*2,r=r0+(r1-r0)*Math.pow(rnd(),0.8);
     L.x[i]=Math.cos(th)*r;L.y[i]=Math.sin(th)*r*0.8;L.z[i]=(rnd()*2-1)*zR;L.s[i]=s0*Math.pow(s1/s0,Math.pow(rnd(),1.6));
     L.q.push(new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd()*6.3,rnd()*6.3,rnd()*6.3)));
     L.k=new THREE.Vector3(rnd()*0.6+0.7,rnd()*0.5+0.6,rnd()*0.6+0.7);}
   BELT.push(L);}}
const _bm=new THREE.Matrix4(),_bp=new THREE.Vector3(),_bs=new THREE.Vector3();
function updateBelt(dz){for(const L of BELT){for(let i=0;i<L.n;i++){L.z[i]-=dz;if(L.z[i]<-L.zR)L.z[i]+=2*L.zR;
      const e=1-THREE.MathUtils.smoothstep(Math.abs(L.z[i]),L.zR*0.82,L.zR),s=L.s[i]*e;
      _bp.set(L.x[i],L.y[i],L.z[i]);_bs.set(s*(0.75+0.5*((i*37)%10)/10),s*(0.6+0.4*((i*53)%10)/10),s);_bm.compose(_bp,L.q[i],_bs);L.im.setMatrixAt(i,_bm);}
    L.im.instanceMatrix.needsUpdate=true;}}
updateBelt(0);
// fine space dust around the camera: wraps in a box, drifts back with the flight; it is what sells the speed (and depth)
const DUST={L:34,off:new THREE.Vector3()};
{const n=isTouch?260:520,p=new Float32Array(n*3);for(let i=0;i<p.length;i++)p[i]=Math.random()*DUST.L;
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p,3));
 DUST.mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{uCam:{value:new THREE.Vector3()},uOff:{value:DUST.off},uL:{value:DUST.L},uPx:{value:1}},
  vertexShader:`uniform vec3 uCam,uOff;uniform float uL,uPx;varying float vA;
    void main(){vec3 w=uCam+mod(position+uOff-uCam,uL)-uL*.5;vec4 mv=viewMatrix*vec4(w,1.);float z=-mv.z;
      vA=smoothstep(1.2,3.5,z)*(1.-smoothstep(uL*.3,uL*.5,z));gl_PointSize=clamp(uPx*16./max(z,.1),1.,2.4*uPx);gl_Position=projectionMatrix*mv;}`,
  fragmentShader:`varying float vA;void main(){vec2 c=gl_PointCoord-.5;float d=dot(c,c);if(d>.25||vA<.01)discard;gl_FragColor=vec4(vec3(.6,.64,.78)*vA*(1.-d*4.)*.5,1.);}`});
 const pts=new THREE.Points(g,DUST.mat);pts.frustumCulled=false;pts.renderOrder=3;scene.add(pts);DUST.pts=pts;}
// sun glow sprite
function glowTex(inner,outer){const cv=document.createElement('canvas');cv.width=cv.height=128;const x=cv.getContext('2d');
  const gr=x.createRadialGradient(64,64,0,64,64,64);gr.addColorStop(0,inner);gr.addColorStop(0.25,outer);gr.addColorStop(1,'rgba(0,0,0,0)');
  x.fillStyle=gr;x.fillRect(0,0,128,128);const t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;return t;}
{const s=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex('rgba(255,250,230,1)','rgba(255,190,90,.35)'),blending:THREE.AdditiveBlending,depthWrite:false,opacity:0.55,transparent:true}));
 s.position.copy(SUN_DIR).multiplyScalar(1100);s.scale.setScalar(220);scene.add(s);}
const dotTex=glowTex('rgba(255,245,200,1)','rgba(255,190,70,.6)');

