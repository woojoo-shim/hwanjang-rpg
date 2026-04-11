/* ════════════ 포톤 모델 (일반 + 타락) ════════════ */
/* 의존: world.js (scene), Three.js r128
   선언: buildPhotonNormal, buildPhotonCorrupted */

/* ── 일반 포톤: 작고 귀여운 검은 실루엣, 광택 눈, 광대 모자 ── */
function buildPhotonNormal(x,y,z){
  var g=new THREE.Group();
  var bodyM=new THREE.MeshLambertMaterial({color:0x0a0a0a});
  var eyeM=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.95});
  var hatM=new THREE.MeshLambertMaterial({color:0x080808});
  var tailM=new THREE.MeshLambertMaterial({color:0x0a0a0a});

  /* 몸통 — 둥글고 작은 체형 */
  var body=new THREE.Mesh(new THREE.SphereGeometry(0.6,12,10),bodyM);
  body.scale.set(1,1.1,0.9);
  body.position.y=0.6;
  g.add(body);

  /* 머리 — 몸통보다 큰 둥근 머리 */
  var head=new THREE.Mesh(new THREE.SphereGeometry(0.55,12,10),bodyM);
  head.position.y=1.45;
  g.add(head);

  /* 눈 — 크고 빛나는 흰 눈 (약간 기울어진) */
  var eyeL=new THREE.Mesh(new THREE.SphereGeometry(0.12,8,6),eyeM);
  eyeL.position.set(-0.18,1.52,0.45);eyeL.scale.set(1.3,1.1,0.5);
  g.add(eyeL);
  var eyeR=new THREE.Mesh(new THREE.SphereGeometry(0.12,8,6),eyeM);
  eyeR.position.set(0.18,1.52,0.45);eyeR.scale.set(1.3,1.1,0.5);
  g.add(eyeR);

  /* 눈 글로우 */
  var glowM=new THREE.MeshBasicMaterial({color:0xaaddff,transparent:true,opacity:0.3});
  var glowL=new THREE.Mesh(new THREE.SphereGeometry(0.18,8,6),glowM);
  glowL.position.set(-0.18,1.52,0.42);g.add(glowL);
  var glowR=new THREE.Mesh(new THREE.SphereGeometry(0.18,8,6),glowM);
  glowR.position.set(0.18,1.52,0.42);g.add(glowR);

  /* 광대 모자 — 3갈래 */
  var hatBase=new THREE.Mesh(new THREE.SphereGeometry(0.35,8,6),hatM);
  hatBase.position.y=1.9;hatBase.scale.set(1.5,0.4,1.2);
  g.add(hatBase);

  /* 모자 뿔 3개 */
  var hornPositions=[[-0.35,2.0,0],[0.35,2.0,0],[0,2.0,-0.3]];
  hornPositions.forEach(function(hp){
    var horn=new THREE.Mesh(new THREE.ConeGeometry(0.08,0.5,6),hatM);
    horn.position.set(hp[0],hp[1]+0.25,hp[2]);
    horn.rotation.z=(hp[0]>0?0.4:hp[0]<0?-0.4:0);
    horn.rotation.x=(hp[2]<0?0.3:0);
    g.add(horn);
    /* 뿔 끝 방울 */
    var ball=new THREE.Mesh(new THREE.SphereGeometry(0.06,6,5),hatM);
    ball.position.set(hp[0]+(hp[0]>0?0.08:hp[0]<0?-0.08:0),hp[1]+0.52,hp[2]+(hp[2]<0?-0.05:0));
    g.add(ball);
  });

  /* 작은 팔 */
  var armL=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.05,0.4,5),bodyM);
  armL.position.set(-0.55,0.8,0);armL.rotation.z=0.6;g.add(armL);
  var armR=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.05,0.4,5),bodyM);
  armR.position.set(0.55,0.8,0);armR.rotation.z=-0.6;g.add(armR);

  /* 작은 다리 */
  var legL=new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.06,0.3,5),bodyM);
  legL.position.set(-0.2,0.15,0);g.add(legL);
  var legR=new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.06,0.3,5),bodyM);
  legR.position.set(0.2,0.15,0);g.add(legR);

  /* 꼬리 — 작은 곡선 */
  var tail=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.02,0.4,4),tailM);
  tail.position.set(0,0.5,-0.55);tail.rotation.x=-0.5;g.add(tail);
  var tailTip=new THREE.Mesh(new THREE.SphereGeometry(0.04,5,4),tailM);
  tailTip.position.set(0,0.65,-0.75);g.add(tailTip);

  /* 그림자 글로우 — 발 밑 어두운 원 */
  var shadowM=new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0.4});
  var shadow=new THREE.Mesh(new THREE.CircleGeometry(0.5,16),shadowM);
  shadow.rotation.x=-Math.PI/2;shadow.position.y=0.01;g.add(shadow);

  /* 포인트라이트 — 미약한 빛 */
  var light=new THREE.PointLight(0x8888ff,0.3,5);
  light.position.y=1.5;g.add(light);

  g.position.set(x,y,z);
  g._photonType='normal';
  g._eyeL=eyeL;g._eyeR=eyeR;g._glowL=glowL;g._glowR=glowR;
  g._arms=[armL,armR];g._legs=[legL,legR];g._tail=tail;
  return g;
}

