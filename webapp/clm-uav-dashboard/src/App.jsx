import React, { Suspense, useState, useEffect, useRef } from 'react';
import { Canvas, useLoader, useThree } from '@react-three/fiber';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import { auth } from './firebase.js';
import { useSensorData } from './sensordata.jsx';
import { signOut } from 'firebase/auth';

const SCALE = 300;

function Model({ rotation = [0, 0, 0], position = [0, 0, 0] }) {
  const geometry = useLoader(STLLoader, '/golbin_drone_body.stl');
  return (
    <mesh geometry={geometry} rotation={rotation} position={position}>
      {/* Lambert: cheaper per-pixel lighting than meshStandardMaterial */}
      <meshLambertMaterial color="royalblue" />
    </mesh>
  );
}

function CameraRig({ view }) {
  const { camera, invalidate } = useThree();
  useEffect(() => {
    if (view === 'top') {
      camera.position.set(0, 0, 250);
      camera.up.set(0, 1, 0);
    } else {
      camera.position.set(0, -200, 100);
      camera.up.set(0, 0, 1);
    }
    camera.lookAt(0, 0, 0);
    invalidate();
  }, [view, camera, invalidate]);
  return null;
}

// Isolated clock so its 1s tick re-renders only itself, not the whole App + Canvas
function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return <div className="top-left-clock">{now.toLocaleString('en-US')}</div>;
}

export default function App() {
  // Flight Orientation: Pitch, Roll, Yaw
  const [pitch, setPitch] = useState(0);
  const [roll, setRoll] = useState(0);
  const [yaw, setYaw] = useState(0);
  const [ground, setGround] = useState(0);
  const [battery, setBattery] = useState(0);
  const [temperature, setTemperature] = useState(0);
  const [pressure, setPressure] = useState(0);

  const [view, setView] = useState('side');

  const smoothPitch = useRef(0);
  const smoothRoll = useRef(0);

  // Last committed values — used to skip imperceptible state updates
  const lastPitch = useRef(0);
  const lastRoll = useRef(0);
  const lastYaw = useRef(0);
  const lastGround = useRef(0);

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

    // Only commit ground if it moved more than 1mm — skips noise renders
    if (Math.abs(currentProximityMeters - lastGround.current) > 0.001) {
      lastGround.current = currentProximityMeters;
      setGround(currentProximityMeters);
    }

    // 3. Process MPU6050 Orientation with Dead Zones (+/- 2 degrees window)
    let rawRoll = sourceData.attitude?.roll ?? 0;
    let rawPitch = sourceData.attitude?.pitch ?? 0;

    if (rawRoll >= -2 && rawRoll <= 2) rawRoll = 0;
    if (rawPitch >= -2 && rawPitch <= 2) rawPitch = 0;

    const alpha = 0.4; // 0 = frozen, 1 = no smoothing. Lower = smoother but laggier.

    smoothRoll.current = smoothRoll.current + alpha * (rawRoll - smoothRoll.current);
    smoothPitch.current = smoothPitch.current + alpha * (rawPitch - smoothPitch.current);

    // Only commit angles if they changed by more than 0.1° — skips jitter renders.
    // NOTE: pitch/roll are intentionally cross-wired (your sensor layout).
    if (Math.abs(smoothRoll.current - lastPitch.current) > 0.1) {
      lastPitch.current = smoothRoll.current;
      setPitch(smoothRoll.current);
    }
    if (Math.abs(smoothPitch.current - lastRoll.current) > 0.1) {
      lastRoll.current = smoothPitch.current;
      setRoll(smoothPitch.current);
    }

    const rawYaw = sourceData.attitude?.yaw ?? 0;
    if (Math.abs(rawYaw - lastYaw.current) > 0.1) {
      lastYaw.current = rawYaw;
      setYaw(rawYaw);
    }

    if (sourceData.environment?.temp_c !== undefined) {
      setTemperature(sourceData.environment.temp_c);
    }
    if (sourceData.environment?.pressure_pa !== undefined) {
      setPressure(sourceData.environment.pressure_pa / 100); // Pa -> hPa
    }
    if (sourceData.power?.voltage_v !== undefined) {
      setBattery(sourceData.power.voltage_v);
    }
  }, [liveItems]);

  return (
    <div className="viewer-outer">
      <div className="logout-top">
        <button onClick={handleSignOut}>Logout</button>
      </div>

      <div className="viewer-inner">
        <Clock />

        <div className="view-controls">
          <div className="controls-panel">
            <button onClick={() => setView(view === 'side' ? 'top' : 'side')}>
              Change View
            </button>
            <label>Pitch: {pitch.toFixed(1)}°</label>
            <input type="range" min={-180} max={180} value={pitch} readOnly tabIndex={-1} />

            <label>Roll: {roll.toFixed(1)}°</label>
            <input type="range" min={-180} max={180} value={roll} readOnly tabIndex={-1} />
          </div>
        </div>

        <Canvas
          className="viewer-canvas"
          frameloop="demand"
          dpr={[1, 1.5]}
          gl={{ powerPreference: 'high-performance' }}
          camera={{ position: [0, 0, 250], fov: 50, near: 0.1, far: 1000 }}
        >
          <color attach="background" args={["#0f172a"]} />
          <ambientLight intensity={0.8} />
          <directionalLight position={[10, 10, 5]} intensity={1.2} />
          <group position={[0, 0, -40 - ground * SCALE]}>
            <gridHelper
              args={[2000, 30, "#2d5016", "#3a6b1c"]}
              rotation={[Math.PI / 2, 0, 0]}
            />
            <mesh position={[0, 0, -1]}>
              <planeGeometry args={[2000, 2000]} />
              <meshLambertMaterial color="#234d0f" />
            </mesh>
          </group>

          <Suspense fallback={null}>
            <CameraRig view={view} />
            <Model rotation={[toRad(pitch), toRad(roll), toRad(yaw) + Math.PI]} />
          </Suspense>
        </Canvas>

        <div className="telemetry">
          <div className="item">
            <span className="label">Ground</span>
            <span className="value">{ground.toFixed(3)} m</span>
          </div>
          <div className="item">
            <span className="label">Temperature</span>
            <span className="value">{temperature.toFixed(1)} °C</span>
          </div>
          <div className="item">
            <span className="label">Pressure</span>
            <span className="value">{pressure.toFixed(1)} hPa</span>
          </div>
          <div className="item">
            <span className="label">Voltage</span>
            <span className="value">{battery.toFixed(2)} V</span>
          </div>
        </div>
      </div>
    </div>
  );
}
