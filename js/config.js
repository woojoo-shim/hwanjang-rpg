/* ════════════ 전역 설정 ════════════ */
// Anthropic API 키 — 추후 서버사이드 프록시로 교체 예정
var ANTHROPIC_API_KEY=localStorage.getItem('ANTHROPIC_API_KEY')||'';
function setApiKey(k){ANTHROPIC_API_KEY=k;localStorage.setItem('ANTHROPIC_API_KEY',k);}

// Supabase 설정
var SUPABASE_URL='https://ewjoafemcaisobcyqife.supabase.co';
var SUPABASE_ANON_KEY='sb_publishable_nxhrZ04Z052EaS1WM2IOxg_h98fYhfW';

/* ── 닉네임 화면 ── */
var ERRS=[
  {t:"이미 사용 중인 닉네임입니다.\n다른 닉네임을 입력해주세요.",c:"#ff7070",b:"#ff4444",l:"[ 닉네임 중복 ]",lc:"#ff5555"},
  {t:"닉네임에 부적절한 단어가 포함되어 있습니다.\n정책에 위반되지 않는 닉네임을 사용해주세요.",c:"#ff7070",b:"#ff4444",l:"[ 정책 위반 ]",lc:"#ff5555"},
  {t:"닉네임이 너무 평범합니다.\n더 창의적인 닉네임을 사용해주세요.",c:"#ffcc44",b:"#cc8822",l:"[ 닉네임 부적합 ]",lc:"#ffaa33"},
  {t:"서버 처리 중 알 수 없는 오류가 발생했습니다.\n\n오류 코드: ERR_NICK_0x0042\n잠시 후 다시 시도해주세요.",c:"#ff7070",b:"#ff4444",l:"[ 서버 오류 ]",lc:"#ff5555"},
  {t:"닉네임 생성 시도 횟수를 초과하였습니다.\n잠시 후 시스템이 자동으로 닉네임을 배정합니다...",c:"#ffcc44",b:"#cc8822",l:"[ 한도 초과 ]",lc:"#ffaa33"},
];
function genWeirdName(){
  /* 랜덤 한글 음절 조합 (초성+중성+종성) */
  var len=2+Math.floor(Math.random()*3); // 2~4글자
  var s='';
  for(var i=0;i<len;i++){
    var code=0xAC00+Math.floor(Math.random()*11172);
    s+=String.fromCharCode(code);
  }
  return s;
}

/* ════════════ 아이템 시스템 ════════════ */
var RARITIES={
  common:  {name:'일반',  color:'#888888'},
  rare:    {name:'희귀',  color:'#3aaa3a'},
  epic:    {name:'에픽',  color:'#6666ff'},
  legendary:{name:'전설', color:'#c9a84c'},
  hidden:  {name:'히든',  color:'#ff44ff'},
};
var ITEM_TYPES={weapon:'무기',armor:'방어구',consume:'소비',etc:'기타'};

var ICON={
  sword:'⚔️',axe:'🪓',bow:'🏹',staff:'🪄',dagger:'🗡️',
  helmet:'⛑️',armor:'🛡️',gloves:'🧤',boots:'👢',robe:'🥻',
  potion:'🧪',food:'🍖',scroll:'📜',
  ring:'💍',necklace:'📿',gem:'💎',coin:'🪙',
  bone:'🦴',fish:'🐟',leaf:'🍃',crystal:'🔮',
  key:'🗝️',book:'📚',feather:'🪶',egg:'🥚',star:'⭐',
  mushroom:'🍄',bottle:'🫙',mask:'🎭',crown:'👑',
};

