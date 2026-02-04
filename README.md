# Detector de Celulares

Aplicación web para detectar celulares usando un modelo entrenado con Teachable Machine.

## Características

- 🎯 Detección en tiempo real usando la cámara
- 📱 Interfaz moderna y responsive
- 🚀 Optimizado para despliegue en Vercel
- 🤖 Usa TensorFlow.js para inferencia en el navegador

## Instalación

```bash
npm install
```

## Desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

## Despliegue en Vercel

1. Conecta tu repositorio a Vercel
2. Vercel detectará automáticamente que es un proyecto Next.js
3. El despliegue se realizará automáticamente

O usando la CLI de Vercel:

```bash
npm i -g vercel
vercel
```

## Modelo

El modelo utilizado está entrenado con Teachable Machine y se carga desde:
`https://teachablemachine.withgoogle.com/models/1w1r1kMHI/model.json`

## Requisitos

- Navegador moderno con soporte para:
  - WebRTC (para acceso a la cámara)
  - WebGL (para TensorFlow.js)
- Permisos de cámara en el navegador
