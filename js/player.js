/* ════════════ 플레이어 시스템 ════════════ */
/* 의존: config.js (없음)
        ui.js (addChat, spawnDmgNum)
        inventory.js (getItemDef, getItemFull, addItem, equipped, inventory, gold)
   선언: PL, playerHP, playerMaxHP, playerEXP, playerLevel, attackCooldown, invincibleTimer
   참조: monsters (monster.js), scene (world.js), keys/cYaw (main.js) — 런타임 참조 */

var PL={group:null,legL:null,legR:null,armL:null,armR:null,armRPivot:null,weaponMesh:null,bobT:0,atkAnim:0,atkPhase:0};
var playerHP=100,playerMaxHP=100,playerEXP=0,playerLevel=1;
var attackCooldown=0,invincibleTimer=0;

/* ── 충돌 박스 [x, z, halfW, halfD] ── */
var COLLIDERS=[
  /* 성 */      [0,-30,7,6],
  /* 분수 */    [0,-8,4.2,4.2],
  /* 상점들 */  [-14,-6,1.5,1],[-14,-13,1.5,1],[14,-6,1.5,1],[14,-13,1.5,1],[-6,-18,1.5,1],[6,-18,1.5,1],
  /* 시계탑 */  [-8,5,2.2,2.2],
  /* 주택들 */  [-12,-4,2.5,2],[-10,-16,2.8,2.2],[10,-3,2.2,1.8],[12,-16,2.2,1.6],
  /* 우물 */    [8,-12,1.2,1.2],
  /* 게이트 기둥 좌우 */ [-4,-28,1.2,1.2],[4,-28,1.2,1.2],
  /* ── 초원 장식 ── */
  /* 표지판 */  [2,22,0.5,0.5],
  /* 고대 기둥 */[-50,195,1.2,1.2],[-48,198,0.7,0.7],
  /* ── 숲 장식 ── */
  /* 숲 신전 */ [-75,430,1.6,1.6],
  /* 야영지 텐트 */[-30,480,1.8,1.8],
  /* 속빈 통나무 */[30,365,2.2,1.0],
  /* ── 늪지 장식 ── */
  /* 해골 장대 (동) */[95,185,0.5,0.5],
  /* 해골 장대 (서) */[-95,185,0.5,0.5],
  /* 부서진 수레 (동) */[165,145,1.2,0.8],
  /* 부서진 수레 (서) */[-165,145,1.2,0.8],
  /* ── 화산 장식 ── */
  /* 우리 */ [-85,660,1.2,1.2],
  /* 석조 우상들 */[-65,590,0.8,0.8],[70,640,0.8,0.8],[-45,710,0.8,0.8],[0,760,0.8,0.8],
  /* ── 보스 구역 ── */
  /* 해골 장식 */[0,788,1.0,1.0],
  /* 보스 기둥 원 (12개) — 반지름 12, z=800 중심, 개별 박스 */
  [12,800,0.8,0.8],[-12,800,0.8,0.8],[0,812,0.8,0.8],[0,788,0.8,0.8],
  [10,809,0.8,0.8],[-10,809,0.8,0.8],[10,791,0.8,0.8],[-10,791,0.8,0.8],
  [6,811,0.8,0.8],[-6,811,0.8,0.8],[6,789,0.8,0.8],[-6,789,0.8,0.8],
];
function hitCollider(x,z){
  for(var i=0;i<COLLIDERS.length;i++){
    var c=COLLIDERS[i];
    if(Math.abs(x-c[0])<c[2]&&Math.abs(z-c[1])<c[3])return true;
  }
  return false;
}

