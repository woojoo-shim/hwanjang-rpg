/* ════════════ 메인 (닉네임, 로딩, 게임루프, 입력) ════════════ */
/* 의존: 모든 파일
   선언: myName, keys, cYaw, cPitch, isDrag, lmx, lmy, tries */

/* ── 배경 별 ── */
var bgsEl=document.getElementById('bg-stars');
for(var i=0;i<120;i++){
  var s=document.createElement('div');s.className='bgstar';
  s.style.left=Math.random()*100+'%';s.style.top=Math.random()*100+'%';
  s.style.setProperty('--d',(2+Math.random()*4)+'s');
  s.style.setProperty('--dl',(-Math.random()*6)+'s');
  s.style.setProperty('--op',(0.2+Math.random()*.7).toFixed(2));
  var sz=Math.random()<.2?3:2;s.style.width=sz+'px';s.style.height=sz+'px';s.style.background='#fff';
  bgsEl.appendChild(s);
}

/* ── 닉네임 ── */
var tries=0,myName='';
var MAXTR=5;

function showErr(m){
  var b=document.getElementById('mbox');b.style.display='block';b.style.borderColor=m.b;
  var ll=document.getElementById('mlbl');ll.textContent=m.l;ll.style.color=m.lc;
  var t=document.getElementById('mtxt');t.textContent=m.t;t.style.color=m.c;
}
function updDots(){
  var bar=document.getElementById('dotbar');bar.innerHTML='';
  for(var i=0;i<MAXTR;i++){
    var d=document.createElement('div');
    d.className='dot'+(i<tries?(tries>=MAXTR?' rd':' on'):'');
    bar.appendChild(d);
  }
}
function shake(){
  var n=document.getElementById('ni');
  ['-6px','5px','-4px','3px','0'].forEach(function(x,i){setTimeout(function(){n.style.transform='translateX('+x+')';},i*70);});
}
async function tryNick(){
  var n=document.getElementById('ni'),v=n.value.trim();
  if(!v||v.length<2){showErr({t:"닉네임은 최소 2자 이상이어야 합니다.",c:"#ff7070",b:"#ff4444",l:"[ 입력 오류 ]",lc:"#ff5555"});shake();return;}
  /* DB 중복 체크 */
  if(sbClient){
    var dup=await sbClient.from('players').select('id').eq('name',v).limit(1);
    if(dup.data&&dup.data.length>0){
      showErr({t:"이미 사용 중인 닉네임입니다.\n다른 닉네임을 입력해주세요.",c:"#ff7070",b:"#ff4444",l:"[ 닉네임 중복 ]",lc:"#ff5555"});shake();return;
    }
  }
  /* 70% 확률로 실패 */
  var success=Math.random()<0.3;
  if(success){
    myName=v;
    nickSuccess(v);
    return;
  }
  tries++;shake();
  var pb=document.getElementById('pgb');
  pb.style.width=(tries/MAXTR*100)+'%';
  if(tries>=4)pb.style.background='#ff5544';
  else if(tries>=3)pb.style.background='#ff9944';
  document.getElementById('atrow').style.display='flex';
  document.getElementById('atnum').textContent=tries+'/'+MAXTR;
  updDots();
  showErr(ERRS[Math.min(tries-1,ERRS.length-1)]);
  if(tries>=MAXTR){
    document.getElementById('cbtn').disabled=true;n.disabled=true;
    setTimeout(function(){
      document.getElementById('mbox').style.display='none';
      var p=genWeirdName();myName=p;
      document.getElementById('fbox').style.display='block';
      document.getElementById('fname').textContent=p;
      document.getElementById('sbtn').style.display='block';
      pb.style.background='#3a9a60';pb.style.width='100%';
    },2400);
  }
}
function nickSuccess(name){
  var pb=document.getElementById('pgb');
  pb.style.background='#3a9a60';pb.style.width='100%';
  document.getElementById('mbox').style.display='none';
  document.getElementById('fbox').style.display='block';
  document.getElementById('fname').textContent=name;
  document.getElementById('sbtn').style.display='block';
  document.getElementById('cbtn').disabled=true;
  document.getElementById('ni').disabled=true;
}
document.getElementById('ni').addEventListener('keydown',function(e){if(e.key==='Enter')tryNick();});

