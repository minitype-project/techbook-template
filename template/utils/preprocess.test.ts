import assert from "node:assert/strict";
import { describe, test } from "vitest";
import {
  extractPosition,
  preprocessApostrophes,
  preprocessAutoUrls,
  preprocessCaption,
  preprocessParentheses,
  preprocessQuotes,
} from "./preprocess.js";

describe("各種 preprocess", () => {
  const preprocesses = [
    preprocessApostrophes,
    preprocessAutoUrls,
    preprocessCaption,
    preprocessParentheses,
    preprocessQuotes,
  ];

  test("コードブロックの外側には適用され，内側には適用されない", () => {
    const body = 'call("日本語"); // it\'s https://example.com\n*表*\n| a |\n';
    for (const transform of preprocesses) {
      // body が変換されなければ以降の検証が空振りするため，前提として確認する．
      assert.notEqual(transform(body), body, transform.name);
      const source = `${body}\n\`\`\`md\n${body}\`\`\`\n${body}`;
      const expected = `${transform(body)}\n\`\`\`md\n${body}\`\`\`\n${transform(body)}`;
      assert.equal(transform(source), expected);
    }
  });

  test("入れ子のコードフェンスを含むコードブロックには適用されない", () => {
    const body = 'call("日本語"); // it\'s https://example.com\n*表*\n| a |\n';
    for (const transform of preprocesses) {
      const block = `\`\`\`\`md\n\`\`\`ts\n\`\`\`\n${body}\`\`\`\`\n`;
      assert.equal(transform(block + body), block + transform(body));
    }
  });

  test("YAML フロントマターには適用されない", () => {
    const body = 'call("日本語"); // it\'s https://example.com\n*表*\n| a |\n';
    const frontmatter = `---\ntitle: ${body}---\n`;
    for (const transform of preprocesses) {
      assert.equal(
        transform(`${frontmatter}${body}`),
        `${frontmatter}${transform(body)}`,
      );
    }
  });

  test("ESM ブロックには適用されない", () => {
    const body = 'call("日本語"); // it\'s https://example.com\n*表*\n| a |\n';
    // 空行までを 1 つの ESM ブロックとみなす．
    const esm = `import { Foo } from "./foo(1).js";\nexport const text = \`\n${body}\`;\n`;
    for (const transform of preprocesses) {
      assert.equal(
        transform(`${esm}\n${body}`),
        `${esm}${transform(`\n${body}`)}`,
      );
    }
  });

  test("複数行の JSX 属性を保持し，後続の本文は変換する", () => {
    const tag = `<ColophonRow
  label="連絡先"
  lines={[
    {
      text: "連絡先(日本語)",
      href: "https://example.com"
    }
  ]}
/>`;
    const source = `${tag}\n本文(補足)と"引用"`;
    const actual = [
      preprocessAutoUrls,
      preprocessParentheses,
      preprocessQuotes,
    ].reduce((text, transform) => transform(text), source);
    assert.equal(actual, `${tag}\n本文（補足）と“引用”`);
  });

  test("脚注定義には適用されるが，参照リンク定義には適用されない", () => {
    const body = 'call("日本語"); // it\'s https://example.com';
    for (const transform of preprocesses) {
      if (transform === preprocessCaption) {
        continue;
      }
      assert.equal(transform(`[^1]: ${body}`), `[^1]: ${transform(body)}`);
      assert.equal(transform(`[ref]: ${body}`), `[ref]: ${body}`);
    }
  });
});

