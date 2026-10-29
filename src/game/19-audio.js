/* ================= AUDIO (procedural, no files) ================= */
const LOOPS={};let weldG=null,WELD_T=-1e9;let AC=null,master=null,suckGain=null,humOsc=null,musicGain=null,NOISE=null,musicOn=true,musicT=0,beat=0;
function loopSrc(buf,L,dst){const n=AC.createBufferSource();n.buffer=buf;n.loop=true;n.loopStart=L*0.5;n.loopEnd=L*1.5;n.connect(dst);n.start(0,L*0.5);return n;}
function initAudio(){if(AC)return;try{if(isTouch&&navigator.audioSession)try{navigator.audioSession.type='playback';}catch(_){} // v57: iPhone silent switch would mute the game but not the film
  AC=new (window.AudioContext||window.webkitAudioContext)();
  master=AC.createGain();master.gain.value=0.9;const comp=AC.createDynamicsCompressor();comp.threshold.value=-16;comp.knee.value=12;comp.ratio.value=4;comp.attack.value=0.003;comp.release.value=0.18;master.connect(comp).connect(AC.destination);
  const len=AC.sampleRate*2;NOISE=AC.createBuffer(1,len,AC.sampleRate);const d=NOISE.getChannelData(0);for(let i=0;i<len;i++)d[i]=Math.random()*2-1;
  // hose: band-passed noise + low motor hum, both gated by suckGain
  const src=AC.createBufferSource();src.buffer=NOISE;src.loop=true;const f=AC.createBiquadFilter();f.type='bandpass';f.frequency.value=900;f.Q.value=0.8;
  suckGain=AC.createGain();suckGain.gain.value=0;src.connect(f).connect(suckGain).connect(master);src.start();
  humOsc=AC.createOscillator();humOsc.type='sawtooth';humOsc.frequency.value=92;const hf=AC.createBiquadFilter();hf.type='lowpass';hf.frequency.value=380;
  const hg=AC.createGain();hg.gain.value=0.6;humOsc.connect(hf).connect(hg).connect(suckGain);humOsc.start();
  LOOPS.suck=(buf,L)=>{src.stop();humOsc.stop();const sg=AC.createGain();sg.gain.value=7;sg.connect(suckGain);loopSrc(buf,L,sg);};
  weldG=AC.createGain();weldG.gain.value=0;weldG.connect(master);LOOPS.weld=(buf,L)=>{loopSrc(buf,L,weldG);LOOPS.weldOn=true;};
  {const s=AC.createBufferSource();s.buffer=NOISE;s.loop=true;const hp=AC.createBiquadFilter();hp.type='highpass';hp.frequency.value=1500;
   const pk=AC.createBiquadFilter();pk.type='peaking';pk.frequency.value=5200;pk.Q.value=0.7;pk.gain.value=6;const lp=AC.createBiquadFilter();lp.type='lowpass';lp.frequency.value=7000;
   const g=AC.createGain();g.gain.value=0;s.connect(hp).connect(pk).connect(lp).connect(g).connect(master);s.start(0,0.7);
   let v=0,HV=0.026;hissLevel=x=>{if(Math.abs(x-v)<0.02)return;const up=x>v;v=x;const t=AC.currentTime;g.gain.setTargetAtTime(x*HV,t,up?0.012:0.06);lp.frequency.setTargetAtTime(4200+x*6500,t,0.04);};
   LOOPS.hiss=(buf,L)=>{s.stop();loopSrc(buf,L,lp);HV=0.2;v=-1;};}
  // ambience: detuned low drones + slow filtered wind
  const amb=AC.createGain();amb.gain.value=0.045;amb.connect(master);
  for(const fr of [55,55.6,82.4]){const o=AC.createOscillator();o.frequency.value=fr;o.connect(amb);o.start();}
  const wn=AC.createBufferSource();wn.buffer=NOISE;wn.loop=true;const wf=AC.createBiquadFilter();wf.type='lowpass';wf.frequency.value=260;
  const lfo=AC.createOscillator();lfo.frequency.value=0.07;const lg=AC.createGain();lg.gain.value=140;lfo.connect(lg).connect(wf.frequency);lfo.start();
  const wg=AC.createGain();wg.gain.value=0.7;wn.connect(wf).connect(wg).connect(amb);wn.start();
  musicGain=AC.createGain();musicGain.gain.value=0.1;musicGain.connect(master);musicT=AC.currentTime+0.3;
}catch(e){AC=null;}}
let PJ=1;
function tone(type,f0,f1,dur,vol,when=0){const t=AC.currentTime+when,o=AC.createOscillator(),g=AC.createGain();if(type==='square'){type='triangle';vol*=1.4;}o.type=type;f0*=PJ;f1*=PJ;
  o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(f1,t+dur);
  g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);let sn=o;if(type==='sawtooth'){const f=AC.createBiquadFilter();f.type='lowpass';f.frequency.value=1900;o.connect(f);sn=f;}sn.connect(g).connect(master);o.start(t);o.stop(t+dur+0.02);}
