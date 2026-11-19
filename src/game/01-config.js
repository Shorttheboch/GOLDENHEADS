/* ================= CONFIG (tuning) ================= */
const CFG={
  hpMax:100, regenDelay:6, regenRate:9,           // suit heals itself after a few quiet seconds
  thrust:15.5, boost:1.6, damping:1.6, maxSpeed:9.8, dashSpeed:17, dashCD:1.0,
  bulletSpeed:70, fireRate:0.16, bulletDmg:1,
  crawlSpeed:3.2, leapSpeed:15,
  suckRange:10, suckCos:Math.cos(THREE.MathUtils.degToRad(32)),
  // cargo: the trichomes start on board; holes in the hull let them escape into space
  cargo:1000, tankCap:60, depositR:3.2, depositRate:28, spillFrac:0.35,
  drift:0.3, lostR:42, intakeRate:20,
  // hull: 4 zones x 4 patches; spiders chew patches open, the astronaut welds them shut
  patchHp:25, repairTime:2.0, repairR:3.8, bandW:0.15, leakPerHp:0.8, bodegaLeak:1.6, breakTime:12,
  camLag:7, gunCap:30, gunRegen:15, gunDelay:0.5, gunLock:1.3, reloadT:1.0,
  worldV:0.6,   // the ship cruises forward (+Z) this slowly: rocks, dust and loose cargo stream past toward the tail
  lullTime:7, floatLife:30, puLife:15, packR:8, packT:15,   // calm between bursts · floating cargo is lost after 30 s · prizes vanish after 15 s
};
const $=id=>document.getElementById(id);
// v93 (performance): the HUD is HTML, and three things made the browser restyle and lay out the WHOLE page several times every frame
// (measured: ~170 elements a frame on PC, ~1,400 on phones, over half of the frame's CPU time there):
// 1) the game sets `el.hidden=…` on dozens of elements every frame, mostly to the value they already have, and the browser still counts each one
//    as a change: now writing the same value does nothing;
// 2) CSS rules written `body:has(#menu:not([hidden])) …` made every one of those changes restyle everything under <body>: the menu being up is
//    now a class on <body> (`menuOn`, kept in step with #menu here, whoever hides it). No rule may start with `body:has(` again;
// 3) reading innerWidth / innerHeight in the middle of a frame forces a layout: the window size is kept in VW / VH (updated on resize).
{const d=Object.getOwnPropertyDescriptor(HTMLElement.prototype,'hidden');
 if(d&&d.set&&d.get)Object.defineProperty(HTMLElement.prototype,'hidden',{configurable:true,enumerable:d.enumerable,get:d.get,set(v){if(!!d.get.call(this)!==!!v)d.set.call(this,v);}});}
{const m=$('menu'),f=()=>document.body.classList.toggle('menuOn',!m.hidden);f();new MutationObserver(f).observe(m,{attributes:true,attributeFilter:['hidden']});}
{const x=$('xpT'),f=()=>document.body.classList.toggle('xpTgo',x.classList.contains('go'));if(x){f();new MutationObserver(f).observe(x,{attributes:true,attributeFilter:['class']});}} // (same for the EXTRA POWER title: `body:has(#xpT.go)` in the CSS)
// 4) the same with texts: `el.textContent=…` every frame with the text it already shows still swapped the text node (and any `body:has()` rule
//    then restyled the page, and in English the translator translated it again, every frame): writing the same text does nothing now.
{const d=Object.getOwnPropertyDescriptor(Node.prototype,'textContent');
 if(d&&d.set&&d.get)Object.defineProperty(Node.prototype,'textContent',{configurable:true,enumerable:d.enumerable,get:d.get,set(v){const c=this.firstChild;
   if(c&&c===this.lastChild&&c.nodeType===3&&v!=null){const t=String(v);if(c.data===t||(c===this._tcN&&t===this._tcV))return;} // (second case: in English the translator has rewritten that same text node in place, public/i18n.js)
   d.set.call(this,v);if(this.nodeType===1){this._tcN=this.firstChild;this._tcV=v==null?'':String(v);}}});}
let VW=innerWidth,VH=innerHeight;addEventListener('resize',()=>{VW=innerWidth;VH=innerHeight;});
const FLOW={dz:0};
const AS=0.88; // astronaut scale (a little smaller: the ship reads bigger, the spiders scarier)
const isTouch=matchMedia('(pointer:coarse)').matches; // v54: primary pointer only: a touch laptop used with a mouse stays PC
if(isTouch)document.body.classList.add('touch');
if(isTouch){$('keysPC').hidden=true;$('keysTouch').hidden=false;}

