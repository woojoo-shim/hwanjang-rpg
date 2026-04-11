/* ════════════ 프롤로그 컷씬 ════════════ */
var _prologueShown=false;
var _prologueActive=false;
var _prologueSlide=0;
var _prologueCallback=null;

var PROLOGUE_SLIDES=[
  {text:'옛날엔\n이 세상에 아무것도 없었다.\n\n빛도, 어둠도, 시간도—\n\n그저 끝없이 펼쳐진\n고요한 공허뿐이었다.',bg:'#000000',color:'#555555',delay:0},
  {text:'그 공허는 움직이지 않았고,\n변하지도 않았으며,\n아무 의미도 가지지 않았다.',bg:'#000000',color:'#666666',delay:0},
  {text:'그러던 어느 날—\n\n그 침묵 속에서\n단 하나의 "존재"가 태어났다.\n\n작고, 검고, 불완전한 형체.',bg:'#050505',color:'#888888',delay:0},
  {text:'포 톤',bg:'#0a0a0a',color:'#c9a84c',size:48,delay:500},
  {text:'그는 이유 없이 존재했고,\n목적 없이 움직였다.\n\n하지만 그 순간부터—\n\n세상은 더 이상 공허가 아니게 되었다.',bg:'#0a0508',color:'#998877',delay:0},
  {text:'포톤이 움직일 때마다\n공허는 흔들렸다.\n\n그 흔들림은 파동이 되었고,\n파동은 형태가 되었다.',bg:'#0a0a10',color:'#8888aa',delay:0},
  {text:'빛이 태어나고\n어둠이 나뉘고\n시간이 흐르기 시작했다\n\n세계는 만들어졌다.',bg:'#101020',color:'#aaaacc',delay:0},
  {text:'하지만—\n\n포톤은 여전히 혼자였다.',bg:'#080810',color:'#887766',delay:0},
  {text:'그는 자신의 일부를 떼어내\n다른 존재들을 만들어냈다.\n\n그것이 바로\n지금의 생명체들이었다.',bg:'#101015',color:'#99aa88',delay:0},
  {text:'생명체들은 그를 두려워했다.\n\n"형태가 흐릿해…"\n"가까이 있으면 이상해져…"\n"저건… 우리랑 달라…"',bg:'#0c0808',color:'#aa7766',delay:0},
  {text:'포톤은 처음으로 알게 된다.\n\n자신이 \'같지 않다\'는 것',bg:'#0a0505',color:'#cc8866',delay:0},
  {text:'그래서 그들은 선택한다.\n\n"포톤은 위험하다"\n\n그를 격리해야 한다',bg:'#100505',color:'#cc5544',delay:0},
  {text:'첫 번째 용사가 나타났다.\n\n그는 유일하게\n포톤과 대화하려 했던 존재였다.\n\n"너는 틀린 존재가 아니야"',bg:'#0a0a15',color:'#8899cc',delay:0},
  {text:'하지만 그 말은—\n\n이미 늦었다.\n\n포톤은 이미\n너무 오랫동안 혼자였다.',bg:'#080808',color:'#777777',delay:0},
  {text:'세계의 중심에 \'심연\'을 만들고\n그 안에 포톤을 봉인했다.\n\n시간은 느려지고\n형태는 고정되며\n의식은 희미해진다',bg:'#050510',color:'#6666aa',delay:0},
  {text:'수천 년이 지나며\n사람들은 포톤을 잊었다.\n\n이야기는 신화가 되었고,\n신화는 전설이 되었으며,\n전설은 결국 사라졌다.',bg:'#0a0a0a',color:'#666666',delay:0},
  {text:'세계는 평화로웠다.\n\n—\n\n균열이 나타나기 전까지는.',bg:'#100808',color:'#aa6644',delay:0},
  {text:'균열 속에서 무언가가\n나오기 시작했다.\n\n형태가 끊어져 있고\n움직임이 어긋나며\n존재 자체가 불안정한 것들.',bg:'#150808',color:'#cc4433',delay:0},
  {text:'"그가 깨어날 때,\n세계는 다시 공허로 돌아간다"',bg:'#0a0005',color:'#ff4444',size:28,delay:0},
  {text:'그때 등장한 존재—\n\n균열에 영향을 받지 않는\n유일한 존재.',bg:'#0a0a15',color:'#aabbdd',delay:0},
  {text:'포톤을 막을 수 있는 건\n\n너뿐이다',bg:'#101020',color:'#c9a84c',size:36,delay:300},
  {text:'『 포 톤  R P G 』',bg:'#000000',color:'#c9a84c',size:52,delay:800}
];

