// ScreenCatch 截图编辑工具 - 使用原有功能逻辑，新UI界面
console.log('🌍 screenshot-editor-new-extension.js 开始加载...');

class ScreenshotEditorNewExtension {
    constructor() {
        // 🌍 检查语言检测器是否可用
        console.log('🌍 构造函数开始，检查getLanguage函数:');
        console.log('🌍 window.getLanguage存在:', typeof window.getLanguage === 'function');
        console.log('🌍 全局getLanguage存在:', typeof getLanguage === 'function');
        
        // 使用原有的状态管理变量 - 确保没有默认激活的工具
        this.currentActiveTool = null;
        this.currentCanvas = null;
        this.currentCtx = null;
        this.isDrawing = false;
        this.drawingStartPoint = null;
        this.drawingEndPoint = null;
        
        // 原有的编辑历史系统
        this.editHistory = [];
        this.currentEditIndex = -1;
        this.MAX_EDIT_HISTORY = 50;
        
        // 原有的颜色状态管理
        this.globalColorState = {
            primary: '#FF0000',
            secondary: '#FFFFFF',
            opacity: 1.0,
            lastUsed: '#FF0000'
        };
        
        // 文字工具状态
        this.textX = 0;
        this.textY = 0;
        this.textElements = [];
        
        // 画图工具状态 - 保存所有已绘制的图形
        this.drawnShapes = [];
        this.baseCanvasState = null;
        
        // 画笔轨迹状态
        this.penPath = [];
        this.isPenDrawing = false;
        
        // 🌍 国际化支持 - 简化版本
        this.i18n = this.createSimpleI18n();
        console.log('🌍 截图编辑器国际化已初始化:', this.i18n.getCurrentLocale());
        console.log('🌍 测试翻译:', this.i18n.t('textInputPlaceholder'));
        
        this.init();
        
        // 🌍 在init完成后初始化页面国际化文本
        setTimeout(() => {
            this.initPageI18n();
            console.log('🌍 页面国际化文本已初始化');
        }, 100);
    }

    // 🌍 创建简化版国际化功能
    createSimpleI18n() {
        const messages = {
            en: {
                'deleteText': '🗑️ Delete',
                'textInputPlaceholder': 'Enter text:',
                'confirm': 'Confirm',
                'cancel': 'Cancel',
                'rectangleTool': 'Rectangle Tool',
                'circleTool': 'Circle Tool',
                'arrowTool': 'Arrow Tool',
                'brushTool': 'Brush Tool',
                'textTool': 'Text Tool',
                'undoTool': 'Undo (Ctrl+Z)',
                'saveImage': 'Save Image',
                'delete': 'Delete',
                'screenshotContent': '📸 Screenshot Content',
                'regionInfo': 'Region: Loading...',
                'timeInfo': 'Time: Loading...',
                'editInstructions': 'Use the bottom toolbar to edit',
                'imageAlt': 'Screenshot'
            },
            zh: {
                'deleteText': '🗑️ 删除',
                'textInputPlaceholder': '输入文字:',
                'confirm': '确定',
                'cancel': '取消',
                'rectangleTool': '矩形工具',
                'circleTool': '圆形工具',
                'arrowTool': '箭头工具',
                'brushTool': '画笔工具',
                'textTool': '文字工具',
                'undoTool': '撤销 (Ctrl+Z)',
                'saveImage': '保存图片',
                'delete': '删除',
                'screenshotContent': '📸 截图内容',
                'regionInfo': '区域: 加载中...',
                'timeInfo': '时间: 加载中...',
                'editInstructions': '使用底部工具栏进行编辑',
                'imageAlt': '截图'
            }
        };

        // 强制锁定英文，准备发布
        const detectLanguage = () => {
            console.log('🌍 截图编辑器：强制锁定英文');
            return 'en';
        };

        // 使用统一语言检测
        const currentLang = detectLanguage();
        console.log('🌍 最终选择的语言:', currentLang);
        
        return {
            t: function(key) {
                return messages[currentLang][key] || messages.en[key] || key;
            },
            getCurrentLocale: () => currentLang
        };
    }

    // 🌍 初始化页面国际化文本
    initPageI18n() {
        console.log('🌍 开始初始化页面国际化文本...');
        console.log('🌍 当前i18n实例语言:', this.i18n.getCurrentLocale());
        
        // 设置按钮的title属性
        const toolButtons = document.querySelectorAll('[data-i18n-title]');
        console.log('🌍 找到工具按钮数量:', toolButtons.length);
        toolButtons.forEach(button => {
            const key = button.getAttribute('data-i18n-title');
            const title = this.i18n.t(key);
            button.setAttribute('title', title);
            console.log('🌍 设置按钮title:', key, '->', title, '(语言:', this.i18n.getCurrentLocale(), ')');
        });

        // 设置文本内容
        const textElements = document.querySelectorAll('[data-i18n-text]');
        console.log('🌍 找到文本元素数量:', textElements.length);
        textElements.forEach(element => {
            const key = element.getAttribute('data-i18n-text');
            const text = this.i18n.t(key);
            element.textContent = text;
            console.log('🌍 设置文本内容:', key, '->', text);
        });

        // 设置图片alt属性
        const imageElements = document.querySelectorAll('[data-i18n-alt]');
        console.log('🌍 找到图片元素数量:', imageElements.length);
        imageElements.forEach(img => {
            const key = img.getAttribute('data-i18n-alt');
            const alt = this.i18n.t(key);
            img.setAttribute('alt', alt);
            console.log('🌍 设置图片alt:', key, '->', alt);
        });
        
        console.log('🌍 页面国际化文本初始化完成');
    }

