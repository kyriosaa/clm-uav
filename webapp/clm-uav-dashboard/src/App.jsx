import React, { Suspense, useState, useEffect, useRef } from 'react';
import { Canvas, useLoader, useThree, useFrame } from '@react-three/fiber';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import { auth } from './firebase.js';
import { useSensorData } from './sensordata.jsx';
import { signOut } from 'firebase/auth';

const SCALE = 300;
const GROUND_OFFSET = 0.020; 
const toRad = (deg) => (deg * Math.PI) / 180;

// Smoothly interpolates the drone + ground toward target values every frame.
// This hides network jitter: even if packets arrive irregularly, motion stays fluid.
function FlightScene({ targets }) {
  const geometry = useLoader(STLLoader, '/golbin_drone_body.stl');
  const droneRef = useRef();
  const groundRef = useRef();

  // The currently-displayed (animated) values, separate from the targets.
  const cur = useRef({ pitch: 0, roll: 0, yaw: 0, ground: 0 });

  useFrame(() => {
    const t = targets.current;
    const c = cur.current;
    const k = 0.1; // catch-up speed per frame: lower = smoother/laggier, higher = snappier

    c.pitch  += (t.pitch  - c.pitch)  * k;
    c.roll   += (t.roll   - c.roll)   * k;
    c.yaw    += (t.yaw    - c.yaw)    * k;
    c.ground += (t.ground - c.ground) * k;

    if (droneRef.current) {
      droneRef.current.rotation.set(toRad(c.pitch), toRad(c.roll), toRad(c.yaw) + Math.PI);
    }
    if (groundRef.current) {
      groundRef.current.position.z = -40 - c.ground * SCALE;
    }
  });

  return (
    <>
      {/* Ground + grid sink downward as the drone climbs */}
      <group ref={groundRef} position={[0, 0, -40]}>
        <gridHelper
          args={[2000, 30, "#2d5016", "#3a6b1c"]}
          rotation={[Math.PI / 2, 0, 0]}
        />
        <mesh position={[0, 0, -1]}>
          <planeGeometry args={[2000, 2000]} />
          <meshLambertMaterial color="#234d0f" />
        </mesh>
      </group>

      <mesh ref={droneRef} geometry={geometry}>
        <meshLambertMaterial color="royalblue" />
      </mesh>
    </>
  );
}

function CameraRig({ view }) {
  const { camera } = useThree();
  useEffect(() => {
    if (view === 'top') {
      camera.position.set(0, 0, 250);
      camera.up.set(0, 1, 0);
    } else {
      camera.position.set(0, -200, 100);
      camera.up.set(0, 0, 1);
    }
    camera.lookAt(0, 0, 0);
  }, [view, camera]);
  return null;
}

// Isolated clock so its 1s tick re-renders only itself
function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return <div className="top-left-clock">{now.toLocaleString('en-US')}</div>;
}

export default function App() {
  // State is only used for the on-screen text (labels + telemetry)
  const [pitch, setPitch] = useState(0);
  const [roll, setRoll] = useState(0);
  const [ground, setGround] = useState(0);
  const [battery, setBattery] = useState(0);
  const [temperature, setTemperature] = useState(0);
  const [pressure, setPressure] = useState(0);

  const [view, setView] = useState('side');

  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);

  // Smoothing accumulators for the raw sensor signal
  const smoothPitch = useRef(0);
  const smoothRoll = useRef(0);

  // Targets the 3D scene interpolates toward (read inside useFrame)
  const targets = useRef({ pitch: 0, roll: 0, yaw: 0, ground: 0 });

  // Last committed state values — to skip imperceptible text re-renders
  const lastPitch = useRef(0);
  const lastRoll = useRef(0);
  const lastGround = useRef(0);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error('Sign out failed', e);
    }
  };
  const handleReset = () => {
  smoothPitch.current = 0;
  smoothRoll.current = 0;
  targets.current = { pitch: 0, roll: 0, yaw: 0, ground: 0 };
  lastPitch.current = 0;
  lastRoll.current = 0;
  lastGround.current = 0;
  setPitch(0);
  setRoll(0);
  setGround(0);
  setBattery(0);
  setTemperature(0);
  setPressure(0);
};

const handleTogglePause = () => {
  pausedRef.current = !pausedRef.current;
  setPaused(pausedRef.current);
};

  // Real-time continuous document stream
  const liveItems = useSensorData(1);

  useEffect(() => {
    if (!liveItems || liveItems.length === 0) return;

    const sourceData = liveItems[0].payload || liveItems[0];
    if (!sourceData) return;
    if (pausedRef.current) return;   

    // 1. Battery
    if (sourceData.power?.voltage_v !== undefined) {
      setBattery(sourceData.power.voltage_v);
    }

    // 2. AGL Laser with Dead Zone Filtering (Init around 15-25, threshold +/- 5)
    let rawLaserMM = sourceData.environment?.agl_laser_mm ?? 20;
    let filteredLaserMM = rawLaserMM;
    if (rawLaserMM >= 15 && rawLaserMM <= 25) {
      filteredLaserMM = 20; // Pin to nominal baseline state inside dead zone
    }
    const currentProximityMeters = Number(filteredLaserMM) / 1000;

    // Feed the scene target (always — cheap), update text only on real change
    targets.current.ground = currentProximityMeters - GROUND_OFFSET;
    if (Math.abs(currentProximityMeters - lastGround.current) > 0.001) {
      lastGround.current = currentProximityMeters;
      setGround(currentProximityMeters);
    }

    // 3. MPU6050 Orientation with Dead Zones (+/- 2 degrees window)
    let rawRoll = sourceData.attitude?.roll ?? 0;
    let rawPitch = sourceData.attitude?.pitch ?? 0;

    if (rawRoll >= -2 && rawRoll <= 2) rawRoll = 0;
    if (rawPitch >= -2 && rawPitch <= 2) rawPitch = 0;

    const alpha = 0.4; // signal smoothing on top of the per-frame interpolation
    smoothRoll.current = smoothRoll.current + alpha * (rawRoll - smoothRoll.current);
    smoothPitch.current = smoothPitch.current + alpha * (rawPitch - smoothPitch.current);

    // Scene targets (note: pitch/roll intentionally cross-wired for your sensor layout)
    targets.current.pitch = smoothRoll.current;
    targets.current.roll = smoothPitch.current;
    targets.current.yaw = sourceData.attitude?.yaw ?? 0;

    // Text state, thresholded
    if (Math.abs(smoothRoll.current - lastPitch.current) > 0.1) {
      lastPitch.current = smoothRoll.current;
      setPitch(smoothRoll.current);
    }
    if (Math.abs(smoothPitch.current - lastRoll.current) > 0.1) {
      lastRoll.current = smoothPitch.current;
      setRoll(smoothPitch.current);
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
          <button onClick={handleTogglePause}>
            {paused ? 'Resume' : 'Stop'}
          </button>
          <button onClick={handleReset}>Reset</button>
        </div>

        <Canvas
          className="viewer-canvas"
          dpr={[1, 1.5]}
          gl={{ powerPreference: 'high-performance' }}
          camera={{ position: [0, 0, 250], fov: 50, near: 0.1, far: 1000 }}
        >
          <color attach="background" args={["#0f172a"]} />
          <ambientLight intensity={0.8} />
          <directionalLight position={[10, 10, 5]} intensity={1.2} />

          <Suspense fallback={null}>
            <CameraRig view={view} />
            <FlightScene targets={targets} />
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
