/* ================= CONFIG (tuning) ================= */
const CFG={
  hpMax:100, regenDelay:6, regenRate:9,           // suit heals itself after a few quiet seconds
  thrust:15.5, boost:1.6, damping:1.6, maxSpeed:9.8, dashSpeed:17, dashCD:1.0,
  bulletSpeed:70, fireRate:0.16, bulletDmg:1,
  crawlSpeed:3.2, leapSpeed:15,
  suckRange:10, suckCos:Math.cos(THREE.MathUtils.degToRad(32)),
  // cargo: the trichomes start on board; holes in the hull let them escape into space
  cargo:1000, tankCap:60, depositR:3.2, depositRate:28, spillFrac:0.35,
  drift:0.3, lostR:42, intakeRate:14,
  // hull: 4 zones x 4 patches; spiders chew patches open, the astronaut welds them shut
  patchHp:25, repairTime:2.0, repairR:3.8, bandW:0.15, leakPerHp:0.8, bodegaLeak:1.6, breakTime:12,
  camLag:7, gunCap:30, gunRegen:15, gunDelay:0.5, gunLock:1.3, reloadT:1.0,
  worldV:0.6,   // the ship cruises forward (+Z) this slowly: rocks, dust and loose cargo stream past toward the tail
  lullTime:7, floatLife:30, puLife:15, packR:8, packT:15,   // calm between bursts · floating cargo is lost after 30 s · prizes vanish after 15 s
};
const $=id=>document.getElementById(id);
const FLOW={dz:0};
const AS=0.88; // astronaut scale (a little smaller: the ship reads bigger, the spiders scarier)
const isTouch=matchMedia('(pointer:coarse)').matches; // v54: primary pointer only: a touch laptop used with a mouse stays PC
if(isTouch)document.body.classList.add('touch');
if(isTouch){$('keysPC').hidden=true;$('keysTouch').hidden=false;}

