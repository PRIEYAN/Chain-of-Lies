/**
 * Task Routes
 */
import { Router } from "express";
import { taskController } from "../controllers/task.controller";
import { authenticateJWT } from "../../auth/middlewares/jwt.middleware";

const router = Router();

router.get("/game/:gameId", authenticateJWT, taskController.getPlayerTasks.bind(taskController));
router.post("/complete", authenticateJWT, taskController.completeTask.bind(taskController));

export { router as taskRoutes };
