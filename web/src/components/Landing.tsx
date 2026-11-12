import CopyCommand from "@/components/CopyCommand";
import GoldParticleWave from "@/components/GoldParticleWave";
import BenchBars from "@/components/motion/BenchBars";
import CountUp from "@/components/motion/CountUp";
import LineageTree from "@/components/motion/LineageTree";
import NeuralNet from "@/components/motion/NeuralNet";
import TerminalDemo from "@/components/motion/TerminalDemo";
import WordFlip from "@/components/motion/WordFlip";
import { Logo } from "@/components/Navbar";
import Rich from "@/components/Rich";
import type { SiteContent } from "@/lib/content/defaults";
import type { MLModel } from "@/lib/types";

type WithContent = { content: SiteContent };

/** Placeholders available in landing copy */
function varsFor(content: SiteContent, models: MLModel[] = []) {
  const { site } = content;
  return {
    name: site.name,
    license: site.license,
    author: site.author,
    models: models.length,
    tasks: new Set(models.map((m) => m.task)).size,
    fineTunes: models.filter((m) => m.kind === "fine-tuned").length,
  };
}

const card =
  "rounded-2xl border border-line bg-surface bg-origin-border p-6 text-sm shadow-lg min-h-[300px] flex flex-col";
const pill =
  "mt-auto inline-flex w-fit justify-center rounded-full border border-line bg-surface-2 px-5 py-3 text-sm font-medium tracking-tight text-fg transition-colors hover:bg-ink";

