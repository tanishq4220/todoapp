import { useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  Clock3,
  Copy,
  Ellipsis,
  ExternalLink,
  Pencil,
  Repeat2,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import type { Task } from "../types";
import { isOverdue } from "../lib/productivity";
import { SubtaskChecklist } from "./TaskDialog";

interface TaskItemProps {
  task: Task;
  projectName?: string;
  actualMinutes?: number;
  planned?: boolean;
  showPlan?: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onPostpone: () => void;
  onRestore?: () => void;
  onDeleteForever?: () => void;
  onPlan?: () => void;
  onToggleSubtask: (id: string) => void;
}

export default function TaskItem({
  task,
  projectName,
  actualMinutes = 0,
  planned,
  showPlan,
  onToggle,
  onEdit,
  onDuplicate,
  onDelete,
  onPostpone,
  onRestore,
  onDeleteForever,
  onPlan,
  onToggleSubtask,
}: TaskItemProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const overdue = isOverdue(task);
  return (
    <article
      className={`task-item ${task.status === "completed" ? "task-completed" : ""}`}
    >
      <button
        className={`task-check ${task.status === "completed" ? "checked" : ""}`}
        onClick={onToggle}
        aria-label={
          task.status === "completed" ? "Mark incomplete" : "Complete task"
        }
        title={
          task.status === "completed" ? "Mark incomplete" : "Complete task"
        }
      >
        <Check size={14} />
      </button>
      <div className="task-copy">
        <button className="task-title" onClick={onEdit}>
          {task.title}
        </button>
        {task.description && (
          <p className="task-description">{task.description}</p>
        )}
        <div className="task-meta">
          <span className={`priority-label priority-${task.priority}`}>
            <i />
            {task.priority}
          </span>
          <span className="task-category">
            {task.category === "Custom" ? task.customCategory || "Custom" : task.category}
          </span>
          {task.dueDate && (
            <span className={`task-due ${overdue ? "overdue" : ""}`}>
              <CalendarDays size={13} />
              {format(parseISO(task.dueDate), "MMM d")}
              {task.dueTime && ` · ${task.dueTime}`}
            </span>
          )}
          {task.originalDueDate && task.originalDueDate !== task.dueDate && (
            <span className="task-original-due">
              Originally {format(parseISO(task.originalDueDate), "MMM d")}
            </span>
          )}
          {task.recurrence !== "none" && (
            <span title={`Repeats ${task.recurrence}`}>
              <Repeat2 size={12} />
              {task.recurrence}
            </span>
          )}
          {task.estimateMinutes > 0 && (
            <span
              title={
                actualMinutes
                  ? `${actualMinutes} minutes recorded in focus sessions`
                  : "Estimated time"
              }
            >
              <Clock3 size={13} />
              {actualMinutes
                ? `${task.estimateMinutes}m est · ${actualMinutes}m focused`
                : `${task.estimateMinutes}m est`}
            </span>
          )}
          {projectName && <span className="task-project">{projectName}</span>}
          {task.link && (
            <a
              className="task-link"
              href={task.link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => event.stopPropagation()}
            >
              <ExternalLink size={12} />
              Link
            </a>
          )}
          {task.tags.slice(0, 2).map((tag) => (
            <span className="tag-pill" key={tag}>
              {tag}
            </span>
          ))}
          {task.subtasks.length > 0 && (
            <span>
              {task.subtasks.filter((item) => item.done).length}/
              {task.subtasks.length} steps
            </span>
          )}
        </div>
        {task.subtasks.length > 0 && (
          <SubtaskChecklist task={task} onToggle={onToggleSubtask} />
        )}
      </div>
      <div className="task-actions">
        {showPlan && (
          <button
            className={`icon-button plan-button ${planned ? "planned" : ""}`}
            onClick={onPlan}
            title={planned ? "Remove from top three" : "Add to top three"}
            aria-label={planned ? "Remove from top three" : "Add to top three"}
          >
            <ArrowUpRight size={16} />
          </button>
        )}
        {!task.deletedAt && (
          <button
            className="icon-button task-more"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="Task actions"
            title="Task actions"
          >
            <Ellipsis size={18} />
          </button>
        )}
        {task.deletedAt && (
          <>
            <button
              className="icon-button"
              onClick={onRestore}
              title="Restore task"
              aria-label="Restore task"
            >
              <RotateCcw size={16} />
            </button>
            <button
              className="icon-button danger-icon"
              onClick={onDeleteForever}
              title="Delete forever"
              aria-label="Delete forever"
            >
              <Trash2 size={15} />
            </button>
          </>
        )}
      </div>
      {menuOpen && (
        <div className="task-menu" onMouseLeave={() => setMenuOpen(false)}>
          <button
            onClick={() => {
              onEdit();
              setMenuOpen(false);
            }}
          >
            <Pencil size={14} />
            Edit task
          </button>
          <button
            onClick={() => {
              onDuplicate();
              setMenuOpen(false);
            }}
          >
            <Copy size={14} />
            Duplicate
          </button>
          <button
            onClick={() => {
              onPostpone();
              setMenuOpen(false);
            }}
          >
            <ArrowDownRight size={14} />
            Carry forward
          </button>
          <button
            className="menu-danger"
            onClick={() => {
              onDelete();
              setMenuOpen(false);
            }}
          >
            <Trash2 size={14} />
            Move to trash
          </button>
        </div>
      )}
    </article>
  );
}
