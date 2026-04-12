/* ════════════ 보스 레이드 시스템 ════════════ */
/* 의존: world.js (scene, fadeOverlay, npcs), player.js (PL, playerLevel, playerHP),
         ui.js (addChat), inventory.js (gold), monster.js (monsters)
   선언: RAID_BOSSES, currentRaid, buildRaidNPCs, showRaidConfirm, enterRaid, exitRaid,
         tickRaidBoss, checkRaidProgress */

/* ── 레이드 보스 정의 ── */
var RAID_BOSSES=[
  {
    id:'raid_karnas',
    name:'고대 드래곤 카르나스',
    zone:'volcano',
    minLevel:25,
    hp:15000,
    atk:120,
    rewardGold:8000,
    rewardExp:15000,
    rewardItems:['eclipse_blade','dragon_scale'],
    color:0xcc2200,
    headColor:0xff4400,
    scale:3.5,
    desc:'화산 지대에 잠든 고대의 드래곤. 숨결만으로 용암이 끓어오른다.',
    npcPos:{x:370,z:480},
    npcName:'(레이드지기) 화염의 수호자',
    npcColor:0x882200,
    npcHeadColor:0xcc8866,
    arenaIdx:0,
    attacks:['fireBreath','groundSlam','lavaPool'],
    enragedAtks:['fireBreath','fireBreath','groundSlam','lavaPool']
  },
  {
    id:'raid_arachne',
    name:'거미 여왕 아라크네',
    zone:'darkforest',
    minLevel:15,
    hp:8000,
    atk:70,
    rewardGold:4000,
    rewardExp:8000,
    rewardItems:['shadow_dagger','mystic_robe'],
    color:0x220033,
    headColor:0x440066,
    scale:3.2,
    desc:'어두운 숲 깊숙이 둥지를 튼 거미 여왕. 독실이 세상을 뒤덮을 것이다.',
    npcPos:{x:-280,z:370},
    npcName:'(레이드지기) 숲의 경비원',
    npcColor:0x224400,
    npcHeadColor:0xbbcc99,
    arenaIdx:1,
    attacks:['webShot','poisonCloud','summonSpiderlings'],
    enragedAtks:['webShot','webShot','poisonCloud','summonSpiderlings']
  },
  {
    id:'raid_morgas',
    name:'언데드 왕 모르가스',
    zone:'swamp',
    minLevel:20,
    hp:12000,
    atk:95,
    rewardGold:6000,
    rewardExp:12000,
    rewardItems:['soul_reaper','void_robe'],
    color:0x334422,
    headColor:0x889966,
    scale:3.8,
    desc:'늪 아래에서 깨어난 언데드 왕. 저주로 생명의 기운을 빨아들인다.',
    npcPos:{x:-420,z:120},
    npcName:'(레이드지기) 늪의 정령',
    npcColor:0x334422,
    npcHeadColor:0xaabbaa,
    arenaIdx:2,
    attacks:['curse','deathWave','summonSkeletons'],
    enragedAtks:['curse','deathWave','deathWave','summonSkeletons']
  },
  {
    id:'raid_yugdra',
    name:'정글 수호자 유그드라',
    zone:'jungle',
    minLevel:18,
    hp:10000,
    atk:80,
    rewardGold:5000,
    rewardExp:10000,
    rewardItems:['world_tree_staff','hermes_boots'],
    color:0x226600,
    headColor:0x44bb22,
    scale:4.0,
    desc:'정글의 심장부에서 수천 년을 살아온 수호 정령. 자연의 힘으로 침입자를 짓밟는다.',
    npcPos:{x:420,z:120},
    npcName:'(레이드지기) 정글 사냥꾼',
    npcColor:0x335511,
    npcHeadColor:0xbbdd99,
    arenaIdx:3,
    attacks:['vineGrab','natureBurst','selfHeal'],
    enragedAtks:['vineGrab','vineGrab','natureBurst','natureBurst','selfHeal']
  }
];

/* ── 레이드 상태 ── */
var currentRaid=null;
/* { def, bossObj, phase:'normal'|'enraged', atkTimer, nextAtkIdx, arenaMeshes[],
     addsAlive[], savedPos, rootTimer, slowTimer, curseTimer, defeated } */

/* 레이드 쿨다운 (보스 id → timestamp) */
var _raidCooldowns={};
var RAID_COOLDOWN_MS=30*60*1000; /* 30분 */

/* 레이드 아레나 Y 오프셋 기반 위치 */
var _raidBaseY=-800;
/* 각 레이드는 _raidBaseY - arenaIdx*60 에 생성 */

/* ── 레이드 NPC 스폰 ── */
function buildRaidNPCs(){
  if(typeof scene==='undefined'||!scene)return;
  for(var i=0;i<RAID_BOSSES.length;i++){
    var rd=RAID_BOSSES[i];
    _spawnRaidNpc(rd);
  }
}

function _spawnRaidNpc(rd){
  var rx=rd.npcPos.x, rz=rd.npcPos.z;
  var ry=(typeof getTerrainY==='function')?getTerrainY(rx,rz):0;

  /* NPC 메시 */
  var npcMesh;
  if(typeof mkHuman==='function'){
    var h=mkHuman(rd.npcColor,rd.npcHeadColor);
    npcMesh=h.group;
  }else{
    npcMesh=new THREE.Mesh(
      new THREE.BoxGeometry(.6,1.6,.4),
      new THREE.MeshLambertMaterial({color:rd.npcColor})
    );
  }
  npcMesh.position.set(rx,ry,rz);
  npcMesh.rotation.y=Math.PI;
  scene.add(npcMesh);

  /* 이름 라벨 */
  var lov=document.getElementById('lov');
  var nameEl=document.createElement('div');
  nameEl.className='nlabel npc';
  nameEl.style.cssText='background:#0a001aee;border:1px solid #aa44ff;color:#cc88ff;padding:2px 6px;font-size:11px;';
  nameEl.textContent=rd.npcName;
  lov.appendChild(nameEl);

  var intEl=document.createElement('div');
  intEl.className='linteract';
  intEl.textContent='E 대화';
  intEl.style.display='none';
  lov.appendChild(intEl);

  var npcObj={
    name:rd.npcName,
    mesh:npcMesh,
    nameEl:nameEl,
    intEl:intEl,
    raidId:rd.id,
    bobOff:Math.random()*5,
    px:rx, pz:rz
  };
  npcs.push(npcObj);

  /* 레이드 표시 — NPC 이름에 포함 (별도 라벨 없음) */
}

