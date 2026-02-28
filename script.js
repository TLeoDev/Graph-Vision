// ============================================================
// ALGOVISUAL — Logique principale
// Refonte pédagogique : 4 phases (Descente, Action, Remontée, Rotation)
// ============================================================

// ===================== Configuration =====================
let nextNodeId = 1;
let isAnimating = false;
let isInstant = true;
const BASE_ANIM_SPEED = 600;
let speedMultiplier = 1;
let animSpeed = BASE_ANIM_SPEED;

function setSpeed(mult) {
    speedMultiplier = mult;
    animSpeed = Math.round(BASE_ANIM_SPEED / mult);
    document.querySelectorAll('.speed-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
}

// ===================== Pan & Zoom (inchangé) =====================
let scale = 1;
let panX = 0, panY = 0;
let isPanning = false;
let startPanX, startPanY;

const treeWorld = () => document.getElementById('tree-world');

function applyTransform() {
    treeWorld().style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
    document.getElementById('zoom-level').textContent = Math.round(scale * 100) + '%';
}

function zoomIn() { scale = Math.min(scale * 1.2, 3); applyTransform(); }
function zoomOut() { scale = Math.max(scale / 1.2, 0.15); applyTransform(); }
function zoomReset() { autoFitView(); }

document.addEventListener('DOMContentLoaded', () => {
    const vp = document.getElementById('tree-viewport');

    vp.addEventListener('mousedown', e => {
        if (e.button !== 0) return;
        isPanning = true;
        startPanX = e.clientX - panX;
        startPanY = e.clientY - panY;
    });

    window.addEventListener('mousemove', e => {
        if (!isPanning) return;
        panX = e.clientX - startPanX;
        panY = e.clientY - startPanY;
        applyTransform();
    });

    window.addEventListener('mouseup', () => { isPanning = false; });

    vp.addEventListener('wheel', e => {
        e.preventDefault();
        const rect = vp.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const oldScale = scale;
        if (e.deltaY < 0) scale = Math.min(scale * 1.1, 3);
        else scale = Math.max(scale / 1.1, 0.15);
        panX = mx - (mx - panX) * (scale / oldScale);
        panY = my - (my - panY) * (scale / oldScale);
        applyTransform();
    }, { passive: false });
});

// ===================== Noeud AVL =====================
class Node {
    constructor(val) {
        this.id = nextNodeId++;
        this.val = val;
        this.left = null;
        this.right = null;
        this.height = 1;
        this.x = 0;
        this.y = 0;
    }
}

let root = null;

const sleep = (ms) => isInstant ? Promise.resolve() : new Promise(r => setTimeout(r, ms));

// ===================== Méthodes AVL =====================
function getHeight(n) { return n ? n.height : 0; }
function getBalance(n) { return n ? getHeight(n.left) - getHeight(n.right) : 0; }
function updateHeight(n) { n.height = Math.max(getHeight(n.left), getHeight(n.right)) + 1; }
function getMinValueNode(n) {
    let curr = n;
    while (curr.left != null) curr = curr.left;
    return curr;
}

// ===================== UI Helpers =====================
function setStatus(msg, mode) {
    const banner = document.getElementById('status-banner');
    const text = document.getElementById('status-text');
    text.textContent = msg;

    if (!mode) {
        if (/rotation/i.test(msg) || /rotate/i.test(msg)) mode = 'rotate';
        else if (/déséquilibre|équilibrage|balance|rééquilibr/i.test(msg)) mode = 'rebalance';
        else if (/recherche|comparaison/i.test(msg)) mode = 'search';
        else if (/créa|insertion|inséré|construit/i.test(msg)) mode = 'insert';
        else if (/suppres|trouvé.*suppres/i.test(msg)) mode = 'delete';
        else if (/terminé|prêt|vidé|déjà/i.test(msg)) mode = 'done';
        else mode = 'done';
    }

    banner.className = '';
    banner.classList.add('mode-' + mode);
}

function highlight(id, cls) {
    const div = document.getElementById('node-' + id);
    if (div) div.classList.add(cls);
}

function unhighlight(id, cls) {
    const div = document.getElementById('node-' + id);
    if (div) div.classList.remove(cls);
}

function setButtonsDisabled(disabled) {
    document.getElementById('btnInsert').disabled = disabled;
    document.getElementById('btnDelete').disabled = disabled;
    document.getElementById('btnBuild').disabled = disabled;
    document.getElementById('btnClear').disabled = disabled;
}

// ============================================================
// RENDU DOM — Nouvelle structure de nœud avec ring, core, badges
// ============================================================

/**
 * Génère le SVG d'un arc de cercle (demi-anneau gauche ou droite).
 * cx, cy = centre ; r = rayon ; startAngle, endAngle en degrés.
 */
function describeArc(cx, cy, r, startAngle, endAngle) {
    const rad = (a) => (a - 90) * Math.PI / 180;
    const x1 = cx + r * Math.cos(rad(startAngle));
    const y1 = cy + r * Math.sin(rad(startAngle));
    const x2 = cx + r * Math.cos(rad(endAngle));
    const y2 = cy + r * Math.sin(rad(endAngle));
    const large = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}

/**
 * Crée le contenu HTML interne d'un .node :
 *   - .node-ring (SVG arcs gauche/droite)
 *   - .node-core (valeur)
 *   - .node-badges (hauteur + BF)
 */
function buildNodeInnerHTML(node) {
    const bf = getBalance(node);
    const hL = getHeight(node.left);
    const hR = getHeight(node.right);

    // Anneau SVG — Arcs proportionnels à la hauteur des sous-arbres
    // Centre du SVG = 38, 38 ; Rayon = 34
    const arcLeft  = describeArc(38, 38, 34, 180, 360); // demi gauche (bas → haut, côté gauche)
    const arcRight = describeArc(38, 38, 34, 0, 180);   // demi droite (haut → bas, côté droit)

    const bfClass = (Math.abs(bf) >= 2) ? ' critical' : '';

    return `
        <svg class="node-ring" viewBox="0 0 76 76">
            <path class="arc-left"  d="${arcLeft}"  stroke-opacity="${hL > 0 ? 0.9 : 0.2}" />
            <path class="arc-right" d="${arcRight}" stroke-opacity="${hR > 0 ? 0.9 : 0.2}" />
        </svg>
        <div class="node-core">
            <span class="node-value">${node.val}</span>
        </div>
        <div class="node-badges">
            <span class="badge-height" title="Hauteur">${node.height}</span>
            <span class="badge-bf${bfClass}" title="Facteur d'équilibre">${bf}</span>
        </div>
    `;
}

/**
 * Met à jour l'arbre DOM complet (nœuds + arêtes).
 * Crée les nœuds manquants, supprime les obsolètes, met à jour les positions.
 */
function updateDOMTree() {
    if (root) calculatePositions(root);

    let currentNodes = [];
    let currentEdges = [];

    function traverse(node) {
        if (!node) return;
        currentNodes.push(node);
        if (node.left)  { currentEdges.push({ parent: node, child: node.left });  traverse(node.left); }
        if (node.right) { currentEdges.push({ parent: node, child: node.right }); traverse(node.right); }
    }
    traverse(root);

    const nodesContainer = document.getElementById('nodes');
    const edgesContainer = document.getElementById('edges');

    let activeNodeIds = new Set();
    let activeEdgeIds = new Set();

    // --- Mise à jour des nœuds ---
    currentNodes.forEach(node => {
        activeNodeIds.add('node-' + node.id);
        let div = document.getElementById('node-' + node.id);

        if (!div) {
            // Nouveau nœud — création avec animation de pop
            div = document.createElement('div');
            div.className = 'node';
            div.id = 'node-' + node.id;
            div.dataset.id = node.id;
            div.style.left = node.x + 'px';
            div.style.top = node.y + 'px';

            if (!isInstant) {
                div.style.transition = 'none';
                div.style.opacity = '0';
                div.style.transform = 'translate(-50%, -50%) scale(0)';
                nodesContainer.appendChild(div);
                void div.offsetWidth; // force reflow
                div.style.transition = `opacity 0.35s ease-out, transform 0.35s ease-out, left ${animSpeed}ms ease-in-out, top ${animSpeed}ms ease-in-out`;
                div.style.opacity = '1';
                div.style.transform = 'translate(-50%, -50%) scale(1)';
            } else {
                nodesContainer.appendChild(div);
            }
        }

        // Mise à jour du contenu (valeur, badges, arcs)
        // On ne fait innerHTML QUE si le nœud vient d'être créé ou si la structure interne manque
        if (!div.querySelector('.node-core')) {
            div.innerHTML = buildNodeInnerHTML(node);
        } else {
            // Mise à jour chirurgicale — ne touche pas les éléments dynamiques
            // (rotation-arrow, classes CSS highlight, visible sur ring)
            const valSpan = div.querySelector('.node-value');
            if (valSpan) valSpan.textContent = node.val;

            const bf = getBalance(node);
            const hL = getHeight(node.left);
            const hR = getHeight(node.right);

            const badgeH = div.querySelector('.badge-height');
            if (badgeH) badgeH.textContent = node.height;

            const badgeBf = div.querySelector('.badge-bf');
            if (badgeBf) {
                badgeBf.textContent = bf;
                badgeBf.classList.toggle('critical', Math.abs(bf) >= 2);
            }

            // Mise à jour de l'opacité des arcs
            const arcL = div.querySelector('.arc-left');
            const arcR = div.querySelector('.arc-right');
            if (arcL) arcL.setAttribute('stroke-opacity', hL > 0 ? 0.9 : 0.2);
            if (arcR) arcR.setAttribute('stroke-opacity', hR > 0 ? 0.9 : 0.2);
        }
        div.style.left = node.x + 'px';
        div.style.top = node.y + 'px';
    });

    // Supprime les nœuds qui ne sont plus dans l'arbre
    Array.from(nodesContainer.children).forEach(child => {
        if (!activeNodeIds.has(child.id)) child.remove();
    });

    // --- Mise à jour des arêtes ---
    currentEdges.forEach(edge => {
        let edgeId = `edge-${edge.parent.id}-${edge.child.id}`;
        activeEdgeIds.add(edgeId);
        let line = document.getElementById(edgeId);
        if (!line) {
            line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.id = edgeId;
            line.dataset.parent = edge.parent.id;
            line.dataset.child = edge.child.id;
            edgesContainer.appendChild(line);
        }
    });

    Array.from(edgesContainer.children).forEach(child => {
        if (!activeEdgeIds.has(child.id)) child.remove();
    });
}

// ============================================================
// EFFETS VISUELS PÉDAGOGIQUES
// ============================================================

/**
 * Affiche les arcs de poids (ring) autour d'un nœud pendant la phase de remontée.
 * Rend visible l'anneau SVG avec opacité proportionnelle aux hauteurs.
 */
function showBalanceRing(nodeId) {
    const div = document.getElementById('node-' + nodeId);
    if (!div) return;
    const ring = div.querySelector('.node-ring');
    if (ring) ring.classList.add('visible');
}

function hideBalanceRing(nodeId) {
    const div = document.getElementById('node-' + nodeId);
    if (!div) return;
    const ring = div.querySelector('.node-ring');
    if (ring) ring.classList.remove('visible');
}

/**
 * Anime le "pop" d'un badge quand sa valeur change.
 */
function popBadge(nodeId, badgeClass) {
    const div = document.getElementById('node-' + nodeId);
    if (!div) return;
    const badge = div.querySelector('.' + badgeClass);
    if (!badge) return;
    badge.classList.remove('updated');
    void badge.offsetWidth;
    badge.classList.add('updated');
}

/**
 * Ajoute la flèche de rotation SVG autour du nœud pivot.
 * direction : 'right' ou 'left'
 */
function showRotationArrow(nodeId, direction) {
    const div = document.getElementById('node-' + nodeId);
    if (!div) return;

    // Supprime une éventuelle flèche existante
    removeRotationArrow(nodeId);

    // Crée le conteneur SVG de la flèche
    const wrapper = document.createElement('div');
    wrapper.className = `rotation-arrow rotate-${direction}`;

    // Arc centré sur (52, 52) avec rayon 38, traçant ~270° du cercle
    // Le centre (52,52) correspond au centre du .node (60/2=30) + offset (-22) = 30+22=52 ✓
    const cx = 52, cy = 52, r = 38;

    if (direction === 'right') {
        // Rotation droite = sens anti-horaire (↺)
        // Arc de 135° (bas-droite) à -135° (bas-gauche) en anti-horaire = 270°
        // Point départ : angle 135° → (cx + r*cos(135°), cy + r*sin(135°))
        //   cos(135°)=-0.707, sin(135°)=0.707 → (52-26.9, 52+26.9) ≈ (25, 79)
        // Point arrivée : angle -90° (haut) → (52, 52-38) = (52, 14)
        // On va de (25, 79) à (52, 14) en sens anti-horaire (sweep=0), large arc (270° > 180°)
        wrapper.innerHTML = `
            <svg viewBox="0 0 104 104">
                <path class="arrow-path" d="M 25.1 78.9 A 38 38 0 1 0 52 14" />
                <polyline class="arrow-head" points="44,17 52,14 52,24" fill="none" />
            </svg>
        `;
    } else {
        // Rotation gauche = sens horaire (↻)
        // Arc de 45° (droite-haut) à 90° (haut) → on trace 270° en sens horaire
        // Point départ : angle 45° → (52+26.9, 52-26.9) ≈ (79, 25)
        // Point arrivée : angle -90° (haut) → (52, 14)
        // On va de (79, 79) à (52, 14) en sens horaire (sweep=1), large arc
        wrapper.innerHTML = `
            <svg viewBox="0 0 104 104">
                <path class="arrow-path" d="M 78.9 78.9 A 38 38 0 1 1 52 14" />
                <polyline class="arrow-head" points="60,17 52,14 52,24" fill="none" />
            </svg>
        `;
    }

    div.appendChild(wrapper);
    void wrapper.offsetWidth;
    wrapper.classList.add('visible');
}

function removeRotationArrow(nodeId) {
    const div = document.getElementById('node-' + nodeId);
    if (!div) return;
    const arrow = div.querySelector('.rotation-arrow');
    if (arrow) arrow.remove();
}

// ============================================================
// HELPERS POUR ANIMATION DE ROTATION (FLIP technique)
// ============================================================

/** Sauvegarde les positions CSS de tous les nœuds DOM */
function snapshotDOMPositions() {
    const map = {};
    document.querySelectorAll('#nodes .node').forEach(div => {
        const nid = parseInt(div.dataset.id);
        map[nid] = {
            x: parseFloat(div.style.left) || 0,
            y: parseFloat(div.style.top)  || 0
        };
    });
    return map;
}

/**
 * Technique FLIP : replace chaque nœud à son ancienne position (sans transition),
 * force un reflow, puis anime vers sa nouvelle position.
 */
function animateFromSnapshot(before) {
    if (isInstant) return;
    const allDivs = document.querySelectorAll('#nodes .node');

    // 1) Position immédiate à l'ancienne position (transition off)
    allDivs.forEach(div => {
        const nid = parseInt(div.dataset.id);
        if (before[nid]) {
            div.style.transition = 'none';
            div.style.left = before[nid].x + 'px';
            div.style.top  = before[nid].y + 'px';
        }
    });

    // 2) Force reflow
    void document.getElementById('nodes').offsetWidth;

    // 3) Réactive la transition → anime vers la nouvelle position
    allDivs.forEach(div => {
        const nid = parseInt(div.dataset.id);
        div.style.transition = `left ${animSpeed}ms ease-in-out, top ${animSpeed}ms ease-in-out`;
        const node = findNodeById(root, nid);
        if (node) {
            div.style.left = node.x + 'px';
            div.style.top  = node.y + 'px';
        }
    });
}

function findNodeById(n, id) {
    if (!n) return null;
    if (n.id === id) return n;
    return findNodeById(n.left, id) || findNodeById(n.right, id);
}

function waitForTransitions() {
    return new Promise(resolve => setTimeout(resolve, animSpeed + 50));
}

/** Trouve le parent d'un nœud dans l'arbre global */
function findParent(target) {
    function walk(n, parent, side) {
        if (!n) return null;
        if (n === target) return { parent, side };
        return walk(n.left, n, 'left') || walk(n.right, n, 'right');
    }
    return walk(root, null, null);
}

/** Highlight récursif d'un sous-arbre entier */
function highlightSubtree(n, cls) {
    if (!n) return;
    highlight(n.id, cls);
    highlightSubtree(n.left, cls);
    highlightSubtree(n.right, cls);
}
function unhighlightSubtree(n, cls) {
    if (!n) return;
    unhighlight(n.id, cls);
    unhighlightSubtree(n.left, cls);
    unhighlightSubtree(n.right, cls);
}

// ============================================================
// ROTATIONS — Phase 4 : Animation pédagogique complète
// ============================================================

/**
 * Rotation Droite sur le nœud y.
 * Scénario :
 *   1. Highlight pivot (y, rouge) et enfant montant (x, vert)
 *   2. Affiche la flèche de rotation ↻
 *   3. Pause pédagogique longue
 *   4. Retire la flèche, effectue la rotation
 *   5. FLIP animation vers les nouvelles positions
 *   6. Nettoyage
 */
async function rightRotate(y) {
    let x = y.left;
    let T2 = x.right;

    // --- Phase 4a : Mise en évidence ---
    setStatus(`⚠ Déséquilibre ! Rotation Droite : ${x.val} monte ↑, ${y.val} descend ↓`, 'rotate');
    highlight(y.id, 'rotate-pivot');
    highlight(x.id, 'rotate-child');
    if (T2) highlightSubtree(T2, 'transferred-subtree');

    // --- Phase 4b : Flèche de rotation ---
    showRotationArrow(y.id, 'right');
    await sleep(animSpeed * 2);

    // --- Phase 4c : Snapshot positions avant rotation ---
    const before = snapshotDOMPositions();
    const parentInfo = findParent(y);

    // --- Phase 4d : Effectuer la rotation (pointeurs) ---
    removeRotationArrow(y.id);
    x.right = y;
    y.left = T2;
    updateHeight(y);
    updateHeight(x);

    // Patcher l'arbre pour que root soit cohérent
    if (parentInfo && parentInfo.parent) {
        parentInfo.parent[parentInfo.side] = x;
    } else {
        root = x;
    }

    // --- Phase 4e : Recalculer layout + FLIP animation ---
    setStatus(`Rotation Droite : ${x.val} prend la place de ${y.val}`, 'rotate');
    updateDOMTree();
    animateFromSnapshot(before);
    await waitForTransitions();

    // --- Phase 4f : Nettoyage ---
    unhighlight(y.id, 'rotate-pivot');
    unhighlight(x.id, 'rotate-child');
    if (T2) unhighlightSubtree(T2, 'transferred-subtree');

    return x;
}

/**
 * Rotation Gauche sur le nœud x.
 * Même scénario symétrique.
 */
async function leftRotate(x) {
    let y = x.right;
    let T2 = y.left;

    // --- Phase 4a : Mise en évidence ---
    setStatus(`⚠ Déséquilibre ! Rotation Gauche : ${y.val} monte ↑, ${x.val} descend ↓`, 'rotate');
    highlight(x.id, 'rotate-pivot');
    highlight(y.id, 'rotate-child');
    if (T2) highlightSubtree(T2, 'transferred-subtree');

    // --- Phase 4b : Flèche de rotation ---
    showRotationArrow(x.id, 'left');
    await sleep(animSpeed * 2);

    // --- Phase 4c : Snapshot positions avant rotation ---
    const before = snapshotDOMPositions();
    const parentInfo = findParent(x);

    // --- Phase 4d : Effectuer la rotation (pointeurs) ---
    removeRotationArrow(x.id);
    y.left = x;
    x.right = T2;
    updateHeight(x);
    updateHeight(y);

    // Patcher l'arbre
    if (parentInfo && parentInfo.parent) {
        parentInfo.parent[parentInfo.side] = y;
    } else {
        root = y;
    }

    // --- Phase 4e : Recalculer layout + FLIP animation ---
    setStatus(`Rotation Gauche : ${y.val} prend la place de ${x.val}`, 'rotate');
    updateDOMTree();
    animateFromSnapshot(before);
    await waitForTransitions();

    // --- Phase 4f : Nettoyage ---
    unhighlight(x.id, 'rotate-pivot');
    unhighlight(y.id, 'rotate-child');
    if (T2) unhighlightSubtree(T2, 'transferred-subtree');

    return y;
}

// ============================================================
// INSERTION — Scénario pédagogique en 4 phases
// ============================================================

async function insertAsync(node, val) {

    // ──────────────────────────────────────────────
    // PHASE 2 : Création du nœud (feuille atteinte)
    // ──────────────────────────────────────────────
    if (!node) {
        setStatus(`✦ Création du nœud ${val}`, 'insert');
        let newNode = new Node(val);
        updateDOMTree();

        // Animation de brillance temporaire
        if (!isInstant) {
            highlight(newNode.id, 'just-inserted');
            await sleep(animSpeed * 1.2);
            unhighlight(newNode.id, 'just-inserted');
        }

        return newNode;
    }

    // ──────────────────────────────────────────────
    // PHASE 1 : Descente — recherche de la position
    // ──────────────────────────────────────────────
    setStatus(`🔍 Descente : comparaison avec ${node.val}  (${val} ${val < node.val ? '<' : '>'} ${node.val} → aller à ${val < node.val ? 'gauche' : 'droite'})`, 'search');
    highlight(node.id, 'search-path');
    await sleep(animSpeed);
    unhighlight(node.id, 'search-path');

    if (val < node.val) {
        node.left = await insertAsync(node.left, val);
    } else if (val > node.val) {
        node.right = await insertAsync(node.right, val);
    } else {
        setStatus(`Valeur ${val} déjà présente !`, 'done');
        return node;
    }

    // ──────────────────────────────────────────────
    // PHASE 3 : Remontée — calcul d'équilibre
    // ──────────────────────────────────────────────
    const oldHeight = node.height;
    const oldBf = getBalance(node);
    updateHeight(node);
    const newBf = getBalance(node);

    // Mise à jour de l'affichage + highlight cyan "remontée"
    setStatus(`⬆ Remontée : vérification du nœud ${node.val}  —  h: ${oldHeight}→${node.height}, bf: ${oldBf}→${newBf}`, 'rebalance');
    updateDOMTree();
    highlight(node.id, 'rebalance-path');
    showBalanceRing(node.id);

    // Pop les badges si la valeur a changé
    if (node.height !== oldHeight) popBadge(node.id, 'badge-height');
    if (newBf !== oldBf) popBadge(node.id, 'badge-bf');

    await sleep(animSpeed);

    let balance = newBf;

    // ──────────────────────────────────────────────
    // PHASE 4 : Déséquilibre détecté → rotation
    // ──────────────────────────────────────────────
    if (balance > 1 && val < node.left.val) {
        // Cas Gauche-Gauche → Rotation Droite simple
        hideBalanceRing(node.id);
        unhighlight(node.id, 'rebalance-path');
        setStatus(`Nœud ${node.val} : bf = ${balance} → Rotation Droite`, 'rotate');
        await sleep(animSpeed * 0.5);
        node = await rightRotate(node);

    } else if (balance < -1 && val > node.right.val) {
        // Cas Droite-Droite → Rotation Gauche simple
        hideBalanceRing(node.id);
        unhighlight(node.id, 'rebalance-path');
        setStatus(`Nœud ${node.val} : bf = ${balance} → Rotation Gauche`, 'rotate');
        await sleep(animSpeed * 0.5);
        node = await leftRotate(node);

    } else if (balance > 1 && val > node.left.val) {
        // Cas Gauche-Droite → Double Rotation
        hideBalanceRing(node.id);
        unhighlight(node.id, 'rebalance-path');
        setStatus(`Nœud ${node.val} : bf = ${balance} → Double Rotation (Gauche puis Droite)`, 'rotate');
        await sleep(animSpeed);
        node.left = await leftRotate(node.left);
        // Pause entre les deux rotations
        setStatus(`… puis Rotation Droite sur ${node.val}`, 'rotate');
        await sleep(animSpeed * 0.5);
        node = await rightRotate(node);

    } else if (balance < -1 && val < node.right.val) {
        // Cas Droite-Gauche → Double Rotation
        hideBalanceRing(node.id);
        unhighlight(node.id, 'rebalance-path');
        setStatus(`Nœud ${node.val} : bf = ${balance} → Double Rotation (Droite puis Gauche)`, 'rotate');
        await sleep(animSpeed);
        node.right = await rightRotate(node.right);
        setStatus(`… puis Rotation Gauche sur ${node.val}`, 'rotate');
        await sleep(animSpeed * 0.5);
        node = await leftRotate(node);

    } else {
        // Équilibré → on continue la remontée
        hideBalanceRing(node.id);
        unhighlight(node.id, 'rebalance-path');
    }

    return node;
}

// ============================================================
// SUPPRESSION — Scénario pédagogique en 4 phases
// ============================================================

async function deleteAsync(node, val) {
    if (!node) {
        setStatus(`Valeur ${val} non trouvée.`, 'done');
        return node;
    }

    // ──────────────────────────────────────────────
    // PHASE 1 : Descente — recherche du nœud à supprimer
    // ──────────────────────────────────────────────
    setStatus(`🔍 Recherche pour suppression… Comparaison avec ${node.val}`, 'search');
    highlight(node.id, 'search-path');
    await sleep(animSpeed);
    unhighlight(node.id, 'search-path');

    if (val < node.val) {
        node.left = await deleteAsync(node.left, val);
    } else if (val > node.val) {
        node.right = await deleteAsync(node.right, val);
    } else {
        // ──────────────────────────────────────────────
        // PHASE 2 : Action — suppression du nœud trouvé
        // ──────────────────────────────────────────────
        setStatus(`✦ Nœud ${val} trouvé ! Suppression…`, 'delete');

        // Animation de clignotement rouge
        if (!isInstant) {
            highlight(node.id, 'deleting');
            await sleep(animSpeed);
            unhighlight(node.id, 'deleting');
        }

        if (!node.left || !node.right) {
            let temp = node.left ? node.left : node.right;
            if (!temp) return null;
            else return temp;
        } else {
            // Remplacement par le successeur inorder
            let temp = getMinValueNode(node.right);
            setStatus(`Remplacement par le successeur : ${temp.val}`, 'delete');
            node.val = temp.val;
            updateDOMTree();
            await sleep(animSpeed);
            node.right = await deleteAsync(node.right, temp.val);
        }
    }

    if (!node) return node;

    // ──────────────────────────────────────────────
    // PHASE 3 : Remontée — calcul d'équilibre après suppression
    // ──────────────────────────────────────────────
    const oldHeight = node.height;
    const oldBf = getBalance(node);
    updateHeight(node);
    const newBf = getBalance(node);

    setStatus(`⬆ Remontée : vérification du nœud ${node.val}  —  h: ${oldHeight}→${node.height}, bf: ${oldBf}→${newBf}`, 'rebalance');
    updateDOMTree();
    highlight(node.id, 'rebalance-path');
    showBalanceRing(node.id);

    if (node.height !== oldHeight) popBadge(node.id, 'badge-height');
    if (newBf !== oldBf) popBadge(node.id, 'badge-bf');

    await sleep(animSpeed);

    let balance = newBf;

    // ──────────────────────────────────────────────
    // PHASE 4 : Déséquilibre → rotation
    // ──────────────────────────────────────────────
    if (balance > 1 && getBalance(node.left) >= 0) {
        hideBalanceRing(node.id);
        unhighlight(node.id, 'rebalance-path');
        setStatus(`Nœud ${node.val} : bf = ${balance} → Rotation Droite`, 'rotate');
        await sleep(animSpeed * 0.5);
        node = await rightRotate(node);

    } else if (balance > 1 && getBalance(node.left) < 0) {
        hideBalanceRing(node.id);
        unhighlight(node.id, 'rebalance-path');
        setStatus(`Nœud ${node.val} : bf = ${balance} → Double Rotation (Gauche puis Droite)`, 'rotate');
        await sleep(animSpeed);
        node.left = await leftRotate(node.left);
        setStatus(`… puis Rotation Droite sur ${node.val}`, 'rotate');
        await sleep(animSpeed * 0.5);
        node = await rightRotate(node);

    } else if (balance < -1 && getBalance(node.right) <= 0) {
        hideBalanceRing(node.id);
        unhighlight(node.id, 'rebalance-path');
        setStatus(`Nœud ${node.val} : bf = ${balance} → Rotation Gauche`, 'rotate');
        await sleep(animSpeed * 0.5);
        node = await leftRotate(node);

    } else if (balance < -1 && getBalance(node.right) > 0) {
        hideBalanceRing(node.id);
        unhighlight(node.id, 'rebalance-path');
        setStatus(`Nœud ${node.val} : bf = ${balance} → Double Rotation (Droite puis Gauche)`, 'rotate');
        await sleep(animSpeed);
        node.right = await rightRotate(node.right);
        setStatus(`… puis Rotation Gauche sur ${node.val}`, 'rotate');
        await sleep(animSpeed * 0.5);
        node = await leftRotate(node);

    } else {
        hideBalanceRing(node.id);
        unhighlight(node.id, 'rebalance-path');
    }

    return node;
}

// ============================================================
// LAYOUT — Calcul des positions (inchangé)
// ============================================================
const NODE_SPACING_X = 70;
const NODE_SPACING_Y = 90;
const PADDING = 60;

function calculatePositions(node) {
    if (!node) return;
    let index = 0;
    function inorder(n) {
        if (!n) return;
        inorder(n.left);
        n._rank = index++;
        inorder(n.right);
    }
    inorder(node);

    function assignCoords(n, depth) {
        if (!n) return;
        assignCoords(n.left, depth + 1);
        n.x = PADDING + n._rank * NODE_SPACING_X;
        n.y = PADDING + depth * NODE_SPACING_Y;
        assignCoords(n.right, depth + 1);
    }
    assignCoords(node, 0);
}

function getTreeBounds() {
    let minX = Infinity, maxX = -Infinity, maxY = -Infinity;
    function walk(n) {
        if (!n) return;
        minX = Math.min(minX, n.x);
        maxX = Math.max(maxX, n.x);
        maxY = Math.max(maxY, n.y);
        walk(n.left);
        walk(n.right);
    }
    walk(root);
    if (minX === Infinity) return null;
    return { minX, maxX, maxY };
}

function autoFitView() {
    const bounds = getTreeBounds();
    if (!bounds) {
        scale = 1; panX = 0; panY = 0;
        applyTransform();
        return;
    }
    const vp = document.getElementById('tree-viewport');
    const vpW = vp.clientWidth;
    const vpH = vp.clientHeight;
    const treeW = (bounds.maxX - bounds.minX) + PADDING * 2 + 60;
    const treeH = bounds.maxY + PADDING + 60;
    const fitScale = Math.min(vpW / treeW, vpH / treeH, 1.5);
    scale = Math.max(0.15, Math.min(fitScale, 1.5));
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.maxY + PADDING) / 2;
    panX = vpW / 2 - centerX * scale;
    panY = vpH / 2 - centerY * scale;
    applyTransform();
}

