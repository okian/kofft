# React (TypeScript) + Rust (WebAssembly) — Team Playbook (Micro-Frontend Edition)

A practical, opinionated guide to keep our project clean, fast, and friendly to contribute to. Everything here is meant to make us effective allies to each other.

---

## 1) Goals & Principles

### 1.1 Tech Preference Policy — WASM over TypeScript; WebGL over DOM

We **prefer WebAssembly (Rust)** over TypeScript for compute-heavy or performance-sensitive code, and **WebGL/WebGPU** over DOM/SVG for rendering whenever practical.

**Why**

* Deterministic performance, lower GC pressure, SIMD, and memory/layout control in WASM
* GPU-accelerated rendering (WebGL/WebGPU) for large scenes, real-time visualization, and stable frame times

**Decision Tree**

1. **Is it compute-heavy?** (DSP, parsing, transforms, codecs, geometry) → **WASM** (+ Web Worker)
2. **Is it render-intensive?** (too many elements, real-time animation, shaders) → **WebGL/WebGPU**
3. **Is it mostly UI/controls/forms?** → TypeScript + React DOM (or Canvas for small dynamic bits)
4. **Interop needed?** Expose a thin, typed API in `@org/wasm-bindings` and keep the JS boundary minimal.

**Guardrails**

* Don’t port trivial business logic to WASM; keep it in TS for DX and maintainability.
* Prefer **WebGL/WebGPU** for visualizations; use DOM/SVG when semantics matter (forms, links, headings).
* For accessibility, pair WebGL with DOM overlays and ARIA where needed.

**Implementation Rules**

* All heavy work runs in **Web Workers**; UI thread stays responsive.
* Use **SharedArrayBuffer** + ring buffers for streaming data; batch operations to reduce JS↔WASM calls.
* For rendering, centralize GPU state (one context per surface), and stream data via mapped buffers.
* Provide TS fallbacks if a runtime lacks required features; feature-detect on boot and log capability matrix.
* **Prefer WebAssembly over TypeScript**: Whenever performance-critical logic is possible in Rust/WASM, implement it there rather than in TypeScript.
* **Prefer WebGL over DOM**: For rendering or visualization, choose GPU-accelerated WebGL (or WebGPU when stable) instead of heavy DOM/CSS operations.
* **Clarity over cleverness**: Prefer readable, boring code to smart one-liners.
* **Consistency > Perfection**: Follow the playbook even when you disagree; we can change rules by RFC.
* **Performance-conscious**: Measure before optimizing; avoid needless copies across the JS↔WASM boundary.
* **Colocation**: Keep code, tests, and docs close to where they’re used.
* **Reliable builds**: Reproducible, fast CI; no snowflake steps on contributors’ machines.
* **Micro-frontend autonomy**: Each slice should be independently buildable, testable, and deployable.

---

## 2) Repository Layout

Monorepo-ready with micro-frontend support.

```
web/
├─ apps/
│  ├─ shell/                   # Host shell / orchestrator
│  ├─ mfe-spectrogram/         # Micro-frontend (feature domain)
│  ├─ mfe-library/             # Another MFE example
│  └─ ...                      # Additional MFEs
├─ crates/                     # Rust crates (compiled to WASM)
│  └─ dsp_core/
├─ packages/
│  └─ wasm-bindings/           # Type-safe TS wrappers for WASM interfaces
├─ docs/
├─ configs/                    # Shared configs for linting, tsconfig, vite, etc.
├─ .editorconfig
├─ package.json / pnpm-lock.yaml
├─ turbo.json (or nx.json)
└─ tsconfig.base.json
```

**Why this split?**

* `apps/shell`: Single-spa or Module Federation host.
* `apps/mfe-*`: Self-contained MFEs (features, routing, assets, translations).
* `crates/*`: Pure Rust logic; no JS assumptions.
* `packages/wasm-bindings`: Stable FFI surface with TypeScript types, versioned separately so UI changes don’t force Rust rebuilds.

---

## 3) Micro-Frontend Strategy

* **Composition**: Shell hosts MFEs via Webpack Module Federation or Single-spa.
* **Deployment**: MFEs independently versioned and deployed to CDN or container registry.
* **Contracts**: Each MFE exposes a typed contract (props, events) documented in `docs/contracts/`.
* **Isolation**: MFEs manage their own routing subtree, state, and translations.
* **Shared dependencies**: React, React Router, Zustand, QueryClient configured as singletons at the shell level.

---

## 4) Frontend Structure Inside an MFE

```
mfe-spectrogram/src/
├─ app/                # MFE shell: providers, local routing, error boundaries
├─ features/
│  └─ spectrogram/     # Feature-sliced structure (components, hooks, model, wasm)
├─ shared/             # MFE-local primitives (can differ from global shared)
├─ public/
├─ styles/
└─ index.tsx           # Entry point, exports mount() / unmount()
```