/* ── 레이드 확인 모달 ── */
function showRaidConfirm(npc){
  var rdId=npc.raidId;
  var rd=null;
  for(var i=0;i<RAID_BOSSES.length;i++){if(RAID_BOSSES[i].id===rdId){rd=RAID_BOSSES[i];break;}}
  if(!rd)return;

  /* 레벨 체크 */
  if(playerLevel<rd.minLevel){
    addChat('npc',npc.name,'아직 준비가 안 됐어. 레벨 '+rd.minLevel+' 이상이 되면 다시 와.');
    return;
  }

  /* 쿨다운 체크 */
  var now=Date.now();
  if(_raidCooldowns[rd.id]&&(now-_raidCooldowns[rd.id])<RAID_COOLDOWN_MS){
    var remain=Math.ceil((RAID_COOLDOWN_MS-(now-_raidCooldowns[rd.id]))/60000);
    addChat('npc',npc.name,'이 레이드는 아직 초기화되지 않았어. '+remain+'분 후에 다시 도전할 수 있어.');
    return;
  }

  var rewardItemNames=rd.rewardItems.map(function(iid){
    if(typeof getItemDef==='function'){var df=getItemDef(iid);return df?df.name:iid;}
    return iid;
  }).join(', ');

  var modal=document.createElement('div');
  modal.id='raid-confirm';
  modal.style.cssText='position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:340px;background:#08001aee;border:2px solid #aa44ff88;border-radius:12px;padding:22px;z-index:9999;color:#e8d8ff;text-align:center;font-family:inherit;';

  modal.innerHTML=
    '<div style="color:#cc88ff;font-size:19px;font-weight:bold;margin-bottom:6px;">★ '+rd.name+'</div>'+
    '<div style="color:#aaa;font-size:12px;margin-bottom:14px;">권장 레벨: Lv.'+rd.minLevel+'+</div>'+
    '<div style="background:#120022;padding:12px;border-radius:8px;margin-bottom:14px;text-align:left;font-size:12px;line-height:1.7;">'+
      '<div style="color:#ffaa44;margin-bottom:4px;">'+rd.desc+'</div>'+
      '<div>❤ 체력: <span style="color:#ff6666;">'+rd.hp.toLocaleString()+'</span></div>'+
      '<div>💰 보상: <span style="color:#ffd700;">'+rd.rewardGold.toLocaleString()+' 골드</span></div>'+
      '<div>⭐ 경험치: <span style="color:#88ddff;">'+rd.rewardExp.toLocaleString()+' EXP</span></div>'+
      '<div>🎁 드롭 가능: <span style="color:#cc88ff;">'+rewardItemNames+'</span></div>'+
    '</div>'+
    '<div style="color:#ff8888;font-size:11px;margin-bottom:14px;">⚠ 쿨다운: 30분 | 보스 처치 시 귀환</div>'+
    '<div style="display:flex;gap:8px;">'+
      '<button id="rd-enter-btn" style="flex:1;background:#8833cc;color:#fff;border:none;padding:12px;font-size:14px;font-weight:bold;cursor:pointer;font-family:inherit;border-radius:6px;">입장하기</button>'+
      '<button id="rd-cancel-btn" style="flex:1;background:#333;color:#aaa;border:1px solid #555;padding:12px;font-size:13px;cursor:pointer;font-family:inherit;border-radius:6px;">취소</button>'+
    '</div>';

  document.body.appendChild(modal);

  document.getElementById('rd-enter-btn').onclick=function(){
    modal.remove();
    enterRaid(rd);
  };
  document.getElementById('rd-cancel-btn').onclick=function(){
    modal.remove();
    addChat('npc',npc.name,'언제든 마음이 바뀌면 다시 와.');
  };
}

/* ── 레이드 입장 ── */
function enterRaid(rd){
  if(!rd)return;
  if(playerLevel<rd.minLevel){
    addChat('sys','[시스템]','레벨 '+rd.minLevel+' 이상이어야 입장 가능합니다.');
    return;
  }
  if(typeof SFX!=='undefined')SFX.doorEnter();

  var arenaY=_raidBaseY-rd.arenaIdx*60;

  currentRaid={
    def:rd,
    bossObj:null,
    phase:'normal',
    atkTimer:3.0,
    nextAtkIdx:0,
    arenaMeshes:[],
    addsAlive:[],
    savedPos:{x:PL.group.position.x,z:PL.group.position.z},
    rootTimer:0,
    slowTimer:0,
    curseTimer:0,
    defeated:false,
    arenaY:arenaY
  };

  addChat('sys','[레이드]','★ '+rd.name+' 레이드 입장!');
  fadeOverlay.style.opacity='1';

  setTimeout(function(){
    _buildRaidArena(rd,arenaY);
    _spawnRaidBoss(rd,arenaY);
    PL.group.position.set(0,arenaY+1,18);
    camera.position.set(0,arenaY+20,25);
    camera.lookAt(0,arenaY+2,0);
    scene.fog=null;
    renderer.setClearColor(0x050008);
    setTimeout(function(){fadeOverlay.style.opacity='0';},300);
  },700);
}

