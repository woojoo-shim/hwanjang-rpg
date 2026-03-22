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
  }
  return g;
}

function spawnMonster(def,x,z,parent){
  var mesh=mkMonsterMesh(def);
  mesh.position.set(x,0,z);
  mesh.rotation.y=Math.random()*Math.PI*2;
  var p=parent||scene;
  p.add(mesh);
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
  /* 초원: x:-80~80, z:20~300 */
  /* 밝은 녹색 패치들 */
  var patchM=new THREE.MeshLambertMaterial({color:0x4a8a2a});
  [[-30,50,12,8],[40,90,10,7],[-20,140,14,10],[25,180,12,8],[-45,220,8,6],[15,260,12,9],
   [60,70,8,6],[-65,120,9,7],[50,200,10,7],[-55,250,8,6],[0,100,10,7],[0,200,12,8]
  ].forEach(function(pp){
    var patch=new THREE.Mesh(new THREE.PlaneGeometry(pp[2],pp[3]),patchM);
    patch.rotation.x=-Math.PI/2;patch.position.set(pp[0],.015,pp[1]);scene.add(patch);
  });
  /* 초원 길 */
  var r1=new THREE.Mesh(new THREE.PlaneGeometry(6,280),new THREE.MeshLambertMaterial({color:0x1e1a10}));
  r1.rotation.x=-Math.PI/2;r1.position.set(0,.013,160);scene.add(r1);
  /* 조명 */
  var pl1=new THREE.PointLight(0xffcc44,.35,120);pl1.position.set(0,8,160);scene.add(pl1);
  var pl1b=new THREE.PointLight(0xffaa33,.2,100);pl1b.position.set(-30,6,90);scene.add(pl1b);
  var pl1c=new THREE.PointLight(0xffcc66,.2,100);pl1c.position.set(30,6,220);scene.add(pl1c);
  var pl1d=new THREE.PointLight(0xffcc44,.2,100);pl1d.position.set(-40,6,190);scene.add(pl1d);
  var pl1e=new THREE.PointLight(0xffaa33,.2,80);pl1e.position.set(50,6,270);scene.add(pl1e);
  /* 구릉 */
  var hillM=new THREE.MeshLambertMaterial({color:0x3a6a22});
  [[-40,60,5,1.2],[35,100,6,1.5],[-25,150,5,1.0],[50,180,6,1.3],[-55,110,4,0.8],
   [65,220,5,1.2],[-30,250,6,1.4],[20,280,4,1.0],[0,130,5,1.1],[-70,170,4,0.9]
  ].forEach(function(pp){
    var hill=new THREE.Mesh(new THREE.SphereGeometry(pp[2],10,8),hillM);
    hill.scale.set(1.5,.25,1.5);hill.position.set(pp[0],pp[3]*.25,pp[1]);scene.add(hill);
  });
  /* 야생화 */
  var flowerColors=[0xffee44,0xffffff,0xcc88ff,0xff88aa,0x88ddff];
  for(var fi=0;fi<120;fi++){
    var fx=(Math.random()-.5)*150,fz=25+Math.random()*270;
    var fc=flowerColors[Math.floor(Math.random()*5)];
    var fl=new THREE.Mesh(new THREE.SphereGeometry(.06+Math.random()*.04,5,5),new THREE.MeshLambertMaterial({color:fc,emissive:new THREE.Color(fc),emissiveIntensity:.15}));
    fl.position.set(fx,.08,fz);scene.add(fl);
  }
  /* 초원 나무 */
  [[-60,35],[-65,80],[-55,130],[-70,180],[-60,230],[-75,270],
   [60,40],[65,85],[55,135],[70,190],[60,240],[75,280],
   [-40,55],[40,70],[-30,110],[30,150],[-45,200],[45,250],
   [-20,60],[20,95],[-15,170],[15,210],[-35,255],[35,275],
   [0,45],[0,125],[0,205],[0,285],
   [-50,165],[50,165],[-50,95],[50,95]
  ].forEach(function(pp){mkTree(pp[0],pp[1],.9+Math.random()*.7,scene);});
  /* 덤불 */
  var bushM=new THREE.MeshLambertMaterial({color:0x224a10});
  [[-25,35],[18,55],[-35,100],[28,145],[12,195],[-18,240],
   [50,80],[-50,130],[60,200],[-60,260],[0,155],[0,80],
   [35,55],[-35,200],[55,270],[-55,170]
  ].forEach(function(pp){
    var bush=new THREE.Mesh(new THREE.SphereGeometry(.5+Math.random()*.3,6,6),bushM);
    bush.scale.y=.6;bush.position.set(pp[0],.3,pp[1]);scene.add(bush);
  });
  /* 몬스터 스폰 — 월드 좌표 (넓게 분산) */
  var rd=MONSTER_DEFS.find(function(x){return x.id==='rabbit';});
  var dd=MONSTER_DEFS.find(function(x){return x.id==='deer';});
  if(rd)[[-35,35],[25,60],[-15,90],[45,120],[-55,150],[10,180],
         [-25,210],[50,245],[-40,270],[15,295],[60,55],[-60,100]
        ].forEach(function(pp){spawnMonster(rd,pp[0],pp[1],scene);});
  if(dd)[[55,45],[-45,80],[30,115],[-30,160],[55,200],[-55,230],
         [15,260],[-20,285],[70,130],[-70,175]
        ].forEach(function(pp){spawnMonster(dd,pp[0],pp[1],scene);});
}

