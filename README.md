# Tamper Hunt - Blockchain Arena













































































































































































































































































































































































































































































































































































































































































































































































































































The monorepo structure and domain-driven design provide a solid foundation for future growth, including blockchain integration, mobile apps, and microservices.- **Developer Experience**: Fast iteration with hot reload- **Type Safety**: Catch errors at compile time- **Maintainability**: Clear boundaries and responsibilities- **Scalability**: Can grow to handle thousands of users- **Simplicity**: Easy to understand and onboardThis architecture balances:## Conclusion---```app.use("/api/", limiter);});  max: 100, // limit each IP to 100 requests per windowMs  windowMs: 15 * 60 * 1000, // 15 minutesconst limiter = rateLimit({import rateLimit from "express-rate-limit";```typescript### Rate Limiting (Future)```});  ws.userId = decodeToken(token).userId;    }    return;    ws.close(1008, "Unauthorized");  if (!verifyToken(token)) {    const token = req.headers["authorization"];wss.on("connection", (ws, req) => {```typescript### WebSocket Authentication (Future)```}  return res.status(400).json({ error: result.error });if (!result.success) {const result = schema.safeParse(req.body);});  phase: z.enum(GAME_PHASES),const schema = z.object({```typescriptAll inputs are validated with Zod:### Input Validation## Security Considerations---```});  setTimeout(() => rateLimiter.delete(ws.id), 1000);  rateLimiter.set(ws.id, count + 1);    }    return;    ws.send({ type: "error", message: "Rate limit exceeded" });  if (count > 10) {    const count = rateLimiter.get(ws.id) || 0;ws.on("message", (msg) => {const rateLimiter = new Map<string, number>();```typescript**Rate limiting**:### WebSocket Message Rate```});  with: { votes: true },const players = await db.query.players.findMany({// ✅ Good: 1 query with join}  const votes = await db.query.votes.findMany({ where: { voterId: player.id } });for (const player of players) {const players = await db.query.players.findMany();// ❌ Bad: N queries```typescript**N+1 Problem Prevention**:### Database Queries```const LineChart = lazy(() => import("recharts").then(m => ({ default: m.LineChart })));// Useimport { LineChart } from "recharts";// Instead of```typescript- Dynamic imports for heavy libraries- Tree-shaking unused shadcn/ui components- Code splitting by routeStrategies:**Target**: < 200 KB gzipped for initial JS bundle### Webpack Bundle Size## Performance Considerations---```});  });    await expect(page.locator("text=ROLE")).toBeVisible();    await page.click("text=Start Game");    await page.fill("input[name=username]", "TestPlayer");    await page.click("text=Join Game");    await page.goto("/");  it("allows players to join lobby and start game", async () => {describe("Game Flow", () => {// Playwright or Cypress```typescript### End-to-End Tests```});  });    expect(mockWebSocket.broadcast).toHaveBeenCalled();    expect(response.status).toBe(200);          .send({ phase: "ROLE" });      .post("/api/game/phase")    const response = await request(app)  it("updates phase and broadcasts to all clients", async () => {describe("POST /api/game/phase", () => {// apps/api/tests/integration/game.test.ts```typescript### Integration Tests```});  });    expect(tamperers).toHaveLength(1);          .filter(a => a.isTamperer);    const tamperers = Array.from(assignments.values())        const assignments = gameService.assignRoles(players);    const players = [/* ... */];  it("assigns Tamperer role to exactly one player", () => {describe("gameService.assignRoles", () => {// domains/game/service.test.ts```typescript### Unit Tests## Testing Strategy (Future)---- Single source of truth- Runtime safety```export type Player = z.infer<typeof playerSchema>;export const playerSchema = z.object({...});// Define schemas first, derive types```typescript### 5. Schema-First Design- Scales to multiple servers with Redis- Decouples sender from receivers```broadcastToRoom(roomId, message);// WebSocket broadcasts are pub/sub```typescript### 4. Pub/Sub Pattern- Middleware for auth, logging, rate limiting- Single entry point```});  next();  logger.info(`${req.method} ${req.path}`);app.use((req, res, next) => {// All routes go through Express app```typescript### 3. API Gateway Pattern- Reusable across endpoints- Testable without infrastructure```};  },    // Complex logic here  async assignRoles(players: Player[]) {export const gameService = {// service.ts contains business logic```typescript### 2. Service Layer Pattern- Easy to swap (in-memory → database)- Abstracts data source```};  async setPhase(phase: GamePhase): Promise<void> { /* ... */ },  async getState(): Promise<GameState> { /* ... */ },export const gameStorage = {// storage.ts acts as a repository```typescript### 1. Repository Pattern## Design Patterns Used---- `@tamper-hunt/shared` (utilities)- `@tamper-hunt/types` (consistent contracts)But all share:- Developed by different teams- Scaled independently- Deployed independentlyEach can be:```  └── matchmaking/      # Separate service (future)  ├── indexer/          # Separate service  ├── api/              # Game + Voting (single deployment)apps/```**Our monorepo is ready**:- Some services written in other languages (e.g., Go for indexer)- Different teams own different services- Different scaling needs (e.g., Matchmaking needs more instances)**When to split**:```Service    Service      Service      Service[Game]    [Voting]    [Matchmaking] [Indexer]   ↓           ↓            ↓          ↓   ┌───┴───────┬────────────┬──────────┐       │[API Gateway]```### Phase 4: Microservices---**Suitable for**: <10,000 concurrent users```});  broadcastToLocalClients(roomId, message);  // Broadcast to local WebSocket clientsredis.subscribe(`room:${roomId}`, (message) => {// All API instances subscribe});  payload: { voterId }  type: "voteCast",await redis.publish(`room:${roomId}`, {// When a player votes on API-1```typescript**Solution**:- Pub/Sub for cross-server communication- WebSocket sticky sessions (use Redis for room state)**Challenges**:```         [PostgreSQL]               ↓       [Redis Pub/Sub]               ↓   └───────┴───┬───┴───────┘   │       │       │       │[API-1] [API-2] [API-3] [API-4]   ↓       ↓       ↓       ↓   ┌───┴───┬───────┬───────┐       │[Load Balancer]```### Phase 3: Horizontal Scaling---**Suitable for**: <1,000 concurrent users- Can handle server restarts- Redis for fast queries (leaderboards, active games)- Persistent game state**Improvements**:```              [Redis Cache]                    ↓[Frontend] ←──→ [Backend] ←──→ [PostgreSQL]```### Phase 2: Database Persistence---**Suitable for**: <100 concurrent users, demo/MVP- No session persistence- In-memory storage (lost on restart)- Single server (no horizontal scaling)**Limitations**:```                   (In-memory) (Static)          + WebSocket           (Optional)   Vite    ←─────→  Express     ←─────→  PostgreSQL[Frontend]         [Backend]              [Database]```### Current Architecture (MVP)## Scalability Considerations---```});  setGameState(freshState);  const freshState = await fetch("/api/game/state").then(r => r.json());  // Re-sync with serversocket.on("reconnect", async () => {// Client reconnects after disconnect```typescript#### On Reconnection```});  }    setGameState(prev => ({ ...prev, phase: update.payload.phase }));    // Merge server update into local state  if (update.type === "phaseChanged") {    const update = JSON.parse(msg);socket.on("message", (msg) => {// Server sends update```typescript#### On Update```});  setGameState(state);  const state = await fetch("/api/game/state").then(r => r.json());  // Immediately fetch current statesocket.on("open", async () => {// Client connects```typescript#### On ConnectionAll clients must stay in sync. The **server is the source of truth**.### State Synchronization```   └─ Game ends or next round   ├─ Display if Tamperer was eliminated   ├─ Show results6. REVEAL Phase   └─ After all vote → tally results   ├─ POST /api/voting/cast   ├─ Players vote to eliminate5. VOTING Phase   └─ Optional: Emergency meeting   ├─ Look for anomalies   ├─ Players view ledger4. AUDIT Phase   └─ When all submit → transition to AUDIT   ├─ POST /api/submissions/submit   ├─ Players complete tasks3. TASK Phase   └─ Auto-transition to TASK after 10s   ├─ Each player gets their role   ├─ Server assigns roles (service.assignRoles)2. ROLE Phase       └─ WebSocket broadcast: { type: "phaseChanged" }       ├─ POST /api/game/phase { phase: "ROLE" }       │   └─ Host clicks "Start Game"   ├─ Host sees lobby   ├─ Players join via WebSocket1. LOBBY Phase```### Game Lifecycle## Data Flow---   ```   }     await fetch("/api/voting/cast", { method: "POST", body });   if (!socket.connected) {   ```typescript4. **Fallback HTTP** (if WebSocket fails)   ```   // All clients receive update and sync state   ```typescript3. **Server Broadcast** (sync all clients)   ```   socket.send({ type: "castVote", payload });   ```typescript2. **WebSocket Send** (notify server)   ```   setLocalState(newState);  // Update UI immediately   ```typescript1. **Optimistic Update** (instant feedback)For low-latency UX, combine both:### Hybrid Pattern: Optimistic Updates```});  });    payload: { voterId: "p2" }    type: "voteCast",  broadcastToRoom(roomId, {  // Process vote...  const message = wsClientMessages.castVote.parse(JSON.parse(data));wss.on("message", (data) => {// Server receives, validates, broadcasts}));  payload: { targetPlayerId: "p1", round: 2 }  type: "castVote",socket.send(JSON.stringify({// Client sends```typescript#### WebSocket Message Pattern```Player A → WebSocket → Server → Broadcast → All Players in Room```**Flow**:- Vote notifications- Timer ticks- Phase changes- Player joins/leavesUsed for **real-time updates**:### WebSocket```  ←─────── HTTP Response ←─────────────────────────────────────┘Frontend → HTTP Request → Express → Domain Service → Storage → Database```**Flow**:- Cast a vote- Submit a task- Get game stateUsed for **request/response** patterns:### HTTP (REST-like)## Communication Patterns---```});  res.json(state);  // Must match schema  const state = await gameService.getState();app.get(api.game.state.path, async (req, res) => {// Backendconst data: GameState = await response.json();const response = await fetch(api.game.state.path);// Frontend```typescript**Usage**:- **Documentation**: API surface is self-documenting- **Refactor-safe**: Rename endpoint? TypeScript errors guide you- **Auto-complete paths**: No typos in API paths- **Type-safe fetch**: Frontend knows exact response type**Benefits**:```};  },    },      },        200: gameStateSchema,      responses: {      path: "/api/game/state" as const,      method: "GET" as const,    state: {  game: {export const api = {```typescript#### API Contract (`api.ts`)Runtime utilities and API contracts.### Package: `@tamper-hunt/shared`   - Fast to build and import   - Tree-shakeable   - Only depends on `zod` (also zero-dep)3. **Zero Runtime Dependencies**   - Can't get out of sync   - Runtime array for iteration/validation   - TypeScript ensures exhaustive case handling   ```   export type GamePhase = typeof GAME_PHASES[number];      ] as const;     "LOBBY", "ROLE", "TASK", "AUDIT", "VOTING", "REVEAL"   export const GAME_PHASES = [   ```typescript2. **Constants as Single Source**   - Both: Share the TypeScript type   - Backend: Validates request bodies   - Frontend: Validates API responses   ```   export type Player = z.infer<typeof playerSchema>;      });     isHost: z.boolean(),     username: z.string(),     id: z.string(),   export const playerSchema = z.object({   ```typescript1. **Runtime + Compile-time Safety**: Using Zod for schemas#### Design PrinciplesThis package is the **single source of truth** for all types in the system.### Package: `@tamper-hunt/types`## Type System---- UI state is local to components- Real-time updates come from WebSocket- Server state is handled by TanStack Query**No Redux/Zustand needed** because:- No need for global state management- Ephemeral UI state (modals, inputs, etc.)```const [isModalOpen, setIsModalOpen] = useState(false);```typescript#### UI State (React Hook State)- Local state for optimistic updates- Updates trigger React re-renders- WebSocket updates are received in real-time```const { gameState, sendMessage } = useWebSocket();```typescript#### Real-time State (WebSocket + React State)- No need for global state for server data- Automatic refetching, caching, and deduplication- Data from the API is cached and synced```});  },    return res.json();    const res = await fetch("/api/game/state");  queryFn: async () => {  queryKey: ["game", "state"],const { data: gameState } = useQuery({```typescript#### Server State (TanStack Query)We use a **server-first** approach to state management:### State Management Strategy```└── main.tsx          # Entry point├── App.tsx           # Root component with routing│   └── socket.ts       # WebSocket client│   ├── queryClient.ts  # TanStack Query config├── lib/              # Utilities│   └── GamePage.tsx│   ├── LobbyPage.tsx│   ├── LandingPage.tsx├── pages/            # Page components (routes)│   └── use-websocket.ts  # WebSocket connection│   ├── use-game.ts   # Game state management├── hooks/            # Custom React hooks│   └── Voting.tsx│   ├── GameBoard.tsx│   ├── Lobby.tsx│   ├── Landing.tsx   # Page-specific components│   ├── ui/           # shadcn/ui primitives (Button, Dialog, etc.)├── components/       # Reusable UI componentsapps/web/src/```### Directory StructureThe frontend uses a modern React stack with **component-driven architecture**.## Frontend Architecture---- Implements async patterns even for in-memory (easier to migrate)- Can be swapped without changing service layer- Abstract data source (in-memory, database, Redis, etc.)```};  },    // return db.query.games.findFirst();    // Future: database        return { ...gameState };    // Current: in-memory  async getState(): Promise<GameState> {export const gameStorage = {```typescript#### `storage.ts` - Data Persistence- Returns typed data- Easy to test (no mocking infrastructure)- Pure business logic, no HTTP or database concerns```};  },    return assignments;    // ...    const assignments = new Map();    // Complex business logic here  async assignRoles(players: Player[]) {    },    return gameStorage.getState();  async getState() {export const gameService = {```typescript#### `service.ts` - Business Logic- Delegates to service layer- Validates input using Zod schemas- Thin layer that handles HTTP concerns (request/response)```}  });    res.json(state);    const state = await gameService.getState();  app.get("/api/game/state", async (req, res) => {export function registerGameRoutes(app: Express) {```typescript#### `routes.ts` - HTTP LayerEach domain follows a consistent pattern:### Domain Structure- Testable in isolation (mock the infrastructure layer)- Easy to swap implementations (e.g., in-memory vs Redis)- Domains don't know about implementation details (e.g., PostgreSQL vs MongoDB)**Why separate?**```  └── logging/        # Structured logging  ├── http/           # Express middleware, error handling  ├── websocket/      # WebSocket server and room management  ├── database/       # Drizzle ORM, schema, migrationsinfrastructure/```Cross-cutting concerns are separated into the infrastructure layer:### Infrastructure Layer- New team members can focus on one domain- Can extract a domain into a microservice later- Easy to understand ownership and boundaries- All code for a feature lives together**Benefits**:```      └── storage.ts      ├── service.ts      ├── routes.ts  └── submissions/  │   └── storage.ts  │   ├── service.ts  │   ├── routes.ts  ├── voting/  │   └── index.ts      # Public exports  │   ├── storage.ts    # Data persistence  │   ├── service.ts    # Business logic  │   ├── routes.ts     # HTTP endpoints  ├── game/domains/```#### Domain-Driven Architecture ✅**Problem**: Related code is scattered across multiple folders. Adding a new feature requires touching many files in different layers.```  └── submission.ts  ├── vote.ts  ├── game.tsmodels/  └── submissionService.ts  ├── votingService.ts  ├── gameService.tsservices/  └── submissionController.ts  ├── votingController.ts  ├── gameController.tscontrollers/```#### Traditional Layered Architecture ❌The API is organized by **business domains** rather than technical layers.### Domain-Driven Design (DDD)## Backend Architecture---```}  }    }      "outputs": ["dist/**"]    // Cache these outputs      "dependsOn": ["^build"],  // Build dependencies first    "build": {  "tasks": {{```json**turbo.json** defines the task pipeline:- **Pipelining**: Streams output from one task to dependent tasks- **Parallelization**: Builds independent packages in parallel- **Caching**: Skips unchanged packages (local and remote cache)- **Dependency-aware**: Builds packages in the correct orderTurborepo orchestrates builds across the monorepo:### Build System: Turborepo```    └── shared/     # Runtime utilities and API contracts    ├── types/      # Pure TypeScript types and Zod schemas└── packages/       # Shared libraries (imported by apps)││   └── mobile/     # Mobile app (React Native) - Future│   ├── indexer/    # Event indexer (Node.js) - Future│   ├── contracts/  # Smart contracts (Solidity) - Future│   ├── api/        # Backend (Node.js server)│   ├── web/        # Frontend (static files)├── apps/           # Deployable applications (each produces a Docker image)blockchain-arena/```### Package Organization5. **Better Developer Experience**: One install, one build, consistent tooling4. **Simplified Dependencies**: No need to publish internal packages to npm3. **Code Sharing**: Shared types, utilities, and constants prevent duplication2. **Atomic Changes**: Changes to API contracts, types, and implementations happen in a single PR1. **Single Source of Truth**: All code lives in one repository, making it easy to see the entire systemWe chose a monorepo architecture for several key reasons:### Why Monorepo?## Monorepo Structure---7. [Scalability Considerations](#scalability-considerations)6. [Data Flow](#data-flow)5. [Communication Patterns](#communication-patterns)4. [Type System](#type-system)3. [Frontend Architecture](#frontend-architecture)2. [Backend Architecture](#backend-architecture)1. [Monorepo Structure](#monorepo-structure)## Table of ContentsTamper Hunt is built as a production-grade monorepo using Turborepo, pnpm workspaces, and a domain-driven architecture. This document explains the architectural decisions and patterns used throughout the codebase.## OverviewA multiplayer blockchain-themed social deduction game built with a production-grade monorepo architecture.

