# 🎮 WORLD-CLASS GAME ENGINE FOUNDATION
## Enterprise-Grade Real-Time Simulation Platform

**Version:** 1.0  
**Status:** Foundation Lock  
**Date:** 2025-01-27  
**Doctrine:** The Forge Doctrine

---

## THE DECISION

You are not "making a game."
You are building a **real-time simulation platform** that ships a game as its first product.

This single choice eliminates 90% of bad architecture decisions.

---

## 🔒 LOCKED LIBRARIES (NO DEBATE)

### Core / Platform
- **C++20 / C++23** - Absolute control over memory, threading, cache, SIMD
- **CMake** - Monorepo, superbuild
- **Tracy** - Real-time profiler (non-negotiable)
- **spdlog** - Logging (compiled out in release)
- **fmt** - Formatting (no iostreams)

### Math & Data
- **glm** - Math (compile-time config, no slow paths)
- **EnTT** - ECS as starting point (will replace critical paths with custom SoA)
- **xxHash** - Fast hashing (assets, cache keys)

### Rendering
- **Vulkan 1.3** - Explicit control, no driver magic
- **volk** - Vulkan loader
- **Vulkan Memory Allocator (VMA)** - GPU memory management
- **shaderc + DXC** - HLSL → SPIR-V
- **SPIRV-Reflect** - Pipeline reflection
- **ImGui** - Dev UI only (debug builds)

### Physics
- **Jolt Physics** - Deterministic, modern, multithreaded
- Custom collision filters & determinism guards

### Concurrency
- **Custom job system** - No TBB, no std::async, no OpenMP
- Atomics + fibers only

### Assets / Tools (Rust)
- **Rust stable**
- **Serde** - Serialization
- **bincode** - Binary format
- **zstd** - Compression
- **tokio** - Tools only
- **winit** - Editor windowing

### Explicitly Banned
- Unity / Unreal
- Lua / Python scripting in runtime
- JSON in runtime
- Exceptions
- RTTI
- Virtual per-entity updates

---

## 🎯 VULKAN RENDER GRAPH (EXPLICIT & DETERMINISTIC)

### Design Goal
- Zero driver guessing
- Explicit sync
- GPU-driven
- Frame graph owns everything

### Core Structure

```cpp
struct RenderPassNode {
    PassID id;
    VkPipeline pipeline;
    std::vector<ResourceHandle> inputs;
    std::vector<ResourceHandle> outputs;
    ExecuteFn execute;
};
```

All resources are:
- Typed
- Versioned
- Lifetime-tracked
- Transitioned explicitly

### Frame Breakdown (One Frame = One Graph)

1. **Depth Pre-Pass** - Early Z, GPU culling input
2. **GBuffer Pass** - Albedo, Normal, Material, Velocity, Depth
3. **Shadow Pass** - Directional cascades, spot/point shadow atlas
4. **Lighting Pass** - Clustered/Forward+ compute shader
5. **Transparency Pass** - Sorted GPU lists, no overdraw hacks
6. **Post-Processing** - TAA, HDR tone map, Bloom, Sharpen
7. **UI Pass** - ImGui (dev only), zero impact on shipping builds

### Synchronization Model
- Timeline semaphores
- No implicit barriers
- Per-pass access masks
- One submit per frame (ideal)

---

## 🧵 JOB SYSTEM (FIBER-BASED, REAL)

### Core Principles
- Fixed worker pool
- Work-stealing queues
- Fiber-based task switching
- No blocking threads
- Frame-bounded execution

### Architecture

**Worker Threads:**
```cpp
constexpr int WORKERS = std::thread::hardware_concurrency() - 1;
```
Main thread = orchestrator only.

**Task Definition:**
```cpp
struct Job {
    void (*fn)(void*);
    void* data;
    JobCounter* counter;
};
```

**Job Counter:**
```cpp
struct JobCounter {
    std::atomic<uint32_t> count;
};
```

**Fiber System:**
- Each worker has: Job queue, Fiber pool
- If a job waits → yield fiber
- Another job runs immediately
- This is how AAA engines avoid stalls

### Frame Execution Flow

```
Frame Begin
 ├─ Schedule Physics
 ├─ Schedule Animation
 ├─ Schedule AI
 ├─ Schedule Render Prep
 ├─ Wait on counters
 ├─ Submit GPU
Frame End
```

Nothing blocks unless you say so.

### Job Rules (ABSOLUTE)
- No heap alloc in jobs
- No locks in hot paths
- No job spawns another job blindly
- Jobs must be deterministic
- Frame ends only when counters hit zero

---

## 📊 GRAPHICS QUALITY TARGETS

- HDR pipeline (linear space end-to-end)
- Physically-based lighting
- Clustered or bindless rendering
- GPU culling
- Temporal AA done right
- Stable frame pacing

Not "pretty." **Correct.**

---

## ⚡ PERFORMANCE RULES (NON-NEGOTIABLE)

- No allocation in hot paths
- No virtual calls per entity per frame
- No exceptions
- No RTTI
- No dynamic dispatch where static will do
- Every frame measurable
- Every system profiled

If you can't explain where the time goes, you don't ship.

---

## 🏗️ REPO STRUCTURE

```
/engine
  /core
  /render
  /physics
  /ecs
  /jobs
  /platform

/tools (Rust)
  /asset_pipeline
  /editor
  /validators

/game
  /content
  /systems
  /rules

/build
/docs
/tests
```

No spaghetti. No shortcuts.

---

## 🎯 MILESTONES (IN ORDER)

### Milestone 1: The Frame
- Window
- Vulkan device
- Swapchain
- Render loop
- Job system online
- Stable frame pacing

**If this isn't perfect, nothing else matters.**

### Milestone 2: The World
- ECS
- Transform system
- Camera
- Basic renderable mesh
- Deterministic update

### Milestone 3: The Toolchain
- Asset import
- Bake
- Load
- Validate

**Only then do you build gameplay.**

---

## 🔒 WHY THIS FOUNDATION WILL NOT FAIL

Because:
- Vulkan gives you truth
- ECS gives you structure
- Jobs give you scale
- Tools are offline
- Assets are data
- Rendering is explicit
- Performance is measurable

This is not trendy.
**This is correct.**

---

## 📋 NEXT EXECUTION PHASE

Choose one and execute line-by-line:

1. **Vulkan device + swapchain bootstrap** (code-level)
2. **Job system implementation** (real code, not diagrams)
3. **Render graph scheduler & barrier resolution**

**Status:** 🔒 FOUNDATION LOCKED  
**Ready for:** Execution phase
