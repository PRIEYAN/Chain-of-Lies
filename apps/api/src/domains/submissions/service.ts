/**
 * Submissions Domain - Business Logic Service
 */
import { submissionStorage } from "./storage";
import type { TaskSubmission } from "@tamper-hunt/types";

export const submissionService = {
  async getSubmissions() {
    return submissionStorage.getSubmissions();
  },

  async getSubmissionsByRound(round: number) {
    return submissionStorage.getSubmissionsByRound(round);
  },

  async getSubmissionsByPlayer(playerId: string) {
    return submissionStorage.getSubmissionsByPlayer(playerId);
  },

  async submitTask(
    playerId: string,
    role: string,
    round: number,
    payload: Record<string, unknown>
  ): Promise<TaskSubmission> {
    const submission: TaskSubmission = {
      id: `sub-${Date.now()}-${playerId}`,
      playerId,
      role,
      round,
      payload,
      submittedAt: new Date().toISOString(),
    };

    await submissionStorage.addSubmission(submission);
    return submission;
  },

  async validateSubmission(submission: TaskSubmission): Promise<boolean> {
    // Add validation logic for different role submissions
    return true;
  },
};
