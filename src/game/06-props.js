/* ================= WORLD PROPS ================= */
const HATCH=new THREE.Vector3(4.5,-0.25,2.7); // side hatch
const world=new THREE.Group();scene.add(world);
const ROTORS=[]; // spinning ship parts (tail fan, turbines, spinners)
// (v90: the 16 low-poly gold hull fragments that floated over the spine since the first prototype are gone: the ship gets repaired, so loose
// pieces made no sense. Ideas for later in the design doc, «Ideas para más adelante».)
// hatch ring
const hatchRing=new THREE.Mesh(new THREE.TorusGeometry(0.95,0.07,8,40),new THREE.MeshBasicMaterial({color:0x7fffd0}));
hatchRing.position.copy(HATCH);hatchRing.rotation.y=Math.PI/2;world.add(hatchRing);
const hatchLight=new THREE.PointLight(0x7fffd0,0,6,2);hatchLight.position.copy(HATCH).add(new THREE.Vector3(0.6,0,0));world.add(hatchLight);