var ITEM_POOL=[
  // ─ 무기 ─
  {id:'wooden_sword',   name:'낡은 나무 검',    icon:'sword',  type:'weapon',  rarity:'common',   desc:'뭔가 때리기엔 좋다. 뭔가를.',     stats:{공격력:3}},
  {id:'bone_sword',     name:'뼈 검',           icon:'bone',   type:'weapon',  rarity:'common',   desc:'고대 거인의 뼈. 의외로 날카롭다.',stats:{공격력:7}},
  {id:'iron_sword',     name:'철 검',           icon:'sword',  type:'weapon',  rarity:'rare',     desc:'기본은 하는 무기.',               stats:{공격력:15,내구도:80}},
  {id:'steel_axe',      name:'강철 도끼',        icon:'axe',   type:'weapon',  rarity:'rare',     desc:'무식하게 강하다.',                stats:{공격력:18,공격속도:-5}},
  {id:'hunting_bow',    name:'사냥꾼의 활',      icon:'bow',   type:'weapon',  rarity:'rare',     desc:'원거리 공격이 가능하다.',          stats:{공격력:13,사거리:10}},
  {id:'fire_staff',     name:'화염 지팡이',      icon:'staff', type:'weapon',  rarity:'epic',     desc:'끝에 불꽃이 항상 타오른다.',       stats:{마법공격:28,화염데미지:12}},
  {id:'moonblade',      name:'달빛 검',          icon:'sword', type:'weapon',  rarity:'epic',     desc:'달이 뜨면 공격력이 2배가 된다.',   stats:{공격력:35,야간공격력:70}},
  {id:'dragonfang',     name:'용의 송곳니',      icon:'dagger',type:'weapon',  rarity:'legendary',desc:'진짜 용의 이빨로 만들었다. 아파.',  stats:{공격력:60,관통:25}},
  {id:'eclipse_blade',  name:'이클립스',         icon:'sword', type:'weapon',  rarity:'legendary',desc:'동양 검사 최고의 검. 어디서 났지?',stats:{공격력:88,발도술:50}},
  {id:'badminton_neck', name:'배트민턴 목걸이',  icon:'necklace',type:'etc', rarity:'common',   desc:'상인이 강력 추천했다. 왜인지 모르겠다.',stats:{운:1}},
  {id:'death_scythe',   name:'죽음의 데스 사이드',icon:'axe',  type:'weapon',  rarity:'rare',     desc:'이름이 좀 과한 것 같은 낫.',       stats:{공격력:22,공포:10}},
  // ─ 방어구 ─
  {id:'cloth_armor',    name:'천 갑옷 조각',     icon:'armor', type:'armor',   rarity:'common',   desc:'입긴 했는데... 방어가 되나?',      stats:{방어력:2}},
  {id:'leather_armor',  name:'가죽 갑옷',        icon:'armor', type:'armor',   rarity:'common',   desc:'가죽으로 만든 기본 갑옷.',         stats:{방어력:8}},
  {id:'iron_helmet',    name:'철 투구',          icon:'helmet',type:'armor',   rarity:'rare',     desc:'머리가 좀 무겁다.',               stats:{방어력:10,이동속도:-2}},
  {id:'steel_boots',    name:'강철 부츠',        icon:'boots', type:'armor',   rarity:'rare',     desc:'발이 아프다. 그래도 튼튼하다.',    stats:{방어력:7,이동속도:-1}},
  {id:'mage_robe',      name:'마법사 로브',      icon:'robe',  type:'armor',   rarity:'epic',     desc:'마나가 절로 넘친다.',             stats:{방어력:5,마나:50,마법증폭:15}},
  {id:'dragon_scale',   name:'용린 갑옷',        icon:'armor', type:'armor',   rarity:'legendary',desc:'용의 비늘로 만든 최고급 갑옷.',    stats:{방어력:65,화염저항:80}},
  // ─ 소비 ─
  {id:'red_potion',     name:'빨간 포션',        icon:'potion',type:'consume', rarity:'common',   desc:'HP 50 회복.',                    stats:{회복:50},qty:3},
  {id:'blue_potion',    name:'파란 포션',        icon:'potion',type:'consume', rarity:'common',   desc:'MP 30 회복.',                    stats:{마나회복:30},qty:2},
  {id:'deer_meat',      name:'사슴고기',         icon:'food',  type:'consume', rarity:'common',   desc:'마을 이장이 찾는 바로 그것.',      stats:{체력:20},qty:0},
  {id:'ether',          name:'에테르',           icon:'bottle',type:'consume', rarity:'rare',     desc:'MP 100 즉시 회복.',              stats:{마나회복:100}},
  {id:'elixir',         name:'엘릭서',           icon:'crystal',type:'consume',rarity:'epic',     desc:'HP/MP 전부 회복. 귀하다.',        stats:{회복:'전체'}},
  {id:'immortal_potion',name:'불사의 물약',      icon:'bottle',type:'consume', rarity:'legendary',desc:'한 번 죽어도 부활한다. 부작용 있음.',stats:{부활:1}},
  // ─ 기타 ─
  {id:'rabbit_liver',   name:'토끼의 간',        icon:'food',  type:'etc',     rarity:'common',   desc:'마을 이장 퀘스트 재료.',          stats:{}},
  {id:'deer_antler',    name:'사슴 녹용',        icon:'leaf',  type:'etc',     rarity:'common',   desc:'또 팔면 또 구해와야 한다.',       stats:{},qty:0},
  {id:'magic_crystal',  name:'마력 결정',        icon:'crystal',type:'etc',    rarity:'rare',     desc:'뭔가 대단한 것에 쓸 것 같다.',    stats:{마력:10}},
  {id:'star_fragment',  name:'별의 파편',        icon:'star',  type:'etc',     rarity:'epic',     desc:'떨어지는 별을 손으로 잡았다.',    stats:{운:50}},
  {id:'eternal_chain',  name:'영겁의 사슬',      icon:'ring',  type:'etc',     rarity:'legendary',desc:'모든 스킬을 봉인할 수 있다.',      stats:{봉인:100}},
];

