/* ════════════ 스탯 시스템 ════════════ */
/* 의존: player.js (playerLevel), inventory.js (equipped), ui.js (addChat)
   선언: playerStats, statPoints, openStatUI, applyStats */

var playerStats={str:0,dex:0,int:0,vit:0,luk:0};
var statPoints=0;
var _statUIOpen=false;

/* 레벨업 시 포인트 지급 */
function grantStatPoints(amount){
  statPoints+=amount;
  addChat('sys','[시스템]','스탯 포인트 +'+amount+'! (N키로 분배)');
}

/* 스탯 효과 계산 */
function getStatBonuses(){
  var s=playerStats;
  return{
    meleeDmg:Math.floor(s.str*1.5),        /* STR 1당 근접 데미지 +1.5 */
    rangedDmg:Math.floor(s.dex*1.2),       /* DEX 1당 원거리 데미지 +1.2 */
    magicDmg:Math.floor(s.int*2.0),        /* INT 1당 마법 데미지 +2.0 */
    maxHpBonus:s.vit*8,                     /* VIT 1당 최대 HP +8 */
    defBonus:Math.floor(s.vit*0.5),        /* VIT 1당 방어력 +0.5 */
    critChance:s.dex*0.005+s.luk*0.003,    /* DEX 1당 치명타 +0.5%, LUK 1당 +0.3% */
    critDmgBonus:s.luk*0.02,               /* LUK 1당 치명타 데미지 +2% */
    atkSpeed:s.dex*0.003,                   /* DEX 1당 공격속도 +0.3% */
    dropBonus:s.luk*0.01,                   /* LUK 1당 드롭률 +1% */
    goldBonus:s.luk*0.015,                  /* LUK 1당 골드 +1.5% */
    mpBonus:s.int*5                         /* INT 1당 MP +5 */
  };
}

/* 스탯 UI 열기/닫기 */
function openStatUI(){
  if(_statUIOpen){closeStatUI();return;}
  _statUIOpen=true;
  var el=document.getElementById('stat-panel');
  if(!el){
    el=document.createElement('div');
    el.id='stat-panel';
    el.style.cssText='position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:640px;max-width:95vw;background:#0c0c1e;border:2px solid #c9a84c88;border-radius:12px;padding:20px;z-index:9999;color:#f0e4bb;font-size:13px;font-family:inherit;';
    document.body.appendChild(el);
  }
  renderStatUI(el);
  el.style.display='block';
}

function closeStatUI(){
  _statUIOpen=false;
  var el=document.getElementById('stat-panel');
  if(el)el.style.display='none';
}

