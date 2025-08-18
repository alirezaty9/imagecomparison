const { contextBridge, ipcRenderer } = require('electron');

console.log('Preload script loaded');

// فقط API های ضروری
const electronAPI = {
  // File operations
  createFile: (fileName, content) => ipcRenderer.invoke('create-file', fileName, content),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  saveFileDialog: (data, filters) => ipcRenderer.invoke('save-file-dialog', data, filters),
  
  // Image operations
  selectImageFiles: () => ipcRenderer.invoke('select-image-files'),
  compareImages: (imageData) => ipcRenderer.invoke('compare-images', imageData),
  
  // System
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
  showItemInFolder: (fullPath) => ipcRenderer.invoke('show-item-in-folder', fullPath),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  // Hardware Token (فقط برای TokenGuard)
  checkHardwareToken: (vendorId, productId) => ipcRenderer.invoke('check-hardware-token', vendorId, productId),
  requestTokenAccess: (vendorId, productId) => ipcRenderer.invoke('request-token-access', vendorId, productId),
  
  // API Request Handler - برای حل مشکل CORS
  apiRequest: (options) => ipcRenderer.invoke('api-request', options),
  
  // Event listeners
  onFilesSelected: (callback) => ipcRenderer.on('files-selected', callback),
  onTokenConnected: (callback) => ipcRenderer.on('token-connected', callback),
  onTokenDisconnected: (callback) => ipcRenderer.on('token-disconnected', callback),
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
};

// Expose to window
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Enhanced fetch wrapper که از electronAPI استفاده می‌کند
contextBridge.exposeInMainWorld('electronFetch', async (url, options = {}) => {
  try {
    const result = await electronAPI.apiRequest({
      url,
      method: options.method || 'GET',
      headers: options.headers || {},
      body: options.body || null
    });

    if (result.success) {
      return {
        ok: result.status >= 200 && result.status < 300,
        status: result.status,
        headers: result.headers,
        json: async () => result.data,
        text: async () => typeof result.data === 'string' ? result.data : JSON.stringify(result.data)
      };
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    throw error;
  }
});

// File system API
contextBridge.exposeInMainWorld('fs', {
  readFile: async (fileName, options = {}) => {
    try {
      if (fileName && typeof fileName === 'object' && fileName.name) {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            if (options.encoding === 'utf8') {
              resolve(reader.result);
            } else {
              resolve(new Uint8Array(reader.result));
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
      throw error;
    }
  }
});

// Image utilities
contextBridge.exposeInMainWorld('imageUtils', {
  fileToBase64: (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },
  
  getImageDimensions: (imageSrc) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.width, height: img.height });
      img.onerror = reject;
      img.src = imageSrc;
    });
  },
  
  validateImageFile: (file) => {
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

// Storage utilities
contextBridge.exposeInMainWorld('storage', {
  set: (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      return false;
    }
  },
  
  get: (key, defaultValue = null) => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      return defaultValue;
    }
  },
  
  remove: (key) => {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      return false;
    }
  },
  
  clear: () => {
    try {
      localStorage.clear();
      return true;
    } catch (error) {
      return false;
    }
  }
});

console.log('APIs exposed successfully');