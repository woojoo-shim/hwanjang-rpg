/*
 * monster.js — 몬스터 메쉬 생성, 오픈 월드 스폰, AI/업데이트 루프
 *
 * 의존성 (런타임 전역 참조):
 *   config.js   → MONSTER_DEFS
 *   ui.js       → addChat, posEl
 *   player.js   → PL, playerHP, invincibleTimer, attackCooldown,
 *                  updPlayerHpBar, spawnDmgNum, playerDied
 *   world.js    → scene, mkTree
 *
 * 이 파일이 선언하는 전역:
 *   monsters, closestMonster, currentZone, buildOpenWorld
 */

var monsters=[];
var closestMonster=null;
var currentZone='village';
var targetedMonster=null;

/* ── 성능 최적화: 상수 객체 — 매 프레임 생성 방지 ── */
var _ATK_RANGES={toad:3.5,jungle_snake:3.0,golem:4.0,firedrake:5.0,jungle_treant:3.5,jungle_mosquito:2.5,elite_stag:3.0,elite_toad:4.5,elite_wolf:2.5,elite_ape:4.0,elite_dragon:6.0};
var _ATK_SPEEDS={rabbit:0.6,jungle_mosquito:0.35,jungle_panther:0.3,wolf:0.5,goblin:0.7,deer:0.9,slime:1.0,toad:1.0,jungle_snake:0.8,jungle_spider:0.7,jungle_ape:1.3,jungle_treant:2.0,golem:2.5,firedrake:2.0,elite_stag:1.0,elite_toad:1.2,elite_wolf:0.7,elite_ape:1.5,elite_dragon:2.5};

/* 몬스터별 추적 범위 (서식지 크기) */
function getLeashRange(mid){
  var ranges={
    rabbit:200,       /* 초원 전체 */
    deer:150,         /* 초원 넓게 */
    slime:80,         /* 늪 중간 */
    toad:80,          /* 늪 중간 */
    goblin:120,       /* 어두운 숲 넓게 */
    wolf:150,         /* 어두운 숲 전체 */
    jungle_spider:100,/* 정글 넓게 */
    jungle_snake:90,  /* 정글 중간 */
    jungle_ape:110,   /* 정글 넓게 */
    jungle_panther:160,/* 정글 전체 — 빠르니까 */
    jungle_mosquito:130,/* 정글 넓게 */
    jungle_treant:50, /* 느려서 좁게 */
    golem:60,         /* 화산 중간 */
    firedrake:120,    /* 화산 넓게 */
  };
  return ranges[mid]||40;
}

/* Tab 타겟팅 — 가장 가까운 살아있는 몬스터 선택 */
function targetNearestMonster(){
  if(!PL.group)return;
  var px=PL.group.position.x,pz=PL.group.position.z;
  var best=null,bestD=Infinity;
  for(var i=0;i<monsters.length;i++){
    var m=monsters[i];
    if(m.hp<=0||!m.mesh)continue;
    var dx=m.mesh.position.x-px,dz=m.mesh.position.z-pz;
    var d=dx*dx+dz*dz;
    if(d<bestD){bestD=d;best=m;}
  }
  if(best&&bestD<80*80){
    targetedMonster=best;
    addChat('sys','[시스템]','🎯 '+best.def.name+' 타겟!');
  }else{
    targetedMonster=null;
    addChat('sys','[시스템]','주변에 몬스터가 없습니다.');
  }
}

/* ════════════ 바닥 장판 시스템 (용암/화염) ════════════ */
var groundEffects=[];
var _lavaMat=null,_fireMat=null;

function spawnLavaPool(x,z,radius,duration){
  if(!_lavaMat)_lavaMat=new THREE.MeshBasicMaterial({color:0xff4400,transparent:true,opacity:0.6,side:THREE.DoubleSide});
  var geo=new THREE.CircleGeometry(radius,12);
  var mesh=new THREE.Mesh(geo,_lavaMat.clone());
  mesh.rotation.x=-Math.PI/2;
  mesh.position.set(x,0.05,z);
  scene.add(mesh);
  groundEffects.push({mesh:mesh,x:x,z:z,radius:radius,life:duration,maxLife:duration,dmg:8,type:'lava'});
}

function spawnFireBreath(sx,sz,dirX,dirZ,length){
  if(!_fireMat)_fireMat=new THREE.MeshBasicMaterial({color:0xff6600,transparent:true,opacity:0.5,side:THREE.DoubleSide});
  /* 직선 불길: 여러 원형 장판을 직선으로 배치 */
  for(var i=1;i<=4;i++){
    var d=i*(length/4);
    var fx=sx+dirX*d,fz=sz+dirZ*d;
    var geo=new THREE.CircleGeometry(1.5+i*0.3,8);
    var mesh=new THREE.Mesh(geo,_fireMat.clone());
    mesh.rotation.x=-Math.PI/2;
    mesh.position.set(fx,0.05,fz);
    scene.add(mesh);
    groundEffects.push({mesh:mesh,x:fx,z:fz,radius:1.5+i*0.3,life:3,maxLife:3,dmg:12,type:'fire'});
  }
}

function updateGroundEffects(dt){
  var px=PL.group.position.x,pz=PL.group.position.z;
  for(var i=groundEffects.length-1;i>=0;i--){
    var ef=groundEffects[i];
    ef.life-=dt;
    /* 투명도 서서히 감소 */
    ef.mesh.material.opacity=Math.max(0,0.6*(ef.life/ef.maxLife));
    /* 플레이어가 장판 위에 있으면 데미지 */
    var edx=px-ef.x,edz=pz-ef.z;
    if(Math.sqrt(edx*edx+edz*edz)<ef.radius&&invincibleTimer<=0){
      playerHP=Math.max(1,Math.floor(playerHP-ef.dmg*dt));
      updPlayerHpBar();
    }
    if(ef.life<=0){
      scene.remove(ef.mesh);
      ef.mesh.geometry.dispose();
      ef.mesh.material.dispose();
      groundEffects.splice(i,1);
    }
  }
}