/* 장착 무기 3D 메시 빌드 */
function buildWeaponMesh(itemId){
  if(!itemId)return null;
  var def=getItemDef(itemId);
  if(!def)return null;
  var icon=def.icon||'';
  var mesh=null;
  if(icon==='sword'||icon==='dagger'){
    var g=new THREE.Group();
    var blade=new THREE.Mesh(new THREE.BoxGeometry(.06,.7,.04),new THREE.MeshLambertMaterial({color:0xccddee,emissive:new THREE.Color(0x223344),emissiveIntensity:.3}));
    blade.position.set(0,.38,0);g.add(blade);
    var guard=new THREE.Mesh(new THREE.BoxGeometry(.22,.06,.06),new THREE.MeshLambertMaterial({color:0x886622}));
    guard.position.set(0,.04,0);g.add(guard);
    var hilt=new THREE.Mesh(new THREE.BoxGeometry(.06,.2,.06),new THREE.MeshLambertMaterial({color:0x663300}));
    hilt.position.set(0,-.12,0);g.add(hilt);
    mesh=g;
  } else if(icon==='axe'){
    var g=new THREE.Group();
    var handle=new THREE.Mesh(new THREE.CylinderGeometry(.04,.05,.8,6),new THREE.MeshLambertMaterial({color:0x663300}));
    handle.position.set(0,.1,0);g.add(handle);
    var head=new THREE.Mesh(new THREE.BoxGeometry(.38,.3,.05),new THREE.MeshLambertMaterial({color:0x88aacc,emissive:new THREE.Color(0x1a2a3a),emissiveIntensity:.2}));
    head.position.set(.12,.42,0);g.add(head);
    mesh=g;
  } else if(icon==='bow'){
    var g=new THREE.Group();
    var bm=new THREE.MeshLambertMaterial({color:0x7a4a10});
    var top=new THREE.Mesh(new THREE.CylinderGeometry(.03,.03,.5,6),bm);top.position.set(0,.3,0);top.rotation.z=.18;g.add(top);
    var bot=new THREE.Mesh(new THREE.CylinderGeometry(.03,.03,.5,6),bm);bot.position.set(0,-.3,0);bot.rotation.z=-.18;g.add(bot);
    var string=new THREE.Mesh(new THREE.CylinderGeometry(.008,.008,.9,4),new THREE.MeshLambertMaterial({color:0xeeddbb}));
    string.position.set(.06,0,0);g.add(string);
    mesh=g;
  } else if(icon==='staff'){
    var g=new THREE.Group();
    var rod=new THREE.Mesh(new THREE.CylinderGeometry(.04,.055,.95,7),new THREE.MeshLambertMaterial({color:0x5a3010}));
    rod.position.set(0,.05,0);g.add(rod);
    var orb=new THREE.Mesh(new THREE.SphereGeometry(.13,8,8),new THREE.MeshLambertMaterial({color:0x8844ff,emissive:new THREE.Color(0x4400cc),emissiveIntensity:.7}));
    orb.position.set(0,.56,0);g.add(orb);
    mesh=g;
  } else {
    mesh=new THREE.Mesh(new THREE.BoxGeometry(.08,.55,.08),new THREE.MeshLambertMaterial({color:0xaabbcc}));
  }
  return mesh;
}

function refreshWeaponMesh(){
  if(PL.weaponMesh){PL.armRPivot.remove(PL.weaponMesh);PL.weaponMesh=null;}
  if(!equipped.weapon)return;
  var wm=buildWeaponMesh(equipped.weapon);
  if(!wm)return;
  wm.position.set(0.1, -0.58, 0.25);
  wm.rotation.set(0, 0, 0);
  PL.armRPivot.add(wm);
  PL.weaponMesh=wm;
}

/* 공격 애니메이션 상태 */
var atkAnimTimer=0;
var ATK_PHASES=[0,.12,.18,.25];

function triggerAtkAnim(){
  PL.atkPhase=1;atkAnimTimer=0;
}

