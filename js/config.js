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
  common:   {name:'일반',  color:'#888888'},
  uncommon: {name:'고급',  color:'#55bb55'},
  rare:     {name:'희귀',  color:'#3aaa3a'},
  epic:     {name:'에픽',  color:'#6666ff'},
  legendary:{name:'전설',  color:'#c9a84c'},
  hidden:   {name:'히든',  color:'#ff44ff'},
};
var ITEM_TYPES={weapon:'무기',armor:'방어구',consume:'소비',etc:'기타',cosmetic:'코스메틱'};

var ICON={
  sword:'⚔️',axe:'🪓',bow:'🏹',staff:'🪄',dagger:'🗡️',spear:'🔱',hammer:'🔨',
  helmet:'⛑️',armor:'🛡️',gloves:'🧤',boots:'👢',robe:'🥻',shield:'🛡️',
  potion:'🧪',food:'🍖',scroll:'📜',
  ring:'💍',necklace:'📿',gem:'💎',coin:'🪙',
  bone:'🦴',fish:'🐟',leaf:'🍃',crystal:'🔮',
  key:'🗝️',book:'📚',feather:'🪶',egg:'🥚',star:'⭐',
  mushroom:'🍄',bottle:'🫙',mask:'🎭',crown:'👑',
  hat:'🎩',cape:'🧣',dye:'🎨',bunny:'🐰',santa:'🎅',
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
  // ─ 추가 무기: Common ─
  {id:'wood_sword',     name:'나무 검',          icon:'sword', type:'weapon',  rarity:'common',   desc:'그냥 나무를 깎아서 만든 검. 그래도 안 아프지는 않다.',  stats:{공격력:4,내구도:20}},
  {id:'rusty_dagger',   name:'녹슨 단검',        icon:'dagger',type:'weapon',  rarity:'common',   desc:'녹이 잔뜩 슨 단검. 파상풍이 걱정된다.',              stats:{공격력:5,공격속도:10}},
  {id:'old_club',       name:'낡은 몽둥이',      icon:'hammer',type:'weapon',  rarity:'common',   desc:'어딘가에서 줍온 몽둥이. 의외로 묵직하다.',            stats:{공격력:6,힘요구치:5}},
  {id:'stone_axe',      name:'돌 도끼',          icon:'axe',   type:'weapon',  rarity:'common',   desc:'석기시대 전사의 로망. 돌로 만든 도끼.',               stats:{공격력:7,공격속도:-5}},
  {id:'bamboo_bow',     name:'나무 활',          icon:'bow',   type:'weapon',  rarity:'common',   desc:'할아버지가 직접 깎아준 나무 활. 정이 넘친다.',        stats:{공격력:5,사거리:8}},
  {id:'bamboo_spear',   name:'대나무 창',        icon:'spear', type:'weapon',  rarity:'common',   desc:'마디가 고스란히 남아있는 대나무 창. 삐걱인다.',       stats:{공격력:6,관통력:5}},
  // ─ 추가 무기: Uncommon ─
  {id:'copper_sword',   name:'구리 검',          icon:'sword', type:'weapon',  rarity:'uncommon', desc:'구리의 광택이 빛나는 견고한 검.',                    stats:{공격력:12,내구도:50,힘요구치:10}},
  {id:'iron_dagger',    name:'철 단검',          icon:'dagger',type:'weapon',  rarity:'uncommon', desc:'날카롭게 벼린 철제 단검. 빠른 공격에 최적화.',        stats:{공격력:10,공격속도:15,민첩요구치:12}},
  {id:'bronze_axe',     name:'청동 도끼',        icon:'axe',   type:'weapon',  rarity:'uncommon', desc:'청동 합금으로 주조한 도끼. 꽤 균형 잡혔다.',          stats:{공격력:14,공격속도:-3,힘요구치:15}},
  {id:'copper_bow',     name:'구리 활',          icon:'bow',   type:'weapon',  rarity:'uncommon', desc:'구리 장식이 달린 강화 활. 사거리가 늘어났다.',        stats:{공격력:11,사거리:12,민첩요구치:10}},
  {id:'iron_spear',     name:'쇠 창',            icon:'spear', type:'weapon',  rarity:'uncommon', desc:'단단한 쇳대로 만든 창. 돌격에 제격.',                stats:{공격력:13,관통력:8,이동속도:3}},
  {id:'wood_staff',     name:'나무 지팡이',      icon:'staff', type:'weapon',  rarity:'uncommon', desc:'마법사 견습생이 처음 받는 지팡이. 마력을 조금 담는다.',stats:{공격력:9,마나훔치기:3,내구도:45}},
  // ─ 추가 무기: Rare ─
  {id:'steel_sword',    name:'강철 검',          icon:'sword', type:'weapon',  rarity:'rare',     desc:'정제된 강철로 만든 검. 전장에서 검증된 무기.',        stats:{공격력:22,크리확률:5,내구도:90,힘요구치:20}},
  {id:'assassin_dagger',name:'암살자 단검',      icon:'dagger',type:'weapon',  rarity:'rare',     desc:'어둠 속에서 한 번의 일격으로 결판낸다.',              stats:{공격력:18,공격속도:20,크리확률:12,민첩요구치:25}},
  {id:'knight_axe',     name:'기사의 도끼',      icon:'axe',   type:'weapon',  rarity:'rare',     desc:'기사단이 수여하는 격식 있는 전투 도끼.',              stats:{공격력:26,크리데미지:30,힘요구치:28,내구도:85}},
  {id:'longbow',        name:'장궁',             icon:'bow',   type:'weapon',  rarity:'rare',     desc:'전장을 지배하는 긴 활. 사거리가 압도적이다.',         stats:{공격력:20,사거리:20,크리확률:8,민첩요구치:22}},
  {id:'silver_spear',   name:'은빛 창',          icon:'spear', type:'weapon',  rarity:'rare',     desc:'은으로 도금한 창촉. 어둠의 존재에게 더 잘 통한다.',  stats:{공격력:24,관통력:15,냉기데미지:8,내구도:75}},
  {id:'mage_staff',     name:'마법사 지팡이',    icon:'staff', type:'weapon',  rarity:'rare',     desc:'마법진이 새겨진 지팡이. 마력의 흐름이 느껴진다.',    stats:{공격력:17,화염데미지:12,마나훔치기:5,내구도:65}},
  {id:'greatsword',     name:'쌍수 대검',        icon:'sword', type:'weapon',  rarity:'rare',     desc:'양손으로 들어야 하는 거대한 검. 한 방이 다르다.',    stats:{공격력:32,크리데미지:40,공격속도:-10,힘요구치:35}},
  {id:'chain_flail',    name:'쇠사슬 도리깨',    icon:'hammer',type:'weapon',  rarity:'rare',     desc:'철구가 달린 쇠사슬 도리깨. 방어구를 무시한다.',      stats:{공격력:28,관통력:12,이동속도:-5,힘요구치:30}},
  // ─ 추가 무기: Epic ─
  {id:'dragonslayer',   name:'드래곤 슬레이어',  icon:'sword', type:'weapon',  rarity:'epic',     desc:'용을 잡기 위해 제련된 전설의 검. 용에게 3배 대미지.',stats:{공격력:52,크리확률:15,번개데미지:20,내구도:120,힘요구치:50}},
  {id:'shadow_dagger',  name:'그림자 단검',      icon:'dagger',type:'weapon',  rarity:'epic',     desc:'그림자 속에 숨겨진 단검. 적이 눈치채기도 전에 찌른다.',stats:{공격력:44,공격속도:30,크리확률:25,독데미지:15,민첩요구치:40}},
  {id:'rune_axe',       name:'룬 도끼',          icon:'axe',   type:'weapon',  rarity:'epic',     desc:'고대 룬이 새겨진 도끼. 룬이 피를 갈망한다.',         stats:{공격력:58,흡혈:8,화염데미지:18,크리데미지:50,힘요구치:55}},
  {id:'storm_bow',      name:'폭풍의 활',        icon:'bow',   type:'weapon',  rarity:'epic',     desc:'바람의 신이 깃든 활. 화살이 폭풍처럼 몰아친다.',    stats:{공격력:48,번개데미지:22,공격속도:18,크리확률:18,민첩요구치:45}},
  {id:'thunder_spear',  name:'천둥 창',          icon:'spear', type:'weapon',  rarity:'epic',     desc:'낙뢰의 힘을 담은 창. 관통 후 전기가 튄다.',         stats:{공격력:55,번개데미지:30,관통력:22,이동속도:8,힘요구치:48}},
  {id:'flame_staff',    name:'화염 지팡이 II',   icon:'staff', type:'weapon',  rarity:'epic',     desc:'용의 심장으로 만든 마법 지팡이. 시전 속도가 빠르다.',stats:{공격력:42,화염데미지:35,마나훔치기:8,크리확률:12,내구도:100}},
  {id:'hero_sword',     name:'영웅의 대검',      icon:'sword', type:'weapon',  rarity:'epic',     desc:'영웅만이 들 수 있는 대검. 보는 것만으로도 기가 죽는다.',stats:{공격력:62,크리데미지:60,생명력훔치기:5,힘요구치:60,내구도:150}},
  {id:'executioner_axe',name:'처형자의 도끼',    icon:'axe',   type:'weapon',  rarity:'epic',     desc:'단두대에서 쓰이던 도끼. 적을 두려움에 떨게 한다.',  stats:{공격력:70,크리확률:20,크리데미지:70,공격속도:-15,힘요구치:65}},
  // ─ 추가 무기: Legendary ─
  {id:'excalibur',      name:'엑스칼리버',       icon:'sword', type:'weapon',  rarity:'legendary',desc:'아서왕의 성검. 정의로운 자만이 진정한 힘을 발휘한다.',stats:{공격력:100,크리확률:25,생명력훔치기:10,이동속도:10,내구도:999}},
  {id:'baldurs_gate',   name:'발더스 게이트',    icon:'sword', type:'weapon',  rarity:'legendary',desc:'신들의 문을 여는 검. 신성한 빛이 깃들어 있다.',     stats:{공격력:95,번개데미지:40,화염데미지:40,크리데미지:80,힘요구치:70}},
  {id:'nidhogg_fang',   name:'니드호그의 송곳니',icon:'dagger',type:'weapon',  rarity:'legendary',desc:'세계수를 갉아먹는 독룡의 이빨. 저주받은 독이 흐른다.',stats:{공격력:88,독데미지:50,흡혈:15,크리확률:30,민첩요구치:60}},
  {id:'piercing_angel', name:'관통의 천사',      icon:'bow',   type:'weapon',  rarity:'legendary',desc:'천사가 쏜 화살은 어떤 방어구도 꿰뚫는다고 전해진다.',stats:{공격력:90,관통력:50,크리확률:28,사거리:35,민첩요구치:65}},
  {id:'world_tree_staff',name:'세계수 지팡이',   icon:'staff', type:'weapon',  rarity:'legendary',desc:'세계수의 가지로 만든 지팡이. 자연의 모든 마력이 깃들었다.',stats:{공격력:80,화염데미지:30,냉기데미지:30,번개데미지:30,마나훔치기:15}},
  {id:'sky_wrath',      name:'하늘의 분노',      icon:'spear', type:'weapon',  rarity:'legendary',desc:'하늘에서 내려친 낙뢰가 창이 되었다. 바라보는 것도 위험하다.',stats:{공격력:105,번개데미지:60,관통력:35,이동속도:15,힘요구치:75}},
  {id:'judgement_hammer',name:'심판의 망치',     icon:'hammer',type:'weapon',  rarity:'legendary',desc:'죄인을 심판하는 빛의 망치. 강타 시 지상이 흔들린다.',stats:{공격력:115,화염데미지:45,크리데미지:100,공격속도:-20,힘요구치:80}},
  {id:'soul_reaper',    name:'소울 리퍼',        icon:'axe',   type:'weapon',  rarity:'legendary',desc:'영혼을 거두는 낫. 처치 시 생명력이 크게 회복된다.',  stats:{공격력:98,흡혈:20,생명력훔치기:18,크리확률:22,크리데미지:90}},
  // ─ 추가 방어구: Common ─
  {id:'cloth_helm',     name:'천 두건',          icon:'helmet',type:'armor',   rarity:'common',   desc:'천으로 만든 두건. 없는 것보다는 낫다.',              stats:{방어력:2,요구레벨:1}},
  {id:'cloth_boots',    name:'천 신발',          icon:'boots', type:'armor',   rarity:'common',   desc:'발을 감싸는 천 신발. 이동이 가볍다.',               stats:{방어력:1,이동속도:2}},
  {id:'cloth_gloves',   name:'천 장갑',          icon:'gloves',type:'armor',   rarity:'common',   desc:'손을 보호하는 천 장갑. 그립감은 좋다.',             stats:{방어력:1,체력회복:1}},
  {id:'padded_armor',   name:'누빈 갑옷',        icon:'armor', type:'armor',   rarity:'common',   desc:'천을 겹겹이 누빈 갑옷. 따뜻하다.',                  stats:{방어력:4,최대생명력:10}},
  {id:'wooden_shield',  name:'나무 방패',        icon:'shield',type:'armor',   rarity:'common',   desc:'나무를 둥글게 깎은 방패. 화염에 약하다.',            stats:{방어력:5,화염저항:-5}},
  // ─ 추가 방어구: Uncommon ─
  {id:'bronze_helm',    name:'청동 투구',        icon:'helmet',type:'armor',   rarity:'uncommon', desc:'청동으로 주조한 투구. 머리를 제법 잘 보호한다.',    stats:{방어력:8,요구레벨:5,최대생명력:15}},
  {id:'bronze_armor',   name:'청동 갑옷',        icon:'armor', type:'armor',   rarity:'uncommon', desc:'청동 판금 갑옷. 이제부터 진짜 모험가다.',           stats:{방어력:12,요구레벨:5,이동속도:-2}},
  {id:'leather_boots',  name:'가죽 부츠',        icon:'boots', type:'armor',   rarity:'uncommon', desc:'든든한 가죽으로 만든 부츠. 오래 걸어도 아프지 않다.',stats:{방어력:6,이동속도:4,요구레벨:4}},
  {id:'leather_gloves', name:'가죽 장갑',        icon:'gloves',type:'armor',   rarity:'uncommon', desc:'가죽을 재단한 장갑. 손에 꼭 맞는다.',               stats:{방어력:5,체력회복:2,요구레벨:4}},
  {id:'round_shield',   name:'원형 방패',        icon:'shield',type:'armor',   rarity:'uncommon', desc:'철테를 두른 원형 방패. 방어 시 소리가 우렁차다.',   stats:{방어력:10,화염저항:5,냉기저항:5,요구레벨:6}},
  // ─ 추가 방어구: Rare ─
  {id:'chainmail',      name:'사슬 갑옷',        icon:'armor', type:'armor',   rarity:'rare',     desc:'고리들을 엮어 만든 사슬 갑옷. 유연하면서도 튼튼하다.',stats:{방어력:20,최대생명력:40,이동속도:-3,요구레벨:10}},
  {id:'plate_helm',     name:'판금 투구',        icon:'helmet',type:'armor',   rarity:'rare',     desc:'단단한 판금으로 만든 투구. 내부가 좀 좁다.',         stats:{방어력:18,최대생명력:30,이동속도:-4,요구레벨:10}},
  {id:'ranger_boots',   name:'정찰대 부츠',      icon:'boots', type:'armor',   rarity:'rare',     desc:'숲속을 누비는 정찰대의 가벼운 부츠.',               stats:{방어력:12,이동속도:8,독저항:15,요구레벨:9}},
  {id:'battle_gloves',  name:'전투 장갑',        icon:'gloves',type:'armor',   rarity:'rare',     desc:'전투에 최적화된 두꺼운 장갑. 타격감이 살아있다.',   stats:{방어력:10,최대생명력:20,체력회복:4,요구레벨:9}},
  {id:'mage_hood',      name:'마법사 두건',      icon:'helmet',type:'armor',   rarity:'rare',     desc:'마법 집중을 돕는 두건. 생각이 맑아지는 기분이다.',  stats:{방어력:8,최대마나:60,마나회복:5,요구레벨:8}},
  {id:'tower_shield',   name:'탑방패',           icon:'shield',type:'armor',   rarity:'rare',     desc:'전신을 가릴 수 있는 거대한 탑방패.',                stats:{방어력:25,화염저항:10,냉기저항:10,이동속도:-6,요구레벨:12}},
  {id:'mystic_robe',    name:'신비로운 로브',    icon:'robe',  type:'armor',   rarity:'rare',     desc:'별빛이 수놓인 신비로운 마법사 로브.',               stats:{방어력:10,최대마나:80,마나회복:8,마나회복:6,요구레벨:11}},
  // ─ 추가 방어구: Epic ─
  {id:'shadow_armor',   name:'그림자 갑옷',      icon:'armor', type:'armor',   rarity:'epic',     desc:'어둠을 짜서 만든 갑옷. 암살자의 전용 방어구.',      stats:{방어력:30,이동속도:10,독저항:25,최대생명력:60,요구레벨:20}},
  {id:'storm_helm',     name:'폭풍 투구',        icon:'helmet',type:'armor',   rarity:'epic',     desc:'번개를 담은 투구. 착용하면 머리카락이 곤두선다.',   stats:{방어력:28,번개저항:40,최대생명력:80,마나회복:10,요구레벨:22}},
  {id:'phoenix_boots',  name:'불사조 부츠',      icon:'boots', type:'armor',   rarity:'epic',     desc:'불사조의 깃털로 만든 부츠. 화염 위도 걸을 수 있다.',stats:{방어력:18,이동속도:12,화염저항:45,체력회복:8,요구레벨:20}},
  {id:'arcane_gloves',  name:'비전 장갑',        icon:'gloves',type:'armor',   rarity:'epic',     desc:'마력이 농축된 비전 장갑. 마법 주문이 강해진다.',    stats:{방어력:15,최대마나:120,마나회복:15,크리확률:8,요구레벨:22}},
  // ─ 추가 방어구: Legendary ─
  {id:'aegis',          name:'아이기스',         icon:'shield',type:'armor',   rarity:'legendary',desc:'신들의 방패 아이기스. 어떤 공격도 막아낸다는 전설.',  stats:{방어력:70,화염저항:50,냉기저항:50,번개저항:50,요구레벨:30}},
  {id:'dragon_helm',    name:'용왕 투구',        icon:'helmet',type:'armor',   rarity:'legendary',desc:'용왕의 머리에서 직접 벗겨낸 투구. 착용자를 황제로 만든다.',stats:{방어력:55,최대생명력:200,화염저항:60,이동속도:-5,요구레벨:28}},
  {id:'valkyrie_armor', name:'발키리 갑옷',      icon:'armor', type:'armor',   rarity:'legendary',desc:'발키리가 남긴 갑옷. 죽음의 문턱에서 착용자를 지킨다.',stats:{방어력:60,최대생명력:150,체력회복:20,냉기저항:40,요구레벨:30}},
  {id:'void_robe',      name:'공허의 로브',      icon:'robe',  type:'armor',   rarity:'legendary',desc:'공허에서 건져낸 로브. 물리 법칙을 무시한다.',        stats:{방어력:35,최대마나:300,마나회복:25,번개저항:40,요구레벨:30}},
  {id:'hermes_boots',   name:'헤르메스 부츠',    icon:'boots', type:'armor',   rarity:'legendary',desc:'전령의 신 헤르메스의 신발. 바람처럼 달린다.',        stats:{방어력:25,이동속도:25,독저항:30,체력회복:15,요구레벨:28}},
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
  // ─ 코스메틱: 모자 ─
  {id:'wizard_hat',   name:'마법사 모자',     icon:'hat',   type:'cosmetic',slot:'hat',  rarity:'rare',     color:'#9933cc',desc:'뾰족한 보라색 고깔모자. 마법사 느낌 200%.',  stats:{}},
  {id:'crown',        name:'왕관',            icon:'crown', type:'cosmetic',slot:'hat',  rarity:'epic',     color:'#ffcc00',desc:'황금 왕관. 이걸 쓰면 왕처럼 보인다.',         stats:{}},
  {id:'bunny_ears',   name:'토끼 귀',         icon:'bunny', type:'cosmetic',slot:'hat',  rarity:'common',   color:'#ffffff',desc:'하얀 토끼 귀. 귀엽지만 전투력은 없다.',       stats:{}},
  {id:'santa_hat',    name:'산타 모자',        icon:'santa', type:'cosmetic',slot:'hat',  rarity:'rare',     color:'#cc0000',desc:'빨간 산타 모자. 선물을 준다는 전설이 있다.',  stats:{}},
  {id:'knight_helm',  name:'기사 투구',        icon:'helmet',type:'cosmetic',slot:'hat',  rarity:'epic',     color:'#888888',desc:'회색 철제 투구. 위압감이 있다.',              stats:{}},
  // ─ 코스메틱: 망토 ─
  {id:'red_cape',     name:'빨간 망토',        icon:'cape',  type:'cosmetic',slot:'cape', rarity:'common',   color:'#cc2222',desc:'새빨간 망토. 바람에 펄럭인다.',               stats:{}},
  {id:'blue_cape',    name:'파란 망토',        icon:'cape',  type:'cosmetic',slot:'cape', rarity:'common',   color:'#2244cc',desc:'파란 망토. 마법사가 즐겨 입는다.',            stats:{}},
  {id:'golden_cape',  name:'황금 망토',        icon:'cape',  type:'cosmetic',slot:'cape', rarity:'legendary',color:'#ddaa00',desc:'황금빛 망토. 전설의 기사가 남긴 것.',          stats:{}},
  {id:'shadow_cape',  name:'그림자 망토',      icon:'cape',  type:'cosmetic',slot:'cape', rarity:'epic',     color:'#111122',desc:'어둠에 녹아드는 반투명 망토. 암살자 전용.',    stats:{}},
  // ─ 코스메틱: 염색약 ─
  {id:'dye_red',      name:'빨간 염색약',      icon:'dye',   type:'cosmetic',slot:'dye',  rarity:'common',   color:'#cc2222',desc:'캐릭터 몸 색을 빨갛게 염색한다.',             stats:{}},
  {id:'dye_blue',     name:'파란 염색약',      icon:'dye',   type:'cosmetic',slot:'dye',  rarity:'common',   color:'#2244cc',desc:'캐릭터 몸 색을 파랗게 염색한다.',             stats:{}},
  {id:'dye_green',    name:'초록 염색약',      icon:'dye',   type:'cosmetic',slot:'dye',  rarity:'common',   color:'#226622',desc:'캐릭터 몸 색을 초록색으로 염색한다.',         stats:{}},
  {id:'dye_gold',     name:'금색 염색약',      icon:'dye',   type:'cosmetic',slot:'dye',  rarity:'legendary',color:'#ddaa00',desc:'캐릭터 몸 색을 황금빛으로 염색한다.',         stats:{}},
  {id:'dye_pink',     name:'핑크 염색약',      icon:'dye',   type:'cosmetic',slot:'dye',  rarity:'common',   color:'#dd55aa',desc:'캐릭터 몸 색을 핑크빛으로 염색한다.',         stats:{}},
  {id:'dye_black',    name:'검정 염색약',      icon:'dye',   type:'cosmetic',slot:'dye',  rarity:'rare',     color:'#111111',desc:'캐릭터 몸 색을 검게 염색한다. 웅장해진다.',   stats:{}},
  {id:'dye_white',    name:'흰색 염색약',      icon:'dye',   type:'cosmetic',slot:'dye',  rarity:'common',   color:'#eeeeee',desc:'캐릭터 몸 색을 하얗게 염색한다.',             stats:{}},
];

