/**
 * config.js - 全局配置
 */

// API 基础地址
const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:8080/api'
    : `${window.location.protocol}//${window.location.host}/api`;

// 导出配置（如果需要模块化）
window.AppConfig = {
    API_BASE
};