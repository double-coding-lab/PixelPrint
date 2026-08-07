import { XImage, XText, XView } from '@myxx/xtaro';
import { styles } from './styles';

export default function AirportBus() {
	return (
		<XView
			style={{
				margin: 'auto',
				marginTop: 99,
			}}>
			<XView style={styles.root} data-node-id="1:1459">
				<XImage style={styles.bgTitle} src={require('@Images/AirportBus/title.png')} data-node-id="1:1460" />

				<XImage style={styles.tabs} src={require('@Images/AirportBus/tabs.png')} data-node-id="1:1647" />

				<XView style={styles.card} data-node-id="1:1623">
					<XView style={styles.coupon} data-node-id="1:1637">
						<XView style={styles.couponMain} data-node-id="1:1639">
							<XImage style={styles.couponIcon} src={require('@Images/AirportBus/hongbao.png')} data-node-id="1:1644" />
							<XView style={styles.couponTextRow} data-node-id="1:1640">
								<XText style={styles.couponPrefix} data-node-id="1:1641">
									您有
								</XText>
								<XText style={styles.couponMoney} data-node-id="1:1642">
									¥50接送机券
								</XText>
								<XText style={styles.couponSuffix} data-node-id="1:1643">
									待使用
								</XText>
							</XView>
						</XView>
						<XImage style={styles.couponArrow} src={require('@Images/AirportBus/arrow-coupon.png')} data-node-id="2:330" />
					</XView>

					<XView style={styles.tripRow} data-node-id="6:330">
						<XImage style={styles.points} src={require('@Images/AirportBus/points.png')} data-node-id="1:1631" />
						<XView style={styles.tripCol} data-node-id="6:331">
							<XText style={styles.tripFrom} data-node-id="1:1630">
								上海浦东国际机场T2
							</XText>
							<XView style={styles.divider} data-node-id="1:1629" />
							<XView style={styles.tripToRow} data-node-id="6:332">
								<XView style={styles.tripToPlaceholderWrap} data-node-id="1:1626">
									<XText style={styles.tripToPlaceholder} data-node-id="1:1627">
										选择你的目的地
									</XText>
								</XView>
								<XImage style={styles.tripArrow} src={require('@Images/AirportBus/arrow-to.png')} data-node-id="1:1628" />
							</XView>
						</XView>
					</XView>

					<XView style={styles.btnQuery} data-node-id="6:333">
						<XText style={styles.btnQueryText} data-node-id="I1:1625;0:301">
							查询班次
						</XText>
					</XView>
				</XView>
			</XView>
		</XView>
	);
}
