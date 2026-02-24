/**
 * Auth Routes
 */
import { Router } from "express";
import { authController } from "../controllers/auth.controller";
import { authenticateJWT } from "../middlewares/jwt.middleware";

const router = Router();

router.get("/nonce", authController.generateNonce.bind(authController));
router.post("/verify", authController.verifySignature.bind(authController));
router.get("/me", authenticateJWT, authController.getCurrentUser.bind(authController));

export { router as authRoutes };
