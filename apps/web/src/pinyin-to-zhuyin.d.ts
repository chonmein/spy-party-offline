declare module "pinyin-to-zhuyin" {
  export function p2z(
    pinyin: string,
    options?: { tonemarks?: boolean; convertPunctuation?: boolean },
  ): string;
}
