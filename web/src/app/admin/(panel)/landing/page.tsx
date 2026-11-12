import SiteDocEditor from "@/components/admin/SiteDocEditor";
import { PageHeader } from "@/components/admin/ui";
import { getSiteAdmin } from "@/lib/admin/data";
import { LANDING_BLOCKS } from "@/lib/admin/siteSchema";

export const metadata = { title: "Landing copy" };

export default async function LandingPage() {
  const { values } = await getSiteAdmin();
  return (
    <div className="grid gap-6 xl:grid-cols-[12rem_minmax(0,1fr)]">
      <div className="xl:col-span-2">
        <PageHeader
          eyebrow="Site"
          title="Landing copy"
          description={
            <>
              Text and images on the home page, in page order. Each block saves on its own. In text fields:{" "}
              <code className="font-mono text-brand">*orange*</code>, <code className="font-mono">_dim_</code>,{" "}
              <code className="font-mono">~underlined~</code>, <code className="font-mono">`code`</code>, a new line for a
              line break, and placeholders like <code className="font-mono">{"{name}"}</code>.
            </>
          }
        />
      </div>
      <nav aria-label="Blocks" className="hidden xl:block">
        <ul className="sticky top-6 space-y-0.5 text-sm">
          {LANDING_BLOCKS.map((b) => (
            <li key={b.key}>
              <a href={`#${b.key}`} className="block rounded-lg px-3 py-1.5 text-muted hover:bg-fg/5 hover:text-fg">
                {b.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="min-w-0 space-y-6">
        {LANDING_BLOCKS.map((b) => (
          <SiteDocEditor key={b.key} block={b} doc={values[b.key]} />
        ))}
      </div>
    </div>
  );
}
