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

  document.body.appendChild(overlay);

  /* 첫 슬라이드 표시 */
  setTimeout(function(){showSlide(0);},500);

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
