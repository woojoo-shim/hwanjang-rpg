/* ════════════ 멀티플레이어 시스템 (PartyKit) ════════════ */
/* 의존: config.js, ui.js (addChat, posEl), world.js (mkHuman, scene),
         player.js (PL), main.js (myName, keys, cYaw)
   선언: PARTY_HOST, ws, remotePlayers, connectParty, updateRemotePlayers, sendChatMP, sendAttackMP */

var PARTY_HOST='hwanjang-rpg.woojoo-shim.partykit.dev';
var ws=null;
var remotePlayers={};
var mpSendTimer=null;
var mpReconnectTimer=null;
var mpKicked=false;
var mpPingTimer=null;

function connectParty(){
  if(ws&&ws.readyState<=1)return;
  try{
    ws=new WebSocket('wss://'+PARTY_HOST+'/party/main');
  }catch(e){console.warn('WS connect error',e);return;}

  ws.onopen=function(){
    console.log('[MP] connected');
    /* uid = Supabase userId 또는 myName (고유 식별자) */
    var uid=(typeof currentUser!=='undefined'&&currentUser&&currentUser.id)?currentUser.id:myName;
    ws.send(JSON.stringify({
      type:'join',uid:uid,name:myName,level:playerLevel,
      x:+PL.group.position.x.toFixed(2),
      z:+PL.group.position.z.toFixed(2),
      ry:+PL.group.rotation.y.toFixed(2)
    }));
    if(mpSendTimer)clearInterval(mpSendTimer);
    mpSendTimer=setInterval(sendPosition,100);
    /* 핑으로 연결 유지 */
    if(mpPingTimer)clearInterval(mpPingTimer);
    mpPingTimer=setInterval(function(){
      if(ws&&ws.readyState===1)ws.send(JSON.stringify({type:'ping'}));
    },15000);
    addChat('sys','[시스템]','멀티플레이 서버에 연결되었습니다.');
  };

  ws.onmessage=function(e){
    var data;
    try{data=JSON.parse(e.data);}catch(er){return;}
    onMpMessage(data);
  };

  ws.onclose=function(e){
    console.log('[MP] disconnected, code:',e.code,'reason:',e.reason);
    if(mpSendTimer){clearInterval(mpSendTimer);mpSendTimer=null;}
    if(mpPingTimer){clearInterval(mpPingTimer);mpPingTimer=null;}
    if(monsterMoveTimer){clearInterval(monsterMoveTimer);monsterMoveTimer=null;}
    isMonsterHost=false;
    /* 중복 접속 킥만 재연결 안 함 */
    if(e.code===4000&&e.reason==='duplicate'){mpKicked=true;return;}
    /* 3초 후 재연결 */
    if(mpReconnectTimer)clearTimeout(mpReconnectTimer);
    mpReconnectTimer=setTimeout(function(){mpKicked=false;connectParty();},3000);
  };

  ws.onerror=function(e){console.warn('[MP] ws error',e);};
}

function sendPosition(){
  if(!ws||ws.readyState!==1||!PL.group)return;
  ws.send(JSON.stringify({
    type:'move',
    x:+PL.group.position.x.toFixed(2),
    z:+PL.group.position.z.toFixed(2),
    ry:+PL.group.rotation.y.toFixed(2),
    moving:!!(keys['w']||keys['s']||keys['a']||keys['d']||keys['arrowup']||keys['arrowdown']||keys['arrowleft']||keys['arrowright'])
  }));
}

function onMpMessage(data){
  if(data.type==='init'){
    /* 기존 플레이어들 스폰 */
    for(var id in data.players){
      var p=data.players[id];
      spawnRemote(id,p.name,p.level,p.x,p.z,p.ry);
    }
  }
  else if(data.type==='join'){
    spawnRemote(data.id,data.name,data.level,data.x,data.z,data.ry);
    addChat('sys','[시스템]',data.name+'이(가) 접속했습니다.');
  }
  else if(data.type==='move'){
    var r=remotePlayers[data.id];
    if(!r)return;
    r.tx=data.x;r.tz=data.z;r.try_=data.ry;r.moving=data.moving;
  }
  else if(data.type==='chat'){
    addChat('plr',data.name,data.text);
  }
  else if(data.type==='attack'){
    var r=remotePlayers[data.id];
    if(r)triggerRemoteAttack(r);
  }
  else if(data.type==='leave'){
    var myUid=(typeof currentUser!=='undefined'&&currentUser&&currentUser.id)?currentUser.id:myName;
    if(data.id!==myUid)removeRemote(data.id);
  }
  else if(data.type==='monster_init'){
    applyMonsterInit(data.monsters);
  }
  else if(data.type==='monster_update'){
    handleMonsterUpdate(data);
  }
  else if(data.type==='monster_move'){
    handleMonsterMove(data);
  }
  else if(data.type==='monster_move_batch'){
    if(data.list)for(var i=0;i<data.list.length;i++)handleMonsterMove(data.list[i]);
  }
  else if(data.type==='monster_respawn'){
    handleMonsterRespawn(data);
  }
}

