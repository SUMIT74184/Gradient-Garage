"use client";

import { useMemo, useState } from "react";
import GoldParticleWave, { type ParticleScene } from "@/components/GoldParticleWave";
import type { Scene as SceneCopy } from "@/lib/content/defaults";

// Scenes come from the admin panel (Landing copy → Hero). Images are pre-composed to 2:1 with
// the subject in the top-right corner, clear of the headline and the training monitor.
const FOCUS: [number, number] = [0.86, 0.72];

/** Hero particle field that cycles through silhouette scenes, with a credit chip for the current one. */
export default function HeroScenes({ scenes: input }: { scenes: SceneCopy[] }) {
  const scenes = useMemo<(ParticleScene & SceneCopy)[]>(() => input.map((s) => ({ ...s, focus: FOCUS })), [input]);
  const [current, setCurrent] = useState(0);
  const scene = scenes[current] ?? scenes[0];

  return (
    <>
      <GoldParticleWave
        scenes={scenes}
        interval={9}
        imageMode="subject"
        imageFrom={0.66}
        onSceneChange={setCurrent}
      />
      <div aria-hidden="true" className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 gap-1.5 max-md:hidden">
        {scenes.map((s, i) => (
          <span
            key={`${s.src}-${i}`}
            className={`h-1 rounded-full transition-all duration-500 ${i === current ? "w-6 bg-gold-300" : "w-2 bg-white/25"}`}
          />
        ))}
      </div>
      {scene?.credit && (
      <a
        href={scene.href || undefined}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-3 right-4 z-20 rounded-full bg-black/50 px-2.5 py-1 text-[10px] text-white/70 backdrop-blur-sm hover:text-white max-md:hidden"
      >
        {scene.title ? `${scene.title} · ` : ""}Photo: {scene.credit}
      </a>
      )}
    </>
  );
}
