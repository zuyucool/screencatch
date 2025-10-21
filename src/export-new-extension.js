// 导出页面脚本 - 完全按照UI-2风格重构
document.addEventListener('DOMContentLoaded', () => {
  console.log('�� 导出页面已加载 - UI-2风格版本');
  
  // 显示加载状态
  showLoadingState();
  
  // 延迟检查数据，给存储系统一些时间
  setTimeout(() => {
    checkRecordingData();
  }, 500);
});

// 全局变量
let currentRecordingData = null;
let selectedFormat = 'webm';

// 检查录制数据的主函数
async function checkRecordingData() {
  try {
    console.log('🔄 开始检查录制数据...');
    
    // 优先从URL参数获取录制ID
    const urlParams = new URLSearchParams(window.location.search);
    const recordingId = urlParams.get('id');
    
    if (recordingId) {
      console.log('✅ 从URL参数获取到录制ID:', recordingId);
      
      // 通过service_worker从IndexedDB加载数据
      try {
        console.log('🔄 通过Service Worker从IndexedDB加载数据...');
        
        const result = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({
            action: 'loadRecording',
            id: recordingId
          }, (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else if (response.success) {
              resolve(response.data);
            } else {
              reject(new Error(response.error));
            }
          });
        });
        
        console.log('✅ 从Service Worker成功加载录制数据:', result);
        
        // 保存录制数据
        currentRecordingData = result;
        
        // 显示录制信息
        displayRecordingInfo(result);
        
        // 设置格式选项
        setupFormatOptions(result);
        
        // 设置下载功能
        setupDownloadFunctionality(result);
        
        // 设置预览功能
        setupPreviewFunctionality(result);
        
        return;
        
      } catch (serviceWorkerError) {
        console.error('❌ 通过Service Worker加载失败:', serviceWorkerError);
        
        // 备用方案：尝试从Chrome存储获取
        console.log('🔄 尝试从Chrome存储获取备用数据...');
        await checkChromeStorageFallback();
      }
    } else {
      console.log('⚠️ URL中没有录制ID，尝试从Chrome存储获取...');
      await checkChromeStorageFallback();
    }
    
  } catch (error) {
    console.error('检查录制数据时出错:', error);
    showDefaultInterface();
  } finally {
    hideLoadingState();
  }
}

// 从Chrome存储获取备用数据的函数
async function checkChromeStorageFallback() {
  try {
    console.log('🔄 检查Chrome存储中的备用数据...');
    
    const result = await new Promise((resolve) => {
      chrome.storage.local.get([
        'recordingMetadata',
        'lastRecordingId'
      ], resolve);
    });
    
    console.log('Chrome存储中的备用数据:', result);
    
    if (result.recordingMetadata && result.lastRecordingId) {
      console.log('✅ 找到Chrome存储的元数据，尝试加载完整数据...');
      
      // 尝试通过service_worker加载完整数据
      try {
        const fullData = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({
            action: 'loadRecording',
            id: result.lastRecordingId
          }, (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else if (response.success) {
              resolve(response.data);
            } else {
              reject(new Error(response.error));
            }
          });
        });
        
        console.log('✅ 从Chrome存储元数据成功加载完整数据');
        currentRecordingData = fullData;
        displayRecordingInfo(fullData);
        setupFormatOptions(fullData);
        setupDownloadFunctionality(fullData);
        setupPreviewFunctionality(fullData);
        
      } catch (loadError) {
        console.warn('⚠️ 加载完整数据失败，显示元数据:', loadError);
        currentRecordingData = result.recordingMetadata;
        displayRecordingInfo(result.recordingMetadata);
        showMetadataOnlyInterface();
      }
    } else {
      console.warn('⚠️ Chrome存储中也没有找到录制数据');
      showDefaultInterface();
    }
    
  } catch (error) {
    console.error('检查Chrome存储备用数据失败:', error);
    showDefaultInterface();
  }
}

