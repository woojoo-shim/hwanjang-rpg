/* ════════════ 인벤토리 + 상점 시스템 ════════════ */
/* 의존: config.js (RARITIES, ITEM_TYPES, ICON, ITEM_POOL, SHOP_STOCK)
        ui.js (addChat)
   선언: inventory, gold, equipped, invOpen, shopOpen, currentTab, selectedItem
   참조: refreshWeaponMesh (player.js) — 런타임 참조 */

var inventory=[]; // {itemId, qty, custom?, equipped?}
var equippedDur={}; // { weapon: currentDur, armor: currentDur } — 현재 내구도 추적
var gold=0;
var currentTab='all';
var selectedItem=null;
var equipped={weapon:null,armor:null,hat:null,cape:null,dye:null};

function getItemDef(id){return ITEM_POOL.find(function(x){return x.id===id;});}

function addItem(itemId,qty,customDef){
  qty=qty||1;
  if(customDef){
    var existing=inventory.find(function(s){return s.itemId===itemId;});
    if(existing)existing.qty+=qty;
    else inventory.push({itemId:itemId,qty:qty,custom:customDef});
  } else {
    var existing=inventory.find(function(s){return s.itemId===itemId;});
    if(existing)existing.qty+=qty;
    else inventory.push({itemId:itemId,qty:qty});
  }
  renderInv();
}

function getItemFull(slot){
  if(slot.custom)return slot.custom;
  return getItemDef(slot.itemId)||{name:slot.itemId,icon:'star',type:'etc',rarity:'common',desc:'?',stats:{}};
}

function isEquipped(slot){
  var it=getItemFull(slot);
  if(it.type==='cosmetic'){
    var cslot=it.slot||'hat';
    return equipped[cslot]===slot.itemId;
  }
  return equipped[it.type]===slot.itemId;
}

function equipItem(slot){
  var it=getItemFull(slot);
  /* 클래스 무기 — 비전공 무기는 장착 가능하지만 경고 */
  if(it.type==='weapon'&&playerClass!=='none'){
    var cls=CLASS_DEFS[playerClass];
    var def=getItemDef(slot.itemId);
    if(def&&cls&&cls.weapons.indexOf(def.icon)===-1){
      addChat('sys','[시스템]','⚠️ '+cls.name+'의 전공 무기가 아닙니다. 데미지가 40% 감소합니다.');
    }
  }
  /* 코스메틱: slot 필드로 슬롯 결정 */
  if(it.type==='cosmetic'){
    var cslot=it.slot||'hat';
    equipped[cslot]=slot.itemId;
    addChat('sys','[시스템]','['+it.name+']을(를) 장착했습니다.');
    if(typeof refreshCosmeticMesh==='function')refreshCosmeticMesh();
    if(typeof sendCosmeticUpdate==='function')sendCosmeticUpdate();
    renderInv();showDetail(slot);updEquipHud();
    return;
  }
  equipped[it.type]=slot.itemId;
  /* 내구도 초기화 — 최대값 */
  var maxDur=getMaxDurability(slot.itemId);
  if(equippedDur[it.type]===undefined||equippedDur[it.type]<=0){
    equippedDur[it.type]=maxDur;
  }
  if(typeof SFX!=='undefined')SFX.click();
  addChat('sys','[시스템]','['+it.name+']을(를) 장착했습니다.');
  if(it.type==='weapon')refreshWeaponMesh();
  renderInv();showDetail(slot);updEquipHud();
}

/* 최대 내구도 조회 */
function getMaxDurability(itemId){
  var def=getItemDef(itemId);
  if(!def||!def.stats)return 100;
  return def.stats.내구도||def.stats['내구도']||100;
}

