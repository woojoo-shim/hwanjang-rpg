/* ════════════ 플레이어 시스템 ════════════ */
/* 의존: config.js (없음)
        ui.js (addChat, spawnDmgNum)
        inventory.js (getItemDef, getItemFull, addItem, equipped, inventory, gold)
   선언: PL, playerHP, playerMaxHP, playerEXP, playerLevel, attackCooldown, invincibleTimer
   참조: monsters (monster.js), scene (world.js), keys/cYaw (main.js) — 런타임 참조 */

var PL={group:null,legL:null,legR:null,armL:null,armR:null,armRPivot:null,weaponMesh:null,bobT:0,atkAnim:0,atkPhase:0,head:null,body:null,bodyMat:null};

/* ── 이동/아이들 애니메이션 상태 ── */
var _idleTimer=0;          /* 가만히 있은 시간 */
var _prevYaw=0;            /* 이전 프레임 회전 — 방향 변화 감지 */
var _turnVel=0;            /* 방향 전환 속도 — 몸통 기울기 */
var _blinkTimer=3;         /* 눈 깜빡임 타이머 */
var _blinkOpen=1;          /* 눈 열림 상태 (scale.y) */
var _longIdleT=0;          /* 장시간 아이들 타이머 */
var _longIdlePhase=0;      /* 장시간 아이들 단계 */
var _breathT=0;            /* 호흡 타이머 (아이들) */
var _hipSwayT=0;           /* 힙 스웨이 타이머 */
var _footPlant=0;          /* 발 착지 이전 Y — 발 착지감 */
var playerHP=100,playerMaxHP=100,playerEXP=0,playerLevel=1;
var attackCooldown=0,invincibleTimer=0;

/* ── 화면 흔들림 (Diablo-style screen shake) ── */
var _shakeIntensity=0,_shakeDuration=0,_shakeElapsed=0,_shakeCamBase=null;
function screenShake(intensity,duration){
  _shakeIntensity=intensity;
  _shakeDuration=duration||0.2;
  _shakeElapsed=0;
  if(typeof camera!=='undefined'&&camera&&!_shakeCamBase){
    _shakeCamBase={x:camera.position.x,y:camera.position.y,z:camera.position.z};
  }
}
function tickScreenShake(dt){
  if(_shakeDuration<=0||_shakeElapsed>=_shakeDuration)return;
  _shakeElapsed+=dt;
  var t=_shakeElapsed/_shakeDuration;
  var freq=18;
  var offset=_shakeIntensity*Math.sin(t*freq*Math.PI)*(1-t);
  if(typeof camera!=='undefined'&&camera){
    camera.position.x+=(Math.random()-.5)*offset;
    camera.position.y+=(Math.random()-.5)*offset*.5;
    camera.position.z+=(Math.random()-.5)*offset;
  }
  if(_shakeElapsed>=_shakeDuration){_shakeDuration=0;}
}
/* 상태이상 */
var playerPoisoned=0,playerPoisonDmg=0;
var playerSlowed=0;

/* ── 충돌 박스 [x, z, halfW, halfD] ── */
/* 모든 마을 건물은 (-350,-350) 중심으로 이동 */
var COLLIDERS=[
  /* 성 */      [-350,-380,7,6],
  /* 분수 */    [-350,-358,4.2,4.2],
  /* 여관 (VX-38, VZ-14) = (-388,-364) w8 d7 */
  [-388,-364,4.5,4],
  /* 무기 상점 (VX+38, VZ-14) = (-312,-364) w7 d6 */
  [-312,-364,4,3.5],
  /* 방어구 상점 (VX+38, VZ-36) = (-312,-386) w7 d6 */
  [-312,-386,4,3.5],
  /* 도서관 (VX+50, VZ+12) = (-300,-338) w10 d8 */
  [-300,-338,5.5,4.5],
  /* 모험가 길드 (VX-8, VZ-72) = (-358,-422) w14 d10 */
  [-358,-422,7.5,5.5],
  /* 시장 스탠드들 */
  [-390,-368,1.5,1],[-390,-378,1.5,1],[-402,-368,1.5,1],[-402,-378,1.5,1],
  /* 우물 */    [-378,-310,1.2,1.2],
  /* 게이트 기둥 좌우 */ [-354,-448,1.2,1.2],[-346,-448,1.2,1.2],
  /* ── 보스 구역 ── */
  [12,550,0.8,0.8],[-12,550,0.8,0.8],[0,562,0.8,0.8],[0,538,0.8,0.8],
  [10,559,0.8,0.8],[-10,559,0.8,0.8],[10,541,0.8,0.8],[-10,541,0.8,0.8],
];
function hitCollider(x,z){
  for(var i=0;i<COLLIDERS.length;i++){
    var c=COLLIDERS[i];
    if(Math.abs(x-c[0])<c[2]&&Math.abs(z-c[1])<c[3])return true;
  }
  return false;
}

/* 장착 무기 3D 메시 빌드 */
function buildWeaponMesh(itemId){
  if(!itemId)return null;
  var def=getItemDef(itemId);
  if(!def)return null;
  var icon=def.icon||'';
  /* 등급별 색상 */
  var rarity=def.rarity||'common';
  var bladeColors={common:0xbbbbbb,uncommon:0xccffcc,rare:0xaaccff,epic:0xddaaff,legendary:0xffddaa,hidden:0xff66aa};
  var emissiveColors={common:0x111111,uncommon:0x114411,rare:0x1144aa,epic:0x441188,legendary:0xaa6611,hidden:0xaa1166};
  var bladeColor=bladeColors[rarity]||0xbbbbbb;
  var emColor=emissiveColors[rarity]||0x222222;
  var emInt=(rarity==='legendary'||rarity==='epic'||rarity==='hidden')?0.6:0.2;
  var mesh=null;

  if(icon==='sword'||icon==='dagger'){
    var g=new THREE.Group();
    var len=icon==='dagger'?0.45:0.75;
    /* 칼날 — 다층 구조 (날카로움) */
    var bladeMat=new THREE.MeshLambertMaterial({color:bladeColor,emissive:new THREE.Color(emColor),emissiveIntensity:emInt});
    var blade=new THREE.Mesh(new THREE.BoxGeometry(.05,len,.025),bladeMat);
    blade.position.set(0,.3+len/2,0);g.add(blade);
    /* 칼날 중앙 융기 (피홈) */
    var ridge=new THREE.Mesh(new THREE.BoxGeometry(.012,len*0.95,.04),new THREE.MeshLambertMaterial({color:0xeeeeff,emissive:new THREE.Color(emColor),emissiveIntensity:emInt*1.5}));
    ridge.position.set(0,.3+len/2,0);g.add(ridge);
    /* 칼끝 (뾰족한 삼각형) */
    var tip=new THREE.Mesh(new THREE.ConeGeometry(.04,.12,4),bladeMat);
    tip.position.set(0,.3+len+.06,0);g.add(tip);
    /* 가드 (장식적) */
    var guardColor=rarity==='legendary'?0xffcc44:rarity==='epic'?0x6622aa:0x886622;
    var guardMat=new THREE.MeshLambertMaterial({color:guardColor});
    var guard=new THREE.Mesh(new THREE.BoxGeometry(.28,.05,.07),guardMat);
    guard.position.set(0,.28,0);g.add(guard);
    /* 가드 양쪽 끝 장식 (구슬) */
    var guardEnd=new THREE.Mesh(new THREE.SphereGeometry(.035,6,5),guardMat);
    guardEnd.position.set(.14,.28,0);g.add(guardEnd);
    var guardEnd2=new THREE.Mesh(new THREE.SphereGeometry(.035,6,5),guardMat);
    guardEnd2.position.set(-.14,.28,0);g.add(guardEnd2);
    /* 손잡이 (가죽 감긴 느낌) */
    var hiltMat=new THREE.MeshLambertMaterial({color:0x4a2010});
    var hilt=new THREE.Mesh(new THREE.CylinderGeometry(.035,.04,.22,6),hiltMat);
    hilt.position.set(0,.16,0);g.add(hilt);
    /* 손잡이 끝 폼멜 */
    var pommel=new THREE.Mesh(new THREE.SphereGeometry(.05,6,5),guardMat);
    pommel.position.set(0,.04,0);g.add(pommel);
    /* 전설/에픽 — 광원 효과 */
    if(rarity==='legendary'||rarity==='epic'||rarity==='hidden'){
      var glow=new THREE.PointLight(bladeColor,0.4,2);
      glow.position.set(0,.3+len/2,0);g.add(glow);
    }
    mesh=g;
  } else if(icon==='axe'||icon==='hammer'){
    var g=new THREE.Group();
    /* 손잡이 — 나무결 */
    var handleMat=new THREE.MeshLambertMaterial({color:0x5a3010});
    var handle=new THREE.Mesh(new THREE.CylinderGeometry(.035,.045,.85,7),handleMat);
    handle.position.set(0,.1,0);g.add(handle);
    /* 손잡이 그립 (가죽) */
    var grip=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,.18,6),new THREE.MeshLambertMaterial({color:0x3a1808}));
    grip.position.set(0,-.15,0);g.add(grip);
    /* 도끼날 — 양면 */
    var headMat=new THREE.MeshLambertMaterial({color:bladeColor,emissive:new THREE.Color(emColor),emissiveIntensity:emInt});
    var head=new THREE.Mesh(new THREE.BoxGeometry(.42,.32,.06),headMat);
    head.position.set(.1,.45,0);g.add(head);
    /* 도끼날 곡선 (위쪽 뿔) */
    var horn=new THREE.Mesh(new THREE.ConeGeometry(.06,.18,4),headMat);
    horn.position.set(.28,.6,0);horn.rotation.z=-0.5;g.add(horn);
    /* 망치형이면 평평한 뒷면 */
    if(icon==='hammer'){
      var hammerHead=new THREE.Mesh(new THREE.BoxGeometry(.16,.3,.18),headMat);
      hammerHead.position.set(-.12,.45,0);g.add(hammerHead);
    }else{
      /* 도끼면 반대쪽 작은 날 */
      var smallBlade=new THREE.Mesh(new THREE.BoxGeometry(.18,.22,.05),headMat);
      smallBlade.position.set(-.1,.45,0);g.add(smallBlade);
    }
    /* 손잡이와 머리 연결부 (금속 밴드) */
    var band=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,.06,8),new THREE.MeshLambertMaterial({color:0x222222}));
    band.position.set(0,.4,0);g.add(band);
    if(rarity==='legendary'||rarity==='epic'){
      var glow=new THREE.PointLight(bladeColor,0.3,2);
      glow.position.set(.1,.45,0);g.add(glow);
    }
    mesh=g;
  } else if(icon==='bow'){
    var g=new THREE.Group();
    /* 활대 — 곡선 (TorusGeometry 절반) */
    var bowMat=new THREE.MeshLambertMaterial({color:0x6a3a10,emissive:new THREE.Color(emColor),emissiveIntensity:emInt*0.5});
    var bowArc=new THREE.Mesh(new THREE.TorusGeometry(.35,.025,5,12,Math.PI),bowMat);
    bowArc.position.set(.05,0,0);bowArc.rotation.y=Math.PI/2;g.add(bowArc);
    /* 활 손잡이 (그립) */
    var grip=new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,.15,6),new THREE.MeshLambertMaterial({color:0x3a1808}));
    grip.position.set(0,0,0);g.add(grip);
    /* 활 끝 장식 */
    var tip1=new THREE.Mesh(new THREE.ConeGeometry(.025,.07,4),bowMat);
    tip1.position.set(0,.34,0);g.add(tip1);
    var tip2=new THREE.Mesh(new THREE.ConeGeometry(.025,.07,4),bowMat);
    tip2.position.set(0,-.34,0);tip2.rotation.x=Math.PI;g.add(tip2);
    /* 활시위 — 팽팽한 줄 */
    var string=new THREE.Mesh(new THREE.CylinderGeometry(.005,.005,.7,4),new THREE.MeshBasicMaterial({color:0xffffff}));
    string.position.set(-.05,0,0);g.add(string);
    /* 화살 (장착됨) */
    var arrowShaft=new THREE.Mesh(new THREE.CylinderGeometry(.012,.012,.5,5),new THREE.MeshLambertMaterial({color:0x8a5a20}));
    arrowShaft.position.set(.05,0,0);arrowShaft.rotation.x=Math.PI/2;arrowShaft.rotation.z=Math.PI/2;g.add(arrowShaft);
    /* 화살촉 */
    var arrowHead=new THREE.Mesh(new THREE.ConeGeometry(.025,.06,4),new THREE.MeshLambertMaterial({color:0xaaaaaa}));
    arrowHead.position.set(.32,0,0);arrowHead.rotation.z=-Math.PI/2;g.add(arrowHead);
    /* 깃털 */
    var feather=new THREE.Mesh(new THREE.BoxGeometry(.03,.06,.01),new THREE.MeshLambertMaterial({color:rarity==='legendary'?0xffaa44:0xcc3333}));
    feather.position.set(-.16,0,0);g.add(feather);
    if(rarity==='legendary'||rarity==='epic'){
      var glow=new THREE.PointLight(bladeColor,0.3,2);
      glow.position.set(0,0,0);g.add(glow);
    }
    mesh=g;
  } else if(icon==='staff'){
    var g=new THREE.Group();
    /* 막대 — 구부러진 나무 (3 segment) */
    var rodMat=new THREE.MeshLambertMaterial({color:0x4a2810});
    var rod1=new THREE.Mesh(new THREE.CylinderGeometry(.045,.05,.4,7),rodMat);
    rod1.position.set(0,-.15,0);g.add(rod1);
    var rod2=new THREE.Mesh(new THREE.CylinderGeometry(.04,.045,.35,7),rodMat);
    rod2.position.set(.02,.2,0);rod2.rotation.z=-.05;g.add(rod2);
    var rod3=new THREE.Mesh(new THREE.CylinderGeometry(.035,.04,.2,7),rodMat);
    rod3.position.set(.04,.45,0);rod3.rotation.z=-.1;g.add(rod3);
    /* 손잡이 그립 */
    var grip=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,.2,6),new THREE.MeshLambertMaterial({color:0x2a1408}));
    grip.position.set(0,-.2,0);g.add(grip);
    /* 막대 끝 장식 (곁가지) */
    var twig1=new THREE.Mesh(new THREE.CylinderGeometry(.012,.018,.2,4),rodMat);
    twig1.position.set(.15,.55,0);twig1.rotation.z=-1.0;g.add(twig1);
    var twig2=new THREE.Mesh(new THREE.CylinderGeometry(.012,.018,.18,4),rodMat);
    twig2.position.set(-.12,.55,0);twig2.rotation.z=1.0;g.add(twig2);
    /* 마법 보석 — 큰 구슬 + 외곽 글로우 */
    var orbColor=rarity==='legendary'?0xffaa44:rarity==='epic'?0xaa44ff:0x4488ff;
    var orbEm=rarity==='legendary'?0xff6600:rarity==='epic'?0x6600cc:0x0044aa;
    var orbMat=new THREE.MeshLambertMaterial({color:orbColor,emissive:new THREE.Color(orbEm),emissiveIntensity:0.9});
    var orb=new THREE.Mesh(new THREE.SphereGeometry(.13,10,8),orbMat);
    orb.position.set(.06,.62,0);g.add(orb);
    /* 보석 외곽 글로우 (반투명) */
    var orbGlow=new THREE.Mesh(new THREE.SphereGeometry(.18,8,6),new THREE.MeshBasicMaterial({color:orbColor,transparent:true,opacity:.3}));
    orbGlow.position.set(.06,.62,0);g.add(orbGlow);
    /* 보석 받침 (금속 발) */
    var clawMat=new THREE.MeshLambertMaterial({color:0xaa8833});
    for(var ci=0;ci<4;ci++){
      var ang=ci*Math.PI/2;
      var claw=new THREE.Mesh(new THREE.ConeGeometry(.025,.12,4),clawMat);
      claw.position.set(.06+Math.cos(ang)*.1,.5,Math.sin(ang)*.1);
      claw.rotation.x=ang;g.add(claw);
    }
    /* PointLight (마법 광원) */
    var orbLight=new THREE.PointLight(orbColor,0.6,3);
    orbLight.position.set(.06,.62,0);g.add(orbLight);
    mesh=g;
  } else if(icon==='helmet'||icon==='shield'){
    /* 방어구 등 — 작은 큐브 */
    mesh=new THREE.Mesh(new THREE.BoxGeometry(.15,.2,.05),new THREE.MeshLambertMaterial({color:bladeColor}));
  } else {
    /* 기본 — 단순 막대 */
    mesh=new THREE.Mesh(new THREE.BoxGeometry(.06,.5,.06),new THREE.MeshLambertMaterial({color:bladeColor,emissive:new THREE.Color(emColor),emissiveIntensity:emInt}));
  }
  return mesh;
}

