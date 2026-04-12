/* ════════════ 이모트 시스템 ════════════ */
/* 의존: player.js (PL), ui.js (addChat), multiplayer.js (ws)
   선언: currentEmote, tickEmote, triggerEmote, EMOTES */

var currentEmote=null;
var _emoteTimer=0;
var _emotePhase=0;

var EMOTES={
  dance:  {name:'춤',    icon:'💃', duration:4.0, loop:true},
  wave:   {name:'인사',  icon:'👋', duration:2.0, loop:false},
  sit:    {name:'앉기',  icon:'🪑', duration:-1,  loop:false},/* -1 = 토글 */
  clap:   {name:'박수',  icon:'👏', duration:2.5, loop:false},
  taunt:  {name:'도발',  icon:'😤', duration:2.0, loop:false},
  cheer:  {name:'환호',  icon:'🎉', duration:2.5, loop:false},
  bow:    {name:'절',    icon:'🙇', duration:2.0, loop:false},
  flex:   {name:'근육',  icon:'💪', duration:2.0, loop:false}
};

function triggerEmote(name){
  if(!PL||!PL.group)return;
  var e=EMOTES[name];
  if(!e)return;

  /* 앉기 토글 */
  if(name==='sit'&&currentEmote==='sit'){
    stopEmote();
    addChat('emote','',myName+'이(가) 일어났습니다.');
    broadcastEmote('stand');
    return;
  }

  currentEmote=name;
  _emoteTimer=0;
  _emotePhase=0;

  addChat('emote','',myName+'이(가) '+e.icon+' '+e.name+'을(를) 합니다.');
  broadcastEmote(name);
  if(typeof SFX!=='undefined'){
    if(name==='clap'||name==='cheer')SFX.click();
    if(name==='taunt')SFX.skill();
  }
}

function stopEmote(){
  currentEmote=null;_emoteTimer=0;_emotePhase=0;
  if(!PL||!PL.group)return;
  /* 원위치 복원 */
  PL.armRPivot.rotation.x=0;PL.armRPivot.rotation.z=0;
  if(PL.armL){PL.armL.rotation.x=0;PL.armL.rotation.z=0;}
  PL.legL.rotation.x=0;PL.legR.rotation.x=0;
  PL.group.position.y=(typeof getTerrainY==='function')?getTerrainY(PL.group.position.x,PL.group.position.z):0;
  if(PL.body)PL.body.rotation.x=0;
  if(PL.head)PL.head.rotation.x=0;
}

function broadcastEmote(name){
  if(typeof ws!=='undefined'&&ws&&ws.readyState===1){
    ws.send(JSON.stringify({type:'emote',emote:name}));
  }
}

