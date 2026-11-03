/* ================= START AT ANY ROUND (v80) ================= */
// ?ronda=N (or ?round=N) at the end of the address starts every game of that visit straight at round N, to test a round from a link
// (Santi: "poder ver el nivel directamente, en un link"). No opening film and no intro scene: the round begins with its usual "RONDA N" message.
// The bosses count as if rounds 1..N-1 had been played: Escupidoras and Incineradoras already met (their size, strength and II/III… name),
// and the round of the first Escupidora (round 6), which sets the egg calendar. So round 6 brings the first Escupidora with her scene,
// round 8 the first Incineradora with hers and round 9 the first egg. REINTENTAR starts round N again.
// Test games never go to the online ranking and never touch the record. ?ronda=1 (or no number) is a normal game.
const RONDA=(()=>{const m=/[?&](?:ronda|round)=(\d{1,3})(?![\d])/.exec(location.search);const n=m?Math.min(60,Math.max(1,+m[1])):0;return {n:n>1?n:0};})();
if(RONDA.n){opSeen=true;RANK.on=false;}
function rondaStart(){const W0=RONDA.n-1; // wave index of the round to start at
  const hp=hullParam(HATCH);hullPoint(hp.z,hp.th,V1,HATCH_N); // as introStart: the normal of the hold hatch (delivery sparks)
  let sp=0,inc=0;for(let w=5;w<W0;w++){if(isIncRound(w)){inc++;if(isIncAll(w))sp++;}else sp+=w>=9?2:1;} // one Escupidora a round from round 6, two from round 10, none in an Incineradora round before round 14 and one from there on (v83)
  spitN=sp;spitFirstW=W0>5?5:-1;incN=inc;
  CINE.on=false;document.body.classList.remove('cine');P.inv=0;
  startWave(W0);}
