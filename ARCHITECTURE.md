# 🏗️ Arquitectura Técnica

## Resumen

La aplicación es una SPA (Single Page Application) de React que implementa segmentación de imágenes usando Graph Cuts. El procesamiento ocurre completamente en el lado del cliente (navegador).

---

## 📐 Flujo de Datos

```
Usuario carga imagen
        ↓
Canvas captura marcas (rojo/azul)
        ↓
Estado React almacena marcas (foreground/background)
        ↓
Usuario hace clic en "Segmentar"
        ↓
Algoritmo Graph Cuts procesa
        ↓
Canvas resultado muestra máscara
        ↓
Usuario descarga PNG
```

---

## 🧠 Algoritmo Graph Cuts

### Implementación Simplificada

```javascript
// 1. Crear mapa de probabilidades
const probFg = Array(width * height).fill(0);
const probBg = Array(width * height).fill(0);

// 2. Marcar píxeles según usuario
marks.foreground.forEach(mark => {
  // Marcar como foreground en probFg
});

// 3. Calcular distancia a marcas
for (let pixel of pixels) {
  distance = min(distToForeground, distToBackground);
  isForeground = (distToForeground < distToBackground);
}

// 4. Aplicar similitud de color
if (colorVariance > threshold) {
  isForeground = true;
}

// 5. Crear máscara
result[pixel] = isForeground ? opaque : transparent;
```

### Características del Algoritmo

- **Distancia**: Euclidiana a puntos marcados
- **Color**: Varianza RGB como factor
- **Propagación**: Simple (no es min-cut full, es heurística)
- **Velocidad**: Real-time (~100ms)
- **Precisión**: Buena para imágenes simples

---

## 🎨 Componente Principal (App.jsx)

### Estados (useState)

```javascript
const [image, setImage]              // Imagen cargada
const [imageData, setImageData]      // Pixel data ImageData
const [isDrawing, setIsDrawing]      // Flag de dibujo
const [brushSize, setBrushSize]      // Tamaño brocha (5-50)
const [brushMode, setBrushMode]      // 'foreground' | 'background'
const [segmentedImage, setSegmentedImage]  // Resultado
const [language, setLanguage]        // 'es' | 'en'
const [marks, setMarks]              // { foreground: [], background: [] }
```

### Refs

```javascript
const canvasRef            // Canvas de dibujo/marca
const resultCanvasRef      // Canvas de resultado
const fileInputRef         // Input file escondido
```

### Funciones Clave

#### `handleImageUpload(e)`
- Lee archivo
- Crea Image element
- Dibuja en canvas
- Extrae ImageData

#### `drawOnCanvas(e)`
- Mouse move → dibuja círculo
- Color rojo/azul según modo
- Almacena posición en marks

#### `applyGraphCuts()`
- Itera todos los píxeles
- Calcula distancia a marcas
- Aplica lógica de color
- Genera máscara transparente
- Dibuja en result canvas

#### `clearMarks()`
- Redibuja imagen original
- Limpia marks
- Limpia resultado

---

## 🎯 Estructura de Datos

### Marks Object
```javascript
{
  foreground: [
    { x: 100, y: 150, size: 15 },
    { x: 120, y: 160, size: 15 },
    ...
  ],
  background: [
    { x: 300, y: 400, size: 20 },
    ...
  ]
}
```

### ImageData (Canvas API)
```javascript
{
  data: Uint8ClampedArray,  // [R,G,B,A,R,G,B,A,...]
  width: 800,
  height: 600
}
```

---

## 🎨 UI Components

### Header
- Título + instrucciones
- Selector de idioma

### Controls Panel
- Upload button
- Brush mode selector
- Brush size slider
- Segment button
- Clear button

### Canvas Area (dual view)
- Left: Canvas de dibujo
- Right: Canvas de resultado
- Download button (condicional)

### Initial State
- Placeholder hasta cargar imagen

---

## 🔌 Integraciones

