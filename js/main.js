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
  /* 유저 제스처 시점에서 AudioContext 생성/resume — autoplay 정책 충족 */
  if(typeof getAudioCtx==='function')getAudioCtx();
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
  if(typeof showMobileControls==='function')showMobileControls();
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
      if(typeof initDayNight==='function')initDayNight();
      if(playerData&&PL.group){
        PL.group.position.set(WORLD_SPAWN[0],0,WORLD_SPAWN[1]);
        refreshWeaponMesh();
        if(typeof refreshCosmeticMesh==='function')refreshCosmeticMesh();
      }
      if(typeof initSpecialClassNpcs==='function')initSpecialClassNpcs();
      if(typeof buildDungeonEntrances==='function')buildDungeonEntrances();
      if(typeof buildRaidNPCs==='function')buildRaidNPCs();
      if(typeof initKingdom==='function')initKingdom();
      if(typeof checkDailyLogin==='function')checkDailyLogin();
      /* BGM 즉시 시작 — 로그인 과정에서 이미 유저 상호작용 발생했으므로 autoplay 허용됨 */
      _bgmZone='';
      if(typeof getAudioCtx==='function')getAudioCtx();/* AudioContext resume */
      if(typeof playBGM==='function')playBGM(currentZone||'village');
      if(typeof initMinimap==='function')initMinimap();
      loop();
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
  /* 전사 NPC 초기 스폰 (초원 배회) */
  setTimeout(function(){if(typeof spawnWarrior==='function')spawnWarrior();},3000);
  /* 자동 저장 시작 */
  if(currentUser)startAutoSave();
}
function updTime(){
  /* 게임 시간은 daynight.js의 _updateGameClock()이 담당
     daynight.js가 없을 경우 실제 시간으로 폴백 */
  if(typeof gameTime==='undefined'){
    var n=new Date();
    document.getElementById('htime').textContent=String(n.getHours()).padStart(2,'0')+':'+String(n.getMinutes()).padStart(2,'0');
  }
}

/* ── 입력 ── */
var keys={},cYaw=0,cPitch=0.75,isDrag=false,lmx=0,lmy=0,camSensitivity=1.0;

/* ── ESC 메뉴 ── */
var _escMenuOpen=false;
function openEscMenu(){
  var m=document.getElementById('esc-menu');
  m.style.display='flex';
  _escMenuOpen=true;
  /* 현재 볼륨을 슬라이더에 반영 */
  document.getElementById('esc-sfx-vol').value=Math.round(_sfxVolume*100);
  document.getElementById('esc-bgm-vol').value=Math.round(_bgmVolume*100);
  /* 모바일에서만 컨트롤 설정 버튼 표시 */
  var ctrlBtn=document.getElementById('esc-ctrl');
  if(ctrlBtn)ctrlBtn.style.display=(typeof isMobile!=='undefined'&&isMobile)?'block':'none';
}
function closeEscMenu(){
  document.getElementById('esc-menu').style.display='none';
  _escMenuOpen=false;
}
/* 이벤트 바인딩 — DOM 로드 후 */
document.addEventListener('DOMContentLoaded',function(){
  var resumeBtn=document.getElementById('esc-resume');
  var logoutBtn=document.getElementById('esc-logout');
  var sfxSlider=document.getElementById('esc-sfx-vol');
  var bgmSlider=document.getElementById('esc-bgm-vol');
  var camSlider=document.getElementById('esc-cam-sens');
  if(resumeBtn)resumeBtn.addEventListener('click',closeEscMenu);
  if(logoutBtn)logoutBtn.addEventListener('click',function(){closeEscMenu();logout();});
  if(sfxSlider)sfxSlider.addEventListener('input',function(){if(typeof setSfxVolume==='function')setSfxVolume(this.value/100);});
  if(bgmSlider)bgmSlider.addEventListener('input',function(){if(typeof setBgmVolume==='function')setBgmVolume(this.value/100);});
  if(camSlider)camSlider.addEventListener('input',function(){if(typeof camSensitivity!=='undefined')camSensitivity=this.value/100;});
});

