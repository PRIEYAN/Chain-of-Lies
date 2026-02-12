import { useEffect, useMemo, useRef, useState } from "react";
import { wsClientMessages, wsServerMessages, z } from "@tamper-hunt/types";
import { io, Socket } from "socket.io-client";

// WebSocket schema adapter for backward compatibility
const ws = {
  send: wsClientMessages,
  receive: wsServerMessages,
} as const;


type Handler = (data: unknown) => void;

function parseWithLogging<T>(schema: z.ZodSchema<T>, data: unknown, label: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.error(`[Zod] ${label} validation failed:`, result.error.format());
    throw result.error;
  }
  return result.data;
}

const EVENT_MAP = {
  // client -> server
  joinRoom: "join_room",
  submitTask: "submit_task",
  castVote: "cast_vote",
  callEmergency: "call_emergency",
  chatMessage: "chat_message",
  playerMove: "player_move",

  // server -> client
  playerJoined: "player_joined",
  playerLeft: "player_left",
  stateUpdated: "state_updated",
  ledgerUpdated: "ledger_updated",
  chatMessageRecv: "chat_message",
  playersUpdate: "players_update",
} as const;

export function useGameSocket() {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const handlersRef = useRef<Map<string, Handler>>(new Map());

  useEffect(() => {
    const socket = io({
      path: "/socket.io",
      transports: ["websocket", "polling"],
      withCredentials: true,
      autoConnect: true,
    });

    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.onAny((event, payload) => {
      const handler = handlersRef.current.get(event);
      if (handler) handler(payload);
    });

    return () => {
      socket.removeAllListeners();
      socket.close();
      socketRef.current = null;
    };
  }, []);

  const api = useMemo(() => {
    const emit = <K extends keyof typeof ws.send>(event: K, data: z.infer<(typeof ws.send)[K]>) => {
      const validated = parseWithLogging(ws.send[event], data, `ws.send.${String(event)}`);
      const socket = socketRef.current;
      if (!socket) return;
      const mapped =
        event === "joinRoom"
          ? EVENT_MAP.joinRoom
          : event === "submitTask"
            ? EVENT_MAP.submitTask
            : event === "castVote"
              ? EVENT_MAP.castVote
              : event === "callEmergency"
                ? EVENT_MAP.callEmergency
                : event === "playerMove"
                  ? EVENT_MAP.playerMove
                  : EVENT_MAP.chatMessage;
      socket.emit(mapped, validated);
    };

    const on = <K extends keyof typeof ws.receive>(
      event: K,
      handler: (data: z.infer<(typeof ws.receive)[K]>) => void,
    ) => {
      const mapped =
        event === "playerJoined"
          ? EVENT_MAP.playerJoined
          : event === "playerLeft"
            ? EVENT_MAP.playerLeft
            : event === "stateUpdated"
              ? EVENT_MAP.stateUpdated
              : event === "ledgerUpdated"
                ? EVENT_MAP.ledgerUpdated
                : event === "playersUpdate"
                  ? EVENT_MAP.playersUpdate
                  : EVENT_MAP.chatMessageRecv;

      handlersRef.current.set(mapped, (raw) => {
        const validated = parseWithLogging(ws.receive[event], raw, `ws.receive.${String(event)}`);
        handler(validated);
      });

      return () => handlersRef.current.delete(mapped);
    };

    return { emit, on };
  }, []);

  return { connected, ...api };
}
