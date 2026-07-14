import Navbar from "../components/landing/Navbar";
import Hero from "../components/landing/Hero";
import TrustedBy from "../components/landing/TrustedBy";
import PlatformDemo from "../components/landing/PlatformDemo";
import WhatWeOffer from "../components/landing/WhatWeOffer"; // 🌟 Imported cleanly right here!
import Toolkit from "../components/landing/Toolkit";
import Philosophy from "../components/landing/Philosophy";
import CTA from "../components/landing/CTA";
import Footer from "../components/landing/Footer";

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans selection:bg-emerald-100 selection:text-emerald-900 overflow-x-hidden">
      <Navbar />
      <Hero />
      <TrustedBy />
      <PlatformDemo />
      
      {/* 🌟 New Immersive 3D Scroll Section */}
      <WhatWeOffer /> 
      
      <Toolkit />
      <Philosophy />
      
      <Footer />
    </div>
  );
}