/* ════════════ 3D 월드 시스템 (오픈 월드) ════════════ */
/* 의존: config.js (NPC_DEF, WORLD_BOUNDS, WORLD_SPAWN)
        ui.js (posEl)
        player.js (PL)
        monster.js (buildOpenWorld)
   선언: scene, camera, renderer, npcs, closestNpc
   참조: myName (main.js) — 런타임 참조 */

var scene,camera,renderer;
var closestNpc=null;
var npcs=[];
/* 호환성용 빈 배열 — portal 참조하는 코드 에러 방지 */
var portalMeshes=[];
var closestPortal=null;

/* ── 포스트프로세싱 컴포저 (bloom) ── */
var composer=null;

/* ── 파티클 시스템 (반딧불) ── */
var fireflyPoints=null;
var fireflyPositions=null;
var fireflyBaseY=null;
var fireflyPhases=null;

/* ── 물 UV 애니메이션 ── */
var waterMeshes=[];
var riverUVOffset=0;

function mkHuman(bc,hc){
  var g=new THREE.Group();
  var bm=new THREE.MeshLambertMaterial({color:bc});
  var hm=new THREE.MeshLambertMaterial({color:hc});

  var body=new THREE.Mesh(new THREE.BoxGeometry(.6,1.0,.35),bm);
  body.position.set(0,.95,0);
  body.castShadow=true;body.receiveShadow=true;
  g.add(body);

  var head=new THREE.Mesh(new THREE.BoxGeometry(.45,.45,.45),hm);
  head.position.set(0,1.65,0);
  head.castShadow=true;head.receiveShadow=true;
  g.add(head);

  var legG=new THREE.BoxGeometry(.22,.68,.22);
  var legL=new THREE.Mesh(legG,bm);legL.position.set(-.16,.34,0);legL.castShadow=true;g.add(legL);
  var legR=new THREE.Mesh(legG,bm);legR.position.set(.16,.34,0);legR.castShadow=true;g.add(legR);

  var armG=new THREE.BoxGeometry(.2,.7,.2);
  var armL=new THREE.Mesh(armG,bm);armL.position.set(-.4,.95,0);armL.castShadow=true;g.add(armL);

  var armRPivot=new THREE.Group();
  armRPivot.position.set(.4,1.3,0);
  var armR=new THREE.Mesh(armG,bm);
  armR.position.set(0,-.35,0);armR.castShadow=true;
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
  var trunk=new THREE.Mesh(new THREE.CylinderGeometry(.18,.28,2*s,7),tm);
  trunk.position.set(0,s,0);trunk.castShadow=true;trunk.receiveShadow=true;g.add(trunk);
  var l1=new THREE.Mesh(new THREE.ConeGeometry(1.5*s,2.5*s,8),lm1);
  l1.position.set(0,2.6*s,0);l1.castShadow=true;l1.receiveShadow=true;g.add(l1);
  var l2=new THREE.Mesh(new THREE.ConeGeometry(1.0*s,2.0*s,8),lm2);
  l2.position.set(0,3.9*s,0);l2.castShadow=true;l2.receiveShadow=true;g.add(l2);
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
  var fd=new THREE.Mesh(new THREE.BoxGeometry(w+.4,.4,d+.4),stm);fd.position.set(0,.2,0);fd.castShadow=true;fd.receiveShadow=true;g.add(fd);
  var bd=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),bm);bd.position.set(0,h/2+.4,0);bd.castShadow=true;bd.receiveShadow=true;g.add(bd);
  var rf=new THREE.Mesh(new THREE.ConeGeometry(Math.max(w,d)*.72,2.8,4),rm);rf.position.set(0,h+.4+1.4,0);rf.rotation.y=Math.PI/4;rf.castShadow=true;g.add(rf);
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
    var post=new THREE.Mesh(postG,postM);post.position.set(pp[0],1.1,pp[2]);post.castShadow=true;g.add(post);
  });
  var ctrM=new THREE.MeshLambertMaterial({color:color});
  var ctr=new THREE.Mesh(new THREE.BoxGeometry(2.4,.5,1.4),ctrM);ctr.position.set(0,.25,0);ctr.castShadow=true;ctr.receiveShadow=true;g.add(ctr);
  var rfM=new THREE.MeshLambertMaterial({color:roofColor});
  var rf=new THREE.Mesh(new THREE.BoxGeometry(2.8,.08,1.6),rfM);rf.position.set(0,2.2,0);rf.castShadow=true;g.add(rf);
  var rfF=new THREE.Mesh(new THREE.BoxGeometry(2.8,.6,0.08),rfM);rfF.position.set(0,1.9,-.84);rfF.castShadow=true;g.add(rfF);
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

  var main=new THREE.Mesh(new THREE.BoxGeometry(12,8,10),wallM);main.position.set(0,4,0);main.castShadow=true;main.receiveShadow=true;g.add(main);
  var mainRf=new THREE.Mesh(new THREE.ConeGeometry(6,6,4),roofM);mainRf.position.set(0,11,0);mainRf.rotation.y=Math.PI/4;mainRf.castShadow=true;g.add(mainRf);
  [[-7,0,4],[7,0,4]].forEach(function(pp){
    var t=new THREE.Mesh(new THREE.CylinderGeometry(1.8,2,9,8),wallM);t.position.set(pp[0],4.5,pp[2]);t.castShadow=true;t.receiveShadow=true;g.add(t);
    var tr=new THREE.Mesh(new THREE.ConeGeometry(2.2,4,8),roofM);tr.position.set(pp[0],10,pp[2]);tr.castShadow=true;g.add(tr);
  });
  [[-7,0,-4],[7,0,-4]].forEach(function(pp){
    var t=new THREE.Mesh(new THREE.CylinderGeometry(1.5,1.8,7,8),wallM);t.position.set(pp[0],3.5,pp[2]);t.castShadow=true;t.receiveShadow=true;g.add(t);
    var tr=new THREE.Mesh(new THREE.ConeGeometry(1.8,3.5,8),roofM);tr.position.set(pp[0],8,pp[2]);tr.castShadow=true;g.add(tr);
  });
  var ct=new THREE.Mesh(new THREE.CylinderGeometry(1,1.2,4,8),wallM);ct.position.set(0,10,0);ct.castShadow=true;g.add(ct);
  var ctr=new THREE.Mesh(new THREE.ConeGeometry(1.4,3,8),new THREE.MeshLambertMaterial({color:0x66aaff,emissive:new THREE.Color(0x3366cc),emissiveIntensity:.5}));ctr.position.set(0,13.5,0);ctr.castShadow=true;g.add(ctr);
  var gate=new THREE.Mesh(new THREE.BoxGeometry(3,4,.3),gateM);gate.position.set(0,2,5.15);g.add(gate);
  var archM=new THREE.MeshLambertMaterial({color:0x6a6050});
  var arch=new THREE.Mesh(new THREE.TorusGeometry(1.5,.3,8,12,.5*Math.PI),archM);
  arch.position.set(0,4,5.15);arch.rotation.z=Math.PI;g.add(arch);
  var merlonM=new THREE.MeshLambertMaterial({color:0x7a7860});
  for(var mx=-5;mx<=5;mx+=2){
    var ml=new THREE.Mesh(new THREE.BoxGeometry(.8,.8,.8),merlonM);ml.position.set(mx,8.4,5);ml.castShadow=true;g.add(ml);
  }
  var stepM=new THREE.MeshLambertMaterial({color:0x706050});
  [0,1,2].forEach(function(i){
    var st=new THREE.Mesh(new THREE.BoxGeometry(4-i*.3,.3,1.2),stepM);st.position.set(0,.15+i*.3,5.8+i*1.0);st.castShadow=true;st.receiveShadow=true;g.add(st);
  });
  var castleLight=new THREE.PointLight(0xff8800,.3,12);castleLight.position.set(0,3,3);g.add(castleLight);
  g.position.set(0,0,-30);p.add(g);
}

function mkFountain(parent){
  var g=new THREE.Group();
  var p=parent||scene;
  var stoneM=new THREE.MeshLambertMaterial({color:0x888070});
  var waterM=new THREE.MeshLambertMaterial({color:0x44aaff,transparent:true,opacity:.7});
  var outer=new THREE.Mesh(new THREE.CylinderGeometry(4,4.2,.6,16),stoneM);outer.position.set(0,.3,0);outer.castShadow=true;outer.receiveShadow=true;g.add(outer);
  var water=new THREE.Mesh(new THREE.CylinderGeometry(3.6,3.6,.3,16),waterM);water.position.set(0,.45,0);g.add(water);
  var pillar=new THREE.Mesh(new THREE.CylinderGeometry(.3,.4,2.5,8),stoneM);pillar.position.set(0,1.25,0);pillar.castShadow=true;g.add(pillar);
  var topM=new THREE.MeshLambertMaterial({color:0xccaa44});
  var top=new THREE.Mesh(new THREE.ConeGeometry(.8,1.5,6),topM);top.position.set(0,3,0);top.castShadow=true;g.add(top);
  var jetM=new THREE.MeshLambertMaterial({color:0x88ddff,transparent:true,opacity:.5});
  [0,1,2,3].forEach(function(i){
    var a=i*Math.PI/2;
    var jet=new THREE.Mesh(new THREE.CylinderGeometry(.08,.12,1.8,6),jetM);
    jet.position.set(Math.cos(a)*.5,2.5+Math.sin(a)*.3,Math.sin(a)*.5);
    jet.rotation.z=Math.cos(a)*.4;jet.rotation.x=-Math.sin(a)*.4;
    g.add(jet);
  });
  /* 아침에는 분수 라이트 불필요 */
  g.position.set(0,0,-8);p.add(g);
}

function mkStonePath(parent){
  var p=parent||scene;
  var pathM=new THREE.MeshLambertMaterial({color:0xb8a880});
  var darkM=new THREE.MeshLambertMaterial({color:0x907858});
  var mainPath=new THREE.Mesh(new THREE.PlaneGeometry(6,50),pathM);
  mainPath.rotation.x=-Math.PI/2;mainPath.position.set(0,.02,-8);mainPath.receiveShadow=true;p.add(mainPath);
  var plaza=new THREE.Mesh(new THREE.CylinderGeometry(8,8,.05,32),pathM);
  plaza.position.set(0,.02,-8);plaza.receiveShadow=true;p.add(plaza);
  var crossL=new THREE.Mesh(new THREE.PlaneGeometry(10,5),pathM);
  crossL.rotation.x=-Math.PI/2;crossL.position.set(-11,.02,-8);crossL.receiveShadow=true;p.add(crossL);
  var crossR=new THREE.Mesh(new THREE.PlaneGeometry(10,5),pathM);
  crossR.rotation.x=-Math.PI/2;crossR.position.set(11,.02,-8);crossR.receiveShadow=true;p.add(crossR);
  for(var i=0;i<30;i++){
    var tile=new THREE.Mesh(new THREE.PlaneGeometry(.8+Math.random()*.4,.8+Math.random()*.4),darkM);
    tile.rotation.x=-Math.PI/2;
    tile.position.set((Math.random()-.5)*5,.025,-2-i*1.5);
    tile.receiveShadow=true;
    p.add(tile);
  }
  /* 마을 북쪽 출구 — 초원으로 이어지는 흙길 (z 18~60) */
  var northPath=new THREE.Mesh(new THREE.PlaneGeometry(5,60),new THREE.MeshLambertMaterial({color:0x1e1a10}));
  northPath.rotation.x=-Math.PI/2;northPath.position.set(0,.015,40);northPath.receiveShadow=true;p.add(northPath);
}

function mkWaterRiver(parent){
  var p=parent||scene;
  /* animated water material — store mesh for UV update */
  var riverM=new THREE.MeshLambertMaterial({color:0x2288cc,emissive:new THREE.Color(0x004488),emissiveIntensity:.25,transparent:true,opacity:.78});
  /* rivers now run the full length of village+meadow+forest stretch (~560 units) */
  var rl=new THREE.Mesh(new THREE.PlaneGeometry(6,560),riverM);rl.rotation.x=-Math.PI/2;rl.position.set(-55,.08,270);p.add(rl);
  waterMeshes.push(rl);
  var rr=new THREE.Mesh(new THREE.PlaneGeometry(6,560),riverM.clone());rr.rotation.x=-Math.PI/2;rr.position.set(55,.08,270);p.add(rr);
  waterMeshes.push(rr);
  /* subtle extra depth plane below water */
  var depthM=new THREE.MeshLambertMaterial({color:0x114466,transparent:true,opacity:.45});
  var dl=new THREE.Mesh(new THREE.PlaneGeometry(6,560),depthM);dl.rotation.x=-Math.PI/2;dl.position.set(-55,-.04,270);p.add(dl);
  var dr=new THREE.Mesh(new THREE.PlaneGeometry(6,560),depthM);dr.rotation.x=-Math.PI/2;dr.position.set(55,-.04,270);p.add(dr);
  var wl1=new THREE.PointLight(0x2288ff,.5,40);wl1.position.set(0,1,160);p.add(wl1);
  var wl2=new THREE.PointLight(0x2288ff,.4,40);wl2.position.set(0,1,350);p.add(wl2);
}

/* ════════════ 지면 디테일 유틸 ════════════ */
function scatterGroundDetail(group,count,xRange,zRange,type,offX,offZ){
  offX=offX||0;offZ=offZ||0;
  for(var i=0;i<count;i++){
    var x=offX+(Math.random()-.5)*xRange*2;
    var z=offZ+(Math.random()-.5)*zRange*2;
    var m;
    if(type==='grass'){
      var gc=Math.random()>.5?0x2a5a18:0x3a6a28;
      m=new THREE.Mesh(new THREE.ConeGeometry(.08+Math.random()*.06,.3+Math.random()*.2,4),new THREE.MeshLambertMaterial({color:gc}));
      m.position.set(x,.15,z);
      m.rotation.y=Math.random()*Math.PI;m.rotation.z=(Math.random()-.5)*.3;
      m.castShadow=true;
    } else if(type==='stone'){
      var sc=Math.random()>.5?0x666055:0x555045;
      var ss=.08+Math.random()*.12;
      m=new THREE.Mesh(new THREE.DodecahedronGeometry(ss,0),new THREE.MeshLambertMaterial({color:sc}));
      m.position.set(x,ss*.3,z);
      m.rotation.set(Math.random(),Math.random(),Math.random());
      m.castShadow=true;m.receiveShadow=true;
    } else if(type==='flower'){
      var fc=[0xffee44,0xffffff,0xcc88ff,0xff88aa,0x88ccff][Math.floor(Math.random()*5)];
      m=new THREE.Mesh(new THREE.SphereGeometry(.06+Math.random()*.04,5,5),new THREE.MeshLambertMaterial({color:fc,emissive:new THREE.Color(fc),emissiveIntensity:.15}));
      m.position.set(x,.08,z);
    }
    if(m)group.add(m);
  }
}