**Rules**

* Each MFE must provide an explicit lifecycle API: `mount(el, props)`, `unmount(el)`.
* MFEs can be consumed by the host shell or other MFEs via Module Federation remotes.
* Communication between MFEs via event bus or shared state contract; no direct imports.

---

## 5) Code Style & Formatting

*(Same as before; Prettier + ESLint for JS/TS, rustfmt + clippy for Rust)*

---

## 6) Tooling & Build (with MFEs)

* **Bundler**: Vite with Module Federation plugin OR Webpack 5 (if federation is critical).
* **Testing**: Each MFE has its own Vitest + Playwright suite.
* **Storybook**: Run per-MFE for isolation, also aggregated at shell level.
* **Rust→WASM**: Shared crates compiled once, bindings distributed via `packages/wasm-bindings`.

---

## 7) Shell Responsibilities

* Provides routing frame and navigation.
* Hosts global providers (theme, query client, i18n).
* Manages dependency sharing (React singleton).
* Orchestrates MFEs: lazy loads, mounts, and unmounts.
* Handles global telemetry, error boundaries, authentication.

---

## 8) Deployment & Versioning

* MFEs are versioned and deployed independently (semantic version tags).
* Shell consumes MFEs by URL reference (e.g., CDN URL, version pinned in config).
* Rollbacks possible per-MFE.
* CI ensures MFE contracts are backward compatible before merge.

---

## 9) Communication & Contracts

* **Props**: MFEs receive input via props (typed via TS interfaces).
* **Events**: Use a shared event bus (RxJS, mitt, or custom) for cross-MFE communication.
* **Shared state**: Only for truly global data (e.g., user auth). Otherwise, MFEs manage their own state.

---

## 10) Testing MFEs

* Each MFE runs unit + E2E locally.
* Shell runs integration tests with MFEs mounted.
* Contract tests: ensure props/events conform to typed definitions.

---

## 11) Onboarding — Micro-Frontend Setup

1. Clone repo.
2. `pnpm i`.
3. `rustup target add wasm32-unknown-unknown`.
4. Build WASM crates once: `pnpm build:wasm`.
5. Start shell: `pnpm dev:shell`.
6. Start a specific MFE: `pnpm dev:mfe-spectrogram`.

---

## 12) RFC Process (Micro-Frontend Changes)

* Any cross-MFE contract change requires an RFC.
* Each MFE team can evolve independently, but shared contracts must be approved by at least two MFEs + shell owner.

---

By following this **micro-frontend edition playbook**, we balance autonomy (teams owning their MFEs) with consistency (shared patterns, contracts, and CI/CD).

## 25) Micro‑Frontend (MFE) Architecture

**Why MFE here?** Independent deployability, faster iteration per domain, and safer blast radius. Our shell app orchestrates route-level MFEs, each owning a vertical slice (UI + state + optional WASM).

### 25.1 Approach & Tech Choices

* **Composition**: Route-based MFEs loaded at runtime.
* **Mechanism**: Prefer **Webpack 5 Module Federation** (MF) or **vite-plugin-federation** when using Vite. Both are supported; choose one per repo and stick to it.
* **Alternatives**: Native ESM + **import maps** (simple but fewer ergonomics), **single-spa** (orchestration), **Web Components** (interop). Avoid iframes unless isolation is mandatory.

### 25.2 Repo Layout (MFE-aware)

```
repo/
├─ apps/
│  ├─ shell/                     # Host container (routing, layout, global providers)
│  ├─ mf-spectrogram/            # Remote MFE (feature domain)
│  ├─ mf-library/                 # Another remote
│  └─ mf-admin/                   # Another remote
├─ packages/
│  ├─ wasm-bindings/             # TS wrappers around WASM (versioned)
│  ├─ design-system/             # Shared UI primitives (web-components or React)
│  ├─ contracts/                 # Public types/interfaces for shell⇄remotes
│  └─ utilities/                 # Fetch client, logging, config, event bus
├─ crates/                        # Rust WASM crates (can be per-feature or shared)
└─ docs/
```

### 25.3 MFE Boundaries & Ownership

* Each MFE owns: **its routes, UI, state, side-effects, and optional WASM** touching its domain.
* Cross-feature logic lives in **shared packages** (design-system, utilities) or **contracts**.
* Avoid cross-imports between MFEs; communicate via typed contracts or an event bus.

### 25.4 Runtime Integration

