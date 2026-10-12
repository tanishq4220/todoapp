import { addDays, format } from "date-fns";
import { describe, expect, it } from "vitest";
import {
  getDailyProgress,
  nextDueDate,
  recommendedTasks,
} from "./productivity";
import { emptyData, validateData } from "./storage";
import type { Task } from "../types";

function makeTask(id: string, overrides: Partial<Task> = {}): Task {
  const timestamp = "2026-06-15T10:00:00.000Z";
  return {
    id,
    title: id,
    description: "",
    dueDate: "",
    dueTime: "",
    originalDueDate: "",
    priority: "medium",
    category: "College",
    customCategory: "",
    status: "todo",
    subtasks: [],
    estimateMinutes: 30,
    tags: [],
    recurrence: "none",
    notes: "",
    link: "",
    projectId: "",
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: "",
    deletedAt: "",
    ...overrides,
  };
}

describe("productivity helpers", () => {
  it("recommends overdue work ahead of lower urgency tasks", () => {
    const now = new Date(2026, 5, 15, 12);
    const overdue = makeTask("overdue", {
      dueDate: format(addDays(now, -1), "yyyy-MM-dd"),
      priority: "low",
    });
    const later = makeTask("later", {
      dueDate: format(addDays(now, 5), "yyyy-MM-dd"),
      priority: "high",
    });

    expect(recommendedTasks([later, overdue], 2, now).map((task) => task.id)).toEqual([
      "overdue",
      "later",
    ]);
  });

  it("keeps completed due-today tasks in the daily progress total", () => {
    const now = new Date(2026, 5, 15, 12);
    const data = emptyData();
    data.tasks = [
      makeTask("lecture", {
        dueDate: format(now, "yyyy-MM-dd"),
        status: "completed",
      }),
    ];
    data.completions = [
      {
        taskId: "lecture",
        title: "lecture",
        date: format(now, "yyyy-MM-dd"),
        estimateMinutes: 30,
      },
    ];

    expect(getDailyProgress(data, now)).toEqual({ done: 1, total: 1, percent: 100 });
  });

  it("creates the next date for recurring tasks", () => {
    expect(nextDueDate(makeTask("repeat", { dueDate: "2026-06-15", recurrence: "weekly" }))).toBe(
      "2026-06-22",
    );
  });
});

describe("backup validation", () => {
  it("accepts an empty backup and rejects malformed task dates", () => {
    expect(validateData(emptyData())).toEqual(emptyData());
    const invalid = emptyData();
    invalid.tasks = [makeTask("bad-date", { dueDate: "2026-02-31" })];

    expect(() => validateData(invalid)).toThrow("valid FocusFlow backup");
  });
});