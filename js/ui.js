/* ════════════ UI 유틸리티 ════════════ */
/* 의존: config.js (없음)
   선언: addChat, spawnDmgNum, showToast, _v3, proj, posEl, updLabels
   참조: camera (world.js), PL (player.js), npcs/closestNpc (world.js) — 런타임 참조 */

var _chatLog=null;/* clog DOM 캐시 */
var _CHAT_MAX=200;/* 최대 채팅 줄 수 — 메모리 누수 방지 */
function addChat(tp,w,tx){
  if(!_chatLog)_chatLog=document.getElementById('clog');
  var d=document.createElement('div');d.className='cm '+tp;
  if(tp==='inf')d.textContent=tx;
  else d.innerHTML='<span class="who">'+w+'</span><span class="tx">'+tx+'</span>';
  _chatLog.appendChild(d);
  /* 오래된 메시지 제거 (메모리 누수 방지) */
  while(_chatLog.children.length>_CHAT_MAX)_chatLog.removeChild(_chatLog.firstChild);
  _chatLog.scrollTop=_chatLog.scrollHeight;
}

/* ── 피격 빨간 플래시 (마크 스타일) ── */
var _hitOverlay=null;
function flashPlayerHit(){
  if(!_hitOverlay){
    _hitOverlay=document.createElement('div');
    _hitOverlay.style.cssText='position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(255,0,0,0.35);pointer-events:none;z-index:9999;opacity:0;transition:opacity 0.08s;';
    document.body.appendChild(_hitOverlay);
  }
  _hitOverlay.style.opacity='1';
  setTimeout(function(){_hitOverlay.style.opacity='0';},120);
}

/* ── Diablo-style 데미지 숫자 ── */
/* type: 'crit' | 'player' | 'heal' | 'normal' (기본) */
function spawnDmgNum(text,color,type){
  var el=document.createElement('div');
  var isCrit=type==='crit'||(typeof color==='string'&&color.indexOf('ffdd')>=0&&text&&text.length>2&&!isNaN(text.replace(/[^0-9]/g,'')));
  var isPlayerDmg=type==='player';
  var isHeal=type==='heal'||text.charAt(0)==='+';

  /* Diablo 스타일 오버라이드 */
  var finalColor=color;
  var fontSize=18;
  var prefix='';
  var extraStyle='';

  if(isHeal){
    finalColor='#44ff88';
    fontSize=18;
  }else if(isPlayerDmg){
    finalColor='#ff3333';
    fontSize=22;
    extraStyle='animation:dmgFloatPlayer .9s ease-out forwards;';
  }else if(isCrit||type==='crit'){
    finalColor='#ffd700';
    fontSize=24;
    prefix='';
    extraStyle='';
  }else{
    finalColor=color||'#ffffff';
    fontSize=20;
  }

  /* 살짝 랜덤 수평 오프셋으로 스택 방지 */
  var leftPos=window.innerWidth*.38+Math.random()*140-70;
  var topPos=window.innerHeight*.38+Math.random()*80;

  el.textContent=prefix+text;
  el.style.cssText='position:fixed;font-size:'+fontSize+'px;font-weight:700;color:'+finalColor
    +';pointer-events:none;z-index:300;'
    +'text-shadow:1px 1px 0 #000,-1px 1px 0 #000,1px -1px 0 #000,-1px -1px 0 #000,0 0 8px '+finalColor+'88;'
    +(extraStyle||'animation:dmgFloat .9s ease-out forwards;')
    +'left:'+leftPos+'px;top:'+topPos+'px;';
  document.body.appendChild(el);
  setTimeout(function(){el.remove();},isCrit?1100:900);
}

/* 3D → 2D 투영 */
var _v3=new THREE.Vector3();
var _projCanvas=null;/* 캔버스 DOM 요소 캐시 */
function proj(wx,wy,wz){
  if(!_projCanvas)_projCanvas=document.getElementById('cc');
  _v3.set(wx,wy,wz);_v3.project(camera);
  return{x:(_v3.x*.5+.5)*_projCanvas.clientWidth,y:(-_v3.y*.5+.5)*_projCanvas.clientHeight,vis:_v3.z>0&&_v3.z<1};
}
function posEl(el,wx,wy,wz){
  var s=proj(wx,wy,wz);
  if(s.vis){el.style.display='block';el.style.left=s.x+'px';el.style.top=s.y+'px';}
  else el.style.display='none';
}

var _lastPleUpdate=0;
function updLabels(){
  var ple=document.getElementById('ple');
  if(ple&&PL.group){
    posEl(ple,PL.group.position.x,PL.group.position.y+2.4,PL.group.position.z);
    /* 0.5초마다 이름표 갱신 */
    var now=Date.now();
    if(now-_lastPleUpdate>500){
      _lastPleUpdate=now;
      var lvText=' Lv.'+playerLevel;
      var rankText='';
      if(typeof pvpRank!=='undefined'&&typeof PVP_TIERS!=='undefined'){
        for(var ri=PVP_TIERS.length-1;ri>=0;ri--){
          if(pvpRank>=PVP_TIERS[ri].min){
            rankText=' <span style="color:'+PVP_TIERS[ri].color+';font-size:9px;">'+PVP_TIERS[ri].icon+PVP_TIERS[ri].name+'</span>';
            break;
          }
        }
      }
      ple.innerHTML=myName+'<span style="color:#aaa;font-size:10px;">'+lvText+'</span>'+rankText;
    }
  }
  if(!PL.group)return;
  var _inside=(typeof insideBuilding!=='undefined')&&insideBuilding;
  npcs.forEach(function(n){
    if(!n.mesh)return;
    /* 내부/외부 NPC 컨텍스트에 맞게 처리 */
    var _isInterior=!!(n.label&&!n.nameEl);
    if(_isInterior&&!_inside){return;}/* 내부 NPC는 실내에서만 */
    if(!_isInterior&&_inside){return;}/* 외부 NPC는 실외에서만 */
    var ne=n.nameEl||n.label;
    var ie=n.intEl||n.interact;
    if(!ne)return;
    var dx=PL.group.position.x-n.mesh.position.x,dz=PL.group.position.z-n.mesh.position.z;
    var dist=Math.sqrt(dx*dx+dz*dz);
    if(dist<15){
      ne.style.display='';
      /* 호감도 표시 */
      if(typeof getRep==='function'&&NPC_AI&&NPC_AI[n.name]){
        var _rep=getRep(n.name);
        var _tier=getRepTier(n.name);
        var _baseName=n.name;
        /* 닉네임에서 이전 호감도 뱃지 제거 */
        var cleanName=_baseName.replace(/\s*\[[^\]]+\]$/,'');
        ne.innerHTML=cleanName+' <span style="color:'+_tier.color+';font-size:10px;">'+_tier.icon+' '+_rep+'</span>';
      }
      posEl(ne,n.mesh.position.x,n.mesh.position.y+2.4,n.mesh.position.z);
      if(ie){
        if(n===closestNpc){ie.style.display='block';posEl(ie,n.mesh.position.x,n.mesh.position.y+3.1,n.mesh.position.z);}
        else ie.style.display='none';
      }
    }else{
      ne.style.display='none';
      if(ie)ie.style.display='none';
    }
  });
  document.querySelectorAll('#lov .llabel.bld').forEach(function(el){
    posEl(el,parseFloat(el.dataset.wx),parseFloat(el.dataset.wy),parseFloat(el.dataset.wz));
  });
}
