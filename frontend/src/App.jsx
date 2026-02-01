import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './components/Dashboard/Dashboard';
import { useWebSocket } from './services/websocket';

function App() {
  const { connect, disconnect } = useWebSocket();

  useEffect(() => {
    connect();
    return () => disconnect();
  }, []);

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-xl">Ξ</span>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    ETH Trading Platform
                  </h1>
                  <p className="text-sm text-gray-500">
                    AI-Powered Trading Analysis & Suggestions
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <p className="text-xs text-gray-500">Market Status</p>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium text-gray-900">Live</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
          </Routes>
        </main>

        <footer className="bg-white border-t border-gray-200 mt-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <p className="text-center text-sm text-gray-500">
              ⚠️ Suggestions only - NOT auto-trading. Trade at your own risk.
            </p>
          </div>
        </footer>
      </div>
    </Router>
  );
}

export default App;
