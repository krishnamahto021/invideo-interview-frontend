import { useState } from "react";
import Calculator from "./components/Calculator";
import ShaderGenerator from "./components/ShaderGenerator";

const App = () => {
  const [activeTab, setActiveTab] = useState<"calculator" | "shader">(
    "calculator"
  );

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">
          Rust/React/Elixir Demo App
        </h1>

        {/* Tab Navigation */}
        <div className="flex justify-center mb-8">
          <div className="bg-white rounded-lg shadow-md p-1 flex">
            <button
              onClick={() => setActiveTab("calculator")}
              className={`px-6 py-3 rounded-md font-medium transition-all ${
                activeTab === "calculator"
                  ? "bg-blue-500 text-white shadow-md"
                  : "text-gray-600 hover:text-gray-800 hover:bg-gray-50"
              }`}
            >
              Rust Calculator
            </button>
            <button
              onClick={() => setActiveTab("shader")}
              className={`px-6 py-3 rounded-md font-medium transition-all ${
                activeTab === "shader"
                  ? "bg-blue-500 text-white shadow-md"
                  : "text-gray-600 hover:text-gray-800 hover:bg-gray-50"
              }`}
            >
              Text-to-Shader
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="max-w-4xl mx-auto">
          {activeTab === "calculator" && <Calculator />}
          {activeTab === "shader" && <ShaderGenerator />}
        </div>
      </div>
    </div>
  );
};

export default App;
