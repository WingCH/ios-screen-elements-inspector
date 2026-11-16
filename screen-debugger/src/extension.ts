import * as accessibility from "@swipt/api/accessibility";
import type { AccessibilityElement } from "@swipt/api/accessibility";
import { dataDirectory } from "@swipt/api/file-system";
import { defineAction, defineExtension } from "@swipt/api/swiplet";

const report = () => dataDirectory.file("latest-elements.txt");

function describe(element: AccessibilityElement, depth: number): string[] {
  const {
    role,
    class: className,
    traits,
    label,
    value,
    identifier,
    placeholder,
    hint,
    url,
    frame,
    point,
    partial,
    offScreen,
    inert,
    remote,
    disabled,
    focused,
    selected,
    expanded,
    secure,
    selection,
    actions,
    truncated,
    children,
  } = element;
  const fields = {
    role,
    class: className,
    traits,
    label,
    value,
    identifier,
    placeholder,
    hint,
    url,
    frame,
    point,
    partial,
    offScreen,
    inert,
    remote,
    disabled,
    focused,
    selected,
    expanded,
    secure,
    selection,
    actions,
    truncated,
  };
  return [
    `${"  ".repeat(depth)}${JSON.stringify(fields)}`,
    ...children.flatMap((child) => describe(child, depth + 1)),
  ];
}

export default defineExtension({
  actions: {
    capture: defineAction({
      title: "擷取畫面元素",
      description: "讀取目前畫面的完整可存取元素樹，不執行點按或其他操作。",
      async run(_, { caller, signal }) {
        if (caller === "app") {
          await sleep(5_000, { signal });
        }
        const captured = await accessibility.snapshot({
          scope: "fullScreen",
          full: true,
          signal,
        });
        const lines = [
          `app: ${captured.app}`,
          `snapshotTime: ${captured.time}`,
          `snapshotTruncated: ${captured.truncated === true}`,
          "root:",
          ...describe(captured.root, 0),
        ];
        if (captured.system !== undefined) {
          lines.push("system:", ...describe(captured.system, 0));
        }
        const text = lines.join("\n");
        await report().write(text);
        return text;
      },
    }),
    latest: defineAction({
      title: "讀取上次擷取",
      async run() {
        const file = report();
        return (await file.stat()) === null ? "" : file.text();
      },
    }),
  },
});
