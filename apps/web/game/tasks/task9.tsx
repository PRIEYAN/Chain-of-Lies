import { useState, useRef, useEffect, useCallback } from "react";
import { socket } from "@/shared/socket";
import { useGameStore } from "@/stores/useGameStore";

export default function ElevatorLeverPopup({
    isOpen,
    onClose,
}: {
    isOpen: boolean;
    onClose: () => void;
}) {
    const TASK_ID = "task9";
    const { completedTasks, localPlayerId, markTaskCompleted } = useGameStore();

    const [leverPos, setLeverPos] = useState(0); // 0 = top, 1 = bottom
    const [isDragging, setIsDragging] = useState(false);
    const [progress, setProgress] = useState(0); // 0 to 100
    const [isComplete, setIsComplete] = useState(false);

    const requestRef = useRef<number>();
    const leverRef = useRef<HTMLDivElement>(null);
    const dragStartY = useRef(0);
    const lastTime = useRef<number>();

    const holdTimeRequired = 4000; // 4 seconds to clear debris

    useEffect(() => {
        if (completedTasks && completedTasks[TASK_ID]) {
            setIsComplete(true);
            setProgress(100);
            setLeverPos(0);
        }
    }, [completedTasks]);

    const animate = useCallback((time: number) => {
        if (lastTime.current !== undefined) {
            const deltaTime = time - lastTime.current;

            if (leverPos === 1 && !isComplete) {
                setProgress(prev => {
                    const newProgress = Math.min(100, prev + (deltaTime / holdTimeRequired) * 100);
                    if (newProgress === 100 && !isComplete) {
                        handleComplete();
                    }
                    return newProgress;
                });
            } else if (!isComplete) {
                // If not at bottom, progress slowly decays? Or just stays?
                // User said: "If released too early, debris remains." 
                // Let's make it stay where it is for "burn away" effect, 
                // but the prompt implies it needs to be "continuously held to keep power active".
                // We'll keep the progress but stop the clearing.
            }
        }
        lastTime.current = time;
        requestRef.current = requestAnimationFrame(animate);
    }, [leverPos, isComplete]);

    useEffect(() => {
        if (isOpen) {
            requestRef.current = requestAnimationFrame(animate);
        } else {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
            lastTime.current = undefined;
        }
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [isOpen, animate]);

    const handleComplete = () => {
        setIsComplete(true);
        try {
            markTaskCompleted(TASK_ID);
            socket.emit("task_completed", { taskId: TASK_ID, playerSocketId: localPlayerId, points: 15 });
        } catch (e) {
            console.warn("task emit failed", e);
        }
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (isComplete) return;
        setIsDragging(true);
        dragStartY.current = e.clientY;
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging || isComplete) return;

        const leverHeight = 150; // pixels of travel
        const deltaY = e.clientY - dragStartY.current;
        const newPos = Math.max(0, Math.min(1, deltaY / leverHeight));
        setLeverPos(newPos);
    }, [isDragging, isComplete]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
        if (leverPos < 1) {
            setLeverPos(0); // Snaps back if not at bottom
        }
    }, [leverPos]);

    useEffect(() => {
        if (isDragging) {
            window.addEventListener("mousemove", handleMouseMove);
            window.addEventListener("mouseup", handleMouseUp);
        } else {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        }
        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };
    }, [isDragging, handleMouseMove, handleMouseUp]);

    if (!isOpen) return null;

    const shakeStyle = leverPos === 1 && !isComplete ? {
        animation: "shake 0.2s infinite"
    } : {};

    return (
        <div style={styles.overlay}>
            <style>
                {`
                    @keyframes shake {
                        0% { transform: translate(1px, 1px) rotate(0deg); }
                        20% { transform: translate(-1px, -2px) rotate(-1deg); }
                        40% { transform: translate(-3px, 0px) rotate(1deg); }
                        60% { transform: translate(3px, 2px) rotate(0deg); }
                        80% { transform: translate(1px, -1px) rotate(1deg); }
                        100% { transform: translate(-1px, 2px) rotate(-1deg); }
                    }
                `}
            </style>
            <div style={styles.modal}>
                <button style={styles.closeBtn} onClick={onClose}>✕</button>

                <div style={styles.container}>
                    {/* LEFT SIDE: ELEVATOR */}
                    <div style={styles.elevatorSection}>
                        <div style={styles.elevatorFrame}>
                            <div style={styles.elevatorDoor}>
                                <div style={styles.doorSeam}></div>
                                <div style={{
                                    ...styles.arrow,
                                    opacity: 0.2 + (leverPos * 0.8),
                                    boxShadow: leverPos === 1 ? "0 0 15px #00ffff" : "none"
                                }}>↑</div>
                            </div>

                            {/* DEBRIS */}
                            {!isComplete && (
                                <div style={{
                                    ...styles.debrisContainer,
                                    opacity: 1 - (progress / 100),
                                    ...shakeStyle
                                }}>
                                    {/* Leaves */}
                                    <div style={{ ...styles.debrisItem, top: '60%', left: '10%', color: '#d97706' }}>🍂</div>
                                    <div style={{ ...styles.debrisItem, top: '70%', left: '40%', color: '#f59e0b' }}>🍂</div>
                                    <div style={{ ...styles.debrisItem, top: '65%', left: '70%', color: '#b45309' }}>🍂</div>
                                    {/* Scraps */}
                                    <div style={{ ...styles.debrisItem, top: '50%', left: '30%', color: '#6b7280', fontSize: '24px' }}>⚙️</div>
                                    <div style={{ ...styles.debrisItem, top: '75%', left: '60%', color: '#4b5563', fontSize: '20px' }}>🔩</div>
                                    {/* Vines */}
                                    <div style={{ ...styles.debrisItem, top: '40%', left: '20%', color: '#166534', transform: 'rotate(45deg)' }}>🌿</div>
                                    <div style={{ ...styles.debrisItem, top: '55%', left: '80%', color: '#166534', transform: 'rotate(-30deg)' }}>🌿</div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT SIDE: CONTROL PANEL */}
                    <div style={styles.panelSection}>
                        <div style={styles.panelText}>
                            PULL<br />↓<br />HOLD
                        </div>

                        <div style={styles.leverContainer}>
                            <div style={styles.leverBase}></div>
                            <div
                                style={{
                                    ...styles.leverShaft,
                                    height: `${20 + (leverPos * 130)}px`
                                }}
                            ></div>
                            <div
                                ref={leverRef}
                                onMouseDown={handleMouseDown}
                                style={{
                                    ...styles.leverHandle,
                                    top: `${leverPos * 130}px`,
                                    cursor: isComplete ? 'default' : 'grab'
                                }}
                            >
                                <div style={styles.handleGrip}></div>
                            </div>
                        </div>

                        <div style={styles.statusLight}>
                            <div style={{
                                ...styles.lightIndicator,
                                backgroundColor: isComplete ? '#00ff9d' : (leverPos === 1 ? '#facc15' : '#374151')
                            }}></div>
                            <span style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px' }}>
                                {isComplete ? 'READY' : (leverPos === 1 ? 'POWERING' : 'OFF')}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    overlay: {
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        fontFamily: "'Courier New', Courier, monospace",
    },
    modal: {
        background: "#1a1a2e",
        padding: "30px",
        borderRadius: "8px",
        border: "4px solid #333",
        width: "90%",
        maxWidth: "500px",
        height: "400px",
        position: "relative",
        imageRendering: "pixelated",
        boxShadow: "0 0 20px rgba(0,0,0,0.5)",
    },
    closeBtn: {
        position: "absolute",
        top: "10px",
        right: "10px",
        background: "#c00",
        border: "2px solid #fff",
        color: "#fff",
        width: "24px",
        height: "24px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "12px",
        zIndex: 10,
    },
    container: {
        display: "flex",
        height: "100%",
        gap: "20px",
    },
    // ELEVATOR
    elevatorSection: {
        flex: 1,
        background: "#0f172a",
        border: "2px solid #475569",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
    },
    elevatorFrame: {
        width: "120px",
        height: "200px",
        border: "4px solid #1e293b",
        background: "#020617",
        position: "relative",
    },
    elevatorDoor: {
        width: "100%",
        height: "100%",
        background: "#475569", // metallic gray-blue
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
    },
    doorSeam: {
        position: "absolute",
        width: "2px",
        height: "100%",
        background: "#1e293b",
        left: "50%",
        marginLeft: "-1px",
    },
    arrow: {
        fontSize: "40px",
        color: "#00ffff",
        textShadow: "0 0 10px #00ffff",
        fontWeight: "bold",
        transition: "opacity 0.1s ease",
    },
    debrisContainer: {
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
    },
    debrisItem: {
        position: "absolute",
        fontSize: "16px",
    },
    // PANEL
    panelSection: {
        width: "150px",
        background: "#1e293b",
        border: "2px solid #475569",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "20px 0",
    },
    panelText: {
        fontSize: "12px",
        color: "#94a3b8",
        textAlign: "center",
        marginBottom: "20px",
        fontWeight: "bold",
        lineHeight: "1.2",
    },
    leverContainer: {
        width: "60px",
        height: "180px",
        background: "#0f172a",
        position: "relative",
        border: "2px solid #334155",
        borderRadius: "4px",
    },
    leverBase: {
        position: "absolute",
        bottom: "-10px",
        width: "80px",
        left: "-10px",
        height: "20px",
        background: "#475569",
        border: "2px solid #1e293b",
    },
    leverShaft: {
        position: "absolute",
        width: "8px",
        left: "50%",
        marginLeft: "-4px",
        top: "0",
        background: "#94a3b8",
        border: "1px solid #1e293b",
    },
    leverHandle: {
        position: "absolute",
        width: "40px",
        height: "30px",
        left: "50%",
        marginLeft: "-20px",
        transition: "top 0.1s ease-out",
        zIndex: 5,
    },
    handleGrip: {
        width: "100%",
        height: "100%",
        background: "#14b8a6", // teal tint
        border: "3px solid #0f172a",
        borderRadius: "4px",
        boxShadow: "inset 0 0 5px rgba(255,255,255,0.3)",
    },
    statusLight: {
        marginTop: "auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
    },
    lightIndicator: {
        width: "12px",
        height: "12px",
        borderRadius: "50%",
        border: "2px solid #0f172a",
        boxShadow: "0 0 5px rgba(0,0,0,0.5)",
    }
};