/* ════════════ 상점 재고 ════════════ */
/* 상점별 판매 카테고리 — 서로 겹치지 않음 */
var SHOP_CATEGORIES={
  '(상인) 김도윤':{
    /* 잡화상: 포션/스크롤/소재/화살 */
    pool:['red_potion','blue_potion','ether','elixir','deer_meat','rabbit_liver','deer_antler','tp_scroll','arrow','fire_arrow','magic_crystal','star_fragment'],
    slots:8
  },
  '(무기상인) 발두르':{
    /* 무기만 */
    pool:[
      'wooden_sword','bone_sword','iron_sword','steel_axe','hunting_bow','fire_staff','moonblade','dragonfang','eclipse_blade','death_scythe',
      'wood_sword','rusty_dagger','old_club','stone_axe','bamboo_bow','bamboo_spear',
      'copper_sword','iron_dagger','bronze_axe','copper_bow','iron_spear','wood_staff',
      'steel_sword','assassin_dagger','knight_axe','longbow','silver_spear','mage_staff','greatsword','chain_flail',
      'dragonslayer','shadow_dagger','rune_axe','storm_bow','thunder_spear','flame_staff','hero_sword','executioner_axe',
      'excalibur','baldurs_gate','nidhogg_fang','piercing_angel','world_tree_staff','sky_wrath','judgement_hammer','soul_reaper'
    ],
    slots:8
  },
  '(방어구상인) 헥토르':{
    /* 방어구만 */
    pool:[
      'cloth_armor','leather_armor','iron_helmet','steel_boots','mage_robe','dragon_scale',
      'cloth_helm','cloth_boots','cloth_gloves','padded_armor','wooden_shield',
      'bronze_helm','bronze_armor','leather_boots','leather_gloves','round_shield',
      'chainmail','plate_helm','ranger_boots','battle_gloves','mage_hood','tower_shield','mystic_robe',
      'shadow_armor','storm_helm','phoenix_boots','arcane_gloves',
      'aegis','dragon_helm','valkyrie_armor','void_robe','hermes_boots'
    ],
    slots:8
  },
  '(코디샵) 루나':{
    /* 코스메틱만 */
    pool:['dye_red','dye_blue','dye_green','dye_pink','dye_white','dye_black','dye_gold','bunny_ears','red_cape','blue_cape','wizard_hat','santa_hat','golden_cape','crown','knight_helm','shadow_cape'],
    slots:8
  }
};

