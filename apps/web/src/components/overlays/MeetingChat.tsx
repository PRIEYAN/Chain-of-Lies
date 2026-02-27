/**
 * Meeting Chat Component
 *
 * Live group chat interface for emergency meetings.
 * Self-contained component that connects to Socket.IO for real-time chat.
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Send, Users, MessageSquare } from "lucide-react";
import { socket } from "@/shared/socket";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: string;
  meetingId: string;
  playerId: string;
  playerName: string;
  message: string;
  timestamp: string;
}

interface Player {
  id: string;
  name: string;
  color?: string;
  isAlive?: boolean;
}

interface MeetingChatProps {
  meetingId: string;
  localPlayerName: string;
  players?: Player[];
  className?: string;
}

export default function MeetingChat({
  meetingId,
  localPlayerName,
  players = [],
  className,
}: MeetingChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isConnected, setIsConnected] = useState(socket.connected);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Connect to meeting chat
  useEffect(() => {
    if (!meetingId) return;

    // Join meeting chat room
    socket.emit("join_meeting_chat", { meetingId });

    // Handle chat history
    const handleHistory = (data: { meetingId: string; messages: ChatMessage[] }) => {
      if (data.meetingId === meetingId) {
        setMessages(data.messages);
      }
    };

    // Handle incoming messages
    const handleMessage = (msg: ChatMessage) => {
      if (msg.meetingId === meetingId) {
        setMessages((prev) => [...prev, msg]);
      }
    };

    // Handle connection status
    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);

    socket.on("meeting_chat_history", handleHistory);
    socket.on("meeting_chat_message", handleMessage);
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);

    return () => {
      socket.off("meeting_chat_history", handleHistory);
      socket.off("meeting_chat_message", handleMessage);
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.emit("leave_meeting_chat");
    };
  }, [meetingId]);

  // Send message handler
  const handleSend = useCallback(() => {
    const message = draft.trim();
    if (!message || !meetingId) return;

    socket.emit("meeting_chat_message", {
      meetingId,
      message,
      playerName: localPlayerName,
    });

    setDraft("");
    inputRef.current?.focus();
  }, [draft, meetingId, localPlayerName]);

  // Handle enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Format timestamp
  const formatTime = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  // Get player color
  const getPlayerColor = (playerId: string) => {
    const player = players.find((p) => p.id === playerId);
    return player?.color || "#9CA3AF";
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">Meeting Chat</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              "text-xs",
              isConnected
                ? "bg-green-500/10 text-green-400 border-green-500/30"
                : "bg-red-500/10 text-red-400 border-red-500/30"
            )}
          >
            {isConnected ? "Live" : "Reconnecting..."}
          </Badge>
          {players.length > 0 && (
            <Badge variant="outline" className="text-xs bg-white/5 border-white/10">
              <Users className="h-3 w-3 mr-1" />
              {players.filter((p) => p.isAlive !== false).length}
            </Badge>
          )}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-3" ref={scrollRef}>
        <div className="space-y-3">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground text-sm py-8">
              No messages yet. Start the discussion!
            </div>
          )}
          {messages.map((msg) => {
            const isLocal = msg.playerName === localPlayerName;
            return (
              <div
                key={msg.id}
                className={cn(
                  "flex flex-col gap-1 max-w-[85%]",
                  isLocal ? "ml-auto items-end" : "items-start"
                )}
              >
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span
                    className="font-medium"
                    style={{ color: getPlayerColor(msg.playerId) }}
                  >
                    {isLocal ? "You" : msg.playerName}
                  </span>
                  <span>{formatTime(msg.timestamp)}</span>
                </div>
                <div
                  className={cn(
                    "px-3 py-2 rounded-xl text-sm",
                    isLocal
                      ? "bg-primary/20 text-primary-foreground border border-primary/30"
                      : "bg-white/5 border border-white/10"
                  )}
                >
                  {msg.message}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="px-4 py-3 border-t border-white/10">
        <div className="flex items-center gap-2">
          <Input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 h-10 bg-white/5 border-white/10 focus:border-primary"
            maxLength={500}
            disabled={!isConnected}
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!draft.trim() || !isConnected}
            className="h-10 w-10 bg-primary/20 hover:bg-primary/30 border border-primary/30"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
