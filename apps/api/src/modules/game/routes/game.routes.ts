/**
 * Game Routes
 */
import { Router } from "express";
import { gameController } from "../controllers/game.controller";
import { authenticateJWT } from "../../auth/middlewares/jwt.middleware";

const router = Router();

router.post("/start", authenticateJWT, gameController.startGame.bind(gameController));
router.get("/:gameId/state", authenticateJWT, gameController.getPlayerGameState.bind(gameController));

export { router as gameRoutes };
