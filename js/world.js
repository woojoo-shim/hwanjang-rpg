/* ════════════ 3D 월드 시스템 (타일맵 기반 오픈 월드) ════════════ */
/* 의존: config.js (NPC_DEF, WORLD_BOUNDS, WORLD_SPAWN, ZONE_INFO)
        ui.js (posEl)
        player.js (PL)
        monster.js (spawnMonster, MONSTER_DEFS)
   선언: scene, camera, renderer, npcs, closestNpc, portalMeshes, closestPortal,
         getTerrainAt, heightMap, tileMapData
   참조: myName (main.js) — 런타임 참조 */

var scene,camera,renderer;
var closestNpc=null;
var npcs=[];
/* 호환성용 빈 배열 — portal 참조하는 코드 에러 방지 */
var portalMeshes=[];
var closestPortal=null;

/* 타일맵 데이터 (fetch 후 세팅) */
var tileMapData=null;
var heightMap=null;
var TILE_SIZE=6;
var MAP_COLS=32;
var MAP_ROWS=24;
var MAP_W=MAP_COLS*TILE_SIZE; // 192
var MAP_H=MAP_ROWS*TILE_SIZE; // 144
/* 맵 원점 오프셋: 타일(0,0)의 월드 좌표 좌상단 */
var MAP_OX=-MAP_W/2; // -96
var MAP_OZ=-MAP_H/2; // -72

/* ════════════ 유틸: 월드↔타일 변환 ════════════ */
function worldToTile(wx,wz){
  var col=Math.floor((wx-MAP_OX)/TILE_SIZE);
  var row=Math.floor((wz-MAP_OZ)/TILE_SIZE);
  col=Math.max(0,Math.min(MAP_COLS-1,col));
  row=Math.max(0,Math.min(MAP_ROWS-1,row));
  return{col:col,row:row};
}
function tileToWorld(col,row){
  return{x:MAP_OX+col*TILE_SIZE+TILE_SIZE/2, z:MAP_OZ+row*TILE_SIZE+TILE_SIZE/2};
}

/* 글로벌 함수: 월드 좌표에서 지형 타입 반환 */
function getTerrainAt(worldX,worldZ){
  if(!tileMapData)return'plains';
  var t=worldToTile(worldX,worldZ);
  return tileMapData.tiles[t.row][t.col];
}

/* 글로벌 함수: 월드 좌표에서 지형 높이 반환 */
function getHeightAt(worldX,worldZ){
  if(!heightMap)return 0;
  var t=worldToTile(worldX,worldZ);
  return heightMap[t.row*MAP_COLS+t.col];
}

/* ════════════ 메쉬 빌더 유틸 ════════════ */
function mkHuman(bc,hc){
  var g=new THREE.Group();
  var bm=new THREE.MeshLambertMaterial({color:bc});
  var hm=new THREE.MeshLambertMaterial({color:hc});

  var body=new THREE.Mesh(new THREE.BoxGeometry(.6,1.0,.35),bm);
  body.position.set(0,.95,0);g.add(body);

  var head=new THREE.Mesh(new THREE.BoxGeometry(.45,.45,.45),hm);
  head.position.set(0,1.65,0);g.add(head);

  var legG=new THREE.BoxGeometry(.22,.68,.22);
  var legL=new THREE.Mesh(legG,bm);legL.position.set(-.16,.34,0);g.add(legL);
  var legR=new THREE.Mesh(legG,bm);legR.position.set(.16,.34,0);g.add(legR);

  var armG=new THREE.BoxGeometry(.2,.7,.2);
  var armL=new THREE.Mesh(armG,bm);armL.position.set(-.4,.95,0);g.add(armL);

  var armRPivot=new THREE.Group();
  armRPivot.position.set(.4,1.3,0);
  var armR=new THREE.Mesh(armG,bm);
  armR.position.set(0,-.35,0);
  armRPivot.add(armR);
  g.add(armRPivot);

  return{group:g,legL:legL,legR:legR,armL:armL,armR:armR,armRPivot:armRPivot};
}

function mkTree(x,z,s,parent){
  s=s||1;var g=new THREE.Group();
  var p=parent||scene;
  var tm=new THREE.MeshLambertMaterial({color:0x3a2008});
  var lm1=new THREE.MeshLambertMaterial({color:0x1a3a08});
  var lm2=new THREE.MeshLambertMaterial({color:0x224a10});
  var trunk=new THREE.Mesh(new THREE.CylinderGeometry(.18,.28,2*s,7),tm);trunk.position.set(0,s,0);g.add(trunk);
  var l1=new THREE.Mesh(new THREE.ConeGeometry(1.5*s,2.5*s,8),lm1);l1.position.set(0,2.6*s,0);g.add(l1);
  var l2=new THREE.Mesh(new THREE.ConeGeometry(1.0*s,2.0*s,8),lm2);l2.position.set(0,3.9*s,0);g.add(l2);
  g.position.set(x,0,z);p.add(g);
}

function mkBldg(x,z,w,h,d,bc,rc,parent){
  var g=new THREE.Group();
  var p=parent||scene;
  var bm=new THREE.MeshLambertMaterial({color:bc});
  var rm=new THREE.MeshLambertMaterial({color:rc});
  var stm=new THREE.MeshLambertMaterial({color:0x3a3a3a});
  var dm=new THREE.MeshLambertMaterial({color:0x080808});
  var wm=new THREE.MeshLambertMaterial({color:0xffeeaa,emissive:new THREE.Color(0xffaa00),emissiveIntensity:.22});
  var fd=new THREE.Mesh(new THREE.BoxGeometry(w+.4,.4,d+.4),stm);fd.position.set(0,.2,0);g.add(fd);
  var bd=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),bm);bd.position.set(0,h/2+.4,0);g.add(bd);
  var rf=new THREE.Mesh(new THREE.ConeGeometry(Math.max(w,d)*.72,2.8,4),rm);rf.position.set(0,h+.4+1.4,0);rf.rotation.y=Math.PI/4;g.add(rf);
  var dr=new THREE.Mesh(new THREE.BoxGeometry(.8,1.4,.12),dm);dr.position.set(0,1.1,d/2+.05);g.add(dr);
  var wg=new THREE.BoxGeometry(.6,.6,.12);
  var wl=new THREE.Mesh(wg,wm);wl.position.set(-w/2+1.2,h/2+.4,d/2+.05);g.add(wl);
  var wr=new THREE.Mesh(wg,wm);wr.position.set(w/2-1.2,h/2+.4,d/2+.05);g.add(wr);
  g.position.set(x,0,z);p.add(g);
}

