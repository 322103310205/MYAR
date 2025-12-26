
let activeDirections = [];
let currentStepIndex = 0;
let currentTargetNode = null;

// Loaded map data
let mapData = null;

// Graph structure: { nodeId: { x, y, neighbors[] } }
let graph = {};

// Current start node (Gate by default)
let startNode = "GATE";

// User heading vector (default: facing into campus)
let userHeading = { x: 0, y: -1 };

/* ---------- MAP LOADING ---------- */

async function loadMap() {
  const response = await fetch("map.json");
  mapData = await response.json();
  buildGraph();
  console.log("Map loaded");
}

function buildGraph() {
  graph = {};
  mapData.nodes.forEach(node => {
    graph[node.id] = {
      x: node.position.x,
      y: node.position.y,
      neighbors: node.connections
    };
  });
}

/* ---------- START NODE HANDLING ---------- */

function setStartNode(nodeId) {
  if (!graph[nodeId]) {
    console.warn("Invalid start node:", nodeId);
    return;
  }
  startNode = nodeId;
  console.log("Start node set to:", startNode);
}

/* ---------- A* PATHFINDING ---------- */

function heuristic(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function aStar(start, goal) {
  const openSet = new Set([start]);
  const cameFrom = {};

  const gScore = {};
  const fScore = {};

  Object.keys(graph).forEach(id => {
    gScore[id] = Infinity;
    fScore[id] = Infinity;
  });

  gScore[start] = 0;
  fScore[start] = heuristic(graph[start], graph[goal]);

  while (openSet.size > 0) {
    let current = [...openSet].reduce((a, b) =>
      fScore[a] < fScore[b] ? a : b
    );

    if (current === goal) {
      return reconstructPath(cameFrom, current);
    }

    openSet.delete(current);

    for (const neighbor of graph[current].neighbors) {
      const tentativeG =
        gScore[current] +
        heuristic(graph[current], graph[neighbor]);

      if (tentativeG < gScore[neighbor]) {
        cameFrom[neighbor] = current;
        gScore[neighbor] = tentativeG;
        fScore[neighbor] =
          tentativeG + heuristic(graph[neighbor], graph[goal]);
        openSet.add(neighbor);
      }
    }
  }

  return null;
}

function reconstructPath(cameFrom, current) {
  const path = [current];
  while (cameFrom[current]) {
    current = cameFrom[current];
    path.unshift(current);
  }
  return path;
}

/* ---------- DIRECTION LOGIC ---------- */

function normalize(v) {
  const mag = Math.hypot(v.x, v.y);
  return { x: v.x / mag, y: v.y / mag };
}

function signedAngle(v1, v2) {
  const dot = v1.x * v2.x + v1.y * v2.y;
  const det = v1.x * v2.y - v1.y * v2.x;
  return Math.atan2(det, dot) * (180 / Math.PI);
}

function directionFromHeading(heading, movement) {
  const angle = signedAngle(heading, movement);

  if (Math.abs(angle) < 20) return "FORWARD";
  if (Math.abs(angle) > 160) return "BACK";
  if (angle > 0) return "LEFT";
  return "RIGHT";
}

function extractDirections(path) {
  const steps = [];
  let heading = { ...userHeading };

  for (let i = 1; i < path.length; i++) {
    const from = path[i - 1];
    const to = path[i];

    const movement = {
      x: graph[to].x - graph[from].x,
      y: graph[to].y - graph[from].y
    };

    const action =
      i === 1
        ? "START_FORWARD"
        : directionFromHeading(heading, movement);

    steps.push({ from, to, action });

    heading = normalize(movement);
  }

  return steps;
}

/* ---------- PUBLIC NAVIGATION API ---------- */

function navigateTo(destination) {
  if (!graph[destination]) {
    console.warn("Invalid destination:", destination);
    return null;
  }

  const path = aStar(startNode, destination);
  if (!path) {
    console.warn("No path found");
    return null;
  }

  activeDirections = extractDirections(path);
  currentStepIndex = 0;
  currentTargetNode = activeDirections[0].to;

  console.log("PATH:", path);
  console.log("DIRECTIONS:", activeDirections);

  return activeDirections[0]; // return FIRST step only
}

function advanceStep() {
  currentStepIndex++;

  if (currentStepIndex >= activeDirections.length) {
    console.log("Destination reached");
    return null;
  }

  currentTargetNode = activeDirections[currentStepIndex].to;
  return activeDirections[currentStepIndex];
}
function onNodeReached(nodeId) {
  if (nodeId !== currentTargetNode) return null;

  console.log("Reached:", nodeId);
  setStartNode(nodeId);

  return advanceStep();
}


/* ---------- INITIALIZATION ---------- */

// Call this once from index.html
loadMap();
