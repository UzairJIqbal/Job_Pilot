import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { hostname, tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { MATCH_THRESHOLD } from "../../lib/utils";
import {
  adminClient,
  buildInput,
  claimNext,
  loadApplication,
  markFailed,
  markPreviewReady,
  markSubmitted,
  type Admin,
  type ApplicationRow,
} from "./db";
import { runApplication } from "./run";
import type { SubmissionInput } from "./types";

// Usage:
//   tsx src/main.ts                     work the queue until stopped
//   tsx src/main.ts --once              handle at most one application, then exit
//   tsx src/main.ts --dry-run --app ID  fill one application's form and save a screenshot;
//                                       claims nothing, uploads nothing, never submits
//
// SUBMIT_MODE=confirm (default): an approved application is first filled as a
// preview (nothing attached, submit never clicked) and parked in ready_to_send
// with a screenshot. It is sent only after the user clicks Send on that
// preview. SUBMIT_MODE=auto skips the preview and is opt-in.

const { values: args } = parseArgs({
  options: {
    once: { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
    app: { type: "string" },
    headed: { type: "boolean", default: false },
  },
});

const WORKER_ID = process.env.WORKER_ID || `${hostname()}-${process.pid}`;
const SUBMIT_MODE = process.env.SUBMIT_MODE === "auto" ? "auto" : "confirm";
// The database caps these at 10/day and a score of 70, whatever is set here.
const DAILY_CAP = Math.min(Number(process.env.DAILY_SUBMISSION_CAP || 10), 10);
const MIN_MATCH_SCORE = Math.max(Number(process.env.MIN_MATCH_SCORE || MATCH_THRESHOLD), MATCH_THRESHOLD);
const POLL_MS = Number(process.env.POLL_INTERVAL_MS || 15_000);
const AI_FALLBACK = process.env.AI_FALLBACK !== "0";
const PORT = Number(process.env.PORT || 8080);

const log = (message: string) => console.log(`[worker ${new Date().toISOString()}] ${message}`);

let stopping = false;
let busy = false;
let lastTick = Date.now();

/**
 * Checked again here, after the claim, before any browser opens: a live send
 * needs a recorded approval, the user's Send click in confirm mode, and a
 * match score at or above the bar. Returns why not, or null.
 */
function sendRefusal(app: ApplicationRow, input: SubmissionInput): string | null {
  if (!app.approved_at) return "This application has no recorded approval.";
  if (SUBMIT_MODE === "confirm" && !app.send_confirmed_at) return "This application wasn't confirmed from its preview.";
  if (input.matchScore == null || input.matchScore < MIN_MATCH_SCORE) {
    return `This job's match score (${input.matchScore ?? "none"}) is below the minimum of ${MIN_MATCH_SCORE} for automatic sending.`;
  }
  return null;
}

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

    // Anything not confirmed for sending is filled as a preview: no files, no submit.
    const preview = !dryRun && app.claim_mode !== "send";
    if (!dryRun && !preview) {
      const refusal = sendRefusal(app, input);
      if (refusal) {
        await markFailed(db, app, `${refusal} Nothing was sent.`, null, null, label);
        log(`Refused ${label}: ${refusal}`);
        return;
      }
    }
    log(`${dryRun ? "Dry run" : preview ? "Preview" : "Sending"}: ${label} (${input.ats})`);

    const result = await runApplication(input, {
      dryRun: dryRun || preview,
      // A send must fill exactly what the user saw in the preview.
      expectedFields: !dryRun && !preview && SUBMIT_MODE === "confirm" ? app.receipt?.fields ?? [] : undefined,
      aiFallback: AI_FALLBACK,
      headless: !args.headed,
      log,
    });

    if (dryRun) {
      const shot = join(process.cwd(), `dry-run-${app.id}.png`);
      if (result.screenshot) await writeFile(shot, result.screenshot);
      console.log(JSON.stringify(result.ok ? { ok: true, receipt: result.receipt } : { ok: false, error: result.error, receipt: result.receipt }, null, 2));
      log(`Screenshot: ${shot}`);
      return;
    }

    if (preview) {
      if (result.ok) {
        await markPreviewReady(db, app, result.receipt, result.screenshot, label);
        log(`Preview ready for ${label}`);
      } else {
        await markFailed(db, app, `${result.error} Nothing was sent.`, result.receipt, result.screenshot, label);
        log(`Preview failed for ${label}: ${result.error}`);
      }
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
  log(
    `Started as ${WORKER_ID}: mode ${SUBMIT_MODE}, cap ${DAILY_CAP}/day per user, min match ${MIN_MATCH_SCORE}, AI fallback ${AI_FALLBACK ? "on" : "off"}`,
  );
  while (!stopping) {
    lastTick = Date.now();
    let app: ApplicationRow | null = null;
    try {
      app = await claimNext(db, WORKER_ID, {
        dailyCap: DAILY_CAP,
        minMatchScore: MIN_MATCH_SCORE,
        requireConfirmation: SUBMIT_MODE === "confirm",
      });
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
