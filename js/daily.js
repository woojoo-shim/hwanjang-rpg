/* ════════════ 일일 시스템 (퀘스트 + 로그인 보상) ════════════ */
/* 의존: inventory.js (gold, addItem), player.js (playerEXP, checkLevelUp), ui.js (addChat)
   선언: checkDailyLogin, dailyQuests, refreshDailyQuests */

var dailyQuests=[];
var _dailyData=null;

/* ── 일일 퀘스트 풀 ── */
var DAILY_QUEST_POOL=[
  {name:'토끼 사냥꾼',desc:'토끼 5마리 처치',type:'kill',target:'토끼',count:5,reward:{gold:150,exp:200}},
  {name:'사슴 퇴치',desc:'사슴 3마리 처치',type:'kill',target:'사슴',count:3,reward:{gold:200,exp:300}},
  {name:'슬라임 청소',desc:'슬라임 5마리 처치',type:'kill',target:'슬라임',count:5,reward:{gold:180,exp:250}},
  {name:'독두꺼비 토벌',desc:'독두꺼비 3마리 처치',type:'kill',target:'독두꺼비',count:3,reward:{gold:280,exp:400}},
  {name:'고블린 소탕',desc:'고블린 4마리 처치',type:'kill',target:'고블린',count:4,reward:{gold:400,exp:600}},
  {name:'늑대 사냥',desc:'늑대 3마리 처치',type:'kill',target:'늑대',count:3,reward:{gold:500,exp:700}},
  {name:'사슴고기 수집',desc:'사슴고기 3개 수집',type:'collect',target:'deer_meat',count:3,reward:{gold:180,exp:200}},
  {name:'마법 수정 수집',desc:'마법 수정 2개 수집',type:'collect',target:'magic_crystal',count:2,reward:{gold:400,exp:500}},
  {name:'별 파편 수집',desc:'별 파편 1개 수집',type:'collect',target:'star_fragment',count:1,reward:{gold:600,exp:800}},
  {name:'던전 도전',desc:'아무 던전 1회 클리어',type:'dungeon',target:'any',count:1,reward:{gold:1000,exp:1500}},
];

/* ── 로그인 보상 (7일 주기) ── */
var DAILY_LOGIN_REWARDS=[
  {day:1,gold:100,exp:150,item:null,desc:'100 골드 + 150 EXP'},
  {day:2,gold:150,exp:200,item:'red_potion',desc:'150 골드 + 빨간 포션'},
  {day:3,gold:200,exp:300,item:null,desc:'200 골드 + 300 EXP'},
  {day:4,gold:250,exp:400,item:'blue_potion',desc:'250 골드 + 파란 포션'},
  {day:5,gold:300,exp:500,item:null,desc:'300 골드 + 500 EXP'},
  {day:6,gold:400,exp:700,item:'ether',desc:'400 골드 + 에테르'},
  {day:7,gold:1000,exp:1500,item:'star_fragment',desc:'★ 1000 골드 + 별 파편!'},
];

/* ── 오늘 날짜 키 (YYYY-MM-DD) ── */
function getTodayKey(){
  var d=new Date();
  return d.getFullYear()+'-'+(d.getMonth()+1<10?'0':'')+( d.getMonth()+1)+'-'+(d.getDate()<10?'0':'')+d.getDate();
}

/* ── 일일 데이터 로드 ── */
function loadDailyData(){
  try{
    var s=localStorage.getItem('dailyData');
    if(s)_dailyData=JSON.parse(s);
  }catch(e){}
  if(!_dailyData)_dailyData={lastLogin:'',streak:0,questDate:'',quests:[],claimed:false};
}

function saveDailyData(){
  try{localStorage.setItem('dailyData',JSON.stringify(_dailyData));}catch(e){}
}

/* ── 로그인 보상 체크 ── */
function checkDailyLogin(){
  loadDailyData();
  var today=getTodayKey();

  if(_dailyData.lastLogin===today)return;/* 이미 오늘 받음 */

  /* 연속 출석 계산 */
  var yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);
  var yKey=yesterday.getFullYear()+'-'+(yesterday.getMonth()+1<10?'0':'')+(yesterday.getMonth()+1)+'-'+(yesterday.getDate()<10?'0':'')+yesterday.getDate();

  if(_dailyData.lastLogin===yKey){
    _dailyData.streak++;
  }else{
    _dailyData.streak=1;
  }
  _dailyData.lastLogin=today;
  _dailyData.claimed=false;

  /* 7일 주기 */
  var dayIdx=((_dailyData.streak-1)%7);
  var reward=DAILY_LOGIN_REWARDS[dayIdx];

  /* 보상 지급 */
  gold+=reward.gold;
  playerEXP+=reward.exp;
  if(reward.item){
    var df=getItemDef(reward.item);
    if(df)addItem(reward.item,1,df);
  }
  if(typeof checkLevelUp==='function')checkLevelUp();
  if(typeof document.getElementById('inv-gold')!=='undefined'){
    var ge=document.getElementById('inv-gold');
    if(ge)ge.textContent='💰 '+gold+' 골드';
  }

  _dailyData.claimed=true;
  saveDailyData();

  /* UI 알림 */
  setTimeout(function(){
    showDailyLoginPopup(reward,_dailyData.streak);
  },2000);

  /* 일일 퀘스트도 갱신 */
  refreshDailyQuests();
}