/* ── 아레나 빌드 ── */
function _buildRaidArena(rd,by){
  var R=25;/* 아레나 반지름 */
  var H=14;
  var meshes=currentRaid.arenaMeshes;

  /* 바닥 — 원형 */
  var floorColor=(rd.id==='raid_karnas')?0x3a1000:
                 (rd.id==='raid_arachne')?0x0a0014:
                 (rd.id==='raid_morgas')?0x0a120a:0x0a1400;
  var floor=new THREE.Mesh(
    new THREE.CircleGeometry(R,32),
    new THREE.MeshLambertMaterial({color:floorColor})
  );
  floor.rotation.x=-Math.PI/2;
  floor.position.set(0,by,0);
  scene.add(floor);meshes.push(floor);

  /* 외벽 (원통) */
  var wallColor=(rd.id==='raid_karnas')?0x220800:
                (rd.id==='raid_arachne')?0x06000e:
                (rd.id==='raid_morgas')?0x060a04:0x060800;
  var wall=new THREE.Mesh(
    new THREE.CylinderGeometry(R,R,H,32,1,true),
    new THREE.MeshLambertMaterial({color:wallColor,side:THREE.BackSide})
  );
  wall.position.set(0,by+H/2,0);
  scene.add(wall);meshes.push(wall);

  /* 천장 */
  var ceil=new THREE.Mesh(
    new THREE.CircleGeometry(R,32),
    new THREE.MeshLambertMaterial({color:0x050505})
  );
  ceil.rotation.x=Math.PI/2;
  ceil.position.set(0,by+H,0);
  scene.add(ceil);meshes.push(ceil);

  /* 횃불 4개 */
  var torchColor=(rd.id==='raid_karnas')?0xff3300:
                 (rd.id==='raid_arachne')?0x8800ff:
                 (rd.id==='raid_morgas')?0x00ff44:0x44ff00;
  var torchAngles=[0,Math.PI/2,Math.PI,Math.PI*1.5];
  for(var ti=0;ti<4;ti++){
    var ta=torchAngles[ti];
    var tx=Math.sin(ta)*(R-2), tz=Math.cos(ta)*(R-2);
    var torchStick=new THREE.Mesh(
      new THREE.CylinderGeometry(.06,.06,1.5,5),
      new THREE.MeshLambertMaterial({color:0x8a4a1a})
    );
    torchStick.position.set(tx,by+4,tz);
    scene.add(torchStick);meshes.push(torchStick);
    var tLight=new THREE.PointLight(torchColor,.6,12);
    tLight.position.set(tx,by+5,tz);
    scene.add(tLight);meshes.push(tLight);
  }

  /* 주 조명 */
  var mainLight=new THREE.PointLight(torchColor,0.5,R*3);
  mainLight.position.set(0,by+H-1,0);
  scene.add(mainLight);meshes.push(mainLight);

  /* 진입 표시 (뒤쪽 빨간 카펫) */
  var entCarpet=new THREE.Mesh(
    new THREE.PlaneGeometry(3,4),
    new THREE.MeshLambertMaterial({color:0x660022})
  );
  entCarpet.rotation.x=-Math.PI/2;
  entCarpet.position.set(0,by+.01,R-2);
  scene.add(entCarpet);meshes.push(entCarpet);
}

