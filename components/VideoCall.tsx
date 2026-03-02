'use client';

import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import Peer from 'simple-peer';
import { PhoneOff, Video, Mic, MicOff, VideoOff } from 'lucide-react';

export function VideoCall({ 
  targetUserId, 
  targetName, 
  onClose 
}: { 
  targetUserId?: string; 
  targetName?: string; 
  onClose: () => void;
}) {
  const { userId, incomingCall, callAccepted, callEnded, setCallAccepted, setCallEnded, setIncomingCall } = useAppStore();
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  
  const myVideo = useRef<HTMLVideoElement>(null);
  const userVideo = useRef<HTMLVideoElement>(null);
  const connectionRef = useRef<Peer.Instance | null>(null);

  const callUser = (idToCall: string, currentStream: MediaStream) => {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream: currentStream,
    });

    peer.on('signal', async (data) => {
      try {
        await fetch('/api/pusher/trigger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channel: `user-${idToCall}`,
            event: 'incomingCall',
            data: {
              from: userId,
              name: 'TeleIndo User', // Could pass real name
              signal: data
            }
          })
        });
      } catch (err) {
        console.error('Failed to trigger incomingCall:', err);
      }
    });

    peer.on('stream', (currentStream) => {
      if (userVideo.current) {
        userVideo.current.srcObject = currentStream;
      }
    });

    const handleCallAccepted = (e: any) => {
      const signal = e.detail;
      setCallAccepted(true);
      peer.signal(signal);
    };

    window.addEventListener('pusherCallAccepted', handleCallAccepted);

    connectionRef.current = peer;

    // Cleanup listener when component unmounts or call ends
    return () => {
      window.removeEventListener('pusherCallAccepted', handleCallAccepted);
    };
  };

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((currentStream) => {
      setStream(currentStream);
      if (myVideo.current) {
        myVideo.current.srcObject = currentStream;
      }
      
      if (targetUserId && !incomingCall) {
        // We are initiating the call
        callUser(targetUserId, currentStream);
      }
    }).catch(err => {
      console.error("Failed to get media devices", err);
      alert("Could not access camera/microphone.");
      onClose();
    });

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (connectionRef.current) {
        connectionRef.current.destroy();
      }
    };
  }, [targetUserId, incomingCall, onClose]);

  const answerCall = () => {
    if (!incomingCall || !stream) return;
    setCallAccepted(true);

    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream: stream,
    });

    peer.on('signal', async (data) => {
      try {
        await fetch('/api/pusher/trigger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channel: `user-${incomingCall.from}`,
            event: 'callAccepted',
            data: {
              signal: data
            }
          })
        });
      } catch (err) {
        console.error('Failed to trigger callAccepted:', err);
      }
    });

    peer.on('stream', (currentStream) => {
      if (userVideo.current) {
        userVideo.current.srcObject = currentStream;
      }
    });

    peer.signal(incomingCall.signal);
    connectionRef.current = peer;
  };

  const leaveCall = async () => {
    setCallEnded(true);
    if (connectionRef.current) {
      connectionRef.current.destroy();
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    
    const targetId = incomingCall ? incomingCall.from : targetUserId;
    if (targetId) {
      try {
        await fetch('/api/pusher/trigger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channel: `user-${targetId}`,
            event: 'callEnded',
            data: {}
          })
        });
      } catch (err) {
        console.error('Failed to trigger callEnded:', err);
      }
    }
    
    setIncomingCall(null);
    onClose();
  };

  const toggleMute = () => {
    if (stream) {
      stream.getAudioTracks()[0].enabled = isMuted;
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (stream) {
      stream.getVideoTracks()[0].enabled = isVideoOff;
      setIsVideoOff(!isVideoOff);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900 z-50 flex flex-col">
      {/* Header */}
      <div className="p-4 text-white flex justify-between items-center bg-black/20 absolute top-0 left-0 right-0 z-10">
        <div>
          <h2 className="text-lg font-medium">
            {incomingCall ? incomingCall.name : targetName || 'Video Call'}
          </h2>
          <p className="text-sm text-white/70">
            {callAccepted && !callEnded ? 'Connected' : incomingCall && !callAccepted ? 'Incoming call...' : 'Calling...'}
          </p>
        </div>
      </div>

      {/* Video Area */}
      <div className="flex-1 relative bg-black flex items-center justify-center">
        {/* Remote Video */}
        {callAccepted && !callEnded ? (
          <video 
            playsInline 
            ref={userVideo} 
            autoPlay 
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="text-white/50 flex flex-col items-center">
            <div className="w-24 h-24 rounded-full bg-slate-800 flex items-center justify-center mb-4">
              <Video className="w-10 h-10" />
            </div>
            <p>{incomingCall ? 'Incoming call...' : 'Waiting for answer...'}</p>
          </div>
        )}

        {/* Local Video (PiP) */}
        <div className="absolute bottom-24 right-6 w-32 h-48 bg-slate-800 rounded-xl overflow-hidden shadow-2xl border-2 border-white/10">
          <video 
            playsInline 
            muted 
            ref={myVideo} 
            autoPlay 
            className="w-full h-full object-cover"
          />
        </div>
      </div>

      {/* Controls */}
      <div className="h-24 bg-slate-900 flex items-center justify-center gap-6 pb-4">
        {incomingCall && !callAccepted ? (
          <>
            <button 
              onClick={leaveCall}
              className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center text-white hover:bg-red-600 transition-colors"
            >
              <PhoneOff className="w-6 h-6" />
            </button>
            <button 
              onClick={answerCall}
              className="w-14 h-14 rounded-full bg-green-500 flex items-center justify-center text-white hover:bg-green-600 transition-colors animate-pulse"
            >
              <Video className="w-6 h-6" />
            </button>
          </>
        ) : (
          <>
            <button 
              onClick={toggleMute}
              className={`w-12 h-12 rounded-full flex items-center justify-center text-white transition-colors ${isMuted ? 'bg-red-500/20 text-red-500' : 'bg-white/10 hover:bg-white/20'}`}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
            <button 
              onClick={leaveCall}
              className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center text-white hover:bg-red-600 transition-colors"
            >
              <PhoneOff className="w-6 h-6" />
            </button>
            <button 
              onClick={toggleVideo}
              className={`w-12 h-12 rounded-full flex items-center justify-center text-white transition-colors ${isVideoOff ? 'bg-red-500/20 text-red-500' : 'bg-white/10 hover:bg-white/20'}`}
            >
              {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
