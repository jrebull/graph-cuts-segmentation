import React, { useState, useRef } from 'react';
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
  const [isProcessing, setIsProcessing] = useState(false); // Estado para loading

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

  const clearLogs = () => {
    setLogs([]);
  };

  React.useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const labels = {
    es: {
      title: 'Segmentación con Graph Cuts',
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
    },
    en: {
      title: 'Graph Cuts Segmentation',
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
    },
  };

  const t = labels[language];

  // ==================== HANDLERS ====================

  const handleImageUpload = (e) => {
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

        // Ajustar tamaño de canvas
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
    setIsDrawing(true);
    drawOnCanvas(e); // Dibuja el primer punto
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const drawOnCanvas = (e) => {
    if (!isDrawing || !canvasRef.current) return;
    
    const { x, y } = getCanvasCoordinates(e);
    
    const ctx = canvasRef.current.getContext('2d');
    
    // Dibujar círculo
    const color = brushMode === 'foreground' ? 'rgba(0, 255, 0, 0.5)' : 'rgba(255, 0, 0, 0.5)';
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, brushSize, 0, Math.PI * 2);
    ctx.fill();

    // Guardar marca
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

  // Esta función ahora es asíncrona para permitir que la UI se actualice
  const applyGraphCuts = async () => {
    addLog('🔄 Segmentando...', 'info');
    setIsProcessing(true);

    // Pequeña pausa para que el estado 'isProcessing' actualice la UI
    await new Promise(resolve => setTimeout(resolve, 50));

    if (!imageData) {
      addLog('❌ Sin imagen', 'error');
      setIsProcessing(false);
      return;
    }

    if (marks.foreground.length === 0 || marks.background.length === 0) {
      addLog('❌ Marca verde y rojo', 'error');
      setIsProcessing(false);
      return;
    }

    addLog(`📊 Marcas: ${marks.foreground.length} verde, ${marks.background.length} rojo`, 'info');

    const canvas = resultCanvasRef.current;
    const width = imageData.width;
    const height = imageData.height;

    const ctx = canvas.getContext('2d');

    try {
      const result = new Uint8ClampedArray(imageData.data);

      // --- Recolección de colores optimizada ---
      const fgColors = [];
      const bgColors = [];
      const sampleSize = 2; // Área de 5x5 (de -2 a +2)

      const addColorSamples = (markList, colorArray) => {
        markList.forEach(mark => {
          for (let dy = -sampleSize; dy <= sampleSize; dy++) {
            for (let dx = -sampleSize; dx <= sampleSize; dx++) {
              const px = Math.max(0, Math.min(width - 1, Math.round(mark.x + dx)));
              const py = Math.max(0, Math.min(height - 1, Math.round(mark.y + dy)));
              const idx = (py * width + px) * 4;
              colorArray.push({
                r: imageData.data[idx],
                g: imageData.data[idx + 1],
                b: imageData.data[idx + 2],
              });
            }
          }
        });
      };

      addColorSamples(marks.foreground, fgColors);
      addColorSamples(marks.background, bgColors);

      addLog(`🎨 Colores: ${fgColors.length} fg, ${bgColors.length} bg`, 'success');
      
      if (fgColors.length === 0 || bgColors.length === 0) {
         addLog('❌ No se pudieron muestrear colores. Dibuja marcas válidas.', 'error');
         setIsProcessing(false);
         return;
      }

      // --- ¡NUEVO! Calcular Color Promedio ---
      const getAverageColor = (colors) => {
        let r = 0, g = 0, b = 0;
        colors.forEach(color => {
          r += color.r;
          g += color.g;
          b += color.b;
        });
        return {
          r: r / colors.length,
          g: g / colors.length,
          b: b / colors.length,
        };
      };

      const avgFg = getAverageColor(fgColors);
      const avgBg = getAverageColor(bgColors);

      addLog(`🎨 Promedio FG: R ${avgFg.r.toFixed(0)}, G ${avgFg.g.toFixed(0)}, B ${avgFg.b.toFixed(0)}`, 'info');
      addLog(`🎨 Promedio BG: R ${avgBg.r.toFixed(0)}, G ${avgBg.g.toFixed(0)}, B ${avgBg.b.toFixed(0)}`, 'info');

      // --- Normalización y Pesos ---
      const maxColorDist = Math.sqrt(255**2 * 3); // Distancia máxima en espacio RGB
      const maxImageDist = Math.sqrt(width**2 + height**2); // Distancia máxima en píxeles
      const colorWeight = 0.8; // 80% importancia al color
      const distWeight = 0.2;  // 20% importancia a la distancia

      // --- Procesar píxeles ---
      let pixelsProcesados = 0;
      for (let i = 0; i < width * height; i++) {
        const pixelIdx = i * 4;
        const px = i % width;
        const py = Math.floor(i / width);

        const r = imageData.data[pixelIdx];
        const g = imageData.data[pixelIdx + 1];
        const b = imageData.data[pixelIdx + 2];

        // --- ¡MODIFICADO! Calcular distancias de color (contra promedios) ---
        const distToAvgFg = (r - avgFg.r)**2 + (g - avgFg.g)**2 + (b - avgFg.b)**2;
        const distToAvgBg = (r - avgBg.r)**2 + (g - avgBg.g)**2 + (b - avgBg.b)**2;

        // --- Calcular distancias de marcas (1-NN) ---
        let distFgMark = Infinity;
        let distBgMark = Infinity;

        for (const mark of marks.foreground) {
          const dist = (px - mark.x)**2 + (py - mark.y)**2;
          distFgMark = Math.min(distFgMark, dist);
        }

        for (const mark of marks.background) {
          const dist = (px - mark.x)**2 + (py - mark.y)**2;
          distBgMark = Math.min(distBgMark, dist);
        }

        // --- Puntuación final normalizada ---
        // Tomamos la raíz cuadrada para obtener la distancia euclidiana real
        const normFgColorScore = Math.sqrt(distToAvgFg) / maxColorDist;
        const normBgColorScore = Math.sqrt(distToAvgBg) / maxColorDist;
        
        const normFgDistScore = Math.sqrt(distFgMark) / maxImageDist;
        const normBgDistScore = Math.sqrt(distBgMark) / maxImageDist;

        // Puntuación total (menor es mejor)
        const totalFgScore = (normFgColorScore * colorWeight) + (normFgDistScore * distWeight);
        const totalBgScore = (normBgColorScore * colorWeight) + (normBgDistScore * distWeight);

        // Si la puntuación del objeto (fg) es menor, es objeto.
        result[pixelIdx + 3] = totalFgScore < totalBgScore ? 255 : 0;
        pixelsProcesados++;
      }

      addLog(`✅ ${pixelsProcesados} píxeles procesados`, 'success');

      const resultData = new ImageData(result, width, height);
      ctx.putImageData(resultData, 0, 0);
      setSegmentedImage(canvas.toDataURL());
      
      addLog('✅ SEGMENTACIÓN LISTA', 'success');
    } catch (err) {
      addLog(`❌ ${err.message}`, 'error');
    } finally {
      setIsProcessing(false); // Termina el procesamiento
    }
  };

  const clearMarks = () => {
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
    if (!segmentedImage) return;
    const a = document.createElement('a');
    a.href = segmentedImage;
    a.download = `segmented-${Date.now()}.png`;
    a.click();
    addLog('📥 Descargado', 'success');
  };

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
            className="px-3 py-2 bg-blue-600 text-white rounded text-sm flex items-center gap-1 hover:bg-blue-700 transition-colors"
            disabled={isProcessing}
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
            disabled={isProcessing}
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
            disabled={isProcessing}
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
              disabled={isProcessing}
            />
            <span className="text-white text-sm font-bold w-6 text-right">{brushSize}</span>
          </div>

          <button
            onClick={applyGraphCuts}
            className="px-3 py-2 bg-emerald-600 text-white rounded text-sm font-bold flex items-center gap-1 hover:bg-emerald-700 transition-colors disabled:bg-emerald-800 disabled:text-slate-400"
            disabled={isProcessing}
          >
            {isProcessing ? (
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
            disabled={isProcessing}
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

        {/* --- Main Area (Nuevo Layout) --- */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          
          {/* Columna Izquierda: Imagen Marcada */}
          <div className="lg:col-span-2 bg-slate-800 p-3 rounded border border-slate-700">
            <h3 className="text-white font-bold mb-2 text-sm">{t.marked}</h3>
            <div className="bg-black rounded overflow-hidden border border-slate-600 w-full">
              {/* Contenedor para centrar el canvas si es más pequeño que el div */}
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
                  Sube una imagen para empezar
                </div>
              )}
            </div>
          </div>

          {/* Columna Central: Resultado */}
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

          {/* Columna Derecha: Logs */}
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