/* ════════════ 퀘스트 시스템 ════════════ */
/* 의존: config.js (ITEM_POOL, ICON)
        ui.js (addChat)
        inventory.js (addItem, gold)
        player.js (playerEXP, playerLevel, updPlayerHpBar)
   선언: quests, activeQuests, questNotifQueue */

var quests=[];       // 완료된 퀘스트 id 목록
var activeQuests=[]; // {id,name,desc,type,target,count,progress,rewardType,rewardAmount,npc,ready}
var questNotifQueue=[];
var questNotifShowing=false;

/* ── 퀘스트 파싱 ── */
/* ── 몬스터 난이도별 보상 상한 (몬스터 레벨 × 수량 기반) ── */
function capQuestReward(target,count,rewardType,rewardAmount){
  var mDef=(typeof MONSTER_DEFS!=='undefined')?MONSTER_DEFS.find(function(x){return x.name===target;}):null;
  var lv=mDef?(mDef.lv||1):1;
  var n=parseInt(rewardAmount)||0;
  if(rewardType==='gold'){
    var maxGold=lv*count*30;/* 레벨당 마리당 30골드 */
    if(n>maxGold)n=maxGold;
  }else if(rewardType==='exp'){
    var maxExp=lv*count*50;
    if(n>maxExp)n=maxExp;
  }else if(rewardType==='item'){
    /* 아이템은 수량만 제한 */
    if(n>5)n=5;
  }
  return String(n);
}

function parseQuest(reply){
  var re=/\[QUEST:([^\]]+)\]/;
  var m=reply.match(re);
  if(!m)return{clean:reply,quest:null};
  var clean=reply.replace(re,'').trim();
  var p=m[1].split('|');
  if(p.length<7)return{clean:clean,quest:null};
  var cnt=Math.min(parseInt(p[4])||1,20);/* 최대 20개 */
  var q={
    id:'quest_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),
    name:p[0].trim(),
    desc:p[1].trim(),
    type:p[2].trim(),       // kill, collect
    target:p[3].trim(),     // 몬스터이름 또는 아이템id
    count:cnt,
    rewardType:p[5].trim(), // exp, gold, item
    rewardAmount:capQuestReward(p[3].trim(),cnt,p[5].trim(),p[6].trim()),
    ready:false,            // 목표 달성 여부
  };
  return{clean:clean,quest:q};
}

/* ── AI 응답에서 퀘스트 자동 감지 ── */
var _questMonsters=['토끼','사슴','슬라임','독두꺼비','고블린','늑대','용암 골렘','파이어드레이크','정글 거미','독사','숲 유인원','정글 표범','거대 모기','나무 정령'];
var _questItems=['deer_meat','rabbit_liver','magic_crystal','star_fragment','dragon_scale','deer_antler'];

function autoDetectQuest(reply,npcName){
  /* 처치/토벌 키워드 + 몬스터 이름 감지 */
  var killWords=['처치','퇴치','토벌','잡아','사냥','소탕','제거','해치워'];
  var collectWords=['모아','수집','가져','구해','찾아'];
  var foundMonster=null,foundItem=null,foundType=null,foundCount=3;

  for(var i=0;i<_questMonsters.length;i++){
    if(reply.indexOf(_questMonsters[i])!==-1){foundMonster=_questMonsters[i];break;}
  }
  for(var j=0;j<_questItems.length;j++){
    if(reply.indexOf(_questItems[j])!==-1){foundItem=_questItems[j];break;}
  }

  var isKill=false,isCollect=false;
  for(var k=0;k<killWords.length;k++){if(reply.indexOf(killWords[k])!==-1){isKill=true;break;}}
  for(var l=0;l<collectWords.length;l++){if(reply.indexOf(collectWords[l])!==-1){isCollect=true;break;}}

  /* 숫자 감지 */
  var numMatch=reply.match(/(\d+)\s*(?:마리|개|명)/);
  if(numMatch)foundCount=parseInt(numMatch[1])||3;

  if(isKill&&foundMonster){
    foundType='kill';
    var q={
      id:'quest_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),
      name:foundMonster+' 토벌',
      desc:npcName+'의 의뢰: '+foundMonster+'를 '+foundCount+'마리 처치',
      type:'kill',
      target:foundMonster,
      count:foundCount,
      rewardType:'gold',
      rewardAmount:''+(foundCount*50),
      ready:false
    };
    return{clean:reply,quest:q};
  }
  if(isCollect&&foundItem){
    var itemName=foundItem.replace(/_/g,' ');
    var q2={
      id:'quest_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),
      name:itemName+' 수집',
      desc:npcName+'의 의뢰: '+itemName+'을(를) '+foundCount+'개 수집',
      type:'collect',
      target:foundItem,
      count:foundCount,
      rewardType:'exp',
      rewardAmount:''+(foundCount*100),
      ready:false
    };
    return{clean:reply,quest:q2};
  }
  return{clean:reply,quest:null};
}