/* ════════════ 상점 재고 ════════════ */
var SHOP_STOCK={
  '상인':[
    {id:'red_potion',    price:30},
    {id:'blue_potion',   price:40},
    {id:'leather_armor', price:120},
    {id:'iron_sword',    price:180},
    {id:'badminton_neck',price:300},
    {id:'death_scythe',  price:300},
    {id:'ether',         price:150},
    {id:'deer_meat',     price:20},
    {id:'hunting_bow',   price:220},
  ],
  '대장장이':[
    {id:'iron_sword',    price:180},
    {id:'steel_axe',     price:240},
    {id:'iron_helmet',   price:160},
    {id:'steel_boots',   price:150},
    {id:'leather_armor', price:130},
    {id:'red_potion',    price:35},
  ],
};

/* ════════════ AI NPC 시스템 프롬프트 ════════════ */
var NPC_AI={
  '마을 이장':{
    system:`너는 환장 RPG라는 판타지 게임 속 "시작 마을"의 마을 이장이야.
성격: 친절하고 격식 있는 노인. 항상 "~하게", "~일세", "~하다네" 같은 어투를 씀.
중요: 플레이어 닉네임을 부르려 할 때마다 혀가 꼬여서 제대로 못 부름.
역할: 퀘스트 부여, 마을 안내.

퀘스트 규칙: 대화 중 자연스럽게 퀘스트를 제안할 수 있음. 퀘스트를 줄 때는 대사 끝에 이 형식으로 추가:
[QUEST:퀘스트이름|퀘스트설명|타입|대상|수량|보상타입|보상량]
- 타입: kill(처치) 또는 collect(수집)
- 대상: 몬스터 이름(토끼,사슴,슬라임,독두꺼비,고블린,늑대,용암 골렘,파이어드레이크) 또는 아이템 id(deer_meat,rabbit_liver,magic_crystal 등)
- 보상타입: exp(경험치), gold(골드), item(아이템id)
예시: [QUEST:사슴고기 수집|마을 잔치를 위해 사슴고기를 모아오게|collect|deer_meat|5|exp|300]
예시: [QUEST:토끼 퇴치|밭을 망치는 토끼를 처치해주게|kill|토끼|3|gold|100]
한 대화에서 퀘스트는 최대 1개만. 플레이어가 요청하거나 자연스러운 상황에서만 줄 것.

아이템 지급 규칙: 플레이어가 매우 인상적이거나 특별한 행동을 해서 진심으로 감동받았을 때만 (5% 확률, 아주 드물게) 히든 아이템을 줄 수 있음. 대부분의 대화에서는 절대 아이템을 주지 않음. 5번 이상 대화한 경우에만 고려할 것.
아이템을 줄 때는 대사 끝에 이 형식으로 추가: [HIDDEN_ITEM:아이템이름|아이템설명|아이콘키|공격력or방어력숫자]
아이콘키는 다음 중 하나: sword,axe,bow,staff,dagger,helmet,armor,gloves,boots,robe,potion,food,scroll,ring,necklace,gem,coin,bone,fish,leaf,crystal,key,book,feather,egg,star,mushroom,bottle,mask,crown
아이템 이름은 재미있고 엉뚱하게. 예: "마을이장의 의문의 열쇠", "녹슨 애정", "솔직히 뭔지 모르는 돌"
답변은 2~4문장으로 간결하게. 한국어로만 대답.`,
    history:[]
  },
  '상인':{
    system:`너는 환장 RPG 시작 마을의 잡화상인 "크로스핑거"야.
성격: 겉으로는 친절하지만 속으로는 사기꾼. 쓸모없는 물건을 비싸게 팔려고 함.
말투: "~요", "~죠", "~에요" 친절한 경어체. 가끔 "ㅎㅎ", "^^" 이모티콘.
사기 전략: 쓸모없는 물건을 레어 아이템이라고 속이거나 터무니없이 비싸게 팔려 함.

가격 흥정 규칙:
- 너는 장사꾼이야. 절대 쉽게 안 깎아줌. 이윤이 최우선
- 처음 깎아달라고 하면 무조건 거절. "에이~ 이게 원래 이 가격이에요~" 식으로
- 3번 이상 끈질기게 사정하면 겨우 5~10% 할인 가능. 그 이상은 절대 안 됨
- 감동적인 사연을 말하면 아주 드물게 15% 할인. 20% 이상은 절대 불가
- 무례하거나 협박하면 가격 30~50% 인상. "그런 태도면 더 비싸요~"
- 아부해도 잘 안 통함. "아이고~ 말만으로는 안 돼요 ㅎㅎ"
- 가격을 바꿀 때만 대사 끝에: [PRICE:아이템이름|새가격]
- 현재 판매 목록: 빨간포션 30골드, 파란포션 40골드, 가죽갑옷 120골드, 철검 180골드, 배트민턴 목걸이 300골드, 죽음의 낫 300골드, 에테르 150골드, 사슴고기 20골드, 사냥용 활 220골드
- 원가의 80% 아래로는 절대 안 깎아줌. 남는 게 없잖아요~

아이템 지급 규칙: 플레이어가 정말 재미있는 말을 하거나 거래를 잘 했을 때 극히 드물게 (3% 확률) 히든 아이템을 팔 수 있음. 대부분의 대화에서는 절대 아이템을 주지 않음.
아이템을 줄 때는 대사 끝에: [HIDDEN_ITEM:아이템이름|아이템설명|아이콘키|스탯숫자]
아이콘키: sword,axe,bow,staff,dagger,helmet,armor,gloves,boots,robe,potion,food,scroll,ring,necklace,gem,coin,bone,fish,leaf,crystal,key,book,feather,egg,star,mushroom,bottle,mask,crown
답변은 2~4문장으로 간결하게. 한국어로만 대답.`,
    history:[]
  },
  '대장장이':{
    system:`너는 환장 RPG 시작 마을의 대장장이야.
성격: 과묵하고 직설적. 말이 짧고 핵심만. 장비 강화에 자부심.
말투: "~오", "~지", "~거든요" 짧고 건조한 말투.
강화 성공률: 낮음. 하지만 본인은 "신의 뜻"이라고 함.

가격 흥정 규칙:
- 장인의 자존심이 있어서 쉽게 안 깎아줌
- 정중하게 부탁하면 5~15% 정도만 깎아줌. 아부는 안 통함
- 무례하면 "안 팔아요" 하면서 가격 30% 올림
- 가격을 바꿀 때 대사 끝에: [PRICE:아이템이름|새가격]
- 현재 판매 목록: 철검 180골드, 강철도끼 240골드, 철투구 160골드, 강철부츠 150골드, 가죽갑옷 130골드, 빨간포션 35골드
- 원가의 70% 아래로는 절대 안 깎아줌. 장인의 땀이 담겨있거든요.

아이템 지급 규칙: 플레이어가 진짜로 인상 깊은 무언가를 보여줬을 때만 (3% 확률) 직접 만든 히든 아이템을 줌.
아이템을 줄 때는 대사 끝에: [HIDDEN_ITEM:아이템이름|아이템설명|아이콘키|공격력숫자]
아이콘키: sword,axe,bow,staff,dagger,helmet,armor,gloves,boots,robe,potion,food,scroll,ring,necklace,gem,coin,bone,fish,leaf,crystal,key,book,feather,egg,star,mushroom,bottle,mask,crown
아이템은 대장장이가 만든 것처럼 묵직하고 투박한 이름. 예: "대충 만든 검", "아직 식지 않은 금속 덩어리"
답변은 1~3문장으로 매우 간결하게. 한국어로만 대답.`,
    history:[]
  },
  '???':{
    system:`너는 환장 RPG의 최고 고인물 플레이어 "토끼공듀"야. 세계관 최강자.
성격: 쿨하고 초연함. 뉴비를 귀여워하지만 티 잘 안 냄.
말투: "...", "~다", "~네", 짧고 건조하게. 가끔 "뉴비"라고 부름.
비밀: 히든 직업 보유. 직업 절대 안 알려줌.

퀘스트 규칙: 가끔 뉴비한테 도전적인 퀘스트를 줄 수 있음. 형식:
[QUEST:퀘스트이름|퀘스트설명|타입|대상|수량|보상타입|보상량]
타입: kill 또는 collect. 대상: 몬스터이름 또는 아이템id. 보상타입: exp/gold/item.
예: [QUEST:늑대 사냥|늑대 5마리 잡아와. 할 수 있으면.|kill|늑대|5|exp|500]
쉬운 퀘스트는 안 줌. 어려운 것만.

아이템 지급 규칙: 정말 극히 드물게 (2% 확률, 100번 대화 중 2번 정도) 마음에 드는 뉴비에게만 줌. 왠만하면 절대 안 줌. 뉴비한테 너무 강한 걸 주면 재미없으니까.
아이템을 줄 때는 대사 끝에: [HIDDEN_ITEM:아이템이름|아이템설명|아이콘키|공격력숫자]
아이콘키: sword,axe,bow,staff,dagger,helmet,armor,gloves,boots,robe,potion,food,scroll,ring,necklace,gem,coin,bone,fish,leaf,crystal,key,book,feather,egg,star,mushroom,bottle,mask,crown
토끼공듀가 주는 아이템은 이름이 짧고 강렬함. 예: "읏차", "토끼발", "마나 블래스터 파편"
답변은 1~2문장으로 아주 짧게. 한국어로만 대답.`,
    history:[]
  },
};

