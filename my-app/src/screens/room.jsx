
import React, { useEffect, useCallback, useState, useRef } from 'react';
import { useSocket } from '../context/SocketProvider';
import ReactPlayer from 'react-player';
import peer from '../service/peer';
import { initHands } from '../media/mediapipe_hands';
import { setupVideo } from '../media/videoHandler';

const RoomPage = () => {
    const socket = useSocket();
    const [myStream, setMyStream] = useState();
    const [remoteStream, setRemoteStream] = useState();
    const [remoteSocketId, setRemoteSocketId] = useState(null);
    const [isStreamSent, setIsStreamSent] = useState(false);
    const [isRemoteStreamActive, setIsRemoteStreamActive] = useState(false);
    const [callInitiated, setCallInitiated] = useState(false);
    const dataChannelRef = useRef(null);
    const [canvasReady, setCanvasReady] = useState(false);
    
    const canvasRef = useRef(null);
    const ctxRef = useRef(null);
    const videoRef = useRef(null);
    
    let lastX = null, lastY = null;
    let isDrawing = useRef(false);

    const handleCallUser = useCallback(async () => {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true,
        });
        const offer = await peer.getOffer();

        const dataChannel = peer.peer.createDataChannel('canvas');
        dataChannelRef.current = dataChannel;

        console.log("DataChannel created:", dataChannel);

        dataChannel.onopen = () => {
            console.log('Data channel opened');
        };

        dataChannel.onmessage = (event) => {
            console.log("Data received on DataChannel:", event.data);
            const { type, x, y } = JSON.parse(event.data);
            if (type === 'draw') drawOnCanvas(x, y);
            if (type === 'begin') startDrawingRemote(x, y);
            if (type === 'end') stopDrawingRemote();
        };

        socket.emit('user:call', { to: remoteSocketId, offer });
        setMyStream(stream);
        setCallInitiated(true);
        initHands(videoRef.current, handleHandTracking);
    }, [remoteSocketId, socket]);

    
    const handleNegotiationIncomming=useCallback(
        async ({from,offer})=>{
        const ans=await peer.getAnswer(offer);
        socket.emit("peer:nego:done",{to:from,ans})
    },[socket])

    const sendStreams=useCallback(()=>{
        
        for(const track of myStream.getTracks()){
            peer.peer.addTrack(track,myStream);
        }
        setIsStreamSent(true);
    },[myStream]);

    const handleCallAccepted=useCallback((from,ans)=>{
        peer.setLocalDescription(ans)
        console.log("call accepted ");
        sendStreams();

        peer.peer.ondatachannel = (event) => {
            const channel = event.channel;
            dataChannelRef.current = channel;
            console.log("Received DataChannel from remote peer:", channel);

            channel.onopen = () => console.log("Remote DataChannel is now OPEN.");
            channel.onmessage = (event) => {
                console.log("Data received on remote peer:", event.data);
                const { type, x, y } = JSON.parse(event.data);
                if (type === 'draw') drawOnCanvas(x, y);
                if (type === 'begin') startDrawingRemote(x, y);
                if (type === 'end') stopDrawingRemote();
                if (type === 'erase') eraseOnCanvas(x, y);
            };
        };

    },[sendStreams])

    const handleNegoNeedFinal=useCallback(async({ans})=>{
        await peer.setLocalDescription(ans); 
    },[])

    const handleIncommingCall=useCallback(async({from,offer}) =>{
        setRemoteSocketId(from);
        console.log(`Incomming Call`,from,offer);
        const stream = await navigator.mediaDevices.getUserMedia({
            audio:true,
            video: true,
        });
        setMyStream(stream);
        const ans = await peer.getAnswer(offer);
        socket.emit("call:accepted",{to:from,ans});
    },[socket]);

    const handleUserJoined = useCallback(({email,id})=>{
        console.log(`email here refeered is ${email} joined room`)
        setRemoteSocketId(id);
    },[]);

    const handleNegotiationNeeded=useCallback(async ()=>{
        const offer= await peer.getOffer();
        socket.emit("peer:nego:needed",{offer,to:remoteSocketId})

    },[remoteSocketId,socket])


    const startDrawing = (e) => {
        if (!dataChannelRef.current) {
            console.warn("DataChannel not initialized");
            return;
          }
      
          isDrawing.current = true;
          const { offsetX, offsetY } = e.nativeEvent;
      
          if (ctxRef.current) {
            ctxRef.current.beginPath();
            ctxRef.current.moveTo(offsetX, offsetY);
          }
      
          if (dataChannelRef.current.readyState === "open") {
            const message = JSON.stringify({
              type: "begin",
              x: offsetX,
              y: offsetY,
            });
            try {
              dataChannelRef.current.send(message);
            } catch (error) {
              console.error("Failed to send startDrawing:", error);
            }
        }
    };
    
    const draw = (e) => {
        if (!isDrawing.current || !ctxRef.current || !dataChannelRef.current) {
          return;
        }
    
        const { offsetX, offsetY } = e.nativeEvent;
    
        // Draw locally
        ctxRef.current.globalCompositeOperation = 'source-over';
        ctxRef.current.lineWidth = 5;
        ctxRef.current.lineTo(offsetX, offsetY);
        ctxRef.current.stroke();
    
        // Send drawing data
        if (dataChannelRef.current.readyState === "open") {
          try {
            dataChannelRef.current.send(
              JSON.stringify({
                type: "draw",
                x: offsetX,
                y: offsetY,
                pressure: e.pressure || 1.0, // Include pressure if available
                timestamp: performance.now(), // More precise timing
              })
            );
          } catch (error) {
            console.error("Drawing data send failed:", error);
          }
        }
    };
    
    
    const stopDrawing = () => {
        isDrawing.current = false;
    
        if (ctxRef.current) {
          ctxRef.current.closePath();
        }
    
        if (dataChannelRef.current?.readyState === "open") {
          try {
            dataChannelRef.current.send(
              JSON.stringify({
                type: "end",
                timestamp: performance.now(),
              })
            );
          } catch (error) {
            console.error("Stop drawing signal failed:", error);
          }
        }
    };
    





    useEffect(() => {
        if (dataChannelRef.current) {
            dataChannelRef.current.onmessage = (event) => {
                const { type, x, y } = JSON.parse(event.data);
                if (type === 'draw') drawOnCanvas(x, y);
                if (type === 'begin') startDrawingRemote(x, y);
                if (type === 'end') stopDrawingRemote();
                if (type === 'erase') eraseOnCanvas(x, y);
                if (type === 'clear') clearCanvas();
                
            };
        }
    }, [dataChannelRef.current]);

    const startDrawingRemote = (x, y) => {
        if (!ctxRef.current) return;
        ctxRef.current.beginPath();
        ctxRef.current.moveTo(x, y);
    };
    
    const stopDrawingRemote = () => {
        if (!ctxRef.current) return;
        ctxRef.current.closePath();
    };
    
    const drawOnCanvas = (x, y) => {
        if (!ctxRef.current) {
          console.warn("Canvas context not available for remote drawing");
          return;
        }
    
        try {  
          ctxRef.current.globalCompositeOperation = 'source-over';
          ctxRef.current.lineWidth = 5;
          ctxRef.current.lineTo(x, y);
          ctxRef.current.stroke();
        } catch (error) {
          console.error("Remote drawing failed:", error);
        }
      };
      useEffect(() => {
        const checkDataChannel = () => {
          console.log(
            "DataChannel state:",
            dataChannelRef.current?.readyState || "not initialized"
          );
        };
        const interval = setInterval(checkDataChannel, 5000);
    return () => clearInterval(interval);
    }, []);


    

    const eraseOnCanvas = (x, y) => {
        if (!ctxRef.current) {
          console.warn("Canvas context not available for remote drawing");
          return;
        }
    
        try {  
          ctxRef.current.globalCompositeOperation = 'destination-out';
          ctxRef.current.lineWidth = 30;
          ctxRef.current.lineTo(x, y);
          ctxRef.current.stroke();
        } catch (error) {
          console.error("Remote drawing failed:", error);
        }
      };
      useEffect(() => {
        const checkDataChannel = () => {
          console.log(
            "DataChannel state:",
            dataChannelRef.current?.readyState || "not initialized"
          );
        };
        const interval = setInterval(checkDataChannel, 5000);
    return () => clearInterval(interval);
    }, []);

    
    
    
    //Canvas resizing
    useEffect(() => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
    
            video.onloadedmetadata = () => {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                console.log("Canvas size set to video dimensions");
            };
        }
    }, [myStream]);
    




    const handleHandTracking = (landmarks) => {
        if (!landmarks.length) {
            isDrawing = false;
            return;
        }
    
        const indexTip = landmarks[8];
    
        const x = indexTip.x * canvasRef.current.width;
        const y = indexTip.y * canvasRef.current.height;

        console.log("Hand tracking event - Coordinates:", { x, y });
    
        // Helper function to check if a finger is up
        const isFingerUp = (tip, pip) => tip.y < pip.y;
    
        // Check if only the index finger is up (and thumb is ignored)
        const isIndexFingerUp = isFingerUp(landmarks[8], landmarks[6]) &&
            !isFingerUp(landmarks[12], landmarks[10]) &&
            !isFingerUp(landmarks[16], landmarks[14]) &&
            !isFingerUp(landmarks[20], landmarks[18]);
    
        // Check if two fingers (index and middle) are up
        const isTwoFingersUp = isFingerUp(landmarks[8], landmarks[6]) && isFingerUp(landmarks[12], landmarks[10]);
    
        // Check if palm is fully open (all fingers up)
        const isAllFingersUp = (
            isFingerUp(landmarks[4], landmarks[3]) &&  // Thumb
            isFingerUp(landmarks[8], landmarks[6]) &&  // Index finger
            isFingerUp(landmarks[12], landmarks[10]) &&  // Middle finger
            isFingerUp(landmarks[16], landmarks[14]) &&  // Ring finger
            isFingerUp(landmarks[20], landmarks[18])  // Pinky finger
        );
        
        if (isAllFingersUp) {
            if (!window.palmTimer) {
                window.palmTimer = setTimeout(() => {
                    handleErase();
                    console.log("Canvas Cleared!");
                }, 2500); 
            }
        } else {
            clearTimeout(window.palmTimer);
            window.palmTimer = null;
        }
    
        if (!isIndexFingerUp && !isTwoFingersUp) {
            isDrawing = false;
            return;
        }
    
        // Erase if two fingers are up, else draw normally
        if (!isDrawing) {
            lastX = x;
            lastY = y;
            isDrawing = true;
            if (
                dataChannelRef.current &&
                dataChannelRef.current.readyState === "open"
              ) {
                console.log("Sending start event via DataChannel.");
                dataChannelRef.current.send(JSON.stringify({ type: "begin", x, y }));
              }
        }
    
        ctxRef.current.beginPath();
        ctxRef.current.moveTo(lastX, lastY);
    
        if (isTwoFingersUp) {
            // Erase using clearRect
            ctxRef.current.globalCompositeOperation = 'destination-out';
            ctxRef.current.lineWidth = 30; // Eraser thickness
            ctxRef.current.lineTo(x, y);
            ctxRef.current.lineCap = 'round';
            ctxRef.current.stroke();
            ctxRef.current.closePath();
            if (
                dataChannelRef.current &&
                dataChannelRef.current.readyState === "open"
              ) {
                console.log("Sending erasing event via DataChannel:", { x, y });
                dataChannelRef.current.send(JSON.stringify({ type: "erase", x, y }));
              } else {
                console.warn("DataChannel not open - Unable to send hand tracking data.");
              }
        } else {
            // Draw in normal mode
            ctxRef.current.globalCompositeOperation = 'source-over';
            ctxRef.current.strokeStyle = 'black';
            ctxRef.current.lineWidth = 5;
            ctxRef.current.lineTo(x, y);
            ctxRef.current.lineCap = 'round';
            ctxRef.current.stroke();
            ctxRef.current.closePath();
            if (
                dataChannelRef.current &&
                dataChannelRef.current.readyState === "open"
              ) {
                console.log("Sending draw event via DataChannel:", { x, y });
                dataChannelRef.current.send(JSON.stringify({ type: "draw", x, y }));
              } else {
                console.warn("DataChannel not open - Unable to send hand tracking data.");
              }
        }
    
        // ctxRef.current.lineTo(x, y);
        // ctxRef.current.lineCap = 'round';
        // ctxRef.current.stroke();
        // ctxRef.current.closePath();
    
        lastX = x;
        lastY = y;
    
        // if (
        //     dataChannelRef.current &&
        //     dataChannelRef.current.readyState === "open"
        //   ) {
        //     console.log("Sending draw event via DataChannel:", { x, y });
        //     dataChannelRef.current.send(JSON.stringify({ type: "draw", x, y }));
        //   } else {
        //     console.warn("DataChannel not open - Unable to send hand tracking data.");
        //   }
    };
    

    useEffect(() => {
        if (videoRef.current && myStream) {
            const video = videoRef.current;
            
            // Prevent multiple reassignments
            if (video.srcObject !== myStream) {
                video.srcObject = myStream;
                
                video.onloadedmetadata = async () => {
                    try {
                        await video.play();
                    } catch (error) {
                        console.error("Video play interrupted:", error);
                    }
                };
            }
        }
    }, [myStream]);
    

    const handleErase = () => {
        clearCanvas();
        if (dataChannelRef.current?.readyState === "open") {
            try {
              dataChannelRef.current.send(
                JSON.stringify({
                  type: "clear",
                  timestamp: performance.now(),
                })
              );
            } catch (error) {
              console.error("clear drawing signal failed:", error);
            }
          }
      };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      };
    
    

    useEffect(() => {
        const canvas = canvasRef.current;
        canvas.width = 361.2;
        canvas.height = 295.35;
        const ctx = canvas.getContext('2d');
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctxRef.current = ctx;
    }, []);

    useEffect(() => {
        if (canvasRef.current) {
            setCanvasReady(true);
          }
    },[]);

    useEffect(()=>{
        peer.peer.addEventListener("negotiationneeded",handleNegotiationNeeded);
        return ()=>{
            peer.peer.removeEventListener("negotiationneeded",handleNegotiationNeeded)
        }
    },[handleNegotiationNeeded]);


    useEffect(()=>{
        peer.peer.addEventListener('track',async (ev) =>{
            const remoteStream = ev.streams;
            console.log("GOT TRACKS!!!");
            setRemoteStream(remoteStream[0]);
            setIsRemoteStreamActive(true); 
        })
    },[]);



    useEffect(()=>{
        socket.on('user:joined',handleUserJoined)
        socket.on('incomming:call',handleIncommingCall);
        socket.on('call:acepted',handleCallAccepted);
        socket.on("peer:nego:needed",handleNegotiationIncomming)
        socket.on("peer:nego:final",handleNegoNeedFinal)

        return ()=>{
            socket.off('incomming:call',handleIncommingCall);
            socket.off('user:joined',handleUserJoined);
            socket.off('call:acepted',handleCallAccepted);
            socket.off("peer:nego:needed",handleNegotiationIncomming);
            socket.off("peer:nego:final",handleNegoNeedFinal);

        }
    }, [socket,handleUserJoined,handleIncommingCall,handleNegoNeedFinal,handleNegotiationIncomming,handleCallAccepted]);


    return (
        <div>
            <h1>Room Page</h1>
            <h4>{remoteSocketId ? 'Connected' : "no one in room"}</h4>
            {
                !callInitiated &&  remoteSocketId && <button onClick={handleCallUser}>CALL</button>
            }
            {
                !isStreamSent && myStream && <button onClick={sendStreams} >Send Stream</button>
            }
            {
                isStreamSent && myStream && canvasReady && <button onClick={handleErase}>Erase the Canvas</button>
            }
            <video ref={videoRef} autoPlay playsInline muted style={{ display: 'none' }}></video>
            


            
        <div style={{ margin: '0',
         padding: '0',
          boxSizing: 'border-box', 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'flex-end', 
          height:'75vh'}}>
            
            <div className="first" 
            style={{ 
                width: '100%',
                height: '40vh',
                marginbottom: '10vh',
                display: 'flex',
                border: '2px solid black' ,}}>

            
                
            <div className="left" 
            style={{ width: '50%', 
             height: '100%',
             position:'relative', 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'flex-start', 
            borderRight: '2px solid black', }}> 


            <div className="left-top" 
            style={{ width: '100%', 
            height: '100%',
            position:'absolute',
            top:'0',
            left:"0",
            zIndex:"2",}}>

            <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseOut={stopDrawing}
            />
            </div>
            <div className="left-bottom" 
            style={{ width: '100%', 
            height: '100%',position:'absolute',
            top:'0',
            left:"0",
            zIndex:"1",}}>
            {
                myStream && (
                <>
                    <h5 style={{position: 'absolute', top: '-10px', left: '20px'}}>My stream</h5>
                    <video 
                        ref={videoRef} 
                        autoPlay 
                        playsInline 
                        muted 
                        style={{ transform: 'scaleX(-1)', width: '100%', height: '100%' }} 
                    />
                </>
                )
            }

            </div>
            </div>
            <div className="right"
            style={{position:"relative",width: '50%',
            height: '100%'}}>
            {
                remoteStream && (
                <>
                    <h5 style={{position: 'absolute', top: '-10px', left: '20px'}}>Remote stream</h5>
                    <video 
                        ref={(video) => {
                            if (video && remoteStream) {
                                video.srcObject = remoteStream;
                                video.onloadedmetadata = () => {
                                    video.play().catch(error => console.error("Error playing remote video:", error));
                                };
                            }
                        }} 
                        autoPlay 
                        playsInline 
                        muted={false} 
                        style={{ transform: 'scaleX(-1)', width: '100%', height: '100%' }} 
                    />
                </>
                )
            }

            </div>

            </div>
            </div>
            
            
        </div>
    );
};

export default RoomPage;