## 🏗️ Project Structure

```
blockchain-arena/
├── apps/
│   ├── web/                    # React frontend (Vite + React)
│   │   ├── src/
│   │   │   ├── components/     # UI components (shadcn/ui)
│   │   │   ├── hooks/          # Custom React hooks
│   │   │   ├── pages/          # Page components
│   │   │   └── lib/            # Utilities (cn, socket, etc.)
│   │   ├── public/             # Static assets
│   │   └── index.html          # HTML entry point
│   │
│   ├── api/                    # Express backend with WebSocket
│   │   └── src/
│   │       ├── domains/        # Domain-driven design modules
│   │       │   ├── game/       # Game state, roles & ledger
│   │       │   ├── voting/     # Voting system & tallying
│   │       │   └── submissions/# Task submissions & validation
│   │       ├── infrastructure/ # Cross-cutting concerns
│   │       │   ├── database/   # Drizzle ORM & PostgreSQL
│   │       │   ├── websocket/  # Real-time game communication
│   │       │   ├── http/       # Express middleware
│   │       │   └── logging/    # Structured logging
│   │       └── main.ts         # Server entry point
│   │
│   ├── contracts/              # Solidity smart contracts (Future)
│   ├── indexer/                # Blockchain event indexer (Future)
│   └── mobile/                 # React Native app (Future)
│
├── packages/
│   ├── types/                  # Shared TypeScript types
│   │   └── src/
│   │       ├── constants.ts    # GAME_PHASES, ROLES
│   │       ├── schemas.ts      # Zod schemas + inferred types
│   │       ├── actions.ts      # Redux-style action types
│   │       └── websocket.ts    # WebSocket message types
│   │
│   └── shared/                 # Shared utilities & API contracts
│       └── src/
│           ├── utils.ts        # cn(), generateId(), etc.
│           └── api.ts          # Type-safe API contract
│
└── scripts/                    # Build & development scripts
    ├── build.ts                # Production build script
    └── setup.ts                # Development environment setup
```

