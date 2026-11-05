import { beforeEach, expect, it, vi } from "vitest";
import { handler } from "../amplify/functions/weekly-report/handler";
const { sendDb, sendEmail } = vi.hoisted(() => ({ sendDb: vi.fn(), sendEmail: vi.fn() }));
vi.mock("@aws-sdk/lib-dynamodb", async (original) => {
  const actual = await original<typeof import("@aws-sdk/lib-dynamodb")>();
  return { ...actual, DynamoDBDocumentClient: { from: () => ({ send: sendDb }) } };
});
vi.mock("@aws-sdk/client-sesv2", async (original) => {
  const actual = await original<typeof import("@aws-sdk/client-sesv2")>();
  return { ...actual, SESv2Client: class { send = sendEmail; } };
});
const owner = "peter::peter";
let delivered = false;
let enabled = true;
let records = true;

beforeEach(() => {
  vi.clearAllMocks();
  delivered = false;
  enabled = true;
  records = true;
  Object.assign(process.env, {
    REPORT_FROM_EMAIL: "sender@example.com", REPORT_SETTINGS_TABLE: "settings",
    REPORT_GOALS_TABLE: "goals", REPORT_ENTRIES_TABLE: "entries", REPORT_DELIVERIES_TABLE: "deliveries",
  });
  sendEmail.mockResolvedValue({ MessageId: "sent" });
  sendDb.mockImplementation(async (command) => {
    if (command.constructor.name === "ScanCommand") {
      if (command.input.TableName === "settings") return { Items: [{ id: "report1", owner, enabled, recipientEmail: "recipient@example.com", goalIds: ["goal1", "other-goal"] }] };
      if (command.input.TableName === "goals") return { Items: records ? [
        { id: "goal1", owner, title: "My habit", type: "STATUS", cadence: "DAILY" },
        { id: "other-goal", owner: "another-user", title: "Private other habit", type: "STATUS", cadence: "DAILY" },
      ] : [] };
      return { Items: [] };
    }
    if (command.constructor.name === "GetCommand") return { Item: delivered ? { state: "SENT" } : undefined };
    if (command.constructor.name === "UpdateCommand") delivered = true;
    return {};
  });
});

it("sends only the configured owner's selected habits and skips repeat delivery", async () => {
  await handler({ scheduledAt: "2026-11-09T15:00:00Z" });
  expect(sendEmail).toHaveBeenCalledTimes(1);
  const payload = sendEmail.mock.calls[0][0].input;
  expect(payload.Destination.ToAddresses).toEqual(["recipient@example.com"]);
  expect(payload.Content.Simple.Body.Html.Data).toContain("My habit");
  expect(payload.Content.Simple.Body.Html.Data).not.toContain("Private other habit");
  const scans = sendDb.mock.calls.map(([command]) => command.input).filter((input) => input.FilterExpression);
  expect(scans.every((input) => input.ExpressionAttributeValues[":owner"] === owner)).toBe(true);
  await handler({ scheduledAt: "2026-11-09T15:00:00Z" });
  expect(sendEmail).toHaveBeenCalledTimes(1);
});

it("sends nothing when paused or all selected habits are removed", async () => {
  enabled = false;
  await handler({ scheduledAt: "2026-11-09T15:00:00Z" });
  enabled = true;
  records = false;
  await handler({ scheduledAt: "2026-11-09T15:00:00Z" });
  expect(sendEmail).not.toHaveBeenCalled();
});

it("releases failed email attempts so a retry can deliver", async () => {
  sendEmail.mockRejectedValueOnce(new Error("SES unavailable"));
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  await expect(handler({ scheduledAt: "2026-11-09T15:00:00Z" })).rejects.toThrow("could not be delivered");
  expect(sendDb.mock.calls.some(([command]) => command.constructor.name === "DeleteCommand")).toBe(true);
  await handler({ scheduledAt: "2026-11-09T15:00:00Z" });
  expect(sendEmail).toHaveBeenCalledTimes(2);
  log.mockRestore();
});

it("refuses to send without a configured sender", async () => {
  delete process.env.REPORT_FROM_EMAIL;
  await expect(handler()).rejects.toThrow("sender has not been configured");
  expect(sendEmail).not.toHaveBeenCalled();
});
