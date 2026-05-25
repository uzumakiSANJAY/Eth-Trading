import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import Dashboard from './components/Dashboard/Dashboard';
import { useWebSocket } from './services/websocket';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';

function AppShell() {
  const { connect, disconnect } = useWebSocket();
  const { isDark, toggleTheme } = useTheme();

  useEffect(() => {
    connect();
    return () => disconnect();
  }, []);

  return (
    <Router>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-200">
        <header className="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-xl">Ξ</span>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    ETH Trading Platform
                  </h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    AI-Powered Trading Analysis & Suggestions
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Market Status</p>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">Live</span>
                  </div>
                </div>
                <button
                  onClick={toggleTheme}
                  className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                  {isDark
                    ? <Sun className="w-5 h-5 text-yellow-400" />
                    : <Moon className="w-5 h-5 text-gray-600" />
                  }
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
          </Routes>
        </main>

        <footer className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 mt-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <p className="text-center text-sm text-gray-500 dark:text-gray-400">
              ⚠️ Suggestions only - NOT auto-trading. Trade at your own risk.
            </p>
          </div>
        </footer>
      </div>
    </Router>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  );
}

export default App;