/* ════════════ 바이옴 지면 빌드 ════════════ */
function buildGroundPlanes(){
  /* 기본 바닥 — 전체 월드 */
  var baseGndDeep=new THREE.Mesh(new THREE.PlaneGeometry(420,910),new THREE.MeshLambertMaterial({color:0x1a3a0e}));
  baseGndDeep.rotation.x=-Math.PI/2;baseGndDeep.position.set(0,-.04,414);scene.add(baseGndDeep);

  var baseGnd=new THREE.Mesh(new THREE.PlaneGeometry(420,910),new THREE.MeshLambertMaterial({color:0x2a5a1a}));
  baseGnd.rotation.x=-Math.PI/2;baseGnd.position.set(0,0,414);baseGnd.receiveShadow=true;scene.add(baseGnd);

  /* 바이옴별 컬러 오버레이 (y=0.01) */
  /* 마을: x:-22~22, z:-32~20 — 따뜻한 녹색 (크기 유지) */
  var villGnd=new THREE.Mesh(new THREE.PlaneGeometry(44,52),new THREE.MeshLambertMaterial({color:0x2a5a1a}));
  villGnd.rotation.x=-Math.PI/2;villGnd.position.set(0,.01,-6);villGnd.receiveShadow=true;scene.add(villGnd);

  /* 초원: x:-80~80, z:20~300 — 밝은 녹색 */
  var meadGnd=new THREE.Mesh(new THREE.PlaneGeometry(160,280),new THREE.MeshLambertMaterial({color:0x3a7a1a}));
  meadGnd.rotation.x=-Math.PI/2;meadGnd.position.set(0,.01,160);meadGnd.receiveShadow=true;scene.add(meadGnd);

  /* 늪 서쪽: x:-200~-80, z:20~300 */
  var swWGnd=new THREE.Mesh(new THREE.PlaneGeometry(120,280),new THREE.MeshLambertMaterial({color:0x1a3a0a}));
  swWGnd.rotation.x=-Math.PI/2;swWGnd.position.set(-140,.01,160);swWGnd.receiveShadow=true;scene.add(swWGnd);

  /* 늪 동쪽: x:80~200, z:20~300 */
  var swEGnd=new THREE.Mesh(new THREE.PlaneGeometry(120,280),new THREE.MeshLambertMaterial({color:0x1a3a0a}));
  swEGnd.rotation.x=-Math.PI/2;swEGnd.position.set(140,.01,160);swEGnd.receiveShadow=true;scene.add(swEGnd);

  /* 어두운 숲: x:-120~120, z:300~560 */
  var dkGnd=new THREE.Mesh(new THREE.PlaneGeometry(240,260),new THREE.MeshLambertMaterial({color:0x0a1a08}));
  dkGnd.rotation.x=-Math.PI/2;dkGnd.position.set(0,.01,430);dkGnd.receiveShadow=true;scene.add(dkGnd);

  /* 화산: x:-100~100, z:560~860 */
  var vlGnd=new THREE.Mesh(new THREE.PlaneGeometry(200,300),new THREE.MeshLambertMaterial({color:0x1a0a05}));
  vlGnd.rotation.x=-Math.PI/2;vlGnd.position.set(0,.01,710);vlGnd.receiveShadow=true;scene.add(vlGnd);

  /* ── 바이옴 전환 스트립 ── */
  var trans1M=new THREE.MeshLambertMaterial({color:0x305a18});
  var trans2M=new THREE.MeshLambertMaterial({color:0x152a0c});
  var trans3M=new THREE.MeshLambertMaterial({color:0x120a04});
  /* 마을-초원 (z=18~22) */
  var t1=new THREE.Mesh(new THREE.PlaneGeometry(160,8),trans1M);t1.rotation.x=-Math.PI/2;t1.position.set(0,.012,20);scene.add(t1);
  /* 초원-숲 (z=298~302) */
  var t2=new THREE.Mesh(new THREE.PlaneGeometry(240,8),trans2M);t2.rotation.x=-Math.PI/2;t2.position.set(0,.012,300);scene.add(t2);
  /* 숲-화산 (z=558~562) */
  var t3=new THREE.Mesh(new THREE.PlaneGeometry(240,8),trans3M);t3.rotation.x=-Math.PI/2;t3.position.set(0,.012,560);scene.add(t3);
  /* 초원-늪 좌 (x=-82~-78) */
  var t4=new THREE.Mesh(new THREE.PlaneGeometry(8,280),new THREE.MeshLambertMaterial({color:0x285018}));t4.rotation.x=-Math.PI/2;t4.position.set(-80,.012,160);scene.add(t4);
  /* 초원-늪 우 (x=78~82) */
  var t5=new THREE.Mesh(new THREE.PlaneGeometry(8,280),new THREE.MeshLambertMaterial({color:0x285018}));t5.rotation.x=-Math.PI/2;t5.position.set(80,.012,160);scene.add(t5);
}

/* ════════════ 마을 빌드 ════════════ */
function buildVillage(){
  /* 지면 디테일 */
  scatterGroundDetail(scene,60,20,20,'grass',0,-6);
  scatterGroundDetail(scene,30,18,18,'stone',0,-6);
  scatterGroundDetail(scene,25,16,16,'flower',0,-6);

  /* 조명 — 따뜻한 앰버 톤 */


  /* 건물 주변 포인트 라이트 (따뜻한 글로우) */
  var shopLight1=new THREE.PointLight(0xff9944,.2,18);shopLight1.position.set(0,3,-8);scene.add(shopLight1);

  /* 반투명 안개 평면 (지면 레벨) */
  var fogPlaneM=new THREE.MeshLambertMaterial({color:0xaabb88,transparent:true,opacity:.06});
  [[-8,0,5],[8,0,-15],[0,0,10],[-12,0,-8]].forEach(function(fp){
    var fogP=new THREE.Mesh(new THREE.PlaneGeometry(12+Math.random()*6,10+Math.random()*5),fogPlaneM);
    fogP.rotation.x=-Math.PI/2;fogP.position.set(fp[0],.15,fp[2]);scene.add(fogP);
  });

  /* 구조물 */
  mkStonePath(scene);
  mkWaterRiver(scene);
  mkFountain(scene);
  mkCastle(scene);

  /* 상점 */
  mkStall(-14,-6, .3, 0x8a3a10,0xcc5522,'업그레이드',scene);
  mkStall(-14,-13,.2, 0x1a4a8a,0x3366cc,'아이템',scene);
  mkStall(14,-6, -.3, 0x3a6a10,0x558833,'퀘스트',scene);
  mkStall(14,-13,-.2, 0x8a4a1a,0xcc8833,'무기점',scene);
  mkStall(-6,-18,.15, 0x6a1a1a,0xaa3333,'포션',scene);
  mkStall(6,-18,-.15, 0x1a4a2a,0x336644,'방어구',scene);

  /* 횃불 */
  var torchPos=[[-7,-1,1],[7,-1,1],[-7,-15,1],[7,-15,1],[-1,-19,1],[1,-19,1]];
  var poleMat=new THREE.MeshLambertMaterial({color:0x3a2a10});
  var fireMat=new THREE.MeshBasicMaterial({color:0xff8820});
  torchPos.forEach(function(tp){
    var pl=new THREE.PointLight(0xff8830,2.0,14);pl.position.set(tp[0],2.2,tp[2]);scene.add(pl);
    var pole=new THREE.Mesh(new THREE.CylinderGeometry(.06,.08,2,6),poleMat);pole.position.set(tp[0],1,tp[2]);pole.castShadow=true;scene.add(pole);
    var fire=new THREE.Mesh(new THREE.SphereGeometry(.13,8,8),fireMat);fire.position.set(tp[0],2.2,tp[2]);scene.add(fire);
  });

  /* 마을 나무 */
  var treeLayout=[
    [-16,5],[-18,-2],[-17,-8],[-16,-16],[-18,-22],[-15,-26],
    [16,5],[18,-2],[17,-8],[16,-16],[18,-22],[15,-26],
    [-10,10],[-5,13],[0,14],[5,13],[10,10],
    [-12,7],[12,7],
    [-12,-30],[-8,-32],[0,-34],[8,-32],[12,-30],
    [-20,-18],[-22,-10],[20,-18],[22,-10],
  ];
  treeLayout.forEach(function(pp){mkTree(pp[0],pp[1],.8+Math.random()*.6,scene);});

  /* NPC */
  var lov=document.getElementById('lov');
  npcs=[];
  NPC_DEF.forEach(function(def){
    var h=mkHuman(def.bc,def.hc);
    h.group.position.set(def.px,0,def.pz);
    h.group.rotation.y=Math.random()*Math.PI*2;
    scene.add(h.group);
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

/* ════════════ 반딧불 파티클 시스템 ════════════ */
function buildFireflies(){
  /* 원형 텍스처를 캔버스로 생성 */
  var cvs=document.createElement('canvas');cvs.width=32;cvs.height=32;
  var ctx=cvs.getContext('2d');
  var grad=ctx.createRadialGradient(16,16,0,16,16,16);
  grad.addColorStop(0,'rgba(180,255,150,1)');
  grad.addColorStop(.4,'rgba(120,255,80,.6)');
  grad.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=grad;ctx.fillRect(0,0,32,32);
  var tex=new THREE.CanvasTexture(cvs);

  var COUNT=120;
  var pos=new Float32Array(COUNT*3);
  fireflyBaseY=new Float32Array(COUNT);
  fireflyPhases=new Float32Array(COUNT);

  for(var i=0;i<COUNT;i++){
    /* scatter around village and meadow mostly */
    var px=(Math.random()-.5)*240;
    var py=0.5+Math.random()*3.5;
    var pz=-30+(Math.random())*320;
    pos[i*3]=px;pos[i*3+1]=py;pos[i*3+2]=pz;
    fireflyBaseY[i]=py;
    fireflyPhases[i]=Math.random()*Math.PI*2;
  }

  var geom=new THREE.BufferGeometry();
  geom.setAttribute('position',new THREE.BufferAttribute(pos,3));
  fireflyPositions=pos;

  var mat=new THREE.PointsMaterial({
    color:0xaaffaa,
    size:.35,
    map:tex,
    transparent:true,
    depthWrite:false,
    blending:THREE.AdditiveBlending,
    sizeAttenuation:true
  });
  fireflyPoints=new THREE.Points(geom,mat);
  scene.add(fireflyPoints);
}

/* ════════════ 스카이돔 ════════════ */
function buildSkydome(){
  /* 대형 구체 — 내부 면을 바라보도록 */
  var skyGeo=new THREE.SphereGeometry(900,32,16);
  /* top: deep night blue, bottom: dark purple-blue horizon */
  var skyMat=new THREE.ShaderMaterial({
    uniforms:{
      topColor:{value:new THREE.Color(0x4488cc)},
      horizonColor:{value:new THREE.Color(0x87ceeb)},
      offset:{value:0.3},
      exponent:{value:0.6}
    },
    vertexShader:[
      'varying vec3 vWorldPosition;',
      'void main(){',
      '  vec4 worldPosition=modelMatrix*vec4(position,1.0);',
      '  vWorldPosition=worldPosition.xyz;',
      '  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);',
      '}'
    ].join('\n'),
    fragmentShader:[
      'uniform vec3 topColor;',
      'uniform vec3 horizonColor;',
      'uniform float offset;',
      'uniform float exponent;',
      'varying vec3 vWorldPosition;',
      'void main(){',
      '  float h=normalize(vWorldPosition).y+offset;',
      '  gl_FragColor=vec4(mix(horizonColor,topColor,max(pow(max(h,0.0),exponent),0.0)),1.0);',
      '}'
    ].join('\n'),
    side:THREE.BackSide
  });
  var sky=new THREE.Mesh(skyGeo,skyMat);
  scene.add(sky);
}

/* ════════════ initScene ════════════ */
function initScene(){
  var canvas=document.getElementById('gc');
  renderer=new THREE.WebGLRenderer({canvas:canvas,antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));

  /* ── 그림자 활성화 ── */
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.BasicShadowMap;

  /* scene 배경은 스카이돔이 대신하므로 투명하게 */
  scene=new THREE.Scene();
  scene.background=new THREE.Color(0x87ceeb);

  /* ── 대기 안개 — FogExp2로 더 자연스럽게 ── */
  scene.fog=new THREE.FogExp2(0x9bc4e0,.002);

  camera=new THREE.PerspectiveCamera(60,1,.1,1200);
  camera.position.set(0,10,18);

  /* ── 스카이돔 ── */
  buildSkydome();

  /* ── 전역 조명 개선 ── */
  /* 1) 쿨 앰비언트 (낮은 강도) */
  scene.add(new THREE.AmbientLight(0xffffff,.35));

  /* 2) 헤미스피어 라이트 — 하늘(파랑)↔지면(갈색) */
  var hemi=new THREE.HemisphereLight(0x87ceeb,0x556633,.6);
  scene.add(hemi);

  /* 3) 태양(방향광) — 따뜻한 황금빛, 그림자 활성화 */
  var sun=new THREE.DirectionalLight(0xfff0d0,.8);
  sun.position.set(-120,200,400);
  sun.castShadow=true;
  sun.shadow.mapSize.width=1024;
  sun.shadow.mapSize.height=1024;
  sun.shadow.camera.near=0.5;
  sun.shadow.camera.far=900;
  sun.shadow.camera.left=-220;
  sun.shadow.camera.right=220;
  sun.shadow.camera.top=220;
  sun.shadow.camera.bottom=-220;
  sun.shadow.bias=-0.0005;
  scene.add(sun);

  /* 달 + 별 */
  var moon=new THREE.Mesh(new THREE.SphereGeometry(10,16,16),new THREE.MeshBasicMaterial({color:0xfffde8}));
  moon.position.set(-200,280,-400);scene.add(moon);
  /* moonL 제거 — 성능 최적화 */

  var STAR_COUNT=4000,sp=new Float32Array(STAR_COUNT*3);
  for(var i=0;i<STAR_COUNT;i++){
    var th=Math.random()*Math.PI*2,ph=Math.acos(2*Math.random()-1)*0.45,r=600;
    sp[i*3]=r*Math.sin(ph)*Math.cos(th);sp[i*3+1]=r*Math.abs(Math.cos(ph))+5;sp[i*3+2]=r*Math.sin(ph)*Math.sin(th);
  }
  var sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.BufferAttribute(sp,3));
  scene.add(new THREE.Points(sg,new THREE.PointsMaterial({color:0xffffff,size:.3,sizeAttenuation:true})));

  /* 바이옴 지면 */
  buildGroundPlanes();

  /* 마을 건물/NPC */
  buildVillage();

  /* 마을 장식 (시계탑, 주택, 우물, 울타리, 게이트, 꽃밭, 배럴, 깃발, 벤치, 가로등) */
  buildVillageDecor();

  /* 전체 사냥 구역 빌드 (몬스터 + 지형 장식) */
  buildOpenWorld();

  /* 바이옴별 장식 */
  buildMeadowDecor();
  buildForestDecor();
  buildSwampDecor();
  buildVolcanoDecor();
  buildBossDecor();

  /* 반딧불 파티클 */
  buildFireflies();

  /* 플레이어 */
  var ph2=mkHuman(0x2a6a3a,0xddcc99);
  PL.group=ph2.group;PL.legL=ph2.legL;PL.legR=ph2.legR;
  PL.armL=ph2.armL;PL.armR=ph2.armR;PL.armRPivot=ph2.armRPivot;
  PL.weaponMesh=null;PL.bobT=0;PL.atkAnim=0;PL.atkPhase=0;
  /* 플레이어도 그림자 */
  PL.group.traverse(function(c){if(c.isMesh){c.castShadow=true;c.receiveShadow=true;}});
  var ws=WORLD_SPAWN;PL.group.position.set(ws[0],0,ws[1]);scene.add(PL.group);

  /* 플레이어 이름표 */
  var lov=document.getElementById('lov');
  var ple=document.createElement('div');ple.className='llabel plr';ple.id='ple';ple.textContent=myName;lov.appendChild(ple);

  /* ── Bloom 포스트프로세싱 ── */
  try{
    if(typeof THREE.EffectComposer!=='undefined'&&typeof THREE.UnrealBloomPass!=='undefined'){
      composer=new THREE.EffectComposer(renderer);
      var renderPass=new THREE.RenderPass(scene,camera);
      composer.addPass(renderPass);
      var bloomPass=new THREE.UnrealBloomPass(
        new THREE.Vector2(window.innerWidth,window.innerHeight),
        0.0,    /* strength — disabled */
        0.4,    /* radius */
        1.0     /* threshold */
      );
      composer.addPass(bloomPass);
    }
  }catch(e){
    console.warn('Bloom post-processing unavailable:',e);
    composer=null;
  }

  setupInput();onResize();window.addEventListener('resize',onResize);

  /* 초기 존 배너 */
  currentZone='village';
  document.querySelector('.hloc').textContent='▸ 시작 마을';

  renderer.setAnimationLoop(loop);
}

function onResize(){
  var c=document.getElementById('cc'),w=c.clientWidth,h=c.clientHeight;
  if(w>0&&h>0){
    renderer.setSize(w,h);
    camera.aspect=w/h;camera.updateProjectionMatrix();
    if(composer)composer.setSize(w,h);
  }
}

function updCam(){
  var p=PL.group.position;
  var tx=p.x+14*Math.sin(cYaw)*Math.cos(cPitch);
  var ty=p.y+14*Math.sin(cPitch)+2.5;
  var tz=p.z+14*Math.cos(cYaw)*Math.cos(cPitch);
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
}

/* ════════════ 파티클 + 물 UV 업데이트 ════════════ */
function updVisualFX(t){
  /* 반딧불 떠오르기 + 펄스 */
  if(fireflyPoints&&fireflyPositions){
    var pos=fireflyPositions;
    var COUNT=pos.length/3;
    for(var i=0;i<COUNT;i++){
      pos[i*3+1]=fireflyBaseY[i]+Math.sin(t*1.1+fireflyPhases[i])*0.6;
      /* 수평 표류 */
      pos[i*3]+=Math.sin(t*.3+fireflyPhases[i]*2)*.004;
      pos[i*3+2]+=Math.cos(t*.25+fireflyPhases[i])*.004;
    }
    fireflyPoints.geometry.attributes.position.needsUpdate=true;
    /* 파티클 크기 펄스 */
    fireflyPoints.material.size=.28+Math.sin(t*2.2)*.12;
  }

  /* 강물 UV 오프셋 애니메이션 */
  riverUVOffset+=0.0015;
  waterMeshes.forEach(function(mesh){
    if(mesh.geometry&&mesh.geometry.attributes.uv){
      var uvAttr=mesh.geometry.attributes.uv;
      for(var j=0;j<uvAttr.count;j++){
        /* 원본 UV의 v 성분에 오프셋 적용 */
        uvAttr.setY(j,(uvAttr.getY(j)+0.0015)%1.0);
      }
      uvAttr.needsUpdate=true;
    }
  });
}

function chkNpc(){
  closestNpc=null;var md=4.5;
  npcs.forEach(function(n){
    var dx=PL.group.position.x-n.mesh.position.x,dz=PL.group.position.z-n.mesh.position.z;
    var d=Math.sqrt(dx*dx+dz*dz);if(d<md){md=d;closestNpc=n;}
  });
}

/* ════════════ 마을 장식 빌드 ════════════ */

/* ── 시계탑/종탑 ── */
function mkClockTower(parent){
  var g=new THREE.Group();
  var p=parent||scene;
  var stoneM=new THREE.MeshLambertMaterial({color:0x7a7060});
  var darkStoneM=new THREE.MeshLambertMaterial({color:0x5a5248});
  var roofM=new THREE.MeshLambertMaterial({color:0x4a3a28});
  var windowM=new THREE.MeshLambertMaterial({color:0x1a1008});

  /* 기단 */
  var base=new THREE.Mesh(new THREE.BoxGeometry(3.6,0.5,3.6),darkStoneM);
  base.position.set(0,0.25,0);base.castShadow=true;base.receiveShadow=true;g.add(base);

  /* 1층 */
  var s1=new THREE.Mesh(new THREE.BoxGeometry(3.2,3.5,3.2),stoneM);
  s1.position.set(0,2,0);s1.castShadow=true;s1.receiveShadow=true;g.add(s1);

  /* 2층 (약간 좁아짐) */
  var s2=new THREE.Mesh(new THREE.BoxGeometry(2.8,3,2.8),stoneM);
  s2.position.set(0,5.25,0);s2.castShadow=true;s2.receiveShadow=true;g.add(s2);

  /* 3층 */
  var s3=new THREE.Mesh(new THREE.BoxGeometry(2.4,2.8,2.4),darkStoneM);
  s3.position.set(0,8.15,0);s3.castShadow=true;s3.receiveShadow=true;g.add(s3);

  /* 4층 (종탑) */
  var s4=new THREE.Mesh(new THREE.BoxGeometry(2.0,2.2,2.0),stoneM);
  s4.position.set(0,10.7,0);s4.castShadow=true;s4.receiveShadow=true;g.add(s4);

  /* 뾰족 지붕 */
  var roof=new THREE.Mesh(new THREE.ConeGeometry(1.6,3.5,4),roofM);
  roof.position.set(0,13.55,0);roof.rotation.y=Math.PI/4;roof.castShadow=true;g.add(roof);

  /* 창문 (각 층 앞면) */
  [[0,3.5,1.65],[0,6.5,1.45],[0,9.0,1.25],[0,11.0,1.05]].forEach(function(wp){
    var win=new THREE.Mesh(new THREE.BoxGeometry(0.55,0.8,0.12),windowM);
    win.position.set(wp[0],wp[1],wp[2]);g.add(win);
    /* 뒷면 창문 */
    var winB=new THREE.Mesh(new THREE.BoxGeometry(0.55,0.8,0.12),windowM);
    winB.position.set(wp[0],wp[1],-wp[2]);g.add(winB);
  });

  /* 층간 몰딩 */
  [3.75,6.75,9.55,11.8].forEach(function(my){
    var mold=new THREE.Mesh(new THREE.BoxGeometry(3.3,0.22,3.3),darkStoneM);
    mold.position.set(0,my,0);mold.castShadow=true;g.add(mold);
  });

  /* 꼭대기 깃발 */
  var flagPole=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,2.5,6),
    new THREE.MeshLambertMaterial({color:0x5a3a10}));
  flagPole.position.set(0,16.55,0);flagPole.castShadow=true;g.add(flagPole);
  var flag=new THREE.Mesh(new THREE.BoxGeometry(0.9,0.55,0.06),
    new THREE.MeshLambertMaterial({color:0xcc2222}));
  flag.position.set(0.5,17.35,0);g.add(flag);

  g.position.set(-8,0,5);p.add(g);
}

