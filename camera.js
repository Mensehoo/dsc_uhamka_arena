// --- MediaPipe Hands Webcam Integration for dsc_uhamka_arena ---
window.addEventListener('load', () => {
    const videoElement = document.getElementById('webcamVideo');
    const hudCanvas = document.getElementById('hudCanvas');
    const hudCtx = hudCanvas.getContext('2d');
    const gestureIndicator = document.getElementById('gestureIndicator');
    
    if (typeof Hands === 'undefined' || typeof Camera === 'undefined') {
        console.error("Library MediaPipe Hands gagal dimuat dari CDN.");
        if (gestureIndicator) gestureIndicator.textContent = "Error: MP Gagal Dimuat";
    } else {
        if (gestureIndicator) gestureIndicator.textContent = "Meminta izin kamera...";
    
        const hands = new Hands({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
            }
        });
        
        hands.setOptions({
            maxNumHands: 1,
            modelComplexity: 1,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });
        
        hands.onResults((results) => {
            // Clear canvas
            hudCtx.clearRect(0, 0, hudCanvas.width, hudCanvas.height);
            
            // Draw mirrored video stream on the HUD canvas
            hudCtx.save();
            hudCtx.translate(hudCanvas.width, 0);
            hudCtx.scale(-1, 1);
            hudCtx.drawImage(results.image, 0, 0, hudCanvas.width, hudCanvas.height);
            hudCtx.restore();
            
            if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
                const landmarks = results.multiHandLandmarks[0];
                const wrist = landmarks[0];
                
                // 1. Detect if hand is open vs fist
                const fingers = [
                    { tip: 8, pip: 6 },
                    { tip: 12, pip: 10 },
                    { tip: 16, pip: 14 },
                    { tip: 20, pip: 18 }
                ];
                
                let foldedCount = 0;
                fingers.forEach(f => {
                    const tipDist = getDist(landmarks[f.tip], wrist);
                    const pipDist = getDist(landmarks[f.pip], wrist);
                    if (tipDist < pipDist) {
                        foldedCount++;
                    }
                });
                
                const isFist = foldedCount >= 3;
                
                if (isFist) {
                    window.currentGesture = 'diam';
                } else {
                    // 2. Compute average horizontal/vertical vector of fingers (knuckles 5,9,13,17 -> tips 8,12,16,20)
                    let sumDx = 0;
                    let sumDy = 0;
                    const joints = [
                        { tip: 8, knuckle: 5 },
                        { tip: 12, knuckle: 9 },
                        { tip: 16, knuckle: 13 },
                        { tip: 20, knuckle: 17 }
                    ];
                    
                    joints.forEach(j => {
                        sumDx += landmarks[j.tip].x - landmarks[j.knuckle].x;
                        sumDy += landmarks[j.tip].y - landmarks[j.knuckle].y;
                    });
                    
                    let avgDx = sumDx / 4;
                    let avgDy = sumDy / 4;
                    
                    // Mirror x axis because video is mirrored
                    avgDx = -avgDx;
                    
                    const threshold = 0.04;
                    if (Math.abs(avgDx) > Math.abs(avgDy)) {
                        if (avgDx < -threshold) {
                           window.currentGesture = 'kiri';
                        } else if (avgDx > threshold) {
                           window.currentGesture = 'kanan';
                        } else {
                           window.currentGesture = 'diam';
                        }
                    } else {
                        if (avgDy < -threshold) {
                           window.currentGesture = 'lompat';
                        } else {
                           window.currentGesture = 'diam';
                        }
                    }
                }
                
                // Update HUD label
                let gestureText = "DIAM";
                if (window.currentGesture === 'kiri') gestureText = "◀ KIRI";
                else if (window.currentGesture === 'kanan') gestureText = "KANAN ▶";
                else if (window.currentGesture === 'lompat') gestureText = "▲ LOMPAT";
                gestureIndicator.textContent = `Gestur: ${gestureText}`;
                
                // Draw colored hand skeleton
                drawHandSkeleton(landmarks);
            } else {
                window.currentGesture = 'diam';
                gestureIndicator.textContent = "Gestur: TIDAK TERDETEKSI";
            }
        });
    
        function getDist(p1, p2) {
            return Math.sqrt((p1.x - p2.x)**2 + (p1.y - p2.y)**2 + (p1.z - p2.z)**2);
        }
        
        function drawHandSkeleton(landmarks) {
            const colors = ['#4285F4', '#EA4335', '#34A853', '#FBBC05']; // Brand colors
            
            function getCanvasCoords(lm) {
                return {
                    x: hudCanvas.width * (1 - lm.x), // mirror coordinates
                    y: hudCanvas.height * lm.y
                };
            }
            
            const paths = [
                [0, 1, 2, 3, 4],       // Thumb
                [0, 5, 6, 7, 8],       // Index
                [9, 10, 11, 12],       // Middle
                [13, 14, 15, 16],      // Ring
                [0, 17, 18, 19, 20],   // Pinky
                [5, 9, 13, 17, 5]      // Knuckles
            ];
            
            // Draw skeleton lines
            hudCtx.lineWidth = 3;
            paths.forEach((path, idx) => {
                hudCtx.strokeStyle = colors[idx % colors.length];
                hudCtx.beginPath();
                const start = getCanvasCoords(landmarks[path[0]]);
                hudCtx.moveTo(start.x, start.y);
                for (let j = 1; j < path.length; j++) {
                    const pt = getCanvasCoords(landmarks[path[j]]);
                    hudCtx.lineTo(pt.x, pt.y);
                }
                hudCtx.stroke();
            });
            
            // Draw joint points
            landmarks.forEach((lm, idx) => {
                const pt = getCanvasCoords(lm);
                hudCtx.fillStyle = '#ffffff';
                hudCtx.strokeStyle = '#5f6368';
                hudCtx.lineWidth = 1;
                hudCtx.beginPath();
                hudCtx.arc(pt.x, pt.y, idx % 4 === 0 ? 4 : 2, 0, 2 * Math.PI);
                hudCtx.fill();
                hudCtx.stroke();
            });
        }
        
        // Start camera automatic processing
        const camera = new Camera(videoElement, {
            onFrame: async () => {
                try {
                    await hands.send({image: videoElement});
                } catch (err) {
                    console.error("Kesalahan AI MediaPipe:", err);
                    gestureIndicator.textContent = "Error AI: " + err.message;
                }
            },
            width: 200,
            height: 150
        });
        
        camera.start()
            .then(() => {
                gestureIndicator.textContent = "Kamera Aktif, Memuat AI...";
            })
            .catch(err => {
                console.error("Akses kamera gagal:", err);
                gestureIndicator.textContent = "Kamera Error: " + err.message;
            });
    }
});
