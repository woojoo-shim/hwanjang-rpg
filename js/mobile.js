/* ════════════ 모바일 터치 컨트롤 ════════════ */
/* 의존: main.js (keys, cYaw, cPitch, isDrag), player.js (playerAttack)
   선언: isMobile, joystick 관련 */

var isMobile=('ontouchstart' in window)||navigator.maxTouchPoints>0;
var _joyActive=false,_joyId=-1,_joyCX=0,_joyCY=0,_joyDX=0,_joyDY=0;
var _camTouchId=-1,_camLX=0,_camLY=0;

function initMobileControls(){
  if(!isMobile)return;

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

/* 게임 시작 후 호출 */
if(typeof document!=='undefined'){
  document.addEventListener('DOMContentLoaded',function(){
    setTimeout(initMobileControls,500);
  });
}
