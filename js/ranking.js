/* ════════════ 랭킹/티어 시스템 ════════════ */
/* 의존: ui.js (addChat), auth.js (savePlayerData, currentUser, sbClient)
   선언: playerRankPoints, playerTier, pvpWins, pvpLosses, calcTier, pvpWin, pvpLose */

var playerRankPoints=0;
var playerTier='bronze4';
var pvpWins=0;
var pvpLosses=0;

/* ── 티어 정의 ── */
var TIER_DEFS=[
  {id:'bronze4',name:'브론즈 4',icon:'🥉',min:0,color:'#cd7f32'},
  {id:'bronze3',name:'브론즈 3',icon:'🥉',min:100,color:'#cd7f32'},
  {id:'bronze2',name:'브론즈 2',icon:'🥉',min:200,color:'#cd7f32'},
  {id:'bronze1',name:'브론즈 1',icon:'🥉',min:300,color:'#cd7f32'},
  {id:'silver4',name:'실버 4',icon:'🥈',min:400,color:'#c0c0c0'},
  {id:'silver3',name:'실버 3',icon:'🥈',min:550,color:'#c0c0c0'},
  {id:'silver2',name:'실버 2',icon:'🥈',min:700,color:'#c0c0c0'},
  {id:'silver1',name:'실버 1',icon:'🥈',min:850,color:'#c0c0c0'},
  {id:'gold4',name:'골드 4',icon:'🥇',min:1000,color:'#ffd700'},
  {id:'gold3',name:'골드 3',icon:'🥇',min:1200,color:'#ffd700'},
  {id:'gold2',name:'골드 2',icon:'🥇',min:1400,color:'#ffd700'},
  {id:'gold1',name:'골드 1',icon:'🥇',min:1600,color:'#ffd700'},
  {id:'platinum4',name:'플래티넘 4',icon:'💎',min:1800,color:'#00cccc'},
  {id:'platinum3',name:'플래티넘 3',icon:'💎',min:2100,color:'#00cccc'},
  {id:'platinum2',name:'플래티넘 2',icon:'💎',min:2400,color:'#00cccc'},
  {id:'platinum1',name:'플래티넘 1',icon:'💎',min:2700,color:'#00cccc'},
  {id:'diamond4',name:'다이아 4',icon:'💠',min:3000,color:'#44aaff'},
  {id:'diamond3',name:'다이아 3',icon:'💠',min:3400,color:'#44aaff'},
  {id:'diamond2',name:'다이아 2',icon:'💠',min:3800,color:'#44aaff'},
  {id:'diamond1',name:'다이아 1',icon:'💠',min:4200,color:'#44aaff'},
  {id:'master',name:'마스터',icon:'👑',min:4800,color:'#ff44ff'},
  {id:'grandmaster',name:'그랜드마스터',icon:'🏆',min:5500,color:'#ff2222'},
  {id:'challenger',name:'챌린저',icon:'⚡',min:6500,color:'#ffaa00'}
];

/* ── 포인트 → 티어 계산 ── */
function calcTier(points){
  var tier=TIER_DEFS[0];
  for(var i=TIER_DEFS.length-1;i>=0;i--){
    if(points>=TIER_DEFS[i].min){tier=TIER_DEFS[i];break;}
  }
  return tier;
}

function getTierDef(tierId){
  for(var i=0;i<TIER_DEFS.length;i++){
    if(TIER_DEFS[i].id===tierId)return TIER_DEFS[i];
  }
  return TIER_DEFS[0];
}

/* ── PvP 승리 시 포인트 계산 ── */
function pvpWin(enemyLevel,enemyTierId){
  var myTier=calcTier(playerRankPoints);
  var enemyTier=getTierDef(enemyTierId||'bronze4');

  /* 기본 포인트: 25 */
  var base=25;

  /* 레벨 차이 보정: 상대가 높을수록 +, 낮을수록 - */
  var lvDiff=(enemyLevel||playerLevel)-playerLevel;
  var lvBonus=Math.floor(lvDiff*2);/* 레벨 1당 ±2포인트 */

  /* 티어 차이 보정: 상대 티어가 높을수록 더 많이 받음 */
  var myTierIdx=TIER_DEFS.indexOf(myTier);
  var enemyTierIdx=0;
  for(var i=0;i<TIER_DEFS.length;i++){if(TIER_DEFS[i].id===enemyTier.id){enemyTierIdx=i;break;}}
  var tierDiff=enemyTierIdx-myTierIdx;
  var tierBonus=Math.floor(tierDiff*5);/* 티어 1단계당 ±5포인트 */

  var total=Math.max(5,base+lvBonus+tierBonus);/* 최소 5포인트 */

  playerRankPoints+=total;
  pvpWins++;

  var newTier=calcTier(playerRankPoints);
  var promoted=newTier.id!==playerTier;
  playerTier=newTier.id;

  addChat('sys','[PvP]','<span style="color:#44ff44">승리! +'+total+'RP</span> ('+newTier.icon+' '+newTier.name+' '+playerRankPoints+'RP)');

  if(promoted){
    addChat('sys','[PvP]','<span style="color:'+newTier.color+';font-size:14px;font-weight:bold;">★ '+newTier.icon+' '+newTier.name+' 승급! ★</span>');
    if(typeof SFX!=='undefined')SFX.levelUp();
  }

  if(typeof savePlayerData==='function')savePlayerData();
  updateRankDisplay();
  return total;
}

