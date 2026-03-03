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
}

export interface ConditionGroup {
  group: string;
  items: ConditionItem[];
}

export const CONDITION_GROUPS: ConditionGroup[] = [
  {
    group: "PSA",
    items: [
      { value: "psa10", label: "PSA 10" },
      { value: "psa9", label: "PSA 9" },
      { value: "psa8_below", label: "PSA 8 以下" },
    ],
  },
  {
    group: "BGS",
    items: [
      { value: "bgs10", label: "BGS 10" },
      { value: "bgs9", label: "BGS 9" },
      { value: "bgs8_below", label: "BGS 8 以下" },
    ],
  },
  {
    group: "TAG",
    items: [
      { value: "tag10", label: "TAG 10" },
      { value: "tag9_below", label: "TAG 9 以下" },
    ],
  },
  {
    group: "Raw 卡",
    items: [
      { value: "raw_a", label: "A品" },
      { value: "raw_b", label: "B品" },
      { value: "raw_c", label: "C品" },
      { value: "raw_d", label: "D品" },
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

export const ALL_CONDITION_VALUES: ConditionValue[] = CONDITION_GROUPS.flatMap(g => g.items.map(i => i.value));
