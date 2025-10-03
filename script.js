const URL = null;
    let model, webcam, labelContainer, maxPredictions;
    let currentModelURL = null;
    
    const statusDiv = document.getElementById("status");
    const loadModelBtn = document.getElementById("loadModelBtn");
    const reloadModelBtn = document.getElementById("reloadModelBtn");
    const startBtn = document.getElementById("startBtn");
    const modelUrlInput = document.getElementById("modelUrl");

    function setStatus(message, type) {
      statusDiv.textContent = message;
      statusDiv.className = `status-${type}`;
    }

    async function loadModel(modelURL, forceReload = false) {
      const baseURL = modelURL.endsWith('/') ? modelURL : modelURL + '/';
      const cacheBuster = forceReload ? `?t=${Date.now()}` : '';
      const modelJSONURL = baseURL + "model.json" + cacheBuster;
      const metadataURL = baseURL + "metadata.json" + cacheBuster;
      
      console.log('=== CARREGANDO MODELO ===');
      console.log('URL do modelo:', modelJSONURL);
      console.log('URL do metadata:', metadataURL);
      console.log('Forçando recarregamento:', forceReload);
      
      model = await tmImage.load(modelJSONURL, metadataURL);
      maxPredictions = model.getTotalClasses();
      currentModelURL = modelURL;
      
      console.log('✅ Total de classes carregadas:', maxPredictions);
      console.log('Classes:', model.getClassLabels());
      console.log('========================');
      
      if (labelContainer) {
        labelContainer.innerHTML = '';
        for (let i = 0; i < maxPredictions; i++) {
          labelContainer.appendChild(document.createElement("div"));
        }
        console.log('Label container atualizado com', maxPredictions, 'slots');
      }
    }

    loadModelBtn.addEventListener("click", async () => {
      const modelURL = modelUrlInput.value.trim();
      
      if (!modelURL) {
        setStatus("❌ Por favor, cole a URL do modelo!", "error");
        return;
      }
      
      try {
        loadModelBtn.disabled = true;
        setStatus("⏳ Carregando modelo...", "loading");
        
        await loadModel(modelURL);
        
        setStatus("✅ Modelo carregado com sucesso!", "success");
        startBtn.disabled = false;
        reloadModelBtn.style.display = 'block';
        
      } catch (err) {
        console.error("Erro ao carregar modelo:", err);
        setStatus("❌ Erro ao carregar modelo: " + err.message, "error");
        loadModelBtn.disabled = false;
      }
    });

    reloadModelBtn.addEventListener("click", async () => {
      if (!currentModelURL) return;
      
      try {
        reloadModelBtn.disabled = true;
        setStatus("⏳ Recarregando modelo atualizado (ignorando cache)...", "loading");
        
        await loadModel(currentModelURL, true);
        
        setStatus("✅ Modelo recarregado! Novas classes atualizadas.", "success");
        reloadModelBtn.disabled = false;
        
      } catch (err) {
        console.error("Erro ao recarregar modelo:", err);
        setStatus("❌ Erro ao recarregar: " + err.message, "error");
        reloadModelBtn.disabled = false;
      }
    });

    startBtn.addEventListener("click", async () => {
      try {
        startBtn.disabled = true;
        setStatus("⏳ Abrindo câmera...", "loading");
        
        const flip = true;
        webcam = new tmImage.Webcam(400, 400, flip);
        await webcam.setup();
        await webcam.play();
        
        window.requestAnimationFrame(loop);
        
        document.getElementById("webcam-container").appendChild(webcam.canvas);
        labelContainer = document.getElementById("label-container");
        for (let i = 0; i < maxPredictions; i++) {
          labelContainer.appendChild(document.createElement("div"));
        }
        
        setStatus("✅ Câmera ativa! Mostre a nota para reconhecimento.", "success");
        
      } catch (err) {
        console.error("Erro ao acessar câmera:", err);
        setStatus("❌ Erro ao acessar câmera: " + err.message, "error");
        startBtn.disabled = false;
      }
    });

    async function loop() {
      webcam.update();
      await predict();
      window.requestAnimationFrame(loop);
    }

    async function predict() {
      const prediction = await model.predict(webcam.canvas);
      prediction.sort((a, b) => b.probability - a.probability);
      
      const topPrediction = prediction[0];
      const detectedNoteDiv = document.getElementById("detected-note");
      const detectedNoteName = document.getElementById("detected-note-name");
      const detectedConfidence = document.getElementById("detected-confidence");
      
      if (topPrediction.probability > 0.6) {
        detectedNoteDiv.classList.add("show");
        detectedNoteName.textContent = topPrediction.className;
        detectedConfidence.textContent = `Confiança: ${(topPrediction.probability * 100).toFixed(1)}%`;
      } else {
        detectedNoteDiv.classList.remove("show");
      }
      
      for (let i = 0; i < maxPredictions; i++) {
        const classPrediction = prediction[i].className;
        const probability = (prediction[i].probability * 100).toFixed(1);
        
        labelContainer.childNodes[i].innerHTML = `
          <div class="prediction">
            <div class="prediction-name">${classPrediction}</div>
            <div class="prediction-bar">
              <div class="prediction-fill" style="width: ${probability}%"></div>
            </div>
            <div class="prediction-percent">${probability}%</div>
          </div>
        `;
      }
    }