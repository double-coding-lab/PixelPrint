import { Dimensions } from 'react-native'

/**
 * 响应式尺寸包装(pure RN / Expo 版)— 把设计稿数值按屏幕宽度线性缩放。
 *
 * 由 pp-d2c-rn SKILL 生成的代码使用。SKILL 只对 layout / spacing / borderRadius / fontSize 类属性调用 rpx(),
 * 对 opacity / flex / color / fontWeight 这类"非像素属性"保持原始数值。
 *
 * 命名说明: rpx 沿用小程序 / uni-app 的 responsive px 惯例。默认基准 375(iPhone Mini 类竖屏宽度),
 * 与 config.unit.figmaBase 保持一致。改基准请同时改 config, 不要只改本文件。
 *
 * 无障碍备注: 本 helper **不**跟随系统字号(Dimensions 不感知 fontScale),
 * 视觉一致优先。需要无障碍的团队可自行改本文件, SKILL 不会覆盖已存在的文件。
 *
 * 屏宽取值: Dimensions.get('window').width 是当前可用布局宽(排除状态栏);
 * 静态导入时机是模块 load 时,横屏切换 / 分屏调整时 rpx() 返回值不会跟着变。
 * 如需响应式切换,请改成 useWindowDimensions() hook 版本(需要在组件内调用)。
 */

const DESIGN_BASE = 375

const SCREEN_W = Dimensions.get('window').width || DESIGN_BASE
const SCALE = SCREEN_W / DESIGN_BASE

export function rpx(size: number): number {
  return size * SCALE
}

export const screenWidth = SCREEN_W
export const scale = SCALE