    // 🌍 自定义文字输入对话框
    showCustomTextInput() {
        return new Promise((resolve) => {
            // 创建遮罩层
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(0, 0, 0, 0.5);
                z-index: 1000000;
                display: flex;
                align-items: center;
                justify-content: center;
            `;

            // 创建输入对话框
            const dialog = document.createElement('div');
            dialog.style.cssText = `
                background: white;
                border-radius: 8px;
                padding: 20px;
                min-width: 300px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                font-family: Arial, sans-serif;
            `;

            console.log('🌍 创建自定义输入框，当前语言:', this.i18n.getCurrentLocale());
            console.log('🌍 输入提示翻译:', this.i18n.t('textInputPlaceholder'));
            console.log('🌍 确认按钮翻译:', this.i18n.t('confirm'));
            console.log('🌍 取消按钮翻译:', this.i18n.t('cancel'));
            
            dialog.innerHTML = `
                <div style="margin-bottom: 15px; font-size: 16px; color: #333;">
                    ${this.i18n.t('textInputPlaceholder')}
                </div>
                <input type="text" id="customTextInput" style="
                    width: 100%;
                    padding: 10px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    font-size: 14px;
                    margin-bottom: 15px;
                    box-sizing: border-box;
                " placeholder="${this.i18n.t('textInputPlaceholder')}">
                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button id="customTextCancel" style="
                        padding: 8px 16px;
                        background: #9e9e9e;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 14px;
                    ">${this.i18n.t('cancel')}</button>
                    <button id="customTextConfirm" style="
                        padding: 8px 16px;
                        background: #2196F3;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 14px;
                    ">${this.i18n.t('confirm')}</button>
                </div>
            `;

            // 添加到页面
            overlay.appendChild(dialog);
            document.body.appendChild(overlay);

            // 聚焦输入框
            const input = dialog.querySelector('#customTextInput');
            input.focus();

            // 绑定事件
            const confirmBtn = dialog.querySelector('#customTextConfirm');
            const cancelBtn = dialog.querySelector('#customTextCancel');

            const cleanup = () => {
                document.body.removeChild(overlay);
            };

            // 确认按钮
            confirmBtn.onclick = () => {
                const text = input.value.trim();
                cleanup();
                resolve(text);
            };

            // 取消按钮
            cancelBtn.onclick = () => {
                cleanup();
                resolve('');
            };

            // Enter键确认
            input.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    const text = input.value.trim();
                    cleanup();
                    resolve(text);
                } else if (e.key === 'Escape') {
                    cleanup();
                    resolve('');
                }
            };

            // 点击遮罩层关闭
            overlay.onclick = (e) => {
                if (e.target === overlay) {
                    cleanup();
                    resolve('');
                }
            };
        });
    }

    init() {
        this.bindEvents();
        this.generateColorGrid();
        this.loadScreenshotData();
        this.setupCanvas();
        this.initializeColorPreview();
        
        // 确保所有工具按钮都处于非激活状态
        this.resetAllToolButtons();
        
        // 设置全局引用
        window.screenshotEditor = this;
        
        // 添加文字删除的键盘快捷键
        this.setupTextDeleteShortcut();
    }

    bindEvents() {
        // 工具栏事件 - 使用原有的工具激活逻辑
        document.querySelectorAll('.tool-button').forEach(button => {
            button.addEventListener('click', (e) => {
                const tool = e.currentTarget.dataset.tool;
                if (tool === 'undo') {
                    this.undo();
                } else {
                    this.activateTool(tool);
                }
            });
        });

        // 颜色选择事件
        document.getElementById('color-hex').addEventListener('input', (e) => {
            this.setCurrentColor(e.target.value);
        });

        // 保存按钮事件
        const saveBtn = document.getElementById('save-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.downloadScreenshot();
            });
        }

        // 删除按钮事件
        const deleteBtn = document.getElementById('delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                this.clearAllDrawings();
            });
        }

        // 监听postMessage
        window.addEventListener('message', (event) => {
            if (event.data.type === 'screenshotData') {
                this.handleScreenshotData(event.data.data, event.data.region);
            }
        });
    }

    generateColorGrid() {
        const colors = [
            '#FF0000', '#FF4500', '#FF8C00', '#FFD700', '#FFFF00', '#ADFF2F',
            '#00FF00', '#00FFFF', '#00BFFF', '#0000FF', '#8A2BE2', '#FF00FF',
            '#FF1493', '#FF69B4', '#FFB6C1', '#F0E68C', '#DDA0DD', '#98FB98',
            '#87CEEB', '#F0F8FF', '#F5F5DC', '#DEB887', '#CD853F', '#8B4513'
        ];

        const colorGrid = document.getElementById('color-grid');
        colorGrid.innerHTML = '';

        colors.forEach(color => {
            const colorOption = document.createElement('div');
            colorOption.className = 'color-option';
            colorOption.style.backgroundColor = color;
            colorOption.addEventListener('click', () => {
                this.setCurrentColor(color);
            });
            colorGrid.appendChild(colorOption);
        });
    }

    activateTool(tool) {
        // 移除所有工具的active状态
        document.querySelectorAll('.tool-button').forEach(btn => {
            btn.classList.remove('active');
        });

        // 设置当前工具为active
        const targetButton = document.querySelector(`[data-tool="${tool}"]`);
        if (targetButton) {
            targetButton.classList.add('active');
            this.currentActiveTool = tool;
            
            // 设置Canvas样式
            const canvasArea = document.querySelector('.canvas-area');
            if (canvasArea) {
                const canvas = canvasArea.querySelector('canvas');
                if (canvas) {
                    canvas.style.cursor = 'crosshair';
                }
            }
            
            console.log('✅ 激活工具:', tool);
        } else {
            console.warn('⚠️ 未找到工具按钮:', tool);
        }
    }

    setCurrentColor(color) {
        this.globalColorState.primary = color;
        this.globalColorState.lastUsed = color;
        
        const colorPreview = document.getElementById('color-preview');
        if (colorPreview) {
            colorPreview.style.backgroundColor = color;
        }
        
        const colorHex = document.getElementById('color-hex');
        if (colorHex) {
            colorHex.value = color;
        }
        
        // 保存到localStorage
        try {
            localStorage.setItem('lastUsedColor', color);
        } catch (error) {
            console.warn('无法保存颜色到localStorage:', error);
        }
        
        console.log('🎨 选择颜色:', color);
    }

    initializeColorPreview() {
        const colorPreview = document.getElementById('color-preview');
        if (colorPreview) {
            colorPreview.style.backgroundColor = this.globalColorState.primary;
        }
    }

    loadScreenshotData() {
        // 等待postMessage数据
        console.log('⏳ 等待截图数据...');
    }

    handleScreenshotData(data, region) {
        this.screenshotData = {
            imageData: data,
            region: region,
            timestamp: Date.now()
        };
        this.displayScreenshot();
    }

    displayScreenshot() {
        if (!this.screenshotData) return;

        const placeholder = document.getElementById('placeholder');
        const image = document.getElementById('screenshot-image');
        
        if (this.screenshotData.imageData) {
            // 隐藏占位符
            placeholder.style.display = 'none';
            
            // 显示图片
            image.src = this.screenshotData.imageData;
            image.style.display = 'block';
            
            // 设置图片样式
            image.style.width = '100%';
            image.style.height = '100%';
            image.style.objectFit = 'cover';
            
            // 等待图片加载完成后创建Canvas
            if (image.complete) {
                this.setupDrawingCanvas();
            } else {
                image.onload = () => {
                    this.setupDrawingCanvas();
                };
            }
        }
    }

    setupCanvas() {
        console.log('✅ 画布已设置');
    }

    setupDrawingCanvas() {
        const canvasArea = document.querySelector('.canvas-area');
        if (!canvasArea) return;

        // 创建Canvas
        let canvas = canvasArea.querySelector('canvas');
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.style.position = 'absolute';
            canvas.style.top = '0';
            canvas.style.left = '0';
            canvas.style.pointerEvents = 'auto';
            canvas.style.zIndex = '10';
            canvasArea.appendChild(canvas);
        }

        // 获取图片元素以确定正确的尺寸
        const image = document.getElementById('screenshot-image');
        if (image && image.complete) {
            // 使用图片的实际显示尺寸
            const rect = image.getBoundingClientRect();
            canvas.width = rect.width;
            canvas.height = rect.height;
            canvas.style.width = rect.width + 'px';
            canvas.style.height = rect.height + 'px';
        } else {
            // 如果没有图片，使用容器尺寸
            canvas.width = canvasArea.offsetWidth;
            canvas.height = canvasArea.offsetHeight;
        }

        this.currentCanvas = canvas;
        this.currentCtx = canvas.getContext('2d');

        // 保存基础状态（空白Canvas）
        this.baseCanvasState = this.currentCtx.getImageData(0, 0, canvas.width, canvas.height);

        // 设置事件监听器
        this.setupCanvasEventListeners();
        
        console.log('🎨 Canvas设置完成:', {
            width: canvas.width,
            height: canvas.height,
            styleWidth: canvas.style.width,
            styleHeight: canvas.style.height,
            zIndex: canvas.style.zIndex
        });
    }

    setupCanvasEventListeners() {
        if (!this.currentCanvas) return;

        // 移除旧的事件监听器
        this.currentCanvas.removeEventListener('mousedown', this.handleMouseDown.bind(this));
        this.currentCanvas.removeEventListener('mousemove', this.handleMouseMove.bind(this));
        this.currentCanvas.removeEventListener('mouseup', this.handleMouseUp.bind(this));
        this.currentCanvas.removeEventListener('click', this.handleClick.bind(this));

        // 添加新的事件监听器
        this.currentCanvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.currentCanvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.currentCanvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.currentCanvas.addEventListener('click', this.handleClick.bind(this));
    }

    handleMouseDown(e) {
        if (!this.currentActiveTool) return;

        const rect = this.currentCanvas.getBoundingClientRect();
        const point = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
        
        if (this.currentActiveTool === 'pen') {
            // 画笔工具：开始新的轨迹
            this.penPath = [point];
            this.isPenDrawing = true;
        } else {
            // 其他工具：记录起始点
            this.drawingStartPoint = point;
            this.isDrawing = true;
        }
        
        console.log('🖱️ 鼠标按下:', point);
    }

    handleMouseMove(e) {
        const rect = this.currentCanvas.getBoundingClientRect();
        const point = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };

        if (this.currentActiveTool === 'pen' && this.isPenDrawing) {
            // 画笔工具：添加轨迹点并实时绘制
            this.penPath.push(point);
            this.drawPenPreview();
        } else if (this.isDrawing && this.currentActiveTool !== 'pen') {
            // 其他工具：记录终点并绘制预览
            this.drawingEndPoint = point;
            this.drawPreview();
        }
    }

    handleMouseUp(e) {
        if (this.currentActiveTool === 'pen' && this.isPenDrawing) {
            // 画笔工具：完成轨迹绘制
            this.completePenDrawing();
            this.isPenDrawing = false;
            this.penPath = [];
        } else if (this.isDrawing && this.currentActiveTool !== 'pen') {
            // 其他工具：完成绘制
            this.isDrawing = false;
            this.completeDrawing();
            this.drawingStartPoint = null;
            this.drawingEndPoint = null;
        }
    }

    handleClick(e) {
        // 只在文字工具激活时处理点击
        if (this.currentActiveTool === 'text') {
            this.handleTextClick(e);
        }
        // 其他工具不处理点击事件
    }

    drawPreview() {
        if (!this.drawingStartPoint || !this.drawingEndPoint) return;

        // 恢复基础状态（包含所有已绘制的内容）
        this.restoreBaseState();

        // 根据工具类型绘制预览
        switch (this.currentActiveTool) {
            case 'rectangle':
                this.drawRectanglePreview();
                break;
            case 'circle':
                this.drawCirclePreview();
                break;
            case 'arrow':
                this.drawArrowPreview();
                break;
            case 'pen':
                this.drawPenPreview();
                break;
        }
    }

    completeDrawing() {
        if (!this.drawingStartPoint || !this.drawingEndPoint) return;

        // 保存绘制的图形
        const shape = {
            type: this.currentActiveTool,
            startPoint: { ...this.drawingStartPoint },
            endPoint: { ...this.drawingEndPoint },
            color: this.globalColorState.primary
        };

        this.drawnShapes.push(shape);

        // 重新绘制所有内容（包含新绘制的图形）
        this.restoreBaseState();

        console.log('✅ 图形绘制完成，当前图形数量:', this.drawnShapes.length);
    }

    drawRectanglePreview() {
        if (!this.currentCtx || !this.drawingStartPoint || !this.drawingEndPoint) return;

        this.currentCtx.strokeStyle = this.globalColorState.primary;
        this.currentCtx.lineWidth = 2;
        this.currentCtx.setLineDash([5, 5]);
        
        this.currentCtx.strokeRect(
            this.drawingStartPoint.x,
            this.drawingStartPoint.y,
            this.drawingEndPoint.x - this.drawingStartPoint.x,
            this.drawingEndPoint.y - this.drawingStartPoint.y
        );
        
        this.currentCtx.setLineDash([]);
    }

    drawCirclePreview() {
        if (!this.currentCtx || !this.drawingStartPoint || !this.drawingEndPoint) return;

        const radius = Math.sqrt(
            Math.pow(this.drawingEndPoint.x - this.drawingStartPoint.x, 2) + 
            Math.pow(this.drawingEndPoint.y - this.drawingStartPoint.y, 2)
        );

        this.currentCtx.strokeStyle = this.globalColorState.primary;
        this.currentCtx.lineWidth = 2;
        this.currentCtx.setLineDash([5, 5]);
        
        this.currentCtx.beginPath();
        this.currentCtx.arc(this.drawingStartPoint.x, this.drawingStartPoint.y, radius, 0, 2 * Math.PI);
        this.currentCtx.stroke();
        
        this.currentCtx.setLineDash([]);
    }

    drawArrowPreview() {
        if (!this.currentCtx || !this.drawingStartPoint || !this.drawingEndPoint) return;

        this.currentCtx.strokeStyle = this.globalColorState.primary;
        this.currentCtx.lineWidth = 2;
        this.currentCtx.setLineDash([5, 5]);
        
        this.currentCtx.beginPath();
        this.currentCtx.moveTo(this.drawingStartPoint.x, this.drawingStartPoint.y);
        this.currentCtx.lineTo(this.drawingEndPoint.x, this.drawingEndPoint.y);
        this.currentCtx.stroke();
        
        this.currentCtx.setLineDash([]);
    }

    drawPenPreview() {
        if (!this.currentCtx || this.penPath.length < 2) return;

        // 恢复基础状态（包含所有已绘制的内容）
        this.restoreBaseState();

        // 绘制当前轨迹（虚线预览）
        this.currentCtx.strokeStyle = this.globalColorState.primary;
        this.currentCtx.lineWidth = 2;
        this.currentCtx.lineCap = 'round';
        this.currentCtx.lineJoin = 'round';
        this.currentCtx.setLineDash([3, 3]); // 虚线预览
        
        this.currentCtx.beginPath();
        this.currentCtx.moveTo(this.penPath[0].x, this.penPath[0].y);
        
        for (let i = 1; i < this.penPath.length; i++) {
            this.currentCtx.lineTo(this.penPath[i].x, this.penPath[i].y);
        }
        
        this.currentCtx.stroke();
        this.currentCtx.setLineDash([]); // 重置虚线
    }

    completePenDrawing() {
        if (this.penPath.length < 2) return;

        // 保存画笔轨迹
        const shape = {
            type: 'pen',
            path: [...this.penPath],
            color: this.globalColorState.primary
        };

        this.drawnShapes.push(shape);

        // 重新绘制所有内容（包含新绘制的画笔轨迹）
        this.restoreBaseState();

        console.log('✅ 画笔绘制完成，当前图形数量:', this.drawnShapes.length);
    }

    drawRectangle() {
        if (!this.currentCtx || !this.drawingStartPoint || !this.drawingEndPoint) return;

        this.currentCtx.strokeStyle = this.globalColorState.primary;
        this.currentCtx.lineWidth = 2;
        
        this.currentCtx.strokeRect(
            this.drawingStartPoint.x,
            this.drawingStartPoint.y,
            this.drawingEndPoint.x - this.drawingStartPoint.x,
            this.drawingEndPoint.y - this.drawingStartPoint.y
        );
    }

    drawCircle() {
        if (!this.currentCtx || !this.drawingStartPoint || !this.drawingEndPoint) return;

        const radius = Math.sqrt(
            Math.pow(this.drawingEndPoint.x - this.drawingStartPoint.x, 2) + 
            Math.pow(this.drawingEndPoint.y - this.drawingStartPoint.y, 2)
        );

        this.currentCtx.strokeStyle = this.globalColorState.primary;
        this.currentCtx.lineWidth = 2;
        
        this.currentCtx.beginPath();
        this.currentCtx.arc(this.drawingStartPoint.x, this.drawingStartPoint.y, radius, 0, 2 * Math.PI);
        this.currentCtx.stroke();
    }

    drawArrow() {
        if (!this.currentCtx || !this.drawingStartPoint || !this.drawingEndPoint) return;

        this.currentCtx.strokeStyle = this.globalColorState.primary;
        this.currentCtx.lineWidth = 2;
        
        // 绘制线条
        this.currentCtx.beginPath();
        this.currentCtx.moveTo(this.drawingStartPoint.x, this.drawingStartPoint.y);
        this.currentCtx.lineTo(this.drawingEndPoint.x, this.drawingEndPoint.y);
        this.currentCtx.stroke();
        
        // 绘制箭头
        const angle = Math.atan2(this.drawingEndPoint.y - this.drawingStartPoint.y, this.drawingEndPoint.x - this.drawingStartPoint.x);
        const arrowLength = 15;
        const arrowAngle = Math.PI / 6;
        
        this.currentCtx.beginPath();
        this.currentCtx.moveTo(this.drawingEndPoint.x, this.drawingEndPoint.y);
        this.currentCtx.lineTo(
            this.drawingEndPoint.x - arrowLength * Math.cos(angle - arrowAngle),
            this.drawingEndPoint.y - arrowLength * Math.sin(angle - arrowAngle)
        );
        this.currentCtx.moveTo(this.drawingEndPoint.x, this.drawingEndPoint.y);
        this.currentCtx.lineTo(
            this.drawingEndPoint.x - arrowLength * Math.cos(angle + arrowAngle),
            this.drawingEndPoint.y - arrowLength * Math.sin(angle + arrowAngle)
        );
        this.currentCtx.stroke();
    }

    drawPen() {
        if (!this.currentCtx || !this.drawingStartPoint || !this.drawingEndPoint) return;

        this.currentCtx.strokeStyle = this.globalColorState.primary;
        this.currentCtx.lineWidth = 2;
        this.currentCtx.lineCap = 'round';
        this.currentCtx.lineJoin = 'round';
        
        this.currentCtx.beginPath();
        this.currentCtx.moveTo(this.drawingStartPoint.x, this.drawingStartPoint.y);
        this.currentCtx.lineTo(this.drawingEndPoint.x, this.drawingEndPoint.y);
        this.currentCtx.stroke();
    }

    // 绘制已保存的图形
    drawShape(shape) {
        if (!this.currentCtx) return;

        this.currentCtx.strokeStyle = shape.color;
        this.currentCtx.lineWidth = 2;

        switch (shape.type) {
            case 'rectangle':
                this.currentCtx.strokeRect(
                    shape.startPoint.x,
                    shape.startPoint.y,
                    shape.endPoint.x - shape.startPoint.x,
                    shape.endPoint.y - shape.startPoint.y
                );
                break;
            case 'circle':
                const radius = Math.sqrt(
                    Math.pow(shape.endPoint.x - shape.startPoint.x, 2) + 
                    Math.pow(shape.endPoint.y - shape.startPoint.y, 2)
                );
                this.currentCtx.beginPath();
                this.currentCtx.arc(shape.startPoint.x, shape.startPoint.y, radius, 0, 2 * Math.PI);
                this.currentCtx.stroke();
                break;
            case 'arrow':
                // 绘制线条
                this.currentCtx.beginPath();
                this.currentCtx.moveTo(shape.startPoint.x, shape.startPoint.y);
                this.currentCtx.lineTo(shape.endPoint.x, shape.endPoint.y);
                this.currentCtx.stroke();
                
                // 绘制箭头
                const angle = Math.atan2(shape.endPoint.y - shape.startPoint.y, shape.endPoint.x - shape.startPoint.x);
                const arrowLength = 15;
                const arrowAngle = Math.PI / 6;
                
                this.currentCtx.beginPath();
                this.currentCtx.moveTo(shape.endPoint.x, shape.endPoint.y);
                this.currentCtx.lineTo(
                    shape.endPoint.x - arrowLength * Math.cos(angle - arrowAngle),
                    shape.endPoint.y - arrowLength * Math.sin(angle - arrowAngle)
                );
                this.currentCtx.moveTo(shape.endPoint.x, shape.endPoint.y);
                this.currentCtx.lineTo(
                    shape.endPoint.x - arrowLength * Math.cos(angle + arrowAngle),
                    shape.endPoint.y - arrowLength * Math.sin(angle + arrowAngle)
                );
                this.currentCtx.stroke();
                break;
            case 'pen':
                if (shape.path && shape.path.length >= 2) {
                    this.currentCtx.lineCap = 'round';
                    this.currentCtx.lineJoin = 'round';
                    this.currentCtx.beginPath();
                    this.currentCtx.moveTo(shape.path[0].x, shape.path[0].y);
                    
                    for (let i = 1; i < shape.path.length; i++) {
                        this.currentCtx.lineTo(shape.path[i].x, shape.path[i].y);
                    }
                    this.currentCtx.stroke();
                }
                break;
        }
    }

    handleTextClick(e) {
        const rect = this.currentCanvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        // 检查是否点击在已存在的文字上
        const clickedText = this.findTextAtPosition(clickX, clickY);
        if (clickedText) {
            this.showTextDeleteOptions(clickedText, e.clientX, e.clientY);
            return;
        }

        // 创建新文字
        this.createText(clickX, clickY);
    }

    showTextDeleteOptions(textElement, clientX, clientY) {
        // 移除可能存在的旧删除按钮
        const existingBtn = document.querySelector('.text-delete-btn');
        if (existingBtn) {
            existingBtn.remove();
        }

        // 创建删除选项按钮
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = this.i18n.t('deleteText');
        deleteBtn.className = 'text-delete-btn';
        deleteBtn.style.cssText = `
            position: fixed;
            left: ${clientX + 10}px;
            top: ${clientY - 30}px;
            z-index: 10000;
            padding: 8px 12px;
            background: #f44336;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            font-family: Arial, sans-serif;
        `;
        
        deleteBtn.onclick = (e) => {
            e.stopPropagation(); // 阻止事件冒泡
            this.removeText(textElement);
            deleteBtn.remove();
        };
        
        // 点击其他地方关闭删除选项
        const closeDeleteOptions = (e) => {
            if (e.target !== deleteBtn) {
                deleteBtn.remove();
                document.removeEventListener('click', closeDeleteOptions);
            }
        };
        
        // 延迟添加事件监听器，避免立即触发
        setTimeout(() => {
            document.addEventListener('click', closeDeleteOptions);
        }, 100);
        
        document.body.appendChild(deleteBtn);
        
        console.log('🗑️ 显示文字删除选项:', textElement.text);
    }

    async createText(x, y) {
        const text = await this.showCustomTextInput();
        if (!text) return;

        const textElement = {
            x: x,
            y: y,
            text: text,
            color: this.globalColorState.primary
        };

        this.textElements.push(textElement);
        
        // 重新绘制所有内容（包含新文字）
        this.restoreBaseState();
        
        console.log('✏️ 创建新文字:', text, '位置:', {x, y}, '当前文字数量:', this.textElements.length);
    }

    drawText(textElement) {
        if (!this.currentCtx) return;

        this.currentCtx.fillStyle = textElement.color;
        this.currentCtx.font = '16px Arial';
        this.currentCtx.fillText(textElement.text, textElement.x, textElement.y);
    }

    findTextAtPosition(x, y) {
        // 从后往前查找，这样后添加的文字（在上层的）会优先被选中
        for (let i = this.textElements.length - 1; i >= 0; i--) {
            const text = this.textElements[i];
            const textWidth = this.currentCtx.measureText(text.text).width;
            const textHeight = 16; // 文字高度
            
            // 检查点击位置是否在文字范围内
            if (x >= text.x && x <= text.x + textWidth && 
                y >= text.y - textHeight && y <= text.y) {
                console.log('🎯 找到文字:', text.text, '位置:', {x: text.x, y: text.y});
                return text;
            }
        }
        return null;
    }

    removeText(textElement) {
        const index = this.textElements.indexOf(textElement);
        if (index > -1) {
            this.textElements.splice(index, 1);
            console.log('🗑️ 删除文字:', textElement.text, '剩余文字数量:', this.textElements.length);
            
            // 重新绘制所有内容
            this.restoreBaseState();
        } else {
            console.warn('⚠️ 未找到要删除的文字:', textElement);
        }
    }

    restoreBaseState() {
        if (!this.currentCtx) return;

        // 清除Canvas
        this.currentCtx.clearRect(0, 0, this.currentCanvas.width, this.currentCanvas.height);

        // 重新绘制所有已保存的图形
        this.drawnShapes.forEach(shape => {
            this.drawShape(shape);
        });

        // 重新绘制所有文字
        this.textElements.forEach(text => this.drawText(text));
    }

    redrawCanvas() {
        if (!this.currentCtx) return;

        // 清除Canvas
        this.currentCtx.clearRect(0, 0, this.currentCanvas.width, this.currentCanvas.height);

        // 重新绘制所有文字
        this.textElements.forEach(text => this.drawText(text));
    }

    addEditOperation(operation) {
        if (!operation || !operation.type || !operation.canvas || !operation.prevState) {
            console.error('❌ 操作数据不完整，跳过添加:', operation);
            return;
        }

        // 添加新操作到历史末尾
        this.editHistory.push(operation);

        // 限制历史记录数量
        if (this.editHistory.length > this.MAX_EDIT_HISTORY) {
            this.editHistory.shift();
        }

        console.log('✅ 编辑操作已添加到历史，当前历史数量:', this.editHistory.length);
    }

    undo() {
        if (this.drawnShapes.length === 0) {
            console.log('⚠️ 没有可撤销的图形');
            return;
        }

        // 移除最后一个图形
        this.drawnShapes.pop();
        
        // 重新绘制所有剩余图形
        this.restoreBaseState();
        
        console.log('↩️ 撤销操作完成，剩余图形数量:', this.drawnShapes.length);
    }

    clearAllDrawings() {
        if (!this.currentCtx) return;

        // 清除Canvas
        this.currentCtx.clearRect(0, 0, this.currentCanvas.width, this.currentCanvas.height);

        // 清除所有图形
        this.drawnShapes = [];

        // 清除文字元素
        this.textElements = [];

        // 恢复基础状态
        if (this.baseCanvasState) {
            this.currentCtx.putImageData(this.baseCanvasState, 0, 0);
        }

        console.log('🗑️ 清除所有绘制内容');
    }

    downloadScreenshot() {
        if (!this.currentCanvas || !this.screenshotData) {
            alert('没有可下载的截图');
            return;
        }

        try {
            // 创建临时Canvas来合成最终图片
            const finalCanvas = document.createElement('canvas');
            const finalCtx = finalCanvas.getContext('2d');
            
            // 设置Canvas尺寸为截图尺寸
            const image = document.getElementById('screenshot-image');
            if (image && image.complete) {
                finalCanvas.width = image.naturalWidth || image.width;
                finalCanvas.height = image.naturalHeight || image.height;
                
                // 绘制原始截图
                finalCtx.drawImage(image, 0, 0, finalCanvas.width, finalCanvas.height);
                
                // 绘制编辑内容（需要缩放坐标）
                const scaleX = finalCanvas.width / this.currentCanvas.width;
                const scaleY = finalCanvas.height / this.currentCanvas.height;
                
                // 绘制所有图形
                this.drawnShapes.forEach(shape => {
                    this.drawShapeOnFinalCanvas(finalCtx, shape, scaleX, scaleY);
                });
                
                // 绘制所有文字
                this.textElements.forEach(text => {
                    this.drawTextOnFinalCanvas(finalCtx, text, scaleX, scaleY);
                });
                
                // 创建下载链接
                const link = document.createElement('a');
                link.download = `screenshot_${Date.now()}.png`;
                link.href = finalCanvas.toDataURL('image/png');
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                console.log('✅ 截图下载已开始');
            } else {
                alert('图片未加载完成，请稍后重试');
            }
        } catch (error) {
            console.error('❌ 下载失败:', error);
            alert('下载失败，请重试');
        }
    }

    drawShapeOnFinalCanvas(ctx, shape, scaleX, scaleY) {
        ctx.strokeStyle = shape.color;
        ctx.lineWidth = 2;

        switch (shape.type) {
            case 'rectangle':
                ctx.strokeRect(
                    shape.startPoint.x * scaleX,
                    shape.startPoint.y * scaleY,
                    (shape.endPoint.x - shape.startPoint.x) * scaleX,
                    (shape.endPoint.y - shape.startPoint.y) * scaleY
                );
                break;
            case 'circle':
                const radius = Math.sqrt(
                    Math.pow((shape.endPoint.x - shape.startPoint.x) * scaleX, 2) + 
                    Math.pow((shape.endPoint.y - shape.startPoint.y) * scaleY, 2)
                );
                ctx.beginPath();
                ctx.arc(shape.startPoint.x * scaleX, shape.startPoint.y * scaleY, radius, 0, 2 * Math.PI);
                ctx.stroke();
                break;
            case 'arrow':
                // 绘制线条
                ctx.beginPath();
                ctx.moveTo(shape.startPoint.x * scaleX, shape.startPoint.y * scaleY);
                ctx.lineTo(shape.endPoint.x * scaleX, shape.endPoint.y * scaleY);
                ctx.stroke();
                
                // 绘制箭头
                const angle = Math.atan2(
                    (shape.endPoint.y - shape.startPoint.y) * scaleY, 
                    (shape.endPoint.x - shape.startPoint.x) * scaleX
                );
                const arrowLength = 15;
                const arrowAngle = Math.PI / 6;
                
                ctx.beginPath();
                ctx.moveTo(shape.endPoint.x * scaleX, shape.endPoint.y * scaleY);
                ctx.lineTo(
                    (shape.endPoint.x * scaleX) - arrowLength * Math.cos(angle - arrowAngle),
                    (shape.endPoint.y * scaleY) - arrowLength * Math.sin(angle - arrowAngle)
                );
                ctx.moveTo(shape.endPoint.x * scaleX, shape.endPoint.y * scaleY);
                ctx.lineTo(
                    (shape.endPoint.x * scaleX) - arrowLength * Math.cos(angle + arrowAngle),
                    (shape.endPoint.y * scaleY) - arrowLength * Math.sin(angle + arrowAngle)
                );
                ctx.stroke();
                break;
            case 'pen':
                if (shape.path && shape.path.length >= 2) {
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    ctx.beginPath();
                    ctx.moveTo(shape.path[0].x * scaleX, shape.path[0].y * scaleY);
                    
                    for (let i = 1; i < shape.path.length; i++) {
                        ctx.lineTo(shape.path[i].x * scaleX, shape.path[i].y * scaleY);
                    }
                    ctx.stroke();
                }
                break;
        }
    }

    drawTextOnFinalCanvas(ctx, text, scaleX, scaleY) {
        ctx.fillStyle = text.color;
        ctx.font = '16px Arial';
        ctx.fillText(text.text, text.x * scaleX, text.y * scaleY);
    }

    setupTextDeleteShortcut() {
        // 添加Delete键删除最后添加的文字
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Delete' && this.textElements.length > 0) {
                e.preventDefault();
                const lastText = this.textElements[this.textElements.length - 1];
                this.removeText(lastText);
                console.log('⌨️ 使用Delete键删除文字:', lastText.text);
            }
        });
    }

    resetAllToolButtons() {
        // 移除所有工具按钮的active状态
        document.querySelectorAll('.tool-button').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // 确保当前激活工具为null
        this.currentActiveTool = null;
        
        console.log('🔄 所有工具按钮已重置为非激活状态');
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    console.log('🌍 DOMContentLoaded 事件触发，开始初始化截图编辑器...');
    new ScreenshotEditorNewExtension();
});

// 添加键盘快捷键
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
            case 'z':
                e.preventDefault();
                if (window.screenshotEditor) {
                    window.screenshotEditor.undo();
                }
                break;
            case 's':
                e.preventDefault();
                if (window.screenshotEditor) {
                    window.screenshotEditor.downloadScreenshot();
                }
                break;
        }
    }
    
    // ESC键关闭
    if (e.key === 'Escape') {
        window.close();
    }
});