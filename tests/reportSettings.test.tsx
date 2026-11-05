// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ReportSettingsPanel } from "../src/components/ReportSettingsPanel";
import { createDefaultGoals } from "../src/lib/goals";

afterEach(cleanup);

it("saves the chosen recipient and habits independently of widget selections", async () => {
  const save = vi.fn();
  render(<ReportSettingsPanel goals={createDefaultGoals()} entries={[]} useCloudData={false} onSaveLocal={save} />);
  fireEvent.change(screen.getByLabelText("Recipient email"), { target: { value: "reports@example.com" } });
  fireEvent.click(screen.getByLabelText("Send weekly reports"));
  fireEvent.click(screen.getByLabelText("Flash cards"));
  fireEvent.click(screen.getByRole("button", { name: "Save email settings" }));
  expect(save).toHaveBeenCalledWith({
    enabled: true, recipientEmail: "reports@example.com",
    goalIds: ["goal-calories", "goal-miles", "goal-weight"],
  });
  expect(await screen.findByRole("status")).toBeTruthy();
});

it("allows pausing reports while preserving choices and previews only selected habits", () => {
  const save = vi.fn();
  render(<ReportSettingsPanel goals={createDefaultGoals()} entries={[]} useCloudData={false} onSaveLocal={save} localSettings={{ enabled: true, recipientEmail: "reports@example.com", goalIds: ["goal-miles"] }} />);
  fireEvent.click(screen.getByLabelText("Send weekly reports"));
  fireEvent.click(screen.getByRole("button", { name: "Save email settings" }));
  expect(save.mock.calls[0][0].enabled).toBe(false);
  expect(save.mock.calls[0][0].goalIds).toEqual(["goal-miles"]);
  fireEvent.click(screen.getByRole("button", { name: "Preview report" }));
  const preview = screen.getByTitle("Weekly habit email");
  expect(preview.getAttribute("srcdoc")).toContain("Miles run");
  expect(preview.getAttribute("srcdoc")).not.toContain("Calories");
});
