/* ════════════ 멀티플레이어 시스템 (PartyKit) ════════════ */
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
    var uid=(typeof currentUser!=='undefined'&&currentUser&&currentUser.id)?currentUser.id:myName;
    ws.send(JSON.stringify({
      type:'join',uid:uid,name:myName,level:playerLevel,
      x:+PL.group.position.x.toFixed(2),
      z:+PL.group.position.z.toFixed(2),
      ry:+PL.group.rotation.y.toFixed(2)
    }));
    if(mpSendTimer)clearInterval(mpSendTimer);
    mpSendTimer=setInterval(sendPosition,100);
    if(!window._mpFirstConnect){window._mpFirstConnect=true;addChat('sys','[시스템]','멀티플레이 서버에 연결되었습니다.');}
    /* 몬스터 위치 동기화는 서버가 호스트 지정 후 시작 */
  };

  ws.onmessage=function(e){
    /* 몬스터 위치 배치 (경량 문자열 포맷) */
    if(typeof e.data==='string'&&e.data.indexOf('mp|')===0){
      if(!isMonsterHost){
        var parts=e.data.substring(3).split(';');
        for(var i=0;i<parts.length;i++){
          var p=parts[i].split(',');
          var idx=parseInt(p[0]);
          if(idx>=0&&idx<monsters.length&&monsters[idx].hp>0){
            monsters[idx].mesh.position.x=parseFloat(p[1]);
            monsters[idx].mesh.position.z=parseFloat(p[2]);
          }
        }
      }
      return;
    }
    if(typeof e.data==='string'&&e.data==='host'){startMonsterSync();return;}
    var data;
    try{data=JSON.parse(e.data);}catch(er){return;}
    onMpMessage(data);
  };

  ws.onclose=function(){
    console.log('[MP] disconnected');
    if(mpSendTimer){clearInterval(mpSendTimer);mpSendTimer=null;}
    if(monsterPosTmr){clearInterval(monsterPosTmr);monsterPosTmr=null;isMonsterHost=false;}
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
  /* 몬스터 HP 동기화 */
  else if(data.type==='mhp'){
    /* 접속 시 서버의 몬스터 HP 상태 적용 */
    if(data.hp){for(var mid in data.hp){
      var idx=parseInt(mid);
      if(idx>=0&&idx<monsters.length){
        var m=monsters[idx];
        m.hp=data.hp[mid];
        m.hbf.style.width=Math.max(0,m.hp/m.maxHp*100)+'%';
        if(m.hp<=0){m.hp=0;m.deathAnim=0;m.state='dead';m.wrap.style.display='none';}
      }
    }}
  }
  else if(data.type==='mhit'){
    /* 다른 플레이어가 몬스터를 때림 */
    var idx=data.mid;
    if(idx>=0&&idx<monsters.length){
      var m=monsters[idx];
      m.hp=data.hp;
      m.hbf.style.width=Math.max(0,m.hp/m.maxHp*100)+'%';
      if(data.dead&&m.deathAnim<0){m.deathAnim=0.8;m.state='dead';m.wrap.style.display='none';}
    }
  }
  else if(data.type==='mrespawn'){
    var idx=data.mid;
    if(idx>=0&&idx<monsters.length){
      var m=monsters[idx];
      m.hp=data.hp;m.maxHp=data.hp;
      m.mesh.position.set(m.spawnX,0,m.spawnZ);
      m.deathAnim=-1;m.state='idle';
      m.mesh.visible=true;m.mesh.scale.set(0,0,0);
      m.spawnAnim=0.6;
      m.wrap.style.display='';
      m.hbf.style.width='100%';
    }
  }
}

/* ── 몬스터 위치 동기화 (호스트만 전송) ── */
var isMonsterHost=false;
var monsterPosTmr=null;

function startMonsterSync(){
  if(monsterPosTmr)clearInterval(monsterPosTmr);
  isMonsterHost=true;
  monsterPosTmr=setInterval(function(){
    if(!ws||ws.readyState!==1)return;
    var batch=[];
    for(var i=0;i<monsters.length;i++){
      var m=monsters[i];
      if(m.hp<=0||m.deathAnim>=0)continue;
      batch.push(i+','+m.mesh.position.x.toFixed(1)+','+m.mesh.position.z.toFixed(1));
    }
    if(batch.length>0)ws.send('mp|'+batch.join(';'));
  },500);
}

/* ── 원격 플레이어 메쉬 ── */
var REMOTE_BODY_COLOR=0x3a3a8a;
var REMOTE_HEAD_COLOR=0xddcc99;

function spawnRemote(id,name,level,x,z,ry){
  if(remotePlayers[id])return;
  var myUid=(typeof currentUser!=='undefined'&&currentUser&&currentUser.id)?currentUser.id:myName;
  if(id===myUid)return;
  var h=mkHuman(REMOTE_BODY_COLOR,REMOTE_HEAD_COLOR);
  h.group.position.set(x,0,z);
  h.group.rotation.y=ry||0;
  scene.add(h.group);

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
    r.group.position.x+=(r.tx-r.group.position.x)*0.15;
    r.group.position.z+=(r.tz-r.group.position.z)*0.15;
    var dRot=r.try_-r.group.rotation.y;
    if(dRot>Math.PI)dRot-=Math.PI*2;
    if(dRot<-Math.PI)dRot+=Math.PI*2;
    r.group.rotation.y+=dRot*0.1;

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
