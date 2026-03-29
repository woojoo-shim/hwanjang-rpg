/* ════════════ 사운드 시스템 (Web Audio API) ════════════ */
var _audioCtx=null;
var _sfxVolume=0.15;
var _bgmVolume=0.06;
var _bgmNode=null;
var _bgmZone='';

function getAudioCtx(){
  if(!_audioCtx){try{_audioCtx=new(window.AudioContext||window.webkitAudioContext)();}catch(e){return null;}}
  if(_audioCtx.state==='suspended')_audioCtx.resume();
  return _audioCtx;
}

function mkNoise(dur){
  var ctx=getAudioCtx();if(!ctx)return null;
  var len=ctx.sampleRate*dur;
  var buf=ctx.createBuffer(1,len,ctx.sampleRate);
  var d=buf.getChannelData(0);
  for(var i=0;i<len;i++)d[i]=(Math.random()*2-1);
  return buf;
}

function playTone(freq,dur,type,vol){
  var ctx=getAudioCtx();if(!ctx)return;
  var osc=ctx.createOscillator();
  var gain=ctx.createGain();
  osc.type=type||'sine';
  osc.frequency.value=freq;
  gain.gain.setValueAtTime((vol||0.1)*_sfxVolume,ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+dur);
  osc.connect(gain);gain.connect(ctx.destination);
  osc.start();osc.stop(ctx.currentTime+dur);
}

function playNoise(dur,vol,hp){
  var ctx=getAudioCtx();if(!ctx)return;
  var buf=mkNoise(dur);if(!buf)return;
  var src=ctx.createBufferSource();src.buffer=buf;
  var gain=ctx.createGain();
  gain.gain.setValueAtTime((vol||0.1)*_sfxVolume,ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+dur);
  if(hp){var f=ctx.createBiquadFilter();f.type='highpass';f.frequency.value=hp;src.connect(f);f.connect(gain);}
  else src.connect(gain);
  gain.connect(ctx.destination);src.start();src.stop(ctx.currentTime+dur);
}

/* ════════════ 효과음 — 부드럽고 짧게 ════════════ */
var SFX={
  swing:function(){playNoise(0.06,0.15,3000);},
  bowShoot:function(){playTone(600,0.04,'sine',0.12);playTone(350,0.08,'sine',0.08);},
  hit:function(){playTone(180,0.05,'sine',0.15);playNoise(0.03,0.1,1500);},
  crit:function(){playTone(400,0.04,'sine',0.18);playTone(700,0.06,'sine',0.12);},
  playerHit:function(){playTone(120,0.08,'sine',0.15);},
  monsterDie:function(){playTone(350,0.06,'sine',0.12);playTone(250,0.08,'sine',0.08);playTone(150,0.12,'sine',0.06);},
  playerDie:function(){playTone(180,0.2,'sine',0.15);playTone(120,0.3,'sine',0.1);},
  levelUp:function(){
    var notes=[523,659,784,1047];
    for(var i=0;i<notes.length;i++){
      (function(n,d){setTimeout(function(){playTone(n,0.2,'sine',0.15);},d);})(notes[i],i*100);
    }
  },
  itemPickup:function(){playTone(800,0.06,'sine',0.1);setTimeout(function(){playTone(1000,0.06,'sine',0.08);},50);},
  goldPickup:function(){playTone(1000,0.04,'triangle',0.08);setTimeout(function(){playTone(1300,0.04,'triangle',0.06);},40);},
  potion:function(){playTone(500,0.1,'sine',0.1);playTone(700,0.12,'sine',0.07);},
  shopOpen:function(){playTone(440,0.05,'triangle',0.08);setTimeout(function(){playTone(600,0.06,'triangle',0.06);},60);},
  buy:function(){playTone(900,0.04,'triangle',0.1);playTone(1100,0.05,'triangle',0.07);},
  questAccept:function(){playTone(523,0.1,'sine',0.1);setTimeout(function(){playTone(659,0.1,'sine',0.1);},80);setTimeout(function(){playTone(784,0.12,'sine',0.12);},160);},
  questComplete:function(){
    var notes=[523,659,784,1047];
    for(var i=0;i<notes.length;i++){(function(n,d){setTimeout(function(){playTone(n,0.15,'sine',0.12);},d);})(notes[i],i*80);}
  },
  talkStart:function(){playTone(500,0.04,'sine',0.06);},
  typeChar:function(){/* 무음 — 타이핑 소리 제거 */},
  doorEnter:function(){playTone(350,0.1,'sine',0.08);playTone(450,0.12,'sine',0.06);},
  doorExit:function(){playTone(450,0.08,'sine',0.06);playTone(350,0.1,'sine',0.05);},
  teleport:function(){
    for(var i=0;i<5;i++){(function(idx){setTimeout(function(){playTone(400+idx*80,0.1,'sine',0.08-idx*0.01);},idx*50);})(i);}
  },
  _lastStep:0,
  step:function(){
    var now=Date.now();if(now-SFX._lastStep<350)return;SFX._lastStep=now;
    playNoise(0.02,0.03,2000);
  },
  click:function(){playTone(700,0.02,'sine',0.06);},
  skill:function(){playTone(500,0.06,'sine',0.1);playTone(750,0.08,'sine',0.08);},
  poison:function(){playTone(160,0.12,'sine',0.08);},
  slow:function(){playTone(200,0.15,'sine',0.06);},
  classChange:function(){
    var notes=[523,659,784,1047,1319];
    for(var i=0;i<notes.length;i++){(function(n,d){setTimeout(function(){playTone(n,0.2,'sine',0.15);},d);})(notes[i],i*120);}
  }
};

