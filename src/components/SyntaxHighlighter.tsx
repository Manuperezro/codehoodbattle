import React from 'react';

const PYTHON_KEYWORDS = new Set([
  'for',
  'in',
  'if',
  'elif',
  'else',
  'break',
  'and',
  'or',
  'not',
  'True',
  'False',
]);

const PYTHON_BUILTINS = new Set([
  'print',
  'input',
  'int',
  'float',
  'range',
  'lower',
]);

const ROBOT_COMMANDS = new Set([
  'move_right',
  'move_left',
  'move_up',
  'move_down',
]);

export const HighlightedPythonLine: React.FC<{ line: string }> = ({ line }) => {
  if (!line) return <span>&nbsp;</span>;

  // Tokenize preserving whitespace, strings, words, numbers and symbols
  const tokens =
    line.match(/(".*?"|'.*?'|\b[A-Za-z_][A-Za-z0-9_]*\b|\b\d+(?:\.\d+)?\b|\s+|.)/g) || [
      line,
    ];

  return (
    <span className="font-mono whitespace-pre">
      {tokens.map((token, idx) => {
        if (
          (token.startsWith('"') && token.endsWith('"')) ||
          (token.startsWith("'") && token.endsWith("'")) ||
          token.startsWith('"') ||
          token.startsWith("'")
        ) {
          return (
            <span key={idx} className="text-emerald-300">
              {token}
            </span>
          );
        }
        if (PYTHON_KEYWORDS.has(token)) {
          return (
            <span key={idx} className="text-amber-400 font-semibold">
              {token}
            </span>
          );
        }
        if (PYTHON_BUILTINS.has(token)) {
          return (
            <span key={idx} className="text-sky-300 font-medium">
              {token}
            </span>
          );
        }
        if (ROBOT_COMMANDS.has(token)) {
          return (
            <span key={idx} className="text-teal-300 font-semibold">
              {token}
            </span>
          );
        }
        if (/^\d+(\.\d+)?$/.test(token)) {
          return (
            <span key={idx} className="text-purple-300">
              {token}
            </span>
          );
        }
        if (token === '____') {
          return (
            <span
              key={idx}
              className="bg-amber-500/30 text-amber-200 px-1 rounded border border-amber-400/50"
            >
              {token}
            </span>
          );
        }
        return (
          <span key={idx} className="text-slate-100">
            {token}
          </span>
        );
      })}
    </span>
  );
};

