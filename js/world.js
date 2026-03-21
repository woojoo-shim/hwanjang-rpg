/* ════════════ 3D 월드 시스템 ════════════ */
/* 의존: config.js (NPC_DEF, ZONES)
        ui.js (posEl)
        player.js (PL)
        monster.js (spawnZoneMonsters, clearMonsters)
   선언: scene, camera, renderer, npcs, closestNpc, zoneGroup, portalMeshes, closestPortal
   참조: myName (main.js) — 런타임 참조 */

var scene,camera,renderer;
var closestNpc=null;
var npcs=[];
var zoneGroup=null;
var portalMeshes=[];
var closestPortal=null;

function mkHuman(bc,hc){
  var g=new THREE.Group();
  var bm=new THREE.MeshLambertMaterial({color:bc});
  var hm=new THREE.MeshLambertMaterial({color:hc});

  var body=new THREE.Mesh(new THREE.BoxGeometry(.6,1.0,.35),bm);
  body.position.set(0,.95,0);g.add(body);

  var head=new THREE.Mesh(new THREE.BoxGeometry(.45,.45,.45),hm);
  head.position.set(0,1.65,0);g.add(head);

  var legG=new THREE.BoxGeometry(.22,.68,.22);
  var legL=new THREE.Mesh(legG,bm);legL.position.set(-.16,.34,0);g.add(legL);
  var legR=new THREE.Mesh(legG,bm);legR.position.set(.16,.34,0);g.add(legR);

  var armG=new THREE.BoxGeometry(.2,.7,.2);
  var armL=new THREE.Mesh(armG,bm);armL.position.set(-.4,.95,0);g.add(armL);

  var armRPivot=new THREE.Group();
  armRPivot.position.set(.4,1.3,0);
  var armR=new THREE.Mesh(armG,bm);
  armR.position.set(0,-.35,0);
  armRPivot.add(armR);
  g.add(armRPivot);

  return{group:g,legL:legL,legR:legR,armL:armL,armR:armR,armRPivot:armRPivot};
}

function mkTree(x,z,s,parent){
  s=s||1;var g=new THREE.Group();
  var p=parent||scene;
  var tm=new THREE.MeshLambertMaterial({color:0x3a2008});
  var lm1=new THREE.MeshLambertMaterial({color:0x1a3a08});
  var lm2=new THREE.MeshLambertMaterial({color:0x224a10});
  var trunk=new THREE.Mesh(new THREE.CylinderGeometry(.18,.28,2*s,7),tm);trunk.position.set(0,s,0);g.add(trunk);
  var l1=new THREE.Mesh(new THREE.ConeGeometry(1.5*s,2.5*s,8),lm1);l1.position.set(0,2.6*s,0);g.add(l1);
  var l2=new THREE.Mesh(new THREE.ConeGeometry(1.0*s,2.0*s,8),lm2);l2.position.set(0,3.9*s,0);g.add(l2);
  g.position.set(x,0,z);p.add(g);
}

function mkBldg(x,z,w,h,d,bc,rc,parent){
  var g=new THREE.Group();
  var p=parent||scene;
  var bm=new THREE.MeshLambertMaterial({color:bc});
  var rm=new THREE.MeshLambertMaterial({color:rc});
  var stm=new THREE.MeshLambertMaterial({color:0x3a3a3a});
  var dm=new THREE.MeshLambertMaterial({color:0x080808});
  var wm=new THREE.MeshLambertMaterial({color:0xffeeaa,emissive:new THREE.Color(0xffaa00),emissiveIntensity:.22});
  var fd=new THREE.Mesh(new THREE.BoxGeometry(w+.4,.4,d+.4),stm);fd.position.set(0,.2,0);g.add(fd);
  var bd=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),bm);bd.position.set(0,h/2+.4,0);g.add(bd);
  var rf=new THREE.Mesh(new THREE.ConeGeometry(Math.max(w,d)*.72,2.8,4),rm);rf.position.set(0,h+.4+1.4,0);rf.rotation.y=Math.PI/4;g.add(rf);
  var dr=new THREE.Mesh(new THREE.BoxGeometry(.8,1.4,.12),dm);dr.position.set(0,1.1,d/2+.05);g.add(dr);
  var wg=new THREE.BoxGeometry(.6,.6,.12);
  var wl=new THREE.Mesh(wg,wm);wl.position.set(-w/2+1.2,h/2+.4,d/2+.05);g.add(wl);
  var wr=new THREE.Mesh(wg,wm);wr.position.set(w/2-1.2,h/2+.4,d/2+.05);g.add(wr);
  g.position.set(x,0,z);p.add(g);
}

