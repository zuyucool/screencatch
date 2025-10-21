// 统一语言检测器
function getLanguage() {
    console.log('🌍 language-detector.js: getLanguage() 被调用');
    const browserLang = navigator.language || navigator.userLanguage;
    console.log('🌍 language-detector.js: 浏览器语言:', browserLang);
    
    if (browserLang.startsWith('zh')) {
        console.log('🌍 language-detector.js: 检测到中文，返回 zh');
        return 'zh';
    }
    
    console.log('🌍 language-detector.js: 检测到非中文，返回 en');
    return 'en';
}

// 导出函数
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getLanguage };
} else if (typeof window !== 'undefined') {
    window.getLanguage = getLanguage;
    console.log('🌍 language-detector.js: 已加载到window对象，getLanguage函数可用');
}