/* ── 로그인 보상 팝업 ── */
function showDailyLoginPopup(reward,streak){
  var popup=document.createElement('div');
  popup.style.cssText='position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#0c0c1eee;border:2px solid #c9a84c;border-radius:12px;padding:24px;z-index:99998;color:#f0e4bb;text-align:center;min-width:280px;font-family:inherit;';

  var dayInCycle=((streak-1)%7)+1;
  popup.innerHTML=
    '<div style="color:#c9a84c;font-size:18px;font-weight:bold;margin-bottom:8px;">🎁 일일 출석 보상</div>'+
    '<div style="color:#ffdd44;font-size:14px;margin-bottom:12px;">'+streak+'일 연속 출석! ('+dayInCycle+'/7일차)</div>'+
    '<div style="background:#1a1a2e;padding:12px;border-radius:8px;margin-bottom:12px;">'+
    '<div style="font-size:16px;">'+reward.desc+'</div>'+
    '</div>'+
    '<div style="display:flex;gap:4px;justify-content:center;margin-bottom:12px;">'+
    DAILY_LOGIN_REWARDS.map(function(r,i){
      var active=i<dayInCycle;
      var current=i===dayInCycle-1;
      return '<div style="width:32px;height:32px;border-radius:50%;border:2px solid '+(current?'#ffdd44':active?'#c9a84c':'#333')+';background:'+(active?'#c9a84c33':'#111')+';display:flex;align-items:center;justify-content:center;font-size:11px;color:'+(active?'#ffdd44':'#555')+';">'+(i+1)+'</div>';
    }).join('')+
    '</div>'+
    '<button onclick="this.parentNode.remove()" style="background:#c9a84c;color:#0c0c1e;border:none;padding:10px 30px;font-size:14px;font-weight:bold;cursor:pointer;font-family:inherit;border-radius:6px;">받기</button>';

  document.body.appendChild(popup);
  if(typeof SFX!=='undefined')SFX.questComplete();
}

/* ── 일일 퀘스트 갱신 ── */
function refreshDailyQuests(){
  var today=getTodayKey();
  if(_dailyData.questDate===today&&_dailyData.quests.length>0){
    /* 오늘 이미 생성된 퀘스트 복원 */
    dailyQuests=_dailyData.quests;
    return;
  }

  /* 새 퀘스트 3개 랜덤 선택 */
  var pool=DAILY_QUEST_POOL.slice();
  dailyQuests=[];
  for(var i=0;i<3&&pool.length>0;i++){
    var idx=Math.floor(Math.random()*pool.length);
    var q=pool.splice(idx,1)[0];
    dailyQuests.push({
      id:'daily_'+i+'_'+today,
      name:'[일일] '+q.name,
      desc:q.desc,
      type:q.type,
      target:q.target,
      count:q.count,
      progress:0,
      reward:q.reward,
      completed:false
    });
  }

  _dailyData.questDate=today;
  _dailyData.quests=dailyQuests;
  saveDailyData();

  /* 퀘스트 트래커에 추가 */
  dailyQuests.forEach(function(dq){
    if(dq.completed)return;
    var tq={
      id:dq.id,name:dq.name,desc:dq.desc,
      type:dq.type,target:dq.target,count:dq.count,progress:dq.progress,
      rewardType:'gold',rewardAmount:String(dq.reward.gold),
      npc:'일일',ready:false,isDaily:true
    };
    /* 중복 체크 */
    var exists=false;
    for(var j=0;j<activeQuests.length;j++){
      if(activeQuests[j].id===dq.id){exists=true;break;}
    }
    if(!exists){
      activeQuests.push(tq);
    }
  });
  if(typeof renderQuestTracker==='function')renderQuestTracker();

  addChat('sys','[시스템]','📋 오늘의 일일 퀘스트 3개가 갱신되었습니다!');
}

/* ── 일일 퀘스트 진행 체크 (킬/수집 시 호출) ── */
function checkDailyQuestProgress(type,target){
  dailyQuests.forEach(function(dq){
    if(dq.completed)return;
    if(dq.type===type&&dq.target===target){
      dq.progress++;
      if(dq.progress>=dq.count){
        dq.completed=true;
        /* 보상 지급 */
        gold+=dq.reward.gold;
        playerEXP+=dq.reward.exp;
        if(typeof document.getElementById('inv-gold')!=='undefined'){
          var ge=document.getElementById('inv-gold');
          if(ge)ge.textContent='💰 '+gold+' 골드';
        }
        if(typeof checkLevelUp==='function')checkLevelUp();
        addChat('sys','[일일]','✅ '+dq.name+' 완료! (+'+dq.reward.gold+'골드, +'+dq.reward.exp+'EXP)');
        if(typeof SFX!=='undefined')SFX.questComplete();
      }
      /* 퀘스트 트래커 업데이트 */
      for(var j=0;j<activeQuests.length;j++){
        if(activeQuests[j].id===dq.id){
          activeQuests[j].progress=dq.progress;
          if(dq.completed){
            activeQuests.splice(j,1);
          }
          break;
        }
      }
      if(typeof renderQuestTracker==='function')renderQuestTracker();
      _dailyData.quests=dailyQuests;
      saveDailyData();
    }
  });
}
