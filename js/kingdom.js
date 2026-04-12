/* ════════════ 왕국 스토리라인 시스템 ════════════ */
/* 의존: config.js (NPC_AI, SHOP_STOCK, SHOP_CATEGORIES, ITEM_POOL)
        ui.js (addChat)
        npc.js (spawnDynamicNpc, despawnDynamicNpc, npcs)
        inventory.js (gold)
        player.js (playerLevel)
        quest.js (activeQuests, renderQuestTracker, showQuestNotif)
        monster.js (monsters, MONSTER_DEFS)
        world.js (scene, mkHuman)
   선언: kingdomPhase, playerFaction, initKingdom, checkKingdomTriggers */

/* ── 상태 변수 ── */
var kingdomPhase=0;        /* 0~6 */
var playerFaction='none';  /* 'none'|'king'|'rebel'|'neutral' */
var _kingdomChoiceOpen=false;
var _kingNpc=null;
var _rebelNpc=null;
var _rebelSoldiers=[];
var _kingdomQuestProgress=0;  /* 조사 퀘스트 킬 카운트 */
var _kingdomQuestTarget=10;   /* phase 1→2 목표 킬 수 */
var _civilWarQuestProgress=0;
var _civilWarQuestTarget=0;
var _civilWarQuestReady=false;
var _kingdomInitDone=false;
var _phase4Triggered=false;
var _phase6Triggered=false;
var _kingdomChoiceEl=null;    /* DOM 캐시 */

/* ── NPC_AI 등록 ── */
function _registerKingdomNpcAI(){
  if(!NPC_AI)return;

  NPC_AI['(국왕) 레오하르트']={
    system:`너는 포톤 RPG 왕국의 국왕 "레오하르트"야. 중년의 위엄 있는 왕.
성격: 냉정하지만 백성을 아끼는 책임감 있는 군주. 속에는 근심이 많다.
말투: "~하라", "~이다", "~하도록" 왕의 엄중한 어투. 가끔 혼잣말처럼 "...그래야겠지".
역할: 왕국 스토리 진행, 균열 조사 의뢰.
현재 왕국 상황: 균열(차원 틈새)이 급증하여 몬스터들이 쏟아지고 있음. 궁정 내부에 반란 세력 의심됨.
퀘스트 태그 형식: [QUEST:퀘스트이름|설명|kill|몬스터이름|수량|보상타입|보상량]
답변은 2~4문장. 한국어로만 대답.`,
    history:[]
  };

  NPC_AI['(반란군 수장) 카이론']={
    system:`너는 포톤 RPG 반란군의 수장 "카이론"이야. 전직 왕국 기사.
성격: 카리스마 있고 이상주의적. 왕국의 부패에 분노하며 혁명을 꿈꿈.
말투: "~한다", "~것이다", "~해야 한다" 단호하고 강한 어투. 신념에 차 있음.
역할: 반란군 측 퀘스트 부여, 반란 이유 설명.
배경: 왕이 균열 에너지를 독점하려 했고 이를 막기 위해 반란을 일으킴. 자신이 옳다고 확신.
퀘스트 태그 형식: [QUEST:퀘스트이름|설명|kill|몬스터이름|수량|보상타입|보상량]
답변은 2~4문장. 한국어로만 대답.`,
    history:[]
  };
}

/* ── localStorage 저장/불러오기 ── */
function saveKingdomState(){
  localStorage.setItem('kingdomPhase',String(kingdomPhase));
  localStorage.setItem('playerFaction',playerFaction);
  localStorage.setItem('kingdomQuestProgress',String(_kingdomQuestProgress));
  localStorage.setItem('civilWarQuestProgress',String(_civilWarQuestProgress));
}