function renderStatUI(el){
  var b=getStatBonuses();
  var stats=[
    {key:'str',name:'💪 힘 (STR)',val:playerStats.str,desc:'근접 데미지 +'+b.meleeDmg},
    {key:'dex',name:'🏹 민첩 (DEX)',val:playerStats.dex,desc:'원거리 +'+b.rangedDmg+', 치명타 +'+(b.critChance*100).toFixed(1)+'%'},
    {key:'int',name:'🔮 지능 (INT)',val:playerStats.int,desc:'마법 데미지 +'+b.magicDmg+', MP +'+b.mpBonus},
    {key:'vit',name:'❤️ 체력 (VIT)',val:playerStats.vit,desc:'HP +'+b.maxHpBonus+', 방어력 +'+b.defBonus},
    {key:'luk',name:'🍀 운 (LUK)',val:playerStats.luk,desc:'드롭 +'+(b.dropBonus*100).toFixed(0)+'%, 골드 +'+(b.goldBonus*100).toFixed(1)+'%'}
  ];
  /* 전투 통계 계산 */
  var cs=computeCombatStats();

  var html='<div style="text-align:center;color:#c9a84c;font-size:16px;font-weight:bold;margin-bottom:12px;letter-spacing:2px;">▣ 스탯 & 전투 통계 ▣</div>';
  html+='<div style="text-align:center;margin-bottom:12px;color:#ffdd44;">남은 포인트: <span style="font-size:18px;font-weight:bold;">'+statPoints+'</span></div>';

  html+='<div style="display:flex;gap:14px;">';

  /* ── 좌: 스탯 분배 ── */
  html+='<div style="flex:1;min-width:0;">';
  stats.forEach(function(s){
    html+='<div style="display:flex;align-items:center;margin-bottom:8px;padding:6px;background:#1a1a2e;border-radius:6px;">';
    html+='<div style="flex:1;min-width:0;">';
    html+='<div style="font-weight:bold;">'+s.name+' <span style="color:#c9a84c;">'+s.val+'</span></div>';
    html+='<div style="font-size:10px;color:#888;">'+s.desc+'</div>';
    html+='</div>';
    html+='<div style="display:flex;gap:4px;flex-shrink:0;">';
    html+='<button onclick="allocStat(\''+s.key+'\',1)" '+(statPoints<=0?'disabled':'')+' style="width:28px;height:28px;background:#c9a84c33;color:#c9a84c;border:1px solid #c9a84c66;border-radius:4px;cursor:pointer;font-size:14px;font-weight:bold;'+(statPoints<=0?'opacity:0.3':'')+'">+</button>';
    html+='<button onclick="allocStat(\''+s.key+'\',5)" '+(statPoints<5?'disabled':'')+' style="width:35px;height:28px;background:#c9a84c22;color:#c9a84c;border:1px solid #c9a84c44;border-radius:4px;cursor:pointer;font-size:11px;'+(statPoints<5?'opacity:0.3':'')+'">+5</button>';
    html+='</div>';
    html+='</div>';
  });
  html+='</div>';

  /* ── 우: 전투 통계 ── */
  html+='<div style="flex:1;min-width:0;background:#13132a;border:1px solid #c9a84c44;border-radius:8px;padding:12px;">';
  html+='<div style="color:#c9a84c;font-size:13px;font-weight:bold;letter-spacing:2px;margin-bottom:10px;border-bottom:1px solid #c9a84c33;padding-bottom:6px;">📊 전투 통계</div>';
  function row(label,val,color){
    color=color||'#f0e4bb';
    return '<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px dashed #2a2a4a;font-size:11px;"><span style="color:#aaa;">'+label+'</span><span style="color:'+color+';font-weight:bold;">'+val+'</span></div>';
  }
  html+=row('⚔️ '+cs.wepType+' 데미지',cs.dmgMin+' ~ '+cs.dmgMax,'#ffdd44');
  html+=row('💥 치명타 데미지',cs.critMin+' ~ '+cs.critMax,'#ff8844');
  html+=row('🎯 치명타 확률',(cs.critCh*100).toFixed(1)+'%','#ff4488');
  html+=row('🛡️ 방어력',cs.def,'#88ccff');
  html+=row('❤️ 최대 HP',cs.maxHp,'#44ff88');
  html+=row('🔵 최대 MP',cs.maxMp,'#4488ff');
  html+=row('⚡ 공격 속도',(cs.atkSpd*100).toFixed(0)+'%','#ffcc44');
  html+=row('💰 골드 보너스','+'+(cs.goldBonus*100).toFixed(0)+'%','#ffdd44');
  html+=row('🍀 드롭률 보너스','+'+(cs.dropBonus*100).toFixed(0)+'%','#88ff88');
  html+=row('🔧 무기 강화','+'+cs.enhLv,'#ff9944');
  html+=row('⚔️ 장착 무기',cs.wepName,'#f0e4bb');
  html+=row('🛡️ 장착 방어구',cs.armName,'#f0e4bb');
  html+='</div>';

  html+='</div>';/* 플렉스 컨테이너 */

  html+='<div style="display:flex;gap:8px;margin-top:14px;">';
  html+='<button onclick="resetStats()" style="flex:1;background:transparent;color:#aa6666;border:1px solid #aa666644;padding:8px;font-size:12px;cursor:pointer;font-family:inherit;border-radius:6px;">초기화 (300골드)</button>';
  html+='<button onclick="closeStatUI()" style="flex:1;background:#c9a84c;color:#0c0c1e;border:none;padding:8px;font-size:13px;font-weight:bold;cursor:pointer;font-family:inherit;border-radius:6px;">닫기</button>';
  html+='</div>';

  el.innerHTML=html;
}

