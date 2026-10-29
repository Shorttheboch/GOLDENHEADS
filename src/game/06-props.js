/* ================= WORLD PROPS ================= */
const GASH=new THREE.Vector3(0,3.77,2); // torn hull area (top, midship)
const HATCH=new THREE.Vector3(4.5,-0.25,2.7); // side hatch
const world=new THREE.Group();scene.add(world);
const ROTORS=[]; // spinning ship parts (tail fan, turbines, spinners)
// floating hull fragments
const shards=[];
{const mat=new THREE.MeshStandardMaterial({color:0xd9a441,metalness:1,roughness:0.28,flatShading:true});
 for(let i=0;i<16;i++){const g=new THREE.TetrahedronGeometry(0.3+Math.random()*0.7,0);g.scale(1,0.18,0.8);const m=new THREE.Mesh(g,mat);
  m.position.copy(GASH).add(new THREE.Vector3((Math.random()-0.5)*10,1.5+Math.random()*6,(Math.random()-0.5)*12));
  m.userData.spin=new THREE.Vector3(Math.random(),Math.random(),Math.random()).multiplyScalar(0.6);world.add(m);shards.push(m);}}
// hatch ring
const hatchRing=new THREE.Mesh(new THREE.TorusGeometry(0.95,0.07,8,40),new THREE.MeshBasicMaterial({color:0x7fffd0}));
hatchRing.position.copy(HATCH);hatchRing.rotation.y=Math.PI/2;world.add(hatchRing);
const hatchLight=new THREE.PointLight(0x7fffd0,0,6,2);hatchLight.position.copy(HATCH).add(new THREE.Vector3(0.6,0,0));world.add(hatchLight);