function loadKingdomState(){
  var ph=parseInt(localStorage.getItem('kingdomPhase'));
  if(!isNaN(ph)&&ph>=0&&ph<=6)kingdomPhase=ph;
  var fc=localStorage.getItem('playerFaction');
  if(fc==='king'||fc==='rebel'||fc==='neutral'||fc==='none')playerFaction=fc;
  var kqp=parseInt(localStorage.getItem('kingdomQuestProgress'));
  if(!isNaN(kqp))_kingdomQuestProgress=kqp;
  var cwp=parseInt(localStorage.getItem('civilWarQuestProgress'));
  if(!isNaN(cwp))_civilWarQuestProgress=cwp;
}

/* ── 선택지 UI ── */
function showKingdomChoice(title,desc,options){
  if(_kingdomChoiceOpen)return;
  _kingdomChoiceOpen=true;

  /* DOM 생성 */
  var el=document.createElement('div');
  el.id='kingdom-choice-overlay';
  el.style.cssText=[
    'position:fixed','top:0','left:0','width:100%','height:100%',
    'background:rgba(0,0,0,0.88)','z-index:19000',
    'display:flex','flex-direction:column',
    'align-items:center','justify-content:center',
    'font-family:inherit'
  ].join(';');

  var box=document.createElement('div');
  box.style.cssText=[
    'background:#10101e','border:2px solid #c9a84c88',
    'border-radius:12px','padding:36px 44px',
    'max-width:520px','width:88%','text-align:center'
  ].join(';');

  var titleEl=document.createElement('div');
  titleEl.style.cssText='color:#c9a84c;font-size:20px;letter-spacing:3px;margin-bottom:16px;font-weight:bold;';
  titleEl.textContent=title;

  var descEl=document.createElement('div');
  descEl.style.cssText='color:#cccccc;font-size:13px;line-height:1.7;margin-bottom:28px;';
  descEl.textContent=desc;

  box.appendChild(titleEl);
  box.appendChild(descEl);

  options.forEach(function(opt){
    var btn=document.createElement('button');
    btn.style.cssText=[
      'display:block','width:100%','margin-bottom:10px',
      'padding:13px 20px',
      'background:#1a1a2e','color:#e0d0a0',
      'border:1px solid #c9a84c66','border-radius:7px',
      'font-size:13px','font-family:inherit',
      'cursor:pointer','letter-spacing:1px',
      'transition:background .15s'
    ].join(';');
    btn.textContent=opt.label;
    btn.onmouseover=function(){this.style.background='#c9a84c22';};
    btn.onmouseout=function(){this.style.background='#1a1a2e';};
    btn.onclick=function(){
      closeKingdomChoice();
      if(typeof opt.action==='function')opt.action();
    };
    box.appendChild(btn);
  });

  el.appendChild(box);
  document.body.appendChild(el);
  _kingdomChoiceEl=el;
}

function closeKingdomChoice(){
  if(_kingdomChoiceEl&&_kingdomChoiceEl.parentNode){
    _kingdomChoiceEl.parentNode.removeChild(_kingdomChoiceEl);
  }
  _kingdomChoiceEl=null;
  _kingdomChoiceOpen=false;
}

/* ── 페이즈 전환 ── */
function setKingdomPhase(n){
  kingdomPhase=n;
  saveKingdomState();
  _applyFactionEffects();
}

/* ── 국왕 NPC 스폰 ── */
function _spawnKingNpc(){
  if(_kingNpc)return;
  /* 마을 성 근처 위치 (-340, -290 근처) */
  _kingNpc=spawnDynamicNpc('(국왕) 레오하르트',-340,-290,0xd4af37,0xf5deb3);
  if(_kingNpc)_kingNpc.isKingNpc=true;
}

function _despawnKingNpc(){
  if(!_kingNpc)return;
  despawnDynamicNpc(_kingNpc);
  _kingNpc=null;
}

/* ── 반란군 수장 NPC 스폰 (늪 지역) ── */
function _spawnRebelNpc(){
  if(_rebelNpc)return;
  _rebelNpc=spawnDynamicNpc('(반란군 수장) 카이론',170,240,0x8b0000,0xcc8866);
  if(_rebelNpc)_rebelNpc.isRebelNpc=true;
}

