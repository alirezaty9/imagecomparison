import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  dialog,
  shell,
  net,
} from "electron";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import os from "os";
import { randomBytes, createVerify } from "crypto";
import * as graphene from "graphene-pk11";

// ====================================================================
// SECTION 1: SETUP & CONFIGURATION
// ====================================================================

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
let mainWindow = null;

// تشخیص مسیر درایور بر اساس پلتفرم
const getDriverPath = () => {
  switch (process.platform) {
    case "win32":
      // مسیرهای محتمل برای ویندوز
      return [
        "C:\\Windows\\System32\\shuttle_p11.dll",
        "C:\\Program Files\\ShuttleCSP\\shuttle_p11.dll",
        "C:\\Program Files (x86)\\ShuttleCSP\\shuttle_p11.dll",
      ];
   // main.js

case "linux":
  return [
    // مسیر جدید را در ابتدا اضافه کنید
    path.join(currentDir, "Token", "lib", "libshuttle_p11v220.so.1.0.0"),
    "/usr/local/lib/libshuttle_p11v220.so",
    "/usr/lib/libshuttle_p11v220.so",
    "/lib/libshuttle_p11v220.so",
  ];
    case "darwin": // macOS
      return [
        "/usr/local/lib/libshuttle_p11v220.dylib",
        "/Library/Frameworks/ShuttleCSP.framework/ShuttleCSP",
      ];
    default:
      return [];
  }
};

const CONFIG = {
  DRIVER_PATHS: getDriverPath(),
  PUBLIC_KEY: `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwkfAnsjNiiVRqT8banyC
h6Df3pgIna9ZIhah9A1L9yjWh83M5KgFaEVqosNjUW5pB6M+sQEIkvhV2xLJLqRS
71xq/SZjgJt8nhjjqJQuBRDs6o7NKyDIZ9aXQhKTcw7Envu6xr0bfJN5LUd0wkwe
QX7bHfyM6IABB5/6XN2kdOPZoUlvcttacAaYHAtdhb6x3qf2xjvorqmkQiusDgd/
g5gHVPjlusE7WNvv1eTbhMW2BKBBqj9fj4gwFZ4+sFlOtEu5g6JD/EBRO+uqa4n9
wjRxJpTXfmb4SiL0M5uCjftVgvVpaANi79sgyO8W9floMcuks9yX3p044HxAgB+R
EwIDAQAB
-----END PUBLIC KEY-----`,

  KEY_LABEL: "ImageCompareKey",
  DEFAULT_PIN: process.env.TOKEN_PIN || "1234",
  SIGNATURE_MECHANISM: "SHA256_RSA_PKCS", // مکانیزم امضا
};

// ====================================================================
// SECTION 2: ENHANCED PKCS#11 TOKEN MANAGER CLASS
// ====================================================================

class Pkcs11TokenManager {
  constructor() {
    this.lastVerification = null;
    this.availableDriverPath = null;
    this.isInitialized = false;
  }

  // یافتن درایور موجود در سیستم
  async findAvailableDriver() {
    for (const driverPath of CONFIG.DRIVER_PATHS) {
      try {
        await fs.access(driverPath);
        console.log(`درایور یافت شد: ${driverPath}`);
        this.availableDriverPath = driverPath;
        return driverPath;
      } catch (error) {
        console.log(`درایور یافت نشد: ${driverPath}`);
      }
    }
    throw new Error("هیچ درایور PKCS#11 معتبری در سیستم یافت نشد");
  }

  // اولیه سازی ماژول
  async initialize() {
    if (this.isInitialized) return;

    if (!this.availableDriverPath) {
      await this.findAvailableDriver();
    }

    this.isInitialized = true;
    console.log("PKCS#11 Manager آماده شد");
  }

  // لیست کردن اسلات‌های موجود (برای دیباگ)
  async listAvailableSlots() {
    let mod = null;
    try {
      mod = graphene.Module.load(this.availableDriverPath, "ShuttlePKCS11");
      mod.initialize();

      const slots = mod.getSlots(true); // فقط اسلات‌هایی با توکن
      const slotInfo = [];

      for (let i = 0; i < slots.length; i++) {
        const slot = slots.items(i);
        const token = slot.getToken();
        slotInfo.push({
          slotId: slot.handle,
          description: slot.slotDescription,
          tokenLabel: token.label,
          tokenPresent: slot.flags & graphene.SlotFlag.TOKEN_PRESENT,
        });
      }

      return slotInfo;
    } catch (error) {
      console.error("خطا در لیست کردن اسلات‌ها:", error);
      return [];
    } finally {
      if (mod) {
        try {
          mod.finalize();
        } catch (e) {
          /* ignore */
        }
      }
    }
  }

