import HeroScenes from "@/components/HeroScenes";
import TrainingMonitor from "@/components/motion/TrainingMonitor";
import { GitHubIcon } from "@/components/Navbar";
import Rich from "@/components/Rich";
import { href } from "@/config/sections";
import type { SiteContent } from "@/lib/content/defaults";
import { formatCompact } from "@/lib/format";
import type { Hub } from "@/lib/types";

export default function Hero({ hub, content }: { hub: Hub; content: SiteContent }) {
  const { models, libraries, datasets, demos } = hub;
  const { site, sections: S } = content;
  const copy = content.landing.hero;
  const vars = { name: site.name, license: site.license, author: site.author };
  const downloads = models.reduce((s, m) => s + m.downloads, 0);

  return (
    <section className="relative mx-auto mt-4 flex h-[70vh] max-h-[900px] min-h-[620px] w-full max-w-[1400px] overflow-hidden rounded-2xl border border-line bg-ink">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_60%_at_0%_100%,rgb(240_122_42/0.18),transparent_70%)]" />
      <HeroScenes scenes={copy.scenes} />

      {/* Live "product shot": slides in, faded on its left edge like the reference screenshot */}
      <div className="pointer-events-none absolute left-[28%] top-[56%] animate-fade-in-delayed [mask-image:linear-gradient(to_right,transparent_0%,black_10%)] max-md:left-[6%] max-md:top-[calc(60%+40px)]">
        <TrainingMonitor models={models} />
      </div>

      <div className="relative z-10 flex size-full flex-col px-4 md:p-12 max-md:items-center max-md:text-center">
        <p className="display mb-6 mt-12 text-[40px] leading-[1.05] md:text-5xl xl:mb-8 xl:text-[64px]">
          <span className="block text-muted">
            <Rich text={copy.headlineTop} vars={vars} dim="text-muted" />
          </span>
          <span className="block text-fg max-md:mt-[0.25em]">
            <Rich text={copy.headlineBottom} vars={vars} dim="text-olive" />
          </span>
        </p>
        <h1 className="text-shadow-hero mb-8 max-w-xl text-base font-normal text-soft md:text-lg">
          <Rich text={copy.subtitle} vars={vars} />
        </h1>
        <div className="flex w-fit flex-row flex-wrap items-center gap-4">
          <a
            href={href("model")}
            className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-3 font-medium tracking-tight text-brand-fg transition-colors hover:bg-brand-hover max-sm:text-sm"
          >
            {copy.primaryCta}
            <span aria-hidden="true" className="inline-block h-[1em] w-[0.35em] animate-cursor bg-current align-middle" />
          </a>
          <a
            href={site.githubUrl}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-2 rounded-full border border-line bg-surface-2 px-5 py-3 font-medium tracking-tight text-fg transition-colors hover:bg-surface max-sm:text-sm"
          >
            <GitHubIcon className="size-4" />
            <span>{copy.secondaryCta}</span>
          </a>
        </div>
        <p className="text-shadow-hero mt-3 w-fit text-sm text-olive">
          {S.model.label} {models.length} · {S.demo.label} {demos.length} · {S.dataset.label} {datasets.length} ·{" "}
          {S.library.label} {libraries.length} · {formatCompact(downloads)} downloads
        </p>
      </div>
    </section>
  );
}
