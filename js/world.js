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

/* ── 지형 높이 헬퍼 ── */
/* 특정 x,z가 언덕 위인지 체크 (부드러운 높이 반환) */
function getTerrainY(x,z){
  /* 언덕 목록 [cx, cz, radius, height] — buildHills 에서 채움 */
  var h=0;
  if(typeof TERRAIN_HILLS==='undefined')return 0;
  for(var i=0;i<TERRAIN_HILLS.length;i++){
    var hill=TERRAIN_HILLS[i];
    var dx=x-hill[0],dz=z-hill[1];
    var d=Math.sqrt(dx*dx+dz*dz);
    if(d<hill[2]){
      var t=1-d/hill[2];
      h+=hill[3]*t*t;
    }
  }
  return h;
}
var TERRAIN_HILLS=[];

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
  /* 광장 */
  var pathM=new THREE.MeshLambertMaterial({color:0xb8a880});
  var plaza=new THREE.Mesh(new THREE.CylinderGeometry(8,8,.05,32),pathM);
  plaza.position.set(0,.02,-8);plaza.receiveShadow=true;p.add(plaza);
  /* 마을 → 초원 → 숲까지 이어지는 부드러운 흙길 (3x 확장) */
  var cp=[
    [0,-8],[0,5],[1,20],[3,80],[1,160],[-2,250],[2,340],[-1,440],
    [3,550],[0,660],[-2,780],[1,900],[0,1050],[-1,1200],[2,1350],[0,1500]
  ];
  function lerpPath(pts,steps){
    var out=[];
    for(var i=0;i<pts.length-1;i++){
      for(var s=0;s<steps;s++){
        var t=s/steps;
        out.push([pts[i][0]*(1-t)+pts[i+1][0]*t, pts[i][1]*(1-t)+pts[i+1][1]*t]);
      }
    }
    out.push(pts[pts.length-1]);
    return out;
  }
  var smooth=lerpPath(cp,20);
  for(var pi=0;pi<smooth.length;pi++){
    var disc=new THREE.Mesh(new THREE.CircleGeometry(5,32),pathM);
    disc.rotation.x=-Math.PI/2;
    disc.position.set(smooth[pi][0],.05,smooth[pi][1]);
    p.add(disc);
  }
  /* 갈림길 — 더 멀리 뻗도록 (x: ±240까지) */
  var forkE=[[4,160],[20,180],[50,210],[90,250],[140,300],[200,360]];
  var forkW=[[-4,160],[-20,180],[-50,210],[-90,250],[-140,300],[-200,360]];
  [forkE,forkW].forEach(function(pts){
    var sm=lerpPath(pts,12);
    for(var fi=0;fi<sm.length;fi++){
      var fd=new THREE.Mesh(new THREE.CircleGeometry(4,32),pathM);
      fd.rotation.x=-Math.PI/2;fd.position.set(sm[fi][0],.05,sm[fi][1]);
      p.add(fd);
    }
  });
}

