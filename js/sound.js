/* ════════════ 사운드 시스템 (Web Audio API) ════════════ */
/* 의존: 없음
   선언: SFX 객체 */

var _audioCtx=null;
var _sfxVolume=0.3;
var _bgmVolume=0.15;
var _bgmNode=null;
var _bgmZone='';

function getAudioCtx(){
  if(!_audioCtx){
    try{_audioCtx=new(window.AudioContext||window.webkitAudioContext)();}
    catch(e){return null;}
  }
  if(_audioCtx.state==='suspended')_audioCtx.resume();
  return _audioCtx;
}

/* ── 유틸: 노이즈 버퍼 ── */
function mkNoise(dur){
  var ctx=getAudioCtx();if(!ctx)return null;
  var len=ctx.sampleRate*dur;
  var buf=ctx.createBuffer(1,len,ctx.sampleRate);
  var d=buf.getChannelData(0);
  for(var i=0;i<len;i++)d[i]=(Math.random()*2-1);
  return buf;
}

/* ── 유틸: 톤 재생 ── */
function playTone(freq,dur,type,vol,detune){
  var ctx=getAudioCtx();if(!ctx)return;
  var osc=ctx.createOscillator();
  var gain=ctx.createGain();
  osc.type=type||'sine';
  osc.frequency.value=freq;
  if(detune)osc.detune.value=detune;
  gain.gain.setValueAtTime((vol||1)*_sfxVolume,ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+dur);
  osc.connect(gain);gain.connect(ctx.destination);
  osc.start();osc.stop(ctx.currentTime+dur);
}

/* ── 유틸: 노이즈 재생 ── */
function playNoise(dur,vol,highpass){
  var ctx=getAudioCtx();if(!ctx)return;
  var buf=mkNoise(dur);if(!buf)return;
  var src=ctx.createBufferSource();
  src.buffer=buf;
  var gain=ctx.createGain();
  gain.gain.setValueAtTime((vol||0.3)*_sfxVolume,ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+dur);
  if(highpass){
    var filter=ctx.createBiquadFilter();
    filter.type='highpass';filter.frequency.value=highpass;
    src.connect(filter);filter.connect(gain);
  }else{
    src.connect(gain);
  }
  gain.connect(ctx.destination);
  src.start();src.stop(ctx.currentTime+dur);
}

/* ════════════ 효과음 ════════════ */

var SFX={
  /* 검 휘두르기 */
  swing:function(){
    playNoise(0.12,0.4,2000);
    playTone(200,0.08,'sawtooth',0.15);
  },
  /* 활 발사 */
  bowShoot:function(){
    playTone(800,0.06,'sine',0.2);
    playTone(400,0.15,'sine',0.15);
    playNoise(0.08,0.2,3000);
  },
  /* 적 피격 */
  hit:function(){
    playTone(150,0.1,'square',0.3);
    playNoise(0.06,0.3,1000);
  },
  /* 크리티컬 히트 */
  crit:function(){
    playTone(300,0.05,'square',0.4);
    playTone(600,0.08,'square',0.3);
    playNoise(0.1,0.4,800);
  },
  /* 플레이어 피격 */
  playerHit:function(){
    playTone(100,0.15,'sawtooth',0.35);
    playTone(80,0.2,'sine',0.2);
  },
  /* 몬스터 사망 */
  monsterDie:function(){
    playTone(400,0.08,'square',0.25);
    playTone(300,0.1,'square',0.2);
    playTone(200,0.15,'square',0.15);
    playNoise(0.2,0.2,500);
  },
  /* 플레이어 사망 */
  playerDie:function(){
    playTone(200,0.3,'sawtooth',0.3);
    playTone(150,0.4,'sawtooth',0.25);
    playTone(100,0.5,'sine',0.2);
  },
  /* 레벨업 */
  levelUp:function(){
    var ctx=getAudioCtx();if(!ctx)return;
    var notes=[523,659,784,1047];/* C5,E5,G5,C6 */
    for(var i=0;i<notes.length;i++){
      (function(n,delay){
        setTimeout(function(){playTone(n,0.3,'sine',0.3);},delay);
      })(notes[i],i*120);
    }
  },
  /* 아이템 획득 */
  itemPickup:function(){
    playTone(880,0.08,'sine',0.25);
    setTimeout(function(){playTone(1100,0.1,'sine',0.2);},60);
  },
  /* 골드 획득 */
  goldPickup:function(){
    playTone(1200,0.05,'triangle',0.2);
    setTimeout(function(){playTone(1500,0.06,'triangle',0.18);},50);
    setTimeout(function(){playTone(1800,0.08,'triangle',0.15);},100);
  },
  /* 포션 사용 */
  potion:function(){
    playTone(600,0.15,'sine',0.2);
    playTone(800,0.2,'sine',0.15);
    playNoise(0.1,0.1,4000);
  },
  /* 상점 열기 */
  shopOpen:function(){
    playTone(440,0.08,'triangle',0.15);
    setTimeout(function(){playTone(660,0.1,'triangle',0.12);},80);
  },
  /* 상점 구매 */
  buy:function(){
    playTone(1000,0.05,'triangle',0.2);
    playTone(1200,0.08,'triangle',0.15);
    playTone(800,0.1,'sine',0.1);
  },
  /* 퀘스트 수락 */
  questAccept:function(){
    playTone(523,0.12,'sine',0.2);
    setTimeout(function(){playTone(659,0.12,'sine',0.2);},100);
    setTimeout(function(){playTone(784,0.15,'sine',0.25);},200);
  },
  /* 퀘스트 완료 */
  questComplete:function(){
    var notes=[523,659,784,1047,784,1047];
    for(var i=0;i<notes.length;i++){
      (function(n,d){setTimeout(function(){playTone(n,0.2,'sine',0.25);},d);})(notes[i],i*100);
    }
  },
  /* NPC 대화 시작 */
  talkStart:function(){
    playTone(500,0.06,'sine',0.12);
    playTone(600,0.08,'sine',0.1);
  },
  /* 글자 타이핑 (NPC 대사) */
  typeChar:function(){
    playTone(400+Math.random()*200,0.03,'square',0.05);
  },
  /* 건물 입장 */
  doorEnter:function(){
    playTone(300,0.15,'sine',0.15);
    playTone(400,0.2,'sine',0.12);
    playNoise(0.1,0.1,2000);
  },
  /* 건물 퇴장 */
  doorExit:function(){
    playTone(400,0.15,'sine',0.12);
    playTone(300,0.2,'sine',0.1);
  },
  /* 텔레포트 */
  teleport:function(){
    var ctx=getAudioCtx();if(!ctx)return;
    for(var i=0;i<8;i++){
      (function(idx){
        setTimeout(function(){playTone(300+idx*100,0.15,'sine',0.15-idx*0.015);},idx*40);
      })(i);
    }
    playNoise(0.3,0.15,3000);
  },
  /* 걷기 (자주 호출되므로 쿨다운) */
  _lastStep:0,
  step:function(){
    var now=Date.now();
    if(now-SFX._lastStep<300)return;
    SFX._lastStep=now;
    playNoise(0.04,0.08,1500);
  },
  /* UI 클릭 */
  click:function(){
    playTone(800,0.03,'sine',0.1);
  },
  /* 스킬 사용 */
  skill:function(){
    playTone(600,0.08,'sawtooth',0.2);
    playTone(900,0.12,'sine',0.15);
    playNoise(0.08,0.15,2000);
  },
  /* 독 데미지 */
  poison:function(){
    playTone(150,0.2,'sawtooth',0.15);
    playNoise(0.15,0.1,500);
  },
  /* 둔화 */
  slow:function(){
    playTone(200,0.3,'sine',0.12);
    playTone(150,0.35,'sine',0.1);
  },
  /* 전직 */
  classChange:function(){
    var notes=[523,659,784,1047,1319,1568];
    for(var i=0;i<notes.length;i++){
      (function(n,d){setTimeout(function(){playTone(n,0.25,'sine',0.3);},d);})(notes[i],i*150);
    }
    setTimeout(function(){playNoise(0.3,0.2,1000);},notes.length*150);
  }
};

