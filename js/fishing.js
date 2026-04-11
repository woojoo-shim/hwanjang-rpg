/* ════════════ 낚시 시스템 ════════════ */
/* 의존: player.js (PL), inventory.js (addItem, gold), ui.js (addChat), config.js (ITEM_POOL)
   선언: startFishing, FISH_POOL, fishingActive */

var fishingActive=false;
var _fishState='idle';/* idle, casting, waiting, bite, reeling, caught, failed */
var _fishTimer=0;
var _fishTarget=null;
var _fishUI=null;
var _fishBarPos=50;/* 0~100 — 물고기 위치 */
var _fishReelPos=50;/* 0~100 — 릴 위치 */
var _fishProgress=0;/* 0~100 — 잡기 진행도 */
var _fishDir=1;
var _fishSpeed=2;
var _fishDifficulty=1;

/* ── 물고기 풀 ── */
var FISH_POOL=[
  /* 일반 (강) */
  {id:'fish_common',name:'붕어',icon:'fish',rarity:'common',zone:'any',value:15,exp:10,desc:'어디서나 잡히는 평범한 물고기.'},
  {id:'fish_carp',name:'잉어',icon:'fish',rarity:'common',zone:'any',value:25,exp:15,desc:'힘이 센 민물고기.'},
  {id:'fish_trout',name:'송어',icon:'fish',rarity:'uncommon',zone:'meadow',value:40,exp:25,desc:'맑은 물에서만 잡히는 물고기.'},
  {id:'fish_catfish',name:'메기',icon:'fish',rarity:'uncommon',zone:'swamp',value:50,exp:30,desc:'늪지대의 큰 메기.'},
  {id:'fish_eel',name:'장어',icon:'fish',rarity:'rare',zone:'swamp',value:80,exp:50,desc:'미끌미끌한 장어. 요리 재료로 최고.'},
  {id:'fish_piranha',name:'피라냐',icon:'fish',rarity:'rare',zone:'jungle',value:90,exp:60,desc:'이빨이 날카로운 정글 물고기.'},
  {id:'fish_golden',name:'황금 물고기',icon:'fish',rarity:'epic',zone:'any',value:300,exp:200,desc:'전설의 황금빛 물고기!'},
  {id:'fish_dragon',name:'용의 물고기',icon:'fish',rarity:'legendary',zone:'volcano',value:1000,exp:500,desc:'용암 속에서 헤엄치는 전설의 물고기.'},
  /* 쓰레기 */
  {id:'fish_boot',name:'낡은 장화',icon:'boots',rarity:'common',zone:'any',value:2,exp:5,desc:'누군가 버린 장화...'},
  {id:'fish_bone',name:'물고기 뼈',icon:'bone',rarity:'common',zone:'any',value:5,exp:8,desc:'이미 뼈만 남은 물고기.'},
  /* 보물 */
  {id:'fish_chest',name:'수중 보물상자',icon:'gem',rarity:'epic',zone:'any',value:500,exp:300,desc:'물속에 가라앉은 보물상자!'},
  {id:'fish_pearl',name:'진주',icon:'crystal',rarity:'rare',zone:'any',value:200,exp:100,desc:'조개 속 영롱한 진주.'},
];

/* ── 낚시 시작 조건 체크 ── */
function canFish(){
  if(!PL||!PL.group)return false;
  if(fishingActive)return false;
  if(typeof insideBuilding!=='undefined'&&insideBuilding)return false;
  if(typeof currentDungeon!=='undefined'&&currentDungeon)return false;
  /* 물 근처인지 체크 */
  var px=PL.group.position.x,pz=PL.group.position.z;
  if(typeof isOverWater==='function'){
    /* 주변 5유닛 안에 물이 있는지 */
    var dirs=[[0,3],[3,0],[0,-3],[-3,0],[2,2],[-2,2],[2,-2],[-2,-2]];
    for(var i=0;i<dirs.length;i++){
      if(isOverWater(px+dirs[i][0],pz+dirs[i][1]))return true;
    }
  }
  return false;
}

