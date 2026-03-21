/**
 * pricing.js - 套餐购买页面逻辑
 */

const API = window.AppConfig?.API_BASE || '/api';
const PAY_TYPE_META = {
    alipay: { icon: 'fa-brands fa-alipay', color: '#1677ff', labelKey: 'pricingAlipay' },
    wxpay: { icon: 'fa-brands fa-weixin', color: '#07c160', labelKey: 'pricingWxpay' },
    qqpay: { icon: 'fa-brands fa-qq', color: '#12b7f5', labelKey: 'pricingQqpay' }
};

let allPlans = [];
let currentOrders = [];
let selectedPlan = null;
let selectedPayType = 'alipay';
let selectedProviderId = null;
let currentPaymentOptions = null;
let availablePayTypes = [];

function getToken() {
    return window.QuickShareSession?.getToken() || localStorage.getItem('token');
}

function isLoggedIn() {
    return !!getToken();
}

async function apiRequest(path, options = {}) {
    const token = getToken();
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (token) headers.Authorization = 'Bearer ' + token;
    const resp = await fetch(API + path, { ...options, headers });
    const json = await resp.json();
    if (json.code !== 200 && json.code !== 0) throw new Error(json.message || 'Request failed');
    return json.data;
}

function esc(val) {
    const div = document.createElement('div');
    div.textContent = val == null ? '' : String(val);
    return div.innerHTML;
}

function escapeJsString(value) {
    return String(value == null ? '' : value)
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'");
}

function formatPlanValue(plan) {
    if (plan.type === 'storage') return formatStorageSize(plan.value);
    if (plan.type === 'downloads') return plan.value.toLocaleString() + ' ' + t('pricingDownloadsUnit');
    if (plan.type === 'vip') return plan.value + ' ' + t('pricingVipUnit');
    return String(plan.value);
}

function formatStorageSize(bytes) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const size = bytes / Math.pow(1024, i);
    return `${size >= 10 || i === 0 ? Math.round(size) : size.toFixed(1)} ${units[i]}`;
}

function formatDateTime(value) {
    if (!value) return '-';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString();
}

function getPlanIcon(type) {
    if (type === 'storage') return '<i class="fa-solid fa-hard-drive"></i>';
    if (type === 'downloads') return '<i class="fa-solid fa-download"></i>';
    if (type === 'vip') return '<i class="fa-solid fa-crown"></i>';
    return '<i class="fa-solid fa-box"></i>';
}

function getPayTypeMeta(type) {
    return PAY_TYPE_META[type] || { icon: 'fa-solid fa-credit-card', color: 'var(--primary)', labelKey: type };
}

function sanitizePayTypes(payTypes) {
    const unique = [];
    (Array.isArray(payTypes) ? payTypes : []).forEach(type => {
        const normalized = String(type || '').trim().toLowerCase();
        if (!PAY_TYPE_META[normalized] || unique.includes(normalized)) {
            return;
        }
        unique.push(normalized);
    });
    return unique.length ? unique : ['alipay'];
}

function getOrderStatusInfo(status) {
    const normalized = String(status || 'pending').trim().toLowerCase();
    const map = {
        pending: { cls: 'pending', label: t('pricingOrderStatusPending') },
        paid: { cls: 'paid', label: t('pricingOrderStatusPaid') },
        expired: { cls: 'expired', label: t('pricingOrderStatusExpired') },
        refunded: { cls: 'refunded', label: t('pricingOrderStatusRefunded') }
    };
    return map[normalized] || map.pending;
}

function canCreateOrder() {
    return !!currentPaymentOptions && !!selectedProviderId && availablePayTypes.length > 0;
}

function renderPlans() {
    const grid = document.getElementById('plansGrid');
    if (!grid) return;

    if (!allPlans.length) {
        grid.innerHTML = `<p style="color:var(--text-sub); grid-column:1/-1; text-align:center; padding:60px 0;">${t('pricingNoPlans')}</p>`;
        return;
    }

    grid.innerHTML = allPlans.map(plan => `
        <div class="glass-card plan-card" style="padding:28px;">
            <div class="plan-icon ${plan.type}" style="margin-bottom:20px;">${getPlanIcon(plan.type)}</div>
            <h3 style="font-size:1.2rem; font-weight:600; margin-bottom:6px;">${esc(plan.name)}</h3>
            <p style="color:var(--text-sub); font-size:0.88rem; margin-bottom:16px; min-height:40px;">${esc(plan.description || '')}</p>
            <div style="margin-bottom:20px;">
                <span style="font-size:2rem; font-weight:700; color:var(--primary);">${t('pricingCurrency')}${esc(plan.price)}</span>
            </div>
            <div style="color:var(--text-sub); font-size:0.85rem; margin-bottom:20px;">
                ${formatPlanValue(plan)}
            </div>
            <button class="buy-btn" onclick="openPayModal(${plan.id})" ${canCreateOrder() ? '' : 'disabled'}>
                <i class="fa-solid fa-cart-shopping"></i>
                ${canCreateOrder() ? t('pricingBuyBtn') : t('pricingBuyUnavailable')}
            </button>
        </div>
    `).join('');
}

