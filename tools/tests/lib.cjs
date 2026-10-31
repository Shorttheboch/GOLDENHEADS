// Shared bits for the automatic tests (Playwright + Chromium with the software GPU).
const path=require('path');
const BASE=process.env.HEADS_URL||'http://127.0.0.1:8765';
const OUT=process.env.HEADS_OUT||path.join(__dirname,'out');
const ARGS=['--disable-audio-output','--disable-gpu-watchdog','--js-flags=--max-old-space-size=1500','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'];
const shot=n=>path.join(OUT,n);
// v74: crab, egg, EXTRA POWER pistol and Incineradora download in the background after JUGAR is enabled (src/game/28-load.js, LATE in 13-spiders.js).
// Tests that bring in a spitter, an Incineradora, an egg or EXTRA POWER wait for them first.
const lateReady=p=>p.waitForFunction(()=>window.__late&&Object.values(window.__late.s).every(v=>v!==0),null,{timeout:300000});
module.exports={BASE,OUT,ARGS,shot,lateReady,ROOT:path.join(__dirname,'..','..')};
