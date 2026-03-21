const HOME_NOTIFICATION_STORAGE_PREFIX = 'quickshare-home-notifications-seen';
const HOME_NOTIFICATION_INITIAL_VISIBLE = 4;
const HOME_NOTIFICATION_VISIBLE_STEP = 4;
const HOME_NOTIFICATION_COLLAPSE_LENGTH = 180;

const homeNotificationState = {
    activeTab: 'all',
    all: [],
    personal: [],
    loggedIn: false,
    open: false,
    hasUnread: false,
    unreadCount: 0,
    readMarkers: {
        all: [],
        personal: []
    },
    unreadCounts: {
        all: 0,
        personal: 0
    },
    legacySeenMarkers: {
        all: '',
        personal: ''
    },
    storageExists: false,
    currentMarkers: {
        all: [],
        personal: []
    },
    visibleCounts: {
        all: HOME_NOTIFICATION_INITIAL_VISIBLE,
        personal: HOME_NOTIFICATION_INITIAL_VISIBLE
    },
    expandedMarkers: {
        all: [],
        personal: []
    },
    eventsBound: false
};

function escapeHomeNotificationHtml(value) {
    const div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
}

function formatHomeNotificationDate(value) {
    if (!value) {
        return '-';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    const lang = typeof getCurrentLanguage === 'function' ? getCurrentLanguage() : 'zh';
    return date.toLocaleString(lang === 'en' ? 'en-US' : 'zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

async function fetchHomeNotifications(path, requireAuth = false) {
    const headers = requireAuth && typeof getAuthHeaders === 'function'
        ? getAuthHeaders()
        : {};

    const response = await fetch(`${API_BASE}${path}`, { headers });
    const text = await response.text();
    const result = text ? JSON.parse(text) : null;

    if (!response.ok || !result || result.code !== 200) {
        throw new Error(result?.message || 'Failed to load notifications');
    }

    return result.data || [];
}

function getHomeNotificationPanel() {
    return document.getElementById('homeNotificationsPanel');
}

function getHomeNotificationButton() {
    return document.getElementById('homeNotificationButton');
}

function getHomeNotificationCloseButton() {
    return document.getElementById('homeNoticeCloseBtn');
}

function getHomeNotificationStorageKey() {
    const user = window.QuickShareSession && typeof window.QuickShareSession.getStoredUser === 'function'
        ? window.QuickShareSession.getStoredUser()
        : {};

    if (user && user.id != null) {
        return `${HOME_NOTIFICATION_STORAGE_PREFIX}:user:${user.id}`;
    }

    return `${HOME_NOTIFICATION_STORAGE_PREFIX}:guest`;
}

function normalizeHomeNotificationMarkerList(list) {
    if (!Array.isArray(list)) {
        return [];
    }

    return [...new Set(list.filter(item => typeof item === 'string' && item.trim()))];
}

function loadHomeNotificationReadState() {
    try {
        const raw = localStorage.getItem(getHomeNotificationStorageKey());
        if (!raw) {
            return {
                exists: false,
                readMarkers: {
                    all: [],
                    personal: []
                },
                legacySeenMarkers: {
                    all: '',
                    personal: ''
                }
            };
        }

        const data = JSON.parse(raw);
        if (data && (Array.isArray(data.all) || Array.isArray(data.personal))) {
            return {
                exists: true,
                readMarkers: {
                    all: normalizeHomeNotificationMarkerList(data.all),
                    personal: normalizeHomeNotificationMarkerList(data.personal)
                },
                legacySeenMarkers: {
                    all: '',
                    personal: ''
                }
            };
        }

        return {
            exists: true,
            readMarkers: {
                all: [],
                personal: []
            },
            legacySeenMarkers: {
                all: typeof data?.all === 'string' ? data.all : '',
                personal: typeof data?.personal === 'string' ? data.personal : ''
            }
        };
    } catch (error) {
        return {
            exists: false,
            readMarkers: {
                all: [],
                personal: []
            },
            legacySeenMarkers: {
                all: '',
                personal: ''
            }
        };
    }
}

function saveHomeNotificationReadState() {
    localStorage.setItem(getHomeNotificationStorageKey(), JSON.stringify({
        version: 2,
        all: homeNotificationState.readMarkers.all,
        personal: homeNotificationState.readMarkers.personal
    }));
}

function getHomeNotificationMarker(item) {
    if (!item) {
        return '';
    }

    if (item.id != null) {
        return `${item.scope || 'all'}:${item.id}`;
    }

    return [
        item.scope || 'all',
        item.createTime || '',
        item.subject || ''
    ].join(':');
}

function collectCurrentHomeNotificationMarkers() {
    return {
        all: homeNotificationState.all.map(item => getHomeNotificationMarker(item)),
        personal: homeNotificationState.personal.map(item => getHomeNotificationMarker(item))
    };
}

function countUnreadHomeNotifications(items, readMarkers) {
    if (!Array.isArray(items) || !items.length) {
        return 0;
    }

    const readSet = new Set(normalizeHomeNotificationMarkerList(readMarkers));
    return items.filter(item => !readSet.has(getHomeNotificationMarker(item))).length;
}

function getHomeNotificationScopeKey(scope) {
    return scope === 'personal' ? 'personal' : 'all';
}

function buildReadMarkersFromLegacyMarker(scope, legacyMarker) {
    if (!legacyMarker) {
        return [];
    }

    const currentMarkers = homeNotificationState.currentMarkers[getHomeNotificationScopeKey(scope)] || [];
    const markerIndex = currentMarkers.indexOf(legacyMarker);
    if (markerIndex === -1) {
        return [];
    }

    return currentMarkers.slice(markerIndex);
}

function pruneHomeNotificationReadMarkers(markers) {
    return {
        all: normalizeHomeNotificationMarkerList(markers?.all).filter(marker => homeNotificationState.currentMarkers.all.includes(marker)),
        personal: normalizeHomeNotificationMarkerList(markers?.personal).filter(marker => homeNotificationState.currentMarkers.personal.includes(marker))
    };
}

function initializeHomeNotificationReadState() {
    const persisted = loadHomeNotificationReadState();
    homeNotificationState.storageExists = persisted.exists;
    homeNotificationState.currentMarkers = collectCurrentHomeNotificationMarkers();

    if (!persisted.exists) {
        homeNotificationState.readMarkers = {
            all: [...homeNotificationState.currentMarkers.all],
            personal: [...homeNotificationState.currentMarkers.personal]
        };
        saveHomeNotificationReadState();
        return;
    }

    const hasLegacyMarkers = !!(persisted.legacySeenMarkers.all || persisted.legacySeenMarkers.personal);
    if (hasLegacyMarkers) {
        homeNotificationState.readMarkers = {
            all: buildReadMarkersFromLegacyMarker('all', persisted.legacySeenMarkers.all),
            personal: buildReadMarkersFromLegacyMarker('personal', persisted.legacySeenMarkers.personal)
        };
        saveHomeNotificationReadState();
        return;
    }

    homeNotificationState.readMarkers = pruneHomeNotificationReadMarkers(persisted.readMarkers);
    saveHomeNotificationReadState();
}

function isHomeNotificationRead(item) {
    const scope = getHomeNotificationScopeKey(item?.scope);
    const marker = getHomeNotificationMarker(item);
    return homeNotificationState.readMarkers[scope].includes(marker);
}

function refreshHomeNotificationUnreadState() {
    homeNotificationState.unreadCounts = {
        all: countUnreadHomeNotifications(homeNotificationState.all, homeNotificationState.readMarkers.all),
        personal: countUnreadHomeNotifications(homeNotificationState.personal, homeNotificationState.readMarkers.personal)
    };
    homeNotificationState.unreadCount = homeNotificationState.unreadCounts.all + homeNotificationState.unreadCounts.personal;
    homeNotificationState.hasUnread = homeNotificationState.unreadCount > 0;
}

function shouldCollapseHomeNotificationBody(item) {
    return String(item?.body || '').trim().length > HOME_NOTIFICATION_COLLAPSE_LENGTH;
}

function isHomeNotificationExpanded(item) {
    const scope = getHomeNotificationScopeKey(item?.scope);
    const marker = getHomeNotificationMarker(item);
    return homeNotificationState.expandedMarkers[scope].includes(marker);
}

function initializeHomeNotificationDisplayState() {
    homeNotificationState.visibleCounts = {
        all: Math.min(homeNotificationState.all.length, HOME_NOTIFICATION_INITIAL_VISIBLE),
        personal: Math.min(homeNotificationState.personal.length, HOME_NOTIFICATION_INITIAL_VISIBLE)
    };
    homeNotificationState.expandedMarkers = {
        all: [],
        personal: []
    };
}

function updateHomeNotificationButton() {
    const button = getHomeNotificationButton();
    const badge = document.getElementById('homeNotificationBadge');
    const closeButton = getHomeNotificationCloseButton();
    const markAllButton = document.getElementById('homeNoticeMarkAllBtn');
    const moreButton = document.getElementById('homeNoticeMoreBtn');
    const title = typeof t === 'function' ? t('homeNoticeButton') : 'Notification Center';
    const closeText = typeof t === 'function' ? t('close') : 'Close';
    const markAllText = typeof t === 'function' ? t('homeNoticeMarkAllRead') : 'Mark all read';
    const moreText = typeof t === 'function' ? t('homeNoticeShowMore') : 'Show More';

    if (button) {
        button.title = title;
        button.setAttribute('aria-label', title);
        button.setAttribute('aria-expanded', homeNotificationState.open ? 'true' : 'false');
        button.classList.toggle('has-unread', homeNotificationState.hasUnread);
    }

    if (badge) {
        badge.style.display = homeNotificationState.hasUnread && homeNotificationState.unreadCount > 0 ? '' : 'none';
        badge.textContent = homeNotificationState.unreadCount > 9 ? '9+' : String(homeNotificationState.unreadCount || '');
    }

    if (closeButton) {
        closeButton.title = closeText;
        closeButton.setAttribute('aria-label', closeText);
    }

    if (markAllButton) {
        markAllButton.style.display = homeNotificationState.unreadCount > 0 ? '' : 'none';
        markAllButton.disabled = homeNotificationState.unreadCount === 0;
        markAllButton.title = markAllText;
        markAllButton.setAttribute('aria-label', markAllText);
    }

    if (moreButton) {
        moreButton.title = moreText;
        moreButton.setAttribute('aria-label', moreText);
    }
}

function updateHomeNotificationTabs() {
    const allTab = document.getElementById('homeNoticeTabAll');
    const personalTab = document.getElementById('homeNoticeTabPersonal');
    const loginHint = document.getElementById('homeNoticeLoginHint');

    if (allTab) {
        allTab.classList.toggle('active', homeNotificationState.activeTab === 'all');
    }

    if (personalTab) {
        personalTab.style.display = homeNotificationState.loggedIn ? '' : 'none';
        personalTab.classList.toggle('active', homeNotificationState.activeTab === 'personal');
    }

    if (loginHint) {
        loginHint.style.display = homeNotificationState.loggedIn ? 'none' : '';
    }
}

function renderHomeNotifications() {
    const panel = getHomeNotificationPanel();
    const list = document.getElementById('homeNoticeList');
    const empty = document.getElementById('homeNoticeEmpty');
    const footer = document.getElementById('homeNoticeFooter');
    const moreButton = document.getElementById('homeNoticeMoreBtn');

    if (!panel || !list || !empty || !footer || !moreButton) {
        return;
    }

    const scopeKey = homeNotificationState.activeTab === 'personal' ? 'personal' : 'all';
    const allItems = homeNotificationState.activeTab === 'personal'
        ? homeNotificationState.personal
        : homeNotificationState.all;
    const visibleCount = Math.max(0, homeNotificationState.visibleCounts[scopeKey] || 0);
    const items = allItems.slice(0, visibleCount);

    updateHomeNotificationTabs();
    refreshHomeNotificationUnreadState();
    updateHomeNotificationButton();
    panel.setAttribute('aria-hidden', homeNotificationState.open ? 'false' : 'true');

    if (!items.length) {
        list.innerHTML = '';
        footer.style.display = 'none';
        empty.style.display = '';
        empty.textContent = homeNotificationState.activeTab === 'personal'
            ? t('homeNoticeEmptyPersonal')
            : t('homeNoticeEmptyAll');
        return;
    }

    empty.style.display = 'none';
    list.innerHTML = items.map(item => {
        const read = isHomeNotificationRead(item);
        const scope = getHomeNotificationScopeKey(item.scope);
        const marker = getHomeNotificationMarker(item);
        const collapsible = shouldCollapseHomeNotificationBody(item);
        const expanded = isHomeNotificationExpanded(item);

        return `
        <article class="home-notice-item ${read ? 'read' : 'unread'}">
            <div class="home-notice-meta">
                <div class="home-notice-meta-actions">
                    <span class="home-notice-scope ${item.scope === 'personal' ? 'personal' : 'all'}">
                        ${item.scope === 'personal' ? escapeHomeNotificationHtml(t('homeNoticeScopePersonal')) : escapeHomeNotificationHtml(t('homeNoticeScopeAll'))}
                    </span>
                    ${read
                        ? `<span class="home-notice-read-state"><i class="fa-solid fa-check"></i>${escapeHomeNotificationHtml(t('homeNoticeRead'))}</span>`
                        : `<button class="home-notice-mark-read" type="button" data-home-notice-mark-read="true" data-home-notice-scope="${escapeHomeNotificationHtml(scope)}" data-home-notice-marker="${escapeHomeNotificationHtml(marker)}">${escapeHomeNotificationHtml(t('homeNoticeMarkRead'))}</button>`}
                </div>
                <time>${escapeHomeNotificationHtml(formatHomeNotificationDate(item.createTime))}</time>
            </div>
            <h3>${escapeHomeNotificationHtml(item.subject || '')}</h3>
            <p class="home-notice-body ${collapsible && !expanded ? 'collapsed' : ''}">${escapeHomeNotificationHtml(item.body || '')}</p>
            ${collapsible
                ? `<button class="home-notice-toggle-body" type="button" data-home-notice-toggle-body="true" data-home-notice-scope="${escapeHomeNotificationHtml(scope)}" data-home-notice-marker="${escapeHomeNotificationHtml(marker)}">${escapeHomeNotificationHtml(expanded ? t('homeNoticeCollapse') : t('homeNoticeExpand'))}</button>`
                : ''}
        </article>
    `;
    }).join('');

    const remaining = Math.max(0, allItems.length - items.length);
    if (remaining > 0) {
        footer.style.display = '';
        moreButton.textContent = `${t('homeNoticeShowMore')} (${remaining})`;
    } else {
        footer.style.display = 'none';
        moreButton.textContent = t('homeNoticeShowMore');
    }
}

function markHomeNotificationsSeen() {
    homeNotificationState.readMarkers = {
        all: [...homeNotificationState.currentMarkers.all],
        personal: [...homeNotificationState.currentMarkers.personal]
    };
    saveHomeNotificationReadState();
    refreshHomeNotificationUnreadState();
}

function markHomeNotificationRead(scope, marker) {
    const scopeKey = getHomeNotificationScopeKey(scope);
    if (!marker || homeNotificationState.readMarkers[scopeKey].includes(marker)) {
        return;
    }

    homeNotificationState.readMarkers[scopeKey] = pruneHomeNotificationReadMarkers({
        ...homeNotificationState.readMarkers,
        [scopeKey]: [...homeNotificationState.readMarkers[scopeKey], marker]
    })[scopeKey];
    saveHomeNotificationReadState();
    renderHomeNotifications();
}

function markAllHomeNotificationsRead() {
    markHomeNotificationsSeen();
    renderHomeNotifications();
}

function showMoreHomeNotifications() {
    const scope = homeNotificationState.activeTab === 'personal' ? 'personal' : 'all';
    const total = scope === 'personal' ? homeNotificationState.personal.length : homeNotificationState.all.length;
    homeNotificationState.visibleCounts[scope] = Math.min(
        total,
        (homeNotificationState.visibleCounts[scope] || HOME_NOTIFICATION_INITIAL_VISIBLE) + HOME_NOTIFICATION_VISIBLE_STEP
    );
    renderHomeNotifications();
}

function toggleHomeNotificationBody(scope, marker) {
    const scopeKey = getHomeNotificationScopeKey(scope);
    if (!marker) {
        return;
    }

    const current = homeNotificationState.expandedMarkers[scopeKey];
    homeNotificationState.expandedMarkers[scopeKey] = current.includes(marker)
        ? current.filter(item => item !== marker)
        : [...current, marker];
    renderHomeNotifications();
}

function openHomeNotificationsPanel(options = {}) {
    const panel = getHomeNotificationPanel();
    if (!panel) {
        return;
    }

    homeNotificationState.open = true;
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');

    renderHomeNotifications();
}

function closeHomeNotificationsPanel() {
    const panel = getHomeNotificationPanel();
    if (!panel) {
        return;
    }

    homeNotificationState.open = false;
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');

    if (homeNotificationState.hasUnread) {
        markHomeNotificationsSeen();
    }

    renderHomeNotifications();
}

function toggleHomeNotificationsPanel() {
    if (homeNotificationState.open) {
        closeHomeNotificationsPanel();
    } else {
        openHomeNotificationsPanel();
    }
}

function switchHomeNotificationTab(tab) {
    if (tab === 'personal' && !homeNotificationState.loggedIn) {
        return;
    }
    homeNotificationState.activeTab = tab === 'personal' ? 'personal' : 'all';
    const scope = homeNotificationState.activeTab;
    if (!homeNotificationState.visibleCounts[scope]) {
        const total = scope === 'personal' ? homeNotificationState.personal.length : homeNotificationState.all.length;
        homeNotificationState.visibleCounts[scope] = Math.min(total, HOME_NOTIFICATION_INITIAL_VISIBLE);
    }
    renderHomeNotifications();
}

function resolveHomeNotificationAutoOpenTab() {
    refreshHomeNotificationUnreadState();

    if (homeNotificationState.unreadCounts.personal > 0) {
        return 'personal';
    }

    if (homeNotificationState.unreadCounts.all > 0) {
        return 'all';
    }

    return null;
}

function bindHomeNotificationEvents() {
    if (homeNotificationState.eventsBound) {
        return;
    }

    const button = getHomeNotificationButton();
    const closeButton = getHomeNotificationCloseButton();
    const markAllButton = document.getElementById('homeNoticeMarkAllBtn');
    const moreButton = document.getElementById('homeNoticeMoreBtn');

    if (button) {
        button.addEventListener('click', event => {
            event.preventDefault();
            toggleHomeNotificationsPanel();
        });
    }

    if (closeButton) {
        closeButton.addEventListener('click', event => {
            event.preventDefault();
            closeHomeNotificationsPanel();
        });
    }

    if (markAllButton) {
        markAllButton.addEventListener('click', event => {
            event.preventDefault();
            markAllHomeNotificationsRead();
        });
    }

    if (moreButton) {
        moreButton.addEventListener('click', event => {
            event.preventDefault();
            showMoreHomeNotifications();
        });
    }

    document.addEventListener('click', event => {
        if (!homeNotificationState.open) {
            return;
        }

        const panel = getHomeNotificationPanel();
        const currentButton = getHomeNotificationButton();
        const target = event.target;

        if (panel && panel.contains(target)) {
            return;
        }

        if (currentButton && currentButton.contains(target)) {
            return;
        }

        closeHomeNotificationsPanel();
    });

    document.addEventListener('click', event => {
        const markReadButton = event.target.closest('[data-home-notice-mark-read="true"]');
        if (!markReadButton) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        markHomeNotificationRead(
            markReadButton.getAttribute('data-home-notice-scope'),
            markReadButton.getAttribute('data-home-notice-marker')
        );
    });

    document.addEventListener('click', event => {
        const toggleBodyButton = event.target.closest('[data-home-notice-toggle-body="true"]');
        if (!toggleBodyButton) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        toggleHomeNotificationBody(
            toggleBodyButton.getAttribute('data-home-notice-scope'),
            toggleBodyButton.getAttribute('data-home-notice-marker')
        );
    });

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && homeNotificationState.open) {
            closeHomeNotificationsPanel();
        }
    });

    document.addEventListener('quickshare:languagechange', () => {
        renderHomeNotifications();
    });

    homeNotificationState.eventsBound = true;
}