/* ── 낚시 시작 ── */
function startFishing(){
  if(!canFish()){
    addChat('sys','[시스템]','물 근처에서만 낚시할 수 있습니다.');
    return;
  }
  fishingActive=true;
  _fishState='casting';
  _fishTimer=0;
  _fishProgress=0;
  addChat('sys','[낚시]','🎣 낚싯대를 던졌다...');
  if(typeof SFX!=='undefined')SFX.teleport();
  showFishingUI();

  /* 캐스팅 후 대기 */
  setTimeout(function(){
    if(!fishingActive)return;
    _fishState='waiting';
    updateFishingUI();
    /* 1~5초 후 입질 */
    var waitTime=1000+Math.random()*4000;
    setTimeout(function(){
      if(!fishingActive||_fishState!=='waiting')return;
      _fishState='bite';
      /* 물고기 선택 */
      _fishTarget=selectFish();
      _fishDifficulty=_fishTarget.rarity==='common'?1:_fishTarget.rarity==='uncommon'?1.5:_fishTarget.rarity==='rare'?2.5:_fishTarget.rarity==='epic'?3.5:5;
      _fishSpeed=1.5+_fishDifficulty;
      _fishBarPos=50;_fishReelPos=50;_fishProgress=0;_fishDir=1;
      addChat('sys','[낚시]','❗ 입질이 왔다! 스페이스바로 릴을 감아라!');
      if(typeof SFX!=='undefined')SFX.hit();
      updateFishingUI();
    },waitTime);
  },800);
}

/* ── 물고기 선택 (존 + 등급 확률) ── */
function selectFish(){
  var zone=(typeof currentZone!=='undefined')?currentZone:'village';
  var pool=FISH_POOL.filter(function(f){return f.zone==='any'||f.zone===zone;});

  /* 등급 확률: common 50%, uncommon 25%, rare 15%, epic 8%, legendary 2% */
  var roll=Math.random();
  var rarity='common';
  if(roll>0.98)rarity='legendary';
  else if(roll>0.90)rarity='epic';
  else if(roll>0.75)rarity='rare';
  else if(roll>0.50)rarity='uncommon';

  /* LUK 보너스 */
  if(typeof playerStats!=='undefined'&&playerStats.luk>0){
    var lukBonus=playerStats.luk*0.005;
    if(Math.random()<lukBonus){
      /* 등급 한 단계 업 */
      if(rarity==='common')rarity='uncommon';
      else if(rarity==='uncommon')rarity='rare';
      else if(rarity==='rare')rarity='epic';
    }
  }

  var filtered=pool.filter(function(f){return f.rarity===rarity;});
  if(filtered.length===0)filtered=pool.filter(function(f){return f.rarity==='common';});
  return filtered[Math.floor(Math.random()*filtered.length)];
}

/* ── 낚시 UI ── */
function showFishingUI(){
  if(_fishUI){_fishUI.remove();_fishUI=null;}
  var ui=document.createElement('div');
  ui.id='fishing-ui';
  ui.style.cssText='position:fixed;bottom:120px;left:50%;transform:translateX(-50%);width:300px;background:#0c0c1eee;border:2px solid #4488cc;border-radius:10px;padding:16px;z-index:9998;color:#f0e4bb;text-align:center;font-family:inherit;';
  ui.innerHTML='<div style="color:#4488cc;font-size:16px;font-weight:bold;margin-bottom:8px;">🎣 낚시</div>'+
    '<div id="fish-status" style="margin-bottom:8px;font-size:13px;">캐스팅 중...</div>'+
    '<div id="fish-bar-wrap" style="display:none;margin-bottom:8px;">'+
      '<div style="position:relative;width:100%;height:30px;background:#1a2a3a;border-radius:4px;overflow:hidden;">'+
        '<div id="fish-target" style="position:absolute;width:20px;height:100%;background:#ff4444;border-radius:3px;transition:left .1s;"></div>'+
        '<div id="fish-reel" style="position:absolute;width:40px;height:100%;background:#44ff4488;border:2px solid #44ff44;border-radius:3px;"></div>'+
      '</div>'+
    '</div>'+
    '<div id="fish-progress-wrap" style="display:none;margin-bottom:8px;">'+
      '<div style="width:100%;height:8px;background:#1a1a2a;border-radius:4px;overflow:hidden;">'+
        '<div id="fish-progress" style="height:100%;background:#44cc44;width:0%;transition:width .1s;"></div>'+
      '</div>'+
    '</div>'+
    '<div style="font-size:11px;color:#666;">스페이스바: 릴 감기 | ESC: 취소</div>';
  document.body.appendChild(ui);
  _fishUI=ui;
}

function updateFishingUI(){
  if(!_fishUI)return;
  var status=document.getElementById('fish-status');
  var barWrap=document.getElementById('fish-bar-wrap');
  var progWrap=document.getElementById('fish-progress-wrap');

  if(_fishState==='waiting'){
    status.textContent='물고기를 기다리는 중...';
    status.style.color='#aaaaaa';
  }else if(_fishState==='bite'){
    status.textContent='❗ '+_fishTarget.name+' 입질! 스페이스바!';
    status.style.color='#ff4444';
    barWrap.style.display='block';
    progWrap.style.display='block';
  }else if(_fishState==='caught'){
    status.textContent='🎉 '+_fishTarget.name+' 낚았다!';
    status.style.color='#44ff44';
    barWrap.style.display='none';
  }else if(_fishState==='failed'){
    status.textContent='💨 물고기가 도망갔다...';
    status.style.color='#ff6644';
    barWrap.style.display='none';
  }
}

