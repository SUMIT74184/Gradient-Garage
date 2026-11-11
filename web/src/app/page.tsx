import Dashboard from "@/components/Dashboard";
import Footer from "@/components/Footer";
import Hero from "@/components/Hero";
import { Faq, Features, Manifesto, OpenSource, StackStrip, TryItOut, WhatIs } from "@/components/Landing";
import RevealObserver from "@/components/motion/RevealObserver";
import Navbar from "@/components/Navbar";
import { getHub } from "@/lib/hub";

export default async function Home() {
  const hub = await getHub();
  const { models } = hub;

  return (
    <>
      <Navbar />
      <main className="flex flex-col px-4">
        <Hero hub={hub} />
        <StackStrip />
        <Manifesto />
      </main>
      <WhatIs models={models} />
      <div className="mx-auto mt-16 grid w-full max-w-[1400px] grid-cols-1 gap-10 px-6 md:px-12 lg:mt-24 lg:grid-cols-2">
        <TryItOut models={models} />
        <Features models={models} />
      </div>
      <Dashboard hub={hub} />
      <div className="mx-auto grid w-full max-w-[1400px] px-6 md:px-12">
        <OpenSource models={models} />
      </div>
      <Faq />
      <Footer />
      <RevealObserver />
    </>
  );
}
