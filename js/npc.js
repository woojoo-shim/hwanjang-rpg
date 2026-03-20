/* ════════════ AI NPC 대화 시스템 ════════════ */
/* 의존: config.js (NPC_AI, ANTHROPIC_API_KEY, ICON)
        ui.js (addChat)
        inventory.js (addItem, flashHiddenItem, openShop)
   선언: activeNpc, isAiThinking */

var activeNpc=null;
var isAiThinking=false;

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
    npcData.history.push({role:'assistant',content:parsed.clean});
    return parsed.clean;
  }catch(e){
    console.warn('AI fetch error',e);
    npcData.history.pop();
    return npcFallback(npcName);
  }
}

function npcFallback(npcName){
  var fallbacks={
    '마을 이장':['흠... 잠깐 무슨 말을 하려 했는지... 아무튼, 무슨 일인가?','사슴고기 퀘스트는 아직 진행 중인가?','마을 구경은 잘 하고 있나?'],
    '상인':['아, 죄송해요 잠깐 딴 생각했어요 ㅎㅎ. 뭐 필요하세요?','좋은 물건 많이 있어요~ 구경해보세요!','오늘 특가 있는데 관심 없으세요?'],
    '대장장이':['...','강화 필요하면 말해요.','장비 없으면 싸워도 소용없어요.'],
    '???':['...','뉴비네.','레벨이나 올려.'],
  };
  var list=fallbacks[npcName]||['...'];
  return list[Math.floor(Math.random()*list.length)];
}

/* ── 대화창 ── */
function talk(n){
  if(n.name==='상인'||n.name==='대장장이'){
    openShop(n.name);
    addChat('npc',n.name,n.name==='상인'?'어서오세요~ 뭐 필요하세요? ㅎㅎ':'뭐 필요해요.');
    return;
  }
  activeNpc=n;
  document.getElementById('dwho-name').textContent='[ '+n.name+' ]';
  var te=document.getElementById('dtxt');
  te.innerHTML='';
  document.getElementById('dbox').classList.add('show');
  document.getElementById('dmsg').focus();
  var greeting={
    '마을 이장':'어서 오게, 새 모험가여! 오늘은 어떤 일로 찾아왔나?',
    '???':'...'
  };
  var g=greeting[n.name]||'...';
  typeText(g);
  addChat('npc',n.name,g);
  NPC_AI[n.name].history=[];
  NPC_AI[n.name].history.push({role:'assistant',content:g});
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
  if(e.key.toLowerCase()==='i'&&document.activeElement!==document.getElementById('dmsg')&&document.activeElement!==document.getElementById('cin')&&document.activeElement!==document.getElementById('ni')){
    e.preventDefault();
    if(invOpen)closeInv();else openInv();
  }
});

/* ── 채팅 (AI) ── */
var chatNpcIdx=0;
var CHAT_NPCS=['마을 이장','상인','대장장이','???'];
async function sendChat(){
  var ci=document.getElementById('cin'),v=ci.value.trim();if(!v)return;
  ci.value='';
  var btn=document.getElementById('csd');
  btn.disabled=true;ci.disabled=true;
  addChat('plr',myName,v);
  var npcName=CHAT_NPCS[chatNpcIdx%CHAT_NPCS.length];chatNpcIdx++;
  var thinkEl=document.createElement('div');thinkEl.className='cm inf';thinkEl.textContent=npcName+' 이(가) 입력 중...';
  document.getElementById('clog').appendChild(thinkEl);
  var reply=await askAI(npcName,v);
  thinkEl.remove();
  addChat('npc',npcName,reply);
  btn.disabled=false;ci.disabled=false;ci.focus();
}
document.getElementById('cin').addEventListener('keydown',function(e){if(e.key==='Enter')sendChat();});