function renderPaymentOptionsNotice() {
    const container = document.getElementById('paymentOptionsNotice');
    if (!container) return;

    if (!currentPaymentOptions) {
        container.innerHTML = `<span>${esc(t('pricingPaymentMethodsUnavailable'))}</span>`;
        return;
    }

    const providerName = currentPaymentOptions.providerName || t('pricingPaymentMethodsDefaultProvider');
    const methodLabels = availablePayTypes.map(type => t(getPayTypeMeta(type).labelKey)).join(' / ');
    container.innerHTML = `
        <div class="notice-provider">
            <div>
                <strong>${esc(providerName)}</strong>
                <div style="margin-top:8px;">${esc(t('pricingPaymentMethodsAvailable').replace('{methods}', methodLabels))}</div>
            </div>
        </div>
        <div class="method-badges">
            ${availablePayTypes.map(type => {
                const meta = getPayTypeMeta(type);
                return `
                    <span class="method-badge">
                        <i class="${meta.icon}" style="color:${meta.color};"></i>
                        <span>${esc(t(meta.labelKey))}</span>
                    </span>
                `;
            }).join('')}
        </div>
    `;
}

function renderOrdersLoading() {
    const container = document.getElementById('ordersList');
    if (!container) return;
    container.innerHTML = `<div class="empty-panel">${esc(t('pricingOrdersLoading'))}</div>`;
}

function renderOrdersError(message) {
    const container = document.getElementById('ordersList');
    if (!container) return;
    container.innerHTML = `<div class="empty-panel">${esc(message || t('pricingOrdersLoadFailed'))}</div>`;
}

function renderOrders() {
    const container = document.getElementById('ordersList');
    if (!container) return;

    if (!isLoggedIn()) {
        container.innerHTML = `
            <div class="empty-panel">
                <div>${esc(t('pricingOrdersLoginHint'))}</div>
                <div style="margin-top:16px;">
                    <button class="toolbar-btn" onclick="window.location.href='login.html'">
                        <i class="fa-solid fa-right-to-bracket"></i>
                        <span>${esc(t('loginBtn'))}</span>
                    </button>
                </div>
            </div>
        `;
        return;
    }

    if (!currentOrders.length) {
        container.innerHTML = `<div class="empty-panel">${esc(t('pricingOrdersEmpty'))}</div>`;
        return;
    }

    container.innerHTML = currentOrders.map(order => {
        const statusInfo = getOrderStatusInfo(order.status);
        const payTypeMeta = getPayTypeMeta(order.payType);
        return `
            <article class="order-card">
                <div class="order-card-top">
                    <div>
                        <h3 class="order-card-title">${esc(order.planName || t('pricingOrderUnknownPlan'))}</h3>
                        <p class="order-card-sub">${esc(t('pricingOrderNoLabel'))}: ${esc(order.orderNo)}</p>
                    </div>
                    <span class="status-pill ${statusInfo.cls}">${esc(statusInfo.label)}</span>
                </div>
                <div class="order-meta-grid">
                    <div class="order-meta">
                        <div class="order-meta-label">${esc(t('pricingOrderAmountLabel'))}</div>
                        <div class="order-meta-value">${esc(t('pricingCurrency'))}${esc(order.amount)}</div>
                    </div>
                    <div class="order-meta">
                        <div class="order-meta-label">${esc(t('pricingOrderPayTypeLabel'))}</div>
                        <div class="order-meta-value">${esc(t(payTypeMeta.labelKey))}</div>
                    </div>
                    <div class="order-meta">
                        <div class="order-meta-label">${esc(t('pricingOrderCreatedLabel'))}</div>
                        <div class="order-meta-value">${esc(formatDateTime(order.createTime))}</div>
                    </div>
                    <div class="order-meta">
                        <div class="order-meta-label">${esc(t('pricingOrderTradeNoLabel'))}</div>
                        <div class="order-meta-value">${esc(order.tradeNo || '-')}</div>
                    </div>
                </div>
                <div class="order-actions">
                    <button class="toolbar-btn" onclick="openOrderStatus('${escapeJsString(order.orderNo)}')">
                        <i class="fa-solid fa-receipt"></i>
                        <span>${esc(order.status === 'pending' ? t('pricingOrderCheckPayment') : t('pricingOrderViewStatus'))}</span>
                    </button>
                </div>
            </article>
        `;
    }).join('');
}

function renderPayOptions() {
    return availablePayTypes.map((type, index) => {
        const meta = getPayTypeMeta(type);
        const selectedClass = index === 0 ? ' selected' : '';
        return `
            <div class="pay-option${selectedClass}" onclick="selectPayType('${type}', this)">
                <i class="${meta.icon}" style="font-size:1.4rem; color:${meta.color};"></i>
                <span>${esc(t(meta.labelKey))}</span>
            </div>
        `;
    }).join('');
}

