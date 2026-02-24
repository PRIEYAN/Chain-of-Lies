/**
 * Database Exports
 * 
 * This project uses MongoDB Atlas exclusively via Mongoose.
 * The old PostgreSQL/Drizzle code in connection.ts and schema.ts
 * is legacy code and is NOT used by the new game logic.
 */

// MongoDB (Active)
export * from "./mongodb";

// Legacy PostgreSQL exports (not used, kept for backward compatibility)
// export * from "./connection";
// export * from "./schema";
