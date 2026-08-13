import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { firestore } from "@/integrations/firebase/client";
import { collection, addDoc, onSnapshot, query, where, getDocs, deleteDoc } from "firebase/firestore";
import { waitForFirebaseUser } from "@/integrations/firebase/auth";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Video, VideoOff, PhoneOff, MonitorUp, Copy, Users } from "lucide-react";
import { toast } from "sonner";
import { getDocById } from "@/integrations/firebase/db";
import { COL } from "@/integrations/firebase/schema";

export const Route = createFileRoute("/meet/$roomId")({
  ssr: false,
  beforeLoad: async ({ params }) => {
    const user = await waitForFirebaseUser();
    if (!user) throw redirect({ to: "/auth", search: { as: "candidate" } });
    return { roomId: params.roomId };
  },
  component: MeetRoom,
});

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

function MeetRoom() {
  const { roomId } = Route.useParams();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const unsubSignalsRef = useRef<(() => void) | null>(null);
  const sendSignalRef = useRef<((event: string, payload: unknown) => Promise<void>) | null>(null);

  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [remoteSharing, setRemoteSharing] = useState(false);
  const [isCandidate, setIsCandidate] = useState(false);
  const [peerJoined, setPeerJoined] = useState(false);
  const [myUserId, setMyUserId] = useState<string>("");

  const [inLobby, setInLobby] = useState(true);
  const [lobbyMicOn, setLobbyMicOn] = useState(true);
  const [lobbyCamOn, setLobbyCamOn] = useState(true);
  const [lobbyStream, setLobbyStream] = useState<MediaStream | null>(null);
  const lobbyVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!inLobby) return;

    if (localStreamRef.current) {
      setLobbyStream(localStreamRef.current);
      if (lobbyVideoRef.current) {
        lobbyVideoRef.current.srcObject = localStreamRef.current;
      }
      return;
    }

    navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    }).then((s) => {
      localStreamRef.current = s;
      setLobbyStream(s);
      if (lobbyVideoRef.current) {
        lobbyVideoRef.current.srcObject = s;
      }
    }).catch((err) => {
      console.warn("Failed to get camera for lobby, falling back to audio only", err);
      navigator.mediaDevices.getUserMedia({ audio: true }).then((s) => {
        localStreamRef.current = s;
        setLobbyStream(s);
        if (lobbyVideoRef.current) {
          lobbyVideoRef.current.srcObject = s;
        }
      }).catch(e => console.error(e));
    });
  }, [inLobby]);

  useEffect(() => {
    if (lobbyStream) {
      lobbyStream.getVideoTracks().forEach(t => t.enabled = lobbyCamOn);
    }
  }, [lobbyCamOn, lobbyStream]);

  useEffect(() => {
    if (lobbyStream) {
      lobbyStream.getAudioTracks().forEach(t => t.enabled = lobbyMicOn);
    }
  }, [lobbyMicOn, lobbyStream]);

  useEffect(() => {
    if (inLobby) return;
    let cancelled = false;
    let cleanupFns: (() => void)[] = [];
    const signalsRef = collection(firestore, "meetings", roomId, "signals");
    const joinTime = new Date().toISOString();

    (async () => {
      const user = await waitForFirebaseUser();
      if (!user) return;
      const myId = user.uid;
      setMyUserId(myId);

      let isCand = false;
      try {
        const roleDoc = await getDocById<{ roles: string[] }>(COL.userRoles, myId);
        isCand = roleDoc?.roles?.includes("candidate") ?? false;
        setIsCandidate(isCand);
      } catch (err) {
        console.warn("Fetch roles failed", err);
      }

      // Clean up old signals from previous sessions in this room
      try {
        const snap = await getDocs(signalsRef);
        await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
      } catch (err) {
        console.warn("Signal cleanup failed", err);
      }

      // 1) Get local media (Reuse lobby stream if available)
      let stream = localStreamRef.current;
      if (!stream) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          localStreamRef.current = stream;
        } catch (e) {
          if (!isCand) {
            try {
              stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
              localStreamRef.current = stream;
              setCamOn(false);
            } catch (err) {
              toast.error("Microphone access required to join.");
              return;
            }
          } else {
            toast.error("Camera and microphone access are required for candidates.");
            return;
          }
        }
      }
      if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      // 2) Create RTCPeerConnection
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      pc.ontrack = (ev) => {
        if (remoteVideoRef.current && ev.streams[0]) {
          remoteVideoRef.current.srcObject = ev.streams[0];
          setPeerJoined(true);
        }
      };

      // 3) Firestore Signaling
      const send = async (event: string, payload: unknown) => {
        try {
          await addDoc(signalsRef, {
            from: myId,
            event,
            payload: JSON.stringify(payload),
            created_at: new Date().toISOString(),
          });
        } catch (err) {
          console.warn("Signal send failed", err);
        }
      };
      sendSignalRef.current = send;

      pc.onicecandidate = (ev) => {
        if (ev.candidate) send("ice", { candidate: ev.candidate });
      };

      // role: first-arriver waits (callee), second-arriver creates offer (caller)
      let isCaller = false;
      const iceCandidatesQueue: RTCIceCandidateInit[] = [];

      const unsub = onSnapshot(signalsRef, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === "added") {
            const data = change.doc.data();
            if (data.from === myId) return;
            const payload = JSON.parse(data.payload);
            const event = data.event;

            if (event === "join") {
              isCaller = true;
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              send("offer", { sdp: offer });
            } else if (event === "offer") {
              await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              send("answer", { sdp: answer });

              // Flush queued ICE candidates
              while (iceCandidatesQueue.length > 0) {
                const cand = iceCandidatesQueue.shift();
                if (cand) {
                  await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
                }
              }
            } else if (event === "answer") {
              if (!pc.currentRemoteDescription) {
                await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));

                // Flush queued ICE candidates
                while (iceCandidatesQueue.length > 0) {
                  const cand = iceCandidatesQueue.shift();
                  if (cand) {
                    await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
                  }
                }
              }
            } else if (event === "ice") {
              const candidateInit = payload.candidate;
              if (pc.remoteDescription) {
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(candidateInit));
                } catch (e) { /* ignore */ }
              } else {
                iceCandidatesQueue.push(candidateInit);
              }
            } else if (event === "share_state") {
              setRemoteSharing(payload.sharing);
            } else if (event === "bye") {
              setPeerJoined(false);
              if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
            }
          }
        });
      });
      unsubSignalsRef.current = unsub;

      // Announce my arrival; the existing peer will respond with an offer
      send("join", {});

      cleanupFns.push(() => {
        send("bye", {});
        unsub();
      });
    })();

    return () => {
      cancelled = true;
      cleanupFns.forEach((fn) => fn());
      pcRef.current?.close();
      pcRef.current = null;
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    };
  }, [roomId, inLobby]);


  function toggleMic() {
    const s = localStreamRef.current;
    if (!s) return;
    s.getAudioTracks().forEach((t) => (t.enabled = !t.enabled));
    setMicOn((v) => !v);
  }
  function toggleCam() {
    if (isCandidate && camOn) {
      toast.error("Candidates are required to keep their camera enabled during the interview.");
      return;
    }
    const s = localStreamRef.current;
    if (!s) return;
    s.getVideoTracks().forEach((t) => (t.enabled = !t.enabled));
    setCamOn((v) => !v);
  }
  async function shareScreen() {
    const pc = pcRef.current; if (!pc) return;
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = display.getVideoTracks()[0];
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");
      if (sender) await sender.replaceTrack(screenTrack);
      setSharing(true);
      sendSignalRef.current?.("share_state", { sharing: true });
      screenTrack.onended = async () => {
        const camTrack = localStreamRef.current?.getVideoTracks()[0];
        if (sender && camTrack) await sender.replaceTrack(camTrack);
        setSharing(false);
        sendSignalRef.current?.("share_state", { sharing: false });
      };
    } catch (e) {
      toast.error("Screen share cancelled.");
    }
  }
  function hangup() {
    pcRef.current?.close();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    unsubSignalsRef.current?.();
    window.location.href = "/portal";
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Meeting link copied");
  }

  if (inLobby) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col justify-center items-center p-6 animate-fade-in">
        <div className="max-w-4xl w-full grid md:grid-cols-2 gap-8 items-center bg-zinc-900/60 p-8 rounded-2xl border border-white/5 backdrop-blur-md">
          {/* Left Column: Camera Preview */}
          <div className="space-y-4">
            <div className="relative aspect-video rounded-xl bg-zinc-950 border border-white/10 overflow-hidden flex items-center justify-center shadow-2xl">
              <video
                ref={lobbyVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${lobbyCamOn ? "" : "opacity-0"}`}
              />
              {!lobbyCamOn && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-zinc-500 bg-zinc-950">
                  <VideoOff className="size-10" />
                  <span className="text-sm">Camera is turned off</span>
                </div>
              )}
              {/* Media Action buttons overlay */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/60 px-4 py-2 rounded-full backdrop-blur">
                <button
                  type="button"
                  onClick={() => setLobbyMicOn(!lobbyMicOn)}
                  className={`p-2 rounded-full transition duration-200 ${lobbyMicOn ? "bg-zinc-700 hover:bg-zinc-600 text-white" : "bg-red-500 hover:bg-red-600 text-white"}`}
                >
                  {lobbyMicOn ? <Mic className="size-4" /> : <MicOff className="size-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => setLobbyCamOn(!lobbyCamOn)}
                  className={`p-2 rounded-full transition duration-200 ${lobbyCamOn ? "bg-zinc-700 hover:bg-zinc-600 text-white" : "bg-red-500 hover:bg-red-600 text-white"}`}
                >
                  {lobbyCamOn ? <Video className="size-4" /> : <VideoOff className="size-4" />}
                </button>
              </div>
            </div>
            <p className="text-center text-xs text-zinc-500">
              Check your camera and microphone settings before joining the call.
            </p>
          </div>

          {/* Right Column: Title and Join Actions */}
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex flex-col select-none mb-4">
                <div className="font-extrabold italic text-3xl tracking-tighter leading-none text-primary font-sans uppercase">
                  TVSE
                </div>
                <div className="text-[8px] font-bold italic tracking-widest text-primary uppercase mt-1 leading-none">
                  TVS ELECTRONICS
                </div>
              </div>
              <h2 className="text-2xl font-bold tracking-tight">Ready to join?</h2>
              <p className="text-zinc-400 text-sm">
                Meeting Room ID: <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-xs text-zinc-200">{roomId.slice(0, 8)}</code>
              </p>
            </div>

            <Button
              size="lg"
              className="w-full text-base font-bold bg-primary hover:bg-primary/90 text-primary-foreground tracking-wide py-6 rounded-xl shadow-lg hover:shadow-primary/20 transition-all hover:scale-[1.01] active:scale-[0.98]"
              onClick={() => {
                setMicOn(lobbyMicOn);
                setCamOn(lobbyCamOn);
                setInLobby(false);
              }}
            >
              Join Interview
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <header className="px-6 py-3 border-b border-white/10 flex items-center justify-between">
        <Link to="/" className="flex flex-col select-none justify-center">
          <div className="font-extrabold italic text-lg tracking-tighter leading-none text-primary font-sans uppercase">
            TVSE
          </div>
          <div className="text-[5.5px] font-bold italic tracking-widest text-primary uppercase mt-0.5 leading-none">
            TVS ELECTRONICS
          </div>
        </Link>
        <div className="text-xs opacity-60 flex items-center gap-3">
          <span className="flex items-center gap-1"><Users className="size-3" /> {peerJoined ? "2" : "1"} in room</span>
          <span>Room: {roomId.slice(0, 8)}…</span>
          <button onClick={copyLink} className="hover:opacity-100 opacity-70 flex items-center gap-1"><Copy className="size-3" /> Copy link</button>
        </div>
      </header>

      {remoteSharing || sharing ? (
        <main className="flex-1 flex flex-col md:flex-row gap-2 p-2 bg-black overflow-hidden">
          {/* Main Large Presentation Area */}
          <div className="flex-1 relative rounded-xl overflow-hidden bg-zinc-900 border border-white/5 flex items-center justify-center">
            <video
              ref={remoteSharing ? remoteVideoRef : localVideoRef}
              autoPlay
              playsInline
              muted={sharing}
              className="w-full h-full object-contain"
            />
            <div className="absolute bottom-3 left-3 bg-black/60 px-2 py-1 rounded text-xs">
              {remoteSharing ? "Participant's Screen" : "Your Screen Presentation"}
            </div>
          </div>

          {/* Sidebar Area */}
          <div className="w-full md:w-64 flex flex-row md:flex-col gap-2 shrink-0">
            {/* Show other participant's camera if they are sharing */}
            {remoteSharing && (
              <div className="flex-1 md:h-48 relative rounded-xl overflow-hidden bg-zinc-900 border border-white/5 min-h-[150px]">
                <video ref={localVideoRef} autoPlay playsInline muted className={`absolute inset-0 w-full h-full object-cover ${camOn ? "" : "opacity-0"}`} />
                {!camOn && (
                  <div className="absolute inset-0 grid place-items-center text-white/40 text-xs">
                    Camera off
                  </div>
                )}
                <div className="absolute bottom-3 left-3 bg-black/60 px-2 py-1 rounded text-xs">You</div>
              </div>
            )}
            
            {/* Show remote camera stream if you are sharing */}
            {sharing && (
              <div className="flex-1 md:h-48 relative rounded-xl overflow-hidden bg-zinc-900 border border-white/5 min-h-[150px]">
                <video ref={remoteVideoRef} autoPlay playsInline className={`absolute inset-0 w-full h-full object-cover ${peerJoined ? "" : "opacity-0"}`} />
                {!peerJoined && (
                  <div className="absolute inset-0 grid place-items-center text-white/40 text-xs font-medium">
                    Waiting for participant...
                  </div>
                )}
                <div className="absolute bottom-3 left-3 bg-black/60 px-2 py-1 rounded text-xs">Participant</div>
              </div>
            )}
          </div>
        </main>
      ) : (
        <main className="flex-1 grid md:grid-cols-2 gap-2 p-2 bg-black">
          <Tile label="You" muted videoRef={localVideoRef} active={camOn} />
          <Tile label={peerJoined ? "Participant" : "Waiting for participant…"} videoRef={remoteVideoRef} active={peerJoined} placeholder={!peerJoined} />
        </main>
      )}

      <footer className="px-6 py-4 border-t border-white/10 flex items-center justify-center gap-3 bg-zinc-950">
        <ControlBtn active={micOn} onClick={toggleMic} on={<Mic className="size-5" />} off={<MicOff className="size-5" />} />
        <ControlBtn active={camOn} onClick={toggleCam} on={<Video className="size-5" />} off={<VideoOff className="size-5" />} />
        <ControlBtn active={!sharing} onClick={shareScreen} on={<MonitorUp className="size-5" />} off={<MonitorUp className="size-5" />} label={sharing ? "Sharing" : "Share"} />
        <Button onClick={hangup} variant="destructive" size="lg" className="rounded-full size-12 p-0"><PhoneOff className="size-5" /></Button>
      </footer>
    </div>
  );
}

function Tile({ label, videoRef, active, muted, placeholder }: {
  label: string; videoRef: React.RefObject<HTMLVideoElement | null>; active: boolean; muted?: boolean; placeholder?: boolean;
}) {
  return (
    <div className="relative rounded-xl overflow-hidden bg-zinc-900 border border-white/5 min-h-[40vh]">
      <video ref={videoRef} autoPlay playsInline muted={muted} className={`absolute inset-0 w-full h-full object-cover ${active ? "" : "opacity-0"}`} />
      {!active && (
        <div className="absolute inset-0 grid place-items-center text-white/40 text-sm">
          {placeholder ? label : "Camera off"}
        </div>
      )}
      <div className="absolute bottom-3 left-3 bg-black/60 px-2 py-1 rounded text-xs">{label}</div>
    </div>
  );
}

function ControlBtn({ active, onClick, on, off, label }: { active: boolean; onClick: () => void; on: React.ReactNode; off: React.ReactNode; label?: string }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full size-12 grid place-items-center transition ${active ? "bg-white/10 hover:bg-white/20" : "bg-rose-600 hover:bg-rose-500"}`}
      title={label}
    >
      {active ? on : off}
    </button>
  );
}
