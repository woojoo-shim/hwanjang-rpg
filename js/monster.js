/*
 * monster.js — 몬스터 메쉬 생성, 스폰, 사냥 구역 빌드, AI/업데이트 루프
 *
 * 의존성 (런타임 전역 참조):
 *   config.js   → MONSTER_DEFS
 *   ui.js       → addChat, posEl
 *   player.js   → PL, playerHP, invincibleTimer, attackCooldown,
 *                  updPlayerHpBar, spawnDmgNum, playerDied
 *   world.js    → scene, mkTree
 *
 * 이 파일이 선언하는 전역:
 *   monsters, closestMonster, currentZone
 */

var monsters=[];
var closestMonster=null;
var currentZone='village';

function mkMonsterMesh(def){
  var g=new THREE.Group();
  var bm=new THREE.MeshLambertMaterial({color:def.color});
  var hm=new THREE.MeshLambertMaterial({color:def.hc});

  if(def.id==='rabbit'){
    // 토끼 — 둥글둥글한 몸통, 긴 귀, 짧은 다리
    var bodyM=new THREE.MeshLambertMaterial({color:0xeeeeee});
    var bellyM=new THREE.MeshLambertMaterial({color:0xffdddd});
    var eyeM=new THREE.MeshBasicMaterial({color:0xff3366});
    // 몸통 (타원형)
    var body=new THREE.Mesh(new THREE.SphereGeometry(.38,8,8),bodyM);
    body.scale.set(1,.85,1.1);body.position.set(0,.42,0);g.add(body);
    // 배
    var belly=new THREE.Mesh(new THREE.SphereGeometry(.22,8,8),bellyM);
    belly.scale.set(1,.7,1);belly.position.set(0,.38,.22);g.add(belly);
    // 머리
    var head=new THREE.Mesh(new THREE.SphereGeometry(.26,8,8),bodyM);
    head.position.set(0,.82,.12);g.add(head);
    // 코
    var nose=new THREE.Mesh(new THREE.SphereGeometry(.05,6,6),bellyM);
    nose.position.set(0,.82,.36);g.add(nose);
    // 눈
    [-0.1,0.1].forEach(function(ex){
      var eye=new THREE.Mesh(new THREE.SphereGeometry(.05,6,6),eyeM);
      eye.position.set(ex,.9,.32);g.add(eye);
    });
    // 귀 (길고 위로 솟음)
    var earM=new THREE.MeshLambertMaterial({color:0xeeeeee});
    var earInM=new THREE.MeshLambertMaterial({color:0xffaaaa});
    [-0.1,0.1].forEach(function(ex){
      var earOut=new THREE.Mesh(new THREE.BoxGeometry(.1,.5,.06),earM);
      earOut.position.set(ex,1.28,.06);g.add(earOut);
      var earIn=new THREE.Mesh(new THREE.BoxGeometry(.06,.36,.04),earInM);
      earIn.position.set(ex,1.28,.07);g.add(earIn);
    });
    // 앞발
    var fpM=new THREE.MeshLambertMaterial({color:0xdddddd});
    [-0.18,0.18].forEach(function(ex){
      var fp=new THREE.Mesh(new THREE.BoxGeometry(.1,.2,.1),fpM);
      fp.position.set(ex,.18,.28);g.add(fp);
    });
    // 뒷다리
    [-0.16,0.16].forEach(function(ex){
      var leg=new THREE.Mesh(new THREE.BoxGeometry(.13,.22,.13),fpM);
      leg.position.set(ex,.11,-.1);g.add(leg);
    });
    // 꼬리
    var tail=new THREE.Mesh(new THREE.SphereGeometry(.1,6,6),bodyM);
    tail.position.set(0,.4,-.38);g.add(tail);

  } else if(def.id==='deer'){
    // 사슴 — 4발 짐승, 긴 다리, 뿔
    var bodyM=new THREE.MeshLambertMaterial({color:0x8a5a20});
    var bellyM=new THREE.MeshLambertMaterial({color:0xccaa66});
    var legM=new THREE.MeshLambertMaterial({color:0x6a3a10});
    var antlerM=new THREE.MeshLambertMaterial({color:0x7a5520});
    var eyeM=new THREE.MeshBasicMaterial({color:0x111111});
    // 몸통
    var body=new THREE.Mesh(new THREE.BoxGeometry(.6,.52,.9),bodyM);
    body.position.set(0,.85,0);g.add(body);
    // 배
    var belly=new THREE.Mesh(new THREE.BoxGeometry(.4,.3,.7),bellyM);
    belly.position.set(0,.72,.05);g.add(belly);
    // 목
    var neck=new THREE.Mesh(new THREE.BoxGeometry(.22,.4,.22),bodyM);
    neck.position.set(0,1.18,.3);neck.rotation.x=-.35;g.add(neck);
    // 머리
    var head=new THREE.Mesh(new THREE.BoxGeometry(.32,.3,.38),bodyM);
    head.position.set(0,1.42,.52);g.add(head);
    // 코/주둥이
    var snout=new THREE.Mesh(new THREE.BoxGeometry(.2,.2,.24),bellyM);
    snout.position.set(0,1.36,.7);g.add(snout);
    // 눈
    [-0.12,0.12].forEach(function(ex){
      var eye=new THREE.Mesh(new THREE.SphereGeometry(.045,6,6),eyeM);
      eye.position.set(ex,1.5,.62);g.add(eye);
    });
    // 귀
    [-0.22,0.22].forEach(function(ex){
      var ear=new THREE.Mesh(new THREE.BoxGeometry(.08,.16,.05),bellyM);
      ear.position.set(ex,1.6,.44);g.add(ear);
    });
    // 다리 4개
    [[-0.2,.35],[-0.2,-.35],[.2,.35],[.2,-.35]].forEach(function(p){
      var lx=p[0],lz=p[1];
      var leg=new THREE.Mesh(new THREE.BoxGeometry(.14,.55,.14),legM);
      leg.position.set(lx,.28,lz);g.add(leg);
      var hoof=new THREE.Mesh(new THREE.BoxGeometry(.16,.12,.16),new THREE.MeshLambertMaterial({color:0x220800}));
      hoof.position.set(lx,.02,lz);g.add(hoof);
    });
    // 뿔 (수사슴)
    [-0.14,0.14].forEach(function(ex){
      var base=new THREE.Mesh(new THREE.CylinderGeometry(.03,.05,.4,5),antlerM);
      base.position.set(ex,1.75,.35);base.rotation.z=ex>0?.15:-.15;g.add(base);
      var branch=new THREE.Mesh(new THREE.CylinderGeometry(.02,.03,.3,5),antlerM);
      branch.position.set(ex+(ex>0?.15:-.15),1.95,.25);branch.rotation.z=ex>0?.6:-.6;g.add(branch);
      var tip=new THREE.Mesh(new THREE.CylinderGeometry(.01,.02,.22,5),antlerM);
      tip.position.set(ex,2.04,.28);g.add(tip);
    });
    // 꼬리
    var tail=new THREE.Mesh(new THREE.SphereGeometry(.09,6,6),bellyM);
    tail.position.set(0,.95,-.48);g.add(tail);

  } else if(def.id==='slime'){
    // 슬라임 — 방울 모양, 반투명 느낌
    var sliM=new THREE.MeshLambertMaterial({color:0x33cc44,emissive:new THREE.Color(0x116622),emissiveIntensity:.25});
    var eyeM=new THREE.MeshBasicMaterial({color:0x002200});
    var hiM=new THREE.MeshLambertMaterial({color:0x88ffaa,emissive:new THREE.Color(0x44ff88),emissiveIntensity:.3});
    // 메인 몸통
    var body=new THREE.Mesh(new THREE.SphereGeometry(.48,10,8),sliM);
    body.scale.set(1,.72,1);body.position.set(0,.38,0);g.add(body);
    // 하이라이트 (윗면)
    var hi=new THREE.Mesh(new THREE.SphereGeometry(.18,8,8),hiM);
    hi.position.set(.06,.62,.1);g.add(hi);
    // 눈 2개
    [-0.16,0.16].forEach(function(ex){
      var white=new THREE.Mesh(new THREE.SphereGeometry(.1,8,8),new THREE.MeshLambertMaterial({color:0xffffff}));
      white.position.set(ex,.44,.38);g.add(white);
      var pupil=new THREE.Mesh(new THREE.SphereGeometry(.055,6,6),eyeM);
      pupil.position.set(ex,.44,.46);g.add(pupil);
    });
    // 입 (작은 박스들)
    var mouthM=new THREE.MeshBasicMaterial({color:0x002200});
    [-0.08,0,0.08].forEach(function(mx){
      var mt=new THREE.Mesh(new THREE.BoxGeometry(.05,.04,.04),mouthM);
      mt.position.set(mx,.32,.46);g.add(mt);
    });
    // 바닥 파문
    var ripple=new THREE.Mesh(new THREE.CylinderGeometry(.52,.56,.04,12),sliM);
    ripple.position.set(0,.04,0);g.add(ripple);

  } else if(def.id==='goblin'){
    // 고블린 — 초록 피부, 작고 못생긴 인간형, 귀가 뾰족
    var skinM=new THREE.MeshLambertMaterial({color:0x336611});
    var darkM=new THREE.MeshLambertMaterial({color:0x224408});
    var eyeM=new THREE.MeshBasicMaterial({color:0xffff00});
    var pupilM=new THREE.MeshBasicMaterial({color:0x000000});
    var clothM=new THREE.MeshLambertMaterial({color:0x3a2a10});
    var weaponM=new THREE.MeshLambertMaterial({color:0x888866});
    // 몸통 (작고 통통)
    var body=new THREE.Mesh(new THREE.BoxGeometry(.5,.7,.32),clothM);
    body.position.set(0,.68,0);g.add(body);
    // 머리 (크고 못생긴)
    var head=new THREE.Mesh(new THREE.BoxGeometry(.48,.44,.44),skinM);
    head.position.set(0,1.26,0);g.add(head);
    // 코 (크고 못생긴)
    var nose=new THREE.Mesh(new THREE.SphereGeometry(.1,6,6),darkM);
    nose.scale.set(1.2,.8,1.4);nose.position.set(0,1.24,.24);g.add(nose);
    // 눈 (노란 눈)
    [-0.13,0.13].forEach(function(ex){
      var eye=new THREE.Mesh(new THREE.SphereGeometry(.08,6,6),eyeM);
      eye.position.set(ex,1.34,.22);g.add(eye);
      var pupil=new THREE.Mesh(new THREE.SphereGeometry(.04,5,5),pupilM);
      pupil.position.set(ex,1.34,.28);g.add(pupil);
    });
    // 뾰족한 귀
    [-0.28,0.28].forEach(function(ex){
      var ear=new THREE.Mesh(new THREE.ConeGeometry(.08,.22,5),skinM);
      ear.position.set(ex,1.38,0);ear.rotation.z=ex>0?.5:-.5;g.add(ear);
    });
    // 이빨 (삐죽)
    [-0.06,0.06].forEach(function(tx){
      var tooth=new THREE.Mesh(new THREE.BoxGeometry(.06,.1,.05),new THREE.MeshLambertMaterial({color:0xeeddaa}));
      tooth.position.set(tx,1.12,.24);g.add(tooth);
    });
    // 팔
    var armG=new THREE.BoxGeometry(.16,.5,.16);
    [-0.36,0.36].forEach(function(ax){
      var arm=new THREE.Mesh(armG,skinM);arm.position.set(ax,.72,0);g.add(arm);
    });
    // 다리 (짧음)
    [-0.14,0.14].forEach(function(lx){
      var leg=new THREE.Mesh(new THREE.BoxGeometry(.18,.42,.18),darkM);
      leg.position.set(lx,.21,0);g.add(leg);
    });
    // 무기 (삐뚤빼뚤한 단검)
    var blade=new THREE.Mesh(new THREE.BoxGeometry(.06,.5,.04),weaponM);
    blade.position.set(.52,.72,.0);blade.rotation.z=.3;g.add(blade);
    var hilt=new THREE.Mesh(new THREE.BoxGeometry(.16,.06,.06),new THREE.MeshLambertMaterial({color:0x5a3010}));
    hilt.position.set(.44,.54,.0);g.add(hilt);

  } else if(def.id==='toad'){
    // 독두꺼비 — 납작하고 울퉁불퉁한 몸, 커다란 눈
    var bM=new THREE.MeshLambertMaterial({color:0x446622});
    var spotM=new THREE.MeshLambertMaterial({color:0x334418});
    var eyeM=new THREE.MeshLambertMaterial({color:0xaadd00,emissive:new THREE.Color(0x446600),emissiveIntensity:.3});
    var pupilM=new THREE.MeshBasicMaterial({color:0x000000});
    var body=new THREE.Mesh(new THREE.SphereGeometry(.55,10,8),bM);
    body.scale.set(1.2,.55,1.1);body.position.set(0,.38,0);g.add(body);
    // 혹 (등에)
    [[-.22,.55,-.08],[.18,.52,-.1],[0,.6,.05]].forEach(function(p){
      var wart=new THREE.Mesh(new THREE.SphereGeometry(.1,6,6),spotM);wart.position.set(p[0],p[1],p[2]);g.add(wart);
    });
    // 머리
    var head=new THREE.Mesh(new THREE.SphereGeometry(.38,10,8),bM);
    head.scale.set(1.1,.7,1);head.position.set(0,.72,.18);g.add(head);
    // 큰 눈 (볼록 튀어나옴)
    [-0.2,0.2].forEach(function(ex){
      var eyeball=new THREE.Mesh(new THREE.SphereGeometry(.14,8,8),eyeM);
      eyeball.position.set(ex,.88,.32);g.add(eyeball);
      var pupil=new THREE.Mesh(new THREE.SphereGeometry(.07,6,6),pupilM);
      pupil.position.set(ex,.88,.44);g.add(pupil);
    });
    // 입 (넓은 가로)
    var mouthM=new THREE.MeshLambertMaterial({color:0x223310});
    var mouth=new THREE.Mesh(new THREE.BoxGeometry(.38,.06,.06),mouthM);
    mouth.position.set(0,.66,.4);g.add(mouth);
    // 뒷다리 (굵고 웅크림)
    [[-0.32,.15,-.22],[.32,.15,-.22]].forEach(function(p){
      var lx=p[0],ly=p[1],lz=p[2];
      var upper=new THREE.Mesh(new THREE.BoxGeometry(.18,.18,.38),bM);upper.position.set(lx,ly,lz);g.add(upper);
      var lower=new THREE.Mesh(new THREE.BoxGeometry(.14,.12,.28),bM);lower.position.set(lx*1.2,ly*.5,lz-.3);g.add(lower);
    });
    // 앞다리
    [[-0.38,.18,.22],[.38,.18,.22]].forEach(function(p){
      var lx=p[0],ly=p[1],lz=p[2];
      var leg=new THREE.Mesh(new THREE.BoxGeometry(.14,.14,.28),bM);leg.position.set(lx,ly,lz);g.add(leg);
    });
    // 독 방울 효과
    var toxM=new THREE.MeshLambertMaterial({color:0x88ff44,emissive:new THREE.Color(0x44aa00),emissiveIntensity:.4,transparent:true,opacity:.7});
    var tox=new THREE.Mesh(new THREE.SphereGeometry(.09,6,6),toxM);tox.position.set(.2,.65,.3);g.add(tox);

  } else if(def.id==='wolf'){
    // 늑대 — 4족 보행, 날카로운 주둥이, 귀, 꼬리
    var furM=new THREE.MeshLambertMaterial({color:0x555566});
    var darkM=new THREE.MeshLambertMaterial({color:0x333344});
    var bellyM=new THREE.MeshLambertMaterial({color:0x888899});
    var eyeM=new THREE.MeshLambertMaterial({color:0xffaa00,emissive:new THREE.Color(0xaa6600),emissiveIntensity:.5});
    var fangM=new THREE.MeshLambertMaterial({color:0xffffff});
    // 몸통
    var body=new THREE.Mesh(new THREE.BoxGeometry(.5,.5,.9),furM);body.position.set(0,.7,0);g.add(body);
    // 배
    var belly=new THREE.Mesh(new THREE.BoxGeometry(.3,.28,.65),bellyM);belly.position.set(0,.6,.05);g.add(belly);
    // 목 + 머리
    var neck=new THREE.Mesh(new THREE.BoxGeometry(.24,.32,.3),furM);neck.position.set(0,.98,.4);neck.rotation.x=-.2;g.add(neck);
    var head=new THREE.Mesh(new THREE.BoxGeometry(.36,.32,.3),furM);head.position.set(0,1.15,.62);g.add(head);
    // 주둥이 (뾰족)
    var snout=new THREE.Mesh(new THREE.BoxGeometry(.22,.2,.38),darkM);snout.position.set(0,1.06,.86);g.add(snout);
    // 눈 (발광)
    [-0.13,0.13].forEach(function(ex){
      var eye=new THREE.Mesh(new THREE.SphereGeometry(.06,6,6),eyeM);eye.position.set(ex,1.24,.72);g.add(eye);
    });
    // 귀 (뾰족)
    [-0.14,0.14].forEach(function(ex){
      var ear=new THREE.Mesh(new THREE.ConeGeometry(.08,.2,4),furM);
      ear.position.set(ex,1.4,.54);ear.rotation.z=ex>0?.2:-.2;g.add(ear);
    });
    // 이빨
    [-0.06,0.06].forEach(function(tx){
      var fang=new THREE.Mesh(new THREE.ConeGeometry(.03,.1,4),fangM);
      fang.position.set(tx,.98,.94);fang.rotation.x=Math.PI;g.add(fang);
    });
    // 다리 4개
    [[-0.18,.38],[-0.18,-.38],[.18,.38],[.18,-.38]].forEach(function(p){
      var lx=p[0],lz=p[1];
      var leg=new THREE.Mesh(new THREE.BoxGeometry(.14,.5,.14),furM);leg.position.set(lx,.25,lz);g.add(leg);
      var paw=new THREE.Mesh(new THREE.BoxGeometry(.18,.1,.22),darkM);paw.position.set(lx,.02,lz+.06);g.add(paw);
    });
    // 꼬리 (위로 치켜올림)
    var tail=new THREE.Mesh(new THREE.CylinderGeometry(.05,.08,.6,6),furM);
    tail.position.set(0,.92,-.52);tail.rotation.x=.8;g.add(tail);

  } else if(def.id==='golem'){
    // 용암 골렘 — 크고 울퉁불퉁한 돌, 용암이 흐름
    var rockM=new THREE.MeshLambertMaterial({color:0x443322});
    var lavaM=new THREE.MeshLambertMaterial({color:0xff4400,emissive:new THREE.Color(0xff2200),emissiveIntensity:.8});
    var crackM=new THREE.MeshLambertMaterial({color:0xff6600,emissive:new THREE.Color(0xff4400),emissiveIntensity:.6});
    // 몸통 (크고 육중)
    var body=new THREE.Mesh(new THREE.BoxGeometry(1.1,1.2,.8),rockM);body.position.set(0,.9,0);g.add(body);
    // 용암 균열 (몸통에)
    var crack1=new THREE.Mesh(new THREE.BoxGeometry(.08,1.0,.06),crackM);crack1.position.set(.2,.9,.41);g.add(crack1);
    var crack2=new THREE.Mesh(new THREE.BoxGeometry(.06,.7,.06),crackM);crack2.position.set(-.25,.7,.41);g.add(crack2);
    // 머리
    var head=new THREE.Mesh(new THREE.BoxGeometry(.8,.7,.7),rockM);head.position.set(0,1.85,0);g.add(head);
    // 눈 (용암)
    [-0.2,0.2].forEach(function(ex){
      var eye=new THREE.Mesh(new THREE.SphereGeometry(.13,8,8),lavaM);eye.position.set(ex,1.98,.36);g.add(eye);
    });
    // 어깨 혹
    [[-0.7,1.3],[ .7,1.3]].forEach(function(p){
      var sh=new THREE.Mesh(new THREE.SphereGeometry(.28,6,6),rockM);sh.position.set(p[0],p[1],0);g.add(sh);
    });
    // 팔 (굵고 땅 끌 것 같음)
    [[-0.75,.8,.1],[.75,.8,.1]].forEach(function(p){
      var ax=p[0],ay=p[1],az=p[2];
      var arm=new THREE.Mesh(new THREE.BoxGeometry(.36,.9,.3),rockM);arm.position.set(ax,ay,az);g.add(arm);
      var fist=new THREE.Mesh(new THREE.BoxGeometry(.42,.38,.38),rockM);fist.position.set(ax,.28,az);g.add(fist);
      var fc=new THREE.Mesh(new THREE.BoxGeometry(.06,.3,.06),crackM);fc.position.set(ax,.28,az+.2);g.add(fc);
    });
    // 다리 (짧고 굵음)
    [-0.28,.28].forEach(function(lx){
      var leg=new THREE.Mesh(new THREE.BoxGeometry(.36,.52,.36),rockM);leg.position.set(lx,.26,0);g.add(leg);
    });
    // 용암 발광
    var lavaLight=new THREE.PointLight(0xff4400,1.5,6);lavaLight.position.set(0,1,0);g.add(lavaLight);

  } else if(def.id==='firedrake'){
    // 파이어드레이크 — 작은 드래곤형, 날개, 꼬리, 뿔
    var scaleM=new THREE.MeshLambertMaterial({color:0xcc2200});
    var bellyM=new THREE.MeshLambertMaterial({color:0xff8844});
    var wingM=new THREE.MeshLambertMaterial({color:0x992200,emissive:new THREE.Color(0x440000),emissiveIntensity:.2,transparent:true,opacity:.85});
    var hornM=new THREE.MeshLambertMaterial({color:0x221100});
    var fireM=new THREE.MeshLambertMaterial({color:0xffaa00,emissive:new THREE.Color(0xff6600),emissiveIntensity:.9});
    // 몸통
    var body=new THREE.Mesh(new THREE.BoxGeometry(.65,.7,.95),scaleM);body.position.set(0,.85,0);g.add(body);
    // 배 (밝은색)
    var belly=new THREE.Mesh(new THREE.BoxGeometry(.38,.5,.75),bellyM);belly.position.set(0,.72,.05);g.add(belly);
    // 목
    var neck=new THREE.Mesh(new THREE.BoxGeometry(.3,.45,.28),scaleM);neck.position.set(0,1.28,.35);neck.rotation.x=-.3;g.add(neck);
    // 머리
    var head=new THREE.Mesh(new THREE.BoxGeometry(.42,.38,.42),scaleM);head.position.set(0,1.58,.55);g.add(head);
    // 주둥이
    var snout=new THREE.Mesh(new THREE.BoxGeometry(.28,.22,.36),scaleM);snout.position.set(0,1.5,.82);g.add(snout);
    // 불꽃 입
    var flame=new THREE.Mesh(new THREE.ConeGeometry(.1,.28,6),fireM);flame.position.set(0,1.48,1.04);flame.rotation.x=Math.PI/2;g.add(flame);
    // 눈
    [-0.15,0.15].forEach(function(ex){
      var eye=new THREE.Mesh(new THREE.SphereGeometry(.07,6,6),fireM);eye.position.set(ex,1.7,.72);g.add(eye);
    });
    // 뿔 2개
    [-0.15,0.15].forEach(function(ex){
      var horn=new THREE.Mesh(new THREE.ConeGeometry(.06,.3,5),hornM);
      horn.position.set(ex,1.88,.44);horn.rotation.z=ex>0?.25:-.25;g.add(horn);
    });
    // 날개 (좌우)
    [-1,1].forEach(function(side){
      var wingBase=new THREE.Mesh(new THREE.BoxGeometry(.12,.5,.04),scaleM);wingBase.position.set(side*.4,1.2,-.05);g.add(wingBase);
      var wingMid=new THREE.Mesh(new THREE.BoxGeometry(.7,.4,.03),wingM);wingMid.position.set(side*.85,1.1,-.05);g.add(wingMid);
      var wingTip=new THREE.Mesh(new THREE.BoxGeometry(.4,.25,.02),wingM);wingTip.position.set(side*1.25,.95,-.05);g.add(wingTip);
    });
    // 다리
    [[-0.22,.38],[.22,.38],[-0.22,-.38],[.22,-.38]].forEach(function(p){
      var lx=p[0],lz=p[1];
      var leg=new THREE.Mesh(new THREE.BoxGeometry(.16,.48,.16),scaleM);leg.position.set(lx,.24,lz);g.add(leg);
      var claw=new THREE.Mesh(new THREE.BoxGeometry(.22,.1,.22),hornM);claw.position.set(lx,.02,lz);g.add(claw);
    });
    // 꼬리
    var tail1=new THREE.Mesh(new THREE.BoxGeometry(.22,.2,.45),scaleM);tail1.position.set(0,.78,-.62);g.add(tail1);
    var tail2=new THREE.Mesh(new THREE.BoxGeometry(.14,.14,.4),scaleM);tail2.position.set(0,.68,-.98);g.add(tail2);
    var tailTip=new THREE.Mesh(new THREE.ConeGeometry(.1,.22,4),hornM);tailTip.position.set(0,.62,-1.2);tailTip.rotation.x=Math.PI/2;g.add(tailTip);
    // 발광
    var fireLight=new THREE.PointLight(0xff4400,2,8);fireLight.position.set(0,1.2,0);g.add(fireLight);
  }
  return g;
}