function tickEmote(dt){
  if(!currentEmote||!PL||!PL.group)return;
  _emoteTimer+=dt;
  var e=EMOTES[currentEmote];

  /* 이동하면 이모트 취소 (앉기 제외) */
  if(currentEmote!=='sit'){
    if(keys&&(keys['w']||keys['s']||keys['a']||keys['d'])){stopEmote();return;}
  }

  /* 지속시간 체크 */
  if(e.duration>0&&_emoteTimer>=e.duration){
    if(e.loop){_emoteTimer=0;_emotePhase=0;}
    else{stopEmote();return;}
  }

  var t=_emoteTimer;

  if(currentEmote==='dance'){
    /* ── 춤: 리듬감 있는 전신 움직임 ── */
    var beat=t*4;/* BPM 기반 */
    /* 몸 좌우 흔들기 */
    var sway=Math.sin(beat)*0.15;
    PL.group.rotation.y+=Math.sin(beat*0.5)*0.02;
    /* 팔 — 좌우 교차 올리기 */
    PL.armRPivot.rotation.x=Math.sin(beat)*-0.8;
    PL.armRPivot.rotation.z=Math.sin(beat*0.5)*0.4;
    if(PL.armL){
      PL.armL.rotation.x=Math.sin(beat+Math.PI)*-0.8;
      PL.armL.rotation.z=Math.sin(beat*0.5+Math.PI)*0.4;
    }
    /* 다리 — 스텝 */
    PL.legL.rotation.x=Math.sin(beat)*0.5;
    PL.legR.rotation.x=Math.sin(beat+Math.PI)*0.5;
    /* 약간 점프 */
    var baseY=(typeof getTerrainY==='function')?getTerrainY(PL.group.position.x,PL.group.position.z):0;
    PL.group.position.y=baseY+Math.abs(Math.sin(beat*2))*0.15;
    /* 머리 좌우 */
    if(PL.head)PL.head.rotation.z=Math.sin(beat*0.5)*0.1;
  }

  else if(currentEmote==='wave'){
    /* ── 인사: 오른팔 크게 흔들기 ── */
    var wt=t*6;
    /* 팔 올리기 (처음 0.3초) → 흔들기 → 내리기 */
    if(t<0.3){
      var lift=t/0.3;
      PL.armRPivot.rotation.x=-lift*1.2;
      PL.armRPivot.rotation.z=-lift*0.6;
    }else if(t<1.5){
      PL.armRPivot.rotation.x=-1.2;
      PL.armRPivot.rotation.z=-0.6+Math.sin((t-0.3)*8)*0.4;
    }else{
      var down=(t-1.5)/0.5;
      PL.armRPivot.rotation.x=-1.2*(1-down);
      PL.armRPivot.rotation.z=(-0.6)*(1-down);
    }
    /* 몸 살짝 기울이기 */
    if(PL.body)PL.body.rotation.z=Math.sin(t*4)*0.03;
  }

  else if(currentEmote==='sit'){
    /* ── 앉기: 다리 굽히고 몸 낮추기 ── */
    var sitT=Math.min(t/0.4,1);
    PL.legL.rotation.x=-sitT*1.4;
    PL.legR.rotation.x=-sitT*1.4;
    /* 몸 앞으로 약간 */
    if(PL.body)PL.body.rotation.x=sitT*0.15;
    /* Y 낮추기 */
    var baseY2=(typeof getTerrainY==='function')?getTerrainY(PL.group.position.x,PL.group.position.z):0;
    PL.group.position.y=baseY2-sitT*0.4;
    /* 팔 무릎 위에 */
    PL.armRPivot.rotation.x=-sitT*0.6;
    if(PL.armL)PL.armL.rotation.x=-sitT*0.6;
    /* 호흡 애니메이션 (앉아 있는 동안) */
    if(t>0.5){
      var breath=Math.sin(t*1.5)*0.02;
      if(PL.body)PL.body.scale.y=1+breath;
    }
  }

  else if(currentEmote==='clap'){
    /* ── 박수: 양팔 앞으로 모았다 벌리기 ── */
    var ct=t*5;
    var clapAmt=Math.sin(ct)*0.7;
    PL.armRPivot.rotation.x=-0.9;
    PL.armRPivot.rotation.z=clapAmt*0.5;
    if(PL.armL){
      PL.armL.rotation.x=-0.9;
      PL.armL.rotation.z=-clapAmt*0.5;
    }
    /* 박수 순간 (팔이 모일 때) 소리 */
    if(Math.sin(ct)>0.95&&Math.sin(ct-dt*5)<0.95){
      if(typeof SFX!=='undefined')SFX.click();
    }
    /* 몸 약간 앞으로 */
    if(PL.body)PL.body.rotation.x=0.05+Math.abs(clapAmt)*0.03;
  }

  else if(currentEmote==='taunt'){
    /* ── 도발: 한쪽 팔로 도발 + 몸 흔들기 ── */
    if(t<0.5){
      /* 팔 올리고 손가락 까딱 */
      var lift2=t/0.5;
      PL.armRPivot.rotation.x=-lift2*1.0;
      PL.armRPivot.rotation.z=-lift2*0.3;
    }else{
      PL.armRPivot.rotation.x=-1.0;
      PL.armRPivot.rotation.z=-0.3+Math.sin((t-0.5)*10)*0.2;
      /* 몸 좌우 */
      if(PL.body)PL.body.rotation.z=Math.sin((t-0.5)*4)*0.08;
    }
    /* 다리 넓게 */
    PL.legL.rotation.z=-0.15;
    PL.legR.rotation.z=0.15;
  }

  else if(currentEmote==='cheer'){
    /* ── 환호: 양팔 위로 + 점프 ── */
    var ct2=t*3;
    /* 양팔 위로 */
    PL.armRPivot.rotation.x=-Math.PI*0.85;
    PL.armRPivot.rotation.z=Math.sin(ct2)*0.3-0.2;
    if(PL.armL){
      PL.armL.rotation.x=-Math.PI*0.85;
      PL.armL.rotation.z=-Math.sin(ct2)*0.3+0.2;
    }
    /* 점프 */
    var baseY3=(typeof getTerrainY==='function')?getTerrainY(PL.group.position.x,PL.group.position.z):0;
    PL.group.position.y=baseY3+Math.abs(Math.sin(ct2*1.5))*0.25;
    /* 머리 */
    if(PL.head)PL.head.rotation.x=-0.1+Math.sin(ct2)*0.05;
  }

  else if(currentEmote==='bow'){
    /* ── 절: 상체 숙이기 ── */
    if(t<0.5){
      var bowT=t/0.5;
      if(PL.body)PL.body.rotation.x=bowT*0.7;
      if(PL.head)PL.head.rotation.x=bowT*0.3;
      PL.armRPivot.rotation.x=bowT*0.3;
      if(PL.armL)PL.armL.rotation.x=bowT*0.3;
    }else if(t<1.3){
      /* 유지 */
      if(PL.body)PL.body.rotation.x=0.7;
      if(PL.head)PL.head.rotation.x=0.3;
    }else{
      var upT=(t-1.3)/0.7;
      if(PL.body)PL.body.rotation.x=0.7*(1-upT);
      if(PL.head)PL.head.rotation.x=0.3*(1-upT);
      PL.armRPivot.rotation.x=0.3*(1-upT);
      if(PL.armL)PL.armL.rotation.x=0.3*(1-upT);
    }
  }

  else if(currentEmote==='flex'){
    /* ── 근육: 양팔 구부려서 근육 자랑 ── */
    if(t<0.4){
      var flexT=t/0.4;
      PL.armRPivot.rotation.x=-flexT*1.5;
      PL.armRPivot.rotation.z=-flexT*0.8;
      if(PL.armL){
        PL.armL.rotation.x=-flexT*1.5;
        PL.armL.rotation.z=flexT*0.8;
      }
    }else{
      /* 유지 + 떨림 (힘주는 느낌) */
      var tremble=Math.sin(t*30)*0.03;
      PL.armRPivot.rotation.x=-1.5+tremble;
      PL.armRPivot.rotation.z=-0.8+tremble;
      if(PL.armL){
        PL.armL.rotation.x=-1.5-tremble;
        PL.armL.rotation.z=0.8-tremble;
      }
      /* 몸 팽창 (힘줌) */
      if(PL.body){
        PL.body.scale.x=1+Math.sin(t*15)*0.02;
        PL.body.scale.z=1+Math.sin(t*15)*0.02;
      }
    }
    /* 다리 넓게 */
    PL.legL.rotation.z=-0.1;
    PL.legR.rotation.z=0.1;
  }
}