function mkStall(x,z,rotY,color,roofColor,label,parent){
  var g=new THREE.Group();
  var p=parent||scene;
  var postM=new THREE.MeshLambertMaterial({color:0x5a3a10});
  var postG=new THREE.BoxGeometry(.15,2.2,.15);
  [[-1.1,0,-0.65],[1.1,0,-0.65],[-1.1,0,.65],[1.1,0,.65]].forEach(function(pp){
    var post=new THREE.Mesh(postG,postM);post.position.set(pp[0],1.1,pp[2]);g.add(post);
  });
  var ctrM=new THREE.MeshLambertMaterial({color:color});
  var ctr=new THREE.Mesh(new THREE.BoxGeometry(2.4,.5,1.4),ctrM);ctr.position.set(0,.25,0);g.add(ctr);
  var rfM=new THREE.MeshLambertMaterial({color:roofColor});
  var rf=new THREE.Mesh(new THREE.BoxGeometry(2.8,.08,1.6),rfM);rf.position.set(0,2.2,0);g.add(rf);
  var rfF=new THREE.Mesh(new THREE.BoxGeometry(2.8,.6,0.08),rfM);rfF.position.set(0,1.9,-.84);g.add(rfF);
  var signM=new THREE.MeshLambertMaterial({color:0x3a1a00,emissive:new THREE.Color(0x331100),emissiveIntensity:.3});
  var sign=new THREE.Mesh(new THREE.BoxGeometry(1.6,.4,.08),signM);sign.position.set(0,2.55,-.84);g.add(sign);
  var itemM=new THREE.MeshLambertMaterial({color:0xffcc44,emissive:new THREE.Color(0x886600),emissiveIntensity:.2});
  for(var i=-1;i<=1;i++){
    var itm=new THREE.Mesh(new THREE.BoxGeometry(.3,.2,.3),itemM);itm.position.set(i*.6,.52,-.1);g.add(itm);
  }
  g.position.set(x,0,z);g.rotation.y=rotY;p.add(g);
  return g;
}

function mkCastle(){
  var g=new THREE.Group();
  var wallM=new THREE.MeshLambertMaterial({color:0x8a8870});
  var roofM=new THREE.MeshLambertMaterial({color:0x4488cc,emissive:new THREE.Color(0x224488),emissiveIntensity:.3});
  var gateM=new THREE.MeshLambertMaterial({color:0x1a1000,emissive:new THREE.Color(0xff8800),emissiveIntensity:.5});

  var main=new THREE.Mesh(new THREE.BoxGeometry(12,8,10),wallM);main.position.set(0,4,0);g.add(main);
  var mainRf=new THREE.Mesh(new THREE.ConeGeometry(6,6,4),roofM);mainRf.position.set(0,11,0);mainRf.rotation.y=Math.PI/4;g.add(mainRf);
  [[-7,0,4],[7,0,4]].forEach(function(pp){
    var t=new THREE.Mesh(new THREE.CylinderGeometry(1.8,2,9,8),wallM);t.position.set(pp[0],4.5,pp[2]);g.add(t);
    var tr=new THREE.Mesh(new THREE.ConeGeometry(2.2,4,8),roofM);tr.position.set(pp[0],10,pp[2]);g.add(tr);
  });
  [[-7,0,-4],[7,0,-4]].forEach(function(pp){
    var t=new THREE.Mesh(new THREE.CylinderGeometry(1.5,1.8,7,8),wallM);t.position.set(pp[0],3.5,pp[2]);g.add(t);
    var tr=new THREE.Mesh(new THREE.ConeGeometry(1.8,3.5,8),roofM);tr.position.set(pp[0],8,pp[2]);g.add(tr);
  });
  var ct=new THREE.Mesh(new THREE.CylinderGeometry(1,1.2,4,8),wallM);ct.position.set(0,10,0);g.add(ct);
  var ctr=new THREE.Mesh(new THREE.ConeGeometry(1.4,3,8),new THREE.MeshLambertMaterial({color:0x66aaff,emissive:new THREE.Color(0x3366cc),emissiveIntensity:.5}));ctr.position.set(0,13.5,0);g.add(ctr);
  var gate=new THREE.Mesh(new THREE.BoxGeometry(3,4,.3),gateM);gate.position.set(0,2,5.15);g.add(gate);
  var archM=new THREE.MeshLambertMaterial({color:0x6a6050});
  var arch=new THREE.Mesh(new THREE.TorusGeometry(1.5,.3,8,12,.5*Math.PI),archM);
  arch.position.set(0,4,5.15);arch.rotation.z=Math.PI;g.add(arch);
  var merlonM=new THREE.MeshLambertMaterial({color:0x7a7860});
  for(var mx=-5;mx<=5;mx+=2){
    var ml=new THREE.Mesh(new THREE.BoxGeometry(.8,.8,.8),merlonM);ml.position.set(mx,8.4,5);g.add(ml);
  }
  var stepM=new THREE.MeshLambertMaterial({color:0x706050});
  [0,1,2].forEach(function(i){
    var st=new THREE.Mesh(new THREE.BoxGeometry(4-i*.3,.3,1.2),stepM);st.position.set(0,.15+i*.3,5.8+i*1.0);g.add(st);
  });
  var castleLight=new THREE.PointLight(0xff8800,3,20);castleLight.position.set(0,3,3);g.add(castleLight);
  return g;
}

function mkFountain(){
  var g=new THREE.Group();
  var stoneM=new THREE.MeshLambertMaterial({color:0x888070});
  var waterM=new THREE.MeshLambertMaterial({color:0x44aaff,emissive:new THREE.Color(0x0055aa),emissiveIntensity:.3,transparent:true,opacity:.8});
  var outer=new THREE.Mesh(new THREE.CylinderGeometry(4,4.2,.6,16),stoneM);outer.position.set(0,.3,0);g.add(outer);
  var water=new THREE.Mesh(new THREE.CylinderGeometry(3.6,3.6,.3,16),waterM);water.position.set(0,.45,0);g.add(water);
  var pillar=new THREE.Mesh(new THREE.CylinderGeometry(.3,.4,2.5,8),stoneM);pillar.position.set(0,1.25,0);g.add(pillar);
  var topM=new THREE.MeshLambertMaterial({color:0xccaa44,emissive:new THREE.Color(0x886600),emissiveIntensity:.4});
  var top=new THREE.Mesh(new THREE.ConeGeometry(.8,1.5,6),topM);top.position.set(0,3,0);g.add(top);
  var jetM=new THREE.MeshLambertMaterial({color:0x88ddff,emissive:new THREE.Color(0x0088cc),emissiveIntensity:.5,transparent:true,opacity:.6});
  [0,1,2,3].forEach(function(i){
    var a=i*Math.PI/2;
    var jet=new THREE.Mesh(new THREE.CylinderGeometry(.08,.12,1.8,6),jetM);
    jet.position.set(Math.cos(a)*.5,2.5+Math.sin(a)*.3,Math.sin(a)*.5);
    jet.rotation.z=Math.cos(a)*.4;jet.rotation.x=-Math.sin(a)*.4;
    g.add(jet);
  });
  var fLight=new THREE.PointLight(0x44aaff,.8,12);fLight.position.set(0,2,0);g.add(fLight);
  return g;
}

