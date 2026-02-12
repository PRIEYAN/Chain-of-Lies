/**
 * Submissions Domain - In-memory storage for task submissions
 */
import type { TaskSubmission } from "@tamper-hunt/types";

let submissions: TaskSubmission[] = [];

export const submissionStorage = {
  async getSubmissions(): Promise<TaskSubmission[]> {
    return [...submissions];
  },

  async getSubmissionsByRound(round: number): Promise<TaskSubmission[]> {
    return submissions.filter((s) => s.round === round);
  },

  async getSubmissionsByPlayer(playerId: string): Promise<TaskSubmission[]> {
    return submissions.filter((s) => s.playerId === playerId);
  },

  async addSubmission(submission: TaskSubmission): Promise<void> {
    submissions.push(submission);
  },

  async reset(): Promise<void> {
    submissions = [];
  },
};
