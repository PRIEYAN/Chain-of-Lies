// ============================================================================
// TYPES
// ============================================================================

export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

// ============================================================================
// MAP DIMENSIONS
// ============================================================================

export const MAP_WIDTH = 2800;
export const MAP_HEIGHT = 1800;

// ============================================================================
// ROOMS
// ============================================================================

export const rooms: Rect[] = [
  // Cafeteria (top left)
  {
    x: 100,
    y: 100,
    width: 450,
    height: 350,
  },
  
  // Weapons (top center)
  {
    x: 700,
    y: 100,
    width: 400,
    height: 300,
  },
  
  // Navigation (top right)
  {
    x: 1250,
    y: 100,
    width: 350,
    height: 300,
  },
  
  // Shields (far right top)
  {
    x: 1750,
    y: 100,
    width: 350,
    height: 350,
  },
  
  // O2 (right side middle)
  {
    x: 2250,
    y: 100,
    width: 450,
    height: 400,
  },
  
  // Admin (center)
  {
    x: 1100,
    y: 600,
    width: 500,
    height: 400,
  },
  
  // Storage (left middle)
  {
    x: 100,
    y: 600,
    width: 400,
    height: 350,
  },
  
  // Electrical (bottom left)
  {
    x: 100,
    y: 1100,
    width: 400,
    height: 350,
  },
  
  // Lower Engine (bottom center-left)
  {
    x: 650,
    y: 1200,
    width: 350,
    height: 450,
  },
  
  // Security (bottom center)
  {
    x: 1150,
    y: 1200,
    width: 400,
    height: 350,
  },
  
  // Reactor (bottom center-right)
  {
    x: 1700,
    y: 1150,
    width: 400,
    height: 500,
  },
  
  // Upper Engine (right side bottom)
  {
    x: 2250,
    y: 650,
    width: 450,
    height: 450,
  },
  
  // Medbay (far right bottom)
  {
    x: 2250,
    y: 1250,
    width: 450,
    height: 400,
  },
];

// ============================================================================
// CORRIDORS
// ============================================================================

export const corridors: Rect[] = [
  // Top horizontal hallway (connecting Cafeteria -> Weapons -> Navigation -> Shields -> O2)
  {
    x: 550,
    y: 200,
    width: 150,
    height: 120,
  },
  {
    x: 1100,
    y: 200,
    width: 150,
    height: 120,
  },
  {
    x: 1600,
    y: 200,
    width: 150,
    height: 120,
  },
  {
    x: 2100,
    y: 250,
    width: 150,
    height: 120,
  },
  
  // Cafeteria to Storage vertical
  {
    x: 250,
    y: 450,
    width: 120,
    height: 150,
  },
  
  // Weapons to Admin vertical
  {
    x: 850,
    y: 400,
    width: 120,
    height: 200,
  },
  
  // Navigation to Admin vertical
  {
    x: 1350,
    y: 400,
    width: 120,
    height: 200,
  },
  
  // Shields to Admin vertical
  {
    x: 1850,
    y: 450,
    width: 120,
    height: 150,
  },
  
  // O2 to Upper Engine vertical
  {
    x: 2400,
    y: 500,
    width: 120,
    height: 150,
  },
  
  // Storage to Admin horizontal
  {
    x: 500,
    y: 750,
    width: 600,
    height: 120,
  },
  
  // Admin to Upper Engine horizontal
  {
    x: 1600,
    y: 800,
    width: 650,
    height: 120,
  },
  
  // Storage to Electrical vertical
  {
    x: 250,
    y: 950,
    width: 120,
    height: 150,
  },
  
  // Electrical to Lower Engine horizontal
  {
    x: 500,
    y: 1250,
    width: 150,
    height: 120,
  },
  
  // Lower Engine to Security horizontal
  {
    x: 1000,
    y: 1300,
    width: 150,
    height: 120,
  },
  
  // Security to Reactor horizontal
  {
    x: 1550,
    y: 1300,
    width: 150,
    height: 120,
  },
  
  // Admin to Security vertical
  {
    x: 1300,
    y: 1000,
    width: 120,
    height: 200,
  },
  
  // Admin to Reactor vertical
  {
    x: 1850,
    y: 1000,
    width: 120,
    height: 150,
  },
  
  // Reactor to Medbay horizontal
  {
    x: 2100,
    y: 1350,
    width: 150,
    height: 120,
  },
  
  // Upper Engine to Medbay vertical
  {
    x: 2400,
    y: 1100,
    width: 120,
    height: 150,
  },
];

// ============================================================================
// WALLS
// ============================================================================