/* ════════════ BGM — 부드러운 앰비언트 ════════════ */
var _bgmIntervals=[];
var _bgmOscs=[];

function stopBGM(){
  _bgmIntervals.forEach(function(id){clearInterval(id);});
  _bgmIntervals=[];
  _bgmOscs.forEach(function(o){try{o.stop();}catch(e){}});
  _bgmOscs=[];
  _bgmNode=null;
  _bgmZone='';
}

function playBGM(zone){
  if(zone===_bgmZone)return;
  stopBGM();
  _bgmZone=zone;
  var ctx=getAudioCtx();if(!ctx)return;

  /* 앰비언트 드론 — 각 존에 맞는 화음을 부드럽게 깔아줌 */
  var chords={
    village:[262,330,392],
    meadow:[294,370,440],
    swamp:[131,165,196],
    darkforest:[147,175,220],
    jungle:[196,247,294],
    volcano:[110,139,165],
    boss:[98,123,147]
  };
  var notes=chords[zone]||chords.village;
  var gain=ctx.createGain();
  gain.gain.value=_bgmVolume;
  gain.connect(ctx.destination);
  _bgmNode=gain;

  /* 부드러운 사인파 화음 */
  for(var i=0;i<notes.length;i++){
    var osc=ctx.createOscillator();
    osc.type='sine';
    osc.frequency.value=notes[i];
    var noteGain=ctx.createGain();
    noteGain.gain.value=_bgmVolume*0.15;
    osc.connect(noteGain);noteGain.connect(ctx.destination);
    osc.start();
    _bgmOscs.push(osc);
  }

  /* 아주 느린 멜로디 (8초마다 한 음) */
  var melody={
    village:[392,440,494,440,392,330,294,330],
    meadow:[440,494,523,494,440,392,370,392],
    swamp:[196,175,165,147,165,175,196,175],
    darkforest:[220,196,175,165,175,196,220,196],
    jungle:[294,330,349,392,349,330,294,262],
    volcano:[165,147,131,123,131,147,165,147],
    boss:[147,131,123,110,123,131,147,131]
  };
  var m=melody[zone]||melody.village;
  var mi=0;
  var intv=setInterval(function(){
    if(!_bgmNode)return;
    playTone(m[mi%m.length],3,'sine',0.04);
    mi++;
  },8000);
  _bgmIntervals.push(intv);
}

function setSfxVolume(v){_sfxVolume=Math.max(0,Math.min(1,v));}
function setBgmVolume(v){
  _bgmVolume=Math.max(0,Math.min(1,v));
  if(_bgmNode)_bgmNode.gain.value=_bgmVolume;
}
