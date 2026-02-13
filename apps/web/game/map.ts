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

export const MAP_WIDTH = 2400;
export const MAP_HEIGHT = 1600;

// ============================================================================
// ROOMS
// ============================================================================

export const rooms: Rect[] = [
  // Central Hub (large central room)
  {
    x: 900,
    y: 600,
    width: 600,
    height: 400,
  },
  
  // Cafeteria (top left)
  {
    x: 200,
    y: 200,
    width: 400,
    height: 300,
  },
  
  // Medbay (top right)
  {
    x: 1800,
    y: 200,
    width: 400,
    height: 300,
  },
  
  // Engine Room Left (left side)
  {
    x: 100,
    y: 800,
    width: 350,
    height: 400,
  },
  
  // Engine Room Right (right side)
  {
    x: 1950,
    y: 800,
    width: 350,
    height: 400,
  },
  
  // Security (bottom left)
  {
    x: 700,
    y: 1200,
    width: 350,
    height: 300,
  },
  
  // Electrical (bottom right)
  {
    x: 1350,
    y: 1200,
    width: 350,
    height: 300,
  },
  
  // Storage (top center)
  {
    x: 1000,
    y: 100,
    width: 400,
    height: 300,
  },
];

// ============================================================================
// CORRIDORS
// ============================================================================

export const corridors: Rect[] = [
  // Horizontal corridor connecting Cafeteria to Central Hub
  {
    x: 600,
    y: 700,
    width: 300,
    height: 120,
  },
  
  // Horizontal corridor connecting Central Hub to Medbay
  {
    x: 1500,
    y: 700,
    width: 300,
    height: 120,
  },
  
  // Vertical corridor from Cafeteria to Storage
  {
    x: 700,
    y: 400,
    width: 120,
    height: 300,
  },
  
  // Vertical corridor from Storage to Central Hub
  {
    x: 1100,
    y: 400,
    width: 120,
    height: 200,
  },
  
  // Vertical corridor from Medbay down
  {
    x: 1900,
    y: 500,
    width: 120,
    height: 300,
  },
  
  // Horizontal corridor connecting Engine Room Left to Central Hub
  {
    x: 450,
    y: 900,
    width: 450,
    height: 120,
  },
  
  // Horizontal corridor connecting Central Hub to Engine Room Right
  {
    x: 1500,
    y: 900,
    width: 450,
    height: 120,
  },
  
  // Vertical corridor from Central Hub to Security
  {
    x: 850,
    y: 1000,
    width: 120,
    height: 200,
  },
  
  // Vertical corridor from Central Hub to Electrical
  {
    x: 1430,
    y: 1000,
    width: 120,
    height: 200,
  },
  
  // Horizontal corridor connecting Security to Electrical
  {
    x: 1050,
    y: 1300,
    width: 300,
    height: 120,
  },
];

// ============================================================================
// WALLS
// ============================================================================

export const walls: Rect[] = [
  // Outer boundary walls (thick borders)
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
  
  // Interior obstacle walls in Cafeteria
  {
    x: 250,
    y: 280,
    width: 120,
    height: 30,
  },
  {
    x: 450,
    y: 350,
    width: 30,
    height: 100,
  },
  
  // Interior obstacle walls in Medbay
  {
    x: 1900,
    y: 250,
    width: 150,
    height: 30,
  },
  {
    x: 2050,
    y: 350,
    width: 30,
    height: 100,
  },
  
  // Interior obstacle walls in Central Hub
  {
    x: 1050,
    y: 700,
    width: 100,
    height: 30,
  },
  {
    x: 1250,
    y: 850,
    width: 100,
    height: 30,
  },
  {
    x: 1100,
    y: 800,
    width: 30,
    height: 80,
  },
  
  // Interior obstacle walls in Engine Room Left
  {
    x: 180,
    y: 900,
    width: 80,
    height: 30,
  },
  {
    x: 300,
    y: 1000,
    width: 30,
    height: 120,
  },
  
  // Interior obstacle walls in Engine Room Right
  {
    x: 2100,
    y: 900,
    width: 80,
    height: 30,
  },
  {
    x: 2070,
    y: 1000,
    width: 30,
    height: 120,
  },
  
  // Interior obstacle walls in Security
  {
    x: 800,
    y: 1280,
    width: 100,
    height: 30,
  },
  {
    x: 900,
    y: 1350,
    width: 30,
    height: 80,
  },
  
  // Interior obstacle walls in Electrical
  {
    x: 1500,
    y: 1280,
    width: 100,
    height: 30,
  },
  {
    x: 1550,
    y: 1350,
    width: 30,
    height: 80,
  },
  
  // Interior obstacle walls in Storage
  {
    x: 1100,
    y: 180,
    width: 120,
    height: 30,
  },
  {
    x: 1250,
    y: 250,
    width: 30,
    height: 100,
  },
];

// ============================================================================
// TASK ZONES
// ============================================================================

export const taskZones: Rect[] = [
  // Task in Cafeteria
  {
    x: 520,
    y: 240,
    width: 60,
    height: 60,
  },
  
  // Task in Medbay
  {
    x: 1850,
    y: 380,
    width: 60,
    height: 60,
  },
  
  // Task in Central Hub
  {
    x: 1150,
    y: 650,
    width: 60,
    height: 60,
  },
  
  // Task in Engine Room Left
  {
    x: 200,
    y: 1050,
    width: 60,
    height: 60,
  },
  
  // Task in Engine Room Right
  {
    x: 2100,
    y: 1050,
    width: 60,
    height: 60,
  },
  
  // Task in Security
  {
    x: 950,
    y: 1250,
    width: 60,
    height: 60,
  },
  
  // Task in Electrical
  {
    x: 1600,
    y: 1250,
    width: 60,
    height: 60,
  },
  
  // Task in Storage
  {
    x: 1200,
    y: 150,
    width: 60,
    height: 60,
  },
];

// ============================================================================
// SPAWN POINTS
// ============================================================================

export const spawnPoints: { x: number; y: number }[] = [
  // Central Hub spawn points (clear of walls and obstacles)
  { x: 1000, y: 750 },
  { x: 1150, y: 750 },
  { x: 1300, y: 750 },
  { x: 1000, y: 900 },
  { x: 1150, y: 900 },
  { x: 1300, y: 900 },
  { x: 1400, y: 800 },
  { x: 950, y: 800 },
  
  // Additional spawn points in Cafeteria
  { x: 350, y: 350 },
  { x: 500, y: 280 },
  
  // Additional spawn points in Storage
  { x: 1100, y: 250 },
  { x: 1300, y: 200 },
];