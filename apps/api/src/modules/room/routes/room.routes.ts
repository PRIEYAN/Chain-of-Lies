/**
 * Room Routes
 */
import { Router } from "express";
import { roomController } from "../controllers/room.controller";
import { authenticateJWT } from "../../auth/middlewares/jwt.middleware";

const router = Router();

router.post("/create", authenticateJWT, roomController.createRoom.bind(roomController));
router.post("/join", authenticateJWT, roomController.joinRoom.bind(roomController));
router.get("/:roomCode", roomController.getRoom.bind(roomController));

export { router as roomRoutes };