function mkMonsterMesh(def){
  var g=new THREE.Group();
  var bm=new THREE.MeshLambertMaterial({color:def.color});
  var hm=new THREE.MeshLambertMaterial({color:def.hc});

  if(def.id==='rabbit'){
    var bodyM=new THREE.MeshLambertMaterial({color:0xeeeeee});
    var bellyM=new THREE.MeshLambertMaterial({color:0xffdddd});
    var eyeM=new THREE.MeshBasicMaterial({color:0xff3366});
    var body=new THREE.Mesh(new THREE.SphereGeometry(.38,8,8),bodyM);
    body.scale.set(1,.85,1.1);body.position.set(0,.42,0);g.add(body);
    var belly=new THREE.Mesh(new THREE.SphereGeometry(.22,8,8),bellyM);
    belly.scale.set(1,.7,1);belly.position.set(0,.38,.22);g.add(belly);
    var head=new THREE.Mesh(new THREE.SphereGeometry(.26,8,8),bodyM);
    head.position.set(0,.82,.12);g.add(head);
    var nose=new THREE.Mesh(new THREE.SphereGeometry(.05,6,6),bellyM);
    nose.position.set(0,.82,.36);g.add(nose);
    [-0.1,0.1].forEach(function(ex){
      var eye=new THREE.Mesh(new THREE.SphereGeometry(.05,6,6),eyeM);
      eye.position.set(ex,.9,.32);g.add(eye);
    });
    var earM=new THREE.MeshLambertMaterial({color:0xeeeeee});
    var earInM=new THREE.MeshLambertMaterial({color:0xffaaaa});
    [-0.1,0.1].forEach(function(ex){
      var earOut=new THREE.Mesh(new THREE.BoxGeometry(.1,.5,.06),earM);
      earOut.position.set(ex,1.28,.06);g.add(earOut);
      var earIn=new THREE.Mesh(new THREE.BoxGeometry(.06,.36,.04),earInM);
      earIn.position.set(ex,1.28,.07);g.add(earIn);
    });
    var fpM=new THREE.MeshLambertMaterial({color:0xdddddd});
    [-0.18,0.18].forEach(function(ex){
      var fp=new THREE.Mesh(new THREE.BoxGeometry(.1,.2,.1),fpM);
      fp.position.set(ex,.18,.28);g.add(fp);
    });
    [-0.16,0.16].forEach(function(ex){
      var leg=new THREE.Mesh(new THREE.BoxGeometry(.13,.22,.13),fpM);
      leg.position.set(ex,.11,-.1);g.add(leg);
    });
    var tail=new THREE.Mesh(new THREE.SphereGeometry(.1,6,6),bodyM);
    tail.position.set(0,.4,-.38);g.add(tail);

  } else if(def.id==='deer'){
    var bodyM=new THREE.MeshLambertMaterial({color:0x8a5a20});
    var bellyM=new THREE.MeshLambertMaterial({color:0xccaa66});
    var legM=new THREE.MeshLambertMaterial({color:0x6a3a10});
    var antlerM=new THREE.MeshLambertMaterial({color:0x7a5520});
    var eyeM=new THREE.MeshBasicMaterial({color:0x111111});
    var body=new THREE.Mesh(new THREE.BoxGeometry(.6,.52,.9),bodyM);
    body.position.set(0,.85,0);g.add(body);
    var belly=new THREE.Mesh(new THREE.BoxGeometry(.4,.3,.7),bellyM);
    belly.position.set(0,.72,.05);g.add(belly);
    var neck=new THREE.Mesh(new THREE.BoxGeometry(.22,.4,.22),bodyM);
    neck.position.set(0,1.18,.3);neck.rotation.x=-.35;g.add(neck);
    var head=new THREE.Mesh(new THREE.BoxGeometry(.32,.3,.38),bodyM);
    head.position.set(0,1.42,.52);g.add(head);
    var snout=new THREE.Mesh(new THREE.BoxGeometry(.2,.2,.24),bellyM);
    snout.position.set(0,1.36,.7);g.add(snout);
    [-0.12,0.12].forEach(function(ex){
      var eye=new THREE.Mesh(new THREE.SphereGeometry(.045,6,6),eyeM);
      eye.position.set(ex,1.5,.62);g.add(eye);
    });
    [-0.22,0.22].forEach(function(ex){
      var ear=new THREE.Mesh(new THREE.BoxGeometry(.08,.16,.05),bellyM);
      ear.position.set(ex,1.6,.44);g.add(ear);
    });
    [[-0.2,.35],[-0.2,-.35],[.2,.35],[.2,-.35]].forEach(function(p){
      var lx=p[0],lz=p[1];
      var leg=new THREE.Mesh(new THREE.BoxGeometry(.14,.55,.14),legM);
      leg.position.set(lx,.28,lz);g.add(leg);
      var hoof=new THREE.Mesh(new THREE.BoxGeometry(.16,.12,.16),new THREE.MeshLambertMaterial({color:0x220800}));
      hoof.position.set(lx,.02,lz);g.add(hoof);
    });
    [-0.14,0.14].forEach(function(ex){
      var base=new THREE.Mesh(new THREE.CylinderGeometry(.03,.05,.4,5),antlerM);
      base.position.set(ex,1.75,.35);base.rotation.z=ex>0?.15:-.15;g.add(base);
      var branch=new THREE.Mesh(new THREE.CylinderGeometry(.02,.03,.3,5),antlerM);
      branch.position.set(ex+(ex>0?.15:-.15),1.95,.25);branch.rotation.z=ex>0?.6:-.6;g.add(branch);
      var tip=new THREE.Mesh(new THREE.CylinderGeometry(.01,.02,.22,5),antlerM);
      tip.position.set(ex,2.04,.28);g.add(tip);
    });
    var tail=new THREE.Mesh(new THREE.SphereGeometry(.09,6,6),bellyM);
    tail.position.set(0,.95,-.48);g.add(tail);

  } else if(def.id==='slime'){
    var sliM=new THREE.MeshLambertMaterial({color:0x33cc44,emissive:new THREE.Color(0x116622),emissiveIntensity:.25});
    var eyeM=new THREE.MeshBasicMaterial({color:0x002200});
    var hiM=new THREE.MeshLambertMaterial({color:0x88ffaa,emissive:new THREE.Color(0x44ff88),emissiveIntensity:.3});
    var body=new THREE.Mesh(new THREE.SphereGeometry(.48,10,8),sliM);
    body.scale.set(1,.72,1);body.position.set(0,.38,0);g.add(body);
    var hi=new THREE.Mesh(new THREE.SphereGeometry(.18,8,8),hiM);
    hi.position.set(.06,.62,.1);g.add(hi);
    [-0.16,0.16].forEach(function(ex){
      var white=new THREE.Mesh(new THREE.SphereGeometry(.1,8,8),new THREE.MeshLambertMaterial({color:0xffffff}));
      white.position.set(ex,.44,.38);g.add(white);
      var pupil=new THREE.Mesh(new THREE.SphereGeometry(.055,6,6),eyeM);
      pupil.position.set(ex,.44,.46);g.add(pupil);
    });
    var mouthM=new THREE.MeshBasicMaterial({color:0x002200});
    [-0.08,0,0.08].forEach(function(mx){
      var mt=new THREE.Mesh(new THREE.BoxGeometry(.05,.04,.04),mouthM);
      mt.position.set(mx,.32,.46);g.add(mt);
    });
    var ripple=new THREE.Mesh(new THREE.CylinderGeometry(.52,.56,.04,12),sliM);
    ripple.position.set(0,.04,0);g.add(ripple);

  } else if(def.id==='goblin'){
    var skinM=new THREE.MeshLambertMaterial({color:0x336611});
    var darkM=new THREE.MeshLambertMaterial({color:0x224408});
    var eyeM=new THREE.MeshBasicMaterial({color:0xffff00});
    var pupilM=new THREE.MeshBasicMaterial({color:0x000000});
    var clothM=new THREE.MeshLambertMaterial({color:0x3a2a10});
    var weaponM=new THREE.MeshLambertMaterial({color:0x888866});
    var body=new THREE.Mesh(new THREE.BoxGeometry(.5,.7,.32),clothM);
    body.position.set(0,.68,0);g.add(body);
    var head=new THREE.Mesh(new THREE.BoxGeometry(.48,.44,.44),skinM);
    head.position.set(0,1.26,0);g.add(head);
    var nose=new THREE.Mesh(new THREE.SphereGeometry(.1,6,6),darkM);
    nose.scale.set(1.2,.8,1.4);nose.position.set(0,1.24,.24);g.add(nose);
    [-0.13,0.13].forEach(function(ex){
      var eye=new THREE.Mesh(new THREE.SphereGeometry(.08,6,6),eyeM);
      eye.position.set(ex,1.34,.22);g.add(eye);
      var pupil=new THREE.Mesh(new THREE.SphereGeometry(.04,5,5),pupilM);
      pupil.position.set(ex,1.34,.28);g.add(pupil);
    });
    [-0.28,0.28].forEach(function(ex){
      var ear=new THREE.Mesh(new THREE.ConeGeometry(.08,.22,5),skinM);
      ear.position.set(ex,1.38,0);ear.rotation.z=ex>0?.5:-.5;g.add(ear);
    });
    [-0.06,0.06].forEach(function(tx){
      var tooth=new THREE.Mesh(new THREE.BoxGeometry(.06,.1,.05),new THREE.MeshLambertMaterial({color:0xeeddaa}));
      tooth.position.set(tx,1.12,.24);g.add(tooth);
    });
    var armG=new THREE.BoxGeometry(.16,.5,.16);
    [-0.36,0.36].forEach(function(ax){
      var arm=new THREE.Mesh(armG,skinM);arm.position.set(ax,.72,0);g.add(arm);
    });
    [-0.14,0.14].forEach(function(lx){
      var leg=new THREE.Mesh(new THREE.BoxGeometry(.18,.42,.18),darkM);
      leg.position.set(lx,.21,0);g.add(leg);
    });
    var blade=new THREE.Mesh(new THREE.BoxGeometry(.06,.5,.04),weaponM);
    blade.position.set(.52,.72,.0);blade.rotation.z=.3;g.add(blade);
    var hilt=new THREE.Mesh(new THREE.BoxGeometry(.16,.06,.06),new THREE.MeshLambertMaterial({color:0x5a3010}));
    hilt.position.set(.44,.54,.0);g.add(hilt);

  } else if(def.id==='toad'){
    var bM=new THREE.MeshLambertMaterial({color:0x446622});
    var spotM=new THREE.MeshLambertMaterial({color:0x334418});
    var eyeM=new THREE.MeshLambertMaterial({color:0xaadd00,emissive:new THREE.Color(0x446600),emissiveIntensity:.3});
    var pupilM=new THREE.MeshBasicMaterial({color:0x000000});
    var body=new THREE.Mesh(new THREE.SphereGeometry(.55,10,8),bM);
    body.scale.set(1.2,.55,1.1);body.position.set(0,.38,0);g.add(body);
    [[-.22,.55,-.08],[.18,.52,-.1],[0,.6,.05]].forEach(function(p){
      var wart=new THREE.Mesh(new THREE.SphereGeometry(.1,6,6),spotM);wart.position.set(p[0],p[1],p[2]);g.add(wart);
    });
    var head=new THREE.Mesh(new THREE.SphereGeometry(.38,10,8),bM);
    head.scale.set(1.1,.7,1);head.position.set(0,.72,.18);g.add(head);
    [-0.2,0.2].forEach(function(ex){
      var eyeball=new THREE.Mesh(new THREE.SphereGeometry(.14,8,8),eyeM);
      eyeball.position.set(ex,.88,.32);g.add(eyeball);
      var pupil=new THREE.Mesh(new THREE.SphereGeometry(.07,6,6),pupilM);
      pupil.position.set(ex,.88,.44);g.add(pupil);
    });
    var mouthM=new THREE.MeshLambertMaterial({color:0x223310});
    var mouth=new THREE.Mesh(new THREE.BoxGeometry(.38,.06,.06),mouthM);
    mouth.position.set(0,.66,.4);g.add(mouth);
    [[-0.32,.15,-.22],[.32,.15,-.22]].forEach(function(p){
      var lx=p[0],ly=p[1],lz=p[2];
      var upper=new THREE.Mesh(new THREE.BoxGeometry(.18,.18,.38),bM);upper.position.set(lx,ly,lz);g.add(upper);
      var lower=new THREE.Mesh(new THREE.BoxGeometry(.14,.12,.28),bM);lower.position.set(lx*1.2,ly*.5,lz-.3);g.add(lower);
    });
    [[-0.38,.18,.22],[.38,.18,.22]].forEach(function(p){
      var lx=p[0],ly=p[1],lz=p[2];
      var leg=new THREE.Mesh(new THREE.BoxGeometry(.14,.14,.28),bM);leg.position.set(lx,ly,lz);g.add(leg);
    });
    var toxM=new THREE.MeshLambertMaterial({color:0x88ff44,emissive:new THREE.Color(0x44aa00),emissiveIntensity:.4,transparent:true,opacity:.7});
    var tox=new THREE.Mesh(new THREE.SphereGeometry(.09,6,6),toxM);tox.position.set(.2,.65,.3);g.add(tox);

  } else if(def.id==='wolf'){
    var furM=new THREE.MeshLambertMaterial({color:0x555566});
    var darkM=new THREE.MeshLambertMaterial({color:0x333344});
    var bellyM=new THREE.MeshLambertMaterial({color:0x888899});
    var eyeM=new THREE.MeshLambertMaterial({color:0xffaa00,emissive:new THREE.Color(0xaa6600),emissiveIntensity:.5});
    var fangM=new THREE.MeshLambertMaterial({color:0xffffff});
    var body=new THREE.Mesh(new THREE.BoxGeometry(.5,.5,.9),furM);body.position.set(0,.7,0);g.add(body);
    var belly=new THREE.Mesh(new THREE.BoxGeometry(.3,.28,.65),bellyM);belly.position.set(0,.6,.05);g.add(belly);
    var neck=new THREE.Mesh(new THREE.BoxGeometry(.24,.32,.3),furM);neck.position.set(0,.98,.4);neck.rotation.x=-.2;g.add(neck);
    var head=new THREE.Mesh(new THREE.BoxGeometry(.36,.32,.3),furM);head.position.set(0,1.15,.62);g.add(head);
    var snout=new THREE.Mesh(new THREE.BoxGeometry(.22,.2,.38),darkM);snout.position.set(0,1.06,.86);g.add(snout);
    [-0.13,0.13].forEach(function(ex){
      var eye=new THREE.Mesh(new THREE.SphereGeometry(.06,6,6),eyeM);eye.position.set(ex,1.24,.72);g.add(eye);
    });
    [-0.14,0.14].forEach(function(ex){
      var ear=new THREE.Mesh(new THREE.ConeGeometry(.08,.2,4),furM);
      ear.position.set(ex,1.4,.54);ear.rotation.z=ex>0?.2:-.2;g.add(ear);
    });
    [-0.06,0.06].forEach(function(tx){
      var fang=new THREE.Mesh(new THREE.ConeGeometry(.03,.1,4),fangM);
      fang.position.set(tx,.98,.94);fang.rotation.x=Math.PI;g.add(fang);
    });
    [[-0.18,.38],[-0.18,-.38],[.18,.38],[.18,-.38]].forEach(function(p){
      var lx=p[0],lz=p[1];
      var leg=new THREE.Mesh(new THREE.BoxGeometry(.14,.5,.14),furM);leg.position.set(lx,.25,lz);g.add(leg);
      var paw=new THREE.Mesh(new THREE.BoxGeometry(.18,.1,.22),darkM);paw.position.set(lx,.02,lz+.06);g.add(paw);
    });
    var tail=new THREE.Mesh(new THREE.CylinderGeometry(.05,.08,.6,6),furM);
    tail.position.set(0,.92,-.52);tail.rotation.x=.8;g.add(tail);

  } else if(def.id==='golem'){
    var rockM=new THREE.MeshLambertMaterial({color:0x443322});
    var lavaM=new THREE.MeshLambertMaterial({color:0xff4400,emissive:new THREE.Color(0xff2200),emissiveIntensity:.8});
    var crackM=new THREE.MeshLambertMaterial({color:0xff6600,emissive:new THREE.Color(0xff4400),emissiveIntensity:.6});
    var body=new THREE.Mesh(new THREE.BoxGeometry(1.1,1.2,.8),rockM);body.position.set(0,.9,0);g.add(body);
    var crack1=new THREE.Mesh(new THREE.BoxGeometry(.08,1.0,.06),crackM);crack1.position.set(.2,.9,.41);g.add(crack1);
    var crack2=new THREE.Mesh(new THREE.BoxGeometry(.06,.7,.06),crackM);crack2.position.set(-.25,.7,.41);g.add(crack2);
    var head=new THREE.Mesh(new THREE.BoxGeometry(.8,.7,.7),rockM);head.position.set(0,1.85,0);g.add(head);
    [-0.2,0.2].forEach(function(ex){
      var eye=new THREE.Mesh(new THREE.SphereGeometry(.13,8,8),lavaM);eye.position.set(ex,1.98,.36);g.add(eye);
    });
    [[-0.7,1.3],[.7,1.3]].forEach(function(p){
      var sh=new THREE.Mesh(new THREE.SphereGeometry(.28,6,6),rockM);sh.position.set(p[0],p[1],0);g.add(sh);
    });
    [[-0.75,.8,.1],[.75,.8,.1]].forEach(function(p){
      var ax=p[0],ay=p[1],az=p[2];
      var arm=new THREE.Mesh(new THREE.BoxGeometry(.36,.9,.3),rockM);arm.position.set(ax,ay,az);g.add(arm);
      var fist=new THREE.Mesh(new THREE.BoxGeometry(.42,.38,.38),rockM);fist.position.set(ax,.28,az);g.add(fist);
      var fc=new THREE.Mesh(new THREE.BoxGeometry(.06,.3,.06),crackM);fc.position.set(ax,.28,az+.2);g.add(fc);
    });
    [-0.28,.28].forEach(function(lx){
      var leg=new THREE.Mesh(new THREE.BoxGeometry(.36,.52,.36),rockM);leg.position.set(lx,.26,0);g.add(leg);
    });
    var lavaLight=new THREE.PointLight(0xff4400,1.5,6);lavaLight.position.set(0,1,0);g.add(lavaLight);

  } else if(def.id==='firedrake'){
    var scaleM=new THREE.MeshLambertMaterial({color:0xcc2200});
    var bellyM=new THREE.MeshLambertMaterial({color:0xff8844});
    var wingM=new THREE.MeshLambertMaterial({color:0x992200,emissive:new THREE.Color(0x440000),emissiveIntensity:.2,transparent:true,opacity:.85});
    var hornM=new THREE.MeshLambertMaterial({color:0x221100});
    var fireM=new THREE.MeshLambertMaterial({color:0xffaa00,emissive:new THREE.Color(0xff6600),emissiveIntensity:.9});
    var body=new THREE.Mesh(new THREE.BoxGeometry(.65,.7,.95),scaleM);body.position.set(0,.85,0);g.add(body);
    var belly=new THREE.Mesh(new THREE.BoxGeometry(.38,.5,.75),bellyM);belly.position.set(0,.72,.05);g.add(belly);
    var neck=new THREE.Mesh(new THREE.BoxGeometry(.3,.45,.28),scaleM);neck.position.set(0,1.28,.35);neck.rotation.x=-.3;g.add(neck);
    var head=new THREE.Mesh(new THREE.BoxGeometry(.42,.38,.42),scaleM);head.position.set(0,1.58,.55);g.add(head);
    var snout=new THREE.Mesh(new THREE.BoxGeometry(.28,.22,.36),scaleM);snout.position.set(0,1.5,.82);g.add(snout);
    var flame=new THREE.Mesh(new THREE.ConeGeometry(.1,.28,6),fireM);flame.position.set(0,1.48,1.04);flame.rotation.x=Math.PI/2;g.add(flame);
    [-0.15,0.15].forEach(function(ex){
      var eye=new THREE.Mesh(new THREE.SphereGeometry(.07,6,6),fireM);eye.position.set(ex,1.7,.72);g.add(eye);
    });
    [-0.15,0.15].forEach(function(ex){
      var horn=new THREE.Mesh(new THREE.ConeGeometry(.06,.3,5),hornM);
      horn.position.set(ex,1.88,.44);horn.rotation.z=ex>0?.25:-.25;g.add(horn);
    });
    [-1,1].forEach(function(side){
      var wingBase=new THREE.Mesh(new THREE.BoxGeometry(.12,.5,.04),scaleM);wingBase.position.set(side*.4,1.2,-.05);g.add(wingBase);
      var wingMid=new THREE.Mesh(new THREE.BoxGeometry(.7,.4,.03),wingM);wingMid.position.set(side*.85,1.1,-.05);g.add(wingMid);
      var wingTip=new THREE.Mesh(new THREE.BoxGeometry(.4,.25,.02),wingM);wingTip.position.set(side*1.25,.95,-.05);g.add(wingTip);
    });
    [[-0.22,.38],[.22,.38],[-0.22,-.38],[.22,-.38]].forEach(function(p){
      var lx=p[0],lz=p[1];
      var leg=new THREE.Mesh(new THREE.BoxGeometry(.16,.48,.16),scaleM);leg.position.set(lx,.24,lz);g.add(leg);
      var claw=new THREE.Mesh(new THREE.BoxGeometry(.22,.1,.22),hornM);claw.position.set(lx,.02,lz);g.add(claw);
    });
    var tail1=new THREE.Mesh(new THREE.BoxGeometry(.22,.2,.45),scaleM);tail1.position.set(0,.78,-.62);g.add(tail1);
    var tail2=new THREE.Mesh(new THREE.BoxGeometry(.14,.14,.4),scaleM);tail2.position.set(0,.68,-.98);g.add(tail2);
    var tailTip=new THREE.Mesh(new THREE.ConeGeometry(.1,.22,4),hornM);tailTip.position.set(0,.62,-1.2);tailTip.rotation.x=Math.PI/2;g.add(tailTip);
    var fireLight=new THREE.PointLight(0xff4400,2,8);fireLight.position.set(0,1.2,0);g.add(fireLight);

  } else if(def.id==='jungle_spider'){
    /* 거미 — 8다리 */
    var spBody=new THREE.MeshLambertMaterial({color:0x2a1a00});
    var spEye=new THREE.MeshBasicMaterial({color:0xff0000});
    var ab=new THREE.Mesh(new THREE.SphereGeometry(.4,8,6),spBody);ab.scale.set(1,.7,1.2);ab.position.set(0,.4,-.25);g.add(ab);
    var ceph=new THREE.Mesh(new THREE.SphereGeometry(.28,8,6),spBody);ceph.position.set(0,.45,.2);g.add(ceph);
    for(var si=0;si<4;si++){[-1,1].forEach(function(side){
      var ang=(-0.6+si*0.4);
      var leg=new THREE.Mesh(new THREE.CylinderGeometry(.025,.02,.7,4),spBody);
      leg.position.set(side*(.2+si*.05),.5,.1-si*.12);leg.rotation.z=side*(.4+si*.15);leg.rotation.x=ang;g.add(leg);
    });}
    [-0.08,0.08].forEach(function(ex){
      var eye=new THREE.Mesh(new THREE.SphereGeometry(.04,5,5),spEye);eye.position.set(ex,.52,.42);g.add(eye);
    });
    /* 독니 */
    [-0.06,0.06].forEach(function(fx){
      var fang=new THREE.Mesh(new THREE.ConeGeometry(.02,.12,4),new THREE.MeshLambertMaterial({color:0x444400}));
      fang.position.set(fx,.38,.42);fang.rotation.x=Math.PI;g.add(fang);
    });

  } else if(def.id==='jungle_snake'){
    /* 독사 — 구불구불한 몸 */
    var snM=new THREE.MeshLambertMaterial({color:0x225511});
    var snM2=new THREE.MeshLambertMaterial({color:0x33aa22});
    var snEye=new THREE.MeshBasicMaterial({color:0xffff00});
    for(var seg=0;seg<6;seg++){
      var sz=.15-.01*seg;
      var sp2=new THREE.Mesh(new THREE.SphereGeometry(sz,6,6),seg%2===0?snM:snM2);
      sp2.position.set(Math.sin(seg*.8)*.15,.15,seg*-.18);sp2.scale.y=.7;g.add(sp2);
    }
    var head2=new THREE.Mesh(new THREE.SphereGeometry(.18,8,6),snM);head2.position.set(0,.2,.15);head2.scale.set(1,.7,1.3);g.add(head2);
    [-0.07,0.07].forEach(function(ex){
      var eye=new THREE.Mesh(new THREE.SphereGeometry(.035,5,5),snEye);eye.position.set(ex,.26,.32);g.add(eye);
    });
    /* 혀 */
    var tongue=new THREE.Mesh(new THREE.BoxGeometry(.02,.01,.15),new THREE.MeshBasicMaterial({color:0xff2222}));
    tongue.position.set(0,.18,.38);g.add(tongue);

  } else if(def.id==='jungle_ape'){
    /* 유인원 — 큰 근육질 */
    var apeM=new THREE.MeshLambertMaterial({color:0x5a3a1a});
    var apeDM=new THREE.MeshLambertMaterial({color:0x3a2210});
    var apeEye=new THREE.MeshBasicMaterial({color:0x221100});
    var body2=new THREE.Mesh(new THREE.BoxGeometry(.7,.8,.5),apeM);body2.position.set(0,.8,0);g.add(body2);
    var chest=new THREE.Mesh(new THREE.BoxGeometry(.5,.5,.35),apeDM);chest.position.set(0,.85,.1);g.add(chest);
    var head3=new THREE.Mesh(new THREE.SphereGeometry(.3,8,8),apeM);head3.position.set(0,1.5,0);g.add(head3);
    var jaw=new THREE.Mesh(new THREE.BoxGeometry(.28,.15,.2),apeDM);jaw.position.set(0,1.32,.18);g.add(jaw);
    [-0.12,0.12].forEach(function(ex){
      var eye=new THREE.Mesh(new THREE.SphereGeometry(.05,6,6),apeEye);eye.position.set(ex,1.55,.25);g.add(eye);
    });
    /* 팔 — 길고 굵음 */
    [-1,1].forEach(function(side){
      var arm=new THREE.Mesh(new THREE.BoxGeometry(.22,.9,.2),apeM);arm.position.set(side*.5,.7,0);g.add(arm);
      var fist=new THREE.Mesh(new THREE.SphereGeometry(.14,6,6),apeDM);fist.position.set(side*.5,.2,0);g.add(fist);
    });
    [-0.18,0.18].forEach(function(lx){
      var leg=new THREE.Mesh(new THREE.BoxGeometry(.2,.45,.2),apeM);leg.position.set(lx,.22,0);g.add(leg);
    });

  } else if(def.id==='jungle_panther'){
    /* 표범 — 검은 빠른 고양이 */
    var panM=new THREE.MeshLambertMaterial({color:0x1a1a1a});
    var panEM=new THREE.MeshBasicMaterial({color:0x44ff44});
    var body3=new THREE.Mesh(new THREE.BoxGeometry(.4,.35,.85),panM);body3.position.set(0,.5,0);g.add(body3);
    var head4=new THREE.Mesh(new THREE.BoxGeometry(.32,.28,.3),panM);head4.position.set(0,.72,.42);g.add(head4);
    [-0.1,0.1].forEach(function(ex){
      var eye=new THREE.Mesh(new THREE.SphereGeometry(.04,5,5),panEM);eye.position.set(ex,.78,.54);g.add(eye);
    });
    [-0.12,0.12].forEach(function(ex){
      var ear=new THREE.Mesh(new THREE.ConeGeometry(.05,.12,4),panM);ear.position.set(ex,.9,.38);g.add(ear);
    });
    [[-0.15,.35],[-0.15,-.35],[.15,.35],[.15,-.35]].forEach(function(p){
      var leg=new THREE.Mesh(new THREE.BoxGeometry(.1,.35,.1),panM);leg.position.set(p[0],.18,p[1]);g.add(leg);
    });
    var tail2=new THREE.Mesh(new THREE.CylinderGeometry(.03,.02,.7,5),panM);
    tail2.position.set(0,.55,-.62);tail2.rotation.x=.6;g.add(tail2);

  } else if(def.id==='jungle_mosquito'){
    /* 거대 모기 — 날개 달린 곤충 */
    var mqM=new THREE.MeshLambertMaterial({color:0x554400});
    var mqWing=new THREE.MeshLambertMaterial({color:0xaaddff,transparent:true,opacity:.4});
    var mqBody=new THREE.Mesh(new THREE.CylinderGeometry(.06,.12,.5,6),mqM);
    mqBody.position.set(0,.8,0);mqBody.rotation.x=.3;g.add(mqBody);
    var mqHead=new THREE.Mesh(new THREE.SphereGeometry(.1,6,6),mqM);mqHead.position.set(0,.95,.15);g.add(mqHead);
    [-0.08,0.08].forEach(function(ex){
      var eye=new THREE.Mesh(new THREE.SphereGeometry(.04,5,5),new THREE.MeshBasicMaterial({color:0xff0000}));
      eye.position.set(ex,.98,.22);g.add(eye);
    });
    /* 침 */
    var needle=new THREE.Mesh(new THREE.CylinderGeometry(.008,.008,.25,4),new THREE.MeshLambertMaterial({color:0x333333}));
    needle.position.set(0,.92,.32);needle.rotation.x=Math.PI/2;g.add(needle);
    /* 날개 */
    [-1,1].forEach(function(side){
      var wing=new THREE.Mesh(new THREE.PlaneGeometry(.4,.2),mqWing);
      wing.position.set(side*.25,.95,-.05);wing.rotation.y=side*.3;g.add(wing);
    });
    /* 다리 */
    for(var li=0;li<3;li++){[-1,1].forEach(function(side){
      var mleg=new THREE.Mesh(new THREE.CylinderGeometry(.01,.01,.35,3),mqM);
      mleg.position.set(side*.1,.65+li*.08,-.02);mleg.rotation.z=side*.5;g.add(mleg);
    });}

  } else if(def.id==='jungle_treant'){
    /* 나무 정령 — 나무 형태 */
    var trunkM=new THREE.MeshLambertMaterial({color:0x3a2a10});
    var leafM=new THREE.MeshLambertMaterial({color:0x1a6622});
    var eyeGM=new THREE.MeshBasicMaterial({color:0x88ff44});
    var trunk2=new THREE.Mesh(new THREE.CylinderGeometry(.25,.35,1.4,8),trunkM);trunk2.position.set(0,.7,0);g.add(trunk2);
    /* 가지 팔 */
    [-1,1].forEach(function(side){
      var arm2=new THREE.Mesh(new THREE.CylinderGeometry(.06,.1,.8,5),trunkM);
      arm2.position.set(side*.45,1.1,0);arm2.rotation.z=side*.6;g.add(arm2);
      var fingers=new THREE.Mesh(new THREE.SphereGeometry(.12,5,5),trunkM);
      fingers.position.set(side*.85,.9,0);g.add(fingers);
    });
    /* 잎 머리 */
    var crown=new THREE.Mesh(new THREE.SphereGeometry(.5,8,6),leafM);crown.position.set(0,1.7,0);crown.scale.y=.7;g.add(crown);
    var crown2=new THREE.Mesh(new THREE.SphereGeometry(.35,6,5),new THREE.MeshLambertMaterial({color:0x228833}));
    crown2.position.set(.15,2.0,.1);crown2.scale.y=.6;g.add(crown2);
    /* 눈 — 나무 구멍에서 빛나는 */
    [-0.1,0.1].forEach(function(ex){
      var hole=new THREE.Mesh(new THREE.SphereGeometry(.06,5,5),new THREE.MeshBasicMaterial({color:0x111100}));
      hole.position.set(ex,1.2,.26);g.add(hole);
      var glow=new THREE.Mesh(new THREE.SphereGeometry(.04,5,5),eyeGM);
      glow.position.set(ex,1.2,.28);g.add(glow);
    });
    /* 뿌리 다리 */
    [-0.15,0,0.15].forEach(function(rx){
      var root=new THREE.Mesh(new THREE.CylinderGeometry(.06,.1,.3,5),trunkM);
      root.position.set(rx,.1,rx===0?-.1:0);g.add(root);
    });

  } else if(def.id==='elite_stag'){
    /* ★ 황금 사슴왕 — 거대한 금빛 사슴, 화려한 뿔 */
    var goldM=new THREE.MeshLambertMaterial({color:0xddaa00,emissive:new THREE.Color(0x664400),emissiveIntensity:.3});
    var darkGoldM=new THREE.MeshLambertMaterial({color:0xaa7700});
    var whiteM=new THREE.MeshLambertMaterial({color:0xffeedd});
    var eyeM=new THREE.MeshBasicMaterial({color:0xff4400});
    var antlerM=new THREE.MeshLambertMaterial({color:0xffcc44,emissive:new THREE.Color(0x886600),emissiveIntensity:.4});
    /* 몸통 */
    var body=new THREE.Mesh(new THREE.BoxGeometry(.7,.6,1.1),goldM);body.position.set(0,.9,0);g.add(body);
    var belly=new THREE.Mesh(new THREE.BoxGeometry(.5,.35,.85),whiteM);belly.position.set(0,.76,.05);g.add(belly);
    /* 목+머리 */
    var neck=new THREE.Mesh(new THREE.BoxGeometry(.28,.5,.28),goldM);neck.position.set(0,1.3,.35);neck.rotation.x=-.3;g.add(neck);
    var head=new THREE.Mesh(new THREE.BoxGeometry(.4,.35,.45),goldM);head.position.set(0,1.55,.55);g.add(head);
    var snout=new THREE.Mesh(new THREE.BoxGeometry(.24,.22,.28),whiteM);snout.position.set(0,1.48,.78);g.add(snout);
    /* 눈 — 불타는 눈 */
    [-0.14,0.14].forEach(function(ex){
      var eye=new THREE.Mesh(new THREE.SphereGeometry(.06,6,6),eyeM);eye.position.set(ex,1.62,.7);g.add(eye);
    });
    /* 거대한 황금 뿔 — 3단계 분기 */
    [-0.16,0.16].forEach(function(ex){
      var dir=ex>0?1:-1;
      /* 메인 줄기 */
      var main=new THREE.Mesh(new THREE.CylinderGeometry(.04,.07,.6,6),antlerM);
      main.position.set(ex,1.9,.4);main.rotation.z=dir*.25;g.add(main);
      /* 1차 분기 */
      var b1=new THREE.Mesh(new THREE.CylinderGeometry(.03,.05,.45,5),antlerM);
      b1.position.set(ex+dir*.2,2.15,.3);b1.rotation.z=dir*.6;g.add(b1);
      /* 2차 분기 */
      var b2=new THREE.Mesh(new THREE.CylinderGeometry(.025,.04,.35,5),antlerM);
      b2.position.set(ex+dir*.1,2.3,.2);b2.rotation.z=dir*.3;g.add(b2);
      /* 3차 분기 */
      var b3=new THREE.Mesh(new THREE.CylinderGeometry(.02,.035,.3,5),antlerM);
      b3.position.set(ex+dir*.35,2.3,.15);b3.rotation.z=dir*.8;g.add(b3);
      /* 뿔 끝 빛나는 구슬 */
      var tipM=new THREE.MeshBasicMaterial({color:0xffee66,transparent:true,opacity:.8});
      var tip=new THREE.Mesh(new THREE.SphereGeometry(.05,6,6),tipM);
      tip.position.set(ex+dir*.15,2.45,.35);g.add(tip);
      var tip2=new THREE.Mesh(new THREE.SphereGeometry(.04,6,6),tipM);
      tip2.position.set(ex+dir*.4,2.4,.1);g.add(tip2);
    });
    /* 다리 — 두꺼운 금빛 */
    [[-0.24,.4],[-0.24,-.4],[.24,.4],[.24,-.4]].forEach(function(p){
      var leg=new THREE.Mesh(new THREE.BoxGeometry(.16,.6,.16),darkGoldM);leg.position.set(p[0],.32,p[1]);g.add(leg);
      var hoof=new THREE.Mesh(new THREE.BoxGeometry(.18,.12,.18),new THREE.MeshLambertMaterial({color:0x332200}));
      hoof.position.set(p[0],.03,p[1]);g.add(hoof);
    });
    /* 꼬리 — 빛나는 */
    var tailM=new THREE.MeshBasicMaterial({color:0xffdd44,transparent:true,opacity:.7});
    var tail=new THREE.Mesh(new THREE.SphereGeometry(.12,6,6),tailM);tail.position.set(0,1,-.58);g.add(tail);

  } else if(def.id==='elite_toad'){
    /* ★ 독왕 두꺼비 — 거대한 독 두꺼비, 등에 독버섯 */
    var skinM=new THREE.MeshLambertMaterial({color:0x225500,emissive:new THREE.Color(0x113300),emissiveIntensity:.2});
    var spotM=new THREE.MeshLambertMaterial({color:0x66ff00,emissive:new THREE.Color(0x33aa00),emissiveIntensity:.5});
    var bellyM=new THREE.MeshLambertMaterial({color:0x88aa44});
    var eyeM=new THREE.MeshBasicMaterial({color:0xffff00});
    var mushM=new THREE.MeshLambertMaterial({color:0xff2200,emissive:new THREE.Color(0x660000),emissiveIntensity:.3});
    /* 몸통 — 납작하고 넓음 */
    var body=new THREE.Mesh(new THREE.SphereGeometry(.7,10,8),skinM);
    body.scale.set(1,.55,1.1);body.position.set(0,.45,0);g.add(body);
    /* 배 */
    var belly=new THREE.Mesh(new THREE.SphereGeometry(.5,8,6),bellyM);
    belly.scale.set(1,.4,.9);belly.position.set(0,.3,.15);g.add(belly);
    /* 독 반점들 */
    [[-.3,.7,.1],[.25,.75,-.15],[0,.8,-.3],[-.2,.6,.3],[.35,.65,0]].forEach(function(sp){
      var spot=new THREE.Mesh(new THREE.SphereGeometry(.08+Math.random()*.06,6,6),spotM);
      spot.position.set(sp[0],sp[1],sp[2]);g.add(spot);
    });
    /* 머리 */
    var head=new THREE.Mesh(new THREE.BoxGeometry(.55,.35,.45),skinM);head.position.set(0,.65,.5);g.add(head);
    /* 눈 — 거대한 노란 눈 */
    [-0.2,0.2].forEach(function(ex){
      var eyeW=new THREE.Mesh(new THREE.SphereGeometry(.12,8,8),new THREE.MeshLambertMaterial({color:0xffffff}));
      eyeW.position.set(ex,.85,.6);g.add(eyeW);
      var pupil=new THREE.Mesh(new THREE.SphereGeometry(.07,6,6),eyeM);
      pupil.position.set(ex,.85,.7);g.add(pupil);
      var slit=new THREE.Mesh(new THREE.BoxGeometry(.02,.12,.02),new THREE.MeshBasicMaterial({color:0x000000}));
      slit.position.set(ex,.85,.72);g.add(slit);
    });
    /* 등에 독버섯 3개 */
    [[-.2,.85,-.2,.15],[.15,.9,-.1,.12],[0,.88,-.35,.1]].forEach(function(mp){
      var stem=new THREE.Mesh(new THREE.CylinderGeometry(.03,.04,mp[3],5),new THREE.MeshLambertMaterial({color:0xddddaa}));
      stem.position.set(mp[0],mp[1],mp[2]);g.add(stem);
      var cap=new THREE.Mesh(new THREE.SphereGeometry(mp[3]*.6,8,6),mushM);
      cap.scale.y=.5;cap.position.set(mp[0],mp[1]+mp[3]*.5,mp[2]);g.add(cap);
      /* 독 포자 */
      var sporeM=new THREE.MeshBasicMaterial({color:0x88ff00,transparent:true,opacity:.4});
      var spore=new THREE.Mesh(new THREE.SphereGeometry(.03,4,4),sporeM);
      spore.position.set(mp[0]+Math.random()*.1,mp[1]+mp[3]*.7,mp[2]);g.add(spore);
    });
    /* 앞다리 */
    [-0.35,0.35].forEach(function(ex){
      var fl=new THREE.Mesh(new THREE.BoxGeometry(.18,.2,.22),skinM);fl.position.set(ex,.15,.35);g.add(fl);
    });
    /* 뒷다리 — 큰 */
    [-0.4,0.4].forEach(function(ex){
      var hl=new THREE.Mesh(new THREE.BoxGeometry(.22,.18,.35),skinM);hl.position.set(ex,.12,-.25);g.add(hl);
    });

  } else if(def.id==='elite_wolf'){
    /* ★ 늑대 대장 — 검은 갑옷 늑대, 붉은 눈 */
    var furM=new THREE.MeshLambertMaterial({color:0x1a1a2a,emissive:new THREE.Color(0x0a0a1a),emissiveIntensity:.2});
    var armorM=new THREE.MeshLambertMaterial({color:0x334455,emissive:new THREE.Color(0x1a2233),emissiveIntensity:.3});
    var eyeM=new THREE.MeshBasicMaterial({color:0xff0000});
    var clawM=new THREE.MeshLambertMaterial({color:0xcccccc});
    /* 몸통 — 길고 근육질 */
    var body=new THREE.Mesh(new THREE.BoxGeometry(.5,.5,1.0),furM);body.position.set(0,.7,0);g.add(body);
    /* 갑옷 플레이트 */
    var armor=new THREE.Mesh(new THREE.BoxGeometry(.56,.2,.8),armorM);armor.position.set(0,.85,-.05);g.add(armor);
    var shoulderL=new THREE.Mesh(new THREE.BoxGeometry(.2,.15,.25),armorM);shoulderL.position.set(-.35,.82,.2);g.add(shoulderL);
    var shoulderR=new THREE.Mesh(new THREE.BoxGeometry(.2,.15,.25),armorM);shoulderR.position.set(.35,.82,.2);g.add(shoulderR);
    /* 목 */
    var neck=new THREE.Mesh(new THREE.BoxGeometry(.3,.35,.3),furM);neck.position.set(0,1,.35);neck.rotation.x=-.2;g.add(neck);
    /* 머리 — 날카로운 */
    var head=new THREE.Mesh(new THREE.BoxGeometry(.38,.3,.5),furM);head.position.set(0,1.2,.55);g.add(head);
    var snout=new THREE.Mesh(new THREE.BoxGeometry(.2,.18,.35),furM);snout.position.set(0,1.12,.82);g.add(snout);
    /* 이빨 */
    [-0.06,0.06].forEach(function(tx){
      var fang=new THREE.Mesh(new THREE.ConeGeometry(.03,.12,4),clawM);
      fang.position.set(tx,1.02,.95);fang.rotation.x=Math.PI;g.add(fang);
    });
    /* 붉은 눈 */
    [-0.12,0.12].forEach(function(ex){
      var eye=new THREE.Mesh(new THREE.SphereGeometry(.055,6,6),eyeM);eye.position.set(ex,1.28,.72);g.add(eye);
    });
    /* 귀 — 뾰족 */
    [-0.14,0.14].forEach(function(ex){
      var ear=new THREE.Mesh(new THREE.ConeGeometry(.06,.2,4),furM);
      ear.position.set(ex,1.48,.45);g.add(ear);
    });
    /* 다리 — 4개, 날카로운 발톱 */
    [[-0.2,.3],[-0.2,-.35],[.2,.3],[.2,-.35]].forEach(function(p){
      var leg=new THREE.Mesh(new THREE.BoxGeometry(.14,.5,.14),furM);leg.position.set(p[0],.28,p[1]);g.add(leg);
      /* 발톱 3개 */
      [-0.04,0,0.04].forEach(function(cx){
        var claw=new THREE.Mesh(new THREE.ConeGeometry(.015,.08,4),clawM);
        claw.position.set(p[0]+cx,.02,p[1]+.08);claw.rotation.x=.3;g.add(claw);
      });
    });
    /* 꼬리 — 거대한 */
    var tail=new THREE.Mesh(new THREE.BoxGeometry(.12,.12,.5),furM);tail.position.set(0,.75,-.7);tail.rotation.x=.3;g.add(tail);
    /* 흉터 */
    var scarM=new THREE.MeshBasicMaterial({color:0x660000});
    var scar=new THREE.Mesh(new THREE.BoxGeometry(.02,.2,.02),scarM);scar.position.set(-.1,1.25,.76);scar.rotation.z=.3;g.add(scar);

  } else if(def.id==='elite_ape'){
    /* ★ 정글의 왕 — 거대한 고릴라, 전투 흔적 */
    var furM=new THREE.MeshLambertMaterial({color:0x2a1500,emissive:new THREE.Color(0x1a0a00),emissiveIntensity:.2});
    var chestM=new THREE.MeshLambertMaterial({color:0x4a3520});
    var eyeM=new THREE.MeshBasicMaterial({color:0xff6600});
    var scarM=new THREE.MeshLambertMaterial({color:0x8a2200});
    /* 몸통 — 거대 */
    var body=new THREE.Mesh(new THREE.BoxGeometry(.9,.9,.7),furM);body.position.set(0,.9,0);g.add(body);
    var chest=new THREE.Mesh(new THREE.BoxGeometry(.7,.6,.4),chestM);chest.position.set(0,.85,.2);g.add(chest);
    /* 머리 */
    var head=new THREE.Mesh(new THREE.BoxGeometry(.55,.5,.5),furM);head.position.set(0,1.65,0);g.add(head);
    /* 턱 — 돌출 */
    var jaw=new THREE.Mesh(new THREE.BoxGeometry(.4,.2,.35),chestM);jaw.position.set(0,1.38,.15);g.add(jaw);
    /* 이빨 */
    [-0.1,0.1].forEach(function(tx){
      var fang=new THREE.Mesh(new THREE.ConeGeometry(.04,.15,4),new THREE.MeshLambertMaterial({color:0xeeeecc}));
      fang.position.set(tx,1.28,.28);fang.rotation.x=Math.PI;g.add(fang);
    });
    /* 눈 — 불타는 오렌지 */
    [-0.15,0.15].forEach(function(ex){
      var eye=new THREE.Mesh(new THREE.SphereGeometry(.07,6,6),eyeM);eye.position.set(ex,1.72,.22);g.add(eye);
    });
    /* 팔 — 거대, 비대칭 (한쪽이 더 큼) */
    var armM=new THREE.MeshLambertMaterial({color:0x3a2010});
    var armL=new THREE.Mesh(new THREE.BoxGeometry(.28,.7,.25),armM);armL.position.set(-.58,.7,.05);armL.rotation.z=.15;g.add(armL);
    var fistL=new THREE.Mesh(new THREE.BoxGeometry(.22,.22,.22),furM);fistL.position.set(-.62,.32,.05);g.add(fistL);
    var armR=new THREE.Mesh(new THREE.BoxGeometry(.32,.75,.28),armM);armR.position.set(.6,.72,.05);armR.rotation.z=-.15;g.add(armR);
    var fistR=new THREE.Mesh(new THREE.BoxGeometry(.25,.25,.25),furM);fistR.position.set(.65,.3,.05);g.add(fistR);
    /* 다리 */
    [-0.25,0.25].forEach(function(ex){
      var leg=new THREE.Mesh(new THREE.BoxGeometry(.22,.45,.22),furM);leg.position.set(ex,.25,-.05);g.add(leg);
    });
    /* 흉터들 */
    [[-.2,1.1,.36,.25],[.1,.8,.36,.2],[-.3,1.6,.26,.15]].forEach(function(sp){
      var scar=new THREE.Mesh(new THREE.BoxGeometry(.03,sp[3],.02),scarM);
      scar.position.set(sp[0],sp[1],sp[2]);scar.rotation.z=Math.random()-.5;g.add(scar);
    });
    /* 등에 부러진 창 */
    var spearM=new THREE.MeshLambertMaterial({color:0x886644});
    var spear=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,.6,5),spearM);
    spear.position.set(.1,1.2,-.3);spear.rotation.x=.8;spear.rotation.z=.2;g.add(spear);

  } else if(def.id==='elite_dragon'){
    /* ★ 고대 화염룡 — 거대 드래곤, 날개+뿔+불꼬리 */
    var scaleM=new THREE.MeshLambertMaterial({color:0x880000,emissive:new THREE.Color(0x440000),emissiveIntensity:.4});
    var bellyM=new THREE.MeshLambertMaterial({color:0xcc4400,emissive:new THREE.Color(0x662200),emissiveIntensity:.3});
    var eyeM=new THREE.MeshBasicMaterial({color:0xffff00});
    var hornM=new THREE.MeshLambertMaterial({color:0x220000});
    var wingM=new THREE.MeshLambertMaterial({color:0x660000,transparent:true,opacity:.85,side:THREE.DoubleSide});
    var fireM=new THREE.MeshBasicMaterial({color:0xff4400,transparent:true,opacity:.7});
    /* 몸통 — 거대하고 길쭉 */
    var body=new THREE.Mesh(new THREE.BoxGeometry(.8,.7,1.4),scaleM);body.position.set(0,1,0);g.add(body);
    var belly=new THREE.Mesh(new THREE.BoxGeometry(.6,.4,1.1),bellyM);belly.position.set(0,.82,.05);g.add(belly);
    /* 목 */
    var neck=new THREE.Mesh(new THREE.BoxGeometry(.35,.35,.5),scaleM);neck.position.set(0,1.3,.65);neck.rotation.x=-.4;g.add(neck);
    /* 머리 — 각진 파충류 */
    var head=new THREE.Mesh(new THREE.BoxGeometry(.5,.4,.55),scaleM);head.position.set(0,1.6,.9);g.add(head);
    var snout=new THREE.Mesh(new THREE.BoxGeometry(.35,.25,.4),scaleM);snout.position.set(0,1.5,1.15);g.add(snout);
    var jaw=new THREE.Mesh(new THREE.BoxGeometry(.3,.12,.35),bellyM);jaw.position.set(0,1.38,1.1);g.add(jaw);
    /* 이빨 */
    [-0.1,-0.04,0.04,0.1].forEach(function(tx){
      var fang=new THREE.Mesh(new THREE.ConeGeometry(.025,.12,4),new THREE.MeshLambertMaterial({color:0xeeeecc}));
      fang.position.set(tx,1.32,1.2);fang.rotation.x=Math.PI;g.add(fang);
    });
    /* 눈 — 금빛 */
    [-0.18,0.18].forEach(function(ex){
      var eye=new THREE.Mesh(new THREE.SphereGeometry(.07,6,6),eyeM);eye.position.set(ex,1.7,1.05);g.add(eye);
      var slit=new THREE.Mesh(new THREE.BoxGeometry(.02,.1,.02),new THREE.MeshBasicMaterial({color:0x000000}));
      slit.position.set(ex,1.7,1.08);g.add(slit);
    });
    /* 뿔 — 2쌍 */
    [-0.18,0.18].forEach(function(ex){
      var dir=ex>0?1:-1;
      var horn1=new THREE.Mesh(new THREE.ConeGeometry(.05,.4,5),hornM);
      horn1.position.set(ex,1.95,.7);horn1.rotation.z=dir*.2;g.add(horn1);
      var horn2=new THREE.Mesh(new THREE.ConeGeometry(.04,.25,5),hornM);
      horn2.position.set(ex*1.3,1.82,.6);horn2.rotation.z=dir*.5;g.add(horn2);
    });
    /* 등 가시 */
    for(var si=0;si<6;si++){
      var spine=new THREE.Mesh(new THREE.ConeGeometry(.04,.2+si*.02,4),hornM);
      spine.position.set(0,1.45-si*.03,-.1+si*.15);g.add(spine);
    }
    /* 날개 — 삼각형 */
    [-1,1].forEach(function(dir){
      var wingShape=new THREE.Shape();
      wingShape.moveTo(0,0);wingShape.lineTo(dir*1.2,.8);wingShape.lineTo(dir*1.0,0);
      wingShape.lineTo(dir*.7,.5);wingShape.lineTo(dir*.4,0);wingShape.lineTo(0,0);
      var wingGeo=new THREE.ShapeGeometry(wingShape);
      var wing=new THREE.Mesh(wingGeo,wingM);
      wing.position.set(0,1.2,-.2);wing.rotation.y=dir*-.3;g.add(wing);
    });
    /* 다리 — 4개, 강인한 */
    [[-0.3,.5],[-0.3,-.45],[.3,.5],[.3,-.45]].forEach(function(p){
      var leg=new THREE.Mesh(new THREE.BoxGeometry(.2,.55,.2),scaleM);leg.position.set(p[0],.3,p[1]);g.add(leg);
      [-0.05,0,0.05].forEach(function(cx){
        var claw=new THREE.Mesh(new THREE.ConeGeometry(.02,.1,4),new THREE.MeshLambertMaterial({color:0x111111}));
        claw.position.set(p[0]+cx,.02,p[1]+.1);claw.rotation.x=.3;g.add(claw);
      });
    });
    /* 꼬리 — 길고 불타는 끝 */
    var tail1=new THREE.Mesh(new THREE.BoxGeometry(.18,.18,.5),scaleM);tail1.position.set(0,.85,-.85);tail1.rotation.x=.15;g.add(tail1);
    var tail2=new THREE.Mesh(new THREE.BoxGeometry(.12,.12,.4),scaleM);tail2.position.set(0,.78,-1.2);tail2.rotation.x=.25;g.add(tail2);
    var fireTail=new THREE.Mesh(new THREE.SphereGeometry(.12,6,6),fireM);fireTail.position.set(0,.72,-1.4);g.add(fireTail);
    var fireTail2=new THREE.Mesh(new THREE.SphereGeometry(.08,6,6),new THREE.MeshBasicMaterial({color:0xffaa00,transparent:true,opacity:.5}));
    fireTail2.position.set(0,.72,-1.5);g.add(fireTail2);

  } else {
    /* fallback — 기본 박스 몬스터 */
    var fb=new THREE.Mesh(new THREE.BoxGeometry(.5,.7,.4),bm);fb.position.set(0,.5,0);g.add(fb);
    var fh=new THREE.Mesh(new THREE.BoxGeometry(.35,.35,.35),hm);fh.position.set(0,1.05,0);g.add(fh);
  }
  return g;
}