* **Routing**: Shell defines top-level routes; remotes expose a **route manifest** (lazy components + loaders). Shell mounts remotes under route segments.
* **Providers**: Global providers (Theme, i18n, QueryClient) live in shell. Remotes read from context—no duplicate singletons.
* **Styling**: Design system is shared; enable CSS scoping or use CSS Modules/Tailwind with predictable prefixes.

### 25.5 Shared Dependencies

* Mark `react`, `react-dom`, router, state libs as **singletons** in federation config with strict version policies.
* Version pinning via `peerDependencies` + runtime checks in shell; surface helpful errors if a remote is incompatible.

### 25.6 Contracts & Type Safety

* Publish **`@org/contracts`** with TS types, Zod schemas, and minor/major version rules.
* Create **contract tests**: shell verifies each remote’s exposed API against `@org/contracts` at build and CI.

### 25.7 Communication Patterns

* Prefer **URL + server state** (React Query) for durable flows.
* For client-side events, use a tiny **event bus** (e.g., RxJS subject) in `packages/utilities` with **narrow, documented events**.
* For large data streams (e.g., PCM frames), use **SharedArrayBuffer + BroadcastChannel** or a **SharedWorker**. Fall back to `postMessage` if COOP/COEP not available.

### 25.8 Auth, Security & Isolation

* Auth tokens in **HttpOnly cookies**; remotes call via shared fetch client that handles CSRF, retries, tracing.
* Shell sets **COOP/COEP** and CSP headers so remotes can use **SAB/Atomics** and WASM SIMD.
* Feature flags & remote URLs come from **signed config** served by the shell (support safe canaries/rollbacks).

### 25.9 WASM in an MFE World

* A remote that needs WASM owns its **crate + init** and exposes high-level functions via **`@org/wasm-bindings`** or remote exports.
* Keep heavy compute in **Web Workers** co-located with the remote.
* For shared DSP engines, provide a **shared worker + shared memory ring buffer** exposed from `packages/wasm-bindings` to avoid duplicate engines across MFEs.

### 25.10 Observability & Errors

* Unified logging/telemetry in `packages/utilities` (Sentry/OpenTelemetry). Tag every event with `{ remote: name, version }`.
* Shell has a global error boundary; remotes have local ones. Degrade gracefully if a remote fails to load.

### 25.11 CI/CD & Deployment

* **Independently deployable remotes**: each MFE has its own pipeline and version.
* Shell consumes remotes by **URL** (runtime federation). Support **version pinning** + **fallbacks**.
* Automated **contract tests** and **visual diffs** per remote. Canary by redirecting a small % of traffic to a new remote URL.

### 25.12 Local Development

* Start shell + selected remotes: `pnpm dev:shell`, `pnpm dev:mf-spectrogram`, etc.
* Shell uses federation plugin dev server to resolve remote entries on localhost ports.
* Provide a **`dev.matrix.json`** to describe which remotes to run for a scenario.

### 25.13 Example: Federation Config (Vite)

```ts
// apps/mf-spectrogram/vite.config.ts
import federation from '@originjs/vite-plugin-federation'
export default defineConfig({
  plugins: [
    federation({
      name: 'mf_spectrogram',
      filename: 'remoteEntry.js',
      exposes: { './routes': './src/routes.tsx' },
      shared: {
        react: { singleton: true, requiredVersion: '^18' },
        'react-dom': { singleton: true, requiredVersion: '^18' },
        '@tanstack/react-query': { singleton: true },
      },
    }),
  ],
})
```

```ts
// apps/shell/vite.config.ts
import federation from '@originjs/vite-plugin-federation'
export default defineConfig({
  plugins: [
    federation({
      remotes: {
        mf_spectrogram: 'http://localhost:5175/assets/remoteEntry.js',
      },
      shared: { react: { singleton: true }, 'react-dom': { singleton: true } },
    }),
  ],
})
```

### 25.14 Testing Strategy Addendum for MFEs

* **Contract tests**: Validate exposed modules and route manifests against `@org/contracts`.
* **E2E matrix**: Shell + one remote, then shell + all remotes (happy path), plus failure cases (remote unreachable → fallback UI).
* **Perf budgets** per remote and for the composed shell (TTI, hydration, first interaction).

---

## 26) Checklist for Adding a New Remote

* [ ] Define domain & boundaries (owns routes, state, WASM?)
* [ ] Add federation config (exposes + shared deps)
* [ ] Wire route manifest in shell
* [ ] Publish/update `@org/contracts` types
* [ ] Add contract tests + Storybook stories
* [ ] Set up CI with visual tests & contract checks
* [ ] Document headers/COOP/COEP needs

---

By sticking to this playbook—now MFE-ready—we’ll move fast without breaking trust in each other’s work. If something here fights you, propose an RFC—let’s improve it together.
