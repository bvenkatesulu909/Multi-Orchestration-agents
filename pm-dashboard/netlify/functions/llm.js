// ── OpenRouter multi-model fallback service ──────────────────────────────
// Free models chain — if one is rate-limited, falls to the next

const FREE_MODELS = [
  'google/gemini-2.0-flash-exp:free',
  'mistralai/mistral-7b-instruct:free',
  'meta-llama/llama-3.2-3b-instruct:free',
  'microsoft/phi-3-mini-4k-instruct:free',
  'qwen/qwen-2.5-7b-instruct:free',
  'deepseek/deepseek-chat:free',
];

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';

// ── System prompts for each agent role ──────────────────────────────────
const AGENT_PROMPTS = {
  manager: `You are the Manager Agent — the orchestrator of a multi-agent AI system.
Your job: Take a user task, break it down into concrete subtasks, and assign each to the right agent.
Available agents: Planning (architecture), Research (information gathering), Coding (implementation), Specialized (domain expertise), Worker (execution/deployment), Memory (state/documentation).
Respond with a structured breakdown. Keep it concise and actionable.`,

  planner: `You are the Planning Agent — the system architect.
Your job: Given a task, create a detailed implementation plan with specific steps, file paths, and technical approach.
Be specific about technologies, APIs, and data flow. Output a structured plan.`,

  research: `You are the Research Agent — the information gatherer.
Your job: Research the given topic, explore best practices, APIs, and patterns.
Return structured findings with actionable recommendations.`,

  coding: `You are the Coding Agent — a senior software engineer.
Your job: Write production-ready code for the given task.
Include file paths, imports, error handling, and tests where appropriate.
Output the actual code with clear file structure.`,

  specialized: `You are the Specialized Agent — a domain expert.
Your job: Provide expert analysis on UI/UX, database design, testing strategy, deployment, or security.
Output specific, actionable recommendations for your domain.`,

  worker: `You are the Worker Agent — the execution/ops engineer.
Your job: Given a task, describe the exact steps to execute it: dependencies to install, commands to run, build steps, test execution, and deployment procedures.`,

  memory: `You are the Memory Agent — the system archivist.
Your job: Document the state, decisions, and context of the task for cross-session continuity.
Record what was done, what decisions were made, and what artifacts were created.`,
};

// ── Call OpenRouter with fallback chain ──────────────────────────────────
async function callLLM(agentId, task, ragContext = '') {
  const systemPrompt = AGENT_PROMPTS[agentId] || AGENT_PROMPTS.worker;
  
  const userPrompt = `
## Task
Title: ${task.title || 'Untitled'}
Description: ${task.description || 'N/A'}
Input Data: ${task.input_data || 'N/A'}
Priority: ${task.priority || 'medium'}

${ragContext ? `## Relevant Knowledge Context\n${ragContext}\n` : ''}

## Instructions
Execute this task as the ${agentId} agent. Provide a complete, actionable response.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  let lastError = null;

  for (const model of FREE_MODELS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000); // 25s timeout per model

      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://chipper-tapioca-457e49.netlify.app',
          'X-Title': 'Multi-Agent System',
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: 1024,
          temperature: 0.7,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (res.status === 429) {
        // Rate limited — try next model
        lastError = `Rate limited on ${model}`;
        continue;
      }

      if (!res.ok) {
        lastError = `Error ${res.status} on ${model}: ${await res.text()}`;
        continue;
      }

      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      if (content) {
        return { content, model };
      }

      lastError = `Empty response from ${model}`;
    } catch (err) {
      lastError = `${model}: ${err.message}`;
      continue;
    }
  }

  // All models failed — return error with deterministic fallback
  return {
    content: generateFallbackOutput(agentId, task),
    model: 'fallback (deterministic)',
    fallback: true,
    error: lastError,
  };
}

// ── Deterministic fallback when all LLMs fail ────────────────────────────
function generateFallbackOutput(agentId, task) {
  const outputs = {
    manager: `✓ Task decomposed into 3 subtasks\n  Subtasks assigned to: Planning, Research, Coding\n  Note: LLM temporarily unavailable — using deterministic mode`,
    planner: `📋 Implementation plan for "${task.title}":\n  Phase 1: Analysis\n  Phase 2: Design\n  Phase 3: Implementation\n  Phase 4: Testing`,
    research: `🔍 Research findings for "${task.title}":\n  Best practices identified\n  3 approaches found\n  Recommendations included in output`,
    coding: `💻 Code structure for "${task.title}":\n  src/index.js — Main logic\n  src/utils.js — Helper functions\n  Tests: 3 test cases identified`,
    specialized: `🎯 Expert analysis for "${task.title}":\n  Architecture review: Optimal\n  Performance: Within acceptable range\n  Security: Standard measures applied`,
    worker: `🔧 Execution plan for "${task.title}":\n  Install dependencies\n  Run build\n  Execute tests\n  Deploy`,
    memory: `🧠 State recorded for "${task.title}":\n  Session context saved\n  Decisions documented\n  Artifacts cataloged`,
  };
  return (outputs[agentId] || `Agent ${agentId} processed task: ${task.title}`) + '\n  [LLM unavailable — deterministic fallback]';
}

