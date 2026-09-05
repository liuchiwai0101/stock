"use client";

import { useSyncExternalStore } from "react";
import { CHINESE_NAMES } from "@/lib/chinese-names";
import { getMergedChineseNames, subscribeChineseNames } from "@/lib/chinese-names-store";

export function useChineseNameCache() {
  return useSyncExternalStore(subscribeChineseNames, getMergedChineseNames, () => CHINESE_NAMES);
}