/* ── 보스 3D 모델 빌드 ── */
function _buildBossMesh(rd){
  var g=new THREE.Group();
  var mainM=new THREE.MeshLambertMaterial({color:rd.color});
  var headM=new THREE.MeshLambertMaterial({color:rd.headColor});

  if(rd.id==='raid_karnas'){
    /* 드래곤: 원뿔 몸 + 박스 날개 + 실린더 목 + 구 머리 */
    var body=new THREE.Mesh(new THREE.ConeGeometry(1,.8,8).clone(),mainM);
    body.scale.set(1.2,1,1.8);
    body.rotation.x=Math.PI/2;
    body.position.set(0,1.2,0);
    g.add(body);

    var neck=new THREE.Mesh(new THREE.CylinderGeometry(.35,.5,.9,8),mainM);
    neck.position.set(0,2,0.8);
    neck.rotation.x=-0.4;
    g.add(neck);

    var head=new THREE.Mesh(new THREE.SphereGeometry(.55,8,8),headM);
    head.scale.set(1.3,.8,1.5);
    head.position.set(0,2.7,1.5);
    g.add(head);

    /* 날개 */
    var wingM=new THREE.MeshLambertMaterial({color:0x8b1000,side:THREE.DoubleSide});
    var wL=new THREE.Mesh(new THREE.BoxGeometry(2.2,.05,1.4),wingM);
    wL.position.set(-1.8,1.8,0);
    wL.rotation.z=0.5;
    g.add(wL);
    var wR=new THREE.Mesh(new THREE.BoxGeometry(2.2,.05,1.4),wingM);
    wR.position.set(1.8,1.8,0);
    wR.rotation.z=-0.5;
    g.add(wR);

    /* 꼬리 */
    var tail=new THREE.Mesh(new THREE.ConeGeometry(.25,.9,6),mainM);
    tail.position.set(0,.6,-1.4);
    tail.rotation.x=Math.PI/2+0.5;
    g.add(tail);

    /* 눈 빛 */
    var eyeM=new THREE.MeshBasicMaterial({color:0xffaa00});
    [-0.2,0.2].forEach(function(ex){
      var eye=new THREE.Mesh(new THREE.SphereGeometry(.1,6,6),eyeM);
      eye.position.set(ex,2.8,1.95);
      g.add(eye);
    });

  }else if(rd.id==='raid_arachne'){
    /* 거미: 구 몸 + 8 실린더 다리 */
    var body=new THREE.Mesh(new THREE.SphereGeometry(1.1,10,10),mainM);
    body.scale.set(1,0.8,1.3);
    body.position.set(0,1.1,0);
    g.add(body);

    var abdomen=new THREE.Mesh(new THREE.SphereGeometry(.8,8,8),new THREE.MeshLambertMaterial({color:0x3a0055}));
    abdomen.scale.set(1,.85,1.4);
    abdomen.position.set(0,1,-.9);
    g.add(abdomen);

    var eyeM2=new THREE.MeshBasicMaterial({color:0xff0066});
    for(var ei=0;ei<4;ei++){
      var ex2=(ei%2===0)?-.2:.2, ey2=1.6+(Math.floor(ei/2)*.2);
      var eye=new THREE.Mesh(new THREE.SphereGeometry(.09,5,5),eyeM2);
      eye.position.set(ex2,ey2,.9);
      g.add(eye);
    }

    /* 다리 8개 */
    var legM=new THREE.MeshLambertMaterial({color:0x110022});
    var legAngles=[-.6,-.3,.3,.6];
    [-1,1].forEach(function(side){
      legAngles.forEach(function(la,li){
        var leg=new THREE.Mesh(new THREE.CylinderGeometry(.06,.08,2.0,5),legM);
        leg.position.set(side*(1.2+li*.2),1.1-li*.1,-.3+li*.2);
        leg.rotation.z=side*(Math.PI/2-0.4+li*.15);
        leg.rotation.x=la;
        g.add(leg);
      });
    });

  }else if(rd.id==='raid_morgas'){
    /* 언데드 왕: 뼈대 박스 + 왕관 */
    var boneM=new THREE.MeshLambertMaterial({color:0xccddaa});
    var robM=new THREE.MeshLambertMaterial({color:0x222a14});

    /* 몸통 */
    var torso=new THREE.Mesh(new THREE.BoxGeometry(.7,1.1,.4),robM);
    torso.position.set(0,1.2,0);
    g.add(torso);

    /* 갈비뼈 */
    [-0.2,0,0.2].forEach(function(ry){
      var rib=new THREE.Mesh(new THREE.BoxGeometry(.6,.08,.06),boneM);
      rib.position.set(0,1.4+ry,0.2);
      g.add(rib);
    });

    /* 목 */
    var neck=new THREE.Mesh(new THREE.BoxGeometry(.18,.25,.18),boneM);
    neck.position.set(0,2,0);
    g.add(neck);

    /* 두개골 */
    var skull=new THREE.Mesh(new THREE.BoxGeometry(.5,.52,.46),boneM);
    skull.position.set(0,2.45,0);
    g.add(skull);

    /* 눈 소켓 */
    var eyeM3=new THREE.MeshBasicMaterial({color:0x00ff66});
    [-0.14,0.14].forEach(function(ex){
      var eye=new THREE.Mesh(new THREE.SphereGeometry(.09,6,6),eyeM3);
      eye.position.set(ex,2.5,.24);
      g.add(eye);
    });

    /* 왕관 */
    var crownM=new THREE.MeshLambertMaterial({color:0xcc9900});
    var crown=new THREE.Mesh(new THREE.CylinderGeometry(.32,.28,.25,8,1,true),crownM);
    crown.position.set(0,2.8,0);
    g.add(crown);
    [0,1,2,3].forEach(function(si){
      var sa=si*Math.PI/2;
      var spike=new THREE.Mesh(new THREE.ConeGeometry(.05,.2,4),crownM);
      spike.position.set(Math.sin(sa)*.3,3.1,Math.cos(sa)*.3);
      g.add(spike);
    });

    /* 팔 */
    var armM=boneM;
    [-0.45,0.45].forEach(function(ax){
      var arm=new THREE.Mesh(new THREE.BoxGeometry(.14,.8,.14),armM);
      arm.position.set(ax,1.3,0);
      arm.rotation.z=(ax<0?0.3:-0.3);
      g.add(arm);
      var forearm=new THREE.Mesh(new THREE.BoxGeometry(.12,.7,.12),armM);
      forearm.position.set(ax+(ax<0?-.12:.12),0.7,0);
      forearm.rotation.z=(ax<0?0.5:-0.5);
      g.add(forearm);
    });

    /* 다리 */
    [-0.2,0.2].forEach(function(lx){
      var leg=new THREE.Mesh(new THREE.BoxGeometry(.18,.7,.18),boneM);
      leg.position.set(lx,.45,0);
      g.add(leg);
      var shin=new THREE.Mesh(new THREE.BoxGeometry(.15,.6,.15),boneM);
      shin.position.set(lx,-.15,0);
      g.add(shin);
    });

  }else if(rd.id==='raid_yugdra'){
    /* 나무 정령: 실린더 몸통 + 구 수관 + 뿌리 다리 */
    var trunkM=new THREE.MeshLambertMaterial({color:0x3d1a00});
    var leafM=new THREE.MeshLambertMaterial({color:0x226600});
    var rootM=new THREE.MeshLambertMaterial({color:0x4a2800});

    /* 몸통 */
    var trunk=new THREE.Mesh(new THREE.CylinderGeometry(.6,.85,2.2,8),trunkM);
    trunk.position.set(0,1.2,0);
    g.add(trunk);

    /* 수관 */
    var canopy=new THREE.Mesh(new THREE.SphereGeometry(1.4,10,10),leafM);
    canopy.scale.set(1,.8,1);
    canopy.position.set(0,3.2,0);
    g.add(canopy);

    var canopy2=new THREE.Mesh(new THREE.SphereGeometry(.9,8,8),new THREE.MeshLambertMaterial({color:0x336600}));
    canopy2.position.set(.7,3.8,.5);
    g.add(canopy2);

    var canopy3=new THREE.Mesh(new THREE.SphereGeometry(.75,8,8),new THREE.MeshLambertMaterial({color:0x1a4400}));
    canopy3.position.set(-.5,3.6,-.4);
    g.add(canopy3);

    /* 눈 */
    var eyeM4=new THREE.MeshBasicMaterial({color:0xffee00});
    [-0.18,0.18].forEach(function(ex){
      var eye=new THREE.Mesh(new THREE.SphereGeometry(.1,6,6),eyeM4);
      eye.position.set(ex,1.9,.62);
      g.add(eye);
    });

    /* 뿌리 다리 4개 */
    var rootAngles=[0.3,1.2,2.0,3.0];
    rootAngles.forEach(function(ra){
      var rx2=Math.sin(ra)*1.0, rz2=Math.cos(ra)*1.0;
      var root=new THREE.Mesh(new THREE.CylinderGeometry(.1,.18,1.2,5),rootM);
      root.position.set(rx2,.2,rz2);
      root.rotation.z=Math.sin(ra)*0.5;
      root.rotation.x=Math.cos(ra)*0.5;
      g.add(root);
    });
  }

  return g;
}

