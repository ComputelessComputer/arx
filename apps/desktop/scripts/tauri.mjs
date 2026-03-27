import { spawn, } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, realpathSync, rmSync, symlinkSync, } from "node:fs";
import { dirname, resolve, } from "node:path";
import { fileURLToPath, } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url,),);
const appDir = resolve(scriptDir, "..",);
const repoDir = resolve(appDir, "..", "..",);
const tauriBin = resolve(appDir, "node_modules", ".bin", process.platform === "win32" ? "tauri.cmd" : "tauri",);
const args = process.argv.slice(2,);
const [command, ...rest] = args;

const tauriArgs = command === "dev"
  ? ["dev", "--config", resolve(appDir, "src-tauri", "tauri.conf.json",), ...rest,]
  : command === "build"
    ? ["build", "--config", resolve(appDir, "src-tauri", "tauri.conf.json",), ...rest,]
    : args;

function ensureLegacyTargetCompat() {
  const compatDir = resolve(repoDir, "src-tauri",);
  const compatTarget = resolve(compatDir, "target",);
  const actualTarget = resolve(appDir, "src-tauri", "target",);

  mkdirSync(compatDir, { recursive: true, },);

  if (existsSync(compatTarget,)) {
    const current = realpathSync(compatTarget,);
    if (current === actualTarget) {
      return;
    }

    if (lstatSync(compatTarget,).isSymbolicLink()) {
      rmSync(compatTarget, { force: true, },);
    } else {
      return;
    }
  }

  symlinkSync(actualTarget, compatTarget, process.platform === "win32" ? "junction" : "dir",);
}

ensureLegacyTargetCompat();

const child = spawn(tauriBin, tauriArgs, {
  cwd: appDir,
  stdio: "inherit",
  shell: process.platform === "win32",
},);

child.on("exit", (code,) => {
  process.exit(code ?? 1,);
},);
