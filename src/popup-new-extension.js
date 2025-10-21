// 新版本弹窗逻辑 - 在扩展环境中运行，可以访问Chrome API
class RecordingOptionsUI {
    constructor() {
        this.selectedOption = '';
        this.init();
    }

    init() {
        this.bindEvents();
        this.testServiceWorker();
    }

    bindEvents() {
        // 录制选项选择
        const options = document.querySelectorAll('.recording-option');
        options.forEach(option => {
            option.addEventListener('click', (event) => {
                // 截图模式直接触发
                if (option.dataset.option === 'screenshot') {
                    event.preventDefault();
                    this.startScreenshot();
                    return;
                }
                this.selectOption(option.dataset.option);
            });
        });

        // 开始录制按钮
        const startButton = document.getElementById('startButton');
        startButton.addEventListener('click', () => {
            this.startRecording();
        });
    }

    selectOption(optionId) {
        // 移除之前的选择状态
        document.querySelectorAll('.recording-option').forEach(opt => {
            opt.classList.remove('selected');
        });

        // 设置新的选择状态
        const selectedElement = document.querySelector(`[data-option="${optionId}"]`);
        if (selectedElement) {
            selectedElement.classList.add('selected');
        }

        this.selectedOption = optionId;
        this.updateStartButton();
    }

    updateStartButton() {
        const startButton = document.getElementById('startButton');
        
        if (this.selectedOption) {
            startButton.disabled = false;
        } else {
            startButton.disabled = true;
        }
    }

