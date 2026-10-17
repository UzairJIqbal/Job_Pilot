import type { Locator, Page } from "playwright";

// Field helpers shared by every ATS. Each returns false instead of throwing
// when the control isn't there, so the caller can try a fallback.

const SHORT = 4_000;

export function attr(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[*✱]/g, "").replace(/\s+/g, " ").trim();
}

/** The nearest ancestor that also holds the field's label. */
export function containerOf(el: Locator): Locator {
  return el.locator("xpath=ancestor::*[.//label or .//legend][1]");
}

/** A question's container found by its visible label, for controls with no stable id. */
export async function containerByLabel(page: Page, label: string): Promise<Locator | null> {
  const wanted = norm(label).slice(0, 80);
  if (!wanted) return null;
  const labels = page.locator("label, legend, .application-label, [class*='label']");
  const count = Math.min(await labels.count(), 300);
  for (let i = 0; i < count; i++) {
    const l = labels.nth(i);
    const text = norm((await l.textContent().catch(() => "")) ?? "");
    if (text && (text === wanted || text.startsWith(wanted))) {
      const box = l.locator(
        "xpath=ancestor::*[.//input[not(@type='hidden')] or .//textarea or .//select or .//*[@role='combobox'] or .//button][1]",
      );
      if (await box.count()) return box.first();
    }
  }
  return null;
}

type ControlKind = "text" | "textarea" | "select" | "combobox" | "checkbox" | "radio" | "file" | "hidden" | "other";

export async function controlKind(el: Locator): Promise<ControlKind> {
  return el.evaluate((node) => {
    const e = node as HTMLInputElement;
    const tag = e.tagName.toLowerCase();
    if (e.getAttribute("role") === "combobox" || e.getAttribute("aria-autocomplete")) return "combobox";
    if (tag === "textarea") return "textarea";
    if (tag === "select") return "select";
    if (tag !== "input") return "other";
    const type = (e.type || "text").toLowerCase();
    if (type === "file") return "file";
    if (type === "hidden") return "hidden";
    if (type === "checkbox") return "checkbox";
    if (type === "radio") return "radio";
    return "text";
  }) as Promise<ControlKind>;
}

/** react-select and similar: open, type, pick the matching option. */
export async function pickOption(page: Page, input: Locator, value: string): Promise<boolean> {
  try {
    await input.click({ timeout: SHORT });
    await input.fill(value, { timeout: SHORT }).catch(() => input.pressSequentially(value, { delay: 20 }));
    // Scope to this control's listbox: forms keep other hidden option lists (phone country codes).
    const listId = await input.getAttribute("aria-controls").catch(() => null);
    const options = listId
      ? page.locator(`[id="${attr(listId)}"] [role='option']`)
      : page.locator("[role='option']:visible");
    await options.first().waitFor({ state: "visible", timeout: SHORT });
    const wanted = norm(value);
    const n = Math.min(await options.count(), 100);
    let fallback: Locator | null = null;
    for (let i = 0; i < n; i++) {
      const text = norm((await options.nth(i).textContent()) ?? "");
      if (text === wanted) {
        await options.nth(i).click();
        return true;
      }
      if (!fallback && text.startsWith(wanted)) fallback = options.nth(i);
    }
    if (fallback) {
      await fallback.click();
      return true;
    }
    await input.press("Escape").catch(() => {});
    return false;
  } catch {
    await input.press("Escape").catch(() => {});
    return false;
  }
}

/** Autocomplete text (city search): type, then take the first suggestion if one shows. */
export async function typeAndSuggest(page: Page, input: Locator, value: string): Promise<boolean> {
  try {
    await input.click({ timeout: SHORT });
    await input.fill("");
    await input.pressSequentially(value, { delay: 30 });
    const option = page.locator("[role='option']:visible, .dropdown-results > div:visible, [class*='suggestion']:visible").first();
    if (await option.waitFor({ state: "visible", timeout: SHORT }).then(() => true, () => false)) {
      await option.click();
    }
    return true;
  } catch {
    return false;
  }
}

