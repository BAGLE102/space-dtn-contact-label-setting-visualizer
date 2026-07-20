"use strict";

let contacts = [];
let bundle = { source: "S", destination: "D", generationTime: 0, size: 10 };

let U = [];
let P = [];
let nextLabelId = 1;
let currentLabel = null;
let candidateIndex = 0;
let phase = "pick";
let finished = false;
let highlight = {};
let stepNumber = 0;

const elements = {
  graph: document.getElementById("graph"),
  explain: document.getElementById("explain"),
  log: document.getElementById("log"),
  uTable: document.querySelector("#uTable tbody"),
  pTable: document.querySelector("#pTable tbody"),
  uCount: document.getElementById("uCount"),
  pCount: document.getElementById("pCount"),
  stepCounter: document.getElementById("stepCounter"),
  bundleSummary: document.getElementById("bundleSummary"),
  transitionSummary: document.getElementById("transitionSummary"),
  contactEditor: document.getElementById("contactEditor"),
  nextButton: document.getElementById("nextButton"),
  runButton: document.getElementById("runButton"),
  resetButton: document.getElementById("resetButton"),
  defaultButton: document.getElementById("defaultButton"),
  applyButton: document.getElementById("applyButton"),
  addContactButton: document.getElementById("addContactButton"),
  removeContactButton: document.getElementById("removeContactButton")
};

elements.nextButton.addEventListener("click", nextStep);
elements.runButton.addEventListener("click", runAll);
elements.resetButton.addEventListener("click", resetAlgorithm);
elements.defaultButton.addEventListener("click", resetDefaultContacts);
elements.applyButton.addEventListener("click", applyAndReset);
elements.addContactButton.addEventListener("click", addContact);
elements.removeContactButton.addEventListener("click", removeLastContact);

function resetDefaultContacts() {
  contacts = [
    { id: "C1", sender: "S", receiver: "A", start: 0, end: 5, rate: 5, residual: 20, delay: 0.2 },
    { id: "C2", sender: "A", receiver: "D", start: 3, end: 6, rate: 2, residual: 8, delay: 0.2 },
    { id: "C3", sender: "A", receiver: "B", start: 4, end: 8, rate: 5, residual: 15, delay: 0.2 },
    { id: "C4", sender: "B", receiver: "D", start: 7, end: 10, rate: 5, residual: 20, delay: 0.2 },
    { id: "C5", sender: "S", receiver: "D", start: 1, end: 2, rate: 5, residual: 20, delay: 0.2 }
  ];
  bundle = { source: "S", destination: "D", generationTime: 0, size: 10 };
  writeBundleInputs();
  refreshEditors();
  resetAlgorithm();
}

function writeBundleInputs() {
  document.getElementById("bundleSource").value = bundle.source;
  document.getElementById("bundleDestination").value = bundle.destination;
  document.getElementById("bundleGeneration").value = bundle.generationTime;
  document.getElementById("bundleSize").value = bundle.size;
}

function numberFromInput(id, fallback, minimum = 0) {
  const value = Number(document.getElementById(id)?.value);
  return Number.isFinite(value) ? Math.max(minimum, value) : fallback;
}

function cleanNodeName(value, fallback) {
  const cleaned = String(value || "").trim().replace(/[^A-Za-z0-9_-]/g, "");
  return cleaned || fallback;
}

function applyEditorValues() {
  bundle.source = cleanNodeName(document.getElementById("bundleSource").value, bundle.source);
  bundle.destination = cleanNodeName(document.getElementById("bundleDestination").value, bundle.destination);
  bundle.generationTime = numberFromInput("bundleGeneration", bundle.generationTime);
  bundle.size = numberFromInput("bundleSize", bundle.size, 0.1);

  contacts.forEach((contact, index) => {
    contact.sender = cleanNodeName(document.getElementById(`contact-${index}-sender`)?.value, contact.sender);
    contact.receiver = cleanNodeName(document.getElementById(`contact-${index}-receiver`)?.value, contact.receiver);
    contact.start = numberFromInput(`contact-${index}-start`, contact.start);
    contact.end = numberFromInput(`contact-${index}-end`, contact.end);
    contact.rate = numberFromInput(`contact-${index}-rate`, contact.rate, 0.01);
    contact.residual = numberFromInput(`contact-${index}-residual`, contact.residual);
    contact.delay = numberFromInput(`contact-${index}-delay`, contact.delay);
  });
}