/* ── 마을 주택들 ── */
function mkHouses(parent){
  var p=parent||scene;

  /* 공통 재료 */
  var beamM=new THREE.MeshLambertMaterial({color:0x4a2e0a});
  var plasterM=new THREE.MeshLambertMaterial({color:0xe8dfc0});
  var plaster2M=new THREE.MeshLambertMaterial({color:0xd4c9a0});
  var plaster3M=new THREE.MeshLambertMaterial({color:0xcce0cc});
  var roofR=new THREE.MeshLambertMaterial({color:0x8b2a2a});
  var roofB=new THREE.MeshLambertMaterial({color:0x2a4a8a});
  var roofG=new THREE.MeshLambertMaterial({color:0x336633});
  var doorM=new THREE.MeshLambertMaterial({color:0x2a1800});
  var winM=new THREE.MeshLambertMaterial({color:0x1a1008});

  function makeHouse(x,z,w,h,d,wallMat,roofMat,rotY){
    var g=new THREE.Group();

    /* 기단 */
    var fd=new THREE.Mesh(new THREE.BoxGeometry(w+0.4,0.35,d+0.4),
      new THREE.MeshLambertMaterial({color:0x6a6050}));
    fd.position.set(0,0.175,0);fd.castShadow=true;fd.receiveShadow=true;g.add(fd);

    /* 벽 본체 */
    var bd=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),wallMat);
    bd.position.set(0,h/2+0.35,0);bd.castShadow=true;bd.receiveShadow=true;g.add(bd);

    /* 목재 보 — 가로 */
    [-0.3,0.3].forEach(function(yOff){
      var bm=new THREE.Mesh(new THREE.BoxGeometry(w+0.1,0.12,0.1),beamM);
      bm.position.set(0,h/2+0.35+yOff*(h*0.4),d/2+0.05);bm.castShadow=true;g.add(bm);
    });
    /* 목재 보 — 세로 (X 패턴) */
    [-w/4,w/4].forEach(function(xOff){
      var bv=new THREE.Mesh(new THREE.BoxGeometry(0.1,h*0.5,0.1),beamM);
      bv.position.set(xOff,h/2+0.35,d/2+0.05);bv.castShadow=true;g.add(bv);
    });

    /* 삼각 지붕 */
    var rf=new THREE.Mesh(new THREE.ConeGeometry(Math.max(w,d)*0.72,2.2,4),roofMat);
    rf.position.set(0,h+0.35+1.1,0);rf.rotation.y=Math.PI/4;rf.castShadow=true;g.add(rf);

    /* 굴뚝 */
    var chim=new THREE.Mesh(new THREE.BoxGeometry(0.35,1.0,0.35),
      new THREE.MeshLambertMaterial({color:0x5a4a3a}));
    chim.position.set(w/4,h+0.35+1.6,0);chim.castShadow=true;g.add(chim);

    /* 문 */
    var dr=new THREE.Mesh(new THREE.BoxGeometry(0.65,1.2,0.1),doorM);
    dr.position.set(0,0.35+0.6,d/2+0.05);g.add(dr);

    /* 창문 */
    [[-w/2+0.9,0],[w/2-0.9,0]].forEach(function(wo){
      var win=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.5,0.1),winM);
      win.position.set(wo[0],h/2+0.35,d/2+0.05);g.add(win);
    });

    g.position.set(x,0,z);
    if(rotY)g.rotation.y=rotY;
    p.add(g);
    return g;
  }

  /* 집 1: 북서쪽 크림색 집 */
  makeHouse(-12,-4, 4,3,3, plasterM,roofR, 0.1);
  /* 집 2: 남서쪽 연갈색 집 (조금 더 큼) */
  makeHouse(-10,-16, 4.5,3.2,3.2, plaster2M,roofB, -0.05);
  /* 집 3: 동쪽 초록 빛 집 */
  makeHouse(10,-3, 3.5,2.8,2.8, plaster3M,roofG, -0.12);
  /* 집 4: 남동쪽 작은 집 */
  makeHouse(12,-16, 3.2,2.6,2.6, plasterM,roofR, 0.08);
}

/* ── 우물 ── */
function mkWell(parent){
  var g=new THREE.Group();
  var p=parent||scene;
  var stoneM=new THREE.MeshLambertMaterial({color:0x888070});
  var darkStoneM=new THREE.MeshLambertMaterial({color:0x6a6050});
  var woodM=new THREE.MeshLambertMaterial({color:0x5a3a10});
  var ropeM=new THREE.MeshLambertMaterial({color:0xc8a864});
  var waterM=new THREE.MeshLambertMaterial({color:0x3388bb,transparent:true,opacity:0.75});

  /* 우물 돌 기반 */
  var base=new THREE.Mesh(new THREE.CylinderGeometry(1.0,1.1,0.6,12),stoneM);
  base.position.set(0,0.3,0);base.castShadow=true;base.receiveShadow=true;g.add(base);

  /* 우물 벽 */
  var wall=new THREE.Mesh(new THREE.CylinderGeometry(0.85,0.9,0.9,12,1,true),darkStoneM);
  wall.position.set(0,0.9,0);wall.castShadow=true;wall.receiveShadow=true;g.add(wall);

  /* 물 면 */
  var water=new THREE.Mesh(new THREE.CylinderGeometry(0.82,0.82,0.05,12),waterM);
  water.position.set(0,0.88,0);g.add(water);

  /* 목재 기둥 두 개 */
  var post1=new THREE.Mesh(new THREE.BoxGeometry(0.15,1.8,0.15),woodM);
  post1.position.set(-0.7,1.9,0);post1.castShadow=true;g.add(post1);
  var post2=new THREE.Mesh(new THREE.BoxGeometry(0.15,1.8,0.15),woodM);
  post2.position.set(0.7,1.9,0);post2.castShadow=true;g.add(post2);

  /* 가로대 */
  var cross=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,1.55,6),woodM);
  cross.position.set(0,2.8,0);cross.rotation.z=Math.PI/2;cross.castShadow=true;g.add(cross);

  /* 삼각 지붕 */
  var roofM2=new THREE.MeshLambertMaterial({color:0x4a2e0a});
  var rf=new THREE.Mesh(new THREE.ConeGeometry(1.1,0.9,4),roofM2);
  rf.position.set(0,3.1,0);rf.rotation.y=Math.PI/4;rf.castShadow=true;g.add(rf);

  /* 로프 */
  var rope=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,1.4,5),ropeM);
  rope.position.set(0,2.1,0);rope.castShadow=true;g.add(rope);

  /* 양동이 */
  var bucket=new THREE.Mesh(new THREE.CylinderGeometry(0.14,0.11,0.22,8),
    new THREE.MeshLambertMaterial({color:0x8a5520}));
  bucket.position.set(0,1.35,0);bucket.castShadow=true;g.add(bucket);

  /* 기단 자갈 */
  var ring=new THREE.Mesh(new THREE.CylinderGeometry(1.4,1.4,0.08,16),
    new THREE.MeshLambertMaterial({color:0xa09080}));
  ring.position.set(0,0.04,0);ring.receiveShadow=true;g.add(ring);

  g.position.set(8,-12,0);p.add(g);
}

/* ── 나무 울타리 ── */
function mkFences(parent){
  var p=parent||scene;
  var postM=new THREE.MeshLambertMaterial({color:0x5a3810});
  var railM=new THREE.MeshLambertMaterial({color:0x6e4c1a});

  function fenceRow(x1,z1,x2,z2,count){
    var dx=x2-x1,dz=z2-z1;
    var len=Math.sqrt(dx*dx+dz*dz);
    var ang=Math.atan2(dx,dz);
    for(var i=0;i<=count;i++){
      var t=i/count;
      var fx=x1+dx*t,fz=z1+dz*t;
      /* 기둥 */
      var post=new THREE.Mesh(new THREE.BoxGeometry(0.15,1.2,0.15),postM);
      post.position.set(fx,0.6,fz);post.castShadow=true;post.receiveShadow=true;p.add(post);
    }
    /* 가로대 두 줄 */
    [0.5,0.85].forEach(function(h){
      var rail=new THREE.Mesh(new THREE.BoxGeometry(0.08,0.08,len),railM);
      rail.position.set((x1+x2)/2,h,(z1+z2)/2);
      rail.rotation.y=ang;rail.castShadow=true;p.add(rail);
    });
  }

  /* 마을 서쪽 울타리 */
  fenceRow(-22,12,-22,-28,16);
  /* 마을 동쪽 울타리 */
  fenceRow(22,12,22,-28,16);
  /* 마을 북쪽 (성 방향 제외) */
  fenceRow(-22,12,-12,12,4);
  fenceRow(12,12,22,12,4);
  /* 남쪽 게이트 옆 */
  fenceRow(-22,-28,-9,-28,5);
  fenceRow(9,-28,22,-28,5);
}

