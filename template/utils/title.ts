/**
 * 表示用の改行指定を取り除く．和文同士は連結し，それ以外は空白で区切る．
 */
export const flattenTitle = (title: string): string => {
  const cjk =
    /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Bopomofo}\u3000-\u303f\uff00-\uffef]/u;

  return title.split("\\n").reduce((previous, next) => {
    const last = previous.match(/.$/u)?.[0];
    const first = next.match(/^./u)?.[0];
    const separator =
      !last ||
      !first ||
      /\s/u.test(last) ||
      /\s/u.test(first) ||
      (cjk.test(last) && cjk.test(first))
        ? ""
        : " ";
    return previous + separator + next;
  });
};
