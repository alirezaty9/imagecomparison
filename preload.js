const { contextBridge, ipcRenderer } = require('electron');

console.log('Preload script loaded'); // برای دیباگ

// API امن برای استفاده در renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // فایل operations
  createFile: (fileName, content) => {
    console.log('createFile called with:', fileName, content);
    return ipcRenderer.invoke('create-file', fileName, content);
  },
  
  readFile: (filePath) => {
    console.log('readFile called with:', filePath);
    return ipcRenderer.invoke('read-file', filePath);
  },
  
  saveFileDialog: (data, filters) => {
    console.log('saveFileDialog called');
    return ipcRenderer.invoke('save-file-dialog', data, filters);
  },
  
  // Image operations
  selectImageFiles: () => {
    console.log('selectImageFiles called');
    return ipcRenderer.invoke('select-image-files');
  },
  
  compareImages: (imageData) => {
    console.log('compareImages called with:', imageData?.length, 'images');
    return ipcRenderer.invoke('compare-images', imageData);
  },
  
  // System info
  getSystemInfo: () => {
    console.log('getSystemInfo called');
    return ipcRenderer.invoke('get-system-info');
  },
  
  // File system operations
  showItemInFolder: (fullPath) => {
    console.log('showItemInFolder called with:', fullPath);
    return ipcRenderer.invoke('show-item-in-folder', fullPath);
  },
  
  openExternal: (url) => {
    console.log('openExternal called with:', url);
    return ipcRenderer.invoke('open-external', url);
  },
  
  // Event listeners
  onFilesSelected: (callback) => {
    console.log('onFilesSelected listener added');
    ipcRenderer.on('files-selected', callback);
  },
  
  removeAllListeners: (channel) => {
    console.log('removeAllListeners called for:', channel);
    ipcRenderer.removeAllListeners(channel);
  }
});

// Simple file system API برای خواندن فایل‌های آپلود شده
contextBridge.exposeInMainWorld('fs', {
  readFile: async (fileName, options = {}) => {
    try {
      // برای فایل‌های آپلود شده که در memory هستند
      // این function فقط برای compatibility با artifact های قبلی است
      console.log('fs.readFile called with:', fileName);
      
      // اگر fileName یک File object است (از input[type="file"])
      if (fileName && typeof fileName === 'object' && fileName.name) {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            if (options.encoding === 'utf8') {
              resolve(reader.result);
            } else {
              // Convert to Uint8Array
              const arrayBuffer = reader.result;
              resolve(new Uint8Array(arrayBuffer));
            }
          };
          reader.onerror = reject;
          
          if (options.encoding === 'utf8') {
            reader.readAsText(fileName);
          } else {
            reader.readAsArrayBuffer(fileName);
          }
        });
      }
      
      // اگر fileName یک string است، از electronAPI استفاده کن
      if (typeof fileName === 'string') {
        const result = await window.electronAPI.readFile(fileName);
        if (result.success) {
          if (options.encoding === 'utf8') {
            return result.data.toString('utf8');
          } else {
            return new Uint8Array(result.data);
          }
        } else {
          throw new Error(result.error);
        }
      }
      
      throw new Error('Invalid file parameter');
    } catch (error) {
      console.error('fs.readFile error:', error);
      throw error;
    }
  }
});

// Image utilities
contextBridge.exposeInMainWorld('imageUtils', {
  // تبدیل فایل به base64
  fileToBase64: (file) => {
    console.log('fileToBase64 called');
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },
  
  // گرفتن ابعاد تصویر
  getImageDimensions: (imageSrc) => {
    console.log('getImageDimensions called');
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.width, height: img.height });
      img.onerror = reject;
      img.src = imageSrc;
    });
  },
  
  // بررسی صحت فایل تصویری
  validateImageFile: (file) => {
    console.log('validateImageFile called for:', file?.name);
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 'image/webp', 'image/tiff'];
    const maxSize = 50 * 1024 * 1024; // 50MB
    
    return {
      isValid: validTypes.includes(file.type) && file.size <= maxSize,
      type: file.type,
      size: file.size,
      sizeInMB: (file.size / (1024 * 1024)).toFixed(2),
      name: file.name
    };
  }
});

// Platform info
contextBridge.exposeInMainWorld('platform', {
  isWindows: process.platform === 'win32',
  isMacOS: process.platform === 'darwin',
  isLinux: process.platform === 'linux',
  platform: process.platform,
  arch: process.arch
});

// Storage utilities (localStorage wrapper)
contextBridge.exposeInMainWorld('storage', {
  set: (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      console.log('Storage set:', key);
      return true;
    } catch (error) {
      console.error('Storage set error:', error);
      return false;
    }
  },
  
  get: (key, defaultValue = null) => {
    try {
      const item = localStorage.getItem(key);
      const result = item ? JSON.parse(item) : defaultValue;
      console.log('Storage get:', key, '→', result);
      return result;
    } catch (error) {
      console.error('Storage get error:', error);
      return defaultValue;
    }
  },
  
  remove: (key) => {
    try {
      localStorage.removeItem(key);
      console.log('Storage remove:', key);
      return true;
    } catch (error) {
      console.error('Storage remove error:', error);
      return false;
    }
  },
  
  clear: () => {
    try {
      localStorage.clear();
      console.log('Storage cleared');
      return true;
    } catch (error) {
      console.error('Storage clear error:', error);
      return false;
    }
  }
});

// چک کردن اینکه API درست expose شده
window.addEventListener('DOMContentLoaded', () => {
  console.log('DOMContentLoaded - APIs available:');
  console.log('- electronAPI:', !!window.electronAPI);
  console.log('- fs:', !!window.fs);
  console.log('- imageUtils:', !!window.imageUtils);
  console.log('- platform:', !!window.platform);
  console.log('- storage:', !!window.storage);
});