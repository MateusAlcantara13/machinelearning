// ✅ URL DO MODELO TEACHABLE MACHINE
// Se precisar trocar, cole a URL do seu modelo exportado aqui
const MODEL_URL = "https://teachablemachine.withgoogle.com/models/5J_EDQ_VB/";

let model, webcam, maxPredictions;
let lastDetectedNote = null;
let isProcessing = false; // Previne sobreposição de predições

const audioPlayer = document.getElementById("notePlayer");
const statusDiv = document.getElementById("status");
const detectedNoteDiv = document.getElementById("detected-note");
const detectedNoteName = document.getElementById("detected-note-name");
const detectedConfidence = document.getElementById("detected-confidence");
const firebaseIndicator = document.getElementById("firebase-indicator");

// ⚡ CONTROLE DE FPS - Predição a cada 300ms (3-4 FPS)
const PREDICTION_INTERVAL = 300;
let lastPredictionTime = 0;

function setStatus(message, showSpinner = false) {
  statusDiv.innerHTML = showSpinner 
    ? `<div class="loading-spinner"></div><p>${message}</p>` 
    : `<p>${message}</p>`;
}

// 📤 ENVIAR DADOS AUTOMATICAMENTE PARA O FIREBASE
async function sendToFirebase(noteName, confidence) {
  try {
    // Mostrar indicador de envio
    if (firebaseIndicator) {
      firebaseIndicator.textContent = '📤 Enviando...';
      firebaseIndicator.className = 'firebase-indicator sending';
    }

    if (!window.firebaseDb) {
      throw new Error('Firebase não inicializado');
    }

    const detectionData = {
      noteName: noteName,
      confidence: parseFloat((confidence * 100).toFixed(1)),
      timestamp: window.firebaseTimestamp(),
      dateString: new Date().toLocaleString('pt-BR'),
      deviceInfo: {
        userAgent: navigator.userAgent,
        language: navigator.language
      }
    };

    // Enviar para o nó 'detections' no Firebase Realtime Database
    const detectionsRef = window.firebaseRef(window.firebaseDb, 'detections');
    const result = await window.firebasePush(detectionsRef, detectionData);

    console.log('✅ Dados enviados ao Firebase:', detectionData);
    console.log('📍 ID do registro:', result.key);

    // Indicador de sucesso
    if (firebaseIndicator) {
      firebaseIndicator.textContent = '✅ Enviado!';
      firebaseIndicator.className = 'firebase-indicator success';

      // Esconder após 2 segundos
      setTimeout(() => {
        firebaseIndicator.style.display = 'none';
      }, 2000);
    }

  } catch (error) {
    console.error('❌ Erro ao enviar ao Firebase:', error);
    
    // Indicador de erro
    if (firebaseIndicator) {
      firebaseIndicator.textContent = '❌ Erro no envio';
      firebaseIndicator.className = 'firebase-indicator error';

      // Esconder após 3 segundos
      setTimeout(() => {
        firebaseIndicator.style.display = 'none';
      }, 3000);
    }
  }
}

// 🚀 INICIALIZAR AUTOMATICAMENTE
async function init() {
  try {
    setStatus("Carregando modelo de IA...", true);
    
    // Carregar modelo
    const modelURL = MODEL_URL + "model.json";
    const metadataURL = MODEL_URL + "metadata.json";
    
    console.log('🔍 Carregando modelo de:', modelURL);
    
    model = await tmImage.load(modelURL, metadataURL);
    maxPredictions = model.getTotalClasses();
    
    console.log('✅ Modelo carregado com sucesso! Classes:', maxPredictions);
    
    setStatus("Ativando câmera...", true);
    
    // ⚡ RESOLUÇÃO REDUZIDA: 320x320 (melhor performance)
    const flip = true; // espelhar câmera
    webcam = new tmImage.Webcam(320, 320, flip);
    await webcam.setup();
    await webcam.play();
    
    document.getElementById("webcam-container").appendChild(webcam.canvas);
    
    setStatus("✅ Sistema ativo! Posicione a nota em frente à câmera", false);
    
    // Iniciar loop de predição
    window.requestAnimationFrame(loop);
    
  } catch (error) {
    console.error("❌ Erro ao inicializar:", error);
    setStatus("❌ Erro: " + error.message, false);
  }
}

async function loop(timestamp) {
  // ⚡ Atualizar webcam sempre (operação leve - 60 FPS)
  webcam.update();
  
  // ⚡ Fazer predição apenas a cada PREDICTION_INTERVAL ms
  if (timestamp - lastPredictionTime >= PREDICTION_INTERVAL && !isProcessing) {
    lastPredictionTime = timestamp;
    predict(); // Sem await - roda em paralelo
  }
  
  window.requestAnimationFrame(loop);
}

async function predict() {
  if (isProcessing) return; // Evita sobreposição de predições
  
  isProcessing = true;
  
  try {
    const prediction = await model.predict(webcam.canvas);
    prediction.sort((a, b) => b.probability - a.probability);
    
    const topPrediction = prediction[0];
    
    // Limiar de confiança: 60%
    if (topPrediction.probability > 0.60) {
      detectedNoteDiv.classList.add("show");
      detectedNoteName.textContent = topPrediction.className;
      detectedConfidence.textContent = `Confiança: ${(topPrediction.probability * 100).toFixed(1)}%`;
      
      // Adicionar efeito de pulso
      detectedNoteDiv.classList.add("pulse-effect");
      setTimeout(() => detectedNoteDiv.classList.remove("pulse-effect"), 1000);
      
      // 🔊 Tocar áudio e enviar ao Firebase apenas quando detectar nota diferente
      if (topPrediction.className !== lastDetectedNote) {
        lastDetectedNote = topPrediction.className;
        
        // Tocar áudio
        playAudio(topPrediction.className);
        
        // 📤 ENVIAR AO FIREBASE APENAS SE FOR UMA NOTA VÁLIDA (não erro)
        const notasValidas = ["2 reais", "5 reais", "10 reais"];
        if (notasValidas.includes(topPrediction.className)) {
          sendToFirebase(topPrediction.className, topPrediction.probability);
          console.log("💰 Nota válida detectada - enviando ao Firebase");
        } else {
          console.log("⚠️ Erro detectado - não enviando ao Firebase:", topPrediction.className);
        }
      }
      
    } else {
      // Se não detectar nada com confiança suficiente, esconder resultado
      detectedNoteDiv.classList.remove("show");
      lastDetectedNote = null;
    }
  } catch (error) {
    console.error("❌ Erro na predição:", error);
  } finally {
    isProcessing = false;
  }
}

function playAudio(noteName) {
  let audioFile = null;
  
  // 🔊 MAPEAMENTO DAS CLASSES PARA ARQUIVOS DE ÁUDIO
  const notasComAudio = {
    "2 reais": "sounds/0001.mp3",
    "5 reais": "sounds/0005.mp3",
    "10 reais": "sounds/0004.mp3",
    "Não identificado !": "sounds/0003.mp3",
    "Não foi possível ler o valor !": "sounds/0002.mp3"
  };
  
  audioFile = notasComAudio[noteName];
  
  if (audioFile) {
    console.log("🔊 Tocando áudio:", audioFile, "para nota:", noteName);
    audioPlayer.src = audioFile;
    audioPlayer.play().catch(err => {
      console.log("⚠️ Erro ao tocar áudio:", err);
    });
  } else {
    console.warn("⚠️ Classe não mapeada para áudio:", noteName);
  }
}

// 🟢 Iniciar automaticamente quando a página carregar
window.addEventListener('DOMContentLoaded', () => {
  init();
});