function addEliteEffects(g,def){
  /* 왕관 */
  var crownM=new THREE.MeshBasicMaterial({color:0xffdd00});
  var crownBase=new THREE.Mesh(new THREE.CylinderGeometry(.25,.3,.12,8),crownM);
  var crownTop=g.children.length>0?2.2:1.5;
  /* 가장 높은 y 찾기 */
  g.traverse(function(c){if(c.position&&c.position.y+.5>crownTop)crownTop=c.position.y+.5;});
  crownBase.position.set(0,crownTop,0);g.add(crownBase);
  /* 왕관 뾰족이 */
  var spikeM=new THREE.MeshBasicMaterial({color:0xffaa00});
  for(var ci=0;ci<5;ci++){
    var angle=ci/5*Math.PI*2;
    var spike=new THREE.Mesh(new THREE.ConeGeometry(.06,.18,4),spikeM);
    spike.position.set(Math.cos(angle)*.2,crownTop+.15,Math.sin(angle)*.2);g.add(spike);
  }
  /* 보석 */
  var gemM=new THREE.MeshBasicMaterial({color:0xff0044});
  var gem=new THREE.Mesh(new THREE.OctahedronGeometry(.08,0),gemM);
  gem.position.set(0,crownTop+.18,0);g.add(gem);
  /* 발광 오라 링 */
  var oraColor=def.id==='elite_dragon'?0xff4400:def.id==='elite_wolf'?0x8888ff:def.id==='elite_toad'?0x44ff00:def.id==='elite_ape'?0xff8844:0xffdd00;
  var oraM=new THREE.MeshBasicMaterial({color:oraColor,transparent:true,opacity:.3,side:THREE.DoubleSide});
  var ora=new THREE.Mesh(new THREE.RingGeometry(.8,1.2,24),oraM);
  ora.rotation.x=-Math.PI/2;ora.position.set(0,.05,0);g.add(ora);
  /* 두 번째 오라 링 (위) */
  var ora2=new THREE.Mesh(new THREE.RingGeometry(.5,.8,24),oraM);
  ora2.rotation.x=-Math.PI/2;ora2.position.set(0,crownTop-.3,0);g.add(ora2);
  /* 파티클 구체들 (주변 떠다니는 빛) */
  var pM=new THREE.MeshBasicMaterial({color:oraColor,transparent:true,opacity:.6});
  for(var pi=0;pi<6;pi++){
    var pa=pi/6*Math.PI*2;
    var particle=new THREE.Mesh(new THREE.SphereGeometry(.06,6,6),pM);
    particle.position.set(Math.cos(pa)*.9,crownTop*.5+Math.sin(pa*2)*.3,Math.sin(pa)*.9);
    particle._eliteOrbit=pa;g.add(particle);
  }
}

