#!/usr/bin/env node
/**
 * Cross-platform model pull. Uses `ollama` on PATH, or the default
 * Windows install path. Test models only — not the 27B target.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const MODELS = ["qwen2.5:0.5b", "qwen3.5:4b"];

function ollamaBin() {
  if (process.env.OLLAMA_BIN) return process.env.OLLAMA_BIN;
  const win = process.env.LOCALAPPDATA
    ? `${process.env.LOCALAPPDATA}\\Programs\\Ollama\\ollama.exe`
    : "";
  if (win && existsSync(win)) return win;
  return "ollama";
}

function run(bin, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: "inherit", shell: false });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${bin} ${args.join(" ")} exited ${code}`));
    });
  });
}

const bin = ollamaBin();
console.log(`Using ${bin}`);
for (const model of MODELS) {
  console.log(`Pulling ${model}`);
  await run(bin, ["pull", model]);
}
console.log("Done. 27B target is not pulled.");
