/* ════════════ 멀티플레이어 시스템 (PartyKit) ════════════ */
var PARTY_HOST='hwanjang-rpg.woojoo-shim.partykit.dev';
var ws=null;
var remotePlayers={};
var mpSendTimer=null;
var mpReconnectTimer=null;

/* ── 모든 플레이어 위치 (몬스터 AI용) ── */
/* 호스트가 몬스터 AI 계산 시 모든 플레이어 위치를 고려하기 위한 배열 */
var allPlayerPositions=[];

/* 매 프레임 호출 — 로컬 + 원격 플레이어 위치를 배열로 수집 */
function updateAllPlayerPositions(){
  allPlayerPositions=[];
  /* 로컬 플레이어 */
  if(PL&&PL.group){
    var myUid=(typeof currentUser!=='undefined'&&currentUser&&currentUser.id)?currentUser.id:myName;
    allPlayerPositions.push({id:myUid,x:PL.group.position.x,z:PL.group.position.z,local:true});
  }
  /* 원격 플레이어 — 보간된 실제 위치 사용 */
  for(var id in remotePlayers){
    var rp=remotePlayers[id];
    if(rp&&rp.group){
      allPlayerPositions.push({id:id,x:rp.group.position.x,z:rp.group.position.z,local:false});
    }
  }
}

/* 몬스터 위치에서 가장 가까운 플레이어 찾기 (호스트 AI용) */
function findClosestPlayer(mx,mz){
  var best=null,bestD=Infinity;
  for(var i=0;i<allPlayerPositions.length;i++){
    var p=allPlayerPositions[i];
    var dx=p.x-mx,dz=p.z-mz;
    var d=dx*dx+dz*dz;
    if(d<bestD){bestD=d;best=p;}
  }
  return best?{id:best.id,x:best.x,z:best.z,dist:Math.sqrt(bestD),local:best.local}:null;
}

/* Tab — 마크 스타일 플레이어 리스트 (누르고 있는 동안 표시) */
var playerListEl=null;
function showPlayerList(){
  if(!playerListEl){
    playerListEl=document.createElement('div');
    playerListEl.id='player-list-overlay';
    playerListEl.style.cssText='position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.75);border:1px solid #c9a84c44;padding:16px 28px;z-index:9990;min-width:180px;display:none;border-radius:4px;';
    document.body.appendChild(playerListEl);
  }
  var html='<div style="color:#c9a84c;font-size:14px;text-align:center;margin-bottom:10px;letter-spacing:2px;">접속 중인 플레이어</div>';
  /* 자기 자신 */
  html+='<div style="color:#55ff55;font-size:13px;padding:3px 0;">▸ '+myName+' <span style="color:#888;">Lv.'+playerLevel+'</span> <span style="color:#555;">(나)</span></div>';
  /* 원격 플레이어 */
  var count=1;
  for(var id in remotePlayers){
    var rp=remotePlayers[id];
    if(rp&&rp.name){
      html+='<div style="color:#ddd;font-size:13px;padding:3px 0;">▸ '+rp.name+' <span style="color:#888;">Lv.'+(rp.level||'?')+'</span></div>';
      count++;
    }
  }
  html+='<div style="color:#666;font-size:11px;text-align:center;margin-top:8px;border-top:1px solid #333;padding-top:6px;">'+count+'명 접속 중</div>';
  playerListEl.innerHTML=html;
  playerListEl.style.display='block';
}
function hidePlayerList(){
  if(playerListEl)playerListEl.style.display='none';
}
/* keyup에서 Tab 떼면 숨김 */
document.addEventListener('keyup',function(e){
  if(e.key==='Tab')hidePlayerList();
});

