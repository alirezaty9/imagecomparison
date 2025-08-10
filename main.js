import { app, BrowserWindow, ipcMain, Menu, dialog, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import os from 'os';

// تعیین مسیر فعلی (برای ES Modules)
const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);

let mainWindow = null;

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
      webSecurity: false, // فقط برای development - در production true کنید
    },
  });

  const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';

  
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools(); // برای دیباگ
  } else {
    mainWindow.loadFile(path.join(currentDir, 'dist', 'index.html'));
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev) {
      mainWindow.focus();
    }
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// Create application menu
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
              filters: [
                { 
                  name: 'تصاویر', 
                  extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff'] 
                }
              ]
            });

            if (!result.canceled) {
              mainWindow.webContents.send('files-selected', result.filePaths);
            }
          }
        },
        { type: 'separator' },
        {
          label: 'خروج',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'ویرایش',
      submenu: [
        { label: 'برگشت', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: 'تکرار', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
        { type: 'separator' },
        { label: 'برش', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: 'کپی', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: 'چسباندن', accelerator: 'CmdOrCtrl+V', role: 'paste' }
      ]
    },
    {
      label: 'نمایش',
      submenu: [
        { label: 'بازخوانی', accelerator: 'CmdOrCtrl+R', role: 'reload' },
        { label: 'بازخوانی اجباری', accelerator: 'CmdOrCtrl+Shift+R', role: 'forceReload' },
        { label: 'ابزار توسعه‌دهندگان', accelerator: 'F12', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: 'بزرگنمایی واقعی', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
        { label: 'بزرگنمایی', accelerator: 'CmdOrCtrl+Plus', role: 'zoomIn' },
        { label: 'کوچکنمایی', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { type: 'separator' },
        { label: 'تمام صفحه', accelerator: 'F11', role: 'togglefullscreen' }
      ]
    },
    {
      label: 'راهنما',
      submenu: [
        {
          label: 'درباره اپلیکیشن',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'درباره مقایسه‌گر تصاویر',
              message: 'مقایسه‌گر تصاویر',
              detail: 'نسخه 1.0.0\nساخته شده با Electron و React\n\nاین اپلیکیشن برای مقایسه تصاویر و تشخیص میزان شباهت آنها طراحی شده است.',
              buttons: ['تایید']
            });
          }
        }
      ]
    }
  ];

  // macOS specific menu adjustments
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        { label: 'درباره ' + app.getName(), role: 'about' },
        { type: 'separator' },
        { label: 'خدمات', role: 'services', submenu: [] },
        { type: 'separator' },
        { label: 'مخفی کردن ' + app.getName(), accelerator: 'Command+H', role: 'hide' },
        { label: 'مخفی کردن سایرین', accelerator: 'Command+Shift+H', role: 'hideothers' },
        { label: 'نمایش همه', role: 'unhide' },
        { type: 'separator' },
        { label: 'خروج', accelerator: 'Command+Q', click: () => app.quit() }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC handlers for image comparison app

// ساخت فایل (از کد قبلی شما)
ipcMain.handle('create-file', async (event, fileName, content) => {
  try {
    const desktopPath = path.join(os.homedir(), 'Desktop');
    const filePath = path.join(desktopPath, fileName);
    await fs.promises.writeFile(filePath, content, 'utf8');
    return { success: true, message: `فایل ساخته شد: ${filePath}`, path: filePath };
  } catch (error) {
    return { success: false, message: `خطا: ${error.message}`, error: error.message };
  }
});

// خواندن فایل
ipcMain.handle('read-file', async (event, filePath) => {
  try {
    const data = await fs.promises.readFile(filePath);
    return { success: true, data: data };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ذخیره فایل با dialog
ipcMain.handle('save-file-dialog', async (event, data, filters = []) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      filters: filters.length > 0 ? filters : [
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'Text Files', extensions: ['txt'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (!result.canceled) {
      await fs.promises.writeFile(result.filePath, data);
      return { success: true, path: result.filePath };
    }
    
    return { success: false, canceled: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// انتخاب فایل‌های تصویری
ipcMain.handle('select-image-files', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
      filters: [
        { 
          name: 'تصاویر', 
          extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff'] 
        },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (!result.canceled) {
      // خواندن فایل‌ها و تبدیل به base64
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

// مقایسه تصاویر (برای اتصال به backend شما)
ipcMain.handle('compare-images', async (event, imageData) => {
  try {
    // اینجا باید API backend خودتان را فراخوانی کنید
    // مثال:
    // const response = await fetch('http://your-backend:8000/compare', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(imageData)
    // });
    // const result = await response.json();
    
    // فعلاً mock data برمی‌گردانیم
    const mockResult = {
      success: true,
      comparisons: imageData.map((img, index) => ({
        imageId: index,
        imageName: img.name || `Image ${index + 1}`,
        similarities: [
          { targetImage: 'Reference Image 1', percentage: Math.floor(Math.random() * 100) },
          { targetImage: 'Reference Image 2', percentage: Math.floor(Math.random() * 100) },
          { targetImage: 'Reference Image 3', percentage: Math.floor(Math.random() * 100) }
        ].sort((a, b) => b.percentage - a.percentage)
      }))
    };

    return mockResult;
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// دریافت اطلاعات سیستم
ipcMain.handle('get-system-info', async () => {
  try {
    return {
      success: true,
      info: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.versions.node,
        electronVersion: process.versions.electron,
        chromeVersion: process.versions.chrome,
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        cpus: os.cpus().length,
        homedir: os.homedir(),
        tmpdir: os.tmpdir()
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// باز کردن پوشه در explorer/finder
ipcMain.handle('show-item-in-folder', async (event, fullPath) => {
  try {
    shell.showItemInFolder(fullPath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// باز کردن URL در مرورگر خارجی
ipcMain.handle('open-external', async (event, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// راه‌اندازی برنامه
app.whenReady().then(() => {
  createWindow();
  createMenu();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
});