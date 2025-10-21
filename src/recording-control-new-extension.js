// 录制控制界面 - 严格按照UI-2 Timer设计
class RecordingControl {
  constructor() {
    this.isRecording = false;
    this.isPaused = false;
    this.recordingStartTime = null;
    this.pauseStartTime = null;
    this.totalPauseTime = 0;
    this.recordingId = null;
    
    this.initializeElements();
    this.bindEvents();
    this.loadRecordingInfo();
  }

  initializeElements() {
    this.statusDisplay = document.getElementById('statusDisplay');
    this.downloadBtn = document.getElementById('downloadBtn');
    this.playPauseBtn = document.getElementById('playPauseBtn');
    this.resetBtn = document.getElementById('resetBtn');
    this.playPauseIcon = document.getElementById('playPauseIcon');
    this.container = document.getElementById('recordingContainer');
  }

  bindEvents() {
    this.downloadBtn.addEventListener('click', () => this.handleDownload());
    this.playPauseBtn.addEventListener('click', () => this.handlePlayPause());
    this.resetBtn.addEventListener('click', () => this.handleReset());
  }

  loadRecordingInfo() {
    // 从URL参数获取录制ID
    const urlParams = new URLSearchParams(window.location.search);
    this.recordingId = urlParams.get('id');
    
    if (this.recordingId) {
      this.checkRecordingStatus();
    } else {
      this.statusDisplay.textContent = 'No Recording';
      this.disableControls();
    }
  }

  async checkRecordingStatus() {
    try {
      // 检查录制状态
      const response = await chrome.runtime.sendMessage({
        action: 'getRecordingStatus',
        recordingId: this.recordingId
      });

      if (response && response.status) {
        this.updateStatus(response.status);
        if (response.status === 'recording') {
          this.startRecording();
        }
      }
    } catch (error) {
      console.error('Error checking recording status:', error);
      this.statusDisplay.textContent = 'Error';
    }
  }

  updateStatus(status) {
    this.container.className = 'container';
    
    switch (status) {
      case 'ready':
        this.statusDisplay.textContent = 'Ready';
        this.container.classList.add('ready');
        break;
      case 'recording':
        this.statusDisplay.textContent = 'Recording...';
        this.container.classList.add('recording');
        break;
      case 'paused':
        this.statusDisplay.textContent = 'Paused';
        this.container.classList.add('paused');
        break;
      case 'completed':
        this.statusDisplay.textContent = 'Completed';
        this.container.classList.add('completed');
        break;
      default:
        this.statusDisplay.textContent = status;
    }
  }

  startRecording() {
    this.isRecording = true;
    this.recordingStartTime = Date.now();
    this.updateStatus('recording');
    this.updatePlayPauseIcon();
  }

  pauseRecording() {
    if (this.isRecording && !this.isPaused) {
      this.isPaused = true;
      this.pauseStartTime = Date.now();
      this.updateStatus('paused');
      this.updatePlayPauseIcon();
    }
  }

  resumeRecording() {
    if (this.isRecording && this.isPaused) {
      this.isPaused = false;
      if (this.pauseStartTime) {
        this.totalPauseTime += Date.now() - this.pauseStartTime;
      }
      this.updateStatus('recording');
      this.updatePlayPauseIcon();
    }
  }

  stopRecording() {
    this.isRecording = false;
    this.isPaused = false;
    this.updateStatus('completed');
    this.updatePlayPauseIcon();
  }

  updatePlayPauseIcon() {
    if (this.isRecording) {
      if (this.isPaused) {
        // 显示播放图标
        this.playPauseIcon.innerHTML = '<path d="M8 5v14l11-7z"/>';
      } else {
        // 显示暂停图标
        this.playPauseIcon.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
      }
    } else {
      // 显示播放图标
      this.playPauseIcon.innerHTML = '<path d="M8 5v14l11-7z"/>';
    }
  }

  async handleDownload() {
    if (!this.recordingId) {
      this.statusDisplay.textContent = 'No File';
      return;
    }

    try {
      this.downloadBtn.disabled = true;
      
      const response = await chrome.runtime.sendMessage({
        action: 'downloadRecording',
        recordingId: this.recordingId
      });

      if (response && response.success) {
        this.statusDisplay.textContent = 'Downloaded!';
        setTimeout(() => {
          this.updateStatus('completed');
        }, 2000);
      } else {
        this.statusDisplay.textContent = 'Download Failed';
      }
    } catch (error) {
      console.error('Download error:', error);
      this.statusDisplay.textContent = 'Error';
    } finally {
      this.downloadBtn.disabled = false;
    }
  }

  handlePlayPause() {
    if (!this.isRecording) return;

    if (this.isPaused) {
      this.resumeRecording();
    } else {
      this.pauseRecording();
    }
  }

  handleReset() {
    this.isRecording = false;
    this.isPaused = false;
    this.recordingStartTime = null;
    this.pauseStartTime = null;
    this.totalPauseTime = 0;
    this.updateStatus('ready');
    this.updatePlayPauseIcon();
  }

  disableControls() {
    this.downloadBtn.disabled = true;
    this.playPauseBtn.disabled = true;
    this.resetBtn.disabled = true;
  }

  getRecordingDuration() {
    if (!this.recordingStartTime) return 0;
    
    const currentTime = this.isPaused ? this.pauseStartTime : Date.now();
    return currentTime - this.recordingStartTime - this.totalPauseTime;
  }
}

// 初始化录制控制界面
document.addEventListener('DOMContentLoaded', () => {
  new RecordingControl();
});