function spawnMonster(def,x,z){
  var mesh=mkMonsterMesh(def);
  mesh.position.set(x,0,z);
  mesh.rotation.y=Math.random()*Math.PI*2;
  scene.add(mesh);
  var lov=document.getElementById('lov');
  var wrap=document.createElement('div');
  wrap.style.cssText='position:absolute;transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center;gap:2px;pointer-events:none;';
  var ntag=document.createElement('div');ntag.className='llabel npc';
  ntag.style.cssText+=';background:#1a0808ee;border-color:#883333;color:#ff8888;font-size:10px;';
  ntag.textContent=def.name;
  var hbw=document.createElement('div');
  hbw.style.cssText='width:56px;height:5px;background:#2a0808;border:1px solid #551111;overflow:hidden;';
  var hbf=document.createElement('div');hbf.style.cssText='height:100%;background:#cc2222;width:100%;transition:width .15s;';
  hbw.appendChild(hbf);wrap.appendChild(ntag);wrap.appendChild(hbw);lov.appendChild(wrap);
  var m={def:def,mesh:mesh,hp:def.hp,maxHp:def.hp,wrap:wrap,hbf:hbf,state:'idle',attackTimer:0,bobOff:Math.random()*Math.PI*2,spawnX:x,spawnZ:z};
  monsters.push(m);return m;
}

