import { type CompositeFont, em } from "@minitype/minitype";
import { USES_OSS_FONTS } from "../config.js";
import { nonLatinMin2Chars } from "../utils/charsets.js";

/**
 * プロプライエタリフォントの定義．
 */
const proFonts = {
  serif: "AP-SK-HonranMinchoStdN-R",
  gonaDB: "A-SK-GonaMin2-DB",
  gonaM: "A-SK-GonaMin2-M",
  shingoM: "AP-OTF-ShinGoPr6N-Medium",
  shingoR: "AP-OTF-ShinGoPr6N-Regular",
  ishiiGothicR: "AP-SK-IshiiGothicStdN-R",
  harugaku: "AP-OTF-HaruGakuStdN-Light",
  helvetica: "HelveticaNeue:HelveticaNeue",
  helveticaMedium: "HelveticaNeue:HelveticaNeue-Medium",
  helveticaLight: "HelveticaNeue:HelveticaNeue-Light",
  helveticaThin: "HelveticaNeue:HelveticaNeue-Thin",
  helveticaUltraLight: "HelveticaNeue:HelveticaNeue-UltraLight",
} as const;

/**
 * オープンソースフォントの定義．
 */
const ossFonts = {
  serif: "SourceHanSerifJP-Regular",
  code: "SourceCodePro-Regular",
  sansMedium: "SourceHanSansJP-Medium",
  sansRegular: "SourceHanSansJP-Regular",
  interDisplay: "InterDisplay-Regular",
  interDisplayExtraLight: "InterDisplay-ExtraLight",
  interDisplayThin: "InterDisplay-Thin",
} as const;

/**
 * U+1D400–U+1D7FF（数学英数字記号）フォント．
 */
const NOTO_SANS_MATH = "NotoSansMath-Regular";

/**
 * U+1D400–U+1D7FF（数学英数字記号）を列挙した文字列．
 */
const mathAlphanumericChars = Array.from({ length: 0x400 }, (_, i) =>
  String.fromCodePoint(0x1d400 + i),
).join("");

/**
 * 本文に使用する合成フォント．
 */
export const serifFont: CompositeFont = (() => {
  const defaultFont = USES_OSS_FONTS ? ossFonts.serif : proFonts.serif;
  const crimson = {
    font: "CrimsonText-Regular",
    scale: em(1.08),
    blockOffset: em(0.02),
  };
  return {
    default: { font: defaultFont },
    latin: crimson,
    chars: {
      "‘’“”": crimson,
      [mathAlphanumericChars]: { font: NOTO_SANS_MATH },
    },
  };
})();

/**
 * 太字の合成フォント．
 */
export const boldFont: CompositeFont = (() => {
  if (USES_OSS_FONTS) {
    return {
      default: { font: ossFonts.sansMedium },
      chars: {
        [mathAlphanumericChars]: { font: NOTO_SANS_MATH },
      },
    };
  }

  return {
    default: { font: proFonts.shingoM },
    latin: {
      font: proFonts.helveticaMedium,
      scale: em(1.06),
    },
    chars: {
      "（）「」": { font: proFonts.gonaM },
      [nonLatinMin2Chars]: { font: proFonts.gonaDB },
      [mathAlphanumericChars]: { font: NOTO_SANS_MATH },
    },
  };
})();

/**
 * H5 見出しに使用する合成フォント．
 */
export const gothicFont: CompositeFont = (() => {
  if (USES_OSS_FONTS) {
    return {
      default: { font: ossFonts.sansRegular },
      chars: {
        [mathAlphanumericChars]: { font: NOTO_SANS_MATH },
      },
    };
  }

  return {
    default: { font: proFonts.shingoR },
    latin: { font: proFonts.helvetica, scale: em(1.06) },
    chars: {
      [mathAlphanumericChars]: { font: NOTO_SANS_MATH },
    },
  };
})();

/**
 * コードブロックに使用する合成フォント．
 */
export const codeFont: CompositeFont = (() => {
  if (USES_OSS_FONTS) {
    return {
      latin: { font: ossFonts.code },
      default: { font: ossFonts.sansRegular },
      chars: {
        [mathAlphanumericChars]: { font: NOTO_SANS_MATH },
      },
    };
  }

  return {
    default: {
      font: proFonts.shingoR,
      scale: em(0.94),
      blockOffset: em(-0.06),
    },
    latin: { font: ossFonts.code },
    chars: {
      [mathAlphanumericChars]: { font: NOTO_SANS_MATH },
      " ├└─│": { font: ossFonts.code },
    },
  };
})();

/**
 * かわいいフォント．
 */
export const cuteFont = USES_OSS_FONTS
  ? ossFonts.sansMedium
  : proFonts.harugaku;

/**
 * 章番号に使用するフォント．
 */
export const articleNumberFont = USES_OSS_FONTS
  ? ossFonts.interDisplayExtraLight
  : proFonts.helveticaThin;

/**
 * 章番号に使用するフォント．
 */
export const articleNumberUltraLightFont = USES_OSS_FONTS
  ? ossFonts.interDisplayThin
  : proFonts.helveticaUltraLight;

/**
 * 扉の PART 表記に使用するフォント．
 */
export const tobiraPartFont = USES_OSS_FONTS
  ? ossFonts.interDisplay
  : proFonts.helvetica;

/**
 * まえがき・あとがき本文用の合成フォント．
 */
export const prefaceBodyFont: CompositeFont = (() => {
  if (USES_OSS_FONTS) {
    return {
      default: { font: ossFonts.sansRegular },
      chars: {
        [mathAlphanumericChars]: { font: NOTO_SANS_MATH },
      },
    };
  }

  return {
    default: { font: proFonts.ishiiGothicR },
    chars: {
      [mathAlphanumericChars]: { font: NOTO_SANS_MATH },
    },
  };
})();