/* ── 퀘스트 알림 UI ── */
function showQuestNotif(q,npcName){
  q.npc=npcName;
  /* 중복 체크 — 진행 중이거나 완료된 동일 퀘스트 거부 */
  for(var i=0;i<activeQuests.length;i++){
    var a=activeQuests[i];
    if(a.type===q.type&&a.target===q.target&&a.npc===npcName){
      addChat('sys','[시스템]','이미 진행 중인 퀘스트입니다.');
      return;
    }
  }
  if(typeof quests!=='undefined'){
    for(var j=0;j<quests.length;j++){
      if(quests[j]===q.id)return;
    }
  }
  /* 알림 큐에 이미 같은 퀘스트가 있는지 */
  for(var k=0;k<questNotifQueue.length;k++){
    var qn=questNotifQueue[k];
    if(qn.type===q.type&&qn.target===q.target&&qn.npc===npcName)return;
  }
  questNotifQueue.push(q);
  if(!questNotifShowing)popQuestNotif();
}

function popQuestNotif(){
  if(questNotifQueue.length===0){questNotifShowing=false;return;}
  questNotifShowing=true;
  var q=questNotifQueue.shift();
  var el=document.getElementById('quest-notif');
  document.getElementById('qn-name').textContent=q.name;
  document.getElementById('qn-desc').textContent=q.desc;
  var targetLabel=q.type==='kill'?q.target+' '+q.count+'마리 처치':q.target+' '+q.count+'개 수집';
  document.getElementById('qn-obj').textContent='목표: '+targetLabel;
  var rewardLabel=q.rewardType==='exp'?'경험치 '+q.rewardAmount:q.rewardType==='gold'?q.rewardAmount+' 골드':'아이템 '+q.rewardAmount;
  document.getElementById('qn-reward').textContent='보상: '+rewardLabel;
  el.classList.add('show');
  document.getElementById('qn-accept').onclick=function(){acceptQuest(q);el.classList.remove('show');setTimeout(popQuestNotif,300);};
  document.getElementById('qn-reject').onclick=function(){addChat('sys','[시스템]','퀘스트 ['+q.name+']을(를) 거절했습니다.');el.classList.remove('show');setTimeout(popQuestNotif,300);};
}

function acceptQuest(q){
  q.progress=0;
  q.ready=false;
  activeQuests.push(q);
  if(typeof SFX!=='undefined')SFX.questAccept();
  addChat('sys','[시스템]','퀘스트 수락: ['+q.name+']');
  renderQuestTracker();
  // collect 타입이면 현재 인벤토리에서 이미 있는 수량 체크
  if(q.type==='collect'){
    var slot=inventory.find(function(s){return s.itemId===q.target;});
    if(slot)q.progress=Math.min(slot.qty,q.count);
    if(q.progress>=q.count){markQuestReady(q);}
    else renderQuestTracker();
  }
}

/* ── 목표 달성 → NPC에게 돌아가기 표시 ── */
function markQuestReady(q){
  q.ready=true;
  addChat('sys','[시스템]','퀘스트 ['+q.name+'] 목표 달성! '+q.npc+'에게 돌아가세요.');
  renderQuestTracker();
}