function refreshWeaponMesh(){
  if(PL.weaponMesh){PL.armRPivot.remove(PL.weaponMesh);PL.weaponMesh=null;}
  if(!equipped.weapon)return;
  var wm=buildWeaponMesh(equipped.weapon);
  if(!wm)return;
  /* 무기 종류별 위치/회전 조정 — 손에 잡힌 자연스러운 자세 */
  var def=getItemDef(equipped.weapon);
  var icon=def?def.icon:'';
  if(icon==='sword'||icon==='dagger'){
    wm.position.set(0, -0.65, -0.15);
    wm.rotation.set(Math.PI/2, Math.PI/2, 0);
  }else if(icon==='axe'||icon==='hammer'){
    /* 도끼: 검과 같은 자세 + Z축 180° (상하 반전) */
    wm.position.set(0, -0.65, -0.15);
    wm.rotation.set(Math.PI/2, Math.PI/2, Math.PI);
  }else if(icon==='bow'){
    /* 활: 손에 세로로 들고 옆에 (활대가 앞뒤) */
    wm.position.set(0, -0.45, 0);
    wm.rotation.set(0, 0, 0);
  }else if(icon==='staff'){
    /* 지팡이: 손에서 위로 곧게 (보석이 위, 짚는 자세) */
    wm.position.set(0, -0.4, 0);
    wm.rotation.set(0, 0, 0);
  }else{
    wm.position.set(0, -0.5, 0);
    wm.rotation.set(Math.PI, 0, 0);
  }
  PL.armRPivot.add(wm);
  PL.weaponMesh=wm;
}

/* 공격 애니메이션 상태 */
var atkAnimTimer=0;
var _atkBodyYaw=0;
var _atkCombo=0;/* 콤보 카운터 0,1,2 */
var _comboTimer=0;/* 콤보 유효 시간 */
var _hitStop=0;/* 히트스톱 타이머 */

function triggerAtkAnim(){
  /* 콤보: 복귀 중이면 다음 콤보 */
  if(_comboTimer>0&&_atkCombo<2)_atkCombo++;
  else _atkCombo=0;
  PL.atkPhase=1;atkAnimTimer=0;_atkBodyYaw=0;_comboTimer=0.6;
}

function triggerHitStop(){_hitStop=0.08;}

/* ════════════ 검 잔상 (Sword Trail) ════════════ */
var _trailPoints=[];/* 칼날 끝 위치 히스토리 (max 12) */
var _trailMesh=null;
var _trailMat=null;
var _trailGeo=null;
var _trailLifetime=0;

function _initTrail(){
  if(_trailMat)return;
  _trailMat=new THREE.MeshBasicMaterial({color:0xaaeeff,transparent:true,opacity:0.6,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending});
  _trailGeo=new THREE.BufferGeometry();
  /* 12개 segment, 각 4 vertex (quad strip) → 24 vertex */
  var maxVerts=24;
  _trailGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(maxVerts*3),3));
  _trailMesh=new THREE.Mesh(_trailGeo,_trailMat);
  _trailMesh.frustumCulled=false;
  _trailMesh.visible=false;
}

function _getBladeTipWorld(offset){
  /* 칼날 끝 (sword grip+blade length) — 무기 메쉬의 로컬 (0, 0.7, 0)이 칼끝 */
  if(!PL.weaponMesh)return null;
  var v=new THREE.Vector3(0,0.7,0);/* 검의 칼끝 (로컬) */
  PL.weaponMesh.localToWorld(v);
  return v;
}

function _getBladeBaseWorld(){
  /* 칼날 시작 (그립 부분) */
  if(!PL.weaponMesh)return null;
  var v=new THREE.Vector3(0,0.0,0);
  PL.weaponMesh.localToWorld(v);
  return v;
}

function tickSwordTrail(dt){
  if(!_trailMesh){_initTrail();if(typeof scene!=='undefined'&&scene)scene.add(_trailMesh);}
  /* 무기 + 공격 중일 때만 기록 */
  var def=equipped&&equipped.weapon?getItemDef(equipped.weapon):null;
  var icon=def?def.icon:'';
  var isMelee=(icon==='sword'||icon==='dagger'||icon==='axe'||icon==='hammer');
  if(isMelee&&PL.atkPhase>=1&&PL.atkPhase<=2&&PL.weaponMesh){
    var tip=_getBladeTipWorld();
    var base=_getBladeBaseWorld();
    if(tip&&base){
      _trailPoints.push({tip:tip.clone(),base:base.clone(),age:0});
      if(_trailPoints.length>10)_trailPoints.shift();
      _trailLifetime=0.25;
    }
  }
  /* 잔상 페이드 */
  for(var i=0;i<_trailPoints.length;i++){
    _trailPoints[i].age+=dt;
  }
  /* 오래된 점 제거 */
  _trailPoints=_trailPoints.filter(function(p){return p.age<0.25;});
  /* 메쉬 업데이트 */
  if(_trailPoints.length>=2){
    _trailMesh.visible=true;
    var posAttr=_trailGeo.attributes.position;
    var arr=posAttr.array;
    var n=Math.min(_trailPoints.length,12);
    /* triangle strip: 각 점마다 (tip, base) 2개 vertex */
    for(var pi=0;pi<n;pi++){
      var p=_trailPoints[pi];
      arr[pi*6+0]=p.tip.x;arr[pi*6+1]=p.tip.y;arr[pi*6+2]=p.tip.z;
      arr[pi*6+3]=p.base.x;arr[pi*6+4]=p.base.y;arr[pi*6+5]=p.base.z;
    }
    /* 나머지는 마지막 점으로 */
    for(var pj=n;pj<12;pj++){
      var lp=_trailPoints[n-1];
      arr[pj*6+0]=lp.tip.x;arr[pj*6+1]=lp.tip.y;arr[pj*6+2]=lp.tip.z;
      arr[pj*6+3]=lp.base.x;arr[pj*6+4]=lp.base.y;arr[pj*6+5]=lp.base.z;
    }
    posAttr.needsUpdate=true;
    /* 인덱스 — triangle strip */
    if(!_trailGeo.index||_trailGeo.index.count===0){
      var idx=[];
      for(var ii=0;ii<11;ii++){
        idx.push(ii*2,ii*2+1,(ii+1)*2);
        idx.push(ii*2+1,(ii+1)*2+1,(ii+1)*2);
      }
      _trailGeo.setIndex(idx);
    }
    /* 색상 — 무기 등급에 따라 */
    if(def){
      var rarityColors={common:0xccddee,uncommon:0xaaffaa,rare:0xaaccff,epic:0xddaaff,legendary:0xffddaa,hidden:0xff66aa};
      _trailMat.color.setHex(rarityColors[def.rarity]||0xaaeeff);
    }
    /* 페이드 */
    var lifeRatio=Math.max(0,_trailLifetime/0.25);
    _trailMat.opacity=0.5*lifeRatio;
    _trailLifetime=Math.max(0,_trailLifetime-dt);
  }else{
    _trailMesh.visible=false;
  }
}

/* 이징 함수 */
function easeOutBack(t){var s=1.7;return 1+(t-1)*(t-1)*((s+1)*(t-1)+s);}
function easeInQuad(t){return t*t;}
function easeOutQuad(t){return t*(2-t);}
function easeOutElastic(t){if(t===0||t===1)return t;return Math.pow(2,-10*t)*Math.sin((t-.075)*2*Math.PI/.3)+1;}

/* 무기 타입별 모션 파라미터 */
function getAtkStyle(){
  var wep=equipped&&equipped.weapon?ITEM_POOL.find(function(x){return x.id===equipped.weapon;}):null;
  if(wep&&wep.id.indexOf('bow')!==-1)return 'bow';
  if(wep&&(wep.id.indexOf('staff')!==-1||wep.id.indexOf('fire_staff')!==-1))return 'staff';
  return 'sword';/* 기본 근접 */
}

function tickAtkAnim(dt){
  if(_comboTimer>0)_comboTimer-=dt;
  if(PL.atkPhase===0)return;
  /* 히트스톱 */
  if(_hitStop>0){_hitStop-=dt;return;}
  atkAnimTimer+=dt;

  var style=getAtkStyle();
  /* 콤보별 다른 타이밍 */
  var speeds=[1.0,1.15,0.9];
  var spdMul=speeds[_atkCombo]||1.0;

  if(style==='sword'){
    tickSwordAnim(dt,spdMul);
  }else if(style==='bow'){
    tickBowAnim(dt);
  }else if(style==='staff'){
    tickStaffAnim(dt);
  }
}

