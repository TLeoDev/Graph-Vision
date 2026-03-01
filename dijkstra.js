// ============================================================
// ALGOVISUAL — Dijkstra (Réécriture pédagogique complète)
// ============================================================

// ===================== État Global =====================
let nextNodeId = 0;
let nodes = [];       // { id, x, y, label, dist, visited, prev }
let edges = [];       // { from, to, weight }
let isAnimating = false;
let mode = 'add';     // 'add' | 'edge' | 'move' | 'delete'
let selectedNode = null;
let draggingNode = null;

const BASE_ANIM_SPEED = 800;
let speedMultiplier = 1;
let animSpeed = BASE_ANIM_SPEED;

let scale = 1, panX = 0, panY = 0;
let isPanning = false, startPanX, startPanY;

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ===================== Init =====================
document.addEventListener('DOMContentLoaded', () => {
    initZoomPan();
    initGraphInteraction();
    initControlPanelDrag();
    createDefaultGraph();

    // Raccourci Entrée sur l'input aléatoire
    document.getElementById('randomNodeCount').addEventListener('keydown', e => {
        if (e.key === 'Enter') uiGenerateRandomGraph();
    });
});

// ============================================================
// I. CONSTRUCTION DU GRAPHE
// ============================================================

function addNode(x, y) {
    const id = nextNodeId++;
    const label = String.fromCharCode(65 + (id % 26)); // A-Z
    const node = { id, x, y, label, dist: Infinity, visited: false, prev: null };
    nodes.push(node);
    createNodeDOM(node);
    setStatus(`Nœud ${label} créé.`, 'insert');
    return node;
}

function removeNode(id) {
    // Supprime le nœud et toutes ses arêtes des données
    nodes = nodes.filter(n => n.id !== id);
    edges = edges.filter(e => e.from !== id && e.to !== id);

    // Supprime le DOM du nœud
    const div = document.getElementById(`node-${id}`);
    if (div) {
        // Reset toutes les propriétés visuelles avant de supprimer
        div.style.transition = 'none';
        div.style.opacity = '0';
        div.style.transform = 'translate(-50%, -50%) scale(0)';
        div.style.boxShadow = 'none';
        // Supprimer du DOM immédiatement
        div.remove();
    }

    // Supprime tout overlay SVG lié à ce nœud
    const svg = document.getElementById('edges');
    svg.querySelectorAll(`[data-from="${id}"], [data-to="${id}"]`).forEach(el => el.remove());

    // Re-rendre proprement (recrée le SVG et les poids from scratch)
    renderEdges();

    // Force un repaint léger pour éliminer les artefacts de compositing GPU
    const container = document.getElementById('tree-container');
    container.style.willChange = 'transform';
    requestAnimationFrame(() => {
        container.style.willChange = 'auto';
    });

    setStatus('Nœud supprimé.', 'delete');
}

function addEdge(fromId, toId) {
    if (fromId === toId) return;
    const existing = edges.find(e =>
        (e.from === fromId && e.to === toId) ||
        (e.from === toId && e.to === fromId)
    );

    if (existing) {
        const w = prompt(`Modifier le poids (${getLabel(fromId)}↔${getLabel(toId)}) :`, existing.weight);
        if (w !== null && !isNaN(w) && parseInt(w) > 0) existing.weight = parseInt(w);
    } else {
        const w = prompt(`Poids de l'arête ${getLabel(fromId)}↔${getLabel(toId)} :`, '5');
        if (w !== null && !isNaN(w) && parseInt(w) > 0) {
            edges.push({ from: fromId, to: toId, weight: parseInt(w) });
            setStatus(`Arête ${getLabel(fromId)}↔${getLabel(toId)} (poids: ${w}) créée.`, 'insert');
        }
    }
    renderEdges();
}

function removeEdge(fromId, toId) {
    edges = edges.filter(e =>
        !((e.from === fromId && e.to === toId) || (e.from === toId && e.to === fromId))
    );
    renderEdges();
    setStatus('Arête supprimée.', 'delete');
}

function getLabel(id) {
    const n = nodes.find(n => n.id === id);
    return n ? n.label : '?';
}

// ============================================================
// II. DOM — NŒUDS
// ============================================================

