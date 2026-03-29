/* ════════════ 사운드 시스템 v3 — FM 합성 + 필터 ════════════ */
var _audioCtx=null;
var _sfxVolume=0.25;
var _bgmVolume=0.04;
var _bgmNode=null;
var _bgmZone='';
var _bgmOscs=[];
var _bgmIntervals=[];

function getAudioCtx(){
  if(!_audioCtx){try{_audioCtx=new(window.AudioContext||window.webkitAudioContext)();}catch(e){return null;}}
  if(_audioCtx.state==='suspended')_audioCtx.resume();
  return _audioCtx;
}

/* ── 충격/임팩트 사운드 (FM 합성) ── */
function playImpact(freq,modFreq,modAmt,dur,vol){
  var ctx=getAudioCtx();if(!ctx)return;
  var t=ctx.currentTime;
  var mod=ctx.createOscillator();
  var modGain=ctx.createGain();
  var car=ctx.createOscillator();
  var env=ctx.createGain();
  mod.frequency.value=modFreq||200;
  modGain.gain.value=modAmt||100;
  modGain.gain.exponentialRampToValueAtTime(1,t+dur);
  car.frequency.value=freq||150;
  car.frequency.exponentialRampToValueAtTime(freq*0.3,t+dur);
  env.gain.setValueAtTime((vol||0.2)*_sfxVolume,t);
  env.gain.setValueAtTime((vol||0.2)*_sfxVolume,t+0.005);
  env.gain.exponentialRampToValueAtTime(0.001,t+dur);
  mod.connect(modGain);modGain.connect(car.frequency);
  car.connect(env);env.connect(ctx.destination);
  mod.start(t);car.start(t);
  mod.stop(t+dur);car.stop(t+dur);
}

/* ── 스윕 사운드 (주파수 변화) ── */
function playSweep(startF,endF,dur,vol,type){
  var ctx=getAudioCtx();if(!ctx)return;
  var t=ctx.currentTime;
  var osc=ctx.createOscillator();
  var env=ctx.createGain();
  osc.type=type||'sine';
  osc.frequency.setValueAtTime(startF,t);
  osc.frequency.exponentialRampToValueAtTime(endF,t+dur);
  env.gain.setValueAtTime((vol||0.1)*_sfxVolume,t);
  env.gain.exponentialRampToValueAtTime(0.001,t+dur);
  osc.connect(env);env.connect(ctx.destination);
  osc.start(t);osc.stop(t+dur);
}

/* ── 필터드 노이즈 (우쉬/바람 소리) ── */
function playFilteredNoise(dur,vol,lpFreq,hpFreq){
  var ctx=getAudioCtx();if(!ctx)return;
  var t=ctx.currentTime;
  var len=ctx.sampleRate*dur;
  var buf=ctx.createBuffer(1,len,ctx.sampleRate);
  var d=buf.getChannelData(0);
  for(var i=0;i<len;i++)d[i]=Math.random()*2-1;
  var src=ctx.createBufferSource();src.buffer=buf;
  var env=ctx.createGain();
  env.gain.setValueAtTime(0.001,t);
  env.gain.linearRampToValueAtTime((vol||0.1)*_sfxVolume,t+dur*0.1);
  env.gain.exponentialRampToValueAtTime(0.001,t+dur);
  var chain=src;
  if(hpFreq){var hp=ctx.createBiquadFilter();hp.type='highpass';hp.frequency.value=hpFreq;hp.Q.value=0.5;chain.connect(hp);chain=hp;}
  if(lpFreq){var lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=lpFreq;lp.Q.value=1;chain.connect(lp);chain=lp;}
  chain.connect(env);env.connect(ctx.destination);
  src.start(t);src.stop(t+dur);
}

/* ── 벨/차임 (감쇠 사인파) ── */
function playChime(freq,dur,vol){
  var ctx=getAudioCtx();if(!ctx)return;
  var t=ctx.currentTime;
  var osc=ctx.createOscillator();
  var osc2=ctx.createOscillator();
  var env=ctx.createGain();
  osc.type='sine';osc.frequency.value=freq;
  osc2.type='sine';osc2.frequency.value=freq*2.01;/* 약간 디튠된 하모닉 */
  env.gain.setValueAtTime((vol||0.1)*_sfxVolume,t);
  env.gain.exponentialRampToValueAtTime(0.001,t+dur);
  osc.connect(env);osc2.connect(env);env.connect(ctx.destination);
  osc.start(t);osc2.start(t);osc.stop(t+dur);osc2.stop(t+dur);
}

