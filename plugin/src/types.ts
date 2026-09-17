/**
 * 共享数据结构:插件沙箱 <-> UI 层通过 postMessage 传递。
 *
 * v0.3:去除自动推断,只保留全量树 + 手工打标。
 */
import type { Warning } from './guards/mutex';

export type Scope = 'selection' | 'page';

/**
 * 树节点(全量,包含所有类型)。
 */
export interface TreeNode {
  id: string;
  name: string;
  type: NodeType;
  depth: number;
  parentId: string | null;
  childrenIds: string[];
  /** 是否是可打标类型(FRAME/GROUP/COMPONENT/INSTANCE/RECTANGLE)。 */
  isCandidate: boolean;
  hidden: boolean;
  locked: boolean;
  /** 当前前缀识别结果(从 name 剥出的已有 D2C 前缀,如 "sub-" / "fixed-sub-")。 */
  existingPrefix: string | null;
}

export interface ScanSummary {
  scope: Scope;
  totalNodes: number;
  hardStop?: string;
}

export interface ScanResult {
  tree: TreeNode[];
  rootIds: string[];
  summary: ScanSummary;
}

export interface TagResultItem {
  id: string;
  ok: boolean;
  oldName: string;
  newName?: string;
  message?: string;
}

export interface TagResult {
  success: number;
  skipped: TagResultItem[];
  failed: TagResultItem[];
  updated: TagResultItem[]; // 成功列表(便于 UI 局部更新)
}

export interface MergeResult {
  success: boolean;
  newNodeId?: string;
  newNodeName?: string;
  message?: string;
}

/**
 * 建议来源:
 * - 'code':analyzer 纯代码规则(图片父层、透明遮挡)
 * - 'ai':AI proxy(bg/bgc 消歧、视觉分组)
 */
export type SuggestionSource = 'code' | 'ai';

/**
 * 单条建议:「对某节点建议打 X 前缀」或「建议合并这几个节点」。
 * analyzer 与 AI 客户端共用同一结构。
 */
export interface Suggestion {
  /** UI 用的稳定 id,一次分析里唯一。 */
  id: string;
  source: SuggestionSource;
  /** 建议影响的节点(单节点 = 打标建议;多节点 = 合并建议)。 */
  nodeIds: string[];
  /**
   * 建议动作:
   * - 'tag':给 nodeIds 全部打上 suggestedPrefix(单前缀,含尾 -)
   * - 'merge':把 nodeIds 合并为一个 group,给 group 加 suggestedPrefix
   * - 'delete':建议删除(极少用,当前保留位)
   */
  action: 'tag' | 'merge' | 'delete';
  /** 目标前缀(action='tag' / 'merge' 时必填)。 */
  suggestedPrefix?: string;
  /** 人类可读的理由。 */
  reason: string;
  /** 置信度 0..1。 */
  confidence: number;
}

export interface AnalyzeResult {
  suggestions: Suggestion[];
  /** 分析耗时(ms)。 */
  elapsedMs: number;
  /** 遍历的节点数。 */
  scannedNodes: number;
  /** 一键合并时:被删除的隐藏节点数。普通 analyze 时为 undefined。 */
  deletedHidden?: {
    deleted: number;
    skippedLocked: number;
    skippedInstance: number;
  };
}

export interface AiSuggestResult {
  suggestions: Suggestion[];
  /** 是否发生了降级(AI 不可用/超时/proxy 未启动)。 */
  degraded: boolean;
  message?: string;
}

/**
 * UI -> code 消息。
 */
