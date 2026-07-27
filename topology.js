"use strict";

(() => {

const SVG_NS = "http://www.w3.org/2000/svg";

const topologyUI = {
  tabs: [...document.querySelectorAll("[data-view-target]")],
  views: [...document.querySelectorAll(".model-view")],
  physicalGraph: document.getElementById("physicalTopologyGraph"),
  splitGraph: document.getElementById("nodeSplitGraph"),
  summary: document.getElementById("physicalTopologySummary"),
  mappingTable: document.getElementById("splitMappingTable"),
  contactSummary: document.getElementById("satelliteContactSummary")
};

let contactState = {
  contacts: [],
  bundle: { source: "S", destination: "D" },
  highlight: { bestPath: [] }
};

topologyUI.tabs.forEach(tab => {
  tab.addEventListener("click", () => activateView(tab.dataset.viewTarget));
});

window.addEventListener("visualizer-state-change", syncFromContactModel);

function activateView(targetId) {
  topologyUI.tabs.forEach(tab => {
    const selected = tab.dataset.viewTarget === targetId;
    tab.classList.toggle("active", selected);
    tab.setAttribute("aria-selected", String(selected));
  });
  topologyUI.views.forEach(view => {
    const selected = view.id === targetId;
    view.hidden = !selected;
    view.classList.toggle("active", selected);
  });
  if (targetId === "satelliteModelView") syncFromContactModel();
}

function syncFromContactModel() {
  if (typeof window.getContactVisualizerState !== "function") return;
  const state = window.getContactVisualizerState();
  contactState = {
    contacts: Array.isArray(state.contacts) ? state.contacts.map(contact => ({ ...contact })) : [],
    bundle: { source: "S", destination: "D", ...(state.bundle || {}) },
    highlight: {
      ...(state.highlight || {}),
      bestPath: [...(state.highlight?.bestPath || [])]
    }
  };
  renderAll();
}

function getNodes() {
  const names = [
    contactState.bundle.source,
    contactState.bundle.destination,
    ...contactState.contacts.flatMap(contact => [contact.sender, contact.receiver])
  ].filter(Boolean);
  return sortNodes([...new Set(names)]);
}

function sortNodes(nodes) {
  const source = contactState.bundle.source;
  const destination = contactState.bundle.destination;
  return [...nodes].sort((a, b) => {
    if (a === source) return -1;
    if (b === source) return 1;
    if (a === destination) return 1;
    if (b === destination) return -1;
    return a.localeCompare(b, undefined, { numeric: true });
  });
}

function buildModel() {
  const model = {};
  getNodes().forEach(node => {
    const incoming = contactState.contacts
      .map((contact, contactIndex) => ({ contact, contactIndex }))
      .filter(item => item.contact.receiver === node);
    model[node] = {
      node,
      incoming: incoming.map((item, index) => ({
        contact: item.contact,
        contactIndex: item.contactIndex,
        id: `${node}${index + 1}`
      })),
      hub: `${node}${incoming.length + 1}`
    };
  });
  return model;
}

function renderAll() {
  if (!topologyUI.physicalGraph || !topologyUI.splitGraph) return;
  const nodes = getNodes();
  topologyUI.summary.textContent =
    `${nodes.length} satellites · ${contactState.contacts.length} directed Contacts · synced`;
  renderContactSummary();
  renderMapping();
  renderPhysicalGraph();
  renderSplitGraph();
}

function renderContactSummary() {
  const model = buildModel();
  const ingressByContact = {};
  Object.values(model).forEach(item => {
    item.incoming.forEach(port => {
      ingressByContact[port.contactIndex] = port.id;
    });
  });

  topologyUI.contactSummary.innerHTML = `
    <table>
      <thead>
        <tr><th>Contact</th><th>Satellite link</th><th>Window</th><th>Expanded destination</th></tr>
      </thead>
      <tbody>
        ${contactState.contacts.map((contact, index) => `
          <tr>
            <td><b>${esc(contact.id)}</b></td>
            <td>${esc(contact.sender)} → ${esc(contact.receiver)}</td>
            <td>[${fmt(contact.start)}, ${fmt(contact.end)}]</td>
            <td>${esc(model[contact.sender]?.hub || "—")} → <b>${esc(ingressByContact[index] || "—")}</b></td>
          </tr>
        `).join("") || `<tr><td colspan="4">目前沒有 Contact。</td></tr>`}
      </tbody>
    </table>
  `;
}

function renderMapping() {
  const model = buildModel();
  topologyUI.mappingTable.innerHTML = `
    <table>
      <thead>
        <tr><th>Satellite</th><th>Incoming Contacts</th><th>Ingress vertices</th><th>Forwarding hub</th></tr>
      </thead>
      <tbody>
        ${Object.values(model).map(item => `
          <tr>
            <td><b>${esc(item.node)}</b></td>
            <td>${item.incoming.map(port => esc(port.contact.id)).join(", ") || "—"}</td>
            <td>${item.incoming.map(port =>
              `${esc(port.id)} <small>(${esc(port.contact.id)}: ${esc(port.contact.sender)}→${esc(port.contact.receiver)})</small>`
            ).join("<br>") || "—"}</td>
            <td><b>${esc(item.hub)}</b></td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function physicalPositions(nodes, width, height) {
  const positions = {};
  const source = contactState.bundle.source;
  const destination = contactState.bundle.destination;
  const middle = nodes.filter(node => node !== source && node !== destination);

  if (source) positions[source] = { x: 86, y: height / 2 };
  if (destination && destination !== source) positions[destination] = { x: width - 86, y: height / 2 };

  if (middle.length === 1) {
    positions[middle[0]] = { x: width / 2, y: height / 2 };
  } else {
    middle.forEach((node, index) => {
      const angle = -Math.PI / 2 + (2 * Math.PI * index / Math.max(1, middle.length));
      positions[node] = {
        x: width / 2 + width * .22 * Math.cos(angle),
        y: height / 2 + height * .32 * Math.sin(angle)
      };
    });
  }

  nodes.filter(node => !positions[node]).forEach((node, index) => {
    positions[node] = { x: width / 2, y: 70 + index * 70 };
  });
  return positions;
}

function renderPhysicalGraph() {
  const svg = topologyUI.physicalGraph;
  const width = 960;
  const height = 320;
  const nodes = getNodes();
  const positions = physicalPositions(nodes, width, height);
  const grouped = groupContacts();
  const best = new Set(contactState.highlight.bestPath || []);

  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.innerHTML = markerDefinitions("physical");

  contactState.contacts.forEach((contact, index) => {
    const from = positions[contact.sender];
    const to = positions[contact.receiver];
    if (!from || !to) return;
    const group = grouped.get(`${contact.sender}\u0000${contact.receiver}`) || [index];
    const groupIndex = group.indexOf(index);
    const offset = (groupIndex - (group.length - 1) / 2) * 28;
    drawContactEdge(svg, from, to, {
      offset,
      stroke: best.has(contact.id) ? "#2e8b57" : "#df8a36",
      width: best.has(contact.id) ? 5 : 2.5,
      marker: best.has(contact.id) ? "physical-best" : "physical-contact",
      label: `${contact.id} [${fmt(contact.start)},${fmt(contact.end)}]`,
      nodeRadius: 34
    });
  });

  nodes.forEach(node => {
    const position = positions[node];
    const kind = node === contactState.bundle.source ? "source" :
      node === contactState.bundle.destination ? "destination" : "normal";
    const fill = kind === "source" ? "#348f95" : kind === "destination" ? "#2e8b57" : "#dcecf7";
    const textColor = kind === "normal" ? "#17202a" : "white";
    appendSvg(svg, "circle", {
      cx: position.x, cy: position.y, r: 34,
      fill, stroke: "#2176ae", "stroke-width": 3
    });
    addTopologySvgText(svg, position.x, position.y + 6, node, 18, textColor, "middle", "bold");
  });
}

function renderSplitGraph() {
  const svg = topologyUI.splitGraph;
  const model = buildModel();
  const nodes = getNodes();
  const width = 1200;
  const height = Math.max(720, Math.ceil(Math.max(1, nodes.length - 2) / 4) * 180 + 520);
  const centers = physicalPositions(nodes, width, height);
  const ports = {};
  const hubs = {};
  const best = new Set(contactState.highlight.bestPath || []);
  const grouped = groupContacts();

  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.innerHTML = markerDefinitions("split");

  Object.values(model).forEach(item => {
    const center = centers[item.node];
    const count = item.incoming.length;
    const clusterHeight = Math.max(126, count * 52 + 38);
    appendSvg(svg, "rect", {
      x: center.x - 105, y: center.y - clusterHeight / 2,
      width: 210, height: clusterHeight, rx: 18,
      fill: "#f8fafc", stroke: "#b8c1cb", "stroke-width": 2,
      "stroke-dasharray": "7 5"
    });
    addTopologySvgText(svg, center.x, center.y - clusterHeight / 2 + 21,
      `SATELLITE ${item.node}`, 12, "#52606d", "middle", "bold", "cluster-label");

    hubs[item.node] = { x: center.x + 55, y: center.y + 10, id: item.hub };
    item.incoming.forEach((port, index) => {
      const y = center.y + 10 + (index - (count - 1) / 2) * 47;
      ports[port.contactIndex] = { x: center.x - 55, y, id: port.id };
    });
  });

  Object.values(model).forEach(item => {
    item.incoming.forEach(port => {
      const start = ports[port.contactIndex];
      const end = hubs[item.node];
      drawStraightArrow(svg, start, end, "#2176ae", 2.4, "split-internal");
    });
  });

  contactState.contacts.forEach((contact, index) => {
    const from = hubs[contact.sender];
    const to = ports[index];
    if (!from || !to) return;
    const group = grouped.get(`${contact.sender}\u0000${contact.receiver}`) || [index];
    const groupIndex = group.indexOf(index);
    const offset = (groupIndex - (group.length - 1) / 2) * 34;
    drawContactEdge(svg, from, to, {
      offset,
      stroke: best.has(contact.id) ? "#2e8b57" : "#df8a36",
      width: best.has(contact.id) ? 5 : 2.7,
      marker: best.has(contact.id) ? "split-best" : "split-contact",
      label: `${contact.id} ${contact.sender}→${contact.receiver} [${fmt(contact.start)},${fmt(contact.end)}]`,
      nodeRadius: 20
    });
  });

  Object.values(model).forEach(item => {
    item.incoming.forEach(port => {
      const position = ports[port.contactIndex];
      appendSvg(svg, "circle", {
        cx: position.x, cy: position.y, r: 20,
        fill: "#e8f2f8", stroke: "#2176ae", "stroke-width": 2.5
      });
      addTopologySvgText(svg, position.x, position.y + 5, port.id, 12, "#17202a", "middle", "bold");
      addTopologySvgText(svg, position.x - 27, position.y + 4, port.contact.id, 10, "#68737f", "end", "bold");
    });

    const hub = hubs[item.node];
    appendSvg(svg, "circle", {
      cx: hub.x, cy: hub.y, r: 24,
      fill: "#f8dbb8", stroke: "#df8a36", "stroke-width": 3
    });
    addTopologySvgText(svg, hub.x, hub.y + 5, hub.id, 13, "#17202a", "middle", "bold");
  });
}

function groupContacts() {
  const grouped = new Map();
  contactState.contacts.forEach((contact, index) => {
    const key = `${contact.sender}\u0000${contact.receiver}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(index);
  });
  return grouped;
}

function drawContactEdge(svg, from, to, options) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy) || 1;
  const ux = dx / distance;
  const uy = dy / distance;
  const nx = -uy;
  const ny = ux;
  const radius = options.nodeRadius || 0;
  const start = { x: from.x + ux * radius, y: from.y + uy * radius };
  const end = { x: to.x - ux * radius, y: to.y - uy * radius };
  const control = {
    x: (start.x + end.x) / 2 + nx * options.offset,
    y: (start.y + end.y) / 2 + ny * options.offset
  };
  const path = appendSvg(svg, "path", {
    d: `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`,
    fill: "none", stroke: options.stroke, "stroke-width": options.width,
    "stroke-linecap": "round", "marker-end": `url(#${options.marker})`
  });
  path.setAttribute("aria-label", options.label);

  const labelX = (start.x + 2 * control.x + end.x) / 4 + nx * 12;
  const labelY = (start.y + 2 * control.y + end.y) / 4 + ny * 12;
  addTopologySvgText(svg, labelX, labelY, options.label, 10.5, options.stroke, "middle", "bold");
}

function drawStraightArrow(svg, from, to, stroke, width, marker) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy) || 1;
  const ux = dx / distance;
  const uy = dy / distance;
  appendSvg(svg, "line", {
    x1: from.x + ux * 20, y1: from.y + uy * 20,
    x2: to.x - ux * 24, y2: to.y - uy * 24,
    stroke, "stroke-width": width, "marker-end": `url(#${marker})`
  });
}

function markerDefinitions(prefix) {
  return `
    <defs>
      <marker id="${prefix}-contact" markerWidth="10" markerHeight="10" refX="9" refY="3"
        orient="auto" markerUnits="strokeWidth"><path d="M0,0 L0,6 L9,3 z" fill="#df8a36"></path></marker>
      <marker id="${prefix}-best" markerWidth="10" markerHeight="10" refX="9" refY="3"
        orient="auto" markerUnits="strokeWidth"><path d="M0,0 L0,6 L9,3 z" fill="#2e8b57"></path></marker>
      <marker id="${prefix}-internal" markerWidth="10" markerHeight="10" refX="9" refY="3"
        orient="auto" markerUnits="strokeWidth"><path d="M0,0 L0,6 L9,3 z" fill="#2176ae"></path></marker>
    </defs>
  `;
}

function appendSvg(svg, tag, attributes) {
  const element = document.createElementNS(SVG_NS, tag);
  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, String(value)));
  svg.appendChild(element);
  return element;
}

function addTopologySvgText(svg, x, y, value, size, fill, anchor = "start", weight = "normal", className = "") {
  const element = appendSvg(svg, "text", {
    x, y, fill, "font-size": size, "text-anchor": anchor,
    "font-family": "Times New Roman, Microsoft JhengHei", "font-weight": weight
  });
  if (className) element.setAttribute("class", className);
  element.textContent = value;
}

function fmt(value) {
  const number = Number(value);
  return Number.isFinite(number) ? String(Number(number.toFixed(2))) : "—";
}

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

syncFromContactModel();
})();
