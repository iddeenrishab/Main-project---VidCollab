export function setupVideo(videoElement) {
  navigator.mediaDevices.getUserMedia({ video: true })
    .then((stream) => {
      videoElement.srcObject = stream;
      videoElement.play();
    })
    .catch((err) => console.error("Error accessing webcam:", err));
}
