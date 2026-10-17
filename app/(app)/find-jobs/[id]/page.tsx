import { notFound } from "next/navigation";
import { createInsforgeServer } from "@/lib/insforge-server";
import { JobDetailsClient } from "@/components/job-details/JobDetailsClient";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function JobDetailsPage({ params }: PageProps) {
  const { id } = await params;
  const insforge = await createInsforgeServer();

  const { data: authData } = await insforge.auth.getCurrentUser();
  const userId = authData?.user?.id;
  if (!userId) notFound();

  // Scope to the signed-in user so one user can never load another's job by id.
  const { data: job, error } = await insforge.database
    .from("jobs")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error || !job) {
    notFound();
  }

  return <JobDetailsClient job={job} />;
}