/* 내구도 감소 */
function damageEquipment(slotType,amount){
  if(!equipped[slotType])return;
  var id=typeof equipped[slotType]==='object'?equipped[slotType].id:equipped[slotType];
  var def=getItemDef(id);
  if(!def||!def.stats||!def.stats.내구도)return;/* 내구도 없는 아이템 */
  if(equippedDur[slotType]===undefined)equippedDur[slotType]=getMaxDurability(id);
  equippedDur[slotType]=Math.max(0,equippedDur[slotType]-amount);
  if(equippedDur[slotType]===0){
    /* 파괴 */
    addChat('sys','[시스템]','⚠️ ['+def.name+']이(가) 부서졌습니다! 수리가 필요합니다.');
    if(typeof toast==='function')toast('⚠️ '+def.name+' 파손');
    if(typeof SFX!=='undefined')SFX.hit();
    if(typeof updEquipHud==='function')updEquipHud();
  }
}

/* 내구도 수리 */
function repairEquipment(slotType){
  if(!equipped[slotType])return 0;
  var id=typeof equipped[slotType]==='object'?equipped[slotType].id:equipped[slotType];
  var max=getMaxDurability(id);
  var cur=equippedDur[slotType]||0;
  var missing=max-cur;
  equippedDur[slotType]=max;
  return missing;
}

/* 현재 아이템 부서졌는지 */
function isItemBroken(slotType){
  if(!equipped[slotType])return false;
  var id=typeof equipped[slotType]==='object'?equipped[slotType].id:equipped[slotType];
  var def=getItemDef(id);
  if(!def||!def.stats||!def.stats.내구도)return false;
  return (equippedDur[slotType]||0)<=0;
}

function unequipItem(slot){
  var it=getItemFull(slot);
  if(it.type==='cosmetic'){
    var cslot=it.slot||'hat';
    equipped[cslot]=null;
    addChat('sys','[시스템]','['+it.name+']을(를) 해제했습니다.');
    if(typeof refreshCosmeticMesh==='function')refreshCosmeticMesh();
    if(typeof sendCosmeticUpdate==='function')sendCosmeticUpdate();
    renderInv();showDetail(slot);updEquipHud();
    return;
  }
  equipped[it.type]=null;
  addChat('sys','[시스템]','['+it.name+']을(를) 해제했습니다.');
  if(it.type==='weapon')refreshWeaponMesh();
  renderInv();showDetail(slot);updEquipHud();
}

function useItem(slot){
  var it=getItemFull(slot);
  if(it.type!=='consume')return;
  /* 텔레포트 두루마리: 소모하지 않고 UI 열기 */
  if(slot.itemId==='tp_scroll'){
    if(typeof useTpScroll==='function')useTpScroll();
    return;
  }
  /* 아이템 효과 적용 */
  var msg='';
  if(it.stats.회복){
    if(it.stats.회복==='전체'){
      playerHP=playerMaxHP;
      msg='HP/MP 전부 회복!';
    }else{
      var heal=parseInt(it.stats.회복)||0;
      playerHP=Math.min(playerMaxHP,playerHP+heal);
      msg='HP '+heal+' 회복!';
    }
    if(typeof updPlayerHpBar==='function')updPlayerHpBar();
    if(typeof spawnDmgNum==='function')spawnDmgNum('+'+it.stats.회복,'#44ff44');
  }
  if(it.stats.마나회복){
    var mheal=parseInt(it.stats.마나회복)||0;
    msg+=(msg?' ':'')+'MP '+mheal+' 회복!';
  }
  if(it.stats.체력){
    var sheal=parseInt(it.stats.체력)||0;
    playerHP=Math.min(playerMaxHP,playerHP+sheal);
    msg='HP '+sheal+' 회복!';
    if(typeof updPlayerHpBar==='function')updPlayerHpBar();
    if(typeof spawnDmgNum==='function')spawnDmgNum('+'+sheal,'#44ff44');
  }
  if(it.stats.부활){
    msg='부활 효과가 부여되었습니다!';
  }
  if(typeof SFX!=='undefined')SFX.potion();
  slot.qty--;
  if(slot.qty<=0)inventory=inventory.filter(function(s){return s!==slot;});
  addChat('sys','[시스템]','['+it.name+'] 사용! '+(msg||''));
  renderInv();
  document.getElementById('inv-detail-empty').style.display='block';
  document.getElementById('inv-detail-content').style.display='none';
  selectedItem=null;
}

