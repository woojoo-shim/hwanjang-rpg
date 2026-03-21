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
var COLLIDERS=[];
/* 마을 콜라이더는 initVillageColliders에서 동적으로 설정 (타일맵 로드 후) */
function initVillageColliders(vx,vz){
  COLLIDERS=[
    /* 성 */      [vx,vz-22,7,6],
    /* 분수 */    [vx,vz,4.2,4.2],
    /* 상점들 */  [vx-14,vz+2,1.5,1],[vx-14,vz-5,1.5,1],[vx+14,vz+2,1.5,1],[vx+14,vz-5,1.5,1],[vx-6,vz-10,1.5,1],[vx+6,vz-10,1.5,1],
  ];
}
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

function flashMonster(m){
  var mats=[];
  m.mesh.traverse(function(c){
    if(c.isMesh){
      mats.push({mesh:c,orig:c.material});
      c.material=new THREE.MeshLambertMaterial({color:0xff2200,emissive:new THREE.Color(0xff1100),emissiveIntensity:.8});
    }
  });
  setTimeout(function(){
    mats.forEach(function(o){o.mesh.material=o.orig;});
  },160);
}

function playerAttack(){
  if(attackCooldown>0)return;
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
  var baseAtk=5;
  if(equipped.weapon){
    var wi=getItemFull(inventory.find(function(s){return s.itemId===equipped.weapon;})||{itemId:''});
    if(wi&&wi.stats&&wi.stats['공격력'])baseAtk=parseInt(wi.stats['공격력'])||5;
  }
  var dmg=baseAtk+Math.floor(Math.random()*5);
  target.hp=Math.max(0,target.hp-dmg);
  target.hbf.style.width=Math.max(0,target.hp/target.maxHp*100)+'%';
  attackCooldown=.75;
  triggerAtkAnim();
  if(typeof sendAttackMP==='function')sendAttackMP();
  var ddx=target.mesh.position.x-PL.group.position.x;
  var ddz=target.mesh.position.z-PL.group.position.z;
  PL.group.rotation.y=Math.atan2(ddx,ddz);
  spawnDmgNum('-'+dmg,'#ffdd44');
  flashMonster(target);
  target.state='aggro';
  if(target.hp<=0)killMonster(target);
}

function killMonster(m){
  m.state='dead';m.mesh.visible=false;m.wrap.style.display='none';
  playerEXP+=m.def.exp;
  addChat('sys','[시스템]',m.def.name+' 처치! (EXP +'+m.def.exp+')');
  checkLevelUp();
  if(typeof onMonsterKill==='function')onMonsterKill(m.def.name);
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
    m.mesh.visible=true;m.wrap.style.display='';m.hbf.style.width='100%';
    m.state='idle';m.attackTimer=0;
  },30000);
}

function playerDied(){
  addChat('sys','[시스템]','쓰러졌습니다. 마을로 귀환...');
  playerHP=Math.floor(playerMaxHP*.4);
  invincibleTimer=4;updPlayerHpBar();
  PL.group.position.set(WORLD_SPAWN[0],0,WORLD_SPAWN[1]);
  currentZone='village';
  /* 분위기 복원 */
  scene.fog=new THREE.Fog(0x0a1510,50,160);scene.background=new THREE.Color(0x0a1510);
  var zi=ZONE_INFO['village'];
  document.querySelector('.hloc').textContent='▸ '+zi.name;
}

function checkLevelUp(){
  var need=playerLevel*100;
  if(playerEXP>=need){
    playerEXP-=need;playerLevel++;playerMaxHP+=20;playerHP=playerMaxHP;
    document.querySelector('.hlv').textContent='Lv.'+playerLevel;
    updPlayerHpBar();
    addChat('sys','[시스템]','★ 레벨 UP! Lv.'+playerLevel+' 달성! (최대 HP +20)');
    gold+=50;document.getElementById('inv-gold').textContent='💰 '+gold+' 골드';
  }
  var ef=document.getElementById('exp-bar-fill');
  if(ef)ef.style.width=Math.min(100,playerEXP/(playerLevel*100)*100)+'%';
}

function updPlayerHpBar(){
  document.querySelectorAll('.hbf.hp').forEach(function(f){f.style.width=(playerHP/playerMaxHP*100)+'%';});
  var vals=document.querySelectorAll('.hbv');
  if(vals[0])vals[0].textContent=playerHP+'/'+playerMaxHP;
}

/* checkZone — 타일맵 기반 존 감지 + 분위기 전환 */
function checkZone(){
  var px=PL.group.position.x,pz=PL.group.position.z;
  var terrain=getTerrainAt(px,pz);

  /* 마을 판정: 성 주변 반경 내이면 village */
  var newZone;
  var castleWP=(typeof tileToWorld==='function')?tileToWorld(10,10):{x:0,z:0};
  var cdx=px-castleWP.x,cdz=pz-castleWP.z;
  if(Math.sqrt(cdx*cdx+cdz*cdz)<25){
    newZone='village';
  } else {
    newZone=terrain;
  }

  if(newZone!==currentZone){
    var prevZone=currentZone;
    currentZone=newZone;

    /* 분위기 전환 — 지형 타입별 안개/배경 */
    var fogConfig={
      village:      {fog:0x0a1510,near:50,far:160},
      plains:       {fog:0x1a3010,near:50,far:160},
      forest:       {fog:0x0a1a08,near:30,far:100},
      dark_forest:  {fog:0x020202,near:8,far:45},
      mountain:     {fog:0x1a1510,near:30,far:100},
      snow:         {fog:0xc8d8e8,near:20,far:80},
      desert:       {fog:0x2a1a0a,near:40,far:120},
      volcano:      {fog:0x100500,near:12,far:55},
      lake:         {fog:0x0a1520,near:40,far:130},
      wetland:      {fog:0x050a05,near:15,far:60},
      highlands:    {fog:0x1a0a08,near:35,far:110},
      water_city:   {fog:0x051520,near:30,far:100},
      ocean:        {fog:0x0a1530,near:20,far:80},
      beach:        {fog:0x1a2010,near:50,far:150},
    };
    var fc=fogConfig[newZone]||fogConfig.plains;
    scene.fog=new THREE.Fog(fc.fog,fc.near,fc.far);
    scene.background=new THREE.Color(fc.fog);

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
      plains:'초원 진입. 토끼와 사슴이 있습니다.',
      forest:'숲 진입. 주변을 살펴보세요.',
      wetland:'습지 진입! 슬라임과 독두꺼비가 나타납니다.',
      dark_forest:'미혹의 숲 진입! 고블린과 늑대를 조심하세요!',
      volcano:'화산 지대 진입!! 용암 골렘과 드레이크가 기다립니다!!',
      village:'마을로 귀환. HP 일부 회복.',
      mountain:'죽음의 산 진입! 험난한 길을 조심하세요.',
      snow:'설산 진입. 눈보라가 몰아칩니다.',
      desert:'사막 진입. 뜨거운 모래바람을 조심하세요.',
      lake:'호수 지역 진입. 맑은 물이 반짝입니다.',
      highlands:'고원 진입. 붉은 단풍이 아름답습니다.',
      water_city:'조라의 마을 진입. 수중 종족의 영역입니다.',
      ocean:'대해 진입! 깊은 바다에 주의하세요.',
      beach:'해변 진입. 파도 소리가 들립니다.',
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
    var spd=6.0*dt,nx=PL.group.position.x+dx*spd,nz=PL.group.position.z+dz*spd;
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
