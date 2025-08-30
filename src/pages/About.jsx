import React, { useState, useEffect } from 'react';

export default function About() {
  const [settings, setSettings] = useState({
    backendUrl: 'http://192.168.88.69:8000',
    aiApiUrl: 'http://192.168.88.69:11434', // Added AI API URL
    apiTimeout: 30000,
    maxFileSize: 10, // MB
    supportedFormats: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'],
    comparisonThreshold: 70,
    maxImagesPerComparison: 10
  });

  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [systemInfo, setSystemInfo] = useState(null);
  const [testingAI, setTestingAI] = useState(false);
  const [aiTestResult, setAiTestResult] = useState(null);

  // Load settings and system info on component mount
  useEffect(() => {
    loadSettings();
    loadSystemInfo();
  }, []);

  const loadSettings = () => {
    try {
      let savedSettings = null;
      
      // Try enhanced storage first
      if (window.storage && typeof window.storage.get === 'function') {
        savedSettings = window.storage.get('appSettings', null);
      } else if (typeof localStorage !== 'undefined') {
        // Fallback to localStorage
        const stored = localStorage.getItem('appSettings');
        if (stored) {
          savedSettings = JSON.parse(stored);
        }
      }
      
      if (savedSettings && typeof savedSettings === 'object') {
        // Ensure supportedFormats is an array
        if (!Array.isArray(savedSettings.supportedFormats)) {
          savedSettings.supportedFormats = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
        }
        
        setSettings(prev => ({
          ...prev,
          ...savedSettings
        }));
      }
    } catch (error) {
      console.warn('Error loading settings:', error);
      // Keep default settings
    }
  };

  const loadSystemInfo = async () => {
    try {
      if (window.electronAPI && typeof window.electronAPI.getSystemInfo === 'function') {
        const result = await window.electronAPI.getSystemInfo();
        if (result.success) {
          setSystemInfo(result.info);
        }
      }
    } catch (error) {
      console.error('خطا در دریافت اطلاعات سیستم:', error);
    }
  };

  const handleSettingChange = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Enhanced connection test using electronFetch if available
  const testBackendConnection = async () => {
    setIsTestingConnection(true);
    setTestResult(null);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), settings.apiTimeout);

      let response;
      
      // Use electronFetch if available (CORS-free)
      if (window.electronFetch) {
        response = await window.electronFetch(`${settings.backendUrl}/api/health`);
      } else {
        // Fallback to regular fetch
        response = await fetch(`${settings.backendUrl}/api/health`, {
          method: 'GET',
          signal: controller.signal
        });
      }

      clearTimeout(timeoutId);

      if (response.ok) {
        const healthData = await response.json();
        setTestResult({ 
          success: true, 
          message: 'اتصال با موفقیت برقرار شد',
          details: healthData
        });
      } else {
        setTestResult({ success: false, message: `خطای سرور: ${response.status}` });
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        setTestResult({ 
          success: false, 
          message: 'مهلت زمانی اتصال به پایان رسید'
        });
      } else {
        setTestResult({ 
          success: false, 
          message: `خطا در اتصال: ${error.message}` 
        });
      }
    } finally {
      setIsTestingConnection(false);
    }
  };

  // Test AI server connection
  const testAIConnection = async () => {
    setTestingAI(true);
    setAiTestResult(null);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), settings.apiTimeout);

      let response;
      
      // Use electronFetch if available
      if (window.electronFetch) {
        response = await window.electronFetch(`${settings.aiApiUrl}/api/tags`);
      } else {
        response = await fetch(`${settings.aiApiUrl}/api/tags`, {
          method: 'GET',
          signal: controller.signal
        });
      }

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        setAiTestResult({ 
          success: true, 
          message: 'اتصال AI با موفقیت برقرار شد',
          details: data
        });
      } else {
        setAiTestResult({ success: false, message: `خطای AI سرور: ${response.status}` });
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        setAiTestResult({ 
          success: false, 
          message: 'مهلت زمانی اتصال AI به پایان رسید'
        });
      } else {
        setAiTestResult({ 
          success: false, 
          message: `خطا در اتصال AI: ${error.message}` 
        });
      }
    } finally {
      setTestingAI(false);
    }
  };

  const saveSettings = () => {
    try {
      if (window.storage && typeof window.storage.set === 'function') {
        window.storage.set('appSettings', settings);
        alert('تنظیمات با موفقیت ذخیره شد');
      } else if (typeof localStorage !== 'undefined') {
        // Fallback to localStorage
        localStorage.setItem('appSettings', JSON.stringify(settings));
        alert('تنظیمات با موفقیت ذخیره شد');
      } else {
        alert('سیستم ذخیره‌سازی در دسترس نیست');
      }
    } catch (error) {
      console.error('خطا در ذخیره تنظیمات:', error);
      alert('خطا در ذخیره تنظیمات: ' + error.message);
    }
  };

  const resetSettings = () => {
    if (confirm('آیا مطمئن هستید که می‌خواهید تنظیمات را به حالت پیش‌فرض برگردانید؟')) {
      const defaultSettings = {
        backendUrl: 'http://192.168.88.69:8000',
        aiApiUrl: 'http://192.168.88.69:11434',
        apiTimeout: 30000,
        maxFileSize: 10,
        supportedFormats: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'],
        comparisonThreshold: 70,
        maxImagesPerComparison: 10
      };
      
      setSettings(defaultSettings);
      
      try {
        if (window.storage && typeof window.storage.remove === 'function') {
          window.storage.remove('appSettings');
        } else if (typeof localStorage !== 'undefined') {
          localStorage.removeItem('appSettings');
        }
        
        alert('تنظیمات به حالت پیش‌فرض برگردانده شد');
      } catch (error) {
        console.error('Error clearing settings:', error);
      }
    }
  };

  const exportSettings = async () => {
    try {
      const data = JSON.stringify(settings, null, 2);
      
      if (window.electronAPI && typeof window.electronAPI.createFile === 'function') {
        const fileName = `image-comparison-settings-${new Date().toISOString().slice(0,10)}.json`;
        const result = await window.electronAPI.createFile(fileName, data);
        
        if (result.success) {
          alert(`تنظیمات در ${result.path} ذخیره شد`);
        } else {
          throw new Error(result.error);
        }
      } else {
        // Fallback for web version
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `image-comparison-settings-${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        alert('تنظیمات دانلود شد');
      }
    } catch (error) {
      console.error('خطا در صادر کردن تنظیمات:', error);
      alert('خطا در صادر کردن تنظیمات: ' + error.message);
    }
  };

  const clearAllData = () => {
    if (confirm('آیا مطمئن هستید که می‌خواهید تمام داده‌ها را پاک کنید؟\n\nاین شامل تنظیمات، تصاویر ذخیره شده، و سیستم cache است.')) {
      try {
        if (window.storage && typeof window.storage.clear === 'function') {
          window.storage.clear();
        } else if (typeof localStorage !== 'undefined') {
          localStorage.clear();
        }
        
        // Reset to defaults
        const defaultSettings = {
          backendUrl: 'http://192.168.88.69:8000',
          aiApiUrl: 'http://192.168.88.69:11434',
          apiTimeout: 30000,
          maxFileSize: 10,
          supportedFormats: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'],
          comparisonThreshold: 70,
          maxImagesPerComparison: 10
        };
        setSettings(defaultSettings);
        
        alert('تمام داده‌ها پاک شد و تنظیمات به حالت پیش‌فرض برگردانده شد');
      } catch (error) {
        console.error('Error clearing data:', error);
        alert('خطا در پاک کردن داده‌ها: ' + error.message);
      }
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">تنظیمات و اطلاعات</h1>
        <p className="text-gray-400">مدیریت تنظیمات اپلیکیشن و مشاهده اطلاعات سیستم</p>
      </div>

      {/* Settings Section */}
      <div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-6 border border-gray-700">
        <h2 className="text-2xl font-semibold text-white mb-6">تنظیمات اپلیکیشن</h2>
        
        <div className="space-y-6">
          {/* Backend URL */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              آدرس سرور Backend
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={settings.backendUrl}
                onChange={(e) => handleSettingChange('backendUrl', e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-700 text-white"
                placeholder="http://192.168.88.69:8000"
              />
              <button
                onClick={testBackendConnection}
                disabled={isTestingConnection}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isTestingConnection ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    تست...
                  </span>
                ) : (
                  'تست اتصال'
                )}
              </button>
            </div>
            
            {testResult && (
              <div className={`mt-3 p-3 rounded-lg text-sm border ${
                testResult.success
                  ? 'bg-green-900 text-green-300 border-green-700'
                  : 'bg-orange-900 text-orange-300 border-orange-700'
              }`}>
                <div className="font-medium flex items-center gap-2">
                  <span>{testResult.success ? '✓' : '✗'}</span>
                  {testResult.message}
                </div>
                {testResult.details && (
                  <div className="mt-2 text-xs space-y-1 bg-gray-600 p-2 rounded border border-gray-500">
                    <div><strong>وضعیت:</strong> {testResult.details.status}</div>
                    <div><strong>مدل بارگذاری شده:</strong> {testResult.details.model_loaded ? 'بله ✓' : 'خیر ✗'}</div>
                    {testResult.details.searcher_loaded !== undefined && (
                      <div><strong>جستجوگر بارگذاری شده:</strong> {testResult.details.searcher_loaded ? 'بله ✓' : 'خیر ✗'}</div>
                    )}
                    {testResult.details.index_size && (
                      <div><strong>تعداد تصاویر در ایندکس:</strong> {testResult.details.index_size.toLocaleString('fa-IR')}</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* AI API URL */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              آدرس سرور AI (Ollama)
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={settings.aiApiUrl}
                onChange={(e) => handleSettingChange('aiApiUrl', e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-gray-700 text-white"
                placeholder="http://192.168.88.69:11434"
              />
              <button
                onClick={testAIConnection}
                disabled={testingAI}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                {testingAI ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    تست AI...
                  </span>
                ) : (
                  'تست AI'
                )}
              </button>
            </div>
            
            {aiTestResult && (
              <div className={`mt-3 p-3 rounded-lg text-sm border ${
                aiTestResult.success
                  ? 'bg-green-900 text-green-300 border-green-700'
                  : 'bg-orange-900 text-orange-300 border-orange-700'
              }`}>
                <div className="font-medium flex items-center gap-2">
                  <span>{aiTestResult.success ? '✓' : '✗'}</span>
                  {aiTestResult.message}
                </div>
                {aiTestResult.details && aiTestResult.details.models && (
                  <div className="mt-2 text-xs bg-gray-600 p-2 rounded border border-gray-500">
                    <div><strong>مدل‌های موجود:</strong> {aiTestResult.details.models.length} مدل</div>
                    <div className="max-h-20 overflow-y-auto mt-1">
                      {aiTestResult.details.models.map((model, index) => (
                        <div key={index} className="text-gray-300">• {model.name}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* API Timeout */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              مهلت زمانی API (میلی‌ثانیه): {settings.apiTimeout.toLocaleString('fa-IR')}
            </label>
            <input
              type="range"
              value={settings.apiTimeout}
              onChange={(e) => handleSettingChange('apiTimeout', parseInt(e.target.value))}
              className="w-full"
              min="5000"
              max="120000"
              step="5000"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>5 ثانیه</span>
              <span>120 ثانیه</span>
            </div>
          </div>

          {/* Max File Size */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              حداکثر اندازه فایل: {settings.maxFileSize} مگابایت
            </label>
            <input
              type="range"
              value={settings.maxFileSize}
              onChange={(e) => handleSettingChange('maxFileSize', parseInt(e.target.value))}
              className="w-full"
              min="1"
              max="100"
              step="1"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>1 MB</span>
              <span>100 MB</span>
            </div>
          </div>

          {/* Comparison Threshold */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              آستانه شباهت پیش‌فرض: {settings.comparisonThreshold}%
            </label>
            <input
              type="range"
              value={settings.comparisonThreshold}
              onChange={(e) => handleSettingChange('comparisonThreshold', parseInt(e.target.value))}
              className="w-full"
              min="10"
              max="100"
              step="5"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>10% (کم)</span>
              <span>100% (دقیق)</span>
            </div>
          </div>

          {/* Max Images */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              حداکثر تعداد نتایج جستجو
            </label>
            <select
              value={settings.maxImagesPerComparison}
              onChange={(e) => handleSettingChange('maxImagesPerComparison', parseInt(e.target.value))}
              className="w-full px-4 py-2 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-700 text-white"
            >
              <option value={5}>5 تصویر</option>
              <option value={10}>10 تصویر</option>
              <option value={20}>20 تصویر</option>
              <option value={50}>50 تصویر</option>
              <option value={100}>100 تصویر</option>
            </select>
          </div>

          {/* Supported Formats */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              فرمت‌های پشتیبانی شده ({Array.isArray(settings.supportedFormats) ? settings.supportedFormats.length : 0} فرمت انتخاب شده)
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-gray-600 rounded-lg border border-gray-500">
              {['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'svg'].map(format => (
                <label key={format} className="flex items-center gap-2 cursor-pointer hover:bg-gray-500 p-2 rounded transition-colors">
                  <input
                    type="checkbox"
                    checked={Array.isArray(settings.supportedFormats) && settings.supportedFormats.includes(format)}
                    onChange={(e) => {
                      const currentFormats = Array.isArray(settings.supportedFormats) ? settings.supportedFormats : [];
                      if (e.target.checked) {
                        handleSettingChange('supportedFormats', [...currentFormats, format]);
                      } else {
                        handleSettingChange('supportedFormats', currentFormats.filter(f => f !== format));
                      }
                    }}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-300">.{format}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 pt-6 border-t border-gray-600">
            <button
              onClick={saveSettings}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <span>💾</span>
              ذخیره تنظیمات
            </button>
            <button
              onClick={resetSettings}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
            >
              <span>🔄</span>
              بازنشانی
            </button>
            <button
              onClick={exportSettings}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <span>📤</span>
              صادر کردن
            </button>
            <button
              onClick={clearAllData}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors flex items-center gap-2"
            >
              <span>🗑️</span>
              پاک کردن همه داده‌ها
            </button>
          </div>
        </div>
      </div>

      {/* App Info Section */}
      <div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-6 border border-gray-700">
        <h2 className="text-2xl font-semibold text-white mb-6">اطلاعات اپلیکیشن</h2>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-medium text-white mb-3 flex items-center gap-2">
              <span>⚙️</span>
              مشخصات فنی
            </h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><strong>نام:</strong> مقایسه‌گر تصاویر پیشرفته</li>
              <li><strong>نسخه:</strong> 3.1.0</li>
              <li><strong>پلتفرم:</strong> Electron + React + Vite</li>
              <li><strong>زبان برنامه‌نویسی:</strong> JavaScript/JSX</li>
              <li><strong>UI Framework:</strong> Tailwind CSS</li>
              <li><strong>امنیت:</strong> PKCS#11 Token Authentication</li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-lg font-medium text-white mb-3 flex items-center gap-2">
              <span>✨</span>
              قابلیت‌ها
            </h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>✅ مقایسه دو تصویر با درصد شباهت دقیق</li>
              <li>✅ جستجوی تصاویر مشابه با AI</li>
              <li>✅ چت هوشمند با AI درباره تصاویر</li>
              <li>✅ امضای دیجیتال با توکن سخت‌افزاری</li>
              <li>✅ رابط کاربری فارسی و responsive</li>
              <li>✅ ذخیره‌سازی امن تنظیمات</li>
              <li>✅ پشتیبانی از فرمت‌های مختلف تصویر</li>
              <li>✅ بدون مشکل CORS</li>
            </ul>
          </div>
        </div>
      </div>

      {/* API Info Section */}
      <div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-6 border border-gray-700">
        <h2 className="text-2xl font-semibold text-white mb-6">اطلاعات API و سرورها</h2>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-medium text-white mb-3 flex items-center gap-2">
              <span>🌐</span>
              Backend Endpoints
            </h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><strong>GET /api/health:</strong> بررسی وضعیت سرور</li>
              <li><strong>POST /api/similarity:</strong> مقایسه دو تصویر</li>
              <li><strong>POST /api/search:</strong> جستجوی تصاویر مشابه</li>
              <li><strong>GET /api/list-images:</strong> لیست تمام تصاویر</li>
              <li><strong>POST /api/rebuild-faiss:</strong> بازسازی ایندکس</li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-lg font-medium text-white mb-3 flex items-center gap-2">
              <span>🤖</span>
              AI Endpoints (Ollama)
            </h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><strong>GET /api/tags:</strong> لیست مدل‌های موجود</li>
              <li><strong>POST /api/generate:</strong> تولید توضیح AI</li>
              <li><strong>POST /api/chat:</strong> چت با AI</li>
              <li><strong>Model Used:</strong> moondream:latest</li>
              <li><strong>Context Support:</strong> تصاویر + متن</li>
            </ul>
          </div>
        </div>
        
        <div className="mt-6 p-4 bg-gray-600 rounded-lg border border-gray-500">
          <h4 className="font-medium text-white mb-2">ویژگی‌های پیشرفته:</h4>
          <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-300">
            <ul className="space-y-1">
              <li>✅ استفاده از Swin Transformer</li>
              <li>✅ ایندکس FAISS برای جستجوی سریع</li>
              <li>✅ پشتیبانی از multipart/form-data</li>
              <li>✅ تنظیمات threshold و k قابل تغییر</li>
            </ul>
            <ul className="space-y-1">
              <li>✅ مدیریت خطا و validation کامل</li>
              <li>✅ الکترون API برای رفع CORS</li>
              <li>✅ ذخیره‌سازی session با encryption</li>
              <li>✅ AI چت با حافظه context</li>
            </ul>
          </div>
        </div>
      </div>

      {/* System Info */}
      <div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-6 border border-gray-700">
        <h2 className="text-2xl font-semibold text-white mb-6 flex items-center gap-2">
          <span>💻</span>
          اطلاعات سیستم
        </h2>
        
        {systemInfo ? (
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="p-4 bg-gray-700 rounded-lg border border-gray-600">
              <h4 className="font-medium mb-2 text-white">پلتفرم</h4>
              <p className="text-gray-300">{systemInfo.platform} ({systemInfo.arch})</p>
            </div>

            <div className="p-4 bg-gray-700 rounded-lg border border-gray-600">
              <h4 className="font-medium mb-2 text-white">نسخه Electron</h4>
              <p className="text-gray-300">v{systemInfo.electronVersion}</p>
            </div>

            <div className="p-4 bg-gray-700 rounded-lg border border-gray-600">
              <h4 className="font-medium mb-2 text-white">نسخه Node.js</h4>
              <p className="text-gray-300">v{systemInfo.nodeVersion}</p>
            </div>

            {systemInfo.chromeVersion && (
              <div className="p-4 bg-gray-700 rounded-lg border border-gray-600">
                <h4 className="font-medium mb-2 text-white">نسخه Chrome</h4>
                <p className="text-gray-300">v{systemInfo.chromeVersion}</p>
              </div>
            )}

            {systemInfo.totalMemory && (
              <div className="p-4 bg-gray-700 rounded-lg border border-gray-600">
                <h4 className="font-medium mb-2 text-white">حافظه کل</h4>
                <p className="text-gray-300">{(systemInfo.totalMemory / (1024**3)).toFixed(2)} GB</p>
              </div>
            )}

            {systemInfo.cpus && (
              <div className="p-4 bg-gray-700 rounded-lg border border-gray-600">
                <h4 className="font-medium mb-2 text-white">پردازنده‌ها</h4>
                <p className="text-gray-300">{systemInfo.cpus} هسته</p>
              </div>
            )}
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="p-4 bg-gray-700 rounded-lg border border-gray-600">
              <h4 className="font-medium mb-2 text-white">مرورگر</h4>
              <p className="text-gray-300">{navigator.userAgent.split(' ')[0]}</p>
            </div>

            <div className="p-4 bg-gray-700 rounded-lg border border-gray-600">
              <h4 className="font-medium mb-2 text-white">رزولوشن صفحه</h4>
              <p className="text-gray-300">{window.screen.width} × {window.screen.height}</p>
            </div>

            <div className="p-4 bg-gray-700 rounded-lg border border-gray-600">
              <h4 className="font-medium mb-2 text-white">زبان سیستم</h4>
              <p className="text-gray-300">{navigator.language}</p>
            </div>
          </div>
        )}
      </div>

      {/* Help Section */}
      <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
        <h2 className="text-2xl font-semibold text-white mb-6 flex items-center gap-2">
          <span>❓</span>
          راهنما و عیب‌یابی
        </h2>
        
        <div className="grid md:grid-cols-2 gap-6 text-sm text-gray-400">
          <div>
            <h4 className="font-medium mb-3 text-white flex items-center gap-2">
              <span>📋</span>
              نحوه استفاده:
            </h4>
            <ol className="list-decimal list-inside space-y-2 mr-4 bg-gray-600 p-4 rounded-lg border border-gray-500">
              <li>ابتدا تنظیمات سرور را انجام دهید و اتصال را تست کنید</li>
              <li>برای مقایسه: دو تصویر آپلود کنید و "مقایسه تصاویر" را کلیک کنید</li>
              <li>برای جستجو: یک تصویر آپلود کنید و "جستجوی مشابه" را کلیک کنید</li>
              <li>از چت AI برای سوال درباره تصاویر استفاده کنید</li>
              <li>توکن سخت‌افزاری را متصل کنید تا امکان امضای دیجیتال فعال شود</li>
            </ol>
          </div>
          
          <div>
            <h4 className="font-medium mb-3 text-white flex items-center gap-2">
              <span>💡</span>
              نکات مهم:
            </h4>
            <ul className="list-disc list-inside space-y-2 mr-4 bg-gray-600 p-4 rounded-lg border border-gray-500">
              <li>تصاویر با کیفیت بالاتر نتایج بهتری ارائه می‌دهند</li>
              <li>برای عملکرد بهتر، از تصاویر کمتر از 5MB استفاده کنید</li>
              <li>اطمینان حاصل کنید سرورهای Backend و AI در حال اجرا هستند</li>
              <li>برای امضای دیجیتال، توکن PKCS#11 باید متصل باشد</li>
              <li>داده‌ها به صورت امن ذخیره می‌شوند و فقط 24 ساعت نگهداری می‌شوند</li>
            </ul>
          </div>
          
          <div className="md:col-span-2">
            <h4 className="font-medium mb-3 text-white flex items-center gap-2">
              <span>🔧</span>
              عیب‌یابی:
            </h4>
            <div className="bg-gray-600 p-4 rounded-lg border border-gray-500 space-y-2">
              <div><strong>⚠️ عدم اتصال به سرور:</strong> آدرس سرور و اتصال اینترنت را بررسی کنید</div>
              <div><strong>⚠️ نتیجه جستجو خالی:</strong> threshold را کاهش دهید یا تصویر دیگری امتحان کنید</div>
              <div><strong>⚠️ نتایج زیاد:</strong> threshold را افزایش دهید</div>
              <div><strong>⚠️ خطای آپلود:</strong> اندازه و فرمت فایل را بررسی کنید</div>
              <div><strong>⚠️ مشکل توکن:</strong> مطمئن شوید توکن متصل است و PIN صحیح است</div>
              <div><strong>⚠️ خطای AI:</strong> بررسی کنید سرور Ollama در حال اجرا است</div>
              <div><strong>⚠️ مشکل CORS:</strong> از حالت Electron استفاده کنید</div>
              <div><strong>⚠️ خطای 422:</strong> پارامترهای ارسالی را بررسی کنید (query_image, image1, image2)</div>
            </div>
          </div>
        </div>
        
        {/* Technical Support Info */}
        <div className="mt-6 p-4 bg-gray-600 rounded-lg border border-gray-500">
          <h4 className="font-medium mb-2 text-white flex items-center gap-2">
            <span>🔗</span>
            اطلاعات فنی برای پشتیبانی:
          </h4>
          <div className="text-xs text-gray-300 space-y-1">
            <div><strong>User Agent:</strong> {navigator.userAgent}</div>
            <div><strong>Screen:</strong> {window.screen.width}×{window.screen.height} ({window.devicePixelRatio}x DPR)</div>
            <div><strong>Storage Available:</strong> {window.storage ? 'Enhanced ✓' : 'Basic'}</div>
            <div><strong>Electron APIs:</strong> {window.electronAPI ? 'Available ✓' : 'Not Available'}</div>
            <div><strong>CORS-Free Fetch:</strong> {window.electronFetch ? 'Available ✓' : 'Not Available'}</div>
            <div><strong>Current URL:</strong> {window.location.href}</div>
            <div><strong>Settings Storage:</strong> {typeof localStorage !== 'undefined' ? 'LocalStorage ✓' : 'Not Available'}</div>
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <div className="text-center mt-8 text-gray-400 text-sm">
        <p className="mb-2">🚀 مقایسه‌گر تصاویر پیشرفته - نسخه 3.1.0</p>
        <p className="text-xs">
          طراحی شده با ❤️ برای مقایسه دقیق تصاویر •
          {window.electronAPI ? ' 🖥️ Desktop Mode' : ' 🌐 Web Mode'} •
          {window.electronFetch ? ' CORS-Free ✅' : ' Standard Fetch ⚠️'}
        </p>
      </div>
    </div>
  );
}