function updEquipHud(){
  var hudEq=document.getElementById('hud-equip');
  if(!hudEq){
    hudEq=document.createElement('div');
    hudEq.id='hud-equip';
    hudEq.style.cssText='font-size:10px;color:#c9a84c88;letter-spacing:1px;display:flex;gap:8px;margin-left:8px;';
    document.querySelector('.hud').insertBefore(hudEq,document.querySelector('.hud .hsp'));
  }
  var w=equipped.weapon?getItemFull(inventory.find(function(s){return s.itemId===equipped.weapon;})||{}):null;
  var a=equipped.armor?getItemFull(inventory.find(function(s){return s.itemId===equipped.armor;})||{}):null;
  var ht=equipped.hat?getItemFull(inventory.find(function(s){return s.itemId===equipped.hat;})||{}):null;
  var cp=equipped.cape?getItemFull(inventory.find(function(s){return s.itemId===equipped.cape;})||{}):null;
  var dy=equipped.dye?getItemFull(inventory.find(function(s){return s.itemId===equipped.dye;})||{}):null;
  function durTxt(slotType,item){
    if(!item||!item.stats||!item.stats.내구도)return '';
    var cur=equippedDur[slotType];
    var max=item.stats.내구도;
    if(cur===undefined)cur=max;
    var pct=cur/max;
    var color=pct>0.5?'#88cc88':pct>0.2?'#ffaa22':'#ff4444';
    return ' <span style="color:'+color+';font-size:9px;">('+cur+'/'+max+')</span>';
  }
  hudEq.innerHTML=
    (w?'<span title="무기" style="color:#c9a84c">'+(ICON[w.icon]||'⚔️')+' '+w.name+durTxt('weapon',w)+'</span>':'')+
    (a?'<span title="방어구" style="color:#88aacc">'+(ICON[a.icon]||'🛡️')+' '+a.name+durTxt('armor',a)+'</span>':'')+
    (ht?'<span title="모자" style="color:#cc88ff">'+(ICON[ht.icon]||'🎩')+' '+ht.name+'</span>':'')+
    (cp?'<span title="망토" style="color:#ff8844">'+(ICON[cp.icon]||'🧣')+' '+cp.name+'</span>':'')+
    (dy?'<span title="염색" style="color:#ff88cc">'+(ICON[dy.icon]||'🎨')+'</span>':'');
}

function giveStartItems(){
  if(playerData)return;/* 복귀 유저는 스킵 */
  addItem('wooden_sword',1);
  gold=50;
  document.getElementById('inv-gold').textContent='💰 '+gold+' 골드';
  addChat('sys','[시스템]','[낡은 나무 검]을(를) 획득했습니다.');
}

/* 인벤토리 UI */
var invOpen=false;
function openInv(){
  invOpen=true;
  if(typeof SFX!=='undefined')SFX.click();
  document.getElementById('inv-overlay').classList.add('show');
  renderInv();
}
function closeInv(){
  invOpen=false;
  document.getElementById('inv-overlay').classList.remove('show');
}
function switchTab(tab,btn){
  currentTab=tab;
  document.querySelectorAll('.inv-tab').forEach(function(b){b.classList.remove('active');});
  btn.classList.add('active');
  renderInv();
}

function renderInv(){
  var grid=document.getElementById('inv-grid');
  grid.innerHTML='';
  var slots=inventory.filter(function(s){
    var it=getItemFull(s);
    if(currentTab==='all')return true;
    if(currentTab==='hidden')return it.rarity==='hidden';
    return it.type===currentTab;
  });
  if(slots.length===0){
    grid.innerHTML='<div style="grid-column:1/-1;color:#3a3a5a;font-size:11px;text-align:center;padding:20px;letter-spacing:1px;">아이템 없음</div>';
    return;
  }
  slots.forEach(function(slot){
    var it=getItemFull(slot);
    var eq=isEquipped(slot);
    var div=document.createElement('div');
    div.className='inv-slot '+it.rarity+(eq?' equipped':'');
    if(eq){
      div.style.cssText='outline:2px solid #90ffa0;outline-offset:2px;background:#0a2a14;';
    }
    div.innerHTML=
      '<div class="rarity-dot '+it.rarity+'"></div>'+
      (eq?'<div style="position:absolute;top:2px;right:3px;font-size:8px;color:#90ffa0;font-weight:700;letter-spacing:1px;">장착</div>':'')+
      '<div class="inv-slot-icon">'+(ICON[it.icon]||'📦')+'</div>'+
      '<div class="inv-slot-name">'+it.name+'</div>'+
      (slot.qty>1?'<div class="inv-slot-qty">x'+slot.qty+'</div>':'');
    div.onclick=function(){showDetail(slot);};
    grid.appendChild(div);
  });
}