/* ── 보스 스폰 ── */
function _spawnRaidBoss(rd,by){
  var mesh=_buildBossMesh(rd);
  mesh.scale.set(rd.scale,rd.scale,rd.scale);
  mesh.position.set(0,by+rd.scale*0.5,0);
  scene.add(mesh);
  currentRaid.arenaMeshes.push(mesh);

  /* HP 바 UI */
  var bossHpWrap=document.createElement('div');
  bossHpWrap.id='raid-boss-hp';
  bossHpWrap.style.cssText='position:fixed;top:80px;left:50%;transform:translateX(-50%);width:400px;max-width:90vw;z-index:50;pointer-events:none;';
  bossHpWrap.innerHTML=
    '<div style="color:#cc88ff;text-align:center;font-size:14px;font-weight:bold;margin-bottom:4px;text-shadow:0 0 8px #8800ff;">'+rd.name+'</div>'+
    '<div style="height:16px;background:#1a0030;border:2px solid #8844cc;border-radius:8px;overflow:hidden;">'+
      '<div id="raid-boss-hpfill" style="height:100%;width:100%;background:linear-gradient(90deg,#8833cc,#cc44ff);transition:width .2s;"></div>'+
    '</div>'+
    '<div id="raid-boss-hptext" style="color:#cc88ff;text-align:center;font-size:11px;margin-top:2px;">'+rd.hp+' / '+rd.hp+'</div>';
  document.body.appendChild(bossHpWrap);

  var bossObj={
    mesh:mesh,
    hp:rd.hp,
    maxHp:rd.hp,
    hpFill:document.getElementById('raid-boss-hpfill'),
    hpText:document.getElementById('raid-boss-hptext'),
    bobOff:Math.random()*Math.PI*2,
    hitFlash:0,
    deathAnim:-1,
    animTime:0
  };
  currentRaid.bossObj=bossObj;

  addChat('sys','[레이드]','⚠ '+rd.name+'이(가) 깨어났다!');
  if(typeof SFX!=='undefined'&&SFX.bossRoar)SFX.bossRoar();
}

/* ── 레이드 보스 AI 틱 ── */
function tickRaidBoss(dt){
  if(!currentRaid||currentRaid.defeated)return;
  var boss=currentRaid.bossObj;
  var rd=currentRaid.def;
  if(!boss||boss.hp<=0){
    if(!currentRaid.defeated)_onBossDefeated();
    return;
  }

  /* 보스 HP 바 업데이트 */
  var hpPct=Math.max(0,boss.hp/boss.maxHp*100);
  if(boss.hpFill)boss.hpFill.style.width=hpPct+'%';
  if(boss.hpText)boss.hpText.textContent=Math.max(0,boss.hp)+' / '+boss.maxHp;

  /* 격분 페이즈 전환 */
  if(currentRaid.phase==='normal'&&boss.hp/boss.maxHp<=0.5){
    currentRaid.phase='enraged';
    addChat('sys','[레이드]','⚠ '+rd.name+' 격분! 공격이 강화된다!');
    if(boss.mesh){
      /* 격분 시 빨간 빛 */
      boss.mesh.traverse(function(child){
        if(child.isMesh&&child.material&&child.material.emissive){
          child.material.emissive.setHex(0x550000);
          child.material.emissiveIntensity=0.4;
        }
      });
    }
  }

  /* 보스 보핑 애니메이션 */
  boss.animTime+=dt;
  var speed=currentRaid.phase==='enraged'?1.8:1.0;
  if(boss.mesh){
    var by=currentRaid.arenaY+rd.scale*0.5;
    boss.mesh.position.y=by+Math.sin(boss.animTime*speed)*0.15*rd.scale;
    boss.mesh.rotation.y+=dt*(currentRaid.phase==='enraged'?0.6:0.3);
  }

  /* 플레이어 자동 추격 방향 */
  if(boss.mesh&&PL&&PL.group){
    var bx=boss.mesh.position.x, bz=boss.mesh.position.z;
    var px=PL.group.position.x, pz=PL.group.position.z;
    var dx=px-bx, dz=pz-bz;
    var dist=Math.sqrt(dx*dx+dz*dz);

    /* 근접 공격 — 거리 6 이내 */
    var atkSpeed=currentRaid.phase==='enraged'?1.2:1.8;
    currentRaid.atkTimer-=dt;
    if(currentRaid.atkTimer<=0){
      currentRaid.atkTimer=atkSpeed+(Math.random()*0.5);
      _doBossAttack(dist);
    }

    /* 보스 플레이어 방향으로 천천히 이동 (근접) */
    var moveSpeed=currentRaid.phase==='enraged'?2.5:1.5;
    if(dist>4&&dist<20){
      boss.mesh.position.x+=dx/dist*moveSpeed*dt;
      boss.mesh.position.z+=dz/dist*moveSpeed*dt;
    }

    /* 근접 일격 */
    if(dist<rd.scale*1.2&&invincibleTimer<=0){
      var atkDmg=Math.floor(rd.atk*(currentRaid.phase==='enraged'?1.4:1.0)*0.5);
      _dealDmgToPlayer(atkDmg,'근접 공격');
    }
  }

  /* 루트 타이머 */
  if(currentRaid.rootTimer>0){
    currentRaid.rootTimer-=dt;
  }
  /* 슬로우 타이머 */
  if(currentRaid.slowTimer>0){
    currentRaid.slowTimer-=dt;
    if(typeof playerSlowed!=='undefined')playerSlowed=Math.max(playerSlowed,currentRaid.slowTimer);
  }
  /* 저주 타이머 */
  if(currentRaid.curseTimer>0){
    currentRaid.curseTimer-=dt;
  }

  /* 추가 몬스터(어드) 업데이트 */
  _tickRaidAdds(dt);
}

