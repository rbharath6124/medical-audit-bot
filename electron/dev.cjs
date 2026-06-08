const { spawn } = require("child_process");
const electronPath = require("electron");
const http = require("http");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const devUrl = "http://127.0.0.1:5173";
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const vite = spawn(npmCommand, ["run", "dev:web"], {
  cwd: rootDir,
  stdio: "inherit",
  shell: process.platform === "win32",
});

let electron = null;
let shuttingDown = false;
const electronEnv = { ...process.env };
delete electronEnv.ELECTRON_RUN_AS_NODE;

function waitForVite(attempt = 0) {
  if (attempt > 120) {
    console.error("Vite did not become ready at " + devUrl);
    shutdown(1);
    return;
  }

  const request = http.get(devUrl, (response) => {
    response.resume();
    startElectron();
  });

  request.on("error", () => {
    setTimeout(() => waitForVite(attempt + 1), 500);
  });
}

function startElectron() {
  if (electron) {
    return;
  }

  electron = spawn(electronPath, ["."], {
    cwd: rootDir,
    stdio: "inherit",
    shell: false,
    env: {
      ...electronEnv,
      ELECTRON_START_URL: devUrl,
    },
  });

  electron.on("exit", (code) => {
    shutdown(code || 0);
  });
}

function shutdown(code) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  if (electron && !electron.killed) {
    electron.kill();
  }

  if (!vite.killed) {
    vite.kill();
  }

  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

vite.on("exit", (code) => {
  if (!shuttingDown && code !== 0) {
    shutdown(code || 1);
  }
});

waitForVite();