## 🚀 Getting Started

### Prerequisites

- **Node.js** 20+ (check with `node --version`)
- **pnpm** 9+ (install: `npm install -g pnpm`)
- **PostgreSQL** (optional for development, uses in-memory storage by default)

### Quick Start

1. **Clone and install dependencies**
   ```bash
   cd blockchain-arena
   pnpm install
   ```

2. **Set up environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Build shared packages** (required before running apps)
   ```bash
   pnpm --filter @tamper-hunt/types build
   pnpm --filter @tamper-hunt/shared build
   ```

4. **Start development servers**
   ```bash
   # Start all apps (recommended)
   pnpm dev
   
   # Or start individually:
   pnpm --filter @tamper-hunt/api dev     # Backend on :5000
   pnpm --filter @tamper-hunt/web dev     # Frontend on :3000
   ```

5. **Open your browser**
   - Frontend: http://localhost:3000
   - API Health: http://localhost:5000/api/health

### Building for Production

```bash
# Build all packages
pnpm build

# Start production server
pnpm --filter @tamper-hunt/api start
```

## 📦 Packages

| Package | Description | Type |
|---------|-------------|------|
| `@tamper-hunt/web` | React frontend with Vite, TailwindCSS, shadcn/ui | App |
| `@tamper-hunt/api` | Express API with WebSocket, domain-driven architecture | App |
| `@tamper-hunt/types` | Shared TypeScript types, Zod schemas, constants | Library |
| `@tamper-hunt/shared` | Shared utilities, helpers, and API contracts | Library |

