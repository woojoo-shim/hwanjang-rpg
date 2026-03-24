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

/* ════════════ 건물 내부 시스템 ════════════ */
var BUILDING_DOORS=[]; /* [{x,z,name,interiorY,exitX,exitZ}] */
var insideBuilding=null; /* 현재 들어가있는 건물 이름 */
var _savedOutdoorPos={x:0,z:0}; /* 나갈 때 복귀 위치 */
var _interiorBuilt={}; /* 이미 내부를 빌드했는지 */

function registerDoor(x,z,name){
  BUILDING_DOORS.push({x:x,z:z,name:name,interiorY:-100-(BUILDING_DOORS.length*50)});
}

function checkBuildingDoors(){
  if(!PL||!PL.group||typeof fadeOverlay==='undefined')return;
  var px=PL.group.position.x,pz=PL.group.position.z;
  /* 건물 내부에 있을 때 — 나가기 체크 */
  if(insideBuilding){
    if(Math.abs(px)<1.5&&pz>6){
      exitBuilding();
    }
    return;
  }
  /* 밖에서 — 입장 체크 */
  for(var i=0;i<BUILDING_DOORS.length;i++){
    var d=BUILDING_DOORS[i];
    var dx=px-d.x,dz=pz-d.z;
    if(dx*dx+dz*dz<9){/* 반경 3 이내 */
      enterBuilding(d);
      return;
    }
  }
}

function enterBuilding(door){
  insideBuilding=door.name;
  _savedOutdoorPos.x=PL.group.position.x;
  _savedOutdoorPos.z=PL.group.position.z;
  /* 페이드아웃 */
  fadeOverlay.style.opacity='1';
  fadeOverlay.style.background='#000';
  setTimeout(function(){
    /* 내부 빌드 (한 번만) */
    if(!_interiorBuilt[door.name]){
      buildInterior(door.name,door.interiorY);
      _interiorBuilt[door.name]=true;
    }
    /* 플레이어 이동 */
    PL.group.position.set(0,door.interiorY+1,0);
    /* 카메라 따라가기 */
    addChat('sys','[시스템]',door.name+'에 입장했습니다.');
    /* 페이드인 */
    setTimeout(function(){fadeOverlay.style.opacity='0';},200);
  },600);
}

function exitBuilding(){
  if(!insideBuilding)return;
  fadeOverlay.style.opacity='1';
  fadeOverlay.style.background='#000';
  setTimeout(function(){
    PL.group.position.set(_savedOutdoorPos.x,0,_savedOutdoorPos.z);
    addChat('sys','[시스템]','밖으로 나왔습니다.');
    insideBuilding=null;
    setTimeout(function(){fadeOverlay.style.opacity='0';},200);
  },600);
}

function buildInterior(name,baseY){
  var floorM=new THREE.MeshLambertMaterial({color:0x8a7050});
  var wallM=new THREE.MeshLambertMaterial({color:0xc4a870});
  var ceilM=new THREE.MeshLambertMaterial({color:0x6a5a3a});

  /* 바닥 */
  var floor=new THREE.Mesh(new THREE.PlaneGeometry(16,16),floorM);
  floor.rotation.x=-Math.PI/2;floor.position.set(0,baseY,0);floor.receiveShadow=true;scene.add(floor);
  /* 벽 4면 */
  var wallGeo=new THREE.PlaneGeometry(16,5);
  var w1=new THREE.Mesh(wallGeo,wallM);w1.position.set(0,baseY+2.5,-8);scene.add(w1);
  var w2=new THREE.Mesh(wallGeo,wallM);w2.position.set(0,baseY+2.5,8);w2.rotation.y=Math.PI;scene.add(w2);
  var w3=new THREE.Mesh(new THREE.PlaneGeometry(16,5),wallM);w3.rotation.y=Math.PI/2;w3.position.set(-8,baseY+2.5,0);scene.add(w3);
  var w4=new THREE.Mesh(new THREE.PlaneGeometry(16,5),wallM);w4.rotation.y=-Math.PI/2;w4.position.set(8,baseY+2.5,0);scene.add(w4);
  /* 천장 */
  var ceil=new THREE.Mesh(new THREE.PlaneGeometry(16,16),ceilM);
  ceil.rotation.x=Math.PI/2;ceil.position.set(0,baseY+5,0);scene.add(ceil);
  /* 조명 */
  var light=new THREE.PointLight(0xffaa44,1.2,20);light.position.set(0,baseY+4,0);scene.add(light);
  var ambient=new THREE.AmbientLight(0x333322,.5);scene.add(ambient);

  /* 나가기 문 표시 (빨간 카펫) */
  var exitM=new THREE.MeshLambertMaterial({color:0xaa2222});
  var exitMat=new THREE.Mesh(new THREE.PlaneGeometry(2,2),exitM);
  exitMat.rotation.x=-Math.PI/2;exitMat.position.set(0,baseY+.01,7);scene.add(exitMat);
  /* 나가기 표지판 */
  var exitLabel=document.createElement('div');
  exitLabel.className='nlabel';exitLabel.textContent='[ 나가기 ]';exitLabel.style.color='#ff4444';
  document.getElementById('cc').appendChild(exitLabel);
  /* 나가기 트리거 등록 */
  BUILDING_DOORS.push({x:0,z:7,name:'__exit__',interiorY:baseY,isExit:true,exitLabel:exitLabel});

  /* 건물별 가구 배치 */
  if(name==='여관'){
    /* 침대 2개 */
    var bedM=new THREE.MeshLambertMaterial({color:0x884422});
    var blanketM=new THREE.MeshLambertMaterial({color:0xcc4444});
    for(var bi=0;bi<2;bi++){
      var bx=-4+bi*8;
      var bed=new THREE.Mesh(new THREE.BoxGeometry(2.5,.4,4),bedM);bed.position.set(bx,baseY+.2,-5);scene.add(bed);
      var blanket=new THREE.Mesh(new THREE.BoxGeometry(2.3,.1,3),blanketM);blanket.position.set(bx,baseY+.45,-5);scene.add(blanket);
      var pillow=new THREE.Mesh(new THREE.BoxGeometry(1.2,.2,0.8),new THREE.MeshLambertMaterial({color:0xeeeeee}));pillow.position.set(bx,baseY+.5,-6.5);scene.add(pillow);
    }
    /* 카운터 */
    var counter=new THREE.Mesh(new THREE.BoxGeometry(6,.8,1.5),new THREE.MeshLambertMaterial({color:0x6a4a2a}));counter.position.set(0,baseY+.4,3);scene.add(counter);
    /* 의자 */
    for(var ci=0;ci<3;ci++){
      var chair=new THREE.Mesh(new THREE.BoxGeometry(.6,.6,.6),bedM);chair.position.set(-2+ci*2,baseY+.3,1.5);scene.add(chair);
    }
  }else if(name==='무기 상점'){
    /* 무기 진열대 */
    var rackM=new THREE.MeshLambertMaterial({color:0x5a3a1a});
    var rack=new THREE.Mesh(new THREE.BoxGeometry(1,.1,10),rackM);rack.position.set(-6,baseY+2,0);scene.add(rack);
    /* 검 여러개 */
    var swordM=new THREE.MeshLambertMaterial({color:0xaaaaaa});
    for(var si=0;si<5;si++){
      var sw=new THREE.Mesh(new THREE.BoxGeometry(.1,1.8,.15),swordM);sw.position.set(-6,baseY+2.8,-4+si*2);scene.add(sw);
      var hilt=new THREE.Mesh(new THREE.BoxGeometry(.3,.3,.15),new THREE.MeshLambertMaterial({color:0x8a6a3a}));hilt.position.set(-6,baseY+1.9,-4+si*2);scene.add(hilt);
    }
    /* 카운터 */
    var wc=new THREE.Mesh(new THREE.BoxGeometry(4,.8,1.5),rackM);wc.position.set(2,baseY+.4,0);scene.add(wc);
  }else if(name==='도서관'){
    /* 책장 */
    var shelfM=new THREE.MeshLambertMaterial({color:0x5a4a2a});
    for(var shi=0;shi<3;shi++){
      var shelf=new THREE.Mesh(new THREE.BoxGeometry(4,4,.8),shelfM);shelf.position.set(-5+shi*5,baseY+2,-7);scene.add(shelf);
      /* 책들 */
      var bookColors=[0xcc2222,0x2244cc,0x22aa44,0xccaa22,0x8822aa];
      for(var bk=0;bk<5;bk++){
        var book=new THREE.Mesh(new THREE.BoxGeometry(.3,1,.6),new THREE.MeshLambertMaterial({color:bookColors[bk%5]}));
        book.position.set(-6+shi*5+bk*.5,baseY+1+Math.floor(bk/3)*1.5,-7);scene.add(book);
      }
    }
    /* 테이블 */
    var table=new THREE.Mesh(new THREE.BoxGeometry(5,.1,3),shelfM);table.position.set(0,baseY+1.2,2);scene.add(table);
    var tleg=new THREE.MeshLambertMaterial({color:0x4a3a1a});
    [[-2,1],[-2,3],[2,1],[2,3]].forEach(function(lp){
      var leg=new THREE.Mesh(new THREE.BoxGeometry(.2,1.2,.2),tleg);leg.position.set(lp[0],baseY+.6,lp[1]);scene.add(leg);
    });
  }else if(name==='모험가 길드'){
    /* 게시판 */
    var boardM=new THREE.MeshLambertMaterial({color:0x6a5a3a});
    var board=new THREE.Mesh(new THREE.BoxGeometry(6,4,.3),boardM);board.position.set(0,baseY+3,-7);scene.add(board);
    /* 퀘스트 종이들 */
    var paperM=new THREE.MeshLambertMaterial({color:0xeeddbb});
    for(var pi=0;pi<8;pi++){
      var paper=new THREE.Mesh(new THREE.PlaneGeometry(.8,1),paperM);
      paper.position.set(-2+Math.random()*4,baseY+2+Math.random()*2,-6.8);scene.add(paper);
    }
    /* 긴 테이블 */
    var gtable=new THREE.Mesh(new THREE.BoxGeometry(10,.1,2),boardM);gtable.position.set(0,baseY+1,3);scene.add(gtable);
    /* 벤치 */
    var benchM=new THREE.MeshLambertMaterial({color:0x5a4a2a});
    var bench1=new THREE.Mesh(new THREE.BoxGeometry(8,.4,.6),benchM);bench1.position.set(0,baseY+.5,1.5);scene.add(bench1);
    var bench2=new THREE.Mesh(new THREE.BoxGeometry(8,.4,.6),benchM);bench2.position.set(0,baseY+.5,4.5);scene.add(bench2);
  }else{
    /* 기본 내부: 테이블 + 의자 */
    var defTable=new THREE.Mesh(new THREE.BoxGeometry(3,.1,2),new THREE.MeshLambertMaterial({color:0x6a5a3a}));defTable.position.set(0,baseY+1,0);scene.add(defTable);
  }
}

/* ── 심플 노이즈 (버텍스 변위용) ── */
function simpleNoise(x,z){
  var v=Math.sin(x*0.03)*Math.cos(z*0.04)*3 + Math.sin(x*0.08+z*0.06)*1.5 + Math.cos(z*0.02)*2;
  return Math.max(0,v+3.5)*0.7;/* 항상 0 이상, 최대 약 7 */
}

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
/* simpleNoise 기반 — 버텍스 변위와 동일한 함수 사용 */
function getTerrainY(x,z){
  /* 마을 구역 (중심 -350,-350, 반경 240) 은 평탄하게 유지 — 마을 3-4배 확장 */
  var vdx=x-(-350),vdz=z-(-350);
  var vdist=Math.sqrt(vdx*vdx+vdz*vdz);
  if(vdist<240)return 0;
  /* 마을 외곽 블렌딩 (240~290) */
  if(vdist<290){
    var blend=(vdist-240)/50;
    return simpleNoise(x,z)*blend;
  }
  return simpleNoise(x,z);
}
/* TERRAIN_HILLS 호환성용 빈 배열 (더 이상 사용 안 함) */
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

/* 공유 나무 머티리얼 — 함수 호출마다 생성 방지 */
var _treeTrunkMat=null,_treeLeafMat1=null,_treeLeafMat2=null;
function _getTreeMats(){
  if(!_treeTrunkMat){
    _treeTrunkMat=new THREE.MeshLambertMaterial({color:0x5a3a1a});
    _treeLeafMat1=new THREE.MeshLambertMaterial({color:0x3a7a2a});
    _treeLeafMat2=new THREE.MeshLambertMaterial({color:0x4a8a3a});
  }
}
function mkTree(x,z,s,parent){
  s=s||1;var g=new THREE.Group();
  var p=parent||scene;
  _getTreeMats();
  var tm=_treeTrunkMat,lm1=_treeLeafMat1,lm2=_treeLeafMat2;
  var trunk=new THREE.Mesh(new THREE.CylinderGeometry(.18,.28,2*s,7),tm);
  trunk.position.set(0,s,0);trunk.castShadow=true;trunk.receiveShadow=true;g.add(trunk);
  var l1=new THREE.Mesh(new THREE.ConeGeometry(1.5*s,2.5*s,8),lm1);
  l1.position.set(0,2.6*s,0);l1.castShadow=true;l1.receiveShadow=true;g.add(l1);
  var l2=new THREE.Mesh(new THREE.ConeGeometry(1.0*s,2.0*s,8),lm2);
  l2.position.set(0,3.9*s,0);l2.castShadow=true;l2.receiveShadow=true;g.add(l2);
  var ty=getTerrainY(x,z);
  g.position.set(x,ty,z);p.add(g);
}

/* mkBldg 공유 재질 */
var _bldgStoneMat=null,_bldgDoorMat=null,_bldgWindowMat=null;
function _initBldgMats(){
  if(_bldgStoneMat)return;
  _bldgStoneMat=new THREE.MeshLambertMaterial({color:0x3a3a3a});
  _bldgDoorMat=new THREE.MeshLambertMaterial({color:0x1a0a00});
  _bldgWindowMat=new THREE.MeshLambertMaterial({color:0xffeeaa,emissive:new THREE.Color(0xffaa00),emissiveIntensity:.22});
}
function mkBldg(x,z,w,h,d,bc,rc,parent){
  var g=new THREE.Group();
  var p=parent||scene;
  _initBldgMats();
  var bm=new THREE.MeshLambertMaterial({color:bc});
  var rm=new THREE.MeshLambertMaterial({color:rc});
  var stm=_bldgStoneMat,dm=_bldgDoorMat,wm=_bldgWindowMat;
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
  var postM=new THREE.MeshLambertMaterial({color:0x6a4a2a});
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
  var wallM=new THREE.MeshLambertMaterial({color:0x8a8878});
  var roofM=new THREE.MeshLambertMaterial({color:0x3a6aaa});
  var gateM=new THREE.MeshLambertMaterial({color:0x2a1800});

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
  var ctr=new THREE.Mesh(new THREE.ConeGeometry(1.4,3,8),new THREE.MeshLambertMaterial({color:0x3a6aaa}));ctr.position.set(0,13.5,0);ctr.castShadow=true;g.add(ctr);
  var gate=new THREE.Mesh(new THREE.BoxGeometry(3,4,.3),gateM);gate.position.set(0,2,5.15);g.add(gate);
  var archM=new THREE.MeshLambertMaterial({color:0x6a6858});
  var arch=new THREE.Mesh(new THREE.TorusGeometry(1.5,.3,8,12,.5*Math.PI),archM);
  arch.position.set(0,4,5.15);arch.rotation.z=Math.PI;g.add(arch);
  var merlonM=new THREE.MeshLambertMaterial({color:0x7a7868});
  for(var mx=-5;mx<=5;mx+=2){
    var ml=new THREE.Mesh(new THREE.BoxGeometry(.8,.8,.8),merlonM);ml.position.set(mx,8.4,5);ml.castShadow=true;g.add(ml);
  }
  var stepM=new THREE.MeshLambertMaterial({color:0x706050});
  [0,1,2].forEach(function(i){
    var st=new THREE.Mesh(new THREE.BoxGeometry(4-i*.3,.3,1.2),stepM);st.position.set(0,.15+i*.3,5.8+i*1.0);st.castShadow=true;st.receiveShadow=true;g.add(st);
  });
  var castleLight=new THREE.PointLight(0xff8800,.3,12);castleLight.position.set(0,3,3);g.add(castleLight);
  g.position.set(-350,0,-380);p.add(g);
}

function mkFountain(parent){
  var g=new THREE.Group();
  var p=parent||scene;
  var stoneM=new THREE.MeshLambertMaterial({color:0x888070});
  var waterM=new THREE.MeshLambertMaterial({color:0x3399cc,transparent:true,opacity:0.65});
  var outer=new THREE.Mesh(new THREE.CylinderGeometry(6,6.3,.7,16),stoneM);outer.position.set(0,.35,0);outer.castShadow=true;outer.receiveShadow=true;g.add(outer);
  var water=new THREE.Mesh(new THREE.CylinderGeometry(5.5,5.5,.35,16),waterM);water.position.set(0,.52,0);g.add(water);
  var pillar=new THREE.Mesh(new THREE.CylinderGeometry(.4,.55,3.2,8),stoneM);pillar.position.set(0,1.6,0);pillar.castShadow=true;g.add(pillar);
  var topM=new THREE.MeshLambertMaterial({color:0xccaa44});
  var top=new THREE.Mesh(new THREE.ConeGeometry(1.1,2.0,6),topM);top.position.set(0,3.8,0);top.castShadow=true;g.add(top);
  var jetM=new THREE.MeshLambertMaterial({color:0x88ddff,transparent:true,opacity:.5});
  [0,1,2,3,4,5,6,7].forEach(function(i){
    var a=i*Math.PI/4;
    var jet=new THREE.Mesh(new THREE.CylinderGeometry(.08,.13,2.2,6),jetM);
    jet.position.set(Math.cos(a)*.7,3.2+Math.sin(a)*.3,Math.sin(a)*.7);
    jet.rotation.z=Math.cos(a)*.45;jet.rotation.x=-Math.sin(a)*.45;
    g.add(jet);
  });
  /* 아침에는 분수 라이트 불필요 */
  g.position.set(-350,0,-358);p.add(g);
}