function mkStonePath(parent){
  var p=parent||scene;
  var pathM=new THREE.MeshLambertMaterial({color:0xb8a880});
  var darkM=new THREE.MeshLambertMaterial({color:0x907858});
  var mainPath=new THREE.Mesh(new THREE.PlaneGeometry(6,50),pathM);
  mainPath.rotation.x=-Math.PI/2;mainPath.position.set(0,.02,0);p.add(mainPath);
  var plaza=new THREE.Mesh(new THREE.CylinderGeometry(8,8,.05,32),pathM);
  plaza.position.set(0,.02,0);p.add(plaza);
  var crossL=new THREE.Mesh(new THREE.PlaneGeometry(10,5),pathM);
  crossL.rotation.x=-Math.PI/2;crossL.position.set(-11,.02,0);p.add(crossL);
  var crossR=new THREE.Mesh(new THREE.PlaneGeometry(10,5),pathM);
  crossR.rotation.x=-Math.PI/2;crossR.position.set(11,.02,0);p.add(crossR);
  for(var i=0;i<30;i++){
    var tile=new THREE.Mesh(new THREE.PlaneGeometry(.8+Math.random()*.4,.8+Math.random()*.4),darkM);
    tile.rotation.x=-Math.PI/2;
    tile.position.set((Math.random()-.5)*5,.025,6-i*1.5);
    p.add(tile);
  }
}

function mkWaterRiver(parent){
  var p=parent||scene;
  var riverM=new THREE.MeshLambertMaterial({color:0x2288cc,emissive:new THREE.Color(0x004488),emissiveIntensity:.2,transparent:true,opacity:.75});
  var rl=new THREE.Mesh(new THREE.PlaneGeometry(4,60),riverM);rl.rotation.x=-Math.PI/2;rl.position.set(-20,.08,-2);p.add(rl);
  var rr=new THREE.Mesh(new THREE.PlaneGeometry(4,60),riverM);rr.rotation.x=-Math.PI/2;rr.position.set(20,.08,-2);p.add(rr);
  var wl1=new THREE.PointLight(0x2288ff,.4,15);wl1.position.set(-20,1,-2);p.add(wl1);
  var wl2=new THREE.PointLight(0x2288ff,.4,15);wl2.position.set(20,1,-2);p.add(wl2);
}

/* ════════════ 지면 디테일 유틸 ════════════ */
function scatterGroundDetail(group,count,xRange,zRange,type,offX,offZ){
  offX=offX||0;offZ=offZ||0;
  for(var i=0;i<count;i++){
    var x=offX+(Math.random()-.5)*xRange*2;
    var z=offZ+(Math.random()-.5)*zRange*2;
    var m;
    if(type==='grass'){
      var gc=Math.random()>.5?0x2a5a18:0x3a6a28;
      m=new THREE.Mesh(new THREE.ConeGeometry(.08+Math.random()*.06,.3+Math.random()*.2,4),new THREE.MeshLambertMaterial({color:gc}));
      m.position.set(x,.15,z);
      m.rotation.y=Math.random()*Math.PI;m.rotation.z=(Math.random()-.5)*.3;
    } else if(type==='stone'){
      var sc=Math.random()>.5?0x666055:0x555045;
      var ss=.08+Math.random()*.12;
      m=new THREE.Mesh(new THREE.DodecahedronGeometry(ss,0),new THREE.MeshLambertMaterial({color:sc}));
      m.position.set(x,ss*.3,z);
      m.rotation.set(Math.random(),Math.random(),Math.random());
    } else if(type==='flower'){
      var fc=[0xffee44,0xffffff,0xcc88ff,0xff88aa,0x88ccff][Math.floor(Math.random()*5)];
      m=new THREE.Mesh(new THREE.SphereGeometry(.06+Math.random()*.04,5,5),new THREE.MeshLambertMaterial({color:fc,emissive:new THREE.Color(fc),emissiveIntensity:.15}));
      m.position.set(x,.08,z);
    }
    if(m)group.add(m);
  }
}

