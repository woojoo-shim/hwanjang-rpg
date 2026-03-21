/* ════════════ 멀티플레이어 시스템 (PartyKit) ════════════ */
/* 의존: config.js, ui.js (addChat, posEl), world.js (mkHuman, scene),
         player.js (PL), main.js (myName, keys, cYaw)
   선언: PARTY_HOST, ws, remotePlayers, connectParty, updateRemotePlayers, sendChatMP, sendAttackMP */

var PARTY_HOST='hwanjang-rpg.woojoo-shim.partykit.dev';
var ws=null;
var remotePlayers={};
var mpSendTimer=null;
var mpReconnectTimer=null;

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
    addChat('sys','[시스템]','멀티플레이 서버에 연결되었습니다.');
  };

  ws.onmessage=function(e){
    var data;
    try{data=JSON.parse(e.data);}catch(er){return;}
    onMpMessage(data);
  };

  ws.onclose=function(){
    console.log('[MP] disconnected');
    if(mpSendTimer){clearInterval(mpSendTimer);mpSendTimer=null;}
    /* 5초 후 재연결 */
    if(mpReconnectTimer)clearTimeout(mpReconnectTimer);
    mpReconnectTimer=setTimeout(connectParty,5000);
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
    removeRemote(data.id);
  }
}

/* ── 원격 플레이어 메쉬 ── */
var REMOTE_BODY_COLOR=0x3a3a8a;
var REMOTE_HEAD_COLOR=0xddcc99;

function spawnRemote(id,name,level,x,z,ry){
  if(remotePlayers[id])return;
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
    r.group.position.x+=(r.tx-r.group.position.x)*0.15;
    r.group.position.z+=(r.tz-r.group.position.z)*0.15;
    /* 회전 보간 */
    var dRot=r.try_-r.group.rotation.y;
    if(dRot>Math.PI)dRot-=Math.PI*2;
    if(dRot<-Math.PI)dRot+=Math.PI*2;
    r.group.rotation.y+=dRot*0.1;

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
