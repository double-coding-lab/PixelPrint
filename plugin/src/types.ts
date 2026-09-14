/**
 * 共享数据结构:插件沙箱 <-> UI 层通过 postMessage 传递。
 */
import type { AutolayoutSpec } from './rules/autolayout/infer';
import type { Warning } from './guards/mutex';
import type { ConfidenceLevel } from './rules/prefix-catalog';

export type Scope = 'selection' | 'page';

export interface Candidate {
  id: string;
  nodePath: string;
  currentName: string;
  suggestedPrefix: string | null;
  suggestedName: string;
  suggestedAutolayout: AutolayoutSpec | null;
  confidence: ConfidenceLevel;
  reason: string[];
  warnings: Warning[];
  /** 默认是否勾选:high 默认勾、medium 默认勾、low 默认不勾、blockApply 强制不勾。 */
  defaultChecked: boolean;
  /** 硬规则命中或节点锁定,不可 apply。 */
  blockApply: boolean;
}

export interface ScanSummary {
  scope: Scope;
  totalNodes: number;
  totalCandidates: number;
  hardStop?: string;
}

export interface ScanResult {
  candidates: Candidate[];
  summary: ScanSummary;
}

export interface FailedItem {
  id: string;
  nodePath: string;
  message: string;
}

export interface ApplyResult {
  success: number;
  failed: FailedItem[];
}

export interface HealthReport {
  scanTime: string;
  scope: Scope;
  totalFrames: number;
  prefixDistribution: Record<string, number>;
  autolayoutCoverage: {
    hasAutolayout: number;
    absoluteButConvertible: number;
    absoluteKept: number;
  };
  mutexViolations: number;
  fallbackNames: number;
  oldPrefixDetected: number;
  candidates: Array<{
    id: string;
    finalName: string;
    hasAutolayout: boolean;
    warnings: string[];
  }>;
}

/**
 * UI -> code 消息。
 */
export type UiMessage =
  | { type: 'scan'; scope: Scope }
  | { type: 'apply'; candidateIds: string[] }
  | { type: 'exportReport' }
  | { type: 'focusNode'; nodeId: string }
  | { type: 'cancelScan' };

/**
 * code -> UI 消息。
 */
export type CodeMessage =
  | { type: 'scanProgress'; scanned: number; total: number }
  | { type: 'scanResult'; result: ScanResult }
  | { type: 'applyProgress'; applied: number; total: number }
  | { type: 'applyResult'; result: ApplyResult }
  | { type: 'reportReady'; report: HealthReport }
  | { type: 'error'; message: string; code: string };
