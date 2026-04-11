/* ════════════ 던전 시스템 ════════════ */
/* 의존: world.js (scene), player.js (PL, playerLevel), monster.js (spawnMonster), ui.js (addChat)
   선언: DUNGEONS, currentDungeon, enterDungeon, exitDungeon, checkDungeonProgress */

var DUNGEONS=[
  {
    id:'goblin_cave',name:'고블린 동굴',minLevel:5,
    entrance:{x:-200,z:150},/* 늪 근처 */
    rooms:[
      {monsters:[{id:'goblin',count:4}],size:20},
      {monsters:[{id:'goblin',count:5},{id:'wolf',count:2}],size:22},
      {monsters:[{id:'elite_wolf',count:1}],size:25,boss:true}
    ],
    rewards:{gold:800,exp:2500,drops:['iron_sword','leather_armor','magic_crystal']}
  },
  {
    id:'crystal_cave',name:'수정 동굴',minLevel:15,
    entrance:{x:300,z:200},/* 정글 근처 */
    rooms:[
      {monsters:[{id:'jungle_spider',count:5},{id:'jungle_snake',count:3}],size:22},
      {monsters:[{id:'jungle_ape',count:3},{id:'jungle_treant',count:2}],size:25},
      {monsters:[{id:'elite_ape',count:1}],size:28,boss:true}
    ],
    rewards:{gold:2500,exp:6000,drops:['moonblade','star_fragment','dragon_scale']}
  },
  {
    id:'lava_dungeon',name:'용암 심연',minLevel:25,
    entrance:{x:350,z:500},/* 화산 지대 */
    rooms:[
      {monsters:[{id:'golem',count:3},{id:'firedrake',count:2}],size:25},
      {monsters:[{id:'golem',count:4},{id:'firedrake',count:3}],size:28},
      {monsters:[{id:'firedrake',count:2},{id:'golem',count:2}],size:25},
      {monsters:[{id:'elite_dragon',count:1}],size:30,boss:true}
    ],
    rewards:{gold:6000,exp:12000,drops:['eclipse_blade','dragon_scale','immortal_potion']}
  }
];

var currentDungeon=null;/* {def, roomIdx, roomMonsters[], cleared, baseY} */
var _dungeonBaseY=-800;
var _dungeonMeshes=[];/* 던전 방 메쉬들 (정리용) */
var _dungeonMonsters=[];/* 던전 몬스터 (별도 관리) */
var _dungeonEntranceNpcs=[];/* 던전 입구 표시 */

/* ── 던전 NPC 이름 ── */
var DUNGEON_NPC_NAMES={
  'goblin_cave':'(던전지기) 고르딘',
  'crystal_cave':'(던전지기) 크리스탈',
  'lava_dungeon':'(던전지기) 이그니스'
};