function createNodeDOM(node) {
    const container = document.getElementById('nodes');
    const div = document.createElement('div');
    div.className = 'node';
    div.id = `node-${node.id}`;
    div.dataset.id = node.id;
    div.style.left = node.x + 'px';
    div.style.top = node.y + 'px';

    div.innerHTML = `
        <div class="node-core">
            <span class="node-value">${node.label}</span>
        </div>
        <div class="dist-badge" id="dist-${node.id}" style="display:none;">∞</div>
    `;

    // Animation d'apparition
    div.style.opacity = '0';
    div.style.transform = 'translate(-50%, -50%) scale(0)';
    container.appendChild(div);
    void div.offsetWidth;
    div.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    div.style.opacity = '1';
    div.style.transform = 'translate(-50%, -50%) scale(1)';
}

// ============================================================
// III. DOM — ARÊTES SVG + POIDS
// ============================================================

function renderEdges() {
    const svg = document.getElementById('edges');
    const wc = document.getElementById('weights');

    // Préserver uniquement les overlays dont les nœuds existent encore
    const nodeIds = new Set(nodes.map(n => n.id));
    const overlays = Array.from(svg.querySelectorAll('.edge-overlay, .edge-examining, .edge-relaxed, .edge-path-final'))
        .filter(o => {
            const from = parseInt(o.dataset.from);
            const to = parseInt(o.dataset.to);
            return nodeIds.has(from) && nodeIds.has(to);
        });

    svg.innerHTML = '';
    wc.innerHTML = '';
    overlays.forEach(o => svg.appendChild(o));

    edges.forEach(edge => {
        const n1 = nodes.find(n => n.id === edge.from);
        const n2 = nodes.find(n => n.id === edge.to);
        if (!n1 || !n2) return;

        // Lignes de centre à centre (le nœud passe par-dessus grâce au z-index)
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', n1.x);
        line.setAttribute('y1', n1.y);
        line.setAttribute('x2', n2.x);
        line.setAttribute('y2', n2.y);
        line.setAttribute('stroke', '#556');
        line.setAttribute('stroke-width', '3');
        line.id = `line-${edge.from}-${edge.to}`;
        svg.appendChild(line);

        // Poids au milieu de l'arête, décalé perpendiculairement
        const dx = n2.x - n1.x;
        const dy = n2.y - n1.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const mx = (n1.x + n2.x) / 2;
        const my = (n1.y + n2.y) / 2;
        const ox = -(dy / dist) * 14;
        const oy = (dx / dist) * 14;

        const wDiv = document.createElement('div');
        wDiv.className = 'edge-weight';
        wDiv.id = `weight-${edge.from}-${edge.to}`;
        wDiv.textContent = edge.weight;
        wDiv.style.left = (mx + ox) + 'px';
        wDiv.style.top = (my + oy) + 'px';
        wc.appendChild(wDiv);
    });
}

// ============================================================
// IV. INTERACTION SOURIS
// ============================================================

function initGraphInteraction() {
    const vp = document.getElementById('tree-viewport');

    vp.addEventListener('mousedown', e => {
        if (e.target.closest('#control-panel') || e.target.closest('#dist-table')) return;
        if (e.target.tagName === 'BUTTON') return;
        if (isAnimating) return;

        const { mx, my } = mouseToWorld(e);
        const targetDiv = e.target.closest('.node');

        if (targetDiv) {
            const nid = parseInt(targetDiv.dataset.id);
            handleNodeClick(nid, e);
        } else {
            if (mode === 'add' && e.button === 0) {
                addNode(mx, my);
                // Pas de pan après ajout
            } else if (e.button === 0) {
                // Pan dans les autres modes quand on clique dans le vide
                isPanning = true;
                startPanX = e.clientX - panX;
                startPanY = e.clientY - panY;
            }
        }
    });

    window.addEventListener('mousemove', e => {
        if (draggingNode !== null) {
            const { mx, my } = mouseToWorld(e);
            const n = nodes.find(n => n.id === draggingNode);
            if (n) {
                n.x = mx; n.y = my;
                const div = document.getElementById(`node-${n.id}`);
                div.style.left = mx + 'px';
                div.style.top = my + 'px';
                renderEdges();
            }
        } else if (isPanning) {
            panX = e.clientX - startPanX;
            panY = e.clientY - startPanY;
            applyTransform();
        }
    });

    window.addEventListener('mouseup', () => {
        isPanning = false;
        draggingNode = null;
    });
}

