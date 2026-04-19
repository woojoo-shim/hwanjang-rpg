/* ════════════ 패치노트 시스템 ════════════ */
var PATCH_VERSION='1.6.0';
var PATCH_DATE='2026-04-18';
var PATCH_NOTES=[
  {cat:'🆕 v1.6.0 신규',items:[
    '🔥 횃불 시스템 — 3단계 (일반/밝은/영원의) 밤에만 주변 조명',
    '🌙 밤 특별 아이템 드롭 — 밤 사냥 보상 증가',
    '✨ 마법 투사체 — 파이어볼 빛나는 구체 + 꼬리 파티클 + 피격 폭발',
    '📱 모바일 스킬 버튼 (Q/R/T) + 파티 버튼 추가',
    '🗺️ 길 네트워크 확장 — 모든 존 연결, 교차로 바닥 메꿈',
    '🐾 몬스터 3D 모델 고퀄 업그레이드 — 거미/독사/유인원/표범/모기/나무정령',
    '🏃 움직임 애니메이션 리워크 — 크로스바디 스윙, 힙 스웨이, 4족 갤럽, 호흡/눈 깜빡임'
  ]},
  {cat:'⚙️ v1.6.0 개선',items:[
    'NPC 밤에도 정상 영업 (수면 시스템 제거)',
    '밤낮 비율 2:3 (밤 4분, 낮 6분)',
    'API 토큰 사용량 ~80% 절감 (프롬프트/히스토리 최적화)',
    '다리 방향 수정, 마을 남쪽 출입구 폐쇄 (동쪽 성문만)',
    '토끼/늑대 귀 애니메이션 버그 수정',
    '애플 기기 폰트 자동 감지 → fallback'
  ]},
  {cat:'🔧 시스템',items:[
    'NPC 호감도 시스템 — 행동에 따라 NPC 태도 변화',
    'AI 악용 방지 — 가격/보상 상한, 중복 퀘스트 차단',
    '개발자 서버 분리 — 테스트 환경 별도 운영'
  ]},
  {cat:'⚔️ 전투/직업',items:[
    '16개 신규 직업 추가 (총 24개) — 요리사, 낚시꾼, 광대, 사신 등',
    '고유 전직 퀘스트 — 전사: 사슴왕 처치, 마법사: 마법 시험 등',
    'PvP 랭크 시스템 (브론즈~다이아)',
    '대쉬(Space) + 달리기(Shift) 추가 (Lv.5+)',
    '스탯 시스템 (N키) — STR/DEX/INT/VIT/LUK',
    '최대 레벨 50'
  ]},
  {cat:'🏰 콘텐츠',items:[
    '던전 3개 (고블린/수정/용암) — NPC 대화로 입장',
    '레이드 보스 4개 — 파티 전용 아레나',
    '왕국 스토리라인 — 쿠데타 이벤트, 진영 선택',
    '일일퀘스트 + 로그인 보상',
    '낚시 시스템',
    '포톤 최종 보스 + 프롤로그 컷씬',
    'NPC 물건찾기 퀘스트'
  ]},
  {cat:'🎨 비주얼',items:[
    '디아블로2 스타일 아이템 설명',
    '밤낮 시스템 (10분 주기)',
    '미니맵 (M키)',
    '이모트 (/춤, /인사, /앉기, /박수, /도발)',
    '코스메틱 대량 추가',
    '레벨/랭크 이름 위 표시'
  ]},
  {cat:'🔊 사운드',items:[
    '존별 발소리 (돌/풀/늪/낙엽/자갈)',
    'BGM 시스템 (마을/초원 MP3)',
    '전투/레벨업/아이템 효과음'
  ]},
  {cat:'🗺️ 맵',items:[
    '모든 존 도로 연결 완성',
    '마을 성벽 정비 (동쪽 성문 출입)',
    '늪/숲 구조물 추가',
    '다리 방향 수정'
  ]},
  {cat:'📱 모바일',items:[
    '달리기/TAB 버튼 추가',
    '컨트롤 드래그 편집',
    'PWA 설치 지원'
  ]},
  {cat:'🛡️ 밸런스',items:[
    '경제 밸런싱 (수입/지출 비율 조정)',
    '몬스터 무기 드롭 (5%)',
    '내구도 시스템',
    '텔레포트 무적 + 몬스터 밀어내기'
  ]}
];

function showPatchNotes(){
  var lastSeen=localStorage.getItem('lastPatchSeen')||'';
  if(lastSeen===PATCH_VERSION)return;

  var ov=document.createElement('div');
  ov.id='patch-overlay';
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:99999;display:flex;align-items:center;justify-content:center;';

  var panel=document.createElement('div');
  panel.style.cssText='background:#0c0c1e;border:2px solid #c9a84c;border-radius:12px;padding:24px;width:90vw;max-width:500px;max-height:80vh;overflow-y:auto;color:#f0e4bb;font-family:inherit;';

  var html='<div style="text-align:center;margin-bottom:16px;">'+
    '<div style="color:#c9a84c;font-size:22px;font-weight:bold;letter-spacing:3px;">📜 패치노트</div>'+
    '<div style="color:#888;font-size:12px;margin-top:4px;">v'+PATCH_VERSION+' — '+PATCH_DATE+'</div>'+
    '</div>';

  PATCH_NOTES.forEach(function(section){
    html+='<div style="color:#c9a84c;font-size:14px;font-weight:bold;margin-top:12px;margin-bottom:6px;border-bottom:1px solid #c9a84c33;padding-bottom:4px;">'+section.cat+'</div>';
    html+='<ul style="margin:0;padding-left:16px;font-size:12px;color:#ddd;line-height:1.6;">';
    section.items.forEach(function(item){
      html+='<li>'+item+'</li>';
    });
    html+='</ul>';
  });

  html+='<button id="patch-close" style="width:100%;margin-top:16px;background:#c9a84c;color:#0c0c1e;border:none;padding:12px;font-size:14px;font-weight:bold;cursor:pointer;font-family:inherit;letter-spacing:2px;border-radius:6px;">확인</button>';

  panel.innerHTML=html;
  ov.appendChild(panel);
  document.body.appendChild(ov);

  document.getElementById('patch-close').addEventListener('click',function(){
    localStorage.setItem('lastPatchSeen',PATCH_VERSION);
    ov.remove();
  });
}

/* 게임 진입 후 자동 표시 */
if(typeof document!=='undefined'){
  document.addEventListener('DOMContentLoaded',function(){
    setTimeout(showPatchNotes,2000);
  });
}
