import { useState, type ReactNode } from 'react';
import type { WorkspaceTaskAvailability } from '../lib/workspace-availability';

export const WORKSPACE_VIEWS = [
  {id:'phone',label:'Phone',title:'Your phone',description:'Connect and select the phone you want to work on.'},
  {id:'diagnose',label:'Diagnostics',title:'Diagnostics',description:'Check the connection and follow the next safe step.'},
  {id:'files',label:'Files & apps',title:'Files & apps',description:'Use the file-transfer or authorized ADB connection identified below.'},
  {id:'firmware',label:'Firmware',title:'Firmware inspection',description:'Inspect supported packages. Matching a brand never qualifies a flash.'},
  {id:'advanced',label:'Advanced',title:'Advanced tools',description:'Open only the service or qualification tool you need.'},
  {id:'history',label:'History',title:'History & evidence',description:'Review previous jobs, connection events, and saved audit evidence.'},
] as const;
export type WorkspaceView = typeof WORKSPACE_VIEWS[number]['id'];

export function WorkspaceNavigation({active,onChange}: {
  active:WorkspaceView; onChange:(view:WorkspaceView)=>void;
}) {
  return <nav aria-label="Workspace" className="grid grid-cols-3 gap-1 md:flex md:flex-col">
    {WORKSPACE_VIEWS.map((view,index) => <button key={view.id} type="button"
      aria-current={active===view.id ? 'page' : undefined} onClick={()=>onChange(view.id)}
      className={active===view.id
        ? 'flex items-center gap-3 rounded-lg border border-cyan-800 bg-cyan-950/40 px-3 py-2.5 text-left text-sm font-semibold text-cyan-100'
        : 'flex items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left text-sm text-slate-400 hover:bg-slate-800/60 hover:text-white'}>
      <span aria-hidden="true" className="hidden w-5 font-mono text-[10px] opacity-50 md:inline">{String(index+1).padStart(2,'0')}</span>
      {view.label}
    </button>)}
  </nav>;
}

// Visit a view once, then retain its mounted forms and evidence while navigating.
export function WorkspacePanel({view,active,children}: {
  view:WorkspaceView; active:WorkspaceView; children:ReactNode;
}) {
  const [visited,setVisited]=useState(view===active);
  if(view===active && !visited)setVisited(true);
  if(view!==active && !visited)return null;
  const meta=WORKSPACE_VIEWS.find(item=>item.id===view)!;
  return <section data-workspace-panel={view} hidden={view!==active}
    style={view!==active ? {display:'none'} : undefined} aria-labelledby={'workspace-title-'+view}>
    <header className="mb-5">
      <h2 id={'workspace-title-'+view} className="text-2xl font-semibold tracking-tight text-white">{meta.title}</h2>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">{meta.description}</p>
    </header>
    {children}
  </section>;
}

// Deferred initialization avoids probing every advanced subsystem on the home screen.
export function ExpertPanel({id,title,description,children,reveal=false}: {
  id:string; title:string; description:string; children:ReactNode; reveal?:boolean;
}) {
  const [open,setOpen]=useState(reveal);
  const [visited,setVisited]=useState(reveal);
  const [previousReveal,setPreviousReveal]=useState(reveal);
  if(reveal!==previousReveal){
    setPreviousReveal(reveal);
    if(reveal){setOpen(true);setVisited(true);}
  }
  return <details id={id} open={open} onToggle={event=>{
    const next=event.currentTarget.open;setOpen(next);if(next)setVisited(true);
  }} className="mb-3 rounded-xl border border-slate-800 bg-slate-900/40">
    <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-200 marker:text-slate-500">
      {title}<span className="mt-1 block pl-4 text-xs font-normal leading-5 text-slate-500">{description}</span>
    </summary>
    {(visited || open) && <div className="border-t border-slate-800 p-4">{children}</div>}
  </details>;
}
export function TaskEntry({title,readiness,onOpen}: {
  title:string; readiness:WorkspaceTaskAvailability; onOpen:()=>void;
}) {
  const color=readiness.state==='available' ? 'text-cyan-300' :
    readiness.state==='planning' ? 'text-amber-300' : 'text-slate-400';
  return <button type="button" onClick={onOpen} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-left transition hover:border-slate-600 hover:bg-slate-900">
    <span className="block text-base font-semibold text-white">{title}</span>
    <span className={'mt-2 block text-xs font-medium '+color}>{readiness.label}</span>
    <span className="mt-2 block text-xs leading-5 text-slate-500">{readiness.detail}</span>
    <span className="mt-3 block text-xs font-semibold text-slate-300">Open workspace →</span>
  </button>;
}
