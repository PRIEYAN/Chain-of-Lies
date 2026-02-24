import { useState, useEffect, useRef, useCallback } from "react";
import { socket } from "@/shared/socket";
import { useGameStore } from "@/stores/useGameStore";

type GameState = "idle" | "showing" | "playerTurn" | "success" | "gameOver";
type TileColor = "cyan" | "purple" | "gold" | "red" | "green";

interface Tile {
    id: TileColor;
    label: string;
    color: string;
    glow: string;
    shadow: string;
}

const TILES: Tile[] = [
    { id: "cyan", label: "0xC", color: "#00f5ff", glow: "#00f5ff", shadow: "0 0 40px #00f5ff, 0 0 80px #00f5ff66" },
    { id: "purple", label: "0xP", color: "#bf5fff", glow: "#bf5fff", shadow: "0 0 40px #bf5fff, 0 0 80px #bf5fff66" },
    { id: "gold", label: "0xG", color: "#ffd700", glow: "#ffd700", shadow: "0 0 40px #ffd700, 0 0 80px #ffd70066" },
    { id: "red", label: "0xR", color: "#ff3c5a", glow: "#ff3c5a", shadow: "0 0 40px #ff3c5a, 0 0 80px #ff3c5a66" },
    { id: "green", label: "0xN", color: "#00ff9f", glow: "#00ff9f", shadow: "0 0 40px #00ff9f, 0 0 80px #00ff9f66" },
];

const BASE_SPEED = 800;
const MIN_SPEED = 300;

function playTone(freq: number, duration: number) {
    try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = "square";
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);
        osc.start();
        osc.stop(ctx.currentTime + duration / 1000);
    } catch { }
}

const TILE_FREQS: Record<TileColor, number> = { cyan: 523, purple: 392, gold: 659, red: 330, green: 440 };