function buildSwamp(){
  /* 늪 동쪽: x:80~200, z:20~300 AND 서쪽: x:-200~-80, z:20~300 */
  var swampM=new THREE.MeshLambertMaterial({color:0x0a2a08,emissive:new THREE.Color(0x0a2208),emissiveIntensity:.35,transparent:true,opacity:.85});

  /* 물웅덩이들 — 양쪽 (더 많고 더 넓게) */
  [[100,35,7,5],[120,70,6,4],[140,55,8,5],[110,110,7,5],[150,145,6,4],[130,180,9,6],[100,220,7,5],[160,255,6,4],[120,280,8,5],
   [-100,35,7,5],[-120,70,6,4],[-140,55,8,5],[-110,110,7,5],[-150,145,6,4],[-130,180,9,6],[-100,220,7,5],[-160,255,6,4],[-120,280,8,5]
  ].forEach(function(pp){
    var pool=new THREE.Mesh(new THREE.PlaneGeometry(pp[2]*2,pp[3]*2),swampM);
    pool.rotation.x=-Math.PI/2;pool.position.set(pp[0],.03,pp[1]);scene.add(pool);
    var poolGlow=new THREE.PointLight(0x22aa22,.3,pp[2]*2);poolGlow.position.set(pp[0],.5,pp[1]);scene.add(poolGlow);
  });
  /* 안개 조명 */
  var pl2=new THREE.PointLight(0x115511,.2,80);pl2.position.set(140,3,160);scene.add(pl2);
  var pl2b=new THREE.PointLight(0x115511,.2,80);pl2b.position.set(-140,3,160);scene.add(pl2b);
  var pl2c=new THREE.PointLight(0x0a3308,.2,80);pl2c.position.set(120,3,80);scene.add(pl2c);
  var pl2d=new THREE.PointLight(0x0a3308,.2,80);pl2d.position.set(-120,3,250);scene.add(pl2d);
  /* 도깨비불 */
  var wispM=new THREE.MeshBasicMaterial({color:0x44ff66,transparent:true,opacity:.6});
  for(var wi=0;wi<30;wi++){
    var side=wi<15?1:-1;
    var wx=side*(85+Math.random()*110),wz=25+Math.random()*270;
    var wisp=new THREE.Mesh(new THREE.SphereGeometry(.08+Math.random()*.06,6,6),wispM);
    wisp.position.set(wx,.8+Math.random()*1.5,wz);scene.add(wisp);
    var wl=new THREE.PointLight(0x33ff44,.25,6);wl.position.set(wx,.8+Math.random()*1.5,wz);scene.add(wl);
  }
  /* 늪 안개 평면 */
  var swampFogM=new THREE.MeshLambertMaterial({color:0x1a3a10,transparent:true,opacity:.08});
  [140,-140].forEach(function(sx){
    for(var sf=0;sf<8;sf++){
      var sfp=new THREE.Mesh(new THREE.PlaneGeometry(18+Math.random()*12,14+Math.random()*8),swampFogM);
      sfp.rotation.x=-Math.PI/2;sfp.position.set(sx+(Math.random()-.5)*40,.12,35+sf*34);scene.add(sfp);
    }
  });
  /* 죽은 나무 */
  var deadM=new THREE.MeshLambertMaterial({color:0x1a1205});
  [[90,40],[110,75],[130,110],[150,145],[170,180],[190,215],[100,250],[140,280],
   [-90,40],[-110,75],[-130,110],[-150,145],[-170,180],[-190,215],[-100,250],[-140,280]
  ].forEach(function(pp){
    var tx=pp[0],tz=pp[1];
    var trunk=new THREE.Mesh(new THREE.CylinderGeometry(.15,.3,3.5+Math.random()*2,6),deadM);
    trunk.position.set(tx,1.75,tz);trunk.rotation.z=(Math.random()-.5)*.4;scene.add(trunk);
    for(var bi=0;bi<2;bi++){
      var brLen=.8+Math.random()*1.2;
      var br=new THREE.Mesh(new THREE.CylinderGeometry(.03,.06,brLen,5),deadM);
      br.position.set(tx+(Math.random()-.5)*1.2,2.5+Math.random()*1.2,tz+(Math.random()-.5)*.5);
      br.rotation.z=(Math.random()-.5)*1.2;br.rotation.x=(Math.random()-.5)*.6;scene.add(br);
    }
  });
  /* 독 버섯 */
  var mushM=new THREE.MeshLambertMaterial({color:0xaa4444});
  var mushCapM=new THREE.MeshLambertMaterial({color:0xff6666,emissive:new THREE.Color(0x441111),emissiveIntensity:.3});
  [[95,50],[115,95],[135,140],[155,185],[175,230],[100,265],
   [-95,50],[-115,95],[-135,140],[-155,185],[-175,230],[-100,265]
  ].forEach(function(pp){
    var mx=pp[0],mz=pp[1];
    var stem=new THREE.Mesh(new THREE.CylinderGeometry(.07,.1,.4,6),mushM);stem.position.set(mx,.2,mz);scene.add(stem);
    var cap=new THREE.Mesh(new THREE.SphereGeometry(.22,8,8),mushCapM);cap.scale.y=.55;cap.position.set(mx,.45,mz);scene.add(cap);
  });
  /* 몬스터 스폰 — 동서 양쪽 (더 넓게 분산) */
  var sd=MONSTER_DEFS.find(function(x){return x.id==='slime';});
  var td=MONSTER_DEFS.find(function(x){return x.id==='toad';});
  /* 동쪽 늪 */
  if(sd)[[90,35],[110,70],[135,110],[155,150],[175,185],[100,225],[130,260],[160,290]].forEach(function(pp){spawnMonster(sd,pp[0],pp[1],scene);});
  if(td)[[100,55],[120,95],[145,135],[165,170],[185,210],[110,250],[150,280]].forEach(function(pp){spawnMonster(td,pp[0],pp[1],scene);});
  /* 서쪽 늪 */
  if(sd)[[-90,35],[-110,70],[-135,110],[-155,150],[-175,185],[-100,225],[-130,260],[-160,290]].forEach(function(pp){spawnMonster(sd,pp[0],pp[1],scene);});
  if(td)[[-100,55],[-120,95],[-145,135],[-165,170],[-185,210],[-110,250],[-150,280]].forEach(function(pp){spawnMonster(td,pp[0],pp[1],scene);});
}