function spawnMonster(def,x,z,parent){
  var mesh=mkMonsterMesh(def);
  if(def.elite){mesh.scale.set(1.8,1.8,1.8);addEliteEffects(mesh,def);}
  mesh.position.set(x,0,z);
  mesh.rotation.y=Math.random()*Math.PI*2;
  var p=parent||scene;
  p.add(mesh);
  var lov=document.getElementById('lov');
  var wrap=document.createElement('div');
  wrap.style.cssText='position:absolute;transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center;gap:2px;pointer-events:none;';
  var ntag=document.createElement('div');ntag.className='llabel npc';
  if(def.elite){
    ntag.style.cssText+=';background:#2a1a00ee;border:2px solid #ffaa00;color:#ffdd44;font-size:13px;font-weight:bold;text-shadow:0 0 8px #ffaa00,0 0 16px #ff8800;padding:3px 8px;letter-spacing:1px;';
  }else{
    ntag.style.cssText+=';background:#1a0808ee;border-color:#883333;color:#ff8888;font-size:10px;';
  }
  ntag.textContent=def.name+(def.lv?' Lv.'+def.lv:'');
  var hbw=document.createElement('div');
  if(def.elite){
    hbw.style.cssText='width:72px;height:7px;background:#2a1a00;border:1px solid #ffaa00;overflow:hidden;';
  }else{
    hbw.style.cssText='width:56px;height:5px;background:#2a0808;border:1px solid #551111;overflow:hidden;';
  }
  var hbf=document.createElement('div');hbf.style.cssText='height:100%;background:'+(def.elite?'#ffaa00':'#cc2222')+';width:100%;transition:width .15s;';
  hbw.appendChild(hbf);wrap.appendChild(ntag);wrap.appendChild(hbw);lov.appendChild(wrap);
  /* 애니메이션 상태 초기화 */
  var m={def:def,mesh:mesh,hp:def.hp,maxHp:def.hp,wrap:wrap,hbf:hbf,state:'idle',attackTimer:0,bobOff:Math.random()*Math.PI*2,spawnX:x,spawnZ:z,
    animTime:0,
    baseY:0,
    isAttacking:false,attackAnimT:0,
    hitFlash:0,
    deathAnim:-1,
    spawnAnim:0.6,
    _origMats:null,
    _flashMats:null,
    _whiteMats:null
  };
  /* 스폰 애니메이션: 스케일 0에서 시작 */
  mesh.scale.set(0,0,0);
  monsters.push(m);return m;
}

/* ════════════ 오픈 월드 바이옴별 지형 + 몬스터 빌드 ════════════ */
/* 모든 좌표는 월드 절대 좌표 */

function buildMeadow(){
  /* 초원: x:-240~240, z:20~900 (3x 확장) */
  /* 밝은 녹색 패치들 */
  var patchM=new THREE.MeshLambertMaterial({color:0x4a8a2a});
  [[-80,200,20,14],[60,420,18,12],[0,660,20,16],
   [160,300,14,10],[-140,550,14,10],[-60,780,16,12],[100,750,14,10],
   [-200,380,12,8],[200,500,12,8]
  ].forEach(function(pp){
    var patch=new THREE.Mesh(new THREE.PlaneGeometry(pp[2],pp[3]),patchM);
    patch.rotation.x=-Math.PI/2;patch.position.set(pp[0],.015,pp[1]);scene.add(patch);
  });
  /* 초원 조명 */
  var pl1=new THREE.PointLight(0xffcc44,.3,300);pl1.position.set(0,8,450);scene.add(pl1);
  var pl2=new THREE.PointLight(0xffcc44,.25,250);pl2.position.set(0,8,800);scene.add(pl2);
  /* 야생화 (더 넓게) — 공유 머티리얼 사용 */
  var _fMats=[
    new THREE.MeshLambertMaterial({color:0xffee44,emissive:new THREE.Color(0xffee44),emissiveIntensity:.15}),
    new THREE.MeshLambertMaterial({color:0xffffff,emissive:new THREE.Color(0xffffff),emissiveIntensity:.1}),
    new THREE.MeshLambertMaterial({color:0xcc88ff,emissive:new THREE.Color(0xcc88ff),emissiveIntensity:.15}),
    new THREE.MeshLambertMaterial({color:0xff88aa,emissive:new THREE.Color(0xff88aa),emissiveIntensity:.15}),
    new THREE.MeshLambertMaterial({color:0x88ddff,emissive:new THREE.Color(0x88ddff),emissiveIntensity:.12})
  ];
  for(var fi=0;fi<100;fi++){
    var fx=(Math.random()-.5)*440,fz=25+Math.random()*860;
    if(Math.abs(fx)<10)continue;
    var fl=new THREE.Mesh(new THREE.SphereGeometry(.06+Math.random()*.04,5,5),_fMats[Math.floor(Math.random()*5)]);
    fl.position.set(fx,.08,fz);scene.add(fl);
  }
  /* 초원 나무 (3x 배치) */
  [[-80,80],[-100,220],[-90,380],[-120,540],[-80,700],[-100,840],
   [80,120],[100,280],[90,440],[120,600],[80,760],[100,880],
   [-50,160],[50,330],[-30,500],[30,670],[-60,830],[60,900],
   [0,200],[0,480],[0,750],[-160,300],[160,400],[-180,620],[180,720]
  ].forEach(function(pp){mkTree(pp[0],pp[1],.9+Math.random()*.8,scene);});
  /* 덤불 */
  var bushM=new THREE.MeshLambertMaterial({color:0x224a10});
  [[-60,200],[80,380],[-130,500],[140,650],[-70,780],[90,860],
   [-180,280],[180,420],[-150,700],[150,800]
  ].forEach(function(pp){
    var bush=new THREE.Mesh(new THREE.SphereGeometry(.6+Math.random()*.4,6,6),bushM);
    bush.scale.y=.6;bush.position.set(pp[0],.3,pp[1]);scene.add(bush);
  });
  /* 몬스터 스폰 — 3x 확장 (더 많이, 더 넓게) */
  var rd=MONSTER_DEFS.find(function(x){return x.id==='rabbit';});
  var dd=MONSTER_DEFS.find(function(x){return x.id==='deer';});
  if(rd)[
    [-50,60],[30,180],[-80,320],[60,460],
    [-30,600],[90,740],[-60,860],[40,400],
    [-120,250],[120,550]
  ].forEach(function(pp){spawnMonster(rd,pp[0],pp[1],scene);});
  if(dd)[
    [80,100],[-70,280],[50,450],[-40,620],
    [100,780],[-100,350],[60,700],[-80,500]
  ].forEach(function(pp){spawnMonster(dd,pp[0],pp[1],scene);});
  /* ★ 엘리트: 황금 사슴왕 */
  var es=MONSTER_DEFS.find(function(x){return x.id==='elite_stag';});
  if(es)spawnMonster(es,0,600,scene);
}