describe("preprocessApostrophes", () => {
  test("本文のアポストロフィのみを変換し，リンク・属性値・コードは保持する", () => {
    const protectedParts = [
      "[https://example.com/it's](https://example.com/it's)",
      "<https://example.com/it's>",
      "https://example.com/it's",
      '<Image src="it\'s.png" />',
      "`it's`",
      "[ref]: https://example.com/it's",
    ];
    for (const part of protectedParts) {
      assert.equal(preprocessApostrophes(part), part);
    }
    assert.equal(preprocessApostrophes("it's fine"), "it’s fine");
  });

  test("URL 変換後の URL にアポストロフィを適用しても URL は変化しない", () => {
    const source =
      "詳細は [https://example.com/it's](https://example.com/it's) を参照";
    assert.equal(preprocessApostrophes(source), source);
  });

  test("英単語内のアポストロフィのみを変換する", () => {
    assert.equal(
      preprocessApostrophes("don't, it's, 90's"),
      "don’t, it’s, 90’s",
    );
    assert.equal(preprocessApostrophes("snake_case's"), "snake_case’s");
    // リンクテキストやタグに挟まれた本文は変換する．
    assert.equal(
      preprocessApostrophes("[it's](https://example.com/it's)"),
      "[it’s](https://example.com/it's)",
    );
    assert.equal(
      preprocessApostrophes("<b>it's</b> と https://example.com/it's の it's"),
      "<b>it’s</b> と https://example.com/it's の it’s",
    );
    // 単語の前後にあるもの（引用符としての使用）は変換しない．
    for (const source of ["'quoted'", "students' books", "日本'語"]) {
      assert.equal(preprocessApostrophes(source), source);
    }
  });
});

describe("extractPosition", () => {
  test("@t / @b を取り除いて位置を返す", () => {
    assert.deepEqual(extractPosition("表#tab:foo@t"), {
      rest: "表#tab:foo",
      position: "top",
    });
    assert.deepEqual(extractPosition("表@b#tab:foo"), {
      rest: "表#tab:foo",
      position: "bottom",
    });
    assert.deepEqual(extractPosition("表#tab:foo"), { rest: "表#tab:foo" });
  });
});

describe("preprocessCaption", () => {
  test("キャプション付きの表を FigureTable に変換する", () => {
    assert.equal(
      preprocessCaption("*表タイトル*\n| a | b |\n| - | - |\n| 1 | 2 |\n"),
      "<FigureTable caption={`表タイトル`}>\n\n| a | b |\n| - | - |\n| 1 | 2 |\n\n</FigureTable>\n",
    );
  });

  test("キャプションのラベルと配置指定を属性に変換する", () => {
    assert.equal(
      preprocessCaption("*表タイトル#tab:foo@t*\n| a |\n"),
      '<FigureTable caption={`表タイトル`} label={`tab:foo`} float={"top"}>\n\n| a |\n\n</FigureTable>\n',
    );
    assert.equal(
      preprocessCaption("*表タイトル@b*\n| a |\n"),
      '<FigureTable caption={`表タイトル`} float={"bottom"}>\n\n| a |\n\n</FigureTable>\n',
    );
    // 空のラベルは label 属性を付与しない．
    assert.equal(
      preprocessCaption("*表タイトル#*\n| a |\n"),
      "<FigureTable caption={`表タイトル`}>\n\n| a |\n\n</FigureTable>\n",
    );
  });

  test("キャプション内のバッククォート・ドル記号・バックスラッシュをエスケープする", () => {
    assert.equal(
      // biome-ignore lint/suspicious/noTemplateCurlyInString: `${}` のエスケープを検証する
      preprocessCaption("*`a` と ${b} と \\c*\n| a |\n"),
      // biome-ignore lint/suspicious/noTemplateCurlyInString: 同上
      "<FigureTable caption={`\\`a\\` と \\${b} と \\\\c`}>\n\n| a |\n\n</FigureTable>\n",
    );
  });

  test("表が続かない強調はキャプションとして扱わない", () => {
    for (const source of [
      "*強調*\n本文\n",
      "*強調*\n\n| a |\n",
      "本文 *強調*\n| a |\n",
    ]) {
      assert.equal(preprocessCaption(source), source);
    }
  });
});

