import React, { Suspense, useState, useEffect } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import { auth } from './firebase.js';
import { useSensorData } from './sensordata.jsx';
import { signOut } from 'firebase/auth';

function Model({ rotation = [0, 0, 0] }) {
  const geometry = useLoader(STLLoader, '/golbin_drone_body.stl');

  return (
    <mesh geometry={geometry} rotation={rotation}>
      <meshStandardMaterial color="royalblue" roughness={0.3} />
    </mesh>
  );
}

export default function App() {
  // Flight Orientation: Pitch, Roll, Yaw
  const [pitch, setPitch] = useState(0);
  const [roll, setRoll] = useState(0);
  const [yaw, setYaw] = useState(0);

  // Dynamic Altimeter / Environment States
  const [altitude, setAltitude] = useState(0);
  const [ground, setGround] = useState(0);
  const [proximity, setProximity] = useState(0);
  const [battery, setBattery] = useState(0);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error('Sign out failed', e);
    }
  };

  // Helper: Converts degrees to radians
  const toRad = (deg) => (deg * Math.PI) / 180;

  // Intercept the real-time continuous document stream
  const liveItems = useSensorData(1);

  useEffect(() => {
    if (!liveItems || liveItems.length === 0) return;

    const sourceData = liveItems[0].payload || liveItems[0];
    if (!sourceData) return;

    // 1. Process Battery
    if (sourceData.power?.voltage_v !== undefined) {
      setBattery(sourceData.power.voltage_v);
    }

    // 2. Process AGL Laser with Dead Zone Filtering (Init around 15-25, threshold +/- 5)
    let rawLaserMM = sourceData.environment?.agl_laser_mm ?? 20;
    let filteredLaserMM = rawLaserMM;
    if (rawLaserMM >= 15 && rawLaserMM <= 25) {
      filteredLaserMM = 20; // Pin to nominal baseline state inside dead zone
    }
    const currentProximityMeters = Number(filteredLaserMM) / 1000;
    setProximity(currentProximityMeters);

    // Deriving Altitude and Ground clearance variables based on Laser feedback
    setAltitude(currentProximityMeters);
    setGround(Math.max(0, 2.5 - currentProximityMeters)); // Simulated distance to landing pad deck

    // 3. Process MPU6050 Orientation with Dead Zones (+/- 2 degrees window)
    let rawRoll = sourceData.attitude?.roll ?? 0;
    let rawPitch = sourceData.attitude?.pitch ?? 0;

    if (rawRoll >= -2 && rawRoll <= 2) rawRoll = 0;
    if (rawPitch >= -2 && rawPitch <= 2) rawPitch = 0;

    setPitch(rawRoll); 
    setRoll(rawPitch);
    setYaw(sourceData.attitude?.yaw ?? 0);

  }, [liveItems]);
  
  // Dashboard System Clock
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="viewer-outer">
      <div className="logout-top">
        <button onClick={handleSignOut}>Logout</button>
      </div>
      
      <div className="viewer-inner">
        <div className="top-left-clock">{now.toLocaleString('en-US')}</div>
        
        <div className="view-controls">
          <div className="controls-panel">
            {/* Displaying angle with a maximum of 1 decimal place */}
            <label>Pitch Angle: {pitch.toFixed(1)}°</label>
            <input type="range" min={-180} max={180} value={pitch} readOnly tabIndex={-1} />
            
            {/* Displaying angle with a maximum of 1 decimal place */}
            <label>Roll Angle: {roll.toFixed(1)}°</label>
            <input type="range" min={-180} max={180} value={roll} readOnly tabIndex={-1} />
          </div>
        </div>

        <Canvas className="viewer-canvas" camera={{ position: [0, 0, 5], fov: 50 }}>
          <color attach="background" args={["#0f172a"]} />
          <ambientLight intensity={0.8} />
          <directionalLight position={[10, 10, 5]} intensity={1.2} />
          <Suspense fallback={null}>
            {/* rotation maps pitch to x axis and roll to y axis to follow your exact sensor layout physics */}
            <Model rotation={[toRad(pitch), toRad(roll), toRad(yaw)]} />
          </Suspense>
          <OrbitControls enableZoom={false} enableRotate={false} enablePan={false} minDistance={200} maxDistance={200} />
        </Canvas>

        {/* All telemetry values updated to output exactly 1 decimal place (.toFixed(1)) */}
        {/* All telemetry values updated to output exactly 3 decimal places for high-precision meter metrics */}
        <div className="telemetry">
          <div className="item">
            <span className="label">Altitude</span>
            <span className="value">{altitude.toFixed(3)} m</span>
          </div>
          <div className="item">
            <span className="label">Ground</span>
            <span className="value">{ground.toFixed(3)} m</span>
          </div>
          <div className="item">
            <span className="label">Proximity</span>
            <span className="value">{proximity.toFixed(3)} m</span>
          </div>
          <div className="item">
            <span className="label">Battery Voltage</span>
            <span className="value">{battery.toFixed(1)} V</span>
          </div>
        </div>
      </div>
    </div>
  );
}