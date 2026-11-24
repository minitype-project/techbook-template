import { Q } from "@minitype/minitype";
import { Flow, type JsxElement, P, Page } from "@minitype/tsx";
import { pageSizeMm } from "../styles/style.js";

/**
 * ページ下端にノンブルを配置する．
 */
export const Nombre = (): JsxElement => {
  return (
    <Flow
      position="page"
      blockOffset={pageSizeMm.height - 14}
      inlineSize={pageSizeMm.width}
    >
      <P style={{ size: Q(10), align: "center", firstIndent: 0 }}>
        <Page />
      </P>
    </Flow>
  );
};
