/* global pdfjsLib, t */

const PDF_JS_WORKER_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.10.111/pdf.worker.min.js';

if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_JS_WORKER_SRC;
}

const viewerState = {
    pdfDoc: null,
    pageNum: 1,
    zoom: 1,
    fileUrl: '',
    downloadUrl: '',
    fileName: '',
    kind: 'pdf',
    renderTask: null,
    resizeTimer: null
};

function viewerEl(id) {
    return document.getElementById(id);
}

function viewerText(key, fallback) {
    return typeof t === 'function' ? t(key) : fallback;
}

function formatViewerText(key, values, fallback) {
    const template = viewerText(key, fallback);
    return Object.entries(values || {}).reduce((text, [name, value]) => {
        return text.replaceAll(`{${name}}`, String(value));
    }, template);
}

function updateViewerCopy() {
    viewerEl('viewerSourceHint').textContent = viewerState.kind === 'office'
        ? viewerText('pdfViewerOfficeSource', 'Office 文档已在服务端转换为 PDF 预览')
        : viewerText('pdfViewerPdfSource', 'PDF 预览');
    updateViewerToolbar();
}

function updateViewerToolbar() {
    const pageInfo = viewerState.pdfDoc
        ? formatViewerText('pdfViewerPageInfo', {
            page: viewerState.pageNum,
            total: viewerState.pdfDoc.numPages
        }, '第 {page} / {total} 页')
        : '- / -';

    viewerEl('viewerPageInfo').textContent = pageInfo;
    viewerEl('viewerZoomInfo').textContent = `${Math.round(viewerState.zoom * 100)}%`;
    viewerEl('prevPageBtn').disabled = !viewerState.pdfDoc || viewerState.pageNum <= 1;
    viewerEl('nextPageBtn').disabled = !viewerState.pdfDoc || viewerState.pageNum >= viewerState.pdfDoc.numPages;
    viewerEl('zoomOutBtn').disabled = viewerState.zoom <= 0.6;
    viewerEl('zoomInBtn').disabled = viewerState.zoom >= 2.4;
}

function setViewerStatus(message) {
    viewerEl('viewerStatus').textContent = message;
}

function setViewerDownloadLink() {
    const fallbackUrl = viewerState.fileUrl || '#';
    const targetUrl = viewerState.downloadUrl || fallbackUrl;
    viewerEl('downloadBtn').href = targetUrl;
    viewerEl('errorDownloadBtn').href = targetUrl;
}

async function parseViewerError(response) {
    const contentType = response.headers.get('Content-Type') || '';
    if (contentType.includes('application/json')) {
        try {
            const data = await response.json();
            if (data && typeof data.message === 'string' && data.message.trim()) {
                return data.message.trim();
            }
        } catch (error) {
            // ignore json parse failure and fall back to plain text
        }
    }

    try {
        const text = await response.text();
        if (text && text.trim()) {
            return text.trim();
        }
    } catch (error) {
        // ignore text parse failure
    }

    return viewerText('pdfViewerLoadFailed', 'PDF 预览加载失败');
}

function showViewerError(message) {
    viewerEl('viewerCanvasShell').style.display = 'none';
    viewerEl('viewerError').classList.add('active');
    viewerEl('viewerErrorText').textContent = message;
    setViewerStatus(message);
}

