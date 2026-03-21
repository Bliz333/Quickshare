/**
 * payment-result.js - 支付结果页逻辑
 */

const API = window.AppConfig?.API_BASE || '/api';
const PAYMENT_POLL_INTERVAL_SECONDS = 3;
const PAYMENT_POLL_MAX_ATTEMPTS = 10;

let currentOrderSnapshot = undefined;
let paymentPollTimeout = null;
let paymentPollCountdown = null;
let paymentPollSecondsRemaining = 0;
let paymentPollAttempts = 0;
let paymentLastCheckedAt = null;
let orderCheckInFlight = false;

function getToken() {
    return window.QuickShareSession?.getToken() || localStorage.getItem('token');
}

async function apiRequest(path) {
    const token = getToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const resp = await fetch(API + path, { headers });
    const json = await resp.json();
    if (json.code !== 200 && json.code !== 0) throw new Error(json.message || 'Request failed');
    return json.data;
}

function esc(val) {
    const div = document.createElement('div');
    div.textContent = val == null ? '' : String(val);
    return div.innerHTML;
}

function getOrderNoFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('order_no') || params.get('orderNo') || params.get('out_trade_no') || '';
}

function stopPaymentPolling({ resetAttempts = false } = {}) {
    if (paymentPollTimeout) {
        clearTimeout(paymentPollTimeout);
        paymentPollTimeout = null;
    }
    if (paymentPollCountdown) {
        clearInterval(paymentPollCountdown);
        paymentPollCountdown = null;
    }
    paymentPollSecondsRemaining = 0;
    if (resetAttempts) {
        paymentPollAttempts = 0;
    }
}

function getPaymentMetaText() {
    if (!currentOrderSnapshot || currentOrderSnapshot.status !== 'pending') {
        return '';
    }

    const parts = [];
    if (paymentPollAttempts >= PAYMENT_POLL_MAX_ATTEMPTS) {
        parts.push(t('paymentResultAutoRefreshStopped'));
    } else if (paymentPollSecondsRemaining > 0) {
        parts.push(`${t('paymentResultAutoRefreshPrefix')}${paymentPollSecondsRemaining}${t('paymentResultAutoRefreshSuffix')}`);
    }

    if (paymentLastCheckedAt) {
        parts.push(`${t('paymentResultLastChecked')}: ${paymentLastCheckedAt.toLocaleTimeString()}`);
    }
    return parts.join(' ');
}

function updatePaymentMeta() {
    const meta = document.getElementById('paymentResultMeta');
    if (!meta) {
        return;
    }

    const text = getPaymentMetaText();
    meta.textContent = text;
    meta.style.display = text ? 'block' : 'none';
}

function setRefreshButtonLoading(loading) {
    const button = document.getElementById('paymentRefreshBtn');
    if (!button) {
        return;
    }

    button.disabled = loading;
    button.innerHTML = loading
        ? `<i class="fa-solid fa-rotate-right fa-spin"></i> ${t('paymentResultRefreshing')}`
        : `<i class="fa-solid fa-rotate-right"></i> ${t('paymentResultRefresh')}`;
}

function schedulePaymentPolling() {
    stopPaymentPolling();

    if (!currentOrderSnapshot || currentOrderSnapshot.status !== 'pending') {
        return;
    }

    if (paymentPollAttempts >= PAYMENT_POLL_MAX_ATTEMPTS) {
        updatePaymentMeta();
        return;
    }

    paymentPollSecondsRemaining = PAYMENT_POLL_INTERVAL_SECONDS;
    updatePaymentMeta();

    paymentPollCountdown = setInterval(() => {
        paymentPollSecondsRemaining = Math.max(paymentPollSecondsRemaining - 1, 0);
        updatePaymentMeta();
        if (paymentPollSecondsRemaining <= 0 && paymentPollCountdown) {
            clearInterval(paymentPollCountdown);
            paymentPollCountdown = null;
        }
    }, 1000);

    paymentPollTimeout = setTimeout(() => {
        paymentPollAttempts += 1;
        checkOrder({ fromAutoPoll: true });
    }, PAYMENT_POLL_INTERVAL_SECONDS * 1000);
}

