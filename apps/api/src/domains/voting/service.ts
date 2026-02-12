/**
 * Voting Domain - Business Logic Service
 */
import { votingStorage } from "./storage";
import type { Vote } from "@tamper-hunt/types";

export const votingService = {
  async getVotes() {
    return votingStorage.getVotes();
  },

  async getVotesByRound(round: number) {
    return votingStorage.getVotesByRound(round);
  },

  async castVote(voterId: string, targetPlayerId: string | null, round: number): Promise<Vote> {
    const vote: Vote = {
      id: `vote-${Date.now()}-${voterId}`,
      voterId,
      targetPlayerId,
      round,
      castAt: new Date().toISOString(),
    };
    
    await votingStorage.addVote(vote);
    return vote;
  },

  async tallyVotes(round: number): Promise<Map<string | null, number>> {
    const votes = await votingStorage.getVotesByRound(round);
    const tally = new Map<string | null, number>();
    
    for (const vote of votes) {
      const current = tally.get(vote.targetPlayerId) ?? 0;
      tally.set(vote.targetPlayerId, current + 1);
    }
    
    return tally;
  },

  async getEliminatedPlayer(round: number): Promise<string | null> {
    const tally = await this.tallyVotes(round);
    let maxVotes = 0;
    let eliminated: string | null = null;
    
    for (const [playerId, count] of tally) {
      if (playerId !== null && count > maxVotes) {
        maxVotes = count;
        eliminated = playerId;
      }
    }
    
    return eliminated;
  },
};