function mouseToWorld(e) {
    const vp = document.getElementById('tree-viewport');
    const rect = vp.getBoundingClientRect();
    return {
        mx: (e.clientX - rect.left - panX) / scale,
        my: (e.clientY - rect.top - panY) / scale
    };
}

function handleNodeClick(id, e) {
    if (mode === 'edge') {
        if (selectedNode === null) {
            selectedNode = id;
            highlight(id, 'selected');
            setStatus(`${getLabel(id)} sélectionné. Cliquez sur le nœud destination.`, 'search');
        } else {
            if (selectedNode !== id) {
                addEdge(selectedNode, id);
            }
            unhighlight(selectedNode, 'selected');
            selectedNode = null;
        }
    } else if (mode === 'move') {
        draggingNode = id;
    } else if (mode === 'delete') {
        removeNode(id);
    }
}

// ============================================================
// V. ALGORITHME DE DIJKSTRA — PÉDAGOGIQUE
// ============================================================

async function uiRunDijkstra() {
    if (isAnimating) return;
    if (nodes.length < 2) { setStatus('Ajoutez au moins 2 nœuds.', 'done'); return; }

    // Récupérer départ / arrivée
    const startLabel = document.getElementById('startNodeInput').value.trim().toUpperCase() || 'A';
    const endLabel = document.getElementById('endNodeInput').value.trim().toUpperCase();
    const startNode = nodes.find(n => n.label === startLabel);
    const endNode = endLabel ? nodes.find(n => n.label === endLabel) : null;

    if (!startNode) { setStatus(`Nœud "${startLabel}" introuvable.`, 'delete'); return; }
    if (endLabel && !endNode) { setStatus(`Nœud "${endLabel}" introuvable.`, 'delete'); return; }

    isAnimating = true;
    setButtonsDisabled(true);

    // ── Phase 0 : Initialisation ──
    setStatus(`Initialisation : dist(${startLabel}) = 0, tous les autres = ∞`, 'rebalance');
    nodes.forEach(n => {
        n.dist = Infinity;
        n.visited = false;
        n.prev = null;
        clearNodeClasses(n.id);
    });
    clearAllOverlays();

    startNode.dist = 0;
    highlight(startNode.id, 'dijkstra-start');
    if (endNode) highlight(endNode.id, 'dijkstra-end');

    showDistTable();
    updateDistTable();
    resetIterationHistory();
    snapshotIteration('Init');
    await sleep(animSpeed);

    // ── Phase 1 : Boucle Principale ──
    let unvisited = [...nodes];

    while (unvisited.length > 0) {
        // Extraire le nœud avec la plus petite distance
        unvisited.sort((a, b) => a.dist - b.dist);
        const current = unvisited.shift();

        if (current.dist === Infinity) {
            setStatus('Nœuds restants inaccessibles.', 'done');
            break;
        }

        // Si on cherche un nœud spécifique et qu'on l'a atteint → stop
        if (endNode && current.id === endNode.id) {
            current.visited = true;
            setStatus(`🎯 ${current.label} atteint ! Distance = ${current.dist}`, 'insert');
            unhighlight(current.id, 'dijkstra-current');
            highlight(current.id, 'dijkstra-visited');
            updateDistTableRow(current.id, 'visited');
            snapshotIteration(`🎯 ${current.label}`);
            await sleep(animSpeed);
            break;
        }

        // Marquer comme "en cours de traitement"
        setStatus(`📌 Traitement de ${current.label}  (distance depuis ${startLabel} = ${current.dist})`, 'search');
        unhighlight(current.id, 'dijkstra-start');
        highlight(current.id, 'dijkstra-current');
        updateDistTableRow(current.id, 'active');
        focusOnNode(current);
        await sleep(animSpeed);

        current.visited = true;

        // ── Phase 2 : Explorer les voisins ──
        const neighborEdges = edges.filter(e => e.from === current.id || e.to === current.id);

        for (const edge of neighborEdges) {
            const neighborId = (edge.from === current.id) ? edge.to : edge.from;
            const neighbor = nodes.find(n => n.id === neighborId);
            if (!neighbor || neighbor.visited) continue;

            // Animer l'arête
            const edgeOverlay = createEdgeOverlay(current.id, neighborId, 'edge-examining');
            setStatus(
                `🔍 Examen voisin ${neighbor.label} via arête (poids ${edge.weight})  —  ` +
                `${current.dist} + ${edge.weight} = ${current.dist + edge.weight}  ${current.dist + edge.weight < neighbor.dist ? '< ' + (neighbor.dist === Infinity ? '∞' : neighbor.dist) + ' → Mise à jour !' : '>= ' + neighbor.dist + ' → Pas mieux.'}`,
                'search'
            );
            highlight(neighborId, 'dijkstra-neighbor');
            await sleep(animSpeed * 0.8);

            const alt = current.dist + edge.weight;
            if (alt < neighbor.dist) {
                // ── Phase 3 : Relaxation ──
                const oldDist = neighbor.dist === Infinity ? '∞' : neighbor.dist;
                neighbor.dist = alt;
                neighbor.prev = current.id;

                setStatus(`✅ dist(${neighbor.label}) : ${oldDist} → ${alt}  (via ${current.label})`, 'insert');
                if (edgeOverlay) edgeOverlay.setAttribute('class', 'edge-relaxed');
                updateDistTable();
                updateDistTableRow(neighborId, 'updated');

                // Flash le badge
                const badge = document.getElementById(`dist-${neighborId}`);
                if (badge) {
                    badge.style.display = 'block';
                    badge.textContent = alt;
                    badge.classList.add('updated');
                    setTimeout(() => badge.classList.remove('updated'), 600);
                }
                await sleep(animSpeed * 0.6);
            }

            unhighlight(neighborId, 'dijkstra-neighbor');
            removeEdgeOverlay(edgeOverlay);
        }

        // Marquer comme terminé
        unhighlight(current.id, 'dijkstra-current');
        highlight(current.id, 'dijkstra-visited');
        updateDistTableRow(current.id, 'visited');
        snapshotIteration(`Visite ${current.label}`);
        await sleep(animSpeed * 0.3);
    }

    // ── Phase 4 : Reconstruction du chemin ──
    if (endNode && endNode.prev !== null) {
        setStatus(`🛤 Reconstruction du plus court chemin ${startLabel} → ${endLabel}…`, 'rebalance');
        await sleep(animSpeed);

        const path = [];
        let cur = endNode.id;
        while (cur !== null && cur !== undefined) {
            path.unshift(cur);
            const n = nodes.find(n => n.id === cur);
            cur = n ? n.prev : null;
        }

        // Animer le chemin nœud par nœud
        for (let i = 0; i < path.length; i++) {
            const nid = path[i];
            clearNodeClasses(nid);
            highlight(nid, 'dijkstra-path');
            updateDistTableRow(nid, 'on-path');
            focusOnNode(nodes.find(n => n.id === nid));

            if (i > 0) {
                // Arête colorée en vert (persistante)
                createEdgeOverlay(path[i - 1], path[i], 'edge-path-final');
                // Colorer le poids
                const wId1 = `weight-${path[i - 1]}-${path[i]}`;
                const wId2 = `weight-${path[i]}-${path[i - 1]}`;
                const wDiv = document.getElementById(wId1) || document.getElementById(wId2);
                if (wDiv) wDiv.classList.add('on-path');
            }

            const n = nodes.find(n => n.id === nid);
            setStatus(`🛤 Chemin : ${path.slice(0, i + 1).map(id => getLabel(id)).join(' → ')}  (distance totale : ${n.dist})`, 'insert');
            await sleep(animSpeed * 0.6);
        }

        const pathStr = path.map(id => getLabel(id)).join(' → ');
        setStatus(`✓ Plus court chemin : ${pathStr}  —  Distance totale : ${endNode.dist}`, 'done');
    } else if (endNode) {
        setStatus(`✗ Aucun chemin de ${startLabel} vers ${endLabel}.`, 'delete');
    } else {
        setStatus(`✓ Dijkstra terminé depuis ${startLabel}. Distances calculées.`, 'done');
    }

    // Affiche les badges finaux
    nodes.forEach(n => {
        const badge = document.getElementById(`dist-${n.id}`);
        if (badge) {
            badge.style.display = 'block';
            badge.textContent = n.dist === Infinity ? '∞' : n.dist;
            if (n.dist !== Infinity) badge.classList.add('final');
        }
    });

    isAnimating = false;
    setButtonsDisabled(false);
}