### Canvas API
```javascript
canvas.getContext('2d')      // Rendering 2D
canvas.toDataURL()           // Exportar PNG
ctx.putImageData()           // Escribir píxeles
ctx.getImageData()           // Leer píxeles
```

### File API
```javascript
FileReader.readAsDataURL()   // Leer archivo
Image.onload                  // Esperar carga
```

### React Hooks
- `useState` - Manejo de estado
- `useRef` - Referencias a elementos
- `useEffect` - (no usado actualmente)

---

## 🎨 Styling

### Tailwind CSS
- Colores: slate, blue, green, red, purple
- Layout: grid, flex
- Dark mode ready
- Responsive breakpoints

### Color Palette
```
Primary:   Blue (#3B82F6)
Success:   Green (#16A34A)
Danger:    Red (#DC2626)
Secondary: Purple (#9333EA)
Background: Slate (#1E293B)
```

---

## 📦 Dependencias

### Production
- **react** - UI library
- **react-dom** - DOM rendering
- **lucide-react** - Icons

### Development
- **vite** - Build tool
- **@vitejs/plugin-react** - React support

### Sizes
- Bundle inicial: ~45KB
- React: ~35KB
- ReactDOM: ~8KB
- Lucide: ~2KB

---

## 🔐 Performance Optimizations

### Actuales
- Canvas rendering (no re-render innecesario)
- Ref caching (useRef para elementos)
- Event delegation
- Lazy loading de imágenes

### Mejoras Futuras
- Web Workers para Graph Cuts
- ImageData caching
- Webgl rendering
- Virtual scrolling (si hay historial)

---

## 🐛 Debugging

### Console Logging
```javascript
console.log(imageData);      // Ver pixel data
console.log(marks);          // Ver marcas
console.log(canvas);         // Ver canvas element
```

### Dev Tools
- React Dev Tools (inspector de componentes)
- Canvas inspector (ver dibujos)
- Network (ver tamaño de imágenes)

### Browser Compatibility
```
✅ Chrome 90+
✅ Firefox 88+
✅ Safari 14+
✅ Edge 90+
```

---

## 🚀 Deployment Architecture

```
Local Development
      ↓
npm run dev (Vite server)
      ↓
Build Production
      ↓
npm run build (Vite bundle)
      ↓
Output: dist/ folder
      ↓
Netlify Deploy
      ↓
CDN Global
      ↓
User Browser
```

### Netlify
- Build: `npm run build`
- Output: `dist/`
- Index: `index.html`
- Routing: Client-side (SPA)

---

## 📊 File Sizes

```
index.html          428 bytes
src/App.jsx         13.5 KB
src/main.jsx        235 bytes
src/index.css       59 bytes
vite.config.js      133 bytes
package.json        373 bytes
package-lock.json   ~150 KB
node_modules/       ~450 MB (desarrollo)
dist/               ~45 KB (producción)
```

---

## 🔮 Posibles Mejoras

### Phase 2
- Backend Python para Graph Cuts real
- WebSocket para tiempo real
- Historial de segmentaciones
- Undo/Redo functionality

### Phase 3
- ML-based pre-segmentation
- GPU acceleration (WebGL)
- Multi-image batch processing
- API REST para integración

### Phase 4
- Mobile app (React Native)
- Colaboración en tiempo real
- Marketplace de modelos
- Advanced analytics

---

## 📝 Notas Técnicas

- **Canvas**: No es reactivo, usa imperative API
- **ImageData**: Uint8ClampedArray (solo lectura eficiente)
- **Refs**: Evitan re-renders innecesarios
- **Tailwind**: CDN link (desarrollo rápido)
- **Vite**: ESM nativo (hot reload instantáneo)

---

## 🔗 Referencias Externas

- [Canvas API MDN](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
- [ImageData MDN](https://developer.mozilla.org/en-US/docs/Web/API/ImageData)
- [Graph Cuts Paper](http://citeseerx.ist.psu.edu/viewdoc/download?doi=10.1.1.14.5337&rep=rep1&type=pdf)
- [React Docs](https://react.dev)

---

**Last Updated**: November 2024  
**Version**: 1.0.0
