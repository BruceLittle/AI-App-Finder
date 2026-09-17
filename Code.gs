// ============================================================================
// AI Tool Finder — Apps Script + Firestore backend
// ============================================================================
// SETUP (do this first):
// 1. Set FIRESTORE_PROJECT_ID below to your Firebase project's Project ID
//    (Firebase console -> gear icon -> Project settings -> Project ID).
// 2. In this Apps Script editor: Project Settings (gear icon, left sidebar)
//    -> "Google Cloud Platform (GCP) Project" -> Change project -> paste in
//    your Firebase project's *Project number* (same Project Settings page in
//    Firebase console, just below Project ID). This lets ScriptApp.getOAuthToken()
//    mint tokens valid for your Firestore database, no service account needed.
// 3. Make sure Firestore is created for that project (Firebase console -> Build
//    -> Firestore Database -> Create database) if it isn't already.
// 4. Run seedTools() once (select it from the function dropdown above and
//    click Run) to populate Firestore from the SEED_TOOLS array at the bottom
//    of this file. Check View -> Logs afterward to confirm every tool wrote
//    with response code 200.
// 5. Deploy -> New deployment -> type "Web app" -> Execute as: Me,
//    Who has access: Anyone within Zeitview (matches appsscript.json's
//    "access": "DOMAIN" -- change both to "ANYONE" if you want it public).
// ============================================================================

const FIRESTORE_PROJECT_ID = 'YOUR_FIREBASE_PROJECT_ID'; // <-- set this
const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/' + FIRESTORE_PROJECT_ID + '/databases/(default)/documents';

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('AI Tool Finder')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** Called from the client (google.script.run.getTools()) to load the catalog. */
function getTools() {
  const url = FIRESTORE_BASE + '/tools?pageSize=300';
  const resp = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true
  });
  const code = resp.getResponseCode();
  if (code !== 200) {
    throw new Error('Firestore read failed (' + code + '): ' + resp.getContentText());
  }
  const data = JSON.parse(resp.getContentText());
  const docs = data.documents || [];
  return docs.map(function (doc) {
    const id = doc.name.split('/').pop();
    const obj = fromFirestoreFields_(doc.fields);
    obj.id = id;
    return obj;
  });
}

/* ---------------------------------------------------------------------
   Firestore <-> plain-JS conversion helpers
--------------------------------------------------------------------- */

function toFirestoreValue_(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFirestoreValue_) } };
  if (typeof v === 'object') return { mapValue: { fields: toFirestoreFields_(v) } };
  return { stringValue: String(v) };
}

function toFirestoreFields_(obj) {
  const fields = {};
  Object.keys(obj).forEach(function (k) {
    if (k === 'id') return; // id becomes the document ID, not a field
    fields[k] = toFirestoreValue_(obj[k]);
  });
  return fields;
}

function fromFirestoreValue_(v) {
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('doubleValue' in v) return v.doubleValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromFirestoreValue_);
  if ('mapValue' in v) return fromFirestoreFields_(v.mapValue.fields || {});
  return null;
}

function fromFirestoreFields_(fields) {
  const obj = {};
  Object.keys(fields || {}).forEach(function (k) {
    obj[k] = fromFirestoreValue_(fields[k]);
  });
  return obj;
}

/* ---------------------------------------------------------------------
   One-time migration — run this ONCE from the Apps Script editor to
   populate Firestore. Safe to re-run: it overwrites each doc by id.
--------------------------------------------------------------------- */

function seedTools() {
  SEED_TOOLS.forEach(function (tool) {
    const body = JSON.stringify({ fields: toFirestoreFields_(tool) });
    // patch (PUT-like) with documentId query param creates-or-overwrites the doc
    const url = FIRESTORE_BASE + '/tools/' + encodeURIComponent(tool.id);
    const resp = UrlFetchApp.fetch(url, {
      method: 'patch',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      payload: body,
      muteHttpExceptions: true
    });
    Logger.log(tool.id + ': ' + resp.getResponseCode());
    if (resp.getResponseCode() >= 300) Logger.log(resp.getContentText());
  });
  Logger.log('Done. Check the log lines above -- every tool should read 200.');
}

