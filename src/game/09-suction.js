/* ================= SUCTION CONE VISUAL ================= */
const cone=new THREE.Mesh(new THREE.ConeGeometry(2.2,CFG.suckRange*0.55,20,1,true).translate(0,-CFG.suckRange*0.275,0).rotateX(-Math.PI/2),
  new THREE.MeshBasicMaterial({color:0xffc860,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}));
scene.add(cone);

