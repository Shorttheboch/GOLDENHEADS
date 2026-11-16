/* ================= PISTOL (procedural) ================= */
const gold=new THREE.MeshStandardMaterial({color:0xe0ad48,metalness:1,roughness:0.22});const PM4=new THREE.Matrix4(),PGRIP=new THREE.Vector3(0,-0.07,-0.02);
// v92 (Santi): the gun sits 2.5 cm further back in the fist (pistol space, before the AS scale; PGRIP in 28-load.js): the middle, ring and
// little fingers wrap the front of the grip, the web of the hand comes up under the back of the frame, the index curls more to the trigger.
const GUN_BACK=0.025;
const pistol=new THREE.Group();pistol.scale.setScalar(AS);
{const body=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.07,0.2),gold);body.position.z=0.05;pistol.add(body);
 const bar=new THREE.Mesh(new THREE.CylinderGeometry(0.018,0.022,0.14,10).rotateX(Math.PI/2),gold);bar.position.set(0,0.012,0.2);pistol.add(bar);
 const grip=new THREE.Mesh(new THREE.BoxGeometry(0.04,0.1,0.05),new THREE.MeshStandardMaterial({color:0x2a2218,metalness:0.4,roughness:0.6}));grip.position.set(0,-0.07,-0.02);grip.rotation.x=0.25;pistol.add(grip);
 const tip=new THREE.Mesh(new THREE.SphereGeometry(0.02,8,6),new THREE.MeshBasicMaterial({color:0xff5a3a}));tip.position.set(0,0.012,0.27);pistol.add(tip);}
const muzzle=new THREE.Object3D();muzzle.position.set(0,0.012,0.28);pistol.add(muzzle);
scene.add(pistol);pistol.traverse(o=>{if(o.isMesh)o.castShadow=true;});