/* 레어리티별 글로우 색상 (Diablo 2 스타일 테두리용) */
var RARITY_GLOW={
  common:   '#888888',
  uncommon: '#55bb55',
  rare:     '#5588ff',
  epic:     '#aa55ff',
  legendary:'#c9a84c',
  hidden:   '#ff44ff',
};

function showDetail(slot){
  selectedItem=slot;
  var it=getItemFull(slot);
  var r=RARITIES[it.rarity]||RARITIES.common;
  var rColor=RARITY_GLOW[it.rarity]||'#888';
  var eq=isEquipped(slot);

  document.getElementById('inv-detail-empty').style.display='none';
  var content=document.getElementById('inv-detail-content');
  content.style.display='block';

  /* 레어리티 테두리 글로우 */
  var detailPanel=document.getElementById('inv-detail');
  detailPanel.style.borderLeft='1px solid '+rColor+'55';
  detailPanel.style.boxShadow='inset -3px 0 12px '+rColor+'11';

  /* 아이콘 */
  document.getElementById('inv-detail-icon').textContent=ICON[it.icon]||'📦';

  /* 이름 — 레어리티 색상 */
  var nameEl=document.getElementById('inv-detail-name');
  nameEl.textContent=it.name;
  nameEl.style.color=rColor;
  nameEl.style.textShadow='0 0 8px '+rColor+'66';

  /* 레어리티 뱃지 */
  var rarEl=document.getElementById('inv-detail-rarity');
  rarEl.textContent='[ '+r.name+' ]'+(eq?' ✦ 장착중':'');
  rarEl.style.color=eq?'#90ffa0':rColor;

  /* 아이템 타입 */
  document.getElementById('inv-detail-type').textContent=ITEM_TYPES[it.type]||'기타';

  /* stats 영역을 Diablo 2 스타일로 재구성 */
  var statsEl=document.getElementById('inv-detail-stats');
  statsEl.innerHTML='';

  /* ── 구분선 ── */
  statsEl.innerHTML+='<div class="d2-divider"></div>';

  /* ── 기본 스탯 (흰색) ── */
  var baseStats=it.stats||{};
  var hasStats=false;
  Object.entries(baseStats).forEach(function(pair){
    hasStats=true;
    var k=pair[0];var v=pair[1];
    var prefix=(typeof v==='number'&&v>0)?'+':'';
    statsEl.innerHTML+='<div class="d2-stat-row"><span class="d2-stat-label">'+k+'</span><span class="d2-stat-base">'+prefix+v+'</span></div>';
  });

  /* ── 내구도 표시 (장착중이면 현재/최대) ── */
  var dur=it.durability||null;
  if(dur){
    var curDur=dur;
    if(eq){
      var slotType=it.type;
      if(equippedDur[slotType]!==undefined)curDur=equippedDur[slotType];
    }
    var durPct=curDur/dur;
    var durColor=durPct>0.5?'#88cc88':durPct>0.2?'#ffaa22':'#ff4444';
    statsEl.innerHTML+='<div class="d2-stat-row"><span class="d2-stat-label">내구도</span><span style="color:'+durColor+';font-weight:700;">'+curDur+' / '+dur+'</span></div>';
  }

  /* ── 요구 레벨 ── */
  var rl=it.reqLevel||null;
  if(rl){
    var plvl=(typeof playerLevel!=='undefined'?playerLevel:1);
    var lvColor=plvl>=rl?'#aaaaaa':'#ff5555';
    statsEl.innerHTML+='<div class="d2-stat-row"><span class="d2-stat-label">요구 레벨</span><span style="color:'+lvColor+';font-weight:700;">'+rl+'</span></div>';
  }

  /* ── 특수 보너스 (파란색) ── */
  var bonuses=it.bonuses||[];
  if(bonuses.length>0){
    statsEl.innerHTML+='<div class="d2-divider"></div>';
    bonuses.forEach(function(b){
      statsEl.innerHTML+='<div class="d2-bonus-row">'+b+'</div>';
    });
  }

  /* ── 수량 ── */
  if(slot.qty>1){
    statsEl.innerHTML+='<div class="d2-divider"></div>';
    statsEl.innerHTML+='<div class="d2-stat-row"><span class="d2-stat-label">수량</span><span class="d2-stat-base">x'+slot.qty+'</span></div>';
  }

  /* ── 설명 텍스트 ── */
  if(it.desc){
    statsEl.innerHTML+='<div class="d2-divider"></div>';
    statsEl.innerHTML+='<div class="d2-desc">'+it.desc+'</div>';
  }

  /* ── 플레이버 텍스트 (이탤릭 회색) ── */
  if(it.flavor){
    statsEl.innerHTML+='<div class="d2-flavor">"'+it.flavor+'"</div>';
  }

  /* ── 버튼 영역 ── */
  var btnArea=document.getElementById('inv-detail-btns');
  btnArea.innerHTML='';
  if(it.type==='weapon'||it.type==='armor'||it.type==='cosmetic'){
    if(eq){
      var btn=document.createElement('button');
      btn.className='inv-action-btn unequip';
      btn.textContent='▣ 장착 해제';
      btn.onclick=function(){unequipItem(slot);};
      btnArea.appendChild(btn);
    } else {
      var btn=document.createElement('button');
      btn.className='inv-action-btn equip';
      btn.textContent='▶ 장 착';
      btn.onclick=function(){equipItem(slot);};
      btnArea.appendChild(btn);
    }
  } else if(it.type==='consume'){
    var btn=document.createElement('button');
    btn.className='inv-action-btn use';
    btn.textContent='▶ 사 용';
    btn.onclick=function(){useItem(slot);};
    btnArea.appendChild(btn);
  }
}

