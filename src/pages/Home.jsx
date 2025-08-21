import React, { useState, useEffect } from 'react';

export default function ImageSimilaritySearch() {
  const [selectedImage, setSelectedImage] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [apiUrl, setApiUrl] = useState('http://192.168.1.101:8000');
  const [aiApiUrl, setAiApiUrl] = useState('http://192.168.1.101:11434');
  const [threshold, setThreshold] = useState(50);
  const [maxResults, setMaxResults] = useState(10);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('checking');
  const [apiInfo, setApiInfo] = useState(null);
  const [aiDescription, setAiDescription] = useState(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  
  // State های جدید برای امضای فایل
  const [signResult, setSignResult] = useState(null);
  const [isProcessingSigning, setIsProcessingSigning] = useState(false);

  // Load settings on component mount
  useEffect(() => {
    loadSettings();
    loadSessionData();
    checkConnection();
    
    // Listen for file sign results
    if (window.electronAPI) {
      window.electronAPI.onFileSignResult((event, result) => {
        setSignResult(result);
        setIsProcessingSigning(false);
        
        // نمایش نتیجه در success/error state
        if (result.success) {
          setSuccess(result.message);
        } else {
          setError(result.message);
        }
        
        // پاک کردن پیام بعد از 10 ثانیه
        setTimeout(() => {
          setSignResult(null);
        }, 10000);
      });
    }

    // Cleanup
    return () => {
      if (window.electronAPI) {
        window.electronAPI.removeAllListeners('file-sign-result');
      }
    };
  }, []);

  // Save session data to localStorage
  const saveSessionData = () => {
    try {
      const sessionData = {
        selectedImage: selectedImage ? {
          id: selectedImage.id,
          name: selectedImage.name,
          url: selectedImage.url,
          size: selectedImage.size,
          type: selectedImage.type,
          base64Data: selectedImage.url // Store the base64 data URL
        } : null,
        aiDescription,
        chatMessages,
        searchResults,
        timestamp: Date.now()
      };
      localStorage.setItem('sessionData', JSON.stringify(sessionData));
    } catch (error) {
      console.log('Error saving session data:', error);
    }
  };

  // Convert base64 data URL to File object
  const base64ToFile = (base64Data, fileName, mimeType) => {
    try {
      // Extract base64 string from data URL
      const base64String = base64Data.split(',')[1];
      const byteCharacters = atob(base64String);
      const byteNumbers = new Array(byteCharacters.length);
      
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      
      const byteArray = new Uint8Array(byteNumbers);
      return new File([byteArray], fileName, { type: mimeType });
    } catch (error) {
      console.log('Error converting base64 to file:', error);
      return null;
    }
  };

  // Load session data from localStorage
  const loadSessionData = () => {
    try {
      const sessionData = JSON.parse(localStorage.getItem('sessionData') || '{}');
      
      // Check if session data is less than 24 hours old
      const twentyFourHours = 24 * 60 * 60 * 1000;
      if (sessionData.timestamp && (Date.now() - sessionData.timestamp) < twentyFourHours) {
        
        if (sessionData.selectedImage) {
          // Convert base64 back to file object
          const restoredFile = base64ToFile(
            sessionData.selectedImage.base64Data,
            sessionData.selectedImage.name,
            sessionData.selectedImage.type
          );
          
          setSelectedImage({
            ...sessionData.selectedImage,
            file: restoredFile // Restore the file object
          });
        }
        
        if (sessionData.aiDescription) {
          setAiDescription(sessionData.aiDescription);
        }
        
        if (sessionData.chatMessages && Array.isArray(sessionData.chatMessages)) {
          setChatMessages(sessionData.chatMessages);
        }
        
        if (sessionData.searchResults && Array.isArray(sessionData.searchResults)) {
          setSearchResults(sessionData.searchResults);
        }
      }
    } catch (error) {
      console.log('Error loading session data:', error);
    }
  };

  // Auto-save session data when important states change
  useEffect(() => {
    if (selectedImage || aiDescription || chatMessages.length > 0 || searchResults.length > 0) {
      saveSessionData();
    }
  }, [selectedImage, aiDescription, chatMessages, searchResults]);

  const loadSettings = () => {
    try {
      const settings = JSON.parse(localStorage.getItem('appSettings') || '{}');
      if (settings.apiUrl) setApiUrl(settings.apiUrl);
      if (settings.aiApiUrl) setAiApiUrl(settings.aiApiUrl);
      if (settings.threshold) setThreshold(settings.threshold);
      if (settings.maxResults) setMaxResults(settings.maxResults);
    } catch (error) {
      console.log('Error loading settings:', error);
    }
  };

  const saveSettings = () => {
    try {
      const settings = { apiUrl, aiApiUrl, threshold, maxResults };
      localStorage.setItem('appSettings', JSON.stringify(settings));
    } catch (error) {
      console.log('Error saving settings:', error);
    }
  };

  // Check server connection
  const checkConnection = async () => {
    setConnectionStatus('checking');
    try {
      const response = await fetch(`${apiUrl}/api/health`);
      if (response.ok) {
        const health = await response.json();
        setApiInfo(health);
        setConnectionStatus('connected');
        setError(null);
        return health;
      } else {
        throw new Error('سرور پاسخ نداد');
      }
    } catch (error) {
      setConnectionStatus('disconnected');
      setError('عدم اتصال به سرور. لطفاً آدرس سرور را بررسی کنید.');
      return null;
    }
  };

  // Get AI description for image
  const getAIDescription = async (imageFile) => {
    setIsLoadingAI(true);
    setAiDescription(null);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64Data = e.target.result.split(',')[1];
          const requestBody = {
            model: "moondream:latest",
            prompt: "Describe this image in detail. What do you see?",
            images: [base64Data],
            stream: false
          };

          const response = await fetch(`${aiApiUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
          });

          if (!response.ok) {
            throw new Error(`خطای AI سرور: ${response.status}`);
          }

          const result = await response.json();
          if (result.response) {
            setAiDescription(result.response.trim());
          } else {
            setAiDescription('توضیحی دریافت نشد');
          }
        } catch (fetchError) {
          setAiDescription('خطا در دریافت توضیح از AI. لطفاً اتصال اینترنت و تنظیمات را بررسی کنید.');
        } finally {
          setIsLoadingAI(false);
        }
      };

      reader.onerror = () => {
        setAiDescription('خطا در خواندن تصویر');
        setIsLoadingAI(false);
      };

      reader.readAsDataURL(imageFile);
    } catch (error) {
      setAiDescription('خطا در دریافت توضیح از AI. لطفاً اتصال اینترنت و تنظیمات را بررسی کنید.');
      setIsLoadingAI(false);
    }
  };

  // Send chat message with image context
  const sendChatMessage = async () => {
    if (!currentMessage.trim() || !selectedImage) return;

    setIsLoadingChat(true);
    const userMessage = currentMessage.trim();
    setCurrentMessage('');

    const newUserMessage = {
      role: 'user',
      content: userMessage,
      timestamp: new Date().toLocaleTimeString('fa-IR')
    };

    setChatMessages(prev => [...prev, newUserMessage]);

    try {
      // Use existing base64 data if available, otherwise read from file
      let base64Data;
      
      if (selectedImage.url && selectedImage.url.startsWith('data:')) {
        base64Data = selectedImage.url.split(',')[1];
        await processChat(base64Data, userMessage);
      } else if (selectedImage.file) {
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            base64Data = e.target.result.split(',')[1];
            await processChat(base64Data, userMessage);
          } catch (fetchError) {
            addErrorMessage('خطا در دریافت پاسخ از AI. لطفاً دوباره تلاش کنید.');
          }
        };
        reader.onerror = () => {
          addErrorMessage('خطا در خواندن تصویر برای چت');
        };
        reader.readAsDataURL(selectedImage.file);
      } else {
        addErrorMessage('تصویر موجود نیست');
      }
    } catch (error) {
      addErrorMessage('خطا در ارسال پیام چت');
    }
  };

  const processChat = async (base64Data, userMessage) => {
    try {
      const messages = [{
        role: 'user',
        content: userMessage,
        images: [base64Data]
      }];

      // Add previous chat context
      chatMessages.forEach(msg => {
        if (msg.role === 'user') {
          messages.unshift({ role: 'user', content: msg.content });
        } else if (msg.role === 'assistant') {
          messages.unshift({ role: 'assistant', content: msg.content });
        }
      });

      const requestBody = {
        model: "moondream:latest",
        messages: messages,
        stream: false
      };

      const response = await fetch(`${aiApiUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`خطای سرور چت: ${response.status}`);
      }

      const result = await response.json();
      const aiMessage = {
        role: 'assistant',
        content: result.message?.content || 'پاسخی دریافت نشد',
        timestamp: new Date().toLocaleTimeString('fa-IR')
      };

      setChatMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      addErrorMessage('خطا در دریافت پاسخ از AI. لطفاً دوباره تلاش کنید.');
    } finally {
      setIsLoadingChat(false);
    }
  };

  const addErrorMessage = (content) => {
    const errorMessage = {
      role: 'assistant',
      content: content,
      timestamp: new Date().toLocaleTimeString('fa-IR'),
      isError: true
    };
    setChatMessages(prev => [...prev, errorMessage]);
    setIsLoadingChat(false);
  };

  // تابع تست امضای فایل
  const handleTestSigning = async () => {
    setIsProcessingSigning(true);
    setSignResult(null);
    setError(null);
    setSuccess(null);
    
    if (window.electronAPI) {
      try {
        await window.electronAPI.signAndVerifyFile();
      } catch (error) {
        setError('خطا در فرآیند امضا: ' + error.message);
        setIsProcessingSigning(false);
      }
    } else {
      setError('API الکترون موجود نیست');
      setIsProcessingSigning(false);
    }
  };

  // Handle file upload
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) processFile(file);
  };

  // Handle drag and drop
  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find(file => file.type.startsWith('image/'));
    if (imageFile) processFile(imageFile);
  };

  // Process selected file
  const processFile = (file) => {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 'image/webp'];
    const maxSize = 50 * 1024 * 1024; // 50MB

    if (!validTypes.includes(file.type)) {
      setError('فرمت فایل پشتیبانی نمی‌شود. لطفاً فایل JPG، PNG، GIF یا BMP انتخاب کنید.');
      return;
    }

    if (file.size > maxSize) {
      setError('حجم فایل بیش از حد مجاز است. حداکثر حجم مجاز 50 مگابایت است.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setSelectedImage({
        id: Date.now(),
        name: file.name,
        url: e.target.result,
        file: file,
        size: file.size,
        type: file.type
      });
      setError(null);
      setSuccess(null);
      setSearchResults([]);
      setAiDescription(null);
      setChatMessages([]);
      
      // Get AI description automatically when image is selected
      getAIDescription(file);
    };
    reader.readAsDataURL(file);
  };

  // Open file dialog
  const openFileDialog = () => {
    document.getElementById('imageInput').click();
  };

  // Function to get image URL
  const getImageUrl = (result, index) => {
    if (result.image_data) {
      return `data:image/jpeg;base64,${result.image_data}`;
    }
    
    if (result.image_path) {
      if (result.image_path.startsWith('http')) {
        return result.image_path;
      }
      
      const imagePath = result.image_path.startsWith('/') 
        ? result.image_path 
        : `/${result.image_path}`;
      
      return `${apiUrl}${imagePath}`;
    }
    
    return null;
  };

  // Search similar images
  const searchSimilarImages = async () => {
    if (!selectedImage) {
      setError('لطفاً ابتدا یک تصویر انتخاب کنید');
      return;
    }

    if (connectionStatus !== 'connected') {
      setError('اتصال به سرور برقرار نیست. لطفاً اتصال اینترنت و آدرس سرور را بررسی کنید.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);
    saveSettings();

    try {
      const formData = new FormData();
      
      // Use the file object if available, otherwise convert from base64
      let fileToUpload = selectedImage.file;
      
      if (!fileToUpload && selectedImage.url) {
        // Convert base64 to file object
        fileToUpload = base64ToFile(selectedImage.url, selectedImage.name, selectedImage.type);
      }
      
      if (!fileToUpload) {
        throw new Error('فایل تصویر موجود نیست');
      }
      
      formData.append('query_image', fileToUpload);
      formData.append('threshold', threshold.toString());
      formData.append('k', maxResults.toString());
      formData.append('return_images', 'true');

      const response = await fetch(`${apiUrl}/api/search`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`خطای سرور: ${response.status}`);
      }

      const result = await response.json();
      setSearchResults(result.results || []);
      
      if (result.results && result.results.length > 0) {
        setSuccess(`${result.total_results} تصویر مشابه یافت شد`);
      } else {
        setSuccess('جستجو انجام شد اما تصویر مشابهی یافت نشد');
      }
    } catch (error) {
      setError('خطا در جستجو. لطفاً اتصال اینترنت و تنظیمات را بررسی کنید.');
    } finally {
      setIsLoading(false);
    }
  };

  // Remove selected image
  const removeImage = () => {
    setSelectedImage(null);
    setSearchResults([]);
    setError(null);
    setSuccess(null);
    setAiDescription(null);
    setChatMessages([]);
    
    // Clear session data when removing image
    try {
      localStorage.removeItem('sessionData');
    } catch (error) {
      console.log('Error clearing session data:', error);
    }
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 بایت';
    const k = 1024;
    const sizes = ['بایت', 'کیلوبایت', 'مگابایت', 'گیگابایت'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">جستجوی تصاویر مشابه با هوش مصنوعی</h1>
        <p className="text-gray-600">تصویر خود را آپلود کنید، توضیح AI دریافت کنید و تصاویر مشابه را پیدا کنید</p>
      </div>

      {/* نمایش نتیجه امضای فایل */}
      {signResult && (
        <div className={`fixed top-5 left-1/2 transform -translate-x-1/2 z-50 max-w-md w-full mx-4 p-4 rounded-lg shadow-lg border-2 ${
          signResult.success 
            ? 'bg-green-50 border-green-200 text-green-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`} style={{animation: 'slideDown 0.3s ease-out'}}>
          <div className="flex items-start gap-3">
            <span className="text-2xl">{signResult.success ? '✅' : '❌'}</span>
            <div className="flex-1">
              <h3 className="font-bold text-lg mb-2">
                {signResult.success ? 'امضای فایل موفق' : 'خطا در امضای فایل'}
              </h3>
              <p className="text-sm mb-3">{signResult.message}</p>
              
              {signResult.details && signResult.success && (
                <details className="text-xs">
                  <summary className="cursor-pointer font-medium mb-1">جزئیات فنی</summary>
                  <div className="bg-white bg-opacity-50 p-2 rounded border">
                    <div><strong>نام فایل:</strong> {signResult.details.fileName}</div>
                    <div><strong>مسیر:</strong> {signResult.details.filePath}</div>
                    <div><strong>فایل امضا:</strong> {signResult.details.signatureFile}</div>
                  </div>
                </details>
              )}
              
              <button
                onClick={() => setSignResult(null)}
                className="mt-2 px-2 py-1 bg-gray-500 text-white rounded text-xs hover:bg-gray-600"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* دکمه تست امضای فایل */}
      <div className="text-center mb-6">
        <button
          onClick={handleTestSigning}
          disabled={isProcessingSigning}
          className="px-6 py-3 bg-purple-500 text-white rounded-lg font-semibold hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isProcessingSigning ? (
            <span className="flex items-center gap-2 justify-center">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              در حال تست امضا...
            </span>
          ) : (
            '🔐 تست امضای فایل PKCS#11'
          )}
        </button>
        <p className="text-xs text-gray-500 mt-2">ایجاد فایل رندوم، امضا و تایید امضا</p>
      </div>

      {/* Connection Status */}
      <div className="mb-6">
        {connectionStatus === 'connected' && apiInfo && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-green-800 text-sm font-medium">متصل به سرور</span>
            </div>
            <div className="text-sm text-green-700 grid grid-cols-1 md:grid-cols-3 gap-2">
              <div>وضعیت: {apiInfo.status}</div>
              <div>مدل: {apiInfo.model_loaded ? '✓ بارگذاری شده' : '✗ بارگذاری نشده'}</div>
              <div>تعداد تصاویر: {apiInfo.index_size || 0}</div>
            </div>
          </div>
        )}
        {connectionStatus === 'disconnected' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            <span className="text-red-800 text-sm">عدم اتصال به سرور</span>
            <button 
              onClick={checkConnection}
              className="mr-auto px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
            >
              تلاش مجدد
            </button>
          </div>
        )}
        {connectionStatus === 'checking' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <span className="text-blue-800 text-sm">در حال بررسی اتصال...</span>
          </div>
        )}
      </div>

      {/* Settings Section */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">تنظیمات</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">آدرس سرور جستجو</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-gray-50 text-black"
                placeholder="http://192.168.88.69:8000"
              />
              <button
                onClick={checkConnection}
                className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm"
              >
                تست
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">آدرس سرور AI</label>
            <input
              type="text"
              value={aiApiUrl}
              onChange={(e) => setAiApiUrl(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-gray-50 text-black"
              placeholder="http://192.168.88.69:11434"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">دقت جستجو ({threshold}%)</label>
            <input
              type="range"
              min="0"
              max="100"
              value={threshold}
              onChange={(e) => setThreshold(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="text-xs text-gray-500 mt-1">کمتر = نتایج بیشتر، بیشتر = نتایج دقیق‌تر</div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">تعداد نتایج</label>
            <select
              value={maxResults}
              onChange={(e) => setMaxResults(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-gray-50 text-black"
            >
              <option value={5}>5 تصویر</option>
              <option value={10}>10 تصویر</option>
              <option value={20}>20 تصویر</option>
              <option value={50}>50 تصویر</option>
            </select>
          </div>
        </div>
      </div>

      {/* Upload Section */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">انتخاب تصویر</h2>
          {selectedImage && (
            <button
              onClick={removeImage}
              className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
            >
              حذف تصویر
            </button>
          )}
        </div>
        
        {!selectedImage ? (
          <div 
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
              id="imageInput"
            />
            <div className="space-y-4">
              <div className="text-6xl text-gray-400">📷</div>
              <button
                onClick={openFileDialog}
                className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
              >
                انتخاب تصویر
              </button>
            </div>
            <p className="text-gray-500 mt-4">یا تصویر را به اینجا بکشید</p>
            <p className="text-xs text-gray-400 mt-2">فرمت‌های مجاز: JPG, PNG, GIF, BMP, WEBP (حداکثر 50 مگابایت)</p>
          </div>
        ) : (
          <div className="border rounded-lg p-4 bg-gray-50">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Image & AI Description Section */}
              <div>
                <div className="flex items-center gap-4 mb-4">
                  <img 
                    src={selectedImage.url} 
                    alt={selectedImage.name}
                    className="w-20 h-20 object-cover rounded-lg"
                  />
                  <div className="flex-1">
                    <h3 className="font-medium">{selectedImage.name}</h3>
                    <p className="text-sm text-gray-600">{formatFileSize(selectedImage.size)}</p>
                  </div>
                </div>

                {/* AI Description */}
                <div className="bg-white rounded-lg p-4 border">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xl">🤖</span>
                    <h3 className="font-semibold text-gray-800">توضیح هوش مصنوعی</h3>
                  </div>
                  
                  {isLoadingAI ? (
                    <div className="flex items-center gap-2 text-blue-600">
                      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-sm">در حال تحلیل تصویر...</span>
                    </div>
                  ) : aiDescription ? (
                    <div className="bg-gray-50 rounded p-3">
                      <p className="text-gray-700 text-sm leading-relaxed">{aiDescription}</p>
                    </div>
                  ) : (
                    <div className="text-gray-500 text-sm">هنوز توضیحی دریافت نشده است</div>
                  )}
                  
                  {aiDescription && selectedImage && (
                    <button
                      onClick={() => {
                        if (selectedImage.file) {
                          getAIDescription(selectedImage.file);
                        } else if (selectedImage.url) {
                          // Convert base64 to file and get AI description
                          const file = base64ToFile(selectedImage.url, selectedImage.name, selectedImage.type);
                          if (file) {
                            getAIDescription(file);
                          }
                        }
                      }}
                      className="mt-3 px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                      disabled={isLoadingAI}
                    >
                      تولید مجدد توضیح
                    </button>
                  )}
                </div>
              </div>
              
              {/* Chat Section */}
              <div>
                <div className="bg-white rounded-lg p-4 border h-full">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">💬</span>
                      <h3 className="font-semibold text-gray-800">چت با AI</h3>
                    </div>
                    {chatMessages.length > 0 && (
                      <button
                        onClick={() => setChatMessages([])}
                        className="px-2 py-1 bg-gray-500 text-white rounded text-xs hover:bg-gray-600"
                      >
                        پاک کردن چت
                      </button>
                    )}
                  </div>
                  
                  {/* Chat Messages */}
                  <div className="h-80 overflow-y-auto mb-3 space-y-2">
                    {chatMessages.length === 0 ? (
                      <div className="text-gray-500 text-sm text-center py-4">
                        سوال خود را درباره تصویر بپرسید
                      </div>
                    ) : (
                      chatMessages.map((message, index) => (
                        <div
                          key={index}
                          className={`p-2 rounded text-sm ${
                            message.role === 'user'
                              ? 'bg-blue-100 text-blue-800 mr-8'
                              : message.isError
                              ? 'bg-red-100 text-red-800 ml-8'
                              : 'bg-gray-100 text-gray-800 ml-8'
                          }`}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex-1">
                              <div className="font-medium text-xs mb-1">
                                {message.role === 'user' ? 'شما' : 'AI'}
                              </div>
                              <div>{message.content}</div>
                            </div>
                            <div className="text-xs opacity-60">{message.timestamp}</div>
                          </div>
                        </div>
                      ))
                    )}
                    
                    {isLoadingChat && (
                      <div className="bg-gray-100 text-gray-800 ml-8 p-2 rounded text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 border-2 border-gray-600 border-t-transparent rounded-full animate-spin"></div>
                          <span>AI در حال پاسخ دادن...</span>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Chat Input */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={currentMessage}
                      onChange={(e) => setCurrentMessage(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendChatMessage();
                        }
                      }}
                      placeholder="سوال خود را بپرسید..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                      disabled={isLoadingChat}
                    />
                    <button
                      onClick={sendChatMessage}
                      disabled={isLoadingChat || !currentMessage.trim()}
                      className="px-4 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      ارسال
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Search Button */}
      {selectedImage && (
        <div className="text-center mb-6">
          <button
            onClick={searchSimilarImages}
            disabled={isLoading || connectionStatus !== 'connected'}
            className="px-8 py-3 bg-green-500 text-white rounded-lg text-lg font-semibold hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <span className="flex items-center gap-2 justify-center">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                در حال جستجو...
              </span>
            ) : (
              '🔍 جستجوی تصاویر مشابه'
            )}
          </button>
        </div>
      )}

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 text-red-800">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 text-green-800">
            <span>✅</span>
            <span>{success}</span>
          </div>
        </div>
      )}

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold mb-4">
            تصاویر مشابه ({searchResults.length} تصویر)
          </h2>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {searchResults.map((result, index) => {
              const imageUrl = getImageUrl(result, index);
              
              return (
                <div key={index} className="border rounded-lg p-3 hover:shadow-lg transition-shadow">
                  <div className="aspect-square mb-3 bg-gray-100 rounded-lg overflow-hidden">
                    {imageUrl ? (
                      <img 
                        src={imageUrl}
                        alt={`شباهت ${result.similarity_score}%`}
                        className="w-full h-full object-cover hover:scale-105 transition-transform"
                        onError={(e) => {
                          e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtc2l6ZT0iMTIiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIiBmaWxsPSIjOWNhM2FmIj7YqtmI2LfYuduRINmE2K/YsSDYqtmF2KfYsdixPC90ZXh0Pjwvc3ZnPg==';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                        تصویر موجود نیست
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <div className="text-center">
                      <span className={`inline-block px-2 py-1 rounded text-sm font-bold ${
                        result.similarity_score >= 80 ? 'text-green-700 bg-green-100' : 
                        result.similarity_score >= 60 ? 'text-yellow-700 bg-yellow-100' : 
                        'text-red-700 bg-red-100'
                      }`}>
                        {result.similarity_score.toFixed(1)}% شباهت
                      </span>
                    </div>
                    
                    <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className={`h-1.5 rounded-full transition-all duration-500 ${
                          result.similarity_score >= 80 ? 'bg-green-500' : 
                          result.similarity_score >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${result.similarity_score}%` }}
                      ></div>
                    </div>
                    
                    <div className="text-xs text-gray-500 text-center">
                      {result.image_data ? '📄 Base64' : '🔗 Path'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Results Summary */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-3 gap-4 text-center text-sm">
              <div>
                <div className="text-lg font-bold text-green-600">
                  {searchResults.filter(r => r.similarity_score >= 80).length}
                </div>
                <div className="text-gray-600">شباهت بالا</div>
              </div>
              <div>
                <div className="text-lg font-bold text-yellow-600">
                  {searchResults.filter(r => r.similarity_score >= 60 && r.similarity_score < 80).length}
                </div>
                <div className="text-gray-600">شباهت متوسط</div>
              </div>
              <div>
                <div className="text-lg font-bold text-red-600">
                  {searchResults.filter(r => r.similarity_score < 60).length}
                </div>
                <div className="text-gray-600">شباهت کم</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center mt-8 text-gray-500 text-sm">
        نسخه 2.1.0 • جستجوی تصاویر مشابه با هوش مصنوعی + امضای دیجیتال PKCS#11
      </div>
      
      {/* CSS Styles */}
      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translate(-50%, -200px);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        }
        
        .transition-all {
          transition: all 0.2s ease-in-out;
        }
        
        .hover\\:scale-105:hover {
          transform: scale(1.05);
        }
        
        .animate-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: .5;
          }
        }
      `}</style>
    </div>
  );
}