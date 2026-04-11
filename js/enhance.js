/* ════════════ 강화 시스템 ════════════ */
/* 의존: inventory.js (inventory, equipped, gold, getItemDef)
        ui.js (addChat, toast)
   선언: enhanceOpen, openEnhance, closeEnhance */

var enhanceOpen=false;

/* 강화 확률표 (성공률%) */
var ENHANCE_RATES=[
  95, /* +0 → +1 */
  85, /* +1 → +2 */
  70, /* +2 → +3 */
  55, /* +3 → +4 */
  40, /* +4 → +5 */
  25, /* +5 → +6 */
  15, /* +6 → +7 */
  8,  /* +7 → +8 */
  4,  /* +8 → +9 */
  2   /* +9 → +10 */
];

/* 강화 비용 (골드) */
function getEnhanceCost(level){
  return Math.floor(150*Math.pow(2.2,level));
}

/* 강화 스탯 증가량 (%) */
function getEnhanceBonus(level){
  return (level+1)*10;/* +1=10%, +2=20%, ... +10=100% */
}

/* 파괴 확률 (실패 시) — 레벨 7부터 파괴 가능 */
function getDestroyRate(level){
  if(level<7)return 0;
  return (level-6)*10;/* +7 실패=10% 파괴, +8=20%, +9=30%, +10=40% */
}

function openEnhance(npcName){
  enhanceOpen=true;
  var existing=document.getElementById('enhance-wrap');
  if(existing)existing.remove();

  var wrap=document.createElement('div');
  wrap.id='enhance-wrap';
  wrap.style.cssText='position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#1a1a2e;border:3px solid #c9a84c;border-radius:14px;padding:24px;width:460px;max-width:90vw;max-height:85vh;overflow-y:auto;color:#f0e4bb;font-family:inherit;z-index:500;box-shadow:0 10px 40px rgba(0,0,0,0.6);';

  var html='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">';
  html+='<div style="font-size:18px;color:#c9a84c;font-weight:bold;">⚒️ '+npcName+' — 강화</div>';
  html+='<button onclick="closeEnhance()" style="background:transparent;color:#aaa;border:1px solid #555;padding:4px 10px;border-radius:4px;cursor:pointer;">닫기 [ESC]</button>';
  html+='</div>';

  html+='<div style="font-size:11px;color:#888;margin-bottom:16px;line-height:1.6;">장비를 강화하면 공격력/방어력이 증가합니다. 강화 레벨이 높을수록 성공률이 낮아지고, +7부터는 실패 시 파괴될 수 있습니다.</div>';

  /* 무기 강화 슬롯 */
  var wpn=equipped.weapon?getItemDef(equipped.weapon.id||equipped.weapon):null;
  var wpnLv=(equipped.weapon&&equipped.weapon.enhLevel)||0;
  html+=renderEnhanceSlot('weapon',wpn,wpnLv);

  /* 방어구 강화 슬롯 */
  var arm=equipped.armor?getItemDef(equipped.armor.id||equipped.armor):null;
  var armLv=(equipped.armor&&equipped.armor.enhLevel)||0;
  html+=renderEnhanceSlot('armor',arm,armLv);

  /* 수리 버튼 */
  var wpnCurDur=equippedDur.weapon||0,wpnMax=wpn?getMaxDurability(equipped.weapon):0;
  var armCurDur=equippedDur.armor||0,armMax=arm?getMaxDurability(equipped.armor):0;
  var needsRepair=(wpn&&wpnCurDur<wpnMax)||(arm&&armCurDur<armMax);
  if(needsRepair){
    var repairCost=Math.floor(((wpnMax-wpnCurDur)+(armMax-armCurDur))*3);
    html+='<div style="background:rgba(100,60,20,0.3);border:1px solid #c9a84c;border-radius:8px;padding:12px;margin-top:12px;">';
    html+='<div style="color:#c9a84c;font-weight:bold;margin-bottom:6px;">🔧 장비 수리</div>';
    if(wpn)html+='<div style="font-size:11px;color:#aaa;">⚔️ '+wpn.name+': '+wpnCurDur+'/'+wpnMax+'</div>';
    if(arm)html+='<div style="font-size:11px;color:#aaa;">🛡️ '+arm.name+': '+armCurDur+'/'+armMax+'</div>';
    html+='<div style="font-size:11px;color:'+(gold>=repairCost?'#c9a84c':'#ff4444')+';margin:6px 0;">💰 수리 비용: '+repairCost+' 골드</div>';
    html+='<button onclick="doRepair()" '+(gold>=repairCost?'':'disabled')+' style="width:100%;background:'+(gold>=repairCost?'#5a7c3a':'#444')+';color:#fff;border:none;padding:8px;font-size:12px;font-weight:bold;cursor:'+(gold>=repairCost?'pointer':'not-allowed')+';font-family:inherit;border-radius:6px;">🔧 모두 수리</button>';
    html+='</div>';
  }

  html+='<div style="text-align:center;margin-top:16px;color:#c9a84c;font-size:13px;">💰 '+gold+' 골드</div>';

  wrap.innerHTML=html;
  document.body.appendChild(wrap);
}

