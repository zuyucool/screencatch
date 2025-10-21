// 国际化工具函数
class I18n {
  constructor() {
    // 使用统一语言检测
    this.currentLocale = typeof getLanguage === 'function' ? getLanguage() : 'en';
    this.messages = {};
    this.loaded = false;
  }

  // 设置当前语言
  setLocale(locale) {
    this.currentLocale = locale;
    this.loadMessages();
  }

  // 加载语言包
  async loadMessages() {
    try {
      const response = await fetch(chrome.runtime.getURL(`locales/${this.currentLocale}.json`));
      this.messages = await response.json();
      this.loaded = true;
      
      // 加载完成后自动更新页面标题
      this.updatePageTitle();
    } catch (error) {
      console.error('Failed to load language pack:', error);
          // 如果加载失败，使用默认英文
    this.currentLocale = 'en';
    this.loaded = false;
    
    // 加载完成后自动更新页面标题
    this.updatePageTitle();
    }
  }

  // 获取翻译文本
  t(key, params = {}) {
    if (!this.loaded) {
      return key; // 如果语言包未加载，返回key
    }

    const keys = key.split('.');
    let value = this.messages;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return key; // 如果找不到翻译，返回key
      }
    }

    // 替换参数
    if (typeof value === 'string' && params) {
      return value.replace(/\{(\w+)\}/g, (match, param) => {
        return params[param] || match;
      });
    }

    return value || key;
  }

  // 获取当前语言
  getCurrentLocale() {
    return this.currentLocale;
  }

  // 更新页面标题
  updatePageTitle(titleKey = 'ui.titles.exportPage') {
    if (this.loaded) {
      const title = this.t(titleKey);
      const titleElement = document.getElementById('pageTitle');
      if (titleElement) {
        titleElement.textContent = title;
      }
      // 同时更新document.title
      document.title = title;
    }
  }
}

// 创建全局实例
const i18n = new I18n();

// 初始化加载英文语言包
i18n.loadMessages();

// 导出实例
if (typeof module !== 'undefined' && module.exports) {
  module.exports = i18n;
} else {
  window.i18n = i18n;
}