function tickSwordAnim(dt,spdMul){
  /* 3타 콤보: 0=가로 베기 우→좌, 1=가로 베기 좌→우, 2=내려치기 */
  var combo=_atkCombo%3;

  if(PL.atkPhase===1){
    /* ── 준비 ── */
    var dur=0.15/spdMul;
    var t=Math.min(1,atkAnimTimer/dur);
    var et=easeOutQuad(t);

    if(combo===0){
      /* 가로 베기: 오른쪽 뒤로 당기기 (armR Y축 회전) */
      PL.armRPivot.rotation.y=et*(Math.PI*0.5);
      PL.armRPivot.rotation.x=et*(-Math.PI*0.3);
      _atkBodyYaw=et*(-0.25);
    }else if(combo===1){
      /* 가로 베기: 왼쪽 뒤로 당기기 */
      PL.armRPivot.rotation.y=et*(-Math.PI*0.5);
      PL.armRPivot.rotation.x=et*(-Math.PI*0.3);
      _atkBodyYaw=et*(0.25);
    }else{
      /* 내려치기: 위로 */
      PL.armRPivot.rotation.x=et*(-Math.PI*0.9);
      PL.armRPivot.rotation.y=0;
      _atkBodyYaw=0;
    }
    if(PL.armL)PL.armL.rotation.x=et*(-0.1);
    if(PL.legL)PL.legL.rotation.x=et*(-0.12);
    if(PL.legR)PL.legR.rotation.x=et*(0.08);

    if(atkAnimTimer>=dur){PL.atkPhase=2;atkAnimTimer=0;}

  }else if(PL.atkPhase===2){
    /* ── 스윙 (빠르게) ── */
    var dur=0.08/spdMul;
    var t=Math.min(1,atkAnimTimer/dur);
    var et=easeInQuad(t);

    if(combo===0){
      /* 가로 베기 우→좌: Y축 +PI/2 → -PI/2 (왼쪽으로 휘두름) */
      PL.armRPivot.rotation.y=(Math.PI*0.5)+(et*(-Math.PI));
      PL.armRPivot.rotation.x=(-Math.PI*0.3);
      _atkBodyYaw=(-0.25)+(et*0.5);
    }else if(combo===1){
      /* 가로 베기 좌→우: Y축 -PI/2 → +PI/2 */
      PL.armRPivot.rotation.y=(-Math.PI*0.5)+(et*Math.PI);
      PL.armRPivot.rotation.x=(-Math.PI*0.3);
      _atkBodyYaw=(0.25)+(et*(-0.5));
    }else{
      /* 내려치기: 위→아래 */
      PL.armRPivot.rotation.x=(-Math.PI*0.9)+(et*Math.PI*1.15);
      PL.armRPivot.rotation.y=0;
      _atkBodyYaw=0;
    }
    if(PL.armL)PL.armL.rotation.x=(-0.1)+(et*0.18);
    if(PL.legL)PL.legL.rotation.x=(-0.12)+(et*0.24);
    if(PL.legR)PL.legR.rotation.x=(0.08)+(et*(-0.16));

    if(atkAnimTimer>=dur){PL.atkPhase=3;atkAnimTimer=0;}

  }else if(PL.atkPhase===3){
    /* ── 복귀 ── */
    var dur=0.2/spdMul;
    var t=Math.min(1,atkAnimTimer/dur);
    var et=easeOutQuad(t);

    PL.armRPivot.rotation.x*=(1-et);
    PL.armRPivot.rotation.y*=(1-et);
    PL.armRPivot.rotation.z*=(1-et);
    _atkBodyYaw*=(1-et);
    if(PL.armL)PL.armL.rotation.x*=(1-et);
    if(PL.legL)PL.legL.rotation.x*=(1-et);
    if(PL.legR)PL.legR.rotation.x*=(1-et);

    if(atkAnimTimer>=dur){
      PL.atkPhase=0;atkAnimTimer=0;
      PL.armRPivot.rotation.x=0;PL.armRPivot.rotation.y=0;PL.armRPivot.rotation.z=0;
      if(PL.armL)PL.armL.rotation.x=0;
      if(PL.legL)PL.legL.rotation.x=0;
      if(PL.legR)PL.legR.rotation.x=0;
      _atkBodyYaw=0;
    }
  }
}

/* ── 활 공격 모션 ── */
function tickBowAnim(dt){
  if(PL.atkPhase===1){
    var t=Math.min(1,atkAnimTimer/0.15);var et=easeOutQuad(t);
    PL.armRPivot.rotation.x=et*(-Math.PI*.3);PL.armRPivot.rotation.z=et*(-.1);
    if(PL.armL){PL.armL.rotation.x=et*(-Math.PI*.4);PL.armL.rotation.z=et*(.15);}
    _atkBodyYaw=et*(-.08);
    if(atkAnimTimer>=0.15){PL.atkPhase=2;atkAnimTimer=0;}
  }else if(PL.atkPhase===2){
    var t=Math.min(1,atkAnimTimer/0.05);var et=easeInQuad(t);
    PL.armRPivot.rotation.x=(-Math.PI*.3)+(et*(.5));
    if(PL.armL)PL.armL.rotation.x=(-Math.PI*.4)+(et*(.2));
    _atkBodyYaw=(-.08)+(et*(.04));
    if(atkAnimTimer>=0.05){PL.atkPhase=3;atkAnimTimer=0;}
  }else if(PL.atkPhase===3){
    var t=Math.min(1,atkAnimTimer/0.2);var et=easeOutBack(t);
    PL.armRPivot.rotation.x*=(1-et);PL.armRPivot.rotation.z*=(1-et);
    if(PL.armL){PL.armL.rotation.x*=(1-et);PL.armL.rotation.z*=(1-et);}
    _atkBodyYaw*=(1-et);
    if(atkAnimTimer>=0.2){PL.atkPhase=0;atkAnimTimer=0;PL.armRPivot.rotation.set(0,0,0);if(PL.armL){PL.armL.rotation.x=0;PL.armL.rotation.z=0;}_atkBodyYaw=0;}
  }
}

/* ── 지팡이 공격 모션 ── */
function tickStaffAnim(dt){
  if(PL.atkPhase===1){
    var t=Math.min(1,atkAnimTimer/0.12);var et=easeOutQuad(t);
    PL.armRPivot.rotation.x=et*(-Math.PI*.8);PL.armRPivot.rotation.z=et*(-.15);_atkBodyYaw=et*(-.1);
    if(atkAnimTimer>=0.12){PL.atkPhase=2;atkAnimTimer=0;}
  }else if(PL.atkPhase===2){
    var t=Math.min(1,atkAnimTimer/0.15);var angle=t*Math.PI*2;
    PL.armRPivot.rotation.x=(-Math.PI*.3)+Math.sin(angle)*1.2;PL.armRPivot.rotation.z=Math.cos(angle)*.4;
    _atkBodyYaw=Math.sin(angle)*.15;if(PL.armL)PL.armL.rotation.x=Math.sin(angle+Math.PI)*.2;
    if(atkAnimTimer>=0.15){PL.atkPhase=3;atkAnimTimer=0;}
  }else if(PL.atkPhase===3){
    var t=Math.min(1,atkAnimTimer/0.2);var et=easeOutElastic(t);
    PL.armRPivot.rotation.x*=(1-et);PL.armRPivot.rotation.z*=(1-et);
    if(PL.armL)PL.armL.rotation.x*=(1-et);_atkBodyYaw*=(1-et);
    if(atkAnimTimer>=0.2){PL.atkPhase=0;atkAnimTimer=0;PL.armRPivot.rotation.set(0,0,0);if(PL.armL)PL.armL.rotation.x=0;_atkBodyYaw=0;}
  }
}

/* 공용 히트 플래시 머티리얼 (1번만 생성) */
var _hitFlashMat=new THREE.MeshLambertMaterial({color:0xff2222,emissive:new THREE.Color(0xff0000),emissiveIntensity:1.0});

function flashMonster(m){
  m.hitFlash=0.35;
  if(m._origMats){m._origMats.forEach(function(o){o.mesh.material=o.orig;});m._origMats=null;}
  var mats=[];
  m.mesh.traverse(function(c){
    if(c.isMesh){
      mats.push({mesh:c,orig:c.material});
      c.material=_hitFlashMat;
    }
  });
  m._origMats=mats;
  setTimeout(function(){
    if(m._origMats){
      m._origMats.forEach(function(o){o.mesh.material=o.orig;});
      m._origMats=null;
    }
  },180);
}

/* ── 마우스 월드 좌표 (레이캐스트) ── */
var mouseWorldX=0,mouseWorldZ=0;
var _groundPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
var _raycaster=new THREE.Raycaster();
var _mouseNDC=new THREE.Vector2();

/* 재사용 가능한 hit 벡터 — 매 mousemove마다 생성 방지 */
var _mouseHit=new THREE.Vector3();
document.addEventListener('mousemove',function(e){
  if(typeof camera==='undefined'||!camera||typeof renderer==='undefined'||!renderer)return;
  var rect=renderer.domElement.getBoundingClientRect();
  _mouseNDC.x=((e.clientX-rect.left)/rect.width)*2-1;
  _mouseNDC.y=-((e.clientY-rect.top)/rect.height)*2+1;
  _raycaster.setFromCamera(_mouseNDC,camera);
  if(_raycaster.ray.intersectPlane(_groundPlane,_mouseHit)){
    mouseWorldX=_mouseHit.x;mouseWorldZ=_mouseHit.z;
  }
},{passive:true});

/* ── 화살 시스템 ── */
var arrows=[];
var _arrowMat=new THREE.MeshLambertMaterial({color:0x8B4513});
var _arrowHeadMat=new THREE.MeshLambertMaterial({color:0xaabbcc});

/* ── 마법 투사체 (파이어볼 등) ── */
var magicProjectiles=[];
function shootMagicProjectile(dirX,dirZ,dmg,color,range,skillName){
  var g=new THREE.Group();
  /* 빛나는 구체 */
  var coreMat=new THREE.MeshBasicMaterial({color:color,transparent:true,opacity:0.9});
  var core=new THREE.Mesh(new THREE.SphereGeometry(.25,8,6),coreMat);
  g.add(core);
  /* 외곽 글로우 */
  var glowMat=new THREE.MeshBasicMaterial({color:color,transparent:true,opacity:0.3});
  var glow=new THREE.Mesh(new THREE.SphereGeometry(.45,6,5),glowMat);
  g.add(glow);
  /* PointLight */
  var light=new THREE.PointLight(color,1.0,8);
  g.add(light);
  /* 꼬리 파티클 (작은 구 3개) */
  var tailMat=new THREE.MeshBasicMaterial({color:color,transparent:true,opacity:0.5});
  for(var ti=0;ti<3;ti++){
    var tail=new THREE.Mesh(new THREE.SphereGeometry(.1-ti*.02,5,4),tailMat);
    tail.position.set(-dirX*(ti+1)*.2,0,-dirZ*(ti+1)*.2);
    g.add(tail);
  }
  var py=(typeof insideBuilding!=='undefined'&&insideBuilding)?PL.group.position.y+1:1.2;
  g.position.set(PL.group.position.x,py,PL.group.position.z);
  g.rotation.y=Math.atan2(dirX,dirZ);
  scene.add(g);
  magicProjectiles.push({mesh:g,dx:dirX,dz:dirZ,dmg:dmg,life:range/18,speed:18,color:color,name:skillName||'마법'});
}

function updateMagicProjectiles(dt){
  for(var i=magicProjectiles.length-1;i>=0;i--){
    var p=magicProjectiles[i];
    p.mesh.position.x+=p.dx*p.speed*dt;
    p.mesh.position.z+=p.dz*p.speed*dt;
    /* 구체 회전 + 크기 맥동 */
    p.mesh.rotation.y+=dt*5;
    var scale=1+Math.sin(Date.now()*0.01)*0.1;
    p.mesh.scale.set(scale,scale,scale);
    p.life-=dt;
    /* 몬스터 충돌 */
    var hit=false;
    for(var j=0;j<monsters.length;j++){
      var m=monsters[j];
      if(m.hp<=0)continue;
      var dx=p.mesh.position.x-m.mesh.position.x,dz=p.mesh.position.z-m.mesh.position.z;
      if(dx*dx+dz*dz<4){
        m.hp=Math.max(0,m.hp-p.dmg);
        m.hbf.style.width=Math.max(0,m.hp/m.maxHp*100)+'%';
        flashMonster(m);m.state='aggro';
        spawnDmgNum('-'+p.dmg,p.color?('#'+p.color.toString(16).padStart(6,'0')):'#ff6600');
        if(typeof SFX!=='undefined')SFX.hit();
        if(m.hp<=0)killMonster(m);
        hit=true;break;
      }
    }
    if(hit||p.life<=0){
      /* 히트 이펙트: 작은 폭발 */
      if(hit&&typeof spawnKillParticles==='function'){
        spawnKillParticles(p.mesh.position.x,p.mesh.position.y,p.mesh.position.z,p.color||0xff4400);
      }
      scene.remove(p.mesh);
      magicProjectiles.splice(i,1);
    }
  }
}

function shootArrow(dirX,dirZ,dmg){
  var g=new THREE.Group();
  var shaft=new THREE.Mesh(new THREE.CylinderGeometry(.02,.02,.6,4),_arrowMat);
  shaft.rotation.x=Math.PI/2;g.add(shaft);
  var head=new THREE.Mesh(new THREE.ConeGeometry(.05,.15,4),_arrowHeadMat);
  head.rotation.x=-Math.PI/2;head.position.set(0,0,.35);g.add(head);
  g.position.set(PL.group.position.x,1.2,PL.group.position.z);
  g.rotation.y=Math.atan2(dirX,dirZ);
  scene.add(g);
  arrows.push({mesh:g,dx:dirX,dz:dirZ,dmg:dmg,life:2.0,speed:25});
}

