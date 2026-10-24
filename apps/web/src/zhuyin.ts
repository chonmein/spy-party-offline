import { p2z } from "pinyin-to-zhuyin";
import { pinyin } from "pinyin-pro";

const zhuyinCache = new Map<string, string>();

/** 將遊戲詞語轉成繁體中文注音，結果在瀏覽器記憶體中快取。 */
export function toZhuyin(text: string): string {
  const cached = zhuyinCache.get(text);
  if (cached) return cached;

  const numberedPinyin = pinyin(text, {
    nonZh: "consecutive",
    toneType: "num",
    traditional: true,
  });
  const result = p2z(numberedPinyin, { tonemarks: true });
  zhuyinCache.set(text, result);
  return result;
}
