// ScreenCatch 内容脚本 - 在网页上下文中录制
// 使用 getDisplayMedia API，确保授权弹窗正常显示

// 立即执行函数，避免全局作用域污染
(function() {
// 防止重复注入
if (window.voiceCatchLoaded) {
  console.log('⚠️ ScreenCatch 已加载，跳过重复注入');
    return;
  }
  window.voiceCatchLoaded = true;

  // 🌍 国际化功能 - 简化版本，用于content_script
  function createSimpleI18n() {
    const messages = {
      en: {
        'content.ui.textInputPlaceholder': 'Enter text...',
        'content.ui.deleteText': '🗑️ Delete',
        'content.ui.cancel': '❌ Cancel',
        'content.ui.confirm': 'Confirm',
        'content.ui.deleteTextTitle': '📝 Delete Text: "{text}"'
      },
      zh: {
        'content.ui.textInputPlaceholder': '输入文字...',
        'content.ui.deleteText': '🗑️ 删除',
        'content.ui.cancel': '❌ 取消',
        'content.ui.confirm': '确定',
        'content.ui.deleteTextTitle': '📝 删除文字: "{text}"'
      }
    };

    // 强制锁定英文，准备发布
    const detectLanguage = () => {
      console.log('🌍 content_script：强制锁定英文');
      return 'en';
    };

    const currentLang = detectLanguage();
    console.log('🌍 content_script 最终选择的语言:', currentLang);
    
    return {
      t: function(key, params = {}) {
        const message = messages[currentLang][key] || messages.en[key] || key;
        if (params && typeof params === 'object') {
          return message.replace(/\{(\w+)\}/g, (match, param) => {
            return params[param] || match;
          });
        }
        return message;
      },
      getCurrentLocale: () => currentLang
    };
  }

  // 创建国际化实例 - 使用统一语言检测
  window.i18n = createSimpleI18n();
  console.log('🌍 国际化已初始化，当前语言:', window.i18n.getCurrentLocale());
  
  // 🎨 Canvas实时剪裁录制类 - 解决长时间录制崩溃问题
  class RealtimeCropRecorder {
    constructor() {
      this.canvas = null;
      this.ctx = null;
      this.video = null;
      this.mediaRecorder = null;
      this.chunks = [];
      this.isRecording = false;
      this.isPaused = false;
      this.region = null;
      this.stream = null;
      this.canvasStream = null;
      this.animationId = null;
      this.startTime = null;
      this.pauseTime = 0;
      this.pauseStartTime = null;
      console.log('🎨 RealtimeCropRecorder 初始化完成');
    }

    /**
     * 开始实时剪裁录制
     * @param {Object} region 录制区域 {left, top, width, height}
     * @param {MediaStream} originalStream 原始屏幕流
     * @returns {Promise<Object>} 录制结果
     */
    async startRecording(region, originalStream) {
      try {
        console.log('🎨 开始Canvas实时剪裁录制...');
        console.log('🎨 录制区域:', region);
        console.log('🎨 原始流:', originalStream);
        
        this.region = region;
        this.stream = originalStream;
        this.isRecording = true;
        this.isPaused = false;
        this.startTime = Date.now();
        this.pauseTime = 0;
        this.pauseStartTime = null;
        
        // 1. 创建Canvas
        this.createCanvas();
        
        // 2. 创建Canvas流
        this.createCanvasStream();
        
        // 3. 开始MediaRecorder录制
        await this.startMediaRecorder();
        
        // 4. 开始实时绘制
        this.startRealtimeDrawing();
        
        console.log('✅ Canvas实时剪裁录制启动成功');
        return {
          success: true,
          message: 'Canvas实时剪裁录制已启动',
          region: region
        };
        
      } catch (error) {
        console.error('❌ Canvas实时剪裁录制启动失败:', error);
        return {
          success: false,
          message: error.message || 'Canvas实时剪裁录制启动失败'
        };
      }
    }

    /**
     * 创建Canvas元素
     */
    createCanvas() {
      try {
        console.log('🎨 创建Canvas...');
        
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // 设置Canvas尺寸为选择区域大小
        this.canvas.width = this.region.width;
        this.canvas.height = this.region.height;
        
        // 启用图像平滑
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';
        
        console.log('✅ Canvas创建成功');
        console.log('🎨 Canvas尺寸:', this.canvas.width, 'x', this.canvas.height);
        
      } catch (error) {
        console.error('❌ Canvas创建失败:', error);
        throw error;
      }
    }

    /**
     * 创建Canvas流
     */
    createCanvasStream() {
      try {
        console.log('🎨 创建Canvas流...');
        
        // 创建Canvas流，30fps
        this.canvasStream = this.canvas.captureStream(30);
        
        console.log('✅ Canvas流创建成功');
        console.log('🎬 Canvas流轨道数:', this.canvasStream.getTracks().length);
        
      } catch (error) {
        console.error('❌ Canvas流创建失败:', error);
        throw error;
      }
    }

    /**
     * 开始MediaRecorder录制
     */
    async startMediaRecorder() {
      try {
        console.log('🎨 开始MediaRecorder录制...');
        
        // 创建混合流：视频来自Canvas，音频来自原始流
        const mixedStream = new MediaStream();
        
        // 添加Canvas视频轨道
        const videoTrack = this.canvasStream.getVideoTracks()[0];
        if (videoTrack) {
          mixedStream.addTrack(videoTrack);
          console.log('🎬 Canvas视频轨道已添加');
        }
        
        // 添加原始音频轨道
        const audioTrack = this.stream.getAudioTracks()[0];
        if (audioTrack) {
          mixedStream.addTrack(audioTrack);
          console.log('🎵 原始音频轨道已添加');
        } else {
          console.log('⚠️ 未找到音频轨道');
        }
        
        // 创建MediaRecorder，使用优化的参数
        this.mediaRecorder = new MediaRecorder(mixedStream, {
          mimeType: 'video/webm;codecs=vp9',
          videoBitsPerSecond: 2000000,  // 2Mbps（比原来低60%）
          audioBitsPerSecond: 64000     // 64kbps（比原来低50%）
        });
        
        this.chunks = [];
        
        this.mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            this.chunks.push(event.data);
            console.log('📦 收到数据块:', event.data.size, 'bytes');
          }
        };
        
        this.mediaRecorder.onstop = () => {
          console.log('🎬 Canvas实时剪裁录制停止');
        };
        
        // 开始录制
        this.mediaRecorder.start(1000); // 每秒一个数据块
        
        console.log('✅ MediaRecorder录制启动成功');
        
      } catch (error) {
        console.error('❌ MediaRecorder录制启动失败:', error);
        throw error;
      }
    }

    /**
     * 开始实时绘制
     */
    startRealtimeDrawing() {
      try {
        console.log('🎨 开始实时绘制...');
        
        // 创建视频元素用于绘制
        this.video = document.createElement('video');
        this.video.muted = true;
        this.video.playsInline = true;
        this.video.srcObject = this.stream;
        
        this.video.onloadedmetadata = () => {
          console.log('🎬 视频元数据加载完成');
          // 🆕 修复：视频元素需要播放才能产生视频帧
          this.video.play().then(() => {
            console.log('🎬 视频播放开始，开始绘制');
            this.drawFrame();
          }).catch((error) => {
            console.error('❌ 视频播放失败:', error);
          });
        };
        
        this.video.onerror = (error) => {
          console.error('❌ 视频加载失败:', error);
        };
        
        console.log('✅ 实时绘制启动成功');
        
      } catch (error) {
        console.error('❌ 实时绘制启动失败:', error);
        throw error;
      }
    }

    /**
     * 绘制帧
     */
    drawFrame() {
      if (!this.isRecording || this.isPaused) {
        return;
      }
      
      try {
        // 🆕 添加调试信息
        if (this.video.readyState >= 2) { // HAVE_CURRENT_DATA
          // 在Canvas上绘制剪裁区域
          this.ctx.drawImage(
            this.video,
            this.region.left, this.region.top, this.region.width, this.region.height,  // 源区域
            0, 0, this.region.width, this.region.height  // 目标区域
          );
        } else {
          console.log('🎬 视频尚未准备好，readyState:', this.video.readyState);
        }
        
        // 继续下一帧
        this.animationId = requestAnimationFrame(() => this.drawFrame());
        
      } catch (error) {
        console.error('❌ 绘制帧失败:', error);
      }
    }

    /**
     * 停止录制
     * @returns {Promise<Object>} 录制数据
     */
    async stopRecording() {
      try {
        console.log('🛑 停止Canvas实时剪裁录制...');
        
        this.isRecording = false;
        
        // 停止绘制
        if (this.animationId) {
          cancelAnimationFrame(this.animationId);
          this.animationId = null;
        }
        
        // 停止MediaRecorder
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
          this.mediaRecorder.stop();
        }
        
        // 等待录制完成
        await new Promise((resolve) => {
          if (this.mediaRecorder) {
            this.mediaRecorder.onstop = resolve;
          } else {
            resolve();
          }
        });
        
        // 创建最终的Blob
        const blob = new Blob(this.chunks, { type: 'video/webm' });
        
        console.log('✅ Canvas实时剪裁录制停止成功');
        console.log('📊 最终文件大小:', blob.size, 'bytes');
        
        // 🆕 立即清理屏幕共享流，避免用户手动停止
        if (this.stream) {
          this.stream.getTracks().forEach(track => {
            console.log('🛑 停止屏幕共享轨道:', track.kind);
            track.stop();
          });
        }
        
        // 准备录制数据（保持与原有格式一致）
        const recordingData = {
          timestamp: Date.now(),
          duration: Date.now() - this.startTime - this.pauseTime,
          format: 'webm',
          size: blob.size,
          blob: blob,
          blobType: 'video/webm',
          metadata: {
            width: this.region.width,
            height: this.region.height,
            regionX: this.region.left,
            regionY: this.region.top,
            frameRate: 30,
            recordingMode: 'region_realtime_crop',
            originalWidth: this.region.width,
            originalHeight: this.region.height
          }
        };
        
        return recordingData;
        
      } catch (error) {
        console.error('❌ 停止Canvas实时剪裁录制失败:', error);
        throw error;
      }
    }

    /**
     * 暂停录制
     */
    pauseRecording() {
      if (this.isRecording && !this.isPaused) {
        console.log('⏸️ 暂停Canvas实时剪裁录制');
        this.isPaused = true;
        this.pauseStartTime = Date.now();
        
        if (this.animationId) {
          cancelAnimationFrame(this.animationId);
          this.animationId = null;
        }
      }
    }

    /**
     * 继续录制
     */
    resumeRecording() {
      if (this.isRecording && this.isPaused) {
        console.log('▶️ 继续Canvas实时剪裁录制');
        this.isPaused = false;
        
        // 累计暂停时间
        if (this.pauseStartTime) {
          this.pauseTime += Date.now() - this.pauseStartTime;
          this.pauseStartTime = null;
        }
        
        // 重新开始绘制
        this.drawFrame();
      }
    }

    /**
     * 获取录制状态
     * @returns {Object} 状态信息
     */
    getStatus() {
      return {
        isRecording: this.isRecording,
        isPaused: this.isPaused,
        region: this.region,
        startTime: this.startTime,
        pauseTime: this.pauseTime
      };
    }

    /**
     * 清理资源
     */
    cleanup() {
      try {
        console.log('🧹 清理Canvas实时剪裁录制资源...');
        
        this.isRecording = false;
        this.isPaused = false;
        
        // 停止绘制
        if (this.animationId) {
          cancelAnimationFrame(this.animationId);
          this.animationId = null;
        }
        
        // 停止MediaRecorder
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
          this.mediaRecorder.stop();
        }
        
        // 清理视频元素
        if (this.video) {
          this.video.srcObject = null;
          this.video = null;
        }
        
        // 清理Canvas
        if (this.canvas) {
          this.canvas = null;
          this.ctx = null;
        }
        
        // 清理Canvas流
        if (this.canvasStream) {
          this.canvasStream.getTracks().forEach(track => track.stop());
          this.canvasStream = null;
        }
        
        // 🆕 清理原始屏幕共享流
        if (this.stream) {
          this.stream.getTracks().forEach(track => {
            console.log('🛑 停止屏幕共享轨道:', track.kind);
            track.stop();
          });
          this.stream = null;
        }
        
        this.chunks = [];
        this.region = null;
        
        console.log('✅ Canvas实时剪裁录制资源清理完成');
        
      } catch (error) {
        console.error('❌ 清理Canvas实时剪裁录制资源失败:', error);
      }
    }
  }

  // 🎨 标签录制Canvas预处理类 - 解决标签录制文件过大问题
  class TabCanvasRecorder {
    constructor() {
      this.canvas = null;
      this.ctx = null;
      this.video = null;
      this.mediaRecorder = null;
      this.chunks = [];
      this.isRecording = false;
      this.isPaused = false;
      this.stream = null;
      this.canvasStream = null;
      this.animationId = null;
      this.startTime = null;
      this.pauseTime = 0;
      this.pauseStartTime = null;
      console.log('🎨 TabCanvasRecorder 初始化完成');
    }

    /**
     * 开始标签录制（Canvas预处理版本）
     * @param {MediaStream} originalStream - 原始标签页流
     * @returns {Promise<Object>} 录制结果
     */
    async startRecording(originalStream) {
      try {
        console.log('🎨 开始标签录制（Canvas预处理版本）...');
        console.log('🎨 原始流:', originalStream);

        this.stream = originalStream;
        this.isRecording = true;
        this.startTime = Date.now();
        this.pauseTime = 0;

        // 创建Canvas
        this.createCanvas();

        // 创建Canvas流
        this.createCanvasStream();

        // 开始MediaRecorder录制
        await this.startMediaRecorder();

        // 开始实时绘制
        this.startRealtimeDrawing();

        console.log('✅ 标签录制Canvas预处理启动成功');

        return {
          success: true,
          message: '标签录制Canvas预处理启动成功'
        };

      } catch (error) {
        console.error('❌ 标签录制Canvas预处理启动失败:', error);
        throw error;
      }
    }

    /**
     * 创建Canvas
     */
    createCanvas() {
      try {
        console.log('🎨 创建Canvas...');

        this.canvas = document.createElement('canvas');
        this.canvas.width = 1280;   // 固定分辨率，便于控制文件大小
        this.canvas.height = 720;
        this.ctx = this.canvas.getContext('2d');

        // 设置Canvas样式（可选，用于调试）
        this.canvas.style.position = 'fixed';
        this.canvas.style.top = '-9999px';
        this.canvas.style.left = '-9999px';
        this.canvas.style.zIndex = '-1';
        document.body.appendChild(this.canvas);

        console.log('✅ Canvas创建成功');
        console.log('🎨 Canvas尺寸:', this.canvas.width, 'x', this.canvas.height);

      } catch (error) {
        console.error('❌ Canvas创建失败:', error);
        throw error;
      }
    }

    /**
     * 创建Canvas流
     */
    createCanvasStream() {
      try {
        console.log('🎨 创建Canvas流...');

        // 创建Canvas流，固定帧率
        this.canvasStream = this.canvas.captureStream(24); // 24fps

        console.log('✅ Canvas流创建成功');
        console.log('🎬 Canvas流轨道数:', this.canvasStream.getTracks().length);

      } catch (error) {
        console.error('❌ Canvas流创建失败:', error);
        throw error;
      }
    }

    /**
     * 开始MediaRecorder录制
     */
    async startMediaRecorder() {
      try {
        console.log('🎨 开始MediaRecorder录制...');

        // 创建混合流：视频来自Canvas，音频来自原始流
        const mixedStream = new MediaStream();

        // 添加Canvas视频轨道
        const videoTrack = this.canvasStream.getVideoTracks()[0];
        if (videoTrack) {
          mixedStream.addTrack(videoTrack);
          console.log('🎬 Canvas视频轨道已添加');
        }

        // 添加原始音频轨道
        const audioTrack = this.stream.getAudioTracks()[0];
        if (audioTrack) {
          mixedStream.addTrack(audioTrack);
          console.log('🎵 原始音频轨道已添加');
        } else {
          console.log('⚠️ 未找到音频轨道');
        }

        // 创建MediaRecorder，使用优化的参数
        this.mediaRecorder = new MediaRecorder(mixedStream, {
          mimeType: 'video/webm;codecs=vp9',
          videoBitsPerSecond: 500000,  // 0.5Mbps（严格控制）
          audioBitsPerSecond: 16000    // 16kbps（严格控制）
        });

        this.chunks = [];

        this.mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            this.chunks.push(event.data);
            console.log('📦 收到数据块:', event.data.size, 'bytes');
          }
        };

        this.mediaRecorder.onstop = () => {
          console.log('🎬 标签录制Canvas预处理停止');
        };

        // 开始录制
        this.mediaRecorder.start(1000); // 每秒一个数据块

        console.log('✅ MediaRecorder录制启动成功');

      } catch (error) {
        console.error('❌ MediaRecorder录制启动失败:', error);
        throw error;
      }
    }

    /**
     * 开始实时绘制
     */
    startRealtimeDrawing() {
      try {
        console.log('🎨 开始实时绘制...');

        // 创建视频元素用于绘制
        this.video = document.createElement('video');
        this.video.muted = true;
        this.video.playsInline = true;
        this.video.srcObject = this.stream;

        this.video.onloadedmetadata = () => {
          console.log('🎬 视频元数据加载完成');
          // 视频元素需要播放才能产生视频帧
          this.video.play().then(() => {
            console.log('🎬 视频播放开始，开始绘制');
            this.drawFrame();
          }).catch((error) => {
            console.error('❌ 视频播放失败:', error);
          });
        };

        this.video.onerror = (error) => {
          console.error('❌ 视频加载失败:', error);
        };

        console.log('✅ 实时绘制启动成功');

      } catch (error) {
        console.error('❌ 实时绘制启动失败:', error);
        throw error;
      }
    }

    /**
     * 绘制帧
     */
    drawFrame() {
      if (!this.isRecording || this.isPaused) {
        return;
      }

      try {
        // 检查视频是否准备好
        if (this.video.readyState >= 2) { // HAVE_CURRENT_DATA
          // 在Canvas上绘制标签页内容（缩放适应Canvas尺寸）
          this.ctx.drawImage(
            this.video,
            0, 0, this.video.videoWidth, this.video.videoHeight,  // 源区域
            0, 0, this.canvas.width, this.canvas.height          // 目标区域（缩放到Canvas尺寸）
          );
        } else {
          console.log('🎬 视频尚未准备好，readyState:', this.video.readyState);
        }

        // 继续下一帧
        this.animationId = requestAnimationFrame(() => this.drawFrame());

      } catch (error) {
        console.error('❌ 绘制帧失败:', error);
      }
    }

    /**
     * 停止录制
     * @returns {Promise<Object>} 录制数据
     */
    async stopRecording() {
      try {
        console.log('🛑 停止标签录制Canvas预处理...');

        this.isRecording = false;

        // 停止绘制
        if (this.animationId) {
          cancelAnimationFrame(this.animationId);
          this.animationId = null;
        }

        // 停止MediaRecorder
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
          this.mediaRecorder.stop();
        }

        // 等待录制完成
        await new Promise((resolve) => {
          if (this.mediaRecorder) {
            this.mediaRecorder.onstop = resolve;
          } else {
            resolve();
          }
        });

        // 创建最终的Blob
        const blob = new Blob(this.chunks, { type: 'video/webm' });

        console.log('✅ 标签录制Canvas预处理停止成功');
        console.log('📊 最终文件大小:', blob.size, 'bytes');

        // 🆕 立即清理原始流，避免用户手动停止
        if (this.stream) {
          this.stream.getTracks().forEach(track => {
            console.log('🛑 停止原始流轨道:', track.kind);
            track.stop();
          });
        }

        // 准备录制数据（保持与原有格式一致）
        const recordingData = {
          timestamp: Date.now(),
          duration: Date.now() - this.startTime - this.pauseTime,
          format: 'webm',
          size: blob.size,
          blob: blob,
          blobType: 'video/webm',
          mode: 'tab_canvas_preprocessing',
          metadata: {
            width: this.canvas.width,
            height: this.canvas.height,
            frameRate: 24,
            codec: 'vp9',
            bitrate: '0.5Mbps',
            originalWidth: this.video ? this.video.videoWidth : 0,
            originalHeight: this.video ? this.video.videoHeight : 0
          },
          arrayBuffer: await blob.arrayBuffer()
        };

        return recordingData;

      } catch (error) {
        console.error('❌ 停止标签录制Canvas预处理失败:', error);
        throw error;
      }
    }

    /**
     * 暂停录制
     */
    pauseRecording() {
      if (this.isRecording && !this.isPaused) {
        this.isPaused = true;
        this.pauseStartTime = Date.now();
        console.log('⏸️ 标签录制Canvas预处理已暂停');
      }
    }

    /**
     * 继续录制
     */
    resumeRecording() {
      if (this.isRecording && this.isPaused) {
        this.isPaused = false;
        if (this.pauseStartTime) {
          this.pauseTime += Date.now() - this.pauseStartTime;
          this.pauseStartTime = null;
        }
        console.log('▶️ 标签录制Canvas预处理已继续');
      }
    }

    /**
     * 获取状态
     * @returns {Object} 状态信息
     */
    getStatus() {
      return {
        isRecording: this.isRecording,
        isPaused: this.isPaused,
        startTime: this.startTime,
        pauseTime: this.pauseTime
      };
    }

    /**
     * 清理资源
     */
    cleanup() {
      try {
        console.log('🧹 清理标签录制Canvas预处理资源...');

        this.isRecording = false;
        this.isPaused = false;

        // 停止绘制
        if (this.animationId) {
          cancelAnimationFrame(this.animationId);
          this.animationId = null;
        }

        // 停止MediaRecorder
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
          this.mediaRecorder.stop();
        }

        // 清理视频元素
        if (this.video) {
          this.video.srcObject = null;
          this.video = null;
        }

        // 清理Canvas
        if (this.canvas) {
          this.canvas.remove();
          this.canvas = null;
          this.ctx = null;
        }

        // 清理Canvas流
        if (this.canvasStream) {
          this.canvasStream.getTracks().forEach(track => track.stop());
          this.canvasStream = null;
        }

        // 清理原始流
        if (this.stream) {
          this.stream.getTracks().forEach(track => {
            console.log('🛑 停止原始流轨道:', track.kind);
            track.stop();
          });
          this.stream = null;
        }

        this.chunks = [];

        console.log('✅ 标签录制Canvas预处理资源清理完成');

      } catch (error) {
        console.error('❌ 清理标签录制Canvas预处理资源失败:', error);
      }
    }
  }

// 🔥 修复：移除直接IndexedDB操作，统一通过Service Worker
// 🆕 新增：Blob传输配置参数
const BLOB_TRANSFER_CONFIG = {
  enabled: true,            // 🆕 启用Blob传输模式
  useBlobUrl: true,         // 使用Blob URL传输
  maxDirectTransferSize: 50 * 1024 * 1024,  // 直接传输最大大小：50MB
  fallbackToBlobUrl: true   // 大文件回退到Blob URL
};

  // 录制状态变量
  let recorder = null;
  let stream = null;
  let chunks = [];
  let isRecording = false;
  let recordingStartTime = null;
  
  // 🆕 修复：撤销系统变量 - 重新设计架构
  let editHistory = [];           // 编辑历史数组
  let currentEditIndex = -1;      // 当前编辑索引
  const MAX_EDIT_HISTORY = 50;    // 最多保存50个编辑操作
  
  // 🆕 新增：监控editHistory的变化，帮助调试
  const originalEditHistory = editHistory;
  Object.defineProperty(window, 'editHistory', {
    get: function() {
      return editHistory;
    },
    set: function(value) {
      console.log('🔍 editHistory被修改:', {
        oldValue: editHistory,
        newValue: value,
        stack: new Error().stack
      });
      editHistory = value;
    }
  });

  // 🆕 新增：处理状态管理变量
  let isProcessing = false;
  let currentProcessStatus = '';
  
  // 🆕 新增：倒计时状态变量
  let isCountdownActive = false;
  let countdownInterval = null;
  
  // 🎨 新增：全局调色板状态管理
  let globalColorState = {
    primary: '#FF0000',      // 主色（当前选中的颜色）
    secondary: '#FFFFFF',    // 辅助色（边框等）
    opacity: 1.0,           // 透明度（0-1）
    lastUsed: '#FF0000'     // 上次使用的颜色
  };
  
  // 🎨 新增：初始化时加载上次使用的颜色和透明度
  try {
    const savedColor = localStorage.getItem('lastUsedColor');
    if (savedColor) {
      globalColorState.primary = savedColor;
      globalColorState.lastUsed = savedColor;
      console.log('🎨 已恢复上次使用的颜色:', savedColor);
    }
    
    const savedOpacity = localStorage.getItem('lastUsedOpacity');
    if (savedOpacity) {
      globalColorState.opacity = parseFloat(savedOpacity);
      console.log('🎨 已恢复上次使用的透明度:', savedOpacity);
    }
  } catch (error) {
    console.warn('⚠️ 无法加载保存的颜色或透明度:', error);
  }
  
  // 🆕 新增：等待视频流就绪函数
  function waitForVideoStreamReady(stream, timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
      console.log('🎬 开始等待视频流就绪...');
      
      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack) {
        console.warn('⚠️ 未找到视频轨道，直接继续');
        resolve();
        return;
      }
      
      // 🆕 修复：使用更严格的视频流就绪检测
      let frameCount = 0;
      let lastFrameTime = 0;
      let isStreamReady = false;
      
      // 创建临时video元素来检测视频帧
      const tempVideo = document.createElement('video');
      tempVideo.style.display = 'none';
      tempVideo.muted = true;
      tempVideo.autoplay = true;
      tempVideo.playsInline = true;
      
      // 设置视频源
      tempVideo.srcObject = stream;
      
      // 监听视频元数据加载
      tempVideo.onloadedmetadata = () => {
        console.log('🎬 视频元数据已加载，尺寸:', tempVideo.videoWidth, 'x', tempVideo.videoHeight);
        
        // 检查视频尺寸是否有效
        if (tempVideo.videoWidth > 0 && tempVideo.videoHeight > 0) {
          console.log('✅ 视频尺寸有效，开始检测帧数据...');
          
          // 开始检测视频帧
          tempVideo.play().then(() => {
            detectVideoFrames();
          }).catch(error => {
            console.warn('⚠️ 无法播放临时视频，使用备用检测方法:', error);
            // 备用方法：等待固定时间
            setTimeout(() => {
              console.log('✅ 备用方法：等待完成，视频流就绪');
              cleanupAndResolve();
            }, 3000);
          });
        } else {
          console.warn('⚠️ 视频尺寸无效，使用备用检测方法');
          setTimeout(() => {
            console.log('✅ 备用方法：等待完成，视频流就绪');
            cleanupAndResolve();
          }, 3000);
        }
      };
      
      // 检测视频帧的函数
      function detectVideoFrames() {
        if (isStreamReady) return;
        
        const currentTime = Date.now();
        
        // 检查视频是否在播放且有有效尺寸
        if (tempVideo.videoWidth > 0 && tempVideo.videoHeight > 0 && !tempVideo.paused) {
          frameCount++;
          
          // 如果连续检测到帧数据，认为流已就绪
          if (frameCount >= 3) {
            console.log('✅ 检测到连续视频帧，视频流已就绪');
            isStreamReady = true;
            cleanupAndResolve();
            return;
          }
          
          // 检查帧间隔，确保不是卡住的画面
          if (lastFrameTime > 0) {
            const frameInterval = currentTime - lastFrameTime;
            if (frameInterval > 100) { // 帧间隔大于100ms认为有效
              frameCount++;
            }
          }
          
          lastFrameTime = currentTime;
        }
        
        // 继续检测
        if (!isStreamReady) {
          requestAnimationFrame(detectVideoFrames);
        }
      }
      
      // 清理和解析函数
      function cleanupAndResolve() {
        // 清理临时视频元素
        if (tempVideo.srcObject) {
          tempVideo.srcObject.getTracks().forEach(track => {
            // 不要停止轨道，只是清理临时元素
          });
        }
        tempVideo.remove();
        
        // 清理超时
        if (timeout) {
          clearTimeout(timeout);
        }
        
        console.log('✅ 视频流就绪检测完成');
        resolve();
      }
      
      // 设置超时保护
      const timeout = setTimeout(() => {
        console.warn('⚠️ 等待视频流就绪超时，强制继续');
        isStreamReady = true;
        cleanupAndResolve();
      }, timeoutMs);
      
      // 错误处理
      tempVideo.onerror = (error) => {
        console.warn('⚠️ 临时视频元素错误，使用备用检测方法:', error);
        setTimeout(() => {
          console.log('✅ 备用方法：等待完成，视频流就绪');
          cleanupAndResolve();
        }, 3000);
      };
    });
  }
  
  // 🆕 新增：区域选择状态变量
