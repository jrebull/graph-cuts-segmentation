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
      brush: 'Tamaño Brocha',
      segment: 'Segmentar',
      clear: 'Limpiar',
      download: 'Descargar',
      marked: 'Imagen Marcada',
      result: 'Resultado',
      instructions: 'Verde = objeto. Rojo = fondo.',
    },
    en: {
      title: 'Graph Cuts Segmentation',
      upload: 'Upload Image',
      foreground: 'Object (GREEN)',
      background: 'Background (RED)',
      brush: 'Brush Size',
      segment: 'Segment',
      clear: 'Clear',
      download: 'Download',
      marked: 'Marked Image',
      result: 'Result',
      instructions: 'Green = object. Red = background.',
    },
  };

  const t = labels[language];

  // ==================== HANDLERS ====================

  const handleImageUpload = (e) => {
    addLog('📸 Upload iniciado', 'info');
    const file = e.target.files[0];
    
    if (!file) {
      addLog('❌ No hay archivo seleccionado', 'error');
      return;
    }

    addLog(`📄 Archivo: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`, 'info');

    const reader = new FileReader();
    
    reader.onload = (event) => {
      addLog('✅ FileReader completado', 'success');
      const img = new Image();
      
      img.onload = () => {
        addLog(`📐 Dimensiones: ${img.width}x${img.height}`, 'success');
        
        const canvas = canvasRef.current;
        if (!canvas) {
          addLog('❌ Canvas ref no disponible', 'error');
          return;
        }

        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          addLog('❌ Context 2D no disponible', 'error');
          return;
        }

        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, img.width, img.height);
        
        setImage(img);
        setImageData(imgData);
        setMarks({ foreground: [], background: [] });
        setSegmentedImage(null);
        
        addLog('✅ Imagen cargada correctamente', 'success');
      };
      
      img.onerror = () => {
        addLog('❌ Error cargando imagen', 'error');
      };
      
      img.src = event.target.result;
    };
    
    reader.onerror = () => {
      addLog('❌ Error leyendo archivo', 'error');
    };
    
    reader.readAsDataURL(file);
  };

  const drawOnCanvas = (e) => {
    if (!isDrawing || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const color = brushMode === 'foreground' ? 'rgba(0, 255, 0, 0.4)' : 'rgba(255, 0, 0, 0.4)';
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, brushSize, 0, Math.PI * 2);
    ctx.fill();

    const mark = { x: Math.round(x), y: Math.round(y) };
    
    if (brushMode === 'foreground') {
      setMarks(prev => ({ ...prev, foreground: [...prev.foreground, mark] }));
    } else {
      setMarks(prev => ({ ...prev, background: [...prev.background, mark] }));
    }
  };

  const applyGraphCuts = () => {
    addLog('🔄 Iniciando segmentación...', 'info');
    
    if (!imageData) {
      addLog('❌ No hay imagen cargada', 'error');
      return;
    }

    if (marks.foreground.length === 0 || marks.background.length === 0) {
      addLog('❌ Marca objeto (verde) y fondo (rojo)', 'error');
      return;
    }

    addLog(`📊 Marcas: ${marks.foreground.length} foreground, ${marks.background.length} background`, 'info');

    const canvas = resultCanvasRef.current;
    if (!canvas) {
      addLog('❌ Result canvas no disponible', 'error');
      return;
    }

    const width = imageData.width;
    const height = imageData.height;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      addLog('❌ Result context no disponible', 'error');
      return;
    }

    try {
      addLog('⚙️ Procesando píxeles...', 'info');
      
      const result = new Uint8ClampedArray(imageData.data);
      let processedPixels = 0;

      // Obtener modelo de colores
      const fgColors = [];
      const bgColors = [];

      marks.foreground.forEach(mark => {
        for (let dy = -30; dy <= 30; dy++) {
          for (let dx = -30; dx <= 30; dx++) {
            const px = Math.max(0, Math.min(width - 1, mark.x + dx));
            const py = Math.max(0, Math.min(height - 1, mark.y + dy));
            const idx = (py * width + px) * 4;
            fgColors.push({
              r: imageData.data[idx],
              g: imageData.data[idx + 1],
              b: imageData.data[idx + 2],
            });
          }
        }
      });

      marks.background.forEach(mark => {
        for (let dy = -30; dy <= 30; dy++) {
          for (let dx = -30; dx <= 30; dx++) {
            const px = Math.max(0, Math.min(width - 1, mark.x + dx));
            const py = Math.max(0, Math.min(height - 1, mark.y + dy));
            const idx = (py * width + px) * 4;
            bgColors.push({
              r: imageData.data[idx],
              g: imageData.data[idx + 1],
              b: imageData.data[idx + 2],
            });
          }
        }
      });

      addLog(`🎨 Colores modelo: ${fgColors.length} foreground, ${bgColors.length} background`, 'info');

      // Procesar cada píxel
      for (let i = 0; i < width * height; i++) {
        const pixelIdx = i * 4;
        const px = i % width;
        const py = Math.floor(i / width);

        const r = imageData.data[pixelIdx];
        const g = imageData.data[pixelIdx + 1];
        const b = imageData.data[pixelIdx + 2];

        // Similitud de color
        let minDistFg = Infinity;
        let minDistBg = Infinity;

        for (let color of fgColors) {
          const dist = Math.pow(r - color.r, 2) + Math.pow(g - color.g, 2) + Math.pow(b - color.b, 2);
          minDistFg = Math.min(minDistFg, dist);
        }

        for (let color of bgColors) {
          const dist = Math.pow(r - color.r, 2) + Math.pow(g - color.g, 2) + Math.pow(b - color.b, 2);
          minDistBg = Math.min(minDistBg, dist);
        }

        // Distancia a marcas
        let distToFgMark = Infinity;
        let distToBgMark = Infinity;

        marks.foreground.forEach(mark => {
          const dist = Math.pow(px - mark.x, 2) + Math.pow(py - mark.y, 2);
          distToFgMark = Math.min(distToFgMark, dist);
        });

        marks.background.forEach(mark => {
          const dist = Math.pow(px - mark.x, 2) + Math.pow(py - mark.y, 2);
          distToBgMark = Math.min(distToBgMark, dist);
        });

        // Combinar: 70% color, 30% distancia
        const fgScore = (1 - Math.sqrt(minDistFg) / 255) * 0.7 + (1 - Math.sqrt(distToFgMark) / 200) * 0.3;
        const bgScore = (1 - Math.sqrt(minDistBg) / 255) * 0.7 + (1 - Math.sqrt(distToBgMark) / 200) * 0.3;

        result[pixelIdx + 3] = fgScore > bgScore ? 255 : 0;
        processedPixels++;
      }

      addLog(`✅ Procesados ${processedPixels} píxeles`, 'success');

      // Dibujar resultado
      const resultData = new ImageData(result, width, height);
      ctx.putImageData(resultData, 0, 0);
      setSegmentedImage(canvas.toDataURL());
      
      addLog('✅ Segmentación completada', 'success');
    } catch (err) {
      addLog(`❌ Error: ${err.message}`, 'error');
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
        addLog('🗑️ Marcas limpias', 'info');
      }
    }
  };

  const downloadResult = () => {
    if (!segmentedImage) return;
    const a = document.createElement('a');
    a.href = segmentedImage;
    a.download = `segmented-${Date.now()}.png`;
    a.click();
    addLog('📥 Imagen descargada', 'success');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-white">{t.title}</h1>
            <p className="text-slate-400 text-sm mt-1">{t.instructions}</p>
          </div>
          <button
            onClick={() => setLanguage(language === 'es' ? 'en' : 'es')}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg"
          >
            {language === 'es' ? 'EN' : 'ES'}
          </button>
        </div>

        {/* Controls */}
        <div className="bg-slate-800 rounded-lg p-4 mb-6 border border-slate-700 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg flex items-center justify-center gap-2"
          >
            <Upload size={18} />
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
            className={`px-4 py-2 rounded-lg font-semibold ${
              brushMode === 'foreground'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-700 text-slate-300'
            }`}
          >
            🟢 {t.foreground}
          </button>

          <button
            onClick={() => setBrushMode('background')}
            className={`px-4 py-2 rounded-lg font-semibold ${
              brushMode === 'background' ? 'bg-red-600 text-white' : 'bg-slate-700 text-slate-300'
            }`}
          >
            🔴 {t.background}
          </button>

          <div className="flex items-center gap-2">
            <input
              type="range"
              min="5"
              max="50"
              value={brushSize}
              onChange={(e) => setBrushSize(parseInt(e.target.value))}
              className="flex-1"
            />
            <span className="text-white font-bold w-8">{brushSize}</span>
          </div>

          <button
            onClick={applyGraphCuts}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg flex items-center justify-center gap-2"
          >
            <Wand2 size={18} />
            {t.segment}
          </button>

          <button
            onClick={clearMarks}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg flex items-center justify-center gap-2"
          >
            <Trash2 size={18} />
            {t.clear}
          </button>

          {segmentedImage && (
            <button
              onClick={downloadResult}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg flex items-center justify-center gap-2"
            >
              <Download size={18} />
              {t.download}
            </button>
          )}
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left: Input Canvas */}
          <div className="lg:col-span-1 bg-slate-800 rounded-lg p-4 border border-slate-700">
            <h3 className="text-lg font-bold text-white mb-3">{t.marked}</h3>
            <div className="bg-black rounded-lg overflow-hidden flex items-center justify-center border-2 border-slate-600">
              <canvas
                ref={canvasRef}
                onMouseDown={() => setIsDrawing(true)}
                onMouseUp={() => setIsDrawing(false)}
                onMouseLeave={() => setIsDrawing(false)}
                onMouseMove={drawOnCanvas}
                className="max-w-full max-h-64 cursor-crosshair"
              />
            </div>
          </div>

          {/* Center: Result Canvas */}
          <div className="lg:col-span-1 bg-slate-800 rounded-lg p-4 border border-slate-700">
            <h3 className="text-lg font-bold text-white mb-3">{t.result}</h3>
            <div className="bg-black rounded-lg overflow-hidden flex items-center justify-center border-2 border-slate-600 h-64">
              {segmentedImage ? (
                <img src={segmentedImage} alt="Result" className="max-w-full max-h-64" />
              ) : (
                <div className="text-center text-slate-500">
                  <Wand2 size={40} className="mx-auto opacity-50" />
                </div>
              )}
            </div>
          </div>

          {/* Right: Logs */}
          <div className="lg:col-span-1 bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-bold text-white">📋 Logs</h3>
              <button
                onClick={clearLogs}
                className="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded"
              >
                Clear
              </button>
            </div>
            <div className="bg-black rounded-lg p-3 h-64 overflow-y-auto border border-slate-600 font-mono text-xs space-y-1">
              {logs.length === 0 ? (
                <div className="text-slate-500">Esperando acciones...</div>
              ) : (
                logs.map((log, idx) => (
                  <div
                    key={idx}
                    className={`${
                      log.type === 'success'
                        ? 'text-emerald-400'
                        : log.type === 'error'
                        ? 'text-red-400'
                        : 'text-slate-300'
                    }`}
                  >
                    <span className="text-slate-600">[{log.timestamp}]</span> {log.message}
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
