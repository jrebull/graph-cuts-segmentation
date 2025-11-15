import React, { useState, useRef, useEffect } from 'react';
import { Trash2, Upload, Download, Wand2, Settings } from 'lucide-react';

export default function GraphCutsSegmentation() {
  // ==================== STATE ====================
  const [originalImage, setOriginalImage] = useState(null);
  const [imageData, setImageData] = useState(null);
  const [segmentedImage, setSegmentedImage] = useState(null);
  const [language, setLanguage] = useState('es');
  const [brushSize, setBrushSize] = useState(20);
  const [brushMode, setBrushMode] = useState('foreground');
  const [isDrawing, setIsDrawing] = useState(false);
  const [marks, setMarks] = useState({ foreground: [], background: [] });
  const [processing, setProcessing] = useState(false);

  // ==================== REFS ====================
  const inputCanvasRef = useRef(null);
  const outputCanvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const drawingCanvasRef = useRef(null);
  const lastPosRef = useRef({ x: 0, y: 0 });

  // ==================== LABELS ====================
  const labels = {
    es: {
      title: 'Segmentación Inteligente con Graph Cuts',
      subtitle: 'Dibuja: VERDE = objeto, ROJO = fondo',
      upload: 'Subir Imagen',
      foreground: 'Objeto (VERDE)',
      background: 'Fondo (ROJO)',
      brush: 'Brocha',
      segment: 'Segmentar',
      clear: 'Limpiar',
      download: 'Descargar PNG',
      marked: 'Marcas',
      result: 'Resultado',
      instructions: 'Verde = objeto. Rojo = fondo.',
      processing: 'Procesando...',
      getStarted: 'Comienza aquí',
      uploadHint: 'Sube una imagen',
    },
    en: {
      title: 'Intelligent Segmentation with Graph Cuts',
      subtitle: 'Draw: GREEN = object, RED = background',
      upload: 'Upload Image',
      foreground: 'Object (GREEN)',
      background: 'Background (RED)',
      brush: 'Brush',
      segment: 'Segment',
      clear: 'Clear',
      download: 'Download PNG',
      marked: 'Marks',
      result: 'Result',
      instructions: 'Green = object. Red = background.',
      processing: 'Processing...',
      getStarted: 'Get Started',
      uploadHint: 'Upload an image',
    },
  };

  const t = labels[language];

  // ==================== UTILIDADES - OPTIMIZADAS ====================

  const colorDistance = (r1, g1, b1, r2, g2, b2) => {
    const dr = r1 - r2;
    const dg = g1 - g2;
    const db = b1 - b2;
    return dr * dr + dg * dg + db * db; // Squared distance (más rápido)
  };

  const getColorModel = (pixelData, marks, width, height) => {
    const colors = [];
    if (marks.length === 0) return colors;
    
    marks.forEach(mark => {
      const radius = 20;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const px = mark.x + dx;
          const py = mark.y + dy;
          if (px >= 0 && px < width && py >= 0 && py < height) {
            const idx = (py * width + px) * 4;
            colors.push({
              r: pixelData[idx],
              g: pixelData[idx + 1],
              b: pixelData[idx + 2],
            });
          }
        }
      }
    });
    return colors;
  };

  const colorSimilarity = (r, g, b, colorModel) => {
    if (!colorModel || colorModel.length === 0) return 0;
    let minDist = Infinity;
    
    for (let color of colorModel) {
      const dist = colorDistance(r, g, b, color.r, color.g, color.b);
      if (dist < minDist) minDist = dist;
    }
    
    return Math.max(0, 1 - Math.sqrt(minDist) / 255);
  };

  const euclideanDist = (x1, y1, x2, y2) => {
    const dx = x1 - x2;
    const dy = y1 - y2;
    return dx * dx + dy * dy; // Squared (más rápido)
  };

  // ==================== HANDLERS ====================

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onerror = () => {
      alert(language === 'es' ? 'Error al cargar imagen' : 'Error loading image');
    };

    reader.onload = (event) => {
      const img = new Image();
      
      img.onerror = () => {
        alert(language === 'es' ? 'Formato de imagen no soportado' : 'Image format not supported');
      };

      img.onload = () => {
        // Configurar canvas de input
        const canvas = inputCanvasRef.current;
        if (!canvas) return;

        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, img.width, img.height);

        // Configurar canvas de dibujo
        const drawCanvas = drawingCanvasRef.current;
        if (drawCanvas) {
          drawCanvas.width = img.width;
          drawCanvas.height = img.height;
          const drawCtx = drawCanvas.getContext('2d');
          if (drawCtx) {
            drawCtx.drawImage(img, 0, 0);
          }
        }

        setOriginalImage(img);
        setImageData(imgData);
        setMarks({ foreground: [], background: [] });
        setSegmentedImage(null);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleMouseDown = (e) => {
    if (!drawingCanvasRef.current) return;
    const rect = drawingCanvasRef.current.getBoundingClientRect();
    lastPosRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    setIsDrawing(true);
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  const handleMouseMove = (e) => {
    if (!isDrawing || !drawingCanvasRef.current) return;

    const canvas = drawingCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Dibujar línea suave
    ctx.strokeStyle = brushMode === 'foreground' ? 'rgba(0, 255, 0, 0.5)' : 'rgba(255, 0, 0, 0.5)';
    ctx.lineWidth = brushSize * 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
    ctx.lineTo(x, y);
    ctx.stroke();

    // Guardar marca
    const mark = { x: Math.round(x), y: Math.round(y) };
    if (brushMode === 'foreground') {
      setMarks(prev => ({ ...prev, foreground: [...prev.foreground, mark] }));
    } else {
      setMarks(prev => ({ ...prev, background: [...prev.background, mark] }));
    }

    lastPosRef.current = { x, y };
  };

  const handleSegment = () => {
    if (!imageData) {
      alert(t.uploadHint);
      return;
    }

    if (marks.foreground.length === 0 || marks.background.length === 0) {
      alert(
        language === 'es'
          ? 'Marca tanto objeto (VERDE) como fondo (ROJO)'
          : 'Mark both object (GREEN) and background (RED)'
      );
      return;
    }

    setProcessing(true);

    // Usar requestAnimationFrame para no bloquear
    requestAnimationFrame(() => {
      try {
        const canvas = outputCanvasRef.current;
        if (!canvas) return;

        const width = imageData.width;
        const height = imageData.height;
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Obtener modelos de color
        const fgColors = getColorModel(imageData.data, marks.foreground, width, height);
        const bgColors = getColorModel(imageData.data, marks.background, width, height);

        // Crear máscara - OPTIMIZADO SIN BLUR
        const mask = new Uint8ClampedArray(imageData.data.length);

        for (let i = 0; i < width * height; i++) {
          const pixelIdx = i * 4;
          const r = imageData.data[pixelIdx];
          const g = imageData.data[pixelIdx + 1];
          const b = imageData.data[pixelIdx + 2];
          const px = i % width;
          const py = Math.floor(i / width);

          // Similitud de color
          let fgColorSim = colorSimilarity(r, g, b, fgColors);
          let bgColorSim = colorSimilarity(r, g, b, bgColors);

          // Distancia a marcas
          let minDistFg = Infinity;
          let minDistBg = Infinity;

          marks.foreground.forEach(mark => {
            const dist = euclideanDist(px, py, mark.x, mark.y);
            if (dist < minDistFg) minDistFg = dist;
          });

          marks.background.forEach(mark => {
            const dist = euclideanDist(px, py, mark.x, mark.y);
            if (dist < minDistBg) minDistBg = dist;
          });

          // Combinar factores (70% color, 30% distancia)
          const fgScore =
            fgColorSim * 0.7 + Math.max(0, 1 - Math.sqrt(minDistFg) / 200) * 0.3;
          const bgScore =
            bgColorSim * 0.7 + Math.max(0, 1 - Math.sqrt(minDistBg) / 200) * 0.3;

          // Copiar RGB
          mask[pixelIdx] = r;
          mask[pixelIdx + 1] = g;
          mask[pixelIdx + 2] = b;

          // Decidir foreground/background
          mask[pixelIdx + 3] = fgScore > bgScore ? 255 : 0;
        }

        // Aplicar suavizado SIMPLE y RÁPIDO
        const smoothed = new Uint8ClampedArray(mask);
        for (let y = 1; y < height - 1; y++) {
          for (let x = 1; x < width - 1; x++) {
            const idx = (y * width + x) * 4 + 3;
            const sum =
              mask[((y - 1) * width + x - 1) * 4 + 3] +
              mask[((y - 1) * width + x) * 4 + 3] +
              mask[((y - 1) * width + x + 1) * 4 + 3] +
              mask[(y * width + x - 1) * 4 + 3] +
              mask[idx] +
              mask[(y * width + x + 1) * 4 + 3] +
              mask[((y + 1) * width + x - 1) * 4 + 3] +
              mask[((y + 1) * width + x) * 4 + 3] +
              mask[((y + 1) * width + x + 1) * 4 + 3];
            smoothed[idx] = sum / 9 > 127 ? 255 : 0;
          }
        }

        // Dibujar resultado
        const result = new ImageData(smoothed, width, height);
        ctx.putImageData(result, 0, 0);
        setSegmentedImage(canvas.toDataURL());
      } catch (err) {
        console.error('Error:', err);
        alert('Error: ' + err.message);
      } finally {
        setProcessing(false);
      }
    });
  };

  const handleClear = () => {
    if (!originalImage || !drawingCanvasRef.current) return;
    const canvas = drawingCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(originalImage, 0, 0);
      setMarks({ foreground: [], background: [] });
      setSegmentedImage(null);
    }
  };

  const handleDownload = () => {
    if (!segmentedImage) return;
    const a = document.createElement('a');
    a.href = segmentedImage;
    a.download = `segmented-${Date.now()}.png`;
    a.click();
  };

  // ==================== RENDER ====================

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-1">{t.title}</h1>
              <p className="text-emerald-400 font-semibold text-sm md:text-base">{t.subtitle}</p>
            </div>
            <button
              onClick={() => setLanguage(language === 'es' ? 'en' : 'es')}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-semibold"
            >
              {language === 'es' ? 'EN' : 'ES'}
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-slate-800 rounded-lg p-4 md:p-6 mb-6 border border-slate-700">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            {/* Upload */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-1"
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

            {/* Foreground */}
            <button
              onClick={() => setBrushMode('foreground')}
              className={`px-3 py-2 rounded-lg text-sm font-semibold ${
                brushMode === 'foreground'
                  ? 'bg-emerald-600 text-white border-2 border-emerald-400'
                  : 'bg-slate-700 text-slate-300'
              }`}
            >
              🟢 {t.foreground}
            </button>

            {/* Background */}
            <button
              onClick={() => setBrushMode('background')}
              className={`px-3 py-2 rounded-lg text-sm font-semibold ${
                brushMode === 'background'
                  ? 'bg-red-600 text-white border-2 border-red-400'
                  : 'bg-slate-700 text-slate-300'
              }`}
            >
              🔴 {t.background}
            </button>

            {/* Brush Size */}
            <div className="flex items-center gap-1">
              <input
                type="range"
                min="5"
                max="50"
                value={brushSize}
                onChange={(e) => setBrushSize(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg"
              />
              <span className="text-xs font-bold text-slate-300 w-6">{brushSize}</span>
            </div>

            {/* Segment */}
            <button
              onClick={handleSegment}
              disabled={processing || !originalImage}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-1"
            >
              <Wand2 size={16} />
              {processing ? t.processing : t.segment}
            </button>
          </div>

          {/* Secondary Controls */}
          <div className="grid grid-cols-2 gap-2 mt-3">
            <button
              onClick={handleClear}
              className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm font-semibold flex items-center justify-center gap-1"
            >
              <Trash2 size={16} />
              {t.clear}
            </button>
            {segmentedImage && (
              <button
                onClick={handleDownload}
                className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-1"
              >
                <Download size={16} />
                {t.download}
              </button>
            )}
          </div>
        </div>

        {/* Main Area */}
        {originalImage ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Input Canvas */}
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <h3 className="text-lg font-bold text-white mb-3">{t.marked}</h3>
              <div className="bg-black rounded-lg overflow-hidden flex items-center justify-center border-2 border-slate-600">
                <canvas
                  ref={drawingCanvasRef}
                  onMouseDown={handleMouseDown}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onMouseMove={handleMouseMove}
                  className="max-w-full max-h-96 cursor-crosshair"
                />
              </div>
            </div>

            {/* Output Canvas */}
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <h3 className="text-lg font-bold text-white mb-3">{t.result}</h3>
              <div className="bg-black rounded-lg overflow-hidden flex items-center justify-center border-2 border-slate-600 min-h-96">
                {segmentedImage ? (
                  <img src={segmentedImage} alt="Segmented" className="max-w-full max-h-96" />
                ) : (
                  <div className="text-center text-slate-500">
                    <Wand2 size={48} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm">{language === 'es' ? 'Resultado aquí' : 'Result here'}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-slate-800 rounded-lg p-12 border border-slate-700 text-center">
            <Settings size={64} className="mx-auto text-slate-500 mb-4" />
            <h2 className="text-2xl font-bold text-white mb-3">{t.getStarted}</h2>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold"
            >
              {t.upload}
            </button>
          </div>
        )}

        {/* Hidden input canvas for reference */}
        <canvas ref={inputCanvasRef} className="hidden" />
        <canvas ref={outputCanvasRef} className="hidden" />
      </div>
    </div>
  );
}
