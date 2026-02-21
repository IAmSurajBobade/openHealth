import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { PatientDetail } from './pages/PatientDetail';
import { TestDetail } from './pages/TestDetail';
import { AddReading } from './pages/AddReading';
import { Settings } from './pages/Settings';
import { Settings as SettingsIcon } from 'lucide-react';

function App() {
  return (
    <BrowserRouter>
      <header className="border-b" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
        <div className="max-w-4xl mx-auto p-4 flex justify-between items-center">
          <Link to="/" className="text-xl font-bold flex items-center gap-2 text-blue-400 hover:text-blue-300">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
            openHealth
          </Link>
          <nav>
            <Link to="/settings" className="p-2 text-zinc-400 hover:text-white transition-colors" title="Settings & Sync">
              <SettingsIcon size={20} />
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/patient/:id" element={<PatientDetail />} />
          <Route path="/patient/:id/test/:testName" element={<TestDetail />} />
          <Route path="/patient/:id/add-reading" element={<AddReading />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}

export default App;
