import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Theme } from '../theme';
import type { QuickSharePaymentOptions, QuickSharePaymentOrder, QuickSharePlan } from '../types/quickshare';

interface PricingCenterProps {
  loading: boolean;
  plans: QuickSharePlan[];
  paymentOptions: QuickSharePaymentOptions | null;
  orders: QuickSharePaymentOrder[];
  selectedOrder: QuickSharePaymentOrder | null;
  paymentMeta: string | null;
  error: string | null;
  onCreateOrder: (plan: QuickSharePlan) => void;
  onRefreshOrders: () => void;
  onSelectOrder: (order: QuickSharePaymentOrder) => void;
}

export function PricingCenter({
  loading,
  plans,
  paymentOptions,
  orders,
  selectedOrder,
  paymentMeta,
  error,
  onCreateOrder,
  onRefreshOrders,
  onSelectOrder,
}: PricingCenterProps) {
  return (
    <ScrollView contentContainerStyle={s.content}>
      <View style={s.card}>
        <Text style={s.eyebrow}>Plans</Text>
        {paymentOptions ? <Text style={s.helperText}>Provider: {paymentOptions.providerName || 'Unknown'} · Methods: {(paymentOptions.payTypes || []).join(' / ')}</Text> : <Text style={s.helperText}>No payment provider is enabled right now.</Text>}
        {plans.map((plan) => (
          <View key={plan.id} style={s.planCard}>
            <View style={s.planHeader}>
              <View style={s.planIcon}><Text style={s.planIconText}>★</Text></View>
              <View style={s.planHeaderText}>
                <Text style={s.planTitle}>{plan.name || `Plan #${plan.id}`}</Text>
                <Text style={s.planMeta}>{plan.description || ''}</Text>
              </View>
              <Text style={s.planPrice}>¥{plan.price ?? 0}</Text>
            </View>
            <View style={s.chipRow}>
              <View style={[s.metaChip, { backgroundColor: Theme.primary06 }]}>
                <Text style={s.metaChipLabel}>Type</Text>
                <Text style={[s.metaChipValue, { color: Theme.primaryDark }]}>{plan.type || 'unknown'}</Text>
              </View>
              <View style={[s.metaChip, { backgroundColor: Theme.success10 }]}>
                <Text style={s.metaChipLabel}>Value</Text>
                <Text style={[s.metaChipValue, { color: Theme.successDark }]}>{plan.value ?? '-'}</Text>
              </View>
            </View>
            <Pressable onPress={() => onCreateOrder(plan)} style={({ pressed }) => [s.primaryButton, pressed ? s.pressed : null]}>
              <Text style={s.primaryButtonText}>Create payment order</Text>
            </Pressable>
          </View>
        ))}
      </View>

      <View style={s.card}>
        <Text style={s.eyebrow}>My orders</Text>
        <Pressable onPress={onRefreshOrders} style={({ pressed }) => [s.secondaryButton, pressed ? s.pressed : null]}>
          <Text style={s.secondaryButtonText}>{loading ? 'Refreshing…' : 'Refresh orders'}</Text>
        </Pressable>
        {error ? <Text style={s.errorText}>{error}</Text> : null}
        {orders.length ? orders.map((order) => (
          <Pressable key={order.orderNo} onPress={() => onSelectOrder(order)} style={({ pressed }) => [s.orderCard, pressed ? s.pressed : null]}>
            <View style={s.orderHeader}>
              <Text style={s.orderTitle}>{order.planName || order.orderNo}</Text>
              <View style={[s.statusChip, { backgroundColor: order.status === 'paid' ? Theme.success10 : order.status === 'pending' ? Theme.warning08 : Theme.primary06 }]}>
                <Text style={[s.statusChipText, { color: order.status === 'paid' ? Theme.successDark : order.status === 'pending' ? Theme.warningDark : Theme.primaryDark }]}>{order.status || 'unknown'}</Text>
              </View>
            </View>
            <Text style={s.orderMeta}>Pay type: {order.payType || 'unknown'}</Text>
            <Text style={s.orderMeta}>Amount: ¥{order.amount ?? 0}</Text>
          </Pressable>
        )) : <Text style={s.helperText}>No payment orders yet.</Text>}
      </View>

      {selectedOrder ? (
        <View style={s.card}>
          <Text style={s.eyebrow}>Selected order</Text>
          <Text style={s.orderTitle}>{selectedOrder.orderNo}</Text>
          <View style={s.chipRow}>
            <View style={[s.metaChip, { backgroundColor: Theme.primary06 }]}>
              <Text style={s.metaChipLabel}>Plan</Text>
              <Text style={[s.metaChipValue, { color: Theme.primaryDark }]}>{selectedOrder.planName || '-'}</Text>
            </View>
            <View style={[s.metaChip, { backgroundColor: Theme.success10 }]}>
              <Text style={s.metaChipLabel}>Status</Text>
              <Text style={[s.metaChipValue, { color: Theme.successDark }]}>{selectedOrder.status || '-'}</Text>
            </View>
          </View>
          <Text style={s.orderMeta}>Trade no: {selectedOrder.tradeNo || '-'}</Text>
          <Text style={s.orderMeta}>Created: {selectedOrder.createTime || '-'}</Text>
          {paymentMeta ? <Text style={s.helperText}>{paymentMeta}</Text> : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content: {
    gap: Theme.space6,
    paddingBottom: Theme.space24,
  },
  card: {
    backgroundColor: Theme.surface,
    borderColor: Theme.borderStrong,
    borderRadius: Theme.radius2xl,
    borderWidth: 1,
    gap: Theme.space5,
    padding: Theme.space9,
  },
  eyebrow: {
    color: Theme.textSecondary,
    fontSize: Theme.fontSizeSm,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  helperText: {
    color: Theme.textSecondary,
    fontSize: Theme.fontSizeCaption,
  },
  planCard: {
    backgroundColor: Theme.surfaceTint,
    borderRadius: Theme.radiusXl,
    gap: Theme.space4,
    padding: Theme.space7,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.space4,
  },
  planIcon: {
    width: 40,
    height: 40,
    borderRadius: Theme.radiusLg,
    backgroundColor: Theme.primary08,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planIconText: {
    color: Theme.primaryDark,
    fontSize: Theme.fontSizeLg,
    fontWeight: '800',
  },
  planHeaderText: {
    flex: 1,
    gap: 2,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.space3,
  },
  metaChip: {
    borderRadius: Theme.radiusMd,
    paddingHorizontal: Theme.space5,
    paddingVertical: Theme.space3,
    gap: 1,
  },
  metaChipLabel: {
    color: Theme.textTertiary,
    fontSize: Theme.fontSizeXs,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  metaChipValue: {
    fontSize: Theme.fontSizeCaption,
    fontWeight: '700',
  },
  planTitle: {
    color: Theme.text,
    fontSize: Theme.fontSizeMd,
    fontWeight: '700',
  },
  planMeta: {
    color: Theme.textSecondary,
    fontSize: Theme.fontSizeCaption,
  },
  planPrice: {
    color: Theme.primaryDark,
    fontSize: Theme.fontSizeXl,
    fontWeight: '800',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: Theme.primaryDark,
    borderRadius: Theme.radiusLg,
    justifyContent: 'center',
    minHeight: Theme.touchMin,
  },
  primaryButtonText: {
    color: Theme.textInverse,
    fontSize: Theme.fontSizeBase,
    fontWeight: '800',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: Theme.surfaceTint,
    borderRadius: Theme.radiusLg,
    justifyContent: 'center',
    minHeight: Theme.touchMin,
  },
  secondaryButtonText: {
    color: Theme.primaryDark,
    fontSize: Theme.fontSizeBase,
    fontWeight: '700',
  },
  orderCard: {
    backgroundColor: Theme.surfaceSunken,
    borderColor: Theme.borderStrong,
    borderRadius: Theme.radiusXl,
    borderWidth: 1,
    gap: Theme.space3,
    padding: Theme.space7,
  },
  orderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Theme.space4,
  },
  statusChip: {
    borderRadius: Theme.radiusMd,
    paddingHorizontal: Theme.space4,
    paddingVertical: Theme.space2,
  },
  statusChipText: {
    fontSize: Theme.fontSizeCaption,
    fontWeight: '700',
  },
  orderTitle: {
    color: Theme.text,
    fontSize: Theme.fontSizeBase,
    fontWeight: '700',
  },
  orderMeta: {
    color: Theme.textSecondary,
    fontSize: Theme.fontSizeCaption,
  },
  errorText: {
    color: Theme.danger,
    fontSize: Theme.fontSizeCaption,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.88,
  },
});
