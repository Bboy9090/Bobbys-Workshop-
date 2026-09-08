import { useMemo, useState } from 'react';
import { publishingProjects, type PublishingStatus } from './lib/publishing';

const statusStyles: Record<PublishingStatus, string> = {
  live: 'border-emerald-800 bg-emerald-950/50 text-emerald-300',
  correction: 'border-amber-800 bg-amber-950/50 text-amber-300',
  production: 'border-cyan-800 bg-cyan-950/50 text-cyan-300',
  editorial: 'border-violet-800 bg-violet-950/50 text-violet-300',
  planned: 'border-slate-700 bg-slate-800 text-slate-300',
  hold: 'border-rose-900 bg-rose-950/50 text-rose-300',
};

function dateLabel(value?: string) {
  if (!value) return 'Not scheduled';
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T12:00:00Z`));
}

export default function PublishingDashboard() {
  const [filter, setFilter] = useState<'all' | 'scheduled' | 'unscheduled'>('all');
  const rows = useMemo(
    () =>
      publishingProjects
        .filter((project) => {
          if (filter === 'scheduled') return Boolean(project.targetDate);
          if (filter === 'unscheduled') return !project.targetDate;
          return true;
        })
        .sort((a, b) => (a.targetDate || '9999').localeCompare(b.targetDate || '9999')),
    [filter]
  );
  const scheduled = publishingProjects.filter((project) => project.targetDate).length;
  const blockers = publishingProjects.filter((project) => project.blocker).length;

  return (
    <main className="min-h-0 flex-1 overflow-y-auto bg-slate-950 p-5">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-400">
              Bobby&apos;s Workshop Publishing
            </p>
            <h2 className="mt-1 text-2xl font-bold text-white">Publishing Command Dashboard</h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-400">
              Commercial releases, sequel order, production gates, and dates in one source of truth.
            </p>
          </div>
          <div className="flex gap-2">
            {(['all', 'scheduled', 'unscheduled'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={`rounded px-3 py-2 text-xs font-semibold capitalize ${
                  filter === value ? 'bg-orange-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
            <div className="text-2xl font-bold text-white">{publishingProjects.length}</div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Tracked titles</div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
            <div className="text-2xl font-bold text-cyan-300">{scheduled}</div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Scheduled releases</div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
            <div className="text-2xl font-bold text-amber-300">{blockers}</div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Recorded blockers</div>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-lg border border-slate-800 bg-slate-900/70">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
              <thead className="bg-slate-900 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Release</th>
                  <th className="px-4 py-3">Series / title</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Formats</th>
                  <th className="px-4 py-3">Next production gate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {rows.map((project) => (
                  <tr key={project.id} className="align-top hover:bg-slate-800/40">
                    <td className="whitespace-nowrap px-4 py-4 font-medium text-white">
                      {dateLabel(project.targetDate)}
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-semibold text-white">
                        {project.title}
                        {project.volume ? <span className="ml-2 text-slate-500">Vol. {project.volume}</span> : null}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">{project.franchise}</div>
                      {!project.commercial ? (
                        <div className="mt-2 text-xs font-semibold text-rose-300">NONCOMMERCIAL</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${statusStyles[project.status]}`}>
                        {project.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-xs text-slate-400">{project.formats.join(' · ')}</td>
                    <td className="max-w-md px-4 py-4 text-slate-300">
                      <p>{project.nextAction}</p>
                      {project.blocker ? (
                        <p className="mt-2 border-l-2 border-amber-600 pl-2 text-xs text-amber-300">
                          {project.blocker}
                        </p>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
