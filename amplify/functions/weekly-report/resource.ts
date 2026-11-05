import { defineFunction } from "@aws-amplify/backend";

export const weeklyReport = defineFunction({
  name: "weekly-habit-report",
  entry: "./handler.ts",
  runtime: 22,
  timeoutSeconds: 120,
  memoryMB: 512,
});
