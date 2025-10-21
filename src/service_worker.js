// ScreenCatch Service Worker - 专注状态管理和文件保存
class ScreenCatchServiceWorker {
  constructor() {
    this.recordingState = {
      isRecording: false,
      startTime: null,
      duration: 0,
      hasStream: false,
      recordedChunks: []
    };
    
    // 🔥 新增：IndexedDB相关变量
    this.db = null;
    this.DB_NAME = 'ScreenCatchDB';
    this.DB_VERSION = 1;
    this.STORE_NAME = 'recordings';
    
    // 🆕 新增：Blob传输会话状态
    this.blobTransferSession = null;
    
    this.init();
  }

  init() {
    // 🔥 新增：初始化IndexedDB
    this.initDatabase();
    
    // 🆕 新增：预加载html2canvas到所有标签页
    this.preloadHtml2Canvas();
    
    // 监听来自popup的消息
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // 保持消息通道开放
    });

    // 监听快捷键命令
    chrome.commands.onCommand.addListener((command) => {
      if (command === '_execute_action') {
        this.toggleRecording();
      }
    });

    // 监听扩展安装/更新
    chrome.runtime.onInstalled.addListener((details) => {
      if (details.reason === 'install') {
        this.initializeExtension();
      }
    });

    // 创建定时器保持Service Worker活跃
    if (chrome.alarms) {
      chrome.alarms.create("keepAlive", { periodInMinutes: 1 });
      chrome.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === "keepAlive") {
          console.log("Service Worker 保持活跃状态");
        }
      });
    }

    console.log('ScreenCatch Service Worker 已启动 - 专注Blob传输和状态管理');
  }

  async handleMessage(request, sender, sendResponse) {
    console.log('📨 Service Worker 收到消息:', request?.action || '未知');
    
    try {
      if (request && request.action === 'ping') {
        sendResponse('pong');
        return;
      }
      
      if (request && request.action === 'getTabCaptureStream') {
        console.log('🎬 处理获取标签页捕获流请求...');
        await this.handleGetTabCaptureStream(request, sendResponse);
        return;
      }
      
      // 处理录制控制消息
      if (request && request.action === 'pauseRecording') {
        console.log('⏸️ 处理暂停录制请求...');
        sendResponse({ success: true, message: '录制已暂停' });
        return;
      }
      
      if (request && request.action === 'resumeRecording') {
        console.log('▶️ 处理继续录制请求...');
        sendResponse({ success: true, message: '录制已继续' });
        return;
      }
      
      if (request && request.action === 'stopRecording') {
        console.log('⏹️ 处理停止录制请求...');
        sendResponse({ success: true, message: '录制已停止' });
        return;
      }
      
      if (request && request.action === 'deleteRecording') {
        console.log('🗑️ 处理删除录制请求...');
        sendResponse({ success: true, message: '录制已删除' });
        return;
      }
      
      // 全屏录制控制标签页功能已移除，使用授权标签页操作界面
      
      // 🆕 新增：处理全屏录制控制消息
      if (request && request.action === 'togglePause') {
        console.log('⏸️ 处理全屏录制暂停/继续请求...');
        this.handleTogglePause(request, sendResponse).catch(error => {
          console.error('❌ 处理暂停/继续失败:', error);
          try {
            sendResponse({ success: false, error: error.message });
          } catch (sendError) {
            console.warn('⚠️ sendResponse已失效:', sendError);
          }
        });
        return true; // 表示异步处理
      }
      
      if (request && request.action === 'stopFullscreenRecording') {
        console.log('⏹️ 处理全屏录制停止请求...');
        this.handleStopFullscreenRecording(request, sendResponse).catch(error => {
          console.error('❌ 处理停止录制失败:', error);
          try {
            sendResponse({ success: false, error: error.message });
          } catch (sendError) {
            console.warn('⚠️ sendResponse已失效:', sendError);
          }
        });
        return true; // 表示异步处理
      }
      
      // 🔥 新增：处理IndexedDB操作消息
      if (request && request.action === 'saveRecording') {
        console.log('💾 处理保存录制数据请求...');
        try {
          const id = await this.saveRecordingData(request.data);
          sendResponse({ success: true, id: id });
        } catch (error) {
          console.error('❌ 保存录制数据失败:', error);
          sendResponse({ success: false, error: error.message });
        }
        return;
      }
      
      if (request && request.action === 'saveRecordingChunk') {
        console.log('📦 处理分块传输请求（已弃用，使用Blob传输）...');
        sendResponse({ success: false, error: '分块传输已弃用，请使用Blob传输' });
        return;
      }
      
      if (request && request.action === 'loadRecording') {
        console.log('🔄 处理加载录制数据请求...');
        try {
          const data = await this.loadRecordingData(request.id);
          sendResponse({ success: true, data: data });
        } catch (error) {
          console.error('❌ 加载录制数据失败:', error);
          sendResponse({ success: false, error: error.message });
        }
        return;
      }
      
      // 🆕 新增：处理html2canvas注入请求
      if (request && request.action === 'injectHtml2Canvas') {
        console.log('🖼️ 处理html2canvas注入请求...');
        try {
          await this.handleInjectHtml2Canvas(request, sender, sendResponse);
        } catch (error) {
          console.error('❌ html2canvas注入失败:', error);
          sendResponse({ success: false, error: error.message });
        }
        return;
      }
      
      // 其他消息暂时返回成功，避免崩溃
      sendResponse({ success: true, message: '功能暂时禁用，防止崩溃' });
    } catch (error) {
      console.error('❌ Service Worker 错误:', error);
      sendResponse({ success: false, message: `Service Worker 错误: ${error.message}` });
    }
  }

  async startRecording() {
    if (this.recordingState.isRecording) {
      throw new Error('录制已在进行中');
    }

    try {
      // 更新录制状态
      this.recordingState = {
        ...this.recordingState,
        isRecording: true,
        startTime: Date.now(),
        duration: 0,
        hasStream: false,
        recordedChunks: []
      };

      // 保存状态到存储
      this.saveRecordingState();
      
      // 通知状态变化
      this.notifyStatusChange();
      
      console.log('录制状态已启动');
    } catch (error) {
      console.error('启动录制状态失败:', error);
      throw error;
    }
  }

  async stopRecording() {
    if (!this.recordingState.isRecording) {
      return;
    }

    try {
      // 计算录制时长
      if (this.recordingState.startTime) {
        this.recordingState.duration = Date.now() - this.recordingState.startTime;
      }

      // 更新录制状态
      this.recordingState.isRecording = false;
      this.recordingState.hasStream = false;

      // 保存状态到存储
      this.saveRecordingState();
      
      // 通知状态变化
      this.notifyStatusChange();
      
      console.log('录制状态已停止，时长:', this.recordingState.duration, 'ms');
    } catch (error) {
      console.error('停止录制状态失败:', error);
      throw error;
    }
  }

  updateStreamStatus(hasStream) {
    this.recordingState.hasStream = hasStream;
    this.notifyStatusChange();
    console.log('流状态已更新:', hasStream);
  }

  addRecordedChunk(chunk) {
    if (this.recordingState.isRecording) {
      this.recordingState.recordedChunks.push(chunk);
      console.log('录制数据块已添加，当前块数:', this.recordingState.recordedChunks.length);
    }
  }

  getRecordingStatus() {
    return {
      isRecording: this.recordingState.isRecording,
      startTime: this.recordingState.startTime,
      duration: this.recordingState.duration,
      hasStream: this.recordingState.hasStream,
      recordedChunks: this.recordingState.recordedChunks.length,
      formattedDuration: this.formatDuration(this.recordingState.duration)
    };
  }

  formatDuration(ms) {
    if (!ms) return '00:00';
    
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  // 录制保存逻辑已移到content script中，这里只是状态管理
  async saveRecording() {
    console.log('录制保存逻辑已移到content script，Service Worker只负责状态管理');
    // 清理录制数据
    this.clearRecording();
  }

  clearRecording() {
    this.recordingState.recordedChunks = [];
    this.recordingState.startTime = null;
    this.recordingState.duration = 0;
    this.recordingState.hasStream = false;
    
    // 清理Blob传输会话
    if (this.blobTransferSession) {
      this.blobTransferSession = null;
      console.log('Blob传输会话已清理');
    }
    
    // 清理存储
    this.clearRecordingState();
    
    console.log('录制数据已清理');
  }

  toggleRecording() {
    if (this.recordingState.isRecording) {
      this.stopRecording();
    } else {
      this.startRecording();
    }
  }

  notifyStatusChange() {
    // 广播状态变化到所有标签页
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        try {
          chrome.tabs.sendMessage(tab.id, {
            action: 'recordingStatusChanged',
            status: this.getRecordingStatus()
          }).catch(() => {
            // 忽略无法发送消息的标签页
          });
        } catch (error) {
          // 忽略错误
        }
      });
    });

    // 发送状态变化消息到popup（如果popup打开的话）
    try {
      chrome.runtime.sendMessage({
        action: 'statusChanged',
        status: this.getRecordingStatus()
      }).catch(() => {
        // 忽略错误，popup可能未打开
      });
    } catch (error) {
      // 忽略错误，popup可能未打开
    }
  }

  // 存储管理
  saveRecordingState() {
    chrome.storage.local.set({
      recordingState: {
        isRecording: this.recordingState.isRecording,
        startTime: this.recordingState.startTime,
        duration: this.recordingState.duration
      }
    });
  }

  clearRecordingState() {
    chrome.storage.local.remove(['recordingState']);
  }

  async restoreRecordingState() {
    try {
      const result = await chrome.storage.local.get(['recordingState']);
      if (result.recordingState && result.recordingState.isRecording) {
        // 恢复录制状态
        this.recordingState = {
          ...this.recordingState,
          isRecording: result.recordingState.isRecording,
          startTime: result.recordingState.startTime,
          duration: result.recordingState.duration
        };
        
        console.log('录制状态已恢复');
        this.notifyStatusChange();
      }
    } catch (error) {
      console.error('恢复录制状态失败:', error);
    }
  }

  // 处理区域选择
  async handleAreaSelected(area) {
    try {
      console.log('保存选择的区域:', area);
      
      // 保存选择的区域到存储
      await chrome.storage.local.set({ 
        selectedArea: area,
        areaSelected: true 
      });
      
      // 通知所有相关组件（如果popup打开的话）
      try {
        chrome.runtime.sendMessage({
          action: 'areaSelected',
          area: area
        }).catch(() => {
          // 忽略错误，popup可能未打开
        });
      } catch (error) {
        // 忽略错误，popup可能未打开
      }
      
      console.log('区域选择已保存到存储');
    } catch (error) {
      console.error('保存区域选择失败:', error);
      throw error;
    }
  }
  
  // 重新打开popup
  async reopenPopup() {
    try {
      console.log('尝试重新打开popup');
      
      // 尝试重新打开popup
      chrome.action.openPopup();
      console.log('popup已重新打开');
    } catch (error) {
      console.log('无法直接打开popup，尝试其他方法');
      
      // 如果无法直接打开popup，发送通知让用户手动点击扩展图标
      try {
        await chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon128.png',
          title: 'ScreenCatch',
          message: '区域选择完成！请点击扩展图标开始录制。'
        });
        console.log('已发送通知，请用户手动点击扩展图标');
      } catch (notificationError) {
        console.log('无法发送通知:', notificationError);
      }
    }
  }
  
  // 处理重启录制
  async handleRestartRecording() {
    try {
      console.log('处理重启录制请求');
      
      // 清理录制状态
      this.clearRecording();
      
      // 清理存储中的录制信息
      await chrome.storage.local.remove([
        'recordingStatus',
        'recordingDuration',
        'recordedBlobUrl',
        'recordingFileName',
        'recordingFileSize'
      ]);
      
      console.log('录制状态已清理，可以重新开始录制');
      
      // 尝试打开popup让用户重新开始录制
      try {
        chrome.action.openPopup();
      } catch (error) {
        console.log('无法自动打开popup，用户需要手动点击扩展图标');
      }
      
    } catch (error) {
      console.error('重启录制失败:', error);
      throw error;
    }
  }
  
  // 处理打开导出页面
  async handleOpenExportPage(data) {
    try {
      console.log('处理打开导出页面请求:', data);
      
      // 保存录制数据到存储
      await chrome.storage.local.set({
        recordingStatus: data.status,
        recordingDuration: data.duration,
        recordedBlobUrl: data.blobUrl,
        recordingFileName: data.filename,
        recordingFileSize: data.fileSize
      });
      
      console.log('录制数据已保存到存储，准备打开导出页面');
      
      // 打开导出页面
              const exportUrl = chrome.runtime.getURL('export-new-extension.html');
      await chrome.tabs.create({ url: exportUrl, active: true });
      
      console.log('导出页面已打开');
      
    } catch (error) {
      console.error('打开导出页面失败:', error);
      throw error;
    }
  }
  
  // 处理获取标签页捕获流 - 使用 desktopCapture API
  async handleGetTabCaptureStream(request, sendResponse) {
    try {
      console.log('🎬 处理获取标签页捕获流请求');
      
      // 获取当前活动标签页
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) {
        throw new Error('无法获取当前标签页');
      }
      
      console.log('📱 当前标签页:', { id: tab.id, url: tab.url });
      
      // 使用 chrome.desktopCapture API 获取屏幕流
      console.log('🔧 使用 chrome.desktopCapture.chooseDesktopMedia 获取媒体流...');
      
      // 检查 API 是否可用
      if (!chrome.desktopCapture || !chrome.desktopCapture.chooseDesktopMedia) {
        throw new Error('chrome.desktopCapture API 不可用');
      }
      
      const streamId = await new Promise((resolve, reject) => {
        try {
          chrome.desktopCapture.chooseDesktopMedia(
            ['tab', 'audio'], // 明确包含 'audio' 选项
            tab,
            (streamId) => {
              if (chrome.runtime.lastError) {
                console.error('❌ chrome.runtime.lastError:', chrome.runtime.lastError);
                reject(new Error(chrome.runtime.lastError.message));
                return;
              }
              
              if (streamId) {
                console.log('✅ 屏幕流ID获取成功:', streamId);
                resolve(streamId);
              } else {
                console.error('❌ 屏幕流选择失败');
                reject(new Error('用户取消了屏幕选择'));
              }
            }
          );
        } catch (apiError) {
          console.error('❌ chrome.desktopCapture API 调用失败:', apiError);
          reject(new Error(`API 调用失败: ${apiError.message}`));
        }
      });
      
      console.log('✅ 屏幕流ID获取成功');
      
      // 将 streamId 返回给 content script，让 content script 使用 getUserMedia 获取实际流
      sendResponse({
        success: true,
        streamId: streamId,
        message: '屏幕流选择成功，请在content script中获取媒体流'
      });
      
    } catch (error) {
      console.error('❌ 获取标签页捕获流失败:', error);
      sendResponse({
        success: false,
        error: error.message
      });
    }
  }
  
  // 方案A：停止标签页捕获录制
  async handleStopTabCaptureRecording(request, sendResponse) {
    try {
      console.log('🛑 方案A：停止background录制...');
      
      if (this.currentMediaRecorder && this.currentMediaRecorder.state !== 'inactive') {
        this.currentMediaRecorder.stop();
        console.log('✅ 方案A：background录制已停止');
      }
      
      if (this.currentStream) {
        this.currentStream.getTracks().forEach(track => track.stop());
        console.log('✅ 方案A：流已停止');
      }
      
      // 清理引用
      this.currentMediaRecorder = null;
      this.currentStream = null;
      
      sendResponse({
        success: true,
        message: 'background录制已停止'
      });
      
    } catch (error) {
      console.error('❌ 方案A：停止background录制失败:', error);
      sendResponse({
        success: false,
        error: error.message
      });
    }
  }
  
  initializeExtension() {
    console.log('ScreenCatch 扩展初始化');
    
    // 设置默认配置
    chrome.storage.sync.get(['videoQuality', 'audioEnabled', 'format'], (result) => {
      const defaults = {
        videoQuality: result.videoQuality || 'high',
        audioEnabled: result.audioEnabled !== undefined ? result.audioEnabled : true,
        format: result.format || 'webm'
      };
      
      chrome.storage.sync.set(defaults, () => {
        console.log('默认配置已设置:', defaults);
      });
    });
  }
  
  // 🔥 新增：IndexedDB相关函数
  
  // 初始化IndexedDB数据库
  async initDatabase() {
    try {
      console.log('🔄 Service Worker 开始初始化IndexedDB数据库...');
      
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
        
        request.onerror = () => {
          console.error('❌ Service Worker 数据库打开失败:', request.error);
          reject(request.error);
        };
        
        request.onupgradeneeded = (event) => {
          console.log('🔄 Service Worker 数据库升级中...');
          const db = event.target.result;
          
          // 创建录制数据存储
          if (!db.objectStoreNames.contains(this.STORE_NAME)) {
            console.log('🔄 Service Worker 创建录制数据存储...');
            const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
            store.createIndex('timestamp', 'timestamp', { unique: false });
            store.createIndex('status', 'status', { unique: false });
            console.log('✅ Service Worker 创建录制数据存储成功');
          } else {
            console.log('✅ Service Worker 录制数据存储已存在');
          }
        };
        
        request.onsuccess = (event) => {
          // 🔥 修复：添加保护性检查
          if (!event || !event.target || !event.target.result) {
            console.error('❌ Service Worker IndexedDB事件对象异常:', event);
            reject(new Error('IndexedDB事件对象异常'));
            return;
          }
          
          this.db = event.target.result;
          console.log('✅ Service Worker IndexedDB数据库连接成功');
          console.log('🔍 数据库名称:', this.db.name);
          console.log('🔍 数据库版本:', this.db.version);
          console.log('🔍 对象存储名称:', Array.from(this.db.objectStoreNames));
          resolve(this.db);
        };
        
        request.onblocked = () => {
          console.warn('⚠️ Service Worker 数据库被阻塞，可能需要关闭其他连接');
        };
      });
      
    } catch (error) {
      console.error('❌ Service Worker 初始化IndexedDB失败:', error);
      throw error;
    }
  }
  
  // 保存录制数据到IndexedDB
  async saveRecordingData(recordingData) {
    try {
      if (!this.db) {
        await this.initDatabase();
      }
      
      console.log('💾 Service Worker 保存录制数据到IndexedDB...');
      
      // 🔥 修复：处理Blob和Blob URL数据
      if (recordingData.blob && recordingData.blob instanceof Blob) {
        console.log('🔄 处理直接Blob数据...');
        // 直接Blob数据，保持原样
        console.log('✅ Blob数据保持原样，大小:', recordingData.blob.size, 'bytes');
      } else if (recordingData.blobUrl && typeof recordingData.blobUrl === 'string') {
        console.log('🔄 处理Blob URL数据...');
        // Blob URL数据，保持URL引用
        console.log('✅ Blob URL数据保持原样:', recordingData.blobUrl);
      } else if (recordingData.arrayData && Array.isArray(recordingData.arrayData)) {
        console.log('🔄 将数组数据转换为ArrayBuffer（兼容旧版本）...');
        const uint8Array = new Uint8Array(recordingData.arrayData);
        const arrayBuffer = uint8Array.buffer;
        
        // 替换数组数据为ArrayBuffer
        recordingData.arrayBuffer = arrayBuffer;
        delete recordingData.arrayData;  // 删除原始数组数据以节省空间
        
        console.log('✅ 数组转换为ArrayBuffer完成，大小:', arrayBuffer.byteLength, 'bytes');
      } else {
        console.warn('⚠️ 未识别的数据格式，尝试直接保存');
      }
      
      return new Promise((resolve, reject) => {
        try {
          const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
          const store = transaction.objectStore(this.STORE_NAME);
          
          const request = store.add(recordingData);
          
          request.onsuccess = () => {
            console.log('✅ Service Worker 录制数据已保存到IndexedDB, ID:', recordingData.id);
            resolve(recordingData.id);
          };
          
          request.onerror = () => {
            console.error('❌ Service Worker IndexedDB保存失败:', request.error);
            reject(request.error);
          };
          
          transaction.onerror = () => {
            console.error('❌ Service Worker IndexedDB事务失败:', transaction.error);
            reject(transaction.error);
          };
          
        } catch (transactionError) {
          console.error('❌ Service Worker 创建IndexedDB事务失败:', transactionError);
          reject(transactionError);
        }
      });
      
    } catch (error) {
      console.error('❌ Service Worker IndexedDB操作失败:', error);
      throw error;
    }
  }
  
  // 🆕 新增：Blob传输处理函数
  async handleBlobTransfer(blobData) {
    try {
      console.log('📦 处理Blob传输数据...');
      
      if (blobData.blob && blobData.blob instanceof Blob) {
        console.log('✅ 直接Blob传输，大小:', blobData.blob.size, 'bytes');
        return { success: true, transferType: 'directBlob', size: blobData.blob.size };
      } else if (blobData.blobUrl && typeof blobData.blobUrl === 'string') {
        console.log('✅ Blob URL传输，URL:', blobData.blobUrl);
        return { success: true, transferType: 'blobUrl', url: blobData.blobUrl };
      } else {
        console.warn('⚠️ 未知的Blob传输格式');
        return { success: false, error: '未知的Blob传输格式' };
      }
      
    } catch (error) {
      console.error('❌ Blob传输处理失败:', error);
      throw error;
    }
  }
  
  // 从IndexedDB加载录制数据
  async loadRecordingData(id) {
    try {
      if (!this.db) {
        await this.initDatabase();
      }
      
      console.log('🔄 Service Worker 从IndexedDB加载录制数据, ID:', id);
      
      return new Promise((resolve, reject) => {
        try {
          const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
          const store = transaction.objectStore(this.STORE_NAME);
          
          const request = store.get(id);
          
          request.onsuccess = (event) => {
            // 🔥 修复：添加保护性检查
            if (!event || !event.target) {
              console.error('❌ Service Worker IndexedDB查询事件对象异常:', event);
              reject(new Error('IndexedDB查询事件对象异常'));
              return;
            }
            
            if (event.target.result) {
              console.log('✅ Service Worker 从IndexedDB成功加载录制数据');
              console.log('🔍 加载的数据结构:', {
                id: event.target.result.id,
                hasBlob: !!event.target.result.blob,
                blobSize: event.target.result.blob?.size,
                hasBlobUrl: !!event.target.result.blobUrl,
                blobUrl: event.target.result.blobUrl,
                hasArrayBuffer: !!event.target.result.arrayBuffer,
                arrayBufferSize: event.target.result.arrayBuffer?.byteLength,
                hasArrayData: !!event.target.result.arrayData,
                arrayDataLength: event.target.result.arrayData?.length,
                blobSize: event.target.result.blobSize,
                format: event.target.result.format
              });
              resolve(event.target.result);
            } else {
              console.error('❌ Service Worker 未找到指定的录制数据, ID:', id);
              reject(new Error(`未找到指定的录制数据 (ID: ${id})`));
            }
          };
          
          request.onerror = () => {
            console.error('❌ Service Worker IndexedDB加载失败:', request.error);
            reject(request.error);
          };
          
        } catch (error) {
          console.error('❌ Service Worker 创建IndexedDB查询事务失败:', error);
          reject(error);
        }
      });
      
    } catch (error) {
      console.error('❌ Service Worker 从IndexedDB加载录制数据失败:', error);
      throw error;
    }
  }
  
  // 🆕 新增：预加载html2canvas到所有标签页（优化版）
  async preloadHtml2Canvas() {
    try {
      console.log('🚀 开始预加载html2canvas到活动标签页...');
      
      // 只预加载当前活动的标签页
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!activeTab) {
        console.log('📍 未找到活动标签页');
        return;
      }
      
      // 跳过不支持脚本注入的页面
      if (!activeTab.url || activeTab.url.startsWith('chrome://') || activeTab.url.startsWith('edge://') || activeTab.url.startsWith('about:')) {
        console.log('📍 活动标签页不支持脚本注入');
        return;
      }
      
      // 检查是否已经预加载过
      const checkResult = await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: () => {
          return typeof html2canvas !== 'undefined' && typeof html2canvas === 'function';
        }
      });
      
      if (checkResult && checkResult[0] && checkResult[0].result === true) {
        console.log(`✅ 活动标签页 ${activeTab.id} html2canvas已预加载，无需重复注入`);
        return;
      }
      
      // 注入html2canvas
      await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        files: ['html2canvas.min.js']
      });
      
      // 等待初始化完成
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log(`✅ 活动标签页 ${activeTab.id} html2canvas预加载成功`);
      
    } catch (error) {
      console.error('❌ html2canvas预加载失败:', error);
    }
  }
  
  // 🆕 新增：处理html2canvas注入（优化版）
  async handleInjectHtml2Canvas(request, sender, sendResponse) {
    try {
      console.log('🖼️ 检查html2canvas是否已预加载...');
      
      // 获取当前活动标签页
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id) {
        throw new Error('无法获取当前标签页');
      }
      
      console.log('📍 目标标签页:', tab.id, tab.url);
      
      // 首先检查html2canvas是否已经可用
      const checkResult = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          return typeof html2canvas !== 'undefined' && typeof html2canvas === 'function';
        }
      });
      
      if (checkResult && checkResult[0] && checkResult[0].result === true) {
        console.log('✅ html2canvas已预加载，无需重新注入');
        sendResponse({ success: true, message: 'html2canvas已可用' });
        return;
      }
      
      // 如果没有预加载，则注入
      console.log('🔄 html2canvas未预加载，开始注入...');
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['html2canvas.min.js']
      });
      
      console.log('✅ html2canvas脚本注入成功');
      
      // 🆕 优化：减少等待时间
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 验证html2canvas是否可用
      const result = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          return typeof html2canvas !== 'undefined' && typeof html2canvas === 'function';
        }
      });
      
      if (result && result[0] && result[0].result === true) {
        console.log('✅ html2canvas验证成功，可以开始截图');
        sendResponse({ success: true, message: 'html2canvas注入成功' });
      } else {
        throw new Error('html2canvas注入后验证失败');
      }
      
    } catch (error) {
      console.error('❌ html2canvas注入失败:', error);
      sendResponse({ success: false, error: error.message });
    }
  }
  
  // 全屏录制控制标签页创建方法已移除
  
  // 🆕 新增：处理全屏录制暂停/继续
  async handleTogglePause(request, sendResponse) {
    try {
      console.log('⏸️ 处理全屏录制暂停/继续...');
      
      // 获取录制状态
      const status = await chrome.storage.local.get(['recordingStatus', 'controlTabId']);
      
      if (status.recordingStatus === 'paused') {
        // 继续录制
        await chrome.storage.local.set({ recordingStatus: 'active' });
        console.log('✅ 录制已继续');
        sendResponse({ success: true, status: 'active', message: '录制已继续' });
      } else {
        // 暂停录制
        await chrome.storage.local.set({ recordingStatus: 'paused' });
        console.log('✅ 录制已暂停');
        sendResponse({ success: true, status: 'paused', message: '录制已暂停' });
      }
      
    } catch (error) {
      console.error('❌ 处理暂停/继续失败:', error);
      sendResponse({ success: false, error: error.message });
    }
  }
  
  // 🆕 新增：处理全屏录制停止
  async handleStopFullscreenRecording(request, sendResponse) {
    try {
      console.log('⏹️ 处理停止全屏录制...');
      
      // 获取录制状态
      const status = await chrome.storage.local.get(['sourceTabId']);
      
      if (status.sourceTabId) {
        // 发送停止录制消息到源标签页
        try {
          await chrome.tabs.sendMessage(status.sourceTabId, {
            action: 'stopFullscreenRecording'
          });
          console.log('✅ 停止录制消息已发送到源标签页');
        } catch (messageError) {
          console.warn('⚠️ 无法发送消息到源标签页:', messageError);
        }
      }
      
      // 清理存储状态
      await chrome.storage.local.remove([
        'recordingStatus', 'startTime', 'mode', 'sourceTabId'
      ]);
      
      console.log('✅ 全屏录制已停止，状态已清理');
      sendResponse({ success: true, message: '录制已停止' });
      
    } catch (error) {
      console.error('❌ 处理停止录制失败:', error);
      sendResponse({ success: false, error: error.message });
    }
  }
}

// 启动服务
const screenCatch = new ScreenCatchServiceWorker();

// 扩展启动时恢复状态
chrome.runtime.onStartup.addListener(() => {
  screenCatch.restoreRecordingState();
});

// 扩展挂起时清理资源
chrome.runtime.onSuspend.addListener(() => {
  console.log('扩展即将挂起，清理资源...');
  screenCatch.clearRecording();
  
  // 清理Blob传输会话
  if (screenCatch.blobTransferSession) {
    screenCatch.blobTransferSession = null;
    console.log('Blob传输会话已清理');
  }
});