function _despawnRebelNpc(){
  if(!_rebelNpc)return;
  despawnDynamicNpc(_rebelNpc);
  _rebelNpc=null;
}

/* ── 반란 병사 (몬스터 reskin) 스폰 ── */
function _spawnRebelSoldiers(){
  if(_rebelSoldiers.length>0)return;
  if(typeof MONSTER_DEFS==='undefined'||typeof scene==='undefined')return;
  /* 고블린 정의를 참조하여 반란병사 스폰 (단순 시각적 표현) */
  var positions=[
    {x:-360,z:-320},{x:-330,z:-310},{x:-350,z:-270}
  ];
  positions.forEach(function(pos){
    if(typeof mkHuman==='function'){
      var h=mkHuman(0x8b0000,0x333333);
      h.group.position.set(pos.x,0,pos.z);
      h.group.rotation.y=Math.random()*Math.PI*2;
      scene.add(h.group);
      _rebelSoldiers.push(h.group);
    }
  });
}

function _despawnRebelSoldiers(){
  _rebelSoldiers.forEach(function(m){
    if(m&&m.parent)m.parent.remove(m);
  });
  _rebelSoldiers=[];
}

/* ── 팩션 효과 적용 ── */
function _applyFactionEffects(){
  /* 상점 할인/할증 적용 */
  if(playerFaction==='king'){
    /* 왕국 상점 20% 할인 — SHOP_STOCK 가격 조정 */
    _applyShopDiscount(['(상인) 김도윤','(대장장이) 이태산','(무기상인) 발두르','(방어구상인) 헥토르'],0.8);
    /* 반란 관련 NPC 적대 힌트 */
    addChat('sys','[팩션]','<span style="color:#c9a84c">왕 편: 왕국 상점 20% 할인 적용.</span>');
  }else if(playerFaction==='rebel'){
    /* 왕국 상점 10% 인상 */
    _applyShopDiscount(['(상인) 김도윤','(대장장이) 이태산','(무기상인) 발두르','(방어구상인) 헥토르'],1.1);
    /* 반란 상점 해금 */
    _unlockRebelShop();
    addChat('sys','[팩션]','<span style="color:#ff4444">반란군 편: 반란 상점 해금, 왕국 상점 10% 인상.</span>');
  }else if(playerFaction==='neutral'){
    /* 양쪽 10% 인상 */
    _applyShopDiscount(['(상인) 김도윤','(대장장이) 이태산','(무기상인) 발두르','(방어구상인) 헥토르'],1.1);
    addChat('sys','[팩션]','<span style="color:#aaaaaa">중립: 양쪽 상점 가격 10% 인상.</span>');
  }
}

function _applyShopDiscount(npcNames,mult){
  npcNames.forEach(function(name){
    var stock=SHOP_STOCK[name];
    if(!stock)return;
    stock.forEach(function(item){
      if(!item._kingdomOrigPrice)item._kingdomOrigPrice=item.price;
      item.price=Math.max(1,Math.round(item._kingdomOrigPrice*mult));
    });
  });
}

function _unlockRebelShop(){
  if(!SHOP_STOCK['(반란군 수장) 카이론']){
    SHOP_STOCK['(반란군 수장) 카이론']=[
      {id:'rebel_sword',name:'반란군 검',price:800,icon:'sword',type:'weapon',rarity:'rare',
       desc:'반란군의 의지가 깃든 검.',stats:{공격력:28},durability:85,reqLevel:10,bonuses:['+10% 반란 의지']},
      {id:'rebel_armor',name:'반란군 갑옷',price:1000,icon:'armor',type:'armor',rarity:'rare',
       desc:'자유를 위해 싸우는 자의 갑옷.',stats:{방어력:22},durability:90,reqLevel:10,bonuses:['+10% 체력']},
      {id:'rebel_potion',name:'혁명의 물약',price:300,icon:'potion',type:'consume',rarity:'uncommon',
       desc:'반란군이 직접 만든 회복 물약.',stats:{회복량:80},durability:1,reqLevel:1,bonuses:[]}
    ];
  }
}