function renderEnhanceSlot(slotType,itemDef,level){
  var title=slotType==='weapon'?'⚔️ 무기':'🛡️ 방어구';
  if(!itemDef){
    return '<div style="background:rgba(0,0,0,0.3);border:1px solid #444;border-radius:8px;padding:14px;margin-bottom:12px;"><div style="color:#c9a84c;font-weight:bold;margin-bottom:6px;">'+title+'</div><div style="color:#666;font-size:12px;">장착된 '+(slotType==='weapon'?'무기':'방어구')+'가 없습니다.</div></div>';
  }
  if(level>=10){
    return '<div style="background:rgba(255,215,0,0.1);border:2px solid #ffd700;border-radius:8px;padding:14px;margin-bottom:12px;"><div style="color:#ffd700;font-weight:bold;margin-bottom:6px;">'+title+': '+itemDef.name+' <span style="color:#ffd700;">+10 (MAX)</span></div><div style="color:#ffd700;font-size:12px;">최대 강화 달성! 전설의 무기입니다.</div></div>';
  }
  var rate=ENHANCE_RATES[level]||1;
  var cost=getEnhanceCost(level);
  var bonus=getEnhanceBonus(level);
  var destroyRate=getDestroyRate(level);
  var canAfford=gold>=cost;
  var nextBonus=getEnhanceBonus(level+1);
  var lvColor=level>=7?'#ff4444':level>=4?'#ffaa22':'#88ff88';

  var html='<div style="background:rgba(0,0,0,0.3);border:1px solid #555;border-radius:8px;padding:14px;margin-bottom:12px;">';
  html+='<div style="color:#c9a84c;font-weight:bold;margin-bottom:8px;">'+title+': '+itemDef.name+' <span style="color:'+lvColor+';">+'+level+'</span></div>';
  html+='<div style="font-size:11px;color:#aaa;margin-bottom:4px;">현재 보너스: +'+bonus+'% → 강화 후: +'+nextBonus+'%</div>';
  html+='<div style="font-size:11px;color:#aaa;margin-bottom:4px;">성공 확률: <span style="color:'+(rate>=50?'#88ff88':rate>=20?'#ffaa22':'#ff4444')+';">'+rate+'%</span></div>';
  if(destroyRate>0){
    html+='<div style="font-size:11px;color:#ff6666;margin-bottom:4px;">⚠️ 실패 시 파괴 확률: '+destroyRate+'%</div>';
  }
  html+='<div style="font-size:11px;color:'+(canAfford?'#c9a84c':'#ff4444')+';margin-bottom:8px;">💰 비용: '+cost+' 골드</div>';
  html+='<button onclick="tryEnhance(\''+slotType+'\')" '+(canAfford?'':'disabled')+' style="width:100%;background:'+(canAfford?'#c9a84c':'#444')+';color:'+(canAfford?'#0c0c1e':'#888')+';border:none;padding:10px;font-size:13px;font-weight:bold;cursor:'+(canAfford?'pointer':'not-allowed')+';font-family:inherit;letter-spacing:1px;border-radius:6px;">강화 시도 (+'+level+'→+'+(level+1)+')</button>';
  html+='</div>';
  return html;
}

