/**
 * lang-switch.js - 语言切换（中/英）
 */

const LANG_STORAGE_KEY = 'quickshare-lang';

const i18n = {
    'zh': {
        title: 'QuickShare - 极速传送',
        heading: 'QuickShare',
        subtitle: '新一代安全文件分享',
        loginBtn: '登录',
        registerBtn: '注册账号',
        logout: '退出',
        myNetdisk: '网盘主页',
        logoutConfirm: '确定要退出登录吗?',
        uploadTab: '上传',
        downloadTab: '下载',
        uploadAreaText: '点击或拖拽文件至此',
        selectedFiles: '待上传列表:',
        extractCodeLabel: '提取码 (可选)',
        extractCodePlaceholder: '4-6位数字或字母',
        expireHoursLabel: '有效期 (小时)',
        maxDownloadLabel: '最大次数',
        maxDownloadPlaceholder: '无限制',
        uploadAndShareBtn: '开始上传并分享',
        shareCodeLabel: '分享码',
        downloadShareCodePlaceholder: '请输入8位分享码',
        extractCodeLabel2: '提取码 (如有)',
        downloadExtractCodePlaceholder: '请输入提取码',
        viewFileInfoBtn: '查看文件信息',
        fileInfoTitle: '文件详情',
        fileName: '文件名',
        expireTime: '过期时间',
        remainingDownloads: '剩余次数',
        downloadBtn: '立即下载',
        shareSuccess: '文件分享成功!',
        shareCode: '分享码',
        fullLink: '完整链接 (一键访问)',
        extractCode: '提取码',
        scanToAccess: '扫描二维码直达',
        copied: '已复制',
        copy: '复制',
        none: '无需提取码',
        manualCopy: '复制失败，请长按文字手动复制',
        copyError: '内部错误：无法找到文本元素',
        fetching: '正在获取文件信息...',
        fetchError: '获取失败',
        extractCodeError: '提取码错误或必填',
        neverExpires: '永久有效',
        unlimited: '无限制',
        processing: '处理中...',
        uploading: '正在上传',
        fileInfoSuccess: '文件信息获取成功!',
        downloading: '下载中...',
        downloadLimitReached: '下载次数已用完',
        loginPageTitle: '登录 - QuickShare',
        loginTitle: '欢迎回来',
        loginSubtitle: '欢迎回来，请登录您的账号',
        usernameLabel: '用户名',
        usernamePlaceholder: '请输入用户名',
        passwordLabel: '密码',
        passwordPlaceholder: '请输入密码',
        rememberMe: '记住我',
        forgotPassword: '忘记密码?',
        loginSubmit: '登录',
        noAccount: '还没有账号？',
        registerNow: '立即注册',
        backHome: '返回首页',
        or: '或',
        missingCredentials: '请输入用户名和密码',
        loggingIn: '登录中...',
        loginSuccess: '登录成功！跳转中...',
        loginFailed: '登录失败',
        registerPageTitle: '注册 - QuickShare',
        registerTitle: '创建账号',
        registerSubtitle: '加入 QuickShare，开始分享',
        regUsernamePlaceholder: '请输入用户名',
        usernameHint: '至少 3 个字符',
        regPasswordPlaceholder: '至少6位',
        confirmPasswordLabel: '确认密码',
        confirmPasswordPlaceholder: '再次输入',
        emailLabel: '邮箱',
        emailPlaceholder: 'your@email.com',
        sendCodeBtn: '发送验证码',
        verificationCodeLabel: '验证码',
        verificationCodePlaceholder: '6位数字验证码',
        nicknameLabel: '昵称 (可选)',
        nicknamePlaceholder: '显示名称',
        registerSubmit: '注册',
        hasAccount: '已有账号？',
        loginNow: '立即登录',
        emailRequired: '请填写邮箱',
        captchaRequired: '请完成人机验证',
        codeSent: '验证码已发送',
        sendCodeFailed: '发送失败',
        passwordMismatch: '两次密码不一致',
        passwordTooShort: '密码至少6位',
        registering: '注册中...',
        registerSuccess: '注册成功！',
        registerFailed: '注册失败',
        netdiskPageTitle: '我的网盘 - QuickShare',
        allFiles: '全部文件',
        images: '图片',
        documents: '文档',
        videos: '视频',
        audios: '音频',
        others: '其他',
        uploadBtn: '上传文件',
        newFolderBtn: '新建文件夹',
        sortByName: '按名称排序',
        sortByTime: '按时间排序',
        sortBySize: '按大小排序',
        sortByType: '按类型排序',
        allFilesPath: '全部文件',
        name: '名称',
        size: '大小',
        modifiedTime: '修改时间',
        actions: '操作',
        emptyStateTitle: '暂无文件',
        emptyStateText: '上传您的第一个文件吧!',
        emptyFolderTitle: '空文件夹',
        emptyFolderText: '这个文件夹里还没有内容',
        shareBtn: '分享',
        renameBtn: '重命名',
        deleteBtn: '删除',
        openBtn: '打开',
        items: '项',
        folder: '文件夹',
        confirmDelete: '确定删除',
        enterFolderName: '请输入文件夹名称:',
        enterNewName: '请输入新名称:',
        setValidDays: '设置有效期（天数）：\n1 = 1天\n7 = 7天\n30 = 30天\n-1 = 永久',
        setExtractCode: '设置提取码（选填，最多6位）：',
        uploadSuccess: '上传成功！',
        uploadFailed: '上传失败',
        deleteSuccess: '删除成功',
        deleteFailed: '删除失败',
        renameSuccess: '重命名成功',
        renameFailed: '重命名失败',
        folderCreateSuccess: '文件夹创建成功！',
        folderCreateFailed: '创建失败',
        linkCopied: '链接已复制！',
        shareFailed: '分享失败',
        cannotPreview: '该文件类型不支持预览',
        readFailed: '读取失败',
        viewOriginal: '查看原图',
        searchPlaceholder: '搜索文件...',
        searchResults: '搜索结果',
        noSearchResults: '未找到匹配的文件',
        tryOtherKeywords: '尝试其他关键词',
        fileTransfer: '文件传输',
        clearCompleted: '清除已完成',
        noTransferTask: '暂无传输任务',
        downloadComplete: '下载完成',
        transferCancelled: '已取消',
        transferFailed: '传输失败',
        downloadFailed: '下载失败',
        emptyCategoryTitle: '该分类暂无文件',
        emptyCategoryText: '上传对应类型的文件后会显示在这里',
        foldersAndFiles: '文件夹和文件',
        createSuccess: '创建成功',
        loginRequired: '请先登录',
        loginExpired: '登录已过期，请重新登录',
        lightMode: '切换到浅色模式',
        darkMode: '切换到暗黑模式'
    },
    'en': {
        title: 'QuickShare - Fast Transfer',
        heading: 'QuickShare',
        subtitle: 'Next-Gen Secure File Sharing',
        loginBtn: 'Login',
        registerBtn: 'Register',
        logout: 'Logout',
        myNetdisk: 'My Netdisk',
        logoutConfirm: 'Are you sure you want to log out?',
        uploadTab: 'Upload',
        downloadTab: 'Download',
        uploadAreaText: 'Click or drag files here',
        selectedFiles: 'Files to Upload:',
        extractCodeLabel: 'Access Code (Optional)',
        extractCodePlaceholder: '4-6 digits or letters',
        expireHoursLabel: 'Expires in (Hours)',
        maxDownloadLabel: 'Max Downloads',
        maxDownloadPlaceholder: 'Unlimited',
        uploadAndShareBtn: 'Upload and Share',
        shareCodeLabel: 'Share Code',
        downloadShareCodePlaceholder: 'Enter 8-digit share code',
        extractCodeLabel2: 'Access Code (If required)',
        downloadExtractCodePlaceholder: 'Enter access code',
        viewFileInfoBtn: 'View File Info',
        fileInfoTitle: 'File Details',
        fileName: 'File Name',
        expireTime: 'Expires',
        remainingDownloads: 'Remaining Downloads',
        downloadBtn: 'Download Now',
        shareSuccess: 'Files shared successfully!',
        shareCode: 'Share Code',
        fullLink: 'Full Link (Auto-Fill)',
        extractCode: 'Access Code',
        scanToAccess: 'Scan to access',
        copied: 'Copied',
        copy: 'Copy',
        none: 'None',
        manualCopy: 'Copy failed. Please long press to copy',
        copyError: 'Internal error: Could not find text element',
        fetching: 'Fetching file info...',
        fetchError: 'Failed to fetch',
        extractCodeError: 'Access code required or invalid',
        neverExpires: 'Never',
        unlimited: 'Unlimited',
        processing: 'Processing...',
        uploading: 'Uploading',
        fileInfoSuccess: 'File info retrieved!',
        downloading: 'Downloading...',
        downloadLimitReached: 'Download limit reached',
        loginPageTitle: 'Login - QuickShare',
        loginTitle: 'Welcome Back',
        loginSubtitle: 'Welcome back! Please sign in to your account',
        usernameLabel: 'Username',
        usernamePlaceholder: 'Enter your username',
        passwordLabel: 'Password',
        passwordPlaceholder: 'Enter your password',
        rememberMe: 'Remember me',
        forgotPassword: 'Forgot password?',
        loginSubmit: 'Sign In',
        noAccount: "Don't have an account?",
        registerNow: 'Register now',
        backHome: 'Back to Home',
        or: 'or',
        missingCredentials: 'Please enter username and password',
        loggingIn: 'Signing in...',
        loginSuccess: 'Login successful! Redirecting...',
        loginFailed: 'Login failed',
        registerPageTitle: 'Register - QuickShare',
        registerTitle: 'Create Account',
        registerSubtitle: 'Join QuickShare and start sharing',
        regUsernamePlaceholder: 'Enter username',
        usernameHint: 'At least 3 characters',
        regPasswordPlaceholder: 'Min 6 chars',
        confirmPasswordLabel: 'Confirm Password',
        confirmPasswordPlaceholder: 'Re-enter password',
        emailLabel: 'Email',
        emailPlaceholder: 'your@email.com',
        sendCodeBtn: 'Send Code',
        verificationCodeLabel: 'Verification Code',
        verificationCodePlaceholder: '6-digit code',
        nicknameLabel: 'Nickname (Optional)',
        nicknamePlaceholder: 'Display name',
        registerSubmit: 'Register',
        hasAccount: 'Already have an account?',
        loginNow: 'Sign in now',
        emailRequired: 'Email is required',
        captchaRequired: 'Please complete the captcha',
        codeSent: 'Code sent!',
        sendCodeFailed: 'Failed to send code',
        passwordMismatch: 'Passwords do not match',
        passwordTooShort: 'Password must be at least 6 characters',
        registering: 'Registering...',
        registerSuccess: 'Registration successful!',
        registerFailed: 'Registration failed',
        netdiskPageTitle: 'My NetDisk - QuickShare',
        allFiles: 'All Files',
        images: 'Images',
        documents: 'Documents',
        videos: 'Videos',
        audios: 'Audios',
        others: 'Others',
        uploadBtn: 'Upload File',
        newFolderBtn: 'New Folder',
        sortByName: 'Sort by Name',
        sortByTime: 'Sort by Time',
        sortBySize: 'Sort by Size',
        sortByType: 'Sort by Type',
        allFilesPath: 'All Files',
        name: 'Name',
        size: 'Size',
        modifiedTime: 'Modified',
        actions: 'Actions',
        emptyStateTitle: 'No Files',
        emptyStateText: 'Upload your first file!',
        emptyFolderTitle: 'Empty Folder',
        emptyFolderText: 'This folder is empty',
        shareBtn: 'Share',
        renameBtn: 'Rename',
        deleteBtn: 'Delete',
        openBtn: 'Open',
        items: 'items',
        folder: 'Folder',
        confirmDelete: 'Confirm delete',
        enterFolderName: 'Enter folder name:',
        enterNewName: 'Enter new name:',
        setValidDays: 'Set validity period (days):\n1 = 1 day\n7 = 7 days\n30 = 30 days\n-1 = Permanent',
        setExtractCode: 'Set extract code (optional, max 6 characters):',
        uploadSuccess: 'Upload successful!',
        uploadFailed: 'Upload failed',
        deleteSuccess: 'Delete successful',
        deleteFailed: 'Delete failed',
        renameSuccess: 'Rename successful',
        renameFailed: 'Rename failed',
        folderCreateSuccess: 'Folder created successfully!',
        folderCreateFailed: 'Creation failed',
        linkCopied: 'Link copied!',
        shareFailed: 'Share failed',
        cannotPreview: 'This file type cannot be previewed',
        readFailed: 'Read failed',
        viewOriginal: 'View Original',
        searchPlaceholder: 'Search files...',
        searchResults: 'Search Results',
        noSearchResults: 'No matching files found',
        tryOtherKeywords: 'Try different keywords',
        fileTransfer: 'File Transfer',
        clearCompleted: 'Clear Completed',
        noTransferTask: 'No transfer tasks',
        downloadComplete: 'Download complete',
        transferCancelled: 'Cancelled',
        transferFailed: 'Transfer failed',
        downloadFailed: 'Download failed',
        emptyCategoryTitle: 'No files in this category',
        emptyCategoryText: 'Files of this type will appear here after upload',
        foldersAndFiles: 'Folders and Files',
        createSuccess: 'Success',
        loginRequired: 'Please login first',
        loginExpired: 'Session expired, please login again',
        lightMode: 'Switch to light mode',
        darkMode: 'Switch to dark mode'
    }
};

