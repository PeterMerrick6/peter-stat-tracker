import { Duration, RemovalPolicy, Stack } from "aws-cdk-lib";
import { AttributeType, BillingMode, Table } from "aws-cdk-lib/aws-dynamodb";
import { Effect, PolicyStatement, Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { CfnSchedule } from "aws-cdk-lib/aws-scheduler";
import { Queue } from "aws-cdk-lib/aws-sqs";
import { SqsDestination } from "aws-cdk-lib/aws-lambda-destinations";
import { defineBackend } from "@aws-amplify/backend";
import { auth } from "./auth/resource";
import { data } from "./data/resource";
import { weeklyReport } from "./functions/weekly-report/resource";

const backend = defineBackend({
  auth,
  data,
  weeklyReport,
});

backend.auth.resources.userPool.applyRemovalPolicy(RemovalPolicy.RETAIN_ON_UPDATE_OR_DELETE);
backend.auth.resources.cfnResources.cfnUserPool.adminCreateUserConfig = {
  allowAdminCreateUserOnly: true,
};

const reportFunction = backend.weeklyReport.resources.lambda;
const reportStack = Stack.of(reportFunction);
const sender = process.env.REPORT_FROM_EMAIL?.trim() ?? "";
backend.addOutput({ custom: { weeklyReports: { senderConfigured: Boolean(sender) } } });
const deliveries = new Table(reportStack, "WeeklyReportDeliveries", {
  partitionKey: { name: "id", type: AttributeType.STRING },
  billingMode: BillingMode.PAY_PER_REQUEST,
  timeToLiveAttribute: "expiresAt",
  removalPolicy: RemovalPolicy.RETAIN,
});
deliveries.grantReadWriteData(reportFunction);
backend.weeklyReport.addEnvironment("REPORT_DELIVERIES_TABLE", deliveries.tableName);
backend.weeklyReport.addEnvironment("REPORT_FROM_EMAIL", sender);
for (const [model, environment] of [
  ["ReportSettings", "REPORT_SETTINGS_TABLE"],
  ["Goal", "REPORT_GOALS_TABLE"],
  ["GoalEntry", "REPORT_ENTRIES_TABLE"],
] as const) {
  const table = backend.data.resources.tables[model];
  table.grantReadData(reportFunction);
  backend.weeklyReport.addEnvironment(environment, table.tableName);
}
reportFunction.addToRolePolicy(new PolicyStatement({
  effect: Effect.ALLOW,
  actions: ["ses:SendEmail"],
  resources: [`arn:${reportStack.partition}:ses:${reportStack.region}:${reportStack.account}:identity/${sender || "unconfigured.invalid"}`],
}));
const failedReports = new Queue(reportStack, "FailedWeeklyReports", { retentionPeriod: Duration.days(14) });
reportFunction.configureAsyncInvoke({
  retryAttempts: 2,
  maxEventAge: Duration.hours(6),
  onFailure: new SqsDestination(failedReports),
});
const schedulerRole = new Role(reportStack, "WeeklyReportSchedulerRole", {
  assumedBy: new ServicePrincipal("scheduler.amazonaws.com"),
});
reportFunction.grantInvoke(schedulerRole);
failedReports.grantSendMessages(schedulerRole);
new CfnSchedule(reportStack, "WeeklyReportSchedule", {
  scheduleExpression: "cron(0 8 ? * MON *)",
  scheduleExpressionTimezone: "America/Denver",
  flexibleTimeWindow: { mode: "OFF" },
  state: sender ? "ENABLED" : "DISABLED",
  target: {
    arn: reportFunction.functionArn,
    roleArn: schedulerRole.roleArn,
    input: JSON.stringify({ scheduledAt: "<aws.scheduler.scheduled-time>" }),
    retryPolicy: { maximumRetryAttempts: 2, maximumEventAgeInSeconds: 3600 },
    deadLetterConfig: { arn: failedReports.queueArn },
  },
});
