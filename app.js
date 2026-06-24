/**
 * OS Deadlock Educational Web Application
 * Core JavaScript Logic
 */

// ==========================================
// 1. Web Audio API Sound Synthesizer
// ==========================================
const SoundSynth = (() => {
    let audioCtx = null;
    let soundEnabled = true;

    function initAudio() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    }

    function playTone(freq, type, duration, volume = 0.1, delay = 0) {
        if (!soundEnabled) return;
        initAudio();
        
        setTimeout(() => {
            try {
                const osc = audioCtx.createOscillator();
                const gainNode = audioCtx.createGain();
                
                osc.type = type;
                osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
                
                gainNode.gain.setValueAtTime(volume, audioCtx.currentTime);
                // Exponential decay
                gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + duration);
                
                osc.connect(gainNode);
                gainNode.connect(audioCtx.destination);
                
                osc.start();
                osc.stop(audioCtx.currentTime + duration);
            } catch (e) {
                console.error("Audio playback error:", e);
            }
        }, delay * 1000);
    }

    return {
        toggle: () => {
            soundEnabled = !soundEnabled;
            return soundEnabled;
        },
        isEnabled: () => soundEnabled,
        playClick: () => {
            playTone(800, 'sine', 0.1, 0.05);
        },
        playSuccess: () => {
            // Arpeggio
            playTone(523.25, 'triangle', 0.3, 0.15, 0); // C5
            playTone(659.25, 'triangle', 0.3, 0.15, 0.08); // E5
            playTone(783.99, 'triangle', 0.3, 0.15, 0.16); // G5
            playTone(1046.50, 'triangle', 0.5, 0.2, 0.24); // C6
        },
        playError: () => {
            // Low buzz downward sweep
            playTone(150, 'sawtooth', 0.4, 0.2, 0);
            playTone(110, 'sawtooth', 0.4, 0.2, 0.1);
        },
        playEat: () => {
            playTone(440, 'sine', 0.15, 0.08);
            playTone(554.37, 'sine', 0.15, 0.08, 0.05);
        }
    };
})();

// ==========================================
// 2. Navigation & Collapsible Accordion
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    // Nav Navigation links smooth active toggle on scroll
    const sections = document.querySelectorAll("section");
    const navButtons = document.querySelectorAll(".nav-btn");

    window.addEventListener("scroll", () => {
        let current = "";
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.clientHeight;
            if (pageYOffset >= (sectionTop - 120)) {
                current = section.getAttribute("id");
            }
        });

        navButtons.forEach(btn => {
            btn.classList.remove("active");
            if (btn.getAttribute("href") === `#${current}`) {
                btn.classList.add("active");
            }
        });
    });

    // Nav click handlers
    navButtons.forEach(btn => {
        btn.addEventListener("click", (e) => {
            SoundSynth.playClick();
            navButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
        });
    });

    // Accordion Logic
    const strategyHeaders = document.querySelectorAll(".strategy-header");
    strategyHeaders.forEach(header => {
        header.addEventListener("click", () => {
            SoundSynth.playClick();
            const row = header.parentElement;
            const isOpen = row.classList.contains("open");
            
            // Close all
            document.querySelectorAll(".strategy-row").forEach(r => r.classList.remove("open"));
            
            if (!isOpen) {
                row.classList.add("open");
            }
        });
    });
    // Open first strategy by default
    document.querySelector(".strategy-row")?.classList.add("open");
});

