export type Priority = "urgent" | "high" | "medium" | "low";
export type TaskStatus = "todo" | "in-progress" | "completed";
export type TaskCategory =
  | "College"
  | "Exams"
  | "Projects"
  | "Hackathons"
  | "Internships"
  | "Personal"
  | "Custom";
export type Recurrence = "none" | "daily" | "weekly";

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  dueTime: string;
  originalDueDate: string;
  priority: Priority;
  category: TaskCategory;
  customCategory: string;
  status: TaskStatus;
  subtasks: Subtask[];
  estimateMinutes: number;
  tags: string[];
  recurrence: Recurrence;
  notes: string;
  link: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string;
  deletedAt: string;
}

export interface Project {
  id: string;
  name: string;
  color: string;
  description: string;
  deadline: string;
  createdAt: string;
}

export interface Habit {
  id: string;
  name: string;
  icon: string;
  completedDates: string[];
  createdAt: string;
}

export interface CompletionRecord {
  taskId: string;
  title: string;
  date: string;
  estimateMinutes: number;
}

export interface FocusRecord {
  id: string;
  taskId: string;
  taskTitle: string;
  startedAt: string;
  endedAt: string;
  durationMinutes: number;
}

export interface AppSettings {
  theme: "light" | "dark";
  firstName: string;
  reminderEnabled: boolean;
  reminderMinutes: number;
  reminderSent: string[];
}

export interface AppData {
  version: 1;
  tasks: Task[];
  projects: Project[];
  habits: Habit[];
  completions: CompletionRecord[];
  focusSessions: FocusRecord[];
  dailyPlans: Record<string, string[]>;
  settings: AppSettings;
}

export type Page =
  | "My Day"
  | "Upcoming"
  | "All Tasks"
  | "Projects"
  | "Focus Mode"
  | "Habits"
  | "Statistics"
  | "Recently deleted"
  | "Settings";
