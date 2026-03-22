/* ════════════ AI NPC 대화 시스템 ════════════ */
/* 의존: config.js (NPC_AI, ANTHROPIC_API_KEY, ICON)
        ui.js (addChat)
        inventory.js (addItem, flashHiddenItem, openShop)
   선언: activeNpc, isAiThinking */

var activeNpc=null;
var isAiThinking=false;

/* 전직 퀘스트 상태 {classKey: {state:'none'|'active'|'done', progress:0, target:'', count:0}} */
var classQuestState={};

/* ════════════ 동적 NPC 스폰 유틸 ════════════ */
function spawnDynamicNpc(name,x,z,bc,hc,classKey){
  var h=mkHuman(bc,hc);
  h.group.position.set(x,0,z);
  h.group.rotation.y=Math.random()*Math.PI*2;
  scene.add(h.group);
  var lov=document.getElementById('lov');
  var ne=document.createElement('div');
  ne.className='llabel npc';
  ne.textContent=name;
  lov.appendChild(ne);
  var ie=document.createElement('div');
  ie.className='linteract';
  ie.textContent='E 대화';
  lov.appendChild(ie);
  var npc={name:name,px:x,pz:z,bc:bc,hc:hc,mesh:h.group,nameEl:ne,intEl:ie,bobOff:Math.random()*Math.PI*2};
  if(classKey)npc.classNpc=classKey;
  npcs.push(npc);
  return npc;
}

function despawnDynamicNpc(npc){
  if(!npc)return;
  scene.remove(npc.mesh);
  if(npc.nameEl&&npc.nameEl.parentNode)npc.nameEl.parentNode.removeChild(npc.nameEl);
  if(npc.intEl&&npc.intEl.parentNode)npc.intEl.parentNode.removeChild(npc.intEl);
  var idx=npcs.indexOf(npc);
  if(idx>=0)npcs.splice(idx,1);
}

/* ════════════ 1. 광전사 (Berserker) — "(투사) 백호진" ════════════ */
/* HP 30% 미만 피격 시 20% 확률 스폰, 30초 유지 */
var berserkerSpawned=false;
var berserkerTimer=0;
var berserkerNpc=null;

function checkBerserkerSpawn(){
  if(berserkerSpawned)return;
  if(playerHP/playerMaxHP>=0.3)return;
  if(Math.random()>=0.2)return;
  berserkerSpawned=true;
  berserkerTimer=30;
  var px=PL.group.position.x+(Math.random()*6+3)*(Math.random()<0.5?1:-1);
  var pz=PL.group.position.z+(Math.random()*6+3)*(Math.random()<0.5?1:-1);
  berserkerNpc=spawnDynamicNpc('(투사) 백호진',px,pz,0x990000,0xdd8866,'berserker');
  addChat('sys','[시스템]','★ 낯선 전사가 나타났다! [30초 안에 말을 걸어라]');
}

function tickBerserker(dt){
  if(!berserkerSpawned)return;
  berserkerTimer-=dt;
  if(berserkerTimer<=10&&berserkerNpc){
    /* 마지막 10초 경고 */
    if(Math.floor(berserkerTimer+dt)!==Math.floor(berserkerTimer)&&Math.floor(berserkerTimer)===10){
      addChat('sys','[시스템]','백호진이 사라지려 한다... (10초)');
    }
  }
  if(berserkerTimer<=0){
    despawnDynamicNpc(berserkerNpc);
    berserkerNpc=null;
    berserkerSpawned=false;
    addChat('sys','[시스템]','백호진이 사라졌다...');
  }
}

/* ════════════ 2. 암살자 (Assassin) — "(그림자) 임카이" ════════════ */
/* 60초마다 5% 확률로 플레이어 뒤에 스폰, 20초 유지 */
var assassinSpawned=false;
var assassinTimer=0;
var assassinNpc=null;
var assassinCheckTimer=0;

