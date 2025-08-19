import { currentUser } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { fetchProfileAction } from "@/actions";
import JobPostingForm from "@/components/job-posting-form";

async function PostNewJobPage() {
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
  
  // Extract only the necessary data from the user and profileInfo objects
  const userData = {
    id: user.id,
    email: user.emailAddresses[0]?.emailAddress
  };
  
  // Extract only the necessary data from profileInfo
  const profileData = {
    recruiterInfo: {
      companyName: profileInfo.recruiterInfo?.companyName || ""
    }
  };
  
  return (
    <div className="mx-auto max-w-4xl py-10">
      <h1 className="text-3xl font-bold mb-8">Post a New Job</h1>
      <JobPostingForm user={userData} profileInfo={profileData} />
    </div>
  );
}

export default PostNewJobPage;
