import {
  Challenge,
  RobotDirection,
  RobotGridConfig,
  ValidationResult,
} from '../types/game';

/**
 * Normalises a line of Python code for equivalence checking:
 * - Converts single-quoted strings to double-quoted strings where valid
 * - Normalises spacing around operators and commas (preserving leading indentation)
 */
export function normalisePythonLine(line: string): string {
  const leadingSpacesMatch = line.match(/^( *)/);
  const indent = leadingSpacesMatch ? leadingSpacesMatch[1] : '';
  let trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return '';

  // Convert valid 'single quoted' strings to "double quoted" strings
  trimmed = trimmed.replace(/'([^'\\]*)'/g, '"$1"');

  // Normalise whitespace outside string literals
  const parts: string[] = [];
  let inString = false;
  let current = '';

  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (ch === '"') {
      if (inString) {
        current += ch;
        parts.push(current);
        current = '';
        inString = false;
      } else {
        if (current) parts.push(current);
        current = '"';
        inString = true;
      }
    } else {
      current += ch;
    }
  }
  if (current) parts.push(current);

  const normalisedParts = parts.map((part) => {
    if (part.startsWith('"') && part.endsWith('"')) {
      return part;
    }
    return part
      .replace(/\s*(==|!=|>=|<=)\s*/g, ' $1 ')
      .replace(/\s*([=+\-*/<>])\s*/g, ' $1 ')
      // Fix negative numbers like (3, 0, - 1) -> (3, 0, -1)
      .replace(/([,(])\s*-\s*(\d+)/g, '$1 -$2')
      .replace(/\s*,\s*/g, ', ')
      .replace(/\(\s+/g, '(')
      .replace(/\s+\)/g, ')')
      .replace(/\s+:/g, ':')
      .replace(/\s+/g, ' ');
  });

  return indent + normalisedParts.join('').trim();
}

export function normalisePythonProgram(code: string): string {
  return code
    .split(/\r?\n/)
    .map(normalisePythonLine)
    .filter((line) => line.length > 0)
    .join('\n');
}

interface SimValue {
  type: 'int' | 'float' | 'str' | 'bool';
  value: number | string | boolean;
}

interface SimulatorOutput {
  ok: boolean;
  outputLines: string[];
  errorType?: string;
  errorMessage?: string;
  errorPattern?: string;
  robotPath?: Array<{
    x: number;
    y: number;
    dir: RobotDirection;
    status: 'moving' | 'obstacle' | 'out_of_bounds' | 'goal';
  }>;
}

/**
 * Safe, deterministic Python subset simulator (No eval() or Function() used).
 * Supports Gateway Level 2 Weeks 1-7 concepts:
 * print(), input(), int(), float(), .lower(), variables, +, -, *, /,
 * comparisons (==, !=, >=, <=, >, <), logical (and, or),
 * if/elif/else, for ... in range(...), break, and Robot Programmer commands.
 */