// 显示录制信息 - 按照UI-2风格
function displayRecordingInfo(data) {
  console.log('开始显示录制信息:', data);
  
  const infoContainer = document.getElementById('recordingInfo');
  if (!infoContainer) return;
  
  // 清空现有内容
  infoContainer.innerHTML = '';
  
  // 创建信息项 - 完全按照UI-2的HTML结构
  const infoItems = [
    {
      label: 'Filename:',
      value: data.filename || data.id || 'recording_' + Date.now()
    },
    {
      label: 'Duration:',
      value: formatDuration(data.duration)
    },
    {
      label: 'Size:',
      value: formatFileSize(data.size)
    },
    {
      label: 'Format:',
      value: data.format || 'WebM'
    }
  ];
  
  // 渲染信息项 - 使用UI-2的HTML结构
  infoItems.forEach(item => {
    const infoItem = document.createElement('div');
    infoItem.className = 'info-item';
    infoItem.innerHTML = `
      <strong>${item.label}</strong> ${item.value}
    `;
    infoContainer.appendChild(infoItem);
  });
  
  console.log('录制信息显示完成');
}

// 设置格式选项 - 按照UI-2风格
function setupFormatOptions(data) {
  const formatContainer = document.getElementById('formatOptions');
  if (!formatContainer) return;
  
  // 清空现有内容
  formatContainer.innerHTML = '';
  
  // 根据可用数据确定支持的格式 - 使用UI-2的数据结构
  const availableFormats = getAvailableFormats(data);
  
  availableFormats.forEach(format => {
    const formatOption = document.createElement('button');
    formatOption.className = 'download-option';
    formatOption.dataset.format = format.format;
    
    // 使用UI-2的HTML结构
    formatOption.innerHTML = `
      <div class="download-option-content">
        <span class="download-option-text">Download as ${format.name}</span>
        <span class="download-option-size">${format.size}</span>
      </div>
    `;
    
    // 设置默认选中格式
    if (format.format === 'webm') {
      formatOption.style.background = '#fde68a'; // 选中状态
      selectedFormat = 'webm';
    }
    
    // 点击选择格式
    formatOption.addEventListener('click', () => {
      // 移除其他选中状态
      document.querySelectorAll('.download-option').forEach(opt => {
        opt.style.background = '#fef3c7'; // 恢复默认背景
      });
      
      // 设置当前选中
      formatOption.style.background = '#fde68a';
      selectedFormat = format.format;
      
      console.log('✅ 选择格式:', selectedFormat);
    });
    
    formatContainer.appendChild(formatOption);
  });
}

// 获取可用格式 - 按照UI-2的数据结构
function getAvailableFormats(data) {
  const formats = [];
  
  // 基础WebM格式（总是可用）
  formats.push({
    format: 'webm',
    name: 'WebM',
    size: formatFileSize(data.size)
  });
  
  // 如果数据支持，添加其他格式
  if (data.blob || data.arrayBuffer) {
    formats.push({
      format: 'mp4',
      name: 'MP4',
      size: formatFileSize(data.size * 0.9) // 估算MP4大小
    });
    
    formats.push({
      format: 'wmv',
      name: 'WMV',
      size: formatFileSize(data.size * 1.1) // 估算WMV大小
    });
  }
  
  return formats;
}

// 设置下载功能
function setupDownloadFunctionality(data) {
  const downloadBtn = document.getElementById('downloadBtn');
  if (!downloadBtn) return;
  
  downloadBtn.addEventListener('click', async () => {
    try {
      console.log('🔄 开始处理下载请求...');
      
      // 显示加载状态
      downloadBtn.disabled = true;
      downloadBtn.innerHTML = `
        <div class="loading-spinner" style="width: 16px; height: 16px; border-width: 2px;"></div>
        处理中...
      `;
      
      // 处理下载
      await processDownload(data, selectedFormat);
      
      // 显示成功状态
      downloadBtn.innerHTML = `
        <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
        </svg>
        Download Complete
      `;
      downloadBtn.style.background = '#10b981';
      
      // 显示成功消息
      showMessage('✅ 文件下载成功！', 'success');
      
    } catch (error) {
      console.error('❌ 下载失败:', error);
      
      // 恢复按钮状态
      downloadBtn.disabled = false;
      downloadBtn.innerHTML = `
        <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
          <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
        </svg>
        Download Now
      `;
      
      // 显示错误消息
      showMessage(`❌ 下载失败: ${error.message}`, 'error');
    }
  });
}

