const { contextBridge, ipcRenderer } = require('electron');

const electronAPI = {
  // Token Operations
  checkTokenStatus: () => ipcRenderer.invoke('check-token-status'),
  verifyToken: (options) => ipcRenderer.invoke('verify-token', options),
  
  // Legacy Support
  checkHardwareToken: (vendorId, productId) => ipcRenderer.invoke('check-token-status'),
  requestTokenAccess: (vendorId, productId) => ipcRenderer.invoke('verify-token'),
  signAndVerifyFile: (options) => ipcRenderer.invoke('verify-token', options),

  // File Operations
  createFile: (fileName, content) => ipcRenderer.invoke('create-file', fileName, content),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  selectImageFiles: () => ipcRenderer.invoke('select-image-files'),
  compareImages: (imageData) => ipcRenderer.invoke('compare-images', imageData),

  // System Operations
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
  showItemInFolder: (fullPath) => ipcRenderer.invoke('show-item-in-folder', fullPath),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  // Command Execution
  runTest123Command: (args) => ipcRenderer.invoke('run-test123-command', args),

  // Network Operations
  apiRequest: (options) => ipcRenderer.invoke('api-request', options),

  // Event Listeners
  onTokenVerificationResult: (callback) => {
    const handler = (event, ...args) => callback(event, ...args);
    ipcRenderer.on('token-verification-result', handler);
    return () => ipcRenderer.removeListener('token-verification-result', handler);
  },

  // Legacy Event Listeners
  onTokenConnected: (callback) => {
    const handler = (event, ...args) => callback(event, ...args);
    ipcRenderer.on('token-verification-result', (event, result) => {
      if (result.success) {
        callback(event, { connected: true, timestamp: new Date() });
      }
    });
    return () => ipcRenderer.removeListener('token-verification-result', handler);
  },
  
  onTokenDisconnected: (callback) => {
    const handler = (event, ...args) => callback(event, ...args);
    ipcRenderer.on('token-verification-result', (event, result) => {
      if (!result.success) {
        callback(event, { connected: false, timestamp: new Date() });
      }
    });
    return () => ipcRenderer.removeListener('token-verification-result', handler);
  },

  onFileSignResult: (callback) => {
    const handler = (event, ...args) => callback(event, ...args);
    ipcRenderer.on('token-verification-result', handler);
    return () => ipcRenderer.removeListener('token-verification-result', handler);
  },
  
  onFilesSelected: (callback) => {
    const handler = (event, ...args) => callback(event, ...args);
    ipcRenderer.on('files-selected', handler);
    return () => ipcRenderer.removeListener('files-selected', handler);
  },
  
  onCommandLog: (callback) => {
    const handler = (event, ...args) => callback(event, ...args);
    ipcRenderer.on('command-log', handler);
    return () => ipcRenderer.removeListener('command-log', handler);
  },

  // Utility
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
};

// Network Wrapper
const electronFetch = async (url, options = {}) => {
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
        statusText: result.status >= 200 && result.status < 300 ? 'OK' : 'Error',
        headers: result.headers,
        json: async () => result.data,
        text: async () => typeof result.data === 'string' ? result.data : JSON.stringify(result.data),
        blob: async () => new Blob([JSON.stringify(result.data)], { type: 'application/json' })
      };
    } else {
      throw new Error(result.error || 'Network request failed');
    }
  } catch (error) {
    console.error('Network request failed:', error.message);
    throw error;
  }
};

// File System API
const fileSystemAPI = {
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
          reader.onerror = () => reject(new Error('File reading failed'));
          
          if (options.encoding === 'utf8') {
            reader.readAsText(fileName);
          } else {
            reader.readAsArrayBuffer(fileName);
          }
        });
      }
      
      if (typeof fileName === 'string') {
        const result = await electronAPI.readFile(fileName);
        if (result.success) {
          if (options.encoding === 'utf8') {
            return Buffer.from(result.data).toString('utf8');
          } else {
            return new Uint8Array(result.data);
          }
        } else {
          throw new Error(result.error);
        }
      }
      
      throw new Error('Invalid file parameter');
    } catch (error) {
      console.error('File system error:', error.message);
      throw error;
    }
  },

  writeFile: async (fileName, content) => {
    try {
      const result = await electronAPI.createFile(fileName, content);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result;
    } catch (error) {
      console.error('File write error:', error.message);
      throw error;
    }
  }
};

// Image Utilities
const imageUtilities = {
  fileToBase64: (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Base64 conversion failed'));
      reader.readAsDataURL(file);
    });
  },
  
  getImageDimensions: (imageSrc) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ 
        width: img.width, 
        height: img.height,
        aspectRatio: img.width / img.height
      });
      img.onerror = () => reject(new Error('Image dimensions calculation failed'));
      img.src = imageSrc;
    });
  },
  
  validateImageFile: (file) => {
    const validTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 
      'image/bmp', 'image/webp', 'image/tiff', 'image/svg+xml'
    ];
    const maxSize = 50 * 1024 * 1024;
    
    return {
      isValid: validTypes.includes(file.type) && file.size <= maxSize,
      type: file.type,
      size: file.size,
      sizeInMB: (file.size / (1024 * 1024)).toFixed(2),
      name: file.name,
      maxSizeExceeded: file.size > maxSize,
      unsupportedType: !validTypes.includes(file.type)
    };
  }
};

// Storage Utilities
const storageUtilities = {
  set: (key, value) => {
    try {
      const serialized = JSON.stringify({ value, timestamp: Date.now(), type: typeof value });
      localStorage.setItem(key, serialized);
      return true;
    } catch (error) {
      console.error('Storage set error:', error.message);
      return false;
    }
  },
  
  get: (key, defaultValue = null) => {
    try {
      const item = localStorage.getItem(key);
      if (!item) return defaultValue;
      
      const parsed = JSON.parse(item);
      return parsed.value;
    } catch (error) {
      console.error('Storage get error:', error.message);
      return defaultValue;
    }
  },
  
  remove: (key) => {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('Storage remove error:', error.message);
      return false;
    }
  },
  
  clear: () => {
    try {
      localStorage.clear();
      return true;
    } catch (error) {
      console.error('Storage clear error:', error.message);
      return false;
    }
  }
};

// Expose APIs
contextBridge.exposeInMainWorld('electronAPI', electronAPI);
contextBridge.exposeInMainWorld('electronFetch', electronFetch);
contextBridge.exposeInMainWorld('fs', fileSystemAPI);
contextBridge.exposeInMainWorld('imageUtils', imageUtilities);
contextBridge.exposeInMainWorld('storage', storageUtilities);