function setupInput(){
  /* e.code 기반 키 매핑 — 한/영 상관없이 작동 */
  var CODE_TO_KEY={
    KeyW:'w',KeyA:'a',KeyS:'s',KeyD:'d',
    KeyE:'e',KeyF:'f',KeyI:'i',KeyQ:'q',KeyR:'r',KeyT:'t',
    KeyP:'p',KeyM:'m',KeyV:'v'
  };
  document.addEventListener('keydown',function(e){
    if(document.getElementById('game-screen').classList.contains('hidden'))return;
    var k=CODE_TO_KEY[e.code]||(e.key?e.key.toLowerCase():null);
    if(!k)return;
    keys[k]=true;
    var _ae=document.activeElement;
    var isInput=_ae===document.getElementById('dmsg')||_ae===document.getElementById('cin')||(_ae&&(_ae.tagName==='INPUT'||_ae.tagName==='TEXTAREA'));
    /* ESC 메뉴 */
    if(e.key==='Escape'){
      e.preventDefault();
      var escMenu=document.getElementById('esc-menu');
      if(escMenu.style.display==='flex'){
        closeEscMenu();
      }else{
        /* 다른 UI가 열려있으면 그것부터 닫기 */
        if(document.getElementById('dbox').classList.contains('show')){closeDialog();return;}
        if(invOpen){closeInv();return;}
        if(shopOpen){closeShop();return;}
        if(typeof enhanceOpen!=='undefined'&&enhanceOpen){closeEnhance();return;}
        if(typeof fishingActive!=='undefined'&&fishingActive){cancelFishing();return;}
        if(typeof _statUIOpen!=='undefined'&&_statUIOpen){closeStatUI();return;}
        if(typeof fullmapOpen!=='undefined'&&fullmapOpen){toggleFullMap();return;}
        openEscMenu();
      }
      return;
    }
    /* ESC 메뉴가 열려있으면 다른 키 무시 */
    if(document.getElementById('esc-menu').style.display==='flex')return;
    if(k==='e'&&!isInput){
      e.preventDefault();
      /* 건물 내부 → NPC 대화 우선, 나가기 카펫 위에서만 나가기 */
      if(typeof insideBuilding!=='undefined'&&insideBuilding){
        if(closestNpc&&!document.getElementById('dbox').classList.contains('show')){
          talk(closestNpc);
        }else{
          var _exitThresh=(insideBuilding==='모험가 길드')?12:8;
          if(Math.abs(PL.group.position.x)<3&&PL.group.position.z>_exitThresh){
            exitBuilding();
          }
        }
      }else if(closestNpc&&!document.getElementById('dbox').classList.contains('show')){
        talk(closestNpc);
      }else if(typeof tryEnterDungeon==='function'&&tryEnterDungeon()){
        /* 던전 입장/탈출 */
      }else if(typeof tryEnterBuilding==='function'&&nearestDoor){
        tryEnterBuilding();
      }
    }
    if(k==='f'&&!isInput){e.preventDefault();playerAttack();}
    /* Space: 낚시 릴 감기 우선, 아니면 대쉬 */
    if(k===' '&&!isInput){
      e.preventDefault();
      if(typeof fishingActive!=='undefined'&&fishingActive){if(typeof reelIn==='function')reelIn();}
      else{if(typeof tryDash==='function')tryDash();}
    }
    /* G: 낚시 */
    if(k==='g'&&!isInput){e.preventDefault();if(typeof startFishing==='function')startFishing();}
    /* N: 스탯 창 */
    if(k==='n'&&!isInput){e.preventDefault();if(typeof openStatUI==='function')openStatUI();}
    /* M: 전체 지도 */
    if(k==='m'&&!isInput){e.preventDefault();if(typeof toggleFullMap==='function')toggleFullMap();}
    /* 스킬 키: Q=0, R=1, T=2 */
    var skillMap={'q':0,'r':1,'t':2};
    var sk=skillMap[k];
    if(sk!==undefined&&!isInput){
      e.preventDefault();
      if(typeof useSkill==='function')useSkill(sk);
    }
  });
  document.addEventListener('keyup',function(e){
    var k=CODE_TO_KEY[e.code]||(e.key?e.key.toLowerCase():null);
    if(k)keys[k]=false;
  });

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
    cYaw-=(e.clientX-lmx)*.007*camSensitivity;
    cPitch-=(e.clientY-lmy)*.005*camSensitivity;
    cPitch=Math.max(-0.3,Math.min(1.5,cPitch));
    lmx=e.clientX;lmy=e.clientY;
  });
  document.addEventListener('mouseup',function(){isDrag=false;cc.style.cursor='grab';});
  cc.addEventListener('touchstart',function(e){if(e.touches.length===1){isDrag=true;lmx=e.touches[0].clientX;lmy=e.touches[0].clientY;}},{passive:true});
  cc.addEventListener('touchmove',function(e){
    if(!isDrag||e.touches.length!==1)return;
    cYaw-=(e.touches[0].clientX-lmx)*.007*camSensitivity;
    cPitch-=(e.touches[0].clientY-lmy)*.005*camSensitivity;
    cPitch=Math.max(-0.3,Math.min(1.5,cPitch));
    lmx=e.touches[0].clientX;lmy=e.touches[0].clientY;
  },{passive:true});
  cc.addEventListener('touchend',function(){isDrag=false;},{passive:true});
}