function tickAtkAnim(dt){
  if(PL.atkPhase===0)return;
  atkAnimTimer+=dt;
  var phases=ATK_PHASES;
  if(PL.atkPhase===1){
    var t=Math.min(1,atkAnimTimer/phases[1]);
    PL.armRPivot.rotation.x=t*(-Math.PI*.65);
    if(atkAnimTimer>=phases[1]){PL.atkPhase=2;atkAnimTimer=0;}
  } else if(PL.atkPhase===2){
    var t=Math.min(1,atkAnimTimer/phases[2]);
    PL.armRPivot.rotation.x=(-Math.PI*.65)+(t*(Math.PI*1.2));
    if(atkAnimTimer>=phases[2]){PL.atkPhase=3;atkAnimTimer=0;}
  } else if(PL.atkPhase===3){
    var t=Math.min(1,atkAnimTimer/phases[3]);
    PL.armRPivot.rotation.x=(Math.PI*.55)*(1-t);
    if(atkAnimTimer>=phases[3]){PL.atkPhase=0;atkAnimTimer=0;PL.armRPivot.rotation.x=0;}
  }
}

/* 공용 히트 플래시 머티리얼 (1번만 생성) */
var _hitFlashMat=new THREE.MeshLambertMaterial({color:0xffffff,emissive:new THREE.Color(0xffffff),emissiveIntensity:1.0});

function flashMonster(m){
  m.hitFlash=0.35;
  if(m._origMats){m._origMats.forEach(function(o){o.mesh.material=o.orig;});m._origMats=null;}
  var mats=[];
  m.mesh.traverse(function(c){
    if(c.isMesh){
      mats.push({mesh:c,orig:c.material});
      c.material=_hitFlashMat;
    }
  });
  m._origMats=mats;
  setTimeout(function(){
    if(m._origMats){
      m._origMats.forEach(function(o){o.mesh.material=o.orig;});
      m._origMats=null;
    }
  },180);
}

/* ── 마우스 월드 좌표 (레이캐스트) ── */
var mouseWorldX=0,mouseWorldZ=0;
var _groundPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
var _raycaster=new THREE.Raycaster();
var _mouseNDC=new THREE.Vector2();

document.addEventListener('mousemove',function(e){
  if(typeof camera==='undefined'||!camera||typeof renderer==='undefined'||!renderer)return;
  var rect=renderer.domElement.getBoundingClientRect();
  _mouseNDC.x=((e.clientX-rect.left)/rect.width)*2-1;
  _mouseNDC.y=-((e.clientY-rect.top)/rect.height)*2+1;
  _raycaster.setFromCamera(_mouseNDC,camera);
  var hit=new THREE.Vector3();
  if(_raycaster.ray.intersectPlane(_groundPlane,hit)){
    mouseWorldX=hit.x;mouseWorldZ=hit.z;
  }
},{passive:true});

/* ── 화살 시스템 ── */
var arrows=[];
var _arrowMat=new THREE.MeshLambertMaterial({color:0x8B4513});
var _arrowHeadMat=new THREE.MeshLambertMaterial({color:0xaabbcc});

function shootArrow(dirX,dirZ,dmg){
  var g=new THREE.Group();
  var shaft=new THREE.Mesh(new THREE.CylinderGeometry(.02,.02,.6,4),_arrowMat);
  shaft.rotation.x=Math.PI/2;g.add(shaft);
  var head=new THREE.Mesh(new THREE.ConeGeometry(.05,.15,4),_arrowHeadMat);
  head.rotation.x=-Math.PI/2;head.position.set(0,0,.35);g.add(head);
  g.position.set(PL.group.position.x,1.2,PL.group.position.z);
  g.rotation.y=Math.atan2(dirX,dirZ);
  scene.add(g);
  arrows.push({mesh:g,dx:dirX,dz:dirZ,dmg:dmg,life:2.0,speed:25});
}