function mkWaterRiver(parent){
  var p=parent||scene;
  /* animated water material — store mesh for UV update */
  var riverM=new THREE.MeshLambertMaterial({color:0x2288cc,emissive:new THREE.Color(0x004488),emissiveIntensity:.25,transparent:true,opacity:.78});
  /* rivers run the full length of expanded world (village+meadow+forest ~1680 units) */
  /* x positions from RIVER_X_LEFT / RIVER_X_RIGHT = ±165 */
  var riverLen=1680;
  var riverCenterZ=riverLen/2+20;
  var rl=new THREE.Mesh(new THREE.PlaneGeometry(18,riverLen),riverM);rl.rotation.x=-Math.PI/2;rl.position.set(RIVER_X_LEFT,.08,riverCenterZ);p.add(rl);
  waterMeshes.push(rl);
  var rr=new THREE.Mesh(new THREE.PlaneGeometry(18,riverLen),riverM.clone());rr.rotation.x=-Math.PI/2;rr.position.set(RIVER_X_RIGHT,.08,riverCenterZ);p.add(rr);
  waterMeshes.push(rr);
  /* subtle extra depth plane below water */
  var depthM=new THREE.MeshLambertMaterial({color:0x114466,transparent:true,opacity:.45});
  var dl=new THREE.Mesh(new THREE.PlaneGeometry(18,riverLen),depthM);dl.rotation.x=-Math.PI/2;dl.position.set(RIVER_X_LEFT,-.06,riverCenterZ);p.add(dl);
  var dr=new THREE.Mesh(new THREE.PlaneGeometry(18,riverLen),depthM);dr.rotation.x=-Math.PI/2;dr.position.set(RIVER_X_RIGHT,-.06,riverCenterZ);p.add(dr);
  /* river bank dirt strips */
  var bankM=new THREE.MeshLambertMaterial({color:0x3a2808});
  [RIVER_X_LEFT-12,RIVER_X_LEFT+12,RIVER_X_RIGHT-12,RIVER_X_RIGHT+12].forEach(function(bx){
    var bank=new THREE.Mesh(new THREE.PlaneGeometry(6,riverLen),bankM);
    bank.rotation.x=-Math.PI/2;bank.position.set(bx,.005,riverCenterZ);p.add(bank);
  });
  /* water lights every 200 units */
  for(var wli=0;wli<8;wli++){
    var wlz=200+wli*200;
    var wl=new THREE.PointLight(0x2288ff,.3,60);wl.position.set(0,1,wlz);p.add(wl);
  }
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

/* ════════════ 바이옴 지면 빌드 (3x 확장) ════════════ */
function buildGroundPlanes(){
  /* 기본 바닥 — 전체 월드 (3x) */
  var baseGndDeep=new THREE.Mesh(new THREE.PlaneGeometry(1260,2730),new THREE.MeshLambertMaterial({color:0x1a3a0e}));
  baseGndDeep.rotation.x=-Math.PI/2;baseGndDeep.position.set(0,-.04,1270);scene.add(baseGndDeep);

  var baseGnd=new THREE.Mesh(new THREE.PlaneGeometry(1260,2730),new THREE.MeshLambertMaterial({color:0x2a5a1a}));
  baseGnd.rotation.x=-Math.PI/2;baseGnd.position.set(0,0,1270);baseGnd.receiveShadow=true;scene.add(baseGnd);

  /* 바이옴별 컬러 오버레이 (y=0.01) */
  /* 마을: x:-22~22, z:-32~20 */
  var villGnd=new THREE.Mesh(new THREE.PlaneGeometry(44,52),new THREE.MeshLambertMaterial({color:0x2a5a1a}));
  villGnd.rotation.x=-Math.PI/2;villGnd.position.set(0,.01,-6);villGnd.receiveShadow=true;scene.add(villGnd);

  /* 초원: x:-240~240, z:20~900 — 밝은 녹색 */
  var meadGnd=new THREE.Mesh(new THREE.PlaneGeometry(480,880),new THREE.MeshLambertMaterial({color:0x3a7a1a}));
  meadGnd.rotation.x=-Math.PI/2;meadGnd.position.set(0,.01,460);meadGnd.receiveShadow=true;scene.add(meadGnd);

  /* 늪 서쪽: x:-600~-240, z:20~900 */
  var swWGnd=new THREE.Mesh(new THREE.PlaneGeometry(360,880),new THREE.MeshLambertMaterial({color:0x1a3a0a}));
  swWGnd.rotation.x=-Math.PI/2;swWGnd.position.set(-420,.01,460);swWGnd.receiveShadow=true;scene.add(swWGnd);

  /* 늪 동쪽: x:240~600, z:20~900 */
  var swEGnd=new THREE.Mesh(new THREE.PlaneGeometry(360,880),new THREE.MeshLambertMaterial({color:0x1a3a0a}));
  swEGnd.rotation.x=-Math.PI/2;swEGnd.position.set(420,.01,460);swEGnd.receiveShadow=true;scene.add(swEGnd);

  /* 어두운 숲: x:-360~360, z:900~1680 */
  var dkGnd=new THREE.Mesh(new THREE.PlaneGeometry(720,780),new THREE.MeshLambertMaterial({color:0x0a1a08}));
  dkGnd.rotation.x=-Math.PI/2;dkGnd.position.set(0,.01,1290);dkGnd.receiveShadow=true;scene.add(dkGnd);

  /* 정글: x:240~600, z:900~1680 */
  var jgGnd=new THREE.Mesh(new THREE.PlaneGeometry(360,780),new THREE.MeshLambertMaterial({color:0x0a2a0a}));
  jgGnd.rotation.x=-Math.PI/2;jgGnd.position.set(420,.01,1290);jgGnd.receiveShadow=true;scene.add(jgGnd);

  /* 화산: x:-300~300, z:1680~2600 */
  var vlGnd=new THREE.Mesh(new THREE.PlaneGeometry(600,920),new THREE.MeshLambertMaterial({color:0x1a0a05}));
  vlGnd.rotation.x=-Math.PI/2;vlGnd.position.set(0,.01,2140);vlGnd.receiveShadow=true;scene.add(vlGnd);

  /* ── 바이옴 전환 스트립 ── */
  var trans1M=new THREE.MeshLambertMaterial({color:0x305a18});
  var trans2M=new THREE.MeshLambertMaterial({color:0x152a0c});
  var trans3M=new THREE.MeshLambertMaterial({color:0x120a04});
  /* 마을-초원 (z=18~22) */
  var t1=new THREE.Mesh(new THREE.PlaneGeometry(480,8),trans1M);t1.rotation.x=-Math.PI/2;t1.position.set(0,.012,20);scene.add(t1);
  /* 초원-숲 (z=898~902) */
  var t2=new THREE.Mesh(new THREE.PlaneGeometry(720,8),trans2M);t2.rotation.x=-Math.PI/2;t2.position.set(0,.012,900);scene.add(t2);
  /* 숲-화산 (z=1678~1682) */
  var t3=new THREE.Mesh(new THREE.PlaneGeometry(720,8),trans3M);t3.rotation.x=-Math.PI/2;t3.position.set(0,.012,1680);scene.add(t3);
  /* 초원-늪 좌 (x=-242~-238) */
  var t4=new THREE.Mesh(new THREE.PlaneGeometry(8,880),new THREE.MeshLambertMaterial({color:0x285018}));t4.rotation.x=-Math.PI/2;t4.position.set(-240,.012,460);scene.add(t4);
  /* 초원-늪 우 (x=238~242) */
  var t5=new THREE.Mesh(new THREE.PlaneGeometry(8,880),new THREE.MeshLambertMaterial({color:0x285018}));t5.rotation.x=-Math.PI/2;t5.position.set(240,.012,460);scene.add(t5);
}

/* ════════════ 지형 언덕 + 산맥 빌드 ════════════ */
function buildHills(){
  var hillM=new THREE.MeshLambertMaterial({color:0x3a6a22});
  var hillDarkM=new THREE.MeshLambertMaterial({color:0x2a5a18});
  var mountainM=new THREE.MeshLambertMaterial({color:0x556044});
  var mountainPeakM=new THREE.MeshLambertMaterial({color:0x8a9080});
  var snowM=new THREE.MeshLambertMaterial({color:0xeeeeff});
  var rockM=new THREE.MeshLambertMaterial({color:0x6a6050});

  /* ── 초원 구릉 (z:20~900) ── */
  var meadowHillDefs=[
    [-100,150,30,4],[-180,300,28,3.5],[80,250,25,3],
    [-60,420,35,5],[120,500,28,4],[-150,620,32,4.5],
    [60,700,26,3.5],[-80,820,30,4],[160,380,22,3],
    [-120,550,24,3.2],[40,680,28,3.8],[-180,750,20,2.8]
  ];
  meadowHillDefs.forEach(function(hd){
    TERRAIN_HILLS.push(hd);
    /* 구릉 본체 — 납작한 구체 반구 */
    var hill=new THREE.Mesh(new THREE.SphereGeometry(hd[2],16,8),hillM);
    hill.scale.set(1,hd[3]/hd[2],1);
    hill.position.set(hd[0],hd[3]*.5,hd[1]);
    hill.castShadow=true;hill.receiveShadow=true;scene.add(hill);
    /* 언덕 위 짙은 풀 */
    var grassTop=new THREE.Mesh(new THREE.SphereGeometry(hd[2]*.6,12,6),hillDarkM);
    grassTop.scale.set(1,hd[3]/hd[2]*.5,1);
    grassTop.position.set(hd[0],hd[3]*.9,hd[1]);
    scene.add(grassTop);
  });

  /* ── 초원 변두리 작은 돌덩이 (지면 울퉁불퉁) ── */
  for(var bi=0;bi<30;bi++){
    var bx=(Math.random()-.5)*420,bz=30+Math.random()*860;
    if(Math.abs(bx)<50)continue;/* 중앙 길 비우기 */
    var bs=0.5+Math.random()*1.5;
    var bump=new THREE.Mesh(new THREE.SphereGeometry(bs,8,5),rockM);
    bump.scale.set(1+Math.random()*.5,0.2+Math.random()*.2,1+Math.random()*.5);
    bump.position.set(bx,bs*.1,bz);
    bump.castShadow=true;bump.receiveShadow=true;scene.add(bump);
  }

  /* ── 초원 경계 산맥 (동서 양쪽 경계) ── */
  /* 서쪽 산맥 x:-580~-440, z:50~900 */
  /* 동쪽 산맥 x:440~580, z:50~900 */
  [[-510,120],[-550,280],[-520,450],[-490,600],[-540,780],
   [510,120],[550,280],[520,450],[490,600],[540,780]
  ].forEach(function(mp){
    var mh=18+Math.random()*14;
    var mr=22+Math.random()*12;
    /* 산 기반 원뿔 */
    var mtBase=new THREE.Mesh(new THREE.ConeGeometry(mr,mh,8),mountainM);
    mtBase.position.set(mp[0],mh/2,mp[1]);mtBase.castShadow=true;mtBase.receiveShadow=true;scene.add(mtBase);
    /* 산 정상 */
    var mtPeak=new THREE.Mesh(new THREE.ConeGeometry(mr*.35,mh*.4,6),mountainPeakM);
    mtPeak.position.set(mp[0],mh*.85,mp[1]);mtPeak.castShadow=true;scene.add(mtPeak);
    /* 눈 덮인 봉우리 (높은 산만) */
    if(mh>24){
      var snow=new THREE.Mesh(new THREE.ConeGeometry(mr*.2,mh*.22,5),snowM);
      snow.position.set(mp[0],mh*1.02,mp[1]);snow.castShadow=true;scene.add(snow);
    }
  });

  /* ── 어두운 숲 구릉 (z:900~1680) ── */
  var darkHillDefs=[
    [-80,1000,28,4.5],[-180,1150,32,5],
    [70,1200,26,4],[120,1380,30,4.8],
    [-100,1500,28,4.2],[160,1600,24,3.5],
    [0,1050,20,3],[-150,1300,25,3.8]
  ];
  var darkHillM=new THREE.MeshLambertMaterial({color:0x101a08});
  darkHillDefs.forEach(function(hd){
    TERRAIN_HILLS.push(hd);
    var hill=new THREE.Mesh(new THREE.SphereGeometry(hd[2],14,8),darkHillM);
    hill.scale.set(1,hd[3]/hd[2],1);
    hill.position.set(hd[0],hd[3]*.5,hd[1]);
    hill.castShadow=true;hill.receiveShadow=true;scene.add(hill);
  });

  /* ── 화산 지대 산맥 (z:1680~2600) ── */
  var volcanoMountainM=new THREE.MeshLambertMaterial({color:0x1a0a04});
  var lavaVentM=new THREE.MeshLambertMaterial({color:0xff3300,transparent:true,opacity:.7});
  [
    [-200,1800,40,30],[-280,2000,48,38],[150,1900,36,28],
    [240,2100,44,34],[-180,2200,38,30],[0,1750,50,42],
    [200,2350,42,32],[-240,2400,46,36],[80,2500,38,28]
  ].forEach(function(vp){
    /* 화산 원뿔 */
    var vc=new THREE.Mesh(new THREE.ConeGeometry(vp[2],vp[3],8),volcanoMountainM);
    vc.position.set(vp[0],vp[3]/2,vp[1]);vc.castShadow=true;vc.receiveShadow=true;scene.add(vc);
    /* 분화구 (원뿔 위 오목한 구체) */
    var craterM=new THREE.MeshLambertMaterial({color:0x0a0404});
    var crater=new THREE.Mesh(new THREE.CylinderGeometry(vp[2]*.25,vp[2]*.3,vp[3]*.08,8),craterM);
    crater.position.set(vp[0],vp[3]*.95,vp[1]);scene.add(crater);
    /* 용암 빛 */
    if(Math.random()<.5){
      var lavaGlow=new THREE.PointLight(0xff3300,.8,vp[2]*1.5);
      lavaGlow.position.set(vp[0],vp[3]*.9,vp[1]);scene.add(lavaGlow);
    }
  });
}

/* ════════════ 마을 빌드 ════════════ */
function buildVillage(){
  /* 지면 디테일 */
  scatterGroundDetail(scene,20,20,20,'grass',0,-6);
  scatterGroundDetail(scene,10,18,18,'stone',0,-6);
  scatterGroundDetail(scene,10,16,16,'flower',0,-6);

  /* 조명 — 따뜻한 앰버 톤 */


  /* 건물 주변 포인트 라이트 (따뜻한 글로우) */
  var shopLight1=new THREE.PointLight(0xff9944,.2,18);shopLight1.position.set(0,3,-8);scene.add(shopLight1);

  /* 반투명 안개 평면 (지면 레벨) */
  var fogPlaneM=new THREE.MeshLambertMaterial({color:0xaabb88,transparent:true,opacity:.06});
  [[-8,0,5],[8,0,-15]].forEach(function(fp){
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
    [-17,-4],[-17,-16],[-15,-26],
    [17,-4],[17,-16],[15,-26],
    [-5,13],[5,13],
    [-12,-30],[12,-30],
    [-20,-12],[20,-12],
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

  var COUNT=50;
  var pos=new Float32Array(COUNT*3);
  fireflyBaseY=new Float32Array(COUNT);
  fireflyPhases=new Float32Array(COUNT);

  for(var i=0;i<COUNT;i++){
    /* scatter around village and meadow mostly */
    var px=(Math.random()-.5)*240;
    var py=0.5+Math.random()*3.5;
    var pz=-30+(Math.random())*930;
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
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));

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
  sun.shadow.camera.far=2700;
  sun.shadow.camera.left=-660;
  sun.shadow.camera.right=660;
  sun.shadow.camera.top=660;
  sun.shadow.camera.bottom=-660;
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

  /* 지형 언덕 + 산맥 */
  buildHills();

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

  /* Bloom 제거 — 성능 최적화 */
  composer=null;

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
var _vfxFrame=0;
function updVisualFX(t){
  _vfxFrame++;
  /* 반딧불 — 3프레임마다 업데이트 */
  if(fireflyPoints&&fireflyPositions&&_vfxFrame%3===0){
    var pos=fireflyPositions;
    var COUNT=pos.length/3;
    for(var i=0;i<COUNT;i++){
      pos[i*3+1]=fireflyBaseY[i]+Math.sin(t*1.1+fireflyPhases[i])*0.6;
    }
    fireflyPoints.geometry.attributes.position.needsUpdate=true;
  }

  /* 강물 UV 오프셋 애니메이션 (머티리얼 offset 사용 — 빠름) */
  waterMeshes.forEach(function(mesh){
    if(mesh.material&&mesh.material.map){
      mesh.material.map.offset.y+=0.0015;
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
  fenceRow(-22,12,-22,-28,8);
  /* 마을 동쪽 울타리 */
  fenceRow(22,12,22,-28,8);
  /* 마을 북쪽 (성 방향 제외) */
  fenceRow(-22,12,-12,12,3);
  fenceRow(12,12,22,12,3);
  /* 남쪽 게이트 옆 */
  fenceRow(-22,-28,-9,-28,3);
  fenceRow(9,-28,22,-28,3);
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
  flowerBed(-12,-6, 5);
  flowerBed(10,-5,  5);
  flowerBed(-4,-20, 4);
  flowerBed(4,-20,  4);
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
  barrel(-16,-6,0,0);barrel(16,-6,0,0);
  crate(-17,-8,0);crate(5,-21,0);
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
  /* 광장 코너 */
  banner(0,3,    bannerColors[2]);
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
  lampPost(-3.5,-18); lampPost(3.5,-18);
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
/* 초원: x:-240~240, z:20~900 (3x 확장) */
function buildMeadowDecor(){
  var stoneM=new THREE.MeshLambertMaterial({color:0x888070});
  var logM=new THREE.MeshLambertMaterial({color:0x4a2e0a});
  var signM=new THREE.MeshLambertMaterial({color:0x6e4010});
  var meadowFlowerColors=[0xffee44,0xff7733,0xcc44ff,0xffffff,0xff4488,0x88ddff,0xffaa00];

  /* ── 큰 바위/볼더 클러스터 (3x 넓게) ── */
  var boulderDefs=[
    [-160,100,2.2],[-200,350,1.8],[130,150,2.4],[180,400,2.0],
    [-80,550,2.2],[100,650,1.8],[-140,750,2.0],[160,800,2.4],
    [-50,280,1.6],[60,480,2.0],[-120,680,1.9],[80,820,1.8],
    [-220,200,1.5],[200,600,2.2],[-60,450,1.8],[70,300,2.0]
  ];
  boulderDefs.forEach(function(bd){
    var rock=new THREE.Mesh(new THREE.DodecahedronGeometry(bd[2],1),stoneM);
    rock.position.set(bd[0],bd[2]*.4,bd[1]);
    rock.rotation.set(Math.random()*Math.PI,Math.random()*Math.PI,Math.random()*.5);
    rock.castShadow=true;rock.receiveShadow=true;scene.add(rock);
  });

  /* ── 쓰러진 통나무 ── */
  [[-90,180,0.3],[120,450,1.2],[-140,630,0.1],[80,350,0.4],
   [-60,720,0.8],[100,860,1.5],[-180,500,0.2],[160,250,0.9]
  ].forEach(function(ld){
    var log=new THREE.Mesh(new THREE.CylinderGeometry(.3,.35,4+Math.random()*3,8),logM);
    log.rotation.z=Math.PI/2;log.rotation.y=ld[2];
    log.position.set(ld[0],.3,ld[1]);
    log.castShadow=true;log.receiveShadow=true;scene.add(log);
  });

  /* ── 야생화 패치 ── */
  for(var wfi=0;wfi<80;wfi++){
    var wx2=(Math.random()-.5)*440,wz2=22+Math.random()*870;
    if(Math.abs(wx2)<22&&wz2<20)continue;
    var wfc=meadowFlowerColors[Math.floor(Math.random()*meadowFlowerColors.length)];
    var wfpetal=new THREE.Mesh(new THREE.SphereGeometry(.12+Math.random()*.06,6,5),
      new THREE.MeshLambertMaterial({color:wfc}));
    wfpetal.position.set(wx2,.25,wz2);scene.add(wfpetal);
  }

  /* ── 방향 표지판 ── */
  (function(){
    var g=new THREE.Group();
    var pole=new THREE.Mesh(new THREE.BoxGeometry(.18,.18,2.2),signM);
    pole.position.set(0,1.1,0);pole.castShadow=true;pole.receiveShadow=true;g.add(pole);
    var arrowMat=new THREE.MeshLambertMaterial({color:0x7a4a10});
    [['마을',0,-1.0,-.3,0],[' 숲  ',0,.9,.1,Math.PI/8],[' 늪  ',-Math.PI/2,-.5,.25,-Math.PI/12]].forEach(function(ai,idx){
      var sign=new THREE.Mesh(new THREE.BoxGeometry(1.2,.28,.08),arrowMat);
      sign.position.set(ai[3]*.8,1.5+idx*.38,ai[2]*.08);
      sign.rotation.y=ai[4];
      sign.castShadow=true;g.add(sign);
      var tip2=new THREE.Mesh(new THREE.ConeGeometry(.14,.22,4),arrowMat);
      tip2.rotation.z=Math.PI/2*(idx%2===0?1:-1);
      tip2.position.set((idx%2===0?.7:-.7),1.5+idx*.38,ai[2]*.08);g.add(tip2);
    });
    g.position.set(2,0,22);scene.add(g);
  })();

  /* ── 고대 석조 기둥 폐허 — 중간 초원 ── */
  (function(){
    var pillarM=new THREE.MeshLambertMaterial({color:0x8a8070});
    var capM2=new THREE.MeshLambertMaterial({color:0x6a6050});
    var pillarDefs=[
      [-130,560,4.5,false],
      [-128,563,3.2,false],
      [-126,561,0,true]
    ];
    pillarDefs.forEach(function(pd){
      var px2=pd[0],pz2=pd[1],ph2=pd[2],fallen=pd[3];
      if(!fallen){
        var pil=new THREE.Mesh(new THREE.CylinderGeometry(.4,.5,ph2,8),pillarM);
        pil.position.set(px2,ph2/2,pz2);pil.castShadow=true;pil.receiveShadow=true;scene.add(pil);
        var pcap=new THREE.Mesh(new THREE.BoxGeometry(1.2,.3,1.2),capM2);
        pcap.position.set(px2,ph2+.15,pz2);pcap.castShadow=true;scene.add(pcap);
      } else {
        var fpil=new THREE.Mesh(new THREE.CylinderGeometry(.4,.5,3.5,8),pillarM);
        fpil.rotation.z=Math.PI/2;fpil.rotation.y=0.4;
        fpil.position.set(pd[0],.4,pd[1]);fpil.castShadow=true;fpil.receiveShadow=true;scene.add(fpil);
      }
    });
    var slabM=new THREE.MeshLambertMaterial({color:0x7a7060});
    var slab=new THREE.Mesh(new THREE.BoxGeometry(3.5,.2,2.2),slabM);
    slab.position.set(-128,.1,562);slab.rotation.y=0.15;
    slab.castShadow=true;slab.receiveShadow=true;scene.add(slab);
  })();

  /* ── 키 큰 풀 클러스터 ── */
  var tallGrassM=new THREE.MeshLambertMaterial({color:0x3a7a1a});
  var tallGrass2M=new THREE.MeshLambertMaterial({color:0x4a8a22});
  [[-180,80],[160,200],[-50,350],[120,480],
   [-200,600],[80,720],[-110,820],[190,150],
   [-40,500],[90,650],[-160,400],[60,280],
   [0,380],[-90,700],[140,850],[-70,130]
  ].forEach(function(pp){
    var tgh=.6+Math.random()*.7;
    var tgm=Math.random()>.5?tallGrassM:tallGrass2M;
    var tg=new THREE.Mesh(new THREE.ConeGeometry(.08+Math.random()*.06,tgh,4),tgm);
    tg.position.set(pp[0],tgh/2,pp[1]);
    tg.rotation.y=Math.random()*Math.PI;
    tg.castShadow=true;scene.add(tg);
  });
}

/* ════════════ 숲 장식 ════════════ */
/* 어두운 숲: x:-360~360, z:900~1680 (3x 확장) */
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
  [[-180,950,0.6],[150,1100,2.2],[-120,1250,-0.3],
   [70,1380,1.1],[-220,1050,0.8],[200,1550,-0.4],
   [-80,1450,0.5],[140,1620,1.8],[-160,1300,0.3]
  ].forEach(function(ld){
    var llen=5+Math.random()*5;
    var log=new THREE.Mesh(new THREE.CylinderGeometry(.32,.4,llen,8),logM);
    log.rotation.z=Math.PI/2;log.rotation.y=ld[2];
    log.position.set(ld[0],.35,ld[1]);
    log.castShadow=true;log.receiveShadow=true;scene.add(log);
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
    [-220,960],[120,1100],[-80,1250],[190,1400],[-160,1100],[60,1550],
    [-100,1500],[180,1300],[-50,1650],[130,1050]
  ];
  mushGroups.forEach(function(mg){
    var col=mushColors[Math.floor(Math.random()*mushColors.length)];
    var stemMat=new THREE.MeshLambertMaterial({color:col[0]});
    var capMat=new THREE.MeshLambertMaterial({color:col[1]});
    /* 메인 버섯만 */
    var msh=.4+Math.random()*.5;
    var mstem=new THREE.Mesh(new THREE.CylinderGeometry(.1,.14,msh,7),stemMat);
    mstem.position.set(mg[0],msh/2,mg[1]);mstem.castShadow=true;scene.add(mstem);
    var mcap=new THREE.Mesh(new THREE.SphereGeometry(.32+Math.random()*.12,8,6),capMat);
    mcap.scale.y=.55;mcap.position.set(mg[0],msh+.1,mg[1]);
    mcap.castShadow=true;scene.add(mcap);
  });

  /* ── 나무 그루터기 + 도끼 ── */
  (function(){
    var axeHeadM=new THREE.MeshLambertMaterial({color:0x667788});
    var axeHandleM=new THREE.MeshLambertMaterial({color:0x5a3810});
    [[-50,980],[100,1350],[0,1580]].forEach(function(sp){
      /* 그루터기 */
      var sh=.5+Math.random()*.4;
      var stump=new THREE.Mesh(new THREE.CylinderGeometry(.5,.6,sh,8),stumpM);
      stump.position.set(sp[0],sh/2,sp[1]);stump.castShadow=true;stump.receiveShadow=true;scene.add(stump);
    });
    /* 도끼 박힌 그루터기 (하나만) */
    var axeStump=new THREE.Mesh(new THREE.CylinderGeometry(.55,.65,.65,8),stumpM);
    axeStump.position.set(-50,.33,980);
    axeStump.castShadow=true;axeStump.receiveShadow=true;scene.add(axeStump);
    /* 도끼 자루 */
    var handle=new THREE.Mesh(new THREE.CylinderGeometry(.05,.07,.8,6),axeHandleM);
    handle.rotation.z=.4;handle.position.set(-49.6,.75,980);handle.castShadow=true;scene.add(handle);
    /* 도끼 날 */
    var axeHead=new THREE.Mesh(new THREE.BoxGeometry(.35,.28,.08),axeHeadM);
    axeHead.rotation.z=.4;axeHead.position.set(-49.3,1.1,980);axeHead.castShadow=true;scene.add(axeHead);
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
    g.position.set(-200,0,1250);scene.add(g);
  })();

  /* ── 거미줄 (나무 사이 흰 평면) ── */
  [[-80,960,.4],[140,1180,.7],[-150,1380,.3],[70,1560,.6],[-40,1280,.5],[110,1480,.8]].forEach(function(wd){
    var webSize=.8+Math.random()*.6;
    var web=new THREE.Mesh(new THREE.PlaneGeometry(webSize*2,webSize*1.4),webM);
    web.rotation.y=wd[2];
    web.position.set(wd[0],2+Math.random()*1.5,wd[1]);
    scene.add(web);
  });

  /* ── 속이 빈 통나무 터널 ── */
  (function(){
    var tunnelLog=new THREE.Mesh(
      new THREE.CylinderGeometry(.9,.9,4,10,1,true),
      new THREE.MeshLambertMaterial({color:0x2a1a08,side:THREE.DoubleSide}));
    tunnelLog.rotation.z=Math.PI/2;tunnelLog.rotation.y=.2;
    tunnelLog.position.set(80,.9,1100);
    tunnelLog.castShadow=true;tunnelLog.receiveShadow=true;scene.add(tunnelLog);
    /* 끝 막힌 쪽 (한쪽만 열림) */
    var endCap=new THREE.Mesh(new THREE.CylinderGeometry(.9,.9,.12,10),
      new THREE.MeshLambertMaterial({color:0x1a0e04}));
    endCap.rotation.z=Math.PI/2;endCap.position.set(82.1,.9,1100);
    endCap.castShadow=true;scene.add(endCap);
    /* 이끼 위에 덮임 */
    var mossTop=new THREE.Mesh(new THREE.SphereGeometry(.95,8,6),mossM);
    mossTop.scale.set(1,.3,1);mossTop.position.set(80,.92,1100);scene.add(mossTop);
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
    g.position.set(-80,0,1440);scene.add(g);
  })();

  /* ── 이끼 낀 바위들 ── */
  [[-200,950,1.2],[170,1200,1.5],[-100,1400,1.0],[240,1600,1.3],[-180,1100,1.1],
   [120,1300,1.4],[-80,1550,1.2],[200,1050,1.5]
  ].forEach(function(rd){
    var rock=new THREE.Mesh(new THREE.DodecahedronGeometry(rd[2],1),stoneM);
    rock.position.set(rd[0],rd[2]*.35,rd[1]);
    rock.rotation.set(Math.random()*.8,Math.random()*Math.PI,.2);
    rock.castShadow=true;rock.receiveShadow=true;scene.add(rock);
  });

  /* ── 넝쿨 (나무에서 늘어지는 얇은 원통들) ── */
  [[-250,980,2.2],[-240,1300,2.0],[250,1200,2.2],[270,1600,2.0],
   [-180,1500,2.1],[200,1050,1.9],[-100,1650,2.2],[150,1400,2.0]
  ].forEach(function(vd){
    var vl=.8+Math.random()*.8;
    var vine=new THREE.Mesh(new THREE.CylinderGeometry(.025,.035,vl,5),vineM);
    vine.position.set(vd[0],vd[2]-vl/2,vd[1]);
    vine.castShadow=true;scene.add(vine);
  });
}

/* ════════════ 늪지 장식 ════════════ */
/* 늪 동쪽: x:240~600, z:20~900  /  서쪽: x:-600~-240, z:20~900 (3x 확장) */
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
    var sx=side*420; /* 중심 x (3x) */

    /* ── 죽은 나무 ── */
    [[300,150],[420,420],[330,650],[480,830]].forEach(function(pp){
      var tx=side*pp[0],tz=pp[1];
      var th=4+Math.random()*3;
      var trunk=new THREE.Mesh(new THREE.CylinderGeometry(.18,.3,th,7),deadTreeM);
      trunk.position.set(tx,th/2,tz);
      trunk.castShadow=true;trunk.receiveShadow=true;scene.add(trunk);
    });

    /* ── 진흙 구덩이 (갈색 원) ── */
    var mudM=new THREE.MeshLambertMaterial({color:0x2a1a08,transparent:true,opacity:.88});
    [[330,200,4.5],[450,460,3.5],[360,700,4.0],[510,850,3.5],[280,350,3.0],[400,600,3.5]].forEach(function(md){
      var mud=new THREE.Mesh(new THREE.CircleGeometry(md[2],10),mudM);
      mud.rotation.x=-Math.PI/2;mud.position.set(side*md[0],.015,md[1]);
      mud.receiveShadow=true;scene.add(mud);
    });

    /* ── 나무 판자 보드워크 ── */
    (function(){
      /* 부두 형태의 판자길 */
      var boards=[
        [side*300,150],[side*303,153],[side*306,156],[side*309,159]
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
      g.position.set(side*285,0,555);g.rotation.y=Math.random()*.5;scene.add(g);
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
      g.position.set(side*495,0,435);scene.add(g);
    })();

    /* ── 늪 등불 (초록 빛 포스트) ── */
    [[side*345,330],[side*360,750]].forEach(function(lp){
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

    /* 독성 꽃 — 제거됨 (성능 최적화) */
  }); /* end side loop */
}

/* ════════════ 화산 장식 ════════════ */
/* 화산: x:-300~300, z:1680~2600 (3x 확장) */
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
  [[-180,1800,1.8],[135,1980,2.2],[-90,2150,2.6],[195,2350,2.0],[-165,2560,2.3],[75,1720,1.8],
   [-240,2000,1.6],[200,1850,2.0],[-120,2400,2.2],[150,2100,1.8]
  ].forEach(function(od){
    var rock=new THREE.Mesh(new THREE.DodecahedronGeometry(od[2],0),obsidianM);
    rock.position.set(od[0],od[2]*.45,od[1]);
    rock.rotation.set(Math.random()*.8,Math.random()*Math.PI,Math.random()*.4);
    rock.castShadow=true;rock.receiveShadow=true;scene.add(rock);
  });

  /* ── 균열 지면 어두운 패치들 ── */
  [[-105,1785,7,4.5],[75,1995,6,4],[-165,2205,9,5.5],[135,2385,7,4.5],[-75,2565,10,6],
   [100,1850,5,4],[-130,2080,6,4.5],[160,2300,7,5]
  ].forEach(function(cp){
    var crk=new THREE.Mesh(new THREE.PlaneGeometry(cp[2],cp[3]),crackedGroundM);
    crk.rotation.x=-Math.PI/2;crk.position.set(cp[0],.019,cp[1]);
    crk.receiveShadow=true;scene.add(crk);
  });

  /* ── 뼈 더미 ── */
  [[-225,1800],[135,2145],[-120,2400],[60,2565],[-180,2000],[200,2250]].forEach(function(bp){
    /* 큰 뼈 2개 */
    for(var bpi=0;bpi<2;bpi++){
      var blen=.4+Math.random()*.6;
      var bone=new THREE.Mesh(new THREE.CylinderGeometry(.06,.09,blen,5),boneM2);
      bone.rotation.z=Math.random()*Math.PI;bone.rotation.y=Math.random()*Math.PI;
      bone.position.set(bp[0]+(Math.random()-.5)*.8,.06,bp[1]+(Math.random()-.5)*.8);
      bone.castShadow=true;scene.add(bone);
    }
    var skullV=new THREE.Mesh(new THREE.SphereGeometry(.18,7,6),boneM2);
    skullV.position.set(bp[0],.18,bp[1]);
    skullV.castShadow=true;scene.add(skullV);
  });

  /* ── 고대 석조 우상/조각상 ── */
  (function(){
    var statues=[[-195,1860],[0,2160],[165,2400],[-120,2580],[200,2000],[-150,2280]];
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
  [[-150,1770],[105,1980],[-210,2190],[45,2400],[0,2550],[-80,2100],[180,2300],[-200,2450]].forEach(function(vp){
    var g=new THREE.Group();
    /* 분기공 원뿔 */
    var vent=new THREE.Mesh(new THREE.ConeGeometry(.7,.9,8),ventConeM);
    vent.position.set(0,.45,0);vent.castShadow=true;vent.receiveShadow=true;g.add(vent);
    /* 내부 개구부 (어두운 원) */
    var holeM=new THREE.MeshLambertMaterial({color:0x060202});
    var hole=new THREE.Mesh(new THREE.CircleGeometry(.45,8),holeM);
    hole.rotation.x=-Math.PI/2;hole.position.set(0,.92,0);g.add(hole);
    g.position.set(vp[0],0,vp[1]);scene.add(g);
  });

  /* ── 불탄 나무 그루터기들 ── */
  [[-165,1740],[120,1980],[-195,2220],[75,2460],[0,2580],[-100,2050],[180,2350]
  ].forEach(function(cp){
    var charStump=new THREE.Mesh(new THREE.CylinderGeometry(.35,.5,.5+Math.random()*.4,7),charredM);
    charStump.position.set(cp[0],.3,cp[1]);charStump.castShadow=true;charStump.receiveShadow=true;scene.add(charStump);
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
    g.position.set(-255,0,1980);scene.add(g);
  })();

  /* ── 파괴된/불탄 구조물 잔해 ── */
  (function(){
    var ruinM=new THREE.MeshLambertMaterial({color:0x1a1208});
    /* 무너진 벽 파편들 */
    [[-135,2190,1.8,.4,1.2],[120,2190,.4,1.6,.8],[-135,2192.5,.4,1.0,1.5],[120,2191.5,1.6,.4,1.0]].forEach(function(wp){
      var wall=new THREE.Mesh(new THREE.BoxGeometry(wp[2],wp[4],wp[3]),ruinM);
      wall.position.set(wp[0],wp[4]/2,wp[1]);
      wall.rotation.y=(Math.random()-.5)*.3;
      wall.castShadow=true;wall.receiveShadow=true;scene.add(wall);
    });
    /* 무너진 아치 */
    var archRuinM=new THREE.MeshLambertMaterial({color:0x140e06});
    var archPiece=new THREE.Mesh(new THREE.BoxGeometry(1.4,.4,.6),archRuinM);
    archPiece.position.set(0,1.5,2193);archPiece.rotation.z=.7;
    archPiece.castShadow=true;scene.add(archPiece);
  })();
}

/* ════════════ 보스 구역 장식 ════════════ */
/* 보스: z:2400 근처 원형 제단 */
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

  /* ── 거대 석조 기둥 원형 배치 (8개) ── */
  var PILLAR_COUNT=8;
  var PILLAR_RADIUS=12;
  for(var pi=0;pi<PILLAR_COUNT;pi++){
    var pang=pi/PILLAR_COUNT*Math.PI*2;
    var px=Math.cos(pang)*PILLAR_RADIUS;
    var pz=2400+Math.sin(pang)*PILLAR_RADIUS;
    var ph=4+Math.random()*3;
    /* 기둥 */
    var pillar=new THREE.Mesh(new THREE.CylinderGeometry(.55,.7,ph,8),darkStoneM);
    pillar.position.set(px,ph/2,pz);pillar.castShadow=true;pillar.receiveShadow=true;scene.add(pillar);
    /* 기둥 상단 캡 */
    var capG=new THREE.Mesh(new THREE.BoxGeometry(1.4,.4,1.4),ominousM);
    capG.position.set(px,ph+.2,pz);capG.castShadow=true;scene.add(capG);
  }

  /* ── 의식 원형 바닥 무늬 ── */
  (function(){
    /* 바닥 어두운 기본 원 */
    var ritCircle=new THREE.Mesh(new THREE.CircleGeometry(11,32),ritualM);
    ritCircle.rotation.x=-Math.PI/2;ritCircle.position.set(0,.022,2400);
    ritCircle.receiveShadow=true;scene.add(ritCircle);
    /* 방사형 선 4개 */
    for(var ri=0;ri<4;ri++){
      var ra=ri/4*Math.PI*2;
      var rline=new THREE.Mesh(new THREE.PlaneGeometry(.15,10.5),ritualLineM);
      rline.rotation.x=-Math.PI/2;rline.rotation.z=ra;
      rline.position.set(Math.cos(ra)*3.5,.025,2400+Math.sin(ra)*3.5);
      scene.add(rline);
    }
    /* 내부 원 */
    var innerCircle=new THREE.Mesh(new THREE.CircleGeometry(5,24),ritualLineM);
    innerCircle.rotation.x=-Math.PI/2;innerCircle.position.set(0,.024,2400);scene.add(innerCircle);
    var innerCircle2=new THREE.Mesh(new THREE.CircleGeometry(2.5,16),ritualM);
    innerCircle2.rotation.x=-Math.PI/2;innerCircle2.position.set(0,.025,2400);scene.add(innerCircle2);
    /* 사각형 내부 무늬 */
    var sqM=new THREE.MeshLambertMaterial({color:0x1a0a0a});
    var sq=new THREE.Mesh(new THREE.PlaneGeometry(4,4),sqM);
    sq.rotation.x=-Math.PI/2;sq.rotation.z=Math.PI/4;sq.position.set(0,.026,2400);scene.add(sq);
    /* 삼각형 꼭짓점 불꽃 마커 */
    var markerM=new THREE.MeshLambertMaterial({color:0x2a0808});
    for(var mi=0;mi<3;mi++){
      var ma=mi/3*Math.PI*2;
      var marker=new THREE.Mesh(new THREE.CylinderGeometry(.2,.25,.12,5),markerM);
      marker.position.set(Math.cos(ma)*4.5,.06,2400+Math.sin(ma)*4.5);
      marker.castShadow=true;scene.add(marker);
    }
    /* 제단 주변 불빛 (붉은) */
    var ritL=new THREE.PointLight(0x660000,.8,25);ritL.position.set(0,2,2400);scene.add(ritL);
  })();

  /* ── 바닥에 박힌 부러진 무기들 ── */
  (function(){
    var weaponDefs=[
      [-5,2393,'sword'],[3,2407,'axe'],[7,2395,'spear'],[-3,2415,'sword']
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
    g.position.set(0,0,2388);scene.add(g);
  })();

  /* ── 어두운 수정 군집 ── */
  [[-10,2393,1.0],[9,2410,.9],[-4,2423,1.1],[18,2385,.8]
  ].forEach(function(cd){
    var cry=new THREE.Mesh(new THREE.ConeGeometry(cd[2]*.3,cd[2]*1.6,5),darkCrystalM);
    cry.rotation.z=(Math.random()-.5)*.3;cry.rotation.y=Math.random()*Math.PI;
    cry.position.set(cd[0],cd[2]*.5,cd[1]);cry.castShadow=true;scene.add(cry);
  });

  /* ── 찢어진 배너들 ── */
  [[-10,2389,.3],[10,2395,-.3],[-6,2415,.1],[6,2409,-.1]
  ].forEach(function(bd){
    var g=new THREE.Group();
    var bpole=new THREE.Mesh(new THREE.CylinderGeometry(.06,.08,4.5,6),ominousM);
    bpole.position.set(0,2.25,0);bpole.castShadow=true;g.add(bpole);
    var bcloth=new THREE.Mesh(new THREE.BoxGeometry(.6,1.0,.05),bannerBM);
    bcloth.position.set(.35,3.5,0);g.add(bcloth);
    g.position.set(bd[0],0,bd[1]);g.rotation.y=bd[2];scene.add(g);
  });

  /* ── 보스 구역 분위기 조명 ── */
  var bossL1=new THREE.PointLight(0x440000,.8,60);bossL1.position.set(0,5,2400);scene.add(bossL1);
  var bossL2=new THREE.PointLight(0x330000,.5,50);bossL2.position.set(0,4,2420);scene.add(bossL2);
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