/* ── 부드러운 톤 ── */
function playSoftTone(freq,dur,vol){
  var ctx=getAudioCtx();if(!ctx)return;
  var t=ctx.currentTime;
  var osc=ctx.createOscillator();
  var env=ctx.createGain();
  var lp=ctx.createBiquadFilter();
  osc.type='triangle';osc.frequency.value=freq;
  lp.type='lowpass';lp.frequency.value=freq*3;lp.Q.value=0.7;
  env.gain.setValueAtTime(0.001,t);
  env.gain.linearRampToValueAtTime((vol||0.1)*_sfxVolume,t+dur*0.15);
  env.gain.exponentialRampToValueAtTime(0.001,t+dur);
  osc.connect(lp);lp.connect(env);env.connect(ctx.destination);
  osc.start(t);osc.stop(t+dur);
}

/* ════════════ 효과음 ════════════ */
var SFX={
  /* 검 휘두르기 — 바람 가르는 소리 */
  swing:function(){
    playFilteredNoise(0.12,0.2,2000,800);
    playSweep(400,150,0.08,0.05);
  },
  /* 활 발사 — 현 튕기는 소리 */
  bowShoot:function(){
    playSweep(800,200,0.1,0.1);
    playFilteredNoise(0.05,0.08,4000,1500);
  },
  /* 적 피격 — 둔탁한 타격 */
  hit:function(){
    playImpact(200,300,150,0.08,0.2);
  },
  /* 크리티컬 — 강한 충격 */
  crit:function(){
    playImpact(250,400,200,0.1,0.25);
    playChime(800,0.08,0.08);
  },
  /* 플레이어 피격 — 낮은 쿵 */
  playerHit:function(){
    playImpact(100,150,100,0.12,0.2);
  },
  /* 몬스터 사망 — 떨어지는 톤 */
  monsterDie:function(){
    playSweep(400,80,0.2,0.1);
    playFilteredNoise(0.15,0.1,1000,200);
  },
  /* 플레이어 사망 — 느린 하강 */
  playerDie:function(){
    playSweep(300,60,0.5,0.15);
    setTimeout(function(){playSweep(200,40,0.4,0.1);},200);
  },
  /* 레벨업 — 상승 차임 */
  levelUp:function(){
    var notes=[523,659,784,1047];
    for(var i=0;i<notes.length;i++){
      (function(n,d){setTimeout(function(){playChime(n,0.3,0.12);},d);})(notes[i],i*100);
    }
  },
  /* 아이템 획득 — 짧은 차임 */
  itemPickup:function(){
    playChime(880,0.1,0.1);
    setTimeout(function(){playChime(1100,0.08,0.07);},50);
  },
  /* 골드 — 동전 소리 */
  goldPickup:function(){
    playChime(2000,0.05,0.06);
    setTimeout(function(){playChime(2400,0.05,0.05);},30);
    setTimeout(function(){playChime(3000,0.04,0.04);},60);
  },
  /* 포션 — 물 붓는 느낌 */
  potion:function(){
    playFilteredNoise(0.2,0.08,800,200);
    playSoftTone(600,0.15,0.06);
  },
  /* 상점 열기 */
  shopOpen:function(){
    playChime(440,0.08,0.06);
    setTimeout(function(){playChime(660,0.08,0.05);},60);
  },
  /* 구매 */
  buy:function(){
    playChime(1000,0.06,0.08);
    playChime(1200,0.06,0.06);
  },
  /* 퀘스트 수락 */
  questAccept:function(){
    playChime(523,0.15,0.08);
    setTimeout(function(){playChime(659,0.15,0.08);},80);
    setTimeout(function(){playChime(784,0.2,0.1);},160);
  },
  /* 퀘스트 완료 */
  questComplete:function(){
    var notes=[523,659,784,1047];
    for(var i=0;i<notes.length;i++){(function(n,d){setTimeout(function(){playChime(n,0.25,0.1);},d);})(notes[i],i*80);}
  },
  /* NPC 대화 시작 */
  talkStart:function(){playSoftTone(500,0.06,0.04);},
  /* 타이핑 — 무음 */
  typeChar:function(){},
  /* 건물 입장 — 문 소리 */
  doorEnter:function(){
    playFilteredNoise(0.15,0.06,600,100);
    playSoftTone(300,0.1,0.04);
  },
  /* 건물 퇴장 */
  doorExit:function(){
    playFilteredNoise(0.12,0.05,500,100);
    playSoftTone(400,0.08,0.03);
  },
  /* 텔레포트 — 마법 느낌 */
  teleport:function(){
    for(var i=0;i<5;i++){(function(idx){setTimeout(function(){playSweep(300+idx*100,800+idx*100,0.15,0.06);},idx*60);})(i);}
    playFilteredNoise(0.3,0.06,3000,500);
  },
  /* 걷기 — 거의 안 들림 */
  _lastStep:0,
  step:function(){
    var now=Date.now();if(now-SFX._lastStep<350)return;SFX._lastStep=now;
    var zone=(typeof insideBuilding!=='undefined'&&insideBuilding)?'indoor':(typeof currentZone!=='undefined'?currentZone:'village');
    if(zone==='indoor'){
      /* 나무 바닥 — 톡톡 */
      playImpact(800+Math.random()*200,100,20,0.04,0.1);
    }else if(zone==='village'){
      /* 돌바닥 — 딱딱 */
      playImpact(600+Math.random()*150,200,30,0.04,0.1);
    }else if(zone==='meadow'){
      /* 잔디 — 사각사각 */
      playFilteredNoise(0.05,0.1,1800,400);
    }else if(zone==='swamp'){
      /* 늪 — 찰퍽 */
      playFilteredNoise(0.06,0.12,600,80);
      playSweep(200,80,0.06,0.04);
    }else if(zone==='darkforest'||zone==='jungle'){
      /* 낙엽 — 바스락 */
      playFilteredNoise(0.05,0.1,2500,600);
    }else if(zone==='volcano'){
      /* 자갈 — 짜각 */
      playImpact(500+Math.random()*300,300,40,0.03,0.1);
      playFilteredNoise(0.03,0.06,3000,1000);
    }else{
      playFilteredNoise(0.05,0.1,1500,300);
    }
  },
  /* UI 클릭 */
  click:function(){playChime(800,0.03,0.04);},
  /* 스킬 사용 */
  skill:function(){
    playSweep(300,700,0.1,0.1);
    playFilteredNoise(0.08,0.08,2000,500);
  },
  /* 독 */
  poison:function(){playSweep(200,100,0.15,0.06,'triangle');},
  /* 둔화 */
  slow:function(){playSweep(300,150,0.2,0.05);},
  /* 전직 */
  classChange:function(){
    var notes=[523,659,784,1047,1319];
    for(var i=0;i<notes.length;i++){(function(n,d){setTimeout(function(){playChime(n,0.3,0.12);},d);})(notes[i],i*120);}
    setTimeout(function(){playFilteredNoise(0.4,0.08,4000,1000);},600);
  }
};