// ============================================================
// VI. OVERLAY ARÊTES ANIMÉES
// ============================================================

function createEdgeOverlay(fromId, toId, cls) {
    const n1 = nodes.find(n => n.id === fromId);
    const n2 = nodes.find(n => n.id === toId);
    if (!n1 || !n2) return null;

    const svg = document.getElementById('edges');
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', n1.x);
    line.setAttribute('y1', n1.y);
    line.setAttribute('x2', n2.x);
    line.setAttribute('y2', n2.y);
    line.setAttribute('class', cls);
    line.dataset.from = fromId;
    line.dataset.to = toId;

    // Animation progressive
    const dx = n2.x - n1.x, dy = n2.y - n1.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    line.style.strokeDasharray = len;
    line.style.strokeDashoffset = len;
    line.style.strokeLinecap = 'round';
    svg.appendChild(line);
    void line.getBoundingClientRect();
    line.style.transition = `stroke-dashoffset ${animSpeed * 0.6}ms ease-in-out`;
    line.style.strokeDashoffset = '0';

    return line;
}

function removeEdgeOverlay(line) {
    if (!line) return;
    line.style.transition = 'opacity 0.3s';
    line.style.opacity = '0';
    setTimeout(() => line.remove(), 300);
}

function clearAllOverlays() {
    const svg = document.getElementById('edges');
    svg.querySelectorAll('.edge-overlay, .edge-examining, .edge-relaxed, .edge-path-final').forEach(e => e.remove());
}

