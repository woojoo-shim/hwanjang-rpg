/* ════════════ 낮/밤 사이클 시스템 ════════════ */
/* 의존: world.js (scene, _skyUniforms, window._sun, window._sunSprite, window._skyMesh)
         ui.js (addChat)
         monster.js (monsters)
   선언: gameTime, gamePhase, tickDayNight, getGameHour, getGamePhase, isNight */

/* ── 게임 시간 ──
   1 실제 분 = 1 게임 시간
   24분 실시간 = 1 게임일 (0~24 시간)
*/
var gameTime=10.0;          /* 게임 시간 (0.0 ~ 24.0), 기본 낮 10시 */
var gamePhase='day';        /* 현재 페이즈 */
var _lastPhase='day';       /* 이전 페이즈 — 전환 메시지용 */
var _nightBuffApplied=false;/* 야간 버프 적용 여부 */

/* ── 달 메시 참조 (world.js에서 생성된 달) ── */
var _moonMeshRef=null;
var _starPointsRef=null;

/* ── 야간 전용 몬스터 스폰 여부 ── */
var _nightMonstersSpawned=false;

/* ── 상수 ── */
var GAME_SPEED=24/(10*60); /* 10분 실시간 = 1 게임일 (24시간) → 1초=0.04시간 */

/* ─── 페이즈 색상 정의 ─── */
var PHASE_DATA={
  dawn:{
    /* 새벽 5~7 */
    skyTop:0x0a0a2a,      /* 어두운 남색 */
    skyHorizon:0xff8844,  /* 주황-분홍 */
    fogColor:0x553322,    /* 짙은 안개 */
    fogDensity:0.003,
    ambientIntensity:0.12,
    sunColor:0xff7733,
    sunIntensity:0.3,
    hemiSkyColor:0x334466,
    hemiGroundColor:0x221100,
    bgColor:0x0a0a1a,
  },
  morning:{
    /* 아침 7~10 */
    skyTop:0x3399cc,
    skyHorizon:0xffcc88,
    fogColor:0x88bbcc,
    fogDensity:0.0018,
    ambientIntensity:0.22,
    sunColor:0xffd0a0,
    sunIntensity:0.7,
    hemiSkyColor:0x77aacc,
    hemiGroundColor:0x3a5a1a,
    bgColor:0x88ccee,
  },
  day:{
    /* 낮 10~17 */
    skyTop:0x3a8fd8,
    skyHorizon:0xa8d8ea,
    fogColor:0xa8d8ea,
    fogDensity:0.0015,
    ambientIntensity:0.25,
    sunColor:0xfff0d0,
    sunIntensity:0.9,
    hemiSkyColor:0x87ceeb,
    hemiGroundColor:0x3a5a1a,
    bgColor:0x87ceeb,
  },
  evening:{
    /* 저녁 17~19 */
    skyTop:0x331155,
    skyHorizon:0xff6622,
    fogColor:0x885533,
    fogDensity:0.002,
    ambientIntensity:0.18,
    sunColor:0xff8833,
    sunIntensity:0.5,
    hemiSkyColor:0x554422,
    hemiGroundColor:0x221100,
    bgColor:0x331133,
  },
  night:{
    /* 밤 19~5 */
    skyTop:0x020308,
    skyHorizon:0x05070f,
    fogColor:0x030510,
    fogDensity:0.0025,
    ambientIntensity:0.04,
    sunColor:0x1a2a4a,
    sunIntensity:0.05,
    hemiSkyColor:0x0a0a22,
    hemiGroundColor:0x050505,
    bgColor:0x010205,
  }
};

/* ─── 헬퍼: 게임 시간 → 페이즈 ─── */
function getGamePhase(){
  var h=gameTime;
  if(h>=5&&h<7)return'dawn';
  if(h>=7&&h<10)return'morning';
  if(h>=10&&h<17)return'day';
  if(h>=17&&h<19)return'evening';
  return'night';
}

function getGameHour(){return gameTime;}

function isNight(){
  var h=gameTime;
  return h>=19||h<5;
}

/* ─── lerp 헬퍼 ─── */
function _lerpN(a,b,t){return a+(b-a)*t;}
function _lerpColor(ca,cb,t){
  var ar=(ca>>16)&0xff,ag=(ca>>8)&0xff,ab=ca&0xff;
  var br=(cb>>16)&0xff,bg=(cb>>8)&0xff,bb=cb&0xff;
  var r=Math.round(_lerpN(ar,br,t));
  var g=Math.round(_lerpN(ag,bg,t));
  var b=Math.round(_lerpN(ab,bb,t));
  return(r<<16)|(g<<8)|b;
}

