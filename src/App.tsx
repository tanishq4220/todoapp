import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
  addMonths,
} from "date-fns";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  Flame,
  Focus,
  FolderKanban,
  Heart,
  Home,
  ListChecks,
  Menu,
  Moon,
  Pause,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Plus,
  Search,
  Settings as SettingsIcon,
  SkipForward,
  Sparkles,
  Sun,
  Target,
  Trash2,
  TrendingUp,
  Upload,
  X,
} from "lucide-react";
import {
  dateKey,
  dailyMessage,
  dueToday,
  focusMinutes,
  getDailyProgress,
  isOpen,
  isOverdue,
  nextDueDate,
  recommendedTasks,
  weeklyCompletions,
} from "./lib/productivity";
import { emptyData, loadData, STORAGE_KEY, validateData } from "./lib/storage";
import type {
  AppData,
  CompletionRecord,
  FocusRecord,
  Habit,
  Page,
  Project,
  Task,
} from "./types";
import TaskDialog, { type TaskDraft } from "./components/TaskDialog";
import TaskItem from "./components/TaskItem";

const pages: { name: Page; icon: typeof Home }[] = [
  { name: "My Day", icon: Home },
  { name: "Upcoming", icon: CalendarDays },
  { name: "All Tasks", icon: ListChecks },
  { name: "Projects", icon: FolderKanban },
  { name: "Focus Mode", icon: Focus },
  { name: "Habits", icon: Heart },
  { name: "Statistics", icon: TrendingUp },
];

const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
const colors = [
  "#527765",
  "#c5795d",
  "#6783a1",
  "#a88759",
  "#788a56",
  "#8175a2",
];
const CompletionChart = lazy(() => import("./components/CompletionChart"));

function createId() {
  return crypto.randomUUID();
}

function useInitialData() {
  const [initial] = useState(() => {
    try {
      return { data: loadData(), issue: "" };
    } catch {
      return {
        data: emptyData(),
        issue:
          "Saved data could not be read. A fresh workspace is open; your original browser data has not been changed.",
      };
    }
  });
  return initial;
}

