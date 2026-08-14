import { a, defineData, type ClientSchema } from "@aws-amplify/backend";

const schema = a.schema({
  Goal: a
    .model({
      title: a.string().required(),
      description: a.string(),
      type: a.enum(["STATUS", "NUMERIC", "TREND"]),
      cadence: a.enum(["DAILY", "WEEKLY"]),
      unit: a.string(),
      targetDirection: a.enum(["AT_LEAST", "AT_MOST", "NONE"]),
      minimumThreshold: a.float(),
      normalThreshold: a.float(),
      exceedsThreshold: a.float(),
      active: a.boolean().default(true),
      displayOrder: a.integer().default(0),
      archivedAt: a.datetime(),
    })
    .authorization((allow) => [allow.owner()]),

  GoalEntry: a
    .model({
      goalId: a.id().required(),
      periodDate: a.date().required(),
      value: a.float(),
      status: a.enum(["MINIMUM", "NORMAL", "EXCEEDS", "LOGGED"]),
    })
    .identifier(["goalId", "periodDate"])
    .authorization((allow) => [allow.owner()]),

  DailyEntry: a
    .model({
      entryDate: a.date().required(),
      calories: a.integer(),
      flashcardsComplete: a.boolean(),
      milesRun: a.float(),
    })
    .identifier(["entryDate"])
    .authorization((allow) => [allow.owner()]),

  WeeklyEntry: a
    .model({
      weekStartDate: a.date().required(),
      weightLbs: a.float(),
    })
    .identifier(["weekStartDate"])
    .authorization((allow) => [allow.owner()]),

  AccessGrant: a
    .model({
      viewerEmail: a.email().required(),
      permission: a.enum(["READ"]),
      active: a.boolean().default(true),
    })
    .authorization((allow) => [allow.owner()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "userPool",
  },
});
