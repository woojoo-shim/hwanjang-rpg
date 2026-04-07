/* ════════════ 모바일 터치 컨트롤 ════════════ */
/* 의존: main.js (keys, cYaw, cPitch, isDrag), player.js (playerAttack)
   선언: isMobile, joystick 관련 */

var isMobile=('ontouchstart' in window)||navigator.maxTouchPoints>0;
var _joyActive=false,_joyId=-1,_joyCX=0,_joyCY=0,_joyDX=0,_joyDY=0;
var _camTouchId=-1,_camLX=0,_camLY=0;

function initMobileControls(){
  if(!isMobile)return;

  /* 가로 모드 잠금 시도 (전체화면 시) */
  try{
    if(screen.orientation&&screen.orientation.lock){
      screen.orientation.lock('landscape').catch(function(){});
    }
  }catch(e){}

  /* ── 뷰포트 메타 ── */
  var meta=document.querySelector('meta[name="viewport"]');
  if(!meta){meta=document.createElement('meta');meta.name='viewport';document.head.appendChild(meta);}
  meta.content='width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no';

  /* ── 조이스틱 컨테이너 (왼쪽 하단) ── */
  var joyWrap=document.createElement('div');
  joyWrap.id='joy-wrap';
  joyWrap.style.cssText='position:fixed;left:20px;bottom:120px;width:140px;height:140px;z-index:50;pointer-events:auto;touch-action:none;';
  var joyBase=document.createElement('div');
  joyBase.id='joy-base';
  joyBase.style.cssText='width:140px;height:140px;border-radius:50%;background:rgba(255,255,255,0.12);border:2px solid rgba(255,255,255,0.25);position:relative;';
  var joyKnob=document.createElement('div');
  joyKnob.id='joy-knob';
  joyKnob.style.cssText='width:50px;height:50px;border-radius:50%;background:rgba(255,255,255,0.4);border:2px solid rgba(255,255,255,0.6);position:absolute;left:45px;top:45px;transition:none;';
  joyBase.appendChild(joyKnob);
  joyWrap.appendChild(joyBase);
  joyWrap.style.display='none'; /* 게임 진입 전 숨김 */
  document.body.appendChild(joyWrap);

  /* ── 액션 버튼 (오른쪽 하단) ── */
  var btnWrap=document.createElement('div');
  btnWrap.id='mobile-btns';
  btnWrap.style.cssText='position:fixed;right:20px;bottom:100px;z-index:50;display:flex;flex-direction:column;gap:12px;pointer-events:auto;';

  var btns=[
    {id:'m-atk',label:'⚔️',key:'f',size:65,color:'rgba(220,50,50,0.5)'},
    {id:'m-talk',label:'💬',key:'e',size:55,color:'rgba(50,150,220,0.5)'},
    {id:'m-inv',label:'🎒',key:'i',size:55,color:'rgba(180,150,50,0.5)'},
    {id:'m-tp',label:'🌀',key:'h',size:50,color:'rgba(100,50,200,0.5)'}
  ];

  btns.forEach(function(b){
    var btn=document.createElement('div');
    btn.id=b.id;
    btn.style.cssText='width:'+b.size+'px;height:'+b.size+'px;border-radius:50%;background:'+b.color+';border:2px solid rgba(255,255,255,0.3);display:flex;align-items:center;justify-content:center;font-size:24px;color:#fff;user-select:none;touch-action:none;';
    btn.textContent=b.label;
    btn.addEventListener('touchstart',function(e){
      e.preventDefault();
      /* 키 이벤트 시뮬레이션 */
      var ev=new KeyboardEvent('keydown',{key:b.key,code:'Key'+b.key.toUpperCase(),bubbles:true});
      document.dispatchEvent(ev);
      btn.style.transform='scale(0.85)';
      btn.style.background=b.color.replace('0.5','0.8');
    },{passive:false});
    btn.addEventListener('touchend',function(e){
      e.preventDefault();
      var ev=new KeyboardEvent('keyup',{key:b.key,code:'Key'+b.key.toUpperCase(),bubbles:true});
      document.dispatchEvent(ev);
      btn.style.transform='scale(1)';
      btn.style.background=b.color;
    },{passive:false});
    btnWrap.appendChild(btn);
  });
  btnWrap.style.display='none'; /* 게임 진입 전 숨김 */
  document.body.appendChild(btnWrap);

  /* ── 조이스틱 터치 이벤트 ── */
  joyWrap.addEventListener('touchstart',function(e){
    e.preventDefault();
    var t=e.changedTouches[0];
    _joyActive=true;_joyId=t.identifier;
    var rect=joyBase.getBoundingClientRect();
    _joyCX=rect.left+70;_joyCY=rect.top+70;
    updateJoy(t.clientX,t.clientY);
  },{passive:false});

  joyWrap.addEventListener('touchmove',function(e){
    e.preventDefault();
    for(var i=0;i<e.changedTouches.length;i++){
      if(e.changedTouches[i].identifier===_joyId){
        updateJoy(e.changedTouches[i].clientX,e.changedTouches[i].clientY);
      }
    }
  },{passive:false});

  joyWrap.addEventListener('touchend',function(e){
    for(var i=0;i<e.changedTouches.length;i++){
      if(e.changedTouches[i].identifier===_joyId){
        _joyActive=false;_joyId=-1;_joyDX=0;_joyDY=0;
        joyKnob.style.left='45px';joyKnob.style.top='45px';
        keys['w']=false;keys['a']=false;keys['s']=false;keys['d']=false;
      }
    }
  },{passive:false});

  function updateJoy(cx,cy){
    var dx=cx-_joyCX,dy=cy-_joyCY;
    var dist=Math.sqrt(dx*dx+dy*dy);
    var maxR=55;
    if(dist>maxR){dx=dx/dist*maxR;dy=dy/dist*maxR;dist=maxR;}
    joyKnob.style.left=(45+dx)+'px';
    joyKnob.style.top=(45+dy)+'px';

    /* 방향을 WASD 키로 변환 */
    var threshold=15;
    _joyDX=dx;_joyDY=dy;
    keys['w']=dy<-threshold;
    keys['s']=dy>threshold;
    keys['a']=dx<-threshold;
    keys['d']=dx>threshold;
  }

  /* ── 카메라 터치 드래그 (화면 중앙 영역) ── */
  var canvas=document.getElementById('gc');
  if(canvas){
    canvas.addEventListener('touchstart',function(e){
      /* 조이스틱/버튼 영역이 아닌 터치만 카메라로 */
      var t=e.changedTouches[0];
      if(t.clientX>window.innerWidth*0.25&&t.clientX<window.innerWidth*0.75){
        _camTouchId=t.identifier;
        _camLX=t.clientX;_camLY=t.clientY;
      }
    },{passive:true});

    canvas.addEventListener('touchmove',function(e){
      for(var i=0;i<e.changedTouches.length;i++){
        var t=e.changedTouches[i];
        if(t.identifier===_camTouchId){
          var dx=t.clientX-_camLX,dy=t.clientY-_camLY;
          cYaw-=dx*0.005;
          cPitch=Math.max(-1.2,Math.min(0.3,cPitch-dy*0.005));
          _camLX=t.clientX;_camLY=t.clientY;
        }
      }
    },{passive:true});

    canvas.addEventListener('touchend',function(e){
      for(var i=0;i<e.changedTouches.length;i++){
        if(e.changedTouches[i].identifier===_camTouchId){
          _camTouchId=-1;
        }
      }
    },{passive:true});
  }

  /* ── 모바일 UI 조정 ── */
  /* 하단 키보드 안내 숨기기 */
  var hint=document.querySelector('.shortcuts');
  if(hint)hint.style.display='none';

  /* 채팅 입력 축소 */
  var chatWrap=document.getElementById('chat-wrap');
  if(chatWrap)chatWrap.style.maxWidth='280px';

  /* HUD 폰트 축소 */
  var hud=document.querySelector('.hud');
  if(hud)hud.style.fontSize='11px';
}