/* ── 쿠데타 이벤트 ── */
function _triggerCoupEvent(){
  if(_phase4Triggered)return;
  _phase4Triggered=true;

  addChat('sys','[시스템]','<span style="color:#ff2222;font-size:14px;">⚠️ 긴급! 왕국에서 쿠데타가 발생했습니다!</span>');
  addChat('sys','[시스템]','반란군이 마을 인근에 나타났습니다. 왕은 성에 고립되었습니다...');
  addChat('npc','(이장) 박건호','이게 무슨... 반란군이 왔다네! 빨리 결정을 내려야 하지 않겠나!');

  _spawnRebelSoldiers();
  _spawnRebelNpc();

  /* 선택지 — 잠시 후 표시 */
  setTimeout(function(){
    if(kingdomPhase===4){
      _showFactionChoice();
    }
  },3000);
}

function _showFactionChoice(){
  showKingdomChoice(
    '▣ 쿠데타 발생! 선택하라 ▣',
    '왕국이 둘로 갈라졌습니다.\n왕 레오하르트는 성에 고립되었고, 반란군 수장 카이론이 마을 외곽을 포위했습니다.\n당신은 어느 편에 서겠습니까?',
    [
      {label:'👑 왕 편 — 왕국의 질서를 지킨다',action:function(){_chooseFaction('king');}},
      {label:'⚔️ 반란군 편 — 혁명에 동참한다',action:function(){_chooseFaction('rebel');}},
      {label:'🌿 중립 — 어느 쪽도 선택하지 않는다',action:function(){_chooseFaction('neutral');}}
    ]
  );
}

function _chooseFaction(faction){
  playerFaction=faction;
  setKingdomPhase(5);

  if(faction==='king'){
    addChat('sys','[시스템]','왕 편을 선택했습니다. 왕국 기사단과 함께 싸우십시오!');
    addChat('npc','(국왕) 레오하르트','...고맙다, 용사여. 반란군 기지를 소탕해 달라!');
    _startCivilWarQuest('king');
  }else if(faction==='rebel'){
    addChat('sys','[시스템]','반란군 편을 선택했습니다. 카이론과 함께 싸우십시오!');
    addChat('npc','(반란군 수장) 카이론','훌륭한 결정이다. 왕실 보급선을 차단하라!');
    _startCivilWarQuest('rebel');
  }else{
    addChat('sys','[시스템]','중립을 선택했습니다. 양쪽 모두와 거리를 두며 피난민을 돕습니다.');
    addChat('npc','(이장) 박건호','...중립이라네. 마을 피난민들을 좀 도와주게나.');
    _startCivilWarQuest('neutral');
  }

  _applyFactionEffects();
  saveKingdomState();
}