function mkStall(x,z,rotY,color,roofColor,label,parent){
  var g=new THREE.Group();
  var p=parent||scene;
  var postM=new THREE.MeshLambertMaterial({color:0x5a3a10});
  var postG=new THREE.BoxGeometry(.15,2.2,.15);
  [[-1.1,0,-0.65],[1.1,0,-0.65],[-1.1,0,.65],[1.1,0,.65]].forEach(function(pp){
    var post=new THREE.Mesh(postG,postM);post.position.set(pp[0],1.1,pp[2]);g.add(post);
  });
  var ctrM=new THREE.MeshLambertMaterial({color:color});
  var ctr=new THREE.Mesh(new THREE.BoxGeometry(2.4,.5,1.4),ctrM);ctr.position.set(0,.25,0);g.add(ctr);
  var rfM=new THREE.MeshLambertMaterial({color:roofColor});
  var rf=new THREE.Mesh(new THREE.BoxGeometry(2.8,.08,1.6),rfM);rf.position.set(0,2.2,0);g.add(rf);
  var rfF=new THREE.Mesh(new THREE.BoxGeometry(2.8,.6,0.08),rfM);rfF.position.set(0,1.9,-.84);g.add(rfF);
  var signM=new THREE.MeshLambertMaterial({color:0x3a1a00,emissive:new THREE.Color(0x331100),emissiveIntensity:.3});
  var sign=new THREE.Mesh(new THREE.BoxGeometry(1.6,.4,.08),signM);sign.position.set(0,2.55,-.84);g.add(sign);
  var itemM=new THREE.MeshLambertMaterial({color:0xffcc44,emissive:new THREE.Color(0x886600),emissiveIntensity:.2});
  for(var i=-1;i<=1;i++){
    var itm=new THREE.Mesh(new THREE.BoxGeometry(.3,.2,.3),itemM);itm.position.set(i*.6,.52,-.1);g.add(itm);
  }
  g.position.set(x,0,z);g.rotation.y=rotY;p.add(g);
  return g;
}