function noise(dur,vol,freq,type,when=0){const t=AC.currentTime+when,s=AC.createBufferSource();s.buffer=NOISE;const f=AC.createBiquadFilter();f.type=type;f.frequency.value=freq;
  const g=AC.createGain();g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);s.connect(f).connect(g).connect(master);s.start(t,Math.random()*1.5);s.stop(t+dur+0.02);}
function toneF(type,f0,f1,dur,vol,lp0,lp1,when=0){const t=AC.currentTime+when,o=AC.createOscillator(),f=AC.createBiquadFilter(),g=AC.createGain();o.type=type;f0*=PJ;f1*=PJ;
  o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(f1,t+dur);f.type='lowpass';f.Q.value=2;f.frequency.setValueAtTime(lp0,t);f.frequency.exponentialRampToValueAtTime(lp1,t+dur);
  g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+0.004);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);o.connect(f).connect(g).connect(master);o.start(t);o.stop(t+dur+0.02);}
function noiseQ(dur,vol,freq,q,when=0){const t=AC.currentTime+when,s=AC.createBufferSource();s.buffer=NOISE;const f=AC.createBiquadFilter();f.type='bandpass';f.frequency.value=freq*PJ;f.Q.value=q;
  const g=AC.createGain();g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);s.connect(f).connect(g).connect(master);s.start(t,Math.random()*1.5);s.stop(t+dur+0.02);}
let hissLevel=()=>{};document.addEventListener('visibilitychange',()=>{if(document.hidden){hissLevel(0);if(weldG)weldG.gain.value=0;}});
// recorded effects (assets/sfx.js, ElevenLabs): 1-4 takes per sound, a different take each time, pitched a few %; anything missing falls back to the synth
let SFXB=null,SFXL=null;const SFXLAST={};
// game sound -> [recorded take, volume, playback rate, also play the synth layer, minimum distance volume]
const SFXMAP={shot:['shot',0.42,1],shotBig:['shotBig',0.6,1],hit:['hit',0.5,1],crit:['hit',0.6,1.12,1],kill:['kill',0.62,1],
  roar:['roar',0.85,1,0,0.7],impact:['impact',1.0,1],spit:['spit',0.55,1],splat:['spit',0.26,1.3],tss:['tss',0.13,1],dash:['tss',0.28,0.82],
  nest:['roar',0.45,0.8,0,0.5],crack:['impact',0.28,1.6],boom:['impact',0.55,0.85]};
async function loadSfx(){if(SFXB||!AC)return;SFXB={};
  try{const m=await loadMod('assets/sfx.js');const D=m.default;SFXL=D.__loop||{};
    const F=assetBufs(D);for(const id of Object.keys(F))SFXB[id]=await Promise.all(F[id].map(q=>q.then(b=>AC.decodeAudioData(b))));
    for(const id in SFXL)if(SFXB[id]&&LOOPS[id])LOOPS[id](SFXB[id][0],SFXL[id]);}
  catch(e){console.warn('sfx samples unavailable',e);}}
function playTake(k,i,vol,rate=1){const s=AC.createBufferSource(),g=AC.createGain();s.buffer=SFXB[k][i];s.playbackRate.value=rate;g.gain.value=vol;s.connect(g).connect(master);s.start();return {s,g};}
function playS(k,vol,rate=1){const vs=SFXB&&SFXB[k];if(!vs||!vs.length)return null;let i=Math.floor(Math.random()*vs.length);if(vs.length>1&&i===SFXLAST[k])i=(i+1)%vs.length;SFXLAST[k]=i;
  return playTake(k,i,vol,rate*PJ);}
