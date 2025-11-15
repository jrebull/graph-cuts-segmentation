# 🚀 Guía de Deployment a Netlify

## Opción 1: GitHub + Netlify (Recomendado - Deploy Automático)

### Paso 1: Crear repositorio en GitHub

```bash
# Navega a tu proyecto
cd GrpahCutsNet

# Inicializa Git
git init
git config user.email "tu@email.com"
git config user.name "Tu Nombre"

# Commit inicial
git add .
git commit -m "Graph Cuts Segmentation App - Initial commit"
```

### Paso 2: Crear repo en GitHub.com

1. Ve a **github.com/new**
2. Nombre del repo: `graph-cuts-segmentation`
3. Descripción: "Interactive image segmentation with Graph Cuts"
4. Selecciona **Public** (para Netlify)
5. **NO marques** "Initialize this repository with README"
6. Click **"Create repository"**

### Paso 3: Conectar repositorio local

GitHub te mostrará comandos como estos:

```bash
git remote add origin https://github.com/TU_USUARIO/graph-cuts-segmentation.git
git branch -M main
git push -u origin main
```

**Ejecuta esos comandos en tu terminal**

Si te pide autenticación:
- Opción A: GitHub CLI (recomendado)
  ```bash
  gh auth login
  ```
- Opción B: Token personal
  1. GitHub → Settings → Developer settings → Tokens (classic)
  2. Genera nuevo token
  3. Usa el token como contraseña

### Paso 4: Conectar Netlify

1. Ve a **netlify.com**
2. Click en **Sign up** (o Sign in si tienes cuenta)
3. Selecciona **GitHub** para registrarte/loguear
4. Una vez dentro, click **"Add new site"**
5. Selecciona **"Import an existing project"**
6. Autoriza GitHub si es necesario
7. Busca tu repo **`graph-cuts-segmentation`**
8. Click para seleccionarlo

### Paso 5: Configurar Build

Netlify debería auto-detectar:

```
Build command:     npm run build
Publish directory: dist
```

Si no lo detecta automáticamente:
1. Baja a "Build settings"
2. Build command: `npm run build`
3. Publish directory: `dist`

### Paso 6: Deploy

Click **"Deploy site"**

¡En 2-3 minutos tu app estará en vivo! 🎉

Tu URL será algo como: `https://tu-proyecto-xxx.netlify.app`

---

## Opción 2: Deploy Manual con Netlify CLI

```bash
# 1. Instala Netlify CLI
npm install -g netlify-cli

# 2. Build del proyecto
npm run build

# 3. Deploy a producción
netlify deploy --prod --dir=dist
```

Sigue los prompts interactivos.

---

## Opción 3: Drag & Drop en Netlify

```bash
# Build localmente
npm run build

# Abre https://app.netlify.com/drop
# Arrastra la carpeta 'dist' en el navegador
# ¡Listo! (URL temporal)
```

---

## 🔄 Actualizaciones Automáticas (GitHub + Netlify)

```bash
# Haz cambios en tu código
# Edita archivos en src/

# Commit y push
git add .
git commit -m "feat: descripción del cambio"
git push origin main

# ¡Netlify redeploy automáticamente! 🚀
# Puedes ver el estado en: https://app.netlify.com
```

---

## 📊 Monitoreo en Netlify

1. Ve a tu sitio en **netlify.com**
2. Tab **"Deploys"** - ve todos los despliegues
3. Tab **"Site settings"** - configura dominio personalizado
4. Tab **"Functions"** - si usas serverless functions
5. Tab **"Analytics"** - estadísticas del sitio

---

## 🔐 Variables de Entorno en Netlify

Si necesitas variables de entorno en producción:

1. Netlify → **Site settings** → **Build & deploy**
2. Scroll a **Environment**
3. Click **"Edit variables"**
4. Agrega tus variables:
   ```
   VITE_APP_TITLE = Graph Cuts App
   VITE_DEBUG = false
   ```

En tu código:
```javascript
console.log(import.meta.env.VITE_APP_TITLE);
```

---

## 🆘 Solución de Problemas

### Deploy falla: "npm: command not found"
- Netlify usa Node.js automáticamente
- Asegúrate que `package.json` tenga scripts correctos
- Verifica: Build command = `npm run build`, Publish = `dist`

### Deploy exitoso pero la app no funciona
```bash
# En tu proyecto local
npm run build
npm run preview
# Si funciona localmente, revisa los logs en Netlify
```

### Cambios no aparecen en producción
```bash
# En Netlify: "Trigger deploy" → "Deploy site"
# O espera a que detecte el nuevo push en GitHub
```

### Error: "CORS" en la app
- Asegúrate que no uses rutas relativas incorrectas
- Usa rutas absolutas en `src/`
- En Netlify no hay CORS entre assets

---

## 📱 Dominio Personalizado

1. Netlify → **Site settings**
2. **Domain management**
3. Click **"Add custom domain"**
4. Ingresa tu dominio (ej: graphcuts.com)
5. Sigue instrucciones para configurar DNS

---

## ✅ Checklist Pre-Deployment

- [ ] `npm run build` funciona localmente
- [ ] `npm run preview` se ve correctamente
- [ ] `.env` no está en Git (está en `.gitignore`)
- [ ] `README.md` actualizado
- [ ] Código formateado: `npm run format`
- [ ] No hay errores en console
- [ ] Tests pasan (si tienes)

---

## 🎉 ¡Felicidades!

Tu app Graph Cuts está en línea y accesible desde cualquier lugar del mundo.

Comparte tu URL: `https://tu-proyecto.netlify.app`

¿Necesitas más features? Agrega cambios y haz push a main. ¡Netlify redeploy automáticamente! 🚀
