"use client";

import { useState } from "react";
import { Button } from "../ui/button";
import JobDashboardCard from "../job-dashboard-card";
import Link from "next/link";
import { Plus } from "lucide-react";

function RecruiterDashboard({ jobsList, jobApplications = [] }) {
  const [filter, setFilter] = useState("all"); // all, active, closed
  
  // Filter jobs based on status
  const filteredJobs = jobsList.filter(job => {
    if (filter === "all") return true;
    return job.status === filter;
  });

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex items-baseline justify-between border-b pb-6 pt-24">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900">
          Manage Job Listings
        </h1>
        <div className="flex items-center">
          <Link href="/dashboard/jobs/post-new-job">
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Post New Job
            </Button>
          </Link>
        </div>
      </div>
      
      <div className="py-6">
        <div className="flex gap-4 mb-6">
          <Button 
            variant={filter === "all" ? "default" : "outline"} 
            onClick={() => setFilter("all")}
          >
            All Jobs
          </Button>
          <Button 
            variant={filter === "active" ? "default" : "outline"} 
            onClick={() => setFilter("active")}
          >
            Active
          </Button>
          <Button 
            variant={filter === "closed" ? "default" : "outline"} 
            onClick={() => setFilter("closed")}
          >
            Closed
          </Button>
        </div>
        
        {filteredJobs.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredJobs.map((job) => (
              <JobDashboardCard 
                key={job._id} 
                job={{
                  ...job,
                  applicants: jobApplications.filter(item => item.jobID === job._id),
                  interviews: jobApplications.filter(item => item.jobID === job._id && item.status === 'Interviewing').length
                }} 
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-10">
            <h2 className="text-2xl font-semibold mb-2">No jobs found</h2>
            <p className="text-gray-500 mb-6">
              {filter === "all" 
                ? "You haven't posted any jobs yet." 
                : `You don't have any ${filter} jobs.`}
            </p>
            <Link href="/dashboard/jobs/post-new-job">
              <Button>Post Your First Job</Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default RecruiterDashboard;
