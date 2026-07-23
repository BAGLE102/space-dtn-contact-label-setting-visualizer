"use strict";

let physicalLinks = [];

const ui = {
  tabs: [...document.querySelectorAll("[data-view-target]")],
  views: [...document.querySelectorAll(".model-view")],
  physicalGraph: document.getElementById("physicalTopologyGraph"),
  splitGraph: document.getElementById("nodeSplitGraph"),
  summary: document.getElementById("physicalTopologySummary"),
  mappingTable: document.getElementById("splitMappingTable"),
  linkEditor: document.getElementById("topologyLinkEditor"),
  fromInput: document.getElementById("newLinkFrom"),
  toInput: document.getElementById("newLinkTo"),
  addButton: document.getElementById("addPhysicalLinkButton"),
  resetButton: document.getElementById("resetTopologyButton")
};

ui.tabs.forEach(tab => tab.addEventListener("click", () => activateView(tab.dataset.viewTarget)));
ui.addButton.addEventListener("click", addLink);
ui.resetButton.addEventListener("click", resetDefaultTopology);

function activateView(targetId) {
  ui.tabs.forEach(tab => {
    const selected = tab.dataset.viewTarget === targetId;
    tab.classList.toggle("active", selected);
    tab.setAttribute("aria-selected", String(selected));
  });
  ui.views.forEach(view => {
    const selected = view.id === targetId;
    view.hidden = !selected;
    view.classList.toggle("active", selected);
  });
  if (targetId === "satelliteModelView") renderAll();
}

function resetDefaultTopology() {
  physicalLinks = [
    { from: "s", to: "A" },
    { from: "s", to: "B" },
    { from: "A", to: "B" },
    { from: "A", to: "t" },
    { from: "B", to: "t" }
  ];
  renderAll();
}

function addLink() {
  const from = cleanName(ui.fromInput.value);
  const to = cleanName(ui.toInput.value);
  if (!from || !to || from === to) return;
  const exists = physicalLinks.some(link =>
    (link.from === from && link.to === to) || (link.from === to && link.to === from)
  );
  if (exists) return;
  physicalLinks.push({ from, to });
  ui.fromInput.value = from;
  ui.toInput.value = to;
  renderAll();
}

function removeLink(index) {
  if (physicalLinks.length <= 1) return;
  physicalLinks.splice(index, 1);
  renderAll();
}

function cleanName(value) {
  return String(value || "").trim().replace(/[^A-Za-z0-9_-]/g, "");
}

function sortNodes(nodes) {
  return [...nodes].sort((a, b) => {
    const al = a.toLowerCase(), bl = b.toLowerCase();
    if (al === "s") return -1;
    if (bl === "s") return 1;
    if (al === "t") return 1;
    if (bl === "t") return -1;
    return a.localeCompare(b);
  });
}

function getNodes() {
  return sortNodes([...new Set(physicalLinks.flatMap(link => [link.from, link.to]))]);
}

function getNeighbors(node) {
  const result = [];
  physicalLinks.forEach(link => {
    if (link.from === node && !result.includes(link.to)) result.push(link.to);
    if (link.to === node && !result.includes(link.from)) result.push(link.from);
  });

  // Preserve the ingress numbering shown in the reference sketch:
  // s1←A, s2←B; A1←s, A2←B, A3←t;
  // B1←t, B2←A, B3←s; t1←A, t2←B.
  const sketchOrder = {
    s: ["a", "b"],
    a: ["s", "b", "t"],
    b: ["t", "a", "s"],
    t: ["a", "b"]
  };
  const byLower = Object.fromEntries(result.map(neighbor => [neighbor.toLowerCase(), neighbor]));
  const preferred = (sketchOrder[node.toLowerCase()] || [])
    .filter(name => byLower[name])
    .map(name => byLower[name]);
  const remaining = sortNodes(result).filter(neighbor => !preferred.includes(neighbor));
  return [...preferred, ...remaining];
}

function buildModel() {
  const model = {};
  getNodes().forEach(node => {
    const neighbors = getNeighbors(node);
    model[node] = {
      node,
      neighbors,
      ingress: neighbors.map((neighbor, index) => ({ neighbor, id: `${node}${index + 1}` })),
      hub: `${node}${neighbors.length + 1}`
    };
  });
  return model;
}

function renderAll() {
  renderEditor();
  renderMapping();
  renderPhysicalGraph();
  renderSplitGraph();
  ui.summary.textContent = `${getNodes().length} satellites · ${physicalLinks.length} bidirectional links`;
}

function renderEditor() {
  ui.linkEditor.innerHTML = `
    <table>
      <thead><tr><th>#</th><th>Physical link</th><th>Expanded directions</th><th>Action</th></tr></thead>
      <tbody>
        ${physicalLinks.map((link, index) => `
          <tr>
            <td>${index + 1}</td>
            <td><b>${esc(link.from)} — ${esc(link.to)}</b></td>
            <td>${esc(link.from)} → ${esc(link.to)}<br>${esc(link.to)} → ${esc(link.from)}</td>
            <td><button class="delete-link" type="button" data-delete-link="${index}">Delete</button></td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
  ui.linkEditor.querySelectorAll("[data-delete-link]").forEach(button => {
    button.addEventListener("click", () => removeLink(Number(button.dataset.deleteLink)));
  });
}

