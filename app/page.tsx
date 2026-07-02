import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/homepage/Hero";
import { DashboardPreview } from "@/components/homepage/DashboardPreview";
import { SearchFeature } from "@/components/homepage/SearchFeature";
import { ApplyFeature } from "@/components/homepage/ApplyFeature";
import { Testimonial } from "@/components/homepage/Testimonial";
import { BottomCta } from "@/components/homepage/BottomCta";

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <DashboardPreview />
        <SearchFeature />
        <ApplyFeature />
        <Testimonial />
        <BottomCta />
      </main>
      <Footer />
    </>
  );
}
