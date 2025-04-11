import { Hands } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';

export function initHands(video, onResultsCallback) {
  const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
  });

  hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 0.8,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7,
  });

  hands.onResults((results) => {
    if (results.multiHandLandmarks.length > 0) {
      onResultsCallback(results.multiHandLandmarks[0]);
    } else {
      onResultsCallback([]);
    }
  });
  const offscreenCanvas = document.createElement("canvas");
  const offscreenCtx = offscreenCanvas.getContext("2d");

  const camera = new Camera(video, {
    onFrame: async () => {
      offscreenCanvas.width = video.videoWidth;
      offscreenCanvas.height = video.videoHeight;

      offscreenCtx.save();
      offscreenCtx.scale(-1, 1);
      offscreenCtx.drawImage(video, -offscreenCanvas.width, 0);
      offscreenCtx.restore();

      await hands.send({ image: offscreenCanvas });
    },
  });

  camera.start();
}
