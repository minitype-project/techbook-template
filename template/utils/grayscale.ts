import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { type BlockTransformer, isImage } from "@minitype/minitype";

// 画像のグレースケール変換
// - ラスタ画像（PNG，JPEG 等）：ImageMagick（magick）
// - PDF：Ghostscript（gs）
// - SVG：塗り・線の色指定（16 進数，rgb()）を書き換える（色名による指定は変換しない）．
//   埋め込みのラスタ画像（data URI）は ImageMagick で変換する
// 変換結果は CACHE_DIR にキャッシュし，元ファイルが更新されない限り再利用する．

const CACHE_DIR = path.resolve("node_modules/.cache/grayscale-images");

const RASTER_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".webp"];

/**
 * 変換済みパスのメモ（同一ビルド内での重複変換を防ぐ）．
 */
const converted = new Map<string, string>();

/**
 * RGB（0–255）の輝度を求める．colors.ts と同じく ITU-R BT.709 の係数を用いる．
 */
const luminance = (r: number, g: number, b: number) => {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/**
 * CSS の色指定（#rgb，#rrggbb，#rrggbbaa，rgb()，rgba()）をグレーに変換する．
 * 解釈できない場合は元の文字列を返す．
 */
const toGrayColor = (value: string): string => {
  const hex = value.match(/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (hex) {
    let digits = hex[1];
    if (digits.length <= 4) {
      digits = [...digits].map((digit) => digit + digit).join("");
    }
    const [r, g, b] = [0, 2, 4].map((i) =>
      Number.parseInt(digits.slice(i, i + 2), 16),
    );
    const gray = Math.round(luminance(r, g, b))
      .toString(16)
      .padStart(2, "0");
    return `#${gray}${gray}${gray}${digits.slice(6)}`;
  }
  const func = value.match(/^rgba?\(([^)]*)\)$/i);
  if (func) {
    const parts = func[1].split(/[\s,/]+/).filter(Boolean);
    const [r, g, b] = parts
      .slice(0, 3)
      .map((part) =>
        part.endsWith("%")
          ? (Number.parseFloat(part) * 255) / 100
          : Number(part),
      );
    if ([r, g, b].some(Number.isNaN)) {
      return value;
    }
    const gray = Math.round(luminance(r, g, b));
    return parts.length > 3
      ? `rgba(${gray}, ${gray}, ${gray}, ${parts[3]})`
      : `rgb(${gray}, ${gray}, ${gray})`;
  }
  return value;
};

/**
 * data URI のラスタ画像をグレースケールに変換する．
 */
const toGrayDataUri = (subtype: string, base64: string): string => {
  const format = subtype === "jpg" ? "jpeg" : subtype;
  const gray = execFileSync(
    "magick",
    [`${format}:-`, "-colorspace", "Gray", `${format}:-`],
    {
      input: Buffer.from(base64.replace(/\s+/g, ""), "base64"),
      maxBuffer: Infinity,
    },
  );
  return `data:image/${subtype};base64,${gray.toString("base64")}`;
};

/**
 * SVG 中の色指定と埋め込み画像をグレーに変換する．
 */
const convertSvg = (src: string, dest: string) => {
  const svg = readFileSync(src, "utf-8")
    .replace(
      /((?:fill|stroke|stop-color|flood-color|lighting-color|color)\s*[:=]\s*["']?\s*)(#[0-9a-f]{3,8}\b|rgba?\([^)]*\))/gi,
      (_, prefix: string, value: string) => prefix + toGrayColor(value),
    )
    .replace(
      /data:image\/(png|jpe?g|gif|webp);base64,([A-Za-z0-9+/=\s]+)/gi,
      (_, subtype: string, base64: string) =>
        toGrayDataUri(subtype.toLowerCase(), base64),
    );
  writeFileSync(dest, svg);
};

const convertFile = (src: string, dest: string, ext: string) => {
  if (RASTER_EXTENSIONS.includes(ext)) {
    execFileSync("magick", [src, "-colorspace", "Gray", dest]);
  } else if (ext === ".pdf") {
    // Windows 版 Ghostscript のコマンド名は gswin64c
    execFileSync(process.platform === "win32" ? "gswin64c" : "gs", [
      "-q",
      "-dSAFER",
      "-dNOPAUSE",
      "-dBATCH",
      "-sDEVICE=pdfwrite",
      "-sColorConversionStrategy=Gray",
      "-dProcessColorModel=/DeviceGray",
      "-o",
      dest,
      src,
    ]);
  } else if (ext === ".svg") {
    convertSvg(src, dest);
  } else {
    throw new Error(`unsupported image format: ${ext}`);
  }
};

/**
 * 画像をグレースケールに変換し，変換後のパスを返す．
 * 変換できない場合は警告を出して元のパスを返す．
 */
export const toGrayscaleImage = (src: string): string => {
  const cached = converted.get(src);
  if (cached) {
    return cached;
  }
  const absSrc = path.resolve(src);
  if (!existsSync(absSrc)) {
    return src;
  }
  const ext = path.extname(absSrc).toLowerCase();
  const { mtimeMs, size } = statSync(absSrc);
  const hash = createHash("sha1")
    .update(`${absSrc}\0${mtimeMs}\0${size}`)
    .digest("hex")
    .slice(0, 16);
  const dest = path.join(CACHE_DIR, `${hash}${ext}`);
  try {
    if (!existsSync(dest)) {
      mkdirSync(CACHE_DIR, { recursive: true });
      convertFile(absSrc, dest, ext);
    }
  } catch (error) {
    console.warn(`Failed to convert ${src} to grayscale:`, error);
    converted.set(src, src);
    return src;
  }
  converted.set(src, dest);
  return dest;
};

/**
 * 画像ブロックの src をグレースケール版に差し替える．
 */
export const grayscaleImageTransformer: BlockTransformer = ({ location }) => {
  const block = location.current;
  if (isImage(block)) {
    block.src = toGrayscaleImage(block.src);
  }
};
