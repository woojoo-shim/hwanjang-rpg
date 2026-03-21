/* ════════════ UI 유틸리티 ════════════ */
/* 의존: config.js (없음)
   선언: addChat, spawnDmgNum, showToast, _v3, proj, posEl, updLabels
   참조: camera (world.js), PL (player.js), npcs/closestNpc (world.js) — 런타임 참조 */

function addChat(tp,w,tx){
  var lg=document.getElementById('clog');
  var d=document.createElement('div');d.className='cm '+tp;
  if(tp==='inf')d.textContent=tx;
  else d.innerHTML='<span class="who">'+w+'</span><span class="tx">'+tx+'</span>';
  lg.appendChild(d);lg.scrollTop=lg.scrollHeight;
}

function spawnDmgNum(text,color){
  var el=document.createElement('div');
  el.textContent=text;
  el.style.cssText='position:fixed;font-size:20px;font-weight:700;color:'+color+';pointer-events:none;z-index:300;text-shadow:0 2px 8px '+color+'88;animation:dmgFloat .9s ease-out forwards;left:'+(window.innerWidth*.38+Math.random()*120)+'px;top:'+(window.innerHeight*.38+Math.random()*80)+'px;';
  document.body.appendChild(el);setTimeout(function(){el.remove();},900);
}

/* 3D → 2D 투영 */
var _v3=new THREE.Vector3();
function proj(wx,wy,wz){
  _v3.set(wx,wy,wz);_v3.project(camera);
  var c=document.getElementById('cc');
  return{x:(_v3.x*.5+.5)*c.clientWidth,y:(-_v3.y*.5+.5)*c.clientHeight,vis:_v3.z>0&&_v3.z<1};
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
    posEl(n.nameEl,n.mesh.position.x,n.mesh.position.y+2.4,n.mesh.position.z);
    if(n===closestNpc){n.intEl.style.display='block';posEl(n.intEl,n.mesh.position.x,n.mesh.position.y+3.1,n.mesh.position.z);}
    else n.intEl.style.display='none';
  });
  document.querySelectorAll('#lov .llabel.bld').forEach(function(el){
    posEl(el,parseFloat(el.dataset.wx),parseFloat(el.dataset.wy),parseFloat(el.dataset.wz));
  });
  /* 포탈 라벨 */
  portalMeshes.forEach(function(pm){
    if(pm===closestPortal){pm.intEl.style.display='block';posEl(pm.intEl,pm.px,5,pm.pz);}
    else pm.intEl.style.display='none';
  });
}