/* ─── 전환 진행도 (0~1) ─── */
function _getPhaseBlend(){
  var h=gameTime;
  /* 새벽 5~7 */
  if(h>=5&&h<7)return(h-5)/2;
  /* 아침 7~10 */
  if(h>=7&&h<10)return(h-7)/3;
  /* 낮 10~17 */
  if(h>=10&&h<17)return(h-10)/7;
  /* 저녁 17~19 */
  if(h>=17&&h<19)return(h-17)/2;
  /* 밤 19~5: 전체를 밤으로 */
  return 1;
}

/* 이전/다음 페이즈 데이터 쌍 반환 */
function _getPhasePair(){
  var h=gameTime;
  if(h>=5&&h<7)return[PHASE_DATA.night,PHASE_DATA.dawn];
  if(h>=7&&h<10)return[PHASE_DATA.dawn,PHASE_DATA.morning];
  if(h>=10&&h<17)return[PHASE_DATA.morning,PHASE_DATA.day];
  if(h>=17&&h<19)return[PHASE_DATA.day,PHASE_DATA.evening];
  return[PHASE_DATA.evening,PHASE_DATA.night];
}

/* ─── 조명 오브젝트 참조 저장 ─── */
var _dnAmbientLight=null;
var _dnHemiLight=null;
var _dnSunLight=null;

/* initScene 이후에 호출 — 라이트 참조 수집 */
function _dnCacheLights(){
  if(!scene)return;
  scene.traverse(function(obj){
    if(obj.isAmbientLight&&!_dnAmbientLight)_dnAmbientLight=obj;
    if(obj.isHemisphereLight&&!_dnHemiLight)_dnHemiLight=obj;
    if(obj.isDirectionalLight&&!_dnSunLight)_dnSunLight=obj;
  });
  /* 달/별 참조 — world.js에서 window.*로 노출됨 */
  if(!_moonMeshRef&&window._moonMesh)_moonMeshRef=window._moonMesh;
  if(!_starPointsRef&&window._starPoints)_starPointsRef=window._starPoints;
}

/* ─── 야간 전용 몬스터 2종 스폰 ─── */
var NIGHT_MONSTER_DEFS=[
  {id:'shadow_wolf',name:'그림자 늑대',lv:12,hp:400,atk:65,exp:180,spd:6.5,aggro:30,color:0x080810,hc:0x6644ff,
   drops:[{id:'shadow_cape',rate:.08,qty:1},{id:'moonblade',rate:.03,qty:1},{id:'star_fragment',rate:.4,qty:1}]},
  {id:'night_wraith',name:'밤의 유령',lv:18,hp:600,atk:90,exp:280,spd:5.0,aggro:35,color:0x0a0518,hc:0xcc44ff,
   drops:[{id:'shadow_dagger',rate:.05,qty:1},{id:'mystic_robe',rate:.04,qty:1},{id:'elixir',rate:.3,qty:1}]},
];

function _spawnNightMonsters(){
  if(_nightMonstersSpawned)return;
  _nightMonstersSpawned=true;
  if(typeof spawnMonster==='undefined'||typeof scene==='undefined')return;
  /* 초원 부근과 어두운 숲 부근에 야간 몬스터 스폰 */
  var positions=[
    {x:100,z:80},{x:-80,z:120},{x:150,z:-50},{x:-120,z:60},
    {x:200,z:100},{x:-200,z:80},{x:80,z:200},{x:-60,z:-80},
  ];
  for(var pi=0;pi<positions.length;pi++){
    var def=NIGHT_MONSTER_DEFS[pi%2];
    spawnMonster(def,positions[pi].x,positions[pi].z,scene);
  }
  addChat('sys','[시스템]','🌙 어둠 속에서 밤의 생물들이 깨어납니다...');
}

function _removeNightMonsters(){
  _nightMonstersSpawned=false;
  if(typeof monsters==='undefined')return;
  for(var mi=monsters.length-1;mi>=0;mi--){
    var m=monsters[mi];
    if(m.def&&(m.def.id==='shadow_wolf'||m.def.id==='night_wraith')){
      if(m.mesh&&typeof scene!=='undefined')scene.remove(m.mesh);
      monsters.splice(mi,1);
    }
  }
}