### Package Dependencies

```
@tamper-hunt/web     → depends on → @tamper-hunt/types, @tamper-hunt/shared
@tamper-hunt/api     → depends on → @tamper-hunt/types, @tamper-hunt/shared
@tamper-hunt/shared  → depends on → @tamper-hunt/types
```

## 🎮 Game Overview

Tamper Hunt is a social deduction game set in a blockchain world. Players take on roles like Validators, Auditors, and Miners, working to complete tasks while identifying the hidden Tamperer who sabotages the ledger.

### Roles

- **Validator** - Validates transactions
- **Auditor** - Audits ledger entries
- **Indexer** - Indexes blockchain data
- **Miner** - Mines new blocks
- **Smart Contract Dev** - Develops contracts
- **Bridge Operator** - Operates cross-chain bridges
- **Oracle** - Provides external data
- **Tamperer** - Introduces anomalies (antagonist)

## 🛠️ Development

### Available Commands

```bash
# Development
pnpm dev              # Start all apps in watch mode (Turborepo)
pnpm build            # Build all packages (respects dependencies)
pnpm lint             # Run linting across all packages
pnpm typecheck        # Run TypeScript type checking
pnpm test             # Run tests (when implemented)
pnpm clean            # Clean all build outputs and node_modules

# Database (API only)
pnpm db:push          # Push Drizzle schema to database
pnpm db:generate      # Generate migrations

# Package-specific
pnpm --filter @tamper-hunt/web dev      # Frontend only
pnpm --filter @tamper-hunt/api dev      # Backend only
pnpm --filter @tamper-hunt/types build  # Build types package
```

