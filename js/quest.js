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
    var maxGold=lv*count*50;/* 레벨당 마리당 50골드 */
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
var _questMonsters=['토끼','사슴','슬라임','독두꺼비','고블린','늑대','용암 골렘','파이어드레이크','정글 거미','독사','숲 유인원','정글 표범','거대 모기','나무 정령','타락한 포톤'];
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
      rewardAmount:''+(foundCount*80),
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
      rewardAmount:''+(foundCount*150),
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

/* ════════════ 페치 퀘스트 (물건 찾기) ════════════ */
/* 각 NPC가 잃어버린 물건을 맵 곳곳에 숨겨두고, 플레이어가 찾아서 돌려줌 */

var FETCH_QUESTS=[
  {
    id:'fetch_chief_staff',
    npcName:'(이장) 박건호',
    itemName:'박건호의 지팡이',
    itemIcon:'staff',
    itemColor:0xffdd44,
    lightColor:0xffaa00,
    x:-200, z:200,
    zoneName:'어두운 숲',
    hint:'내 지팡이를 숲에서 잃어버렸네...',
    rewardGold:300, rewardExp:500, rewardItem:null,
    triggerWords:['지팡이','잃어버','잃었']
  },
  {
    id:'fetch_merchant_chest',
    npcName:'(상인) 김도윤',
    itemName:'김도윤의 보석 상자',
    itemIcon:'gem',
    itemColor:0x44ffcc,
    lightColor:0x00ffaa,
    x:-100, z:-200,
    zoneName:'초원',
    hint:'보석 상자를 초원 어딘가에 떨어뜨렸어요...',
    rewardGold:500, rewardExp:0, rewardItem:null,
    triggerWords:['보석','상자','잃어버','떨어뜨']
  },
  {
    id:'fetch_smith_hammer',
    npcName:'(대장장이) 이태산',
    itemName:'이태산의 특수 망치',
    itemIcon:'hammer',
    itemColor:0xff6622,
    lightColor:0xff3300,
    x:-350, z:50,
    zoneName:'독 늪',
    hint:'특별한 망치를 늪에서 잃어버렸소...',
    rewardGold:0, rewardExp:0, rewardItem:'iron_sword',
    triggerWords:['망치','잃어버','잃었','늪']
  },
  {
    id:'fetch_librarian_book',
    npcName:'(사서) 엘리노어',
    itemName:'고대 마법서',
    itemIcon:'book',
    itemColor:0xaa44ff,
    lightColor:0x8800ff,
    x:350, z:300,
    zoneName:'정글',
    hint:'고대 마법서가 정글에 있을 거에요...',
    rewardGold:0, rewardExp:800, rewardItem:'magic_crystal',
    rewardItemQty:3,
    triggerWords:['마법서','책','잃어버','정글']
  },
  {
    id:'fetch_guild_seal',
    npcName:'(길드장) 오세준',
    itemName:'길드 인장',
    itemIcon:'crown',
    itemColor:0xff4444,
    lightColor:0xff0000,
    x:200, z:250,
    zoneName:'화산 지대',
    hint:'길드 인장을 화산 근처에서 잃었다...',
    rewardGold:1000, rewardExp:0, rewardItem:'star_fragment',
    triggerWords:['인장','잃어버','잃었','화산']
  }
];

var activeFetchQuests=[];  /* 현재 진행 중인 fetch quest id 배열 */
var _fetchItems=[];        /* {questId, mesh, light, particles, baseY, x, z, labelEl} */

/* ── 페치 아이템 스폰 ── */
function startFetchQuest(questId){
  /* 이미 진행 중이거나 완료된 퀘스트 방지 */
  for(var i=0;i<activeFetchQuests.length;i++){if(activeFetchQuests[i]===questId)return;}
  var def=null;
  for(var j=0;j<FETCH_QUESTS.length;j++){if(FETCH_QUESTS[j].id===questId){def=FETCH_QUESTS[j];break;}}
  if(!def)return;
  if(typeof scene==='undefined')return;

  activeFetchQuests.push(questId);

  /* 아이템 메쉬 — 발광 박스 */
  var geo=new THREE.BoxGeometry(.6,.6,.6);
  var mat=new THREE.MeshBasicMaterial({color:def.itemColor,transparent:true,opacity:.9});
  var mesh=new THREE.Mesh(geo,mat);
  mesh.position.set(def.x,2.5,def.z);
  scene.add(mesh);

  /* 포인트 라이트 */
  var light=new THREE.PointLight(def.lightColor,1.5,12);
  light.position.set(def.x,2.5,def.z);
  scene.add(light);

  /* 스파클 파티클 (4개) */
  var particles=[];
  var pm=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.8});
  for(var p=0;p<4;p++){
    var pg=new THREE.SphereGeometry(.07,4,4);
    var pMesh=new THREE.Mesh(pg,pm);
    pMesh.position.set(def.x,2.5,def.z);
    scene.add(pMesh);
    particles.push({mesh:pMesh,angle:p*Math.PI/2,speed:.8+Math.random()*.4,radius:.5+Math.random()*.3});
  }

  /* 레이블 */
  var lov=document.getElementById('lov');
  var lel=document.createElement('div');
  lel.className='llabel';
  lel.style.color='#ffee44';
  lel.style.textShadow='0 0 6px #ffaa00';
  lel.textContent='✨ '+def.itemName;
  lov.appendChild(lel);

  _fetchItems.push({questId:questId,mesh:mesh,light:light,particles:particles,baseY:2.5,x:def.x,z:def.z,labelEl:lel,t:0});

  addChat('sys','[시스템]','✨ '+def.zoneName+'에 '+def.itemName+'이(가) 숨겨져 있다!');
  renderQuestTracker();
}