/* 전투 통계 계산 — 현재 장비 + 클래스 + 스탯 + 강화 반영 */
function computeCombatStats(){
  var cls=(typeof CLASS_DEFS!=='undefined'&&typeof playerClass!=='undefined')?(CLASS_DEFS[playerClass]||CLASS_DEFS.none):{atkMul:1,crit:0,critDmg:2,spdMul:1};
  var b=getStatBonuses();
  /* 무기 정보 */
  var wpnId=(equipped&&equipped.weapon)?(typeof equipped.weapon==='object'?equipped.weapon.id:equipped.weapon):null;
  var wpnEnh=(equipped&&equipped.weapon&&typeof equipped.weapon==='object')?(equipped.weapon.enhLevel||0):0;
  var wpnDef=wpnId?getItemDef(wpnId):null;
  var wpnName=wpnDef?wpnDef.name+(wpnEnh>0?' +'+wpnEnh:''):'없음';
  var wepType='근접';
  if(wpnDef){
    if(wpnDef.icon==='bow')wepType='활';
    else if(wpnDef.icon==='staff')wepType='마법';
  }
  var baseAtk=5;
  if(wpnDef&&wpnDef.stats&&wpnDef.stats['공격력'])baseAtk=parseInt(wpnDef.stats['공격력'])||5;
  if(wpnEnh>0)baseAtk=Math.floor(baseAtk*(1+wpnEnh*0.1));
  if(wepType==='활')baseAtk+=b.rangedDmg;
  else if(wepType==='마법')baseAtk+=b.magicDmg;
  else baseAtk+=b.meleeDmg;
  /* 공격력 최소/최대: baseAtk + 0~4 랜덤, 클래스 배율 */
  var minAtk=Math.floor(baseAtk*cls.atkMul);
  var maxAtk=Math.floor((baseAtk+4)*cls.atkMul);
  /* 비전공 무기 패널티 */
  if(wpnDef&&playerClass!=='none'&&cls.weapons&&cls.weapons.indexOf(wpnDef.icon)===-1){
    minAtk=Math.floor(minAtk*0.6);maxAtk=Math.floor(maxAtk*0.6);
  }
  /* 크리 */
  var critCh=cls.crit+b.critChance;
  var critDmgMul=cls.critDmg+b.critDmgBonus;
  var critMin=Math.floor(minAtk*critDmgMul);
  var critMax=Math.floor(maxAtk*critDmgMul);
  /* 방어구 */
  var armId=(equipped&&equipped.armor)?(typeof equipped.armor==='object'?equipped.armor.id:equipped.armor):null;
  var armDef=armId?getItemDef(armId):null;
  var armName=armDef?armDef.name:'없음';
  var defV=0;
  if(armDef&&armDef.stats&&armDef.stats['방어력'])defV=parseInt(armDef.stats['방어력'])||0;
  defV+=b.defBonus;
  /* MP */
  var baseMp=(typeof playerMaxMP!=='undefined')?playerMaxMP:60;
  return{
    wepType:wepType,wepName:wpnName,armName:armName,enhLv:wpnEnh,
    dmgMin:minAtk,dmgMax:maxAtk,
    critMin:critMin,critMax:critMax,critCh:critCh,
    def:defV,
    maxHp:(typeof playerMaxHP!=='undefined'?playerMaxHP:100),
    maxMp:baseMp+b.mpBonus,
    atkSpd:cls.spdMul+b.atkSpeed,
    goldBonus:b.goldBonus,dropBonus:b.dropBonus
  };
}

/* 스탯 할당 */
function allocStat(key,amount){
  if(statPoints<amount)return;
  playerStats[key]+=amount;
  statPoints-=amount;
  applyStatEffects();
  renderStatUI(document.getElementById('stat-panel'));
  if(typeof savePlayerData==='function')savePlayerData();
}

/* 스탯 초기화 (300골드) */
function resetStats(){
  if(typeof gold==='undefined'||gold<300){addChat('sys','[시스템]','골드가 부족합니다. (300골드 필요)');return;}
  var total=playerStats.str+playerStats.dex+playerStats.int+playerStats.vit+playerStats.luk;
  statPoints+=total;
  playerStats={str:0,dex:0,int:0,vit:0,luk:0};
  gold-=300;
  if(typeof document.getElementById('inv-gold')!=='undefined'){
    var ge=document.getElementById('inv-gold');
    if(ge)ge.textContent='💰 '+gold+' 골드';
  }
  applyStatEffects();
  renderStatUI(document.getElementById('stat-panel'));
  addChat('sys','[시스템]','스탯이 초기화되었습니다. (-300 골드)');
  if(typeof savePlayerData==='function')savePlayerData();
}

/* 스탯 효과 적용 (HP 상한 등) */
function applyStatEffects(){
  var b=getStatBonuses();
  /* 최대 HP에 VIT 보너스 적용 */
  var baseHp=100+(playerLevel-1)*20;
  var classHpMul=(typeof CLASS_DEFS!=='undefined'&&typeof playerClass!=='undefined')?((CLASS_DEFS[playerClass]||CLASS_DEFS.none).hpMul||1):1;
  playerMaxHP=Math.floor(baseHp*classHpMul)+b.maxHpBonus;
  if(playerHP>playerMaxHP)playerHP=playerMaxHP;
  if(typeof updPlayerHpBar==='function')updPlayerHpBar();
}