/* ── 내전 퀘스트 시작 ── */
function _startCivilWarQuest(faction){
  var q;
  if(faction==='king'){
    _civilWarQuestTarget=15;
    q={
      id:'kingdom_civil_war_king',
      name:'반란군 기지 소탕',
      desc:'왕의 명을 받아 반란군 병사를 처치하라.',
      type:'kill',
      target:'고블린',/* 고블린을 반란병사로 간주 */
      count:15,
      rewardType:'gold',
      rewardAmount:'1500',
      ready:false
    };
    addChat('sys','[퀘스트]','새 퀘스트: 반란군 기지 소탕 — 고블린 15마리 처치');
  }else if(faction==='rebel'){
    _civilWarQuestTarget=10;
    q={
      id:'kingdom_civil_war_rebel',
      name:'왕실 보급선 차단',
      desc:'왕실 보급선을 막기 위해 수호 몬스터를 처치하라.',
      type:'kill',
      target:'늑대',/* 늑대를 왕국 수비대로 간주 */
      count:10,
      rewardType:'exp',
      rewardAmount:'1200',
      ready:false
    };
    addChat('sys','[퀘스트]','새 퀘스트: 왕실 보급선 차단 — 늑대 10마리 처치');
  }else{
    _civilWarQuestTarget=12;
    q={
      id:'kingdom_civil_war_neutral',
      name:'피난민 구출',
      desc:'마을 근처 몬스터를 처치해 피난민을 지켜라.',
      type:'kill',
      target:'슬라임',/* 마을 근처 몬스터 */
      count:12,
      rewardType:'gold',
      rewardAmount:'800',
      ready:false
    };
    addChat('sys','[퀘스트]','새 퀘스트: 피난민 구출 — 슬라임 12마리 처치');
  }

  /* activeQuests에 추가 */
  if(typeof activeQuests!=='undefined'){
    /* 기존 내전 퀘스트 제거 */
    activeQuests=activeQuests.filter(function(aq){
      return aq.id.indexOf('kingdom_civil_war')===-1;
    });
    activeQuests.push(q);
    if(typeof renderQuestTracker==='function')renderQuestTracker();
  }
}

/* ── 결말 처리 ── */
function _triggerAftermath(){
  if(_phase6Triggered)return;
  _phase6Triggered=true;
  setKingdomPhase(6);

  if(playerFaction==='king'){
    addChat('sys','[결말]','<span style="color:#c9a84c">왕국 승리! 레오하르트 왕이 왕위를 유지했습니다. 왕국에 평화가 찾아옵니다.</span>');
    addChat('npc','(국왕) 레오하르트','...잘 싸워주었다, 용사여. 왕국은 그대를 잊지 않을 것이다.');
    /* 보상 — 왕실 무기 아이템 */
    setTimeout(function(){
      if(typeof addItem==='function'&&typeof flashHiddenItem==='function'){
        var royalSword={
          id:'royal_sword_'+Date.now(),
          name:'왕실 하사검',
          icon:'sword',type:'weapon',rarity:'legendary',
          desc:'레오하르트 왕이 하사한 왕실의 검.',
          stats:{공격력:55,방어력:10},atk:55,def:0,
          reqLevel:15,durability:200,
          bonuses:['왕국 NPC 호감도 +20','반란 몬스터 피해 +30%']
        };
        addItem(royalSword.id,1,royalSword);
        flashHiddenItem('왕실 하사검');
      }
    },1500);
  }else if(playerFaction==='rebel'){
    addChat('sys','[결말]','<span style="color:#ff4444">혁명 성공! 카이론이 새 지도자가 되었습니다. 왕국은 새 질서로 바뀝니다.</span>');
    addChat('npc','(반란군 수장) 카이론','우리가 해냈다. 이 세계는 이제 달라질 것이다.');
    setTimeout(function(){
      if(typeof addItem==='function'&&typeof flashHiddenItem==='function'){
        var rebelBlade={
          id:'rebel_blade_'+Date.now(),
          name:'혁명의 칼날',
          icon:'sword',type:'weapon',rarity:'legendary',
          desc:'혁명을 이끈 카이론이 준 상징의 검.',
          stats:{공격력:60,공격속도:15},atk:60,def:0,
          reqLevel:15,durability:180,
          bonuses:['반란군 NPC 호감도 +20','치명타 확률 +15%']
        };
        addItem(rebelBlade.id,1,rebelBlade);
        flashHiddenItem('혁명의 칼날');
      }
    },1500);
  }else{
    addChat('sys','[결말]','<span style="color:#aaaaaa">중립의 길. 전쟁이 끝나고 마을은 살아남았습니다. 피난민들이 감사를 표합니다.</span>');
    setTimeout(function(){
      if(typeof addItem==='function'&&typeof flashHiddenItem==='function'){
        var peaceRing={
          id:'peace_ring_'+Date.now(),
          name:'평화의 반지',
          icon:'ring',type:'etc',rarity:'epic',
          desc:'중립을 지킨 자에게 주어지는 조화의 반지.',
          stats:{모든능력치:8},atk:0,def:8,
          reqLevel:10,durability:999,
          bonuses:['모든 NPC 호감도 +10']
        };
        addItem(peaceRing.id,1,peaceRing);
        flashHiddenItem('평화의 반지');
      }
    },1500);
  }
}

