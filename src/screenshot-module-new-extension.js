// ScreenCatch 截图功能模块 - 新版本，保持原有逻辑
// 独立模块，不影响现有录制功能

(function() {
    // 防止重复注入
    if (window.voiceCatchScreenshotNewExtensionLoaded) {
        console.log('⚠️ ScreenCatch 截图模块新版本已加载，跳过重复注入');
        return;
    }
    window.voiceCatchScreenshotNewExtensionLoaded = true;
    
    // 截图状态变量 - 使用独立命名空间
    let screenshotState = {
        isCapturing: false,
        selectedRegion: null,
        captureStartTime: null,
        screenshotData: null
    };
    
    // 截图配置参数
    const SCREENSHOT_CONFIG = {
        enabled: true,
        defaultFormat: 'png',
        quality: 0.9,
        maxSize: 10 * 1024 * 1024 // 10MB
    };
    
    // 基础截图功能 - 保持原有逻辑
    function takeScreenshot(region) {
        try {
            console.log('📸 开始截图新版本...');
            
            if (region) {
                // 如果传入了区域，直接截图
                console.log('📸 截图区域:', region);
                screenshotState.isCapturing = true;
                screenshotState.selectedRegion = region;
                screenshotState.captureStartTime = Date.now();
                captureScreenshotArea(region);
            } else {
                // 如果没有传入区域，启动区域选择
                console.log('📸 启动区域选择...');
                startDirectAreaSelection();
            }
            
        } catch (error) {
            console.error('❌ 截图失败:', error);
            screenshotState.isCapturing = false;
        }
    }
    
    // 直接区域选择功能 - 在当前页面实现
    function startDirectAreaSelection() {
        try {
            console.log('📸 启动直接区域选择...');
            
            // 创建选择覆盖层
            createSelectionOverlay();
            
            // 绑定鼠标事件
            bindSelectionEvents();
            
        } catch (error) {
            console.error('❌ 启动区域选择失败:', error);
            throw error;
        }
    }
    
    // 创建选择覆盖层
    function createSelectionOverlay() {
        // 移除已存在的覆盖层
        const existingOverlay = document.getElementById('voiceCatchScreenshotOverlay');
        if (existingOverlay) {
            existingOverlay.remove();
        }
        
        // 创建新的覆盖层
        const overlay = document.createElement('div');
        overlay.id = 'voiceCatchScreenshotOverlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.3);
            z-index: 999998;
            cursor: crosshair;
            user-select: none;
        `;
        
        // 创建选择框
        const selectionBox = document.createElement('div');
        selectionBox.id = 'voiceCatchSelectionBox';
        selectionBox.style.cssText = `
            position: absolute;
            border: 3px solid #fbbf24;
            background: rgba(251, 191, 36, 0.1);
            display: none;
            pointer-events: none;
            z-index: 999999;
        `;
        
        overlay.appendChild(selectionBox);
        document.body.appendChild(overlay);
        
        console.log('✅ 选择覆盖层已创建');
    }
    
    // 绑定选择事件
    function bindSelectionEvents() {
        const overlay = document.getElementById('voiceCatchScreenshotOverlay');
        const selectionBox = document.getElementById('voiceCatchSelectionBox');
        
        let startPoint = null;
        
        // 鼠标按下事件
        overlay.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return; // 只处理左键
            
            startPoint = { x: e.clientX, y: e.clientY };
            selectionBox.style.display = 'block';
            selectionBox.style.left = e.clientX + 'px';
            selectionBox.style.top = e.clientY + 'px';
            selectionBox.style.width = '0px';
            selectionBox.style.height = '0px';
            
            console.log('📸 开始选择区域:', startPoint);
        });
        
        // 鼠标移动事件
        overlay.addEventListener('mousemove', (e) => {
            if (!startPoint) return;
            
            const currentPoint = { x: e.clientX, y: e.clientY };
            const width = Math.abs(currentPoint.x - startPoint.x);
            const height = Math.abs(currentPoint.y - startPoint.y);
            
            selectionBox.style.width = width + 'px';
            selectionBox.style.height = height + 'px';
            
            // 调整位置
            if (currentPoint.x < startPoint.x) {
                selectionBox.style.left = currentPoint.x + 'px';
            }
            if (currentPoint.y < startPoint.y) {
                selectionBox.style.top = currentPoint.y + 'px';
            }
        });
        
        // 鼠标抬起事件
        overlay.addEventListener('mouseup', (e) => {
            if (!startPoint) return;
            
            const currentPoint = { x: e.clientX, y: e.clientY };
            const width = Math.abs(currentPoint.x - startPoint.x);
            const height = Math.abs(currentPoint.y - startPoint.y);
            
            console.log('📸 鼠标抬起，区域大小:', width, '×', height);
            
            // 如果区域太小，重置选择
            if (width < 10 || height < 10) {
                console.log('⚠️ 选择区域太小，重置选择');
                resetSelection();
                return;
            }
            
            // 记录选择的区域
            const left = parseInt(selectionBox.style.left) || 0;
            const top = parseInt(selectionBox.style.top) || 0;
            
            const selectedRegion = {
                x: left,
                y: top,
                width: width,
                height: height
            };
            
            console.log('📸 区域选择完成:', selectedRegion);
            
            // 清理选择界面
            cleanupSelection();
            
            // 开始截图
            screenshotState.isCapturing = true;
            screenshotState.selectedRegion = selectedRegion;
            screenshotState.captureStartTime = Date.now();
            
            // 截图并打开编辑界面
            captureAndEdit(selectedRegion);
        });
        
        // ESC键取消
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                resetSelection();
            }
        });
        
        console.log('✅ 选择事件已绑定');
    }
    
    // 重置选择
    function resetSelection() {
        const overlay = document.getElementById('voiceCatchScreenshotOverlay');
        const selectionBox = document.getElementById('voiceCatchSelectionBox');
        
        if (overlay) overlay.remove();
        if (selectionBox) selectionBox.remove();
        
        console.log('✅ 选择已重置');
    }
    
    // 清理选择界面
    function cleanupSelection() {
        const overlay = document.getElementById('voiceCatchScreenshotOverlay');
        if (overlay) overlay.remove();
        
        console.log('✅ 选择界面已清理');
    }
    
    // 截图并打开编辑界面
    async function captureAndEdit(region) {
        try {
            console.log('📸 开始截图并打开编辑界面...');
            
            // 实际捕获截图
            const screenshotData = await captureScreenshotArea(region);
            
            // 打开UI-2风格的截图编辑界面
            openScreenshotEditor(region);
            
        } catch (error) {
            console.error('❌ 截图并打开编辑界面失败:', error);
            screenshotState.isCapturing = false;
        }
    }
    
    // 显示截图 - 完全使用原有逻辑，在当前页面显示
    function openScreenshotEditor(region) {
        try {
            console.log('📸 准备显示截图...');
            
            // 完全使用原有逻辑：直接在当前页面显示截图
            // 不打开任何新窗口
            showScreenshotInCurrentPage(region);
            
        } catch (error) {
            console.error('❌ 显示截图失败:', error);
            screenshotState.isCapturing = false;
        }
    }
    
    // 在当前页面显示截图 - 打开完整的编辑界面
    function showScreenshotInCurrentPage(region) {
        try {
            console.log('📸 在当前页面显示截图...');
            
            // 打开完整的截图编辑界面
            openScreenshotEditor(region);
            
        } catch (error) {
            console.error('❌ 显示截图失败:', error);
        }
    }
    
    // 创建截图显示覆盖层 - 使用UI-2风格
    function createScreenshotOverlay(region) {
        // 移除已存在的截图覆盖层
        const existingOverlay = document.getElementById('voiceCatchScreenshotDisplayOverlay');
        if (existingOverlay) {
            existingOverlay.remove();
        }
        
        // 创建新的截图显示覆盖层
        const overlay = document.createElement('div');
        overlay.id = 'voiceCatchScreenshotDisplayOverlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.8);
            z-index: 999999;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
        `;
        
        // 创建截图显示容器 - UI-2风格
        const container = document.createElement('div');
        container.style.cssText = `
            background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
            border-radius: 20px;
            padding: 24px;
            max-width: 90vw;
            max-height: 90vh;
            overflow: auto;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            position: relative;
        `;
        
        // 创建标题
        const title = document.createElement('h2');
        title.textContent = '📸 截图预览';
        title.style.cssText = `
            color: white;
            margin: 0 0 20px 0;
            font-size: 24px;
            font-weight: 600;
            text-align: center;
        `;
        
        // 创建截图图片
        const image = document.createElement('img');
        image.src = screenshotState.screenshotData;
        image.style.cssText = `
            max-width: 100%;
            max-height: 100%;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
            background: white;
        `;
        
        // 创建关闭按钮 - UI-2风格
        const closeButton = document.createElement('button');
        closeButton.textContent = '关闭';
        closeButton.style.cssText = `
            position: absolute;
            top: 16px;
            right: 16px;
            background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
            color: white;
            border: none;
            border-radius: 8px;
            padding: 8px 16px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
            box-shadow: 0 4px 20px rgba(239, 68, 68, 0.3);
            transition: all 0.2s ease;
        `;
        
        // 添加悬停效果
        closeButton.addEventListener('mouseenter', () => {
            closeButton.style.transform = 'translateY(-2px)';
            closeButton.style.boxShadow = '0 8px 30px rgba(239, 68, 68, 0.4)';
        });
        
        closeButton.addEventListener('mouseleave', () => {
            closeButton.style.transform = 'translateY(0)';
            closeButton.style.boxShadow = '0 4px 20px rgba(239, 68, 68, 0.3)';
        });
        
        container.appendChild(title);
        container.appendChild(image);
        container.appendChild(closeButton);
        overlay.appendChild(container);
        document.body.appendChild(overlay);
        
        // 绑定关闭事件
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay || e.target === closeButton) {
                overlay.remove();
            }
        });
        
        console.log('✅ 截图显示覆盖层已创建（UI-2风格）');
    }
    
    // 打开完整的截图编辑界面
    function openScreenshotEditor(region) {
        try {
            console.log('🎨 打开完整的截图编辑界面...');
            
            // 创建编辑界面覆盖层
            const overlay = document.createElement('div');
            overlay.id = 'voiceCatchScreenshotEditorOverlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(0, 0, 0, 0.9);
                z-index: 999999;
                display: flex;
                align-items: center;
                justify-content: center;
            `;
            
            // 创建编辑界面容器
            const editorContainer = document.createElement('div');
            editorContainer.style.cssText = `
                width: 95vw;
                height: 95vh;
                background: transparent;
                border-radius: 20px;
                overflow: hidden;
                position: relative;
            `;
            
            // 创建iframe来加载编辑界面
            const editorFrame = document.createElement('iframe');
            editorFrame.src = chrome.runtime.getURL('screenshot-editor-new-extension.html');
            editorFrame.style.cssText = `
                width: 100%;
                height: 100%;
                border: none;
                border-radius: 20px;
                background: white;
            `;
            
            // 等待iframe加载完成后传递截图数据
            editorFrame.onload = () => {
                try {
                    // 通过postMessage传递截图数据
                    const message = {
                        type: 'screenshotData',
                        data: screenshotState.screenshotData,
                        region: region
                    };
                    editorFrame.contentWindow.postMessage(message, '*');
                    console.log('✅ 截图数据已发送到编辑界面');
                } catch (error) {
                    console.error('❌ 发送截图数据失败:', error);
                }
            };
            
            // 创建关闭按钮
            const closeButton = document.createElement('button');
            closeButton.innerHTML = '✕';
            closeButton.style.cssText = `
                position: absolute;
                top: 20px;
                right: 20px;
                width: 40px;
                height: 40px;
                background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                color: white;
                border: none;
                border-radius: 50%;
                cursor: pointer;
                font-size: 18px;
                font-weight: bold;
                box-shadow: 0 4px 20px rgba(239, 68, 68, 0.3);
                z-index: 1000000;
                display: flex;
                align-items: center;
                justify-content: center;
            `;
            
            closeButton.addEventListener('click', () => {
                overlay.remove();
            });
            
            editorContainer.appendChild(editorFrame);
            overlay.appendChild(editorContainer);
            overlay.appendChild(closeButton);
            document.body.appendChild(overlay);
            
            console.log('✅ 截图编辑界面已打开');
            
        } catch (error) {
            console.error('❌ 打开编辑界面失败:', error);
            // 如果失败，回退到简单的预览模式
            createScreenshotOverlay(region);
        }
    }
    
         // 截图核心逻辑 - 使用html2canvas捕获真实截图
     async function captureScreenshotArea(region) {
         try {
             console.log('📸 开始捕获截图区域...');
             
             // 验证区域参数
             if (!region || typeof region !== 'object') {
                 throw new Error('无效的区域参数');
             }
             
             console.log('📸 截图区域信息:', {
                 x: region.x || 0,
                 y: region.y || 0,
                 width: region.width || 0,
                 height: region.height || 0
             });
             
                           // 检查html2canvas是否已经加载（由service_worker.js预加载）
              if (typeof window.html2canvas !== 'undefined') {
                  console.log('✅ html2canvas已可用（由service_worker预加载），开始真实截图...');
                  
                                     try {
                                               // 尝试不同的截图策略
                        let canvas;
                        
                        // 策略1：直接截图整个body，然后裁剪
                        try {
                            console.log('📸 尝试策略1：截图整个body然后裁剪...');
                            canvas = await window.html2canvas(document.body, {
                                useCORS: false,
                                allowTaint: false,
                                backgroundColor: '#ffffff',
                                scale: 1,
                                logging: false,
                                removeContainer: true,
                                ignoreElements: (element) => {
                                    // 只忽略最危险的元素
                                    return element.tagName === 'IFRAME' || 
                                           (element.tagName === 'SCRIPT' && element.src && element.src.startsWith('http'));
                                },
                                onclone: (clonedDoc) => {
                                    // 移除外部脚本
                                    const scripts = clonedDoc.querySelectorAll('script[src]');
                                    scripts.forEach(script => {
                                        if (script.src && script.src.startsWith('http')) {
                                            script.remove();
                                        }
                                    });
                                    
                                    // 设置背景色
                                    clonedDoc.body.style.backgroundColor = '#ffffff';
                                }
                            });
                            
                            // 如果成功，创建裁剪后的canvas
                            if (canvas) {
                                console.log('📸 策略1成功，创建裁剪canvas...');
                                const croppedCanvas = document.createElement('canvas');
                                croppedCanvas.width = region.width;
                                croppedCanvas.height = region.height;
                                const ctx = croppedCanvas.getContext('2d');
                                
                                // 裁剪指定区域
                                ctx.drawImage(canvas, region.x, region.y, region.width, region.height, 0, 0, region.width, region.height);
                                canvas = croppedCanvas;
                            }
                            
                        } catch (error) {
                            console.warn('⚠️ 策略1失败，尝试策略2:', error);
                            
                            // 策略2：尝试截图特定元素
                            try {
                                console.log('📸 尝试策略2：截图特定元素...');
                                const targetElement = document.elementFromPoint(region.x + region.width/2, region.y + region.height/2);
                                if (targetElement && targetElement !== document.body) {
                                    canvas = await window.html2canvas(targetElement, {
                                        useCORS: false,
                                        allowTaint: false,
                                        backgroundColor: '#ffffff',
                                        scale: 1,
                                        logging: false
                                    });
                                }
                            } catch (error2) {
                                console.warn('⚠️ 策略2也失败:', error2);
                                throw error;
                            }
                        }
                      
                      // 转换为base64数据
                      const screenshotData = canvas.toDataURL('image/png');
                      
                      // 存储截图数据
                      screenshotState.screenshotData = screenshotData;
                      screenshotState.isCapturing = false;
                      
                      console.log('✅ 真实截图完成，数据长度:', screenshotData.length);
                      return screenshotData;
                      
                  } catch (html2canvasError) {
                      console.warn('⚠️ html2canvas截图失败，使用备用方案:', html2canvasError);
                      return await createFallbackScreenshot(region);
                  }
              }
              
              // 如果html2canvas不可用，请求service_worker注入
              console.log('📸 html2canvas不可用，请求service_worker注入...');
              
              try {
                  // 通过chrome.runtime.sendMessage请求注入html2canvas
                  const response = await new Promise((resolve, reject) => {
                      chrome.runtime.sendMessage({
                          action: 'injectHtml2Canvas'
                      }, (response) => {
                          if (chrome.runtime.lastError) {
                              reject(new Error(chrome.runtime.lastError.message));
                          } else if (response && response.success) {
                              resolve(response);
                          } else {
                              reject(new Error(response?.error || '注入失败'));
                          }
                      });
                  });
                  
                  console.log('✅ html2canvas注入成功:', response.message);
                  
                  // 等待一下让脚本初始化
                  await new Promise(resolve => setTimeout(resolve, 200));
                  
                  // 注入成功后，重新尝试截图
                  if (typeof window.html2canvas !== 'undefined') {
                      console.log('✅ html2canvas现在可用，重新尝试截图...');
                      return await captureScreenshotArea(region);
                  }
                  
              } catch (injectError) {
                  console.warn('⚠️ html2canvas注入失败，使用备用方案:', injectError);
              }
              
              // 如果所有尝试都失败，使用备用方案
              console.log('📸 使用备用截图方案...');
              return await createFallbackScreenshot(region);
             
         } catch (error) {
             console.error('❌ 截图捕获失败:', error);
             screenshotState.isCapturing = false;
             throw error;
         }
     }
     
     // 备用截图方案
     async function createFallbackScreenshot(region) {
         console.log('📸 使用备用截图方案...');
         
         const canvas = document.createElement('canvas');
         canvas.width = region.width;
         canvas.height = region.height;
         const ctx = canvas.getContext('2d');
         
         // 创建渐变背景
         const gradient = ctx.createLinearGradient(0, 0, region.width, region.height);
         gradient.addColorStop(0, '#fbbf24');
         gradient.addColorStop(1, '#f59e0b');
         ctx.fillStyle = gradient;
         ctx.fillRect(0, 0, region.width, region.height);
         
         // 添加文字
         ctx.fillStyle = 'white';
         ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
         ctx.textAlign = 'center';
         ctx.fillText('截图区域', region.width / 2, region.height / 2 - 20);
         ctx.font = '16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
         ctx.fillText(`${region.width} × ${region.height} 像素`, region.width / 2, region.height / 2 + 10);
         
         const screenshotData = canvas.toDataURL('image/png');
         screenshotState.screenshotData = screenshotData;
         screenshotState.isCapturing = false;
         
         console.log('✅ 备用截图完成，数据长度:', screenshotData.length);
         return screenshotData;
     }
    
    // 获取截图状态 - 保持原有逻辑
    function getScreenshotStatus() {
        return {
            success: true,
            isCapturing: screenshotState.isCapturing,
            selectedRegion: screenshotState.selectedRegion,
            startTime: screenshotState.captureStartTime
        };
    }
    
    // 导出函数到全局作用域 - 保持原有逻辑
    window.voiceCatchScreenshotNewExtension = {
        takeScreenshot,
        getScreenshotStatus,
        config: SCREENSHOT_CONFIG
    };
    
    // 添加消息监听器，响应来自popup的消息 - 保持原有逻辑
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            console.log('📸 截图模块新版本收到消息:', request?.action);
            
            if (request.action === 'takeScreenshotNewExtension') {
                try {
                    console.log('📸 开始截图新版本流程...');
                    takeScreenshot(request.region || null);
                    sendResponse({ success: true, message: '截图新版本流程已启动' });
                } catch (error) {
                    console.error('❌ 截图新版本流程启动失败:', error);
                    sendResponse({ success: false, error: error.message });
                }
            } else if (request.action === 'ping') {
                console.log('🏓 截图模块新版本ping响应');
                sendResponse('pong');
            }
            
            return true; // 保持消息通道开放
        });
        
        console.log('✅ 截图模块新版本消息监听器已注册');
    }
    
    console.log('✅ ScreenCatch 截图模块新版本已加载');
    
})();