import { useState, type FormEvent } from "react";
import { Plus, X } from "lucide-react";
import type {
  Project,
  Task,
  TaskCategory,
  TaskStatus,
  Priority,
  Recurrence,
  Subtask,
} from "../types";

export type TaskDraft = Omit<
  Task,
  "id" | "createdAt" | "updatedAt" | "completedAt" | "deletedAt"
>;

interface TaskDialogProps {
  task: Task | null;
  projects: Project[];
  initialProjectId?: string;
  initialDueDate?: string;
  onClose: () => void;
  onSave: (draft: TaskDraft) => void;
}

const categories: TaskCategory[] = [
  "College",
  "Exams",
  "Projects",
  "Hackathons",
  "Internships",
  "Personal",
  "Custom",
];

function blankDraft(): TaskDraft {
  return {
    title: "",
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
  };
}

export default function TaskDialog({
  task,
  projects,
  initialProjectId = "",
  initialDueDate = "",
  onClose,
  onSave,
}: TaskDialogProps) {
  const [draft, setDraft] = useState<TaskDraft>(() =>
    task
      ? {
          title: task.title,
          description: task.description,
          dueDate: task.dueDate,
          dueTime: task.dueTime,
          originalDueDate: task.originalDueDate,
          priority: task.priority,
          category: task.category,
          customCategory: task.customCategory,
          status: task.status,
          subtasks: task.subtasks,
          estimateMinutes: task.estimateMinutes,
          tags: task.tags,
          recurrence: task.recurrence,
          notes: task.notes,
          link: task.link,
          projectId: task.projectId,
        }
      : {
          ...blankDraft(),
          projectId: initialProjectId,
          dueDate: initialDueDate,
        },
  );
  const [subtaskText, setSubtaskText] = useState(
    () => task?.subtasks.map((item) => item.title).join("\n") ?? "",
  );

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const subtasks: Subtask[] = subtaskText
      .split("\n")
      .map((title) => title.trim())
      .filter(Boolean)
      .map((title) => {
        const existing = task?.subtasks.find((item) => item.title === title);
        return existing ?? { id: crypto.randomUUID(), title, done: false };
      });
    onSave({
      ...draft,
      title: draft.title.trim(),
      tags: draft.tags.map((tag) => tag.trim()).filter(Boolean),
      subtasks,
    });
  }

  function update<K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form
        className="task-dialog"
        onSubmit={submit}
        aria-label={task ? "Edit task" : "Create task"}
      >
        <div className="dialog-head">
          <div>
            <span className="eyebrow">TASK DETAILS</span>
            <h2>{task ? "Edit task" : "A new next step"}</h2>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <label className="field-label">
          Task name
          <input
            autoFocus
            required
            maxLength={120}
            value={draft.title}
            onChange={(event) => update("title", event.target.value)}
            placeholder="What needs your attention?"
          />
        </label>
        <label className="field-label">
          Description
          <textarea
            rows={2}
            value={draft.description}
            onChange={(event) => update("description", event.target.value)}
            placeholder="Add a little context…"
          />
        </label>
        <div className="form-grid">
          <label className="field-label">
            Due date
            <input
              type="date"
              value={draft.dueDate}
              onChange={(event) => update("dueDate", event.target.value)}
            />
          </label>
          <label className="field-label">
            Due time
            <input
              type="time"
              value={draft.dueTime}
              onChange={(event) => update("dueTime", event.target.value)}
            />
          </label>
          <label className="field-label">
            Priority
            <select
              value={draft.priority}
              onChange={(event) =>
                update("priority", event.target.value as Priority)
              }
            >
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>
          <label className="field-label">
            Status
            <select
              value={draft.status}
              onChange={(event) =>
                update("status", event.target.value as TaskStatus)
              }
            >
              <option value="todo">To do</option>
              <option value="in-progress">In progress</option>
              <option value="completed">Completed</option>
            </select>
          </label>
          <label className="field-label">
            Category
            <select
              value={draft.category}
              onChange={(event) =>
                update("category", event.target.value as TaskCategory)
              }
            >
              {categories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </label>
          {draft.category === "Custom" && (
            <label className="field-label">
              Custom category
              <input
                value={draft.customCategory}
                onChange={(event) =>
                  update("customCategory", event.target.value)
                }
                placeholder="Category name"
              />
            </label>
          )}
          <label className="field-label">
            Estimate (minutes)
            <input
              type="number"
              min="1"
              max="1440"
              value={draft.estimateMinutes || ""}
              onChange={(event) =>
                update("estimateMinutes", Number(event.target.value))
              }
            />
          </label>
          <label className="field-label">
            Repeat
            <select
              value={draft.recurrence}
              onChange={(event) =>
                update("recurrence", event.target.value as Recurrence)
              }
            >
              <option value="none">Does not repeat</option>
              <option value="daily">Every day</option>
              <option value="weekly">Every week</option>
            </select>
          </label>
        </div>
        <label className="field-label">
          Project
          <select
            value={draft.projectId}
            onChange={(event) => update("projectId", event.target.value)}
          >
            <option value="">No project</option>
            {projects.map((project) => (
              <option value={project.id} key={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          Checklist
          <textarea
            rows={3}
            value={subtaskText}
            onChange={(event) => setSubtaskText(event.target.value)}
            placeholder={"One small step per line\nOutline the first section"}
          />
        </label>
        <label className="field-label">
          Tags
          <input
            value={draft.tags.join(", ")}
            onChange={(event) => update("tags", event.target.value.split(","))}
            placeholder="biology, reading, campus"
          />
        </label>
        <div className="form-grid">
          <label className="field-label">
            Notes
            <input
              value={draft.notes}
              onChange={(event) => update("notes", event.target.value)}
              placeholder="Optional note"
            />
          </label>
          <label className="field-label">
            Link
            <input
              type="url"
              value={draft.link}
              onChange={(event) => update("link", event.target.value)}
              placeholder="https://…"
            />
          </label>
        </div>
        <div className="dialog-actions">
          <button
            type="button"
            className="button button-quiet"
            onClick={onClose}
          >
            Cancel
          </button>
          <button type="submit" className="button button-primary">
            <Plus size={16} />
            {task ? "Save changes" : "Create task"}
          </button>
        </div>
      </form>
    </div>
  );
}

export function SubtaskChecklist({
  task,
  onToggle,
}: {
  task: Task;
  onToggle: (subtaskId: string) => void;
}) {
  if (!task.subtasks.length) return null;
  const done = task.subtasks.filter((item) => item.done).length;
  return (
    <div className="subtask-list">
      <span className="subtask-count">
        {done}/{task.subtasks.length} steps
      </span>
      {task.subtasks.map((item) => (
        <label key={item.id} className="subtask-line">
          <input
            type="checkbox"
            checked={item.done}
            onChange={() => onToggle(item.id)}
          />
          <span className={item.done ? "is-done" : ""}>{item.title}</span>
        </label>
      ))}
    </div>
  );
}