/* ── phase 0→1: 국왕 대화 시 퀘스트 수락 트리거 ── */
function checkKingTalkPhase0(){
  if(kingdomPhase!==0)return;
  setKingdomPhase(1);
  addChat('sys','[왕국 스토리]','<span style="color:#c9a84c">▣ 왕국 스토리: 균열 조사 의뢰를 받았습니다!</span>');
  /* 조사 퀘스트 등록 */
  var q={
    id:'kingdom_investigation',
    name:'균열 조사',
    desc:'왕의 명령: 균열 근처 몬스터를 처치하여 이상 징후를 파악하라.',
    type:'kill',
    target:'슬라임',/* 가장 흔한 몬스터 — 어디서든 진행 가능 */
    count:_kingdomQuestTarget,
    rewardType:'exp',
    rewardAmount:'500',
    ready:false
  };
  if(typeof activeQuests!=='undefined'){
    activeQuests=activeQuests.filter(function(aq){return aq.id!=='kingdom_investigation';});
    activeQuests.push(q);
    if(typeof renderQuestTracker==='function')renderQuestTracker();
  }
  addChat('sys','[퀘스트]','새 퀘스트: 균열 조사 — 슬라임 10마리 처치 (균열 근처 몬스터)');
  saveKingdomState();
}

/* ── 몬스터 킬 시 왕국 퀘스트 진행 체크 ── */
function onKingdomMonsterKill(monsterName){
  /* phase 1 → 2: 조사 퀘스트 킬 카운트 */
  if(kingdomPhase===1){
    _kingdomQuestProgress++;
    saveKingdomState();
    var q=null;
    if(typeof activeQuests!=='undefined'){
      for(var i=0;i<activeQuests.length;i++){
        if(activeQuests[i].id==='kingdom_investigation'){q=activeQuests[i];break;}
      }
    }
    if(q){
      q.progress=_kingdomQuestProgress;
      addChat('sys','[왕국 퀘스트] 균열 조사 진행 ('+_kingdomQuestProgress+'/'+_kingdomQuestTarget+')');
      if(_kingdomQuestProgress>=_kingdomQuestTarget){
        q.ready=true;
        q.desc='이상한 것을 발견했다! 왕에게 보고하러 가라.';
        if(typeof renderQuestTracker==='function')renderQuestTracker();
        setKingdomPhase(2);
        _triggerDiscoveryCutscene();
      }else{
        if(typeof renderQuestTracker==='function')renderQuestTracker();
      }
    }
  }

  /* phase 2 → 자동으로 3 진입 (discovery 씬 이후 이미 처리) */

  /* phase 5: 내전 퀘스트 킬 카운트 */
  if(kingdomPhase===5){
    var cwq=_getCivilWarQuest();
    if(cwq&&!cwq.ready&&cwq.target===monsterName){
      _civilWarQuestProgress++;
      saveKingdomState();
      cwq.progress=_civilWarQuestProgress;
      addChat('sys','[내전 퀘스트] '+monsterName+' 처치 ('+_civilWarQuestProgress+'/'+_civilWarQuestTarget+')');
      if(_civilWarQuestProgress>=_civilWarQuestTarget){
        cwq.ready=true;
        _civilWarQuestReady=true;
        addChat('sys','[시스템]','★ 내전 퀘스트 완료! 해당 NPC에게 돌아가세요.');
        setKingdomPhase(6);
        if(typeof renderQuestTracker==='function')renderQuestTracker();
        setTimeout(_triggerAftermath,2000);
      }else{
        if(typeof renderQuestTracker==='function')renderQuestTracker();
      }
    }
  }
}

