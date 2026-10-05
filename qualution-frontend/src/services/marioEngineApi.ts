import type { CircuitRequest } from '../features/circuit/types';

export interface MarioTurnResponse {
  kind: 'question' | 'experiment_offer' | 'reflection_prompt' | 'verification' | 'encouragement' | 'handoff';
  text: string;
  hint_level: number;
  experiment_id?: string;
  facts_used?: Record<string, any>[];
  state: 'IDLE' | 'DETECT' | 'DIAGNOSE' | 'QUESTION' | 'EXPERIMENT' | 'REFLECT' | 'VERIFY' | 'RESOLVED' | 'HANDOFF';
  misconception_id?: string;
  path_used?: string;
}

export interface ExperimentDiffResponse {
  misconception_id: string;
  universe_a: {
    label: string;
    circuit: any;
    probabilities: Record<string, number>;
    purity: number;
  };
  universe_b: {
    label: string;
    circuit: any;
    probabilities: Record<string, number>;
    purity: number;
  };
  diff_summary: {
    tvd_distance: number;
    purity_delta: number;
    is_distinguishable: boolean;
  };
}

const API_BASE = (() => {
  const base = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8001/api/v1';
  // Misconception routes are mounted at root (/misconception/...), not /api/v1/misconception
  return base.replace(/\/api\/v1\/?$/, '');
})();


export async function submitSocraticTurn(
  sessionId: string,
  lessonId: string,
  stepId: string,
  circuit: CircuitRequest,
  studentPrediction: Record<string, number> | string,
  confidence: number = 0.8,
  authToken: string = 'jwt-eval-usr-student-999'
): Promise<MarioTurnResponse> {
  const res = await fetch(`${API_BASE}/misconception/turn`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({
      session_id: sessionId,
      lesson_id: lessonId,
      step_id: stepId,
      circuit,
      student_prediction: studentPrediction,
      confidence
    })
  });

  if (!res.ok) {
    throw new Error(`Mario engine turn request failed: ${res.statusText}`);
  }

  const data = await res.json();
  return data.turn;
}

export async function fetchSocraticExperiment(
  misconceptionId: string,
  circuit: CircuitRequest,
  authToken: string = 'jwt-eval-usr-student-999'
): Promise<ExperimentDiffResponse> {
  const res = await fetch(`${API_BASE}/misconception/experiment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({
      misconception_id: misconceptionId,
      circuit
    })
  });

  if (!res.ok) {
    throw new Error(`Mario experiment request failed: ${res.statusText}`);
  }

  const data = await res.json();
  return data.experiment;
}

export interface SocraticReplyResponse {
  reply: string;
  provider: 'nim' | 'groq' | 'static';
}

const DIRECT_NVIDIA_KEY =
  (import.meta.env.VITE_NVIDIA_API_KEY as string) ||
  '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';

const DIRECT_NVIDIA_MODEL =
  (import.meta.env.VITE_NVIDIA_MODEL as string) || 'meta/llama-3.2-11b-vision-instruct';

/**
 * Directly calls NVIDIA NIM with the active key to synthesize a real-time Socratic question turn.
 */
async function callDirectNvidiaSocratic(
  educatorQuestion: string,
  studentReply: string,
  assessmentContext?: string
): Promise<string | null> {
  if (!DIRECT_NVIDIA_KEY || DIRECT_NVIDIA_KEY.trim().length === 0) return null;

  const systemPrompt =
    'You are Erwin, an expert Socratic quantum computing companion in Qualution Practice Lab. ' +
    'A student is working through quantum circuit design, debugging, or verification and shared their thoughts.\n' +
    'Your goal: guide them with Socratic questioning without giving away the direct solution.\n' +
    'RULES:\n' +
    '1. Acknowledge what the student said in 1 encouraging sentence.\n' +
    '2. Ask ONE redirecting, insightful Socratic question pushing them to examine the circuit wires, gates, or quantum behavior.\n' +
    '3. Maximum 45 words total.\n' +
    '4. Exactly one question mark (?).\n' +
    '5. NEVER give away the answer or gate sequence explicitly.\n' +
    '6. Plain text only, no markdown headers.';

  const userPrompt =
    `Assessment context: ${assessmentContext || 'Quantum Circuit Lab'}\n` +
    `Educator question: ${educatorQuestion}\n` +
    `<STUDENT_REPLY>${studentReply.slice(0, 600)}</STUDENT_REPLY>`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${DIRECT_NVIDIA_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: DIRECT_NVIDIA_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.35,
        max_tokens: 120,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      const raw =
        data.choices?.[0]?.message?.content ||
        data.choices?.[0]?.message?.reasoning_content ||
        '';
      const text = typeof raw === 'string' ? raw.trim() : '';
      if (text.length > 5) {
        return text;
      }
    }
  } catch (err) {
    clearTimeout(timer);
    console.warn('Direct NVIDIA NIM call failed or timed out:', err);
  }
  return null;
}

/**
 * Calls the NIM-powered Socratic reply endpoint.
 * Direct connection to NVIDIA NIM ensures zero latency and full functionality
 * even if local backend is restarting, with fallback to backend proxy and static pool.
 */
export async function fetchSocraticReply(
  educatorQuestion: string,
  studentReply: string,
  assessmentContext?: string
): Promise<SocraticReplyResponse> {
  // 1. Direct NVIDIA NIM execution with the configured key
  try {
    const directReply = await callDirectNvidiaSocratic(
      educatorQuestion,
      studentReply,
      assessmentContext
    );
    if (directReply) {
      return {
        reply: directReply,
        provider: 'nim',
      };
    }
  } catch (err) {
    console.warn('Direct NVIDIA attempt skipped:', err);
  }

  // 2. Fallback to backend Socratic endpoint
  try {
    const endpoints = [
      `${API_BASE}/misconception/socratic-reply`,
      `${API_BASE}/api/v1/misconception/socratic-reply`,
      `http://127.0.0.1:8000/misconception/socratic-reply`,
      `http://127.0.0.1:8001/misconception/socratic-reply`,
    ];

    for (const ep of endpoints) {
      try {
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 6000);
        const res = await fetch(ep, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            educator_question: educatorQuestion,
            student_reply: studentReply,
            assessment_context: assessmentContext ?? null,
          }),
          signal: controller.signal,
        });
        clearTimeout(tid);
        if (res.ok) {
          const data = await res.json();
          if (data && data.reply) return data;
        }
      } catch {
        // Try next endpoint candidate
      }
    }
  } catch {
    // Continue to static fallback
  }

  // 3. High quality client-side static fallback pool
  const FALLBACK = [
    'That is a meaningful observation. Connect it to your circuit: does the gate you placed actually encode what you just described?',
    'You are reasoning in the right direction. Verify that instinct by running your updated circuit and examining how the probability distribution shifts.',
    'Solid thinking. Consider whether gate order matters here — quantum operations generally do not commute, so position on the wire is significant.',
    'Good. Does your circuit preserve the mathematical relationship you would expect from theory? Trace through it gate by gate.',
    'Interesting point. What would the statevector look like mid-circuit, before measurement, if your reasoning is correct?',
  ];
  return {
    reply: FALLBACK[Math.floor(Math.random() * FALLBACK.length)],
    provider: 'static',
  };
}
