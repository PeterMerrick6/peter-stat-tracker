import { randomUUID } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DeleteCommand, GetCommand, PutCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { buildWeeklyReport, previousReportWeek } from "../../../src/lib/weeklyReport";
import type { Goal, GoalEntry } from "../../../src/types";

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const email = new SESv2Client({});
type Row = Record<string, unknown>;

async function scan(table: string, owner?: string): Promise<Row[]> {
  const items: Row[] = [];
  let cursor: Record<string, unknown> | undefined;
  do {
    const result = await db.send(new ScanCommand({
      TableName: table, ExclusiveStartKey: cursor,
      ...(owner ? { FilterExpression: "#owner = :owner", ExpressionAttributeNames: { "#owner": "owner" }, ExpressionAttributeValues: { ":owner": owner } } : {}),
    }));
    items.push(...(result.Items ?? []));
    cursor = result.LastEvaluatedKey;
  } while (cursor);
  return items;
}

function goalFromRow(row: Row): Goal {
  return {
    id: String(row.id), title: String(row.title), description: String(row.description ?? ""),
    type: String(row.type ?? "STATUS").toLowerCase() as Goal["type"],
    cadence: String(row.cadence ?? "DAILY").toLowerCase() as Goal["cadence"],
    unit: String(row.unit ?? ""), active: row.active !== false,
    displayOrder: Number(row.displayOrder ?? 0), archivedAt: row.archivedAt ? String(row.archivedAt) : null,
    targetDirection: row.targetDirection === "AT_LEAST" ? "atLeast" : row.targetDirection === "AT_MOST" ? "atMost" : "none",
    minimumThreshold: row.minimumThreshold == null ? null : Number(row.minimumThreshold),
    normalThreshold: row.normalThreshold == null ? null : Number(row.normalThreshold),
    exceedsThreshold: row.exceedsThreshold == null ? null : Number(row.exceedsThreshold),
  };
}

export async function handler(event: { scheduledAt?: string } = {}) {
  const sender = process.env.REPORT_FROM_EMAIL;
  if (!sender) throw new Error("Weekly email sender has not been configured.");
  const now = event.scheduledAt ? new Date(event.scheduledAt) : new Date();
  const week = previousReportWeek(now);
  const settings = await scan(process.env.REPORT_SETTINGS_TABLE!);
  let failures = 0;
  let sent = 0;
  for (const setting of settings) {
    if (!setting.enabled || typeof setting.owner !== "string" || typeof setting.recipientEmail !== "string" || !Array.isArray(setting.goalIds) || !setting.goalIds.length) continue;
    const id = String(setting.id) + ":" + week.start;
    const claimToken = randomUUID();
    let claimed = false;
    let accepted = false;
    try {
      const existing = await db.send(new GetCommand({ TableName: process.env.REPORT_DELIVERIES_TABLE!, Key: { id }, ConsistentRead: true }));
      if (existing.Item?.state === "SENT") continue;
      const timestamp = Math.floor(Date.now() / 1000);
      await db.send(new PutCommand({
        TableName: process.env.REPORT_DELIVERIES_TABLE!,
        Item: { id, claimToken, state: "SENDING", leaseUntil: timestamp + 120, expiresAt: timestamp + 365 * 86400 },
        ConditionExpression: "attribute_not_exists(id) OR (#state <> :sent AND leaseUntil < :now)",
        ExpressionAttributeNames: { "#state": "state" },
        ExpressionAttributeValues: { ":sent": "SENT", ":now": timestamp },
      }));
      claimed = true;
      const [goalRows, entryRows] = await Promise.all([
        scan(process.env.REPORT_GOALS_TABLE!, setting.owner),
        scan(process.env.REPORT_ENTRIES_TABLE!, setting.owner),
      ]);
      // Keep the explicit owner check even if the database scan filter changes later.
      const goals = goalRows.filter((row) => row.owner === setting.owner).map(goalFromRow);
      const entries: GoalEntry[] = entryRows.filter((row) => row.owner === setting.owner).map((row) => ({
        goalId: String(row.goalId), periodDate: String(row.periodDate),
        value: row.value == null ? null : Number(row.value),
        status: row.status ? String(row.status).toLowerCase() as GoalEntry["status"] : null,
      }));
      const report = buildWeeklyReport(goals, entries, setting.goalIds.filter((value): value is string => typeof value === "string"), now);
      if (report.goalCount) {
        await email.send(new SendEmailCommand({
          FromEmailAddress: sender,
          Destination: { ToAddresses: [setting.recipientEmail] },
          Content: { Simple: {
            Subject: { Data: report.subject, Charset: "UTF-8" },
            Body: { Html: { Data: report.html, Charset: "UTF-8" }, Text: { Data: report.text, Charset: "UTF-8" } },
          } },
        }));
        accepted = true;
        sent += 1;
      }
      await db.send(new UpdateCommand({
        TableName: process.env.REPORT_DELIVERIES_TABLE!, Key: { id },
        UpdateExpression: "SET #state = :sent, sentAt = :now",
        ConditionExpression: "claimToken = :token",
        ExpressionAttributeNames: { "#state": "state" },
        ExpressionAttributeValues: { ":sent": "SENT", ":now": new Date().toISOString(), ":token": claimToken },
      }));
    } catch (error) {
      failures += 1;
      // Release failed attempts, but retain claims once SES has accepted the email.
      if (claimed && !accepted) {
        await db.send(new DeleteCommand({
          TableName: process.env.REPORT_DELIVERIES_TABLE!, Key: { id },
          ConditionExpression: "claimToken = :token", ExpressionAttributeValues: { ":token": claimToken },
        })).catch(() => undefined);
      }
      console.error("Weekly report failed", { reportId: setting.id, error: error instanceof Error ? error.name : "Unknown" });
    }
  }
  if (failures) throw new Error(`${failures} weekly reports could not be delivered.`);
  return { sent };
}