/* ── 던전 입구 빌드 (NPC + 동굴 입구) ── */
function buildDungeonEntrances(){
  var caveM=new THREE.MeshLambertMaterial({color:0x3a3a3a});
  var caveInnerM=new THREE.MeshLambertMaterial({color:0x0a0a0a});
  var torchM=new THREE.MeshLambertMaterial({color:0x8a4a1a});

  DUNGEONS.forEach(function(dg){
    var ex=dg.entrance.x,ez=dg.entrance.z;
    var ey=(typeof getTerrainY==='function')?getTerrainY(ex,ez):0;

    /* 동굴 아치 */
    var arch=new THREE.Mesh(new THREE.TorusGeometry(3,1,6,12,Math.PI),caveM);
    arch.position.set(ex,ey+3,ez);arch.rotation.x=Math.PI/2;
    scene.add(arch);_dungeonMeshes.push(arch);

    /* 동굴 입구 (검은 원) */
    var hole=new THREE.Mesh(new THREE.CircleGeometry(2.5,16),caveInnerM);
    hole.position.set(ex,ey+1.5,ez+0.1);scene.add(hole);_dungeonMeshes.push(hole);

    /* 바닥 돌 */
    var floor=new THREE.Mesh(new THREE.CircleGeometry(4,12),new THREE.MeshLambertMaterial({color:0x4a4a4a}));
    floor.rotation.x=-Math.PI/2;floor.position.set(ex,ey+0.02,ez+2);scene.add(floor);

    /* 횃불 2개 */
    var tl=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,1.5,5),torchM);
    tl.position.set(ex-2.5,ey+1,ez+1);scene.add(tl);
    var tr=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,1.5,5),torchM);
    tr.position.set(ex+2.5,ey+1,ez+1);scene.add(tr);

    var light=new THREE.PointLight(0xff6600,.5,10);
    light.position.set(ex,ey+2.5,ez+1);scene.add(light);

    /* ── 던전 NPC 스폰 (입구 앞) ── */
    var npcName=DUNGEON_NPC_NAMES[dg.id]||'(던전지기)';
    var npcX=ex+4,npcZ=ez+3;
    var npcY=(typeof getTerrainY==='function')?getTerrainY(npcX,npcZ):ey;
    var npcMesh=(typeof mkHuman==='function')?mkHuman(0x5a3a2a,0xddcc99):new THREE.Mesh(new THREE.BoxGeometry(.6,1.6,.4),new THREE.MeshLambertMaterial({color:0x5a3a2a}));
    if(npcMesh.group){npcMesh=npcMesh.group;}
    npcMesh.position.set(npcX,npcY,npcZ);
    npcMesh.rotation.y=Math.PI;
    scene.add(npcMesh);

    var nameEl=document.createElement('div');nameEl.className='nlabel npc';
    nameEl.style.cssText='background:#1a0a00ee;border:1px solid #ff8844;color:#ffaa44;padding:2px 6px;font-size:11px;';
    nameEl.textContent=npcName;
    document.getElementById('lov').appendChild(nameEl);

    var intEl=document.createElement('div');intEl.className='linteract';
    intEl.textContent='E 대화';intEl.style.display='none';
    document.getElementById('lov').appendChild(intEl);

    var npcObj={name:npcName,mesh:npcMesh,nameEl:nameEl,intEl:intEl,dungeonId:dg.id,bobOff:Math.random()*5};
    npcs.push(npcObj);
    dg._npc=npcObj;

    /* 이름 라벨 (던전 이름) */
    var lbl=document.createElement('div');
    lbl.className='nlabel';
    lbl.style.cssText='color:#ff8844;font-size:12px;font-weight:bold;background:#1a0a00cc;padding:3px 8px;border:1px solid #ff6600;border-radius:4px;text-shadow:0 0 6px #ff4400;';
    lbl.textContent='⚔ '+dg.name+' (Lv.'+dg.minLevel+'+)';
    lbl.dataset.wx=ex;lbl.dataset.wy=ey+5;lbl.dataset.wz=ez;
    lbl.classList.add('bld');
    document.getElementById('lov').appendChild(lbl);

    /* 입장 트리거 등록 */
    dg._entranceLabel=lbl;
  });
}

/* ── 던전 입구 감지 (매 프레임) ── */
var _nearestDungeon=null;
var _dungeonHintEl=null;

function checkDungeonEntrance(){
  if(!PL||!PL.group||currentDungeon)return;
  if(typeof insideBuilding!=='undefined'&&insideBuilding)return;
  var px=PL.group.position.x,pz=PL.group.position.z;
  _nearestDungeon=null;

  for(var i=0;i<DUNGEONS.length;i++){
    var dg=DUNGEONS[i];
    var dx=px-dg.entrance.x,dz=pz-dg.entrance.z;
    if(dx*dx+dz*dz<25){/* 반경 5 */
      _nearestDungeon=dg;
      break;
    }
  }

  if(!_dungeonHintEl){
    _dungeonHintEl=document.createElement('div');
    _dungeonHintEl.style.cssText='position:fixed;top:45%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.8);color:#ff8844;padding:10px 20px;border:1px solid #ff660088;border-radius:6px;font-size:14px;letter-spacing:1px;z-index:20;pointer-events:none;display:none;';
    document.body.appendChild(_dungeonHintEl);
  }

  if(_nearestDungeon){
    _dungeonHintEl.textContent='E — '+_nearestDungeon.name+' 입장 (Lv.'+_nearestDungeon.minLevel+'+)';
    _dungeonHintEl.style.display='block';
  }else{
    _dungeonHintEl.style.display='none';
  }
}

