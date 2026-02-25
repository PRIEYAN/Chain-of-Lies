/**
 * Task 12 — "Consensus Alignment"
 *
 * Blockchain-themed Among Us mini-game. The player drags a green crosshair node
 * to overlap a golden consensus target (weighted average of honest validator
 * positions) for 3 uninterrupted seconds to finalize a block. Finalize 3 blocks
 * to complete the task.
 *
 * Sabotage mode: 2 malicious nodes pull the target off-center and crosshair
 * inertia increases, simulating network lag.
 *
 * Educational: teaches validator consensus, Byzantine Fault Tolerance, and
 * honest-majority security.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { socket } from "@/shared/socket";
import { useGameStore } from "@/stores/useGameStore";

// ─── Constants ────────────────────────────────────────────────────────────────

const TASK_ID = "task12";
const OVERLAP_RADIUS = 32;
const ALIGNMENT_DURATION = 3;       // seconds to hold for finalization
const DEFAULT_BLOCK_TIME = 12;      // seconds per block slot
const DEFAULT_BLOCKS_REQUIRED = 3;
const LERP_NORMAL = 0.12;
const LERP_SABOTAGED = 0.07;
const HONEST_NODE_COUNT = 7;
const MALICIOUS_NODE_COUNT = 2;
const KEYBOARD_STEP = 6;
const STAR_COUNT = 100;
const UI_SYNC_INTERVAL = 100;       // ms between React state syncs
const DRAIN_RATE = 1.6;             // alignment drains faster than it fills
const MESH_MAX_DISTANCE = 250;      // px — max distance to draw mesh lines

// ─── Types ────────────────────────────────────────────────────────────────────

interface ValidatorNode {
    id: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    weight: number;
    isMalicious: boolean;
    phaseX: number;
    phaseY: number;
    freqX: number;
    freqY: number;
}

type GamePhase = "idle" | "syncing" | "success" | "failed";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pseudoNoise(t: number, phase: number, freq: number): number {
    return (
        Math.sin(t * freq + phase) * 0.4 +
        Math.sin(t * freq * 1.7 + phase * 2.3) * 0.3 +
        Math.sin(t * freq * 0.6 + phase * 0.7) * 0.3
    );
}

function clamp(v: number, min: number, max: number) {
    return Math.max(min, Math.min(max, v));
}

function randomBetween(a: number, b: number) {
    return a + Math.random() * (b - a);
}

function generateValidatorAddress(): string {
    const hex = "0123456789abcdef";
    let addr = "0x";
    for (let i = 0; i < 6; i++) addr += hex[Math.floor(Math.random() * 16)];
    return addr + "…";
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ConsensusAlignmentPopup({
    isOpen,
    onClose,
}: {
    isOpen: boolean;
    onClose: () => void;
}) {
    const { completedTasks, localPlayerId, markTaskCompleted } = useGameStore();

    const isSabotaged = false; // flip to true or wire to imposter logic
    const blockTime = DEFAULT_BLOCK_TIME;
    const blocksRequired = DEFAULT_BLOCKS_REQUIRED;

    /* ── Refs (mutable game state — not re-rendered per frame) ── */
    const fieldRef = useRef<HTMLDivElement>(null);
    const rafRef = useRef<number>(0);
    const nodesRef = useRef<ValidatorNode[]>([]);
    const crosshairRef = useRef({ x: 0, y: 0 });
    const pointerRef = useRef({ x: 0, y: 0 });
    const targetRef = useRef({ x: 0, y: 0 });
    const alignedSecondsRef = useRef(0);
    const blockTimerRef = useRef(blockTime);
    const lastFrameRef = useRef(0);
    const startTimeRef = useRef(0);
    const blockTimesRef = useRef<number[]>([]);
    const currentBlockStartRef = useRef(0);
    const keysRef = useRef<Set<string>>(new Set());
    const phaseRef = useRef<GamePhase>("idle");
    const blocksFinalizedRef = useRef(0);
    const uiSyncRef = useRef(0);

    /* ── React state (synced every UI_SYNC_INTERVAL ms for rendering) ── */
    const [phase, setPhase] = useState<GamePhase>("idle");
    const [blocksFinalized, setBlocksFinalized] = useState(0);
    const [blockTimerDisplay, setBlockTimerDisplay] = useState(blockTime);
    const [alignPct, setAlignPct] = useState(0);
    const [showFlash, setShowFlash] = useState(false);
    const [showBlockToast, setShowBlockToast] = useState(false);
    const [showTooltip, setShowTooltip] = useState(true);
    const [showFailVignette, setShowFailVignette] = useState(false);
    const [nodePositions, setNodePositions] = useState<{ x: number; y: number; isMalicious: boolean }[]>([]);
    const [crosshairPos, setCrosshairPos] = useState({ x: 0, y: 0 });
    const [targetPos, setTargetPos] = useState({ x: 0, y: 0 });
    const [meshLines, setMeshLines] = useState<{ x1: number; y1: number; x2: number; y2: number; opacity: number }[]>([]);
    const [isComplete, setIsComplete] = useState(false);

    const validatorAddr = useMemo(() => generateValidatorAddress(), []);
    const baseBlock = useMemo(() => 1040 + Math.floor(Math.random() * 20), []);

    /* ── Star field (static, computed once) ── */
    const stars = useMemo(() => {
        const arr: { left: string; top: string; opacity: number }[] = [];
        for (let i = 0; i < STAR_COUNT; i++) {
            arr.push({
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                opacity: 0.15 + Math.random() * 0.5,
            });
        }
        return arr;
    }, []);

    /* ── Check if already completed ── */
    useEffect(() => {
        if (completedTasks && completedTasks[TASK_ID]) {
            setIsComplete(true);
        }
    }, [completedTasks]);

    /* ── Create validator nodes ── */
    const createNodes = useCallback((fieldW: number, fieldH: number) => {
        const nodes: ValidatorNode[] = [];
        const malCount = isSabotaged ? MALICIOUS_NODE_COUNT : 0;
        for (let i = 0; i < HONEST_NODE_COUNT; i++) {
            nodes.push({
                id: `honest-${i}`,
                x: randomBetween(fieldW * 0.1, fieldW * 0.9),
                y: randomBetween(fieldH * 0.1, fieldH * 0.9),
                vx: 0, vy: 0,
                weight: randomBetween(0.5, 2.0),
                isMalicious: false,
                phaseX: Math.random() * Math.PI * 2,
                phaseY: Math.random() * Math.PI * 2,
                freqX: randomBetween(0.3, 0.8),
                freqY: randomBetween(0.3, 0.8),
            });
        }
        for (let i = 0; i < malCount; i++) {
            nodes.push({
                id: `mal-${i}`,
                x: randomBetween(fieldW * 0.2, fieldW * 0.8),
                y: randomBetween(fieldH * 0.2, fieldH * 0.8),
                vx: 0, vy: 0,
                weight: randomBetween(0.5, 1.0),
                isMalicious: true,
                phaseX: Math.random() * Math.PI * 2,
                phaseY: Math.random() * Math.PI * 2,
                freqX: randomBetween(0.5, 1.2),
                freqY: randomBetween(0.5, 1.2),
            });
        }
        return nodes;
    }, [isSabotaged]);

    /* ── Task completion handler ── */
    const handleComplete = useCallback(() => {
        setIsComplete(true);
        try {
            if (!completedTasks || !completedTasks[TASK_ID]) {
                markTaskCompleted(TASK_ID);
                socket.emit("task_completed", { taskId: TASK_ID, playerSocketId: localPlayerId, points: 20 });
            }
        } catch (e) {
            console.warn("task emit failed", e);
        }
    }, [completedTasks, localPlayerId, markTaskCompleted]);

    /* ── Start game ── */
    const startGame = useCallback(() => {
        const field = fieldRef.current;
        if (!field) return;
        const w = field.clientWidth;
        const h = field.clientHeight;

        const nodes = createNodes(w, h);
        nodesRef.current = nodes;
        crosshairRef.current = { x: w / 2, y: h / 2 };
        pointerRef.current = { x: w / 2, y: h / 2 };
        targetRef.current = { x: w / 2, y: h / 2 };
        alignedSecondsRef.current = 0;
        blockTimerRef.current = blockTime;
        blocksFinalizedRef.current = 0;
        startTimeRef.current = performance.now();
        currentBlockStartRef.current = performance.now();
        blockTimesRef.current = [];
        lastFrameRef.current = performance.now();

        setBlocksFinalized(0);
        setBlockTimerDisplay(blockTime);
        setAlignPct(0);
        setShowFlash(false);
        setShowBlockToast(false);
        setShowFailVignette(false);

        phaseRef.current = "syncing";
        setPhase("syncing");
    }, [blockTime, createNodes]);

    /* ── Pointer events ── */
    const handlePointerMove = useCallback((e: React.PointerEvent | PointerEvent) => {
        const field = fieldRef.current;
        if (!field) return;
        const rect = field.getBoundingClientRect();
        pointerRef.current = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        };
    }, []);

    /* ── Keyboard fallback ── */
    useEffect(() => {
        if (!isOpen) return;
        const onDown = (e: KeyboardEvent) => {
            if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
                e.preventDefault();
                keysRef.current.add(e.key);
            }
        };
        const onUp = (e: KeyboardEvent) => { keysRef.current.delete(e.key); };
        window.addEventListener("keydown", onDown);
        window.addEventListener("keyup", onUp);
        return () => {
            window.removeEventListener("keydown", onDown);
            window.removeEventListener("keyup", onUp);
        };
    }, [isOpen]);

    /* ── Reset on re-open ── */
    useEffect(() => {
        if (isOpen) {
            phaseRef.current = "idle";
            setPhase("idle");
            setShowFailVignette(false);
        }
    }, [isOpen]);

    /* ── Main game loop (requestAnimationFrame) ── */
    useEffect(() => {
        if (phase === "idle" || phase === "success" || phase === "failed") return;

        const loop = (now: number) => {
            const dt = Math.min((now - lastFrameRef.current) / 1000, 0.1);
            lastFrameRef.current = now;

            const field = fieldRef.current;
            if (!field) { rafRef.current = requestAnimationFrame(loop); return; }
            const w = field.clientWidth;
            const h = field.clientHeight;
            const currentPhase = phaseRef.current;
            if (currentPhase === "idle" || currentPhase === "success" || currentPhase === "failed") return;

            /* Keyboard movement */
            const keys = keysRef.current;
            if (keys.has("ArrowUp")) pointerRef.current.y -= KEYBOARD_STEP;
            if (keys.has("ArrowDown")) pointerRef.current.y += KEYBOARD_STEP;
            if (keys.has("ArrowLeft")) pointerRef.current.x -= KEYBOARD_STEP;
            if (keys.has("ArrowRight")) pointerRef.current.x += KEYBOARD_STEP;
            pointerRef.current.x = clamp(pointerRef.current.x, 0, w);
            pointerRef.current.y = clamp(pointerRef.current.y, 0, h);

            /* Crosshair lerp toward pointer */
            const lerp = isSabotaged ? LERP_SABOTAGED : LERP_NORMAL;
            crosshairRef.current.x += (pointerRef.current.x - crosshairRef.current.x) * lerp;
            crosshairRef.current.y += (pointerRef.current.y - crosshairRef.current.y) * lerp;

            /* Update nodes */
            const t = now / 1000;
            const nodes = nodesRef.current;
            let sumWx = 0, sumWy = 0, sumW = 0;

            for (const node of nodes) {
                if (node.isMalicious) {
                    const dx = node.x - targetRef.current.x;
                    const dy = node.y - targetRef.current.y;
                    const dist = Math.hypot(dx, dy) || 1;
                    node.vx += (dx / dist) * 0.3;
                    node.vy += (dy / dist) * 0.3;
                    node.vx += (Math.random() - 0.5) * 1.5;
                    node.vy += (Math.random() - 0.5) * 1.5;
                    node.vx *= 0.94;
                    node.vy *= 0.94;
                    node.x += node.vx * dt * 30;
                    node.y += node.vy * dt * 30;
                } else {
                    const noise_x = pseudoNoise(t, node.phaseX, node.freqX);
                    const noise_y = pseudoNoise(t, node.phaseY, node.freqY);
                    node.x += noise_x * 0.6;
                    node.y += noise_y * 0.6;
                }
                node.x = clamp(node.x, 20, w - 20);
                node.y = clamp(node.y, 20, h - 20);

                if (!node.isMalicious) {
                    sumWx += node.x * node.weight;
                    sumWy += node.y * node.weight;
                    sumW += node.weight;
                }
            }

            /* Consensus target = weighted mean of honest nodes */
            if (sumW > 0) {
                targetRef.current.x = sumWx / sumW;
                targetRef.current.y = sumWy / sumW;
            }

            /* Alignment check */
            const dist = Math.hypot(
                crosshairRef.current.x - targetRef.current.x,
                crosshairRef.current.y - targetRef.current.y
            );
            const isAligned = dist < OVERLAP_RADIUS;

            if (isAligned) {
                alignedSecondsRef.current += dt;
                if (alignedSecondsRef.current >= ALIGNMENT_DURATION) {
                    // Block finalized!
                    const blockTimeTaken = (now - currentBlockStartRef.current) / 1000;
                    blockTimesRef.current.push(blockTimeTaken);
                    blocksFinalizedRef.current += 1;

                    if (blocksFinalizedRef.current >= blocksRequired) {
                        // SUCCESS — task completed
                        phaseRef.current = "success";
                        setPhase("success");
                        setBlocksFinalized(blocksFinalizedRef.current);
                        handleComplete();
                        return;
                    }

                    // Flash + toast, then reset for next block
                    setShowFlash(true);
                    setShowBlockToast(true);
                    setBlocksFinalized(blocksFinalizedRef.current);
                    setTimeout(() => setShowFlash(false), 800);
                    setTimeout(() => setShowBlockToast(false), 1200);

                    alignedSecondsRef.current = 0;
                    blockTimerRef.current = blockTime;
                    currentBlockStartRef.current = now;
                }
            } else {
                alignedSecondsRef.current = Math.max(0, alignedSecondsRef.current - dt * DRAIN_RATE);
            }

            /* Block timer countdown */
            blockTimerRef.current -= dt;
            if (blockTimerRef.current <= 0) {
                phaseRef.current = "failed";
                setPhase("failed");
                setShowFailVignette(true);
                return;
            }

            /* Sync to React state periodically (avoids per-frame re-renders) */
            if (now - uiSyncRef.current > UI_SYNC_INTERVAL) {
                uiSyncRef.current = now;
                setBlockTimerDisplay(Math.ceil(blockTimerRef.current));
                setAlignPct(Math.min(1, alignedSecondsRef.current / ALIGNMENT_DURATION));
                setCrosshairPos({ x: crosshairRef.current.x, y: crosshairRef.current.y });
                setTargetPos({ x: targetRef.current.x, y: targetRef.current.y });
                setNodePositions(nodes.map(n => ({ x: n.x, y: n.y, isMalicious: n.isMalicious })));

                // Compute mesh lines
                const lines: { x1: number; y1: number; x2: number; y2: number; opacity: number }[] = [];
                for (let i = 0; i < nodes.length; i++) {
                    for (let j = i + 1; j < nodes.length; j++) {
                        const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
                        if (d < MESH_MAX_DISTANCE) {
                            lines.push({
                                x1: nodes[i].x, y1: nodes[i].y,
                                x2: nodes[j].x, y2: nodes[j].y,
                                opacity: 0.15 * (1 - d / MESH_MAX_DISTANCE),
                            });
                        }
                    }
                }
                setMeshLines(lines);
            }

            rafRef.current = requestAnimationFrame(loop);
        };

        rafRef.current = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(rafRef.current);
    }, [phase, isSabotaged, blockTime, blocksRequired, handleComplete]);

    if (!isOpen) return null;

    const timerStr = `00:${String(Math.max(0, blockTimerDisplay)).padStart(2, "0")}`;

    // ─── Render ──────────────────────────────────────────────────────────────

    return (
        <div style={styles.overlay}>
            <style>{CSS_KEYFRAMES}</style>

            <div style={styles.modal}>
                <button style={styles.closeBtn} onClick={onClose}>✕</button>

                {/* Star field */}
                <div style={styles.starField}>
                    {stars.map((s, i) => (
                        <div key={i} style={{
                            position: "absolute", width: 1.5, height: 1.5,
                            background: "#fff", borderRadius: "50%",
                            left: s.left, top: s.top, opacity: s.opacity,
                        }} />
                    ))}
                </div>

                {/* ═══ IDLE SCREEN ═══ */}
                {phase === "idle" && !isComplete && (
                    <div style={styles.idleOverlay}>
                        <div style={styles.idleTitle}>CONSENSUS ALIGNMENT</div>
                        <div style={styles.idleDesc}>
                            Blockchain networks like Ethereum use validator consensus to agree on the
                            next block. Honest validators must coordinate despite network delays and
                            malicious actors trying to fork the chain. Byzantine Fault Tolerance
                            ensures the network stays secure as long as over 66% of validators are
                            honest.
                        </div>
                        <div style={styles.idleInstructions}>
                            Drag your <span style={{ color: "#00e676", fontWeight: 700 }}>crosshair</span> to
                            overlap the <span style={{ color: "#ffd740", fontWeight: 700 }}>golden consensus target</span> for
                            3 seconds to finalize each block. Finalize {blocksRequired} blocks to complete.
                            {isSabotaged && (
                                <span style={{ color: "#ff1744" }}> ⚠ Malicious validators are disrupting the network!</span>
                            )}
                        </div>
                        <button style={styles.startBtn} onClick={startGame}>SYNC NODE</button>
                    </div>
                )}

                {/* ═══ ALREADY COMPLETED ═══ */}
                {phase === "idle" && isComplete && (
                    <div style={styles.idleOverlay}>
                        <div style={{ ...styles.idleTitle, color: "#00e676" }}>✓ TASK COMPLETED</div>
                        <div style={styles.idleDesc}>Consensus alignment already achieved.</div>
                    </div>
                )}

                {/* ═══ SUCCESS SCREEN ═══ */}
                {phase === "success" && (
                    <div style={styles.idleOverlay}>
                        <div style={{ ...styles.idleTitle, color: "#00e676" }}>✓ CONSENSUS ACHIEVED</div>
                        <div style={styles.idleDesc}>
                            All {blocksRequired} blocks finalized successfully. The chain remains secure.
                        </div>
                    </div>
                )}

                {/* ═══ FAILED SCREEN ═══ */}
                {phase === "failed" && (
                    <div style={styles.idleOverlay}>
                        <div style={{ ...styles.idleTitle, color: "#ff1744" }}>✕ SYNC LOST</div>
                        <div style={styles.idleDesc}>
                            Block timer expired before consensus was reached. The chain has forked.
                        </div>
                        <button style={styles.startBtn} onClick={startGame}>RETRY</button>
                    </div>
                )}

                {/* ═══ HUD TOP ═══ */}
                {phase === "syncing" && (
                    <div style={styles.hudTop}>
                        <span style={styles.hudTitle}>CONSENSUS ALIGNMENT</span>
                        <div>
                            <span style={styles.hudLabel}>Block </span>
                            <span style={{ ...styles.hudValue, color: "#ffd740" }}>
                                #{baseBlock + blocksFinalized}
                            </span>
                        </div>
                        <div>
                            <span style={styles.hudLabel}>Timer </span>
                            <span style={{
                                ...styles.hudValue,
                                color: blockTimerDisplay <= 3 ? "#ff1744" : "#e0ecf8",
                            }}>{timerStr}</span>
                        </div>
                        <div>
                            <span style={styles.hudLabel}>Finalized </span>
                            <span style={{ ...styles.hudValue, color: "#00e676" }}>
                                {blocksFinalized}/{blocksRequired}
                            </span>
                        </div>
                        <div>
                            <span style={styles.hudLabel}>Validator </span>
                            <span style={styles.hudValue}>{validatorAddr}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={styles.hudLabel}>REP</span>
                            <div style={styles.repBar}>
                                <div style={{
                                    ...styles.repFill,
                                    width: `${Math.max(0, (blockTimerDisplay / blockTime) * 100)}%`,
                                }} />
                            </div>
                        </div>
                    </div>
                )}

                {/* ═══ PLAY FIELD ═══ */}
                <div
                    ref={fieldRef}
                    style={styles.field}
                    onPointerMove={handlePointerMove as any}
                    onPointerDown={handlePointerMove as any}
                >
                    {/* Mesh lines */}
                    {phase === "syncing" && (
                        <svg style={styles.meshSvg}>
                            {meshLines.map((l, i) => (
                                <line
                                    key={i}
                                    x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
                                    stroke="rgba(40,180,255,0.15)"
                                    strokeWidth={1}
                                    opacity={l.opacity / 0.15}
                                />
                            ))}
                        </svg>
                    )}

                    {/* Validator nodes */}
                    {phase === "syncing" && nodePositions.map((n, i) => (
                        <div
                            key={i}
                            className={n.isMalicious ? "ca-node-mal" : ""}
                            style={{
                                position: "absolute",
                                width: 16, height: 16,
                                borderRadius: "50%",
                                transform: "translate(-50%, -50%)",
                                pointerEvents: "none" as const,
                                left: n.x, top: n.y,
                                background: n.isMalicious ? "#ff1744" : "#29b6f6",
                                boxShadow: n.isMalicious
                                    ? "0 0 8px #ff1744, 0 0 20px rgba(255,23,68,0.3)"
                                    : "0 0 8px #29b6f6, 0 0 20px rgba(41,182,246,0.25)",
                            }}
                        />
                    ))}

                    {/* Consensus target (gold, pulsing) */}
                    {phase === "syncing" && (
                        <div
                            className="ca-target-pulse"
                            style={{
                                position: "absolute",
                                width: 28, height: 28,
                                borderRadius: "50%",
                                background: "radial-gradient(circle, #ffd740 30%, rgba(255,215,64,0.3) 70%, transparent 100%)",
                                boxShadow: "0 0 16px #ffd740, 0 0 40px rgba(255,215,64,0.3)",
                                transform: "translate(-50%, -50%)",
                                pointerEvents: "none" as const,
                                left: targetPos.x, top: targetPos.y,
                            }}
                        />
                    )}

                    {/* Alignment ring (fills clockwise during overlap) */}
                    {phase === "syncing" && alignPct > 0 && (
                        <svg
                            style={{
                                position: "absolute",
                                width: 64, height: 64,
                                transform: "translate(-50%, -50%)",
                                pointerEvents: "none" as const,
                                left: targetPos.x, top: targetPos.y,
                            }}
                            viewBox="0 0 64 64"
                        >
                            <circle cx="32" cy="32" r="28" fill="none"
                                stroke="rgba(0,230,118,0.2)" strokeWidth="3" />
                            <circle cx="32" cy="32" r="28" fill="none"
                                stroke="#00e676" strokeWidth="3"
                                strokeDasharray={`${28 * 2 * Math.PI}`}
                                strokeDashoffset={`${28 * 2 * Math.PI * (1 - alignPct)}`}
                                strokeLinecap="round"
                                transform="rotate(-90 32 32)"
                                style={{ filter: "drop-shadow(0 0 4px #00e676)", transition: "stroke-dashoffset 0.08s linear" }}
                            />
                        </svg>
                    )}

                    {/* Player crosshair (green SVG +) */}
                    {phase === "syncing" && (
                        <svg
                            style={{
                                position: "absolute",
                                width: 32, height: 32,
                                transform: "translate(-50%, -50%)",
                                pointerEvents: "none" as const,
                                left: crosshairPos.x, top: crosshairPos.y,
                                filter: "drop-shadow(0 0 6px #00e676)",
                            }}
                            viewBox="0 0 32 32"
                        >
                            <line x1="2" y1="16" x2="14" y2="16" stroke="#00e676" strokeWidth="2.5" strokeLinecap="round" />
                            <line x1="18" y1="16" x2="30" y2="16" stroke="#00e676" strokeWidth="2.5" strokeLinecap="round" />
                            <line x1="16" y1="2" x2="16" y2="14" stroke="#00e676" strokeWidth="2.5" strokeLinecap="round" />
                            <line x1="16" y1="18" x2="16" y2="30" stroke="#00e676" strokeWidth="2.5" strokeLinecap="round" />
                            <circle cx="16" cy="16" r="2.5" fill="#00e676" />
                        </svg>
                    )}
                </div>

                {/* ═══ HUD BOTTOM ═══ */}
                {phase === "syncing" && (
                    <div style={styles.hudBottom}>
                        <span style={{ ...styles.hudLabel, whiteSpace: "nowrap" as const }}>CONSENSUS</span>
                        <div style={styles.consensusBar}>
                            <div style={{ ...styles.consensusFill, width: `${alignPct * 100}%` }} />
                        </div>
                        <span style={{ ...styles.hudValue, fontSize: 12, minWidth: 36, textAlign: "right" as const }}>
                            {Math.round(alignPct * 100)}%
                        </span>
                        {isSabotaged && (
                            <span style={{
                                color: "#ff1744", fontSize: 11,
                                fontFamily: "'Orbitron', sans-serif", letterSpacing: 1,
                            }}>
                                ⚠ MALICIOUS NODES
                            </span>
                        )}
                    </div>
                )}

                {/* Educational tooltip (dismissable) */}
                {phase === "syncing" && showTooltip && (
                    <div style={styles.tooltip} onClick={() => setShowTooltip(false)}>
                        <strong style={{ color: "#00e5ff" }}>Byzantine Fault Tolerance:</strong> The
                        network stays secure as long as &gt;66% of validators are honest. Align with
                        the honest majority to finalize each block.
                        <div style={styles.tooltipDismiss}>Click to dismiss</div>
                    </div>
                )}

                {/* Block finalized flash */}
                {showFlash && <div className="ca-flash-anim" style={styles.flash} />}
                {showBlockToast && <div className="ca-toast-anim" style={styles.blockToast}>+1 BLOCK</div>}
                {showFailVignette && <div className="ca-vignette-anim" style={styles.failVignette} />}

                {/* Completed badge */}
                {completedTasks && completedTasks[TASK_ID] && (
                    <div style={styles.completedBadge}>✓ COMPLETED</div>
                )}
            </div>
        </div>
    );
}

