/**
 * Figma 插件沙箱主入口。
 *
 * 职责:
 * - 打开 UI 面板
 * - 接收 UI 层消息,分派到 scanner / applier / report
 * - 缓存最近一次 scan 的 candidates(applier 需要 spec 数据)
 */
import { apply } from './applier';
import { generateReport } from './report/generate';
import { scan } from './scanner';
import type { CodeMessage, UiMessage } from './types';
import type { Candidate } from './types';

// 面板尺寸(见方案 §UI 尺寸)
figma.showUI(__html__, { width: 900, height: 640, themeColors: true });

// 缓存最近一次 scan 的候选(applier 通过 id 反查 spec)
let lastCandidates: Candidate[] = [];
let lastScope: 'selection' | 'page' = 'page';

function post(msg: CodeMessage): void {
  figma.ui.postMessage(msg);
}

function reportError(code: string, message: string): void {
  post({ type: 'error', code, message });
}

figma.ui.onmessage = async (msg: UiMessage) => {
  try {
    switch (msg.type) {
      case 'scan': {
        lastScope = msg.scope;
        const result = await scan({
          scope: msg.scope,
          onProgress: (scanned, total) => {
            post({ type: 'scanProgress', scanned, total });
          },
        });
        lastCandidates = result.candidates;
        post({ type: 'scanResult', result });
        break;
      }
      case 'apply': {
        if (lastCandidates.length === 0) {
          reportError('NO_SCAN', '尚未执行 Scan,或上一次 Scan 已失效,请重新 Scan');
          return;
        }
        const result = await apply({
          candidates: lastCandidates,
          candidateIds: msg.candidateIds,
          onProgress: (applied, total) => {
            post({ type: 'applyProgress', applied, total });
          },
        });
        post({ type: 'applyResult', result });
        break;
      }
      case 'exportReport': {
        const report = await generateReport(lastScope);
        post({ type: 'reportReady', report });
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
      case 'cancelScan': {
        // 当前 scan 是同步 await,无法中途取消;留作后续 AbortController 扩展点
        break;
      }
      default: {
        const _exhaustive: never = msg;
        void _exhaustive;
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    reportError('UNEXPECTED', message);
  }
};