function buildSwamp(){
  /* 늪 동쪽: x:80~200, z:20~300 AND 서쪽: x:-200~-80, z:20~300 */
  var swampM=new THREE.MeshLambertMaterial({color:0x0a2a08,emissive:new THREE.Color(0x0a2208),emissiveIntensity:.35,transparent:true,opacity:.85});

  /* ── 물웅덩이 (머드풀) ── */
  [[110,70,6,4],[150,145,6,4],[100,220,7,5],[120,280,8,5],
   [-110,70,6,4],[-150,145,6,4],[-100,220,7,5],[-120,280,8,5]
  ].forEach(function(pp){
    var pool=new THREE.Mesh(new THREE.PlaneGeometry(pp[2]*2,pp[3]*2),swampM);
    pool.rotation.x=-Math.PI/2;pool.position.set(pp[0],.03,pp[1]);scene.add(pool);
    var poolGlow=new THREE.PointLight(0x22aa22,.3,pp[2]*2);poolGlow.position.set(pp[0],.5,pp[1]);scene.add(poolGlow);
  });

  /* ── 버블링 머드풀 (거품 방울) ── */
  var bubbleM=new THREE.MeshBasicMaterial({color:0x2a4a10,transparent:true,opacity:.5});
  [[110,70],[150,145],[100,220],[-110,70],[-150,145],[-100,220],
   [130,160],[-130,160],[95,120],[-95,120]
  ].forEach(function(bp){
    for(var bi=0;bi<5;bi++){
      var bx=bp[0]+(Math.random()-.5)*6;
      var bz=bp[1]+(Math.random()-.5)*4;
      var br=.08+Math.random()*.12;
      var bubble=new THREE.Mesh(new THREE.SphereGeometry(br,6,6),bubbleM);
      bubble.position.set(bx,.04+Math.random()*.08,bz);
      scene.add(bubble);
    }
  });

  /* ── 안개 조명 (더 어둡고 으스스하게) ── */
  var pl2=new THREE.PointLight(0x0a3308,.2,150);pl2.position.set(0,3,160);scene.add(pl2);
  var pl2b=new THREE.PointLight(0x082208,.15,120);pl2b.position.set(130,2,200);scene.add(pl2b);
  var pl2c=new THREE.PointLight(0x082208,.15,120);pl2c.position.set(-130,2,200);scene.add(pl2c);

  /* ── 도깨비불 / 늪 가스 위스프 ── */
  var wispM=new THREE.MeshBasicMaterial({color:0x44ff66,transparent:true,opacity:.6});
  var wispM2=new THREE.MeshBasicMaterial({color:0x88ff44,transparent:true,opacity:.35});
  for(var wi=0;wi<18;wi++){
    var side=wi<9?1:-1;
    var wx=side*(85+Math.random()*110),wz=25+Math.random()*270;
    var wy=.8+Math.random()*1.5;
    var wisp=new THREE.Mesh(new THREE.SphereGeometry(.08+Math.random()*.06,6,6),wispM);
    wisp.position.set(wx,wy,wz);scene.add(wisp);
    var wl=new THREE.PointLight(0x33ff44,.25,6);wl.position.set(wx,wy,wz);scene.add(wl);
  }
  /* 추가 늪 가스 위스프 (더 크고 희미한 버전) */
  for(var gi=0;gi<12;gi++){
    var gside=gi<6?1:-1;
    var gx=gside*(90+Math.random()*100),gz=30+Math.random()*260;
    var gy=.3+Math.random()*.6;
    var gasWisp=new THREE.Mesh(new THREE.SphereGeometry(.15+Math.random()*.1,6,6),wispM2);
    gasWisp.position.set(gx,gy,gz);scene.add(gasWisp);
  }

  /* ── 늪 안개 평면 (더 많고 두꺼운 지면 커버) ── */
  var swampFogM=new THREE.MeshLambertMaterial({color:0x1a3a10,transparent:true,opacity:.08});
  var swampFogM2=new THREE.MeshLambertMaterial({color:0x0a2008,transparent:true,opacity:.12});
  var swampFogM3=new THREE.MeshLambertMaterial({color:0x152a0a,transparent:true,opacity:.06});
  [140,-140].forEach(function(sx){
    for(var sf=0;sf<6;sf++){
      var fm=sf%2===0?swampFogM:swampFogM2;
      var sfp=new THREE.Mesh(new THREE.PlaneGeometry(22+Math.random()*16,18+Math.random()*10),fm);
      sfp.rotation.x=-Math.PI/2;sfp.position.set(sx+(Math.random()-.5)*60,.12,30+sf*48);scene.add(sfp);
    }
  });
  /* 중앙 안개 레이어 */
  for(var cf=0;cf<4;cf++){
    var cfp=new THREE.Mesh(new THREE.PlaneGeometry(30+Math.random()*20,20+Math.random()*15),swampFogM3);
    cfp.rotation.x=-Math.PI/2;cfp.position.set((Math.random()-.5)*40,.08,50+cf*65);scene.add(cfp);
  }

  /* ── 죽은 나무 (트위스트 형태, 더 많이) ── */
  var deadM=new THREE.MeshLambertMaterial({color:0x1a1205});
  var deadM2=new THREE.MeshLambertMaterial({color:0x120e04});
  [[110,75],[150,145],[-170,180],[-100,250],
   [-110,75],[-150,145],[170,180],[100,250],
   [130,110],[-130,110],[160,230],[-160,230],
   [95,180],[-95,180],[180,120],[-180,120],
   [105,55],[-105,55],[140,270],[-140,270]
  ].forEach(function(pp){
    var tx=pp[0],tz=pp[1];
    var th=3.5+Math.random()*2.5;
    var trunk=new THREE.Mesh(new THREE.CylinderGeometry(.12,.35,th,6),deadM);
    trunk.position.set(tx,th/2,tz);
    trunk.rotation.z=(Math.random()-.5)*.5;
    trunk.rotation.x=(Math.random()-.5)*.15;
    scene.add(trunk);
    /* 뒤틀린 가지들 */
    for(var bi=0;bi<2+Math.floor(Math.random()*3);bi++){
      var bLen=1+Math.random()*1.8;
      var branch=new THREE.Mesh(new THREE.CylinderGeometry(.03,.08,bLen,4),deadM2);
      var bh=th*.4+Math.random()*th*.5;
      branch.position.set(tx+(Math.random()-.5)*1.2,bh,tz+(Math.random()-.5)*1.2);
      branch.rotation.z=(Math.random()-.5)*1.5;
      branch.rotation.x=(Math.random()-.5)*1.2;
      scene.add(branch);
    }
  });

  /* ── 이끼/덩굴 (나무에서 늘어지는) ── */
  var mossM=new THREE.MeshLambertMaterial({color:0x1a3a0a,transparent:true,opacity:.7});
  var vineSwampM=new THREE.MeshLambertMaterial({color:0x0a2a06,transparent:true,opacity:.6});
  [[110,75],[150,145],[-170,180],[-100,250],
   [-110,75],[-150,145],[170,180],[100,250],
   [130,110],[-130,110],[160,230],[-160,230]
  ].forEach(function(pp){
    for(var vi=0;vi<2+Math.floor(Math.random()*3);vi++){
      var vLen=1.5+Math.random()*2.5;
      var vine=new THREE.Mesh(new THREE.CylinderGeometry(.015,.025,vLen,3),vineSwampM);
      vine.position.set(pp[0]+(Math.random()-.5)*1.5,2+Math.random()*2,pp[1]+(Math.random()-.5)*1.5);
      scene.add(vine);
    }
    /* 이끼 덩어리 */
    if(Math.random()<.6){
      var moss=new THREE.Mesh(new THREE.SphereGeometry(.3+Math.random()*.3,5,4),mossM);
      moss.position.set(pp[0]+(Math.random()-.5)*.8,2.5+Math.random()*1.5,pp[1]+(Math.random()-.5)*.8);
      moss.scale.set(1,.4,1);
      scene.add(moss);
    }
  });

  /* ── 발광 버섯 ── */
  var shroomCapColors=[0x44ff88,0x22dd66,0x66ffaa,0x88ffcc,0x33ee55];
  var shroomStemM=new THREE.MeshLambertMaterial({color:0x2a2a1a});
  for(var si=0;si<30;si++){
    var sside=si<15?1:-1;
    var sx=sside*(85+Math.random()*110),sz=25+Math.random()*270;
    var capColor=shroomCapColors[Math.floor(Math.random()*shroomCapColors.length)];
    var capM=new THREE.MeshLambertMaterial({color:capColor,emissive:new THREE.Color(capColor),emissiveIntensity:.4});
    var capR=.1+Math.random()*.15;
    var stemH=.1+Math.random()*.15;
    var stem=new THREE.Mesh(new THREE.CylinderGeometry(.02,.03,stemH,4),shroomStemM);
    stem.position.set(sx,stemH/2,sz);scene.add(stem);
    var cap=new THREE.Mesh(new THREE.SphereGeometry(capR,6,4),capM);
    cap.position.set(sx,stemH+capR*.3,sz);cap.scale.y=.5;scene.add(cap);
    /* 일부 버섯에 은은한 빛 */
    if(Math.random()<.3){
      var sl=new THREE.PointLight(capColor,.15,3);sl.position.set(sx,stemH+.1,sz);scene.add(sl);
    }
  }

  /* ── 해골/뼈 장식 ── */
  var boneM=new THREE.MeshLambertMaterial({color:0xccccaa});
  var skullM=new THREE.MeshLambertMaterial({color:0xbbbb99});
  [[120,90],[-140,160],[160,250],[-110,200],[100,150],[-170,100],
   [170,270],[-130,280],[95,40],[-95,40]
  ].forEach(function(bp){
    if(Math.random()<.5){
      /* 해골 */
      var skull=new THREE.Mesh(new THREE.SphereGeometry(.15,6,5),skullM);
      skull.position.set(bp[0],.15,bp[1]);skull.scale.set(1,.85,.9);scene.add(skull);
      /* 눈 구멍 */
      var eyeM=new THREE.MeshBasicMaterial({color:0x000000});
      var eye1=new THREE.Mesh(new THREE.SphereGeometry(.03,4,4),eyeM);
      eye1.position.set(bp[0]-.05,.18,bp[1]-.12);scene.add(eye1);
      var eye2=new THREE.Mesh(new THREE.SphereGeometry(.03,4,4),eyeM);
      eye2.position.set(bp[0]+.05,.18,bp[1]-.12);scene.add(eye2);
    } else {
      /* 뼈다귀 */
      for(var bn=0;bn<2+Math.floor(Math.random()*3);bn++){
        var bone=new THREE.Mesh(new THREE.CylinderGeometry(.02,.025,.3+Math.random()*.3,4),boneM);
        bone.position.set(bp[0]+(Math.random()-.5)*.5,.04,bp[1]+(Math.random()-.5)*.5);
        bone.rotation.z=Math.random()*Math.PI;bone.rotation.x=Math.PI/2;
        scene.add(bone);
      }
    }
  });

  /* ── 부서진 나무 다리/판자길 ── */
  var plankM=new THREE.MeshLambertMaterial({color:0x2a1a08});
  var plankDarkM=new THREE.MeshLambertMaterial({color:0x1a0e04});
  /* 동쪽 다리 */
  (function(){
    var bx=115,bz=130;
    for(var pi=0;pi<8;pi++){
      var plank=new THREE.Mesh(new THREE.BoxGeometry(1.8,.08,.3),pi%3===0?plankDarkM:plankM);
      plank.position.set(bx,.06,bz+pi*.4);
      plank.rotation.y=(Math.random()-.5)*.15;
      if(pi===3||pi===6){plank.position.y=-.02;plank.rotation.z=(Math.random()-.5)*.3;}
      scene.add(plank);
    }
    /* 지지대 */
    var sup1=new THREE.Mesh(new THREE.CylinderGeometry(.04,.06,.5,4),plankDarkM);
    sup1.position.set(bx-.7,.15,bz);scene.add(sup1);
    var sup2=new THREE.Mesh(new THREE.CylinderGeometry(.04,.06,.5,4),plankDarkM);
    sup2.position.set(bx+.7,.15,bz+2.8);scene.add(sup2);
  })();
  /* 서쪽 부서진 다리 */
  (function(){
    var bx=-125,bz=200;
    for(var pi=0;pi<10;pi++){
      var plank=new THREE.Mesh(new THREE.BoxGeometry(1.6,.08,.28),pi%2===0?plankM:plankDarkM);
      plank.position.set(bx,.05,bz+pi*.38);
      plank.rotation.y=(Math.random()-.5)*.2;
      if(pi===2||pi===5||pi===8){plank.position.y=-.03;plank.rotation.z=(Math.random()-.5)*.4;}
      scene.add(plank);
    }
    var sup3=new THREE.Mesh(new THREE.CylinderGeometry(.04,.06,.4,4),plankDarkM);
    sup3.position.set(bx-.6,.12,bz+1);sup3.rotation.z=.3;scene.add(sup3);
  })();

  /* ── 작은 섬/흙 언덕 ── */
  var moundM=new THREE.MeshLambertMaterial({color:0x1a2a0a});
  var moundM2=new THREE.MeshLambertMaterial({color:0x152208});
  [[130,95,2.5],[160,200,3],[-120,140,2.8],[-160,250,2.2],
   [100,180,2],[-100,90,2.3],[170,150,1.8],[-170,220,2.0]
  ].forEach(function(mp){
    var mound=new THREE.Mesh(new THREE.SphereGeometry(mp[2],8,5),Math.random()<.5?moundM:moundM2);
    mound.position.set(mp[0],mp[2]*.15,mp[1]);
    mound.scale.set(1,.2,1);
    scene.add(mound);
    /* 언덕 위에 풀이나 작은 식물 */
    if(Math.random()<.6){
      var grassTuft=new THREE.Mesh(new THREE.ConeGeometry(.15,.4,4),new THREE.MeshLambertMaterial({color:0x1a3a08}));
      grassTuft.position.set(mp[0]+(Math.random()-.5)*.8,mp[2]*.3+.15,mp[1]+(Math.random()-.5)*.8);
      scene.add(grassTuft);
    }
  });

  /* ── 거미줄 (나무 사이) ── */
  var webM=new THREE.MeshBasicMaterial({color:0xaaaaaa,transparent:true,opacity:.08,side:THREE.DoubleSide});
  [[110,75,130,110],[-150,145,-130,110],[-170,180,-160,230],[170,180,160,230]
  ].forEach(function(wp){
    var web=new THREE.Mesh(new THREE.PlaneGeometry(3+Math.random()*2,2+Math.random()*1.5),webM);
    var mx=(wp[0]+wp[2])/2,mz=(wp[1]+wp[3])/2;
    web.position.set(mx,2.5+Math.random(),mz);
    web.rotation.y=Math.atan2(wp[3]-wp[1],wp[2]-wp[0]);
    web.rotation.x=(Math.random()-.5)*.3;
    scene.add(web);
  });

  /* ── 썩은 통나무 ── */
  var rotLogM=new THREE.MeshLambertMaterial({color:0x0e0a02});
  [[135,85,.8],[155,175,1.0],[-115,110,.7],[-145,240,.9],
   [100,260,.6],[-180,150,.8]
  ].forEach(function(rl){
    var log=new THREE.Mesh(new THREE.CylinderGeometry(.2,.3,2+Math.random()*1.5,6),rotLogM);
    log.rotation.z=Math.PI/2;log.rotation.y=rl[2];
    log.position.set(rl[0],.18,rl[1]);
    scene.add(log);
    /* 로그 위에 이끼 */
    var logMoss=new THREE.Mesh(new THREE.SphereGeometry(.2+Math.random()*.15,5,3),mossM);
    logMoss.position.set(rl[0],.35,rl[1]);logMoss.scale.set(2,.3,1);
    scene.add(logMoss);
  });

  /* ── 몬스터 스폰 — 동서 양쪽 3x 확장 좌표 ── */
  var sd=MONSTER_DEFS.find(function(x){return x.id==='slime';});
  var td=MONSTER_DEFS.find(function(x){return x.id==='toad';});
  /* 동쪽 늪 (x:240~600, z:20~900) */
  if(sd)[[280,120],[380,350],[320,580],[420,750],[500,220],[550,480]
        ].forEach(function(pp){spawnMonster(sd,pp[0],pp[1],scene);});
  if(td)[[300,200],[450,420],[350,650],[480,850],[540,300],[400,700]
        ].forEach(function(pp){spawnMonster(td,pp[0],pp[1],scene);});
  /* 서쪽 늪 (x:-240~-600, z:20~900) */
  if(sd)[[-280,120],[-380,350],[-320,580],[-420,750],[-500,220],[-550,480]
        ].forEach(function(pp){spawnMonster(sd,pp[0],pp[1],scene);});
  if(td)[[-300,200],[-450,420],[-350,650],[-480,850],[-540,300],[-400,700]
        ].forEach(function(pp){spawnMonster(td,pp[0],pp[1],scene);});
  /* ★ 엘리트: 독왕 두꺼비 */
  var et=MONSTER_DEFS.find(function(x){return x.id==='elite_toad';});
  if(et)spawnMonster(et,400,600,scene);
}

