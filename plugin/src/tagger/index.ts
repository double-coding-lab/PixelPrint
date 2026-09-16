/**
 * 手工打标模块:接收 {nodeIds, prefix, isModifier, onConflict},批量改 Figma 图层名。
 *
 * 规则:
 * - **基础前缀**(non-modifier):
 *   - 该节点无已有 D2C 前缀 → 直接叠加:`sub-订单卡片`
 *   - 该节点已有基础前缀 && onConflict='replace' → 替换基础前缀,修饰前缀保留
 *   - onConflict='stack' → 直接前置(可能违反组合优先级,由用户负责)
 *   - onConflict='skip' → 跳过该节点
 * - **修饰前缀**(fixed-/end-/list-/bl-):
 *   - 未含该修饰前缀 → 前置到已有前缀最外层:`fixed-sub-订单卡片`
 *   - 已含该修饰前缀 → 跳过(视为幂等)
 * - **互斥硬规则**:命中 → 跳过 + message
 * - **锁定节点** → 跳过 + message
 * - **INSTANCE 节点** → 允许改名(不会解绑,仅 name 覆盖)
 */
import { checkMutex } from '../guards/mutex';
import { KNOWN_PREFIXES } from '../rules/prefix-catalog';
import type { TagResult, TagResultItem } from '../types';

export interface TagRequest {
  nodeIds: string[];
  prefix: string;
  isModifier: boolean;
  onConflict: 'replace' | 'stack' | 'skip';
}

/**
 * 从 name 头剥出已有 D2C 前缀,返回 { prefix, body } 或 { prefix: null, body: name }。
 */
function splitPrefix(name: string): { prefixTokens: string[]; body: string } {
  const tokens: string[] = [];
  let rest = name;
  outer: while (rest.length > 0) {
    for (const p of KNOWN_PREFIXES) {
      if (rest.startsWith(p)) {
        tokens.push(p);
        rest = rest.slice(p.length);
        continue outer;
      }
    }
    break;
  }
  return { prefixTokens: tokens, body: rest };
}

const MODIFIER_ORDER = ['fixed-', 'end-', 'list-', 'bl-'];

/** 把 tokens 排序为规范顺序:modifier(fixed>end>list>bl) + base(1 个)。 */
function reorderTokens(tokens: string[]): string[] {
  const modifiers = tokens.filter((t) => MODIFIER_ORDER.includes(t));
  const bases = tokens.filter((t) => !MODIFIER_ORDER.includes(t));
  const sortedModifiers = MODIFIER_ORDER.filter((m) => modifiers.includes(m));
  return [...sortedModifiers, ...bases];
}

function isBasePrefix(p: string): boolean {
  return !MODIFIER_ORDER.includes(p);
}

export async function tagNodes(req: TagRequest): Promise<TagResult> {
  const updated: TagResultItem[] = [];
  const skipped: TagResultItem[] = [];
  const failed: TagResultItem[] = [];

  for (const id of req.nodeIds) {
    try {
      const node = (await figma.getNodeByIdAsync(id)) as SceneNode | null;
      if (!node) {
        failed.push({ id, ok: false, oldName: '', message: '节点不存在' });
        continue;
      }
      if ('locked' in node && (node as SceneNode & { locked: boolean }).locked) {
        skipped.push({ id, ok: false, oldName: node.name, message: '节点已锁定' });
        continue;
      }

      const { prefixTokens, body } = splitPrefix(node.name);
      const nextTokens = [...prefixTokens];

      if (req.isModifier) {
        // 修饰前缀:已有则幂等跳过;基础前缀不存在允许单独加(不推荐但不阻止)
        if (nextTokens.includes(req.prefix)) {
          skipped.push({
            id,
            ok: false,
            oldName: node.name,
            message: `已含 ${req.prefix},幂等跳过`,
          });
          continue;
        }
        nextTokens.push(req.prefix);
      } else {
        // 基础前缀
        const existingBase = nextTokens.find(isBasePrefix);
        if (existingBase) {
          if (existingBase === req.prefix) {
            skipped.push({
              id,
              ok: false,
              oldName: node.name,
              message: `已是 ${req.prefix},幂等跳过`,
            });
            continue;
          }
          if (req.onConflict === 'skip') {
            skipped.push({
              id,
              ok: false,
              oldName: node.name,
              message: `已有基础前缀 ${existingBase},按策略跳过`,
            });
            continue;
          }
          if (req.onConflict === 'replace') {
            // 替换已有基础前缀
            const idx = nextTokens.indexOf(existingBase);
            nextTokens[idx] = req.prefix;
          } else {
            // stack: 直接加多一个基础前缀(可能出组合冲突,由 mutex 校验兜底)
            nextTokens.push(req.prefix);
          }
        } else {
          nextTokens.push(req.prefix);
        }
      }

      // 排序为规范顺序
      const orderedTokens = reorderTokens(nextTokens);
      const combined = orderedTokens.join('');

      // 互斥校验
      const mutexWarnings = checkMutex(combined);
      const blockingError = mutexWarnings.find((w) => w.level === 'error');
      if (blockingError) {
        skipped.push({
          id,
          ok: false,
          oldName: node.name,
          message: `${blockingError.code}: ${blockingError.message}`,
        });
        continue;
      }

      const newName = combined + body;
      if (newName === node.name) {
        skipped.push({ id, ok: false, oldName: node.name, message: '名称未变化' });
        continue;
      }

      node.name = newName;
      updated.push({ id, ok: true, oldName: node.name, newName });
    } catch (err) {
      failed.push({
        id,
        ok: false,
        oldName: '',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    success: updated.length,
    skipped,
    failed,
    updated,
  };
}

/**
 * 单节点直接改名(用户在详情面板手输完整新名字时用)。
 */
export async function renameNode(nodeId: string, newName: string): Promise<{ ok: boolean; message?: string }> {
  try {
    const node = (await figma.getNodeByIdAsync(nodeId)) as SceneNode | null;
    if (!node) return { ok: false, message: '节点不存在' };
    if ('locked' in node && (node as SceneNode & { locked: boolean }).locked) {
      return { ok: false, message: '节点已锁定' };
    }
    node.name = newName;
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}
