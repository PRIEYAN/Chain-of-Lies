/**
 * Submissions Domain - HTTP Routes
 */
import type { Express } from "express";
import { z } from "zod";
import { submissionService } from "./service";

export function registerSubmissionRoutes(app: Express) {
  // Get all submissions
  app.get("/api/submissions", async (_req, res) => {
    const submissions = await submissionService.getSubmissions();
    res.json(submissions);
  });

  // Get submissions by round
  app.get("/api/submissions/round/:round", async (req, res) => {
    const round = parseInt(req.params.round, 10);
    if (isNaN(round)) {
      return res.status(400).json({ message: "Invalid round number" });
    }
    const submissions = await submissionService.getSubmissionsByRound(round);
    res.json(submissions);
  });

  // Get submissions by player
  app.get("/api/submissions/player/:playerId", async (req, res) => {
    const submissions = await submissionService.getSubmissionsByPlayer(req.params.playerId);
    res.json(submissions);
  });

  // Submit a task
  app.post("/api/submissions/submit", async (req, res) => {
    try {
      const schema = z.object({
        playerId: z.string(),
        role: z.string(),
        round: z.number().int().positive(),
        payload: z.record(z.unknown()),
      });
      const input = schema.parse(req.body);
      const submission = await submissionService.submitTask(
        input.playerId,
        input.role,
        input.round,
        input.payload
      );
      res.json(submission);
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
}