function renderResult(order) {
    currentOrderSnapshot = order || null;
    const container = document.getElementById('resultContent');
    if (!order) {
        stopPaymentPolling({ resetAttempts: true });
        container.innerHTML = `
            <div class="result-icon expired"><i class="fa-solid fa-circle-question"></i></div>
            <h2 style="font-size:1.4rem; font-weight:600; margin-bottom:20px;">${t('paymentResultNoOrder')}</h2>
            <a href="netdisk.html" class="toolbar-btn primary">${t('paymentResultBackToNetdisk')}</a>
        `;
        return;
    }

    const statusConfig = {
        paid: { icon: 'fa-circle-check', cls: 'success', title: t('paymentResultSuccess'), desc: t('paymentResultSuccessDesc') },
        pending: { icon: 'fa-clock', cls: 'pending', title: t('paymentResultPending'), desc: t('paymentResultPendingDesc') },
        expired: { icon: 'fa-circle-xmark', cls: 'expired', title: t('paymentResultExpired'), desc: '' },
        refunded: { icon: 'fa-rotate-left', cls: 'refunded', title: t('paymentResultRefunded'), desc: '' }
    };
    const cfg = statusConfig[order.status] || statusConfig.pending;

    container.innerHTML = `
        <div class="result-icon ${cfg.cls}"><i class="fa-solid ${cfg.icon}"></i></div>
        <h2 style="font-size:1.4rem; font-weight:600; margin-bottom:6px;">${cfg.title}</h2>
        <p style="color:var(--text-sub); font-size:0.9rem; margin-bottom:24px;">${cfg.desc}</p>
        <div id="paymentResultMeta" class="result-meta" style="display:${order.status === 'pending' ? 'block' : 'none'};"></div>
        <div style="text-align:left; margin-bottom:24px;">
            <div class="detail-row">
                <span style="color:var(--text-sub);">${t('paymentResultOrderNo')}</span>
                <span style="font-family:monospace; font-size:0.85rem;">${esc(order.orderNo)}</span>
            </div>
            <div class="detail-row">
                <span style="color:var(--text-sub);">${t('paymentResultPlanName')}</span>
                <span>${esc(order.planName)}</span>
            </div>
            <div class="detail-row">
                <span style="color:var(--text-sub);">${t('paymentResultAmount')}</span>
                <span style="font-weight:600; color:var(--primary);">${t('pricingCurrency')}${esc(order.amount)}</span>
            </div>
        </div>
        <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
            <a href="netdisk.html" class="toolbar-btn primary">
                <i class="fa-solid fa-hard-drive"></i> ${t('paymentResultBackToNetdisk')}
            </a>
            ${order.status === 'pending' ? `<button class="toolbar-btn" id="paymentRefreshBtn" onclick="checkOrder({ manual: true })"><i class="fa-solid fa-rotate-right"></i> ${t('paymentResultRefresh')}</button>` : ''}
            <a href="pricing.html" class="toolbar-btn">
                <i class="fa-solid fa-cart-shopping"></i> ${t('paymentResultBuyMore')}
            </a>
        </div>
    `;

    if (order.status === 'pending') {
        updatePaymentMeta();
    } else {
        stopPaymentPolling({ resetAttempts: true });
    }
}

async function checkOrder(options = {}) {
    if (orderCheckInFlight) {
        return;
    }

    const { manual = false, fromAutoPoll = false } = options;
    const orderNo = getOrderNoFromUrl();
    if (!orderNo) {
        renderResult(null);
        return;
    }

    if (manual) {
        paymentPollAttempts = 0;
    }

    stopPaymentPolling();
    orderCheckInFlight = true;
    setRefreshButtonLoading(true);

    const previousStatus = currentOrderSnapshot?.status || null;

    try {
        const order = await apiRequest(`/payment/order/${encodeURIComponent(orderNo)}`);
        paymentLastCheckedAt = new Date();
        renderResult(order);
        if (fromAutoPoll && previousStatus === 'pending' && order?.status && order.status !== 'pending') {
            const toastMessage = {
                paid: t('paymentResultSuccess'),
                expired: t('paymentResultExpired'),
                refunded: t('paymentResultRefunded')
            }[order.status];
            if (toastMessage) {
                showToast(toastMessage, order.status === 'paid' ? 'success' : 'error');
            }
        }
        if (order?.status === 'pending') {
            schedulePaymentPolling();
        } else {
            stopPaymentPolling({ resetAttempts: true });
        }
    } catch (error) {
        console.error('Failed to check order:', error);
        renderResult(null);
        showToast(error.message || t('fetchError'), 'error');
        stopPaymentPolling({ resetAttempts: true });
    } finally {
        orderCheckInFlight = false;
        setRefreshButtonLoading(false);
    }
}

document.addEventListener('DOMContentLoaded', checkOrder);
document.addEventListener('quickshare:languagechange', () => {
    if (typeof currentOrderSnapshot !== 'undefined') {
        renderResult(currentOrderSnapshot);
        updatePaymentMeta();
        setRefreshButtonLoading(false);
        return;
    }
    checkOrder();
});
window.addEventListener('beforeunload', () => stopPaymentPolling({ resetAttempts: true }));

window.checkOrder = checkOrder;
