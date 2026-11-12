import Dashboard from "@/components/Dashboard";
import Footer from "@/components/Footer";
import Hero from "@/components/Hero";
import { Faq, Features, Manifesto, OpenSource, StackStrip, TryItOut, WhatIs } from "@/components/Landing";
import RevealObserver from "@/components/motion/RevealObserver";
import Navbar from "@/components/Navbar";
import { MemberProvider } from "@/components/MemberProvider";
import { SiteContentProvider } from "@/components/SiteContentProvider";
import { getSiteContent } from "@/lib/content";
import { getHub } from "@/lib/hub";

export default async function Home() {
  const [hub, content] = await Promise.all([getHub(), getSiteContent()]);
  const { models } = hub;

  return (
    <SiteContentProvider value={content}>
      <MemberProvider>
      <Navbar />
      <main className="flex flex-col px-4">
        <Hero hub={hub} content={content} />
        <StackStrip content={content} />
        <Manifesto content={content} />
      </main>
      <WhatIs models={models} content={content} />
      <div className="mx-auto mt-16 grid w-full max-w-[1400px] grid-cols-1 gap-10 px-6 md:px-12 lg:mt-24 lg:grid-cols-2">
        <TryItOut models={models} content={content} />
        <Features models={models} content={content} />
      </div>
      <Dashboard hub={hub} />
      <div className="mx-auto grid w-full max-w-[1400px] px-6 md:px-12">
        <OpenSource models={models} content={content} />
      </div>
      <Faq content={content} />
      <Footer content={content} />
      <RevealObserver />
      </MemberProvider>
    </SiteContentProvider>
  );
}