/** Radios, checkboxes or Yes/No buttons inside a question's container. */
export async function chooseIn(box: Locator, values: string[]): Promise<boolean> {
  let all = true;
  for (const value of values) {
    const exact = new RegExp(`^\\s*${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i");
    const candidates = [
      box.getByRole("radio", { name: exact }),
      box.getByRole("checkbox", { name: exact }),
      box.getByLabel(exact),
      box.getByRole("button", { name: exact }),
      box.locator("label").filter({ hasText: exact }),
    ];
    let done = false;
    for (const c of candidates) {
      if ((await c.count()) === 0) continue;
      const target = c.first();
      try {
        const kind = await controlKind(target);
        if (kind === "checkbox" || kind === "radio") await target.check({ timeout: SHORT, force: true });
        else await target.click({ timeout: SHORT });
        done = true;
        break;
      } catch {
        // try the next way of reaching it
      }
    }
    all &&= done;
  }
  return all;
}

/**
 * Put one answer into one control. `box` is the question's container, used
 * for option groups that have no single input.
 */
export async function setValue(
  page: Page,
  el: Locator | null,
  box: Locator | null,
  value: string | string[],
): Promise<boolean> {
  const values = (Array.isArray(value) ? value : [value]).filter((v) => v.trim() !== "");
  if (values.length === 0) return true;

  const kind = el ? await controlKind(el) : "other";
  if (el && (kind === "text" || kind === "textarea")) {
    try {
      await el.fill(values.join(", "), { timeout: SHORT });
      return true;
    } catch {
      return false;
    }
  }
  if (el && kind === "select") {
    try {
      await el.selectOption(values.map((label) => ({ label })), { timeout: SHORT });
      return true;
    } catch {
      return false;
    }
  }
  if (el && kind === "combobox") {
    let ok = true;
    for (const v of values) ok = (await pickOption(page, el, v)) && ok;
    return ok;
  }
  if (el && (kind === "radio" || kind === "checkbox")) {
    // Option groups that share a name (Lever): pick by submitted value.
    const name = await el.getAttribute("name");
    if (name) {
      let all = true;
      for (const v of values) {
        const option = page.locator(`input[name="${attr(name)}"][value="${attr(v)}"]`);
        const ok = (await option.count()) > 0 && (await option.first().check({ timeout: SHORT, force: true }).then(() => true, () => false));
        all &&= ok;
      }
      if (all) return true;
    }
  }
  if (box) return chooseIn(box, values);
  return false;
}

/** Fields and AI instructions the worker must never touch: anything that looks like a bot check. */
export const BOT_CHECK = /captcha|recaptcha|hcaptcha|turnstile|robot|human verification|verify (that )?you|are you human/i;

/**
 * A CAPTCHA the user would have to solve: an image challenge, or a visible
 * "I'm not a robot" checkbox. Invisible badges are normal and only matter if
 * they escalate. The worker only looks; it never clicks inside these frames.
 */
export async function captchaChallenge(page: Page): Promise<string | null> {
  const challenges = page.locator(
    "iframe[src*='recaptcha/api2/bframe'], iframe[src*='recaptcha/enterprise/bframe'], iframe[src*='hcaptcha.com'][src*='challenge'], iframe[src*='challenges.cloudflare.com']",
  );
  for (let i = 0; i < (await challenges.count()); i++) {
    const box = await challenges.nth(i).boundingBox().catch(() => null);
    if (box && box.width > 100 && box.height > 100) return "The form showed a CAPTCHA challenge";
  }
  const checkboxes = page.locator(
    "iframe[src*='recaptcha/api2/anchor']:not([src*='size=invisible']), iframe[src*='recaptcha/enterprise/anchor']:not([src*='size=invisible']), iframe[src*='hcaptcha.com'][src*='frame=checkbox']:not([src*='size=invisible'])",
  );
  for (let i = 0; i < (await checkboxes.count()); i++) {
    const frame = checkboxes.nth(i);
    const box = await frame.boundingBox().catch(() => null);
    if (box && box.width > 50 && box.height > 30 && (await frame.isVisible().catch(() => false))) {
      return "The form has an \"I'm not a robot\" check";
    }
  }
  return null;
}

/** Required controls that are still empty, by label. File inputs are reported separately. */
// In-page scripts are strings: the TS loader adds helpers to compiled
// functions that don't exist inside the page.
const EMPTY_REQUIRED_JS = String.raw`(() => {
    const out = [];
    const seen = new Set();
    const labelFor = (el) => {
      const id = el.getAttribute("id");
      const byFor = id ? document.querySelector('label[for="' + CSS.escape(id) + '"]') : null;
      const aria = el.getAttribute("aria-label");
      const labelledBy = el.getAttribute("aria-labelledby");
      const byAria = labelledBy ? document.getElementById(labelledBy.split(" ")[0]) : null;
      // Lever: the question text sits beside the field, inside the question's li.
      const question = el.closest(".application-question");
      const leverLabel = question?.querySelector(".application-label .text, .application-label");
      const wrap = el.closest("label, li, fieldset, [class*='field'], [class*='question']");
      const wrapLabel = wrap?.querySelector("label, legend, .application-label");
      return (byFor?.textContent || aria || byAria?.textContent || leverLabel?.textContent || wrapLabel?.textContent || el.getAttribute("name") || "")
        .replace(/[*✱]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 120);
    };
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return s.visibility !== "hidden" && s.display !== "none" && (r.width > 0 || r.height > 0);
    };
    const els = document.querySelectorAll(
      "input[required], input[aria-required='true'], textarea[required], textarea[aria-required='true'], select[required], select[aria-required='true']",
    );
    for (const el of els) {
      const type = (el.type || "").toLowerCase();
      if (type === "hidden") continue;
      const file = type === "file";
      if (!file && !visible(el)) continue;
      let empty;
      if (type === "checkbox" || type === "radio") {
        const group = el.name ? document.querySelectorAll('input[name="' + CSS.escape(el.name) + '"]') : [el];
        empty = ![...group].some((g) => g.checked);
      } else if (el.getAttribute("role") === "combobox") {
        // react-select keeps the chosen value outside the input.
        let node = el.parentElement;
        let chosen = false;
        for (let i = 0; node && i < 5 && !chosen; i++, node = node.parentElement) {
          chosen = !!node.querySelector("[class*='singleValue'], [class*='multiValue'], [class*='single-value'], [class*='multi-value']");
        }
        empty = !el.value && !chosen;
      } else {
        empty = !el.value || !el.value.trim();
      }
      if (!empty) continue;
      const label = labelFor(el);
      const key = label + "|" + file;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ label: label || "(unlabelled field)", file });
    }
    return out;
  })()`;

export async function emptyRequired(page: Page): Promise<{ label: string; file: boolean }[]> {
  return (await page.evaluate(EMPTY_REQUIRED_JS)) as { label: string; file: boolean }[];
}

/** Validation messages the form is showing, for a useful failure reason. */
const VISIBLE_ERRORS_JS = String.raw`(() => {
    const out = new Set();
    const els = document.querySelectorAll(
      "[role='alert'], .error, .error-message, .helper-text--error, [class*='error'][class*='message'], [class*='_error']",
    );
    for (const el of els) {
      const r = el.getBoundingClientRect();
      const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
      if (r.width > 0 && r.height > 0 && text && text.length < 200) out.add(text);
    }
    return [...out].slice(0, 6);
  })()`;

export async function visibleErrors(page: Page): Promise<string[]> {
  return (await page.evaluate(VISIBLE_ERRORS_JS)) as string[];
}
