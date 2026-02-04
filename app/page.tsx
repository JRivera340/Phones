'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './page.module.css';

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [model, setModel] = useState<any>(null);
  const [classNames, setClassNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [predictions, setPredictions] = useState<Array<{class: string, probability: number}>>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const animationFrameRef = useRef<number | null>(null);
  const tfRef = useRef<any>(null);

  // URL del modelo de Teachable Machine
  const MODEL_URL = 'https://teachablemachine.withgoogle.com/models/1w1r1kMHI/model.json';
  const METADATA_URL = 'https://teachablemachine.withgoogle.com/models/1w1r1kMHI/metadata.json';

  useEffect(() => {
    loadModel();
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Asegurar que el loop se detenga cuando isDetecting cambie a false
  useEffect(() => {
    if (!isDetecting && animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, [isDetecting]);

  const loadModel = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Cargar TensorFlow.js dinámicamente solo en el cliente
      if (!tfRef.current) {
        tfRef.current = await import('@tensorflow/tfjs');
      }
      const tf = tfRef.current;
      
      let loadedClassNames: string[] = [];
      
      // Intentar cargar los metadatos para obtener los nombres de las clases
      try {
        console.log('Cargando metadatos desde:', METADATA_URL);
        const metadataResponse = await fetch(METADATA_URL);
        if (metadataResponse.ok) {
          const metadata = await metadataResponse.json();
          console.log('Metadatos cargados:', metadata);
          
          // Intentar diferentes formatos de metadatos de Teachable Machine
          if (metadata.labels && Array.isArray(metadata.labels)) {
            loadedClassNames = metadata.labels;
          } else if (metadata.classNames && Array.isArray(metadata.classNames)) {
            loadedClassNames = metadata.classNames;
          } else if (metadata.classes && Array.isArray(metadata.classes)) {
            loadedClassNames = metadata.classes;
          }
          
          console.log('Nombres de clases encontrados:', loadedClassNames);
        } else {
          console.warn('No se pudo cargar metadatos, status:', metadataResponse.status);
        }
      } catch (metadataErr) {
        console.warn('Error al cargar los metadatos:', metadataErr);
      }
      
      // Cargar el modelo de Teachable Machine
      console.log('Cargando modelo desde:', MODEL_URL);
      const loadedModel = await tf.loadLayersModel(MODEL_URL);
      console.log('Modelo cargado, forma de salida:', loadedModel.outputs[0].shape);
      
      // Si no se cargaron los nombres de las clases, obtenerlos del modelo
      if (loadedClassNames.length === 0) {
        // Intentar obtener el número de clases del modelo
        const outputShape = loadedModel.outputs[0].shape;
        const numClasses = outputShape ? outputShape[outputShape.length - 1] : 2;
        console.log('Número de clases detectado del modelo:', numClasses);
        
        // Crear nombres genéricos basados en el número de clases
        loadedClassNames = Array.from({ length: numClasses }, (_, i) => 
          `Clase ${i + 1}`
        );
      }
      
      setClassNames(loadedClassNames);
      setModel(loadedModel);
      setLoading(false);
      console.log('✅ Modelo cargado exitosamente', { 
        classNames: loadedClassNames,
        numClasses: loadedClassNames.length,
        modelOutputShape: loadedModel.outputs[0].shape
      });
    } catch (err) {
      console.error('❌ Error al cargar el modelo:', err);
      setError('Error al cargar el modelo. Por favor, verifica la URL del modelo.');
      setLoading(false);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: 640, 
          height: 480,
          facingMode: 'environment' // Para usar la cámara trasera en móviles
        }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Esperar a que el video esté listo antes de iniciar la detección
        const handleLoadedMetadata = () => {
          setIsDetecting(true);
          // Iniciar el loop de detección después de un pequeño delay
          setTimeout(() => {
            detectLoop();
          }, 100);
        };
        
        if (videoRef.current.readyState >= 2) {
          // El video ya está listo
          handleLoadedMetadata();
        } else {
          videoRef.current.onloadedmetadata = handleLoadedMetadata;
        }
        
        await videoRef.current.play();
      }
    } catch (err) {
      console.error('Error al acceder a la cámara:', err);
      setError('No se pudo acceder a la cámara. Por favor, permite el acceso a la cámara.');
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsDetecting(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  };

  const detectLoop = async () => {
    // Verificar condiciones antes de continuar
    if (!model || !videoRef.current || !canvasRef.current) {
      console.log('Condiciones no cumplidas:', { model: !!model, video: !!videoRef.current, canvas: !!canvasRef.current });
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Verificar que el video tenga datos suficientes
    if (video.readyState < video.HAVE_CURRENT_DATA || !ctx) {
      // Si no hay datos aún, intentar de nuevo en el siguiente frame
      if (isDetecting) {
        animationFrameRef.current = requestAnimationFrame(detectLoop);
      }
      return;
    }

    try {
      // Configurar canvas con las dimensiones del video
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      // Dibujar el frame actual del video en el canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Usar TensorFlow.js ya cargado
      if (!tfRef.current) {
        tfRef.current = await import('@tensorflow/tfjs');
      }
      const tf = tfRef.current;

      // Preprocesar la imagen para el modelo
      const image = tf.browser.fromPixels(canvas);
      const resized = tf.image.resizeBilinear(image, [224, 224]);
      const normalized = resized.div(255.0);
      const batched = normalized.expandDims(0);

      // Realizar la predicción
      const prediction = model.predict(batched) as any;
      const probabilities = await prediction.data();

      // Obtener las clases del modelo
      type PredictionResult = { class: string; probability: number };
      const results: PredictionResult[] = Array.from(probabilities as number[])
        .map((prob: number, index: number) => ({
          class: classNames[index] || `Clase ${index}`,
          probability: prob
        }))
        .sort((a: PredictionResult, b: PredictionResult) => b.probability - a.probability);

      setPredictions(results);
      console.log('Predicciones:', results);

      // Limpiar tensores
      image.dispose();
      resized.dispose();
      normalized.dispose();
      batched.dispose();
      prediction.dispose();
    } catch (err) {
      console.error('Error en detectLoop:', err);
    }

    // Continuar el loop si aún está detectando
    if (isDetecting) {
      animationFrameRef.current = requestAnimationFrame(detectLoop);
    }
  };

  const topPrediction = predictions[0];

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <h1 className={styles.title}>Detector de Celulares</h1>
        <p className={styles.subtitle}>
          Usando modelo de Teachable Machine
        </p>

        {loading && (
          <div className={styles.loading}>
            <div className={styles.spinner}></div>
            <p>Cargando modelo...</p>
          </div>
        )}

        {error && (
          <div className={styles.error}>
            <p>{error}</p>
            <button onClick={loadModel} className={styles.button}>
              Reintentar
            </button>
          </div>
        )}

        {!loading && !error && (
          <>
            <div className={styles.videoContainer}>
              <video
                ref={videoRef}
                className={styles.video}
                playsInline
                muted
              />
              <canvas ref={canvasRef} className={styles.canvas} />
              
              {isDetecting && (
                <div className={styles.overlay}>
                  {topPrediction ? (
                    <div className={styles.predictionBox}>
                      <div className={styles.predictionLabel}>
                        {topPrediction.class}
                      </div>
                      <div className={styles.predictionBar}>
                        <div
                          className={styles.predictionFill}
                          style={{
                            width: `${topPrediction.probability * 100}%`,
                            backgroundColor: topPrediction.probability > 0.5 
                              ? '#4ade80' 
                              : '#fbbf24'
                          }}
                        />
                      </div>
                      <div className={styles.predictionPercent}>
                        {(topPrediction.probability * 100).toFixed(1)}%
                      </div>
                    </div>
                  ) : (
                    <div className={styles.predictionBox}>
                      <div className={styles.predictionLabel}>
                        Analizando...
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className={styles.controls}>
              {!isDetecting ? (
                <button onClick={startCamera} className={styles.button}>
                  Iniciar Detección
                </button>
              ) : (
                <button onClick={stopCamera} className={styles.buttonDanger}>
                  Detener Detección
                </button>
              )}
            </div>

            {predictions.length > 0 && (
              <div className={styles.predictions}>
                <h3>Resultados de Detección:</h3>
                <p className={styles.predictionsSubtitle}>
                  {classNames.length} {classNames.length === 1 ? 'clase' : 'clases'} detectadas
                </p>
                {predictions.map((pred, index) => (
                  <div key={index} className={styles.predictionItem}>
                    <span className={styles.predictionClass}>{pred.class}</span>
                    <div className={styles.probabilityBar}>
                      <div
                        className={styles.probabilityFill}
                        style={{ 
                          width: `${pred.probability * 100}%`,
                          backgroundColor: pred.probability > 0.7 
                            ? '#4ade80' 
                            : pred.probability > 0.4 
                            ? '#fbbf24' 
                            : '#f87171'
                        }}
                      />
                    </div>
                    <span className={styles.probabilityText}>
                      {(pred.probability * 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