function updateArrows(dt){
  for(var i=arrows.length-1;i>=0;i--){
    var a=arrows[i];
    a.mesh.position.x+=a.dx*a.speed*dt;
    a.mesh.position.z+=a.dz*a.speed*dt;
    a.life-=dt;
    /* 몬스터 충돌 체크 */
    var hit=false;
    for(var j=0;j<monsters.length;j++){
      var m=monsters[j];
      if(m.state==='dead'||m.hp<=0)continue;
      var ex=a.mesh.position.x-m.mesh.position.x;
      var ez=a.mesh.position.z-m.mesh.position.z;
      if(ex*ex+ez*ez<1.5){
        m.hp=Math.max(0,m.hp-a.dmg);
        m.hbf.style.width=Math.max(0,m.hp/m.maxHp*100)+'%';
        spawnDmgNum('-'+a.dmg,'#ffdd44');
        if(typeof SFX!=='undefined')SFX.hit();
        triggerHitStop();
        flashMonster(m);
        m.state='aggro';
        var midx=monsters.indexOf(m);
        if(midx>=0&&typeof ws!=='undefined'&&ws&&ws.readyState===1)ws.send(JSON.stringify({type:'mhit',mid:midx,dmg:a.dmg,maxHp:m.maxHp}));
        if(m.hp<=0)killMonster(m);
        hit=true;break;
      }
    }
    if(hit||a.life<=0){
      scene.remove(a.mesh);
      arrows.splice(i,1);
    }
  }
}

/* ── 무기 타입 판별 ── */
function isRangedWeapon(){
  if(!equipped.weapon)return false;
  var def=getItemDef(equipped.weapon);
  return def&&def.icon==='bow';
}

/* ═══════════ 스킬 시스템 ═══════════ */
function useSkill(slotIdx){
  if(playerClass==='none'){
    /* 무직 상태에서도 전직 퀘스트용 오버헤드 슬래시 카운트 — 쿨 없이 사용 */
    if(typeof classQuestState!=='undefined'&&classQuestState['warrior']&&classQuestState['warrior'].state==='active'){
      if(slotIdx===0&&typeof onWarriorSlashUse==='function')onWarriorSlashUse();
    }
    return;
  }
  var skills=CLASS_SKILLS[playerClass];
  if(!skills||slotIdx>=skills.length)return;
  var sk=skills[slotIdx];
  /* 전사 오버헤드 슬래시 카운트 (shield_bash) */
  if(playerClass==='warrior'&&sk.id==='shield_bash'){
    if(typeof onWarriorSlashUse==='function')onWarriorSlashUse();
  }
  /* 쿨다운 체크 */
  if(skillCooldowns[sk.id]&&skillCooldowns[sk.id]>0){
    addChat('inf','','쿨다운 중 ('+Math.ceil(skillCooldowns[sk.id])+'초)');
    return;
  }
  skillCooldowns[sk.id]=sk.cd;

  var cls=CLASS_DEFS[playerClass]||CLASS_DEFS.none;
  var baseAtk=5;
  if(equipped.weapon){
    var wi=getItemFull(inventory.find(function(s){return s.itemId===equipped.weapon;})||{itemId:''});
    if(wi&&wi.stats&&wi.stats['공격력'])baseAtk=parseInt(wi.stats['공격력'])||5;
  }
  var dmg=Math.floor((baseAtk+Math.floor(Math.random()*5))*cls.atkMul*(sk.dmgMul||1));
  /* 비전공 무기 패널티 */
  if(playerClass!=='none'&&equipped.weapon){
    var _wDef2=getItemDef(equipped.weapon);
    if(_wDef2&&cls.weapons&&cls.weapons.indexOf(_wDef2.icon)===-1){
      dmg=Math.floor(dmg*0.6);
    }
  }

  /* 자가 힐 */
  if(sk.selfHeal){
    var heal=Math.floor(playerMaxHP*sk.selfHeal);
    playerHP=Math.min(playerMaxHP,playerHP+heal);
    updPlayerHpBar();
    spawnDmgNum('+'+heal,'#44ff88','heal');
    addChat('sys','[스킬]',sk.name+' 사용! HP +'+heal);
  }
  /* 자가 데미지 (광전사) */
  if(sk.selfDmg){
    var sd=Math.floor(playerMaxHP*sk.selfDmg);
    playerHP=Math.max(1,playerHP-sd);
    updPlayerHpBar();
  }
  /* 버프 */
  if(sk.buff){
    activeBuffs[sk.buff]={remaining:sk.buffDur};
    addChat('sys','[스킬]',sk.name+' 발동! ('+sk.buffDur+'초)');
  }
  /* 범위 공격 (AOE) */
  if(sk.aoe){
    var px=PL.group.position.x,pz=PL.group.position.z;
    var hitCount=0;
    monsters.forEach(function(m){
      if(m.state==='dead'||m.hp<=0)return;
      var dx=px-m.mesh.position.x,dz=pz-m.mesh.position.z;
      if(Math.sqrt(dx*dx+dz*dz)<sk.aoe){
        m.hp=Math.max(0,m.hp-dmg);
        m.hbf.style.width=Math.max(0,m.hp/m.maxHp*100)+'%';
        flashMonster(m);m.state='aggro';hitCount++;
        if(m.hp<=0)killMonster(m);
      }
    });
    if(hitCount>0)spawnDmgNum(sk.name+'! -'+dmg+'x'+hitCount,sk.color||'#ffdd44');
    triggerAtkAnim();
    return;
  }
  /* 발사체 스킬 */
  if(sk.projectile){
    var dx=mouseWorldX-PL.group.position.x;
    var dz=mouseWorldZ-PL.group.position.z;
    var len=Math.sqrt(dx*dx+dz*dz);
    if(len<0.1){dx=0;dz=1;len=1;}
    dx/=len;dz/=len;
    PL.group.rotation.y=Math.atan2(dx,dz);
    shootMagicProjectile(dx,dz,dmg,sk.pColor||0xff4400,sk.range||20,sk.name);
    triggerAtkAnim();
    if(typeof SFX!=='undefined')SFX.skill();
    return;
  }
  /* 멀티샷 (궁수) */
  if(sk.multiShot){
    var dx=mouseWorldX-PL.group.position.x;
    var dz=mouseWorldZ-PL.group.position.z;
    var len=Math.sqrt(dx*dx+dz*dz);
    if(len<0.1){dx=0;dz=1;len=1;}
    dx/=len;dz/=len;
    var angle=Math.atan2(dx,dz);
    var spread=0.25;
    for(var si=0;si<sk.multiShot;si++){
      var a=angle+(si-(sk.multiShot-1)/2)*spread;
      shootArrow(Math.sin(a),Math.cos(a),Math.floor(dmg/sk.multiShot*sk.dmgMul));
    }
    PL.group.rotation.y=angle;
    triggerAtkAnim();
    spawnDmgNum(sk.name+'!',sk.color||'#ffdd44');
    return;
  }
  /* 근접 단일/멀티 타격 */
  var target=null,bestDist=sk.range||6;
  monsters.forEach(function(m){
    if(m.state==='dead')return;
    var dx2=PL.group.position.x-m.mesh.position.x,dz2=PL.group.position.z-m.mesh.position.z;
    var d=Math.sqrt(dx2*dx2+dz2*dz2);
    if(d<bestDist){bestDist=d;target=m;}
  });
  if(!target){addChat('inf','','근처에 대상이 없다.');skillCooldowns[sk.id]=0;return;}
  /* 순간이동 (암살자) */
  if(sk.teleport){
    PL.group.position.x=target.mesh.position.x+1;
    PL.group.position.z=target.mesh.position.z+1;
  }
  var hits=sk.multiHit||1;
  for(var hi=0;hi<hits;hi++){
    var finalDmg=sk.forceCrit?Math.floor(dmg*cls.critDmg):dmg;
    target.hp=Math.max(0,target.hp-finalDmg);
    target.hbf.style.width=Math.max(0,target.hp/target.maxHp*100)+'%';
    spawnDmgNum('-'+finalDmg,sk.color||'#ffdd44');
  }
  if(sk.healMul){var h2=Math.floor(dmg*sk.healMul);playerHP=Math.min(playerMaxHP,playerHP+h2);updPlayerHpBar();}
  flashMonster(target);target.state='aggro';
  var ddx=target.mesh.position.x-PL.group.position.x;
  var ddz=target.mesh.position.z-PL.group.position.z;
  PL.group.rotation.y=Math.atan2(ddx,ddz);
  triggerAtkAnim();
  if(target.hp<=0)killMonster(target);
}

/* 스킬 쿨다운 + 버프 틱 (매 프레임 호출) */
function updateSkills(dt){
  for(var id in skillCooldowns){
    if(skillCooldowns[id]>0)skillCooldowns[id]-=dt;
  }
  for(var b in activeBuffs){
    activeBuffs[b].remaining-=dt;
    if(activeBuffs[b].remaining<=0)delete activeBuffs[b];
  }
  /* HUD 스킬 쿨다운 표시 — Diablo-style slot 업데이트 */
  var skills=CLASS_SKILLS[playerClass]||[];
  for(var i=0;i<skills.length;i++){
    var el=document.getElementById('skill-cd-'+i);
    var slotEl=document.getElementById('skill-slot-'+i);
    var sweepEl=document.getElementById('skill-sweep-'+i);
    if(!el)continue;
    var cd=skillCooldowns[skills[i].id]||0;
    var maxCd=skills[i].cd||1;
    el.textContent=cd>0?Math.ceil(cd)+'s':'';
    if(slotEl){
      if(cd>0){
        slotEl.className='skill-slot on-cooldown';
        if(sweepEl){sweepEl.style.display='block';sweepEl.style.opacity=Math.min(1,cd/maxCd)*0.6+'';}
      }else{
        slotEl.className='skill-slot ready';
        if(sweepEl){sweepEl.style.display='none';}
      }
    }
  }
}