function connectParty(){
  if(ws&&ws.readyState<=2)return;/* 연결 중(0), 열림(1), 닫힘 중(2) — 중복 연결 방지 */
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
      ry:+PL.group.rotation.y.toFixed(2),
      cosmetics:{hat:equipped.hat||null,cape:equipped.cape||null,dye:equipped.dye||null},
      minRep:getMinReputation()
    }));
    if(mpSendTimer)clearInterval(mpSendTimer);
    mpSendTimer=setInterval(sendPosition,100);
    if(!window._mpFirstConnect){window._mpFirstConnect=true;addChat('sys','[시스템]','멀티플레이 서버에 연결되었습니다.');}
    /* 15초 후 호스트 메시지도 mp|데이터도 안 오면 자동 호스트 */
    receivedMpData=false;
    if(!isMonsterHost){
      if(window._hostFallbackTmr)clearTimeout(window._hostFallbackTmr);
      window._hostFallbackTmr=setTimeout(function(){
        if(!isMonsterHost&&!receivedMpData){startMonsterSync();console.log('[MP] self-host fallback');}
      },15000);
    }
  };

  ws.onmessage=function(e){
    /* 몬스터 위치 배치 (경량 문자열 포맷) */
    /* 호스트 몬스터 위치 수신: idx,x,z,state,targetId */
    if(typeof e.data==='string'&&e.data.indexOf('mp|')===0){
      receivedMpData=true;
      if(window._hostFallbackTmr){clearTimeout(window._hostFallbackTmr);window._hostFallbackTmr=null;}
      if(!isMonsterHost){
        var parts=e.data.substring(3).split(';');
        for(var i=0;i<parts.length;i++){
          var p=parts[i].split(',');
          var idx=parseInt(p[0]);
          if(idx>=0&&idx<monsters.length&&monsters[idx].hp>0){
            /* 신 포맷: idx,x,y,z,ry,state,tid (7개) / 구 포맷: idx,x,z,state,tid (5개) */
            if(p.length>=7){
              monsters[idx]._targetX=parseFloat(p[1]);
              monsters[idx]._targetY=parseFloat(p[2]);
              monsters[idx]._targetZ=parseFloat(p[3]);
              monsters[idx]._targetRy=parseFloat(p[4]);
              monsters[idx]._syncState=p[5]||'idle';
              monsters[idx]._targetPlayerId=p[6]||'';
            }else{
              monsters[idx]._targetX=parseFloat(p[1]);
              monsters[idx]._targetZ=parseFloat(p[2]);
              monsters[idx]._syncState=p[3]||'idle';
              monsters[idx]._targetPlayerId=p[4]||'';
            }
          }
        }
      }
      return;
    }
    if(typeof e.data==='string'&&e.data==='host'){
      if(window._hostFallbackTmr){clearTimeout(window._hostFallbackTmr);window._hostFallbackTmr=null;}
      startMonsterSync();return;
    }
    var data;
    try{data=JSON.parse(e.data);}catch(er){return;}
    onMpMessage(data);
  };

  ws.onclose=function(e){
    console.log('[MP] disconnected code:',e.code);
    if(mpSendTimer){clearInterval(mpSendTimer);mpSendTimer=null;}
    if(monsterPosTmr){clearInterval(monsterPosTmr);monsterPosTmr=null;isMonsterHost=false;}
    /* 항상 재연결 */
    if(mpReconnectTimer)clearTimeout(mpReconnectTimer);
    mpReconnectTimer=setTimeout(connectParty,3000);
  };

  ws.onerror=function(e){console.warn('[MP] ws error',e);};
}

var _lastSentX=0,_lastSentY=0,_lastSentZ=0,_lastSentRy=0,_lastSentMoving=false;
function sendPosition(){
  if(!ws||ws.readyState!==1||!PL.group)return;
  var x=+PL.group.position.x.toFixed(2);
  var y=+PL.group.position.y.toFixed(2);
  var z=+PL.group.position.z.toFixed(2);
  var ry=+PL.group.rotation.y.toFixed(2);
  var mv=!!(keys['w']||keys['s']||keys['a']||keys['d']||keys['arrowup']||keys['arrowdown']||keys['arrowleft']||keys['arrowright']);
  /* 변화 없으면 안 보냄 */
  if(x===_lastSentX&&y===_lastSentY&&z===_lastSentZ&&ry===_lastSentRy&&mv===_lastSentMoving)return;
  _lastSentX=x;_lastSentY=y;_lastSentZ=z;_lastSentRy=ry;_lastSentMoving=mv;
  ws.send(JSON.stringify({type:'move',x:x,y:y,z:z,ry:ry,moving:mv}));
}

function sendCosmeticUpdate(){
  if(!ws||ws.readyState!==1)return;
  ws.send(JSON.stringify({type:'cosmetic_update',cosmetics:{hat:equipped.hat||null,cape:equipped.cape||null,dye:equipped.dye||null}}));
}

function sendRepUpdate(){
  if(!ws||ws.readyState!==1)return;
  ws.send(JSON.stringify({type:'rep_update',minRep:getMinReputation()}));
}

