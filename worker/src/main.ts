import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { hostname, tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { adminClient, buildInput, claimNext, loadApplication, markFailed, markSubmitted, type Admin, type ApplicationRow } from "./db";
import { runApplication } from "./run";

// Usage:
//   tsx src/main.ts                     claim and send approved applications until stopped
//   tsx src/main.ts --once              send at most one, then exit
//   tsx src/main.ts --dry-run --app ID  fill one application's form and save a screenshot;
//                                       claims nothing, uploads nothing, never submits

const { values: args } = parseArgs({
  options: {
    once: { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
    app: { type: "string" },
    headed: { type: "boolean", default: false },
  },
});

const WORKER_ID = process.env.WORKER_ID || `${hostname()}-${process.pid}`;
const DAILY_CAP = Number(process.env.DAILY_SUBMISSION_CAP || 25);
const POLL_MS = Number(process.env.POLL_INTERVAL_MS || 15_000);
const AI_FALLBACK = process.env.AI_FALLBACK !== "0";
const PORT = Number(process.env.PORT || 8080);

const log = (message: string) => console.log(`[worker ${new Date().toISOString()}] ${message}`);

let stopping = false;
let busy = false;
let lastTick = Date.now();

async function processOne(db: Admin, app: ApplicationRow, dryRun: boolean): Promise<void> {
  const workDir = await mkdtemp(join(tmpdir(), "jobpilot-app-"));
  let label = app.id;
  try {
    let input;
    try {
      input = await buildInput(db, app, workDir);
    } catch (error) {
      const reason = (error as Error).message;
      if (dryRun) throw error;
      await markFailed(db, app, reason, null, null, label);
      log(`${app.id} failed before the browser: ${reason}`);
      return;
    }
    label = `${input.title} at ${input.company}`;
    log(`${dryRun ? "Dry run" : "Applying"}: ${label} (${input.ats})`);

    const result = await runApplication(input, { dryRun, aiFallback: AI_FALLBACK, headless: !args.headed, log });

    if (dryRun) {
      const shot = join(process.cwd(), `dry-run-${app.id}.png`);
      if (result.screenshot) await writeFile(shot, result.screenshot);
      console.log(JSON.stringify(result.ok ? { ok: true, receipt: result.receipt } : { ok: false, error: result.error, receipt: result.receipt }, null, 2));
      log(`Screenshot: ${shot}`);
      return;
    }

    if (result.ok) {
      await markSubmitted(db, app, result.receipt, result.screenshot, label);
      log(`Submitted ${label}`);
    } else {
      await markFailed(db, app, result.error, result.receipt, result.screenshot, label);
      log(`Failed ${label}: ${result.error}`);
    }
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

async function loop(db: Admin) {
  log(`Started as ${WORKER_ID}, cap ${DAILY_CAP}/day per user, AI fallback ${AI_FALLBACK ? "on" : "off"}`);
  while (!stopping) {
    lastTick = Date.now();
    let app: ApplicationRow | null = null;
    try {
      app = await claimNext(db, WORKER_ID, DAILY_CAP);
    } catch (error) {
      log((error as Error).message);
    }
    if (app) {
      busy = true;
      try {
        await processOne(db, app, false);
      } catch (error) {
        // Leave it in submitting; the claim times out and the user is told to check.
        log(`Unexpected error on ${app.id}: ${(error as Error).message}`);
      } finally {
        busy = false;
      }
      if (args.once) return;
      continue;
    }
    if (args.once) return;
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

async function main() {
  const db = adminClient();

  if (args["dry-run"]) {
    if (!args.app) throw new Error("--dry-run needs --app <application id>");
    const app = await loadApplication(db, args.app);
    if (!app) throw new Error(`Application ${args.app} not found`);
    await processOne(db, app, true);
    return;
  }

  // Health check for the platform: healthy while the loop keeps ticking.
  const server = createServer((req, res) => {
    const healthy = busy || Date.now() - lastTick < POLL_MS * 4 + 60_000;
    res.writeHead(healthy ? 200 : 503, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: healthy, worker: WORKER_ID, busy }));
  });
  if (!args.once) server.listen(PORT, () => log(`Health check on :${PORT}`));

  const stop = () => {
    if (stopping) return;
    stopping = true;
    log(busy ? "Stopping after the current application" : "Stopping");
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);

  await loop(db);
  server.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