/* ── 던전 NPC 대화 → 입장 확인 UI ── */
function showDungeonConfirm(npc){
  var dgId=npc.dungeonId;
  var dg=DUNGEONS.find(function(d){return d.id===dgId;});
  if(!dg)return;

  /* 레벨 체크 */
  if(playerLevel<dg.minLevel){
    addChat('npc',npc.name,'이봐, 아직 실력이 부족해. 레벨 '+dg.minLevel+' 이상이 되어야 입장할 수 있어.');
    return;
  }

  var npcName=npc.name;
  var roomCount=dg.rooms.length;
  var rew=dg.rewards;

  /* 대화 + 입장 확인 모달 */
  addChat('npc',npcName,'어서와, 모험가. '+dg.name+'에 도전하겠나? '+roomCount+'개 방을 통과해야 하지.');

  var modal=document.createElement('div');
  modal.id='dungeon-confirm';
  modal.style.cssText='position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:320px;background:#0c0c1eee;border:2px solid #ff660088;border-radius:12px;padding:20px;z-index:9999;color:#f0e4bb;text-align:center;font-family:inherit;';

  modal.innerHTML=
    '<div style="color:#ff8844;font-size:18px;font-weight:bold;margin-bottom:8px;">⚔ '+dg.name+'</div>'+
    '<div style="color:#aaa;font-size:12px;margin-bottom:12px;">권장 레벨: Lv.'+dg.minLevel+'+</div>'+
    '<div style="background:#1a1a2e;padding:10px;border-radius:8px;margin-bottom:12px;text-align:left;font-size:12px;">'+
      '<div>📋 총 '+roomCount+'개 방</div>'+
      '<div>💰 보상: '+rew.gold+' 골드</div>'+
      '<div>⭐ 경험치: '+rew.exp+' EXP</div>'+
      '<div>🎁 드롭: '+(rew.drops?rew.drops.map(function(d){var df=getItemDef(d);return df?df.name:d;}).join(', '):'없음')+'</div>'+
    '</div>'+
    '<div style="display:flex;gap:8px;">'+
      '<button id="dg-enter-btn" style="flex:1;background:#ff8844;color:#0c0c1e;border:none;padding:12px;font-size:14px;font-weight:bold;cursor:pointer;font-family:inherit;border-radius:6px;">입장하기</button>'+
      '<button id="dg-cancel-btn" style="flex:1;background:#333;color:#aaa;border:1px solid #555;padding:12px;font-size:13px;cursor:pointer;font-family:inherit;border-radius:6px;">취소</button>'+
    '</div>';

  document.body.appendChild(modal);

  document.getElementById('dg-enter-btn').onclick=function(){
    modal.remove();
    enterDungeon(dg);
  };
  document.getElementById('dg-cancel-btn').onclick=function(){
    modal.remove();
    addChat('npc',npcName,'다음에 다시 오게, 모험가.');
  };
}

/* ── 던전 입장 ── */
function enterDungeon(dg){
  if(!dg)return;
  if(playerLevel<dg.minLevel){
    addChat('sys','[시스템]','레벨 '+dg.minLevel+' 이상이어야 입장 가능합니다. (현재 Lv.'+playerLevel+')');
    return;
  }
  if(typeof SFX!=='undefined')SFX.doorEnter();

  currentDungeon={
    def:dg,
    roomIdx:0,
    cleared:false,
    baseY:_dungeonBaseY,
    savedPos:{x:PL.group.position.x,z:PL.group.position.z}
  };

  addChat('sys','[던전]','⚔ '+dg.name+' 입장!');
  fadeOverlay.style.opacity='1';

  setTimeout(function(){
    buildDungeonRoom(0);
    PL.group.position.set(0,currentDungeon.baseY+1,8);
    setTimeout(function(){fadeOverlay.style.opacity='0';},200);
  },600);
}