/** "Built with" strip under the hero. */
export function StackStrip({ content }: WithContent) {
  const stack = content.landing.stack.items;
  return (
    <div className="mx-auto mt-12 w-full max-w-[1400px] px-6 md:px-12 lg:mt-16" data-reveal>
      <div className="flex flex-col items-center justify-center gap-5 lg:flex-row lg:gap-10">
        <p className="whitespace-nowrap text-xs uppercase tracking-[0.2em] text-muted">Runs on</p>
        <div className="relative w-full max-w-3xl overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
          <div className="flex w-max animate-[marquee_28s_linear_infinite] gap-12">
            {[...stack, ...stack].map((s, i) => (
              <span key={i} className="whitespace-nowrap font-mono text-lg text-fg/55 transition-opacity hover:text-fg">
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Centered display manifesto quote. */
export function Manifesto({ content }: WithContent) {
  const { site } = content;
  return (
    <div className="mx-auto mt-16 w-full max-w-[1100px] px-6 md:px-12 lg:mt-24" data-reveal>
      <hr className="mx-auto mb-10 w-32 border-t-2 border-fg/20 lg:mb-14 lg:w-40" />
      <blockquote className="text-center">
        <p className="display text-2xl leading-tight text-fg sm:text-3xl md:text-4xl xl:text-5xl">
          <Rich text={content.landing.manifesto.text} vars={varsFor(content)} />
        </p>
        <footer className="mt-6 flex items-center justify-center gap-2.5 text-sm text-muted">
          <Logo size={36} />
          <span>
            <span className="text-fg">{site.author}</span>, {site.authorRole}
          </span>
        </footer>
      </blockquote>
    </div>
  );
}

/** Dot-grid band with a terminal-styled description card. */
export function WhatIs({ models, content }: WithContent & { models: MLModel[] }) {
  const { site } = content;
  const copy = content.landing.whatIs;
  const vars = varsFor(content, models);
  return (
    <div className="mt-16 w-full bg-stone lg:mt-24">
      <div className="dot-bg glow-warm py-16 lg:py-24">
      <section className="mx-auto w-full max-w-[920px] px-6 md:px-12" data-reveal>
        <h2 className="display mb-10 text-center text-3xl md:text-4xl lg:mb-12 xl:text-5xl">
          <Rich text={copy.title} vars={vars} accent="text-brand" />
        </h2>
        <div className="overflow-hidden rounded-2xl border border-line bg-surface bg-gradient-to-br from-brand/20 via-transparent to-transparent shadow-lg">
          <div className="flex items-center gap-2 border-b border-fg/10 px-5 py-3 md:px-7">
            <span className="size-2.5 rounded-full bg-fg/15" />
            <span className="size-2.5 rounded-full bg-fg/15" />
            <span className="size-2.5 rounded-full bg-fg/15" />
            <span className="ml-3 font-mono text-xs tracking-wide text-muted">
              <span className="text-fg/40">&gt;_</span> /{site.name} --describe
            </span>
          </div>
          <div className="px-6 py-8 md:px-10 md:py-10">
            <p className="text-base leading-[1.7] text-fg/90 md:text-lg">
              <Rich text={copy.body} vars={vars} />
            </p>
            <p className="mt-8 font-mono text-xs tracking-wide text-muted">
              <span className="text-fg/40">{"//"}</span> <Rich text={copy.footnote} vars={vars} />
            </p>
          </div>
        </div>
      </section>
      </div>
    </div>
  );
}

/** Headline + dithered card with copyable command and a live typing terminal. */
export function TryItOut({ models, content }: WithContent & { models: MLModel[] }) {
  const copy = content.landing.tryIt;
  const vars = varsFor(content, models);
  const first = models.find((m) => m.task === "text-generation") ?? models[0];
  const modelId = first?.id ?? "your-username/model";
  return (
    <>
      <h2 className="display col-span-full text-center text-3xl leading-tight tracking-tight md:text-4xl xl:text-5xl" data-reveal>
        <Rich
          text={copy.title}
          vars={{ ...vars, words: <WordFlip words={copy.words} className="text-brand" /> }}
        />
      </h2>
      <div
        className="relative col-span-full flex min-h-[520px] flex-col items-center justify-center gap-6 overflow-hidden rounded-2xl p-6 md:p-10 lg:min-h-[560px] lg:gap-8"
        data-reveal
      >
        {/* Pixel-dither field; the elephant photo is re-drawn as particles */}
        <div className="absolute inset-0 -z-10 bg-[#2a1206]">
          <GoldParticleWave shape="square" bias="none" spacing={6} intensity={1.6} floor={0.32} speed={0.6}
            image={copy.image.src}
            imageFocus={[0.65, 0.78]}
            imageZoom={1.5}
          />
        </div>
        <div className="w-full max-w-[800px] rounded-2xl border border-line bg-surface p-2 text-fg shadow-lg">
          <div className="flex flex-col gap-2 sm:flex-row">
            <span className="self-start rounded-xl border-2 border-brand/50 px-2 py-1 text-center font-mono text-sm font-bold uppercase text-brand sm:self-auto sm:content-center sm:py-0">
              Try it out
            </span>
            <CopyCommand command={`huggingface-cli download ${modelId}`} />
          </div>
          <p className="mt-2 px-1 text-xs text-muted">
            <Rich text={copy.note} vars={vars} code="font-mono text-fg" />
          </p>
          <div className="mt-2">
            <TerminalDemo modelId={modelId} />
          </div>
        </div>
        {copy.image.credit && (
          <a
            href={copy.image.href || undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute bottom-3 right-4 rounded-full bg-black/50 px-2.5 py-1 text-[10px] text-white/70 backdrop-blur-sm hover:text-white"
          >
            Photo: {copy.image.credit}
          </a>
        )}
        <div className="w-full max-w-[800px] rounded-2xl bg-black/85 p-5 text-sm leading-relaxed text-white backdrop-blur-sm md:text-base lg:p-6">
          <p>
            <Rich text={copy.blurb} vars={vars} />
          </p>
        </div>
      </div>
    </>
  );
}

/** Four feature cards, each with its own motion graphic. */
export function Features({ models, content }: WithContent & { models: MLModel[] }) {
  const { site } = content;
  const vars = varsFor(content, models);
  const [f1, f2, f3, f4] = content.landing.features.items;
  const fineTunes = models.filter((m) => m.kind === "fine-tuned");
  const lineageBase =
    fineTunes.find((m) => fineTunes.filter((f) => f.baseModel === m.baseModel).length > 1)?.baseModel ??
    fineTunes[0]?.baseModel ??
    "base-model";
  const lineageKids = fineTunes.filter((m) => m.baseModel === lineageBase).map((m) => m.id.split("/").pop()!);
  const bars = models
    .flatMap((m) => (m.benchmarks ?? []).filter((b) => b.name === "MMLU").map((b) => ({ label: m.name, value: b.score })))
    .slice(0, 5);

  return (
    <>
      <blockquote className="col-span-full my-4 text-center lg:my-8" data-reveal>
        <p className="display text-2xl leading-tight text-fg md:text-3xl xl:text-4xl">
          <Rich text={content.landing.quote.text} vars={vars} />
        </p>
        <footer className="mt-3 text-sm text-muted">— {site.author}</footer>
      </blockquote>

      <div className={`${card} relative z-[2] overflow-hidden`} data-reveal>
        <h3 className="display mb-6 text-2xl tracking-tight lg:text-3xl">{f1.title}</h3>
        <p className="mb-6 max-w-md text-soft">
          <Rich text={f1.body} vars={vars} />
        </p>
        <NeuralNet className="mt-auto h-56 w-full" />
      </div>

      <div className={`${card} bg-gradient-to-bl from-brand/15 via-transparent to-transparent`} data-reveal style={{ ["--reveal-delay" as string]: "120ms" }}>
        <h3 className="display mb-6 text-2xl tracking-tight lg:text-3xl">{f2.title}</h3>
        <p className="mb-4 text-soft">
          <Rich text={f2.body} vars={vars} />
        </p>
        <LineageTree base={lineageBase} branches={lineageKids.length ? lineageKids : ["your-fine-tune"]} className="mb-6 w-full max-w-sm" />
        {f2.cta && (
          <a href="#fine-tuned" className={pill}>
            {f2.cta}
          </a>
        )}
      </div>

      <div className={`${card} bg-gradient-to-tr from-brand/15 via-transparent to-transparent`} data-reveal>
        <h3 className="display mb-6 text-2xl tracking-tight lg:text-3xl">{f3.title}</h3>
        <p className="mb-6 text-soft">
          <Rich text={f3.body} vars={vars} />
        </p>
        {bars.length > 1 && <BenchBars items={bars} className="mb-6" />}
        {f3.cta && (
          <a href="#leaderboard" className={pill}>
            {f3.cta}
          </a>
        )}
      </div>

      <div className={`${card} bg-gradient-to-br from-brand/15 via-transparent to-transparent`} data-reveal style={{ ["--reveal-delay" as string]: "120ms" }}>
        <h3 className="display mb-6 text-2xl tracking-tight lg:text-3xl">{f4.title}</h3>
        <p className="mb-6 text-soft">
          <Rich text={f4.body} vars={vars} />
        </p>
        <pre className="mb-6 overflow-x-auto rounded-xl border border-line bg-black/50 p-4 font-mono text-xs leading-relaxed text-muted">
          <span className="text-olive">+</span> {"{"} id: <span className="text-gold-300">&quot;you/your-model&quot;</span>, kind:{" "}
          <span className="text-gold-300">&quot;fine-tuned&quot;</span> {"}"}
          {"\n"}
          <span className="text-brand">$</span> git commit -m <span className="text-gold-300">&quot;add your-model&quot;</span>
        </pre>
        {f4.cta && (
          <a href={site.githubUrl} target="_blank" rel="noopener" className={pill}>
            {f4.cta}
          </a>
        )}
      </div>
    </>
  );
}

/** Big open-source call-out with animated stats. */
export function OpenSource({ models, content }: WithContent & { models: MLModel[] }) {
  const { site } = content;
  const copy = content.landing.openSource;
  const downloads = models.reduce((s, m) => s + m.downloads, 0);
  const likes = models.reduce((s, m) => s + m.likes, 0);
  const authors = [...new Set(models.map((m) => m.author))];
  return (
    <div className="col-span-full mt-16 flex flex-col items-center gap-6 rounded-3xl bg-[radial-gradient(50%_70%_at_50%_0%,rgb(240_122_42/0.16),transparent_75%)] py-12 text-center lg:mt-24 lg:py-16" data-reveal>
      <h2 className="display text-4xl tracking-tight text-brand lg:text-5xl">
        <a href={site.githubUrl} target="_blank" rel="noopener" className="transition-colors hover:text-brand-hover">
          {copy.title}
        </a>
      </h2>
      <p className="display flex flex-wrap items-center justify-center gap-x-3 text-2xl tracking-tight text-fg/60 md:text-3xl">
        <span>
          <CountUp value={models.length} /> models
        </span>
        <span aria-hidden="true" className="text-fg/25">·</span>
        <span>
          <CountUp value={downloads} compact /> downloads
        </span>
        <span aria-hidden="true" className="text-fg/25">·</span>
        <span>
          <CountUp value={likes} compact /> likes
        </span>
      </p>
      <p className="max-w-2xl text-base leading-relaxed text-muted lg:text-lg">
        <Rich text={copy.body} vars={varsFor(content, models)} accent="font-medium text-fg" />
      </p>
      <div className="mt-2 flex flex-row flex-wrap items-center justify-center">
        {authors.slice(0, 12).map((a, i) => (
          <span
            key={a}
            title={a}
            className="display -mr-3 grid size-10 place-items-center rounded-full border-4 border-ink bg-gradient-to-br from-gold-300 to-brand text-lg text-brand-fg md:size-12"
            style={{ zIndex: 20 - i }}
          >
            {a[0]?.toUpperCase()}
          </span>
        ))}
      </div>
      <a href={site.githubUrl} target="_blank" rel="noopener" className="text-sm text-muted hover:text-fg hover:underline">
        {copy.cta}
      </a>
    </div>
  );
}

export function Faq({ content }: WithContent) {
  const items = content.landing.faq.items;
  const vars = varsFor(content);
  return (
    <section id="faq" className="mx-auto mt-16 w-full max-w-[1100px] scroll-mt-24 px-6 md:px-12 lg:mt-24" data-reveal>
      <h2 className="display mb-10 text-center text-3xl tracking-tight md:text-4xl lg:mb-14 lg:text-5xl">Frequently asked</h2>
      <dl className="space-y-8 lg:space-y-10">
        {items.map((f) => (
          <div key={f.q}>
            <dt className="mb-2 text-lg font-medium text-fg lg:text-xl">{f.q}</dt>
            <dd className="leading-relaxed text-fg/80">
              <Rich text={f.a} vars={vars} />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