export const walls: Rect[] = [
  // Outer boundary walls
  // Top wall
  {
    x: 0,
    y: 0,
    width: MAP_WIDTH,
    height: 50,
  },
  
  // Bottom wall
  {
    x: 0,
    y: MAP_HEIGHT - 50,
    width: MAP_WIDTH,
    height: 50,
  },
  
  // Left wall
  {
    x: 0,
    y: 0,
    width: 50,
    height: MAP_HEIGHT,
  },
  
  // Right wall
  {
    x: MAP_WIDTH - 50,
    y: 0,
    width: 50,
    height: MAP_HEIGHT,
  },
  
  // Cafeteria interior obstacles
  {
    x: 200,
    y: 200,
    width: 150,
    height: 40,
  },
  {
    x: 380,
    y: 300,
    width: 40,
    height: 100,
  },
  {
    x: 150,
    y: 350,
    width: 120,
    height: 35,
  },
  
  // Weapons interior obstacles
  {
    x: 800,
    y: 180,
    width: 180,
    height: 40,
  },
  {
    x: 900,
    y: 280,
    width: 40,
    height: 80,
  },
  
  // Navigation interior obstacles
  {
    x: 1350,
    y: 200,
    width: 150,
    height: 40,
  },
  {
    x: 1450,
    y: 300,
    width: 40,
    height: 70,
  },
  
  // Shields interior obstacles
  {
    x: 1850,
    y: 200,
    width: 120,
    height: 40,
  },
  {
    x: 1950,
    y: 300,
    width: 40,
    height: 100,
  },
  
  // O2 interior obstacles
  {
    x: 2350,
    y: 200,
    width: 200,
    height: 45,
  },
  {
    x: 2500,
    y: 350,
    width: 40,
    height: 100,
  },
  
  // Admin interior obstacles
  {
    x: 1250,
    y: 700,
    width: 150,
    height: 40,
  },
  {
    x: 1400,
    y: 850,
    width: 120,
    height: 40,
  },
  {
    x: 1350,
    y: 800,
    width: 40,
    height: 100,
  },
  
  // Storage interior obstacles
  {
    x: 200,
    y: 700,
    width: 100,
    height: 80,
  },
  {
    x: 350,
    y: 800,
    width: 80,
    height: 60,
  },
  
  // Electrical interior obstacles
  {
    x: 200,
    y: 1200,
    width: 120,
    height: 40,
  },
  {
    x: 350,
    y: 1300,
    width: 40,
    height: 100,
  },
  
  // Lower Engine interior obstacles
  {
    x: 750,
    y: 1300,
    width: 150,
    height: 150,
  },
  {
    x: 700,
    y: 1500,
    width: 40,
    height: 100,
  },
  
  // Security interior obstacles
  {
    x: 1250,
    y: 1300,
    width: 150,
    height: 40,
  },
  {
    x: 1400,
    y: 1400,
    width: 40,
    height: 100,
  },
  
  // Reactor interior obstacles
  {
    x: 1800,
    y: 1250,
    width: 180,
    height: 180,
  },
  {
    x: 1950,
    y: 1500,
    width: 40,
    height: 100,
  },
  
  // Upper Engine interior obstacles
  {
    x: 2350,
    y: 750,
    width: 200,
    height: 150,
  },
  {
    x: 2500,
    y: 950,
    width: 40,
    height: 100,
  },
  
  // Medbay interior obstacles
  {
    x: 2350,
    y: 1350,
    width: 150,
    height: 40,
  },
  {
    x: 2550,
    y: 1450,
    width: 40,
    height: 120,
  },
];

// ============================================================================
// TASK ZONES
// ============================================================================

export const taskZones: Rect[] = [
  // Cafeteria task
  {
    x: 450,
    y: 250,
    width: 60,
    height: 60,
  },
  
  // Weapons task
  {
    x: 950,
    y: 200,
    width: 60,
    height: 60,
  },
  
  // Navigation task
  {
    x: 1500,
    y: 250,
    width: 60,
    height: 60,
  },
  
  // Shields task
  {
    x: 2000,
    y: 250,
    width: 60,
    height: 60,
  },
  
  // O2 task
  {
    x: 2600,
    y: 250,
    width: 60,
    height: 60,
  },
  
  // Admin task
  {
    x: 1450,
    y: 750,
    width: 60,
    height: 60,
  },
  
  // Storage task
  {
    x: 250,
    y: 850,
    width: 60,
    height: 60,
  },
  
  // Electrical task
  {
    x: 250,
    y: 1350,
    width: 60,
    height: 60,
  },
  
  // Lower Engine task
  {
    x: 850,
    y: 1500,
    width: 60,
    height: 60,
  },
  
  // Security task
  {
    x: 1300,
    y: 1450,
    width: 60,
    height: 60,
  },
  
  // Reactor task
  {
    x: 1850,
    y: 1500,
    width: 60,
    height: 60,
  },
  
  // Upper Engine task
  {
    x: 2600,
    y: 850,
    width: 60,
    height: 60,
  },
  
  // Medbay task
  {
    x: 2450,
    y: 1500,
    width: 60,
    height: 60,
  },
];

// ============================================================================
// SPAWN POINTS
// ============================================================================

export const spawnPoints: { x: number; y: number }[] = [
  // Cafeteria center spawns
  { x: 278, y: 264 },
  { x: 263, y: 249 },
  { x: 293, y: 249 },
  { x: 248, y: 264 },
  { x: 308, y: 264 },
  { x: 263, y: 279 },
  { x: 293, y: 279 },
  { x: 278, y: 294 },
  { x: 253, y: 239 },
  { x: 303, y: 239 },
  { x: 253, y: 289 },
  { x: 303, y: 289 },
];