/* ── 던전 방 빌드 ── */
function buildDungeonRoom(roomIdx){
  /* 이전 방 정리 */
  cleanupDungeonRoom();

  var room=currentDungeon.def.rooms[roomIdx];
  var by=currentDungeon.baseY;
  var S=room.size||20;
  var H=8;

  /* 바닥 */
  var floorM=new THREE.MeshLambertMaterial({color:room.boss?0x2a1010:0x3a3020});
  var floor=new THREE.Mesh(new THREE.PlaneGeometry(S*2,S*2),floorM);
  floor.rotation.x=-Math.PI/2;floor.position.set(0,by,0);scene.add(floor);_dungeonMeshes.push(floor);

  /* 벽 */
  var wallM=new THREE.MeshLambertMaterial({color:room.boss?0x1a0808:0x2a2a1a});
  var wallGeo=new THREE.PlaneGeometry(S*2,H);
  var w1=new THREE.Mesh(wallGeo,wallM);w1.position.set(0,by+H/2,-S);scene.add(w1);_dungeonMeshes.push(w1);
  var w2=new THREE.Mesh(wallGeo,wallM);w2.position.set(0,by+H/2,S);w2.rotation.y=Math.PI;scene.add(w2);_dungeonMeshes.push(w2);
  var w3=new THREE.Mesh(new THREE.PlaneGeometry(S*2,H),wallM);w3.rotation.y=Math.PI/2;w3.position.set(-S,by+H/2,0);scene.add(w3);_dungeonMeshes.push(w3);
  var w4=new THREE.Mesh(new THREE.PlaneGeometry(S*2,H),wallM);w4.rotation.y=-Math.PI/2;w4.position.set(S,by+H/2,0);scene.add(w4);_dungeonMeshes.push(w4);

  /* 천장 */
  var ceil=new THREE.Mesh(new THREE.PlaneGeometry(S*2,S*2),new THREE.MeshLambertMaterial({color:0x1a1a10}));
  ceil.rotation.x=Math.PI/2;ceil.position.set(0,by+H,0);scene.add(ceil);_dungeonMeshes.push(ceil);

  /* 조명 */
  var mainLight=new THREE.PointLight(room.boss?0xff4400:0xffaa44,0.8,S*2);
  mainLight.position.set(0,by+H-1,0);scene.add(mainLight);_dungeonMeshes.push(mainLight);

  /* 횃불 4개 (코너) */
  var corners=[[-S+2,by+3,-S+2],[S-2,by+3,-S+2],[-S+2,by+3,S-2],[S-2,by+3,S-2]];
  corners.forEach(function(c){
    var torch=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,1,5),new THREE.MeshLambertMaterial({color:0x8a4a1a}));
    torch.position.set(c[0],c[1],c[2]);scene.add(torch);_dungeonMeshes.push(torch);
    var tl=new THREE.PointLight(0xff6622,.3,8);tl.position.set(c[0],c[1]+.5,c[2]);scene.add(tl);_dungeonMeshes.push(tl);
  });

  /* 보스 방: 특수 장식 */
  if(room.boss){
    /* 빨간 카펫 */
    var bossRug=new THREE.Mesh(new THREE.PlaneGeometry(4,S*1.5),new THREE.MeshLambertMaterial({color:0x6a1010}));
    bossRug.rotation.x=-Math.PI/2;bossRug.position.set(0,by+.01,0);scene.add(bossRug);_dungeonMeshes.push(bossRug);
    /* 기둥 4개 */
    var pillarM=new THREE.MeshLambertMaterial({color:0x4a4a4a});
    [[-5,0,-5],[5,0,-5],[-5,0,5],[5,0,5]].forEach(function(pp){
      var pillar=new THREE.Mesh(new THREE.CylinderGeometry(.5,.6,H,8),pillarM);
      pillar.position.set(pp[0],by+H/2,pp[2]);scene.add(pillar);_dungeonMeshes.push(pillar);
    });
  }

  /* 나가기 표시 */
  var exitCarpet=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.MeshLambertMaterial({color:0xaa2222}));
  exitCarpet.rotation.x=-Math.PI/2;exitCarpet.position.set(0,by+.01,S-1);scene.add(exitCarpet);_dungeonMeshes.push(exitCarpet);

  /* 방 번호 표시 */
  var totalRooms=currentDungeon.def.rooms.length;
  addChat('sys','[던전]',(room.boss?'★ 보스 방! ':'방 '+(roomIdx+1)+'/'+totalRooms+' — ')+'몬스터를 모두 처치하라!');

  /* 몬스터 스폰 */
  _dungeonMonsters=[];
  room.monsters.forEach(function(mg){
    var mdef=MONSTER_DEFS.find(function(d){return d.id===mg.id;});
    if(!mdef)return;
    for(var mi=0;mi<mg.count;mi++){
      var mx=(Math.random()-.5)*(S-4);
      var mz=(Math.random()-.5)*(S-4);
      /* 스폰 위치가 플레이어 근처면 밀어냄 */
      if(Math.abs(mx)<3&&mz>3)mz=-Math.abs(mz);
      var m=spawnMonster(mdef,mx,mz,scene);
      if(m){
        m.mesh.position.y=by;
        m.baseY=by;
        m.spawnX=mx;m.spawnZ=mz;
        _dungeonMonsters.push(m);
      }
    }
  });

  currentDungeon.roomIdx=roomIdx;
  currentDungeon.cleared=false;
}

/* ── 던전 방 정리 ── */
function cleanupDungeonRoom(){
  _dungeonMeshes.forEach(function(m){scene.remove(m);});
  _dungeonMeshes=[];
  /* 던전 몬스터 제거 */
  _dungeonMonsters.forEach(function(dm){
    if(dm.mesh)scene.remove(dm.mesh);
    if(dm.wrap&&dm.wrap.parentNode)dm.wrap.parentNode.removeChild(dm.wrap);
    var idx=monsters.indexOf(dm);
    if(idx>=0)monsters.splice(idx,1);
  });
  _dungeonMonsters=[];
}

