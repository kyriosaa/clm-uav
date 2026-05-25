import React, { Suspense, useState } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';

function Model({ rotation = [0, 0, 0] }) {
  const geometry = useLoader(STLLoader, '/golbin_drone_body.stl');

  return (
    <mesh geometry={geometry} rotation={rotation}>
      <meshStandardMaterial color="royalblue" roughness={0.3} />
    </mesh>
  );
}

export default function App() {

  const initialPitchOffset = 0;
  const [pitch, setPitch] = useState(0);
  const [yaw, setYaw] = useState(0);
  const [roll, setRoll] = useState(0);

  // Telemetry / read-only values
  const [altitude, setAltitude] = useState(0);
  const [ground, setGround] = useState(0);
  const [proximity, setProximity] = useState(0);
  const [battery, setBattery] = useState(0);

  const resetRotations = () => {
    setPitch(0);
    setYaw(0);
    setRoll(0);
  };

  const toRad = (deg) => (deg * Math.PI) / 180;

  return (
    <div className="viewer-outer">
      <div className="viewer-inner">
        <div className="view-controls">
          <div className="controls-panel">
            <label>Pitch (X): {pitch}°</label>
            <input type="range" min={-180} max={180} value={pitch} onChange={(e) => setPitch(Number(e.target.value))} />
            <label>Yaw (Y): {yaw}°</label>
            <input type="range" min={-180} max={180} value={yaw} onChange={(e) => setYaw(Number(e.target.value))} />
            <div className="control-row">
              <button onClick={resetRotations}>Reset</button>
            </div>
          </div>
        </div>
        <Canvas className="viewer-canvas" camera={{ position: [0, 0, 5], fov: 50 }}>
           <color attach="background" args={["#0f172a"]} />
          <ambientLight intensity={0.8} />
          <directionalLight position={[10, 10, 5]} intensity={1.2} />
          <Suspense fallback={null}>
            <Model rotation={[toRad(pitch + initialPitchOffset), toRad(yaw), toRad(roll)]} />
          </Suspense>

          <OrbitControls
            enableZoom={false}
            enableRotate={false}
            enablePan={false}
            minDistance={200}
            maxDistance={200}
          />
        </Canvas>
        <div className="telemetry">
          <div className="item"><span className="label">Altitude</span><span className="value">{altitude} m</span></div>
          <div className="item"><span className="label">Ground</span><span className="value">{ground} m</span></div>
          <div className="item"><span className="label">Proximity</span><span className="value">{proximity} m</span></div>
          <div className="item"><span className="label">Battery</span><span className="value">{battery} %</span></div>
        </div>
      </div>
    </div>
  );
}

