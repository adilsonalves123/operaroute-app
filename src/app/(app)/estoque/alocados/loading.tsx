export default function EstoqueAlocadosLoading() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 animate-pulse">
      <div className="h-10 w-64 rounded-lg bg-slate-800" />
      <div className="h-4 w-96 max-w-full rounded bg-slate-800/80" />
      <div className="flex gap-2">
        <div className="h-8 w-24 rounded-lg bg-slate-800" />
        <div className="h-8 w-24 rounded-lg bg-slate-800" />
        <div className="h-8 w-24 rounded-lg bg-slate-800" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="h-20 rounded-xl bg-slate-800/60" />
        <div className="h-20 rounded-xl bg-slate-800/60" />
        <div className="h-20 rounded-xl bg-slate-800/60" />
      </div>
      <div className="space-y-3">
        <div className="h-28 rounded-xl bg-slate-800/50" />
        <div className="h-28 rounded-xl bg-slate-800/50" />
      </div>
    </div>
  );
}
