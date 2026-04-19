/* ════════════ 가챠 시스템 ════════════ */
/* 의존: config.js(ITEM_POOL), inventory.js(addItem,gold), ui.js(addChat,spawnDmgNum) */

var GACHA_TYPES={
  basic:{
    name:'🎁 기본 가챠',
    cost:500,
    desc:'일반~희귀 아이템 (골드)',
    rates:{common:0.60,uncommon:0.30,rare:0.10,epic:0,legendary:0},
    pool:null/* null=all cosmetics */
  },
  premium:{
    name:'💎 프리미엄 가챠',
    cost:3000,
    desc:'레어~전설 확률 UP',
    rates:{common:0.20,uncommon:0.40,rare:0.28,epic:0.10,legendary:0.02},
    pool:null
  },
  event:{
    name:'🌟 이벤트 가챠',
    cost:5000,
    desc:'희귀 코스메틱 전용',
    rates:{common:0,uncommon:0.30,rare:0.45,epic:0.20,legendary:0.05},
    pool:null
  }
};

var _gachaRolled={basic:0,premium:0,event:0};

function openGachaModal(){
  if(document.getElementById('gacha-modal'))return;

  var modal=document.createElement('div');
  modal.id='gacha-modal';
  modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9998;display:flex;align-items:center;justify-content:center;font-family:inherit;';

  var panel=document.createElement('div');
  panel.style.cssText='background:linear-gradient(135deg,#1a1a2e,#2a1a3e);border:2px solid #c9a84c;border-radius:14px;padding:28px;width:90vw;max-width:500px;color:#f0e4bb;text-align:center;';

  var html='<div style="color:#c9a84c;font-size:22px;font-weight:bold;letter-spacing:4px;margin-bottom:8px;">🎰 가 챠 🎰</div>'+
    '<div style="color:#888;font-size:11px;margin-bottom:20px;">코스메틱을 뽑아보자!</div>'+
    '<div style="color:#ffdd44;font-size:13px;margin-bottom:16px;">💰 보유 골드: '+gold+'</div>';

  Object.keys(GACHA_TYPES).forEach(function(k){
    var t=GACHA_TYPES[k];
    var canAfford=gold>=t.cost;
    html+='<div style="background:'+(canAfford?'#2a2a3e':'#1a1a1e')+';border:1px solid #c9a84c55;border-radius:8px;padding:14px;margin-bottom:10px;text-align:left;">'+
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">'+
        '<div style="font-weight:bold;font-size:14px;">'+t.name+'</div>'+
        '<div style="color:#ffdd44;font-size:12px;">💰 '+t.cost+'</div>'+
      '</div>'+
      '<div style="color:#aaa;font-size:11px;margin-bottom:8px;">'+t.desc+'</div>'+
      '<div style="display:flex;gap:6px;">'+
        '<button data-gacha="'+k+'" data-count="1" '+(canAfford?'':'disabled')+' style="flex:1;background:'+(canAfford?'#c9a84c':'#555')+';color:#0c0c1e;border:none;padding:8px;font-weight:bold;border-radius:5px;cursor:'+(canAfford?'pointer':'not-allowed')+';font-family:inherit;">1회</button>'+
        '<button data-gacha="'+k+'" data-count="10" '+(gold>=t.cost*10?'':'disabled')+' style="flex:1;background:'+(gold>=t.cost*10?'#aa88cc':'#555')+';color:#0c0c1e;border:none;padding:8px;font-weight:bold;border-radius:5px;cursor:'+(gold>=t.cost*10?'pointer':'not-allowed')+';font-family:inherit;">10회</button>'+
      '</div>'+
      '</div>';
  });

  html+='<div style="color:#666;font-size:10px;margin-top:10px;">총 뽑기: 기본 '+_gachaRolled.basic+'회 / 프리미엄 '+_gachaRolled.premium+'회 / 이벤트 '+_gachaRolled.event+'회</div>'+
    '<button id="gacha-close" style="width:100%;background:transparent;color:#aaa;border:1px solid #aaa55;padding:10px;margin-top:12px;border-radius:6px;cursor:pointer;font-family:inherit;">닫기</button>';

  panel.innerHTML=html;
  modal.appendChild(panel);
  document.body.appendChild(modal);

  /* 이벤트 바인딩 */
  panel.querySelectorAll('[data-gacha]').forEach(function(btn){
    btn.addEventListener('click',function(){
      var k=btn.dataset.gacha,n=parseInt(btn.dataset.count);
      rollGacha(k,n);
    });
  });
  document.getElementById('gacha-close').addEventListener('click',function(){
    modal.remove();
  });
}

function rollGacha(type,count){
  var t=GACHA_TYPES[type];if(!t)return;
  var totalCost=t.cost*count;
  if(gold<totalCost){addChat('sys','[가챠]','골드가 부족합니다.');return;}
  gold-=totalCost;
  if(typeof updGoldHud==='function')updGoldHud();
  _gachaRolled[type]+=count;

  /* 풀: 모든 코스메틱 + 일부 소비 아이템 */
  var pool=ITEM_POOL.filter(function(it){
    return it.type==='cosmetic'||it.type==='accessory'||
           (it.type==='weapon'&&it.rarity!=='common')||
           (it.type==='armor'&&it.rarity!=='common');
  });

  var results=[];
  for(var i=0;i<count;i++){
    var r=Math.random(),sum=0,rarity='common';
    var rates=t.rates;
    var keys=['legendary','epic','rare','uncommon','common'];
    for(var k=0;k<keys.length;k++){
      sum+=rates[keys[k]]||0;
      if(r<=sum){rarity=keys[k];break;}
    }
    /* 해당 등급 풀 */
    var rarityPool=pool.filter(function(x){return x.rarity===rarity;});
    if(rarityPool.length===0)rarityPool=pool.filter(function(x){return x.rarity==='common';});
    var pick=rarityPool[Math.floor(Math.random()*rarityPool.length)];
    if(pick){
      results.push(pick);
      addItem(pick.id,1);
    }
  }
  if(typeof SFX!=='undefined')SFX.levelUp();
  if(typeof savePlayerData==='function')savePlayerData();
  showGachaResults(results);
}