### Project Scripts

- `scripts/build.ts` - Production build orchestration
- `scripts/setup.ts` - Development environment setup

### Tech Stack

#### Frontend (`apps/web`)
- **React 18** - UI framework
- **Vite** - Build tool & dev server
- **TailwindCSS** - Utility-first CSS
- **shadcn/ui** - Accessible component library
- **Wouter** - Lightweight routing
- **TanStack Query** - Server state management
- **Framer Motion** - Animations

#### Backend (`apps/api`)
- **Express 5** - HTTP server
- **WebSocket (ws)** - Real-time communication
- **Drizzle ORM** - Type-safe database ORM
- **PostgreSQL** - Primary database
- **Zod** - Runtime validation
- **Domain-Driven Design** - Architecture pattern

#### Shared Infrastructure
- **Turborepo** - Monorepo build system
- **pnpm Workspaces** - Package management
- **TypeScript 5** - Type safety
- **tsup** - Package bundler

## 🏛️ Architecture Decisions

### Why Monorepo?
- **Code Reuse**: Share types, utilities, and API contracts across frontend/backend
- **Atomic Changes**: Update contracts, types, and implementations in a single commit
- **Type Safety**: End-to-end type safety from API to UI
- **Simplified Tooling**: Single install, single build, unified versioning