function buildDarkForest(){
  /* 어두운 숲: x:-120~120, z:300~560 */
  /* 길 */
  var r3=new THREE.Mesh(new THREE.PlaneGeometry(6,260),new THREE.MeshLambertMaterial({color:0x0a0806}));
  r3.rotation.x=-Math.PI/2;r3.position.set(0,.013,430);scene.add(r3);
  /* 조명 */
  var pl3=new THREE.PointLight(0x441100,.5,100);pl3.position.set(0,6,360);scene.add(pl3);
  var pl3b=new THREE.PointLight(0x330800,.35,80);pl3b.position.set(-40,5,420);scene.add(pl3b);
  var pl3c=new THREE.PointLight(0x550011,.35,80);pl3c.position.set(40,5,480);scene.add(pl3c);
  var pl3d=new THREE.PointLight(0x220500,.25,80);pl3d.position.set(0,4,540);scene.add(pl3d);
  var pl3e=new THREE.PointLight(0x330800,.3,80);pl3e.position.set(-60,5,380);scene.add(pl3e);
  var pl3f=new THREE.PointLight(0x550011,.3,80);pl3f.position.set(60,5,460);scene.add(pl3f);
  var pl3g=new THREE.PointLight(0x220500,.25,80);pl3g.position.set(-20,4,500);scene.add(pl3g);
  /* 붉은 파티클 */
  var redPartM=new THREE.MeshBasicMaterial({color:0xff2200,transparent:true,opacity:.5});
  for(var rp=0;rp<50;rp++){
    var rpx=(Math.random()-.5)*220,rpz=305+Math.random()*250;
    var rpy=1+Math.random()*3;
    var redP=new THREE.Mesh(new THREE.SphereGeometry(.04+Math.random()*.03,4,4),redPartM);
    redP.position.set(rpx,rpy,rpz);scene.add(redP);
  }
  /* 빽빽한 나무 */
  [[-80,310],[-95,340],[-75,380],[-90,420],[-70,460],[-85,510],[-75,545],
   [80,315],[95,345],[75,385],[90,425],[70,465],[85,515],[75,550],
   [-50,320],[50,335],[-45,365],[45,395],[-55,435],[55,455],
   [-40,480],[40,490],[-50,530],[50,540],
   [-20,310],[20,330],[-15,360],[15,390],[-25,430],[25,450],
   [-10,500],[10,520],[-20,545],[20,555],
   [0,325],[0,400],[0,475],[0,545],
   [-100,360],[100,400],[-100,440],[100,480],[-100,520],[100,550]
  ].forEach(function(pp){mkTree(pp[0],pp[1],1.5+Math.random()*1.0,scene);});
  /* 바위들 */
  var rockM=new THREE.MeshLambertMaterial({color:0x2a2018});
  [[-25,315,1.4],[18,345,1.1],[-15,380,1.6],[28,415,1.0],[-30,455,1.3],[22,490,1.5],[0,530,1.2],
   [50,330,1.3],[-50,370,1.5],[70,410,1.1],[-70,450,1.4],[55,505,1.2],[-55,540,1.0]
  ].forEach(function(pp){
    var rx=pp[0],rz=pp[1],rs=pp[2];
    var rock=new THREE.Mesh(new THREE.DodecahedronGeometry(rs,0),rockM);
    rock.position.set(rx,rs*.4,rz);rock.rotation.y=Math.random()*Math.PI;scene.add(rock);
  });
  /* 어두운 안개 평면 */
  var darkFogM=new THREE.MeshLambertMaterial({color:0x0a0505,transparent:true,opacity:.1});
  for(var df=0;df<18;df++){
    var dfp=new THREE.Mesh(new THREE.PlaneGeometry(20+Math.random()*12,14+Math.random()*8),darkFogM);
    dfp.rotation.x=-Math.PI/2;dfp.position.set((Math.random()-.5)*200,.2,305+df*14);scene.add(dfp);
  }
  /* 고블린 캠프 1 */
  var tentM=new THREE.MeshLambertMaterial({color:0x4a3a10});
  var tent1=new THREE.Mesh(new THREE.ConeGeometry(3,3,6),tentM);tent1.position.set(-25,1.5,345);scene.add(tent1);
  var campfire1=new THREE.Mesh(new THREE.ConeGeometry(.3,.6,5),new THREE.MeshLambertMaterial({color:0xff5500,emissive:new THREE.Color(0xff2200),emissiveIntensity:.8}));
  campfire1.position.set(-22,.3,350);scene.add(campfire1);
  var cfl1=new THREE.PointLight(0xff4400,1.5,15);cfl1.position.set(-22,1,350);scene.add(cfl1);
  /* 고블린 캠프 2 */
  var tent2=new THREE.Mesh(new THREE.ConeGeometry(3,3,6),tentM);tent2.position.set(30,1.5,460);scene.add(tent2);
  var campfire2=new THREE.Mesh(new THREE.ConeGeometry(.3,.6,5),new THREE.MeshLambertMaterial({color:0xff5500,emissive:new THREE.Color(0xff2200),emissiveIntensity:.8}));
  campfire2.position.set(28,.3,465);scene.add(campfire2);
  var cfl2=new THREE.PointLight(0xff4400,1.5,15);cfl2.position.set(28,1,465);scene.add(cfl2);
  /* 캠프파이어 3 */
  var campfire3=new THREE.Mesh(new THREE.ConeGeometry(.25,.5,5),new THREE.MeshLambertMaterial({color:0xff4400,emissive:new THREE.Color(0xff1100),emissiveIntensity:.7}));
  campfire3.position.set(-15,.25,510);scene.add(campfire3);
  var cfl3=new THREE.PointLight(0xff3300,1.2,12);cfl3.position.set(-15,1,510);scene.add(cfl3);
  /* 몬스터 스폰 */
  var gd=MONSTER_DEFS.find(function(x){return x.id==='goblin';});
  var wd=MONSTER_DEFS.find(function(x){return x.id==='wolf';});
  if(gd)[[-40,315],[25,345],[-18,385],[50,415],[-55,450],[18,490],[-30,525],[45,555],
         [80,330],[-80,375],[90,440],[-90,505],[0,365],[0,485]
        ].forEach(function(pp){spawnMonster(gd,pp[0],pp[1],scene);});
  if(wd)[[55,325],[-50,360],[35,400],[-25,440],[60,475],[-45,515],[20,550],[-65,340],
         [75,395],[-75,455],[40,530],[-35,560]
        ].forEach(function(pp){spawnMonster(wd,pp[0],pp[1],scene);});
}

