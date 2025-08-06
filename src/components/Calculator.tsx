import React, { useState, useEffect } from "react";

// WASM module interface
interface WasmModule {
  calculate: (expression: string) => number;
}

const Calculator = () => {
  const [expression, setExpression] = useState("");
  const [result, setResult] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [wasmModule, setWasmModule] = useState<WasmModule | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadWasm = async () => {
      try {
        // Import the WASM module
        const module = await import(
          "../../wasm-calculator/pkg/wasm_calculator.js"
        );
        await module.default(); // Initialize the module
        setWasmModule(module);
        setIsLoading(false);
      } catch (err) {
        console.error("Failed to load WASM module:", err);
        setError("Failed to load calculator module");
        setIsLoading(false);
      }
    };

    loadWasm();
  }, []);

  const handleCalculate = () => {
    if (!wasmModule) {
      setError("Calculator module not loaded");
      return;
    }

    if (!expression.trim()) {
      setError("Please enter an expression");
      return;
    }

    try {
      setError("");
      const calculationResult = wasmModule.calculate(expression.trim());
      setResult(calculationResult.toString());
    } catch (err) {
      console.error("Calculation error:", err);
      setError(err instanceof Error ? err.message : "Calculation failed");
      setResult("");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleCalculate();
    }
  };

  const insertValue = (value: string) => {
    setExpression((prev) => prev + value);
  };

  const clearExpression = () => {
    setExpression("");
    setResult("");
    setError("");
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-8">
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">
          Rust Calculator (WASM)
        </h2>
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-gray-600">Loading calculator...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-8">
      <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">
        Rust Calculator (WASM)
      </h2>

      <div className="space-y-6">
        {/* Expression Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Mathematical Expression
          </label>
          <input
            type="text"
            value={expression}
            onChange={(e) => setExpression(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Enter expression (e.g., 2+2, 3*4, (5+7)/2)"
            className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-lg"
          />
        </div>

        {/* Calculator Buttons */}
        <div className="grid grid-cols-4 gap-2">
          {["7", "8", "9", "/"].map((btn) => (
            <button
              key={btn}
              onClick={() => insertValue(btn)}
              className="px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-md font-semibold text-lg transition-colors"
            >
              {btn}
            </button>
          ))}
          {["4", "5", "6", "*"].map((btn) => (
            <button
              key={btn}
              onClick={() => insertValue(btn)}
              className="px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-md font-semibold text-lg transition-colors"
            >
              {btn}
            </button>
          ))}
          {["1", "2", "3", "-"].map((btn) => (
            <button
              key={btn}
              onClick={() => insertValue(btn)}
              className="px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-md font-semibold text-lg transition-colors"
            >
              {btn}
            </button>
          ))}
          {["0", ".", "(", "+"].map((btn) => (
            <button
              key={btn}
              onClick={() => insertValue(btn)}
              className="px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-md font-semibold text-lg transition-colors"
            >
              {btn}
            </button>
          ))}
          <button
            onClick={() => insertValue(")")}
            className="px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-md font-semibold text-lg transition-colors"
          >
            )
          </button>
          <button
            onClick={clearExpression}
            className="px-4 py-3 bg-red-100 hover:bg-red-200 text-red-700 rounded-md font-semibold text-lg transition-colors"
          >
            Clear
          </button>
          <button
            onClick={handleCalculate}
            className="col-span-2 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-md font-semibold text-lg transition-colors"
          >
            Calculate (Rust)
          </button>
        </div>

        {/* Result Display */}
        {result && (
          <div className="bg-green-50 border border-green-200 rounded-md p-4">
            <h3 className="text-sm font-medium text-green-800 mb-1">Result:</h3>
            <p className="text-2xl font-mono font-bold text-green-900">
              {result}
            </p>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <h3 className="text-sm font-medium text-red-800 mb-1">Error:</h3>
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <h3 className="text-sm font-medium text-blue-800 mb-1">
            How it works:
          </h3>
          <p className="text-blue-700 text-sm">
            This calculator is powered by Rust compiled to WebAssembly (WASM).
            The mathematical expression parsing and evaluation happens entirely
            in Rust code running in your browser through WASM.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Calculator;
