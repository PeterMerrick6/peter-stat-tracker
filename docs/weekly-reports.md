# Weekly Reports

Settings contains a weekly email switch, recipient email, habit checkboxes, and
an HTML preview. Preferences are stored in the owner's Amplify ReportSettings
record. Report choices are independent of the home screen widget.

Reports cover the previous Monday through Sunday. The schedule runs Mondays at
8:00 AM America/Denver, including daylight saving changes. Minimum, normal, and
exceeds count toward completion. Weekly habits count once. Trend metrics such
as weight show measurements and change, and are excluded from completion totals.
Streaks are measured through the end of the reported week.

## Email Setup

1. Choose a sender email address. An existing personal address works.
2. Verify that address in Amazon SES in us-west-2.
3. While SES is in sandbox, verify each recipient address too. For personal
   use, sender and recipient can be the same verified address.
4. Set the Amplify Hosting build environment variable REPORT_FROM_EMAIL to
   the verified sender address and redeploy the backend and frontend.
5. Set the recipient and selected habits in the app and enable weekly emails.

The schedule remains DISABLED when REPORT_FROM_EMAIL is absent. The app displays
that delivery setup is pending while allowing preferences to be saved.
Recipient changes take effect on the next scheduled send. Preview does not send.

## Delivery

The scheduled Lambda reads settings and scans goals/entries filtered by their
exact owner. It also checks ownership before constructing the report. It sends
both inline-styled HTML and plain text via SES. The IAM role has read access only
to the required app tables and send access only to the configured SES identity.

A DynamoDB delivery ledger tracks settings ID plus week. Completed deliveries
are skipped on retry, and a conditional two-minute lease prevents concurrent
sends. Failed sends release their lease. SES acceptance and ledger completion
cannot be a single transaction: a crash between them can rarely produce a
duplicate on retry. The job uses two Lambda retries and sends exhausted failures
to a 14-day SQS failure queue for inspection.

## Checks

Run npm test, npm run build, and npx tsc -p amplify/tsconfig.json --noEmit.
To generate a sample report, bundle and run
scripts/preview-weekly-report.ts with esbuild. Generated previews and screenshots
belong in artifacts/reports (ignored by Git).

AWS references:
- https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html
- https://docs.aws.amazon.com/scheduler/latest/UserGuide/schedule-types.html