/* ── 석조 아치 입구 ── */
function mkGate(parent){
  var g=new THREE.Group();
  var p=parent||scene;
  var stoneM=new THREE.MeshLambertMaterial({color:0x7a7060});
  var darkM=new THREE.MeshLambertMaterial({color:0x5a5248});
  var archM=new THREE.MeshLambertMaterial({color:0x6a6050});

  /* 왼쪽 기둥 */
  var pilL=new THREE.Mesh(new THREE.BoxGeometry(2,5.5,2),stoneM);
  pilL.position.set(-4,2.75,0);pilL.castShadow=true;pilL.receiveShadow=true;g.add(pilL);
  /* 오른쪽 기둥 */
  var pilR=new THREE.Mesh(new THREE.BoxGeometry(2,5.5,2),stoneM);
  pilR.position.set(4,2.75,0);pilR.castShadow=true;pilR.receiveShadow=true;g.add(pilR);

  /* 기둥 캡 */
  [[-4,5.75],[4,5.75]].forEach(function(cp){
    var cap=new THREE.Mesh(new THREE.BoxGeometry(2.4,0.55,2.4),darkM);
    cap.position.set(cp[0],cp[1],0);cap.castShadow=true;cap.receiveShadow=true;g.add(cap);
    /* 캡 위 작은 장식 */
    var topper=new THREE.Mesh(new THREE.ConeGeometry(0.5,0.8,4),
      new THREE.MeshLambertMaterial({color:0xc8a800}));
    topper.position.set(cp[0],6.35,0);topper.rotation.y=Math.PI/4;topper.castShadow=true;g.add(topper);
  });

  /* 아치 연결부 (링크 빔) */
  var lintel=new THREE.Mesh(new THREE.BoxGeometry(8,0.8,1.8),darkM);
  lintel.position.set(0,5.2,0);lintel.castShadow=true;lintel.receiveShadow=true;g.add(lintel);

  /* 반원 아치 */
  var arch=new THREE.Mesh(new THREE.TorusGeometry(2.2,0.4,8,14,Math.PI),archM);
  arch.position.set(0,5.6,0);arch.rotation.z=Math.PI;arch.castShadow=true;g.add(arch);

  /* 기둥 측면 돌출 디테일 */
  [[-4,1.5],[4,1.5],[-4,3.5],[4,3.5]].forEach(function(dp){
    var det=new THREE.Mesh(new THREE.BoxGeometry(2.3,0.2,2.2),darkM);
    det.position.set(dp[0],dp[1],0);g.add(det);
  });

  /* 기단 계단 */
  var stepM=new THREE.MeshLambertMaterial({color:0x706050});
  [0,1].forEach(function(i){
    var step=new THREE.Mesh(new THREE.BoxGeometry(10,0.2,1.4),stepM);
    step.position.set(0,0.1+i*0.2,0.7+i*0.7);step.castShadow=true;step.receiveShadow=true;g.add(step);
    var stepB=new THREE.Mesh(new THREE.BoxGeometry(10,0.2,1.4),stepM);
    stepB.position.set(0,0.1+i*0.2,-0.7-i*0.7);stepB.castShadow=true;stepB.receiveShadow=true;g.add(stepB);
  });

  g.position.set(0,0,-28);p.add(g);
}

/* ── 화단/꽃밭 ── */
function mkFlowerBeds(parent){
  var p=parent||scene;
  var soilM=new THREE.MeshLambertMaterial({color:0x5a3a18});
  var stemM=new THREE.MeshLambertMaterial({color:0x2a6a18});

  var flowerColors=[0xff6688,0xffcc22,0xffffff,0xcc88ff,0xff8844,0x88ccff,0xff4444];

  function flowerBed(cx,cz,count){
    var bedG=new THREE.Group();
    /* 흙 받침 */
    var soil=new THREE.Mesh(new THREE.BoxGeometry(2.2,0.15,1.4),soilM);
    soil.position.set(0,0.075,0);soil.receiveShadow=true;bedG.add(soil);
    /* 낮은 돌 테두리 */
    var borderM=new THREE.MeshLambertMaterial({color:0x888070});
    [[0,0.12,0.72],[0,0.12,-0.72],[1.1,0.12,0],[-1.1,0.12,0]].forEach(function(bp,bi){
      var bw=bi<2?2.4:0.15,bd2=bi<2?0.15:1.44;
      var border=new THREE.Mesh(new THREE.BoxGeometry(bw,0.22,bd2),borderM);
      border.position.set(bp[0],bp[1],bp[2]);border.castShadow=true;bedG.add(border);
    });
    /* 꽃들 */
    for(var i=0;i<count;i++){
      var fx=(Math.random()-0.5)*1.8,fz=(Math.random()-0.5)*1.1;
      var fc=flowerColors[Math.floor(Math.random()*flowerColors.length)];
      var stemH=0.18+Math.random()*0.14;
      var stem=new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.025,stemH,5),stemM);
      stem.position.set(fx,0.15+stemH/2,fz);bedG.add(stem);
      var petal=new THREE.Mesh(new THREE.SphereGeometry(0.085+Math.random()*0.04,6,5),
        new THREE.MeshLambertMaterial({color:fc}));
      petal.position.set(fx,0.15+stemH+0.06,fz);bedG.add(petal);
      /* 잎 */
      var leaf=new THREE.Mesh(new THREE.BoxGeometry(0.08,0.04,0.06),stemM);
      leaf.position.set(fx+0.05,0.15+stemH*0.5,fz);leaf.rotation.z=0.4;bedG.add(leaf);
    }
    bedG.position.set(cx,0,cz);
    p.add(bedG);
  }

  /* 집들 근처, 길가 화단 */
  flowerBed(-12,-6, 12);
  flowerBed(10,-5,  10);
  flowerBed(-10,-14,10);
  flowerBed(12,-14, 10);
  flowerBed(-4,-20, 8);
  flowerBed(4,-20,  8);
  flowerBed(0,-3,   10);
  flowerBed(-6,-1,  8);
  flowerBed(6,-1,   8);
}

/* ── 배럴/상자 ── */
function mkBarrelsAndCrates(parent){
  var p=parent||scene;
  var barrelM=new THREE.MeshLambertMaterial({color:0x6a3a10});
  var hoopM=new THREE.MeshLambertMaterial({color:0x4a4a4a});
  var crateM=new THREE.MeshLambertMaterial({color:0x8a6030});
  var crateLineM=new THREE.MeshLambertMaterial({color:0x5a3a18});

  function barrel(x,z,sx,sz){
    var g=new THREE.Group();
    var body=new THREE.Mesh(new THREE.CylinderGeometry(0.32,0.28,0.7,8),barrelM);
    body.position.set(0,0.35,0);body.castShadow=true;body.receiveShadow=true;g.add(body);
    /* 철 고리 */
    [0.22,0.5].forEach(function(hy){
      var hoop=new THREE.Mesh(new THREE.TorusGeometry(0.32,0.04,6,12),hoopM);
      hoop.position.set(0,hy,0);hoop.rotation.x=Math.PI/2;g.add(hoop);
    });
    g.position.set(x,0,z);g.rotation.y=Math.random()*Math.PI;p.add(g);
  }
  function crate(x,z){
    var g=new THREE.Group();
    var s=0.55+Math.random()*0.25;
    var box=new THREE.Mesh(new THREE.BoxGeometry(s,s,s),crateM);
    box.position.set(0,s/2,0);box.castShadow=true;box.receiveShadow=true;g.add(box);
    /* 나무 결 선 */
    var sl=new THREE.Mesh(new THREE.BoxGeometry(s+0.01,0.04,s+0.01),crateLineM);
    sl.position.set(0,s/2,0);g.add(sl);
    g.position.set(x,0,z);g.rotation.y=Math.random()*0.6;p.add(g);
  }

  /* 상점 근처 */
  barrel(-16,-5, 0,0);barrel(-16,-6.5,0,0);barrel(-16,-8,0,0);
  barrel(16,-5,0,0);barrel(16,-7,0,0);
  crate(-17,-5,0);crate(-17,-7,0);
  barrel(-5,-21,0,0);barrel(-4,-22,0,0);
  crate(5,-21,0);crate(7,-20,0);
  barrel(15,-14,0,0);crate(16,-15,0);
  /* 우물 옆 */
  barrel(10,-11,0,0);barrel(11,-13,0,0);
  /* 시계탑 옆 */
  barrel(-10,4,0,0);crate(-9,5,0);
}

/* ── 깃발/배너 ── */
function mkBanners(parent){
  var p=parent||scene;
  var poleM=new THREE.MeshLambertMaterial({color:0x5a3a10});
  var bannerColors=[0xcc2222,0x2244cc,0x228822,0xcc8800];
  var decorM=new THREE.MeshLambertMaterial({color:0xffd700});

  function banner(x,z,bc){
    var g=new THREE.Group();
    /* 깃대 */
    var pole=new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.1,6,7),poleM);
    pole.position.set(0,3,0);pole.castShadow=true;pole.receiveShadow=true;g.add(pole);
    /* 천 배너 */
    var cloth=new THREE.Mesh(new THREE.BoxGeometry(0.8,1.6,0.06),
      new THREE.MeshLambertMaterial({color:bc}));
    cloth.position.set(0.45,4.9,0);g.add(cloth);
    /* 배너 아래 술 장식 */
    for(var i=-1;i<=1;i++){
      var fringe=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.3,0.06),decorM);
      fringe.position.set(0.45+i*0.25,4.0,0);g.add(fringe);
    }
    /* 금색 끝단 */
    var tip=new THREE.Mesh(new THREE.ConeGeometry(0.14,0.35,6),decorM);
    tip.position.set(0,6.2,0);tip.castShadow=true;g.add(tip);

    g.position.set(x,0,z);p.add(g);
  }

  /* 게이트 양옆 */
  banner(-6,-27, bannerColors[0]);
  banner(6,-27,  bannerColors[1]);
  /* 성 입구 주변 */
  banner(-10,-22,bannerColors[2]);
  banner(10,-22, bannerColors[3]);
  /* 광장 코너 */
  banner(-7,2,   bannerColors[0]);
  banner(7,2,    bannerColors[2]);
}

/* ── 벤치 ── */
function mkBenches(parent){
  var p=parent||scene;
  var woodM=new THREE.MeshLambertMaterial({color:0x6e4010});
  var legM=new THREE.MeshLambertMaterial({color:0x5a3a0a});

  function bench(x,z,rotY){
    var g=new THREE.Group();
    /* 앉는 판 */
    var seat=new THREE.Mesh(new THREE.BoxGeometry(1.8,0.12,0.5),woodM);
    seat.position.set(0,0.6,0);seat.castShadow=true;seat.receiveShadow=true;g.add(seat);
    /* 등받이 */
    var back=new THREE.Mesh(new THREE.BoxGeometry(1.8,0.45,0.1),woodM);
    back.position.set(0,0.9,-0.2);back.castShadow=true;g.add(back);
    /* 등받이 지지대 */
    [-0.6,0,0.6].forEach(function(bx){
      var sup=new THREE.Mesh(new THREE.BoxGeometry(0.1,0.35,0.1),legM);
      sup.position.set(bx,0.72,-0.2);g.add(sup);
    });
    /* 다리 4개 */
    [[-0.7,0.18,-0.15],[-0.7,0.18,0.15],[0.7,0.18,-0.15],[0.7,0.18,0.15]].forEach(function(lp){
      var leg=new THREE.Mesh(new THREE.BoxGeometry(0.1,0.5,0.1),legM);
      leg.position.set(lp[0],lp[1],lp[2]);leg.castShadow=true;g.add(leg);
    });
    g.position.set(x,0,z);g.rotation.y=rotY||0;p.add(g);
  }

  /* 광장 길가 벤치들 */
  bench(-4,-4,  0);
  bench(4,-4,   Math.PI);
  bench(-4,-12, 0);
  bench(4,-12,  Math.PI);
  bench(0,-20,  Math.PI/2);
  bench(-7,-8,  Math.PI/2);
  bench(7,-8,   -Math.PI/2);
}

/* ── 가로등 (중세 등불) ── */
function mkLampPosts(parent){
  var p=parent||scene;
  var ironM=new THREE.MeshLambertMaterial({color:0x2a2a2a});
  var baseM=new THREE.MeshLambertMaterial({color:0x4a4040});
  var glassM=new THREE.MeshLambertMaterial({color:0xffdd88,transparent:true,opacity:0.7});
  var capM=new THREE.MeshLambertMaterial({color:0x222222});

  function lampPost(x,z){
    var g=new THREE.Group();
    /* 기단 */
    var base=new THREE.Mesh(new THREE.BoxGeometry(0.35,0.25,0.35),baseM);
    base.position.set(0,0.125,0);base.castShadow=true;base.receiveShadow=true;g.add(base);
    /* 폴대 */
    var pole=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.08,3.5,7),ironM);
    pole.position.set(0,1.875,0);pole.castShadow=true;g.add(pole);
    /* 팔 (옆으로 뻗는 부분) */
    var arm=new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,0.7,6),ironM);
    arm.position.set(0.35,3.5,0);arm.rotation.z=Math.PI/2;g.add(arm);
    /* 등롱 케이스 */
    var lantern=new THREE.Mesh(new THREE.BoxGeometry(0.32,0.42,0.32),glassM);
    lantern.position.set(0.7,3.38,0);g.add(lantern);
    /* 등롱 캡 */
    var cap=new THREE.Mesh(new THREE.ConeGeometry(0.22,0.28,4),capM);
    cap.position.set(0.7,3.65,0);cap.rotation.y=Math.PI/4;g.add(cap);
    /* 등롱 프레임 */
    var frame=new THREE.Mesh(new THREE.BoxGeometry(0.36,0.46,0.36),
      new THREE.MeshLambertMaterial({color:0x1a1a1a,wireframe:true}));
    frame.position.set(0.7,3.38,0);g.add(frame);
    /* 포인트 라이트 */
    var pl=new THREE.PointLight(0xffcc66,1.2,10);
    pl.position.set(0.7,3.3,0);g.add(pl);

    g.position.set(x,0,z);p.add(g);
  }

  /* 길가 양쪽 등불 */
  lampPost(-3.5,-2);  lampPost(3.5,-2);
  lampPost(-3.5,-10); lampPost(3.5,-10);
  lampPost(-3.5,-18); lampPost(3.5,-18);
  lampPost(-3.5,-26); lampPost(3.5,-26);
  /* 게이트 옆 */
  lampPost(-8,-28); lampPost(8,-28);
}

/* ── 전체 마을 장식 호출 ── */
function buildVillageDecor(){
  mkClockTower(scene);
  mkHouses(scene);
  mkWell(scene);
  mkFences(scene);
  mkGate(scene);
  mkFlowerBeds(scene);
  mkBarrelsAndCrates(scene);
  mkBanners(scene);
  mkBenches(scene);
  mkLampPosts(scene);
}

