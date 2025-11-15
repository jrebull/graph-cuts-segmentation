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
        if (!canvas) {
          addLog('❌ Canvas ref NULL', 'error');
          return;
        }

        canvas.width = img.width;
        canvas.height = img.height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          addLog('❌ Context NULL', 'error');
          return;
        }

        ctx.drawImage(img, 0, 0);
        
        const imgData = ctx.getImageData(0, 0, img.width, img.height);
        
        setImage(img);
        setImageData(imgData);
        setMarks({ foreground: [], background: [] });
        setSegmentedImage(null);
        
        addLog('✅ Imagen cargada', 'success');
      };
      
      img.onerror = () => {
        addLog('❌ Error cargando imagen', 'error');
      };
      
      img.src = event.target.result;
    };
    
    reader.readAsDataURL(file);
  };

  const drawOnCanvas = (e) => {
    if (!isDrawing || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    
    const ctx = canvas.getContext('2d');
    
    const color = brushMode === 'foreground' ? 'rgba(0, 255, 0, 0.5)' : 'rgba(255, 0, 0, 0.5)';
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, brushSize, 0, Math.PI * 2);
    ctx.fill();

    const mark = { x, y };
    
    if (brushMode === 'foreground') {
      setMarks(prev => {
        const newMarks = { ...prev, foreground: [...prev.foreground, mark] };
        addLog(`✏️ Verde: ${newMarks.foreground.length}`, 'info');
        return newMarks;
      });
    } else {
      setMarks(prev => {
        const newMarks = { ...prev, background: [...prev.background, mark] };
        addLog(`✏️ Rojo: ${newMarks.background.length}`, 'info');
        return newMarks;
      });
    }
  };

  const applyGraphCuts = () => {
    addLog('🔄 INICIANDO SEGMENTACIÓN', 'info');
    
    if (!imageData) {
      addLog('❌ SIN IMAGEN', 'error');
      return;
    }

    addLog(`📊 Estado: fg=${marks.foreground.length}, bg=${marks.background.length}`, 'info');

    if (marks.foreground.length === 0 || marks.background.length === 0) {
      addLog('❌ MARCA VERDE Y ROJO', 'error');
      return;
    }

    const canvas = resultCanvasRef.current;
    if (!canvas) {
      addLog('❌ RESULT CANVAS NULL', 'error');
      return;
    }

    const width = imageData.width;
    const height = imageData.height;
    
    addLog(`📐 Canvas: ${width}x${height}`, 'info');
    
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      addLog('❌ RESULT CONTEXT NULL', 'error');
      return;
    }

    try {
      addLog('⚙️ CREANDO RESULTADO', 'info');
      
      const result = new Uint8ClampedArray(imageData.data);

      addLog('🎨 EXTRAYENDO COLORES', 'info');

      // Extraer colores simple
      const fgPixels = [];
      const bgPixels = [];

      // Copiar píxeles alrededor de cada marca
      marks.foreground.forEach((mark, idx) => {
        const r = Math.round(mark.x);
        const c = Math.round(mark.y);
        
        for (let dy = -15; dy <= 15; dy++) {
          for (let dx = -15; dx <= 15; dx++) {
            const py = Math.max(0, Math.min(height - 1, c + dy));
            const px = Math.max(0, Math.min(width - 1, r + dx));
            const i = (py * width + px) * 4;
            fgPixels.push({
              r: imageData.data[i],
              g: imageData.data[i + 1],
              b: imageData.data[i + 2],
            });
          }
        }
      });

      marks.background.forEach((mark, idx) => {
        const r = Math.round(mark.x);
        const c = Math.round(mark.y);
        
        for (let dy = -15; dy <= 15; dy++) {
          for (let dx = -15; dx <= 15; dx++) {
            const py = Math.max(0, Math.min(height - 1, c + dy));
            const px = Math.max(0, Math.min(width - 1, r + dx));
            const i = (py * width + px) * 4;
            bgPixels.push({
              r: imageData.data[i],
              g: imageData.data[i + 1],
              b: imageData.data[i + 2],
            });
          }
        }
      });

      addLog(`🎨 Colores: fg=${fgPixels.length}, bg=${bgPixels.length}`, 'success');

      // Algoritmo simple
      addLog('🔄 PROCESANDO PÍXELES', 'info');
      
      let count = 0;
      for (let i = 0; i < width * height; i++) {
        const idx = i * 4;
        const px = i % width;
        const py = Math.floor(i / width);
        const r = imageData.data[idx];
        const g = imageData.data[idx + 1];
        const b = imageData.data[idx + 2];

        // Distancia a colores foreground
        let minDistFg = Infinity;
        for (let fgPix of fgPixels) {
          const d = Math.pow(r - fgPix.r, 2) + Math.pow(g - fgPix.g, 2) + Math.pow(b - fgPix.b, 2);
          if (d < minDistFg) minDistFg = d;
        }

        // Distancia a colores background
        let minDistBg = Infinity;
        for (let bgPix of bgPixels) {
          const d = Math.pow(r - bgPix.r, 2) + Math.pow(g - bgPix.g, 2) + Math.pow(b - bgPix.b, 2);
          if (d < minDistBg) minDistBg = d;
        }

        // Decisión simple
        if (minDistFg < minDistBg) {
          result[idx + 3] = 255; // Foreground opaco
          count++;
        } else {
          result[idx + 3] = 0; // Background transparente
        }
      }

      addLog(`✅ Píxeles foreground: ${count}`, 'success');

      // Dibujar
      addLog('🎨 DIBUJANDO RESULTADO', 'info');
      const resultData = new ImageData(result, width, height);
      ctx.putImageData(resultData, 0, 0);
      
      addLog('📸 CONVIRTIENDO A IMAGE', 'info');
      const dataUrl = canvas.toDataURL();
      setSegmentedImage(dataUrl);
      
      addLog('✅ ✅ ✅ SEGMENTACIÓN COMPLETADA ✅ ✅ ✅', 'success');
    } catch (err) {
      addLog(`❌ ERROR: ${err.message}`, 'error');
      addLog(`Stack: ${err.stack}`, 'error');
      console.error(err);
    }
  };

  const clearMarks = () => {
    if (canvasRef.current && image) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.drawImage(image, 0, 0);
        setMarks({ foreground: [], background: [] });
        setSegmentedImage(null);
        addLog('🗑️ Limpio', 'info');
      }
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
    <div className="min-h-screen bg-slate-900 p-4">
      <div className="max-w-full">
        {/* Header */}
        <div className="mb-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-white">{t.title}</h1>
          <button
            onClick={() => setLanguage(language === 'es' ? 'en' : 'es')}
            className="px-3 py-1 bg-purple-600 text-white rounded text-sm"
          >
            {language === 'es' ? 'EN' : 'ES'}
          </button>
        </div>

        {/* Controls */}
        <div className="bg-slate-800 p-3 rounded mb-4 border border-slate-700 flex flex-wrap gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-2 bg-blue-600 text-white rounded text-sm flex items-center gap-1 font-bold"
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
            className={`px-3 py-2 rounded text-sm font-bold ${
              brushMode === 'foreground'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-700 text-slate-300'
            }`}
          >
            🟢 {t.foreground}
          </button>

          <button
            onClick={() => setBrushMode('background')}
            className={`px-3 py-2 rounded text-sm font-bold ${
              brushMode === 'background'
                ? 'bg-red-600 text-white'
                : 'bg-slate-700 text-slate-300'
            }`}
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
              className="w-20"
            />
            <span className="text-white text-sm font-bold w-6">{brushSize}</span>
          </div>

          <button
            onClick={applyGraphCuts}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-sm font-bold flex items-center gap-1"
          >
            <Wand2 size={16} />
            {t.segment}
          </button>

          <button
            onClick={clearMarks}
            className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded text-sm flex items-center gap-1 font-bold"
          >
            <Trash2 size={16} />
            {t.clear}
          </button>

          {segmentedImage && (
            <button
              onClick={downloadResult}
              className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded text-sm flex items-center gap-1 font-bold"
            >
              <Download size={16} />
              {t.download}
            </button>
          )}
        </div>

        {/* Main Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left: Input Canvas */}
          <div className="lg:col-span-1 bg-slate-800 p-3 rounded border border-slate-700">
            <h3 className="text-white font-bold mb-2 text-sm">{t.marked}</h3>
            <div className="bg-black rounded overflow-hidden border border-slate-600">
              <canvas
                ref={canvasRef}
                onMouseDown={() => setIsDrawing(true)}
                onMouseUp={() => setIsDrawing(false)}
                onMouseLeave={() => setIsDrawing(false)}
                onMouseMove={drawOnCanvas}
                className="w-full cursor-crosshair max-w-sm"
                style={{ display: image ? 'block' : 'none' }}
              />
              {!image && (
                <div className="w-full h-64 flex items-center justify-center text-slate-500 text-sm">
                  Sube imagen
                </div>
              )}
            </div>
          </div>

          {/* Center: Result Canvas */}
          <div className="lg:col-span-1 bg-slate-800 p-3 rounded border border-slate-700">
            <h3 className="text-white font-bold mb-2 text-sm">{t.result}</h3>
            <div className="bg-black rounded overflow-hidden border border-slate-600">
              {segmentedImage ? (
                <img src={segmentedImage} alt="Result" className="w-full max-w-sm" />
              ) : (
                <div className="w-full h-64 flex items-center justify-center text-slate-500 text-sm">
                  Segmenta
                </div>
              )}
            </div>
          </div>

          {/* Right: Logs */}
          <div className="lg:col-span-1 bg-slate-800 p-3 rounded border border-slate-700">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-white font-bold text-sm">📋 Logs</h3>
              <button
                onClick={clearLogs}
                className="text-xs px-2 py-1 bg-slate-700 text-slate-300 rounded hover:bg-slate-600"
              >
                Clear
              </button>
            </div>
            <div className="bg-black rounded p-2 h-64 overflow-y-auto border border-slate-600 font-mono text-xs space-y-0.5">
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
                    <span className="text-slate-700">[{log.timestamp}]</span> {log.message}
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