/* ─── 태양/달 위치 업데이트 ─── */
function _updateCelestials(){
  var h=gameTime;
  /* 태양: 5시(동쪽 낮은 곳) ~ 12시(정상) ~ 19시(서쪽 지평선) */
  /* 태양 각도: 시간 0~24를 -π~π 에 매핑, 낮에 하늘 위로 */
  var sunAngle=((h-12)/24)*Math.PI*2; /* -π~π */
  var sunR=500;
  var sunX=sunR*Math.sin(sunAngle);
  var sunY=sunR*Math.cos(sunAngle);   /* 낮(각=0): 위, 밤: 아래 */
  /* 태양 스프라이트 */
  if(window._sunSprite){
    var sv=sunY>-50;/* 지평선 위에 있을 때만 보임 */
    window._sunSprite.visible=sv;
    if(sv){
      window._sunSprite.position.set(sunX*0.6,Math.max(20,sunY*0.6),-sunR*0.4);
    }
  }
  /* DirectionalLight (그림자 태양) 위치 */
  if(window._sun&&PL&&PL.group){
    var px=PL.group.position.x,pz=PL.group.position.z;
    if(isNight()){
      /* 밤: 달빛 방향 */
      window._sun.position.set(px+60,120,pz-80);
    }else{
      /* 낮: 태양 방향 (동→서) */
      window._sun.position.set(px+sunX*0.2,120,pz-80);
    }
    window._sun.target.position.set(px,0,pz);
    window._sun.target.updateMatrixWorld();
  }
  /* 달: 밤에만 보임, 태양 반대 위치 */
  if(_moonMeshRef){
    var moonAngle=sunAngle+Math.PI;
    var moonX=400*Math.sin(moonAngle);
    var moonY=400*Math.cos(moonAngle);
    _moonMeshRef.position.set(moonX*0.8,Math.max(30,moonY*0.6),-350);
    _moonMeshRef.visible=isNight()||(moonY>0);
    /* 달 글로우 — 밤에 더 크게 */
    var nightFactor=isNight()?1.3:0.6;
    _moonMeshRef.scale.setScalar(nightFactor);
  }
  /* 별: 밤에 잘 보임 */
  if(_starPointsRef){
    var starAlpha=isNight()?1.0:(h>=5&&h<8?Math.max(0,(8-h)/3):0);
    _starPointsRef.material.opacity=starAlpha;
    _starPointsRef.material.transparent=true;
  }
}

/* ─── 야간 버프 적용 ─── */
function _applyNightBuff(){
  if(_nightBuffApplied)return;
  _nightBuffApplied=true;
  addChat('sys','[시스템]','🌑 밤이 되었습니다. 몬스터가 강해집니다!');
  _spawnNightMonsters();
}

function _removeNightBuff(){
  if(!_nightBuffApplied)return;
  _nightBuffApplied=false;
  addChat('sys','[시스템]','☀️ 새벽이 밝았습니다. 몬스터가 약해집니다.');
  _removeNightMonsters();
}

/* ─── HUD 시계 업데이트 ─── */
function _updateGameClock(){
  var h=Math.floor(gameTime);
  var m=Math.floor((gameTime-h)*60);
  var htEl=document.getElementById('htime');
  if(htEl){
    var hStr=String(h).padStart(2,'0');
    var mStr=String(m).padStart(2,'0');
    var phaseEmoji='';
    var ph=getGamePhase();
    if(ph==='dawn')phaseEmoji='🌅';
    else if(ph==='morning')phaseEmoji='🌤️';
    else if(ph==='day')phaseEmoji='☀️';
    else if(ph==='evening')phaseEmoji='🌆';
    else phaseEmoji='🌙';
    htEl.textContent=phaseEmoji+' '+hStr+':'+mStr;
  }
}