/* ════════════ 초원 장식 ════════════ */
/* 초원: x:-80~80, z:20~300 */
function buildMeadowDecor(){
  var stoneM=new THREE.MeshLambertMaterial({color:0x888070});
  var stone2M=new THREE.MeshLambertMaterial({color:0x6a6050});
  var woodM=new THREE.MeshLambertMaterial({color:0x5a3810});
  var logM=new THREE.MeshLambertMaterial({color:0x4a2e0a});
  var signM=new THREE.MeshLambertMaterial({color:0x6e4010});
  var waterM=new THREE.MeshLambertMaterial({color:0x5599cc,transparent:true,opacity:.75});
  var stemGM=new THREE.MeshLambertMaterial({color:0x2a6a18});
  var meadowFlowerColors=[0xffee44,0xff7733,0xcc44ff,0xffffff,0xff4488,0x88ddff,0xffaa00];

  /* ── 큰 바위/볼더 클러스터 ── */
  var boulderDefs=[
    [-60,55,1.8],[-58,57,1.2],[-62,56,.9],
    [55,110,2.1],[57,112,1.4],[53,109,.8],
    [-15,200,2.4],[-17,202,1.6],[-13,201,1.0],
    [50,45,1.5],[52,47,.9],
    [-65,175,1.9],[-63,177,1.1],
    [30,285,1.6],[32,284,1.0],
    [-40,130,1.8],[38,160,1.4],[-55,240,1.7],[55,270,1.5],
    [70,90,1.3],[-70,220,1.2],[0,150,2.0],[0,265,1.6]
  ];
  boulderDefs.forEach(function(bd){
    var rock=new THREE.Mesh(new THREE.DodecahedronGeometry(bd[2],1),stoneM);
    rock.position.set(bd[0],bd[2]*.4,bd[2]);
    rock.rotation.set(Math.random()*Math.PI,Math.random()*Math.PI,Math.random()*.5);
    rock.castShadow=true;rock.receiveShadow=true;scene.add(rock);
  });

  /* ── 쓰러진 통나무 ── */
  [[-35,60,0.3],[45,120,1.2],[-25,185,-0.4],[15,100,0.8],[-50,250,0.1],
   [65,75,0.6],[-60,155,1.0],[30,210,0.4],[-20,275,0.8],[55,235,-0.3]
  ].forEach(function(ld){
    var log=new THREE.Mesh(new THREE.CylinderGeometry(.3,.35,4+Math.random()*2,8),logM);
    log.rotation.z=Math.PI/2;log.rotation.y=ld[2];
    log.position.set(ld[0],.3,ld[1]);
    log.castShadow=true;log.receiveShadow=true;scene.add(log);
    /* 통나무 끝면 */
    var endM=new THREE.MeshLambertMaterial({color:0x3a2008});
    var end1=new THREE.Mesh(new THREE.CylinderGeometry(.3,.3,.08,8),endM);
    end1.rotation.z=Math.PI/2;
    end1.position.set(ld[0]+2.1,.3,ld[1]);
    end1.castShadow=true;scene.add(end1);
  });

  /* ── 야생화 패치 (마을 꽃보다 크고 무성함) ── */
  for(var wfi=0;wfi<180;wfi++){
    var wx2=(Math.random()-.5)*155,wz2=22+Math.random()*274;
    /* 마을 경계(-22~22, z:-32~20) 밖 체크 */
    if(Math.abs(wx2)<22&&wz2<20)continue;
    var wfc=meadowFlowerColors[Math.floor(Math.random()*meadowFlowerColors.length)];
    var wfh=.22+Math.random()*.18;
    var wfstem=new THREE.Mesh(new THREE.CylinderGeometry(.03,.04,wfh,5),stemGM);
    wfstem.position.set(wx2,wfh/2,wz2);wfstem.castShadow=true;scene.add(wfstem);
    var wfpetal=new THREE.Mesh(new THREE.SphereGeometry(.1+Math.random()*.06,6,5),
      new THREE.MeshLambertMaterial({color:wfc}));
    wfpetal.position.set(wx2,wfh+.08,wz2);scene.add(wfpetal);
    /* 주변 잔 꽃잎 2~3개 */
    for(var wfk=0;wfk<2;wfk++){
      var wfa=Math.random()*Math.PI*2,wfd=.12+Math.random()*.1;
      var wfleaf=new THREE.Mesh(new THREE.SphereGeometry(.05+Math.random()*.04,5,4),
        new THREE.MeshLambertMaterial({color:wfc}));
      wfleaf.position.set(wx2+Math.cos(wfa)*wfd,wfh+.04,wz2+Math.sin(wfa)*wfd);
      scene.add(wfleaf);
    }
  }

  /* ── 방향 표지판 ── */
  (function(){
    var g=new THREE.Group();
    /* 기둥 */
    var pole=new THREE.Mesh(new THREE.BoxGeometry(.18,.18,2.2),signM);
    pole.position.set(0,1.1,0);pole.castShadow=true;pole.receiveShadow=true;g.add(pole);
    /* 화살표 판들 */
    var arrowMat=new THREE.MeshLambertMaterial({color:0x7a4a10});
    [['마을',0,-1.0,-.3,0],[' 숲  ',0,.9,.1,Math.PI/8],[' 늪  ',-Math.PI/2,-.5,.25,-Math.PI/12]].forEach(function(ai,idx){
      var sign=new THREE.Mesh(new THREE.BoxGeometry(1.2,.28,.08),arrowMat);
      sign.position.set(ai[3]*.8,1.5+idx*.38,ai[2]*.08);
      sign.rotation.y=ai[4];
      sign.castShadow=true;g.add(sign);
      /* 화살촉 */
      var tip2=new THREE.Mesh(new THREE.ConeGeometry(.14,.22,4),arrowMat);
      tip2.rotation.z=Math.PI/2*(idx%2===0?1:-1);
      tip2.position.set((idx%2===0?.7:-.7),1.5+idx*.38,ai[2]*.08);g.add(tip2);
    });
    g.position.set(2,0,22);scene.add(g);
  })();

  /* ── 작은 개울과 디딤돌 ── */
  (function(){
    /* 개울 바닥 */
    var streamBed=new THREE.Mesh(new THREE.PlaneGeometry(4,120),
      new THREE.MeshLambertMaterial({color:0x3a3020}));
    streamBed.rotation.x=-Math.PI/2;streamBed.position.set(22,.005,155);
    streamBed.receiveShadow=true;scene.add(streamBed);
    /* 물 표면 */
    var stream=new THREE.Mesh(new THREE.PlaneGeometry(3,120),waterM);
    stream.rotation.x=-Math.PI/2;stream.position.set(22,.02,155);scene.add(stream);
    /* 디딤돌 */
    var stepStoneM=new THREE.MeshLambertMaterial({color:0xaaa090});
    [-12,0,12,24,36].forEach(function(dz){
      var ss=new THREE.Mesh(new THREE.CylinderGeometry(.4+Math.random()*.2,.45,0.12,7),stepStoneM);
      ss.position.set(21.5+Math.random()*.4,.1,130+dz+Math.random()*.5);
      ss.rotation.y=Math.random()*Math.PI;
      ss.castShadow=true;ss.receiveShadow=true;scene.add(ss);
    });
    /* 개울 은은한 조명 */
    var stl=new THREE.PointLight(0x66aacc,.2,30);stl.position.set(22,1,155);scene.add(stl);
  })();

  /* ── 고대 석조 기둥 폐허 ── */
  (function(){
    var pillarM=new THREE.MeshLambertMaterial({color:0x8a8070});
    var capM2=new THREE.MeshLambertMaterial({color:0x6a6050});
    /* 3개 기둥 무리 (하나는 쓰러짐) */
    var pillarDefs=[
      [-50,195,4.5,false],  /* 서 있는 기둥 */
      [-48,198,3.2,false],  /* 부분 파손 */
      [-46,196,0,true]      /* 쓰러진 기둥 */
    ];
    pillarDefs.forEach(function(pd){
      var px2=pd[0],pz2=pd[1],ph2=pd[2],fallen=pd[3];
      if(!fallen){
        var pil=new THREE.Mesh(new THREE.CylinderGeometry(.4,.5,ph2,8),pillarM);
        pil.position.set(px2,ph2/2,pz2);pil.castShadow=true;pil.receiveShadow=true;scene.add(pil);
        var pcap=new THREE.Mesh(new THREE.BoxGeometry(1.2,.3,1.2),capM2);
        pcap.position.set(px2,ph2+.15,pz2);pcap.castShadow=true;scene.add(pcap);
        /* 몰딩 */
        var pmold=new THREE.Mesh(new THREE.CylinderGeometry(.52,.52,.22,8),capM2);
        pmold.position.set(px2,ph2*.3,pz2);scene.add(pmold);
      } else {
        /* 쓰러진 기둥 */
        var fpil=new THREE.Mesh(new THREE.CylinderGeometry(.4,.5,3.5,8),pillarM);
        fpil.rotation.z=Math.PI/2;fpil.rotation.y=0.4;
        fpil.position.set(pd[0],.4,pd[1]);fpil.castShadow=true;fpil.receiveShadow=true;scene.add(fpil);
        /* 깨진 파편 */
        [-.8,0,.8].forEach(function(ox){
          var frag=new THREE.Mesh(new THREE.DodecahedronGeometry(.2+Math.random()*.15,0),pillarM);
          frag.position.set(pd[0]+ox,.15,pd[1]+Math.random()*.6);
          frag.rotation.set(Math.random(),Math.random(),Math.random());
          frag.castShadow=true;scene.add(frag);
        });
      }
    });
    /* 잔디 위 석판 */
    var slabM=new THREE.MeshLambertMaterial({color:0x7a7060});
    var slab=new THREE.Mesh(new THREE.BoxGeometry(3.5,.2,2.2),slabM);
    slab.position.set(-48,.1,196.5);slab.rotation.y=0.15;
    slab.castShadow=true;slab.receiveShadow=true;scene.add(slab);
  })();

  /* ── 키 큰 풀 클러스터 ── */
  var tallGrassM=new THREE.MeshLambertMaterial({color:0x3a7a1a});
  var tallGrass2M=new THREE.MeshLambertMaterial({color:0x4a8a22});
  [[-70,40],[-72,43],[-70,46],[65,80],[67,83],[65,86],
   [-18,285],[-16,288],[-15,285],[42,240],[44,243],[42,246],
   [-55,150],[-53,153],[-55,156],[25,35],[27,38],[25,41],
   [0,100],[2,103],[0,106],[-40,220],[-38,223],[-40,226],
   [60,170],[62,173],[60,176],[-65,260],[-63,263],[-65,266],
   [30,130],[32,133],[30,136],[-20,190],[-18,193],[-20,196]
  ].forEach(function(pp){
    var tgh=.6+Math.random()*.5;
    var tgm=Math.random()>.5?tallGrassM:tallGrass2M;
    var tg=new THREE.Mesh(new THREE.ConeGeometry(.08+Math.random()*.05,tgh,4),tgm);
    tg.position.set(pp[0],tgh/2,pp[1]);
    tg.rotation.y=Math.random()*Math.PI;
    tg.rotation.z=(Math.random()-.5)*.25;
    tg.castShadow=true;scene.add(tg);
  });
}