/* ── 타락 포톤: 크고 무섭게, 촉수, 4개의 빨간 눈 ── */
function buildPhotonCorrupted(x,y,z){
  var g=new THREE.Group();
  var bodyM=new THREE.MeshLambertMaterial({color:0x0a0008,transparent:true,opacity:0.9});
  var eyeM=new THREE.MeshBasicMaterial({color:0xff2222,transparent:true,opacity:0.95});
  var tentM=new THREE.MeshLambertMaterial({color:0x1a0012,transparent:true,opacity:0.8});
  var hatM=new THREE.MeshLambertMaterial({color:0x0a0008});

  /* 몸통 — 크고 불규칙한 형태 */
  var body=new THREE.Mesh(new THREE.SphereGeometry(1.2,14,12),bodyM);
  body.scale.set(1,1.3,0.95);
  body.position.y=2.5;
  g.add(body);

  /* 머리 — 더 큰, 뿔이 날카로운 모자 */
  var head=new THREE.Mesh(new THREE.SphereGeometry(0.9,12,10),bodyM);
  head.position.y=4.0;
  g.add(head);

  /* 4개의 빨간 눈 */
  var eyePositions=[
    [-0.35,4.15,0.75],[-0.12,4.3,0.78],
    [0.12,4.3,0.78],[0.35,4.15,0.75]
  ];
  var eyeGlowM=new THREE.MeshBasicMaterial({color:0xff0000,transparent:true,opacity:0.5});
  eyePositions.forEach(function(ep){
    var eye=new THREE.Mesh(new THREE.SphereGeometry(0.12,8,6),eyeM);
    eye.position.set(ep[0],ep[1],ep[2]);eye.scale.set(1.4,1.0,0.5);
    g.add(eye);
    var glow=new THREE.Mesh(new THREE.SphereGeometry(0.2,8,6),eyeGlowM);
    glow.position.set(ep[0],ep[1],ep[2]-0.05);g.add(glow);
  });

  /* 광대 모자 — 거대하고 날카로운 */
  var hatBase=new THREE.Mesh(new THREE.SphereGeometry(0.7,10,8),hatM);
  hatBase.position.y=4.8;hatBase.scale.set(1.8,0.5,1.5);
  g.add(hatBase);

  var hornDefs=[[-0.7,5.0,0,0.15,1.2,-0.5],[0.7,5.0,0,0.15,1.2,0.5],[0,5.0,-0.5,0.12,1.0,0]];
  hornDefs.forEach(function(hd){
    var horn=new THREE.Mesh(new THREE.ConeGeometry(hd[3],hd[4],6),hatM);
    horn.position.set(hd[0],hd[1]+hd[4]/2,hd[2]);
    horn.rotation.z=hd[5];
    g.add(horn);
    var ball=new THREE.Mesh(new THREE.SphereGeometry(0.08,6,5),new THREE.MeshLambertMaterial({color:0x220011}));
    ball.position.set(hd[0]+(hd[5]>0?0.15:hd[5]<0?-0.15:0),hd[1]+hd[4]+0.1,hd[2]);
    g.add(ball);
  });

  /* 촉수/그림자 — 하체가 녹아내리는 형태 */
  for(var ti=0;ti<8;ti++){
    var angle=ti/8*Math.PI*2;
    var tentLen=2.0+Math.random()*1.5;
    var tentR=0.08+Math.random()*0.06;
    var tent=new THREE.Mesh(new THREE.CylinderGeometry(tentR,0.02,tentLen,5),tentM);
    var tx=Math.cos(angle)*0.6;
    var tz=Math.sin(angle)*0.6;
    tent.position.set(tx,1.0-tentLen/2,tz);
    tent.rotation.x=Math.sin(angle)*0.3;
    tent.rotation.z=Math.cos(angle)*0.3;
    g.add(tent);
  }

  /* 떠다니는 어둠 파티클 — 주변에 작은 구체 */
  var darkPartM=new THREE.MeshBasicMaterial({color:0x220011,transparent:true,opacity:0.4});
  for(var di=0;di<12;di++){
    var dp=new THREE.Mesh(new THREE.SphereGeometry(0.06+Math.random()*0.08,5,4),darkPartM);
    dp.position.set((Math.random()-.5)*3,1+Math.random()*4,(Math.random()-.5)*3);
    g.add(dp);
  }

  /* 빨간 글로우 라이트 */
  var redLight=new THREE.PointLight(0xff2200,0.8,12);
  redLight.position.y=4;g.add(redLight);
  var redLight2=new THREE.PointLight(0x880011,0.4,8);
  redLight2.position.y=1;g.add(redLight2);

  /* 바닥 그림자 — 넓고 어둡게 */
  var shadowM2=new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0.6});
  var shadow=new THREE.Mesh(new THREE.CircleGeometry(2,24),shadowM2);
  shadow.rotation.x=-Math.PI/2;shadow.position.y=0.02;g.add(shadow);

  g.position.set(x,y,z);
  g._photonType='corrupted';
  g._tentacles=[];
  g.children.forEach(function(c){if(c.material===tentM)g._tentacles.push(c);});
  g._darkParts=[];
  g.children.forEach(function(c){if(c.material===darkPartM)g._darkParts.push(c);});
  return g;
}