/* ── 보스 공격 실행 ── */
function _doBossAttack(dist){
  if(!currentRaid||!currentRaid.bossObj)return;
  var rd=currentRaid.def;
  var atks=currentRaid.phase==='enraged'?rd.enragedAtks:rd.attacks;
  var atkName=atks[currentRaid.nextAtkIdx%atks.length];
  currentRaid.nextAtkIdx++;

  var boss=currentRaid.bossObj;
  var bx=boss.mesh?boss.mesh.position.x:0;
  var bz=boss.mesh?boss.mesh.position.z:0;
  var px=PL.group.position.x, pz=PL.group.position.z;
  var dx=px-bx, dz=pz-bz;
  var dlen=Math.sqrt(dx*dx+dz*dz)||1;

  if(atkName==='fireBreath'){
    /* 화염 숨결: 코너 방향으로 화염 장판 */
    addChat('sys','[카르나스]','★ 화염 숨결!');
    if(typeof spawnFireBreath==='function'){
      spawnFireBreath(bx,bz,dx/dlen,dz/dlen,12);
    }
    var dmg=Math.floor(rd.atk*0.6*(currentRaid.phase==='enraged'?1.3:1));
    if(dist<12)_dealDmgToPlayer(dmg,'화염 숨결');

  }else if(atkName==='groundSlam'){
    /* 땅 강타: 큰 원형 AoE */
    addChat('sys','[카르나스]','★ 지면 강타!');
    if(typeof spawnLavaPool==='function'){
      spawnLavaPool(bx,bz,8,4);
    }
    var dmg2=Math.floor(rd.atk*0.8*(currentRaid.phase==='enraged'?1.4:1));
    if(dist<8)_dealDmgToPlayer(dmg2,'지면 강타');
    if(typeof screenShake==='function')screenShake(0.5,0.3);

  }else if(atkName==='lavaPool'){
    /* 용암 웅덩이 생성 */
    var lx=px+(Math.random()-.5)*6, lz=pz+(Math.random()-.5)*6;
    if(typeof spawnLavaPool==='function'){
      spawnLavaPool(lx,lz,3,6);
    }
    addChat('sys','[카르나스]','용암이 솟아오른다!');

  }else if(atkName==='webShot'){
    /* 거미줄: 플레이어 슬로우 */
    addChat('sys','[아라크네]','★ 거미줄 발사!');
    if(dist<14){
      currentRaid.slowTimer=3.0;
      if(typeof playerSlowed!=='undefined')playerSlowed=3.0;
      var dmg3=Math.floor(rd.atk*0.4);
      _dealDmgToPlayer(dmg3,'거미줄');
      addChat('sys','[시스템]','거미줄에 걸려 이동 속도가 감소했다! (3초)');
    }

  }else if(atkName==='poisonCloud'){
    /* 독 구름: 장판 데미지 */
    addChat('sys','[아라크네]','★ 독 구름!');
    var geoC=new THREE.CircleGeometry(5,12);
    var matC=new THREE.MeshBasicMaterial({color:0x44ff44,transparent:true,opacity:0.45,side:THREE.DoubleSide});
    var cloudMesh=new THREE.Mesh(geoC,matC);
    cloudMesh.rotation.x=-Math.PI/2;
    cloudMesh.position.set(px,currentRaid.arenaY+.05,pz);
    scene.add(cloudMesh);
    currentRaid.arenaMeshes.push(cloudMesh);
    /* 2초 후 제거 + 데미지 */
    var dmg4=Math.floor(rd.atk*0.5*(currentRaid.phase==='enraged'?1.3:1));
    if(dist<5)_dealDmgToPlayer(dmg4,'독 구름');
    setTimeout(function(){
      if(cloudMesh&&cloudMesh.parent)scene.remove(cloudMesh);
    },2000);

  }else if(atkName==='summonSpiderlings'){
    /* 거미 소환: 3마리 작은 어드 */
    addChat('sys','[아라크네]','★ 거미 새끼들을 소환한다!');
    _spawnRaidAdds(3,'spiderling');

  }else if(atkName==='curse'){
    /* 저주: 플레이어 ATK 감소 */
    addChat('sys','[모르가스]','★ 저주의 기운!');
    if(dist<16){
      currentRaid.curseTimer=6.0;
      var dmg5=Math.floor(rd.atk*0.35);
      _dealDmgToPlayer(dmg5,'저주');
      addChat('sys','[시스템]','저주를 받아 공격력이 약해졌다! (6초)');
    }

  }else if(atkName==='deathWave'){
    /* 죽음의 파동: 큰 원형 AoE */
    addChat('sys','[모르가스]','★ 죽음의 파동!');
    var geoW=new THREE.CircleGeometry(10,16);
    var matW=new THREE.MeshBasicMaterial({color:0x00ff44,transparent:true,opacity:0.35,side:THREE.DoubleSide});
    var waveMesh=new THREE.Mesh(geoW,matW);
    waveMesh.rotation.x=-Math.PI/2;
    waveMesh.position.set(bx,currentRaid.arenaY+.04,bz);
    scene.add(waveMesh);
    currentRaid.arenaMeshes.push(waveMesh);
    var dmg6=Math.floor(rd.atk*0.75*(currentRaid.phase==='enraged'?1.5:1));
    if(dist<10)_dealDmgToPlayer(dmg6,'죽음의 파동');
    if(typeof screenShake==='function')screenShake(0.4,0.25);
    setTimeout(function(){
      if(waveMesh&&waveMesh.parent)scene.remove(waveMesh);
    },2000);

  }else if(atkName==='summonSkeletons'){
    /* 해골 전사 소환: 4마리 */
    addChat('sys','[모르가스]','★ 해골 전사 소환!');
    _spawnRaidAdds(4,'skeleton');

  }else if(atkName==='vineGrab'){
    /* 덩굴 포박: 플레이어 2초 루트 */
    addChat('sys','[유그드라]','★ 덩굴 포박!');
    if(dist<12){
      currentRaid.rootTimer=2.0;
      var dmg7=Math.floor(rd.atk*0.45);
      _dealDmgToPlayer(dmg7,'덩굴 포박');
      addChat('sys','[시스템]','덩굴에 묶여 움직일 수 없다! (2초)');
    }

  }else if(atkName==='natureBurst'){
    /* 자연 폭발: 원형 AoE */
    addChat('sys','[유그드라]','★ 자연의 폭발!');
    var geoN=new THREE.CircleGeometry(7,16);
    var matN=new THREE.MeshBasicMaterial({color:0x88ff44,transparent:true,opacity:0.4,side:THREE.DoubleSide});
    var nMesh=new THREE.Mesh(geoN,matN);
    nMesh.rotation.x=-Math.PI/2;
    nMesh.position.set(bx,currentRaid.arenaY+.04,bz);
    scene.add(nMesh);
    currentRaid.arenaMeshes.push(nMesh);
    var dmg8=Math.floor(rd.atk*0.65*(currentRaid.phase==='enraged'?1.4:1));
    if(dist<7)_dealDmgToPlayer(dmg8,'자연의 폭발');
    setTimeout(function(){
      if(nMesh&&nMesh.parent)scene.remove(nMesh);
    },1800);

  }else if(atkName==='selfHeal'){
    /* 자가 회복: 최대 HP 5% */
    var healAmt=Math.floor(rd.hp*0.05);
    var boss2=currentRaid.bossObj;
    boss2.hp=Math.min(boss2.maxHp,boss2.hp+healAmt);
    addChat('sys','[유그드라]','자연의 힘으로 회복한다! (+'+healAmt+' HP)');
  }
}

