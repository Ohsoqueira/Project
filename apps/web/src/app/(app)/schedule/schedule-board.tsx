"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { DndContext, DragOverlay, useDraggable, useDroppable, type DragEndEvent } from "@dnd-kit/core";
import { reassignWorkOrderAction, unscheduleWorkOrderAction } from "./actions";

type WorkOrder = {
  id: string;
  number: number;
  title: string;
  priority: string;
  customerName: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
};

type Technician = { id: string; name: string; jobs: WorkOrder[] };

export function ScheduleBoard({
  date,
  technicians,
  unscheduled,
}: {
  date: string;
  technicians: Technician[];
  unscheduled: WorkOrder[];
}) {
  const [activeJob, setActiveJob] = useState<WorkOrder | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDragEnd(event: DragEndEvent) {
    setActiveJob(null);
    const { active, over } = event;
    if (!over) return;

    const workOrderId = String(active.id);
    const overId = String(over.id);

    startTransition(async () => {
      if (overId === "unscheduled") {
        await unscheduleWorkOrderAction(workOrderId);
      } else {
        await reassignWorkOrderAction({ workOrderId, userId: overId, date });
      }
    });
  }

  return (
    <DndContext
      onDragStart={(e) => {
        const job = [...unscheduled, ...technicians.flatMap((t) => t.jobs)].find((j) => j.id === e.active.id);
        setActiveJob(job ?? null);
      }}
      onDragEnd={handleDragEnd}
    >
      <div className={isPending ? "opacity-60 pointer-events-none transition-opacity" : "transition-opacity"}>
        <div className="grid grid-cols-1 lg:grid-cols-[220px_repeat(auto-fill,minmax(220px,1fr))] gap-4">
          <Column id="unscheduled" title="Unscheduled queue">
            {unscheduled.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
            {unscheduled.length === 0 ? <EmptyHint /> : null}
          </Column>

          {technicians.map((tech) => (
            <Column key={tech.id} id={tech.id} title={tech.name}>
              {tech.jobs.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
              {tech.jobs.length === 0 ? <EmptyHint /> : null}
            </Column>
          ))}
        </div>
      </div>
      <DragOverlay>{activeJob ? <JobCard job={activeJob} overlay /> : null}</DragOverlay>
    </DndContext>
  );
}

function Column({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`card p-3 min-h-[200px] ${isOver ? "ring-2 ring-brand-500" : ""}`}
    >
      <h3 className="text-sm font-medium text-slate-600 mb-2">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function JobCard({ job, overlay }: { job: WorkOrder; overlay?: boolean }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: job.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;

  const priorityColor =
    job.priority === "URGENT" ? "border-red-400" : job.priority === "HIGH" ? "border-amber-400" : "border-slate-200";

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      style={style}
      {...(overlay ? {} : listeners)}
      {...(overlay ? {} : attributes)}
      className={`bg-white border-l-4 ${priorityColor} border border-slate-200 rounded-md p-2 text-xs shadow-sm cursor-grab active:cursor-grabbing`}
    >
      <Link href={`/work-orders/${job.id}`} className="font-medium text-brand-600 hover:underline" onClick={(e) => overlay && e.preventDefault()}>
        #{job.number}
      </Link>
      <p className="truncate">{job.title}</p>
      <p className="text-slate-500 truncate">{job.customerName}</p>
      {job.scheduledStart ? (
        <p className="text-slate-400">
          {new Date(job.scheduledStart).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
      ) : null}
    </div>
  );
}

function EmptyHint() {
  return <p className="text-xs text-slate-400 italic">Drop a job here</p>;
}
