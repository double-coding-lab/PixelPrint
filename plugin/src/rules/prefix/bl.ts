/**
 * bl- 文本基线对齐前缀。
 *
 * v1 不自动推断——baseline 对齐依赖字体度量,几何上不可靠判定。
 * 面板只提供手动加 `bl-` 的入口。
 */
import { NO_MATCH, type InferFn } from './types';

export const inferBl: InferFn = () => NO_MATCH;