/* ---------------------------------------------------------------------
   Seed data — the current AI Tool Finder catalog (26 tools). This is only
   used by seedTools() above; after seeding, the live app reads from
   Firestore, and this array is just a record of what was migrated.
   Edit tools going forward directly in Firestore (or re-run seedTools()
   after editing this array).
--------------------------------------------------------------------- */

const SEED_TOOLS = [
  {
    id:'chatgpt', name:'ChatGPT', vendor:'OpenAI', url:'https://chatgpt.com',
    tagline:'General-purpose chat assistant for writing, code, data, and research.',
    categories:['writing','coding','data','research','support'],
    subtasks:{ writing:['draft','edit','marketing','summarize'], coding:['inline-help','build-app','script-automation','debug'], data:['explore-analyze','forecast'], research:['web-research','doc-grounded'], support:['draft-responses'] },
    skillMin:'nocode',
    tiers:[ {budget:'free',handling:'consumer',label:'Free'}, {budget:'individual',handling:'consumer',label:'Plus ($20/mo)'}, {budget:'team',handling:'enterprise',label:'Team'}, {budget:'enterprise',handling:'enterprise',label:'Enterprise'} ],
    ongoingFit:true, setupHeavy:false,
    example:{ writing:'Paste a rough incident summary and ask for a client-ready email in Zeitview\'s tone.', coding:'Describe a report-formatting script in plain English and get a working Python draft.', data:'Upload a CSV of inspection findings and ask which sites have recurring issues.', research:'Ask it to pull together what changed in a regulation and summarize the implications.', support:'Draft three response options for a recurring customer question.' },
    why:{ writing:'Fast, flexible drafting with a huge range of tone and format control.', coding:'Code Interpreter and plugins make it a strong generalist coding assistant.', data:'Built-in data analysis mode reads spreadsheets and writes its own analysis code.', research:'Browsing mode plus strong synthesis for open-ended questions.', support:'Good at producing several response drafts fast for an agent to choose from.' },
    steps:['Sign in with a work or personal account depending on plan.','Start a chat and describe the task in plain language, including format and audience.','Iterate — ask it to shorten, formalize, or restructure the draft.','For sensitive data, use only a Team/Enterprise workspace, never the free/Plus consumer tier.']
  },
  {
    id:'claude', name:'Claude', vendor:'Anthropic', url:'https://claude.ai',
    tagline:'Assistant built for careful long-form writing, analysis, and coding.',
    categories:['writing','coding','data','research'],
    subtasks:{ writing:['draft','edit','summarize'], coding:['inline-help','build-app','script-automation','debug'], data:['explore-analyze'], research:['web-research','doc-grounded','fact-check'] },
    skillMin:'nocode',
    tiers:[ {budget:'free',handling:'consumer',label:'Free'}, {budget:'individual',handling:'consumer',label:'Pro ($20/mo)'}, {budget:'team',handling:'enterprise',label:'Team'}, {budget:'enterprise',handling:'enterprise',label:'Enterprise'} ],
    ongoingFit:true, setupHeavy:false,
    example:{ writing:'Feed it a messy policy draft and ask for a clean, structured rewrite with tracked reasoning.', coding:'Hand it an existing script and ask for a refactor with an explanation of each change.', data:'Upload a spreadsheet of flight/inspection logs and ask for an analysis with a chart.', research:'Ground it in a folder of source documents (Projects) and ask questions only from those.' },
    why:{ writing:'Strong at long documents, nuance, and keeping a consistent structure.', coding:'Claude Code extends this into full agentic coding sessions in a terminal or IDE.', data:'Handles large documents and spreadsheets well, with transparent step-by-step reasoning.', research:'Projects let you ground answers strictly in documents you provide, reducing hallucination risk.' },
    steps:['Sign in and start a chat, or open a Project to ground it in specific documents.','Describe the task and paste or upload the source material.','Ask follow-up questions to refine — it holds context well across a long thread.','Use a Team/Enterprise workspace for anything beyond public information.']
  },
  {
    id:'gemini', name:'Gemini', vendor:'Google', url:'https://gemini.google.com',
    tagline:"Google's assistant, deeply integrated with Workspace (Docs, Sheets, Gmail).",
    categories:['writing','coding','data','research','support'],
    subtasks:{ writing:['draft','edit','summarize'], coding:['inline-help','debug'], data:['explore-analyze','build-dashboard'], research:['web-research','meeting-notes'], support:['draft-responses'] },
    skillMin:'nocode',
    tiers:[ {budget:'free',handling:'consumer',label:'Free'}, {budget:'individual',handling:'consumer',label:'Google AI Pro'}, {budget:'team',handling:'business',label:'Workspace add-on'}, {budget:'enterprise',handling:'enterprise',label:'Workspace Enterprise'} ],
    ongoingFit:true, setupHeavy:false,
    example:{ writing:'Right inside Gmail, ask it to draft a reply using the thread as context.', coding:'Ask for a quick Apps Script to automate a Sheet you already use.', data:'In Sheets, ask it to summarize a column of inspection notes into categories.', research:'Summarize a long email thread or set of linked Docs into a decision log.', support:'Draft support replies directly from a Gmail thread.' },
    why:{ writing:'No extra login — it lives inside the Docs, Sheets, and Gmail people already use.', coding:'Handy for small Apps Script automations tied to Workspace files.', data:'Works natively on live Sheets data without exporting anything.', research:'Strong at summarizing across your own Gmail/Docs/Drive content.', support:'Drafts replies in context without leaving the inbox.' },
    steps:['Confirm whether Zeitview\'s Workspace plan includes Gemini (check with IT).','Open it from the side panel in Docs, Sheets, or Gmail, or use gemini.google.com directly.','Ask it to work with the content of the open file for the most relevant results.','Prefer the Workspace-integrated tier over a personal Google account for company data.']
  },
  {
    id:'perplexity', name:'Perplexity', vendor:'Perplexity AI', url:'https://perplexity.ai',
    tagline:'Search-first AI that answers questions with cited sources.',
    categories:['research'],
    subtasks:{ research:['web-research','fact-check'] },
    skillMin:'nocode',
    tiers:[ {budget:'free',handling:'consumer',label:'Free'}, {budget:'individual',handling:'consumer',label:'Pro ($20/mo)'}, {budget:'enterprise',handling:'enterprise',label:'Enterprise Pro'} ],
    ongoingFit:true, setupHeavy:false,
    example:{ research:'Ask "what changed in FAA Part 107 rules this year" and get a cited, current answer.' },
    why:{ research:'Every answer comes with linked sources, which makes it easy to verify before citing it externally.' },
    steps:['Go to perplexity.ai and ask your question directly — no setup required.','Check the cited sources before using the answer in anything client-facing.','Use "Focus" filters to restrict search to academic, news, or specific source types.']
  },
  {
    id:'notebooklm', name:'NotebookLM', vendor:'Google', url:'https://notebooklm.google.com',
    tagline:'Upload your own documents and get answers grounded only in them.',
    categories:['research','writing'],
    subtasks:{ research:['doc-grounded','fact-check'], writing:['summarize'] },
    skillMin:'nocode',
    tiers:[ {budget:'free',handling:'consumer',label:'Free'}, {budget:'team',handling:'business',label:'Via Workspace'} ],
    ongoingFit:true, setupHeavy:false,
    example:{ research:'Upload a stack of vendor contracts and ask it to compare termination clauses, with citations back to the exact page.', writing:'Turn a pile of source PDFs into a briefing summary with an audio overview.' },
    why:{ research:'Answers are grounded strictly in the documents you upload, with inline citations — low hallucination risk.', writing:'Its "audio overview" feature turns dense source material into a digestible briefing fast.' },
    steps:['Create a notebook and upload the source documents (PDFs, Docs, slides, links).','Ask questions — every answer links back to the specific source passage.','Use the generated summary or audio overview as a first-pass briefing, not a final citation.']
  },
  {
    id:'grammarly', name:'Grammarly', vendor:'Grammarly', url:'https://grammarly.com',
    tagline:'Grammar, tone, and clarity checking as you type.',
    categories:['writing'],
    subtasks:{ writing:['edit'] },
    skillMin:'nocode',
    tiers:[ {budget:'free',handling:'consumer',label:'Free'}, {budget:'individual',handling:'consumer',label:'Premium'}, {budget:'team',handling:'business',label:'Business'} ],
    ongoingFit:true, setupHeavy:false,
    example:{ writing:'Turns on automatically in Gmail or a Google Doc and flags tone/clarity issues as you write a client email.' },
    why:{ writing:'Lightweight, works everywhere you already type, and needs zero prompting.' },
    steps:['Install the browser extension or desktop app.','Write normally — it underlines suggestions inline.','Set tone goals (e.g. "formal", "confident") in the sidebar for more targeted suggestions.']
  },
  {
    id:'jasper', name:'Jasper', vendor:'Jasper AI', url:'https://jasper.ai',
    tagline:'Marketing-focused copywriting with brand voice controls.',
    categories:['writing'],
    subtasks:{ writing:['marketing','draft'] },
    skillMin:'nocode',
    tiers:[ {budget:'individual',handling:'consumer',label:'Creator'}, {budget:'team',handling:'business',label:'Team'}, {budget:'enterprise',handling:'enterprise',label:'Business'} ],
    ongoingFit:true, setupHeavy:false,
    example:{ writing:'Generate a set of on-brand social captions and ad variants from one campaign brief.' },
    why:{ writing:'Brand-voice profiles keep output consistent across a marketing team, unlike a general chatbot.' },
    steps:['Set up a Brand Voice profile from existing marketing material.','Pick a campaign template or start from a blank brief.','Generate variants, then hand-edit the strongest ones.']
  },
  {
    id:'copyai', name:'Copy.ai', vendor:'Copy.ai', url:'https://copy.ai',
    tagline:'Marketing copy generation with light workflow automation.',
    categories:['writing','automation'],
    subtasks:{ writing:['marketing','draft'], automation:['internal-process'] },
    skillMin:'nocode',
    tiers:[ {budget:'free',handling:'consumer',label:'Free'}, {budget:'individual',handling:'consumer',label:'Starter'}, {budget:'team',handling:'business',label:'Team'} ],
    ongoingFit:true, setupHeavy:false,
    example:{ writing:'Turn one product description into ad copy for five different channels at once.', automation:'Chain a research step and a writing step into one repeatable "workflow" for content requests.' },
    why:{ writing:'Purpose-built templates for common marketing copy formats.', automation:'Its Workflows feature adds light multi-step automation without needing a separate tool.' },
    steps:['Pick a template (ad copy, product description, etc.) or build a Workflow.','Fill in the product/campaign details.','Review and edit generated variants before publishing.']
  },
  {
    id:'notionai', name:'Notion AI', vendor:'Notion', url:'https://notion.so/product/ai',
    tagline:'AI built into Notion docs, databases, and pages.',
    categories:['writing','data','automation'],
    subtasks:{ writing:['draft','summarize'], data:['smart-database'], automation:['internal-process'] },
    skillMin:'nocode',
    tiers:[ {budget:'individual',handling:'consumer',label:'Plus add-on'}, {budget:'team',handling:'business',label:'Business'}, {budget:'enterprise',handling:'enterprise',label:'Enterprise'} ],
    ongoingFit:true, setupHeavy:false,
    example:{ writing:'Summarize a long meeting notes page into action items automatically.', data:'Ask questions across your whole Notion workspace and get an answer with linked sources.', automation:'Auto-fill a database property (like status or category) using AI as new rows are added.' },
    why:{ writing:'Summaries and drafts live right next to the source doc, no copy-pasting.', data:'"Notion Q&A" searches your whole workspace like a personal knowledge base.', automation:'Database automations plus AI cut down on manual tagging/categorizing.' },
    steps:['Turn on the AI add-on for your workspace.','Use the AI block inside any page, or ask Q&A from the sidebar.','For databases, set AI-powered autofill on a property to keep it current automatically.']
  },
  {
    id:'cursor', name:'Cursor', vendor:'Anysphere', url:'https://cursor.com',
    tagline:'A code editor built around an AI agent that edits multi-file projects.',
    categories:['coding'],
    subtasks:{ coding:['build-app','debug','inline-help'] },
    skillMin:'technical',
    tiers:[ {budget:'free',handling:'consumer',label:'Hobby (free)'}, {budget:'individual',handling:'consumer',label:'Pro'}, {budget:'team',handling:'business',label:'Business'} ],
    ongoingFit:true, setupHeavy:true,
    example:{ coding:'Describe a feature in plain English and let the agent edit several files at once to implement it.' },
    why:{ coding:'Goes beyond autocomplete — its agent mode can plan and execute changes across a whole codebase.' },
    steps:['Download Cursor and open your project folder (it\'s a VS Code fork, so settings/extensions carry over).','Use Chat/Agent mode and describe the change you want in plain language.','Review the diff before accepting — it shows exactly what it changed and why.']
  },
  {
    id:'claudecode', name:'Claude Code', vendor:'Anthropic', url:'https://claude.com/claude-code',
    tagline:'Agentic coding in your terminal — plans, edits, tests, and runs commands.',
    categories:['coding'],
    subtasks:{ coding:['build-app','script-automation','debug'] },
    skillMin:'technical',
    tiers:[ {budget:'individual',handling:'consumer',label:'Included with Pro'}, {budget:'team',handling:'enterprise',label:'Team'}, {budget:'enterprise',handling:'enterprise',label:'Enterprise'} ],
    ongoingFit:true, setupHeavy:true,
    example:{ coding:'Point it at a repo and ask it to add a feature end-to-end — it reads the code, writes changes, and runs the tests itself.' },
    why:{ coding:'Handles multi-step engineering work autonomously, not just single suggestions — good for larger, self-contained tasks.' },
    steps:['Install the CLI (npm install -g via docs) and sign in.','Run it from inside a project repo.','Describe the task; review each proposed change before it\'s applied.']
  },
  {
    id:'replit', name:'Replit', vendor:'Replit', url:'https://replit.com',
    tagline:'Browser-based coding environment with an AI agent that builds full apps.',
    categories:['coding','automation'],
    subtasks:{ coding:['build-app'], automation:['custom-bot'] },
    skillMin:'some',
    tiers:[ {budget:'free',handling:'consumer',label:'Free'}, {budget:'individual',handling:'consumer',label:'Core'}, {budget:'team',handling:'business',label:'Teams'} ],
    ongoingFit:true, setupHeavy:false,
    example:{ coding:'Describe a small internal tool (e.g. "a form that logs inspection issues to a table") and get a working, hosted app.', automation:'Build and host a small scheduled script without managing any infrastructure.' },
    why:{ coding:'Lowest-friction way to go from an idea to a hosted, working app — nothing to install.', automation:'Good for a small internal bot or scheduled job you don\'t want to run your own server for.' },
    steps:['Create a Repl and describe what you want to build to the Agent.','Let it scaffold the app, then test it in the built-in preview.','Publish/deploy from the same interface when it\'s ready.']
  },
  {
    id:'v0', name:'v0', vendor:'Vercel', url:'https://v0.dev',
    tagline:'Generates real front-end UI code from a text or image prompt.',
    categories:['coding'],
    subtasks:{ coding:['build-app'] },
    skillMin:'some',
    tiers:[ {budget:'free',handling:'consumer',label:'Free'}, {budget:'individual',handling:'consumer',label:'Premium'}, {budget:'team',handling:'business',label:'Team'} ],
    ongoingFit:false, setupHeavy:false,
    example:{ coding:'Describe a dashboard layout and get real, editable React/Tailwind code you can drop into a project.' },
    why:{ coding:'Produces clean, actually-usable front-end code rather than a mockup image.' },
    steps:['Describe the UI you want, or upload a screenshot/sketch.','Iterate in chat to adjust layout, copy, and components.','Export the generated code into your own project.']
  },
  {
    id:'lovable', name:'Lovable', vendor:'Lovable', url:'https://lovable.dev',
    tagline:'Describe an app in plain English; get a working full-stack app back.',
    categories:['coding'],
    subtasks:{ coding:['build-app'] },
    skillMin:'nocode',
    tiers:[ {budget:'free',handling:'consumer',label:'Free'}, {budget:'individual',handling:'consumer',label:'Starter'}, {budget:'team',handling:'business',label:'Launch'} ],
    ongoingFit:false, setupHeavy:false,
    example:{ coding:'Describe "an internal tool where field techs log completed inspections with photos" and get a working app with a database, no coding required.' },
    why:{ coding:'The most no-code-friendly of the AI app builders — genuinely usable without programming experience.' },
    steps:['Describe the app you want in plain language.','Use chat to refine screens, fields, and logic.','Publish directly, or export the code if a developer wants to take it further.']
  },
  {
    id:'airtable', name:'Airtable', vendor:'Airtable', url:'https://airtable.com',
    tagline:'Spreadsheet-database hybrid with AI fields and automations.',
    categories:['data','automation'],
    subtasks:{ data:['smart-database','build-dashboard'], automation:['internal-process','data-sync'] },
    skillMin:'nocode',
    tiers:[ {budget:'free',handling:'consumer',label:'Free'}, {budget:'individual',handling:'business',label:'Team'}, {budget:'team',handling:'business',label:'Business'}, {budget:'enterprise',handling:'enterprise',label:'Enterprise'} ],
    ongoingFit:true, setupHeavy:true,
    example:{ data:'Track inspection sites as records, with an AI field that auto-summarizes each site\'s issue history.', automation:'Auto-notify a channel when a record\'s status changes to "needs review".' },
    why:{ data:'Structured like a database but as approachable as a spreadsheet — good for ongoing tracking, not one-off analysis.', automation:'Built-in automations trigger off record changes without any external tool.' },
    steps:['Build or import a base (table) for the data you\'re tracking.','Add an AI field to summarize, categorize, or generate text per row.','Set up an automation to trigger on the changes you care about.']
  },
  {
    id:'julius', name:'Julius AI', vendor:'Julius', url:'https://julius.ai',
    tagline:'Chat with your data — upload a file and ask questions in plain English.',
    categories:['data'],
    subtasks:{ data:['explore-analyze','forecast'] },
    skillMin:'nocode',
    tiers:[ {budget:'free',handling:'consumer',label:'Free'}, {budget:'individual',handling:'consumer',label:'Plus'} ],
    ongoingFit:false, setupHeavy:false,
    example:{ data:'Upload a CSV export and ask "which region had the most repeat issues this quarter", get a chart back.' },
    why:{ data:'Lowest-friction way for a non-technical person to get real statistical answers from a spreadsheet.' },
    steps:['Upload a CSV or Excel file.','Ask your question in plain English.','Ask follow-ups to drill into anything that looks interesting — it remembers context.']
  },
  {
    id:'midjourney', name:'Midjourney', vendor:'Midjourney, Inc.', url:'https://midjourney.com',
    tagline:'The highest-quality AI image generator, prompt-driven.',
    categories:['creative'],
    subtasks:{ creative:['still-image','brand-design'] },
    skillMin:'some',
    tiers:[ {budget:'individual',handling:'consumer',label:'Basic'}, {budget:'team',handling:'consumer',label:'Pro'} ],
    ongoingFit:true, setupHeavy:false,
    example:{ creative:'Generate concept art or a striking hero image for a presentation or landing page.' },
    why:{ creative:'Still the benchmark for image quality and style control, though it takes some prompt practice.' },
    steps:['Join via Discord or the web app and subscribe to a plan (no free tier).','Write a prompt describing subject, style, and mood.','Upscale and refine your favorite of the generated variations.']
  },
  {
    id:'firefly', name:'Adobe Firefly', vendor:'Adobe', url:'https://firefly.adobe.com',
    tagline:'Commercially-safe AI image generation, integrated into Creative Cloud.',
    categories:['creative'],
    subtasks:{ creative:['still-image','brand-design'] },
    skillMin:'nocode',
    tiers:[ {budget:'free',handling:'consumer',label:'Free'}, {budget:'individual',handling:'consumer',label:'Premium'}, {budget:'enterprise',handling:'enterprise',label:'Enterprise'} ],
    ongoingFit:true, setupHeavy:false,
    example:{ creative:'Generate a marketing background image with IP indemnification suitable for external client use.' },
    why:{ creative:'Trained on licensed content with commercial-use indemnification — the safer choice for anything client-facing.' },
    steps:['Open Firefly directly, or the Generative Fill/Expand tools inside Photoshop.','Describe or sketch what you want.','For external/client use, prefer this over consumer tools for IP safety.']
  },
  {
    id:'canva', name:'Canva Magic Studio', vendor:'Canva', url:'https://canva.com',
    tagline:'Easy templated design with AI generation baked in.',
    categories:['creative','writing'],
    subtasks:{ creative:['brand-design','still-image'], writing:['draft'] },
    skillMin:'nocode',
    tiers:[ {budget:'free',handling:'consumer',label:'Free'}, {budget:'individual',handling:'business',label:'Pro'}, {budget:'team',handling:'business',label:'Teams'}, {budget:'enterprise',handling:'enterprise',label:'Enterprise'} ],
    ongoingFit:true, setupHeavy:false,
    example:{ creative:'Turn a one-line brief into a full social post or one-pager using Magic Design templates.', writing:'Generate first-draft copy directly inside a design layout.' },
    why:{ creative:'Fastest path from idea to a polished, on-brand visual for anyone without design training.', writing:'Handy when the copy and the visual need to be produced together.' },
    steps:['Start from a template or describe what you need to Magic Design.','Customize with your own text, images, and brand kit.','Download or share the finished design directly.']
  },
  {
    id:'runway', name:'Runway', vendor:'Runway', url:'https://runwayml.com',
    tagline:'AI video generation and editing tools.',
    categories:['creative'],
    subtasks:{ creative:['video'] },
    skillMin:'some',
    tiers:[ {budget:'free',handling:'consumer',label:'Free'}, {budget:'individual',handling:'consumer',label:'Standard'}, {budget:'team',handling:'business',label:'Unlimited'}, {budget:'enterprise',handling:'enterprise',label:'Enterprise'} ],
    ongoingFit:true, setupHeavy:false,
    example:{ creative:'Generate a short establishing shot or b-roll clip to open an internal training video.' },
    why:{ creative:'One of the more capable text-to-video tools, plus solid editing features like green-screen and slow-mo.' },
    steps:['Choose a tool (Gen-3 video generation, or an editing tool) from the dashboard.','Describe the clip or upload footage to edit.','Export at the resolution your final format needs.']
  },
  {
    id:'synthesia', name:'Synthesia', vendor:'Synthesia', url:'https://synthesia.io',
    tagline:'Turn a script into a video with an AI presenter avatar.',
    categories:['creative','writing'],
    subtasks:{ creative:['video'], writing:['draft'] },
    skillMin:'nocode',
    tiers:[ {budget:'individual',handling:'business',label:'Starter'}, {budget:'team',handling:'business',label:'Creator'}, {budget:'enterprise',handling:'enterprise',label:'Enterprise'} ],
    ongoingFit:true, setupHeavy:false,
    example:{ creative:'Turn a written safety-training script into a narrated video with an on-screen presenter, no filming required.' },
    why:{ creative:'Removes filming/editing entirely for training or explainer content — just needs a script.' },
    steps:['Write or paste your script.','Pick an avatar, voice, and template.','Generate the video and download or share the link.']
  },
  {
    id:'elevenlabs', name:'ElevenLabs', vendor:'ElevenLabs', url:'https://elevenlabs.io',
    tagline:'Realistic AI voice generation and cloning.',
    categories:['creative'],
    subtasks:{ creative:['voice-audio'] },
    skillMin:'nocode',
    tiers:[ {budget:'free',handling:'consumer',label:'Free'}, {budget:'individual',handling:'consumer',label:'Starter/Creator'}, {budget:'team',handling:'business',label:'Business'}, {budget:'enterprise',handling:'enterprise',label:'Enterprise'} ],
    ongoingFit:true, setupHeavy:false,
    example:{ creative:'Generate a natural-sounding narration track for a training video from a text script.' },
    why:{ creative:'The most natural-sounding voice generation available, with dozens of ready-made voices.' },
    steps:['Paste in the script text.','Choose a voice (or clone one, with proper consent/rights).','Generate and download the audio file.']
  },
  {
    id:'zapier', name:'Zapier', vendor:'Zapier', url:'https://zapier.com',
    tagline:'Connect thousands of apps with no-code triggers and actions.',
    categories:['automation'],
    subtasks:{ automation:['connect-apps','data-sync','internal-process'] },
    skillMin:'nocode',
    tiers:[ {budget:'free',handling:'consumer',label:'Free'}, {budget:'individual',handling:'consumer',label:'Professional'}, {budget:'team',handling:'business',label:'Team'}, {budget:'enterprise',handling:'enterprise',label:'Enterprise'} ],
    ongoingFit:true, setupHeavy:true,
    example:{ automation:'When a new row is added to a form response sheet, automatically create a task and post a Slack notification.' },
    why:{ automation:'The widest app library of any no-code automation tool — if it exists, Zapier probably connects to it.' },
    steps:['Pick a trigger app and event ("New form response").','Add one or more action steps ("Create task", "Send Slack message").','Test the Zap, then turn it on.']
  },
  {
    id:'make', name:'Make', vendor:'Make (Integromat)', url:'https://make.com',
    tagline:'Visual, flowchart-style automation builder for more complex logic.',
    categories:['automation'],
    subtasks:{ automation:['connect-apps','data-sync','internal-process'] },
    skillMin:'some',
    tiers:[ {budget:'free',handling:'consumer',label:'Free'}, {budget:'individual',handling:'consumer',label:'Core'}, {budget:'team',handling:'business',label:'Teams'}, {budget:'enterprise',handling:'enterprise',label:'Enterprise'} ],
    ongoingFit:true, setupHeavy:true,
    example:{ automation:'Build a multi-branch workflow that routes a new lead differently depending on region and deal size.' },
    why:{ automation:'Visual canvas makes branching, multi-step logic easier to design and debug than a linear tool.' },
    steps:['Start a new scenario and add your trigger module.','Add and connect action modules on the visual canvas, including branches/filters.','Run a test, then schedule or activate the scenario.']
  },
  {
    id:'n8n', name:'n8n', vendor:'n8n', url:'https://n8n.io',
    tagline:'Open-source automation platform, self-hostable for full data control.',
    categories:['automation','coding'],
    subtasks:{ automation:['connect-apps','data-sync','custom-bot'], coding:['script-automation'] },
    skillMin:'some',
    tiers:[ {budget:'free',handling:'enterprise',label:'Self-hosted (free)'}, {budget:'individual',handling:'business',label:'Cloud Starter'}, {budget:'team',handling:'business',label:'Cloud Business'}, {budget:'enterprise',handling:'enterprise',label:'Enterprise (self-hosted)'} ],
    ongoingFit:true, setupHeavy:true,
    example:{ automation:'Self-host a workflow that processes inbound files and never sends the data to a third-party cloud.', coding:'Add a custom JavaScript step mid-workflow for logic the visual builder can\'t express.' },
    why:{ automation:'Self-hosting means sensitive data never has to leave infrastructure you control — the strongest option here for confidential workflows.', coding:'Drop-in code nodes give it near-unlimited flexibility for anyone comfortable scripting.' },
    steps:['Choose self-hosted (needs IT/dev support to stand up) or n8n Cloud.','Build the workflow visually, adding a Code node wherever logic gets complex.','Test, then activate the workflow on a schedule or webhook trigger.']
  },
  {
    id:'otter', name:'Otter.ai', vendor:'Otter.ai', url:'https://otter.ai',
    tagline:'Real-time meeting transcription and summarization.',
    categories:['research','writing'],
    subtasks:{ research:['meeting-notes'], writing:['summarize'] },
    skillMin:'nocode',
    tiers:[ {budget:'free',handling:'consumer',label:'Free'}, {budget:'individual',handling:'consumer',label:'Pro'}, {budget:'team',handling:'business',label:'Business'}, {budget:'enterprise',handling:'enterprise',label:'Enterprise'} ],
    ongoingFit:true, setupHeavy:false,
    example:{ research:'Auto-join a recurring stakeholder call and produce a shareable summary with action items afterward.', writing:'Turn a rambling voice memo into a clean written summary.' },
    why:{ research:'Joins calls automatically and separates speakers, which is a genuine time-saver for recurring meetings.', writing:'One of the more reliable transcript-to-summary pipelines for spoken content.' },
    steps:['Connect your calendar or invite the Otter bot to a specific meeting.','Let it record, transcribe, and summarize automatically.','Share or edit the summary and action items afterward.']
  },
];