export default function MemoryMinerPopup({
    isOpen,
    onClose,
}: {
    isOpen: boolean;
    onClose: () => void;
}) {
    const TASK_ID = "task4";
    const { completedTasks, localPlayerId, markTaskCompleted } = useGameStore();
    const [gameState, setGameState] = useState<GameState>("idle");
    const [sequence, setSequence] = useState<TileColor[]>([]);
    const [playerInput, setPlayerInput] = useState<TileColor[]>([]);
    const [activeTile, setActiveTile] = useState<TileColor | null>(null);
    const [chain, setChain] = useState<number>(0);
    const [hashpower, setHashpower] = useState<number>(0);
    const [forkFlash, setForkFlash] = useState<TileColor | null>(null);
    const [message, setMessage] = useState<string>("");
    const [newBlock, setNewBlock] = useState<boolean>(false);
    const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

    const clearTimeouts = () => {
        timeoutsRef.current.forEach(clearTimeout);
        timeoutsRef.current = [];
    };

    // Reset state when opening
    useEffect(() => {
        if (isOpen) {
            setGameState("idle");
            setSequence([]);
            setPlayerInput([]);
            setActiveTile(null);
            setChain(0);
            setHashpower(0);
            setForkFlash(null);
            setMessage("");
            setNewBlock(false);
            clearTimeouts();
        }
        return () => clearTimeouts();
    }, [isOpen]);

    const randomTile = (): TileColor => {
        const ids: TileColor[] = ["cyan", "purple", "gold", "red", "green"];
        return ids[Math.floor(Math.random() * 5)];
    };

    const getSpeed = (seqLen: number) => Math.max(MIN_SPEED, BASE_SPEED - seqLen * 30);

    const flashTile = useCallback((tile: TileColor, duration: number) => {
        setActiveTile(tile);
        playTone(TILE_FREQS[tile], duration * 0.8);
        return new Promise<void>((res) => {
            const t = setTimeout(() => {
                setActiveTile(null);
                res();
            }, duration);
            timeoutsRef.current.push(t);
        });
    }, []);

    const playSequence = useCallback(
        async (seq: TileColor[]) => {
            setGameState("showing");
            setPlayerInput([]);
            const speed = getSpeed(seq.length);
            const gap = speed * 0.3;

            await new Promise<void>((res) => {
                const t = setTimeout(res, 500);
                timeoutsRef.current.push(t);
            });

            for (const tile of seq) {
                await flashTile(tile, speed * 0.6);
                await new Promise<void>((res) => {
                    const t = setTimeout(res, gap);
                    timeoutsRef.current.push(t);
                });
            }

            if (seq.length > 6) {
                const forkTile = randomTile();
                setForkFlash(forkTile);
                await new Promise<void>((res) => {
                    const t = setTimeout(() => {
                        setForkFlash(null);
                        res();
                    }, 150);
                    timeoutsRef.current.push(t);
                });
            }

            setGameState("playerTurn");
            setMessage("Validate the block \u2192");
        },
        [flashTile]
    );

    const startGame = () => {
        clearTimeouts();
        const first = randomTile();
        const seq = [first];
        setSequence(seq);
        setChain(0);
        setHashpower(0);
        setPlayerInput([]);
        setMessage("");
        setNewBlock(false);
        playSequence(seq);
    };

    // mark completion when chain completes
    useEffect(() => {
        if (chain >= 5) {
            try {
                if (!completedTasks || !completedTasks[TASK_ID]) {
                    markTaskCompleted(TASK_ID);
                    socket.emit("task_completed", { taskId: TASK_ID, playerSocketId: localPlayerId, points: 15 });
                }
            } catch (e) {
                console.warn("task emit failed", e);
            }
        }
    }, [chain, completedTasks, localPlayerId, markTaskCompleted]);

    const handleTilePress = (tileId: TileColor) => {
        if (gameState !== "playerTurn") return;

        flashTile(tileId, 200);
        const next = [...playerInput, tileId];
        setPlayerInput(next);

        const idx = next.length - 1;
        if (next[idx] !== sequence[idx]) {
            setGameState("gameOver");
            setMessage("Block Rejected");
            return;
        }

        if (next.length === sequence.length) {
            const newChain = chain + 1;
            const newHash = hashpower + sequence.length * 10;
            setChain(newChain);
            setHashpower(newHash);
            setNewBlock(true);
            setGameState("success");

            if (newChain >= 5) {
                setMessage("Chain Complete! \ud83c\udfc6");
            } else {
                setMessage("Block Mined! \u2713");
                const newSeq = [...sequence, randomTile()];
                setSequence(newSeq);
                const t = setTimeout(() => {
                    setNewBlock(false);
                    playSequence(newSeq);
                }, 1200);
                timeoutsRef.current.push(t);
            }
        }
    };

    if (!isOpen) return null;

    const tileStyle = (tile: Tile): React.CSSProperties => {
        const isActive = activeTile === tile.id;
        const isFork = forkFlash === tile.id;
        return {
            background: isActive || isFork
                ? `radial-gradient(circle, ${tile.color}cc 0%, ${tile.color}44 60%, #0a0a1200 100%)`
                : `radial-gradient(circle, ${tile.color}18 0%, #0d0d1a 100%)`,
            border: `2px solid ${isActive || isFork ? tile.color : tile.color + "44"}`,
            boxShadow: isActive ? tile.shadow : isFork ? `0 0 20px ${tile.color}88` : `inset 0 0 20px ${tile.color}11`,
            borderRadius: 16,
            cursor: gameState === "playerTurn" ? "pointer" : "default",
            transition: "all 0.1s ease",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 22,
            fontFamily: "'Courier New', monospace",
            fontWeight: 700,
            color: isActive ? tile.color : tile.color + "66",
            textShadow: isActive ? `0 0 20px ${tile.color}` : "none",
            userSelect: "none",
            position: "relative",
            overflow: "hidden",
        };
    };

    const isIdle = gameState === "idle";
    const isOver = gameState === "gameOver";

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.85)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 9999,
                padding: "20px",
            }}
        >
            <div style={{
                background: "#07071a",
                borderRadius: 20,
                padding: 24,
                width: 380,
                fontFamily: "'Courier New', monospace",
                color: "#e0e0ff",
                position: "relative",
                overflow: "hidden",
                boxShadow: "0 0 60px #00f5ff22, 0 20px 60px #00000088",
                border: "1px solid #ffffff11",
            }}>
                <style>{`
          @keyframes gridMove {
            from { transform: translateY(0); }
            to { transform: translateY(40px); }
          }
          @keyframes blockAppend {
            0% { transform: scale(0) translateY(-10px); opacity: 0; }
            60% { transform: scale(1.2) translateY(0); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
          @keyframes slideUp {
            from { transform: translateY(20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
          .mm-tile:hover {
            transform: scale(1.03);
          }
          .mm-tile:active {
            transform: scale(0.97);
          }
          .mm-btn {
            background: linear-gradient(135deg, #00f5ff22, #bf5fff22);
            border: 1px solid #00f5ff88;
            color: #00f5ff;
            padding: 12px 28px;
            borderRadius: 8px;
            fontFamily: 'Courier New', monospace;
            fontSize: 14px;
            fontWeight: 700;
            cursor: pointer;
            letterSpacing: 2px;
            transition: all 0.2s;
          }
          .mm-btn:hover {
            background: linear-gradient(135deg, #00f5ff44, #bf5fff44);
            boxShadow: 0 0 20px #00f5ff44;
          }
        `}</style>

                <button
                    onClick={onClose}
                    style={{
                        position: "absolute",
                        top: "15px",
                        right: "15px",
                        background: "rgba(0,0,0,0.5)",
                        border: "1px solid #00f5ff44",
                        color: "#00f5ff",
                        borderRadius: "50%",
                        width: "32px",
                        height: "32px",
                        cursor: "pointer",
                        zIndex: 11,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "18px",
                    }}
                >
                    \u2715
                </button>

                {/* Grid background */}
                <div style={{
                    position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0,
                }}>
                    <svg width="100%" height="100%" style={{ opacity: 0.06 }}>
                        <defs>
                            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#00f5ff" strokeWidth="0.5" />
                            </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#grid)" />
                    </svg>
                </div>

                <div style={{ position: "relative", zIndex: 1 }}>
                    {/* Header */}
                    <div style={{ textAlign: "center", marginBottom: 16 }}>
                        <div style={{ fontSize: 11, color: "#00f5ff88", letterSpacing: 4, marginBottom: 4 }}>
                            BLOCKCHAIN PROTOCOL
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: 3, color: "#00f5ff", textShadow: "0 0 20px #00f5ff" }}>
                            MEMORY MINER
                        </div>
                    </div>

                    {/* Stats */}
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, padding: "8px 12px", background: "#ffffff06", borderRadius: 8, border: "1px solid #ffffff0a" }}>
                        {[
                            { label: "HASHPOWER", value: hashpower },
                            { label: "BLOCK HEIGHT", value: chain },
                            { label: "SEQ LENGTH", value: sequence.length || 0 },
                        ].map((s) => (
                            <div key={s.label} style={{ textAlign: "center" }}>
                                <div style={{ fontSize: 8, color: "#ffffff44", letterSpacing: 2 }}>{s.label}</div>
                                <div style={{ fontSize: 18, color: "#ffd700", fontWeight: 700, textShadow: "0 0 10px #ffd70088" }}>{s.value}</div>
                            </div>
                        ))}
                    </div>

                    {/* Blockchain chain */}
                    <div style={{ marginBottom: 16, minHeight: 40, display: "flex", alignItems: "center", gap: 4, overflowX: "auto", padding: "6px 0" }}>
                        <div style={{ fontSize: 9, color: "#ffffff33", letterSpacing: 2, whiteSpace: "nowrap", marginRight: 4 }}>CHAIN</div>
                        {chain === 0 ? (
                            <div style={{ fontSize: 10, color: "#ffffff22", fontStyle: "italic" }}>no blocks yet...</div>
                        ) : (
                            Array.from({ length: chain }).map((_, i) => (
                                <div key={i} style={{
                                    width: 24, height: 24, borderRadius: 4, flexShrink: 0,
                                    background: `linear-gradient(135deg, ${TILES[i % 4].color}44, ${TILES[(i + 1) % 4].color}22)`,
                                    border: `1px solid ${TILES[i % 4].color}88`,
                                    boxShadow: i === chain - 1 && newBlock ? TILES[i % 4].shadow : `0 0 6px ${TILES[i % 4].color}44`,
                                    animation: i === chain - 1 && newBlock ? "blockAppend 0.5s ease forwards" : "none",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontSize: 8, color: TILES[i % 4].color, fontWeight: 700,
                                }}>
                                    {i + 1}
                                </div>
                            ))
                        )}
                        {chain > 0 && (
                            <div style={{ fontSize: 9, color: "#ffffff22", marginLeft: 2 }}>\u2192</div>
                        )}
                    </div>

                    {/* Status message */}
                    <div style={{
                        textAlign: "center", minHeight: 20, marginBottom: 12, fontSize: 12, letterSpacing: 2,
                        color: gameState === "success" ? "#00f5ff" : gameState === "gameOver" ? "#ff3c5a" : "#ffffff66",
                        textShadow: gameState === "success" ? "0 0 10px #00f5ff" : gameState === "gameOver" ? "0 0 10px #ff3c5a" : "none",
                        animation: message ? "slideUp 0.3s ease" : "none",
                    }}>
                        {message}
                    </div>

                    {/* Tiles grid */}
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                            {TILES.slice(0, 4).map((tile) => (
                                <div
                                    key={tile.id}
                                    className="mm-tile"
                                    style={{ ...tileStyle(tile), height: 100 }}
                                    onMouseDown={() => handleTilePress(tile.id)}
                                >
                                    <div style={{ textAlign: "center" }}>
                                        <div style={{ fontSize: 20, marginBottom: 2 }}>
                                            {tile.id === "cyan" ? "\u25c8" : tile.id === "purple" ? "\u25c6" : tile.id === "gold" ? "\u25c9" : "\u25c7"}
                                        </div>
                                        <div style={{ fontSize: 10, letterSpacing: 1, opacity: 0.7 }}>{tile.label}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div style={{ display: "flex", justifyContent: "center" }}>
                            <div
                                className="mm-tile"
                                style={{ ...tileStyle(TILES[4]), height: 100, width: "calc(50% - 6px)" }}
                                onMouseDown={() => handleTilePress(TILES[4].id)}
                            >
                                <div style={{ textAlign: "center" }}>
                                    <div style={{ fontSize: 20, marginBottom: 2 }}>\u25ec</div>
                                    <div style={{ fontSize: 10, letterSpacing: 1, opacity: 0.7 }}>{TILES[4].label}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Phase indicator */}
                    <div style={{ textAlign: "center", fontSize: 10, color: "#ffffff33", letterSpacing: 2, height: 14 }}>
                        {gameState === "showing" && (
                            <span style={{ animation: "pulse 1s infinite" }}>\u25c9 BROADCASTING SEQUENCE</span>
                        )}
                        {gameState === "playerTurn" && (
                            <span style={{ color: "#ffd70066" }}>\u25c8 AWAITING VALIDATION</span>
                        )}
                        {gameState === "idle" && <span>\u25cf MINER OFFLINE</span>}
                    </div>
                </div>

                {/* Start overlay */}
                {isIdle && (
                    <div style={{
                        position: "absolute", inset: 0, background: "#07071aee", backdropFilter: "blur(4px)",
                        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                        borderRadius: 20, zIndex: 10, gap: 12,
                    }}>
                        <div style={{ fontSize: 32, fontWeight: 700, color: "#00f5ff", textShadow: "0 0 30px #00f5ff", letterSpacing: 4 }}>
                            MEMORY MINER
                        </div>
                        <div style={{ fontSize: 12, color: "#ffffff55", letterSpacing: 2, textAlign: "center", maxWidth: 260, lineHeight: 1.6 }}>
                            Perfect recall validates the block.
                        </div>
                        <div style={{ fontSize: 10, color: "#ffffff33", textAlign: "center", maxWidth: 240, lineHeight: 1.8, marginTop: 4 }}>
                            Watch the sequence \u2192 Repeat it exactly \u2192 Mine the block
                        </div>
                        <button
                            className="mm-btn"
                            onClick={startGame}
                        >
                            START MINING
                        </button>
                    </div>
                )}

                {/* Win overlay */}
                {gameState === "success" && chain >= 5 && (
                    <div style={{
                        position: "absolute", inset: 0, background: "#07071af2", backdropFilter: "blur(4px)",
                        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                        borderRadius: 20, zIndex: 10, gap: 10, animation: "slideUp 0.4s ease",
                    }}>
                        <div style={{ fontSize: 11, color: "#00ff9f88", letterSpacing: 4 }}>CHAIN VALIDATED</div>
                        <div style={{ fontSize: 28, fontWeight: 700, color: "#00ff9f", textShadow: "0 0 40px #00ff9f", letterSpacing: 2 }}>
                            CHAIN COMPLETE
                        </div>
                        <div style={{ fontSize: 32, marginTop: 4 }}>\ud83c\udfc6</div>
                        <div style={{ display: "flex", gap: 24, marginTop: 4 }}>
                            <div style={{ textAlign: "center" }}>
                                <div style={{ fontSize: 9, color: "#ffffff33", letterSpacing: 2 }}>BLOCKS MINED</div>
                                <div style={{ fontSize: 28, color: "#ffd700", fontWeight: 700, textShadow: "0 0 10px #ffd70088" }}>5</div>
                            </div>
                            <div style={{ textAlign: "center" }}>
                                <div style={{ fontSize: 9, color: "#ffffff33", letterSpacing: 2 }}>HASHPOWER</div>
                                <div style={{ fontSize: 28, color: "#00ff9f", fontWeight: 700, textShadow: "0 0 10px #00ff9f88" }}>{hashpower}</div>
                            </div>
                        </div>
                        <button
                            className="mm-btn"
                            onClick={startGame}
                        >
                            MINE AGAIN
                        </button>
                    </div>
                )}

                {/* Game Over overlay */}
                {isOver && (
                    <div style={{
                        position: "absolute", inset: 0, background: "#07071aee", backdropFilter: "blur(4px)",
                        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                        borderRadius: 20, zIndex: 10, gap: 10, animation: "slideUp 0.3s ease",
                    }}>
                        <div style={{ fontSize: 11, color: "#ff3c5a88", letterSpacing: 4 }}>CONSENSUS FAILED</div>
                        <div style={{ fontSize: 28, fontWeight: 700, color: "#ff3c5a", textShadow: "0 0 30px #ff3c5a", letterSpacing: 2 }}>
                            BLOCK REJECTED
                        </div>
                        <div style={{ display: "flex", gap: 24, marginTop: 8 }}>
                            <div style={{ textAlign: "center" }}>
                                <div style={{ fontSize: 9, color: "#ffffff33", letterSpacing: 2 }}>FINAL HEIGHT</div>
                                <div style={{ fontSize: 28, color: "#ffd700", fontWeight: 700, textShadow: "0 0 10px #ffd70088" }}>{chain}</div>
                            </div>
                            <div style={{ textAlign: "center" }}>
                                <div style={{ fontSize: 9, color: "#ffffff33", letterSpacing: 2 }}>HASHPOWER</div>
                                <div style={{ fontSize: 28, color: "#bf5fff", fontWeight: 700, textShadow: "0 0 10px #bf5fff88" }}>{hashpower}</div>
                            </div>
                        </div>
                        <button
                            className="mm-btn"
                            onClick={startGame}
                        >
                            RESTART MINING
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