/* ════════════ BGM (존별 배경음악) ════════════ */
var _bgmIntervals=[];

function stopBGM(){
  _bgmIntervals.forEach(function(id){clearInterval(id);});
  _bgmIntervals=[];
  if(_bgmNode){
    try{_bgmNode.gain.exponentialRampToValueAtTime(0.001,getAudioCtx().currentTime+0.5);}catch(e){}
    _bgmNode=null;
  }
  _bgmZone='';
}

function playBGM(zone){
  if(zone===_bgmZone)return;
  stopBGM();
  _bgmZone=zone;
  var ctx=getAudioCtx();if(!ctx)return;

  var gain=ctx.createGain();
  gain.gain.value=_bgmVolume;
  gain.connect(ctx.destination);
  _bgmNode=gain;

  /* 존별 멜로디 패턴 */
  var patterns={
    village:{notes:[262,330,392,330,262,294,330,294],tempo:400,type:'sine'},
    meadow:{notes:[330,392,440,392,330,294,330,392],tempo:500,type:'sine'},
    swamp:{notes:[147,165,175,165,147,131,147,110],tempo:600,type:'sawtooth'},
    darkforest:{notes:[131,147,156,147,131,123,131,110],tempo:700,type:'triangle'},
    jungle:{notes:[196,220,262,294,262,220,196,175],tempo:450,type:'sine'},
    volcano:{notes:[110,131,147,131,110,98,110,87],tempo:550,type:'sawtooth'},
    boss:{notes:[87,98,110,131,110,98,87,73],tempo:350,type:'square'}
  };

  var p=patterns[zone]||patterns.village;
  var idx=0;
  var intv=setInterval(function(){
    if(!_bgmNode)return;
    var ctx2=getAudioCtx();if(!ctx2)return;
    var osc=ctx2.createOscillator();
    osc.type=p.type;
    osc.frequency.value=p.notes[idx%p.notes.length];
    var noteGain=ctx2.createGain();
    noteGain.gain.setValueAtTime(_bgmVolume*0.3,ctx2.currentTime);
    noteGain.gain.exponentialRampToValueAtTime(0.001,ctx2.currentTime+p.tempo/1000*0.8);
    osc.connect(noteGain);noteGain.connect(ctx2.destination);
    osc.start();osc.stop(ctx2.currentTime+p.tempo/1000*0.9);
    idx++;
  },p.tempo);
  _bgmIntervals.push(intv);
}

/* ── 볼륨 조절 ── */
function setSfxVolume(v){_sfxVolume=Math.max(0,Math.min(1,v));}
function setBgmVolume(v){_bgmVolume=Math.max(0,Math.min(1,v));if(_bgmNode)_bgmNode.gain.value=_bgmVolume;}