/* ── NPC에게 말 걸 때 완료 가능한 퀘스트 확인 ── */
function tryTurnInQuests(npcName){
  var turned=false;
  var toRemove=[];
  activeQuests.forEach(function(q){
    if(q.ready&&q.npc===npcName){
      completeQuest(q);
      toRemove.push(q.id);
      turned=true;
    }
  });
  if(toRemove.length>0){
    activeQuests=activeQuests.filter(function(a){return toRemove.indexOf(a.id)===-1;});
    renderQuestTracker();
  }
  return turned;
}

/* ── 퀘스트 트래커 (좌측 상단) ── */
function renderQuestTracker(){
  var el=document.getElementById('quest-tracker');
  if(activeQuests.length===0){el.style.display='none';return;}
  el.style.display='block';
  var html='<div class="qt-title">▣ 퀘스트</div>';
  activeQuests.forEach(function(q){
    var pct=Math.min(100,Math.floor(q.progress/q.count*100));
    var targetLabel=q.type==='kill'?q.target:q.target;
    var readyTag=q.ready?'<span class="qt-ready">✦ 수령 가능</span>':'';
    html+='<div class="qt-item'+(q.ready?' qt-done':'')+'">'+
      '<div class="qt-name">'+q.name+readyTag+'</div>'+
      '<div class="qt-prog">'+targetLabel+' '+q.progress+'/'+q.count+'</div>'+
      '<div class="qt-bar"><div class="qt-bar-fill'+(q.ready?' qt-bar-done':'')+'" style="width:'+pct+'%"></div></div>'+
      (q.ready?'<div class="qt-turnin">→ '+q.npc+'에게 돌아가기</div>':'')+
      '</div>';
  });
  el.innerHTML=html;
}

/* ── 퀘스트 진행 업데이트 ── */
function onMonsterKill(monsterName){
  activeQuests.forEach(function(q){
    if(q.type==='kill'&&!q.ready&&q.target===monsterName){
      q.progress=Math.min(q.progress+1,q.count);
      renderQuestTracker();
      if(q.progress>=q.count)markQuestReady(q);
    }
  });
}

function onItemCollect(itemId,qty){
  activeQuests.forEach(function(q){
    if(q.type==='collect'&&!q.ready&&q.target===itemId){
      q.progress=Math.min(q.progress+qty,q.count);
      renderQuestTracker();
      if(q.progress>=q.count)markQuestReady(q);
    }
  });
}

/* ── 퀘스트 완료 (보상 지급) ── */
function completeQuest(q){
  if(typeof SFX!=='undefined')SFX.questComplete();
  addChat('sys','[시스템]','✦ 퀘스트 완료: ['+q.name+'] ✦');
  /* 호감도 기반 보상 배율 */
  var repMul=(typeof getRewardMultiplier==='function'&&q.npc)?getRewardMultiplier(q.npc):1.0;
  // 보상 지급
  if(q.rewardType==='exp'){
    var amt=Math.floor((parseInt(q.rewardAmount)||0)*repMul);
    playerEXP+=amt;
    addChat('sys','[시스템]','경험치 +'+amt+' 획득!');
    checkLevelUp();
  }else if(q.rewardType==='gold'){
    var amt=Math.floor((parseInt(q.rewardAmount)||0)*repMul);
    gold+=amt;
    document.getElementById('inv-gold').textContent='💰 '+gold+' 골드';
    addChat('sys','[시스템]','골드 +'+amt+' 획득!');
  }else if(q.rewardType==='item'){
    addItem(q.rewardAmount,1);
    var def=getItemDef(q.rewardAmount);
    addChat('sys','[시스템]','아이템 ['+(def?def.name:q.rewardAmount)+'] 획득!');
  }
  /* 퀘스트 완료 시 호감도 상승 */
  if(q.npc&&typeof changeRep==='function')changeRep(q.npc,5,'퀘스트 완료');
  // 완료 이펙트
  showQuestComplete(q.name);
  // 완료 목록에 추가
  quests.push(q.id);
}

function showQuestComplete(name){
  var el=document.getElementById('quest-complete');
  el.textContent='✦ 퀘스트 완료: '+name+' ✦';
  el.classList.add('show');
  setTimeout(function(){el.classList.remove('show');},3500);
}

/* checkLevelUp은 player.js에 정의됨 — 퀘스트 보상에서 직접 호출 */
