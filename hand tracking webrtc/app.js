import { initHands } from './media/mediapipe_hands.js';
import { setupVideo } from './media/videoHandler.js';

const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const toolDisplay = document.getElementById('current-tool');

canvas.width = video.width = 640;
canvas.height = video.height = 480;

// Settings
let currentTool = null;
let lastX = null;
let lastY = null;
let isDrawing = false;
const eraserSize = 30; // Larger erasing area
const penSize = 5; // Drawing thickness

// Make canvas transparent by setting clear color
ctx.clearRect(0, 0, canvas.width, canvas.height);

video.style.transform = "scaleX(-1)";



// Set up the video feed
setupVideo(video);

// Initialize hand tracking
initHands(video, (landmarks) => {
  if (landmarks.length > 0) {
    const indexTip = landmarks[8];   // Index finger tip
    const middleTip = landmarks[12]; // Middle finger tip

    // Convert normalized coordinates to canvas coordinates
    const x = indexTip.x * canvas.width;
    const y = indexTip.y * canvas.height;

    // Detect fingers up/down (FASTER method)
    const indexUp = indexTip.y < landmarks[6].y; // Compare with index base
    const middleUp = middleTip.y < landmarks[10].y; // Compare with middle base

    // Determine the tool
    if (indexUp && !middleUp) {
      currentTool = 'draw';
    } else if (indexUp && middleUp) {
      currentTool = 'erase';
    } else {
      currentTool = null; // No tool if fingers don't match conditions
    }

    toolDisplay.textContent = currentTool ? (currentTool === 'draw' ? "Drawing" : "Erasing") : "None";

    if (currentTool === 'draw') {
      if (!isDrawing) {
        lastX = x;
        lastY = y;
        isDrawing = true;
      }
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(x, y);
      ctx.strokeStyle = 'black';
      ctx.lineWidth = penSize;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.closePath();

      lastX = x;
      lastY = y;
    } else if (currentTool === 'erase') {
      ctx.globalCompositeOperation = "destination-out"; // Allows erasing only strokes
      ctx.beginPath();
      ctx.arc(x, y, eraserSize / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over"; // Reset to normal drawing
      isDrawing = false; 
    } else {
      isDrawing = false; // Stop drawing if no tool is active
    }
  } else {
    isDrawing = false; // Stop drawing if no hand is detected
  }
});
