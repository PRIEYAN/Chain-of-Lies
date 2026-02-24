import React, { useEffect, useState } from "react";
import { useGameStore } from "@/stores/useGameStore";
import { socket } from "@/shared/socket";

export default function MeetingOverlay() {
  const { meeting, role, localPlayerId, addMeetingMessage, updateMeetingTimer } = useGameStore();
  const [input, setInput] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!meeting.startedAt) return;
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - meeting.startedAt!) / 1000);
      const remaining = Math.max(0, 60 - elapsed);
      updateMeetingTimer(remaining);
      if (remaining === 0) clearInterval(interval);
    }, 500);
    return () => clearInterval(interval);
  }, [meeting.startedAt, updateMeetingTimer]);

  const handleSend = () => {
    if (!input.trim() || sent) return;
    socket.emit("meeting_message", { message: input });
    addMeetingMessage({ playerId: localPlayerId!, message: input });
    setSent(true);
    setInput("");
  };

  if (!meeting.startedAt) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center p-6">
      <div className="bg-black/60 absolute inset-0" />
      <div className="relative bg-white rounded-lg p-4 w-full max-w-3xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Meeting</h3>
          <div className="text-sm">Time: {meeting.timeRemaining}s</div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <div className="h-48 overflow-auto border rounded p-2">
              {meeting.messages.map((m, idx) => (
                <div key={idx} className="mb-2">
                  <strong>{m.playerId}</strong>: {m.message}
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 mt-3">
              <input
                className="flex-1 border rounded px-2 py-1"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={sent || meeting.timeRemaining <= 0}
              />
              <button className="btn btn-primary" onClick={handleSend} disabled={sent || meeting.timeRemaining <= 0}>
                Send
              </button>
            </div>
          </div>

          <div>
            <h4 className="font-semibold">Reference Sentences</h4>
            <div className="mt-2 h-40 overflow-auto border rounded p-2">
              {role === "CREWMATE" ? (
                meeting.referenceSentences.map((s, i) => <div key={i}>{s}</div>)
              ) : (
                <div className="text-sm text-muted-foreground">Imposter: type your own sentence.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
