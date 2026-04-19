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
var fadeOverlay=null;
function initFadeOverlay(){fadeOverlay=document.getElementById('fade-overlay');}
var BUILDING_DOORS=[]; /* [{x,z,name,interiorY,exitX,exitZ}] */
var insideBuilding=null; /* 현재 들어가있는 건물 이름 */
var _savedOutdoorPos={x:0,z:0}; /* 나갈 때 복귀 위치 */
var _interiorBuilt={}; /* 이미 내부를 빌드했는지 */
var _doorCooldown=0; /* 입장/퇴장 쿨다운 */

function registerDoor(x,z,name){
  BUILDING_DOORS.push({x:x,z:z,name:name,interiorY:-500-(BUILDING_DOORS.length*200)});
}

var nearestDoor=null;
function checkBuildingDoors(){
  if(!PL||!PL.group||typeof fadeOverlay==='undefined')return;
  if(_doorCooldown>0){_doorCooldown--;return;}
  var px=PL.group.position.x,pz=PL.group.position.z;
  /* 건물 내부에 있을 때 — 나가기 힌트 */
  if(insideBuilding){
    var bh=document.getElementById('building-hint');
    if(bh){
      var _exitThresh=(insideBuilding==='모험가 길드')?12:8;
      if(Math.abs(px)<3&&pz>_exitThresh){
        bh.style.display='block';
        bh.textContent='E — 나가기';
      }else{
        bh.style.display='none';
      }
    }
    return;
  }
  /* 밖에서 — 가장 가까운 문 찾기 (반경 8 이내) */
  nearestDoor=null;
  for(var i=0;i<BUILDING_DOORS.length;i++){
    var d=BUILDING_DOORS[i];
    var dx=px-d.x,dz=pz-d.z;
    if(dx*dx+dz*dz<64){/* 반경 8 이내 */
      nearestDoor=d;
      break;
    }
  }
  /* 건물 입장 힌트 표시/숨김 */
  var bh=document.getElementById('building-hint');
  if(bh){
    if(nearestDoor&&!insideBuilding){
      bh.style.display='block';
      bh.textContent='E — '+nearestDoor.name+' 입장';
    }else{
      bh.style.display='none';
    }
  }
}

/* E키로 건물 입장 — main.js의 키 핸들러에서 호출 */
function tryEnterBuilding(){
  if(nearestDoor&&!insideBuilding){
    enterBuilding(nearestDoor);
    return true;
  }
  return false;
}

function enterBuilding(door){
  if(typeof SFX!=='undefined')SFX.doorEnter();
  insideBuilding=door.name;
  _savedOutdoorPos.x=PL.group.position.x;
  _savedOutdoorPos.z=PL.group.position.z;
  _doorCooldown=60;/* 1초 쿨다운 */
  /* 힌트 즉시 숨기기 */
  var bh=document.getElementById('building-hint');
  if(bh)bh.style.display='none';
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
    /* 카메라 즉시 이동 */
    camera.position.set(0,door.interiorY+25,5);
    camera.lookAt(0,door.interiorY+1,0);
    /* 실내: 안개+그림자 끄기, 배경 검은색, 하늘 숨기기 */
    scene.fog=null;
    renderer.shadowMap.enabled=false;
    renderer.setClearColor(0x000000);
    if(window._skyMesh)window._skyMesh.visible=false;
    addChat('sys','[시스템]',door.name+'에 입장했습니다.');
    /* 페이드인 */
    setTimeout(function(){fadeOverlay.style.opacity='0';},200);
  },600);
}

function exitBuilding(){
  if(!insideBuilding)return;
  if(typeof SFX!=='undefined')SFX.doorExit();
  _doorCooldown=60;/* 1초 쿨다운 */
  fadeOverlay.style.opacity='1';
  fadeOverlay.style.background='#000';
  setTimeout(function(){
    var oy=(typeof getTerrainY==='function')?getTerrainY(_savedOutdoorPos.x,_savedOutdoorPos.z):0;
    PL.group.position.set(_savedOutdoorPos.x,oy,_savedOutdoorPos.z);
    /* 카메라 즉시 복귀 */
    camera.position.set(_savedOutdoorPos.x,oy+12,_savedOutdoorPos.z+10);
    camera.lookAt(_savedOutdoorPos.x,oy+1,_savedOutdoorPos.z);
    /* 안개+그림자+배경+하늘 복원 — daynight.js가 있으면 다음 틱에 갱신됨 */
    var _fogRestoreColor=(typeof gamePhase!=='undefined'&&gamePhase==='night')?0x030510:0xa8d8ea;
    var _fogRestoreDensity=(typeof gamePhase!=='undefined'&&gamePhase==='night')?0.0025:0.0015;
    scene.fog=new THREE.FogExp2(_fogRestoreColor,_fogRestoreDensity);
    renderer.shadowMap.enabled=true;
    renderer.shadowMap.needsUpdate=true;
    renderer.setClearColor(0x000000,0);
    if(window._skyMesh)window._skyMesh.visible=true;
    addChat('sys','[시스템]','밖으로 나왔습니다.');
    insideBuilding=null;
    setTimeout(function(){fadeOverlay.style.opacity='0';},200);
  },600);
}

/* 실내 NPC 생성 헬퍼 */
function mkInteriorNpc(nx,nz,baseY,bodyColor,npcName){
  var g=new THREE.Group();
  /* 몸 */
  var body=new THREE.Mesh(new THREE.BoxGeometry(.8,1.2,.5),new THREE.MeshLambertMaterial({color:bodyColor}));
  body.position.y=.6;g.add(body);
  /* 머리 */
  var head=new THREE.Mesh(new THREE.BoxGeometry(.6,.6,.6),new THREE.MeshLambertMaterial({color:0xf5d4a0}));
  head.position.y=1.5;g.add(head);
  g.position.set(nx,baseY+1,nz);
  scene.add(g);
  /* 이름표 */
  var lov=document.getElementById('lov')||document.getElementById('cc');
  var label=document.createElement('div');
  label.className='nlabel';
  label.textContent=npcName;
  label.style.color='#ffcc44';
  label.style.fontSize='11px';
  label.style.display='none';
  lov.appendChild(label);
  /* E 대화 표시 */
  var ie=document.createElement('div');
  ie.className='linteract';ie.textContent='E 대화';ie.style.display='none';
  lov.appendChild(ie);
  /* npcs 배열에 등록 — chkNpc()가 감지할 수 있도록 */
  var npcObj={mesh:g,name:npcName,label:label,interact:ie,bobOff:Math.random()*6};
  npcs.push(npcObj);
  /* NPC_AI에 등록 (AI 대화 가능) */
  if(typeof NPC_AI!=='undefined'&&!NPC_AI[npcName]){
    NPC_AI[npcName]={
      system:'너는 '+npcName+'이다. 포톤 RPG 세계관의 NPC이다. 친절하고 캐릭터에 맞게 대화하라. 짧게 답하라.',
      history:[]
    };
  }
  /* 라벨 업데이트용 저장 */
  if(!window._interiorNpcs)window._interiorNpcs=[];
  window._interiorNpcs.push({group:g,label:label,interact:ie,baseY:baseY,npcObj:npcObj});
  return g;
}

