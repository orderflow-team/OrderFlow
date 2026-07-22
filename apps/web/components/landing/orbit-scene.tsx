'use client';

import { Suspense, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Float, Html, OrbitControls, RoundedBox, Sparkles } from '@react-three/drei';
import type { Group, Mesh } from 'three';
import { ShoppingCart, Package, Receipt, Users, type LucideIcon } from 'lucide-react';
import { useReducedMotion } from '@/lib/use-reduced-motion';

interface TokenDef {
  label: string;
  sub: string;
  icon: LucideIcon;
  color: string;
  angle: number;
}

// The app's own four pillars — same icons and roles as the login screen's brand
// tiles and the dashboard's four home cards, just rendered in glass instead of flat color.
const TOKENS: TokenDef[] = [
  { label: 'Orders', sub: 'Dine-in, takeaway, delivery', icon: ShoppingCart, color: '#38bdf8', angle: 0 },
  { label: 'Inventory', sub: 'Stock, batches, purchase orders', icon: Package, color: '#a78bfa', angle: Math.PI / 2 },
  { label: 'Billing', sub: 'Invoices, GST, payments', icon: Receipt, color: '#34d399', angle: Math.PI },
  { label: 'Clients', sub: 'Customers & suppliers', icon: Users, color: '#fb923c', angle: (3 * Math.PI) / 2 },
];

const ORBIT_RADIUS = 2.05;

function Token({ token, reduced }: { token: TokenDef; reduced: boolean }) {
  const meshRef = useRef<Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const [pulse, setPulse] = useState(0);
  const targetScale = useRef(1);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    targetScale.current = hovered ? 1.22 : 1;
    const bump = pulse > 0 ? Math.sin(pulse * Math.PI) * 0.25 : 0;
    const goal = targetScale.current + bump;
    meshRef.current.scale.lerp({ x: goal, y: goal, z: goal } as never, Math.min(1, delta * 6));
    if (pulse > 0) setPulse(Math.max(0, pulse - delta * 1.6));
  });

  const Icon = token.icon;

  return (
    <group
      position={[Math.cos(token.angle) * ORBIT_RADIUS, Math.sin(token.angle * 1.3) * 0.4, Math.sin(token.angle) * ORBIT_RADIUS]}
    >
      <Float speed={reduced ? 0 : 1.6} rotationIntensity={reduced ? 0 : 0.4} floatIntensity={reduced ? 0 : 0.6}>
        <RoundedBox
          ref={meshRef}
          args={[1.05, 1.05, 1.05]}
          radius={0.22}
          smoothness={4}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHovered(true);
          }}
          onPointerOut={() => setHovered(false)}
          onClick={(e) => {
            e.stopPropagation();
            setPulse(1);
          }}
        >
          <meshPhysicalMaterial
            color={token.color}
            emissive={token.color}
            emissiveIntensity={0.55}
            transmission={0.35}
            thickness={0.9}
            roughness={0.28}
            metalness={0}
            ior={1.2}
            clearcoat={0.7}
            clearcoatRoughness={0.3}
            envMapIntensity={0.9}
          />
        </RoundedBox>
        <Html center distanceFactor={8} style={{ pointerEvents: 'none' }}>
          <div
            className={`flex items-center justify-center w-11 h-11 rounded-full bg-white ring-2 ring-black/5 shadow-[0_2px_10px_rgba(0,0,0,0.35)] transition-transform duration-200 ${hovered ? 'scale-110' : 'scale-100'}`}
          >
            <Icon className="w-5 h-5" style={{ color: token.color }} strokeWidth={2.6} />
          </div>
          {hovered && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 whitespace-nowrap rounded-2xl bg-white/95 backdrop-blur-md ring-1 ring-white/60 shadow-xl px-3.5 py-2 text-center animate-in fade-in zoom-in-95 duration-150">
              <p className="text-sm font-bold text-slate-800 leading-tight">{token.label}</p>
              <p className="text-[11px] text-slate-500 font-medium leading-tight">{token.sub}</p>
            </div>
          )}
        </Html>
      </Float>
    </group>
  );
}

function Hub({ reduced }: { reduced: boolean }) {
  const ref = useRef<Mesh>(null);
  useFrame((_, delta) => {
    if (ref.current && !reduced) ref.current.rotation.y += delta * 0.09;
  });
  return (
    <mesh ref={ref}>
      <icosahedronGeometry args={[1.15, 3]} />
      <meshPhysicalMaterial
        color="#10b981"
        emissive="#10b981"
        emissiveIntensity={0.45}
        transmission={0.45}
        thickness={1.1}
        roughness={0.18}
        metalness={0}
        ior={1.2}
        clearcoat={0.6}
        clearcoatRoughness={0.3}
        envMapIntensity={1.1}
      />
    </mesh>
  );
}

// Slow and steady — one full revolution roughly every 35s.
const RING_SPEED = 0.18;

function OrbitRing({ reduced }: { reduced: boolean }) {
  const ringRef = useRef<Group>(null);
  useFrame((_, delta) => {
    if (ringRef.current && !reduced) ringRef.current.rotation.y += delta * RING_SPEED;
  });
  return (
    <group ref={ringRef}>
      {TOKENS.map((token) => (
        <Token key={token.label} token={token} reduced={reduced} />
      ))}
    </group>
  );
}

export function OrbitScene() {
  const reduced = useReducedMotion();
  const dpr = useMemo<[number, number]>(() => [1, 1.5], []);

  return (
    <Canvas
      dpr={dpr}
      gl={{ alpha: true, antialias: true }}
      camera={{ position: [0, 1.1, 10.5], fov: 36 }}
      style={{ touchAction: 'none' }}
    >
      <ambientLight intensity={1.4} />
      <directionalLight position={[4, 6, 5]} intensity={2} />
      <directionalLight position={[-5, 2, -4]} intensity={0.8} color="#c4b5fd" />
      <directionalLight position={[-2, -5, 4]} intensity={0.9} />
      <pointLight position={[0, 3, 4]} intensity={0.6} color="#ffffff" />

      <Suspense fallback={null}>
        <Environment preset="studio" background={false} resolution={256} />
        <Hub reduced={reduced} />
        <OrbitRing reduced={reduced} />
        <Sparkles count={40} scale={5} size={2} speed={reduced ? 0 : 0.25} opacity={0.35} color="#94a3b8" />
      </Suspense>

      {/* The ring's own rotation above is the one clear "auto rotate" — the camera itself
          stays put except when the visitor drags, so the two motions don't fight each other. */}
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        autoRotate={false}
        minPolarAngle={Math.PI / 2.6}
        maxPolarAngle={Math.PI / 1.7}
      />
    </Canvas>
  );
}
