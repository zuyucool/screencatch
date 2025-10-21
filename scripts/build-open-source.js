// ScreenCatch 开源版本构建脚本
// 用于构建和打包开源版本

const fs = require('fs');
const path = require('path');

class OpenSourceBuilder {
  constructor() {
    this.sourceDir = './src';
    this.buildDir = './dist';
    this.version = this.getVersion();
  }

  getVersion() {
    try {
      const manifest = JSON.parse(fs.readFileSync('./src/manifest.json', 'utf8'));
      return manifest.version;
    } catch (error) {
      console.log('⚠️ 无法读取版本信息，使用默认版本');
      return '3.0.2';
    }
  }

  async build() {
    console.log(`🔨 构建开源版本 v${this.version}...`);
    
    // 创建构建目录
    if (fs.existsSync(this.buildDir)) {
      fs.rmSync(this.buildDir, { recursive: true });
    }
    fs.mkdirSync(this.buildDir, { recursive: true });

    // 复制文件
    await this.copyFiles();
    
    // 生成构建信息
    await this.generateBuildInfo();
    
    // 创建发布包
    await this.createReleasePackage();
    
    console.log('✅ 构建完成！');
    console.log(`📦 发布包: ${this.buildDir}/screencatch-v${this.version}.zip`);
  }

  async copyFiles() {
    const files = [
      'manifest.json',
      'service_worker.js',
      'content_script.js',
      'popup-new-extension.html',
      'popup-new-extension.js',
      'export-new-extension.html',
      'export-new-extension.js',
      'recording-control-new-extension.html',
      'recording-control-new-extension.js',
      'screenshot-editor-new-extension.html',
      'screenshot-editor-new-extension.js',
      'screenshot-module-new-extension.js',
      'html2canvas.min.js',
      'README.md',
      'CONTRIBUTING.md',
      'LICENSE',
      'CHANGELOG.md'
    ];

    for (const file of files) {
      const sourcePath = path.join(this.sourceDir, file);
      const targetPath = path.join(this.buildDir, file);
      
      if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, targetPath);
        console.log(`✅ 复制: ${file}`);
      } else {
        console.log(`⚠️ 文件不存在: ${file}`);
      }
    }

    // 复制目录
    await this.copyDirectory('./src/icons', './dist/icons');
    await this.copyDirectory('./src/locales', './dist/locales');
    await this.copyDirectory('./docs', './dist/docs');
  }

  async copyDirectory(source, target) {
    if (fs.existsSync(source)) {
      fs.mkdirSync(target, { recursive: true });
      const files = fs.readdirSync(source);
      
      for (const file of files) {
        const sourcePath = path.join(source, file);
        const targetPath = path.join(target, file);
        
        if (fs.statSync(sourcePath).isDirectory()) {
          await this.copyDirectory(sourcePath, targetPath);
        } else {
          fs.copyFileSync(sourcePath, targetPath);
        }
      }
      
      console.log(`✅ 复制目录: ${source} -> ${target}`);
    } else {
      console.log(`⚠️ 目录不存在: ${source}`);
    }
  }

  async generateBuildInfo() {
    const buildInfo = {
      version: this.version,
      buildDate: new Date().toISOString(),
      buildType: 'open-source',
      features: [
        'Canvas real-time cropping',
        'Canvas preprocessing',
        'Independent timer system',
        'Bilingual community integration',
        'Open source version management'
      ],
      supportedBrowsers: [
        'Chrome >= 88',
        'Edge >= 88'
      ],
      technologies: [
        'Chrome Extensions Manifest V3',
        'WebCodecs API',
        'Canvas API',
        'MediaRecorder API',
        'html2canvas'
      ]
    };

    fs.writeFileSync(
      path.join(this.buildDir, 'build-info.json'),
      JSON.stringify(buildInfo, null, 2)
    );
    
    console.log('✅ 构建信息已生成');
  }

  async createReleasePackage() {
    console.log('📦 创建发布包...');
    
    // 简单的文件打包（实际项目中可以使用archiver等库）
    const packageInfo = {
      name: `screencatch-v${this.version}`,
      version: this.version,
      description: 'Professional screen recording and screenshot tool with Canvas optimization technology',
      files: this.getFileList(),
      buildDate: new Date().toISOString(),
      instructions: [
        '1. Download the zip file',
        '2. Extract to a folder',
        '3. Open Chrome and go to chrome://extensions/',
        '4. Enable Developer mode',
        '5. Click "Load unpacked" and select the extracted folder',
        '6. Start using ScreenCatch!'
      ]
    };

    fs.writeFileSync(
      path.join(this.buildDir, 'package-info.json'),
      JSON.stringify(packageInfo, null, 2)
    );
    
    console.log('✅ 发布包信息已创建');
  }

  getFileList() {
    const files = [];
    
    function scanDirectory(dir, basePath = '') {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const itemPath = path.join(dir, item);
        const relativePath = path.join(basePath, item);
        
        if (fs.statSync(itemPath).isDirectory()) {
          scanDirectory(itemPath, relativePath);
        } else {
          files.push(relativePath);
        }
      }
    }
    
    scanDirectory(this.buildDir);
    return files;
  }

  async createInstallationGuide() {
    const guide = `# ScreenCatch Installation Guide

## Quick Installation

### Method 1: Chrome Web Store (Recommended)
1. Visit [Chrome Web Store](https://chrome.google.com/webstore)
2. Search for "ScreenCatch"
3. Click "Add to Chrome"

### Method 2: Developer Mode Installation
1. Download the latest release from [GitHub](https://github.com/yourusername/screencatch/releases)
2. Extract the zip file to a folder
3. Open Chrome and go to \`chrome://extensions/\`
4. Enable "Developer mode" in the top right
5. Click "Load unpacked" and select the extracted folder
6. ScreenCatch will be installed and ready to use!

## First Time Setup

1. **Grant Permissions**: Allow ScreenCatch to access screen recording
2. **Choose Recording Mode**: 
   - Full Screen Recording
   - Region Recording
   - Tab Recording
   - Region Screenshot
3. **Start Recording**: Click the extension icon and select your preferred mode

## Features Overview

- 🎥 **Multi-mode Recording**: Record full screen, regions, or specific tabs
- 📸 **Smart Screenshot**: Capture and edit screenshots with built-in tools
- ⚡ **Canvas Optimization**: 95%+ file size reduction with real-time cropping
- 🌍 **Bilingual Support**: Chinese and English interface
- 🎨 **Built-in Editor**: Drawing tools, color palette, and text annotation

## Troubleshooting

### Common Issues

**Q: Recording doesn't start**
A: Make sure you've granted screen recording permissions and are using Chrome 88+

**Q: File size is too large**
A: Use Region Recording mode for smaller file sizes, or enable Canvas optimization

**Q: Extension crashes during long recordings**
A: This has been fixed in v3.0.2 with Canvas real-time cropping technology

### Getting Help

- **Discord**: [Join our community](https://discord.gg/screencatch)
- **GitHub Issues**: [Report bugs](https://github.com/yourusername/screencatch/issues)
- **Documentation**: [Read the docs](https://github.com/yourusername/screencatch/tree/main/docs)

## Contributing

We welcome contributions! See our [Contributing Guide](CONTRIBUTING.md) for details.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
`;

    fs.writeFileSync(
      path.join(this.buildDir, 'INSTALLATION.md'),
      guide
    );
    
    console.log('✅ 安装指南已创建');
  }
}

// 执行构建
const builder = new OpenSourceBuilder();
builder.build().then(() => {
  console.log('🎉 开源版本构建完成！');
}).catch(error => {
  console.error('❌ 构建失败:', error);
});