function updateArrows(dt){
  for(var i=arrows.length-1;i>=0;i--){
    var a=arrows[i];
    a.mesh.position.x+=a.dx*a.speed*dt;
    a.mesh.position.z+=a.dz*a.speed*dt;
    a.life-=dt;
    /* 몬스터 충돌 체크 */
    var hit=false;
    for(var j=0;j<monsters.length;j++){
      var m=monsters[j];
      if(m.state==='dead'||m.hp<=0)continue;
      var ex=a.mesh.position.x-m.mesh.position.x;
      var ez=a.mesh.position.z-m.mesh.position.z;
      if(ex*ex+ez*ez<1.5){
        m.hp=Math.max(0,m.hp-a.dmg);
        m.hbf.style.width=Math.max(0,m.hp/m.maxHp*100)+'%';
        spawnDmgNum('-'+a.dmg,'#ffdd44');
        flashMonster(m);
        m.state='aggro';
        var midx=monsters.indexOf(m);
        if(midx>=0&&typeof ws!=='undefined'&&ws&&ws.readyState===1)ws.send(JSON.stringify({type:'mhit',mid:midx,dmg:a.dmg,maxHp:m.maxHp}));
        if(m.hp<=0)killMonster(m);
        hit=true;break;
      }
    }
    if(hit||a.life<=0){
      scene.remove(a.mesh);
      arrows.splice(i,1);
    }
  }
}

/* ── 무기 타입 판별 ── */
function isRangedWeapon(){
  if(!equipped.weapon)return false;
  var def=getItemDef(equipped.weapon);
  return def&&def.icon==='bow';
}