/* ════════════ 타일맵 지형 빌드 ════════════ */
function buildTileMap(mapData){
  var tiles=mapData.tiles;
  var tc=mapData.terrainConfig;
  heightMap=new Float32Array(MAP_ROWS*MAP_COLS);

  /* 지형 타입별 머티리얼 캐시 */
  var matCache={};
  function getTerrainMat(type){
    if(matCache[type])return matCache[type];
    var cfg=tc[type];
    var c=parseInt(cfg.color.replace('#',''),16);
    var mat;
    if(cfg.animated){
      mat=new THREE.MeshLambertMaterial({color:c,emissive:new THREE.Color(c),emissiveIntensity:.15,transparent:true,opacity:.85});
    } else {
      mat=new THREE.MeshLambertMaterial({color:c});
    }
    matCache[type]=mat;
    return mat;
  }

  /* 각 타일을 BoxGeometry로 생성 */
  for(var row=0;row<MAP_ROWS;row++){
    for(var col=0;col<MAP_COLS;col++){
      var type=tiles[row][col];
      var cfg=tc[type];
      if(!cfg)continue;
      var h=cfg.height;
      var tileH=Math.max(0.1,h*0.5); // 시각 높이 스케일링
      heightMap[row*MAP_COLS+col]=h*0.5;

      var wp=tileToWorld(col,row);
      var mat=getTerrainMat(type);
      var box=new THREE.Mesh(new THREE.BoxGeometry(TILE_SIZE,tileH,TILE_SIZE),mat);
      box.position.set(wp.x,tileH/2-0.05,wp.z);
      scene.add(box);

      /* 바다/호수 타일은 수면 이펙트 추가 */
      if(type==='ocean'||type==='lake'){
        /* 약간 랜덤한 수면 반짝임 */
        if(Math.random()<0.05){
          var sparkM=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.15});
          var spark=new THREE.Mesh(new THREE.PlaneGeometry(1+Math.random()*2,.5+Math.random()),sparkM);
          spark.rotation.x=-Math.PI/2;spark.position.set(wp.x+(Math.random()-.5)*4,tileH+.02,wp.z+(Math.random()-.5)*4);
          scene.add(spark);
        }
      }

      /* 타일별 장식물 배치 */
      if(type==='forest'){
        /* 숲 타일에 나무 2~4그루 */
        var treeCount=2+Math.floor(Math.random()*3);
        for(var ti=0;ti<treeCount;ti++){
          var tx=wp.x+(Math.random()-.5)*4;
          var tz=wp.z+(Math.random()-.5)*4;
          mkTree(tx,tz,.8+Math.random()*.7,scene);
        }
        /* 약간의 풀 */
        scatterGroundDetail(scene,4,2,2,'grass',wp.x,wp.z);
      }
      else if(type==='dark_forest'){
        /* 어두운 숲 — 더 큰 나무, 더 빽빽 */
        var dkTreeCount=3+Math.floor(Math.random()*3);
        for(var dti=0;dti<dkTreeCount;dti++){
          var dtx=wp.x+(Math.random()-.5)*4;
          var dtz=wp.z+(Math.random()-.5)*4;
          /* 어두운 색 나무 */
          var dg=new THREE.Group();
          var dtm=new THREE.MeshLambertMaterial({color:0x1a1005});
          var dlm=new THREE.MeshLambertMaterial({color:0x0a2008});
          var ds=1.2+Math.random()*1.0;
          var dTrunk=new THREE.Mesh(new THREE.CylinderGeometry(.2,.3,2.5*ds,7),dtm);dTrunk.position.set(0,1.25*ds,0);dg.add(dTrunk);
          var dL1=new THREE.Mesh(new THREE.ConeGeometry(1.8*ds,3*ds,8),dlm);dL1.position.set(0,3.2*ds,0);dg.add(dL1);
          dg.position.set(dtx,0,dtz);scene.add(dg);
        }
        /* 붉은 파티클 */
        if(Math.random()<0.3){
          var redP=new THREE.Mesh(new THREE.SphereGeometry(.04,4,4),new THREE.MeshBasicMaterial({color:0xff2200,transparent:true,opacity:.5}));
          redP.position.set(wp.x+(Math.random()-.5)*4,1+Math.random()*2,wp.z+(Math.random()-.5)*4);
          scene.add(redP);
        }
      }
      else if(type==='mountain'){
        /* 산 — 바위 */
        var rockCount=1+Math.floor(Math.random()*2);
        var rockM=new THREE.MeshLambertMaterial({color:0x5a4a3a});
        for(var ri=0;ri<rockCount;ri++){
          var rs=.6+Math.random()*1.2;
          var rock=new THREE.Mesh(new THREE.DodecahedronGeometry(rs,0),rockM);
          rock.position.set(wp.x+(Math.random()-.5)*3,tileH+rs*.4,wp.z+(Math.random()-.5)*3);
          rock.rotation.y=Math.random()*Math.PI;scene.add(rock);
        }
      }
      else if(type==='highlands'){
        /* 고원 — 붉은 바위, 가을 나무 */
        if(Math.random()<0.4){
          var hRockM=new THREE.MeshLambertMaterial({color:0x8a4a3a});
          var hrs=.5+Math.random()*1.0;
          var hrock=new THREE.Mesh(new THREE.DodecahedronGeometry(hrs,0),hRockM);
          hrock.position.set(wp.x+(Math.random()-.5)*3,tileH+hrs*.3,wp.z+(Math.random()-.5)*3);
          scene.add(hrock);
        }
        if(Math.random()<0.3){
          /* 가을색 나무 */
          var ag=new THREE.Group();
          var as=.8+Math.random()*.6;
          var aTrunk=new THREE.Mesh(new THREE.CylinderGeometry(.15,.25,2*as,7),new THREE.MeshLambertMaterial({color:0x4a2a08}));
          aTrunk.position.set(0,as,0);ag.add(aTrunk);
          var aLeaf=new THREE.Mesh(new THREE.ConeGeometry(1.3*as,2.2*as,8),new THREE.MeshLambertMaterial({color:0xcc4422}));
          aLeaf.position.set(0,2.6*as,0);ag.add(aLeaf);
          ag.position.set(wp.x+(Math.random()-.5)*3,0,wp.z+(Math.random()-.5)*3);
          scene.add(ag);
        }
      }
      else if(type==='desert'){
        /* 사막 — 선인장 */
        if(Math.random()<0.15){
          var cg=new THREE.Group();
          var cacM=new THREE.MeshLambertMaterial({color:0x2a6a22});
          var cMain=new THREE.Mesh(new THREE.CylinderGeometry(.15,.2,1.5+Math.random(),7),cacM);
          cMain.position.set(0,.75,0);cg.add(cMain);
          /* 가지 */
          if(Math.random()<0.5){
            var branch=new THREE.Mesh(new THREE.CylinderGeometry(.08,.1,.6,6),cacM);
            branch.position.set(.3,1,0);branch.rotation.z=-0.5;cg.add(branch);
          }
          cg.position.set(wp.x+(Math.random()-.5)*4,0,wp.z+(Math.random()-.5)*4);
          scene.add(cg);
        }
        /* 돌 */
        scatterGroundDetail(scene,1,2,2,'stone',wp.x,wp.z);
      }
      else if(type==='snow'){
        /* 설원 — 눈 원뿔 */
        if(Math.random()<0.12){
          var snowM=new THREE.MeshLambertMaterial({color:0xe8f0f8});
          var snowCone=new THREE.Mesh(new THREE.ConeGeometry(.5+Math.random()*.8,1+Math.random()*2,8),snowM);
          snowCone.position.set(wp.x+(Math.random()-.5)*4,tileH+.5,wp.z+(Math.random()-.5)*4);
          scene.add(snowCone);
        }
        /* 소나무 */
        if(Math.random()<0.1){
          var pg=new THREE.Group();
          var ps=.7+Math.random()*.5;
          var pTrunk=new THREE.Mesh(new THREE.CylinderGeometry(.12,.2,1.5*ps,6),new THREE.MeshLambertMaterial({color:0x2a1a08}));
          pTrunk.position.set(0,.75*ps,0);pg.add(pTrunk);
          var pLeaf=new THREE.Mesh(new THREE.ConeGeometry(.8*ps,2*ps,7),new THREE.MeshLambertMaterial({color:0x1a4a28}));
          pLeaf.position.set(0,2.2*ps,0);pg.add(pLeaf);
          /* 눈 덮힌 효과 */
          var pSnow=new THREE.Mesh(new THREE.ConeGeometry(.6*ps,.4*ps,7),snowM);
          pSnow.position.set(0,3*ps,0);pg.add(pSnow);
          pg.position.set(wp.x+(Math.random()-.5)*3,tileH,wp.z+(Math.random()-.5)*3);
          scene.add(pg);
        }
      }
      else if(type==='volcano'){
        /* 화산 — 용암 균열 */
        if(Math.random()<0.2){
          var crackM=new THREE.MeshBasicMaterial({color:0xff2200,transparent:true,opacity:.4});
          var cLen=1+Math.random()*3;
          var crack=new THREE.Mesh(new THREE.PlaneGeometry(.15,cLen),crackM);
          crack.rotation.x=-Math.PI/2;crack.rotation.z=Math.random()*Math.PI;
          crack.position.set(wp.x+(Math.random()-.5)*4,tileH+.02,wp.z+(Math.random()-.5)*4);
          scene.add(crack);
        }
        /* 화산 바위 */
        if(Math.random()<0.15){
          var volcRM=new THREE.MeshLambertMaterial({color:0x1a0800});
          var vrs=.5+Math.random()*1;
          var vr=new THREE.Mesh(new THREE.DodecahedronGeometry(vrs,0),volcRM);
          vr.position.set(wp.x+(Math.random()-.5)*3,tileH+vrs*.3,wp.z+(Math.random()-.5)*3);
          scene.add(vr);
        }
        /* 연기 */
        if(Math.random()<0.08){
          var smokeM=new THREE.MeshLambertMaterial({color:0x1a0a00,transparent:true,opacity:.2});
          var smokeS=new THREE.Mesh(new THREE.SphereGeometry(.3+Math.random()*.5,5,5),smokeM);
          smokeS.position.set(wp.x+(Math.random()-.5)*3,tileH+2+Math.random()*3,wp.z+(Math.random()-.5)*3);
          scene.add(smokeS);
        }
      }
      else if(type==='wetland'){
        /* 습지 — 도깨비불, 독 버섯 */
        if(Math.random()<0.08){
          var wispM=new THREE.MeshBasicMaterial({color:0x44ff66,transparent:true,opacity:.6});
          var wisp=new THREE.Mesh(new THREE.SphereGeometry(.06+Math.random()*.04,6,6),wispM);
          wisp.position.set(wp.x+(Math.random()-.5)*4,.8+Math.random()*1.5,wp.z+(Math.random()-.5)*4);
          scene.add(wisp);
          var wl=new THREE.PointLight(0x33ff44,.2,3);wl.position.set(wisp.position.x,wisp.position.y,wisp.position.z);scene.add(wl);
        }
        /* 죽은 나무 */
        if(Math.random()<0.1){
          var deadM=new THREE.MeshLambertMaterial({color:0x1a1205});
          var dTrunk=new THREE.Mesh(new THREE.CylinderGeometry(.12,.25,2+Math.random()*1.5,6),deadM);
          dTrunk.position.set(wp.x+(Math.random()-.5)*3,1,wp.z+(Math.random()-.5)*3);
          dTrunk.rotation.z=(Math.random()-.5)*.3;scene.add(dTrunk);
        }
      }
      else if(type==='water_city'){
        /* 조라의 마을 — 반짝이는 기둥 */
        if(Math.random()<0.15){
          var pillarM=new THREE.MeshLambertMaterial({color:0x00bcd4,emissive:new THREE.Color(0x006688),emissiveIntensity:.4});
          var pillar=new THREE.Mesh(new THREE.CylinderGeometry(.2,.3,2+Math.random()*2,8),pillarM);
          pillar.position.set(wp.x+(Math.random()-.5)*3,tileH+1,wp.z+(Math.random()-.5)*3);
          scene.add(pillar);
        }
      }
      else if(type==='plains'){
        /* 초원 — 잔디, 꽃 */
        if(Math.random()<0.2){
          scatterGroundDetail(scene,2,2,2,'grass',wp.x,wp.z);
        }
        if(Math.random()<0.1){
          scatterGroundDetail(scene,1,2,2,'flower',wp.x,wp.z);
        }
      }
      else if(type==='beach'){
        /* 해변 — 조개 느낌 돌 */
        if(Math.random()<0.05){
          scatterGroundDetail(scene,1,2,2,'stone',wp.x,wp.z);
        }
      }
    }
  }
}

