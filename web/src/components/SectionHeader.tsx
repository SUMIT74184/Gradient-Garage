export default function SectionHeader({
  eyebrow,
  title,
  accent,
  description,
}: {
  eyebrow: string;
  title: string;
  /** Trailing words rendered in the brand color */
  accent?: string;
  description?: string;
}) {
  return (
    <div className="text-center" data-reveal>
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        <span className="text-brand">{"//"}</span> {eyebrow}
      </p>
      <h2 className="display mt-3 text-3xl tracking-tight md:text-4xl lg:text-5xl">
        {title} {accent && <span className="text-brand">{accent}</span>}
      </h2>
      {description && <p className="mx-auto mt-4 max-w-xl text-muted">{description}</p>}
    </div>
  );
}
