# Event Indexer

This service will index blockchain events for the game, enabling fast queries and historical data access.

## Planned Features

- Real-time event indexing
- Historical game data queries
- Player statistics aggregation
- Leaderboard computation
- GraphQL API

## Tech Stack (Planned)

- Node.js / Bun
- PostgreSQL / TimescaleDB
- GraphQL (Pothos / GraphQL Yoga)
- Redis for caching

## Structure (Planned)

```
indexer/
├── src/
│   ├── indexers/          # Event indexer modules
│   ├── graphql/           # GraphQL schema & resolvers
│   ├── db/                # Database models
│   └── workers/           # Background workers
└── config/                # Configuration
```
