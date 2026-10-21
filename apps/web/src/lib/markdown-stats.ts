// Characters that carry meaning one by one, unlike alphabetic words.
const cjk =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu;

const word = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;

export const countWords = (text: string): number => {
  const ideographs = text.match(cjk)?.length ?? 0;
  const words = text.replace(cjk, " ").match(word)?.length ?? 0;

  return ideographs + words;
};

export const countLines = (text: string): number => {
  if (text === "") {
    return 0;
  }

  return text.split(/\r\n|\r|\n/u).length;
};
