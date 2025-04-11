const Hands = window.Hands;
const Camera = window.Camera;

export function initHands(video, onResultsCallback) {
  const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
  });

  hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.6,
  });

  hands.onResults((results) => {
    if (results.multiHandLandmarks.length > 0) {
      onResultsCallback(results.multiHandLandmarks[0]);
    } else {
      onResultsCallback([]);
    }
  });

  // Create an offscreen canvas to flip the frame
  const offscreenCanvas = document.createElement("canvas");
  const offscreenCtx = offscreenCanvas.getContext("2d");

  const camera = new Camera(video, {
    onFrame: async () => {
      // Update canvas size dynamically to match video size
      offscreenCanvas.width = video.videoWidth;
      offscreenCanvas.height = video.videoHeight;

      // Flip the frame horizontally
      offscreenCtx.save();
      offscreenCtx.scale(-1, 1);
      offscreenCtx.drawImage(video, -offscreenCanvas.width, 0);
      offscreenCtx.restore();

      // Send the flipped frame to MediaPipe Hands
      await hands.send({ image: offscreenCanvas });
    },
  });

  camera.start();
}