function tryEnhance(slotType){
  var eq=equipped[slotType];
  if(!eq){addChat('sys','[강화]','장착된 '+(slotType==='weapon'?'무기':'방어구')+'가 없습니다.');return;}
  var itemId=eq.id||eq;
  var level=eq.enhLevel||0;
  if(level>=10){addChat('sys','[강화]','이미 최대 강화 상태입니다.');return;}
  var cost=getEnhanceCost(level);
  if(gold<cost){addChat('sys','[강화]','골드가 부족합니다.');return;}
  gold-=cost;
  if(typeof updEquipHud==='function')updEquipHud();

  var rate=ENHANCE_RATES[level]||1;
  var roll=Math.random()*100;
  if(roll<rate){
    /* 성공 */
    if(typeof eq==='string'){
      equipped[slotType]={id:eq,enhLevel:level+1};
    }else{
      eq.enhLevel=level+1;
    }
    if(typeof SFX!=='undefined')SFX.levelUp();
    addChat('sys','[강화]','✨ 강화 성공! +'+(level+1)+' 달성!');
    if(typeof toast==='function')toast('강화 성공 +'+(level+1)+'!');
  }else{
    /* 실패 */
    var destroyRate=getDestroyRate(level);
    if(destroyRate>0&&Math.random()*100<destroyRate){
      /* 파괴 */
      equipped[slotType]=null;
      if(typeof SFX!=='undefined')SFX.playerHit();
      addChat('sys','[강화]','💥 강화 실패! 장비가 파괴되었습니다...');
      if(typeof toast==='function')toast('💥 장비 파괴');
    }else{
      if(typeof SFX!=='undefined')SFX.hit();
      addChat('sys','[강화]','강화 실패... 다시 시도해보세요.');
      if(typeof toast==='function')toast('강화 실패');
    }
  }
  if(typeof updEquipHud==='function')updEquipHud();
  if(typeof savePlayerData==='function')savePlayerData();
  /* UI 새로고침 */
  openEnhance(activeNpc?activeNpc.name:'대장장이');
}

function doRepair(){
  var wpnMax=equipped.weapon?getMaxDurability(equipped.weapon):0;
  var armMax=equipped.armor?getMaxDurability(equipped.armor):0;
  var wpnCur=equippedDur.weapon||0;
  var armCur=equippedDur.armor||0;
  var total=(wpnMax-wpnCur)+(armMax-armCur);
  if(total<=0){addChat('sys','[수리]','수리할 장비가 없습니다.');return;}
  var cost=Math.floor(total*3);
  if(gold<cost){addChat('sys','[수리]','골드가 부족합니다.');return;}
  gold-=cost;
  if(equipped.weapon)equippedDur.weapon=wpnMax;
  if(equipped.armor)equippedDur.armor=armMax;
  if(typeof SFX!=='undefined')SFX.levelUp();
  addChat('sys','[수리]','장비가 수리되었습니다. ('+cost+' 골드)');
  if(typeof updEquipHud==='function')updEquipHud();
  if(typeof savePlayerData==='function')savePlayerData();
  openEnhance(activeNpc?activeNpc.name:'대장장이');
}

function closeEnhance(){
  enhanceOpen=false;
  var w=document.getElementById('enhance-wrap');
  if(w)w.remove();
  activeNpc=null;
}

/* 강화 보너스를 공격력/방어력 계산에 반영하는 헬퍼 */
function getEquippedStat(slotType){
  var eq=equipped[slotType];
  if(!eq)return 0;
  var def=getItemDef(eq.id||eq);
  if(!def)return 0;
  var base=slotType==='weapon'?(def.atk||0):(def.def||0);
  var level=eq.enhLevel||0;
  var bonus=level*10;/* +N = N*10% */
  return Math.floor(base*(1+bonus/100));
}
