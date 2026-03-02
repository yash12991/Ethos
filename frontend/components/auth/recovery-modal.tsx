"use client";

import { Copy, ShieldAlert } from "lucide-react";
import { useState } from "react";

type RecoveryModalProps = {
  isOpen: boolean;
  phrase: string;
  onContinue: () => void;
};

export function RecoveryModal({ isOpen, phrase, onContinue }: RecoveryModalProps) {
  const [isAcknowledged, setIsAcknowledged] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(phrase);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="recovery-title"
      className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/20">
        <h2 id="recovery-title" className="text-xl font-semibold text-slate-900">
          Save Your Recovery Phrase
        </h2>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="font-mono text-base text-slate-800">{phrase}</p>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          <Copy size={16} />
          {copied ? "Copied" : "Copy to clipboard"}
        </button>

        <p className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-red-600">
          <ShieldAlert size={16} />
          This phrase will not be shown again.
        </p>

        <label className="mt-4 flex items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={isAcknowledged}
            onChange={(event) => setIsAcknowledged(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-400"
          />
          I have saved this safely.
        </label>

        <button
          type="button"
          disabled={!isAcknowledged}
          onClick={onContinue}
          className="mt-5 w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