/* ── 원격 플레이어 메쉬 ── */
var REMOTE_BODY_COLOR=0x3a3a8a;
var REMOTE_HEAD_COLOR=0xddcc99;

function spawnRemote(id,name,level,x,z,ry){
  if(remotePlayers[id])return;
  /* 자기 자신은 원격 플레이어로 생성하지 않음 */
  var myUid=(typeof currentUser!=='undefined'&&currentUser&&currentUser.id)?currentUser.id:myName;
  if(id===myUid)return;
  var h=mkHuman(REMOTE_BODY_COLOR,REMOTE_HEAD_COLOR);
  h.group.position.set(x,0,z);
  h.group.rotation.y=ry||0;
  scene.add(h.group);

  /* 이름표 */
  var lov=document.getElementById('lov');
  var ne=document.createElement('div');
  ne.className='llabel plr remote';
  ne.textContent=name+' Lv.'+level;
  ne.style.color='#88aaff';
  lov.appendChild(ne);

  remotePlayers[id]={
    name:name,level:level,
    group:h.group,legL:h.legL,legR:h.legR,
    armL:h.armL,armRPivot:h.armRPivot,
    nameEl:ne,
    tx:x,tz:z,try_:ry||0,
    bobT:0,moving:false,
    atkPhase:0,atkTimer:0
  };
}

function removeRemote(id){
  var r=remotePlayers[id];
  if(!r)return;
  scene.remove(r.group);
  if(r.nameEl&&r.nameEl.parentNode)r.nameEl.parentNode.removeChild(r.nameEl);
  addChat('sys','[시스템]',r.name+'이(가) 퇴장했습니다.');
  delete remotePlayers[id];
}

function triggerRemoteAttack(r){
  r.atkPhase=1;r.atkTimer=0;
}

/* ── 원격 플레이어 업데이트 (매 프레임) ── */
function updateRemotePlayers(dt){
  for(var id in remotePlayers){
    var r=remotePlayers[id];
    /* 위치 보간 */
    r.group.position.x+=(r.tx-r.group.position.x)*0.25;
    r.group.position.z+=(r.tz-r.group.position.z)*0.25;
    /* 회전 보간 */
    var dRot=r.try_-r.group.rotation.y;
    if(dRot>Math.PI)dRot-=Math.PI*2;
    if(dRot<-Math.PI)dRot+=Math.PI*2;
    r.group.rotation.y+=dRot*0.2;

    /* 걷기 애니메이션 */
    if(r.moving){
      r.bobT+=dt*9;
      var wa=0.32;
      r.legL.rotation.x=Math.sin(r.bobT)*wa;
      r.legR.rotation.x=-Math.sin(r.bobT)*wa;
      r.armL.rotation.x=-Math.sin(r.bobT)*wa*0.5;
      if(r.atkPhase===0)r.armRPivot.rotation.x=Math.sin(r.bobT)*wa*0.5;
      r.group.position.y=Math.abs(Math.sin(r.bobT))*0.06;
    }else{
      r.legL.rotation.x*=0.8;r.legR.rotation.x*=0.8;
      r.armL.rotation.x*=0.8;
      if(r.atkPhase===0)r.armRPivot.rotation.x*=0.8;
      r.group.position.y*=0.8;
    }

    /* 공격 애니메이션 */
    if(r.atkPhase>0){
      r.atkTimer+=dt;
      if(r.atkPhase===1){
        var t=Math.min(1,r.atkTimer/0.12);
        r.armRPivot.rotation.x=t*(-Math.PI*0.65);
        if(r.atkTimer>=0.12){r.atkPhase=2;r.atkTimer=0;}
      }else if(r.atkPhase===2){
        var t=Math.min(1,r.atkTimer/0.18);
        r.armRPivot.rotation.x=(-Math.PI*0.65)+(t*(Math.PI*1.2));
        if(r.atkTimer>=0.18){r.atkPhase=3;r.atkTimer=0;}
      }else if(r.atkPhase===3){
        var t=Math.min(1,r.atkTimer/0.25);
        r.armRPivot.rotation.x=(Math.PI*0.55)*(1-t);
        if(r.atkTimer>=0.25){r.atkPhase=0;r.atkTimer=0;r.armRPivot.rotation.x=0;}
      }
    }

    /* 이름표 위치 */
    posEl(r.nameEl,r.group.position.x,r.group.position.y+2.4,r.group.position.z);
  }
}

/* ── 채팅/공격 전송 ── */
function sendChatMP(name,text){
  if(!ws||ws.readyState!==1)return;
  ws.send(JSON.stringify({type:'chat',name:name,text:text}));
}

function sendAttackMP(){
  if(!ws||ws.readyState!==1)return;
  ws.send(JSON.stringify({type:'attack'}));
}