function mkCastle(parent){
  var g=new THREE.Group();
  var p=parent||scene;
  var wallM=new THREE.MeshLambertMaterial({color:0x8a8870});
  var roofM=new THREE.MeshLambertMaterial({color:0x4488cc,emissive:new THREE.Color(0x224488),emissiveIntensity:.3});
  var gateM=new THREE.MeshLambertMaterial({color:0x1a1000,emissive:new THREE.Color(0xff8800),emissiveIntensity:.5});

  var main=new THREE.Mesh(new THREE.BoxGeometry(12,8,10),wallM);main.position.set(0,4,0);g.add(main);
  var mainRf=new THREE.Mesh(new THREE.ConeGeometry(6,6,4),roofM);mainRf.position.set(0,11,0);mainRf.rotation.y=Math.PI/4;g.add(mainRf);
  [[-7,0,4],[7,0,4]].forEach(function(pp){
    var t=new THREE.Mesh(new THREE.CylinderGeometry(1.8,2,9,8),wallM);t.position.set(pp[0],4.5,pp[2]);g.add(t);
    var tr=new THREE.Mesh(new THREE.ConeGeometry(2.2,4,8),roofM);tr.position.set(pp[0],10,pp[2]);g.add(tr);
  });
  [[-7,0,-4],[7,0,-4]].forEach(function(pp){
    var t=new THREE.Mesh(new THREE.CylinderGeometry(1.5,1.8,7,8),wallM);t.position.set(pp[0],3.5,pp[2]);g.add(t);
    var tr=new THREE.Mesh(new THREE.ConeGeometry(1.8,3.5,8),roofM);tr.position.set(pp[0],8,pp[2]);g.add(tr);
  });
  var ct=new THREE.Mesh(new THREE.CylinderGeometry(1,1.2,4,8),wallM);ct.position.set(0,10,0);g.add(ct);
  var ctr=new THREE.Mesh(new THREE.ConeGeometry(1.4,3,8),new THREE.MeshLambertMaterial({color:0x66aaff,emissive:new THREE.Color(0x3366cc),emissiveIntensity:.5}));ctr.position.set(0,13.5,0);g.add(ctr);
  var gate=new THREE.Mesh(new THREE.BoxGeometry(3,4,.3),gateM);gate.position.set(0,2,5.15);g.add(gate);
  var archM=new THREE.MeshLambertMaterial({color:0x6a6050});
  var arch=new THREE.Mesh(new THREE.TorusGeometry(1.5,.3,8,12,.5*Math.PI),archM);
  arch.position.set(0,4,5.15);arch.rotation.z=Math.PI;g.add(arch);
  var merlonM=new THREE.MeshLambertMaterial({color:0x7a7860});
  for(var mx=-5;mx<=5;mx+=2){
    var ml=new THREE.Mesh(new THREE.BoxGeometry(.8,.8,.8),merlonM);ml.position.set(mx,8.4,5);g.add(ml);
  }
  var stepM=new THREE.MeshLambertMaterial({color:0x706050});
  [0,1,2].forEach(function(i){
    var st=new THREE.Mesh(new THREE.BoxGeometry(4-i*.3,.3,1.2),stepM);st.position.set(0,.15+i*.3,5.8+i*1.0);g.add(st);
  });
  var castleLight=new THREE.PointLight(0xff8800,3,20);castleLight.position.set(0,3,3);g.add(castleLight);
  g.position.set(0,0,-30);p.add(g);
}

function mkFountain(parent){
  var g=new THREE.Group();
  var p=parent||scene;
  var stoneM=new THREE.MeshLambertMaterial({color:0x888070});
  var waterM=new THREE.MeshLambertMaterial({color:0x44aaff,emissive:new THREE.Color(0x0055aa),emissiveIntensity:.3,transparent:true,opacity:.8});
  var outer=new THREE.Mesh(new THREE.CylinderGeometry(4,4.2,.6,16),stoneM);outer.position.set(0,.3,0);g.add(outer);
  var water=new THREE.Mesh(new THREE.CylinderGeometry(3.6,3.6,.3,16),waterM);water.position.set(0,.45,0);g.add(water);
  var pillar=new THREE.Mesh(new THREE.CylinderGeometry(.3,.4,2.5,8),stoneM);pillar.position.set(0,1.25,0);g.add(pillar);
  var topM=new THREE.MeshLambertMaterial({color:0xccaa44,emissive:new THREE.Color(0x886600),emissiveIntensity:.4});
  var top=new THREE.Mesh(new THREE.ConeGeometry(.8,1.5,6),topM);top.position.set(0,3,0);g.add(top);
  var jetM=new THREE.MeshLambertMaterial({color:0x88ddff,emissive:new THREE.Color(0x0088cc),emissiveIntensity:.5,transparent:true,opacity:.6});
  [0,1,2,3].forEach(function(i){
    var a=i*Math.PI/2;
    var jet=new THREE.Mesh(new THREE.CylinderGeometry(.08,.12,1.8,6),jetM);
    jet.position.set(Math.cos(a)*.5,2.5+Math.sin(a)*.3,Math.sin(a)*.5);
    jet.rotation.z=Math.cos(a)*.4;jet.rotation.x=-Math.sin(a)*.4;
    g.add(jet);
  });
  var fLight=new THREE.PointLight(0x44aaff,.8,12);fLight.position.set(0,2,0);g.add(fLight);
  g.position.set(0,0,-8);p.add(g);
}