// ==========================================
// 3. Resource Allocation Graph (RAG) Engine
// ==========================================
const RAGEngine = (() => {
    let canvas, ctx;
    let nodes = [];
    let edges = [];
    let draggedNode = null;
    let dragOffset = { x: 0, y: 0 };
    let deadlockedNodes = new Set();
    let deadlockedEdges = [];

    // Predefined Presets
    const presets = {
        deadlock: {
            nodes: [
                { id: 'p1', name: 'P1', type: 'process', x: 150, y: 150 },
                { id: 'p2', name: 'P2', type: 'process', x: 450, y: 150 },
                { id: 'r1', name: 'R1', type: 'resource', x: 300, y: 80, instances: 1 },
                { id: 'r2', name: 'R2', type: 'resource', x: 300, y: 240, instances: 1 }
            ],
            edges: [
                { from: 'r1', to: 'p1', type: 'allocate' }, // R1 is allocated to P1
                { from: 'p1', to: 'r2', type: 'request' },  // P1 requests R2
                { from: 'r2', to: 'p2', type: 'allocate' }, // R2 is allocated to P2
                { from: 'p2', to: 'r1', type: 'request' }   // P2 requests R1
            ]
        },
        safe: {
            nodes: [
                { id: 'p1', name: 'P1', type: 'process', x: 150, y: 150 },
                { id: 'p2', name: 'P2', type: 'process', x: 450, y: 150 },
                { id: 'r1', name: 'R1', type: 'resource', x: 300, y: 80, instances: 1 },
                { id: 'r2', name: 'R2', type: 'resource', x: 300, y: 240, instances: 1 }
            ],
            edges: [
                { from: 'r1', to: 'p1', type: 'allocate' },
                { from: 'p2', to: 'r2', type: 'allocate' },
                { from: 'p1', to: 'r2', type: 'request' }
            ]
        },
        loopNoDeadlock: {
            nodes: [
                { id: 'p1', name: 'P1', type: 'process', x: 150, y: 120 },
                { id: 'p2', name: 'P2', type: 'process', x: 450, y: 120 },
                { id: 'p3', name: 'P3', type: 'process', x: 450, y: 280 },
                { id: 'p4', name: 'P4', type: 'process', x: 150, y: 280 },
                { id: 'r1', name: 'R1', type: 'resource', x: 300, y: 80, instances: 2 },
                { id: 'r2', name: 'R2', type: 'resource', x: 300, y: 300, instances: 1 }
            ],
            edges: [
                { from: 'r1', to: 'p1', type: 'allocate' },
                { from: 'r1', to: 'p2', type: 'allocate' },
                { from: 'p1', to: 'r2', type: 'request' },
                { from: 'r2', to: 'p3', type: 'allocate' },
                { from: 'p3', to: 'r1', type: 'request' },
                // P4 is holding nothing but can allocate/release? Or P2 doesn't wait
                // In this case, P2 is holding R1 but NOT waiting for anything. 
                // Since P2 has no request, P2 can finish and release R1, breaking the loop!
            ]
        }
    };

    function init() {
        canvas = document.getElementById("ragCanvas");
        if (!canvas) return;
        ctx = canvas.getContext("2d");
        
        // Resize canvas to match screen/container
        resizeCanvas();
        window.addEventListener("resize", resizeCanvas);

        // Canvas mouse event listeners for dragging nodes
        canvas.addEventListener("mousedown", onMouseDown);
        canvas.addEventListener("mousemove", onMouseMove);
        canvas.addEventListener("mouseup", onMouseUp);
        canvas.addEventListener("mouseleave", onMouseUp);

        // Control UI listeners
        document.getElementById("btnAddNode").addEventListener("click", addNewNode);
        document.getElementById("btnAddEdge").addEventListener("click", addNewEdge);
        document.getElementById("btnClearGraph").addEventListener("click", clearGraph);
        document.getElementById("btnPresetDeadlock").addEventListener("click", () => loadPreset('deadlock'));
        document.getElementById("btnPresetSafe").addEventListener("click", () => loadPreset('safe'));
        document.getElementById("btnPresetLoopNoDeadlock").addEventListener("click", () => loadPreset('loopNoDeadlock'));
        
        // Resource Instance toggle display
        document.getElementById("nodeType").addEventListener("change", (e) => {
            const row = document.getElementById("resourceInstanceRow");
            if (e.target.value === "resource") {
                row.style.display = "grid";
            } else {
                row.style.display = "none";
            }
        });

        // Initialize with deadlock preset
        loadPreset('deadlock');
    }

    function resizeCanvas() {
        const wrapper = canvas.parentElement;
        canvas.width = wrapper.clientWidth;
        canvas.height = Math.max(400, wrapper.clientHeight);
        draw();
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 1. Draw Edges
        edges.forEach(edge => {
            const fromNode = nodes.find(n => n.id === edge.from);
            const toNode = nodes.find(n => n.id === edge.to);
            if (!fromNode || !toNode) return;

            // Check if this edge is in the deadlocked set
            const isDeadlocked = deadlockedEdges.some(de => 
                (de.from === edge.from && de.to === edge.to)
            );
            
            drawArrow(fromNode.x, fromNode.y, toNode.x, toNode.y, isDeadlocked, edge.type);
        });

        // 2. Draw Nodes
        nodes.forEach(node => {
            const isDeadlocked = deadlockedNodes.has(node.id);
            if (node.type === 'process') {
                drawProcessNode(node.x, node.y, node.name, isDeadlocked);
            } else {
                drawResourceNode(node.x, node.y, node.name, node.instances || 1, isDeadlocked);
            }
        });
    }

    function drawProcessNode(x, y, name, isDeadlocked) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, 26, 0, 2 * Math.PI);
        
        // Fill color
        ctx.fillStyle = isDeadlocked ? "#FFEBEE" : "#FFEEDD";
        ctx.fill();

        // Stroke color
        ctx.lineWidth = 3;
        ctx.strokeStyle = isDeadlocked ? "#E63946" : "#8C6239";
        ctx.stroke();

        // Text
        ctx.fillStyle = "#2C1A11";
        ctx.font = "bold 13px 'Kanit', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(name, x, y);
        ctx.restore();
    }

    function drawResourceNode(x, y, name, instances, isDeadlocked) {
        ctx.save();
        const size = 52;
        const hSize = size / 2;
        
        // Draw Rounded Rect
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(x - hSize, y - hSize, size, size, 8);
        } else {
            ctx.rect(x - hSize, y - hSize, size, size);
        }
        ctx.fillStyle = isDeadlocked ? "#FFEBEE" : "#E8F5E9";
        ctx.fill();

        ctx.lineWidth = 3;
        ctx.strokeStyle = isDeadlocked ? "#E63946" : "#2A9D8F";
        ctx.stroke();

        // Title text
        ctx.fillStyle = "#2C1A11";
        ctx.font = "bold 11px 'Kanit', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(name, x, y - 12);

        // Instance dots
        ctx.fillStyle = isDeadlocked ? "#E63946" : "#2A9D8F";
        const dotRadius = 4;
        if (instances === 1) {
            ctx.beginPath();
            ctx.arc(x, y + 8, dotRadius, 0, 2 * Math.PI);
            ctx.fill();
        } else if (instances === 2) {
            ctx.beginPath();
            ctx.arc(x - 8, y + 8, dotRadius, 0, 2 * Math.PI);
            ctx.arc(x + 8, y + 8, dotRadius, 0, 2 * Math.PI);
            ctx.fill();
        } else if (instances === 3) {
            ctx.beginPath();
            ctx.arc(x - 10, y + 10, dotRadius, 0, 2 * Math.PI);
            ctx.arc(x, y + 2, dotRadius, 0, 2 * Math.PI);
            ctx.arc(x + 10, y + 10, dotRadius, 0, 2 * Math.PI);
            ctx.fill();
        } else { // 4 instances
            ctx.beginPath();
            ctx.arc(x - 8, y + 2, dotRadius, 0, 2 * Math.PI);
            ctx.arc(x + 8, y + 2, dotRadius, 0, 2 * Math.PI);
            ctx.arc(x - 8, y + 12, dotRadius, 0, 2 * Math.PI);
            ctx.arc(x + 8, y + 12, dotRadius, 0, 2 * Math.PI);
            ctx.fill();
        }
        ctx.restore();
    }

    function drawArrow(x1, y1, x2, y2, isDeadlocked, type) {
        ctx.save();
        
        // Calculate collision boundaries
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const radiusSource = 26; // collision boundary for process circle
        const radiusTarget = 26; // approx collision boundary for target resource/process

        const startX = x1 + radiusSource * Math.cos(angle);
        const startY = y1 + radiusSource * Math.sin(angle);
        const endX = x2 - radiusTarget * Math.cos(angle);
        const endY = y2 - radiusTarget * Math.sin(angle);

        // Line properties
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        
        ctx.lineWidth = isDeadlocked ? 3 : 2;
        ctx.strokeStyle = isDeadlocked ? "#E63946" : (type === 'request' ? "#E76F51" : "#8C6239");
        
        if (type === 'request' && !isDeadlocked) {
            ctx.setLineDash([4, 4]); // Dashed line for requests
        } else {
            ctx.setLineDash([]);
        }
        
        ctx.stroke();

        // Draw Arrowhead
        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(endX - 10 * Math.cos(angle - Math.PI / 6), endY - 10 * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(endX - 10 * Math.cos(angle + Math.PI / 6), endY - 10 * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fillStyle = isDeadlocked ? "#E63946" : (type === 'request' ? "#E76F51" : "#8C6239");
        ctx.fill();

        ctx.restore();
    }

    // Graph Drag logic
    function onMouseDown(e) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Find clicked node
        draggedNode = nodes.find(node => {
            const dist = Math.hypot(node.x - mouseX, node.y - mouseY);
            return dist < 30; // node size radius threshold
        });

        if (draggedNode) {
            dragOffset.x = draggedNode.x - mouseX;
            dragOffset.y = draggedNode.y - mouseY;
            SoundSynth.playClick();
        }
    }

    function onMouseMove(e) {
        if (!draggedNode) return;
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Update positions keeping it in bounds
        draggedNode.x = Math.max(30, Math.min(canvas.width - 30, mouseX + dragOffset.x));
        draggedNode.y = Math.max(30, Math.min(canvas.height - 30, mouseY + dragOffset.y));
        draw();
    }

    function onMouseUp() {
        if (draggedNode) {
            draggedNode = null;
            analyzeGraph();
        }
    }

    // Dynamic Nodes & Edges handling
    function addNewNode() {
        const nameInput = document.getElementById("nodeName");
        const typeSelect = document.getElementById("nodeType");
        const instanceInput = document.getElementById("resourceInstances");

        const name = nameInput.value.trim().toUpperCase();
        const type = typeSelect.value;
        const instances = parseInt(instanceInput.value) || 1;

        if (!name) {
            alert("กรุณาระบุชื่อโหนดย่อย");
            return;
        }

        // Check duplicates
        if (nodes.some(n => n.name === name)) {
            alert("ชื่อโหนดนี้มีอยู่แล้วในแผนภาพ");
            return;
        }

        const id = 'node_' + Date.now();
        const newNode = {
            id: id,
            name: name,
            type: type,
            x: Math.random() * (canvas.width - 100) + 50,
            y: Math.random() * (canvas.height - 100) + 50
        };

        if (type === 'resource') {
            newNode.instances = instances;
        }

        nodes.push(newNode);
        nameInput.value = "";
        SoundSynth.playClick();
        
        updateControlsUI();
        analyzeGraph();
    }

    function deleteNode(id) {
        SoundSynth.playClick();
        nodes = nodes.filter(n => n.id !== id);
        edges = edges.filter(e => e.from !== id && e.to !== id);
        updateControlsUI();
        analyzeGraph();
    }

    function addNewEdge() {
        const fromId = document.getElementById("edgeFrom").value;
        const toId = document.getElementById("edgeTo").value;

        if (!fromId || !toId) {
            alert("กรุณาเลือกโหนดต้นทางและปลายทาง");
            return;
        }

        if (fromId === toId) {
            alert("ไม่สามารถเชื่อมโยงเส้นเข้าหาตัวเองได้");
            return;
        }

        const fromNode = nodes.find(n => n.id === fromId);
        const toNode = nodes.find(n => n.id === toId);

        if (fromNode.type === toNode.type) {
            alert("เส้นสายจองต้องวิ่งสลับระหว่าง Process และ Resource เท่านั้น!");
            return;
        }

        // Type is 'allocate' if from Resource to Process, else 'request'
        const edgeType = (fromNode.type === 'resource') ? 'allocate' : 'request';

        // Check duplicates
        if (edges.some(e => e.from === fromId && e.to === toId)) {
            alert("เส้นเชื่อมนี้ถูกวาดไว้แล้ว");
            return;
        }

        // Check if resource allocations exceed instances
        if (edgeType === 'allocate') {
            const currentAllocated = edges.filter(e => e.from === fromId && e.type === 'allocate').length;
            if (currentAllocated >= (fromNode.instances || 1)) {
                alert(`ทรัพยากร ${fromNode.name} มีตั๋วจำกัดเพียง ${fromNode.instances} สิทธิ์ และถูกจองหมดแล้ว!`);
                return;
            }
        }

        edges.push({
            from: fromId,
            to: toId,
            type: edgeType
        });

        SoundSynth.playClick();
        updateControlsUI();
        analyzeGraph();
    }

    function deleteEdge(from, to) {
        SoundSynth.playClick();
        edges = edges.filter(e => !(e.from === from && e.to === to));
        updateControlsUI();
        analyzeGraph();
    }

    function clearGraph() {
        SoundSynth.playClick();
        nodes = [];
        edges = [];
        updateControlsUI();
        analyzeGraph();
    }

    function loadPreset(presetName) {
        SoundSynth.playClick();
        const preset = presets[presetName];
        if (!preset) return;

        // Clone nodes and edges
        nodes = preset.nodes.map(n => ({ ...n }));
        edges = preset.edges.map(e => ({ ...e }));

        updateControlsUI();
        analyzeGraph();
    }

    // Repopulate Dropdowns and Chip Lists
    function updateControlsUI() {
        const fromSel = document.getElementById("edgeFrom");
        const toSel = document.getElementById("edgeTo");
        const nodeContainer = document.getElementById("nodeListContainer");
        const edgeContainer = document.getElementById("edgeListContainer");

        // Clear
        fromSel.innerHTML = "";
        toSel.innerHTML = "";
        nodeContainer.innerHTML = "";
        edgeContainer.innerHTML = "";

        // Nodes
        nodes.forEach(node => {
            // Dropdowns
            const opt1 = document.createElement("option");
            opt1.value = node.id;
            opt1.textContent = node.name;
            fromSel.appendChild(opt1);

            const opt2 = document.createElement("option");
            opt2.value = node.id;
            opt2.textContent = node.name;
            toSel.appendChild(opt2);

            // Node chips
            const chip = document.createElement("span");
            chip.className = "node-chip";
            chip.innerHTML = `${node.name} <span class="node-chip-delete" data-id="${node.id}">×</span>`;
            nodeContainer.appendChild(chip);
        });

        // Add Delete Node Listeners
        nodeContainer.querySelectorAll(".node-chip-delete").forEach(el => {
            el.addEventListener("click", (e) => {
                deleteNode(e.target.dataset.id);
            });
        });

        // Edges List
        edges.forEach(edge => {
            const fromName = nodes.find(n => n.id === edge.from)?.name || "?";
            const toName = nodes.find(n => n.id === edge.to)?.name || "?";
            const typeLabel = (edge.type === 'allocate') ? " allocation " : " requests ";
            const arrowChar = (edge.type === 'allocate') ? "→" : "⇢";

            const item = document.createElement("div");
            item.className = "edge-item";
            item.innerHTML = `
                <span>${fromName} ${arrowChar} ${toName} <span style="font-size: 0.75rem; color: var(--text-muted);">(${typeLabel})</span></span>
                <span class="node-chip-delete" data-from="${edge.from}" data-to="${edge.to}">×</span>
            `;
            edgeContainer.appendChild(item);
        });

        // Add Delete Edge Listeners
        edgeContainer.querySelectorAll(".node-chip-delete").forEach(el => {
            el.addEventListener("click", (e) => {
                deleteEdge(e.target.dataset.from, e.target.dataset.to);
            });
        });
    }

    // Deadlock Graph Reduction Algorithm (Supports multiple instances)
    function analyzeGraph() {
        deadlockedNodes.clear();
        deadlockedEdges = [];

        const processes = nodes.filter(n => n.type === 'process');
        const resources = nodes.filter(n => n.type === 'resource');

        if (processes.length === 0) {
            updateStatusUI(false);
            draw();
            return;
        }

        // Initialize vectors
        // Available resources: total instances - allocated instances
        const available = {};
        resources.forEach(r => {
            const allocatedCount = edges.filter(e => e.from === r.id && e.type === 'allocate').length;
            available[r.id] = (r.instances || 1) - allocatedCount;
        });

        // Allocation and Request vectors per process
        const allocation = {};
        const request = {};

        processes.forEach(p => {
            allocation[p.id] = {};
            request[p.id] = {};
            resources.forEach(r => {
                allocation[p.id][r.id] = 0;
                request[p.id][r.id] = 0;
            });
        });

        edges.forEach(e => {
            if (e.type === 'allocate') {
                // Resource -> Process
                if (allocation[e.to]) {
                    allocation[e.to][e.from] = (allocation[e.to][e.from] || 0) + 1;
                }
            } else if (e.type === 'request') {
                // Process -> Resource
                if (request[e.from]) {
                    request[e.from][e.to] = (request[e.from][e.to] || 0) + 1;
                }
            }
        });

        // Reducibility tracking
        const finished = {};
        processes.forEach(p => {
            // A process with no allocations is finished if it has no requests, or we will check in reduction loop
            // But we initialize as false
            finished[p.id] = false;
        });

        let work = { ...available };
        let progress = true;

        while (progress) {
            progress = false;
            for (let i = 0; i < processes.length; i++) {
                const pId = processes[i].id;
                if (finished[pId]) continue;

                // Check if request <= work
                let canFinish = true;
                for (const rId in request[pId]) {
                    if (request[pId][rId] > (work[rId] || 0)) {
                        canFinish = false;
                        break;
                    }
                }

                if (canFinish) {
                    // Reduce graph: assume process runs to completion, releases resources
                    for (const rId in allocation[pId]) {
                        work[rId] = (work[rId] || 0) + allocation[pId][rId];
                    }
                    finished[pId] = true;
                    progress = true;
                }
            }
        }

        // Any process NOT marked finished is in a DEADLOCK state!
        const deadlockedProcs = processes.filter(p => !finished[p.id]);

        if (deadlockedProcs.length > 0) {
            // We have a deadlock
            deadlockedProcs.forEach(p => deadlockedNodes.add(p.id));

            // Find resources that are involved in the deadlock
            // A resource is involved if it is held by a deadlocked process AND requested by a deadlocked process
            const deadlockedRes = new Set();

            edges.forEach(e => {
                // Allocation: Resource -> Process
                if (e.type === 'allocate' && deadlockedNodes.has(e.to)) {
                    deadlockedRes.add(e.from);
                }
                // Request: Process -> Resource
                if (e.type === 'request' && deadlockedNodes.has(e.from)) {
                    deadlockedRes.add(e.to);
                }
            });

            deadlockedRes.forEach(rId => deadlockedNodes.add(rId));

            // Populate deadlocked edges for flashing display
            edges.forEach(e => {
                if (deadlockedNodes.has(e.from) && deadlockedNodes.has(e.to)) {
                    // Both nodes are deadlocked, this edge is part of the deadlock loop!
                    deadlockedEdges.push(e);
                }
            });

            updateStatusUI(true, Array.from(deadlockedProcs).map(p => p.name).join(", "));
        } else {
            updateStatusUI(false);
        }

        draw();
    }

    function updateStatusUI(hasDeadlock, procNames = "") {
        const overlay = document.getElementById("ragStatusOverlay");
        const statusTxt = document.getElementById("ragStatusText");
        const statusDesc = document.getElementById("ragStatusDesc");

        if (hasDeadlock) {
            overlay.classList.add("deadlock-active");
            statusTxt.textContent = "ตรวจพบวงจรอับ (DEADLOCK DETECTED!)";
            statusDesc.textContent = `กระบวนการค้างคา: [ ${procNames} ] ควรรีเซ็ตหรือทลายวงกู้คืนระบบ`;
        } else {
            overlay.classList.remove("deadlock-active");
            statusTxt.textContent = "ระบบทำงานปกติ (SAFE STATE)";
            statusDesc.textContent = "ไม่มีการรอคอยเป็นวงกลม สามารถใช้งานต่อไปได้";
        }
    }

    return {
        init: init
    };
})();