/* ─── 메인 틱 함수 ─── */
var _dnFrame=0;
function tickDayNight(dt){
  /* 건물 내부면 시각 업데이트 스킵 */
  if(typeof insideBuilding!=='undefined'&&insideBuilding)return;

  /* 시간 진행 */
  gameTime+=dt*GAME_SPEED; /* dt초 * (24시간/600초) = 10분에 하루 */
  if(gameTime>=24)gameTime-=24;

  gamePhase=getGamePhase();

  /* 페이즈 전환 감지 */
  if(gamePhase!==_lastPhase){
    _lastPhase=gamePhase;
    /* 밤 전환 메시지 */
    if(gamePhase==='night')_applyNightBuff();
    if(gamePhase==='dawn')_removeNightBuff();
  }

  /* 라이트 참조가 없으면 수집 */
  if(!_dnAmbientLight&&typeof scene!=='undefined'&&scene){
    _dnCacheLights();
  }

  /* 매 60프레임마다 시각 업데이트 (번쩍거림 방지) */
  _dnFrame++;
  if(_dnFrame%60!==0)return;

  var pair=_getPhasePair();
  var t=_getPhaseBlend();
  var A=pair[0],B=pair[1];

  /* 스카이 유니폼 */
  if(typeof _skyUniforms!=='undefined'&&_skyUniforms){
    var topC=_lerpColor(A.skyTop,B.skyTop,t);
    var horC=_lerpColor(A.skyHorizon,B.skyHorizon,t);
    _skyUniforms.topColor.value.setHex(topC);
    _skyUniforms.horizonColor.value.setHex(horC);
  }

  /* 씬 배경색 */
  if(typeof scene!=='undefined'&&scene&&scene.background){
    var bgC=_lerpColor(A.bgColor,B.bgColor,t);
    scene.background.setHex(bgC);
  }

  /* 안개 */
  if(typeof scene!=='undefined'&&scene&&scene.fog){
    var fogC=_lerpColor(A.fogColor,B.fogColor,t);
    var fogD=_lerpN(A.fogDensity,B.fogDensity,t);
    scene.fog.color.setHex(fogC);
    scene.fog.density=fogD;
  }

  /* 앰비언트 라이트 */
  if(_dnAmbientLight){
    _dnAmbientLight.intensity=_lerpN(A.ambientIntensity,B.ambientIntensity,t);
  }

  /* 헤미스피어 라이트 */
  if(_dnHemiLight){
    var hSkyC=_lerpColor(A.hemiSkyColor,B.hemiSkyColor,t);
    var hGndC=_lerpColor(A.hemiGroundColor,B.hemiGroundColor,t);
    _dnHemiLight.color.setHex(hSkyC);
    _dnHemiLight.groundColor.setHex(hGndC);
    _dnHemiLight.intensity=_lerpN(A.ambientIntensity*1.6,B.ambientIntensity*1.6,t);
  }

  /* 태양(방향광) */
  if(_dnSunLight){
    var sunC=_lerpColor(A.sunColor,B.sunColor,t);
    _dnSunLight.color.setHex(sunC);
    _dnSunLight.intensity=_lerpN(A.sunIntensity,B.sunIntensity,t);
  }

  /* 태양/달 위치 */
  _updateCelestials();

  /* HUD 시계 */
  _updateGameClock();
}

/* ─── 야간 버프: 몬스터 ATK 보정값 반환 ─── */
/* monster.js에서 참조: getDamageMultiplier() */
function getNightMonsterAtkMul(){
  if(!isNight())return 1.0;
  return 1.2; /* +20% ATK */
}

function getNightMonsterSpdMul(){
  if(!isNight())return 1.0;
  return 1.1; /* +10% speed */
}

/* ─── NPC 수면 체크 ─── */
/* talk()에서 호출되어 수면 중인 NPC인지 반환 */
var SLEEPING_NPCS=[
  '(이장) 박건호',
  '(대장장이) 발두르',
  '(상인) 크로스핑거',
  '(방어구상인) 게딩',
  '(무기상인) 달리우스',
];

/* 밤 22시 ~ 아침 6시 수면 */
function isNpcSleeping(npcName){
  /* 수면 NPC 목록에 없으면 false */
  var found=false;
  for(var i=0;i<SLEEPING_NPCS.length;i++){
    if(SLEEPING_NPCS[i]===npcName){found=true;break;}
  }
  if(!found)return false;
  var h=gameTime;
  return h>=22||h<6;
}

/* ─── 야간 전용 NPC: ??? 수수께끼 상인 ─── */
/* world.js buildVillage 이후에 호출되어 NPC 등록 */
var _nightNpcSpawned=false;
var NIGHT_NPC_NAME='(??? 신비상인) 세레나';

