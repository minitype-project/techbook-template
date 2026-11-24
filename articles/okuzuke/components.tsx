import { em, fill, fr, hbox, Q } from "@minitype/minitype";
import { Box, Br, Flexbox, type JsxElement, P, Rect, Url } from "@minitype/tsx";
import { colors } from "../../template/styles/colors.js";
import { boldFont, prefaceBodyFont } from "../../template/styles/fonts.js";

export const Divider = (): JsxElement => (
  <Rect
    width={Q(13) * 3}
    height={0.2}
    style={{
      background: [fill(colors.gray40)],
    }}
  />
);

export const ColophonBookTitle = ({
  children,
}: {
  children?: JsxElement;
}): JsxElement => (
  <P
    style={{
      size: Q(24),
      font: boldFont,
      firstIndent: 0,
      lineHeight: em(1.4),
      kerning: true,
    }}
  >
    {children}
  </P>
);

export const ColophonRow = ({
  label,
  lines,
  alignNames = false,
}: {
  label: string;
  lines: (string | { text: string; href: string })[];
  alignNames?: boolean;
}): JsxElement => (
  <Flexbox style={{ gap: 4 }}>
    <Box style={{ inlineSize: 16, splitable: false }}>
      <P style={{ size: Q(13), font: boldFont, firstIndent: 0 }}>{label}</P>
    </Box>
    <Box style={{ inlineSize: fr(1) }}>
      <P style={{ size: Q(13), font: prefaceBodyFont, firstIndent: 0 }}>
        {lines.flatMap((line, i) => {
          const text = typeof line === "string" ? line : line.text;
          const bracket = alignNames ? text.indexOf("（") : -1;
          const content =
            typeof line !== "string"
              ? [<Url href={line.href}>{text}</Url>]
              : bracket >= 0
                ? [hbox(em(7), [text.slice(0, bracket)]), text.slice(bracket)]
                : [text];
          return i < lines.length - 1 ? [...content, <Br />] : content;
        })}
      </P>
    </Box>
  </Flexbox>
);