// ============================================================
// VII. TABLEAU DES DISTANCES + TABLEAU DÉTAILLÉ
// ============================================================

// Historique des itérations pour le tableau détaillé
let iterationHistory = [];
let detailVisible = false;

function showDistTable() {
    document.getElementById('dist-table').style.display = 'flex';
}

function hideDistTable() {
    document.getElementById('dist-table').style.display = 'none';
    detailVisible = false;
    const toggle = document.getElementById('dist-detail-toggle');
    if (toggle) toggle.classList.remove('active');
    document.getElementById('dist-detail').style.display = 'none';
}

function toggleDetailTable() {
    detailVisible = !detailVisible;
    const detail = document.getElementById('dist-detail');
    const toggle = document.getElementById('dist-detail-toggle');
    detail.style.display = detailVisible ? 'flex' : 'none';
    toggle.classList.toggle('active', detailVisible);
    if (detailVisible) renderDetailTable();
}

/** Résumé compact (toujours visible) */
function updateDistTable() {
    const body = document.getElementById('dist-table-body');
    body.innerHTML = '';
    nodes.forEach(n => {
        const row = document.createElement('div');
        row.className = 'dist-row';
        row.id = `dist-row-${n.id}`;

        const label = document.createElement('span');
        label.className = 'dist-node-label';
        label.textContent = n.label;

        const via = document.createElement('span');
        via.className = 'dist-via';
        via.textContent = n.prev !== null ? `via ${getLabel(n.prev)}` : '—';

        const val = document.createElement('span');
        val.className = 'dist-value';
        val.textContent = n.dist === Infinity ? '∞' : n.dist;

        row.appendChild(label);
        row.appendChild(via);
        row.appendChild(val);
        body.appendChild(row);
    });
}

function updateDistTableRow(nodeId, state) {
    updateDistTable();
    const row = document.getElementById(`dist-row-${nodeId}`);
    if (row) row.className = `dist-row ${state}`;
}

/** Enregistre un snapshot de l'état courant (appelé après chaque itération majeure) */
function snapshotIteration(label) {
    const snap = { label, distances: {} };
    nodes.forEach(n => {
        snap.distances[n.id] = {
            dist: n.dist,
            prev: n.prev,
            visited: n.visited
        };
    });
    iterationHistory.push(snap);
    if (detailVisible) renderDetailTable();
}

function resetIterationHistory() {
    iterationHistory = [];
    const tbody = document.getElementById('dist-detail-tbody');
    if (tbody) tbody.innerHTML = '';
}

