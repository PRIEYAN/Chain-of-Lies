/**
 * Meeting Routes
 */
import { Router } from "express";
import { meetingController } from "../controllers/meeting.controller";
import { authenticateJWT } from "../../auth/middlewares/jwt.middleware";

const router = Router();

router.post("/message", authenticateJWT, meetingController.sendMessage.bind(meetingController));
router.get("/:gameId/messages", authenticateJWT, meetingController.getMessages.bind(meetingController));

export { router as meetingRoutes };
