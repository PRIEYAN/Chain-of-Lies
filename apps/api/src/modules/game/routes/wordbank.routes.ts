/**
 * WordBank Routes
 */
import { Router } from "express";
import { wordBankController } from "../controllers/wordbank.controller";

const router = Router();

router.post("/", wordBankController.createWord.bind(wordBankController));
router.post("/bulk", wordBankController.bulkCreate.bind(wordBankController));

export { router as wordbankRoutes };