function buildDarkForest(){
  /* 어두운 숲: x:-120~120, z:300~560 */
  var i,tx,tz,th,ang,rx,rz,rs;

  /* ═══ 공유 머티리얼 (성능 최적화) ═══ */
  var darkTrunkM=new THREE.MeshLambertMaterial({color:0x1a0e05});
  var darkTrunk2M=new THREE.MeshLambertMaterial({color:0x0d0804});
  var darkLeafM=new THREE.MeshLambertMaterial({color:0x0a1a08});
  var purpleLeafM=new THREE.MeshLambertMaterial({color:0x150a20});
  var darkLeaf2M=new THREE.MeshLambertMaterial({color:0x081510});
  var stoneM=new THREE.MeshLambertMaterial({color:0x2a2a2a});
  var darkStoneM=new THREE.MeshLambertMaterial({color:0x1a1a1a});
  var mossStoneM=new THREE.MeshLambertMaterial({color:0x1a2a18});
  var woodM=new THREE.MeshLambertMaterial({color:0x2a1a08});
  var darkWoodM=new THREE.MeshLambertMaterial({color:0x1a0e05});
  var rockM=new THREE.MeshLambertMaterial({color:0x2a2018});
  var boneM=new THREE.MeshLambertMaterial({color:0xd0c8b0});
  var ironM=new THREE.MeshLambertMaterial({color:0x3a3a3a});
  var ropeM=new THREE.MeshLambertMaterial({color:0x4a3a1a});
  var runeGlowM=new THREE.MeshBasicMaterial({color:0x6622ff,transparent:true,opacity:.6});
  var cobwebM=new THREE.MeshBasicMaterial({color:0xaaaaaa,transparent:true,opacity:.15,side:THREE.DoubleSide});
  var fogM=new THREE.MeshLambertMaterial({color:0x050208,transparent:true,opacity:.08});
  var fogM2=new THREE.MeshLambertMaterial({color:0x080310,transparent:true,opacity:.12});
  var redEyeM=new THREE.MeshBasicMaterial({color:0xff1100,transparent:true,opacity:.8});
  var yellowEyeM=new THREE.MeshBasicMaterial({color:0xffaa00,transparent:true,opacity:.7});
  var purplePartM=new THREE.MeshBasicMaterial({color:0x6622cc,transparent:true,opacity:.4});
  var bluePartM=new THREE.MeshBasicMaterial({color:0x2244cc,transparent:true,opacity:.35});
  var mushroomCapM=new THREE.MeshLambertMaterial({color:0x551122});
  var mushroomStemM=new THREE.MeshLambertMaterial({color:0xccbb99});
  var glowMushroomM=new THREE.MeshBasicMaterial({color:0x22ff88,transparent:true,opacity:.5});
  var deadGrassM=new THREE.MeshLambertMaterial({color:0x2a2218});
  var brownGrassM=new THREE.MeshLambertMaterial({color:0x3a2a10});
  var puddleM=new THREE.MeshLambertMaterial({color:0x0a0a15,transparent:true,opacity:.7});
  var rootM=new THREE.MeshLambertMaterial({color:0x1a0e05});
  var tentM=new THREE.MeshLambertMaterial({color:0x4a3a10});
  var fireM=new THREE.MeshLambertMaterial({color:0xff5500,emissive:new THREE.Color(0xff2200),emissiveIntensity:.8});
  var skullM=new THREE.MeshLambertMaterial({color:0xc8c0a8});

  /* ═══ 길 ═══ */
  var r3=new THREE.Mesh(new THREE.PlaneGeometry(6,260),new THREE.MeshLambertMaterial({color:0x0a0806}));
  r3.rotation.x=-Math.PI/2;r3.position.set(0,.013,430);scene.add(r3);

  /* ═══ 조명 — 어둡고 보라/파란 톤 ═══ */
  var pl3=new THREE.PointLight(0x220833,.4,200);pl3.position.set(0,6,430);scene.add(pl3);
  var pl3b=new THREE.PointLight(0x110822,.3,180);pl3b.position.set(-60,5,380);scene.add(pl3b);
  var pl3c=new THREE.PointLight(0x0a0633,.3,180);pl3c.position.set(60,5,500);scene.add(pl3c);
  var pl3d=new THREE.PointLight(0x180040,.25,150);pl3d.position.set(-80,4,480);scene.add(pl3d);
  var pl3e=new THREE.PointLight(0x100030,.25,150);pl3e.position.set(80,4,360);scene.add(pl3e);

  /* ═══ 빽빽한 어두운 나무 — 75그루 ═══ */
  var darkTreeGeo1=new THREE.CylinderGeometry(.15,.35,1,6);
  var darkTreeGeo2=new THREE.CylinderGeometry(.2,.4,1,6);
  var darkLeafGeo1=new THREE.ConeGeometry(1,1,7);
  var darkLeafGeo2=new THREE.SphereGeometry(1,6,5);
  for(i=0;i<75;i++){
    tx=-110+Math.random()*220;tz=305+Math.random()*250;
    /* 길 근처는 피함 */
    if(Math.abs(tx)<5)tx+=(tx>=0?5:-5)+Math.random()*8;
    th=4+Math.random()*5;
    var tScale=1.2+Math.random()*1.2;
    var trunkGeo=Math.random()<.5?darkTreeGeo1:darkTreeGeo2;
    var trunkMat=Math.random()<.5?darkTrunkM:darkTrunk2M;
    var trunk=new THREE.Mesh(trunkGeo,trunkMat);
    trunk.scale.set(tScale,th,tScale);trunk.position.set(tx,th/2,tz);scene.add(trunk);
    /* 잎 — 어두운 녹색 또는 보라 */
    var leafR=1.8*tScale+Math.random()*1.2;
    var leafMat=Math.random()<.6?darkLeafM:(Math.random()<.5?purpleLeafM:darkLeaf2M);
    if(Math.random()<.5){
      var leaf=new THREE.Mesh(darkLeafGeo1,leafMat);
      leaf.scale.set(leafR,2.5*tScale,leafR);leaf.position.set(tx,th+leafR*.3,tz);scene.add(leaf);
    }else{
      var leaf=new THREE.Mesh(darkLeafGeo2,leafMat);
      leaf.scale.set(leafR,leafR*.7,leafR);leaf.position.set(tx,th+leafR*.2,tz);scene.add(leaf);
    }
    /* 일부 나무에 두 번째 잎 레이어 */
    if(Math.random()<.4){
      var lr2=1.2*tScale;
      var leaf2=new THREE.Mesh(darkLeafGeo1,purpleLeafM);
      leaf2.scale.set(lr2,1.8*tScale,lr2);leaf2.position.set(tx+Math.random()-.5,th+leafR*.6,tz+Math.random()-.5);scene.add(leaf2);
    }
    /* 나무 뿌리가 튀어나옴 */
    if(Math.random()<.3){
      for(var ri=0;ri<3;ri++){
        ang=Math.random()*Math.PI*2;
        var rootLen=1+Math.random()*1.5;
        var root=new THREE.Mesh(new THREE.CylinderGeometry(.03,.08,rootLen,4),rootM);
        root.position.set(tx+Math.cos(ang)*.6,rootLen*.2,tz+Math.sin(ang)*.6);
        root.rotation.z=Math.PI/4*(Math.random()-.5);root.rotation.y=ang;scene.add(root);
      }
    }
  }

  /* ═══ 쓰러진/부러진 나무 5개 ═══ */
  [[-35,380],[60,440],[-80,510],[40,340],[95,490]].forEach(function(pp){
    var fth=4+Math.random()*3;
    var fallen=new THREE.Mesh(new THREE.CylinderGeometry(.15,.3,fth,6),darkTrunkM);
    fallen.position.set(pp[0],.3,pp[1]);fallen.rotation.z=Math.PI/2;
    fallen.rotation.y=Math.random()*Math.PI;scene.add(fallen);
    /* 부러진 가지 */
    var branch=new THREE.Mesh(new THREE.CylinderGeometry(.05,.1,1.5,4),darkTrunk2M);
    branch.position.set(pp[0]+.8,.5,pp[1]+.5);branch.rotation.z=Math.PI/3;scene.add(branch);
  });

  /* ═══ 바위들 (더 많이) ═══ */
  [[-25,340,1.4],[28,415,1.0],[-30,480,1.3],[22,540,1.5],
   [50,370,1.3],[-70,450,1.4],[-95,340,1.1],[85,380,1.2],
   [-45,520,1.0],[65,530,1.1],[-100,490,0.9],[100,340,1.0]
  ].forEach(function(pp){
    rx=pp[0];rz=pp[1];rs=pp[2];
    var rock=new THREE.Mesh(new THREE.DodecahedronGeometry(rs,0),rockM);
    rock.position.set(rx,rs*.4,rz);rock.rotation.y=Math.random()*Math.PI;scene.add(rock);
  });

  /* ═══ 두꺼운 안개 — 25개 레이어 ═══ */
  for(i=0;i<25;i++){
    var fMat=Math.random()<.5?fogM:fogM2;
    var fogP=new THREE.Mesh(new THREE.PlaneGeometry(18+Math.random()*15,12+Math.random()*10),fMat);
    fogP.rotation.x=-Math.PI/2;fogP.position.set((Math.random()-.5)*220,.15+Math.random()*.3,310+Math.random()*245);scene.add(fogP);
  }
  /* 수직 안개 벽 */
  for(i=0;i<10;i++){
    var vFog=new THREE.Mesh(new THREE.PlaneGeometry(8+Math.random()*6,3+Math.random()*2),fogM2);
    vFog.position.set((Math.random()-.5)*200,2+Math.random()*2,310+Math.random()*245);
    vFog.rotation.y=Math.random()*Math.PI;scene.add(vFog);
  }

  /* ═══ 거미줄 — 나무 사이 ═══ */
  for(i=0;i<20;i++){
    var cwx=(Math.random()-.5)*200,cwz=310+Math.random()*240;
    var cwSize=2+Math.random()*3;
    var web=new THREE.Mesh(new THREE.PlaneGeometry(cwSize,cwSize),cobwebM);
    web.position.set(cwx,2+Math.random()*4,cwz);
    web.rotation.y=Math.random()*Math.PI;web.rotation.x=Math.random()*.3-.15;scene.add(web);
  }

  /* ═══ 어둠 속 빛나는 눈 — 20쌍 ═══ */
  for(i=0;i<20;i++){
    var ex=(Math.random()-.5)*220,ez=310+Math.random()*245;
    var ey=.8+Math.random()*2.5;
    var eMat=Math.random()<.6?redEyeM:yellowEyeM;
    var eyeSize=.04+Math.random()*.03;
    var eye1=new THREE.Mesh(new THREE.SphereGeometry(eyeSize,4,4),eMat);
    eye1.position.set(ex,ey,ez);scene.add(eye1);
    var eye2=new THREE.Mesh(new THREE.SphereGeometry(eyeSize,4,4),eMat);
    eye2.position.set(ex+.15+Math.random()*.1,ey,ez);scene.add(eye2);
  }

  /* ═══ 보라/파란 부유 파티클 — 40개 ═══ */
  for(i=0;i<40;i++){
    var ppx=(Math.random()-.5)*220,ppz=305+Math.random()*250;
    var ppy=.5+Math.random()*5;
    var pMat=Math.random()<.5?purplePartM:bluePartM;
    var particle=new THREE.Mesh(new THREE.SphereGeometry(.03+Math.random()*.04,4,4),pMat);
    particle.position.set(ppx,ppy,ppz);scene.add(particle);
  }

  /* ═══ 붉은 파티클 (기존 유지) ═══ */
  var redPartM2=new THREE.MeshBasicMaterial({color:0xff2200,transparent:true,opacity:.5});
  for(i=0;i<15;i++){
    var rpx=(Math.random()-.5)*220,rpz=305+Math.random()*250;
    var rpy=1+Math.random()*3;
    var redP=new THREE.Mesh(new THREE.SphereGeometry(.04+Math.random()*.03,4,4),redPartM2);
    redP.position.set(rpx,rpy,rpz);scene.add(redP);
  }

  /* ═══ 버섯 링 (요정 원) — 5개 ═══ */
  [[30,390],[-50,440],[-20,530],[70,360],[-85,500]].forEach(function(pp){
    var cx=pp[0],cz=pp[1];
    var mCount=8+Math.floor(Math.random()*5);
    var mRadius=2+Math.random()*2;
    for(var mi=0;mi<mCount;mi++){
      ang=(mi/mCount)*Math.PI*2;
      var mx=cx+Math.cos(ang)*mRadius,mz=cz+Math.sin(ang)*mRadius;
      var mh=.2+Math.random()*.3;
      var stem=new THREE.Mesh(new THREE.CylinderGeometry(.04,.06,mh,4),mushroomStemM);
      stem.position.set(mx,mh/2,mz);scene.add(stem);
      var cap=new THREE.Mesh(new THREE.SphereGeometry(.12+Math.random()*.08,5,4),mushroomCapM);
      cap.position.set(mx,mh+.05,mz);cap.scale.y=.4;scene.add(cap);
    }
    /* 중앙 발광 버섯 */
    var gStem=new THREE.Mesh(new THREE.CylinderGeometry(.06,.08,.4,4),mushroomStemM);
    gStem.position.set(cx,.2,cz);scene.add(gStem);
    var gCap=new THREE.Mesh(new THREE.SphereGeometry(.2,5,4),glowMushroomM);
    gCap.position.set(cx,.45,cz);gCap.scale.y=.4;scene.add(gCap);
    var gLight=new THREE.PointLight(0x22ff88,.3,5);gLight.position.set(cx,.5,cz);scene.add(gLight);
  });

  /* ═══ 죽은 풀 패치 ═══ */
  for(i=0;i<30;i++){
    var dgx=(Math.random()-.5)*220,dgz=310+Math.random()*245;
    var dgMat=Math.random()<.5?deadGrassM:brownGrassM;
    var dg=new THREE.Mesh(new THREE.PlaneGeometry(.8+Math.random()*.6,.8+Math.random()*.6),dgMat);
    dg.rotation.x=-Math.PI/2;dg.position.set(dgx,.01,dgz);scene.add(dg);
  }

  /* ═══ 물웅덩이 (어둡고 반사) ═══ */
  [[-40,360],[55,420],[-65,500],[20,380],[-15,550],[80,470],[-90,430]].forEach(function(pp){
    var puddle=new THREE.Mesh(new THREE.CircleGeometry(1+Math.random()*1.5,8),puddleM);
    puddle.rotation.x=-Math.PI/2;puddle.position.set(pp[0],.015,pp[1]);scene.add(puddle);
  });

  /* ═══ 흩어진 뼈다귀 ═══ */
  for(i=0;i<18;i++){
    var bx=(Math.random()-.5)*200,bz=315+Math.random()*235;
    var bLen=.3+Math.random()*.5;
    var bone=new THREE.Mesh(new THREE.CylinderGeometry(.02,.03,bLen,4),boneM);
    bone.position.set(bx,.05,bz);bone.rotation.z=Math.PI/2;
    bone.rotation.y=Math.random()*Math.PI;scene.add(bone);
  }
  /* 두개골 5개 */
  [[-20,370],[45,450],[-55,530],[10,320],[75,510]].forEach(function(pp){
    var skull=new THREE.Mesh(new THREE.SphereGeometry(.12,5,5),skullM);
    skull.position.set(pp[0],.12,pp[1]);skull.scale.z=.8;scene.add(skull);
  });

  /* ═══════════════════════════════════════ */
  /* ═══ 구조물 / 건물들 ═══ */
  /* ═══════════════════════════════════════ */

  /* ── 1. 폐허 석벽 (Abandoned Ruins) ── */
  /* 큰 무너진 벽 3개 */
  [[-70,350,8,3,.6,0],[-68,353,5,2,.6,.3],[-75,348,3,1.5,.6,.8]].forEach(function(pp){
    var wall=new THREE.Mesh(new THREE.BoxGeometry(pp[2],pp[3],pp[4]),stoneM);
    wall.position.set(pp[0],pp[3]/2,pp[1]);wall.rotation.y=pp[5];scene.add(wall);
  });
  /* 무너진 기둥 */
  [[-73,345],[-65,355]].forEach(function(pp){
    var pillar=new THREE.Mesh(new THREE.CylinderGeometry(.3,.35,2.5,6),darkStoneM);
    pillar.position.set(pp[0],1.25,pp[1]);scene.add(pillar);
    /* 무너진 조각 */
    var debris=new THREE.Mesh(new THREE.DodecahedronGeometry(.4,0),stoneM);
    debris.position.set(pp[0]+1,.2,pp[1]+.5);debris.rotation.y=Math.random()*Math.PI;scene.add(debris);
  });
  /* 바닥 타일 */
  var ruinFloor=new THREE.Mesh(new THREE.PlaneGeometry(10,8),new THREE.MeshLambertMaterial({color:0x222222}));
  ruinFloor.rotation.x=-Math.PI/2;ruinFloor.position.set(-70,.012,351);scene.add(ruinFloor);

  /* ── 2. 무너진 탑 (Crumbled Tower) ── */
  var tower=new THREE.Mesh(new THREE.CylinderGeometry(2,2.5,5,8),darkStoneM);
  tower.position.set(85,2.5,520);scene.add(tower);
  /* 부서진 윗부분 — 비대칭 */
  var tTop=new THREE.Mesh(new THREE.CylinderGeometry(1.5,2,1.5,8,1,true),stoneM);
  tTop.position.set(85,5.5,520);scene.add(tTop);
  /* 잔해 주변 */
  for(i=0;i<6;i++){
    ang=Math.random()*Math.PI*2;
    var debr=new THREE.Mesh(new THREE.DodecahedronGeometry(.4+Math.random()*.3,0),stoneM);
    debr.position.set(85+Math.cos(ang)*3,.2,520+Math.sin(ang)*3);debr.rotation.y=Math.random()*3;scene.add(debr);
  }

  /* ── 3. 마녀의 오두막 (Witch's Hut on Stilts) ── */
  var hutX=-90,hutZ=470;
  /* 다리 (stilts) 4개 */
  [[-1.2,-1.2],[1.2,-1.2],[-1.2,1.2],[1.2,1.2]].forEach(function(pp){
    var stilt=new THREE.Mesh(new THREE.CylinderGeometry(.12,.15,3,5),darkWoodM);
    stilt.position.set(hutX+pp[0],1.5,hutZ+pp[1]);scene.add(stilt);
  });
  /* 바닥 */
  var hutFloor=new THREE.Mesh(new THREE.BoxGeometry(3.5,.15,3.5),woodM);
  hutFloor.position.set(hutX,3,hutZ);scene.add(hutFloor);
  /* 벽 — 비대칭 기울어진 박스 */
  var hutWall=new THREE.Mesh(new THREE.BoxGeometry(3,2.5,3),darkWoodM);
  hutWall.position.set(hutX,4.3,hutZ);hutWall.rotation.y=.1;hutWall.rotation.z=.05;scene.add(hutWall);
  /* 지붕 — 비뚤어진 원뿔 */
  var hutRoof=new THREE.Mesh(new THREE.ConeGeometry(2.5,2,6),new THREE.MeshLambertMaterial({color:0x1a1008}));
  hutRoof.position.set(hutX-.2,6.3,hutZ+.1);hutRoof.rotation.z=.08;scene.add(hutRoof);
  /* 굴뚝 */
  var chimney=new THREE.Mesh(new THREE.CylinderGeometry(.15,.18,1.5,4),stoneM);
  chimney.position.set(hutX+1,7,hutZ-.5);scene.add(chimney);
  /* 굴뚝 연기 */
  var hSmoke=new THREE.Mesh(new THREE.SphereGeometry(.3,5,4),new THREE.MeshBasicMaterial({color:0x2a1a2a,transparent:true,opacity:.2}));
  hSmoke.position.set(hutX+1,7.8,hutZ-.5);scene.add(hSmoke);
  /* 창문 빛 */
  var hutWindow=new THREE.Mesh(new THREE.PlaneGeometry(.4,.4),new THREE.MeshBasicMaterial({color:0x44ff22,transparent:true,opacity:.5}));
  hutWindow.position.set(hutX-1.52,4.5,hutZ);scene.add(hutWindow);
  var hutLight=new THREE.PointLight(0x44ff22,.6,8);hutLight.position.set(hutX,4.5,hutZ);scene.add(hutLight);
  /* 사다리 */
  var ladderRail1=new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,3.5,4),woodM);
  ladderRail1.position.set(hutX+1.8,1.5,hutZ-.3);ladderRail1.rotation.z=.3;scene.add(ladderRail1);
  var ladderRail2=new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,3.5,4),woodM);
  ladderRail2.position.set(hutX+1.8,1.5,hutZ+.3);ladderRail2.rotation.z=.3;scene.add(ladderRail2);

  /* ── 4. 고대 석제단 (Ancient Altar with Glowing Runes) ── */
  var altX=0,altZ=480;
  /* 제단 기반 */
  var altarBase=new THREE.Mesh(new THREE.CylinderGeometry(3,3.5,.8,8),darkStoneM);
  altarBase.position.set(altX,.4,altZ);scene.add(altarBase);
  /* 제단 상판 */
  var altarTop=new THREE.Mesh(new THREE.BoxGeometry(2.5,.4,1.5),stoneM);
  altarTop.position.set(altX,1,altZ);scene.add(altarTop);
  /* 빛나는 룬 — 바닥 원형 패턴 */
  for(i=0;i<8;i++){
    ang=(i/8)*Math.PI*2;
    var rune=new THREE.Mesh(new THREE.PlaneGeometry(.3,.3),runeGlowM);
    rune.rotation.x=-Math.PI/2;rune.position.set(altX+Math.cos(ang)*2.5,.82,altZ+Math.sin(ang)*2.5);scene.add(rune);
  }
  /* 상판 위 룬 */
  for(i=0;i<4;i++){
    var runeTop=new THREE.Mesh(new THREE.PlaneGeometry(.2,.2),runeGlowM);
    runeTop.rotation.x=-Math.PI/2;runeTop.position.set(altX-.6+i*.4,1.21,altZ);scene.add(runeTop);
  }
  /* 보라 기둥 빛 */
  var altarGlow=new THREE.Mesh(new THREE.CylinderGeometry(.1,.3,3,6),new THREE.MeshBasicMaterial({color:0x6622ff,transparent:true,opacity:.15}));
  altarGlow.position.set(altX,2.5,altZ);scene.add(altarGlow);
  var altarLight=new THREE.PointLight(0x6622ff,1,15);altarLight.position.set(altX,2,altZ);scene.add(altarLight);
  /* 양쪽 촛대 */
  [-1.5,1.5].forEach(function(dx){
    var candleStick=new THREE.Mesh(new THREE.CylinderGeometry(.06,.08,1.2,5),ironM);
    candleStick.position.set(altX+dx,1.6,altZ);scene.add(candleStick);
    var flame=new THREE.Mesh(new THREE.ConeGeometry(.06,.15,4),new THREE.MeshBasicMaterial({color:0xaa44ff,transparent:true,opacity:.7}));
    flame.position.set(altX+dx,2.25,altZ);scene.add(flame);
  });

  /* ── 5. 무너진 석문 (Collapsed Stone Archway) ── */
  var archX=15,archZ=370;
  /* 왼쪽 기둥 */
  var archL=new THREE.Mesh(new THREE.BoxGeometry(1,5,1),mossStoneM);
  archL.position.set(archX-2.5,2.5,archZ);scene.add(archL);
  /* 오른쪽 기둥 — 반쯤 무너짐 */
  var archR=new THREE.Mesh(new THREE.BoxGeometry(1,3,1),stoneM);
  archR.position.set(archX+2.5,1.5,archZ);archR.rotation.z=.15;scene.add(archR);
  /* 상인방 — 기울어져 걸쳐짐 */
  var archTop=new THREE.Mesh(new THREE.BoxGeometry(6.5,.8,1.2),darkStoneM);
  archTop.position.set(archX,4.2,archZ);archTop.rotation.z=.12;scene.add(archTop);
  /* 잔해 */
  for(i=0;i<4;i++){
    var aDebris=new THREE.Mesh(new THREE.DodecahedronGeometry(.3+Math.random()*.2,0),stoneM);
    aDebris.position.set(archX+2+Math.random()*2,.15,archZ+Math.random()*2-1);scene.add(aDebris);
  }

  /* ── 6. 부서진 나무 망루 (Broken Watchtower) ── */
  var wtX=95,wtZ=400;
  /* 기둥 4개 */
  [[-1.5,-1.5],[1.5,-1.5],[-1.5,1.5],[1.5,1.5]].forEach(function(pp){
    var post=new THREE.Mesh(new THREE.CylinderGeometry(.12,.15,6,5),darkWoodM);
    post.position.set(wtX+pp[0],3,wtZ+pp[1]);scene.add(post);
  });
  /* 플랫폼 */
  var wtPlat=new THREE.Mesh(new THREE.BoxGeometry(4,.15,4),woodM);
  wtPlat.position.set(wtX,5,wtZ);wtPlat.rotation.z=.05;scene.add(wtPlat);
  /* 부서진 난간 */
  var wtRail=new THREE.Mesh(new THREE.BoxGeometry(4,.3,.1),woodM);
  wtRail.position.set(wtX,5.5,wtZ-2);scene.add(wtRail);
  /* 부러진 사다리 */
  var wtLadder=new THREE.Mesh(new THREE.BoxGeometry(.3,.08,4),darkWoodM);
  wtLadder.position.set(wtX+2,2.5,wtZ);wtLadder.rotation.z=.8;scene.add(wtLadder);

  /* ── 7. 나무에 매달린 새장 (Hanging Cages) ── */
  [[-50,415,4],[-30,505,3.5],[60,385,4.5],[40,525,3.8]].forEach(function(pp){
    var cageX=pp[0],cageZ=pp[1],cageH=pp[2];
    /* 밧줄 */
    var rope=new THREE.Mesh(new THREE.CylinderGeometry(.02,.02,2,4),ropeM);
    rope.position.set(cageX,cageH+1,cageZ);scene.add(rope);
    /* 새장 프레임 — 구체 와이어 */
    var cage=new THREE.Mesh(new THREE.SphereGeometry(.6,6,4),new THREE.MeshLambertMaterial({color:0x3a3a3a,wireframe:true}));
    cage.position.set(cageX,cageH,cageZ);scene.add(cage);
    /* 내부 해골 (일부) */
    if(Math.random()<.5){
      var cSkull=new THREE.Mesh(new THREE.SphereGeometry(.1,4,4),skullM);
      cSkull.position.set(cageX,cageH-.2,cageZ);scene.add(cSkull);
    }
  });

  /* ── 8. 토템 폴 (Totem Poles with Skulls) ── */
  [[-100,360],[100,480],[-95,540],[105,350]].forEach(function(pp){
    var tpX=pp[0],tpZ=pp[1];
    var tpH=3+Math.random()*2;
    /* 기둥 */
    var pole=new THREE.Mesh(new THREE.CylinderGeometry(.2,.25,tpH,6),darkWoodM);
    pole.position.set(tpX,tpH/2,tpZ);scene.add(pole);
    /* 두개골 2-3개 */
    var skullCount=2+Math.floor(Math.random()*2);
    for(var si=0;si<skullCount;si++){
      ang=Math.random()*Math.PI*2;
      var tSkull=new THREE.Mesh(new THREE.SphereGeometry(.15,5,5),skullM);
      tSkull.position.set(tpX+Math.cos(ang)*.25,1+si*1.2,tpZ+Math.sin(ang)*.25);
      tSkull.scale.z=.7;scene.add(tSkull);
    }
    /* 꼭대기 큰 두개골 */
    var topSkull=new THREE.Mesh(new THREE.SphereGeometry(.25,5,5),skullM);
    topSkull.position.set(tpX,tpH+.1,tpZ);topSkull.scale.z=.7;scene.add(topSkull);
    /* 빛나는 눈 */
    var tsEye1=new THREE.Mesh(new THREE.SphereGeometry(.04,3,3),redEyeM);
    tsEye1.position.set(tpX-.08,tpH+.15,tpZ+.2);scene.add(tsEye1);
    var tsEye2=new THREE.Mesh(new THREE.SphereGeometry(.04,3,3),redEyeM);
    tsEye2.position.set(tpX+.08,tpH+.15,tpZ+.2);scene.add(tsEye2);
  });

  /* ═══ 뿌리 (지면 돌출) ═══ */
  for(i=0;i<25;i++){
    rx=(Math.random()-.5)*200;rz=315+Math.random()*235;
    var rLen=1+Math.random()*2;
    var rootGround=new THREE.Mesh(new THREE.CylinderGeometry(.04,.08,rLen,4),rootM);
    rootGround.position.set(rx,.08,rz);rootGround.rotation.z=Math.PI/2;
    rootGround.rotation.y=Math.random()*Math.PI;scene.add(rootGround);
  }

  /* ═══ 고블린 캠프 1 ═══ */
  var tent1=new THREE.Mesh(new THREE.ConeGeometry(3,3,6),tentM);tent1.position.set(-25,1.5,345);scene.add(tent1);
  var campfire1=new THREE.Mesh(new THREE.ConeGeometry(.3,.6,5),fireM);
  campfire1.position.set(-22,.3,350);scene.add(campfire1);
  var cfl1=new THREE.PointLight(0xff4400,1.5,15);cfl1.position.set(-22,1,350);scene.add(cfl1);
  /* ═══ 고블린 캠프 2 ═══ */
  var tent2=new THREE.Mesh(new THREE.ConeGeometry(3,3,6),tentM);tent2.position.set(30,1.5,460);scene.add(tent2);
  var campfire2=new THREE.Mesh(new THREE.ConeGeometry(.3,.6,5),fireM);
  campfire2.position.set(28,.3,465);scene.add(campfire2);
  var cfl2=new THREE.PointLight(0xff4400,1.5,15);cfl2.position.set(28,1,465);scene.add(cfl2);
  /* ═══ 캠프파이어 3 ═══ */
  var campfire3=new THREE.Mesh(new THREE.ConeGeometry(.25,.5,5),new THREE.MeshLambertMaterial({color:0xff4400,emissive:new THREE.Color(0xff1100),emissiveIntensity:.7}));
  campfire3.position.set(-15,.25,510);scene.add(campfire3);
  var cfl3=new THREE.PointLight(0xff3300,1.2,12);cfl3.position.set(-15,1,510);scene.add(cfl3);

  /* ═══ 몬스터 스폰 — 3x 확장 좌표 (z:900~1680, x:-360~360) ═══ */
  var gd=MONSTER_DEFS.find(function(x){return x.id==='goblin';});
  var wd=MONSTER_DEFS.find(function(x){return x.id==='wolf';});
  if(gd)[
    [-80,950],[60,1080],[-40,1200],[100,1320],
    [-120,1450],[30,1550],[-60,1620],[80,1400]
  ].forEach(function(pp){spawnMonster(gd,pp[0],pp[1],scene);});
  if(wd)[
    [120,980],[-100,1100],[60,1250],[-80,1380],
    [100,1500],[-50,1600],[80,1650],[-120,1350]
  ].forEach(function(pp){spawnMonster(wd,pp[0],pp[1],scene);});
  /* ★ 엘리트: 늑대 대장 */
  var ew=MONSTER_DEFS.find(function(x){return x.id==='elite_wolf';});
  if(ew)spawnMonster(ew,-200,1550,scene);
}

