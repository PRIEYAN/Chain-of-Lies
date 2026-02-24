/**
 * Vote Routes
 */
import { Router } from "express";
import { voteController } from "../controllers/vote.controller";
import { authenticateJWT } from "../../auth/middlewares/jwt.middleware";

const router = Router();

router.post("/cast", authenticateJWT, voteController.castVote.bind(voteController));
router.get("/:gameId/breakdown", authenticateJWT, voteController.getVoteBreakdown.bind(voteController));

export { router as voteRoutes };