function tickAssassin(dt){
  /* 이미 스폰된 경우 — 타이머 카운트다운 */
  if(assassinSpawned){
    assassinTimer-=dt;
    if(assassinTimer<=0){
      despawnDynamicNpc(assassinNpc);
      assassinNpc=null;
      assassinSpawned=false;
      addChat('sys','[시스템]','기척이 사라졌다...');
    }
    return;
  }
  /* 스폰 체크 타이머 (60초마다) */
  assassinCheckTimer+=dt;
  if(assassinCheckTimer<60)return;
  assassinCheckTimer=0;
  if(Math.random()>=0.05)return;
  /* 플레이어 뒤쪽에 스폰 */
  var behindX=PL.group.position.x-Math.sin(cYaw)*4;
  var behindZ=PL.group.position.z-Math.cos(cYaw)*4;
  assassinSpawned=true;
  assassinTimer=20;
  assassinNpc=spawnDynamicNpc('(그림자) 임카이',behindX,behindZ,0x1a1a2a,0xbbbbcc,'assassin');
  addChat('sys','[시스템]','...뒤에서 누군가의 기척이 느껴진다...');
}

/* ════════════ 3. 전사 (Warrior) — "(검술사범) 최무현" ════════════ */
/* 초원 지대를 배회, 플레이어 근처 8 유닛 내로 접근하면 도망, 3 유닛 이내면 멈춤 */
var warriorNpc=null;
var warriorRespawnTimer=0;
var warriorAliveTimer=0;
var warriorWanderDir={x:1,z:0};
var warriorWanderChangeT=0;
/* 스폰 위치 후보: 초원 (z 15~60) 랜덤 위치 */
var WARRIOR_SPAWN_ZONES=[[40,25],[-30,40],[20,55],[-50,30],[60,50],[-20,60]];

function spawnWarrior(){
  var zones=[[40,25],[-30,40],[20,55],[-50,30],[60,50],[-20,60]];
  var pos=zones[Math.floor(Math.random()*zones.length)];
  warriorNpc=spawnDynamicNpc('(검술사범) 최무현',pos[0],pos[1],0x8b0000,0xddcc99,'warrior');
  warriorAliveTimer=120;/* 2분 */
  warriorWanderDir={x:Math.random()*2-1,z:Math.random()*2-1};
  warriorWanderChangeT=0;
  addChat('inf','','초원 어딘가에서 강한 기운이 느껴진다...');
}

function tickWarrior(dt){
  if(!warriorNpc){
    /* 리스폰 대기 */
    if(warriorRespawnTimer>0){
      warriorRespawnTimer-=dt;
      if(warriorRespawnTimer<=0)spawnWarrior();
    }
    return;
  }
  warriorAliveTimer-=dt;
  if(warriorAliveTimer<=0){
    despawnDynamicNpc(warriorNpc);
    warriorNpc=null;
    warriorRespawnTimer=60;/* 1분 후 리스폰 */
    addChat('inf','','그 기운이 사라졌다...');
    return;
  }
  var wx=warriorNpc.mesh.position.x;
  var wz=warriorNpc.mesh.position.z;
  var px=PL.group.position.x,pz=PL.group.position.z;
  var dx=px-wx,dz=pz-wz;
  var dist=Math.sqrt(dx*dx+dz*dz);
  if(dist<3){
    /* 멈춤 — 대화 가능 */
    warriorNpc.mesh.rotation.y=Math.atan2(dx,dz);
  } else if(dist<8){
    /* 도망 */
    var len=Math.sqrt(dx*dx+dz*dz);
    warriorNpc.mesh.position.x-=dx/len*4*dt;
    warriorNpc.mesh.position.z-=dz/len*4*dt;
    warriorNpc.mesh.rotation.y=Math.atan2(-dx,-dz);
  } else {
    /* 배회 */
    warriorWanderChangeT-=dt;
    if(warriorWanderChangeT<=0){
      var ang=Math.random()*Math.PI*2;
      warriorWanderDir={x:Math.sin(ang),z:Math.cos(ang)};
      warriorWanderChangeT=3+Math.random()*4;
    }
    warriorNpc.mesh.position.x+=warriorWanderDir.x*2*dt;
    warriorNpc.mesh.position.z+=warriorWanderDir.z*2*dt;
    /* 초원 경계 안에서만 배회 */
    if(warriorNpc.mesh.position.x<-80)warriorWanderDir.x=1;
    if(warriorNpc.mesh.position.x>80)warriorWanderDir.x=-1;
    if(warriorNpc.mesh.position.z<15)warriorWanderDir.z=1;
    if(warriorNpc.mesh.position.z>65)warriorWanderDir.z=-1;
    warriorNpc.mesh.rotation.y=Math.atan2(warriorWanderDir.x,warriorWanderDir.z);
  }
  /* px/pz 싱크 */
  warriorNpc.px=warriorNpc.mesh.position.x;
  warriorNpc.pz=warriorNpc.mesh.position.z;
}

