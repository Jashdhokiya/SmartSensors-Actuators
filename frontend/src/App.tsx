import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ShipmentHeader } from './components/layout/ShipmentHeader';
import { DemoControlPanel } from './components/demo/DemoControlPanel';
import { Overview }  from './pages/Overview';
import { Analytics } from './pages/Analytics';
import { Events }    from './pages/Events';
import { Alerts }    from './pages/Alerts';
import { Reports }   from './pages/Reports';
import { Admin }     from './pages/Admin';
import { startSimulation, stopSimulation } from './demo/SimulationEngine';
import { useLiveBackendSync } from './hooks/useLiveBackendSync';

function MainApp() {
  // Synchronize live data from Cloud Node.js REST API & MQTT stream
  useLiveBackendSync();

  useEffect(() => {
    startSimulation();
    return () => stopSimulation();
  }, []);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A]">
      <ShipmentHeader />

      <main className="pb-16">
        <Routes>
          <Route path="/"          element={<Overview />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/events"    element={<Events />} />
          <Route path="/alerts"    element={<Alerts />} />
          <Route path="/reports"   element={<Reports />} />
          <Route path="/admin"     element={<Admin />} />
        </Routes>
      </main>

      {/* Floating demo simulation panel */}
      <DemoControlPanel />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <MainApp />
    </BrowserRouter>
  );
}

export default App;