export function simulatePythonProgram(
  code: string,
  simulatedInputs: string[] = [],
  robotConfig?: RobotGridConfig
): SimulatorOutput {
  const rawLines = code.split(/\r?\n/);
  const outputLines: string[] = [];
  const env: Record<string, SimValue> = {};
  let inputCursor = 0;

  // Check common syntax mistakes line by line first
  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i];
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Check placeholders still left in code
    if (trimmed.includes('____')) {
      return {
        ok: false,
        outputLines,
        errorType: 'SyntaxError',
        errorMessage: `Line ${i + 1}: Replace the ____ blank with valid Python code.`,
        errorPattern: 'unfilled_blank',
      };
    }

    // Check capital Print / If / For
    if (/^(Print|PRINT)\s*\(/.test(trimmed)) {
      return {
        ok: false,
        outputLines,
        errorType: 'NameError',
        errorMessage: `Line ${i + 1}: NameError: name 'Print' is not defined. Did you mean lowercase 'print'?`,
        errorPattern: 'uppercase_print',
      };
    }

    // Check unclosed quotes
    const doubleQuotes = (trimmed.match(/"/g) || []).length;
    const singleQuotes = (trimmed.match(/'/g) || []).length;
    if (doubleQuotes % 2 !== 0 || singleQuotes % 2 !== 0) {
      return {
        ok: false,
        outputLines,
        errorType: 'SyntaxError',
        errorMessage: `Line ${i + 1}: SyntaxError: unterminated string literal (check your quotation marks).`,
        errorPattern: 'missing_quote',
      };
    }

    // Check mismatched parentheses
    let depth = 0;
    let inQuote: string | null = null;
    for (const ch of trimmed) {
      if ((ch === '"' || ch === "'") && !inQuote) inQuote = ch;
      else if (ch === inQuote) inQuote = null;
      else if (!inQuote) {
        if (ch === '(') depth++;
        if (ch === ')') depth--;
      }
    }
    if (depth !== 0) {
      return {
        ok: false,
        outputLines,
        errorType: 'SyntaxError',
        errorMessage: `Line ${i + 1}: SyntaxError: unmatched brackets ( ). Check your opening and closing brackets.`,
        errorPattern: 'missing_parens',
      };
    }

    // Check 'else if' instead of 'elif'
    if (/^else\s+if\b/.test(trimmed)) {
      return {
        ok: false,
        outputLines,
        errorType: 'SyntaxError',
        errorMessage: `Line ${i + 1}: SyntaxError: invalid syntax. In Python, use 'elif' instead of 'else if'.`,
        errorPattern: 'used_else_if',
      };
    }

    // Check block headers (if, elif, else, for) for missing colons or single =
    if (/^(if|elif|else|for)\b/.test(trimmed)) {
      if (!trimmed.endsWith(':')) {
        return {
          ok: false,
          outputLines,
          errorType: 'SyntaxError',
          errorMessage: `Line ${i + 1}: SyntaxError: expected ':' at the end of the ${trimmed.split(/\s+/)[0]} statement.`,
          errorPattern: 'missing_colon',
        };
      }
      if (/^(if|elif)\b/.test(trimmed)) {
        const condPart = trimmed.replace(/^(if|elif)\s+/, '').slice(0, -1);
        if (condPart.includes('=>') || condPart.includes('=<')) {
          return {
            ok: false,
            outputLines,
            errorType: 'SyntaxError',
            errorMessage: `Line ${i + 1}: SyntaxError: write '>=' or '<=' with the equals sign second.`,
            errorPattern: 'reversed_operator',
          };
        }
        // Detect single = that isn't ==, !=, >=, <=
        if (/(?<![=!<>])=(?!=)/.test(condPart)) {
          return {
            ok: false,
            outputLines,
            errorType: 'SyntaxError',
            errorMessage: `Line ${i + 1}: SyntaxError: cannot assign inside an if condition. Use '==' to compare values.`,
            errorPattern: 'single_equals_in_if',
          };
        }
        if (/\b(AND|OR)\b/.test(condPart)) {
          return {
            ok: false,
            outputLines,
            errorType: 'SyntaxError',
            errorMessage: `Line ${i + 1}: SyntaxError: logical operators must be lowercase ('and' / 'or').`,
            errorPattern: 'uppercase_and',
          };
        }
      }
    }
  }

  // Robot state if robotConfig is provided
  const robotState = robotConfig
    ? {
        x: robotConfig.start.x,
        y: robotConfig.start.y,
        dir: robotConfig.start.dir,
        path: [
          {
            x: robotConfig.start.x,
            y: robotConfig.start.y,
            dir: robotConfig.start.dir,
            status: 'moving' as 'moving' | 'obstacle' | 'out_of_bounds' | 'goal',
          },
        ],
        crashed: false,
        crashReason: '',
        crashPattern: '',
      }
    : undefined;

  const applyRobotMove = (dx: number, dy: number, dir: RobotDirection) => {
    if (!robotConfig || !robotState || robotState.crashed) return;
    const nx = robotState.x + dx;
    const ny = robotState.y + dy;
    robotState.dir = dir;

    if (nx < 0 || nx >= robotConfig.width || ny < 0 || ny >= robotConfig.height) {
      robotState.crashed = true;
      robotState.crashReason = 'Robo-Py moved outside the arena grid boundaries!';
      robotState.crashPattern = 'out_of_bounds';
      robotState.path.push({ x: robotState.x, y: robotState.y, dir, status: 'out_of_bounds' });
      return;
    }

    const hitObstacle = robotConfig.obstacles.some((obs) => obs.x === nx && obs.y === ny);
    if (hitObstacle) {
      robotState.x = nx;
      robotState.y = ny;
      robotState.crashed = true;
      robotState.crashReason = `Robo-Py hit a laser barrier at (${nx}, ${ny})!`;
      robotState.crashPattern = 'hit_obstacle';
      robotState.path.push({ x: nx, y: ny, dir, status: 'obstacle' });
      return;
    }

    robotState.x = nx;
    robotState.y = ny;
    const isGoal = nx === robotConfig.goal.x && ny === robotConfig.goal.y;
    robotState.path.push({
      x: nx,
      y: ny,
      dir,
      status: isGoal ? 'goal' : 'moving',
    });
  };

  // Helper: evaluate a single atomic value or expression
  const evalExpr = (exprRaw: string, lineNum: number): SimValue => {
    let expr = exprRaw.trim();
    if (expr.startsWith('(') && expr.endsWith(')')) {
      // Check if outer parens wrap the whole expression
      let d = 0;
      let wrapsAll = true;
      for (let i = 0; i < expr.length - 1; i++) {
        if (expr[i] === '(') d++;
        if (expr[i] === ')') d--;
        if (d === 0) {
          wrapsAll = false;
          break;
        }
      }
      if (wrapsAll) expr = expr.slice(1, -1).trim();
    }

    // Handle .lower() suffix on string literal or variable
    if (expr.endsWith('.lower()')) {
      const baseExpr = expr.slice(0, -'.lower()'.length).trim();
      const baseVal = evalExpr(baseExpr, lineNum);
      if (baseVal.type !== 'str') {
        throw {
          type: 'TypeError',
          message: `Line ${lineNum}: .lower() can only be used on text strings.`,
        };
      }
      return { type: 'str', value: String(baseVal.value).toLowerCase() };
    }

    // Handle int(...) conversion
    if (/^int\s*\((.+)\)$/.test(expr)) {
      const inner = expr.replace(/^int\s*\(/, '').slice(0, -1);
      const val = evalExpr(inner, lineNum);
      const parsed = parseInt(String(val.value).trim(), 10);
      if (Number.isNaN(parsed)) {
        throw {
          type: 'ValueError',
          message: `Line ${lineNum}: ValueError: invalid literal for int(): '${val.value}'`,
        };
      }
      return { type: 'int', value: parsed };
    }

    // Handle float(...) conversion
    if (/^float\s*\((.+)\)$/.test(expr)) {
      const inner = expr.replace(/^float\s*\(/, '').slice(0, -1);
      const val = evalExpr(inner, lineNum);
      const parsed = parseFloat(String(val.value).trim());
      if (Number.isNaN(parsed)) {
        throw {
          type: 'ValueError',
          message: `Line ${lineNum}: ValueError: could not convert string to float: '${val.value}'`,
        };
      }
      return { type: 'float', value: parsed };
    }

    // Handle input(...)
    if (/^input\s*\((.*)\)$/.test(expr)) {
      const nextInput =
        inputCursor < simulatedInputs.length ? simulatedInputs[inputCursor++] : '';
      return { type: 'str', value: String(nextInput) };
    }

    // Check binary arithmetic outside quotes (+, -, *)
    // Split on top-level + or - first, then *
    const splitTopLevel = (text: string, operators: string[]): { left: string; op: string; right: string } | null => {
      let inQ: string | null = null;
      let pDepth = 0;
      for (let i = text.length - 1; i >= 0; i--) {
        const c = text[i];
        if ((c === '"' || c === "'") && !inQ) inQ = c;
        else if (c === inQ) inQ = null;
        else if (!inQ) {
          if (c === ')') pDepth++;
          else if (c === '(') pDepth--;
          else if (pDepth === 0 && operators.includes(c)) {
            // Ensure unary minus at start isn't treated as binary subtraction
            if (c === '-' && i === 0) continue;
            return {
              left: text.slice(0, i).trim(),
              op: c,
              right: text.slice(i + 1).trim(),
            };
          }
        }
      }
      return null;
    };

    const addSub = splitTopLevel(expr, ['+', '-']);
    if (addSub && addSub.left && addSub.right) {
      const lv = evalExpr(addSub.left, lineNum);
      const rv = evalExpr(addSub.right, lineNum);
      if (addSub.op === '+') {
        if (lv.type === 'str' && rv.type === 'str') {
          return { type: 'str', value: String(lv.value) + String(rv.value) };
        }
        if ((lv.type === 'int' || lv.type === 'float') && (rv.type === 'int' || rv.type === 'float')) {
          const isFloat = lv.type === 'float' || rv.type === 'float';
          return {
            type: isFloat ? 'float' : 'int',
            value: Number(lv.value) + Number(rv.value),
          };
        }
        throw {
          type: 'TypeError',
          message: `Line ${lineNum}: TypeError: cannot add ${lv.type} and ${rv.type}. Convert text numbers with int() or remove quotes.`,
          pattern: 'still_quoted',
        };
      } else {
        if ((lv.type === 'int' || lv.type === 'float') && (rv.type === 'int' || rv.type === 'float')) {
          const isFloat = lv.type === 'float' || rv.type === 'float';
          return {
            type: isFloat ? 'float' : 'int',
            value: Number(lv.value) - Number(rv.value),
          };
        }
        throw {
          type: 'TypeError',
          message: `Line ${lineNum}: TypeError: unsupported operand types for -: '${lv.type}' and '${rv.type}'.`,
        };
      }
    }

    const mulDiv = splitTopLevel(expr, ['*', '/']);
    if (mulDiv && mulDiv.left && mulDiv.right) {
      const lv = evalExpr(mulDiv.left, lineNum);
      const rv = evalExpr(mulDiv.right, lineNum);
      if ((lv.type === 'int' || lv.type === 'float') && (rv.type === 'int' || rv.type === 'float')) {
        if (mulDiv.op === '*') {
          const isFloat = lv.type === 'float' || rv.type === 'float';
          return {
            type: isFloat ? 'float' : 'int',
            value: Number(lv.value) * Number(rv.value),
          };
        } else {
          return {
            type: 'float',
            value: Number(lv.value) / Number(rv.value),
          };
        }
      }
      throw {
        type: 'TypeError',
        message: `Line ${lineNum}: TypeError: cannot multiply/divide '${lv.type}' and '${rv.type}'.`,
      };
    }

    // Detect "width x height" mistake
    if (/^[a-zA-Z_]\w*\s+x\s+[a-zA-Z0-9_]+$/.test(expr)) {
      throw {
        type: 'SyntaxError',
        message: `Line ${lineNum}: SyntaxError: 'x' is not a multiplication operator in Python. Use '*' instead.`,
        pattern: 'used_x_multiply',
      };
    }

    // String literal
    if (
      (expr.startsWith('"') && expr.endsWith('"')) ||
      (expr.startsWith("'") && expr.endsWith("'"))
    ) {
      return { type: 'str', value: expr.slice(1, -1) };
    }

    // Integer literal
    if (/^-?\d+$/.test(expr)) {
      return { type: 'int', value: parseInt(expr, 10) };
    }

    // Float literal
    if (/^-?\d+\.\d+$/.test(expr)) {
      return { type: 'float', value: parseFloat(expr) };
    }

    // Variable lookup
    if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(expr)) {
      if (expr in env) {
        return env[expr];
      }
      throw {
        type: 'NameError',
        message: `Line ${lineNum}: NameError: name '${expr}' is not defined. Did you forget quotation marks around text, or use a variable before setting it?`,
        pattern: 'unquoted_string',
      };
    }

    throw {
      type: 'SyntaxError',
      message: `Line ${lineNum}: SyntaxError: could not evaluate '${expr}'.`,
    };
  };

  const evalCondition = (condRaw: string, lineNum: number): boolean => {
    const cond = condRaw.trim();
    if (cond.includes(' and ')) {
      const parts = cond.split(/\band\b/);
      return parts.every((p) => evalCondition(p, lineNum));
    }
    if (cond.includes(' or ')) {
      const parts = cond.split(/\bor\b/);
      return parts.some((p) => evalCondition(p, lineNum));
    }

    const match = cond.match(/^(.+?)\s*(==|!=|>=|<=|>|<)\s*(.+)$/);
    if (!match) {
      throw {
        type: 'SyntaxError',
        message: `Line ${lineNum}: SyntaxError: invalid condition '${cond}'.`,
      };
    }

    const [, leftRaw, op, rightRaw] = match;
    const lv = evalExpr(leftRaw, lineNum);
    const rv = evalExpr(rightRaw, lineNum);

    if (op === '==') return lv.type === rv.type && lv.value === rv.value;
    if (op === '!=') return lv.type !== rv.type || lv.value !== rv.value;

    if (
      (lv.type === 'int' || lv.type === 'float') &&
      (rv.type === 'int' || rv.type === 'float')
    ) {
      const ln = Number(lv.value);
      const rn = Number(rv.value);
      if (op === '>=') return ln >= rn;
      if (op === '<=') return ln <= rn;
      if (op === '>') return ln > rn;
      if (op === '<') return ln < rn;
    }

    throw {
      type: 'TypeError',
      message: `Line ${lineNum}: TypeError: '${op}' not supported between '${lv.type}' and '${rv.type}'. Did you forget int() around input()?`,
      pattern: 'missing_int',
    };
  };

  const formatSimValue = (v: SimValue): string => {
    if (v.type === 'float') {
      return Number.isInteger(v.value) ? `${v.value}.0` : String(v.value);
    }
    return String(v.value);
  };

  // Parse non-empty lines with indentation
  interface ParsedLine {
    lineNumber: number; // 1-based
    indent: number;
    text: string;
  }

  const parsedLines: ParsedLine[] = [];
  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i];
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const indentMatch = raw.match(/^( *)/);
    const indent = indentMatch ? indentMatch[1].length : 0;
    parsedLines.push({ lineNumber: i + 1, indent, text: trimmed });
  }

  const executeBlock = (
    startIndex: number,
    expectedIndent: number
  ): { nextIndex: number; didBreak: boolean } => {
    let idx = startIndex;
    while (idx < parsedLines.length) {
      const current = parsedLines[idx];
      if (current.indent < expectedIndent) {
        break;
      }
      if (current.indent > expectedIndent) {
        throw {
          type: 'IndentationError',
          message: `Line ${current.lineNumber}: IndentationError: unexpected indent.`,
          pattern: 'missing_indent',
        };
      }

      const { text, lineNumber } = current;

      // break statement
      if (text === 'break') {
        return { nextIndex: idx + 1, didBreak: true };
      }

      // Robot commands
      if (text === 'move_right()') {
        applyRobotMove(1, 0, 'E');
        idx++;
        continue;
      }
      if (text === 'move_left()') {
        applyRobotMove(-1, 0, 'W');
        idx++;
        continue;
      }
      if (text === 'move_down()') {
        applyRobotMove(0, 1, 'S');
        idx++;
        continue;
      }
      if (text === 'move_up()') {
        applyRobotMove(0, -1, 'N');
        idx++;
        continue;
      }

      // print(...) statement
      if (/^print\s*\((.*)\)$/.test(text)) {
        const inner = text.replace(/^print\s*\(/, '').slice(0, -1).trim();
        if (!inner) {
          outputLines.push('');
          idx++;
          continue;
        }
        // Split top-level commas
        const args: string[] = [];
        let cur = '';
        let inQ: string | null = null;
        let pDepth = 0;
        for (const c of inner) {
          if ((c === '"' || c === "'") && !inQ) {
            inQ = c;
            cur += c;
          } else if (c === inQ) {
            inQ = null;
            cur += c;
          } else if (!inQ && c === '(') {
            pDepth++;
            cur += c;
          } else if (!inQ && c === ')') {
            pDepth--;
            cur += c;
          } else if (!inQ && pDepth === 0 && c === ',') {
            args.push(cur.trim());
            cur = '';
          } else {
            cur += c;
          }
        }
        if (cur.trim()) args.push(cur.trim());

        const evaluatedArgs = args.map((a) => formatSimValue(evalExpr(a, lineNumber)));
        outputLines.push(evaluatedArgs.join(' '));
        idx++;
        continue;
      }

      // if / elif / else chain
      if (text.startsWith('if ')) {
        let branchTaken = false;
        let didBreakInBranch = false;

        // Helper to skip or run an indented child block
        const processChildBlock = (headerIdx: number, shouldExecute: boolean): number => {
          const bodyStart = headerIdx + 1;
          if (
            bodyStart >= parsedLines.length ||
            parsedLines[bodyStart].indent <= expectedIndent
          ) {
            throw {
              type: 'IndentationError',
              message: `Line ${
                bodyStart < parsedLines.length
                  ? parsedLines[bodyStart].lineNumber
                  : parsedLines[headerIdx].lineNumber
              }: IndentationError: expected an indented block (4 spaces) after '${
                parsedLines[headerIdx].text
              }'.`,
              pattern: 'missing_indent',
            };
          }
          const childIndent = parsedLines[bodyStart].indent;
          if (shouldExecute) {
            const res = executeBlock(bodyStart, childIndent);
            if (res.didBreak) didBreakInBranch = true;
            return res.nextIndex;
          } else {
            let skipIdx = bodyStart;
            while (
              skipIdx < parsedLines.length &&
              parsedLines[skipIdx].indent >= childIndent
            ) {
              skipIdx++;
            }
            return skipIdx;
          }
        };

        const ifCond = text.slice(3, -1).trim();
        const ifResult = evalCondition(ifCond, lineNumber);
        branchTaken = ifResult;
        idx = processChildBlock(idx, ifResult);

        while (
          idx < parsedLines.length &&
          parsedLines[idx].indent === expectedIndent &&
          (parsedLines[idx].text.startsWith('elif ') ||
            parsedLines[idx].text === 'else:')
        ) {
          const branchLine = parsedLines[idx];
          if (branchLine.text.startsWith('elif ')) {
            const elifCond = branchLine.text.slice(5, -1).trim();
            const shouldRun = !branchTaken && evalCondition(elifCond, branchLine.lineNumber);
            if (shouldRun) branchTaken = true;
            idx = processChildBlock(idx, shouldRun);
          } else {
            const shouldRun = !branchTaken;
            if (shouldRun) branchTaken = true;
            idx = processChildBlock(idx, shouldRun);
            break;
          }
        }

        if (didBreakInBranch) {
          return { nextIndex: idx, didBreak: true };
        }
        continue;
      }

      // for <var> in range(...):
      if (text.startsWith('for ')) {
        const forMatch = text.match(
          /^for\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+in\s+range\s*\((.+)\)\s*:$/
        );
        if (!forMatch) {
          throw {
            type: 'SyntaxError',
            message: `Line ${lineNumber}: SyntaxError: invalid for loop syntax. Expected 'for variable in range(...):'`,
          };
        }
        const [, loopVar, rangeArgsRaw] = forMatch;
        const rangeArgs = rangeArgsRaw
          .split(',')
          .map((arg) => {
            const v = evalExpr(arg.trim(), lineNumber);
            if (v.type !== 'int') {
              throw {
                type: 'TypeError',
                message: `Line ${lineNumber}: range() arguments must be integers.`,
              };
            }
            return Number(v.value);
          });

        let start = 0;
        let stop = 0;
        let step = 1;
        if (rangeArgs.length === 1) {
          stop = rangeArgs[0];
        } else if (rangeArgs.length === 2) {
          start = rangeArgs[0];
          stop = rangeArgs[1];
        } else if (rangeArgs.length === 3) {
          start = rangeArgs[0];
          stop = rangeArgs[1];
          step = rangeArgs[2];
        } else {
          throw {
            type: 'TypeError',
            message: `Line ${lineNumber}: range() takes 1 to 3 arguments.`,
          };
        }

        if (step === 0) {
          throw {
            type: 'ValueError',
            message: `Line ${lineNumber}: ValueError: range() arg 3 must not be zero.`,
          };
        }

        const bodyStart = idx + 1;
        if (
          bodyStart >= parsedLines.length ||
          parsedLines[bodyStart].indent <= expectedIndent
        ) {
          throw {
            type: 'IndentationError',
            message: `Line ${
              bodyStart < parsedLines.length
                ? parsedLines[bodyStart].lineNumber
                : lineNumber
            }: IndentationError: expected an indented block (4 spaces) inside the for loop.`,
            pattern: 'missing_indent',
          };
        }

        const childIndent = parsedLines[bodyStart].indent;
        let afterLoopIdx = bodyStart;
        while (
          afterLoopIdx < parsedLines.length &&
          parsedLines[afterLoopIdx].indent >= childIndent
        ) {
          afterLoopIdx++;
        }

        let iterations = 0;
        const maxIterations = 100;
        for (
          let val = start;
          step > 0 ? val < stop : val > stop;
          val += step
        ) {
          if (++iterations > maxIterations) break;
          env[loopVar] = { type: 'int', value: val };
          const res = executeBlock(bodyStart, childIndent);
          if (res.didBreak) {
            break;
          }
        }

        idx = afterLoopIdx;
        continue;
      }

      // Variable assignment: var = expr
      const assignMatch = text.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)$/);
      if (assignMatch) {
        const [, varName, rhs] = assignMatch;
        env[varName] = evalExpr(rhs, lineNumber);
        idx++;
        continue;
      }

      throw {
        type: 'SyntaxError',
        message: `Line ${lineNumber}: SyntaxError: unrecognised Python statement '${text}'.`,
      };
    }

    return { nextIndex: idx, didBreak: false };
  };

  try {
    if (parsedLines.length === 0) {
      return {
        ok: false,
        outputLines: [],
        errorType: 'EmptyCode',
        errorMessage: 'Your code editor is empty! Reset the code and try again.',
      };
    }
    executeBlock(0, 0);

    if (robotConfig && robotState) {
      if (robotState.crashed) {
        return {
          ok: false,
          outputLines: [robotState.crashReason],
          errorType: 'RobotError',
          errorMessage: robotState.crashReason,
          errorPattern: robotState.crashPattern,
          robotPath: robotState.path,
        };
      }
      const reachedGoal =
        robotState.x === robotConfig.goal.x && robotState.y === robotConfig.goal.y;
      if (reachedGoal) {
        outputLines.push(`Goal reached at (${robotConfig.goal.x}, ${robotConfig.goal.y})!`);
      } else {
        return {
          ok: false,
          outputLines: [
            `Robo-Py stopped at (${robotState.x}, ${robotState.y}) instead of (${robotConfig.goal.x}, ${robotConfig.goal.y}).`,
          ],
          errorType: 'RobotIncomplete',
          errorMessage: `Robo-Py stopped at (${robotState.x}, ${robotState.y}). Keep moving to reach the portal at (${robotConfig.goal.x}, ${robotConfig.goal.y})!`,
          errorPattern: 'not_at_goal',
          robotPath: robotState.path,
        };
      }
    }

    return {
      ok: true,
      outputLines,
      robotPath: robotState?.path,
    };
  } catch (err: unknown) {
    const simErr = err as { type?: string; message?: string; pattern?: string };
    return {
      ok: false,
      outputLines,
      errorType: simErr.type || 'RuntimeError',
      errorMessage: simErr.message || 'An error occurred while running your code.',
      errorPattern: simErr.pattern,
      robotPath: robotState?.path,
    };
  }
}

/**
 * Validates a student submission against a Challenge's requirements:
 * 1. Handles Predict the Output directly
 * 2. Checks non-empty code and required concepts/tokens (prevents deleting code to hardcode output)
 * 3. Runs deterministic Python simulator and test cases
 * 4. Returns clear, supportive British English feedback
 */
export function validateChallengeSubmission(
  challenge: Challenge,
  submittedCodeOrPrediction: string
): ValidationResult {
  const trimmedSubmission = submittedCodeOrPrediction.trim();

  // Engine D: Predict the Output
  if (challenge.engineType === 'predict_output') {
    const cleanPred = trimmedSubmission
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .join('\n');

    const expectedClean = challenge.expectedOutput
      .split(/\r?\n/)
      .map((l) => l.trim())
      .join('\n');

    if (cleanPred === expectedClean) {
      return {
        isValid: true,
        syntaxValid: true,
        conceptValid: true,
        outputValid: true,
        terminalOutput: challenge.expectedOutput,
        feedbackMessage: challenge.successFeedback,
        passedTestCases: challenge.testCases.length,
        totalTestCases: challenge.testCases.length,
      };
    }

    // Check specific error rules for Predict Output
    if (cleanPred.includes('"') || cleanPred.includes("'")) {
      const quoteRule = challenge.errorFeedbackRules.find(
        (r) => r.pattern === 'included_quotes'
      );
      if (quoteRule) {
        return {
          isValid: false,
          syntaxValid: true,
          conceptValid: true,
          outputValid: false,
          terminalOutput: cleanPred,
          feedbackMessage: quoteRule.message,
          matchedErrorRule: quoteRule.pattern,
          passedTestCases: 0,
          totalTestCases: challenge.testCases.length,
        };
      }
    }

    const firstRule = challenge.errorFeedbackRules[0];
    return {
      isValid: false,
      syntaxValid: true,
      conceptValid: true,
      outputValid: false,
      terminalOutput: cleanPred || '(No prediction entered)',
      feedbackMessage:
        firstRule?.message ||
        'Not quite! Trace each line from top to bottom and check what print() displays.',
      matchedErrorRule: firstRule?.pattern,
      passedTestCases: 0,
      totalTestCases: challenge.testCases.length,
    };
  }

  // All code-based engines (Bug Hunter, Code Builder, Missing Code, Robot Programmer, Final Boss)
  const simResult = simulatePythonProgram(
    submittedCodeOrPrediction,
    challenge.simulatedInputs || [],
    challenge.robotConfig
  );

  // Check if simulation had syntax or runtime errors
  if (!simResult.ok) {
    const matchedRule = challenge.errorFeedbackRules.find(
      (r) => r.pattern === simResult.errorPattern
    );
    return {
      isValid: false,
      syntaxValid: false,
      conceptValid: false,
      outputValid: false,
      terminalOutput:
        simResult.outputLines.length > 0
          ? `${simResult.outputLines.join('\n')}\n${simResult.errorMessage}`
          : simResult.errorMessage || 'Error in code.',
      feedbackMessage:
        matchedRule?.message ||
        simResult.errorMessage ||
        'Almost! Check your syntax and try again.',
      matchedErrorRule: matchedRule?.pattern || simResult.errorPattern,
      passedTestCases: 0,
      totalTestCases: challenge.testCases.length,
      robotPath: simResult.robotPath,
    };
  }

  // Check required tokens/concepts so students cannot just delete the program and print the answer
  const normalisedSubmitted = normalisePythonProgram(submittedCodeOrPrediction);
  const missingTokens = challenge.requiredTokens.filter(
    (token) => !normalisedSubmitted.includes(token) && !submittedCodeOrPrediction.includes(token)
  );

  const actualOutput = simResult.outputLines.join('\n').trim();
  const expectedOutput = challenge.expectedOutput.trim();
  const outputMatches = actualOutput === expectedOutput;

  // Also check if normalised code matches any accepted equivalent directly
  const canonicalNorm = normalisePythonProgram(challenge.correctSolution);
  const eqNorms = [
    canonicalNorm,
    ...challenge.acceptedEquivalents.map(normalisePythonProgram),
  ];
  const matchesEquivalentDirectly = eqNorms.includes(normalisedSubmitted);

  if (missingTokens.length > 0 && !matchesEquivalentDirectly) {
    // Check if there is a specific error rule for the missing token
    const intRule = challenge.errorFeedbackRules.find((r) => r.pattern === 'missing_int');
    if (missingTokens.includes('int') && intRule) {
      return {
        isValid: false,
        syntaxValid: true,
        conceptValid: false,
        outputValid: outputMatches,
        terminalOutput: actualOutput,
        feedbackMessage: intRule.message,
        matchedErrorRule: intRule.pattern,
        passedTestCases: 0,
        totalTestCases: challenge.testCases.length,
        robotPath: simResult.robotPath,
      };
    }

    const firstRule = challenge.errorFeedbackRules[0];
    return {
      isValid: false,
      syntaxValid: true,
      conceptValid: false,
      outputValid: outputMatches,
      terminalOutput: actualOutput,
      feedbackMessage:
        firstRule?.message ||
        `Your code ran, but make sure you keep and use: ${missingTokens.join(', ')}`,
      matchedErrorRule: firstRule?.pattern || 'missing_concept',
      passedTestCases: 0,
      totalTestCases: challenge.testCases.length,
      robotPath: simResult.robotPath,
    };
  }

  if (!outputMatches && !matchesEquivalentDirectly) {
    const firstRule = challenge.errorFeedbackRules[0];
    return {
      isValid: false,
      syntaxValid: true,
      conceptValid: true,
      outputValid: false,
      terminalOutput: actualOutput || '(No output printed)',
      feedbackMessage:
        firstRule?.message ||
        `Your code ran without errors, but printed "${actualOutput || 'nothing'}" instead of "${expectedOutput}".`,
      matchedErrorRule: firstRule?.pattern || 'wrong_output',
      passedTestCases: 0,
      totalTestCases: challenge.testCases.length,
      robotPath: simResult.robotPath,
    };
  }

  return {
    isValid: true,
    syntaxValid: true,
    conceptValid: true,
    outputValid: true,
    terminalOutput: actualOutput,
    feedbackMessage: challenge.successFeedback,
    passedTestCases: challenge.testCases.length,
    totalTestCases: challenge.testCases.length,
    robotPath: simResult.robotPath,
  };
}