/* ════════════ 4. 도적 (Rogue) — "(밀정) 서하린" ════════════ */
/* 이장과 3번 이상 대화 후 트리거 */
var chiefTalkCount=0;
var rogueRevealed=false;
var rogueNpc=null;
/* 마을 숨겨진 뒷골목 위치 */
var ROGUE_X=-16,ROGUE_Z=-20;

function revealRogue(){
  if(rogueRevealed)return;
  rogueRevealed=true;
  rogueNpc=spawnDynamicNpc('(밀정) 서하린',ROGUE_X,ROGUE_Z,0x3a2a3a,0xccbbaa,'rogue');
  addChat('sys','[시스템]','마을 뒷골목에서 수상한 자의 기척이 느껴진다...');
}

/* 이장 대화 카운트 증가 및 힌트 체크 */
function checkChiefRogueHint(npcName){
  if(npcName!=='(이장) 박건호')return null;
  chiefTalkCount++;
  if(!rogueRevealed&&chiefTalkCount>=3&&Math.random()<0.5){
    /* 이장 대사에 힌트 삽입 — 다음 AI 응답에 컨텍스트로 주입 */
    var hints=[
      '요즘 마을 뒷골목에서 수상한 자가 어슬렁거린다네... 직접 찾아가 보면 어떻겠나?',
      '저 뒷골목 구석에 누가 숨어있는 것 같은데... 이상한 일이야.',
      '마을 서남쪽 골목 뒤편에 낯선 인물이 있다고 하더군. 조심하게나.',
    ];
    var hint=hints[Math.floor(Math.random()*hints.length)];
    revealRogue();
    return hint;
  }
  return null;
}

/* 모든 동적 NPC tick (게임 루프에서 호출) */
function tickDynamicNpcs(dt){
  tickBerserker(dt);
  tickAssassin(dt);
  tickWarrior(dt);
}

/* 몬스터 킬 시 전직 퀘스트 진행 체크 */
function checkClassQuestKill(monsterName){
  for(var k in classQuestState){
    var cq=classQuestState[k];
    if(cq.state==='active'&&cq.target===monsterName){
      cq.progress++;
      addChat('sys','[전직 퀘스트] '+monsterName+' 처치 ('+cq.progress+'/'+cq.count+')');
      if(cq.progress>=cq.count){
        cq.state='done';
        addChat('sys','[시스템]','★ 전직 퀘스트 완료! 전직 NPC에게 돌아가세요.');
      }
    }
  }
}

function parseHiddenItem(reply){
  var re=/\[HIDDEN_ITEM:([^\]]+)\]/;
  var m=reply.match(re);
  if(!m)return{clean:reply,item:null};
  var clean=reply.replace(re,'').trim();
  var parts=m[1].split('|');
  if(parts.length<2)return{clean:clean,item:null};
  var name=parts[0],desc=parts[1],iconKey=parts[2],statVal=parts[3];
  var statNum=parseInt(statVal)||Math.floor(Math.random()*30+5);
  var item={
    id:'hidden_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),
    name:name.trim(),
    icon:(iconKey&&iconKey.trim()in ICON)?iconKey.trim():'star',
    type:'etc',
    rarity:'hidden',
    desc:(desc||'정체불명의 아이템.').trim(),
    stats:{'능력치':statNum},
  };
  return{clean:clean,item:item};
}