function openPayModal(planId) {
    if (!canCreateOrder()) {
        showToast(t('pricingPaymentMethodsUnavailable'), 'error');
        return;
    }

    if (!isLoggedIn()) {
        showToast(t('pricingLoginRequired'), 'error');
        setTimeout(() => { window.location.href = 'login.html'; }, 1500);
        return;
    }

    selectedPlan = allPlans.find(p => p.id === planId);
    if (!selectedPlan) return;

    selectedPayType = availablePayTypes[0] || null;
    if (!selectedPayType) {
        showToast(t('pricingNoSupportedPayTypes'), 'error');
        return;
    }

    const modal = document.getElementById('payModal');
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content">
            <h3 style="font-size:1.2rem; font-weight:600; margin-bottom:4px;">${t('pricingSelectPayType')}</h3>
            <p style="color:var(--text-sub); font-size:0.88rem; margin-bottom:20px;">${esc(selectedPlan.name)} — ${t('pricingCurrency')}${esc(selectedPlan.price)}</p>
            <div id="payOptions">
                ${renderPayOptions()}
            </div>
            <div style="display:flex; gap:12px; margin-top:20px;">
                <button class="buy-btn" id="confirmPayBtn" onclick="confirmPay(this)" style="flex:1; justify-content:center;">
                    ${t('pricingConfirmPay')}
                </button>
                <button class="toolbar-btn" onclick="closePayModal()" style="flex:0;">
                    ${t('pricingCancel')}
                </button>
            </div>
        </div>
    `;
}

function selectPayType(type, el) {
    selectedPayType = type;
    document.querySelectorAll('.pay-option').forEach(option => option.classList.remove('selected'));
    el.classList.add('selected');
}

function closePayModal() {
    const modal = document.getElementById('payModal');
    if (!modal) return;
    modal.style.display = 'none';
    modal.innerHTML = '';
}

async function confirmPay(button) {
    if (!selectedPlan || !selectedPayType) return;
    button.disabled = true;
    button.textContent = t('pricingCreatingOrder');

    try {
        const returnUrl = window.location.origin + '/payment-result.html';
        const data = await apiRequest('/payment/create', {
            method: 'POST',
            body: JSON.stringify({
                planId: selectedPlan.id,
                providerId: selectedProviderId,
                payType: selectedPayType,
                returnUrl
            })
        });
        if (data?.redirectUrl) {
            window.location.href = data.redirectUrl;
        } else {
            showToast(t('pricingCreateFailed'), 'error');
        }
    } catch (error) {
        showToast(error.message || t('pricingCreateFailed'), 'error');
    } finally {
        button.disabled = false;
        button.textContent = t('pricingConfirmPay');
    }
}

function openOrderStatus(orderNo) {
    window.location.href = `payment-result.html?order_no=${encodeURIComponent(orderNo)}`;
}

async function loadPlans() {
    try {
        allPlans = await apiRequest('/public/plans') || [];
        renderPlans();
    } catch (error) {
        console.error('Failed to load plans:', error);
    }
}

async function loadPaymentOptions() {
    try {
        currentPaymentOptions = await apiRequest('/public/payment-options');
        if (currentPaymentOptions) {
            selectedProviderId = currentPaymentOptions.providerId || null;
            availablePayTypes = sanitizePayTypes(currentPaymentOptions.payTypes);
        } else {
            selectedProviderId = null;
            availablePayTypes = [];
        }
    } catch (error) {
        console.error('Failed to load payment options:', error);
        currentPaymentOptions = null;
        selectedProviderId = null;
        availablePayTypes = [];
    }
    renderPaymentOptionsNotice();
    renderPlans();
}

async function loadOrders() {
    if (!isLoggedIn()) {
        currentOrders = [];
        renderOrders();
        return;
    }

    renderOrdersLoading();
    try {
        currentOrders = await apiRequest('/payment/orders') || [];
        renderOrders();
    } catch (error) {
        console.error('Failed to load orders:', error);
        currentOrders = [];
        renderOrdersError(error.message || t('pricingOrdersLoadFailed'));
    }
}

async function refreshOrders(button) {
    if (button) button.disabled = true;
    try {
        await loadOrders();
    } finally {
        if (button) button.disabled = false;
    }
}

async function initPricingPage() {
    await Promise.all([
        loadPlans(),
        loadPaymentOptions(),
        loadOrders()
    ]);
}

document.addEventListener('DOMContentLoaded', initPricingPage);
document.addEventListener('quickshare:languagechange', () => {
    renderPlans();
    renderPaymentOptionsNotice();
    renderOrders();
    if (document.getElementById('payModal')?.style.display === 'flex' && selectedPlan) {
        openPayModal(selectedPlan.id);
    }
});

window.openPayModal = openPayModal;
window.selectPayType = selectPayType;
window.closePayModal = closePayModal;
window.confirmPay = confirmPay;
window.refreshOrders = refreshOrders;
window.openOrderStatus = openOrderStatus;
