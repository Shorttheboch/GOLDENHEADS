// ---- start-menu machinery sounds (v70) + menu music (v73) ----
// window.menuSfx(name, vol=1, rate=1): name = logo | land | bar | unfold | lock | button | decode (assets/sfx/menu/*.mp3; the key -> file table is FILES below).
// window.menuSfx.fade(name, seconds) fades out a sound that is still playing (v73: the decoder is cut gracefully when the headers finish decoding).
// Their own small AudioContext (the game's one only exists after JUGAR). Quiet on purpose: master 0.35.
// Browsers keep audio locked until a user gesture: the first pointer / touch / key press resumes it (inside the gesture, as iOS needs).
// A cue that fires while the context is not running is SKIPPED (never played late, never queued).
// Once the menu is hidden (JUGAR) it stops and closes its context. It never throws.
//
// v73 menu music: window.menuMusic(true|false) · window.menuMusic() = is it playing · window.menuMusic.info().
// assets/music/menu.mp3 (~60 s, baked so its end flows into its start) is fetched and decoded with the effects (60 s of PCM is ~21 MB; the long
// game file is streamed instead) and looped on the same context. It starts at the first user gesture (no AudioContext exists before one, so it is
// silent until then), fades in over 1.5 s and sits low (MUSIC_VOL, a bit under the machinery cues, which stay on top). JUGAR hides the menu:
// it fades out over 0.8 s and only then closes the context (the opening film starts right after JUGAR, so it is gone before the film is heard).
// A hidden tab suspends it. Switch it off with window.__noMenuMusic=1 before the page loads (tests).
(function(){
  // sound key (what the menus call) -> file in assets/sfx/menu/. unfold, lock and decode are Santi's recordings (v73), named after what they are:
  // metro = a tape measure pulled out (the panel unfolds), arma-juguete = a toy gun cocking (the panel locks in), decoder = sci-fi text decoding (the headers).
  // logo, land, bar and button are the synthesized ones of v70 (tools/menu-sfx/synth_menu_sfx.py).
  var FILES={logo:'logo',land:'land',bar:'bar',unfold:'metro',lock:'arma-juguete',button:'button',decode:'decoder'};
  var NAMES=Object.keys(FILES),MASTER=0.35;
  var LIVE={}; // sources still sounding, by key (menuSfx.fade needs them)
  var MUSIC_URL='assets/music/menu.mp3',MUSIC_VOL=0.16,FADE_IN=1.5,FADE_OUT=0.8;
  var AC=null,mg=null,bufs={},raw={},dead=false,muted=false,resuming=0,LOG=[];
  var mBuf=null,mRaw=null,mSrc=null,mGain=null,mFade=null,mCtx=null,mWant=true,mOut=0;
  var Ctor=window.AudioContext||window.webkitAudioContext,Off=window.OfflineAudioContext||window.webkitOfflineAudioContext;
  function note(n,ok,why){try{LOG.push({n:n,t:Math.round(performance.now()),ok:ok?1:0,why:why||''});if(LOG.length>60)LOG.shift();}catch(e){}return ok;}
  function dec(ctx,ab){return new Promise(function(res,rej){try{var p=ctx.decodeAudioData(ab,res,rej);if(p&&p.catch)p.catch(rej);}catch(e){rej(e);}});}
  function noop(){}
  // fetch the six small files now; decode them without a (locked) realtime context
  function load(){
    if(!Ctor||typeof fetch!=='function')return;
    NAMES.forEach(function(n){
      try{fetch(new URL('assets/sfx/menu/'+FILES[n]+'.mp3',document.baseURI)).then(function(r){return r.ok?r.arrayBuffer():Promise.reject(r.status);}).then(function(ab){
        raw[n]=ab.slice(0);
        return (Off?dec(new Off(1,44100,44100),ab):Promise.reject()).then(function(b){bufs[n]=b;delete raw[n];},function(){
          if(AC&&!bufs[n])return dec(AC,raw[n].slice(0)).then(function(b){bufs[n]=b;}); // no offline decoder: decode on the real context
        });
      }).catch(function(){});}catch(e){}
    });
    loadMusic();
  }
  // the menu song: same idea (offline decode, no gesture needed); it starts when both the buffer and the (unlocked) context are there
  function loadMusic(){
    if(!Ctor||typeof fetch!=='function'||window.__noMenuMusic)return;
    try{fetch(new URL(MUSIC_URL,document.baseURI)).then(function(r){return r.ok?r.arrayBuffer():Promise.reject(r.status);}).then(function(ab){
      mRaw=ab.slice(0);
      return (Off?dec(new Off(2,44100,44100),ab):Promise.reject()).then(function(b){mBuf=b;mRaw=null;musicBegin();},function(){
        if(AC&&!mBuf&&mRaw)return dec(AC,mRaw.slice(0)).then(function(b){mBuf=b;mRaw=null;musicBegin();});
      });
    }).catch(function(){});}catch(e){}
  }
  function musicBegin(){
    try{
      if(dead||!mWant||mSrc||!AC||!mBuf||window.__noMenuMusic||AC.state==='closed')return;
      mGain=AC.createGain();mGain.gain.value=0;mGain.connect(AC.destination); // straight to the output: the effects' master (0.35) is for the effects only
      mSrc=AC.createBufferSource();mSrc.buffer=mBuf;mSrc.loop=true;mSrc.connect(mGain);mSrc.start(0);
      mGain.gain.setTargetAtTime(MUSIC_VOL,AC.currentTime,FADE_IN/3); // if the context is still waking up its clock is at 0: the fade starts when it runs
      mCtx=AC;mFade=mGain;
    }catch(e){mSrc=null;mGain=null;}
  }
  // fade the song out (FADE_OUT) and stop it; the caller closes the context later when it is the end of the menu
  function musicHalt(c){
    var s=mSrc,g=mGain;mSrc=null;mGain=null;if(!s||!c)return false;
    try{var t=c.currentTime;g.gain.cancelScheduledValues(t);g.gain.setTargetAtTime(0,t,FADE_OUT/4.5);s.stop(t+FADE_OUT+0.1);}catch(e){}
    mOut=performance.now();return true;
  }
  function ensure(){
    if(AC||dead||!Ctor)return;
    try{
      AC=new Ctor();mg=AC.createGain();mg.gain.value=MASTER;mg.connect(AC.destination);
      NAMES.forEach(function(n){if(!bufs[n]&&raw[n])dec(AC,raw[n].slice(0)).then(function(b){bufs[n]=b;}).catch(function(){});}); // no offline decoder: decode here
      if(!mBuf&&mRaw&&!window.__noMenuMusic)dec(AC,mRaw.slice(0)).then(function(b){mBuf=b;mRaw=null;musicBegin();}).catch(function(){});
    }catch(e){AC=null;}
  }
  function unlock(){
    if(dead)return;
    try{
      ensure();if(!AC||AC.state==='closed')return;
      musicBegin(); // first gesture: the song begins (idempotent)
      if(AC.state==='running')return;
      resuming=performance.now();var p=AC.resume();if(p&&p.catch)p.catch(noop);
      try{var s=AC.createBufferSource();s.buffer=AC.createBuffer(1,1,22050);s.connect(AC.destination);s.start(0);}catch(e){} // iOS: a silent blip inside the gesture
    }catch(e){}
  }
  function stop(){
    if(dead)return;dead=true;
    for(var i=0;i<GEST.length;i++)document.removeEventListener(GEST[i],unlock,true);
    try{if(AC&&AC.state!=='closed'){var c=AC,had=musicHalt(c);
      if(had)setTimeout(function(){try{c.close().catch(noop);}catch(e){}},Math.round(FADE_OUT*1000)+250); // let the song finish fading
      else c.close().catch(noop);}}catch(e){}
    AC=null;mg=null;bufs={};raw={};LIVE={};mBuf=null;mRaw=null;
  }
  function play(name,vol,rate){
    try{
      if(dead||muted||window.__noMenuSfx)return note(name,0,'off');
      if(document.hidden)return note(name,0,'hidden');
      if(!AC)return note(name,0,'no-gesture');
      if(AC.state!=='running')return note(name,0,'locked');
      var b=bufs[name];if(!b)return note(name,0,'no-buffer');
      var s=AC.createBufferSource(),g=AC.createGain();
      s.buffer=b;if(rate>0&&rate!==1)s.playbackRate.value=rate;
      g.gain.value=vol>=0?Math.min(vol,2):1;s.connect(g);g.connect(mg);s.start(0);
      LIVE[name]={s:s,g:g};s.onended=function(){if(LIVE[name]&&LIVE[name].s===s)delete LIVE[name];};
      return note(name,1);
    }catch(e){return note(name,0,'error');}
  }
  // menuSfx.fade(name, seconds): fades a sound that is still playing out and stops it (the text decoder is longer than the text decoding on screen)
  function fade(name,sec){
    try{
      var l=LIVE[name];if(!l||!AC||dead)return false;delete LIVE[name];
      var t=AC.currentTime,g=l.g.gain;g.cancelScheduledValues(t);g.setValueAtTime(g.value,t);g.linearRampToValueAtTime(0,t+sec);l.s.stop(t+sec+0.02);
      return true;
    }catch(e){return false;}
  }
  var GEST=['pointerdown','pointerup','touchend','click','keydown'];
  window.menuSfx=function(name,vol,rate){return play(name,vol,rate);};
  window.menuSfx.mute=function(on){muted=!!on;};
  window.menuSfx.fade=fade;
  window.menuSfx.stop=stop;
  window.menuSfx.log=LOG;
  window.menuSfx.info=function(){return {state:AC?AC.state:'none',buffers:Object.keys(bufs).length,dead:dead,muted:muted,resumed:resuming};};
  // menuMusic(true) starts the song (once the first gesture has unlocked audio), menuMusic(false) fades it out; no argument = is it playing
  window.menuMusic=function(on){
    if(on===undefined)return !!mSrc;
    mWant=!!on;
    if(mWant)musicBegin();else musicHalt(AC||mCtx);
    return !!mSrc;
  };
  window.menuMusic.info=function(){var c=AC||mCtx,g=mGain||mFade;
    return {playing:!!mSrc,fading:!mSrc&&mOut>0&&performance.now()-mOut<FADE_OUT*1000+300,loaded:!!mBuf,want:mWant,state:c?c.state:'none',gain:g?+g.gain.value.toFixed(4):0,vol:MUSIC_VOL,dead:dead};};
  try{
    for(var i=0;i<GEST.length;i++)document.addEventListener(GEST[i],unlock,{capture:true,passive:true});
    // a hidden tab: the song rests (suspended context) and comes back with the tab; the effects already skip themselves while hidden
    document.addEventListener('visibilitychange',function(){
      if(dead||!AC||!mSrc)return;
      try{if(document.hidden){if(AC.state==='running')AC.suspend().catch(noop);}else if(AC.state==='suspended')AC.resume().catch(noop);}catch(e){}
    });
    // the game starts (JUGAR hides the whole start menu): the song fades out, then the audio is freed
    var watch=function(){var m=document.getElementById('menu');if(!m||typeof MutationObserver!=='function')return;
      new MutationObserver(function(){if(m.hidden)stop();}).observe(m,{attributes:true,attributeFilter:['hidden']});};
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){watch();load();});else{watch();load();}
  }catch(e){}
})();
