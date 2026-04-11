/* ════════════ NPC 호감도 시스템 ════════════ */
/* 의존: inventory.js (gold), ui.js (addChat), auth.js (savePlayerData)
   선언: playerReputation, getRep, changeRep, getRepTier, getPriceMultiplier, getRewardMultiplier */

/* NPC별 호감도 (0~100, 기본 50) */
var playerReputation={};

function getRep(npcName){
  if(playerReputation[npcName]===undefined)playerReputation[npcName]=50;
  return playerReputation[npcName];
}

function changeRep(npcName,delta,reason){
  var old=getRep(npcName);
  var nw=Math.max(0,Math.min(100,old+delta));
  playerReputation[npcName]=nw;
  if(Math.abs(delta)>=5&&typeof addChat==='function'){
    var sign=delta>0?'+':'';
    var color=delta>0?'#88ff88':'#ff6666';
    addChat('sys','[호감도]','<span style="color:'+color+'">'+npcName+' '+sign+delta+' ('+reason+')</span>');
  }
  if(typeof savePlayerData==='function')savePlayerData();
  if(typeof sendRepUpdate==='function')sendRepUpdate();
}

/* 모든 NPC 호감도에 적용 (PK 등) */
function changeAllRep(delta,reason){
  var names=Object.keys(playerReputation);
  /* 기본 NPC들도 포함 */
  var defaults=['(마을이장) 박건호','(상인) 김도윤','(대장장이) 이태산','(코디샵) 루나','(무기상인) 발두르','(방어구상인) 헥토르','(여관주인) 마리아'];
  defaults.forEach(function(n){if(names.indexOf(n)===-1)names.push(n);});
  names.forEach(function(n){
    if(playerReputation[n]===undefined)playerReputation[n]=50;
    playerReputation[n]=Math.max(0,Math.min(100,playerReputation[n]+delta));
  });
  if(typeof addChat==='function'){
    var sign=delta>0?'+':'';
    var color=delta>0?'#88ff88':'#ff6666';
    addChat('sys','[호감도]','<span style="color:'+color+'">모든 NPC '+sign+delta+' ('+reason+')</span>');
  }
  if(typeof savePlayerData==='function')savePlayerData();
}

/* 모든 NPC 중 가장 낮은 호감도 */
function getMinReputation(){
  var keys=Object.keys(playerReputation);
  if(keys.length===0)return 50;
  var min=100;
  for(var i=0;i<keys.length;i++){
    if(playerReputation[keys[i]]<min)min=playerReputation[keys[i]];
  }
  return min;
}

/* 호감도 등급 */
function getRepTier(npcName){
  var r=getRep(npcName);
  if(r>=80)return{name:'친밀',color:'#44ff88',icon:'💚'};
  if(r>=60)return{name:'호감',color:'#88ff44',icon:'🙂'};
  if(r>=40)return{name:'보통',color:'#dddddd',icon:'😐'};
  if(r>=20)return{name:'냉담',color:'#ff8844',icon:'😒'};
  return{name:'적대',color:'#ff4444',icon:'😡'};
}

/* 가격 배율 (구매 시) — 낮을수록 비쌈 */
function getPriceMultiplier(npcName){
  var r=getRep(npcName);
  /* 0=200%, 50=100%, 100=80% */
  if(r>=50)return 1.0-(r-50)/50*0.2;/* 50→100: 1.0 → 0.8 */
  return 1.0+(50-r)/50*1.0;/* 0→50: 2.0 → 1.0 */
}

/* 판매 배율 — 낮을수록 싸게 사감 */
function getSellMultiplier(npcName){
  var r=getRep(npcName);
  if(r>=50)return 0.5+(r-50)/50*0.2;/* 50→100: 0.5 → 0.7 */
  return 0.5-(50-r)/50*0.3;/* 0→50: 0.2 → 0.5 */
}

/* 퀘스트 보상 배율 */
function getRewardMultiplier(npcName){
  var r=getRep(npcName);
  /* 0=50%, 50=100%, 100=150% */
  return 0.5+r/100;
}

/* 흥정 수락 확률 배율 */
function getHaggleBonus(npcName){
  var r=getRep(npcName);
  /* 0=-30%, 50=0%, 100=+30% */
  return (r-50)/100*0.6;
}

/* 대화 톤 (시스템 프롬프트 suffix) */
function getRepPromptSuffix(npcName){
  var tier=getRepTier(npcName);
  var r=getRep(npcName);
  if(r>=80)return '\n\n[플레이어 호감도: 친밀 '+r+'/100] 이 플레이어는 너와 친밀한 관계야. 따뜻하고 친근하게 반겨줘. 가격도 기꺼이 깎아주고, 특별한 호의를 베풀어도 돼.';
  if(r>=60)return '\n\n[플레이어 호감도: 호감 '+r+'/100] 이 플레이어에게 우호적으로 대해. 친절한 말투.';
  if(r>=40)return '\n\n[플레이어 호감도: 보통 '+r+'/100] 일반적인 상인 말투로 대해.';
  if(r>=20)return '\n\n[플레이어 호감도: 냉담 '+r+'/100] 이 플레이어가 맘에 들지 않아. 차갑고 퉁명스럽게 대해. 가격 할인은 거의 안 해주고, 대화도 짧게 끊어. 비꼬는 말투를 써도 좋아.';
  return '\n\n[플레이어 호감도: 적대 '+r+'/100] 이 플레이어가 매우 싫어. 경멸하는 말투로 대해. 거래는 해주지만 최대한 불친절하게. 그가 떠나길 원해. 가격은 최고가로만 말하고, 흥정은 거부해. "꺼져", "돈이나 내놔" 같은 적대적 표현도 허용.';
}

/* ── NPC 소문 시스템: 10분마다 호감도가 마을 평균으로 수렴 ── */
var _repGossipTimer=null;

function startRepGossip(){
  if(_repGossipTimer)clearInterval(_repGossipTimer);
  _repGossipTimer=setInterval(function(){
    var keys=Object.keys(playerReputation);
    if(keys.length<2)return;
    /* 전체 평균 계산 */
    var sum=0;
    for(var i=0;i<keys.length;i++)sum+=playerReputation[keys[i]];
    var avg=Math.round(sum/keys.length);
    /* 각 NPC 호감도를 평균 쪽으로 30% 수렴 */
    var changed=false;
    for(var j=0;j<keys.length;j++){
      var old=playerReputation[keys[j]];
      var diff=avg-old;
      if(Math.abs(diff)<2)continue;
      var shift=Math.round(diff*0.3);
      playerReputation[keys[j]]=Math.max(0,Math.min(100,old+shift));
      changed=true;
    }
    if(changed){
      if(typeof addChat==='function'){
        if(avg<40){
          addChat('sys','[소문]','<span style="color:#ff8844">NPC들 사이에서 나쁜 소문이 퍼지고 있다...</span>');
        }else if(avg>65){
          addChat('sys','[소문]','<span style="color:#88ff88">NPC들 사이에서 좋은 평판이 퍼지고 있다.</span>');
        }else{
          addChat('sys','[소문]','<span style="color:#aaaaaa">NPC들이 당신에 대해 이야기하고 있다...</span>');
        }
      }
      if(typeof savePlayerData==='function')savePlayerData();
      if(typeof sendRepUpdate==='function')sendRepUpdate();
    }
  },600000);/* 10분 = 600,000ms */
}

/* 게임 시작 시 호출 */
if(typeof document!=='undefined'){
  document.addEventListener('DOMContentLoaded',function(){
    setTimeout(startRepGossip,5000);
  });
}
