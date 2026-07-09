import { notFound } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { createInsforgeServer } from "@/lib/insforge-server";
import { JobDetailsClient } from "@/components/job-details/JobDetailsClient";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function JobDetailsPage({ params }: PageProps) {
  const { id } = await params;
  const insforge = await createInsforgeServer();

  const { data: job, error } = await insforge.database
    .from("jobs")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !job) {
    notFound();
  }

  return (
    <>
      <Navbar />
      <JobDetailsClient job={job} />
      <Footer />
    </>
  );
}
