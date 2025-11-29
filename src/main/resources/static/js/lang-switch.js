// 语言切换工具 - 在所有HTML文件中引入此文件

// 翻译字典
const translations = {
    // index.html 翻译
    index: {
        zh: {
            title: 'QuickShare - 快速文件分享',
            heading: '📦 QuickShare',
            subtitle: '快速、安全的文件分享平台',
            loginBtn: '登录',
            registerBtn: '注册',
            logoutBtn: '退出登录',
            welcome: '欢迎',
            uploadTab: '上传文件',
            downloadTab: '下载文件',
            uploadAreaText: '点击选择文件或拖拽文件到这里(支持多文件)',
            selectedFiles: '已选择的文件:',
            deleteBtn: '删除',
            extractCodeLabel: '提取码 (可选，不填则自动生成)',
            extractCodePlaceholder: '输入4位数字提取码，如: 1234',
            expireHoursLabel: '有效期 (小时，默认24小时)',
            expireHoursPlaceholder: '24',
            maxDownloadLabel: '最大下载次数 (不填则不限制)',
            maxDownloadPlaceholder: '如: 10',
            uploadAndShareBtn: '上传并生成分享链接',
            shareCodeLabel: '分享码',
            extractCodeLabel2: '提取码',
            downloadShareCodePlaceholder: '输入8位分享码',
            downloadExtractCodePlaceholder: '输入提取码',
            viewFileInfoBtn: '查看文件信息',
            fileInfoTitle: '📄 文件信息',
            fileName: '文件名:',
            expireTime: '过期时间:',
            remainingDownloads: '剩余下载次数:',
            downloadBtn: '下载文件',
            shareLinkGenerated: '✅ 分享链接已生成',
            shareLink: '分享链接:',
            shareCode: '分享码:',
            extractCode: '提取码:',
            copyBtn: '复制',
            copied: '✓ 已复制!',
            scanQRCode: '📱 扫码即可下载文件',
            saveQRCode: '💾 保存二维码',
            uploading: '⏳ 正在上传和生成分享链接...',
            permanentValid: '永久有效',
            unlimited: '不限制',
            fullShareLink: '完整分享链接:'
        },
        en: {
            title: 'QuickShare - Fast File Sharing',
            heading: '📦 QuickShare',
            subtitle: 'Fast and Secure File Sharing Platform',
            loginBtn: 'Login',
            registerBtn: 'Register',
            logoutBtn: 'Logout',
            welcome: 'Welcome',
            uploadTab: 'Upload',
            downloadTab: 'Download',
            uploadAreaText: 'Click to select files or drag files here (Multiple files supported)',
            selectedFiles: 'Selected files:',
            deleteBtn: 'Delete',
            extractCodeLabel: 'Extract Code (Optional, auto-generated if empty)',
            extractCodePlaceholder: 'Enter 4-digit code, e.g.: 1234',
            expireHoursLabel: 'Validity Period (hours, default 24 hours)',
            expireHoursPlaceholder: '24',
            maxDownloadLabel: 'Max Downloads (Leave empty for unlimited)',
            maxDownloadPlaceholder: 'e.g.: 10',
            uploadAndShareBtn: 'Upload and Generate Share Link',
            shareCodeLabel: 'Share Code',
            extractCodeLabel2: 'Extract Code',
            downloadShareCodePlaceholder: 'Enter 8-digit share code',
            downloadExtractCodePlaceholder: 'Enter extract code',
            viewFileInfoBtn: 'View File Info',
            fileInfoTitle: '📄 File Information',
            fileName: 'File Name:',
            expireTime: 'Expire Time:',
            remainingDownloads: 'Remaining Downloads:',
            downloadBtn: 'Download File',
            shareLinkGenerated: '✅ Share Link Generated',
            shareLink: 'Share Link:',
            shareCode: 'Share Code:',
            extractCode: 'Extract Code:',
            copyBtn: 'Copy',
            copied: '✓ Copied!',
            scanQRCode: '📱 Scan QR code to download',
            saveQRCode: '💾 Save QR Code',
            uploading: '⏳ Uploading and generating share link...',
            permanentValid: 'Permanent',
            unlimited: 'Unlimited',
            fullShareLink: 'Full Share Link:'
        }
    },
    // login.html 翻译
    login: {
        zh: {
            title: '登录 - QuickShare.NetDisk',
            heading: '📦 QuickShare.NetDisk',
            subtitle: '登录您的账户',
            backBtn: '← QuickShare.NetDisk',
            usernameLabel: '用户名',
            usernamePlaceholder: '请输入用户名',
            passwordLabel: '密码',
            passwordPlaceholder: '请输入密码',
            loginBtn: '登录',
            loggingIn: '登录中...',
            noAccount: '还没有账户?',
            registerLink: '立即注册'
        },
        en: {
            title: 'Login - QuickShare.NetDisk',
            heading: '📦 QuickShare.NetDisk',
            subtitle: 'Login to Your Account',
            backBtn: '← QuickShare.NetDisk',
            usernameLabel: 'Username',
            usernamePlaceholder: 'Enter username',
            passwordLabel: 'Password',
            passwordPlaceholder: 'Enter password',
            loginBtn: 'Login',
            loggingIn: 'Logging in...',
            noAccount: 'No account yet?',
            registerLink: 'Register Now'
        }
    },
    // register.html 翻译
    register: {
        zh: {
            title: '注册 - QuickShare.NetDisk',
            heading: '📦 QuickShare.NetDisk',
            subtitle: '创建您的账户',
            backBtn: '← QuickShare',
            usernameLabel: '用户名 *',
            usernamePlaceholder: '请输入用户名',
            usernameHint: '至少3个字符',
            passwordLabel: '密码 *',
            passwordPlaceholder: '请输入密码',
            passwordHint: '至少6个字符',
            confirmPasswordLabel: '确认密码 *',
            confirmPasswordPlaceholder: '请再次输入密码',
            emailLabel: '邮箱 *',
            emailPlaceholder: '请输入邮箱',
            sendCodeBtn: '发送验证码',
            verificationCodeLabel: '邮箱验证码 *',
            verificationCodePlaceholder: '请输入6位验证码',
            nicknameLabel: '昵称',
            nicknamePlaceholder: '请输入昵称(可选)',
            registerBtn: '注册',
            registering: '注册中...',
            hasAccount: '已有账户?',
            loginLink: '立即登录'
        },
        en: {
            title: 'Register - QuickShare.NetDisk',
            heading: '📦 QuickShare.NetDisk',
            subtitle: 'Create Your Account',
            backBtn: '← QuickShare',
            usernameLabel: 'Username *',
            usernamePlaceholder: 'Enter username',
            usernameHint: 'At least 3 characters',
            passwordLabel: 'Password *',
            passwordPlaceholder: 'Enter password',
            passwordHint: 'At least 6 characters',
            confirmPasswordLabel: 'Confirm Password *',
            confirmPasswordPlaceholder: 'Enter password again',
            emailLabel: 'Email *',
            emailPlaceholder: 'Enter email',
            sendCodeBtn: 'Send Code',
            verificationCodeLabel: 'Email Verification Code *',
            verificationCodePlaceholder: 'Enter 6-digit code',
            nicknameLabel: 'Nickname',
            nicknamePlaceholder: 'Enter nickname (optional)',
            registerBtn: 'Register',
            registering: 'Registering...',
            hasAccount: 'Already have an account?',
            loginLink: 'Login Now'
        }
    },
    // netdisk.html 翻译
    netdisk: {
        zh: {
            title: '我的网盘 - 📦 QuickShare.NetDisk',
            heading: '📦 QuickShare.NetDisk',
            sharePageBtn: '文件分享',
            logoutBtn: '退出登录',
            allFiles: '📁 全部文件',
            images: '🖼️ 图片',
            documents: '📄 文档',
            videos: '🎬 视频',
            audios: '🎵 音频',
            others: '📦 其他',
            uploadBtn: '⬆️ 上传文件',
            newFolderBtn: '📁 新建文件夹',
            sortByName: '按名称排序',
            sortByTime: '按时间排序',
            sortBySize: '按大小排序',
            sortByType: '按类型排序',
            allFilesPath: '全部文件',
            preview: '预览',
            name: '名称',
            size: '大小',
            modifiedTime: '修改时间',
            emptyStateTitle: '暂无文件',
            emptyStateText: '上传您的第一个文件吧!',
            shareBtn: '分享',
            downloadBtn: '下载',
            renameBtn: '重命名',
            deleteBtn: '删除',
            closeBtn: '×',
            unsupportedPreview: '😔 无法预览此文件类型',
            downloadFileBtn: '下载文件'
        },
        en: {
            title: 'My NetDisk - 📦 QuickShare.NetDisk',
            heading: '📦 QuickShare.NetDisk',
            sharePageBtn: 'File Sharing',
            logoutBtn: 'Logout',
            allFiles: '📁 All Files',
            images: '🖼️ Images',
            documents: '📄 Documents',
            videos: '🎬 Videos',
            audios: '🎵 Audios',
            others: '📦 Others',
            uploadBtn: '⬆️ Upload',
            newFolderBtn: '📁 New Folder',
            sortByName: 'Sort by Name',
            sortByTime: 'Sort by Time',
            sortBySize: 'Sort by Size',
            sortByType: 'Sort by Type',
            allFilesPath: 'All Files',
            preview: 'Preview',
            name: 'Name',
            size: 'Size',
            modifiedTime: 'Modified',
            emptyStateTitle: 'No Files',
            emptyStateText: 'Upload your first file!',
            shareBtn: 'Share',
            downloadBtn: 'Download',
            renameBtn: 'Rename',
            deleteBtn: 'Delete',
            closeBtn: '×',
            unsupportedPreview: '😔 Cannot preview this file type',
            downloadFileBtn: 'Download File'
        }
    }
};