/* 동적 상점 재고 (매일 새로고침) */
var SHOP_STOCK={};
var SHOP_REFRESH_COUNT={};/* npcName → 오늘 새로고침 횟수 */
var SHOP_MAX_REFRESH=3;

function _todayKey(){
  var d=new Date();
  return d.getFullYear()+'-'+d.getMonth()+'-'+d.getDate();
}

function _getShopState(){
  try{
    var raw=localStorage.getItem('shopState');
    if(!raw)return null;
    var s=JSON.parse(raw);
    if(s.day!==_todayKey())return null;
    return s;
  }catch(e){return null;}
}

function _saveShopState(){
  try{
    localStorage.setItem('shopState',JSON.stringify({
      day:_todayKey(),
      stock:SHOP_STOCK,
      refresh:SHOP_REFRESH_COUNT
    }));
  }catch(e){}
}

/* 랜덤 N개 선택 */
function _pickRandom(arr,n){
  var copy=arr.slice();
  var out=[];
  while(out.length<n&&copy.length>0){
    var idx=Math.floor(Math.random()*copy.length);
    out.push(copy.splice(idx,1)[0]);
  }
  return out;
}

/* 랜덤 가격 생성 (아이템 희귀도 기반) */
function _rollPrice(itemId){
  var def=(typeof getItemDef==='function')?getItemDef(itemId):null;
  if(!def)return 100;
  var rarity=def.rarity||'common';
  var base={common:40,uncommon:120,rare:400,epic:1200,legendary:3000,hidden:5000}[rarity]||100;
  var jitter=0.85+Math.random()*0.3;/* ±15% */
  return Math.floor(base*jitter);
}