    // 开始录制 - 在扩展环境中运行
    async startRecording() {
        if (!this.selectedOption) {
            console.log('No option selected');
            return;
        }

        try {
            console.log(`�� 开始${this.getOptionLabel(this.selectedOption)}...`);
            
            // 获取当前标签页
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            console.log('当前标签页:', tab);
            
            if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
                throw new Error(window.i18n ? window.i18n.t('ui.messages.pageNotSupported') : 'Current page does not support recording, please use on other web pages');
            }

            // 检查content script是否已经加载
            let contentScriptLoaded = false;
            try {
                const response = await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
                if (response === 'pong') {
                    console.log('✅ Content script 已加载');
                    contentScriptLoaded = true;
                }
            } catch (error) {
                console.log('⚠️ Content script 未加载，开始注入...');
                contentScriptLoaded = false;
            }

            // 如果content script未加载，尝试注入
            if (!contentScriptLoaded) {
                try {
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ['content_script.js']
                    });
                    console.log('✅ Content script 已注入');
                    
                    // 等待脚本加载完成
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    // 验证脚本是否真的加载了
                    try {
                        const verifyResponse = await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
                        if (verifyResponse === 'pong') {
                            console.log('✅ 脚本注入验证成功');
                            contentScriptLoaded = true;
                        } else {
                            throw new Error('脚本注入后无法响应ping消息');
                        }
                    } catch (verifyError) {
                        console.error('❌ 脚本注入验证失败:', verifyError);
                        throw new Error('脚本注入失败，请刷新页面重试');
                    }
                } catch (scriptError) {
                    console.error('❌ 脚本注入失败:', scriptError);
                    throw new Error('脚本注入失败，请检查扩展权限');
                }
            }

            // 发送录制指令到content script
            if (contentScriptLoaded) {
                try {
                    console.log('📤 发送录制指令...');
                    

                    
                    const recordingResponse = await chrome.tabs.sendMessage(tab.id, {
                        action: 'startRecording',
                        mode: this.selectedOption
                    });
                    
                    console.log('录制响应:', recordingResponse);
                    
                    if (recordingResponse && recordingResponse.success) {
                        console.log('✅ 录制指令发送成功');
                        // 关闭弹窗
                        window.close();
                    } else {
                        throw new Error(recordingResponse?.message || '录制启动失败');
                    }
                } catch (recordingError) {
                    console.error('❌ 录制启动失败:', recordingError);
                    throw new Error(`录制启动失败: ${recordingError.message}`);
                }
            } else {
                throw new Error('Content script 加载失败');
            }

        } catch (error) {
            console.error('❌ 录制启动失败:', error);
            alert(`录制启动失败: ${error.message}`);
        }
    }

    // 截图功能 - 在扩展环境中运行
    async startScreenshot() {
        try {
            console.log('📸 开始截图...');
            
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            console.log('当前标签页:', tab);
            
            if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
                throw new Error('当前页面不支持截图，请在其他网页上使用');
            }

            // 检查content script是否已经加载
            let contentScriptLoaded = false;
            try {
                const response = await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
                if (response === 'pong') {
                    console.log('✅ Content script 已加载');
                    contentScriptLoaded = true;
                }
            } catch (error) {
                console.log('⚠️ Content script 未加载，开始注入...');
                contentScriptLoaded = false;
            }

            // 如果content script未加载，尝试注入
            if (!contentScriptLoaded) {
                try {
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ['content_script.js']
                    });
                    console.log('✅ Content script 已注入');
                    
                    // 等待脚本加载完成
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    // 验证脚本是否真的加载了
                    try {
                        const verifyResponse = await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
                        if (verifyResponse === 'pong') {
                            console.log('✅ 脚本注入验证成功');
                            contentScriptLoaded = true;
                        } else {
                            throw new Error('脚本注入后无法响应ping消息');
                        }
                    } catch (verifyError) {
                        console.error('❌ 脚本注入验证失败:', verifyError);
                        throw new Error('脚本注入失败，请刷新页面重试');
                    }
                } catch (scriptError) {
                    console.error('❌ 脚本注入失败:', scriptError);
                    throw new Error('脚本注入失败，请检查扩展权限');
                }
            }

            // 注入新的截图脚本
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['screenshot-module-new-extension.js']
                });
                console.log('✅ 新版本截图脚本已注入');
                
                // 等待脚本加载
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // 验证新版本截图模块是否加载
                try {
                    const screenshotPing = await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
                    if (screenshotPing === 'pong') {
                        console.log('✅ 新版本截图模块验证成功');
                    } else {
                        throw new Error('新版本截图模块无法响应ping消息');
                    }
                } catch (pingError) {
                    console.error('❌ 新版本截图模块ping失败:', pingError);
                    throw new Error('新版本截图模块加载失败');
                }
                
                // 发送新版本截图指令
                console.log('📤 发送新版本截图指令...');
                const screenshotResponse = await chrome.tabs.sendMessage(tab.id, {
                    action: 'takeScreenshotNewExtension'
                });
                
                console.log('新版本截图响应:', screenshotResponse);
                
                if (screenshotResponse && screenshotResponse.success) {
                    console.log('✅ 新版本截图成功');
                    window.close();
                } else {
                    throw new Error(screenshotResponse?.message || '新版本截图失败');
                }
            } catch (scriptError) {
                console.error('❌ 新版本截图脚本注入失败:', scriptError);
                throw new Error('新版本截图功能初始化失败，请刷新页面重试');
            }

        } catch (error) {
            console.error('❌ 截图失败:', error);
            alert(`截图失败: ${error.message}`);
        }
    }



    getOptionLabel(optionId) {
        const labels = {
            'tab': 'Tab Recording',
            'region': 'Region Recording',
            'fullscreen': 'Full Screen',
            'screenshot': 'Region Screenshot'
        };
        return labels[optionId] || optionId;
    }

    // 测试Service Worker连接 - 在扩展环境中运行
    async testServiceWorker() {
        try {
            console.log('�� 测试Service Worker连接...');
            const response = await chrome.runtime.sendMessage({ action: 'ping' });
            console.log('✅ Service Worker connected:', response);
        } catch (error) {
            console.log('⚠️ Service Worker not available:', error);
        }
    }
}

// 初始化界面
document.addEventListener('DOMContentLoaded', () => {
    new RecordingOptionsUI();
});