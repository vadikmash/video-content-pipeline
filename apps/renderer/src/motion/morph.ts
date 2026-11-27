/** Matched-topology SVG path morphing. Paths must share commands; only numbers interpolate. */

const TOKEN = /([MmLlHhVvCcSsQqTtAaZz])|(-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)/g;
const ARITY: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };

export interface PathShape {
  commands: string[];
  values: number[];
}

export function parsePath(d: string): PathShape {
  const commands: string[] = [];
  const values: number[] = [];
  let current: string | undefined;
  let pending = 0;
  const leftover = d.replace(TOKEN, "").replace(/[\s,]/g, "");
  if (leftover) throw new Error(`Unsupported path data near "${leftover.slice(0, 12)}"`);
  for (const match of d.matchAll(TOKEN)) {
    if (match[1]) {
      if (pending !== 0) throw new Error(`Path command ${current} is missing numbers`);
      current = match[1];
      commands.push(current);
      pending = ARITY[current.toUpperCase()]!;
    } else {
      if (!current) throw new Error("Path data must start with a command");
      if (pending === 0) {
        // Implicit repetition (a moveto continues as lineto).
        const repeat = current === "M" ? "L" : current === "m" ? "l" : current;
        if (ARITY[repeat.toUpperCase()] === 0) throw new Error(`Unexpected number after ${current}`);
        commands.push(repeat);
        current = repeat;
        pending = ARITY[repeat.toUpperCase()]!;
      }
      values.push(Number(match[2]));
      pending--;
    }
  }
  if (pending !== 0) throw new Error(`Path command ${current} is missing numbers`);
  return { commands, values };
}

/** Returns null when two paths can morph, otherwise the reason they cannot. */
export function morphIncompatibility(a: string, b: string): string | null {
  let pa: PathShape;
  let pb: PathShape;
  try {
    pa = parsePath(a);
    pb = parsePath(b);
  } catch (error) {
    return (error as Error).message;
  }
  if (pa.commands.length !== pb.commands.length) return `Paths have ${pa.commands.length} and ${pb.commands.length} commands`;
  const at = pa.commands.findIndex((command, i) => command !== pb.commands[i]);
  if (at >= 0) return `Command ${at} differs (${pa.commands[at]} vs ${pb.commands[at]})`;
  return null;
}

function format(shape: PathShape, values: number[]): string {
  let cursor = 0;
  return shape.commands
    .map((command) => {
      const arity = ARITY[command.toUpperCase()]!;
      const nums = values.slice(cursor, cursor + arity).map((v) => Number(v.toFixed(2)));
      cursor += arity;
      return nums.length ? `${command}${nums.join(" ")}` : command;
    })
    .join(" ");
}

/** Interpolate matched paths at progress t (0..1). Arc flags snap at the midpoint. */
export function morphPath(a: string, b: string, t: number): string {
  const reason = morphIncompatibility(a, b);
  if (reason) throw new Error(`Cannot morph paths: ${reason}`);
  const pa = parsePath(a);
  const pb = parsePath(b);
  const flagIndexes = new Set<number>();
  let cursor = 0;
  for (const command of pa.commands) {
    if (command.toUpperCase() === "A") {
      flagIndexes.add(cursor + 3);
      flagIndexes.add(cursor + 4);
    }
    cursor += ARITY[command.toUpperCase()]!;
  }
  const values = pa.values.map((v, i) => (flagIndexes.has(i) ? (t < 0.5 ? v : pb.values[i]!) : v + (pb.values[i]! - v) * t));
  return format(pa, values);
}