/* ═══════════ 스킬 시스템 ═══════════ */
function useSkill(slotIdx){
  if(playerClass==='none')return;
  var skills=CLASS_SKILLS[playerClass];
  if(!skills||slotIdx>=skills.length)return;
  var sk=skills[slotIdx];
  /* 쿨다운 체크 */
  if(skillCooldowns[sk.id]&&skillCooldowns[sk.id]>0){
    addChat('inf','','쿨다운 중 ('+Math.ceil(skillCooldowns[sk.id])+'초)');
    return;
  }
  skillCooldowns[sk.id]=sk.cd;

  var cls=CLASS_DEFS[playerClass]||CLASS_DEFS.none;
  var baseAtk=5;
  if(equipped.weapon){
    var wi=getItemFull(inventory.find(function(s){return s.itemId===equipped.weapon;})||{itemId:''});
    if(wi&&wi.stats&&wi.stats['공격력'])baseAtk=parseInt(wi.stats['공격력'])||5;
  }
  var dmg=Math.floor((baseAtk+Math.floor(Math.random()*5))*cls.atkMul*(sk.dmgMul||1));

  /* 자가 힐 */
  if(sk.selfHeal){
    var heal=Math.floor(playerMaxHP*sk.selfHeal);
    playerHP=Math.min(playerMaxHP,playerHP+heal);
    updPlayerHpBar();
    spawnDmgNum('+'+heal,'#44ff88');
    addChat('sys','[스킬]',sk.name+' 사용! HP +'+heal);
  }
  /* 자가 데미지 (광전사) */
  if(sk.selfDmg){
    var sd=Math.floor(playerMaxHP*sk.selfDmg);
    playerHP=Math.max(1,playerHP-sd);
    updPlayerHpBar();
  }
  /* 버프 */
  if(sk.buff){
    activeBuffs[sk.buff]={remaining:sk.buffDur};
    addChat('sys','[스킬]',sk.name+' 발동! ('+sk.buffDur+'초)');
  }
  /* 범위 공격 (AOE) */
  if(sk.aoe){
    var px=PL.group.position.x,pz=PL.group.position.z;
    var hitCount=0;
    monsters.forEach(function(m){
      if(m.state==='dead'||m.hp<=0)return;
      var dx=px-m.mesh.position.x,dz=pz-m.mesh.position.z;
      if(Math.sqrt(dx*dx+dz*dz)<sk.aoe){
        m.hp=Math.max(0,m.hp-dmg);
        m.hbf.style.width=Math.max(0,m.hp/m.maxHp*100)+'%';
        flashMonster(m);m.state='aggro';hitCount++;
        if(m.hp<=0)killMonster(m);
      }
    });
    if(hitCount>0)spawnDmgNum(sk.name+'! -'+dmg+'x'+hitCount,sk.color||'#ffdd44');
    triggerAtkAnim();
    return;
  }
  /* 발사체 스킬 */
  if(sk.projectile){
    var dx=mouseWorldX-PL.group.position.x;
    var dz=mouseWorldZ-PL.group.position.z;
    var len=Math.sqrt(dx*dx+dz*dz);
    if(len<0.1){dx=0;dz=1;len=1;}
    dx/=len;dz/=len;
    PL.group.rotation.y=Math.atan2(dx,dz);
    shootArrow(dx,dz,dmg);
    triggerAtkAnim();
    spawnDmgNum(sk.name+'!',sk.color||'#ffdd44');
    return;
  }
  /* 멀티샷 (궁수) */
  if(sk.multiShot){
    var dx=mouseWorldX-PL.group.position.x;
    var dz=mouseWorldZ-PL.group.position.z;
    var len=Math.sqrt(dx*dx+dz*dz);
    if(len<0.1){dx=0;dz=1;len=1;}
    dx/=len;dz/=len;
    var angle=Math.atan2(dx,dz);
    var spread=0.25;
    for(var si=0;si<sk.multiShot;si++){
      var a=angle+(si-(sk.multiShot-1)/2)*spread;
      shootArrow(Math.sin(a),Math.cos(a),Math.floor(dmg/sk.multiShot*sk.dmgMul));
    }
    PL.group.rotation.y=angle;
    triggerAtkAnim();
    spawnDmgNum(sk.name+'!',sk.color||'#ffdd44');
    return;
  }
  /* 근접 단일/멀티 타격 */
  var target=null,bestDist=sk.range||6;
  monsters.forEach(function(m){
    if(m.state==='dead')return;
    var dx2=PL.group.position.x-m.mesh.position.x,dz2=PL.group.position.z-m.mesh.position.z;
    var d=Math.sqrt(dx2*dx2+dz2*dz2);
    if(d<bestDist){bestDist=d;target=m;}
  });
  if(!target){addChat('inf','','근처에 대상이 없다.');skillCooldowns[sk.id]=0;return;}
  /* 순간이동 (암살자) */
  if(sk.teleport){
    PL.group.position.x=target.mesh.position.x+1;
    PL.group.position.z=target.mesh.position.z+1;
  }
  var hits=sk.multiHit||1;
  for(var hi=0;hi<hits;hi++){
    var finalDmg=sk.forceCrit?Math.floor(dmg*cls.critDmg):dmg;
    target.hp=Math.max(0,target.hp-finalDmg);
    target.hbf.style.width=Math.max(0,target.hp/target.maxHp*100)+'%';
    spawnDmgNum('-'+finalDmg,sk.color||'#ffdd44');
  }
  if(sk.healMul){var h2=Math.floor(dmg*sk.healMul);playerHP=Math.min(playerMaxHP,playerHP+h2);updPlayerHpBar();}
  flashMonster(target);target.state='aggro';
  var ddx=target.mesh.position.x-PL.group.position.x;
  var ddz=target.mesh.position.z-PL.group.position.z;
  PL.group.rotation.y=Math.atan2(ddx,ddz);
  triggerAtkAnim();
  if(target.hp<=0)killMonster(target);
}

/* 스킬 쿨다운 + 버프 틱 (매 프레임 호출) */
function updateSkills(dt){
  for(var id in skillCooldowns){
    if(skillCooldowns[id]>0)skillCooldowns[id]-=dt;
  }
  for(var b in activeBuffs){
    activeBuffs[b].remaining-=dt;
    if(activeBuffs[b].remaining<=0)delete activeBuffs[b];
  }
  /* HUD 스킬 쿨다운 표시 */
  var skills=CLASS_SKILLS[playerClass]||[];
  for(var i=0;i<skills.length;i++){
    var el=document.getElementById('skill-cd-'+i);
    if(!el)continue;
    var cd=skillCooldowns[skills[i].id]||0;
    el.textContent=cd>0?Math.ceil(cd)+'s':'';
    el.parentElement.style.opacity=cd>0?'0.5':'1';
  }
}

