export type DailyEntry = {
  entryDate: string;
  calories: number | null;
  flashcardsComplete: boolean;
  milesRun: number | null;
};

export type WeeklyEntry = {
  weekStartDate: string;
  weightLbs: number | null;
};

export type GoalType = "status" | "numeric" | "trend";

export type GoalCadence = "daily" | "weekly";

export type GoalTargetDirection = "atLeast" | "atMost" | "none";

export type GoalStatus = "minimum" | "normal" | "exceeds" | "logged";

export type Goal = {
  id: string;
  title: string;
  description: string;
  type: GoalType;
  cadence: GoalCadence;
  unit: string;
  targetDirection: GoalTargetDirection;
  minimumThreshold: number | null;
  normalThreshold: number | null;
  exceedsThreshold: number | null;
  active: boolean;
  displayOrder: number;
  archivedAt: string | null;
};

export type GoalEntry = {
  goalId: string;
  periodDate: string;
  value: number | null;
  status: GoalStatus | null;
};

export type AppData = {
  goals: Goal[];
  goalEntries: GoalEntry[];
  dailyEntries: DailyEntry[];
  weeklyEntries: WeeklyEntry[];
};

export type Streak = {
  label: string;
  current: number;
  longest: number;
  unit: string;
  accent: "gold" | "teal" | "coral" | "green" | "ink";
};