describe("preprocessAutoUrls", () => {
  test("生の URL を Markdown リンクに変換する", () => {
    assert.equal(
      preprocessAutoUrls("詳細は https://example.com/path?q=1#frag を参照"),
      "詳細は [https://example.com/path?q=1#frag](https://example.com/path?q=1#frag) を参照",
    );
    assert.equal(
      preprocessAutoUrls("http://example.com"),
      "[http://example.com](http://example.com)",
    );
  });

  test("URL の直後の閉じ括弧・句読点・CJK 文字は URL に含めない", () => {
    const link = "[https://example.com](https://example.com)";
    for (const suffix of [
      "）",
      ")",
      "。",
      "、",
      "．",
      "，",
      "」",
      "』",
      "を参照",
      "サイト",
      "漢字",
    ]) {
      assert.equal(
        preprocessAutoUrls(`https://example.com${suffix}`),
        `${link}${suffix}`,
      );
    }
    assert.equal(preprocessAutoUrls("（https://example.com）"), `（${link}）`);
  });

  test("既存のリンク・属性値・インラインコード内の URL は変換しない", () => {
    for (const source of [
      "[https://example.com](https://example.com)",
      "[サイト](https://example.com)",
      "<https://example.com>",
      '<a href="https://example.com">',
      "<a href='https://example.com'>",
      "<Foo url=https://example.com />",
      "`https://example.com`",
      "``a ` https://example.com``",
    ]) {
      assert.equal(preprocessAutoUrls(source), source);
    }
    assert.equal(
      preprocessAutoUrls("`https://a.example` と https://b.example"),
      "`https://a.example` と [https://b.example](https://b.example)",
    );
  });

  test("参照リンク定義の URL は変換しない", () => {
    const source = "[ref]: https://example.com";
    assert.equal(preprocessAutoUrls(source), source);
  });
});

describe("preprocessQuotes", () => {
  test("対になったストレートクォートをスマートクォートに変換する", () => {
    assert.equal(preprocessQuotes('"a" と "b"'), "“a” と “b”");
    assert.equal(preprocessQuotes('"引用"'), "“引用”");
    // 対にならないクォートは残す．
    assert.equal(preprocessQuotes('5" のディスプレイ'), '5" のディスプレイ');
    assert.equal(preprocessQuotes('"a" と "b'), '“a” と "b');
    // 行をまたぐクォートは対にしない．
    assert.equal(preprocessQuotes('"a\nb"'), '"a\nb"');
  });

  test("タグ・リンク・インラインコード・属性値のクォートは変換しない", () => {
    for (const source of [
      '<Foo bar="baz" />',
      '[a](https://example.com/"x")',
      '`"code"`',
      'x="y"',
    ]) {
      assert.equal(preprocessQuotes(source), source);
    }
    assert.equal(
      preprocessQuotes('<Foo bar="baz" />と"引用"'),
      '<Foo bar="baz" />と“引用”',
    );
  });
});

describe("preprocessParentheses", () => {
  test("半角丸括弧を全角丸括弧に変換し，前後の半角スペースを 1 つ取り除く", () => {
    assert.equal(preprocessParentheses("foo (bar) baz"), "foo（bar）baz");
    assert.equal(
      preprocessParentheses("ICAO(国際民間航空機関)"),
      "ICAO（国際民間航空機関）",
    );
    assert.equal(preprocessParentheses("a  (b)  c"), "a （b） c");
    assert.equal(preprocessParentheses("(先頭)"), "（先頭）");
    assert.equal(preprocessParentheses("()"), "（）");
  });

  test("関数呼び出しのような括弧は変換しない", () => {
    for (const source of ["foo(bar)", "foo()", "f_1(x, y)"]) {
      assert.equal(preprocessParentheses(source), source);
    }
    // 括弧内に CJK 文字や全角文字を含む場合は変換する．
    assert.equal(preprocessParentheses("foo(引数)"), "foo（引数）");
    assert.equal(preprocessParentheses("foo(ａ)"), "foo（ａ）");
  });

  test("入れ子・改行をまたぐ括弧は最内側のみ変換する", () => {
    assert.equal(preprocessParentheses("(外(内)側)"), "(外（内）側)");
    assert.equal(preprocessParentheses("(改\n行)"), "(改\n行)");
  });

  test("括弧の内外にあるタグ・リンク・インラインコードを保持する", () => {
    assert.equal(
      preprocessParentheses('しています(<Autoref id="fig:a(1)" />)'),
      'しています（<Autoref id="fig:a(1)" />）',
    );
    assert.equal(
      preprocessParentheses("参照(`f(x)` を参照)"),
      "参照（`f(x)` を参照）",
    );
    for (const source of [
      "[リンク](https://example.com/a_(b))",
      "[リンク](https://example.com)",
      "<https://example.com/(a)>",
      "`(code)`",
    ]) {
      assert.equal(preprocessParentheses(source), source);
    }
  });
});