/* ════════════ 숲 장식 ════════════ */
/* 어두운 숲: x:-120~120, z:300~560 */
function buildForestDecor(){
  var logM=new THREE.MeshLambertMaterial({color:0x2a1a08});
  var darkLogM=new THREE.MeshLambertMaterial({color:0x1a0e04});
  var stumpM=new THREE.MeshLambertMaterial({color:0x3a2008});
  var stoneM=new THREE.MeshLambertMaterial({color:0x2a2018});
  var mossM=new THREE.MeshLambertMaterial({color:0x1a3a08});
  var crystalM=new THREE.MeshPhongMaterial({color:0x88aaff,shininess:80});
  var shrineBaseM=new THREE.MeshLambertMaterial({color:0x3a3028});
  var webM=new THREE.MeshLambertMaterial({color:0xddddcc,transparent:true,opacity:.55,side:THREE.DoubleSide});
  var tentM2=new THREE.MeshLambertMaterial({color:0x4a3a10});
  var logSeatM=new THREE.MeshLambertMaterial({color:0x3a2a0a});
  var vineM=new THREE.MeshLambertMaterial({color:0x1a3a08,transparent:true,opacity:.85});

  /* ── 쓰러진 나무/통나무 길가로 ── */
  [[-65,315,0.6],[-63,317,0.5],
   [55,385,2.2],[57,387,2.0],
   [-45,450,-0.3],[-43,452,-0.2],
   [25,510,1.1],[27,512,1.0],
   [-85,360,0.8],[85,420,-0.6],
   [-70,480,1.4],[70,540,-0.4],
   [0,330,0.2],[-90,395,1.0],[90,465,-0.8],[0,530,0.5]
  ].forEach(function(ld){
    var llen=5+Math.random()*4;
    var log=new THREE.Mesh(new THREE.CylinderGeometry(.32,.4,llen,8),logM);
    log.rotation.z=Math.PI/2;log.rotation.y=ld[2];
    log.position.set(ld[0],.35,ld[1]);
    log.castShadow=true;log.receiveShadow=true;scene.add(log);
    /* 이끼 덮개 */
    var moss=new THREE.Mesh(new THREE.BoxGeometry(llen*.8,.22,.7),mossM);
    moss.rotation.y=ld[2];
    moss.position.set(ld[0]+Math.cos(ld[2])*.3,.72,ld[1]+Math.sin(ld[2])*.3);
    scene.add(moss);
  });

  /* ── 버섯 클러스터 ── */
  var mushColors=[
    [0xaa3311,0xff6633],  /* 붉은 버섯 */
    [0x8833bb,0xcc66ff],  /* 보라 버섯 */
    [0x336611,0x66cc33],  /* 초록 버섯 */
    [0xcc8800,0xffcc44],  /* 황금 버섯 */
    [0x2244aa,0x4488ff]   /* 파란 버섯 */
  ];
  var mushGroups=[
    [-80,320],[-55,355],[42,400],[-25,435],[68,470],[0,505],[-90,385],[80,340],
    [30,315],[-40,370],[55,415],[-65,460],[20,500],[-15,545],[95,330],[-95,490]
  ];
  mushGroups.forEach(function(mg){
    var col=mushColors[Math.floor(Math.random()*mushColors.length)];
    var stemMat=new THREE.MeshLambertMaterial({color:col[0]});
    var capMat=new THREE.MeshLambertMaterial({color:col[1]});
    /* 메인 버섯 */
    var msh=.4+Math.random()*.5;
    var mstem=new THREE.Mesh(new THREE.CylinderGeometry(.1,.14,msh,7),stemMat);
    mstem.position.set(mg[0],msh/2,mg[1]);mstem.castShadow=true;scene.add(mstem);
    var mcap=new THREE.Mesh(new THREE.SphereGeometry(.32+Math.random()*.12,8,6),capMat);
    mcap.scale.y=.55;mcap.position.set(mg[0],msh+.1,mg[1]);
    mcap.castShadow=true;scene.add(mcap);
    /* 점 무늬 */
    var dotM=new THREE.MeshLambertMaterial({color:0xffffff});
    for(var di=0;di<3;di++){
      var da=Math.random()*Math.PI*2,dr=.1+Math.random()*.15;
      var dot=new THREE.Mesh(new THREE.SphereGeometry(.04,4,4),dotM);
      dot.position.set(mg[0]+Math.cos(da)*dr,msh+.14,mg[1]+Math.sin(da)*dr);scene.add(dot);
    }
    /* 주변 작은 버섯 2~4개 */
    for(var msi=0;msi<3;msi++){
      var msa=Math.random()*Math.PI*2,msd=.4+Math.random()*.6;
      var smsh=.18+Math.random()*.2;
      var smstem=new THREE.Mesh(new THREE.CylinderGeometry(.05,.07,smsh,6),stemMat);
      smstem.position.set(mg[0]+Math.cos(msa)*msd,smsh/2,mg[1]+Math.sin(msa)*msd);
      smstem.castShadow=true;scene.add(smstem);
      var smcap=new THREE.Mesh(new THREE.SphereGeometry(.13+Math.random()*.06,6,5),capMat);
      smcap.scale.y=.55;smcap.position.set(mg[0]+Math.cos(msa)*msd,smsh+.06,mg[1]+Math.sin(msa)*msd);
      scene.add(smcap);
    }
  });

  /* ── 나무 그루터기 + 도끼 ── */
  (function(){
    var axeHeadM=new THREE.MeshLambertMaterial({color:0x667788});
    var axeHandleM=new THREE.MeshLambertMaterial({color:0x5a3810});
    [[-15,325],[35,430],[-60,510],[50,365],[-80,475],[0,555]].forEach(function(sp){
      /* 그루터기 */
      var sh=.5+Math.random()*.4;
      var stump=new THREE.Mesh(new THREE.CylinderGeometry(.5,.6,sh,8),stumpM);
      stump.position.set(sp[0],sh/2,sp[1]);stump.castShadow=true;stump.receiveShadow=true;scene.add(stump);
      /* 나이테 */
      var ringM=new THREE.MeshLambertMaterial({color:0x2a1508});
      var ring=new THREE.Mesh(new THREE.CylinderGeometry(.25,.25,.04,8),ringM);
      ring.position.set(sp[0],sh+.02,sp[1]);scene.add(ring);
      /* 이끼 */
      var mossP=new THREE.Mesh(new THREE.SphereGeometry(.28,6,5),mossM);
      mossP.scale.y=.2;mossP.position.set(sp[0]+.1,sh+.05,sp[1]-.1);scene.add(mossP);
    });
    /* 도끼 박힌 그루터기 (하나만) */
    var axeStump=new THREE.Mesh(new THREE.CylinderGeometry(.55,.65,.65,8),stumpM);
    axeStump.position.set(-15,.33,325);
    axeStump.castShadow=true;axeStump.receiveShadow=true;scene.add(axeStump);
    /* 도끼 자루 */
    var handle=new THREE.Mesh(new THREE.CylinderGeometry(.05,.07,.8,6),axeHandleM);
    handle.rotation.z=.4;handle.position.set(-14.6,.75,325);handle.castShadow=true;scene.add(handle);
    /* 도끼 날 */
    var axeHead=new THREE.Mesh(new THREE.BoxGeometry(.35,.28,.08),axeHeadM);
    axeHead.rotation.z=.4;axeHead.position.set(-14.3,1.1,325);axeHead.castShadow=true;scene.add(axeHead);
  })();

  /* ── 숲 신전/제단 (석재 기단 + 수정) ── */
  (function(){
    var g=new THREE.Group();
    /* 기단 */
    var base=new THREE.Mesh(new THREE.BoxGeometry(2.4,.5,2.4),shrineBaseM);
    base.position.set(0,.25,0);base.castShadow=true;base.receiveShadow=true;g.add(base);
    /* 기단 계단 */
    var step=new THREE.Mesh(new THREE.BoxGeometry(3,.18,3),stoneM);
    step.position.set(0,.09,0);step.castShadow=true;step.receiveShadow=true;g.add(step);
    /* 돌 기둥 4개 */
    [[-0.9,0,-0.9],[0.9,0,-0.9],[-0.9,0,0.9],[0.9,0,0.9]].forEach(function(pp){
      var pil=new THREE.Mesh(new THREE.CylinderGeometry(.15,.18,1.8,6),stoneM);
      pil.position.set(pp[0],1.4,pp[2]);pil.castShadow=true;g.add(pil);
    });
    /* 윗 석판 */
    var top=new THREE.Mesh(new THREE.BoxGeometry(2.2,.25,2.2),shrineBaseM);
    top.position.set(0,2.4,0);top.castShadow=true;g.add(top);
    /* 수정 (발광하지 않음 — MeshPhong) */
    var crystal=new THREE.Mesh(new THREE.OctahedronGeometry(.35,0),crystalM);
    crystal.position.set(0,2.9,0);crystal.castShadow=true;g.add(crystal);
    var crystal2=new THREE.Mesh(new THREE.OctahedronGeometry(.22,0),crystalM);
    crystal2.position.set(.18,2.75,.12);crystal2.rotation.y=.5;g.add(crystal2);
    /* 신전 조명 (은은한 파란빛) */
    var shrineL=new THREE.PointLight(0x8888ff,.4,8);shrineL.position.set(0,3.5,0);g.add(shrineL);
    /* 이끼 낀 돌 */
    var mossBlock=new THREE.Mesh(new THREE.BoxGeometry(.6,.3,.5),mossM);
    mossBlock.position.set(1.4,.15,0);g.add(mossBlock);
    g.position.set(-75,0,430);scene.add(g);
  })();

  /* ── 거미줄 (나무 사이 흰 평면) ── */
  [[-30,320,.4],[50,370,.7],[-55,420,.3],[18,470,.6],[65,515,.5],[-40,555,.3],[0,345,0.8],[-75,400,.5],[75,455,-.4],[25,540,.6]].forEach(function(wd){
    var webSize=.8+Math.random()*.6;
    var web=new THREE.Mesh(new THREE.PlaneGeometry(webSize*2,webSize*1.4),webM);
    web.rotation.y=wd[2];
    web.position.set(wd[0],2+Math.random()*1.5,wd[1]);
    scene.add(web);
    /* 거미줄 테두리 실 */
    var threadM=new THREE.MeshLambertMaterial({color:0xccccbb,transparent:true,opacity:.4});
    for(var wi2=0;wi2<4;wi2++){
      var wt=new THREE.Mesh(new THREE.BoxGeometry(.02,.02,webSize*1.8),threadM);
      wt.rotation.z=wi2*Math.PI/4;wt.rotation.y=wd[2];
      wt.position.set(wd[0],2+Math.random()*1.5+wi2*.05,wd[1]);scene.add(wt);
    }
  });

  /* ── 속이 빈 통나무 터널 ── */
  (function(){
    var tunnelLog=new THREE.Mesh(
      new THREE.CylinderGeometry(.9,.9,4,10,1,true),
      new THREE.MeshLambertMaterial({color:0x2a1a08,side:THREE.DoubleSide}));
    tunnelLog.rotation.z=Math.PI/2;tunnelLog.rotation.y=.2;
    tunnelLog.position.set(30,.9,365);
    tunnelLog.castShadow=true;tunnelLog.receiveShadow=true;scene.add(tunnelLog);
    /* 끝 막힌 쪽 (한쪽만 열림) */
    var endCap=new THREE.Mesh(new THREE.CylinderGeometry(.9,.9,.12,10),
      new THREE.MeshLambertMaterial({color:0x1a0e04}));
    endCap.rotation.z=Math.PI/2;endCap.position.set(32.1,.9,365);
    endCap.castShadow=true;scene.add(endCap);
    /* 이끼 위에 덮임 */
    var mossTop=new THREE.Mesh(new THREE.SphereGeometry(.95,8,6),mossM);
    mossTop.scale.set(1,.3,1);mossTop.position.set(30,.92,365);scene.add(mossTop);
  })();

  /* ── 숲 야영지 (텐트 + 모닥불 + 통나무 의자) ── */
  (function(){
    var g=new THREE.Group();
    /* 텐트 */
    var tent=new THREE.Mesh(new THREE.ConeGeometry(1.6,2.4,5),tentM2);
    tent.position.set(0,1.2,0);tent.castShadow=true;tent.receiveShadow=true;g.add(tent);
    /* 텐트 입구 천 */
    var flap=new THREE.Mesh(new THREE.BoxGeometry(.6,1.2,.06),new THREE.MeshLambertMaterial({color:0x3a2a08}));
    flap.position.set(0,.6,.88);g.add(flap);
    /* 모닥불 돌 링 */
    var fireRingM=new THREE.MeshLambertMaterial({color:0x6a6050});
    for(var fri=0;fri<8;fri++){
      var fra=fri/8*Math.PI*2;
      var frs=new THREE.Mesh(new THREE.DodecahedronGeometry(.18,0),fireRingM);
      frs.position.set(Math.cos(fra)*.7,.1,Math.sin(fra)*.7+2.5);
      frs.rotation.set(Math.random(),Math.random(),.1);g.add(frs);
    }
    /* 모닥불 장작 */
    var logFire=new THREE.MeshLambertMaterial({color:0x3a2008});
    [0,Math.PI/3,Math.PI*2/3].forEach(function(la){
      var llog=new THREE.Mesh(new THREE.CylinderGeometry(.07,.09,.9,6),logFire);
      llog.rotation.z=Math.PI/2;llog.rotation.y=la;
      llog.position.set(Math.cos(la+Math.PI/2)*.25,.07,Math.sin(la+Math.PI/2)*.25+2.5);g.add(llog);
    });
    /* 불꽃 (MeshLambertMaterial, no emissive) */
    var campFlameM=new THREE.MeshLambertMaterial({color:0xff7700});
    var campFlame=new THREE.Mesh(new THREE.ConeGeometry(.18,.4,6),campFlameM);
    campFlame.position.set(0,.3,2.5);g.add(campFlame);
    var campFL=new THREE.PointLight(0xff6600,1.8,10);campFL.position.set(0,1,2.5);g.add(campFL);
    /* 통나무 의자 3개 */
    [-1.1,0,1.1].forEach(function(lsx){
      var lseat=new THREE.Mesh(new THREE.CylinderGeometry(.28,.32,.28,7),logSeatM);
      lseat.position.set(lsx*.6,.14,2.5+.8+(Math.abs(lsx)>.5?.4:-.1));lseat.castShadow=true;g.add(lseat);
    });
    /* 텐트 앞 랜턴 */
    var lantM=new THREE.MeshLambertMaterial({color:0x2a2a2a});
    var lant=new THREE.Mesh(new THREE.BoxGeometry(.2,.24,.2),lantM);
    lant.position.set(.55,.28,1.2);g.add(lant);
    var lantFL=new THREE.PointLight(0xffcc44,.6,5);lantFL.position.set(.55,.5,1.2);g.add(lantFL);
    g.position.set(-30,0,480);scene.add(g);
  })();

  /* ── 이끼 낀 바위들 ── */
  [[-75,312,1.2],[60,358,1.5],[-35,405,1.0],[85,448,1.3],[-65,495,1.1],[15,538,1.4],
   [45,330,1.3],[-50,378,1.5],[80,415,1.2],[-85,460,1.0],[30,505,1.4],[-20,548,1.1]
  ].forEach(function(rd){
    var rock=new THREE.Mesh(new THREE.DodecahedronGeometry(rd[2],1),stoneM);
    rock.position.set(rd[0],rd[2]*.35,rd[2]);
    rock.rotation.set(Math.random()*.8,Math.random()*Math.PI,.2);
    rock.castShadow=true;rock.receiveShadow=true;scene.add(rock);
    /* 이끼 덮개 */
    var mossO=new THREE.Mesh(new THREE.SphereGeometry(rd[2]*.55,8,6),mossM);
    mossO.scale.set(1,.35,1);mossO.position.set(rd[0],rd[2]*.7,rd[2]);scene.add(mossO);
  });

  /* ── 넝쿨 (나무에서 늘어지는 얇은 원통들) ── */
  [[-90,315,2.2,3.2],[-95,360,1.8,2.8],[95,325,2.5,3.0],[100,430,1.9,2.9],[-85,480,2.0,3.1],
   [90,395,2.2,3.0],[-100,445,1.8,2.8],[85,500,2.5,3.0],[-90,545,1.9,2.9],[105,350,2.0,3.0]
  ].forEach(function(vd){
    for(var vi=0;vi<3;vi++){
      var vl=.8+Math.random()*.8;
      var vine=new THREE.Mesh(new THREE.CylinderGeometry(.025,.035,vl,5),vineM);
      vine.position.set(vd[0]+(Math.random()-.5)*.8,vd[2]-vl/2+Math.random()*.4,vd[1]);
      vine.rotation.z=(Math.random()-.5)*.3;
      vine.castShadow=true;scene.add(vine);
    }
  });
}