/* ── 가격 흥정 파싱 ── */
function parsePrice(reply){
  var changes=[];
  var clean=reply.replace(/\[PRICE:([^\]]+)\]/g,function(_,m){
    var p=m.split('|');
    if(p.length>=2){
      changes.push({item:p[0].trim(),price:parseInt(p[1])||0});
    }
    return '';
  }).trim();
  return{clean:clean,changes:changes};
}
function addShopItem(npcName,itemId,price){
  var stocks=SHOP_STOCK[npcName];
  if(!stocks)return;
  /* 이미 있으면 무시 */
  for(var i=0;i<stocks.length;i++){if(stocks[i].id===itemId)return;}
  var def=getItemDef(itemId);
  if(!def)return;
  stocks.push({id:itemId,price:price});
  addChat('sys','[시스템]','새 상품 등록: '+def.name+' ('+price+' 골드)');
  if(shopOpen)renderShopItems();
}

function applyPriceChange(itemName,newPrice,npcName){
  /* SHOP_STOCK에서 해당 아이템 가격 변경 — 부분 매칭 지원 */
  var stocks=SHOP_STOCK[npcName];
  if(!stocks){
    /* npcName이 안 맞으면 모든 상점에서 검색 */
    for(var k in SHOP_STOCK){stocks=SHOP_STOCK[k];if(stocks)break;}
  }
  if(!stocks)return;
  var target=itemName.replace(/\s/g,'').toLowerCase();
  for(var i=0;i<stocks.length;i++){
    var def=getItemDef(stocks[i].id);
    if(!def)continue;
    var defName=def.name.replace(/\s/g,'').toLowerCase();
    if(defName===target||defName.indexOf(target)!==-1||target.indexOf(defName)!==-1){
      if(!stocks[i]._origPrice)stocks[i]._origPrice=stocks[i].price;
      stocks[i].price=Math.max(1,newPrice);
      addChat('sys','[시스템]','가격 변동: '+def.name+' → '+newPrice+' 골드');
      if(shopOpen){renderShopItems();if(shopSelectedItem)renderShopDetail(shopSelectedItem);}
      return;
    }
  }
}

async function askAI(npcName,userMsg){
  var npcData=NPC_AI[npcName];if(!npcData)return'...';
  var sys=npcData.system;
  npcData.history.push({role:'user',content:userMsg});
  if(npcData.history.length>20)npcData.history=npcData.history.slice(-20);
  try{
    var apiUrl=location.hostname==='localhost'||location.hostname==='127.0.0.1'
      ?'https://api.anthropic.com/v1/messages'
      :'/api/chat';
    var headers={'Content-Type':'application/json'};
    if(apiUrl.indexOf('anthropic.com')!==-1){
      headers['x-api-key']=ANTHROPIC_API_KEY;
      headers['anthropic-version']='2023-06-01';
      headers['anthropic-dangerous-direct-browser-access']='true';
    }
    var res=await fetch(apiUrl,{
      method:'POST',
      headers:headers,
      body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:350,system:sys,messages:npcData.history})
    });
    if(!res.ok){
      var err=await res.text();
      console.warn('AI API error',res.status,err);
      npcData.history.pop();
      return npcFallback(npcName);
    }
    var data=await res.json();
    if(!data.content||!data.content[0]||!data.content[0].text){
      console.warn('AI empty response',JSON.stringify(data));
      npcData.history.pop();
      return npcFallback(npcName);
    }
    var raw=data.content[0].text;
    var parsed=parseHiddenItem(raw);
    if(parsed.item){
      setTimeout(function(){addItem(parsed.item.id,1,parsed.item);flashHiddenItem(parsed.item.name);},800);
    }
    var pp=parsePrice(parsed.clean);
    if(pp.changes.length>0){
      pp.changes.forEach(function(c){applyPriceChange(c.item,c.price,npcName);});
    }
    /* 상점 아이템 추가 파싱 [SHOP_ADD:아이템id|가격] */
    pp.clean=pp.clean.replace(/\[SHOP_ADD:([^\]]+)\]/g,function(_,m){
      var p=m.split('|');if(p.length>=2){
        var itemId=p[0].trim(),price=parseInt(p[1])||50;
        addShopItem(npcName,itemId,price);
      }
      return '';
    }).trim();
    var qp=parseQuest(pp.clean);
    if(qp.quest){
      setTimeout(function(){showQuestNotif(qp.quest,npcName);},800);
    }
    var finalText=qp.clean;
    npcData.history.push({role:'assistant',content:finalText});
    return finalText;
  }catch(e){
    console.warn('AI fetch error',e);
    npcData.history.pop();
    return npcFallback(npcName);
  }
}