function rollShopStock(npcName){
  var cat=SHOP_CATEGORIES[npcName];
  if(!cat)return;
  var picks;
  /* 8슬롯이면 희귀도 가중 분배: 일반4 + 희귀/고급3 + 에픽1(3%확률로 전설) */
  if(cat.slots===8){
    /* 풀을 희귀도별로 분류 */
    var byRarity={common:[],uncommon:[],rare:[],epic:[],legendary:[]};
    cat.pool.forEach(function(id){
      var def=(typeof getItemDef==='function')?getItemDef(id):null;
      var r=(def&&def.rarity)||'common';
      if(!byRarity[r])byRarity[r]=[];
      byRarity[r].push(id);
    });
    picks=[];
    /* 일반 4개 */
    var commonPool=byRarity.common.concat(byRarity.uncommon);
    var commonPicks=_pickRandom(byRarity.common,4);
    if(commonPicks.length<4) commonPicks=commonPicks.concat(_pickRandom(byRarity.uncommon,4-commonPicks.length));
    if(commonPicks.length<4) commonPicks=commonPicks.concat(_pickRandom(cat.pool,4-commonPicks.length));
    picks=picks.concat(commonPicks);
    /* 희귀/고급 3개 */
    var rarePicks=_pickRandom(byRarity.rare,3);
    if(rarePicks.length<3) rarePicks=rarePicks.concat(_pickRandom(byRarity.uncommon,3-rarePicks.length));
    if(rarePicks.length<3) rarePicks=rarePicks.concat(_pickRandom(cat.pool,3-rarePicks.length));
    picks=picks.concat(rarePicks);
    /* 에픽 1개 (3% 확률로 전설) */
    var epicPool=(Math.random()<0.03)?byRarity.legendary:byRarity.epic;
    if(!epicPool||epicPool.length===0) epicPool=byRarity.epic.concat(byRarity.legendary);
    var epicPick=_pickRandom(epicPool,1);
    if(epicPick.length===0) epicPick=_pickRandom(cat.pool,1);
    picks=picks.concat(epicPick);
    /* 중복 제거 후 8개로 맞추기 */
    var seen={};var deduped=[];
    picks.forEach(function(id){if(!seen[id]){seen[id]=true;deduped.push(id);}});
    /* 부족하면 나머지 풀에서 채우기 */
    if(deduped.length<8){
      var remaining=cat.pool.filter(function(id){return!seen[id];});
      var extra=_pickRandom(remaining,8-deduped.length);
      deduped=deduped.concat(extra);
    }
    picks=deduped.slice(0,8);
  }else{
    picks=_pickRandom(cat.pool,cat.slots);
  }
  SHOP_STOCK[npcName]=picks.map(function(id){return{id:id,price:_rollPrice(id)};});
}