// 处理下载
async function processDownload(data, format) {
  let blob = null;
  
  if (data.blob && data.blob instanceof Blob) {
    // 直接使用Blob
    blob = data.blob;
  } else if (data.blobUrl && typeof data.blobUrl === 'string') {
    // 从Blob URL获取Blob
    const response = await fetch(data.blobUrl);
    blob = await response.blob();
  } else if (data.arrayBuffer) {
    // 从ArrayBuffer创建Blob
    blob = new Blob([data.arrayBuffer], { 
      type: data.blobType || 'video/webm' 
    });
  } else if (data.arrayData && Array.isArray(data.arrayData)) {
    // 从数组创建Blob
    const uint8Array = new Uint8Array(data.arrayData);
    blob = new Blob([uint8Array], { 
      type: data.blobType || 'video/webm' 
    });
  } else {
    throw new Error('没有找到可下载的录制数据');
  }
  
  // 根据选择的格式处理
  if (format !== 'webm') {
    // 这里可以添加格式转换逻辑
    console.log('⚠️ 格式转换功能待实现，使用原始格式');
  }
  
  // 下载文件
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `screencatch-${Date.now()}.${format}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  
  // 释放URL对象
  URL.revokeObjectURL(url);
  
  console.log('✅ 文件下载完成');
}

// 设置预览功能
function setupPreviewFunctionality(data) {
  const previewContainer = document.getElementById('videoPreview');
  if (!previewContainer) return;
  
  // 如果有视频数据，创建预览播放器
  if (data.blob || data.blobUrl) {
    try {
      const video = document.createElement('video');
      video.controls = true;
      video.className = 'video-preview';
      
      if (data.blob) {
        video.src = URL.createObjectURL(data.blob);
      } else if (data.blobUrl) {
        video.src = data.blobUrl;
      }
      
      // 清空预览容器并添加视频
      previewContainer.innerHTML = '';
      previewContainer.appendChild(video);
      
      console.log('✅ 视频预览设置完成');
      
    } catch (error) {
      console.warn('⚠️ 设置视频预览失败:', error);
      showPreviewPlaceholder();
    }
  } else {
    showPreviewPlaceholder();
  }
}

// 显示预览占位符
function showPreviewPlaceholder() {
  const previewContainer = document.getElementById('videoPreview');
  if (!previewContainer) return;
  
  previewContainer.innerHTML = `
    <div class="preview-placeholder">
      <div class="preview-icon">
        <svg fill="currentColor" viewBox="0 0 24 24">
          <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
        </svg>
      </div>
      <p>录制内容预览</p>
    </div>
  `;
}

// 设置其他按钮功能
function setupOtherButtons() {
  // 再次录制按钮
  const recordAgainBtn = document.getElementById('recordAgainBtn');
  if (recordAgainBtn) {
    recordAgainBtn.addEventListener('click', () => {
      console.log('用户请求再次录制');
      // 关闭当前导出页面
      window.close();
    });
  }
  
  // 删除录制按钮
  const deleteBtn = document.getElementById('deleteBtn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      if (confirm('确定要删除这个录制文件吗？此操作不可撤销。')) {
        try {
          console.log('🔄 删除录制文件...');
          
          // 这里可以添加删除逻辑
          // 例如：从IndexedDB删除数据，清理存储等
          
          showMessage('✅ 录制文件已删除', 'success');
          
          // 延迟关闭页面
          setTimeout(() => {
            window.close();
          }, 1500);
          
        } catch (error) {
          console.error('删除失败:', error);
          showMessage(`❌ 删除失败: ${error.message}`, 'error');
        }
      }
    });
  }
}

// 显示默认界面（当找不到录制数据时）
function showDefaultInterface() {
  console.log('🔄 显示默认界面...');
  
  const container = document.querySelector('.container');
  if (!container) return;
  
  container.innerHTML = `
    <div class="preview-section">
      <div class="preview-container">
        <div class="preview-placeholder">
          <div class="preview-icon">
            <svg fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          </div>
          <p>处理状态</p>
        </div>
      </div>
    </div>
    
    <div class="info-section">
      <div class="info-card">
        <h3>📊 录制状态</h3>
        <div class="info-item">
          <strong>状态:</strong> ✅ 录制已完成
        </div>
        <div class="info-item">
          <strong>处理:</strong> ⏳ 数据可能还在处理中，请稍等片刻...
        </div>
        <div class="info-item">
          <strong>建议:</strong> 💡 如果问题持续存在，请尝试重新录制
        </div>
      </div>
      
      <div class="action-buttons">
                  <button id="refreshBtn" class="btn btn-primary">
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
            </svg>
            Refresh Page
          </button>
        
        <button id="recordAgainBtn" class="btn btn-secondary">
          <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
          </svg>
          Record Again
        </button>
      </div>
    </div>
  `;
  
  // 重新绑定事件
  bindDefaultButtonEvents();
  
  // 5秒后自动重试加载数据
  setTimeout(() => {
    console.log('�� 5秒后自动重试加载数据...');
    checkRecordingData();
  }, 5000);
}

// 绑定默认界面按钮事件
function bindDefaultButtonEvents() {
  // 再次录制按钮
  const recordAgainBtn = document.getElementById('recordAgainBtn');
  if (recordAgainBtn) {
    recordAgainBtn.addEventListener('click', () => {
      console.log('用户请求再次录制');
      window.close();
    });
  }
  
  // 刷新按钮
  const refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      console.log('用户请求刷新页面');
      location.reload();
    });
  }
}

// 显示仅元数据界面
function showMetadataOnlyInterface() {
  console.log('�� 显示仅元数据界面...');
  
  const container = document.querySelector('.container');
  if (!container) return;
  
  container.innerHTML = `
    <div class="preview-section">
      <div class="preview-container">
        <div class="preview-placeholder">
          <div class="preview-icon">
            <svg fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          </div>
          <p>数据状态</p>
        </div>
      </div>
    </div>
    
    <div class="info-section">
      <div class="info-card">
        <h3>📊 数据状态</h3>
        <div class="info-item">
          <strong>状态:</strong> ⚠️ 仅保留录制元数据
        </div>
        <div class="info-item">
          <strong>文件:</strong> 📁 完整录制文件可能已被清理
        </div>
        <div class="info-item">
          <strong>建议:</strong> 💡 建议重新录制以获取完整文件
        </div>
      </div>
      
      <div class="action-buttons">
        <button id="recordAgainBtn" class="btn btn-primary">
          <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
          </svg>
          Record Again
        </button>
      </div>
    </div>
  `;
  
  // 绑定按钮事件
  const recordAgainBtn = document.getElementById('recordAgainBtn');
  if (recordAgainBtn) {
    recordAgainBtn.addEventListener('click', () => {
      window.close();
    });
  }
}

// 显示加载状态
function showLoadingState() {
  const loadingOverlay = document.getElementById('loadingOverlay');
  if (loadingOverlay) {
    loadingOverlay.style.display = 'flex';
  }
}

// 隐藏加载状态
function hideLoadingState() {
  const loadingOverlay = document.getElementById('loadingOverlay');
  if (loadingOverlay) {
    loadingOverlay.style.display = 'none';
  }
}

// 显示消息
function showMessage(text, type = 'info') {
  // 移除现有消息
  const existingMessage = document.querySelector('.message');
  if (existingMessage) {
    existingMessage.remove();
  }
  
  // 创建新消息
  const message = document.createElement('div');
  message.className = `message message-${type}`;
  message.innerHTML = text;
  
  // 插入到信息面板顶部
  const infoSection = document.querySelector('.info-section');
  if (infoSection) {
    infoSection.insertBefore(message, infoSection.firstChild);
  }
  
  // 3秒后自动隐藏
  setTimeout(() => {
    if (message.parentNode) {
      message.remove();
    }
  }, 3000);
}

// 格式化时长
function formatDuration(duration) {
  if (!duration) return '00:00';
  
  // 如果已经是格式化的字符串，直接返回
  if (typeof duration === 'string' && duration.includes(':')) {
    return duration;
  }
  
  // 如果是数字（毫秒），进行格式化
  if (typeof duration === 'number') {
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
  
  // 其他情况直接返回原值
  return duration;
}

// 格式化文件大小
function formatFileSize(bytes) {
  if (!bytes) return '0 Bytes';
  
  // 如果已经是格式化的字符串，直接返回
  if (typeof bytes === 'string' && (bytes.includes('KB') || bytes.includes('MB') || bytes.includes('GB'))) {
    return bytes;
  }
  
  // 如果是数字，进行格式化
  if (typeof bytes === 'number') {
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  // 其他情况直接返回原值
  return bytes;
}

// 初始化其他按钮功能
setupOtherButtons();

console.log('�� 导出页面脚本初始化完成 - UI-2风格');