function playerAttack(){
  if(attackCooldown>0)return;
  /* 무기 부서짐 체크 */
  if(typeof isItemBroken==='function'&&isItemBroken('weapon')){
    if(typeof addChat==='function')addChat('sys','[시스템]','무기가 부서졌습니다! 수리가 필요합니다.');
    attackCooldown=0.3;
    return;
  }

  var baseAtk=5;
  if(equipped.weapon){
    var wi=getItemFull(inventory.find(function(s){return s.itemId===equipped.weapon;})||{itemId:''});
    if(wi&&wi.stats&&wi.stats['공격력'])baseAtk=parseInt(wi.stats['공격력'])||5;
  }
  /* 무기 내구도 감소 */
  if(typeof damageEquipment==='function')damageEquipment('weapon',1);
  var cls=CLASS_DEFS[playerClass]||CLASS_DEFS.none;
  var dmg=Math.floor((baseAtk+Math.floor(Math.random()*5))*cls.atkMul);
  /* 비전공 무기 패널티: 40% 데미지 감소 */
  if(playerClass!=='none'&&equipped.weapon){
    var _wDef=getItemDef(equipped.weapon);
    if(_wDef&&cls.weapons&&cls.weapons.indexOf(_wDef.icon)===-1){
      dmg=Math.floor(dmg*0.6);
    }
  }
  /* 광전사 패시브: HP 낮을수록 ATK 증가 */
  if(cls.passive==='rage'){var hpRatio=playerHP/playerMaxHP;dmg=Math.floor(dmg*(1+(1-hpRatio)*0.8));}
  /* 치명타 판정 */
  var _isCrit=false;
  if(Math.random()<cls.crit){dmg=Math.floor(dmg*cls.critDmg);_isCrit=true;}

  /* 활: 마우스 방향으로 화살 발사 */
  if(isRangedWeapon()){
    /* 화살 소모 체크 */
    var arrowSlot=inventory.find(function(s){return s.itemId==='fire_arrow'||s.itemId==='arrow';});
    if(!arrowSlot){
      addChat('inf','','화살이 없다! 상점에서 구매하세요.');
      return;
    }
    /* 불화살 우선 사용 */
    var useFireArrow=arrowSlot.itemId==='fire_arrow';
    if(useFireArrow)dmg+=5;
    arrowSlot.qty--;
    if(arrowSlot.qty<=0){var ai=inventory.indexOf(arrowSlot);if(ai>=0)inventory.splice(ai,1);}
    var dx=mouseWorldX-PL.group.position.x;
    var dz=mouseWorldZ-PL.group.position.z;
    var len=Math.sqrt(dx*dx+dz*dz);
    if(len<0.1){dx=0;dz=1;len=1;}
    dx/=len;dz/=len;
    PL.group.rotation.y=Math.atan2(dx,dz);
    shootArrow(dx,dz,dmg);
    if(typeof SFX!=='undefined')SFX.bowShoot();
    attackCooldown=.5/cls.spdMul;
    triggerAtkAnim();
    if(typeof sendAttackMP==='function')sendAttackMP();
    return;
  }

  /* 근접 무기: 기존 로직 */
  var target=null,bestDist=6.0;
  monsters.forEach(function(m){
    if(m.state==='dead')return;
    var dx=PL.group.position.x-m.mesh.position.x;
    var dz=PL.group.position.z-m.mesh.position.z;
    var d=Math.sqrt(dx*dx+dz*dz);
    if(d<bestDist){bestDist=d;target=m;}
  });
  /* 레이드 보스 공격 체크 */
  if(!target&&typeof currentRaid!=='undefined'&&currentRaid&&currentRaid.bossObj&&!currentRaid.defeated){
    var rb=currentRaid.bossObj;
    if(rb.mesh){
      var rbdx=PL.group.position.x-rb.mesh.position.x;
      var rbdz=PL.group.position.z-rb.mesh.position.z;
      var rbdist=Math.sqrt(rbdx*rbdx+rbdz*rbdz);
      if(rbdist<currentRaid.def.scale*3.5){
        if(typeof damageRaidBoss==='function')damageRaidBoss(dmg);
        if(typeof SFX!=='undefined')SFX.hit();
        triggerHitStop();
        spawnDmgNum(dmg,_isCrit);
        attackCooldown=.5/cls.spdMul;
        triggerAtkAnim();
        return;
      }
    }
    /* 어드(추가 몬스터) 공격 */
    var addTarget=null,addBestDist=6.0;
    currentRaid.addsAlive.forEach(function(add){
      if(add.hp<=0)return;
      var dx=PL.group.position.x-add.mesh.position.x;
      var dz=PL.group.position.z-add.mesh.position.z;
      var d=Math.sqrt(dx*dx+dz*dz);
      if(d<addBestDist){addBestDist=d;addTarget=add;}
    });
    if(addTarget){
      addTarget.hp=Math.max(0,addTarget.hp-dmg);
      if(typeof SFX!=='undefined')SFX.hit();
      spawnDmgNum(dmg,_isCrit);
      attackCooldown=.5/cls.spdMul;
      triggerAtkAnim();
      return;
    }
  }
  if(!target){
    /* 레이드 중이 아닐 때만 메시지 */
    if(typeof currentRaid==='undefined'||!currentRaid){
      addChat('inf','','근처에 공격할 대상이 없다.');
    }
    return;
  }
  target.hp=Math.max(0,target.hp-dmg);
  target.hbf.style.width=Math.max(0,target.hp/target.maxHp*100)+'%';
  /* 원샷킬 감지용 히트 카운터 */
  target._hitCount=(target._hitCount||0)+1;
  if(typeof SFX!=='undefined')SFX.hit();
  triggerHitStop();
  /* 성기사 패시브: 흡혈 */
  if(cls.passive==='lifesteal'){var heal=Math.floor(dmg*0.05);playerHP=Math.min(playerMaxHP,playerHP+heal);updPlayerHpBar();}
  /* 주술사 패시브: 독 */
  if(cls.passive==='poison'&&target){target._poisonT=3;target._poisonDmg=Math.floor(dmg*0.15);}
  if(typeof SFX!=='undefined')SFX.swing();
  attackCooldown=.75/cls.spdMul;
  triggerAtkAnim();
  if(typeof sendAttackMP==='function')sendAttackMP();
  var midx=monsters.indexOf(target);
  if(midx>=0&&typeof ws!=='undefined'&&ws&&ws.readyState===1)ws.send(JSON.stringify({type:'mhit',mid:midx,dmg:dmg,maxHp:target.maxHp}));
  var ddx=target.mesh.position.x-PL.group.position.x;
  var ddz=target.mesh.position.z-PL.group.position.z;
  PL.group.rotation.y=Math.atan2(ddx,ddz);
  spawnDmgNum('-'+dmg,'#ffdd44',_isCrit?'crit':'normal');
  flashMonster(target);
  target.state='aggro';
  if(target.hp<=0)killMonster(target);
}

function killMonster(m){
  m.state='dead';
  if(typeof SFX!=='undefined')SFX.monsterDie();
  /* 사망 애니메이션 시작 (0.8초) */
  m.deathAnim=0.8;
  m.wrap.style.display='none';
  /* 붉은 공격 플래시 재료 복원 후 죽음 색상 적용 */
  if(m._origMats){m._origMats.forEach(function(o){o.mesh.material=o.orig;});m._origMats=null;}

  /* ── Diablo 킬 이펙트: 흰색 플래시 100ms ── */
  var _whiteMat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:1});
  var _savedMats=[];
  m.mesh.traverse(function(c){if(c.isMesh){_savedMats.push({mesh:c,orig:c.material});c.material=_whiteMat;}});
  setTimeout(function(){_savedMats.forEach(function(o){if(o.mesh)o.mesh.material=o.orig;});},100);

  /* ── 파티클 튀기기 ── */
  var mx=m.mesh.position.x,my=m.mesh.position.y,mz=m.mesh.position.z;
  if(typeof spawnKillParticles==='function')spawnKillParticles(mx,my,mz,m.def.color);

  var _expGain=m.def.exp;
  if(typeof getPartyExpShare==='function')_expGain=getPartyExpShare(_expGain);
  playerEXP+=_expGain;
  /* 킬 골드 보상 — 몬스터 레벨 × 5 ~ ×8 */
  var _killGold=Math.floor(m.def.lv*(5+Math.random()*3));
  if(typeof getStatBonuses==='function'){var _sb=getStatBonuses();_killGold=Math.floor(_killGold*(1+_sb.goldBonus));}
  gold+=_killGold;
  var _ge=document.getElementById('inv-gold');if(_ge)_ge.textContent='💰 '+gold+' 골드';
  if(typeof partyId!=='undefined'&&partyId&&typeof partyMembers!=='undefined'&&partyMembers.length>1)
    addChat('sys','[파티]',m.def.name+' 처치! (EXP +'+_expGain+', 골드 +'+_killGold+' / '+partyMembers.length+'명 분배)');
  else addChat('sys','[시스템]',m.def.name+' 처치! (EXP +'+_expGain+', 골드 +'+_killGold+')');
  checkLevelUp();
  if(typeof onMonsterKill==='function')onMonsterKill(m.def.name);
  var _wasOneShot=(m._hitCount||0)<=1;
  if(typeof checkClassQuestKill==='function')checkClassQuestKill(m.def.name,_wasOneShot);
  if(typeof checkDailyQuestProgress==='function')checkDailyQuestProgress('kill',m.def.name);
  if(typeof onMonsterKillForShaman==='function')onMonsterKillForShaman();
  if(typeof onKingdomMonsterKill==='function')onKingdomMonsterKill(m.def.name);
  /* ── 아이템 드롭: 인벤 직접 추가 대신 바닥 글로우 생성 ── */
  m.def.drops.forEach(function(drop){
    if(Math.random()<drop.rate){
      var qty=Array.isArray(drop.qty)?drop.qty[0]+Math.floor(Math.random()*(drop.qty[1]-drop.qty[0]+1)):drop.qty;
      var df=getItemDef(drop.id);
      /* 아이템 글로우 생성 (근처에 플레이어가 없을 때만 바닥 드롭) */
      var dropX=mx+(Math.random()-.5)*2,dropZ=mz+(Math.random()-.5)*2;
      if(df&&typeof spawnLootGlow==='function'){
        spawnLootGlow(dropX,dropZ,df,qty);
      }else{
        /* fallback: 글로우 없으면 직접 추가 */
        addItem(drop.id,qty);
        if(df)addChat('sys','[시스템]','['+df.name+'] x'+qty+' 획득!');
        if(typeof onItemCollect==='function')onItemCollect(drop.id,qty);
      }
    }
  });
  /* ── 무기/장비 랜덤 드롭 (5% 확률) ── */
  if(Math.random()<0.05){
    var _weaponPool=typeof ITEM_POOL!=='undefined'?ITEM_POOL.filter(function(it){return it.type==='weapon'||it.type==='armor';}):[];
    if(_weaponPool.length>0){
      /* 등급별 확률: common 60%, uncommon 25%, rare 10%, epic 4%, legendary 1% */
      var _roll=Math.random();
      var _rarity='common';
      if(_roll>0.99)_rarity='legendary';
      else if(_roll>0.95)_rarity='epic';
      else if(_roll>0.85)_rarity='rare';
      else if(_roll>0.60)_rarity='uncommon';
      /* 몬스터 레벨에 맞는 등급 필터 */
      var _filtered=_weaponPool.filter(function(it){return it.rarity===_rarity;});
      if(_filtered.length===0)_filtered=_weaponPool.filter(function(it){return it.rarity==='common';});
      if(_filtered.length>0){
        var _picked=_filtered[Math.floor(Math.random()*_filtered.length)];
        var _dropWx=mx+(Math.random()-.5)*2,_dropWz=mz+(Math.random()-.5)*2;
        if(typeof spawnLootGlow==='function'){
          spawnLootGlow(_dropWx,_dropWz,_picked,1);
        }else{
          addItem(_picked.id,1,_picked);
          addChat('sys','[시스템]','['+_picked.name+'] 드롭!');
        }
      }
    }
  }
  /* ── 야간 특수 드롭 (밤에만, 8% 확률) ── */
  var _isNightDrop=(typeof gameTime!=='undefined')&&(gameTime>=19||gameTime<5);
  if(_isNightDrop&&Math.random()<0.08){
    var _nightItems=[
      {id:'moon_shard',rate:0.4},
      {id:'shadow_essence',rate:0.3},
      {id:'night_crystal',rate:0.2},
      {id:'starlight_dust',rate:0.08},
      {id:'void_fragment',rate:0.02}
    ];
    var _nightRoll=Math.random(),_nightCum=0,_nightPick=null;
    for(var _ni=0;_ni<_nightItems.length;_ni++){
      _nightCum+=_nightItems[_ni].rate;
      if(_nightRoll<_nightCum){_nightPick=_nightItems[_ni].id;break;}
    }
    if(_nightPick){
      var _ndf=getItemDef(_nightPick);
      if(_ndf){
        var _ndx=mx+(Math.random()-.5)*2,_ndz=mz+(Math.random()-.5)*2;
        if(typeof spawnLootGlow==='function')spawnLootGlow(_ndx,_ndz,_ndf,1);
        else{addItem(_nightPick,1);addChat('sys','[시스템]','🌙 ['+_ndf.name+'] 획득!');}
      }
    }
  }
  setTimeout(function(){
    if(!m.mesh)return;
    m.hp=m.def.hp;var _respawnY=(typeof getTerrainY==='function')?getTerrainY(m.spawnX,m.spawnZ):0;m.mesh.position.set(m.spawnX,_respawnY,m.spawnZ);
    m.mesh.rotation.set(0,Math.random()*Math.PI*2,0);
    /* 재료 투명도 리셋 */
    m.mesh.traverse(function(c){
      if(c.isMesh&&c.material){c.material.opacity=1;c.material.transparent=false;}
    });
    m.mesh.scale.set(0,0,0);
    m.mesh.visible=true;m.wrap.style.display='';m.hbf.style.width='100%';
    m.state='idle';m.attackTimer=0;
    /* 스폰 애니메이션 재시작 */
    m.spawnAnim=0.6;m.deathAnim=-1;m.hitFlash=0;m.isAttacking=false;m._origMats=null;
  },30000);
}

function playerDied(){
  if(typeof SFX!=='undefined')SFX.playerDie();
  /* 사망 오버레이 */
  var ov=document.getElementById('death-overlay');
  if(!ov){
    ov=document.createElement('div');
    ov.id='death-overlay';
    ov.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;z-index:9998;display:flex;align-items:center;justify-content:center;pointer-events:none;opacity:0;transition:opacity 2s;';
    ov.innerHTML='<div style="background:rgba(0,0,0,0.95);width:100%;height:100%;display:flex;align-items:center;justify-content:center;flex-direction:column;">'
      +'<div id="death-text" style="color:#cc3333;font-size:28px;letter-spacing:5px;font-family:inherit;text-shadow:0 0 20px #ff0000;"></div>'
      +'</div>';
    document.body.appendChild(ov);
  }
  document.getElementById('death-text').textContent=myName+'님이 사망하셨습니다';
  ov.style.opacity='1';
  /* 2초 후 페이드아웃 + 리스폰 */
  setTimeout(function(){
    playerHP=Math.floor(playerMaxHP*.4);
    invincibleTimer=4;updPlayerHpBar();
    PL.group.position.set(WORLD_SPAWN[0],0,WORLD_SPAWN[1]);
    currentZone='village';
    scene.fog=new THREE.Fog(0x0a1510,120,500);scene.background=new THREE.Color(0x0a1510);
    var zi=ZONE_INFO['village'];
    document.querySelector('.hloc').textContent='▸ '+zi.name;
    /* 페이드아웃 — 눈 뜨는 느낌 */
    ov.style.transition='opacity 3s';
    ov.style.opacity='0';
    addChat('sys','[시스템]','마을로 귀환. HP 일부 회복.');
    setTimeout(function(){ov.style.transition='opacity 2s';},3500);
  },2500);
}

