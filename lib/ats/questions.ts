import type { ApplicationQuestion, QuestionCategory, QuestionType } from "@/lib/applications";
import { decodeEntities, fetchJson } from "./http";
import type { Ats } from "./types";

// Application form questions as the public posting shows them, so answers
// can be drafted and reviewed before anything is sent.

const IDENTITY = new Set([
  "first_name", "last_name", "email", "phone", "location", "preferred_name",
  "_systemfield_name", "_systemfield_email", "_systemfield_location",
]);
const DOCUMENTS = new Set(["resume", "cover_letter", "_systemfield_resume", "_systemfield_cover_letter"]);

function categorise(id: string, label: string, type: QuestionType): QuestionCategory {
  if (IDENTITY.has(id)) return "identity";
  if (DOCUMENTS.has(id) || type === "file") return "document";
  if (/^(linkedin|website|github|portfolio)/i.test(label.trim()) && type === "text") return "identity";
  return "screening";
}

/* ── Greenhouse: documented Job Board API with ?questions=true ── */

type GhField = { name: string; type: string; values?: { label: string; value: unknown }[] };
type GhQuestion = { label: string; required: boolean; fields: GhField[] };
type GhJob = {
  questions?: GhQuestion[];
  compliance?: { type: string; questions: GhQuestion[] }[] | null;
  demographic_questions?: {
    questions: { id: number; label: string; required: boolean; type: string; answer_options: { label: string }[] }[];
  } | null;
};

const GH_TYPES: Record<string, QuestionType> = {
  input_text: "text",
  textarea: "textarea",
  input_file: "file",
  multi_value_single_select: "select",
  multi_value_multi_select: "multiselect",
};

function fromGreenhouse(q: GhQuestion, eeo: boolean): ApplicationQuestion | null {
  // A question can offer several inputs (file or pasted text); the first is the primary one.
  const field = q.fields[0];
  const type = field && GH_TYPES[field.type];
  if (!type) return null;
  const options = (field.values ?? []).map((v) => v.label);
  // Greenhouse yes/no questions are selects with exactly these two labels.
  const isBoolean = type === "select" && options.length === 2 && options.every((o) => /^(yes|no)$/i.test(o));
  return {
    id: field.name,
    label: q.label.trim(),
    required: q.required,
    type: isBoolean ? "boolean" : type,
    options,
    category: eeo ? "eeo" : categorise(field.name, q.label, type),
  };
}

async function greenhouseQuestions(boardToken: string, jobId: string): Promise<ApplicationQuestion[] | null> {
  const job = await fetchJson<GhJob>(
    `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(boardToken)}/jobs/${encodeURIComponent(jobId)}?questions=true`,
  );
  if (!job?.questions) return null;

  const out: ApplicationQuestion[] = [];
  for (const q of job.questions) {
    const parsed = fromGreenhouse(q, false);
    if (parsed) out.push(parsed);
  }
  for (const block of job.compliance ?? []) {
    for (const q of block.questions) {
      const parsed = fromGreenhouse(q, true);
      if (parsed) out.push(parsed);
    }
  }
  for (const q of job.demographic_questions?.questions ?? []) {
    const type = GH_TYPES[q.type];
    if (type !== "select" && type !== "multiselect") continue;
    out.push({
      id: `demographic_${q.id}`,
      label: q.label.trim(),
      required: q.required,
      type,
      options: q.answer_options.map((o) => o.label),
      category: "eeo",
    });
  }
  return out;
}

/* ── Ashby: the public job page's own posting query ── */

type AshbyField = {
  path: string;
  title: string;
  type: string;
  selectableValues?: { label: string }[];
};
type AshbyForm = {
  data?: {
    jobPosting?: {
      applicationForm?: { sections: { fieldEntries: { isRequired?: boolean; field?: AshbyField }[] }[] };
      surveyForms?: { sections: { fieldEntries: { isRequired?: boolean; field?: AshbyField }[] }[] }[];
    } | null;
  };
};

const ASHBY_TYPES: Record<string, QuestionType> = {
  String: "text",
  Email: "text",
  Phone: "text",
  Url: "text",
  Location: "text",
  Number: "text",
  Date: "text",
  LongText: "textarea",
  File: "file",
  ValueSelect: "select",
  MultiValueSelect: "multiselect",
  Boolean: "boolean",
};