let regionSelectionState = {
  isSelecting: false,
  startX: 0,
  startY: 0,
  currentX: 0,
  currentY: 0,
  selectedRegion: null
};

// 🆕 新增：Blob传输进度显示函数
function showBlobTransferProgress(fileSize, transferType) {
  console.log(`📦 Blob传输进度: 文件大小 ${(fileSize / (1024 * 1024)).toFixed(2)}MB, 传输方式: ${transferType}`);
  
  // 如果存在进度回调，调用它
  if (BLOB_TRANSFER_CONFIG.progressCallback) {
    BLOB_TRANSFER_CONFIG.progressCallback(fileSize, transferType);
  }
}

// 🆕 新增：Blob传输核心函数
async function saveRecordingWithBlobTransfer(recordingData) {
  try {
    console.log('🔄 开始Blob传输录制数据...');
    
    // 生成唯一ID
    const id = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    // 检查文件大小，决定传输方式
    const fileSize = recordingData.blob.size;
    const useBlobUrl = fileSize > BLOB_TRANSFER_CONFIG.maxDirectTransferSize || BLOB_TRANSFER_CONFIG.useBlobUrl;
    
    if (useBlobUrl) {
      console.log('🔄 使用Blob URL传输方式...');
      // 创建Blob URL
      const blobUrl = URL.createObjectURL(recordingData.blob);
      
      // 准备要保存的数据（包含Blob URL）
      const dataToSave = {
        id: id,
        timestamp: recordingData.timestamp,
        duration: recordingData.duration,
        format: recordingData.format,
        size: recordingData.size,
        blobUrl: blobUrl,  // 使用Blob URL
        blobType: recordingData.blobType,
        blobSize: recordingData.blob.size,
        metadata: recordingData.metadata || {}
      };
      
      showBlobTransferProgress(fileSize, 'Blob URL');
      
      // 通过Service Worker保存数据
      return new Promise((resolve, reject) => {
         chrome.runtime.sendMessage({
          action: 'saveRecording',
          data: dataToSave
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('❌ Service Worker通信失败:', chrome.runtime.lastError);
            reject(new Error(chrome.runtime.lastError.message));
          } else if (response && response.success) {
            console.log('✅ 录制数据已通过Service Worker保存（Blob URL方式）');
            resolve({ id, success: true, data: response.data });
          } else {
            console.error('❌ Service Worker保存失败:', response?.error);
            reject(new Error(response?.error || '保存失败'));
          }
        });
      });
      
    } else {
      console.log('🔄 使用直接Blob传输方式...');
      // 直接传输Blob数据
      const dataToSave = {
             id: id,
               timestamp: recordingData.timestamp,
               duration: recordingData.duration,
               format: recordingData.format,
               size: recordingData.size,
        blob: recordingData.blob,  // 直接传输Blob
               blobType: recordingData.blobType,
        blobSize: recordingData.blob.size,
        metadata: recordingData.metadata || {}
      };
      
      showBlobTransferProgress(fileSize, '直接Blob');
      
      // 通过Service Worker保存数据
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          action: 'saveRecording',
          data: dataToSave
         }, (response) => {
           if (chrome.runtime.lastError) {
            console.error('❌ Service Worker通信失败:', chrome.runtime.lastError);
             reject(new Error(chrome.runtime.lastError.message));
           } else if (response && response.success) {
            console.log('✅ 录制数据已通过Service Worker保存（直接Blob方式）');
            resolve({ id, success: true, data: response.data });
           } else {
            console.error('❌ Service Worker保存失败:', response?.error);
            reject(new Error(response?.error || '保存失败'));
           }
         });
       });
    }
    
  } catch (error) {
    console.error('❌ Blob传输失败:', error);
    throw error;
  }
}

// 🔥 修复：使用Blob传输
async function saveRecordingToServiceWorker(recordingData) {
    try {
      // 🆕 新增：检查是否启用Blob传输
      if (BLOB_TRANSFER_CONFIG.enabled) {
        console.log('🔄 启用Blob传输模式...');
        return await saveRecordingWithBlobTransfer(recordingData);
      }
      
      console.log('⚠️ Blob传输未启用，使用备用方案...');
      
      // 备用方案：直接传输Blob
      const id = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      
      // 准备要保存的数据
      const dataToSave = {
        id: id,
        timestamp: recordingData.timestamp,
        duration: recordingData.duration,
        format: recordingData.format,
        size: recordingData.size,
        blob: recordingData.blob,  // 直接传输Blob
        blobType: recordingData.blobType,
        blobSize: recordingData.blob.size,
        metadata: recordingData.metadata || {}
      };
      
      console.log('💾 准备保存的数据，Blob大小:', recordingData.blob.size);
      
      // 通过Service Worker保存数据
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          action: 'saveRecording',
          data: dataToSave
        }, (response) => {
                      if (chrome.runtime.lastError) {
            console.error('❌ Service Worker通信失败:', chrome.runtime.lastError);
            reject(new Error(chrome.runtime.lastError.message));
          } else if (response && response.success) {
            console.log('✅ 录制数据已通过Service Worker保存（备用方案）');
            resolve({ id, success: true, data: response.data });
                      } else {
            console.error('❌ Service Worker保存失败:', response?.error);
            reject(new Error(response?.error || '保存失败'));
                      }
                    });
                  });
                  
    } catch (error) {
      console.error('❌ 通过Service Worker保存录制数据失败:', error);
      throw error;
    }
  }


  
// 保存元数据到Chrome存储作为备用
async function saveMetadataToChromeStorage(id, metadata) {
    try {
      console.log('💾 保存元数据到Chrome存储...');
      
                const backupData = {
        id: id,
        timestamp: metadata.timestamp,
        duration: metadata.duration,
        format: metadata.format,
        size: metadata.size,
        status: 'completed',
        blobType: metadata.blobType,
                  hasBlobData: true
                };
                
                  await new Promise((resolve, reject) => {
                    chrome.storage.local.set({
                      'lastRecordingId': id,
          'recordedVideoMetadata': backupData
                    }, () => {
                      if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                      } else {
                        resolve();
                      }
                    });
                  });
                  
      console.log('✅ 元数据已保存到Chrome存储');
      return true;
           
         } catch (error) {
      console.warn('⚠️ 元数据保存失败:', error);
      return false;
    }
  }
  
// 录制完成后的处理函数
async function handleRecordingComplete(recordingData) {
    try {
      console.log('�� 录制完成，开始保存数据...');
      
      // 🔥 修复：优先通过Service Worker保存
      try {
        console.log('�� 尝试通过Service Worker保存...');
        const result = await saveRecordingToServiceWorker(recordingData);
        console.log('✅ 通过Service Worker保存成功:', result);
        
        // ✅ 使用IndexedDB统一存储成功
        
        // 跳转到导出页面
        setTimeout(() => {
          const editUrl = chrome.runtime.getURL('export-new-extension.html') + `?id=${result.id}`;
          console.log('�� 跳转到编辑页面:', editUrl);
          window.open(editUrl, '_blank');
        }, 500);
        
      } catch (serviceWorkerError) {
        console.error('❌ 通过Service Worker保存失败:', serviceWorkerError);
        
        // ❌ 不允许备用方案，必须使用IndexedDB统一存储
        throw new Error('Service Worker连接失败，无法使用IndexedDB统一存储。请检查扩展状态或重新加载扩展。');
      }
           
         } catch (error) {
      console.error('❌ 保存录制数据失败:', error);
              alert(window.i18n ? window.i18n.t('content.alerts.recordingSaveFailed', { error: error.message }) : `Recording save failed: ${error.message}\n\nPlease check browser storage space or re-record.`);
    }
  }
  
// 开始录制
async function startRecording(mode = 'tab') {
    try {
      console.log('🎬 开始录制...');
      console.log('🎬 录制模式:', mode);
      
      // 🆕 新增：根据模式执行不同逻辑
      if (mode === 'region') {
        console.log('🎯 区域录制模式：先显示区域选择界面');
        showRegionSelectionUI();
        return; // 先不开始录制，等用户选择区域
      }
      
      if (mode === 'screen' || mode === 'fullscreen') {
        console.log('🖥️ 全屏录制模式：直接开始录制');
        startFullScreenRecording();
        return;
      }
      
      // 其他模式直接开始录制
      console.log('🎬 直接开始录制模式');
      
      // 🆕 新增：所有模式都直接调用实际录制
      startActualRecording(mode);
    } catch (error) {
      console.error('❌ 开始录制失败:', error);
      alert(`录制失败: ${error.message}`);
    }
  }
  
  // 🆕 新增：实际录制函数（原来的录制逻辑）
  async function startActualRecording(mode) {
    try {
      console.log('🎬 开始实际录制...');
      
      // 获取屏幕共享流
      console.log('🎬 准备调用getDisplayMedia...');
      console.log('🎬 调用参数:', {
        video: {
          displaySurface: 'tab',
          logicalSurface: true,
          width: { ideal: window.screen.width },
          height: { ideal: window.screen.height }
        },
        audio: true,
        preferCurrentTab: true,
        selfBrowserSurface: 'include'
      });
      
      try {
        stream = await navigator.mediaDevices.getDisplayMedia({
        video: { 
            displaySurface: 'tab',
            logicalSurface: true,
            width: { max: 1280 },        // 🆕 强制限制最大宽度1280px
            height: { max: 720 },       // 🆕 强制限制最大高度720px
            frameRate: { max: 24 }      // 🆕 强制限制最大帧率24fps
        },
        audio: true,
          preferCurrentTab: true,
        selfBrowserSurface: 'include'
        });
        
        console.log('✅ 屏幕共享流获取成功');
        console.log('🎬 流详情:', stream);
        console.log('🎬 视频轨道:', stream.getVideoTracks());
        console.log('🎬 音频轨道:', stream.getAudioTracks());
        
        // 检查是否真的获得了有效的流
        const videoTrack = stream.getVideoTracks()[0];
        const audioTrack = stream.getAudioTracks()[0];
        
        if (videoTrack) {
          console.log('🎬 视频轨道设置:', videoTrack.getSettings());
          console.log('🎬 视频轨道状态:', videoTrack.readyState);
        }
        
        if (audioTrack) {
          console.log('🎬 音频轨道设置:', audioTrack.getSettings());
          console.log('🎬 音频轨道状态:', audioTrack.readyState);
        }
        
              // 检查流是否真的有效
      if (stream.active) {
        console.log('✅ 流处于活跃状态');
      } else {
        console.log('❌ 流未处于活跃状态');
      }
      
              // 🆕 新增：标签录制模式在授权成功后显示倒计时
        if (mode === 'tab') {
          console.log('⏰ 标签录制模式：授权成功，开始倒计时');
          startCountdown();
          return; // 倒计时结束后会调用startActualRecording
        }
        
        // 🆕 修复：等待视频流就绪，确保有视频帧后再开始录制
        console.log('🎬 等待视频流就绪...');
        await waitForVideoStreamReady(stream);
        console.log('✅ 视频流已就绪，可以开始录制');

        // 🆕 标签录制使用Canvas预处理方案
        if (mode === 'tab') {
          console.log('🎨 标签录制模式：使用Canvas预处理方案');
          
          // 创建TabCanvasRecorder实例
          const tabCanvasRecorder = new TabCanvasRecorder();
          window.currentTabCanvasRecorder = tabCanvasRecorder; // 保存到全局变量
          
          // 开始Canvas预处理录制
          const result = await tabCanvasRecorder.startRecording(stream);
          
          if (result.success) {
            console.log('✅ 标签录制Canvas预处理启动成功');
            
            // 🔄 保持原有的UI逻辑
            isRecording = true;
            recordingStartTime = Date.now();
            
            // 创建录制操作界面
            createRecordingControlUI();
            
            // 显示录制状态
            showRecordingStatus(`🎬 Tab Recording (Canvas) in Progress...`);
            
            // 保存录制状态
            await chrome.storage.local.set({
              recordingStatus: 'active',
              startTime: Date.now(),
              mode: 'tab_canvas_preprocessing',
              sourceTabId: await getCurrentTabId()
            });
            
            console.log('✅ 标签录制状态已保存到存储');
            return; // 提前返回，不执行下面的代码
          } else {
            throw new Error(result.message || '标签录制Canvas预处理启动失败');
          }
        }
      
    } catch (getDisplayMediaError) {
      console.error('❌ getDisplayMedia调用失败:', getDisplayMediaError);
      throw getDisplayMediaError;
    }
    
    // 创建MediaRecorder
    recorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 5000000
    });
      
    chunks = [];
    
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };
      
      recorder.onstop = async () => {
        console.log('�� 录制停止，开始处理数据...');
        
        // 创建Blob
        const blob = new Blob(chunks, { type: 'video/webm' });
        
        // 准备录制数据
        const recordingData = {
          timestamp: Date.now(),
          duration: Date.now() - recorder.startTime,
          format: 'webm',
          size: blob.size,
          blob: blob,
          blobType: 'video/webm',
          metadata: {
            width: stream.getVideoTracks()[0]?.getSettings()?.width || 1920,
            height: stream.getVideoTracks()[0]?.getSettings()?.height || 1080,
            frameRate: stream.getVideoTracks()[0]?.getSettings()?.frameRate || 30
          }
        };
        
        try {
        // 处理录制完成
        await handleRecordingComplete(recordingData);
        } catch (error) {
          console.error('❌ 录制数据处理失败:', error);
          alert(window.i18n ? window.i18n.t('content.alerts.recordingProcessFailed', { error: error.message }) : `Recording process failed: ${error.message}`);
        } finally {
        // 清理资源
           try {
        stream.getTracks().forEach(track => track.stop());
        chunks = [];
        isRecording = false;
        recordingStartTime = null;
             
             // 🆕 修复：显式重置recorder变量
             recorder = null;
             
             // 🆕 修复：重置处理状态
             isProcessing = false;
             currentProcessStatus = '';
             
             // 清理录制操作界面
             cleanupRecordingControlUI();
             
             console.log('✅ 录制资源清理完成');
           } catch (cleanupError) {
             console.error('❌ 录制资源清理失败:', cleanupError);
           }
        }
      };
      
              // 开始录制
        recorder.start();
        recorder.startTime = Date.now();
        isRecording = true;
        recordingStartTime = Date.now();
        
        // 🆕 新增：初始化暂停时间变量
        window.totalPausedTime = 0;
        window.pauseStartTime = null;
        
        console.log('✅ 录制已开始，暂停时间变量已初始化');
        
        // 🔥 修复：创建录制操作界面
        createRecordingControlUI();
      
      } catch (error) {
        console.error('❌ 实际录制失败:', error);
        alert(window.i18n ? window.i18n.t('content.alerts.recordingFailed', { error: error.message }) : `Recording failed: ${error.message}`);
      }
    }

// 停止录制
async function stopRecording() {
    console.log('🛑 停止录制函数被调用...');
    console.log('🛑 当前recorder状态:', recorder?.state);
    console.log('🛑 当前isRecording状态:', isRecording);
    console.log('🛑 当前Canvas实时剪裁录制器:', window.currentRealtimeCropRecorder ? '存在' : '不存在');
    console.log('🛑 当前标签Canvas录制器:', window.currentTabCanvasRecorder ? '存在' : '不存在');
    
    // 🆕 检查是否有标签Canvas录制器
    if (window.currentTabCanvasRecorder) {
      console.log('🛑 检测到标签Canvas录制器，停止Canvas录制...');
      
      // 显示停止中状态
      showStoppingStatus();
      
      try {
        // 停止Canvas录制
        const recordingData = await window.currentTabCanvasRecorder.stopRecording();
        console.log('✅ 标签Canvas录制停止成功');
        
        // 显示数据保存进度
        showDataSavingProgress();
        
        // 处理录制完成
        await handleRecordingComplete(recordingData);
        
        // 🔄 保持原有的UI清理逻辑
        isRecording = false;
        recordingStartTime = null;
        cleanupRecordingControlUI();
        
        // 清理Canvas录制器
        window.currentTabCanvasRecorder.cleanup();
        window.currentTabCanvasRecorder = null;
        
      } catch (error) {
        console.error('❌ 标签Canvas录制停止失败:', error);
        // 强制清理状态
        isRecording = false;
        recordingStartTime = null;
        cleanupRecordingControlUI();
        if (window.currentTabCanvasRecorder) {
          window.currentTabCanvasRecorder.cleanup();
          window.currentTabCanvasRecorder = null;
        }
      }
      
      return; // 提前返回，不执行下面的代码
    }
    
    // 🆕 检查是否有Canvas实时剪裁录制器
    if (window.currentRealtimeCropRecorder) {
      console.log('🛑 检测到Canvas实时剪裁录制器，停止Canvas录制...');
      
      // 显示停止中状态
      showStoppingStatus();
      
      try {
        // 停止Canvas录制
        const recordingData = await window.currentRealtimeCropRecorder.stopRecording();
        console.log('✅ Canvas录制停止成功');
        
        // 显示数据保存进度
        showDataSavingProgress();
        
        // 处理录制完成
        await handleRecordingComplete(recordingData);
        
        // 🔄 保持原有的UI清理逻辑
        isRecording = false;
        recordingStartTime = null;
        cleanupRecordingControlUI();
        
        // 清理Canvas录制器
        window.currentRealtimeCropRecorder.cleanup();
        window.currentRealtimeCropRecorder = null;
        
      } catch (error) {
        console.error('❌ Canvas录制停止失败:', error);
        // 强制清理状态
        isRecording = false;
        recordingStartTime = null;
        cleanupRecordingControlUI();
        if (window.currentRealtimeCropRecorder) {
          window.currentRealtimeCropRecorder.cleanup();
          window.currentRealtimeCropRecorder = null;
        }
      }
      
      return; // 提前返回，不执行下面的代码
    }
    
    // 🔄 保留：原有的MediaRecorder停止逻辑
    if (recorder && recorder.state !== 'inactive') {
      console.log('🛑 录制器状态正常，发送停止命令...');
      
      // 🆕 修复：立即显示停止中状态，提供即时反馈
      showStoppingStatus();
      
      try {
      recorder.stop();
        console.log('🛑 录制停止命令已发送，等待onstop事件...');
      } catch (error) {
        console.error('❌ 调用recorder.stop()失败:', error);
        // 如果recorder.stop()失败，强制清理状态
        isRecording = false;
        recordingStartTime = null;
        cleanupRecordingControlUI();
      }
    } else {
      console.log('⚠️ 录制器状态异常:', recorder?.state);
      console.log('⚠️ 强制清理录制状态...');
      // 强制清理状态
      isRecording = false;
      recordingStartTime = null;
      cleanupRecordingControlUI();
    }
  }
  
