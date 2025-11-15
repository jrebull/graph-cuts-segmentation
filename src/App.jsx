import React, { useState, useRef, useEffect } from 'react';
import { Trash2, Upload, Download, Wand2, Settings } from 'lucide-react';

export default function GraphCutsSegmentation() {
  // ==================== STATE ====================
  const [originalImage, setOriginalImage] = useState(null);
  const [imageData, setImageData] = useState(null);
  const [segmentedImage, setSegmentedImage] = useState(null);
  const [language, setLanguage] = useState('es');
  const [brushSize, setBrushSize] = useState(20);
  const [brushMode, setBrushMode] = useState('foreground'); // 'foreground' = GREEN, 'background' = RED
  const [isDrawing, setIsDrawing] = useState(false);
  const [marks, setMarks] = useState({ foreground: [], background: [] });
  const [processing, setProcessing] = useState(false);

  // ==================== REFS ====================
  const inputCanvasRef = useRef(null);
  const outputCanvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const drawingCanvasRef = useRef(null);

  // ==================== LABELS ====================
  const labels = {
    es: {
      title: 'Segmentación Inteligente con Graph Cuts',
      subtitle: 'Dibuja en la imagen: VERDE para objeto, ROJO para fondo',
      upload: 'Subir Imagen',
      foreground: 'Marcar Objeto (VERDE)',
      background: 'Marcar Fondo (ROJO)',
      brush: 'Tamaño Brocha',
      segment: 'Segmentar Ahora',
      clear: 'Limpiar Marcas',
      download: 'Descargar PNG',
      marked: 'Imagen con Marcas',
      result: 'Resultado Segmentado',
      instructions: 'Dibuja sobre la imagen. Verde = objeto que quieres. Rojo = fondo.',
      processing: 'Procesando segmentación...',
      getStarted: 'Comienza aquí',
      uploadHint: 'Sube una imagen para comenzar la segmentación',
    },
    en: {
      title: 'Intelligent Segmentation with Graph Cuts',
      subtitle: 'Draw on image: GREEN for object, RED for background',
      upload: 'Upload Image',
      foreground: 'Mark Object (GREEN)',
      background: 'Mark Background (RED)',
      brush: 'Brush Size',
      segment: 'Segment Now',
      clear: 'Clear Marks',
      download: 'Download PNG',
      marked: 'Image with Marks',
      result: 'Segmented Result',
      instructions: 'Draw on image. Green = object you want. Red = background.',
      processing: 'Processing segmentation...',
      getStarted: 'Get Started',
      uploadHint: 'Upload an image to start segmentation',
    },
  };

  const t = labels[language];
  const FOREGROUND_COLOR = '#00FF00'; // GREEN
  const BACKGROUND_COLOR = '#FF0000'; // RED

  // ==================== UTILIDADES ====================

  const getColorModel = (pixelData, marks, width, height) => {
    const colors = [];
    marks.forEach(mark => {
      for (let dy = -25; dy <= 25; dy++) {
        for (let dx = -25; dx <= 25; dx++) {
          const px = Math.round(mark.x + dx);
          const py = Math.round(mark.y + dy);
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

  const colorDistance = (r1, g1, b1, r2, g2, b2) => {
    return Math.sqrt(
      Math.pow(r1 - r2, 2) + Math.pow(g1 - g2, 2) + Math.pow(b1 - b2, 2)
    );
  };

  const colorSimilarity = (r, g, b, colorModel) => {
    if (!colorModel || colorModel.length === 0) return 0;
    let minDist = Infinity;
    
    for (let color of colorModel) {
      const dist = colorDistance(r, g, b, color.r, color.g, color.b);
      if (dist < minDist) minDist = dist;
    }
    
    return Math.max(0, 1 - minDist / 255);
  };

  const euclideanDist = (x1, y1, x2, y2) => {
    return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
  };

  const applyGaussianBlur = (imageData, radius = 2) => {
    const data = new Uint8ClampedArray(imageData);
    const width = imageData.width;
    const height = imageData.height;
    const kernel = [];
    
    // Crear kernel Gaussiano
    const sigma = radius / 2;
    let sum = 0;
    for (let y = -radius; y <= radius; y++) {
      kernel[y + radius] = [];
      for (let x = -radius; x <= radius; x++) {
        const val = Math.exp(-(x * x + y * y) / (2 * sigma * sigma));
        kernel[y + radius][x + radius] = val;
        sum += val;
      }
    }
    
    // Normalizar kernel
    for (let y = 0; y < kernel.length; y++) {
      for (let x = 0; x < kernel[y].length; x++) {
        kernel[y][x] /= sum;
      }
    }

    // Aplicar blur al alpha channel
    for (let y = radius; y < height - radius; y++) {
      for (let x = radius; x < width - radius; x++) {
        let alphaSum = 0;
        for (let ky = -radius; ky <= radius; ky++) {
          for (let kx = -radius; kx <= radius; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4 + 3;
            alphaSum += data[idx] * kernel[ky + radius][kx + radius];
          }
        }
        data[(y * width + x) * 4 + 3] = alphaSum;
      }
    }
    
    return data;
  };

  // ==================== HANDLERS ====================

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
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

  const handleMouseDown = () => {
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

    const color = brushMode === 'foreground' ? FOREGROUND_COLOR : BACKGROUND_COLOR;
    ctx.fillStyle = brushMode === 'foreground' ? 'rgba(0, 255, 0, 0.4)' : 'rgba(255, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.arc(x, y, brushSize, 0, Math.PI * 2);
    ctx.fill();

    // Guardar marca
    const mark = { x, y, size: brushSize };
    if (brushMode === 'foreground') {
      setMarks(prev => ({ ...prev, foreground: [...prev.foreground, mark] }));
    } else {
      setMarks(prev => ({ ...prev, background: [...prev.background, mark] }));
    }
  };

  const handleSegment = () => {
    if (!imageData) {
      alert(t.uploadHint);
      return;
    }

    if (marks.foreground.length === 0 || marks.background.length === 0) {
      alert(language === 'es' 
        ? 'Marca tanto el objeto (VERDE) como el fondo (ROJO)' 
        : 'Mark both object (GREEN) and background (RED)'
      );
      return;
    }

    setProcessing(true);

    setTimeout(() => {
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

        // Crear máscara
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

          // Combinar factores (60% color, 40% distancia)
          const fgScore = fgColorSim * 0.6 + Math.max(0, 1 - minDistFg / 150) * 0.4;
          const bgScore = bgColorSim * 0.6 + Math.max(0, 1 - minDistBg / 150) * 0.4;

          // Copiar RGB
          mask[pixelIdx] = r;
          mask[pixelIdx + 1] = g;
          mask[pixelIdx + 2] = b;

          // Decidir foreground/background
          mask[pixelIdx + 3] = fgScore > bgScore ? 255 : 0;
        }

        // Aplicar Gaussian Blur
        const blurredMask = applyGaussianBlur(mask, 3);

        // Aplicar threshold
        for (let i = 3; i < blurredMask.length; i += 4) {
          blurredMask[i] = blurredMask[i] > 127 ? 255 : 0;
        }

        // Dibujar resultado
        const result = new ImageData(blurredMask, width, height);
        ctx.putImageData(result, 0, 0);
        setSegmentedImage(canvas.toDataURL());
      } catch (err) {
        console.error('Segmentation error:', err);
        alert('Error en segmentación: ' + err.message);
      } finally {
        setProcessing(false);
      }
    }, 100);
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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-10">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-5xl font-bold text-white mb-2">{t.title}</h1>
              <p className="text-lg text-emerald-400 font-semibold">{t.subtitle}</p>
              <p className="text-slate-400 mt-2">{t.instructions}</p>
            </div>
            <button
              onClick={() => setLanguage(language === 'es' ? 'en' : 'es')}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white rounded-lg transition font-semibold"
            >
              {language === 'es' ? '🇬🇧 EN' : '🇪🇸 ES'}
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-800 rounded-lg p-8 mb-8 border border-slate-700 shadow-xl">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Upload */}
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-2 uppercase tracking-wide">{t.upload}</label>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-lg transition flex items-center justify-center gap-2 font-semibold"
              >
                <Upload size={20} />
                {t.upload}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>

            {/* Foreground */}
            <div>
              <label className="block text-sm font-bold text-emerald-400 mb-2 uppercase tracking-wide">{t.foreground}</label>
              <button
                onClick={() => setBrushMode('foreground')}
                className={`w-full px-4 py-3 rounded-lg transition font-semibold flex items-center justify-center gap-2 ${
                  brushMode === 'foreground'
                    ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white border-2 border-emerald-400'
                    : 'bg-slate-700 hover:bg-slate-600 text-slate-300 border-2 border-slate-600'
                }`}
              >
                <div className="w-4 h-4 bg-emerald-500 rounded-full" />
                GREEN
              </button>
            </div>

            {/* Background */}
            <div>
              <label className="block text-sm font-bold text-red-400 mb-2 uppercase tracking-wide">{t.background}</label>
              <button
                onClick={() => setBrushMode('background')}
                className={`w-full px-4 py-3 rounded-lg transition font-semibold flex items-center justify-center gap-2 ${
                  brushMode === 'background'
                    ? 'bg-gradient-to-r from-red-600 to-red-500 text-white border-2 border-red-400'
                    : 'bg-slate-700 hover:bg-slate-600 text-slate-300 border-2 border-slate-600'
                }`}
              >
                <div className="w-4 h-4 bg-red-500 rounded-full" />
                RED
              </button>
            </div>

            {/* Brush Size */}
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-2 uppercase tracking-wide">{t.brush}</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="5"
                  max="60"
                  value={brushSize}
                  onChange={(e) => setBrushSize(parseInt(e.target.value))}
                  className="flex-1 h-2 bg-slate-700 rounded-lg cursor-pointer"
                />
                <span className="text-sm font-bold text-slate-300 w-12 text-right">{brushSize}px</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <button
                onClick={handleSegment}
                disabled={processing || !originalImage}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:from-slate-600 disabled:to-slate-600 text-white rounded-lg transition font-semibold flex items-center justify-center gap-2"
              >
                <Wand2 size={20} />
                {processing ? t.processing : t.segment}
              </button>
              <button
                onClick={handleClear}
                className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition font-semibold flex items-center justify-center gap-2"
              >
                <Trash2 size={20} />
                {t.clear}
              </button>
            </div>
          </div>
        </div>

        {/* Main Area */}
        {originalImage ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Input Canvas */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-800 rounded-lg p-6 border border-slate-700 shadow-xl">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                {t.marked}
              </h3>
              <div className="bg-black rounded-lg overflow-hidden flex items-center justify-center border-2 border-slate-600">
                <canvas
                  ref={drawingCanvasRef}
                  onMouseDown={handleMouseDown}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onMouseMove={handleMouseMove}
                  className="max-w-full max-h-96 cursor-crosshair"
                  style={{ touchAction: 'none' }}
                />
              </div>
              <div className="mt-4 flex gap-2">
                <div className="flex items-center gap-2 px-3 py-2 bg-emerald-600 bg-opacity-30 rounded text-emerald-400 text-sm font-semibold">
                  <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                  = Objeto
                </div>
                <div className="flex items-center gap-2 px-3 py-2 bg-red-600 bg-opacity-30 rounded text-red-400 text-sm font-semibold">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  = Fondo
                </div>
              </div>
            </div>

            {/* Output Canvas */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-800 rounded-lg p-6 border border-slate-700 shadow-xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <div className="w-3 h-3 bg-teal-500 rounded-full"></div>
                  {t.result}
                </h3>
                {segmentedImage && (
                  <button
                    onClick={handleDownload}
                    className="px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white rounded-lg transition font-semibold flex items-center gap-2"
                  >
                    <Download size={18} />
                    {t.download}
                  </button>
                )}
              </div>
              <div className="bg-black rounded-lg overflow-hidden flex items-center justify-center border-2 border-slate-600 min-h-96">
                {segmentedImage ? (
                  <img src={segmentedImage} alt="Segmented" className="max-w-full max-h-96" />
                ) : (
                  <div className="text-center text-slate-500 py-12">
                    <Wand2 size={48} className="mx-auto mb-4 opacity-50" />
                    <p className="font-semibold">{language === 'es' ? 'Resultado aparecerá aquí' : 'Result will appear here'}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-br from-slate-800 to-slate-800 rounded-lg p-16 border border-slate-700 shadow-xl text-center">
            <Settings size={80} className="mx-auto text-slate-500 mb-6 animate-pulse" />
            <h2 className="text-4xl font-bold text-white mb-4">{t.getStarted}</h2>
            <p className="text-slate-400 mb-8 text-lg">{t.uploadHint}</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-12 py-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-lg transition text-xl font-bold"
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
