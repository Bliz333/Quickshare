import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

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
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Plans</Text>
        {paymentOptions ? <Text style={styles.helperText}>Provider: {paymentOptions.providerName || 'Unknown'} · Methods: {(paymentOptions.payTypes || []).join(' / ')}</Text> : <Text style={styles.helperText}>No payment provider is enabled right now.</Text>}
        {plans.map((plan) => (
          <View key={plan.id} style={styles.planCard}>
            <Text style={styles.planTitle}>{plan.name || `Plan #${plan.id}`}</Text>
            <Text style={styles.planMeta}>{plan.description || ''}</Text>
            <Text style={styles.planMeta}>Type: {plan.type || 'unknown'} · Value: {plan.value ?? '-'}</Text>
            <Text style={styles.planPrice}>¥{plan.price ?? 0}</Text>
            <Pressable onPress={() => onCreateOrder(plan)} style={({ pressed }) => [styles.primaryButton, pressed ? styles.pressed : null]}>
              <Text style={styles.primaryButtonText}>Create payment order</Text>
            </Pressable>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>My orders</Text>
        <Pressable onPress={onRefreshOrders} style={({ pressed }) => [styles.secondaryButton, pressed ? styles.pressed : null]}>
          <Text style={styles.secondaryButtonText}>{loading ? 'Refreshing…' : 'Refresh orders'}</Text>
        </Pressable>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {orders.length ? orders.map((order) => (
          <Pressable key={order.orderNo} onPress={() => onSelectOrder(order)} style={({ pressed }) => [styles.orderCard, pressed ? styles.pressed : null]}>
            <Text style={styles.orderTitle}>{order.planName || order.orderNo}</Text>
            <Text style={styles.orderMeta}>Status: {order.status || 'unknown'} · Pay type: {order.payType || 'unknown'}</Text>
            <Text style={styles.orderMeta}>Amount: ¥{order.amount ?? 0}</Text>
          </Pressable>
        )) : <Text style={styles.helperText}>No payment orders yet.</Text>}
      </View>

      {selectedOrder ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Selected order</Text>
          <Text style={styles.orderTitle}>{selectedOrder.orderNo}</Text>
          <Text style={styles.orderMeta}>Plan: {selectedOrder.planName || '-'}</Text>
          <Text style={styles.orderMeta}>Status: {selectedOrder.status || '-'}</Text>
          <Text style={styles.orderMeta}>Trade no: {selectedOrder.tradeNo || '-'}</Text>
          <Text style={styles.orderMeta}>Created: {selectedOrder.createTime || '-'}</Text>
          {paymentMeta ? <Text style={styles.helperText}>{paymentMeta}</Text> : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 16,
    paddingBottom: 48,
  },
  card: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    padding: 18,
  },
  sectionTitle: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '800',
  },
  helperText: {
    color: '#64748b',
    fontSize: 13,
  },
  planCard: {
    backgroundColor: '#eff6ff',
    borderRadius: 14,
    gap: 6,
    padding: 14,
  },
  planTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '700',
  },
  planMeta: {
    color: '#475569',
    fontSize: 13,
  },
  planPrice: {
    color: '#2563eb',
    fontSize: 18,
    fontWeight: '800',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#2563eb',
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: 44,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#dbeafe',
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: 44,
  },
  secondaryButtonText: {
    color: '#1d4ed8',
    fontSize: 14,
    fontWeight: '700',
  },
  orderCard: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
    padding: 14,
  },
  orderTitle: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
  },
  orderMeta: {
    color: '#475569',
    fontSize: 13,
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 13,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.88,
  },
});
