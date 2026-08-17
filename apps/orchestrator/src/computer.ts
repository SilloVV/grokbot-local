/**
 * Text protocol for computer use. Small local models emit
 * <<<computer>>>cmd<<</computer>>> instead of native tool calls.
 */

export interface ToolExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

const BLOCK_RE = /<<<computer>>>\s*([\s\S]*?)\s*<<<\s*\/computer>>>/g;

/** True when a block looks like several independent shell lines. */
export function looksLikeMultipleShells(command: string): boolean {
  const lines = command.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return lines.length > 1;
}

/**
 * Extract commands from computer blocks.
 * Trims, drops empty bodies, drops multi-line "several shells" payloads.
 * A single command string (one non-empty line) is kept.
 */
export function parseComputerBlocks(text: string): string[] {
  const commands: string[] = [];
  const re = new RegExp(BLOCK_RE.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const command = (match[1] ?? "").trim();
    if (!command) continue;
    if (looksLikeMultipleShells(command)) continue;
    commands.push(command);
  }
  return commands;
}

/** Remove computer blocks so the user never sees the protocol tags. */
export function stripComputerBlocks(text: string): string {
  return text
    .replace(new RegExp(BLOCK_RE.source, "g"), "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const OFFLINE_TOOL_RESULT =
  "computer offline: start the VM from the Computer pane";

/** Short transcript stored as a role=tool message. */
export function formatToolResult(command: string, result: ToolExecResult | { offline: true }): string {
  if ("offline" in result && result.offline) {
    return `$ ${command}\n${OFFLINE_TOOL_RESULT}`;
  }
  const exec = result as ToolExecResult;
  const parts = [`$ ${command}`];
  const stdout = exec.stdout.replace(/\n$/, "");
  const stderr = exec.stderr.replace(/\n$/, "");
  if (stdout) parts.push(clip(stdout));
  if (stderr) parts.push(clip(stderr));
  parts.push(`exit ${exec.exitCode}`);
  return parts.join("\n");
}

function clip(text: string, max = 4000): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n…`;
}

export const COMPUTER_APPENDIX = [
  "You have a private Linux VM. To run a command, emit exactly:",
  "<<<computer>>>",
  "command",
  "<<</computer>>>",
  "Never pretend you ran a command. Wait for the tool result. Do not use the tags unless you need the computer.",
].join("\n");

export const MAX_COMPUTER_ROUNDS = 5;