/* ════════════ 상점 시스템 ════════════ */
function sellPrice(buyPrice){return Math.max(1,Math.floor(buyPrice*.4));}

var shopOpen=false;
var shopTab='buy';
var shopSelectedItem=null;
var currentShopNpc=null;

function openShop(npcName){
  var stock=SHOP_STOCK[npcName];
  if(!stock)return false;
  currentShopNpc=npcName;
  shopOpen=true;
  shopTab='buy';
  document.getElementById('shop-overlay').classList.add('show');
  /* 새로고침 횟수 표시 */
  var remaining=SHOP_MAX_REFRESH-(SHOP_REFRESH_COUNT[npcName]||0);
  var titleEl=document.getElementById('shop-title-text');
  titleEl.innerHTML='▣ '+npcName+' 상점 <button onclick="doShopRefresh()" style="margin-left:12px;background:'+(remaining>0?'#c9a84c':'#555')+';color:'+(remaining>0?'#0c0c1e':'#888')+';border:none;padding:4px 10px;font-size:11px;cursor:'+(remaining>0?'pointer':'not-allowed')+';border-radius:4px;font-family:inherit;">🔄 새로고침 ('+remaining+'/'+SHOP_MAX_REFRESH+')</button>';
  document.querySelectorAll('.shop-tab').forEach(function(t,i){t.classList.toggle('active',i===0);});
  shopSelectedItem=null;
  renderShopDetail(null);
  renderShopItems();
  updShopGold();
  var cl=document.getElementById('shop-chat-log');
  if(cl)cl.innerHTML='<div style="color:#c9a84c;">'+npcName+': 어서오세요~ 뭘 도와드릴까요?</div>';
  /* 호감도 표시 */
  if(typeof getRepTier==='function'){
    var tier=getRepTier(npcName);
    var rep=getRep(npcName);
    var repEl=document.createElement('div');
    repEl.id='shop-rep-display';
    repEl.style.cssText='text-align:center;padding:6px;font-size:11px;color:'+tier.color+';border-bottom:1px solid #444;';
    repEl.innerHTML=tier.icon+' 호감도: '+tier.name+' ('+rep+'/100)';
    var wrap=document.getElementById('shop-items').parentElement;
    var existing=document.getElementById('shop-rep-display');
    if(existing)existing.remove();
    if(wrap)wrap.insertBefore(repEl,wrap.firstChild);
  }
  return true;
}

