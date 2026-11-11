"use client";

import { useState } from "react";
import GoldParticleWave, { type ParticleScene } from "@/components/GoldParticleWave";

// Sunset silhouettes, pre-composed to 2:1 with the subject in the top-right corner, clear of the headline and the training monitor
const SCENES: (ParticleScene & { title: string; credit: string; href: string })[] = [
  {
    src: "/scenes/acacia.jpg",
    focus: [0.86, 0.72],
    title: "Acacia at sunrise, Serengeti",
    credit: "Daniel Zaas, public domain",
    href: "https://commons.wikimedia.org/wiki/File:Acacia_tree_on_a_sunrise_safari_at_the_Serengeti_National_Park,_Tanzania.jpg",
  },
  {
    src: "/scenes/giraffe.jpg",
    focus: [0.86, 0.72],
    title: "Giraffe at dusk, Masai Mara",
    credit: "LindaPatterson, CC BY-SA 3.0 (edited)",
    href: "https://commons.wikimedia.org/wiki/File:Masi_mara_sunset_and_giraffe_-_panoramio.jpg",
  },
  {
    src: "/scenes/serengeti.jpg",
    focus: [0.86, 0.72],
    title: "Treeline at sunset, Serengeti",
    credit: "Anita Ritenour, CC BY 2.0",
    href: "https://commons.wikimedia.org/wiki/File:Serengeti_Sunset.jpg",
  },
];

/** Hero particle field that cycles through silhouette scenes, with a credit chip for the current one. */
export default function HeroScenes() {
  const [current, setCurrent] = useState(0);
  const scene = SCENES[current];

  return (
    <>
      <GoldParticleWave
        scenes={SCENES}
        interval={9}
        imageMode="subject"
        imageFrom={0.66}
        onSceneChange={setCurrent}
      />
      <div aria-hidden="true" className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 gap-1.5 max-md:hidden">
        {SCENES.map((s, i) => (
          <span
            key={s.src}
            className={`h-1 rounded-full transition-all duration-500 ${i === current ? "w-6 bg-gold-300" : "w-2 bg-white/25"}`}
          />
        ))}
      </div>
      <a
        href={scene.href}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-3 right-4 z-20 rounded-full bg-black/50 px-2.5 py-1 text-[10px] text-white/70 backdrop-blur-sm hover:text-white max-md:hidden"
      >
        {scene.title} · Photo: {scene.credit}
      </a>
    </>
  );
}
