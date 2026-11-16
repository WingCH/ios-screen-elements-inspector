import { Button, Form, Host, Section, Text } from "@expo/ui/swift-ui";
import { useEffect, useState } from "react";
import { actions } from "@swipt/api/swiplet";

import type extension from "./extension";

const { capture, latest } = actions<typeof extension>();

export default function App() {
  const [elements, setElements] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    latest().then(setElements, (error: Error) => setStatus(error.message));
  }, []);

  const takeSnapshot = async () => {
    setStatus("5 秒後讀取畫面，現在切換到目標 App。");
    try {
      setElements(await capture());
      setStatus("擷取完成；返回 Swipt 查看結果。");
    } catch (error) {
      setStatus(`擷取失敗：${String(error)}`);
    }
  };

  return (
    <Host style={{ flex: 1 }}>
      <Form>
        <Section>
          <Text>按「擷取」後，在 5 秒內切換到要檢查的 App。</Text>
          <Button label="擷取畫面元素" onPress={takeSnapshot} />
          <Button
            label="讀取上次擷取"
            onPress={() =>
              latest().then(setElements, (error: Error) => setStatus(error.message))
            }
          />
          {status === "" ? null : <Text>{status}</Text>}
        </Section>
        <Section>
          <Text>{elements || "未有擷取結果"}</Text>
        </Section>
      </Form>
    </Host>
  );
}
