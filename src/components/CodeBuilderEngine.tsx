import React, { useState } from 'react';
import { ArrowUp, ArrowDown, GripVertical, Layers } from 'lucide-react';
import { HighlightedPythonLine } from './SyntaxHighlighter';
import { sound } from '../utils/sound';

interface CodeBuilderEngineProps {
  blocks: string[];
  onChangeBlocks: (newBlocks: string[]) => void;
  disabled?: boolean;
}

export const CodeBuilderEngine: React.FC<CodeBuilderEngineProps> = ({
  blocks,
  onChangeBlocks,
  disabled = false,
}) => {
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const moveBlock = (fromIdx: number, toIdx: number) => {
    if (disabled || toIdx < 0 || toIdx >= blocks.length || fromIdx === toIdx) return;
    sound.playClick();
    const updated = [...blocks];
    const [moved] = updated.splice(fromIdx, 1);
    updated.splice(toIdx, 0, moved);
    onChangeBlocks(updated);
  };

  return (
    <div className="rounded-xl border-2 border-arena-border bg-slate-950/95 shadow-xl overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-slate-900 border-b border-arena-border">
        <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-teal-300 font-semibold">
          <Layers className="w-4 h-4" />
          Code Builder — Drag or Use Buttons to Order Lines
        </div>
        <span className="text-xs text-slate-300">
          Top (Line 1) runs first → Bottom runs last
        </span>
      </div>

      <div className="p-4 space-y-2.5" role="list" aria-label="Reorderable Python code lines">
        {blocks.map((blockText, idx) => {
          const isBeingDragged = draggedIdx === idx;
          const isDropTarget = dragOverIdx === idx && draggedIdx !== idx;

          return (
            <div
              key={`${idx}-${blockText}`}
              role="listitem"
              draggable={!disabled}
              onDragStart={() => setDraggedIdx(idx)}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverIdx(idx);
              }}
              onDragEnd={() => {
                setDraggedIdx(null);
                setDragOverIdx(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (draggedIdx !== null && draggedIdx !== idx) {
                  moveBlock(draggedIdx, idx);
                }
                setDraggedIdx(null);
                setDragOverIdx(null);
              }}
              className={`flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl border-2 transition ${
                isDropTarget
                  ? 'border-teal-400 bg-teal-950/40'
                  : isBeingDragged
                  ? 'opacity-50 border-sky-400 bg-slate-900'
                  : 'border-slate-700/80 bg-slate-900/90 hover:border-sky-500/60'
              } ${!disabled ? 'cursor-grab active:cursor-grabbing' : ''}`}
            >
              <div className="flex items-center gap-3 overflow-x-auto flex-1">
                <GripVertical
                  className="w-5 h-5 text-slate-500 shrink-0"
                  aria-hidden="true"
                />
                <span className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-mono font-bold text-sky-300 shrink-0">
                  {idx + 1}
                </span>
                <div className="text-base sm:text-lg font-mono">
                  <HighlightedPythonLine line={blockText} />
                </div>
              </div>

              {/* Accessible keyboard controls */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  disabled={disabled || idx === 0}
                  onClick={() => moveBlock(idx, idx - 1)}
                  aria-label={`Move line ${idx + 1} up`}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-sky-600/30 disabled:opacity-30 disabled:hover:bg-slate-800 text-slate-200 border border-slate-600 transition flex items-center gap-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-sky-400"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Move Up</span>
                </button>
                <button
                  type="button"
                  disabled={disabled || idx === blocks.length - 1}
                  onClick={() => moveBlock(idx, idx + 1)}
                  aria-label={`Move line ${idx + 1} down`}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-sky-600/30 disabled:opacity-30 disabled:hover:bg-slate-800 text-slate-200 border border-slate-600 transition flex items-center gap-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-sky-400"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Move Down</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

