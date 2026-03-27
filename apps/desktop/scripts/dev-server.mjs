import { spawn, } from "node:child_process";
import { dirname, resolve, } from "node:path";
import { fileURLToPath, } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url,),);
const appDir = resolve(scriptDir, "..",);
const devUrl = "http://localhost:1421/";

async function isServerReachable() {
  try {
    const response = await fetch(devUrl, { signal: AbortSignal.timeout(1000), },);
    return response.ok || response.status < 500;
  } catch {
    return false;
  }
}

if (await isServerReachable()) {
  console.log(`Using existing dev server at ${devUrl}`,);
  process.exit(0,);
}

const child = spawn("pnpm", ["run", "dev",], {
  cwd: appDir,
  stdio: "inherit",
  shell: process.platform === "win32",
},);

child.on("exit", (code,) => {
  process.exit(code ?? 1,);
},);
