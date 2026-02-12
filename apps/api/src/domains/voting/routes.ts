/**
 * Voting Domain - HTTP Routes
 */
import type { Express } from "express";
import { z } from "zod";
import { votingService } from "./service";

export function registerVotingRoutes(app: Express) {
  // Get all votes
  app.get("/api/voting/votes", async (_req, res) => {
    const votes = await votingService.getVotes();
    res.json(votes);
  });

  // Get votes by round
  app.get("/api/voting/votes/:round", async (req, res) => {
    const round = parseInt(req.params.round, 10);
    if (isNaN(round)) {
      return res.status(400).json({ message: "Invalid round number" });
    }
    const votes = await votingService.getVotesByRound(round);
    res.json(votes);
  });

  // Cast a vote
  app.post("/api/voting/cast", async (req, res) => {
    try {
      const schema = z.object({
        voterId: z.string(),
        targetPlayerId: z.string().nullable(),
        round: z.number().int().positive(),
      });
      const input = schema.parse(req.body);
      const vote = await votingService.castVote(
        input.voterId,
        input.targetPlayerId,
        input.round
      );
      res.json(vote);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0]?.message ?? "Invalid request",
          field: err.errors[0]?.path?.join("."),
        });
      }
      throw err;
    }
  });

  // Get vote tally for a round
  app.get("/api/voting/tally/:round", async (req, res) => {
    const round = parseInt(req.params.round, 10);
    if (isNaN(round)) {
      return res.status(400).json({ message: "Invalid round number" });
    }
    const tally = await votingService.tallyVotes(round);
    res.json(Object.fromEntries(tally));
  });
}