function _initNightNpc(){
  if(_nightNpcSpawned)return;
  if(typeof scene==='undefined'||typeof npcs==='undefined')return;
  _nightNpcSpawned=true;
  /* NPC AI 등록 */
  if(typeof NPC_AI!=='undefined'&&!NPC_AI[NIGHT_NPC_NAME]){
    NPC_AI[NIGHT_NPC_NAME]={
      system:'너는 "'+NIGHT_NPC_NAME+'"이다. 밤에만 나타나는 신비로운 상인이다. 어두운 아이템과 금지된 마법에 대한 지식을 가지고 있다. 말이 적고 수수께끼 같은 말투를 사용한다. 가끔 낮에는 사라진다는 자신의 비밀을 암시한다.',
      history:[]
    };
  }
  /* SHOP_CATEGORIES + SHOP_STOCK 등록 */
  if(typeof SHOP_CATEGORIES!=='undefined'&&!SHOP_CATEGORIES[NIGHT_NPC_NAME]){
    SHOP_CATEGORIES[NIGHT_NPC_NAME]={
      pool:['moonblade','shadow_dagger','shadow_armor','shadow_cape','dye_midnight','mystic_robe','assassin_dagger','nidhogg_fang','star_cape','blood_cape','ghost_cape'],
      slots:6
    };
  }
  if(typeof SHOP_STOCK!=='undefined'&&!SHOP_STOCK[NIGHT_NPC_NAME]){
    if(typeof rollShopStock==='function')rollShopStock(NIGHT_NPC_NAME);
  }
  /* NPC 메시 생성 — 마을 광장 분수 뒤 */
  var VX=-350,VZ=-380;
  var g=new THREE.Group();
  /* 몸 (어두운 보라색) */
  var body=new THREE.Mesh(
    new THREE.BoxGeometry(.8,1.2,.5),
    new THREE.MeshLambertMaterial({color:0x220044,emissive:new THREE.Color(0x110022),emissiveIntensity:.5})
  );
  body.position.y=.6;g.add(body);
  /* 머리 */
  var head=new THREE.Mesh(
    new THREE.BoxGeometry(.6,.6,.6),
    new THREE.MeshLambertMaterial({color:0xddeeff})
  );
  head.position.y=1.5;g.add(head);
  /* 망토 효과 */
  var cloak=new THREE.Mesh(
    new THREE.BoxGeometry(.9,1.4,.2),
    new THREE.MeshLambertMaterial({color:0x0a0020,transparent:true,opacity:.85})
  );
  cloak.position.set(0,.5,-.28);g.add(cloak);
  /* 마법진 글로우 (바닥) */
  var glowM=new THREE.MeshBasicMaterial({color:0x6600ff,transparent:true,opacity:.3,side:THREE.DoubleSide});
  var glow=new THREE.Mesh(new THREE.CircleGeometry(1.2,16),glowM);
  glow.rotation.x=-Math.PI/2;glow.position.y=0.02;g.add(glow);
  /* 보라 포인트라이트 */
  var pl=new THREE.PointLight(0x8800ff,.6,6);
  pl.position.set(0,1.2,0);g.add(pl);

  g.position.set(VX-10,0,VZ+22);
  scene.add(g);
  window._nightNpcMesh=g;
  window._nightNpcLight=pl;

  /* 이름표 */
  var lov=document.getElementById('lov')||document.getElementById('cc');
  var label=document.createElement('div');
  label.className='nlabel';
  label.textContent=NIGHT_NPC_NAME;
  label.style.color='#cc44ff';
  label.style.fontSize='11px';
  label.style.display='none';
  lov.appendChild(label);
  var ie=document.createElement('div');
  ie.className='linteract';ie.textContent='E 대화';ie.style.display='none';
  lov.appendChild(ie);
  var npcObj={mesh:g,name:NIGHT_NPC_NAME,label:label,interact:ie,bobOff:Math.random()*6,nightOnly:true,nightMerchant:true};
  npcs.push(npcObj);
  window._nightNpcObj=npcObj;
}

/* ─── 야간 NPC 가시성 업데이트 ─── */
function _updateNightNpcVisibility(){
  if(!window._nightNpcMesh)return;
  var visible=isNight();
  window._nightNpcMesh.visible=visible;
  if(window._nightNpcObj){
    window._nightNpcObj.disabled=!visible;
  }
}

/* ─── 초기화: initScene 이후 호출 ─── */
function initDayNight(){
  _dnCacheLights();
  _initNightNpc();
  /* 초기 상태 즉시 반영 */
  tickDayNight(0);
}