/* ── 던전 진행 체크 (매 프레임) ── */
function checkDungeonProgress(){
  if(!currentDungeon||currentDungeon.cleared)return;

  /* 모든 던전 몬스터가 죽었는지 확인 */
  var allDead=true;
  for(var i=0;i<_dungeonMonsters.length;i++){
    if(_dungeonMonsters[i].hp>0){allDead=false;break;}
  }

  if(allDead&&_dungeonMonsters.length>0){
    currentDungeon.cleared=true;
    var roomIdx=currentDungeon.roomIdx;
    var totalRooms=currentDungeon.def.rooms.length;

    if(roomIdx>=totalRooms-1){
      /* 마지막 방 (보스) 클리어! */
      addChat('sys','[던전]','★★★ '+currentDungeon.def.name+' 클리어! ★★★');
      if(typeof SFX!=='undefined')SFX.questComplete();

      /* 보상 지급 */
      var rew=currentDungeon.def.rewards;
      gold+=rew.gold;
      playerEXP+=rew.exp;
      addChat('sys','[던전]','보상: '+rew.gold+' 골드, '+rew.exp+' EXP');
      document.getElementById('inv-gold').textContent='💰 '+gold+' 골드';
      if(typeof checkLevelUp==='function')checkLevelUp();

      /* 랜덤 아이템 드롭 */
      if(rew.drops&&rew.drops.length>0){
        var dropId=rew.drops[Math.floor(Math.random()*rew.drops.length)];
        var df=getItemDef(dropId);
        if(df){
          addItem(dropId,1,df);
          addChat('sys','[던전]','★ ['+df.name+'] 획득!');
        }
      }

      /* 3초 후 나가기 */
      setTimeout(function(){exitDungeon();},3000);
    }else{
      /* 다음 방으로 */
      addChat('sys','[던전]','클리어! 다음 방으로 이동합니다...');
      setTimeout(function(){
        fadeOverlay.style.opacity='1';
        setTimeout(function(){
          buildDungeonRoom(roomIdx+1);
          PL.group.position.set(0,currentDungeon.baseY+1,8);
          setTimeout(function(){fadeOverlay.style.opacity='0';},200);
        },600);
      },1500);
    }
  }

  /* 던전 내부 이동 제한 */
  if(currentDungeon&&PL.group){
    var room=currentDungeon.def.rooms[currentDungeon.roomIdx];
    var S=room?room.size||20:20;
    if(PL.group.position.x<-S)PL.group.position.x=-S;
    if(PL.group.position.x>S)PL.group.position.x=S;
    if(PL.group.position.z<-S)PL.group.position.z=-S;
    if(PL.group.position.z>S)PL.group.position.z=S;

    /* 나가기 (빨간 카펫, 남쪽 벽 근처) */
    if(PL.group.position.z>S-2&&Math.abs(PL.group.position.x)<2){
      /* 나가기 힌트 */
      if(_dungeonHintEl){
        _dungeonHintEl.textContent='E — 던전 나가기';
        _dungeonHintEl.style.display='block';
      }
    }
  }
}

/* ── 던전 탈출 ── */
function exitDungeon(){
  if(!currentDungeon)return;
  if(typeof SFX!=='undefined')SFX.doorExit();
  fadeOverlay.style.opacity='1';

  setTimeout(function(){
    cleanupDungeonRoom();
    var saved=currentDungeon.savedPos;
    PL.group.position.set(saved.x,0,saved.z);
    addChat('sys','[던전]','던전에서 나왔습니다.');
    currentDungeon=null;
    if(_dungeonHintEl)_dungeonHintEl.style.display='none';
    setTimeout(function(){fadeOverlay.style.opacity='0';},200);
  },600);
}

/* ── E키로 던전 입장/탈출 (main.js에서 호출) ── */
function tryEnterDungeon(){
  if(currentDungeon){
    /* 던전 안에서 나가기 */
    var room=currentDungeon.def.rooms[currentDungeon.roomIdx];
    var S=room?room.size||20:20;
    if(PL.group.position.z>S-2&&Math.abs(PL.group.position.x)<2){
      exitDungeon();
      return true;
    }
    return false;
  }
  if(_nearestDungeon){
    enterDungeon(_nearestDungeon);
    return true;
  }
  return false;
}