// ============================================================
// RENDU DES LIGNES SVG (requestAnimationFrame — inchangé)
// ============================================================
function renderLines() {
    const edgesContainer = document.getElementById('edges');
    const container = document.getElementById('tree-container');
    const containerRect = container.getBoundingClientRect();
    Array.from(edgesContainer.children).forEach(line => {
        let pDiv = document.getElementById('node-' + line.dataset.parent);
        let cDiv = document.getElementById('node-' + line.dataset.child);
        if (pDiv && cDiv) {
            const pRect = pDiv.getBoundingClientRect();
            const cRect = cDiv.getBoundingClientRect();
            const px = (pRect.left + pRect.width / 2 - containerRect.left) / scale;
            const py = (pRect.top + pRect.height / 2 - containerRect.top) / scale;
            const cx = (cRect.left + cRect.width / 2 - containerRect.left) / scale;
            const cy = (cRect.top + cRect.height / 2 - containerRect.top) / scale;
            line.setAttribute('x1', px);
            line.setAttribute('y1', py);
            line.setAttribute('x2', cx);
            line.setAttribute('y2', cy);
        }
    });
    requestAnimationFrame(renderLines);
}

// ============================================================
// HOOKS UI
// ============================================================
async function uiInsert() {
    if (isAnimating) return;
    const val = parseInt(document.getElementById('valInput').value);
    if (isNaN(val)) return;
    document.getElementById('valInput').value = '';
    isAnimating = true;
    isInstant = false;
    setButtonsDisabled(true);

    root = await insertAsync(root, val);

    updateDOMTree();
    setStatus(`✓ Insertion de ${val} terminée.`, 'done');
    isAnimating = false;
    setButtonsDisabled(false);
}