/* ═══════════ 텔레포트 두루마리 ═══════════ */
function useTpScroll(){
  var dev=isDev();
  var slot=inventory.find(function(s){return s.itemId==='tp_scroll';});
  if(!slot&&!dev){addChat('inf','','텔레포트 두루마리가 없습니다!');return;}
  /* 방문한 존 목록으로 UI 표시 */
  var modal=document.getElementById('tp-modal');
  if(!modal){
    modal=document.createElement('div');
    modal.id='tp-modal';
    modal.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:9998;display:none;flex-direction:column;align-items:center;justify-content:center;gap:12px;';
    modal.innerHTML='<div style="color:#c9a84c;font-size:20px;letter-spacing:3px;">▣ 텔레포트 ▣</div><div style="color:#aaa;font-size:12px;">이동할 장소를 선택하세요</div><div id="tp-list" style="display:flex;flex-direction:column;gap:8px;min-width:200px;"></div><button onclick="closeTpModal()" style="margin-top:10px;padding:8px 30px;background:#3a3a5a;color:#aaa;border:1px solid #555;cursor:pointer;font-family:inherit;">취소</button>';
    document.body.appendChild(modal);
  }
  var list=document.getElementById('tp-list');
  list.innerHTML='';
  for(var zk in ZONE_INFO){
    var zi=ZONE_INFO[zk];
    if(!visitedZones[zk]&&!dev)continue;
    if(zk===currentZone)continue;
    var btn=document.createElement('button');
    btn.style.cssText='padding:10px 20px;background:#1a1a2e;border:1px solid '+zi.color+';color:'+zi.color+';cursor:pointer;font-family:inherit;font-size:14px;border-radius:4px;';
    btn.textContent='◈ '+zi.name;
    btn.dataset.zone=zk;
    btn.onclick=function(){doTeleport(this.dataset.zone);};
    list.appendChild(btn);
  }
  if(list.children.length===0){
    list.innerHTML='<div style="color:#555;font-size:12px;text-align:center;">현재 위치 외에 방문한 장소가 없습니다.</div>';
  }
  modal.style.display='flex';
}

function closeTpModal(){
  var m=document.getElementById('tp-modal');
  if(m)m.style.display='none';
}

function doTeleport(zoneKey){
  var zi=ZONE_INFO[zoneKey];
  if(!zi||!zi.tp)return;
  /* 두루마리 소모 (개발자는 무소모) */
  if(!isDev()){
    var slot2=inventory.find(function(s){return s.itemId==='tp_scroll';});
    if(!slot2)return;
    slot2.qty--;
    if(slot2.qty<=0){var idx=inventory.indexOf(slot2);if(idx>=0)inventory.splice(idx,1);}
  }
  /* 건물 내부에서 텔레포트 시 건물 상태 초기화 */
  if(typeof insideBuilding!=='undefined'&&insideBuilding){
    insideBuilding=null;
    if(typeof _doorCooldown!=='undefined')_doorCooldown=2;
  }
  /* 텔레포트 */
  var tpX=zi.tp[0],tpZ=zi.tp[1];
  var tpY=(typeof getTerrainY==='function')?getTerrainY(tpX,tpZ):0;
  PL.group.position.set(tpX,tpY,tpZ);
  if(typeof SFX!=='undefined')SFX.teleport();
  closeTpModal();
  addChat('sys','[시스템]','★ '+zi.name+'(으)로 텔레포트!');
  /* 무적 3초 */
  invincibleTimer=3;
  /* 주변 몬스터 밀어내기 (반경 15) */
  if(typeof monsters!=='undefined'){
    for(var mi=0;mi<monsters.length;mi++){
      var mm=monsters[mi];
      if(mm.hp<=0)continue;
      var mdx=mm.mesh.position.x-tpX,mdz=mm.mesh.position.z-tpZ;
      var mDist=Math.sqrt(mdx*mdx+mdz*mdz);
      if(mDist<15){
        /* 몬스터를 반경 밖으로 밀어냄 */
        var pushDist=16;
        if(mDist>0.1){
          mm.mesh.position.x=tpX+mdx/mDist*pushDist;
          mm.mesh.position.z=tpZ+mdz/mDist*pushDist;
        }else{
          mm.mesh.position.x=tpX+pushDist;
          mm.mesh.position.z=tpZ;
        }
        mm.state='idle';
        mm.attackTimer=2;
      }
    }
  }
  /* 존 전환 트리거 */
  checkZone();
}

var MAX_LEVEL=50;
function checkLevelUp(){
  if(playerLevel>=MAX_LEVEL){playerEXP=0;return;}
  var need=Math.floor(100*Math.pow(playerLevel,2.2));
  if(playerEXP>=need){
    playerEXP-=need;playerLevel++;var cls=CLASS_DEFS[playerClass]||CLASS_DEFS.none;playerMaxHP+=Math.floor(12*cls.hpMul);playerHP=playerMaxHP;
    if(playerLevel>=MAX_LEVEL){playerEXP=0;addChat('sys','[시스템]','★★★ 최대 레벨 달성! ★★★');}
    document.querySelector('.hlv').textContent='Lv.'+playerLevel;
    updPlayerHpBar();
    if(typeof SFX!=='undefined')SFX.levelUp();
    addChat('sys','[시스템]','★ 레벨 UP! Lv.'+playerLevel+' 달성! (최대 HP +20)');
    gold+=playerLevel*10;document.getElementById('inv-gold').textContent='💰 '+gold+' 골드';
    /* 스탯 포인트 지급 */
    if(typeof grantStatPoints==='function')grantStatPoints(5);
    if(typeof applyStatEffects==='function')applyStatEffects();
  }
  var ef=document.getElementById('exp-bar-fill');
  if(ef)ef.style.width=Math.min(100,playerEXP/Math.floor(100*Math.pow(playerLevel,2.2))*100)+'%';
}

function updPlayerHpBar(){
  var pct=playerHP/playerMaxHP*100;
  document.querySelectorAll('.hbf.hp').forEach(function(f){
    f.style.width=pct+'%';
    /* 저체력 글로우 경고 (<25%) */
    if(pct<25)f.classList.add('low-hp');
    else f.classList.remove('low-hp');
  });
  var vals=document.querySelectorAll('.hbv');
  if(vals[0])vals[0].textContent=playerHP+'/'+playerMaxHP;
}

/* checkZone — 거리 기반 존 감지 (섬형 맵) + 분위기 전환 */
function checkZone(){
  if(typeof insideBuilding!=='undefined'&&insideBuilding)return;
  var px=PL.group.position.x;
  var pz=PL.group.position.z;
  var newZone='meadow'; /* 기본값 */
  var bestDist=Infinity;
  for(var zk in ZONE_CENTERS){
    var zc=ZONE_CENTERS[zk];
    var dx=px-zc.cx,dz=pz-zc.cz;
    var d=Math.sqrt(dx*dx+dz*dz);
    if(d<zc.r&&d<bestDist){bestDist=d;newZone=zk;}
  }
  /* 존에 해당하지 않으면 가장 가까운 존으로 */
  if(bestDist===Infinity){
    for(var zk2 in ZONE_CENTERS){
      var zc2=ZONE_CENTERS[zk2];
      var dx2=px-zc2.cx,dz2=pz-zc2.cz;
      var d2=Math.sqrt(dx2*dx2+dz2*dz2);
      if(d2<bestDist){bestDist=d2;newZone=zk2;}
    }
  }

  if(newZone!==currentZone){
    var prevZone=currentZone;
    currentZone=newZone;
    visitedZones[newZone]=true;
    /* 분위기 전환 */
    if(newZone==='village'){scene.fog=new THREE.Fog(0x0a1510,120,500);scene.background=new THREE.Color(0x0a1510);}
    else if(newZone==='meadow'){scene.fog=new THREE.Fog(0x1a3010,180,700);scene.background=new THREE.Color(0x1a3010);}
    else if(newZone==='swamp'){scene.fog=new THREE.Fog(0x050a05,80,350);scene.background=new THREE.Color(0x050a05);}
    else if(newZone==='darkforest'){scene.fog=new THREE.Fog(0x020202,60,280);scene.background=new THREE.Color(0x020202);}
    else if(newZone==='jungle'){scene.fog=new THREE.Fog(0x0a2010,70,300);scene.background=new THREE.Color(0x0a2010);}
    else if(newZone==='volcano'){scene.fog=new THREE.Fog(0x100500,80,350);scene.background=new THREE.Color(0x100500);}
    else if(newZone==='boss'){scene.fog=new THREE.Fog(0x080000,60,250);scene.background=new THREE.Color(0x080000);}

    /* 배너 표시 */
    var zi=ZONE_INFO[newZone];
    if(zi){
      var b=document.getElementById('zone-banner');
      b.textContent='◈ '+zi.name+' 진입';b.style.color=zi.color;b.style.borderColor=zi.color+'66';
      b.classList.add('show');setTimeout(function(){b.classList.remove('show');},2800);
      document.querySelector('.hloc').textContent='▸ '+zi.name;
    }
    /* 시스템 메시지 */
    var msgs={
      meadow:'초원 진입. 토끼와 사슴이 있습니다.',
      swamp:'늪지대 진입! 슬라임과 독두꺼비가 나타납니다.',
      darkforest:'어두운 숲 진입! 고블린과 늑대를 조심하세요!',
      jungle:'정글 진입! 거미, 독사, 유인원이 서식합니다!',
      volcano:'화산 지대 진입!! 용암 골렘과 드레이크가 기다립니다!!',
      boss:'마왕성 진입!!! 고대 화염룡이 기다리고 있다!!!',
      village:'마을로 귀환. HP 일부 회복.',
    };
    if(msgs[newZone])addChat('sys','[시스템]',msgs[newZone]);
    if(typeof playBGM==='function')playBGM(newZone);
    /* 마을 귀환 시 HP 회복 */
    if(newZone==='village'){
      playerHP=Math.min(playerMaxHP,playerHP+Math.floor(playerMaxHP*.25));
      updPlayerHpBar();
    }
  }
}

/* 물 속 여부 판정 */
var _inWater=false;
var _waterDepth=0;/* 0=지상, 양수=물에 잠긴 깊이 */
var _dashActive=0;/* 대쉬 지속시간 타이머 */
var _dashCooldown=0;/* 대쉬 쿨다운 */
var _DASH_COOLDOWN=4;/* 4초 쿨다운 */
var _DASH_DURATION=0.25;/* 0.25초 지속 */
function tryDash(){
  if(playerLevel<5)return false;
  if(_dashCooldown>0)return false;
  if(_dashActive>0)return false;
  if(typeof insideBuilding!=='undefined'&&insideBuilding)return false;
  _dashActive=_DASH_DURATION;
  _dashCooldown=_DASH_COOLDOWN;
  if(typeof SFX!=='undefined')SFX.teleport();
  if(typeof addChat==='function')addChat('inf','','대쉬!');
  return true;
}

var _BRIDGES=[
  /* [cx, cz, halfLen, halfWid, rotated] — rotated=true면 다리가 동서방향(90도회전) */
  [0,-200,12,2,true],[0,-350,12,2,true],[0,200,12,2,true],[0,400,12,2,true],
  [-150,0,12,2,false],[150,0,12,2,false],[-350,0,12,2,false],[350,0,12,2,false],
  [-200,-350,12,2,true],[-200,-300,12,2,true],
  [0,375,12,2,false],[100,375,12,2,false]
];
function isOnBridge(x,z){
  for(var i=0;i<_BRIDGES.length;i++){
    var b=_BRIDGES[i];
    var dx=Math.abs(x-b[0]),dz=Math.abs(z-b[1]);
    if(b[4]){/* 회전된 다리: 길이가 x방향 */
      if(dx<b[2]&&dz<b[3])return true;
    }else{/* 일반: 길이가 z방향 */
      if(dx<b[3]&&dz<b[2])return true;
    }
  }
  return false;
}
function isOverWater(x,z){
  if(typeof insideBuilding!=='undefined'&&insideBuilding)return false;
  if(isOnBridge(x,z))return false;
  /* 지형이 물 높이(0) 위로 솟아있으면 물이 아님 — 땅속 강 방지 */
  if(typeof getTerrainY==='function'&&getTerrainY(x,z)>0.5)return false;
  /* 중앙 남북 강: x≈0, z:-400~500 */
  if(z>-400&&z<500&&Math.abs(x-RIVER_CENTER_X)<RIVER_HALF_W)return true;
  /* 동서 분기: z≈0 부근, x:-400~-10 또는 x:10~400 */
  if(Math.abs(z)<RIVER_HALF_W&&(Math.abs(x)>10&&Math.abs(x)<400))return true;
  /* 마을↔초원 강: x≈-200, z:-500~-150 */
  if(z>-500&&z<-150&&Math.abs(x+200)<7)return true;
  /* 어두운숲↔화산 강: z≈375, x:-125~175 */
  if(Math.abs(z-375)<7&&x>-125&&x<175)return true;
  return false;
}