  // یافتن کلید بر اساس برچسب
  async findPrivateKeyByLabel(session, label) {
    const objects = session.find({
      class: graphene.ObjectClass.PRIVATE_KEY,
      label: label,
    });

    if (objects.length === 0) {
      // تلاش برای یافتن با معیارهای مختلف
      const allPrivateKeys = session.find({
        class: graphene.ObjectClass.PRIVATE_KEY,
      });

      console.log(`تعداد کلیدهای خصوصی یافت شده: ${allPrivateKeys.length}`);

      if (allPrivateKeys.length > 0) {
        // استفاده از اولین کلید موجود
        console.log("استفاده از اولین کلید خصوصی موجود");
        return allPrivateKeys.items(0);
      }

      throw new Error(`کلید خصوصی با برچسب "${label}" یافت نشد`);
    }

    return objects.items(0);
  }

  async performTokenVerification(customPin = null) {
    let session = null;
    let mod = null;

    try {
      // اطمینان از اولیه سازی
      await this.initialize();

      console.log("شروع تایید توکن...");

      // بارگذاری ماژول
      mod = graphene.Module.load(this.availableDriverPath, "ShuttlePKCS11");
      mod.initialize();
      console.log("ماژول PKCS#11 بارگذاری شد");

      // یافتن اسلات با توکن
      const slots = mod.getSlots(true); // فقط اسلات‌های با توکن
      if (slots.length === 0) {
        throw new Error("هیچ توکنی یافت نشد. لطفاً توکن را متصل کنید.");
      }

      const slot = slots.items(0); // استفاده از اولین اسلات
      console.log(`استفاده از اسلات: ${slot.slotDescription}`);

      // باز کردن نشست
      session = slot.open(
        graphene.SessionFlag.RW_SESSION | graphene.SessionFlag.SERIAL_SESSION
      );
      console.log("نشست باز شد");

      // ورود با PIN
      const pin = customPin || CONFIG.DEFAULT_PIN;
      console.log("تلاش برای ورود...");
      session.login(pin);
      console.log("ورود موفق");

      // یافتن کلید خصوصی
      const privateKey = await this.findPrivateKeyByLabel(
        session,
        CONFIG.KEY_LABEL
      );
      console.log("کلید خصوصی یافت شد");

      // تولید داده تصادفی برای امضا
      const challenge = randomBytes(256);
      console.log("داده تصادفی تولید شد");

      // امضای داده
      const signature = session
        .createSign(CONFIG.SIGNATURE_MECHANISM, privateKey)
        .once(challenge);
      console.log("امضا انجام شد");

      // تایید امضا با کلید عمومی
      const verify = createVerify("sha256");
      verify.update(challenge);
      verify.end();

      const isValid = verify.verify(CONFIG.PUBLIC_KEY, signature);

      if (!isValid) {
        throw new Error(
          "تایید امضا ناموفق بود. کلید روی توکن با کلید عمومی برنامه تطابق ندارد."
        );
      }

      console.log("تایید امضا موفق");

      const result = {
        success: true,
        message: "توکن با موفقیت تایید شد",
        timestamp: new Date().toISOString(),
      };

      this.lastVerification = result;
      if (mainWindow) {
        mainWindow.webContents.send("token-verification-result", result);
      }
      return result;
    } catch (error) {
      console.error("خطا در تایید توکن:", error);

      const friendlyMessage = this.getErrorMessage(error);
      const result = {
        success: false,
        message: friendlyMessage,
        details: error.message,
        timestamp: new Date().toISOString(),
      };

      this.lastVerification = result;
      if (mainWindow) {
        mainWindow.webContents.send("token-verification-result", result);
      }
      return result;
    } finally {
      // پاکسازی منابع
      if (session) {
        try {
          session.logout();
          session.close();
          console.log("نشست بسته شد");
        } catch (e) {
          console.log("خطا در بستن نشست:", e.message);
        }
      }
      if (mod) {
        try {
          mod.finalize();
          console.log("ماژول بسته شد");
        } catch (e) {
          console.log("خطا در بستن ماژول:", e.message);
        }
      }
    }
  }