function mkStonePath(parent){
  var p=parent||scene;
  /* 광장 (마을 중심) — 확장 */
  var pathM=new THREE.MeshLambertMaterial({color:0xc4a872});
  var plaza=new THREE.Mesh(new THREE.CylinderGeometry(14,14,.05,32),pathM);
  plaza.position.set(-350,.02,-358);plaza.receiveShadow=true;p.add(plaza);

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
  function drawPath(pts,steps,radius){
    var sm=lerpPath(pts,steps);
    for(var i=0;i<sm.length;i++){
      var _px=sm[i][0],_pz=sm[i][1];
      var _py=getTerrainY(_px,_pz)+.08;
      var disc=new THREE.Mesh(new THREE.CircleGeometry(radius||4,16),pathM);
      disc.rotation.x=-Math.PI/2;disc.position.set(_px,_py,_pz);
      p.add(disc);
    }
  }
  /* ── 마을 내부 도로망 (확장 구역) ── */
  /* 광장 ↔ 여관 (서쪽) */
  drawPath([[-350,-358],[-362,-358],[-375,-360],[-388,-360]],8,3);
  /* 광장 ↔ 무기/방어구 상점 (동쪽) */
  drawPath([[-350,-358],[-338,-358],[-325,-360],[-312,-360]],8,3);
  /* 광장 남북 메인도로 → 게이트 */
  drawPath([[-350,-370],[-350,-390],[-350,-410],[-350,-430],[-350,-450]],12,4);
  /* 광장 ↔ 모험가 길드 */
  drawPath([[-350,-370],[-352,-385],[-354,-400],[-354,-418],[-352,-430]],10,3);
  /* 시장 구역 (서쪽 상인 구역 내부) */
  drawPath([[-350,-358],[-362,-362],[-375,-365],[-390,-368],[-402,-370]],8,3);
  /* 도서관 ↔ 광장 (동쪽 외곽 루프) */
  drawPath([[-350,-358],[-335,-358],[-322,-355],[-310,-350],[-300,-342]],8,3);
  /* 주거 구역 도로 (북쪽) */
  drawPath([[-350,-358],[-350,-345],[-350,-330],[-350,-315],[-350,-302]],8,3);
  drawPath([[-350,-315],[-365,-312],[-380,-310],[-395,-312]],7,3);
  drawPath([[-350,-315],[-335,-312],[-320,-310],[-305,-312]],7,3);
  /* 우물 ↔ 주거구역 */
  drawPath([[-350,-315],[-360,-312],[-370,-312],[-372,-310]],5,3);

  /* 마을 → 중앙 교차로 (0,0 부근) */
  drawPath([[-350,-450],[-350,-470],[-320,-430],[-270,-380],[-220,-320],[-160,-240],[-100,-160],[-40,-80],[0,0]],15,5);
  /* 중앙 → 초원 (NE) */
  drawPath([[0,0],[60,-40],[120,-100],[180,-160],[240,-220],[300,-300]],12,4);
  /* 중앙 → 늪 (W) */
  drawPath([[0,0],[-60,20],[-120,40],[-200,60],[-300,80],[-400,100]],12,4);
  /* 중앙 → 정글 (E) */
  drawPath([[0,0],[60,20],[120,40],[200,60],[300,80],[400,100]],12,4);
  /* 중앙 → 어두운 숲 (SW) */
  drawPath([[0,0],[-40,40],[-100,120],[-180,220],[-260,300],[-300,350]],12,4);
  /* 중앙 → 화산 (SE) */
  drawPath([[0,0],[40,40],[100,120],[180,220],[260,300],[350,400]],12,4);
  /* 중앙 → 보스 (S center) */
  drawPath([[0,0],[0,60],[0,140],[0,240],[0,360],[0,480],[0,550]],10,4);
}

function mkWaterRiver(parent){
  var p=parent||scene;
  var riverM=new THREE.MeshLambertMaterial({color:0x3399cc,transparent:true,opacity:0.65});
  var depthM=new THREE.MeshLambertMaterial({color:0x114466,transparent:true,opacity:.45});
  var bankM=new THREE.MeshLambertMaterial({color:0x3a2808});
  /* 남북 중앙 강: x=0, z:-400~500 */
  var nsLen=900;
  var ns=new THREE.Mesh(new THREE.PlaneGeometry(16,nsLen),riverM);ns.rotation.x=-Math.PI/2;ns.position.set(0,.08,50);p.add(ns);
  waterMeshes.push(ns);
  var nsd=new THREE.Mesh(new THREE.PlaneGeometry(16,nsLen),depthM);nsd.rotation.x=-Math.PI/2;nsd.position.set(0,-.06,50);p.add(nsd);
  /* 강변 */
  [-12,12].forEach(function(bx){
    var bank=new THREE.Mesh(new THREE.PlaneGeometry(6,nsLen),bankM);bank.rotation.x=-Math.PI/2;bank.position.set(bx,.005,50);p.add(bank);
  });
  /* 동서 강 분기: z=0, x:-400~-10 및 x:10~400 */
  var ewLen=390;
  var ew1=new THREE.Mesh(new THREE.PlaneGeometry(ewLen,16),riverM.clone());ew1.rotation.x=-Math.PI/2;ew1.position.set(-205,.08,0);p.add(ew1);
  waterMeshes.push(ew1);
  var ew2=new THREE.Mesh(new THREE.PlaneGeometry(ewLen,16),riverM.clone());ew2.rotation.x=-Math.PI/2;ew2.position.set(205,.08,0);p.add(ew2);
  waterMeshes.push(ew2);
  var ewd1=new THREE.Mesh(new THREE.PlaneGeometry(ewLen,16),depthM);ewd1.rotation.x=-Math.PI/2;ewd1.position.set(-205,-.06,0);p.add(ewd1);
  var ewd2=new THREE.Mesh(new THREE.PlaneGeometry(ewLen,16),depthM);ewd2.rotation.x=-Math.PI/2;ewd2.position.set(205,-.06,0);p.add(ewd2);
  /* 물 조명 */
  [[0,1,-200],[0,1,200],[-200,1,0],[200,1,0]].forEach(function(wl){
    var light=new THREE.PointLight(0x2288ff,.3,60);light.position.set(wl[0],wl[1],wl[2]);p.add(light);
  });
  /* 다리 3개 */
  var bridgePlanksM=new THREE.MeshLambertMaterial({color:0x7a5030});
  var bridgeRailM=new THREE.MeshLambertMaterial({color:0x5a3820});
  var bridgePostM=new THREE.MeshLambertMaterial({color:0x4a2e10});
  function woodBridge(cx,cz,rotY){
    var g=new THREE.Group();
    [-0.65,0.65].forEach(function(bx){
      var mainBeam=new THREE.Mesh(new THREE.BoxGeometry(.22,.25,7),bridgeRailM);
      mainBeam.position.set(bx,.12,0);mainBeam.castShadow=true;mainBeam.receiveShadow=true;g.add(mainBeam);
    });
    for(var pi2=-3;pi2<=3;pi2++){
      var plank=new THREE.Mesh(new THREE.BoxGeometry(1.5,.12,.7),bridgePlanksM);
      plank.position.set(0,.25,pi2*.95);plank.castShadow=true;plank.receiveShadow=true;g.add(plank);
    }
    [-3,3].forEach(function(pz2){
      [-0.65,0.65].forEach(function(px2){
        var post=new THREE.Mesh(new THREE.BoxGeometry(.15,.9,.15),bridgePostM);
        post.position.set(px2,.7,pz2*.95);post.castShadow=true;g.add(post);
      });
    });
    [-0.65,0.65].forEach(function(rx){
      var rail=new THREE.Mesh(new THREE.BoxGeometry(.08,.08,5.8),bridgeRailM);
      rail.position.set(rx,1.15,0);g.add(rail);
    });
    g.position.set(cx,.08,cz);g.rotation.y=rotY||0;p.add(g);
  }
  /* 남북 강 위 다리 (동서 교차) */
  woodBridge(0,-200,Math.PI/2);
  woodBridge(0,200,Math.PI/2);
  /* 동서 강 위 다리 (남북 교차) */
  woodBridge(-150,0,0);
  woodBridge(150,0,0);
}

/* ════════════ 지면 디테일 유틸 ════════════ */
/* 공유 재질 (최초 1회 생성) */
var _grassMat1=null,_grassMat2=null,_stoneMat1=null,_stoneMat2=null;
var _flowerMats=null;
function _initDetailMats(){
  if(_grassMat1)return;
  _grassMat1=new THREE.MeshLambertMaterial({color:0x2a5a18});
  _grassMat2=new THREE.MeshLambertMaterial({color:0x3a6a28});
  _stoneMat1=new THREE.MeshLambertMaterial({color:0x666055});
  _stoneMat2=new THREE.MeshLambertMaterial({color:0x555045});
  _flowerMats=[
    new THREE.MeshLambertMaterial({color:0xffee44,emissive:new THREE.Color(0xffee44),emissiveIntensity:.15}),
    new THREE.MeshLambertMaterial({color:0xffffff,emissive:new THREE.Color(0xffffff),emissiveIntensity:.1}),
    new THREE.MeshLambertMaterial({color:0xcc88ff,emissive:new THREE.Color(0xcc88ff),emissiveIntensity:.15}),
    new THREE.MeshLambertMaterial({color:0xff88aa,emissive:new THREE.Color(0xff88aa),emissiveIntensity:.15}),
    new THREE.MeshLambertMaterial({color:0x88ccff,emissive:new THREE.Color(0x88ccff),emissiveIntensity:.12})
  ];
}
function scatterGroundDetail(group,count,xRange,zRange,type,offX,offZ){
  offX=offX||0;offZ=offZ||0;
  _initDetailMats();
  for(var i=0;i<count;i++){
    var x=offX+(Math.random()-.5)*xRange*2;
    var z=offZ+(Math.random()-.5)*zRange*2;
    var m;
    if(type==='grass'){
      var gm=Math.random()>.5?_grassMat1:_grassMat2;
      m=new THREE.Mesh(new THREE.ConeGeometry(.08+Math.random()*.06,.3+Math.random()*.2,4),gm);
      m.position.set(x,.15,z);
      m.rotation.y=Math.random()*Math.PI;m.rotation.z=(Math.random()-.5)*.3;
      m.castShadow=true;
    } else if(type==='stone'){
      var sm=Math.random()>.5?_stoneMat1:_stoneMat2;
      var ss=.08+Math.random()*.12;
      m=new THREE.Mesh(new THREE.DodecahedronGeometry(ss,0),sm);
      m.position.set(x,ss*.3,z);
      m.rotation.set(Math.random(),Math.random(),Math.random());
      m.castShadow=true;m.receiveShadow=true;
    } else if(type==='flower'){
      var fm=_flowerMats[Math.floor(Math.random()*5)];
      m=new THREE.Mesh(new THREE.SphereGeometry(.06+Math.random()*.04,5,5),fm);
      m.position.set(x,.08,z);
    }
    if(m)group.add(m);
  }
}

/* ════════════ 바다/해양 경계 빌드 ════════════ */
function buildOcean(){
  /* 섬 주변 바다 — 지면보다 낮은 큰 평면 */
  var oceanM=new THREE.MeshLambertMaterial({color:0x0a2a4a,emissive:new THREE.Color(0x051520),emissiveIntensity:.2,transparent:true,opacity:.88});
  var ocean=new THREE.Mesh(new THREE.PlaneGeometry(4000,4000),oceanM);
  ocean.rotation.x=-Math.PI/2;ocean.position.set(0,-1.5,50);scene.add(ocean);

  var shallowM=new THREE.MeshLambertMaterial({color:0x1a5080,emissive:new THREE.Color(0x0a2840),emissiveIntensity:.15,transparent:true,opacity:.72});
  var shallow=new THREE.Mesh(new THREE.PlaneGeometry(2200,2200),shallowM);
  shallow.rotation.x=-Math.PI/2;shallow.position.set(0,-.6,50);scene.add(shallow);

  /* 바다 조명 */
  var seaLight1=new THREE.PointLight(0x1a88cc,.25,400);seaLight1.position.set(-700,2,0);scene.add(seaLight1);
  var seaLight2=new THREE.PointLight(0x1a88cc,.25,400);seaLight2.position.set(700,2,0);scene.add(seaLight2);
  var seaLight3=new THREE.PointLight(0x1a88cc,.2,400);seaLight3.position.set(0,2,700);scene.add(seaLight3);

  /* 해안선 모래사장 — 원형 둘레 */
  var sandM=new THREE.MeshLambertMaterial({color:0xd4b87a});
  for(var si=0;si<12;si++){
    var sa=si/12*Math.PI*2;
    var sx2=Math.cos(sa)*640,sz2=50+Math.sin(sa)*640;
    var sw=160,sh=50;
    var sand=new THREE.Mesh(new THREE.PlaneGeometry(sw,sh),sandM);
    sand.rotation.x=-Math.PI/2;sand.rotation.z=sa;
    sand.position.set(sx2,-.1,sz2);scene.add(sand);
  }
}

/* ════════════ 버텍스 변위 지면 헬퍼 ════════════ */
/* PlaneGeometry(w,h,segW,segH) — rotation.x=-PI/2 후 버텍스 Y 변위 적용 */
/* PlaneGeometry 버텍스: 로컬 x→월드 x, 로컬 y→월드 -z (회전 전) */
/* offX, offZ: 이 플레인의 월드 중심 좌표 */
function makeDisplacedGround(w,h,segW,segH,color,worldCX,worldCY,worldCZ){
  var geo=new THREE.PlaneGeometry(w,h,segW,segH);
  var pos=geo.attributes.position;
  for(var vi=0;vi<pos.count;vi++){
    var lx=pos.getX(vi);  /* 로컬 x → 월드 x (평면 회전 후) */
    var ly=pos.getY(vi);  /* 로컬 y → 월드 -z (rotation.x=-PI/2 이후) */
    var wx=lx+worldCX;
    var wz=-ly+worldCZ;   /* 부호 반전: PlaneGeometry Y축이 Z축으로 매핑 */
    var dy=0;
    /* 마을 구역 (중심 -350,-350, 반경 240) 평탄 유지 — 마을 확장 */
    var _vdx2=wx-(-350),_vdz2=wz-(-350);
    var _vd2=Math.sqrt(_vdx2*_vdx2+_vdz2*_vdz2);
    if(_vd2>=290)dy=simpleNoise(wx,wz);
    else if(_vd2>=240)dy=simpleNoise(wx,wz)*((_vd2-240)/50);
    pos.setZ(vi,dy);      /* 로컬 z → 회전 후 월드 y (높이) */
  }
  geo.computeVertexNormals();
  var mat=new THREE.MeshLambertMaterial({color:color});
  var mesh=new THREE.Mesh(geo,mat);
  mesh.rotation.x=-Math.PI/2;
  mesh.position.set(worldCX,worldCY,worldCZ);
  mesh.receiveShadow=true;
  scene.add(mesh);
  return mesh;
}

/* ════════════ 바이옴 지면 빌드 (섬형 맵) ════════════ */
function buildGroundPlanes(){
  /* 기본 바닥 — 전체 월드 커버 */
  var baseMat=new THREE.MeshLambertMaterial({color:0x2a5a1a});
  var baseGeo=new THREE.PlaneGeometry(1400,1400);
  var baseMesh=new THREE.Mesh(baseGeo,baseMat);
  baseMesh.rotation.x=-Math.PI/2;baseMesh.position.set(0,-0.02,50);baseMesh.receiveShadow=true;scene.add(baseMesh);

  /* 마을 (NW): 평탄 (-350,-350 중심) — 3-4배 확장 */
  var villGnd=new THREE.Mesh(new THREE.PlaneGeometry(500,500),new THREE.MeshLambertMaterial({color:0x4a8a3a}));
  villGnd.rotation.x=-Math.PI/2;villGnd.position.set(-350,.03,-350);villGnd.receiveShadow=true;scene.add(villGnd);

  /* 초원 (NE): x:100~500, z:-500~-100 */
  makeDisplacedGround(440,440,24,24,0x5a9a3a, 300,0.01,-300);

  /* 늪 (W): x:-600~-200, z:-100~300 */
  makeDisplacedGround(440,440,24,24,0x3a5a2a, -400,0.01,100);

  /* 정글 (E): x:200~600, z:-100~300 */
  makeDisplacedGround(440,440,24,24,0x2a6a1a, 400,0.01,100);

  /* 어두운 숲 (SW): x:-500~-100, z:200~500 */
  makeDisplacedGround(440,340,24,20,0x1a3a12, -300,0.01,350);

  /* 화산 (SE): x:150~550, z:250~550 */
  makeDisplacedGround(440,340,24,20,0x2a1208, 350,0.01,400);

  /* 보스 (S center): x:-80~80, z:500~600 */
  makeDisplacedGround(180,120,12,8,0x1a0808, 0,0.01,550);
}