/* ── 게임 루프: 픽업 체크 + 애니메이션 ── */
function checkFetchPickup(){
  if(!_fetchItems.length||typeof PL==='undefined'||!PL.group)return;
  var now=Date.now()/1000;
  var px=PL.group.position.x, pz=PL.group.position.z;
  var toRemove=[];

  for(var i=0;i<_fetchItems.length;i++){
    var fi=_fetchItems[i];
    fi.t+=0.016;

    /* 부유 애니메이션 */
    var yOff=Math.sin(fi.t*2)*0.3;
    fi.mesh.position.y=fi.baseY+yOff;
    fi.light.position.y=fi.baseY+yOff;
    fi.mesh.rotation.y+=0.03;

    /* 파티클 공전 */
    for(var p=0;p<fi.particles.length;p++){
      var pt=fi.particles[p];
      pt.angle+=pt.speed*0.016;
      pt.mesh.position.x=fi.x+Math.cos(pt.angle)*pt.radius;
      pt.mesh.position.z=fi.z+Math.sin(pt.angle)*pt.radius;
      pt.mesh.position.y=fi.baseY+yOff+Math.sin(pt.angle*2)*.2;
    }

    /* 레이블 위치 업데이트 */
    if(fi.labelEl&&typeof camera!=='undefined'&&typeof renderer!=='undefined'){
      var wpos=new THREE.Vector3(fi.x,fi.baseY+yOff+1.2,fi.z);
      var v=wpos.clone().project(camera);
      var hw=renderer.domElement.clientWidth/2;
      var hh=renderer.domElement.clientHeight/2;
      var sx=v.x*hw+hw, sy=-v.y*hh+hh;
      var dist=Math.sqrt((px-fi.x)*(px-fi.x)+(pz-fi.z)*(pz-fi.z));
      fi.labelEl.style.display=(v.z<1&&dist<15)?'block':'none';
      fi.labelEl.style.left=sx+'px';
      fi.labelEl.style.top=(sy-14)+'px';
    }

    /* 픽업 반경 3 */
    var dx=px-fi.x, dz=pz-fi.z;
    if(dx*dx+dz*dz<9){
      toRemove.push(i);
      _triggerFetchPickup(fi.questId);
    }
  }

  /* 역순 제거 */
  for(var r=toRemove.length-1;r>=0;r--){
    var fi2=_fetchItems[toRemove[r]];
    scene.remove(fi2.mesh);
    scene.remove(fi2.light);
    for(var pp=0;pp<fi2.particles.length;pp++)scene.remove(fi2.particles[pp].mesh);
    if(fi2.labelEl&&fi2.labelEl.parentNode)fi2.labelEl.parentNode.removeChild(fi2.labelEl);
    _fetchItems.splice(toRemove[r],1);
  }
}

function _triggerFetchPickup(questId){
  var def=null;
  for(var j=0;j<FETCH_QUESTS.length;j++){if(FETCH_QUESTS[j].id===questId){def=FETCH_QUESTS[j];break;}}
  if(!def)return;

  if(typeof spawnDmgNum==='function')spawnDmgNum('✨ '+def.itemName+' 획득!','#ffee44');
  if(typeof SFX!=='undefined')SFX.questAccept();
  addChat('sys','[시스템]','✨ '+def.itemName+'을(를) 주웠습니다! '+def.npcName+'에게 돌아가세요.');

  /* activeFetchQuests에 _picked 표시 */
  for(var k=0;k<activeFetchQuests.length;k++){
    if(activeFetchQuests[k]===questId){activeFetchQuests[k]=questId+'_picked';break;}
  }

  /* 퀘스트 트래커 업데이트 */
  var tq=activeQuests.find(function(q){return q.id===questId;});
  if(tq){tq.ready=true;tq.progress=1;tq.desc=def.npcName+'에게 돌아가세요!';renderQuestTracker();}
}

