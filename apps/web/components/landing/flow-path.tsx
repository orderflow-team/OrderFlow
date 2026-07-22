'use client';

import { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Html, Line, Sparkles } from '@react-three/drei';
import { CatmullRomCurve3, Color, Vector3, type Mesh } from 'three';
import type { LucideIcon } from 'lucide-react';
import { useReducedMotion } from '@/lib/use-reduced-motion';

export interface FlowNodeDef {
  color: string;
  icon: LucideIcon;
}

const NODE_COUNT_GAP = 1.25;

function buildCurve(count: number) {
  const points: Vector3[] = [];
  for (let i = 0; i < count; i++) {
    const y = (count - 1) * NODE_COUNT_GAP * 0.5 - i * NODE_COUNT_GAP;
    const x = Math.sin(i * 1.15) * 1.15;
    const z = Math.cos(i * 0.85) * 0.6;
    points.push(new Vector3(x, y, z));
  }
  return new CatmullRomCurve3(points, false, 'catmullrom', 0.4);
}

function Node({
  position,
  color,
  Icon,
  active,
  reduced,
}: {
  position: Vector3;
  color: string;
  Icon: LucideIcon;
  active: boolean;
  reduced: boolean;
}) {
  const ref = useRef<Mesh>(null);
  const scaleRef = useRef(1);

  useFrame((_, delta) => {
    const mesh = ref.current;
    if (!mesh) return;
    if (!reduced) mesh.rotation.y += delta * 0.35;
    const goal = active ? 1.45 : 1;
    scaleRef.current += (goal - scaleRef.current) * Math.min(1, delta * 5);
    mesh.scale.setScalar(scaleRef.current);
  });

  return (
    <group position={position}>
      <mesh ref={ref}>
        <icosahedronGeometry args={[0.46, 1]} />
        <meshPhysicalMaterial
          color={color}
          emissive={color}
          emissiveIntensity={active ? 1 : 0.6}
          thickness={0.5}
          roughness={0.25}
          transmission={0.4}
          ior={1.2}
          clearcoat={0.7}
          clearcoatRoughness={0.3}
        />
      </mesh>
      <Html center distanceFactor={7} style={{ pointerEvents: 'none' }}>
        <div
          className={`flex items-center justify-center rounded-full bg-white ring-2 ring-black/5 shadow-[0_2px_10px_rgba(0,0,0,0.35)] transition-all duration-300 ${
            active ? 'w-9 h-9' : 'w-7 h-7'
          }`}
        >
          <Icon className={active ? 'w-4 h-4' : 'w-3.5 h-3.5'} style={{ color }} strokeWidth={2.6} />
        </div>
      </Html>
    </group>
  );
}

function FlowParticle({ curve, offset, reduced }: { curve: CatmullRomCurve3; offset: number; reduced: boolean }) {
  const ref = useRef<Mesh>(null);
  const t = useRef(offset);

  useFrame((_, delta) => {
    const mesh = ref.current;
    if (!mesh) return;
    if (!reduced) t.current = (t.current + delta * 0.09) % 1;
    const p = curve.getPointAt(t.current);
    mesh.position.copy(p);
  });

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.07, 12, 12]} />
      <meshBasicMaterial color="#ffffff" toneMapped={false} />
    </mesh>
  );
}

export function FlowPath({ nodes, activeIndex }: { nodes: FlowNodeDef[]; activeIndex: number }) {
  const reduced = useReducedMotion();
  const dpr = useMemo<[number, number]>(() => [1, 1.5], []);
  const curve = useMemo(() => buildCurve(nodes.length), [nodes.length]);
  const linePoints = useMemo(() => curve.getPoints(120), [curve]);
  const particleOffsets = useMemo(() => [0, 0.25, 0.5, 0.75], []);

  return (
    <Canvas dpr={dpr} gl={{ alpha: true, antialias: true }} camera={{ position: [0, 0, 11.5], fov: 40 }}>
      <ambientLight intensity={0.75} />
      <directionalLight position={[3, 4, 5]} intensity={1.3} />
      <directionalLight position={[-4, -2, -3]} intensity={0.4} color="#c4b5fd" />
      <directionalLight position={[-2, -4, 5]} intensity={0.35} />
      <Suspense fallback={null}>
        <Environment preset="studio" background={false} resolution={128} />
        <Line points={linePoints} color="#cbd5e1" lineWidth={1.5} transparent opacity={0.5} />
        {nodes.map((node, i) => (
          <Node
            key={i}
            position={curve.points[i]}
            color={node.color}
            Icon={node.icon}
            active={i === activeIndex}
            reduced={reduced}
          />
        ))}
        {!reduced &&
          particleOffsets.map((o, i) => <FlowParticle key={i} curve={curve} offset={o} reduced={reduced} />)}
        <Sparkles count={35} scale={[3.5, 10, 3]} size={1.6} speed={reduced ? 0 : 0.2} opacity={0.25} color="#94a3b8" />
      </Suspense>
    </Canvas>
  );
}