/* ════════════ 랜드마크 빌드 ════════════ */
function buildLandmarks(mapData){
  var landmarks=mapData.landmarks;
  if(!landmarks)return;

  landmarks.forEach(function(lm){
    var wp=tileToWorld(lm.x,lm.y);
    var tc=mapData.terrainConfig;
    var tileType=mapData.tiles[lm.y][lm.x];
    var baseH=tc[tileType]?tc[tileType].height*0.5:0;

    if(lm.icon==='castle'){
      /* 하이랄 성 — mkCastle 사용, 이곳이 마을 중심 */
      /* 마을 빌드는 buildVillage에서 별도 처리 */
    }
    else if(lm.icon==='volcano'){
      /* 죽음의 산 정상 — 거대 화산 */
      var volcG=new THREE.Group();
      var volcM=new THREE.MeshLambertMaterial({color:0x3a1a08});
      var volcCone=new THREE.Mesh(new THREE.ConeGeometry(8,12,10),volcM);volcCone.position.set(0,6,0);volcG.add(volcCone);
      var craterM=new THREE.MeshLambertMaterial({color:0xff3300,emissive:new THREE.Color(0xff1100),emissiveIntensity:.7});
      var crater=new THREE.Mesh(new THREE.CylinderGeometry(3,2,.5,10),craterM);crater.position.set(0,12,0);volcG.add(crater);
      var vLight=new THREE.PointLight(0xff4400,2,25);vLight.position.set(0,13,0);volcG.add(vLight);
      /* 연기 */
      var smkM=new THREE.MeshLambertMaterial({color:0x1a0a00,transparent:true,opacity:.25});
      for(var si=0;si<5;si++){
        var smk=new THREE.Mesh(new THREE.SphereGeometry(.6+Math.random()*.5,5,5),smkM);
        smk.position.set((Math.random()-.5)*2,13+si*1.5,(Math.random()-.5)*2);volcG.add(smk);
      }
      volcG.position.set(wp.x,baseH,wp.z);scene.add(volcG);
    }
    else if(lm.icon==='palace'){
      /* 조라의 궁전 — 수중 스타일 큰 건물 */
      var palG=new THREE.Group();
      var palM=new THREE.MeshLambertMaterial({color:0x00bcd4,emissive:new THREE.Color(0x006688),emissiveIntensity:.4});
      var palBase=new THREE.Mesh(new THREE.CylinderGeometry(5,6,4,12),palM);palBase.position.set(0,2,0);palG.add(palBase);
      var palTower=new THREE.Mesh(new THREE.CylinderGeometry(2,3,8,10),palM);palTower.position.set(0,8,0);palG.add(palTower);
      var palTop=new THREE.Mesh(new THREE.ConeGeometry(3,5,10),new THREE.MeshLambertMaterial({color:0x44ddee,emissive:new THREE.Color(0x2299aa),emissiveIntensity:.5}));
      palTop.position.set(0,14,0);palG.add(palTop);
      var palL=new THREE.PointLight(0x00ccdd,1.5,20);palL.position.set(0,10,0);palG.add(palL);
      palG.position.set(wp.x,baseH,wp.z);scene.add(palG);
    }
    else if(lm.icon==='town'){
      /* 겔드 마을 — 사막 건물 */
      var townG=new THREE.Group();
      mkBldg(0,0,6,4,5,0xd4a460,0xc4944a,townG);
      mkBldg(-8,3,4,3,4,0xccaa66,0xbb9944,townG);
      mkBldg(8,-2,5,3.5,4,0xd4a460,0xc4944a,townG);
      var tLight=new THREE.PointLight(0xffaa44,.6,15);tLight.position.set(0,4,0);townG.add(tLight);
      townG.position.set(wp.x,baseH,wp.z);scene.add(townG);
    }
    else if(lm.icon==='village'){
      /* 리토 마을 — 눈 속 작은 마을 */
      var vilG=new THREE.Group();
      mkBldg(0,0,5,3.5,4,0xaabbcc,0x6688aa,vilG);
      mkBldg(-6,2,3.5,3,3,0x99aabb,0x558899,vilG);
      mkBldg(6,-1,4,3,3.5,0xaabbcc,0x6688aa,vilG);
      var vLight2=new THREE.PointLight(0xffeedd,.5,12);vLight2.position.set(0,4,0);vilG.add(vLight2);
      vilG.position.set(wp.x,baseH,wp.z);scene.add(vilG);
    }
    else if(lm.icon==='forest'){
      /* 미혹의 숲 입구 — 거대 나무 */
      var giantG=new THREE.Group();
      var gTrunk=new THREE.MeshLambertMaterial({color:0x2a1805});
      var gLeaf=new THREE.MeshLambertMaterial({color:0x0a3008,emissive:new THREE.Color(0x001a00),emissiveIntensity:.3});
      var gt=new THREE.Mesh(new THREE.CylinderGeometry(.6,.9,8,8),gTrunk);gt.position.set(0,4,0);giantG.add(gt);
      var gl1=new THREE.Mesh(new THREE.ConeGeometry(4,6,10),gLeaf);gl1.position.set(0,10,0);giantG.add(gl1);
      var gl2=new THREE.Mesh(new THREE.ConeGeometry(3,5,10),gLeaf);gl2.position.set(0,14,0);giantG.add(gl2);
      var gLight=new THREE.PointLight(0x22ff44,.3,10);gLight.position.set(0,6,0);giantG.add(gLight);
      giantG.position.set(wp.x,baseH,wp.z);scene.add(giantG);
    }
    else if(lm.icon==='bridge'){
      /* 하이리아 대교 — 다리 구조물 */
      var brG=new THREE.Group();
      var brM=new THREE.MeshLambertMaterial({color:0x706050});
      var deck=new THREE.Mesh(new THREE.BoxGeometry(3,0.4,18),brM);deck.position.set(0,1.5,0);brG.add(deck);
      var rail1=new THREE.Mesh(new THREE.BoxGeometry(.2,1.2,18),brM);rail1.position.set(-1.4,2.2,0);brG.add(rail1);
      var rail2=new THREE.Mesh(new THREE.BoxGeometry(.2,1.2,18),brM);rail2.position.set(1.4,2.2,0);brG.add(rail2);
      /* 교각 */
      for(var pi=-6;pi<=6;pi+=6){
        var pillar=new THREE.Mesh(new THREE.BoxGeometry(.8,3,.8),brM);pillar.position.set(0,0,pi);brG.add(pillar);
      }
      brG.position.set(wp.x,baseH,wp.z);scene.add(brG);
    }
    else if(lm.icon==='tower'){
      /* 아카라 탑 */
      var towG=new THREE.Group();
      var towM=new THREE.MeshLambertMaterial({color:0x8a6a4a});
      var towBody=new THREE.Mesh(new THREE.CylinderGeometry(1.5,2,10,8),towM);towBody.position.set(0,5,0);towG.add(towBody);
      var towTop=new THREE.Mesh(new THREE.ConeGeometry(2.5,4,8),new THREE.MeshLambertMaterial({color:0xcc6644}));towTop.position.set(0,12,0);towG.add(towTop);
      var towL=new THREE.PointLight(0xff8844,.8,15);towL.position.set(0,11,0);towG.add(towL);
      towG.position.set(wp.x,baseH,wp.z);scene.add(towG);
    }
  });
}

