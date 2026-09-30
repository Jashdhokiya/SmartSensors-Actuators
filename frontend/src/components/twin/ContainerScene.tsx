import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import { useTelemetryStore } from '../../store/telemetryStore';
import { useUIStore } from '../../store/uiStore';
import { ViewModeSelector } from './ViewModeSelector';

// ---- Procedural Corrugated Side Panels ----
function CorrugatedWall({ position, rotation, length = 4.2, height = 1.8, isGhost = false, isWireframe = false }: {
  position: [number, number, number];
  rotation: [number, number, number];
  length?: number;
  height?: number;
  isGhost?: boolean;
  isWireframe?: boolean;
}) {
  const ribs = Math.floor(length / 0.18);
  const wallColor = '#1E3A8A'; // Industrial Deep Royal Blue
  const ribColor = '#1D4ED8';

  return (
    <group position={position} rotation={rotation}>
      {/* Flat backing sheet */}
      <mesh castShadow receiveShadow>
        <planeGeometry args={[length, height]} />
        <meshStandardMaterial
          color={wallColor}
          metalness={0.45}
          roughness={0.4}
          transparent={isGhost || isWireframe}
          opacity={isWireframe ? 0.15 : isGhost ? 0.18 : 1.0}
          wireframe={isWireframe}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* 3D Corrugated Flutes */}
      {!isWireframe && Array.from({ length: ribs }).map((_, i) => {
        const x = (i - ribs / 2 + 0.5) * 0.18;
        return (
          <mesh key={i} position={[x, 0, 0.025]} castShadow>
            <boxGeometry args={[0.08, height, 0.04]} />
            <meshStandardMaterial
              color={ribColor}
              metalness={0.5}
              roughness={0.35}
              transparent={isGhost}
              opacity={isGhost ? 0.15 : 1.0}
            />
          </mesh>
        );
      })}
    </group>
  );
}

