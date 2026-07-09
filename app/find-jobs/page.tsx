import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { FindJobsClient } from "@/components/find-jobs/FindJobsClient";

export default function FindJobsPage() {
  return (
    <>
      <Navbar />
      <FindJobsClient />
      <Footer />
    </>
  );
}