/* ════════════ 경계 산맥 빌드 (시각적 장벽) ════════════ */
/* 구체 언덕 제거 — 버텍스 변위 지면으로 대체됨 */
/* 산맥 원뿔(ConeGeometry)은 유지 — 경계 역할 */
function buildBorderMountains(){
  var mountainM=new THREE.MeshLambertMaterial({color:0x556044});
  var mountainPeakM=new THREE.MeshLambertMaterial({color:0x8a9080});
  var snowM=new THREE.MeshLambertMaterial({color:0xeeeeff});

  /* 섬 가장자리 산맥 — 원형으로 배치 (마을 근처 제외) */
  for(var mi=0;mi<16;mi++){
    var ma=mi/16*Math.PI*2;
    var mx=Math.cos(ma)*580,mz=50+Math.sin(ma)*580;
    /* 마을(-350,-350) 반경 300 이내면 건너뛰기 */
    var vdx=mx-(-350),vdz=mz-(-350);
    if(Math.sqrt(vdx*vdx+vdz*vdz)<300)continue;
    var mh=30+Math.random()*25;
    var mr=25+Math.random()*18;
    var mtBase=new THREE.Mesh(new THREE.ConeGeometry(mr,mh,8),mountainM);
    mtBase.position.set(mx,mh/2,mz);mtBase.castShadow=true;mtBase.receiveShadow=true;scene.add(mtBase);
    var mtPeak=new THREE.Mesh(new THREE.ConeGeometry(mr*.35,mh*.4,6),mountainPeakM);
    mtPeak.position.set(mx,mh*.85,mz);mtPeak.castShadow=true;scene.add(mtPeak);
    if(mh>28){
      var snow=new THREE.Mesh(new THREE.ConeGeometry(mr*.2,mh*.22,5),snowM);
      snow.position.set(mx,mh*1.02,mz);snow.castShadow=true;scene.add(snow);
    }
  }

  /* 화산 지대 내 화산 원뿔 */
  var volcanoMountainM=new THREE.MeshLambertMaterial({color:0x1a0a04});
  [
    [300,350,40,30],[400,450,48,38],[450,300,36,28],
    [280,500,44,34],[500,380,38,30],[380,320,30,22]
  ].forEach(function(vp){
    var vc=new THREE.Mesh(new THREE.ConeGeometry(vp[2],vp[3],8),volcanoMountainM);
    vc.position.set(vp[0],vp[3]/2,vp[1]);vc.castShadow=true;vc.receiveShadow=true;scene.add(vc);
    var craterM=new THREE.MeshLambertMaterial({color:0x0a0404});
    var crater=new THREE.Mesh(new THREE.CylinderGeometry(vp[2]*.25,vp[2]*.3,vp[3]*.08,8),craterM);
    crater.position.set(vp[0],vp[3]*.95,vp[1]);scene.add(crater);
    if(Math.random()<.5){
      var lavaGlow=new THREE.PointLight(0xff3300,.8,vp[2]*1.5);
      lavaGlow.position.set(vp[0],vp[3]*.9,vp[1]);scene.add(lavaGlow);
    }
  });
}

