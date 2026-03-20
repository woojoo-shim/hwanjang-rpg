/* ════════════ 인벤토리 + 상점 시스템 ════════════ */
/* 의존: config.js (RARITIES, ITEM_TYPES, ICON, ITEM_POOL, SHOP_STOCK)
        ui.js (addChat)
   선언: inventory, gold, equipped, invOpen, shopOpen, currentTab, selectedItem
   참조: refreshWeaponMesh (player.js) — 런타임 참조 */

var inventory=[]; // {itemId, qty, custom?, equipped?}
var gold=0;
var currentTab='all';
var selectedItem=null;
var equipped={weapon:null,armor:null};

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
  return Object.values(equipped).includes(slot.itemId);
}

function equipItem(slot){
  var it=getItemFull(slot);
  equipped[it.type]=slot.itemId;
  addChat('sys','[시스템]','['+it.name+']을(를) 장착했습니다.');
  if(it.type==='weapon')refreshWeaponMesh();
  renderInv();showDetail(slot);updEquipHud();
}

function unequipItem(slot){
  var it=getItemFull(slot);
  equipped[it.type]=null;
  addChat('sys','[시스템]','['+it.name+']을(를) 해제했습니다.');
  if(it.type==='weapon')refreshWeaponMesh();
  renderInv();showDetail(slot);updEquipHud();
}

function useItem(slot){
  var it=getItemFull(slot);
  if(it.type!=='consume')return;
  slot.qty--;
  if(slot.qty<=0)inventory=inventory.filter(function(s){return s!==slot;});
  addChat('sys','[시스템]','['+it.name+']을(를) 사용했습니다.');
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
  hudEq.innerHTML=
    (w?'<span title="무기" style="color:#c9a84c">'+(ICON[w.icon]||'⚔️')+' '+w.name+'</span>':'')+
    (a?'<span title="방어구" style="color:#88aacc">'+(ICON[a.icon]||'🛡️')+' '+a.name+'</span>':'');
}

function giveStartItems(){
  addItem('wooden_sword',1);
  gold=50;
  document.getElementById('inv-gold').textContent='💰 '+gold+' 골드';
  addChat('sys','[시스템]','[낡은 나무 검]을(를) 획득했습니다.');
}

/* 인벤토리 UI */
var invOpen=false;
function openInv(){
  invOpen=true;
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

function showDetail(slot){
  selectedItem=slot;
  var it=getItemFull(slot);
  var r=RARITIES[it.rarity]||RARITIES.common;
  var eq=isEquipped(slot);
  document.getElementById('inv-detail-empty').style.display='none';
  document.getElementById('inv-detail-content').style.display='block';
  document.getElementById('inv-detail-icon').textContent=ICON[it.icon]||'📦';
  document.getElementById('inv-detail-name').textContent=it.name;
  document.getElementById('inv-detail-name').style.color=r.color;
  document.getElementById('inv-detail-rarity').textContent='[ '+r.name+' ]'+(eq?' ✦ 장착중':'');
  document.getElementById('inv-detail-rarity').style.color=eq?'#90ffa0':r.color;
  document.getElementById('inv-detail-type').textContent=ITEM_TYPES[it.type]||'기타';
  document.getElementById('inv-detail-desc').textContent=it.desc;
  var statsEl=document.getElementById('inv-detail-stats');
  statsEl.innerHTML='';
  Object.entries(it.stats||{}).forEach(function(pair){
    statsEl.innerHTML+='<div class="stat-row"><span class="stat-label">'+pair[0]+'</span><span class="stat-val">'+pair[1]+'</span></div>';
  });
  if(slot.qty>1){
    statsEl.innerHTML+='<div class="stat-row"><span class="stat-label">수량</span><span class="stat-val">x'+slot.qty+'</span></div>';
  }
  var btnArea=document.getElementById('inv-detail-btns');
  btnArea.innerHTML='';
  if(it.type==='weapon'||it.type==='armor'){
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
  document.getElementById('shop-title-text').textContent='▣ '+npcName+' 상점';
  document.querySelectorAll('.shop-tab').forEach(function(t,i){t.classList.toggle('active',i===0);});
  shopSelectedItem=null;
  renderShopDetail(null);
  renderShopItems();
  updShopGold();
  return true;
}

function closeShop(){
  shopOpen=false;
  document.getElementById('shop-overlay').classList.remove('show');
  shopSelectedItem=null;currentShopNpc=null;
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
      var bp=(SHOP_STOCK['상인']||[]).find(function(s){return s.id===slot.itemId;})||{price:50};
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
    if(gold<entry.price){addChat('inf','','골드가 부족합니다!');return;}
    gold-=entry.price;
    addItem(entry.id,1);
    updShopGold();
    document.getElementById('inv-gold').textContent='💰 '+gold+' 골드';
    addChat('sys','[시스템]','['+def.name+'] 구매 완료! (-'+entry.price+' 골드)');
    renderShopItems();
    renderShopDetail(entry);
  }
}

function flashHiddenItem(name){
  var el=document.getElementById('inv-new-flash');
  el.textContent='✦ 히든 아이템 획득: '+name+' ✦';
  el.classList.add('show');
  setTimeout(function(){el.classList.remove('show');},3500);
  addChat('sys','[시스템]','✦ 히든 아이템 ['+name+']을(를) 획득했습니다!');
}
