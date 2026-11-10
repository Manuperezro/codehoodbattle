import React, { useEffect, useState } from 'react';
import { Bot, Flag, Zap, Plus, Trash2, Info } from 'lucide-react';
import { RobotDirection, RobotGridConfig } from '../types/game';
import { GuidedCodeEditor } from './GuidedCodeEditor';
import { sound } from '../utils/sound';

interface RobotProgrammerEngineProps {
  config: RobotGridConfig;
  lines: string[];
  onChangeLines: (newLines: string[]) => void;
  robotPath?: Array<{
    x: number;
    y: number;
    dir: RobotDirection;
    status: 'moving' | 'obstacle' | 'out_of_bounds' | 'goal';
  }>;
  disabled?: boolean;
}

export const RobotProgrammerEngine: React.FC<RobotProgrammerEngineProps> = ({
  config,
  lines,
  onChangeLines,
  robotPath,
  disabled = false,
}) => {
  const [stepIndex, setStepIndex] = useState<number>(0);

  // Animate robot path when robotPath updates
  useEffect(() => {
    if (!robotPath || robotPath.length === 0) {
      setStepIndex(0);
      return;
    }
    setStepIndex(0);
    if (robotPath.length <= 1) return;

    const timer = setInterval(() => {
      setStepIndex((prev) => {
        if (prev < robotPath.length - 1) {
          return prev + 1;
        }
        clearInterval(timer);
        return prev;
      });
    }, 320);

    return () => clearInterval(timer);
  }, [robotPath]);

  const currentPos =
    robotPath && robotPath[stepIndex]
      ? robotPath[stepIndex]
      : {
          x: config.start.x,
          y: config.start.y,
          dir: config.start.dir,
          status: 'moving' as const,
        };

  const handleAddCommand = (cmd: string) => {
    if (disabled) return;
    sound.playClick();
    onChangeLines([...lines, cmd]);
  };

  const handleRemoveLastLine = () => {
    if (disabled || lines.length <= 1) return;
    sound.playClick();
    onChangeLines(lines.slice(0, -1));
  };

  const handleLineEdit = (idx: number, val: string) => {
    const copy = [...lines];
    copy[idx] = val;
    onChangeLines(copy);
  };

  return (
    <div className="space-y-4">
      {/* Important Educational Notice required by Section 8E */}
      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-teal-950/50 border border-teal-500/40 text-xs sm:text-sm text-teal-200">
        <Info className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
        <div>
          <strong>Robot Arena Note:</strong> Commands like{' '}
          <code className="px-1.5 py-0.5 rounded bg-slate-900 text-teal-300 font-mono">
            move_right()
          </code>{' '}
          and{' '}
          <code className="px-1.5 py-0.5 rounded bg-slate-900 text-teal-300 font-mono">
            move_down()
          </code>{' '}
          are <strong>game-specific robot instructions</strong> created for this puzzle, while{' '}
          <code className="px-1.5 py-0.5 rounded bg-slate-900 text-amber-300 font-mono">
            for step in range(...):
          </code>{' '}
          is real built-in Python!
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* 2D Visual Robot Grid */}
        <div className="lg:col-span-5 rounded-xl border-2 border-arena-border bg-slate-950 p-4 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono uppercase tracking-wider text-teal-300 font-semibold flex items-center gap-1.5">
              <Bot className="w-4 h-4" /> 2D Arena Grid ({config.width} × {config.height})
            </span>
            <span className="text-xs font-mono text-slate-400">
              Robo-Py: ({currentPos.x}, {currentPos.y})
            </span>
          </div>

          <div
            className="grid gap-2 mx-auto max-w-[300px]"
            style={{
              gridTemplateColumns: `repeat(${config.width}, minmax(0, 1fr))`,
            }}
            role="grid"
            aria-label="Robot navigation grid"
          >
            {Array.from({ length: config.height }).map((_, rowY) =>
              Array.from({ length: config.width }).map((__, colX) => {
                const isRobotHere =
                  currentPos.x === colX && currentPos.y === rowY;
                const isGoal =
                  config.goal.x === colX && config.goal.y === rowY;
                const obstacle = config.obstacles.find(
                  (o) => o.x === colX && o.y === rowY
                );
                const wasVisited =
                  robotPath
                    ?.slice(0, stepIndex + 1)
                    .some((p) => p.x === colX && p.y === rowY) ?? false;

                return (
                  <div
                    key={`${colX}-${rowY}`}
                    role="gridcell"
                    aria-label={`Grid cell (${colX}, ${rowY})`}
                    className={`aspect-square rounded-xl border-2 flex flex-col items-center justify-center relative transition-all duration-200 ${
                      isRobotHere && currentPos.status === 'obstacle'
                        ? 'bg-rose-950/90 border-rose-500'
                        : isRobotHere
                        ? 'bg-sky-500/30 border-sky-400 shadow-[0_0_15px_rgba(14,165,233,0.4)]'
                        : obstacle
                        ? 'bg-rose-950/40 border-rose-500/50'
                        : isGoal
                        ? 'bg-emerald-950/50 border-emerald-400/70'
                        : wasVisited
                        ? 'bg-sky-950/30 border-sky-500/30'
                        : 'bg-slate-900 border-slate-800'
                    }`}
                  >
                    <span className="absolute top-1 left-1.5 text-[10px] font-mono text-slate-500">
                      {colX},{rowY}
                    </span>

                    {obstacle && (
                      <div className="flex flex-col items-center text-rose-400">
                        <Zap className="w-5 h-5" />
                        <span className="text-[10px] font-mono uppercase">
                          Laser
                        </span>
                      </div>
                    )}

                    {isGoal && !isRobotHere && (
                      <div className="flex flex-col items-center text-emerald-400">
                        <Flag className="w-5 h-5" />
                        <span className="text-[10px] font-mono uppercase">
                          Portal
                        </span>
                      </div>
                    )}

                    {isRobotHere && (
                      <div className="flex flex-col items-center text-sky-300 z-10">
                        <Bot className="w-7 h-7 animate-bounce" />
                        <span className="text-[10px] font-bold font-mono text-white">
                          ROBO-PY
                        </span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Command Palette + Guided Loop Editor */}
        <div className="lg:col-span-7 space-y-3">
          <div className="rounded-xl border border-arena-border bg-slate-900/90 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Quick-Insert Robot & Loop Blocks:
              </span>
              <button
                type="button"
                disabled={disabled || lines.length <= 1}
                onClick={handleRemoveLastLine}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 disabled:opacity-40 text-rose-300 border border-rose-500/30 text-xs font-medium transition"
              >
                <Trash2 className="w-3.5 h-3.5" /> Remove Last Line
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {config.availableCommands.map((cmd, i) => (
                <button
                  key={i}
                  type="button"
                  disabled={disabled}
                  onClick={() => handleAddCommand(cmd)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-sky-500/20 text-sky-200 border border-slate-700 hover:border-sky-400 font-mono text-xs transition"
                >
                  <Plus className="w-3 h-3 text-sky-400" />
                  {cmd.replace(/^ {4}/, '↳ 4sp: ')}
                </button>
              ))}
            </div>
          </div>

          <GuidedCodeEditor
            lines={lines}
            editableLineIndices={lines.map((_, i) => i)}
            onChangeLine={handleLineEdit}
            disabled={disabled}
            engineLabel="Robot Loop Controller"
          />
        </div>
      </div>
    </div>
  );
};

