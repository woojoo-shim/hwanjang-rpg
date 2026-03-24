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

function spawnDmgNum(text,color){
  var el=document.createElement('div');
  el.textContent=text;
  el.style.cssText='position:fixed;font-size:20px;font-weight:700;color:'+color+';pointer-events:none;z-index:300;text-shadow:0 2px 8px '+color+'88;animation:dmgFloat .9s ease-out forwards;left:'+(window.innerWidth*.38+Math.random()*120)+'px;top:'+(window.innerHeight*.38+Math.random()*80)+'px;';
  document.body.appendChild(el);setTimeout(function(){el.remove();},900);
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

function updLabels(){
  var ple=document.getElementById('ple');
  if(ple&&PL.group)posEl(ple,PL.group.position.x,PL.group.position.y+2.4,PL.group.position.z);
  npcs.forEach(function(n){
    if(!n.nameEl&&!n.label)return;/* 내부 NPC는 별도 처리 */
    var ne=n.nameEl||n.label;
    var ie=n.intEl||n.interact;
    if(!ne)return;
    var dx=PL.group.position.x-n.mesh.position.x,dz=PL.group.position.z-n.mesh.position.z;
    var dist=Math.sqrt(dx*dx+dz*dz);
    if(dist<15){
      ne.style.display='';
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
