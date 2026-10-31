/* ================= PC KEY HINTS (v68, Santi) ================= */
// Bottom left on PC, from the first second of each game: F to weld, SHIFT to boost, right click to vacuum, and "take the trichomes to
// the hold" while you carry some. The one you need right now lights up (a breach close by, a spider about to jump or the laser
// charging, dust within reach, a full tank). Each row goes away once you have done it a few times; from round 4 on they all go.
const PCK={pt:0,n:{},on:{},dcd:0,c0:0,dep:0,near:{},scanT:0,rows:null};
const PCK_NEED={weld:2,dash:3,suck:20,deliver:2};
function pckReset(){PCK.n={weld:0,dash:0,suck:0,deliver:0};PCK.on={weld:1,dash:1,suck:1,deliver:1};PCK.dcd=0;PCK.c0=0;PCK.dep=0;PCK.scanT=0;
  if(PCK.rows)for(const k in PCK.rows){const r=PCK.rows[k];r.classList.remove('out','lit');r.hidden=k==='deliver';}}
function pckFrame(dt){
  if(isTouch)return;const el=$('pcKeys');
  if(!PCK.rows){PCK.rows={};for(const r of el.querySelectorAll('.pk'))PCK.rows[r.dataset.k]=r;pckReset();}
  if(playT<PCK.pt-0.5)pckReset();PCK.pt=playT; // a new game
  if(state!=='play'){el.hidden=true;return;}
  // what you have done in this game
  PCK.n.weld=repairs;
  if(P.dashCD>PCK.dcd+0.5)PCK.n.dash++;PCK.dcd=P.dashCD;
  if(P.carry>PCK.c0&&!P.depActive)PCK.n.suck+=P.carry-PCK.c0;PCK.c0=P.carry;
  if(P.depDone>0&&!PCK.dep)PCK.n.deliver++;PCK.dep=P.depDone>0?1:0;
  const late=wave>=3;
  // what is useful right now (checked a few times a second)
  PCK.scanT-=dt;if(PCK.scanT<=0){PCK.scanT=0.2;const N=PCK.near;
    N.weld=PATCHES.some(pa=>pa.hp<CFG.patchHp&&pa.pos.distanceTo(P.pos)<9);
    N.dash=spiders.some(s=>s.state==='windup'&&s.pos.distanceTo(P.pos)<14)||INCS.some(e=>(e.st==='charge'||e.st==='beamStart'||e.st==='beam')&&e.pos.distanceTo(P.pos)<44);
    N.suck=!!nearestDust(P.pos,10);
    N.deliver=P.carry>=CFG.tankCap;}
  let any=false;
  for(const k in PCK.rows){const r=PCK.rows[k];
    if(PCK.on[k]&&(late||PCK.n[k]>=PCK_NEED[k])){PCK.on[k]=0;if(!r.hidden){r.classList.add('out');setTimeout(()=>{if(!PCK.on[k])r.hidden=true;},450);}}
    if(!PCK.on[k]){if(!r.hidden&&!r.classList.contains('out'))r.hidden=true;continue;}
    const show=k!=='deliver'||(P.carry>0&&!P.depActive&&P.pos.distanceTo(HATCH)>CFG.depositR&&!ZONES[2].nest);
    if(r.hidden===show){r.hidden=!show;r.classList.remove('out');}
    r.classList.toggle('lit',show&&!!PCK.near[k]);if(show)any=true;}
  el.hidden=!any&&!el.querySelector('.pk.out');}
