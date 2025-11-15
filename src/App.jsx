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
    },
  };

  const t = labels[language];

  const handleImageUpload = (e) => {
    console.log('📸 Upload iniciado');
    const file = e.target.files[0];
    console.log('Archivo:', file);
    
    if (!file) {
      console.log('❌ No hay archivo');
      return;
    }

    const reader = new FileReader();
    
    reader.onload = (event) => {
      console.log('✅ FileReader onload');
      const img = new Image();
      
      img.onload = () => {
        console.log('✅ Image onload - Dimensiones:', img.width, 'x', img.height);
        
        setImage(img);
        
        const canvas = canvasRef.current;
        console.log('Canvas ref:', canvas);
        
        if (!canvas) {
          console.error('❌ Canvas ref es NULL');
          return;
        }
        
        canvas.width = img.width;
        canvas.height = img.height;
        console.log('Canvas size set:', canvas.width, 'x', canvas.height);
        
        const ctx = canvas.getContext('2d');
        console.log('Context:', ctx);
        
        if (!ctx) {
          console.error('❌ Context es NULL');
          return;
        }
        
        ctx.drawImage(img, 0, 0);
        console.log('✅ Imagen dibujada en canvas');
        
        const imgData = ctx.getImageData(0, 0, img.width, img.height);
        setImageData(imgData);
        console.log('✅ ImageData extraído');
        
        setMarks({ foreground: [], background: [] });
        setSegmentedImage(null);
      };
      
      img.onerror = () => {
        console.error('❌ Error cargando imagen');
      };
      
      img.src = event.target.result;
      console.log('Image src set');
    };
    
    reader.onerror = () => {
      console.error('❌ Error leyendo archivo');
    };
    
    reader.readAsDataURL(file);
    console.log('readAsDataURL iniciado');
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

    if (brushMode === 'foreground') {
      setMarks(prev => ({ ...prev, foreground: [...prev.foreground, { x: Math.round(x), y: Math.round(y) }] }));
    } else {
      setMarks(prev => ({ ...prev, background: [...prev.background, { x: Math.round(x), y: Math.round(y) }] }));
    }
  };

  const applyGraphCuts = () => {
    if (!imageData) {
      alert('Por favor carga una imagen primero');
      return;
    }
    
    console.log('Segmentando...');
    
    const canvas = resultCanvasRef.current;
    if (!canvas) {
      console.error('Result canvas ref es NULL');
      return;
    }

    const width = imageData.width;
    const height = imageData.height;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const result = new Uint8ClampedArray(imageData.data);

    for (let i = 0; i < width * height; i++) {
      const pixelIdx = i * 4;
      const px = i % width;
      const py = Math.floor(i / width);

      let isForeground = false;

      marks.foreground.forEach(mark => {
        const dist = Math.sqrt(Math.pow(px - mark.x, 2) + Math.pow(py - mark.y, 2));
        if (dist < 50) isForeground = true;
      });

      marks.background.forEach(mark => {
        const dist = Math.sqrt(Math.pow(px - mark.x, 2) + Math.pow(py - mark.y, 2));
        if (dist < 50) isForeground = false;
      });

      if (!isForeground) {
        result[pixelIdx + 3] = 50;
      }
    }

    ctx.putImageData(new ImageData(result, width, height), 0, 0);
    setSegmentedImage(canvas.toDataURL());
    console.log('✅ Segmentación completada');
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

        <div className="bg-slate-800 rounded-lg p-6 mb-6 border border-slate-700">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">{t.upload}</label>
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

            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">{t.brush}</label>
              <select
                value={brushMode}
                onChange={(e) => setBrushMode(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 text-white rounded-lg border border-slate-600"
              >
                <option value="foreground">🔴 {t.foreground}</option>
                <option value="background">🔵 {t.background}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">{t.brush}: {brushSize}px</label>
              <input
                type="range"
                min="5"
                max="50"
                value={brushSize}
                onChange={(e) => setBrushSize(parseInt(e.target.value))}
                className="w-full"
              />
            </div>

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

        {image && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <h3 className="text-lg font-semibold text-white mb-3">{t.marked}</h3>
              <div className="bg-black rounded-lg overflow-hidden flex items-center justify-center">
                <canvas
                  ref={canvasRef}
                  onMouseDown={() => setIsDrawing(true)}
                  onMouseUp={() => setIsDrawing(false)}
                  onMouseLeave={() => setIsDrawing(false)}
                  onMouseMove={drawOnCanvas}
                  className="max-w-full max-h-96 cursor-crosshair border-2 border-slate-600"
                />
              </div>
            </div>

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
                  <canvas ref={resultCanvasRef} className="max-w-full max-h-96 border-2 border-slate-600" />
                )}
              </div>
            </div>
          </div>
        )}

        {!image && (
          <div className="bg-slate-800 rounded-lg p-12 border border-slate-700 text-center">
            <Wand2 size={64} className="mx-auto text-slate-500 mb-4" />
            <h2 className="text-2xl font-semibold text-white mb-2">
              {language === 'es' ? 'Comienza aquí' : 'Get Started'}
            </h2>
            <p className="text-slate-400 mb-6">
              {language === 'es' ? 'Sube una imagen para comenzar' : 'Upload an image to start'}
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
