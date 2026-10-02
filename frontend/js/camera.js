/* =========================================================
   AlertaCidade — Módulo de câmera
   Encapsula getUserMedia (foto) e MediaRecorder (vídeo, com
   limite de 3 minutos). Não conhece o estado da aplicação:
   apenas expõe start/stop/capturePhoto/startRecording.
   ========================================================= */

const Camera = (() => {
  const MAX_VIDEO_SECONDS = 180; // limite de 3 minutos

  let stream = null;
  let mediaRecorder = null;
  let chunks = [];
  let timerInterval = null;
  let recordSeconds = 0;
  let activeVideoEl = null;
  let streamRequestId = 0;

  function isSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  }

  async function start(videoEl, facingMode, withAudio) {
    stop();
    const requestId = ++streamRequestId;
    const nextStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { exact: facingMode || 'user' } },
      audio: !!withAudio,
    });
    if (requestId !== streamRequestId) {
      nextStream.getTracks().forEach(track => track.stop());
      return false;
    }
    stream = nextStream;
    activeVideoEl = videoEl;
    videoEl.srcObject = nextStream;
    try {
      await videoEl.play();
    } catch (error) {
      stop();
      throw error;
    }
    return true;
  }

  function stop() {
    streamRequestId += 1;
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      try { mediaRecorder.stop(); } catch (e) { /* já parado */ }
    }
    const currentStream = stream;
    if (currentStream) {
      currentStream.getTracks().forEach(track => track.stop());
      stream = null;
    }
    if (activeVideoEl) {
      activeVideoEl.pause();
      if (activeVideoEl.srcObject === currentStream) activeVideoEl.srcObject = null;
      activeVideoEl = null;
    }
    mediaRecorder = null;
    chunks = [];
    recordSeconds = 0;
  }

  function capturePhoto(videoEl) {
    if (!videoEl || videoEl.readyState < 2 || !videoEl.videoWidth || !videoEl.videoHeight) {
      throw new Error('A câmera ainda não está pronta para capturar.');
    }
    const canvas = document.createElement('canvas');
    canvas.width = videoEl.videoWidth;
    canvas.height = videoEl.videoHeight;
    canvas.getContext('2d').drawImage(videoEl, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  }

  function pickMimeType() {
    const options = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    return options.find(m => window.MediaRecorder.isTypeSupported(m)) || '';
  }

  function startRecording(onTick, onAutoStop) {
    if (!stream) return;
    chunks = [];
    recordSeconds = 0;
    const mimeType = pickMimeType();
    mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    mediaRecorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
    mediaRecorder.start();

    timerInterval = setInterval(() => {
      recordSeconds += 1;
      if (onTick) onTick(recordSeconds);
      if (recordSeconds >= MAX_VIDEO_SECONDS) {
        if (onAutoStop) onAutoStop();
      }
    }, 1000);
  }

  function stopRecording() {
    return new Promise((resolve) => {
      if (!mediaRecorder) return resolve(null);
      if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
      const duration = recordSeconds;
      const recorder = mediaRecorder;
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: recorder.mimeType || 'video/webm' });
        resolve({ blob, duration });
      };
      if (recorder.state !== 'inactive') recorder.stop();
      else resolve(null);
    });
  }

  return { isSupported, start, stop, capturePhoto, startRecording, stopRecording, MAX_VIDEO_SECONDS };
})();

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function formatMMSS(totalSeconds) {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const s = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}