/* ── 원격 플레이어 이모트 적용 ── */
function applyRemoteEmote(r,emoteName){
  if(!r||!r.group)return;
  if(emoteName==='stand'){
    r._emote=null;r._emoteTimer=0;
    r.armRPivot.rotation.x=0;r.armRPivot.rotation.z=0;
    if(r.armL){r.armL.rotation.x=0;r.armL.rotation.z=0;}
    r.legL.rotation.x=0;r.legR.rotation.x=0;
    return;
  }
  r._emote=emoteName;
  r._emoteTimer=0;
}

function tickRemoteEmote(r,dt){
  if(!r._emote||!r.group)return;
  r._emoteTimer+=dt;
  var t=r._emoteTimer;
  var name=r._emote;
  var e=EMOTES[name];
  if(!e)return;

  /* 지속시간 체크 */
  if(e.duration>0&&t>=e.duration){
    if(e.loop){r._emoteTimer=0;}
    else{r._emote=null;return;}
  }

  /* 간소화된 원격 모션 */
  if(name==='dance'){
    var beat=t*4;
    r.armRPivot.rotation.x=Math.sin(beat)*-0.8;
    if(r.armL)r.armL.rotation.x=Math.sin(beat+Math.PI)*-0.8;
    r.legL.rotation.x=Math.sin(beat)*0.5;
    r.legR.rotation.x=Math.sin(beat+Math.PI)*0.5;
  }else if(name==='wave'){
    if(t<0.3){r.armRPivot.rotation.x=-(t/0.3)*1.2;}
    else if(t<1.5){r.armRPivot.rotation.x=-1.2;r.armRPivot.rotation.z=-0.6+Math.sin((t-0.3)*8)*0.4;}
    else{r.armRPivot.rotation.x=-1.2*(1-(t-1.5)/0.5);}
  }else if(name==='sit'){
    var st=Math.min(t/0.4,1);
    r.legL.rotation.x=-st*1.4;r.legR.rotation.x=-st*1.4;
    r.armRPivot.rotation.x=-st*0.6;
    if(r.armL)r.armL.rotation.x=-st*0.6;
  }else if(name==='clap'){
    var ca=Math.sin(t*5)*0.7;
    r.armRPivot.rotation.x=-0.9;r.armRPivot.rotation.z=ca*0.5;
    if(r.armL){r.armL.rotation.x=-0.9;r.armL.rotation.z=-ca*0.5;}
  }else if(name==='bow'){
    if(t<0.5){r.armRPivot.rotation.x=(t/0.5)*0.3;}
    else if(t>1.3){r.armRPivot.rotation.x=0.3*(1-(t-1.3)/0.7);}
  }else if(name==='flex'){
    if(t>0.4){
      var tr=Math.sin(t*30)*0.03;
      r.armRPivot.rotation.x=-1.5+tr;r.armRPivot.rotation.z=-0.8+tr;
      if(r.armL){r.armL.rotation.x=-1.5-tr;r.armL.rotation.z=0.8-tr;}
    }
  }else if(name==='cheer'){
    r.armRPivot.rotation.x=-Math.PI*0.85;
    if(r.armL)r.armL.rotation.x=-Math.PI*0.85;
  }else if(name==='taunt'){
    r.armRPivot.rotation.x=-1.0;
    r.armRPivot.rotation.z=-0.3+Math.sin(t*10)*0.2;
  }
}

/* ── 채팅 커맨드 파싱 ── */
function parseEmoteCommand(text){
  if(!text||text[0]!=='/')return null;
  var cmd=text.slice(1).trim().toLowerCase();
  /* 한글/영어 매핑 */
  var map={
    '춤':'dance','dance':'dance','댄스':'dance',
    '인사':'wave','wave':'wave','안녕':'wave',
    '앉기':'sit','sit':'sit','앉아':'sit',
    '박수':'clap','clap':'clap',
    '도발':'taunt','taunt':'taunt',
    '환호':'cheer','cheer':'cheer','만세':'cheer',
    '절':'bow','bow':'bow',
    '근육':'flex','flex':'flex','💪':'flex'
  };
  return map[cmd]||null;
}
