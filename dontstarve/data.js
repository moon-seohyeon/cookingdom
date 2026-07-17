// 재료 현황에 쓰이는 카테고리 & 아이템 시드 데이터
export const MATERIAL_CATEGORIES = [
  {
    id: "cook_ingredient",
    label: "🍖 요리 재료",
    items: [
      { id: "meat", name: "고기" },
      { id: "egg", name: "알" },
      { id: "veggie", name: "야채" },
      { id: "ice", name: "얼음" },
      { id: "mushroom", name: "버섯" },
    ],
  },
  {
    id: "dish",
    label: "🍲 요리",
    items: [
      { id: "health_food", name: "체력음식" },
      { id: "hunger_food", name: "허기음식" },
    ],
  },
  {
    id: "ore",
    label: "⛏️ 기본 자원 (광석)",
    items: [
      { id: "stone", name: "돌" },
      { id: "gold", name: "금" },
      { id: "flint", name: "부싯돌" },
      { id: "nitre", name: "초석" },
      { id: "moonrock", name: "월석" },
    ],
  },
  {
    id: "wood",
    label: "🪵 기본 자원 (나무)",
    items: [
      { id: "log", name: "나무" },
      { id: "twigs", name: "잔가지" },
      { id: "cutgrass", name: "풀줄기" },
      { id: "reeds", name: "갈대줄기" },
      { id: "charcoal", name: "숯" },
    ],
  },
  {
    id: "monster",
    label: "🕷️ 몬스터 자원",
    items: [
      { id: "silk", name: "거미줄" },
      { id: "pigskin", name: "돼지가죽" },
      { id: "firefly", name: "반딧불이" },
    ],
  },
  {
    id: "craft",
    label: "🔨 제작 자원",
    items: [
      { id: "cutstone", name: "석재" },
      { id: "board", name: "나무판자" },
      { id: "gears", name: "기계장치" },
    ],
  },
  {
    id: "tool",
    label: "🧰 메인 도구",
    items: [
      { id: "thermalstone", name: "보온석" },
      { id: "umbrella", name: "눈우산" },
      { id: "walkingcane", name: "워킹케인" },
      { id: "beefalohat", name: "비팔로모자" },
    ],
  },
];

// 팀원 시드 데이터. moonbomi(문보미)는 항상 목록 맨 앞에 고정, 나머지는 이름 가나다순으로 표시됩니다.
export const MEMBERS_SEED = [
  { id: "moonbomi", name: "문보미", character: "웬디", pinned: true },
  { id: "kimyunseo", name: "김윤서", character: "위노나" },
  { id: "yuharin", name: "유하린", character: "윌슨" },
  { id: "leesoyoung", name: "이소영", character: "윌로우" },
  { id: "kimheesu", name: "김희수", character: "WX-78" },
  { id: "leeseohyun", name: "이서현", character: "우디" },
  { id: "leemingyu", name: "이민규", character: "맥스웰" },
  { id: "johgyeongo", name: "조경오", character: "위그프리드" },
  { id: "ryuhyunwoo", name: "류현우", character: "위노나" },
];

// 누적 기여도 점수에 따른 레벨 티어
export const LEVELS = [
  { min: 0, title: "새싹 생존자", emoji: "🌱" },
  { min: 20, title: "모닥불 지기", emoji: "🔥" },
  { min: 50, title: "숙련된 채집가", emoji: "🧺" },
  { min: 100, title: "거미굴 정찰대", emoji: "🕸️" },
  { min: 160, title: "노련한 사냥꾼", emoji: "🏹" },
  { min: 230, title: "황야의 전략가", emoji: "🗺️" },
  { min: 310, title: "제작의 달인", emoji: "⚙️" },
  { min: 400, title: "광기 제어자", emoji: "🌘" },
  { min: 500, title: "굶지마 마스터", emoji: "🍗" },
  { min: 620, title: "워프시계의 지배자", emoji: "🕰️" },
];
