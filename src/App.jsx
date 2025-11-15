import React, { useState, useRef, useEffect } from 'react';
import { Trash2, Upload, Download, Wand2, RotateCcw } from 'lucide-react';

export default function GraphCutsSegmentation() {
  const [image, setImage] = useState(null);
  const [imageData, setImageData] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(15);
  const [brushMode, setBrushMode] = useState('foreground'); // foreground or background
  const [segmentedImage, setSegmentedImage] = useState(null);
  const [language, setLanguage] = useState('es'); // es or en
  
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
      original: 'Imagen Original',
      marked: 'Imagen Marcada',
      result: 'Resultado Segmentado',
      instructions: 'Dibuja sobre la imagen: rojo para objeto, azul para fondo',
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
      original: 'Original Image',
      marked: 'Marked Image',
      result: 'Segmented Result',
      instructions: 'Draw on image: red for object, blue for background',
    },
  };

  const t = labels[language];

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          setImage(img);
          const canvas = canvasRef.current;
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          setImageData(ctx.getImageData(0, 0, img.width, img.height));
          setMarks({ foreground: [], background: [] });
          setSegmentedImage(null);
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  const drawOnCanvas = (e) => {
    if (!isDrawing || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = brushMode === 'foreground' ? 'rgba(255, 0, 0, 0.5)' : 'rgba(0, 0, 255, 0.5)';
    ctx.beginPath();
    ctx.arc(x, y, brushSize, 0, Math.PI * 2);
    ctx.fill();

    if (brushMode === 'foreground') {
      setMarks(prev => ({ ...prev, foreground: [...prev.foreground, { x, y, size: brushSize }] }));
    } else {
      setMarks(prev => ({ ...prev, background: [...prev.background, { x, y, size: brushSize }] }));
    }
  };

  const applyGraphCuts = () => {
    if (!imageData) return;

    const canvas = resultCanvasRef.current;
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    
    const ctx = canvas.getContext('2d');
    const data = new Uint8ClampedArray(imageData.data);
    
    // Crear mapa de probabilidades
    const probFg = new Array(imageData.width * imageData.height).fill(0);
    const probBg = new Array(imageData.width * imageData.height).fill(0);

    // Marcar píxeles basados en dibujos del usuario
    marks.foreground.forEach(mark => {
      for (let dx = -mark.size; dx <= mark.size; dx++) {
        for (let dy = -mark.size; dy <= mark.size; dy++) {
          if (dx * dx + dy * dy <= mark.size * mark.size) {
            const px = mark.x + dx;
            const py = mark.y + dy;
            if (px >= 0 && px < imageData.width && py >= 0 && py < imageData.height) {
              probFg[py * imageData.width + px] = 1;
            }
          }
        }
      }
    });

    marks.background.forEach(mark => {
      for (let dx = -mark.size; dx <= mark.size; dx++) {
        for (let dy = -mark.size; dy <= mark.size; dy++) {
          if (dx * dx + dy * dy <= mark.size * mark.size) {
            const px = mark.x + dx;
            const py = mark.y + dy;
            if (px >= 0 && px < imageData.width && py >= 0 && py < imageData.height) {
              probBg[py * imageData.width + px] = 1;
            }
          }
        }
      }
    });

    // Propagar información usando algoritmo simple
    const result = new Uint8ClampedArray(imageData.data);
    
    for (let i = 0; i < imageData.width * imageData.height; i++) {
      const pixelIdx = i * 4;
      const r = imageData.data[pixelIdx];
      const g = imageData.data[pixelIdx + 1];
      const b = imageData.data[pixelIdx + 2];

      let distance = Infinity;
      let isForeground = false;

      // Calcular distancia a marcas de foreground
      if (marks.foreground.length > 0) {
        marks.foreground.forEach(mark => {
          const pixelX = i % imageData.width;
          const pixelY = Math.floor(i / imageData.width);
          const dx = pixelX - mark.x;
          const dy = pixelY - mark.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < distance) {
            distance = dist;
            isForeground = true;
          }
        });
      }

      // Calcular distancia a marcas de background
      if (marks.background.length > 0) {
        marks.background.forEach(mark => {
          const pixelX = i % imageData.width;
          const pixelY = Math.floor(i / imageData.width);
          const dx = pixelX - mark.x;
          const dy = pixelY - mark.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < distance) {
            distance = dist;
            isForeground = false;
          }
        });
      }

      // Aplicar similitud de color
      const avgColor = (r + g + b) / 3;
      const colorVariance = Math.abs(r - g) + Math.abs(g - b) + Math.abs(r - b);
      
      if (!isForeground && colorVariance > 50) {
        isForeground = true;
      }

      // Aplicar máscara
      if (!isForeground) {
        result[pixelIdx + 3] = 50; // Hacer transparente el fondo
      }
    }

    const imageDataResult = new ImageData(result, imageData.width, imageData.height);
    ctx.putImageData(imageDataResult, 0, 0);
    setSegmentedImage(canvas.toDataURL());
  };

  const clearMarks = () => {
    if (canvasRef.current && image) {
      const ctx = canvasRef.current.getContext('2d');
      ctx.drawImage(image, 0, 0);
      setMarks({ foreground: [], background: [] });
      setSegmentedImage(null);
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
                className="w-full px-3 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-blue-500 outline-none"
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
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition flex items-center justify-center gap-2"
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

        {/* Canvas Area */}
        {image && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Original with Marks */}
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

            {/* Right: Result */}
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
                  <img
                    src={segmentedImage}
                    alt="Segmented"
                    className="max-w-full max-h-96"
                  />
                ) : (
                  <canvas
                    ref={resultCanvasRef}
                    className="max-w-full max-h-96"
                  />
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
                ? 'Sube una imagen para comenzar la segmentación'
                : 'Upload an image to start segmentation'}
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
