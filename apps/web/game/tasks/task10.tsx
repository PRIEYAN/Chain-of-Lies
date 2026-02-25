import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { socket } from "@/shared/socket";
import { useGameStore } from "@/stores/useGameStore";

// ─── Types ────────────────────────────────────────────────────────────────────

type Difficulty = "easy" | "medium" | "hard";
type GameState = "idle" | "mining" | "valid" | "confirmed" | "failed" | "success";

interface TaskStats {
    nonce: number;
    hash: string;
    timeElapsed: number;
    attempts: number;
}

// ─── Simulated Hash Function ──────────────────────────────────────────────────
// Deterministic pseudo-hash that always produces the same output for the same input

function simpleHash(input: string): string {
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    
    for (let i = 0; i < input.length; i++) {
        const ch = input.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    
    // Generate 64-char hex string from multiple iterations
    let result = "";
    for (let i = 0; i < 8; i++) {
        const seed = h1 + h2 * (i + 1);
        const val = Math.abs(seed) >>> 0;
        result += val.toString(16).padStart(8, "0");
    }
    
    return result.slice(0, 64);
}

function generateHash(nonce: number, blockData: string): string {
    return simpleHash(`${blockData}|NONCE:${nonce}`);
}

// Pre-calculate valid nonces for each difficulty
function findValidNonces(blockData: string, difficulty: Difficulty): number[] {
    const target = difficulty === "easy" ? "0" : difficulty === "medium" ? "00" : "000";
    const valid: number[] = [];
    
    for (let n = 0; n <= 9999; n++) {
        const hash = generateHash(n, blockData);
        if (hash.startsWith(target)) {
            valid.push(n);
        }
    }
    return valid;
}

// ─── Custom Hook ──────────────────────────────────────────────────────────────

function useNonceFinder(
    blockData: string,
    difficulty: Difficulty,
    timeLimit: number,
    onComplete: (success: boolean, stats: TaskStats) => void
) {
    const [gameState, setGameState] = useState<GameState>("idle");
    const [nonce, setNonce] = useState(0);
    const [hash, setHash] = useState(() => generateHash(0, blockData));
    const [timeLeft, setTimeLeft] = useState(timeLimit);
    const [attempts, setAttempts] = useState(0);
    const [hashRate, setHashRate] = useState(0);
    const [validWindowTimer, setValidWindowTimer] = useState(3);
    
    const startTimeRef = useRef<number | null>(null);
    const lastNonceRef = useRef(0);
    const lastTimeRef = useRef(Date.now());
    const validWindowRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    
    const targetZeros = difficulty === "easy" ? 1 : difficulty === "medium" ? 2 : 3;
    const targetPrefix = "0".repeat(targetZeros);
    
    const validNonces = useMemo(() => findValidNonces(blockData, difficulty), [blockData, difficulty]);
    
    const isValidHash = useCallback((h: string) => h.startsWith(targetPrefix), [targetPrefix]);
    
    const getCloseness = useCallback((h: string): number => {
        // Return 0-100 based on how close the hash is to having leading zeros
        let score = 0;
        for (let i = 0; i < targetZeros + 2; i++) {
            const char = h[i];
            if (char === "0") {
                score += 20;
            } else if (char === "1" || char === "2") {
                score += 10;
            } else if (parseInt(char, 16) < 8) {
                score += 5;
            }
        }
        return Math.min(100, score);
    }, [targetZeros]);

    // Update hash when nonce changes
    useEffect(() => {
        const newHash = generateHash(nonce, blockData);
        setHash(newHash);
        
        // Calculate hash rate
        const now = Date.now();
        const delta = now - lastTimeRef.current;
        if (delta > 0) {
            const nonceChange = Math.abs(nonce - lastNonceRef.current);
            const rate = (nonceChange / delta) * 1000;
            setHashRate(Math.round(rate * 0.1)); // Scale for display
        }
        lastNonceRef.current = nonce;
        lastTimeRef.current = now;
        
        // Check if valid
        if (gameState === "mining" && isValidHash(newHash)) {
            setGameState("valid");
            setValidWindowTimer(3);
            
            // Start 3-second window
            if (validWindowRef.current) clearInterval(validWindowRef.current);
            validWindowRef.current = setInterval(() => {
                setValidWindowTimer(prev => {
                    if (prev <= 1) {
                        if (validWindowRef.current) clearInterval(validWindowRef.current);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } else if (gameState === "valid" && !isValidHash(newHash)) {
            setGameState("mining");
            if (validWindowRef.current) clearInterval(validWindowRef.current);
        }
    }, [nonce, blockData, gameState, isValidHash]);
    
    // Main countdown timer
    useEffect(() => {
        if (gameState === "idle" || gameState === "success" || gameState === "failed" || gameState === "confirmed") {
            return;
        }
        
        timerRef.current = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    if (timerRef.current) clearInterval(timerRef.current);
                    setGameState("failed");
                    onComplete(false, {
                        nonce,
                        hash,
                        timeElapsed: timeLimit,
                        attempts
                    });
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [gameState, timeLimit, onComplete, nonce, hash, attempts]);
    
    const startMining = useCallback(() => {
        if (gameState === "idle") {
            setGameState("mining");
            startTimeRef.current = Date.now();
        }
    }, [gameState]);
    
    const handleNonceChange = useCallback((newNonce: number) => {
        if (gameState === "idle") {
            startMining();
        }
        setNonce(newNonce);
        setAttempts(prev => prev + 1);
    }, [gameState, startMining]);
    
    const confirmHash = useCallback(() => {
        if (gameState === "valid" && isValidHash(hash)) {
            if (validWindowRef.current) clearInterval(validWindowRef.current);
            if (timerRef.current) clearInterval(timerRef.current);
            
            setGameState("success");
            const elapsed = startTimeRef.current ? (Date.now() - startTimeRef.current) / 1000 : 0;
            
            setTimeout(() => {
                setGameState("confirmed");
                onComplete(true, {
                    nonce,
                    hash,
                    timeElapsed: elapsed,
                    attempts
                });
            }, 1500);
        }
    }, [gameState, hash, isValidHash, onComplete, nonce, attempts]);
    
    const reset = useCallback(() => {
        setGameState("idle");
        setNonce(0);
        setHash(generateHash(0, blockData));
        setTimeLeft(timeLimit);
        setAttempts(0);
        setHashRate(0);
        setValidWindowTimer(3);
        startTimeRef.current = null;
        if (validWindowRef.current) clearInterval(validWindowRef.current);
        if (timerRef.current) clearInterval(timerRef.current);
    }, [blockData, timeLimit]);
    
    return {
        gameState,
        nonce,
        hash,
        timeLeft,
        attempts,
        hashRate,
        validWindowTimer,
        targetPrefix,
        validNonces,
        closeness: getCloseness(hash),
        isValid: isValidHash(hash),
        handleNonceChange,
        confirmHash,
        startMining,
        reset
    };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function NonceFinderPopup({
    isOpen,
    onClose,
}: {
    isOpen: boolean;
    onClose: () => void;
}) {
    const TASK_ID = "task10";
    const { completedTasks, localPlayerId, markTaskCompleted } = useGameStore();
    
    const [showTooltip, setShowTooltip] = useState(false);
    const [flickerChars, setFlickerChars] = useState<boolean[]>(new Array(64).fill(false));
    const sliderRef = useRef<HTMLInputElement>(null);
    
    const blockData = "BLOCK#4829|TX:0xAB3F";
    const difficulty: Difficulty = "medium";
    const timeLimit = 30;
    
    const handleComplete = useCallback((success: boolean, stats: TaskStats) => {
        if (success) {
            try {
                if (!completedTasks || !completedTasks[TASK_ID]) {
                    markTaskCompleted(TASK_ID);
                    const pts = Math.min(20, Math.max(8, Math.round(30 - stats.timeElapsed)));
                    socket.emit("task_completed", { taskId: TASK_ID, playerSocketId: localPlayerId, points: pts });
                }
            } catch (e) {
                console.warn("task emit failed", e);
            }
        }
    }, [completedTasks, localPlayerId, markTaskCompleted]);
    
    const {
        gameState,
        nonce,
        hash,
        timeLeft,
        hashRate,
        validWindowTimer,
        targetPrefix,
        closeness,
        isValid,
        handleNonceChange,
        confirmHash,
        reset
    } = useNonceFinder(blockData, difficulty, timeLimit, handleComplete);
    
    // Flicker effect when hash changes
    useEffect(() => {
        const newFlicker = new Array(64).fill(false);
        const count = Math.min(12, Math.abs(hashRate) + 3);
        for (let i = 0; i < count; i++) {
            newFlicker[Math.floor(Math.random() * 64)] = true;
        }
        setFlickerChars(newFlicker);
        
        const timeout = setTimeout(() => {
            setFlickerChars(new Array(64).fill(false));
        }, 100);
        
        return () => clearTimeout(timeout);
    }, [hash, hashRate]);
    
    // Keyboard controls
    useEffect(() => {
        if (!isOpen) return;
        
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
                e.preventDefault();
                handleNonceChange(Math.max(0, nonce - (e.shiftKey ? 100 : 1)));
            } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
                e.preventDefault();
                handleNonceChange(Math.min(9999, nonce + (e.shiftKey ? 100 : 1)));
            } else if (e.key === "Enter" && isValid) {
                e.preventDefault();
                confirmHash();
            }
        };
        
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, nonce, handleNonceChange, isValid, confirmHash]);
    
    // Reset when re-opening
    useEffect(() => {
        if (isOpen) {
            reset();
        }
    }, [isOpen, reset]);
    
    if (!isOpen) return null;
    
    const timerColor = timeLeft <= 10 ? "#ff3b3b" : timeLeft <= 20 ? "#ffb800" : "#00ff9d";
    const zoneColor = closeness >= 80 ? "#00ff9d" : closeness >= 50 ? "#ffb800" : "#ff3b3b";
    
    return (
        <div style={styles.overlay}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap');
                
                @keyframes scanline {
                    0% { background-position: 0 0; }
                    100% { background-position: 0 100%; }
                }
                
                @keyframes pulse {
                    0%, 100% { box-shadow: 0 0 20px rgba(0, 255, 157, 0.2); }
                    50% { box-shadow: 0 0 40px rgba(0, 255, 157, 0.4); }
                }
                
                @keyframes flicker {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.3; }
                }
                
                @keyframes confirmGlow {
                    0%, 100% { box-shadow: 0 0 10px #00ff9d, 0 0 20px #00ff9d; }
                    50% { box-shadow: 0 0 20px #00ff9d, 0 0 40px #00ff9d, 0 0 60px #00ff9d; }
                }
                
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    20% { transform: translateX(-4px); }
                    40% { transform: translateX(4px); }
                    60% { transform: translateX(-4px); }
                    80% { transform: translateX(4px); }
                }
                
                @keyframes successFlash {
                    0% { background: rgba(0, 255, 157, 0.3); }
                    100% { background: transparent; }
                }
                
                @keyframes particleBurst {
                    0% { transform: scale(0); opacity: 1; }
                    100% { transform: scale(3); opacity: 0; }
                }
                
                .scanline-bg {
                    background: 
                        repeating-linear-gradient(
                            0deg,
                            transparent,
                            transparent 2px,
                            rgba(0, 255, 157, 0.02) 2px,
                            rgba(0, 255, 157, 0.02) 4px
                        );
                    animation: scanline 8s linear infinite;
                }
                
                .flicker-char {
                    animation: flicker 0.1s ease-in-out;
                }
                
                .nonce-slider {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 100%;
                    height: 24px;
                    background: linear-gradient(90deg, #1a1a1a, #2a2a2a);
                    border-radius: 12px;
                    border: 2px solid #333;
                    outline: none;
                    cursor: pointer;
                }
                
                .nonce-slider::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 40px;
                    height: 40px;
                    background: linear-gradient(135deg, #00ff9d, #00aa6d);
                    border-radius: 8px;
                    cursor: grab;
                    border: 3px solid #00ff9d;
                    box-shadow: 0 0 15px rgba(0, 255, 157, 0.5);
                    transition: transform 0.1s ease;
                }
                
                .nonce-slider::-webkit-slider-thumb:hover {
                    transform: scale(1.1);
                }
                
                .nonce-slider::-webkit-slider-thumb:active {
                    cursor: grabbing;
                    transform: scale(0.95);
                }
                
                .nonce-slider::-moz-range-thumb {
                    width: 40px;
                    height: 40px;
                    background: linear-gradient(135deg, #00ff9d, #00aa6d);
                    border-radius: 8px;
                    cursor: grab;
                    border: 3px solid #00ff9d;
                    box-shadow: 0 0 15px rgba(0, 255, 157, 0.5);
                }
                
                .confirm-btn {
                    animation: confirmGlow 1s ease-in-out infinite;
                }
                
                .modal-shake {
                    animation: shake 0.5s ease-in-out;
                }
                
                .success-flash {
                    animation: successFlash 0.5s ease-out;
                }
            `}</style>
            
            <div 
                style={{
                    ...styles.modal,
                    animation: gameState === "failed" ? "shake 0.5s ease-in-out" : 
                               gameState === "success" ? "pulse 0.5s ease-in-out" : "pulse 3s ease-in-out infinite"
                }}
                className={`scanline-bg ${gameState === "success" ? "success-flash" : ""}`}
            >
                <button style={styles.closeBtn} onClick={onClose}>✕</button>
                
                {/* Success particle burst */}
                {gameState === "success" && (
                    <div style={styles.particleContainer}>
                        {[...Array(8)].map((_, i) => (
                            <div 
                                key={i} 
                                style={{
                                    ...styles.particle,
                                    left: `${50 + Math.cos(i * 0.785) * 30}%`,
                                    top: `${50 + Math.sin(i * 0.785) * 30}%`,
                                    animationDelay: `${i * 0.05}s`
                                }}
                            />
                        ))}
                    </div>
                )}
                
                {/* Header */}
                <div style={styles.header}>
                    <div style={styles.titleSection}>
                        <div style={styles.titleTag}>[ PROOF OF WORK ]</div>
                        <h1 style={styles.title}>NONCE FINDER</h1>
                    </div>
                    <div style={{ ...styles.timer, color: timerColor, textShadow: `0 0 10px ${timerColor}` }}>
                        <span style={styles.timerLabel}>TIME</span>
                        <span style={styles.timerValue}>{timeLeft}s</span>
                    </div>
                </div>
                
                {/* Block Info Panel */}
                <div style={styles.infoPanel}>
                    <div style={styles.infoRow}>
                        <span style={styles.infoLabel}>BLOCK DATA:</span>
                        <span style={styles.infoValue}>{blockData}</span>
                    </div>
                    <div style={styles.infoRow}>
                        <span style={styles.infoLabel}>CURRENT NONCE:</span>
                        <span style={{ ...styles.infoValue, color: "#00ff9d" }}>{nonce.toString().padStart(4, "0")}</span>
                    </div>
                    <div style={styles.infoRow}>
                        <span style={styles.infoLabel}>TARGET:</span>
                        <span style={{ ...styles.infoValue, color: "#ffb800" }}>Hash starts with "{targetPrefix}"</span>
                    </div>
                </div>
                
                {/* Hash Display */}
                <div style={styles.hashContainer}>
                    <div style={styles.hashLabel}>COMPUTED HASH</div>
                    <div style={styles.hashDisplay}>
                        {hash.split("").map((char, i) => {
                            const isLeadingZero = i < targetPrefix.length && hash.startsWith(targetPrefix.slice(0, i + 1));
                            const isFlickering = flickerChars[i];
                            return (
                                <span
                                    key={i}
                                    className={isFlickering ? "flicker-char" : ""}
                                    style={{
                                        color: isLeadingZero ? "#00ff9d" : "#555",
                                        textShadow: isLeadingZero ? "0 0 10px #00ff9d" : "none",
                                        fontWeight: isLeadingZero ? 700 : 400,
                                    }}
                                >
                                    {char}
                                </span>
                            );
                        })}
                    </div>
                </div>
                
                {/* Difficulty Meter */}
                <div style={styles.meterContainer}>
                    <div style={styles.meterLabel}>HASH PROXIMITY</div>
                    <div style={styles.meter}>
                        <div style={styles.meterZones}>
                            <div style={{ ...styles.zone, background: "#ff3b3b", flex: 2 }} />
                            <div style={{ ...styles.zone, background: "#ffb800", flex: 1 }} />
                            <div style={{ ...styles.zone, background: "#00ff9d", flex: 1 }} />
                            <div style={{ ...styles.zone, background: "#ffb800", flex: 1 }} />
                            <div style={{ ...styles.zone, background: "#ff3b3b", flex: 2 }} />
                        </div>
                        <div 
                            style={{
                                ...styles.meterPointer,
                                left: `${closeness}%`,
                                background: zoneColor,
                                boxShadow: `0 0 10px ${zoneColor}`
                            }}
                        />
                    </div>
                </div>
                
                {/* Nonce Slider */}
                <div style={styles.sliderContainer}>
                    <div style={styles.sliderLabels}>
                        <span>0</span>
                        <span style={styles.sliderInstructions}>
                            {gameState === "idle" ? "← DRAG TO MINE →" : "MINING..."}
                        </span>
                        <span>9999</span>
                    </div>
                    <input
                        ref={sliderRef}
                        type="range"
                        min={0}
                        max={9999}
                        value={nonce}
                        onChange={(e) => handleNonceChange(parseInt(e.target.value))}
                        className="nonce-slider"
                        disabled={gameState === "success" || gameState === "failed" || gameState === "confirmed"}
                    />
                </div>
                
                {/* Hash Rate Counter */}
                <div style={styles.hashRateContainer}>
                    <div style={styles.hashRateIcon}>⛏</div>
                    <div style={styles.hashRate}>
                        <span style={styles.hashRateValue}>{hashRate.toFixed(1)}</span>
                        <span style={styles.hashRateUnit}>MH/s</span>
                    </div>
                </div>
                
                {/* Confirm Button */}
                {gameState === "valid" && (
                    <button 
                        onClick={confirmHash}
                        className="confirm-btn"
                        style={styles.confirmBtn}
                    >
                        CONFIRM HASH ({validWindowTimer}s)
                    </button>
                )}
                
                {/* Status Messages */}
                {gameState === "success" && (
                    <div style={styles.successMessage}>
                        <div style={styles.successIcon}>✓</div>
                        <div>BLOCK MINED SUCCESSFULLY!</div>
                    </div>
                )}
                
                {gameState === "failed" && (
                    <div style={styles.failMessage}>
                        <div style={styles.failIcon}>✕</div>
                        <div>MINING FAILED - TIME EXPIRED</div>
                        <button onClick={reset} style={styles.retryBtn}>RETRY</button>
                    </div>
                )}
                
                {/* Educational Tooltip */}
                <div style={styles.tooltipToggle}>
                    <button 
                        onClick={() => setShowTooltip(!showTooltip)}
                        style={styles.tooltipBtn}
                    >
                        {showTooltip ? "▼ HIDE INFO" : "▶ WHAT IS THIS?"}
                    </button>
                    {showTooltip && (
                        <div style={styles.tooltip}>
                            <p style={styles.tooltipText}>
                                In real Bitcoin mining, miners adjust the nonce millions of times per second 
                                to find a hash below the target difficulty. This secures the entire network 
                                through <span style={{ color: "#00ff9d" }}>Proof of Work</span>.
                            </p>
                            <p style={styles.tooltipText}>
                                The more leading zeros required, the harder it is to find a valid hash!
                            </p>
                        </div>
                    )}
                </div>
                
                {/* Completed badge */}
                {completedTasks && completedTasks[TASK_ID] && (
                    <div style={styles.completedBadge}>✓ COMPLETED</div>
                )}
            </div>
        </div>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
    overlay: {
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        fontFamily: "'Share Tech Mono', 'Courier New', monospace",
    },
    modal: {
        background: "#0a0a0a",
        padding: "24px",
        borderRadius: "12px",
        width: "95%",
        maxWidth: "500px",
        maxHeight: "95vh",
        overflow: "auto",
        position: "relative",
        border: "2px solid #1a3a2a",
    },
    closeBtn: {
        position: "absolute",
        top: "15px",
        right: "15px",
        background: "rgba(0,0,0,0.5)",
        border: "1px solid #00ff9d44",
        color: "#00ff9d",
        borderRadius: "50%",
        width: "32px",
        height: "32px",
        cursor: "pointer",
        zIndex: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "18px",
    },
    header: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: "20px",
    },
    titleSection: {
        display: "flex",
        flexDirection: "column",
        gap: "4px",
    },
    titleTag: {
        fontSize: "10px",
        letterSpacing: "3px",
        color: "#00ff9d66",
    },
    title: {
        margin: 0,
        fontSize: "24px",
        fontWeight: 700,
        color: "#00ff9d",
        letterSpacing: "4px",
        textShadow: "0 0 20px rgba(0, 255, 157, 0.5)",
    },
    timer: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "8px 16px",
        background: "#111",
        borderRadius: "8px",
        border: "1px solid #333",
    },
    timerLabel: {
        fontSize: "10px",
        letterSpacing: "2px",
        color: "#666",
    },
    timerValue: {
        fontSize: "24px",
        fontWeight: 700,
    },
    infoPanel: {
        background: "#111",
        padding: "16px",
        borderRadius: "8px",
        border: "1px solid #222",
        marginBottom: "16px",
    },
    infoRow: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "8px",
    },
    infoLabel: {
        fontSize: "11px",
        color: "#666",
        letterSpacing: "1px",
    },
    infoValue: {
        fontSize: "13px",
        color: "#e0e0e0",
        letterSpacing: "1px",
    },
    hashContainer: {
        background: "#0d0d0d",
        padding: "16px",
        borderRadius: "8px",
        border: "1px solid #1a1a1a",
        marginBottom: "16px",
    },
    hashLabel: {
        fontSize: "10px",
        color: "#444",
        letterSpacing: "2px",
        marginBottom: "8px",
    },
    hashDisplay: {
        fontSize: "14px",
        fontFamily: "'Share Tech Mono', 'Courier New', monospace",
        letterSpacing: "1px",
        wordBreak: "break-all",
        lineHeight: 1.6,
    },
    meterContainer: {
        marginBottom: "16px",
    },
    meterLabel: {
        fontSize: "10px",
        color: "#444",
        letterSpacing: "2px",
        marginBottom: "8px",
    },
    meter: {
        position: "relative",
        height: "24px",
        borderRadius: "12px",
        overflow: "hidden",
        border: "1px solid #333",
    },
    meterZones: {
        display: "flex",
        height: "100%",
    },
    zone: {
        height: "100%",
    },
    meterPointer: {
        position: "absolute",
        top: "50%",
        transform: "translate(-50%, -50%)",
        width: "16px",
        height: "16px",
        borderRadius: "50%",
        border: "2px solid white",
        transition: "left 0.1s ease",
    },
    sliderContainer: {
        marginBottom: "16px",
    },
    sliderLabels: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontSize: "11px",
        color: "#666",
        marginBottom: "8px",
    },
    sliderInstructions: {
        color: "#00ff9d66",
        letterSpacing: "2px",
    },
    hashRateContainer: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        marginBottom: "16px",
        padding: "8px",
        background: "#111",
        borderRadius: "8px",
    },
    hashRateIcon: {
        fontSize: "20px",
    },
    hashRate: {
        display: "flex",
        alignItems: "baseline",
        gap: "4px",
    },
    hashRateValue: {
        fontSize: "24px",
        fontWeight: 700,
        color: "#ffb800",
        textShadow: "0 0 10px rgba(255, 184, 0, 0.5)",
    },
    hashRateUnit: {
        fontSize: "12px",
        color: "#666",
    },
    confirmBtn: {
        width: "100%",
        padding: "16px",
        fontSize: "16px",
        fontWeight: 700,
        letterSpacing: "3px",
        background: "linear-gradient(135deg, #00aa6d, #00ff9d)",
        border: "none",
        borderRadius: "8px",
        color: "#000",
        cursor: "pointer",
        fontFamily: "'Share Tech Mono', monospace",
        marginBottom: "16px",
    },
    successMessage: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "12px",
        padding: "24px",
        background: "rgba(0, 255, 157, 0.1)",
        border: "2px solid #00ff9d",
        borderRadius: "8px",
        color: "#00ff9d",
        fontSize: "16px",
        fontWeight: 700,
        letterSpacing: "2px",
        textAlign: "center",
    },
    successIcon: {
        fontSize: "48px",
        textShadow: "0 0 30px #00ff9d",
    },
    failMessage: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "12px",
        padding: "24px",
        background: "rgba(255, 59, 59, 0.1)",
        border: "2px solid #ff3b3b",
        borderRadius: "8px",
        color: "#ff3b3b",
        fontSize: "14px",
        fontWeight: 700,
        letterSpacing: "2px",
        textAlign: "center",
    },
    failIcon: {
        fontSize: "48px",
        textShadow: "0 0 30px #ff3b3b",
    },
    retryBtn: {
        padding: "12px 32px",
        fontSize: "14px",
        fontWeight: 700,
        letterSpacing: "2px",
        background: "transparent",
        border: "2px solid #ff3b3b",
        borderRadius: "8px",
        color: "#ff3b3b",
        cursor: "pointer",
        fontFamily: "'Share Tech Mono', monospace",
        marginTop: "8px",
    },
    tooltipToggle: {
        marginTop: "16px",
    },
    tooltipBtn: {
        background: "transparent",
        border: "none",
        color: "#444",
        fontSize: "11px",
        letterSpacing: "1px",
        cursor: "pointer",
        padding: "8px 0",
        fontFamily: "'Share Tech Mono', monospace",
    },
    tooltip: {
        marginTop: "12px",
        padding: "16px",
        background: "#111",
        borderRadius: "8px",
        border: "1px solid #222",
    },
    tooltipText: {
        fontSize: "12px",
        color: "#888",
        lineHeight: 1.6,
        margin: "0 0 12px 0",
    },
    completedBadge: {
        position: "absolute",
        top: "15px",
        left: "15px",
        padding: "4px 12px",
        background: "rgba(0, 255, 157, 0.2)",
        border: "1px solid #00ff9d",
        borderRadius: "4px",
        color: "#00ff9d",
        fontSize: "10px",
        letterSpacing: "1px",
    },
    particleContainer: {
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
    },
    particle: {
        position: "absolute",
        width: "20px",
        height: "20px",
        borderRadius: "50%",
        background: "#00ff9d",
        animation: "particleBurst 0.8s ease-out forwards",
    },
};