// ─── CSS Keyframes ────────────────────────────────────────────────────────────

const CSS_KEYFRAMES = `
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Share+Tech+Mono&display=swap');

.ca-target-pulse {
    animation: caPulse 1.8s ease-in-out infinite;
}
@keyframes caPulse {
    0%, 100% { transform: translate(-50%, -50%) scale(1); }
    50% { transform: translate(-50%, -50%) scale(1.3); }
}

.ca-node-mal {
    animation: caGlitch 0.4s infinite alternate;
}
@keyframes caGlitch {
    0% { transform: translate(-50%, -50%) translateX(0); }
    25% { transform: translate(-50%, -50%) translateX(3px); }
    50% { transform: translate(-50%, -50%) translateX(-2px) translateY(1px); }
    75% { transform: translate(-50%, -50%) translateX(1px) translateY(-2px); }
    100% { transform: translate(-50%, -50%) translateX(-3px); }
}

.ca-flash-anim {
    animation: caFlash 0.8s ease-out forwards;
}
@keyframes caFlash {
    0% { opacity: 1; }
    100% { opacity: 0; }
}

.ca-toast-anim {
    animation: caRiseOut 1.2s ease-out forwards;
}
@keyframes caRiseOut {
    0% { opacity: 1; transform: translateX(-50%) translateY(0); }
    100% { opacity: 0; transform: translateX(-50%) translateY(-60px); }
}

.ca-vignette-anim {
    animation: caVignetteIn 1s ease-in forwards;
}
@keyframes caVignetteIn {
    0% { opacity: 0; }
    100% { opacity: 1; }
}
`;

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
        background: "#060910",
        padding: 0,
        borderRadius: 12,
        border: "2px solid rgba(0,229,255,0.15)",
        width: "95%",
        maxWidth: 680,
        height: "85vh",
        maxHeight: 600,
        position: "relative",
        overflow: "hidden",
        boxShadow: "0 0 40px rgba(0,229,255,0.08)",
    },
    closeBtn: {
        position: "absolute",
        top: 10,
        right: 10,
        background: "rgba(0,0,0,0.5)",
        border: "1px solid rgba(0,229,255,0.3)",
        color: "#00e5ff",
        borderRadius: "50%",
        width: 32,
        height: 32,
        cursor: "pointer",
        zIndex: 40,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 18,
    },
    starField: {
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
    },

    // Idle / overlay screens
    idleOverlay: {
        position: "absolute",
        inset: 0,
        zIndex: 30,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(6,9,16,0.92)",
        backdropFilter: "blur(8px)",
        padding: "24px",
    },
    idleTitle: {
        fontFamily: "'Orbitron', sans-serif",
        fontSize: 24,
        fontWeight: 900,
        letterSpacing: 4,
        textTransform: "uppercase",
        marginBottom: 16,
        color: "#00e5ff",
        textAlign: "center",
    },
    idleDesc: {
        fontSize: 12,
        maxWidth: 440,
        textAlign: "center",
        lineHeight: 1.7,
        color: "#7a9ab8",
        marginBottom: 16,
    },
    idleInstructions: {
        fontSize: 12,
        maxWidth: 440,
        textAlign: "center",
        lineHeight: 1.7,
        color: "#c0d8f0",
        marginBottom: 24,
    },
    startBtn: {
        fontFamily: "'Orbitron', sans-serif",
        fontWeight: 700,
        fontSize: 14,
        letterSpacing: 2,
        textTransform: "uppercase",
        padding: "12px 36px",
        border: "2px solid #00e5ff",
        borderRadius: 8,
        background: "rgba(0,229,255,0.08)",
        color: "#00e5ff",
        cursor: "pointer",
    },

    // HUD
    hudTop: {
        position: "absolute",
        left: 0, right: 0, top: 0,
        zIndex: 20,
        padding: "8px 14px",
        background: "rgba(13,27,42,0.85)",
        backdropFilter: "blur(6px)",
        borderBottom: "1px solid rgba(0,229,255,0.15)",
        display: "flex",
        alignItems: "center",
        gap: 14,
        flexWrap: "wrap",
    },
    hudBottom: {
        position: "absolute",
        left: 0, right: 0, bottom: 0,
        zIndex: 20,
        padding: "8px 14px",
        background: "rgba(13,27,42,0.85)",
        backdropFilter: "blur(6px)",
        borderTop: "1px solid rgba(0,229,255,0.15)",
        display: "flex",
        alignItems: "center",
        gap: 14,
    },
    hudTitle: {
        fontFamily: "'Orbitron', sans-serif",
        fontWeight: 700,
        fontSize: 12,
        color: "#00e5ff",
        letterSpacing: 2,
        textTransform: "uppercase",
    },
    hudLabel: {
        fontSize: 10,
        color: "#5a7a99",
        textTransform: "uppercase",
        letterSpacing: 1,
    },
    hudValue: {
        fontFamily: "'Orbitron', sans-serif",
        fontSize: 13,
        color: "#e0ecf8",
        fontWeight: 700,
    },
    repBar: {
        width: 70,
        height: 7,
        background: "rgba(255,255,255,0.08)",
        borderRadius: 4,
        overflow: "hidden",
    },
    repFill: {
        height: "100%",
        background: "linear-gradient(90deg, #00e676, #29b6f6)",
        borderRadius: 4,
        transition: "width 0.3s",
    },
    consensusBar: {
        flex: 1,
        minWidth: 100,
        maxWidth: 280,
        height: 12,
        background: "rgba(255,255,255,0.06)",
        borderRadius: 6,
        border: "1px solid rgba(0,229,255,0.12)",
        overflow: "hidden",
    },
    consensusFill: {
        height: "100%",
        background: "linear-gradient(90deg, #00e676, #ffd740)",
        borderRadius: 6,
        transition: "width 0.08s linear",
    },

    // Play field
    field: {
        position: "absolute",
        top: 46,
        bottom: 42,
        left: 0,
        right: 0,
        cursor: "crosshair",
    },
    meshSvg: {
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
    },

    // Tooltip
    tooltip: {
        position: "absolute",
        bottom: 50,
        left: 14,
        right: 14,
        zIndex: 22,
        background: "rgba(13,27,42,0.9)",
        border: "1px solid rgba(0,229,255,0.15)",
        borderRadius: 8,
        padding: "10px 14px",
        fontSize: 11,
        lineHeight: 1.6,
        color: "#7a9ab8",
        cursor: "pointer",
    },
    tooltipDismiss: {
        color: "#00e5ff",
        fontSize: 10,
        marginTop: 4,
        opacity: 0.7,
    },

    // Effects
    flash: {
        position: "absolute",
        inset: 0,
        zIndex: 25,
        pointerEvents: "none",
        background: "rgba(255,215,64,0.15)",
    },
    blockToast: {
        position: "absolute",
        top: "40%",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 26,
        fontFamily: "'Orbitron', sans-serif",
        fontSize: 28,
        fontWeight: 900,
        color: "#ffd740",
        textShadow: "0 0 30px rgba(255,215,64,0.6)",
        pointerEvents: "none",
    },
    failVignette: {
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 24,
        background: "radial-gradient(ellipse at center, transparent 40%, rgba(255,23,68,0.3) 100%)",
    },
    completedBadge: {
        position: "absolute",
        top: 10,
        left: 10,
        zIndex: 35,
        fontFamily: "'Orbitron', sans-serif",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 2,
        color: "#00e676",
        background: "rgba(0,230,118,0.1)",
        border: "1px solid rgba(0,230,118,0.3)",
        borderRadius: 4,
        padding: "4px 10px",
    },
};