### Why Domain-Driven Design (Backend)?
The API is organized by business domains rather than technical layers:
```
✅ domains/game/        (business capability)
✅ domains/voting/
✅ domains/submissions/
❌ controllers/         (technical layer)
❌ services/
❌ models/
```

**Benefits:**
- **Scalability**: Each domain can evolve independently
- **Clear Boundaries**: Ownership and responsibilities are explicit
- **Easier Testing**: Domain logic is isolated and testable
- **Team Alignment**: Maps to business requirements and team structure

### Infrastructure Layer
Cross-cutting concerns (database, WebSocket, logging) are separated from business logic:
- Easy to swap implementations (e.g., Redis for memory storage)
- Shared across all domains without tight coupling
- Infrastructure code doesn't leak into business logic

### Package Structure
```
packages/types    → Pure types, no runtime code
packages/shared   → Runtime utilities + API contracts
apps/web         → Consumer of types & shared
apps/api         → Consumer of types & shared
```

**Why separate types from shared?**
- Types package has zero runtime dependencies (tree-shakeable)
- Shared package includes runtime utilities (clsx, tailwind-merge)
- Consumers can import only what they need

## � Future Roadmap

### Phase 1: Current (MVP)
- [x] Monorepo structure with Turborepo
- [x] Domain-driven backend architecture
- [x] Type-safe API contracts
- [x] Real-time multiplayer with WebSocket
- [x] React frontend with shadcn/ui