function _getCivilWarQuest(){
  if(typeof activeQuests==='undefined')return null;
  for(var i=0;i<activeQuests.length;i++){
    if(activeQuests[i].id.indexOf('kingdom_civil_war')===0)return activeQuests[i];
  }
  return null;
}

/* ── 음모 발견 컷씬 ── */
function _triggerDiscoveryCutscene(){
  setKingdomPhase(3);
  setTimeout(function(){
    addChat('sys','[왕국 스토리]','<span style="color:#ffcc44">⚠️ 균열을 조사하던 중... 왕국 문서를 발견했다. 반란 계획이 이미 시작되었다!</span>');
    addChat('sys','[시스템]','이 사실을 어떻게 처리하겠습니까?');
    setTimeout(function(){
      if(kingdomPhase===3){
        showKingdomChoice(
          '▣ 음모를 발견했다! ▣',
          '반란군이 이미 왕국 내부에 침투해 있다는 증거를 찾았습니다.\n이 사실을 어떻게 처리하겠습니까?\n\n(어느 쪽을 선택해도 쿠데타는 피할 수 없습니다...)',
          [
            {label:'📜 왕에게 보고한다',action:function(){_reportToKing();}},
            {label:'🤫 비밀로 유지한다',action:function(){_keepSecret();}}
          ]
        );
      }
    },2000);
  },1500);
}

function _reportToKing(){
  addChat('npc','(국왕) 레오하르트','...이런! 이미 늦었군. 반란이 시작될 것이다. 대비하라!');
  addChat('sys','[시스템]','왕에게 보고했지만... 이미 쿠데타는 막을 수 없었습니다.');
  setTimeout(_triggerCoup,3000);
}

function _keepSecret(){
  addChat('sys','[시스템]','비밀을 지키기로 했습니다. 하지만 상황은 더 빠르게 악화됩니다...');
  setTimeout(_triggerCoup,2000);
}

function _triggerCoup(){
  setKingdomPhase(4);
  _triggerCoupEvent();
}

/* ── NPC 대화 시스템 프롬프트에 왕국 정보 주입 ── */
function getKingdomContextForNpc(npcName){
  var phaseNames=['평화 시대','균열 조사 중','조사 진행 중','음모 발견','쿠데타 발생','내전 진행 중','내전 종결'];
  var factionDesc={none:'미선택',king:'왕 편',rebel:'반란군 편',neutral:'중립'};
  var ctx='\n[현재 왕국 상황: '+(phaseNames[kingdomPhase]||'알 수 없음')+
    ' | 플레이어 팩션: '+(factionDesc[playerFaction]||'미선택')+']';

  if(kingdomPhase>=1){
    ctx+='\n균열에서 이상한 몬스터들이 계속 나타나고 있다는 소문이 돌고 있다.';
  }
  if(kingdomPhase>=3){
    ctx+='\n반란 음모가 발각되었다는 소문이 마을에 퍼지고 있다.';
  }
  if(kingdomPhase>=4){
    ctx+='\n쿠데타가 발생했다! 마을 분위기가 매우 긴장되어 있다.';
  }
  if(kingdomPhase>=5){
    if(playerFaction==='king')ctx+='\n플레이어는 왕 편이다. 왕국 NPC들은 우호적으로 반응한다.';
    else if(playerFaction==='rebel')ctx+='\n플레이어는 반란군 편이다. 왕국 NPC들은 경계한다.';
    else ctx+='\n플레이어는 중립이다. 양쪽 모두 어느 정도 경계한다.';
  }
  if(kingdomPhase>=6){
    ctx+='\n내전이 끝났다.';
  }
  return ctx;
}

