export type CompanyDossier = {
  companyOverview: string;
  techStack: string[];
  culture: string[];
  whyThisRole: string;
  yourEdge: string[];
  gapsToAddress: string[];
  smartQuestions: string[];
  interviewPrep: string[];
  sources: string[];
};

export type ResearchResult =
  | { success: true; dossier: CompanyDossier }
  | { success: false; error: string };

/* ── Interview Prep ── */

export type StarAnswer = {
  situation: string;
  task: string;
  action: string;
  result: string;
};

export type BehavioralQuestion = {
  question: string;
  whyAsked: string;
  starAnswer: StarAnswer;
  yourAngle: string;
};

export type TechnicalQuestion = {
  question: string;
  whyAsked: string;
  suggestedAnswer: string;
  depthToGo: string;
};

export type InterviewPrepMaterial = {
  behavioralQuestions: BehavioralQuestion[];
  technicalQuestions: TechnicalQuestion[];
  talkingPoints: string[];
  questionsToAsk: string[];
  dayOneReadiness: string;
  closingStrategy: string;
};

export type InterviewPrepResult =
  | { success: true; prep: InterviewPrepMaterial }
  | { success: false; error: string };

/* ── Email Templates ── */

export type EmailTemplate = {
  subject: string;
  body: string;
};

export type EmailTemplates = {
  networking: EmailTemplate;
  followUp: EmailTemplate;
  thankYou: EmailTemplate;
  generatedAt: string;
};

export type EmailTemplatesResult =
  | { success: true; templates: EmailTemplates }
  | { success: false; error: string };
