import React, { useState } from 'react';
import { Lock, Edit3, CornerDownRight } from 'lucide-react';
import { HighlightedPythonLine } from './SyntaxHighlighter';

interface GuidedCodeEditorProps {
  lines: string[];
  editableLineIndices: number[];
  onChangeLine: (lineIndex: number, newValue: string) => void;
  disabled?: boolean;
  engineLabel?: string;
}

export const GuidedCodeEditor: React.FC<GuidedCodeEditorProps> = ({
  lines,
  editableLineIndices,
  onChangeLine,
  disabled = false,
  engineLabel = 'Guided Python Editor',
}) => {
  const [focusedLine, setFocusedLine] = useState<number | null>(
    editableLineIndices[0] ?? null
  );

  const editableSet = new Set(editableLineIndices);

  const handleIndent = (lineIdx: number, deltaSpaces: number) => {
    if (disabled) return;
    const current = lines[lineIdx] || '';
    if (deltaSpaces > 0) {
      onChangeLine(lineIdx, ' '.repeat(deltaSpaces) + current);
    } else {
      const removeCount = Math.min(
        Math.abs(deltaSpaces),
        (current.match(/^( *)/)?.[1] || '').length
      );
      onChangeLine(lineIdx, current.slice(removeCount));
    }
  };

  return (
    <div className="rounded-xl border-2 border-arena-border bg-slate-950/95 shadow-xl overflow-hidden">
      {/* Editor Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-slate-900 border-b border-arena-border">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-rose-500/80" />
          <span className="w-3 h-3 rounded-full bg-amber-400/80" />
          <span className="w-3 h-3 rounded-full bg-emerald-400/80" />
          <span className="ml-2 text-xs font-mono uppercase tracking-wider text-sky-300 font-semibold">
            main.py — {engineLabel}
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-300">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
            <Edit3 className="w-3.5 h-3.5" /> Editable Line
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
            <Lock className="w-3.5 h-3.5" /> Locked Line
          </span>
        </div>
      </div>

      {/* Indentation helper bar for focused editable line */}
      {focusedLine !== null && editableSet.has(focusedLine) && !disabled && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-slate-900/60 border-b border-slate-800 text-xs">
          <span className="text-slate-300 flex items-center gap-1.5">
            <CornerDownRight className="w-3.5 h-3.5 text-sky-400" />
            Editing <strong>Line {focusedLine + 1}</strong>
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleIndent(focusedLine, 4)}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 font-mono transition focus:outline-none focus:ring-2 focus:ring-sky-400"
              title="Add 4 spaces indentation at start of line"
            >
              +4 Spaces (Indent)
            </button>
            <button
              type="button"
              onClick={() => handleIndent(focusedLine, -4)}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 font-mono transition focus:outline-none focus:ring-2 focus:ring-sky-400"
              title="Remove 4 spaces indentation from start of line"
            >
              -4 Spaces
            </button>
          </div>
        </div>
      )}

      {/* Code Lines */}
      <div className="p-3 sm:p-4 space-y-2 font-mono text-base sm:text-lg">
        {lines.map((lineText, idx) => {
          const isEditable = editableSet.has(idx);
          const isFocused = focusedLine === idx;

          if (!isEditable) {
            return (
              <div
                key={idx}
                className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-900/50 border border-transparent text-slate-300 select-none"
                aria-label={`Line ${idx + 1}, locked: ${lineText}`}
              >
                <span className="w-7 text-right text-xs text-slate-500 font-mono select-none">
                  {idx + 1}
                </span>
                <Lock
                  className="w-3.5 h-3.5 text-slate-600 shrink-0"
                  aria-hidden="true"
                />
                <div className="overflow-x-auto flex-1">
                  <HighlightedPythonLine line={lineText} />
                </div>
              </div>
            );
          }

          return (
            <div
              key={idx}
              className={`flex flex-col gap-1 px-3 py-2 rounded-lg transition border-2 ${
                isFocused
                  ? 'bg-sky-950/40 border-sky-400 shadow-[0_0_15px_rgba(14,165,233,0.2)]'
                  : 'bg-slate-900/90 border-sky-500/40 hover:border-sky-400/70'
              }`}
            >
              <div className="flex items-center gap-3">
                <label
                  htmlFor={`code-line-${idx}`}
                  className="w-7 text-right text-xs font-bold text-sky-400 font-mono select-none cursor-pointer"
                >
                  {idx + 1}
                </label>
                <Edit3
                  className="w-4 h-4 text-sky-400 shrink-0"
                  aria-hidden="true"
                />
                <input
                  id={`code-line-${idx}`}
                  type="text"
                  value={lineText}
                  disabled={disabled}
                  onFocus={() => setFocusedLine(idx)}
                  onChange={(e) => onChangeLine(idx, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Tab' && !e.shiftKey) {
                      // Allow normal keyboard tab navigation unless Alt+I is pressed, or keep standard accessibility
                    }
                  }}
                  spellCheck={false}
                  autoCapitalize="off"
                  autoComplete="off"
                  autoCorrect="off"
                  aria-label={`Editable Python code line ${idx + 1}`}
                  className="w-full bg-transparent text-slate-100 font-mono text-base sm:text-lg focus:outline-none placeholder-slate-500"
                  placeholder="Type your Python code here..."
                />
              </div>
              {/* Syntax highlighted live preview underneath the input for readability */}
              <div className="pl-14 text-xs sm:text-sm opacity-90 flex items-center gap-2 overflow-x-auto">
                <span className="text-slate-400 text-[11px] uppercase tracking-wider shrink-0">
                  Preview:
                </span>
                <HighlightedPythonLine line={lineText} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