/* ── 국왕 대화 후크 ── */
function onKingNpcTalk(){
  if(kingdomPhase===0){
    /* phase 0: 첫 대화시 자동으로 퀘스트 부여 */
    setTimeout(checkKingTalkPhase0,800);
  }else if(kingdomPhase>=5&&playerFaction==='king'){
    /* 내전 퀘스트 완료 확인 */
    var cwq=_getCivilWarQuest();
    if(cwq&&cwq.ready&&kingdomPhase<6){
      addChat('npc','(국왕) 레오하르트','반란군이 물러났다! 잘 해줬다, 용사여.');
    }
  }
}

/* ── 반란군 NPC 대화 후크 ── */
function onRebelNpcTalk(){
  if(kingdomPhase>=5&&playerFaction==='rebel'){
    var cwq=_getCivilWarQuest();
    if(cwq&&cwq.ready&&kingdomPhase<6){
      addChat('npc','(반란군 수장) 카이론','왕실 보급선이 막혔다. 우리의 승리가 가까워졌다!');
    }
  }
}

/* ── 메인 루프에서 호출되는 트리거 체크 ── */
var _kingdomCheckTimer=0;
function checkKingdomTriggers(dt){
  if(!_kingdomInitDone)return;
  _kingdomCheckTimer+=(dt||0.016);
  if(_kingdomCheckTimer<2)return;/* 2초마다 체크 */
  _kingdomCheckTimer=0;

  /* NPC 시스템 프롬프트에 왕국 컨텍스트 주입 (주기적 갱신) */
  _injectKingdomContext();

  /* phase 4 쿠데타 재확인 (저장된 상태 복원 후) */
  if(kingdomPhase===4&&!_phase4Triggered){
    _phase4Triggered=true;
    _spawnRebelSoldiers();
    _spawnRebelNpc();
    setTimeout(_showFactionChoice,1000);
  }
}

function _injectKingdomContext(){
  /* 주요 NPC들 프롬프트에 왕국 상황 컨텍스트 추가 */
  var targets=['(이장) 박건호','(상인) 김도윤','(대장장이) 이태산','(여관주인) 마리아'];
  targets.forEach(function(name){
    var ai=NPC_AI[name];
    if(!ai)return;
    /* _kingdomCtxInjected 플래그로 중복 방지 — 페이즈 변경시 재주입 */
    if(ai._kingdomPhase===kingdomPhase&&ai._kingdomFaction===playerFaction)return;
    ai._kingdomPhase=kingdomPhase;
    ai._kingdomFaction=playerFaction;
    /* 기존 system에서 이전 왕국 컨텍스트 제거 후 새로 추가 */
    var baseSystem=ai._baseSystem||ai.system;
    if(!ai._baseSystem)ai._baseSystem=ai.system;
    ai.system=baseSystem+getKingdomContextForNpc(name);
  });
}

/* ── 초기화 ── */
function initKingdom(){
  if(_kingdomInitDone)return;
  _kingdomInitDone=true;

  loadKingdomState();
  _registerKingdomNpcAI();
  _spawnKingNpc();

  /* 저장된 상태 복원 */
  if(kingdomPhase>=4){
    _phase4Triggered=true;
    _spawnRebelSoldiers();
    _spawnRebelNpc();
  }
  if(kingdomPhase>=5){
    _applyFactionEffects();
  }
  if(kingdomPhase===6&&!_phase6Triggered){
    _phase6Triggered=true;
  }

  /* 왕국 컨텍스트 초기 주입 */
  _injectKingdomContext();

  addChat('sys','[시스템]','왕국 스토리 시스템이 활성화되었습니다. 성 근처에서 국왕을 찾아보세요.');
  console.log('[Kingdom] initKingdom done. phase='+kingdomPhase+' faction='+playerFaction);
}

/* ── NPC talk 후크 — world.js의 talk() 에서 호출 ── */
function onKingdomNpcInteract(npcName){
  if(npcName==='(국왕) 레오하르트')onKingNpcTalk();
  else if(npcName==='(반란군 수장) 카이론')onRebelNpcTalk();
}
