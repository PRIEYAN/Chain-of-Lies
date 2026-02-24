# Database Setup

## MongoDB Atlas Only

This project uses **MongoDB Atlas** exclusively. The old PostgreSQL/Drizzle code in `connection.ts` and `schema.ts` is legacy code from the original codebase and is **NOT used** by the new game logic.

## Active Database

- **MongoDB Atlas** via Mongoose
- Connection: `infrastructure/database/mongodb.ts`
- Models: `modules/*/models/*.model.ts`

## Legacy Code (Not Used)

- `connection.ts` - Old PostgreSQL connection (legacy)
- `schema.ts` - Old Drizzle schema (legacy)
- These files are kept for backward compatibility but are not imported or used

## Environment Variables

Only these MongoDB-related variables are needed:

```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/chain-of-lies
```

No PostgreSQL/DATABASE_URL needed!
