"use strict";

const topologyElements = {
  tabs: [...document.querySelectorAll("[data-view-target]")],
  views: [...document.querySelectorAll(".model-view")],
  graph: document.getElementById("timeExpandedGraph"),
  bundleSummary: document.getElementById("expandedBundleSummary"),
  contactTable: document.getElementById("expandedContactTable")
};

topologyElements.tabs.forEach(tab => {
  tab.addEventListener("click", () => activateModelView(tab.dataset.viewTarget));
});

window.addEventListener("visualizer-state-change", renderTimeExpandedTopology);

function activateModelView(targetId) {
  topologyElements.tabs.forEach(tab => {
    const selected = tab.dataset.viewTarget === targetId;
    tab.classList.toggle("active", selected);
    tab.setAttribute("aria-selected", String(selected));
  });

  topologyElements.views.forEach(view => {
    const selected = view.id === targetId;
    view.hidden = !selected;
    view.classList.toggle("active", selected);
  });

  if (targetId === "satelliteModelView") renderTimeExpandedTopology();
}

function currentVisualizerState() {
  return typeof window.getContactVisualizerState === "function"
    ? window.getContactVisualizerState()
    : { contacts: [], bundle: { source: "S", destination: "D", generationTime: 0, size: 0 }, highlight: {} };
}

function renderTimeExpandedTopology() {
  const { contacts, bundle, highlight } = currentVisualizerState();
  if (!topologyElements.graph || !contacts.length) return;

  const model = buildExpandedModel(contacts, bundle);
  drawExpandedGraph(model, bundle, highlight || {});
  renderExpandedContactTable(model.contacts);
  topologyElements.bundleSummary.textContent =
    `Bundle ${bundle.source}→${bundle.destination} · g=${formatTopologyNumber(bundle.generationTime)} · B=${formatTopologyNumber(bundle.size)}`;
}

function buildExpandedModel(contacts, bundle) {
  const satellites = [...new Set([
    bundle.source,
    ...contacts.flatMap(contact => [contact.sender, contact.receiver]),
    bundle.destination
  ])].filter(Boolean);

  satellites.sort((left, right) => {
    if (left === bundle.source) return -1;
    if (right === bundle.source) return 1;
    if (left === bundle.destination) return 1;
    if (right === bundle.destination) return -1;
    return left.localeCompare(right);
  });

  const expandedContacts = contacts.map((contact, index) => {
    const transmission = bundle.size / contact.rate;
    const finish = contact.start + transmission;
    const arrival = finish + contact.delay;
    const timeOK = Number.isFinite(transmission) && finish <= contact.end;
    const capacityOK = contact.residual >= bundle.size;

    return {
      ...contact,
      index,
      transmission,
      finish,
      arrival,
      timeOK,
      capacityOK,
      feasible: timeOK && capacityOK
    };
  });

  const rawTimes = [
    bundle.generationTime,
    ...expandedContacts.flatMap(contact => [
      contact.start,
      contact.end,
      contact.finish,
      contact.arrival
    ])
  ].filter(Number.isFinite);

  const times = [...new Set(rawTimes.map(time => Number(time.toFixed(2))))]
    .sort((a, b) => a - b);

  return { satellites, times, contacts: expandedContacts };
}

function drawExpandedGraph(model, bundle, highlight) {
  const { satellites, times, contacts } = model;
  const left = 120;
  const right = 70;
  const top = 82;
  const rowGap = 105;
  const columnGap = Math.max(95, Math.min(145, 1080 / Math.max(1, times.length - 1)));
  const width = Math.max(920, left + right + columnGap * Math.max(1, times.length - 1));
  const height = Math.max(560, top + 70 + rowGap * Math.max(1, satellites.length - 1));

  topologyElements.graph.setAttribute("viewBox", `0 0 ${width} ${height}`);
  topologyElements.graph.style.minWidth = `${width}px`;
  topologyElements.graph.innerHTML = `
    <defs>
      <marker id="expandedWaitArrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="#c4cad1"></path></marker>
      <marker id="expandedContactArrow" markerWidth="9" markerHeight="9" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#2166c2"></path></marker>
      <marker id="expandedBestArrow" markerWidth="9" markerHeight="9" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#2e8b57"></path></marker>
      <marker id="expandedBadArrow" markerWidth="9" markerHeight="9" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#c84d4d"></path></marker>
    </defs>
  `;

  const xAt = time => {
    const index = times.findIndex(candidate => Math.abs(candidate - Number(time.toFixed(2))) < 0.001);
    return left + Math.max(0, index) * columnGap;
  };
  const yAt = satellite => top + satellites.indexOf(satellite) * rowGap;

  times.forEach(time => {
    const x = xAt(time);
    drawExpandedLine(x, 52, x, height - 35, "#e8ebef", 1, "4 5");
    addExpandedText(x, 29, `t=${formatTopologyNumber(time)}`, 11, "#66717d", "middle", "bold");
  });

  satellites.forEach(satellite => {
    const y = yAt(satellite);
    const role = satellite === bundle.source ? "SOURCE" : satellite === bundle.destination ? "DEST." : "SATELLITE";
    addExpandedText(20, y - 6, satellite, 17, "#17202a", "start", "bold");
    addExpandedText(20, y + 12, role, 9, satellite === bundle.source ? "#2166c2" : satellite === bundle.destination ? "#2e8b57" : "#7a8490", "start", "bold");

    for (let index = 0; index < times.length - 1; index += 1) {
      drawExpandedLine(
        xAt(times[index]) + 10,
        y,
        xAt(times[index + 1]) - 10,
        y,
        "#c4cad1",
        2,
        "",
        "url(#expandedWaitArrow)"
      );
    }

    times.forEach(time => {
      const x = xAt(time);
      const eventNode = drawExpandedCircle(x, y, 8, "#ffffff", "#87919c", 2);
      eventNode.dataset.satellite = satellite;
      eventNode.dataset.time = time;
    });
  });

  const bestPath = new Set(highlight.bestPath || []);

  contacts.forEach(contact => {
    const startX = xAt(contact.start);
    const endX = xAt(contact.arrival);
    const startY = yAt(contact.sender);
    const endY = yAt(contact.receiver);
    const selected = bestPath.has(contact.id);
    const color = selected ? "#2e8b57" : contact.feasible ? "#2166c2" : "#c84d4d";
    const marker = selected ? "url(#expandedBestArrow)" : contact.feasible ? "url(#expandedContactArrow)" : "url(#expandedBadArrow)";
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const curve = 22 + (contact.index % 3) * 11;
    path.setAttribute("d", `M ${startX} ${startY} C ${startX + curve} ${startY}, ${endX - curve} ${endY}, ${endX} ${endY}`);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", color);
    path.setAttribute("stroke-width", selected ? "5" : "3");
    path.setAttribute("stroke-dasharray", contact.feasible ? "" : "7 5");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("marker-end", marker);
    topologyElements.graph.appendChild(path);

    const labelX = (startX + endX) / 2;
    const labelY = (startY + endY) / 2 - 10 - (contact.index % 2) * 12;
    const label = `${contact.id} [${formatTopologyNumber(contact.start)},${formatTopologyNumber(contact.end)}]`;
    drawExpandedLabel(labelX, labelY, label, color);
  });

  const sourceX = xAt(bundle.generationTime);
  const sourceY = yAt(bundle.source);
  drawExpandedCircle(sourceX, sourceY, 13, "#e9f1fc", "#2166c2", 3);
  addExpandedText(sourceX, sourceY + 28, "Bundle generated", 10, "#2166c2", "middle", "bold");
}