  // ترجمه خطاها به پیام‌های دوستانه
  getErrorMessage(error) {
    // بررسی کدهای خطای PKCS#11
    if (error.code) {
      switch (error.code) {
        case 0x000000a0: // CKR_PIN_INCORRECT
          return "پین وارد شده اشتباه است.";
        case 0x000000e0: // CKR_DEVICE_ERROR
          return "خطا در ارتباط با دستگاه توکن. لطفاً آن را دوباره متصل کنید.";
        case 0x000000e1: // CKR_TOKEN_NOT_PRESENT
          return "توکن یافت نشد. لطفاً آن را متصل کنید.";
        case 0x000000a1: // CKR_PIN_INVALID
          return "پین نامعتبر است.";
        case 0x000000a2: // CKR_PIN_LEN_RANGE
          return "طول پین خارج از محدوده مجاز است.";
        case 0x00000003: // CKR_SLOT_ID_INVALID
          return "شناسه اسلات نامعتبر است.";
        default:
          return `خطای PKCS#11 با کد ${error.code.toString(16)}: ${
            error.message
          }`;
      }
    }

    // بررسی پیام‌های خطای رایج
    const message = error.message.toLowerCase();
    if (message.includes("pin")) return "مشکل در پین توکن";
    if (message.includes("token")) return "مشکل در توکن امنیتی";
    if (message.includes("driver") || message.includes("library"))
      return "مشکل در درایور توکن";
    if (message.includes("slot")) return "مشکل در اسلات توکن";

    return `خطای امنیتی: ${error.message}`;
  }

  getStatus() {
    return {
      lastVerification: this.lastVerification,
      isInitialized: this.isInitialized,
      driverPath: this.availableDriverPath,
    };
  }