// ---- High-Detail ISO Shipping Container Frame & Doors ----
function ContainerEnclosure({ doorOpen, viewMode }: { doorOpen: boolean; viewMode: 'exterior' | 'interior' | 'sensors' }) {
  const leftDoorRef = useRef<THREE.Group>(null);
  const rightDoorRef = useRef<THREE.Group>(null);

  const isGhost = viewMode === 'interior';
  const isWireframe = viewMode === 'sensors';

  const targetLeftDoorAngle = doorOpen ? -Math.PI / 1.7 : 0;
  const targetRightDoorAngle = doorOpen ? Math.PI / 1.7 : 0;

  useFrame((_, delta) => {
    if (leftDoorRef.current) {
      leftDoorRef.current.rotation.y = THREE.MathUtils.lerp(
        leftDoorRef.current.rotation.y,
        targetLeftDoorAngle,
        delta * 3.5
      );
    }
    if (rightDoorRef.current) {
      rightDoorRef.current.rotation.y = THREE.MathUtils.lerp(
        rightDoorRef.current.rotation.y,
        targetRightDoorAngle,
        delta * 3.5
      );
    }
  });

  const frameColor = '#0F172A'; // Midnight slate structural frame
  const cornerColor = '#334155';
  const doorColor = '#1E40AF';

  return (
    <group>
      {/* Front Corrugated Bulkhead (with Reefer Cooling Unit) */}
      <mesh position={[-2.1, 0, 0]} rotation={[0, Math.PI / 2, 0]} castShadow>
        <boxGeometry args={[2.0, 1.9, 0.06]} />
        <meshStandardMaterial
          color={frameColor}
          transparent={isGhost || isWireframe}
          opacity={isWireframe ? 0.2 : isGhost ? 0.2 : 1}
          wireframe={isWireframe}
        />
      </mesh>

      {/* Reefer Cooling Compressor Unit (Front) */}
      <group position={[-2.18, 0, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.16, 1.5, 1.6]} />
          <meshStandardMaterial color="#E2E8F0" metalness={0.7} roughness={0.3} />
        </mesh>
        {/* Fan grill circles */}
        {[-0.4, 0.4].map((y, i) => (
          <mesh key={i} position={[-0.09, y, 0]} rotation={[0, -Math.PI / 2, 0]}>
            <circleGeometry args={[0.25, 24]} />
            <meshStandardMaterial color="#0F172A" metalness={0.9} roughness={0.1} />
          </mesh>
        ))}
        {/* Status LED on cooling unit */}
        <mesh position={[-0.09, 0.6, 0.5]} rotation={[0, -Math.PI / 2, 0]}>
          <circleGeometry args={[0.04, 16]} />
          <meshBasicMaterial color="#10B981" />
        </mesh>
      </group>

      {/* Left Wall */}
      <CorrugatedWall position={[0, 0, 1.0]} rotation={[0, 0, 0]} isGhost={isGhost} isWireframe={isWireframe} />

      {/* Right Wall */}
      <CorrugatedWall position={[0, 0, -1.0]} rotation={[0, Math.PI, 0]} isGhost={isGhost} isWireframe={isWireframe} />

      {/* Roof Panel */}
      <mesh position={[0, 0.95, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <planeGeometry args={[4.2, 2.0]} />
        <meshStandardMaterial
          color="#1E3A8A"
          metalness={0.4}
          roughness={0.4}
          transparent={isGhost || isWireframe}
          opacity={isWireframe ? 0.15 : isGhost ? 0.15 : 1}
          wireframe={isWireframe}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* T-Bar Aluminum Airflow Floor */}
      <mesh position={[0, -0.95, 0]} rotation={[Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[4.2, 2.0]} />
        <meshStandardMaterial
          color="#94A3B8"
          metalness={0.7}
          roughness={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Structural Corner Castings */}
      {[
        [-2.1, 0.95, 1.0], [-2.1, -0.95, 1.0], [2.1, 0.95, 1.0], [2.1, -0.95, 1.0],
        [-2.1, 0.95, -1.0], [-2.1, -0.95, -1.0], [2.1, 0.95, -1.0], [2.1, -0.95, -1.0]
      ].map((pos, i) => (
        <mesh key={i} position={pos as [number, number, number]} castShadow>
          <boxGeometry args={[0.2, 0.2, 0.2]} />
          <meshStandardMaterial color={cornerColor} metalness={0.8} roughness={0.2} />
        </mesh>
      ))}

      {/* Rear Dual Hinged Doors */}
      {/* Left Door */}
      <group position={[2.1, 0, 0.98]}>
        <group ref={leftDoorRef} position={[0, 0, 0]}>
          <mesh position={[0, 0, -0.49]} castShadow>
            <boxGeometry args={[0.06, 1.86, 0.97]} />
            <meshStandardMaterial
              color={doorColor}
              metalness={0.5}
              roughness={0.4}
              transparent={isGhost || isWireframe}
              opacity={isWireframe ? 0.2 : isGhost ? 0.2 : 1}
              wireframe={isWireframe}
            />
          </mesh>
          {/* Vertical locking rod & handle */}
          <mesh position={[0.04, 0, -0.3]}>
            <cylinderGeometry args={[0.018, 0.018, 1.75, 8]} />
            <meshStandardMaterial color="#E2E8F0" metalness={0.9} roughness={0.1} />
          </mesh>
        </group>
      </group>

      {/* Right Door */}
      <group position={[2.1, 0, -0.98]}>
        <group ref={rightDoorRef} position={[0, 0, 0]}>
          <mesh position={[0, 0, 0.49]} castShadow>
            <boxGeometry args={[0.06, 1.86, 0.97]} />
            <meshStandardMaterial
              color={doorColor}
              metalness={0.5}
              roughness={0.4}
              transparent={isGhost || isWireframe}
              opacity={isWireframe ? 0.2 : isGhost ? 0.2 : 1}
              wireframe={isWireframe}
            />
          </mesh>
          {/* Vertical locking rod & handle */}
          <mesh position={[0.04, 0, 0.3]}>
            <cylinderGeometry args={[0.018, 0.018, 1.75, 8]} />
            <meshStandardMaterial color="#E2E8F0" metalness={0.9} roughness={0.1} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

// ---- Interior Cargo Cargo Packages & Pallet ----
function InternalCargo({ temperature }: { temperature: number }) {
  // Thermal color shift: Normal (cyan/frost) -> Warning (amber) -> Critical (crimson)
  const thermalColor = temperature > 12 ? '#EF4444' : temperature > 8 ? '#F59E0B' : '#06B6D4';

  return (
    <group position={[0, -0.2, 0]}>
      {/* Heavy-duty Wooden Pallet Base */}
      <group position={[0, -0.65, 0]}>
        {[-0.8, -0.4, 0, 0.4, 0.8].map((x, i) => (
          <mesh key={i} position={[x, 0, 0]} castShadow>
            <boxGeometry args={[0.12, 0.1, 1.6]} />
            <meshStandardMaterial color="#B45309" roughness={0.8} />
          </mesh>
        ))}
        {[-0.7, 0, 0.7].map((z, i) => (
          <mesh key={`plank-${i}`} position={[0, 0.06, z]} castShadow>
            <boxGeometry args={[1.8, 0.03, 0.18]} />
            <meshStandardMaterial color="#D97706" roughness={0.7} />
          </mesh>
        ))}
      </group>

      {/* Stacked Insulated Pharma Cargo Boxes */}
      {[
        [-0.45, -0.2, -0.4], [0.45, -0.2, -0.4],
        [-0.45, -0.2, 0.4],  [0.45, -0.2, 0.4],
        [-0.45, 0.35, -0.4], [0.45, 0.35, -0.4],
        [-0.45, 0.35, 0.4],  [0.45, 0.35, 0.4],
      ].map((pos, i) => (
        <group key={i} position={pos as [number, number, number]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.82, 0.5, 0.72]} />
            <meshStandardMaterial color="#F8FAFC" roughness={0.5} />
          </mesh>
          {/* Pharma cold-chain label */}
          <mesh position={[0, 0, 0.365]}>
            <planeGeometry args={[0.6, 0.3]} />
            <meshBasicMaterial color="#DBEAFE" />
          </mesh>
          {/* Thermal indicator core glow */}
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.84, 0.52, 0.74]} />
            <meshBasicMaterial color={thermalColor} transparent opacity={0.12} />
          </mesh>
        </group>
      ))}

      {/* Internal Cold Chain Ambient Air Glow */}
      <pointLight position={[0, 0.2, 0]} intensity={1.2} color={thermalColor} distance={3.5} />
    </group>
  );
}

// ---- Interactive 3D Sensor Beacon ----
interface SensorBeaconProps {
  id: string;
  name: string;
  value: string;
  position: [number, number, number];
  color: string;
  icon: string;
  isActive: boolean;
  onClick: () => void;
}

function SensorBeacon({ id, name, value, position, color, icon, isActive, onClick }: SensorBeaconProps) {
  const pulseRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (pulseRef.current) {
      const s = 1 + Math.sin(clock.getElapsedTime() * 4) * 0.25;
      pulseRef.current.scale.set(s, s, s);
    }
  });

  return (
    <group position={position}>
      {/* Center Beacon Orb */}
      <mesh onClick={(e) => { e.stopPropagation(); onClick(); }}>
        <sphereGeometry args={[0.07, 24, 24]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isActive ? 1.5 : 0.8}
          roughness={0.2}
        />
      </mesh>

      {/* Pulsing Aura Ring */}
      <mesh ref={pulseRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.09, 0.14, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>

      {/* 3D HTML Floating Tooltip Tag */}
      <Html position={[0, 0.16, 0]} center distanceFactor={8} zIndexRange={[100, 0]}>
        <div
          onClick={(e) => { e.stopPropagation(); onClick(); }}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full backdrop-blur-md shadow-lg border transition-all transform cursor-pointer select-none whitespace-nowrap ${
            isActive
              ? 'bg-slate-900 text-white border-blue-400 scale-110 ring-2 ring-blue-400/50'
              : 'bg-white/95 text-slate-800 border-slate-200 hover:scale-105'
          }`}
        >
          <span className="text-xs">{icon}</span>
          <span className="text-[11px] font-semibold tracking-tight">{name}:</span>
          <span className="text-[11px] font-mono font-bold" style={{ color: isActive ? '#60A5FA' : color }}>
            {value}
          </span>
        </div>
      </Html>
    </group>
  );
}

// ---- Main Scene Assembly ----
function Scene() {
  const telemetry = useTelemetryStore((s) => s.current);
  const { twinViewMode, activeSensor, setActiveSensor } = useUIStore();
  const sceneGroupRef = useRef<THREE.Group>(null);

  // Smooth Orientation & Shock Shake
  useFrame((_, delta) => {
    if (sceneGroupRef.current) {
      const targetRoll = (telemetry.orientation.roll * Math.PI) / 180;
      const targetPitch = (telemetry.orientation.pitch * Math.PI) / 180;

      sceneGroupRef.current.rotation.z = THREE.MathUtils.lerp(sceneGroupRef.current.rotation.z, targetRoll, delta * 3);
      sceneGroupRef.current.rotation.x = THREE.MathUtils.lerp(sceneGroupRef.current.rotation.x, targetPitch, delta * 3);

      // Shock vibration reaction
      if (telemetry.shock.value > 1.2) {
        const shake = Math.min(telemetry.shock.value * 0.02, 0.08);
        sceneGroupRef.current.position.x = (Math.random() - 0.5) * shake;
        sceneGroupRef.current.position.y = (Math.random() - 0.5) * shake;
      } else {
        sceneGroupRef.current.position.x = THREE.MathUtils.lerp(sceneGroupRef.current.position.x, 0, delta * 6);
        sceneGroupRef.current.position.y = THREE.MathUtils.lerp(sceneGroupRef.current.position.y, 0, delta * 6);
      }
    }
  });

  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[6, 9, 6]} intensity={1.4} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-6, 4, -6]} intensity={0.5} />
      <pointLight position={[0, 4, 0]} intensity={0.4} color="#F8FAFC" />

      <OrbitControls
        enablePan={false}
        minDistance={3.2}
        maxDistance={9.5}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 1.9}
        enableDamping
        dampingFactor={0.06}
      />

      {/* Clean Grid Floor Plane */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.15, 0]}>
        <planeGeometry args={[20, 20]} />
        <shadowMaterial opacity={0.15} />
      </mesh>
      <gridHelper args={[20, 20, '#CBD5E1', '#F1F5F9']} position={[0, -1.14, 0]} />

      <group ref={sceneGroupRef}>
        {/* Container Enclosure */}
        <ContainerEnclosure doorOpen={telemetry.doorOpen} viewMode={twinViewMode} />

        {/* Cargo inside container */}
        <InternalCargo temperature={telemetry.temperature.value} />

        {/* Interactive Sensor Nodes (Visible in Sensors & Interior modes) */}
        {(twinViewMode === 'sensors' || twinViewMode === 'interior') && (
          <group>
            <SensorBeacon
              id="temperature"
              name="Core Temp"
              value={`${telemetry.temperature.value.toFixed(1)}°C`}
              icon="🌡️"
              position={[0, 0.4, 0]}
              color="#0284C7"
              isActive={activeSensor === 'temperature'}
              onClick={() => setActiveSensor('temperature')}
            />
            <SensorBeacon
              id="humidity"
              name="Humidity"
              value={`${telemetry.humidity.value.toFixed(0)}%`}
              icon="💧"
              position={[-0.8, 0.65, 0.6]}
              color="#2563EB"
              isActive={activeSensor === 'humidity'}
              onClick={() => setActiveSensor('humidity')}
            />
            <SensorBeacon
              id="shock"
              name="3-Axis IMU"
              value={`${telemetry.shock.value.toFixed(2)}g`}
              icon="⚡"
              position={[0.7, -0.65, 0]}
              color="#D97706"
              isActive={activeSensor === 'shock'}
              onClick={() => setActiveSensor('shock')}
            />
            <SensorBeacon
              id="door"
              name="Door Lock"
              value={telemetry.doorOpen ? 'OPEN' : 'SECURE'}
              icon="🚪"
              position={[2.08, 0.4, 0]}
              color={telemetry.doorOpen ? '#DC2626' : '#16A34A'}
              isActive={activeSensor === 'door'}
              onClick={() => setActiveSensor('door')}
            />
            <SensorBeacon
              id="pressure"
              name="Pressure"
              value={`${telemetry.pressure.value.toFixed(0)} hPa`}
              icon="🌬️"
              position={[-1.2, 0.65, -0.6]}
              color="#7C3AED"
              isActive={activeSensor === 'pressure'}
              onClick={() => setActiveSensor('pressure')}
            />
            <SensorBeacon
              id="battery"
              name="Gateway"
              value={`${telemetry.battery.percentage.toFixed(0)}%`}
              icon="🔋"
              position={[-2.0, 0.7, 0.6]}
              color="#059669"
              isActive={activeSensor === 'battery'}
              onClick={() => setActiveSensor('battery')}
            />
          </group>
        )}
      </group>
    </>
  );
}

export const ContainerScene: React.FC = () => {
  const telemetry = useTelemetryStore((s) => s.current);
  const twinViewMode = useUIStore((s) => s.twinViewMode);

  return (
    <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-card overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between px-5 py-3.5 border-b border-[#F1F5F9] gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-lg">
            📦
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-[#0F172A]">Smart Digital Twin</h3>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                Mode: {twinViewMode}
              </span>
            </div>
            <p className="text-xs text-[#64748B] flex items-center gap-2 mt-0.5">
              <span>{telemetry.doorOpen ? '🔴 Rear Door Open' : '🟢 Door Latched'}</span>
              <span>·</span>
              <span>Roll: {telemetry.orientation.roll.toFixed(1)}°</span>
              <span>·</span>
              <span>Pitch: {telemetry.orientation.pitch.toFixed(1)}°</span>
            </p>
          </div>
        </div>

        {/* View Mode Selector Tabs */}
        <ViewModeSelector />
      </div>

      {/* 3D Canvas Area */}
      <div className="relative w-full h-[360px] bg-gradient-to-b from-[#F8FAFC] to-[#F1F5F9]">
        <Canvas
          camera={{ position: [5.2, 2.8, 5.0], fov: 42 }}
          shadows
          gl={{ antialias: true, alpha: true }}
        >
          <Scene />
        </Canvas>

        {/* Instructions overlay */}
        <div className="absolute bottom-3 left-4 pointer-events-none text-[11px] font-medium text-[#64748B] bg-white/80 backdrop-blur-sm px-2.5 py-1 rounded-lg border border-slate-200/60 shadow-xs">
          💡 Click & Drag to Orbit · Scroll to Zoom · Click Beacons for Sensor Detail
        </div>
      </div>

      {/* Footer info bar */}
      <div className="px-5 py-2.5 border-t border-[#F1F5F9] bg-[#FAFAFA] flex items-center justify-between text-xs text-[#64748B]">
        <span className="font-mono text-[11px]">SCM-2024-ISO-REEFER · 20ft Cargo Asset</span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Real-time Telemetry Stream Active</span>
        </span>
      </div>
    </div>
  );
};