### Phase 2: Blockchain Integration
- [ ] Solidity smart contracts (`apps/contracts`)
- [ ] On-chain game state and voting
- [ ] Wallet integration (MetaMask, WalletConnect)
- [ ] NFT badges for achievements
- [ ] Token rewards for winners

### Phase 3: Infrastructure
- [ ] Event indexer for blockchain events (`apps/indexer`)
- [ ] GraphQL API for historical data
- [ ] Redis for real-time caching
- [ ] Microservice for matchmaking
- [ ] Tournament system

### Phase 4: Mobile & Scaling
- [ ] React Native mobile app (`apps/mobile`)
- [ ] Push notifications
- [ ] Offline-first architecture
- [ ] Multi-region deployment
- [ ] Leaderboards & player stats

## 🐛 Troubleshooting

### Build Errors

**"Cannot find module '@tamper-hunt/types'"**
```bash
# Build packages in dependency order first
pnpm --filter @tamper-hunt/types build
pnpm --filter @tamper-hunt/shared build
```

**"Port 5000 already in use"**
```bash
# Change port in .env file
PORT=5001

# Or kill the process using port 5000 (Windows)
netstat -ano | findstr :5000
taskkill /PID <PID> /F
```

### Development Issues

**"WebSocket connection failed"**
- Ensure backend is running: `pnpm --filter @tamper-hunt/api dev`
- Check VITE_WS_URL in .env matches backend port

**"Types not updating"**
- Rebuild types package: `pnpm --filter @tamper-hunt/types build --force`
- Restart TypeScript server in VSCode: Cmd/Ctrl + Shift + P → "Restart TS Server"

**"Turborepo cache issues"**
```bash
# Clear Turborepo cache
rm -rf .turbo
pnpm build --force
```

## 📄 License

MIT

---

**Built with ❤️ for the Web3 gaming community**