function playerAttack(){
  if(attackCooldown>0)return;

  var baseAtk=5;
  if(equipped.weapon){
    var wi=getItemFull(inventory.find(function(s){return s.itemId===equipped.weapon;})||{itemId:''});
    if(wi&&wi.stats&&wi.stats['공격력'])baseAtk=parseInt(wi.stats['공격력'])||5;
  }
  var cls=CLASS_DEFS[playerClass]||CLASS_DEFS.none;
  var dmg=Math.floor((baseAtk+Math.floor(Math.random()*5))*cls.atkMul);
  /* 광전사 패시브: HP 낮을수록 ATK 증가 */
  if(cls.passive==='rage'){var hpRatio=playerHP/playerMaxHP;dmg=Math.floor(dmg*(1+(1-hpRatio)*0.8));}
  /* 치명타 판정 */
  if(Math.random()<cls.crit){dmg=Math.floor(dmg*cls.critDmg);}

  /* 활: 마우스 방향으로 화살 발사 */
  if(isRangedWeapon()){
    var dx=mouseWorldX-PL.group.position.x;
    var dz=mouseWorldZ-PL.group.position.z;
    var len=Math.sqrt(dx*dx+dz*dz);
    if(len<0.1){dx=0;dz=1;len=1;}
    dx/=len;dz/=len;
    PL.group.rotation.y=Math.atan2(dx,dz);
    shootArrow(dx,dz,dmg);
    attackCooldown=.5/cls.spdMul;
    triggerAtkAnim();
    if(typeof sendAttackMP==='function')sendAttackMP();
    return;
  }

  /* 근접 무기: 기존 로직 */
  var target=null,bestDist=6.0;
  monsters.forEach(function(m){
    if(m.state==='dead')return;
    var dx=PL.group.position.x-m.mesh.position.x;
    var dz=PL.group.position.z-m.mesh.position.z;
    var d=Math.sqrt(dx*dx+dz*dz);
    if(d<bestDist){bestDist=d;target=m;}
  });
  if(!target){
    addChat('inf','','근처에 공격할 대상이 없다.');
    return;
  }
  target.hp=Math.max(0,target.hp-dmg);
  target.hbf.style.width=Math.max(0,target.hp/target.maxHp*100)+'%';
  /* 성기사 패시브: 흡혈 */
  if(cls.passive==='lifesteal'){var heal=Math.floor(dmg*0.05);playerHP=Math.min(playerMaxHP,playerHP+heal);updPlayerHpBar();}
  /* 주술사 패시브: 독 */
  if(cls.passive==='poison'&&target){target._poisonT=3;target._poisonDmg=Math.floor(dmg*0.15);}
  attackCooldown=.75/cls.spdMul;
  triggerAtkAnim();
  if(typeof sendAttackMP==='function')sendAttackMP();
  var midx=monsters.indexOf(target);
  if(midx>=0&&ws&&ws.readyState===1)ws.send(JSON.stringify({type:'mhit',mid:midx,dmg:dmg,maxHp:target.maxHp}));
  var ddx=target.mesh.position.x-PL.group.position.x;
  var ddz=target.mesh.position.z-PL.group.position.z;
  PL.group.rotation.y=Math.atan2(ddx,ddz);
  spawnDmgNum('-'+dmg,'#ffdd44');
  flashMonster(target);
  target.state='aggro';
  if(target.hp<=0)killMonster(target);
}

