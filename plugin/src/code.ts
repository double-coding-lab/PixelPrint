/**
 * Figma 插件沙箱主入口(v0.3)。
 *
 * 消息分派:
 * - scan: 遍历图层树,返回全量 TreeNode
 * - tagNodes: 批量给节点加/替换前缀
 * - renameNode: 单节点直接改名
 * - mergeSelected: 合并 Figma 画布选中节点为一个新 group
 * - focusNode: 在 Figma 里定位并选中该节点
 * - analyze: 纯代码分析(图片父层 + 透明遮挡),即时返回
 * - aiSuggest: AI 分析(调 localhost:8787 ai-proxy),异步,可能 degraded
 *
 * 主动上报:
 * - canvasSelectionChanged: Figma 画布选中变化时同步给 UI
 */
import {
  analyze,
  deleteHiddenNodes,
  diagnoseMerge,
  iterativeMerge,
  oneClickMerge,
  ungroupNodes,
} from './analyzer';
import { requestAiSuggestions } from './ai/client';
import { mergeNodesByIds, mergeSelectedNodes } from './merger';
import { scan } from './scanner';
import { renameNode, tagNodes } from './tagger';
import type { CodeMessage, UiMessage } from './types';

figma.showUI(__html__, { width: 960, height: 680, themeColors: true });

function post(msg: CodeMessage): void {
  figma.ui.postMessage(msg);
}

function reportError(code: string, message: string): void {
  post({ type: 'error', code, message });
}

// 画布 selection 联动
figma.on('selectionchange', () => {
  const ids = figma.currentPage.selection.map((n) => n.id);
  post({ type: 'canvasSelectionChanged', nodeIds: ids });
});

figma.ui.onmessage = async (msg: UiMessage) => {
  try {
    switch (msg.type) {
      case 'scan': {
        const result = await scan({
          scope: msg.scope,
          onProgress: (scanned) => post({ type: 'scanProgress', scanned }),
        });
        post({ type: 'scanResult', result });
        break;
      }
      case 'tagNodes': {
        const result = await tagNodes({
          nodeIds: msg.nodeIds,
          prefix: msg.prefix,
          isModifier: msg.isModifier,
          onConflict: msg.onConflict,
        });
        post({ type: 'tagResult', result });
        break;
      }
      case 'renameNode': {
        const r = await renameNode(msg.nodeId, msg.newName);
        post({
          type: 'renameResult',
          nodeId: msg.nodeId,
          newName: msg.newName,
          ok: r.ok,
          message: r.message,
        });
        break;
      }
      case 'mergeSelected': {
        const result = await mergeSelectedNodes(msg.prefix, msg.nameHint);
        post({ type: 'mergeResult', result });
        break;
      }
      case 'mergeNodes': {
        const result = await mergeNodesByIds(msg.nodeIds, msg.prefix, msg.nameHint);
        post({ type: 'mergeResult', result });
        break;
      }
      case 'focusNode': {
        const node = (await figma.getNodeByIdAsync(msg.nodeId)) as SceneNode | null;
        if (node && 'x' in node) {
          figma.currentPage.selection = [node];
          figma.viewport.scrollAndZoomIntoView([node]);
        } else {
          reportError('NODE_NOT_FOUND', `节点 ${msg.nodeId} 不存在或不可聚焦`);
        }
        break;
      }
      case 'analyze': {
        const result = await analyze();
        post({ type: 'analyzeResult', result });
        break;
      }
      case 'oneClickMerge': {
        const result = await oneClickMerge();
        post({ type: 'analyzeResult', result });
        break;
      }
      case 'deleteHidden': {
        const r = await deleteHiddenNodes();
        post({
          type: 'deleteHiddenResult',
          deleted: r.deleted,
          deletedHidden: r.deletedHidden,
          deletedSlice: r.deletedSlice,
          skippedLocked: r.skippedLocked,
          skippedInstance: r.skippedInstance,
        });
        break;
      }
      case 'iterativeMerge': {
        // 可选:先清理隐藏节点 + slice
        if (msg.deleteHiddenFirst !== false) {
          const del = await deleteHiddenNodes();
          post({
            type: 'deleteHiddenResult',
            deleted: del.deleted,
            deletedHidden: del.deletedHidden,
            deletedSlice: del.deletedSlice,
            skippedLocked: del.skippedLocked,
            skippedInstance: del.skippedInstance,
          });
        }
        const r = await iterativeMerge({
          gap: msg.gap,
          maxRounds: msg.maxRounds,
          maxItemSize: msg.maxItemSize,
          overlapThreshold: msg.overlapThreshold,
          onProgress: (phase, round, merged) => {
            post({ type: 'iterativeMergeProgress', phase, round, merged });
          },
        });
        post({
          type: 'iterativeMergeResult',
          oGroups: r.oGroups,
          aGroups: r.aGroups,
          bGroups: r.bGroups,
          oRounds: r.oRounds,
          aRounds: r.aRounds,
          bRounds: r.bRounds,
          stoppedByLimit: r.stoppedByLimit,
          elapsedMs: r.elapsedMs,
        });
        break;
      }
      case 'diagnoseMerge': {
        let ids = msg.nodeIds || [];
        if (ids.length < 2) {
          const sel = figma.currentPage.selection;
          if (sel.length < 2) {
            reportError('DIAGNOSE_NEED_TWO', '请先在 Figma 里选中恰好 2 个节点(或传入两个 id)');
            break;
          }
          ids = [sel[0].id, sel[1].id];
        }
        const r = await diagnoseMerge({
          aId: ids[0],
          bId: ids[1],
          gap: msg.gap,
          maxItemSize: msg.maxItemSize,
        });
        post({
          type: 'diagnoseMergeResult',
          aName: r.aName,
          bName: r.bName,
          reasons: r.reasons,
          wouldMerge: r.wouldMerge,
          info: r.info,
        });
        break;
      }
      case 'ungroupSelected': {
        let ids = msg.nodeIds || [];
        if (ids.length === 0) {
          const sel = figma.currentPage.selection;
          if (sel.length === 0) {
            reportError('UNGROUP_NEED_SELECTION', '请先在 Figma 里选中要拆分的 group');
            break;
          }
          ids = sel.map((n) => n.id);
        }
        const r = await ungroupNodes(ids, { deep: msg.deep === true });
        post({
          type: 'ungroupResult',
          ungrouped: r.ungrouped,
          releasedNodes: r.releasedNodes,
          skippedNonGroup: r.skippedNonGroup,
          skippedLocked: r.skippedLocked,
          errors: r.errors,
          deep: msg.deep === true,
        });
        break;
      }
      case 'aiSuggest': {
        post({ type: 'aiSuggestProgress', phase: 'building_payload', message: '导出画面 + 组装树...' });
        const result = await requestAiSuggestions({ scope: msg.scope, capability: 'all' });
        post({ type: 'aiSuggestResult', result });
        break;
      }
      default: {
        const _exhaustive: never = msg;
        void _exhaustive;
      }
    }
  } catch (err) {
    reportError('UNEXPECTED', err instanceof Error ? err.message : String(err));
  }
};
