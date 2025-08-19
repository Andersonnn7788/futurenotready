import React from 'react';
import { currentUser } from "@clerk/nextjs";
import { fetchProfileAction } from "@/actions";
import { redirect } from "next/navigation";
import connectToDB from "@/database";
import Job from "@/models/job";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Card } from "@/components/ui/card";

export async function generateMetadata({ params }) {
  const { id } = params;
  await connectToDB();
  const job = await Job.findById(id);
  
  return {
    title: job ? `${job.title || "Job Details"} | TalentMatch` : "Job Details | TalentMatch",
  };
}

async function JobDetailsPage({ params }) {
  const { id } = params;
  const user = await currentUser();
  
  if (!user) {
    redirect("/sign-in");
  }

  const profileInfo = await fetchProfileAction(user?.id);
  
  if (!profileInfo) {
    redirect("/onboard");
  }
  
  // Fetch the job details
  await connectToDB();
  const jobDoc = await Job.findById(id);
  
  if (!jobDoc) {
    redirect(profileInfo.role === "recruiter" ? "/dashboard/jobs" : "/jobs");
  }
  
  // Convert MongoDB document to plain object
  const job = {
    _id: jobDoc._id.toString(),
    title: jobDoc.title || "",
    companyName: jobDoc.companyName || "",
    location: jobDoc.location || "",
    type: jobDoc.type || "",
    experience: jobDoc.experience || "",
    description: jobDoc.description || "",
    skills: jobDoc.skills || "",
    status: jobDoc.status || "active",
    recruiterId: jobDoc.recruiterId || "",
    postedDate: jobDoc.postedDate ? jobDoc.postedDate.toISOString() : null,
    createdAt: jobDoc.createdAt ? jobDoc.createdAt.toISOString() : null,
    updatedAt: jobDoc.updatedAt ? jobDoc.updatedAt.toISOString() : null,
    applicants: jobDoc.applicants ? jobDoc.applicants.map(a => ({
      name: a.name || "",
      email: a.email || "",
      userId: a.userId || "",
      status: a.status || ""
    })) : []
  };
  
  // Format date to readable format
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "N/A";
      
      const now = new Date();
      const diffTime = Math.abs(now - date);
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) {
        return "today";
      } else if (diffDays === 1) {
        return "yesterday";
      } else if (diffDays < 7) {
        return `${diffDays} days ago`;
      } else if (diffDays < 30) {
        const weeks = Math.floor(diffDays / 7);
        return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
      } else if (diffDays < 365) {
        const months = Math.floor(diffDays / 30);
        return `${months} ${months === 1 ? 'month' : 'months'} ago`;
      } else {
        const years = Math.floor(diffDays / 365);
        return `${years} ${years === 1 ? 'year' : 'years'} ago`;
      }
    } catch (error) {
      console.error("Date parsing error:", error);
      return "N/A";
    }
  };

  const isRecruiter = profileInfo.role === "recruiter";
  const isJobOwner = isRecruiter && job.recruiterId === user.id;

  return (
    <div className="mx-auto max-w-4xl py-12 px-4">
      <div className="mb-6 flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold">{job.title}</h1>
            <span className={`${
              job.status === 'active' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
            } text-xs font-medium px-2.5 py-0.5 rounded-full`}>
              {job.status || 'active'}
            </span>
          </div>
          <div className="text-gray-600">
            <p>{job.companyName} • {job.location}</p>
            <p className="text-sm mt-1">Posted {formatDate(job.postedDate || job.createdAt)}</p>
          </div>
        </div>
        
        {isJobOwner && (
          <div className="flex gap-3">
            <Link href={`/jobs/edit/${job._id}`}>
              <Button variant="outline">Edit Job</Button>
            </Link>
            <Link href="/dashboard/jobs">
              <Button variant="outline">Back to Dashboard</Button>
            </Link>
          </div>
        )}
        
        {!isJobOwner && (
          <Link href={isRecruiter ? "/dashboard/jobs" : "/jobs"}>
            <Button variant="outline">Back to Jobs</Button>
          </Link>
        )}
      </div>
      
      <Card className="p-6 mb-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 mb-8">
          <div>
            <h3 className="text-sm font-medium text-gray-500 uppercase">Job Type</h3>
            <p className="mt-1">{job.type}</p>
          </div>
          
          <div>
            <h3 className="text-sm font-medium text-gray-500 uppercase">Experience Level</h3>
            <p className="mt-1">{job.experience}</p>
          </div>
        </div>
        
        <div className="mb-8">
          <h3 className="text-sm font-medium text-gray-500 uppercase mb-3">Required Skills</h3>
          <div className="flex flex-wrap gap-2">
            {job.skills && job.skills.split(',').map((skill, index) => (
              <span key={index} className="bg-gray-100 text-gray-800 text-sm px-2.5 py-0.5 rounded">{skill.trim()}</span>
            ))}
          </div>
        </div>
        
        <div>
          <h3 className="text-sm font-medium text-gray-500 uppercase mb-3">Job Description</h3>
          <div className="prose max-w-none">
            <p className="whitespace-pre-line">{job.description}</p>
          </div>
        </div>
      </Card>
      
      {profileInfo.role === "candidate" && job.status === "active" && (
        <div className="text-center">
          <Button size="lg">Apply for this Position</Button>
        </div>
      )}
    </div>
  );
}

export default JobDetailsPage;
