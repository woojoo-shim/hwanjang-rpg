/* ════════════ 인증 & 데이터 저장 (Supabase) ════════════ */
/* 의존: config.js (SUPABASE_URL, SUPABASE_ANON_KEY)
   선언: sbClient, currentUser, playerData, saveTimer */

var sbClient=null;
var currentUser=null;
var playerData=null;
var saveTimer=null;

function initSupabase(){
  if(!SUPABASE_URL||!SUPABASE_ANON_KEY){console.warn('Supabase not configured');return;}
  sbClient=supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
}

function doLogin(){
  if(!sbClient){alert('Supabase가 설정되지 않았습니다.');return;}
  var email=document.getElementById('login-email').value.trim();
  var pw=document.getElementById('login-pw').value;
  var st=document.getElementById('login-status');
  if(!email||!pw){st.style.display='block';st.textContent='이메일과 비밀번호를 입력해주세요.';st.style.color='#ff7070';return;}
  st.style.display='block';st.textContent='로그인 중...';st.style.color='#aaa';
  sbClient.auth.signInWithPassword({email:email,password:pw}).then(function(r){
    if(r.error){st.textContent='오류: '+r.error.message;st.style.color='#ff7070';}
    else{currentUser=r.data.user;loadPlayerData().then(function(){
      document.getElementById('login-screen').classList.add('hidden');
      if(playerData){restoreGameState();startGame();}
      else{document.getElementById('nick-screen').classList.remove('hidden');}
    }).catch(function(e){
      console.error('loadPlayerData error',e);
      document.getElementById('login-screen').classList.add('hidden');
      document.getElementById('nick-screen').classList.remove('hidden');
    });}
  });
}

function doSignup(){
  if(!sbClient){alert('Supabase가 설정되지 않았습니다.');return;}
  var email=document.getElementById('login-email').value.trim();
  var pw=document.getElementById('login-pw').value;
  var st=document.getElementById('login-status');
  if(!email||!pw){st.style.display='block';st.textContent='이메일과 비밀번호를 입력해주세요.';st.style.color='#ff7070';return;}
  if(pw.length<6){st.style.display='block';st.textContent='비밀번호는 6자 이상이어야 합니다.';st.style.color='#ff7070';return;}
  st.style.display='block';st.textContent='회원가입 중...';st.style.color='#aaa';
  sbClient.auth.signUp({email:email,password:pw}).then(function(r){
    if(r.error){st.textContent='오류: '+r.error.message;st.style.color='#ff7070';}
    else{currentUser=r.data.user;document.getElementById('login-screen').classList.add('hidden');document.getElementById('nick-screen').classList.remove('hidden');}
  });
}

function logout(){
  if(!sbClient)return;
  if(currentUser)savePlayerData();
  sbClient.auth.signOut().then(function(){
    currentUser=null;playerData=null;
    if(saveTimer){clearInterval(saveTimer);saveTimer=null;}
    /* 게임 상태 초기화 */
    playerHP=100;playerMaxHP=100;playerEXP=0;playerLevel=1;
    playerClass='none';gold=50;inventory=[];equipped={weapon:null,armor:null};
    classQuestState={};
    location.reload();
  });
}

async function checkSession(){
  if(!sbClient)return false;
  try{
    var r=await sbClient.auth.getSession();
    if(r.data.session){
      currentUser=r.data.session.user;
      await loadPlayerData();
      return true;
    }
  }catch(e){console.warn('Session check error',e);}
  return false;
}

async function loadPlayerData(){
  if(!sbClient||!currentUser)return;
  var r=await sbClient.from('players').select('*').eq('id',currentUser.id).single();
  if(r.data){
    playerData=r.data;
  }else{
    playerData=null;
  }
}

async function createPlayer(name){
  if(!sbClient||!currentUser)return;
  var data={
    id:currentUser.id,
    name:name,
    level:1,hp:100,max_hp:100,exp:0,gold:50,
    inventory:[],
    equipped:{weapon:null,armor:null,hat:null,cape:null,dye:null},
    position_x:WORLD_SPAWN[0],position_z:WORLD_SPAWN[1],
    zone:'village'
  };
  var r=await sbClient.from('players').insert(data);
  if(r.error)console.warn('Create player error',JSON.stringify(r.error));
  playerData=data;
}

async function savePlayerData(){
  if(!sbClient||!currentUser)return;
  if(typeof PL==='undefined'||!PL.group)return;
  var data={
    id:currentUser.id,
    name:myName,
    level:playerLevel,
    hp:playerHP,
    max_hp:playerMaxHP,
    exp:playerEXP,
    gold:gold,
    inventory:inventory,
    equipped:equipped,
    position_x:PL.group.position.x,
    position_z:PL.group.position.z,
    zone:currentZone||'village',
    class:playerClass,
    visited_zones:visitedZones,
    equipped_dur:equippedDur,
    reputation:playerReputation,
    stats:playerStats,
    stat_points:statPoints,
    rank_points:playerRankPoints,
    rank_tier:playerTier,
    pvp_wins:pvpWins,
    pvp_losses:pvpLosses
  };
  var r=await sbClient.from('players').upsert(data);
  if(r.error)console.warn('Save error',JSON.stringify(r.error));
}

function restoreGameState(){
  if(!playerData)return;
  myName=playerData.name||'모험가';
  playerLevel=playerData.level||1;
  playerHP=playerData.hp||100;
  playerMaxHP=playerData.max_hp||100;
  playerEXP=playerData.exp||0;
  gold=playerData.gold||0;
  inventory=playerData.inventory||[];
  var _eq=playerData.equipped||{};
  equipped={weapon:_eq.weapon||null,armor:_eq.armor||null,hat:_eq.hat||null,cape:_eq.cape||null,dye:_eq.dye||null};
  playerClass=playerData.class||'none';
  if(playerData.visited_zones)visitedZones=playerData.visited_zones;
  if(playerData.equipped_dur)equippedDur=playerData.equipped_dur;
  if(playerData.reputation)playerReputation=playerData.reputation;
  if(playerData.stats)playerStats=playerData.stats;
  if(playerData.stat_points!==undefined)statPoints=playerData.stat_points;
  if(playerData.rank_points!==undefined)playerRankPoints=playerData.rank_points;
  if(playerData.rank_tier)playerTier=playerData.rank_tier;
  if(playerData.pvp_wins!==undefined)pvpWins=playerData.pvp_wins;
  if(playerData.pvp_losses!==undefined)pvpLosses=playerData.pvp_losses;
  if(typeof applyStatEffects==='function')applyStatEffects();
  if(typeof updateRankDisplay==='function')setTimeout(updateRankDisplay,500);
}

function startAutoSave(){
  if(saveTimer)clearInterval(saveTimer);
  saveTimer=setInterval(function(){savePlayerData();},30000);
  window.addEventListener('beforeunload',function(){
    if(currentUser)savePlayerData();
  });
}