/* ── 어드 스폰 ── */
function _spawnRaidAdds(count,type){
  if(!currentRaid)return;
  var by=currentRaid.arenaY;
  for(var i=0;i<count;i++){
    var angle=Math.random()*Math.PI*2;
    var r=4+Math.random()*6;
    var ax=Math.sin(angle)*r, az=Math.cos(angle)*r;
    var addMesh=_buildAddMesh(type);
    addMesh.position.set(ax,by+1,az);
    scene.add(addMesh);
    currentRaid.arenaMeshes.push(addMesh);
    var addObj={mesh:addMesh,hp:200,maxHp:200,type:type,atkTimer:1.5+Math.random()};
    currentRaid.addsAlive.push(addObj);
  }
}

function _buildAddMesh(type){
  var g=new THREE.Group();
  if(type==='spiderling'){
    var bm=new THREE.MeshLambertMaterial({color:0x220033});
    var body=new THREE.Mesh(new THREE.SphereGeometry(.25,6,6),bm);
    body.position.set(0,.3,0);g.add(body);
    var legM=new THREE.MeshLambertMaterial({color:0x110022});
    for(var i=0;i<4;i++){
      var la=(i/4)*Math.PI*2;
      var leg=new THREE.Mesh(new THREE.CylinderGeometry(.02,.03,.4,4),legM);
      leg.position.set(Math.sin(la)*.3,.2,Math.cos(la)*.3);
      leg.rotation.z=Math.sin(la)*(Math.PI/2-0.5);
      g.add(leg);
    }
  }else if(type==='skeleton'){
    var boneM=new THREE.MeshLambertMaterial({color:0xccddaa});
    var torso=new THREE.Mesh(new THREE.BoxGeometry(.3,.5,.2),boneM);
    torso.position.set(0,.65,0);g.add(torso);
    var head=new THREE.Mesh(new THREE.BoxGeometry(.25,.28,.22),boneM);
    head.position.set(0,1.05,0);g.add(head);
    var eyeM=new THREE.MeshBasicMaterial({color:0xff4400});
    [-0.07,0.07].forEach(function(ex){
      var eye=new THREE.Mesh(new THREE.SphereGeometry(.04,5,5),eyeM);
      eye.position.set(ex,1.08,.12);g.add(eye);
    });
    [-0.12,0.12].forEach(function(lx){
      var leg=new THREE.Mesh(new THREE.BoxGeometry(.1,.38,.1),boneM);
      leg.position.set(lx,.2,0);g.add(leg);
    });
  }
  return g;
}

/* ── 어드 틱 ── */
function _tickRaidAdds(dt){
  if(!currentRaid)return;
  for(var i=currentRaid.addsAlive.length-1;i>=0;i--){
    var add=currentRaid.addsAlive[i];
    if(add.hp<=0){
      scene.remove(add.mesh);
      var idx=currentRaid.arenaMeshes.indexOf(add.mesh);
      if(idx>=0)currentRaid.arenaMeshes.splice(idx,1);
      currentRaid.addsAlive.splice(i,1);
      continue;
    }
    /* 플레이어 추격 + 공격 */
    if(PL&&PL.group){
      var px=PL.group.position.x, pz=PL.group.position.z;
      var ax=add.mesh.position.x, az=add.mesh.position.z;
      var ddx=px-ax, ddz=pz-az;
      var ddist=Math.sqrt(ddx*ddx+ddz*ddz)||1;
      if(ddist>1.5){
        add.mesh.position.x+=ddx/ddist*2*dt;
        add.mesh.position.z+=ddz/ddist*2*dt;
      }
      /* 공격 */
      add.atkTimer-=dt;
      if(add.atkTimer<=0&&ddist<2&&invincibleTimer<=0){
        add.atkTimer=1.5;
        var addDmg=(add.type==='skeleton')?20:12;
        _dealDmgToPlayer(addDmg,add.type==='skeleton'?'해골 전사':'거미 새끼');
      }
    }
  }
}

/* ── 플레이어에게 데미지 ── */
function _dealDmgToPlayer(dmg,srcName){
  if(!PL||!PL.group)return;
  if(invincibleTimer>0)return;
  if(currentRaid&&currentRaid.rootTimer>0)return;/* 루트 중에는 맞지 않음 — 편의상 */
  /* 저주 중이면 받는 데미지 +20% */
  if(currentRaid&&currentRaid.curseTimer>0)dmg=Math.floor(dmg*1.2);
  playerHP=Math.max(0,playerHP-dmg);
  invincibleTimer=0.4;
  if(typeof updPlayerHpBar==='function')updPlayerHpBar();
  if(typeof spawnDmgNum==='function')spawnDmgNum(dmg,false);
  if(typeof screenShake==='function')screenShake(0.25,0.15);
  if(playerHP<=0){
    if(typeof playerDied==='function')playerDied();
    /* 사망 시 레이드에서 강제 퇴장 */
    setTimeout(function(){exitRaid(false);},1500);
  }
}