function npcFallback(npcName){
  var fallbacks={
    '(이장) 박건호':['흠... 잠깐 무슨 말을 하려 했는지... 아무튼, 무슨 일인가?','사슴고기 퀘스트는 아직 진행 중인가?','마을 구경은 잘 하고 있나?'],
    '(상인) 김도윤':['아, 죄송해요 잠깐 딴 생각했어요 ㅎㅎ. 뭐 필요하세요?','좋은 물건 많이 있어요~ 구경해보세요!','오늘 특가 있는데 관심 없으세요?'],
    '(대장장이) 이태산':['...','강화 필요하면 말해요.','장비 없으면 싸워도 소용없어요.'],
    '(???) 정체불명':['...','뉴비네.','레벨이나 올려.'],
  };
  var list=fallbacks[npcName]||['...'];
  return list[Math.floor(Math.random()*list.length)];
}

/* ── 전직 선택 ── */
function showSingleClassSelect(classKey,npcName){
  var modal=document.getElementById('class-modal');
  if(!modal)return;
  var grid=document.getElementById('class-grid');
  grid.innerHTML='';
  var c=CLASS_DEFS[classKey];
  if(!c)return;
  /* 타이틀 변경 */
  modal.querySelector('div').textContent='▣ '+c.name+' 전직 ▣';
  modal.querySelectorAll('div')[1].textContent=npcName+': "나와 함께 '+c.name+'의 길을 걷겠는가?"';
  var card=document.createElement('div');
  card.className='class-card selected';
  card.innerHTML='<div class="class-icon" style="background:#'+c.color.toString(16).padStart(6,'0')+';width:60px;height:60px;"></div>'
    +'<div class="class-name" style="font-size:18px;">'+c.name+'</div>'
    +'<div class="class-desc" style="font-size:13px;">'+c.desc+'</div>'
    +'<div class="class-stats" style="font-size:12px;">'
    +'HP x'+c.hpMul+' | ATK x'+c.atkMul+'<br>'
    +'SPD x'+c.spdMul+' | 치명타 '+Math.floor(c.crit*100)+'%'
    +'</div>'
    +'<div class="class-weapons" style="font-size:11px;">무기: '+c.weapons.join(', ')+'</div>';
  grid.appendChild(card);
  document.getElementById('class-confirm-btn').dataset.cls=classKey;
  modal.style.display='flex';
}

function confirmClassSelect(){
  var btn=document.getElementById('class-confirm-btn');
  var cls=btn.dataset.cls;
  if(!cls)return;
  playerClass=cls;
  var def=CLASS_DEFS[cls];
  /* 스탯 적용 */
  playerMaxHP=Math.floor(100*def.hpMul);
  playerHP=playerMaxHP;
  updPlayerHpBar();
  addChat('sys','[시스템]','★ '+def.name+'(으)로 전직하였습니다!');
  document.getElementById('class-modal').style.display='none';
  /* 스킬바 UI 생성 */
  buildSkillBar();
  /* HUD에 직업 표시 */
  var clsEl=document.getElementById('hclass');
  if(clsEl)clsEl.textContent=def.name;
}

