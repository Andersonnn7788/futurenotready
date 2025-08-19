import { fetchJobApplicationsForRecruiter, fetchProfileAction } from "@/actions";
import CandidatesPageClient from "./CandidatesPageClient.js";
import { currentUser } from "@clerk/nextjs";
import { redirect } from "next/navigation";

async function CandidatesPage() {
  const user = await currentUser();
  
  if (!user) {
    redirect("/sign-in");
  }
  
  const profileInfo = await fetchProfileAction(user?.id);

  if (!profileInfo) {
    redirect("/onboard");
  }
  
  // Verify the user is a recruiter
  if (profileInfo.role !== "recruiter") {
    redirect("/");
  }
  
  const jobApplications = await fetchJobApplicationsForRecruiter(user?.id);

  return <CandidatesPageClient jobApplications={jobApplications} />;
}

export default CandidatesPage;
