/**
 * Figma 插件端调 AI proxy 的客户端。
 *
 * 设计:
 * - 只 fetch localhost:8787,60s 超时(gpt-6-astra 多模态跑得慢)。
 * - 任何异常(超时、404、5xx、CORS)→ 返回 degraded=true,不抛。
 * - proxy 未启动时提示很直白,让用户立刻知道要跑 ai-proxy。
 *
 * ⚠ Figma 沙箱是 QuickJS,**没有 `AbortController`**,所以用 `Promise.race` 做超时,
 *   而不是 fetch signal。同理沙箱没有 setTimeout/setInterval? 实测有,通过 __html__
 *   环境注入的 window/globalThis 上都有 setTimeout,可以直接用。
 */
import type { AiSuggestResult, Suggestion } from '../types';
import { buildAnalyzePayload, type BuildOptions } from './prompt';

const PROXY_BASE = 'http://localhost:8787';
const TIMEOUT_MS = 60000;

interface ProxySuggestion {
  nodeIds: string[];
  action?: string;
  suggestedPrefix?: string;
  reason?: string;
  confidence?: number;
}

interface ProxyResponse {
  suggestions: ProxySuggestion[];
  model?: string;
  degraded?: boolean;
  message?: string;
}

let seq = 0;
function makeId(): string {
  seq += 1;
  return `ai-${seq}`;
}

class TimeoutError extends Error {
  constructor(ms: number) {
    super(`request timeout after ${ms}ms`);
    this.name = 'TimeoutError';
  }
}

/** 用 Promise.race 做超时,不依赖 AbortController(QuickJS 沙箱没这个)。 */
async function fetchWithTimeout<T>(url: string, init: RequestInit, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(timeoutMs)), timeoutMs);
  });
  try {
    const res = await Promise.race([fetch(url, init), timeoutPromise]);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    return (await res.json()) as T;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function checkProxyHealth(): Promise<{ ok: boolean; hasCredentials: boolean; message?: string }> {
  try {
    const j = await fetchWithTimeout<{ ok: boolean; hasCredentials: boolean }>(
      `${PROXY_BASE}/health`,
      { method: 'GET' },
      3000,
    );
    return { ok: !!j.ok, hasCredentials: !!j.hasCredentials };
  } catch (err) {
    return {
      ok: false,
      hasCredentials: false,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function requestAiSuggestions(opts: BuildOptions): Promise<AiSuggestResult> {
  const payload = await buildAnalyzePayload(opts);
  try {
    const j = await fetchWithTimeout<ProxyResponse>(
      `${PROXY_BASE}/analyze`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      TIMEOUT_MS,
    );
    if (j.degraded) {
      return {
        suggestions: [],
        degraded: true,
        message: j.message || 'AI proxy 返回 degraded,通常是未配置 PETA 凭证或调用失败',
      };
    }
    const suggestions: Suggestion[] = (j.suggestions || [])
      .filter((s): s is ProxySuggestion => !!s && Array.isArray(s.nodeIds) && s.nodeIds.length > 0)
      .map((s) => ({
        id: makeId(),
        source: 'ai' as const,
        nodeIds: s.nodeIds,
        action: (s.action === 'merge' || s.action === 'delete' ? s.action : 'tag') as
          | 'tag'
          | 'merge'
          | 'delete',
        suggestedPrefix: s.suggestedPrefix,
        reason: s.reason || '(无理由)',
        confidence: typeof s.confidence === 'number' ? s.confidence : 0.6,
      }));
    return { suggestions, degraded: false };
  } catch (err) {
    const msg = formatError(err);
    const friendly =
      err instanceof TimeoutError
        ? `AI 请求超时(>${TIMEOUT_MS / 1000}s)。gpt-6-astra 多模态偶尔慢,先重试;仍慢就检查 ai-proxy-node 那个终端有没有报错。`
        : msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('Load failed')
          ? `无法连上 ai-proxy(${PROXY_BASE})。请先在终端跑 \`cd ai-proxy-node && npm start\`,并确认 manifest.json 的 networkAccess.allowedDomains 已放行 localhost。`
          : `AI 调用失败:${msg}`;
    return { suggestions: [], degraded: true, message: friendly };
  }
}

/** Figma 沙箱抛的错误常是 {code,message} 或非 Error 对象,兜底格式化。 */
function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object') {
    const o = err as Record<string, unknown>;
    if (typeof o.message === 'string') return o.message;
    if (typeof o.code === 'string') return o.code;
    try {
      return JSON.stringify(err);
    } catch {
      return '(未知错误,无法序列化)';
    }
  }
  return String(err);
}
