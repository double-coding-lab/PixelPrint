import { rpx } from '@Utils/rpx'
import { StyleSheet } from 'react-native'

export const styles = StyleSheet.create({
  root: {
    width: rpx(702),
    paddingTop: rpx(129),
  },
  bgTitle: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: rpx(702),
    height: rpx(200),
  },
  tabs: {
    width: rpx(702),
    height: rpx(110),
  },
  card: {
    width: rpx(702),
    backgroundColor: '#FFFFFF',
    paddingTop: rpx(24),
    paddingBottom: rpx(24),
    alignItems: 'center',
    gap: rpx(36),
  },

  coupon: {
    width: rpx(638),
    height: rpx(76),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: rpx(16),
    paddingRight: rpx(32),
    borderRadius: rpx(16),
    backgroundColor: '#FFF4EF',
  },
  couponMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rpx(8),
  },
  couponIcon: {
    width: rpx(44),
    height: rpx(44),
  },
  couponTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rpx(8),
  },
  couponPrefix: {
    fontSize: rpx(26),
    lineHeight: rpx(30),
    color: '#111111',
  },
  couponMoney: {
    fontSize: rpx(26),
    lineHeight: rpx(30),
    color: '#FF5500',
  },
  couponSuffix: {
    fontSize: rpx(26),
    lineHeight: rpx(30),
    color: '#111111',
  },
  couponArrow: {
    width: rpx(24),
    height: rpx(24),
  },

  tripRow: {
    width: rpx(638),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  points: {
    width: rpx(12),
    height: rpx(122),
  },
  tripCol: {
    width: rpx(610),
    flexDirection: 'column',
    gap: rpx(32),
  },
  tripFrom: {
    width: '100%',
    fontSize: rpx(32),
    lineHeight: rpx(44.8),
    fontWeight: '500',
    color: '#111111',
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: '#F0F0F0',
  },
  tripToRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: rpx(4),
  },
  tripToPlaceholderWrap: {
    width: rpx(223.5),
    height: rpx(45),
    overflow: 'hidden',
  },
  tripToPlaceholder: {
    fontSize: rpx(32),
    lineHeight: rpx(44.8),
    color: '#C5C5C5',
  },
  tripArrow: {
    width: rpx(24),
    height: rpx(24),
  },

  btnQuery: {
    width: rpx(702),
    height: rpx(88),
    borderRadius: rpx(16),
    backgroundColor: '#0070F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnQueryText: {
    fontSize: rpx(34),
    lineHeight: rpx(42),
    letterSpacing: rpx(-0.82),
    fontWeight: '500',
    color: '#FFFFFF',
    textAlign: 'center',
  },
})
