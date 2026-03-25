/* ════════════ 플레이어 시스템 ════════════ */
/* 의존: config.js (없음)
        ui.js (addChat, spawnDmgNum)
        inventory.js (getItemDef, getItemFull, addItem, equipped, inventory, gold)
   선언: PL, playerHP, playerMaxHP, playerEXP, playerLevel, attackCooldown, invincibleTimer
   참조: monsters (monster.js), scene (world.js), keys/cYaw (main.js) — 런타임 참조 */

var PL={group:null,legL:null,legR:null,armL:null,armR:null,armRPivot:null,weaponMesh:null,bobT:0,atkAnim:0,atkPhase:0};
var playerHP=100,playerMaxHP=100,playerEXP=0,playerLevel=1;
var attackCooldown=0,invincibleTimer=0;
/* 상태이상 */
var playerPoisoned=0,playerPoisonDmg=0;
var playerSlowed=0;

/* ── 충돌 박스 [x, z, halfW, halfD] ── */
/* 모든 마을 건물은 (-350,-350) 중심으로 이동 */
var COLLIDERS=[
  /* 성 */      [-350,-380,7,6],
  /* 분수 */    [-350,-358,4.2,4.2],
  /* 여관 (VX-38, VZ-14) = (-388,-364) w8 d7 */
  [-388,-364,4.5,4],
  /* 무기 상점 (VX+38, VZ-14) = (-312,-364) w7 d6 */
  [-312,-364,4,3.5],
  /* 방어구 상점 (VX+38, VZ-36) = (-312,-386) w7 d6 */
  [-312,-386,4,3.5],
  /* 도서관 (VX+50, VZ+12) = (-300,-338) w10 d8 */
  [-300,-338,5.5,4.5],
  /* 모험가 길드 (VX-8, VZ-72) = (-358,-422) w14 d10 */
  [-358,-422,7.5,5.5],
  /* 시장 스탠드들 */
  [-390,-368,1.5,1],[-390,-378,1.5,1],[-402,-368,1.5,1],[-402,-378,1.5,1],
  /* 우물 */    [-378,-310,1.2,1.2],
  /* 게이트 기둥 좌우 */ [-354,-448,1.2,1.2],[-346,-448,1.2,1.2],
  /* ── 보스 구역 ── */
  [12,550,0.8,0.8],[-12,550,0.8,0.8],[0,562,0.8,0.8],[0,538,0.8,0.8],
  [10,559,0.8,0.8],[-10,559,0.8,0.8],[10,541,0.8,0.8],[-10,541,0.8,0.8],
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
var _hitFlashMat=new THREE.MeshLambertMaterial({color:0xff2222,emissive:new THREE.Color(0xff0000),emissiveIntensity:1.0});

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

/* 재사용 가능한 hit 벡터 — 매 mousemove마다 생성 방지 */
var _mouseHit=new THREE.Vector3();
document.addEventListener('mousemove',function(e){
  if(typeof camera==='undefined'||!camera||typeof renderer==='undefined'||!renderer)return;
  var rect=renderer.domElement.getBoundingClientRect();
  _mouseNDC.x=((e.clientX-rect.left)/rect.width)*2-1;
  _mouseNDC.y=-((e.clientY-rect.top)/rect.height)*2+1;
  _raycaster.setFromCamera(_mouseNDC,camera);
  if(_raycaster.ray.intersectPlane(_groundPlane,_mouseHit)){
    mouseWorldX=_mouseHit.x;mouseWorldZ=_mouseHit.z;
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
    /* 화살 소모 체크 */
    var arrowSlot=inventory.find(function(s){return s.itemId==='fire_arrow'||s.itemId==='arrow';});
    if(!arrowSlot){
      addChat('inf','','화살이 없다! 상점에서 구매하세요.');
      return;
    }
    /* 불화살 우선 사용 */
    var useFireArrow=arrowSlot.itemId==='fire_arrow';
    if(useFireArrow)dmg+=5;
    arrowSlot.qty--;
    if(arrowSlot.qty<=0){var ai=inventory.indexOf(arrowSlot);if(ai>=0)inventory.splice(ai,1);}
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
  if(midx>=0&&typeof ws!=='undefined'&&ws&&ws.readyState===1)ws.send(JSON.stringify({type:'mhit',mid:midx,dmg:dmg,maxHp:target.maxHp}));
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
  var _expGain=m.def.exp;
  if(typeof getPartyExpShare==='function')_expGain=getPartyExpShare(_expGain);
  playerEXP+=_expGain;
  if(typeof partyId!=='undefined'&&partyId&&typeof partyMembers!=='undefined'&&partyMembers.length>1)
    addChat('sys','[파티]',m.def.name+' 처치! (EXP +'+_expGain+' / '+partyMembers.length+'명 분배)');
  else addChat('sys','[시스템]',m.def.name+' 처치! (EXP +'+_expGain+')');
  checkLevelUp();
  if(typeof onMonsterKill==='function')onMonsterKill(m.def.name);
  if(typeof checkClassQuestKill==='function')checkClassQuestKill(m.def.name);
  if(typeof onMonsterKillForShaman==='function')onMonsterKillForShaman();
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
    m.hp=m.def.hp;var _respawnY=(typeof getTerrainY==='function')?getTerrainY(m.spawnX,m.spawnZ):0;m.mesh.position.set(m.spawnX,_respawnY,m.spawnZ);
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
  /* 사망 오버레이 */
  var ov=document.getElementById('death-overlay');
  if(!ov){
    ov=document.createElement('div');
    ov.id='death-overlay';
    ov.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;z-index:9998;display:flex;align-items:center;justify-content:center;pointer-events:none;opacity:0;transition:opacity 2s;';
    ov.innerHTML='<div style="background:rgba(0,0,0,0.95);width:100%;height:100%;display:flex;align-items:center;justify-content:center;flex-direction:column;">'
      +'<div id="death-text" style="color:#cc3333;font-size:28px;letter-spacing:5px;font-family:inherit;text-shadow:0 0 20px #ff0000;"></div>'
      +'</div>';
    document.body.appendChild(ov);
  }
  document.getElementById('death-text').textContent=myName+'님이 사망하셨습니다';
  ov.style.opacity='1';
  /* 2초 후 페이드아웃 + 리스폰 */
  setTimeout(function(){
    playerHP=Math.floor(playerMaxHP*.4);
    invincibleTimer=4;updPlayerHpBar();
    PL.group.position.set(WORLD_SPAWN[0],0,WORLD_SPAWN[1]);
    currentZone='village';
    scene.fog=new THREE.Fog(0x0a1510,120,500);scene.background=new THREE.Color(0x0a1510);
    var zi=ZONE_INFO['village'];
    document.querySelector('.hloc').textContent='▸ '+zi.name;
    /* 페이드아웃 — 눈 뜨는 느낌 */
    ov.style.transition='opacity 3s';
    ov.style.opacity='0';
    addChat('sys','[시스템]','마을로 귀환. HP 일부 회복.');
    setTimeout(function(){ov.style.transition='opacity 2s';},3500);
  },2500);
}

/* ═══════════ 텔레포트 두루마리 ═══════════ */
function useTpScroll(){
  var dev=isDev();
  var slot=inventory.find(function(s){return s.itemId==='tp_scroll';});
  if(!slot&&!dev){addChat('inf','','텔레포트 두루마리가 없습니다!');return;}
  /* 방문한 존 목록으로 UI 표시 */
  var modal=document.getElementById('tp-modal');
  if(!modal){
    modal=document.createElement('div');
    modal.id='tp-modal';
    modal.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:9998;display:none;flex-direction:column;align-items:center;justify-content:center;gap:12px;';
    modal.innerHTML='<div style="color:#c9a84c;font-size:20px;letter-spacing:3px;">▣ 텔레포트 ▣</div><div style="color:#aaa;font-size:12px;">이동할 장소를 선택하세요</div><div id="tp-list" style="display:flex;flex-direction:column;gap:8px;min-width:200px;"></div><button onclick="closeTpModal()" style="margin-top:10px;padding:8px 30px;background:#3a3a5a;color:#aaa;border:1px solid #555;cursor:pointer;font-family:inherit;">취소</button>';
    document.body.appendChild(modal);
  }
  var list=document.getElementById('tp-list');
  list.innerHTML='';
  for(var zk in ZONE_INFO){
    var zi=ZONE_INFO[zk];
    if(!visitedZones[zk]&&!dev)continue;
    if(zk===currentZone)continue;
    var btn=document.createElement('button');
    btn.style.cssText='padding:10px 20px;background:#1a1a2e;border:1px solid '+zi.color+';color:'+zi.color+';cursor:pointer;font-family:inherit;font-size:14px;border-radius:4px;';
    btn.textContent='◈ '+zi.name;
    btn.dataset.zone=zk;
    btn.onclick=function(){doTeleport(this.dataset.zone);};
    list.appendChild(btn);
  }
  if(list.children.length===0){
    list.innerHTML='<div style="color:#555;font-size:12px;text-align:center;">현재 위치 외에 방문한 장소가 없습니다.</div>';
  }
  modal.style.display='flex';
}

function closeTpModal(){
  var m=document.getElementById('tp-modal');
  if(m)m.style.display='none';
}

function doTeleport(zoneKey){
  var zi=ZONE_INFO[zoneKey];
  if(!zi||!zi.tp)return;
  /* 두루마리 소모 (개발자는 무소모) */
  if(!isDev()){
    var slot2=inventory.find(function(s){return s.itemId==='tp_scroll';});
    if(!slot2)return;
    slot2.qty--;
    if(slot2.qty<=0){var idx=inventory.indexOf(slot2);if(idx>=0)inventory.splice(idx,1);}
  }
  /* 텔레포트 */
  PL.group.position.set(zi.tp[0],0,zi.tp[1]);
  closeTpModal();
  addChat('sys','[시스템]','★ '+zi.name+'(으)로 텔레포트!');
  /* 존 전환 트리거 */
  checkZone();
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

/* checkZone — 거리 기반 존 감지 (섬형 맵) + 분위기 전환 */
function checkZone(){
  if(typeof insideBuilding!=='undefined'&&insideBuilding)return;
  var px=PL.group.position.x;
  var pz=PL.group.position.z;
  var newZone='meadow'; /* 기본값 */
  var bestDist=Infinity;
  for(var zk in ZONE_CENTERS){
    var zc=ZONE_CENTERS[zk];
    var dx=px-zc.cx,dz=pz-zc.cz;
    var d=Math.sqrt(dx*dx+dz*dz);
    if(d<zc.r&&d<bestDist){bestDist=d;newZone=zk;}
  }
  /* 존에 해당하지 않으면 가장 가까운 존으로 */
  if(bestDist===Infinity){
    for(var zk2 in ZONE_CENTERS){
      var zc2=ZONE_CENTERS[zk2];
      var dx2=px-zc2.cx,dz2=pz-zc2.cz;
      var d2=Math.sqrt(dx2*dx2+dz2*dz2);
      if(d2<bestDist){bestDist=d2;newZone=zk2;}
    }
  }

  if(newZone!==currentZone){
    var prevZone=currentZone;
    currentZone=newZone;
    visitedZones[newZone]=true;
    /* 분위기 전환 */
    if(newZone==='village'){scene.fog=new THREE.Fog(0x0a1510,120,500);scene.background=new THREE.Color(0x0a1510);}
    else if(newZone==='meadow'){scene.fog=new THREE.Fog(0x1a3010,180,700);scene.background=new THREE.Color(0x1a3010);}
    else if(newZone==='swamp'){scene.fog=new THREE.Fog(0x050a05,80,350);scene.background=new THREE.Color(0x050a05);}
    else if(newZone==='darkforest'){scene.fog=new THREE.Fog(0x020202,60,280);scene.background=new THREE.Color(0x020202);}
    else if(newZone==='jungle'){scene.fog=new THREE.Fog(0x0a2010,70,300);scene.background=new THREE.Color(0x0a2010);}
    else if(newZone==='volcano'){scene.fog=new THREE.Fog(0x100500,80,350);scene.background=new THREE.Color(0x100500);}
    else if(newZone==='boss'){scene.fog=new THREE.Fog(0x080000,60,250);scene.background=new THREE.Color(0x080000);}

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
      swamp:'늪지대 진입! 슬라임과 독두꺼비가 나타납니다.',
      darkforest:'어두운 숲 진입! 고블린과 늑대를 조심하세요!',
      jungle:'정글 진입! 거미, 독사, 유인원이 서식합니다!',
      volcano:'화산 지대 진입!! 용암 골렘과 드레이크가 기다립니다!!',
      boss:'마왕성 진입!!! 고대 화염룡이 기다리고 있다!!!',
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

/* 물 속 여부 판정 */
var _inWater=false;
var _waterDepth=0;/* 0=지상, 양수=물에 잠긴 깊이 */

function isOverWater(x,z){
  /* 중앙 남북 강: x≈0, z:-400~500 */
  if(z>-400&&z<500&&Math.abs(x-RIVER_CENTER_X)<RIVER_HALF_W)return true;
  /* 동서 분기: z≈0 부근, x:-400~-10 또는 x:10~400 */
  if(Math.abs(z)<RIVER_HALF_W&&(Math.abs(x)>10&&Math.abs(x)<400))return true;
  return false;
}

function handleMove(dt){
  tickAtkAnim(dt);
  /* 상태이상 틱 */
  if(playerPoisoned>0){
    playerPoisoned-=dt;
    if(playerPoisoned<=0){playerPoisoned=0;addChat('inf','','독이 해제되었다.');}
    else{
      playerHP=Math.max(1,Math.floor(playerHP-playerPoisonDmg*dt));
      updPlayerHpBar();
    }
  }
  if(playerSlowed>0)playerSlowed-=dt;

  /* ── 물 물리 (건물 내부에서는 스킵) ── */
  if(typeof insideBuilding!=='undefined'&&insideBuilding){_inWater=false;_waterDepth=0;_waterDmgTimer=0;}
  var px=PL.group.position.x,pz=PL.group.position.z;
  var wasInWater=_inWater;
  if(!(typeof insideBuilding!=='undefined'&&insideBuilding))_inWater=isOverWater(px,pz);
  if(_inWater){
    /* 물에 들어가면 Y 서서히 낮아짐 */
    _waterDepth=Math.min(_waterDepth+dt*1.5,0.8);
    PL.group.position.y=-_waterDepth;
    if(!wasInWater)addChat('inf','','물에 빠졌다! 이동이 느려진다.');
    /* 물 데미지: 5초마다 2 데미지 */
    _waterDmgTimer=(_waterDmgTimer||0)+dt;
    if(_waterDmgTimer>5){
      _waterDmgTimer=0;
      playerHP=Math.max(1,playerHP-2);
      updPlayerHpBar();
    }
  }else{
    /* 물 밖으로 나오면 Y 복귀 */
    if(_waterDepth>0){
      _waterDepth=Math.max(0,_waterDepth-dt*3);
      if(_waterDepth===0&&wasInWater)addChat('inf','','강에서 빠져나왔다.');
    }
    _waterDmgTimer=0;
  }

  var dx=0,dz=0;
  if(typeof insideBuilding!=='undefined'&&insideBuilding){
    /* 건물 내부: 화면 기준 상하좌우 (탑다운) */
    if(keys['w']||keys['arrowup'])dz=-1;
    if(keys['s']||keys['arrowdown'])dz=1;
    if(keys['a']||keys['arrowleft'])dx=-1;
    if(keys['d']||keys['arrowright'])dx=1;
  }else{
    if(keys['w']||keys['arrowup']){dx-=Math.sin(cYaw);dz-=Math.cos(cYaw);}
    if(keys['s']||keys['arrowdown']){dx+=Math.sin(cYaw);dz+=Math.cos(cYaw);}
    if(keys['a']||keys['arrowleft']){dx-=Math.cos(cYaw);dz+=Math.sin(cYaw);}
    if(keys['d']||keys['arrowright']){dx+=Math.cos(cYaw);dz-=Math.sin(cYaw);}
  }
  var moving=dx!==0||dz!==0;
  if(moving){
    var len=Math.sqrt(dx*dx+dz*dz);dx/=len;dz/=len;
    var spdMul=(CLASS_DEFS[playerClass]||CLASS_DEFS.none).spdMul;
    if(playerSlowed>0)spdMul*=0.4;/* 둔화 시 60% 감속 */
    if(_inWater)spdMul*=0.35;/* 물 속 65% 감속 */
    var spd=6.0*spdMul*dt,nx=PL.group.position.x+dx*spd,nz=PL.group.position.z+dz*spd;
    /* 건물 내부에서는 벽 안으로 제한 */
    if(typeof insideBuilding!=='undefined'&&insideBuilding){
      var _iw=insideBuilding==='모험가 길드'?14:9;
      if(nx>-_iw&&nx<_iw)PL.group.position.x=nx;
      if(nz>-_iw&&nz<_iw)PL.group.position.z=nz;
    }else{
      var _icx=ISLAND_CENTER_X,_icz=ISLAND_CENTER_Z;
      var _irx=ISLAND_RADIUS_X,_irz=ISLAND_RADIUS_Z;
      var _exN=(nx-_icx)/_irx,_ezN=(PL.group.position.z-_icz)/_irz;
      var _exC=(PL.group.position.x-_icx)/_irx,_ezZ=(nz-_icz)/_irz;
      if(_exN*_exN+_ezN*_ezN<1&&!hitCollider(nx,PL.group.position.z))PL.group.position.x=nx;
      if(_exC*_exC+_ezZ*_ezZ<1&&!hitCollider(PL.group.position.x,nz))PL.group.position.z=nz;
    }
    PL.group.rotation.y=Math.atan2(dx,dz);PL.bobT+=dt*9;
    var wa=.32;
    PL.legL.rotation.x=Math.sin(PL.bobT)*wa;
    PL.legR.rotation.x=-Math.sin(PL.bobT)*wa;
    PL.armL.rotation.x=-Math.sin(PL.bobT)*wa*.5;
    if(PL.atkPhase===0)PL.armRPivot.rotation.x=Math.sin(PL.bobT)*wa*.5;
    if(!_inWater&&!(typeof insideBuilding!=='undefined'&&insideBuilding)){
      var _ty=typeof getTerrainY==='function'?getTerrainY(PL.group.position.x,PL.group.position.z):0;
      PL.group.position.y=_ty+Math.abs(Math.sin(PL.bobT))*.06;
    }
  }else{
    PL.legL.rotation.x*=.8;PL.legR.rotation.x*=.8;PL.armL.rotation.x*=.8;
    if(PL.atkPhase===0)PL.armRPivot.rotation.x*=.8;
    if(!_inWater&&!(typeof insideBuilding!=='undefined'&&insideBuilding)){
      var _ty2=typeof getTerrainY==='function'?getTerrainY(PL.group.position.x,PL.group.position.z):0;
      PL.group.position.y=_ty2+(PL.group.position.y-_ty2)*.8;
    }
  }
}
var _waterDmgTimer=0;
