/**
 * WordBank Controller
 */
import { Request, Response } from "express";
import { WordBankModel } from "../models/wordbank.model";

export class WordBankController {
  async createWord(req: Request, res: Response): Promise<void> {
    try {
      const { word, category, difficulty } = req.body;
      if (!word) {
        res.status(400).json({ error: "word is required" });
        return;
      }

      const created = await WordBankModel.create({
        word: String(word).toUpperCase(),
        category,
        difficulty,
      });

      res.status(201).json(created);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async bulkCreate(req: Request, res: Response): Promise<void> {
    try {
      const payload = req.body;
      if (!Array.isArray(payload)) {
        res.status(400).json({ error: "Expected an array of word objects" });
        return;
      }

      const docs = payload.map((p: any) => ({
        word: String(p.word).toUpperCase(),
        category: p.category,
        difficulty: p.difficulty,
      }));

      const inserted = await WordBankModel.insertMany(docs, { ordered: false });
      res.status(201).json({ insertedCount: inserted.length });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
}

export const wordBankController = new WordBankController();
