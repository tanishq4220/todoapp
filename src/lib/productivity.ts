import {
  addDays,
  addWeeks,
  format,
  isBefore,
  parseISO,
  startOfDay,
} from "date-fns";
import type { AppData, CompletionRecord, FocusRecord, Task } from "../types";

export const dateKey = (date: Date = new Date()) => format(date, "yyyy-MM-dd");

export function isOpen(task: Task) {
  return task.status !== "completed" && !task.deletedAt;
}

export function isOverdue(task: Task, now = new Date()) {
  return Boolean(
    task.dueDate &&
    isBefore(parseISO(task.dueDate), startOfDay(now)) &&
    isOpen(task),
  );
}

export function dueToday(task: Task, now = new Date()) {
  return Boolean(
    task.dueDate &&
    dateKey(parseISO(task.dueDate)) === dateKey(now) &&
    isOpen(task),
  );
}

export function priorityScore(task: Task, now = new Date()) {
  const priority = { urgent: 320, high: 220, medium: 120, low: 30 }[
    task.priority
  ];
  const deadline = isOverdue(task, now) ? 700 : dueToday(task, now) ? 360 : 0;
  const timeToDeadline =
    task.dueDate && isOpen(task)
      ? parseISO(task.dueDate).getTime() - startOfDay(now).getTime()
      : Infinity;
  const comingSoon =
    timeToDeadline >= 0 && timeToDeadline <= 2 * 86_400_000 ? 160 : 0;
  const progress = task.status === "in-progress" ? 35 : 0;
  const effort =
    task.estimateMinutes > 0 && task.estimateMinutes <= 30 ? 15 : 0;
  return deadline + comingSoon + priority + progress + effort;
}

export function recommendedTasks(tasks: Task[], limit = 3, now = new Date()) {
  return tasks
    .filter(isOpen)
    .sort(
      (a, b) =>
        priorityScore(b, now) - priorityScore(a, now) ||
        a.createdAt.localeCompare(b.createdAt),
    )
    .slice(0, limit);
}

export function weeklyCompletions(
  records: CompletionRecord[],
  now = new Date(),
) {
  return Array.from({ length: 7 }, (_, index) => {
    const day = addDays(startOfDay(now), index - 6);
    const key = dateKey(day);
    return {
      date: key,
      label: format(day, "EEE"),
      count: records.filter((record) => record.date === key).length,
    };
  });
}

export function getDailyProgress(data: AppData, now = new Date()) {
  const key = dateKey(now);
  const plannedIds = data.dailyPlans[key] ?? [];
  const dueIds = data.tasks
    .filter((task) => task.dueDate === key && !task.deletedAt)
    .map((task) => task.id);
  const ids = new Set([...plannedIds, ...dueIds]);
  const doneIds = new Set(
    data.completions
      .filter((record) => record.date === key && ids.has(record.taskId))
      .map((record) => record.taskId),
  );
  const done = doneIds.size;
  return {
    done,
    total: Math.max(ids.size, 0),
    percent: ids.size ? Math.min(100, Math.round((done / ids.size) * 100)) : 0,
  };
}

export function dailyMessage(data: AppData, now = new Date()) {
  const { done, total } = getDailyProgress(data, now);
  if (total > 0 && done === total)
    return "You made room for everything that mattered today.";
  if (done > 0)
    return `Good momentum. ${done} ${done === 1 ? "thing" : "things"} done; keep the next step small.`;
  const overdue = data.tasks.filter((task) => isOverdue(task, now)).length;
  if (overdue)
    return "Start with one overdue item. You do not have to solve the whole week at once.";
  return "Choose one useful next step. The rest can wait its turn.";
}

export function focusMinutes(records: FocusRecord[]) {
  return records.reduce((total, session) => total + session.durationMinutes, 0);
}

export function nextDueDate(task: Task) {
  if (!task.dueDate || task.recurrence === "none") return "";
  const current = parseISO(task.dueDate);
  return format(
    task.recurrence === "daily" ? addDays(current, 1) : addWeeks(current, 1),
    "yyyy-MM-dd",
  );
}
