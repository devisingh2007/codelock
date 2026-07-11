import { useEffect, useRef, useState } from 'react';
import { getSocket } from '../api/gameApi';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

export function useVoiceChat(roomCode, activePlayers, onSpeakerUpdate) {
  const [isMuted, setIsMuted] = useState(false);
  const [voiceConnected, setVoiceConnected] = useState(false);
  const [peerMicStates, setPeerMicStates] = useState({}); // socketId -> isMuted

  const localStreamRef = useRef(null);
  const peersRef = useRef({}); // socketId -> RTCPeerConnection
  const audioElementsRef = useRef({}); // socketId -> HTMLAudioElement
  const socketRef = useRef(null);
  const myHandlerSocketId = useRef(null);

  // Analyser nodes for Voice Activity Detection
  const analysersRef = useRef({}); // socketId/local -> AnalyserNode
  const vadIntervalRef = useRef(null);
  const speakingStatesRef = useRef({}); // player name -> boolean

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    socketRef.current = socket;

    const startLocalStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        localStreamRef.current = stream;
        setVoiceConnected(true);

        // Setup voice activity detection for local mic
        setupVAD('local', stream);

        // Fetch room state to see who is already connected
        // socketRef.current.emit("join-room", roomCode) should already have run in GamePage
      } catch (err) {
        console.error('Failed to get local microphone stream:', err);
        setVoiceConnected(false);
      }
    };

    startLocalStream();

    // Socket listeners for WebRTC signaling
    const handleUserJoined = ({ socketId, username }) => {
      if (!socketId || socketId === socket.id) return;
      console.log(`[WebRTC] User joined: ${username} (${socketId})`);
      initiateConnection(socketId, username);
    };

    const handleUserLeft = ({ socketId, username }) => {
      if (!socketId) return;
      console.log(`[WebRTC] User left: ${username} (${socketId})`);
      closeConnection(socketId);
    };

    const handleWebRTCSignal = async ({ senderSocketId, senderUsername, signal }) => {
      let pc = peersRef.current[senderSocketId];

      if (!pc) {
        pc = createPeerConnection(senderSocketId, senderUsername);
      }

      if (signal.sdp) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          if (signal.sdp.type === 'offer') {
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('webrtc-signal', {
              targetSocketId: senderSocketId,
              signal: { sdp: pc.localDescription }
            });
          }
        } catch (err) {
          console.error('[WebRTC] Error setting SDP:', err);
        }
      } else if (signal.candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } catch (err) {
          console.error('[WebRTC] Error adding ICE Candidate:', err);
        }
      }
    };

    const handleMuteState = ({ socketId, username, isMuted }) => {
      setPeerMicStates(prev => ({ ...prev, [socketId]: isMuted }));
    };

    socket.on('user-joined', handleUserJoined);
    socket.on('user-left', handleUserLeft);
    socket.on('webrtc-signal', handleWebRTCSignal);
    socket.on('webrtc-mute-state', handleMuteState);

    // Initial setup VAD loop
    startVADLoop();

    return () => {
      socket.off('user-joined', handleUserJoined);
      socket.off('user-left', handleUserLeft);
      socket.off('webrtc-signal', handleWebRTCSignal);
      socket.off('webrtc-mute-state', handleMuteState);

      // Clean up WebRTC peer connections
      Object.keys(peersRef.current).forEach(closeConnection);
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (vadIntervalRef.current) clearInterval(vadIntervalRef.current);
    };
  }, [roomCode]);

  // Voice Activity Detection (VAD) Speech Monitor
  const setupVAD = (id, stream) => {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContextClass();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      analysersRef.current[id] = analyser;
    } catch (err) {
      console.warn('Could not setup AudioContext for Voice Activity Detection:', err);
    }
  };

  const startVADLoop = () => {
    vadIntervalRef.current = setInterval(() => {
      const activeSpeakers = {};

      Object.entries(analysersRef.current).forEach(([id, analyser]) => {
        const array = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(array);
        let sum = 0;
        for (let i = 0; i < array.length; i++) {
          sum += array[i];
        }
        const average = sum / array.length;
        const isSpeaking = average > 20; // voice threshold

        // Map socketId/local back to player names
        if (id === 'local') {
          const myName = sessionStorage.getItem('username');
          if (myName) activeSpeakers[myName] = isSpeaking;
        } else {
          // Find player name corresponding to this peer connection
          const peerName = Object.keys(audioElementsRef.current).find(
            () => audioElementsRef.current[id]?.dataset?.username
          );
          const name = audioElementsRef.current[id]?.dataset?.username;
          if (name) activeSpeakers[name] = isSpeaking;
        }
      });

      // Notify callback only if speaker states changed
      let hasChanged = false;
      Object.entries(activeSpeakers).forEach(([name, isSpeaking]) => {
        if (speakingStatesRef.current[name] !== isSpeaking) {
          speakingStatesRef.current[name] = isSpeaking;
          hasChanged = true;
        }
      });

      if (hasChanged && onSpeakerUpdate) {
        onSpeakerUpdate({ ...speakingStatesRef.current });
      }
    }, 200);
  };

  const initiateConnection = (targetSocketId, username) => {
    console.log(`[WebRTC] Initiating peer connection to: ${username}`);
    const pc = createPeerConnection(targetSocketId, username);
    peersRef.current[targetSocketId] = pc;

    // Create SDP offer
    pc.createOffer()
      .then(offer => pc.setLocalDescription(offer))
      .then(() => {
        socketRef.current.emit('webrtc-signal', {
          targetSocketId,
          signal: { sdp: pc.localDescription }
        });
      })
      .catch(err => console.error('[WebRTC] Error creating offer:', err));
  };

  const createPeerConnection = (targetSocketId, username) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Add local tracks to peer connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    pc.onicecandidate = event => {
      if (event.candidate) {
        socketRef.current.emit('webrtc-signal', {
          targetSocketId,
          signal: { candidate: event.candidate }
        });
      }
    };

    pc.ontrack = event => {
      console.log(`[WebRTC] Received remote stream from ${username}`);
      const remoteStream = event.streams[0];

      // Play audio via HTMLAudioElement
      let audio = audioElementsRef.current[targetSocketId];
      if (!audio) {
        audio = document.createElement('audio');
        audio.autoplay = true;
        audio.dataset.username = username;
        document.body.appendChild(audio);
        audioElementsRef.current[targetSocketId] = audio;
      }
      audio.srcObject = remoteStream;

      // Setup VAD on remote stream
      setupVAD(targetSocketId, remoteStream);
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'closed') {
        closeConnection(targetSocketId);
      }
    };

    peersRef.current[targetSocketId] = pc;
    return pc;
  };

  const closeConnection = (targetSocketId) => {
    const pc = peersRef.current[targetSocketId];
    if (pc) {
      pc.close();
      delete peersRef.current[targetSocketId];
    }

    const audio = audioElementsRef.current[targetSocketId];
    if (audio) {
      audio.remove();
      delete audioElementsRef.current[targetSocketId];
    }

    delete analysersRef.current[targetSocketId];
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        const nextMute = !isMuted;
        audioTrack.enabled = !nextMute;
        setIsMuted(nextMute);

        // Notify other peers of mute state
        if (socketRef.current) {
          socketRef.current.emit('webrtc-mute-state', {
            roomCode,
            isMuted: nextMute
          });
        }
      }
    }
  };

  return {
    isMuted,
    voiceConnected,
    toggleMute,
    peerMicStates
  };
}