function buildInterior(name,baseY){
  var W=(name==='모험가 길드')?30:20;
  var D=(name==='모험가 길드')?30:20;
  var H=6;
  /* ── 바닥 (단일 평면) ── */
  var floorM=new THREE.MeshLambertMaterial({color:0xb08858});
  var floor=new THREE.Mesh(new THREE.PlaneGeometry(W,D),floorM);
  floor.rotation.x=-Math.PI/2;floor.position.set(0,baseY,0);scene.add(floor);
  /* ── 벽 (두꺼운 박스) ── */
  var wallM=new THREE.MeshLambertMaterial({color:0xd4c4a0});
  var wallDarkM=new THREE.MeshLambertMaterial({color:0x8a7a5a});
  var wallThk=.4;
  /* 북 */var wN=new THREE.Mesh(new THREE.BoxGeometry(W,H,wallThk),wallM);wN.position.set(0,baseY+H/2,-D/2);scene.add(wN);
  /* 남 (문 구멍 — 왼쪽+오른쪽 나눠서) */
  var wSL=new THREE.Mesh(new THREE.BoxGeometry(W/2-1.5,H,wallThk),wallM);wSL.position.set(-W/4-.75,baseY+H/2,D/2);scene.add(wSL);
  var wSR=new THREE.Mesh(new THREE.BoxGeometry(W/2-1.5,H,wallThk),wallM);wSR.position.set(W/4+.75,baseY+H/2,D/2);scene.add(wSR);
  var wST=new THREE.Mesh(new THREE.BoxGeometry(3,H-3,wallThk),wallM);wST.position.set(0,baseY+H-1.5,D/2);scene.add(wST);
  /* 동서 */
  var wE=new THREE.Mesh(new THREE.BoxGeometry(wallThk,H,D),wallM);wE.position.set(W/2,baseY+H/2,0);scene.add(wE);
  var wW=new THREE.Mesh(new THREE.BoxGeometry(wallThk,H,D),wallM);wW.position.set(-W/2,baseY+H/2,0);scene.add(wW);
  /* 벽 하단 띠 */
  var trimM=new THREE.MeshLambertMaterial({color:0x6a5a3a});
  [[-D/2],[D/2]].forEach(function(zz){
    var trim=new THREE.Mesh(new THREE.BoxGeometry(W,.3,wallThk+.1),trimM);trim.position.set(0,baseY+.15,zz[0]);scene.add(trim);
  });
  /* ── 천장 ── */
  var ceilM=new THREE.MeshLambertMaterial({color:0x7a6a4a});
  var ceil=new THREE.Mesh(new THREE.PlaneGeometry(W,D),ceilM);
  ceil.rotation.x=Math.PI/2;ceil.position.set(0,baseY+H,0);scene.add(ceil);
  /* ── 조명 (밝고 따뜻한) ── */
  var mainLight=new THREE.PointLight(0xffcc88,1.5,30);mainLight.position.set(0,baseY+H-.5,0);scene.add(mainLight);
  /* ── 나가기 매트 ── */
  var exitM=new THREE.MeshLambertMaterial({color:0xcc3333});
  var exitMat=new THREE.Mesh(new THREE.PlaneGeometry(2.5,1.5),exitM);
  exitMat.rotation.x=-Math.PI/2;exitMat.position.set(0,baseY+.02,D/2-1);scene.add(exitMat);
  /* ── 공통 재질 ── */
  var woodM=new THREE.MeshLambertMaterial({color:0x6a4a2a});
  var darkWoodM=new THREE.MeshLambertMaterial({color:0x4a3018});
  var stoneM=new THREE.MeshLambertMaterial({color:0x666666});
  var metalM=new THREE.MeshLambertMaterial({color:0xbbbbbb});
  var darkMetalM=new THREE.MeshLambertMaterial({color:0x444444});
  var candleWaxM=new THREE.MeshLambertMaterial({color:0xeeeeaa});
  var frameM=new THREE.MeshLambertMaterial({color:0x3a2808});

  /* ── 공통 헬퍼: 창문 장식 (벽에 밝은 사각형) ── */
  function addWindowDecor(wx,wy,wz,rotY){
    var winFrameM=new THREE.MeshLambertMaterial({color:0x5a3a10});
    var winFrame=new THREE.Mesh(new THREE.BoxGeometry(2.4,1.8,.08),winFrameM);
    winFrame.rotation.y=rotY||0;winFrame.position.set(wx,wy,wz);scene.add(winFrame);
    var winGlassM=new THREE.MeshLambertMaterial({color:0xaaddff,transparent:true,opacity:.5});
    var winGlass=new THREE.Mesh(new THREE.PlaneGeometry(2,1.4),winGlassM);
    winGlass.rotation.y=rotY||0;winGlass.position.set(wx,wy,wz+(rotY?0:.05));scene.add(winGlass);
  }
  /* ── 공통 헬퍼: 양초 (PointLight 제거 — 성능 최적화) ── */
  function addCandle(cx,cy,cz,intensity){
    var cstick=new THREE.Mesh(new THREE.CylinderGeometry(.05,.06,.4,6),candleWaxM);cstick.position.set(cx,cy+.2,cz);scene.add(cstick);
    var cflame=new THREE.Mesh(new THREE.SphereGeometry(.06,6,6),new THREE.MeshLambertMaterial({color:0xff9900,emissive:0xff6600,emissiveIntensity:.8}));cflame.position.set(cx,cy+.45,cz);scene.add(cflame);
  }
  /* ── 공통 헬퍼: 책장 (책 포함) ── */
  var _bookColors=[0xcc2222,0x2244cc,0x22aa44,0xccaa22,0x8822aa,0xcc6622,0x228888,0xdd4466,0x445533];
  function addBookshelf(bsx,bsy,bsz,rotY){
    var shelfM=new THREE.MeshLambertMaterial({color:0x5a3a18});
    var shelfBox=new THREE.Mesh(new THREE.BoxGeometry(3,4.5,.5),shelfM);
    shelfBox.rotation.y=rotY||0;shelfBox.position.set(bsx,bsy+2.25,bsz);scene.add(shelfBox);
    /* 선반 3단, 각 단 책 5권 */
    for(var row=0;row<3;row++){
      for(var col=0;col<5;col++){
        var bh=.55+Math.random()*.3;
        var bw=.28+Math.random()*.08;
        var bkM=new THREE.MeshLambertMaterial({color:_bookColors[(row*5+col)%_bookColors.length]});
        var bkMesh=new THREE.Mesh(new THREE.BoxGeometry(bw,bh,.38),bkM);
        var offX=(col-.5)*bw*1.15+(Math.random()-.5)*.05;
        var offY=row*1.4+bh/2+.15;
        if(rotY){
          bkMesh.rotation.y=rotY;
          bkMesh.position.set(bsx+Math.cos(rotY)*offX,bsy+offY,bsz+Math.sin(rotY)*offX);
        }else{
          bkMesh.position.set(bsx+offX-(col-.5)*.02,bsy+offY,bsz);
        }
        scene.add(bkMesh);
      }
    }
  }
  /* ── 공통 헬퍼: 그림 (프레임 + 캔버스) ── */
  function addPainting(px,py,pz,rotY,color){
    var frame=new THREE.Mesh(new THREE.BoxGeometry(2.2,1.6,.08),frameM);
    frame.rotation.y=rotY||0;frame.position.set(px,py,pz);scene.add(frame);
    var canvasM=new THREE.MeshLambertMaterial({color:color||0x8899aa});
    var canvas=new THREE.Mesh(new THREE.PlaneGeometry(1.8,1.2),canvasM);
    canvas.rotation.y=rotY||0;canvas.position.set(px,py,pz+(rotY?0:.05));scene.add(canvas);
  }
  /* ── 공통 헬퍼: 의자 ── */
  function addChair(cx,cy,cz,rotY){
    var seat=new THREE.Mesh(new THREE.BoxGeometry(.75,.08,.7),woodM);
    seat.rotation.y=rotY||0;seat.position.set(cx,cy+.55,cz);scene.add(seat);
    var back=new THREE.Mesh(new THREE.BoxGeometry(.75,.65,.07),woodM);
    back.rotation.y=rotY||0;
    back.position.set(cx,cy+.92,cz+(rotY?Math.sin(rotY+Math.PI/2)*.32:-0.32));scene.add(back);
    /* 다리 4개 */
    [-.3,.3].forEach(function(ox){[-.28,.28].forEach(function(oz){
      var leg=new THREE.Mesh(new THREE.BoxGeometry(.07,.55,.07),darkWoodM);leg.position.set(cx+ox,cy+.27,cz+oz);scene.add(leg);
    });});
  }

  if(name==='여관'){
    /* ── 카펫 (중앙) ── */
    var carpetM=new THREE.MeshLambertMaterial({color:0x883322});
    var carpet=new THREE.Mesh(new THREE.PlaneGeometry(10,8),carpetM);carpet.rotation.x=-Math.PI/2;carpet.position.set(1,baseY+.01,0);scene.add(carpet);
    /* ── 환영 매트 (입구) ── */
    var welcomeM=new THREE.MeshLambertMaterial({color:0x446622});
    var welcomeMat=new THREE.Mesh(new THREE.PlaneGeometry(2.2,1.2),welcomeM);welcomeMat.rotation.x=-Math.PI/2;welcomeMat.position.set(0,baseY+.015,D/2-2);scene.add(welcomeMat);
    /* ── 침대 2개 (왼쪽 벽) ── */
    var bedM=new THREE.MeshLambertMaterial({color:0x7a4420});
    var blanketColors=[0xcc4444,0x4444cc];
    for(var bi=0;bi<2;bi++){
      var bz=-5+bi*7;
      var frame=new THREE.Mesh(new THREE.BoxGeometry(3,.5,4),bedM);frame.position.set(-7.5,baseY+.25,bz);scene.add(frame);
      /* 헤드보드 */
      var headboard=new THREE.Mesh(new THREE.BoxGeometry(3,.9,.15),bedM);headboard.position.set(-7.5,baseY+.85,bz-2);scene.add(headboard);
      var mattress=new THREE.Mesh(new THREE.BoxGeometry(2.6,.18,3.6),new THREE.MeshLambertMaterial({color:0xeeeecc}));mattress.position.set(-7.5,baseY+.59,bz);scene.add(mattress);
      var blanket=new THREE.Mesh(new THREE.BoxGeometry(2.4,.09,2.6),new THREE.MeshLambertMaterial({color:blanketColors[bi]}));blanket.position.set(-7.5,baseY+.69,bz+.4);scene.add(blanket);
      var pillow=new THREE.Mesh(new THREE.BoxGeometry(1.5,.18,.65),new THREE.MeshLambertMaterial({color:0xffffff}));pillow.position.set(-7.5,baseY+.75,bz-1.55);scene.add(pillow);
      /* 침대 옆 작은 테이블 */
      var nightstand=new THREE.Mesh(new THREE.BoxGeometry(.8,.6,.8),woodM);nightstand.position.set(-6.2,baseY+.3,bz);scene.add(nightstand);
      addCandle(-6.2,baseY+.6,bz,.35);
    }
    /* ── 벽난로 (북쪽 벽 중앙) ── */
    var fpBase=new THREE.Mesh(new THREE.BoxGeometry(3.5,3.8,.6),stoneM);fpBase.position.set(0,baseY+1.9,-9.7);scene.add(fpBase);
    var fpOpening=new THREE.Mesh(new THREE.BoxGeometry(2.2,1.8,.65),new THREE.MeshLambertMaterial({color:0x111111}));fpOpening.position.set(0,baseY+1.1,-9.7);scene.add(fpOpening);
    var fpMantel=new THREE.Mesh(new THREE.BoxGeometry(4,.18,1),darkWoodM);fpMantel.position.set(0,baseY+3.3,-9.5);scene.add(fpMantel);
    /* 불꽃 */
    var fireGlowM=new THREE.MeshLambertMaterial({color:0xff6600,emissive:0xff3300,emissiveIntensity:.7});
    var fireGlow=new THREE.Mesh(new THREE.BoxGeometry(1.6,.6,.3),fireGlowM);fireGlow.position.set(0,baseY+1,-9.6);scene.add(fireGlow);
    var fireLight=new THREE.PointLight(0xff6622,1.2,12);fireLight.position.set(0,baseY+1.5,-8.8);scene.add(fireLight);
    /* 벽난로 앞 의자 2개 */
    addChair(-1.5,baseY,-7.5,0);
    addChair(1.5,baseY,-7.5,0);
    /* ── 리셉션 카운터 (오른쪽 북쪽 코너) ── */
    var counter=new THREE.Mesh(new THREE.BoxGeometry(7,1.1,2),woodM);counter.position.set(5.5,baseY+.55,-7);scene.add(counter);
    var counterTop=new THREE.Mesh(new THREE.BoxGeometry(7.2,.1,2.2),darkWoodM);counterTop.position.set(5.5,baseY+1.15,-7);scene.add(counterTop);
    /* 카운터 위 벨 (작은 반구) */
    var bellM=new THREE.MeshLambertMaterial({color:0xddaa22});
    var bell=new THREE.Mesh(new THREE.SphereGeometry(.18,8,4,0,Math.PI*2,0,Math.PI/2),bellM);bell.position.set(3.5,baseY+1.22,-7);scene.add(bell);
    var bellHandle=new THREE.Mesh(new THREE.CylinderGeometry(.03,.03,.15,6),bellM);bellHandle.position.set(3.5,baseY+1.35,-7);scene.add(bellHandle);
    /* 카운터 위 장부/잉크 */
    var ledgerM=new THREE.MeshLambertMaterial({color:0x334422});
    var ledger=new THREE.Mesh(new THREE.BoxGeometry(.9,.05,.7),ledgerM);ledger.position.set(5.5,baseY+1.22,-7);scene.add(ledger);
    /* ── 식사 테이블 + 의자 (중앙 오른쪽) ── */
    var table=new THREE.Mesh(new THREE.BoxGeometry(3.5,.1,2.5),woodM);table.position.set(5,baseY+1,2);scene.add(table);
    /* 테이블 다리 */
    [[4,2.4,1],[6,2.4,1],[4,2.4,3],[6,2.4,3]].forEach(function(lp){
      var leg=new THREE.Mesh(new THREE.BoxGeometry(.12,1,.12),darkWoodM);leg.position.set(lp[0]-1,baseY+.5,lp[1]);scene.add(leg);
    });
    /* 의자 3개 */
    addChair(3.5,baseY,1.2,0);addChair(6.5,baseY,1.2,0);addChair(5,baseY,3.2,Math.PI);
    /* 테이블 위 컵+접시 */
    var plateM=new THREE.MeshLambertMaterial({color:0xddddcc});
    [4,5,6].forEach(function(px){
      var plate=new THREE.Mesh(new THREE.CylinderGeometry(.28,.28,.04,10),plateM);plate.position.set(px,baseY+1.07,2);scene.add(plate);
      var cup=new THREE.Mesh(new THREE.CylinderGeometry(.09,.1,.22,8),plateM);cup.position.set(px,baseY+1.19,2.6);scene.add(cup);
    });
    /* ── 책장 (왼쪽 아래 코너) ── */
    addBookshelf(-8,baseY,6);
    /* ── 벽 그림 ── */
    addPainting(6,baseY+3.2,-9.75,0,0x7799aa);
    addPainting(-5,baseY+3.2,-9.75,0,0xaa7755);
    /* ── 창문 장식 ── */
    addWindowDecor(9.7,baseY+3.5,-3,Math.PI/2);
    addWindowDecor(-9.7,baseY+3.5,-3,-Math.PI/2);
    /* ── 벽 촛대 ── */
    addCandle(9.3,baseY+2.5,3,.4);addCandle(-9.3,baseY+2.5,3,.4);
    addCandle(9.3,baseY+2.5,-5,.4);
    /* ── 여관 주인 NPC ── */
    mkInteriorNpc(5,-8,baseY,0xaa5533,'(여관주인) 마리아');

  }else if(name==='무기 상점'){
    /* ── 환영 매트 ── */
    var welcomeM=new THREE.MeshLambertMaterial({color:0x553311});
    var welcomeMat=new THREE.Mesh(new THREE.PlaneGeometry(2.2,1.2),welcomeM);welcomeMat.rotation.x=-Math.PI/2;welcomeMat.position.set(0,baseY+.015,D/2-2);scene.add(welcomeMat);
    /* ── 무기 진열대 (북쪽 벽) ── */
    var rackM=new THREE.MeshLambertMaterial({color:0x5a3a1a});
    var rackBack=new THREE.Mesh(new THREE.BoxGeometry(17,4,.3),rackM);rackBack.position.set(0,baseY+2.5,-9.7);scene.add(rackBack);
    /* 가로 막대 2개 */
    var rackRodM=new THREE.MeshLambertMaterial({color:0x4a2a0a});
    var rackRod1=new THREE.Mesh(new THREE.BoxGeometry(17,.15,.15),rackRodM);rackRod1.position.set(0,baseY+3.2,-9.55);scene.add(rackRod1);
    var rackRod2=new THREE.Mesh(new THREE.BoxGeometry(17,.15,.15),rackRodM);rackRod2.position.set(0,baseY+1.8,-9.55);scene.add(rackRod2);
    var hiltM=new THREE.MeshLambertMaterial({color:0x8a6a3a});
    /* 검 7자루 */
    for(var wi=0;wi<7;wi++){
      var wx=-6+wi*2;
      var blade=new THREE.Mesh(new THREE.BoxGeometry(.1,1.9,.07),metalM);blade.position.set(wx,baseY+2.6,-9.55);scene.add(blade);
      var guard=new THREE.Mesh(new THREE.BoxGeometry(.5,.12,.1),hiltM);guard.position.set(wx,baseY+1.65,-9.55);scene.add(guard);
      var hilt=new THREE.Mesh(new THREE.BoxGeometry(.15,.55,.1),hiltM);hilt.position.set(wx,baseY+1.35,-9.55);scene.add(hilt);
    }
    /* ── 갑옷 스탠드 (마네킹) ── */
    var armorM=new THREE.MeshLambertMaterial({color:0x8899aa});
    var mannBase=new THREE.Mesh(new THREE.CylinderGeometry(.25,.35,.6,8),woodM);mannBase.position.set(-6,baseY+.3,-6);scene.add(mannBase);
    var mannPole=new THREE.Mesh(new THREE.CylinderGeometry(.08,.08,1.2,8),darkWoodM);mannPole.position.set(-6,baseY+1.1,-6);scene.add(mannPole);
    var mannTorso=new THREE.Mesh(new THREE.BoxGeometry(.9,1.1,.5),armorM);mannTorso.position.set(-6,baseY+2.05,-6);scene.add(mannTorso);
    var mannHead=new THREE.Mesh(new THREE.SphereGeometry(.3,8,6),armorM);mannHead.position.set(-6,baseY+2.85,-6);scene.add(mannHead);
    var mannArmL=new THREE.Mesh(new THREE.BoxGeometry(.22,.8,.22),armorM);mannArmL.position.set(-6.6,baseY+1.9,-6);scene.add(mannArmL);
    var mannArmR=new THREE.Mesh(new THREE.BoxGeometry(.22,.8,.22),armorM);mannArmR.position.set(-5.4,baseY+1.9,-6);scene.add(mannArmR);
    /* ── 작업대 (앤빌 + 공구) ── */
    var workbench=new THREE.Mesh(new THREE.BoxGeometry(4,1,1.5),woodM);workbench.position.set(6,baseY+.5,-7);scene.add(workbench);
    var wbTop=new THREE.Mesh(new THREE.BoxGeometry(4.1,.1,1.6),darkWoodM);wbTop.position.set(6,baseY+1.05,-7);scene.add(wbTop);
    /* 앤빌 */
    var anvilBase=new THREE.Mesh(new THREE.BoxGeometry(.6,.3,.5),darkMetalM);anvilBase.position.set(6.5,baseY+1.25,-7);scene.add(anvilBase);
    var anvilTop=new THREE.Mesh(new THREE.BoxGeometry(.8,.25,.45),darkMetalM);anvilTop.position.set(6.5,baseY+1.5,-7);scene.add(anvilTop);
    var anvilHorn=new THREE.Mesh(new THREE.BoxGeometry(.4,.15,.2),darkMetalM);anvilHorn.position.set(6.9,baseY+1.5,-7);scene.add(anvilHorn);
    /* 망치 */
    var hammerHandle=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,.7,6),woodM);hammerHandle.rotation.z=Math.PI/6;hammerHandle.position.set(4.8,baseY+1.25,-7);scene.add(hammerHandle);
    var hammerHead=new THREE.Mesh(new THREE.BoxGeometry(.25,.22,.2),darkMetalM);hammerHead.position.set(4.55,baseY+1.52,-7);scene.add(hammerHead);
    /* ── 방패 진열 (서쪽 벽) ── */
    var shieldColors=[0x4466aa,0xaa4422,0x224422];
    for(var shi=0;shi<3;shi++){
      var shieldM=new THREE.MeshLambertMaterial({color:shieldColors[shi]});
      var shield=new THREE.Mesh(new THREE.BoxGeometry(.1,1.4,1.2),shieldM);shield.position.set(-9.7,baseY+2.5,-5+shi*4.5);scene.add(shield);
      /* 방패 테두리 */
      var shBorder=new THREE.Mesh(new THREE.BoxGeometry(.08,1.6,1.4),metalM);shBorder.position.set(-9.65,baseY+2.5,-5+shi*4.5);scene.add(shBorder);
    }
    /* ── 통 + 상자 (코너) ── */
    var barrelM=new THREE.MeshLambertMaterial({color:0x5a3a18});
    var barrel1=new THREE.Mesh(new THREE.CylinderGeometry(.45,.45,.9,10),barrelM);barrel1.position.set(8,baseY+.45,7);scene.add(barrel1);
    var barrel2=new THREE.Mesh(new THREE.CylinderGeometry(.4,.4,.8,10),barrelM);barrel2.position.set(7.1,baseY+.4,8);scene.add(barrel2);
    var crateM=new THREE.MeshLambertMaterial({color:0x6a4a22});
    var crate1=new THREE.Mesh(new THREE.BoxGeometry(.9,.9,.9),crateM);crate1.position.set(9,baseY+.45,7.5);scene.add(crate1);
    /* ── 카운터 ── */
    var wc=new THREE.Mesh(new THREE.BoxGeometry(10,1.1,2),woodM);wc.position.set(0,baseY+.55,6);scene.add(wc);
    var wcTop=new THREE.Mesh(new THREE.BoxGeometry(10.2,.1,2.2),darkWoodM);wcTop.position.set(0,baseY+1.15,6);scene.add(wcTop);
    /* ── 횃불 (동서 벽) ── */
    var torchM=new THREE.MeshLambertMaterial({color:0x6a3a10});
    var torch1=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,.5,6),torchM);torch1.position.set(9.5,baseY+3.5,0);scene.add(torch1);
    var tflame1M=new THREE.MeshLambertMaterial({color:0xff8800,emissive:0xff4400,emissiveIntensity:.9});
    var tflame1=new THREE.Mesh(new THREE.SphereGeometry(.15,6,6),tflame1M);tflame1.position.set(9.5,baseY+3.8,0);scene.add(tflame1);
    /* 무기상점 횃불 라이트 제거 — mainLight로 충분 */
    var torch2=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,.5,6),torchM);torch2.position.set(-9.5,baseY+3.5,0);scene.add(torch2);
    var tflame2=new THREE.Mesh(new THREE.SphereGeometry(.15,6,6),tflame1M);tflame2.position.set(-9.5,baseY+3.8,0);scene.add(tflame2);
    /* ── 창문 장식 ── */
    addWindowDecor(9.7,baseY+3.5,-5,Math.PI/2);
    /* ── 벽 그림 (검 그림) ── */
    addPainting(-6,baseY+3.5,-9.75,0,0x334455);
    /* ── 무기 상인 NPC ── */
    mkInteriorNpc(0,-7,baseY,0x6a4a2a,'(무기상인) 발두르');

  }else if(name==='도서관'){
    /* ── 환영 매트 ── */
    var welcomeM=new THREE.MeshLambertMaterial({color:0x334466});
    var welcomeMat=new THREE.Mesh(new THREE.PlaneGeometry(2.2,1.2),welcomeM);welcomeMat.rotation.x=-Math.PI/2;welcomeMat.position.set(0,baseY+.015,D/2-2);scene.add(welcomeMat);
    /* ── 카펫 ── */
    var carpetM=new THREE.MeshLambertMaterial({color:0x334488});
    var carpet=new THREE.Mesh(new THREE.PlaneGeometry(12,8),carpetM);carpet.rotation.x=-Math.PI/2;carpet.position.set(0,baseY+.01,0);scene.add(carpet);
    /* ── 책장 4개 (북쪽 벽) ── */
    for(var si=0;si<4;si++){
      addBookshelf(-7.5+si*4.8,baseY,-9.3);
    }
    /* ── 책장 (서쪽 벽 2개) ── */
    addBookshelf(-9.3,baseY,-5,Math.PI/2);
    addBookshelf(-9.3,baseY,3,Math.PI/2);
    /* ── 중앙 읽기 테이블 ── */
    var bigTable=new THREE.Mesh(new THREE.BoxGeometry(9,.12,4),woodM);bigTable.position.set(0,baseY+1.2,1);scene.add(bigTable);
    /* 테이블 다리 */
    [[-4,1.2,-1],[-4,1.2,3],[4,1.2,-1],[4,1.2,3]].forEach(function(lp){
      var tleg=new THREE.Mesh(new THREE.BoxGeometry(.14,1.2,.14),darkWoodM);tleg.position.set(lp[0],baseY+.6,lp[2]);scene.add(tleg);
    });
    /* 테이블 위 열린 책들 */
    var openBookM=new THREE.MeshLambertMaterial({color:0xeedd99});
    var openBook1=new THREE.Mesh(new THREE.BoxGeometry(1.2,.04,.9),openBookM);openBook1.position.set(-2,baseY+1.27,1);scene.add(openBook1);
    var openBook2=new THREE.Mesh(new THREE.BoxGeometry(1,.04,.8),new THREE.MeshLambertMaterial({color:0xddeebb}));openBook2.position.set(2,baseY+1.27,0.5);openBook2.rotation.y=.3;scene.add(openBook2);
    /* ── 촛대 (테이블 위) ── */
    addCandle(-1,baseY+1.25,1.8,.55);addCandle(1,baseY+1.25,0.2,.55);addCandle(3.5,baseY+1.25,1.5,.4);
    /* ── 독서 책상 (코너) ── */
    var readDesk=new THREE.Mesh(new THREE.BoxGeometry(2.5,.1,1.5),woodM);readDesk.position.set(7.5,baseY+1.1,-7);scene.add(readDesk);
    var readDeskLegs=[[6.5,-7.5],[8.5,-7.5],[6.5,-6.5],[8.5,-6.5]];
    readDeskLegs.forEach(function(rl){
      var rleg=new THREE.Mesh(new THREE.BoxGeometry(.1,1.1,.1),darkWoodM);rleg.position.set(rl[0],baseY+.55,rl[1]);scene.add(rleg);
    });
    addCandle(7.5,baseY+1.17,-7,.45);
    var readChair=new THREE.Mesh(new THREE.BoxGeometry(.75,.08,.7),woodM);readChair.position.set(7.5,baseY+.55,-5.8);scene.add(readChair);
    var readChairBack=new THREE.Mesh(new THREE.BoxGeometry(.75,.65,.07),woodM);readChairBack.position.set(7.5,baseY+.92,-5.5);scene.add(readChairBack);
    /* ── 지구본 (받침대 + 구) ── */
    var globeStandM=new THREE.MeshLambertMaterial({color:0x4a3010});
    var globeBase=new THREE.Mesh(new THREE.CylinderGeometry(.25,.35,.15,8),globeStandM);globeBase.position.set(7,baseY+1.2,3);scene.add(globeBase);
    var globePole=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,.6,8),globeStandM);globePole.position.set(7,baseY+1.5,3);scene.add(globePole);
    var globeSphere=new THREE.Mesh(new THREE.SphereGeometry(.32,12,8),new THREE.MeshLambertMaterial({color:0x2244aa}));globeSphere.position.set(7,baseY+2,3);scene.add(globeSphere);
    /* 대륙 (녹색 패치) */
    var continentM=new THREE.MeshLambertMaterial({color:0x338833});
    var continent=new THREE.Mesh(new THREE.SphereGeometry(.33,8,6,0,.8,.3,1.1),continentM);continent.position.set(7,baseY+2,3);scene.add(continent);
    /* ── 사다리 (책장 옆) ── */
    var ladderM=new THREE.MeshLambertMaterial({color:0x8a5a2a});
    var lRailL=new THREE.Mesh(new THREE.BoxGeometry(.08,4,.08),ladderM);lRailL.position.set(-8,baseY+2,-7.2);scene.add(lRailL);
    var lRailR=new THREE.Mesh(new THREE.BoxGeometry(.08,4,.08),ladderM);lRailR.position.set(-7.5,baseY+2,-7.2);scene.add(lRailR);
    for(var ri=0;ri<5;ri++){
      var rung=new THREE.Mesh(new THREE.BoxGeometry(.5,.06,.06),ladderM);rung.position.set(-7.75,baseY+.5+ri*.7,-7.2);scene.add(rung);
    }
    /* ── 두루마리 (테이블 근처) ── */
    var scrollM=new THREE.MeshLambertMaterial({color:0xddcc99});
    [[-1,3.5],[2.5,-1],[-.5,-.5]].forEach(function(sp){
      var scroll=new THREE.Mesh(new THREE.CylinderGeometry(.08,.08,.7,8),scrollM);scroll.rotation.z=Math.PI/2;scroll.position.set(sp[0],baseY+1.28,sp[1]);scene.add(scroll);
    });
    /* ── 벽 창문 장식 ── */
    addWindowDecor(9.7,baseY+3.5,-2,Math.PI/2);addWindowDecor(9.7,baseY+3.5,5,Math.PI/2);
    /* ── 그림 (동쪽 벽) ── */
    addPainting(9.65,baseY+3.5,0,-Math.PI/2,0x446688);
    /* ── 포인트라이트 (따뜻한 분위기 — 1개로 통합) ── */
    var libL1=new THREE.PointLight(0xffcc55,.8,20);libL1.position.set(0,baseY+4,0);scene.add(libL1);
    /* ── 포톤 관련 고대 서적 코너 (동쪽 독서 책상 옆) ── */
    var ancientBookM=new THREE.MeshLambertMaterial({color:0x1a0a2a});
    var goldenBookM=new THREE.MeshLambertMaterial({color:0x8a6a10});
    var redBookM=new THREE.MeshLambertMaterial({color:0x6a1020});
    /* 고대 서적 1: "봉인의 기록" — 검보라색 */
    var book1=new THREE.Mesh(new THREE.BoxGeometry(.4,1.0,.7),ancientBookM);book1.position.set(6,baseY+1.27,-7);book1.rotation.y=.1;scene.add(book1);
    var book1Glow=new THREE.PointLight(0x6622aa,.15,3);book1Glow.position.set(6,baseY+1.5,-7);scene.add(book1Glow);
    /* 고대 서적 2: "첫 번째 용사의 일지" — 금색 */
    var book2=new THREE.Mesh(new THREE.BoxGeometry(.35,.9,.6),goldenBookM);book2.position.set(6.8,baseY+1.27,-7.2);book2.rotation.y=-.15;scene.add(book2);
    /* 고대 서적 3: "심연에 대하여" — 빨간색 */
    var book3=new THREE.Mesh(new THREE.BoxGeometry(.3,.85,.55),redBookM);book3.position.set(5.3,baseY+1.27,-6.8);book3.rotation.y=.25;scene.add(book3);
    /* 서적 라벨 (3D 텍스트 대신 HTML 라벨) */
    var bookLabels=[
      {x:6,z:-7,text:'📕 봉인의 기록'},
      {x:6.8,z:-7.2,text:'📗 첫 번째 용사의 일지'},
      {x:5.3,z:-6.8,text:'📘 심연에 대하여'}
    ];
    bookLabels.forEach(function(bl){
      var lbl=document.createElement('div');
      lbl.className='nlabel';
      lbl.style.cssText='color:#c9a84c;font-size:9px;background:#0a0a1acc;padding:2px 5px;border:1px solid #c9a84c44;border-radius:3px;pointer-events:none;';
      lbl.textContent=bl.text;
      lbl.dataset.wx=bl.x;lbl.dataset.wy=baseY+2;lbl.dataset.wz=bl.z;
      lbl.classList.add('bld');
      document.getElementById('lov').appendChild(lbl);
    });
    /* 벽에 포톤 관련 메모/지도 (북쪽 벽 책장 사이) */
    var memoM=new THREE.MeshLambertMaterial({color:0xddcc88});
    var memo1=new THREE.Mesh(new THREE.PlaneGeometry(.8,1.1),memoM);memo1.position.set(-5.5,baseY+3.2,-9.68);scene.add(memo1);
    var memo2=new THREE.Mesh(new THREE.PlaneGeometry(.6,.8),new THREE.MeshLambertMaterial({color:0xccbb77}));memo2.position.set(-4.6,baseY+3.5,-9.68);scene.add(memo2);
    /* 균열 표시 (빨간 실) */
    var crackLineM=new THREE.MeshBasicMaterial({color:0xff2222,transparent:true,opacity:0.6});
    var crack1=new THREE.Mesh(new THREE.PlaneGeometry(.05,.4),crackLineM);crack1.position.set(-5.2,baseY+3.3,-9.67);crack1.rotation.z=0.3;scene.add(crack1);
    var crack2=new THREE.Mesh(new THREE.PlaneGeometry(.04,.35),crackLineM);crack2.position.set(-4.9,baseY+3.4,-9.67);crack2.rotation.z=-0.5;scene.add(crack2);

    /* ── 사서 NPC ── */
    mkInteriorNpc(-3,-5,baseY,0x4a5a8a,'(사서) 엘리노어');

  }else if(name==='모험가 길드'){
    /* ── 환영 매트 ── */
    var welcomeM=new THREE.MeshLambertMaterial({color:0x882222});
    var welcomeMat=new THREE.Mesh(new THREE.PlaneGeometry(2.8,1.5),welcomeM);welcomeMat.rotation.x=-Math.PI/2;welcomeMat.position.set(0,baseY+.015,D/2-2);scene.add(welcomeMat);
    /* ── 카펫 (중앙 넓게) ── */
    var carpetM=new THREE.MeshLambertMaterial({color:0x661111});
    var carpet=new THREE.Mesh(new THREE.PlaneGeometry(20,14),carpetM);carpet.rotation.x=-Math.PI/2;carpet.position.set(0,baseY+.01,0);scene.add(carpet);
    /* ── 퀘스트 게시판 (북쪽 대형) ── */
    var boardBackM=new THREE.MeshLambertMaterial({color:0x5a3a10});
    var boardBack=new THREE.Mesh(new THREE.BoxGeometry(18,6.5,.5),boardBackM);boardBack.position.set(0,baseY+3.8,-14.5);scene.add(boardBack);
    var boardSurfM=new THREE.MeshLambertMaterial({color:0x8a6a3a});
    var boardSurf=new THREE.Mesh(new THREE.BoxGeometry(17.4,5.9,.1),boardSurfM);boardSurf.position.set(0,baseY+3.8,-14.26);scene.add(boardSurf);
    /* 게시판 테두리 */
    var boardFrameM=new THREE.MeshLambertMaterial({color:0x3a2208});
    var bfT=new THREE.Mesh(new THREE.BoxGeometry(18.5,.35,.55),boardFrameM);bfT.position.set(0,baseY+7.1,-14.5);scene.add(bfT);
    var bfB=new THREE.Mesh(new THREE.BoxGeometry(18.5,.35,.55),boardFrameM);bfB.position.set(0,baseY+.5,-14.5);scene.add(bfB);
    /* 퀘스트 종이 */
    var paperM=new THREE.MeshLambertMaterial({color:0xeeddbb});
    var paperM2=new THREE.MeshLambertMaterial({color:0xddcc99});
    var paperM3=new THREE.MeshLambertMaterial({color:0xffeecc});
    var paperMats=[paperM,paperM2,paperM3];
    for(var qi=0;qi<18;qi++){
      var paper=new THREE.Mesh(new THREE.PlaneGeometry(.8,1.0),paperMats[qi%3]);
      paper.position.set(-7+Math.random()*14,baseY+1.5+Math.random()*4.5,-14.22);scene.add(paper);
    }
    /* ── 길드 현수막 (천장에서 늘어뜨림) ── */
    var bannerGuildM=new THREE.MeshLambertMaterial({color:0xcc1111});
    var bannerGuild=new THREE.Mesh(new THREE.PlaneGeometry(3,5),bannerGuildM);bannerGuild.position.set(0,baseY+3.5,-8);scene.add(bannerGuild);
    var bannerGuildTop=new THREE.Mesh(new THREE.BoxGeometry(3.2,.2,.2),darkWoodM);bannerGuildTop.position.set(0,baseY+6,-8);scene.add(bannerGuildTop);
    /* ── 긴 테이블 2개 + 벤치 ── */
    var benchM=new THREE.MeshLambertMaterial({color:0x5a4a2a});
    var guildTable1=new THREE.Mesh(new THREE.BoxGeometry(18,.14,2.8),woodM);guildTable1.position.set(0,baseY+1,3.5);scene.add(guildTable1);
    var gt1top=new THREE.Mesh(new THREE.BoxGeometry(18.2,.06,3),darkWoodM);gt1top.position.set(0,baseY+1.08,3.5);scene.add(gt1top);
    var guildTable2=new THREE.Mesh(new THREE.BoxGeometry(18,.14,2.8),woodM);guildTable2.position.set(0,baseY+1,-4.5);scene.add(guildTable2);
    var gt2top=new THREE.Mesh(new THREE.BoxGeometry(18.2,.06,3),darkWoodM);gt2top.position.set(0,baseY+1.08,-4.5);scene.add(gt2top);
    /* 벤치 4개 */
    [2.1,4.9,-2.8,-6.2].forEach(function(bz){
      var bench=new THREE.Mesh(new THREE.BoxGeometry(16,.35,.55),benchM);bench.position.set(0,baseY+.55,bz);scene.add(bench);
      /* 벤치 다리 */
      [[-7,bz],[7,bz]].forEach(function(bl){
        var bleg=new THREE.Mesh(new THREE.BoxGeometry(.12,.55,.12),darkWoodM);bleg.position.set(bl[0],baseY+.27,bl[1]);scene.add(bleg);
      });
    });
    /* 테이블 위 컵/음식 */
    [-6,-2,2,6].forEach(function(tx){
      var mug=new THREE.Mesh(new THREE.CylinderGeometry(.1,.12,.28,8),new THREE.MeshLambertMaterial({color:0x885533}));mug.position.set(tx,baseY+1.18,3.5);scene.add(mug);
      var mug2=new THREE.Mesh(new THREE.CylinderGeometry(.1,.12,.28,8),new THREE.MeshLambertMaterial({color:0x775544}));mug2.position.set(tx,baseY+1.18,-4.5);scene.add(mug2);
    });
    /* ── 접수 카운터 (서쪽) ── */
    var gCounter=new THREE.Mesh(new THREE.BoxGeometry(2.8,1.2,10),woodM);gCounter.position.set(-12,baseY+.6,-3);scene.add(gCounter);
    var gCounterTop=new THREE.Mesh(new THREE.BoxGeometry(3,.1,10.2),darkWoodM);gCounterTop.position.set(-12,baseY+1.25,-3);scene.add(gCounterTop);
    /* 카운터 위 벨 + 장부 */
    var bellM=new THREE.MeshLambertMaterial({color:0xddaa22});
    var gcBell=new THREE.Mesh(new THREE.SphereGeometry(.18,8,4,0,Math.PI*2,0,Math.PI/2),bellM);gcBell.position.set(-12,baseY+1.32,-6);scene.add(gcBell);
    var gcLedger=new THREE.Mesh(new THREE.BoxGeometry(.9,.05,.7),new THREE.MeshLambertMaterial({color:0x334422}));gcLedger.position.set(-12,baseY+1.32,-2);scene.add(gcLedger);
    /* ── 트로피 진열장 (동쪽 벽) ── */
    var caseM=new THREE.MeshLambertMaterial({color:0x88aabb,transparent:true,opacity:.4});
    var displayCase=new THREE.Mesh(new THREE.BoxGeometry(.3,2.5,2),caseM);displayCase.position.set(9.7,baseY+1.7,8);scene.add(displayCase);
    var caseFrame=new THREE.Mesh(new THREE.BoxGeometry(.35,2.6,2.1),metalM);caseFrame.position.set(9.65,baseY+1.7,8);scene.add(caseFrame);
    /* 트로피들 */
    var trophyM=new THREE.MeshLambertMaterial({color:0xddaa22});
    var t1=new THREE.Mesh(new THREE.CylinderGeometry(.12,.18,.55,8),trophyM);t1.position.set(9.5,baseY+1.1,7.5);scene.add(t1);
    var t1top=new THREE.Mesh(new THREE.SphereGeometry(.15,8,6),trophyM);t1top.position.set(9.5,baseY+1.65,7.5);scene.add(t1top);
    var t2=new THREE.Mesh(new THREE.CylinderGeometry(.1,.15,.45,8),trophyM);t2.position.set(9.5,baseY+1.1,8.5);scene.add(t2);
    var t2top=new THREE.Mesh(new THREE.SphereGeometry(.12,8,6),trophyM);t2top.position.set(9.5,baseY+1.55,8.5);scene.add(t2top);
    /* ── 지도 (서쪽 벽 위쪽) ── */
    var mapBgM=new THREE.MeshLambertMaterial({color:0xddcc99});
    var mapBg=new THREE.Mesh(new THREE.PlaneGeometry(6,4),mapBgM);mapBg.rotation.y=Math.PI/2;mapBg.position.set(-14.7,baseY+4,6);scene.add(mapBg);
    var mapFrameM=new THREE.MeshLambertMaterial({color:0x3a2208});
    var mapFrame=new THREE.Mesh(new THREE.BoxGeometry(.12,4.3,6.4),mapFrameM);mapFrame.position.set(-14.65,baseY+4,6);scene.add(mapFrame);
    /* 지도 위 땅 모양 */
    var landM=new THREE.MeshLambertMaterial({color:0x55aa44});
    var land=new THREE.Mesh(new THREE.PlaneGeometry(3.5,2.5),landM);land.rotation.y=Math.PI/2;land.position.set(-14.62,baseY+4,6);scene.add(land);
    /* ── 배너 (동쪽 벽) ── */
    var bannerM=new THREE.MeshLambertMaterial({color:0xcc2222});
    for(var bni=0;bni<2;bni++){
      var banner=new THREE.Mesh(new THREE.PlaneGeometry(2.2,4.5),bannerM);
      banner.rotation.y=-Math.PI/2;banner.position.set(14.7,baseY+3.8,-4+bni*9);scene.add(banner);
      var bannerPole=new THREE.Mesh(new THREE.BoxGeometry(2.4,.15,.15),darkWoodM);bannerPole.rotation.y=-Math.PI/2;bannerPole.position.set(14.65,baseY+6.2,-4+bni*9);scene.add(bannerPole);
    }
    /* ── 무기 랙 (회원용) ── */
    var memberRack=new THREE.Mesh(new THREE.BoxGeometry(.3,3,8),woodM);memberRack.position.set(9.7,baseY+1.9,-7);scene.add(memberRack);
    var mRackRod=new THREE.Mesh(new THREE.BoxGeometry(.2,.12,8),darkWoodM);mRackRod.position.set(9.55,baseY+3,-7);scene.add(mRackRod);
    [0,1.5,-1.5,3,-3].forEach(function(mwz){
      var mBlade=new THREE.Mesh(new THREE.BoxGeometry(.08,1.6,.06),metalM);mBlade.position.set(9.55,baseY+2.2,-7+mwz);scene.add(mBlade);
    });
    /* ── 벽난로 영역 (서쪽) ── */
    var gfpBase=new THREE.Mesh(new THREE.BoxGeometry(.6,3.5,3),stoneM);gfpBase.position.set(-14.6,baseY+1.75,10);scene.add(gfpBase);
    var gfpOpen=new THREE.Mesh(new THREE.BoxGeometry(.65,1.8,2),new THREE.MeshLambertMaterial({color:0x111111}));gfpOpen.position.set(-14.6,baseY+1.2,10);scene.add(gfpOpen);
    var gFireGlowM=new THREE.MeshLambertMaterial({color:0xff6600,emissive:0xff3300,emissiveIntensity:.8});
    var gFireGlow=new THREE.Mesh(new THREE.BoxGeometry(.3,.6,1.5),gFireGlowM);gFireGlow.position.set(-14.5,baseY+1.1,10);scene.add(gFireGlow);
    var gFireL=new THREE.PointLight(0xff6622,1.2,14);gFireL.position.set(-13.5,baseY+2,10);scene.add(gFireL);
    /* 벽난로 주변 의자 */
    addChair(-12,baseY,10,Math.PI/2);addChair(-12,baseY,8,-Math.PI/6);
    /* ── 횃불 (방 곳곳 — 메시만, 라이트 없음) ── */
    var torchM=new THREE.MeshLambertMaterial({color:0x6a3a10});
    var tfM=new THREE.MeshLambertMaterial({color:0xff8800,emissive:0xff4400,emissiveIntensity:.9});
    [[0,-14.5],[0,14.5],[-14.5,0],[14.5,0]].forEach(function(tp){
      var tch=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,.55,6),torchM);tch.position.set(tp[0],baseY+3.8,tp[1]);scene.add(tch);
      var tfl=new THREE.Mesh(new THREE.SphereGeometry(.16,6,6),tfM);tfl.position.set(tp[0],baseY+4.12,tp[1]);scene.add(tfl);
    });
    /* ── 창문 장식 ── */
    addWindowDecor(14.7,baseY+3.5,5,-Math.PI/2);addWindowDecor(14.7,baseY+3.5,-5,-Math.PI/2);
    /* ── 길드 마스터 NPC ── */
    mkInteriorNpc(-12,-3,baseY,0x7a3a1a,'(길드마스터) 아르투스');
    mkInteriorNpc(-12,3,baseY,0x5a8a5a,'(접수원) 리나');

  }else if(name==='방어구 상점'){
    /* ── 환영 매트 ── */
    var welcomeM=new THREE.MeshLambertMaterial({color:0x445566});
    var welcomeMat=new THREE.Mesh(new THREE.PlaneGeometry(2.2,1.2),welcomeM);welcomeMat.rotation.x=-Math.PI/2;welcomeMat.position.set(0,baseY+.015,D/2-2);scene.add(welcomeMat);
    /* ── 카펫 ── */
    var carpetM=new THREE.MeshLambertMaterial({color:0x334455});
    var carpet=new THREE.Mesh(new THREE.PlaneGeometry(12,10),carpetM);carpet.rotation.x=-Math.PI/2;carpet.position.set(0,baseY+.01,-1);scene.add(carpet);
    /* ── 마네킹 진열 (카운터 양옆 2개씩) ── */
    var armorColors=[0x8899aa,0xaa8855,0x557799,0x667766];
    var mannPositions=[[-6,-8],[-6,-6],[6,-8],[6,-6]];
    for(var ai=0;ai<4;ai++){
      var mp=mannPositions[ai];
      var aArmorM=new THREE.MeshLambertMaterial({color:armorColors[ai]});
      var mannBase=new THREE.Mesh(new THREE.CylinderGeometry(.28,.38,.55,8),woodM);mannBase.position.set(mp[0],baseY+.27,mp[1]);scene.add(mannBase);
      var mannPole=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,1.1,8),darkWoodM);mannPole.position.set(mp[0],baseY+1.05,mp[1]);scene.add(mannPole);
      var mannTorso=new THREE.Mesh(new THREE.BoxGeometry(.85,1.05,.45),aArmorM);mannTorso.position.set(mp[0],baseY+2.1,mp[1]);scene.add(mannTorso);
      var mannShldrL=new THREE.Mesh(new THREE.BoxGeometry(.25,.3,.35),aArmorM);mannShldrL.position.set(mp[0]-.58,baseY+2.45,mp[1]);scene.add(mannShldrL);
      var mannShldrR=new THREE.Mesh(new THREE.BoxGeometry(.25,.3,.35),aArmorM);mannShldrR.position.set(mp[0]+.58,baseY+2.45,mp[1]);scene.add(mannShldrR);
      var mannArmL=new THREE.Mesh(new THREE.BoxGeometry(.22,.75,.22),aArmorM);mannArmL.position.set(mp[0]-.65,baseY+1.85,mp[1]);scene.add(mannArmL);
      var mannArmR=new THREE.Mesh(new THREE.BoxGeometry(.22,.75,.22),aArmorM);mannArmR.position.set(mp[0]+.65,baseY+1.85,mp[1]);scene.add(mannArmR);
      var mannHelm=new THREE.Mesh(new THREE.SphereGeometry(.28,8,6),aArmorM);mannHelm.position.set(mp[0],baseY+2.9,mp[1]);scene.add(mannHelm);
    }
    /* ── 갑옷 더미 (양쪽 벽) ── */
    var pileM=new THREE.MeshLambertMaterial({color:0x778899});
    /* 왼쪽 벽 — 헬멧 선반 */
    var helmShelf=new THREE.Mesh(new THREE.BoxGeometry(.3,3,6),woodM);helmShelf.position.set(-9.5,baseY+1.5,-3);scene.add(helmShelf);
    [[-9.3,baseY+.8,-5],[-9.3,baseY+.8,-3],[-9.3,baseY+.8,-1],[-9.3,baseY+2.2,-5],[-9.3,baseY+2.2,-3],[-9.3,baseY+2.2,-1]].forEach(function(hp){
      var helm=new THREE.Mesh(new THREE.SphereGeometry(.35,6,5),new THREE.MeshLambertMaterial({color:0x667788+Math.floor(Math.random()*0x222222)}));
      helm.position.set(hp[0],hp[1],hp[2]);helm.scale.y=.8;scene.add(helm);
    });
    /* 오른쪽 앞 — 상자에 갑옷 쌓인 모양 */
    var crate1=new THREE.Mesh(new THREE.BoxGeometry(1.8,1,1.5),woodM);crate1.position.set(8,baseY+.5,4);scene.add(crate1);
    var armorPile1=new THREE.Mesh(new THREE.BoxGeometry(1.4,.6,1.2),pileM);armorPile1.position.set(8,baseY+1.3,4);armorPile1.rotation.y=.3;scene.add(armorPile1);
    var crate2=new THREE.Mesh(new THREE.BoxGeometry(1.5,.8,1.3),woodM);crate2.position.set(8,baseY+.4,6.5);scene.add(crate2);
    var bootsPile=new THREE.Mesh(new THREE.BoxGeometry(.8,.5,.6),new THREE.MeshLambertMaterial({color:0x554433}));bootsPile.position.set(8,baseY+.9,6.5);scene.add(bootsPile);
    /* 바닥에 놓인 갑옷 파츠 */
    var floorArmor1=new THREE.Mesh(new THREE.BoxGeometry(1.2,.15,.8),pileM);floorArmor1.position.set(-3,baseY+.08,3);floorArmor1.rotation.y=.5;scene.add(floorArmor1);
    var floorHelm=new THREE.Mesh(new THREE.SphereGeometry(.3,6,5),new THREE.MeshLambertMaterial({color:0x889988}));floorHelm.position.set(-2.5,baseY+.3,3.5);floorHelm.scale.y=.7;scene.add(floorHelm);
    var floorShield=new THREE.Mesh(new THREE.BoxGeometry(.1,1.2,.9),new THREE.MeshLambertMaterial({color:0x885533}));floorShield.position.set(3,baseY+.6,2);floorShield.rotation.z=.2;scene.add(floorShield);
    /* ── 방패 진열대 (동쪽 벽) ── */
    var shRackM=new THREE.MeshLambertMaterial({color:0x5a3a18});
    var shRack=new THREE.Mesh(new THREE.BoxGeometry(.3,4,12),shRackM);shRack.position.set(9.7,baseY+2.5,0);scene.add(shRack);
    var shRackRod=new THREE.Mesh(new THREE.BoxGeometry(.2,.12,12),darkWoodM);shRackRod.position.set(9.55,baseY+2.8,0);scene.add(shRackRod);
    var shieldShapes=[[0xaa6633,0xdd8844],[0x445588,0x6677aa],[0x337733,0x44aa44],[0x664422,0xaa6633]];
    for(var shi=0;shi<4;shi++){
      var shM=new THREE.MeshLambertMaterial({color:shieldShapes[shi][0]});
      var shBorderM2=new THREE.MeshLambertMaterial({color:shieldShapes[shi][1]});
      var sh=new THREE.Mesh(new THREE.BoxGeometry(.12,1.4,1.1),shM);sh.position.set(9.55,baseY+2.5,-4.5+shi*3);scene.add(sh);
      var shBdr=new THREE.Mesh(new THREE.BoxGeometry(.1,1.6,1.3),shBorderM2);shBdr.position.set(9.5,baseY+2.5,-4.5+shi*3);scene.add(shBdr);
    }
    /* ── 피팅 거울 (서쪽 벽) ── */
    var mirrorFrameM=new THREE.MeshLambertMaterial({color:0x3a2208});
    var mirrorFrame=new THREE.Mesh(new THREE.BoxGeometry(.15,3.5,2),mirrorFrameM);mirrorFrame.position.set(-9.7,baseY+2.2,3);scene.add(mirrorFrame);
    var mirrorSurfM=new THREE.MeshLambertMaterial({color:0xaaccdd,transparent:true,opacity:.7});
    var mirrorSurf=new THREE.Mesh(new THREE.PlaneGeometry(1.7,3.2),mirrorSurfM);mirrorSurf.rotation.y=Math.PI/2;mirrorSurf.position.set(-9.6,baseY+2.2,3);scene.add(mirrorSurf);
    /* ── 측정 도구 카운터 (북쪽/안쪽) ── */
    var aC=new THREE.Mesh(new THREE.BoxGeometry(8,1.1,2),woodM);aC.position.set(0,baseY+.55,-7);scene.add(aC);
    var aCTop=new THREE.Mesh(new THREE.BoxGeometry(8.2,.1,2.2),darkWoodM);aCTop.position.set(0,baseY+1.15,-7);scene.add(aCTop);
    /* 카운터 위 아이템 */
    var tapeM=new THREE.MeshLambertMaterial({color:0xddcc88});
    var tape=new THREE.Mesh(new THREE.CylinderGeometry(.15,.15,.2,8),tapeM);tape.rotation.z=Math.PI/2;tape.position.set(-2,baseY+1.22,-7);scene.add(tape);
    var scissorM=new THREE.MeshLambertMaterial({color:0x999999});
    var scissor=new THREE.Mesh(new THREE.BoxGeometry(.06,.45,.06),scissorM);scissor.position.set(1,baseY+1.27,-7);scissor.rotation.z=.3;scene.add(scissor);
    /* ── 가죽 두루마리/천 묶음 ── */
    var leatherM=new THREE.MeshLambertMaterial({color:0x8a5a30});
    var leather1=new THREE.Mesh(new THREE.CylinderGeometry(.25,.28,.9,8),leatherM);leather1.rotation.z=Math.PI/2;leather1.position.set(-7,baseY+.55,5);scene.add(leather1);
    var leather2=new THREE.Mesh(new THREE.CylinderGeometry(.2,.22,.8,8),new THREE.MeshLambertMaterial({color:0xaabb88}));leather2.rotation.z=Math.PI/2;leather2.position.set(-7,baseY+1.1,5);scene.add(leather2);
    var leather3=new THREE.Mesh(new THREE.CylinderGeometry(.18,.2,.7,8),new THREE.MeshLambertMaterial({color:0x665544}));leather3.rotation.z=Math.PI/2;leather3.position.set(-6.8,baseY+.45,5.8);scene.add(leather3);
    /* ── 창문 장식 ── */
    addWindowDecor(-9.7,baseY+3.5,0,-Math.PI/2);addWindowDecor(9.7,baseY+3.5,-5,Math.PI/2);
    /* ── 벽 그림 (북쪽) ── */
    addPainting(0,baseY+3.5,-9.75,0,0x556677);addPainting(-5,baseY+3.5,-9.75,0,0x776655);
    /* ── 촛대 (카운터 위) ── */
    addCandle(-3,baseY+1.22,6.5,.4);addCandle(3,baseY+1.22,6.5,.4);
    /* ── 포인트라이트 (1개로 통합) ── */
    var arL1=new THREE.PointLight(0xffcc88,.8,20);arL1.position.set(0,baseY+4,0);scene.add(arL1);
    /* ── 방어구 상인 NPC ── */
    mkInteriorNpc(0,-8,baseY,0x5a5a7a,'(방어구상인) 헥토르');

  }else{
    /* 기본 내부 */
    var defTable=new THREE.Mesh(new THREE.BoxGeometry(4,.1,3),woodM);defTable.position.set(0,baseY+1,0);scene.add(defTable);
    var defChair=new THREE.Mesh(new THREE.BoxGeometry(.8,.6,.8),woodM);defChair.position.set(2,baseY+.3,0);scene.add(defChair);
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

/* ── 존별 앰비언트 파티클 ── */
var _zoneParticles=[];/* [{points,positions,baseY,phases,type}] */

/* ── 물 버텍스 애니메이션 ── */
var waterMeshes=[];
var _animatedWater=[];/* [{mesh,origPositions}] 버텍스 변위용 */
var riverUVOffset=0;

/* ── 구름 메시 ── */
var _cloudMeshes=[];
var _cloudStartX=[];

/* ── 스카이 유니폼 (day cycle) ── */
var _skyUniforms=null;

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

function mkHuman(bc,hc,gender){
  var isFemale=(gender==='female');
  var g=new THREE.Group();
  var bm=new THREE.MeshLambertMaterial({color:bc});
  var hm=new THREE.MeshLambertMaterial({color:hc});
  var pantsMat=new THREE.MeshLambertMaterial({color:0x2a2a3a});
  var bootMat=new THREE.MeshLambertMaterial({color:0x3a2a18});
  var hairMat=new THREE.MeshLambertMaterial({color:isFemale?0x6a3a1a:0x2a1a08});
  var eyeMat=new THREE.MeshBasicMaterial({color:0x1a1a1a});
  var belt=new THREE.MeshLambertMaterial({color:0x4a2e12});

  /* 몸통 — 여자는 좁게, 남자는 넓게 */
  var bodyW=isFemale?0.5:0.58;
  var body=new THREE.Mesh(new THREE.BoxGeometry(bodyW,.75,.34),bm);
  body.position.set(0,1.15,0);
  body.castShadow=true;body.receiveShadow=true;
  g.add(body);
  /* 벨트 */
  var beltMesh=new THREE.Mesh(new THREE.BoxGeometry(.62,.08,.36),belt);
  beltMesh.position.set(0,.78,0);g.add(beltMesh);
  /* 하복부 */
  var waist=new THREE.Mesh(new THREE.BoxGeometry(.54,.22,.32),pantsMat);
  waist.position.set(0,.63,0);g.add(waist);

  /* 머리 */
  var head=new THREE.Mesh(new THREE.BoxGeometry(.42,.42,.42),hm);
  head.position.set(0,1.75,0);
  head.castShadow=true;head.receiveShadow=true;
  g.add(head);
  /* 머리카락 (윗부분) */
  var hair=new THREE.Mesh(new THREE.BoxGeometry(.44,.16,.44),hairMat);
  hair.position.set(0,.24,0);head.add(hair);
  /* 머리카락 앞머리 */
  var bangs=new THREE.Mesh(new THREE.BoxGeometry(.44,.1,.05),hairMat);
  bangs.position.set(0,.15,.21);head.add(bangs);
  /* 여자: 긴 머리카락 (뒤로 흘러내림) */
  if(isFemale){
    var longHair=new THREE.Mesh(new THREE.BoxGeometry(.46,.5,.1),hairMat);
    longHair.position.set(0,-.05,-.2);head.add(longHair);
    /* 사이드 헤어 */
    var sideL=new THREE.Mesh(new THREE.BoxGeometry(.05,.35,.3),hairMat);
    sideL.position.set(-.22,-.05,0);head.add(sideL);
    var sideR=new THREE.Mesh(new THREE.BoxGeometry(.05,.35,.3),hairMat);
    sideR.position.set(.22,-.05,0);head.add(sideR);
  }
  /* 눈 2개 */
  var eyeL=new THREE.Mesh(new THREE.BoxGeometry(.06,.06,.02),eyeMat);
  eyeL.position.set(-.09,0,.22);head.add(eyeL);
  var eyeR=new THREE.Mesh(new THREE.BoxGeometry(.06,.06,.02),eyeMat);
  eyeR.position.set(.09,0,.22);head.add(eyeR);

  /* 목 */
  var neck=new THREE.Mesh(new THREE.BoxGeometry(.2,.1,.2),hm);
  neck.position.set(0,1.52,0);g.add(neck);

  /* 다리 — 바지 + 부츠 */
  var legGeo=new THREE.BoxGeometry(.2,.55,.2);
  var bootGeo=new THREE.BoxGeometry(.24,.15,.28);
  var legL=new THREE.Group();
  var legLMesh=new THREE.Mesh(legGeo,pantsMat);
  legLMesh.position.set(0,-.28,0);legLMesh.castShadow=true;legL.add(legLMesh);
  var bootL=new THREE.Mesh(bootGeo,bootMat);
  bootL.position.set(0,-.63,.04);bootL.castShadow=true;legL.add(bootL);
  legL.position.set(-.14,.55,0);g.add(legL);

  var legR=new THREE.Group();
  var legRMesh=new THREE.Mesh(legGeo,pantsMat);
  legRMesh.position.set(0,-.28,0);legRMesh.castShadow=true;legR.add(legRMesh);
  var bootR=new THREE.Mesh(bootGeo,bootMat);
  bootR.position.set(0,-.63,.04);bootR.castShadow=true;legR.add(bootR);
  legR.position.set(.14,.55,0);g.add(legR);

  /* 팔 — 어깨 + 상박 + 전박 + 손 (인체 비율 조정: 팔이 짧아짐) */
  var upperArmGeo=new THREE.BoxGeometry(.16,.38,.18);
  var foreArmGeo=new THREE.BoxGeometry(.14,.28,.16);
  var handGeo=new THREE.BoxGeometry(.16,.14,.18);
  var shoulderGeo=new THREE.SphereGeometry(.11,8,6);

  /* 왼팔 */
  var armL=new THREE.Group();
  var armLShoulder=new THREE.Mesh(shoulderGeo,bm);
  armLShoulder.position.set(0,0,0);armL.add(armLShoulder);
  var armLUpper=new THREE.Mesh(upperArmGeo,bm);
  armLUpper.position.set(0,-.21,0);armLUpper.castShadow=true;armL.add(armLUpper);
  var armLFore=new THREE.Mesh(foreArmGeo,hm);
  armLFore.position.set(0,-.54,0);armL.add(armLFore);
  var handL=new THREE.Mesh(handGeo,hm);
  handL.position.set(0,-.75,0);armL.add(handL);
  armL.position.set(.34,1.42,0);g.add(armL);

  /* 오른팔 (pivot) — 시각적 오른손 */
  var armRPivot=new THREE.Group();
  armRPivot.position.set(-.34,1.42,0);
  var armRShoulder=new THREE.Mesh(shoulderGeo,bm);
  armRShoulder.position.set(0,0,0);armRPivot.add(armRShoulder);
  var armRUpper=new THREE.Mesh(upperArmGeo,bm);
  armRUpper.position.set(0,-.21,0);armRUpper.castShadow=true;armRPivot.add(armRUpper);
  var armRFore=new THREE.Mesh(foreArmGeo,hm);
  armRFore.position.set(0,-.54,0);armRPivot.add(armRFore);
  var handR=new THREE.Mesh(handGeo,hm);
  handR.position.set(0,-.75,0);armRPivot.add(handR);
  g.add(armRPivot);

  return{group:g,body:body,head:head,legL:legL,legR:legR,armL:armL,armR:armRPivot,armRPivot:armRPivot,bodyMat:bm,handR:handR,handL:handL};
}

/* 공유 나무 머티리얼 — 함수 호출마다 생성 방지 */
var _treeTrunkMat=null,_treeLeafMat1=null,_treeLeafMat2=null;
var _treeOakMat=null,_treeOakTrunkMat=null;
var _treeWillowMat=null,_treeWillowTrunkMat=null;
var _treeCherryMat=null,_treeCherryTrunkMat=null;
function _getTreeMats(){
  if(!_treeTrunkMat){
    _treeTrunkMat=new THREE.MeshLambertMaterial({color:0x5a3a1a});
    _treeLeafMat1=new THREE.MeshLambertMaterial({color:0x3a7a2a});
    _treeLeafMat2=new THREE.MeshLambertMaterial({color:0x4a8a3a});
    _treeOakTrunkMat=new THREE.MeshLambertMaterial({color:0x4a2e10});
    _treeOakMat=new THREE.MeshLambertMaterial({color:0x2a6a1a});
    _treeWillowTrunkMat=new THREE.MeshLambertMaterial({color:0x3a2a10});
    _treeWillowMat=new THREE.MeshLambertMaterial({color:0x1a5a12,transparent:true,opacity:.85});
    _treeCherryTrunkMat=new THREE.MeshLambertMaterial({color:0x4a2a18});
    _treeCherryMat=new THREE.MeshLambertMaterial({color:0xffaacc,emissive:new THREE.Color(0x441122),emissiveIntensity:.18});
  }
}

/* pine = 0 (기존), oak = 1, willow = 2, cherry = 3 */
function mkTree(x,z,s,parent,type){
  s=s||1;var g=new THREE.Group();
  var p=parent||scene;
  _getTreeMats();
  var ty=getTerrainY(x,z);

  if(type===1){
    /* ── 참나무 (Oak): 구형 수관, 굵은 갈색 줄기 ── */
    var trunk=new THREE.Mesh(new THREE.CylinderGeometry(.22*s,.32*s,2.2*s,7),_treeOakTrunkMat);
    trunk.position.set(0,1.1*s,0);trunk.castShadow=true;trunk.receiveShadow=true;g.add(trunk);
    var crown=new THREE.Mesh(new THREE.SphereGeometry(1.6*s,8,6),_treeOakMat);
    crown.position.set(0,3.0*s,0);crown.castShadow=true;crown.receiveShadow=true;g.add(crown);
    var crown2=new THREE.Mesh(new THREE.SphereGeometry(1.1*s,7,5),_treeLeafMat2);
    crown2.position.set(0.4*s,3.7*s,0.2*s);crown2.castShadow=true;g.add(crown2);
    var crown3=new THREE.Mesh(new THREE.SphereGeometry(0.9*s,7,5),_treeOakMat);
    crown3.position.set(-0.5*s,3.5*s,-0.2*s);crown3.castShadow=true;g.add(crown3);
  } else if(type===2){
    /* ── 버드나무 (Willow): 늘어지는 가지 ── */
    var trunk2=new THREE.Mesh(new THREE.CylinderGeometry(.16*s,.24*s,3*s,7),_treeWillowTrunkMat);
    trunk2.position.set(0,1.5*s,0);trunk2.castShadow=true;trunk2.receiveShadow=true;g.add(trunk2);
    /* 늘어진 가지 — 아래로 길쭉한 원뿔 */
    var droopAngles=[0,1.05,2.09,3.14,4.19,5.24];
    droopAngles.forEach(function(a){
      var droop=new THREE.Mesh(new THREE.ConeGeometry(0.25*s,2.2*s,5),_treeWillowMat);
      droop.position.set(Math.cos(a)*0.9*s,2.5*s,Math.sin(a)*0.9*s);
      droop.rotation.z=Math.cos(a)*0.5;droop.rotation.x=-Math.sin(a)*0.5;
      droop.castShadow=true;g.add(droop);
    });
    var topLeaf=new THREE.Mesh(new THREE.SphereGeometry(1.0*s,7,5),_treeWillowMat);
    topLeaf.position.set(0,3.4*s,0);topLeaf.castShadow=true;g.add(topLeaf);
  } else if(type===3){
    /* ── 벚나무 (Cherry): 분홍 구형 수관, 가는 줄기 (초원에만) ── */
    var trunk3=new THREE.Mesh(new THREE.CylinderGeometry(.10*s,.16*s,1.8*s,6),_treeCherryTrunkMat);
    trunk3.position.set(0,0.9*s,0);trunk3.castShadow=true;trunk3.receiveShadow=true;g.add(trunk3);
    var bloom1=new THREE.Mesh(new THREE.SphereGeometry(1.2*s,8,6),_treeCherryMat);
    bloom1.position.set(0,2.4*s,0);bloom1.castShadow=true;bloom1.receiveShadow=true;g.add(bloom1);
    var bloom2=new THREE.Mesh(new THREE.SphereGeometry(0.8*s,7,5),_treeCherryMat);
    bloom2.position.set(0.6*s,2.9*s,0.3*s);bloom2.castShadow=true;g.add(bloom2);
    var bloom3=new THREE.Mesh(new THREE.SphereGeometry(0.7*s,7,5),_treeCherryMat);
    bloom3.position.set(-0.5*s,2.7*s,-0.4*s);bloom3.castShadow=true;g.add(bloom3);
    /* 떨어진 꽃잎 (작은 분홍 평면) */
    for(var pi=0;pi<6;pi++){
      var petal=new THREE.Mesh(new THREE.PlaneGeometry(0.18*s,0.18*s),_treeCherryMat);
      petal.position.set((Math.random()-.5)*2*s,0.05,(Math.random()-.5)*2*s);
      petal.rotation.x=-Math.PI/2;petal.rotation.z=Math.random()*Math.PI;g.add(petal);
    }
  } else {
    /* ── 소나무 (Pine, 기존) ── */
    var trunkP=new THREE.Mesh(new THREE.CylinderGeometry(.18,.28,2*s,7),_treeTrunkMat);
    trunkP.position.set(0,s,0);trunkP.castShadow=true;trunkP.receiveShadow=true;g.add(trunkP);
    var l1=new THREE.Mesh(new THREE.ConeGeometry(1.5*s,2.5*s,8),_treeLeafMat1);
    l1.position.set(0,2.6*s,0);l1.castShadow=true;l1.receiveShadow=true;g.add(l1);
    var l2=new THREE.Mesh(new THREE.ConeGeometry(1.0*s,2.0*s,8),_treeLeafMat2);
    l2.position.set(0,3.9*s,0);l2.castShadow=true;l2.receiveShadow=true;g.add(l2);
  }

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
  /* castleLight 제거 — 성능 최적화 */
  g.position.set(-350,0,-380);p.add(g);
}

function mkFountain(parent){
  var g=new THREE.Group();
  var p=parent||scene;
  var stoneM=new THREE.MeshLambertMaterial({color:0x888070});
  var waterM=new THREE.MeshLambertMaterial({color:0x226688,transparent:true,opacity:0.55});
  var outer=new THREE.Mesh(new THREE.CylinderGeometry(6,6.3,.7,16),stoneM);outer.position.set(0,.35,0);outer.castShadow=true;outer.receiveShadow=true;g.add(outer);
  var water=new THREE.Mesh(new THREE.CylinderGeometry(5.5,5.5,.35,16),waterM);water.position.set(0,.52,0);g.add(water);
  var pillar=new THREE.Mesh(new THREE.CylinderGeometry(.4,.55,3.2,8),stoneM);pillar.position.set(0,1.6,0);pillar.castShadow=true;g.add(pillar);
  var topM=new THREE.MeshLambertMaterial({color:0x887733});
  var top=new THREE.Mesh(new THREE.ConeGeometry(1.1,2.0,6),topM);top.position.set(0,3.8,0);top.castShadow=true;g.add(top);
  var jetM=new THREE.MeshLambertMaterial({color:0x4488aa,transparent:true,opacity:.4});
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
  var pathM=new THREE.MeshLambertMaterial({color:0xc4a872,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
  var plaza=new THREE.Mesh(new THREE.CylinderGeometry(14,14,.05,32),pathM);
  plaza.position.set(-350,.25,-358);plaza.receiveShadow=true;p.add(plaza);

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
    var sm=lerpPath(pts,steps*2);
    for(var i=0;i<sm.length;i++){
      var _px=sm[i][0],_pz=sm[i][1];
      /* 물 위 구간 스킵 */
      if(typeof isOverWater==='function'&&isOverWater(_px,_pz))continue;
      var _py=getTerrainY(_px,_pz);
      /* 지형이 너무 높으면(산) 스킵 */
      if(_py>5)continue;
      var disc=new THREE.Mesh(new THREE.CircleGeometry(radius||4,32),pathM);
      disc.rotation.x=-Math.PI/2;disc.position.set(_px,_py+.08,_pz);
      p.add(disc);
    }
  }
  /* ── 마을 내부 도로망 (확장 구역) ── */
  /* 광장 ↔ 여관 (서쪽) */
  drawPath([[-350,-358],[-362,-358],[-375,-360],[-388,-360]],4,3);
  /* 광장 ↔ 무기/방어구 상점 (동쪽) */
  drawPath([[-350,-358],[-338,-358],[-325,-360],[-312,-360]],4,3);
  /* 광장 남북 메인도로 → 게이트 */
  /* 남쪽 길 제거됨 */
  /* 광장 ↔ 모험가 길드 */
  drawPath([[-350,-370],[-352,-385],[-354,-400],[-354,-418],[-352,-430]],4,3);
  /* 시장 구역 (서쪽 상인 구역 내부) */
  drawPath([[-350,-358],[-362,-362],[-375,-365],[-390,-368],[-402,-370]],4,3);
  /* 도서관 ↔ 광장 (동쪽 외곽 루프) */
  drawPath([[-350,-358],[-335,-358],[-322,-355],[-310,-350],[-300,-342]],4,3);
  /* 주거 구역 도로 (북쪽) */
  drawPath([[-350,-358],[-350,-345],[-350,-330],[-350,-315],[-350,-302]],4,3);
  drawPath([[-350,-315],[-365,-312],[-380,-310],[-395,-312]],3,3);
  drawPath([[-350,-315],[-335,-312],[-320,-310],[-305,-312]],3,3);
  /* 우물 ↔ 주거구역 */
  drawPath([[-350,-315],[-360,-312],[-370,-312],[-372,-310]],2,3);

  /* ═══ 존 연결 도로 (강 다리 경유) ═══ */

  /* 남쪽 문 폐쇄 — 길 없음 */

  /* 마을 동쪽 문(-255,-350) → 동쪽으로 → 다리(-200,-250) */
  drawPath([[-252,-350],[-240,-340],[-230,-320],[-220,-300],[-210,-280],[-200,-250]],4,3);
  /* 다리 이후 → 중앙 */
  drawPath([[-200,-250],[-180,-230],[-150,-200],[-120,-160],[-80,-110],[-40,-60],[0,0]],4,3);

  /* 중앙 교차로 표시 */
  var crossroads=new THREE.Mesh(new THREE.CircleGeometry(8,32),pathM);
  crossroads.rotation.x=-Math.PI/2;crossroads.position.set(0,.09,0);p.add(crossroads);

  /* 중앙 → 초원 (NE, x:50~300, z:-100~-300) */
  drawPath([[0,0],[40,-20],[80,-60],[130,-110],[180,-170],[230,-230],[280,-290]],5,4);
  /* 초원 내부 순환길 */
  drawPath([[280,-290],[250,-340],[200,-380],[150,-350],[100,-310],[50,-280],[0,-250]],4,3);

  /* 중앙 → 늪 (W, x:-200~-400, z:50~100) */
  drawPath([[0,0],[-40,15],[-80,30],[-130,50],[-180,70],[-240,85],[-300,95],[-380,100]],5,4);
  /* 늪 내부 길 */
  drawPath([[-380,100],[-420,130],[-450,170],[-440,220],[-400,250],[-350,200],[-320,150],[-300,100]],4,3);

  /* 중앙 → 정글 (E, x:200~400, z:50~100) */
  drawPath([[0,0],[40,15],[80,30],[130,50],[180,70],[240,85],[300,95],[380,100]],5,4);
  /* 정글 내부 길 */
  drawPath([[380,100],[420,140],[450,190],[430,250],[400,200],[350,150],[300,120]],4,3);

  /* 중앙 → 어두운 숲 (SW, x:-100~-300, z:200~350) */
  drawPath([[0,0],[-30,30],[-70,80],[-120,150],[-170,220],[-220,280],[-280,330],[-300,350]],5,4);
  /* 숲 내부 길 */
  drawPath([[-300,350],[-340,380],[-380,400],[-400,350],[-360,300],[-320,280],[-280,300]],4,3);

  /* 중앙 → 화산 (SE, x:100~350, z:250~400) */
  drawPath([[0,0],[30,30],[70,80],[120,150],[170,220],[220,280],[280,340],[350,400]],5,4);
  /* 화산 내부 길 */
  drawPath([[350,400],[380,440],[400,480],[370,450],[330,420],[300,380]],4,3);

  /* 중앙 → 보스 (S, x:0, z:400~550) */
  drawPath([[0,0],[0,40],[0,100],[-10,170],[10,250],[0,340],[0,440],[0,520],[0,550]],4,4);

  /* 늪 → 어두운 숲 연결 */
  drawPath([[-380,100],[-360,140],[-340,200],[-320,260],[-300,320],[-300,350]],4,3);
  /* 정글 → 화산 연결 */
  drawPath([[380,100],[370,140],[360,200],[350,260],[350,320],[350,400]],4,3);
}

function mkWaterRiver(parent){
  var p=parent||scene;
  /* ── 개선된 물 머티리얼: 반투명 + 약간 발광 (코스틱 느낌) ── */
  var riverM=new THREE.MeshLambertMaterial({
    color:0x44aadd,emissive:new THREE.Color(0x0a2a44),emissiveIntensity:.2,
    transparent:true,opacity:0.72,side:THREE.DoubleSide
  });
  var depthM=new THREE.MeshLambertMaterial({color:0x0a2a44,transparent:true,opacity:.55});
  var bankM=new THREE.MeshLambertMaterial({color:0x3a2808});

  /* 버텍스 변위 물 메시 생성 헬퍼 */
  function mkAnimWater(w,h,segW,segH,mat){
    var geo=new THREE.PlaneGeometry(w,h,segW,segH);
    /* 버텍스 원본 위치 저장 */
    var posAttr=geo.attributes.position;
    var orig=new Float32Array(posAttr.count*3);
    for(var i=0;i<posAttr.count;i++){
      orig[i*3]=posAttr.getX(i);orig[i*3+1]=posAttr.getY(i);orig[i*3+2]=posAttr.getZ(i);
    }
    var m=new THREE.Mesh(geo,mat);
    _animatedWater.push({mesh:m,origPositions:orig});
    return m;
  }

  /* 남북 중앙 강: x=0, z:-400~500 */
  var nsLen=900;
  /* 큰 강은 세그먼트 줄여서 성능 유지 (8x60) */
  var ns=mkAnimWater(16,nsLen,8,60,riverM);
  ns.rotation.x=-Math.PI/2;ns.position.set(0,.08,50);p.add(ns);
  waterMeshes.push(ns);
  var nsd=new THREE.Mesh(new THREE.PlaneGeometry(16,nsLen),depthM);nsd.rotation.x=-Math.PI/2;nsd.position.set(0,-.06,50);p.add(nsd);
  /* 강변 */
  [-12,12].forEach(function(bx){
    var bank=new THREE.Mesh(new THREE.PlaneGeometry(6,nsLen),bankM);bank.rotation.x=-Math.PI/2;bank.position.set(bx,.005,50);p.add(bank);
  });
  /* 동서 강 분기: z=0, x:-400~-10 및 x:10~400 */
  var ewLen=390;
  var ew1=mkAnimWater(ewLen,16,60,8,riverM.clone());ew1.rotation.x=-Math.PI/2;ew1.position.set(-205,.08,0);p.add(ew1);
  waterMeshes.push(ew1);
  var ew2=mkAnimWater(ewLen,16,60,8,riverM.clone());ew2.rotation.x=-Math.PI/2;ew2.position.set(205,.08,0);p.add(ew2);
  waterMeshes.push(ew2);
  var ewd1=new THREE.Mesh(new THREE.PlaneGeometry(ewLen,16),depthM);ewd1.rotation.x=-Math.PI/2;ewd1.position.set(-205,-.06,0);p.add(ewd1);
  var ewd2=new THREE.Mesh(new THREE.PlaneGeometry(ewLen,16),depthM);ewd2.rotation.x=-Math.PI/2;ewd2.position.set(205,-.06,0);p.add(ewd2);
  /* 물 조명 제거 — 성능 최적화 (강은 emissive 머티리얼로 충분) */
  /* 다리 3개 */
  var bridgePlanksM=new THREE.MeshLambertMaterial({color:0x7a5030});
  var bridgeRailM=new THREE.MeshLambertMaterial({color:0x5a3820});
  var bridgePostM=new THREE.MeshLambertMaterial({color:0x4a2e10});
  function woodBridge(cx,cz,rotY){
    var bLen=22;/* 강 폭보다 넉넉하게 */
    var g=new THREE.Group();
    /* 메인 보 */
    [-1.0,1.0].forEach(function(bx){
      var mainBeam=new THREE.Mesh(new THREE.BoxGeometry(.25,.3,bLen),bridgeRailM);
      mainBeam.position.set(bx,.15,0);mainBeam.castShadow=true;mainBeam.receiveShadow=true;g.add(mainBeam);
    });
    /* 판자 */
    var plankCount=Math.floor(bLen/1.0);
    for(var pi2=-Math.floor(plankCount/2);pi2<=Math.floor(plankCount/2);pi2++){
      var plank=new THREE.Mesh(new THREE.BoxGeometry(2.2,.14,.8),bridgePlanksM);
      plank.position.set(0,.32,pi2*.95);plank.castShadow=true;plank.receiveShadow=true;g.add(plank);
    }
    /* 기둥 */
    [-Math.floor(plankCount/2),Math.floor(plankCount/2)].forEach(function(pz2){
      [-1.0,1.0].forEach(function(px2){
        var post=new THREE.Mesh(new THREE.BoxGeometry(.18,1.2,.18),bridgePostM);
        post.position.set(px2,.9,pz2*.95);post.castShadow=true;g.add(post);
      });
    });
    /* 난간 */
    [-1.0,1.0].forEach(function(rx){
      var rail=new THREE.Mesh(new THREE.BoxGeometry(.1,.1,bLen-.5),bridgeRailM);
      rail.position.set(rx,1.5,0);g.add(rail);
    });
    g.position.set(cx,.1,cz);g.rotation.y=rotY||0;p.add(g);
  }
  /* 잘못된 위치의 다리 제거 — 존 경계 강 위에만 배치 */

  /* ── 존 경계 강: 마을↔초원 (x=-200, z:-500~-150) ── */
  var vmLen=350;
  var vmRiver=new THREE.Mesh(new THREE.PlaneGeometry(14,vmLen),riverM.clone());
  vmRiver.rotation.x=-Math.PI/2;vmRiver.position.set(-200,.08,-325);p.add(vmRiver);
  waterMeshes.push(vmRiver);
  var vmDepth=new THREE.Mesh(new THREE.PlaneGeometry(14,vmLen),depthM);
  vmDepth.rotation.x=-Math.PI/2;vmDepth.position.set(-200,-.06,-325);p.add(vmDepth);
  [-11,11].forEach(function(bx){
    var bank=new THREE.Mesh(new THREE.PlaneGeometry(5,vmLen),bankM);bank.rotation.x=-Math.PI/2;bank.position.set(-200+bx,.005,-325);p.add(bank);
  });
  /* 마을↔초원 다리 (강이 남북으로 흐르므로 다리는 동서 방향 = rotY PI/2) */
  woodBridge(-200,-350,Math.PI/2);
  woodBridge(-200,-250,Math.PI/2);

  /* ── 존 경계 강: 늪↔정글 (z=100, x:-200~200) 이미 동서강이 커버 ── */
  /* ── 존 경계 강: 어두운숲↔화산 (z=375, x:-100~200) ── */
  var dfvLen=300;
  var dfvRiver=new THREE.Mesh(new THREE.PlaneGeometry(dfvLen,14),riverM.clone());
  dfvRiver.rotation.x=-Math.PI/2;dfvRiver.position.set(25,.08,375);p.add(dfvRiver);
  waterMeshes.push(dfvRiver);
  var dfvDepth=new THREE.Mesh(new THREE.PlaneGeometry(dfvLen,14),depthM);
  dfvDepth.rotation.x=-Math.PI/2;dfvDepth.position.set(25,-.06,375);p.add(dfvDepth);
  /* 어두운숲↔화산 다리 (강이 동서로 흐르므로 다리는 남북 방향 = rotY 0) */
  woodBridge(0,375,0);
  woodBridge(100,375,0);
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

  /* 바다 조명 제거 — 성능 최적화 */

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
  /* 기본 바닥 제거 — 존별 바닥만 사용 (z-fighting 방지) */

  /* 마을 (NW): 평탄 (-350,-350 중심) — 3-4배 확장, 다른 바닥보다 높게 */
  var villMat=new THREE.MeshLambertMaterial({color:0x4a8a3a,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
  var villGnd=new THREE.Mesh(new THREE.PlaneGeometry(480,480),villMat);
  villGnd.rotation.x=-Math.PI/2;villGnd.position.set(-350,.05,-350);villGnd.receiveShadow=true;scene.add(villGnd);

  /* 초원: x:-270~170, z:-520~-80 — 중심 (-50,-300) */
  makeDisplacedGround(440,440,24,24,0x5a9a3a, -50,0.01,-300);

  /* 늪 (W): x:-600~-200, z:-100~300 */
  makeDisplacedGround(440,440,24,24,0x3a5a2a, -400,0.015,100);

  /* 정글 (E): x:200~600, z:-100~300 */
  makeDisplacedGround(440,440,24,24,0x2a6a1a, 400,0.015,100);

  /* 어두운 숲 (SW): x:-500~-100, z:200~500 */
  makeDisplacedGround(440,340,24,20,0x1a3a12, -300,0.015,350);

  /* 화산 (SE): x:150~550, z:250~550 */
  makeDisplacedGround(440,340,24,20,0x2a1208, 350,0.015,400);

  /* 보스 (S center): x:-80~80, z:500~600 */
  makeDisplacedGround(180,120,12,8,0x1a0808, 0,0.015,550);

  /* 중앙 교차로 & 존 사이 간격 커버 — 섬 전체 바닥 */
  var centralMat=new THREE.MeshLambertMaterial({color:0x4a8030});
  var centralGnd=new THREE.Mesh(new THREE.PlaneGeometry(1400,1400),centralMat);
  centralGnd.rotation.x=-Math.PI/2;centralGnd.position.set(0,0,50);centralGnd.receiveShadow=true;scene.add(centralGnd);

  /* 바다 밑 커버 (깊은 곳, 겹침 없음) */
  var deepGnd=new THREE.Mesh(new THREE.PlaneGeometry(2000,2000),new THREE.MeshLambertMaterial({color:0x1a3a0a}));
  deepGnd.rotation.x=-Math.PI/2;deepGnd.position.set(0,-1,50);scene.add(deepGnd);
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
    /* 화산 lavaGlow 제거 — 성능 최적화 */
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
  scatterGroundDetail(scene,15,100,100,'grass',VX,VZ);
  scatterGroundDetail(scene,8,90,90,'stone',VX,VZ);
  scatterGroundDetail(scene,10,80,80,'flower',VX,VZ);

  /* 건물 주변 포인트 라이트 제거 — 성능 최적화 (횃불 라이트로 충분) */

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
  /* plazaBig 제거 — plaza와 z-fighting 방지 */

  /* ── 마을 입구 도로 포장 (게이트까지) ── */
  var pathM2=new THREE.MeshLambertMaterial({color:0xb8a060});
  for(var ri=0;ri<8;ri++){
    var ry=VZ-30-ri*12;
    var rd=new THREE.Mesh(new THREE.PlaneGeometry(10,.04),pathM2);
    rd.rotation.x=-Math.PI/2;rd.position.set(VX,.05,ry);
    rd.receiveShadow=true;scene.add(rd);
  }

  /* 횃불 — 4개 핵심 위치만 라이트 유지 (성능 최적화) */
  var torchPos=[
    [VX-10,VZ-2],[VX+10,VZ-2],
    [VX-10,VZ-18],[VX+10,VZ-18],
    [VX-2,VZ-26],[VX+2,VZ-26],
    [VX-38,VZ-8],[VX+38,VZ-8],
    [VX-44,VZ-22],[VX+44,VZ-22],
    [VX-8,VZ-66],[VX+8,VZ-66],
    [VX-8,VZ-80],[VX+8,VZ-80],
  ];
  /* 광장 핵심 4개 위치만 PointLight */
  var torchLightPos=[[VX-10,VZ-2],[VX+10,VZ-2],[VX-38,VZ-8],[VX+38,VZ-8]];
  var poleMat=new THREE.MeshLambertMaterial({color:0x5a3a1a});
  var fireMat=new THREE.MeshBasicMaterial({color:0xff8820});
  torchPos.forEach(function(tp){
    var tx=tp[0],tz=tp[1];
    var pole=new THREE.Mesh(new THREE.CylinderGeometry(.06,.08,2,6),poleMat);pole.position.set(tx,1,tz);pole.castShadow=true;scene.add(pole);
    var fire=new THREE.Mesh(new THREE.SphereGeometry(.13,8,8),fireMat);fire.position.set(tx,2.2,tz);scene.add(fire);
  });
  torchLightPos.forEach(function(tp){
    var pl=new THREE.PointLight(0xff8830,1.8,20);pl.position.set(tp[0],2.2,tp[1]);scene.add(pl);
  });

  /* ── 마을 나무 — 확장 구역에 더 많이 ── */
  var treeLayout=[
    /* 광장 주변 */
    [VX-22,VZ-2],[VX+22,VZ-20],
    /* 주거 구역 나무 */
    [VX-60,VZ+25],[VX-30,VZ+26],[VX+5,VZ+28],
    [VX+20,VZ+15],
    /* 여관 주변 */
    [VX-50,VZ-5],
    /* 도서관 주변 */
    [VX+58,VZ+5],
    /* 길드 주변 */
    [VX-25,VZ-80],[VX-22,VZ-55],
    /* 입구 양옆 나무 */
    [VX-22,VZ-40],[VX+22,VZ-56],
    /* 시장 구역 */
    [VX-62,VZ-10],
  ];
  treeLayout.forEach(function(pp,idx){
    /* 마을 나무 다양화: 기본 소나무 + 간간이 참나무/버드나무 */
    var ttype=(idx%7===3)?1:(idx%7===6)?2:0;
    mkTree(pp[0],pp[1],.8+Math.random()*.6,scene,ttype);
  });

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

/* ════════════ 존별 앰비언트 파티클 시스템 ════════════ */
function buildZoneParticles(){
  /* ── 공유 스프라이트 텍스처 헬퍼 ── */
  function mkSpriteTex(innerColor,outerColor){
    var c=document.createElement('canvas');c.width=32;c.height=32;
    var ctx=c.getContext('2d');
    var g=ctx.createRadialGradient(16,16,0,16,16,16);
    g.addColorStop(0,innerColor);g.addColorStop(.5,outerColor);g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g;ctx.fillRect(0,0,32,32);
    return new THREE.CanvasTexture(c);
  }

  function addParticleSystem(COUNT,cx,cz,spread,yMin,yMax,color,size,type){
    var pos=new Float32Array(COUNT*3);
    var baseY=new Float32Array(COUNT);
    var phases=new Float32Array(COUNT);
    var maxY_arr=new Float32Array(COUNT);
    var minY_arr=new Float32Array(COUNT);
    for(var i=0;i<COUNT;i++){
      pos[i*3]=cx+(Math.random()-.5)*spread;
      var y=yMin+Math.random()*(yMax-yMin);
      pos[i*3+1]=y;
      pos[i*3+2]=cz+(Math.random()-.5)*spread;
      baseY[i]=y;phases[i]=Math.random()*Math.PI*2;
      maxY_arr[i]=yMax;minY_arr[i]=yMin;
    }
    var geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
    var tex=mkSpriteTex(color.inner,color.outer);
    var mat=new THREE.PointsMaterial({
      color:color.tint||0xffffff,size:size,map:tex,transparent:true,depthWrite:false,
      blending:THREE.AdditiveBlending,sizeAttenuation:true
    });
    var pts=new THREE.Points(geo,mat);
    scene.add(pts);
    _zoneParticles.push({points:pts,positions:pos,baseY:baseY,phases:phases,maxY:maxY_arr,minY:minY_arr,type:type});
  }

  /* 마을 — 따뜻한 황금 먼지 */
  addParticleSystem(40,-350,-350,160,0.3,3.5,
    {inner:'rgba(255,220,100,1)',outer:'rgba(255,180,50,.3)',tint:0xffdd66},.22,'dust');

  /* 초원 — 민들레 씨앗 (흰색 부유) */
  addParticleSystem(35,-50,-300,200,0.2,4.0,
    {inner:'rgba(255,255,255,1)',outer:'rgba(200,255,200,.2)',tint:0xeeffee},.28,'seed');

  /* 늪 — 안개 부유물 (연녹색) */
  addParticleSystem(30,-400,100,180,0.1,2.5,
    {inner:'rgba(150,200,100,.8)',outer:'rgba(80,130,50,.1)',tint:0x88cc66},.35,'wisp');

  /* 화산 — 불씨 (주황-빨강) */
  addParticleSystem(45,350,400,200,0.5,12,
    {inner:'rgba(255,140,20,1)',outer:'rgba(255,60,0,.3)',tint:0xff6600},.25,'ember');

  /* 어두운 숲 — 파란 반딧불 */
  addParticleSystem(25,-300,350,160,0.3,3.0,
    {inner:'rgba(100,180,255,1)',outer:'rgba(40,80,200,.3)',tint:0x44aaff},.30,'dust');
}

/* ════════════ 스카이돔 ════════════ */
function buildSkydome(){
  /* 대형 구체 — 내부 면을 바라보도록 */
  var skyGeo=new THREE.SphereGeometry(900,32,16);
  _skyUniforms={
    topColor:{value:new THREE.Color(0x3a8fd8)},
    horizonColor:{value:new THREE.Color(0xa8d8ea)},
    offset:{value:0.25},
    exponent:{value:0.5}
  };
  var skyMat=new THREE.ShaderMaterial({
    uniforms:_skyUniforms,
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
  var sky=new THREE.Mesh(skyGeo,skyMat);window._skyMesh=sky;
  scene.add(sky);
}

/* ════════════ 구름 빌드 ════════════ */
function buildClouds(){
  /* 반투명 흰 구름 평면들 — 서서히 동→서 흐름 */
  var cloudMat=new THREE.MeshLambertMaterial({
    color:0xffffff,transparent:true,opacity:.55,depthWrite:false
  });
  var cloudDefs=[
    /* [x, y, z, scaleX, scaleZ] */
    [-200, 180, -300, 80, 40],
    [100,  160, -500, 110, 55],
    [300,  200,  100, 90,  45],
    [-400, 170,  200, 70,  35],
    [0,    190, -100, 100, 50],
    [200,  175,  300, 85,  42],
    [-100, 185, -400, 95,  48],
    [400,  165, -200, 75,  38],
    [-300, 195,  400, 120, 60],
    [150,  172, -250, 65,  32]
  ];
  cloudDefs.forEach(function(cd,i){
    var g=new THREE.Group();
    /* 구름 = 여러 구체로 구성 */
    var puffs=[
      [0,0,0,cd[3]*0.5,cd[4]*0.5],
      [cd[3]*0.22,cd[4]*0.08,0,cd[3]*0.35,cd[4]*0.38],
      [-cd[3]*0.2,cd[4]*0.05,0,cd[3]*0.3,cd[4]*0.32],
      [cd[3]*0.05,cd[4]*0.12,cd[4]*0.15,cd[3]*0.28,cd[4]*0.28]
    ];
    puffs.forEach(function(pf){
      var m=new THREE.Mesh(new THREE.SphereGeometry(1,7,5),cloudMat);
      /* 구름: 넓고 납작하게 — Y를 얇게 */
      m.scale.set(pf[3],6+Math.random()*4,pf[4]);
      m.position.set(pf[0],pf[1],pf[2]);
      g.add(m);
    });
    g.position.set(cd[0],cd[1],cd[2]);
    scene.add(g);
    _cloudMeshes.push(g);
    _cloudStartX.push(cd[0]);
  });
}

/* ════════════ 태양 스프라이트 ════════════ */
function buildSunSprite(){
  /* 캔버스 텍스처로 방사형 태양 글로우 */
  var cvs=document.createElement('canvas');cvs.width=128;cvs.height=128;
  var ctx=cvs.getContext('2d');
  var grad=ctx.createRadialGradient(64,64,0,64,64,64);
  grad.addColorStop(0,'rgba(255,255,200,1)');
  grad.addColorStop(0.15,'rgba(255,220,80,.9)');
  grad.addColorStop(0.4,'rgba(255,160,30,.4)');
  grad.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=grad;ctx.fillRect(0,0,128,128);
  var tex=new THREE.CanvasTexture(cvs);
  var sunMat=new THREE.SpriteMaterial({
    map:tex,color:0xffffff,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false
  });
  var sun=new THREE.Sprite(sunMat);
  sun.scale.set(80,80,1);
  sun.position.set(300,280,-500);
  scene.add(sun);
  window._sunSprite=sun;
}

/* ════════════ initScene ════════════ */
function initScene(){
  initFadeOverlay();
  var canvas=document.getElementById('gc');
  renderer=new THREE.WebGLRenderer({canvas:canvas,antialias:true,logarithmicDepthBuffer:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));

  /* ── 그림자 비활성화 — 성능 + 깜빡임 방지 ── */
  renderer.shadowMap.enabled=false;

  /* ── 톤매핑 제거 (성능 최적화) ── */
  /* renderer.toneMapping=THREE.ACESFilmicToneMapping; */
  /* renderer.toneMappingExposure=1.1; */

  /* scene 배경은 스카이돔이 대신하므로 투명하게 */
  scene=new THREE.Scene();
  scene.background=new THREE.Color(0x87CEEB);

  /* ── 대기 안개 — 부드러운 블루-화이트 안개로 깊이감 강화 ── */
  scene.fog=new THREE.FogExp2(0xa8d8ea,.0015);

  camera=new THREE.PerspectiveCamera(60,1,1,1200);
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
  /* villageAmbient2 제거 — 성능 최적화 */

  /* 3) 태양(방향광) — 따뜻한 황금빛, 그림자 활성화 */
  var sun=new THREE.DirectionalLight(0xfff0d0,.9);
  sun.position.set(-120,200,400);
  sun.castShadow=true;
  sun.shadow.mapSize.width=2048;
  sun.shadow.mapSize.height=2048;
  sun.shadow.camera.near=0.5;
  sun.shadow.camera.far=200;
  sun.shadow.camera.left=-80;
  sun.shadow.camera.right=80;
  sun.shadow.camera.top=80;
  sun.shadow.camera.bottom=-80;
  sun.shadow.bias=-0.005;
  sun.shadow.normalBias=0.05;
  scene.add(sun);
  window._sun=sun;

  /* 달 + 별 */
  var moon=new THREE.Mesh(new THREE.SphereGeometry(10,16,16),new THREE.MeshBasicMaterial({color:0xfffde8}));
  moon.position.set(-200,280,-400);scene.add(moon);
  window._moonMesh=moon;
  /* moonL 제거 — 성능 최적화 */

  var STAR_COUNT=4000,sp=new Float32Array(STAR_COUNT*3);
  for(var i=0;i<STAR_COUNT;i++){
    var th=Math.random()*Math.PI*2,ph=Math.acos(2*Math.random()-1)*0.45,r=600;
    sp[i*3]=r*Math.sin(ph)*Math.cos(th);sp[i*3+1]=r*Math.abs(Math.cos(ph))+5;sp[i*3+2]=r*Math.sin(ph)*Math.sin(th);
  }
  var sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.BufferAttribute(sp,3));
  var starPoints=new THREE.Points(sg,new THREE.PointsMaterial({color:0xffffff,size:.3,sizeAttenuation:true}));
  scene.add(starPoints);
  window._starPoints=starPoints;

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

  /* 구름 + 태양 스프라이트 */
  buildClouds();
  buildSunSprite();

  /* 존별 앰비언트 파티클 */
  buildZoneParticles();

  /* 플레이어 */
  var ph2=mkHuman(0x2a6a3a,0xddcc99,(typeof playerGender!=='undefined')?playerGender:'male');
  PL.group=ph2.group;PL.body=ph2.body;PL.head=ph2.head;PL.bodyMat=ph2.bodyMat;
  PL.legL=ph2.legL;PL.legR=ph2.legR;
  PL.armL=ph2.armL;PL.armR=ph2.armR;PL.armRPivot=ph2.armRPivot;
  PL.weaponMesh=null;PL.hatMesh=null;PL.capeMesh=null;PL.bobT=0;PL.atkAnim=0;PL.atkPhase=0;
  /* 플레이어도 그림자 */
  PL.group.traverse(function(c){if(c.isMesh){c.castShadow=true;c.receiveShadow=true;}});
  var ws=WORLD_SPAWN;PL.group.position.set(ws[0],0,ws[1]);scene.add(PL.group);

  /* 플레이어 이름표 */
  var lov=document.getElementById('lov');
  var ple=document.createElement('div');ple.className='llabel plr';ple.id='ple';ple.textContent=myName;lov.appendChild(ple);

  /* ── Bloom 비활성화 — 성능 우선 ── */
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

/* 카메라 모드: 'follow' (기본, 자유 회전) / 'back' (플레이어 등뒤 고정) */
var cameraMode='follow';
function toggleCameraMode(){
  if(cameraMode==='follow'){
    cameraMode='back';
    if(typeof addChat==='function')addChat('sys','[시스템]','카메라 모드: 등 뒤 고정');
  }else{
    cameraMode='follow';
    if(typeof addChat==='function')addChat('sys','[시스템]','카메라 모드: 자유 회전');
  }
}

function updCam(){
  var p=PL.group.position;
  if(insideBuilding){
    /* 건물 내부: 탑다운 고정 카메라 — 건물 크기에 맞게 높이 조절 */
    var camH=(insideBuilding==='모험가 길드')?35:25;
    var itx=p.x,ity=p.y+camH,itz=p.z+5;
    camera.position.x+=(itx-camera.position.x)*.2;
    camera.position.y+=(ity-camera.position.y)*.2;
    camera.position.z+=(itz-camera.position.z)*.2;
    camera.lookAt(p.x,p.y,p.z);
    return;
  }
  /* 등 뒤 고정 모드: 플레이어 회전 방향을 기준으로 카메라가 뒤에 따라붙음 */
  if(cameraMode==='back'){
    var ry=PL.group.rotation.y;
    /* cYaw를 플레이어 회전에 동기화 — WASD 조작이 어긋나지 않도록 */
    if(typeof cYaw!=='undefined')cYaw=ry+Math.PI;
    /* 플레이어 뒤쪽 = -forward 방향 */
    var backDist=10,camHeight=5;
    var bx=p.x-Math.sin(ry)*backDist;
    var bz=p.z-Math.cos(ry)*backDist;
    var lr=.15;
    camera.position.x+=(bx-camera.position.x)*lr;
    camera.position.y+=(p.y+camHeight-camera.position.y)*lr;
    camera.position.z+=(bz-camera.position.z)*lr;
    camera.lookAt(p.x,p.y+1.2,p.z);
    if(window._sun){
      window._sun.position.set(p.x-60,p.y+120,p.z+80);
      window._sun.target.position.set(p.x,p.y,p.z);
      window._sun.target.updateMatrixWorld();
    }
    return;
  }
  var tx=p.x+14*Math.sin(cYaw)*Math.cos(cPitch);
  var ty=p.y+14*Math.sin(cPitch)+2.5;
  var tz=p.z+14*Math.cos(cYaw)*Math.cos(cPitch);
  var lr=.12;
  camera.position.x+=(tx-camera.position.x)*lr;
  camera.position.y+=(Math.max(ty,.6)-camera.position.y)*lr;
  camera.position.z+=(tz-camera.position.z)*lr;
  camera.lookAt(p.x,p.y+1.2,p.z);
  /* 태양 그림자를 플레이어 주변으로 따라가게 */
  if(window._sun){
    window._sun.position.set(p.x-60,p.y+120,p.z+80);
    window._sun.target.position.set(p.x,p.y,p.z);
    window._sun.target.updateMatrixWorld();
  }
}

function updNpcs(t){
  npcs.forEach(function(n){
    /* 내부 NPC는 baseY 기준 bob, 외부 NPC는 지면(0) 기준 bob */
    var _nBaseY=(n.label)?n.mesh.position.y:0;/* 내부 NPC는 현재 y 유지 */
    if(!n.label)n.mesh.position.y=Math.sin(t*.9+n.bobOff)*.04;
    var dx=PL.group.position.x-n.mesh.position.x,dz=PL.group.position.z-n.mesh.position.z;
    if(Math.sqrt(dx*dx+dz*dz)<10){var tr=Math.atan2(dx,dz);n.mesh.rotation.y+=(tr-n.mesh.rotation.y)*.04;}
  });
  /* 내부 NPC 라벨 업데이트 */
  if(window._interiorNpcs&&insideBuilding){
    window._interiorNpcs.forEach(function(in_){
      var pos=in_.group.position.clone();
      pos.y+=2.2;
      pos.project(camera);
      var cc=document.getElementById('cc');
      if(cc){
        var hw=cc.clientWidth/2,hh=cc.clientHeight/2;
        var sx=(pos.x*hw+hw),sy=(-pos.y*hh+hh);
        in_.label.style.left=sx+'px';
        in_.label.style.top=sy+'px';
        in_.label.style.display='block';
        /* E 대화 표시 */
        if(in_.interact){
          in_.interact.style.left=sx+'px';
          in_.interact.style.top=(sy+16)+'px';
          var isClose=closestNpc&&closestNpc===in_.npcObj;
          in_.interact.style.display=isClose?'block':'none';
        }
      }
    });
  }else if(window._interiorNpcs){
    window._interiorNpcs.forEach(function(in_){
      in_.label.style.display='none';
      if(in_.interact)in_.interact.style.display='none';
    });
  }
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

  /* ── 반딧불 — 3프레임마다 업데이트 ── */
  if(fireflyPoints&&fireflyPositions&&_vfxFrame%3===0){
    var pos=fireflyPositions;
    var COUNT=pos.length/3;
    for(var i=0;i<COUNT;i++){
      pos[i*3+1]=fireflyBaseY[i]+Math.sin(t*1.1+fireflyPhases[i])*0.6;
    }
    fireflyPoints.geometry.attributes.position.needsUpdate=true;
  }

  /* ── 존별 앰비언트 파티클 업데이트 — 4프레임마다 ── */
  if(_vfxFrame%4===0){
    for(var zi=0;zi<_zoneParticles.length;zi++){
      var zp=_zoneParticles[zi];
      var zpos=zp.positions;
      var zCOUNT=zpos.length/3;
      for(var i=0;i<zCOUNT;i++){
        if(zp.type==='dust'){
          zpos[i*3+1]=zp.baseY[i]+Math.sin(t*0.6+zp.phases[i])*0.4+Math.sin(t*1.3+zp.phases[i]*1.7)*0.2;
          zpos[i*3]+=Math.sin(t*0.4+zp.phases[i])*0.004;
        }else if(zp.type==='ember'){
          zp.baseY[i]+=0.02;
          if(zp.baseY[i]>zp.maxY[i]){zp.baseY[i]=zp.minY[i];}
          zpos[i*3+1]=zp.baseY[i]+Math.sin(t*2+zp.phases[i])*0.15;
          zpos[i*3]+=Math.sin(t*1.5+zp.phases[i])*0.006;
        }else if(zp.type==='wisp'){
          zpos[i*3+1]=zp.baseY[i]+Math.sin(t*0.5+zp.phases[i])*0.6;
          zpos[i*3]+=Math.cos(t*0.3+zp.phases[i])*0.008;
          zpos[i*3+2]+=Math.sin(t*0.35+zp.phases[i]*0.8)*0.008;
        }else if(zp.type==='seed'){
          zp.baseY[i]-=0.005+Math.random()*0.003;
          if(zp.baseY[i]<-1)zp.baseY[i]=3+Math.random()*3;
          zpos[i*3+1]=zp.baseY[i]+Math.sin(t*0.8+zp.phases[i])*0.3;
          zpos[i*3]+=Math.sin(t*0.5+zp.phases[i])*0.01;
          zpos[i*3+2]+=Math.cos(t*0.4+zp.phases[i]*1.2)*0.01;
        }
      }
      zp.points.geometry.attributes.position.needsUpdate=true;
    }
  }

  /* ── 물 버텍스 애니메이션 (sine wave) — 6프레임마다 ── */
  /* PlaneGeometry: 로컬XY평면, rotation.x=-PI/2 적용 시 localZ→worldY */
  if(_vfxFrame%6===0){
    for(var wi2=0;wi2<_animatedWater.length;wi2++){
      var aw=_animatedWater[wi2];
      var wgeo=aw.mesh.geometry;
      var wpos=wgeo.attributes.position;
      for(var wvi=0;wvi<wpos.count;wvi++){
        var wx=aw.origPositions[wvi*3];
        var wy=aw.origPositions[wvi*3+1];
        /* localX=wx, localY=wy → worldX=wx, worldZ=-wy — sine 파 */
        var wave=Math.sin(wx*0.08+t*1.2)*0.1+Math.cos(wy*0.1+t*0.9)*0.07;
        /* localZ=worldY (height after rotation) */
        wpos.setZ(wvi,wave);
      }
      wpos.needsUpdate=true;
      wgeo.computeVertexNormals();
    }
  }

  /* ── 강물 UV 오프셋 애니메이션 ── */
  for(var wi=0;wi<waterMeshes.length;wi++){
    var wm=waterMeshes[wi];
    if(wm.material&&wm.material.map){
      wm.material.map.offset.y+=0.0015;
    }
  }

  /* ── 구름 이동 (서서히 +x 방향으로) ── */
  if(_vfxFrame%2===0){
    for(var ci=0;ci<_cloudMeshes.length;ci++){
      _cloudMeshes[ci].position.x+=0.04;
      /* 맵 범위 넘으면 반대쪽으로 */
      if(_cloudMeshes[ci].position.x>700){
        _cloudMeshes[ci].position.x=_cloudStartX[ci]-700;
      }
    }
  }

  /* ── 스카이 낮 변화 — daynight.js가 없을 때만 폴백 ── */
  if(_skyUniforms&&_vfxFrame%10===0&&typeof tickDayNight==='undefined'){
    var dayT=(Math.sin(t/160*Math.PI*2)*0.5+0.5);
    var tc=new THREE.Color(0x3a8fd8).lerp(new THREE.Color(0x1a4a88),dayT*0.25);
    var hc=new THREE.Color(0xa8d8ea).lerp(new THREE.Color(0xeeddbb),dayT*0.2);
    _skyUniforms.topColor.value.copy(tc);
    _skyUniforms.horizonColor.value.copy(hc);
  }

  /* LOD 업데이트 */
  updateLOD();
}

function chkNpc(){
  closestNpc=null;var md=7.0;
  npcs.forEach(function(n){
    /* 내부 NPC(n.label 있음)는 건물 내부일 때만, 외부 NPC는 밖일 때만 감지 */
    var isInterior=!!(n.label);
    if(isInterior&&!insideBuilding)return;
    if(!isInterior&&insideBuilding)return;
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

/* ── 마을 나무 방벽 (높은 통나무 벽) ── */
function mkFences(parent){
  var p=parent||scene;
  var logM=new THREE.MeshLambertMaterial({color:0x5a3a12});
  var logDarkM=new THREE.MeshLambertMaterial({color:0x3a2808});
  var VX=-350,VZ=-350;
  var wallH=3.5; /* 플레이어보다 높은 벽 */
  var R=95; /* 마을 벽 반경 */

  /* 통나무 벽 한 구간 생성 */
  function wallSegment(x1,z1,x2,z2){
    var dx=x2-x1,dz=z2-z1;
    var len=Math.sqrt(dx*dx+dz*dz);
    var ang=Math.atan2(dx,dz);
    var count=Math.floor(len/2.4);
    for(var i=0;i<=count;i++){
      var t=i/count;
      var lx=x1+dx*t,lz=z1+dz*t;
      var h=wallH+Math.random()*.8-0.4;/* 높이 약간 랜덤 */
      var log=new THREE.Mesh(new THREE.CylinderGeometry(.25,.3,h,6),logM);
      log.position.set(lx,h/2,lz);log.castShadow=true;log.receiveShadow=true;p.add(log);
      /* 뾰족한 끝 */
      var tip=new THREE.Mesh(new THREE.ConeGeometry(.25,.6,6),logDarkM);
      tip.position.set(lx,h+.3,lz);tip.castShadow=true;p.add(tip);
    }
    /* 가로 보강대 */
    [wallH*.3,wallH*.7].forEach(function(hy){
      var beam=new THREE.Mesh(new THREE.BoxGeometry(.15,.2,len),logDarkM);
      beam.position.set((x1+x2)/2,hy,(z1+z2)/2);
      beam.rotation.y=ang;beam.castShadow=true;p.add(beam);
    });
  }

  /* 마을 둘레 벽 — 문 부분만 비움 */
  /* 북쪽 벽 */
  wallSegment(VX-R,VZ+R, VX+R,VZ+R);
  /* 남쪽 벽 — 막힌 벽 (문 없음) */
  wallSegment(VX-R,VZ-R, VX+R,VZ-R);
  /* 서쪽 벽 */
  wallSegment(VX-R,VZ-R, VX-R,VZ+R);
  /* 동쪽 벽 — 문 (중앙 8유닛 비움, 초원 방향) */
  wallSegment(VX+R,VZ-R, VX+R,VZ-6);
  wallSegment(VX+R,VZ+6, VX+R,VZ+R);

  /* 남쪽 벽 — 막힌 벽 (문/기둥 없음) */

  /* 동쪽 문 기둥 */
  [-6,6].forEach(function(gz){
    var gatePost2=new THREE.Mesh(new THREE.CylinderGeometry(.4,.5,wallH+1,8),logDarkM);
    gatePost2.position.set(VX+R,(wallH+1)/2,VZ+gz);gatePost2.castShadow=true;p.add(gatePost2);
    var gateTop2=new THREE.Mesh(new THREE.SphereGeometry(.5,6,4),logM);
    gateTop2.position.set(VX+R,wallH+1,VZ+gz);p.add(gateTop2);
  });
  var gateBeam2=new THREE.Mesh(new THREE.BoxGeometry(.5,.4,12),logDarkM);
  gateBeam2.position.set(VX+R,wallH+.5,VZ);gateBeam2.castShadow=true;p.add(gateBeam2);

  /* 횃불 (문 양쪽) */
  var torchM=new THREE.MeshLambertMaterial({color:0xff6600,emissive:new THREE.Color(0xff4400),emissiveIntensity:.8});
  /* 남쪽 횃불 제거됨 */
  [[VX+R,-6],[VX+R,6]].forEach(function(tp){
    var flame=new THREE.Mesh(new THREE.SphereGeometry(.2,5,4),torchM);
    flame.position.set(tp[0],wallH+1.5,VZ+tp[1]);p.add(flame);
  });
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

  g.position.set(-255,0,-350);g.rotation.y=Math.PI/2;p.add(g);
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
  flowerBed(-342,-368, 4);
  /* 여관 앞 */
  flowerBed(-388,-345, 5);
  /* 도서관 앞 */
  flowerBed(-314,-345, 5);
  /* 주거 구역 길가 */
  flowerBed(-368,-310, 4);
  flowerBed(-310,-310, 4);
  /* 마을 입구 게이트 앞 */
  flowerBed(-360,-440, 5);
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
  bench(-346,-362,  Math.PI);
  /* 여관 앞 길가 */
  bench(-388,-360, Math.PI/2);
  /* 도서관 앞 길가 */
  bench(-316,-370, -Math.PI/2);
  /* 주거 구역 길가 */
  bench(-370,-320, 0);
  bench(-310,-320, 0);
  /* 길드 앞 광장 */
  bench(-335,-395, 0);
  /* 입구 길가 */
  bench(-360,-430, Math.PI/2);
}

/* ── 가로등 (중세 등불) ── */
function mkLampPosts(parent){
  var p=parent||scene;
  var ironM=new THREE.MeshLambertMaterial({color:0x2a2a2a});
  var baseM=new THREE.MeshLambertMaterial({color:0x4a4040});
  var glassM=new THREE.MeshLambertMaterial({color:0xffdd88,emissive:new THREE.Color(0xffaa44),emissiveIntensity:.6,transparent:true,opacity:0.7});
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
    /* 포인트 라이트 제거 — 성능 최적화 (emissive 머티리얼로 표현) */
    g.position.set(x,0,z);p.add(g);
  }

  /* 광장 주변 */
  lampPost(-356,-352);  lampPost(-344,-368);
  /* 광장 → 여관 길 */
  lampPost(-378,-360);
  /* 광장 → 무기상점 길 */
  lampPost(-322,-360);
  /* 남북 메인 도로 (광장 → 게이트) */
  lampPost(-350,-398);
  lampPost(-350,-438);
  /* 주거 구역 도로 */
  lampPost(-368,-320); lampPost(-310,-320);
  /* 길드 앞 */
  lampPost(-328,-386);
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
  /* 황금빛 발광 제거 — 성능 최적화 */
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
  var MX=-50,MZ=-300; /* 초원 중심 오프셋 */
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

  /* 쓰러진 통나무 — 제거됨 */

  /* ── 야생화 패치 ── */
  for(var wfi=0;wfi<30;wfi++){
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
   [-100,80],[-50,120],
   [-10,50],[-60,20]
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

  /* 돌담 — 제거됨 */

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

  /* ── 추가 나무 (10그루) ── */
  [[-40,-90],[40,-60],[-80,30],[80,50],[-50,70],
   [-100,100],[-30,130],[-60,-60],[90,40],[0,140]
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

  /* ── 풀 날 스프라이트 (초원 지면 디테일) ── */
  (function(){
    var g=new THREE.Group();
    var grassBladeMat=new THREE.MeshLambertMaterial({color:0x4a9a2a,side:THREE.DoubleSide});
    var grassBladeMat2=new THREE.MeshLambertMaterial({color:0x3a7a1a,side:THREE.DoubleSide});
    /* 삼각형 풀날 — 초원에 40개 */
    for(var gi=0;gi<40;gi++){
      var gx=MX+(Math.random()-.5)*320,gz=MZ+(Math.random()-.5)*320;
      var gh=.3+Math.random()*.35;
      var gm=Math.random()>.4?grassBladeMat:grassBladeMat2;
      /* 빌보드: 풀날을 2개 직교로 배치 */
      var blade1=new THREE.Mesh(
        new THREE.PlaneGeometry(.12+Math.random()*.08,gh),gm);
      blade1.position.set(gx,getTerrainY(gx,gz)+gh/2,gz);
      blade1.rotation.y=Math.random()*Math.PI;
      blade1.rotation.z=(Math.random()-.5)*.3;
      g.add(blade1);
    }
    scene.add(g);
    /* LOD 등록 */
    registerLOD(g,MX,MZ,250);
  })();

  /* ── 벚나무 (Cherry Blossom) — 초원에 희귀하게 ── */
  [[MX-30,MZ-40],[MX-80,MZ+40]].forEach(function(pp){
    mkTree(pp[0],pp[1],.85+Math.random()*.3,scene,3);
  });
  /* 참나무 — 초원 곳곳 */
  [[MX-60,MZ+30],[MX+50,MZ+50]].forEach(function(pp){
    mkTree(pp[0],pp[1],.9+Math.random()*.4,scene,1);
  });
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
    /* 신전 조명 제거 — 성능 최적화 */
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
    /* lantFL 제거 — 성능 최적화 */
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
  [[FX-80,FZ-80,2.2],[FX+80,FZ-20,2.2],
   [FX-50,FZ+80,2.1],[FX+50,FZ+40,2.0]
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
        /* 클리어링 횃불 라이트 제거 — 성능 최적화 */
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

  /* ── 숲 추가 나무 7그루 ── */
  (function(){
    var fTrunkM=new THREE.MeshLambertMaterial({color:0x1a0e05});
    var fLeafM=new THREE.MeshLambertMaterial({color:0x1a4a12});
    var fLeaf2M=new THREE.MeshLambertMaterial({color:0x150a20});
    [[FX-100,FZ-90],[FX+90,FZ-10],[FX,FZ-50],
     [FX-110,FZ+20],[FX+100,FZ+90],
     [FX-120,FZ+120],[FX,FZ+90]
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

  /* ── 낙엽 (숲 바닥) ── */
  (function(){
    var leafG=new THREE.Group();
    var leafColors=[
      new THREE.MeshLambertMaterial({color:0x6a3a10,side:THREE.DoubleSide}),
      new THREE.MeshLambertMaterial({color:0x8a4a15,side:THREE.DoubleSide}),
      new THREE.MeshLambertMaterial({color:0x4a2a08,side:THREE.DoubleSide}),
      new THREE.MeshLambertMaterial({color:0x5a3510,side:THREE.DoubleSide})
    ];
    for(var li=0;li<30;li++){
      var lx=FX+(Math.random()-.5)*280,lz=FZ+(Math.random()-.5)*280;
      var lm=leafColors[Math.floor(Math.random()*4)];
      var leaf=new THREE.Mesh(new THREE.PlaneGeometry(.2+Math.random()*.15,.14+Math.random()*.1),lm);
      leaf.rotation.x=-Math.PI/2+Math.random()*.2-.1;
      leaf.rotation.z=Math.random()*Math.PI;
      leaf.position.set(lx,getTerrainY(lx,lz)+.02,lz);
      leafG.add(leaf);
    }
    scene.add(leafG);
    registerLOD(leafG,FX,FZ,300);
  })();

  /* ── 버드나무/참나무 추가 (숲 다양화) ── */
  [[FX-60,FZ-30]].forEach(function(pp){
    mkTree(pp[0],pp[1],.9+Math.random()*.4,scene,2);
  });
  [[FX+60,FZ+30]].forEach(function(pp){
    mkTree(pp[0],pp[1],1+Math.random()*.4,scene,1);
  });

  /* ── 숲 경로 (어두운 흙길 디스크) ── */
  (function(){
    var fpathM=new THREE.MeshLambertMaterial({color:0x4a3a2a});
    var forestPath=[
      [FX-70,FZ-60],[FX-55,FZ-40],[FX-40,FZ-20],[FX-20,FZ,],[FX,FZ+20],
      [FX+20,FZ+40],[FX+35,FZ+60],[FX+50,FZ+80],[FX+60,FZ+100]
    ];
    forestPath.forEach(function(pt){
      var disc=new THREE.Mesh(new THREE.CircleGeometry(2,24),fpathM);
      disc.rotation.x=-Math.PI/2;
      disc.position.set(pt[0],getTerrainY(pt[0],pt[1])+.06,pt[1]);
      disc.receiveShadow=true;scene.add(disc);
    });
    /* 보조 경로 */
    var forestPath2=[
      [FX-80,FZ+20],[FX-60,FZ+40],[FX-40,FZ+60],[FX-20,FZ+80],[FX,FZ+100]
    ];
    forestPath2.forEach(function(pt){
      var disc=new THREE.Mesh(new THREE.CircleGeometry(1.8,24),fpathM);
      disc.rotation.x=-Math.PI/2;
      disc.position.set(pt[0],getTerrainY(pt[0],pt[1])+.06,pt[1]);
      disc.receiveShadow=true;scene.add(disc);
    });
  })();

  /* ── 석조 아치/폐허 게이트 추가 ── */
  (function(){
    var ruinM=new THREE.MeshLambertMaterial({color:0x2a2018});
    var ruinDk=new THREE.MeshLambertMaterial({color:0x1a1808});
    /* 부서진 벽 세그먼트들 */
    [[FX-90,FZ-30,0],[FX+70,FZ+10,0.5],[FX-20,FZ+110,1.2]].forEach(function(wd){
      var g=new THREE.Group();
      /* 남은 벽 부분 */
      var wall=new THREE.Mesh(new THREE.BoxGeometry(3.5,2.5,.5),ruinM);
      wall.position.set(0,1.25,0);wall.castShadow=true;wall.receiveShadow=true;g.add(wall);
      /* 위쪽 부서진 흉벽 */
      [-1.2,0,1.2].forEach(function(mx){
        if(Math.random()<.4)return;
        var merlon=new THREE.Mesh(new THREE.BoxGeometry(.7,.8,.55),ruinM);
        merlon.position.set(mx,2.9,0);merlon.castShadow=true;g.add(merlon);
      });
      /* 무너진 돌 더미 */
      for(var ri=0;ri<3;ri++){
        var rub=new THREE.Mesh(new THREE.BoxGeometry(.5+Math.random()*.3,.3+Math.random()*.3,.4+Math.random()*.2),ruinDk);
        rub.position.set((Math.random()-.5)*3,.18,(.5+Math.random())*(Math.random()<.5?1:-1));
        rub.rotation.y=Math.random()*Math.PI;rub.castShadow=true;g.add(rub);
      }
      g.position.set(wd[0],getTerrainY(wd[0],wd[1]),wd[1]);g.rotation.y=wd[2];scene.add(g);
    });
  })();

  /* ── 버려진 야영지 2곳 (돌 링 + 탄 통나무 + 희미한 빛) ── */
  (function(){
    var charM=new THREE.MeshLambertMaterial({color:0x111008});
    var ashCM=new THREE.MeshLambertMaterial({color:0x2a2810});
    var campfireLight1=new THREE.PointLight(0x661100,.5,8);
    var campfireLight2=new THREE.PointLight(0x661100,.4,7);
    [[FX-100,FZ-10,campfireLight1],[FX+40,FZ+110,campfireLight2]].forEach(function(cd){
      var cx=cd[0],cz=cd[1],clight=cd[2];
      /* 재 원 */
      var ashDisc=new THREE.Mesh(new THREE.CircleGeometry(1.0,8),ashCM);
      ashDisc.rotation.x=-Math.PI/2;ashDisc.position.set(cx,.012,cz);scene.add(ashDisc);
      /* 돌 링 */
      for(var ci=0;ci<7;ci++){
        var ca=ci/7*Math.PI*2;
        var st=new THREE.Mesh(new THREE.DodecahedronGeometry(.2,0),new THREE.MeshLambertMaterial({color:0x555040}));
        st.position.set(cx+Math.cos(ca)*.95,getTerrainY(cx,cz)+.12,cz+Math.sin(ca)*.95);
        st.castShadow=true;scene.add(st);
      }
      /* 탄 통나무 */
      [0,Math.PI*.4,Math.PI*.8].forEach(function(la){
        var clog=new THREE.Mesh(new THREE.CylinderGeometry(.07,.09,.7,5),charM);
        clog.rotation.z=Math.PI/2;clog.rotation.y=la;
        clog.position.set(cx+Math.cos(la+1)*.22,getTerrainY(cx,cz)+.06,cz+Math.sin(la+1)*.22);
        scene.add(clog);
      });
      /* 희미한 붉은 빛 */
      clight.position.set(cx,.5,cz);scene.add(clight);
    });
  })();

  /* ── 석조 제단 (평평한 돌 플랫폼 + 촛불) ── */
  (function(){
    var altarM=new THREE.MeshLambertMaterial({color:0x2a2018});
    var altarDkM=new THREE.MeshLambertMaterial({color:0x1a180e});
    var candleM=new THREE.MeshLambertMaterial({color:0xddccaa});
    var flameMat=new THREE.MeshLambertMaterial({color:0xff9900});
    var g=new THREE.Group();
    /* 기단 */
    var base=new THREE.Mesh(new THREE.BoxGeometry(3.5,.3,2.5),altarDkM);
    base.position.set(0,.15,0);base.castShadow=true;base.receiveShadow=true;g.add(base);
    /* 제단 상판 */
    var top=new THREE.Mesh(new THREE.BoxGeometry(3.2,.4,2.2),altarM);
    top.position.set(0,.55,0);top.castShadow=true;top.receiveShadow=true;g.add(top);
    /* 촛불 4개 */
    [[-1.2,0,-0.7],[-1.2,0,0.7],[1.2,0,-0.7],[1.2,0,0.7]].forEach(function(cp2){
      var candle=new THREE.Mesh(new THREE.CylinderGeometry(.055,.065,.35,6),candleM);
      candle.position.set(cp2[0],.93,cp2[2]);g.add(candle);
      var flame=new THREE.Mesh(new THREE.ConeGeometry(.04,.1,5),flameMat);
      flame.position.set(cp2[0],1.15,cp2[2]);g.add(flame);
    });
    /* 제단 위 해골 장식 */
    var skullM2=new THREE.MeshLambertMaterial({color:0xd4ccc0});
    var skullAlt=new THREE.Mesh(new THREE.SphereGeometry(.18,7,6),skullM2);
    skullAlt.position.set(0,1.0,0);g.add(skullAlt);
    /* 제단 조명 (낮은 강도) */
    var altarLight=new THREE.PointLight(0xff8800,.3,6);
    altarLight.position.set(0,1.5,0);g.add(altarLight);
    var _alx=FX+80,_alz=FZ+50;
    g.position.set(_alx,getTerrainY(_alx,_alz),_alz);scene.add(g);
  })();

  /* ── 숲 횃불 조명 공터 (PointLight 2개) ── */
  (function(){
    var tpoleM=new THREE.MeshLambertMaterial({color:0x2a1a08});
    var tfireM=new THREE.MeshLambertMaterial({color:0xff8800});
    var torchLight1=new THREE.PointLight(0xff6600,.5,9);
    var torchLight2=new THREE.PointLight(0xff6600,.45,8);
    [[FX-40,FZ+30,torchLight1],[FX+90,FZ-30,torchLight2]].forEach(function(td){
      var tx=td[0],tz=td[1],tl=td[2];
      var pole=new THREE.Mesh(new THREE.CylinderGeometry(.06,.08,2.2,6),tpoleM);
      pole.position.set(tx,1.1+getTerrainY(tx,tz),tz);pole.castShadow=true;scene.add(pole);
      var fire=new THREE.Mesh(new THREE.ConeGeometry(.1,.25,6),tfireM);
      fire.position.set(tx,2.4+getTerrainY(tx,tz),tz);scene.add(fire);
      tl.position.set(tx,2.5+getTerrainY(tx,tz),tz);scene.add(tl);
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
      /* 초록 점광 제거 — 성능 최적화 */
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

  /* ── 늪 경로 (진흙 디스크) ── */
  (function(){
    var spathM=new THREE.MeshLambertMaterial({color:0x6a5a3a});
    /* 주요 경로 */
    var swampPath=[
      [SX-80,SZ-60],[SX-65,SZ-40],[SX-48,SZ-18],[SX-30,SZ],[SX-10,SZ+22],
      [SX+10,SZ+44],[SX+28,SZ+66],[SX+48,SZ+86],[SX+68,SZ+104]
    ];
    swampPath.forEach(function(pt){
      var disc=new THREE.Mesh(new THREE.CircleGeometry(2,24),spathM);
      disc.rotation.x=-Math.PI/2;
      disc.position.set(pt[0],getTerrainY(pt[0],pt[1])+.016,pt[1]);
      disc.receiveShadow=true;scene.add(disc);
    });
    /* 보조 갈림길 */
    var swampPath2=[
      [SX-50,SZ+20],[SX-30,SZ+40],[SX-10,SZ+60],[SX+10,SZ+80]
    ];
    swampPath2.forEach(function(pt){
      var disc=new THREE.Mesh(new THREE.CircleGeometry(1.7,24),spathM);
      disc.rotation.x=-Math.PI/2;
      disc.position.set(pt[0],getTerrainY(pt[0],pt[1])+.016,pt[1]);
      disc.receiveShadow=true;scene.add(disc);
    });
  })();

  /* ── 나무 판자 보드워크 (확장, 늪 위 고상 보행로) ── */
  (function(){
    var bwPlankM=new THREE.MeshLambertMaterial({color:0x3a2808});
    var bwPostM=new THREE.MeshLambertMaterial({color:0x1e1205});
    var bwRailM=new THREE.MeshLambertMaterial({color:0x2a1a06});
    var boardwalkSegs=[
      [SX-70,SZ-30],[SX-60,SZ-20],[SX-50,SZ-10],[SX-40,SZ],
      [SX-30,SZ+10],[SX-20,SZ+20],[SX-10,SZ+30],[SX,SZ+40]
    ];
    boardwalkSegs.forEach(function(bp,bi){
      /* 받침 기둥 */
      [-0.55,0.55].forEach(function(ox){
        var post=new THREE.Mesh(new THREE.CylinderGeometry(.07,.09,1.4,6),bwPostM);
        post.position.set(bp[0]+ox,getTerrainY(bp[0],bp[1])+.7,bp[1]);
        post.castShadow=true;scene.add(post);
      });
      /* 판자 */
      var plank=new THREE.Mesh(new THREE.BoxGeometry(1.2,.12,1.1),bwPlankM);
      plank.position.set(bp[0],getTerrainY(bp[0],bp[1])+1.1,bp[1]);
      plank.castShadow=true;plank.receiveShadow=true;scene.add(plank);
      /* 판자결 */
      [-0.28,0.28].forEach(function(ox){
        var strip=new THREE.Mesh(new THREE.BoxGeometry(.36,.05,1.05),new THREE.MeshLambertMaterial({color:0x2a1e06}));
        strip.position.set(bp[0]+ox,getTerrainY(bp[0],bp[1])+1.16,bp[1]);
        scene.add(strip);
      });
      /* 난간 기둥 (첫/마지막) */
      if(bi===0||bi===boardwalkSegs.length-1){
        var rp=new THREE.Mesh(new THREE.CylinderGeometry(.04,.05,.55,5),bwRailM);
        rp.position.set(bp[0]+.55,getTerrainY(bp[0],bp[1])+1.55,bp[1]);scene.add(rp);
      }
    });
  })();

  /* ── 말뚝 위 폐허 오두막 3채 ── */
  (function(){
    var stiltsM2=new THREE.MeshLambertMaterial({color:0x1e1205});
    var wallM2=new THREE.MeshLambertMaterial({color:0x2e1e0a});
    var roofM2=new THREE.MeshLambertMaterial({color:0x1a1004});
    var brokenWallM=new THREE.MeshLambertMaterial({color:0x261606});
    [[SX-80,SZ-60],[SX+60,SZ+60],[SX-30,SZ+110]].forEach(function(hp){
      var g=new THREE.Group();
      var hx=hp[0],hz=hp[1];
      /* 말뚝 4개 */
      [[-1,-.8],[-1,.8],[1,-.8],[1,.8]].forEach(function(sp){
        var stilt=new THREE.Mesh(new THREE.CylinderGeometry(.09,.12,2.2,6),stiltsM2);
        stilt.position.set(sp[0],1.1,sp[1]);stilt.castShadow=true;g.add(stilt);
      });
      /* 바닥 플랫폼 */
      var floor2=new THREE.Mesh(new THREE.BoxGeometry(2.4,.18,2.0),stiltsM2);
      floor2.position.set(0,2.28,0);floor2.castShadow=true;floor2.receiveShadow=true;g.add(floor2);
      /* 부분 벽 (부서짐) */
      var hw=new THREE.Mesh(new THREE.BoxGeometry(2.2,1.5,1.8),wallM2);
      hw.position.set(0,3.13,0);hw.castShadow=true;hw.receiveShadow=true;g.add(hw);
      /* 부서진 벽 조각 */
      var bw=new THREE.Mesh(new THREE.BoxGeometry(.7,.9,.2),brokenWallM);
      bw.position.set(-1.1+Math.random()*.3,3.1,.9);bw.rotation.z=(Math.random()-.5)*.2;bw.castShadow=true;g.add(bw);
      /* 지붕 (반쪽만) */
      var halfRoof=new THREE.Mesh(new THREE.ConeGeometry(1.5,1.2,4),roofM2);
      halfRoof.position.set(.2,4.35,0);halfRoof.rotation.y=Math.PI/4;halfRoof.castShadow=true;g.add(halfRoof);
      /* 물웅덩이 */
      var pudM=new THREE.MeshLambertMaterial({color:0x1a2808,transparent:true,opacity:.65});
      var pud=new THREE.Mesh(new THREE.CircleGeometry(1.8,8),pudM);
      pud.rotation.x=-Math.PI/2;pud.position.set(0,.03,0);g.add(pud);
      g.position.set(hx,getTerrainY(hx,hz),hz);g.rotation.y=Math.random()*.6;scene.add(g);
    });
  })();

  /* ── 매달린 랜턴 (기둥 + PointLight 최대 3개) ── */
  (function(){
    var lantPoleM=new THREE.MeshLambertMaterial({color:0x1e1205});
    var lantGlowM=new THREE.MeshLambertMaterial({color:0x88cc88,transparent:true,opacity:.7});
    var lantCapM2=new THREE.MeshLambertMaterial({color:0x1a1a1a});
    var lantLight1=new THREE.PointLight(0x44bb44,.3,8);
    var lantLight2=new THREE.PointLight(0x44bb44,.3,8);
    var lantLight3=new THREE.PointLight(0x44bb44,.25,7);
    [[SX-50,SZ-40,lantLight1],[SX+20,SZ+70,lantLight2],[SX-70,SZ+90,lantLight3]].forEach(function(ld){
      var lx=ld[0],lz=ld[1],ll=ld[2];
      var pole=new THREE.Mesh(new THREE.CylinderGeometry(.06,.08,3.2,6),lantPoleM);
      pole.position.set(lx,1.6+getTerrainY(lx,lz),lz);pole.castShadow=true;scene.add(pole);
      /* 가로 팔 */
      var arm=new THREE.Mesh(new THREE.CylinderGeometry(.03,.04,.8,5),lantPoleM);
      arm.rotation.z=Math.PI/2;
      arm.position.set(lx+.4,3.1+getTerrainY(lx,lz),lz);scene.add(arm);
      /* 랜턴 박스 */
      var lant2=new THREE.Mesh(new THREE.BoxGeometry(.22,.28,.22),lantGlowM);
      lant2.position.set(lx+.8,2.9+getTerrainY(lx,lz),lz);scene.add(lant2);
      var lcap2=new THREE.Mesh(new THREE.ConeGeometry(.14,.18,4),lantCapM2);
      lcap2.position.set(lx+.8,3.1+getTerrainY(lx,lz),lz);lcap2.rotation.y=Math.PI/4;scene.add(lcap2);
      /* 체인 (얇은 실린더) */
      var chain=new THREE.Mesh(new THREE.CylinderGeometry(.015,.015,.22,4),lantPoleM);
      chain.position.set(lx+.8,3.2+getTerrainY(lx,lz),lz);scene.add(chain);
      ll.position.set(lx+.8,2.9+getTerrainY(lx,lz),lz);scene.add(ll);
    });
  })();

  /* ── 마녀 가마솥 (초록 빛) ── */
  (function(){
    var cauldronM=new THREE.MeshLambertMaterial({color:0x1a1a1a});
    var brewM=new THREE.MeshLambertMaterial({color:0x33aa22,transparent:true,opacity:.85});
    var legM=new THREE.MeshLambertMaterial({color:0x222222});
    var g=new THREE.Group();
    /* 다리 3개 */
    for(var ci=0;ci<3;ci++){
      var ca=ci/3*Math.PI*2;
      var leg=new THREE.Mesh(new THREE.CylinderGeometry(.05,.07,.55,5),legM);
      leg.position.set(Math.cos(ca)*.5,.28,Math.sin(ca)*.5);
      leg.rotation.z=Math.cos(ca)*.35;leg.rotation.x=Math.sin(ca)*.35;
      leg.castShadow=true;g.add(leg);
    }
    /* 솥 몸체 */
    var pot=new THREE.Mesh(new THREE.SphereGeometry(.75,10,8),cauldronM);
    pot.scale.y=.8;pot.position.set(0,.72,0);pot.castShadow=true;pot.receiveShadow=true;g.add(pot);
    /* 위쪽 테두리 */
    var rim=new THREE.Mesh(new THREE.TorusGeometry(.72,.06,6,14),cauldronM);
    rim.position.set(0,1.26,0);rim.rotation.x=Math.PI/2;g.add(rim);
    /* 초록 액체 */
    var brew=new THREE.Mesh(new THREE.CircleGeometry(.63,12),brewM);
    brew.rotation.x=-Math.PI/2;brew.position.set(0,1.25,0);g.add(brew);
    /* 초록 거품 방울들 */
    var bubbleM=new THREE.MeshLambertMaterial({color:0x55cc33,transparent:true,opacity:.75});
    for(var bi=0;bi<5;bi++){
      var bx=(Math.random()-.5)*.8,bz=(Math.random()-.5)*.8;
      var bubble=new THREE.Mesh(new THREE.SphereGeometry(.07+Math.random()*.06,5,5),bubbleM);
      bubble.position.set(bx,1.28,bz);g.add(bubble);
    }
    /* 가마솥 초록 빛 */
    var cauldronLight=new THREE.PointLight(0x33cc33,.3,6);
    cauldronLight.position.set(0,1.8,0);g.add(cauldronLight);
    /* 나무 받침 불 */
    var firebaseM=new THREE.MeshLambertMaterial({color:0x441100});
    var fireBase=new THREE.Mesh(new THREE.CylinderGeometry(.3,.4,.12,6),firebaseM);
    fireBase.position.set(0,.06,0);g.add(fireBase);
    var _cwx=SX+10,_cwz=SZ+20;
    g.position.set(_cwx,getTerrainY(_cwx,_cwz),_cwz);scene.add(g);
  })();

  /* ── 발광 버섯 그루터기 ── */
  (function(){
    var glowStemM=new THREE.MeshLambertMaterial({color:0x441155});
    var glowCapM=new THREE.MeshLambertMaterial({color:0xaa44ff,transparent:true,opacity:.9});
    [[SX-90,SZ+50],[SX+70,SZ-30],[SX-50,SZ+130],[SX+100,SZ+80]].forEach(function(gp){
      var sh=.5+Math.random()*.4;
      /* 그루터기 */
      var stump=new THREE.Mesh(new THREE.CylinderGeometry(.45,.6,sh,8),
        new THREE.MeshLambertMaterial({color:0x0e0a04}));
      stump.position.set(gp[0],getTerrainY(gp[0],gp[1])+sh/2,gp[1]);
      stump.castShadow=true;stump.receiveShadow=true;scene.add(stump);
      /* 발광 버섯 */
      for(var mi=0;mi<4;mi++){
        var ma=mi/4*Math.PI*2;
        var msh=.3+Math.random()*.2;
        var stem=new THREE.Mesh(new THREE.CylinderGeometry(.055,.075,msh,6),glowStemM);
        stem.position.set(gp[0]+Math.cos(ma)*.38,getTerrainY(gp[0],gp[1])+sh+msh/2,gp[1]+Math.sin(ma)*.38);
        scene.add(stem);
        var cap=new THREE.Mesh(new THREE.SphereGeometry(.16,6,5),glowCapM);
        cap.scale.y=.5;cap.position.set(gp[0]+Math.cos(ma)*.38,getTerrainY(gp[0],gp[1])+sh+msh+.05,gp[1]+Math.sin(ma)*.38);
        scene.add(cap);
      }
    });
  })();

  /* ── 위험 경고 표지판 ── */
  (function(){
    var signPostM=new THREE.MeshLambertMaterial({color:0x2a1a08});
    var signBoardM=new THREE.MeshLambertMaterial({color:0x3a2808});
    var signDarkM=new THREE.MeshLambertMaterial({color:0x1a0e04});
    [[SX-60,SZ-70,-.3],[SX+50,SZ+100,.4],[SX-20,SZ-30,.1]].forEach(function(sd){
      var g=new THREE.Group();
      /* 기둥 */
      var post=new THREE.Mesh(new THREE.CylinderGeometry(.05,.07,2,6),signPostM);
      post.position.set(0,1,0);post.castShadow=true;g.add(post);
      /* 표지판 판 */
      var board=new THREE.Mesh(new THREE.BoxGeometry(.9,.5,.08),signBoardM);
      board.position.set(0,1.8,0);board.rotation.z=(Math.random()-.5)*.15;board.castShadow=true;g.add(board);
      /* 테두리 */
      var border=new THREE.Mesh(new THREE.BoxGeometry(.96,.56,.07),signDarkM);
      border.position.set(0,1.8,-.03);g.add(border);
      /* "위험!" 표시 (붉은 X 대신 붉은 줄기) */
      var warnM=new THREE.MeshLambertMaterial({color:0xcc1111});
      var xbar1=new THREE.Mesh(new THREE.BoxGeometry(.5,.07,.06),warnM);
      xbar1.position.set(0,1.8,.07);xbar1.rotation.z=.5;g.add(xbar1);
      var xbar2=new THREE.Mesh(new THREE.BoxGeometry(.5,.07,.06),warnM);
      xbar2.position.set(0,1.8,.07);xbar2.rotation.z=-.5;g.add(xbar2);
      g.position.set(sd[0],getTerrainY(sd[0],sd[1]),sd[1]);g.rotation.y=sd[2];scene.add(g);
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
        /* lcrack 라이트 제거 — 성능 최적화 */
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
      /* 용암 조명 제거 — 성능 최적화 */
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
      /* 점광 제거 — 성능 최적화 */
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

  /* ── 화산 지면 균열 — 발광 라인 ── */
  (function(){
    var crackGlowMat=new THREE.MeshLambertMaterial({
      color:0xff4400,emissive:new THREE.Color(0xff2200),emissiveIntensity:.95,
      transparent:true,opacity:.85
    });
    var crackDefs=[
      [VCX-30,VCZ-40,12,.08],[VCX+20,VCZ+30,9,.06],[VCX-50,VCZ+20,14,.07],
      [VCX+40,VCZ-30,10,.05],[VCX-10,VCZ+60,8,.06],[VCX+60,VCZ+10,11,.07],
      [VCX-40,VCZ-60,7,.05],[VCX+30,VCZ+80,10,.06],[VCX-70,VCZ+50,6,.05],
      [VCX+10,VCZ-70,13,.08],[VCX-20,VCZ+100,9,.06],[VCX+80,VCZ-20,8,.05]
    ];
    crackDefs.forEach(function(cd){
      var cx=cd[0],cz=cd[1],cl=cd[2],cw=cd[3];
      var ang=Math.random()*Math.PI;
      var crack=new THREE.Mesh(new THREE.PlaneGeometry(cl,cw),crackGlowMat);
      crack.rotation.x=-Math.PI/2;crack.rotation.z=ang;
      var ty2=getTerrainY(cx,cz);
      crack.position.set(cx,ty2+.04,cz);
      crack.receiveShadow=false;scene.add(crack);
      /* 균열 발광 라이트 제거 — 성능 최적화 */
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
    /* 뼈 눈빛 제거 — 성능 최적화 */
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

  /* ── 보스 구역 분위기 조명 (1개만 유지) ── */
  var bossL1=new THREE.PointLight(0x440000,.8,60);bossL1.position.set(BX,5,BZ);scene.add(bossL1);
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
