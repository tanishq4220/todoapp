import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { STORAGE_KEY } from "./lib/storage";

describe("FocusFlow task workflow", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("crypto", { randomUUID: () => "task-test-id" });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("captures, completes, and reloads a task from local storage", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);

    await user.type(screen.getByRole("textbox", { name: "Quick add a task" }), "Read lecture notes");
    await user.keyboard("{Enter}");
    await user.click(screen.getByRole("button", { name: "All Tasks" }));
    await screen.findByRole("button", { name: "Read lecture notes" });
    await user.click(screen.getByRole("button", { name: "Read lecture notes" }));
    await user.selectOptions(
      within(screen.getByRole("form", { name: "Edit task" })).getByLabelText("Priority"),
      "high",
    );
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
      expect(saved.tasks[0].priority).toBe("high");
    });
    await user.click(screen.getByRole("button", { name: "Complete task" }));

    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
      expect(saved.tasks[0].status).toBe("completed");
      expect(saved.completions).toHaveLength(1);
    });

    unmount();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "All Tasks" }));
    await user.selectOptions(screen.getByLabelText("Show"), "completed");
    expect(await screen.findByRole("button", { name: "Read lecture notes" })).toBeTruthy();
  });

  it("creates a project task and records a habit check-in", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Projects" }));
    await user.click(screen.getByRole("button", { name: "New project" }));
    await user.type(screen.getByLabelText("Project name"), "Biology final");
    await user.click(
      within(screen.getByRole("form", { name: "Create project" })).getByRole("button", {
        name: "Create project",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Add task" }));
    await user.type(screen.getByLabelText("Task name"), "Review cell structure");
    await user.click(screen.getByRole("button", { name: "Create task" }));

    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
      expect(saved.tasks[0].projectId).toBe(saved.projects[0].id);
    });

    await user.click(screen.getByRole("button", { name: "Habits" }));
    await user.type(screen.getByRole("textbox", { name: "New habit name" }), "Read for ten minutes");
    await user.keyboard("{Enter}");
    await user.click(screen.getByRole("button", { name: "Mark habit complete today" }));
    expect(await screen.findByText("Checked in today")).toBeTruthy();
  });

  it("starts, pauses, resumes, and resets a focus timer", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Focus Mode" }));
    await user.click(screen.getByRole("button", { name: "Start focus" }));
    expect(screen.getByRole("button", { name: "Pause" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Pause" }));
    const resume = await screen.findByRole("button", { name: /Resume|Start again/ });
    expect(resume).toBeTruthy();
    await user.click(resume);
    expect(screen.getByRole("button", { name: "Pause" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByRole("button", { name: "Start focus" })).toBeTruthy();
  });
});