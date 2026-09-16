/**
 * 组装发给 ai-proxy 的 payload:
 * - 精简树:只带 id/name/type/depth/parentId/existingPrefix,避免把整棵原始树塞过去。
 * - 图片:对目标根节点用 figma.exportAsync 导出 PNG,超尺寸时按比例缩放(≤1500x2000)。
 *
 * 尺寸上限 1500x2000 参考 PETA 网关的 image_url 常见吞吐,超过会显著变慢/被截断。
 */
import type { Scope } from '../types';

const MAX_W = 1500;
const MAX_H = 2000;

export interface BuildOptions {
  scope: Scope;
  capability?: 'all' | 'bg_vs_bgc' | 'visual_group';
  model?: string;
}

interface TreeNodeLite {
  id: string;
  name: string;
  type: string;
  depth: number;
  parentId: string | null;
  existingPrefix: string | null;
}

export interface AnalyzePayload {
  scope: Scope;
  tree: TreeNodeLite[];
  imageBase64?: string;
  capability: 'all' | 'bg_vs_bgc' | 'visual_group';
  model?: string;
}

const PREFIX_TOKENS = [
  'fixed-',
  'end-',
  'list-',
  'bl-',
  'scrollx-',
  'scrolly-',
  'sub-',
  'img-',
  'bg-',
  'bgc-',
  'btn-',
  'input-',
  'x-',
];

function extractExistingPrefix(name: string): string | null {
  let matched = '';
  let rest = name;
  outer: while (rest.length > 0) {
    for (const p of PREFIX_TOKENS) {
      if (rest.startsWith(p)) {
        matched += p;
        rest = rest.slice(p.length);
        continue outer;
      }
    }
    break;
  }
  return matched || null;
}

async function buildLiteTree(rootIds: string[]): Promise<TreeNodeLite[]> {
  const out: TreeNodeLite[] = [];
  const HARD_MAX = 800; // 保护:太大的树先截断,避免 prompt 过长
  const seen = new Set<string>();

  async function walk(nodeId: string, depth: number, parentId: string | null): Promise<void> {
    if (out.length >= HARD_MAX) return;
    if (seen.has(nodeId)) return;
    seen.add(nodeId);
    const node = (await figma.getNodeByIdAsync(nodeId)) as SceneNode | null;
    if (!node) return;
    if (node.visible === false) return;
    out.push({
      id: node.id,
      name: node.name,
      type: node.type,
      depth,
      parentId,
      existingPrefix: extractExistingPrefix(node.name),
    });
    if ('children' in node && node.type !== 'INSTANCE') {
      for (const c of node.children) {
        if (out.length >= HARD_MAX) break;
        await walk(c.id, depth + 1, node.id);
      }
    }
  }

  for (const rid of rootIds) await walk(rid, 0, null);
  return out;
}

/** 把 Uint8Array 转成 base64(浏览器/沙箱通用)。 */
function bytesToBase64(bytes: Uint8Array): string {
  // 分块,避免 String.fromCharCode 参数上限
  const CHUNK = 0x8000;
  let bin = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
  }
  return btoa(bin);
}

async function exportScopePng(rootIds: string[]): Promise<string | undefined> {
  // 找一个合适的导出节点:如果只有一个 root 用它,否则找最外层的公共祖先(简单起见,直接导 currentPage 的第一个 frame)。
  let targetId = rootIds[0];
  if (rootIds.length > 1) {
    // 多 root 时导出 currentPage:Figma API 不直接支持导出 PAGE,退化为导第一个 root
    targetId = rootIds[0];
  }
  if (!targetId) return undefined;
  const node = (await figma.getNodeByIdAsync(targetId)) as SceneNode | null;
  if (!node || !('exportAsync' in node)) return undefined;

  // 拿 bbox 决定 scale(尽量不超 MAX_W / MAX_H)
  let scale = 2;
  if ('absoluteBoundingBox' in node && node.absoluteBoundingBox) {
    const { width, height } = node.absoluteBoundingBox;
    if (width > 0 && height > 0) {
      const ws = MAX_W / width;
      const hs = MAX_H / height;
      scale = Math.max(0.5, Math.min(2, Math.min(ws, hs)));
    }
  }
  try {
    const bytes = await node.exportAsync({
      format: 'PNG',
      constraint: { type: 'SCALE', value: scale },
    });
    return bytesToBase64(bytes);
  } catch (err) {
    // 导出失败(如节点大小为 0),跳过图,只发树
    return undefined;
  }
}

export async function buildAnalyzePayload(opts: BuildOptions): Promise<AnalyzePayload> {
  let rootIds: string[] = [];
  if (opts.scope === 'selection') {
    rootIds = figma.currentPage.selection.map((s) => s.id);
    if (rootIds.length === 0) rootIds = figma.currentPage.children.map((c) => c.id);
  } else {
    rootIds = figma.currentPage.children.map((c) => c.id);
  }

  const tree = await buildLiteTree(rootIds);
  const imageBase64 = await exportScopePng(rootIds);

  return {
    scope: opts.scope,
    tree,
    imageBase64,
    capability: opts.capability ?? 'all',
    model: opts.model,
  };
}