function buildJungle(){
  /* 정글: x:240~600, z:900~1680 (3x 확장) */
  /* 지면 — 진한 초록 */
  var jGround=new THREE.Mesh(new THREE.PlaneGeometry(360,780),new THREE.MeshLambertMaterial({color:0x0a3a0a}));
  jGround.rotation.x=-Math.PI/2;jGround.position.set(420,.005,1290);scene.add(jGround);
  /* 조명 — 초록빛 */
  var jl=new THREE.PointLight(0x22aa44,.5,400);jl.position.set(400,8,1290);scene.add(jl);
  var jl2=new THREE.PointLight(0x22aa44,.4,300);jl2.position.set(500,8,1500);scene.add(jl2);
  /* 빽빽한 열대 나무 — 랜덤 100그루 (3x) */
  var jTrunkM=new THREE.MeshLambertMaterial({color:0x3a2a10});
  for(var jt=0;jt<100;jt++){
    var tx=245+Math.random()*350,tz=905+Math.random()*770;
    var th=5+Math.random()*4;
    var trunk=new THREE.Mesh(new THREE.CylinderGeometry(.25+Math.random()*.2,.4+Math.random()*.3,th,6),jTrunkM);
    trunk.position.set(tx,th/2,tz);scene.add(trunk);
    var lr=2+Math.random()*2;
    var leaves=new THREE.Mesh(new THREE.SphereGeometry(lr,6,5),new THREE.MeshLambertMaterial({color:0x0a5515+Math.floor(Math.random()*0x115511)}));
    leaves.position.set(tx,th+lr*.4,tz);leaves.scale.y=.5+Math.random()*.3;scene.add(leaves);
    if(Math.random()<.4){
      var lr2=1.5+Math.random()*1.2;
      var leaves2=new THREE.Mesh(new THREE.SphereGeometry(lr2,5,4),new THREE.MeshLambertMaterial({color:0x117722+Math.floor(Math.random()*0x114400)}));
      leaves2.position.set(tx+Math.random()-.5,th+lr*.2,tz+Math.random()-.5);leaves2.scale.y=.5;scene.add(leaves2);
    }
  }
  /* 작은 관목 */
  var bushM=new THREE.MeshLambertMaterial({color:0x1a6625});
  for(var jb=0;jb<50;jb++){
    var bx=245+Math.random()*350,bz=905+Math.random()*770;
    var bush=new THREE.Mesh(new THREE.SphereGeometry(.6+Math.random()*.5,5,4),bushM);
    bush.position.set(bx,.4,bz);bush.scale.y=.6;scene.add(bush);
  }
  /* 덩굴 */
  var vineM=new THREE.MeshLambertMaterial({color:0x228833});
  for(var vi=0;vi<60;vi++){
    var vx=245+Math.random()*350,vz=905+Math.random()*770;
    var vl=2+Math.random()*4;
    var vine=new THREE.Mesh(new THREE.CylinderGeometry(.02,.04,vl,4),vineM);
    vine.position.set(vx,1+Math.random()*3,vz);scene.add(vine);
  }
  /* 형광 파티클 */
  var glowM=new THREE.MeshBasicMaterial({color:0x44ff44,transparent:true,opacity:.7});
  for(var gp=0;gp<80;gp++){
    var gx=245+Math.random()*350,gz=905+Math.random()*770;
    var gy=.5+Math.random()*4;
    var glow=new THREE.Mesh(new THREE.SphereGeometry(.05,4,4),glowM);
    glow.position.set(gx,gy,gz);scene.add(glow);
  }
  /* 몬스터 스폰 — 3x 확장 */
  var sp=MONSTER_DEFS.find(function(x){return x.id==='jungle_spider';});
  var sn=MONSTER_DEFS.find(function(x){return x.id==='jungle_snake';});
  var ap=MONSTER_DEFS.find(function(x){return x.id==='jungle_ape';});
  if(sp)[[270,960],[380,1100],[450,1250],[320,1400],[500,1550],[560,1000],[290,1600],[420,1300]
        ].forEach(function(pp){spawnMonster(sp,pp[0],pp[1],scene);});
  if(sn)[[300,1020],[430,1180],[480,1350],[350,1500],[520,1620],[260,1080],[400,1450],[550,1200]
        ].forEach(function(pp){spawnMonster(sn,pp[0],pp[1],scene);});
  if(ap)[[360,1050],[490,1300],[540,1480],[280,1580],[320,1200],[460,1600]
        ].forEach(function(pp){spawnMonster(ap,pp[0],pp[1],scene);});
  var pt=MONSTER_DEFS.find(function(x){return x.id==='jungle_panther';});
  if(pt)[[340,1100],[510,1380],[400,1550],[580,1150],[260,1460]
        ].forEach(function(pp){spawnMonster(pt,pp[0],pp[1],scene);});
  var mq=MONSTER_DEFS.find(function(x){return x.id==='jungle_mosquito';});
  if(mq)[[280,1000],[390,1220],[470,1420],[560,1050],[310,1650],[530,1350]
        ].forEach(function(pp){spawnMonster(mq,pp[0],pp[1],scene);});
  var tr=MONSTER_DEFS.find(function(x){return x.id==='jungle_treant';});
  if(tr)[[350,1150],[480,1400],[420,1600]
        ].forEach(function(pp){spawnMonster(tr,pp[0],pp[1],scene);});
  /* ★ 엘리트: 정글의 왕 */
  var ea=MONSTER_DEFS.find(function(x){return x.id==='elite_ape';});
  if(ea)spawnMonster(ea,420,1400,scene);
}

function buildVolcano(){
  /* 화산: x:-300~300, z:1680~2600 (3x 확장) */
  /* 지면 균열 */
  var crackLineM=new THREE.MeshBasicMaterial({color:0xff2200,transparent:true,opacity:.4});
  for(var ci=0;ci<30;ci++){
    var cx2=(Math.random()-.5)*540,cz2=1690+Math.random()*900;
    var cLen=2+Math.random()*10;
    var crack=new THREE.Mesh(new THREE.PlaneGeometry(.15,cLen),crackLineM);
    crack.rotation.x=-Math.PI/2;crack.rotation.z=Math.random()*Math.PI;
    crack.position.set(cx2,.018,cz2);scene.add(crack);
  }
  /* 열 발광 */
  var heatGlowM=new THREE.MeshBasicMaterial({color:0xff1100,transparent:true,opacity:.06});
  for(var hg=0;hg<15;hg++){
    var hgp=new THREE.Mesh(new THREE.PlaneGeometry(16+Math.random()*14,12+Math.random()*10),heatGlowM);
    hgp.rotation.x=-Math.PI/2;hgp.position.set((Math.random()-.5)*480,.02,1700+hg*60);scene.add(hgp);
  }
  /* 조명 */
  var pl4=new THREE.PointLight(0xff2200,.8,500);pl4.position.set(0,3,2100);scene.add(pl4);
  var pl4b=new THREE.PointLight(0xff2200,.6,400);pl4b.position.set(0,3,1850);scene.add(pl4b);
  /* 용암 강 */
  var lavaRiverM=new THREE.MeshLambertMaterial({color:0xff4400,emissive:new THREE.Color(0xff2200),emissiveIntensity:.7,transparent:true,opacity:.9});
  var river1=new THREE.Mesh(new THREE.PlaneGeometry(4,200),lavaRiverM);
  river1.rotation.x=-Math.PI/2;river1.position.set(-65,.06,710);scene.add(river1);
  var rl1=new THREE.PointLight(0xff3300,.8,20);rl1.position.set(-65,.5,710);scene.add(rl1);
  var river2=new THREE.Mesh(new THREE.PlaneGeometry(3.5,180),lavaRiverM);
  river2.rotation.x=-Math.PI/2;river2.position.set(68,.06,730);scene.add(river2);
  var rl2=new THREE.PointLight(0xff3300,.6,18);rl2.position.set(68,.5,730);scene.add(rl2);
  /* 용암 웅덩이 */
  var lavaM2=new THREE.MeshLambertMaterial({color:0xff3300,emissive:new THREE.Color(0xff1100),emissiveIntensity:.7,transparent:true,opacity:.9});
  var volcM=new THREE.MeshLambertMaterial({color:0x1a0800});
  /* 용암 웅덩이 (3x) */
  [[-120,1750,8,6],[0,1900,12,8],[100,2050,8,6],
   [-80,2150,10,7],[90,2250,8,6],[40,2380,12,8],
   [-150,2000,6,5],[150,1850,6,5],[0,2500,10,7]
  ].forEach(function(pp){
    var lava=new THREE.Mesh(new THREE.PlaneGeometry(pp[2]*2,pp[3]*2),lavaM2);
    lava.rotation.x=-Math.PI/2;lava.position.set(pp[0],.05,pp[1]);scene.add(lava);
    var ll=new THREE.PointLight(0xff2200,.8,pp[2]*3);ll.position.set(pp[0],.5,pp[1]);scene.add(ll);
  });
  /* 연기 */
  var smokeM=new THREE.MeshLambertMaterial({color:0x1a0a00,transparent:true,opacity:.25});
  for(var si=0;si<20;si++){
    var sx=(Math.random()-.5)*480,sz=1700+Math.random()*880;
    var sy=3+Math.random()*6;
    var sr=.6+Math.random()*1.0;
    var smokeS=new THREE.Mesh(new THREE.SphereGeometry(sr,6,6),smokeM);
    smokeS.position.set(sx,sy,sz);scene.add(smokeS);
  }
  /* 화산 바위 */
  var crackVM=new THREE.MeshLambertMaterial({color:0xff3300,emissive:new THREE.Color(0xff1100),emissiveIntensity:.6});
  [[-90,1800,2],[55,1950,2.5],[-75,2100,2.2],[100,2250,2.0],
   [-130,2050,1.8],[140,1850,2.2],[-40,2300,2.5],[60,2450,2.0]
  ].forEach(function(pp){
    var rx=pp[0],rz=pp[1],rs=pp[2];
    var vr=new THREE.Mesh(new THREE.DodecahedronGeometry(rs,0),volcM);
    vr.position.set(rx,rs*.5,rz);vr.rotation.y=Math.random()*Math.PI;scene.add(vr);
    var cr=new THREE.Mesh(new THREE.BoxGeometry(.1,rs*.8,.1),crackVM);cr.position.set(rx,rs*.5,rz);scene.add(cr);
  });
  /* 화산 굴뚝 */
  [[-200,1750],[200,1900],[-150,2050],[150,2200],[-220,2350],[220,2500],[0,2050],[-80,2400],[80,1800]
  ].forEach(function(pp){
    var cx=pp[0],cz=pp[1];
    var chimney=new THREE.Mesh(new THREE.CylinderGeometry(1.2,1.8,6,8),volcM);chimney.position.set(cx,3,cz);scene.add(chimney);
    var smoke2=new THREE.Mesh(new THREE.CylinderGeometry(.7,.25,2.5,6),new THREE.MeshLambertMaterial({color:0x220800,emissive:new THREE.Color(0xff2200),emissiveIntensity:.5}));
    smoke2.position.set(cx,7.5,cz);scene.add(smoke2);
    var cl=new THREE.PointLight(0xff2200,1.2,20);cl.position.set(cx,6,cz);scene.add(cl);
  });
  /* 보스 제단 — z:2400 (끝부분) */
  var altarM=new THREE.MeshLambertMaterial({color:0x110800});
  var altar=new THREE.Mesh(new THREE.CylinderGeometry(4,5,1,8),altarM);altar.position.set(0,.5,2400);scene.add(altar);
  var altarL=new THREE.PointLight(0xff4400,2.5,40);altarL.position.set(0,2,2400);scene.add(altarL);
  var flamePillarM=new THREE.MeshBasicMaterial({color:0xff6600,transparent:true,opacity:.4});
  [-4,4].forEach(function(fpx){
    var fp=new THREE.Mesh(new THREE.CylinderGeometry(.2,.3,4,6),flamePillarM);
    fp.position.set(fpx,2,2400);scene.add(fp);
    var fpl=new THREE.PointLight(0xff4400,.8,10);fpl.position.set(fpx,3,2400);scene.add(fpl);
  });
  /* 몬스터 스폰 — 3x 확장 좌표 (z:1680~2600) */
  var gld=MONSTER_DEFS.find(function(x){return x.id==='golem';});
  var fdd=MONSTER_DEFS.find(function(x){return x.id==='firedrake';});
  if(gld)[
    [-120,1750],[80,1900],[-60,2050],[100,2200],
    [-150,2350],[50,2480],[0,1800],[-80,2100],[120,2300]
  ].forEach(function(pp){spawnMonster(gld,pp[0],pp[1],scene);});
  if(fdd)[
    [130,1820],[-100,1980],[80,2130],[-130,2280],
    [100,2430],[0,2100],[-60,1750],[140,2350]
  ].forEach(function(pp){spawnMonster(fdd,pp[0],pp[1],scene);});
  /* ★ 엘리트: 고대 화염룡 */
  var ed=MONSTER_DEFS.find(function(x){return x.id==='elite_dragon';});
  if(ed)spawnMonster(ed,0,2400,scene);
}

