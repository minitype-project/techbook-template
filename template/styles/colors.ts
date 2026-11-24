import { cmyk, gray } from "@minitype/minitype";
import { USES_COLOR } from "../config.js";

/**
 * K の濃度から色を作成する．
 * USES_COLOR が false のときはグレースケール色空間で出力する．
 */
const kToColor = (value: number) =>
  USES_COLOR ? cmyk(0, 0, 0, value) : gray(100 - value);

/**
 * USES_COLOR が false のとき CMYK をグレースケール（K 5 刻み）に変換する．
 */
export const color = (c: number, m: number, y: number, k: number) => {
  if (USES_COLOR) {
    return cmyk(c, m, y, k);
  }
  const r = (1 - c / 100) * (1 - k / 100);
  const g = (1 - m / 100) * (1 - k / 100);
  const b = (1 - y / 100) * (1 - k / 100);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const kGray = Math.round(((1 - lum) * 100) / 5) * 5;
  return kToColor(kGray);
};

/**
 * 色定義．
 */
export const colors = {
  white: kToColor(0),
  gray5: kToColor(5),
  gray15: kToColor(15),
  gray40: kToColor(40),
  gray65: kToColor(65),
  gray80: kToColor(80),
  black: kToColor(100),
  // Notation
  note: color(90, 20, 0, 25),
  warning: color(10, 75, 55, 10),
  important: color(0, 40, 100, 20),
  tips: color(80, 0, 80, 10),
};