function showPrologue(callback){
  if(localStorage.getItem('prologueSeen')){
    if(callback)callback();
    return;
  }
  _prologueActive=true;
  _prologueSlide=0;
  _prologueCallback=callback;

  var overlay=document.createElement('div');
  overlay.id='prologue-overlay';
  overlay.style.cssText='position:fixed;inset:0;z-index:99999;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;transition:background 1s;cursor:pointer;';

  var textEl=document.createElement('div');
  textEl.id='prologue-text';
  textEl.style.cssText='max-width:600px;text-align:center;font-size:18px;line-height:2;letter-spacing:2px;white-space:pre-line;opacity:0;transition:opacity 0.8s;padding:20px;font-family:inherit;';
  overlay.appendChild(textEl);

  var hint=document.createElement('div');
  hint.style.cssText='position:absolute;bottom:30px;color:#555;font-size:12px;letter-spacing:1px;';
  hint.textContent='클릭하여 계속...';
  overlay.appendChild(hint);

  var skipBtn=document.createElement('div');
  skipBtn.style.cssText='position:absolute;top:20px;right:30px;color:#555;font-size:13px;letter-spacing:1px;cursor:pointer;padding:8px 16px;border:1px solid #333;border-radius:4px;';
  skipBtn.textContent='SKIP ▸';
  skipBtn.addEventListener('click',function(e){
    e.stopPropagation();
    endPrologue();
  });
  overlay.appendChild(skipBtn);

  /* ── 배경: Three.js 3D 씬 + 2D 파티클 오버레이 ── */
  /* 3D 배경 캔버스 */
  var cvs3d=document.createElement('canvas');
  cvs3d.id='prologue-3d';
  cvs3d.style.cssText='position:absolute;inset:0;width:100%;height:100%;z-index:0;';
  overlay.insertBefore(cvs3d,textEl);

  /* 2D 파티클 오버레이 */
  var cvs=document.createElement('canvas');
  cvs.id='prologue-canvas';
  cvs.style.cssText='position:absolute;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;';
  overlay.insertBefore(cvs,textEl);
  textEl.style.position='relative';textEl.style.zIndex='1';

  /* Three.js 프롤로그 씬 */
  var _pScene=new THREE.Scene();
  var _pCam=new THREE.PerspectiveCamera(50,window.innerWidth/window.innerHeight,0.1,100);
  _pCam.position.set(0,2,5);_pCam.lookAt(0,1.5,0);
  var _pRenderer=new THREE.WebGLRenderer({canvas:cvs3d,antialias:true,alpha:true});
  _pRenderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  _pRenderer.setSize(window.innerWidth,window.innerHeight);
  _pRenderer.setClearColor(0x000000,0);

  /* 프롤로그 조명 */
  var _pAmb=new THREE.AmbientLight(0x111122,0.3);_pScene.add(_pAmb);
  var _pSpot=new THREE.PointLight(0x4444aa,0.5,20);_pSpot.position.set(0,4,3);_pScene.add(_pSpot);

  /* 포톤 모델들 (처음엔 숨김) */
  var _pNormal=null,_pCorrupted=null;
  if(typeof buildPhotonNormal==='function'){
    _pNormal=buildPhotonNormal(0,0,0);
    _pNormal.visible=false;
    _pScene.add(_pNormal);
  }
  if(typeof buildPhotonCorrupted==='function'){
    _pCorrupted=buildPhotonCorrupted(0,0,0);
    _pCorrupted.visible=false;
    _pScene.add(_pCorrupted);
  }

  /* 배경 별 파티클 (3D) */
  var starGeo=new THREE.BufferGeometry();
  var starVerts=[];
  for(var si=0;si<200;si++){
    starVerts.push((Math.random()-.5)*40,(Math.random()-.5)*20+5,(Math.random()-.5)*40-10);
  }
  starGeo.setAttribute('position',new THREE.Float32BufferAttribute(starVerts,3));
  var starMat=new THREE.PointsMaterial({color:0x8888aa,size:0.15,transparent:true,opacity:0.8});
  var starField=new THREE.Points(starGeo,starMat);
  _pScene.add(starField);

  var ctx2d=cvs.getContext('2d');
  var _pParts=[];
  var _pAnim=null;
  var _photonOrb={x:0,y:0,r:0,glow:0,active:false};

  function resizePCanvas(){
    cvs.width=window.innerWidth;cvs.height=window.innerHeight;
    _photonOrb.x=cvs.width/2;_photonOrb.y=cvs.height/2;
    if(_pRenderer){
      _pRenderer.setSize(window.innerWidth,window.innerHeight);
      _pCam.aspect=window.innerWidth/window.innerHeight;
      _pCam.updateProjectionMatrix();
    }
  }
  resizePCanvas();
  window.addEventListener('resize',resizePCanvas);

  /* 파티클 생성 */
  function spawnPart(x,y,vx,vy,life,size,color){
    _pParts.push({x:x,y:y,vx:vx,vy:vy,life:life,maxLife:life,size:size||1.5,color:color||'#ffffff'});
  }

  /* 슬라이드별 파티클 이벤트 */
  function onSlideChange(idx){
    var w=cvs.width,h=cvs.height;

    /* ── 3D 모델 표시 제어 ── */
    if(_pNormal)_pNormal.visible=false;
    if(_pCorrupted)_pCorrupted.visible=false;

    /* 슬라이드 3~8: 일반 포톤 등장 (창조~고독) */
    if(idx>=3&&idx<=8&&_pNormal){
      _pNormal.visible=true;
      _pNormal.position.set(0,0,0);
      _pCam.position.set(0,2,4);_pCam.lookAt(0,1.5,0);
      _pAmb.intensity=0.4;_pSpot.color.set(0x6666cc);_pSpot.intensity=0.6;
    }
    /* 슬라이드 9~11: 일반 포톤 (거부/고독) — 더 어둡게, 멀어지는 */
    if(idx>=9&&idx<=11&&_pNormal){
      _pNormal.visible=true;
      _pNormal.position.set(0,0,-1);
      _pCam.position.set(0,2,6);_pCam.lookAt(0,1.5,-1);
      _pAmb.intensity=0.2;_pSpot.color.set(0x442222);_pSpot.intensity=0.3;
    }
    /* 슬라이드 12~15: 봉인 — 포톤이 작아지며 사라짐 */
    if(idx>=12&&idx<=15&&_pNormal){
      _pNormal.visible=true;
      var shrink=1.0-(idx-12)*0.25;
      _pNormal.scale.set(shrink,shrink,shrink);
      _pNormal.position.set(0,-0.5*(1-shrink),0);
      _pAmb.intensity=0.15;_pSpot.color.set(0x222244);_pSpot.intensity=0.2;
    }
    /* 슬라이드 17~20: 균열 — 타락 포톤 등장 */
    if(idx>=17&&idx<=20&&_pCorrupted){
      _pCorrupted.visible=true;
      var emerge=(idx-17)/3;
      _pCorrupted.position.set(0,-2+emerge*2,0);
      _pCorrupted.scale.set(0.5+emerge*0.5,0.5+emerge*0.5,0.5+emerge*0.5);
      _pCam.position.set(0,3,7);_pCam.lookAt(0,2,0);
      _pAmb.intensity=0.1;_pSpot.color.set(0xff2200);_pSpot.intensity=0.8;
    }
    /* 슬라이드 21: 타이틀 — 타락 포톤 풀사이즈 */
    if(idx===21&&_pCorrupted){
      _pCorrupted.visible=true;
      _pCorrupted.position.set(0,0,0);
      _pCorrupted.scale.set(1,1,1);
      _pCam.position.set(0,4,8);_pCam.lookAt(0,2.5,0);
      _pAmb.intensity=0.05;_pSpot.color.set(0xff0000);_pSpot.intensity=1.0;
    }

    if(idx===0){
      /* 공허 — 느린 먼지 */
      for(var i=0;i<30;i++)spawnPart(Math.random()*w,Math.random()*h,(Math.random()-.5)*.2,(Math.random()-.5)*.2,8+Math.random()*5,1,'#333333');
    }
    if(idx===3){
      /* 포톤 등장 — 중앙 오브 + 폭발 */
      _photonOrb.active=true;_photonOrb.r=0;_photonOrb.glow=0;
      for(var j=0;j<50;j++){
        var a=Math.random()*Math.PI*2;
        spawnPart(w/2,h/2,Math.cos(a)*(1+Math.random()*2),Math.sin(a)*(1+Math.random()*2),3+Math.random()*2,2,'#c9a84c');
      }
    }
    if(idx===5||idx===6){
      /* 창조 — 빛 파티클 사방으로 */
      for(var k=0;k<40;k++){
        var a2=Math.random()*Math.PI*2;
        spawnPart(w/2,h/2,Math.cos(a2)*(2+Math.random()*3),Math.sin(a2)*(2+Math.random()*3),4+Math.random()*3,2.5,['#88aaff','#aaccff','#ffddaa'][Math.floor(Math.random()*3)]);
      }
    }
    if(idx===9||idx===10){
      /* 거부 — 빨간 파티클 흩어짐 */
      for(var l=0;l<25;l++)spawnPart(Math.random()*w,Math.random()*h,(Math.random()-.5)*3,(Math.random()-.5)*3,3,2,'#cc4433');
    }
    if(idx===11||idx===12){
      /* 봉인 — 파티클이 중앙으로 수렴 */
      for(var m=0;m<35;m++){
        var sx=Math.random()*w,sy=Math.random()*h;
        var dx2=w/2-sx,dy2=h/2-sy,dl=Math.sqrt(dx2*dx2+dy2*dy2)||1;
        spawnPart(sx,sy,dx2/dl*2,dy2/dl*2,3+Math.random()*2,2,'#6666cc');
      }
    }
    if(idx===14||idx===15){
      /* 심연 — 어두운 소용돌이 */
      for(var n=0;n<30;n++){
        var a3=Math.random()*Math.PI*2,r3=50+Math.random()*150;
        spawnPart(w/2+Math.cos(a3)*r3,h/2+Math.sin(a3)*r3,-Math.sin(a3)*1.5,Math.cos(a3)*1.5,5,2,'#4444aa');
      }
    }
    if(idx>=17){
      /* 균열 — 빨간 번개/균열 */
      for(var q=0;q<20;q++){
        var rx=w/2+(Math.random()-.5)*200,ry=h/2+(Math.random()-.5)*200;
        spawnPart(rx,ry,(Math.random()-.5)*5,(Math.random()-.5)*5,2+Math.random(),3,'#ff3322');
      }
    }
    if(idx===21){
      /* 타이틀 — 금색 폭발 */
      _photonOrb.active=true;_photonOrb.r=0;_photonOrb.glow=0;
      for(var t=0;t<80;t++){
        var a4=Math.random()*Math.PI*2;
        spawnPart(w/2,h/2,Math.cos(a4)*(3+Math.random()*4),Math.sin(a4)*(3+Math.random()*4),3+Math.random()*3,3,Math.random()>.5?'#c9a84c':'#ffdd88');
      }
    }
  }

  /* 애니메이션 루프 */
  var _pTime=0;
  function animPrologue(){
    if(!_prologueActive){cancelAnimationFrame(_pAnim);return;}
    _pAnim=requestAnimationFrame(animPrologue);
    _pTime+=0.016;

    /* ── 3D 씬 렌더링 ── */
    if(_pRenderer&&_pScene&&_pCam){
      /* 별 회전 */
      if(starField)starField.rotation.y+=0.0003;
      /* 포톤 애니메이션 */
      if(_pNormal&&_pNormal.visible&&typeof animatePhoton==='function')animatePhoton(_pNormal,0.016,_pTime);
      if(_pCorrupted&&_pCorrupted.visible&&typeof animatePhoton==='function')animatePhoton(_pCorrupted,0.016,_pTime);
      /* 카메라 미세 흔들림 */
      _pCam.position.x=Math.sin(_pTime*0.3)*0.1;
      _pRenderer.render(_pScene,_pCam);
    }

    ctx2d.clearRect(0,0,cvs.width,cvs.height);

    /* 포톤 오브 */
    if(_photonOrb.active){
      _photonOrb.r=Math.min(_photonOrb.r+0.3,25);
      _photonOrb.glow=Math.min(_photonOrb.glow+0.02,0.6);
      var grd=ctx2d.createRadialGradient(_photonOrb.x,_photonOrb.y,0,_photonOrb.x,_photonOrb.y,_photonOrb.r*3);
      grd.addColorStop(0,'rgba(201,168,76,'+_photonOrb.glow+')');
      grd.addColorStop(0.4,'rgba(201,168,76,'+(_photonOrb.glow*0.3)+')');
      grd.addColorStop(1,'rgba(201,168,76,0)');
      ctx2d.fillStyle=grd;
      ctx2d.fillRect(_photonOrb.x-_photonOrb.r*3,_photonOrb.y-_photonOrb.r*3,_photonOrb.r*6,_photonOrb.r*6);
      ctx2d.beginPath();
      ctx2d.arc(_photonOrb.x,_photonOrb.y,_photonOrb.r,0,Math.PI*2);
      ctx2d.fillStyle='rgba(201,168,76,'+(_photonOrb.glow*0.8)+')';
      ctx2d.fill();
    }

    /* 파티클 업데이트 */
    for(var i=_pParts.length-1;i>=0;i--){
      var p=_pParts[i];
      p.x+=p.vx;p.y+=p.vy;
      p.life-=0.016;
      if(p.life<=0){_pParts.splice(i,1);continue;}
      var alpha=Math.min(1,p.life/p.maxLife*2);
      ctx2d.globalAlpha=alpha;
      ctx2d.fillStyle=p.color;
      ctx2d.beginPath();
      ctx2d.arc(p.x,p.y,p.size,0,Math.PI*2);
      ctx2d.fill();
    }
    ctx2d.globalAlpha=1;

    /* 배경 별(항상) */
    if(Math.random()<0.3){
      spawnPart(Math.random()*cvs.width,Math.random()*cvs.height,0,0,2+Math.random()*3,0.5+Math.random(),'#222222');
    }
  }
  _pAnim=requestAnimationFrame(animPrologue);
  overlay._cleanupAnim=function(){
    cancelAnimationFrame(_pAnim);
    window.removeEventListener('resize',resizePCanvas);
    if(_pRenderer){_pRenderer.dispose();_pRenderer=null;}
    _pScene=null;_pCam=null;
  };

  document.body.appendChild(overlay);

  /* 첫 슬라이드 표시 */
  setTimeout(function(){showSlide(0);onSlideChange(0);},500);

  /* 클릭/탭으로 다음 */
  overlay.addEventListener('click',function(){
    _prologueSlide++;
    if(_prologueSlide>=PROLOGUE_SLIDES.length){
      endPrologue();
    }else{
      showSlide(_prologueSlide);
    }
  });

  /* 키보드: Space/Enter로도 진행 */
  var _pKeyHandler=function(e){
    if(!_prologueActive)return;
    if(e.key===' '||e.key==='Enter'){
      e.preventDefault();
      _prologueSlide++;
      if(_prologueSlide>=PROLOGUE_SLIDES.length){
        endPrologue();
      }else{
        showSlide(_prologueSlide);
      }
    }
    if(e.key==='Escape'){
      e.preventDefault();
      endPrologue();
    }
  };
  document.addEventListener('keydown',_pKeyHandler);
  overlay._keyHandler=_pKeyHandler;
}