// ==========================================
// 4. Educational Game Manager ("OS Resource Commander")
// ==========================================
const GameManager = (() => {
    let currentLvl = 1;
    let score = 0;

    // Level States
    let lvl1State = {
        selectedNode: null,
        // Nodes: P1 (cost 50), P2 (cost 10), P3 (cost 25, not in loop), P4 (cost 30)
        // Loop: P1 -> R1 -> P2 -> R2 -> P1
        nodes: [
            { id: 'p1', name: 'P1', type: 'process', x: 80, y: 150, cost: 50, desc: 'งานหลักด่วนพิเศษ (ความสำคัญสูง)' },
            { id: 'p2', name: 'P2', type: 'process', x: 260, y: 150, cost: 10, desc: 'งานซิงค์ข้อมูลแบ็คกราวด์ (ความสำคัญต่ำ)' },
            { id: 'p3', name: 'P3', type: 'process', x: 170, y: 270, cost: 25, desc: 'งานเซฟไฟล์งานพิมพ์ (ความสำคัญปานกลาง)' },
            { id: 'r1', name: 'R1', type: 'resource', x: 170, y: 60, instances: 1 },
            { id: 'r2', name: 'R2', type: 'resource', x: 170, y: 180, instances: 1 }
        ],
        edges: [
            { from: 'r1', to: 'p1', type: 'allocate' },
            { from: 'p1', to: 'r2', type: 'request' },
            { from: 'r2', to: 'p2', type: 'allocate' },
            { from: 'p2', to: 'r1', type: 'request' },
            { from: 'p3', to: 'r2', type: 'request' } // P3 is requesting R2 but not part of cycle
        ],
        active: true
    };

    let lvl2State = {
        // Banker's Algorithm Decisions
        currentScenarioIndex: 0,
        scenarios: [
            {
                available: { A: 2, B: 1 },
                processes: [
                    { name: 'P1', alloc: { A: 1, B: 1 }, max: { A: 2, B: 2 }, need: { A: 1, B: 1 } },
                    { name: 'P2', alloc: { A: 2, B: 0 }, max: { A: 3, B: 1 }, need: { A: 1, B: 1 } },
                    { name: 'P3', alloc: { A: 0, B: 1 }, max: { A: 1, B: 1 }, need: { A: 1, B: 0 } }
                ],
                request: { proc: 'P3', req: { A: 1, B: 0 } },
                isSafe: true // Granting P3: Available becomes [1, 1]. P3 needs [1, 0] <= [1, 1], can finish. Releases [1, 1], Avail=[1,2]. P1 needs [1,1] <= [1,2], finishes. Avail=[2,3], P2 finishes.
                // Correct Choice: Approve
            },
            {
                available: { A: 1, B: 2 },
                processes: [
                    { name: 'P1', alloc: { A: 2, B: 1 }, max: { A: 4, B: 2 }, need: { A: 2, B: 1 } },
                    { name: 'P2', alloc: { A: 1, B: 0 }, max: { A: 3, B: 2 }, need: { A: 2, B: 2 } },
                    { name: 'P3', alloc: { A: 1, B: 1 }, max: { A: 2, B: 1 }, need: { A: 1, B: 0 } }
                ],
                request: { proc: 'P2', req: { A: 1, B: 1 } },
                isSafe: false // Granting P2: Avail becomes [0, 1]. Remaining need of P3 is [1, 0] > [0, 1]. P1 is [2, 1] > [0, 1]. P2 is [1, 1] > [0, 1]. No process can finish! Leads to Unsafe State.
                // Correct Choice: Deny
            },
            {
                available: { A: 3, B: 3 },
                processes: [
                    { name: 'P1', alloc: { A: 0, B: 1 }, max: { A: 7, B: 5 }, need: { A: 7, B: 4 } },
                    { name: 'P2', alloc: { A: 2, B: 0 }, max: { A: 3, B: 2 }, need: { A: 1, B: 2 } },
                    { name: 'P3', alloc: { A: 3, B: 0 }, max: { A: 9, B: 0 }, need: { A: 6, B: 0 } }
                ],
                request: { proc: 'P2', req: { A: 1, B: 2 } },
                isSafe: true // Granting P2: Available becomes [2, 1]. P2 remaining need becomes [0, 0] <= [2, 1], finishes. Releases all allocations. System remains Safe.
                // Correct Choice: Approve
            }
        ]
    };

    let lvl3State = {
        philosophers: [],
        chopsticks: [],
        policy: 'none', // none, ordering, limit, evenodd
        mealsEaten: 0,
        active: false,
        timer: null,
        simulationSpeed: 1000 // ms per tick
    };

    function init() {
        // Tab clicks (only unlocked levels)
        document.getElementById("tab-lvl-1").addEventListener("click", () => switchLevel(1));
        document.getElementById("tab-lvl-2").addEventListener("click", () => switchLevel(2));
        document.getElementById("tab-lvl-3").addEventListener("click", () => switchLevel(3));

        // Sound toggle
        const btnSound = document.getElementById("btnSoundToggle");
        btnSound.addEventListener("click", () => {
            const enabled = SoundSynth.toggle();
            btnSound.innerHTML = enabled ? `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5 6 9H2v6h4l5 4V5zM15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
            ` : `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5 6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
            `;
            SoundSynth.playClick();
        });

        // Level 1 Action
        document.getElementById("btnL1Kill").addEventListener("click", performL1Abort);

        // Level 2 Actions
        document.getElementById("btnL2Approve").addEventListener("click", () => handleL2Decision(true));
        document.getElementById("btnL2Deny").addEventListener("click", () => handleL2Decision(false));

        // Level 3 Actions
        document.getElementById("btnL3Start").addEventListener("click", startL3Simulation);
        document.getElementById("btnL3Reset").addEventListener("click", resetL3Simulation);
        document.getElementById("l3-policy-select").addEventListener("change", (e) => {
            lvl3State.policy = e.target.value;
            SoundSynth.playClick();
        });

        // Modal Action
        document.getElementById("btnModalNext").addEventListener("click", dismissModal);

        // Setup Level 1
        setupLevel1();
    }

    function switchLevel(lvlNum) {
        const tab = document.getElementById(`tab-lvl-${lvlNum}`);
        if (tab.classList.contains("locked")) return;
        
        SoundSynth.playClick();
        
        // Update UI Tabs
        document.querySelectorAll(".level-tab").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");

        // Hide all views, show selected
        document.getElementById("lvl-1-view").style.display = "none";
        document.getElementById("lvl-2-view").style.display = "none";
        document.getElementById("lvl-3-view").style.display = "none";
        document.getElementById(`lvl-${lvlNum}-view`).style.display = "block";

        currentLvl = lvlNum;
        document.getElementById("game-stage").textContent = `${lvlNum} / 3`;

        // Clear timers if leaving Level 3
        if (lvlNum !== 3) {
            resetL3Simulation();
        }

        // Initialize Level
        if (lvlNum === 1) setupLevel1();
        if (lvlNum === 2) setupLevel2();
        if (lvlNum === 3) setupLevel3();
    }

    function showModal(title, text, isWin, nextBtnText = "ดำเนินการต่อ") {
        if (isWin) {
            SoundSynth.playSuccess();
            document.getElementById("modalIcon").textContent = "🎉";
            document.getElementById("modalIcon").className = "modal-icon win";
        } else {
            SoundSynth.playError();
            document.getElementById("modalIcon").textContent = "⚠️";
            document.getElementById("modalIcon").className = "modal-icon lose";
        }
        document.getElementById("modalTitle").textContent = title;
        document.getElementById("modalBody").textContent = text;
        
        const nextBtn = document.getElementById("btnModalNext");
        nextBtn.textContent = nextBtnText;
        nextBtn.dataset.success = isWin ? "true" : "false";

        document.getElementById("gameModal").classList.add("active");
    }

    function dismissModal() {
        SoundSynth.playClick();
        document.getElementById("gameModal").classList.remove("active");
        
        const nextBtn = document.getElementById("btnModalNext");
        const success = nextBtn.dataset.success === "true";

        if (success) {
            // Unlock next level
            if (currentLvl === 1) {
                unlockLevel(2);
                switchLevel(2);
            } else if (currentLvl === 2) {
                unlockLevel(3);
                switchLevel(3);
            } else {
                // Game completely won
                showModal("ยินดีด้วย!", "คุณเรียนรู้หลักการจองและไขวงจรอับ (Deadlock) ได้ครบทุกภารกิจแล้ว! หวังว่าจะจดจำความรู้ระบบปฏิบัติการชุดนี้ไปปรับใช้นะครับ!", true, "เล่นด่าน 1 อีกครั้ง");
                currentLvl = 3; // Reset path
                nextBtn.dataset.success = "false"; // Loop back
            }
        } else {
            // Retry current level
            if (currentLvl === 1) setupLevel1();
            if (currentLvl === 2) setupLevel2();
            if (currentLvl === 3) setupLevel3();
        }
    }

    function unlockLevel(lvlNum) {
        document.getElementById(`tab-lvl-${lvlNum}`).classList.remove("locked");
    }

    // ==========================================
    // LEVEL 1: Break Loop (Preemption Puzzle)
    // ==========================================
    function setupLevel1() {
        lvl1State.selectedNode = null;
        lvl1State.nodes = [
            { id: 'p1', name: 'P1', type: 'process', x: 80, y: 150, cost: 50, desc: 'งานด่วนพิเศษ (ความสำคัญสูง: ค่ากู้คืนสูงถึง 50 แต้ม)' },
            { id: 'p2', name: 'P2', type: 'process', x: 260, y: 150, cost: 10, desc: 'งานเบื้องหลังดึงเว็บไอคอน (ความสำคัญต่ำ: ค่ากู้คืนเพียง 10 แต้ม)' },
            { id: 'p3', name: 'P3', type: 'process', x: 170, y: 270, cost: 25, desc: 'งานจัดเซฟไฟล์งานพิมพ์ (ความสำคัญกลาง: ค่ากู้คืน 25 แต้ม)' },
            { id: 'r1', name: 'R1', type: 'resource', x: 170, y: 60, instances: 1 },
            { id: 'r2', name: 'R2', type: 'resource', x: 170, y: 180, instances: 1 }
        ];
        lvl1State.edges = [
            { from: 'r1', to: 'p1', type: 'allocate' },
            { from: 'p1', to: 'r2', type: 'request' },
            { from: 'r2', to: 'p2', type: 'allocate' },
            { from: 'p2', to: 'r1', type: 'request' },
            { from: 'p3', to: 'r2', type: 'request' }
        ];
        drawL1();
        
        // Reset sidebar
        document.getElementById("l1-selection-details").innerHTML = `
            <p style="color: var(--text-muted); font-size: 0.9rem;">คลิกเลือกโหนดกระบวนการ (สีส้ม) ในกล่องแผนภาพด้านซ้ายเพื่อประเมินผลกระทบ...</p>
        `;
        document.getElementById("btnL1Kill").style.display = "none";
    }

    function drawL1() {
        const svg = document.getElementById("l1-svg");
        svg.innerHTML = ""; // Clear

        // Loop and render Edges
        lvl1State.edges.forEach(edge => {
            const from = lvl1State.nodes.find(n => n.id === edge.from);
            const to = lvl1State.nodes.find(n => n.id === edge.to);
            if (!from || !to) return;

            // Draw line
            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            
            // Adjust endpoints slightly for circles
            const angle = Math.atan2(to.y - from.y, to.x - from.x);
            const offsetStart = 20;
            const offsetEnd = 20;
            
            line.setAttribute("x1", from.x + offsetStart * Math.cos(angle));
            line.setAttribute("y1", from.y + offsetStart * Math.sin(angle));
            line.setAttribute("x2", to.x - offsetEnd * Math.cos(angle));
            line.setAttribute("y2", to.y - offsetEnd * Math.sin(angle));
            
            // Styled loop arrows in red (P1, P2, R1, R2 loop)
            const isLoopEdge = (
                (edge.from === 'r1' && edge.to === 'p1') ||
                (edge.from === 'p1' && edge.to === 'r2') ||
                (edge.from === 'r2' && edge.to === 'p2') ||
                (edge.from === 'p2' && edge.to === 'r1')
            );
            
            line.setAttribute("stroke", isLoopEdge ? "#E63946" : "#8C6239");
            line.setAttribute("stroke-width", isLoopEdge ? "3" : "2");
            if (edge.type === 'request' && !isLoopEdge) {
                line.setAttribute("stroke-dasharray", "4,4");
            }

            // Arrow marker
            line.setAttribute("marker-end", "url(#arrow)");
            svg.appendChild(line);
        });

        // Add Marker definition for arrows
        const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
        defs.innerHTML = `
            <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#8C6239" />
            </marker>
            <marker id="arrow-red" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#E63946" />
            </marker>
        `;
        svg.appendChild(defs);

        // Draw Nodes
        lvl1State.nodes.forEach(node => {
            const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
            g.setAttribute("class", "node-clickable");
            g.dataset.id = node.id;

            if (node.type === 'process') {
                const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                circle.setAttribute("cx", node.x);
                circle.setAttribute("cy", node.y);
                circle.setAttribute("r", "20");
                
                // Highlight loop
                const isLoopNode = (node.id === 'p1' || node.id === 'p2');
                circle.setAttribute("fill", isLoopNode ? "#FFEBEE" : "#FFEEDD");
                circle.setAttribute("stroke", isLoopNode ? "#E63946" : "#8C6239");
                circle.setAttribute("stroke-width", "3");

                if (lvl1State.selectedNode?.id === node.id) {
                    circle.setAttribute("stroke", "var(--accent)");
                    circle.setAttribute("stroke-width", "5");
                }

                g.appendChild(circle);

                const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
                text.setAttribute("x", node.x);
                text.setAttribute("y", node.y + 4);
                text.setAttribute("text-anchor", "middle");
                text.setAttribute("font-size", "11px");
                text.setAttribute("font-weight", "bold");
                text.setAttribute("font-family", "'Kanit', sans-serif");
                text.setAttribute("fill", "#2C1A11");
                text.textContent = node.name;
                g.appendChild(text);

            } else {
                // Resource node (rounded square)
                const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                rect.setAttribute("x", node.x - 20);
                rect.setAttribute("y", node.y - 20);
                rect.setAttribute("width", "40");
                rect.setAttribute("height", "40");
                rect.setAttribute("rx", "6");
                
                const isLoopNode = (node.id === 'r1' || node.id === 'r2');
                rect.setAttribute("fill", isLoopNode ? "#FFEBEE" : "#E8F5E9");
                rect.setAttribute("stroke", isLoopNode ? "#E63946" : "#2A9D8F");
                rect.setAttribute("stroke-width", "3");

                g.appendChild(rect);

                const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
                text.setAttribute("x", node.x);
                text.setAttribute("y", node.y - 4);
                text.setAttribute("text-anchor", "middle");
                text.setAttribute("font-size", "10px");
                text.setAttribute("font-weight", "bold");
                text.setAttribute("font-family", "'Kanit', sans-serif");
                text.setAttribute("fill", "#2C1A11");
                text.textContent = node.name;
                g.appendChild(text);

                // dot representing instance
                const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                dot.setAttribute("cx", node.x);
                dot.setAttribute("cy", node.y + 10);
                dot.setAttribute("r", "3");
                dot.setAttribute("fill", isLoopNode ? "#E63946" : "#2A9D8F");
                g.appendChild(dot);
            }

            g.addEventListener("click", () => selectL1Node(node.id));
            svg.appendChild(g);
        });
    }

    function selectL1Node(nodeId) {
        SoundSynth.playClick();
        const node = lvl1State.nodes.find(n => n.id === nodeId);
        if (!node) return;

        if (node.type !== 'process') {
            document.getElementById("l1-selection-details").innerHTML = `
                <p style="color: var(--accent-crimson); font-weight: bold;">[${node.name}] คือ Resource (ทรัพยากร)</p>
                <p>ตามกฏระบบปฏิบัติการ OS จะยกเลิกตัวทรัพยากรเปล่าไม่ได้ ต้องเคลียร์ที่ตัวกระบวนการรัน (Process) เท่านั้น</p>
            `;
            document.getElementById("btnL1Kill").style.display = "none";
            return;
        }

        lvl1State.selectedNode = node;
        drawL1(); // Redraw to highlight

        document.getElementById("l1-selection-details").innerHTML = `
            <div style="background-color: #FFF; border: 1px solid var(--border-color); padding: 0.75rem; border-radius: 6px;">
                <h4 style="color: var(--accent); margin-bottom: 0.25rem;">กระบวนการ ${node.name}</h4>
                <p style="font-size: 0.85rem; margin-bottom: 0.5rem;">${node.desc}</p>
                <div style="display: flex; justify-content: space-between; font-size: 0.85rem;">
                    <span>แต้มกู้คืนระบบที่ต้องเสีย:</span>
                    <strong style="color: var(--accent-crimson);">${node.cost} แต้ม</strong>
                </div>
            </div>
        `;

        document.getElementById("btnL1Kill").style.display = "block";
    }

    function performL1Abort() {
        if (!lvl1State.selectedNode) return;
        const target = lvl1State.selectedNode;

        // Check if selection breaks the deadlock loop
        // The loop is formed by P1 and P2. Aborting P1 or P2 will break the loop.
        // Aborting P3 does NOT break the loop!
        
        if (target.id === 'p3') {
            showModal("ล้มเหลว!", "กระบวนการ P3 ไม่ได้อยู่ในวงจรอับ (Deadlock Loop) การยกเลิก P3 จึงไม่ทำให้เครื่องหายค้าง แถมทำให้เสียแต้มฟรีอีกด้วย!", false);
            return;
        }

        // Aborting P1 (cost 50) or P2 (cost 10) breaks the loop.
        // P2 is the optimal choice since cost is 10.
        if (target.id === 'p2') {
            score += 100; // Optimal
            document.getElementById("game-score").textContent = score;
            showModal("ผ่านด่านสำเร็จ! (ระดับดีเลิศ)", "คุณเลือกยกเลิกกระบวนการ P2 ซึ่งเป็นงานเบื้องหลังที่มีลำดับความสำคัญต่ำ ทำให้ขจัดวงจรอับได้โดยสูญเสียข้อมูลน้อยที่สุด (+100 แต้ม)", true);
        } else if (target.id === 'p1') {
            score += 50; // Suboptimal
            document.getElementById("game-score").textContent = score;
            showModal("ผ่านด่าน! (ระดับปานกลาง)", "คุณเลือกยกเลิกกระบวนการ P1 แม้จะทลายวงจรอับได้สำเร็จ แต่เนื่องจากเป็นงานด่วนหลักของผู้ใช้งาน ทำให้สูญเสียงานปริมาณมากไปและต้องแลกมาด้วยแต้มกู้คืนที่แพงขึ้น (+50 แต้ม)", true);
        }
    }

    // ==========================================
    // LEVEL 2: Banker's Decision (Avoidance)
    // ==========================================
    function setupLevel2() {
        lvl2State.currentScenarioIndex = 0;
        loadL2Scenario();
    }

    function loadL2Scenario() {
        const scenario = lvl2State.scenarios[lvl2State.currentScenarioIndex];
        
        // Update Available UI
        document.getElementById("l2-avail").textContent = 
            Object.entries(scenario.available).map(([k, v]) => `${k}: ${v}`).join(" | ");

        // Populate Table
        const tbody = document.getElementById("l2-table-body");
        tbody.innerHTML = "";

        scenario.processes.forEach(proc => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td style="font-weight: bold; color: var(--primary);">${proc.name}</td>
                <td>${Object.entries(proc.alloc).map(([k, v]) => `${k}:${v}`).join(", ")}</td>
                <td>${Object.entries(proc.max).map(([k, v]) => `${k}:${v}`).join(", ")}</td>
                <td style="font-weight: bold; color: var(--accent-crimson);">${Object.entries(proc.need).map(([k, v]) => `${k}:${v}`).join(", ")}</td>
            `;
            tbody.appendChild(tr);
        });

        // Request alert box
        document.getElementById("l2-req-proc").textContent = `กระบวนการ ${scenario.request.proc}`;
        document.getElementById("l2-req-details").textContent = 
            Object.entries(scenario.request.req).map(([k, v]) => `${k}: ${v}`).join(", ");
    }

    function handleL2Decision(approved) {
        const scenario = lvl2State.scenarios[lvl2State.currentScenarioIndex];
        const correctChoice = scenario.isSafe; // If safe, we approve. If unsafe, we deny.

        if (approved === correctChoice) {
            // Correct decision!
            score += 100;
            document.getElementById("game-score").textContent = score;
            
            lvl2State.currentScenarioIndex++;
            if (lvl2State.currentScenarioIndex >= lvl2State.scenarios.length) {
                showModal("ชนะเลิศด่าน 2!", "คุณวิเคราะห์ความปลอดภัยของระบบได้แม่นยำครบถ้วน ทำให้หลีกเลี่ยงเดดล็อกได้เสมือนอัลกอริทึมของนายธนาคารตัวจริง!", true);
            } else {
                SoundSynth.playSuccess();
                alert("การวิเคราะห์ถูกต้อง! โหลดสถานการณ์ถัดไป...");
                loadL2Scenario();
            }
        } else {
            // Incorrect decision!
            if (approved) {
                // Approved an unsafe state -> system deadlocks
                showModal("ระบบเกิดวงจรอับ!", "คำอนุมัติของคุณทำให้ระบบเข้าสู่ Unsafe State ทรัพยากรเหลือไม่เพียงพอที่จะจัดสรรให้หน่วยประมวลผลใดเสร็จงานได้สำเร็จ เกิดการล็อกตัวเองข้ามสายงาน!", false);
            } else {
                // Denied a safe state -> unnecessary bottleneck
                showModal("ปฏิเสธผิดพลาด!", "คำร้องขอนี้มีความปลอดภัยสูง หากอนุมัติแล้วยังคงมีทรัพยากรว่างพอหมุนเวียนให้ทำงานสำเร็จได้ครบทั้งหมด การปฏิเสธคำขอทำให้เกิดความล่าช้าในระบบโดยไม่จำเป็น", false);
            }
        }
    }

    // ==========================================
    // LEVEL 3: Dining Philosophers (Simulation)
    // ==========================================
    function setupLevel3() {
        lvl3State.mealsEaten = 0;
        lvl3State.active = false;
        if (lvl3State.timer) clearInterval(lvl3State.timer);

        document.getElementById("l3-meals-count").textContent = "0 / 10";
        document.getElementById("l3-status-txt").textContent = "พร้อมเริ่มการจำลอง";
        document.getElementById("l3-status-txt").style.color = "var(--accent-green)";
        document.getElementById("btnL3Start").disabled = false;
        document.getElementById("btnL3Reset").disabled = true;

        // Initialize 5 philosophers & 5 chopsticks
        lvl3State.philosophers = [
            { id: 0, name: "โสเครตีส", state: "thinking", energy: 100, x: 0, y: 0, chopLeft: 0, chopRight: 4 },
            { id: 1, name: "เพลโต", state: "thinking", energy: 100, x: 0, y: 0, chopLeft: 1, chopRight: 0 },
            { id: 2, name: "อริสโตเติล", state: "thinking", energy: 100, x: 0, y: 0, chopLeft: 2, chopRight: 1 },
            { id: 3, name: "เดส์การ์ต", state: "thinking", energy: 100, x: 0, y: 0, chopLeft: 3, chopRight: 2 },
            { id: 4, name: "คานท์", state: "thinking", energy: 100, x: 0, y: 0, chopLeft: 4, chopRight: 3 }
        ];

        lvl3State.chopsticks = [
            { id: 0, holder: null }, // chopstick 0 sits between Phil 0 and Phil 1
            { id: 1, holder: null },
            { id: 2, holder: null },
            { id: 3, holder: null },
            { id: 4, holder: null }
        ];

        renderL3Table();
    }

    function renderL3Table() {
        const simContainer = document.getElementById("l3-table-simulation");
        // Clear all except dining-table-circle
        const elementsToRemove = simContainer.querySelectorAll(".philosopher-node, .chopstick-line");
        elementsToRemove.forEach(el => el.remove());

        const radius = 110; // circle radius of table
        const centerX = simContainer.clientWidth / 2;
        const centerY = simContainer.clientHeight / 2;

        // Positioning dining-table-circle at center
        const table = simContainer.querySelector(".dining-table-circle");
        table.style.position = "absolute";
        table.style.left = `${centerX - 90}px`;
        table.style.top = `${centerY - 90}px`;

        // Render Philosophers
        lvl3State.philosophers.forEach((phil, index) => {
            const angle = (index * 2 * Math.PI) / 5 - Math.PI / 2;
            const px = centerX + radius * 1.35 * Math.cos(angle);
            const py = centerY + radius * 1.35 * Math.sin(angle);
            
            phil.x = px;
            phil.y = py;

            const div = document.createElement("div");
            div.className = `philosopher-node ${phil.state}`;
            div.id = `phil-${phil.id}`;
            div.style.left = `${px - 32}px`;
            div.style.top = `${py - 32}px`;
            
            // Set details
            let stateTh = "คิด";
            if (phil.state === "hungry") stateTh = "หิว";
            if (phil.state === "eating") stateTh = "กิน";
            if (phil.state === "starved") stateTh = "อดตาย";

            div.innerHTML = `
                <span class="phil-name">${phil.name}</span>
                <span class="phil-state">${stateTh}</span>
                <div class="philosopher-energy-bar">
                    <div class="philosopher-energy-fill" id="energy-${phil.id}" style="width: ${phil.energy}%; background-color: ${phil.energy < 30 ? 'var(--accent-crimson)' : 'var(--accent-green)'}"></div>
                </div>
            `;
            
            simContainer.appendChild(div);
        });

        // Render Chopsticks
        lvl3State.chopsticks.forEach((chop, index) => {
            // Position between philosopher index and index+1 (wrap-around)
            const phil1 = lvl3State.philosophers[index];
            const phil2 = lvl3State.philosophers[(index + 1) % 5];
            
            const cx = (phil1.x + phil2.x) / 2;
            const cy = (phil1.y + phil2.y) / 2;

            const angle = Math.atan2(phil2.y - phil1.y, phil2.x - phil1.x);

            const div = document.createElement("div");
            div.className = "chopstick-line";
            div.id = `chop-${chop.id}`;

            // Adjust coordinates based on whether it is taken
            if (chop.holder !== null) {
                div.classList.add("taken");
                // Animate/move chopstick closer to the holding philosopher
                const holder = lvl3State.philosophers.find(p => p.id === chop.holder);
                if (holder) {
                    const hx = (holder.x + cx) / 2;
                    const hy = (holder.y + cy) / 2;
                    div.style.left = `${hx - 15}px`;
                    div.style.top = `${hy - 3}px`;
                }
            } else {
                div.style.left = `${cx - 15}px`;
                div.style.top = `${cy - 3}px`;
            }

            div.style.transform = `rotate(${angle * 180 / Math.PI}deg)`;
            simContainer.appendChild(div);
        });
    }

    function startL3Simulation() {
        SoundSynth.playClick();
        lvl3State.active = true;
        document.getElementById("btnL3Start").disabled = true;
        document.getElementById("btnL3Reset").disabled = false;
        document.getElementById("l3-status-txt").textContent = "กำลังรันตัวจำลอง...";
        document.getElementById("l3-status-txt").style.color = "var(--accent-amber)";

        // Set interval for simulation tick
        lvl3State.timer = setInterval(simulationTick, lvl3State.simulationSpeed);
    }

    function resetL3Simulation() {
        SoundSynth.playClick();
        setupLevel3();
    }

    function simulationTick() {
        if (!lvl3State.active) return;

        // 1. Process States Transitions
        lvl3State.philosophers.forEach(phil => {
            if (phil.state === "thinking") {
                // 30% chance to become hungry
                if (Math.random() < 0.4) {
                    phil.state = "hungry";
                }
            } else if (phil.state === "eating") {
                // Decrease energy/complete meal tick
                phil.energy = Math.min(100, phil.energy + 25);
                
                // Meal finishing check
                if (Math.random() < 0.6) {
                    // Release chopsticks
                    lvl3State.chopsticks[phil.chopLeft].holder = null;
                    lvl3State.chopsticks[phil.chopRight].holder = null;
                    phil.state = "thinking";
                    lvl3State.mealsEaten++;
                    
                    SoundSynth.playEat();
                    document.getElementById("l3-meals-count").textContent = `${lvl3State.mealsEaten} / 10`;
                }
            } else if (phil.state === "hungry") {
                // Drop energy
                phil.energy = Math.max(0, phil.energy - 15);
                if (phil.energy <= 0) {
                    phil.state = "starved";
                } else {
                    // Try to grab chopsticks based on policy
                    tryGrabChopsticks(phil);
                }
            }
        });

        renderL3Table();

        // 2. Victory and Deadlock Check
        const starvedCount = lvl3State.philosophers.filter(p => p.state === "starved").length;
        if (starvedCount > 0) {
            lvl3State.active = false;
            clearInterval(lvl3State.timer);
            document.getElementById("l3-status-txt").textContent = "ปราชญ์อดอาหารตาย (DEADLOCK!)";
            document.getElementById("l3-status-txt").style.color = "var(--accent-crimson)";
            showModal("เกิดวงจรอับค้างระบบ!", "นักปราชญ์หิวโซและหยิบตะเกียบข้างซ้ายค้างไว้เหมือนกันหมดจนตาย! ลองวางนโยบายจัดคิวตะเกียบใหม่เพื่อแก้ปัญหา", false);
            return;
        }

        // Circular Wait Check (All hungry, each holding exactly 1 chopstick, and none is eating)
        const isDeadlocked = checkL3Deadlock();
        if (isDeadlocked) {
            lvl3State.active = false;
            clearInterval(lvl3State.timer);
            
            // Set all to starved to illustrate deadlock effect
            lvl3State.philosophers.forEach(p => {
                if (p.state === "hungry") p.state = "starved";
            });
            renderL3Table();

            document.getElementById("l3-status-txt").textContent = "เกิดวงจรอับ (DEADLOCK DETECTED)";
            document.getElementById("l3-status-txt").style.color = "var(--accent-crimson)";
            showModal("วงจรอับวงกลม!", "สภาวะ Circular Wait เกิดขึ้นสมบูรณ์! ทุกคนมีตะเกียบคนละข้างและต่างยืนกรานที่จะไม่ปล่อยตะเกียบเดิม ระบบเดดล็อกล็อกสมบูรณ์แบบ!", false);
            return;
        }

        if (lvl3State.mealsEaten >= 10) {
            lvl3State.active = false;
            clearInterval(lvl3State.timer);
            document.getElementById("l3-status-txt").textContent = "เสร็จสิ้นภารกิจปลอดภัย!";
            document.getElementById("l3-status-txt").style.color = "var(--accent-green)";
            
            score += 150;
            document.getElementById("game-score").textContent = score;

            showModal("ภารกิจสำเร็จลุล่วง!", "นโยบายจัดคิวที่คุณเลือกสามารถขจัดสภาวะเดดล็อกได้ 100% ทำให้ระบบทำงานได้อย่างราบรื่นและทุกคนได้อิ่มท้อง! (+150 แต้ม)", true);
        }
    }

    function tryGrabChopsticks(phil) {
        const leftChop = lvl3State.chopsticks[phil.chopLeft];
        const rightChop = lvl3State.chopsticks[phil.chopRight];

        // Policy Logic
        if (lvl3State.policy === "none") {
            // Grab left first, then right
            if (leftChop.holder === null) {
                leftChop.holder = phil.id;
            } else if (leftChop.holder === phil.id && rightChop.holder === null) {
                rightChop.holder = phil.id;
                phil.state = "eating";
            }
        } 
        else if (lvl3State.policy === "ordering") {
            // Resource Ordering: Must grab lower numbered index first
            const lowerIdx = Math.min(phil.chopLeft, phil.chopRight);
            const higherIdx = Math.max(phil.chopLeft, phil.chopRight);
            
            const firstChop = lvl3State.chopsticks[lowerIdx];
            const secondChop = lvl3State.chopsticks[higherIdx];

            if (firstChop.holder === null) {
                firstChop.holder = phil.id;
            } else if (firstChop.holder === phil.id && secondChop.holder === null) {
                secondChop.holder = phil.id;
                phil.state = "eating";
            }
        } 
        else if (lvl3State.policy === "limit") {
            // Limit seating: Max 4 active hungry diners allowed to hold chopsticks
            const activeHolders = new Set(
                lvl3State.chopsticks.filter(c => c.holder !== null).map(c => c.holder)
            );
            
            const isHolding = activeHolders.has(phil.id);

            // Allow if already holding or count < 4
            if (isHolding || activeHolders.size < 4) {
                if (leftChop.holder === null) {
                    leftChop.holder = phil.id;
                } else if (leftChop.holder === phil.id && rightChop.holder === null) {
                    rightChop.holder = phil.id;
                    phil.state = "eating";
                }
            }
        } 
        else if (lvl3State.policy === "evenodd") {
            // Even/Odd: Even philosophers grab left then right. Odd philosophers grab right then left.
            const isEven = (phil.id % 2 === 0);
            const firstChop = isEven ? leftChop : rightChop;
            const secondChop = isEven ? rightChop : leftChop;

            if (firstChop.holder === null) {
                firstChop.holder = phil.id;
            } else if (firstChop.holder === phil.id && secondChop.holder === null) {
                secondChop.holder = phil.id;
                phil.state = "eating";
            }
        }
    }

    function checkL3Deadlock() {
        // Deadlock is when all non-thinking philosophers are hungry (none eating) 
        // and each holds exactly one chopstick, meaning no progress can be made.
        const nonThinking = lvl3State.philosophers.filter(p => p.state !== "thinking");
        if (nonThinking.length < 5) return false; // not everyone is locked

        const anyEating = lvl3State.philosophers.some(p => p.state === "eating");
        if (anyEating) return false; // someone is making progress

        // Count chopsticks held per philosopher
        const holds = {};
        lvl3State.chopsticks.forEach(c => {
            if (c.holder !== null) {
                holds[c.holder] = (holds[c.holder] || 0) + 1;
            }
        });

        // If everyone holds exactly 1 chopstick, it is a deadlock!
        let allHoldOne = true;
        lvl3State.philosophers.forEach(p => {
            if (holds[p.id] !== 1) {
                allHoldOne = false;
            }
        });

        return allHoldOne;
    }

    return {
        init: init
    };
})();

// ==========================================
// 5. Global Initializer
// ==========================================
window.addEventListener("DOMContentLoaded", () => {
    // Start RAG visualizer engine
    RAGEngine.init();
    
    // Start Game engine
    GameManager.init();
});
