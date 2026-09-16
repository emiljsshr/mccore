import { WsEventEnvelopeSchema, WS_EVENT_SCHEMAS, type WsEventEnvelope, type WsEventType } from "@mccore/contracts";

type Listener = (event: WsEventEnvelope) => void;
const listeners = new Map<string, Set<Listener>>();
const reconnectListeners = new Set<() => void>();
let socket: WebSocket | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let attempts = 0;
let enabled = false;

function connect() {
  if (!enabled || socket || typeof window === "undefined") return;
  const ws = new WebSocket(`${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ws/live`);
  socket = ws;
  ws.onopen = () => {
    attempts = 0;
    for (const channel of listeners.keys()) ws.send(JSON.stringify({ op: "subscribe", channel }));
    for (const listener of reconnectListeners) listener();
  };
  ws.onmessage = ({ data }) => {
    try {
      const event = WsEventEnvelopeSchema.parse(JSON.parse(data));
      const schema = WS_EVENT_SCHEMAS[event.type as WsEventType];
      if (!schema || !schema.safeParse(event.payload).success) return;
      const targets = event.type.startsWith("node.") ? [`node:${event.resourceId}`] : [`server:${event.resourceId}`];
      for (const channel of ["global", ...targets]) for (const listener of listeners.get(channel) ?? []) listener(event);
    } catch { /* Ignore invalid frames; never apply unvalidated state. */ }
  };
  ws.onclose = () => {
    if (socket === ws) socket = null;
    if (enabled) timer = setTimeout(connect, Math.min(30000, 1000 * 2 ** attempts++) * (0.75 + Math.random() * 0.5));
  };
  ws.onerror = () => ws.close();
}

export function startLive() { enabled = true; connect(); }
export function stopLive() { enabled = false; clearTimeout(timer); const ws = socket; socket = null; ws?.close(); }
export function onLiveReconnect(listener: () => void) { reconnectListeners.add(listener); return () => { reconnectListeners.delete(listener); }; }
export function subscribeLive(channel: string, listener: Listener) {
  const group = listeners.get(channel) ?? new Set<Listener>();
  const first = group.size === 0;
  group.add(listener); listeners.set(channel, group);
  if (first && socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ op: "subscribe", channel }));
  return () => {
    group.delete(listener);
    if (!group.size) {
      listeners.delete(channel);
      if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ op: "unsubscribe", channel }));
    }
  };
}