/* ════════════ BGM — MP3 파일 + 드론 폴백 ════════════ */
var _bgmAudio=null;

var _bgmFiles={
  village:'sounds/village_meadow.mp3',
  meadow:'sounds/village_meadow.mp3'
};

function stopBGM(){
  _bgmIntervals.forEach(function(id){clearInterval(id);});
  _bgmIntervals=[];
  _bgmOscs.forEach(function(o){try{o.stop();}catch(e){}});
  _bgmOscs=[];_bgmNode=null;
  if(_bgmAudio){_bgmAudio.pause();_bgmAudio.currentTime=0;_bgmAudio=null;}
  _bgmZone='';
}

function playBGM(zone){
  if(zone===_bgmZone)return;
  stopBGM();
  _bgmZone=zone;

  /* MP3 파일이 있는 존 */
  if(_bgmFiles[zone]){
    _bgmAudio=new Audio(_bgmFiles[zone]);
    _bgmAudio.loop=true;
    _bgmAudio.volume=_bgmVolume*3;
    _bgmAudio.play().catch(function(){});
    return;
  }

  /* 나머지 존 — 앰비언트 드론 */
  var ctx=getAudioCtx();if(!ctx)return;
  var chords={
    swamp:[131,165,196],darkforest:[147,175,220],
    jungle:[196,247,294],volcano:[110,139,165],
    boss:[98,123,147]
  };
  var notes=chords[zone]||[196,247,294];

  for(var i=0;i<notes.length;i++){
    var osc=ctx.createOscillator();
    var lp=ctx.createBiquadFilter();
    var g=ctx.createGain();
    osc.type='sine';osc.frequency.value=notes[i];
    lp.type='lowpass';lp.frequency.value=notes[i]*2;lp.Q.value=0.3;
    g.gain.value=_bgmVolume*0.1;
    osc.connect(lp);lp.connect(g);g.connect(ctx.destination);
    osc.start();_bgmOscs.push(osc);
  }
}

function setSfxVolume(v){_sfxVolume=Math.max(0,Math.min(1,v));}
function setBgmVolume(v){_bgmVolume=Math.max(0,Math.min(1,v));if(_bgmAudio)_bgmAudio.volume=_bgmVolume*3;}
