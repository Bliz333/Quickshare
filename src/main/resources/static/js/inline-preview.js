/**
 * inline-preview.js — Shared inline file preview utility for QuickShare.
 *
 * Provides file-type detection and compact HTML rendering for inline previews
 * in transfer cards, receive modals, and any other context that needs a
 * lightweight file preview.
 *
 * Exposes window globals:
 *   getInlinePreviewKind(fileName, contentType)
 *   renderInlinePreviewHtml({ previewUrl, kind, fileName, maxWidth })
 *   cleanupInlinePreview(container)
 *   injectInlinePreviewStyles()
 */

(function () {
    'use strict';

    // ── File-type constants ─────────────────────────────────────────────

    var TEXT_EXTENSIONS = [
        'txt', 'md', 'markdown', 'csv', 'log', 'json', 'xml', 'yaml', 'yml',
        'properties', 'ini', 'conf', 'sql', 'sh', 'bat', 'java', 'js', 'ts',
        'tsx', 'jsx', 'css', 'html', 'htm'
    ];
    var TEXT_MIME_TYPES = [
        'application/json', 'application/xml', 'application/javascript',
        'application/x-javascript', 'application/yaml', 'application/x-yaml',
        'application/sql'
    ];
    var OFFICE_EXTENSIONS = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp'];
    var OFFICE_MIME_TYPES = [
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.oasis.opendocument.text',
        'application/vnd.oasis.opendocument.spreadsheet',
        'application/vnd.oasis.opendocument.presentation'
    ];

    var textExtSet = {};
    TEXT_EXTENSIONS.forEach(function (e) { textExtSet[e] = true; });
    var textMimeSet = {};
    TEXT_MIME_TYPES.forEach(function (m) { textMimeSet[m] = true; });
    var officeExtSet = {};
    OFFICE_EXTENSIONS.forEach(function (e) { officeExtSet[e] = true; });
    var officeMimeSet = {};
    OFFICE_MIME_TYPES.forEach(function (m) { officeMimeSet[m] = true; });

    // ── Helpers ─────────────────────────────────────────────────────────

    function normalizeExtension(fileName) {
        var raw = String(fileName || '').trim().toLowerCase();
        var dot = raw.lastIndexOf('.');
        if (dot < 0 || dot === raw.length - 1) return '';
        return raw.slice(dot + 1);
    }

    function normalizeContentType(contentType) {
        var v = String(contentType || '').trim().toLowerCase();
        if (!v) return '';
        var semi = v.indexOf(';');
        return semi >= 0 ? v.slice(0, semi).trim() : v;
    }

    function escapeAttr(s) {
        return String(s || '')
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    // ── Public: getInlinePreviewKind ────────────────────────────────────

    /**
     * Determine the preview kind for a file.
     * @param {string} fileName
     * @param {string} contentType
     * @returns {'image'|'video'|'audio'|'pdf'|'text'|'office'|null}
     */
    function getInlinePreviewKind(fileName, contentType) {
        var ext = normalizeExtension(fileName);
        var ct = normalizeContentType(contentType);

        if (ct.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].indexOf(ext) >= 0) {
            return 'image';
        }
        if (ct.startsWith('video/')) return 'video';
        if (ct.startsWith('audio/')) return 'audio';
        if (ct === 'application/pdf' || ext === 'pdf') return 'pdf';
        if (ct.startsWith('text/') || textMimeSet[ct] || textExtSet[ext]) return 'text';
        if (officeMimeSet[ct] || officeExtSet[ext]) return 'office';

        return null;
    }

    // ── Public: renderInlinePreviewHtml ──────────────────────────────────

    /**
     * Build inline preview HTML for a given file kind.
     * @param {{ previewUrl: string, kind: string, fileName: string, maxWidth?: number }} opts
     * @returns {string} HTML string
     */
    function renderInlinePreviewHtml(opts) {
        var url = opts.previewUrl || '';
        var kind = opts.kind || '';
        var name = opts.fileName || '';
        var maxW = opts.maxWidth || 400;
        var dlUrl = opts.downloadUrl || '';

        if (!url || !kind) return '';

        switch (kind) {
            case 'image':
                var imgSrc = url + (url.indexOf('?') >= 0 ? '&' : '?') + 'max_size=' + maxW;
                return '<div class="inline-preview-wrap inline-preview-image-wrap">'
                    + '<img class="inline-preview-img" src="' + escapeAttr(imgSrc) + '"'
                    + ' alt="' + escapeAttr(name) + '" loading="lazy"'
                    + ' onerror="this.closest(\'.inline-preview-wrap\').style.display=\'none\'"'
                    + ' onclick="this.closest(\'.inline-preview-wrap\').classList.toggle(\'zoomed\')"'
                    + ' />'
                    + '</div>';

            case 'audio':
                return '<div class="inline-preview-wrap inline-preview-audio-wrap">'
                    + '<audio class="inline-preview-audio" controls preload="metadata"'
                    + ' onerror="this.closest(\'.inline-preview-wrap\').style.display=\'none\'"'
                    + ' src="' + escapeAttr(url) + '"></audio>'
                    + '</div>';

            case 'video':
                return '<div class="inline-preview-wrap inline-preview-video-wrap">'
                    + '<video class="inline-preview-video" controls preload="metadata"'
                    + ' onerror="this.closest(\'.inline-preview-wrap\').style.display=\'none\'"'
                    + ' src="' + escapeAttr(url) + '"></video>'
                    + '</div>';

            case 'text':
                return '<div class="inline-preview-wrap inline-preview-text-wrap">'
                    + '<pre class="inline-preview-text" data-preview-url="' + escapeAttr(url) + '">…</pre>'
                    + '</div>';

            case 'pdf': {
                var viewerUrl = 'pdf-viewer.html?file=' + encodeURIComponent(url)
                    + '&download=' + encodeURIComponent(dlUrl || url)
                    + '&name=' + encodeURIComponent(name) + '&kind=pdf';
                return '<div class="inline-preview-wrap inline-preview-iframe-wrap">'
                    + '<iframe class="inline-preview-iframe" src="' + escapeAttr(viewerUrl) + '"'
                    + ' title="' + escapeAttr(name) + '"></iframe>'
                    + '</div>';
            }

            case 'office': {
                var viewerUrl2 = 'pdf-viewer.html?file=' + encodeURIComponent(url)
                    + '&download=' + encodeURIComponent(dlUrl || url)
                    + '&name=' + encodeURIComponent(name) + '&kind=office';
                return '<div class="inline-preview-wrap inline-preview-iframe-wrap">'
                    + '<iframe class="inline-preview-iframe" src="' + escapeAttr(viewerUrl2) + '"'
                    + ' title="' + escapeAttr(name) + '"></iframe>'
                    + '</div>';
            }

            default:
                return '';
        }
    }

    // ── Public: fillTextPreviews ─────────────────────────────────────────

    /**
     * Find all `[data-preview-url]` <pre> elements inside container and fetch
     * their text content. Safe to call after innerHTML has been set.
     * @param {HTMLElement} container
     */
    function fillTextPreviews(container) {
        if (!container) return;
        var pres = container.querySelectorAll('pre[data-preview-url]');
        for (var i = 0; i < pres.length; i++) {
            (function (pre) {
                var url = pre.getAttribute('data-preview-url');
                if (!url) return;
                fetch(url)
                    .then(function (r) { return r.ok ? r.text() : Promise.reject('fail'); })
                    .then(function (txt) { pre.textContent = txt; })
                    .catch(function () { pre.textContent = ''; });
            })(pres[i]);
        }
    }

    // ── Public: cleanupInlinePreview ─────────────────────────────────────

    /**
     * Revoke blob URLs and clear preview content.
     * @param {HTMLElement} container
     */
    function cleanupInlinePreview(container) {
        if (!container) return;
        var els = container.querySelectorAll('img[src^="blob:"], video[src^="blob:"], audio[src^="blob:"]');
        for (var i = 0; i < els.length; i++) {
            try { URL.revokeObjectURL(els[i].src); } catch (ignore) {}
        }
        container.innerHTML = '';
    }

    // ── Public: injectInlinePreviewStyles ────────────────────────────────

    var STYLE_ID = 'inline-preview-styles';

    function injectInlinePreviewStyles() {
        if (document.getElementById(STYLE_ID)) return;
        var style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = [
            '.inline-preview-wrap{width:100%;margin-top:8px;text-align:center;overflow:hidden;border-radius:12px}',
            '.inline-preview-image-wrap{cursor:zoom-in}',
            '.inline-preview-image-wrap.zoomed{cursor:zoom-out}',
            '.inline-preview-img{max-width:100%;max-height:200px;object-fit:contain;display:block;margin:0 auto;border-radius:12px;transition:max-height .3s ease}',
            '.inline-preview-image-wrap.zoomed .inline-preview-img{max-height:none}',
            '.inline-preview-video{max-width:100%;max-height:200px;border-radius:12px;display:block;margin:0 auto}',
            '.inline-preview-audio{width:100%;margin:4px 0}',
            '.inline-preview-text{width:100%;max-height:160px;overflow-y:auto;text-align:left;padding:10px 12px;border:1px solid var(--border,#e2e8f0);border-radius:10px;background:var(--bg,#f8fafc);color:var(--text,#0f172a);font-family:\'Outfit\',monospace;font-size:.8rem;line-height:1.55;white-space:pre-wrap;word-break:break-word;margin:0}',
            '.inline-preview-iframe{width:100%;height:200px;border:none;border-radius:12px}',
            '@media(max-width:580px){',
            '  .inline-preview-img,.inline-preview-video{max-height:160px}',
            '  .inline-preview-iframe{height:160px}',
            '}'
        ].join('\n');
        document.head.appendChild(style);
    }

    // ── Expose on window ─────────────────────────────────────────────────

    window.getInlinePreviewKind = getInlinePreviewKind;
    window.renderInlinePreviewHtml = renderInlinePreviewHtml;
    window.fillTextPreviews = fillTextPreviews;
    window.cleanupInlinePreview = cleanupInlinePreview;
    window.injectInlinePreviewStyles = injectInlinePreviewStyles;
})();
