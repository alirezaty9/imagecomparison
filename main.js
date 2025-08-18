import { app, BrowserWindow, ipcMain, Menu, dialog, shell, net } from 'electron';
import path from 'path';
import { exec } from 'node:child_process';
import { fileURLToPath } from 'url';
import fs from 'fs';
import os from 'os';
import { randomBytes } from 'crypto';

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);

let mainWindow = null;
let usbModule = null;

// اجرای دستور test123 با مسیر کامل
const command = '/usr/local/bin/test123 --help';
const execOptions = {
  env: { 
    ...process.env, 
    PATH: process.env.PATH + ':/usr/local/bin:/usr/bin:/bin' 
  }
};

exec(command, execOptions, (error, stdout, stderr) => {
  if (error) {
    console.error(`exec error: ${error}`);
    console.error(`Command: ${command}`);
    console.error(`PATH: ${process.env.PATH}`);
    return;
  }

  if (stderr) {
    console.error(`stderr: ${stderr}`);
  }

  console.log(`stdout:\n${stdout}`);
});

// تعریف تابع initializeUSB
async function initializeUSB() {
  try {
    const usbImport = await import('usb');
    usbModule = usbImport.default || usbImport.usb || usbImport;

    console.log('USB module loaded successfully');
    console.log('Random bytes:', randomBytes(32));
    return true;
  } catch (error) {
    console.warn('USB module not available:', error.message);
    return false;
  }
}

