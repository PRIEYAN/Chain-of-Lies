/**
 * Game Phase Constants
 * Defines all possible states a game can be in
 */
export const GAME_PHASES = [
  "LOBBY",    // Players joining, waiting for game start
  "ROLE",     // Role assignment and reveal
  "TASK",     // Active task completion phase
  "AUDIT",    // Ledger audit and anomaly detection
  "VOTING",   // Voting to eliminate suspected tamperer
  "REVEAL",   // Final reveal of roles and game outcome
] as const;

export type GamePhase = (typeof GAME_PHASES)[number];

/**
 * Player Role Constants
 * All available roles in the blockchain-themed game
 */
export const ROLES = [
  "Validator",        // Validates transactions
  "Auditor",          // Audits ledger entries
  "Indexer",          // Indexes blockchain data
  "Miner",            // Mines new blocks
  "SmartContractDev", // Develops smart contracts
  "BridgeOperator",   // Operates cross-chain bridges
  "Oracle",           // Provides external data
  "Tamperer",         // The antagonist - introduces anomalies
] as const;

export type Role = (typeof ROLES)[number];

/**
 * Ledger Status Types
 */
export type LedgerStatus = "Normal" | "Anomaly";