async function initHomeNotifications() {
    const panel = getHomeNotificationPanel();
    if (!panel) {
        return;
    }

    bindHomeNotificationEvents();
    homeNotificationState.loggedIn = typeof isLoggedIn === 'function' && isLoggedIn();
    homeNotificationState.activeTab = 'all';
    closeHomeNotificationsPanel();

    try {
        homeNotificationState.all = await fetchHomeNotifications('/public/notifications?limit=12');
    } catch (error) {
        console.warn('Failed to load global notifications:', error);
        homeNotificationState.all = [];
    }

    if (homeNotificationState.loggedIn) {
        try {
            homeNotificationState.personal = await fetchHomeNotifications('/notifications/personal?limit=12', true);
        } catch (error) {
            console.warn('Failed to load personal notifications:', error);
            homeNotificationState.personal = [];
        }
    } else {
        homeNotificationState.personal = [];
    }

    initializeHomeNotificationReadState();
    initializeHomeNotificationDisplayState();
    renderHomeNotifications();

    const autoOpenTab = resolveHomeNotificationAutoOpenTab();
    updateHomeNotificationButton();

    if (autoOpenTab) {
        homeNotificationState.activeTab = autoOpenTab;
        openHomeNotificationsPanel();
    }
}

window.switchHomeNotificationTab = switchHomeNotificationTab;
window.initHomeNotifications = initHomeNotifications;
window.toggleHomeNotificationsPanel = toggleHomeNotificationsPanel;
