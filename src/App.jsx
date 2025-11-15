import React, { useState, useRef, useEffect } from 'react';
import { Trash2, Upload, Download, Wand2 } from 'lucide-react';

export default function GraphCutsSegmentation() {
  const [image, setImage] = useState(null);
  const [imageData, setImageData] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(20);
  const [brushMode, setBrushMode] = useState('foreground');
  const [segmentedImage, setSegmentedImage] = useState(null);
  const [language, setLanguage] = useState('es');
  const [marks, setMarks] = useState({ foreground: [], background: [] });
  const [logs, setLogs] = useState([]);
  
  // --- Nuevos Estados ---
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCvReady, setIsCvReady] = useState(false); // Estado para OpenCV

  const canvasRef = useRef(null);
  const resultCanvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const logsEndRef = useRef(null);

  // ==================== LOG SYSTEM ====================
  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { message, type, timestamp }]);
    console.log(`[${type.toUpperCase()}] ${message}`);
  };

  const clearLogs = () => setLogs([]);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // --- Espera a que OpenCV.js se cargue ---
  useEffect(() => {
    // La función onOpenCvReady es llamada por el script en index.html
    window.onOpenCvReady = () => {
      setIsCvReady(true);
      addLog('✅ OpenCV.js listo.', 'success');
    }
    // Si ya está cargado (p.ej. Hot Reload)
    if (window.cv) {
      setIsCvReady(true);
      addLog('✅ OpenCV.js ya estaba cargado.', 'success');
    } else {
       addLog('... Cargando OpenCV.js (puede tardar)...', 'info');
    }
  }, []);

  const labels = {
    es: {
      title: 'Segmentación con Watershed',
      upload: 'Subir Imagen',
      foreground: 'Objeto (VERDE)',
      background: 'Fondo (ROJO)',
      brush: 'Tamaño: ',
      segment: 'Segmentar',
      processing: 'Procesando...',
      clear: 'Limpiar',
      download: 'Descargar',
      marked: 'Imagen Marcada',
      result: 'Resultado',
      loadingCV: 'Cargando OpenCV...',
    },
    en: {
      title: 'Watershed Segmentation',
      upload: 'Upload Image',
      foreground: 'Object (GREEN)',
      background: 'Background (RED)',
      brush: 'Size: ',
      segment: 'Segment',
      processing: 'Processing...',
      clear: 'Clear',
      download: 'Download',
      marked: 'Marked Image',
      result: 'Result',
      loadingCV: 'Loading OpenCV...',
    },
  };

  const t = labels[language];

  // ==================== HANDLERS ====================

  const handleImageUpload = (e) => {
    // ... (sin cambios)
    addLog('📸 Upload iniciado', 'info');
    const file = e.target.files[0];
    
    if (!file) {
      addLog('❌ No hay archivo', 'error');
      return;
    }

    const reader = new FileReader();
    
    reader.onload = (event) => {
      addLog('✅ FileReader OK', 'success');
      const img = new Image();
      
      img.onload = () => {
        addLog(`📐 Dimensiones: ${img.width}x${img.height}`, 'success');
        
        const canvas = canvasRef.current;
        const resultCanvas = resultCanvasRef.current;

        canvas.width = img.width;
        canvas.height = img.height;
        resultCanvas.width = img.width;
        resultCanvas.height = img.height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        const imgData = ctx.getImageData(0, 0, img.width, img.height);
        
        setImage(img);
        setImageData(imgData);
        setMarks({ foreground: [], background: [] });
        setSegmentedImage(null);
        
        addLog('✅ Imagen lista', 'success');
      };
      
      img.onerror = () => {
        addLog('❌ Error imagen', 'error');
      };
      
      img.src = event.target.result;
    };
    
    reader.readAsDataURL(file);
  };

  const getCanvasCoordinates = (e) => {
    // ... (sin cambios)
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    return { x, y };
  };

  const startDrawing = (e) => {
    // ... (sin cambios)
    setIsDrawing(true);
    drawOnCanvas(e);
  };

  const stopDrawing = () => setIsDrawing(false);

  const drawOnCanvas = (e) => {
    // ... (sin cambios)
    if (!isDrawing || !canvasRef.current) return;
    
    const { x, y } = getCanvasCoordinates(e);
    
    const ctx = canvasRef.current.getContext('2d');
    
    const color = brushMode === 'foreground' ? 'rgba(0, 255, 0, 0.5)' : 'rgba(255, 0, 0, 0.5)';
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, brushSize, 0, Math.PI * 2);
    ctx.fill();

    const mark = { x, y };
    
    setMarks(prev => {
      const newMarks = { ...prev };
      if (brushMode === 'foreground') {
        newMarks.foreground = [...prev.foreground, mark];
      } else {
        newMarks.background = [...prev.background, mark];
      }
      return newMarks;
    });
  };

  // --- ¡ALGORITMO DE SEGMENTACIÓN NUEVO! ---
  const applyWatershedSegment = async () => {
    if (!isCvReady) {
      addLog('❌ OpenCV no está listo.', 'error');
      return;
    }
    
    addLog('🔄 Segmentando con Watershed...', 'info');
    setIsProcessing(true);
    await new Promise(resolve => setTimeout(resolve, 50)); // Dejar que la UI se actualice

    if (!imageData || marks.foreground.length === 0 || marks.background.length === 0) {
      addLog('❌ Faltan imagen o marcas de objeto/fondo.', 'error');
      setIsProcessing(false);
      return;
    }

    const { width, height } = imageData;
    const canvas = resultCanvasRef.current;
    const ctx = canvas.getContext('2d');
    
    let src = null;
    let markers = null;
    
    try {
      // 1. Cargar la imagen original a un cv.Mat
      src = cv.matFromImageData(imageData);
      cv.cvtColor(src, src, cv.COLOR_RGBA2RGB); // Watershed requiere 3 canales (RGB)

      // 2. Crear la imagen de "marcadores" (semillas)
      // CV_32S es un entero de 32 bits, requerido por watershed
      markers = new cv.Mat.zeros(height, width, cv.CV_32S);

      const fgColor = new cv.Scalar(1); // ID para objeto
      const bgColor = new cv.Scalar(2); // ID para fondo
      
      // Radio de la semilla en la imagen de marcadores (pequeño es mejor)
      const seedRadius = 3; 

      // 3. Dibujar las marcas del usuario en la imagen de marcadores
      addLog(`🖌️ Dibujando ${marks.foreground.length} marcas FG...`, 'info');
      for (const mark of marks.foreground) {
        let p = new cv.Point(mark.x, mark.y);
        cv.circle(markers, p, seedRadius, fgColor, -1);
      }

      addLog(`🖌️ Dibujando ${marks.background.length} marcas BG...`, 'info');
      for (const mark of marks.background) {
        let p = new cv.Point(mark.x, mark.y);
        cv.circle(markers, p, seedRadius, bgColor, -1);
      }

      // 4. ¡Ejecutar Watershed!
      addLog('🌊 Aplicando Watershed...', 'info');
      cv.watershed(src, markers);
      addLog('✅ Watershed completado.', 'success');

      // 5. Crear la imagen de resultado
      const resultData = new Uint8ClampedArray(imageData.data);
      let pixelsProcesados = 0;

      for (let i = 0; i < width * height; i++) {
        const markerValue = markers.data32S[i];
        
        // Si el pixel pertenece al objeto (ID 1)...
        if (markerValue === 1) {
          resultData[i * 4 + 3] = 255; // Poner Alpha a 255 (visible)
        } else {
          // Si es fondo (ID 2) o borde (ID -1)...
          resultData[i * 4 + 3] = 0; // Poner Alpha a 0 (invisible)
        }
        pixelsProcesados++;
      }

      addLog(`✅ ${pixelsProcesados} píxeles procesados.`, 'success');
      
      const finalImageData = new ImageData(resultData, width, height);
      ctx.putImageData(finalImageData, 0, 0);
      setSegmentedImage(canvas.toDataURL());
      
      addLog('🎉 SEGMENTACIÓN LISTA.', 'success');

    } catch (err) {
      addLog(`❌ ERROR en Watershed: ${err.message}`, 'error');
      console.error(err);
    } finally {
      // MUY IMPORTANTE: Liberar la memoria de los cv.Mat
      if (src) src.delete();
      if (markers) markers.delete();
      setIsProcessing(false);
    }
  };

  const clearMarks = () => {
    // ... (sin cambios, excepto limpiar resultCanvas)
    if (canvasRef.current && image) {
      const ctx = canvasRef.current.getContext('2d');
      ctx.drawImage(image, 0, 0);
      
      const resCtx = resultCanvasRef.current.getContext('2d');
      resCtx.clearRect(0, 0, resultCanvasRef.current.width, resultCanvasRef.current.height);

      setMarks({ foreground: [], background: [] });
      setSegmentedImage(null);
      addLog('🗑️ Limpio', 'info');
    }
  };

  const downloadResult = () => {
    // ... (sin cambios)
    if (!segmentedImage) return;
    const a = document.createElement('a');
    a.href = segmentedImage;
    a.download = `segmented-${Date.now()}.png`;
    a.click();
    addLog('📥 Descargado', 'success');
  };

  // Deshabilitar todo si OpenCV no está listo
  const isDisabled = !isCvReady || isProcessing;

  return (
    <div className="min-h-screen bg-slate-900 p-4 text-white">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-white">{t.title}</h1>
          <button
            onClick={() => setLanguage(language === 'es' ? 'en' : 'es')}
            className="px-3 py-1 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 transition-colors"
          >
            {language === 'es' ? 'EN' : 'ES'}
          </button>
        </div>

        {/* Controls */}
        <div className="bg-slate-800 p-3 rounded mb-4 border border-slate-700 flex flex-wrap gap-2 items-center">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-2 bg-blue-600 text-white rounded text-sm flex items-center gap-1 hover:bg-blue-700 transition-colors disabled:opacity-50"
            disabled={isDisabled}
          >
            <Upload size={16} />
            {t.upload}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />

          <button
            onClick={() => setBrushMode('foreground')}
            className={`px-3 py-2 rounded text-sm font-bold transition-colors ${
              brushMode === 'foreground'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
            disabled={isDisabled}
          >
            🟢 {t.foreground}
          </button>

          <button
            onClick={() => setBrushMode('background')}
            className={`px-3 py-2 rounded text-sm font-bold transition-colors ${
              brushMode === 'background'
                ? 'bg-red-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
            disabled={isDisabled}
          >
            🔴 {t.background}
          </button>

          <div className="flex items-center gap-2 px-2 bg-slate-700 rounded">
            <span className="text-white text-sm">{t.brush}</span>
            <input
              type="range"
              min="5"
              max="50"
              value={brushSize}
              onChange={(e) => setBrushSize(parseInt(e.target.value))}
              className="w-24"
              disabled={isDisabled}
            />
            <span className="text-white text-sm font-bold w-6 text-right">{brushSize}</span>
          </div>

          <button
            onClick={applyWatershedSegment}
            className="px-3 py-2 bg-emerald-600 text-white rounded text-sm font-bold flex items-center gap-1 hover:bg-emerald-700 transition-colors disabled:bg-emerald-800 disabled:text-slate-400"
            disabled={isDisabled}
          >
            {!isCvReady ? (
              <>{t.loadingCV}</>
            ) : isProcessing ? (
              <>
                <div className="w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin"></div>
                {t.processing}
              </>
            ) : (
              <>
                <Wand2 size={16} />
                {t.segment}
              </>
            )}
          </button>

          <button
            onClick={clearMarks}
            className="px-3 py-2 bg-slate-700 text-slate-300 rounded text-sm flex items-center gap-1 hover:bg-slate-600 transition-colors"
            disabled={isDisabled}
          >
            <Trash2 size={16} />
            {t.clear}
          </button>

          {segmentedImage && (
            <button
              onClick={downloadResult}
              className="px-3 py-2 bg-purple-600 text-white rounded text-sm flex items-center gap-1 hover:bg-purple-700 transition-colors"
            >
              <Download size={16} />
              {t.download}
            </button>
          )}
        </div>

        {/* --- Main Area --- */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          
          <div className="lg:col-span-2 bg-slate-800 p-3 rounded border border-slate-700">
            <h3 className="text-white font-bold mb-2 text-sm">{t.marked}</h3>
            <div className="bg-black rounded overflow-hidden border border-slate-600 w-full">
              <div className="flex justify-center items-center">
                <canvas
                  ref={canvasRef}
                  onMouseDown={startDrawing}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onMouseMove={drawOnCanvas}
                  className="cursor-crosshair"
                  style={{ display: image ? 'block' : 'none', width: '100%', height: 'auto' }}
                />
              </div>
              {!image && (
                <div className="w-full h-64 lg:h-96 flex items-center justify-center text-slate-500 text-sm">
                  {isCvReady ? 'Sube una imagen para empezar' : 'Cargando OpenCV...'}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-2 bg-slate-800 p-3 rounded border border-slate-700">
            <h3 className="text-white font-bold mb-2 text-sm">{t.result}</h3>
            <div className="bg-black rounded overflow-hidden border border-slate-600 w-full">
              <div className="flex justify-center items-center">
                {segmentedImage ? (
                  <img src={segmentedImage} alt="Result" className="w-full h-auto" />
                ) : (
                  <div className="w-full h-64 lg:h-96 flex items-center justify-center text-slate-500 text-sm">
                    {isProcessing ? 'Procesando...' : 'Aquí aparecerá el resultado'}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-1 bg-slate-800 p-3 rounded border border-slate-700 flex flex-col" style={{maxHeight: 'calc(100vh - 10rem)'}}>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-white font-bold text-sm">📋 Logs</h3>
              <button
                onClick={clearLogs}
                className="text-xs px-2 py-1 bg-slate-700 text-slate-300 rounded hover:bg-slate-600"
              >
                Limpiar
              </button>
            </div>
            <div className="bg-black rounded p-2 flex-grow overflow-y-auto border border-slate-600 font-mono text-xs space-y-0.5">
              {logs.length === 0 ? (
                <div className="text-slate-600">Esperando...</div>
              ) : (
                logs.map((log, idx) => (
                  <div
                    key={idx}
                    className={`${
                      log.type === 'success'
                        ? 'text-emerald-400'
                        : log.type === 'error'
                        ? 'text-red-400'
                        : 'text-slate-400'
                    }`}
                  >
                    <span className="text-gray-600 mr-1">[{log.timestamp}]</span> 
                    {log.message}
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>
          </div>
        </div>

        {/* Hidden Canvas */}
        <canvas ref={resultCanvasRef} className="hidden" />
      </div>
    </div>
  );
}