function onMpMessage(data){
  if(data.type==='init'){
    for(var id in data.players){
      var p=data.players[id];
      spawnRemote(id,p.name,p.level,p.x,p.z,p.ry,p.y);
      if(remotePlayers[id]){
        if(p.cosmetics)applyRemoteCosmetics(remotePlayers[id],p.cosmetics);
        if(p.minRep!==undefined)remotePlayers[id].minRep=p.minRep;
      }
    }
  }
  else if(data.type==='join'){
    var isNew=!remotePlayers[data.id];
    spawnRemote(data.id,data.name,data.level,data.x,data.z,data.ry,data.y);
    if(remotePlayers[data.id]){
      if(data.cosmetics)applyRemoteCosmetics(remotePlayers[data.id],data.cosmetics);
      if(data.minRep!==undefined)remotePlayers[data.id].minRep=data.minRep;
    }
    if(isNew)addChat('sys','[시스템]',data.name+'이(가) 접속했습니다.');
  }
  else if(data.type==='rep_update'){
    var r=remotePlayers[data.id];
    if(r)r.minRep=data.minRep;
  }
  else if(data.type==='move'){
    var r=remotePlayers[data.id];
    if(!r)return;
    r.tx=data.x;r.ty=(data.y!==undefined?data.y:0);r.tz=data.z;r.try_=data.ry;r.moving=data.moving;
  }
  else if(data.type==='cosmetic_update'){
    var r=remotePlayers[data.id];
    if(r&&data.cosmetics)applyRemoteCosmetics(r,data.cosmetics);
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
      var _mry=(typeof getTerrainY==='function')?getTerrainY(m.spawnX,m.spawnZ):0;
      m.mesh.position.set(m.spawnX,_mry,m.spawnZ);
      m.deathAnim=-1;m.state='idle';
      m.mesh.visible=true;m.mesh.scale.set(0,0,0);
      m.spawnAnim=0.6;
      m.wrap.style.display='';
      m.hbf.style.width='100%';
    }
  }
  /* 호스트가 보낸 몬스터→플레이어 데미지 (비호스트가 받음) */
  else if(data.type==='mdmg'){
    /* data: {target, mid, dmg, effects:[{type,val}]} */
    var myUid2=(typeof currentUser!=='undefined'&&currentUser&&currentUser.id)?currentUser.id:myName;
    if(!isMonsterHost&&data.target===myUid2&&data.mid>=0&&data.mid<monsters.length){
      var m=monsters[data.mid];
      if(m&&m.hp>0&&invincibleTimer<=0){
        var dmg=data.dmg||0;
        playerHP=Math.max(0,playerHP-dmg);
        updPlayerHpBar();spawnDmgNum('-'+dmg,'#ff5555');
        /* 특수 효과 적용 */
        if(data.effects){
          for(var ei=0;ei<data.effects.length;ei++){
            var eff=data.effects[ei];
            if(eff.type==='poison'&&!playerPoisoned){
              playerPoisoned=3;playerPoisonDmg=eff.val;
              spawnDmgNum('독!','#44ff44');addChat('inf','','독에 걸렸다!');
            }
            if(eff.type==='slow'){playerSlowed=eff.val;spawnDmgNum('둔화!','#22aa22');}
            if(eff.type==='lava'){spawnLavaPool(m.mesh.position.x,m.mesh.position.z,6,4);spawnDmgNum('용암 강타!','#ff4400');}
            if(eff.type==='combo'){spawnDmgNum('연속!','#ffaa00');}
            if(eff.type==='drain'){spawnDmgNum('흡혈!','#ff00aa');}
            if(eff.type==='root'){playerSlowed=3;spawnDmgNum('속박!','#228833');addChat('inf','','뿌리에 발이 묶였다!');}
            if(eff.type==='breath'){
              var bdx=PL.group.position.x-m.mesh.position.x,bdz=PL.group.position.z-m.mesh.position.z;
              var blen=Math.sqrt(bdx*bdx+bdz*bdz);
              if(blen>0.1){bdx/=blen;bdz/=blen;}
              spawnFireBreath(m.mesh.position.x,m.mesh.position.z,bdx,bdz,15);
              spawnDmgNum('화염 브레스!','#ff6600');
            }
          }
        }
        if(playerHP<=0)playerDied();
        else if(typeof checkBerserkerSpawn==='function')checkBerserkerSpawn();
      }
    }
  }
  /* ── 파티 메시지 ── */
  else if(data.type==='party_invite'){onPartyInvite(data);}
  else if(data.type==='party_accept'){onPartyAccept(data);}
  else if(data.type==='party_reject'){onPartyReject(data);}
  else if(data.type==='party_update'){
    if(data.disband){
      if(data.partyId===partyId){
        addChat('sys','[파티]','파티가 해산되었습니다.');
        partyId=null;partyLeader=null;partyMembers=[];
        updatePartyUI();
      }
    }else{onPartyUpdate(data);}
  }
  else if(data.type==='party_kick'){onPartyKick(data);}
  else if(data.type==='party_leave'){onPartyLeave(data);}
  else if(data.type==='party_hp'){onPartyHp(data);}
  else if(data.type==='party_chat'){onPartyChat(data);}
}

/* 호스트 → 비호스트: 몬스터가 원격 플레이어를 공격했음을 알림 */
function sendMonsterDamage(targetId,monsterIdx,dmg,effects){
  if(!ws||ws.readyState!==1)return;
  ws.send(JSON.stringify({type:'mdmg',target:targetId,mid:monsterIdx,dmg:dmg,effects:effects||[]}));
}

/* ── 몬스터 위치 동기화 (호스트만 전송) ── */
var isMonsterHost=false;
var monsterPosTmr=null;
var receivedMpData=false;/* mp| 메시지를 받은 적 있는지 */

function startMonsterSync(){
  if(monsterPosTmr)clearInterval(monsterPosTmr);
  isMonsterHost=true;
  monsterPosTmr=setInterval(function(){
    if(!ws||ws.readyState!==1)return;
    var batch=[];
    for(var i=0;i<monsters.length;i++){
      var m=monsters[i];
      if(m.hp<=0||m.deathAnim>=0)continue;
      /* 포맷: idx,x,y,z,ry,state,targetPlayerId */
      var tid=m._chaseTargetId||'';
      batch.push(i+','+m.mesh.position.x.toFixed(1)+','+m.mesh.position.y.toFixed(1)+','+m.mesh.position.z.toFixed(1)+','+m.mesh.rotation.y.toFixed(2)+','+m.state+','+tid);
    }
    if(batch.length>0)ws.send('mp|'+batch.join(';'));
  },200);
}