/* ════════════ 마을 빌드 (성 랜드마크 주변) ════════════ */
function buildVillage(mapData){
  /* 마을 중심 = hyrule_castle 랜드마크 위치 (타일 10,10) */
  var castleLM=null;
  if(mapData&&mapData.landmarks){
    castleLM=mapData.landmarks.find(function(l){return l.id==='hyrule_castle';});
  }
  var vc=castleLM?tileToWorld(castleLM.x,castleLM.y):{x:0,z:0};
  var vx=vc.x, vz=vc.z;

  /* 지면 디테일 (마을 주변) */
  scatterGroundDetail(scene,60,20,20,'grass',vx,vz);
  scatterGroundDetail(scene,30,18,18,'stone',vx,vz);
  scatterGroundDetail(scene,25,16,16,'flower',vx,vz);

  /* 조명 — 따뜻한 앰버 톤 */
  var fbl=new THREE.PointLight(0xffaa44,.5,25);fbl.position.set(vx,3,vz);scene.add(fbl);
  var warmAmb=new THREE.PointLight(0xffcc66,.3,40);warmAmb.position.set(vx,8,vz+8);scene.add(warmAmb);

  /* 반투명 안개 평면 (지면 레벨) */
  var fogPlaneM=new THREE.MeshLambertMaterial({color:0xaabb88,transparent:true,opacity:.06});
  [[-8,0,5],[8,0,-7],[0,0,10],[-12,0,0]].forEach(function(fp){
    var fogP=new THREE.Mesh(new THREE.PlaneGeometry(12+Math.random()*6,10+Math.random()*5),fogPlaneM);
    fogP.rotation.x=-Math.PI/2;fogP.position.set(vx+fp[0],.15,vz+fp[2]);scene.add(fogP);
  });

  /* 구조물 — 그룹으로 묶어 마을 중심에 배치 */
  var villStructs=new THREE.Group();
  mkStonePath(villStructs);
  mkWaterRiver(villStructs);
  villStructs.position.set(vx,0,vz);
  scene.add(villStructs);

  /* 분수 */
  var fountainG=mkFountain();
  fountainG.position.set(vx,0,vz);
  scene.add(fountainG);

  /* 성 */
  var castleG=mkCastle();
  castleG.position.set(vx,0,vz-22);
  scene.add(castleG);

  /* 상점 */
  mkStall(vx-14,vz+2, .3, 0x8a3a10,0xcc5522,'업그레이드',scene);
  mkStall(vx-14,vz-5,.2, 0x1a4a8a,0x3366cc,'아이템',scene);
  mkStall(vx+14,vz+2, -.3, 0x3a6a10,0x558833,'퀘스트',scene);
  mkStall(vx+14,vz-5,-.2, 0x8a4a1a,0xcc8833,'무기점',scene);
  mkStall(vx-6,vz-10,.15, 0x6a1a1a,0xaa3333,'포션',scene);
  mkStall(vx+6,vz-10,-.15, 0x1a4a2a,0x336644,'방어구',scene);

  /* 횃불 */
  var torchPos=[[vx-7,vz+7,1],[vx+7,vz+7,1],[vx-7,vz-7,1],[vx+7,vz-7,1],[vx-1,vz-11,1],[vx+1,vz-11,1]];
  var poleMat=new THREE.MeshLambertMaterial({color:0x3a2a10});
  var fireMat=new THREE.MeshBasicMaterial({color:0xff8820});
  torchPos.forEach(function(tp){
    var pl=new THREE.PointLight(0xff8830,1.8,12);pl.position.set(tp[0],2.2,tp[2]);scene.add(pl);
    var pole=new THREE.Mesh(new THREE.CylinderGeometry(.06,.08,2,6),poleMat);pole.position.set(tp[0],1,tp[2]);scene.add(pole);
    var fire=new THREE.Mesh(new THREE.SphereGeometry(.13,8,8),fireMat);fire.position.set(tp[0],2.2,tp[2]);scene.add(fire);
  });

  /* 마을 나무 (마을 중심 상대 좌표) */
  var treeLayout=[
    [-16,5],[-18,-2],[-17,-8],[-16,-16],[-18,-22],[-15,-26],
    [16,5],[18,-2],[17,-8],[16,-16],[18,-22],[15,-26],
    [-10,10],[-5,13],[0,14],[5,13],[10,10],
    [-12,7],[12,7],
    [-12,-30],[-8,-32],[0,-34],[8,-32],[12,-30],
    [-20,-18],[-22,-10],[20,-18],[22,-10],
  ];
  treeLayout.forEach(function(pp){mkTree(vx+pp[0],vz+pp[1],.8+Math.random()*.6,scene);});

  /* NPC */
  var lov=document.getElementById('lov');
  npcs=[];
  NPC_DEF.forEach(function(def){
    var h=mkHuman(def.bc,def.hc);
    /* NPC 위치를 마을 중심 기준으로 오프셋 */
    h.group.position.set(vx+def.px,0,vz+def.pz);
    h.group.rotation.y=Math.random()*Math.PI*2;
    scene.add(h.group);
    var ne=document.createElement('div');ne.className='llabel npc';ne.textContent=def.name;lov.appendChild(ne);
    var ie=document.createElement('div');ie.className='linteract';ie.textContent='E 대화';lov.appendChild(ie);
    npcs.push({name:def.name,px:vx+def.px,pz:vz+def.pz,bc:def.bc,hc:def.hc,mesh:h.group,nameEl:ne,intEl:ie,bobOff:Math.random()*Math.PI*2});
  });

  /* 건물 이름표 */
  [{x:vx,y:17,z:vz-22,n:'성'},{x:vx-14,y:5,z:vz+2,n:'업그레이드'},{x:vx+14,y:5,z:vz+2,n:'퀘스트'},{x:vx-14,y:5,z:vz-5,n:'아이템'},{x:vx+14,y:5,z:vz-5,n:'무기점'}]
  .forEach(function(b){
    var el=document.createElement('div');el.className='llabel bld';el.textContent=b.n;
    el.dataset.wx=b.x;el.dataset.wy=b.y;el.dataset.wz=b.z;lov.appendChild(el);
  });

  /* WORLD_SPAWN 업데이트 (분수 옆) */
  WORLD_SPAWN[0]=vx+5;
  WORLD_SPAWN[1]=vz+5;

  /* 콜라이더 초기화 */
  if(typeof initVillageColliders==='function') initVillageColliders(vx,vz);
}