export type UiMessage =
  | { type: 'scan'; scope: Scope }
  | {
      type: 'tagNodes';
      nodeIds: string[];
      prefix: string; // "sub-" / "img-" / "fixed-" 等,含尾 "-"
      isModifier: boolean; // 修饰前缀(fixed-/end-/list-/bl-),叠加到已有基础前缀之前
      onConflict: 'replace' | 'stack' | 'skip'; // 已有 D2C 前缀时的策略
    }
  | { type: 'focusNode'; nodeId: string }
  | { type: 'mergeSelected'; prefix: 'img-' | 'sub-' | 'bg-'; nameHint?: string }
  | {
      type: 'mergeNodes';
      nodeIds: string[];
      prefix: 'img-' | 'sub-' | 'bg-';
      nameHint?: string;
    }
  | { type: 'renameNode'; nodeId: string; newName: string }
  | { type: 'analyze' } // 纯代码分析(不需要参数,基于当前 currentPage 或 selection)
  | { type: 'oneClickMerge' } // 一键合并:纯生成合并建议(不删除任何东西)- 保留兼容
  | {
      type: 'deleteHidden';
      /** 限制清理范围到这些子树内;为空或缺省 = 整页 */
      rootIds?: string[];
    } // 单独触发:清理隐藏节点 + Slice
  | {
      type: 'iterativeMerge';
      gap: number;
      maxRounds: number;
      /** 单个候选最大尺寸(px),超过视为大背景不参与。默认 300,想合并大图请调大。 */
      maxItemSize?: number;
      /** 阶段 O 的 bbox 重叠占比阈值(0..1)。默认 0.3。 */
      overlapThreshold?: number;
      /** 合并前是否先清理隐藏节点 + Slice。默认 true。 */
      deleteHiddenFirst?: boolean;
      /**
       * 限制合并范围到这些子树内;为空或缺省 = 整页所有顶层 frame。
       * 传入时,walk 只从这些 rootIds 起点 postorder 遍历,不再全页扫描。
       */
      rootIds?: string[];
    } // 一键迭代合并:(可选清理隐藏 + Slice)+ 阶段 O(相交)+ A(图形)+ B(混文字)迭代到收敛
  | {
      type: 'diagnoseMerge';
      /** 若长度 == 2 → 用它们诊断;否则用当前 Figma selection 前 2 个 */
      nodeIds?: string[];
      gap: number;
      maxItemSize?: number;
    }
  | {
      type: 'ungroupSelected';
      /** 若非空用它们;否则读当前 Figma selection */
      nodeIds?: string[];
      /** true = 深拆(递归到无 GROUP);默认 false = 浅拆一层 */
      deep?: boolean;
    }
  | { type: 'aiSuggest'; scope: Scope }; // AI 分析(会调 localhost:8787)

/**
 * code -> UI 消息。
 */
export type CodeMessage =
  | { type: 'scanProgress'; scanned: number }
  | { type: 'scanResult'; result: ScanResult }
  | { type: 'tagResult'; result: TagResult }
  | { type: 'mergeResult'; result: MergeResult }
  | { type: 'renameResult'; nodeId: string; newName: string; ok: boolean; message?: string }
  | { type: 'canvasSelectionChanged'; nodeIds: string[] }
  | { type: 'analyzeResult'; result: AnalyzeResult }
  | {
      type: 'deleteHiddenResult';
      deleted: number;
      deletedHidden: number;
      deletedSlice: number;
      skippedLocked: number;
      skippedInstance: number;
    }
  | {
      type: 'iterativeMergeProgress';
      phase: 'O' | 'A' | 'B';
      round: number;
      merged: number;
    }
  | {
      type: 'iterativeMergeResult';
      oGroups: number;
      aGroups: number;
      bGroups: number;
      oRounds: number;
      aRounds: number;
      bRounds: number;
      stoppedByLimit: 'O' | 'A' | 'B' | null;
      elapsedMs: number;
    }
  | {
      type: 'diagnoseMergeResult';
      aName: string;
      bName: string;
      reasons: string[];
      wouldMerge: boolean;
      info: Record<string, unknown>;
    }
  | {
      type: 'ungroupResult';
      ungrouped: number;
      releasedNodes: number;
      skippedNonGroup: number;
      skippedLocked: number;
      errors: string[];
      deep: boolean;
    }
  | { type: 'aiSuggestProgress'; phase: string; message?: string }
  | { type: 'aiSuggestResult'; result: AiSuggestResult }
  | { type: 'error'; message: string; code: string };

// 兼容旧代码保留(实际不再产出)
export type { Warning };