function buildVolcano(){
  /* 화산: x:-100~100, z:560~860 */
  /* 지면 균열 */
  var crackLineM=new THREE.MeshBasicMaterial({color:0xff2200,transparent:true,opacity:.4});
  for(var ci=0;ci<45;ci++){
    var cx2=(Math.random()-.5)*180,cz2=565+Math.random()*290;
    var cLen=2+Math.random()*8;
    var crack=new THREE.Mesh(new THREE.PlaneGeometry(.15,cLen),crackLineM);
    crack.rotation.x=-Math.PI/2;crack.rotation.z=Math.random()*Math.PI;
    crack.position.set(cx2,.018,cz2);scene.add(crack);
  }
  /* 열 발광 */
  var heatGlowM=new THREE.MeshBasicMaterial({color:0xff1100,transparent:true,opacity:.06});
  for(var hg=0;hg<18;hg++){
    var hgp=new THREE.Mesh(new THREE.PlaneGeometry(12+Math.random()*10,10+Math.random()*8),heatGlowM);
    hgp.rotation.x=-Math.PI/2;hgp.position.set((Math.random()-.5)*160,.02,575+hg*16);scene.add(hgp);
  }
  /* 조명 */
  var pl4=new THREE.PointLight(0xff2200,.8,120);pl4.position.set(0,3,710);scene.add(pl4);
  var pl4b=new THREE.PointLight(0xff4400,.6,100);pl4b.position.set(-40,2,630);scene.add(pl4b);
  var pl4c=new THREE.PointLight(0xff1100,.6,100);pl4c.position.set(40,2,760);scene.add(pl4c);
  var pl4d=new THREE.PointLight(0xff3300,.4,100);pl4d.position.set(0,1,820);scene.add(pl4d);
  var pl4e=new THREE.PointLight(0xff2200,.5,100);pl4e.position.set(-60,2,580);scene.add(pl4e);
  var pl4f=new THREE.PointLight(0xff4400,.5,100);pl4f.position.set(60,2,680);scene.add(pl4f);
  var pl4g=new THREE.PointLight(0xff1100,.4,100);pl4g.position.set(-30,2,780);scene.add(pl4g);
  var pl4h=new THREE.PointLight(0xff3300,.4,100);pl4h.position.set(30,2,840);scene.add(pl4h);
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
  [[-40,580,6,4],[25,610,7,5],[-18,645,8,6],[35,680,6,4],[-30,715,7,5],[0,750,9,6],
   [40,785,6,4],[-35,820,7,5],[15,850,8,5],[-50,600,5,4],[55,640,6,5],[-25,700,7,5],[30,740,5,4]
  ].forEach(function(pp){
    var lava=new THREE.Mesh(new THREE.PlaneGeometry(pp[2]*2,pp[3]*2),lavaM2);
    lava.rotation.x=-Math.PI/2;lava.position.set(pp[0],.05,pp[1]);scene.add(lava);
    var ll=new THREE.PointLight(0xff2200,.8,pp[2]*3);ll.position.set(pp[0],.5,pp[1]);scene.add(ll);
  });
  /* 연기 */
  var smokeM=new THREE.MeshLambertMaterial({color:0x1a0a00,transparent:true,opacity:.25});
  for(var si=0;si<28;si++){
    var sx=(Math.random()-.5)*160,sz=570+Math.random()*285;
    var sy=3+Math.random()*5;
    var sr=.5+Math.random()*.8;
    var smokeS=new THREE.Mesh(new THREE.SphereGeometry(sr,6,6),smokeM);
    smokeS.position.set(sx,sy,sz);scene.add(smokeS);
  }
  /* 화산 바위 */
  var crackVM=new THREE.MeshLambertMaterial({color:0xff3300,emissive:new THREE.Color(0xff1100),emissiveIntensity:.6});
  [[-30,575,2],[22,610,1.8],[-40,650,2.5],[18,690,2],[-25,730,1.9],[35,770,2.2],
   [-45,600,1.8],[50,640,2],[-20,670,2.2],[40,710,1.8],[-35,750,2],[25,800,2.2],
   [0,580,1.8],[-55,680,2],[55,750,1.8],[-10,820,2]
  ].forEach(function(pp){
    var rx=pp[0],rz=pp[1],rs=pp[2];
    var vr=new THREE.Mesh(new THREE.DodecahedronGeometry(rs,0),volcM);
    vr.position.set(rx,rs*.5,rz);vr.rotation.y=Math.random()*Math.PI;scene.add(vr);
    var cr=new THREE.Mesh(new THREE.BoxGeometry(.1,rs*.8,.1),crackVM);cr.position.set(rx,rs*.5,rz);scene.add(cr);
  });
  /* 화산 굴뚝 */
  [[-70,580],[70,620],[-80,680],[80,740],[-65,800],[65,850],[-40,570],[40,640],[-55,720],[55,790]].forEach(function(pp){
    var cx=pp[0],cz=pp[1];
    var chimney=new THREE.Mesh(new THREE.CylinderGeometry(1,1.4,5,8),volcM);chimney.position.set(cx,2.5,cz);scene.add(chimney);
    var smoke2=new THREE.Mesh(new THREE.CylinderGeometry(.6,.2,2,6),new THREE.MeshLambertMaterial({color:0x220800,emissive:new THREE.Color(0xff2200),emissiveIntensity:.5}));
    smoke2.position.set(cx,6,cz);scene.add(smoke2);
    for(var smi=0;smi<3;smi++){
      var smk=new THREE.Mesh(new THREE.SphereGeometry(.4+Math.random()*.4,5,5),smokeM);
      smk.position.set(cx+(Math.random()-.5),7+smi*1.2,cz+(Math.random()-.5));scene.add(smk);
    }
    var cl=new THREE.PointLight(0xff2200,1.2,14);cl.position.set(cx,5,cz);scene.add(cl);
  });
  /* 보스 제단 */
  var altarM=new THREE.MeshLambertMaterial({color:0x110800});
  var altar=new THREE.Mesh(new THREE.CylinderGeometry(4,5,1,8),altarM);altar.position.set(0,.5,800);scene.add(altar);
  var altarL=new THREE.PointLight(0xff4400,2.5,25);altarL.position.set(0,2,800);scene.add(altarL);
  var flamePillarM=new THREE.MeshBasicMaterial({color:0xff6600,transparent:true,opacity:.4});
  [-3,3].forEach(function(fpx){
    var fp=new THREE.Mesh(new THREE.CylinderGeometry(.15,.25,3,6),flamePillarM);
    fp.position.set(fpx,1.5,800);scene.add(fp);
    var fpl=new THREE.PointLight(0xff4400,.8,8);fpl.position.set(fpx,2,800);scene.add(fpl);
  });
  /* 몬스터 스폰 (더 넓게 분산) */
  var gld=MONSTER_DEFS.find(function(x){return x.id==='golem';});
  var fdd=MONSTER_DEFS.find(function(x){return x.id==='firedrake';});
  if(gld)[[-45,575],[35,620],[-25,665],[50,710],[-40,755],[20,800],
          [60,580],[-65,625],[30,670],[-30,715],[55,760],[-50,810],[0,840]
         ].forEach(function(pp){spawnMonster(gld,pp[0],pp[1],scene);});
  if(fdd)[[50,590],[-40,635],[30,680],[-50,725],[40,770],[-30,815],[0,855],
          [70,600],[-70,650],[25,695],[-25,740],[65,790],[-60,835]
         ].forEach(function(pp){spawnMonster(fdd,pp[0],pp[1],scene);});
}