function closeShop(){
  shopOpen=false;
  document.getElementById('shop-overlay').classList.remove('show');
  var sc=document.getElementById('shop-chat');if(sc)sc.style.display='none';
  shopSelectedItem=null;currentShopNpc=null;
}

function doShopRefresh(){
  if(!currentShopNpc)return;
  var used=SHOP_REFRESH_COUNT[currentShopNpc]||0;
  if(used>=SHOP_MAX_REFRESH){
    addChat('sys','[상점]','오늘은 더이상 새로고침할 수 없습니다. 내일 다시 오세요.');
    return;
  }
  if(refreshShop(currentShopNpc)){
    if(typeof SFX!=='undefined')SFX.shopOpen();
    var npc=currentShopNpc;
    closeShop();
    openShop(npc);
  }
}

function updShopGold(){
  document.getElementById('shop-gold-disp').textContent='💰 '+gold+' 골드';
}

function shopSwitchTab(tab,btn){
  shopTab=tab;shopSelectedItem=null;
  document.querySelectorAll('.shop-tab').forEach(function(b){b.classList.remove('active');});
  btn.classList.add('active');
  renderShopDetail(null);
  renderShopItems();
}

function renderShopItems(){
  var grid=document.getElementById('shop-items');
  grid.innerHTML='';
  if(shopTab==='buy'){
    var stock=SHOP_STOCK[currentShopNpc]||[];
    stock.forEach(function(entry){
      var def=getItemDef(entry.id);if(!def)return;
      var r=RARITIES[def.rarity]||RARITIES.common;
      var afford=gold>=entry.price;
      var div=document.createElement('div');
      div.className='shop-item'+(afford?'':' cannot-afford');
      div.innerHTML=
        '<span class="shop-item-rarity" style="color:'+r.color+'">'+r.name+'</span>'+
        '<div class="shop-item-icon">'+(ICON[def.icon]||'📦')+'</div>'+
        '<div class="shop-item-name">'+def.name+'</div>'+
        '<div class="shop-item-price">'+entry.price+' G</div>';
      div.onclick=function(){
        shopSelectedItem=entry;
        document.querySelectorAll('.shop-item').forEach(function(d){d.classList.remove('selected');});
        div.classList.add('selected');
        resetHaggle();
        renderShopDetail(entry);
      };
      grid.appendChild(div);
    });
  } else {
    if(inventory.length===0){
      grid.innerHTML='<div style="grid-column:1/-1;color:#3a3a5a;font-size:11px;text-align:center;padding:20px;">판매할 아이템 없음</div>';
      return;
    }
    inventory.forEach(function(slot){
      var def=getItemFull(slot);
      var bp=(SHOP_STOCK['(상인) 김도윤']||[]).find(function(s){return s.id===slot.itemId;})||{price:50};
      var sp=sellPrice(bp.price);
      var r=RARITIES[def.rarity]||RARITIES.common;
      var div=document.createElement('div');div.className='shop-item';
      div.innerHTML=
        '<span class="shop-item-rarity" style="color:'+r.color+'">'+r.name+'</span>'+
        '<div class="shop-item-icon">'+(ICON[def.icon]||'📦')+'</div>'+
        '<div class="shop-item-name">'+def.name+(slot.qty>1?' x'+slot.qty:'')+'</div>'+
        '<div class="shop-item-price">'+sp+' G</div>';
      div.onclick=function(){
        shopSelectedItem={slot:slot,sellP:sp};
        document.querySelectorAll('.shop-item').forEach(function(d){d.classList.remove('selected');});
        div.classList.add('selected');
        renderShopDetail({slot:slot,sellP:sp,isSell:true});
      };
      grid.appendChild(div);
    });
  }
}