/* ═══════════ 몬스터 동기화 ═══════════ */
var isMonsterHost=false;
var monsterMoveTimer=null;

/* 몬스터 스폰 목록을 서버에 등록 (첫 접속자) */
function registerMonstersToServer(){
  if(!ws||ws.readyState!==1)return;
  var list=[];
  for(var i=0;i<monsters.length;i++){
    var m=monsters[i];
    list.push({
      mid:i,defId:m.def.id,
      x:+m.mesh.position.x.toFixed(1),z:+m.mesh.position.z.toFixed(1),
      hp:m.hp,maxHp:m.maxHp
    });
  }
  ws.send(JSON.stringify({type:'monster_register',list:list}));
  isMonsterHost=true;
  /* 호스트는 200ms마다 몬스터 위치를 서버로 전송 */
  if(monsterMoveTimer)clearInterval(monsterMoveTimer);
  monsterMoveTimer=setInterval(sendMonsterPositions,200);
}

/* 호스트가 몬스터 위치 전송 (배치로 한번에) */
function sendMonsterPositions(){
  if(!ws||ws.readyState!==1||!isMonsterHost)return;
  var batch=[];
  for(var i=0;i<monsters.length;i++){
    var m=monsters[i];
    if(m.deathAnim>=0||m.hp<=0)continue;
    if(m.state==='chasing'||m.state==='returning'){
      batch.push({mid:i,x:+m.mesh.position.x.toFixed(1),z:+m.mesh.position.z.toFixed(1)});
    }
  }
  if(batch.length>0)ws.send(JSON.stringify({type:'monster_move_batch',list:batch}));
}

/* 몬스터에 데미지를 서버에 알림 */
function sendMonsterHit(monsterIdx,dmg){
  if(!ws||ws.readyState!==1)return;
  var uid=(typeof currentUser!=='undefined'&&currentUser&&currentUser.id)?currentUser.id:myName;
  ws.send(JSON.stringify({type:'monster_hit',mid:monsterIdx,dmg:dmg,uid:uid,respawnMs:30000}));
}

/* 서버에서 온 몬스터 초기 상태 적용 */
function applyMonsterInit(serverMonsters){
  if(!serverMonsters||Object.keys(serverMonsters).length===0){
    /* 서버에 몬스터가 없으면 내가 호스트 */
    registerMonstersToServer();
    return;
  }
  /* 서버 상태를 로컬 몬스터에 반영 */
  for(var mid in serverMonsters){
    var sm=serverMonsters[mid];
    var idx=parseInt(mid);
    if(idx>=0&&idx<monsters.length){
      var m=monsters[idx];
      m.hp=sm.hp;
      m.mesh.position.x=sm.x;
      m.mesh.position.z=sm.z;
      if(!sm.alive){
        m.hp=0;m.deathAnim=1;
        m.mesh.visible=false;
        m.wrap.style.display='none';
      }else{
        m.hbf.style.width=Math.max(0,(m.hp/m.maxHp)*100)+'%';
      }
    }
  }
}

/* 서버에서 온 몬스터 업데이트 처리 */
function handleMonsterUpdate(data){
  var idx=data.mid;
  if(idx<0||idx>=monsters.length)return;
  var m=monsters[idx];
  m.hp=data.hp;
  if(!data.alive&&m.deathAnim<0){
    /* 몬스터 사망 — 킬러가 본인이면 드랍/경험치 처리 */
    var uid=(typeof currentUser!=='undefined'&&currentUser&&currentUser.id)?currentUser.id:myName;
    if(data.killerUid===uid){
      /* 이미 로컬에서 처리됨 */
    }
    m.deathAnim=0;
    m.hp=0;
  }
  m.hbf.style.width=Math.max(0,(m.hp/m.maxHp)*100)+'%';
}

/* 서버에서 온 몬스터 위치 업데이트 (비호스트) */
function handleMonsterMove(data){
  if(isMonsterHost)return;/* 호스트는 무시 */
  var idx=data.mid;
  if(idx<0||idx>=monsters.length)return;
  var m=monsters[idx];
  if(m.hp>0&&m.deathAnim<0){
    m.mesh.position.x=data.x;
    m.mesh.position.z=data.z;
  }
}

/* 서버에서 온 몬스터 리스폰 */
function handleMonsterRespawn(data){
  if(!data.list)return;
  for(var i=0;i<data.list.length;i++){
    var sm=data.list[i];
    var idx=sm.mid;
    if(idx<0||idx>=monsters.length)continue;
    var m=monsters[idx];
    m.hp=sm.maxHp;m.maxHp=sm.maxHp;
    m.mesh.position.set(sm.x,0,sm.z);
    m.deathAnim=-1;m.state='idle';
    m.mesh.visible=true;m.mesh.scale.set(0,0,0);
    m.spawnAnim=0.6;
    m.wrap.style.display='';
    m.hbf.style.width='100%';
  }
}