/* ════════════ 전체 오픈 월드 빌드 ════════════ */
function buildOpenWorld(){
  monsters=[];closestMonster=null;
  buildMeadow();
  buildSwamp();
  buildDarkForest();
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

    /* ── 3. 피격(흰색 플래시 + 흔들림) 애니메이션 ── */
    if(m.hitFlash>0){
      m.hitFlash=Math.max(0,m.hitFlash-dt);
      var hprog=m.hitFlash/0.35;
      var shakeAmt=Math.sin(m.animTime*60)*0.08*hprog;
      m.mesh.position.x+=shakeAmt;
      /* 스케일 펄스 */
      var hsc=1+Math.sin(hprog*Math.PI)*0.15;
      if(m.spawnAnim<=0)m.mesh.scale.set(hsc,hsc,hsc);
      if(m.hitFlash<=0){
        /* 흰색 플래시 재료 복원 */
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
        m.mesh.scale.set(breath,breath,breath);
      }
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
  monsters.forEach(function(m){
    if(m.state==='dead')return;
    var mx=m.mesh.position.x,mz=m.mesh.position.z;
    var dist=Math.sqrt((px-mx)*(px-mx)+(pz-mz)*(pz-mz));
    /* 먼 몬스터는 AI+렌더링 전부 스킵 */
    if(dist>100){
      m.wrap.style.display='none';
      m.mesh.visible=false;
      if(m.state==='aggro'){m.state='idle';m.mesh.position.set(m.spawnX,0,m.spawnZ);}
      return;
    }
    m.mesh.visible=true;
    if(dist<60){
      posEl(m.wrap,mx,m.mesh.position.y+2.1,mz);
      m.wrap.style.display='';
      m.hbf.style.width=Math.max(0,m.hp/m.maxHp*100)+'%';
    } else {
      m.wrap.style.display='none';
    }
    if(dist<md){md=dist;closestMonster=m;}
    if(m.state==='idle'&&dist<m.def.aggro){m.state='aggro';addChat('inf','',m.def.name+'이(가) 달려온다!');}
    if(m.state==='aggro'){
      if(dist>1.2){
        var dx=px-mx,dz2=pz-mz,len=Math.sqrt(dx*dx+dz2*dz2);
        m.mesh.position.x+=dx/len*m.def.spd*dt;
        m.mesh.position.z+=dz2/len*m.def.spd*dt;
        m.mesh.rotation.y=Math.atan2(dx,dz2);
      }
      m.attackTimer-=dt;
      if(dist<1.8&&m.attackTimer<=0){
        m.attackTimer=1.4+Math.random()*.5;
        /* 공격 애니메이션 트리거 */
        m.isAttacking=true;m.attackAnimT=0.4;
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
        m.mesh.rotation.x=0;m.mesh.rotation.z=0;
      }
    }
  });
  var fh=document.getElementById('f-hint');
  if(fh)fh.style.display=(md<7&&currentZone!=='village')?'block':'none';
}
