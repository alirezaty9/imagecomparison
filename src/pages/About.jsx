import React, { useState, useEffect } from 'react';

export default function About() {
  const [settings, setSettings] = useState({
    backendUrl: 'http://192.168.88.69:8000',
    apiTimeout: 30000,
    maxFileSize: 10, // MB
    supportedFormats: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'],
    comparisonThreshold: 70,
    maxImagesPerComparison: 10
  });

  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [systemInfo, setSystemInfo] = useState(null);

  // Load settings and system info on component mount
  useEffect(() => {
    loadSettings();
    loadSystemInfo();
  }, []);

  const loadSettings = () => {
    if (window.storage) {
      const savedSettings = window.storage.get('imageComparisonSettings');
      if (savedSettings) {
        setSettings(savedSettings);
      }
    }
  };

  const loadSystemInfo = async () => {
    try {
      if (window.electronAPI) {
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

  // FIXED: Updated endpoint for health check
  const testBackendConnection = async () => {
    setIsTestingConnection(true);
    setTestResult(null);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), settings.apiTimeout);

      const response = await fetch(`${settings.backendUrl}/api/health`, {
        method: 'GET',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const healthData = await response.json();
        setTestResult({ 
          success: true, 
          message: 'اتصال با موفقیت برقرار شد',
          details: healthData
        });
      } else {
        setTestResult({ success: false, message: 'خطا در اتصال به سرور' });
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

  const saveSettings = () => {
    try {
      if (window.storage) {
        window.storage.set('imageComparisonSettings', settings);
        alert('تنظیمات با موفقیت ذخیره شد');
      } else {
        // Fallback to localStorage
        localStorage.setItem('imageComparisonSettings', JSON.stringify(settings));
        alert('تنظیمات با موفقیت ذخیره شد');
      }
    } catch (error) {
      console.error('خطا در ذخیره تنظیمات:', error);
      alert('خطا در ذخیره تنظیمات');
    }
  };

  const resetSettings = () => {
    if (confirm('آیا مطمئن هستید که می‌خواهید تنظیمات را به حالت پیش‌فرض برگردانید؟')) {
      const defaultSettings = {
        backendUrl: 'http://192.168.88.69:8000',
        apiTimeout: 30000,
        maxFileSize: 10,
        supportedFormats: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'],
        comparisonThreshold: 70,
        maxImagesPerComparison: 10
      };
      
      setSettings(defaultSettings);
      
      if (window.storage) {
        window.storage.remove('imageComparisonSettings');
      } else {
        localStorage.removeItem('imageComparisonSettings');
      }
      
      alert('تنظیمات به حالت پیش‌فرض برگردانده شد');
    }
  };

  const exportSettings = async () => {
    try {
      const data = JSON.stringify(settings, null, 2);
      
      if (window.electronAPI) {
        const result = await window.electronAPI.saveFileDialog(data, [
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'Configuration Files', extensions: ['config'] }
        ]);
        
        if (result.success) {
          alert(`تنظیمات در ${result.path} ذخیره شد`);
        }
      } else {
        // Fallback for web version
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'image-comparison-settings.json';
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('خطا در صادر کردن تنظیمات:', error);
      alert('خطا در صادر کردن تنظیمات');
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold text-center mb-8">تنظیمات و اطلاعات</h1>

      {/* Settings Section */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-2xl font-semibold mb-6 text-blue-600">تنظیمات اپلیکیشن</h2>
        
        <div className="space-y-6">
          {/* Backend URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              آدرس سرور Backend
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={settings.backendUrl}
                onChange={(e) => handleSettingChange('backendUrl', e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                placeholder="http://192.168.88.69:8000"
              />
              <button
                onClick={testBackendConnection}
                disabled={isTestingConnection}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
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
              <div className={`mt-2 p-3 rounded text-sm ${
                testResult.success 
                  ? 'bg-green-100 text-green-700 border border-green-200' 
                  : 'bg-red-100 text-red-700 border border-red-200'
              }`}>
                <div className="font-medium">{testResult.message}</div>
                {testResult.details && (
                  <div className="mt-2 text-xs">
                    <div>وضعیت: {testResult.details.status}</div>
                    <div>مدل بارگذاری شده: {testResult.details.model_loaded ? 'بله' : 'خیر'}</div>
                    <div>جستجوگر بارگذاری شده: {testResult.details.searcher_loaded ? 'بله' : 'خیر'}</div>
                    {testResult.details.index_size && (
                      <div>تعداد تصاویر در ایندکس: {testResult.details.index_size}</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* API Timeout */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 ">
              مهلت زمانی API (میلی‌ثانیه)
            </label>
            <input
              type="number"
              value={settings.apiTimeout}
              onChange={(e) => handleSettingChange('apiTimeout', parseInt(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
              min="5000"
              max="120000"
              step="1000"
            />
          </div>

          {/* Max File Size */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              حداکثر اندازه فایل (مگابایت)
            </label>
            <input
              type="number"
              value={settings.maxFileSize}
              onChange={(e) => handleSettingChange('maxFileSize', parseInt(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
              min="1"
              max="100"
            />
          </div>

          {/* Comparison Threshold */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              آستانه شباهت (درصد): {settings.comparisonThreshold}%
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
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>10%</span>
              <span>100%</span>
            </div>
          </div>

          {/* Max Images */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              حداکثر تعداد تصاویر برای هر مقایسه
            </label>
            <select
              value={settings.maxImagesPerComparison}
              onChange={(e) => handleSettingChange('maxImagesPerComparison', parseInt(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
            >
              <option value="5">5 تصویر</option>
              <option value="10">10 تصویر</option>
              <option value="20">20 تصویر</option>
              <option value="50">50 تصویر</option>
            </select>
          </div>

          {/* Supported Formats */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              فرمت‌های پشتیبانی شده
            </label>
            <div className="grid grid-cols-3 gap-2 text-black">
              {['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'svg'].map(format => (
                <label key={format} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings.supportedFormats.includes(format)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        handleSettingChange('supportedFormats', [...settings.supportedFormats, format]);
                      } else {
                        handleSettingChange('supportedFormats', settings.supportedFormats.filter(f => f !== format));
                      }
                    }}
                    className="w-4 h-4 text-blue-600 text-black"
                  />
                  <span className="text-sm">.{format}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 pt-4 flex-wrap">
            <button
              onClick={saveSettings}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            >
              ذخیره تنظیمات
            </button>
            <button
              onClick={resetSettings}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              بازنشانی
            </button>
            <button
              onClick={exportSettings}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              صادر کردن تنظیمات
            </button>
          </div>
        </div>
      </div>

      {/* App Info Section */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-2xl font-semibold mb-6 text-purple-600">اطلاعات اپلیکیشن</h2>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-medium mb-3">مشخصات فنی</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li><strong>نام:</strong> مقایسه‌گر تصاویر</li>
              <li><strong>نسخه:</strong> 1.0.0</li>
              <li><strong>پلتفرم:</strong> Electron + React</li>
              <li><strong>زبان برنامه‌نویسی:</strong> JavaScript/JSX</li>
              <li><strong>UI Framework:</strong> Tailwind CSS</li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-lg font-medium mb-3">قابلیت‌ها</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>✅ آپلود چندین تصویر همزمان</li>
              <li>✅ دریافت تصویر از API</li>
              <li>✅ مقایسه تصاویر با درصد شباهت</li>
              <li>✅ جستجوی تصاویر مشابه</li>
              <li>✅ پشتیبانی از فرمت‌های مختلف</li>
              <li>✅ رابط کاربری فارسی</li>
              <li>✅ تنظیمات قابل تغییر</li>
            </ul>
          </div>
        </div>
      </div>

      {/* API Info Section */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-2xl font-semibold mb-6 text-indigo-600">اطلاعات API</h2>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-medium mb-3">Endpoints موجود</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li><strong>GET /api/health:</strong> بررسی وضعیت سرور</li>
              <li><strong>POST /api/similarity:</strong> مقایسه دو تصویر</li>
              <li><strong>POST /api/search:</strong> جستجوی تصاویر مشابه</li>
              <li><strong>GET /api/list-images:</strong> لیست تمام تصاویر</li>
              <li><strong>POST /api/rebuild-faiss:</strong> بازسازی ایندکس</li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-lg font-medium mb-3">ویژگی‌های API</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>✅ استفاده از Swin Transformer</li>
              <li>✅ ایندکس FAISS برای جستجوی سریع</li>
              <li>✅ پشتیبانی از multipart/form-data</li>
              <li>✅ امکان تنظیم threshold و k</li>
              <li>✅ مدیریت خطا و validation</li>
            </ul>
          </div>
        </div>
      </div>

      {/* System Info */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-2xl font-semibold mb-6 text-green-600">اطلاعات سیستم</h2>
        
        {systemInfo ? (
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium mb-2">پلتفرم</h4>
              <p className="text-gray-600">{systemInfo.platform} ({systemInfo.arch})</p>
            </div>
            
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium mb-2">نسخه Electron</h4>
              <p className="text-gray-600">{systemInfo.electronVersion}</p>
            </div>
            
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium mb-2">نسخه Node.js</h4>
              <p className="text-gray-600">{systemInfo.nodeVersion}</p>
            </div>
            
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium mb-2">نسخه Chrome</h4>
              <p className="text-gray-600">{systemInfo.chromeVersion}</p>
            </div>
            
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium mb-2">حافظه کل</h4>
              <p className="text-gray-600">{(systemInfo.totalMemory / (1024**3)).toFixed(2)} GB</p>
            </div>
            
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium mb-2">پردازنده‌ها</h4>
              <p className="text-gray-600">{systemInfo.cpus} هسته</p>
            </div>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium mb-2">مرورگر</h4>
              <p className="text-gray-600">{navigator.userAgent.split(' ')[0]}</p>
            </div>
            
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium mb-2">رزولوشن صفحه</h4>
              <p className="text-gray-600">{window.screen.width} × {window.screen.height}</p>
            </div>
            
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium mb-2">زبان سیستم</h4>
              <p className="text-gray-600">{navigator.language}</p>
            </div>
          </div>
        )}
      </div>

      {/* Help Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-semibold mb-6 text-orange-600">راهنما</h2>
        
        <div className="space-y-4 text-sm text-gray-700">
          <div>
            <h4 className="font-medium mb-2">نحوه استفاده:</h4>
            <ol className="list-decimal list-inside space-y-1 mr-4">
              <li>ابتدا تنظیمات مربوط به سرور Backend را انجام دهید و اتصال را تست کنید</li>
              <li>برای مقایسه: دو تصویر را آپلود کنید و دکمه "مقایسه تصاویر" را کلیک کنید</li>
              <li>برای جستجو: یک تصویر آپلود کنید و دکمه "جستجوی تصاویر مشابه" را کلیک کنید</li>
              <li>نتایج را به ترتیب درصد شباهت مشاهده کنید</li>
            </ol>
          </div>
          
          <div>
            <h4 className="font-medium mb-2">نکات مهم:</h4>
            <ul className="list-disc list-inside space-y-1 mr-4">
              <li>تصاویر با کیفیت بالاتر نتایج بهتری ارائه می‌دهند</li>
              <li>حداکثر اندازه فایل قابل تنظیم است (پیش‌فرض: 50MB)</li>
              <li>برای عملکرد بهتر، از تصاویر کمتر از 5MB استفاده کنید</li>
              <li>اطمینان حاصل کنید سرور Backend در حال اجرا است</li>
              <li>آدرس پیش‌فرض سرور: http://192.168.88.69:8000</li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium mb-2">عیب‌یابی:</h4>
            <ul className="list-disc list-inside space-y-1 mr-4">
              <li>اگر "عدم اتصال به سرور" می‌بینید، آدرس سرور را بررسی کنید</li>
              <li>اگر جستجو نتیجه نمی‌دهد، threshold را کاهش دهید</li>
              <li>اگر نتایج زیاد هستند، threshold را افزایش دهید</li>
              <li>در صورت خطای آپلود، اندازه و فرمت فایل را بررسی کنید</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}