import type { AccessibilityElement, AccessibilitySnapshot } from "@swipt/api/accessibility";
import type { RecognizedTextLine } from "@swipt/api/image";
import type { DeviceInfo } from "@swipt/api/device";
import type { DeviceDetails, ElementInfo, ElementSnapshot, Observation, TextLine } from "./model";

export function mapDeviceInfo(source: DeviceInfo): DeviceDetails {
  return {
    name: source.name, model: source.model, os: source.os,
    build: source.build, language: source.language,
    screen: {
      width: source.screen.width, height: source.screen.height,
      scale: source.screen.scale, orientation: source.screen.orientation,
    },
  };
}

export function mapElement(source: AccessibilityElement, id: string): ElementInfo {
  const element: ElementInfo = {
    id,
    role: source.role,
    traits: [...source.traits],
    ...(source.actions === undefined ? {} : { actions: [...source.actions] }),
    children: source.children.map((child, index) => mapElement(child, id + "." + index)),
  };
  for (const field of [
    "class", "label", "value", "identifier", "placeholder", "hint", "url",
    "frame", "point", "partial", "offScreen", "inert", "remote", "disabled",
    "focused", "selected", "expanded", "secure", "selection", "truncated",
  ] as const) {
    const value = source[field];
    if (value !== undefined) Object.assign(element, { [field]: value });
  }
  return element;
}

export function mapSnapshot(source: AccessibilitySnapshot): ElementSnapshot {
  return {
    app: source.app,
    time: source.time,
    ...(source.truncated === undefined ? {} : { truncated: source.truncated }),
    root: mapElement(source.root, "root"),
    ...(source.system === undefined ? {} : { system: mapElement(source.system, "system") }),
  };
}

export function mapTextLine(source: RecognizedTextLine): TextLine {
  return {
    text: source.text,
    confidence: source.confidence,
    frame: [...source.frame],
    center: [...source.center],
    quad: [[...source.quad[0]], [...source.quad[1]], [...source.quad[2]], [...source.quad[3]]],
    candidates: source.candidates.map(({ text, confidence }) => ({ text, confidence })),
  };
}

export async function observe<T>(read: () => Promise<T>, signal: AbortSignal): Promise<Observation<T>> {
  const startedAt = Date.now();
  try {
    const data = await read();
    return { status: "ok", startedAt, finishedAt: Date.now(), data };
  } catch (error) {
    if (signal.aborted) throw error;
    return {
      status: "error", startedAt, finishedAt: Date.now(),
      error: error instanceof Error
        ? { name: error.name, message: error.message }
        : { name: "Error", message: String(error) },
    };
  }
}
