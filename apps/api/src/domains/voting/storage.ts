/**
 * Voting Domain - In-memory storage for votes
 */
import type { Vote } from "@tamper-hunt/types";

let votes: Vote[] = [];

export const votingStorage = {
  async getVotes(): Promise<Vote[]> {
    return [...votes];
  },

  async getVotesByRound(round: number): Promise<Vote[]> {
    return votes.filter((v) => v.round === round);
  },

  async addVote(vote: Vote): Promise<void> {
    votes.push(vote);
  },

  async clearVotes(): Promise<void> {
    votes = [];
  },

  async reset(): Promise<void> {
    votes = [];
  },
};
