import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Page } from "playwright";
import { ADAPTERS } from "./ats";
import { openSession } from "./browser";
import { captchaChallenge, controlKind, emptyRequired, pickOption, setValue, typeAndSuggest, visibleErrors } from "./fill";
import type { FieldRecord, Receipt, RunOptions, SubmissionInput, SubmissionResult } from "./types";

const SUBMIT_WAIT_MS = 30_000;

function shown(value: string | string[]): string {
  return Array.isArray(value) ? value.join(", ") : value;
}

/** "Lahore, Punjab, Pakistan" → "Pakistan". */
function countryOf(location: string): string {
  const parts = location.split(",").map((p) => p.trim()).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

/**
 * Fill one application form. In dry-run mode nothing leaves the browser:
 * no file is attached (attaching uploads it) and submit is never clicked.
 */
export async function runApplication(input: SubmissionInput, opts: RunOptions): Promise<SubmissionResult> {
  const adapter = ADAPTERS[input.ats];
  const fields: FieldRecord[] = [];
  const record = (f: FieldRecord) => fields.push(f);
  const receipt = (formUrl: string, confirmation: string | null, uploaded: boolean, cover: Receipt["coverLetter"]): Receipt => ({
    mode: opts.dryRun ? "dry_run" : "live",
    formUrl,
    finishedAt: new Date().toISOString(),
    fields,
    resume: { key: input.resumeKey, uploaded },
    coverLetter: cover,
    confirmation,
  });

  const session = await openSession(opts);
  const { page } = session;
  const tmp = await mkdtemp(join(tmpdir(), "jobpilot-"));
  let formUrl = "";
  let uploaded = false;
  let cover: Receipt["coverLetter"] = null;

  const fail = async (error: string): Promise<SubmissionResult> => {
    const screenshot = await page.screenshot({ fullPage: true }).catch(() => null);
    return { ok: false, error, receipt: formUrl ? receipt(formUrl, null, uploaded, cover) : null, screenshot };
  };

  try {
    /* ── open the form ── */
    let ready = false;
    for (const url of adapter.formUrls(input)) {
      formUrl = url;
      opts.log(`Opening ${url}`);
      const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 }).catch(() => null);
      if (res && res.status() >= 400) continue;
      if ((ready = await adapter.ready(page))) break;
    }
    if (!ready) return await fail("The application form didn't load. The posting may be closed.");
    await page.waitForTimeout(1_500);

    /* ── files first: Lever re-fills fields from a parsed resume ── */
    const resumeInput = adapter.resumeInput(page);
    if (await resumeInput.count()) {
      if (!input.resumePath) return await fail("No tailored resume to attach. Re-tailor this application.");
      if (opts.dryRun) {
        record({ label: "Resume", value: "Tailored resume (PDF)", how: "dry_run", note: "Not attached in a dry run" });
      } else {
        await resumeInput.first().setInputFiles(input.resumePath);
        uploaded = true;
        record({ label: "Resume", value: "Tailored resume (PDF)", how: "filled" });
        await page.waitForTimeout(2_500);
      }
    }
    if (input.coverLetter) {
      const asText = adapter.coverLetterText(page);
      const asFile = adapter.coverLetterFile(page);
      if (asText && (await asText.count())) {
        await asText.first().fill(input.coverLetter);
        cover = "text";
        record({ label: "Cover letter", value: `${input.coverLetter.slice(0, 80)}…`, how: "filled" });
      } else if (asFile && (await asFile.count())) {
        if (opts.dryRun) {
          record({ label: "Cover letter", value: "cover-letter.txt", how: "dry_run", note: "Not attached in a dry run" });
        } else {
          const path = join(tmp, "cover-letter.txt");
          await writeFile(path, input.coverLetter, "utf8");
          await asFile.first().setInputFiles(path);
          record({ label: "Cover letter", value: "cover-letter.txt", how: "filled" });
        }
        cover = "file";
      }
    }

    await adapter.fillStandard?.(page, input, record);

    /* ── stored answers ── */
    const questions = new Map(input.questions.map((q) => [q.id, q]));
    for (const answer of input.answers) {
      const q = questions.get(answer.questionId);
      if (!q || q.category === "document" || q.type === "file") continue;
      const empty = Array.isArray(answer.value) ? answer.value.length === 0 : !answer.value.trim();
      if (empty) {
        record({ label: q.label, value: "", how: "skipped" });
        continue;
      }
      const { el, box } = await adapter.locate(page, q);
      let ok = false;
      if (el && /location|city/i.test(q.id + " " + q.label) && (await controlKind(el)) !== "select") {
        ok = await typeAndSuggest(page, el, shown(answer.value));
      } else {
        ok = await setValue(page, el, box, answer.value);
      }
      if (ok) {
        record({ label: q.label, value: shown(answer.value), how: "filled" });
        continue;
      }
      const verb = q.type === "text" || q.type === "textarea" ? "Fill" : "Choose";
      ok = await session.act(`${verb} the form field labelled "${q.label}" with: ${shown(answer.value)}`);
      record({ label: q.label, value: shown(answer.value), how: ok ? "fallback" : "skipped", note: ok ? undefined : "Couldn't find this field" });
    }

    /* ── required fields the stored form didn't list ── */
    let missing = (await emptyRequired(page)).filter((m) => !m.file);
    for (const m of missing) {
      const value = /country/i.test(m.label)
        ? countryOf(input.contact.location)
        : /location|city/i.test(m.label)
          ? input.contact.location
          : "";
      if (!value) continue;
      const el = page.getByLabel(m.label, { exact: false }).first();
      if (!(await el.count())) continue;
      const kind = await controlKind(el);
      const ok = kind === "combobox" ? await pickOption(page, el, value) : await setValue(page, el, null, value);
      if (ok) record({ label: m.label, value, how: "filled", note: "Filled from your profile location" });
    }
    missing = await emptyRequired(page);
    const files = missing.filter((m) => m.file);
    const blanks = missing.filter((m) => !m.file);
    // In a dry run the resume is deliberately not attached.
    const missingFiles = opts.dryRun ? files.filter((f) => !/resume|cv/i.test(f.label)) : files;
    if (blanks.length || missingFiles.length) {
      const names = [...blanks, ...missingFiles].map((m) => `"${m.label}"`).join(", ");
      return await fail(`The form also requires ${names}, which the draft doesn't answer. Apply on the company's site, or re-tailor if the form changed.`);
    }

    const challenge = await captchaChallenge(page);
    if (challenge) return await fail(`${challenge}. JobPilot doesn't solve CAPTCHAs, so apply on the company's site.`);

    const submit = adapter.submitButton(page);
    if (!(await submit.count())) return await fail("Couldn't find the submit button.");

    /* ── dry run stops here ── */
    if (opts.dryRun) {
      await submit.first().scrollIntoViewIfNeeded().catch(() => {});
      const screenshot = await page.screenshot({ fullPage: true });
      return { ok: true, receipt: receipt(formUrl, null, false, cover), screenshot };
    }

    /* ── submit and wait for proof ── */
    opts.log("Submitting");
    await submit.first().click();
    const outcome = await waitForOutcome(page, adapter.confirmation);
    if (outcome.kind === "confirmed") {
      const screenshot = await page.screenshot({ fullPage: true });
      return { ok: true, receipt: receipt(formUrl, outcome.text, uploaded, cover), screenshot };
    }
    return await fail(outcome.reason);
  } catch (error) {
    return await fail(`Worker error: ${(error as Error).message.split("\n")[0].slice(0, 200)}`);
  } finally {
    await session.close();
    await rm(tmp, { recursive: true, force: true });
  }
}

async function waitForOutcome(
  page: Page,
  confirmation: (page: Page) => Promise<string | null>,
): Promise<{ kind: "confirmed"; text: string } | { kind: "failed"; reason: string }> {
  const deadline = Date.now() + SUBMIT_WAIT_MS;
  while (Date.now() < deadline) {
    await page.waitForTimeout(1_000);
    const text = await confirmation(page).catch(() => null);
    if (text) return { kind: "confirmed", text };
    const challenge = await captchaChallenge(page);
    if (challenge) {
      return { kind: "failed", reason: `${challenge} after submitting. It was not sent; apply on the company's site.` };
    }
    const body = (await page.locator("body").innerText().catch(() => "")).slice(0, 20_000);
    if (/security code|verification code|enter the code/i.test(body)) {
      return {
        kind: "failed",
        reason: "The employer emailed a verification code to finish. It was not sent; apply on the company's site.",
      };
    }
  }
  const errors = await visibleErrors(page);
  return {
    kind: "failed",
    reason: errors.length
      ? `The form rejected the submission: ${errors.join("; ")}`
      : "No confirmation appeared after submitting. Check the company's site before retrying: it may have gone through.",
  };
}
