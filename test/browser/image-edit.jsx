import React from "react";
import { createRoot } from "react-dom/client";
import { OutputPreviewLightbox } from "../../src/components/MediaViews.jsx";
import { nodeApi } from "../../src/api/newtApi.js";
import "../../src/styles.css";
import "../../src/nodeEditor.css";

const load = (url) => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = reject;
  image.src = url;
});

const source = await load("/storyboard/MOOD_BOARD.png");

function fixture(portrait) {
  const canvas = document.createElement("canvas");
  canvas.width = portrait ? 768 : 1536;
  canvas.height = portrait ? 1280 : 864;
  const context = canvas.getContext("2d");
  context.fillStyle = "#586c72";
  context.fillRect(0, 0, canvas.width, canvas.height);
  const ratio = Math.min(canvas.width / source.width, canvas.height / source.height);
  context.drawImage(source, (canvas.width - source.width * ratio) / 2, (canvas.height - source.height * ratio) / 2, source.width * ratio, source.height * ratio);
  context.fillStyle = "#e4cf37";
  context.fillRect(0, canvas.height - 28, canvas.width, 28);
  return canvas.toDataURL("image/png");
}

function Harness() {
  const [item, setItem] = React.useState(null);
  const [report, setReport] = React.useState("No request");
  const [enabled, setEnabled] = React.useState(true);

  nodeApi.editImage = async (form) => {
    const image = await load(form.get("sourceUrl"));
    setReport(JSON.stringify({
      mode: form.get("mode"),
      provider: form.get("provider"),
      prompt: form.get("prompt"),
      quality: form.get("quality")
    }, null, 2));
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d");
    context.filter = "hue-rotate(30deg)";
    context.drawImage(image, 0, 0);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    return { item: { url: URL.createObjectURL(blob), type: "image", fileName: "qa-edit.png", label: "Mock edit", width: image.width, height: image.height } };
  };

  return (
    <main style={{ padding: 20 }}>
      <h1>Image editor QA</h1>
      <button onClick={() => setItem({ url: fixture(true), type: "image", label: "Portrait fixture", editContext: { type: "nodeResult", nodeId: "qa", itemIndex: 0 } })}>Open portrait</button>
      <button onClick={() => setItem({ url: fixture(false), type: "image", label: "Landscape fixture", editContext: { type: "nodeResult", nodeId: "qa", itemIndex: 0 } })}>Open landscape</button>
      <label><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />Fal enabled</label>
      <pre aria-label="QA report">{report}</pre>
      {item && (
        <OutputPreviewLightbox
          item={item}
          workflowContext={{ projectId: "qa" }}
          imageEditProvider={enabled ? "fal" : ""}
          onClose={() => setItem(null)}
          onApplyImageEdit={async () => {}}
          onAcceptAiEdit={async (_source, result, action) => {
            setReport((value) => `${value}\nAccepted: ${action} ${result.width}x${result.height}`);
            setItem(null);
          }}
        />
      )}
    </main>
  );
}

createRoot(document.getElementById("root")).render(<Harness />);
