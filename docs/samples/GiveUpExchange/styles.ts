import { rpx } from '@Utils/rpx'

/**
 * GiveUpExchange 页面样式
 *
 * 单位换算:Figma 稿 375 基准,项目 rpx.ts 内部 750 基准 → figma 数值 ×2 后传入 rpx()。
 * 与 AirportBus 现有页面基准一致。
 *
 * 结构:
 * - root: VERTICAL flex,顶层白底 + bg-pic1 绝对铺满
 * - susWrap / titleWrap: 顺流子,水平居中
 * - whyCard: layoutPositioning=ABSOLUTE,相对根 top=254 left=26 (fig 375 base)
 * - gift / pinxuan: 顺流子,水平居中,gift 内部含 scrollx 券区
 *
 * 用 plain object 而非 StyleSheet.create():xtaro H5 端 (nfes-next SSR) webpack 不解析
 * react-native 的 Flow 语法,直接 import 'react-native' 会 crash。plain object 与 StyleSheet
 * 语义等价 (XView / XImage / XText 内部会归一化),仅少了 freeze 优化,H5/CRN 双端可跑。
 */
export const styles = {
  root: {
    flex: 1,
    width: rpx(750),
    minHeight: rpx(1624),
    backgroundColor: '#ffffff',
    position: 'relative',
    alignItems: 'center',
  },
  bgPic1: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: rpx(750),
    height: rpx(1624),
    zIndex: 0,
  },

  // img-sus:火车+￥ 图标 (Frame 192:754, paddingTop=52, HUG)
  susWrap: {
    paddingTop: rpx(104),
    alignItems: 'center',
    zIndex: 1,
  },
  sus: {
    width: rpx(150),
    height: rpx(171),
  },

  // Frame 270:标题+副标题
  titleWrap: {
    alignItems: 'center',
    paddingBottom: rpx(32),
    gap: rpx(8),
    zIndex: 1,
  },
  titleText: {
    fontSize: rpx(58),
    lineHeight: rpx(80),
    fontWeight: '900',
    color: '#734100',
    fontFamily: 'AlibabaPuHuiTi-Heavy',
    textAlign: 'left',
  },
  subtitle: {
    fontSize: rpx(22),
    lineHeight: rpx(38),
    fontWeight: '500',
    color: '#734100',
    textAlign: 'center',
  },

  // Frame 253:"没开到满意的车票?" 疑问卡 (layoutPositioning=ABSOLUTE)
  whyCard: {
    position: 'absolute',
    top: rpx(508),
    left: rpx(52),
    width: rpx(646),
    height: rpx(240),
    zIndex: 2,
    paddingLeft: rpx(40),
    paddingRight: rpx(40),
    paddingTop: rpx(40),
    paddingBottom: rpx(40),
  },
  whyCardBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: rpx(646),
    height: rpx(240),
    zIndex: 0,
  },
  whyTitle: {
    fontSize: rpx(42),
    lineHeight: rpx(58),
    fontWeight: '900',
    color: '#734100',
    fontFamily: 'AlibabaPuHuiTi-Heavy',
    zIndex: 1,
  },
  whyRow: {
    marginTop: rpx(20),
    flexDirection: 'row',
    alignItems: 'center',
    width: rpx(566),
    height: rpx(80),
    zIndex: 1,
  },
  whyDesc: {
    width: rpx(262),
    fontSize: rpx(24),
    lineHeight: rpx(39.76),
    color: '#734100',
    fontFamily: 'AlibabaPuHuiTi-Bold',
    fontWeight: '400',
  },
  btnNow: {
    width: rpx(202),
    height: rpx(80),
    position: 'relative',
    borderRadius: rpx(24),
    overflow: 'hidden',
  },
  btnNowBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: rpx(202),
    height: rpx(80),
  },
  btnNowText: {
    fontSize: rpx(33.34),
    lineHeight: rpx(45.74),
    fontWeight: '900',
    color: '#ffffff',
    fontFamily: 'AlibabaPuHuiTi-Heavy',
    textAlign: 'center',
    zIndex: 1,
  },

  // gift 白背景礼品券区
  gift: {
    paddingTop: rpx(348),
    alignItems: 'center',
    gap: rpx(28),
    zIndex: 1,
  },
  stitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rpx(20),
  },
  stitleLine: {
    width: rpx(108),
    height: rpx(4),
    backgroundColor: '#734100',
  },
  stitleText: {
    fontSize: rpx(34),
    lineHeight: rpx(46),
    fontWeight: '900',
    color: '#734100',
    fontFamily: 'AlibabaPuHuiTi-Heavy',
  },
  ticketScroll: {
    width: rpx(685),
  },
  ticketScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rpx(16),
  },
  ticket: {
    width: rpx(334.46),
    height: rpx(119.34),
    position: 'relative',
    paddingLeft: rpx(18),
    paddingRight: rpx(18),
    paddingTop: rpx(28),
    paddingBottom: rpx(28),
  },
  ticketBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: rpx(334.46),
    height: rpx(119.34),
    zIndex: 0,
  },
  ticketContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rpx(36),
    zIndex: 1,
  },
  ticketPriceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
  },
  ticketPriceNum: {
    fontSize: rpx(46.2),
    lineHeight: rpx(63.4),
    fontWeight: '700',
    color: '#ad0000',
    fontFamily: 'AlibabaPuHuiTi-Bold',
  },
  ticketPriceUnit: {
    fontSize: rpx(27.3),
    lineHeight: rpx(37.46),
    fontWeight: '700',
    color: '#ad0000',
    fontFamily: 'AlibabaPuHuiTi-Bold',
  },
  ticketInfoCol: {
    flexDirection: 'column',
    justifyContent: 'center',
    width: rpx(136),
  },
  ticketTitle: {
    fontSize: rpx(27.3),
    lineHeight: rpx(37.46),
    fontWeight: '700',
    color: '#213579',
    fontFamily: 'AlibabaPuHuiTi-Bold',
  },
  ticketSub: {
    fontSize: rpx(18),
    lineHeight: rpx(24.7),
    fontWeight: '400',
    color: '#213579',
  },

  dotsRow: {
    width: rpx(34),
    height: rpx(10),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dotActive: {
    width: rpx(10),
    height: rpx(10),
    borderRadius: rpx(5),
    backgroundColor: '#7c4506',
  },
  dotInactive: {
    width: rpx(10),
    height: rpx(10),
    borderRadius: rpx(5),
    backgroundColor: '#7c4506',
    opacity: 0.5,
  },

  pinxuan: {
    width: rpx(564),
    height: rpx(214),
    marginTop: rpx(28),
    zIndex: 1,
  },
} as const