/* ════════════ 전체 오픈 월드 빌드 ════════════ */
function buildOpenWorld(){
  monsters=[];closestMonster=null;
  buildMeadow();
  buildSwamp();
  buildDarkForest();
  buildJungle();
  buildVolcano();
}

/* ════════════ 몬스터 애니메이션 ════════════ */
function updateMonsterAnims(dt){
  monsters.forEach(function(m){
    m.animTime+=dt;
    var id=m.def.id;

    /* ── 1. 스폰 애니메이션 ── */
    if(m.spawnAnim>0){
      m.spawnAnim=Math.max(0,m.spawnAnim-dt);
      var t=1-m.spawnAnim/0.6; /* 0→1 */
      /* 바운스 이즈: overshoot */
      var s;
      if(t<0.6){s=t/0.6*1.15;}
      else if(t<0.8){s=1.15-(t-0.6)/0.2*0.2;}
      else{s=0.95+(t-0.8)/0.2*0.05;}
      if(m.state!=='dead'){m.mesh.scale.set(s,s,s);}
      return; /* 스폰 중에는 다른 애니 스킵 */
    }

    /* ── 2. 사망 애니메이션 ── */
    if(m.deathAnim>=0){
      m.deathAnim=Math.max(0,m.deathAnim-dt);
      var dp=1-m.deathAnim/0.8; /* 0→1 */
      var sc=Math.max(0,1-dp*dp);
      m.mesh.scale.set(sc,sc,sc);
      m.mesh.rotation.y+=dt*8*(1-dp);
      m.mesh.position.y=m.baseY+dp*0.5;
      /* 페이드 아웃 */
      m.mesh.traverse(function(c){
        if(c.isMesh&&c.material){
          if(!c.material.transparent){c.material=c.material.clone();c.material.transparent=true;}
          c.material.opacity=Math.max(0,1-dp*1.4);
        }
      });
      if(m.deathAnim<=0){
        m.mesh.visible=false;
        m.wrap.style.display='none';
      }
      return;
    }

    if(m.state==='dead')return;

    /* ── 3. 피격(빨간 플래시 + 흔들림) 애니메이션 ── */
    if(m.hitFlash>0){
      m.hitFlash=Math.max(0,m.hitFlash-dt);
      var hprog=m.hitFlash/0.35;
      var shakeAmt=Math.sin(m.animTime*60)*0.08*hprog;
      m.mesh.position.x+=shakeAmt;
      /* 스케일 펄스 */
      var hsc=1+Math.sin(hprog*Math.PI)*0.15;
      if(m.spawnAnim<=0)m.mesh.scale.set(hsc,hsc,hsc);
      if(m.hitFlash<=0){
        /* 빨간 플래시 재료 복원 */
        if(m._origMats){
          m._origMats.forEach(function(o){o.mesh.material=o.orig;});
          m._origMats=null;
        }
        if(m.spawnAnim<=0)m.mesh.scale.set(1,1,1);
      }
    }

    /* ── 4. 공격 애니메이션 ── */
    if(m.isAttacking){
      m.attackAnimT=Math.max(0,m.attackAnimT-dt);
      var ap=m.attackAnimT/0.4; /* 1→0 */
      /* 앞으로 돌진 */
      var lungeAmt=Math.sin(ap*Math.PI)*0.35;
      var fd=new THREE.Vector3(Math.sin(m.mesh.rotation.y),0,Math.cos(m.mesh.rotation.y));
      m.mesh.position.x+=fd.x*lungeAmt*dt*12;
      m.mesh.position.z+=fd.z*lungeAmt*dt*12;
      /* 스쿼시-앤-스트레치 */
      if(m.spawnAnim<=0&&m.hitFlash<=0){
        var sqx=1+Math.sin(ap*Math.PI)*0.12;
        var sqy=1-Math.sin(ap*Math.PI)*0.18;
        m.mesh.scale.set(sqx,sqy,sqx);
      }
      if(m.attackAnimT<=0){
        m.isAttacking=false;
        if(m.spawnAnim<=0&&m.hitFlash<=0)m.mesh.scale.set(1,1,1);
      }
      return; /* 공격 중에는 idle 아닌 리턴 */
    }

    /* ── 5. Idle 애니메이션 (숨쉬기 + 살짝 흔들림) ── */
    if(m.state==='idle'){
      var idleFreq=(id==='slime'||id==='toad')?1.2:0.9;
      var idleAmp=(id==='slime'||id==='toad')?0.04:0.025;
      var swaFreq=(id==='slime'||id==='toad')?0.6:0.45;
      var swaAmp=(id==='golem')?0.008:0.015;
      m.mesh.position.y=m.baseY+Math.sin(m.animTime*idleFreq*2+m.bobOff)*idleAmp;
      m.mesh.rotation.z=Math.sin(m.animTime*swaFreq+m.bobOff)*swaAmp;
      /* 슬라임: 스케일 박동 */
      if(id==='slime'||id==='toad'){
        var pulse=1+Math.sin(m.animTime*2.5+m.bobOff)*0.04;
        m.mesh.scale.set(pulse,1/pulse,pulse);
      } else if(id!=='golem'){
        /* 숨쉬기 스케일 */
        var breath=1+Math.sin(m.animTime*1.4+m.bobOff)*0.02;
        if(!m.def.elite)m.mesh.scale.set(breath,breath,breath);
      }
    }
    /* 엘리트 파티클 회전 + 오라 펄스 */
    if(m.def.elite){
      var es=1.8+Math.sin(m.animTime*1.5)*.06;
      m.mesh.scale.set(es,es,es);
      m.mesh.traverse(function(c){
        if(c._eliteOrbit!==undefined){
          c._eliteOrbit+=dt*1.5;
          c.position.x=Math.cos(c._eliteOrbit)*.9;
          c.position.z=Math.sin(c._eliteOrbit)*.9;
          c.position.y=1.2+Math.sin(c._eliteOrbit*2+m.animTime)*.4;
        }
        if(c.material&&c.material.opacity&&c.geometry&&c.geometry.type==='RingGeometry'){
          c.material.opacity=.2+Math.sin(m.animTime*2)*.15;
          c.rotation.z+=dt*.5;
        }
      });
    }

    /* ── 6. 이동(추적) 애니메이션 ── */
    if(m.state==='aggro'){
      /* 슬라임/두꺼비: 통통 튀기 */
      if(id==='slime'||id==='toad'){
        var bFreq=6.5,bAmp=0.12;
        var by=Math.max(0,Math.sin(m.animTime*bFreq+m.bobOff))*bAmp;
        m.mesh.position.y=m.baseY+by;
        var sqBounce=1-by*0.5;
        m.mesh.scale.set(1+by*0.3,sqBounce,1+by*0.3);
      } else {
        /* 기타 몬스터: 위아래 바운스 */
        var wFreq=(id==='golem')?3.5:5.5;
        var wAmp=(id==='golem')?0.06:0.08;
        m.mesh.position.y=m.baseY+Math.abs(Math.sin(m.animTime*wFreq+m.bobOff))*wAmp;
        /* 이동 방향으로 몸통 기울기 */
        var leanAmt=(id==='golem')?0.05:0.1;
        m.mesh.rotation.x=Math.sin(m.animTime*wFreq+m.bobOff)*leanAmt;
        /* 불 드레이크/파이어드레이크: 날개 퍼덕임 */
        if(id==='firedrake'){
          m.mesh.rotation.z=Math.sin(m.animTime*8+m.bobOff)*0.08;
        }
      }
    }
  });
}

function updMonsters(dt,t){
  var px=PL.group.position.x,pz=PL.group.position.z;
  attackCooldown=Math.max(0,attackCooldown-dt);
  invincibleTimer=Math.max(0,invincibleTimer-dt);
  closestMonster=null;var md=20.0;

  /* 호스트: 모든 플레이어 위치 갱신 (몬스터가 모든 플레이어 추적) */
  var isHost=(typeof isMonsterHost!=='undefined'&&isMonsterHost);
  if(isHost&&typeof updateAllPlayerPositions==='function')updateAllPlayerPositions();

  monsters.forEach(function(m,mIdx){
    if(m.state==='dead')return;
    var mx=m.mesh.position.x,mz=m.mesh.position.z;
    var distToLocal=Math.sqrt((px-mx)*(px-mx)+(pz-mz)*(pz-mz));

    /* 호스트: 모든 플레이어 중 가장 가까운 대상 찾기 */
    var chasePx=px,chasePz=pz,chaseDist=distToLocal,chaseLocal=true,chaseId='';
    if(isHost&&typeof findClosestPlayer==='function'){
      var cp=findClosestPlayer(mx,mz);
      if(cp){chasePx=cp.x;chasePz=cp.z;chaseDist=cp.dist;chaseLocal=cp.local;chaseId=cp.id;}
    }

    /* 먼 몬스터 — 호스트는 가장 가까운 플레이어 기준, 비호스트는 로컬 기준 */
    var visDist=isHost?chaseDist:distToLocal;
    if(visDist>100&&distToLocal>100){
      m.wrap.style.display='none';
      m.mesh.visible=false;
      if(m.state==='aggro'){m.state='idle';m.mesh.position.set(m.spawnX,0,m.spawnZ);m._chaseTargetId='';}
      return;
    }
    m.mesh.visible=true;
    /* 이름+HP바: 일반 20유닛, 엘리트 50유닛 */
    var showDist=m.def.elite?50:20;
    if(distToLocal<showDist){
      posEl(m.wrap,mx,m.mesh.position.y+(m.def.elite?3.5:2.1),mz);
      m.wrap.style.display='';
      m.hbf.style.width=Math.max(0,m.hp/m.maxHp*100)+'%';
    } else {
      m.wrap.style.display='none';
    }
    if(distToLocal<md){md=distToLocal;closestMonster=m;}
    var mid=m.def.id;
    var isNH=(typeof isMonsterHost!=='undefined'&&!isMonsterHost&&m._targetX!==undefined);

    /* ── 비호스트: 호스트 위치로 보간 ── */
    if(isNH){
      var tx=m._targetX,tz=m._targetZ;
      var lerpF=0.15;
      m.mesh.position.x=mx+(tx-mx)*lerpF;
      m.mesh.position.z=mz+(tz-mz)*lerpF;
      var ddx=tx-mx,ddz=tz-mz;
      if(ddx*ddx+ddz*ddz>0.001){
        var tRy=Math.atan2(ddx,ddz);
        var dR=tRy-m.mesh.rotation.y;
        while(dR>Math.PI)dR-=Math.PI*2;
        while(dR<-Math.PI)dR+=Math.PI*2;
        m.mesh.rotation.y+=dR*Math.min(1,10*dt);
      }
      /* 비호스트: 동기화된 상태 반영 */
      if(m._syncState)m.state=m._syncState;
      /* 비호스트: 몬스터가 나를 타겟하고 있으면 어그로 알림 */
      var myUid3=(typeof currentUser!=='undefined'&&currentUser&&currentUser.id)?currentUser.id:myName;
      if(m._targetPlayerId===myUid3&&m.state==='aggro'&&!m._aggroNotified){
        addChat('inf','',m.def.name+'이(가) 달려온다!');
        m._aggroNotified=true;
      }
      if(m.state!=='aggro')m._aggroNotified=false;
      /* 데미지는 호스트의 mdmg 메시지로 처리 — 비호스트는 로컬 AI 안 돌림 */
      return;
    }

    /* ── 호스트 (또는 솔로): 몬스터 AI ── */
    /* 어그로 감지 — 가장 가까운 플레이어 기준 */
    if(m.state==='idle'&&chaseDist<m.def.aggro){
      m.state='aggro';
      m._chaseTargetId=chaseId;
      if(chaseLocal)addChat('inf','',m.def.name+'이(가) 달려온다!');
    }
    if(m.state==='aggro'){
        /* 추적 대상 갱신 — 더 가까운 플레이어가 있으면 스위치 */
        m._chaseTargetId=chaseId;
        var spd=m.def.spd;
        /* 사슴: 돌진 — 거리 4~8일 때 속도 3배 */
        if(mid==='deer'&&chaseDist>4&&chaseDist<15)spd=m.def.spd*3;
        /* 몬스터별 공격 범위 + 공격 속도 (모듈 상단 상수 참조) */
        var atkRange=_ATK_RANGES[mid]||1.8;
        var atkCooldown=_ATK_SPEEDS[mid]||(0.8+Math.random()*.4);
        /* 이동 — 가장 가까운 플레이어 쪽으로 */
        if(chaseDist>1.2){
          var dx=chasePx-mx,dz2=chasePz-mz,len=Math.sqrt(dx*dx+dz2*dz2);
          m.mesh.position.x+=dx/len*spd*dt;
          m.mesh.position.z+=dz2/len*spd*dt;
          m.mesh.rotation.y=Math.atan2(dx,dz2);
        }
        m.attackTimer-=dt;
        if(chaseDist<atkRange&&m.attackTimer<=0){
          m.attackTimer=atkCooldown;
          m.isAttacking=true;m.attackAnimT=0.4;
          var dmg=Math.max(1,m.def.atk+Math.floor(Math.random()*4)-2);
          /* 고블린: 데미지 1.5배 */
          if(mid==='goblin')dmg=Math.floor(dmg*1.5);
          /* 특수 효과 수집 */
          var effects=[];
          if((mid==='toad'||mid==='jungle_snake'))effects.push({type:'poison',val:Math.floor(dmg*0.3)});
          if(mid==='slime')effects.push({type:'slow',val:2});
          if(mid==='golem')effects.push({type:'lava',val:0});
          if(mid==='jungle_panther'){effects.push({type:'combo',val:0});m.attackTimer=0.3;}
          if(mid==='jungle_mosquito'){
            var heal=Math.floor(dmg*0.5);
            m.hp=Math.min(m.def.hp,m.hp+heal);
            effects.push({type:'drain',val:heal});
          }
          if(mid==='jungle_treant')effects.push({type:'root',val:3});
          if(mid==='firedrake')effects.push({type:'breath',val:0});

          if(chaseLocal){
            /* 로컬 플레이어가 타겟 → 직접 데미지 */
            if(invincibleTimer<=0){
              playerHP=Math.max(0,playerHP-dmg);
              updPlayerHpBar();spawnDmgNum('-'+dmg,'#ff5555');
              flashPlayerHit();
              if((mid==='toad'||mid==='jungle_snake')&&!playerPoisoned){
                playerPoisoned=3;playerPoisonDmg=Math.floor(dmg*0.3);
                spawnDmgNum('독!','#44ff44');addChat('inf','','독에 걸렸다!');
              }
              if(mid==='slime'){playerSlowed=2;spawnDmgNum('둔화!','#22aa22');}
              if(mid==='golem'){spawnLavaPool(mx,mz,6,4);spawnDmgNum('용암 강타!','#ff4400');}
              if(mid==='jungle_panther')spawnDmgNum('연속!','#ffaa00');
              if(mid==='jungle_mosquito')spawnDmgNum('흡혈!','#ff00aa');
              if(mid==='jungle_treant'){playerSlowed=3;spawnDmgNum('속박!','#228833');addChat('inf','','뿌리에 발이 묶였다!');}
              if(mid==='firedrake'){
                var bdx=chasePx-mx,bdz=chasePz-mz,blen=Math.sqrt(bdx*bdx+bdz*bdz);
                if(blen>0.1){bdx/=blen;bdz/=blen;}
                spawnFireBreath(mx,mz,bdx,bdz,15);
                spawnDmgNum('화염 브레스!','#ff6600');
              }
              if(playerHP<=0)playerDied();
              else if(typeof checkBerserkerSpawn==='function')checkBerserkerSpawn();
            }
          }else{
            /* 원격 플레이어가 타겟 → WebSocket으로 데미지 전송 */
            if(typeof sendMonsterDamage==='function')sendMonsterDamage(chaseId,mIdx,dmg,effects);
          }
        }
        var leash=getLeashRange(mid);
        var spDist=Math.sqrt((mx-m.spawnX)*(mx-m.spawnX)+(mz-m.spawnZ)*(mz-m.spawnZ));
        if(spDist>leash){
          m.state='returning';m.hp=m.maxHp;m.hbf.style.width='100%';m._chaseTargetId='';
        }
      }
      if(m.state==='returning'){
        m._chaseTargetId='';
        var rdx=m.spawnX-mx,rdz=m.spawnZ-mz;
        var rlen=Math.sqrt(rdx*rdx+rdz*rdz);
        if(rlen<1){
          m.state='idle';
          m.mesh.position.set(m.spawnX,0,m.spawnZ);
        }else{
          m.mesh.position.x+=rdx/rlen*m.def.spd*dt;
          m.mesh.position.z+=rdz/rlen*m.def.spd*dt;
          m.mesh.rotation.y=Math.atan2(rdx,rdz);
        }
      }
  });
  var fh=document.getElementById('f-hint');
  if(fh)fh.style.display=(md<7&&currentZone!=='village')?'block':'none';
}
