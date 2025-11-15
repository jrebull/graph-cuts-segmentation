import React, { useState, useRef } from 'react';
import { Trash2, Upload, Download, Wand2 } from 'lucide-react';

export default function GraphCutsSegmentation() {
  const [image, setImage] = useState(null);
  const [imageData, setImageData] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(15);
  const [brushMode, setBrushMode] = useState('foreground');
  const [segmentedImage, setSegmentedImage] = useState(null);
  const [language, setLanguage] = useState('es');
  const [processingMessage, setProcessingMessage] = useState('');
  
  const canvasRef = useRef(null);
  const resultCanvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const [marks, setMarks] = useState({ foreground: [], background: [] });

  const labels = {
    es: {
      title: 'Segmentación con Graph Cuts',
      upload: 'Subir Imagen',
      foreground: 'Marcar Objeto',
      background: 'Marcar Fondo',
      brush: 'Tamaño Brocha',
      segment: 'Segmentar',
      clear: 'Limpiar',
      download: 'Descargar',
      marked: 'Imagen Marcada',
      result: 'Resultado Segmentado',
      instructions: 'Dibuja: rojo para objeto, azul para fondo',
      processing: 'Procesando...',
    },
    en: {
      title: 'Graph Cuts Segmentation',
      upload: 'Upload Image',
      foreground: 'Mark Object',
      background: 'Mark Background',
      brush: 'Brush Size',
      segment: 'Segment',
      clear: 'Clear',
      download: 'Download',
      marked: 'Marked Image',
      result: 'Segmented Result',
      instructions: 'Draw: red for object, blue for background',
      processing: 'Processing...',
    },
  };

  const t = labels[language];

  // ==================== UTILIDADES ====================

  const colorSimilarity = (r, g, b, colorModel) => {
    if (!colorModel || colorModel.length === 0) return 0;
    let minDist = Infinity;
    
    colorModel.forEach(color => {
      const dist = Math.sqrt(
        Math.pow(r - color.r, 2) + Math.pow(g - color.g, 2) + Math.pow(b - color.b, 2)
      );
      if (dist < minDist) minDist = dist;
    });

    return Math.max(0, 1 - minDist / 255);
  };

  const getColorModel = (pixelData, marks, width, height) => {
    const colors = [];
    marks.forEach(mark => {
      for (let dy = -30; dy <= 30; dy++) {
        for (let dx = -30; dx <= 30; dx++) {
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
    return colors.length > 0 ? colors : null;
  };

  const euclideanDistance = (x1, y1, x2, y2) => {
    return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
  };

  const gaussianBlur = (data, width, height) => {
    const result = new Uint8ClampedArray(data);
    const radius = 2;
    
    for (let y = radius; y < height - radius; y++) {
      for (let x = radius; x < width - radius; x++) {
        let sum = 0;
        let count = 0;
        
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const idx = ((y + dy) * width + (x + dx)) * 4 + 3;
            sum += data[idx];
            count++;
          }
        }
        
        result[(y * width + x) * 4 + 3] = Math.round(sum / count);
      }
    }
    
    return result;
  };

  // ==================== HANDLERS ====================

  const handleImageUpload = (e) => {
    try {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          if (!canvasRef.current) return;
          
          setImage(img);
          const canvas = canvasRef.current;
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          
          ctx.drawImage(img, 0, 0);
          const imgData = ctx.getImageData(0, 0, img.width, img.height);
          setImageData(imgData);
          setMarks({ foreground: [], background: [] });
          setSegmentedImage(null);
        };
        img.onerror = () => {
          console.error('Error loading image');
          alert('Error al cargar la imagen');
        };
        img.src = event.target.result;
      };
      reader.onerror = () => {
        console.error('Error reading file');
        alert('Error al leer el archivo');
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Upload error:', err);
      alert('Error al subir imagen');
    }
  };

  const drawOnCanvas = (e) => {
    if (!isDrawing || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = brushMode === 'foreground' ? 'rgba(255, 0, 0, 0.5)' : 'rgba(0, 0, 255, 0.5)';
    ctx.beginPath();
    ctx.arc(x, y, brushSize, 0, Math.PI * 2);
    ctx.fill();

    const newMark = { x: Math.round(x), y: Math.round(y), size: brushSize };
    
    if (brushMode === 'foreground') {
      setMarks(prev => ({ ...prev, foreground: [...prev.foreground, newMark] }));
    } else {
      setMarks(prev => ({ ...prev, background: [...prev.background, newMark] }));
    }
  };

  const applyGraphCuts = () => {
    if (!imageData || !resultCanvasRef.current) {
      alert('Por favor carga una imagen primero');
      return;
    }

    setProcessingMessage(t.processing);

    setTimeout(() => {
      try {
        const canvas = resultCanvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const width = imageData.width;
        const height = imageData.height;
        canvas.width = width;
        canvas.height = height;

        const fgColors = getColorModel(imageData.data, marks.foreground, width, height);
        const bgColors = getColorModel(imageData.data, marks.background, width, height);

        const mask = new Uint8ClampedArray(imageData.data.length);

        for (let i = 0; i < width * height; i++) {
          const pixelIdx = i * 4;
          const r = imageData.data[pixelIdx];
          const g = imageData.data[pixelIdx + 1];
          const b = imageData.data[pixelIdx + 2];

          let fgSim = fgColors ? colorSimilarity(r, g, b, fgColors) : 0;
          let bgSim = bgColors ? colorSimilarity(r, g, b, bgColors) : 0;

          let minDistFg = Infinity;
          let minDistBg = Infinity;

          marks.foreground.forEach(mark => {
            const px = i % width;
            const py = Math.floor(i / width);
            const dist = euclideanDistance(px, py, mark.x, mark.y);
            if (dist < minDistFg) minDistFg = dist;
          });

          marks.background.forEach(mark => {
            const px = i % width;
            const py = Math.floor(i / width);
            const dist = euclideanDistance(px, py, mark.x, mark.y);
            if (dist < minDistBg) minDistBg = dist;
          });

          fgSim += Math.max(0, 1 - minDistFg / 100) * 0.3;
          bgSim += Math.max(0, 1 - minDistBg / 100) * 0.3;

          const isForeground = fgSim > bgSim;

          mask[pixelIdx] = r;
          mask[pixelIdx + 1] = g;
          mask[pixelIdx + 2] = b;
          mask[pixelIdx + 3] = isForeground ? 255 : 0;
        }

        const blurredMask = gaussianBlur(mask, width, height);

        for (let i = 3; i < blurredMask.length; i += 4) {
          blurredMask[i] = blurredMask[i] > 128 ? 255 : 0;
        }

        const result = new ImageData(blurredMask, width, height);
        ctx.putImageData(result, 0, 0);

        setSegmentedImage(canvas.toDataURL());
        setProcessingMessage('');
      } catch (err) {
        console.error('Segmentation error:', err);
        alert('Error en segmentación: ' + err.message);
        setProcessingMessage('');
      }
    }, 100);
  };

  const clearMarks = () => {
    if (canvasRef.current && image) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.drawImage(image, 0, 0);
        setMarks({ foreground: [], background: [] });
        setSegmentedImage(null);
      }
    }
  };

  const downloadResult = () => {
    if (!segmentedImage) return;
    const a = document.createElement('a');
    a.href = segmentedImage;
    a.download = 'segmented-result.png';
    a.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">{t.title}</h1>
            <p className="text-slate-400">{t.instructions}</p>
          </div>
          <button
            onClick={() => setLanguage(language === 'es' ? 'en' : 'es')}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition"
          >
            {language === 'es' ? 'EN' : 'ES'}
          </button>
        </div>

        {/* Controls */}
        <div className="bg-slate-800 rounded-lg p-6 mb-6 border border-slate-700">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Upload */}
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                {t.upload}
              </label>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition flex items-center justify-center gap-2"
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
            </div>

            {/* Brush Mode */}
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                {t.brush}
              </label>
              <select
                value={brushMode}
                onChange={(e) => setBrushMode(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 text-white rounded-lg border border-slate-600"
              >
                <option value="foreground">🔴 {t.foreground}</option>
                <option value="background">🔵 {t.background}</option>
              </select>
            </div>

            {/* Brush Size */}
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                {t.brush}: {brushSize}px
              </label>
              <input
                type="range"
                min="5"
                max="50"
                value={brushSize}
                onChange={(e) => setBrushSize(parseInt(e.target.value))}
                className="w-full"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 items-end">
              <button
                onClick={applyGraphCuts}
                disabled={!image || processingMessage !== ''}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-slate-600 text-white rounded-lg transition flex items-center justify-center gap-2"
              >
                <Wand2 size={18} />
                {t.segment}
              </button>
              <button
                onClick={clearMarks}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Processing Message */}
        {processingMessage && (
          <div className="bg-blue-900 border border-blue-500 rounded-lg p-4 mb-6 text-blue-200">
            {processingMessage}
          </div>
        )}

        {/* Canvas Area */}
        {image && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left */}
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <h3 className="text-lg font-semibold text-white mb-3">{t.marked}</h3>
              <div className="bg-black rounded-lg overflow-hidden flex items-center justify-center">
                <canvas
                  ref={canvasRef}
                  onMouseDown={() => setIsDrawing(true)}
                  onMouseUp={() => setIsDrawing(false)}
                  onMouseLeave={() => setIsDrawing(false)}
                  onMouseMove={drawOnCanvas}
                  className="max-w-full max-h-96 cursor-crosshair"
                />
              </div>
            </div>

            {/* Right */}
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-semibold text-white">{t.result}</h3>
                {segmentedImage && (
                  <button
                    onClick={downloadResult}
                    className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-lg transition flex items-center gap-1"
                  >
                    <Download size={16} />
                    {t.download}
                  </button>
                )}
              </div>
              <div className="bg-black rounded-lg overflow-hidden flex items-center justify-center">
                {segmentedImage ? (
                  <img src={segmentedImage} alt="Segmented" className="max-w-full max-h-96" />
                ) : (
                  <canvas ref={resultCanvasRef} className="max-w-full max-h-96" />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Initial State */}
        {!image && (
          <div className="bg-slate-800 rounded-lg p-12 border border-slate-700 text-center">
            <Wand2 size={64} className="mx-auto text-slate-500 mb-4" />
            <h2 className="text-2xl font-semibold text-white mb-2">
              {language === 'es' ? 'Comienza aquí' : 'Get Started'}
            </h2>
            <p className="text-slate-400 mb-6">
              {language === 'es'
                ? 'Sube una imagen para comenzar'
                : 'Upload an image to start'}
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition text-lg font-semibold"
            >
              {t.upload}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