function buildHuntZone(){
  var sm=new THREE.MeshLambertMaterial({color:0x5a2a10});
  var warnM=new THREE.MeshLambertMaterial({color:0xcc3300,emissive:new THREE.Color(0x440000),emissiveIntensity:.5});

  // ─────────────────────────────────────
  // 경계 표지판 (마을 출구)
  // ─────────────────────────────────────
  var sign=new THREE.Mesh(new THREE.BoxGeometry(6,.3,.15),sm);sign.position.set(0,1.2,14.5);scene.add(sign);
  [[-2.5,14.5],[2.5,14.5]].forEach(function(p){
    var post=new THREE.Mesh(new THREE.CylinderGeometry(.1,.12,2,6),sm);post.position.set(p[0],1,p[1]);scene.add(post);
  });
  var warn=new THREE.Mesh(new THREE.BoxGeometry(5.6,.22,.08),warnM);warn.position.set(0,1.2,14.45);scene.add(warn);

  // ─────────────────────────────────────
  // 구역 1: 초원 (z 15 ~ 65) — 토끼, 사슴
  // ─────────────────────────────────────
  var g1=new THREE.Mesh(new THREE.PlaneGeometry(120,55),new THREE.MeshLambertMaterial({color:0x2a5a18}));
  g1.rotation.x=-Math.PI/2;g1.position.set(0,.005,40);scene.add(g1);
  // 초원 길
  var r1=new THREE.Mesh(new THREE.PlaneGeometry(6,55),new THREE.MeshLambertMaterial({color:0x1e1a10}));
  r1.rotation.x=-Math.PI/2;r1.position.set(0,.01,40);scene.add(r1);
  // 초원 조명
  var pl1=new THREE.PointLight(0x88cc44,.25,40);pl1.position.set(0,6,40);scene.add(pl1);
  // 초원 나무 (듬성듬성)
  [[-18,18],[-22,28],[-16,38],[-20,50],[-14,60],
   [18,20],[20,30],[16,42],[22,54],[15,62],
   [-30,22],[-28,40],[28,25],[30,45]
  ].forEach(function(p){mkTree(p[0],p[1],.9+Math.random()*.7);});
  // 꽃 & 덤불
  var flowerM=new THREE.MeshLambertMaterial({color:0xffcc44});
  var bushM=new THREE.MeshLambertMaterial({color:0x224a10});
  [[-8,24],[6,32],[-12,44],[10,52],[4,60],[-6,56]].forEach(function(p){
    var bush=new THREE.Mesh(new THREE.SphereGeometry(.5+Math.random()*.3,6,6),bushM);
    bush.scale.y=.6;bush.position.set(p[0],.3,p[1]);scene.add(bush);
  });
  // 구역 1 표지판
  var z1sign=new THREE.Mesh(new THREE.BoxGeometry(5,.25,.1),new THREE.MeshLambertMaterial({color:0x3a6a20}));
  z1sign.position.set(4,1.1,16);scene.add(z1sign);

  // ─────────────────────────────────────
  // 구역 2: 독 늪 (z 65 ~ 130) — 슬라임, 독두꺼비
  // ─────────────────────────────────────
  var g2=new THREE.Mesh(new THREE.PlaneGeometry(120,70),new THREE.MeshLambertMaterial({color:0x1a3010}));
  g2.rotation.x=-Math.PI/2;g2.position.set(0,.005,97);scene.add(g2);
  // 늪 물웅덩이들
  var swampM=new THREE.MeshLambertMaterial({color:0x1a3a10,emissive:new THREE.Color(0x0a1a08),emissiveIntensity:.2,transparent:true,opacity:.8});
  [[-12,70,6,4],[-8,85,5,3],[8,78,7,4],[-5,98,6,5],[10,110,5,3],[-14,118,8,5],[0,125,7,4]].forEach(function(p){
    var pool=new THREE.Mesh(new THREE.PlaneGeometry(p[2]*2,p[3]*2),swampM);
    pool.rotation.x=-Math.PI/2;pool.position.set(p[0],.03,p[1]);scene.add(pool);
  });
  // 늪 안개 조명
  var pl2=new THREE.PointLight(0x22aa22,.3,30);pl2.position.set(0,3,97);scene.add(pl2);
  var pl2b=new THREE.PointLight(0x44cc44,.2,25);pl2b.position.set(-10,2,115);scene.add(pl2b);
  // 죽은 나무
  var deadM=new THREE.MeshLambertMaterial({color:0x2a1a08});
  [[-16,70],[-12,80],[-18,90],[-14,105],[14,75],[12,88],[18,100],[16,118],[-8,125],[8,122]].forEach(function(p){
    var tx=p[0],tz=p[1];
    var trunk=new THREE.Mesh(new THREE.CylinderGeometry(.18,.28,3.5+Math.random()*2,6),deadM);
    trunk.position.set(tx,1.75,tz);trunk.rotation.z=(Math.random()-.5)*.2;scene.add(trunk);
    var branchG=new THREE.BoxGeometry(1.5+Math.random(),.1,.1);
    var br=new THREE.Mesh(branchG,deadM);br.position.set(tx+.5,3.2+Math.random()*.5,tz);br.rotation.z=.5;scene.add(br);
  });
  // 독 버섯
  var mushM=new THREE.MeshLambertMaterial({color:0xaa4444});
  var mushCapM=new THREE.MeshLambertMaterial({color:0xff6666,emissive:new THREE.Color(0x441111),emissiveIntensity:.2});
  [[-4,72],[6,82],[-10,94],[4,102],[-6,115],[8,120]].forEach(function(p){
    var mx=p[0],mz=p[1];
    var stem=new THREE.Mesh(new THREE.CylinderGeometry(.07,.1,.4,6),mushM);stem.position.set(mx,.2,mz);scene.add(stem);
    var cap=new THREE.Mesh(new THREE.SphereGeometry(.22,8,8),mushCapM);cap.scale.y=.55;cap.position.set(mx,.45,mz);scene.add(cap);
  });
  // 구역 경계 표지판
  var z2sign=new THREE.Mesh(new THREE.BoxGeometry(5,.25,.1),new THREE.MeshLambertMaterial({color:0x225a10}));
  z2sign.position.set(4,1.1,66);scene.add(z2sign);

  // ─────────────────────────────────────
  // 구역 3: 어두운 숲 (z 130 ~ 210) — 고블린, 늑대
  // ─────────────────────────────────────
  var g3=new THREE.Mesh(new THREE.PlaneGeometry(120,85),new THREE.MeshLambertMaterial({color:0x0d1208}));
  g3.rotation.x=-Math.PI/2;g3.position.set(0,.005,170);scene.add(g3);
  var r3=new THREE.Mesh(new THREE.PlaneGeometry(5,85),new THREE.MeshLambertMaterial({color:0x110e08}));
  r3.rotation.x=-Math.PI/2;r3.position.set(0,.01,170);scene.add(r3);
  // 어두운 숲 조명 (붉은 기운)
  var pl3=new THREE.PointLight(0x331100,.4,35);pl3.position.set(0,5,160);scene.add(pl3);
  var pl3b=new THREE.PointLight(0x220800,.3,30);pl3b.position.set(-15,4,185);scene.add(pl3b);
  var pl3c=new THREE.PointLight(0x440011,.3,30);pl3c.position.set(15,4,200);scene.add(pl3c);
  // 빽빽한 나무
  [[-14,135],[-18,143],[-12,152],[-16,162],[-10,172],[-18,180],[-14,190],[-20,200],[-12,207],
   [14,137],[18,145],[12,155],[16,165],[10,175],[18,183],[14,193],[20,203],[12,208],
   [-26,140],[-28,158],[-24,175],[-26,192],[26,142],[28,160],[24,177],[26,194],
   [-8,210],[8,210],[0,208]
  ].forEach(function(p){mkTree(p[0],p[1],1.2+Math.random()*.8);});
  // 바위들
  var rockM=new THREE.MeshLambertMaterial({color:0x3a3028});
  [[-8,138,1.4],[6,148,1.1],[-5,160,1.6],[9,170,1.0],[-11,182,1.3],[7,192,1.5],[0,200,1.2]].forEach(function(p){
    var rx=p[0],rz=p[1],rs=p[2];
    var rock=new THREE.Mesh(new THREE.DodecahedronGeometry(rs,0),rockM);
    rock.position.set(rx,rs*.4,rz);rock.rotation.y=Math.random()*Math.PI;scene.add(rock);
  });
  // 고블린 캠프 (z 145 근처)
  var tentM=new THREE.MeshLambertMaterial({color:0x4a3a10});
  var tent=new THREE.Mesh(new THREE.ConeGeometry(3,3,6),tentM);tent.position.set(-8,1.5,148);scene.add(tent);
  var campfire=new THREE.Mesh(new THREE.ConeGeometry(.3,.6,5),new THREE.MeshLambertMaterial({color:0xff5500,emissive:new THREE.Color(0xff2200),emissiveIntensity:.8}));
  campfire.position.set(-6,.3,152);scene.add(campfire);
  var cfl=new THREE.PointLight(0xff4400,1.5,10);cfl.position.set(-6,1,152);scene.add(cfl);
  // 구역 표지판
  var z3sign=new THREE.Mesh(new THREE.BoxGeometry(5,.25,.1),new THREE.MeshLambertMaterial({color:0x6a2a10}));
  z3sign.position.set(4,1.1,131);scene.add(z3sign);

  // ─────────────────────────────────────
  // 구역 4: 화산 지대 (z 210 ~ 290) — 용암 골렘, 파이어드레이크
  // ─────────────────────────────────────
  var g4=new THREE.Mesh(new THREE.PlaneGeometry(120,85),new THREE.MeshLambertMaterial({color:0x220800}));
  g4.rotation.x=-Math.PI/2;g4.position.set(0,.005,252);scene.add(g4);
  // 화산 조명
  var pl4=new THREE.PointLight(0xff2200,.6,40);pl4.position.set(0,5,252);scene.add(pl4);
  var pl4b=new THREE.PointLight(0xff4400,.5,35);pl4b.position.set(-15,5,235);scene.add(pl4b);
  var pl4c=new THREE.PointLight(0xff1100,.5,35);pl4c.position.set(15,5,268);scene.add(pl4c);
  // 용암 웅덩이
  var lavaM2=new THREE.MeshLambertMaterial({color:0xff3300,emissive:new THREE.Color(0xff1100),emissiveIntensity:.5,transparent:true,opacity:.9});
  [[-14,218,5,3],[8,228,6,4],[-6,240,7,5],[12,252,5,4],[-10,262,6,4],[0,272,8,5],[10,280,5,3]].forEach(function(p){
    var lava=new THREE.Mesh(new THREE.PlaneGeometry(p[2]*2,p[3]*2),lavaM2);
    lava.rotation.x=-Math.PI/2;lava.position.set(p[0],.05,p[1]);scene.add(lava);
    var ll=new THREE.PointLight(0xff2200,.6,p[2]*2.5);ll.position.set(p[0],1,p[1]);scene.add(ll);
  });
  // 화산 바위
  var volcM=new THREE.MeshLambertMaterial({color:0x331100});
  var crackVM=new THREE.MeshLambertMaterial({color:0xff3300,emissive:new THREE.Color(0xff1100),emissiveIntensity:.5});
  [[-10,222,2],[8,232,1.8],[-14,244,2.5],[6,255,2],[-8,265,1.9],[12,272,2.2],[-4,280,1.6]].forEach(function(p){
    var rx=p[0],rz=p[1],rs=p[2];
    var vr=new THREE.Mesh(new THREE.DodecahedronGeometry(rs,0),volcM);
    vr.position.set(rx,rs*.5,rz);vr.rotation.y=Math.random()*Math.PI;scene.add(vr);
    var cr=new THREE.Mesh(new THREE.BoxGeometry(.1,rs*.8,.1),crackVM);cr.position.set(rx,rs*.5,rz);scene.add(cr);
  });
  // 화산 굴뚝 (용암 분출)
  [[-18,225],[18,238],[-20,258],[20,270]].forEach(function(p){
    var cx=p[0],cz=p[1];
    var chimney=new THREE.Mesh(new THREE.CylinderGeometry(1,1.4,5,8),volcM);chimney.position.set(cx,2.5,cz);scene.add(chimney);
    var smoke=new THREE.Mesh(new THREE.CylinderGeometry(.6,.2,2,6),new THREE.MeshLambertMaterial({color:0x441100,emissive:new THREE.Color(0xff2200),emissiveIntensity:.4}));
    smoke.position.set(cx,6,cz);scene.add(smoke);
    var cl=new THREE.PointLight(0xff2200,1,12);cl.position.set(cx,5,cz);scene.add(cl);
  });
  // 보스 드레이크 드래곤 중앙 제단
  var altarM=new THREE.MeshLambertMaterial({color:0x221100});
  var altar=new THREE.Mesh(new THREE.CylinderGeometry(4,5,1,8),altarM);altar.position.set(0,.5,265);scene.add(altar);
  var altarL=new THREE.PointLight(0xff4400,2,15);altarL.position.set(0,2,265);scene.add(altarL);
  // 구역 표지판
  var z4sign=new THREE.Mesh(new THREE.BoxGeometry(5,.25,.1),new THREE.MeshLambertMaterial({color:0x8a2200}));
  z4sign.position.set(4,1.1,211);scene.add(z4sign);

  // ─────────────────────────────────────
  // 몬스터 스폰 (구역별, 넓게 분산)
  // ─────────────────────────────────────
  [
  // 초원 — 토끼 & 사슴 (z 18~62, 넓게)
   {id:'rabbit',pos:[[-14,20],[12,26],[-6,34],[16,40],[-18,48],[8,56],[-4,62]]},
   {id:'deer',  pos:[[18,22],[-16,30],[10,38],[-12,46],[14,54],[-8,60]]},
  // 독 늪 — 슬라임 & 독두꺼비 (z 68~125)
   {id:'slime', pos:[[-14,70],[10,78],[-6,88],[16,96],[-18,106],[8,116],[0,124]]},
   {id:'toad',  pos:[[16,73],[-12,83],[8,93],[-16,103],[12,113],[-4,122]]},
  // 어두운 숲 — 고블린 & 늑대 (z 133~205)
   {id:'goblin',pos:[[-14,135],[8,143],[-6,153],[16,163],[-18,172],[6,182],[-10,193],[14,203]]},
   {id:'wolf',  pos:[[18,138],[-16,148],[12,158],[-8,168],[18,178],[-14,188],[8,200]]},
  // 화산 — 골렘 & 드레이크 (z 215~283, 더 띄움)
   {id:'golem',      pos:[[-16,218],[14,232],[-8,246],[18,258],[-14,270],[10,282]]},
   {id:'firedrake',  pos:[[16,224],[-14,238],[10,252],[-16,264],[14,276],[0,286]]},
  ].forEach(function(entry){
    var d=MONSTER_DEFS.find(function(x){return x.id===entry.id;});
    if(d)entry.pos.forEach(function(p){spawnMonster(d,p[0],p[1]);});
  });
}