/* ── 원격 플레이어 메쉬 ── */
var REMOTE_BODY_COLOR=0x3a3a8a;
var REMOTE_HEAD_COLOR=0xddcc99;

function spawnRemote(id,name,level,x,z,ry,y){
  if(remotePlayers[id]){
    /* 이미 존재하면 무시 — move 메시지가 더 정확 */
    return;
  }
  var myUid=(typeof currentUser!=='undefined'&&currentUser&&currentUser.id)?currentUser.id:myName;
  if(id===myUid)return;
  var h=mkHuman(REMOTE_BODY_COLOR,REMOTE_HEAD_COLOR);
  var _initY=(y!==undefined&&y!==null)?y:((typeof getTerrainY==='function')?getTerrainY(x,z):0);
  h.group.position.set(x,_initY,z);
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
    group:h.group,head:h.head,body:h.body,bodyMat:h.bodyMat,
    legL:h.legL,legR:h.legR,
    armL:h.armL,armRPivot:h.armRPivot,
    nameEl:ne,
    tx:x,ty:_initY,tz:z,try_:ry||0,
    bobT:0,moving:false,
    atkPhase:0,atkTimer:0,
    hatMesh:null,capeMesh:null
  };
}

function applyRemoteCosmetics(r,cosmetics){
  if(!r||!r.group)return;
  /* 기존 코스메틱 제거 */
  if(r.hatMesh){r.head.remove(r.hatMesh);r.hatMesh=null;}
  if(r.capeMesh){r.group.remove(r.capeMesh);r.capeMesh=null;}
  /* 염색 */
  if(cosmetics.dye){
    var dyeDef=(typeof getItemDef==='function')?getItemDef(cosmetics.dye):null;
    if(dyeDef&&dyeDef.color&&r.bodyMat)r.bodyMat.color.set(dyeDef.color);
  } else {
    if(r.bodyMat)r.bodyMat.color.set(REMOTE_BODY_COLOR);
  }
  /* 모자: 간단한 표현 (wizard=cone, crown=cylinder, bunny=boxes, santa=cone, knight=box) */
  if(cosmetics.hat){
    var hatDef=(typeof getItemDef==='function')?getItemDef(cosmetics.hat):null;
    if(hatDef&&r.head){
      var hColor=hatDef.color?parseInt(hatDef.color.replace('#','0x')):0xffffff;
      var hm2=new THREE.MeshLambertMaterial({color:hColor});
      var hg=new THREE.Group();
      if(cosmetics.hat==='wizard_hat'){
        var c2=new THREE.Mesh(new THREE.ConeGeometry(.18,.45,8),hm2);c2.position.set(0,.28,0);hg.add(c2);
        var b2=new THREE.Mesh(new THREE.CylinderGeometry(.28,.28,.04,8),hm2);b2.position.set(0,.06,0);hg.add(b2);
      } else if(cosmetics.hat==='crown'){
        var cb=new THREE.Mesh(new THREE.CylinderGeometry(.22,.22,.1,8),hm2);cb.position.set(0,.06,0);hg.add(cb);
        for(var si=0;si<5;si++){var ang=si/5*Math.PI*2;var sp=new THREE.Mesh(new THREE.CylinderGeometry(.02,.04,.12,4),hm2);sp.position.set(Math.cos(ang)*.14,.15,Math.sin(ang)*.14);hg.add(sp);}
      } else if(cosmetics.hat==='bunny_ears'){
        var el=new THREE.Mesh(new THREE.BoxGeometry(.07,.3,.05),hm2);el.position.set(-.12,.28,0);hg.add(el);
        var er=new THREE.Mesh(new THREE.BoxGeometry(.07,.3,.05),hm2);er.position.set(.12,.28,0);hg.add(er);
      } else if(cosmetics.hat==='santa_hat'){
        var sr=new THREE.Mesh(new THREE.CylinderGeometry(.26,.26,.06,8),new THREE.MeshLambertMaterial({color:0xffffff}));sr.position.set(0,.04,0);hg.add(sr);
        var sc=new THREE.Mesh(new THREE.ConeGeometry(.2,.38,8),hm2);sc.position.set(.04,.3,0);sc.rotation.z=-.2;hg.add(sc);
      } else if(cosmetics.hat==='knight_helm'){
        var kh=new THREE.Mesh(new THREE.BoxGeometry(.44,.42,.44),hm2);kh.position.set(0,.2,0);hg.add(kh);
      }
      hg.position.set(0,.22,0);
      r.head.add(hg);r.hatMesh=hg;
    }
  }
  /* 망토 */
  if(cosmetics.cape){
    var capeDef2=(typeof getItemDef==='function')?getItemDef(cosmetics.cape):null;
    if(capeDef2){
      var cc=capeDef2.color?parseInt(capeDef2.color.replace('#','0x')):0xcc2222;
      var isSh=(cosmetics.cape==='shadow_cape');
      var cm2=new THREE.MeshLambertMaterial({color:cc,transparent:isSh,opacity:isSh?.55:1.0,side:THREE.DoubleSide});
      var cg=new THREE.Group();
      var ct=new THREE.Mesh(new THREE.BoxGeometry(.45,.08,.04),cm2);ct.position.set(0,0,0);cg.add(ct);
      var cm3=new THREE.Mesh(new THREE.BoxGeometry(.5,.4,.04),cm2);cm3.position.set(0,-.25,0);cg.add(cm3);
      var cb2=new THREE.Mesh(new THREE.BoxGeometry(.58,.3,.04),cm2);cb2.position.set(0,-.55,0);cg.add(cb2);
      cg.position.set(0,1.35,-.22);
      r.group.add(cg);r.capeMesh=cg;
    }
  }
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

    var baseY=(r.ty!==undefined?r.ty:0);
    r.group.position.y+=(baseY-r.group.position.y)*0.25;
    if(r.moving){
      r.bobT+=dt*9;
      var wa=0.32;
      r.legL.rotation.x=Math.sin(r.bobT)*wa;
      r.legR.rotation.x=-Math.sin(r.bobT)*wa;
      r.armL.rotation.x=-Math.sin(r.bobT)*wa*0.5;
      if(r.atkPhase===0)r.armRPivot.rotation.x=Math.sin(r.bobT)*wa*0.5;
    }else{
      r.legL.rotation.x*=0.8;r.legR.rotation.x*=0.8;
      r.armL.rotation.x*=0.8;
      if(r.atkPhase===0)r.armRPivot.rotation.x*=0.8;
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

    /* 이름표: 30유닛 이내만 표시 */
    var pdx=PL.group.position.x-r.group.position.x,pdz=PL.group.position.z-r.group.position.z;
    var pdist=Math.sqrt(pdx*pdx+pdz*pdz);
    if(pdist<30){
      r.nameEl.style.display='';
      /* 적대(호감도 20 미만) 표시 */
      var baseName=r.name+' Lv.'+r.level;
      if(r.minRep!==undefined&&r.minRep<20){
        r.nameEl.innerHTML=baseName+' <span style="color:#ff4444;font-size:10px;">😡 적대 '+r.minRep+'</span>';
        r.nameEl.style.color='#ff6666';
      }else{
        r.nameEl.textContent=baseName;
        r.nameEl.style.color='';
      }
      posEl(r.nameEl,r.group.position.x,r.group.position.y+2.4,r.group.position.z);
    }else{
      r.nameEl.style.display='none';
    }
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

/* ════════════ 파티 시스템 ════════════ */
var partyId=null;
var partyMembers=[];   /* [{uid,name,level,hp,maxHp}] */
var partyLeader=null;
var PARTY_MAX=4;
var _pendingInvite=null; /* {from,fromName,partyId} */
var _partyInviteTimeout=null;

function getMyUid(){
  return (typeof currentUser!=='undefined'&&currentUser&&currentUser.id)?currentUser.id:myName;
}

/* 가장 가까운 원격 플레이어 찾기 (15유닛 이내) */
function findClosestRemotePlayer(){
  if(!PL||!PL.group)return null;
  var px=PL.group.position.x,pz=PL.group.position.z;
  var best=null,bestD=Infinity;
  for(var id in remotePlayers){
    var rp=remotePlayers[id];
    if(!rp||!rp.group)continue;
    var dx=rp.group.position.x-px,dz=rp.group.position.z-pz;
    var d=Math.sqrt(dx*dx+dz*dz);
    if(d<15&&d<bestD){bestD=d;best={uid:id,name:rp.name,level:rp.level,dist:d};}
  }
  return best;
}

/* V키 — 가까운 플레이어 파티 초대 */
function inviteToParty(){
  if(partyMembers.length>=PARTY_MAX){addChat('sys','[파티]','파티가 가득 찼습니다. (최대 '+PARTY_MAX+'명)');return;}
  var target=findClosestRemotePlayer();
  if(!target){addChat('sys','[파티]','근처에 초대할 플레이어가 없습니다.');return;}
  /* 이미 파티원인지 확인 */
  for(var i=0;i<partyMembers.length;i++){
    if(partyMembers[i].uid===target.uid){addChat('sys','[파티]',target.name+'은(는) 이미 파티원입니다.');return;}
  }
  var myUid=getMyUid();
  if(partyId&&partyLeader!==myUid){addChat('sys','[파티]','파티장만 초대할 수 있습니다.');return;}
  if(!ws||ws.readyState!==1){addChat('sys','[파티]','서버에 연결되어 있지 않습니다.');return;}
  var invitePartyId=partyId||(myUid+'_'+Date.now());
  ws.send(JSON.stringify({type:'party_invite',target:target.uid,partyId:invitePartyId,fromName:myName,fromUid:myUid}));
  addChat('sys','[파티]',target.name+'에게 파티 초대를 보냈습니다.');
  if(!partyId)_pendingSentInvitePartyId=invitePartyId;
}

/* 닉네임으로 파티 초대 */
function inviteByName(targetName){
  if(partyMembers.length>=PARTY_MAX){addChat('sys','[파티]','파티가 가득 찼습니다.');return;}
  var target=null;
  for(var uid in remotePlayers){
    if(remotePlayers[uid]&&remotePlayers[uid].name===targetName){target={uid:uid,name:targetName};break;}
  }
  if(!target){addChat('sys','[파티]','\''+targetName+'\' 플레이어를 찾을 수 없습니다.');return;}
  for(var i=0;i<partyMembers.length;i++){
    if(partyMembers[i].uid===target.uid){addChat('sys','[파티]',target.name+'은(는) 이미 파티원입니다.');return;}
  }
  var myUid=getMyUid();
  if(partyId&&partyLeader!==myUid){addChat('sys','[파티]','파티장만 초대할 수 있습니다.');return;}
  if(!ws||ws.readyState!==1){addChat('sys','[파티]','서버에 연결되어 있지 않습니다.');return;}
  var invitePartyId=partyId||(myUid+'_'+Date.now());
  ws.send(JSON.stringify({type:'party_invite',target:target.uid,partyId:invitePartyId,fromName:myName,fromUid:myUid}));
  addChat('sys','[파티]',target.name+'에게 파티 초대를 보냈습니다.');
  if(!partyId)_pendingSentInvitePartyId=invitePartyId;
}

/* 파티 초대 수신 */
function onPartyInvite(data){
  /* data: {from, fromName, partyId} */
  if(partyId&&partyMembers.length>0){return;} /* 이미 파티 중 */
  _pendingInvite={from:data.from,fromName:data.fromName,partyId:data.partyId};
  showPartyInviteNotif(data.fromName);
}

function showPartyInviteNotif(fromName){
  var el=document.getElementById('party-invite-notif');
  document.getElementById('party-invite-name').textContent=fromName+'님이 파티 초대';
  el.classList.add('show');
  if(_partyInviteTimeout)clearTimeout(_partyInviteTimeout);
  _partyInviteTimeout=setTimeout(function(){rejectPartyInvite();},15000);
}

function acceptPartyInvite(){
  if(!_pendingInvite)return;
  document.getElementById('party-invite-notif').classList.remove('show');
  if(_partyInviteTimeout){clearTimeout(_partyInviteTimeout);_partyInviteTimeout=null;}
  if(!ws||ws.readyState!==1)return;
  ws.send(JSON.stringify({type:'party_accept',partyId:_pendingInvite.partyId,target:_pendingInvite.from,name:myName,level:playerLevel,hp:playerHP,maxHp:playerMaxHP}));
  partyId=_pendingInvite.partyId;
  partyLeader=_pendingInvite.from;
  addChat('sys','[파티]',_pendingInvite.fromName+'의 파티에 참가했습니다.');
  _pendingInvite=null;
}

function rejectPartyInvite(){
  if(!_pendingInvite)return;
  document.getElementById('party-invite-notif').classList.remove('show');
  if(_partyInviteTimeout){clearTimeout(_partyInviteTimeout);_partyInviteTimeout=null;}
  if(ws&&ws.readyState===1){
    ws.send(JSON.stringify({type:'party_reject',target:_pendingInvite.from,name:myName}));
  }
  _pendingInvite=null;
}

/* 파티 수락 수신 (리더가 받음) */
function onPartyAccept(data){
  /* data: {from, name, level, hp, maxHp, partyId} */
  /* 파티가 아직 없으면 지금 생성 (초대 보낸 사람) */
  var myUid=getMyUid();
  if(!partyId&&_pendingSentInvitePartyId&&data.partyId===_pendingSentInvitePartyId){
    partyId=_pendingSentInvitePartyId;
    partyLeader=myUid;
    partyMembers=[{uid:myUid,name:myName,level:playerLevel,hp:playerHP,maxHp:playerMaxHP}];
    _pendingSentInvitePartyId=null;
  }
  if(data.partyId!==partyId)return;
  if(partyMembers.length>=PARTY_MAX)return;
  /* 중복 체크 */
  for(var i=0;i<partyMembers.length;i++){if(partyMembers[i].uid===data.from)return;}
  partyMembers.push({uid:data.from,name:data.name,level:data.level,hp:data.hp||100,maxHp:data.maxHp||100});
  addChat('sys','[파티]',data.name+'이(가) 파티에 참가했습니다.');
  broadcastPartyUpdate();
}

/* 파티 거절 수신 */
function onPartyReject(data){
  addChat('sys','[파티]',data.name+'이(가) 파티 초대를 거절했습니다.');
}

/* 파티 상태 브로드캐스트 (리더 → 전체) */
function broadcastPartyUpdate(){
  if(!ws||ws.readyState!==1)return;
  ws.send(JSON.stringify({type:'party_update',partyId:partyId,leader:partyLeader,members:partyMembers}));
  updatePartyUI();
}

/* 파티 업데이트 수신 */
function onPartyUpdate(data){
  /* data: {partyId, leader, members:[{uid,name,level,hp,maxHp}]} */
  partyId=data.partyId;
  partyLeader=data.leader;
  partyMembers=data.members;
  updatePartyUI();
}

/* 파티 탈퇴 */
function leaveParty(){
  if(!partyId)return;
  var myUid=getMyUid();
  if(ws&&ws.readyState===1){
    ws.send(JSON.stringify({type:'party_leave',partyId:partyId,name:myName}));
  }
  addChat('sys','[파티]','파티에서 탈퇴했습니다.');
  /* 리더가 나가면 파티 해산 */
  if(partyLeader===myUid){
    if(ws&&ws.readyState===1){
      ws.send(JSON.stringify({type:'party_update',partyId:partyId,leader:null,members:[],disband:true}));
    }
  }
  partyId=null;partyLeader=null;partyMembers=[];
  updatePartyUI();
}

/* 파티원 추방 (리더만) */
function kickPartyMember(uid){
  var myUid=getMyUid();
  if(partyLeader!==myUid){addChat('sys','[파티]','파티장만 추방할 수 있습니다.');return;}
  if(uid===myUid)return;
  /* 멤버 제거 */
  var kicked=null;
  partyMembers=partyMembers.filter(function(m){if(m.uid===uid){kicked=m;return false;}return true;});
  if(kicked){
    addChat('sys','[파티]',kicked.name+'을(를) 파티에서 추방했습니다.');
    if(ws&&ws.readyState===1){
      ws.send(JSON.stringify({type:'party_kick',partyId:partyId,target:uid,name:kicked.name}));
    }
    broadcastPartyUpdate();
  }
}

/* 추방 수신 */
function onPartyKick(data){
  var myUid=getMyUid();
  if(data.target===myUid){
    addChat('sys','[파티]','파티에서 추방되었습니다.');
    partyId=null;partyLeader=null;partyMembers=[];
    updatePartyUI();
  }
}

/* 파티 탈퇴 수신 */
function onPartyLeave(data){
  /* data: {from, name, partyId} */
  if(data.partyId!==partyId)return;
  partyMembers=partyMembers.filter(function(m){return m.uid!==data.from;});
  addChat('sys','[파티]',data.name+'이(가) 파티를 떠났습니다.');
  /* 파티원이 1명 이하면 해산 */
  if(partyMembers.length<=1){
    addChat('sys','[파티]','파티가 해산되었습니다.');
    partyId=null;partyLeader=null;partyMembers=[];
  }else{
    broadcastPartyUpdate();
  }
  updatePartyUI();
}

/* 파티 UI 갱신 */
function updatePartyUI(){
  var panel=document.getElementById('party-panel');
  var list=document.getElementById('party-members');
  if(!partyId||partyMembers.length===0){
    panel.style.display='none';
    return;
  }
  panel.style.display='block';
  var myUid=getMyUid();
  var html='';
  for(var i=0;i<partyMembers.length;i++){
    var m=partyMembers[i];
    var isMe=m.uid===myUid;
    var isLeader=m.uid===partyLeader;
    var hpPct=Math.max(0,Math.min(100,(m.hp/m.maxHp)*100));
    html+='<div class="party-member'+(isMe?' me':'')+'">';
    html+='<div class="pm-top">';
    if(isLeader)html+='<span class="pm-crown">★</span>';
    html+='<span class="pm-name">'+m.name+'</span>';
    html+='<span class="pm-lv">Lv.'+m.level+'</span>';
    if(!isMe&&partyLeader===myUid)html+='<span class="pm-kick" onclick="kickPartyMember(\''+m.uid+'\')">✕</span>';
    html+='</div>';
    html+='<div class="pm-hpbar"><div class="pm-hpfill" style="width:'+hpPct+'%"></div></div>';
    html+='</div>';
  }
  list.innerHTML=html;
}

/* 주기적으로 파티원 HP 전송 (500ms마다) */
var _partyHpTimer=null;
function startPartyHpSync(){
  if(_partyHpTimer)clearInterval(_partyHpTimer);
  _partyHpTimer=setInterval(function(){
    if(!partyId||!ws||ws.readyState!==1)return;
    ws.send(JSON.stringify({type:'party_hp',partyId:partyId,hp:playerHP,maxHp:playerMaxHP,level:playerLevel}));
  },500);
}
startPartyHpSync();

/* 파티원 HP 수신 */
function onPartyHp(data){
  if(data.partyId!==partyId)return;
  for(var i=0;i<partyMembers.length;i++){
    if(partyMembers[i].uid===data.from){
      partyMembers[i].hp=data.hp;
      partyMembers[i].maxHp=data.maxHp;
      partyMembers[i].level=data.level;
      break;
    }
  }
  /* 내 HP도 갱신 */
  var myUid=getMyUid();
  for(var i=0;i<partyMembers.length;i++){
    if(partyMembers[i].uid===myUid){
      partyMembers[i].hp=playerHP;
      partyMembers[i].maxHp=playerMaxHP;
      partyMembers[i].level=playerLevel;
      break;
    }
  }
  updatePartyUI();
}

/* 파티 EXP 분배: 파티원 수로 나누되 보너스 10% */
function getPartyExpShare(baseExp){
  if(!partyId||partyMembers.length<=1)return baseExp;
  var share=Math.ceil(baseExp/partyMembers.length*1.1);
  return share;
}

/* 파티 채팅 전송 */
function sendPartyChatMP(name,text){
  if(!ws||ws.readyState!==1||!partyId)return;
  ws.send(JSON.stringify({type:'party_chat',partyId:partyId,name:name,text:text}));
}

/* 파티 채팅 수신 */
function onPartyChat(data){
  if(data.partyId!==partyId)return;
  addChat('plr','[파티] '+data.name,data.text);
}

/* ════════════ 파티 초대 패널 (P키) ════════════ */
var partyInvitePanelOpen=false;

function openPartyInvitePanel(){
  var panel=document.getElementById('party-invite-panel');
  if(!panel)return;
  partyInvitePanelOpen=true;
  refreshPartyInvitePanel();
  panel.classList.add('show');
}

function closePartyInvitePanel(){
  var panel=document.getElementById('party-invite-panel');
  if(!panel)return;
  partyInvitePanelOpen=false;
  panel.classList.remove('show');
}

function togglePartyInvitePanel(){
  if(partyInvitePanelOpen)closePartyInvitePanel();
  else openPartyInvitePanel();
}

function refreshPartyInvitePanel(){
  var list=document.getElementById('pip-list');
  var empty=document.getElementById('pip-empty');
  var countEl=document.getElementById('pip-count');
  if(!list)return;

  var myUid=getMyUid();
  var html='';
  var count=1; /* 자기 자신 포함 */

  /* 자기 자신 */
  html+='<div class="pip-row">';
  html+='<span class="pip-row-name" style="color:#90ffa0;">'+myName+'</span>';
  html+='<span class="pip-row-lv">Lv.'+playerLevel+'</span>';
  html+='<span class="pip-row-me">(나)</span>';
  html+='</div>';

  /* 원격 플레이어 */
  var hasRemote=false;
  for(var id in remotePlayers){
    var rp=remotePlayers[id];
    if(!rp||!rp.name)continue;
    hasRemote=true;
    count++;

    /* 이미 파티원인지 확인 */
    var inParty=false;
    for(var i=0;i<partyMembers.length;i++){
      if(partyMembers[i].uid===id){inParty=true;break;}
    }

    html+='<div class="pip-row">';
    html+='<span class="pip-row-name">'+rp.name+'</span>';
    html+='<span class="pip-row-lv">Lv.'+(rp.level||'?')+'</span>';
    if(inParty){
      html+='<span class="pip-check">✓</span>';
    }else{
      html+='<button class="pip-invite-btn" onclick="inviteByUid(\''+id+'\')">+</button>';
    }
    html+='</div>';
  }

  list.innerHTML=html;
  if(countEl)countEl.textContent=count+'명 접속 중';

  /* 원격 플레이어 없으면 빈 메시지 표시 */
  if(empty){
    empty.style.display=hasRemote?'none':'block';
  }
}

/* uid로 파티 초대 (패널에서 [+] 클릭 시) */
function inviteByUid(targetUid){
  var rp=remotePlayers[targetUid];
  if(!rp){addChat('sys','[파티]','플레이어를 찾을 수 없습니다.');return;}
  if(partyMembers.length>=PARTY_MAX){addChat('sys','[파티]','파티가 가득 찼습니다. (최대 '+PARTY_MAX+'명)');return;}
  /* 이미 파티원인지 확인 */
  for(var i=0;i<partyMembers.length;i++){
    if(partyMembers[i].uid===targetUid){addChat('sys','[파티]',rp.name+'은(는) 이미 파티원입니다.');return;}
  }
  /* 이미 다른 파티에 소속되어있고 리더가 아니면 초대 불가 */
  var myUid=getMyUid();
  if(partyId&&partyLeader!==myUid){addChat('sys','[파티]','파티장만 초대할 수 있습니다.');return;}
  if(!ws||ws.readyState!==1){addChat('sys','[파티]','서버에 연결되어 있지 않습니다.');return;}
  /* 파티 없으면 임시 ID 생성 (수락 시 확정) */
  var invitePartyId=partyId||(myUid+'_'+Date.now());
  ws.send(JSON.stringify({type:'party_invite',target:targetUid,partyId:invitePartyId,fromName:myName,fromUid:myUid}));
  addChat('sys','[파티]',rp.name+'에게 파티 초대를 보냈습니다.');
  /* 아직 파티 생성 안 함 — 수락 시 생성 */
  if(!partyId){
    _pendingSentInvitePartyId=invitePartyId;
  }
  refreshPartyInvitePanel();
}
var _pendingSentInvitePartyId=null;