function mkStonePath(parent){
  var p=parent||scene;
  var pathM=new THREE.MeshLambertMaterial({color:0xb8a880});
  var darkM=new THREE.MeshLambertMaterial({color:0x907858});
  var mainPath=new THREE.Mesh(new THREE.PlaneGeometry(6,50),pathM);
  mainPath.rotation.x=-Math.PI/2;mainPath.position.set(0,.02,-8);p.add(mainPath);
  var plaza=new THREE.Mesh(new THREE.CylinderGeometry(8,8,.05,32),pathM);
  plaza.position.set(0,.02,-8);p.add(plaza);
  var crossL=new THREE.Mesh(new THREE.PlaneGeometry(10,5),pathM);
  crossL.rotation.x=-Math.PI/2;crossL.position.set(-11,.02,-8);p.add(crossL);
  var crossR=new THREE.Mesh(new THREE.PlaneGeometry(10,5),pathM);
  crossR.rotation.x=-Math.PI/2;crossR.position.set(11,.02,-8);p.add(crossR);
  for(var i=0;i<30;i++){
    var tile=new THREE.Mesh(new THREE.PlaneGeometry(.8+Math.random()*.4,.8+Math.random()*.4),darkM);
    tile.rotation.x=-Math.PI/2;
    tile.position.set((Math.random()-.5)*5,.025,-2-i*1.5);
    p.add(tile);
  }
}

function mkWaterRiver(parent){
  var p=parent||scene;
  var riverM=new THREE.MeshLambertMaterial({color:0x2288cc,emissive:new THREE.Color(0x004488),emissiveIntensity:.2,transparent:true,opacity:.75});
  var rl=new THREE.Mesh(new THREE.PlaneGeometry(4,60),riverM);rl.rotation.x=-Math.PI/2;rl.position.set(-20,.08,-10);p.add(rl);
  var rr=new THREE.Mesh(new THREE.PlaneGeometry(4,60),riverM);rr.rotation.x=-Math.PI/2;rr.position.set(20,.08,-10);p.add(rr);
  var wl1=new THREE.PointLight(0x2288ff,.4,15);wl1.position.set(-20,1,-10);p.add(wl1);
  var wl2=new THREE.PointLight(0x2288ff,.4,15);wl2.position.set(20,1,-10);p.add(wl2);
}

/* ════════════ 마을 빌드 ════════════ */
function buildVillage(group){
  /* 바닥 */
  var gnd=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshLambertMaterial({color:0x2a6a1a}));
  gnd.rotation.x=-Math.PI/2;group.add(gnd);

  /* 조명 */
  var fbl=new THREE.PointLight(0x44aaff,.6,25);fbl.position.set(0,3,-8);group.add(fbl);

  /* 구조물 */
  mkStonePath(group);
  mkWaterRiver(group);
  mkFountain(group);
  mkCastle(group);

  /* 상점 */
  mkStall(-14,-6, .3, 0x8a3a10,0xcc5522,'업그레이드',group);
  mkStall(-14,-13,.2, 0x1a4a8a,0x3366cc,'아이템',group);
  mkStall(14,-6, -.3, 0x3a6a10,0x558833,'퀘스트',group);
  mkStall(14,-13,-.2, 0x8a4a1a,0xcc8833,'무기점',group);
  mkStall(-6,-18,.15, 0x6a1a1a,0xaa3333,'포션',group);
  mkStall(6,-18,-.15, 0x1a4a2a,0x336644,'방어구',group);

  /* 횃불 */
  var torchPos=[[-7,-1,1],[7,-1,1],[-7,-15,1],[7,-15,1],[-1,-19,1],[1,-19,1]];
  var poleMat=new THREE.MeshLambertMaterial({color:0x3a2a10});
  var fireMat=new THREE.MeshBasicMaterial({color:0xff8820});
  torchPos.forEach(function(tp){
    var pl=new THREE.PointLight(0xff8830,1.8,12);pl.position.set(tp[0],2.2,tp[2]);group.add(pl);
    var pole=new THREE.Mesh(new THREE.CylinderGeometry(.06,.08,2,6),poleMat);pole.position.set(tp[0],1,tp[2]);group.add(pole);
    var fire=new THREE.Mesh(new THREE.SphereGeometry(.13,8,8),fireMat);fire.position.set(tp[0],2.2,tp[2]);group.add(fire);
  });

  /* 나무 */
  var treeLayout=[
    [-16,5],[-18,-2],[-17,-8],[-16,-16],[-18,-22],[-15,-26],
    [16,5],[18,-2],[17,-8],[16,-16],[18,-22],[15,-26],
    [-10,10],[-5,13],[0,14],[5,13],[10,10],
    [-12,7],[12,7],
    [-12,-30],[-8,-32],[0,-34],[8,-32],[12,-30],
    [-20,-18],[-22,-10],[20,-18],[22,-10],
  ];
  treeLayout.forEach(function(pp){mkTree(pp[0],pp[1],.8+Math.random()*.6,group);});

  /* NPC */
  var lov=document.getElementById('lov');
  npcs=[];
  NPC_DEF.forEach(function(def){
    var h=mkHuman(def.bc,def.hc);
    h.group.position.set(def.px,0,def.pz);
    h.group.rotation.y=Math.random()*Math.PI*2;
    group.add(h.group);
    var ne=document.createElement('div');ne.className='llabel npc';ne.textContent=def.name;lov.appendChild(ne);
    var ie=document.createElement('div');ie.className='linteract';ie.textContent='E 대화';lov.appendChild(ie);
    npcs.push({name:def.name,px:def.px,pz:def.pz,bc:def.bc,hc:def.hc,mesh:h.group,nameEl:ne,intEl:ie,bobOff:Math.random()*Math.PI*2});
  });

  /* 건물 이름표 */
  [{x:0,y:17,z:-30,n:'성'},{x:-14,y:5,z:-6,n:'업그레이드'},{x:14,y:5,z:-6,n:'퀘스트'},{x:-14,y:5,z:-13,n:'아이템'},{x:14,y:5,z:-13,n:'무기점'}]
  .forEach(function(b){
    var el=document.createElement('div');el.className='llabel bld';el.textContent=b.n;
    el.dataset.wx=b.x;el.dataset.wy=b.y;el.dataset.wz=b.z;lov.appendChild(el);
  });
}