/* ── AFK 자동 로그아웃 (20분) ── */
var AFK_LIMIT=20*60*1000;
var lastActivity=Date.now();
function resetAfk(){lastActivity=Date.now();}
['keydown','mousedown','mousemove','touchstart','wheel'].forEach(function(ev){
  document.addEventListener(ev,resetAfk,{passive:true});
});

/* ── 게임 루프 ── */
var lastT=Date.now();
var _loopRunning=false;
var _dboxEl=null;/* 대화창 DOM 캐시 */
function loop(){
  if(_loopRunning)return;
  _loopRunning=true;
  if(!_dboxEl)_dboxEl=document.getElementById('dbox');
  function _tick(){
    requestAnimationFrame(_tick);
  try{
    var now=Date.now(),dt=Math.min((now-lastT)/1000,.05);lastT=now;
    /* ESC 메뉴 열려있으면 게임 일시정지 (렌더링만) */
    if(_escMenuOpen){renderer.render(scene,camera);return;}
    var dialogOpen=_dboxEl&&_dboxEl.classList.contains('show');
    if(!dialogOpen&&!invOpen&&!shopOpen)handleMove(dt);
    else tickAtkAnim(dt);
    updCam();updNpcs(now/1000);chkNpc();
    updMonsters(dt,now/1000);
    if(typeof updateGroundEffects==='function')updateGroundEffects(dt);
    if(typeof tickDynamicNpcs==='function')tickDynamicNpcs(dt);
    if(typeof updateArrows==='function')updateArrows(dt);
    if(typeof updateSkills==='function')updateSkills(dt);
    if(typeof updateMonsterAnims==='function')updateMonsterAnims(dt);
    if(typeof tickScreenShake==='function')tickScreenShake(dt);
    if(typeof tickCapeAnim==='function')tickCapeAnim(dt);
    if(typeof tickEmote==='function')tickEmote(dt);
    if(typeof updateKillParticles==='function')updateKillParticles(dt);
    if(typeof updateLootGlows==='function')updateLootGlows(dt);
    checkZone();
    if(typeof checkBuildingDoors==='function')checkBuildingDoors();
    if(typeof checkDungeonEntrance==='function')checkDungeonEntrance();
    if(typeof checkDungeonProgress==='function')checkDungeonProgress();
    if(typeof tickRaidBoss==='function')tickRaidBoss(dt);
    if(typeof checkRaidProgress==='function')checkRaidProgress();
    if(typeof tickFishing==='function')tickFishing(dt);
    if(typeof checkKingdomTriggers==='function')checkKingdomTriggers(dt);
    if(typeof updateRemotePlayers==='function')updateRemotePlayers(dt);
    if(typeof tickDayNight==='function')tickDayNight(dt);
    if(typeof _updateNightNpcVisibility==='function')_updateNightNpcVisibility();
    /* AFK 체크 */
    if(now-lastActivity>AFK_LIMIT){
      addChat('sys','[시스템]','20분간 활동이 없어 자동 로그아웃됩니다.');
      if(typeof savePlayerData==='function')savePlayerData();
      setTimeout(function(){
        if(typeof logout==='function')logout();
        else location.reload();
      },2000);
      lastActivity=now+999999;
    }
    updLabels();
    if(typeof updVisualFX==='function')updVisualFX(now/1000);
    if(typeof tickMinimap==='function')tickMinimap();
    if(composer)composer.render();
    else renderer.render(scene,camera);
  }catch(e){console.error('loop error:',e);}
  }
  _tick();
}

/* ── 앱 초기화 ── */
(function initApp(){
  initSupabase();
  if(!sbClient){
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('nick-screen').classList.remove('hidden');
    return;
  }
  checkSession().then(function(hasSession){
    document.getElementById('login-screen').classList.add('hidden');
    if(hasSession&&playerData){
      /* 기존 플레이어 — 프롤로그 스킵, 바로 게임 */
      restoreGameState();
      startGame();
    }else if(hasSession&&!playerData){
      document.getElementById('nick-screen').classList.remove('hidden');
    }else{
      /* 신규/로그아웃 — 프롤로그 후 로그인 화면 */
      if(typeof showPrologue==='function'){
        showPrologue(function(){
          document.getElementById('login-screen').classList.remove('hidden');
        });
      }else{
        document.getElementById('login-screen').classList.remove('hidden');
      }
    }
  }).catch(function(e){
    console.error('initApp error',e);
    document.getElementById('login-screen').classList.remove('hidden');
  });
})();
