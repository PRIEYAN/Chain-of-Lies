# ✅ Backend Connection - FIXED

## All Socket Events Now Connected

### Frontend → Backend Event Mapping

| Frontend Event | Backend Handler | Status |
|----------------|----------------|--------|
| `join_room` | ✅ Added handler | **CONNECTED** |
| `submit_task` | ✅ Added handler | **CONNECTED** |
| `cast_vote` | ✅ Added handler | **CONNECTED** |
| `call_emergency` | ✅ Added handler | **CONNECTED** |
| `chat_message` | ✅ Added handler | **CONNECTED** |
| `player_move` | ✅ Already exists | **CONNECTED** |

### Backend → Frontend Event Mapping

| Backend Event | Frontend Listens | Status |
|---------------|------------------|--------|
| `player_joined` | ✅ Added emission | **CONNECTED** |
| `player_left` | ✅ Added emission | **CONNECTED** |
| `state_updated` | ✅ Added emission | **CONNECTED** |
| `players_update` | ✅ Already exists | **CONNECTED** |
| `chat_message` | ✅ Added emission | **CONNECTED** |
| `meeting_started` | ✅ Already exists | **CONNECTED** |
| `voting_started` | ✅ Already exists | **CONNECTED** |
| `game_ended` | ✅ Already exists | **CONNECTED** |

## What Was Fixed

### 1. **join_room Handler** ✅
- Accepts `{ roomId: string, username: string }` from frontend
- Creates party if roomId doesn't exist (backward compatibility)
- Joins existing party if found
- Emits `party_joined` and `player_joined` events

### 2. **submit_task Handler** ✅
- Accepts `{ round: number, role: string, payload: Record<string, any> }` from frontend
- Extracts `taskId` from payload
- Calls `taskService.completeTask()`
- Emits `task_update`, `state_updated`, and `word_update` events
- Handles meeting triggers and win conditions

### 3. **cast_vote Handler** ✅
- Accepts `{ round: number, targetPlayerId: string | null }` from frontend
- Maps to `voteService.castVote()` with proper game context
- Emits `voteCast` confirmation
- Handles vote tallying and win conditions
- Emits `voting_results` to imposter

### 4. **call_emergency Handler** ✅
- Accepts `{ reason?: string }` from frontend
- Starts emergency meeting via `gameService.startMeeting()`
- Emits `meeting_started` with 60-second timer
- Auto-ends meeting and starts voting after 60 seconds

### 5. **chat_message Handler** ✅
- Accepts `{ message: string, at: string }` from frontend
- Maps to `meetingService.sendMessage()`
- Emits `chat_message` to all players in party
- Includes timestamp for frontend compatibility

### 6. **player_left Event** ✅
- Added emission in `handlePlayerLeave()` function
- Emits `player_left` with `{ playerId: string }` format
- Frontend can now properly handle player disconnections

## REST API Routes (Already Connected)

✅ `/api/game/state` - Get game state
✅ `/api/game/players` - Get lobby players  
✅ `/api/game/phase` - Set game phase
✅ `/api/game/ledger` - Get game ledger
✅ `/api/voting/cast` - Cast vote
✅ `/api/voting/votes` - Get votes
✅ `/api/submissions/submit` - Submit task
✅ `/api/submissions` - Get submissions

## Testing

To verify everything is connected:

1. **Start backend:**
   ```bash
   cd apps/api && pnpm dev
   ```

2. **Start frontend:**
   ```bash
   cd apps/web && pnpm dev
   ```

3. **Test socket connection:**
   - Open browser console
   - Check for "Socket connected" message
   - Try joining a room, submitting tasks, voting, etc.

## Summary

🎉 **ALL SOCKET EVENTS ARE NOW CONNECTED!**

Your frontend can now:
- ✅ Join rooms
- ✅ Submit tasks
- ✅ Cast votes
- ✅ Call emergency meetings
- ✅ Send chat messages
- ✅ Move players
- ✅ Receive all game state updates

The backend properly handles all frontend event formats and emits events in the format the frontend expects.