function showSlide(idx){
  var s=PROLOGUE_SLIDES[idx];
  var overlay=document.getElementById('prologue-overlay');
  var textEl=document.getElementById('prologue-text');
  if(!overlay||!textEl)return;

  /* 페이드아웃 */
  textEl.style.opacity='0';

  setTimeout(function(){
    overlay.style.background=s.bg||'#000';
    textEl.style.color=s.color||'#888';
    textEl.style.fontSize=(s.size||18)+'px';
    textEl.textContent=s.text;
    /* 슬라이드별 애니메이션 트리거 */
    if(typeof onSlideChange==='function')onSlideChange(idx);
    /* 페이드인 */
    setTimeout(function(){
      textEl.style.opacity='1';
    },100);
  },s.delay||400);
}

function endPrologue(){
  _prologueActive=false;
  localStorage.setItem('prologueSeen','1');
  var overlay=document.getElementById('prologue-overlay');
  if(overlay){
    if(overlay._cleanupAnim)overlay._cleanupAnim();
    overlay.style.opacity='0';
    overlay.style.transition='opacity 1.5s';
    if(overlay._keyHandler)document.removeEventListener('keydown',overlay._keyHandler);
    setTimeout(function(){
      overlay.remove();
      if(_prologueCallback)_prologueCallback();
    },1500);
  }else{
    if(_prologueCallback)_prologueCallback();
  }
}