function handleMove(dt){
  tickAtkAnim(dt);
  /* 상태이상 틱 */
  if(playerPoisoned>0){
    playerPoisoned-=dt;
    if(playerPoisoned<=0){playerPoisoned=0;addChat('inf','','독이 해제되었다.');}
    else{
      playerHP=Math.max(1,Math.floor(playerHP-playerPoisonDmg*dt));
      updPlayerHpBar();
    }
  }
  if(playerSlowed>0)playerSlowed-=dt;

  /* ── 물 물리 (건물 내부에서는 스킵) ── */
  if(typeof insideBuilding!=='undefined'&&insideBuilding){_inWater=false;_waterDepth=0;_waterDmgTimer=0;}
  var px=PL.group.position.x,pz=PL.group.position.z;
  var wasInWater=_inWater;
  if(!(typeof insideBuilding!=='undefined'&&insideBuilding))_inWater=isOverWater(px,pz);
  if(_inWater){
    /* 물에 들어가면 Y 서서히 낮아짐 */
    _waterDepth=Math.min(_waterDepth+dt*1.5,0.8);
    PL.group.position.y=-_waterDepth;
    if(!wasInWater)addChat('inf','','물에 빠졌다! 이동이 느려진다.');
    /* 물 데미지: 5초마다 2 데미지 */
    _waterDmgTimer=(_waterDmgTimer||0)+dt;
    if(_waterDmgTimer>5){
      _waterDmgTimer=0;
      playerHP=Math.max(1,playerHP-2);
      updPlayerHpBar();
    }
  }else{
    /* 물 밖으로 나오면 Y 복귀 */
    if(_waterDepth>0){
      _waterDepth=Math.max(0,_waterDepth-dt*3);
      if(_waterDepth===0&&wasInWater)addChat('inf','','강에서 빠져나왔다.');
    }
    _waterDmgTimer=0;
  }

  var dx=0,dz=0;
  if(typeof insideBuilding!=='undefined'&&insideBuilding){
    /* 건물 내부: 화면 기준 상하좌우 (탑다운) */
    if(keys['w']||keys['arrowup'])dz=-1;
    if(keys['s']||keys['arrowdown'])dz=1;
    if(keys['a']||keys['arrowleft'])dx=-1;
    if(keys['d']||keys['arrowright'])dx=1;
  }else{
    if(keys['w']||keys['arrowup']){dx-=Math.sin(cYaw);dz-=Math.cos(cYaw);}
    if(keys['s']||keys['arrowdown']){dx+=Math.sin(cYaw);dz+=Math.cos(cYaw);}
    if(keys['a']||keys['arrowleft']){dx-=Math.cos(cYaw);dz+=Math.sin(cYaw);}
    if(keys['d']||keys['arrowright']){dx+=Math.cos(cYaw);dz-=Math.sin(cYaw);}
  }
  /* ── 대쉬 쿨다운 틱 ── */
  if(_dashCooldown>0)_dashCooldown-=dt;
  if(_dashActive>0){
    _dashActive-=dt;
    if(_dashActive<=0){_dashActive=0;}
  }
  var moving=dx!==0||dz!==0;
  if(moving){
    if(typeof SFX!=='undefined')SFX.step();
    var len=Math.sqrt(dx*dx+dz*dz);dx/=len;dz/=len;
    var spdMul=(CLASS_DEFS[playerClass]||CLASS_DEFS.none).spdMul;
    if(playerSlowed>0)spdMul*=0.4;/* 둔화 시 60% 감속 */
    if(_inWater)spdMul*=0.35;/* 물 속 65% 감속 */
    /* ── 대쉬 ── */
    if(_dashActive>0)spdMul*=3.5;/* 대쉬 중 3.5배 속도 */
    /* ── 달리기 (Shift 홀드, 레벨 5+) ── */
    else if(playerLevel>=5&&keys['shift']&&!_inWater)spdMul*=1.6;
    var spd=6.0*spdMul*dt,nx=PL.group.position.x+dx*spd,nz=PL.group.position.z+dz*spd;
    /* 건물 내부에서는 벽 안으로 제한 */
    if(typeof insideBuilding!=='undefined'&&insideBuilding){
      var _iw=insideBuilding==='모험가 길드'?14:9;
      if(nx>-_iw&&nx<_iw)PL.group.position.x=nx;
      if(nz>-_iw&&nz<_iw)PL.group.position.z=nz;
    }else{
      var _icx=ISLAND_CENTER_X,_icz=ISLAND_CENTER_Z;
      var _irx=ISLAND_RADIUS_X,_irz=ISLAND_RADIUS_Z;
      var _exN=(nx-_icx)/_irx,_ezN=(PL.group.position.z-_icz)/_irz;
      var _exC=(PL.group.position.x-_icx)/_irx,_ezZ=(nz-_icz)/_irz;
      if(_exN*_exN+_ezN*_ezN<1&&!hitCollider(nx,PL.group.position.z))PL.group.position.x=nx;
      if(_exC*_exC+_ezZ*_ezZ<1&&!hitCollider(PL.group.position.x,nz))PL.group.position.z=nz;
    }
    var newYaw=Math.atan2(dx,dz);
    PL.group.rotation.y=newYaw;
    /* 방향 전환 속도 계산 — 각도 델타 누적 */
    var yawDelta=newYaw-_prevYaw;
    if(yawDelta>Math.PI)yawDelta-=Math.PI*2;
    if(yawDelta<-Math.PI)yawDelta+=Math.PI*2;
    _turnVel=_turnVel*0.7+yawDelta*0.3/Math.max(dt,0.001);
    _prevYaw=newYaw;
    _idleTimer=0;_longIdleT=0;_longIdlePhase=0;
    var isSprint=(playerLevel>=5&&keys['shift']&&!_inWater);
    var walkSpeed=isSprint?12:9;
    PL.bobT+=dt*walkSpeed;
    _hipSwayT+=dt*walkSpeed;
    var wa=isSprint?0.44:0.32;
    var sinB=Math.sin(PL.bobT);
    /* 다리: 정상 보행 */
    PL.legL.rotation.x=sinB*wa;
    PL.legR.rotation.x=-sinB*wa;
    /* 팔: 다리 반대 방향 스윙 (더 자연스러운 진자) */
    var armAmp=wa*0.65;
    PL.armL.rotation.x=sinB*armAmp;    /* 오른 다리와 동위상 */
    if(PL.atkPhase===0)PL.armRPivot.rotation.x=-sinB*armAmp; /* 왼 다리와 동위상 */
    /* 어깨(armRPivot) Z 방향 미세 움직임 */
    if(PL.atkPhase===0)PL.armRPivot.rotation.z=Math.cos(PL.bobT)*0.04;
    PL.armL.rotation.z=-Math.cos(PL.bobT)*0.04;
    /* 힙 스웨이: 몸통 Z 기울기 */
    if(PL.body)PL.body.rotation.z=Math.sin(_hipSwayT*0.5)*0.025;
    /* 방향 전환 시 몸통 기울기 */
    var tiltClamp=Math.max(-0.12,Math.min(0.12,_turnVel*0.02));
    if(PL.body)PL.body.rotation.z+=tiltClamp;
    /* 머리 bob: 위아래 약간 + 진행 방향으로 살짝 앞으로 기울기 */
    if(PL.head){
      PL.head.rotation.x=Math.abs(sinB)*(-0.04);
      PL.head.rotation.z=-tiltClamp*0.5;
      /* 눈 깜빡임 리셋 */
      PL.head.scale.y=_blinkOpen;
    }
    if(!_inWater&&!(typeof insideBuilding!=='undefined'&&insideBuilding)){
      var _ty=typeof getTerrainY==='function'?getTerrainY(PL.group.position.x,PL.group.position.z):0;
      /* 발 착지 Y 딥: 발이 바닥에 닿는 순간 약간 낮아짐 */
      var footPhase=Math.abs(sinB);
      var plantDip=footPhase<0.15?(0.015*(1-footPhase/0.15)):0;
      PL.group.position.y=_ty+Math.abs(sinB)*0.055-plantDip;
    }
  }else{
    /* ── 아이들 상태 ── */
    _idleTimer+=dt;
    _turnVel*=0.85;
    /* 다리/팔 부드럽게 귀환 */
    PL.legL.rotation.x*=0.8;PL.legR.rotation.x*=0.8;
    /* 무기 장착 시 전투 자세 (lerp to stance) */
    var hasWeapon=equipped&&equipped.weapon;
    if(PL.atkPhase===0){
      if(hasWeapon){
        /* 오른팔: 자연스럽게 옆에 (검은 손에 늘어뜨림) */
        PL.armRPivot.rotation.x+=(0-PL.armRPivot.rotation.x)*0.1;
        PL.armRPivot.rotation.z+=(0-PL.armRPivot.rotation.z)*0.1;
        /* 왼팔: 자연스럽게 옆에 */
        PL.armL.rotation.x+=(0-PL.armL.rotation.x)*0.1;
        PL.armL.rotation.z+=(0-PL.armL.rotation.z)*0.1;
        /* 몸통 정면 */
        if(PL.body)PL.body.rotation.y*=0.92;
      }else{
        PL.armRPivot.rotation.x*=0.8;PL.armRPivot.rotation.z*=0.85;
        PL.armL.rotation.x*=0.8;PL.armL.rotation.z*=0.85;
        if(PL.body)PL.body.rotation.y*=0.9;
      }
    }
    /* 호흡 애니메이션 (body scale.y 미세 맥동) */
    _breathT+=dt;
    if(PL.body){
      var breathAmp=0.012;
      PL.body.scale.y=1+Math.sin(_breathT*1.5)*breathAmp;
      PL.body.scale.x=1-Math.sin(_breathT*1.5)*breathAmp*0.5;
      /* 몸통 좌우 스웨이 */
      PL.body.rotation.z=Math.sin(_breathT*0.6)*0.008;
    }
    /* 머리 아이들 */
    if(PL.head){
      PL.head.rotation.x=Math.sin(_breathT*1.5)*0.012;
      PL.head.rotation.z*=0.9;
    }
    /* 눈 깜빡임: 평균 3초에 한번, 0.1초 동안 */
    _blinkTimer-=dt;
    if(_blinkTimer<=0){
      _blinkTimer=2.5+Math.random()*2.5;
      _blinkOpen=0.15;/* 눈 감기 */
    }else if(_blinkOpen<1){
      _blinkOpen=Math.min(1,_blinkOpen+dt*12);/* 눈 뜨기 */
    }
    if(PL.head)PL.head.scale.y=_blinkOpen;
    /* ── 장시간 아이들 (10초 이상) ── */
    if(_idleTimer>10){
      _longIdleT+=dt;
      /* 팔 스트레칭: 양팔 올라갔다 내려오는 cycle */
      var litCycle=_longIdleT%8;
      if(litCycle<1){
        /* 서서히 양팔 올리기 */
        var lp=litCycle;
        if(PL.atkPhase===0)PL.armRPivot.rotation.x+=-lp*0.5;
        PL.armL.rotation.x+=lp*0.3;
      }else if(litCycle<1.8){
        /* 양팔 올린 상태 유지 */
      }else if(litCycle<2.8){
        /* 내리기 */
        var lp2=(litCycle-1.8);
        if(PL.atkPhase===0)PL.armRPivot.rotation.x+=(lp2-1)*0.5;
      }
      /* 고개 천천히 돌리기 */
      if(PL.head)PL.head.rotation.y=Math.sin(_longIdleT*0.4)*0.25;
    }else{
      _longIdleT=0;
      if(PL.head)PL.head.rotation.y=Math.sin(_breathT*0.3)*0.04;
    }
    if(!_inWater&&!(typeof insideBuilding!=='undefined'&&insideBuilding)){
      var _ty2=typeof getTerrainY==='function'?getTerrainY(PL.group.position.x,PL.group.position.z):0;
      PL.group.position.y=_ty2+(PL.group.position.y-_ty2)*0.8;
    }
  }
}
var _waterDmgTimer=0;

/* ═══════════ 코스메틱 메시 시스템 ═══════════ */
var _capeSwayT=0;