let currentLang = 'zh';

function getCurrentLanguage() {
    return currentLang;
}

function t(key) {
    return i18n[currentLang][key] || i18n['zh'][key] || key;
}

function setLanguage(lang) {
    currentLang = lang;
    localStorage.setItem(LANG_STORAGE_KEY, lang);

    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        const translation = i18n[lang][key] || i18n['zh'][key];

        if (!translation) return;

        if (element.tagName === 'TITLE') {
            document.title = translation;
        } else if (element.tagName === 'INPUT' && element.hasAttribute('placeholder')) {
            element.placeholder = translation;
        } else {
            const icon = element.querySelector('i');
            if (icon) {
                element.innerHTML = `${icon.outerHTML} ${translation}`;
            } else {
                element.textContent = translation;
            }
        }
    });

    const langBtn = document.getElementById('langBtn');
    if (langBtn) {
        langBtn.textContent = lang === 'zh' ? 'EN' : '简';
    }

    if (typeof checkLoginState === 'function') {
        checkLoginState();
    }

    document.querySelectorAll('.qrcode-hint').forEach(hint => {
        const icon = hint.querySelector('i');
        if (icon) {
            hint.innerHTML = `${icon.outerHTML} ${t('scanToAccess')}`;
        } else {
            hint.textContent = t('scanToAccess');
        }
    });

    document.querySelectorAll('.copy-btn-text').forEach(btn => {
        btn.textContent = t('copy');
    });

    // 更新搜索框
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.placeholder = t('searchPlaceholder');
    }

    // 更新文件列表标题
    const currentViewTitle = document.getElementById('currentViewTitle');
    if (currentViewTitle && (!searchInput || !searchInput.value.trim())) {
        currentViewTitle.textContent = t('foldersAndFiles');
    }

    // ============ 新增：更新传输面板文本 ============
    updateTransferPanelLanguage();
}
/**
 * 更新传输面板的语言文本
 */
function updateTransferPanelLanguage() {
    // 更新面板标题
    const title = document.getElementById('transferPanelTitle');
    if (title) {
        title.textContent = t('fileTransfer');
    }

    // 更新清除按钮
    const clearBtn = document.getElementById('clearCompletedBtn');
    if (clearBtn) {
        clearBtn.textContent = t('clearCompleted');
    }

    // 更新空状态文本
    const transferEmpty = document.getElementById('transferEmpty');
    if (transferEmpty) {
        const pElement = transferEmpty.querySelector('p');
        if (pElement) {
            pElement.textContent = t('noTransferTask');
        }
    }

    // 如果有传输任务，重新渲染列表以更新状态文本
    if (typeof TransferManager !== 'undefined' && TransferManager.tasks && TransferManager.tasks.length > 0) {
        TransferManager.renderList();
    }
}
function toggleLanguage() {
    const newLang = currentLang === 'zh' ? 'en' : 'zh';
    setLanguage(newLang);
}

function initLanguage() {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    if (saved === 'zh' || saved === 'en') {
        currentLang = saved;
    } else {
        currentLang = navigator.language.startsWith('en') ? 'en' : 'zh';
    }
    setLanguage(currentLang);
}

document.addEventListener('DOMContentLoaded', initLanguage);