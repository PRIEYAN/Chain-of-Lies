/**
 * Mempool Cleanup Task
 * 
 * A blockchain-themed mini-game where players validate legitimate transactions
 * while avoiding spam/fraudulent ones. Transactions float across the screen
 * in zero-gravity style. Validate 20 legitimate txs before the mempool overflows.
 * 
 * @component MempoolCleanupPopup
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { socket } from "@/shared/socket";
import { useGameStore } from "@/stores/useGameStore";

// ─── Constants ────────────────────────────────────────────────────────────────

const GAME_WIDTH = 480;
const GAME_HEIGHT = 400;
const MIN_BUBBLE_SIZE = 48;
const MAX_BUBBLE_SIZE = 80;
const BASE_SPEED = 0.8;
const MAX_SPEED_BONUS = 1.5;
const BASE_SPAWN_INTERVAL = 1200; // ms
const SABOTAGED_SPAWN_INTERVAL = 700; // ms
const MAX_TRANSACTIONS = 15;
const SPAM_CHANCE = 0.30;
const SABOTAGED_SPAM_CHANCE = 0.40;
const TARGET_VALIDATIONS = 20;
const TIME_LIMIT = 60;
const INITIAL_REPUTATION = 100;
const SPAM_PENALTY = 10;
const MEMPOOL_ESCAPE_PENALTY = 5;
const UI_UPDATE_INTERVAL = 100; // ms

// ─── Types ────────────────────────────────────────────────────────────────────

type TxType = "transfer" | "contract" | "nft";
type GameState = "idle" | "playing" | "success" | "failed";

interface Transaction {
    id: string;
    type: TxType;
    amount: number;
    gasFee: number;
    isSpam: boolean;
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    spawnedAt: number;
    tokenName: string;
}

interface TaskStats {
    validated: number;
    falsePositives: number;
    timeElapsed: number;
    reputationFinal: number;
}

interface FloatingText {
    id: string;
    text: string;
    x: number;
    y: number;
    color: string;
    createdAt: number;
}

// ─── Utility Functions ────────────────────────────────────────────────────────

function randomId(): string {
    return Math.random().toString(36).slice(2, 10);
}

function randomRange(min: number, max: number): number {
    return Math.random() * (max - min) + min;
}

function randomChoice<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

// Spam tokens have misspellings
const LEGIT_TOKENS = ["ETH", "USDT", "USDC", "DAI", "WETH", "LINK"];
const SPAM_TOKENS = ["3TH", "USOT", "USOC", "DA1", "W3TH", "L1NK", "FR33", "SC4M"];

function createTransaction(isSpam: boolean, isSabotaged: boolean): Transaction {
    const type: TxType = randomChoice(["transfer", "contract", "nft"]);
    const gasFee = isSpam ? 1 : Math.floor(randomRange(10, 200));
    const speed = BASE_SPEED + (gasFee / 200) * MAX_SPEED_BONUS;
    const sabotagedMultiplier = isSabotaged && !isSpam ? 1.4 : 1;
    
    // Random direction
    const angle = Math.random() * Math.PI * 2;
    const vx = Math.cos(angle) * speed * sabotagedMultiplier;
    const vy = Math.sin(angle) * speed * sabotagedMultiplier;
    
    // Spam has suspicious amounts (round numbers)
    const amount = isSpam 
        ? randomChoice([1000, 10000, 100000, 999999])
        : parseFloat(randomRange(0.01, 50).toFixed(3));
    
    const size = Math.min(MAX_BUBBLE_SIZE, MIN_BUBBLE_SIZE + (amount / 50) * 20);
    
    // Spawn from edges
    const edge = Math.floor(Math.random() * 4);
    let x: number, y: number;
    switch (edge) {
        case 0: x = randomRange(size, GAME_WIDTH - size); y = -size; break; // top
        case 1: x = GAME_WIDTH + size; y = randomRange(size, GAME_HEIGHT - size); break; // right
        case 2: x = randomRange(size, GAME_WIDTH - size); y = GAME_HEIGHT + size; break; // bottom
        default: x = -size; y = randomRange(size, GAME_HEIGHT - size); break; // left
    }
    
    return {
        id: randomId(),
        type,
        amount,
        gasFee,
        isSpam,
        x,
        y,
        vx,
        vy,
        size,
        spawnedAt: Date.now(),
        tokenName: isSpam ? randomChoice(SPAM_TOKENS) : randomChoice(LEGIT_TOKENS),
    };
}

// ─── Custom Hooks ─────────────────────────────────────────────────────────────

function useReputation(initial: number) {
    const [reputation, setReputation] = useState(initial);
    
    const decrease = useCallback((amount: number) => {
        setReputation(prev => Math.max(0, prev - amount));
    }, []);
    
    const reset = useCallback(() => {
        setReputation(initial);
    }, [initial]);
    
    return { reputation, decrease, reset };
}

function useMempoolCapacity() {
    const [capacity, setCapacity] = useState(0);
    
    const increase = useCallback((amount: number) => {
        setCapacity(prev => Math.min(100, prev + amount));
    }, []);
    
    const reset = useCallback(() => {
        setCapacity(0);
    }, []);
    
    return { capacity, increase, reset, isFull: capacity >= 100 };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MempoolCleanupPopup({
    isOpen,
    onClose,
}: {
    isOpen: boolean;
    onClose: () => void;
}) {
    const TASK_ID = "task11";
    const { completedTasks, localPlayerId, markTaskCompleted } = useGameStore();
    
    const [gameState, setGameState] = useState<GameState>("idle");
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [validated, setValidated] = useState(0);
    const [falsePositives, setFalsePositives] = useState(0);
    const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);
    const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);
    const [showTooltip, setShowTooltip] = useState(true);
    const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
    
    const { reputation, decrease: decreaseRep, reset: resetRep } = useReputation(INITIAL_REPUTATION);
    const { capacity, increase: increaseCapacity, reset: resetCapacity, isFull } = useMempoolCapacity();
    
    const isSabotaged = false; // Could be passed as prop
    
    // Game loop refs
    const gameLoopRef = useRef<number>(0);
    const lastSpawnRef = useRef<number>(0);
    const transactionsRef = useRef<Transaction[]>([]);
    const startTimeRef = useRef<number>(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const uiUpdateRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const isRunningRef = useRef<boolean>(false);
    
    // Sync ref with state for game loop access
    useEffect(() => {
        transactionsRef.current = transactions;
    }, [transactions]);
    
    // Add floating text helper
    const addFloatingText = useCallback((text: string, x: number, y: number, color: string) => {
        const id = randomId();
        setFloatingTexts(prev => [...prev, { id, text, x, y, color, createdAt: Date.now() }]);
        setTimeout(() => {
            setFloatingTexts(prev => prev.filter(t => t.id !== id));
        }, 1000);
    }, []);
    
    // Handle transaction click
    const handleTxClick = useCallback((tx: Transaction) => {
        if (gameState !== "playing") return;
        
        if (tx.isSpam) {
            // False positive - clicked spam
            decreaseRep(SPAM_PENALTY);
            setFalsePositives(prev => prev + 1);
            addFloatingText(`-${SPAM_PENALTY} REP`, tx.x, tx.y, "#ff2244");
        } else {
            // Valid transaction
            setValidated(prev => prev + 1);
            addFloatingText("+1 VALIDATED", tx.x, tx.y, "#00c8ff");
        }
        
        // Remove transaction
        setTransactions(prev => prev.filter(t => t.id !== tx.id));
    }, [gameState, decreaseRep, addFloatingText]);
    
    // Game loop
    const gameLoop = useCallback(() => {
        if (!isRunningRef.current) return;
        
        const now = Date.now();
        const spawnInterval = isSabotaged ? SABOTAGED_SPAWN_INTERVAL : BASE_SPAWN_INTERVAL;
        const spamChance = isSabotaged ? SABOTAGED_SPAM_CHANCE : SPAM_CHANCE;
        
        // Spawn new transactions
        if (now - lastSpawnRef.current > spawnInterval && transactionsRef.current.length < MAX_TRANSACTIONS) {
            const isSpam = Math.random() < spamChance;
            const newTx = createTransaction(isSpam, isSabotaged);
            transactionsRef.current = [...transactionsRef.current, newTx];
            lastSpawnRef.current = now;
        }
        
        // Update positions
        const updatedTxs: Transaction[] = [];
        let escapedCount = 0;
        
        for (const tx of transactionsRef.current) {
            let { x, y, vx, vy } = tx;
            
            x += vx;
            y += vy;
            
            // Bounce off edges or remove if escaped
            const padding = tx.size / 2;
            let escaped = false;
            
            if (x < -padding * 2 || x > GAME_WIDTH + padding * 2 || 
                y < -padding * 2 || y > GAME_HEIGHT + padding * 2) {
                // Transaction escaped the mempool
                if (!tx.isSpam) {
                    escapedCount++;
                }
                escaped = true;
            } else {
                // Bounce off edges
                if (x < padding || x > GAME_WIDTH - padding) {
                    vx = -vx;
                    x = Math.max(padding, Math.min(GAME_WIDTH - padding, x));
                }
                if (y < padding || y > GAME_HEIGHT - padding) {
                    vy = -vy;
                    y = Math.max(padding, Math.min(GAME_HEIGHT - padding, y));
                }
            }
            
            if (!escaped) {
                updatedTxs.push({ ...tx, x, y, vx, vy });
            }
        }
        
        if (escapedCount > 0) {
            increaseCapacity(escapedCount * MEMPOOL_ESCAPE_PENALTY);
        }
        
        transactionsRef.current = updatedTxs;
        gameLoopRef.current = requestAnimationFrame(gameLoop);
    }, [isSabotaged, increaseCapacity]);
    
    // Start game
    const startGame = useCallback(() => {
        setGameState("playing");
        setTransactions([]);
        setValidated(0);
        setFalsePositives(0);
        setTimeLeft(TIME_LIMIT);
        setFloatingTexts([]);
        resetRep();
        resetCapacity();
        transactionsRef.current = [];
        lastSpawnRef.current = Date.now();
        startTimeRef.current = Date.now();
        setShowTooltip(false);
        isRunningRef.current = true;
        
        // Start game loop
        gameLoopRef.current = requestAnimationFrame(gameLoop);
        
        // Start timer
        timerRef.current = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) return 0;
                return prev - 1;
            });
        }, 1000);
        
        // Start UI sync
        uiUpdateRef.current = setInterval(() => {
            setTransactions([...transactionsRef.current]);
        }, UI_UPDATE_INTERVAL);
    }, [gameLoop, resetRep, resetCapacity]);
    
    // Handle completion
    const handleComplete = useCallback((success: boolean) => {
        isRunningRef.current = false;
        cancelAnimationFrame(gameLoopRef.current);
        if (timerRef.current) clearInterval(timerRef.current);
        if (uiUpdateRef.current) clearInterval(uiUpdateRef.current);
        
        setGameState(success ? "success" : "failed");
        
        const stats: TaskStats = {
            validated,
            falsePositives,
            timeElapsed: TIME_LIMIT - timeLeft,
            reputationFinal: reputation,
        };
        
        if (success) {
            try {
                if (!completedTasks || !completedTasks[TASK_ID]) {
                    markTaskCompleted(TASK_ID);
                    const pts = Math.min(20, Math.max(8, Math.round(reputation / 10)));
                    socket.emit("task_completed", { taskId: TASK_ID, playerSocketId: localPlayerId, points: pts });
                }
            } catch (e) {
                console.warn("task emit failed", e);
            }
        }
    }, [validated, falsePositives, timeLeft, reputation, completedTasks, localPlayerId, markTaskCompleted]);
    
    // Check win/lose conditions
    useEffect(() => {
        if (gameState !== "playing") return;
        
        if (validated >= TARGET_VALIDATIONS) {
            handleComplete(true);
        } else if (isFull || reputation <= 0 || timeLeft <= 0) {
            handleComplete(false);
        }
    }, [gameState, validated, isFull, reputation, timeLeft, handleComplete]);
    
    // Cleanup on close
    useEffect(() => {
        if (!isOpen) {
            isRunningRef.current = false;
            cancelAnimationFrame(gameLoopRef.current);
            if (timerRef.current) clearInterval(timerRef.current);
            if (uiUpdateRef.current) clearInterval(uiUpdateRef.current);
        }
    }, [isOpen]);
    
    // Reset on open
    useEffect(() => {
        if (isOpen) {
            isRunningRef.current = false;
            setGameState("idle");
            setTransactions([]);
            setValidated(0);
            setFalsePositives(0);
            setTimeLeft(TIME_LIMIT);
            setFloatingTexts([]);
            setShowTooltip(true);
            resetRep();
            resetCapacity();
        }
    }, [isOpen, resetRep, resetCapacity]);
    
    // Keyboard navigation
    useEffect(() => {
        if (!isOpen || gameState !== "playing") return;
        
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Tab") {
                e.preventDefault();
                const txIds = transactions.map(t => t.id);
                if (txIds.length === 0) return;
                const currentIndex = selectedTxId ? txIds.indexOf(selectedTxId) : -1;
                const nextIndex = (currentIndex + 1) % txIds.length;
                setSelectedTxId(txIds[nextIndex]);
            } else if (e.key === "Enter" && selectedTxId) {
                const tx = transactions.find(t => t.id === selectedTxId);
                if (tx) handleTxClick(tx);
            }
        };
        
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, gameState, transactions, selectedTxId, handleTxClick]);
    
    if (!isOpen) return null;
    
    const reputationPct = reputation / INITIAL_REPUTATION * 100;
    const validatedPct = (validated / TARGET_VALIDATIONS) * 100;
    
    return (
        <div style={styles.overlay}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700&family=Share+Tech+Mono&display=swap');
                
                @keyframes float {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-4px); }
                }
                
                @keyframes glitch {
                    0%, 100% { clip-path: inset(0 0 0 0); transform: translateX(0); }
                    20% { clip-path: inset(20% 0 60% 0); transform: translateX(-2px); }
                    40% { clip-path: inset(40% 0 40% 0); transform: translateX(2px); }
                    60% { clip-path: inset(60% 0 20% 0); transform: translateX(-1px); }
                    80% { clip-path: inset(10% 0 80% 0); transform: translateX(1px); }
                }
                
                @keyframes pulse-red {
                    0%, 100% { box-shadow: 0 0 10px #ff2244; }
                    50% { box-shadow: 0 0 25px #ff2244, 0 0 40px #ff0000; }
                }
                
                @keyframes burst {
                    0% { transform: scale(1); opacity: 1; }
                    100% { transform: scale(2); opacity: 0; }
                }
                
                @keyframes floatUp {
                    0% { transform: translateY(0); opacity: 1; }
                    100% { transform: translateY(-40px); opacity: 0; }
                }
                
                @keyframes nebula {
                    0% { background-position: 0% 0%; }
                    100% { background-position: 100% 100%; }
                }
                
                .tx-bubble {
                    position: absolute;
                    border-radius: 12px;
                    cursor: pointer;
                    transition: transform 0.1s ease;
                    user-select: none;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 6px;
                    font-family: 'Share Tech Mono', monospace;
                }
                
                .tx-bubble:hover {
                    transform: scale(1.08);
                }
                
                .tx-bubble:active {
                    transform: scale(0.95);
                }
                
                .tx-legitimate {
                    background: linear-gradient(135deg, #001a2e, #002244);
                    border: 2px solid #00c8ff;
                    box-shadow: 0 0 12px #00c8ff, inset 0 0 8px rgba(0, 200, 255, 0.2);
                }
                
                .tx-spam {
                    background: linear-gradient(135deg, #2a0a0a, #3a1010);
                    border: 2px solid #ff2244;
                    animation: glitch 0.4s ease-in-out infinite, pulse-red 1s ease-in-out infinite;
                }
                
                .tx-nft {
                    background: linear-gradient(135deg, #1a0a2a, #2a1040);
                    border: 2px solid #b44aff;
                    box-shadow: 0 0 12px #b44aff, inset 0 0 8px rgba(180, 74, 255, 0.2);
                }
                
                .tx-contract {
                    background: linear-gradient(135deg, #2a1a0a, #3a2510);
                    border: 2px solid #ffaa00;
                    box-shadow: 0 0 12px #ffaa00, inset 0 0 8px rgba(255, 170, 0, 0.2);
                }
                
                .tx-selected {
                    outline: 3px solid #fff;
                    outline-offset: 2px;
                }
                
                .floating-text {
                    position: absolute;
                    font-family: 'Share Tech Mono', monospace;
                    font-weight: 700;
                    font-size: 14px;
                    pointer-events: none;
                    animation: floatUp 1s ease-out forwards;
                    text-shadow: 0 0 10px currentColor;
                }
                
                .game-field {
                    background: 
                        radial-gradient(ellipse at 20% 30%, #1a0a2e 0%, transparent 50%),
                        radial-gradient(ellipse at 80% 70%, #0d0520 0%, transparent 50%),
                        radial-gradient(ellipse at 50% 50%, #120820 0%, transparent 70%),
                        #080612;
                    animation: nebula 60s linear infinite;
                }
                
                .progress-bar {
                    height: 100%;
                    transition: width 0.3s ease;
                }
                
                .mempool-critical {
                    animation: pulse-red 0.5s ease-in-out infinite;
                }
            `}</style>
            
            <div style={styles.modal}>
                <button style={styles.closeBtn} onClick={onClose}>✕</button>
                
                {/* Header HUD */}
                <div style={styles.header}>
                    <div style={styles.titleSection}>
                        <div style={styles.titleTag}>[ VALIDATOR MODE ]</div>
                        <h1 style={styles.title}>MEMPOOL CLEANUP</h1>
                    </div>
                    <div style={styles.headerStats}>
                        <div style={styles.timer}>
                            <span style={styles.timerIcon}>⏱</span>
                            <span style={{ 
                                ...styles.timerValue, 
                                color: timeLeft <= 10 ? "#ff2244" : "#00c8ff" 
                            }}>
                                {String(Math.floor(timeLeft / 60)).padStart(2, "0")}:
                                {String(timeLeft % 60).padStart(2, "0")}
                            </span>
                        </div>
                        <div style={styles.repContainer}>
                            <span style={styles.repIcon}>💀</span>
                            <span style={styles.repLabel}>REP:</span>
                            <div style={styles.repBar}>
                                <div 
                                    className="progress-bar"
                                    style={{
                                        ...styles.repFill,
                                        width: `${reputationPct}%`,
                                        background: reputationPct > 50 ? "#00c8ff" : reputationPct > 25 ? "#ffaa00" : "#ff2244",
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
                
                {/* Progress bars */}
                <div style={styles.progressSection}>
                    <div style={styles.progressRow}>
                        <span style={styles.progressLabel}>Validated: {validated}/{TARGET_VALIDATIONS}</span>
                        <div style={styles.progressBarContainer}>
                            <div 
                                className="progress-bar"
                                style={{
                                    ...styles.progressFill,
                                    width: `${validatedPct}%`,
                                    background: "linear-gradient(90deg, #00c8ff, #4af0ff)",
                                }}
                            />
                        </div>
                    </div>
                    <div style={styles.progressRow}>
                        <span style={styles.progressLabel}>Mempool: {capacity}%</span>
                        <div 
                            style={styles.progressBarContainer}
                            className={capacity > 80 ? "mempool-critical" : ""}
                        >
                            <div 
                                className="progress-bar"
                                style={{
                                    ...styles.progressFill,
                                    width: `${capacity}%`,
                                    background: capacity > 80 ? "#ff2244" : capacity > 50 ? "#ffaa00" : "#6633ff",
                                }}
                            />
                        </div>
                    </div>
                </div>
                
                {/* Game field */}
                <div 
                    className="game-field"
                    style={styles.gameField}
                >
                    {/* Transactions */}
                    {transactions.map(tx => {
                        const bubbleClass = tx.isSpam 
                            ? "tx-spam" 
                            : tx.type === "nft" 
                                ? "tx-nft" 
                                : tx.type === "contract" 
                                    ? "tx-contract" 
                                    : "tx-legitimate";
                        
                        return (
                            <div
                                key={tx.id}
                                className={`tx-bubble ${bubbleClass} ${selectedTxId === tx.id ? "tx-selected" : ""}`}
                                style={{
                                    left: tx.x - tx.size / 2,
                                    top: tx.y - tx.size / 2,
                                    width: tx.size,
                                    height: tx.size,
                                }}
                                onClick={() => handleTxClick(tx)}
                                onTouchStart={() => handleTxClick(tx)}
                            >
                                {tx.isSpam && <span style={styles.spamIcon}>💀</span>}
                                <span style={styles.txType}>
                                    {tx.type === "transfer" ? "⟳" : tx.type === "contract" ? "📜" : "🖼"} 
                                    {tx.type.toUpperCase().slice(0, 4)}
                                </span>
                                <span style={styles.txAmount}>
                                    {tx.amount < 1000 ? tx.amount.toFixed(2) : tx.amount.toLocaleString()} {tx.tokenName}
                                </span>
                                <span style={{
                                    ...styles.txGas,
                                    color: tx.gasFee > 100 ? "#ff6644" : tx.gasFee > 50 ? "#ffaa00" : "#00ff88",
                                }}>
                                    {tx.gasFee} gwei
                                </span>
                            </div>
                        );
                    })}
                    
                    {/* Floating texts */}
                    {floatingTexts.map(ft => (
                        <div
                            key={ft.id}
                            className="floating-text"
                            style={{
                                left: ft.x,
                                top: ft.y,
                                color: ft.color,
                            }}
                        >
                            {ft.text}
                        </div>
                    ))}
                    
                    {/* Idle state overlay */}
                    {gameState === "idle" && (
                        <div style={styles.overlayScreen}>
                            <div style={styles.overlayIcon}>⛓️</div>
                            <h2 style={styles.overlayTitle}>MEMPOOL CLEANUP</h2>
                            <p style={styles.overlayBody}>
                                Click <span style={{ color: "#00c8ff" }}>legitimate transactions</span> to validate them.
                                <br />Avoid <span style={{ color: "#ff2244" }}>spam transactions</span> (red, glitchy).
                                <br />Validate {TARGET_VALIDATIONS} transactions to complete!
                            </p>
                            <button style={styles.startBtn} onClick={startGame}>
                                START VALIDATION
                            </button>
                        </div>
                    )}
                    
                    {/* Success state */}
                    {gameState === "success" && (
                        <div style={styles.overlayScreen}>
                            <div style={{ ...styles.overlayIcon, color: "#00c8ff" }}>✓</div>
                            <h2 style={{ ...styles.overlayTitle, color: "#00c8ff" }}>MEMPOOL CLEARED!</h2>
                            <p style={styles.overlayBody}>
                                Validated: {validated}<br />
                                False Positives: {falsePositives}<br />
                                Final Reputation: {reputation}%
                            </p>
                            <button style={styles.startBtn} onClick={() => setGameState("idle")}>
                                PLAY AGAIN
                            </button>
                        </div>
                    )}
                    
                    {/* Failed state */}
                    {gameState === "failed" && (
                        <div style={styles.overlayScreen}>
                            <div style={{ ...styles.overlayIcon, color: "#ff2244" }}>✕</div>
                            <h2 style={{ ...styles.overlayTitle, color: "#ff2244" }}>
                                {isFull ? "MEMPOOL OVERFLOW!" : reputation <= 0 ? "REPUTATION LOST!" : "TIME'S UP!"}
                            </h2>
                            <p style={styles.overlayBody}>
                                Validated: {validated}/{TARGET_VALIDATIONS}<br />
                                False Positives: {falsePositives}<br />
                                Final Reputation: {reputation}%
                            </p>
                            <button 
                                style={{ ...styles.startBtn, borderColor: "#ff2244", color: "#ff2244" }} 
                                onClick={() => setGameState("idle")}
                            >
                                RETRY
                            </button>
                        </div>
                    )}
                </div>
                
                {/* Educational tooltip */}
                {showTooltip && gameState === "idle" && (
                    <div style={styles.tooltip}>
                        <button 
                            style={styles.tooltipClose}
                            onClick={() => setShowTooltip(false)}
                        >
                            ✕
                        </button>
                        <p style={styles.tooltipText}>
                            <strong style={{ color: "#6633ff" }}>What is the Mempool?</strong><br />
                            Validators scan the mempool — a waiting room for unconfirmed transactions. 
                            They prioritize high gas-fee transactions for inclusion in the next block. 
                            <span style={{ color: "#ff2244" }}> Spam attacks</span> flood the mempool with junk 
                            transactions hoping to delay legitimate ones. A healthy fee market keeps the network efficient.
                        </p>
                    </div>
                )}
                
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
        background: "rgba(0,0,0,0.9)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        fontFamily: "'Share Tech Mono', 'Courier New', monospace",
    },
    modal: {
        background: "#0a0612",
        padding: "20px",
        borderRadius: "16px",
        width: "95%",
        maxWidth: "520px",
        maxHeight: "95vh",
        overflow: "hidden",
        position: "relative",
        border: "2px solid #6633ff",
        boxShadow: "0 0 40px rgba(102, 51, 255, 0.3)",
    },
    closeBtn: {
        position: "absolute",
        top: "12px",
        right: "12px",
        background: "rgba(0,0,0,0.5)",
        border: "1px solid #6633ff44",
        color: "#6633ff",
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
        marginBottom: "12px",
        flexWrap: "wrap",
        gap: "8px",
    },
    titleSection: {
        display: "flex",
        flexDirection: "column",
        gap: "2px",
    },
    titleTag: {
        fontSize: "9px",
        letterSpacing: "2px",
        color: "#6633ff88",
    },
    title: {
        margin: 0,
        fontSize: "18px",
        fontWeight: 700,
        fontFamily: "'Orbitron', sans-serif",
        color: "#00c8ff",
        letterSpacing: "2px",
        textShadow: "0 0 15px rgba(0, 200, 255, 0.5)",
    },
    headerStats: {
        display: "flex",
        alignItems: "center",
        gap: "16px",
    },
    timer: {
        display: "flex",
        alignItems: "center",
        gap: "4px",
    },
    timerIcon: {
        fontSize: "14px",
    },
    timerValue: {
        fontSize: "16px",
        fontWeight: 700,
        fontFamily: "'Orbitron', sans-serif",
    },
    repContainer: {
        display: "flex",
        alignItems: "center",
        gap: "6px",
    },
    repIcon: {
        fontSize: "14px",
    },
    repLabel: {
        fontSize: "10px",
        color: "#888",
    },
    repBar: {
        width: "60px",
        height: "10px",
        background: "#1e1635",
        borderRadius: "5px",
        overflow: "hidden",
        border: "1px solid #333",
    },
    repFill: {
        height: "100%",
        borderRadius: "5px",
    },
    progressSection: {
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        marginBottom: "12px",
    },
    progressRow: {
        display: "flex",
        alignItems: "center",
        gap: "12px",
    },
    progressLabel: {
        fontSize: "11px",
        color: "#aaa",
        minWidth: "120px",
    },
    progressBarContainer: {
        flex: 1,
        height: "12px",
        background: "#1e1635",
        borderRadius: "6px",
        overflow: "hidden",
        border: "1px solid #333",
    },
    progressFill: {
        height: "100%",
        borderRadius: "6px",
    },
    gameField: {
        position: "relative",
        width: "100%",
        height: `${GAME_HEIGHT}px`,
        borderRadius: "12px",
        overflow: "hidden",
        border: "1px solid #1e1635",
    },
    txType: {
        fontSize: "8px",
        letterSpacing: "1px",
        color: "#fff",
        opacity: 0.8,
    },
    txAmount: {
        fontSize: "10px",
        fontWeight: 700,
        color: "#fff",
    },
    txGas: {
        fontSize: "8px",
    },
    spamIcon: {
        position: "absolute",
        top: "-4px",
        right: "-4px",
        fontSize: "14px",
    },
    overlayScreen: {
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(8, 6, 18, 0.95)",
        gap: "12px",
        padding: "20px",
        textAlign: "center",
    },
    overlayIcon: {
        fontSize: "48px",
        marginBottom: "8px",
    },
    overlayTitle: {
        margin: 0,
        fontSize: "24px",
        fontWeight: 700,
        fontFamily: "'Orbitron', sans-serif",
        color: "#6633ff",
        letterSpacing: "3px",
        textShadow: "0 0 20px currentColor",
    },
    overlayBody: {
        fontSize: "12px",
        color: "#aaa",
        lineHeight: 1.8,
        maxWidth: "320px",
    },
    startBtn: {
        marginTop: "12px",
        padding: "14px 32px",
        fontSize: "14px",
        fontWeight: 700,
        fontFamily: "'Orbitron', sans-serif",
        letterSpacing: "2px",
        background: "linear-gradient(135deg, #1a0a2e, #2a1050)",
        border: "2px solid #6633ff",
        borderRadius: "8px",
        color: "#6633ff",
        cursor: "pointer",
        textShadow: "0 0 10px rgba(102, 51, 255, 0.5)",
        transition: "all 0.2s ease",
    },
    tooltip: {
        marginTop: "12px",
        padding: "12px",
        background: "#1e1635",
        borderRadius: "8px",
        border: "1px solid #6633ff44",
        position: "relative",
    },
    tooltipClose: {
        position: "absolute",
        top: "6px",
        right: "6px",
        background: "transparent",
        border: "none",
        color: "#666",
        fontSize: "12px",
        cursor: "pointer",
    },
    tooltipText: {
        fontSize: "11px",
        color: "#888",
        lineHeight: 1.6,
        margin: 0,
    },
    completedBadge: {
        position: "absolute",
        top: "12px",
        left: "12px",
        padding: "4px 12px",
        background: "rgba(102, 51, 255, 0.2)",
        border: "1px solid #6633ff",
        borderRadius: "4px",
        color: "#6633ff",
        fontSize: "10px",
        letterSpacing: "1px",
    },
};
