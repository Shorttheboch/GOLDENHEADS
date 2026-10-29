// Shared bits for the automatic tests (Playwright + Chromium with the software GPU).
const path=require('path');
const BASE=process.env.HEADS_URL||'http://127.0.0.1:8765';
const OUT=process.env.HEADS_OUT||path.join(__dirname,'out');
const ARGS=['--disable-audio-output','--disable-gpu-watchdog','--js-flags=--max-old-space-size=1500','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'];
const shot=n=>path.join(OUT,n);
module.exports={BASE,OUT,ARGS,shot,ROOT:path.join(__dirname,'..','..')};