/* ── 로딩 ── */
function startGame(){
  if(!myName){var v=document.getElementById('ni').value.trim();myName=v||'모험가';}
  if(!ANTHROPIC_API_KEY&&(location.hostname==='localhost'||location.hostname==='127.0.0.1')){
    try{
      var k=prompt('AI NPC 대화를 위해 Anthropic API 키를 입력하세요.\n(한번 입력하면 브라우저에 저장됩니다)');
      if(k&&k.trim())setApiKey(k.trim());
    }catch(e){}
  }
  /* 새 플레이어면 DB에 저장 (await) */
  if(currentUser&&!playerData){
    createPlayer(myName).catch(function(e){console.warn('createPlayer fail',e);});
  }
  document.getElementById('nick-screen').classList.add('hidden');
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('load-screen').classList.remove('hidden');
  var steps=[
    {m:'서버에 접속 중...',p:15},{m:'캐릭터 데이터 불러오는 중...',p:30},
    {m:'3D 세계를 렌더링하는 중...',p:55},{m:'AI NPC 초기화 중...',p:78},
    {m:'거의 다 됐습니다...',p:92},{m:'입장 준비 완료!',p:100},
  ];
  var si=0;
  var lb=document.getElementById('lbar'),lm=document.getElementById('lmsg');
  (function next(){
    if(si>=steps.length){setTimeout(enterGame,500);return;}
    lm.textContent=steps[si].m;lb.style.width=steps[si].p+'%';si++;
    setTimeout(next,420+Math.random()*280);
  })();
}
function enterGame(){
  document.getElementById('load-screen').classList.add('hidden');
  document.getElementById('game-screen').classList.remove('hidden');
  document.getElementById('hname').textContent=myName;
  /* 복귀 유저 HUD 복원 */
  if(playerData){
    document.querySelector('.hlv').textContent='Lv.'+playerLevel;
    updPlayerHpBar();
    document.getElementById('inv-gold').textContent='💰 '+gold+' 골드';
    var ef=document.getElementById('exp-bar-fill');
    if(ef)ef.style.width=Math.min(100,playerEXP/(playerLevel*100)*100)+'%';
  }
  setTimeout(function(){
    try{
      initScene();
      /* 복귀 유저 위치+장비 복원 */
      if(playerData&&PL.group){
        PL.group.position.x=playerData.position_x||0;
        PL.group.position.z=playerData.position_z||8;
        refreshWeaponMesh();
      }
    }catch(e){console.error('initScene error',e);}
  },100);
  var t=document.getElementById('toast');
  t.textContent=myName+'이(가) 로그인하셨습니다.';
  setTimeout(function(){t.classList.add('show');},400);
  setTimeout(function(){t.classList.remove('show');},3800);
  var cm=[
    [400,'sys','[시스템]','시작 마을에 입장하셨습니다.'],
    [900,'sys','[시스템]',myName+'이(가) 서버에 접속하였습니다.'],
    [1500,'inf','','NPC에게 E키로 말을 걸어보세요. AI가 직접 대답합니다!'],
    [1600,'inf','','I 키를 누르면 인벤토리를 열 수 있습니다.'],
    [2400,'npc','마을 이장','어서 오게, 새 모험가여! ...잠깐, 자네 이름이 뭐라고?'],
  ];
  cm.forEach(function(c){setTimeout(function(){addChat(c[1],c[2],c[3]);},c[0]);});
  if(!playerData)setTimeout(giveStartItems,500);
  updTime();setInterval(updTime,1000);
  /* 멀티플레이 연결 */
  setTimeout(function(){if(typeof connectParty==='function')connectParty();},500);
  /* 자동 저장 시작 */
  if(currentUser)startAutoSave();
}
function updTime(){
  var n=new Date();
  document.getElementById('htime').textContent=String(n.getHours()).padStart(2,'0')+':'+String(n.getMinutes()).padStart(2,'0');
}

