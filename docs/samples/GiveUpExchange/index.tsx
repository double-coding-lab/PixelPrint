import { XImage, XScrollView, XText, XView } from '@myxx/xtaro'
import { styles } from './styles'

/**
 * 放弃兑换页 (GiveUpExchange)
 *
 * Figma: node 192:749 (fileKey dKc9NQvjTgHe9sZzg4zFOL)
 * 由 ctrip-train-d2c-rn skill 生成。
 *
 * 结构自上而下:
 * 1. bg-pic1 全屏背景 (绝对定位, zIndex 0)
 * 2. img-sus 火车+￥ 头图 (顺流, paddingTop=52 in fig 375 → rpx(104))
 * 3. Frame 270 标题"放弃兑换" + 副标题
 * 4. Frame 253 疑问卡 (Figma 里 layoutPositioning=ABSOLUTE, top=254 left=26 in fig 375)
 * 5. gift 礼品券区:标题装饰线 + 横向 scroll 券卡 + 分页点
 * 6. img-pinxuan 底部品宣
 */
export default function GiveUpExchange() {
	return (
		<XView style={styles.root} data-node-id="192:749">
			<XImage
				style={styles.bgPic1}
				src="https://images3.c-ctrip.com/train/activity/d2c-lands-test/pic1.png"
				data-node-id="192:750"
			/>

			<XView style={styles.susWrap} data-node-id="192:754">
				<XImage
					style={styles.sus}
					src="https://images3.c-ctrip.com/train/activity/d2c-lands-test/sus.png"
					data-node-id="192:755"
				/>
			</XView>

			<XView style={styles.titleWrap} data-node-id="192:756">
				<XText style={styles.titleText} data-node-id="192:757">
					放弃兑换
				</XText>
				<XText style={styles.subtitle} data-node-id="192:758">
					很抱歉未能令您满意，您可在抖音订单页申请全额退款
				</XText>
			</XView>

			<XView style={styles.whyCard} data-node-id="192:759">
				<XImage
					style={styles.whyCardBg}
					src="https://images3.c-ctrip.com/train/activity/d2c-lands-test/whydi.png"
					data-node-id="192:760"
				/>
				<XText style={styles.whyTitle} data-node-id="192:763">
					没开到满意的车票？
				</XText>
				<XView style={styles.whyRow} data-node-id="192:764">
					<XText style={styles.whyDesc} data-node-id="192:765">
						送你限时福利,邀请1人{'\n'}助力即可免费再次开盒
					</XText>
					<XView style={styles.btnNow} data-node-id="192:766">
						<XImage
							style={styles.btnNowBg}
							src="https://images3.c-ctrip.com/train/activity/d2c-lands-test/btn-now.png"
							data-node-id="192:766-bg"
						/>
						<XText style={styles.btnNowText} data-node-id="192:767">
						</XText>
					</XView>
				</XView>
			</XView>

			<XView style={styles.gift} data-node-id="192:768">
				<XView style={styles.stitleRow} data-node-id="192:769">
					<XView style={styles.stitleLine} data-node-id="192:770" />
					<XText style={styles.stitleText} data-node-id="192:771">
						已为您发放更多权益
					</XText>
					<XView style={styles.stitleLine} data-node-id="192:772" />
				</XView>

				<XScrollView
					horizontal
					showsHorizontalScrollIndicator={false}
					style={styles.ticketScroll}
					contentContainerStyle={styles.ticketScrollContent}
					data-node-id="192:773"
				>
					<XView style={styles.ticket} data-node-id="192:774">
						<XImage
							style={styles.ticketBg}
							src="https://images3.c-ctrip.com/train/activity/d2c-lands-test/sticket.png"
							data-node-id="192:775"
						/>
						<XView style={styles.ticketContent} data-node-id="192:782">
							<XView style={styles.ticketPriceRow} data-node-id="192:783">
								<XText style={styles.ticketPriceNum} data-node-id="192:784">
									94
								</XText>
								<XText style={styles.ticketPriceUnit} data-node-id="192:785">
									折
								</XText>
							</XView>
							<XView style={styles.ticketInfoCol} data-node-id="192:786">
								<XText style={styles.ticketTitle} data-node-id="192:787">
									酒店折扣券
								</XText>
								<XText style={styles.ticketSub} data-node-id="192:788">
									盲盒用户专享
								</XText>
							</XView>
						</XView>
					</XView>

					<XView style={styles.ticket} data-node-id="192:789">
						<XImage
							style={styles.ticketBg}
							src="https://images3.c-ctrip.com/train/activity/d2c-lands-test/sticket.png"
							data-node-id="192:790"
						/>
						<XView style={styles.ticketContent} data-node-id="192:797">
							<XView style={styles.ticketPriceRow} data-node-id="192:798">
								<XText style={styles.ticketPriceNum} data-node-id="192:799">
									95
								</XText>
								<XText style={styles.ticketPriceUnit} data-node-id="192:800">
									折
								</XText>
							</XView>
							<XView style={styles.ticketInfoCol} data-node-id="192:801">
								<XText style={styles.ticketTitle} data-node-id="192:802">
									租车折扣券
								</XText>
								<XText style={styles.ticketSub} data-node-id="192:803">
									盲盒用户专享
								</XText>
							</XView>
						</XView>
					</XView>
				</XScrollView>

				<XView style={styles.dotsRow} data-node-id="192:804">
					<XView style={styles.dotActive} data-node-id="192:805" />
					<XView style={styles.dotInactive} data-node-id="192:806" />
				</XView>
			</XView>

			<XImage
				style={styles.pinxuan}
				src="https://images3.c-ctrip.com/train/activity/d2c-lands-test/pinxuan.png"
				data-node-id="192:807"
			/>
		</XView>
	)
}
