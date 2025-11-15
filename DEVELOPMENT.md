# 📚 Guía de Desarrollo

## Configuración Inicial del Ambiente

### 1️⃣ Requisitos Previos
- **Node.js** ≥ 16.0.0
- **npm** ≥ 8.0.0
- **Git**

Verifica tu versión:
```bash
node --version
npm --version
git --version
```

### 2️⃣ Setup del Proyecto

```bash
# Clona o navega al proyecto
cd GrpahCutsNet

# Instala dependencias
npm install

# Crea archivo .env local (opcional)
cp .env.example .env
```

---

## 🚀 Comandos Disponibles

### Desarrollo
```bash
# Inicia servidor de desarrollo en http://localhost:5173
npm run dev

# Con hot reload automático
```

### Build
```bash
# Compila para producción
npm run build

# Genera carpeta 'dist' lista para publicar
```

### Preview
```bash
# Vista previa de la compilación antes de deployar
npm run preview
```

### Utilidades
```bash
# Lint de código (verifica errores)
npm run lint

# Formatea el código automáticamente
npm run format

# Setup completo (instala + build)
npm run setup
```

---

## 📁 Estructura del Proyecto

```
GrpahCutsNet/
├── src/
│   ├── App.jsx              # Componente principal (segmentación)
│   ├── main.jsx             # Punto de entrada React
│   └── index.css            # Estilos Tailwind
│
├── public/                  # Assets estáticos (opcional)
│
├── index.html               # Template HTML
├── vite.config.js           # Configuración de Vite
├── package.json             # Dependencias y scripts
├── package-lock.json        # Lock file (no editar)
├── .env.example             # Variables de ejemplo
├── .gitignore               # Archivos ignorados por Git
│
├── README.md                # Info general del proyecto
└── DEVELOPMENT.md           # Este archivo
```

---

## 🔧 Configuración del Entorno

### Variables de Entorno (.env)

```env
VITE_APP_TITLE=Graph Cuts Segmentation App
VITE_API_URL=http://localhost:5173
VITE_DEBUG=false
```

Acceso en código:
```javascript
console.log(import.meta.env.VITE_APP_TITLE);
```

---

## 🛠️ Flujo de Desarrollo

### Paso 1: Crear rama para tu feature
```bash
git checkout -b feature/mi-feature
```

### Paso 2: Hacer cambios
- Edita archivos en `src/`
- Vite recargará automáticamente

### Paso 3: Testear localmente
```bash
npm run dev
# Abre http://localhost:5173
```

### Paso 4: Commit
```bash
git add .
git commit -m "feat: descripción de cambios"
```

### Paso 5: Push
```bash
git push origin feature/mi-feature
```

---

## 📦 Dependencias

### Runtime
- **React 18.2** - Framework UI
- **ReactDOM 18.2** - Renderizado en DOM
- **lucide-react** - Iconos SVG

### Desarrollo
- **Vite 4.3** - Build tool
- **@vitejs/plugin-react** - Plugin React para Vite

---

## 🐛 Solución de Problemas

### Error: "npm: command not found"
```bash
# Instala Node.js desde nodejs.org
# O actualiza npm
npm install -g npm@latest
```

### Puerto 5173 ya en uso
```bash
# Usa otro puerto
npm run dev -- --port 3000
```

### Dependencias no funcionan
```bash
# Limpia caché y reinstala
rm -rf node_modules package-lock.json
npm install
```

### Build falla
```bash
# Verifica la sintaxis
npm run lint

# Reconstruye
npm run build
```

---

## 🚀 Deploy a Netlify

### Opción 1: GitHub + Netlify (Recomendado)
```bash
git push origin main
# Netlify redeploy automáticamente
```

### Opción 2: Netlify CLI
```bash
npm install -g netlify-cli
npm run build
netlify deploy --prod --dir=dist
```

---

## 📝 Estándares de Código

### Naming
```javascript
// ✅ Componentes en PascalCase
function GraphCutsSegmentation() {}

// ✅ Variables en camelCase
const brushSize = 15;

// ✅ Constantes en UPPER_SNAKE_CASE
const MAX_BRUSH_SIZE = 50;
```

### Formato
```javascript
// Usa Prettier
npm run format
```

---

## 🔐 Seguridad

- ✅ No commites `.env` (usa `.env.example`)
- ✅ No subas `node_modules` (está en `.gitignore`)
- ✅ Mantén dependencias actualizadas:
  ```bash
  npm outdated
  npm update
  ```

---

## 📞 Soporte

Para más info:
- [Vite Docs](https://vitejs.dev)
- [React Docs](https://react.dev)
- [Tailwind CSS](https://tailwindcss.com)

¡Happy coding! 🚀