/** Rendu du tableau matriciel d'itérations */
function renderDetailTable() {
    const thead = document.getElementById('dist-detail-thead');
    const tbody = document.getElementById('dist-detail-tbody');
    thead.innerHTML = '';
    tbody.innerHTML = '';

    if (nodes.length === 0 || iterationHistory.length === 0) return;

    // En-tête : vide + une colonne par nœud
    const headRow = document.createElement('tr');
    const thEmpty = document.createElement('th');
    thEmpty.textContent = 'Étape';
    headRow.appendChild(thEmpty);
    nodes.forEach(n => {
        const th = document.createElement('th');
        th.textContent = n.label;
        headRow.appendChild(th);
    });
    thead.appendChild(headRow);

    // Lignes : une par itération
    iterationHistory.forEach((snap, idx) => {
        const tr = document.createElement('tr');
        if (idx === iterationHistory.length - 1) tr.className = 'row-active';

        const tdLabel = document.createElement('td');
        tdLabel.textContent = snap.label;
        tr.appendChild(tdLabel);

        nodes.forEach(n => {
            const td = document.createElement('td');
            const info = snap.distances[n.id];
            if (!info) { td.textContent = '—'; tr.appendChild(td); return; }

            const d = info.dist === Infinity ? '∞' : info.dist;
            const via = info.prev !== null ? getLabel(info.prev) : '';
            td.textContent = via ? `${d} (${via})` : `${d}`;

            // Coloration
            if (info.visited) td.className = 'cell-visited';
            // Détecte si la distance a changé par rapport à l'itération précédente
            if (idx > 0) {
                const prevSnap = iterationHistory[idx - 1];
                const prevInfo = prevSnap.distances[n.id];
                if (prevInfo && info.dist !== prevInfo.dist) {
                    td.className = 'cell-updated';
                }
            }

            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });

    // Auto-scroll vers le bas
    const scroll = document.getElementById('dist-detail-scroll');
    scroll.scrollTop = scroll.scrollHeight;
}

// ============================================================
// VIII. UTILITAIRES VISUELS
// ============================================================

function setStatus(msg, mode) {
    const banner = document.getElementById('status-banner');
    const text = document.getElementById('status-text');
    text.textContent = msg;
    banner.className = '';
    if (mode) banner.classList.add('mode-' + mode);
}

function highlight(id, cls) {
    const el = document.getElementById(`node-${id}`);
    if (el) el.classList.add(cls);
}
function unhighlight(id, cls) {
    const el = document.getElementById(`node-${id}`);
    if (el) el.classList.remove(cls);
}
function clearNodeClasses(id) {
    const el = document.getElementById(`node-${id}`);
    if (el) el.classList.remove(
        'selected', 'dijkstra-start', 'dijkstra-end', 'dijkstra-current',
        'dijkstra-neighbor', 'dijkstra-visited', 'dijkstra-path', 'search-path', 'rebalance-path'
    );
}

function uiResetVisuals() {
    if (isAnimating) return;
    nodes.forEach(n => {
        n.dist = Infinity;
        n.visited = false;
        n.prev = null;
        clearNodeClasses(n.id);
        const badge = document.getElementById(`dist-${n.id}`);
        if (badge) { badge.style.display = 'none'; badge.className = 'dist-badge'; }
    });
    clearAllOverlays();
    hideDistTable();
    resetIterationHistory();
    renderEdges();
    setStatus('Visuel réinitialisé.', 'done');
}

function uiClearGraph() {
    if (isAnimating) return;
    nodes = []; edges = []; nextNodeId = 0;
    document.getElementById('nodes').innerHTML = '';
    document.getElementById('edges').innerHTML = '';
    document.getElementById('weights').innerHTML = '';
    hideDistTable();
    setStatus('Graphe effacé.', 'done');
}

function focusOnNode(node) {
    if (!node) return;
    const vp = document.getElementById('tree-viewport');
    const screenX = panX + node.x * scale;
    const screenY = panY + node.y * scale;
    const margin = 120;
    if (screenX < margin || screenX > vp.clientWidth - margin ||
        screenY < margin || screenY > vp.clientHeight - margin) {
        const targetX = vp.clientWidth / 2 - node.x * scale;
        const targetY = vp.clientHeight / 2 - node.y * scale;
        animatePan(targetX, targetY);
    }
}

let activePanAnim = null;
function animatePan(tx, ty) {
    if (activePanAnim) cancelAnimationFrame(activePanAnim);
    const sx = panX, sy = panY, dx = tx - sx, dy = ty - sy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const dur = Math.min(600, Math.max(200, dist * 0.4));
    const start = performance.now();
    function step(now) {
        const t = Math.min(1, (now - start) / dur);
        const e = 1 - Math.pow(1 - t, 3);
        panX = sx + dx * e; panY = sy + dy * e;
        applyTransform();
        if (t < 1) activePanAnim = requestAnimationFrame(step);
        else activePanAnim = null;
    }
    activePanAnim = requestAnimationFrame(step);
}

// ============================================================
// IX. PAN & ZOOM
// ============================================================

function initZoomPan() {
    const vp = document.getElementById('tree-viewport');
    vp.addEventListener('wheel', e => {
        e.preventDefault();
        const rect = vp.getBoundingClientRect();
        const prevScale = scale;
        scale = e.deltaY < 0 ? Math.min(scale * 1.1, 3) : Math.max(scale / 1.1, 0.15);
        const mx = e.clientX - rect.left, my = e.clientY - rect.top;
        panX = mx - (mx - panX) * (scale / prevScale);
        panY = my - (my - panY) * (scale / prevScale);
        applyTransform();
    }, { passive: false });
}

function applyTransform() {
    document.getElementById('tree-world').style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
    document.getElementById('zoom-level').textContent = Math.round(scale * 100) + '%';
}

function autoFitView() {
    if (nodes.length === 0) { scale = 1; panX = 0; panY = 0; applyTransform(); return; }
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    nodes.forEach(n => { minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x); minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y); });
    const vp = document.getElementById('tree-viewport');
    const gw = maxX - minX + 250, gh = maxY - minY + 250;
    scale = Math.min(vp.clientWidth / gw, vp.clientHeight / gh, 1.2);
    scale = Math.max(0.15, scale);
    panX = vp.clientWidth / 2 - ((minX + maxX) / 2) * scale;
    panY = vp.clientHeight / 2 - ((minY + maxY) / 2) * scale;
    applyTransform();
}