async function renderViewerPage() {
    if (!viewerState.pdfDoc) {
        return;
    }

    if (viewerState.renderTask && typeof viewerState.renderTask.cancel === 'function') {
        viewerState.renderTask.cancel();
    }

    const page = await viewerState.pdfDoc.getPage(viewerState.pageNum);
    const canvas = viewerEl('pdfCanvas');
    const shell = viewerEl('viewerCanvasShell');
    const context = canvas.getContext('2d');
    const baseViewport = page.getViewport({ scale: 1 });
    const availableWidth = Math.max(shell.clientWidth - 48, 320);
    const fitScale = availableWidth / baseViewport.width;
    const viewport = page.getViewport({ scale: fitScale * viewerState.zoom });
    const pixelRatio = window.devicePixelRatio || 1;

    canvas.width = Math.floor(viewport.width * pixelRatio);
    canvas.height = Math.floor(viewport.height * pixelRatio);
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;

    viewerState.renderTask = page.render({
        canvasContext: context,
        viewport,
        transform: pixelRatio === 1 ? null : [pixelRatio, 0, 0, pixelRatio, 0, 0]
    });

    try {
        await viewerState.renderTask.promise;
        setViewerStatus(formatViewerText('pdfViewerPageInfo', {
            page: viewerState.pageNum,
            total: viewerState.pdfDoc.numPages
        }, '第 {page} / {total} 页'));
        updateViewerToolbar();
    } catch (error) {
        if (error?.name !== 'RenderingCancelledException') {
            showViewerError(viewerText('pdfViewerLoadFailed', 'PDF 预览加载失败'));
        }
    }
}

async function loadViewerDocument() {
    const params = new URLSearchParams(window.location.search);
    viewerState.fileUrl = params.get('file') || '';
    viewerState.downloadUrl = params.get('download') || '';
    viewerState.fileName = params.get('name') || 'preview.pdf';
    viewerState.kind = params.get('kind') === 'office' ? 'office' : 'pdf';

    viewerEl('viewerTitle').textContent = viewerState.fileName;
    setViewerDownloadLink();
    updateViewerCopy();

    if (!viewerState.fileUrl) {
        showViewerError(viewerText('pdfViewerMissingFile', '缺少预览文件参数'));
        return;
    }

    setViewerStatus(viewerText('pdfViewerLoading', '正在加载 PDF 预览...'));

    try {
        const response = await fetch(viewerState.fileUrl, {
            credentials: 'same-origin'
        });
        if (!response.ok) {
            throw new Error(await parseViewerError(response));
        }

        const data = await response.arrayBuffer();
        const loadingTask = window.pdfjsLib.getDocument({ data });
        viewerState.pdfDoc = await loadingTask.promise;
        viewerState.pageNum = 1;
        viewerEl('viewerCanvasShell').style.display = 'flex';
        viewerEl('viewerError').classList.remove('active');
        await renderViewerPage();
    } catch (error) {
        showViewerError(error?.message || viewerText('pdfViewerLoadFailed', 'PDF 预览加载失败'));
    }
}

function bindViewerEvents() {
    viewerEl('prevPageBtn').addEventListener('click', async () => {
        if (!viewerState.pdfDoc || viewerState.pageNum <= 1) {
            return;
        }
        viewerState.pageNum -= 1;
        await renderViewerPage();
    });

    viewerEl('nextPageBtn').addEventListener('click', async () => {
        if (!viewerState.pdfDoc || viewerState.pageNum >= viewerState.pdfDoc.numPages) {
            return;
        }
        viewerState.pageNum += 1;
        await renderViewerPage();
    });

    viewerEl('zoomOutBtn').addEventListener('click', async () => {
        if (viewerState.zoom <= 0.6) {
            return;
        }
        viewerState.zoom = Math.max(0.6, Number((viewerState.zoom - 0.2).toFixed(1)));
        await renderViewerPage();
    });

    viewerEl('zoomInBtn').addEventListener('click', async () => {
        if (viewerState.zoom >= 2.4) {
            return;
        }
        viewerState.zoom = Math.min(2.4, Number((viewerState.zoom + 0.2).toFixed(1)));
        await renderViewerPage();
    });

    window.addEventListener('resize', () => {
        if (!viewerState.pdfDoc) {
            return;
        }

        clearTimeout(viewerState.resizeTimer);
        viewerState.resizeTimer = window.setTimeout(() => {
            renderViewerPage();
        }, 120);
    });

    document.addEventListener('quickshare:languagechange', updateViewerCopy);
}

document.addEventListener('DOMContentLoaded', async () => {
    bindViewerEvents();
    await loadViewerDocument();
});