function renderExpandedContactTable(contacts) {
  topologyElements.contactTable.innerHTML = `
    <table>
      <thead>
        <tr><th>Contact</th><th>Expanded transmission edge</th><th>Window</th><th>Status</th></tr>
      </thead>
      <tbody>
        ${contacts.map(contact => {
          const reasons = [];
          if (!contact.timeOK) reasons.push("time");
          if (!contact.capacityOK) reasons.push("capacity");
          const status = contact.feasible ? "usable" : reasons.join(" + ");
          return `
            <tr>
              <td><b>${escapeTopologyHtml(contact.id)}</b></td>
              <td>${escapeTopologyHtml(contact.sender)}@${formatTopologyNumber(contact.start)}
                → ${escapeTopologyHtml(contact.receiver)}@${formatTopologyNumber(contact.arrival)}</td>
              <td>[${formatTopologyNumber(contact.start)}, ${formatTopologyNumber(contact.end)}]</td>
              <td><span class="contact-status ${contact.feasible ? "ok" : "bad"}">${status}</span></td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
}

function drawExpandedLine(x1, y1, x2, y2, stroke, width, dash = "", marker = "") {
  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1", x1);
  line.setAttribute("y1", y1);
  line.setAttribute("x2", x2);
  line.setAttribute("y2", y2);
  line.setAttribute("stroke", stroke);
  line.setAttribute("stroke-width", width);
  if (dash) line.setAttribute("stroke-dasharray", dash);
  if (marker) line.setAttribute("marker-end", marker);
  topologyElements.graph.appendChild(line);
  return line;
}

function drawExpandedCircle(cx, cy, radius, fill, stroke, width) {
  const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  circle.setAttribute("cx", cx);
  circle.setAttribute("cy", cy);
  circle.setAttribute("r", radius);
  circle.setAttribute("fill", fill);
  circle.setAttribute("stroke", stroke);
  circle.setAttribute("stroke-width", width);
  topologyElements.graph.appendChild(circle);
  return circle;
}

function drawExpandedLabel(x, y, text, color) {
  const width = Math.max(74, text.length * 6.4);
  const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  rect.setAttribute("x", x - width / 2);
  rect.setAttribute("y", y - 13);
  rect.setAttribute("width", width);
  rect.setAttribute("height", 20);
  rect.setAttribute("rx", 4);
  rect.setAttribute("fill", "#ffffff");
  rect.setAttribute("stroke", color);
  rect.setAttribute("stroke-width", 1);
  topologyElements.graph.appendChild(rect);
  addExpandedText(x, y + 1, text, 10, color, "middle", "bold");
}

function addExpandedText(x, y, text, size, fill, anchor = "start", weight = "normal") {
  const element = document.createElementNS("http://www.w3.org/2000/svg", "text");
  element.setAttribute("x", x);
  element.setAttribute("y", y);
  element.setAttribute("font-size", size);
  element.setAttribute("font-family", "Times New Roman, Microsoft JhengHei");
  element.setAttribute("font-weight", weight);
  element.setAttribute("fill", fill);
  element.setAttribute("text-anchor", anchor);
  element.textContent = text;
  topologyElements.graph.appendChild(element);
}

function formatTopologyNumber(value) {
  return Number.isFinite(value) ? String(Number(value.toFixed(2))) : "∞";
}

function escapeTopologyHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

renderTimeExpandedTopology();
