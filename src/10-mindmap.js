/* ══ MIND MAP ENGINE ══════════════════════════════════════════════════════ */
window.initMindMap = (function(){
  let _init = false;
  return function initMindMap() {
    const canvas = document.getElementById('mm-canvas');
    if (!canvas) return;
    if (_init) { _mmResize(); return; }
    _init = true;

    const ctx = canvas.getContext('2d');
    let nodes = [];      // { id, x, y, text, color }
    let edges = [];      // { from, to }
    let pan = { x: 0, y: 0 };
    let zoom = 1;
    let tool = 'select'; // 'select' | 'connect'
    let drag = null;     // { nodeId, ox, oy }
    let panDrag = null;  // { sx, sy, px, py }
    let selected = null; // nodeId
    let connectFrom = null;
    let editing = null;  // nodeId being edited
    let editEl = null;
    const NODE_W = 140, NODE_H = 44, NODE_R = 10;
    const COLORS = [
      'rgba(61,184,255,0.18)','rgba(255,130,180,0.18)','rgba(224,85,85,0.18)',
      'rgba(255,255,255,0.08)','rgba(100,200,140,0.15)'
    ];
    const STROKE_COLORS = [
      'rgba(61,184,255,0.55)','rgba(255,130,180,0.55)','rgba(224,85,85,0.55)',
      'rgba(255,255,255,0.28)','rgba(100,200,140,0.5)'
    ];
    let colorIdx = 0;

    function _mmResize() {
      const parent = canvas.parentElement;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
      draw();
    }
    window._mmResize = _mmResize;

    function worldToScreen(wx, wy) {
      return { x: wx * zoom + pan.x, y: wy * zoom + pan.y };
    }
    function screenToWorld(sx, sy) {
      return { x: (sx - pan.x) / zoom, y: (sy - pan.y) / zoom };
    }
    function hitNode(wx, wy) {
      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i];
        if (wx >= n.x - NODE_W/2 && wx <= n.x + NODE_W/2 &&
            wy >= n.y - NODE_H/2 && wy <= n.y + NODE_H/2) return n;
      }
      return null;
    }
    function roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x+r, y);
      ctx.lineTo(x+w-r, y);
      ctx.arcTo(x+w, y, x+w, y+r, r);
      ctx.lineTo(x+w, y+h-r);
      ctx.arcTo(x+w, y+h, x+w-r, y+h, r);
      ctx.lineTo(x+r, y+h);
      ctx.arcTo(x, y+h, x, y+h-r, r);
      ctx.lineTo(x, y+r);
      ctx.arcTo(x, y, x+r, y, r);
      ctx.closePath();
    }
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // Grid dots
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      const gridSpacing = 32 * zoom;
      const ox = ((pan.x % gridSpacing) + gridSpacing) % gridSpacing;
      const oy = ((pan.y % gridSpacing) + gridSpacing) % gridSpacing;
      for (let gx = ox; gx < canvas.width; gx += gridSpacing)
        for (let gy = oy; gy < canvas.height; gy += gridSpacing)
          { ctx.beginPath(); ctx.arc(gx, gy, 1, 0, Math.PI*2); ctx.fill(); }
      ctx.restore();

      ctx.save();
      ctx.translate(pan.x, pan.y);
      ctx.scale(zoom, zoom);

      // Edges
      edges.forEach(e => {
        const a = nodes.find(n=>n.id===e.from);
        const b = nodes.find(n=>n.id===e.to);
        if (!a || !b) return;
        ctx.beginPath();
        const mx = (a.x+b.x)/2, my = (a.y+b.y)/2;
        ctx.moveTo(a.x, a.y);
        ctx.bezierCurveTo(mx, a.y, mx, b.y, b.x, b.y);
        ctx.strokeStyle = 'rgba(255,255,255,0.22)';
        ctx.lineWidth = 1.5 / zoom;
        ctx.stroke();
      });

      // Connect-mode line preview handled via mousemove

      // Nodes
      nodes.forEach(n => {
        const x = n.x - NODE_W/2, y = n.y - NODE_H/2;
        const ci = n.colorIdx || 0;
        // Backdrop blur simulation via layered fills
        ctx.save();
        roundRect(ctx, x, y, NODE_W, NODE_H, NODE_R);
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fill();
        ctx.fillStyle = COLORS[ci % COLORS.length];
        ctx.fill();
        ctx.strokeStyle = selected === n.id ? 'rgba(255,255,255,0.65)' :
                          connectFrom === n.id ? 'rgba(61,184,255,0.85)' :
                          STROKE_COLORS[ci % STROKE_COLORS.length];
        ctx.lineWidth = selected === n.id || connectFrom === n.id ? 1.5/zoom : 1/zoom;
        ctx.stroke();
        ctx.restore();

        // Text
        ctx.save();
        ctx.font = `300 ${12/zoom > 14 ? 14 : 12}px 'Instrument Sans', sans-serif`;
        ctx.fillStyle = 'rgba(255,255,255,0.88)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const maxW = NODE_W - 20;
        let label = n.text || '…';
        if (ctx.measureText(label).width > maxW) {
          while (label.length > 1 && ctx.measureText(label+'…').width > maxW) label = label.slice(0,-1);
          label += '…';
        }
        ctx.fillText(label, n.x, n.y);
        ctx.restore();
      });

      ctx.restore();
    }

    function addNode(wx, wy, text='') {
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2,5);
      const node = { id, x: wx, y: wy, text, colorIdx: colorIdx % COLORS.length };
      colorIdx++;
      nodes.push(node);
      selected = id;
      draw();
      if (!text) startEdit(node);
      return node;
    }

    function deleteSelected() {
      if (!selected) return;
      nodes = nodes.filter(n => n.id !== selected);
      edges = edges.filter(e => e.from !== selected && e.to !== selected);
      selected = null;
      connectFrom = null;
      draw();
    }

    function startEdit(node) {
      if (editing) finishEdit();
      editing = node.id;
      const sp = worldToScreen(node.x - NODE_W/2, node.y - NODE_H/2);
      if (!editEl) {
        editEl = document.createElement('input');
        editEl.style.cssText = `position:absolute;background:rgba(0,0,0,0.82);border:1px solid rgba(255,255,255,0.35);color:#fff;border-radius:6px;padding:4px 10px;font-family:'Instrument Sans',sans-serif;font-size:12px;outline:none;z-index:10;box-sizing:border-box;`;
        canvas.parentElement.appendChild(editEl);
        editEl.addEventListener('keydown', e => {
          if (e.key === 'Enter') { e.preventDefault(); finishEdit(); }
          if (e.key === 'Escape') { cancelEdit(); }
          e.stopPropagation();
        });
        editEl.addEventListener('blur', () => finishEdit());
      }
      editEl.value = node.text;
      editEl.style.left = sp.x + 'px';
      editEl.style.top = sp.y + 'px';
      editEl.style.width = (NODE_W * zoom) + 'px';
      editEl.style.height = (NODE_H * zoom) + 'px';
      editEl.style.display = 'block';
      editEl.style.lineHeight = (NODE_H * zoom) + 'px';
      editEl.style.textAlign = 'center';
      setTimeout(()=>{ editEl.focus(); editEl.select(); }, 10);
    }

    function finishEdit() {
      if (!editing) return;
      const node = nodes.find(n => n.id === editing);
      if (node && editEl) node.text = editEl.value.trim() || '…';
      editing = null;
      if (editEl) editEl.style.display = 'none';
      draw();
    }

    function cancelEdit() {
      const node = nodes.find(n => n.id === editing);
      // if node was just created with no text, remove it
      if (node && !node.text) { nodes = nodes.filter(n=>n.id!==editing); selected=null; }
      editing = null;
      if (editEl) editEl.style.display = 'none';
      draw();
    }

    function centerView() {
      if (!nodes.length) { pan = { x: canvas.width/2, y: canvas.height/2 }; zoom = 1; draw(); return; }
      const xs = nodes.map(n=>n.x), ys = nodes.map(n=>n.y);
      const cx = (Math.min(...xs)+Math.max(...xs))/2;
      const cy = (Math.min(...ys)+Math.max(...ys))/2;
      pan = { x: canvas.width/2 - cx*zoom, y: canvas.height/2 - cy*zoom };
      draw();
    }

    // ── Mouse / Touch ────────────────────────────────────
    let connectPreview = null;
    canvas.addEventListener('mousedown', e => {
      if (editing) { finishEdit(); return; }
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
      const w = screenToWorld(sx, sy);
      const hit = hitNode(w.x, w.y);

      if (tool === 'connect') {
        if (hit) {
          if (!connectFrom) { connectFrom = hit.id; draw(); }
          else if (connectFrom !== hit.id) {
            const exists = edges.find(ed=>(ed.from===connectFrom&&ed.to===hit.id)||(ed.from===hit.id&&ed.to===connectFrom));
            if (!exists) edges.push({ from: connectFrom, to: hit.id });
            connectFrom = null; draw();
          }
        } else { connectFrom = null; draw(); }
        return;
      }

      // select tool
      if (hit) {
        selected = hit.id;
        drag = { nodeId: hit.id, ox: w.x - hit.x, oy: w.y - hit.y };
        draw();
      } else {
        selected = null;
        panDrag = { sx, sy, px: pan.x, py: pan.y };
        draw();
      }
    });

    canvas.addEventListener('mousemove', e => {
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
      const w = screenToWorld(sx, sy);

      if (tool === 'connect' && connectFrom) {
        connectPreview = { wx: w.x, wy: w.y };
        // Redraw with preview line
        draw();
        ctx.save();
        ctx.translate(pan.x, pan.y); ctx.scale(zoom, zoom);
        const a = nodes.find(n=>n.id===connectFrom);
        if (a) {
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(w.x, w.y);
          ctx.strokeStyle = 'rgba(61,184,255,0.6)'; ctx.lineWidth = 1.5/zoom; ctx.setLineDash([4/zoom,4/zoom]); ctx.stroke(); ctx.setLineDash([]);
        }
        ctx.restore();
        return;
      }
      connectPreview = null;

      if (drag) {
        const node = nodes.find(n=>n.id===drag.nodeId);
        if (node) { node.x = w.x - drag.ox; node.y = w.y - drag.oy; draw(); }
      } else if (panDrag) {
        pan.x = panDrag.px + (sx - panDrag.sx);
        pan.y = panDrag.py + (sy - panDrag.sy);
        draw();
      }

      // cursor
      const hit = hitNode(w.x, w.y);
      canvas.style.cursor = hit ? (tool==='connect' ? 'crosshair' : 'grab') : (tool==='connect'?'crosshair':'default');
    });

    canvas.addEventListener('mouseup', () => {
      drag = null; panDrag = null;
    });

    canvas.addEventListener('dblclick', e => {
      if (editing) return;
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
      const w = screenToWorld(sx, sy);
      const hit = hitNode(w.x, w.y);
      if (hit) { selected = hit.id; startEdit(hit); }
      else { addNode(w.x, w.y); }
    });

    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const delta = e.deltaY < 0 ? 1.12 : 1/1.12;
      const newZoom = Math.min(4, Math.max(0.2, zoom * delta));
      pan.x = mx - (mx - pan.x) * (newZoom/zoom);
      pan.y = my - (my - pan.y) * (newZoom/zoom);
      zoom = newZoom;
      draw();
    }, { passive: false });

    // Keyboard
    document.addEventListener('keydown', e => {
      if (document.getElementById('panel-mindmap')?.style.display === 'none') return;
      if (editing) return;
      if (e.key === 'Delete' || e.key === 'Backspace') { if(selected) { e.preventDefault(); deleteSelected(); } }
      if (e.key === ' ') { e.preventDefault(); centerView(); }
      if (e.key === 'v' || e.key === 'V') setTool('select');
      if (e.key === 'c' || e.key === 'C') setTool('connect');
      if (e.key === 'a' || e.key === 'A') {
        const w = screenToWorld(canvas.width/2, canvas.height/2);
        addNode(w.x + (Math.random()-0.5)*80, w.y + (Math.random()-0.5)*80);
      }
    });

    function setTool(t) {
      tool = t;
      connectFrom = null;
      document.querySelectorAll('.mm-tool-btn[data-tool]').forEach(b => {
        b.classList.toggle('active', b.dataset.tool === t);
      });
      draw();
    }

    // Toolbar buttons
    document.getElementById('mm-tool-select')?.addEventListener('click', () => setTool('select'));
    document.getElementById('mm-tool-connect')?.addEventListener('click', () => setTool('connect'));
    document.getElementById('mm-btn-add')?.addEventListener('click', () => {
      const w = screenToWorld(canvas.width/2, canvas.height/2);
      addNode(w.x + (Math.random()-0.5)*100, w.y + (Math.random()-0.5)*100);
    });
    document.getElementById('mm-btn-delete')?.addEventListener('click', deleteSelected);
    document.getElementById('mm-btn-center')?.addEventListener('click', centerView);
    document.getElementById('mm-btn-clear')?.addEventListener('click', () => {
      if (!nodes.length || confirm('Clear all nodes?')) { nodes=[]; edges=[]; selected=null; connectFrom=null; draw(); }
    });

    // Initial state — seed with a root node
    pan = { x: canvas.width/2, y: canvas.height/2 };
    addNode(0, 0, 'Central Idea');
    selected = null;
    draw();

    new ResizeObserver(_mmResize).observe(canvas.parentElement);
  };
})();