const MUSICAL=new Set(['alarm','repaired','perfect','win','deposit','full','alert','combo','power','reload','drop']);
function sfx(k,pos){if(!AC)return;const v=pos?Math.max(0.15,1-pos.distanceTo(P.pos)/30):1;PJ=MUSICAL.has(k)?1:1+(Math.random()-0.5)*0.09;{const M=SFXMAP[k];if(M&&playS(M[0],M[1]*Math.max(v,M[4]||0),M[2])&&!M[3])return;}
  switch(k){
    case 'shot':noise(0.014,0.14,6500,'highpass');toneF('sawtooth',1500,190,0.1,0.07,7000,700);tone('sine',150,46,0.11,0.17);noiseQ(0.16,0.035,1900,1.4,0.01);break;
    case 'hit':noiseQ(0.045,0.16*v,2600,2.2);toneF('square',340,120,0.06,0.06*v,3000,500);tone('sine',210,90,0.07,0.1*v);break;
    case 'kill':noise(0.3,0.3*v,900,'lowpass');tone('sine',110,35,0.35,0.35*v);toneF('sawtooth',260,55,0.22,0.1*v,2500,300);for(let i=0;i<4;i++)noiseQ(0.03,0.09*v,1800+i*700,3,0.02+i*0.035+Math.random()*0.02);break;
    case 'alarm':for(let i=0;i<2;i++){tone('square',740,740,0.11,0.045,i*0.26);tone('square',540,540,0.11,0.045,i*0.26+0.13);}break;
    case 'chew':noise(0.06,0.045*v,1800,'bandpass');break;
    case 'crack':noise(0.3,0.2*v,600,'lowpass');tone('sawtooth',90,40,0.3,0.12*v);break;
    case 'thump':tone('sine',78,38,0.22,0.2*v);noise(0.12,0.06*v,240,'lowpass');break;
    case 'overheat':tone('sawtooth',520,140,0.35,0.07);noise(0.25,0.06,2600,'highpass');break;
    case 'reload':tone('square',220,660,0.22,0.04);tone('sine',440,880,0.3,0.04,0.25);break;
    case 'nest':tone('sawtooth',110,55,0.9,0.16);tone('square',82,41,0.9,0.07);break;
    case 'weld':noise(0.025+Math.random()*0.05,0.025+Math.random()*0.03,3500+Math.random()*3500,'highpass');if(Math.random()<0.5)toneF('sawtooth',118,104,0.1,0.016,1600,700);break;
    case 'repaired':[660,880].forEach((f,i)=>tone('triangle',f,f,0.12,0.09,i*0.09));break;
    case 'perfect':[784,1046,1318].forEach((f,i)=>tone('triangle',f,f*1.01,0.16,0.11,i*0.07));break;
    case 'jam':tone('square',120,90,0.25,0.12);break;
    case 'tss':noiseQ(0.06,0.07,1300,1.2);noise(0.22,0.05,3800,'highpass');break;
    case 'dash':noiseQ(0.08,0.12,1100,1);noise(0.45,0.09,3200,'highpass');tone('sine',260,600,0.18,0.04);break;
    case 'shotBig':noise(0.02,0.2,5000,'highpass');toneF('sawtooth',900,70,0.2,0.1,5000,300);noise(0.14,0.18,900,'lowpass');tone('sine',100,34,0.24,0.28);noiseQ(0.3,0.05,1400,1,0.02);break;
    case 'roar':tone('sawtooth',140,62,1.1,0.16);tone('square',95,48,1.0,0.08);noise(1.0,0.12,700,'bandpass');tone('sawtooth',210,120,0.5,0.06,0.1);break;
    case 'silk':noise(0.12,0.05,5200,'highpass');tone('sine',2200,900,0.1,0.025);break;
    case 'impact':tone('sawtooth',90,28,0.9,0.22);tone('sine',60,22,1.1,0.32);noise(0.7,0.3,500,'lowpass');noise(0.25,0.18,2600,'bandpass');break;
    case 'boom':tone('sawtooth',160,40,0.35,0.18*v);tone('sine',90,30,0.4,0.25*v);break;
    case 'pick':tone('sine',1300,1800,0.05,0.03);break;
    case 'leap':tone('sawtooth',90,240,0.25,0.06*v);break;
    case 'hurt':tone('square',140,60,0.25,0.2);break;
    case 'win':[523,659,784,1046].forEach((f,i)=>tone('triangle',f,f*1.01,0.4,0.13,i*0.13));break;
    case 'deposit':{const k=P.depStart?1-P.carry/Math.max(1,P.depStart):0.5;tone('sine',620+k*520,900+k*600,0.07,0.045);break;}
    case 'full':tone('square',880,880,0.09,0.06);tone('square',660,660,0.12,0.06,0.11);break;
    case 'spill':tone('sawtooth',600,90,0.45,0.12);break;
    case 'steal':tone('sawtooth',300,120,0.5,0.12);tone('square',240,90,0.5,0.05,0.05);break;
    case 'alert':for(let i=0;i<3;i++)tone('square',i%2?900:1200,i%2?900:1200,0.06,0.05,i*0.09);break;
    case 'grab':tone('triangle',500,1400,0.2,0.08*v);break;
    case 'crit':tone('square',1900,2700,0.05,0.06*v);tone('triangle',950,320,0.12,0.15*v);noise(0.04,0.1*v,6000,'highpass');break;
    case 'combo':[880,1175,1568].forEach((f,i)=>tone('square',f,f,0.07,0.05,i*0.055));break;
    case 'drop':tone('sine',600,1500,0.35,0.09);tone('triangle',1200,1800,0.2,0.04,0.12);break;
    case 'power':[392,523,659,784,1046].forEach((f,i)=>tone('triangle',f,f*1.02,0.24,0.1,i*0.05));break;
    case 'zap':noise(0.6,0.32,2600,'bandpass');tone('sawtooth',62,38,0.55,0.22);tone('square',1400,180,0.35,0.06);break;
    case 'sizzle':noise(0.4,0.07,6500,'highpass');noise(0.25,0.05,2200,'bandpass',0.1);break;
    case 'gurgle':noise(0.9,0.16*v,320,'lowpass');tone('sawtooth',70,140,0.9,0.1*v);tone('sine',180,420,0.9,0.05*v);break;
    case 'spit':noise(0.25,0.3*v,900,'bandpass');tone('sawtooth',260,70,0.3,0.14*v);break;
    case 'splat':noise(0.35,0.25*Math.max(0.3,v),600,'lowpass');tone('sine',140,45,0.3,0.15*Math.max(0.3,v));break;
    case 'chitter':for(let i=0;i<4;i++)tone('square',2400+Math.random()*900,1800,0.03,0.035*v,i*0.06);break;
  }}
