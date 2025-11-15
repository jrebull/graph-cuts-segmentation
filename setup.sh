#!/bin/bash

# Color codes para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}Graph Cuts Segmentation - Setup${NC}"
echo -e "${BLUE}======================================${NC}\n"

# Verificar Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js no está instalado${NC}"
    echo "Descargalo desde: https://nodejs.org"
    exit 1
fi

echo -e "${GREEN}✓ Node.js encontrado:${NC} $(node --version)"
echo -e "${GREEN}✓ npm encontrado:${NC} $(npm --version)\n"

# Instalar dependencias
echo -e "${BLUE}📦 Instalando dependencias...${NC}"
npm install

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Dependencias instaladas correctamente${NC}\n"
else
    echo -e "${RED}❌ Error al instalar dependencias${NC}"
    exit 1
fi

# Crear .env si no existe
if [ ! -f .env ]; then
    echo -e "${BLUE}🔧 Creando archivo .env...${NC}"
    cp .env.example .env
    echo -e "${GREEN}✓ .env creado${NC}\n"
fi

echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}✅ Setup completado exitosamente!${NC}"
echo -e "${GREEN}======================================${NC}\n"

echo -e "${BLUE}Próximos pasos:${NC}"
echo -e "1. npm run dev       (desarrollo)"
echo -e "2. npm run build     (producción)"
echo -e "3. npm run preview   (ver resultado)"
echo ""
