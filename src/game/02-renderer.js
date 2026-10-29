/* ================= RENDERER / SCENE ================= */
const canvas=$('c');
// v55: the canvas needs no MSAA of its own: every frame is drawn into the composer's multisampled target and only full-screen passes reach the canvas,
// so dropping it saves memory bandwidth (a lot on integrated GPUs) with no visible change
const renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance'});
// v55: automatic quality. Level 0 = the full look, exactly as before. Each level down caps the render resolution (pixel budget),
// then lowers MSAA, bloom resolution and shadow-map size. See qaDecide() for when it moves.
const QA={lvl:0,base:Math.min(devicePixelRatio,isTouch?1.5:2),on:!window.__noQA,
  budget:[Infinity,2.4e6,1.6e6,1.05e6,0.7e6,0.45e6],          // max rendered pixels per frame
  samples:isTouch?[0,0,0,0,0,0]:[4,4,2,0,0,0],                 // MSAA of the main render target
  bloomDiv:isTouch?[2,2,2,2,3,3]:[0,2,2,2,3,3],               // bloom at screen size / n (0 = full render size)
  shadow:isTouch?[1024,1024,1024,1024,512,512]:[2048,2048,2048,1024,1024,512],
  last:0,wT:0,wF:[],wJ:[],bad:0,good:0,cool:2,probeAt:-1,probeW:0,block:-1,blockT:0,fps:0,gpu:''};
function qaPR(w,h){return Math.max(0.5,Math.min(QA.base,Math.sqrt(QA.budget[QA.lvl]/(w*h))));}
renderer.setPixelRatio(qaPR(innerWidth,innerHeight));
renderer.outputColorSpace=THREE.SRGBColorSpace;
const TM=window.__tm||'aces';renderer.toneMapping=TM==='aces'?THREE.ACESFilmicToneMapping:THREE.AgXToneMapping;renderer.toneMappingExposure=TM==='aces'?1.0:(window.__tmx||1.25);
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene(); scene.background=new THREE.Color(0x020205);
const camera=new THREE.PerspectiveCamera(62,1,0.05,1500);
// post: HDR render -> bloom -> tone mapping / sRGB
const composer=new EffectComposer(renderer,new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,samples:isTouch?0:4}));composer.addPass(new RenderPass(scene,camera));
const bloom=new UnrealBloomPass(new THREE.Vector2(256,256),isTouch?0.5:0.6,0.5,2.0);composer.addPass(bloom);
composer.addPass(new OutputPass());
// final lens pass (display space): cool violet shadows / warm highlights, soft vignette, a hint of colour fringing at the edges, fine film grain
const GRADE=new ShaderPass({uniforms:{tDiffuse:{value:null},uTime:{value:0},uRes:{value:new THREE.Vector2(1,1)},uCA:{value:isTouch?0:0.0014},uGrain:{value:window.__grain??0.032},uVig:{value:0.26},uSat:{value:window.__sat??1.0},uTone:{value:window.__tone??0}},
  vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`uniform sampler2D tDiffuse;uniform float uTime,uCA,uGrain,uVig,uSat,uTone;uniform vec2 uRes;varying vec2 vUv;
    float hash(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
    void main(){vec2 c=vUv-.5;float r2=dot(c,c);vec2 o=c*uCA*(.3+r2*4.);
      vec3 col=vec3(texture2D(tDiffuse,vUv+o).r,texture2D(tDiffuse,vUv).g,texture2D(tDiffuse,vUv-o).b);
      float l=dot(col,vec3(.2126,.7152,.0722));
      col=mix(col,mix(col*vec3(.94,.95,1.07)+vec3(.004,.002,.012),col,smoothstep(0.,.45,l)),uTone);
      col=mix(col,mix(col,col*vec3(1.045,1.,.93),smoothstep(.5,1.,l)),uTone);
      col=max(mix(vec3(l),col,uSat),0.);
      vec2 a=c*vec2(uRes.x/uRes.y,1.);col*=1.-uVig*smoothstep(.3,1.05,length(a));
      float g=hash(vUv*uRes+fract(uTime*13.17)*vec2(91.7,37.3))-.5;col+=g*uGrain*(1.-.6*l);
      gl_FragColor=vec4(col,1.);}`});
composer.addPass(GRADE);
function resize(){const w=innerWidth,h=innerHeight;renderer.setPixelRatio(qaPR(w,h));renderer.setSize(w,h,false);composer.setPixelRatio(renderer.getPixelRatio());composer.setSize(w,h);
  {const d=QA.bloomDiv[QA.lvl];if(d)bloom.setSize(w/d,h/d);}camera.aspect=w/h;camera.updateProjectionMatrix();GRADE.uniforms.uRes.value.set(w*renderer.getPixelRatio(),h*renderer.getPixelRatio());}
addEventListener('resize',resize);resize();

