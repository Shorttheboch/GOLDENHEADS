/* ================= DASHBOARD ================= */
const dash={s:0,suit:-1,hull:-1,pulse:0,hull25:false,leakT:0,tnT:0};
function fitDash(){const w=$('dash').clientWidth;if(w)$('dash').style.setProperty('--s',w/2172);}
addEventListener('resize',fitDash);
const SEG0=8.6,SEG1=159;   // the gauge's lit arc, degrees clockwise from 12 o'clock (measured on the art)
function updateDash(t,loose){
  if(!dash.s){fitDash();dash.s=1;}
  const hp=P.hp/CFG.hpMax,el=$('dash');
  // suit gauge: conic mask over the segment layer, from the first segment to the share of suit left
  const a=SEG0+(SEG1-SEG0)*Math.max(0,hp),m=`conic-gradient(from 0deg at 19.1% 54.6%, #000 0deg ${a}deg, transparent ${a+0.01}deg)`;
  const sg=$('dSegs').style;sg.maskImage=sg.webkitMaskImage=m;
  const sp=Math.ceil(P.hp);if(sp!==dash.suit){dash.suit=sp;$('dSuit').innerHTML=sp+'<small>%</small>';}
  el.classList.toggle('low',hp<0.3);
  // heartbeat: faster and redder as the suit fails
  const bpm=70+(1-hp)*90;dash.pulse+=(bpm/60)*0.016;let d='';
  for(let i=0;i<=100;i++){const u=i/100,ph=(u*2.2+dash.pulse)%1;let y=0;
    if(ph>0.45&&ph<0.5)y=-8;else if(ph>=0.5&&ph<0.55)y=30;else if(ph>=0.55&&ph<0.6)y=-32;else if(ph>=0.6&&ph<0.66)y=10;else if(ph>0.75&&ph<0.85)y=-6*Math.sin((ph-0.75)/0.1*Math.PI);
    d+=(i?'L':'M')+(u*300).toFixed(1)+' '+(44-y*(0.8+0.2*(1-hp))).toFixed(1);}
  $('dPulse').firstChild.setAttribute('d',d);
  // tank
  $('dTank').textContent=`${P.carry} / ${CFG.tankCap}`;$('dTankBar').firstChild.style.width=(P.carry/CFG.tankCap*100)+'%';$('dTankBar').classList.toggle('full',P.carry>=CFG.tankCap);
  // ship + zones
  const sh=shipHp();$('dShip').textContent=Math.round(sh*100)+'%';
  const blink=(t*4|0)%2===0;let alert='';
  for(const Z of ZONES){const h=zoneHp(Z),z=$('dz'+Z.idx);z.lastChild.firstChild.style.width=(h*100)+'%';
    z.className='dz'+(Z.nest?' nest':'')+(Z.eaters>0&&blink?' bit':'')+(h<0.3?' low':h<0.65?' mid':'');z.firstChild.style.opacity=Z.nest?1:0.45+0.55*h;
    if(Z.eaters>0&&!alert)alert='¡'+Z.name+'!';}
  if(!alert){const n=ZONES.find(Z=>Z.nest);if(n)alert='NIDO · '+n.name;}
  $('dShipAlert').textContent=alert&&(blink||!alert.startsWith('¡'))?alert:'';
  // round / spiders
  const left=spiders.length+toSpawn,calm=WB.calm&&!inBreak;el.classList.toggle('brk',inBreak||calm);
  $('dRound').textContent=inBreak?'RESPIRO':calm?'CALMA':'RONDA '+(wave+1);$('dSpN').textContent=inBreak?Math.ceil(Math.max(0,breakT))+' s':calm?Math.ceil(Math.max(0,WB.lull))+' s':left;
  for(let k=0;k<4;k++){const d=$('dsp'+k);const show=!inBreak&&!calm&&(k<3?left>k:left>3);d.style.visibility=show?'visible':'hidden';
    if(k===3){const more=left>4;if(more&&!d.dataset.more){d.dataset.more=1;d.innerHTML='';}if(!more&&d.dataset.more){delete d.dataset.more;d.innerHTML=$('dsp0').innerHTML;}if(more)d.textContent='+'+(left-3);}}
  $('dr0').lastChild.textContent=cargo;$('dr1').lastChild.textContent=loose;$('dr2').lastChild.textContent=lostN;
  // status voices
  if(state==='play'){
    if(sh<0.25&&!dash.hull25){dash.hull25=true;say('hull_25',4);}else if(sh>0.4)dash.hull25=false;
    if(loose>40)say('cg_leak_big',2,{cd:45});
    if(!inBreak&&spiders.length>0&&AC&&AC.currentTime-VOQ.lastEnd>25&&Math.random()<0.004)say(Math.random()<0.5?'tn_01':'tn_02',1,{cd:60});}}

