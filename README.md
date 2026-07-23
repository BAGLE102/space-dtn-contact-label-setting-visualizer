# Space DTN Contact Label-setting Visualizer

An interactive, browser-based visualizer for a Contact Graph adaptation of the Label-setting algorithm used in resource-constrained shortest path problems.

This project is a research prototype for studying **Space Delay/Disruption-Tolerant Networking (Space DTN)** routing with scheduled Contacts, non-fragmented Bundles, Contact availability windows, data rates, residual capacities, and earliest-arrival routing.

## Live Demo

After GitHub Pages is enabled:

```text
https://bagle102.github.io/space-dtn-contact-label-setting-visualizer/
```

## Research Context

The project adapts the control structure of a traditional SPPRC/SPPTW Label-setting algorithm to a Space DTN Contact Graph.

The main loop is preserved:

1. Pick an unprocessed Label.
2. Extend it through outgoing transitions.
3. Check feasibility.
4. Add feasible Labels to `U`.
5. Move processed Labels to `P`.
6. Remove dominated Labels.
7. Select the earliest feasible destination Label.

The modified parts are:

- Physical nodes are replaced by scheduled Contacts as graph vertices.
- Graph edges represent topology-compatible Contact transitions.
- Labels store a resident Contact and Bundle arrival time.
- Resource extension includes waiting, transmission time, and propagation delay.
- Feasibility includes Contact duration and residual capacity.
- The final objective is earliest feasible arrival instead of minimum monetary cost.

## Model

### Contact

Each Contact is represented as:

```text
Contact = (
  id,
  sender,
  receiver,
  start,
  end,
  rate,
  residualCapacity,
  propagationDelay
)
```

### Bundle

Each Bundle is represented as:

```text
Bundle = (
  source,
  destination,
  generationTime,
  size
)
```

The current prototype assumes that a Bundle is **non-fragmented**. A Contact must therefore be able to carry the complete Bundle.

## Contact Transition

Two Contacts `c_i` and `c_j` are topology-compatible when:

```text
receiver(c_i) = sender(c_j)
```

A virtual source `SRC` connects to every Contact whose sender equals the Bundle source. A virtual destination `DST` is connected from every Contact whose receiver equals the Bundle destination.

## Resource Extension Function

For a Label `L_i` extended to Contact `c_j`:

```text
s_j = max(arrival(L_i), start(c_j))
x_j = BundleSize / rate(c_j)
finish_j = s_j + x_j
arrival(L_j) = finish_j + propagationDelay(c_j)
```

Where:

- `s_j` is the actual transmission start time.
- `x_j` is the complete Bundle transmission time.
- `finish_j` is the transmission completion time.
- `arrival(L_j)` is the time at which the Bundle reaches the receiver.

## Feasibility Conditions

An extension to Contact `c_j` is feasible only when all of the following are true:

```text
topologyOK
AND s_j + x_j <= end(c_j)
AND residualCapacity(c_j) >= BundleSize
```

These conditions mean:

1. The Bundle is physically located at `sender(c_j)`.
2. The complete Bundle transmission finishes before the Contact closes.
3. The Contact has enough residual capacity for the complete Bundle.

Propagation delay is added after the transmission-window check because the Bundle must finish **transmission** before the Contact ends.

## Label Definition

The simplified Label used by this prototype is:

```text
Label = (
  id,
  residentContact,
  arrivalTime,
  ContactSequence,
  predecessorLabel
)
```

## Dominance

The current prototype optimizes only earliest arrival. For two Labels resident at the same Contact:

```text
L_1 dominates L_2
if arrival(L_1) <= arrival(L_2)
```

If path-dependent resources such as buffer occupancy, energy, or risk are added later, the dominance rule must be extended to multi-resource Pareto dominance.

## Capacity Handling

During Label search, residual capacity is only checked:

```text
residualCapacity(c_j) >= BundleSize
```

The prototype does **not** subtract capacity when a candidate Label is created, because candidate Labels are hypothetical routes. In a multi-Bundle routing system, capacity should be reserved only after a route has been selected and committed.

## Default Example

The default Contact plan contains:

| Contact | Link | Window | Rate | Residual Capacity | Delay |
|---|---|---:|---:|---:|---:|
| C1 | S → A | [0, 5] | 5 | 20 | 0.2 |
| C2 | A → D | [3, 6] | 2 | 8 | 0.2 |
| C3 | A → B | [4, 8] | 5 | 15 | 0.2 |
| C4 | B → D | [7, 10] | 5 | 20 | 0.2 |
| C5 | S → D | [1, 2] | 5 | 20 | 0.2 |

The default Bundle is:

```text
source = S
destination = D
generationTime = 0
size = 10
```

Expected behavior:

- `C5` is rejected because the Bundle cannot finish transmission before the Contact ends.
- `C2` is rejected because its time window and residual capacity are insufficient.
- `C1 → C3 → C4` is selected as the earliest feasible Contact sequence.

## Two Graph-model Views

The site now presents the same Contact plan in two complementary representations:

1. **Contact-as-vertex Model** — the original CGR-oriented view. Each scheduled Contact is a graph vertex, and transitions connect topology-compatible Contacts.
2. **Satellite Time-expanded Topology** — each vertex is a satellite state `(satellite, time)`. Scheduled Contacts become transmission edges, while horizontal edges on the same satellite represent store-and-wait intervals.

For the current Bundle, a Contact `c` is visualized at its earliest-use timing as:

```text
sender(c)@start(c)
  -> receiver(c)@[start(c) + BundleSize/rate(c) + propagationDelay(c)]
```

This makes asynchronous links explicit. Contacts reaching the same physical satellite at different times terminate at different time-expanded vertices, such as `B@t1` and `B@t2`.

## Features

- Switchable Contact-vertex and satellite-node time-expanded views
- Interactive Contact Graph visualization
- Editable Bundle parameters
- Editable Contact plan
- Automatically generated topology transitions
- Step-by-step Label selection and extension
- Explicit topology, time-window, and capacity checks
- Unprocessed Label set `U`
- Processed Label set `P`
- Earliest-arrival dominance
- Detailed execution log
- Best-path highlighting
- Responsive single-page interface

## How to Use

1. Open `index.html`, or use the GitHub Pages URL.
2. Press **Next Step** to execute one algorithm event.
3. Press **Run All** to complete the algorithm automatically.
4. Edit Bundle or Contact values in the editor.
5. Press **Apply & Reset** after changing parameters.
6. Compare feasibility results and the final Contact sequence.

Try changing the default Bundle size from `10` to `5`. The direct Contact `C5` becomes feasible and should be selected as the earliest-arrival route.

## Run Locally

No build step or package installation is required.

You can open `index.html` directly, or start a local HTTP server:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Project Structure

```text
.
├── index.html   # Page structure
├── styles.css   # Responsive layout and visual styles
├── app.js       # Contact Graph model and Label-setting execution
└── README.md    # Model, algorithm, and usage documentation
```

## Current Scope and Limitations

This is a teaching and research prototype, not a complete CGR implementation.

Current assumptions:

- One non-fragmented Bundle is routed at a time.
- The Contact plan and residual capacities are static during one search.
- Capacity is a local Contact feasibility condition.
- The objective is earliest arrival only.
- Buffer occupancy is not yet included in the Label state.
- Contact confidence, energy, overbooking, route expiration, and multi-Bundle competition are not modeled.

## Possible Extensions

- Buffer availability over waiting intervals
- Multi-Bundle capacity reservation
- Bundle priority and deadline
- Energy and risk resources
- Fragmentation support
- Multi-resource Pareto dominance
- Import/export of Contact plans
- Comparison with CGR or Dijkstra-style baselines

## Reference

The interaction design and original Label-setting learning flow were inspired by:

- [SPPRC / SPPTW Label-setting Visualizer](https://bagle102.github.io/spprc-label-setting-visualizer/)
- [Shortest Paths with Resource Constraints — Label-setting Algorithm](https://www.adrian-haarbach.de/idp-graph-algorithms/implementation/spp-rc-label-setting/index_en.html)

## License

No license has been selected yet. Add a license before redistributing or accepting external contributions.