/* ════════════ 포탈 시스템 ════════════ */
function buildPortals(zoneName,group){
  var zone=ZONES[zoneName];
  if(!zone||!zone.portals)return;
  var lov=document.getElementById('lov');
  zone.portals.forEach(function(pd){
    var pg=new THREE.Group();
    var pillarM=new THREE.MeshLambertMaterial({color:0x4466aa,emissive:new THREE.Color(0x2244aa),emissiveIntensity:.5});
    var archM=new THREE.MeshLambertMaterial({color:0x6688cc,emissive:new THREE.Color(0x4466ff),emissiveIntensity:.6});
    /* 두 기둥 */
    var pilL=new THREE.Mesh(new THREE.CylinderGeometry(.2,.25,4,8),pillarM);pilL.position.set(-1.2,2,0);pg.add(pilL);
    var pilR=new THREE.Mesh(new THREE.CylinderGeometry(.2,.25,4,8),pillarM);pilR.position.set(1.2,2,0);pg.add(pilR);
    /* 아치 */
    var archRing=new THREE.Mesh(new THREE.TorusGeometry(1.2,.15,8,16,Math.PI),archM);
    archRing.position.set(0,4,0);archRing.rotation.x=Math.PI;pg.add(archRing);
    /* 포탈 면 (반투명 빛나는 원) */
    var portalFaceM=new THREE.MeshLambertMaterial({color:0x88bbff,emissive:new THREE.Color(0x4488ff),emissiveIntensity:.8,transparent:true,opacity:.35});
    var portalFace=new THREE.Mesh(new THREE.CircleGeometry(1.1,16),portalFaceM);
    portalFace.position.set(0,2.5,0);pg.add(portalFace);
    /* 발광 */
    var pLight=new THREE.PointLight(0x4488ff,2,10);pLight.position.set(0,3,0);pg.add(pLight);
    pg.position.set(pd.px,0,pd.pz);
    group.add(pg);

    /* 상호작용 라벨 */
    var ie=document.createElement('div');ie.className='linteract';ie.textContent='E '+pd.label;ie.style.display='none';lov.appendChild(ie);
    portalMeshes.push({group:pg,to:pd.to,label:pd.label,px:pd.px,pz:pd.pz,intEl:ie,faceMat:portalFaceM,light:pLight});
  });
}