function buildSkillBar(){
  var bar=document.getElementById('skill-bar');
  if(!bar)return;
  bar.innerHTML='';
  var skills=CLASS_SKILLS[playerClass]||[];
  if(skills.length===0)return;
  for(var i=0;i<skills.length;i++){
    var sk=skills[i];
    var slot=document.createElement('div');
    slot.style.cssText='width:50px;height:50px;background:#1a1a2ecc;border:1px solid '+sk.color+';border-radius:4px;display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;';
    slot.title=sk.name+': '+sk.desc;
    slot.innerHTML='<div style="color:'+sk.color+';font-size:9px;font-weight:bold;">'+sk.key+'</div>'
      +'<div style="color:#ddd;font-size:10px;">'+sk.name+'</div>'
      +'<div id="skill-cd-'+i+'" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#ff4444;font-size:14px;font-weight:bold;"></div>';
    bar.appendChild(slot);
  }
}

/* ── 대화창 ── */
function talk(n){
  /* 전직 NPC 체크 — 동적 스폰 NPC도 n.classNpc 직접 확인 */
  var classKey=n.classNpc;
  if(!classKey){
    var npcDef=NPC_DEF.find(function(d){return d.name===n.name;});
    if(npcDef&&npcDef.classNpc)classKey=npcDef.classNpc;
  }
  if(classKey){
    if(playerLevel<5){
      addChat('npc',n.name,'아직 실력이 부족하군. 레벨 5가 되면 다시 오게.');
      return;
    }
    if(playerClass!=='none'){
      addChat('npc',n.name,'이미 '+CLASS_DEFS[playerClass].name+'(으)로 전직했군. 대단하네.');
      /* 광전사/암살자 스폰 해제 */
      if(n===berserkerNpc){despawnDynamicNpc(berserkerNpc);berserkerNpc=null;berserkerSpawned=false;}
      if(n===assassinNpc){despawnDynamicNpc(assassinNpc);assassinNpc=null;assassinSpawned=false;}
      return;
    }
    var ck=classKey;
    var cq=classQuestState[ck];
    /* 퀘스트 미수락 */
    if(!cq||cq.state==='none'){
      var q=CLASS_DEFS[ck].quest;
      addChat('npc',n.name,CLASS_DEFS[ck].name+'이(가) 되고 싶은가? 먼저 시험을 통과해야 한다.');
      addChat('npc',n.name,'[전직 퀘스트] '+q.desc);
      classQuestState[ck]={state:'active',progress:0,target:q.target,count:q.count};
      addChat('sys','[시스템]','전직 퀘스트 수락: '+q.desc);
      /* 광전사/암살자: 대화 후 디스폰 */
      if(n===berserkerNpc){despawnDynamicNpc(berserkerNpc);berserkerNpc=null;berserkerSpawned=false;}
      if(n===assassinNpc){despawnDynamicNpc(assassinNpc);assassinNpc=null;assassinSpawned=false;}
      return;
    }
    /* 퀘스트 진행 중 */
    if(cq.state==='active'){
      var q=CLASS_DEFS[ck].quest;
      addChat('npc',n.name,'아직 끝나지 않았군. ('+cq.progress+'/'+cq.count+')');
      if(n===berserkerNpc){despawnDynamicNpc(berserkerNpc);berserkerNpc=null;berserkerSpawned=false;}
      if(n===assassinNpc){despawnDynamicNpc(assassinNpc);assassinNpc=null;assassinSpawned=false;}
      return;
    }
    /* 퀘스트 완료 — 전직 가능 */
    if(cq.state==='done'){
      showSingleClassSelect(ck,n.name);
      if(n===berserkerNpc){despawnDynamicNpc(berserkerNpc);berserkerNpc=null;berserkerSpawned=false;}
      if(n===assassinNpc){despawnDynamicNpc(assassinNpc);assassinNpc=null;assassinSpawned=false;}
      return;
    }
    return;
  }
  /* 상인/대장장이: 상점만 열기 (대화는 상점 내 채팅으로) */
  if(n.name.indexOf('(상인)')===0||n.name.indexOf('(대장장이)')===0){
    activeNpc=n;
    openShop(n.name);
    return;
  }
  /* 완료된 퀘스트 수령 체크 */
  var turned=tryTurnInQuests(n.name);
  activeNpc=n;
  document.getElementById('dwho-name').textContent='[ '+n.name+' ]';
  var te=document.getElementById('dtxt');
  te.innerHTML='';
  document.getElementById('dbox').classList.add('show');
  document.getElementById('dmsg').focus();
  var greeting;
  if(turned){
    greeting='수고했네! 보상을 받게.';
  }else{
    /* 이장: 도적 힌트 체크 */
    var rogueHint=checkChiefRogueHint(n.name);
    var greetings={
      '(이장) 박건호':'어서 오게, 새 모험가여! 오늘은 어떤 일로 찾아왔나?',
      '(상인) 김도윤':'어서오세요~ 뭐 필요하세요? 가격은 협상 가능해요 ㅎㅎ',
      '(대장장이) 이태산':'뭐 필요해요. 가격은... 얘기해봐요.',
      '(???) 정체불명':'...'
    };
    greeting=rogueHint||greetings[n.name]||'...';
  }
  typeText(greeting);
  addChat('npc',n.name,greeting);
  /* 기존 대화 기록 유지 — 초기화하지 않음 */
  if(NPC_AI[n.name]){
    if(!NPC_AI[n.name].history||NPC_AI[n.name].history.length===0){
      NPC_AI[n.name].history=[{role:'assistant',content:greeting}];
    }
  }
}