function applyAndReset() {
  applyEditorValues();
  writeBundleInputs();
  refreshEditors();
  resetAlgorithm();
}

function addContact() {
  applyEditorValues();
  contacts.push({
    id: nextContactId(),
    sender: bundle.source,
    receiver: bundle.destination,
    start: 0,
    end: 10,
    rate: 1,
    residual: 10,
    delay: 0
  });
  refreshEditors();
  resetAlgorithm();
}

function removeLastContact() {
  applyEditorValues();
  if (contacts.length <= 1) {
    setExplanation("<span class='warning'>At least one Contact is required.</span>");
    return;
  }
  contacts.pop();
  refreshEditors();
  resetAlgorithm();
}

function removeContact(index) {
  applyEditorValues();
  if (contacts.length <= 1) {
    setExplanation("<span class='warning'>At least one Contact is required.</span>");
    return;
  }
  contacts.splice(index, 1);
  refreshEditors();
  resetAlgorithm();
}

function nextContactId() {
  let number = 1;
  while (contacts.some(contact => contact.id === `C${number}`)) number += 1;
  return `C${number}`;
}

function refreshEditors() {
  renderContactEditor();
  renderTransitionSummary();
}

function renderContactEditor() {
  elements.contactEditor.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>ID</th><th>Sender</th><th>Receiver</th><th>Start</th><th>End</th>
          <th>Rate</th><th>Residual capacity</th><th>Propagation delay</th><th>Action</th>
        </tr>
      </thead>
      <tbody>
        ${contacts.map((contact, index) => `
          <tr>
            <td><b>${escapeHtml(contact.id)}</b></td>
            <td><input class="node-input" id="contact-${index}-sender" value="${escapeHtml(contact.sender)}" aria-label="${contact.id} sender"></td>
            <td><input class="node-input" id="contact-${index}-receiver" value="${escapeHtml(contact.receiver)}" aria-label="${contact.id} receiver"></td>
            <td><input id="contact-${index}-start" type="number" min="0" step="0.1" value="${contact.start}" aria-label="${contact.id} start"></td>
            <td><input id="contact-${index}-end" type="number" min="0" step="0.1" value="${contact.end}" aria-label="${contact.id} end"></td>
            <td><input id="contact-${index}-rate" type="number" min="0.01" step="0.1" value="${contact.rate}" aria-label="${contact.id} rate"></td>
            <td><input id="contact-${index}-residual" type="number" min="0" step="0.1" value="${contact.residual}" aria-label="${contact.id} residual capacity"></td>
            <td><input id="contact-${index}-delay" type="number" min="0" step="0.1" value="${contact.delay}" aria-label="${contact.id} propagation delay"></td>
            <td><button class="delete-contact" type="button" data-remove-contact="${index}">Delete</button></td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;

  elements.contactEditor.querySelectorAll("[data-remove-contact]").forEach(button => {
    button.addEventListener("click", () => removeContact(Number(button.dataset.removeContact)));
  });
}

function buildTransitions() {
  const transitions = [];

  contacts.forEach(contact => {
    if (contact.sender === bundle.source) transitions.push({ from: "SRC", to: contact.id });
  });

  contacts.forEach(from => {
    contacts.forEach(to => {
      if (from.id !== to.id && from.receiver === to.sender) {
        transitions.push({ from: from.id, to: to.id });
      }
    });
    if (from.receiver === bundle.destination) transitions.push({ from: from.id, to: "DST" });
  });

  return transitions;
}

function renderTransitionSummary() {
  const transitions = buildTransitions();
  elements.transitionSummary.textContent = transitions.length
    ? transitions.map(transition => `${transition.from} → ${transition.to}`).join("   |   ")
    : "No topology-compatible transitions for the current source and destination.";
}

function resetAlgorithm() {
  U = [{ id: "L0", contactId: "SRC", arrival: bundle.generationTime, path: [], predecessor: null }];
  P = [];
  nextLabelId = 1;
  currentLabel = null;
  candidateIndex = 0;
  phase = "pick";
  finished = false;
  highlight = {};
  stepNumber = 0;

  setExplanation(`
    <b>Initialize</b><br>
    建立 L0。Bundle 位於來源節點 <b>${escapeHtml(bundle.source)}</b>，
    generation time = ${formatNumber(bundle.generationTime)}，size = ${formatNumber(bundle.size)}。
  `);
  setLog(`Initialize U={L0@SRC}, P=∅\n`);
  render();
}

function getContact(id) {
  return contacts.find(contact => contact.id === id);
}

function currentPhysicalNode(label) {
  if (label.contactId === "SRC") return bundle.source;
  return getContact(label.contactId)?.receiver || "?";
}

function candidateContacts(label) {
  const physicalNode = currentPhysicalNode(label);
  return contacts.filter(contact => contact.sender === physicalNode && !label.path.includes(contact.id));
}

function labelText(label) {
  return `${label.id}@${label.contactId} (arrival=${formatNumber(label.arrival)})`;
}

function findDominator(label) {
  return U.concat(P).find(existing =>
    existing.contactId === label.contactId && existing.arrival <= label.arrival
  );
}

function pruneDominatedBy(label) {
  const removed = [];
  U = U.filter(existing => {
    if (existing.contactId === label.contactId && label.arrival < existing.arrival) {
      removed.push(existing);
      return false;
    }
    return true;
  });
  P = P.filter(existing => {
    if (existing.contactId === label.contactId && label.arrival < existing.arrival) {
      removed.push(existing);
      return false;
    }
    return true;
  });
  return removed;
}

function nextStep() {
  if (finished) {
    setExplanation("Algorithm finished. Press Reset Algorithm to run again.");
    return;
  }

  stepNumber += 1;
  highlight = {};

  if (phase === "pick") {
    if (U.length === 0) {
      finishAlgorithm();
      return;
    }

    U.sort((a, b) => a.arrival - b.arrival);
    currentLabel = U.shift();
    candidateIndex = 0;
    phase = "extend";
    highlight.currentContact = currentLabel.contactId;

    setExplanation(`
      <b>Pick Label</b><br>
      從 U 中選擇 arrival time 最小的 Label：<b>${labelText(currentLabel)}</b>。<br>
      Bundle 目前位於 physical node <b>${escapeHtml(currentPhysicalNode(currentLabel))}</b>。
    `);
    appendLog(`Pick ${labelText(currentLabel)} from U.`);
    render();
    return;
  }

  const resident = currentLabel.contactId === "SRC" ? null : getContact(currentLabel.contactId);
  if (resident?.receiver === bundle.destination) {
    P.push(currentLabel);
    highlight.currentContact = currentLabel.contactId;
    setExplanation(`
      <b>Destination reached</b><br>
      ${currentLabel.id} 使用 ${resident.id} 抵達目的節點 <b>${escapeHtml(bundle.destination)}</b>，因此移入 P。
    `);
    appendLog(`Move ${currentLabel.id} to P: destination ${bundle.destination} reached.`);
    currentLabel = null;
    phase = "pick";
    render();
    return;
  }

  const candidates = candidateContacts(currentLabel);
  if (candidateIndex >= candidates.length) {
    P.push(currentLabel);
    setExplanation(`<b>Finish Label</b><br>${currentLabel.id} 的所有候選 Contacts 都已檢查，移入 P。`);
    appendLog(`Move ${currentLabel.id} to P.`);
    currentLabel = null;
    phase = "pick";
    render();
    return;
  }

  const contact = candidates[candidateIndex];
  candidateIndex += 1;

  const topologyOK = currentPhysicalNode(currentLabel) === contact.sender;
  const serviceStart = Math.max(currentLabel.arrival, contact.start);
  const transmissionTime = bundle.size / contact.rate;
  const finishTime = serviceStart + transmissionTime;
  const timeOK = finishTime <= contact.end;
  const capacityOK = contact.residual >= bundle.size;
  const newArrival = finishTime + contact.delay;

  highlight.currentContact = currentLabel.contactId;
  highlight.candidateContact = contact.id;

  const calculations = `
    <div class="calculation">
      s = max(${formatNumber(currentLabel.arrival)}, ${formatNumber(contact.start)}) = ${formatNumber(serviceStart)}<br>
      x = ${formatNumber(bundle.size)} / ${formatNumber(contact.rate)} = ${formatNumber(transmissionTime)}<br>
      finish = ${formatNumber(serviceStart)} + ${formatNumber(transmissionTime)} = ${formatNumber(finishTime)}<br>
      arrival = ${formatNumber(finishTime)} + ${formatNumber(contact.delay)} = ${formatNumber(newArrival)}
    </div>
  `;

  const checks = `
    <div class="check-grid">
      <div class="check ${topologyOK ? "ok" : "bad"}"><b>${topologyOK ? "✓" : "×"} Topology</b><br>${escapeHtml(currentPhysicalNode(currentLabel))} ${topologyOK ? "=" : "≠"} ${escapeHtml(contact.sender)}</div>
      <div class="check ${timeOK ? "ok" : "bad"}"><b>${timeOK ? "✓" : "×"} Time window</b><br>${formatNumber(finishTime)} ${timeOK ? "≤" : ">"} ${formatNumber(contact.end)}</div>
      <div class="check ${capacityOK ? "ok" : "bad"}"><b>${capacityOK ? "✓" : "×"} Capacity</b><br>${formatNumber(contact.residual)} ${capacityOK ? "≥" : "<"} ${formatNumber(bundle.size)}</div>
    </div>
  `;

  if (!(topologyOK && timeOK && capacityOK)) {
    highlight.candidateStatus = "bad";
    setExplanation(`
      <b>Test ${contact.id}: ${escapeHtml(contact.sender)} → ${escapeHtml(contact.receiver)}</b>
      ${calculations}${checks}
      <p class="warning">至少一個條件失敗，不建立新 Label。</p>
    `);
    appendLog(`Reject ${contact.id}: topology=${topologyOK}, time=${timeOK}, capacity=${capacityOK}.`);
    render();
    return;
  }

  const newLabel = {
    id: `L${nextLabelId}`,
    contactId: contact.id,
    arrival: newArrival,
    path: currentLabel.path.concat(contact.id),
    predecessor: currentLabel.id
  };
  nextLabelId += 1;

  const dominator = findDominator(newLabel);
  if (dominator) {
    highlight.candidateStatus = "bad";
    setExplanation(`
      <b>${contact.id} 通過 feasibility check</b>
      ${calculations}${checks}
      <p class="warning">但是 ${newLabel.id} 被 ${dominator.id} 支配：後者已經更早或同時抵達 ${contact.id}。</p>
    `);
    appendLog(`Discard ${newLabel.id}@${contact.id}: dominated by ${dominator.id}.`);
    render();
    return;
  }

  const removed = pruneDominatedBy(newLabel);
  U.push(newLabel);
  highlight.candidateStatus = "good";
  setExplanation(`
    <b>Feasible extension: ${currentLabel.id} → ${newLabel.id}@${contact.id}</b>
    ${calculations}${checks}
    <p class="success">${newLabel.id} 加入 U。${removed.length ? `同時移除 ${removed.map(label => label.id).join(", ")}。` : "沒有 Label 被它支配。"}</p>
  `);
  appendLog(`Create ${labelText(newLabel)}, path=${newLabel.path.join("->")}.`);
  render();
}

function finishAlgorithm() {
  finished = true;
  const destinationLabels = P.filter(label => getContact(label.contactId)?.receiver === bundle.destination);

  if (destinationLabels.length === 0) {
    setExplanation(`<b>Finish</b><br>U 已清空，但沒有可行 Label 抵達 ${escapeHtml(bundle.destination)}。`);
    appendLog("Finish: no feasible Contact sequence.");
  } else {
    destinationLabels.sort((a, b) => a.arrival - b.arrival);
    const best = destinationLabels[0];
    highlight.bestPath = best.path;
    setExplanation(`
      <div class="result-card">
        <b>Earliest feasible Contact sequence</b><br>
        Label：${labelText(best)}<br>
        Path：<b>${best.path.join(" → ")}</b><br>
        Earliest arrival：<b>${formatNumber(best.arrival)}</b>
      </div>
    `);
    appendLog(`Finish: best=${labelText(best)}, path=${best.path.join("->")}.`);
  }

  render();
}

function runAll() {
  let guard = 0;
  while (!finished && guard < 1000) {
    nextStep();
    guard += 1;
  }
  if (guard >= 1000) {
    setExplanation("<span class='warning'>Stopped by safety guard. Check the Contact plan for repeated cycles.</span>");
  }
}

function render() {
  renderGraph();
  renderTables();
  renderHeaderState();
}

function renderHeaderState() {
  elements.uCount.textContent = U.length;
  elements.pCount.textContent = P.length;
  elements.stepCounter.textContent = finished ? "DONE" : stepNumber === 0 ? "READY" : `STEP ${stepNumber}`;
  elements.bundleSummary.textContent = `Bundle ${bundle.source}→${bundle.destination} · g=${formatNumber(bundle.generationTime)} · B=${formatNumber(bundle.size)}`;
  elements.nextButton.disabled = finished;
  elements.runButton.disabled = finished;
}

function renderTables() {
  renderLabelRows(elements.uTable, U);
  renderLabelRows(elements.pTable, P);
}

function renderLabelRows(tbody, labels) {
  tbody.innerHTML = labels.map(label => `
    <tr>
      <td>${label.id}</td>
      <td>${label.contactId}</td>
      <td>${formatNumber(label.arrival)}</td>
      <td>${label.path.join("→") || "ε"}</td>
    </tr>
  `).join("");
}

function graphLayout() {
  const depth = new Map(contacts.map(contact => [contact.id, Infinity]));
  contacts.filter(contact => contact.sender === bundle.source).forEach(contact => depth.set(contact.id, 1));

  for (let pass = 0; pass < contacts.length; pass += 1) {
    contacts.forEach(from => {
      if (!Number.isFinite(depth.get(from.id))) return;
      contacts.forEach(to => {
        if (from.id !== to.id && from.receiver === to.sender) {
          depth.set(to.id, Math.min(depth.get(to.id), depth.get(from.id) + 1));
        }
      });
    });
  }

  const reachableDepths = [...depth.values()].filter(Number.isFinite);
  const lastReachableDepth = reachableDepths.length ? Math.max(...reachableDepths) : 1;
  depth.forEach((value, id) => {
    if (!Number.isFinite(value)) depth.set(id, lastReachableDepth + 1);
  });

  const destinationDepths = contacts
    .filter(contact => contact.receiver === bundle.destination)
    .map(contact => depth.get(contact.id) + 1);
  const destinationDepth = Math.max(lastReachableDepth + 1, ...destinationDepths);
  const maxDepth = Math.max(destinationDepth, 2);
  const groups = new Map();

  contacts.forEach(contact => {
    const contactDepth = depth.get(contact.id);
    if (!groups.has(contactDepth)) groups.set(contactDepth, []);
    groups.get(contactDepth).push(contact);
  });

  const positions = {
    SRC: { x: 58, y: 260 },
    DST: { x: 902, y: 260 }
  };

  groups.forEach((group, groupDepth) => {
    group.sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
    group.forEach((contact, index) => {
      positions[contact.id] = {
        x: 58 + (844 * groupDepth / maxDepth),
        y: 66 + (388 * (index + 1) / (group.length + 1))
      };
    });
  });

  return positions;
}

function renderGraph() {
  const positions = graphLayout();
  elements.graph.innerHTML = `
    <defs>
      <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L0,6 L9,3 z" fill="#a8b1bc"></path></marker>
      <marker id="arrowActive" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L0,6 L9,3 z" fill="#df8a36"></path></marker>
      <marker id="arrowBest" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L0,6 L9,3 z" fill="#2e8b57"></path></marker>
    </defs>
  `;

  const bestEdges = new Set();
  if (highlight.bestPath?.length) {
    const sequence = ["SRC", ...highlight.bestPath, "DST"];
    for (let index = 0; index < sequence.length - 1; index += 1) {
      bestEdges.add(`${sequence[index]}->${sequence[index + 1]}`);
    }
  }

  buildTransitions().forEach(transition => {
    const from = positions[transition.from];
    const to = positions[transition.to];
    if (!from || !to) return;

    const active = highlight.currentContact === transition.from && highlight.candidateContact === transition.to;
    const best = bestEdges.has(`${transition.from}->${transition.to}`);
    const fromOffset = transition.from === "SRC" ? 31 : 70;
    const toOffset = transition.to === "DST" ? 31 : 70;

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", from.x + fromOffset);
    line.setAttribute("y1", from.y);
    line.setAttribute("x2", to.x - toOffset);
    line.setAttribute("y2", to.y);
    line.setAttribute("stroke", best ? "#2e8b57" : active ? "#df8a36" : "#b5bdc7");
    line.setAttribute("stroke-width", best ? "5" : active ? "4" : "2");
    line.setAttribute("marker-end", best ? "url(#arrowBest)" : active ? "url(#arrowActive)" : "url(#arrow)");
    elements.graph.appendChild(line);
  });

  drawVirtualNode(positions.SRC, "SRC", bundle.source, highlight.currentContact === "SRC", "source");
  drawVirtualNode(positions.DST, "DST", bundle.destination, false, "destination");

  contacts.forEach(contact => drawContactNode(contact, positions[contact.id]));
}

function drawVirtualNode(position, label, physicalNode, active, kind) {
  const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  circle.setAttribute("cx", position.x);
  circle.setAttribute("cy", position.y);
  circle.setAttribute("r", 31);
  circle.setAttribute("fill", active ? "#348f95" : kind === "destination" ? "#2e8b57" : "#687888");
  circle.setAttribute("stroke", "white");
  circle.setAttribute("stroke-width", "4");
  elements.graph.appendChild(circle);
  addSvgText(position.x, position.y + 5, label, 14, "white", "middle", "bold");
  addSvgText(position.x, position.y + 51, physicalNode, 13, "#344150", "middle", "bold");
}

function drawContactNode(contact, position) {
  let fill = "#e8f2f8";
  let stroke = "#2176ae";

  if (highlight.currentContact === contact.id) {
    fill = "#c7e7e9";
    stroke = "#348f95";
  }
  if (highlight.candidateContact === contact.id) {
    fill = highlight.candidateStatus === "bad" ? "#f5cccc" :
      highlight.candidateStatus === "good" ? "#ccebd7" : "#f8dbb8";
    stroke = highlight.candidateStatus === "bad" ? "#c84d4d" :
      highlight.candidateStatus === "good" ? "#2e8b57" : "#df8a36";
  }
  if (highlight.bestPath?.includes(contact.id)) {
    fill = "#ccebd7";
    stroke = "#2e8b57";
  }

  const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  rect.setAttribute("x", position.x - 70);
  rect.setAttribute("y", position.y - 43);
  rect.setAttribute("width", 140);
  rect.setAttribute("height", 86);
  rect.setAttribute("rx", 12);
  rect.setAttribute("fill", fill);
  rect.setAttribute("stroke", stroke);
  rect.setAttribute("stroke-width", 3);
  elements.graph.appendChild(rect);

  addSvgText(position.x, position.y - 20, contact.id, 17, "#17202a", "middle", "bold");
  addSvgText(position.x, position.y, `${contact.sender} → ${contact.receiver}`, 14, "#24313d", "middle", "bold");
  addSvgText(position.x, position.y + 19, `[${formatNumber(contact.start)}, ${formatNumber(contact.end)}]`, 12, "#43505d", "middle");
  addSvgText(position.x, position.y + 36, `r=${formatNumber(contact.rate)}  R=${formatNumber(contact.residual)}`, 11, "#5e6975", "middle");

  const residentLabels = U.concat(P).filter(label => label.contactId === contact.id);
  residentLabels.slice(0, 3).forEach((label, index) => {
    addSvgText(
      position.x,
      position.y + 61 + index * 14,
      `${label.id}: τ=${formatNumber(label.arrival)}`,
      11,
      U.includes(label) ? "#df8a36" : "#2e8b57",
      "middle"
    );
  });
}

function addSvgText(x, y, text, size, fill, anchor = "start", weight = "normal") {
  const element = document.createElementNS("http://www.w3.org/2000/svg", "text");
  element.setAttribute("x", x);
  element.setAttribute("y", y);
  element.setAttribute("font-size", size);
  element.setAttribute("font-family", "Times New Roman, Microsoft JhengHei");
  element.setAttribute("font-weight", weight);
  element.setAttribute("fill", fill);
  element.setAttribute("text-anchor", anchor);
  element.textContent = text;
  elements.graph.appendChild(element);
}

function setExplanation(html) {
  elements.explain.innerHTML = html;
}

function setLog(text) {
  elements.log.textContent = text;
  elements.log.scrollTop = elements.log.scrollHeight;
}

function appendLog(text) {
  setLog(`${elements.log.textContent}${text}\n`);
}

function formatNumber(value) {
  return Number.isFinite(value) ? String(Number(value.toFixed(2))) : "∞";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

resetDefaultContacts();
