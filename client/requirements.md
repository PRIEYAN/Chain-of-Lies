## Packages
socket.io-client | Real-time multiplayer events (join room, task submissions, voting, chat)

## Notes
WebSocket: socket.io-client connects to "/socket.io" by default; frontend emits events: join_room, submit_task, cast_vote, call_emergency, chat_message; listens for player_joined, player_left, state_updated, ledger_updated, chat_message
REST polling: also fetch /api/game/state, /api/game/players, /api/game/ledger via TanStack Query for robust fallback
Tailwind: Add font families to tailwind.config.ts to enable className="font-display" / "font-body" (see index.css variables below)
SEO: Update client/index.html title/meta/og to "Takshashila Tamper Hunt"