function showGachaResults(results){
  /* 기존 모달 제거 */
  var old=document.getElementById('gacha-modal');if(old)old.remove();
  var oldR=document.getElementById('gacha-results');if(oldR)oldR.remove();

  var modal=document.createElement('div');
  modal.id='gacha-results';
  modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:9999;display:flex;align-items:center;justify-content:center;font-family:inherit;';

  var panel=document.createElement('div');
  panel.style.cssText='background:linear-gradient(135deg,#1a1a2e,#2a1a3e);border:2px solid #c9a84c;border-radius:14px;padding:28px;width:90vw;max-width:600px;max-height:80vh;overflow-y:auto;color:#f0e4bb;text-align:center;';

  var rarityColors={common:'#aaaaaa',uncommon:'#44ff44',rare:'#4488ff',epic:'#aa44ff',legendary:'#ffaa00'};
  var rarityNames={common:'일반',uncommon:'고급',rare:'희귀',epic:'영웅',legendary:'전설'};

  /* 가장 높은 등급 찾기 */
  var rarityOrder=['common','uncommon','rare','epic','legendary'];
  var topRarity='common';
  results.forEach(function(r){
    if(rarityOrder.indexOf(r.rarity)>rarityOrder.indexOf(topRarity))topRarity=r.rarity;
  });

  var html='<div style="color:'+rarityColors[topRarity]+';font-size:24px;font-weight:bold;margin-bottom:20px;text-shadow:0 0 15px '+rarityColors[topRarity]+';animation:gachaGlow 1s ease-in-out infinite alternate;">✨ '+rarityNames[topRarity]+' 등급 획득! ✨</div>'+
    '<div style="display:grid;grid-template-columns:repeat('+(results.length>1?Math.min(5,results.length):1)+',1fr);gap:10px;margin-bottom:20px;">';

  results.forEach(function(r){
    var c=rarityColors[r.rarity]||'#aaa';
    html+='<div style="background:#1a1a2e;border:2px solid '+c+';border-radius:8px;padding:10px;text-align:center;box-shadow:0 0 10px '+c+'66;">'+
      '<div style="font-size:28px;margin-bottom:4px;">'+(r.icon||'📦')+'</div>'+
      '<div style="color:'+c+';font-size:12px;font-weight:bold;">'+r.name+'</div>'+
      '<div style="color:#888;font-size:9px;margin-top:2px;">['+rarityNames[r.rarity]+']</div>'+
      '</div>';
  });

  html+='</div>'+
    '<button id="gacha-results-close" style="width:100%;background:#c9a84c;color:#0c0c1e;border:none;padding:12px;font-weight:bold;border-radius:6px;cursor:pointer;font-family:inherit;">확인</button>'+
    '<style>@keyframes gachaGlow{0%{text-shadow:0 0 10px '+rarityColors[topRarity]+';}100%{text-shadow:0 0 25px '+rarityColors[topRarity]+',0 0 40px '+rarityColors[topRarity]+';}}</style>';

  panel.innerHTML=html;
  modal.appendChild(panel);
  document.body.appendChild(modal);

  document.getElementById('gacha-results-close').addEventListener('click',function(){
    modal.remove();
    /* 다시 가챠 모달 열기 */
    openGachaModal();
  });

  addChat('sys','[가챠]',results.length+'개 획득! 최고 등급: '+rarityNames[topRarity]);
}

/* 마을에 가챠 NPC 스폰 */
function spawnGachaNpc(){
  if(!scene)return;
  var x=-320,z=-340;
  var y=(typeof getTerrainY==='function')?getTerrainY(x,z):0;
  var npcMesh=(typeof mkHuman==='function')?mkHuman(0xaa44cc,0xddccbb).group:new THREE.Mesh(new THREE.BoxGeometry(.6,1.6,.4),new THREE.MeshLambertMaterial({color:0xaa44cc}));
  npcMesh.position.set(x,y,z);
  npcMesh.rotation.y=Math.PI;
  scene.add(npcMesh);

  var nameEl=document.createElement('div');nameEl.className='nlabel npc';
  nameEl.style.cssText='background:#1a0a2eee;border:1px solid #aa44cc;color:#dd88ff;padding:2px 6px;font-size:11px;';
  nameEl.textContent='(가챠상인) 미스틱';
  document.getElementById('lov').appendChild(nameEl);

  var intEl=document.createElement('div');intEl.className='linteract';
  intEl.textContent='E 가챠';intEl.style.display='none';
  document.getElementById('lov').appendChild(intEl);

  var npcObj={name:'(가챠상인) 미스틱',mesh:npcMesh,nameEl:nameEl,intEl:intEl,gachaNpc:true,bobOff:Math.random()*5};
  npcs.push(npcObj);
}
