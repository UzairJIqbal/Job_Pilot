import type { Locator, Page } from "playwright";
import type { ApplicationQuestion } from "../../lib/applications";
import { attr, containerByLabel, containerOf, typeAndSuggest } from "./fill";
import type { Ats, FieldRecord, SubmissionInput } from "./types";

// What differs between Greenhouse, Ashby and Lever: where the form lives, how
// a stored question id maps to a control, and what "submitted" looks like.

export type Located = { el: Locator | null; box: Locator | null };

export type Adapter = {
  /** Form URLs to try in order. */
  formUrls: (input: SubmissionInput) => string[];
  /** Wait until the form is usable. False if it never appeared (closed posting). */
  ready: (page: Page) => Promise<boolean>;
  locate: (page: Page, q: ApplicationQuestion) => Promise<Located>;
  resumeInput: (page: Page) => Locator;
  /** File input for the cover letter, when the form takes it as a file. */
  coverLetterFile: (page: Page) => Locator | null;
  /** Textarea for the cover letter, when the form takes it as text. */
  coverLetterText: (page: Page) => Locator | null;
  /** Fields the form always has that aren't in the stored questions (Lever). */
  fillStandard?: (page: Page, input: SubmissionInput, record: (f: FieldRecord) => void) => Promise<void>;
  submitButton: (page: Page) => Locator;
  confirmation: (page: Page) => Promise<string | null>;
};

async function first(loc: Locator): Promise<Locator | null> {
  return (await loc.count()) > 0 ? loc.first() : null;
}

async function locateById(page: Page, id: string, label: string): Promise<Located> {
  const el = await first(page.locator(`[id="${attr(id)}"], [name="${attr(id)}"]`));
  if (el) return { el, box: containerOf(el) };
  return { el: null, box: await containerByLabel(page, label) };
}

async function waitFor(loc: Locator, ms: number): Promise<boolean> {
  return loc
    .first()
    .waitFor({ state: "attached", timeout: ms })
    .then(() => true, () => false);
}

async function confirmationText(page: Page, url: RegExp, text: RegExp): Promise<string | null> {
  if (url.test(page.url())) return (await page.locator("h1, h2, h3").first().textContent().catch(() => null))?.trim() || "Confirmation page";
  const hit = page.getByText(text).first();
  if ((await hit.count()) && (await hit.isVisible().catch(() => false))) {
    return ((await hit.textContent()) ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
  }
  return null;
}

const greenhouse: Adapter = {
  formUrls: ({ boardToken, atsJobId }) => [
    `https://job-boards.greenhouse.io/${boardToken}/jobs/${atsJobId}`,
    // Boards that redirect to the employer's own site still serve the embed.
    `https://job-boards.greenhouse.io/embed/job_app?for=${boardToken}&token=${atsJobId}`,
  ],
  ready: (page) => waitFor(page.locator("#first_name"), 20_000),
  // Demographic answers are stored as demographic_<id>; the DOM uses the bare id.
  locate: (page, q) => locateById(page, q.id.replace(/^demographic_/, "").replace(/\[\]$/, ""), q.label),
  resumeInput: (page) => page.locator("input[type='file']#resume"),
  coverLetterFile: (page) => page.locator("input[type='file']#cover_letter"),
  coverLetterText: () => null,
  submitButton: (page) => page.getByRole("button", { name: /submit application/i }),
  confirmation: (page) =>
    confirmationText(page, /\/confirmation/, /thank you for applying|application (has been )?(received|submitted)/i),
};

const ashby: Adapter = {
  formUrls: ({ boardToken, atsJobId }) => [`https://jobs.ashbyhq.com/${boardToken}/${atsJobId}/application`],
  ready: (page) => waitFor(page.locator("[id='_systemfield_name'], [name='_systemfield_name']"), 20_000),
  locate: (page, q) => locateById(page, q.id, q.label),
  resumeInput: (page) => page.locator("input[type='file'][id='_systemfield_resume'], input[type='file'][name='_systemfield_resume']"),
  coverLetterFile: (page) => page.locator("input[type='file'][id='_systemfield_cover_letter']"),
  coverLetterText: (page) => page.locator("textarea[id='_systemfield_cover_letter'], textarea[name='_systemfield_cover_letter']"),
  submitButton: (page) => page.getByRole("button", { name: /submit application/i }),
  confirmation: (page) =>
    confirmationText(page, /\/application\/success/, /application (was )?(successfully )?submitted|thanks? (you )?for applying/i),
};

const lever: Adapter = {
  formUrls: ({ boardToken, atsJobId }) => [`https://jobs.lever.co/${boardToken}/${atsJobId}/apply`],
  ready: (page) => waitFor(page.locator("input[name='name']"), 20_000),
  // Custom questions are stored by their field name, cards[<card>][field<n>].
  locate: (page, q) => locateById(page, q.id, q.label),
  resumeInput: (page) => page.locator("input[type='file'][name='resume']"),
  coverLetterFile: () => null,
  coverLetterText: (page) => page.locator("textarea[name='comments']"),
  async fillStandard(page, input, record) {
    const c = input.contact;
    const text: [string, string, string][] = [
      ["name", "Full name", c.fullName],
      ["email", "Email", c.email],
      ["phone", "Phone", c.phone],
      ["org", "Current company", c.currentCompany],
      ["urls[LinkedIn]", "LinkedIn", c.linkedin],
      ["urls[GitHub]", "GitHub", c.github],
      ["urls[Portfolio]", "Portfolio", c.portfolio],
    ];
    for (const [name, label, value] of text) {
      const el = page.locator(`input[name="${attr(name)}"]`);
      if (!value || (await el.count()) === 0) continue;
      await el.first().fill(value);
      record({ label, value, how: "filled" });
    }
    const location = page.locator("#location-input");
    if (c.location && (await location.count())) {
      await typeAndSuggest(page, location.first(), c.location);
      record({ label: "Current location", value: c.location, how: "filled" });
    }
    // Voluntary self-ID: pick the decline option where there is one.
    const eeo = page.locator("select[name^='eeo[']");
    for (let i = 0; i < (await eeo.count()); i++) {
      const select = eeo.nth(i);
      const options = await select.locator("option").allTextContents();
      const decline = options.find((o) => /decline|prefer not|don.t wish/i.test(o));
      if (decline) {
        await select.selectOption({ label: decline });
        record({ label: (await select.getAttribute("name")) ?? "Self-ID", value: decline.trim(), how: "filled" });
      }
    }
  },
  submitButton: (page) => page.locator("#btn-submit, button[type='submit']").filter({ hasText: /submit application/i }),
  confirmation: (page) =>
    confirmationText(page, /\/thanks/, /application (was )?submitted|thank you for applying|thanks for applying/i),
};

export const ADAPTERS: Record<Ats, Adapter> = { greenhouse, ashby, lever };