/* ════════════ NPC 정의 ════════════ */
var NPC_DEF=[
  {name:'마을 이장',px:-10,pz:-4, bc:0x7a4a18,hc:0xddaa77},
  {name:'상인',      px:-7, pz:-12,bc:0x1a3a8a,hc:0xddcc99},
  {name:'대장장이',  px:7,  pz:-12,bc:0x3a2a1a,hc:0xcc9966},
  {name:'???',       px:10, pz:-4, bc:0x1a1030,hc:0xaaaacc},
];

/* ════════════ 몬스터 정의 ════════════ */
var MONSTER_DEFS=[
  // ── 초원 (z 15~60) ──
  {id:'rabbit', name:'토끼',   hp:30,  atk:2,  exp:15, spd:2.5, aggro:6,  color:0xeeeeee,hc:0xffcccc,
   drops:[{id:'rabbit_liver',rate:.9,qty:1},{id:'red_potion',rate:.3,qty:1}]},
  {id:'deer',   name:'사슴',   hp:80,  atk:8,  exp:45, spd:3.5, aggro:5,  color:0x8a5a20,hc:0xaa7a30,
   drops:[{id:'deer_meat',rate:.95,qty:[1,3]},{id:'deer_antler',rate:.6,qty:1}]},
  // ── 독 늪 (z 60~120) ──
  {id:'slime',  name:'슬라임', hp:50,  atk:6,  exp:30, spd:1.8, aggro:7,  color:0x22aa22,hc:0x33cc33,
   drops:[{id:'magic_crystal',rate:.25,qty:1},{id:'blue_potion',rate:.5,qty:1}]},
  {id:'toad',   name:'독두꺼비', hp:90, atk:12, exp:55, spd:2.2, aggro:7, color:0x446622,hc:0x88cc44,
   drops:[{id:'magic_crystal',rate:.4,qty:1},{id:'blue_potion',rate:.4,qty:1}]},
  // ── 어두운 숲 (z 120~200) ──
  {id:'goblin', name:'고블린', hp:120, atk:14, exp:80, spd:3.0, aggro:9,  color:0x336611,hc:0x448822,
   drops:[{id:'iron_sword',rate:.1,qty:1},{id:'leather_armor',rate:.15,qty:1},{id:'red_potion',rate:.6,qty:1}]},
  {id:'wolf',   name:'늑대',   hp:150, atk:18, exp:100,spd:4.5, aggro:12, color:0x555566,hc:0x888899,
   drops:[{id:'leather_armor',rate:.3,qty:1},{id:'magic_crystal',rate:.2,qty:1}]},
  // ── 화산 지대 (z 200~280) ──
  {id:'golem',  name:'용암 골렘', hp:350,atk:28, exp:200,spd:1.5, aggro:8, color:0x883311,hc:0xff4400,
   drops:[{id:'star_fragment',rate:.3,qty:1},{id:'iron_sword',rate:.2,qty:1},{id:'elixir',rate:.05,qty:1}]},
  {id:'firedrake',name:'파이어드레이크',hp:500,atk:40,exp:350,spd:3.2,aggro:15,color:0xcc2200,hc:0xff6600,
   drops:[{id:'dragon_scale',rate:.25,qty:1},{id:'star_fragment',rate:.5,qty:1},{id:'eternal_chain',rate:.03,qty:1}]},
];

/* ════════════ 오픈 월드 설정 ════════════ */
var WORLD_BOUNDS=[-200,200,-32,860]; // minX, maxX, minZ, maxZ
var WORLD_SPAWN=[5,-3]; // 분수 옆

var ZONE_INFO={
  village:  {name:'시작 마을',   color:'#c9a84c'},
  meadow:   {name:'초원',        color:'#4aaa3a'},
  swamp:    {name:'독 늪',       color:'#44aa44'},
  darkforest:{name:'어두운 숲',  color:'#aa4422'},
  volcano:  {name:'화산 지대',   color:'#ff4400'},
};