function renderShopDetail(entry){
  var empty=document.getElementById('shop-detail-empty');
  var wrap=document.getElementById('shop-detail-wrap');
  var btn=document.getElementById('shop-buy-btn');
  if(!entry){empty.style.display='block';wrap.style.display='none';return;}
  empty.style.display='none';wrap.style.display='flex';
  var def,price,btnLabel,canDo;
  if(entry.isSell){
    def=getItemFull(entry.slot);price=entry.sellP;btnLabel='▶ 판 매';canDo=true;
  } else {
    def=getItemDef(entry.id);price=entry.price;btnLabel='▶ 구 매';canDo=gold>=price;
  }
  if(!def)return;
  var r=RARITIES[def.rarity]||RARITIES.common;
  document.getElementById('sd-icon').textContent=ICON[def.icon]||'📦';
  document.getElementById('sd-name').textContent=def.name;document.getElementById('sd-name').style.color=r.color;
  document.getElementById('sd-rarity').textContent='[ '+r.name+' ]';document.getElementById('sd-rarity').style.color=r.color;
  document.getElementById('sd-type').textContent=ITEM_TYPES[def.type]||'기타';
  document.getElementById('sd-desc').textContent=def.desc;
  var statsEl=document.getElementById('sd-stats');statsEl.innerHTML='';
  Object.entries(def.stats||{}).forEach(function(pair){
    statsEl.innerHTML+='<div style="display:flex;justify-content:space-between"><span style="color:#5a5a7a">'+pair[0]+'</span><span style="color:#c9a84c;font-weight:700">'+pair[1]+'</span></div>';
  });
  document.getElementById('sd-price').textContent=price+' G';
  btn.textContent=btnLabel;btn.disabled=!canDo;
}

function doBuy(){
  if(!shopSelectedItem)return;
  if(shopTab==='sell'){
    var slot=shopSelectedItem.slot,sellP=shopSelectedItem.sellP;
    var def=getItemFull(slot);
    /* 호감도 기반 판매가 조정 */
    var sellMul=typeof getSellMultiplier==='function'?getSellMultiplier(currentShopNpc)*2:1.0;
    sellP=Math.floor(sellP*sellMul);
    slot.qty--;
    if(slot.qty<=0)inventory=inventory.filter(function(s){return s!==slot;});
    gold+=sellP;
    updShopGold();
    document.getElementById('inv-gold').textContent='💰 '+gold+' 골드';
    addChat('sys','[시스템]','['+def.name+'] 판매 완료! (+'+sellP+' 골드)');
    shopSelectedItem=null;renderShopDetail(null);renderShopItems();
  } else {
    var entry=shopSelectedItem;
    var def=getItemDef(entry.id);if(!def)return;
    var basePrice=entry._hagglePrice||entry.price;
    /* 호감도 기반 가격 조정 */
    var repMul=typeof getPriceMultiplier==='function'?getPriceMultiplier(currentShopNpc):1.0;
    var finalPrice=Math.floor(basePrice*repMul);
    if(gold<finalPrice){addChat('inf','','골드가 부족합니다!');return;}
    gold-=finalPrice;
    if(typeof SFX!=='undefined')SFX.buy();
    addItem(entry.id,1);
    updShopGold();
    document.getElementById('inv-gold').textContent='💰 '+gold+' 골드';
    addChat('sys','[시스템]','['+def.name+'] 구매 완료! (-'+finalPrice+' 골드)');
    delete entry._hagglePrice;resetHaggle();
    renderShopItems();
    renderShopDetail(entry);
  }
}

/* ════════════ 흥정 시스템 ════════════ */
var haggleCount=0;
var haggleDiscount=0;

