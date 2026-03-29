import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Hero from "@/components/landing/Hero";
import FeatureGrid from "@/components/landing/FeatureGrid";
import PayoutPipeline from "@/components/landing/PayoutPipeline";
import ComplianceHighlight from "@/components/landing/ComplianceHighlight";
import WhySolana from "@/components/landing/WhySolana";
import FinalCTA from "@/components/landing/FinalCTA";

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="pt-24">
        <Hero />
        <FeatureGrid />
        <PayoutPipeline />
        <ComplianceHighlight />
        <WhySolana />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