// 获取当前语言
function getCurrentLanguage() {
    return localStorage.getItem('language') || 'zh';
}

// 设置当前语言
function setCurrentLanguage(lang) {
    localStorage.setItem('language', lang);
}

// 切换语言
function toggleLanguage() {
    const currentLang = getCurrentLanguage();
    const newLang = currentLang === 'zh' ? 'en' : 'zh';
    setCurrentLanguage(newLang);
    updatePageLanguage(newLang);
}

// 更新页面语言
function updatePageLanguage(lang) {
    const pageName = getPageName();
    const trans = translations[pageName];

    if (!trans || !trans[lang]) return;

    // 更新所有带 data-i18n 属性的元素
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (trans[lang][key]) {
            if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                if (element.placeholder !== undefined) {
                    element.placeholder = trans[lang][key];
                }
            } else {
                element.textContent = trans[lang][key];
            }
        }
    });

    // 更新页面标题
    if (trans[lang].title) {
        document.title = trans[lang].title;
    }

    // 更新语言切换按钮文本
    const langBtn = document.getElementById('langBtn');
    if (langBtn) {
        langBtn.textContent = lang === 'zh' ? 'EN' : '中文';
    }
}

// 获取当前页面名称
function getPageName() {
    const path = window.location.pathname;
    if (path.includes('login')) return 'login';
    if (path.includes('register')) return 'register';
    if (path.includes('netdisk')) return 'netdisk';
    return 'index';
}

// 初始化语言
function initLanguage() {
    const lang = getCurrentLanguage();
    updatePageLanguage(lang);
}

// 页面加载时初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLanguage);
} else {
    initLanguage();
}