/* ════════════ 마을 빌드 ════════════ */
function buildVillage(){
  var VX=-350,VZ=-350; /* 마을 중심 */

  /* ── 건물 문 등록 (건물 정면 바깥 좌표) ── */
  registerDoor(VX-38, VZ-8,  '여관');       /* 여관 남쪽 앞 */
  registerDoor(VX+38, VZ-8,  '무기 상점');  /* 무기상점 남쪽 앞 */
  registerDoor(VX+38, VZ-30, '방어구 상점');/* 방어구 남쪽 앞 */
  registerDoor(VX+50, VZ+20, '도서관');     /* 도서관 남쪽 앞 */
  registerDoor(VX-8,  VZ-64, '모험가 길드');/* 길드 북쪽 앞 */

  /* 지면 디테일 — 확장된 영역에 더 많이 */
  scatterGroundDetail(scene,60,100,100,'grass',VX,VZ);
  scatterGroundDetail(scene,30,90,90,'stone',VX,VZ);
  scatterGroundDetail(scene,40,80,80,'flower',VX,VZ);

  /* 건물 주변 포인트 라이트 */
  var shopLight1=new THREE.PointLight(0xff9944,.2,22);shopLight1.position.set(VX,3,VZ-8);scene.add(shopLight1);
  var shopLight2=new THREE.PointLight(0xff9944,.18,20);shopLight2.position.set(VX-45,3,VZ-20);scene.add(shopLight2);
  var shopLight3=new THREE.PointLight(0xff9944,.18,20);shopLight3.position.set(VX+45,3,VZ-20);scene.add(shopLight3);

  /* 반투명 안개 평면 — 더 넓게 */
  var fogPlaneM=new THREE.MeshLambertMaterial({color:0xaabb88,transparent:true,opacity:.06});
  [[VX-30,0,VZ+20],[VX+30,0,VZ-40],[VX-50,0,VZ-30],[VX+50,0,VZ+10],[VX,0,VZ+30]].forEach(function(fp){
    var fogP=new THREE.Mesh(new THREE.PlaneGeometry(20+Math.random()*12,14+Math.random()*8),fogPlaneM);
    fogP.rotation.x=-Math.PI/2;fogP.position.set(fp[0],.15,fp[2]);scene.add(fogP);
  });

  /* 구조물 */
  mkStonePath(scene);
  mkWaterRiver(scene);
  mkFountain(scene);
  mkCastle(scene);

  /* ── 새 건물들 ── */
  /* 여관 (Inn) — 서쪽 */
  mkBldg(VX-38,VZ-14, 8,5,7, 0xd4b87a,0x8b3a2a,scene);
  /* 무기 상점 building — 동쪽 */
  mkBldg(VX+38,VZ-14, 7,4.5,6, 0x6a5a3a,0x4a2a0a,scene);
  /* 방어구 상점 — 동쪽 (무기 상점 남쪽) */
  mkBldg(VX+38,VZ-36, 7,4.5,6, 0x5a6a4a,0x334422,scene);
  /* 도서관 (Library) — 동쪽 외곽 */
  mkBldg(VX+50,VZ+12, 10,6,8, 0x8a8878,0x4a5a7a,scene);
  /* 모험가 길드 — 남쪽 큰 건물 */
  mkBldg(VX-8,VZ-72, 14,6,10, 0x7a5a30,0x5a3a12,scene);
  /* 포션 상점 스탠드 (기존 광장 쪽) */
  mkStall(VX-8,VZ-20,.15, 0x6a1a1a,0xaa3333,'포션',scene);
  mkStall(VX+8,VZ-20,-.15, 0x1a4a2a,0x336644,'방어구',scene);
  /* 시장 스탠드 (서쪽 상인 구역) */
  mkStall(VX-40,VZ-18, .3, 0x8a3a10,0xcc5522,'잡화',scene);
  mkStall(VX-40,VZ-28,.2, 0x1a4a8a,0x3366cc,'아이템',scene);
  mkStall(VX-52,VZ-18, .4, 0x3a6a10,0x558833,'식료품',scene);
  mkStall(VX-52,VZ-28,-.2, 0x8a4a1a,0xcc8833,'무기점',scene);

  /* ── 광장 확장 (더 큰 분수) ── */
  /* 광장 바닥 타일 추가 */
  var plazaM=new THREE.MeshLambertMaterial({color:0xc8b888});
  var plazaBig=new THREE.Mesh(new THREE.CylinderGeometry(16,16,.04,32),plazaM);
  plazaBig.position.set(VX,.01,VZ-8);plazaBig.receiveShadow=true;scene.add(plazaBig);

  /* ── 마을 입구 도로 포장 (게이트까지) ── */
  var pathM2=new THREE.MeshLambertMaterial({color:0xb8a060});
  for(var ri=0;ri<8;ri++){
    var ry=VZ-30-ri*12;
    var rd=new THREE.Mesh(new THREE.PlaneGeometry(10,.04),pathM2);
    rd.rotation.x=-Math.PI/2;rd.position.set(VX,.05,ry);
    rd.receiveShadow=true;scene.add(rd);
  }

  /* 횃불 — 더 많이, 더 넓게 — [x, z] 형식 */
  var torchPos=[
    [VX-10,VZ-2],[VX+10,VZ-2],
    [VX-10,VZ-18],[VX+10,VZ-18],
    [VX-2,VZ-26],[VX+2,VZ-26],
    [VX-38,VZ-8],[VX+38,VZ-8],
    [VX-44,VZ-22],[VX+44,VZ-22],
    [VX-8,VZ-66],[VX+8,VZ-66],
    [VX-8,VZ-80],[VX+8,VZ-80],
  ];
  var poleMat=new THREE.MeshLambertMaterial({color:0x5a3a1a});
  var fireMat=new THREE.MeshBasicMaterial({color:0xff8820});
  torchPos.forEach(function(tp){
    var tx=tp[0],tz=tp[1];
    var pl=new THREE.PointLight(0xff8830,1.8,16);pl.position.set(tx,2.2,tz);scene.add(pl);
    var pole=new THREE.Mesh(new THREE.CylinderGeometry(.06,.08,2,6),poleMat);pole.position.set(tx,1,tz);pole.castShadow=true;scene.add(pole);
    var fire=new THREE.Mesh(new THREE.SphereGeometry(.13,8,8),fireMat);fire.position.set(tx,2.2,tz);scene.add(fire);
  });

  /* ── 마을 나무 — 확장 구역에 더 많이 ── */
  var treeLayout=[
    /* 광장 주변 */
    [VX-22,VZ-2],[VX+22,VZ-2],[VX-22,VZ-20],[VX+22,VZ-20],
    /* 주거 구역 나무 */
    [VX-60,VZ+25],[VX-45,VZ+28],[VX-30,VZ+26],[VX-15,VZ+25],[VX+5,VZ+28],
    [VX-58,VZ+10],[VX+20,VZ+15],[VX+38,VZ+8],
    /* 여관 주변 */
    [VX-50,VZ-5],[VX-50,VZ-22],
    /* 도서관 주변 */
    [VX+58,VZ+5],[VX+60,VZ+22],
    /* 길드 주변 */
    [VX-25,VZ-80],[VX+10,VZ-82],[VX-22,VZ-55],[VX+18,VZ-58],
    /* 입구 양옆 나무 */
    [VX-22,VZ-40],[VX+22,VZ-40],[VX-22,VZ-56],[VX+22,VZ-56],
    /* 시장 구역 */
    [VX-62,VZ-10],[VX-62,VZ-32],
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
  [
    {x:VX,y:17,z:VZ-30,n:'성'},
    {x:VX-38,y:7,z:VZ-14,n:'여관'},
    {x:VX+38,y:7,z:VZ-14,n:'무기 상점'},
    {x:VX+38,y:7,z:VZ-36,n:'방어구 상점'},
    {x:VX+50,y:9,z:VZ+12,n:'도서관'},
    {x:VX-8,y:9,z:VZ-72,n:'모험가 길드'},
    {x:VX-40,y:5,z:VZ-18,n:'잡화'},
    {x:VX-52,y:5,z:VZ-28,n:'무기점'},
  ]
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

  var COUNT=20;
  var pos=new Float32Array(COUNT*3);
  fireflyBaseY=new Float32Array(COUNT);
  fireflyPhases=new Float32Array(COUNT);

  for(var i=0;i<COUNT;i++){
    /* scatter around expanded village and meadow mostly */
    var px=-350+(Math.random()-.5)*500;
    var py=0.5+Math.random()*3.5;
    var pz=-380+(Math.random()-.5)*500;
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
      topColor:{value:new THREE.Color(0x3a8fd8)},
      horizonColor:{value:new THREE.Color(0xa8d8ea)},
      offset:{value:0.25},
      exponent:{value:0.5}
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

  /* ── 톤매핑 제거 (성능 최적화) ── */
  /* renderer.toneMapping=THREE.ACESFilmicToneMapping; */
  /* renderer.toneMappingExposure=1.1; */

  /* scene 배경은 스카이돔이 대신하므로 투명하게 */
  scene=new THREE.Scene();
  scene.background=new THREE.Color(0x87CEEB);

  /* ── 대기 안개 — 부드러운 블루-화이트 안개로 깊이감 강화 ── */
  scene.fog=new THREE.FogExp2(0xa8d8ea,.0015);

  camera=new THREE.PerspectiveCamera(60,1,.1,1200);
  camera.position.set(-350,10,-332);

  /* ── 스카이돔 ── */
  buildSkydome();

  /* ── 전역 조명 개선 ── */
  /* 1) 쿨 앰비언트 (낮은 강도) */
  scene.add(new THREE.AmbientLight(0xffffff,.25));

  /* 2) 헤미스피어 라이트 — 하늘(하늘색)↔지면(녹색) 미묘한 앰비언트 필 */
  var hemi=new THREE.HemisphereLight(0x87ceeb,0x3a5a1a,.4);
  scene.add(hemi);

  /* 2b) 마을 따뜻한 앰비언트 포인트 라이트 — 확장 커버 */
  var villageAmbient=new THREE.PointLight(0xffcc88,.35,180);
  villageAmbient.position.set(-350,12,-380);
  scene.add(villageAmbient);
  var villageAmbient2=new THREE.PointLight(0xffcc88,.25,120);
  villageAmbient2.position.set(-350,10,-310);
  scene.add(villageAmbient2);

  /* 3) 태양(방향광) — 따뜻한 황금빛, 그림자 활성화 */
  var sun=new THREE.DirectionalLight(0xfff0d0,.9);
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

  /* 바다/해양 경계 (지면보다 먼저 렌더) */
  buildOcean();

  /* 바이옴 지면 (버텍스 변위 적용) */
  buildGroundPlanes();

  /* 경계 산맥 (원뿔 — 시각적 장벽) */
  buildBorderMountains();

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

  /* 게임 루프는 main.js의 loop()가 담당 — setAnimationLoop 중복 방지 */
  /* renderer.setAnimationLoop(loop); — main.js의 loop()가 직접 호출됨 */
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

/* ════════════ LOD (거리 기반 장식 표시/숨김) ════════════ */
var _lodObjects=[];/* [{mesh, cx, cz, dist}] — 등록된 LOD 오브젝트 */
var _lodFrame=0;
function registerLOD(mesh,cx,cz,dist){
  _lodObjects.push({mesh:mesh,cx:cx,cz:cz,dist:dist});
}
function updateLOD(){
  if(!PL.group)return;
  _lodFrame++;
  /* 6프레임마다 LOD 갱신 — 매 프레임 불필요 */
  if(_lodFrame%6!==0)return;
  var px=PL.group.position.x,pz=PL.group.position.z;
  for(var i=0;i<_lodObjects.length;i++){
    var o=_lodObjects[i];
    var dx=px-o.cx,dz=pz-o.cz;
    o.mesh.visible=(dx*dx+dz*dz)<o.dist*o.dist;
  }
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
  /* waterMeshes에 map이 없는 경우 skip */
  for(var wi=0;wi<waterMeshes.length;wi++){
    var wm=waterMeshes[wi];
    if(wm.material&&wm.material.map){
      wm.material.map.offset.y+=0.0015;
    }
  }

  /* LOD 업데이트 */
  updateLOD();
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

  g.position.set(-358,0,-345);p.add(g);
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

  /* ── 주거 구역 (북쪽) ── */
  /* 집 1: 서북쪽 크림색 집 */
  makeHouse(-382,-308, 4,3,3, plasterM,roofR, 0.1);
  /* 집 2: 서북쪽 연갈색 집 */
  makeHouse(-368,-305, 4.5,3.2,3.2, plaster2M,roofB, -0.05);
  /* 집 3: 중앙 초록빛 집 */
  makeHouse(-350,-302, 3.5,2.8,2.8, plaster3M,roofG, -0.12);
  /* 집 4: 동북쪽 작은 집 */
  makeHouse(-332,-305, 3.2,2.6,2.6, plasterM,roofR, 0.08);
  /* 집 5: 동북쪽 추가 집 */
  makeHouse(-316,-308, 4,3.0,3.0, plaster2M,roofG, 0.15);
  /* 집 6: 서쪽 외곽 큰 집 */
  makeHouse(-395,-315, 5,3.4,3.6, plasterM,roofB, -0.08);
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

  g.position.set(-372,0,-310);p.add(g);
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

  var VX=-350,VZ=-350;
  /* 주거 구역 울타리 (서북쪽) */
  fenceRow(VX-60,VZ+40,VX-60,VZ-20,10);
  fenceRow(VX-60,VZ+40,VX-30,VZ+40,5);
  /* 길드 구역 울타리 (동쪽) */
  fenceRow(VX+50,VZ-20,VX+80,VZ-20,5);
  fenceRow(VX+80,VZ-20,VX+80,VZ-60,7);
  /* 도서관 구역 울타리 */
  fenceRow(VX+20,VZ+40,VX+60,VZ+40,7);
  fenceRow(VX+60,VZ+10,VX+60,VZ+40,5);
  /* 마을 남쪽 입구 양옆 */
  fenceRow(VX-40,VZ-90,VX-14,VZ-90,5);
  fenceRow(VX+14,VZ-90,VX+40,VZ-90,5);
  /* 마을 서쪽 외곽 */
  fenceRow(VX-90,VZ+20,VX-90,VZ-80,18);
  /* 마을 동쪽 외곽 */
  fenceRow(VX+90,VZ+20,VX+90,VZ-80,18);
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

  g.position.set(-350,0,-448);p.add(g);
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

  /* 광장 주변 화단 */
  flowerBed(-358,-352, 5);
  flowerBed(-342,-352, 5);
  flowerBed(-358,-368, 4);
  flowerBed(-342,-368, 4);
  /* 여관 앞 */
  flowerBed(-388,-345, 5);
  flowerBed(-380,-345, 5);
  /* 도서관 앞 */
  flowerBed(-322,-345, 5);
  flowerBed(-314,-345, 5);
  /* 길드 길가 */
  flowerBed(-392,-385, 4);
  flowerBed(-380,-385, 4);
  /* 주거 구역 길가 */
  flowerBed(-368,-310, 4);
  flowerBed(-340,-310, 4);
  flowerBed(-310,-310, 4);
  /* 마을 입구 게이트 앞 */
  flowerBed(-360,-440, 5);
  flowerBed(-340,-440, 5);
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

  /* 시장 스탠드 근처 */
  barrel(-400,-362,0,0);barrel(-400,-374,0,0);barrel(-398,-370,0,0);
  crate(-402,-365,0);crate(-402,-372,0);
  /* 무기 상점 옆 */
  barrel(-305,-378,0,0);barrel(-310,-378,0,0);
  crate(-302,-380,0);
  /* 여관 앞 */
  barrel(-385,-352,0,0);crate(-388,-356,0);
  /* 길드 앞 */
  barrel(-320,-390,0,0);crate(-322,-394,0);
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

  /* 새 게이트 양옆 */
  banner(-356,-447, bannerColors[0]);
  banner(-344,-447,  bannerColors[1]);
  /* 광장 코너 4방향 */
  banner(-362,-348,    bannerColors[2]);
  banner(-338,-348,    bannerColors[3]);
  banner(-362,-368,    bannerColors[0]);
  banner(-338,-368,    bannerColors[1]);
  /* 길드 앞 */
  banner(-328,-382,  bannerColors[2]);
  banner(-316,-382,  bannerColors[3]);
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
  bench(-354,-354,  0);
  bench(-346,-354,   Math.PI);
  bench(-354,-362, 0);
  bench(-346,-362,  Math.PI);
  /* 여관 앞 길가 */
  bench(-388,-360, Math.PI/2);
  bench(-388,-370, Math.PI/2);
  /* 도서관 앞 길가 */
  bench(-316,-360, -Math.PI/2);
  bench(-316,-370, -Math.PI/2);
  /* 주거 구역 길가 */
  bench(-370,-320, 0);
  bench(-340,-320, Math.PI);
  bench(-310,-320, 0);
  /* 길드 앞 광장 */
  bench(-335,-395, 0);
  bench(-320,-395, Math.PI);
  /* 입구 길가 */
  bench(-360,-430, Math.PI/2);
  bench(-340,-430, -Math.PI/2);
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

  /* 광장 주변 */
  lampPost(-356,-352);  lampPost(-344,-352);
  lampPost(-356,-368); lampPost(-344,-368);
  /* 광장 → 여관 길 */
  lampPost(-368,-356); lampPost(-378,-360); lampPost(-388,-358);
  /* 광장 → 무기상점 길 */
  lampPost(-332,-356); lampPost(-322,-360); lampPost(-312,-358);
  /* 남북 메인 도로 (광장 → 게이트) */
  lampPost(-353,-378); lampPost(-347,-378);
  lampPost(-353,-398); lampPost(-347,-398);
  lampPost(-353,-418); lampPost(-347,-418);
  lampPost(-353,-438); lampPost(-347,-438);
  /* 주거 구역 도로 */
  lampPost(-368,-320); lampPost(-350,-318); lampPost(-310,-320);
  /* 길드 앞 */
  lampPost(-335,-386); lampPost(-322,-386);
}

/* ── 여관 내부 장식 (침대 창문으로 보이게) ── */
function mkInnDecor(parent){
  var p=parent||scene;
  var VX=-350,VZ=-350;
  var IX=VX-38,IZ=VZ-14;
  var bedM=new THREE.MeshLambertMaterial({color:0x8a2222});
  var pillowM=new THREE.MeshLambertMaterial({color:0xeeeecc});
  var frameM=new THREE.MeshLambertMaterial({color:0x5a3010});
  /* 침대 2개 (창 방향으로 배치) */
  function bed(bx,bz){
    var g=new THREE.Group();
    var frame=new THREE.Mesh(new THREE.BoxGeometry(1.5,.2,2.5),frameM);frame.position.set(0,.4,0);frame.castShadow=true;g.add(frame);
    var mat=new THREE.Mesh(new THREE.BoxGeometry(1.4,.2,2.3),bedM);mat.position.set(0,.52,0);g.add(mat);
    var pillow=new THREE.Mesh(new THREE.BoxGeometry(1.1,.18,.55),pillowM);pillow.position.set(0,.64,-0.85);g.add(pillow);
    /* 침대 다리 */
    [[-.6,.2,-.9],[.6,.2,-.9],[-.6,.2,.9],[.6,.2,.9]].forEach(function(lp){
      var leg=new THREE.Mesh(new THREE.BoxGeometry(.12,.45,.12),frameM);leg.position.set(lp[0],lp[1],lp[2]);g.add(leg);
    });
    g.position.set(bx,0,bz);p.add(g);
  }
  bed(IX-2.2,IZ+1.5);
  bed(IX+2.2,IZ+1.5);
  bed(IX-2.2,IZ-1.0);
  bed(IX+2.2,IZ-1.0);
  /* 여관 간판 */
  var signM=new THREE.MeshLambertMaterial({color:0x5a2a08});
  var sign=new THREE.Mesh(new THREE.BoxGeometry(3.5,.5,.15),signM);
  sign.position.set(IX,5.8,IZ+3.6);scene.add(sign);
  /* 포인트 라이트 여관 입구 */
  var innLight=new THREE.PointLight(0xffaa44,1.2,18);innLight.position.set(IX,3.5,IZ+3.7);p.add(innLight);
}

/* ── 도서관 장식 ── */
function mkLibraryDecor(parent){
  var p=parent||scene;
  var VX=-350,VZ=-350;
  var LX=VX+50,LZ=VZ+12;
  var stoneM2=new THREE.MeshLambertMaterial({color:0x7a7868});
  var bookM=new THREE.MeshLambertMaterial({color:0x6a3a88});
  var bookM2=new THREE.MeshLambertMaterial({color:0x883a3a});
  var bookM3=new THREE.MeshLambertMaterial({color:0x3a6a38});
  var shelfM=new THREE.MeshLambertMaterial({color:0x4a2e0a});
  /* 책장들 */
  function bookshelf(bx,bz){
    var g=new THREE.Group();
    var shelf=new THREE.Mesh(new THREE.BoxGeometry(2.5,2.8,.35),shelfM);shelf.position.set(0,1.4,0);shelf.castShadow=true;g.add(shelf);
    var bms=[bookM,bookM2,bookM3];
    for(var bi=0;bi<9;bi++){
      var bk=new THREE.Mesh(new THREE.BoxGeometry(.18,.5+Math.random()*.3,.25),bms[bi%3]);
      bk.position.set(-1.0+bi*.24,1.0+Math.floor(bi/6)*.9,0);g.add(bk);
    }
    g.position.set(bx,0,bz);p.add(g);
  }
  bookshelf(LX-3.5,LZ);
  bookshelf(LX+3.5,LZ);
  bookshelf(LX,LZ-2.5);
  /* 도서관 포인트 라이트 */
  var libLight=new THREE.PointLight(0xffeedd,1.0,16);libLight.position.set(LX,4,LZ+4.5);p.add(libLight);
  /* 석상/조각 */
  var statue=new THREE.Group();
  var statBase=new THREE.Mesh(new THREE.CylinderGeometry(.5,.6,.4,8),stoneM2);statBase.position.set(0,.2,0);statBase.castShadow=true;statue.add(statBase);
  var statBody=new THREE.Mesh(new THREE.CylinderGeometry(.25,.3,1.5,8),stoneM2);statBody.position.set(0,1.15,0);statBody.castShadow=true;statue.add(statBody);
  var statHead=new THREE.Mesh(new THREE.SphereGeometry(.28,8,8),stoneM2);statHead.position.set(0,2.15,0);statue.add(statHead);
  statue.position.set(LX,0,LZ+3.5);p.add(statue);
}

/* ── 모험가 길드 장식 ── */
function mkGuildDecor(parent){
  var p=parent||scene;
  var VX=-350,VZ=-350;
  var GX=VX-8,GZ=VZ-72;
  var woodM=new THREE.MeshLambertMaterial({color:0x6a4a1a});
  var boardM=new THREE.MeshLambertMaterial({color:0x5a3a10});
  var pinM=new THREE.MeshLambertMaterial({color:0xccaa44});
  /* 큰 간판 */
  var bigSign=new THREE.Mesh(new THREE.BoxGeometry(7,.9,.2),boardM);
  bigSign.position.set(GX,7.5,GZ+5.2);scene.add(bigSign);
  /* 게시판 (퀘스트 보드) */
  var board=new THREE.Group();
  var bFrame=new THREE.Mesh(new THREE.BoxGeometry(3.5,2.5,.12),boardM);bFrame.position.set(0,1.25,0);bFrame.castShadow=true;board.add(bFrame);
  /* 종이들 */
  [[-1,.8],[.5,1.5],[-.8,2.0],[.9,.5],[-0.2,1.0]].forEach(function(pp){
    var paper=new THREE.Mesh(new THREE.BoxGeometry(.7,.9,.05),
      new THREE.MeshLambertMaterial({color:0xeedd88}));
    paper.position.set(pp[0],pp[1],.1);board.add(paper);
    var pin=new THREE.Mesh(new THREE.SphereGeometry(.06,6,6),pinM);
    pin.position.set(pp[0],pp[1]+.35,.16);board.add(pin);
  });
  board.position.set(GX-5,0,GZ+3);p.add(board);
  /* 길드 포인트 라이트 */
  var guildLight=new THREE.PointLight(0xff8844,1.2,22);guildLight.position.set(GX,4,GZ+5.5);p.add(guildLight);
  /* 기둥 장식 */
  [[GX-7,GZ+5],[GX+7,GZ+5]].forEach(function(cp){
    var col=new THREE.Mesh(new THREE.CylinderGeometry(.3,.35,7.5,8),woodM);
    col.position.set(cp[0],3.75,cp[1]);col.castShadow=true;p.add(col);
    var cap=new THREE.Mesh(new THREE.BoxGeometry(.9,.4,.9),
      new THREE.MeshLambertMaterial({color:0x8a6030}));
    cap.position.set(cp[0],7.7,cp[1]);p.add(cap);
  });
}

/* ── 광장 중앙 장식 (동상) ── */
function mkPlazaStatue(parent){
  var p=parent||scene;
  var stoneM=new THREE.MeshLambertMaterial({color:0x9a9080});
  var goldM=new THREE.MeshLambertMaterial({color:0xccaa22,emissive:new THREE.Color(0x665500),emissiveIntensity:.2});
  var g=new THREE.Group();
  /* 받침대 */
  var base=new THREE.Mesh(new THREE.BoxGeometry(2.5,.6,2.5),stoneM);base.position.set(0,.3,0);base.castShadow=true;base.receiveShadow=true;g.add(base);
  var plinth=new THREE.Mesh(new THREE.BoxGeometry(2.0,2.5,2.0),stoneM);plinth.position.set(0,2.05,0);plinth.castShadow=true;g.add(plinth);
  /* 영웅 형상 (단순화) */
  var body=new THREE.Mesh(new THREE.BoxGeometry(.7,1.2,.4),goldM);body.position.set(0,4.0,0);body.castShadow=true;g.add(body);
  var head=new THREE.Mesh(new THREE.SphereGeometry(.28,8,8),goldM);head.position.set(0,4.9,0);g.add(head);
  /* 검 들고 있는 팔 */
  var arm=new THREE.Mesh(new THREE.BoxGeometry(.18,.9,.18),goldM);arm.position.set(.55,4.2,0);arm.rotation.z=-.4;arm.castShadow=true;g.add(arm);
  var sword=new THREE.Mesh(new THREE.BoxGeometry(.08,1.4,.08),
    new THREE.MeshLambertMaterial({color:0xcccccc,emissive:new THREE.Color(0x444444),emissiveIntensity:.3}));
  sword.position.set(.85,4.5,0);sword.rotation.z=-.5;g.add(sword);
  /* 황금빛 발광 */
  var glow=new THREE.PointLight(0xffcc44,.5,12);glow.position.set(0,4.5,0);g.add(glow);
  g.position.set(-350,0,-340);p.add(g);
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
  mkInnDecor(scene);
  mkLibraryDecor(scene);
  mkGuildDecor(scene);
  mkPlazaStatue(scene);
}

/* ════════════ 초원 장식 ════════════ */
/* 초원 (NE): x:100~500, z:-500~-100 — 중심 (300,-300) */
function buildMeadowDecor(){
  var MX=300,MZ=-300; /* 초원 중심 오프셋 */
  var stoneM=new THREE.MeshLambertMaterial({color:0x888070});
  var logM=new THREE.MeshLambertMaterial({color:0x4a2e0a});
  var signM=new THREE.MeshLambertMaterial({color:0x6e4010});
  var meadowFlowerColors=[0xffee44,0xff7733,0xcc44ff,0xffffff,0xff4488,0x88ddff,0xffaa00];

  /* ── 큰 바위/볼더 클러스터 ── */
  var boulderDefs=[
    [-80,-100,2.2],[-100,50,1.8],[60,-80,2.4],[80,50,2.0],
    [-40,100,2.2],[50,120,1.8],[-70,150,2.0],[80,160,2.4],
    [-20,-20,1.6],[30,80,2.0],[-60,130,1.9],[40,170,1.8]
  ];
  boulderDefs.forEach(function(bd){
    var bx=MX+bd[0],bz=MZ+bd[1];
    var rock=new THREE.Mesh(new THREE.DodecahedronGeometry(bd[2],1),stoneM);
    rock.position.set(bx,getTerrainY(bx,bz)+bd[2]*.4,bz);
    rock.rotation.set(Math.random()*Math.PI,Math.random()*Math.PI,Math.random()*.5);
    rock.castShadow=true;rock.receiveShadow=true;scene.add(rock);
  });

  /* ── 쓰러진 통나무 ── */
  [[-40,-60,0.3],[60,50,1.2],[-70,80,0.1],[40,-20,0.4],
   [-30,100,0.8],[50,130,1.5],[-90,30,0.2],[80,-40,0.9]
  ].forEach(function(ld){
    var lx=MX+ld[0],lz=MZ+ld[1];
    var log=new THREE.Mesh(new THREE.CylinderGeometry(.3,.35,4+Math.random()*3,8),logM);
    log.rotation.z=Math.PI/2;log.rotation.y=ld[2];
    log.position.set(lx,getTerrainY(lx,lz)+.3,lz);
    log.castShadow=true;log.receiveShadow=true;scene.add(log);
  });

  /* ── 야생화 패치 ── */
  for(var wfi=0;wfi<80;wfi++){
    var wx2=MX+(Math.random()-.5)*360,wz2=MZ+(Math.random()-.5)*360;
    if(false)continue;/* 레이아웃에 걸리는 위치 없음 */
    var wfc=meadowFlowerColors[Math.floor(Math.random()*meadowFlowerColors.length)];
    var wfpetal=new THREE.Mesh(new THREE.SphereGeometry(.12+Math.random()*.06,6,5),
      new THREE.MeshLambertMaterial({color:wfc}));
    wfpetal.position.set(wx2,getTerrainY(wx2,wz2)+.25,wz2);scene.add(wfpetal);
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
    g.position.set(MX-40,0,MZ-100);scene.add(g);
  })();

  /* ── 고대 석조 기둥 폐허 — 중간 초원 ── */
  (function(){
    var pillarM=new THREE.MeshLambertMaterial({color:0x8a8070});
    var capM2=new THREE.MeshLambertMaterial({color:0x6a6050});
    var pillarDefs=[
      [MX-60,MZ+80,4.5,false],
      [MX-58,MZ+83,3.2,false],
      [MX-56,MZ+81,0,true]
    ];
    pillarDefs.forEach(function(pd){
      var px2=pd[0],pz2=pd[1],ph2=pd[2],fallen=pd[3];
      var pty=getTerrainY(px2,pz2);
      if(!fallen){
        var pil=new THREE.Mesh(new THREE.CylinderGeometry(.4,.5,ph2,8),pillarM);
        pil.position.set(px2,pty+ph2/2,pz2);pil.castShadow=true;pil.receiveShadow=true;scene.add(pil);
        var pcap=new THREE.Mesh(new THREE.BoxGeometry(1.2,.3,1.2),capM2);
        pcap.position.set(px2,pty+ph2+.15,pz2);pcap.castShadow=true;scene.add(pcap);
      } else {
        var fpil=new THREE.Mesh(new THREE.CylinderGeometry(.4,.5,3.5,8),pillarM);
        fpil.rotation.z=Math.PI/2;fpil.rotation.y=0.4;
        fpil.position.set(pd[0],pty+.4,pd[1]);fpil.castShadow=true;fpil.receiveShadow=true;scene.add(fpil);
      }
    });
    var slabM=new THREE.MeshLambertMaterial({color:0x7a7060});
    var slab=new THREE.Mesh(new THREE.BoxGeometry(3.5,.2,2.2),slabM);
    var slabTY=getTerrainY(MX-58,MZ+82);
    slab.position.set(MX-58,slabTY+.1,MZ+82);slab.rotation.y=0.15;
    slab.castShadow=true;slab.receiveShadow=true;scene.add(slab);
  })();

  /* ── 키 큰 풀 클러스터 ── */
  var tallGrassM=new THREE.MeshLambertMaterial({color:0x3a7a1a});
  var tallGrass2M=new THREE.MeshLambertMaterial({color:0x4a8a22});
  [[-80,-80],[60,-50],[-20,30],[50,60],
   [-100,80],[40,100],[-50,120],[90,-60],
   [-10,50],[30,90],[-60,20],[20,-40],
   [0,10],[-40,100],[70,130],[-30,-60]
  ].forEach(function(pp){
    var tgh=.6+Math.random()*.7;
    var tgm=Math.random()>.5?tallGrassM:tallGrass2M;
    var tg=new THREE.Mesh(new THREE.ConeGeometry(.08+Math.random()*.06,tgh,4),tgm);
    var tgx=MX+pp[0],tgz=MZ+pp[1];
    tg.position.set(tgx,getTerrainY(tgx,tgz)+tgh/2,tgz);
    tg.rotation.y=Math.random()*Math.PI;
    tg.castShadow=true;scene.add(tg);
  });

  /* ── 버려진 농가 (3채) ── */
  (function(){
    var woodWallM=new THREE.MeshLambertMaterial({color:0x7a5a30});
    var woodRoofM=new THREE.MeshLambertMaterial({color:0x4a3010});
    var woodDarkM=new THREE.MeshLambertMaterial({color:0x3a2008});
    var stoneBaseM=new THREE.MeshLambertMaterial({color:0x8a7a60});
    var farmHouses=[
      [MX-80,MZ-80, 0.15],
      [MX+60,MZ-10, -0.1],
      [MX-100,MZ+80, 0.3],
      [MX+30,MZ+120, -0.2]
    ];
    farmHouses.forEach(function(fh){
      var g=new THREE.Group();
      /* 기단 돌 */
      var base=new THREE.Mesh(new THREE.BoxGeometry(5.5,.35,4.5),stoneBaseM);
      base.position.set(0,.175,0);base.castShadow=true;base.receiveShadow=true;g.add(base);
      /* 벽 */
      var wall=new THREE.Mesh(new THREE.BoxGeometry(5,3.2,4),woodWallM);
      wall.position.set(0,1.95,0);wall.castShadow=true;wall.receiveShadow=true;g.add(wall);
      /* 목재 보 세로 */
      [-1.8,1.8].forEach(function(bx){
        var beam=new THREE.Mesh(new THREE.BoxGeometry(.18,3.2,.12),woodDarkM);
        beam.position.set(bx,1.95,2.02);beam.castShadow=true;g.add(beam);
      });
      /* 목재 보 가로 */
      var hbeam=new THREE.Mesh(new THREE.BoxGeometry(5.2,.16,.12),woodDarkM);
      hbeam.position.set(0,3.1,2.02);hbeam.castShadow=true;g.add(hbeam);
      /* 지붕 */
      var roof=new THREE.Mesh(new THREE.ConeGeometry(3.6,2.2,4),woodRoofM);
      roof.position.set(0,4.3,0);roof.rotation.y=Math.PI/4;roof.castShadow=true;g.add(roof);
      /* 굴뚝 */
      var chim=new THREE.Mesh(new THREE.BoxGeometry(.45,1.2,.45),stoneBaseM);
      chim.position.set(1.2,5.2,.5);chim.castShadow=true;g.add(chim);
      /* 문 (부서진 느낌) */
      var door=new THREE.Mesh(new THREE.BoxGeometry(.75,1.5,.1),woodDarkM);
      door.position.set(0,1.1,2.07);door.rotation.y=.4;g.add(door);
      /* 창문 구멍 */
      var winM2=new THREE.MeshLambertMaterial({color:0x0a0804});
      var win=new THREE.Mesh(new THREE.BoxGeometry(.6,.55,.12),winM2);
      win.position.set(-1.5,2.4,2.04);g.add(win);
      g.position.set(fh[0],getTerrainY(fh[0],fh[1]),fh[1]);g.rotation.y=fh[2];
      scene.add(g);
    });
  })();

  /* ── 돌담/울타리 길가 ── */
  (function(){
    var stWallM=new THREE.MeshLambertMaterial({color:0x888070});
    var stWallDarkM=new THREE.MeshLambertMaterial({color:0x6a6050});
    /* 돌담 세그먼트 함수 */
    function stoneWall(x1,z1,x2,z2,h){
      h=h||1.1;
      var dx=x2-x1,dz=z2-z1;
      var len=Math.sqrt(dx*dx+dz*dz);
      var ang=Math.atan2(dx,dz);
      var wall=new THREE.Mesh(new THREE.BoxGeometry(len,.9,.55),stWallM);
      wall.position.set((x1+x2)/2,h/2,(z1+z2)/2);
      wall.rotation.y=ang;wall.castShadow=true;wall.receiveShadow=true;scene.add(wall);
      /* 윗 돌들 */
      var count=Math.floor(len/1.2);
      for(var wi=0;wi<count;wi++){
        var t=wi/count+.5/count;
        var wx=x1+dx*t,wz=z1+dz*t;
        var cap=new THREE.Mesh(new THREE.BoxGeometry(.8+Math.random()*.3,.28+Math.random()*.15,.5),stWallDarkM);
        cap.position.set(wx,h*.85+.14,wz);
        cap.rotation.y=ang+(Math.random()-.5)*.1;
        cap.castShadow=true;scene.add(cap);
      }
    }
    /* 길가 양쪽 돌담 */
    stoneWall(MX-30,MZ-80,MX-80,MZ-40,1.0);
    stoneWall(MX+30,MZ-80,MX+80,MZ-40,1.0);
    stoneWall(MX-40,MZ+20,MX-90,MZ+60,1.0);
    stoneWall(MX+40,MZ+20,MX+80,MZ+60,1.0);
  })();

  /* ── 풍차 구조물 ── */
  (function(){
    var g=new THREE.Group();
    var baseM3=new THREE.MeshLambertMaterial({color:0x8a7a60});
    var bodyM2=new THREE.MeshLambertMaterial({color:0xd4c8a8});
    var roofM3=new THREE.MeshLambertMaterial({color:0x5a3a18});
    var bladeM=new THREE.MeshLambertMaterial({color:0xd4c090});
    /* 기단 */
    var wbase=new THREE.Mesh(new THREE.CylinderGeometry(2.5,3,1.2,8),baseM3);
    wbase.position.set(0,.6,0);wbase.castShadow=true;wbase.receiveShadow=true;g.add(wbase);
    /* 탑 몸체 */
    var wtower=new THREE.Mesh(new THREE.CylinderGeometry(1.8,2.4,7,8),bodyM2);
    wtower.position.set(0,4.7,0);wtower.castShadow=true;wtower.receiveShadow=true;g.add(wtower);
    /* 지붕 */
    var wroof=new THREE.Mesh(new THREE.ConeGeometry(2.2,2.5,8),roofM3);
    wroof.position.set(0,9.45,0);wroof.castShadow=true;g.add(wroof);
    /* 날개 축 */
    var axle=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,.6,6),roofM3);
    axle.rotation.x=Math.PI/2;axle.position.set(0,7,2.0);g.add(axle);
    /* 날개 4개 */
    for(var bi=0;bi<4;bi++){
      var ba=bi/4*Math.PI*2;
      var blade=new THREE.Mesh(new THREE.BoxGeometry(.35,2.8,.08),bladeM);
      blade.position.set(Math.cos(ba)*1.4,7+Math.sin(ba)*1.4,2.15);
      blade.rotation.z=ba;blade.castShadow=true;g.add(blade);
      /* 날개 지지대 */
      var spoke=new THREE.Mesh(new THREE.BoxGeometry(.08,.08,1.5),roofM3);
      spoke.position.set(Math.cos(ba)*.7,7+Math.sin(ba)*.7,2.1);
      spoke.rotation.z=ba;g.add(spoke);
    }
    /* 창문 */
    var wwin=new THREE.Mesh(new THREE.BoxGeometry(.5,.55,.12),new THREE.MeshLambertMaterial({color:0x3a2808}));
    wwin.position.set(0,5.8,2.42);g.add(wwin);
    /* 문 */
    var wdoor=new THREE.Mesh(new THREE.BoxGeometry(.6,1.2,.12),new THREE.MeshLambertMaterial({color:0x3a2000}));
    wdoor.position.set(0,1.8,2.42);g.add(wdoor);
    var wmx=MX+80,wmz=MZ+60;
    g.position.set(wmx,getTerrainY(wmx,wmz),wmz);scene.add(g);
  })();

  /* ── 나무 다리 — 제거 (강이 다른 곳으로 이동됨, mkWaterRiver에서 처리) ── */
  (function(){
    var bridgePlanksM=new THREE.MeshLambertMaterial({color:0x7a5030});
    var bridgeRailM=new THREE.MeshLambertMaterial({color:0x5a3820});
    var bridgePostM=new THREE.MeshLambertMaterial({color:0x4a2e10});
    function woodBridge(cx,cz,rotY){
      var g=new THREE.Group();
      /* 주 빔 2개 */
      [-0.65,0.65].forEach(function(bx){
        var mainBeam=new THREE.Mesh(new THREE.BoxGeometry(.22,.25,7),bridgeRailM);
        mainBeam.position.set(bx,.12,0);mainBeam.castShadow=true;mainBeam.receiveShadow=true;g.add(mainBeam);
      });
      /* 판자들 */
      for(var pi2=-3;pi2<=3;pi2++){
        var plank=new THREE.Mesh(new THREE.BoxGeometry(1.5,.12,.7),bridgePlanksM);
        plank.position.set(0,.25,pi2*.95);plank.castShadow=true;plank.receiveShadow=true;g.add(plank);
      }
      /* 난간 기둥 */
      [-3,3].forEach(function(pz2){
        [-0.65,0.65].forEach(function(px2){
          var post=new THREE.Mesh(new THREE.BoxGeometry(.15,.9,.15),bridgePostM);
          post.position.set(px2,.7,pz2*.95);post.castShadow=true;g.add(post);
        });
      });
      /* 난간 레일 */
      [-0.65,0.65].forEach(function(rx){
        var rail=new THREE.Mesh(new THREE.BoxGeometry(.08,.08,5.8),bridgeRailM);
        rail.position.set(rx,1.15,0);g.add(rail);
      });
      g.position.set(cx,.08,cz);g.rotation.y=rotY||0;scene.add(g);
    }
    /* 다리는 mkWaterRiver에서 생성됨 */
  })();

  /* ── 추가 방향 표지판 ── */
  (function(){
    var signPostM=new THREE.MeshLambertMaterial({color:0x6e4010});
    var arrowM=new THREE.MeshLambertMaterial({color:0x7a4a10});
    function signPost(x,z,labels,ty){
      ty=ty||0;
      var g=new THREE.Group();
      var pole=new THREE.Mesh(new THREE.BoxGeometry(.16,.16,2.5),signPostM);
      pole.position.set(0,1.25,0);pole.castShadow=true;g.add(pole);
      labels.forEach(function(lbl,idx){
        var sign=new THREE.Mesh(new THREE.BoxGeometry(1.4,.26,.08),arrowM);
        sign.position.set(lbl[2]*.6,1.6+idx*.35,0);sign.rotation.y=lbl[3]||0;
        sign.castShadow=true;g.add(sign);
        var tip=new THREE.Mesh(new THREE.ConeGeometry(.13,.2,4),arrowM);
        tip.rotation.z=lbl[2]>0?-Math.PI/2:Math.PI/2;
        tip.position.set(lbl[2]*.6+(lbl[2]>0?.8:-.8),1.6+idx*.35,0);g.add(tip);
      });
      g.position.set(x,ty,z);scene.add(g);
    }
    signPost(MX-60,MZ-80,[['마을',0,-1,-.1],['초원',0,1,.1]],getTerrainY(MX-60,MZ-80));
    signPost(MX+40,MZ+80,[['정글 →',0,1,.05],['↑ 마을',0,1,.05]],getTerrainY(MX+40,MZ+80));
  })();

  /* ── 추가 나무 (20그루) ── */
  [[-40,-90],[40,-60],[-80,30],[80,50],[-50,70],[50,90],
   [-100,100],[100,120],[-30,130],[30,150],[-120,160],[120,170],
   [-60,-60],[60,-30],[-90,60],[90,40],[0,20],[-130,80],[130,110],[0,140]
  ].forEach(function(pp){mkTree(MX+pp[0],MZ+pp[1],.8+Math.random()*.7,scene);});

  /* ── 추가 목재 울타리/돌담 ── */
  (function(){
    var fencePostM=new THREE.MeshLambertMaterial({color:0x7a5a30});
    var fenceRailM=new THREE.MeshLambertMaterial({color:0x6a4a20});
    function woodFence(x1,z1,x2,z2){
      var dx=x2-x1,dz=z2-z1;
      var len=Math.sqrt(dx*dx+dz*dz);
      var ang=Math.atan2(dx,dz);
      var nPosts=Math.max(2,Math.floor(len/2.5));
      for(var fp=0;fp<nPosts;fp++){
        var t=fp/(nPosts-1);
        var px=x1+dx*t,pz=z1+dz*t;
        var py=getTerrainY(px,pz);
        var post=new THREE.Mesh(new THREE.BoxGeometry(.15,.15,1.4),fencePostM);
        post.position.set(px,py+.7,pz);post.castShadow=true;scene.add(post);
      }
      var rail=new THREE.Mesh(new THREE.BoxGeometry(len,.08,.1),fenceRailM);
      var mx=(x1+x2)/2,mz=(z1+z2)/2;
      var my=getTerrainY(mx,mz);
      rail.position.set(mx,my+.9,mz);rail.rotation.y=ang;rail.castShadow=true;scene.add(rail);
      var rail2=new THREE.Mesh(new THREE.BoxGeometry(len,.08,.1),fenceRailM);
      rail2.position.set(mx,my+.55,mz);rail2.rotation.y=ang;scene.add(rail2);
    }
    /* 초원 곳곳 울타리 */
    woodFence(MX-60,MZ-40,MX-90,MZ,MZ);
    woodFence(MX+40,MZ+30,MX+70,MZ+60);
    woodFence(MX-30,MZ+90,MX-60,MZ+110);
    woodFence(MX+30,MZ-80,MX+60,MZ-50);
  })();

  /* ── 추가 벤치 (2개) ── */
  (function(){
    var benchM=new THREE.MeshLambertMaterial({color:0x8a6a30});
    var benchDarkM=new THREE.MeshLambertMaterial({color:0x5a3a10});
    [[MX+30,MZ-30,.2],[MX+60,MZ+80,-.3]].forEach(function(bp){
      var g=new THREE.Group();
      /* 좌석 */
      var seat=new THREE.Mesh(new THREE.BoxGeometry(2.2,.14,.6),benchM);
      seat.position.set(0,.55,0);seat.castShadow=true;seat.receiveShadow=true;g.add(seat);
      /* 등받이 */
      var back=new THREE.Mesh(new THREE.BoxGeometry(2.2,.5,.1),benchM);
      back.position.set(0,.9,-.25);back.castShadow=true;g.add(back);
      /* 다리 4개 */
      [[-0.8,.22],[0.8,.22],[-0.8,-.22],[0.8,-.22]].forEach(function(lp){
        var leg=new THREE.Mesh(new THREE.BoxGeometry(.12,.55,.12),benchDarkM);
        leg.position.set(lp[0],.27,lp[1]);leg.castShadow=true;g.add(leg);
      });
      var ty=getTerrainY(bp[0],bp[1]);
      g.position.set(bp[0],ty,bp[1]);g.rotation.y=bp[2];scene.add(g);
    });
  })();

  /* ── 초원 바위/볼더 (산재) ── */
  (function(){
    var rockMat=new THREE.MeshLambertMaterial({color:0x777060});
    [[30,-95,1.0],[-50,-50,1.3],[60,20,0.9],[-30,60,1.1],[50,100,1.2],
     [-70,120,0.8],[30,130,1.0],[-10,40,1.4],[90,-40,0.8],[-80,80,1.1]
    ].forEach(function(rd){
      var rx=MX+rd[0],rz=MZ+rd[1];
      var rock=new THREE.Mesh(new THREE.SphereGeometry(rd[2],6,5),rockMat);
      rock.scale.set(1+Math.random()*.4,.7+Math.random()*.3,1+Math.random()*.4);
      rock.position.set(rx,getTerrainY(rx,rz)+rd[2]*.3,rz);
      rock.rotation.y=Math.random()*Math.PI;
      rock.castShadow=true;rock.receiveShadow=true;scene.add(rock);
    });
  })();
}

