import React from 'react';
import { currentUser } from "@clerk/nextjs";
import { fetchProfileAction } from "@/actions";
import { redirect } from "next/navigation";
import EditJobForm from "@/components/edit-job-form";
import connectToDB from "@/database";
import Job from "@/models/job";

export async function generateMetadata({ params }) {
  return {
    title: "Edit Job | TalentMatch",
  };
}

async function EditJobPage({ params }) {
  const { id } = params;
  const user = await currentUser();
  
  if (!user) {
    redirect("/sign-in");
  }

  const profileInfo = await fetchProfileAction(user?.id);
  
  if (!profileInfo) {
    redirect("/onboard");
  }
  
  if (profileInfo.role !== "recruiter") {
    redirect("/");
  }
  
  // Fetch the job details
  await connectToDB();
  const jobDoc = await Job.findById(id);
  
  if (!jobDoc) {
    redirect("/dashboard/jobs");
  }
  
  // Verify that the current user is the owner of this job
  if (jobDoc.recruiterId !== user.id) {
    redirect("/dashboard/jobs");
  }
  
  // Convert MongoDB document to plain object and prepare for form
  const jobData = {
    _id: jobDoc._id.toString(),
    title: jobDoc.title || "",
    companyName: jobDoc.companyName || "",
    location: jobDoc.location || "",
    type: jobDoc.type || "",
    experience: jobDoc.experience || "",
    description: jobDoc.description || "",
    skills: jobDoc.skills || "",
    status: jobDoc.status || "active"
  };

  return (
    <div className="mx-auto max-w-4xl py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Edit Job</h1>
        <p className="text-gray-600 mt-2">Update your job posting information</p>
      </div>
      
      <EditJobForm job={jobData} userId={user.id} />
    </div>
  );
}

export default EditJobPage;