/* ── PvP 패배 시 포인트 감소 ── */
function pvpLose(enemyLevel,enemyTierId){
  var myTier=calcTier(playerRankPoints);
  var enemyTier=getTierDef(enemyTierId||'bronze4');

  var base=20;

  /* 상대가 낮을수록 더 많이 깎임 */
  var lvDiff=playerLevel-(enemyLevel||playerLevel);
  var lvPenalty=Math.floor(lvDiff*1.5);

  var myTierIdx=TIER_DEFS.indexOf(myTier);
  var enemyTierIdx=0;
  for(var i=0;i<TIER_DEFS.length;i++){if(TIER_DEFS[i].id===enemyTier.id){enemyTierIdx=i;break;}}
  var tierDiff=myTierIdx-enemyTierIdx;
  var tierPenalty=Math.floor(tierDiff*3);

  var total=Math.max(5,base+lvPenalty+tierPenalty);

  playerRankPoints=Math.max(0,playerRankPoints-total);
  pvpLosses++;

  var newTier=calcTier(playerRankPoints);
  var demoted=newTier.id!==playerTier;
  playerTier=newTier.id;

  addChat('sys','[PvP]','<span style="color:#ff4444">패배... -'+total+'RP</span> ('+newTier.icon+' '+newTier.name+' '+playerRankPoints+'RP)');

  if(demoted){
    addChat('sys','[PvP]','<span style="color:#ff6644;">'+newTier.icon+' '+newTier.name+'(으)로 강등...</span>');
  }

  if(typeof savePlayerData==='function')savePlayerData();
  updateRankDisplay();
  return total;
}

/* ── HUD에 티어 표시 ── */
function updateRankDisplay(){
  var tier=calcTier(playerRankPoints);
  var el=document.getElementById('rank-display');
  if(!el){
    el=document.createElement('div');
    el.id='rank-display';
    el.style.cssText='position:absolute;right:8px;bottom:4px;font-size:11px;color:'+tier.color+';letter-spacing:1px;';
    var hud=document.querySelector('.hud');
    if(hud){hud.style.position='relative';hud.appendChild(el);}
  }
  el.style.color=tier.color;
  el.textContent=tier.icon+' '+tier.name+' ('+playerRankPoints+'RP)';
}

/* ── 랭킹 보드 (Supabase에서 상위 20명) ── */
function openRankBoard(){
  var modal=document.createElement('div');
  modal.id='rank-board';
  modal.style.cssText='position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:360px;max-height:500px;background:#0c0c1eee;border:2px solid #c9a84c88;border-radius:12px;padding:20px;z-index:9999;color:#f0e4bb;font-family:inherit;overflow-y:auto;';

  modal.innerHTML='<div style="text-align:center;color:#c9a84c;font-size:18px;font-weight:bold;margin-bottom:12px;">🏆 PvP 랭킹</div>'+
    '<div id="rank-list" style="font-size:12px;">로딩 중...</div>'+
    '<button onclick="document.getElementById(\'rank-board\').remove()" style="width:100%;margin-top:12px;background:#c9a84c;color:#0c0c1e;border:none;padding:10px;font-size:13px;font-weight:bold;cursor:pointer;font-family:inherit;border-radius:6px;">닫기</button>';

  document.body.appendChild(modal);

  /* Supabase에서 상위 20명 조회 */
  if(typeof sbClient!=='undefined'&&sbClient){
    sbClient.from('players').select('name,rank_points,rank_tier,level').order('rank_points',{ascending:false}).limit(20).then(function(r){
      var list=document.getElementById('rank-list');
      if(!list)return;
      if(r.error||!r.data||r.data.length===0){
        list.textContent='데이터 없음';return;
      }
      var html='';
      r.data.forEach(function(p,idx){
        var t=calcTier(p.rank_points||0);
        var medal=idx===0?'🥇':idx===1?'🥈':idx===2?'🥉':(idx+1)+'.';
        html+='<div style="display:flex;align-items:center;padding:6px 8px;background:'+(idx%2===0?'#1a1a2e':'transparent')+';border-radius:4px;margin-bottom:2px;">'+
          '<div style="width:28px;font-size:14px;">'+medal+'</div>'+
          '<div style="flex:1;">'+
            '<span style="color:'+t.color+';">'+t.icon+'</span> '+
            '<span style="font-weight:bold;">'+p.name+'</span>'+
            ' <span style="color:#888;font-size:10px;">Lv.'+p.level+'</span>'+
          '</div>'+
          '<div style="color:'+t.color+';font-size:11px;">'+t.name+' '+(p.rank_points||0)+'RP</div>'+
        '</div>';
      });
      list.innerHTML=html;
    });
  }else{
    document.getElementById('rank-list').textContent='서버 연결 필요';
  }
}