/* ════════════ 타일맵 기반 몬스터 스폰 ════════════ */
function spawnTileMapMonsters(mapData){
  var tiles=mapData.tiles;
  /* 지형 타입 → 몬스터 매핑 */
  var terrainMonsters={
    plains:['rabbit','deer'],
    forest:['rabbit','deer'],
    wetland:['slime','toad'],
    dark_forest:['goblin','wolf'],
    mountain:['goblin','wolf'],
    highlands:['goblin','wolf'],
    volcano:['golem','firedrake'],
    snow:['slime','goblin'],
    desert:['deer','toad']
  };
  /* 타일 순회, 스폰 확률로 몬스터 배치 */
  for(var row=0;row<MAP_ROWS;row++){
    for(var col=0;col<MAP_COLS;col++){
      var type=tiles[row][col];
      var monList=terrainMonsters[type];
      if(!monList)continue;
      /* 스폰 확률 — 너무 많지 않게 */
      var spawnChance=0.22;
      if(type==='dark_forest'||type==='volcano')spawnChance=0.30;
      if(type==='plains'||type==='forest')spawnChance=0.18;
      if(type==='beach'||type==='snow')spawnChance=0.12;

      if(Math.random()<spawnChance){
        /* 마을 영역(성 주변)은 몬스터 스킵 */
        var wp=tileToWorld(col,row);
        /* 하이랄 성 주변 반경 30 유닛 스킵 */
        var castleWP=tileToWorld(10,10);
        var dx=wp.x-castleWP.x,dz=wp.z-castleWP.z;
        if(Math.sqrt(dx*dx+dz*dz)<30)continue;

        var monId=monList[Math.floor(Math.random()*monList.length)];
        var def=MONSTER_DEFS.find(function(d){return d.id===monId;});
        if(def){
          var sx=wp.x+(Math.random()-.5)*4;
          var sz=wp.z+(Math.random()-.5)*4;
          spawnMonster(def,sx,sz,scene);
        }
      }
    }
  }
}