function updMonsters(dt,t){
  var px=PL.group.position.x,pz=PL.group.position.z;
  attackCooldown=Math.max(0,attackCooldown-dt);
  invincibleTimer=Math.max(0,invincibleTimer-dt);
  closestMonster=null;var md=20.0; // 넓게 잡아서 F힌트 표시용
  monsters.forEach(function(m){
    if(m.state==='dead')return;
    var mx=m.mesh.position.x,mz=m.mesh.position.z;
    var dist=Math.sqrt((px-mx)*(px-mx)+(pz-mz)*(pz-mz));
    posEl(m.wrap,mx,m.mesh.position.y+2.1,mz);
    m.hbf.style.width=Math.max(0,m.hp/m.maxHp*100)+'%';
    if(dist<md){md=dist;closestMonster=m;}
    if(m.state==='idle'&&dist<m.def.aggro){m.state='aggro';addChat('inf','',m.def.name+'이(가) 달려온다!');}
    if(m.state==='aggro'){
      if(dist>1.2){
        var dx=px-mx,dz2=pz-mz,len=Math.sqrt(dx*dx+dz2*dz2);
        m.mesh.position.x+=dx/len*m.def.spd*dt;
        m.mesh.position.z+=dz2/len*m.def.spd*dt;
        m.mesh.rotation.y=Math.atan2(dx,dz2);
        if(m.def.id!=='slime'){
          var la=Math.sin(t*7+m.bobOff)*.35;
          var ch=m.mesh.children;
          if(ch[3])ch[3].rotation.x=la;if(ch[4])ch[4].rotation.x=-la;
        }
      }
      m.attackTimer-=dt;
      if(dist<1.8&&m.attackTimer<=0){
        m.attackTimer=1.4+Math.random()*.5;
        if(invincibleTimer<=0){
          var dmg=Math.max(1,m.def.atk+Math.floor(Math.random()*4)-2);
          playerHP=Math.max(0,playerHP-dmg);
          updPlayerHpBar();spawnDmgNum('-'+dmg,'#ff5555');
          if(playerHP<=0)playerDied();
        }
      }
      if(Math.sqrt((mx-m.spawnX)*(mx-m.spawnX)+(mz-m.spawnZ)*(mz-m.spawnZ))>22){
        m.state='idle';m.hp=m.maxHp;m.hbf.style.width='100%';
        m.mesh.position.set(m.spawnX,0,m.spawnZ);
      }
    }
    m.mesh.position.y=Math.sin(t*.8+m.bobOff)*.03;
  });
  var fh=document.getElementById('f-hint');
  if(fh)fh.style.display=(md<7&&currentZone!=='village')?'block':'none';
}
