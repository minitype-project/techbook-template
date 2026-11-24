import {
  all,
  type Color,
  dashed,
  em,
  fill,
  fr,
  left,
  physical,
  Q,
  solid,
} from "@minitype/minitype";
import {
  Box,
  Br,
  Caption,
  Command,
  Flexbox,
  Float,
  filterWhitespace,
  Image,
  InlineGraphic,
  type JsxElement,
  Kern,
  P,
  Section,
  Url,
  Vspace,
} from "@minitype/tsx";
import { colors } from "./styles/colors.js";
import { boldFont, gothicFont } from "./styles/fonts.js";

// ------
// Notation（Note / Warning / Important）
// ------

const Notation =
  (
    label: string,
    borderColor: Color,
    borderStyle: typeof solid | typeof dashed = solid,
  ) =>
  ({ children }: { children?: JsxElement }): JsxElement => (
    <Box
      style={{
        border: left(borderStyle(0.5, borderColor)),
        padding: physical(2, 0, 2, 5),
        splitable: true,
        gapRole: "notation",
      }}
    >
      <P style={{ firstIndent: 0, size: Q(13), font: boldFont }}>
        <Command style={{ effects: [fill(borderColor)] }}>{label}</Command>
      </P>
      {children}
    </Box>
  );

export const Note = Notation("Note", colors.note);
export const Warning = Notation("Warning", colors.warning, dashed);
export const Important = Notation("Important", colors.important);
export const Tips = Notation("Tips", colors.tips);

// ------
// Column（タイトル付きコラム）
// ------

export const Column = ({
  title,
  children,
}: {
  title: string;
  children?: JsxElement;
}): JsxElement => (
  <Box
    style={{
      border: all(solid(0.2, colors.gray65)),
      splitable: true,
      gapRole: "column",
    }}
  >
    <Box
      style={{
        background: [fill(colors.gray65)],
        gapRole: "column-title",
        padding: physical(2, 4),
        splitable: false,
      }}
    >
      <P
        style={{
          size: Q(13),
          lineHeight: em(1.4),
          firstIndent: 0,
          font: gothicFont,
        }}
      >
        <Command style={{ effects: [fill(colors.white)] }}>
          コラム：{title}
        </Command>
      </P>
    </Box>
    <Box
      style={{
        padding: physical(3, 4),
        splitable: true,
        gapRole: "column-body",
      }}
    >
      <Section block={{ paragraph: { size: Q(12.5), lineHeight: em(1.8) } }}>
        {children}
      </Section>
    </Box>
  </Box>
);

// ------
// FigureTable（キャプション付き表）
// ------

export const FigureTable = ({
  children,
  caption,
  label,
  float: floatPosition,
}: {
  children?: JsxElement;
  caption?: string;
  label?: string;
  float?: "top" | "bottom";
}): JsxElement => {
  const filtered = filterWhitespace(children);
  if (!caption) {
    return filtered ?? null;
  }
  const box = Box({
    children: [Caption({ children: caption }), filtered],
    style: { gapRole: "table", splitable: false },
    label,
  });
  return floatPosition
    ? Float({ children: box, position: floatPosition })
    : box;
};

// ------
// AuthorProfile
// ------

export interface AuthorProfileProps {
  name?: string;
  image?: string;
  children?: JsxElement;
}

export const AuthorProfile = ({
  name,
  image,
  children,
}: AuthorProfileProps): JsxElement => {
  const imageSize = 30;
  return (
    <>
      <Vspace space={8} />
      <Box
        style={{
          splitable: false,
        }}
      >
        <Flexbox style={{ gap: 6, alignItems: "start" }}>
          <Box
            style={{
              inlineSize: imageSize,
              blockSize: imageSize,
              splitable: false,
              background: image ? undefined : [fill(colors.gray15)],
            }}
          >
            {image && (
              <Image
                src={image}
                style={{
                  width: imageSize,
                  height: imageSize,
                  align: "center",
                }}
              />
            )}
          </Box>
          <Box style={{ inlineSize: fr(1), splitable: false }}>
            <Vspace space={1.3} />
            <P style={{ size: Q(13), firstIndent: 0, font: gothicFont }}>
              <Command
                style={{
                  background: [fill(colors.gray80)],
                  effects: [fill(colors.white)],
                  padding: physical(1.3, 3),
                  borderRadius: 3,
                }}
              >
                著者紹介
              </Command>
            </P>
            <Vspace space={2} />
            <P style={{ firstIndent: 0, size: Q(16), font: boldFont }}>
              {name}
            </P>
            <Section block={{ paragraph: { firstIndent: 0 } }}>
              {children}
            </Section>
          </Box>
        </Flexbox>
      </Box>
    </>
  );
};

/**
 * レベル 5 の見出し．
 */
export const H5 = ({ children }: { children?: JsxElement }): JsxElement => {
  return (
    <Box style={{ gapRole: "h5" }}>
      <P style={{ font: gothicFont, firstIndent: 0 }}>{children}</P>
    </Box>
  );
};

/**
 * GitHub リンク
 */
export const GitHub = ({
  org,
  repo,
}: {
  org: string;
  repo: string;
}): JsxElement => {
  const url = `https://github.com/${org}/${repo}`;
  return (
    <Box
      style={{
        border: left(solid(0.5, colors.gray80)),
        padding: physical(2, 0, 2, 5),
        splitable: false,
        gapRole: "notation",
      }}
    >
      <P style={{ firstIndent: 0, size: Q(13) }}>
        <InlineGraphic
          src="template/utils/github-mark.svg"
          size={Q(14)}
          blockOffset={em(0)}
        />
        <Kern em={-0.5} />
        {"　"}
        <Command style={{ font: gothicFont }}>
          {org}/{repo}
        </Command>
        <Br />
        <Url href={url}>{url}</Url>
      </P>
    </Box>
  );
};
