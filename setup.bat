@echo off
REM Colors (Windows 10+)
setlocal enabledelayedexpansion

echo.
echo ======================================
echo Graph Cuts Segmentation - Setup
echo ======================================
echo.

REM Verificar Node.js
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js no esta instalado
    echo Descargalo desde: https://nodejs.org
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i

echo [OK] Node.js encontrado: %NODE_VERSION%
echo [OK] npm encontrado: %NPM_VERSION%
echo.

REM Instalar dependencias
echo [INFO] Instalando dependencias...
call npm install

if errorlevel 1 (
    echo [ERROR] Error al instalar dependencias
    pause
    exit /b 1
)

echo [OK] Dependencias instaladas correctamente
echo.

REM Crear .env si no existe
if not exist .env (
    echo [INFO] Creando archivo .env...
    copy .env.example .env
    echo [OK] .env creado
    echo.
)

echo ======================================
echo [OK] Setup completado exitosamente!
echo ======================================
echo.

echo [INFO] Proximos pasos:
echo 1. npm run dev       (desarrollo)
echo 2. npm run build     (produccion)
echo 3. npm run preview   (ver resultado)
echo.

pause
