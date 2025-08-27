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
import { exec } from "node:child_process";
import FormData from "form-data";

// Conditional import for PKCS#11
let graphene = null;
try {
  graphene = await import("graphene-pk11");
} catch (error) {
  console.warn("PKCS#11 library not available:", error.message);
}

// ====================================================================
// SECTION 1: SETUP & CONFIGURATION
// ====================================================================

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
let mainWindow = null;
let usbModule = null;

// Initialize USB module
async function initializeUSB() {
  try {
    const usbImport = await import("usb");
    usbModule = usbImport.default || usbImport.usb || usbImport;
    console.log("USB module loaded successfully");
    return true;
  } catch (error) {
    console.warn("USB module not available:", error.message);
    return false;
  }
}

// تشخیص مسیر درایور بر اساس پلتفرم
const getDriverPath = () => {
  switch (process.platform) {
    case "win32":
      return [
        "C:\\Windows\\System32\\shuttle_p11.dll",
        "C:\\ProgramFiles\\ShuttleCSP\\shuttle_p11.dll",
        "C:\\ProgramFiles(x86)\\ShuttleCSP\\shuttle_p11.dll",
      ];
    case "linux":
      return [
        path.join(currentDir, "Token", "lib", "libshuttle_p11v220.so.1.0.0"),
        "/usr/local/lib/libshuttle_p11v220.so",
        "/usr/lib/libshuttle_p11v220.so",
        "/lib/libshuttle_p11v220.so",
      ];
    case "darwin":
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
  SIGNATURE_MECHANISM: "SHA256_RSA_PKCS",
  // Enhanced token configuration
  ALLOWED_TOKENS: [
    { vendorId: 0x096e, productId: 0x0703 }, // Feitian ePass3003
    // Add more allowed tokens here as needed
  ],
  TOKEN_CHECK_INTERVAL: 2000, // Check token every 2 seconds
  VERIFICATION_CACHE_TIME: 5 * 60 * 1000, // 5 minutes cache
};

// ====================================================================
// SECTION 2: ENHANCED PKCS#11 TOKEN MANAGER CLASS
// ====================================================================

class Pkcs11TokenManager {
  constructor() {
    this.lastVerification = null;
    this.availableDriverPath = null;
    this.isInitialized = false;
    this.verificationCache = new Map();
  }

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

  async initialize() {
    if (this.isInitialized) return;

    if (!graphene) {
      throw new Error("PKCS#11 library not available");
    }

    if (!this.availableDriverPath) {
      await this.findAvailableDriver();
    }

    this.isInitialized = true;
    console.log("PKCS#11 Manager آماده شد");
  }

  async listAvailableSlots() {
    let mod = null;
    try {
      if (!graphene) {
        return [];
      }

      mod = graphene.Module.load(this.availableDriverPath, "ShuttlePKCS11");
      mod.initialize();

      const slots = mod.getSlots(true);
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

  async findPrivateKeyByLabel(session, label) {
    const objects = session.find({
      class: graphene.ObjectClass.PRIVATE_KEY,
      label: label,
    });

    if (objects.length === 0) {
      const allPrivateKeys = session.find({
        class: graphene.ObjectClass.PRIVATE_KEY,
      });

      console.log(`تعداد کلیدهای خصوصی یافت شده: ${allPrivateKeys.length}`);

      if (allPrivateKeys.length > 0) {
        console.log("استفاده از اولین کلید خصوصی موجود");
        return allPrivateKeys.items(0);
      }

      throw new Error(`کلید خصوصی با برچسب "${label}" یافت نشد`);
    }

    return objects.items(0);
  }

  // Enhanced verification with caching and better error handling
  async performTokenVerification(customPin = null, forceRefresh = false) {
    let session = null;
    let mod = null;

    try {
      // Check cache first (unless force refresh)
      if (!forceRefresh && this.lastVerification) {
        const cacheAge =
          Date.now() - new Date(this.lastVerification.timestamp).getTime();
        if (
          cacheAge < CONFIG.VERIFICATION_CACHE_TIME &&
          this.lastVerification.success
        ) {
          console.log("استفاده از نتیجه تایید کش شده");
          return this.lastVerification;
        }
      }

      await this.initialize();
      console.log("شروع تایید توکن...");

      if (!graphene) {
        throw new Error("PKCS#11 library not available");
      }

      mod = graphene.Module.load(this.availableDriverPath, "ShuttlePKCS11");
      mod.initialize();
      console.log("ماژول PKCS#11 بارگذاری شد");

      const slots = mod.getSlots(true);
      if (slots.length === 0) {
        throw new Error("هیچ توکنی یافت نشد. لطفاً توکن را متصل کنید.");
      }

      const slot = slots.items(0);
      console.log(`استفاده از اسلات: ${slot.slotDescription}`);

      session = slot.open(
        graphene.SessionFlag.RW_SESSION | graphene.SessionFlag.SERIAL_SESSION
      );
      console.log("نشست باز شد");

      const pin = customPin || CONFIG.DEFAULT_PIN;
      console.log("تلاش برای ورود...");
      session.login(pin);
      console.log("ورود موفق");

      const privateKey = await this.findPrivateKeyByLabel(
        session,
        CONFIG.KEY_LABEL
      );
      console.log("کلید خصوصی یافت شد");

      const challenge = randomBytes(256);
      console.log("داده تصادفی تولید شد");

      const signature = session
        .createSign(CONFIG.SIGNATURE_MECHANISM, privateKey)
        .once(challenge);
      console.log("امضا انجام شد");

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
        details: {
          challengeSize: challenge.length,
          signatureSize: signature.length,
          publicKeyMatch: true,
          slotDescription: slot.slotDescription,
          driverPath: this.availableDriverPath,
        },
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
        errorCode: error.code || null,
      };

      this.lastVerification = result;
      if (mainWindow) {
        mainWindow.webContents.send("token-verification-result", result);
      }
      return result;
    } finally {
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

  getErrorMessage(error) {
    if (error.code) {
      switch (error.code) {
        case 0x000000a0:
          return "پین وارد شده اشتباه است.";
        case 0x000000e0:
          return "خطا در ارتباط با دستگاه توکن. لطفاً آن را دوباره متصل کنید.";
        case 0x000000e1:
          return "توکن یافت نشد. لطفاً آن را متصل کنید.";
        case 0x000000a1:
          return "پین نامعتبر است.";
        case 0x000000a2:
          return "طول پین خارج از محدوده مجاز است.";
        case 0x00000003:
          return "شناسه اسلات نامعتبر است.";
        default:
          return `خطای PKCS#11 با کد ${error.code.toString(16)}: ${
            error.message
          }`;
      }
    }

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
      grapheneAvailable: !!graphene,
    };
  }

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
// SECTION 3: ENHANCED HARDWARE TOKEN MANAGER (USB Detection)
// ====================================================================

class HardwareTokenManager {
  constructor() {
    this.connectedTokens = new Set();
    this.allowedTokens = CONFIG.ALLOWED_TOKENS;
    this.usbEnabled = false;
    this.monitoringInterval = null;
    this.lastKnownTokens = new Set();
  }

  async initialize() {
    try {
      this.usbEnabled = await initializeUSB();
      if (this.usbEnabled) {
        this.setupUSBListeners();
        this.startMonitoring();
        // Initial scan
        this.checkAllConnectedDevices();
      }
    } catch (error) {
      console.error("Error initializing USB token manager:", error);
    }
  }

  setupUSBListeners() {
    if (!this.usbEnabled || !usbModule) return;

    try {
      const usb = usbModule.usb || usbModule;

      if (typeof usb.on === "function") {
        usb.on("attach", (device) => this.handleDeviceConnect(device));
        usb.on("detach", (device) => this.handleDeviceDisconnect(device));
      }
    } catch (error) {
      console.error("Error setting up USB listeners:", error);
    }
  }

  // Enhanced monitoring with periodic checks
  startMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = setInterval(() => {
      this.periodicTokenCheck();
    }, CONFIG.TOKEN_CHECK_INTERVAL);
  }

  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  // Periodic check to detect state changes
  periodicTokenCheck() {
    try {
      const currentTokens = this.checkAllConnectedDevices();
      const currentTokenSet = new Set(
        currentTokens.map((t) => `${t.vendorId}:${t.productId}`)
      );

      // Check for newly connected tokens
      currentTokenSet.forEach((tokenKey) => {
        if (!this.lastKnownTokens.has(tokenKey)) {
          const [vendorId, productId] = tokenKey
            .split(":")
            .map((id) => parseInt(id));
          console.log(`Token connected via periodic check: ${tokenKey}`);
          this.handleTokenConnection(vendorId, productId);
        }
      });

      // Check for disconnected tokens
      this.lastKnownTokens.forEach((tokenKey) => {
        if (!currentTokenSet.has(tokenKey)) {
          const [vendorId, productId] = tokenKey
            .split(":")
            .map((id) => parseInt(id));
          console.log(`Token disconnected via periodic check: ${tokenKey}`);
          this.handleTokenDisconnection(vendorId, productId);
        }
      });

      this.lastKnownTokens = currentTokenSet;
    } catch (error) {
      console.error("Error in periodic token check:", error);
    }
  }

  handleDeviceConnect(device) {
    const { idVendor, idProduct } = device.deviceDescriptor;
    this.handleTokenConnection(idVendor, idProduct);
  }

  handleDeviceDisconnect(device) {
    const { idVendor, idProduct } = device.deviceDescriptor;
    this.handleTokenDisconnection(idVendor, idProduct);
  }

  handleTokenConnection(vendorId, productId) {
    const isAllowed = this.allowedTokens.some(
      (token) => token.vendorId === vendorId && token.productId === productId
    );

    if (isAllowed) {
      const tokenKey = `${vendorId}:${productId}`;
      this.connectedTokens.add(tokenKey);
      console.log(`Allowed token connected: ${tokenKey}`);

      if (mainWindow) {
        mainWindow.webContents.send("token-connected", {
          vendorId,
          productId,
          connected: true,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  handleTokenDisconnection(vendorId, productId) {
    const tokenKey = `${vendorId}:${productId}`;

    if (this.connectedTokens.has(tokenKey)) {
      this.connectedTokens.delete(tokenKey);
      console.log(`Token disconnected: ${tokenKey}`);

      if (mainWindow) {
        mainWindow.webContents.send("token-disconnected", {
          vendorId,
          productId,
          connected: false,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  isTokenConnected(vendorId, productId) {
    return this.connectedTokens.has(`${vendorId}:${productId}`);
  }

  // Enhanced device enumeration
  checkAllConnectedDevices() {
    if (!this.usbEnabled || !usbModule) return [];

    try {
      const usb = usbModule.usb || usbModule;
      const devices = usb.getDeviceList();
      const connectedTokens = [];

      devices.forEach((device) => {
        const { idVendor, idProduct } = device.deviceDescriptor;
        const isAllowed = this.allowedTokens.some(
          (token) =>
            token.vendorId === idVendor && token.productId === idProduct
        );

        if (isAllowed) {
          const tokenKey = `${idVendor}:${idProduct}`;
          this.connectedTokens.add(tokenKey);
          connectedTokens.push({ vendorId: idVendor, productId: idProduct });
        }
      });

      return connectedTokens;
    } catch (error) {
      console.error("Error checking connected devices:", error);
      return [];
    }
  }

  // Check if any allowed token is connected
  hasAnyAllowedTokenConnected() {
    return this.connectedTokens.size > 0;
  }

  // Get list of currently connected allowed tokens
  getConnectedTokens() {
    return Array.from(this.connectedTokens).map((tokenKey) => {
      const [vendorId, productId] = tokenKey
        .split(":")
        .map((id) => parseInt(id));
      return { vendorId, productId };
    });
  }

  shutdown() {
    this.stopMonitoring();
  }
}

// ====================================================================
// SECTION 4: WINDOW & APP INITIALIZATION
// ====================================================================

const tokenManager = new Pkcs11TokenManager();
const hardwareTokenManager = new HardwareTokenManager();

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
      allowRunningInsecureContent: false,
    },
  });

  const isDev = !app.isPackaged && process.env.NODE_ENV !== "production";

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(currentDir, "dist", "index.html"));
  }

  // CORS handling for development
  if (isDev) {
    mainWindow.webContents.session.webRequest.onBeforeSendHeaders(
      (details, callback) => {
        callback({ requestHeaders: details.requestHeaders });
      }
    );

    mainWindow.webContents.session.webRequest.onHeadersReceived(
      (details, callback) => {
        if (details.responseHeaders) {
          details.responseHeaders["Access-Control-Allow-Origin"] = ["*"];
          details.responseHeaders["Access-Control-Allow-Methods"] = [
            "GET, POST, PUT, DELETE, OPTIONS",
          ];
          details.responseHeaders["Access-Control-Allow-Headers"] = ["*"];
        }
        callback({ responseHeaders: details.responseHeaders });
      }
    );
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    if (isDev) mainWindow.focus();

    // Initial hardware token check after window is ready
    setTimeout(() => {
      const connectedTokens = hardwareTokenManager.checkAllConnectedDevices();
      if (connectedTokens.length > 0) {
        mainWindow.webContents.send("token-connected", {
          ...connectedTokens[0],
          connected: true,
          timestamp: new Date().toISOString(),
        });
      }
    }, 2000);
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
          click: () => tokenManager.performTokenVerification(null, true), // Force refresh
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
        {
          label: "وضعیت سخت‌افزار",
          click: () => {
            const connectedTokens = hardwareTokenManager.getConnectedTokens();
            const hasTokens =
              hardwareTokenManager.hasAnyAllowedTokenConnected();

            dialog.showMessageBox(mainWindow, {
              type: hasTokens ? "info" : "warning",
              title: "وضعیت سخت‌افزار",
              message: hasTokens
                ? `توکن‌های متصل: ${connectedTokens.length}\n${connectedTokens
                    .map(
                      (t) =>
                        `VID:${t.vendorId.toString(
                          16
                        )} PID:${t.productId.toString(16)}`
                    )
                    .join("\n")}`
                : "هیچ توکن مجازی متصل نیست",
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
// SECTION 5: ENHANCED IPC HANDLERS
// ====================================================================

// Enhanced Token Handlers
ipcMain.handle("check-token-status", () => ({
  success: true,
  data: {
    ...tokenManager.getStatus(),
    hardwareConnected: hardwareTokenManager.hasAnyAllowedTokenConnected(),
    connectedTokens: hardwareTokenManager.getConnectedTokens(),
  },
}));

ipcMain.handle("verify-token", (event, options = {}) =>
  tokenManager.performTokenVerification(
    options.pin,
    options.forceRefresh || false
  )
);

ipcMain.handle("test-driver", () => tokenManager.testDriver());

// Enhanced hardware token handlers
ipcMain.handle("check-hardware-token", async (event, vendorId, productId) => {
  try {
    const isConnected = hardwareTokenManager.isTokenConnected(
      vendorId,
      productId
    );
    return {
      success: true,
      connected: isConnected,
      allConnectedTokens: hardwareTokenManager.getConnectedTokens(),
    };
  } catch (error) {
    return { success: false, error: error.message, connected: false };
  }
});

ipcMain.handle("request-token-access", async (event, vendorId, productId) => {
  try {
    const connectedTokens = hardwareTokenManager.checkAllConnectedDevices();
    const isConnected = hardwareTokenManager.isTokenConnected(
      vendorId,
      productId
    );
    return {
      success: true,
      connected: isConnected,
      availableTokens: connectedTokens,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Legacy compatibility with enhanced functionality
ipcMain.handle("sign-and-verify-file", async (event, options = {}) => {
  // First check if hardware token is connected
  const hasHardware = hardwareTokenManager.hasAnyAllowedTokenConnected();
  if (!hasHardware) {
    return {
      success: false,
      message: "هیچ توکن سخت‌افزاری مجاز متصل نیست",
      timestamp: new Date().toISOString(),
    };
  }

  return await tokenManager.performTokenVerification(options.pin, true);
});

// File System Handlers (unchanged)
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

// Image Comparison Handler
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

// System Handlers
ipcMain.handle("get-system-info", () => ({
  success: true,
  info: {
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.versions.node,
    electronVersion: process.versions.electron,
    chromeVersion: process.versions.chrome,
    totalMemory: os.totalmem(),
    cpus: os.cpus().length,
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

// ENHANCED API REQUEST HANDLER - WITH FORMDATA SUPPORT
ipcMain.handle(
  "api-request",
  async (event, { url, method = "GET", headers = {}, body = null }) => {
    try {
      const fullUrl = url.startsWith("http")
        ? url
        : `http://192.168.88.69:8000${url}`;

      console.log("=== API REQUEST DEBUG ===");
      console.log("URL:", fullUrl);
      console.log("Method:", method);
      console.log("Headers:", headers);
      console.log("Body type:", typeof body);

      // Handle FormData from renderer
      if (body && typeof body === "object" && body.formData && body.files) {
        console.log("Processing FormData request...");
        console.log("FormData fields:", Object.keys(body.formData));
        console.log("Files:", Object.keys(body.files));

        // Create form-data instance
        const formData = new FormData();

        // Add regular form fields
        Object.entries(body.formData).forEach(([key, value]) => {
          console.log(`Adding field: ${key} = ${value}`);
          formData.append(key, value);
        });

        // Add files
        Object.entries(body.files).forEach(([key, fileInfo]) => {
          console.log(
            `Adding file: ${key} - ${fileInfo.name} (${fileInfo.size} bytes, ${fileInfo.type})`
          );

          // Convert base64 back to buffer
          const base64Data = fileInfo.data.split(",")[1];
          const buffer = Buffer.from(base64Data, "base64");

          formData.append(key, buffer, {
            filename: fileInfo.name,
            contentType: fileInfo.type,
          });
        });

        // Use form-data for the request
        const request = net.request({
          method,
          url: fullUrl,
          headers: {
            ...formData.getHeaders(),
            ...headers,
          },
        });

        return new Promise((resolve) => {
          let responseData = "";

          request.on("response", (response) => {
            console.log("FormData response status:", response.statusCode);
            console.log("FormData response headers:", response.headers);

            response.on("data", (chunk) => {
              responseData += chunk;
            });

            response.on("end", () => {
              console.log(
                "FormData response data length:",
                responseData.length
              );
              console.log(
                "FormData response preview:",
                responseData.substring(0, 200)
              );

              try {
                const data = responseData ? JSON.parse(responseData) : null;
                resolve({
                  success: true,
                  data,
                  status: response.statusCode,
                  headers: response.headers,
                });
              } catch (error) {
                console.log(
                  "FormData response parse error, returning raw data"
                );
                resolve({
                  success: true,
                  data: responseData,
                  status: response.statusCode,
                  headers: response.headers,
                });
              }
            });
          });

          request.on("error", (error) => {
            console.error("FormData request error:", error);
            resolve({ success: false, error: error.message });
          });

          // Write the form data
          formData.pipe(request);
        });
      }

      // Regular JSON request handling
      console.log("Processing regular JSON request...");
      const request = net.request({
        method,
        url: fullUrl,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "*",
          ...headers,
        },
      });

      return new Promise((resolve) => {
        let responseData = "";

        request.on("response", (response) => {
          console.log("JSON response status:", response.statusCode);

          response.on("data", (chunk) => {
            responseData += chunk;
          });

          response.on("end", () => {
            try {
              const data = responseData ? JSON.parse(responseData) : null;
              resolve({
                success: true,
                data,
                status: response.statusCode,
                headers: response.headers,
              });
            } catch (error) {
              resolve({
                success: true,
                data: responseData,
                status: response.statusCode,
                headers: response.headers,
              });
            }
          });
        });

        request.on("error", (error) => {
          console.error("JSON request error:", error);
          resolve({ success: false, error: error.message });
        });

        if (body && method !== "GET") {
          const bodyString =
            typeof body === "string" ? body : JSON.stringify(body);
          console.log("Writing body:", bodyString.substring(0, 100) + "...");
          request.write(bodyString);
        }
        request.end();
      });
    } catch (error) {
      console.error("API request handler error:", error);
      return { success: false, error: error.message };
    }
  }
);

// Command execution handler
ipcMain.handle("run-test123-command", async (event, commandArgs = "") => {
  return new Promise((resolve) => {
    const fullCommand = commandArgs
      ? `/usr/local/bin/test123 ${commandArgs}`
      : "/usr/local/bin/test123 --help";

    const execOptions = {
      env: {
        ...process.env,
        PATH: process.env.PATH + ":/usr/local/bin:/usr/bin:/bin",
      },
    };

    exec(fullCommand, execOptions, (error, stdout, stderr) => {
      if (error) {
        resolve({
          success: false,
          error: error.message,
          stdout: "",
          stderr,
          command: fullCommand,
          path: process.env.PATH,
        });
      } else {
        resolve({ success: true, stdout, stderr, error: null });
      }
    });
  });
});

// ====================================================================
// SECTION 6: ENHANCED APPLICATION LIFECYCLE
// ====================================================================

app.commandLine.appendSwitch("no-sandbox");

app.whenReady().then(async () => {
  console.log("شروع راه‌اندازی برنامه...");

  try {
    // Initialize hardware token manager first
    console.log("راه‌اندازی مدیریت سخت‌افزار...");
    await hardwareTokenManager.initialize();

    // Test driver availability (non-blocking)
    const driverTest = await tokenManager.testDriver();
    if (!driverTest.success) {
      console.warn("درایور PKCS#11 در دسترس نیست:", driverTest.error);
      // Don't quit the app, continue without PKCS#11 functionality
    }

    createWindow();
    createMenu();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
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
  // Clean shutdown
  hardwareTokenManager.shutdown();
  if (process.platform !== "darwin") app.quit();
});

// Handle app termination
app.on("before-quit", () => {
  hardwareTokenManager.shutdown();
});

// Handle system shutdown/suspend
app.on("will-quit", (event) => {
  hardwareTokenManager.shutdown();
});
