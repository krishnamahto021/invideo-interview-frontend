import { useState, useRef, useEffect } from "react";

interface ShaderResponse {
  success: boolean;
  shaderCode?: string;
  error?: string;
}

const ShaderGenerator = () => {
  const [description, setDescription] = useState("");
  const [shaderCode, setShaderCode] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const vertexCountRef = useRef<number>(36); // Default cube vertex count

  const generateShader = async () => {
    if (!description.trim()) {
      setError("Please enter a description");
      return;
    }

    setIsLoading(true);
    setError("");
    setShaderCode("");

    try {
      const response = await fetch(
        // "http://localhost:4000/api/generate-shader",
        " https://romantic-endurance-production-8eb0.up.railway.app/api/generate-shader",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ description: description.trim() }),
        }
      );

      const data: ShaderResponse = await response.json();

      if (data.success && data.shaderCode) {
        setShaderCode(data.shaderCode);
        // Try to render the shader, but handle compilation errors gracefully
        try {
          renderShader(data.shaderCode);
        } catch (renderError) {
          // If shader compilation fails, show the error but keep the code visible
          setError(
            `Shader compilation failed: ${
              renderError instanceof Error
                ? renderError.message
                : "Unknown error"
            }. The raw shader code is displayed below.`
          );
        }
      } else {
        setError(data.error || "Failed to generate shader");
      }
    } catch (err) {
      console.error("Shader generation error:", err);
      setError(
        "Failed to connect to backend. Make sure the Elixir server is running on port 4000."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const renderShader = (shaderCodeText: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl");
    if (!gl) {
      setError("WebGL not supported in this browser");
      return;
    }

    glRef.current = gl;

    try {
      // Parse shader code
      const vertexShaderCode = extractVertexShader(shaderCodeText);
      let fragmentShaderCode = extractFragmentShader(shaderCodeText);
      const geometryType = extractGeometryType(shaderCodeText);

      // Fix common shader issues
      const originalFragmentCode = fragmentShaderCode;
      fragmentShaderCode = fixShaderIssues(fragmentShaderCode);

      // Log if fixes were applied
      if (originalFragmentCode !== fragmentShaderCode) {
        console.log("Applied automatic shader fixes");
        console.log("Original fragment shader:", originalFragmentCode);
        console.log("Fixed fragment shader:", fragmentShaderCode);
      }

      // Create and compile shaders
      const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderCode);
      const fragmentShader = createShader(
        gl,
        gl.FRAGMENT_SHADER,
        fragmentShaderCode
      );

      if (!vertexShader || !fragmentShader) {
        throw new Error("Failed to compile shaders");
      }

      // Create program
      const program = createProgram(gl, vertexShader, fragmentShader);
      if (!program) {
        throw new Error("Failed to create shader program");
      }

      programRef.current = program;

      // Setup geometry based on the type
      setupGeometry(gl, program, geometryType);

      // Start animation loop
      startTimeRef.current = Date.now();
      animate();
    } catch (err) {
      console.error("Shader rendering error:", err);
      // Re-throw the error so it can be caught by the caller
      throw err;
    }
  };

  const extractVertexShader = (code: string): string => {
    const vertexStart = code.indexOf("// Vertex Shader");
    const fragmentStart = code.indexOf("// Fragment Shader");
    if (vertexStart === -1 || fragmentStart === -1) {
      throw new Error("Could not find vertex or fragment shader markers");
    }
    return code
      .substring(vertexStart, fragmentStart)
      .replace("// Vertex Shader", "")
      .trim();
  };

  const extractFragmentShader = (code: string): string => {
    const fragmentStart = code.indexOf("// Fragment Shader");
    if (fragmentStart === -1) {
      throw new Error("Could not find fragment shader marker");
    }
    return code
      .substring(fragmentStart)
      .replace("// Fragment Shader", "")
      .trim();
  };

  const extractGeometryType = (code: string): string => {
    const geometryMatch = code.match(/\/\/ GEOMETRY:\s*(\w+)/);
    return geometryMatch ? geometryMatch[1] : "cube";
  };

  const fixShaderIssues = (fragmentShaderCode: string): string => {
    let fixedCode = fragmentShaderCode.trim();

    // Always ensure precision is at the very beginning
    if (!fixedCode.includes("precision")) {
      fixedCode = "precision mediump float;\n" + fixedCode;
    } else {
      // If precision exists but not at the beginning, move it there
      const precisionMatch = fixedCode.match(/precision\s+\w+\s+float\s*;/);
      if (precisionMatch) {
        const precisionStatement = precisionMatch[0];
        fixedCode = fixedCode.replace(precisionStatement, "");
        fixedCode = precisionStatement + "\n" + fixedCode.trim();
      }
    }

    // Check for common uniform usage and add declarations if missing
    const needsTimeUniform =
      fixedCode.includes("time") && !fixedCode.includes("uniform float time");
    const needsResolutionUniform =
      fixedCode.includes("resolution") &&
      !fixedCode.includes("uniform vec2 resolution");

    let uniformDeclarations = "";
    if (needsTimeUniform) {
      uniformDeclarations += "uniform float time;\n";
    }
    if (needsResolutionUniform) {
      uniformDeclarations += "uniform vec2 resolution;\n";
    }

    // Add varying declarations if they're missing but being used
    const needsVNormalVarying =
      fixedCode.includes("vNormal") &&
      !fixedCode.includes("varying vec3 vNormal");
    const needsVPositionVarying =
      fixedCode.includes("vPosition") &&
      !fixedCode.includes("varying vec3 vPosition");

    if (needsVNormalVarying) {
      uniformDeclarations += "varying vec3 vNormal;\n";
    }
    if (needsVPositionVarying) {
      uniformDeclarations += "varying vec3 vPosition;\n";
    }

    // Insert uniform/varying declarations after precision
    if (uniformDeclarations) {
      const lines = fixedCode.split("\n");
      const precisionLineIndex = lines.findIndex((line) =>
        line.includes("precision")
      );

      if (precisionLineIndex !== -1) {
        // Insert after precision line
        lines.splice(precisionLineIndex + 1, 0, uniformDeclarations.trim());
        fixedCode = lines.join("\n");
      } else {
        // This shouldn't happen since we ensure precision exists, but just in case
        fixedCode = uniformDeclarations + fixedCode;
      }
    }

    return fixedCode;
  };

  const createShader = (
    gl: WebGLRenderingContext,
    type: number,
    source: string
  ): WebGLShader | null => {
    const shader = gl.createShader(type);
    if (!shader) return null;

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const error = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Shader compilation error: ${error}`);
    }

    return shader;
  };

  const createProgram = (
    gl: WebGLRenderingContext,
    vertexShader: WebGLShader,
    fragmentShader: WebGLShader
  ): WebGLProgram | null => {
    const program = gl.createProgram();
    if (!program) return null;

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const error = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(`Program linking error: ${error}`);
    }

    return program;
  };

  const setupGeometry = (
    gl: WebGLRenderingContext,
    program: WebGLProgram,
    geometryType: string
  ) => {
    const vertices = getGeometryVertices(geometryType);
    const normals = getGeometryNormals(geometryType);

    // Store vertex count for drawing
    vertexCountRef.current = vertices.length / 3;

    // Create buffers
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

    const normalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

    // Get attribute locations
    const positionLocation = gl.getAttribLocation(program, "position");
    const normalLocation = gl.getAttribLocation(program, "normal");

    // Setup position attribute
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);

    // Setup normal attribute
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.enableVertexAttribArray(normalLocation);
    gl.vertexAttribPointer(normalLocation, 3, gl.FLOAT, false, 0, 0);
  };

  const getGeometryVertices = (type: string): number[] => {
    switch (type.toLowerCase()) {
      case "cube":
        return [
          // Front face
          -1, -1, 1, 1, -1, 1, 1, 1, 1, -1, -1, 1, 1, 1, 1, -1, 1, 1,
          // Back face
          -1, -1, -1, -1, 1, -1, 1, 1, -1, -1, -1, -1, 1, 1, -1, 1, -1, -1,
          // Top face
          -1, 1, -1, -1, 1, 1, 1, 1, 1, -1, 1, -1, 1, 1, 1, 1, 1, -1,
          // Bottom face
          -1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, -1, 1, -1, 1, -1, -1, 1,
          // Right face
          1, -1, -1, 1, 1, -1, 1, 1, 1, 1, -1, -1, 1, 1, 1, 1, -1, 1,
          // Left face
          -1, -1, -1, -1, -1, 1, -1, 1, 1, -1, -1, -1, -1, 1, 1, -1, 1, -1,
        ];
      case "sphere":
        return generateSphere(1, 20, 20);
      case "plane":
        return [-2, 0, -2, 2, 0, -2, 2, 0, 2, -2, 0, -2, 2, 0, 2, -2, 0, 2];
      case "cylinder":
        return generateCylinder(1, 2, 16);
      case "torus":
        return generateTorus(0.6, 0.3, 16, 16);
      default:
        // Default to cube if geometry type not recognized
        return [
          -1, -1, 1, 1, -1, 1, 1, 1, 1, -1, -1, 1, 1, 1, 1, -1, 1, 1, -1, -1,
          -1, -1, 1, -1, 1, 1, -1, -1, -1, -1, 1, 1, -1, 1, -1, -1, -1, 1, -1,
          -1, 1, 1, 1, 1, 1, -1, 1, -1, 1, 1, 1, 1, 1, -1, -1, -1, -1, 1, -1,
          -1, 1, -1, 1, -1, -1, -1, 1, -1, 1, -1, -1, 1, 1, -1, -1, 1, 1, -1, 1,
          1, 1, 1, -1, -1, 1, 1, 1, 1, -1, 1, -1, -1, -1, -1, -1, 1, -1, 1, 1,
          -1, -1, -1, -1, 1, 1, -1, 1, -1,
        ];
    }
  };

  const getGeometryNormals = (type: string): number[] => {
    switch (type.toLowerCase()) {
      case "cube":
        return [
          // Front face
          0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
          // Back face
          0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
          // Top face
          0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
          // Bottom face
          0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
          // Right face
          1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,
          // Left face
          -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
        ];
      case "sphere":
        return generateSphereNormals(1, 20, 20);
      case "plane":
        return [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0];
      case "cylinder":
        return generateCylinderNormals(1, 2, 16);
      case "torus":
        return generateTorusNormals(0.6, 0.3, 16, 16);
      default:
        // Default cube normals
        return [
          0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0,
          -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 1, 0, 0, 1, 0, 0, 1, 0,
          0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
          -1, 0, 0, -1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,
          -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
        ];
    }
  };

  // Geometry generation functions
  const generateSphere = (
    radius: number,
    widthSegments: number,
    heightSegments: number
  ): number[] => {
    const vertices: number[] = [];

    for (let i = 0; i <= heightSegments; i++) {
      const v = i / heightSegments;
      const phi = v * Math.PI;

      for (let j = 0; j <= widthSegments; j++) {
        const u = j / widthSegments;
        const theta = u * Math.PI * 2;

        const x = -radius * Math.cos(theta) * Math.sin(phi);
        const y = radius * Math.cos(phi);
        const z = radius * Math.sin(theta) * Math.sin(phi);

        vertices.push(x, y, z);
      }
    }

    const triangles: number[] = [];
    for (let i = 0; i < heightSegments; i++) {
      for (let j = 0; j < widthSegments; j++) {
        const a = i * (widthSegments + 1) + j;
        const b = a + widthSegments + 1;
        const c = a + 1;
        const d = b + 1;

        if (i !== 0) {
          triangles.push(
            vertices[a * 3],
            vertices[a * 3 + 1],
            vertices[a * 3 + 2]
          );
          triangles.push(
            vertices[b * 3],
            vertices[b * 3 + 1],
            vertices[b * 3 + 2]
          );
          triangles.push(
            vertices[c * 3],
            vertices[c * 3 + 1],
            vertices[c * 3 + 2]
          );
        }
        if (i !== heightSegments - 1) {
          triangles.push(
            vertices[b * 3],
            vertices[b * 3 + 1],
            vertices[b * 3 + 2]
          );
          triangles.push(
            vertices[d * 3],
            vertices[d * 3 + 1],
            vertices[d * 3 + 2]
          );
          triangles.push(
            vertices[c * 3],
            vertices[c * 3 + 1],
            vertices[c * 3 + 2]
          );
        }
      }
    }

    return triangles;
  };

  const generateSphereNormals = (
    radius: number,
    widthSegments: number,
    heightSegments: number
  ): number[] => {
    const normals: number[] = [];

    for (let i = 0; i <= heightSegments; i++) {
      const v = i / heightSegments;
      const phi = v * Math.PI;

      for (let j = 0; j <= widthSegments; j++) {
        const u = j / widthSegments;
        const theta = u * Math.PI * 2;

        const x = -Math.cos(theta) * Math.sin(phi);
        const y = Math.cos(phi);
        const z = Math.sin(theta) * Math.sin(phi);

        normals.push(x, y, z);
      }
    }

    const triangleNormals: number[] = [];
    for (let i = 0; i < heightSegments; i++) {
      for (let j = 0; j < widthSegments; j++) {
        const a = i * (widthSegments + 1) + j;
        const b = a + widthSegments + 1;
        const c = a + 1;
        const d = b + 1;

        if (i !== 0) {
          triangleNormals.push(
            normals[a * 3],
            normals[a * 3 + 1],
            normals[a * 3 + 2]
          );
          triangleNormals.push(
            normals[b * 3],
            normals[b * 3 + 1],
            normals[b * 3 + 2]
          );
          triangleNormals.push(
            normals[c * 3],
            normals[c * 3 + 1],
            normals[c * 3 + 2]
          );
        }
        if (i !== heightSegments - 1) {
          triangleNormals.push(
            normals[b * 3],
            normals[b * 3 + 1],
            normals[b * 3 + 2]
          );
          triangleNormals.push(
            normals[d * 3],
            normals[d * 3 + 1],
            normals[d * 3 + 2]
          );
          triangleNormals.push(
            normals[c * 3],
            normals[c * 3 + 1],
            normals[c * 3 + 2]
          );
        }
      }
    }

    return triangleNormals;
  };

  const generateCylinder = (
    radius: number,
    height: number,
    segments: number
  ): number[] => {
    const vertices: number[] = [];
    const halfHeight = height / 2;

    // Generate vertices for top and bottom circles
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      const x = radius * Math.cos(theta);
      const z = radius * Math.sin(theta);

      // Bottom circle
      vertices.push(x, -halfHeight, z);
      // Top circle
      vertices.push(x, halfHeight, z);
    }

    // Generate triangles for the cylinder sides
    const triangles: number[] = [];
    for (let i = 0; i < segments; i++) {
      const a = i * 2;
      const b = a + 1;
      const c = ((i + 1) % segments) * 2;
      const d = c + 1;

      // Two triangles per quad
      triangles.push(vertices[a * 3], vertices[a * 3 + 1], vertices[a * 3 + 2]);
      triangles.push(vertices[c * 3], vertices[c * 3 + 1], vertices[c * 3 + 2]);
      triangles.push(vertices[b * 3], vertices[b * 3 + 1], vertices[b * 3 + 2]);

      triangles.push(vertices[b * 3], vertices[b * 3 + 1], vertices[b * 3 + 2]);
      triangles.push(vertices[c * 3], vertices[c * 3 + 1], vertices[c * 3 + 2]);
      triangles.push(vertices[d * 3], vertices[d * 3 + 1], vertices[d * 3 + 2]);
    }

    return triangles;
  };

  const generateCylinderNormals = (
    radius: number,
    height: number,
    segments: number
  ): number[] => {
    const normals: number[] = [];

    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      const x = Math.cos(theta);
      const z = Math.sin(theta);

      // Bottom and top circles have same normal direction
      normals.push(x, 0, z);
      normals.push(x, 0, z);
    }

    const triangleNormals: number[] = [];
    for (let i = 0; i < segments; i++) {
      const a = i * 2;
      const b = a + 1;
      const c = ((i + 1) % segments) * 2;
      const d = c + 1;

      triangleNormals.push(
        normals[a * 3],
        normals[a * 3 + 1],
        normals[a * 3 + 2]
      );
      triangleNormals.push(
        normals[c * 3],
        normals[c * 3 + 1],
        normals[c * 3 + 2]
      );
      triangleNormals.push(
        normals[b * 3],
        normals[b * 3 + 1],
        normals[b * 3 + 2]
      );

      triangleNormals.push(
        normals[b * 3],
        normals[b * 3 + 1],
        normals[b * 3 + 2]
      );
      triangleNormals.push(
        normals[c * 3],
        normals[c * 3 + 1],
        normals[c * 3 + 2]
      );
      triangleNormals.push(
        normals[d * 3],
        normals[d * 3 + 1],
        normals[d * 3 + 2]
      );
    }

    return triangleNormals;
  };

  const generateTorus = (
    majorRadius: number,
    minorRadius: number,
    majorSegments: number,
    minorSegments: number
  ): number[] => {
    const vertices: number[] = [];

    for (let i = 0; i <= majorSegments; i++) {
      const u = (i / majorSegments) * Math.PI * 2;

      for (let j = 0; j <= minorSegments; j++) {
        const v = (j / minorSegments) * Math.PI * 2;

        const x = (majorRadius + minorRadius * Math.cos(v)) * Math.cos(u);
        const y = minorRadius * Math.sin(v);
        const z = (majorRadius + minorRadius * Math.cos(v)) * Math.sin(u);

        vertices.push(x, y, z);
      }
    }

    const triangles: number[] = [];
    for (let i = 0; i < majorSegments; i++) {
      for (let j = 0; j < minorSegments; j++) {
        const a = i * (minorSegments + 1) + j;
        const b = a + minorSegments + 1;
        const c = a + 1;
        const d = b + 1;

        triangles.push(
          vertices[a * 3],
          vertices[a * 3 + 1],
          vertices[a * 3 + 2]
        );
        triangles.push(
          vertices[b * 3],
          vertices[b * 3 + 1],
          vertices[b * 3 + 2]
        );
        triangles.push(
          vertices[c * 3],
          vertices[c * 3 + 1],
          vertices[c * 3 + 2]
        );

        triangles.push(
          vertices[b * 3],
          vertices[b * 3 + 1],
          vertices[b * 3 + 2]
        );
        triangles.push(
          vertices[d * 3],
          vertices[d * 3 + 1],
          vertices[d * 3 + 2]
        );
        triangles.push(
          vertices[c * 3],
          vertices[c * 3 + 1],
          vertices[c * 3 + 2]
        );
      }
    }

    return triangles;
  };

  const generateTorusNormals = (
    majorRadius: number,
    minorRadius: number,
    majorSegments: number,
    minorSegments: number
  ): number[] => {
    const normals: number[] = [];

    for (let i = 0; i <= majorSegments; i++) {
      const u = (i / majorSegments) * Math.PI * 2;

      for (let j = 0; j <= minorSegments; j++) {
        const v = (j / minorSegments) * Math.PI * 2;

        const centerX = majorRadius * Math.cos(u);
        const centerZ = majorRadius * Math.sin(u);

        const x = (majorRadius + minorRadius * Math.cos(v)) * Math.cos(u);
        const y = minorRadius * Math.sin(v);
        const z = (majorRadius + minorRadius * Math.cos(v)) * Math.sin(u);

        const nx = (x - centerX) / minorRadius;
        const ny = y / minorRadius;
        const nz = (z - centerZ) / minorRadius;

        normals.push(nx, ny, nz);
      }
    }

    const triangleNormals: number[] = [];
    for (let i = 0; i < majorSegments; i++) {
      for (let j = 0; j < minorSegments; j++) {
        const a = i * (minorSegments + 1) + j;
        const b = a + minorSegments + 1;
        const c = a + 1;
        const d = b + 1;

        triangleNormals.push(
          normals[a * 3],
          normals[a * 3 + 1],
          normals[a * 3 + 2]
        );
        triangleNormals.push(
          normals[b * 3],
          normals[b * 3 + 1],
          normals[b * 3 + 2]
        );
        triangleNormals.push(
          normals[c * 3],
          normals[c * 3 + 1],
          normals[c * 3 + 2]
        );

        triangleNormals.push(
          normals[b * 3],
          normals[b * 3 + 1],
          normals[b * 3 + 2]
        );
        triangleNormals.push(
          normals[d * 3],
          normals[d * 3 + 1],
          normals[d * 3 + 2]
        );
        triangleNormals.push(
          normals[c * 3],
          normals[c * 3 + 1],
          normals[c * 3 + 2]
        );
      }
    }

    return triangleNormals;
  };

  const animate = () => {
    const gl = glRef.current;
    const program = programRef.current;
    if (!gl || !program) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set viewport
    gl.viewport(0, 0, canvas.width, canvas.height);

    // Clear canvas
    gl.clearColor(0.1, 0.1, 0.2, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);

    gl.useProgram(program);

    // Set uniforms
    const time = (Date.now() - startTimeRef.current) / 1000.0;
    const timeLocation = gl.getUniformLocation(program, "time");
    if (timeLocation) {
      gl.uniform1f(timeLocation, time);
    }

    // Set resolution uniform if it exists
    const resolutionLocation = gl.getUniformLocation(program, "resolution");
    if (resolutionLocation) {
      gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
    }

    // Set matrices
    const modelMatrix = createRotationMatrix(time);
    const viewMatrix = createViewMatrix();
    const projectionMatrix = createProjectionMatrix(
      canvas.width / canvas.height
    );

    const modelLocation = gl.getUniformLocation(program, "modelMatrix");
    const viewLocation = gl.getUniformLocation(program, "viewMatrix");
    const projectionLocation = gl.getUniformLocation(
      program,
      "projectionMatrix"
    );

    if (modelLocation) gl.uniformMatrix4fv(modelLocation, false, modelMatrix);
    if (viewLocation) gl.uniformMatrix4fv(viewLocation, false, viewMatrix);
    if (projectionLocation)
      gl.uniformMatrix4fv(projectionLocation, false, projectionMatrix);

    // Draw using the correct vertex count
    gl.drawArrays(gl.TRIANGLES, 0, vertexCountRef.current);

    animationRef.current = requestAnimationFrame(animate);
  };

  const createRotationMatrix = (angle: number): Float32Array => {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return new Float32Array([c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0, 0, 0, 0, 1]);
  };

  const createViewMatrix = (): Float32Array => {
    return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -5, 1]);
  };

  const createProjectionMatrix = (aspect: number): Float32Array => {
    const fov = Math.PI / 4;
    const near = 0.1;
    const far = 100.0;
    const f = 1.0 / Math.tan(fov / 2);
    return new Float32Array([
      f / aspect,
      0,
      0,
      0,
      0,
      f,
      0,
      0,
      0,
      0,
      (far + near) / (near - far),
      -1,
      0,
      0,
      (2 * far * near) / (near - far),
      0,
    ]);
  };

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <div className="bg-white rounded-lg shadow-lg p-8">
      <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">
        Text-to-Shader Generator
      </h2>

      <div className="space-y-6">
        {/* Description Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Shader Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the shader you want (e.g., 'A glowing sphere with pulsing colors', 'A spinning torus with metallic surface', 'A dancing cylinder with rainbow waves')"
            rows={3}
            className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
          <div className="mt-2 text-sm text-gray-600">
            <strong>Try these examples:</strong>
            <div className="flex flex-wrap gap-2 mt-1">
              <button
                onClick={() =>
                  setDescription(
                    "A glowing sphere with rainbow colors that pulse with time"
                  )
                }
                className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs transition-colors"
              >
                Glowing Sphere
              </button>
              <button
                onClick={() =>
                  setDescription(
                    "A spinning torus with metallic gold surface and reflections"
                  )
                }
                className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs transition-colors"
              >
                Golden Torus
              </button>
              <button
                onClick={() =>
                  setDescription(
                    "A dancing cylinder with flowing water-like waves"
                  )
                }
                className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs transition-colors"
              >
                Water Cylinder
              </button>
            </div>
          </div>
        </div>

        {/* Generate Button */}
        <button
          onClick={generateShader}
          disabled={isLoading}
          className="w-full px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded-md font-semibold transition-colors flex items-center justify-center"
        >
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              Generating Shader...
            </>
          ) : (
            "Generate Shader (Elixir + LLM)"
          )}
        </button>

        {/* Canvas and Code Display */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* WebGL Canvas */}
          <div>
            <h3 className="text-lg font-semibold mb-3 text-gray-800">
              Rendered Shader
            </h3>
            <canvas
              ref={canvasRef}
              width={400}
              height={400}
              className="w-full border border-gray-300 rounded-md bg-gray-900"
            />
          </div>

          {/* Shader Code Display */}
          <div>
            <h3 className="text-lg font-semibold mb-3 text-gray-800">
              Generated Code
            </h3>
            <pre className="w-full h-96 p-4 bg-gray-900 text-green-400 rounded-md overflow-auto text-xs font-mono border border-gray-300">
              {shaderCode || "Generated shader code will appear here..."}
            </pre>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <h3 className="text-sm font-medium text-red-800 mb-1">
              {error.includes("compilation failed")
                ? "Shader Compilation Error:"
                : "Error:"}
            </h3>
            <p className="text-red-700">{error}</p>
            {error.includes("compilation failed") && (
              <p className="text-red-600 text-sm mt-2">
                💡 The LLM generated shader code that contains syntax errors.
                You can see the raw code on the right and try a different
                description.
              </p>
            )}
          </div>
        )}

        {/* Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <h3 className="text-sm font-medium text-blue-800 mb-1">
            How it works:
          </h3>
          <p className="text-blue-700 text-sm">
            This feature sends your description to an Elixir backend, which uses
            an LLM (OpenAI GPT) to generate WebGL shader code. The generated
            shaders are then compiled and rendered in real-time using WebGL.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ShaderGenerator;