/* ════════════ 늪지 장식 ════════════ */
/* 늪 동쪽: x:80~200, z:20~300  /  서쪽: x:-200~-80, z:20~300 */
function buildSwampDecor(){
  var deadTreeM=new THREE.MeshLambertMaterial({color:0x1a1005});
  var boardM=new THREE.MeshLambertMaterial({color:0x3a2808});
  var boardOldM=new THREE.MeshLambertMaterial({color:0x2a1e06});
  var pileM=new THREE.MeshLambertMaterial({color:0x2a2018});
  var postM2=new THREE.MeshLambertMaterial({color:0x1e1205});
  var skullM=new THREE.MeshLambertMaterial({color:0xd4ccc0});
  var cartM=new THREE.MeshLambertMaterial({color:0x3a2a10});
  var poisonFlowerM=new THREE.MeshLambertMaterial({color:0x6a1a8a});
  var poisonStemM=new THREE.MeshLambertMaterial({color:0x1a2a10});
  var vineM2=new THREE.MeshLambertMaterial({color:0x0a1a08,transparent:true,opacity:.8});

  /* 양쪽 늪에 대칭으로 장식 배치 */
  [1,-1].forEach(function(side){
    var sx=side*140; /* 중심 x */

    /* ── 죽은 나무 (더 상세한 버전) ── */
    [[90,40],[110,80],[135,120],[155,160],[180,200],[100,240],[125,280],[170,50],[145,100]].forEach(function(pp){
      var tx=side*pp[0],tz=pp[1];
      var th=4+Math.random()*3;
      var trunk=new THREE.Mesh(new THREE.CylinderGeometry(.18,.3,th,7),deadTreeM);
      trunk.position.set(tx,th/2,tz);
      trunk.rotation.z=(Math.random()-.5)*.2;
      trunk.castShadow=true;trunk.receiveShadow=true;scene.add(trunk);
      /* 부러진 가지 2~3개 */
      for(var bi=0;bi<2+Math.floor(Math.random()*2);bi++){
        var blen=.6+Math.random()*1.4;
        var bh=th*(.5+Math.random()*.4);
        var branch=new THREE.Mesh(new THREE.CylinderGeometry(.03,.07,blen,5),deadTreeM);
        var bdir=(Math.random()-.5)*1.4;
        branch.position.set(tx+Math.cos(bdir)*blen*.4,bh,tz+Math.sin(bdir)*blen*.4);
        branch.rotation.z=bdir;branch.rotation.x=(Math.random()-.5)*.6;
        branch.castShadow=true;scene.add(branch);
      }
    });

    /* ── 진흙 구덩이 (갈색 원) ── */
    var mudM=new THREE.MeshLambertMaterial({color:0x2a1a08,transparent:true,opacity:.88});
    [[95,50,2.5],[120,100,3.0],[150,150,2.2],[110,200,2.8],[140,250,3.0],[170,290,2.5],[100,130,2.8],[160,80,2.2]].forEach(function(md){
      var mud=new THREE.Mesh(new THREE.CircleGeometry(md[2],12),mudM);
      mud.rotation.x=-Math.PI/2;mud.position.set(side*md[0],.015,md[1]);
      mud.receiveShadow=true;scene.add(mud);
      /* 거품 작은 원들 */
      var bubbleM=new THREE.MeshLambertMaterial({color:0x3a2a12,transparent:true,opacity:.7});
      for(var bi2=0;bi2<4;bi2++){
        var ba=Math.random()*Math.PI*2,br=Math.random()*md[2]*.8;
        var bubble=new THREE.Mesh(new THREE.CircleGeometry(.12+Math.random()*.15,6),bubbleM);
        bubble.rotation.x=-Math.PI/2;
        bubble.position.set(side*md[0]+Math.cos(ba)*br,.02,md[1]+Math.sin(ba)*br);
        scene.add(bubble);
      }
    });

    /* ── 나무 판자 보드워크 ── */
    (function(){
      /* 부두 형태의 판자길 */
      var boards=[
        [side*100,55],[side*103,58],[side*106,61],[side*109,64]
      ];
      boards.forEach(function(bp){
        /* 받침 기둥 */
        [-0.4,0.4].forEach(function(ox){
          var post=new THREE.Mesh(new THREE.CylinderGeometry(.06,.08,1.2,6),postM2);
          post.position.set(bp[0]+ox,.6,bp[1]);post.castShadow=true;scene.add(post);
        });
        /* 판자 */
        var board=new THREE.Mesh(new THREE.BoxGeometry(1.1,.1,1.0),boardM);
        board.position.set(bp[0],.9,bp[1]);board.castShadow=true;board.receiveShadow=true;scene.add(board);
        /* 판자 나무결 */
        [-0.25,0.25].forEach(function(ox){
          var plank=new THREE.Mesh(new THREE.BoxGeometry(.35,.05,.95),boardOldM);
          plank.position.set(bp[0]+ox,.96,bp[1]);scene.add(plank);
        });
      });
      /* 연결 난간 */
      var railPost=new THREE.MeshLambertMaterial({color:0x2a1a08});
      [boards[0],boards[boards.length-1]].forEach(function(bp){
        var rp=new THREE.Mesh(new THREE.BoxGeometry(.08,.08,.6),railPost);
        rp.position.set(bp[0]+.45,1.4,bp[1]);scene.add(rp);
      });
    })();

    /* ── 해골 장대 (경고 표지) ── */
    (function(){
      var g=new THREE.Group();
      /* 장대 */
      var pike=new THREE.Mesh(new THREE.CylinderGeometry(.05,.07,2.5,6),postM2);
      pike.position.set(0,1.25,0);pike.castShadow=true;g.add(pike);
      /* 뾰족 끝 */
      var tip=new THREE.Mesh(new THREE.ConeGeometry(.06,.2,4),new THREE.MeshLambertMaterial({color:0x3a2a10}));
      tip.position.set(0,2.6,0);tip.castShadow=true;g.add(tip);
      /* 해골 구체 */
      var skull=new THREE.Mesh(new THREE.SphereGeometry(.22,8,7),skullM);
      skull.position.set(0,2.75,0);skull.castShadow=true;g.add(skull);
      /* 눈구멍 */
      var eyeHoleM=new THREE.MeshLambertMaterial({color:0x111111});
      [-.09,.09].forEach(function(ex){
        var eyeH=new THREE.Mesh(new THREE.SphereGeometry(.06,5,5),eyeHoleM);
        eyeH.position.set(ex,2.8,.18);g.add(eyeH);
      });
      /* 이빨 */
      var toothM=new THREE.MeshLambertMaterial({color:0xd0c8b8});
      for(var ti=0;ti<3;ti++){
        var tooth=new THREE.Mesh(new THREE.BoxGeometry(.04,.06,.04),toothM);
        tooth.position.set((ti-1)*.08,2.62,.2);g.add(tooth);
      }
      /* 옆에 경고 뼈다귀 */
      var boneM=new THREE.MeshLambertMaterial({color:0xc8c0b0});
      var bone=new THREE.Mesh(new THREE.CylinderGeometry(.03,.03,.6,5),boneM);
      bone.rotation.z=Math.PI/2;bone.position.set(.5,1.5,0);g.add(bone);
      g.position.set(side*95,0,185);g.rotation.y=Math.random()*.5;scene.add(g);
    })();

    /* ── 부서진 나무 수레 ── */
    (function(){
      var g=new THREE.Group();
      /* 수레 몸체 (기울어짐) */
      var body=new THREE.Mesh(new THREE.BoxGeometry(2,.5,1.0),cartM);
      body.position.set(0,.25,0);body.rotation.z=.25;body.castShadow=true;body.receiveShadow=true;g.add(body);
      /* 바퀴 2개 (하나는 떨어진 상태) */
      var wheelM=new THREE.MeshLambertMaterial({color:0x2a1a08});
      var wheel1=new THREE.Mesh(new THREE.TorusGeometry(.35,.07,6,12),wheelM);
      wheel1.position.set(-0.8,.35,0.55);wheel1.rotation.y=Math.PI/2;g.add(wheel1);
      var wheel2=new THREE.Mesh(new THREE.TorusGeometry(.35,.07,6,12),wheelM);
      wheel2.position.set(1.2,.1,-.8);wheel2.rotation.y=.4;wheel2.rotation.z=.5;g.add(wheel2);
      /* 바퀴살 */
      for(var wsi=0;wsi<5;wsi++){
        var wa=wsi/5*Math.PI*2;
        var spoke=new THREE.Mesh(new THREE.BoxGeometry(.05,.05,.62),wheelM);
        spoke.position.set(-0.8+Math.cos(wa)*.18,.35+Math.sin(wa)*.18,0.55);
        spoke.rotation.y=Math.PI/2;spoke.rotation.z=wa;g.add(spoke);
      }
      /* 수레 내부 진흙 */
      var muddyM=new THREE.MeshLambertMaterial({color:0x2a1a08,transparent:true,opacity:.7});
      var muddyPile=new THREE.Mesh(new THREE.BoxGeometry(1.5,.15,.7),muddyM);
      muddyPile.position.set(0,.52,0);muddyPile.rotation.z=.25;g.add(muddyPile);
      g.position.set(side*165,0,145);scene.add(g);
    })();

    /* ── 늪 등불 (초록 빛 포스트) ── */
    [[side*100,40],[side*145,110],[side*120,220],[side*170,175],[side*105,265]].forEach(function(lp){
      var g=new THREE.Group();
      var pole=new THREE.Mesh(new THREE.CylinderGeometry(.05,.07,2.8,6),postM2);
      pole.position.set(0,1.4,0);pole.castShadow=true;g.add(pole);
      /* 등롱 (초록빛) */
      var lantGM=new THREE.MeshLambertMaterial({color:0x88cc88,transparent:true,opacity:.7});
      var lant=new THREE.Mesh(new THREE.BoxGeometry(.24,.3,.24),lantGM);
      lant.position.set(0,2.9,0);g.add(lant);
      var lantCapM=new THREE.MeshLambertMaterial({color:0x1a1a1a});
      var lcap=new THREE.Mesh(new THREE.ConeGeometry(.16,.2,4),lantCapM);
      lcap.position.set(0,3.1,0);lcap.rotation.y=Math.PI/4;g.add(lcap);
      /* 초록 점광 */
      var gl=new THREE.PointLight(0x44ff44,.6,8);gl.position.set(0,2.9,0);g.add(gl);
      g.position.set(lp[0],0,lp[1]);scene.add(g);
    });

    /* ── 독성 꽃 군락 (자주/어두운 색) ── */
    [[side*110,60],[side*145,130],[side*130,195],[side*180,90],[side*155,255],[side*100,285]].forEach(function(pf){
      for(var pfi=0;pfi<5;pfi++){
        var pfa=Math.random()*Math.PI*2,pfd=Math.random()*1.2;
        var pfh=.3+Math.random()*.25;
        var pstem=new THREE.Mesh(new THREE.CylinderGeometry(.03,.04,pfh,5),poisonStemM);
        pstem.position.set(pf[0]+Math.cos(pfa)*pfd,pfh/2,pf[1]+Math.sin(pfa)*pfd);
        pstem.castShadow=true;scene.add(pstem);
        var pfc=[0x7a1a9a,0x4a0a6a,0x2a0a4a,0x6a0088][Math.floor(Math.random()*4)];
        var ppetal=new THREE.Mesh(new THREE.SphereGeometry(.1+Math.random()*.07,6,5),
          new THREE.MeshLambertMaterial({color:pfc}));
        ppetal.position.set(pf[0]+Math.cos(pfa)*pfd,pfh+.08,pf[1]+Math.sin(pfa)*pfd);
        scene.add(ppetal);
      }
    });
  }); /* end side loop */
}

/* ════════════ 화산 장식 ════════════ */
/* 화산: x:-100~100, z:560~860 */
function buildVolcanoDecor(){
  var obsidianM=new THREE.MeshPhongMaterial({color:0x0a0808,shininess:120});
  var darkRockM=new THREE.MeshLambertMaterial({color:0x180a04});
  var charredM=new THREE.MeshLambertMaterial({color:0x0e0808});
  var boneM2=new THREE.MeshLambertMaterial({color:0xc0b8a8});
  var stoneStatueM=new THREE.MeshLambertMaterial({color:0x2a2018});
  var ironM=new THREE.MeshLambertMaterial({color:0x333344});
  var lavaPoolM=new THREE.MeshLambertMaterial({color:0xff4400,transparent:true,opacity:.88});
  var crackedGroundM=new THREE.MeshLambertMaterial({color:0x120804});
  var ventConeM=new THREE.MeshLambertMaterial({color:0x1a0a04});

  /* ── 흑요석 바위 (어두운 광택) ── */
  [[-60,575,1.5],[45,610,1.8],[-30,650,2.2],[65,690,1.6],[-55,730,1.9],[25,770,2.0],
   [-85,590,1.0],[75,630,1.2],[-15,670,1.4],[55,710,1.1],[0,750,1.8],[-70,785,1.5],
   [40,820,1.6],[-45,845,1.4],[80,565,1.3],[-80,840,1.2]
  ].forEach(function(od){
    var rock=new THREE.Mesh(new THREE.DodecahedronGeometry(od[2],0),obsidianM);
    rock.position.set(od[0],od[2]*.45,od[2]);
    rock.rotation.set(Math.random()*.8,Math.random()*Math.PI,Math.random()*.4);
    rock.castShadow=true;rock.receiveShadow=true;scene.add(rock);
    /* 날카로운 흑요석 뾰족 파편 */
    var spike=new THREE.Mesh(new THREE.ConeGeometry(od[2]*.25,od[2]*1.2,5),obsidianM);
    spike.position.set(od[0]+(Math.random()-.5)*.5,od[2]*.8,od[2]+(Math.random()-.5)*.5);
    spike.rotation.z=(Math.random()-.5)*.5;spike.rotation.y=Math.random()*Math.PI;
    spike.castShadow=true;scene.add(spike);
  });

  /* ── 균열 지면 어두운 패치들 ── */
  [[-35,575,5,3],[25,615,4,2.5],[-55,655,6,3.5],[45,695,5,3],[-25,735,7,4],[10,775,4,2.8],
   [-70,600,4,3],[70,640,5,2.5],[-40,680,6,3],[40,720,4,2.8],[-15,760,7,4],[60,800,5,3]
  ].forEach(function(cp){
    var crk=new THREE.Mesh(new THREE.PlaneGeometry(cp[2],cp[3]),crackedGroundM);
    crk.rotation.x=-Math.PI/2;crk.position.set(cp[0],.019,cp[1]);
    crk.receiveShadow=true;scene.add(crk);
    /* 균열 패치 경계 돌 */
    for(var cri=0;cri<3;cri++){
      var cra=Math.random()*Math.PI*2,crd=cp[2]*.4*Math.random();
      var crRock=new THREE.Mesh(new THREE.DodecahedronGeometry(.2+Math.random()*.25,0),darkRockM);
      crRock.position.set(cp[0]+Math.cos(cra)*crd,.1,cp[1]+Math.sin(cra)*crd);
      crRock.rotation.set(Math.random(),Math.random(),.2);crRock.castShadow=true;scene.add(crRock);
    }
  });

  /* ── 뼈 더미 ── */
  [[-75,580],[55,625],[-25,670],[45,715],[-55,760],[20,805],[-40,845],[75,585],[0,640],[-60,700],[60,745]].forEach(function(bp){
    /* 큰 뼈 3~5개 */
    for(var bpi=0;bpi<4;bpi++){
      var blen=.4+Math.random()*.6;
      var bone=new THREE.Mesh(new THREE.CylinderGeometry(.06,.09,blen,5),boneM2);
      bone.rotation.z=Math.random()*Math.PI;bone.rotation.y=Math.random()*Math.PI;
      bone.position.set(bp[0]+(Math.random()-.5)*.8,.06,bp[1]+(Math.random()-.5)*.8);
      bone.castShadow=true;scene.add(bone);
    }
    /* 해골 */
    var skullV=new THREE.Mesh(new THREE.SphereGeometry(.18,7,6),boneM2);
    skullV.position.set(bp[0]+(Math.random()-.5)*.4,.18,bp[1]+(Math.random()-.5)*.4);
    skullV.castShadow=true;scene.add(skullV);
    /* 눈 구멍 */
    var eyeHM=new THREE.MeshLambertMaterial({color:0x220000});
    [-.07,.07].forEach(function(ex){
      var eh=new THREE.Mesh(new THREE.SphereGeometry(.055,4,4),eyeHM);
      eh.position.set(bp[0]+(Math.random()-.5)*.4+ex,.22,bp[1]+(Math.random()-.5)*.4+.14);
      scene.add(eh);
    });
  });

  /* ── 고대 석조 우상/조각상 ── */
  (function(){
    var statues=[[-65,590],[70,640],[-45,710],[0,760],[55,640],[-80,695],[30,790],[-20,850]];
    statues.forEach(function(sp,si){
      var g=new THREE.Group();
      /* 기단 */
      var ped=new THREE.Mesh(new THREE.BoxGeometry(1.2,.8,1.2),stoneStatueM);
      ped.position.set(0,.4,0);ped.castShadow=true;ped.receiveShadow=true;g.add(ped);
      /* 몸체 */
      var body=new THREE.Mesh(new THREE.BoxGeometry(.7,1.4,.5),stoneStatueM);
      body.position.set(0,1.5,0);body.castShadow=true;body.receiveShadow=true;g.add(body);
      /* 머리 (이상한 형태) */
      var head=new THREE.Mesh(new THREE.BoxGeometry(.55,.6,.5),stoneStatueM);
      head.position.set(0,2.55,0);head.castShadow=true;g.add(head);
      /* 뿔 장식 */
      [-.2,.2].forEach(function(hx){
        var horn=new THREE.Mesh(new THREE.ConeGeometry(.08,.4,4),stoneStatueM);
        horn.position.set(hx,3.0,0);horn.castShadow=true;g.add(horn);
      });
      /* 팔 */
      [-.5,.5].forEach(function(ax){
        var arm=new THREE.Mesh(new THREE.BoxGeometry(.2,.9,.2),stoneStatueM);
        arm.position.set(ax,1.5,0);arm.rotation.z=ax>0?-.4:.4;arm.castShadow=true;g.add(arm);
      });
      /* 눈 (붉은 보석) */
      var eyeGemM=new THREE.MeshPhongMaterial({color:0xff1100,shininess:100});
      [-.12,.12].forEach(function(ex){
        var gem=new THREE.Mesh(new THREE.SphereGeometry(.06,6,5),eyeGemM);
        gem.position.set(ex,2.58,.26);g.add(gem);
      });
      /* 반쯤 무너진 상태 표현 (기울어짐) */
      if(si%2===1){g.rotation.z=(Math.random()-.5)*.2;}
      g.position.set(sp[0],0,sp[1]);scene.add(g);
    });
  })();

  /* ── 화산 분기공 (원뿔 + 연기) ── */
  [[-50,575],[35,615],[-25,660],[60,705],[-70,750],[15,795],[-40,840],[55,570],[-85,625],[85,665],[-55,720],[50,780],[-15,830],[0,860]].forEach(function(vp){
    var g=new THREE.Group();
    /* 분기공 원뿔 */
    var vent=new THREE.Mesh(new THREE.ConeGeometry(.7,.9,8),ventConeM);
    vent.position.set(0,.45,0);vent.castShadow=true;vent.receiveShadow=true;g.add(vent);
    /* 내부 개구부 (어두운 원) */
    var holeM=new THREE.MeshLambertMaterial({color:0x060202});
    var hole=new THREE.Mesh(new THREE.CircleGeometry(.45,8),holeM);
    hole.rotation.x=-Math.PI/2;hole.position.set(0,.92,0);g.add(hole);
    /* 연기 구름 (MeshLambertMaterial, 어두운) */
    var smokeVM=new THREE.MeshLambertMaterial({color:0x180a04,transparent:true,opacity:.45});
    for(var vsi=0;vsi<3;vsi++){
      var vs=new THREE.Mesh(new THREE.SphereGeometry(.25+Math.random()*.2,5,5),smokeVM);
      vs.position.set((Math.random()-.5)*.3,1.1+vsi*.4,(Math.random()-.5)*.3);g.add(vs);
    }
    g.position.set(vp[0],0,vp[1]);scene.add(g);
  });

  /* ── 불탄 나무 그루터기들 ── */
  [[-55,568],[40,600],[-18,638],[65,675],[-65,715],[25,755],[-35,798],[50,838],
   [0,575],[-80,620],[80,660],[-40,700],[40,740],[-20,780],[20,820]
  ].forEach(function(cp){
    var charStump=new THREE.Mesh(new THREE.CylinderGeometry(.35,.5,.5+Math.random()*.4,7),charredM);
    charStump.position.set(cp[0],.3,cp[1]);charStump.castShadow=true;charStump.receiveShadow=true;scene.add(charStump);
    /* 깨진 가지 */
    var brokenBranch=new THREE.Mesh(new THREE.CylinderGeometry(.06,.1,.6+Math.random()*.5,5),charredM);
    brokenBranch.rotation.z=Math.PI/4+(Math.random()-.5)*.5;
    brokenBranch.position.set(cp[0]+.2,.6,cp[1]);brokenBranch.castShadow=true;scene.add(brokenBranch);
  });

  /* ── 철 사슬과 우리 ── */
  (function(){
    var g=new THREE.Group();
    /* 우리 기둥 4개 */
    [[-1,0,-1],[1,0,-1],[-1,0,1],[1,0,1]].forEach(function(pp){
      var post=new THREE.Mesh(new THREE.BoxGeometry(.1,2.5,.1),ironM);
      post.position.set(pp[0],1.25,pp[2]);post.castShadow=true;g.add(post);
    });
    /* 우리 가로대 */
    [.6,1.2,1.8].forEach(function(hy){
      [[0,-1,2,0],[0,1,2,0],[-1,0,0,2],[1,0,0,2]].forEach(function(bar){
        var barm=new THREE.Mesh(new THREE.BoxGeometry(bar[2]>.1?2.1:.1,.08,bar[3]>.1?2.1:.1),ironM);
        barm.position.set(bar[0],hy,bar[1]);g.add(barm);
      });
    });
    /* 윗 뚜껑 */
    var top=new THREE.Mesh(new THREE.BoxGeometry(2.2,.08,2.2),ironM);
    top.position.set(0,2.5,0);g.add(top);
    /* 사슬 (원통 체인처럼) */
    var chainM=new THREE.MeshLambertMaterial({color:0x2a2a35});
    for(var ci2=0;ci2<5;ci2++){
      var ch=new THREE.Mesh(new THREE.TorusGeometry(.1,.03,4,8),chainM);
      ch.position.set(-1.2,2.3+ci2*.0,-1.2);ch.rotation.z=ci2*Math.PI/5;g.add(ch);
    }
    var chainDrop=new THREE.Mesh(new THREE.CylinderGeometry(.03,.03,.8,4),chainM);
    chainDrop.position.set(-1.2,1.9,-1.2);g.add(chainDrop);
    g.position.set(-85,0,660);scene.add(g);
  })();

  /* ── 파괴된/불탄 구조물 잔해 ── */
  (function(){
    var ruinM=new THREE.MeshLambertMaterial({color:0x1a1208});
    /* 무너진 벽 파편들 */
    [[-45,730,1.8,.4,1.2],[40,730,.4,1.6,.8],[-45,732.5,.4,1.0,1.5],[40,731.5,1.6,.4,1.0]].forEach(function(wp){
      var wall=new THREE.Mesh(new THREE.BoxGeometry(wp[2],wp[4],wp[3]),ruinM);
      wall.position.set(wp[0],wp[4]/2,wp[1]);
      wall.rotation.y=(Math.random()-.5)*.3;
      wall.castShadow=true;wall.receiveShadow=true;scene.add(wall);
    });
    /* 무너진 아치 */
    var archRuinM=new THREE.MeshLambertMaterial({color:0x140e06});
    var archPiece=new THREE.Mesh(new THREE.BoxGeometry(1.4,.4,.6),archRuinM);
    archPiece.position.set(0,1.5,731);archPiece.rotation.z=.7;
    archPiece.castShadow=true;scene.add(archPiece);
  })();
}

