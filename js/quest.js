/* ════════════ 퀘스트 시스템 ════════════ */
/* 의존: config.js (ITEM_POOL, ICON)
        ui.js (addChat)
        inventory.js (addItem, gold)
        player.js (playerEXP, playerLevel, updPlayerHpBar)
   선언: quests, activeQuests, questNotifQueue */

var quests=[];       // 완료된 퀘스트 id 목록
var activeQuests=[]; // {id,name,desc,type,target,count,progress,rewardType,rewardAmount,npc}
var questNotifQueue=[];
var questNotifShowing=false;

/* ── 퀘스트 파싱 ── */
function parseQuest(reply){
  var re=/\[QUEST:([^\]]+)\]/;
  var m=reply.match(re);
  if(!m)return{clean:reply,quest:null};
  var clean=reply.replace(re,'').trim();
  var p=m[1].split('|');
  if(p.length<7)return{clean:clean,quest:null};
  var q={
    id:'quest_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),
    name:p[0].trim(),
    desc:p[1].trim(),
    type:p[2].trim(),       // kill, collect
    target:p[3].trim(),     // 몬스터id 또는 아이템id
    count:parseInt(p[4])||1,
    rewardType:p[5].trim(), // exp, gold, item
    rewardAmount:p[6].trim(),
  };
  return{clean:clean,quest:q};
}

/* ── 퀘스트 알림 UI ── */
function showQuestNotif(q,npcName){
  q.npc=npcName;
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
  activeQuests.push(q);
  addChat('sys','[시스템]','퀘스트 수락: ['+q.name+']');
  renderQuestTracker();
  // collect 타입이면 현재 인벤토리에서 이미 있는 수량 체크
  if(q.type==='collect'){
    var slot=inventory.find(function(s){return s.itemId===q.target;});
    if(slot)q.progress=Math.min(slot.qty,q.count);
    if(q.progress>=q.count)completeQuest(q);
    else renderQuestTracker();
  }
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
    html+='<div class="qt-item">'+
      '<div class="qt-name">'+q.name+'</div>'+
      '<div class="qt-prog">'+targetLabel+' '+q.progress+'/'+q.count+'</div>'+
      '<div class="qt-bar"><div class="qt-bar-fill" style="width:'+pct+'%"></div></div>'+
      '</div>';
  });
  el.innerHTML=html;
}

/* ── 퀘스트 진행 업데이트 ── */
function onMonsterKill(monsterName){
  activeQuests.forEach(function(q){
    if(q.type==='kill'&&q.target===monsterName){
      q.progress=Math.min(q.progress+1,q.count);
      renderQuestTracker();
      if(q.progress>=q.count)completeQuest(q);
    }
  });
}

function onItemCollect(itemId,qty){
  activeQuests.forEach(function(q){
    if(q.type==='collect'&&q.target===itemId){
      q.progress=Math.min(q.progress+qty,q.count);
      renderQuestTracker();
      if(q.progress>=q.count)completeQuest(q);
    }
  });
}

/* ── 퀘스트 완료 ── */
function completeQuest(q){
  addChat('sys','[시스템]','✦ 퀘스트 완료: ['+q.name+'] ✦');
  // 보상 지급
  if(q.rewardType==='exp'){
    var amt=parseInt(q.rewardAmount)||0;
    playerEXP+=amt;
    addChat('sys','[시스템]','경험치 +'+amt+' 획득!');
    checkLevelUp();
  }else if(q.rewardType==='gold'){
    var amt=parseInt(q.rewardAmount)||0;
    gold+=amt;
    document.getElementById('inv-gold').textContent='💰 '+gold+' 골드';
    addChat('sys','[시스템]','골드 +'+amt+' 획득!');
  }else if(q.rewardType==='item'){
    addItem(q.rewardAmount,1);
    var def=getItemDef(q.rewardAmount);
    addChat('sys','[시스템]','아이템 ['+(def?def.name:q.rewardAmount)+'] 획득!');
  }
  // 완료 이펙트
  showQuestComplete(q.name);
  // 목록에서 제거
  quests.push(q.id);
  activeQuests=activeQuests.filter(function(a){return a.id!==q.id;});
  renderQuestTracker();
}

function showQuestComplete(name){
  var el=document.getElementById('quest-complete');
  el.textContent='✦ 퀘스트 완료: '+name+' ✦';
  el.classList.add('show');
  setTimeout(function(){el.classList.remove('show');},3500);
}

/* checkLevelUp은 player.js에 정의됨 — 퀘스트 보상에서 직접 호출 */
