import { xGetSystemInfoSync } from '@ctrip/xtaro'

/**
 * 响应式尺寸包装(xtaro 版)— 把设计稿数值按屏幕宽度线性缩放。
 *
 * 与 pure RN 版的区别: 用 @ctrip/xtaro 导出的 xGetSystemInfoSync 而不是 Dimensions.get('window'),
 * 因为 xtaro 的 H5 端 webpack 不解析 react-native 的 Flow 语法, 直接 import 'react-native' 会 crash。
 * xtaro 自己封装了 xGetSystemInfoSync (对 @tarojs/taro getSystemInfoSync 做了 xtaro 侧一致化),
 * 优先用它而不是绕道 @tarojs/taro,项目侧只依赖 @ctrip/xtaro 一个包。
 *
 * 由 pp-d2c-rn SKILL 生成的代码使用。SKILL 只对 layout / spacing / borderRadius / fontSize 类属性调用 rpx(),
 * 对 opacity / flex / color / fontWeight 这类"非像素属性"保持原始数值。
 *
 * 命名说明: rpx 沿用小程序 / uni-app 的 responsive px 惯例。默认基准 375(iPhone Mini 类竖屏宽度),
 * 与 config.unit.figmaBase 保持一致。改基准请同时改 config, 不要只改本文件。
 *
 * 无障碍备注: 本 helper **不**跟随系统字号(小程序端 taro 也无 fontScale 概念),
 * 视觉一致优先。需要无障碍的团队可自行改本文件, SKILL 不会覆盖已存在的文件。
 *
 * windowWidth vs screenWidth: 优先 windowWidth(可用布局宽,排除状态栏/胶囊按钮等),
 * 拿不到时降级 screenWidth, 再兜底 375(SSR / 编译期读取时无 window 全局)。
 */

const DESIGN_BASE = 375

function resolveWidth(): number {
  try {
    const info = xGetSystemInfoSync()
    return info.windowWidth || info.screenWidth || DESIGN_BASE
  } catch {
    return DESIGN_BASE
  }
}

const SCREEN_W = resolveWidth()
const SCALE = SCREEN_W / DESIGN_BASE

export function rpx(size: number): number {
  return size * SCALE
}

export const screenWidth = SCREEN_W
export const scale = SCALE