function renderMapping() {
  const model = buildModel();
  ui.mappingTable.innerHTML = `
    <table>
      <thead><tr><th>Satellite</th><th>Neighbors</th><th>Ingress vertices</th><th>Hub</th></tr></thead>
      <tbody>
        ${Object.values(model).map(item => `
          <tr>
            <td><b>${esc(item.node)}</b></td>
            <td>${item.neighbors.map(esc).join(", ")}</td>
            <td>${item.ingress.map(port => `${esc(port.id)} <small>(from ${esc(port.neighbor)})</small>`).join("<br>")}</td>
            <td><b>${esc(item.hub)}</b></td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function isSketchTopology(nodes) {
  const names = nodes.map(node => node.toLowerCase());
  return nodes.length === 4 && ["s", "a", "b", "t"].every(name => names.includes(name));
}

function nodeByLower(nodes) {
  return Object.fromEntries(nodes.map(node => [node.toLowerCase(), node]));
}

function physicalPositions(nodes, width, height) {
  if (isSketchTopology(nodes)) {
    const n = nodeByLower(nodes);
    return {
      [n.s]: { x: 105, y: height / 2 },
      [n.a]: { x: width * .43, y: 72 },
      [n.b]: { x: width * .43, y: height - 72 },
      [n.t]: { x: width - 105, y: height / 2 }
    };
  }
  const positions = {};
  nodes.forEach((node, index) => {
    const angle = Math.PI + 2 * Math.PI * index / Math.max(1, nodes.length);
    positions[node] = {
      x: width / 2 + width * .36 * Math.cos(angle),
      y: height / 2 + height * .32 * Math.sin(angle)
    };
  });
  return positions;
}

function renderPhysicalGraph() {
  const svg = ui.physicalGraph, width = 960, height = 320;
  const nodes = getNodes(), positions = physicalPositions(nodes, width, height);
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.innerHTML = "";

  physicalLinks.forEach(link => {
    const a = positions[link.from], b = positions[link.to];
    line(svg, a.x, a.y, b.x, b.y, "#4d5966", 3);
    text(svg, (a.x + b.x) / 2, (a.y + b.y) / 2 - 9, `${link.from}–${link.to}`, 11, "#68737f", "middle", "bold");
  });
  nodes.forEach(node => {
    const p = positions[node];
    circle(svg, p.x, p.y, 31, "#fff", "#17202a", 3);
    text(svg, p.x, p.y + 7, node, 22, "#17202a", "middle", "bold");
  });
}

function clusterPositions(nodes) {
  if (isSketchTopology(nodes)) {
    const n = nodeByLower(nodes);
    return {
      [n.s]: { x: 145, y: 380 },
      [n.a]: { x: 520, y: 205 },
      [n.b]: { x: 520, y: 555 },
      [n.t]: { x: 990, y: 380 }
    };
  }
  return physicalPositions(nodes, 1080, 640);
}

function renderSplitGraph() {
  const svg = ui.splitGraph, width = 1200, height = 760;
  const model = buildModel(), nodes = Object.keys(model);
  const centers = clusterPositions(nodes), positions = {};
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.innerHTML = `
    <defs>
      <marker id="internalArrow" markerWidth="9" markerHeight="9" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#2166c2"></path></marker>
      <marker id="crossArrow" markerWidth="9" markerHeight="9" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#df8a36"></path></marker>
    </defs>
  `;

  nodes.forEach(node => {
    const item = model[node], center = centers[node], gap = 58;
    const span = Math.max(1, item.ingress.length - 1) * gap;
    const boxHeight = Math.max(128, span + 76);
    roundedRect(svg, center.x - 112, center.y - boxHeight / 2, 224, boxHeight, 18, "#fbfcfd", "#cbd2da", 2, "7 5");
    text(svg, center.x, center.y - boxHeight / 2 + 22, `SATELLITE ${node}`, 11, "#68737f", "middle", "bold", "cluster-label");
    item.ingress.forEach((port, index) => {
      positions[port.id] = { x: center.x - 48, y: center.y + (index - (item.ingress.length - 1) / 2) * gap };
    });
    positions[item.hub] = { x: center.x + 62, y: center.y };
  });

  nodes.forEach(node => {
    const item = model[node], hub = positions[item.hub];
    item.ingress.forEach(port => {
      const p = positions[port.id];
      arrow(svg, `M ${p.x + 21} ${p.y} C ${p.x + 52} ${p.y}, ${hub.x - 43} ${hub.y}, ${hub.x - 24} ${hub.y}`, "#2166c2", 3, "url(#internalArrow)");
    });
  });

  physicalLinks.forEach((link, index) => {
    crossEdge(svg, model, positions, link.from, link.to, index, false);
    crossEdge(svg, model, positions, link.to, link.from, index, true);
  });

  nodes.forEach(node => {
    const item = model[node];
    item.ingress.forEach(port => {
      const p = positions[port.id];
      circle(svg, p.x, p.y, 22, "#e9f1fc", "#2166c2", 3);
      text(svg, p.x, p.y + 5, port.id, 13, "#17202a", "middle", "bold");
      text(svg, p.x - 28, p.y + 4, `←${port.neighbor}`, 9, "#68737f", "end", "bold");
    });
    const hub = positions[item.hub];
    circle(svg, hub.x, hub.y, 25, "#fff0df", "#df8a36", 4);
    text(svg, hub.x, hub.y + 5, item.hub, 14, "#17202a", "middle", "bold");
    text(svg, hub.x, hub.y + 43, "hub", 10, "#a55e1d", "middle", "bold");
  });
}

function crossEdge(svg, model, positions, fromNode, toNode, linkIndex, reverse) {
  const hubId = model[fromNode].hub;
  const ingress = model[toNode].ingress.find(port => port.neighbor === fromNode);
  if (!ingress) return;
  const a = positions[hubId], b = positions[ingress.id];
  const startX = a.x + (b.x >= a.x ? 25 : -25);
  const endX = b.x + (b.x >= a.x ? -22 : 22);
  let d;

  if (b.x > a.x + 80) {
    const bend = Math.max(70, (b.x - a.x) * .34);
    d = `M ${startX} ${a.y} C ${startX + bend} ${a.y}, ${endX - bend} ${b.y}, ${endX} ${b.y}`;
  } else if (b.x < a.x - 80) {
    const laneY = reverse ? Math.min(a.y, b.y) - 110 - (linkIndex % 2) * 24 : Math.max(a.y, b.y) + 110 + (linkIndex % 2) * 24;
    d = `M ${startX} ${a.y} C ${startX + 90} ${laneY}, ${endX - 90} ${laneY}, ${endX} ${b.y}`;
  } else {
    const laneX = a.x + (reverse ? 118 : -118);
    d = `M ${startX} ${a.y} C ${laneX} ${a.y}, ${laneX} ${b.y}, ${endX} ${b.y}`;
  }

  arrow(svg, d, "#df8a36", 3, "url(#crossArrow)");
  edgeLabel(svg, (a.x + b.x) / 2, (a.y + b.y) / 2 + (reverse ? 18 : -12), `${fromNode}→${toNode}`);
}

function arrow(svg, d, stroke, width, marker) {
  const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
  p.setAttribute("d", d); p.setAttribute("fill", "none"); p.setAttribute("stroke", stroke);
  p.setAttribute("stroke-width", width); p.setAttribute("stroke-linecap", "round");
  p.setAttribute("stroke-linejoin", "round"); p.setAttribute("marker-end", marker);
  svg.appendChild(p);
}

function edgeLabel(svg, x, y, label) {
  const width = Math.max(48, label.length * 7);
  roundedRect(svg, x - width / 2, y - 12, width, 20, 4, "#fff", "#e1b98f", 1);
  text(svg, x, y + 2, label, 10, "#a55e1d", "middle", "bold");
}

function roundedRect(svg, x, y, width, height, radius, fill, stroke, strokeWidth, dash = "") {
  const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  r.setAttribute("x", x); r.setAttribute("y", y); r.setAttribute("width", width); r.setAttribute("height", height);
  r.setAttribute("rx", radius); r.setAttribute("fill", fill); r.setAttribute("stroke", stroke);
  r.setAttribute("stroke-width", strokeWidth); if (dash) r.setAttribute("stroke-dasharray", dash);
  svg.appendChild(r);
}

function line(svg, x1, y1, x2, y2, stroke, width) {
  const l = document.createElementNS("http://www.w3.org/2000/svg", "line");
  l.setAttribute("x1", x1); l.setAttribute("y1", y1); l.setAttribute("x2", x2); l.setAttribute("y2", y2);
  l.setAttribute("stroke", stroke); l.setAttribute("stroke-width", width); l.setAttribute("stroke-linecap", "round");
  svg.appendChild(l);
}

function circle(svg, cx, cy, radius, fill, stroke, width) {
  const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  c.setAttribute("cx", cx); c.setAttribute("cy", cy); c.setAttribute("r", radius);
  c.setAttribute("fill", fill); c.setAttribute("stroke", stroke); c.setAttribute("stroke-width", width);
  svg.appendChild(c);
}

function text(svg, x, y, value, size, fill, anchor = "start", weight = "normal", className = "") {
  const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
  t.setAttribute("x", x); t.setAttribute("y", y); t.setAttribute("font-size", size);
  t.setAttribute("font-family", "Times New Roman, Microsoft JhengHei"); t.setAttribute("font-weight", weight);
  t.setAttribute("fill", fill); t.setAttribute("text-anchor", anchor);
  if (className) t.setAttribute("class", className);
  t.textContent = value; svg.appendChild(t);
}

function esc(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

resetDefaultTopology();