// 监听来自popup的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('�� Content Script收到消息:', request?.action);
    
    if (request.action === 'startRecording') {
      console.log('🎬 准备调用startRecording函数...');
      try {
        console.log('🎬 开始调用startRecording函数...');
        // 🆕 新增：传递录制模式参数
        const mode = request.mode || 'tab';
        console.log('🎬 录制模式:', mode);
        startRecording(mode);
        console.log('✅ startRecording函数调用成功');
        sendResponse({ success: true, message: '录制已开始' });
  } catch (error) {
        console.error('❌ startRecording函数调用失败:', error);
        sendResponse({ success: false, error: error.message });
      }
    } else if (request.action === 'stopRecording') {
      console.log('🛑 准备调用stopRecording函数...');
      try {
        stopRecording();
        console.log('✅ stopRecording函数调用成功');
        sendResponse({ success: true, message: '录制已停止' });
      } catch (error) {
        console.error('❌ stopRecording函数调用失败:', error);
        sendResponse({ success: false, error: error.message });
      }
    } else if (request.action === 'getRecordingStatus') {
      console.log('📊 返回录制状态...');
      // 返回录制状态
      sendResponse({
        success: true,
        isRecording: isRecording,
        startTime: recordingStartTime,
        duration: recordingStartTime ? Date.now() - recordingStartTime : 0
      });
    } else if (request.action === 'startScreenshot') {
      console.log('📸 准备调用startScreenshot函数...');
      try {
        console.log('📸 开始调用startScreenshot函数...');
        startScreenshot();
        console.log('✅ startScreenshot函数调用成功');
        sendResponse({ success: true, message: '截图模式已启动' });
      } catch (error) {
        console.error('❌ startScreenshot函数调用失败:', error);
        sendResponse({ success: false, error: error.message });
      }
    } else if (request.action === 'takeScreenshot') {
      console.log('📸 准备调用takeScreenshot函数...');
      try {
        console.log('📸 开始调用takeScreenshot函数...');
        startScreenshot();
        console.log('✅ takeScreenshot函数调用成功');
        sendResponse({ success: true, message: '截图模式已启动' });
      } catch (error) {
        console.error('❌ takeScreenshot函数调用失败:', error);
        sendResponse({ success: false, error: error.message });
      }
    } else if (request.action === 'stopFullscreenRecording') {
      console.log('⏹️ 处理全屏录制停止请求...');
      try {
        stopFullscreenRecording();
        console.log('✅ 全屏录制停止成功');
        sendResponse({ success: true, message: '全屏录制已停止' });
      } catch (error) {
        console.error('❌ 全屏录制停止失败:', error);
        sendResponse({ success: false, error: error.message });
      }
    } else if (request.action === 'ping') {
      console.log('🏓 收到ping消息，返回pong');
      sendResponse('pong');
    }
    
    console.log('🔍 消息处理完成');
    return true; // 保持消息通道开放
  });
  
  // 🔥 修复：创建录制操作界面
  function createRecordingControlUI() {
    console.log('🎬 创建录制操作界面...');
    
    // 移除已存在的操作界面
    const existingUI = document.getElementById('voiceCatchControlUI');
    if (existingUI) {
      existingUI.remove();
    }
    
    // 创建操作界面容器
    const controlUI = document.createElement('div');
    controlUI.id = 'voiceCatchControlUI';
    controlUI.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
        color: #000000;
        padding: 20px;
        border-radius: 16px;
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        min-width: 220px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15), 0 4px 16px rgba(0, 0, 0, 0.1);
        border: 2px solid #000000;
        backdrop-filter: blur(10px);
    `;
    
    // 录制时间显示
    const timeDisplay = document.createElement('div');
    timeDisplay.id = 'recordingTime';
    timeDisplay.style.cssText = `
      text-align: center;
      font-size: 24px;
      font-weight: bold;
      margin-bottom: 20px;
      color: #000000;
      font-family: 'Courier New', monospace;
      background: rgba(0, 0, 0, 0.1);
      padding: 12px 16px;
      border-radius: 12px;
      border: 2px solid #000000;
      min-width: 100px;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    `;
    timeDisplay.textContent = '00:00';
    
    // 控制按钮容器
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
        display: flex;
        gap: 16px;
        justify-content: center;
        flex-wrap: wrap;
        align-items: center;
    `;
    
    // 暂停/继续按钮
    const pauseButton = document.createElement('button');
    pauseButton.id = 'voiceCatchPauseBtn';
    pauseButton.textContent = '⏸️ Pause';
    pauseButton.style.cssText = `
        padding: 12px 20px;
        border: none;
        border-radius: 12px;
        background: #000000;
        color: #ffffff;
        cursor: pointer;
        font-size: 14px;
        font-weight: 600;
        transition: all 0.2s ease;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        border: 2px solid #000000;
        min-width: 80px;
    `;
    
    // 添加悬停效果
    pauseButton.addEventListener('mouseenter', () => {
      pauseButton.style.transform = 'translateY(-2px)';
      pauseButton.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.3)';
    });
    
    pauseButton.addEventListener('mouseleave', () => {
      pauseButton.style.transform = 'translateY(0)';
      pauseButton.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
    });
    
    pauseButton.onclick = () => togglePause();
    
    // 停止按钮
    const stopButton = document.createElement('button');
    stopButton.textContent = '⏹️ Stop';
    stopButton.style.cssText = `
      padding: 12px 20px;
      border: none;
      border-radius: 12px;
      background: #000000;
      color: #ffffff;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      transition: all 0.2s ease;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      border: 2px solid #000000;
      min-width: 80px;
    `;
    
    // 添加悬停效果
    stopButton.addEventListener('mouseenter', () => {
      stopButton.style.transform = 'translateY(-2px)';
      stopButton.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.3)';
    });
    
    stopButton.addEventListener('mouseleave', () => {
      stopButton.style.transform = 'translateY(0)';
      stopButton.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
    });
    
    stopButton.onclick = () => stopRecording();
    
    // 删除按钮
    const deleteButton = document.createElement('button');
    deleteButton.textContent = '🗑️ Delete';
    deleteButton.style.cssText = `
      padding: 12px 20px;
      border: none;
      border-radius: 12px;
      background: #000000;
      color: #ffffff;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      transition: all 0.2s ease;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      border: 2px solid #000000;
      min-width: 80px;
    `;
    
    // 添加悬停效果
    deleteButton.addEventListener('mouseenter', () => {
      deleteButton.style.transform = 'translateY(-2px)';
      deleteButton.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.3)';
    });
    
    deleteButton.addEventListener('mouseleave', () => {
      deleteButton.style.transform = 'translateY(0)';
      deleteButton.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
    });
    
    deleteButton.onclick = () => deleteRecording();
      
      // 组装界面
    buttonContainer.appendChild(pauseButton);
    buttonContainer.appendChild(stopButton);
    buttonContainer.appendChild(deleteButton);
    
    controlUI.appendChild(timeDisplay);
    controlUI.appendChild(buttonContainer);
      
      // 添加到页面
    document.body.appendChild(controlUI);
    
    // 🔧 修复：根据录制模式选择计时器系统
    if (window.currentTabCanvasRecorder || window.currentRealtimeCropRecorder) {
      // Canvas录制模式：使用独立计时器系统
      console.log('🔧 检测到Canvas录制模式，启动独立计时器');
      startCanvasRecordingTimer();
    } else {
      // 传统录制模式：使用原有计时器系统
      console.log('🔧 传统录制模式，启动原有计时器');
      updateRecordingTime();
    }
    
    console.log('✅ 录制操作界面创建完成');
  }
  
    // 🆕 新增：Canvas录制独立计时器系统
  function startCanvasRecordingTimer() {
    try {
      console.log('🔧 启动Canvas录制独立计时器...');
      
      // 等待DOM元素创建完成
      const waitForElement = () => {
        const timerElement = document.getElementById('recordingTime');
        if (timerElement) {
          console.log('✅ 找到Canvas计时器元素，启动独立计时器');
          
          const startTime = Date.now();
          let totalPausedTime = 0;
          let pauseStartTime = null;
          let isPaused = false;
          console.log('⏰ Canvas计时器开始时间:', new Date(startTime).toLocaleTimeString());
          
          const timer = setInterval(() => {
            // 检查Canvas录制器状态
            const canvasRecorder = window.currentTabCanvasRecorder || window.currentRealtimeCropRecorder;
            if (!canvasRecorder || !canvasRecorder.isRecording) {
              console.log('🛑 Canvas录制器已停止，停止计时器');
              clearInterval(timer);
              window.canvasRecordingTimer = null;
              return;
            }
            
            // 检查暂停状态
            if (canvasRecorder.isPaused) {
              if (!isPaused) {
                pauseStartTime = Date.now();
                isPaused = true;
                timerElement.textContent = '⏸️ Paused';
                timerElement.style.color = '#000000';
              }
              return;
            } else if (isPaused) {
              // 从暂停状态恢复
              if (pauseStartTime) {
                totalPausedTime += Date.now() - pauseStartTime;
                pauseStartTime = null;
              }
              isPaused = false;
            }
            
            // 更新计时器显示
            const elapsed = Date.now() - startTime - totalPausedTime;
            const minutes = Math.floor(elapsed / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            timerElement.style.color = '#000000';
            
          }, 1000);
          
          // 保存timer引用用于清理
          window.canvasRecordingTimer = timer;
          console.log('✅ Canvas录制独立计时器启动成功');
          
        } else {
          // 如果元素还没创建，100ms后重试
          setTimeout(waitForElement, 100);
        }
      };
      
      waitForElement();
      
    } catch (error) {
      console.error('❌ Canvas录制计时器启动失败:', error);
    }
  }
  
  // 🔥 修复：更新录制时间 - 使用与全屏录制一致的逻辑
  function updateRecordingTime() {
    if (!isRecording) {
      // 🆕 新增：录制停止时自动清理界面
      cleanupRecordingControlUI();
      return;
    }
    
    const timeDisplay = document.getElementById('recordingTime');
    if (timeDisplay && recordingStartTime) {
      // 🆕 修复：使用状态管理变量检查是否处于处理状态
      if (isProcessing) {
        // 正在处理中，不更新计时器
        setTimeout(updateRecordingTime, 1000);
        return;
      }
      
      // 🆕 新增：检查录制状态，暂停时完全停止计时器循环
      chrome.storage.local.get(['recordingStatus'], (result) => {
        const status = result.recordingStatus || 'active';
        
        if (status === 'paused') {
          // 录制暂停时，显示暂停状态，完全停止计时器循环
          timeDisplay.textContent = '⏸️ Paused';
          timeDisplay.style.color = '#000000';
          // 暂停时完全停止计时器循环，不调用setTimeout
          console.log('⏸️ 录制已暂停，计时器循环已停止');
          return;
        }
        
        // 录制进行中，正常更新计时器 - 减去累计暂停时间
        const elapsed = Date.now() - recordingStartTime - (window.totalPausedTime || 0);
        const minutes = Math.floor(elapsed / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        timeDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        timeDisplay.style.color = '#000000';
        
        // 每秒更新一次
        setTimeout(updateRecordingTime, 1000);
      });
    } else {
      // 如果没有时间显示元素，每秒重试一次
      setTimeout(updateRecordingTime, 1000);
    }
  }
  
  // 🔥 修复：暂停/继续录制 - 使用与全屏录制一致的逻辑
  async function togglePause() {
    try {
      console.log('⏸️ 尝试暂停/继续录制...');
      
      // 🆕 检查是否有标签Canvas录制器
      if (window.currentTabCanvasRecorder) {
        console.log('⏸️ 检测到标签Canvas录制器，暂停/继续Canvas录制...');
        
        const status = window.currentTabCanvasRecorder.getStatus();
        
        if (status.isRecording && !status.isPaused) {
          // 暂停Canvas录制
          window.currentTabCanvasRecorder.pauseRecording();
          console.log('⏸️ 标签Canvas录制已暂停');
          
          // 记录暂停开始时间
          if (!window.pauseStartTime) {
            window.pauseStartTime = Date.now();
          }
          
          // 更新存储状态为暂停
          await chrome.storage.local.set({ recordingStatus: 'paused' });
          
          // 立即更新暂停按钮文本
          updatePauseButtonText('▶️ Resume');
          
          // 显示暂停状态
          showPauseStatus();
          
        } else if (status.isRecording && status.isPaused) {
          // 继续Canvas录制
          window.currentTabCanvasRecorder.resumeRecording();
          console.log('▶️ 标签Canvas录制已继续');
          
          // 累计暂停时间
          if (window.pauseStartTime) {
            if (!window.totalPausedTime) {
              window.totalPausedTime = 0;
            }
            window.totalPausedTime += Date.now() - window.pauseStartTime;
            window.pauseStartTime = null;
            console.log('⏸️ 累计暂停时间:', window.totalPausedTime, 'ms');
          }
          
          // 更新存储状态为活跃
          await chrome.storage.local.set({ recordingStatus: 'active' });
          
          // 立即更新暂停按钮文本
          updatePauseButtonText('⏸️ Pause');
          
          // 隐藏暂停状态，重新启动计时器
          hidePauseStatus();
        }
        
        return; // 提前返回，不执行下面的代码
      }
      
      // 🆕 检查是否有Canvas实时剪裁录制器
      if (window.currentRealtimeCropRecorder) {
        console.log('⏸️ 检测到Canvas实时剪裁录制器，暂停/继续Canvas录制...');
        
        const status = window.currentRealtimeCropRecorder.getStatus();
        
        if (status.isRecording && !status.isPaused) {
          // 暂停Canvas录制
          window.currentRealtimeCropRecorder.pauseRecording();
          console.log('⏸️ Canvas录制已暂停');
          
          // 记录暂停开始时间
          if (!window.pauseStartTime) {
            window.pauseStartTime = Date.now();
          }
          
          // 更新存储状态为暂停
          await chrome.storage.local.set({ recordingStatus: 'paused' });
          
          // 立即更新暂停按钮文本
          updatePauseButtonText('▶️ Resume');
          
          // 显示暂停状态
          showPauseStatus();
          
        } else if (status.isRecording && status.isPaused) {
          // 继续Canvas录制
          window.currentRealtimeCropRecorder.resumeRecording();
          console.log('▶️ Canvas录制已继续');
          
          // 累计暂停时间
          if (window.pauseStartTime) {
            if (!window.totalPausedTime) {
              window.totalPausedTime = 0;
            }
            window.totalPausedTime += Date.now() - window.pauseStartTime;
            window.pauseStartTime = null;
            console.log('⏸️ 累计暂停时间:', window.totalPausedTime, 'ms');
          }
          
          // 更新存储状态为活跃
          await chrome.storage.local.set({ recordingStatus: 'active' });
          
          // 立即更新暂停按钮文本
          updatePauseButtonText('⏸️ Pause');
          
          // 隐藏暂停状态，重新启动计时器
          hidePauseStatus();
        }
        
        return; // 提前返回，不执行下面的代码
      }
      
      // 🔄 保留：原有的MediaRecorder暂停/继续逻辑
      if (recorder && recorder.state === 'recording') {
        recorder.pause();
        console.log('⏸️ 录制已暂停');
        
        // 记录暂停开始时间
        if (!window.pauseStartTime) {
          window.pauseStartTime = Date.now();
        }
        
        // 更新存储状态为暂停
        await chrome.storage.local.set({ recordingStatus: 'paused' });
        
        // 立即更新暂停按钮文本
        updatePauseButtonText('▶️ Resume');
        
        // 显示暂停状态
        showPauseStatus();
        
      } else if (recorder && recorder.state === 'paused') {
        recorder.resume();
        console.log('▶️ 录制已继续');
        
        // 累计暂停时间
        if (window.pauseStartTime) {
          if (!window.totalPausedTime) {
            window.totalPausedTime = 0;
          }
          window.totalPausedTime += Date.now() - window.pauseStartTime;
          window.pauseStartTime = null;
          console.log('⏸️ 累计暂停时间:', window.totalPausedTime, 'ms');
        }
        
        // 更新存储状态为活跃
        await chrome.storage.local.set({ recordingStatus: 'active' });
        
        // 立即更新暂停按钮文本
        updatePauseButtonText('⏸️ Pause');
        
        // 隐藏暂停状态，重新启动计时器
        hidePauseStatus();
      }
      
    } catch (error) {
      console.error('❌ 暂停/继续录制失败:', error);
    }
  }
   
   // 🆕 新增：显示停止中状态函数
   function showStoppingStatus() {
     try {
       console.log('⏳ 显示停止中状态...');
       
       // 🆕 修复：设置处理状态
       isProcessing = true;
       currentProcessStatus = 'stopping';
       
       // 更新录制时间显示为"停止中..."
       const timeDisplay = document.getElementById('recordingTime');
       if (timeDisplay) {
         timeDisplay.textContent = '⏳ Stopping...';
         timeDisplay.style.color = '#ff9500'; // 橙色表示处理中
       }
       
       // 禁用所有按钮，防止重复操作
       const buttons = document.querySelectorAll('#voiceCatchControlUI button');
       buttons.forEach(button => {
         button.disabled = true;
         button.style.opacity = '0.5';
         button.style.cursor = 'not-allowed';
       });
       
       // 更新停止按钮文本
       const stopButton = document.querySelector('#voiceCatchControlUI button[onclick*="stopRecording"]');
       if (stopButton) {
         stopButton.textContent = '⏳ Processing...';
       }
       
       console.log('✅ 停止中状态显示完成');
       
     } catch (error) {
       console.error('❌ 显示停止中状态失败:', error);
     }
   }
   
   // 🆕 新增：显示视频裁剪进度函数
   function showVideoCroppingProgress() {
     try {
       console.log('🎬 显示视频裁剪进度...');
       
       // 🆕 修复：更新处理状态
       currentProcessStatus = 'cropping';
       
       // 更新录制时间显示为"裁剪中..."
       const timeDisplay = document.getElementById('recordingTime');
       if (timeDisplay) {
         timeDisplay.textContent = '🎬 Cropping...';
         timeDisplay.style.color = '#00ffff'; // 青色表示裁剪中
       }
       
       // 更新停止按钮文本
       const stopButton = document.querySelector('#voiceCatchControlUI button[onclick*="stopRecording"]');
       if (stopButton) {
         stopButton.textContent = '🎬 Cropping...';
       }
       
       console.log('✅ 视频裁剪进度显示完成');
       
     } catch (error) {
       console.error('❌ 显示视频裁剪进度失败:', error);
     }
   }
   
     // 🆕 新增：显示数据保存进度函数
  function showDataSavingProgress() {
    try {
      console.log('💾 显示数据保存进度...');
      
      // 🆕 修复：更新处理状态
      currentProcessStatus = 'saving';
      
      // 更新录制时间显示为"保存中..."
      const timeDisplay = document.getElementById('recordingTime');
      if (timeDisplay) {
        timeDisplay.textContent = '💾 Saving...';
        timeDisplay.style.color = '#ffff00'; // 黄色表示保存中
      }
      
      // 更新停止按钮文本
      const stopButton = document.querySelector('#voiceCatchControlUI button[onclick*="stopRecording"]');
      if (stopButton) {
                 stopButton.textContent = '💾 Saving...';
      }
      
      console.log('✅ 数据保存进度显示完成');
      
    } catch (error) {
      console.error('❌ 显示数据保存进度失败:', error);
    }
  }
  
  // 🆕 新增：显示倒计时界面函数
  function showCountdownUI() {
    try {
      console.log('⏰ 显示倒计时界面...');
      
      // 创建倒计时容器
      const countdownContainer = document.createElement('div');
      countdownContainer.id = 'voiceCatchCountdown';
      countdownContainer.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.8);
        color: white;
        font-size: 120px;
        font-weight: bold;
        font-family: Arial, sans-serif;
        width: 200px;
        height: 200px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 999999;
        box-shadow: 0 0 50px rgba(0, 0, 0, 0.5);
      `;
      
      // 设置初始倒计时数字
      countdownContainer.textContent = '4';
      
      // 添加到页面
      document.body.appendChild(countdownContainer);
      
      console.log('✅ 倒计时界面创建完成');
      
    } catch (error) {
      console.error('❌ 显示倒计时界面失败:', error);
    }
  }
  
  // 🆕 新增：开始倒计时函数
  function startCountdown() {
    try {
      console.log('⏰ 开始倒计时...');
      
      isCountdownActive = true;
      let countdownNumber = 4;
      
      // 显示倒计时界面
      showCountdownUI();
      
      // 开始倒计时
      countdownInterval = setInterval(() => {
        countdownNumber--;
        
        const countdownElement = document.getElementById('voiceCatchCountdown');
        if (countdownElement) {
          if (countdownNumber > 0) {
            // 更新倒计时数字
            countdownElement.textContent = countdownNumber;
            console.log(`⏰ 倒计时: ${countdownNumber}`);
          } else {
            // 倒计时结束，开始录制
            console.log('⏰ 倒计时结束，开始录制');
            countdownElement.textContent = '🎬';
            countdownElement.style.fontSize = '80px';
            
            // 延迟一小段时间后开始录制，让用户看到开始标志
            setTimeout(() => {
              cleanupCountdownUI();
              startActualRecordingWithStream(stream);
            }, 500);
          }
        }
      }, 1000);
      
      console.log('✅ 倒计时已开始');
      
    } catch (error) {
      console.error('❌ 开始倒计时失败:', error);
      // 如果倒计时失败，直接开始录制
      startActualRecording();
    }
  }
  
  // 🆕 新增：清理倒计时界面函数
  function cleanupCountdownUI() {
    try {
      console.log('🧹 清理倒计时界面...');
      
      // 清理倒计时状态
      isCountdownActive = false;
      
      // 清理定时器
      if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
      }
      
      // 移除倒计时界面
      const countdownElement = document.getElementById('voiceCatchCountdown');
      if (countdownElement) {
        countdownElement.remove();
        console.log('🧹 倒计时界面已清理');
      }
      
      console.log('✅ 倒计时界面清理完成');
      
    } catch (error) {
      console.error('❌ 清理倒计时界面失败:', error);
    }
  }
  
  // 🆕 新增：倒计时结束后使用已有流开始录制函数
  async function startActualRecordingWithStream(existingStream) {
    try {
      console.log('🎬 倒计时结束，使用已有流开始录制...');
      
      // 使用已经获取的流
      stream = existingStream;
      
      // 创建MediaRecorder
      recorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 5000000
      });
        
      chunks = [];
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
        
      recorder.onstop = async () => {
        console.log('🎬 录制停止，开始处理数据...');
        
        // 创建Blob
        const blob = new Blob(chunks, { type: 'video/webm' });
        
        // 准备录制数据
        const recordingData = {
          timestamp: Date.now(),
          duration: Date.now() - recorder.startTime,
          format: 'webm',
          size: blob.size,
          blob: blob,
          blobType: 'video/webm',
          metadata: {
            width: stream.getVideoTracks()[0]?.getSettings()?.width || 1920,
            height: stream.getVideoTracks()[0]?.getSettings()?.height || 1080,
            frameRate: stream.getVideoTracks()[0]?.getSettings()?.frameRate || 30
          }
        };
        
        try {
          // 处理录制完成
          await handleRecordingComplete(recordingData);
        } catch (error) {
          console.error('❌ 录制数据处理失败:', error);
          alert(window.i18n ? window.i18n.t('content.alerts.recordingProcessFailed', { error: error.message }) : `Recording process failed: ${error.message}`);
        } finally {
          // 清理资源
          try {
            stream.getTracks().forEach(track => track.stop());
            chunks = [];
            isRecording = false;
            recordingStartTime = null;
                 
            // 🆕 修复：显式重置recorder变量
            recorder = null;
                 
            // 🆕 修复：重置处理状态
            isProcessing = false;
            currentProcessStatus = '';
                 
            // 清理录制操作界面
            cleanupRecordingControlUI();
                 
            console.log('✅ 录制资源清理完成');
          } catch (cleanupError) {
            console.error('❌ 录制资源清理失败:', cleanupError);
          }
        }
      };
      
      // 开始录制
      recorder.start();
      recorder.startTime = Date.now();
      isRecording = true;
      recordingStartTime = Date.now();
      
      // 🆕 新增：初始化暂停时间变量
      window.totalPausedTime = 0;
      window.pauseStartTime = null;
      
      console.log('✅ 录制已开始，暂停时间变量已初始化');
      
      // 🔥 修复：创建录制操作界面
      createRecordingControlUI();
      
    } catch (error) {
      console.error('❌ 倒计时后开始录制失败:', error);
      alert(`录制失败: ${error.message}`);
    }
  }
  
  // 🔥 修复：删除录制
  function deleteRecording() {
    if (confirm(window.i18n ? window.i18n.t('content.alerts.confirmDeleteRecording') : 'Are you sure you want to delete the current recording?')) {
      stopRecording();
      cleanupRecordingControlUI();
      console.log('🗑️ 录制已删除');
    }
  }
  
     // 🆕 新增：清理录制操作界面函数
   function cleanupRecordingControlUI() {
     try {
       console.log('🧹 开始清理录制操作界面...');
       
       // 🔧 新增：清理Canvas独立计时器
       if (window.canvasRecordingTimer) {
         clearInterval(window.canvasRecordingTimer);
         window.canvasRecordingTimer = null;
         console.log('🧹 Canvas独立计时器已清理');
       }
       
       // 清理录制操作界面
      const controlUI = document.getElementById('voiceCatchControlUI');
      if (controlUI) {
        controlUI.remove();
         console.log('🧹 录制操作界面已清理');
      }
       
       // 🆕 新增：清理区域录制信息
       const regionInfo = document.getElementById('voiceCatchRegionInfo');
       if (regionInfo) {
         regionInfo.remove();
         console.log('🧹 区域录制信息已清理');
      }
      
              // 🆕 新增：清理区域选择框
       const selectionBox = document.getElementById('voiceCatchSelectionBox');
       if (selectionBox) {
         selectionBox.remove();
         console.log('🧹 区域选择框已清理');
       }
       
       // 🆕 修复：确保清理所有区域选择相关UI
       cleanupRegionSelectionUI();
       
       console.log('✅ 录制操作界面清理完成');
      
     } catch (error) {
       console.error('❌ 清理录制操作界面失败:', error);
     }
   }
  
  // 🆕 新增：截图功能启动函数（简化版）
  function startScreenshot() {
    try {
      console.log('📸 启动截图模式...');
      
      // 启动真正的截图流程
      startScreenshotFlow();
      
    } catch (error) {
      console.error('❌ 启动截图模式失败:', error);
      throw error;
    }
  }
  
  // 🆕 新增：截图流程主函数（新方案 - 并行优化版）
  async function startScreenshotFlow() {
    try {
      console.log('📸 开始新方案截图流程（并行优化版）...');
      
      // 🆕 优化：并行执行截图和UI准备
      const [canvas, uiReady] = await Promise.all([
        captureCurrentPage(),
        prepareAreaSelectionUI()
      ]);
      
      console.log('✅ 页面截图完成');
      
      // 立即显示区域选择界面
      await showAreaSelectionInterface(canvas);
      
      console.log('✅ 新方案截图流程完成');
      
    } catch (error) {
      console.error('❌ 新方案截图流程失败:', error);
      showError('截图失败: ' + error.message);
    }
  }
  
  // 🆕 新增：直接截图当前页面（新方案 - 使用缓存）
  async function captureCurrentPage() {
    try {
      console.log('📸 开始截图当前页面...');
      
      // 使用缓存机制获取html2canvas
      const html2canvas = await getHtml2Canvas();
      
      console.log('✅ 使用html2canvas库截图');
      const canvas = await html2canvas(document.body, {
        useCORS: true,
        allowTaint: true,
        scale: 1,
        logging: false,
        // 🆕 优化：提升截图速度
        removeContainer: true,
        foreignObjectRendering: false,
        imageTimeout: 0,
        // 🆕 优化：只忽略真正有问题的元素
        ignoreElements: (element) => {
          // 只忽略隐藏元素和脚本元素，保留视频播放器
          return element.tagName === 'SCRIPT' || 
                 element.style.display === 'none' ||
                 element.style.visibility === 'hidden' ||
                 element.classList.contains('hidden');
        },
        // 🆕 优化：减少渲染复杂度
        backgroundColor: null,
        width: window.innerWidth,
        height: window.innerHeight
      });
      return canvas;
      
    } catch (error) {
      console.error('❌ 页面截图失败:', error);
      throw error;
    }
  }
  
  // 🆕 新增：动态加载html2canvas（修复版 - 尝试多种加载方式）
  async function loadAndUseHtml2Canvas() {
    try {
      console.log('🔄 开始动态加载html2canvas（多种方式尝试）...');
      
      // 方法1：检查是否已经有html2canvas
      if (typeof html2canvas !== 'undefined') {
        console.log('✅ html2canvas已可用');
        const canvas = await html2canvas(document.body, {
          useCORS: true,
          allowTaint: true,
          scale: 1,
          logging: false
        });
        return canvas;
      }
      
      // 方法2：尝试从扩展本地文件加载
      console.log('🔄 尝试从扩展本地文件加载html2canvas...');
      try {
        const canvas = await loadHtml2CanvasFromExtension();
        return canvas;
      } catch (localError) {
        console.warn('⚠️ 本地文件加载失败:', localError.message);
      }
      
      // 方法3：尝试从页面全局变量获取
      console.log('🔄 尝试从页面全局变量获取html2canvas...');
      if (window.html2canvas) {
        console.log('✅ 从页面全局变量获取到html2canvas');
        const canvas = await window.html2canvas(document.body, {
          useCORS: true,
          allowTaint: true,
          scale: 1,
          logging: false
        });
        return canvas;
      }
      
      // 如果所有方法都失败，抛出错误
      throw new Error('无法加载html2canvas，请使用备选方案');
      
    } catch (error) {
      console.error('❌ html2canvas加载失败:', error.message);
      throw error;
    }
  }
  
  // 🆕 新增：从扩展本地文件加载html2canvas（修复版）
  async function loadHtml2CanvasFromExtension() {
    try {
      console.log('🔄 尝试从扩展本地文件加载...');
      
      // 方法1：检查扩展是否已经包含了html2canvas
      if (typeof html2canvas !== 'undefined') {
        console.log('✅ 扩展已包含html2canvas');
        // 使用html2canvas截图
        const canvas = await html2canvas(document.body, {
          useCORS: true,
          allowTaint: true,
          scale: 1,
          logging: false
        });
        return canvas;
      }
      
      // 方法2：尝试从扩展的web_accessible_resources加载
      const scriptUrl = chrome.runtime.getURL('html2canvas.min.js');
      console.log('🔄 尝试加载扩展本地文件:', scriptUrl);
      
      // 检查文件是否存在
      try {
        const response = await fetch(scriptUrl);
        if (!response.ok) {
          throw new Error(`文件不存在: ${response.status}`);
        }
        console.log('✅ html2canvas.min.js文件存在');
      } catch (fetchError) {
        console.warn('⚠️ html2canvas.min.js文件不存在:', fetchError.message);
        throw new Error('html2canvas.min.js文件不存在');
      }
      
      // 方法3：通过Service Worker注入脚本（推荐方式）
      console.log('🔄 尝试通过Service Worker注入html2canvas...');
      try {
        // 发送消息给Service Worker，请求注入html2canvas
        const response = await chrome.runtime.sendMessage({
          action: 'injectHtml2Canvas',
          tabId: null // Service Worker会自己获取当前标签页
        });
        
        if (response && response.success) {
          console.log('✅ html2canvas注入成功，开始截图');
          try {
            // 现在html2canvas应该可用了，尝试截图
            if (typeof html2canvas !== 'undefined' && typeof html2canvas === 'function') {
              const canvas = await html2canvas(document.body, {
                useCORS: true,
                allowTaint: true,
                scale: 1,
                logging: false,
                // 🆕 新增：优化性能参数
                removeContainer: true,
                foreignObjectRendering: false,
                imageTimeout: 0,
                ignoreElements: (element) => {
                  // 忽略一些不需要的元素以提高性能
                  return element.tagName === 'SCRIPT' || 
                         element.tagName === 'STYLE' ||
                         element.classList.contains('hidden');
                }
              });
              console.log('✅ html2canvas截图成功');
              return canvas;
            } else {
              throw new Error('html2canvas注入后仍然不可用');
            }
          } catch (screenshotError) {
            console.warn('⚠️ html2canvas截图失败:', screenshotError.message);
            throw new Error('html2canvas截图执行失败');
          }
        } else {
          throw new Error(response?.error || 'Service Worker注入失败');
        }
        
      } catch (injectError) {
        console.warn('⚠️ Service Worker注入失败:', injectError.message);
        throw new Error('无法通过Service Worker注入html2canvas脚本');
      }
      
    } catch (error) {
      console.error('❌ 扩展本地文件加载失败:', error.message);
      throw error;
    }
  }
  
  // 🆕 新增：使用Canvas API截图（备选方案 - 改进版）
  async function captureWithCanvasAPI() {
    try {
      console.log('📸 使用Canvas API截图（改进版）...');
      
      // 创建Canvas并设置尺寸
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // 设置Canvas尺寸为页面尺寸
      canvas.width = Math.max(
        document.documentElement.scrollWidth,
        document.body.scrollWidth
      );
      canvas.height = Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight
      );
      
      // 方法1：尝试使用更高级的页面捕获方法
      try {
        console.log('🔄 尝试使用高级页面捕获方法...');
        
        // 使用Canvas API捕获可见内容
        const result = await captureVisibleContent(ctx, canvas.width, canvas.height);
        if (result) {
          console.log('✅ 高级页面捕获完成');
          return canvas;
        }
      } catch (captureError) {
        console.warn('⚠️ 高级页面捕获失败，使用基础方法:', captureError);
      }
      
      // 方法2：基础方法 - 创建一个有意义的Canvas
      console.log('🔄 使用基础截图方法...');
      
      // 填充背景色
      ctx.fillStyle = '#f8f9fa';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // 添加网格背景
      ctx.strokeStyle = '#e9ecef';
      ctx.lineWidth = 1;
      const gridSize = 20;
      for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
      
      // 添加页面信息
      ctx.fillStyle = '#495057';
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('页面截图', canvas.width / 2, canvas.height / 2 - 30);
      
      ctx.fillStyle = '#6c757d';
      ctx.font = '16px Arial';
      ctx.fillText(`页面尺寸: ${canvas.width} × ${canvas.height}`, canvas.width / 2, canvas.height / 2);
      ctx.fillText(`页面标题: ${document.title}`, canvas.width / 2, canvas.height / 2 + 25);
      ctx.fillText(`URL: ${window.location.href}`, canvas.width / 2, canvas.height / 2 + 50);
      
      // 添加时间戳
      const now = new Date();
      ctx.fillStyle = '#adb5bd';
      ctx.font = '14px Arial';
      ctx.textAlign = 'right';
      ctx.fillText(`截图时间: ${now.toLocaleString()}`, canvas.width - 20, canvas.height - 20);
      
      console.log('✅ 基础截图方法完成');
      return canvas;
      
    } catch (error) {
      console.error('❌ Canvas API截图失败:', error);
      throw error;
    }
  }
  
  // 🆕 新增：高级页面内容捕获（改进版）
  async function captureVisibleContent(ctx, width, height) {
    try {
      console.log('🔄 开始高级页面内容捕获（改进版）...');
      
      // 填充白色背景
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      
      // 方法1：尝试捕获页面中的主要文本内容
      try {
        const mainContent = captureMainPageContent(ctx, width, height);
        if (mainContent) {
          console.log('✅ 主要页面内容捕获完成');
          return true;
        }
      } catch (mainError) {
        console.warn('⚠️ 主要内容捕获失败，使用备用方法:', mainError);
      }
      
      // 方法2：备用方法 - 绘制页面基本信息
      drawPageBasicInfo(ctx, width, height);
      
      console.log('✅ 高级页面内容捕获完成');
      return true;
      
    } catch (error) {
      console.error('❌ 高级页面内容捕获失败:', error);
      return false;
    }
  }
  
  // 🆕 新增：捕获主要页面内容
  function captureMainPageContent(ctx, width, height) {
    try {
      console.log('🔄 开始捕获主要页面内容...');
      
      // 设置文本样式
      ctx.fillStyle = '#000000';
      ctx.font = '16px Arial';
      ctx.textAlign = 'left';
      
      let yOffset = 80;
      const maxElements = 50; // 限制元素数量
      let elementCount = 0;
      
      // 按优先级选择元素
      const selectors = [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', // 标题
        'p', 'span', 'div', 'a', 'button', 'input', // 文本和交互元素
        'label', 'strong', 'em', 'b', 'i' // 强调文本
      ];
      
      for (const selector of selectors) {
        if (elementCount >= maxElements) break;
        
        const elements = document.querySelectorAll(selector);
        for (let i = 0; i < elements.length && elementCount < maxElements; i++) {
          const element = elements[i];
          const text = element.textContent?.trim();
          
          if (text && text.length > 0 && text.length < 150) {
            // 获取元素位置
            const rect = element.getBoundingClientRect();
            
            // 检查元素是否在视口内
            if (rect.width > 0 && rect.height > 0 && 
                rect.top >= 0 && rect.left >= 0 && 
                rect.bottom <= height && rect.right <= width) {
              
              // 绘制文本
              ctx.fillText(text, rect.left, rect.top + yOffset);
              yOffset += 18;
              elementCount++;
              
              // 如果超出Canvas高度，停止绘制
              if (yOffset > height - 100) break;
            }
          }
        }
        
        if (yOffset > height - 100) break;
      }
      
      // 绘制页面标题
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(document.title || '无标题页面', width / 2, 40);
      
      // 绘制页面URL
      ctx.fillStyle = '#666666';
      ctx.font = '14px Arial';
      ctx.fillText(window.location.href, 20, 70);
      
      // 绘制页面尺寸信息
      ctx.fillStyle = '#999999';
      ctx.font = '12px Arial';
      ctx.fillText(`页面尺寸: ${width} × ${height}`, 20, 60);
      
      console.log(`✅ 主要页面内容捕获完成，共捕获 ${elementCount} 个元素`);
      return true;
      
    } catch (error) {
      console.error('❌ 主要页面内容捕获失败:', error);
      return false;
    }
  }
  
  // 🆕 新增：绘制页面基本信息
  function drawPageBasicInfo(ctx, width, height) {
    try {
      console.log('🔄 绘制页面基本信息...');
      
      // 绘制页面标题
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(document.title || '无标题页面', width / 2, 40);
      
      // 绘制页面URL
      ctx.fillStyle = '#666666';
      ctx.font = '14px Arial';
      ctx.fillText(window.location.href, 20, 70);
      
      // 绘制页面尺寸信息
      ctx.fillStyle = '#999999';
      ctx.font = '12px Arial';
      ctx.fillText(`页面尺寸: ${width} × ${height}`, 20, 90);
      
      // 绘制说明文字
      ctx.fillStyle = '#333333';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('页面内容已捕获', width / 2, height / 2);
      ctx.fillText(window.i18n ? window.i18n.t('content.instructions.screenshotPageInfo') : 'Please use the area selection tool to select the area to screenshot', width / 2, height / 2 + 30);
      
      console.log('✅ 页面基本信息绘制完成');
      
    } catch (error) {
      console.error('❌ 页面基本信息绘制失败:', error);
    }
  }
  
  // 🆕 新增：绘制页面元素到Canvas
  function drawPageElementsToCanvas(ctx, width, height) {
    try {
      console.log('🔄 开始绘制页面元素...');
      
      // 填充背景
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      
      // 绘制页面标题
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 20px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(document.title || '无标题页面', 20, 40);
      
      // 绘制页面URL
      ctx.fillStyle = '#666666';
      ctx.font = '14px Arial';
      ctx.fillText(window.location.href, 20, 65);
      
      // 绘制页面尺寸信息
      ctx.fillStyle = '#999999';
      ctx.font = '12px Arial';
      ctx.fillText(`页面尺寸: ${width} × ${height}`, 20, 85);
      
      console.log('✅ 页面元素绘制完成');
      
    } catch (error) {
      console.error('❌ 绘制页面元素失败:', error);
    }
  }
  
  // 🆕 新增：显示区域选择界面（修复版 - 显示冻结画面）
  function showAreaSelectionInterface(canvas) {
    try {
      console.log('📸 显示区域选择界面（修复版）...');
      
      // 1. 首先显示冻结的页面画面（静态Canvas）
      const frozenCanvasContainer = document.createElement('div');
      frozenCanvasContainer.id = 'voiceCatchFrozenCanvas';
      frozenCanvasContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        z-index: 1000000;
        background: white;
        overflow: auto;
      `;
      
      // 将Canvas添加到容器中，显示冻结的画面
      const displayCanvas = document.createElement('canvas');
      displayCanvas.width = canvas.width;
      displayCanvas.height = canvas.height;
      displayCanvas.style.cssText = `
        display: block;
        max-width: 100%;
        height: auto;
      `;
      
      // 将原始Canvas内容复制到显示Canvas
      const displayCtx = displayCanvas.getContext('2d');
      displayCtx.drawImage(canvas, 0, 0);
      
      frozenCanvasContainer.appendChild(displayCanvas);
      document.body.appendChild(frozenCanvasContainer);
      
      console.log('✅ 冻结画面显示完成，Canvas尺寸:', canvas.width, 'x', canvas.height);
      
      // 2. 在冻结画面上方添加半透明选择覆盖层
      const selectionOverlay = document.createElement('div');
      selectionOverlay.id = 'voiceCatchAreaSelection';
      selectionOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.2);
        z-index: 1000001;
        cursor: crosshair;
        user-select: none;
        pointer-events: auto;
      `;
      
      // 3. 添加提示文字
      const instruction = document.createElement('div');
      instruction.id = 'voiceCatchSelectionInstruction';
      instruction.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 15px 25px;
        border-radius: 10px;
        font-family: Arial, sans-serif;
        font-size: 16px;
        z-index: 1000002;
        text-align: center;
        pointer-events: none;
      `;
              instruction.textContent = window.i18n ? window.i18n.t('content.instructions.screenshotAreaSelect') : '🎯 Drag to select the area to screenshot, press Enter to confirm, Esc to cancel';
      
      // 4. 添加到页面
      document.body.appendChild(selectionOverlay);
      document.body.appendChild(instruction);
      
      console.log('✅ 区域选择界面显示完成');
      
      // 5. 设置区域选择事件（在冻结的Canvas上进行选择）
      setupAreaSelectionEvents(selectionOverlay, canvas, instruction, frozenCanvasContainer);
      
    } catch (error) {
      console.error('❌ 显示区域选择界面失败:', error);
    }
  }
  
  // 🆕 新增：设置区域选择事件（修复版 - 支持冻结Canvas）
  function setupAreaSelectionEvents(overlay, canvas, instruction, frozenCanvasContainer) {
    try {
      console.log('📸 设置区域选择事件...');
      
      let isSelecting = false;
      let startX, startY;
      let selectionBox = null;
      
      // 鼠标按下事件
      overlay.addEventListener('mousedown', (e) => {
        isSelecting = true;
        startX = e.clientX;
        startY = e.clientY;
        
        // 创建选择框
        selectionBox = document.createElement('div');
        selectionBox.style.cssText = `
          position: fixed;
          border: 2px dashed #00ff00;
          background: rgba(0, 255, 0, 0.1);
          z-index: 1000002;
          pointer-events: none;
        `;
        selectionBox.style.left = startX + 'px';
        selectionBox.style.top = startY + 'px';
        selectionBox.style.width = '0px';
        selectionBox.style.height = '0px';
        
        document.body.appendChild(selectionBox);
        console.log('✅ 开始区域选择');
      });
      
      // 鼠标移动事件
      overlay.addEventListener('mousemove', (e) => {
        if (!isSelecting || !selectionBox) return;
        
        const currentX = e.clientX;
        const currentY = e.clientY;
        
        // 计算选择框位置和尺寸
        const left = Math.min(startX, currentX);
        const top = Math.min(startY, currentY);
        const width = Math.abs(currentX - startX);
        const height = Math.abs(currentY - startY);
        
        // 更新选择框
        selectionBox.style.left = left + 'px';
        selectionBox.style.top = top + 'px';
        selectionBox.style.width = width + 'px';
        selectionBox.style.height = height + 'px';
      });
      
      // 鼠标松开事件
      overlay.addEventListener('mouseup', (e) => {
        if (!isSelecting || !selectionBox) return;
        
        isSelecting = false;
        const endX = e.clientX;
        const endY = e.clientY;
        
        // 计算选择区域
        const rect = {
          x: Math.min(startX, endX),
          y: Math.min(startY, endY),
          width: Math.abs(endX - startX),
          height: Math.abs(endY - startY)
        };
        
        console.log('✅ 区域选择完成:', rect);
        
        // 清理选择界面
        cleanupAreaSelection(overlay, instruction, selectionBox, frozenCanvasContainer);
        
        // 显示预览界面
        showScreenshotPreview(canvas, rect);
      });
      
      // 键盘事件（Enter确认，Esc取消）
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          console.log('❌ 用户取消截图');
          cleanupAreaSelection(overlay, instruction, selectionBox, frozenCanvasContainer);
        }
      });
      
      console.log('✅ 区域选择事件设置完成');
      
    } catch (error) {
      console.error('❌ 设置区域选择事件失败:', error);
    }
  }
  
  // 🆕 新增：清理区域选择界面（修复版 - 清理所有元素）
  function cleanupAreaSelection(overlay, instruction, selectionBox, frozenCanvasContainer) {
    try {
      if (overlay) overlay.remove();
      if (instruction) instruction.remove();
      if (selectionBox) selectionBox.remove();
      if (frozenCanvasContainer) frozenCanvasContainer.remove();
      console.log('✅ 区域选择界面清理完成');
    } catch (error) {
      console.error('❌ 清理区域选择界面失败:', error);
    }
  }
  
  // 🎨 新增：创建调色板组件
  function createColorPalette() {
    try {
      console.log('🎨 创建调色板组件...');
      
      // 创建调色板容器
      const paletteContainer = document.createElement('div');
      paletteContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin: 0;
        padding: 6px;
        background: #f8f9fa;
        border-radius: 6px;
        border: 1px solid #e9ecef;
        width: 200px;
        flex-shrink: 0;
      `;
      
      // 创建标题
      const paletteTitle = document.createElement('div');
      paletteTitle.textContent = '🎨 调色板';
      paletteTitle.style.cssText = `
        font-weight: bold;
        color: #333;
        margin-bottom: 4px;
        text-align: center;
        font-size: 13px;
      `;
      
      // 创建当前颜色显示
      const currentColorDisplay = document.createElement('div');
      currentColorDisplay.style.cssText = `
        display: flex;
        align-items: center;
        gap: 4px;
        margin-bottom: 4px;
        justify-content: center;
      `;
      
      const colorLabel = document.createElement('span');
      colorLabel.textContent = '当前颜色:';
      colorLabel.style.cssText = 'font-size: 11px; color: #666;';
      
      const colorPreview = document.createElement('div');
      colorPreview.style.cssText = `
        width: 24px;
        height: 24px;
        border-radius: 3px;
        border: 1px solid #ddd;
        background: ${globalColorState.primary};
        cursor: pointer;
      `;
      colorPreview.title = '点击选择自定义颜色';
      
      // 添加点击事件，直接选择自定义颜色
      colorPreview.onclick = () => {
        colorInput.click();
      };
      
      const colorValue = document.createElement('span');
      colorValue.textContent = globalColorState.primary;
      colorValue.style.cssText = 'font-size: 11px; color: #333; font-family: monospace;';
      
      currentColorDisplay.appendChild(colorLabel);
      currentColorDisplay.appendChild(colorPreview);
      currentColorDisplay.appendChild(colorValue);
      
      // 🎨 新增：透明度控制区域
      const opacityContainer = document.createElement('div');
      opacityContainer.style.cssText = `
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 4px;
        justify-content: center;
      `;
      
      const opacityLabel = document.createElement('span');
      opacityLabel.textContent = '透明度:';
      opacityLabel.style.cssText = 'font-size: 11px; color: #666;';
      
      const opacitySlider = document.createElement('input');
      opacitySlider.type = 'range';
      opacitySlider.min = '0';
      opacitySlider.max = '100';
      opacitySlider.value = Math.round(globalColorState.opacity * 100);
      opacitySlider.style.cssText = `
        width: 80px;
        height: 16px;
        cursor: pointer;
      `;
      
      const opacityValue = document.createElement('span');
      opacityValue.textContent = Math.round(globalColorState.opacity * 100) + '%';
      opacityValue.style.cssText = 'font-size: 11px; color: #333; font-family: monospace; min-width: 30px;';
      
      opacityContainer.appendChild(opacityLabel);
      opacityContainer.appendChild(opacitySlider);
      opacityContainer.appendChild(opacityValue);
      
      // 🎨 新增：透明度滑块事件监听
      opacitySlider.addEventListener('input', (e) => {
        const newOpacity = parseInt(e.target.value) / 100;
        updateGlobalOpacity(newOpacity);
        opacityValue.textContent = e.target.value + '%';
        
        // 🎨 新增：实时更新颜色预览的透明度效果
        const colorWithOpacity = getColorWithOpacity(globalColorState.primary);
        colorPreview.style.background = colorWithOpacity;
        
        console.log('🎨 透明度已更新:', newOpacity, '颜色:', colorWithOpacity);
      });
      
      // 创建预设颜色网格
      const presetColors = createPresetColorGrid();
      
      // 创建自定义颜色按钮
      const customColorBtn = document.createElement('button');
      customColorBtn.textContent = '🎨 自定义颜色';
      customColorBtn.style.cssText = `
        padding: 5px 10px;
        background: #6c757d;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 11px;
        transition: background 0.2s;
        margin-top: 3px;
      `;
      customColorBtn.onmouseover = () => customColorBtn.style.background = '#5a6268';
      customColorBtn.onmouseout = () => customColorBtn.style.background = '#6c757d';
      
      // 自定义颜色选择器
      const colorInput = document.createElement('input');
      colorInput.type = 'color';
      colorInput.value = globalColorState.primary;
      colorInput.style.cssText = 'display: none;';
      
      // 绑定自定义颜色选择事件
      customColorBtn.onclick = () => {
        colorInput.click();
      };
      
      colorInput.onchange = (e) => {
        const newColor = e.target.value;
        updateGlobalColor(newColor);
        
        // 🎨 新增：应用当前透明度到新选择的颜色
        const colorWithOpacity = getColorWithOpacity(newColor);
        colorPreview.style.background = colorWithOpacity;
        colorValue.textContent = newColor;
        
        console.log('🎨 新颜色已选择:', newColor, '应用透明度后:', colorWithOpacity);
      };
      
      // 组装调色板
      paletteContainer.appendChild(paletteTitle);
      paletteContainer.appendChild(currentColorDisplay);
      paletteContainer.appendChild(opacityContainer);
      paletteContainer.appendChild(presetColors);
      paletteContainer.appendChild(customColorBtn);
      paletteContainer.appendChild(colorInput);
      
      console.log('✅ 调色板组件创建完成');
      return paletteContainer;
      
    } catch (error) {
      console.error('❌ 创建调色板组件失败:', error);
      return document.createElement('div'); // 返回空div作为备用
    }
  }
  
  // 🎨 新增：创建预设颜色网格
  function createPresetColorGrid() {
    try {
      // 预设颜色数组
      const colors = [
        '#FF0000', '#FF4500', '#FF8C00', '#FFD700', '#FFFF00', '#ADFF2F', '#00FF00', '#00FA9A',
        '#00FFFF', '#00BFFF', '#0000FF', '#8A2BE2', '#FF00FF', '#FF1493', '#FF69B4', '#FFB6C1',
        '#000000', '#696969', '#808080', '#A9A9A9', '#C0C0C0', '#D3D3D3', '#DCDCDC', '#F5F5F5',
        '#FFFFFF', '#8B0000', '#DC143C', '#B22222', '#CD5C5C', '#F08080', '#FA8072', '#E9967A'
      ];
      
      // 创建颜色网格容器
      const gridContainer = document.createElement('div');
      gridContainer.style.cssText = `
        display: grid;
        grid-template-columns: repeat(8, 1fr);
        gap: 1px;
        margin: 3px 0;
      `;
      
      // 创建颜色按钮
      colors.forEach(color => {
        const colorBtn = document.createElement('button');
        colorBtn.style.cssText = `
          width: 18px;
          height: 18px;
          border: 1px solid ${color === globalColorState.primary ? '#333' : '#ddd'};
          border-radius: 2px;
          background: ${color};
          cursor: pointer;
          transition: transform 0.1s;
        `;
        colorBtn.title = color;
        
        // 鼠标悬停效果
        colorBtn.onmouseover = () => {
          colorBtn.style.transform = 'scale(1.1)';
        };
        colorBtn.onmouseout = () => {
          colorBtn.style.transform = 'scale(1)';
        };
        
        // 点击选择颜色
        colorBtn.onclick = () => {
          updateGlobalColor(color);
          
          // 🎨 新增：应用当前透明度到新选择的颜色
          const colorWithOpacity = getColorWithOpacity(color);
          
          // 更新当前颜色显示
          const colorPreview = document.querySelector('#voiceCatchScreenshotPreview div[style*="width: 24px"]');
          const colorValue = document.querySelector('#voiceCatchScreenshotPreview span[style*="font-family: monospace"]');
          if (colorPreview) {
            colorPreview.style.background = colorWithOpacity;
            console.log('✅ 颜色预览已更新:', color, '应用透明度后:', colorWithOpacity);
          }
          if (colorValue) {
            colorValue.textContent = color;
            console.log('✅ 颜色值已更新:', color);
          }
          // 更新所有按钮边框
          gridContainer.querySelectorAll('button').forEach(btn => {
            btn.style.borderColor = btn === colorBtn ? '#333' : '#ddd';
          });
        };
        
        gridContainer.appendChild(colorBtn);
      });
      
      return gridContainer;
      
    } catch (error) {
      console.error('❌ 创建预设颜色网格失败:', error);
      return document.createElement('div'); // 返回空div作为备用
    }
  }
  
  // 🎨 新增：更新全局颜色状态
  function updateGlobalColor(newColor) {
    try {
      console.log('🎨 更新全局颜色:', newColor);
      
      // 更新全局状态
      globalColorState.lastUsed = globalColorState.primary;
      globalColorState.primary = newColor;
      
      // 保存到localStorage
      localStorage.setItem('lastUsedColor', newColor);
      
      console.log('✅ 全局颜色已更新');
      
    } catch (error) {
      console.error('❌ 更新全局颜色失败:', error);
    }
  }
  
  // 🎨 新增：更新全局透明度状态
  function updateGlobalOpacity(newOpacity) {
    try {
      console.log('🎨 更新全局透明度:', newOpacity);
      
      // 更新全局状态
      globalColorState.opacity = newOpacity;
      
      // 保存到localStorage
      localStorage.setItem('lastUsedOpacity', newOpacity.toString());
      
      console.log('✅ 全局透明度已更新');
      
    } catch (error) {
      console.error('❌ 更新全局透明度失败:', error);
    }
  }
  
  // 🎨 新增：获取带透明度的颜色值
  function getColorWithOpacity(baseColor, opacity = null) {
    try {
      // 如果没有指定透明度，使用全局透明度
      const targetOpacity = opacity !== null ? opacity : globalColorState.opacity;
      
      // 如果是hex颜色，转换为rgba
      if (baseColor.startsWith('#')) {
        const r = parseInt(baseColor.slice(1, 3), 16);
        const g = parseInt(baseColor.slice(3, 5), 16);
        const b = parseInt(baseColor.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${targetOpacity})`;
      }
      
      // 如果已经是rgba格式，只修改透明度
      if (baseColor.startsWith('rgba')) {
        return baseColor.replace(/[\d.]+\)$/, targetOpacity + ')');
      }
      
      // 如果已经是rgb格式，转换为rgba
      if (baseColor.startsWith('rgb')) {
        return baseColor.replace('rgb', 'rgba').replace(')', `, ${targetOpacity})`);
      }
      
      // 默认返回原色
      return baseColor;
      
    } catch (error) {
      console.error('❌ 获取带透明度的颜色失败:', error);
      return baseColor;
    }
  }
  
  // 🆕 新增：显示截图预览界面（支持区域裁剪）
  function showScreenshotPreview(canvas, rect) {
    try {
      console.log('📸 显示截图预览界面...');
      
      // 创建预览覆盖层
      const previewOverlay = document.createElement('div');
      previewOverlay.id = 'voiceCatchScreenshotPreview';
      previewOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.8);
        z-index: 1000000;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      `;
      
      // 创建预览容器
      const previewContainer = document.createElement('div');
      previewContainer.style.cssText = `
        background: white;
        border-radius: 10px;
        padding: 20px;
        max-width: 90vw;
        max-height: 90vh;
        overflow: auto;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
      `;
      
      // 添加标题
      const title = document.createElement('h3');
      title.textContent = '📸 截图预览';
      title.style.cssText = `
        margin: 0 0 20px 0;
        text-align: center;
        color: #333;
        font-family: Arial, sans-serif;
      `;
      
      // 创建裁剪后的Canvas预览
              const previewCanvas = document.createElement('canvas');
        previewCanvas.id = 'previewCanvas'; // 添加ID以便查找
        const previewCtx = previewCanvas.getContext('2d');
      
      // 设置预览Canvas尺寸（限制最大宽度为800px）
      const maxWidth = 800;
      const scale = Math.min(maxWidth / rect.width, 1);
      previewCanvas.width = rect.width * scale;
      previewCanvas.height = rect.height * scale;
      
      // 绘制裁剪区域到预览Canvas
      previewCtx.drawImage(
        canvas,
        rect.x, rect.y, rect.width, rect.height,  // 源图像裁剪区域
        0, 0, previewCanvas.width, previewCanvas.height  // 目标Canvas区域
      );
      
      // 🆕 新增：保存预览Canvas的基础状态（不包含任何编辑内容）
      previewCanvas.baseCanvasState = previewCtx.getImageData(0, 0, previewCanvas.width, previewCanvas.height);
      console.log('💾 预览Canvas基础状态已保存，大小:', previewCanvas.baseCanvasState.data.length);
      
      // 🆕 新增：添加编辑工具栏
      const editToolbar = document.createElement('div');
      editToolbar.style.cssText = `
        display: flex;
        gap: 8px;
        margin: 15px 0;
        padding: 10px;
        background: #f5f5f5;
        border-radius: 5px;
        justify-content: center;
        flex-wrap: wrap;
      `;
      
      // 矩形工具按钮
      const rectToolBtn = document.createElement('button');
      rectToolBtn.textContent = '⬜ 矩形';
      rectToolBtn.title = '绘制矩形框';
      rectToolBtn.style.cssText = `
        padding: 8px 12px;
        background: #2196F3;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        transition: background 0.2s;
      `;
      rectToolBtn.onmouseover = () => rectToolBtn.style.background = '#1976D2';
      rectToolBtn.onmouseout = () => rectToolBtn.style.background = '#2196F3';
              rectToolBtn.onclick = () => {
          // 如果当前工具已经是矩形工具，则取消激活
          if (currentActiveTool === 'rectangle') {
            deactivateCurrentTool();
            previewCanvas.style.cursor = 'default';
          } else {
            activateRectangleTool(previewCanvas, previewCtx);
          }
        };
      
      // 圆形工具按钮
      const circleToolBtn = document.createElement('button');
      circleToolBtn.textContent = '⭕ 圆形';
      circleToolBtn.title = '绘制圆形框';
      circleToolBtn.style.cssText = `
        padding: 8px 12px;
        background: #FF9800;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        transition: background 0.2s;
      `;
      circleToolBtn.onmouseover = () => circleToolBtn.style.background = '#F57C00';
      circleToolBtn.onmouseout = () => circleToolBtn.style.background = '#FF9800';
              circleToolBtn.onclick = () => {
          // 如果当前工具已经是圆形工具，则取消激活
          if (currentActiveTool === 'circle') {
            deactivateCurrentTool();
            previewCanvas.style.cursor = 'default';
          } else {
            activateCircleTool(previewCanvas, previewCtx);
          }
        };
      
      // 🆕 新增：箭头工具按钮
      const arrowToolBtn = document.createElement('button');
      arrowToolBtn.textContent = '➡️ 箭头';
      arrowToolBtn.title = '绘制箭头';
      arrowToolBtn.style.cssText = `
        padding: 8px 12px;
        background: #9C27B0;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        transition: background 0.2s;
      `;
      arrowToolBtn.onmouseover = () => arrowToolBtn.style.background = '#7B1FA2';
      arrowToolBtn.onmouseout = () => arrowToolBtn.style.background = '#9C27B0';
              arrowToolBtn.onclick = () => {
          // 如果当前工具已经是箭头工具，则取消激活
          if (currentActiveTool === 'arrow') {
            deactivateCurrentTool();
            previewCanvas.style.cursor = 'default';
          } else {
            activateArrowTool(previewCanvas, previewCtx);
          }
        };
      
              // 🆕 新增：画笔工具按钮
        const brushToolBtn = document.createElement('button');
        brushToolBtn.textContent = '✏️ 画笔';
        brushToolBtn.title = '自由绘制';
        brushToolBtn.style.cssText = `
          padding: 8px 12px;
          background: #4CAF50;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          transition: background 0.2s;
        `;
        brushToolBtn.onmouseover = () => brushToolBtn.style.background = '#388E3C';
        brushToolBtn.onmouseout = () => brushToolBtn.style.background = '#4CAF50';
        brushToolBtn.onclick = () => {
          // 如果当前工具已经是画笔工具，则取消激活
          if (currentActiveTool === 'brush') {
            deactivateCurrentTool();
            previewCanvas.style.cursor = 'default';
          } else {
            activateBrushTool(previewCanvas, previewCtx);
          }
        };
        
        // 🆕 新增：文字工具按钮
        const textToolBtn = document.createElement('button');
        textToolBtn.textContent = '📝 文字';
        textToolBtn.title = '添加文字标注（点击位置输入，点击已有文字删除）';
        textToolBtn.style.cssText = `
          padding: 8px 12px;
          background: #E91E63;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          transition: background 0.2s;
        `;
        textToolBtn.onmouseover = () => textToolBtn.style.background = '#C2185B';
        textToolBtn.onmouseout = () => textToolBtn.style.background = '#E91E63';
        textToolBtn.onclick = () => {
          // 如果当前工具已经是文字工具，则取消激活
          if (currentActiveTool === 'text') {
            deactivateCurrentTool();
            previewCanvas.style.cursor = 'default';
          } else {
            activateTextTool(previewCanvas, previewCtx);
          }
        };
        
        // 添加工具按钮到工具栏
        editToolbar.appendChild(rectToolBtn);
        editToolbar.appendChild(circleToolBtn);
        editToolbar.appendChild(arrowToolBtn);
        editToolbar.appendChild(brushToolBtn);
        editToolbar.appendChild(textToolBtn);
      
              // 🆕 新增：添加撤销按钮
        const undoButtonContainer = createUndoButton();
        if (undoButtonContainer) {
          editToolbar.appendChild(undoButtonContainer);
        }
      
      // 添加按钮容器
      const buttonContainer = document.createElement('div');
      buttonContainer.style.cssText = `
        display: flex;
        gap: 10px;
        margin-top: 20px;
        justify-content: center;
      `;
      
      // 下载按钮
      const downloadBtn = document.createElement('button');
      downloadBtn.textContent = '💾 下载PNG';
      downloadBtn.style.cssText = `
        padding: 10px 20px;
        background: #4CAF50;
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-size: 14px;
      `;
      downloadBtn.onclick = () => downloadScreenshot(previewCanvas, 'png', null);
      
      // 关闭按钮
      const closeBtn = document.createElement('button');
      closeBtn.textContent = '❌ 关闭';
      closeBtn.style.cssText = `
        padding: 10px 20px;
        background: #f44336;
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-size: 14px;
      `;
      closeBtn.onclick = () => {
        previewOverlay.remove();
      };
      
      // 组装界面
      buttonContainer.appendChild(downloadBtn);
      buttonContainer.appendChild(closeBtn);
      
      previewContainer.appendChild(title);
      
      // 🎨 新增：创建Canvas和调色板的水平布局容器
      const canvasPaletteContainer = document.createElement('div');
      canvasPaletteContainer.style.cssText = `
        display: flex;
        gap: 20px;
        align-items: flex-start;
        margin: 15px 0;
        justify-content: center;
      `;
      
      // 左侧：Canvas
      const canvasContainer = document.createElement('div');
      canvasContainer.style.cssText = `
        display: flex;
        justify-content: center;
        align-items: center;
        flex: 1;
      `;
      canvasContainer.appendChild(previewCanvas);
      
      // 右侧：调色板
      const colorPalette = createColorPalette();
      
      canvasPaletteContainer.appendChild(canvasContainer);
      canvasPaletteContainer.appendChild(colorPalette);
      
      previewContainer.appendChild(editToolbar);  // 🆕 新增：添加编辑工具栏
      previewContainer.appendChild(canvasPaletteContainer);
      previewContainer.appendChild(buttonContainer);
      
      previewOverlay.appendChild(previewContainer);
      document.body.appendChild(previewOverlay);
      
      console.log('✅ 截图预览界面显示完成');
      
    } catch (error) {
      console.error('❌ 显示截图预览界面失败:', error);
    }
  }
  
  // 🆕 新增：下载截图功能（支持区域裁剪）
  function downloadScreenshot(canvas, format, rect) {
    try {
      console.log('💾 开始下载截图...');
      
      // 创建裁剪后的Canvas
      const croppedCanvas = document.createElement('canvas');
      const croppedCtx = croppedCanvas.getContext('2d');
      
      if (rect) {
        // 如果有区域信息，进行裁剪
        croppedCanvas.width = rect.width;
        croppedCanvas.height = rect.height;
        
        // 绘制裁剪区域
        croppedCtx.drawImage(
          canvas,
          rect.x, rect.y, rect.width, rect.height,  // 源图像裁剪区域
          0, 0, rect.width, rect.height  // 目标Canvas区域
        );
        
        console.log('✅ 区域裁剪完成:', rect);
      } else {
        // 如果没有区域信息，使用原图
        croppedCanvas.width = canvas.width;
        croppedCanvas.height = canvas.height;
        croppedCtx.drawImage(canvas, 0, 0);
        console.log('✅ 使用原图下载');
      }
      
      // 根据格式处理Canvas
      let dataUrl;
      let filename;
      
      if (format === 'png') {
        dataUrl = croppedCanvas.toDataURL('image/png');
        filename = `screenshot_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`;
      } else {
        dataUrl = croppedCanvas.toDataURL('image/jpeg', 0.9);
        filename = `screenshot_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.jpg`;
      }
      
      // 创建下载链接
      const link = document.createElement('a');
      link.download = filename;
      link.href = dataUrl;
      
      // 触发下载
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log('✅ 截图下载完成:', filename);
      
    } catch (error) {
      console.error('❌ 截图下载失败:', error);
              alert(window.i18n ? window.i18n.t('content.alerts.downloadFailed', { error: error.message }) : 'Download failed: ' + error.message);
    }
  }
  
  // 🆕 新增：区域选择界面函数
  function showRegionSelectionUI() {
    try {
      console.log('🎯 显示区域选择界面...');
      
      // 创建区域选择覆盖层
      createRegionSelectionOverlay();
      
    } catch (error) {
      console.error('❌ 显示区域选择界面失败:', error);
      throw error;
    }
  }
  
  // 🆕 新增：创建区域选择覆盖层函数
  function createRegionSelectionOverlay() {
    try {
      console.log('🎯 创建区域选择覆盖层...');
      
      // 移除已存在的覆盖层
      const existingOverlay = document.getElementById('voiceCatchRegionOverlay');
      if (existingOverlay) {
        existingOverlay.remove();
      }
      
      // 创建覆盖层容器
      const overlay = document.createElement('div');
      overlay.id = 'voiceCatchRegionOverlay';
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.3);
        cursor: crosshair;
        user-select: none;
        z-index: 999998;
      `;
      
             // 添加提示文字
       const instruction = document.createElement('div');
       instruction.id = 'voiceCatchRegionInstruction'; // 🆕 修复：添加唯一ID
       instruction.style.cssText = `
         position: fixed;
         top: 20px;
         left: 50%;
         transform: translateX(-50%);
         background: rgba(0, 0, 0, 0.8);
         color: white;
         padding: 15px 25px;
         border-radius: 10px;
         font-family: Arial, sans-serif;
         font-size: 16px;
         z-index: 999999;
         text-align: center;
       `;
               instruction.textContent = window.i18n ? window.i18n.t('content.instructions.recordingAreaSelect') : '🎯 Drag to select the area to record';
      
      // 添加到页面
      document.body.appendChild(overlay);
      document.body.appendChild(instruction);
      
      console.log('✅ 区域选择覆盖层创建完成');
      
      // 🆕 新增：添加拖拽选择事件监听
      setupRegionSelectionEvents(overlay);
      
    } catch (error) {
      console.error('❌ 创建区域选择覆盖层失败:', error);
      throw error;
    }
  }
  
  // 🆕 新增：设置区域选择事件监听函数
  function setupRegionSelectionEvents(overlay) {
    try {
      console.log('🎯 设置区域选择事件监听...');
      
      // 鼠标按下事件
      overlay.addEventListener('mousedown', (e) => {
        console.log('🎯 鼠标按下，开始选择区域...');
        regionSelectionState.isSelecting = true;
        regionSelectionState.startX = e.clientX;
        regionSelectionState.startY = e.clientY;
        regionSelectionState.currentX = e.clientX;
        regionSelectionState.currentY = e.clientY;
        
        // 创建选择框
        createSelectionBox();
      });
      
      // 鼠标移动事件
      overlay.addEventListener('mousemove', (e) => {
        if (regionSelectionState.isSelecting) {
          regionSelectionState.currentX = e.clientX;
          regionSelectionState.currentY = e.clientY;
          updateSelectionBox();
        }
      });
      
      // 鼠标松开事件
      overlay.addEventListener('mouseup', (e) => {
        if (regionSelectionState.isSelecting) {
          console.log('🎯 鼠标松开，区域选择完成');
          regionSelectionState.isSelecting = false;
          
          // 计算选择的区域
          const region = calculateSelectedRegion();
          regionSelectionState.selectedRegion = region;
          
          console.log('🎯 选择的区域:', region);
          
          // 显示确认按钮
          showRegionConfirmation(region);
        }
      });
      
      // 键盘事件（Enter确认，Esc取消）
      document.addEventListener('keydown', handleRegionSelectionKeydown);
      
      console.log('✅ 区域选择事件监听设置完成');
      
    } catch (error) {
      console.error('❌ 设置区域选择事件监听失败:', error);
      throw error;
    }
  }
  
  // 🆕 新增：创建选择框函数
  function createSelectionBox() {
    try {
      console.log('🎯 创建选择框...');
      
      // 移除已存在的选择框
      const existingBox = document.getElementById('voiceCatchSelectionBox');
      if (existingBox) {
        existingBox.remove();
      }
      
             // 创建选择框
       const selectionBox = document.createElement('div');
       selectionBox.id = 'voiceCatchSelectionBox';
       selectionBox.style.cssText = `
         position: fixed;
         border: 2px dashed #00ff00;
         background: transparent;
         z-index: 999999;
         pointer-events: none;
       `;
      
      document.body.appendChild(selectionBox);
      console.log('✅ 选择框创建完成');
      
    } catch (error) {
      console.error('❌ 创建选择框失败:', error);
    }
  }
  
  // 🆕 新增：更新选择框函数
  function updateSelectionBox() {
    try {
      const selectionBox = document.getElementById('voiceCatchSelectionBox');
      if (!selectionBox) return;
      
      const left = Math.min(regionSelectionState.startX, regionSelectionState.currentX);
      const top = Math.min(regionSelectionState.startY, regionSelectionState.currentY);
      const width = Math.abs(regionSelectionState.currentX - regionSelectionState.startX);
      const height = Math.abs(regionSelectionState.currentY - regionSelectionState.startY);
      
      selectionBox.style.left = left + 'px';
      selectionBox.style.top = top + 'px';
      selectionBox.style.width = width + 'px';
      selectionBox.style.height = height + 'px';
      
    } catch (error) {
      console.error('❌ 更新选择框失败:', error);
    }
  }
  
  // 🆕 新增：计算选择区域函数
  function calculateSelectedRegion() {
    const left = Math.min(regionSelectionState.startX, regionSelectionState.currentX);
    const top = Math.min(regionSelectionState.startY, regionSelectionState.currentY);
    const width = Math.abs(regionSelectionState.currentX - regionSelectionState.startX);
    const height = Math.abs(regionSelectionState.currentY - regionSelectionState.startY);
    
    return { left, top, width, height };
  }
  
  // 🆕 新增：显示区域确认界面函数
  function showRegionConfirmation(region) {
    try {
      console.log('🎯 显示区域确认界面...');
      
      // 移除已存在的确认界面
      const existingConfirmation = document.getElementById('voiceCatchRegionConfirmation');
      if (existingConfirmation) {
        existingConfirmation.remove();
      }
      
      // 创建确认界面
      const confirmation = document.createElement('div');
      confirmation.id = 'voiceCatchRegionConfirmation';
      confirmation.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 25px;
        border-radius: 15px;
        font-family: Arial, sans-serif;
        font-size: 16px;
        z-index: 1000000;
        text-align: center;
        min-width: 300px;
      `;
      
      // 区域信息
      const regionInfo = document.createElement('div');
      regionInfo.style.cssText = `
        margin-bottom: 20px;
        padding: 15px;
        background: rgba(0, 255, 0, 0.1);
        border: 1px solid #00ff00;
        border-radius: 8px;
      `;
      regionInfo.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 10px;">${window.i18n ? window.i18n.t('content.ui.selectedArea') : '🎯 Selected Area:'}</div>
        <div>${window.i18n ? window.i18n.t('content.ui.position') : 'Position:'} (${region.left}, ${region.top})</div>
        <div>${window.i18n ? window.i18n.t('content.ui.size') : 'Size:'} ${region.width} × ${region.height}</div>
      `;
      
      // 按钮容器
      const buttonContainer = document.createElement('div');
      buttonContainer.style.cssText = `
        display: flex;
        gap: 15px;
        justify-content: center;
        margin-top: 20px;
      `;
      
      // 确认按钮
      const confirmButton = document.createElement('button');
      confirmButton.textContent = window.i18n ? window.i18n.t('content.ui.confirmAndStart') : '✅ Confirm and Start Recording';
      confirmButton.style.cssText = `
        padding: 12px 20px;
        border: none;
        border-radius: 8px;
        background: #00ff00;
        color: black;
        cursor: pointer;
        font-size: 14px;
        font-weight: bold;
      `;
      confirmButton.onclick = () => confirmRegionSelection(region);
      
      // 取消按钮
      const cancelButton = document.createElement('button');
      cancelButton.textContent = window.i18n ? window.i18n.t('content.ui.cancel') : '❌ Cancel';
      cancelButton.style.cssText = `
        padding: 12px 20px;
        border: none;
        border-radius: 8px;
        background: #ff3b30;
        color: white;
        cursor: pointer;
        font-size: 14px;
        font-weight: bold;
      `;
      cancelButton.onclick = () => cancelRegionSelection();
      
      // 组装界面
      buttonContainer.appendChild(confirmButton);
      buttonContainer.appendChild(cancelButton);
      
      confirmation.appendChild(regionInfo);
      confirmation.appendChild(buttonContainer);
      
      document.body.appendChild(confirmation);
      console.log('✅ 区域确认界面显示完成');
      
    } catch (error) {
      console.error('❌ 显示区域确认界面失败:', error);
    }
  }
  
     // 🆕 新增：确认区域选择函数
   function confirmRegionSelection(region) {
     try {
       console.log('🎯 确认区域选择，开始录制...');
       
       // 🆕 修复：保留取景框，只清理其他选择界面
       cleanupRegionSelectionUI(true); // 传入true表示保留取景框
       
       // 开始区域录制
       startRegionRecording(region);
       
     } catch (error) {
       console.error('❌ 确认区域选择失败:', error);
     }
   }
  
  // 🆕 新增：取消区域选择函数
  function cancelRegionSelection() {
    try {
      console.log('🎯 取消区域选择...');
      
      // 清理区域选择界面
      cleanupRegionSelectionUI();
      
    } catch (error) {
      console.error('❌ 取消区域选择失败:', error);
    }
  }
  
     // 🆕 新增：清理区域选择界面函数
   function cleanupRegionSelectionUI(keepSelectionBox = false) {
     try {
       console.log('🧹 清理区域选择界面...');
       
       // 移除覆盖层
       const overlay = document.getElementById('voiceCatchRegionOverlay');
       if (overlay) overlay.remove();
       
               // 🆕 修复：通过ID精确移除提示标签
        const instruction = document.getElementById('voiceCatchRegionInstruction');
        if (instruction) {
          instruction.remove();
          console.log('🧹 区域选择提示标签已清理');
        }
       
       // 🆕 修复：根据参数决定是否保留选择框
       if (!keepSelectionBox) {
         const selectionBox = document.getElementById('voiceCatchSelectionBox');
         if (selectionBox) selectionBox.remove();
       } else {
         console.log('🎯 保留选择框用于录制期间显示');
       }
       
       // 移除确认界面
       const confirmation = document.getElementById('voiceCatchRegionConfirmation');
       if (confirmation) confirmation.remove();
       
       // 移除键盘事件监听
       document.removeEventListener('keydown', handleRegionSelectionKeydown);
       
       console.log('✅ 区域选择界面清理完成');
       
     } catch (error) {
       console.error('❌ 清理区域选择界面失败:', error);
     }
   }
  
  // 🆕 新增：处理区域选择键盘事件函数
  function handleRegionSelectionKeydown(e) {
    if (e.key === 'Enter' && regionSelectionState.selectedRegion) {
      console.log('🎯 按Enter键确认区域选择');
      confirmRegionSelection(regionSelectionState.selectedRegion);
    } else if (e.key === 'Escape') {
      console.log('🎯 按Esc键取消区域选择');
      cancelRegionSelection();
    }
  }
  
  // 🆕 新增：开始区域录制函数
  async function startRegionRecording(region) {
    try {
      console.log('🎬 开始区域录制...');
      console.log('🎬 录制区域:', region);
      
      // 调用真正的录制函数，传递区域信息
      await startRecordingWithRegion(region);
      
    } catch (error) {
      console.error('❌ 开始区域录制失败:', error);
              alert(window.i18n ? window.i18n.t('content.alerts.areaRecordingFailed', { error: error.message }) : `Area recording failed: ${error.message}`);
    }
  }
  
  // 🆕 新增：带区域信息的录制函数
  // 🆕 新增：带区域信息的录制函数（Canvas实时剪裁版本）
  async function startRecordingWithRegion(region) {
    try {
      console.log('🎬 开始带区域信息的录制（Canvas实时剪裁版本）...');
      console.log('🎬 区域信息:', region);
      
      // 获取屏幕共享流
      console.log('🎬 准备调用getDisplayMedia（区域模式）...');
      
      try {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: { 
            displaySurface: 'tab',  // 使用标签页录制
            logicalSurface: true,
            width: { ideal: window.screen.width },  // 录制整个标签页
            height: { ideal: window.screen.height }
          },
          audio: true,
          preferCurrentTab: true,  // 优先当前标签
          selfBrowserSurface: 'include'  // 包含浏览器界面
        });
        
        console.log('✅ 区域录制流获取成功');
        console.log('🎬 流详情:', stream);
        
        // 检查流是否有效
        if (stream.active) {
          console.log('✅ 区域录制流处于活跃状态');
        } else {
          throw new Error('区域录制流未处于活跃状态');
        }
        
        // 🆕 使用Canvas实时剪裁录制类
        const realtimeCropRecorder = new RealtimeCropRecorder();
        
        // 开始Canvas实时剪裁录制
        const result = await realtimeCropRecorder.startRecording(region, stream);
        
        if (result.success) {
          console.log('✅ Canvas实时剪裁录制启动成功');
          
          // 保存录制器实例到全局变量，用于后续控制
          window.currentRealtimeCropRecorder = realtimeCropRecorder;
          
          // 🔄 保持原有的UI逻辑
          isRecording = true;
          recordingStartTime = Date.now();
          
          // 🆕 新增：初始化暂停时间变量
          window.totalPausedTime = 0;
          window.pauseStartTime = null;
          
          console.log('✅ 区域录制已开始，暂停时间变量已初始化');
          
          // 创建录制操作界面
          createRecordingControlUI();
          
          // 显示区域录制提示
          showRegionRecordingInfo(region);
          
          // 保存录制状态
          await chrome.storage.local.set({
            recordingStatus: 'active',
            startTime: Date.now(),
            mode: 'region_realtime_crop',
            region: region,
            sourceTabId: await getCurrentTabId()
          });
          
          console.log('✅ 录制状态已保存到存储');
          
        } else {
          throw new Error(result.message || 'Canvas实时剪裁录制启动失败');
        }
        
      } catch (getDisplayMediaError) {
        console.error('❌ 区域录制getDisplayMedia调用失败:', getDisplayMediaError);
        throw new Error(`区域录制失败: ${getDisplayMediaError.message}`);
      }
      
    } catch (error) {
      console.error('❌ 带区域信息的录制失败:', error);
      throw error;
    }
  }
  
     // 🆕 新增：视频区域裁剪函数
   async function cropVideoToRegion(videoBlob, region) {
     try {
       console.log('🎬 开始裁剪视频到指定区域...');
       console.log('🎬 裁剪区域:', region);
       
       // 创建视频元素
       const video = document.createElement('video');
       video.muted = true;
       video.playsInline = true;
       
       // 创建canvas用于裁剪
       const canvas = document.createElement('canvas');
       const ctx = canvas.getContext('2d');
       
       // 设置canvas尺寸为选择区域大小
       canvas.width = region.width;
       canvas.height = region.height;
       
       return new Promise((resolve, reject) => {
         // 视频加载完成后的处理
         video.onloadedmetadata = () => {
           try {
             console.log('🎬 视频元数据加载完成，开始裁剪...');
             
                           // 🆕 修复：创建包含音频的混合流
              const canvasStream = canvas.captureStream();
              
              // 从原始视频中提取音频轨道
              const audioTrack = video.captureStream().getAudioTracks()[0];
              
              // 创建混合流：视频来自canvas，音频来自原始视频
              const mixedStream = new MediaStream();
              mixedStream.addTrack(canvasStream.getVideoTracks()[0]);
              if (audioTrack) {
                mixedStream.addTrack(audioTrack);
                console.log('🎵 音频轨道已添加到混合流');
              } else {
                console.log('⚠️ 未找到音频轨道');
              }
              
              const mediaRecorder = new MediaRecorder(mixedStream, {
                mimeType: 'video/webm;codecs=vp9',
                videoBitsPerSecond: 5000000
              });
             
             const croppedChunks = [];
             
             mediaRecorder.ondataavailable = (event) => {
               if (event.data.size > 0) {
                 croppedChunks.push(event.data);
               }
             };
             
             mediaRecorder.onstop = () => {
               try {
                 const croppedBlob = new Blob(croppedChunks, { type: 'video/webm' });
                 console.log('✅ 视频裁剪完成，大小:', croppedBlob.size);
                 resolve(croppedBlob);
               } catch (error) {
                 console.error('❌ 创建裁剪视频Blob失败:', error);
                 reject(error);
               }
             };
             
                           // 开始录制裁剪后的视频
              mediaRecorder.start();
              
              // 🆕 修复：显示视频裁剪进度
              showVideoCroppingProgress();
              
              // 播放视频并逐帧绘制到canvas
              video.currentTime = 0;
              video.play();
             
             let frameCount = 0;
             const drawFrame = () => {
               if (video.ended || video.paused) {
                 mediaRecorder.stop();
                 return;
               }
               
               try {
                 // 在canvas上绘制裁剪区域
                 ctx.drawImage(
                   video,
                   region.left, region.top, region.width, region.height,  // 源图像裁剪区域
                   0, 0, region.width, region.height  // 目标canvas区域
                 );
                 
                 frameCount++;
                 
                 // 继续下一帧
                 requestAnimationFrame(drawFrame);
               } catch (error) {
                 console.error('❌ 绘制帧失败:', error);
                 mediaRecorder.stop();
               }
             };
             
             drawFrame();
             
           } catch (error) {
             console.error('❌ 视频裁剪处理失败:', error);
             reject(error);
           }
         };
         
         video.onerror = (error) => {
           console.error('❌ 视频加载失败:', error);
           reject(new Error('视频加载失败'));
         };
         
         // 设置视频源
         video.src = URL.createObjectURL(videoBlob);
       });
       
     } catch (error) {
       console.error('❌ 视频裁剪失败:', error);
       throw error;
     }
   }
   
   // 🆕 新增：显示区域录制信息函数
   function showRegionRecordingInfo(region) {
    try {
      console.log('🎬 显示区域录制信息...');
      
      // 创建区域录制信息显示
      const infoDisplay = document.createElement('div');
      infoDisplay.id = 'voiceCatchRegionInfo';
      infoDisplay.style.cssText = `
        position: fixed;
        top: 20px;
        left: 20px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 15px;
        border-radius: 10px;
        font-family: Arial, sans-serif;
        font-size: 14px;
        z-index: 1000000;
        border: 2px solid #00ff00;
      `;
      
      infoDisplay.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 10px;">${window.i18n ? window.i18n.t('content.ui.areaRecording') : '🎯 Area Recording in Progress'}</div>
        <div>${window.i18n ? window.i18n.t('content.ui.size') : 'Size:'} ${region.width} × ${region.height}</div>
        <div>${window.i18n ? window.i18n.t('content.ui.position') : 'Position:'} (${region.left}, ${region.top})</div>
      `;
      
      document.body.appendChild(infoDisplay);
      console.log('✅ 区域录制信息显示完成');
      
    } catch (error) {
      console.error('❌ 显示区域录制信息失败:', error);
    }
  }
  
     console.log('✅ ScreenCatch Content Script 已加载 - 使用Blob传输 + Service Worker统一存储 + 截图功能支持 + 区域选择支持 + 视频区域裁剪 + 标签录制倒计时');

  // 🆕 新增：缓存机制和错误处理函数
  
  // html2canvas缓存
  let html2canvasCache = null;
  
  // 预准备区域选择UI（并行执行）
  async function prepareAreaSelectionUI() {
    try {
      console.log('🔄 预准备区域选择UI...');
      
      // 预创建UI元素，但不显示
      const overlay = document.createElement('div');
      overlay.id = 'voiceCatchScreenshotOverlay';
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.3);
        z-index: 1000000;
        display: none;
      `;
      
      const selectionArea = document.createElement('div');
      selectionArea.id = 'voiceCatchSelectionArea';
      selectionArea.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 1000001;
        display: none;
        cursor: crosshair;
      `;
      
      // 添加到页面但隐藏
      document.body.appendChild(overlay);
      document.body.appendChild(selectionArea);
      
      console.log('✅ 区域选择UI预准备完成');
      return true;
      
    } catch (error) {
      console.error('❌ 预准备区域选择UI失败:', error);
      return false;
    }
  }
  
  // 获取html2canvas（优先使用缓存）
  async function getHtml2Canvas() {
    try {
      // 1. 检查缓存
      if (html2canvasCache) {
        console.log('✅ 使用缓存的html2canvas');
        return html2canvasCache;
      }
      
      // 2. 检查是否已预加载
      if (typeof html2canvas !== 'undefined' && typeof html2canvas === 'function') {
        console.log('✅ 使用预加载的html2canvas');
        html2canvasCache = html2canvas;
        return html2canvasCache;
      }
      
      // 3. 如果没有预加载，通过Service Worker注入
      console.log('🔄 html2canvas未预加载，通过Service Worker注入...');
      const response = await chrome.runtime.sendMessage({ action: 'injectHtml2Canvas' });
      
      if (response && response.success) {
        // 等待html2canvas可用
        await waitForHtml2Canvas();
        html2canvasCache = html2canvas;
        console.log('✅ html2canvas注入成功，已缓存');
        return html2canvasCache;
      } else {
        throw new Error(response?.error || 'html2canvas注入失败');
      }
      
    } catch (error) {
      console.error('❌ 获取html2canvas失败:', error);
      throw error;
    }
  }
  
  // 等待html2canvas可用
  async function waitForHtml2Canvas(timeout = 2000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (typeof html2canvas !== 'undefined' && typeof html2canvas === 'function') {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    throw new Error('等待html2canvas超时');
  }
  
  // 显示错误信息
  function showError(message) {
    try {
      console.error('❌ 显示错误信息:', message);
      
      // 创建错误提示
      const errorDisplay = document.createElement('div');
      errorDisplay.id = 'voiceCatchErrorDisplay';
      errorDisplay.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(255, 0, 0, 0.9);
        color: white;
        padding: 20px;
        border-radius: 10px;
        font-family: Arial, sans-serif;
        font-size: 16px;
        z-index: 1000002;
        text-align: center;
        max-width: 400px;
      `;
      
      errorDisplay.innerHTML = `
        <div style="font-size: 24px; margin-bottom: 10px;">❌</div>
        <div>${message}</div>
        <button onclick="this.parentElement.remove()" style="margin-top: 15px; padding: 8px 16px; border: none; border-radius: 5px; background: white; color: red; cursor: pointer;">${window.i18n ? window.i18n.t('content.ui.confirm') : 'Confirm'}</button>
      `;
      
      document.body.appendChild(errorDisplay);
      
      // 3秒后自动隐藏
      setTimeout(() => {
        if (errorDisplay.parentElement) {
          errorDisplay.remove();
        }
      }, 3000);
      
    } catch (error) {
      console.error('❌ 显示错误信息失败:', error);
      alert(message); // 降级到alert
    }
  }

  // 🆕 修复：箭头工具激活函数 - 重新设计架构
  function activateArrowTool(canvas, ctx) {
    try {
      console.log('➡️ 激活箭头工具...');
      
      // 🆕 新增：设置工具状态
      currentActiveTool = 'arrow';
      console.log('🔧 当前激活工具:', currentActiveTool);
      
      // 🆕 新增：设置统一事件处理器
      setupUnifiedEventHandler(canvas);
      
      // 🆕 关键修复：在工具激活时获取最新的Canvas状态（包含所有已绘制的内容）
      const baseCanvasState = ctx.getImageData(0, 0, canvas.width, canvas.height);
      console.log('🔍 箭头工具激活时保存基础Canvas状态，大小:', baseCanvasState.data.length);
      
      // 设置Canvas样式
      canvas.style.cursor = 'crosshair';
      
      // 🆕 新增：保存Canvas状态供事件处理器使用
      canvas.arrowBaseState = baseCanvasState;
      canvas.arrowCtx = ctx;
      
      console.log('✅ 箭头工具已激活，等待用户操作');
      
    } catch (error) {
      console.error('❌ 激活箭头工具失败:', error);
      showError('箭头工具激活失败: ' + error.message);
    }
  }
  
  // 🆕 新增：绘制箭头函数
  function drawArrow(ctx, startX, startY, endX, endY) {
    try {
      // 设置箭头样式
      ctx.strokeStyle = getColorWithOpacity(globalColorState.primary);
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      
      // 绘制箭头线
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
      
      // 计算箭头角度
      const angle = Math.atan2(endY - startY, endX - startX);
      
      // 绘制箭头头部
      const arrowLength = 15;
      const arrowAngle = Math.PI / 6; // 30度
      
      // 左箭头线
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(
        endX - arrowLength * Math.cos(angle - arrowAngle),
        endY - arrowLength * Math.sin(angle - arrowAngle)
      );
      ctx.stroke();
      
      // 右箭头线
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(
        endX - arrowLength * Math.cos(angle + arrowAngle),
        endY - arrowLength * Math.sin(angle + arrowAngle)
      );
      ctx.stroke();
      
    } catch (error) {
      console.error('❌ 绘制箭头失败:', error);
    }
  }

  // 🆕 修复：画笔工具激活函数 - 重新设计架构
  function activateBrushTool(canvas, ctx) {
    try {
      console.log('✏️ 激活画笔工具...');
      
      // 🆕 新增：设置工具状态
      currentActiveTool = 'brush';
      console.log('🔧 当前激活工具:', currentActiveTool);
      
      // 🆕 新增：设置统一事件处理器
      setupUnifiedEventHandler(canvas);
      
      // 🆕 关键修复：在工具激活时获取最新的Canvas状态（包含所有已绘制的内容）
      let currentCanvasState = ctx.getImageData(0, 0, canvas.width, canvas.height);
      console.log('🔍 画笔工具激活时保存初始Canvas状态，大小:', currentCanvasState.data.length);
      
      // 标记画笔工具已激活
      canvas.brushToolActive = true;
      
      // 设置Canvas样式
      canvas.style.cursor = 'crosshair';
      
      // 🆕 新增：保存Canvas状态供事件处理器使用
      canvas.brushBaseState = currentCanvasState;
      canvas.brushCtx = ctx;
      
      console.log('✅ 画笔工具已激活，等待用户操作');
      
    } catch (error) {
      console.error('❌ 激活画笔工具失败:', error);
      showError('画笔工具激活失败: ' + error.message);
    }
  }
  
  // 🆕 新增：取消激活画笔工具
  function deactivateBrushTool(canvas, ctx) {
    try {
      console.log('✏️ 取消激活画笔工具...');
      
      // 移除标记
      canvas.brushToolActive = false;
      
      // 恢复默认光标
      canvas.style.cursor = 'default';
      
      // 移除事件监听器
      canvas.onmousedown = null;
      canvas.onmousemove = null;
      canvas.onmouseup = null;
      
      // 🆕 新增：重置工具状态
      currentActiveTool = null;
      console.log('🔧 画笔工具已取消激活，工具状态已重置');
      
    } catch (error) {
      console.error('❌ 取消激活画笔工具失败:', error);
    }
  }

  // 🆕 新增：矩形工具激活函数
  function activateRectangleTool(canvas, ctx) {
    try {
      console.log('⬜ 激活矩形工具...');
      
      // 🆕 新增：设置工具状态
      currentActiveTool = 'rectangle';
      console.log('🔧 当前激活工具:', currentActiveTool);
      
      // 🆕 新增：设置统一事件处理器
      setupUnifiedEventHandler(canvas);
      
      // 🆕 关键修复：在工具激活时获取最新的Canvas状态（包含所有已绘制的内容）
      const baseCanvasState = ctx.getImageData(0, 0, canvas.width, canvas.height);
      console.log('🔍 矩形工具激活时保存基础Canvas状态，大小:', baseCanvasState.data.length);
      
      // 设置Canvas样式
      canvas.style.cursor = 'crosshair';
      
      // 🆕 新增：保存Canvas状态供事件处理器使用
      canvas.rectangleBaseState = baseCanvasState;
      canvas.rectangleCtx = ctx;
      

      
    } catch (error) {
      console.error('❌ 激活矩形工具失败:', error);
      showError('矩形工具激活失败: ' + error.message);
    }
  }

  // 🆕 新增：圆形工具激活函数
  function activateCircleTool(canvas, ctx) {
    try {
      console.log('⭕ 激活圆形工具...');
      
      // 🆕 新增：设置工具状态
      currentActiveTool = 'circle';
      console.log('🔧 当前激活工具:', currentActiveTool);
      
      // 🆕 新增：设置统一事件处理器
      setupUnifiedEventHandler(canvas);
      
      // 🆕 关键修复：在工具激活时获取最新的Canvas状态（包含所有已绘制的内容）
      const baseCanvasState = ctx.getImageData(0, 0, canvas.width, canvas.height);
      console.log('🔍 圆形工具激活时保存基础Canvas状态，大小:', baseCanvasState.data.length);
      
      // 设置Canvas样式
      canvas.style.cursor = 'crosshair';
      
      // 🆕 新增：保存Canvas状态供事件处理器使用
      canvas.circleBaseState = baseCanvasState;
      canvas.circleCtx = ctx;
      
      console.log('✅ 圆形工具已激活，等待用户操作');
      
    } catch (error) {
      console.error('❌ 激活圆形工具失败:', error);
      showError('圆形工具激活失败: ' + error.message);
    }
  }

  // 🆕 新增：撤销系统核心函数
  
  // 🆕 修复：添加编辑操作到历史 - 重新设计架构
  function addEditOperation(operation) {
    try {
      // 🆕 新增：严格检查操作类型，确保文字操作不被记录
      if (operation.type === 'text') {
        console.log('⚠️ 阻止文字操作被添加到撤销历史:', operation);
        return; // 文字操作不参与撤销系统
      }
      
      // 🆕 新增：检查操作数据完整性
      if (!operation || !operation.type || !operation.canvas || !operation.prevState) {
        console.error('❌ 操作数据不完整，跳过添加:', operation);
        return;
      }
      
      // 添加新操作到历史末尾
      editHistory.push(operation);
      
      // 限制历史记录数量
      if (editHistory.length > MAX_EDIT_HISTORY) {
        editHistory.shift();
      }
      
      console.log('✅ 编辑操作已添加到历史，当前历史数量:', editHistory.length);
      console.log('🔍 操作详情:', {
        type: operation.type,
        canvas: operation.canvas ? '有效' : '无效',
        prevState: operation.prevState ? '有效' : '无效',
        data: operation.data
      });
      
      // 🆕 新增：显示调用栈，帮助调试
      console.log('🔍 调用栈:', new Error().stack);
      
      updateUndoButton();
      
    } catch (error) {
      console.error('❌ 添加编辑操作失败:', error);
    }
  }
  
  // 🆕 修复：撤销操作 - 重新设计架构
  function undoLastOperation() {
    try {
      console.log('🔄 开始撤销操作...');
      console.log('🔍 当前编辑历史数量:', editHistory.length);
      
      if (editHistory.length > 0) {
        // 获取并移除最后一个操作
        const lastOperation = editHistory.pop();
        console.log('↶ 撤销操作:', lastOperation.type);
        console.log('🔍 操作详情:', lastOperation);
        
        // 验证操作数据完整性
        if (!lastOperation || !lastOperation.prevState || !lastOperation.canvas) {
          console.error('❌ 操作数据不完整，跳过撤销:', lastOperation);
          return;
        }
        
        // 获取Canvas和Context
        const canvas = lastOperation.canvas;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          console.error('❌ 无法获取Canvas上下文');
          return;
        }
        
        // 修改：撤销按钮只处理图形元素，不处理文字（方案A）
        if (lastOperation.type === 'text') {
          console.log('⚠️ 撤销按钮不处理文字操作，文字只能通过删除功能移除');
          return;
        } else {
          // 图形操作，直接恢复到操作前状态
          ctx.putImageData(lastOperation.prevState, 0, 0);
          console.log('✅ 图形操作已撤销，Canvas已恢复到操作前状态');
          
          // 🆕 关键修复：撤销图形操作后，重新绘制所有文字
          // 确保文字不会因为图形撤销而丢失
          if (globalTextObjects && globalTextObjects.length > 0) {
            console.log('🔄 重新绘制所有文字，数量:', globalTextObjects.length);
            globalTextObjects.forEach((textObj, index) => {
              ctx.font = '16px Arial';
              ctx.fillStyle = textObj.color;
              ctx.strokeStyle = textObj.strokeColor;
              ctx.lineWidth = 2;
              ctx.strokeText(textObj.text, textObj.x, textObj.y);
              ctx.fillText(textObj.text, textObj.x, textObj.y);
              console.log(`✅ 重新绘制文字 [${index}]:`, textObj.text);
            });
            console.log('✅ 所有文字已重新绘制');
          }
        }
        
        // 更新撤销按钮状态
        updateUndoButton();
        
      } else {
        console.log('⚠️ 没有可撤销的操作');
      }
      
    } catch (error) {
      console.error('❌ 撤销操作失败:', error);
      showError('撤销操作失败: ' + error.message);
    }
  }
  
  // 方案A：删除不再需要的重新绘制函数
  
  // 🆕 删除：不再需要的重新绘制函数
  // 新的撤销系统直接恢复到操作前状态，无需重新绘制
  
  // 🆕 修改：文字工具激活函数 - 采用"写入即固定"策略
  function activateTextTool(canvas, ctx) {
    try {
      console.log('📝 激活文字工具...');
      
      // 🆕 新增：设置工具状态
      currentActiveTool = 'text';
      console.log('🔧 当前激活工具:', currentActiveTool);
      
      // 🆕 新增：设置统一事件处理器
      setupUnifiedEventHandler(canvas);
      
      // 设置Canvas样式
      canvas.style.cursor = 'text';
      
      // 创建文字输入框
      const textInput = document.createElement('input');
      textInput.type = 'text';
      textInput.placeholder = window.i18n ? window.i18n.t('content.ui.textInputPlaceholder') : 'Enter text...';
      textInput.style.cssText = `
        position: absolute;
        border: 2px solid #E91E63;
        border-radius: 4px;
        padding: 8px 12px;
        font-size: 16px;
        font-family: Arial, sans-serif;
        background: rgba(255, 255, 255, 0.95);
        color: #333;
        outline: none;
        z-index: 1000004;
        min-width: 100px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      `;
      
      // 创建颜色选择器
      const colorSelector = document.createElement('div');
      colorSelector.style.cssText = `
        position: absolute;
        top: 10px;
        right: 10px;
        background: rgba(255, 255, 255, 0.95);
        border: 1px solid #ccc;
        border-radius: 4px;
        padding: 8px;
        z-index: 1000005;
        display: none;
      `;
      
      // 预定义颜色选项
      const colors = [
        { name: '红色', value: '#E91E63', stroke: '#FFFFFF' },
        { name: '蓝色', value: '#2196F3', stroke: '#FFFFFF' },
        { name: '绿色', value: '#4CAF50', stroke: '#FFFFFF' },
        { name: '橙色', value: '#FF9800', stroke: '#FFFFFF' },
        { name: '紫色', value: '#9C27B0', stroke: '#FFFFFF' },
        { name: '黑色', value: '#000000', stroke: '#FFFFFF' }
      ];
      
      let selectedColor = colors[0]; // 默认红色
      
      colors.forEach(color => {
        const colorBtn = document.createElement('button');
        colorBtn.style.cssText = `
          width: 20px;
          height: 20px;
          background: ${color.value};
          border: 2px solid ${color === selectedColor ? '#333' : '#ccc'};
          border-radius: 50%;
          margin: 2px;
          cursor: pointer;
          outline: none;
        `;
        colorBtn.title = color.name;
        colorBtn.onclick = () => {
          selectedColor = color;
          // 更新所有按钮的边框
          colorSelector.querySelectorAll('button').forEach((btn, index) => {
            btn.style.borderColor = colors[index] === selectedColor ? '#333' : '#ccc';
          });
          console.log('🎨 选择颜色:', color.name, color.value);
        };
        colorSelector.appendChild(colorBtn);
      });
      
      // 添加到页面
      document.body.appendChild(textInput);
      document.body.appendChild(colorSelector);
      
      // 文字工具状态
      let isTextActive = false;
      let textX, textY;
      
      // 🆕 修复：使用更简单的事件处理逻辑
      let textClickHandler = null;
      
      // 修改：根据当前工具状态处理Canvas点击事件（完全隔离版本）
      function setupTextClickHandler() {
        try {
          // 先移除可能存在的旧事件处理器
          if (textClickHandler) {
            canvas.removeEventListener('click', textClickHandler);
          }
          
          textClickHandler = function(e) {
            try {
              console.log('🔍 Canvas点击事件，当前工具:', currentActiveTool);
              
              // 只有文字工具激活时才处理点击
              if (currentActiveTool !== 'text') {
                console.log('⚠️ 非文字工具激活，忽略点击');
                return;
              }
              
              // 🆕 修复：使用UI状态判断，而不是未定义的isTextActive
              if (textInput.style.display === 'block') {
                console.log('⚠️ 文字工具已激活，忽略点击');
                return;
              }
              
              const rect = canvas.getBoundingClientRect();
              const clickX = e.clientX - rect.left;
              const clickY = e.clientY - rect.top;
              
              // 检查是否点击在已存在的文字上（用于删除）
              const clickedText = findTextAtPosition(clickX, clickY);
              if (clickedText) {
                console.log('📝 点击到已存在的文字，显示删除选项');
                showTextDeleteOptions(clickedText, e.clientX, e.clientY);
                return;
              }
              
              // 新建文字模式
              textX = clickX;
              textY = clickY;
              
              // 定位输入框
              textInput.style.left = e.clientX + 'px';
              textInput.style.top = e.clientY + 'px';
              
              // 显示输入框和颜色选择器并聚焦
              textInput.style.display = 'block';
              colorSelector.style.display = 'block';
              textInput.focus();
              // 🆕 修复：不再设置isTextActive，因为我们现在通过UI状态判断
              console.log('📝 文字输入框已激活');
              
              console.log('📝 文字工具已激活，位置:', textX, textY);
            } catch (error) {
              console.error('❌ 文字点击事件处理失败:', error);
            }
          };
          
          // 绑定新的事件处理器
          canvas.addEventListener('click', textClickHandler);
          console.log('✅ 文字点击事件处理器已绑定');
        } catch (error) {
          console.error('❌ 设置文字点击事件处理器失败:', error);
        }
      }
      
      // 🆕 修复：延迟设置事件处理器，确保canvas变量可用
      setTimeout(() => {
        setupTextClickHandler();
      }, 100);
      
      // 🆕 优化：输入框事件处理 - 添加实时预览
      textInput.onkeydown = function(e) {
        if (e.key === 'Enter') {
          addTextToCanvas();
        } else if (e.key === 'Escape') {
          cancelTextInput();
        }
      };
      
      textInput.onblur = function() {
        // 失去焦点时自动添加文字
        if (textInput.value.trim()) {
          addTextToCanvas();
        } else {
          cancelTextInput();
        }
      };
      
      // 🆕 新增：实时预览功能（完全隔离版本）
      textInput.oninput = function() {
        // 🆕 关键修复：不干扰Canvas状态，只处理预览
        const previewText = textInput.value.trim();
        if (previewText) {
          console.log('📝 文字预览:', previewText);
          // 暂时不实现实时预览，避免干扰Canvas状态
          // 用户输入完成后直接添加文字即可
        }
      };
      

      

      
      // 取消文字输入
      function cancelTextInput() {
        textInput.style.display = 'none';
        colorSelector.style.display = 'none';
        textInput.value = '';
        // 🆕 修复：不再设置isTextActive，因为我们现在通过UI状态判断
        console.log('📝 文字输入已取消');
        
        // 🆕 修复：不再移除事件监听器，因为现在使用addEventListener
        // canvas.onclick = null;  // 删除这行
        canvas.style.cursor = 'default';
        
        // 🆕 新增：重置工具状态
        currentActiveTool = null;
        console.log('📝 文字工具已取消，工具状态已重置');
        
        // 🆕 新增：移除文字点击事件处理器，避免干扰其他工具
        if (textClickHandler) {
          canvas.removeEventListener('click', textClickHandler);
          textClickHandler = null;
          console.log('✅ 文字点击事件处理器已移除');
        }
      }
      
      // 🆕 重构：查找点击位置的文字（方案A） - 已移动到全局作用域
      
      // 修改：显示文字删除选项（方案A） - 已移动到全局作用域
      
      // 新增：删除文字函数（完全隔离版本） - 已移动到全局作用域
      

      
      // 方案A：删除重复的函数定义
      

      
      // 修改：简化添加文字到Canvas函数（完全隔离版本）
      function addTextToCanvas() {
        const text = textInput.value.trim();
        if (!text) {
          cancelTextInput();
          return;
        }
        
        console.log('📝 添加文字:', text, '位置:', textX, textY);
        
        // 创建新的文字对象
        const textObj = {
          text: text,
          x: textX,
          y: textY,
          color: getColorWithOpacity(globalColorState.primary),
          strokeColor: getColorWithOpacity(globalColorState.secondary),
          width: 0, // 临时设置，稍后计算
          height: 20,
          id: Date.now() + Math.random() // 唯一ID
        };
        
        // 添加到全局文字对象数组
        globalTextObjects.push(textObj);
        
        // 🆕 关键修复：使用正确的Canvas上下文绘制文字
        // 获取预览Canvas，而不是使用传入的ctx
        const previewCanvas = document.querySelector('#previewCanvas');
        if (previewCanvas) {
          const previewCtx = previewCanvas.getContext('2d');
          // 绘制文字到正确的Canvas
          previewCtx.font = '16px Arial';
          previewCtx.fillStyle = textObj.color;
          previewCtx.strokeStyle = textObj.strokeColor;
          previewCtx.lineWidth = 2;
          previewCtx.strokeText(text, textX, textY);
          previewCtx.fillText(text, textX, textY);
          
          // 🆕 关键修复：计算文字的实际宽度
          textObj.width = previewCtx.measureText(text).width;
          console.log('✅ 文字已绘制到预览Canvas，宽度:', textObj.width);
          
          // 🆕 关键修复：文字绘制完成后，统一更新所有工具的Canvas基础状态
          updateAllToolBaseStates(previewCanvas);
          console.log('✅ 所有工具的Canvas基础状态已更新，包含新添加的文字');
          
          // 🆕 调试：验证状态更新是否成功
          console.log('🔍 验证状态更新结果:');
          console.log('  - 矩形工具baseState:', previewCanvas.rectangleBaseState ? '已设置' : '未设置');
          console.log('  - 圆形工具baseState:', previewCanvas.circleBaseState ? '已设置' : '未设置');
          console.log('  - 箭头工具baseState:', previewCanvas.arrowBaseState ? '已设置' : '未设置');
          console.log('  - 画笔工具baseState:', previewCanvas.brushBaseState ? '已设置' : '未设置');
        } else {
          console.error('❌ 未找到预览Canvas，无法绘制文字');
        }
        
        console.log('📝 新文字已添加:', textObj);
        console.log('📝 当前文字对象总数:', globalTextObjects.length);
        
        // 清理输入状态
        cancelTextInput();
      }
      

      
      // 绑定输入框事件
      textInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          addTextToCanvas();
        } else if (e.key === 'Escape') {
          cancelTextInput();
        }
      });
      
      // 绑定输入框输入事件（完全隔离版本）
      textInput.addEventListener('input', function() {
        // 🆕 关键修复：不干扰Canvas状态，只处理预览
        const previewText = textInput.value.trim();
        if (previewText) {
          console.log('📝 文字预览:', previewText);
          // 暂时不实现实时预览，避免干扰Canvas状态
          // 用户输入完成后直接添加文字即可
        }
      });
      
      // 🆕 修复：文字工具不需要保存Canvas状态，因为文字不参与撤销系统
      
      // 方案A：删除不再需要的编辑相关函数
      
    } catch (error) {
      console.error('❌ 激活文字工具失败:', error);
      showError('文字工具激活失败: ' + error.message);
    }
  }
  
  // 🆕 修复：更新撤销按钮状态 - 重新设计架构
  function updateUndoButton() {
    try {
      const undoBtn = document.querySelector('#voiceCatchUndoBtn');
      if (undoBtn) {
        const canUndo = editHistory.length > 0;
        undoBtn.disabled = !canUndo;
        undoBtn.textContent = canUndo ? `↶ 撤销图形 (${editHistory.length})` : '↶ 撤销图形';
        undoBtn.style.opacity = canUndo ? '1' : '0.5';
        
        // 🆕 新增：显示详细的撤销状态信息
        console.log('🔍 撤销按钮状态更新:', {
          historyLength: editHistory.length,
          canUndo,
          remainingUndos: editHistory.length
        });
      }
    } catch (error) {
      console.error('❌ 更新撤销按钮状态失败:', error);
    }
  }
  
  // 创建撤销按钮
  function createUndoButton() {
    try {
      const undoBtn = document.createElement('button');
      undoBtn.id = 'voiceCatchUndoBtn';
      undoBtn.textContent = '↶ 撤销';
              undoBtn.title = '撤销上一步图形操作（矩形、圆形、箭头、画笔）';
      undoBtn.style.cssText = `
        padding: 8px 12px;
        background: #FF5722;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        transition: all 0.2s;
        opacity: 0.5;
      `;
      undoBtn.onclick = undoLastOperation;
      undoBtn.disabled = true;
      
      // 调试按钮已删除，保持界面简洁
      
      // 创建按钮容器
      const buttonContainer = document.createElement('div');
      buttonContainer.style.cssText = 'display: flex; gap: 8px;';
      buttonContainer.appendChild(undoBtn);
      
      return buttonContainer;
      
    } catch (error) {
      console.error('❌ 创建撤销按钮失败:', error);
      return null;
    }
  }
  
  // 🆕 新增：调试撤销系统状态
  // 调试函数已删除，保持代码简洁
  
  // 🆕 新增：工具状态管理
  let currentActiveTool = null; // 当前激活的工具：'text', 'rectangle', 'circle', 'arrow', 'brush', null
  
  // 🆕 新增：统一事件管理系统
  let unifiedEventHandler = null; // 统一事件处理器
  let currentCanvas = null; // 当前Canvas引用
  
  // 🆕 新增：统一的Canvas状态更新函数
  function updateAllToolBaseStates(canvas) {
    try {
      console.log('🔄 更新所有工具的Canvas基础状态...');
      
      // 获取当前Canvas的最新状态（包含所有已绘制的内容）
      const currentState = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
      
      // 🆕 关键修复：强制初始化所有工具的baseState，确保状态同步
      canvas.rectangleBaseState = currentState;
      canvas.circleBaseState = currentState;
      canvas.arrowBaseState = currentState;
      canvas.brushBaseState = currentState;
      
      console.log('✅ 所有工具的基础状态已强制更新，包含最新内容');
      
    } catch (error) {
      console.error('❌ 更新工具基础状态失败:', error);
    }
  }
  
  // 🆕 新增：全局文本对象数组（方案A重构）
  let globalTextObjects = [];
  
  // 调试函数已删除，保持代码简洁
  
  // 调试函数已删除，保持代码简洁
  
  // 🆕 新增：全局文字查找函数（从activateTextTool中提升）
  function findTextAtPosition(x, y) {
    console.log('🔍 查找文字位置:', x, y);
    console.log('🔍 全局文字对象数组:', globalTextObjects);
    console.log('🔍 全局文字对象数量:', globalTextObjects.length);
    
    // 🆕 新增：检查文字对象数组是否有效
    if (!globalTextObjects || !Array.isArray(globalTextObjects)) {
      console.error('❌ 全局文字对象数组无效:', globalTextObjects);
      return null;
    }
    
    if (globalTextObjects.length === 0) {
      console.log('📝 没有文字对象需要检测');
      return null;
    }
    
    for (let i = globalTextObjects.length - 1; i >= 0; i--) {
      const textObj = globalTextObjects[i];
      console.log(`🔍 检查文字对象 [${i}]:`, textObj);
      
      // 🆕 新增：验证文字对象数据完整性
      if (!textObj || typeof textObj.x !== 'number' || typeof textObj.y !== 'number' || typeof textObj.width !== 'number' || typeof textObj.height !== 'number') {
        console.warn(`⚠️ 文字对象 [${i}] 数据不完整:`, textObj);
        continue;
      }
      
      // 计算文字的边界
      const left = textObj.x;
      const right = textObj.x + textObj.width;
      const top = textObj.y - textObj.height;
      const bottom = textObj.y;
      
      console.log(`🔍 文字边界: 左=${left}, 右=${right}, 上=${top}, 下=${bottom}`);
      console.log(`🔍 点击位置: x=${x}, y=${y}`);
      console.log(`🔍 边界判断: x>=${left}(${x >= left}), x<=${right}(${x <= right}), y>=${top}(${y >= top}), y<=${bottom}(${y <= bottom})`);
      
      if (x >= left && x <= right && y >= top && y <= bottom) {
        console.log('✅ 找到点击的文字:', textObj.text);
        return textObj;
      }
    }
    
    console.log('❌ 未找到点击的文字');
    return null;
  }
  
  // 🆕 新增：全局文字删除选项显示函数（从activateTextTool中提升）
  function showTextDeleteOptions(textObj, clientX, clientY) {
    console.log('📝 显示文字删除选项:', textObj.text);
    
    // 先移除可能存在的旧弹窗
    const existingDialog = document.querySelector('#voiceCatchDeleteDialog');
    if (existingDialog) {
      existingDialog.remove();
    }
    
    // 创建删除确认弹窗
    const deleteDialog = document.createElement('div');
    deleteDialog.id = 'voiceCatchDeleteDialog';
    deleteDialog.style.cssText = `
      position: fixed;
      top: ${clientY}px;
      left: ${clientX}px;
      background: rgba(255, 255, 255, 0.95);
      border: 2px solid #f44336;
      border-radius: 8px;
      padding: 15px;
      z-index: 1000003;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      font-family: Arial, sans-serif;
      min-width: 200px;
    `;
    
    deleteDialog.innerHTML = `
      <div style="margin-bottom: 10px; font-weight: bold; color: #333;">
        ${window.i18n ? window.i18n.t('content.ui.deleteTextTitle').replace('{text}', textObj.text) : `📝 Delete Text: "${textObj.text}"`}
      </div>
      <div style="display: flex; gap: 10px;">
        <button id="confirmDelete" style="
          padding: 8px 16px;
          background: #f44336;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        ">${window.i18n ? window.i18n.t('content.ui.deleteText') : '🗑️ Delete'}</button>
        <button id="cancelDelete" style="
          padding: 8px 16px;
          background: #9e9e9e;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        ">${window.i18n ? window.i18n.t('content.ui.cancel') : '❌ Cancel'}</button>
      </div>
    `;
    
    // 添加到页面
    document.body.appendChild(deleteDialog);
    
    // 绑定删除确认事件（使用事件委托）
    deleteDialog.addEventListener('click', (e) => {
      console.log('🔍 删除弹窗点击事件触发，目标ID:', e.target.id);
      if (e.target.id === 'confirmDelete') {
        console.log('🗑️ 用户确认删除文字:', textObj.text);
        console.log('🔍 开始执行删除函数...');
        deleteTextFromCanvas(textObj);
        deleteDialog.remove();
        console.log('✅ 删除弹窗已移除');
      } else if (e.target.id === 'cancelDelete') {
        console.log('❌ 用户取消删除文字');
        deleteDialog.remove();
      }
    });
    
    // 3秒后自动关闭
    setTimeout(() => {
      if (deleteDialog.parentNode) {
        console.log('⏰ 删除弹窗自动关闭');
        deleteDialog.remove();
      }
    }, 3000);
    
    console.log('✅ 删除弹窗已显示');
  }
  
  // 🆕 新增：全局文字删除函数（从activateTextTool中提升）
  function deleteTextFromCanvas(textObj) {
    try {
      console.log('🗑️ 开始删除文字:', textObj.text);
      
      // 从全局数组中移除
      const index = globalTextObjects.findIndex(obj => obj.id === textObj.id);
      if (index !== -1) {
        globalTextObjects.splice(index, 1);
        console.log('🗑️ 文字已从数组中移除，索引:', index);
      }
      
      // 🆕 关键修复：不重新绘制整个Canvas，只清除被删除的文字区域
      // 这样可以保持图形内容不变
      const previewCanvas = document.querySelector('#previewCanvas');
      if (previewCanvas) {
        const previewCtx = previewCanvas.getContext('2d');
        
        // 计算文字区域，清除该区域
        const clearX = textObj.x - 2;
        const clearY = textObj.y - textObj.height - 2;
        const clearWidth = textObj.width + 4;
        const clearHeight = textObj.height + 4;
        
        // 🆕 关键修复：使用更可靠的背景恢复方法
        // 获取Canvas的原始截图状态（不包含任何绘制内容）
        const originalScreenshot = previewCanvas.baseCanvasState;
        
        if (originalScreenshot) {
          console.log('🔍 开始恢复背景，清除区域:', { x: clearX, y: clearY, width: clearWidth, height: clearHeight });
          
          // 🆕 修复：使用最可靠的方法 - 重新绘制整个Canvas，然后重绘所有剩余文字
          try {
            // 保存当前Canvas状态（包含所有绘制内容）
            const currentState = previewCtx.getImageData(0, 0, previewCanvas.width, previewCanvas.height);
            
            // 恢复到原始截图状态
            previewCtx.putImageData(originalScreenshot, 0, 0);
            console.log('✅ 已恢复到原始截图状态');
            
            // 重绘所有剩余的文字（除了被删除的）
            if (globalTextObjects && globalTextObjects.length > 0) {
              let redrawnCount = 0;
              globalTextObjects.forEach((remainingTextObj, index) => {
                if (remainingTextObj.id !== textObj.id) { // 跳过被删除的文字
                  previewCtx.font = '16px Arial';
                  previewCtx.fillStyle = remainingTextObj.color;
                  previewCtx.strokeStyle = remainingTextObj.strokeColor;
                  previewCtx.lineWidth = 2;
                  previewCtx.strokeText(remainingTextObj.text, remainingTextObj.x, remainingTextObj.y);
                  previewCtx.fillText(remainingTextObj.text, remainingTextObj.x, remainingTextObj.y);
                  redrawnCount++;
                  console.log(`✅ 重绘文字 [${index}]:`, remainingTextObj.text);
                }
              });
              console.log(`✅ 背景恢复完成，重绘了 ${redrawnCount} 个文字`);
            } else {
              console.log('✅ 背景恢复完成，没有其他文字需要重绘');
            }
            
          } catch (error) {
            console.error('❌ 背景恢复失败:', error);
            // 如果恢复失败，尝试使用备用方法
            try {
              // 备用方法：清除文字区域，用白色填充
              previewCtx.fillStyle = '#FFFFFF';
              previewCtx.fillRect(clearX, clearY, clearWidth, clearHeight);
              console.log('⚠️ 使用备用方法：白色填充清除区域');
            } catch (backupError) {
              console.error('❌ 备用方法也失败了:', backupError);
            }
          }
        } else {
          console.error('❌ 未找到原始截图状态，无法恢复背景');
        }
        
        // 🆕 修复：文字重绘逻辑已集成到背景恢复中
      }
      
      console.log('✅ 文字删除完成');
      
    } catch (error) {
      console.error('❌ 删除文字失败:', error);
    }
  }
  
  // 🆕 新增：统一事件处理器
  function setupUnifiedEventHandler(canvas) {
    try {
      console.log('🔧 设置统一事件处理器，Canvas:', canvas);
      
      // 保存Canvas引用
      currentCanvas = canvas;
      
      // 先移除可能存在的旧事件处理器
      if (unifiedEventHandler) {
        canvas.removeEventListener('mousedown', unifiedEventHandler);
        canvas.removeEventListener('mousemove', unifiedEventHandler);
        canvas.removeEventListener('mouseup', unifiedEventHandler);
        canvas.removeEventListener('click', unifiedEventHandler);
      }
      
      // 创建统一事件处理器
      unifiedEventHandler = function(e) {
        try {
          console.log('🔍 统一事件处理器触发，事件类型:', e.type, '当前工具:', currentActiveTool);
          
          // 根据当前工具状态分发事件
          switch (currentActiveTool) {
            case 'text':
              handleTextToolEvent(e);
              break;
            case 'rectangle':
              handleRectangleToolEvent(e);
              break;
            case 'circle':
              handleCircleToolEvent(e);
              break;
            case 'arrow':
              handleArrowToolEvent(e);
              break;
            case 'brush':
              handleBrushToolEvent(e);
              break;
            default:
              console.log('⚠️ 没有工具激活，忽略事件');
              break;
          }
        } catch (error) {
          console.error('❌ 统一事件处理器失败:', error);
        }
      };
      
      // 绑定所有必要的事件
      canvas.addEventListener('mousedown', unifiedEventHandler);
      canvas.addEventListener('mousemove', unifiedEventHandler);
      canvas.addEventListener('mouseup', unifiedEventHandler);
      canvas.addEventListener('click', unifiedEventHandler);
      
      console.log('✅ 统一事件处理器已设置');
      
    } catch (error) {
      console.error('❌ 设置统一事件处理器失败:', error);
    }
  }
  
  // 🆕 新增：各工具的事件处理器函数
  
  // 文字工具事件处理器
  function handleTextToolEvent(e) {
    try {
      console.log('📝 文字工具处理事件:', e.type);
      
      // 根据事件类型处理
      switch (e.type) {
        case 'mousedown':
          // 处理鼠标按下事件（用于检测文字点击）
          console.log('📝 文字工具处理鼠标按下事件');
          
          // 🆕 修复：通过DOM查询获取文字输入框状态
          const existingTextInput = document.querySelector('input[type="text"]');
          if (currentActiveTool === 'text' && existingTextInput && existingTextInput.style.display === 'block') {
            console.log('⚠️ 文字工具已激活，忽略点击');
            return;
          }
          
          const rect = currentCanvas.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const clickY = e.clientY - rect.top;
          
          // 检查是否点击在已存在的文字上（用于删除）
          const clickedText = findTextAtPosition(clickX, clickY);
          if (clickedText) {
            console.log('📝 点击到已存在的文字，显示删除选项');
            showTextDeleteOptions(clickedText, e.clientX, e.clientY);
            return;
          }
          
          // 新建文字模式
          textX = clickX;
          textY = clickY;
          
          // 🆕 修复：通过DOM查询获取文字输入框和颜色选择器
          const newTextInput = document.querySelector('input[type="text"]');
          const newColorSelector = document.querySelector('div[style*="z-index: 1000005"]');
          
          if (newTextInput && newColorSelector) {
            // 定位输入框
            newTextInput.style.left = e.clientX + 'px';
            newTextInput.style.top = e.clientY + 'px';
            
            // 显示输入框和颜色选择器并聚焦
            newTextInput.style.display = 'block';
            newColorSelector.style.display = 'block';
            newTextInput.focus();
            console.log('📝 文字输入框已激活');
          } else {
            console.error('❌ 未找到文字输入框或颜色选择器');
          }
          
          console.log('📝 文字工具已激活，位置:', textX, textY);
          break;
          
        case 'click':
          // 保留click事件处理作为备用
          console.log('📝 文字工具处理点击事件（备用）');
          break;
      }
    } catch (error) {
      console.error('❌ 文字工具事件处理失败:', error);
    }
  }
  
  // 矩形工具事件处理器
  function handleRectangleToolEvent(e) {
    try {
      console.log('⬜ 矩形工具处理事件:', e.type);
      
      // 获取Canvas和上下文
      const canvas = currentCanvas;
      const ctx = canvas.rectangleCtx || canvas.getContext('2d');
      const baseState = canvas.rectangleBaseState;
      
      if (!baseState || !ctx) {
        console.error('❌ 矩形工具Canvas状态无效');
        return;
      }
      
      // 根据事件类型处理
      switch (e.type) {
        case 'mousedown':
          // 开始绘制矩形
          canvas.rectStartX = e.clientX - canvas.getBoundingClientRect().left;
          canvas.rectStartY = e.clientY - canvas.getBoundingClientRect().top;
          canvas.rectDrawing = true;
          console.log('⬜ 开始绘制矩形:', canvas.rectStartX, canvas.rectStartY);
          break;
          
        case 'mousemove':
          if (!canvas.rectDrawing) return;
          
          // 实时预览矩形
          const currentX = e.clientX - canvas.getBoundingClientRect().left;
          const currentY = e.clientY - canvas.getBoundingClientRect().top;
          
          // 恢复基础图像
          ctx.putImageData(baseState, 0, 0);
          
          // 计算矩形尺寸
          const width = Math.abs(currentX - canvas.rectStartX);
          const height = Math.abs(currentY - canvas.rectStartY);
          const x = Math.min(canvas.rectStartX, currentX);
          const y = Math.min(canvas.rectStartY, currentY);
          
          // 绘制预览矩形
          ctx.strokeStyle = getColorWithOpacity(globalColorState.primary);
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, width, height);
          break;
          
        case 'mouseup':
          if (!canvas.rectDrawing) return;
          
          canvas.rectDrawing = false;
          canvas.style.cursor = 'default';
          
          const endX = e.clientX - canvas.getBoundingClientRect().left;
          const endY = e.clientY - canvas.getBoundingClientRect().top;
          
          // 计算最终矩形尺寸
          const finalWidth = Math.abs(endX - canvas.rectStartX);
          const finalHeight = Math.abs(endY - canvas.rectStartY);
          const finalX = Math.min(canvas.rectStartX, endX);
          const finalY = Math.min(canvas.rectStartY, endY);
          
          // 检查矩形是否有效
          if (finalWidth > 5 && finalHeight > 5) {
            console.log('✅ 矩形绘制完成:', { x: finalX, y: finalY, width: finalWidth, height: finalHeight });
            
            // 最终绘制矩形
            ctx.putImageData(baseState, 0, 0);
            ctx.strokeStyle = getColorWithOpacity(globalColorState.primary);
            ctx.lineWidth = 2;
            ctx.strokeRect(finalX, finalY, finalWidth, finalHeight);
            
            // 保存到撤销历史
            addEditOperation({
              type: 'rectangle',
              canvas: canvas,
              prevState: baseState,
              data: { x: finalX, y: finalY, width: finalWidth, height: finalHeight },
              timestamp: Date.now()
            });
            
            console.log('✅ 矩形操作已保存到撤销历史');
          } else {
            console.log('❌ 矩形太小，取消绘制');
            ctx.putImageData(baseState, 0, 0);
          }
          
          // 重置工具状态
          currentActiveTool = null;
          console.log('🔧 矩形工具已完成，工具状态已重置');
          break;
      }
      
    } catch (error) {
      console.error('❌ 矩形工具事件处理失败:', error);
    }
  }
  
  // 圆形工具事件处理器
  function handleCircleToolEvent(e) {
    try {
      console.log('⭕ 圆形工具处理事件:', e.type);
      
      // 获取Canvas和上下文
      const canvas = currentCanvas;
      const ctx = canvas.circleCtx || canvas.getContext('2d');
      const baseState = canvas.circleBaseState;
      
      if (!baseState || !ctx) {
        console.error('❌ 圆形工具Canvas状态无效');
        return;
      }
      
      // 根据事件类型处理
      switch (e.type) {
        case 'mousedown':
          // 开始绘制圆形
          canvas.circleStartX = e.clientX - canvas.getBoundingClientRect().left;
          canvas.circleStartY = e.clientY - canvas.getBoundingClientRect().top;
          canvas.circleDrawing = true;
          console.log('⭕ 开始绘制圆形:', canvas.circleStartX, canvas.circleStartY);
          break;
          
        case 'mousemove':
          if (!canvas.circleDrawing) return;
          
          // 实时预览圆形
          const currentX = e.clientX - canvas.getBoundingClientRect().left;
          const currentY = e.clientY - canvas.getBoundingClientRect().top;
          
          // 恢复基础图像
          ctx.putImageData(baseState, 0, 0);
          
          // 计算圆形半径
          const radius = Math.sqrt(Math.pow(currentX - canvas.circleStartX, 2) + Math.pow(currentY - canvas.circleStartY, 2));
          
          // 绘制预览圆形
          ctx.strokeStyle = getColorWithOpacity(globalColorState.primary);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(canvas.circleStartX, canvas.circleStartY, radius, 0, 2 * Math.PI);
          ctx.stroke();
          break;
          
        case 'mouseup':
          if (!canvas.circleDrawing) return;
          
          canvas.circleDrawing = false;
          canvas.style.cursor = 'default';
          
          const endX = e.clientX - canvas.getBoundingClientRect().left;
          const endY = e.clientY - canvas.getBoundingClientRect().top;
          
          // 计算最终圆形半径
          const finalRadius = Math.sqrt(Math.pow(endX - canvas.circleStartX, 2) + Math.pow(endY - canvas.circleStartY, 2));
          
          // 检查圆形是否有效
          if (finalRadius > 5) {
            console.log('✅ 圆形绘制完成:', { x: canvas.circleStartX, y: canvas.circleStartY, radius: finalRadius });
            
            // 最终绘制圆形
            ctx.putImageData(baseState, 0, 0);
            ctx.strokeStyle = getColorWithOpacity(globalColorState.primary);
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(canvas.circleStartX, canvas.circleStartY, finalRadius, 0, 2 * Math.PI);
            ctx.stroke();
            
            // 保存到撤销历史
            addEditOperation({
              type: 'circle',
              canvas: canvas,
              prevState: baseState,
              data: { x: canvas.circleStartX, y: canvas.circleStartY, radius: finalRadius },
              timestamp: Date.now()
            });
            
            console.log('✅ 圆形操作已保存到撤销历史');
          } else {
            console.log('❌ 圆形太小，取消绘制');
            ctx.putImageData(baseState, 0, 0);
          }
          
          // 重置工具状态
          currentActiveTool = null;
          console.log('🔧 圆形工具已完成，工具状态已重置');
          break;
      }
      
    } catch (error) {
      console.error('❌ 圆形工具事件处理失败:', error);
    }
  }
  
  // 箭头工具事件处理器
  function handleArrowToolEvent(e) {
    try {
      console.log('➡️ 箭头工具处理事件:', e.type);
      
      // 获取Canvas和上下文
      const canvas = currentCanvas;
      const ctx = canvas.arrowCtx || canvas.getContext('2d');
      const baseState = canvas.arrowBaseState;
      
      if (!baseState || !ctx) {
        console.error('❌ 箭头工具Canvas状态无效');
        return;
      }
      
      // 根据事件类型处理
      switch (e.type) {
        case 'mousedown':
          // 开始绘制箭头
          canvas.arrowStartX = e.clientX - canvas.getBoundingClientRect().left;
          canvas.arrowStartY = e.clientY - canvas.getBoundingClientRect().top;
          canvas.arrowDrawing = true;
          console.log('➡️ 开始绘制箭头:', canvas.arrowStartX, canvas.arrowStartY);
          break;
          
        case 'mousemove':
          if (!canvas.arrowDrawing) return;
          
          // 实时预览箭头
          const currentX = e.clientX - canvas.getBoundingClientRect().left;
          const currentY = e.clientY - canvas.getBoundingClientRect().top;
          
          // 恢复基础图像
          ctx.putImageData(baseState, 0, 0);
          
          // 绘制预览箭头
          drawArrow(ctx, canvas.arrowStartX, canvas.arrowStartY, currentX, currentY);
          break;
          
        case 'mouseup':
          if (!canvas.arrowDrawing) return;
          
          canvas.arrowDrawing = false;
          canvas.style.cursor = 'default';
          
          const endX = e.clientX - canvas.getBoundingClientRect().left;
          const endY = e.clientY - canvas.getBoundingClientRect().top;
          
          // 检查箭头是否有效
          const length = Math.sqrt(Math.pow(endX - canvas.arrowStartX, 2) + Math.pow(endY - canvas.arrowStartY, 2));
          if (length > 10) {
            console.log('✅ 箭头绘制完成:', { startX: canvas.arrowStartX, startY: canvas.arrowStartY, endX, endY });
            
            // 最终绘制箭头
            ctx.putImageData(baseState, 0, 0);
            drawArrow(ctx, canvas.arrowStartX, canvas.arrowStartY, endX, endY);
            
            // 保存到撤销历史
            addEditOperation({
              type: 'arrow',
              canvas: canvas,
              prevState: baseState,
              data: { startX: canvas.arrowStartX, startY: canvas.arrowStartY, endX, endY },
              timestamp: Date.now()
            });
            
            console.log('✅ 箭头操作已保存到撤销历史');
          } else {
            console.log('❌ 箭头太小，取消绘制');
            ctx.putImageData(baseState, 0, 0);
          }
          
          // 重置工具状态
          currentActiveTool = null;
          console.log('🔧 箭头工具已完成，工具状态已重置');
          break;
      }
      
    } catch (error) {
      console.error('❌ 箭头工具事件处理失败:', error);
    }
  }
  
  // 画笔工具事件处理器
  function handleBrushToolEvent(e) {
    try {
      console.log('✏️ 画笔工具处理事件:', e.type);
      
      // 获取Canvas和上下文
      const canvas = currentCanvas;
      const ctx = canvas.brushCtx || canvas.getContext('2d');
      const baseState = canvas.brushBaseState;
      
      if (!baseState || !ctx) {
        console.error('❌ 画笔工具Canvas状态无效');
        return;
      }
      
      // 根据事件类型处理
      switch (e.type) {
        case 'mousedown':
          // 开始绘制
          canvas.brushLastX = e.clientX - canvas.getBoundingClientRect().left;
          canvas.brushLastY = e.clientY - canvas.getBoundingClientRect().top;
          canvas.brushDrawing = true;
          
          // 设置画笔样式
          ctx.strokeStyle = getColorWithOpacity(globalColorState.primary);
          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          
          console.log('✏️ 开始绘制:', canvas.brushLastX, canvas.brushLastY);
          break;
          
        case 'mousemove':
          if (!canvas.brushDrawing) return;
          
          // 绘制线条
          const currentX = e.clientX - canvas.getBoundingClientRect().left;
          const currentY = e.clientY - canvas.getBoundingClientRect().top;
          
          ctx.beginPath();
          ctx.moveTo(canvas.brushLastX, canvas.brushLastY);
          ctx.lineTo(currentX, currentY);
          ctx.stroke();
          
          // 更新位置
          canvas.brushLastX = currentX;
          canvas.brushLastY = currentY;
          break;
          
        case 'mouseup':
          if (!canvas.brushDrawing) return;
          
          canvas.brushDrawing = false;
          
          console.log('✅ 画笔绘制完成');
          
          // 保存到撤销历史
          addEditOperation({
            type: 'brush',
            canvas: canvas,
            prevState: baseState,
            data: { timestamp: Date.now() },
            timestamp: Date.now()
          });
          
          // 更新当前Canvas状态，为下一次绘制做准备
          canvas.brushBaseState = ctx.getImageData(0, 0, canvas.width, canvas.height);
          console.log('🔄 更新Canvas状态，为下一次绘制做准备');
          
          console.log('✅ 画笔操作已保存到撤销历史');
          break;
      }
      
    } catch (error) {
      console.error('❌ 画笔工具事件处理失败:', error);
    }
  }
  
  // 🆕 新增：显示全屏录制控制UI
  function showFullscreenRecordingControls() {
    try {
      console.log('🎮 在授权标签页显示全屏录制控制UI...');
      
      // 创建控制面板容器
      const controlPanel = document.createElement('div');
      controlPanel.id = 'fullscreen-recording-controls';
      controlPanel.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #fbbf24;
        border: 2px solid #000000;
        border-radius: 15px;
        padding: 20px;
        color: #000000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        z-index: 999999;
        min-width: 280px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
      `;
      
      // 添加标题和计时器
      controlPanel.innerHTML = `
        <div style="text-align: center; margin-bottom: 15px;">
          <h3 style="margin: 0; color: #000000;">🖥️ Fullscreen Recording</h3>
          <div id="recording-timer" style="font-size: 24px; font-weight: bold; color: #000000; font-family: 'Courier New', monospace; margin: 10px 0;">
            00:00:00
          </div>
          <p style="margin: 5px 0; font-size: 12px; opacity: 0.7; color: #000000;">Recording in progress...</p>
        </div>
        
        <div style="display: flex; gap: 10px; margin-bottom: 15px;">
          <button id="pause-recording-btn" style="
            flex: 1;
            padding: 10px;
            background: #000000;
            border: none;
            border-radius: 8px;
            color: #ffffff;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.3s ease;
          ">⏸️ Pause</button>
          
          <button id="stop-recording-btn" style="
            flex: 1;
            padding: 10px;
            background: #000000;
            border: none;
            border-radius: 8px;
            color: #ffffff;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.3s ease;
          ">⏹️ Stop</button>
        </div>
        
        <div style="text-align: center; font-size: 11px; opacity: 0.7; color: #000000;">
          💡 Tip: You can switch to other apps while recording continues
        </div>
        
        <button id="close-controls-btn" style="
          position: absolute;
          top: 5px;
          right: 5px;
          background: #000000;
          border: none;
          border-radius: 50%;
          width: 20px;
          height: 20px;
          color: #ffffff;
          cursor: pointer;
          font-size: 12px;
        ">×</button>
      `;
      
      // 添加到页面
      document.body.appendChild(controlPanel);
      
      // 绑定事件
      bindFullscreenRecordingEvents(controlPanel);
      
      // 启动计时器 - 延迟启动确保DOM元素已创建
      setTimeout(() => {
        startFullscreenRecordingTimer();
      }, 100);
      
      console.log('✅ 全屏录制控制UI已显示');
      
    } catch (error) {
      console.error('❌ 显示全屏录制控制UI失败:', error);
    }
  }
  
  // 🆕 新增：绑定全屏录制控制事件
  function bindFullscreenRecordingEvents(controlPanel) {
    try {
      const pauseBtn = controlPanel.querySelector('#pause-recording-btn');
      const stopBtn = controlPanel.querySelector('#stop-recording-btn');
      const closeBtn = controlPanel.querySelector('#close-controls-btn');
      
      // 暂停/继续按钮
      if (pauseBtn) {
        pauseBtn.addEventListener('click', async () => {
          try {
            console.log('⏸️ 暂停/继续按钮被点击');
            await toggleFullscreenRecordingPause();
          } catch (error) {
            console.error('❌ 暂停/继续操作失败:', error);
          }
        });
      }
      
      // 停止按钮
      if (stopBtn) {
        stopBtn.addEventListener('click', async () => {
          try {
            console.log('⏹️ 停止按钮被点击');
            await stopFullscreenRecording();
          } catch (error) {
            console.error('❌ 停止录制失败:', error);
          }
        });
      }
      
      // 关闭按钮
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          console.log('❌ 关闭控制面板');
          controlPanel.remove();
        });
      }
      
      console.log('✅ 全屏录制控制事件已绑定');
      
    } catch (error) {
      console.error('❌ 绑定全屏录制控制事件失败:', error);
    }
  }
  
  // 🆕 新增：启动全屏录制计时器
  function startFullscreenRecordingTimer() {
    try {
      console.log('🔍 准备启动授权标签页计时器...');
      
      // 等待DOM元素创建完成
      const waitForElement = () => {
        const timerElement = document.getElementById('recording-timer');
        if (timerElement) {
          console.log('✅ 找到计时器元素，启动计时器');
          console.log('🔍 计时器元素详情:', {
            id: timerElement.id,
            textContent: timerElement.textContent,
            style: timerElement.style.cssText
          });
          
          const startTime = Date.now();
          let totalPausedTime = 0;
          let pauseStartTime = null;
          let isPaused = false;
          console.log('⏰ 计时器开始时间:', new Date(startTime).toLocaleTimeString());
          
          const timer = setInterval(async () => {
            try {
              // 检查录制状态
              const status = await chrome.storage.local.get(['recordingStatus']);
              const currentStatus = status.recordingStatus || 'active';
              
              if (currentStatus === 'paused' && !isPaused) {
                // 录制刚刚暂停
                isPaused = true;
                pauseStartTime = Date.now();
                console.log('⏸️ 检测到录制暂停，计时器暂停');
              } else if (currentStatus === 'active' && isPaused) {
                // 录制刚刚恢复
                if (pauseStartTime) {
                  totalPausedTime += Date.now() - pauseStartTime;
                  console.log('▶️ 检测到录制恢复，计时器继续，累计暂停时间:', totalPausedTime, 'ms');
                }
                isPaused = false;
                pauseStartTime = null;
              }
              
              // 只有在录制进行中时才更新计时器
              if (currentStatus === 'active' && !isPaused) {
                const elapsed = Date.now() - startTime - totalPausedTime;
                const hours = Math.floor(elapsed / 3600000);
                const minutes = Math.floor((elapsed % 3600000) / 60000);
                const seconds = Math.floor((elapsed % 60000) / 1000);
                
                if (timerElement && timerElement.parentNode) {
                  const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                  timerElement.textContent = timeString;
                  timerElement.style.color = '#000000'; // 黑色表示录制中
                  
                  // 每5秒显示一次调试信息
                  if (seconds % 5 === 0) {
                    console.log(`⏰ 授权标签页计时器更新: ${timeString} (经过 ${elapsed}ms, 累计暂停 ${totalPausedTime}ms)`);
                  }
                } else {
                  console.warn('⚠️ 计时器元素丢失或已移除，停止计时器');
                  clearInterval(timer);
                  window.fullscreenRecordingTimer = null;
                }
              } else if (currentStatus === 'paused') {
                // 录制暂停时，显示暂停状态
                if (timerElement && timerElement.parentNode) {
                  timerElement.style.color = '#000000'; // 黑色表示暂停
                  timerElement.textContent = '⏸️ Paused';
                }
              }
              
            } catch (error) {
              console.error('❌ 计时器更新失败:', error);
              clearInterval(timer);
              window.fullscreenRecordingTimer = null;
            }
          }, 1000);
          
          // 保存计时器引用
          window.fullscreenRecordingTimer = timer;
          
          console.log('✅ 授权标签页计时器已启动，ID:', timer);
          
        } else {
          console.log('⏳ 计时器元素未就绪，等待100ms后重试...');
          setTimeout(waitForElement, 100);
        }
      };
      
      // 开始等待元素
      waitForElement();
      
    } catch (error) {
      console.error('❌ 启动全屏录制计时器失败:', error);
    }
  }
  
  // 🆕 新增：暂停/继续全屏录制
  async function toggleFullscreenRecordingPause() {
    try {
      console.log('⏸️ 尝试暂停/继续全屏录制...');
      
      if (window.voiceCatchRecorder && window.voiceCatchRecorder.state === 'recording') {
        window.voiceCatchRecorder.pause();
        updatePauseButtonText('▶️ 继续');
        
        // 更新存储状态为暂停
        await chrome.storage.local.set({ recordingStatus: 'paused' });
        console.log('✅ 录制已暂停，状态已更新');
        
      } else if (window.voiceCatchRecorder && window.voiceCatchRecorder.state === 'paused') {
        window.voiceCatchRecorder.resume();
        updatePauseButtonText('⏸️ 暂停');
        
        // 更新存储状态为活跃
        await chrome.storage.local.set({ recordingStatus: 'active' });
        console.log('✅ 录制已继续，状态已更新');
      }
      
    } catch (error) {
      console.error('❌ 暂停/继续录制失败:', error);
    }
  }
  
  // 🆕 新增：更新暂停按钮文本
  function updatePauseButtonText(text) {
    console.log('🔄 更新暂停按钮文本:', text);
    
    // 更新全屏录制的暂停按钮
    const fullscreenPauseBtn = document.querySelector('#pause-recording-btn');
    if (fullscreenPauseBtn) {
      fullscreenPauseBtn.textContent = text;
      console.log('✅ 全屏录制暂停按钮已更新:', text);
    }
    
    // 更新通用录制控制UI的暂停按钮 - 使用ID选择器
    const generalPauseBtn = document.querySelector('#voiceCatchPauseBtn');
    if (generalPauseBtn) {
      generalPauseBtn.textContent = text;
      console.log('✅ 通用录制控制UI暂停按钮已更新:', text);
    }
    
    // 备用方案：通过按钮内容查找
    const allButtons = document.querySelectorAll('#voiceCatchControlUI button');
    allButtons.forEach(button => {
      if (button.textContent.includes('Pause') || button.textContent.includes('Resume')) {
        button.textContent = text;
        console.log('✅ 通过内容匹配找到的暂停按钮已更新:', text);
      }
    });
  }
  
  // 🆕 新增：停止全屏录制
  async function stopFullscreenRecording() {
    try {
      console.log('⏹️ 尝试停止全屏录制...');
      
      if (window.voiceCatchRecorder) {
        window.voiceCatchRecorder.stop();
        console.log('✅ 录制已停止');
      }
      
      // 清理控制UI
      const controlPanel = document.getElementById('fullscreen-recording-controls');
      if (controlPanel) {
        controlPanel.remove();
      }
      
      // 清理计时器
      if (window.fullscreenRecordingTimer) {
        clearInterval(window.fullscreenRecordingTimer);
        window.fullscreenRecordingTimer = null;
      }
      
    } catch (error) {
      console.error('❌ 停止全屏录制失败:', error);
    }
  }

  // 🆕 新增：取消工具激活状态
  function deactivateCurrentTool() {
    try {
      console.log('🔧 取消当前工具激活状态:', currentActiveTool);
      
      if (currentActiveTool === 'text') {
        // 取消文字工具
        // 🆕 修复：使用UI状态判断，而不是未定义的isTextActive
        const textInput = document.querySelector('input[type="text"]');
        if (textInput && textInput.style.display === 'block') {
          cancelTextInput();
        }
      }
      
      // 重置工具状态
      currentActiveTool = null;
      console.log('✅ 工具状态已重置');
      
    } catch (error) {
      console.error('❌ 取消工具激活状态失败:', error);
    }
  }

  // 🆕 新增：全屏录制功能
  async function startFullScreenRecording() {
    try {
      console.log('🖥️ 开始全屏录制...');
      
      // 显示录制状态
      showRecordingStatus('🖥️ Fullscreen Recording Mode - Preparing...');
      

      
      // 获取屏幕共享流
      console.log('🖥️ 开始全屏录制...');
      
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor',  // 明确请求显示器录制权限
          logicalSurface: true,
          width: { ideal: window.screen.width },
          height: { ideal: window.screen.height },
          frameRate: { ideal: 30, max: 60 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        preferCurrentTab: false,  // 全屏录制不需要优先当前标签页
        selfBrowserSurface: 'include'
      });
      
      console.log('✅ 全屏录制流获取成功');
      console.log('🎬 流详情:', stream);
      
      // 🆕 新增：保存录制状态到存储
      try {
        await chrome.storage.local.set({
          recordingStatus: 'active',
          startTime: Date.now(),
          mode: 'fullscreen',
          sourceTabId: await getCurrentTabId()
        });
        console.log('✅ 录制状态已保存到存储');
      } catch (storageError) {
        console.warn('⚠️ 保存录制状态失败:', storageError);
      }
      
      // 开始录制
      startRecordingFromStream(stream, 'screen');
      
      // 🆕 新增：在授权标签页显示控制UI
      showFullscreenRecordingControls();
      
    } catch (error) {
      console.error('❌ 全屏录制启动失败:', error);
      showRecordingStatus(`❌ Fullscreen Recording Failed: ${error.message}`);
      
      // 录制失败时不需要清理控制标签页，因为不再创建
    }
  }

  // 🆕 新增：通用录制流处理函数
  async function startRecordingFromStream(stream, mode) {
    try {
      console.log(`🎬 开始从流录制，模式: ${mode}`);
      
      // 设置全局流变量
      window.voiceCatchStream = stream;
      
      // 创建MediaRecorder - 🆕 更严格的比特率参数（针对标签录制优化）
      const recorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 500000,   // 从2Mbps降低到0.5Mbps（减少75%）
        audioBitsPerSecond: 16000     // 从64kbps降低到16kbps（减少75%）
      });
      
      // 设置全局录制器
      window.voiceCatchRecorder = recorder;
      
      const chunks = [];
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      
      recorder.onstop = async () => {
        console.log('🛑 录制停止，开始处理数据...');
        
        // 🆕 新增：全屏录制时清理授权标签页控制UI
        if (mode === 'screen') {
          try {
            // 清理授权标签页的控制UI
            const controlPanel = document.getElementById('fullscreen-recording-controls');
            if (controlPanel) {
              controlPanel.remove();
              console.log('🧹 授权标签页控制UI已清理');
            }
            
            // 清理计时器
            if (window.fullscreenRecordingTimer) {
              clearInterval(window.fullscreenRecordingTimer);
              window.fullscreenRecordingTimer = null;
              console.log('🧹 全屏录制计时器已清理');
            }
            
            // 清理存储状态
            await chrome.storage.local.remove(['recordingStatus', 'startTime', 'mode', 'sourceTabId']);
            console.log('🧹 录制状态已清理');
          } catch (cleanupError) {
            console.warn('⚠️ 清理全屏录制资源失败:', cleanupError);
          }
        }
        
        // 创建Blob
        const blob = new Blob(chunks, { type: 'video/webm' });
        
        // 准备录制数据
        const recordingData = {
          timestamp: Date.now(),
          duration: Date.now() - recorder.startTime,
          format: 'webm',
          size: blob.size,
          blob: blob,
          blobType: 'video/webm',
          mode: mode,
          metadata: {
            width: stream.getVideoTracks()[0]?.getSettings()?.width || 1920,
            height: stream.getVideoTracks()[0]?.getSettings()?.height || 1080,
            frameRate: stream.getVideoTracks()[0]?.getSettings()?.frameRate || 30
          }
        };
        
        try {
          // 处理录制完成
          await handleRecordingComplete(recordingData);
        } catch (error) {
          console.error('❌ 录制数据处理失败:', error);
          showRecordingStatus(`❌ Recording Processing Failed: ${error.message}`);
        } finally {
          // 清理资源
          try {
            stream.getTracks().forEach(track => track.stop());
            chunks.length = 0;
            
            // 🆕 停止录制时长监控
            stopRecordingDurationMonitor();
            
            // 清理全局变量
            delete window.voiceCatchStream;
            delete window.voiceCatchRecorder;
            
            console.log('✅ 录制资源清理完成');
          } catch (cleanupError) {
            console.error('❌ 录制资源清理失败:', cleanupError);
          }
        }
      };
      
      // 开始录制
      recorder.start();
      recorder.startTime = Date.now();
      
      console.log(`✅ ${mode}录制已开始`);
      console.log(`📊 严格优化后的比特率配置: 视频0.5Mbps, 音频16kbps`);
      console.log(`📐 分辨率限制: 最大1280x720, 最大24fps`);
      
      // 🆕 添加录制时长监控
      startRecordingDurationMonitor(mode, recorder.startTime);
      
      // 显示录制状态
      showRecordingStatus(`🎬 ${mode} Recording in Progress...`);
      
      // 创建录制控制界面
      if (mode === 'screen') {
        // 🆕 修改：全屏录制使用独立标签页，不需要在当前页面创建控制界面
        console.log('🖥️ 全屏录制使用独立控制标签页，跳过当前页面控制界面');
      } else {
        // 其他模式：使用原有控制界面
        createRecordingControlUI();
      }
      
    } catch (error) {
      console.error(`❌ ${mode}录制失败:`, error);
      showRecordingStatus(`❌ ${mode} Recording Failed: ${error.message}`);
    }
  }

  // 🆕 新增：创建全屏录制控制界面
  function createFullscreenRecordingControlUI() {
    console.log('🖥️ 创建全屏录制控制界面...');
    
    // 移除已存在的操作界面
    const existingUI = document.getElementById('voiceCatchFullscreenControlUI');
    if (existingUI) {
      existingUI.remove();
    }
    
    // 创建操作界面容器 - 固定在屏幕右侧中央
    const controlUI = document.createElement('div');
    controlUI.id = 'voiceCatchFullscreenControlUI';
    controlUI.style.cssText = `
      position: fixed;
      top: 50%;
      right: 30px;
      transform: translateY(-50%);
      background: #fbbf24;
      color: #000000;
      padding: 20px;
      border-radius: 15px;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      min-width: 220px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      border: 2px solid #000000;
      backdrop-filter: blur(10px);
    `;
    
    // 录制模式标识
    const modeLabel = document.createElement('div');
    modeLabel.style.cssText = `
      text-align: center;
      font-size: 14px;
      margin-bottom: 15px;
      color: #000000;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 1px;
    `;
    modeLabel.textContent = '🖥️ Fullscreen Recording';
    
    // 录制时间显示
    const timeDisplay = document.createElement('div');
    timeDisplay.id = 'fullscreenRecordingTime';
    timeDisplay.style.cssText = `
      text-align: center;
      font-size: 20px;
      font-weight: bold;
      margin-bottom: 20px;
      color: #000000;
      font-family: 'Courier New', monospace;
    `;
    timeDisplay.textContent = '00:00';
    
    // 控制按钮容器
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 12px;
      align-items: center;
    `;
    
    // 暂停/继续按钮
    const pauseButton = document.createElement('button');
    pauseButton.textContent = '⏸️ Pause';
    pauseButton.style.cssText = `
      padding: 12px 20px;
      border: none;
      border-radius: 8px;
      background: #000000;
      color: #ffffff;
      cursor: pointer;
      font-size: 14px;
      font-weight: bold;
      min-width: 140px;
      transition: all 0.3s ease;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
    `;
    pauseButton.onmouseenter = () => {
      pauseButton.style.transform = 'translateY(-2px)';
      pauseButton.style.boxShadow = '0 6px 20px rgba(255, 149, 0, 0.4)';
    };
    pauseButton.onmouseleave = () => {
      pauseButton.style.transform = 'translateY(0)';
      pauseButton.style.boxShadow = '0 4px 15px rgba(255, 149, 0, 0.3)';
    };
    pauseButton.onclick = () => togglePause();
    
    // 停止按钮
    const stopButton = document.createElement('button');
    stopButton.textContent = '⏹️ Stop';
    stopButton.style.cssText = `
      padding: 12px 20px;
      border: none;
      border-radius: 8px;
      background: #000000;
      color: #ffffff;
      cursor: pointer;
      font-size: 14px;
      font-weight: bold;
      min-width: 140px;
      transition: all 0.3s ease;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
    `;
    stopButton.onmouseenter = () => {
      stopButton.style.transform = 'translateY(-2px)';
      stopButton.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.4)';
    };
    stopButton.onmouseleave = () => {
      stopButton.style.transform = 'translateY(0)';
      stopButton.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.3)';
    };
    stopButton.onclick = () => stopFullscreenRecording();
    
    // 组装界面
    buttonContainer.appendChild(pauseButton);
    buttonContainer.appendChild(stopButton);
    
    controlUI.appendChild(modeLabel);
    controlUI.appendChild(timeDisplay);
    controlUI.appendChild(buttonContainer);
    
    // 添加到页面
    document.body.appendChild(controlUI);
    
    // 启动时间计时器
    startFullscreenRecordingTimer();
    
    console.log('✅ 全屏录制控制界面创建完成');
  }

  // 🆕 新增：全屏录制时间计时器


  // 🆕 新增：停止全屏录制
  function stopFullscreenRecording() {
    try {
      console.log('🛑 停止全屏录制...');
      
      // 停止计时器
      if (window.fullscreenRecordingTimer) {
        clearInterval(window.fullscreenRecordingTimer);
        delete window.fullscreenRecordingTimer;
      }
      
      // 停止录制器
      if (window.voiceCatchRecorder && window.voiceCatchRecorder.state !== 'inactive') {
        window.voiceCatchRecorder.stop();
      }
      
      // 清理控制界面
      const controlUI = document.getElementById('voiceCatchFullscreenControlUI');
      if (controlUI) {
        controlUI.remove();
      }
      
      console.log('✅ 全屏录制已停止');
      
    } catch (error) {
      console.error('❌ 停止全屏录制失败:', error);
    }
  }

  // 🆕 新增：获取当前标签页ID
  async function getCurrentTabId() {
    try {
      // 在 content script 中无法直接获取标签页ID
      // 使用一个替代方案：生成一个唯一标识符
      const uniqueId = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      console.log('🔍 生成唯一标识符:', uniqueId);
      return uniqueId;
    } catch (error) {
      console.error('❌ 获取当前标签页ID失败:', error);
      return null;
    }
  }



  // 🆕 新增：显示暂停状态
  function showPauseStatus() {
    try {
      console.log('⏸️ 显示暂停状态...');
      
      // 更新录制时间显示为暂停状态，时间显示消失
      const timeDisplay = document.getElementById('recordingTime');
      if (timeDisplay) {
        // 显示暂停状态，时间显示消失
        timeDisplay.textContent = '⏸️ Paused';
        timeDisplay.style.color = '#000000'; // 黑色表示暂停
      }
      
      // 更新录制状态显示
      showRecordingStatus('⏸️ Recording Paused');
      
    } catch (error) {
      console.error('❌ 显示暂停状态失败:', error);
    }
  }
  
  // 🆕 新增：隐藏暂停状态
  function hidePauseStatus() {
    try {
      console.log('▶️ 隐藏暂停状态...');
      
      // 恢复录制时间显示，重新启动计时器
      const timeDisplay = document.getElementById('recordingTime');
      if (timeDisplay && recordingStartTime) {
        // 重新启动计时器循环，从暂停前的时间继续
        updateRecordingTime();
      }
      
      // 更新录制状态显示
      showRecordingStatus('▶️ Recording Resumed');
      
    } catch (error) {
      console.error('❌ 隐藏暂停状态失败:', error);
    }
  }

  // 🆕 新增：显示录制状态函数
  function showRecordingStatus(message) {
    try {
      console.log('📊 录制状态:', message);
      
      // 检查是否在录制控制界面中
      const statusElement = document.querySelector('.recording-status');
      if (statusElement) {
        statusElement.textContent = message;
        return;
      }
      
      // 如果没有录制控制界面，创建一个简单的状态显示
      let statusDiv = document.getElementById('voiceCatchStatus');
      if (!statusDiv) {
        statusDiv = document.createElement('div');
        statusDiv.id = 'voiceCatchStatus';
        statusDiv.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background: rgba(0, 0, 0, 0.8);
          color: white;
          padding: 10px 15px;
          border-radius: 8px;
          font-size: 14px;
          z-index: 999999;
          max-width: 300px;
          word-wrap: break-word;
        `;
        document.body.appendChild(statusDiv);
      }
      
      statusDiv.textContent = message;
      
      // 3秒后自动隐藏
      setTimeout(() => {
        if (statusDiv && statusDiv.parentNode) {
          statusDiv.parentNode.removeChild(statusDiv);
        }
      }, 3000);
      
    } catch (error) {
      console.error('❌ 显示录制状态失败:', error);
    }
  }

  // 🆕 录制时长监控函数
  function startRecordingDurationMonitor(mode, startTime) {
    console.log(`⏱️ 开始${mode}录制时长监控...`);
    
    // 设置监控间隔（每30秒检查一次）
    const monitorInterval = setInterval(() => {
      const duration = Date.now() - startTime;
      const durationMinutes = Math.floor(duration / 60000);
      
      // 每5分钟提醒一次
      if (durationMinutes > 0 && durationMinutes % 5 === 0) {
        console.log(`⏰ ${mode}录制已进行 ${durationMinutes} 分钟`);
        
        // 长时间录制警告（超过10分钟）
        if (durationMinutes >= 10) {
          console.warn(`⚠️ ${mode}录制已超过10分钟，建议适时停止以避免文件过大`);
          showRecordingStatus(`⚠️ ${mode} Recording: ${durationMinutes} minutes - Consider stopping to avoid large files`);
        }
      }
      
      // 超长录制警告（超过30分钟）
      if (durationMinutes >= 30) {
        console.error(`🚨 ${mode}录制已超过30分钟，文件可能过大，建议立即停止`);
        showRecordingStatus(`🚨 ${mode} Recording: ${durationMinutes} minutes - File may be too large!`);
      }
    }, 30000); // 30秒检查一次
    
    // 保存监控器ID，用于清理
    window.recordingDurationMonitor = monitorInterval;
    
    console.log(`✅ ${mode}录制时长监控已启动`);
  }

  // 🆕 停止录制时长监控
  function stopRecordingDurationMonitor() {
    if (window.recordingDurationMonitor) {
      clearInterval(window.recordingDurationMonitor);
      window.recordingDurationMonitor = null;
      console.log('⏹️ 录制时长监控已停止');
    }
  }

})();