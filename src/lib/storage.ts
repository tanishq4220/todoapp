import type { AppData, Habit, Project, Task } from "../types";
import { format, isValid, parseISO } from "date-fns";

export const STORAGE_KEY = "focusflow:data:v1";

export function emptyData(): AppData {
  return {
    version: 1,
    tasks: [],
    projects: [],
    habits: [],
    completions: [],
    focusSessions: [],
    dailyPlans: {},
    settings: {
      theme: "light",
      firstName: "",
      reminderEnabled: false,
      reminderMinutes: 15,
      reminderSent: [],
    },
  };
}

export function loadData(): AppData {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return emptyData();
  return validateData(JSON.parse(raw));
}

function objectLike(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function validDate(value: string, allowEmpty = false) {
  if (allowEmpty && value === "") return true;
  const parsed = parseISO(value);
  return isValid(parsed) && format(parsed, "yyyy-MM-dd") === value;
}

function validTimestamp(value: string, allowEmpty = false) {
  return (allowEmpty && value === "") || Number.isFinite(Date.parse(value));
}

function validLink(value: string) {
  if (!value) return true;
  try {
    return ["http:", "https:", "mailto:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function validTask(value: unknown): value is Task {
  if (!objectLike(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.description === "string" &&
    typeof value.dueDate === "string" &&
    validDate(value.dueDate, true) &&
    typeof value.dueTime === "string" &&
    (value.dueTime === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(value.dueTime)) &&
    typeof value.originalDueDate === "string" &&
    validDate(value.originalDueDate, true) &&
    ["urgent", "high", "medium", "low"].includes(String(value.priority)) &&
    [
      "College",
      "Exams",
      "Projects",
      "Hackathons",
      "Internships",
      "Personal",
      "Custom",
    ].includes(String(value.category)) &&
    typeof value.customCategory === "string" &&
    ["todo", "in-progress", "completed"].includes(String(value.status)) &&
    Array.isArray(value.subtasks) &&
    value.subtasks.every(
      (item) =>
        objectLike(item) &&
        typeof item.id === "string" &&
        typeof item.title === "string" &&
        typeof item.done === "boolean",
    ) &&
    typeof value.estimateMinutes === "number" &&
    Number.isFinite(value.estimateMinutes) &&
    value.estimateMinutes >= 0 &&
    Array.isArray(value.tags) &&
    value.tags.every((tag) => typeof tag === "string") &&
    ["none", "daily", "weekly"].includes(String(value.recurrence)) &&
    typeof value.notes === "string" &&
    typeof value.link === "string" &&
    validLink(value.link) &&
    typeof value.projectId === "string" &&
    typeof value.createdAt === "string" &&
    validTimestamp(value.createdAt) &&
    typeof value.updatedAt === "string" &&
    validTimestamp(value.updatedAt) &&
    typeof value.completedAt === "string" &&
    validTimestamp(value.completedAt, true) &&
    typeof value.deletedAt === "string"
    && validTimestamp(value.deletedAt, true)
  );
}

function validProject(value: unknown): value is Project {
  return (
    objectLike(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.color === "string" &&
    typeof value.description === "string" &&
    typeof value.deadline === "string" &&
    validDate(value.deadline, true) &&
    typeof value.createdAt === "string"
    && validTimestamp(value.createdAt)
  );
}

function validHabit(value: unknown): value is Habit {
  return (
    objectLike(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.icon === "string" &&
    typeof value.createdAt === "string" &&
    validTimestamp(value.createdAt) &&
    Array.isArray(value.completedDates) &&
    value.completedDates.every((date) => typeof date === "string" && validDate(date))
  );
}

function validCompletion(value: unknown) {
  return (
    objectLike(value) &&
    typeof value.taskId === "string" &&
    typeof value.title === "string" &&
    typeof value.date === "string" &&
    validDate(value.date) &&
    typeof value.estimateMinutes === "number" &&
    Number.isFinite(value.estimateMinutes)
  );
}

function validFocusSession(value: unknown) {
  return (
    objectLike(value) &&
    typeof value.id === "string" &&
    typeof value.taskId === "string" &&
    typeof value.taskTitle === "string" &&
    typeof value.startedAt === "string" &&
    validTimestamp(value.startedAt) &&
    typeof value.endedAt === "string" &&
    validTimestamp(value.endedAt) &&
    typeof value.durationMinutes === "number" &&
    Number.isFinite(value.durationMinutes) &&
    value.durationMinutes >= 0
  );
}

export function validateData(value: unknown): AppData {
  if (
    !objectLike(value) ||
    value.version !== 1 ||
    !Array.isArray(value.tasks) ||
    !value.tasks.every(validTask) ||
    !Array.isArray(value.projects) ||
    !value.projects.every(validProject) ||
    !Array.isArray(value.habits) ||
    !value.habits.every(validHabit) ||
    !Array.isArray(value.completions) ||
    !value.completions.every(validCompletion) ||
    !Array.isArray(value.focusSessions) ||
    !value.focusSessions.every(validFocusSession) ||
    !objectLike(value.dailyPlans) ||
    !Object.values(value.dailyPlans).every(
      (ids) => Array.isArray(ids) && ids.every((id) => typeof id === "string"),
    ) ||
    !Object.keys(value.dailyPlans).every((date) => validDate(date)) ||
    !objectLike(value.settings)
  ) {
    throw new Error("This file is not a valid FocusFlow backup.");
  }
  const settings = value.settings;
  if (settings.theme !== "light" && settings.theme !== "dark")
    throw new Error("The backup has an invalid theme setting.");
  if (
    typeof settings.firstName !== "string" ||
    typeof settings.reminderEnabled !== "boolean" ||
    ![5, 15, 30, 60].includes(Number(settings.reminderMinutes)) ||
    !Array.isArray(settings.reminderSent) ||
    !settings.reminderSent.every((item) => typeof item === "string")
  ) {
    throw new Error("The backup has invalid settings.");
  }
  return value as unknown as AppData;
}
