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
  
  return (
    <div className="mx-auto max-w-4xl py-10">
      <h1 className="text-3xl font-bold mb-8">Post a New Job</h1>
      <JobPostingForm user={user} profileInfo={profileInfo} />
    </div>
  );
}

export default PostNewJobPage;
