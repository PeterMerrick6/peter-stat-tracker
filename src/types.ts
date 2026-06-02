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

export type AppData = {
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