/* 게임 화면 진입 시 컨트롤 표시 */
function showMobileControls(){
  if(!isMobile)return;
  var jw=document.getElementById('joy-wrap');
  var mb=document.getElementById('mobile-btns');
  if(jw)jw.style.display='block';
  if(mb)mb.style.display='flex';
}
function hideMobileControls(){
  var jw=document.getElementById('joy-wrap');
  var mb=document.getElementById('mobile-btns');
  if(jw)jw.style.display='none';
  if(mb)mb.style.display='none';
}

/* ════════════ 컨트롤 커스터마이즈 ════════════ */
var _mobileSettings=null;
var _editMode=false;
var _editTarget=null;

function loadMobileSettings(){
  try{
    var s=localStorage.getItem('mobileCtrl');
    if(s)_mobileSettings=JSON.parse(s);
  }catch(e){}
  if(!_mobileSettings)_mobileSettings={
    joy:{x:20,y:120,size:140},
    btns:{x:20,y:100},
    btnSize:1.0
  };
}

function saveMobileSettings(){
  try{localStorage.setItem('mobileCtrl',JSON.stringify(_mobileSettings));}catch(e){}
}

function applyMobileSettings(){
  var s=_mobileSettings;
  var jw=document.getElementById('joy-wrap');
  var mb=document.getElementById('mobile-btns');
  if(jw){
    jw.style.left=s.joy.x+'px';
    jw.style.bottom=s.joy.y+'px';
    jw.style.width=s.joy.size+'px';
    jw.style.height=s.joy.size+'px';
    var base=document.getElementById('joy-base');
    if(base){base.style.width=s.joy.size+'px';base.style.height=s.joy.size+'px';}
    var knob=document.getElementById('joy-knob');
    if(knob){
      var ks=s.joy.size*0.36;
      knob.style.width=ks+'px';knob.style.height=ks+'px';
      knob.style.left=(s.joy.size-ks)/2+'px';knob.style.top=(s.joy.size-ks)/2+'px';
    }
  }
  if(mb){
    mb.style.right=s.btns.x+'px';
    mb.style.bottom=s.btns.y+'px';
    var scale=s.btnSize||1.0;
    mb.querySelectorAll('div').forEach(function(btn){
      if(btn.id&&btn.id.indexOf('m-')===0){
        btn.style.transform='scale('+scale+')';
      }
    });
  }
}

