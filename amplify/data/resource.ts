import { a, defineData, type ClientSchema } from "@aws-amplify/backend";

const schema = a.schema({
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