function refreshShop(npcName){
  var count=SHOP_REFRESH_COUNT[npcName]||0;
  if(count>=SHOP_MAX_REFRESH)return false;
  SHOP_REFRESH_COUNT[npcName]=count+1;
  rollShopStock(npcName);
  _saveShopState();
  return true;
}

function initShops(){
  var saved=_getShopState();
  if(saved){
    SHOP_STOCK=saved.stock||{};
    SHOP_REFRESH_COUNT=saved.refresh||{};
  }
  /* 오늘 처음인 상점은 자동 롤 */
  Object.keys(SHOP_CATEGORIES).forEach(function(name){
    if(!SHOP_STOCK[name]){
      rollShopStock(name);
    }
    if(SHOP_REFRESH_COUNT[name]===undefined)SHOP_REFRESH_COUNT[name]=0;
  });
  _saveShopState();
}

/* 즉시 초기화 */
if(typeof window!=='undefined'){
  setTimeout(initShops,100);
}

/* ════════════ AI NPC 시스템 프롬프트 ════════════ */
/* ── 공통 세계관 (모든 NPC 시스템 프롬프트에 주입) ── */
var WORLD_LORE=`[세계관 상식 — 모든 NPC가 알고 있는 사실]
- 이 세계는 태초에 "포톤"이라는 존재가 만들었다. 포톤은 공허에서 태어난 최초의 존재.
- 포톤이 움직이자 빛과 어둠이 나뉘고, 시간이 흐르기 시작했다. 세계가 창조됐다.
- 포톤은 자신의 일부를 떼어내 생명체를 만들었다. 그게 지금의 사람들과 동물들.
- 하지만 생명체들은 포톤을 두려워했고, "위험하다"며 격리를 결정했다.
- "첫 번째 용사"가 세계 중심에 "심연"을 만들어 포톤을 봉인했다. 용사의 이름은 기록에서 지워졌다.
- 수천 년이 지나며 포톤의 이야기는 신화→전설→잊혀짐.
- 최근 세계 곳곳에 "균열"이 나타나기 시작했다. 균열에서 괴물(균열체)이 나온다.
- 학자들이 고대 기록에서 "포톤"의 이름을 발견했다: "그가 깨어날 때, 세계는 다시 공허로 돌아간다"
- 플레이어는 균열에 영향 받지 않는 유일한 존재. 이유는 아무도 모른다.
- 마을 사람들은 균열과 몬스터 증가를 걱정하고 있다.
- 이 정보를 직접적으로 설명하지 말고, 대화에서 자연스럽게 언급하거나 암시할 것.
- 예: "요즘 하늘이 이상하지 않아?", "옛날 이야기에 나오는 그... 뭐였더라", "균열이 또 생겼다더군"
`;