/* ── 플레이어 공격이 레이드 보스 맞춤 (기존 공격 시스템과 연동) ── */
function damageRaidBoss(dmg){
  if(!currentRaid||!currentRaid.bossObj||currentRaid.defeated)return false;
  var boss=currentRaid.bossObj;
  boss.hp=Math.max(0,boss.hp-dmg);
  /* 히트 플래시 */
  boss.hitFlash=0.1;
  boss.mesh&&boss.mesh.traverse(function(c){
    if(c.isMesh&&c.material&&c.material.emissive){
      c.material.emissive.setHex(0xffffff);
      c.material.emissiveIntensity=0.8;
    }
  });
  setTimeout(function(){
    if(!currentRaid||!currentRaid.bossObj)return;
    var enraged=currentRaid.phase==='enraged';
    currentRaid.bossObj.mesh&&currentRaid.bossObj.mesh.traverse(function(c){
      if(c.isMesh&&c.material&&c.material.emissive){
        c.material.emissive.setHex(enraged?0x550000:0x000000);
        c.material.emissiveIntensity=enraged?0.4:0;
      }
    });
  },100);
  if(boss.hp<=0&&!currentRaid.defeated){
    _onBossDefeated();
  }
  return true;
}

/* ── 보스 처치 ── */
function _onBossDefeated(){
  if(!currentRaid||currentRaid.defeated)return;
  currentRaid.defeated=true;
  var rd=currentRaid.def;
  _raidCooldowns[rd.id]=Date.now();

  addChat('sys','[레이드]','★★★ '+rd.name+' 처치! ★★★');
  if(typeof SFX!=='undefined'&&SFX.questComplete)SFX.questComplete();

  /* 보상 */
  gold+=rd.rewardGold;
  playerEXP+=rd.rewardExp;
  if(typeof updGoldUI==='function')updGoldUI();
  else{var g2=document.getElementById('inv-gold');if(g2)g2.textContent='💰 '+gold+' 골드';}
  if(typeof checkLevelUp==='function')checkLevelUp();
  addChat('sys','[레이드]','보상: '+rd.rewardGold+' 골드, '+rd.rewardExp+' EXP');

  /* 랜덤 아이템 드롭 */
  if(rd.rewardItems&&rd.rewardItems.length>0){
    var dropId=rd.rewardItems[Math.floor(Math.random()*rd.rewardItems.length)];
    if(typeof getItemDef==='function'&&typeof addItem==='function'){
      var df=getItemDef(dropId);
      if(df){addItem(dropId,1,df);addChat('sys','[레이드]','★ ['+df.name+'] 획득!');}
    }
  }

  /* 승리 화면 */
  var vic=document.createElement('div');
  vic.id='raid-victory';
  vic.style.cssText='position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#08001aee;border:2px solid #cc88ff;border-radius:14px;padding:30px 40px;z-index:9999;text-align:center;color:#e8d8ff;font-family:inherit;min-width:280px;';
  vic.innerHTML=
    '<div style="font-size:28px;margin-bottom:8px;">🏆</div>'+
    '<div style="color:#cc88ff;font-size:20px;font-weight:bold;margin-bottom:6px;">레이드 클리어!</div>'+
    '<div style="color:#ffcc44;font-size:14px;margin-bottom:4px;">'+rd.name+'</div>'+
    '<div style="color:#88ddff;font-size:13px;margin-bottom:4px;">+'+rd.rewardGold+' 골드 / +'+rd.rewardExp+' EXP</div>'+
    '<div style="color:#aaa;font-size:12px;">3초 후 귀환...</div>';
  document.body.appendChild(vic);

  setTimeout(function(){
    if(vic.parentNode)vic.remove();
    exitRaid(true);
  },3000);
}

/* ── 레이드 탈출 ── */
function exitRaid(victory){
  if(!currentRaid)return;
  if(typeof SFX!=='undefined')SFX.doorExit();

  var savedPos=currentRaid.savedPos;

  fadeOverlay.style.opacity='1';
  setTimeout(function(){
    /* 아레나 정리 */
    currentRaid.arenaMeshes.forEach(function(m){scene.remove(m);});
    /* 어드 정리 */
    currentRaid.addsAlive.forEach(function(add){scene.remove(add.mesh);});
    /* 보스 HP UI 제거 */
    var bh=document.getElementById('raid-boss-hp');
    if(bh)bh.remove();

    /* 플레이어 복귀 */
    PL.group.position.set(savedPos.x,0,savedPos.z);
    if(typeof getTerrainY==='function'){
      PL.group.position.y=getTerrainY(savedPos.x,savedPos.z);
    }
    /* 안개 복원 */
    if(typeof scene!=='undefined'&&scene){
      scene.fog=new THREE.FogExp2(0x88aa88,.002);
    }
    if(typeof renderer!=='undefined'&&renderer){
      renderer.setClearColor(0x000000,0);
    }

    if(!victory){
      addChat('sys','[레이드]','레이드에서 탈출했습니다.');
    }
    currentRaid=null;
    setTimeout(function(){fadeOverlay.style.opacity='0';},200);
  },700);
}

/* ── 레이드 진행 체크 (매 프레임, main.js 루프에서 호출) ── */
function checkRaidProgress(){
  if(!currentRaid||currentRaid.defeated)return;
  /* 아레나 범위 제한 */
  var R=23;
  if(PL&&PL.group){
    var px=PL.group.position.x, pz=PL.group.position.z;
    var dist2=Math.sqrt(px*px+pz*pz);
    if(dist2>R){
      PL.group.position.x=px/dist2*R;
      PL.group.position.z=pz/dist2*R;
    }
    /* Y 고정 */
    PL.group.position.y=currentRaid.arenaY+1;
  }
}

/* ── 루트 상태 체크 (player.js의 handleMove에서 참조) ── */
function isPlayerRooted(){
  return currentRaid&&currentRaid.rootTimer>0;
}