function haggle(){
  if(!shopSelectedItem||shopTab!=='buy')return;
  var entry=shopSelectedItem;
  var def=getItemDef(entry.id);if(!def)return;
  var resultEl=document.getElementById('haggle-result');
  var isBlacksmith=currentShopNpc&&currentShopNpc.indexOf('(대장장이)')===0;
  var isMerchant=currentShopNpc&&currentShopNpc.indexOf('(상인)')===0;
  haggleCount++;
  /* 상인: 잘 안 깎아줌 (20% 확률), 대장장이: 좀 더 깎아줌 (40%) */
  var chance=isBlacksmith?0.4:isMerchant?0.2:0.3;
  /* 호감도 보너스 */
  if(typeof getHaggleBonus==='function')chance+=getHaggleBonus(currentShopNpc);
  chance=Math.max(0.05,Math.min(0.8,chance));
  /* 3번 이상 시도하면 확률 감소 */
  if(haggleCount>3)chance*=0.5;
  /* 과도한 흥정 → 호감도 하락 */
  if(haggleCount>=3&&typeof changeRep==='function'){
    changeRep(currentShopNpc,-2,'과도한 흥정');
  }
  if(haggleCount>5){
    resultEl.textContent='"더 이상은 안 돼!" (흥정 실패)';
    resultEl.style.color='#ff5555';
    if(typeof changeRep==='function')changeRep(currentShopNpc,-5,'집요한 흥정');
    return;
  }
  if(Math.random()<chance){
    /* 성공: 5~20% 할인 */
    var discountPct=5+Math.floor(Math.random()*16);
    haggleDiscount=Math.max(haggleDiscount,discountPct);
    var newPrice=Math.max(1,Math.floor(entry.price*(1-haggleDiscount/100)));
    entry._hagglePrice=newPrice;
    resultEl.textContent='"좋아, '+discountPct+'% 깎아줄게!" ('+entry.price+'G → '+newPrice+'G)';
    resultEl.style.color='#44ff88';
    document.getElementById('sd-price').textContent=newPrice+' G';
  }else{
    /* 실패 */
    var fails=[
      '"안 돼, 이건 원가야!"',
      '"흥, 다른 데서 사든가."',
      '"더 깎으면 나 손해야!"',
      '"이 가격이 최선이야."',
      '"장사가 안 되는데 더 깎으라고?"',
    ];
    resultEl.textContent=fails[Math.floor(Math.random()*fails.length)];
    resultEl.style.color='#ff8844';
  }
}

function resetHaggle(){
  haggleCount=0;haggleDiscount=0;
  var r=document.getElementById('haggle-result');
  if(r)r.textContent='';
}

function toggleShopChat(){
  var el=document.getElementById('shop-chat');
  if(!el)return;
  if(el.style.display==='none'){
    el.style.display='flex';
    document.getElementById('shop-chat-input').focus();
  }else{
    el.style.display='none';
  }
}

/* ════════════ 상점 내 NPC 대화 ════════════ */
async function sendShopChat(){
  var inp=document.getElementById('shop-chat-input');
  var msg=inp.value.trim();
  if(!msg||!currentShopNpc)return;
  inp.value='';
  var log=document.getElementById('shop-chat-log');
  log.innerHTML+='<div style="color:#88aaff;">나: '+msg+'</div>';
  log.scrollTop=log.scrollHeight;
  /* AI에게 현재 상점 상태 컨텍스트 추가 */
  var ctx='[상점 상태: '+shopTab+'탭';
  if(shopSelectedItem){
    if(shopTab==='buy'){
      var sd=getItemDef(shopSelectedItem.id);
      if(sd)ctx+=', 선택한 아이템: '+sd.name+' ('+shopSelectedItem.price+'골드)';
    }else{
      var sd2=getItemFull(shopSelectedItem.slot);
      if(sd2)ctx+=', 판매하려는 아이템: '+sd2.name+' (판매가 '+shopSelectedItem.sellP+'골드)';
    }
  }
  ctx+=', 플레이어 골드: '+gold+']';
  var reply=await askAI(currentShopNpc,ctx+' '+msg);
  log.innerHTML+='<div style="color:#c9a84c;">'+currentShopNpc+': '+reply+'</div>';
  log.scrollTop=log.scrollHeight;
  renderShopItems();
  if(shopSelectedItem)renderShopDetail(shopSelectedItem);
}

function flashHiddenItem(name){
  var el=document.getElementById('inv-new-flash');
  el.textContent='✦ 히든 아이템 획득: '+name+' ✦';
  el.classList.add('show');
  setTimeout(function(){el.classList.remove('show');},3500);
  addChat('sys','[시스템]','✦ 히든 아이템 ['+name+']을(를) 획득했습니다!');
}
