import Link from "next/link";
import type { ReactNode } from "react";
import GoldParticleWave from "@/components/GoldParticleWave";
import { Logo } from "@/components/Navbar";
import { site } from "@/config/site";

/** Split auth layout: the form on the left, the giraffe particle scene on the right (large screens). */
export default function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen w-full bg-ink">
      <div className="flex flex-1 flex-col px-6 py-6 md:px-12">
        <Link href="/" className="inline-flex w-fit items-center gap-2.5">
          <Logo />
          <span className="display text-lg text-fg">{site.name}</span>
        </Link>
        <main className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-[400px]">{children}</div>
        </main>
        <p className="text-xs text-muted">
          <Link href="/" className="transition-colors hover:text-fg">
            ← Back to the model hub
          </Link>
        </p>
      </div>

      <div className="relative m-3 hidden flex-1 overflow-hidden rounded-2xl border border-line bg-[#2a1206] lg:block">
        <GoldParticleWave
          shape="square"
          bias="none"
          spacing={6}
          intensity={1.6}
          floor={0.32}
          speed={0.6}
          image="/scenes/giraffe.jpg"
          imageFocus={[0.86, 0.5]}
          imageZoom={1}
          imageMode="subject"
        />
        <div className="absolute inset-x-6 bottom-6 rounded-2xl bg-black/80 p-6 text-white backdrop-blur-sm">
          <p className="display text-xl leading-snug md:text-2xl">
            Closed weights. More black boxes.
            <br />
            <span className="text-brand">Open the model. Start measuring.</span>
          </p>
          <a
            href="https://commons.wikimedia.org/wiki/File:Masi_mara_sunset_and_giraffe_-_panoramio.jpg"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-[10px] text-white/60 hover:text-white"
          >
            Photo: LindaPatterson, CC BY-SA 3.0 (edited)
          </a>
        </div>
      </div>
    </div>
  );
}