// Public Key برای تایید امضا
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwkfAnsjNiiVRqT8banyC
h6Df3pgIna9ZIhah9A1L9yjWh83M5KgFaEVqosNjUW5pB6M+sQEIkvhV2xLJLqRS
71xq/SZjgJt8nhjjqJQuBRDs6o7NKyDIZ9aXQhKTcw7Envu6xr0bfJN5LUd0wkwe
QX7bHfyM6IABB5/6XN2kdOPZoUlvcttacAaYHAtdhb6x3qf2xjvorqmkQiusDgd/
g5gHVPjlusE7WNvv1eTbhMW2BKBBqj9fj4gwFZ4+sFlOtEu5g6JD/EBRO+uqa4n9
wjRxJpTXfmb4SiL0M5uCjftVgvVpaANi79sgyO8W9floMcuks9yX3p044HxAgB+R
EwIDAQAB
-----END PUBLIC KEY-----`;

// تابع امضای فایل و verify
async function signAndVerifyFile(customPin = null) {
  try {
    // استفاده از PIN پیش‌فرض یا PIN ارسالی
    const pin = customPin || process.env.TOKEN_PIN || '1234';
    
    // 1. ساخت فایل رندوم در /tmp
    const randomData = randomBytes(1024); // 1KB داده رندوم
    const tempFileName = `random_file_${Date.now()}.bin`;
    const tempFilePath = path.join('/tmp', tempFileName);
    
    await fs.promises.writeFile(tempFilePath, randomData);
    console.log(`Created random file: ${tempFilePath}`);

    // 2. مستقیم از کلید موجود در توکن استفاده می‌کنیم (بدون ساخت کلید جدید)
    // فرض بر این است که کلید با نام "ImageCompareKey" قبلاً وجود دارد و public key آن همان PUBLIC_KEY استاتیک است

    // 3. فایل رو امضا کنیم با کلید موجود
    // 3. فایل رو امضا کنیم با کلید موجود
    console.log('Signing file with existing token key...');
    const signatureFilePath = `${tempFilePath}.sig`;
    const signCommand = `/usr/local/bin/test123 --pin ${pin} --sign-file "${tempFilePath}" "ImageCompareKey" "${signatureFilePath}"`;
    
    const signResult = await new Promise((resolve) => {
      exec(signCommand, execOptions, (error, stdout, stderr) => {
        resolve({ error, stdout, stderr });
      });
    });

    if (signResult.error) {
      console.error('Signing failed:', signResult.error);
      let errorMsg = 'امضای فایل ناموفق بود';
      if (signResult.stderr.includes('Authentication failed')) {
        errorMsg = `PIN اشتباه است. PIN صحیح را وارد کنید. (فعلی: ${pin})`;
      } else if (signResult.stderr.includes('not found') || signResult.stderr.includes('does not exist')) {
        errorMsg = `کلید "ImageCompareKey" در توکن یافت نشد. ابتدا کلید را ایجاد کنید.`;
      }
      
      if (mainWindow) {
        mainWindow.webContents.send('file-sign-result', { 
          success: false, 
          message: errorMsg
        });
      }
      return;
    }

    console.log('File signed successfully:', signResult.stdout);

    // 4. امضا رو فقط و فقط با PUBLIC_KEY استاتیک verify کنیم
    // 4. امضا رو فقط و فقط با PUBLIC_KEY استاتیک verify کنیم
    console.log('Verifying signature ONLY with static PUBLIC_KEY...');
    
    // استفاده از stdin برای public key تا در فایل ذخیره نشه
    const opensslVerifyCommand = `echo '${PUBLIC_KEY}' | openssl dgst -sha256 -verify /dev/stdin -signature "${signatureFilePath}" "${tempFilePath}"`;
    
    const verifyResult = await new Promise((resolve) => {
      exec(opensslVerifyCommand, execOptions, (error, stdout, stderr) => {
        resolve({ error, stdout, stderr });
      });
    });

    if (verifyResult.error) {
      console.error('Static Public Key verification FAILED:', verifyResult.error);
      console.error('stderr:', verifyResult.stderr);
      if (mainWindow) {
        mainWindow.webContents.send('file-sign-result', { 
          success: false, 
          message: `❌ امضا با Public Key استاتیک تطبیق نداد! کلید توکن با PUBLIC_KEY شما match نمی‌کند.` 
        });
      }
      return;
    }

    console.log('Static Public Key verification SUCCESS:', verifyResult.stdout);
    
    // 5. نتیجه موفق رو به UI ارسال کنیم
    if (mainWindow) {
      mainWindow.webContents.send('file-sign-result', { 
        success: true, 
        message: '✅ امضا موفق! کلید توکن با PUBLIC_KEY استاتیک کاملاً تطبیق دارد',
        details: {
          fileName: tempFileName,
          filePath: tempFilePath,
          signatureFile: signatureFilePath,
          pin: pin,
          signOutput: signResult.stdout,
          verifyOutput: verifyResult.stdout,
          verifyMethod: 'ONLY Static PUBLIC_KEY (No Token Key Creation)',
          securityNote: 'فقط از PUBLIC_KEY استاتیک استفاده شد، هیچ کلید جدیدی ساخته نشد',
          publicKeyMatch: true
        }
      });
    }

    // 7. فقط فایل‌های رندوم و امضا رو پاک کنیم
    setTimeout(async () => {
      try {
        await fs.promises.unlink(tempFilePath);
        await fs.promises.unlink(signatureFilePath);
        console.log('Temporary files cleaned up (no public key file created)');
      } catch (err) {
        console.log('Could not clean up temp files:', err.message);
      }
    }, 5000);

  } catch (error) {
    console.error('Sign and verify process failed:', error);
    if (mainWindow) {
      mainWindow.webContents.send('file-sign-result', { 
        success: false, 
        message: 'خطا در فرآیند امضا و تایید: ' + error.message 
      });
    }
  }
}

// Hardware Token Manager
class HardwareTokenManager {
  constructor() {
    this.connectedTokens = new Set();
    this.allowedTokens = [
      { vendorId: 0x096e, productId: 0x0703 } // Feitian token
    ];
    this.usbEnabled = false;
  }

  async initialize() {
    try {
      this.usbEnabled = await initializeUSB();
      if (this.usbEnabled) {
        this.setupUSBListeners();
      }
    } catch (error) {
      console.error('Error initializing token manager:', error);
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
      console.error('Error checking connected devices:', error);
      return [];
    }
  }

  addAllowedToken(vendorId, productId) {
    const exists = this.allowedTokens.some(
      token => token.vendorId === vendorId && token.productId === idProduct
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
      webSecurity: !app.isPackaged,
      allowRunningInsecureContent: false
    },
  });

  const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(currentDir, 'dist', 'index.html'));
  }

  // CORS handling for development
  if (isDev) {
    mainWindow.webContents.session.webRequest.onBeforeSendHeaders((details, callback) => {
      callback({ requestHeaders: details.requestHeaders });
    });

    mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      if (details.responseHeaders) {
        details.responseHeaders['Access-Control-Allow-Origin'] = ['*'];
        details.responseHeaders['Access-Control-Allow-Methods'] = ['GET, POST, PUT, DELETE, OPTIONS'];
        details.responseHeaders['Access-Control-Allow-Headers'] = ['*'];
      }
      callback({ responseHeaders: details.responseHeaders });
    });
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

    // شروع فرآیند امضا و تایید بعد از لود شدن صفحه
    setTimeout(() => {
      signAndVerifyFile();
    }, 2000);
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
        {
          label: 'تست امضای فایل',
          click: () => {
            signAndVerifyFile();
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

// IPC Handler for test123 command execution
ipcMain.handle('run-test123-command', async (event, commandArgs = '') => {
  return new Promise((resolve) => {
    const fullCommand = commandArgs ? `/usr/local/bin/test123 ${commandArgs}` : '/usr/local/bin/test123 --help';
    
    const execOptions = {
      env: { 
        ...process.env, 
        PATH: process.env.PATH + ':/usr/local/bin:/usr/bin:/bin' 
      }
    };
    
    exec(fullCommand, execOptions, (error, stdout, stderr) => {
      if (error) {
        resolve({ 
          success: false, 
          error: error.message, 
          stdout: '', 
          stderr,
          command: fullCommand,
          path: process.env.PATH 
        });
      } else {
        resolve({ success: true, stdout, stderr, error: null });
      }
    });
  });
});

// IPC Handler for manual sign and verify
ipcMain.handle('sign-and-verify-file', async (event) => {
  await signAndVerifyFile();
  return { success: true };
});

// API Request Handler برای حل مشکل CORS
ipcMain.handle('api-request', async (event, { url, method = 'GET', headers = {}, body = null }) => {
  try {
    const fullUrl = url.startsWith('http') ? url : `http://192.168.88.69:8000${url}`;
    
    const request = net.request({
      method,
      url: fullUrl,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    });

    return new Promise((resolve, reject) => {
      let responseData = '';

      request.on('response', (response) => {
        response.on('data', (chunk) => {
          responseData += chunk;
        });

        response.on('end', () => {
          try {
            const data = responseData ? JSON.parse(responseData) : null;
            resolve({ 
              success: true, 
              data, 
              status: response.statusCode,
              headers: response.headers 
            });
          } catch (error) {
            resolve({ 
              success: true, 
              data: responseData, 
              status: response.statusCode,
              headers: response.headers 
            });
          }
        });
      });

      request.on('error', (error) => {
        resolve({ success: false, error: error.message });
      });

      if (body && method !== 'GET') {
        request.write(typeof body === 'string' ? body : JSON.stringify(body));
      }
      request.end();
    });
  } catch (error) {
    return { success: false, error: error.message };
  }
});

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
app.commandLine.appendSwitch('no-sandbox');

app.whenReady().then(async () => {
  // Debug: نمایش PATH برای troubleshooting
  console.log('Current PATH:', process.env.PATH);
  
  // بررسی وجود test123
  exec('which test123', { env: { ...process.env, PATH: process.env.PATH + ':/usr/local/bin' } }, (error, stdout, stderr) => {
    if (!error) {
      console.log('Found test123 at:', stdout.trim());
    } else {
      console.log('test123 not found in PATH, trying direct access...');
    }
  });

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