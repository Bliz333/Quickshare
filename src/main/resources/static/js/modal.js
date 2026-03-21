(function () {
    const STYLE_ID = 'quickshare-modal-style';
    const ROOT_ID = 'quickshare-modal-root';
    const OPEN_CLASS = 'quickshare-modal-open';
    const VISIBLE_CLASS = 'is-visible';
    const CLOSING_CLASS = 'is-closing';

    const fallbackText = {
        zh: {
            alertTitle: '提示',
            confirmTitle: '请确认',
            promptTitle: '请输入',
            confirm: '确认',
            cancel: '取消',
            close: '关闭',
            copy: '复制',
            copied: '已复制',
            manualCopyTitle: '手动复制',
            manualCopyHelp: '系统没有拿到剪贴板权限，请在下面手动复制内容。'
        },
        en: {
            alertTitle: 'Notice',
            confirmTitle: 'Confirm',
            promptTitle: 'Input',
            confirm: 'Confirm',
            cancel: 'Cancel',
            close: 'Close',
            copy: 'Copy',
            copied: 'Copied',
            manualCopyTitle: 'Copy Manually',
            manualCopyHelp: 'Clipboard access was unavailable. Copy the content below manually.'
        }
    };

    const state = {
        queue: [],
        active: null
    };

    function getCurrentModalLanguage() {
        if (typeof getCurrentLanguage === 'function') {
            return getCurrentLanguage() === 'en' ? 'en' : 'zh';
        }

        const saved = localStorage.getItem('quickshare-lang');
        if (saved === 'en' || saved === 'zh') {
            return saved;
        }

        const htmlLang = document.documentElement.lang || '';
        if (htmlLang.toLowerCase().startsWith('en')) {
            return 'en';
        }

        return navigator.language && navigator.language.toLowerCase().startsWith('en') ? 'en' : 'zh';
    }

    function getLocalizedText(key) {
        if (typeof t === 'function') {
            try {
                const value = t(key);
                if (value && value !== key) {
                    return value;
                }
            } catch (error) {
                // Ignore and fall back to local strings.
            }
        }

        const lang = getCurrentModalLanguage();
        return fallbackText[lang][key] || fallbackText.zh[key] || key;
    }

    function escapeHtml(value) {
        const div = document.createElement('div');
        div.textContent = value == null ? '' : String(value);
        return div.innerHTML;
    }

    function ensureStyles() {
        if (document.getElementById(STYLE_ID)) {
            return;
        }

        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            html.${OPEN_CLASS},
            body.${OPEN_CLASS} {
                overflow: hidden;
            }

            .qs-modal-root {
                position: fixed;
                inset: 0;
                z-index: 2200;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: clamp(16px, 3vw, 32px);
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.28s ease;
            }

            .qs-modal-root.${VISIBLE_CLASS} {
                opacity: 1;
                pointer-events: auto;
            }

            .qs-modal-backdrop {
                position: absolute;
                inset: 0;
                background:
                    radial-gradient(circle at top, rgba(14, 165, 233, 0.18), transparent 42%),
                    rgba(15, 23, 42, 0.54);
                backdrop-filter: blur(14px) saturate(118%);
            }

            .qs-modal-shell {
                position: relative;
                width: min(540px, 100%);
                max-height: min(88vh, 760px);
                display: flex;
                flex-direction: column;
                gap: 18px;
                padding: 28px;
                border-radius: 28px;
                border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.55));
                background:
                    linear-gradient(180deg, rgba(255, 255, 255, 0.88), rgba(248, 250, 252, 0.94));
                background-color: var(--glass-bg, rgba(255, 255, 255, 0.92));
                color: var(--text-main, #0f172a);
                box-shadow: 0 34px 90px rgba(15, 23, 42, 0.24);
                backdrop-filter: blur(22px);
                transform: translateY(24px) scale(0.96);
                opacity: 0;
                transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.28s ease;
                overflow: hidden;
            }

            .dark-mode .qs-modal-shell {
                background:
                    linear-gradient(180deg, rgba(15, 23, 42, 0.88), rgba(30, 41, 59, 0.94));
                border-color: var(--glass-border, rgba(255, 255, 255, 0.14));
            }

            .qs-modal-root.${VISIBLE_CLASS} .qs-modal-shell {
                transform: translateY(0) scale(1);
                opacity: 1;
            }

            .qs-modal-root.${CLOSING_CLASS} .qs-modal-shell {
                transform: translateY(14px) scale(0.98);
                opacity: 0;
            }

            .qs-modal-glow {
                position: absolute;
                inset: -1px auto auto -1px;
                width: 180px;
                height: 180px;
                background: radial-gradient(circle, rgba(56, 189, 248, 0.3), transparent 72%);
                pointer-events: none;
            }

            .dark-mode .qs-modal-glow {
                background: radial-gradient(circle, rgba(129, 140, 248, 0.3), transparent 72%);
            }

            .qs-modal-close {
                position: absolute;
                top: 16px;
                right: 16px;
                width: 40px;
                height: 40px;
                border: 1px solid var(--border-color, rgba(148, 163, 184, 0.28));
                border-radius: 14px;
                background: rgba(255, 255, 255, 0.46);
                color: var(--text-sub, #64748b);
                display: inline-flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: transform 0.2s ease, border-color 0.2s ease, color 0.2s ease, background 0.2s ease;
            }

            .dark-mode .qs-modal-close {
                background: rgba(15, 23, 42, 0.56);
            }

            .qs-modal-close:hover {
                transform: translateY(-1px);
                color: var(--text-main, #0f172a);
                border-color: var(--primary, #0ea5e9);
                background: rgba(14, 165, 233, 0.1);
            }

            .qs-modal-header {
                position: relative;
                display: flex;
                align-items: flex-start;
                gap: 16px;
                padding-right: 44px;
            }

            .qs-modal-icon {
                width: 54px;
                height: 54px;
                flex-shrink: 0;
                border-radius: 18px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                font-size: 1.2rem;
                color: var(--primary-dark, #0284c7);
                background: rgba(14, 165, 233, 0.12);
                box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.38);
            }

            .dark-mode .qs-modal-icon {
                color: var(--primary-light, #818cf8);
                background: rgba(99, 102, 241, 0.16);
            }

            .qs-modal-shell[data-tone="danger"] .qs-modal-icon {
                color: var(--danger, #ef4444);
                background: rgba(239, 68, 68, 0.12);
            }

            .qs-modal-copy {
                min-width: 0;
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .qs-modal-title {
                margin: 0;
                font-size: 1.35rem;
                line-height: 1.2;
                font-weight: 700;
                color: var(--text-main, #0f172a);
            }

            .qs-modal-message {
                margin: 0;
                color: var(--text-sub, #64748b);
                font-size: 0.96rem;
                line-height: 1.75;
                white-space: pre-wrap;
            }

            .qs-modal-content {
                display: grid;
                gap: 14px;
            }

            .qs-modal-field {
                display: grid;
                gap: 8px;
            }

            .qs-modal-label {
                font-size: 0.82rem;
                font-weight: 600;
                color: var(--text-sub, #64748b);
            }

            .qs-modal-input,
            .qs-modal-textarea {
                width: 100%;
                border: 1px solid var(--border-color, #e2e8f0);
                border-radius: 18px;
                background: rgba(255, 255, 255, 0.64);
                color: var(--text-main, #0f172a);
                padding: 14px 16px;
                font-size: 0.95rem;
                line-height: 1.6;
                font-family: inherit;
                transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
            }

            .dark-mode .qs-modal-input,
            .dark-mode .qs-modal-textarea {
                background: rgba(15, 23, 42, 0.58);
            }

            .qs-modal-input:focus,
            .qs-modal-textarea:focus {
                outline: none;
                border-color: var(--primary, #0ea5e9);
                box-shadow: 0 0 0 4px rgba(14, 165, 233, 0.14);
            }

            .dark-mode .qs-modal-input:focus,
            .dark-mode .qs-modal-textarea:focus {
                box-shadow: 0 0 0 4px rgba(129, 140, 248, 0.18);
            }

            .qs-modal-textarea {
                min-height: 148px;
                resize: vertical;
            }

            .qs-modal-input[readonly],
            .qs-modal-textarea[readonly] {
                cursor: text;
            }

            .qs-modal-help {
                margin: 0;
                color: var(--text-sub, #64748b);
                font-size: 0.84rem;
                line-height: 1.7;
            }

            .qs-modal-note {
                display: flex;
                align-items: flex-start;
                gap: 10px;
                padding: 14px 16px;
                border-radius: 18px;
                border: 1px dashed rgba(14, 165, 233, 0.28);
                background: rgba(14, 165, 233, 0.06);
                color: var(--text-sub, #64748b);
                font-size: 0.88rem;
                line-height: 1.7;
            }

            .dark-mode .qs-modal-note {
                background: rgba(99, 102, 241, 0.08);
                border-color: rgba(129, 140, 248, 0.28);
            }

            .qs-modal-note i {
                color: var(--primary, #0ea5e9);
                margin-top: 2px;
            }

            .qs-modal-error {
                display: none;
                padding: 12px 14px;
                border-radius: 16px;
                background: rgba(239, 68, 68, 0.1);
                color: var(--danger, #ef4444);
                font-size: 0.88rem;
                line-height: 1.6;
                white-space: pre-wrap;
            }

            .qs-modal-error.show {
                display: block;
            }

            .qs-modal-actions {
                display: flex;
                justify-content: flex-end;
                gap: 12px;
                flex-wrap: wrap;
            }

            .qs-modal-btn {
                min-width: 108px;
                min-height: 44px;
                padding: 0 18px;
                border-radius: 999px;
                border: 1px solid var(--border-color, #e2e8f0);
                background: rgba(255, 255, 255, 0.58);
                color: var(--text-main, #0f172a);
                font-size: 0.94rem;
                font-weight: 600;
                font-family: inherit;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                cursor: pointer;
                transition: transform 0.2s ease, border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
            }

            .dark-mode .qs-modal-btn {
                background: rgba(15, 23, 42, 0.58);
            }

            .qs-modal-btn:hover:not(:disabled) {
                transform: translateY(-1px);
                border-color: var(--primary, #0ea5e9);
                background: rgba(14, 165, 233, 0.1);
            }

            .qs-modal-btn.primary {
                color: #fff;
                border-color: transparent;
                background: linear-gradient(135deg, var(--primary-light, #38bdf8), var(--primary, #0ea5e9));
                box-shadow: 0 14px 30px rgba(14, 165, 233, 0.24);
            }

            .qs-modal-btn.danger {
                color: #fff;
                border-color: transparent;
                background: linear-gradient(135deg, #f97316, var(--danger, #ef4444));
                box-shadow: 0 14px 30px rgba(239, 68, 68, 0.24);
            }

            .qs-modal-btn:disabled {
                opacity: 0.68;
                cursor: not-allowed;
                transform: none;
                box-shadow: none;
            }

            @media (max-width: 640px) {
                .qs-modal-shell {
                    width: 100%;
                    padding: 22px 18px 18px;
                    border-radius: 24px;
                }

                .qs-modal-header {
                    gap: 14px;
                }

                .qs-modal-icon {
                    width: 48px;
                    height: 48px;
                    border-radius: 16px;
                }

                .qs-modal-actions {
                    flex-direction: column-reverse;
                }

                .qs-modal-btn {
                    width: 100%;
                }
            }
        `;
        document.head.appendChild(style);
    }

    function ensureRoot() {
        let root = document.getElementById(ROOT_ID);
        if (root) {
            return root;
        }

        root = document.createElement('div');
        root.id = ROOT_ID;
        root.className = 'qs-modal-root';
        root.setAttribute('aria-hidden', 'true');
        root.innerHTML = `
            <div class="qs-modal-backdrop" data-modal-dismiss></div>
            <section class="qs-modal-shell" role="dialog" aria-modal="true" aria-labelledby="qsModalTitle">
                <div class="qs-modal-glow"></div>
                <button type="button" class="qs-modal-close" data-modal-dismiss aria-label="Close">
                    <i class="fa-solid fa-xmark"></i>
                </button>
                <header class="qs-modal-header">
                    <div class="qs-modal-icon" id="qsModalIcon">
                        <i class="fa-solid fa-circle-info"></i>
                    </div>
                    <div class="qs-modal-copy">
                        <h3 class="qs-modal-title" id="qsModalTitle"></h3>
                        <p class="qs-modal-message" id="qsModalMessage"></p>
                    </div>
                </header>
                <div class="qs-modal-content" id="qsModalContent"></div>
                <div class="qs-modal-error" id="qsModalError"></div>
                <div class="qs-modal-actions" id="qsModalActions"></div>
            </section>
        `;

        root.querySelector('.qs-modal-shell').addEventListener('click', (event) => {
            event.stopPropagation();
        });

        document.body.appendChild(root);
        return root;
    }

    function getRefs() {
        const root = ensureRoot();
        return {
            root,
            shell: root.querySelector('.qs-modal-shell'),
            icon: root.querySelector('#qsModalIcon'),
            title: root.querySelector('#qsModalTitle'),
            message: root.querySelector('#qsModalMessage'),
            content: root.querySelector('#qsModalContent'),
            error: root.querySelector('#qsModalError'),
            actions: root.querySelector('#qsModalActions')
        };
    }

    function defaultResult(kind) {
        if (kind === 'confirm') return false;
        if (kind === 'prompt') return null;
        return undefined;
    }

    function defaultTitle(kind) {
        if (kind === 'confirm') return getLocalizedText('confirmTitle');
        if (kind === 'prompt') return getLocalizedText('promptTitle');
        return getLocalizedText('alertTitle');
    }

    function defaultIcon(kind, tone) {
        if (tone === 'danger') return 'fa-triangle-exclamation';
        if (kind === 'confirm') return 'fa-circle-question';
        if (kind === 'prompt') return 'fa-keyboard';
        return 'fa-circle-info';
    }

    function normalizeConfig(kind, messageOrConfig, options) {
        const base = typeof messageOrConfig === 'object' && messageOrConfig !== null && !Array.isArray(messageOrConfig)
            ? { ...messageOrConfig }
            : { ...(options || {}), message: messageOrConfig };

        const config = {
            kind,
            title: base.title || defaultTitle(kind),
            message: base.message == null ? '' : String(base.message),
            confirmText: base.confirmText,
            cancelText: base.cancelText,
            tone: base.tone || (kind === 'confirm' ? 'default' : (base.tone || 'default')),
            icon: base.icon || defaultIcon(kind, base.tone),
            placeholder: base.placeholder || '',
            label: base.label || '',
            helpText: base.helpText || '',
            note: base.note || '',
            defaultValue: base.defaultValue == null ? '' : String(base.defaultValue),
            trim: base.trim !== false,
            multiline: !!base.multiline,
            readOnly: !!base.readOnly,
            inputType: base.inputType || 'text',
            hideCancel: typeof base.hideCancel === 'boolean' ? base.hideCancel : kind === 'alert',
            dismissible: typeof base.dismissible === 'boolean' ? base.dismissible : true,
            showCopyAction: !!base.showCopyAction,
            copyValue: base.copyValue == null ? '' : String(base.copyValue),
            copyText: base.copyText,
            selectOnOpen: !!base.selectOnOpen,
            validate: typeof base.validate === 'function' ? base.validate : null
        };

        if (!config.confirmText) {
            config.confirmText = kind === 'alert'
                ? getLocalizedText('close')
                : getLocalizedText('confirm');
        }

        if (!config.cancelText) {
            config.cancelText = getLocalizedText('cancel');
        }

        return config;
    }

    function updateError(refs, message) {
        refs.error.textContent = message || '';
        refs.error.classList.toggle('show', !!message);
    }

    function collectFocusableElements(container) {
        return Array.from(container.querySelectorAll('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'))
            .filter((element) => !element.hasAttribute('hidden') && element.offsetParent !== null);
    }

    function lockScroll() {
        document.documentElement.classList.add(OPEN_CLASS);
        document.body.classList.add(OPEN_CLASS);
    }

    function unlockScroll() {
        document.documentElement.classList.remove(OPEN_CLASS);
        document.body.classList.remove(OPEN_CLASS);
    }

    function finishActive(result) {
        if (!state.active) {
            return;
        }

        const active = state.active;
        const refs = active.refs;
        state.active = null;

        document.removeEventListener('keydown', active.keydownHandler, true);

        refs.root.classList.remove(VISIBLE_CLASS);
        refs.root.classList.add(CLOSING_CLASS);
        refs.root.setAttribute('aria-hidden', 'true');

        unlockScroll();

        window.setTimeout(() => {
            refs.root.classList.remove(CLOSING_CLASS);
            refs.root.style.pointerEvents = '';
            if (active.restoreFocus && typeof active.restoreFocus.focus === 'function') {
                active.restoreFocus.focus();
            }
            active.resolve(result);
            processQueue();
        }, 220);
    }

    function requestClose(result) {
        if (!state.active || state.active.closing) {
            return;
        }

        state.active.closing = true;
        finishActive(result);
    }

    async function copyText(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            return;
        }

        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.setAttribute('readonly', '');
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '0';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textArea);

        if (!success) {
            throw new Error('copy_failed');
        }
    }

    function renderPromptField(config, refs) {
        const wrapper = document.createElement('div');
        wrapper.className = 'qs-modal-field';

        if (config.label) {
            const label = document.createElement('label');
            label.className = 'qs-modal-label';
            label.textContent = config.label;
            wrapper.appendChild(label);
        }

        const input = document.createElement(config.multiline ? 'textarea' : 'input');
        input.className = config.multiline ? 'qs-modal-textarea' : 'qs-modal-input';
        if (!config.multiline) {
            input.type = config.inputType;
        }
        input.value = config.defaultValue;
        input.placeholder = config.placeholder;
        input.readOnly = config.readOnly;
        input.autocomplete = 'off';
        wrapper.appendChild(input);

        if (config.helpText) {
            const help = document.createElement('p');
            help.className = 'qs-modal-help';
            help.textContent = config.helpText;
            wrapper.appendChild(help);
        }

        refs.content.appendChild(wrapper);
        return input;
    }

    function renderNote(config, refs) {
        if (!config.note) {
            return;
        }

        const note = document.createElement('div');
        note.className = 'qs-modal-note';
        note.innerHTML = `<i class="fa-solid fa-sparkles"></i><span>${escapeHtml(config.note)}</span>`;
        refs.content.appendChild(note);
    }

    function buildActions(config, refs, inputEl) {
        const actions = [];

        if (config.showCopyAction) {
            const copyBtn = document.createElement('button');
            copyBtn.type = 'button';
            copyBtn.className = 'qs-modal-btn';
            copyBtn.innerHTML = `<i class="fa-solid fa-copy"></i><span>${escapeHtml(config.copyText || getLocalizedText('copy'))}</span>`;
            copyBtn.addEventListener('click', async () => {
                const value = config.copyValue || (inputEl ? inputEl.value : '');
                try {
                    await copyText(value);
                    copyBtn.disabled = true;
                    copyBtn.innerHTML = `<i class="fa-solid fa-check"></i><span>${escapeHtml(getLocalizedText('copied'))}</span>`;
                } catch (error) {
                    updateError(refs, getLocalizedText('manualCopyHelp'));
                }
            });
            actions.push(copyBtn);
        }

        if (!config.hideCancel) {
            const cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.className = 'qs-modal-btn';
            cancelBtn.innerHTML = `<span>${escapeHtml(config.cancelText)}</span>`;
            cancelBtn.addEventListener('click', () => {
                requestClose(defaultResult(config.kind));
            });
            actions.push(cancelBtn);
        }

        const confirmBtn = document.createElement('button');
        confirmBtn.type = 'button';
        confirmBtn.className = `qs-modal-btn ${config.tone === 'danger' ? 'danger' : 'primary'}`;
        confirmBtn.innerHTML = `<span>${escapeHtml(config.confirmText)}</span>`;
        confirmBtn.addEventListener('click', async () => {
            updateError(refs, '');

            let value = inputEl ? inputEl.value : '';
            if (inputEl && config.trim) {
                value = value.trim();
            }

            if (config.validate) {
                confirmBtn.disabled = true;
                try {
                    const validationResult = await config.validate(value);
                    if (validationResult) {
                        updateError(refs, validationResult);
                        confirmBtn.disabled = false;
                        if (inputEl) {
                            inputEl.focus();
                            if (typeof inputEl.select === 'function' && config.readOnly) {
                                inputEl.select();
                            }
                        }
                        return;
                    }
                } finally {
                    confirmBtn.disabled = false;
                }
            }

            if (config.kind === 'prompt') {
                requestClose(value);
                return;
            }

            if (config.kind === 'confirm') {
                requestClose(true);
                return;
            }

            requestClose(undefined);
        });
        actions.push(confirmBtn);

        actions.forEach((button) => refs.actions.appendChild(button));
    }

    function renderActive(item) {
        ensureStyles();
        const refs = getRefs();
        const config = item.config;

        refs.root.classList.remove(CLOSING_CLASS);
        refs.root.setAttribute('aria-hidden', 'false');
        refs.shell.dataset.tone = config.tone === 'danger' ? 'danger' : 'default';
        refs.icon.innerHTML = `<i class="fa-solid ${escapeHtml(config.icon)}"></i>`;
        refs.title.textContent = config.title;
        refs.message.textContent = config.message;
        refs.message.style.display = config.message ? '' : 'none';
        refs.content.innerHTML = '';
        refs.actions.innerHTML = '';
        updateError(refs, '');

        let inputEl = null;
        if (config.kind === 'prompt') {
            inputEl = renderPromptField(config, refs);
        }

        renderNote(config, refs);
        buildActions(config, refs, inputEl);

        const dismissButtons = refs.root.querySelectorAll('[data-modal-dismiss]');
        dismissButtons.forEach((element) => {
            element.onclick = () => {
                if (!config.dismissible) {
                    return;
                }
                requestClose(defaultResult(config.kind));
            };
        });

        const restoreFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

        const keydownHandler = (event) => {
            if (!state.active) {
                return;
            }

            if (event.key === 'Escape' && config.dismissible) {
                event.preventDefault();
                requestClose(defaultResult(config.kind));
                return;
            }

            if (event.key === 'Enter' && config.kind === 'prompt' && inputEl && !config.multiline) {
                if (event.target === inputEl) {
                    event.preventDefault();
                    refs.actions.querySelector('.qs-modal-btn.primary, .qs-modal-btn.danger')?.click();
                }
                return;
            }

            if (event.key !== 'Tab') {
                return;
            }

            const focusables = collectFocusableElements(refs.shell);
            if (focusables.length === 0) {
                event.preventDefault();
                return;
            }

            const first = focusables[0];
            const last = focusables[focusables.length - 1];

            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        state.active = {
            ...item,
            refs,
            keydownHandler,
            restoreFocus,
            closing: false
        };

        document.addEventListener('keydown', keydownHandler, true);
        lockScroll();

        requestAnimationFrame(() => {
            refs.root.classList.add(VISIBLE_CLASS);

            const initialFocus = inputEl || refs.actions.querySelector('.qs-modal-btn.primary, .qs-modal-btn.danger') || refs.actions.querySelector('.qs-modal-btn') || refs.shell;
            if (initialFocus && typeof initialFocus.focus === 'function') {
                initialFocus.focus();
            }

            if (inputEl && config.selectOnOpen && typeof inputEl.select === 'function') {
                inputEl.select();
            }
        });
    }

    function processQueue() {
        if (state.active || state.queue.length === 0) {
            return;
        }

        renderActive(state.queue.shift());
    }

    function enqueue(kind, messageOrConfig, options) {
        const config = normalizeConfig(kind, messageOrConfig, options);
        return new Promise((resolve) => {
            state.queue.push({ config, resolve });
            processQueue();
        });
    }

    window.QuickShareModal = {
        alert(message, options) {
            return enqueue('alert', message, options);
        },
        confirm(message, options) {
            return enqueue('confirm', message, options);
        },
        prompt(message, options) {
            return enqueue('prompt', message, options);
        },
        copyText(message, value, options = {}) {
            return enqueue('prompt', {
                ...options,
                title: options.title || getLocalizedText('manualCopyTitle'),
                message,
                defaultValue: value,
                copyValue: value,
                helpText: options.helpText || getLocalizedText('manualCopyHelp'),
                multiline: options.multiline !== false,
                readOnly: true,
                trim: false,
                selectOnOpen: true,
                hideCancel: options.hideCancel !== false ? true : options.hideCancel,
                confirmText: options.confirmText || getLocalizedText('close'),
                showCopyAction: options.showCopyAction !== false
            });
        }
    };

    window.showAppAlert = function (message, options) {
        return window.QuickShareModal.alert(message, options);
    };

    window.showAppConfirm = function (message, options) {
        return window.QuickShareModal.confirm(message, options);
    };

    window.showAppPrompt = function (message, options) {
        return window.QuickShareModal.prompt(message, options);
    };

    window.showAppCopyDialog = function (message, value, options) {
        return window.QuickShareModal.copyText(message, value, options);
    };
})();