/* ════════════ 숲 장식 ════════════ */
/* 어두운 숲 (SW): x:-500~-100, z:200~500 — 중심 (-300,350) */
function buildForestDecor(){
  var FX=-300,FZ=350; /* 어두운 숲 중심 */
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
  [[-80,-80,0.6],[50,30,2.2],[-40,50,-0.3],
   [30,80,1.1],[-100,-40,0.8],[80,120,-0.4],
   [-30,100,0.5],[60,130,1.8],[-70,20,0.3]
  ].forEach(function(ld){
    var llen=5+Math.random()*5;
    var lx=FX+ld[0],lz=FZ+ld[1];
    var log=new THREE.Mesh(new THREE.CylinderGeometry(.32,.4,llen,8),logM);
    log.rotation.z=Math.PI/2;log.rotation.y=ld[2];
    log.position.set(lx,.35,lz);
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
    [FX-80,FZ-80],[FX+40,FZ-30],[FX-30,FZ+20],[FX+90,FZ+70],[FX-60,FZ-30],[FX+20,FZ+100],
    [FX-50,FZ+80],[FX+80,FZ+10],[FX-10,FZ+120],[FX+50,FZ-50]
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
    [[FX-50,FZ-70],[FX+50,FZ+30],[FX,FZ+100]].forEach(function(sp){
      /* 그루터기 */
      var sh=.5+Math.random()*.4;
      var stump=new THREE.Mesh(new THREE.CylinderGeometry(.5,.6,sh,8),stumpM);
      stump.position.set(sp[0],sh/2,sp[1]);stump.castShadow=true;stump.receiveShadow=true;scene.add(stump);
    });
    /* 도끼 박힌 그루터기 (하나만) */
    var _asx=FX-50,_asz=FZ-70;
    var axeStump=new THREE.Mesh(new THREE.CylinderGeometry(.55,.65,.65,8),stumpM);
    axeStump.position.set(_asx,.33,_asz);
    axeStump.castShadow=true;axeStump.receiveShadow=true;scene.add(axeStump);
    /* 도끼 자루 */
    var handle=new THREE.Mesh(new THREE.CylinderGeometry(.05,.07,.8,6),axeHandleM);
    handle.rotation.z=.4;handle.position.set(_asx+.4,.75,_asz);handle.castShadow=true;scene.add(handle);
    /* 도끼 날 */
    var axeHead=new THREE.Mesh(new THREE.BoxGeometry(.35,.28,.08),axeHeadM);
    axeHead.rotation.z=.4;axeHead.position.set(_asx+.7,1.1,_asz);axeHead.castShadow=true;scene.add(axeHead);
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
    var _shx=FX-60,_shz=FZ+20;
    g.position.set(_shx,getTerrainY(_shx,_shz),_shz);scene.add(g);
  })();

  /* ── 거미줄 (나무 사이 흰 평면) ── */
  [[FX-40,FZ-70,.4],[FX+60,FZ-20,.7],[FX-80,FZ+40,.3],[FX+30,FZ+100,.6],[FX-10,FZ+10,.5],[FX+50,FZ+80,.8]].forEach(function(wd){
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
    var _tlx=FX+40,_tlz=FZ-40;
    tunnelLog.position.set(_tlx,.9,_tlz);
    tunnelLog.castShadow=true;tunnelLog.receiveShadow=true;scene.add(tunnelLog);
    var endCap=new THREE.Mesh(new THREE.CylinderGeometry(.9,.9,.12,10),
      new THREE.MeshLambertMaterial({color:0x1a0e04}));
    endCap.rotation.z=Math.PI/2;endCap.position.set(_tlx+2.1,.9,_tlz);
    endCap.castShadow=true;scene.add(endCap);
    var mossTop=new THREE.Mesh(new THREE.SphereGeometry(.95,8,6),mossM);
    mossTop.scale.set(1,.3,1);mossTop.position.set(_tlx,.92,_tlz);scene.add(mossTop);
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
    var _cpx=FX-30,_cpz=FZ+60;
    g.position.set(_cpx,getTerrainY(_cpx,_cpz),_cpz);scene.add(g);
  })();

  /* ── 이끼 낀 바위들 ── */
  [[FX-60,FZ-80,1.2],[FX+50,FZ-20,1.5],[FX-30,FZ+50,1.0],[FX+80,FZ+100,1.3],[FX-70,FZ-30,1.1],
   [FX+40,FZ+20,1.4],[FX-20,FZ+80,1.2],[FX+80,FZ-60,1.5]
  ].forEach(function(rd){
    var rock=new THREE.Mesh(new THREE.DodecahedronGeometry(rd[2],1),stoneM);
    rock.position.set(rd[0],rd[2]*.35,rd[1]);
    rock.rotation.set(Math.random()*.8,Math.random()*Math.PI,.2);
    rock.castShadow=true;rock.receiveShadow=true;scene.add(rock);
  });

  /* ── 넝쿨 (나무에서 늘어지는 얇은 원통들) ── */
  [[FX-80,FZ-80,2.2],[FX-70,FZ+10,2.0],[FX+80,FZ-20,2.2],[FX+90,FZ+100,2.0],
   [FX-50,FZ+80,2.1],[FX+60,FZ-60,1.9],[FX-30,FZ+120,2.2],[FX+50,FZ+40,2.0]
  ].forEach(function(vd){
    var vl=.8+Math.random()*.8;
    var vine=new THREE.Mesh(new THREE.CylinderGeometry(.025,.035,vl,5),vineM);
    vine.position.set(vd[0],vd[2]-vl/2,vd[1]);
    vine.castShadow=true;scene.add(vine);
  });

  /* ── 폐허 석탑 (2-3개) ── */
  (function(){
    var ruinStoneM=new THREE.MeshLambertMaterial({color:0x3a3028});
    var ruinDarkM=new THREE.MeshLambertMaterial({color:0x2a2018});
    var towerDefs=[[FX-80,FZ-50],[FX+60,FZ+20],[FX,FZ+90]];
    towerDefs.forEach(function(td,idx){
      var g=new THREE.Group();
      var tH=5+idx*1.5;
      /* 원형 탑 기단 */
      var tbase=new THREE.Mesh(new THREE.CylinderGeometry(2.4,2.8,.8,8),ruinDarkM);
      tbase.position.set(0,.4,0);tbase.castShadow=true;tbase.receiveShadow=true;g.add(tbase);
      /* 탑 몸체 */
      var tbody=new THREE.Mesh(new THREE.CylinderGeometry(2.0,2.4,tH,8),ruinStoneM);
      tbody.position.set(0,tH/2+.8,0);tbody.castShadow=true;tbody.receiveShadow=true;g.add(tbody);
      /* 탑 창문 슬릿 */
      [0,1,2].forEach(function(wi){
        var wh=1.5+wi*tH/3;
        var wa=wi/3*Math.PI*2;
        var wslit=new THREE.Mesh(new THREE.BoxGeometry(.25,.6,.15),ruinDarkM);
        wslit.position.set(Math.cos(wa)*1.95,wh,Math.sin(wa)*1.95);
        wslit.rotation.y=wa;g.add(wslit);
      });
      /* 부서진 꼭대기 흉벽 */
      for(var mi=0;mi<6;mi++){
        if(Math.random()<.5)continue;
        var ma=mi/6*Math.PI*2;
        var merlon=new THREE.Mesh(new THREE.BoxGeometry(.6,.8,.6),ruinStoneM);
        merlon.position.set(Math.cos(ma)*1.8,tH+1.2,Math.sin(ma)*1.8);
        merlon.castShadow=true;g.add(merlon);
      }
      /* 탑 주변 무너진 돌들 */
      for(var ri=0;ri<4;ri++){
        var ra=ri/4*Math.PI*2+.3;
        var rubble=new THREE.Mesh(new THREE.BoxGeometry(.6+Math.random()*.4,.4+Math.random()*.4,.5+Math.random()*.3),ruinDarkM);
        rubble.position.set(Math.cos(ra)*2.8,.25,Math.sin(ra)*2.8);
        rubble.rotation.y=Math.random()*Math.PI;rubble.castShadow=true;g.add(rubble);
      }
      /* 이끼 */
      var mossTopM=new THREE.MeshLambertMaterial({color:0x1a3a08});
      var mossT=new THREE.Mesh(new THREE.CylinderGeometry(2.05,2.05,.15,8),mossTopM);
      mossT.position.set(0,1.3,0);g.add(mossT);
      g.position.set(td[0],getTerrainY(td[0],td[1]),td[1]);
      g.rotation.y=Math.random()*.3;scene.add(g);
    });
  })();

  /* ── 사냥꾼의 오두막 ── */
  (function(){
    var g=new THREE.Group();
    var cabinWallM=new THREE.MeshLambertMaterial({color:0x4a3010});
    var cabinRoofM=new THREE.MeshLambertMaterial({color:0x2a1a08});
    var logCabinM=new THREE.MeshLambertMaterial({color:0x3a2008});
    /* 기단 */
    var fnd=new THREE.Mesh(new THREE.BoxGeometry(5.5,.4,4.5),new THREE.MeshLambertMaterial({color:0x5a4a30}));
    fnd.position.set(0,.2,0);fnd.castShadow=true;fnd.receiveShadow=true;g.add(fnd);
    /* 통나무 벽 */
    var wall=new THREE.Mesh(new THREE.BoxGeometry(5,3.5,4),cabinWallM);
    wall.position.set(0,2.15,0);wall.castShadow=true;wall.receiveShadow=true;g.add(wall);
    /* 통나무 줄 무늬 */
    for(var li=0;li<5;li++){
      var logLine=new THREE.Mesh(new THREE.BoxGeometry(5.1,.22,4.1),logCabinM);
      logLine.position.set(0,.6+li*.6,0);g.add(logLine);
    }
    /* 지붕 */
    var cRoof=new THREE.Mesh(new THREE.ConeGeometry(3.6,2.2,4),cabinRoofM);
    cRoof.position.set(0,4.5,0);cRoof.rotation.y=Math.PI/4;cRoof.castShadow=true;g.add(cRoof);
    /* 굴뚝 */
    var chim=new THREE.Mesh(new THREE.BoxGeometry(.5,1.5,.5),new THREE.MeshLambertMaterial({color:0x5a5040}));
    chim.position.set(1.2,5.8,.5);chim.castShadow=true;g.add(chim);
    /* 연기 */
    var smokeM2=new THREE.MeshLambertMaterial({color:0x3a3028,transparent:true,opacity:.35});
    var smoke=new THREE.Mesh(new THREE.SphereGeometry(.4,6,5),smokeM2);
    smoke.position.set(1.2,7.2,.5);g.add(smoke);
    /* 문 */
    var door=new THREE.Mesh(new THREE.BoxGeometry(.7,1.5,.1),new THREE.MeshLambertMaterial({color:0x2a1800}));
    door.position.set(0,1.15,2.05);g.add(door);
    /* 창문 */
    var win=new THREE.Mesh(new THREE.BoxGeometry(.55,.5,.12),new THREE.MeshLambertMaterial({color:0x1a1008}));
    win.position.set(-1.5,2.5,2.04);g.add(win);
    /* 앞 사냥 도구 (활) */
    var bowM=new THREE.MeshLambertMaterial({color:0x5a3010});
    var bowArc=new THREE.Mesh(new THREE.TorusGeometry(.35,.04,5,10,.8*Math.PI),bowM);
    bowArc.position.set(2.6,.8,1.8);bowArc.rotation.z=-.3;g.add(bowArc);
    /* 배럴 옆에 */
    var barrelM2=new THREE.MeshLambertMaterial({color:0x5a3010});
    var barrel2=new THREE.Mesh(new THREE.CylinderGeometry(.28,.25,.65,8),barrelM2);
    barrel2.position.set(2.5,.33,2.0);barrel2.castShadow=true;g.add(barrel2);
    var _hcx=FX+50,_hcz=FZ-20;
    g.position.set(_hcx,getTerrainY(_hcx,_hcz),_hcz);g.rotation.y=.5;scene.add(g);
  })();

  /* ── 석조 아치웨이/문 ── */
  (function(){
    var archStoneM=new THREE.MeshLambertMaterial({color:0x3a3028});
    var archDarkM=new THREE.MeshLambertMaterial({color:0x2a2018});
    var archPositions=[[FX+30,FZ-70],[FX-60,FZ+10],[FX-20,FZ+90]];
    archPositions.forEach(function(ap,ai){
      var g=new THREE.Group();
      /* 왼쪽 기둥 */
      var pL=new THREE.Mesh(new THREE.BoxGeometry(1.2,5,.9),archStoneM);
      pL.position.set(-2.2,2.5,0);pL.castShadow=true;pL.receiveShadow=true;g.add(pL);
      /* 오른쪽 기둥 */
      var pR=new THREE.Mesh(new THREE.BoxGeometry(1.2,5,.9),archStoneM);
      pR.position.set(2.2,2.5,0);pR.castShadow=true;pR.receiveShadow=true;g.add(pR);
      /* 상단 인방 */
      var lintel=new THREE.Mesh(new THREE.BoxGeometry(5.6,.7,.9),archDarkM);
      lintel.position.set(0,5.35,0);lintel.castShadow=true;g.add(lintel);
      /* 반원 아치 */
      var arch=new THREE.Mesh(new THREE.TorusGeometry(1.6,.35,7,12,Math.PI),archDarkM);
      arch.position.set(0,5.35,0);arch.rotation.z=Math.PI;g.add(arch);
      /* 기둥 캡 장식 */
      [[-2.2,5.75],[2.2,5.75]].forEach(function(cp2){
        var cap=new THREE.Mesh(new THREE.BoxGeometry(1.4,.35,1.1),archDarkM);
        cap.position.set(cp2[0],cp2[1],0);cap.castShadow=true;g.add(cap);
      });
      /* 무너진 돌 */
      var rubM=new THREE.MeshLambertMaterial({color:0x2a2018});
      var rub=new THREE.Mesh(new THREE.BoxGeometry(.7,.5,.6),rubM);
      rub.position.set(-2.5,.25,0.4);rub.rotation.y=.5;rub.castShadow=true;g.add(rub);
      g.position.set(ap[0],getTerrainY(ap[0],ap[1]),ap[1]);g.rotation.y=ai*.3;scene.add(g);
    });
  })();

  /* ── 횃불 밝혀진 공터 ── */
  (function(){
    var torchPoleM=new THREE.MeshLambertMaterial({color:0x3a2008});
    var fireMat2=new THREE.MeshBasicMaterial({color:0xff8820});
    var clearings=[[FX+40,FZ-50],[FX-50,FZ+40],[FX+20,FZ+110]];
    clearings.forEach(function(cp){
      /* 공터 바닥 */
      var clearingM=new THREE.MeshLambertMaterial({color:0x1a2a0a});
      var clearing=new THREE.Mesh(new THREE.CircleGeometry(5,12),clearingM);
      clearing.rotation.x=-Math.PI/2;clearing.position.set(cp[0],.008,cp[1]);scene.add(clearing);
      /* 돌 링 */
      for(var si=0;si<6;si++){
        var sa=si/6*Math.PI*2;
        var stone=new THREE.Mesh(new THREE.DodecahedronGeometry(.35,0),new THREE.MeshLambertMaterial({color:0x5a5040}));
        stone.position.set(cp[0]+Math.cos(sa)*4.2,.2,cp[1]+Math.sin(sa)*4.2);
        stone.castShadow=true;scene.add(stone);
      }
      /* 횃불 4개 */
      [[3,3],[-3,3],[3,-3],[-3,-3]].forEach(function(tp){
        var pole=new THREE.Mesh(new THREE.CylinderGeometry(.06,.08,2,6),torchPoleM);
        pole.position.set(cp[0]+tp[0],1,cp[1]+tp[1]);pole.castShadow=true;scene.add(pole);
        var fire=new THREE.Mesh(new THREE.SphereGeometry(.14,7,7),fireMat2);
        fire.position.set(cp[0]+tp[0],2.2,cp[1]+tp[1]);scene.add(fire);
        var fl=new THREE.PointLight(0xff8830,1.5,12);fl.position.set(cp[0]+tp[0],2.2,cp[1]+tp[1]);scene.add(fl);
      });
    });
  })();

  /* ── 거미줄 구조체 (나무 사이) ── */
  (function(){
    var bigWebM=new THREE.MeshLambertMaterial({color:0xeeeedd,transparent:true,opacity:.4,side:THREE.DoubleSide});
    [[FX+50,FZ-30],[FX-60,FZ+50],[FX+50,FZ+100]].forEach(function(wp){
      /* 방사형 거미줄 */
      for(var wi=0;wi<6;wi++){
        var wa=wi/6*Math.PI*2;
        var strand=new THREE.Mesh(new THREE.CylinderGeometry(.015,.015,3.5,4),bigWebM);
        strand.rotation.z=Math.PI/2;strand.rotation.y=wa;
        strand.position.set(wp[0]+Math.cos(wa)*1.75,3.5+Math.sin(wa)*1.75*0.3,wp[1]);
        scene.add(strand);
      }
      /* 동심원 */
      [.8,1.5,2.2].forEach(function(wr){
        var ring=new THREE.Mesh(new THREE.TorusGeometry(wr,.02,4,12),bigWebM);
        ring.position.set(wp[0],3.8,wp[1]);ring.rotation.x=Math.PI/2*.3;scene.add(ring);
      });
    });
  })();

  /* ── 추가 쓰러진 통나무 8개 ── */
  [[FX-90,FZ-60,0.9],[FX+80,FZ-20,2.4],[FX-50,FZ+30,0.2],
   [FX+30,FZ+60,1.6],[FX-70,FZ+90,0.7],[FX+70,FZ-30,3.0],
   [FX-20,FZ-40,1.1],[FX+60,FZ+110,2.8]
  ].forEach(function(ld){
    var llen=4+Math.random()*5;
    var log2=new THREE.Mesh(new THREE.CylinderGeometry(.28,.38,llen,7),logM);
    log2.rotation.z=Math.PI/2;log2.rotation.y=ld[2];
    log2.position.set(ld[0],getTerrainY(ld[0],ld[1])+.3,ld[1]);
    log2.castShadow=true;log2.receiveShadow=true;scene.add(log2);
  });

  /* ── 추가 버섯 클러스터 4개 ── */
  (function(){
    var mColors=[[0xcc2200,0xff6644],[0x440088,0xaa44ff],[0x004422,0x00cc66],[0x885500,0xffcc00]];
    [[FX-100,FZ-50],[FX+80,FZ+20],[FX-70,FZ+80],[FX+100,FZ-20]].forEach(function(mg,mi){
      var col=mColors[mi%mColors.length];
      var smM=new THREE.MeshLambertMaterial({color:col[0]});
      var cmM=new THREE.MeshLambertMaterial({color:col[1]});
      var msh=.45+Math.random()*.4;
      var mstem=new THREE.Mesh(new THREE.CylinderGeometry(.1,.15,msh,6),smM);
      mstem.position.set(mg[0],getTerrainY(mg[0],mg[1])+msh/2,mg[1]);mstem.castShadow=true;scene.add(mstem);
      var mcap=new THREE.Mesh(new THREE.SphereGeometry(.3+Math.random()*.1,8,6),cmM);
      mcap.scale.y=.55;mcap.position.set(mg[0],getTerrainY(mg[0],mg[1])+msh+.1,mg[1]);
      mcap.castShadow=true;scene.add(mcap);
      /* 작은 주변 버섯 */
      for(var si=0;si<3;si++){
        var sx=mg[0]+(Math.random()-.5)*2,sz=mg[1]+(Math.random()-.5)*2;
        var ssh=.2+Math.random()*.25;
        var ss=new THREE.Mesh(new THREE.CylinderGeometry(.05,.08,ssh,5),smM);
        ss.position.set(sx,getTerrainY(sx,sz)+ssh/2,sz);scene.add(ss);
        var sc=new THREE.Mesh(new THREE.SphereGeometry(.15,6,5),cmM);
        sc.scale.y=.55;sc.position.set(sx,getTerrainY(sx,sz)+ssh+.05,sz);scene.add(sc);
      }
    });
  })();

  /* ── 추가 거미줄 구조체 3개 ── */
  (function(){
    var extraWebM=new THREE.MeshLambertMaterial({color:0xddddbb,transparent:true,opacity:.35,side:THREE.DoubleSide});
    [[FX-100,FZ-20],[FX+80,FZ+60],[FX-80,FZ+110]].forEach(function(wp){
      for(var wi=0;wi<5;wi++){
        var wa=wi/5*Math.PI*2;
        var strand=new THREE.Mesh(new THREE.CylinderGeometry(.012,.012,3,4),extraWebM);
        strand.rotation.z=Math.PI/2;strand.rotation.y=wa;
        strand.position.set(wp[0]+Math.cos(wa)*1.5,3+Math.sin(wa)*1.5*.25,wp[1]);
        scene.add(strand);
      }
      var ring=new THREE.Mesh(new THREE.TorusGeometry(1.2,.018,4,10),extraWebM);
      ring.position.set(wp[0],3.5,wp[1]);ring.rotation.x=.3;scene.add(ring);
    });
  })();

  /* ── 숲 추가 나무 15그루 ── */
  (function(){
    var fTrunkM=new THREE.MeshLambertMaterial({color:0x1a0e05});
    var fLeafM=new THREE.MeshLambertMaterial({color:0x1a4a12});
    var fLeaf2M=new THREE.MeshLambertMaterial({color:0x150a20});
    [[FX-100,FZ-90],[FX+100,FZ-80],[FX-90,FZ-20],[FX+90,FZ-10],[FX,FZ-50],
     [FX-110,FZ+20],[FX+110,FZ+30],[FX-100,FZ+80],[FX+100,FZ+90],[FX,FZ+50],
     [FX-120,FZ+120],[FX+120,FZ+110],[FX-80,FZ+10],[FX+80,FZ+40],[FX,FZ+90]
    ].forEach(function(pp){
      var th=5+Math.random()*4;
      var ts=1.1+Math.random()*.9;
      var ty=getTerrainY(pp[0],pp[1]);
      var trunk=new THREE.Mesh(new THREE.CylinderGeometry(.18,.32,th,6),fTrunkM);
      trunk.scale.set(ts,1,ts);trunk.position.set(pp[0],ty+th/2,pp[1]);trunk.castShadow=true;scene.add(trunk);
      var lr=1.6*ts+Math.random()*.8;
      var lm=Math.random()<.5?fLeafM:fLeaf2M;
      var leaf=new THREE.Mesh(new THREE.ConeGeometry(lr,2.5*ts,7),lm);
      leaf.position.set(pp[0],ty+th+lr*.3,pp[1]);leaf.castShadow=true;scene.add(leaf);
    });
  })();

  /* ── 숲 바위/볼더 산재 ── */
  (function(){
    var fRockM=new THREE.MeshLambertMaterial({color:0x2a2018});
    [[FX-80,FZ-70,1.1],[FX+60,FZ-30,1.3],[FX-50,FZ+30,0.9],[FX+90,FZ+80,1.4],
     [FX-10,FZ+10,1.0],[FX+80,FZ+50,1.2],[FX-100,FZ+90,0.9],[FX+50,FZ+120,1.1],
     [FX,FZ-40,1.3],[FX-70,FZ+60,1.0]
    ].forEach(function(rd){
      var rk=new THREE.Mesh(new THREE.SphereGeometry(rd[2],6,5),fRockM);
      rk.scale.set(1+Math.random()*.3,.65+Math.random()*.3,1+Math.random()*.3);
      rk.position.set(rd[0],getTerrainY(rd[0],rd[1])+rd[2]*.3,rd[1]);
      rk.rotation.y=Math.random()*Math.PI;
      rk.castShadow=true;rk.receiveShadow=true;scene.add(rk);
    });
  })();
}

