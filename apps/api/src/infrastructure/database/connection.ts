/**
 * LEGACY: PostgreSQL/Drizzle ORM setup
 * 
 * ⚠️  THIS FILE IS NOT USED - Legacy code from original codebase
 * 
 * This project now uses MongoDB Atlas exclusively.
 * See: infrastructure/database/mongodb.ts
 * 
 * This file is kept for backward compatibility but is not imported anywhere.
 */

// Legacy code - not used
// import { drizzle } from "drizzle-orm/node-postgres";
// import { Pool } from "pg";

// const pool = new Pool({
//   connectionString: process.env.DATABASE_URL,
// });

// export const db = drizzle(pool);
// export { pool };

// This file is intentionally empty - MongoDB is used instead
export {};
