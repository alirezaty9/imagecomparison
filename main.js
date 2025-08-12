import { app, BrowserWindow, ipcMain, Menu, dialog, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import os from 'os';

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);

let mainWindow = null;
let usbModule = null;

// USB module initialization
async function initializeUSB() {
  try {
    const usbImport = await import('usb');
    usbModule = usbImport.default || usbImport.usb || usbImport;
    console.log('USB module loaded successfully');
    return true;
  } catch (error) {
    console.warn('USB module not available');
    return false;
  }
}

// Hardware Token Manager (ساده شده)
class HardwareTokenManager {
  constructor() {
    this.connectedTokens = new Set();
    this.allowedTokens = [
      { vendorId: 0x096e, productId: 0x0703 } // Feitian token
    ];
    this.usbEnabled = false;
  }

  async initialize() {
    this.usbEnabled = await initializeUSB();
    if (this.usbEnabled) {
      this.setupUSBListeners();
    }
  }

  setupUSBListeners() {
    if (!this.usbEnabled || !usbModule) return;

    try {
      const usb = usbModule.usb || usbModule;
      
      if (typeof usb.on === 'function') {
        usb.on('attach', (device) => this.handleDeviceConnect(device));
        usb.on('detach', (device) => this.handleDeviceDisconnect(device));
      }
    } catch (error) {
      console.error('Error setting up USB listeners:', error);
    }
  }

  handleDeviceConnect(device) {
    const { idVendor, idProduct } = device.deviceDescriptor;
    const isAllowed = this.allowedTokens.some(
      token => token.vendorId === idVendor && token.productId === idProduct
    );

    if (isAllowed) {
      this.connectedTokens.add(`${idVendor}:${idProduct}`);
      if (mainWindow) {
        mainWindow.webContents.send('token-connected', { vendorId: idVendor, productId: idProduct });
      }
    }
  }

  handleDeviceDisconnect(device) {
    const { idVendor, idProduct } = device.deviceDescriptor;
    const tokenKey = `${idVendor}:${idProduct}`;
    
    if (this.connectedTokens.has(tokenKey)) {
      this.connectedTokens.delete(tokenKey);
      if (mainWindow) {
        mainWindow.webContents.send('token-disconnected', { vendorId: idVendor, productId: idProduct });
      }
    }
  }

  isTokenConnected(vendorId, productId) {
    return this.connectedTokens.has(`${vendorId}:${productId}`);
  }

  checkAllConnectedDevices() {
    if (!this.usbEnabled || !usbModule) return [];

    try {
      const usb = usbModule.usb || usbModule;
      const devices = usb.getDeviceList();
      const connectedTokens = [];

      devices.forEach(device => {
        const { idVendor, idProduct } = device.deviceDescriptor;
        const isAllowed = this.allowedTokens.some(
          token => token.vendorId === idVendor && token.productId === idProduct
        );

        if (isAllowed) {
          this.connectedTokens.add(`${idVendor}:${idProduct}`);
          connectedTokens.push({ vendorId: idVendor, productId: idProduct });
        }
      });

      return connectedTokens;
    } catch (error) {
      return [];
    }
  }

  addAllowedToken(vendorId, productId) {
    const exists = this.allowedTokens.some(
      token => token.vendorId === vendorId && token.productId === productId
    );
    if (!exists) {
      this.allowedTokens.push({ vendorId, productId });
    }
  }
}

const tokenManager = new HardwareTokenManager();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    icon: path.join(currentDir, 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(currentDir, 'preload.js'),
      webSecurity: true,
      allowRunningInsecureContent: false
    },
  });

  const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    // mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(currentDir, 'dist', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev) mainWindow.focus();

    // Initial token check
    setTimeout(() => {
      const connectedTokens = tokenManager.checkAllConnectedDevices();
      if (connectedTokens.length > 0) {
        mainWindow.webContents.send('token-connected', connectedTokens[0]);
      }
    }, 1000);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Menu
function createMenu() {
  const template = [
    {
      label: 'فایل',
      submenu: [
        {
          label: 'باز کردن تصویر...',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ['openFile', 'multiSelections'],
              filters: [{ name: 'تصاویر', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff'] }]
            });
            if (!result.canceled) {
              mainWindow.webContents.send('files-selected', result.filePaths);
            }
          }
        },
        { type: 'separator' },
        { label: 'خروج', accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q', click: () => app.quit() }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC Handlers
ipcMain.handle('check-hardware-token', async (event, vendorId, productId) => {
  try {
    const isConnected = tokenManager.isTokenConnected(vendorId, productId);
    return { success: true, connected: isConnected };
  } catch (error) {
    return { success: false, error: error.message, connected: false };
  }
});

ipcMain.handle('request-token-access', async (event, vendorId, productId) => {
  try {
    tokenManager.addAllowedToken(vendorId, productId);
    const connectedTokens = tokenManager.checkAllConnectedDevices();
    const isConnected = tokenManager.isTokenConnected(vendorId, productId);
    return { success: true, connected: isConnected };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Image operations
ipcMain.handle('select-image-files', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'تصاویر', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff'] }]
    });

    if (!result.canceled) {
      const fileData = await Promise.all(
        result.filePaths.map(async (filePath) => {
          const data = await fs.promises.readFile(filePath);
          const stats = await fs.promises.stat(filePath);
          return {
            path: filePath,
            name: path.basename(filePath),
            size: stats.size,
            data: data.toString('base64'),
            mimeType: `image/${path.extname(filePath).slice(1)}`
          };
        })
      );
      return { success: true, files: fileData };
    }
    return { success: false, canceled: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('compare-images', async (event, imageData) => {
  // Mock data - replace with your backend API
  const mockResult = {
    success: true,
    comparisons: imageData.map((img, index) => ({
      imageId: index,
      imageName: img.name || `Image ${index + 1}`,
      similarities: [
        { targetImage: 'Reference 1', percentage: Math.floor(Math.random() * 100) },
        { targetImage: 'Reference 2', percentage: Math.floor(Math.random() * 100) }
      ].sort((a, b) => b.percentage - a.percentage)
    }))
  };
  return mockResult;
});

// File operations
ipcMain.handle('create-file', async (event, fileName, content) => {
  try {
    const filePath = path.join(os.homedir(), 'Desktop', fileName);
    await fs.promises.writeFile(filePath, content, 'utf8');
    return { success: true, path: filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('read-file', async (event, filePath) => {
  try {
    const data = await fs.promises.readFile(filePath);
    return { success: true, data: data };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// System
ipcMain.handle('get-system-info', async () => {
  return {
    success: true,
    info: {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.versions.node,
      electronVersion: process.versions.electron
    }
  };
});

ipcMain.handle('show-item-in-folder', async (event, fullPath) => {
  try {
    shell.showItemInFolder(fullPath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('open-external', async (event, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// App initialization
// Disable sandbox for Linux compatibility
app.commandLine.appendSwitch('no-sandbox');

app.whenReady().then(async () => {
  await tokenManager.initialize();
  createWindow();
  createMenu();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});