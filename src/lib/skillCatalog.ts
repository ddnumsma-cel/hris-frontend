// Skills applicants can pick while typing (Skills step of the public application). Broad on purpose:
// soft skills, office tools and the common skills of each field in the role catalog.

import { ROLE_FIELDS } from "./roleCatalog";

const SOFT = [
  "Interpersonal skills", "Communication", "Written communication", "Verbal communication", "Public speaking", "Presentation skills",
  "Problem solving", "Critical thinking", "Analytical thinking", "Decision making", "Creativity", "Innovation",
  "Teamwork", "Collaboration", "Cross-functional collaboration", "Collaboration tools", "Leadership", "Team leadership", "People management", "Mentoring", "Coaching",
  "Time management", "Prioritization", "Organization", "Multitasking", "Planning", "Project management", "Meeting deadlines",
  "Adaptability", "Flexibility", "Resilience", "Working under pressure", "Stress management", "Willingness to learn", "Self-motivation", "Initiative",
  "Attention to detail", "Accuracy", "Reliability", "Work ethic", "Integrity", "Confidentiality", "Professionalism",
  "Customer service", "Client relations", "Conflict resolution", "Negotiation", "Empathy", "Active listening", "Emotional intelligence",
  "Research", "Report writing", "Documentation", "Data entry", "Record keeping",
];

const TOOLS = [
  "Microsoft Office", "Microsoft Excel", "Advanced Excel", "Microsoft Word", "Microsoft PowerPoint", "Microsoft Outlook", "Microsoft Teams",
  "Google Workspace", "Google Sheets", "Google Docs", "Zoom", "Slack", "Trello", "Asana", "Jira", "Notion", "Canva",
  "Typing (50+ WPM)", "English proficiency", "Filipino proficiency", "Bisaya / Cebuano proficiency",
];

const EXTRA = [
  "Financial analysis", "Budgeting", "Forecasting", "Accounts payable", "Accounts receivable", "Bank reconciliation", "General ledger", "BIR compliance", "Xero",
  "TypeScript", "Java", "C#", "PHP", "Node.js", "HTML and CSS", "Data analysis", "Power BI", "Machine learning", "Linux", "Troubleshooting",
  "Sourcing candidates", "Employee engagement", "Performance management",
  "Social media management", "Content creation", "Photography", "Adobe Photoshop", "Adobe Illustrator", "Email marketing",
  "Sales", "Cold calling", "Lead generation", "Upselling",
  "Event planning", "Travel arrangements", "Calendar management",
];

/** Every suggestion, without duplicates, alphabetical. */
export const SKILL_CATALOG = [...new Set([...SOFT, ...TOOLS, ...ROLE_FIELDS.flatMap((f) => f.skills), ...EXTRA])].sort((a, b) => a.localeCompare(b));

/** Skills matching what was typed: ones that start with it first, then ones containing it. */
export function searchSkills(query: string, exclude: string[], limit = 8): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const taken = new Set(exclude.map((x) => x.toLowerCase()));
  const pool = SKILL_CATALOG.filter((s) => !taken.has(s.toLowerCase()));
  const starts = pool.filter((s) => s.toLowerCase().startsWith(q) || s.toLowerCase().split(/[\s/-]+/).some((w) => w.startsWith(q)));
  const contains = pool.filter((s) => !starts.includes(s) && s.toLowerCase().includes(q));
  return [...starts, ...contains].slice(0, limit);
}