function openControlSettings(){
  if(!isMobile)return;
  _editMode=true;
  loadMobileSettings();

  var jw=document.getElementById('joy-wrap');
  var mb=document.getElementById('mobile-btns');
  if(!jw||!mb)return;

  /* 컨트롤을 보이도록 */
  jw.style.display='block';
  mb.style.display='flex';

  /* 편집 모드 표시 — 노란 테두리 + 반투명 배경 */
  var editStyleEl=document.createElement('style');
  editStyleEl.id='ctrl-edit-style';
  editStyleEl.textContent='#joy-wrap,#mobile-btns{outline:3px dashed #c9a84c;outline-offset:4px;}#joy-wrap::before,#mobile-btns::before{content:"드래그";position:absolute;top:-22px;left:50%;transform:translateX(-50%);color:#c9a84c;font-size:10px;font-weight:bold;white-space:nowrap;}';
  document.head.appendChild(editStyleEl);

  /* 상단 툴바 (저장/초기화/닫기 + 크기 슬라이더) */
  var toolbar=document.createElement('div');
  toolbar.id='ctrl-toolbar';
  toolbar.style.cssText='position:fixed;top:0;left:0;right:0;background:rgba(10,10,20,0.92);border-bottom:2px solid #c9a84c;padding:10px;z-index:300;display:flex;flex-direction:column;gap:8px;color:#f0e4bb;font-size:12px;font-family:inherit;';
  toolbar.innerHTML=
    '<div style="text-align:center;color:#c9a84c;font-size:13px;font-weight:bold;">⚙️ 컨트롤 편집 — 드래그해서 이동</div>'+
    '<div style="display:flex;align-items:center;gap:8px;">'+
      '<span style="min-width:70px;">🕹️ 조이스틱</span>'+
      '<input type="range" id="ctrl-joy-size" min="80" max="220" value="'+_mobileSettings.joy.size+'" style="flex:1;accent-color:#c9a84c;">'+
      '<span id="ctrl-joy-size-val" style="min-width:35px;text-align:right;">'+_mobileSettings.joy.size+'px</span>'+
    '</div>'+
    '<div style="display:flex;align-items:center;gap:8px;">'+
      '<span style="min-width:70px;">🔘 버튼</span>'+
      '<input type="range" id="ctrl-btn-size" min="0.5" max="2.0" step="0.1" value="'+(_mobileSettings.btnSize||1.0)+'" style="flex:1;accent-color:#c9a84c;">'+
      '<span id="ctrl-btn-size-val" style="min-width:35px;text-align:right;">'+(_mobileSettings.btnSize||1.0).toFixed(1)+'x</span>'+
    '</div>'+
    '<div style="display:flex;gap:8px;">'+
      '<button id="ctrl-save" style="flex:1;background:#c9a84c;color:#0c0c1e;border:none;padding:10px;font-size:13px;font-weight:bold;border-radius:6px;">✓ 저장</button>'+
      '<button id="ctrl-reset" style="flex:1;background:transparent;color:#c9a84c;border:1px solid #c9a84c;padding:10px;font-size:12px;border-radius:6px;">↻ 초기화</button>'+
      '<button id="ctrl-close" style="flex:1;background:#333;color:#fff;border:none;padding:10px;font-size:12px;border-radius:6px;">✕ 닫기</button>'+
    '</div>';
  document.body.appendChild(toolbar);

  /* ── 드래그 편집을 위한 이벤트 가로채기 플래그 ── */
  /* 게임 내 조이스틱/버튼 touchstart 핸들러가 편집 모드 중에는 작동 안 하도록 */
  var joyDragOverlay=document.createElement('div');
  joyDragOverlay.id='joy-edit-overlay';
  joyDragOverlay.style.cssText='position:absolute;inset:0;z-index:5;background:rgba(201,168,76,0.15);border-radius:50%;touch-action:none;';
  jw.appendChild(joyDragOverlay);

  var btnDragOverlay=document.createElement('div');
  btnDragOverlay.id='btn-edit-overlay';
  btnDragOverlay.style.cssText='position:absolute;inset:-10px;z-index:5;background:rgba(201,168,76,0.12);border-radius:10px;touch-action:none;';
  mb.style.position='fixed';
  mb.appendChild(btnDragOverlay);

  /* ── 조이스틱 드래그 ── */
  var joyDrag={active:false,startX:0,startY:0,initLeft:0,initBottom:0};
  joyDragOverlay.addEventListener('touchstart',function(e){
    e.preventDefault();e.stopPropagation();
    var t=e.changedTouches[0];
    joyDrag.active=true;
    joyDrag.startX=t.clientX;joyDrag.startY=t.clientY;
    joyDrag.initLeft=_mobileSettings.joy.x;
    joyDrag.initBottom=_mobileSettings.joy.y;
  },{passive:false});
  joyDragOverlay.addEventListener('touchmove',function(e){
    e.preventDefault();e.stopPropagation();
    if(!joyDrag.active)return;
    var t=e.changedTouches[0];
    var dx=t.clientX-joyDrag.startX;
    var dy=t.clientY-joyDrag.startY;
    _mobileSettings.joy.x=Math.max(0,Math.min(window.innerWidth-_mobileSettings.joy.size,joyDrag.initLeft+dx));
    _mobileSettings.joy.y=Math.max(0,Math.min(window.innerHeight-_mobileSettings.joy.size,joyDrag.initBottom-dy));
    applyMobileSettings();
  },{passive:false});
  joyDragOverlay.addEventListener('touchend',function(e){
    e.preventDefault();e.stopPropagation();
    joyDrag.active=false;
  },{passive:false});

  /* ── 버튼 그룹 드래그 ── */
  var btnDrag={active:false,startX:0,startY:0,initRight:0,initBottom:0};
  btnDragOverlay.addEventListener('touchstart',function(e){
    e.preventDefault();e.stopPropagation();
    var t=e.changedTouches[0];
    btnDrag.active=true;
    btnDrag.startX=t.clientX;btnDrag.startY=t.clientY;
    btnDrag.initRight=_mobileSettings.btns.x;
    btnDrag.initBottom=_mobileSettings.btns.y;
  },{passive:false});
  btnDragOverlay.addEventListener('touchmove',function(e){
    e.preventDefault();e.stopPropagation();
    if(!btnDrag.active)return;
    var t=e.changedTouches[0];
    var dx=t.clientX-btnDrag.startX;
    var dy=t.clientY-btnDrag.startY;
    _mobileSettings.btns.x=Math.max(0,Math.min(window.innerWidth-80,btnDrag.initRight-dx));
    _mobileSettings.btns.y=Math.max(0,Math.min(window.innerHeight-80,btnDrag.initBottom-dy));
    applyMobileSettings();
  },{passive:false});
  btnDragOverlay.addEventListener('touchend',function(e){
    e.preventDefault();e.stopPropagation();
    btnDrag.active=false;
  },{passive:false});

  /* ── 크기 슬라이더 ── */
  document.getElementById('ctrl-joy-size').addEventListener('input',function(e){
    _mobileSettings.joy.size=parseInt(e.target.value);
    document.getElementById('ctrl-joy-size-val').textContent=_mobileSettings.joy.size+'px';
    applyMobileSettings();
  });
  document.getElementById('ctrl-btn-size').addEventListener('input',function(e){
    _mobileSettings.btnSize=parseFloat(e.target.value);
    document.getElementById('ctrl-btn-size-val').textContent=_mobileSettings.btnSize.toFixed(1)+'x';
    applyMobileSettings();
  });

  function cleanupEdit(){
    toolbar.remove();
    var ss=document.getElementById('ctrl-edit-style');if(ss)ss.remove();
    var jo=document.getElementById('joy-edit-overlay');if(jo)jo.remove();
    var bo=document.getElementById('btn-edit-overlay');if(bo)bo.remove();
    _editMode=false;
  }

  document.getElementById('ctrl-save').addEventListener('click',function(){
    saveMobileSettings();
    cleanupEdit();
    if(typeof addChat==='function')addChat('sys','[시스템]','컨트롤 설정이 저장되었습니다.');
  });

  document.getElementById('ctrl-reset').addEventListener('click',function(){
    _mobileSettings={joy:{x:20,y:120,size:140},btns:{x:20,y:100},btnSize:1.0};
    document.getElementById('ctrl-joy-size').value=140;
    document.getElementById('ctrl-joy-size-val').textContent='140px';
    document.getElementById('ctrl-btn-size').value=1.0;
    document.getElementById('ctrl-btn-size-val').textContent='1.0x';
    applyMobileSettings();
  });

  document.getElementById('ctrl-close').addEventListener('click',function(){
    loadMobileSettings();
    applyMobileSettings();
    cleanupEdit();
  });
}

/* 게임 시작 후 저장된 설정 적용 */
function initMobileSettings(){
  if(!isMobile)return;
  loadMobileSettings();
  applyMobileSettings();
}

/* 게임 시작 후 호출 */
if(typeof document!=='undefined'){
  document.addEventListener('DOMContentLoaded',function(){
    setTimeout(function(){
      initMobileControls();
      initMobileSettings();
    },500);
  });
}
