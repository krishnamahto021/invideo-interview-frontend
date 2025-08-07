# Two-Tab App: React/Rust Frontend + Elixir Backend

A demonstration application combining React, Rust/WASM, and Elixir technologies with two main features:

## Features

### Tab 1: Rust Calculator

- **Frontend**: React with Rust compiled to WebAssembly (WASM)
- **Functionality**: Mathematical expression evaluation
- **Technology**: Rust handles parsing and calculation, compiled to WASM for browser execution
- **Supported operations**: Basic arithmetic (+, -, \*, /), parentheses, decimal numbers

### Tab 2: Text-to-Shader Generator

- **Frontend**: React with WebGL canvas
- **Backend**: Elixir server communicating with OpenAI GPT
- **Functionality**: Generate WebGL shaders from text descriptions
- **Technology**: Elixir processes requests, LLM generates shader code, WebGL renders results

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   React Frontend │    │  Rust/WASM      │    │ Elixir Backend  │
│   (Vite + Tailwind) │    │  Calculator      │    │ (+ OpenAI API)  │
│                 │    │                  │    │                 │
│ • Tab Navigation │    │ • Math parsing   │    │ • Shader gen    │
│ • WebGL Canvas  │◄──►│ • Calculation    │    │ • LLM comm      │
│ • Shader display│    │ • WASM binding   │    │ • CORS handling │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Prerequisites

- **Node.js** (v20.19.0+ or v22.12.0+)
- **Rust** (latest stable)
- **Elixir** (with Mix)
- **wasm-pack** (for building Rust to WASM)

## Setup & Running

### 1. Install Dependencies

**Frontend:**

```bash
cd frontend
npm install
npm install -g wasm-pack  # if not already installed
```

**Backend:**

```bash
cd shader-backend
mix deps.get
```

### 2. Build Rust/WASM Module

```bash
cd frontend/wasm-calculator
wasm-pack build --target web --out-dir pkg
```

### 3. Start Servers

**Terminal 1 - Elixir Backend:**

```bash
cd shader-backend
mix run --no-halt
```

_Server runs on http://localhost:4000_

**Terminal 2 - React Frontend:**

```bash
cd frontend
npm run dev
```

_Frontend runs on http://localhost:5173_

## Usage

1. **Open http://localhost:5173** in your browser
2. **Rust Calculator Tab:**
   - Enter mathematical expressions (e.g., `2+2`, `(5+7)*3`, `15/3`)
   - Click buttons or type directly
   - Calculation happens in Rust/WASM
3. **Text-to-Shader Tab:**
   - Describe a shader (e.g., "A rotating cube with rainbow colors")
   - Click "Generate Shader"
   - View rendered result and generated code

## Technical Details

### Rust Calculator (WASM)

- **Parser**: Recursive descent parser for mathematical expressions
- **Compilation**: `wasm-pack` compiles Rust to WebAssembly
- **Integration**: Vite loads WASM module dynamically in React

### Shader Generator

- **Backend**: Elixir/Phoenix-like server with Plug router
- **LLM**: OpenAI GPT-3.5-turbo generates GLSL shader code
- **Rendering**: WebGL compiles and renders shaders with 3D geometry
- **Error Handling**: Graceful fallback to default shaders on failure

### API Endpoint

```
POST http://localhost:4000/api/generate-shader
Content-Type: application/json

{
  "description": "A rotating cube with gradient colors"
}
```

## Project Structure

```
invideo-interview/
├── frontend/                 # React + Vite + Tailwind
│   ├── src/
│   │   ├── components/
│   │   │   ├── Calculator.tsx      # Rust/WASM calculator
│   │   │   └── ShaderGenerator.tsx # WebGL shader renderer
│   │   └── App.tsx                 # Main app with tabs
│   ├── wasm-calculator/            # Rust source
│   │   ├── src/lib.rs             # Calculator logic
│   │   ├── Cargo.toml
│   │   └── pkg/                   # Generated WASM files
│   └── package.json
└── shader-backend/           # Elixir backend
    ├── lib/shader_backend/
    │   ├── application.ex    # App startup
    │   ├── router.ex         # HTTP routes
    │   └── shader_generator.ex # LLM integration
    └── mix.exs
```

## Development Notes

- **WASM Loading**: Dynamic import with async initialization
- **CORS**: Backend configured for frontend origin
- **Error Handling**: Both tabs handle failures gracefully
- **WebGL**: 3D matrix transformations with animation loop
- **Styling**: Tailwind CSS for responsive design

## Troubleshooting

1. **WASM build fails**: Ensure `wasm-pack` is installed and Rust is up to date
2. **Backend connection fails**: Verify Elixir server is running on port 4000
3. **Shader compilation errors**: Check browser console for WebGL errors
4. **LLM API issues**: Verify OpenAI API key in `shader_generator.ex`