async function uiDelete() {
    if (isAnimating) return;
    const val = parseInt(document.getElementById('valInput').value);
    if (isNaN(val)) return;
    document.getElementById('valInput').value = '';
    isAnimating = true;
    isInstant = false;
    setButtonsDisabled(true);

    root = await deleteAsync(root, val);

    updateDOMTree();
    setStatus(`✓ Suppression de ${val} terminée.`, 'done');
    isAnimating = false;
    setButtonsDisabled(false);
}

function uiClear() {
    if (isAnimating) return;
    root = null;
    nextNodeId = 1;
    document.getElementById('nodes').innerHTML = '';
    document.getElementById('edges').innerHTML = '';
    setStatus("Arbre vidé.", 'done');
}

async function uiBuildFromList() {
    if (isAnimating) return;
    const input = document.getElementById('listInput').value.trim();
    if (!input) return;

    const values = input.split(/[\s,;]+/).map(Number).filter(v => !isNaN(v));
    if (values.length === 0) { setStatus("Liste invalide.", 'done'); return; }

    root = null;
    nextNodeId = 1;
    document.getElementById('nodes').innerHTML = '';
    document.getElementById('edges').innerHTML = '';

    document.getElementById('listInput').value = '';
    isAnimating = true;
    setButtonsDisabled(true);

    // Construction instantanée (sans animation)
    isInstant = true;
    for (let val of values) {
        root = await insertAsync(root, val);
    }
    isInstant = false;

    updateDOMTree();
    autoFitView();
    setStatus(`✓ Arbre construit avec ${values.length} valeurs.`, 'done');
    isAnimating = false;
    setButtonsDisabled(false);
}

// Touche Entrée sur les inputs
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('valInput').addEventListener('keydown', e => {
        if (e.key === 'Enter') uiInsert();
    });
    document.getElementById('listInput').addEventListener('keydown', e => {
        if (e.key === 'Enter') uiBuildFromList();
    });
});

// ============================================================
// INITIALISATION
// ============================================================
async function init() {
    isInstant = true;
    const initialValues = [17, 8, 20, 3, 13, 18, 23, 1, 6, 10, 15, 19, 22, 24, 2, 4, 7, 9, 11, 14, 16, 21, 25, 12];
    for (let val of initialValues) {
        root = await insertAsync(root, val);
    }
    isInstant = false;

    updateDOMTree();
    autoFitView();
    requestAnimationFrame(renderLines);
    setStatus('Arbre AVL initialisé. Prêt.', 'done');
}

window.onload = init;