/* ── 입력 ── */
var keys={},cYaw=0,cPitch=0.38,isDrag=false,lmx=0,lmy=0;

function setupInput(){
  document.addEventListener('keydown',function(e){
    /* 게임 화면이 아니면 키 입력 무시 */
    if(document.getElementById('game-screen').classList.contains('hidden'))return;
    keys[e.key.toLowerCase()]=true;
    if(e.key.toLowerCase()==='e'&&document.activeElement!==document.getElementById('dmsg')&&document.activeElement!==document.getElementById('cin')){
      if(closestPortal){changeZone(closestPortal.to);return;}
      if(closestNpc&&!document.getElementById('dbox').classList.contains('show'))talk(closestNpc);
    }
    if(e.key.toLowerCase()==='f'&&document.activeElement!==document.getElementById('dmsg')&&document.activeElement!==document.getElementById('cin'))
      playerAttack();
  });
  document.addEventListener('keyup',function(e){keys[e.key.toLowerCase()]=false;});

  var cc=document.getElementById('cc');
  cc.addEventListener('contextmenu',function(e){e.preventDefault();});
  cc.addEventListener('mousedown',function(e){
    if(e.button===0||e.button===2){
      isDrag=true;lmx=e.clientX;lmy=e.clientY;
      cc.style.cursor='grabbing';e.preventDefault();
    }
  });
  document.addEventListener('mousemove',function(e){
    if(!isDrag)return;
    cYaw-=(e.clientX-lmx)*.007;
    cPitch-=(e.clientY-lmy)*.005;
    cPitch=Math.max(.05,Math.min(1.2,cPitch));
    lmx=e.clientX;lmy=e.clientY;
  });
  document.addEventListener('mouseup',function(){isDrag=false;cc.style.cursor='grab';});
  cc.addEventListener('touchstart',function(e){if(e.touches.length===1){isDrag=true;lmx=e.touches[0].clientX;lmy=e.touches[0].clientY;}},{passive:true});
  cc.addEventListener('touchmove',function(e){
    if(!isDrag||e.touches.length!==1)return;
    cYaw-=(e.touches[0].clientX-lmx)*.007;
    cPitch-=(e.touches[0].clientY-lmy)*.005;
    cPitch=Math.max(.05,Math.min(1.2,cPitch));
    lmx=e.touches[0].clientX;lmy=e.touches[0].clientY;
  },{passive:true});
  cc.addEventListener('touchend',function(){isDrag=false;},{passive:true});
}

/* ── 게임 루프 ── */
var lastT=Date.now();
function loop(){
  var now=Date.now(),dt=Math.min((now-lastT)/1000,.05);lastT=now;
  var dialogOpen=document.getElementById('dbox').classList.contains('show');
  if(!dialogOpen&&!invOpen&&!shopOpen)handleMove(dt);
  else tickAtkAnim(dt);
  updCam();updNpcs(now/1000);chkNpc();chkPortal();
  updMonsters(dt,now/1000);
  checkZone();
  if(typeof updateRemotePlayers==='function')updateRemotePlayers(dt);
  updLabels();
  renderer.render(scene,camera);
}

/* ── 앱 초기화 ── */
(function initApp(){
  initSupabase();
  if(!sbClient){
    /* Supabase 미설정 → 기존 방식 (로그인 없이 닉네임 화면) */
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('nick-screen').classList.remove('hidden');
    return;
  }
  checkSession().then(function(hasSession){
    document.getElementById('login-screen').classList.add('hidden');
    if(hasSession&&playerData){
      restoreGameState();
      startGame();
    }else if(hasSession&&!playerData){
      document.getElementById('nick-screen').classList.remove('hidden');
    }else{
      document.getElementById('login-screen').classList.remove('hidden');
    }
  }).catch(function(e){
    console.error('initApp error',e);
    document.getElementById('login-screen').classList.remove('hidden');
  });
})();
