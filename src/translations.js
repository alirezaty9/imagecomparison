export const translations = {
  fa: {
    // Navigation
    home: "خانه",
    camera: "دوربین",
    electronApp: "الکترون اپ",
    
    // Home Page
    createFileTitle: "ساخت فایل روی دسکتاپ",
    createFileDesc: "فایل‌های متنی خود را به راحتی ایجاد کنید",
    fileName: "نام فایل (با پسوند):",
    fileContent: "محتوای فایل:",
    createFile: "ساخت فایل",
    creating: "در حال ساخت...",
    electronReady: "محیط الکترون - آماده",
    electronDisabled: "محیط الکترون - غیر فعال",
    
    // Camera Page
    cameraTitle: "نمایش دوربین RTSP",
    cameraDesc: "اتصال به دوربین‌های RTSP و نمایش زنده",
    rtspAddress: "آدرس RTSP:",
    refreshComponent: "بروزرسانی کامپوننت",
    defaultCamera: "دوربین پیش‌فرض",
    
    // RTSP Viewer
    live: "زنده",
    connecting: "در حال اتصال...",
    startStreaming: "شروع پخش",
    stop: "توقف",
    
    // Footer
    footerText: "ساخته شده با ❤️ برای مدیریت دوربین‌های RTSP",
    version: "نسخه"
  },
  
  en: {
    // Navigation
    home: "Home",
    camera: "Camera",
    electronApp: "Electron App",
    
    // Home Page
    createFileTitle: "Create File on Desktop",
    createFileDesc: "Easily create your text files",
    fileName: "File name (with extension):",
    fileContent: "File content:",
    createFile: "Create File",
    creating: "Creating...",
    electronReady: "Electron Environment - Ready",
    electronDisabled: "Electron Environment - Disabled",
    
    // Camera Page
    cameraTitle: "RTSP Camera Display",
    cameraDesc: "Connect to RTSP cameras and display live",
    rtspAddress: "RTSP Address:",
    refreshComponent: "Refresh Component",
    defaultCamera: "Default Camera",
    
    // RTSP Viewer
    live: "LIVE",
    connecting: "Connecting...",
    startStreaming: "Start Streaming",
    stop: "Stop",
    
    // Footer
    footerText: "Made with ❤️ for RTSP camera management",
    version: "Version"
  }
};

export const useTranslation = (language) => {
  return (key) => {
    return translations[language]?.[key] || key;
  };
};