/* ════════════ initScene ════════════ */
function initScene(){
  var canvas=document.getElementById('gc');
  renderer=new THREE.WebGLRenderer({canvas:canvas,antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  scene=new THREE.Scene();
  scene.background=new THREE.Color(0x0a1510);
  scene.fog=new THREE.Fog(0x0a1510,50,160);
  camera=new THREE.PerspectiveCamera(60,1,.1,400);
  camera.position.set(0,10,18);

  /* 전역 조명 */
  scene.add(new THREE.AmbientLight(0x88aa66,.3));
  var sun=new THREE.DirectionalLight(0xffeebb,.6);sun.position.set(-30,80,30);scene.add(sun);

  /* 달 + 별 */
  var moon=new THREE.Mesh(new THREE.SphereGeometry(6,16,16),new THREE.MeshBasicMaterial({color:0xfffde8}));
  moon.position.set(-80,120,-150);scene.add(moon);
  var moonL=new THREE.PointLight(0xddeeff,.3,200);moonL.position.set(-80,120,-150);scene.add(moonL);

  var STAR_COUNT=4000,sp=new Float32Array(STAR_COUNT*3);
  for(var i=0;i<STAR_COUNT;i++){
    var th=Math.random()*Math.PI*2,ph=Math.acos(2*Math.random()-1)*0.45,r=250;
    sp[i*3]=r*Math.sin(ph)*Math.cos(th);sp[i*3+1]=r*Math.abs(Math.cos(ph))+5;sp[i*3+2]=r*Math.sin(ph)*Math.sin(th);
  }
  var sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.BufferAttribute(sp,3));
  scene.add(new THREE.Points(sg,new THREE.PointsMaterial({color:0xffffff,size:.3,sizeAttenuation:true})));

  /* 타일맵 데이터 로드 */
  fetch('data/world-map.json')
  .then(function(res){return res.json();})
  .then(function(mapData){
    tileMapData=mapData;

    /* 타일맵 지형 빌드 */
    buildTileMap(mapData);

    /* 랜드마크 빌드 */
    buildLandmarks(mapData);

    /* 마을 건물/NPC (성 주변) */
    buildVillage(mapData);

    /* 몬스터 스폰 */
    monsters=[];closestMonster=null;
    spawnTileMapMonsters(mapData);

    /* 플레이어 */
    var ph2=mkHuman(0x2a6a3a,0xddcc99);
    PL.group=ph2.group;PL.legL=ph2.legL;PL.legR=ph2.legR;
    PL.armL=ph2.armL;PL.armR=ph2.armR;PL.armRPivot=ph2.armRPivot;
    PL.weaponMesh=null;PL.bobT=0;PL.atkAnim=0;PL.atkPhase=0;
    var ws=WORLD_SPAWN;PL.group.position.set(ws[0],0,ws[1]);scene.add(PL.group);

    /* 플레이어 이름표 */
    var lov=document.getElementById('lov');
    var ple=document.createElement('div');ple.className='llabel plr';ple.id='ple';ple.textContent=myName;lov.appendChild(ple);

    setupInput();onResize();window.addEventListener('resize',onResize);

    /* 초기 존 배너 */
    currentZone='village';
    document.querySelector('.hloc').textContent='▸ 시작 마을';

    renderer.setAnimationLoop(loop);
  })
  .catch(function(err){
    console.error('타일맵 로드 실패:',err);
    /* 폴백: 최소 씬 */
    var fallback=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshLambertMaterial({color:0x2a5a1a}));
    fallback.rotation.x=-Math.PI/2;scene.add(fallback);

    var ph2=mkHuman(0x2a6a3a,0xddcc99);
    PL.group=ph2.group;PL.legL=ph2.legL;PL.legR=ph2.legR;
    PL.armL=ph2.armL;PL.armR=ph2.armR;PL.armRPivot=ph2.armRPivot;
    PL.weaponMesh=null;PL.bobT=0;PL.atkAnim=0;PL.atkPhase=0;
    PL.group.position.set(0,0,0);scene.add(PL.group);

    var lov=document.getElementById('lov');
    var ple=document.createElement('div');ple.className='llabel plr';ple.id='ple';ple.textContent=myName;lov.appendChild(ple);

    setupInput();onResize();window.addEventListener('resize',onResize);
    currentZone='village';
    document.querySelector('.hloc').textContent='▸ 시작 마을';
    renderer.setAnimationLoop(loop);
  });
}

function onResize(){
  var c=document.getElementById('cc'),w=c.clientWidth,h=c.clientHeight;
  if(w>0&&h>0){renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}
}

function updCam(){
  var p=PL.group.position;
  var tx=p.x+14*Math.sin(cYaw)*Math.cos(cPitch);
  var ty=p.y+14*Math.sin(cPitch)+2.5;
  var tz=p.z+14*Math.cos(cYaw)*Math.cos(cPitch);
  var lr=.12;
  camera.position.x+=(tx-camera.position.x)*lr;
  camera.position.y+=(Math.max(ty,.6)-camera.position.y)*lr;
  camera.position.z+=(tz-camera.position.z)*lr;
  camera.lookAt(p.x,p.y+1.2,p.z);
}

function updNpcs(t){
  npcs.forEach(function(n){
    n.mesh.position.y=Math.sin(t*.9+n.bobOff)*.04;
    var dx=PL.group.position.x-n.mesh.position.x,dz=PL.group.position.z-n.mesh.position.z;
    if(Math.sqrt(dx*dx+dz*dz)<10){var tr=Math.atan2(dx,dz);n.mesh.rotation.y+=(tr-n.mesh.rotation.y)*.04;}
  });
}

function chkNpc(){
  closestNpc=null;var md=4.5;
  npcs.forEach(function(n){
    var dx=PL.group.position.x-n.mesh.position.x,dz=PL.group.position.z-n.mesh.position.z;
    var d=Math.sqrt(dx*dx+dz*dz);if(d<md){md=d;closestNpc=n;}
  });
}

/* changeZone — 호환성 유지용. 오픈월드에서는 playerDied에서 호출됨 */
function changeZone(zoneName){
  if(zoneName==='village'){
    PL.group.position.set(WORLD_SPAWN[0],0,WORLD_SPAWN[1]);
    playerHP=Math.min(playerMaxHP,playerHP+Math.floor(playerMaxHP*.25));
    updPlayerHpBar();
  }
  currentZone=zoneName;
}