/* ════════════ 늪지 장식 ════════════ */
/* 늪 (W): x:-600~-200, z:-100~300 — 중심 (-400,100) */
function buildSwampDecor(){
  var SX=-400,SZ=100; /* 늪 중심 */
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

  /* 늪 장식 배치 (서쪽 1곳) */
  [1].forEach(function(side){
    var sx=SX; /* 중심 x */

    /* ── 죽은 나무 ── */
    [[SX-60,SZ-60],[SX+30,SZ+40],[SX-50,SZ+80],[SX+80,SZ+120]].forEach(function(pp){
      var tx=pp[0],tz=pp[1];
      var th=4+Math.random()*3;
      var trunk=new THREE.Mesh(new THREE.CylinderGeometry(.18,.3,th,7),deadTreeM);
      trunk.position.set(tx,th/2,tz);
      trunk.castShadow=true;trunk.receiveShadow=true;scene.add(trunk);
    });

    /* ── 진흙 구덩이 (갈색 원) ── */
    var mudM=new THREE.MeshLambertMaterial({color:0x2a1a08,transparent:true,opacity:.88});
    [[SX-60,SZ-50,4.5],[SX+40,SZ+30,3.5],[SX-30,SZ+70,4.0],[SX+80,SZ+100,3.5],[SX-80,SZ,3.0],[SX+20,SZ+60,3.5]].forEach(function(md){
      var mud=new THREE.Mesh(new THREE.CircleGeometry(md[2],10),mudM);
      mud.rotation.x=-Math.PI/2;mud.position.set(md[0],.015,md[1]);
      mud.receiveShadow=true;scene.add(mud);
    });

    /* ── 나무 판자 보드워크 ── */
    (function(){
      /* 부두 형태의 판자길 */
      var boards=[
        [SX-40,SZ-50],[SX-37,SZ-47],[SX-34,SZ-44],[SX-31,SZ-41]
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
      var _skx=SX+30,_skz=SZ+80;
      g.position.set(_skx,getTerrainY(_skx,_skz),_skz);g.rotation.y=Math.random()*.5;scene.add(g);
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
      var _ctx=SX+60,_ctz=SZ+40;
      g.position.set(_ctx,getTerrainY(_ctx,_ctz),_ctz);scene.add(g);
    })();

    /* ── 늪 등불 (초록 빛 포스트) ── */
    [[SX-30,SZ+30],[SX+40,SZ+90]].forEach(function(lp){
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
      g.position.set(lp[0],getTerrainY(lp[0],lp[1]),lp[1]);scene.add(g);
    });

    /* 독성 꽃 — 제거됨 (성능 최적화) */

    /* ── 수상 오두막 (물위 말뚝) ── */
    (function(){
      var stiltsM=new THREE.MeshLambertMaterial({color:0x2a1a08});
      var hutWallM=new THREE.MeshLambertMaterial({color:0x3a2808});
      var hutRoofM=new THREE.MeshLambertMaterial({color:0x1e1205});
      var g=new THREE.Group();
      /* 말뚝 4개 */
      [[-1.2,-1.2],[-1.2,1.2],[1.2,-1.2],[1.2,1.2]].forEach(function(sp){
        var stilt=new THREE.Mesh(new THREE.CylinderGeometry(.1,.14,2.5,6),stiltsM);
        stilt.position.set(sp[0],1.25,sp[1]);stilt.castShadow=true;g.add(stilt);
      });
      /* 바닥 */
      var floor=new THREE.Mesh(new THREE.BoxGeometry(2.8,.2,2.8),stiltsM);
      floor.position.set(0,2.5,0);floor.castShadow=true;floor.receiveShadow=true;g.add(floor);
      /* 벽 */
      var hwall=new THREE.Mesh(new THREE.BoxGeometry(2.6,2.0,2.6),hutWallM);
      hwall.position.set(0,3.6,0);hwall.castShadow=true;hwall.receiveShadow=true;g.add(hwall);
      /* 지붕 */
      var hroof=new THREE.Mesh(new THREE.ConeGeometry(2.0,1.8,4),hutRoofM);
      hroof.position.set(0,5.5,0);hroof.rotation.y=Math.PI/4;hroof.castShadow=true;g.add(hroof);
      /* 문 (삐걱대는 느낌, 기울어짐) */
      var hdoor=new THREE.Mesh(new THREE.BoxGeometry(.6,1.2,.08),new THREE.MeshLambertMaterial({color:0x1a1004}));
      hdoor.position.set(0,2.9,1.32);hdoor.rotation.y=.3;g.add(hdoor);
      /* 수상 플랫폼 연결 */
      var plat=new THREE.Mesh(new THREE.BoxGeometry(3.5,.15,1.2),stiltsM);
      plat.position.set(0,2.52,2.0);g.add(plat);
      /* 플랫폼 말뚝 */
      [[-1.5,2.8],[1.5,2.8]].forEach(function(pp){
        var sp=new THREE.Mesh(new THREE.CylinderGeometry(.08,.1,1.5,6),stiltsM);
        sp.position.set(pp[0],1.75,pp[1]);g.add(sp);
      });
      /* 수면 */
      var pondM=new THREE.MeshLambertMaterial({color:0x1a2808,transparent:true,opacity:.7});
      var pond=new THREE.Mesh(new THREE.CircleGeometry(2.5,10),pondM);
      pond.rotation.x=-Math.PI/2;pond.position.set(0,.04,0);g.add(pond);
      var _shx2=SX-20,_shz2=SZ+50;
      g.position.set(_shx2,getTerrainY(_shx2,_shz2),_shz2);scene.add(g);
    })();

    /* ── 죽은 나무 그루터기 + 버섯 ── */
    [[SX-40,SZ-40],[SX+30,SZ+50],[SX-60,SZ+100]].forEach(function(sp){
      /* 그루터기 */
      var stH=.6+Math.random()*.3;
      var stump=new THREE.Mesh(new THREE.CylinderGeometry(.5+Math.random()*.2,.65,stH,8),
        new THREE.MeshLambertMaterial({color:0x1a1005}));
      stump.position.set(sp[0],stH/2,sp[1]);stump.castShadow=true;stump.receiveShadow=true;scene.add(stump);
      /* 버섯 클러스터 */
      [0,1,2].forEach(function(mi){
        var ma=mi/3*Math.PI*2;
        var msh=.25+Math.random()*.2;
        var mushStem=new THREE.Mesh(new THREE.CylinderGeometry(.06,.08,msh,6),
          new THREE.MeshLambertMaterial({color:0x886633}));
        mushStem.position.set(sp[0]+Math.cos(ma)*.45,stH+msh/2,sp[1]+Math.sin(ma)*.45);
        scene.add(mushStem);
        var mushCap=new THREE.Mesh(new THREE.SphereGeometry(.18,6,5),
          new THREE.MeshLambertMaterial({color:0x8833bb}));
        mushCap.scale.y=.5;mushCap.position.set(sp[0]+Math.cos(ma)*.45,stH+msh+.08,sp[1]+Math.sin(ma)*.45);
        scene.add(mushCap);
      });
    });

    /* ── 부서진 나무 다리 ── */
    (function(){
      var brokenPlanksM=new THREE.MeshLambertMaterial({color:0x2a1a06});
      var brokenPostM=new THREE.MeshLambertMaterial({color:0x1a1204});
      var g=new THREE.Group();
      /* 남은 기둥들 */
      [[-2.5,0],[-1.0,0],[1.8,0],[3.5,0]].forEach(function(pp){
        if(Math.random()<.3)return;
        var post=new THREE.Mesh(new THREE.CylinderGeometry(.1,.14,1.4+Math.random()*.4,6),brokenPostM);
        post.position.set(pp[0],.7+Math.random()*.2,pp[1]);
        post.rotation.z=(Math.random()-.5)*.2;post.castShadow=true;g.add(post);
      });
      /* 부서진 판자 (기울어짐) */
      [[-1.5,0],[0,0],[2,0]].forEach(function(pp){
        var plank=new THREE.Mesh(new THREE.BoxGeometry(1.3,.12,.9),brokenPlanksM);
        plank.position.set(pp[0],.75,pp[1]);
        plank.rotation.z=(Math.random()-.5)*.5;
        plank.rotation.y=(Math.random()-.5)*.3;
        plank.castShadow=true;g.add(plank);
      });
      /* 물에 빠진 판자 */
      var fallenPlank=new THREE.Mesh(new THREE.BoxGeometry(1.2,.1,.8),brokenPlanksM);
      fallenPlank.position.set(1,.1,1.5);fallenPlank.rotation.z=-.8;fallenPlank.rotation.x=.3;g.add(fallenPlank);
      var _bbx=SX+50,_bbz=SZ+80;
      g.position.set(_bbx,getTerrainY(_bbx,_bbz),_bbz);g.rotation.y=Math.PI/2;scene.add(g);
    })();

    /* ── 모닥불 잔재 (버려진 야영지) ── */
    (function(){
      var ashM=new THREE.MeshLambertMaterial({color:0x2a2018});
      var _ashx=SX+20,_ashz=SZ+30;
      var ashCircle=new THREE.Mesh(new THREE.CircleGeometry(1.2,8),ashM);
      ashCircle.rotation.x=-Math.PI/2;ashCircle.position.set(_ashx,0.01,_ashz);scene.add(ashCircle);
      /* 재 속 통나무 잔해 */
      [0,Math.PI/3].forEach(function(la){
        var charLog=new THREE.Mesh(new THREE.CylinderGeometry(.08,.1,.8,6),
          new THREE.MeshLambertMaterial({color:0x1a1008}));
        charLog.rotation.z=Math.PI/2;charLog.rotation.y=la;
        charLog.position.set(_ashx+Math.cos(la+Math.PI/2)*.2,.06,_ashz+Math.sin(la+Math.PI/2)*.2);
        scene.add(charLog);
      });
      /* 돌 링 */
      for(var ci3=0;ci3<6;ci3++){
        var ca=ci3/6*Math.PI*2;
        var cs=new THREE.Mesh(new THREE.DodecahedronGeometry(.18,0),new THREE.MeshLambertMaterial({color:0x5a5040}));
        cs.position.set(_ashx+Math.cos(ca)*1.1,.1,_ashz+Math.sin(ca)*1.1);
        cs.castShadow=true;scene.add(cs);
      }
    })();

  }); /* end side loop */

  /* ── 늪 추가 바위/볼더 산재 (양쪽) ── */
  (function(){
    var swampRockM=new THREE.MeshLambertMaterial({color:0x333322});
    [
      [SX-60,SZ-60,0.9],[SX+30,SZ+30,1.1],[SX-80,SZ-20,0.8],[SX+80,SZ+80,1.0],[SX-50,SZ+100,1.2],
      [SX-100,SZ-40,0.9],[SX+50,SZ+50,1.1],[SX-120,SZ,0.8],[SX+100,SZ+60,1.0],[SX+40,SZ-80,1.2],
      [SX-30,SZ+40,0.7],[SX+70,SZ+90,0.7],[SX-90,SZ+110,1.0],[SX+110,SZ+120,1.0],[SX,SZ,1.1]
    ].forEach(function(rd){
      var rk=new THREE.Mesh(new THREE.SphereGeometry(rd[2],5,4),swampRockM);
      rk.scale.set(1+Math.random()*.3,.6+Math.random()*.3,1+Math.random()*.3);
      rk.position.set(rd[0],getTerrainY(rd[0],rd[1])+rd[2]*.25,rd[1]);
      rk.rotation.y=Math.random()*Math.PI;
      rk.castShadow=true;rk.receiveShadow=true;scene.add(rk);
    });
  })();
}

/* ════════════ 화산 장식 ════════════ */
/* 화산 (SE): x:150~550, z:250~550 — 중심 (350,400) */
function buildVolcanoDecor(){
  var VCX=350,VCZ=400; /* 화산 중심 */
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
  [[VCX-80,VCZ-60,1.8],[VCX+40,VCZ+30,2.2],[VCX-30,VCZ+80,2.6],[VCX+80,VCZ+100,2.0],[VCX-60,VCZ+120,2.3],[VCX+30,VCZ-40,1.8],
   [VCX-100,VCZ,1.6],[VCX+80,VCZ-30,2.0],[VCX-50,VCZ+100,2.2],[VCX+60,VCZ+50,1.8]
  ].forEach(function(od){
    var rock=new THREE.Mesh(new THREE.DodecahedronGeometry(od[2],0),obsidianM);
    rock.position.set(od[0],od[2]*.45,od[1]);
    rock.rotation.set(Math.random()*.8,Math.random()*Math.PI,Math.random()*.4);
    rock.castShadow=true;rock.receiveShadow=true;scene.add(rock);
  });

  /* ── 균열 지면 어두운 패치들 ── */
  [[VCX-50,VCZ-50,7,4.5],[VCX+30,VCZ+20,6,4],[VCX-70,VCZ+70,9,5.5],[VCX+50,VCZ+100,7,4.5],[VCX-30,VCZ+120,10,6],
   [VCX+40,VCZ-30,5,4],[VCX-60,VCZ+40,6,4.5],[VCX+60,VCZ+80,7,5]
  ].forEach(function(cp){
    var crk=new THREE.Mesh(new THREE.PlaneGeometry(cp[2],cp[3]),crackedGroundM);
    crk.rotation.x=-Math.PI/2;crk.position.set(cp[0],.019,cp[1]);
    crk.receiveShadow=true;scene.add(crk);
  });

  /* ── 뼈 더미 ── */
  [[VCX-80,VCZ-50],[VCX+40,VCZ+60],[VCX-50,VCZ+100],[VCX+20,VCZ+120],[VCX-70,VCZ],[VCX+70,VCZ+70]].forEach(function(bp){
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
    var statues=[[VCX-80,VCZ-40],[VCX,VCZ+50],[VCX+60,VCZ+100],[VCX-50,VCZ+120],[VCX+70,VCZ],[VCX-60,VCZ+70]];
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
      g.position.set(sp[0],getTerrainY(sp[0],sp[1]),sp[1]);scene.add(g);
    });
  })();

  /* ── 화산 분기공 (원뿔 + 연기) ── */
  [[VCX-60,VCZ-50],[VCX+40,VCZ+20],[VCX-90,VCZ+70],[VCX+20,VCZ+100],[VCX,VCZ+120],[VCX-30,VCZ+40],[VCX+70,VCZ+80],[VCX-80,VCZ+110]].forEach(function(vp){
    var g=new THREE.Group();
    /* 분기공 원뿔 */
    var vent=new THREE.Mesh(new THREE.ConeGeometry(.7,.9,8),ventConeM);
    vent.position.set(0,.45,0);vent.castShadow=true;vent.receiveShadow=true;g.add(vent);
    /* 내부 개구부 (어두운 원) */
    var holeM=new THREE.MeshLambertMaterial({color:0x060202});
    var hole=new THREE.Mesh(new THREE.CircleGeometry(.45,8),holeM);
    hole.rotation.x=-Math.PI/2;hole.position.set(0,.92,0);g.add(hole);
    g.position.set(vp[0],getTerrainY(vp[0],vp[1]),vp[1]);scene.add(g);
  });

  /* ── 불탄 나무 그루터기들 ── */
  [[VCX-60,VCZ-50],[VCX+40,VCZ+20],[VCX-80,VCZ+70],[VCX+30,VCZ+100],[VCX,VCZ+120],[VCX-40,VCZ+30],[VCX+70,VCZ+90]
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
    var _cagex=VCX-90,_cagez=VCZ+20;
    g.position.set(_cagex,getTerrainY(_cagex,_cagez),_cagez);scene.add(g);
  })();

  /* ── 파괴된/불탄 구조물 잔해 ── */
  (function(){
    var ruinM=new THREE.MeshLambertMaterial({color:0x1a1208});
    /* 무너진 벽 파편들 */
    [[VCX-50,VCZ+60,1.8,.4,1.2],[VCX+40,VCZ+60,.4,1.6,.8],[VCX-50,VCZ+62,.4,1.0,1.5],[VCX+40,VCZ+61,1.6,.4,1.0]].forEach(function(wp){
      var wall=new THREE.Mesh(new THREE.BoxGeometry(wp[2],wp[4],wp[3]),ruinM);
      wall.position.set(wp[0],wp[4]/2,wp[1]);
      wall.rotation.y=(Math.random()-.5)*.3;
      wall.castShadow=true;wall.receiveShadow=true;scene.add(wall);
    });
    /* 무너진 아치 */
    var archRuinM=new THREE.MeshLambertMaterial({color:0x140e06});
    var archPiece=new THREE.Mesh(new THREE.BoxGeometry(1.4,.4,.6),archRuinM);
    archPiece.position.set(VCX,1.5,VCZ+62);archPiece.rotation.z=.7;
    archPiece.castShadow=true;scene.add(archPiece);
  })();

  /* ── 흑요석 기둥들 ── */
  (function(){
    var obsidPillarM=new THREE.MeshPhongMaterial({color:0x050305,shininess:150});
    var obsidCapM=new THREE.MeshPhongMaterial({color:0x0a0808,shininess:120});
    [[VCX-70,VCZ-50,3.5],[VCX-72,VCZ-46,2.2],[VCX+40,VCZ+10,4.0],[VCX+42,VCZ+12,2.8],
     [VCX-20,VCZ+50,3.2],[VCX-22,VCZ+52,2.0],[VCX+60,VCZ+80,4.5],[VCX+62,VCZ+82,3.0],
     [VCX-40,VCZ+110,3.8],[VCX-42,VCZ+108,2.5],[VCX+20,VCZ-30,3.5]
    ].forEach(function(op){
      var obsPillar=new THREE.Mesh(new THREE.BoxGeometry(op[2]*.35,op[2]*1.8,op[2]*.3),obsidPillarM);
      obsPillar.position.set(op[0],op[2]*.9,op[1]);
      obsPillar.rotation.y=(Math.random()-.5)*.3;
      obsPillar.castShadow=true;obsPillar.receiveShadow=true;scene.add(obsPillar);
      /* 뾰족 끝 */
      var tipCone=new THREE.Mesh(new THREE.ConeGeometry(op[2]*.18,op[2]*.5,4),obsidCapM);
      tipCone.position.set(op[0],op[2]*1.85,op[1]);tipCone.rotation.y=Math.PI/4;
      tipCone.castShadow=true;scene.add(tipCone);
    });
  })();

  /* ── 용암 균열 지면 플랫폼 ── */
  (function(){
    var crackPlatM=new THREE.MeshLambertMaterial({color:0x120804});
    var lavaCrackM=new THREE.MeshLambertMaterial({color:0xff3300,emissive:new THREE.Color(0xff1100),emissiveIntensity:.6,transparent:true,opacity:.85});
    [[VCX-30,VCZ-40,8,5],[VCX+50,VCZ+10,6,5],[VCX-50,VCZ+60,7,5],[VCX+30,VCZ+100,8,5],[VCX,VCZ+50,9,6]].forEach(function(pp){
      /* 플랫폼 */
      var plat=new THREE.Mesh(new THREE.BoxGeometry(pp[2],1.2,pp[3]),crackPlatM);
      plat.position.set(pp[0],.6,pp[1]);plat.castShadow=true;plat.receiveShadow=true;scene.add(plat);
      /* 균열 용암 선 */
      [0,1,2].forEach(function(ci){
        var crack=new THREE.Mesh(new THREE.BoxGeometry(.08,.08,pp[3]*.7),lavaCrackM);
        crack.position.set(pp[0]+(ci-1)*pp[2]*.25,1.25,pp[1]);scene.add(crack);
        var lcrack=new THREE.PointLight(0xff2200,.4,8);lcrack.position.set(pp[0]+(ci-1)*pp[2]*.25,1.5,pp[1]);scene.add(lcrack);
      });
    });
  })();

  /* ── 폐허 대장간/단조장 ── */
  (function(){
    var g=new THREE.Group();
    var forgeWallM=new THREE.MeshLambertMaterial({color:0x1a1008});
    var forgeDarkM=new THREE.MeshLambertMaterial({color:0x120804});
    var anvilM=new THREE.MeshLambertMaterial({color:0x3a3a3a});
    var emberM=new THREE.MeshLambertMaterial({color:0xff6600,transparent:true,opacity:.8});
    /* 벽 잔해 */
    /* 앞벽 */
    var fwall=new THREE.Mesh(new THREE.BoxGeometry(6,.8,.6),forgeWallM);
    fwall.position.set(0,.4,0);fwall.castShadow=true;fwall.receiveShadow=true;g.add(fwall);
    /* 뒷벽 */
    var bwall=new THREE.Mesh(new THREE.BoxGeometry(6,3.5,.6),forgeWallM);
    bwall.position.set(0,1.75,-3.0);bwall.castShadow=true;bwall.receiveShadow=true;g.add(bwall);
    /* 왼쪽 벽 */
    var lwall=new THREE.Mesh(new THREE.BoxGeometry(.6,3.5,6),forgeWallM);
    lwall.position.set(-3.05,1.75,0);lwall.castShadow=true;lwall.receiveShadow=true;g.add(lwall);
    /* 오른쪽 벽 */
    var rwall=new THREE.Mesh(new THREE.BoxGeometry(.6,3.5,6),forgeWallM);
    rwall.position.set(3.05,1.75,0);rwall.castShadow=true;rwall.receiveShadow=true;g.add(rwall);
    /* 부서진 지붕 */
    var roofSlab=new THREE.Mesh(new THREE.BoxGeometry(5,.35,2.5),forgeDarkM);
    roofSlab.position.set(1.5,4.2,1);roofSlab.rotation.z=-.25;roofSlab.castShadow=true;g.add(roofSlab);
    /* 모루 */
    var anvilBase=new THREE.Mesh(new THREE.BoxGeometry(1.0,.6,.6),anvilM);
    anvilBase.position.set(.5,.3,0);anvilBase.castShadow=true;anvilBase.receiveShadow=true;g.add(anvilBase);
    var anvilTop=new THREE.Mesh(new THREE.BoxGeometry(1.2,.3,.5),anvilM);
    anvilTop.position.set(.5,.75,0);anvilTop.castShadow=true;g.add(anvilTop);
    /* 불 구덩이 */
    var firePit=new THREE.Mesh(new THREE.CylinderGeometry(.7,.8,.4,8),forgeDarkM);
    firePit.position.set(-1.5,.2,0);firePit.castShadow=true;g.add(firePit);
    var ember=new THREE.Mesh(new THREE.CylinderGeometry(.5,.5,.15,8),emberM);
    ember.position.set(-1.5,.42,0);g.add(ember);
    var forgeL=new THREE.PointLight(0xff5500,1.2,10);forgeL.position.set(-1.5,1.5,0);g.add(forgeL);
    /* 도구들 */
    var hammerHandleM=new THREE.MeshLambertMaterial({color:0x3a2010});
    var hammerHead=new THREE.Mesh(new THREE.BoxGeometry(.4,.25,.25),anvilM);
    hammerHead.position.set(2,.3,.5);hammerHead.rotation.z=.5;g.add(hammerHead);
    var hammerHandle=new THREE.Mesh(new THREE.CylinderGeometry(.04,.06,.7,5),hammerHandleM);
    hammerHandle.position.set(2.3,.15,.5);hammerHandle.rotation.z=.5+Math.PI/2;g.add(hammerHandle);
    var _fgx=VCX-80,_fgz=VCZ+30;
    g.position.set(_fgx,getTerrainY(_fgx,_fgz),_fgz);g.rotation.y=.4;scene.add(g);
  })();

  /* ── 어두운 석조 아치웨이 ── */
  (function(){
    var darkArchM=new THREE.MeshLambertMaterial({color:0x1a1008});
    var darkArchDkM=new THREE.MeshLambertMaterial({color:0x0e0804});
    [[VCX-20,VCZ-50],[VCX+40,VCZ+40],[VCX-50,VCZ+100]].forEach(function(ap,ai){
      var g=new THREE.Group();
      /* 기둥 */
      [-2,2].forEach(function(px2){
        var pillar=new THREE.Mesh(new THREE.BoxGeometry(1,5.5,.8),darkArchM);
        pillar.position.set(px2,2.75,0);pillar.castShadow=true;pillar.receiveShadow=true;g.add(pillar);
        /* 용암 문양 */
        var rune=new THREE.Mesh(new THREE.BoxGeometry(.2,.8,.1),
          new THREE.MeshLambertMaterial({color:0xff2200,emissive:new THREE.Color(0xff1100),emissiveIntensity:.8}));
        rune.position.set(px2,2.5,.45);g.add(rune);
      });
      /* 인방 */
      var lintel=new THREE.Mesh(new THREE.BoxGeometry(5,.65,.8),darkArchDkM);
      lintel.position.set(0,5.5,0);lintel.castShadow=true;g.add(lintel);
      /* 아치 */
      var arch2=new THREE.Mesh(new THREE.TorusGeometry(1.5,.3,7,12,Math.PI),darkArchDkM);
      arch2.position.set(0,5.5,0);arch2.rotation.z=Math.PI;g.add(arch2);
      /* 용암 조명 */
      var archL=new THREE.PointLight(0xff3300,.5,12);archL.position.set(0,3,0);g.add(archL);
      g.position.set(ap[0],getTerrainY(ap[0],ap[1]),ap[1]);g.rotation.y=ai*.2;scene.add(g);
    });
  })();

  /* ── 뼈 더미 (추가) ── */
  (function(){
    var pileBoneM=new THREE.MeshLambertMaterial({color:0xc0b8a0});
    [[VCX-60,VCZ-30],[VCX+30,VCZ+30],[VCX-30,VCZ+80],[VCX+60,VCZ+100]].forEach(function(bp){
      /* 뼈 더미 */
      for(var bi=0;bi<5;bi++){
        var blen=.3+Math.random()*.5;
        var bone=new THREE.Mesh(new THREE.CylinderGeometry(.04,.07,blen,5),pileBoneM);
        bone.rotation.z=Math.random()*Math.PI;bone.rotation.y=Math.random()*Math.PI;
        bone.position.set(bp[0]+(Math.random()-.5)*.9,.07,bp[1]+(Math.random()-.5)*.9);
        bone.castShadow=true;scene.add(bone);
      }
      /* 두개골 */
      var skull2=new THREE.Mesh(new THREE.SphereGeometry(.2,7,6),pileBoneM);
      skull2.position.set(bp[0],.2,bp[1]);skull2.castShadow=true;scene.add(skull2);
      /* 눈구멍 */
      var eh=new THREE.MeshLambertMaterial({color:0x1a0a00});
      [-.08,.08].forEach(function(ex){
        var eye2=new THREE.Mesh(new THREE.SphereGeometry(.06,5,4),eh);
        eye2.position.set(bp[0]+ex,.22,bp[1]+.16);scene.add(eye2);
      });
    });
  })();

  /* ── 악마 동상 ── */
  (function(){
    var demonStatueM=new THREE.MeshLambertMaterial({color:0x1a1008});
    var demonEyeM=new THREE.MeshPhongMaterial({color:0xff0000,shininess:100,emissive:new THREE.Color(0x880000),emissiveIntensity:.8});
    [[VCX+70,VCZ-50],[VCX-60,VCZ+40],[VCX,VCZ+80]].forEach(function(sp){
      var g=new THREE.Group();
      /* 기단 */
      var ped=new THREE.Mesh(new THREE.BoxGeometry(2,1,2),demonStatueM);
      ped.position.set(0,.5,0);ped.castShadow=true;ped.receiveShadow=true;g.add(ped);
      /* 다리 */
      [-.3,.3].forEach(function(lx){
        var leg=new THREE.Mesh(new THREE.BoxGeometry(.3,1.5,.3),demonStatueM);
        leg.position.set(lx,1.75,0);leg.castShadow=true;g.add(leg);
      });
      /* 몸통 */
      var body2=new THREE.Mesh(new THREE.BoxGeometry(.8,1.8,.5),demonStatueM);
      body2.position.set(0,3,0);body2.castShadow=true;g.add(body2);
      /* 날개 */
      [-.7,.7].forEach(function(wx){
        var wing=new THREE.Mesh(new THREE.BoxGeometry(.12,1.4,.7),demonStatueM);
        wing.position.set(wx,3.2,-.2);wing.rotation.z=wx>0?.5:-.5;wing.castShadow=true;g.add(wing);
      });
      /* 머리 */
      var head2=new THREE.Mesh(new THREE.BoxGeometry(.6,.7,.55),demonStatueM);
      head2.position.set(0,4.25,0);head2.castShadow=true;g.add(head2);
      /* 뿔 */
      [-.2,.2].forEach(function(hx){
        var horn2=new THREE.Mesh(new THREE.ConeGeometry(.08,.55,4),demonStatueM);
        horn2.position.set(hx,4.75,0);horn2.castShadow=true;g.add(horn2);
      });
      /* 발광 눈 */
      [-.12,.12].forEach(function(ex){
        var eye=new THREE.Mesh(new THREE.SphereGeometry(.07,6,5),demonEyeM);
        eye.position.set(ex,4.3,.28);g.add(eye);
      });
      /* 점광 */
      var dL=new THREE.PointLight(0x880000,.6,10);dL.position.set(0,4.5,0);g.add(dL);
      g.position.set(sp[0],getTerrainY(sp[0],sp[1]),sp[1]);g.rotation.y=(Math.random()-.5)*.5;scene.add(g);
    });
  })();

  /* ── 화산 추가 바위/볼더 산재 ── */
  (function(){
    var volcRockM=new THREE.MeshLambertMaterial({color:0x1a0a04});
    [[VCX+50,VCZ-50,1.2],[VCX-80,VCZ-30,1.5],[VCX+20,VCZ+10,1.1],[VCX+90,VCZ+30,1.8],
     [VCX-60,VCZ+50,1.3],[VCX+40,VCZ+70,1.0],[VCX+90,VCZ+90,1.6],[VCX-50,VCZ+100,1.4],
     [VCX-20,VCZ-40,1.2],[VCX+70,VCZ+50,1.3],[VCX,VCZ+100,1.7],[VCX-90,VCZ+20,1.1]
    ].forEach(function(rd){
      var rk=new THREE.Mesh(new THREE.SphereGeometry(rd[2],6,5),volcRockM);
      rk.scale.set(1+Math.random()*.5,.7+Math.random()*.4,1+Math.random()*.5);
      rk.position.set(rd[0],rd[2]*.4,rd[1]);
      rk.rotation.y=Math.random()*Math.PI;
      rk.castShadow=true;rk.receiveShadow=true;scene.add(rk);
    });
  })();
}