function zoomIn() { scale = Math.min(scale * 1.2, 3); applyTransform(); }
function zoomOut() { scale = Math.max(scale / 1.2, 0.15); applyTransform(); }
function zoomReset() { autoFitView(); }

// ============================================================
// X. CONTRÔLES UI
// ============================================================

function setMode(m) {
    mode = m;
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById('btnMode' + m.charAt(0).toUpperCase() + m.slice(1));
    if (btn) btn.classList.add('active');

    const msgs = {
        add: 'Cliquez dans le vide pour placer un nœud.',
        edge: 'Cliquez sur un nœud source, puis sur la destination.',
        move: 'Glissez-déposez les nœuds pour les repositionner.',
        delete: 'Cliquez sur un nœud ou une arête pour le supprimer.'
    };
    setStatus(msgs[m] || '', 'done');

    if (selectedNode !== null) { unhighlight(selectedNode, 'selected'); selectedNode = null; }
}

function setSpeed(mult) {
    speedMultiplier = mult;
    animSpeed = Math.round(BASE_ANIM_SPEED / mult);
    document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
    if (event && event.target) event.target.classList.add('active');
}

function toggleControlPanel() {
    const body = document.getElementById('control-panel-body');
    const btn = document.getElementById('control-panel-toggle');
    body.classList.toggle('collapsed');
    btn.textContent = body.classList.contains('collapsed') ? '+' : '−';
}

function initControlPanelDrag() {
    const panel = document.getElementById('control-panel');
    const header = document.getElementById('control-panel-header');
    let isDragging = false, ox, oy;
    header.addEventListener('mousedown', e => {
        if (e.target.closest('#control-panel-toggle')) return;
        isDragging = true;
        const r = panel.getBoundingClientRect();
        ox = e.clientX - r.left; oy = e.clientY - r.top;
        e.preventDefault();
    });
    window.addEventListener('mousemove', e => {
        if (!isDragging) return;
        panel.style.left = Math.max(4, Math.min(e.clientX - ox, window.innerWidth - panel.offsetWidth - 4)) + 'px';
        panel.style.top = Math.max(48, Math.min(e.clientY - oy, window.innerHeight - 60)) + 'px';
    });
    window.addEventListener('mouseup', () => isDragging = false);
}

function setButtonsDisabled(d) {
    document.querySelectorAll('#control-panel button, .mode-btn').forEach(b => b.disabled = d);
}

// ============================================================
// XI. GRAPHE PAR DÉFAUT
// ============================================================