/* ── 포톤 애니메이션 (매 프레임 호출) ── */
function animatePhoton(group,dt,time){
  if(!group)return;
  if(group._photonType==='normal'){
    /* 부드러운 부유 */
    group.position.y+=Math.sin(time*2)*0.003;
    /* 눈 깜빡 */
    if(group._eyeL){
      var blink=Math.sin(time*0.5)>0.95?0.1:1;
      group._eyeL.scale.y=blink;group._eyeR.scale.y=blink;
    }
    /* 팔 흔들기 */
    if(group._arms){
      group._arms[0].rotation.z=0.6+Math.sin(time*3)*0.2;
      group._arms[1].rotation.z=-0.6-Math.sin(time*3)*0.2;
    }
    /* 꼬리 흔들기 */
    if(group._tail){
      group._tail.rotation.z=Math.sin(time*4)*0.15;
    }
  }else if(group._photonType==='corrupted'){
    /* 불규칙한 부유 */
    group.position.y+=Math.sin(time*1.5)*0.005;
    group.rotation.y+=dt*0.1;
    /* 촉수 물결 */
    if(group._tentacles){
      group._tentacles.forEach(function(t,i){
        t.rotation.x=Math.sin(time*2+i)*0.4;
        t.rotation.z=Math.cos(time*1.5+i*0.7)*0.3;
      });
    }
    /* 어둠 파티클 궤도 */
    if(group._darkParts){
      group._darkParts.forEach(function(p,i){
        var a=time*0.8+i*0.5;
        var r=1.5+Math.sin(time+i)*0.5;
        p.position.x=Math.cos(a)*r;
        p.position.z=Math.sin(a)*r;
        p.position.y=2+Math.sin(time*1.5+i*0.8)*1.5;
        p.material.opacity=0.2+Math.sin(time*2+i)*0.2;
      });
    }
  }
}