function refreshCosmeticMesh(){
  if(!PL.group)return;

  /* ── 갑옷 제거 ── */
  if(PL.armorMesh){PL.body.remove(PL.armorMesh);PL.armorMesh=null;}
  if(PL.helmMesh){PL.head.remove(PL.helmMesh);PL.helmMesh=null;}
  if(PL.glovesL){PL.armL.remove(PL.glovesL);PL.glovesL=null;}
  if(PL.glovesR){PL.armRPivot.remove(PL.glovesR);PL.glovesR=null;}
  if(PL.bootsL){PL.legL.remove(PL.bootsL);PL.bootsL=null;}
  if(PL.bootsR){PL.legR.remove(PL.bootsR);PL.bootsR=null;}

  /* ── 갑옷 생성 ── */
  var armorId=equipped.armor;
  if(armorId&&PL.body){
    var armorDef=getItemDef(armorId);
    if(armorDef){
      var icon=armorDef.icon||'armor';
      var rarity=armorDef.rarity||'common';
      var rarityColors={common:0x888888,uncommon:0x88aa88,rare:0x88aacc,epic:0xaa88dd,legendary:0xdda044,hidden:0xff66aa};
      var armorColor=rarityColors[rarity]||0x888888;
      var emColor=(rarity==='legendary'||rarity==='epic'||rarity==='hidden')?armorColor:0x000000;
      var armorMat=new THREE.MeshLambertMaterial({color:armorColor,emissive:new THREE.Color(emColor),emissiveIntensity:0.15});

      if(icon==='armor'||icon==='robe'||!icon){
        /* 가슴/몸통 갑옷 — 몸통보다 약간 크게 덮음 */
        var chest=new THREE.Mesh(new THREE.BoxGeometry(.62,.78,.38),armorMat);
        chest.position.set(0,0,0);
        /* 어깨 패드 */
        var shoulderL=new THREE.Mesh(new THREE.SphereGeometry(.13,8,6),armorMat);
        shoulderL.position.set(-.32,.32,0);chest.add(shoulderL);
        var shoulderR=new THREE.Mesh(new THREE.SphereGeometry(.13,8,6),armorMat);
        shoulderR.position.set(.32,.32,0);chest.add(shoulderR);
        /* 가슴 장식 (등급에 따라) */
        if(rarity!=='common'){
          var emblem=new THREE.Mesh(new THREE.CircleGeometry(.07,6),new THREE.MeshLambertMaterial({color:0xffcc44,emissive:new THREE.Color(0x886622),emissiveIntensity:0.5}));
          emblem.position.set(0,.05,.2);chest.add(emblem);
        }
        /* 허리 벨트 */
        var belt=new THREE.Mesh(new THREE.BoxGeometry(.66,.08,.4),new THREE.MeshLambertMaterial({color:0x3a1808}));
        belt.position.set(0,-.32,0);chest.add(belt);
        var buckle=new THREE.Mesh(new THREE.BoxGeometry(.1,.08,.05),new THREE.MeshLambertMaterial({color:0xddaa44}));
        buckle.position.set(0,-.32,.21);chest.add(buckle);
        PL.body.add(chest);
        PL.armorMesh=chest;
        /* 전설 — 글로우 */
        if(rarity==='legendary'||rarity==='epic'){
          var aLight=new THREE.PointLight(armorColor,0.3,2);
          aLight.position.set(0,0,.3);chest.add(aLight);
        }
      }
      if(icon==='helmet'&&PL.head){
        var helm=new THREE.Mesh(new THREE.BoxGeometry(.5,.42,.5),armorMat);
        helm.position.set(0,.05,0);
        /* 헬멧 바이저 */
        var visor=new THREE.Mesh(new THREE.BoxGeometry(.46,.08,.04),new THREE.MeshBasicMaterial({color:0x111111}));
        visor.position.set(0,.04,.24);helm.add(visor);
        /* 헬멧 위 깃털/장식 */
        if(rarity!=='common'){
          var crest=new THREE.Mesh(new THREE.BoxGeometry(.06,.18,.3),new THREE.MeshLambertMaterial({color:rarity==='legendary'?0xff4444:0x4488ff}));
          crest.position.set(0,.32,0);helm.add(crest);
        }
        PL.head.add(helm);
        PL.helmMesh=helm;
      }
      if(icon==='gloves'){
        if(PL.armL){
          var gL=new THREE.Mesh(new THREE.BoxGeometry(.18,.18,.18),armorMat);
          gL.position.set(0,-.32,0);PL.armL.add(gL);PL.glovesL=gL;
        }
        if(PL.armRPivot){
          var gR=new THREE.Mesh(new THREE.BoxGeometry(.18,.18,.18),armorMat);
          gR.position.set(0,-.32,0);PL.armRPivot.add(gR);PL.glovesR=gR;
        }
      }
      if(icon==='boots'){
        if(PL.legL){
          var bL=new THREE.Mesh(new THREE.BoxGeometry(.22,.22,.28),armorMat);
          bL.position.set(0,-.36,.04);PL.legL.add(bL);PL.bootsL=bL;
        }
        if(PL.legR){
          var bR=new THREE.Mesh(new THREE.BoxGeometry(.22,.22,.28),armorMat);
          bR.position.set(0,-.36,.04);PL.legR.add(bR);PL.bootsR=bR;
        }
      }
    }
  }

  /* ── 모자 제거 ── */
  if(PL.hatMesh){PL.head.remove(PL.hatMesh);PL.hatMesh=null;}

  /* ── 망토 제거 ── */
  if(PL.capeMesh){PL.group.remove(PL.capeMesh);PL.capeMesh=null;}

  /* ── 염색: body 색 복원 또는 변경 ── */
  var dyeId=equipped.dye;
  if(dyeId){
    var dyeDef=getItemDef(dyeId);
    if(dyeDef&&dyeDef.color&&PL.bodyMat){
      PL.bodyMat.color.set(dyeDef.color);
    }
  } else {
    /* 염색 없으면 기본 초록 */
    if(PL.bodyMat)PL.bodyMat.color.set(0x2a6a3a);
  }

  /* ── 모자 생성 ── */
  var hatId=equipped.hat;
  if(hatId&&PL.head){
    var hatDef=getItemDef(hatId);
    if(hatDef){
      var hatColor=hatDef.color?parseInt(hatDef.color.replace('#','0x')):0xffffff;
      var hm=new THREE.MeshLambertMaterial({color:hatColor});
      var hatG=new THREE.Group();

      if(hatId==='wizard_hat'){
        var cone=new THREE.Mesh(new THREE.ConeGeometry(.18,.45,8),hm);
        cone.position.set(0,.28,0);hatG.add(cone);
        var brim=new THREE.Mesh(new THREE.CylinderGeometry(.28,.28,.04,8),hm);
        brim.position.set(0,.06,0);hatG.add(brim);
      } else if(hatId==='crown'){
        var base=new THREE.Mesh(new THREE.CylinderGeometry(.22,.22,.1,8),hm);
        base.position.set(0,.06,0);hatG.add(base);
        var spike1=new THREE.Mesh(new THREE.CylinderGeometry(.02,.04,.12,5),hm);
        spike1.position.set(0,.18,0);hatG.add(spike1);
        var spike2=new THREE.Mesh(new THREE.CylinderGeometry(.02,.04,.12,5),hm);
        spike2.position.set(.14,.15,.08);hatG.add(spike2);
        var spike3=new THREE.Mesh(new THREE.CylinderGeometry(.02,.04,.12,5),hm);
        spike3.position.set(-.14,.15,.08);hatG.add(spike3);
        var spike4=new THREE.Mesh(new THREE.CylinderGeometry(.02,.04,.12,5),hm);
        spike4.position.set(.14,.15,-.08);hatG.add(spike4);
        var spike5=new THREE.Mesh(new THREE.CylinderGeometry(.02,.04,.12,5),hm);
        spike5.position.set(-.14,.15,-.08);hatG.add(spike5);
      } else if(hatId==='bunny_ears'){
        var earL=new THREE.Mesh(new THREE.BoxGeometry(.07,.3,.05),hm);
        earL.position.set(-.12,.28,0);hatG.add(earL);
        var earR=new THREE.Mesh(new THREE.BoxGeometry(.07,.3,.05),hm);
        earR.position.set(.12,.28,0);hatG.add(earR);
        /* ピンク inside */
        var pm=new THREE.MeshLambertMaterial({color:0xffaabb});
        var earLi=new THREE.Mesh(new THREE.BoxGeometry(.04,.2,.04),pm);
        earLi.position.set(-.12,.27,0);hatG.add(earLi);
        var earRi=new THREE.Mesh(new THREE.BoxGeometry(.04,.2,.04),pm);
        earRi.position.set(.12,.27,0);hatG.add(earRi);
      } else if(hatId==='santa_hat'){
        var rim=new THREE.Mesh(new THREE.CylinderGeometry(.26,.26,.06,8),new THREE.MeshLambertMaterial({color:0xffffff}));
        rim.position.set(0,.04,0);hatG.add(rim);
        var rcone=new THREE.Mesh(new THREE.ConeGeometry(.2,.38,8),hm);
        rcone.position.set(.04,.3,0);rcone.rotation.z=-.2;hatG.add(rcone);
        var pom=new THREE.Mesh(new THREE.SphereGeometry(.06,6,6),new THREE.MeshLambertMaterial({color:0xffffff}));
        pom.position.set(.1,.52,.0);hatG.add(pom);
      } else if(hatId==='knight_helm'){
        var helm=new THREE.Mesh(new THREE.BoxGeometry(.44,.42,.44),hm);
        helm.position.set(0,.2,0);hatG.add(helm);
        var visor=new THREE.Mesh(new THREE.BoxGeometry(.28,.08,.04),new THREE.MeshLambertMaterial({color:0x333333}));
        visor.position.set(0,.16,.23);hatG.add(visor);
      }

      hatG.position.set(0,.22,0);
      PL.head.add(hatG);
      PL.hatMesh=hatG;
    }
  }

  /* ── 망토 생성 ── */
  var capeId=equipped.cape;
  if(capeId&&PL.group){
    var capeDef=getItemDef(capeId);
    if(capeDef){
      var capeColor=capeDef.color?parseInt(capeDef.color.replace('#','0x')):0xcc2222;
      var isShadow=(capeId==='shadow_cape');
      var capeMat=new THREE.MeshLambertMaterial({color:capeColor,transparent:isShadow,opacity:isShadow?.55:1.0,side:THREE.DoubleSide});
      var capeG=new THREE.Group();
      /* 상단 좁고 하단 넓은 사다리꼴 형태 (BoxGeometry로 근사) */
      var cTop=new THREE.Mesh(new THREE.BoxGeometry(.45,.08,.04),capeMat);
      cTop.position.set(0,.0,0);capeG.add(cTop);
      var cMid=new THREE.Mesh(new THREE.BoxGeometry(.5,.4,.04),capeMat);
      cMid.position.set(0,-.25,0);capeG.add(cMid);
      var cBot=new THREE.Mesh(new THREE.BoxGeometry(.58,.3,.04),capeMat);
      cBot.position.set(0,-.55,0);capeG.add(cBot);
      /* 위치: 등 뒤 */
      capeG.position.set(0,1.35,-.22);
      PL.group.add(capeG);
      PL.capeMesh=capeG;
    }
  }

  /* ── 횃불 라이트 ── */
  if(PL._torchLight){PL.group.remove(PL._torchLight);PL._torchLight=null;}
  if(PL._torchMesh){PL.group.remove(PL._torchMesh);PL._torchMesh=null;}
  var torchId=equipped.torch;
  if(torchId&&PL.group){
    var torchDef=getItemDef(torchId);
    if(torchDef){
      /* 횃불 메쉬 (왼손에 들기) */
      var tg=new THREE.Group();
      var stick=new THREE.Mesh(new THREE.CylinderGeometry(.03,.04,.8,5),new THREE.MeshLambertMaterial({color:0x6a4a1a}));
      stick.position.set(0,.4,0);tg.add(stick);
      var flameColor=(torchId==='bright_torch')?0x4488ff:(torchId==='eternal_torch')?0xaa44ff:0xff6600;
      var flameMat=new THREE.MeshBasicMaterial({color:flameColor,transparent:true,opacity:.8});
      var flame=new THREE.Mesh(new THREE.SphereGeometry(.08,6,5),flameMat);
      flame.position.set(0,.85,0);flame.scale.y=1.5;tg.add(flame);
      tg.position.set(-.35,0,.15);
      PL.group.add(tg);
      PL._torchMesh=tg;

      /* PointLight — 밤에만 활성화 */
      var lightRange=(torchId==='eternal_torch')?25:(torchId==='bright_torch')?18:12;
      var lightIntensity=(torchId==='eternal_torch')?1.2:(torchId==='bright_torch')?0.9:0.6;
      var tLight=new THREE.PointLight(flameColor,0,lightRange);/* intensity 0으로 시작 — tickTorchLight에서 제어 */
      tLight.position.set(-.35,1.2,.15);
      PL.group.add(tLight);
      PL._torchLight=tLight;
      PL._torchIntensity=lightIntensity;
    }
  }
}

/* ── 횃불 라이트 업데이트 (밤에만 켜짐) ── */
var _torchFlickerT=0;
function tickTorchLight(dt){
  if(!PL._torchLight)return;
  _torchFlickerT+=dt*8;
  /* 밤 체크 (gameTime 19~5) */
  var isNight=(typeof gameTime!=='undefined')&&(gameTime>=19||gameTime<5);
  var targetI=isNight?PL._torchIntensity:0;
  /* 부드럽게 전환 */
  PL._torchLight.intensity+=(targetI-PL._torchLight.intensity)*0.1;
  /* 불꽃 깜빡임 */
  if(isNight&&PL._torchMesh){
    var flicker=0.85+Math.sin(_torchFlickerT)*0.1+Math.sin(_torchFlickerT*2.3)*0.05;
    PL._torchLight.intensity=targetI*flicker;
  }
  /* 불꽃 메쉬 표시/숨김 */
  if(PL._torchMesh){
    PL._torchMesh.visible=true;/* 항상 보이되 빛만 밤에 */
  }
}

function tickCapeAnim(dt){
  if(!PL.capeMesh)return;
  _capeSwayT+=dt*2.2;
  var sway=Math.sin(_capeSwayT)*0.04;
  PL.capeMesh.rotation.x=sway;
  PL.capeMesh.rotation.z=Math.sin(_capeSwayT*0.7)*0.015;
}