function createDefaultGraph() {
    // Graphe pédagogique classique pour Dijkstra
    //
    //       A ---4--- B ---2--- C
    //       |  \      |         |
    //       1    8    6         3
    //       |      \  |         |
    //       D ---5--- E ---9--- F
    //
    const positions = [
        { x: 200, y: 120 },  // A
        { x: 450, y: 120 },  // B
        { x: 700, y: 120 },  // C
        { x: 200, y: 350 },  // D
        { x: 450, y: 350 },  // E
        { x: 700, y: 350 },  // F
    ];

    positions.forEach(p => addNode(p.x, p.y));

    edges.push(
        { from: 0, to: 1, weight: 4  },  // A-B
        { from: 1, to: 2, weight: 2  },  // B-C
        { from: 0, to: 3, weight: 1  },  // A-D
        { from: 0, to: 4, weight: 8  },  // A-E
        { from: 1, to: 4, weight: 6  },  // B-E
        { from: 2, to: 5, weight: 3  },  // C-F
        { from: 3, to: 4, weight: 5  },  // D-E
        { from: 4, to: 5, weight: 9  },  // E-F
    );

    renderEdges();
    autoFitView();
    setStatus('Graphe par défaut chargé. Cliquez sur ▶ Lancer Dijkstra.', 'done');
    // Pré-remplir les champs
    document.getElementById('startNodeInput').value = 'A';
    document.getElementById('endNodeInput').value = 'F';
}

// ============================================================
// XII. GÉNÉRATION ALÉATOIRE
// ============================================================

function uiGenerateRandomGraph() {
    if (isAnimating) return;

    const input = document.getElementById('randomNodeCount');
    const count = parseInt(input.value);

    if (isNaN(count) || count < 2) {
        setStatus('Entrez un nombre de nœuds ≥ 2.', 'delete');
        return;
    }
    if (count > 26) {
        setStatus('Maximum 26 nœuds (A-Z).', 'delete');
        return;
    }

    // Nettoyer le graphe actuel
    nodes = [];
    edges = [];
    nextNodeId = 0;
    document.getElementById('nodes').innerHTML = '';
    document.getElementById('edges').innerHTML = '';
    document.getElementById('weights').innerHTML = '';
    hideDistTable();

    // --- 1. Placer les nœuds en cercle ---
    const centerX = 400, centerY = 300;
    const radius = 80 + count * 22; // Rayon adapté au nombre de nœuds

    for (let i = 0; i < count; i++) {
        const angle = (2 * Math.PI * i) / count - Math.PI / 2; // Commence en haut
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        addNode(x, y);
    }

    // --- 2. Garantir la connexité (arbre couvrant aléatoire) ---
    // On relie chaque nœud au suivant dans un ordre mélangé
    const shuffled = [...Array(count).keys()];
    // Fisher-Yates shuffle
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    for (let i = 1; i < shuffled.length; i++) {
        const w = Math.floor(Math.random() * 15) + 1; // poids entre 1 et 15
        edges.push({ from: shuffled[i - 1], to: shuffled[i], weight: w });
    }

    // --- 3. Ajouter des arêtes supplémentaires pour du réalisme ---
    // Nombre d'arêtes supplémentaires : ~30-50% du nombre de nœuds
    const extraCount = Math.floor(count * (0.3 + Math.random() * 0.4));
    let attempts = 0;
    let added = 0;

    while (added < extraCount && attempts < extraCount * 10) {
        attempts++;
        const a = Math.floor(Math.random() * count);
        const b = Math.floor(Math.random() * count);
        if (a === b) continue;

        // Vérifie que l'arête n'existe pas déjà
        const exists = edges.some(e =>
            (e.from === a && e.to === b) || (e.from === b && e.to === a)
        );
        if (exists) continue;

        const w = Math.floor(Math.random() * 15) + 1;
        edges.push({ from: a, to: b, weight: w });
        added++;
    }

    // --- 4. Rendu ---
    renderEdges();
    autoFitView();

    // Pré-remplir départ = A, arrivée = dernier nœud
    const lastLabel = String.fromCharCode(64 + count); // Ex: 8 nœuds → H
    document.getElementById('startNodeInput').value = 'A';
    document.getElementById('endNodeInput').value = lastLabel;

    input.value = '';
    setStatus(`✓ Graphe aléatoire généré (${count} nœuds, ${edges.length} arêtes).`, 'done');
}












