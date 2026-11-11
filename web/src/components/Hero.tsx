import HeroScenes from "@/components/HeroScenes";
import TrainingMonitor from "@/components/motion/TrainingMonitor";
import { GitHubIcon } from "@/components/Navbar";
import { SECTIONS, href } from "@/config/sections";
import { site } from "@/config/site";
import { formatCompact } from "@/lib/format";
import type { Hub } from "@/lib/types";

export default function Hero({ hub }: { hub: Hub }) {
  const { models, libraries, datasets, demos } = hub;
  const downloads = models.reduce((s, m) => s + m.downloads, 0);

  return (
    <section className="relative mx-auto mt-4 flex h-[70vh] max-h-[900px] min-h-[620px] w-full max-w-[1400px] overflow-hidden rounded-2xl border border-line bg-ink">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_60%_at_0%_100%,rgb(240_122_42/0.18),transparent_70%)]" />
      <HeroScenes />

      {/* Live "product shot": slides in, faded on its left edge like the reference screenshot */}
      <div className="pointer-events-none absolute left-[28%] top-[56%] animate-fade-in-delayed [mask-image:linear-gradient(to_right,transparent_0%,black_10%)] max-md:left-[6%] max-md:top-[calc(60%+40px)]">
        <TrainingMonitor models={models} />
      </div>

      <div className="relative z-10 flex size-full flex-col px-4 md:p-12 max-md:items-center max-md:text-center">
        <p className="display mb-6 mt-12 text-[40px] leading-[1.05] md:text-5xl xl:mb-8 xl:text-[64px]">
          <span className="block text-muted">
            <span className="inline-block">Closed weights.</span>{" "}
            <span className="inline-block">
              More <span>black boxes</span>.
            </span>
          </span>
          <span className="block max-md:mt-[0.25em]">
            <span className="inline-block text-olive">Open the model.</span>{" "}
            <span className="inline-block text-fg">
              Start <span className="text-brand">measuring</span>.
            </span>
          </span>
        </p>
        <h1 className="text-shadow-hero mb-8 max-w-xl text-base font-normal text-soft md:text-lg">
          {site.name}: an open-source hub for my checkpoints, toolkit, corpus and playground.
          <br />
          Weights, training data, code and benchmarks, all public.
          <br />
          Pick a model, read its evals, <span className="inline-block">pull it in one line.</span>
        </h1>
        <div className="flex w-fit flex-row flex-wrap items-center gap-4">
          <a
            href={href("model")}
            className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-3 font-medium tracking-tight text-brand-fg transition-colors hover:bg-brand-hover max-sm:text-sm"
          >
            Browse checkpoints
            <span aria-hidden="true" className="inline-block h-[1em] w-[0.35em] animate-cursor bg-current align-middle" />
          </a>
          <a
            href={site.githubUrl}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-2 rounded-full border border-line bg-surface-2 px-5 py-3 font-medium tracking-tight text-fg transition-colors hover:bg-surface max-sm:text-sm"
          >
            <GitHubIcon className="size-4" />
            <span>
              Star<span className="max-sm:hidden"> on GitHub</span>
            </span>
          </a>
        </div>
        <p className="text-shadow-hero mt-3 w-fit text-sm text-olive">
          {SECTIONS.model.label} {models.length} · {SECTIONS.demo.label} {demos.length} · {SECTIONS.dataset.label}{" "}
          {datasets.length} · {SECTIONS.library.label} {libraries.length} · {formatCompact(downloads)} downloads
        </p>
      </div>
    </section>
  );
}