function App() {
  const initial = useInitialData();
  const [data, setData] = useState<AppData>(initial.data);
  const [storageIssue, setStorageIssue] = useState(initial.issue);
  const [page, setPage] = useState<Page>("My Day");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("open");
  const [sortBy, setSortBy] = useState("smart");
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [defaultProjectId, setDefaultProjectId] = useState("");
  const [defaultDueDate, setDefaultDueDate] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [toast, setToast] = useState("");
  const [permission, setPermission] = useState(
    typeof Notification === "undefined"
      ? "unsupported"
      : Notification.permission,
  );
  const [projectFormOpen, setProjectFormOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDeadline, setProjectDeadline] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectColor, setProjectColor] = useState(colors[0]);
  const [habitName, setHabitName] = useState("");
  const [focusTaskId, setFocusTaskId] = useState("");
  const [timer, setTimer] = useState({
    remaining: 25 * 60,
    running: false,
    deadline: 0,
    segmentStart: "",
    title: "",
    taskId: "",
  });

  useEffect(() => {
    if (data === initial.data) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      setStorageIssue("");
    } catch {
      setStorageIssue(
        "Your browser could not save changes. Export a backup before closing this tab.",
      );
    }
  }, [data]);

  useEffect(() => {
    document.documentElement.dataset.theme = data.settings.theme;
  }, [data.settings.theme]);

  useEffect(() => {
    function handleSearchShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleSearchShortcut);
    return () => window.removeEventListener("keydown", handleSearchShortcut);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (!timer.running) return;
    const interval = window.setInterval(() => {
      const remaining = Math.max(
        0,
        Math.ceil((timer.deadline - Date.now()) / 1000),
      );
      setTimer((current) => ({ ...current, remaining }));
      if (remaining === 0) {
        setTimer((current) => ({
          ...current,
          running: false,
          remaining: 0,
          deadline: 0,
          segmentStart: "",
        }));
        const durationMinutes = Math.max(
          1,
          Math.round(
            (Date.now() - new Date(timer.segmentStart).getTime()) / 60_000,
          ),
        );
        const record: FocusRecord = {
          id: createId(),
          taskId: timer.taskId,
          taskTitle: timer.title,
          startedAt: timer.segmentStart,
          endedAt: new Date().toISOString(),
          durationMinutes,
        };
        setData((current) => ({
          ...current,
          focusSessions: [...current.focusSessions, record],
        }));
        setToast("Focus session complete. Take a breather.");
      }
    }, 500);
    return () => window.clearInterval(interval);
  }, [
    timer.running,
    timer.deadline,
    timer.segmentStart,
    timer.taskId,
    timer.title,
  ]);

  useEffect(() => {
    if (
      !data.settings.reminderEnabled ||
      typeof Notification === "undefined" ||
      Notification.permission !== "granted"
    )
      return;
    const checkReminders = () => {
      const now = new Date();
      const due = data.tasks.filter((task) => isOpen(task) && task.dueDate);
      for (const task of due) {
        const target = new Date(
          `${task.dueDate}T${task.dueTime || "09:00"}:00`,
        );
        const notifyAt =
          target.getTime() - data.settings.reminderMinutes * 60_000;
        const reminderKey = `${task.id}:${task.dueDate}:${task.dueTime}`;
        if (
          now.getTime() >= notifyAt &&
          now.getTime() < target.getTime() + 60_000 &&
          !data.settings.reminderSent.includes(reminderKey)
        ) {
          new Notification("FocusFlow reminder", {
            body: task.title,
            tag: reminderKey,
          });
          setData((current) => ({
            ...current,
            settings: {
              ...current.settings,
              reminderSent: [...current.settings.reminderSent, reminderKey],
            },
          }));
        }
      }
    };
    checkReminders();
    const interval = window.setInterval(checkReminders, 60_000);
    return () => window.clearInterval(interval);
  }, [
    data.settings.reminderEnabled,
    data.settings.reminderMinutes,
    data.settings.reminderSent,
    data.tasks,
  ]);

  const activeTasks = data.tasks.filter(isOpen);
  const calendarTasks = data.tasks.filter((task) => !task.deletedAt && task.dueDate);
  const today = dateKey();
  const plannedIds = data.dailyPlans[today] ?? [];
  const dailyProgress = getDailyProgress(data);
  const topTasks = plannedIds
    .map((id) => data.tasks.find((task) => task.id === id))
    .filter((task): task is Task => Boolean(task && isOpen(task)));
  const overdueTasks = activeTasks.filter((task) => isOverdue(task));
  const todayTasks = activeTasks.filter((task) => dueToday(task));
  const suggestions = recommendedTasks(activeTasks);
  const week = weeklyCompletions(data.completions);
  const weekCount = week.reduce((sum, day) => sum + day.count, 0);
  const focusTotal = focusMinutes(data.focusSessions);
  const trackedTasks = data.tasks.filter((task) => !task.deletedAt);
  const completedTaskCount = trackedTasks.filter(
    (task) => task.status === "completed",
  ).length;
  const completionRate = trackedTasks.length
    ? Math.round((completedTaskCount / trackedTasks.length) * 100)
    : 0;
  const pageTasks = useMemo(() => {
    let list = data.tasks.filter((task) =>
      page === "Recently deleted" ? Boolean(task.deletedAt) : !task.deletedAt,
    );
    if (page === "All Tasks") {
      if (statusFilter === "open")
        list = list.filter((task) => task.status !== "completed");
      if (statusFilter === "completed")
        list = list.filter((task) => task.status === "completed");
      if (priorityFilter !== "all")
        list = list.filter((task) => task.priority === priorityFilter);
    }
    if (search.trim()) {
      const query = search.toLowerCase();
      list = list.filter((task) =>
        [task.title, task.description, task.notes, ...task.tags]
          .join(" ")
          .toLowerCase()
          .includes(query),
      );
    }
    if (sortBy === "date")
      list = [...list].sort((a, b) =>
        (a.dueDate || "9999").localeCompare(b.dueDate || "9999"),
      );
    if (sortBy === "priority")
      list = [...list].sort(
        (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority],
      );
    if (sortBy === "created")
      list = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (sortBy === "smart")
      list = [...list].sort(
        (a, b) =>
          Number(isOverdue(b)) - Number(isOverdue(a)) ||
          priorityOrder[a.priority] - priorityOrder[b.priority] ||
          (a.dueDate || "9999").localeCompare(b.dueDate || "9999"),
      );
    return list;
  }, [data.tasks, page, priorityFilter, statusFilter, search, sortBy]);

  function updateTask(taskId: string, transform: (task: Task) => Task) {
    setData((current) => ({
      ...current,
      tasks: current.tasks.map((task) =>
        task.id === taskId ? transform(task) : task,
      ),
    }));
  }

  function saveTask(draft: TaskDraft) {
    const now = new Date().toISOString();
    if (editingTask) {
      const completedNow =
        draft.status === "completed" && editingTask.status !== "completed";
      const updated: Task = {
        ...editingTask,
        ...draft,
        updatedAt: now,
        completedAt:
          draft.status === "completed" ? editingTask.completedAt || now : "",
      };
      setData((current) => ({
        ...current,
        tasks: current.tasks.map((task) =>
          task.id === editingTask.id ? updated : task,
        ),
        completions: completedNow
          ? [
              ...current.completions,
              {
                taskId: updated.id,
                title: updated.title,
                date: today,
                estimateMinutes: updated.estimateMinutes,
              },
            ]
          : current.completions,
      }));
    } else {
      const task: Task = {
        ...draft,
        id: createId(),
        createdAt: now,
        updatedAt: now,
        completedAt: draft.status === "completed" ? now : "",
        deletedAt: "",
        projectId: draft.projectId || defaultProjectId,
      };
      setData((current) => ({
        ...current,
        tasks: [...current.tasks, task],
        completions:
          task.status === "completed"
            ? [
                ...current.completions,
                {
                  taskId: task.id,
                  title: task.title,
                  date: today,
                  estimateMinutes: task.estimateMinutes,
                },
              ]
            : current.completions,
      }));
    }
    setTaskDialogOpen(false);
    setEditingTask(null);
    setDefaultProjectId("");
    setToast(editingTask ? "Task updated." : "Task added.");
  }

  function toggleTask(task: Task) {
    if (task.status === "completed") {
      updateTask(task.id, (current) => ({
        ...current,
        status: "todo",
        completedAt: "",
        updatedAt: new Date().toISOString(),
      }));
      return;
    }
    const now = new Date().toISOString();
    const completed: Task = {
      ...task,
      status: "completed",
      completedAt: now,
      updatedAt: now,
    };
    const nextDate = nextDueDate(task);
    const nextTask = nextDate
      ? {
          ...task,
          id: createId(),
          status: "todo" as const,
          dueDate: nextDate,
          originalDueDate: task.originalDueDate || task.dueDate,
          createdAt: now,
          updatedAt: now,
          completedAt: "",
          deletedAt: "",
        }
      : null;
    const record: CompletionRecord = {
      taskId: task.id,
      title: task.title,
      date: today,
      estimateMinutes: task.estimateMinutes,
    };
    setData((current) => ({
      ...current,
      tasks: [
        ...current.tasks.map((item) =>
          item.id === task.id ? completed : item,
        ),
        ...(nextTask ? [nextTask] : []),
      ],
      completions: [...current.completions, record],
    }));
    setToast(
      nextTask
        ? `Completed. Next repeat added for ${format(parseISO(nextDate), "MMM d")}.`
        : "Nice work. One less thing to carry.",
    );
  }

  function duplicateTask(task: Task) {
    const now = new Date().toISOString();
    const copy: Task = {
      ...task,
      id: createId(),
      title: `${task.title} (copy)`,
      status: "todo",
      createdAt: now,
      updatedAt: now,
      completedAt: "",
      deletedAt: "",
    };
    setData((current) => ({ ...current, tasks: [...current.tasks, copy] }));
    setToast("Task duplicated.");
  }

  function postponeTask(task: Task) {
    const start = task.dueDate ? parseISO(task.dueDate) : new Date();
    const movedDate = format(addDays(start, 1), "yyyy-MM-dd");
    updateTask(task.id, (current) => ({
      ...current,
      originalDueDate: current.originalDueDate || current.dueDate,
      dueDate: movedDate,
      updatedAt: new Date().toISOString(),
    }));
    setToast(`Carried forward to ${format(parseISO(movedDate), "MMM d")}.`);
  }

  function removeTask(taskId: string) {
    updateTask(taskId, (task) => ({
      ...task,
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    setToast("Moved to recently deleted.");
  }

  function restoreTask(taskId: string) {
    updateTask(taskId, (task) => ({
      ...task,
      deletedAt: "",
      updatedAt: new Date().toISOString(),
    }));
    setToast("Task restored.");
  }

  function toggleSubtask(task: Task, subtaskId: string) {
    updateTask(task.id, (current) => ({
      ...current,
      updatedAt: new Date().toISOString(),
      subtasks: current.subtasks.map((item) =>
        item.id === subtaskId ? { ...item, done: !item.done } : item,
      ),
    }));
  }

  function togglePlan(task: Task) {
    setData((current) => {
      const selected = current.dailyPlans[today] ?? [];
      if (selected.includes(task.id))
        return {
          ...current,
          dailyPlans: {
            ...current.dailyPlans,
            [today]: selected.filter((id) => id !== task.id),
          },
        };
      if (selected.length >= 3) {
        setToast(
          "Your daily top three are full. Remove one before adding another.",
        );
        return current;
      }
      setToast("Added to your top three.");
      return {
        ...current,
        dailyPlans: { ...current.dailyPlans, [today]: [...selected, task.id] },
      };
    });
  }

  function addQuickTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const input = new FormData(form).get("quick-task")?.toString().trim();
    if (!input) return;
    const now = new Date().toISOString();
    const task: Task = {
      id: createId(),
      title: input,
      description: "",
      dueDate: "",
      dueTime: "",
      originalDueDate: "",
      priority: "medium",
      category: "College",
      customCategory: "",
      status: "todo",
      subtasks: [],
      estimateMinutes: 25,
      tags: [],
      recurrence: "none",
      notes: "",
      link: "",
      projectId: "",
      createdAt: now,
      updatedAt: now,
      completedAt: "",
      deletedAt: "",
    };
    setData((current) => ({ ...current, tasks: [...current.tasks, task] }));
    form.reset();
    setToast("Captured. You can add details whenever you’re ready.");
  }

  function addProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!projectName.trim()) return;
    const project: Project = {
      id: createId(),
      name: projectName.trim(),
      color: projectColor,
      deadline: projectDeadline,
      description: projectDescription.trim(),
      createdAt: new Date().toISOString(),
    };
    setData((current) => ({
      ...current,
      projects: [...current.projects, project],
    }));
    setProjectName("");
    setProjectDeadline("");
    setProjectDescription("");
    setProjectFormOpen(false);
    setToast("Project created.");
  }

  function addHabit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!habitName.trim()) return;
    const habit: Habit = {
      id: createId(),
      name: habitName.trim(),
      icon: "✳",
      completedDates: [],
      createdAt: new Date().toISOString(),
    };
    setData((current) => ({ ...current, habits: [...current.habits, habit] }));
    setHabitName("");
  }

  function toggleHabit(habit: Habit) {
    setData((current) => ({
      ...current,
      habits: current.habits.map((item) =>
        item.id !== habit.id
          ? item
          : {
              ...item,
              completedDates: item.completedDates.includes(today)
                ? item.completedDates.filter((date) => date !== today)
                : [...item.completedDates, today],
            },
      ),
    }));
  }

  function startTimer() {
    const task = data.tasks.find(
      (item) => item.id === focusTaskId && isOpen(item),
    );
    if (timer.remaining === 0)
      setTimer({
        remaining: 25 * 60,
        running: true,
        deadline: Date.now() + 25 * 60_000,
        segmentStart: new Date().toISOString(),
        title: task?.title || "Open focus session",
        taskId: task?.id || "",
      });
    else if (!timer.running)
      setTimer((current) => ({
        ...current,
        running: true,
        deadline: Date.now() + current.remaining * 1000,
        segmentStart: new Date().toISOString(),
        title: current.title || task?.title || "Open focus session",
        taskId: current.taskId || task?.id || "",
      }));
  }

  function saveCurrentFocusSegment() {
    if (!timer.running || !timer.segmentStart) return;
    const now = new Date();
    const durationMinutes = Math.round(
      (now.getTime() - new Date(timer.segmentStart).getTime()) / 60_000,
    );
    if (durationMinutes < 1) return;
    const record: FocusRecord = {
      id: createId(),
      taskId: timer.taskId,
      taskTitle: timer.title,
      startedAt: timer.segmentStart,
      endedAt: now.toISOString(),
      durationMinutes,
    };
    setData((current) => ({
      ...current,
      focusSessions: [...current.focusSessions, record],
    }));
  }

  function pauseTimer() {
    saveCurrentFocusSegment();
    setTimer((current) => ({
      ...current,
      remaining: Math.max(0, Math.ceil((current.deadline - Date.now()) / 1000)),
      running: false,
      deadline: 0,
      segmentStart: "",
    }));
  }

  function resetTimer() {
    saveCurrentFocusSegment();
    setTimer({
      remaining: 25 * 60,
      running: false,
      deadline: 0,
      segmentStart: "",
      title: "",
      taskId: "",
    });
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `focusflow-backup-${today}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setToast("Backup downloaded.");
  }

  function importBackup(file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = validateData(JSON.parse(String(reader.result)));
        setData(imported);
        setToast("Backup restored successfully.");
      } catch (error) {
        setToast(
          error instanceof Error
            ? error.message
            : "Could not read this backup.",
        );
      }
    };
    reader.onerror = () => setToast("Could not read this file.");
    reader.readAsText(file);
  }

  async function configureReminders() {
    if (typeof Notification === "undefined") {
      setPermission("unsupported");
      setToast("Browser notifications are not supported here.");
      return;
    }
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") {
      setData((current) => ({
        ...current,
        settings: { ...current.settings, reminderEnabled: true },
      }));
      setToast("Reminders are enabled for upcoming task deadlines.");
    } else {
      setData((current) => ({
        ...current,
        settings: { ...current.settings, reminderEnabled: false },
      }));
      setToast(
        result === "denied"
          ? "Notifications were denied. You can change that in browser settings."
          : "Notification permission was not granted.",
      );
    }
  }

  function renderTask(
    task: Task,
    options: { plan?: boolean; restore?: boolean } = {},
  ) {
    const projectName = data.projects.find(
      (project) => project.id === task.projectId,
    )?.name;
    const actualMinutes = data.focusSessions
      .filter((session) => session.taskId === task.id)
      .reduce((total, session) => total + session.durationMinutes, 0);
    return (
      <TaskItem
        key={task.id}
        task={task}
        projectName={projectName}
        actualMinutes={actualMinutes}
        planned={plannedIds.includes(task.id)}
        showPlan={options.plan}
        onToggle={() => toggleTask(task)}
        onEdit={() => {
          setEditingTask(task);
          setTaskDialogOpen(true);
        }}
        onDuplicate={() => duplicateTask(task)}
        onDelete={() => removeTask(task.id)}
        onPostpone={() => postponeTask(task)}
        onRestore={options.restore ? () => restoreTask(task.id) : undefined}
        onDeleteForever={
          options.restore
            ? () => {
                setData((current) => ({
                  ...current,
                  tasks: current.tasks.filter((item) => item.id !== task.id),
                }));
              }
            : undefined
        }
        onPlan={() => togglePlan(task)}
        onToggleSubtask={(id) => toggleSubtask(task, id)}
      />
    );
  }

  const openTaskDialog = (projectId = "", dueDate = "") => {
    setEditingTask(null);
    setDefaultProjectId(projectId);
    setDefaultDueDate(dueDate);
    setTaskDialogOpen(true);
  };
  const titleForPage = page === "My Day" ? "My Day" : page;
  const dateHeading = format(new Date(), "EEEE, MMMM d");
  const filteredOpen = activeTasks.filter(
    (task) =>
      !search ||
      [task.title, task.description, ...task.tags]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const upcomingTasks = filteredOpen
    .filter((task) => task.dueDate && !isOverdue(task))
    .sort(
      (a, b) =>
        a.dueDate.localeCompare(b.dueDate) ||
        (a.dueTime || "").localeCompare(b.dueTime || ""),
    );
  const calendarStart = startOfWeek(startOfMonth(calendarMonth), {
    weekStartsOn: 1,
  });
  const calendarEnd = endOfWeek(endOfMonth(calendarMonth), { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd,
  });

  return (
    <div className="app-shell">
      <aside
        className={`sidebar ${sidebarCollapsed ? "sidebar-collapsed" : ""} ${mobileNavOpen ? "mobile-open" : ""}`}
      >
        <div className="brand-row">
          <div className="brand-mark">
            <Activity size={19} strokeWidth={2.5} />
          </div>
          {!sidebarCollapsed && (
            <span className="brand-name">
              focusflow<span>.</span>
            </span>
          )}
          <button
            className="icon-button mobile-close"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>
        <div className="workspace-picker" role="group" aria-label="Personal workspace">
          <span className="workspace-avatar">
            {data.settings.firstName.trim().charAt(0).toUpperCase() || "F"}
          </span>
          {!sidebarCollapsed && (
            <>
              <span className="workspace-name">
                {data.settings.firstName
                  ? `${data.settings.firstName}’s space`
                  : "My workspace"}
              </span>
            </>
          )}
        </div>
        <nav className="primary-nav" aria-label="Main navigation">
          {pages.map(({ name, icon: Icon }) => (
            <button
              className={`nav-item ${page === name ? "nav-active" : ""}`}
              key={name}
              onClick={() => {
                setPage(name);
                setMobileNavOpen(false);
              }}
              title={sidebarCollapsed ? name : undefined}
            >
              <Icon size={17} />
              <span>{name}</span>
              {name === "My Day" && overdueTasks.length > 0 && (
                <b className="nav-count">{overdueTasks.length}</b>
              )}
            </button>
          ))}
        </nav>
        {!sidebarCollapsed && (
          <>
            <div className="sidebar-section-title">
              <span>YOUR PROJECTS</span>
              <button
                className="tiny-icon"
                onClick={() => setProjectFormOpen(true)}
                aria-label="Create project"
                title="Create project"
              >
                <Plus size={15} />
              </button>
            </div>
            <div className="project-nav">
              {data.projects.map((project) => (
                <button
                  className="project-nav-item"
                  key={project.id}
                  onClick={() => {
                    setPage("Projects");
                    setMobileNavOpen(false);
                  }}
                >
                  <i style={{ backgroundColor: project.color }} />
                  {project.name}
                </button>
              ))}
              {data.projects.length === 0 && (
                <span className="side-empty">No projects yet</span>
              )}
            </div>
          </>
        )}
        <div className="sidebar-spacer" />
        <button
          className={`nav-item ${page === "Recently deleted" ? "nav-active" : ""}`}
          onClick={() => {
            setPage("Recently deleted");
            setMobileNavOpen(false);
          }}
          title={sidebarCollapsed ? "Recently deleted" : undefined}
        >
          <Trash2 size={17} />
          <span>Recently deleted</span>
        </button>
        <button
          className={`nav-item ${page === "Settings" ? "nav-active" : ""}`}
          onClick={() => {
            setPage("Settings");
            setMobileNavOpen(false);
          }}
          title={sidebarCollapsed ? "Settings" : undefined}
        >
          <SettingsIcon size={17} />
          <span>Settings</span>
        </button>
        <div className="sidebar-profile">
          <div className="profile-avatar">
            {data.settings.firstName.trim().charAt(0).toUpperCase() || "S"}
          </div>
          {!sidebarCollapsed && (
            <div>
              <strong>{data.settings.firstName || "Student"}</strong>
              <span>Local workspace</span>
            </div>
          )}
          <button
            className="tiny-icon sidebar-collapse"
            onClick={() => setSidebarCollapsed((value) => !value)}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
        </div>
      </aside>
      {mobileNavOpen && (
        <button
          className="mobile-scrim"
          aria-label="Close navigation"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <main className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={19} />
            </button>
            <div className="breadcrumb">
              <span>Workspace</span>
              <ChevronRight size={14} />
              <strong>{titleForPage}</strong>
            </div>
          </div>
          <div className="topbar-actions">
            <label className="search-box">
              <Search size={16} />
              <input
                ref={searchInputRef}
                aria-label="Search tasks"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search anything…"
              />
              <kbd>⌘ K</kbd>
            </label>
            <button
              className="button button-primary top-add"
              onClick={() => openTaskDialog()}
            >
              <Plus size={16} />
              <span>New task</span>
            </button>
            <button
              className="icon-button theme-switch"
              onClick={() =>
                setData((current) => ({
                  ...current,
                  settings: {
                    ...current.settings,
                    theme:
                      current.settings.theme === "light" ? "dark" : "light",
                  },
                }))
              }
              aria-label="Toggle color theme"
              title="Toggle theme"
            >
              {data.settings.theme === "light" ? (
                <Moon size={17} />
              ) : (
                <Sun size={17} />
              )}
            </button>
          </div>
        </header>
        {storageIssue && (
          <div className="storage-warning">
            <CircleHelp size={15} />
            {storageIssue}
          </div>
        )}

        <div className="page-content">
          {page === "My Day" && (
            <>
              <section className="welcome-row">
                <div>
                  <span className="eyebrow">{dateHeading.toUpperCase()}</span>
                  <h1>
                    {data.settings.firstName
                      ? `Good ${new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, ${data.settings.firstName}.`
                      : "Make today count."}
                  </h1>
                  <p>{dailyMessage(data)}</p>
                </div>
                <div className="today-stamp">
                  <span>{format(new Date(), "MMM")}</span>
                  <strong>{format(new Date(), "dd")}</strong>
                  <small>{format(new Date(), "EEE")}</small>
                </div>
              </section>
              <form className="quick-add" onSubmit={addQuickTask}>
                <Plus size={19} />
                <input
                  name="quick-task"
                  aria-label="Quick add a task"
                  placeholder="Capture a task… (press Enter)"
                  maxLength={120}
                />
                <span>QUICK CAPTURE</span>
                <button type="submit" aria-label="Add task">
                  <ArrowUp size={17} />
                </button>
              </form>
              <div className="overview-grid">
                <div className="overview-main">
                  <section className="section-block">
                    <div className="section-heading">
                      <div>
                        <span className="section-kicker">YOUR FOCUS</span>
                        <h2>Top three</h2>
                      </div>
                      <span className="section-count">
                        {topTasks.length} / 3 chosen
                      </span>
                    </div>
                    {topTasks.length ? (
                      <div className="task-stack">
                        {topTasks.map((task) => renderTask(task))}
                      </div>
                    ) : (
                      <div className="empty-inline">
                        <Target size={19} />
                        <div>
                          <strong>Pick what matters most</strong>
                          <span>
                            Add up to three tasks from your day below.
                          </span>
                        </div>
                      </div>
                    )}
                    {topTasks.length < 3 &&
                      [...todayTasks, ...suggestions]
                        .filter(
                          (task, index, list) =>
                            !plannedIds.includes(task.id) &&
                            list.findIndex((item) => item.id === task.id) ===
                              index,
                        )
                        .slice(0, 3 - topTasks.length)
                        .map((task) => (
                          <div className="suggestion-row" key={task.id}>
                            <div className="suggestion-mark">
                              <Sparkles size={14} />
                            </div>
                            <div className="suggestion-copy">
                              <strong>{task.title}</strong>
                              <span>
                                {isOverdue(task) ? "Overdue" : "Suggested next"}
                              </span>
                            </div>
                            <button
                              className="small-outline"
                              onClick={() => togglePlan(task)}
                            >
                              <Plus size={14} />
                              Plan
                            </button>
                          </div>
                        ))}
                  </section>
                  <section className="section-block today-list-section">
                    <div className="section-heading">
                      <div>
                        <span className="section-kicker">ON THE RADAR</span>
                        <h2>Today & overdue</h2>
                      </div>
                      <span className="section-count">
                        {todayTasks.length + overdueTasks.length} tasks
                      </span>
                    </div>
                    {overdueTasks.length + todayTasks.length ? (
                      <div className="task-stack">
                        {[
                          ...overdueTasks,
                          ...todayTasks.filter(
                            (task) =>
                              !overdueTasks.some((item) => item.id === task.id),
                          ),
                        ].map((task) => renderTask(task, { plan: true }))}
                      </div>
                    ) : (
                      <div className="empty-inline">
                        <CheckCircle2 size={19} />
                        <div>
                          <strong>Clear skies for today</strong>
                          <span>Add a task or take the breathing room.</span>
                        </div>
                      </div>
                    )}
                  </section>
                </div>
                <aside className="overview-aside">
                  <section className="progress-panel">
                    <div className="section-heading">
                      <div>
                        <span className="section-kicker">DAILY PROGRESS</span>
                        <h2>A little at a time</h2>
                      </div>
                      <span className="progress-percent">
                        {dailyProgress.percent}%
                      </span>
                    </div>
                    <div className="progress-track">
                      <span style={{ width: `${dailyProgress.percent}%` }} />
                    </div>
                    <p>
                      {dailyProgress.total
                        ? `${dailyProgress.done} of ${dailyProgress.total} planned tasks complete`
                        : "Your progress starts with a plan."}
                    </p>
                    <div className="progress-foot">
                      <span>
                        <CheckCircle2 size={14} />
                        {
                          data.completions.filter((item) => item.date === today)
                            .length
                        }{" "}
                        done today
                      </span>
                      <span>
                        <Clock3 size={14} />
                        {focusMinutes(
                          data.focusSessions.filter(
                            (session) =>
                              session.startedAt.slice(0, 10) === today,
                          ),
                        )}{" "}
                        min focused
                      </span>
                    </div>
                  </section>
                  <section className="aside-section">
                    <div className="section-heading compact">
                      <div>
                        <span className="section-kicker">SMART NEXT STEP</span>
                        <h2>Worth your attention</h2>
                      </div>
                      <Sparkles size={16} className="muted-icon" />
                    </div>
                    {suggestions.slice(0, 3).map((task, index) => (
                      <button
                        className="recommendation"
                        key={task.id}
                        onClick={() => {
                          setEditingTask(task);
                          setTaskDialogOpen(true);
                        }}
                      >
                        <span className="recommendation-rank">
                          0{index + 1}
                        </span>
                        <span className="recommendation-text">
                          <strong>{task.title}</strong>
                          <small>
                            {isOverdue(task)
                              ? "Past its deadline"
                              : task.dueDate
                                ? `Due ${format(parseISO(task.dueDate), "MMM d")}`
                                : `${task.estimateMinutes || 25} minute task`}
                          </small>
                        </span>
                        <ArrowUp size={15} />
                      </button>
                    ))}
                    {suggestions.length === 0 && (
                      <p className="aside-empty">
                        A clear list. Take a moment to reset or capture what’s
                        next.
                      </p>
                    )}
                  </section>
                  <section className="aside-section schedule-panel">
                    <div className="section-heading compact">
                      <div>
                        <span className="section-kicker">UP NEXT</span>
                        <h2>Coming deadlines</h2>
                      </div>
                      <button
                        className="text-button"
                        onClick={() => setPage("Upcoming")}
                      >
                        View all <ArrowUp size={13} />
                      </button>
                    </div>
                    {upcomingTasks.slice(0, 4).map((task) => (
                      <div className="deadline-row" key={task.id}>
                        <div className="deadline-date">
                          <strong>
                            {format(parseISO(task.dueDate), "dd")}
                          </strong>
                          <span>{format(parseISO(task.dueDate), "MMM")}</span>
                        </div>
                        <div className="deadline-info">
                          <strong>{task.title}</strong>
                          <span>{task.dueTime || task.category}</span>
                        </div>
                        <i className={`deadline-dot dot-${task.priority}`} />
                      </div>
                    ))}
                    {upcomingTasks.length === 0 && (
                      <p className="aside-empty">No deadlines scheduled yet.</p>
                    )}
                  </section>
                  <section className="focus-mini">
                    <div className="focus-mini-icon">
                      <Focus size={16} />
                    </div>
                    <div>
                      <span className="section-kicker">STUDY SESSION</span>
                      <strong>
                        {timer.running
                          ? timer.title
                          : timer.remaining < 25 * 60 && timer.remaining > 0
                            ? "Pick up where you left off"
                            : "Make a little focus time"}
                      </strong>
                      <span>
                        {timer.running
                          ? `${Math.floor(timer.remaining / 60)}:${String(timer.remaining % 60).padStart(2, "0")} remaining`
                          : "25 minutes, one thing at a time"}
                      </span>
                    </div>
                    <button
                      className="icon-button"
                      onClick={() => {
                        setPage("Focus Mode");
                        if (!timer.running) startTimer();
                      }}
                      title={timer.running ? "Open focus session" : "Start a focus session"}
                      aria-label={timer.running ? "Open focus session" : "Start a focus session"}
                    >
                      {timer.running ? <Play size={15} /> : <ArrowUp size={15} />}
                    </button>
                  </section>
                  <section className="week-mini">
                    <div>
                      <span className="section-kicker">THIS WEEK</span>
                      <strong>{weekCount} tasks completed</strong>
                      <span>{focusTotal} min of recorded focus</span>
                    </div>
                    <div
                      className="mini-bars"
                      aria-label="Completions over the last seven days"
                    >
                      {week.map((day) => (
                        <span
                          key={day.date}
                          title={`${day.label}: ${day.count}`}
                          style={{
                            height: `${Math.max(8, Math.min(100, day.count * 22))}%`,
                          }}
                        />
                      ))}
                    </div>
                  </section>
                </aside>
              </div>
            </>
          )}

          {page === "Upcoming" && (
            <section className="content-view">
              <div className="view-heading">
                <div>
                  <span className="eyebrow">YOUR TIME, IN VIEW</span>
                  <h1>Upcoming</h1>
                  <p>
                    Deadlines on the calendar, with nothing hidden in the
                    margins.
                  </p>
                </div>
                <button
                  className="button button-primary"
                  onClick={() => openTaskDialog()}
                >
                  <Plus size={16} />
                  Add deadline
                </button>
              </div>
              <div className="calendar-layout">
                <section className="calendar-panel">
                  <div className="calendar-top">
                    <button
                      className="icon-button"
                      onClick={() =>
                        setCalendarMonth((month) => subMonths(month, 1))
                      }
                      aria-label="Previous month"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <h2>{format(calendarMonth, "MMMM yyyy")}</h2>
                    <button
                      className="icon-button"
                      onClick={() =>
                        setCalendarMonth((month) => addMonths(month, 1))
                      }
                      aria-label="Next month"
                    >
                      <ChevronRight size={18} />
                    </button>
                    <button
                      className="text-button calendar-today"
                      onClick={() => setCalendarMonth(new Date())}
                    >
                      Today
                    </button>
                  </div>
                  <div className="calendar-grid calendar-weekdays">
                    {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map(
                      (day) => (
                        <span key={day}>{day}</span>
                      ),
                    )}
                  </div>
                  <div className="calendar-grid">
                    {calendarDays.map((day) => {
                      const dayTasks = calendarTasks.filter(
                        (task) => task.dueDate === dateKey(day),
                      );
                      return (
                        <button
                          className={`calendar-day ${!isSameMonth(day, calendarMonth) ? "outside-month" : ""} ${isSameDay(day, new Date()) ? "calendar-current" : ""}`}
                          key={day.toISOString()}
                          onClick={() => {
                            const task = dayTasks[0];
                            if (task) {
                              setEditingTask(task);
                              setTaskDialogOpen(true);
                            } else {
                              openTaskDialog("", dateKey(day));
                            }
                          }}
                          title={
                            dayTasks.map((task) => task.title).join(", ") ||
                            "Add a task on this date"
                          }
                        >
                          <span>{format(day, "d")}</span>
                          {dayTasks.slice(0, 3).map((task) => (
                            <i
                              key={task.id}
                              className={`calendar-dot dot-${task.priority}`}
                            />
                          ))}
                          {dayTasks.length > 3 && (
                            <small>+{dayTasks.length - 3}</small>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <div className="calendar-legend">
                    <span>
                      <i className="dot-urgent" />
                      Urgent
                    </span>
                    <span>
                      <i className="dot-high" />
                      High
                    </span>
                    <span>
                      <i className="dot-medium" />
                      Medium
                    </span>
                    <span>
                      <i className="dot-low" />
                      Low
                    </span>
                  </div>
                </section>
                <aside className="agenda-panel">
                  <div className="section-heading">
                    <div>
                      <span className="section-kicker">DEADLINE AGENDA</span>
                      <h2>Coming up</h2>
                    </div>
                    <span className="section-count">
                      {upcomingTasks.length}
                    </span>
                  </div>
                  {overdueTasks.map((task) => (
                    <div className="agenda-date-group" key={task.id}>
                      <span className="agenda-date overdue-text">Overdue</span>
                      {renderTask(task)}
                    </div>
                  ))}
                  {upcomingTasks.map((task) => (
                    <div className="agenda-date-group" key={task.id}>
                      <span className="agenda-date">
                        {format(parseISO(task.dueDate), "EEEE, MMM d")}
                      </span>
                      {renderTask(task)}
                    </div>
                  ))}
                  {upcomingTasks.length === 0 && overdueTasks.length === 0 && (
                    <div className="empty-state">
                      <CalendarDays size={24} />
                      <strong>No upcoming deadlines</strong>
                      <span>Tasks with due dates will appear here.</span>
                    </div>
                  )}
                </aside>
              </div>
            </section>
          )}

          {page === "All Tasks" && (
            <section className="content-view">
              <div className="view-heading">
                <div>
                  <span className="eyebrow">YOUR WHOLE PICTURE</span>
                  <h1>All tasks</h1>
                  <p>
                    {activeTasks.length} active tasks across classes, projects,
                    and life.
                  </p>
                </div>
                <button
                  className="button button-primary"
                  onClick={() => openTaskDialog()}
                >
                  <Plus size={16} />
                  New task
                </button>
              </div>
              <div className="filter-row">
                <label className="filter-select">
                  Show
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                  >
                    <option value="open">Open tasks</option>
                    <option value="completed">Completed</option>
                    <option value="all">Everything</option>
                  </select>
                  <ChevronDown size={13} />
                </label>
                <label className="filter-select">
                  Priority
                  <select
                    value={priorityFilter}
                    onChange={(event) => setPriorityFilter(event.target.value)}
                  >
                    <option value="all">All priorities</option>
                    <option value="urgent">Urgent</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                  <ChevronDown size={13} />
                </label>
                <label className="filter-select sort-select">
                  Sort by
                  <select
                    value={sortBy}
                    onChange={(event) => setSortBy(event.target.value)}
                  >
                    <option value="smart">Smart order</option>
                    <option value="date">Due date</option>
                    <option value="priority">Priority</option>
                    <option value="created">Recently created</option>
                  </select>
                  <ChevronDown size={13} />
                </label>
              </div>
              <div className="task-stack all-task-stack">
                {pageTasks.map((task) => renderTask(task, { plan: true }))}
                {pageTasks.length === 0 && (
                  <div className="empty-state">
                    <ListChecks size={25} />
                    <strong>
                      {search ? "No matches found" : "Nothing here yet"}
                    </strong>
                    <span>
                      {search
                        ? "Try another search or clear the filters."
                        : "Add a task and it will find its place here."}
                    </span>
                    <button
                      className="button button-primary"
                      onClick={() => openTaskDialog()}
                    >
                      <Plus size={15} />
                      Create a task
                    </button>
                  </div>
                )}
              </div>
            </section>
          )}

          {page === "Projects" && (
            <section className="content-view">
              <div className="view-heading">
                <div>
                  <span className="eyebrow">WORK WITH A FINISH LINE</span>
                  <h1>Projects</h1>
                  <p>
                    Keep the pieces together and see your progress take shape.
                  </p>
                </div>
                <button
                  className="button button-primary"
                  onClick={() => setProjectFormOpen(true)}
                >
                  <Plus size={16} />
                  New project
                </button>
              </div>
              {projectFormOpen && (
                <form className="project-form" onSubmit={addProject} aria-label="Create project">
                  <div className="project-form-title">
                    <div>
                      <span className="section-kicker">NEW WORKSPACE</span>
                      <h2>Create a project</h2>
                    </div>
                    <button
                      className="icon-button"
                      type="button"
                      onClick={() => setProjectFormOpen(false)}
                      aria-label="Close"
                    >
                      <X size={17} />
                    </button>
                  </div>
                  <div className="form-grid">
                    <label className="field-label">
                      Project name
                      <input
                        required
                        autoFocus
                        value={projectName}
                        onChange={(event) => setProjectName(event.target.value)}
                        placeholder="e.g. Biology midterm"
                      />
                    </label>
                    <label className="field-label">
                      Deadline
                      <input
                        type="date"
                        value={projectDeadline}
                        onChange={(event) =>
                          setProjectDeadline(event.target.value)
                        }
                      />
                    </label>
                  </div>
                  <label className="field-label">
                    Description
                    <input
                      value={projectDescription}
                      onChange={(event) =>
                        setProjectDescription(event.target.value)
                      }
                      placeholder="What does finished look like?"
                    />
                  </label>
                  <div className="color-picker" aria-label="Project color">
                    {colors.map((color) => (
                      <button
                        type="button"
                        key={color}
                        className={projectColor === color ? "selected" : ""}
                        style={{ backgroundColor: color }}
                        onClick={() => setProjectColor(color)}
                        aria-label={`Select ${color} color`}
                      />
                    ))}
                  </div>
                  <div className="dialog-actions">
                    <button
                      type="button"
                      className="button button-quiet"
                      onClick={() => setProjectFormOpen(false)}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="button button-primary">
                      <Plus size={15} />
                      Create project
                    </button>
                  </div>
                </form>
              )}
              {data.projects.length === 0 && !projectFormOpen ? (
                <div className="empty-state">
                  <FolderKanban size={26} />
                  <strong>Start with a project</strong>
                  <span>Group related tasks and keep milestones in sight.</span>
                  <button
                    className="button button-primary"
                    onClick={() => setProjectFormOpen(true)}
                  >
                    <Plus size={15} />
                    Create a project
                  </button>
                </div>
              ) : (
                <div className="project-list">
                  {data.projects.map((project) => {
                    const tasks = data.tasks.filter(
                      (task) =>
                        task.projectId === project.id && !task.deletedAt,
                    );
                    const complete = tasks.filter(
                      (task) => task.status === "completed",
                    ).length;
                    const percent = tasks.length
                      ? Math.round((complete / tasks.length) * 100)
                      : 0;
                    return (
                      <article className="project-card" key={project.id}>
                        <div className="project-card-heading">
                          <i style={{ backgroundColor: project.color }} />
                          <div>
                            <h2>{project.name}</h2>
                            <p>
                              {project.description ||
                                "A place for the work in progress."}
                            </p>
                          </div>
                          <button
                            className="button button-quiet"
                            onClick={() => openTaskDialog(project.id)}
                          >
                            <Plus size={15} />
                            Add task
                          </button>
                        </div>
                        <div className="project-progress-row">
                          <div className="progress-track">
                            <span
                              style={{
                                width: `${percent}%`,
                                backgroundColor: project.color,
                              }}
                            />
                          </div>
                          <span>
                            {complete}/{tasks.length} complete
                          </span>
                          {project.deadline && (
                            <span>
                              <CalendarDays size={13} />
                              Due {format(parseISO(project.deadline), "MMM d")}
                            </span>
                          )}
                        </div>
                        {tasks.length > 0 ? (
                          <div className="task-stack project-tasks">
                            {tasks.map((task) => renderTask(task))}
                          </div>
                        ) : (
                          <button
                            className="project-empty-add"
                            onClick={() => openTaskDialog(project.id)}
                          >
                            <Plus size={14} />
                            Add the first task
                          </button>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {page === "Focus Mode" && (
            <section className="focus-view">
              <div className="focus-header">
                <span className="eyebrow">ONE THING AT A TIME</span>
                <h1>Find your focus.</h1>
                <p>A quiet 25 minutes for the work in front of you.</p>
              </div>
              <div className="focus-workspace">
                <div className="focus-ring-wrap">
                  <div
                    className={`focus-ring ${timer.running ? "focus-running" : ""}`}
                  >
                    <div className="focus-ring-inner">
                      <span>
                        {timer.remaining === 0
                          ? "SESSION DONE"
                          : timer.running
                            ? "IN THE ZONE"
                            : "POMODORO"}
                      </span>
                      <strong>
                        {String(Math.floor(timer.remaining / 60)).padStart(
                          2,
                          "0",
                        )}
                        :{String(timer.remaining % 60).padStart(2, "0")}
                      </strong>
                      <small>
                        {timer.running
                          ? "Stay with this moment"
                          : "25 minute session"}
                      </small>
                    </div>
                  </div>
                </div>
                <div className="focus-controls">
                  <label className="field-label">
                    Working on
                    <select
                      disabled={timer.running}
                      value={focusTaskId}
                      onChange={(event) => setFocusTaskId(event.target.value)}
                    >
                      <option value="">Choose a task or focus freely</option>
                      {activeTasks.map((task) => (
                        <option value={task.id} key={task.id}>
                          {task.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="timer-buttons">
                    {timer.running ? (
                      <button
                        className="button button-primary timer-main-button"
                        onClick={pauseTimer}
                      >
                        <Pause size={17} />
                        Pause
                      </button>
                    ) : (
                      <button
                        className="button button-primary timer-main-button"
                        onClick={startTimer}
                      >
                        <Play size={17} />
                        {timer.remaining === 25 * 60 && !timer.title
                          ? "Start focus"
                          : timer.remaining === 0
                            ? "Start again"
                            : "Resume"}
                      </button>
                    )}
                    <button
                      className="button button-quiet"
                      onClick={resetTimer}
                      title="Reset timer"
                    >
                      <SkipForward size={16} />
                      Reset
                    </button>
                  </div>
                  <div className="focus-record">
                    <Clock3 size={15} />
                    <span>
                      {focusTotal} minutes recorded across{" "}
                      {data.focusSessions.length} sessions
                    </span>
                  </div>
                </div>
              </div>
              <div className="focus-note">
                <Sparkles size={15} />
                {timer.title
                  ? `Current intention: ${timer.title}`
                  : "Choose one small, clear intention. Your other tabs can wait."}
              </div>
            </section>
          )}

          {page === "Habits" && (
            <section className="content-view">
              <div className="view-heading">
                <div>
                  <span className="eyebrow">SMALL THINGS, OFTEN</span>
                  <h1>Habits</h1>
                  <p>Notice the routines that make your days feel steadier.</p>
                </div>
              </div>
              <form className="quick-add habit-add" onSubmit={addHabit}>
                <Plus size={18} />
                <input
                  aria-label="New habit name"
                  value={habitName}
                  onChange={(event) => setHabitName(event.target.value)}
                  placeholder="Add a small daily habit…"
                  maxLength={80}
                />
                <button type="submit" aria-label="Add habit">
                  <ArrowUp size={17} />
                </button>
              </form>
              <div className="habit-list">
                {data.habits.map((habit) => {
                  const streak = habitStreak(habit.completedDates);
                  const done = habit.completedDates.includes(today);
                  return (
                    <article
                      className={`habit-row ${done ? "habit-done" : ""}`}
                      key={habit.id}
                    >
                      <button
                        className={`habit-check ${done ? "checked" : ""}`}
                        onClick={() => toggleHabit(habit)}
                        aria-label={
                          done
                            ? "Undo today’s check-in"
                            : "Mark habit complete today"
                        }
                      >
                        <Check size={15} />
                      </button>
                      <span className="habit-symbol">{habit.icon}</span>
                      <div className="habit-info">
                        <strong>{habit.name}</strong>
                        <span>
                          {done
                            ? "Checked in today"
                            : "A little progress counts."}
                        </span>
                      </div>
                      <span className="habit-streak">
                        <Flame size={15} />
                        {streak} day{streak === 1 ? "" : "s"}
                      </span>
                      <button
                        className="icon-button danger-icon"
                        onClick={() =>
                          setData((current) => ({
                            ...current,
                            habits: current.habits.filter(
                              (item) => item.id !== habit.id,
                            ),
                          }))
                        }
                        aria-label={`Delete ${habit.name}`}
                        title="Delete habit"
                      >
                        <Trash2 size={15} />
                      </button>
                    </article>
                  );
                })}
                {data.habits.length === 0 && (
                  <div className="empty-state">
                    <Heart size={26} />
                    <strong>Build a rhythm that feels like yours</strong>
                    <span>
                      Reading, stretching, a short walk, or a regular study
                      block.
                    </span>
                  </div>
                )}
              </div>
            </section>
          )}

          {page === "Statistics" && (
            <section className="content-view">
              <div className="view-heading">
                <div>
                  <span className="eyebrow">A REFLECTION, NOT A SCORECARD</span>
                  <h1>Your progress</h1>
                  <p>
                    Trends based on your recorded completions and focus
                    sessions.
                  </p>
                </div>
              </div>
              <div className="stat-grid">
                <article className="stat-card">
                  <span>
                    <CheckCircle2 size={16} />
                    COMPLETED THIS WEEK
                  </span>
                  <strong>{weekCount}</strong>
                  <small>Recorded in the last seven days</small>
                </article>
                <article className="stat-card">
                  <span>
                    <Target size={16} />
                    COMPLETION RATE
                  </span>
                  <strong>{completionRate}%</strong>
                  <small>
                    {completedTaskCount} of {trackedTasks.length} current tasks complete
                  </small>
                </article>
                <article className="stat-card">
                  <span>
                    <Clock3 size={16} />
                    FOCUS TIME
                  </span>
                  <strong>{formatMinutes(focusTotal)}</strong>
                  <small>
                    {data.focusSessions.length} saved focus sessions
                  </small>
                </article>
                <article className="stat-card">
                  <span>
                    <CalendarDays size={16} />
                    CURRENTLY OVERDUE
                  </span>
                  <strong>{overdueTasks.length}</strong>
                  <small>Open tasks past their deadline</small>
                </article>
              </div>
              <section className="chart-panel">
                <div className="section-heading">
                  <div>
                    <span className="section-kicker">LAST SEVEN DAYS</span>
                    <h2>Completed tasks</h2>
                  </div>
                  <span className="chart-total">{weekCount} total</span>
                </div>
                {data.completions.length ? (
                  <Suspense fallback={<div className="chart-empty">Loading chart…</div>}>
                    <CompletionChart data={week} />
                  </Suspense>
                ) : (
                  <div className="chart-empty">
                    <TrendingUp size={23} />
                    <strong>Your first week starts here</strong>
                    <span>
                      Complete a task to begin your real productivity trend.
                    </span>
                  </div>
                )}
              </section>
              <div className="insight-row">
                <div className="insight-icon">
                  <Sparkles size={17} />
                </div>
                <div>
                  <span className="section-kicker">A SMALL OBSERVATION</span>
                  <strong>
                    {weekCount === 0
                      ? "No completions recorded this week yet."
                      : `You completed ${weekCount} ${weekCount === 1 ? "task" : "tasks"} this week.`}
                  </strong>
                  <span>
                    {weekCount === 0
                      ? "Progress appears here as you use the app; nothing is pre-filled."
                      : "Consistency is built one finished thing at a time."}
                  </span>
                </div>
              </div>
            </section>
          )}

          {page === "Recently deleted" && (
            <section className="content-view">
              <div className="view-heading">
                <div>
                  <span className="eyebrow">A SECOND CHANCE</span>
                  <h1>Recently deleted</h1>
                  <p>Restore a task or remove it permanently.</p>
                </div>
              </div>
              <div className="task-stack all-task-stack">
                {pageTasks.map((task) => renderTask(task, { restore: true }))}
                {pageTasks.length === 0 && (
                  <div className="empty-state">
                    <CheckCircle2 size={25} />
                    <strong>Trash is empty</strong>
                    <span>
                      Deleted tasks will stay here until you remove them.
                    </span>
                  </div>
                )}
              </div>
            </section>
          )}

          {page === "Settings" && (
            <section className="content-view">
              <div className="view-heading">
                <div>
                  <span className="eyebrow">MAKE IT YOURS</span>
                  <h1>Settings</h1>
                  <p>Your preferences and a portable copy of your data.</p>
                </div>
              </div>
              <div className="settings-list">
                <section className="settings-section">
                  <div className="settings-heading">
                    <div>
                      <strong>Your workspace</strong>
                      <span>
                        A name makes the daily greeting feel a little more
                        personal.
                      </span>
                    </div>
                  </div>
                  <label className="settings-control field-label">
                    Your name
                    <input
                      maxLength={40}
                      value={data.settings.firstName}
                      onChange={(event) =>
                        setData((current) => ({
                          ...current,
                          settings: {
                            ...current.settings,
                            firstName: event.target.value,
                          },
                        }))
                      }
                      placeholder="What should we call you?"
                    />
                  </label>
                </section>
                <section className="settings-section">
                  <div className="settings-heading">
                    <div>
                      <strong>Appearance</strong>
                      <span>Choose a comfortable canvas for your work.</span>
                    </div>
                  </div>
                  <div className="theme-options">
                    <button
                      className={`theme-option ${data.settings.theme === "light" ? "selected" : ""}`}
                      onClick={() =>
                        setData((current) => ({
                          ...current,
                          settings: { ...current.settings, theme: "light" },
                        }))
                      }
                    >
                      <Sun size={17} />
                      Light
                    </button>
                    <button
                      className={`theme-option ${data.settings.theme === "dark" ? "selected" : ""}`}
                      onClick={() =>
                        setData((current) => ({
                          ...current,
                          settings: { ...current.settings, theme: "dark" },
                        }))
                      }
                    >
                      <Moon size={17} />
                      Dark
                    </button>
                  </div>
                </section>
                <section className="settings-section">
                  <div className="settings-heading">
                    <div>
                      <strong>Deadline reminders</strong>
                      <span>
                        {permission === "granted" &&
                        data.settings.reminderEnabled
                          ? "Browser reminders are configured for this device."
                          : permission === "denied"
                            ? "Permission was denied. Update this site in browser settings to enable reminders."
                            : permission === "unsupported"
                              ? "This browser does not support desktop notifications."
                              : "Optional browser notifications for deadlines you set."}
                      </span>
                    </div>
                    <Bell size={18} />
                  </div>
                  <div className="reminder-controls">
                    <label className="field-label">
                      Remind me
                      <select
                        disabled={!data.settings.reminderEnabled}
                        value={data.settings.reminderMinutes}
                        onChange={(event) =>
                          setData((current) => ({
                            ...current,
                            settings: {
                              ...current.settings,
                              reminderMinutes: Number(event.target.value),
                            },
                          }))
                        }
                      >
                        <option value={5}>5 minutes before</option>
                        <option value={15}>15 minutes before</option>
                        <option value={30}>30 minutes before</option>
                        <option value={60}>1 hour before</option>
                      </select>
                    </label>
                    <button
                      className="button button-quiet"
                      onClick={configureReminders}
                    >
                      {data.settings.reminderEnabled && permission === "granted"
                        ? "Recheck permission"
                        : "Enable notifications"}
                    </button>
                    {data.settings.reminderEnabled &&
                      permission === "granted" && (
                        <button
                          className="text-button"
                          onClick={() =>
                            setData((current) => ({
                              ...current,
                              settings: {
                                ...current.settings,
                                reminderEnabled: false,
                              },
                            }))
                          }
                        >
                          Turn off
                        </button>
                      )}
                  </div>
                  <small className="settings-note">
                    Date-only deadlines use 9:00 AM as the reminder time.
                    Notifications only run while this app is open.
                  </small>
                </section>
                <section className="settings-section">
                  <div className="settings-heading">
                    <div>
                      <strong>Your data</strong>
                      <span>
                        Everything is stored in this browser. Export a backup
                        before switching devices.
                      </span>
                    </div>
                  </div>
                  <div className="backup-actions">
                    <button
                      className="button button-quiet"
                      onClick={exportBackup}
                    >
                      <ArrowDown size={15} />
                      Export JSON
                    </button>
                    <label className="button button-quiet upload-button">
                      <Upload size={15} />
                      Import backup
                      <input
                        type="file"
                        accept="application/json,.json"
                        onChange={(event) => {
                          importBackup(event.target.files?.[0]);
                          event.currentTarget.value = "";
                        }}
                      />
                    </label>
                  </div>
                  <small className="settings-note">
                    Import replaces the current workspace only after the backup
                    passes validation.
                  </small>
                </section>
              </div>
            </section>
          )}
        </div>
        <footer className="app-footer">
          <span>FOCUSFLOW</span>
          <span>Made for the work that matters to you.</span>
          <button onClick={() => setPage("Settings")}>
            Local-first · Your data stays here
          </button>
        </footer>
      </main>
      <nav className="mobile-bottom-nav" aria-label="Quick navigation">
        {[pages[0], pages[1], pages[2], pages[4]].map(
          ({ name, icon: Icon }) => (
            <button
              key={name}
              className={page === name ? "selected" : ""}
              onClick={() => setPage(name)}
            >
              <Icon size={19} />
              <span>
                {name === "Focus Mode"
                  ? "Focus"
                  : name === "All Tasks"
                    ? "Tasks"
                    : name}
              </span>
            </button>
          ),
        )}
        <button onClick={() => setMobileNavOpen(true)}>
          <Menu size={19} />
          <span>More</span>
        </button>
      </nav>
      {taskDialogOpen && (
        <TaskDialog
          task={editingTask}
          projects={data.projects}
          initialProjectId={defaultProjectId}
          initialDueDate={defaultDueDate}
          onClose={() => {
            setTaskDialogOpen(false);
            setEditingTask(null);
            setDefaultProjectId("");
            setDefaultDueDate("");
          }}
          onSave={saveTask}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={16} />
          {toast}
          <button onClick={() => setToast("")} aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

function habitStreak(dates: string[]) {
  const done = new Set(dates);
  let cursor = new Date();
  if (!done.has(dateKey(cursor))) cursor = addDays(cursor, -1);
  let streak = 0;
  while (done.has(dateKey(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours ? `${hours}h ${remainder}m` : `${remainder}m`;
}

export default App;