/* ── 낚시 틱 (매 프레임, bite 상태에서) ── */
function tickFishing(dt){
  if(!fishingActive||_fishState!=='bite')return;

  /* 물고기 이동 (좌우 랜덤) */
  _fishBarPos+=_fishDir*_fishSpeed*dt*60;
  if(Math.random()<0.03*_fishDifficulty)_fishDir*=-1;
  if(_fishBarPos<5){_fishBarPos=5;_fishDir=1;}
  if(_fishBarPos>95){_fishBarPos=95;_fishDir=-1;}

  /* 릴이 물고기 위에 있으면 진행도 증가 */
  var diff=Math.abs(_fishBarPos-_fishReelPos);
  if(diff<15){
    _fishProgress+=dt*30/(_fishDifficulty*0.8);
  }else{
    _fishProgress-=dt*15;
  }
  _fishProgress=Math.max(0,Math.min(100,_fishProgress));

  /* UI 업데이트 */
  var fishEl=document.getElementById('fish-target');
  var reelEl=document.getElementById('fish-reel');
  var progEl=document.getElementById('fish-progress');
  if(fishEl)fishEl.style.left=(_fishBarPos-3)+'%';
  if(reelEl)reelEl.style.left=(_fishReelPos-7)+'%';
  if(progEl)progEl.style.width=_fishProgress+'%';

  /* 성공 */
  if(_fishProgress>=100){
    catchFish();
  }

  /* 릴 자연 감소 (안 누르면 내려감) */
  _fishReelPos+=((_fishBarPos-_fishReelPos)>0?-1:1)*dt*10;
  _fishReelPos=Math.max(5,Math.min(95,_fishReelPos));
}

/* ── 릴 감기 (스페이스바) ── */
function reelIn(){
  if(!fishingActive||_fishState!=='bite')return;
  /* 릴을 물고기 쪽으로 이동 */
  var dir=_fishBarPos>_fishReelPos?1:-1;
  _fishReelPos+=dir*8;
  _fishReelPos=Math.max(5,Math.min(95,_fishReelPos));
}

/* ── 물고기 잡기 성공 ── */
function catchFish(){
  _fishState='caught';
  updateFishingUI();
  if(typeof SFX!=='undefined')SFX.questComplete();

  /* 아이템 추가 */
  var fish=_fishTarget;
  var existing=ITEM_POOL.find(function(it){return it.id===fish.id;});
  if(!existing){
    ITEM_POOL.push({id:fish.id,name:fish.name,icon:fish.icon,type:'기타',rarity:fish.rarity,desc:fish.desc,stats:{'판매가':fish.value}});
  }
  addItem(fish.id,1);

  /* 경험치 + 골드 */
  playerEXP+=fish.exp;
  gold+=Math.floor(fish.value*0.3);
  if(typeof checkLevelUp==='function')checkLevelUp();
  var ge=document.getElementById('inv-gold');
  if(ge)ge.textContent='💰 '+gold+' 골드';

  var rarityColors={common:'#ffffff',uncommon:'#44ff44',rare:'#4488ff',epic:'#aa44ff',legendary:'#ff8800'};
  addChat('sys','[낚시]','🎣 <span style="color:'+rarityColors[fish.rarity]+'">'+fish.name+'</span> 낚았다! (+'+fish.exp+'EXP, +'+Math.floor(fish.value*0.3)+'골드)');

  /* 일일 퀘스트 체크 */
  if(typeof checkDailyQuestProgress==='function')checkDailyQuestProgress('collect',fish.id);

  setTimeout(function(){
    endFishing();
  },1500);
}

/* ── 낚시 실패 ── */
function failFishing(){
  _fishState='failed';
  updateFishingUI();
  addChat('sys','[낚시]','물고기가 도망갔다...');
  setTimeout(endFishing,1000);
}

/* ── 낚시 종료 ── */
function endFishing(){
  fishingActive=false;
  _fishState='idle';
  _fishTarget=null;
  if(_fishUI){_fishUI.remove();_fishUI=null;}
}

/* ── 낚시 취소 ── */
function cancelFishing(){
  if(!fishingActive)return;
  addChat('sys','[낚시]','낚시를 취소했다.');
  endFishing();
}
