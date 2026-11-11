import { Logo } from "@/components/Navbar";
import { site } from "@/config/site";

export default function Footer() {
  return (
    <footer className="glow-warm mt-24 border-t border-line">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-4 px-6 py-10 text-sm text-muted sm:flex-row sm:items-center sm:justify-between md:px-12">
        <span className="inline-flex items-center gap-2.5">
          <Logo size={26} />
          <span className="display text-xl text-fg">{site.name}</span>
        </span>
        <p>
          {site.license}-licensed. Weights are distributed under each model&apos;s own license.
        </p>
        <a href={site.githubUrl} target="_blank" rel="noopener" className="hover:text-fg">
          GitHub ↗
        </a>
      </div>
    </footer>
  );
}
