import Navbar from "../components/landing/Navbar";
import Hero from "../components/landing/Hero";
import RoleJourney from "../components/landing/RoleJourney";
import AssignmentFlow from "../components/landing/AssignmentFlow";
import AIApproach from "../components/landing/AIApproach";
import CTA from "../components/landing/CTA";
import Footer from "../components/landing/Footer";

export default function Landing() {
  return (
    <div className="min-h-[100dvh] overflow-x-hidden bg-[#F8FAFC] font-sans text-slate-900 selection:bg-blue-100 selection:text-blue-900">
      <Navbar />
      <Hero />
      <RoleJourney />
      <AssignmentFlow />
      <AIApproach />
      <CTA />
      <Footer />
    </div>
  );
}
