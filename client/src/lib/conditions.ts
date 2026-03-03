// Shared condition system for BOXIUM PTCG marketplace
// Groups: PSA, BGS, TAG, Raw

export type ConditionValue =
  | "psa10" | "psa9" | "psa8_below"
  | "bgs10" | "bgs9" | "bgs8_below"
  | "tag10" | "tag9_below"
  | "raw_a" | "raw_b" | "raw_c" | "raw_d";

export interface ConditionItem {
  value: ConditionValue;
  label: string;
  tooltip: string;
}

export interface ConditionGroup {
  group: string;
  groupDesc: string;
  items: ConditionItem[];
}

export const CONDITION_GROUPS: ConditionGroup[] = [
  {
    group: "PSA",
    groupDesc: "Professional Sports Authenticator — 全球最知名評級機構",
    items: [
      { value: "psa10", label: "PSA 10", tooltip: "完美品相，Gem Mint。卡面無任何瑕疵，四角完整，表面光亮。" },
      { value: "psa9", label: "PSA 9", tooltip: "近完美品相，Mint。極輕微瑕疵，肉眼難以察覺。" },
      { value: "psa8_below", label: "PSA 8 以下", tooltip: "PSA 8 或以下評級，卡面有輕微至明顯磨損或瑕疵。" },
    ],
  },
  {
    group: "BGS",
    groupDesc: "Beckett Grading Services — 以細分評分著稱的評級機構",
    items: [
      { value: "bgs10", label: "BGS 10", tooltip: "Pristine 10，四項子評分均達 10，極為罕見的完美品相。" },
      { value: "bgs9", label: "BGS 9", tooltip: "Mint 9，四項子評分接近完美，整體品相優秀。" },
      { value: "bgs8_below", label: "BGS 8 以下", tooltip: "BGS 8 或以下評級，卡面有輕微至明顯磨損或瑕疵。" },
    ],
  },
  {
    group: "TAG",
    groupDesc: "TAG Grading — 新興評級機構，以快速回件見稱",
    items: [
      { value: "tag10", label: "TAG 10", tooltip: "TAG 最高評級，完美品相，卡面無任何瑕疵。" },
      { value: "tag9_below", label: "TAG 9 以下", tooltip: "TAG 9 或以下評級，品相良好至優秀。" },
    ],
  },
  {
    group: "Raw 卡",
    groupDesc: "未送評的原始卡牌，由賣家自行評估品相",
    items: [
      { value: "raw_a", label: "A品", tooltip: "接近全新，四角完整，無明顯磨損，表面光亮，可考慮送評。" },
      { value: "raw_b", label: "B品", tooltip: "品相良好，有極輕微磨損或白邊，整體狀態不錯。" },
      { value: "raw_c", label: "C品", tooltip: "品相一般，有明顯磨損、刮痕或白邊，適合普通收藏。" },
      { value: "raw_d", label: "D品", tooltip: "品相較差，有明顯損傷、折痕或污漬，僅供遊玩用途。" },
    ],
  },
];

export const CONDITION_SHORT: Record<ConditionValue, string> = {
  psa10: "PSA 10",
  psa9: "PSA 9",
  psa8_below: "PSA 8↓",
  bgs10: "BGS 10",
  bgs9: "BGS 9",
  bgs8_below: "BGS 8↓",
  tag10: "TAG 10",
  tag9_below: "TAG 9↓",
  raw_a: "A品",
  raw_b: "B品",
  raw_c: "C品",
  raw_d: "D品",
};

export const CONDITION_FULL: Record<ConditionValue, string> = {
  psa10: "PSA 10",
  psa9: "PSA 9",
  psa8_below: "PSA 8 以下",
  bgs10: "BGS 10",
  bgs9: "BGS 9",
  bgs8_below: "BGS 8 以下",
  tag10: "TAG 10",
  tag9_below: "TAG 9 以下",
  raw_a: "A品 (Raw)",
  raw_b: "B品 (Raw)",
  raw_c: "C品 (Raw)",
  raw_d: "D品 (Raw)",
};

export const CONDITION_TOOLTIP: Record<ConditionValue, string> = {
  psa10: "完美品相，Gem Mint。卡面無任何瑕疵，四角完整，表面光亮。",
  psa9: "近完美品相，Mint。極輕微瑕疵，肉眼難以察覺。",
  psa8_below: "PSA 8 或以下評級，卡面有輕微至明顯磨損或瑕疵。",
  bgs10: "Pristine 10，四項子評分均達 10，極為罕見的完美品相。",
  bgs9: "Mint 9，四項子評分接近完美，整體品相優秀。",
  bgs8_below: "BGS 8 或以下評級，卡面有輕微至明顯磨損或瑕疵。",
  tag10: "TAG 最高評級，完美品相，卡面無任何瑕疵。",
  tag9_below: "TAG 9 或以下評級，品相良好至優秀。",
  raw_a: "接近全新，四角完整，無明顯磨損，表面光亮，可考慮送評。",
  raw_b: "品相良好，有極輕微磨損或白邊，整體狀態不錯。",
  raw_c: "品相一般，有明顯磨損、刮痕或白邊，適合普通收藏。",
  raw_d: "品相較差，有明顯損傷、折痕或污漬，僅供遊玩用途。",
};

export const CONDITION_BADGE: Record<ConditionValue, string> = {
  psa10: "bg-yellow-100 text-yellow-800 border border-yellow-300",
  psa9: "bg-yellow-50 text-yellow-700 border border-yellow-200",
  psa8_below: "bg-amber-50 text-amber-700 border border-amber-200",
  bgs10: "bg-blue-100 text-blue-800 border border-blue-300",
  bgs9: "bg-blue-50 text-blue-700 border border-blue-200",
  bgs8_below: "bg-sky-50 text-sky-700 border border-sky-200",
  tag10: "bg-purple-100 text-purple-800 border border-purple-300",
  tag9_below: "bg-purple-50 text-purple-700 border border-purple-200",
  raw_a: "bg-emerald-100 text-emerald-700 border border-emerald-300",
  raw_b: "bg-green-50 text-green-700 border border-green-200",
  raw_c: "bg-orange-50 text-orange-700 border border-orange-200",
  raw_d: "bg-red-50 text-red-700 border border-red-200",
};

// Group colour for the group header badge
export const CONDITION_GROUP_COLOR: Record<string, string> = {
  PSA: "bg-yellow-100 text-yellow-800 border border-yellow-300",
  BGS: "bg-blue-100 text-blue-800 border border-blue-300",
  TAG: "bg-purple-100 text-purple-800 border border-purple-300",
  "Raw 卡": "bg-emerald-100 text-emerald-700 border border-emerald-300",
};

export const ALL_CONDITION_VALUES: ConditionValue[] = CONDITION_GROUPS.flatMap(g => g.items.map(i => i.value));
