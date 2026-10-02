import { Link } from 'react-router-dom'
import { dueLabel, fmtShort } from '../lib/format'
import { Badge, Progress } from './ui'

const STATE = { COMPLETE: 'COMPLETE', BLOCKED: 'BLOCKED', BEHIND: 'BEHIND', ON_TRACK: 'ON_TRACK' }

// A plan with this trainee's progress and task checklist.
export default function PlanProgress({ plan, link, action, compact }) {
  const title = link ? <Link to={link}>{plan.title}</Link> : plan.title
  return (
    <div className="plan-card">
      <div className="plan-card-head">
        <div>
          <h3>{title}</h3>
          <div className="small muted">{plan.assignee_name || (plan.assignee_type === 'TRAINEE' ? 'Solo track' : '')} · {plan.done_count}/{plan.task_count} tasks</div>
        </div>
        <Badge value={STATE[plan.state]} />
      </div>
      <div className="progress-cell"><Progress value={plan.progress} tone={plan.state === 'BLOCKED' ? 'bad' : undefined} /><strong>{plan.progress}%</strong></div>
      {!compact && (
        <ul className="tasks">
          {plan.tasks.map((t) => (
            <li key={t.id} className={`task ${t.done ? 'task-done' : ''} ${t.overdue ? 'task-overdue' : ''}`}>
              <span className="task-check" aria-hidden="true">{t.done ? '✓' : ''}</span>
              <span className="task-title">{t.title}</span>
              <span className="task-due small" title={t.due_date ? fmtShort(t.due_date) : ''}>
                {t.done ? 'Done' : dueLabel(t.due_date)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {compact && plan.next_task && (
        <p className={`small ${plan.next_task.overdue ? 'text-bad' : 'muted'}`}>
          Next: {plan.next_task.title} · {dueLabel(plan.next_task.due_date)}
        </p>
      )}
      {action}
    </div>
  )
}