// music: a tense 16-step pulse that adds layers each round and speeds up for the evacuation
const BASS=[0,0,12,0,3,0,12,0,5,0,12,0,3,0,10,7];
function musicStep(time,step,lvl){
  const f=55*Math.pow(2,BASS[step%16]/12);
  const o=AC.createOscillator(),g=AC.createGain(),lp=AC.createBiquadFilter();o.type='sawtooth';o.frequency.value=f;lp.type='lowpass';lp.frequency.value=300+lvl*140;
  g.gain.setValueAtTime(0.0001,time);g.gain.exponentialRampToValueAtTime(0.5,time+0.01);g.gain.exponentialRampToValueAtTime(0.0001,time+0.22);
  o.connect(lp).connect(g).connect(musicGain);o.start(time);o.stop(time+0.25);
  if(lvl>=1&&step%2===1){const s=AC.createBufferSource();s.buffer=NOISE;const hp=AC.createBiquadFilter();hp.type='highpass';hp.frequency.value=7000;const hg=AC.createGain();
    hg.gain.setValueAtTime(0.16,time);hg.gain.exponentialRampToValueAtTime(0.0001,time+0.05);s.connect(hp).connect(hg).connect(musicGain);s.start(time,Math.random());s.stop(time+0.06);}
  if(lvl>=2&&step%8===0){const k=AC.createOscillator(),kg=AC.createGain();k.frequency.setValueAtTime(120,time);k.frequency.exponentialRampToValueAtTime(40,time+0.15);
    kg.gain.setValueAtTime(0.8,time);kg.gain.exponentialRampToValueAtTime(0.0001,time+0.2);k.connect(kg).connect(musicGain);k.start(time);k.stop(time+0.22);}
  if(lvl>=3&&step%4===2){const a=AC.createOscillator(),ag=AC.createGain();a.type='triangle';a.frequency.value=f*4*(step%8===2?1:1.5);
    ag.gain.setValueAtTime(0.0001,time);ag.gain.exponentialRampToValueAtTime(0.2,time+0.01);ag.gain.exponentialRampToValueAtTime(0.0001,time+0.3);a.connect(ag).connect(musicGain);a.start(time);a.stop(time+0.32);}}
function updateMusic(){if(!AC)return;voTick();const duck=AC.currentTime<VOQ.until?0.35:1;musicGain.gain.value=THREE.MathUtils.damp(musicGain.gain.value,(musicOn&&state==='play')?0.1*duck:0,6,0.016);if(state!=='play')return;
  const lvl=Math.min(4,Math.floor(wave/2));const spb=60/(92+lvl*9)/4;
  if(musicT<AC.currentTime)musicT=AC.currentTime+0.05;
  while(musicT<AC.currentTime+0.2){musicStep(musicT,beat++,lvl);musicT+=spb;}}