var typTmr=null;
function typeText(txt){
  var te=document.getElementById('dtxt');
  te.textContent='';
  if(typTmr)clearInterval(typTmr);
  var i=0;
  typTmr=setInterval(function(){
    te.textContent+=txt[i];i++;
    if(i>=txt.length)clearInterval(typTmr);
  },30);
}

function showThinking(){
  var te=document.getElementById('dtxt');
  te.innerHTML='<span class="thinking">...생각 중...</span>';
  if(typTmr)clearInterval(typTmr);
}

async function sendToNpc(){
  if(!activeNpc||isAiThinking)return;
  /* 전직 NPC는 AI 대화 없음 */
  if(activeNpc.classNpc){
    var inp2=document.getElementById('dmsg');inp2.value='';return;
  }
  if(!NPC_AI[activeNpc.name]){
    var inp2=document.getElementById('dmsg');inp2.value='';return;
  }
  var inp=document.getElementById('dmsg');
  var msg=inp.value.trim();
  if(!msg)return;
  inp.value='';
  inp.disabled=true;
  document.getElementById('dsend').disabled=true;

  addChat('plr',myName,msg);
  showThinking();
  isAiThinking=true;

  var reply=await askAI(activeNpc.name,msg);
  isAiThinking=false;
  typeText(reply);
  addChat('npc',activeNpc.name,reply);
  inp.disabled=false;
  document.getElementById('dsend').disabled=false;
  inp.focus();
}

function closeDialog(){
  document.getElementById('dbox').classList.remove('show');
  if(typTmr)clearInterval(typTmr);
  activeNpc=null;isAiThinking=false;
  document.getElementById('dmsg').disabled=false;
  document.getElementById('dsend').disabled=false;
}

document.getElementById('dmsg').addEventListener('keydown',function(e){if(e.key==='Enter')sendToNpc();});
document.addEventListener('keydown',function(e){
  if(e.code==='Space'&&document.getElementById('dbox').classList.contains('show')&&document.activeElement!==document.getElementById('dmsg')){
    e.preventDefault();closeDialog();
  }
  if(e.key&&e.key.toLowerCase()==='i'&&!document.getElementById('game-screen').classList.contains('hidden')&&document.activeElement!==document.getElementById('dmsg')&&document.activeElement!==document.getElementById('cin')&&document.activeElement!==document.getElementById('ni')){
    e.preventDefault();
    if(invOpen)closeInv();else openInv();
  }
});

/* ── 채팅 (플레이어 전용) ── */
function sendChat(){
  var ci=document.getElementById('cin'),v=ci.value.trim();if(!v)return;
  ci.value='';
  addChat('plr',myName,v);
  if(typeof sendChatMP==='function')sendChatMP(myName,v);
  ci.focus();
}
document.getElementById('cin').addEventListener('keydown',function(e){if(e.key==='Enter')sendChat();});