/* ── NPC에게 돌아가서 완료 ── */
function completeFetchQuest(questId){
  var def=null;
  for(var j=0;j<FETCH_QUESTS.length;j++){if(FETCH_QUESTS[j].id===questId){def=FETCH_QUESTS[j];break;}}
  if(!def)return;

  if(typeof SFX!=='undefined')SFX.questComplete();
  addChat('sys','[시스템]','✦ 페치 퀘스트 완료: ['+def.itemName+' 반환] ✦');

  /* 보상 */
  if(def.rewardGold>0){
    gold+=def.rewardGold;
    var ge=document.getElementById('inv-gold');if(ge)ge.textContent='💰 '+gold+' 골드';
    addChat('sys','[시스템]','골드 +'+def.rewardGold+' 획득!');
  }
  if(def.rewardExp>0){
    playerEXP+=def.rewardExp;
    addChat('sys','[시스템]','경험치 +'+def.rewardExp+' 획득!');
    if(typeof checkLevelUp==='function')checkLevelUp();
  }
  if(def.rewardItem){
    var qty=def.rewardItemQty||1;
    if(typeof addItem==='function')addItem(def.rewardItem,qty);
    var idef=(typeof getItemDef==='function')?getItemDef(def.rewardItem):null;
    addChat('sys','[시스템]','아이템 ['+(idef?idef.name:def.rewardItem)+'] x'+qty+' 획득!');
  }

  /* 호감도 상승 */
  if(typeof changeRep==='function')changeRep(def.npcName,8,'페치 퀘스트 완료');

  /* 퀘스트 완료 이펙트 */
  if(typeof showQuestComplete==='function')showQuestComplete(def.itemName+' 반환');

  /* 목록 정리 */
  activeFetchQuests=activeFetchQuests.filter(function(id){return id!==questId&&id!==questId+'_picked';});
  activeQuests=activeQuests.filter(function(q){return q.id!==questId;});
  renderQuestTracker();
}

/* ── NPC 대화 시 페치 퀘스트 완료 체크 ── */
function tryTurnInFetchQuests(npcName){
  var turned=false;
  for(var i=0;i<activeFetchQuests.length;i++){
    var qid=activeFetchQuests[i];
    if(qid.indexOf('_picked')!==-1){
      var baseId=qid.replace('_picked','');
      var def=null;
      for(var j=0;j<FETCH_QUESTS.length;j++){if(FETCH_QUESTS[j].id===baseId){def=FETCH_QUESTS[j];break;}}
      if(def&&def.npcName===npcName){
        completeFetchQuest(baseId);
        turned=true;
        break;
      }
    }
  }
  return turned;
}

/* ── AI 응답에서 페치 힌트 자동 감지 ── */
function autoDetectFetchQuest(reply,npcName){
  var def=null;
  for(var j=0;j<FETCH_QUESTS.length;j++){
    if(FETCH_QUESTS[j].npcName===npcName){def=FETCH_QUESTS[j];break;}
  }
  if(!def)return false;
  /* 이미 진행 중이면 스킵 */
  for(var k=0;k<activeFetchQuests.length;k++){
    if(activeFetchQuests[k]===def.id||activeFetchQuests[k]===def.id+'_picked')return false;
  }
  /* 트리거 키워드 매칭 */
  for(var t=0;t<def.triggerWords.length;t++){
    if(reply.indexOf(def.triggerWords[t])!==-1){
      /* 페치 퀘스트 시작 제안 알림 */
      setTimeout(function(d){return function(){_offerFetchQuest(d);};}(def),800);
      return true;
    }
  }
  return false;
}

function _offerFetchQuest(def){
  /* 퀘스트 알림 UI 재활용 */
  var tq={
    id:def.id,
    name:def.itemName+' 찾기',
    desc:def.npcName+'의 의뢰: '+def.itemName+'을(를) '+def.zoneName+'에서 찾아라',
    type:'fetch',
    target:def.itemName,
    count:1,
    rewardType:'fetch',
    rewardAmount:'',
    npc:def.npcName,
    ready:false,
    isFetch:true
  };
  var rewardParts=[];
  if(def.rewardGold>0)rewardParts.push(def.rewardGold+' 골드');
  if(def.rewardExp>0)rewardParts.push('경험치 '+def.rewardExp);
  if(def.rewardItem){
    var idef=(typeof getItemDef==='function')?getItemDef(def.rewardItem):null;
    rewardParts.push((idef?idef.name:def.rewardItem)+' x'+(def.rewardItemQty||1));
  }
  tq.rewardAmount=rewardParts.join(', ');

  /* 중복 체크 */
  for(var i=0;i<activeFetchQuests.length;i++){
    if(activeFetchQuests[i]===def.id||activeFetchQuests[i]===def.id+'_picked')return;
  }

  var el=document.getElementById('quest-notif');
  if(!el)return;
  document.getElementById('qn-name').textContent=tq.name;
  document.getElementById('qn-desc').textContent=tq.desc;
  document.getElementById('qn-obj').textContent='목표: '+def.zoneName+' ('+def.x+', '+def.z+') 근처 탐색';
  document.getElementById('qn-reward').textContent='보상: '+tq.rewardAmount;
  el.classList.add('show');
  document.getElementById('qn-accept').onclick=function(){
    startFetchQuest(def.id);
    activeQuests.push(tq);
    renderQuestTracker();
    addChat('sys','[시스템]','페치 퀘스트 수락: ['+tq.name+']');
    el.classList.remove('show');
  };
  document.getElementById('qn-reject').onclick=function(){
    addChat('sys','[시스템]','퀘스트 ['+tq.name+']을(를) 거절했습니다.');
    el.classList.remove('show');
  };
}