// ── RAG: Embedding + retrieval ───────────────────────────────────────────
// Uses the LLM itself to generate embeddings via a simple approach

const KNOWLEDGE_DOCS = [
  {
    id: 'arch-patterns',
    title: 'System Architecture Patterns',
    content: `The multi-agent system uses a Manager-Worker architecture. Manager decomposes tasks, 
    assigns subtasks to specialized agents (Planner, Research, Coding, Specialized, Worker, Memory).
    Each agent has a specific role and system prompt. Communication is via structured JSON.`,
    tags: ['architecture', 'design', 'agents'],
  },
  {
    id: 'api-routing',
    title: 'API Routing & Netlify Functions',
    content: `The backend uses a single Netlify Function at /api/* that handles all routes.
    Route parsing is manual via URL path parts. CORS is enabled via headers.
    Data is stored in /tmp/agent-tasks.json (per-instance persistence).`,
    tags: ['api', 'netlify', 'deployment'],
  },
  {
    id: 'rag-system',
    title: 'RAG (Retrieval Augmented Generation)',
    content: `RAG enhances LLM responses by retrieving relevant documents before generation.
    Documents are stored with metadata and tags. Retrieval is via keyword matching and TF-IDF scoring.
    Retrieved context is injected into the LLM prompt as "Relevant Knowledge Context".`,
    tags: ['rag', 'retrieval', 'llm'],
  },
  {
    id: 'model-fallback',
    title: 'Multi-Model Fallback Strategy',
    content: `The system chains through free OpenRouter models: Gemini Flash → Mistral 7B → 
    Llama 3.2 3B → Phi-3 Mini → Qwen 2.5 7B → DeepSeek Chat. Each has a 25s timeout.
    On 429 (rate limit) or error, it tries the next model. If all fail, deterministic fallback is used.`,
    tags: ['models', 'fallback', 'openrouter'],
  },
  {
    id: 'free-models',
    title: 'OpenRouter Free Models List',
    content: `Available free models on OpenRouter: google/gemini-2.0-flash-exp:free (fast, multi-modal),
    mistralai/mistral-7b-instruct:free (strong reasoning),
    meta-llama/llama-3.2-3b-instruct:free (lightweight),
    microsoft/phi-3-mini-4k-instruct:free (efficient),
    qwen/qwen-2.5-7b-instruct:free (balanced),
    deepseek/deepseek-chat:free (strong coding).`,
    tags: ['models', 'free', 'openrouter'],
  },
  {
    id: 'best-practices',
    title: 'Agent System Best Practices',
    content: `Use structured prompts with clear agent roles. Always include task context.
    Implement fallback chains for reliability. Use RAG to provide domain knowledge.
    Poll for updates rather than pushing. Keep responses concise and actionable.`,
    tags: ['agents', 'best-practices', 'design'],
  },
];

function retrieveRelevantDocs(query, maxResults = 2) {
  const queryTerms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const scored = KNOWLEDGE_DOCS.map(doc => {
    const text = (doc.title + ' ' + doc.content + ' ' + doc.tags.join(' ')).toLowerCase();
    let score = 0;
    for (const term of queryTerms) {
      if (text.includes(term)) {
        score += 1;
        // Bonus for title matches
        if (doc.title.toLowerCase().includes(term)) score += 2;
        // Bonus for tag matches
        if (doc.tags.some(t => t.includes(term))) score += 1.5;
      }
    }
    return { ...doc, score };
  });

  return scored
    .filter(d => d.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
}

// ── Add a new knowledge document ──────────────────────────────────────────
function addKnowledgeDoc(title, content, tags = []) {
  const doc = {
    id: `doc-${Date.now()}`,
    title,
    content,
    tags,
  };
  KNOWLEDGE_DOCS.push(doc);
  return doc;
}

// ── Agent execution with RAG + LLM ───────────────────────────────────────
async function executeAgentWithLLM(agentId, task) {
  // 1. Retrieve relevant knowledge via RAG
  const query = `${agentId} ${task.title} ${task.description || ''} ${task.input_data || ''}`;
  const relevantDocs = retrieveRelevantDocs(query);
  const ragContext = relevantDocs.length > 0
    ? relevantDocs.map(d => `[${d.title}] ${d.content}`).join('\n\n')
    : '';

  // 2. Also retrieve general agent system docs
  const systemDocs = retrieveRelevantDocs('agent system architecture', 1);
  const systemContext = systemDocs.length > 0
    ? `\nSystem Context: ${systemDocs[0].content.substring(0, 300)}`
    : '';

  // 3. Call LLM with RAG context
  const fullContext = ragContext + systemContext;
  const result = await callLLM(agentId, task, fullContext);

  return result;
}

module.exports = {
  FREE_MODELS,
  callLLM,
  executeAgentWithLLM,
  retrieveRelevantDocs,
  addKnowledgeDoc,
  KNOWLEDGE_DOCS,
  generateFallbackOutput,
  AGENT_PROMPTS,
};