const ASHBY_QUERY = `query ApiJobPosting($organizationHostedJobsPageName: String!, $jobPostingId: String!) {
  jobPosting(organizationHostedJobsPageName: $organizationHostedJobsPageName, jobPostingId: $jobPostingId) {
    applicationForm { sections { fieldEntries { ... on FormFieldEntry { isRequired field } } } }
    surveyForms { sections { fieldEntries { ... on FormFieldEntry { isRequired field } } } }
  }
}`;

async function ashbyQuestions(boardToken: string, jobId: string): Promise<ApplicationQuestion[] | null> {
  let body: AshbyForm;
  try {
    const res = await fetch("https://jobs.ashbyhq.com/api/non-user-graphql?op=ApiJobPosting", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        operationName: "ApiJobPosting",
        variables: { organizationHostedJobsPageName: boardToken, jobPostingId: jobId },
        query: ASHBY_QUERY,
      }),
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    body = (await res.json()) as AshbyForm;
  } catch {
    return null;
  }

  const posting = body.data?.jobPosting;
  if (!posting?.applicationForm) return null;

  const out: ApplicationQuestion[] = [];
  const add = (entries: { isRequired?: boolean; field?: AshbyField }[], eeo: boolean) => {
    for (const { isRequired, field } of entries) {
      const type = field && ASHBY_TYPES[field.type];
      if (!field || !type) continue;
      out.push({
        id: field.path,
        label: field.title.trim(),
        required: !!isRequired,
        type,
        options: (field.selectableValues ?? []).map((v) => v.label.trim()),
        category: eeo
          ? "eeo"
          : field.type === "Phone" || field.type === "Email"
            ? "identity"
            : categorise(field.path, field.title, type),
      });
    }
  };
  for (const section of posting.applicationForm.sections) add(section.fieldEntries, false);
  // Ashby's survey forms are the voluntary EEO questions.
  for (const form of posting.surveyForms ?? []) {
    for (const section of form.sections) add(section.fieldEntries, true);
  }
  return out;
}

/* ── Lever: the apply page embeds each custom question card as JSON ── */

type LeverCardField = { type: string; text: string; required?: boolean; options?: { text: string }[] };

const LEVER_TYPES: Record<string, QuestionType> = {
  text: "text",
  textarea: "textarea",
  dropdown: "select",
  "multiple-choice": "select",
  "multiple-select": "multiselect",
  "file-upload": "file",
};

async function leverQuestions(boardToken: string, jobId: string): Promise<ApplicationQuestion[] | null> {
  let html: string;
  try {
    const res = await fetch(`https://jobs.lever.co/${encodeURIComponent(boardToken)}/${encodeURIComponent(jobId)}/apply`, {
      headers: { Accept: "text/html" },
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    html = await res.text();
  } catch {
    return null;
  }

  // Standard fields (name, email, links, self-ID) are filled by the worker
  // directly; only the posting's own cards are questions to draft.
  const out: ApplicationQuestion[] = [];
  for (const [tag] of html.matchAll(/<input[^>]*name="cards\[[^\]"]+\]\[baseTemplate\]"[^>]*>/g)) {
    const cardId = /name="cards\[([^\]"]+)\]/.exec(tag)?.[1];
    const value = /value="([^"]*)"/.exec(tag)?.[1];
    if (!cardId || !value) continue;
    let fields: LeverCardField[];
    try {
      fields = (JSON.parse(decodeEntities(value)) as { fields?: LeverCardField[] }).fields ?? [];
    } catch {
      continue;
    }
    fields.forEach((field, index) => {
      const type = LEVER_TYPES[field.type];
      if (!type) return;
      const options = (field.options ?? []).map((o) => o.text.trim());
      const isBoolean = type === "select" && options.length === 2 && options.every((o) => /^(yes|no)$/i.test(o));
      const id = `cards[${cardId}][field${index}]`;
      out.push({
        id,
        label: field.text.trim(),
        required: !!field.required,
        type: isBoolean ? "boolean" : type,
        options,
        category: categorise(id, field.text, type),
      });
    });
  }
  return out;
}

/** Null when the form couldn't be read. */
export async function fetchApplicationQuestions(
  ats: Ats,
  boardToken: string,
  jobId: string,
): Promise<ApplicationQuestion[] | null> {
  if (ats === "greenhouse") return greenhouseQuestions(boardToken, jobId);
  if (ats === "ashby") return ashbyQuestions(boardToken, jobId);
  if (ats === "lever") return leverQuestions(boardToken, jobId);
  return null;
}