/* ════════════ 보스 구역 장식 ════════════ */
/* 보스: z:800 근처 원형 제단 */
function buildBossDecor(){
  var ominousM=new THREE.MeshLambertMaterial({color:0x1a1010});
  var darkStoneM=new THREE.MeshPhongMaterial({color:0x2a2020,shininess:30});
  var bannerBM=new THREE.MeshLambertMaterial({color:0x3a0808});
  var bannerTrimM=new THREE.MeshLambertMaterial({color:0x4a1a00});
  var darkCrystalM=new THREE.MeshPhongMaterial({color:0x330044,shininess:120});
  var weaponM=new THREE.MeshLambertMaterial({color:0x4a4a55});
  var boneM3=new THREE.MeshLambertMaterial({color:0xc8c0b0});
  var ritualM=new THREE.MeshLambertMaterial({color:0x0e0808});
  var ritualLineM=new THREE.MeshLambertMaterial({color:0x220a0a});

  /* ── 거대 석조 기둥 원형 배치 (12개) ── */
  var PILLAR_COUNT=12;
  var PILLAR_RADIUS=12;
  for(var pi=0;pi<PILLAR_COUNT;pi++){
    var pang=pi/PILLAR_COUNT*Math.PI*2;
    var px=Math.cos(pang)*PILLAR_RADIUS;
    var pz=800+Math.sin(pang)*PILLAR_RADIUS;
    var ph=4+Math.random()*3;
    /* 기둥 */
    var pillar=new THREE.Mesh(new THREE.CylinderGeometry(.55,.7,ph,8),darkStoneM);
    pillar.position.set(px,ph/2,pz);pillar.castShadow=true;pillar.receiveShadow=true;scene.add(pillar);
    /* 기둥 상단 캡 */
    var capG=new THREE.Mesh(new THREE.BoxGeometry(1.4,.4,1.4),ominousM);
    capG.position.set(px,ph+.2,pz);capG.castShadow=true;scene.add(capG);
    /* 기둥 장식 몰딩 */
    var mold2=new THREE.Mesh(new THREE.CylinderGeometry(.65,.65,.2,8),ominousM);
    mold2.position.set(px,ph*.35,pz);scene.add(mold2);
    /* 기둥 룬 새김 (얇은 선) */
    var runeM=new THREE.MeshLambertMaterial({color:0x330000});
    var rune=new THREE.Mesh(new THREE.BoxGeometry(.04,ph*.5,.55+.01),runeM);
    rune.position.set(px,ph/2,pz);rune.rotation.y=pang;scene.add(rune);
    /* 일부 기둥 부서짐 */
    if(pi%4===2){
      var topBroken=new THREE.Mesh(new THREE.CylinderGeometry(.4,.55,1.2,8),ominousM);
      topBroken.position.set(px+.4,ph*.6+.6,pz+.3);topBroken.rotation.z=.5;
      topBroken.castShadow=true;scene.add(topBroken);
    }
  }

  /* ── 의식 원형 바닥 무늬 ── */
  (function(){
    /* 바닥 어두운 기본 원 */
    var ritCircle=new THREE.Mesh(new THREE.CircleGeometry(11,32),ritualM);
    ritCircle.rotation.x=-Math.PI/2;ritCircle.position.set(0,.022,800);
    ritCircle.receiveShadow=true;scene.add(ritCircle);
    /* 방사형 선 8개 */
    for(var ri=0;ri<8;ri++){
      var ra=ri/8*Math.PI*2;
      var rline=new THREE.Mesh(new THREE.PlaneGeometry(.15,10.5),ritualLineM);
      rline.rotation.x=-Math.PI/2;rline.rotation.z=ra;
      rline.position.set(Math.cos(ra)*3.5,.025,800+Math.sin(ra)*3.5);
      scene.add(rline);
    }
    /* 내부 원 */
    var innerCircle=new THREE.Mesh(new THREE.CircleGeometry(5,24),ritualLineM);
    innerCircle.rotation.x=-Math.PI/2;innerCircle.position.set(0,.024,800);scene.add(innerCircle);
    var innerCircle2=new THREE.Mesh(new THREE.CircleGeometry(2.5,16),ritualM);
    innerCircle2.rotation.x=-Math.PI/2;innerCircle2.position.set(0,.025,800);scene.add(innerCircle2);
    /* 사각형 내부 무늬 */
    var sqM=new THREE.MeshLambertMaterial({color:0x1a0a0a});
    var sq=new THREE.Mesh(new THREE.PlaneGeometry(4,4),sqM);
    sq.rotation.x=-Math.PI/2;sq.rotation.z=Math.PI/4;sq.position.set(0,.026,800);scene.add(sq);
    /* 삼각형 꼭짓점 불꽃 마커 */
    var markerM=new THREE.MeshLambertMaterial({color:0x2a0808});
    for(var mi=0;mi<3;mi++){
      var ma=mi/3*Math.PI*2;
      var marker=new THREE.Mesh(new THREE.CylinderGeometry(.2,.25,.12,5),markerM);
      marker.position.set(Math.cos(ma)*4.5,.06,800+Math.sin(ma)*4.5);
      marker.castShadow=true;scene.add(marker);
    }
    /* 제단 주변 불빛 (붉은) */
    var ritL=new THREE.PointLight(0x660000,.8,25);ritL.position.set(0,2,800);scene.add(ritL);
  })();

  /* ── 바닥에 박힌 부러진 무기들 ── */
  (function(){
    var weaponDefs=[
      [-5,793,'sword'],[3,807,'axe'],[-8,805,'sword'],[7,795,'spear'],[-3,815,'sword'],[5,790,'axe'],
      [8,810,'sword'],[-7,818,'axe'],[12,798,'sword'],[-12,803,'axe']
    ];
    weaponDefs.forEach(function(wd){
      var g=new THREE.Group();
      if(wd[2]==='sword'){
        /* 칼날 */
        var blade=new THREE.Mesh(new THREE.BoxGeometry(.1,1.4,.05),weaponM);
        blade.position.set(0,.7,0);blade.castShadow=true;g.add(blade);
        /* 손잡이 */
        var guard=new THREE.Mesh(new THREE.BoxGeometry(.4,.1,.08),weaponM);
        guard.position.set(0,1.4,0);g.add(guard);
        var grip=new THREE.Mesh(new THREE.BoxGeometry(.08,.35,.08),new THREE.MeshLambertMaterial({color:0x3a2010}));
        grip.position.set(0,1.6,0);g.add(grip);
        /* 부러진 끝 */
        var broken=new THREE.Mesh(new THREE.BoxGeometry(.1,.3,.05),weaponM);
        broken.position.set(.08,-.12,0);broken.rotation.z=.7;g.add(broken);
      } else if(wd[2]==='axe'){
        var ahandle=new THREE.Mesh(new THREE.CylinderGeometry(.05,.07,.8,6),new THREE.MeshLambertMaterial({color:0x3a2010}));
        ahandle.position.set(0,.4,0);g.add(ahandle);
        var ahead=new THREE.Mesh(new THREE.BoxGeometry(.35,.3,.07),weaponM);
        ahead.position.set(.2,.75,0);g.add(ahead);
      } else { /* spear */
        var shaft=new THREE.Mesh(new THREE.CylinderGeometry(.04,.05,1.2,6),new THREE.MeshLambertMaterial({color:0x3a2010}));
        shaft.position.set(0,.6,0);g.add(shaft);
        var speartip=new THREE.Mesh(new THREE.ConeGeometry(.07,.25,4),weaponM);
        speartip.position.set(0,1.33,0);g.add(speartip);
      }
      /* 바닥에 박힌 효과 — 기울어짐 */
      g.rotation.z=(Math.random()-.5)*.4;
      g.rotation.y=Math.random()*Math.PI*2;
      g.position.set(wd[0],0,wd[1]);scene.add(g);
    });
  })();

  /* ── 거대 해골 장식 ── */
  (function(){
    var g=new THREE.Group();
    /* 메인 두개골 */
    var skull=new THREE.Mesh(new THREE.SphereGeometry(.7,10,8),boneM3);
    skull.position.set(0,2.8,0);skull.castShadow=true;g.add(skull);
    /* 눈구멍 */
    var eyeHM=new THREE.MeshLambertMaterial({color:0x1a0000});
    [-.25,.25].forEach(function(ex){
      var eye=new THREE.Mesh(new THREE.SphereGeometry(.18,7,6),eyeHM);
      eye.position.set(ex,2.85,.6);g.add(eye);
    });
    /* 코 구멍 */
    var noseH=new THREE.Mesh(new THREE.BoxGeometry(.1,.1,.2),eyeHM);
    noseH.position.set(0,2.6,.65);g.add(noseH);
    /* 이빨 */
    var toothM2=new THREE.MeshLambertMaterial({color:0xd0c8b0});
    for(var ti2=0;ti2<5;ti2++){
      var tooth2=new THREE.Mesh(new THREE.BoxGeometry(.12,.2,.1),toothM2);
      tooth2.position.set((ti2-2)*.16,2.4,.55);g.add(tooth2);
    }
    /* 기반 */
    var skullBase=new THREE.Mesh(new THREE.BoxGeometry(1.8,.4,1.8),ominousM);
    skullBase.position.set(0,.2,0);skullBase.castShadow=true;skullBase.receiveShadow=true;g.add(skullBase);
    /* 기반 위 목뼈 */
    var neckBone=new THREE.Mesh(new THREE.CylinderGeometry(.15,.2,1.8,7),boneM3);
    neckBone.position.set(0,1.3,0);neckBone.castShadow=true;g.add(neckBone);
    /* 뼈 방출하는 붉은 눈 빛 */
    var eyeL=new THREE.PointLight(0x880000,.8,6);eyeL.position.set(0,2.85,.4);g.add(eyeL);
    g.position.set(0,0,788);scene.add(g);
  })();

  /* ── 어두운 수정 군집 ── */
  [[-10,793,1.0],[-9,794,.6],[-11,792,.5],
   [9,810,.9],[10,809,.6],[11,811,.7],
   [-4,823,1.1],[-3,824,.7],[-5,822,.5],
   [18,785,.8],[19,787,.5],[-18,790,.9],[-17,792,.6],
   [0,825,1.2],[-14,815,.8],[14,818,.7]
  ].forEach(function(cd){
    var cry=new THREE.Mesh(new THREE.ConeGeometry(cd[2]*.3,cd[2]*1.6,5),darkCrystalM);
    cry.rotation.z=(Math.random()-.5)*.3;cry.rotation.y=Math.random()*Math.PI;
    cry.position.set(cd[0],cd[2]*.5,cd[1]);cry.castShadow=true;scene.add(cry);
  });

  /* ── 찢어진 배너들 ── */
  [[-10,789,.3],[-11,791,.2],[10,795,-.3],[11,793,-.2],[-6,813,.1],[6,809,-.1],
   [-15,783,.4],[15,787,-.4],[-8,820,.2],[8,816,-.2]
  ].forEach(function(bd){
    var g=new THREE.Group();
    /* 깃대 */
    var bpole=new THREE.Mesh(new THREE.CylinderGeometry(.06,.08,4.5,6),ominousM);
    bpole.position.set(0,2.25,0);bpole.castShadow=true;g.add(bpole);
    /* 깃대 뾰족 끝 */
    var btip=new THREE.Mesh(new THREE.ConeGeometry(.1,.3,4),new THREE.MeshLambertMaterial({color:0x4a1a00}));
    btip.position.set(0,4.65,0);btip.castShadow=true;g.add(btip);
    /* 찢어진 천 (여러 조각) */
    [0,1,2].forEach(function(bi){
      var bcloth=new THREE.Mesh(new THREE.BoxGeometry(.5+Math.random()*.3,
        .3+Math.random()*.25,.05),bannerBM);
      bcloth.position.set(.3+Math.random()*.15,3.8-bi*.35,0);
      bcloth.rotation.z=(Math.random()-.5)*.4;g.add(bcloth);
      /* 트림 */
      var trim=new THREE.Mesh(new THREE.BoxGeometry(.06,.3,.06),bannerTrimM);
      trim.position.set(.6+Math.random()*.1,3.8-bi*.35,0);g.add(trim);
    });
    g.position.set(bd[0],0,bd[1]);g.rotation.y=bd[2];scene.add(g);
  });

  /* ── 보스 구역 분위기 조명 ── */
  var bossL1=new THREE.PointLight(0x440000,.8,60);bossL1.position.set(0,5,800);scene.add(bossL1);
  var bossL2=new THREE.PointLight(0x330000,.5,50);bossL2.position.set(0,4,820);scene.add(bossL2);
}

/* changeZone — 호환성 유지용. 오픈월드에서는 playerDied에서 호출됨 */
function changeZone(zoneName){
  if(zoneName==='village'){
    PL.group.position.set(WORLD_SPAWN[0],0,WORLD_SPAWN[1]);
    playerHP=Math.min(playerMaxHP,playerHP+Math.floor(playerMaxHP*.25));
    updPlayerHpBar();
  }
  currentZone=zoneName;
}
