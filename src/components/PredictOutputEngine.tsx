import React from 'react';
import { Eye, Terminal } from 'lucide-react';
import { HighlightedPythonLine } from './SyntaxHighlighter';

interface PredictOutputEngineProps {
  lines: string[];
  prediction: string;
  onChangePrediction: (val: string) => void;
  disabled?: boolean;
  expectedLineCount?: number;
}

export const PredictOutputEngine: React.FC<PredictOutputEngineProps> = ({
  lines,
  prediction,
  onChangePrediction,
  disabled = false,
  expectedLineCount = 1,
}) => {
  return (
    <div className="space-y-4">
      {/* Read-only Python program */}
      <div className="rounded-xl border-2 border-arena-border bg-slate-950/95 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-arena-border">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-amber-300 font-semibold">
            <Eye className="w-4 h-4" />
            Read & Trace This Python Program
          </div>
          <span className="text-xs text-slate-400">Read-Only Code</span>
        </div>

        <div className="p-4 space-y-2 font-mono text-base sm:text-lg">
          {lines.map((lineText, idx) => (
            <div
              key={idx}
              className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-900/70"
            >
              <span className="w-7 text-right text-xs text-slate-500 font-mono select-none">
                {idx + 1}
              </span>
              <div className="overflow-x-auto flex-1">
                <HighlightedPythonLine line={lineText} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Prediction Input */}
      <div className="rounded-xl border-2 border-sky-500/50 bg-slate-900/90 p-4 shadow-lg">
        <label
          htmlFor="predict-output-input"
          className="flex items-center gap-2 text-sm font-semibold text-sky-300 mb-2"
        >
          <Terminal className="w-4 h-4" />
          What will this program print in the terminal?
          {expectedLineCount > 1 && (
            <span className="text-xs font-normal text-slate-300">
              (Type {expectedLineCount} lines — press Enter for a new line)
            </span>
          )}
        </label>
        {expectedLineCount > 1 ? (
          <textarea
            id="predict-output-input"
            rows={expectedLineCount + 1}
            value={prediction}
            disabled={disabled}
            onChange={(e) => onChangePrediction(e.target.value)}
            placeholder="Type the exact output here (without quotation marks)..."
            className="w-full rounded-lg bg-slate-950 border-2 border-slate-700 focus:border-sky-400 px-3.5 py-2.5 font-mono text-base sm:text-lg text-emerald-300 placeholder-slate-500 focus:outline-none"
          />
        ) : (
          <input
            id="predict-output-input"
            type="text"
            value={prediction}
            disabled={disabled}
            onChange={(e) => onChangePrediction(e.target.value)}
            placeholder="Type the exact output here (without quotation marks)..."
            className="w-full rounded-lg bg-slate-950 border-2 border-slate-700 focus:border-sky-400 px-3.5 py-2.5 font-mono text-base sm:text-lg text-emerald-300 placeholder-slate-500 focus:outline-none"
          />
        )}
      </div>
    </div>
  );
};