function chkPortal(){
  closestPortal=null;var md=4.5;
  portalMeshes.forEach(function(pm){
    var dx=PL.group.position.x-pm.px,dz=PL.group.position.z-pm.pz;
    var d=Math.sqrt(dx*dx+dz*dz);
    if(d<md){md=d;closestPortal=pm;}
  });
}

/* ════════════ 존 전환 ════════════ */
function changeZone(zoneName){
  var zone=ZONES[zoneName];
  if(!zone)return;

  /* 기존 존 제거 */
  if(zoneGroup){scene.remove(zoneGroup);}
  /* NPC/포탈 라벨 정리 */
  npcs.forEach(function(n){if(n.nameEl&&n.nameEl.parentNode)n.nameEl.parentNode.removeChild(n.nameEl);if(n.intEl&&n.intEl.parentNode)n.intEl.parentNode.removeChild(n.intEl);});
  npcs=[];
  portalMeshes.forEach(function(pm){if(pm.intEl&&pm.intEl.parentNode)pm.intEl.parentNode.removeChild(pm.intEl);});
  portalMeshes=[];
  closestPortal=null;closestNpc=null;
  /* 건물 라벨 정리 */
  document.querySelectorAll('#lov .llabel.bld').forEach(function(el){el.parentNode.removeChild(el);});
  /* 몬스터 정리 */
  clearMonsters();

  /* 새 존 그룹 */
  zoneGroup=new THREE.Group();

  /* 존별 빌드 */
  if(zoneName==='village'){
    buildVillage(zoneGroup);
  } else {
    /* 사냥 존 바닥 */
    var zb=zone.bounds;
    var zw=zb[1]-zb[0],zd=zb[3]-zb[2];
    var gnd=new THREE.Mesh(new THREE.PlaneGeometry(zw+60,zd+60),new THREE.MeshLambertMaterial({color:0x2a6a1a}));
    gnd.rotation.x=-Math.PI/2;gnd.position.set((zb[0]+zb[1])/2,0,(zb[2]+zb[3])/2);zoneGroup.add(gnd);
    spawnZoneMonsters(zoneName,zoneGroup);
  }

  /* 포탈 빌드 */
  buildPortals(zoneName,zoneGroup);

  scene.add(zoneGroup);

  /* 플레이어 이동 */
  PL.group.position.set(zone.spawn[0],0,zone.spawn[1]);

  /* 씬 분위기 */
  scene.background=new THREE.Color(zone.bgColor);
  scene.fog.color.set(zone.fogColor);

  /* 존 변경 기록 */
  currentZone=zoneName;

  /* 배너 표시 */
  var b=document.getElementById('zone-banner');
  b.textContent='◈ '+zone.name+' 진입';b.style.color=zone.color;b.style.borderColor=zone.color+'66';
  b.classList.add('show');setTimeout(function(){b.classList.remove('show');},2800);
  document.querySelector('.hloc').textContent='▸ '+zone.name;

  /* 시스템 메시지 */
  var msgs={
    meadow:'초원 진입. 토끼와 사슴이 있습니다.',
    swamp:'독 늪 진입! 슬라임과 독두꺼비가 나타납니다.',
    darkforest:'어두운 숲 진입! 고블린과 늑대를 조심하세요!',
    volcano:'화산 지대 진입!! 용암 골렘과 드레이크가 기다립니다!!',
    village:'마을로 귀환. HP 일부 회복.',
  };
  if(msgs[zoneName])addChat('sys','[시스템]',msgs[zoneName]);
  if(zoneName==='village'){
    playerHP=Math.min(playerMaxHP,playerHP+Math.floor(playerMaxHP*.25));
    updPlayerHpBar();
  }
}