/* ════════════ 보스 구역 장식 ════════════ */
/* 보스 (S center): x:-80~80, z:500~600 — 중심 (0,550) */
function buildBossDecor(){
  var BX=0,BZ=550; /* 보스 중심 */
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
    var pz=BZ+Math.sin(pang)*PILLAR_RADIUS;
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
    ritCircle.rotation.x=-Math.PI/2;ritCircle.position.set(BX,.022,BZ);
    ritCircle.receiveShadow=true;scene.add(ritCircle);
    /* 방사형 선 4개 */
    for(var ri=0;ri<4;ri++){
      var ra=ri/4*Math.PI*2;
      var rline=new THREE.Mesh(new THREE.PlaneGeometry(.15,10.5),ritualLineM);
      rline.rotation.x=-Math.PI/2;rline.rotation.z=ra;
      rline.position.set(Math.cos(ra)*3.5,.025,BZ+Math.sin(ra)*3.5);
      scene.add(rline);
    }
    /* 내부 원 */
    var innerCircle=new THREE.Mesh(new THREE.CircleGeometry(5,24),ritualLineM);
    innerCircle.rotation.x=-Math.PI/2;innerCircle.position.set(BX,.024,BZ);scene.add(innerCircle);
    var innerCircle2=new THREE.Mesh(new THREE.CircleGeometry(2.5,16),ritualM);
    innerCircle2.rotation.x=-Math.PI/2;innerCircle2.position.set(BX,.025,BZ);scene.add(innerCircle2);
    /* 사각형 내부 무늬 */
    var sqM=new THREE.MeshLambertMaterial({color:0x1a0a0a});
    var sq=new THREE.Mesh(new THREE.PlaneGeometry(4,4),sqM);
    sq.rotation.x=-Math.PI/2;sq.rotation.z=Math.PI/4;sq.position.set(BX,.026,BZ);scene.add(sq);
    /* 삼각형 꼭짓점 불꽃 마커 */
    var markerM=new THREE.MeshLambertMaterial({color:0x2a0808});
    for(var mi=0;mi<3;mi++){
      var ma=mi/3*Math.PI*2;
      var marker=new THREE.Mesh(new THREE.CylinderGeometry(.2,.25,.12,5),markerM);
      marker.position.set(Math.cos(ma)*4.5,.06,BZ+Math.sin(ma)*4.5);
      marker.castShadow=true;scene.add(marker);
    }
    /* 제단 주변 불빛 (붉은) */
    var ritL=new THREE.PointLight(0x660000,.8,25);ritL.position.set(BX,2,BZ);scene.add(ritL);
  })();

  /* ── 바닥에 박힌 부러진 무기들 ── */
  (function(){
    var weaponDefs=[
      [BX-5,BZ-7,'sword'],[BX+3,BZ+7,'axe'],[BX+7,BZ-5,'spear'],[BX-3,BZ+15,'sword']
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
      g.position.set(wd[0],getTerrainY(wd[0],wd[1]),wd[1]);scene.add(g);
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
    g.position.set(BX,getTerrainY(BX,BZ-12),BZ-12);scene.add(g);
  })();

  /* ── 어두운 수정 군집 ── */
  [[BX-10,BZ-7,1.0],[BX+9,BZ+10,.9],[BX-4,BZ+23,1.1],[BX+18,BZ-15,.8]
  ].forEach(function(cd){
    var cry=new THREE.Mesh(new THREE.ConeGeometry(cd[2]*.3,cd[2]*1.6,5),darkCrystalM);
    cry.rotation.z=(Math.random()-.5)*.3;cry.rotation.y=Math.random()*Math.PI;
    cry.position.set(cd[0],cd[2]*.5,cd[1]);cry.castShadow=true;scene.add(cry);
  });

  /* ── 찢어진 배너들 ── */
  [[BX-10,BZ-11,.3],[BX+10,BZ-5,-.3],[BX-6,BZ+15,.1],[BX+6,BZ+9,-.1]
  ].forEach(function(bd){
    var g=new THREE.Group();
    var bpole=new THREE.Mesh(new THREE.CylinderGeometry(.06,.08,4.5,6),ominousM);
    bpole.position.set(0,2.25,0);bpole.castShadow=true;g.add(bpole);
    var bcloth=new THREE.Mesh(new THREE.BoxGeometry(.6,1.0,.05),bannerBM);
    bcloth.position.set(.35,3.5,0);g.add(bcloth);
    g.position.set(bd[0],getTerrainY(bd[0],bd[1]),bd[1]);g.rotation.y=bd[2];scene.add(g);
  });

  /* ── 보스 구역 분위기 조명 ── */
  var bossL1=new THREE.PointLight(0x440000,.8,60);bossL1.position.set(BX,5,BZ);scene.add(bossL1);
  var bossL2=new THREE.PointLight(0x330000,.5,50);bossL2.position.set(BX,4,BZ+20);scene.add(bossL2);
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
