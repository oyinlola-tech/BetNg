import type { RealtimeTransport } from "./realtime.type.js";

interface SocketLike {
  send(data: string): void;
  close(): void;
  readyState: number;
  onopen: (() => void) | null;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
}

export type WebSocketConstructor = new (url: string) => SocketLike;

interface EventSourceLike {
  close(): void;
  onopen: (() => void) | null;
  onerror: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
}

export type EventSourceConstructor = new (url: string) => EventSourceLike;

export function webSocketTransport(
  Socket: WebSocketConstructor | undefined = (
    globalThis as { WebSocket?: WebSocketConstructor }
  ).WebSocket,
): RealtimeTransport {
  return (url, handlers) => {
    if (Socket === undefined) throw new Error("No WebSocket implementation is available.");

    const socket = new Socket(url);

    socket.onopen = handlers.onOpen;
    socket.onclose = handlers.onClose;
    socket.onerror = () => undefined;
    socket.onmessage = (event) => {
      handlers.onMessage(event.data);
    };

    return {
      duplex: true,
      send: (frame) => {
        if (socket.readyState === 1) socket.send(JSON.stringify(frame));
      },
      close: () => {
        socket.onclose = null;
        socket.close();
      },
    };
  };
}

/** Server-sent events: one-way, so the channel list travels in the URL. */
export function sseTransport(
  Source: EventSourceConstructor | undefined = (
    globalThis as { EventSource?: EventSourceConstructor }
  ).EventSource,
): RealtimeTransport {
  return (url, handlers, channels) => {
    if (Source === undefined) throw new Error("No EventSource implementation is available.");

    const target = new URL(url);

    if (channels.length > 0) target.searchParams.set("channels", channels.join(","));

    const source = new Source(target.toString());

    source.onopen = handlers.onOpen;
    source.onmessage = (event) => {
      handlers.onMessage(event.data);
    };
    source.onerror = () => {
      source.close();
      handlers.onClose();
    };

    return {
      duplex: false,
      send: () => undefined,
      close: () => {
        source.onerror = null;
        source.close();
      },
    };
  };
}
