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
  {id:'tp_scroll',      name:'텔레포트 두루마리',icon:'scroll', type:'consume',rarity:'rare',    desc:'방문했던 장소로 순간이동한다.',       stats:{}},
  {id:'arrow',          name:'화살',            icon:'feather',type:'consume',rarity:'common',  desc:'활에 사용하는 기본 화살.',            stats:{}},
  {id:'fire_arrow',     name:'불 화살',         icon:'feather',type:'consume',rarity:'rare',    desc:'불이 붙은 화살. 추가 데미지.',        stats:{추가데미지:5}},
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
  '(상인) 김도윤':[
    {id:'red_potion',    price:30},
    {id:'blue_potion',   price:40},
    {id:'leather_armor', price:120},
    {id:'iron_sword',    price:180},
    {id:'badminton_neck',price:300},
    {id:'death_scythe',  price:300},
    {id:'ether',         price:150},
    {id:'deer_meat',     price:20},
    {id:'hunting_bow',   price:220},
    {id:'tp_scroll',     price:100},
    {id:'arrow',         price:5},
    {id:'fire_arrow',    price:15},
  ],
  '(대장장이) 이태산':[
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
  '(이장) 박건호':{
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
  '(상인) 김도윤':{
    system:`너는 환장 RPG 시작 마을의 잡화상인 "크로스핑거"야.
성격: 겉으로는 친절하지만 속으로는 사기꾼. 쓸모없는 물건을 비싸게 팔려고 함.
말투: "~요", "~죠", "~에요" 친절한 경어체. 가끔 "ㅎㅎ", "^^" 이모티콘.
사기 전략: 쓸모없는 물건을 레어 아이템이라고 속이거나 터무니없이 비싸게 팔려 함.

가격 흥정 규칙:
- 너는 장사꾼이야. 쉽게 안 깎아줌
- 처음엔 거절. 2~3번 이상 끈질기면 5~15% 할인
- 무례하면 가격 인상
- ★★★ 매우 중요: 가격이 바뀔 때 반드시 대사 끝에 이 태그를 붙여: [PRICE:아이템이름|새가격] ★★★
- 예시: "좋아요, 특별히 깎아줄게요~ [PRICE:빨간 포션|25]"
- 예시: "그런 태도면 더 비싸요! [PRICE:철 검|220]"
- 아이템 이름은 정확히: 빨간 포션, 파란 포션, 가죽 갑옷, 철 검, 배트민턴 목걸이, 죽음의 데스 사이드, 에테르, 사슴고기, 사냥꾼의 활, 화살, 불 화살
- 원가의 70% 아래로는 절대 안 깎아줌

상점 모드 인식:
- 플레이어 메시지 앞에 [상점 상태: buy탭/sell탭, 선택 아이템, 골드] 정보가 붙어옴
- buy탭이면 구매 상담: 추천, 가격 흥정, 물건 설명
- sell탭이면 판매 상담: 매입가 제시, 더 비싸게 사달라는 흥정에 대응 (잘 안 올려줌)
- 판매 시 매입가를 올려달라고 하면 아주 드물게 5~10%만 올려줌
- [상점 상태:] 부분은 절대 대사에 언급하지 마. 자연스럽게 대화해

플레이어 요청 대응:
- 플레이어가 특정 물건을 요청하면("화살 있어?", "포션 필요해") 상점에 있는 물건이면 가격 안내
- 상점에 없는 물건을 요청하면 게임에 존재하는 아이템 중 하나를 희귀도에 맞는 가격으로 추가 가능
- 희귀도별 기본 가격: common=30~80, rare=100~300, epic=400~800, legendary=1000~3000
- 상점에 추가할 때 대사 끝에: [SHOP_ADD:아이템id|가격]
- 사용 가능한 아이템id: wooden_sword, bone_sword, iron_sword, steel_axe, hunting_bow, fire_staff, moonblade, dragonfang, eclipse_blade, death_scythe, leather_armor, iron_helmet, steel_boots, red_potion, blue_potion, ether, deer_meat, arrow, fire_arrow, rabbit_liver, deer_antler, magic_crystal, star_fragment, dragon_scale
- 없는 아이템을 요청하면 "그건 구하기 어려운 물건이에요~" 하고 비슷한 걸 추천

아이템 지급 규칙: 플레이어가 정말 재미있는 말을 하거나 거래를 잘 했을 때 극히 드물게 (3% 확률) 히든 아이템을 팔 수 있음. 대부분의 대화에서는 절대 아이템을 주지 않음.
아이템을 줄 때는 대사 끝에: [HIDDEN_ITEM:아이템이름|아이템설명|아이콘키|스탯숫자]
아이콘키: sword,axe,bow,staff,dagger,helmet,armor,gloves,boots,robe,potion,food,scroll,ring,necklace,gem,coin,bone,fish,leaf,crystal,key,book,feather,egg,star,mushroom,bottle,mask,crown
답변은 2~4문장으로 간결하게. 한국어로만 대답.`,
    history:[]
  },
  '(대장장이) 이태산':{
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
  '(???) 정체불명':{
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

/* ════════════ 직업 시스템 ════════════ */
var CLASS_DEFS={
  none:{name:'무직',color:0x2a5a3a,hc:0xddcc99,hpMul:1,atkMul:1,spdMul:1,crit:0,critDmg:2,weapons:['sword','axe','bow','staff','dagger'],passive:null,desc:'아직 전직하지 않은 모험가',quest:null},
  warrior:{name:'전사',color:0x8b0000,hc:0xddcc99,hpMul:1.5,atkMul:1.0,spdMul:1.0,crit:0.05,critDmg:2,weapons:['sword','axe'],passive:'defense',desc:'높은 HP와 방어력의 근접 탱커',quest:{type:'kill',target:'사슴',count:5,desc:'사슴 5마리를 처치하라'}},
  mage:{name:'마법사',color:0x1a1a8b,hc:0xaabbee,hpMul:0.8,atkMul:2.0,spdMul:1.0,crit:0.05,critDmg:2,weapons:['staff'],passive:'mana_burst',desc:'강력한 원거리 마법 공격',quest:{type:'kill',target:'슬라임',count:8,desc:'슬라임 8마리를 처치하라'}},
  archer:{name:'궁수',color:0x2a6a2a,hc:0xddcc99,hpMul:1.0,atkMul:1.0,spdMul:1.5,crit:0.15,critDmg:2,weapons:['bow'],passive:'rapid_fire',desc:'빠른 공격속도의 원거리 딜러',quest:{type:'kill',target:'토끼',count:10,desc:'토끼 10마리를 사냥하라'}},
  rogue:{name:'도적',color:0x3a2a3a,hc:0xccbbaa,hpMul:0.9,atkMul:1.2,spdMul:1.3,crit:0.3,critDmg:2.5,weapons:['dagger'],passive:'stealth',desc:'높은 치명타와 빠른 이동',quest:{type:'kill',target:'독두꺼비',count:6,desc:'독두꺼비 6마리를 처치하라'}},
  paladin:{name:'성기사',color:0xccaa33,hc:0xeeddaa,hpMul:1.3,atkMul:0.9,spdMul:0.9,crit:0.05,critDmg:2,weapons:['sword'],passive:'lifesteal',desc:'공격 시 HP를 흡수하는 성전사',quest:{type:'kill',target:'사슴',count:8,desc:'사슴 8마리를 처치하여 자비를 증명하라'}},
  berserker:{name:'광전사',color:0x990000,hc:0xdd8866,hpMul:0.7,atkMul:2.0,spdMul:1.1,crit:0.1,critDmg:2.5,weapons:['axe'],passive:'rage',desc:'HP가 낮을수록 공격력 증가',quest:{type:'kill',target:'고블린',count:5,desc:'고블린 5마리를 처치하라'}},
  shaman:{name:'주술사',color:0x336633,hc:0x99cc99,hpMul:0.9,atkMul:1.3,spdMul:1.0,crit:0.1,critDmg:2,weapons:['staff'],passive:'poison',desc:'공격 시 지속 독 데미지',quest:{type:'kill',target:'슬라임',count:10,desc:'슬라임 10마리를 처치하여 독의 힘을 깨달아라'}},
  assassin:{name:'암살자',color:0x1a1a2a,hc:0xbbbbcc,hpMul:0.7,atkMul:1.5,spdMul:1.4,crit:0.5,critDmg:3,weapons:['dagger'],passive:'execute',desc:'극치명타로 적을 처단',quest:{type:'kill',target:'늑대',count:5,desc:'늑대 5마리를 은밀히 처치하라'}}
};
var playerClass='none';

/* ════════════ 스킬 시스템 ════════════ */
var CLASS_SKILLS={
  none:[],
  warrior:[
    {id:'shield_bash',name:'방패 강타',key:'Q',cd:5,desc:'전방 적에게 강력한 일격 (ATK x3)',dmgMul:3,range:4,color:'#ff4444'},
    {id:'war_cry',name:'전투 함성',key:'R',cd:15,desc:'8초간 ATK +50%',buff:'atkUp',buffDur:8,color:'#ff8800'},
    {id:'iron_wall',name:'철벽 방어',key:'T',cd:20,desc:'5초간 받는 데미지 70% 감소',buff:'defUp',buffDur:5,color:'#aaaaaa'}
  ],
  mage:[
    {id:'fireball',name:'파이어볼',key:'Q',cd:4,desc:'마우스 방향으로 화염구 발사 (ATK x4)',dmgMul:4,range:20,projectile:true,color:'#ff6600',pColor:0xff4400},
    {id:'ice_nova',name:'아이스 노바',key:'R',cd:12,desc:'주변 적 전체에 빙결 데미지 (ATK x2)',dmgMul:2,aoe:10,color:'#44ccff'},
    {id:'mana_shield',name:'마나 실드',key:'T',cd:25,desc:'6초간 받는 데미지 50% 감소',buff:'defUp',buffDur:6,color:'#4444ff'}
  ],
  archer:[
    {id:'multi_shot',name:'멀티샷',key:'Q',cd:6,desc:'3발의 화살을 부채꼴로 발사',multiShot:3,dmgMul:1.5,color:'#44ff44'},
    {id:'rapid_fire',name:'속사',key:'R',cd:10,desc:'5초간 공격속도 2배',buff:'spdUp',buffDur:5,color:'#88ff44'},
    {id:'snipe',name:'저격',key:'T',cd:15,desc:'긴 사거리 강력한 한 발 (ATK x5)',dmgMul:5,range:30,projectile:true,color:'#ffff44',pColor:0xffcc00}
  ],
  rogue:[
    {id:'backstab',name:'백스탭',key:'Q',cd:5,desc:'뒤에서 강타 (ATK x4, 항상 치명타)',dmgMul:4,range:4,forceCrit:true,color:'#aa44aa'},
    {id:'smoke_bomb',name:'연막탄',key:'R',cd:15,desc:'3초간 무적',buff:'invincible',buffDur:3,color:'#888888'},
    {id:'blade_fury',name:'칼날 폭풍',key:'T',cd:12,desc:'주변 적 전체 공격 (ATK x2)',dmgMul:2,aoe:6,color:'#cc44cc'}
  ],
  paladin:[
    {id:'holy_strike',name:'신성 강타',key:'Q',cd:5,desc:'빛의 일격 (ATK x3) + HP 회복',dmgMul:3,range:4,healMul:0.2,color:'#ffdd44'},
    {id:'heal',name:'치유',key:'R',cd:12,desc:'HP 30% 회복',selfHeal:0.3,color:'#44ff88'},
    {id:'divine_shield',name:'신성 보호막',key:'T',cd:25,desc:'5초간 무적',buff:'invincible',buffDur:5,color:'#ffffaa'}
  ],
  berserker:[
    {id:'frenzy',name:'광란',key:'Q',cd:4,desc:'3연타 (각 ATK x1.5)',multiHit:3,dmgMul:1.5,range:4,color:'#ff2222'},
    {id:'blood_rage',name:'피의 분노',key:'R',cd:15,desc:'HP 20% 소모, 10초간 ATK 2배',selfDmg:0.2,buff:'atkUp2',buffDur:10,color:'#cc0000'},
    {id:'earthquake',name:'지진',key:'T',cd:18,desc:'주변 적 전체 강타 (ATK x3)',dmgMul:3,aoe:8,color:'#884400'}
  ],
  shaman:[
    {id:'poison_dart',name:'독침',key:'Q',cd:4,desc:'독 발사체 (ATK x2 + 5초 독)',dmgMul:2,range:15,projectile:true,poisonDur:5,color:'#44aa44',pColor:0x22aa22},
    {id:'totem',name:'토템 설치',key:'R',cd:20,desc:'10초간 주변 적에게 지속 데미지',summon:'totem',dur:10,color:'#886633'},
    {id:'curse',name:'저주',key:'T',cd:15,desc:'가장 가까운 적 5초간 받는 데미지 2배',debuff:'curse',debuffDur:5,range:10,color:'#440044'}
  ],
  assassin:[
    {id:'shadow_strike',name:'그림자 일격',key:'Q',cd:3,desc:'순간이동 후 공격 (ATK x5)',dmgMul:5,range:10,teleport:true,color:'#6644aa'},
    {id:'vanish',name:'은신',key:'R',cd:18,desc:'5초간 투명+다음 공격 치명타 확정',buff:'stealth',buffDur:5,color:'#444466'},
    {id:'death_mark',name:'죽음의 표식',key:'T',cd:20,desc:'대상에 표식, 5초 후 ATK x8 폭발',markDmg:8,markDur:5,range:8,color:'#aa0044'}
  ]
};

/* 스킬 쿨다운 상태 */
var skillCooldowns={};
/* 버프 상태 {buffId: {remaining:초, ...}} */
var activeBuffs={};

/* ════════════ NPC 정의 ════════════ */
var NPC_DEF=[
  {name:'(이장) 박건호',px:-6, pz:0,  bc:0x7a4a18,hc:0xddaa77},
  {name:'(상인) 김도윤',px:-7, pz:-12,bc:0x1a3a8a,hc:0xddcc99},
  {name:'(대장장이) 이태산',px:7,pz:-12,bc:0x3a2a1a,hc:0xcc9966},
  {name:'(???) 정체불명',px:8, pz:0,  bc:0x1a1030,hc:0xaaaacc},
  /* 전직 NPC — 각 존에 숨겨진 위치 (정적) */
  {name:'(현자) 윤서연',   px:-70,pz:280, bc:0x1a1a8b,hc:0xaabbee,classNpc:'mage'},
  {name:'(사냥꾼) 한시우', px:-180,pz:150,bc:0x2a6a2a,hc:0xddcc99,classNpc:'archer'},
  {name:'(성기사) 강예준', px:175, pz:250,bc:0xccaa33,hc:0xeeddaa,classNpc:'paladin'},
  {name:'(무당) 오지안',   px:185, pz:180,bc:0x336633,hc:0x99cc99,classNpc:'shaman'},
  /* 아래 4개는 동적 스폰 — npc.js가 관리: warrior, rogue, assassin, berserker */
];

/* ════════════ 몬스터 정의 ════════════ */
var MONSTER_DEFS=[
  // ── 초원 (z 15~60) ──
  {id:'rabbit', name:'토끼',   hp:60,  atk:8,  exp:12, spd:3.2, aggro:14, color:0xeeeeee,hc:0xffcccc,
   drops:[{id:'rabbit_liver',rate:.7,qty:1},{id:'red_potion',rate:.15,qty:1}]},
  {id:'deer',   name:'사슴',   hp:150, atk:18, exp:35, spd:4.0, aggro:14, color:0x8a5a20,hc:0xaa7a30,
   drops:[{id:'deer_meat',rate:.8,qty:[1,2]},{id:'deer_antler',rate:.4,qty:1}]},
  // ── 독 늪 (z 60~120) ──
  {id:'slime',  name:'슬라임', hp:120, atk:15, exp:25, spd:2.5, aggro:16, color:0x22aa22,hc:0x33cc33,
   drops:[{id:'magic_crystal',rate:.15,qty:1},{id:'blue_potion',rate:.3,qty:1}]},
  {id:'toad',   name:'독두꺼비', hp:200, atk:25, exp:45, spd:3.0, aggro:16, color:0x446622,hc:0x88cc44,
   drops:[{id:'magic_crystal',rate:.25,qty:1},{id:'blue_potion',rate:.25,qty:1}]},
  // ── 어두운 숲 (z 120~200) ──
  {id:'goblin', name:'고블린', hp:280, atk:32, exp:65, spd:3.8, aggro:20, color:0x336611,hc:0x448822,
   drops:[{id:'iron_sword',rate:.05,qty:1},{id:'leather_armor',rate:.08,qty:1},{id:'red_potion',rate:.4,qty:1}]},
  {id:'wolf',   name:'늑대',   hp:350, atk:40, exp:85, spd:5.5, aggro:22, color:0x555566,hc:0x888899,
   drops:[{id:'leather_armor',rate:.15,qty:1},{id:'magic_crystal',rate:.1,qty:1}]},
  // ── 정글 (x>80, z 300~560) ──
  {id:'jungle_spider',name:'정글 거미',hp:320,atk:35,exp:70,spd:4.5,aggro:20,color:0x2a1a00,hc:0x553300,
   drops:[{id:'magic_crystal',rate:.2,qty:1},{id:'red_potion',rate:.3,qty:1}]},
  {id:'jungle_snake',name:'독사',hp:260,atk:45,exp:80,spd:5.0,aggro:18,color:0x225511,hc:0x33aa22,
   drops:[{id:'blue_potion',rate:.35,qty:1},{id:'leather_armor',rate:.1,qty:1}]},
  {id:'jungle_ape',name:'숲 유인원',hp:500,atk:50,exp:110,spd:3.5,aggro:22,color:0x5a3a1a,hc:0x8a6a3a,
   drops:[{id:'iron_sword',rate:.08,qty:1},{id:'star_fragment',rate:.08,qty:1},{id:'red_potion',rate:.25,qty:1}]},
  {id:'jungle_panther',name:'정글 표범',hp:420,atk:48,exp:95,spd:6.5,aggro:24,color:0x1a1a1a,hc:0x333333,
   drops:[{id:'leather_armor',rate:.15,qty:1},{id:'red_potion',rate:.3,qty:1}]},
  {id:'jungle_mosquito',name:'거대 모기',hp:180,atk:22,exp:50,spd:5.8,aggro:25,color:0x554400,hc:0x887700,
   drops:[{id:'red_potion',rate:.4,qty:1},{id:'blue_potion',rate:.2,qty:1}]},
  {id:'jungle_treant',name:'나무 정령',hp:700,atk:42,exp:130,spd:1.8,aggro:15,color:0x2a4a10,hc:0x4a7a20,
   drops:[{id:'star_fragment',rate:.12,qty:1},{id:'elixir',rate:.03,qty:1},{id:'magic_crystal',rate:.3,qty:1}]},
  // ── 화산 지대 (z 200~280) ──
  {id:'golem',  name:'용암 골렘', hp:800,atk:55, exp:160,spd:2.0, aggro:18, color:0x883311,hc:0xff4400,
   drops:[{id:'star_fragment',rate:.15,qty:1},{id:'iron_sword',rate:.1,qty:1},{id:'elixir',rate:.02,qty:1}]},
  {id:'firedrake',name:'파이어드레이크',hp:1200,atk:75,exp:280,spd:4.0,aggro:28,color:0xcc2200,hc:0xff6600,
   drops:[{id:'dragon_scale',rate:.12,qty:1},{id:'star_fragment',rate:.3,qty:1},{id:'eternal_chain',rate:.01,qty:1}]},
];

/* ════════════ 오픈 월드 설정 ════════════ */
var WORLD_BOUNDS=[-200,200,-32,860]; // minX, maxX, minZ, maxZ
var WORLD_SPAWN=[5,-3]; // 분수 옆

var ZONE_INFO={
  village:  {name:'시작 마을',   color:'#c9a84c',tp:[0,0]},
  meadow:   {name:'초원',        color:'#4aaa3a',tp:[0,50]},
  swamp:    {name:'독 늪',       color:'#44aa44',tp:[100,100]},
  darkforest:{name:'어두운 숲',  color:'#aa4422',tp:[0,430]},
  jungle:   {name:'정글',        color:'#11aa44',tp:[120,430]},
  volcano:  {name:'화산 지대',   color:'#ff4400',tp:[0,700]},
};

/* 방문한 존 기록 */
var visitedZones={village:true};
