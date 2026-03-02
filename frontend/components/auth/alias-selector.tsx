import { RefreshCcw } from "lucide-react";
import { LoadingSkeleton } from "@/components/auth/loading-skeleton";

type AliasSelectorProps = {
  suggestions: string[];
  selectedAlias: string;
  isLoading: boolean;
  onSelect: (alias: string) => void;
  onRefresh: () => void;
};

export function AliasSelector({
  suggestions,
  selectedAlias,
  isLoading,
  onSelect,
  onRefresh,
}: AliasSelectorProps) {
  return (
    <section aria-labelledby="alias-title" className="space-y-3 rounded-2xl border border-slate-200/70 bg-white/50 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 id="alias-title" className="text-sm font-semibold text-slate-800">
          Alias Suggestions
        </h2>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <RefreshCcw size={14} className={isLoading ? "animate-spin" : ""} />
          Refresh Suggestions
        </button>
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Alias suggestions">
          {suggestions.map((alias) => {
            const isSelected = selectedAlias === alias;

            return (
              <button
                type="button"
                role="radio"
                aria-checked={isSelected}
                key={alias}
                onClick={() => onSelect(alias)}
                className={`rounded-xl border px-3 py-2 text-left text-sm font-medium transition ${
                  isSelected
                    ? "border-blue-400 bg-blue-50 text-blue-700"
                    : "border-slate-300 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50/40"
                }`}
              >
                {alias}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
