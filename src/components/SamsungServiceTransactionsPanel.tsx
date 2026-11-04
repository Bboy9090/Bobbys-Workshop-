import { useSamsungServiceTransactions } from '../hooks/useSamsungServiceTransactions';

function stageLabel(stage: string): string {
  return stage.split('_').join(' ');
}

export default function SamsungServiceTransactionsPanel() {
  const {
    orderedTransactions,
    activeCount,
    removeTransaction,
    clearTerminalTransactions,
  } = useSamsungServiceTransactions();

  return (
    <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-cyan-400">
            Samsung service transaction monitor
          </div>
          <div className="mt-1 text-sm font-medium text-white">
            Parallel service telemetry keyed by backend transaction ID
          </div>
          <div className="mt-1 text-xs leading-5 text-slate-500">
            Events are isolated by transactionId. Unknown mid-stream events and updates after a terminal state are ignored.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded bg-slate-900 px-2 py-1 text-[10px] text-slate-400">
            active {activeCount}
          </span>
          <button
            type="button"
            onClick={clearTerminalTransactions}
            disabled={!orderedTransactions.some((transaction) => transaction.terminal)}
            className="rounded border border-slate-700 px-2 py-1 text-[10px] text-slate-300 disabled:opacity-30 hover:bg-slate-900"
          >
            Clear completed
          </button>
        </div>
      </div>

      {!orderedTransactions.length ? (
        <div className="mt-3 rounded border border-slate-800 bg-black/20 p-3 text-xs text-slate-600">
          No Samsung service transactions are currently being tracked.
        </div>
      ) : (
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {orderedTransactions.map((transaction) => {
            const failed = transaction.stage === 'failed';
            const complete = transaction.stage === 'complete';
            const terminal = failed || complete;

            return (
              <article
                key={transaction.transactionId}
                className={
                  failed
                    ? 'rounded border border-rose-900/60 bg-rose-950/10 p-3'
                    : complete
                      ? 'rounded border border-emerald-900/60 bg-emerald-950/10 p-3'
                      : 'rounded border border-cyan-900/50 bg-black/20 p-3'
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-mono text-[10px] text-slate-500">
                      {transaction.transactionId}
                    </div>
                    <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-white">
                      {stageLabel(transaction.stage)}
                    </div>
                    {(transaction.serial || transaction.targetCsc) && (
                      <div className="mt-1 text-[10px] text-slate-500">
                        {transaction.serial ? `serial ${transaction.serial}` : ''}
                        {transaction.serial && transaction.targetCsc ? ' · ' : ''}
                        {transaction.targetCsc ? `CSC ${transaction.targetCsc}` : ''}
                      </div>
                    )}
                  </div>

                  {terminal && (
                    <button
                      type="button"
                      onClick={() => removeTransaction(transaction.transactionId)}
                      className="rounded border border-slate-800 px-2 py-1 text-[10px] text-slate-500 hover:bg-slate-900"
                    >
                      Dismiss
                    </button>
                  )}
                </div>

                <div className="mt-3 h-2 overflow-hidden rounded bg-slate-900">
                  <div
                    className={
                      failed
                        ? 'h-full bg-rose-500 transition-[width] duration-300'
                        : complete
                          ? 'h-full bg-emerald-500 transition-[width] duration-300'
                          : 'h-full bg-cyan-500 transition-[width] duration-300'
                    }
                    style={{ width: `${transaction.percent}%` }}
                  />
                </div>

                <div className="mt-1 flex justify-between text-[10px] text-slate-600">
                  <span>{transaction.detail}</span>
                  <span className="font-mono">{transaction.percent}%</span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