/* ════════════ initScene ════════════ */
function initScene(){
  var canvas=document.getElementById('gc');
  renderer=new THREE.WebGLRenderer({canvas:canvas,antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  scene=new THREE.Scene();
  scene.background=new THREE.Color(0x0a1a0a);
  scene.fog=new THREE.Fog(0x0a1a0a,50,100);
  camera=new THREE.PerspectiveCamera(60,1,.1,200);
  camera.position.set(0,10,18);

  /* 전역 조명 (존 전환해도 유지) */
  scene.add(new THREE.AmbientLight(0x88aa66,.6));
  var sun=new THREE.DirectionalLight(0xffeebb,.9);sun.position.set(-30,80,30);scene.add(sun);

  /* 달 + 별 (전역) */
  var moon=new THREE.Mesh(new THREE.SphereGeometry(6,16,16),new THREE.MeshBasicMaterial({color:0xfffde8}));
  moon.position.set(-80,120,-150);scene.add(moon);
  var moonL=new THREE.PointLight(0xddeeff,.3,200);moonL.position.set(-80,120,-150);scene.add(moonL);

  var STAR_COUNT=4000,sp=new Float32Array(STAR_COUNT*3);
  for(var i=0;i<STAR_COUNT;i++){
    var th=Math.random()*Math.PI*2,ph=Math.acos(2*Math.random()-1)*0.45,r=180;
    sp[i*3]=r*Math.sin(ph)*Math.cos(th);sp[i*3+1]=r*Math.abs(Math.cos(ph))+5;sp[i*3+2]=r*Math.sin(ph)*Math.sin(th);
  }
  var sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.BufferAttribute(sp,3));
  scene.add(new THREE.Points(sg,new THREE.PointsMaterial({color:0xffffff,size:.3,sizeAttenuation:true})));

  /* 플레이어 */
  var ph2=mkHuman(0x2a6a3a,0xddcc99);
  PL.group=ph2.group;PL.legL=ph2.legL;PL.legR=ph2.legR;
  PL.armL=ph2.armL;PL.armR=ph2.armR;PL.armRPivot=ph2.armRPivot;
  PL.weaponMesh=null;PL.bobT=0;PL.atkAnim=0;PL.atkPhase=0;
  PL.group.position.set(0,0,8);scene.add(PL.group);

  /* 플레이어 이름표 */
  var lov=document.getElementById('lov');
  var ple=document.createElement('div');ple.className='llabel plr';ple.id='ple';ple.textContent=myName;lov.appendChild(ple);

  setupInput();onResize();window.addEventListener('resize',onResize);

  /* 초기 존: 마을 */
  changeZone('village');

  renderer.setAnimationLoop(loop);
}

function onResize(){
  var c=document.getElementById('cc'),w=c.clientWidth,h=c.clientHeight;
  if(w>0&&h>0){renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}
}

function updCam(){
  var p=PL.group.position;
  var tx=p.x+9*Math.sin(cYaw)*Math.cos(cPitch);
  var ty=p.y+9*Math.sin(cPitch)+1.5;
  var tz=p.z+9*Math.cos(cYaw)*Math.cos(cPitch);
  var lr=.12;
  camera.position.x+=(tx-camera.position.x)*lr;
  camera.position.y+=(Math.max(ty,.6)-camera.position.y)*lr;
  camera.position.z+=(tz-camera.position.z)*lr;
  camera.lookAt(p.x,p.y+1.2,p.z);
}

function updNpcs(t){
  npcs.forEach(function(n){
    n.mesh.position.y=Math.sin(t*.9+n.bobOff)*.04;
    var dx=PL.group.position.x-n.mesh.position.x,dz=PL.group.position.z-n.mesh.position.z;
    if(Math.sqrt(dx*dx+dz*dz)<10){var tr=Math.atan2(dx,dz);n.mesh.rotation.y+=(tr-n.mesh.rotation.y)*.04;}
  });
  /* 포탈 애니메이션 */
  portalMeshes.forEach(function(pm){
    var pulse=.3+Math.sin(t*2)*.15;
    pm.faceMat.opacity=pulse;
    pm.light.intensity=1.5+Math.sin(t*3)*.8;
  });
}

function chkNpc(){
  closestNpc=null;var md=4.5;
  npcs.forEach(function(n){
    var dx=PL.group.position.x-n.mesh.position.x,dz=PL.group.position.z-n.mesh.position.z;
    var d=Math.sqrt(dx*dx+dz*dz);if(d<md){md=d;closestNpc=n;}
  });
}