function killMonster(m){
  m.state='dead';
  /* 사망 애니메이션 시작 (0.8초) */
  m.deathAnim=0.8;
  m.wrap.style.display='none';
  /* 붉은 공격 플래시 재료 복원 후 죽음 색상 적용 */
  if(m._origMats){m._origMats.forEach(function(o){o.mesh.material=o.orig;});m._origMats=null;}
  playerEXP+=m.def.exp;
  addChat('sys','[시스템]',m.def.name+' 처치! (EXP +'+m.def.exp+')');
  checkLevelUp();
  if(typeof onMonsterKill==='function')onMonsterKill(m.def.name);
  if(typeof checkClassQuestKill==='function')checkClassQuestKill(m.def.name);
  m.def.drops.forEach(function(drop){
    if(Math.random()<drop.rate){
      var qty=Array.isArray(drop.qty)?drop.qty[0]+Math.floor(Math.random()*(drop.qty[1]-drop.qty[0]+1)):drop.qty;
      addItem(drop.id,qty);
      var df=getItemDef(drop.id);if(df)addChat('sys','[시스템]','['+df.name+'] x'+qty+' 획득!');
      if(typeof onItemCollect==='function')onItemCollect(drop.id,qty);
    }
  });
  setTimeout(function(){
    if(!m.mesh)return;
    m.hp=m.def.hp;m.mesh.position.set(m.spawnX,0,m.spawnZ);
    m.mesh.rotation.set(0,Math.random()*Math.PI*2,0);
    /* 재료 투명도 리셋 */
    m.mesh.traverse(function(c){
      if(c.isMesh&&c.material){c.material.opacity=1;c.material.transparent=false;}
    });
    m.mesh.scale.set(0,0,0);
    m.mesh.visible=true;m.wrap.style.display='';m.hbf.style.width='100%';
    m.state='idle';m.attackTimer=0;
    /* 스폰 애니메이션 재시작 */
    m.spawnAnim=0.6;m.deathAnim=-1;m.hitFlash=0;m.isAttacking=false;m._origMats=null;
  },30000);
}

function playerDied(){
  addChat('sys','[시스템]','쓰러졌습니다. 마을로 귀환...');
  playerHP=Math.floor(playerMaxHP*.4);
  invincibleTimer=4;updPlayerHpBar();
  PL.group.position.set(WORLD_SPAWN[0],0,WORLD_SPAWN[1]);
  currentZone='village';
  /* 분위기 복원 */
  scene.fog=new THREE.Fog(0x0a1510,80,320);scene.background=new THREE.Color(0x0a1510);
  var zi=ZONE_INFO['village'];
  document.querySelector('.hloc').textContent='▸ '+zi.name;
}

function checkLevelUp(){
  var need=Math.floor(100*Math.pow(playerLevel,2.2));
  if(playerEXP>=need){
    playerEXP-=need;playerLevel++;var cls=CLASS_DEFS[playerClass]||CLASS_DEFS.none;playerMaxHP+=Math.floor(12*cls.hpMul);playerHP=playerMaxHP;
    document.querySelector('.hlv').textContent='Lv.'+playerLevel;
    updPlayerHpBar();
    addChat('sys','[시스템]','★ 레벨 UP! Lv.'+playerLevel+' 달성! (최대 HP +20)');
    gold+=20;document.getElementById('inv-gold').textContent='💰 '+gold+' 골드';
  }
  var ef=document.getElementById('exp-bar-fill');
  if(ef)ef.style.width=Math.min(100,playerEXP/Math.floor(100*Math.pow(playerLevel,2.2))*100)+'%';
}

function updPlayerHpBar(){
  document.querySelectorAll('.hbf.hp').forEach(function(f){f.style.width=(playerHP/playerMaxHP*100)+'%';});
  var vals=document.querySelectorAll('.hbv');
  if(vals[0])vals[0].textContent=playerHP+'/'+playerMaxHP;
}