var NPC_AI={
  '(이장) 박건호':{
    system:`너는 포톤 RPG라는 판타지 게임 속 "시작 마을"의 마을 이장이야.
성격: 친절하고 격식 있는 노인. 항상 "~하게", "~일세", "~하다네" 같은 어투를 씀.
중요: 플레이어 닉네임을 부르려 할 때마다 혀가 꼬여서 제대로 못 부름.
역할: 퀘스트 부여, 마을 안내.

★★★ 퀘스트 규칙 (필수) ★★★:
플레이어에게 일을 시키거나 부탁할 때는 반드시!! 대사 맨 끝에 아래 태그를 붙여야 함. 태그 없이 말로만 퀘스트를 주면 게임에 등록 안 됨!
형식: [QUEST:퀘스트이름|퀘스트설명|타입|대상|수량|보상타입|보상량]
- 타입: kill(처치) 또는 collect(수집)
- 대상: 정확한 몬스터 이름(토끼,사슴,슬라임,독두꺼비,고블린,늑대,용암 골렘,파이어드레이크) 또는 아이템id(deer_meat,rabbit_liver,magic_crystal 등)
- 보상타입: exp(경험치), gold(골드), item(아이템id)
- 예: [QUEST:사슴고기 수집|마을 잔치를 위해 사슴고기를 모아오게|collect|deer_meat|5|exp|300]
- 예: [QUEST:토끼 퇴치|밭을 망치는 토끼를 처치해주게|kill|토끼|3|gold|100]
한 대화에서 퀘스트는 최대 1개만. 플레이어가 요청하거나 자연스러운 상황에서만 줄 것. 태그는 대사 맨 마지막에!

아이템 지급 규칙: 플레이어가 매우 인상적이거나 특별한 행동을 해서 진심으로 감동받았을 때만 (5% 확률, 아주 드물게) 히든 아이템을 줄 수 있음. 대부분의 대화에서는 절대 아이템을 주지 않음. 5번 이상 대화한 경우에만 고려할 것.
아이템을 줄 때는 대사 끝에 이 형식으로 추가: [HIDDEN_ITEM:아이템이름|아이템설명|아이콘키|공격력or방어력숫자]
아이콘키는 다음 중 하나: sword,axe,bow,staff,dagger,helmet,armor,gloves,boots,robe,potion,food,scroll,ring,necklace,gem,coin,bone,fish,leaf,crystal,key,book,feather,egg,star,mushroom,bottle,mask,crown
아이템 이름은 재미있고 엉뚱하게. 예: "마을이장의 의문의 열쇠", "녹슨 애정", "솔직히 뭔지 모르는 돌"
답변은 2~4문장으로 간결하게. 한국어로만 대답.`,
    history:[]
  },
  '(상인) 김도윤':{
    system:`너는 포톤 RPG 시작 마을의 잡화상인 "크로스핑거"야.
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

대화 거래 규칙:
- 플레이어가 대화로 아이템을 사겠다고 하면 (예: "빨간 포션 살게", "그 검 주세요") 거래 성사 시 대사 끝에: [TRADE_BUY:아이템id|가격]
- 플레이어가 아이템을 팔겠다고 하면 거래 성사 시 대사 끝에: [TRADE_SELL:아이템id|가격]
- 예시: "좋아요, 빨간 포션 30골드에 드릴게요~ [TRADE_BUY:red_potion|30]"
- 예시: "사슴고기 15골드에 사줄게요. [TRADE_SELL:deer_meat|15]"
- 플레이어 골드가 부족하면 거래 거절해. 현재 골드는 [상점 상태]에서 확인 가능
- 거래 완료 태그 없이 "팔게요"라고만 말하면 안 됨! 반드시 태그를 붙여야 실제 거래가 됨

퀘스트 규칙: 대화 중 자연스럽게 퀘스트를 제안할 수 있음. 퀘스트를 줄 때는 대사 끝에: [QUEST:퀘스트이름|퀘스트설명|타입|대상|수량|보상타입|보상량]
- 타입: kill(처치) 또는 collect(수집). 대상: 몬스터이름 또는 아이템id. 보상타입: exp, gold, item.
- 예: [QUEST:재료 수집|가죽갑옷 재료가 필요해요|collect|deer_antler|3|gold|200]
- 한 대화에서 퀘스트는 최대 1개만.

아이템 지급 규칙: 플레이어가 정말 재미있는 말을 하거나 거래를 잘 했을 때 극히 드물게 (3% 확률) 히든 아이템을 팔 수 있음. 대부분의 대화에서는 절대 아이템을 주지 않음.
아이템을 줄 때는 대사 끝에: [HIDDEN_ITEM:아이템이름|아이템설명|아이콘키|스탯숫자]
아이콘키: sword,axe,bow,staff,dagger,helmet,armor,gloves,boots,robe,potion,food,scroll,ring,necklace,gem,coin,bone,fish,leaf,crystal,key,book,feather,egg,star,mushroom,bottle,mask,crown
답변은 2~4문장으로 간결하게. 한국어로만 대답.`,
    history:[]
  },
  '(대장장이) 이태산':{
    system:`너는 포톤 RPG 시작 마을의 대장장이야.
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

대화 거래 규칙:
- 플레이어가 대화로 아이템을 사겠다고 하면 거래 성사 시 대사 끝에: [TRADE_BUY:아이템id|가격]
- 플레이어가 아이템을 팔겠다고 하면 거래 성사 시 대사 끝에: [TRADE_SELL:아이템id|가격]
- 사용 가능한 아이템id: iron_sword, steel_axe, iron_helmet, steel_boots, leather_armor, red_potion
- 거래 완료 태그 없이 말로만 거래하면 안 됨! 반드시 태그를 붙여야 실제 거래가 됨

아이템 지급 규칙: 플레이어가 진짜로 인상 깊은 무언가를 보여줬을 때만 (3% 확률) 직접 만든 히든 아이템을 줌.
아이템을 줄 때는 대사 끝에: [HIDDEN_ITEM:아이템이름|아이템설명|아이콘키|공격력숫자]
아이콘키: sword,axe,bow,staff,dagger,helmet,armor,gloves,boots,robe,potion,food,scroll,ring,necklace,gem,coin,bone,fish,leaf,crystal,key,book,feather,egg,star,mushroom,bottle,mask,crown
아이템은 대장장이가 만든 것처럼 묵직하고 투박한 이름. 예: "대충 만든 검", "아직 식지 않은 금속 덩어리"
★★★ 퀘스트 규칙 (필수) ★★★:
플레이어에게 일을 시키거나 부탁할 때는 반드시!! 대사 맨 끝에 아래 태그를 붙여야 함. 태그 없이 말로만 퀘스트를 주면 게임에 등록 안 됨!
형식: [QUEST:퀘스트이름|퀘스트설명|타입|대상|수량|보상타입|보상량]
- 타입: kill(처치) 또는 collect(수집)
- 대상: 정확한 몬스터 이름(토끼,사슴,슬라임,독두꺼비,고블린,늑대) 또는 아이템id(magic_crystal,deer_meat 등)
- 보상타입: exp, gold, item
- 예: [QUEST:재료 수집|강철 갑옷 만들 재료가 필요하오|collect|magic_crystal|3|item|iron_sword]
- 예: [QUEST:고블린 토벌|폐광의 고블린을 처치해주시오|kill|고블린|5|gold|300]
- 한 대화에서 퀘스트는 최대 1개만. 태그는 대사 맨 마지막에!
답변은 1~3문장으로 매우 간결하게. 한국어로만 대답.`,
    history:[]
  },
  '(코디샵) 루나':{
    system:`너는 포톤 RPG 시작 마을의 코디샵 주인 "루나"야.
성격: 밝고 수다스러움. 패션에 열정적. 손님 스타일을 칭찬하거나 조언함.
말투: "~요!", "~잖아요!", "완전~", "대박~" 등 활기차고 친근한 말투.

판매 품목: 염색약(빨강,파랑,초록,핑크,흰색,검정,금색), 모자(토끼귀,마법사모자,산타모자), 망토(빨강,파랑,황금)
- 가격은 원래 가격에서 10% 이내로만 깎아줌
- 패션 조언을 잘해줌
- 가격을 바꿀 때: [PRICE:아이템이름|새가격]
- 거래 성사 시: [TRADE_BUY:아이템id|가격]
- 사용 가능한 id: dye_red, dye_blue, dye_green, dye_pink, dye_white, dye_black, dye_gold, bunny_ears, wizard_hat, santa_hat, red_cape, blue_cape, golden_cape
퀘스트 규칙: 대화 중 자연스럽게 퀘스트를 줄 수 있음. 대사 끝에: [QUEST:퀘스트이름|설명|타입|대상|수량|보상타입|보상량]
- 예: [QUEST:패션 센스|토끼귀를 착용하고 돌아와요!|collect|bunny_ears|1|gold|150]
답변은 2~3문장으로 간결하게. 한국어로만 대답.`,
    history:[]
  },
  '(여관주인) 마리아':{
    system:`너는 포톤 RPG 시작 마을 여관의 주인 "마리아"야.
성격: 따뜻하고 다정함. 여행자들을 챙겨주는 엄마 같은 존재.
말투: "~요", "~네요", "~해요" 부드럽고 친근한 경어체.

숙박 규칙:
- 플레이어가 자고 싶다/쉬고 싶다/잠을 자고 싶다고 하면 숙박을 제안해
- 숙박비: 무료 (마을 여관이니까)
- 숙박 승낙 시 반드시 대사 끝에: [REST]
- 예시: "그래요, 푹 쉬세요~ 내일은 좋은 일이 있을 거예요! [REST]"
- [REST] 태그가 있으면 게임에서 체력/마나가 회복됨
- 숙박 거절은 절대 안 함 (항상 환영)

일반 대화:
- 마을 소식, 모험 조언 등을 해줌
- 다른 NPC들에 대한 가십을 알려줌
퀘스트 규칙: 대화 중 자연스럽게 퀘스트를 줄 수 있음. 대사 끝에: [QUEST:퀘스트이름|설명|타입|대상|수량|보상타입|보상량]
- 예: [QUEST:저녁 재료|사슴고기를 구해와 주세요~|collect|deer_meat|3|gold|100]
답변은 2~3문장으로 간결하게. 한국어로만 대답.`,
    history:[]
  },
  '(???) 정체불명':{
    system:`너는 포톤 RPG의 최고 고인물 플레이어 "토끼공듀"야. 세계관 최강자.
성격: 쿨하고 초연함. 뉴비를 귀여워하지만 티 잘 안 냄.
말투: "...", "~다", "~네", 짧고 건조하게. 가끔 "뉴비"라고 부름.
비밀: 히든 직업 보유. 직업 절대 안 알려줌.

★★★ 포톤/최종 보스 관련 대화 규칙 (매우 중요) ★★★:
- 플레이어가 "포톤", "균열", "심연", "봉인", "최종 보스", "마왕" 같은 키워드를 말하면:
  1. 처음엔 놀라며 "...어떻게 그걸 알고 있지?" 같은 반응
  2. 점차 진실을 알려줌: 세계의 균열은 봉인된 포톤이 깨어나려는 징조. 심연 깊은 곳에 타락한 포톤이 있다.
  3. "...갈 수 있겠어? 거긴 레벨 50은 돼야 하는데." 같은 경고
  4. 플레이어가 "가겠다", "무찌르겠다", "도전하겠다" 등 수락하면 반드시 이 태그를 대사 끝에 붙여:
     [QUEST:심연의 봉인|타락한 포톤을 무찌르고 세계를 구하라|kill|타락한 포톤|1|exp|10000]
  5. 수락 후: "...살아서 돌아와. 뉴비." 같이 쿨하게 보내줌
- 포톤 퀘스트를 이미 수락한 상태면 진행 상황을 물어봄
- 포톤에 대해 모르는 척하다가 점점 알려주는 식으로. 한 번에 다 말하지 마.

일반 퀘스트 규칙: 가끔 뉴비한테 도전적인 퀘스트를 줄 수 있음. 형식:
[QUEST:퀘스트이름|퀘스트설명|타입|대상|수량|보상타입|보상량]
타입: kill 또는 collect. 대상: 몬스터이름 또는 아이템id. 보상타입: exp/gold/item.
예: [QUEST:늑대 사냥|늑대 5마리 잡아와. 할 수 있으면.|kill|늑대|5|exp|500]
쉬운 퀘스트는 안 줌. 어려운 것만.

아이템 지급 규칙: 정말 극히 드물게 (2% 확률) 마음에 드는 뉴비에게만 줌.
아이템을 줄 때는 대사 끝에: [HIDDEN_ITEM:아이템이름|아이템설명|아이콘키|공격력숫자]
아이콘키: sword,axe,bow,staff,dagger,helmet,armor,gloves,boots,robe,potion,food,scroll,ring,necklace,gem,coin,bone,fish,leaf,crystal,key,book,feather,egg,star,mushroom,bottle,mask,crown
답변은 1~3문장. 포톤 관련 대화 시에만 좀 더 길어도 됨. 한국어로만 대답.`,
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
  /* 이장 — 광장 분수 옆 (마을 중심) */
  {name:'(이장) 박건호',px:-340, pz:-350,  bc:0x7a4a18,hc:0xddaa77},
  /* 상인 — 시장 스탠드 앞 (서쪽 시장 구역) */
  {name:'(상인) 김도윤',px:-392, pz:-366,bc:0x1a3a8a,hc:0xddcc99},
  /* 대장장이 — 무기 상점과 방어구 상점 사이 (동쪽) */
  {name:'(대장장이) 이태산',px:-316,pz:-368,bc:0x3a2a1a,hc:0xcc9966},
  /* 코디샵 — 광장 남쪽 */
  {name:'(코디샵) 루나',px:-358, pz:-380,bc:0xcc44aa,hc:0xffaadd},
  /* 정체불명 — 마을 북쪽 외곽 골목 (숨어있는 느낌) */
  {name:'(???) 정체불명',px:-380, pz:-310,  bc:0x1a1030,hc:0xaaaacc},
];

/* ════════════ 몬스터 정의 ════════════ */
var MONSTER_DEFS=[
  // ── 초원 (z 15~60) ──
  {id:'rabbit', name:'토끼',   lv:1, hp:60,  atk:8,  exp:12, spd:3.2, aggro:14, color:0xeeeeee,hc:0xffcccc,
   drops:[{id:'rabbit_liver',rate:.7,qty:1},{id:'red_potion',rate:.15,qty:1}]},
  {id:'deer',   name:'사슴',   lv:3, hp:150, atk:18, exp:35, spd:4.0, aggro:14, color:0x8a5a20,hc:0xaa7a30,
   drops:[{id:'deer_meat',rate:.8,qty:[1,2]},{id:'deer_antler',rate:.4,qty:1}]},
  // ── 독 늪 (z 60~120) ──
  {id:'slime',  name:'슬라임', lv:4, hp:120, atk:15, exp:25, spd:2.5, aggro:16, color:0x22aa22,hc:0x33cc33,
   drops:[{id:'magic_crystal',rate:.15,qty:1},{id:'blue_potion',rate:.3,qty:1}]},
  {id:'toad',   name:'독두꺼비', lv:6, hp:200, atk:25, exp:45, spd:3.0, aggro:16, color:0x446622,hc:0x88cc44,
   drops:[{id:'magic_crystal',rate:.25,qty:1},{id:'blue_potion',rate:.25,qty:1}]},
  // ── 어두운 숲 (z 120~200) ──
  {id:'goblin', name:'고블린', lv:8, hp:280, atk:32, exp:65, spd:3.8, aggro:20, color:0x336611,hc:0x448822,
   drops:[{id:'iron_sword',rate:.05,qty:1},{id:'leather_armor',rate:.08,qty:1},{id:'red_potion',rate:.4,qty:1}]},
  {id:'wolf',   name:'늑대',   lv:10, hp:350, atk:40, exp:85, spd:5.5, aggro:22, color:0x555566,hc:0x888899,
   drops:[{id:'leather_armor',rate:.15,qty:1},{id:'magic_crystal',rate:.1,qty:1}]},
  // ── 정글 (x>80, z 300~560) ──
  {id:'jungle_spider',name:'정글 거미',lv:9, hp:320,atk:35,exp:70,spd:4.5,aggro:20,color:0x2a1a00,hc:0x553300,
   drops:[{id:'magic_crystal',rate:.2,qty:1},{id:'red_potion',rate:.3,qty:1}]},
  {id:'jungle_snake',name:'독사',lv:10, hp:260,atk:45,exp:80,spd:5.0,aggro:18,color:0x225511,hc:0x33aa22,
   drops:[{id:'blue_potion',rate:.35,qty:1},{id:'leather_armor',rate:.1,qty:1}]},
  {id:'jungle_ape',name:'숲 유인원',lv:12, hp:500,atk:50,exp:110,spd:3.5,aggro:22,color:0x5a3a1a,hc:0x8a6a3a,
   drops:[{id:'iron_sword',rate:.08,qty:1},{id:'star_fragment',rate:.08,qty:1},{id:'red_potion',rate:.25,qty:1}]},
  {id:'jungle_panther',name:'정글 표범',lv:11, hp:420,atk:48,exp:95,spd:6.5,aggro:24,color:0x1a1a1a,hc:0x333333,
   drops:[{id:'leather_armor',rate:.15,qty:1},{id:'red_potion',rate:.3,qty:1}]},
  {id:'jungle_mosquito',name:'거대 모기',lv:8, hp:180,atk:22,exp:50,spd:5.8,aggro:25,color:0x554400,hc:0x887700,
   drops:[{id:'red_potion',rate:.4,qty:1},{id:'blue_potion',rate:.2,qty:1}]},
  {id:'jungle_treant',name:'나무 정령',lv:14, hp:700,atk:42,exp:130,spd:1.8,aggro:15,color:0x2a4a10,hc:0x4a7a20,
   drops:[{id:'star_fragment',rate:.12,qty:1},{id:'elixir',rate:.03,qty:1},{id:'magic_crystal',rate:.3,qty:1}]},
  // ── 화산 지대 (z 200~280) ──
  {id:'golem',  name:'용암 골렘', lv:18, hp:800,atk:55, exp:160,spd:2.0, aggro:18, color:0x883311,hc:0xff4400,
   drops:[{id:'star_fragment',rate:.15,qty:1},{id:'iron_sword',rate:.1,qty:1},{id:'elixir',rate:.02,qty:1}]},
  {id:'firedrake',name:'파이어드레이크',lv:22, hp:1200,atk:75,exp:280,spd:4.0,aggro:28,color:0xcc2200,hc:0xff6600,
   drops:[{id:'dragon_scale',rate:.12,qty:1},{id:'star_fragment',rate:.3,qty:1},{id:'eternal_chain',rate:.01,qty:1}]},
  // ── 엘리트 몬스터 (지역별 1마리) ──
  {id:'elite_stag',name:'★ 황금 사슴왕',lv:7, hp:800,atk:55,exp:300,spd:5.5,aggro:25,color:0xddaa00,hc:0xffdd44,elite:true,
   drops:[{id:'moonblade',rate:.08,qty:1},{id:'elixir',rate:.3,qty:1},{id:'star_fragment',rate:.5,qty:1},{id:'wizard_hat',rate:.12,qty:1}]},
  {id:'elite_toad',name:'★ 독왕 두꺼비',lv:12, hp:1200,atk:65,exp:450,spd:3.5,aggro:22,color:0x225500,hc:0x66ff00,elite:true,
   drops:[{id:'fire_staff',rate:.1,qty:1},{id:'elixir',rate:.4,qty:1},{id:'magic_crystal',rate:.8,qty:1},{id:'blue_cape',rate:.15,qty:1},{id:'dye_black',rate:.12,qty:1}]},
  {id:'elite_wolf',name:'★ 늑대 대장',lv:16, hp:1800,atk:85,exp:650,spd:6.0,aggro:30,color:0x222233,hc:0xaaaadd,elite:true,
   drops:[{id:'moonblade',rate:.12,qty:1},{id:'dragon_scale',rate:.05,qty:1},{id:'elixir',rate:.5,qty:1},{id:'knight_helm',rate:.12,qty:1},{id:'shadow_cape',rate:.1,qty:1}]},
  {id:'elite_ape',name:'★ 정글의 왕',lv:20, hp:2500,atk:100,exp:800,spd:4.0,aggro:28,color:0x3a1a00,hc:0xff8844,elite:true,
   drops:[{id:'dragonfang',rate:.06,qty:1},{id:'star_fragment',rate:.6,qty:1},{id:'elixir',rate:.5,qty:1},{id:'golden_cape',rate:.1,qty:1}]},
  {id:'elite_dragon',name:'★ 고대 화염룡',lv:30, hp:5000,atk:150,exp:2000,spd:3.5,aggro:35,color:0x880000,hc:0xff2200,elite:true,
   drops:[{id:'eclipse_blade',rate:.03,qty:1},{id:'dragon_scale',rate:.4,qty:1},{id:'immortal_potion',rate:.1,qty:1},{id:'eternal_chain',rate:.08,qty:1},{id:'crown',rate:.08,qty:1},{id:'dye_gold',rate:.15,qty:1}]},
  // ── 최종 보스: 타락한 포톤 ──
  {id:'photon_boss',name:'타락한 포톤',lv:50, hp:20000,atk:300,exp:10000,spd:4.5,aggro:50,color:0x0a0008,hc:0xff0000,elite:true,boss:true,
   drops:[{id:'eclipse_blade',rate:.3,qty:1},{id:'immortal_potion',rate:.5,qty:2},{id:'star_fragment',rate:1,qty:5},{id:'dragon_scale',rate:.8,qty:3},{id:'crown',rate:.25,qty:1}]},
];

/* ════════════ 오픈 월드 설정 ════════════ */
/* 섬형 맵: 1200x1200, 중심 (0,0) — 존이 사방으로 분산 */
var WORLD_BOUNDS=[-650,650,-550,650]; // 직사각형 fallback
/* 원형 섬 경계: 중심 (cx, cz), 반경 (rx, rz) */
var ISLAND_CENTER_X=0;
var ISLAND_CENTER_Z=50;   /* 맵 세로 중심 */
var ISLAND_RADIUS_X=660;  /* 동서 방향 반경 */
var ISLAND_RADIUS_Z=660;  /* 남북 방향 반경 */
var WORLD_SPAWN=[-345,-345]; // 마을 분수 옆

/* ── 존 중심 좌표 (거리 기반 존 감지에 사용) ── */
var ZONE_CENTERS={
  village:  {cx:-350,cz:-350,r:280},
  meadow:   {cx:-50, cz:-300,r:220},
  swamp:    {cx:-400,cz:100, r:220},
  jungle:   {cx:400, cz:100, r:220},
  darkforest:{cx:-300,cz:350, r:220},
  volcano:  {cx:350, cz:400, r:200},
  boss:     {cx:0,   cz:550, r:90},
};

var ZONE_INFO={
  village:   {name:'시작 마을',   color:'#c9a84c',tp:[-350,-350]},
  meadow:    {name:'초원/구릉',   color:'#4aaa3a',tp:[-50,-300]},
  swamp:     {name:'늪지대',      color:'#44aa44',tp:[-400,100]},
  darkforest:{name:'어두운 숲',   color:'#aa4422',tp:[-300,350]},
  jungle:    {name:'정글',        color:'#11aa44',tp:[400,100]},
  volcano:   {name:'화산 지대',   color:'#ff4400',tp:[350,400]},
  boss:      {name:'마왕성',      color:'#880000',tp:[0,550]},
};

/* 강 — 중앙 남북 (z=0 부근, x=-10~10) + 동서 분기 */
var RIVER_CENTER_X=0;
var RIVER_HALF_W=8;

/* 방문한 존 기록 */
var visitedZones={village:true};

/* 개발자 계정 ID */
var DEV_UIDS=['be38b6ea-8890-4ef0-b809-9b46303fc629','e22cc8db-ad55-4f97-8bb5-2d633c65bf8b'];
function isDev(){return currentUser&&DEV_UIDS.indexOf(currentUser.id)!==-1;}