  // متد جدید برای تست درایور
  async testDriver() {
    try {
      await this.initialize();
      const slots = await this.listAvailableSlots();
      return {
        success: true,
        driverPath: this.availableDriverPath,
        slots: slots,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

// ====================================================================
// SECTION 3: MAIN APPLICATION LOGIC & WINDOWS
// ====================================================================

const tokenManager = new Pkcs11TokenManager();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    icon: path.join(currentDir, "assets", "icon.png"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(currentDir, "preload.js"),
      webSecurity: !app.isPackaged,
    },
  });

  const isDev = !app.isPackaged && process.env.NODE_ENV !== "production";
  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(currentDir, "dist", "index.html"));
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    if (isDev) mainWindow.focus();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function createMenu() {
  const template = [
    {
      label: "فایل",
      submenu: [
        {
          label: "باز کردن تصویر...",
          accelerator: "CmdOrCtrl+O",
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ["openFile", "multiSelections"],
              filters: [
                {
                  name: "تصاویر",
                  extensions: [
                    "jpg",
                    "jpeg",
                    "png",
                    "gif",
                    "bmp",
                    "webp",
                    "tiff",
                  ],
                },
              ],
            });
            if (!result.canceled)
              mainWindow.webContents.send("files-selected", result.filePaths);
          },
        },
        { type: "separator" },
        {
          label: "تست توکن امنیتی",
          click: () => tokenManager.performTokenVerification(),
        },
        {
          label: "تست درایور",
          click: async () => {
            const result = await tokenManager.testDriver();
            console.log("نتیجه تست درایور:", result);
            dialog.showMessageBox(mainWindow, {
              type: result.success ? "info" : "error",
              title: "نتیجه تست درایور",
              message: result.success
                ? `درایور یافت شد: ${result.driverPath}\nتعداد اسلات: ${result.slots.length}`
                : `خطا: ${result.error}`,
            });
          },
        },
        { type: "separator" },
        { label: "خروج", role: "quit" },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ====================================================================
// SECTION 4: IPC HANDLERS (BACKEND FOR RENDERER)
// ====================================================================

// Token Handlers
ipcMain.handle("check-token-status", () => ({
  success: true,
  data: tokenManager.getStatus(),
}));
ipcMain.handle("verify-token", (event, options = {}) =>
  tokenManager.performTokenVerification(options.pin)
);
ipcMain.handle("test-driver", () => tokenManager.testDriver());

// File System Handlers
ipcMain.handle("create-file", async (event, fileName, content) => {
  try {
    const filePath = path.join(os.homedir(), "Desktop", fileName);
    await fs.writeFile(filePath, content, "utf8");
    return { success: true, path: filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("read-file", async (event, filePath) => {
  try {
    const data = await fs.readFile(filePath);
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("select-image-files", async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openFile", "multiSelections"],
      filters: [
        {
          name: "تصاویر",
          extensions: ["jpg", "jpeg", "png", "gif", "bmp", "webp", "tiff"],
        },
      ],
    });
    if (result.canceled) return { success: false, canceled: true };
    const fileData = await Promise.all(
      result.filePaths.map(async (filePath) => {
        const data = await fs.readFile(filePath);
        const stats = await fs.stat(filePath);
        return {
          path: filePath,
          name: path.basename(filePath),
          size: stats.size,
          data: data.toString("base64"),
          mimeType: `image/${path.extname(filePath).slice(1)}`,
        };
      })
    );
    return { success: true, files: fileData };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Image Comparison (Mock) Handler
ipcMain.handle("compare-images", async (event, imageData) => ({
  success: true,
  comparisons: imageData.map((img, index) => ({
    imageId: index,
    imageName: img.name || `Image ${index + 1}`,
    similarities: [
      {
        targetImage: "Reference 1",
        percentage: Math.floor(Math.random() * 100),
      },
      {
        targetImage: "Reference 2",
        percentage: Math.floor(Math.random() * 100),
      },
    ].sort((a, b) => b.percentage - a.percentage),
  })),
}));

// System & Shell Handlers
ipcMain.handle("get-system-info", () => ({
  success: true,
  info: {
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.versions.node,
    electronVersion: process.versions.electron,
  },
}));

ipcMain.handle("show-item-in-folder", (event, fullPath) => {
  shell.showItemInFolder(fullPath);
  return { success: true };
});

ipcMain.handle("open-external", async (event, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Network Handler
ipcMain.handle(
  "api-request",
  async (event, { url, method = "GET", headers = {}, body = null }) => {
    try {
      const request = net.request({ method, url, headers });
      return new Promise((resolve) => {
        let responseData = "";
        request.on("response", (response) => {
          response.on("data", (chunk) => {
            responseData += chunk;
          });
          response.on("end", () => {
            try {
              resolve({
                success: true,
                data: JSON.parse(responseData),
                status: response.statusCode,
                headers: response.headers,
              });
            } catch {
              resolve({
                success: true,
                data: responseData,
                status: response.statusCode,
                headers: response.headers,
              });
            }
          });
        });
        request.on("error", (error) =>
          resolve({ success: false, error: error.message })
        );
        if (body && method !== "GET") request.write(JSON.stringify(body));
        request.end();
      });
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
);

// ====================================================================
// SECTION 5: APPLICATION LIFECYCLE
// ====================================================================

app.commandLine.appendSwitch("no-sandbox");

app.whenReady().then(async () => {
  console.log("شروع راه‌اندازی برنامه...");

  try {
    // ابتدا درایور را تست کنید
    const driverTest = await tokenManager.testDriver();
    if (!driverTest.success) {
      console.error("تست درایور ناموفق:", driverTest.error);
      dialog.showErrorBox(
        "خطای درایور",
        `درایور PKCS#11 یافت نشد:\n${driverTest.error}`
      );
      app.quit();
      return;
    }

    console.log("درایور یافت شد، شروع تایید اولیه توکن...");
    const initialResult = await tokenManager.performTokenVerification();

    if (initialResult.success) {
      console.log("تایید اولیه موفق. ایجاد پنجره اصلی...");
      createWindow();
      createMenu();
      app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
      });
    } else {
      console.error("تایید اولیه ناموفق:", initialResult.message);
      dialog.showErrorBox(
        "خطای دسترسی",
        `توکن امنیتی معتبر یافت نشد.\n\nجزئیات: ${initialResult.message}`
      );
      app.quit();
    }
  } catch (error) {
    console.error("خطای بحرانی در راه‌اندازی:", error);
    dialog.showErrorBox(
      "خطای بحرانی",
      `خطا در راه‌اندازی برنامه:\n${error.message}`
    );
    app.quit();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
