import { fetchJobApplicationsForRecruiter, fetchProfileAction } from "@/actions";
import CandidateList from "@/components/candidate-list";
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

  return (
    <CandidateList
      jobApplications={jobApplications}
      currentCandidateDetails={null}
      showCurrentCandidateDetailsModal={false}
      setCurrentCandidateDetails={() => {}}
      setShowCurrentCandidateDetailsModal={() => {}}
    />
  );
}

export default CandidatesPage;