/* checkZone — 오픈 월드 위치 기반 존 감지 + 분위기 전환 */
function checkZone(){
  var z=PL.group.position.z;
  var x=Math.abs(PL.group.position.x);
  var newZone;
  if(z<=20) newZone='village';
  else if(z<=300&&x>80) newZone='swamp';
  else if(z<=300) newZone='meadow';
  else if(z<=560) newZone='darkforest';
  else newZone='volcano';

  if(newZone!==currentZone){
    var prevZone=currentZone;
    currentZone=newZone;
    /* 분위기 전환 */
    if(newZone==='village'){scene.fog=new THREE.Fog(0x0a1510,80,320);scene.background=new THREE.Color(0x0a1510);}
    else if(newZone==='meadow'){scene.fog=new THREE.Fog(0x1a3010,100,380);scene.background=new THREE.Color(0x1a3010);}
    else if(newZone==='swamp'){scene.fog=new THREE.Fog(0x050a05,40,160);scene.background=new THREE.Color(0x050a05);}
    else if(newZone==='darkforest'){scene.fog=new THREE.Fog(0x020202,25,130);scene.background=new THREE.Color(0x020202);}
    else if(newZone==='volcano'){scene.fog=new THREE.Fog(0x100500,35,160);scene.background=new THREE.Color(0x100500);}

    /* 배너 표시 */
    var zi=ZONE_INFO[newZone];
    if(zi){
      var b=document.getElementById('zone-banner');
      b.textContent='◈ '+zi.name+' 진입';b.style.color=zi.color;b.style.borderColor=zi.color+'66';
      b.classList.add('show');setTimeout(function(){b.classList.remove('show');},2800);
      document.querySelector('.hloc').textContent='▸ '+zi.name;
    }
    /* 시스템 메시지 */
    var msgs={
      meadow:'초원 진입. 토끼와 사슴이 있습니다.',
      swamp:'독 늪 진입! 슬라임과 독두꺼비가 나타납니다.',
      darkforest:'어두운 숲 진입! 고블린과 늑대를 조심하세요!',
      volcano:'화산 지대 진입!! 용암 골렘과 드레이크가 기다립니다!!',
      village:'마을로 귀환. HP 일부 회복.',
    };
    if(msgs[newZone])addChat('sys','[시스템]',msgs[newZone]);
    /* 마을 귀환 시 HP 회복 */
    if(newZone==='village'){
      playerHP=Math.min(playerMaxHP,playerHP+Math.floor(playerMaxHP*.25));
      updPlayerHpBar();
    }
  }
}

function handleMove(dt){
  tickAtkAnim(dt);
  var dx=0,dz=0;
  if(keys['w']||keys['arrowup']){dx-=Math.sin(cYaw);dz-=Math.cos(cYaw);}
  if(keys['s']||keys['arrowdown']){dx+=Math.sin(cYaw);dz+=Math.cos(cYaw);}
  if(keys['a']||keys['arrowleft']){dx-=Math.cos(cYaw);dz+=Math.sin(cYaw);}
  if(keys['d']||keys['arrowright']){dx+=Math.cos(cYaw);dz-=Math.sin(cYaw);}
  var moving=dx!==0||dz!==0;
  if(moving){
    var len=Math.sqrt(dx*dx+dz*dz);dx/=len;dz/=len;
    var spd=6.0*(CLASS_DEFS[playerClass]||CLASS_DEFS.none).spdMul*dt,nx=PL.group.position.x+dx*spd,nz=PL.group.position.z+dz*spd;
    var wb=WORLD_BOUNDS;
    if(nx>wb[0]&&nx<wb[1]&&!hitCollider(nx,PL.group.position.z))PL.group.position.x=nx;
    if(nz>wb[2]&&nz<wb[3]&&!hitCollider(PL.group.position.x,nz))PL.group.position.z=nz;
    PL.group.rotation.y=Math.atan2(dx,dz);PL.bobT+=dt*9;
    var wa=.32;
    PL.legL.rotation.x=Math.sin(PL.bobT)*wa;
    PL.legR.rotation.x=-Math.sin(PL.bobT)*wa;
    PL.armL.rotation.x=-Math.sin(PL.bobT)*wa*.5;
    if(PL.atkPhase===0)PL.armRPivot.rotation.x=Math.sin(PL.bobT)*wa*.5;
    PL.group.position.y=Math.abs(Math.sin(PL.bobT))*.06;
  }else{
    PL.legL.rotation.x*=.8;PL.legR.rotation.x*=.8;PL.armL.rotation.x*=.8;
    if(PL.atkPhase===0)PL.armRPivot.rotation.x*=.8;
    PL.group.position.y*=.8;
  }
}
