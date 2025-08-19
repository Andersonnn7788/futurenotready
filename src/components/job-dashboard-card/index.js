"use client";

import React, { useState } from 'react';
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Eye, Edit2, Trash2, MoreVertical, CheckCircle, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteJob, updateJobStatus } from "@/actions";
import { toast } from "../ui/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "../ui/dropdown-menu";

function JobDashboardCard({ job }) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  
  // Format date to DD/MM/YYYY
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "N/A";
      return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
    } catch (error) {
      console.error("Date parsing error:", error);
      return "N/A";
    }
  };
  
  // Function to handle job deletion
  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      const result = await deleteJob(job._id);
      
      if (result.success) {
        toast({
          title: "Success",
          description: "Job deleted successfully",
        });
        router.refresh(); // Refresh the page to update the job list
      } else {
        toast({
          title: "Error",
          description: result.message || "Failed to delete job",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
      console.error("Error deleting job:", error);
    } finally {
      setIsDeleting(false);
    }
  };
  
  // Function to handle job status update
  const handleStatusUpdate = async (newStatus) => {
    try {
      setIsUpdatingStatus(true);
      const result = await updateJobStatus(job._id, newStatus);
      
      if (result.success) {
        toast({
          title: "Success",
          description: `Job ${newStatus === 'active' ? 'activated' : 'closed'} successfully`,
        });
        router.refresh(); // Refresh the page to update the job list
      } else {
        toast({
          title: "Error",
          description: result.message || `Failed to ${newStatus === 'active' ? 'activate' : 'close'} job`,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
      console.error("Error updating job status:", error);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  return (
    <Card className="p-6 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-xl font-semibold">{job.title}</h3>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="text-gray-500 hover:text-gray-700">
              <span className="sr-only">Options</span>
              <MoreVertical className="h-5 w-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem 
              className="flex items-center cursor-pointer"
              onClick={() => router.push(`/jobs/${job._id}`)}
            >
              <Eye className="mr-2 h-4 w-4" />
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem 
              className="flex items-center cursor-pointer"
              onClick={() => router.push(`/jobs/edit/${job._id}`)}
            >
              <Edit2 className="mr-2 h-4 w-4" />
              Edit Job
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {job.status === 'active' ? (
              <DropdownMenuItem 
                className="flex items-center cursor-pointer text-amber-600 focus:text-amber-600"
                onClick={() => handleStatusUpdate('closed')}
                disabled={isUpdatingStatus}
              >
                <XCircle className="mr-2 h-4 w-4" />
                {isUpdatingStatus ? "Updating..." : "Close Job"}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem 
                className="flex items-center cursor-pointer text-green-600 focus:text-green-600"
                onClick={() => handleStatusUpdate('active')}
                disabled={isUpdatingStatus}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                {isUpdatingStatus ? "Updating..." : "Activate Job"}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              className="flex items-center cursor-pointer text-red-600 focus:text-red-600"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {isDeleting ? "Deleting..." : "Delete Job"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      <div className="flex items-center mb-4">
        <span className={`${
          job.status === 'active' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
        } text-xs font-medium px-2.5 py-0.5 rounded-full`}>
          {job.status || 'active'}
        </span>
        <span className="ml-2 text-sm text-gray-500">{job.postedDate ? formatDate(job.postedDate) : formatDate(job.createdAt)}</span>
      </div>
      
      <p className="text-gray-600 mb-5">{job.description}</p>
      
      <div className="mb-5">
        <h4 className="text-sm text-gray-500 uppercase font-medium mb-2">REQUIRED SKILLS</h4>
        <div className="flex flex-wrap gap-2">
          {job.skills && job.skills.split(',').map((skill, index) => (
            <span key={index} className="bg-gray-100 text-gray-800 text-sm px-2.5 py-0.5 rounded">{skill.trim()}</span>
          ))}
          {job.skills && job.skills.split(',').length > 2 && (
            <span className="bg-gray-100 text-gray-800 text-sm px-2.5 py-0.5 rounded">+{job.skills.split(',').length - 2} more</span>
          )}
        </div>
      </div>
      
      <div className="flex items-center justify-between text-sm text-gray-500 mb-5">
        <div className="flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
          {job.applicants ? job.applicants.length : 0} candidates
        </div>
        <div className="flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
          </svg>
          {job.interviews ? job.interviews : 0} interviews
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        <Link href={`/jobs/${job._id}`} passHref>
          <Button variant="outline" className="flex items-center justify-center w-full">
            <Eye className="mr-2 h-4 w-4" />
            View
          </Button>
        </Link>
        <Link href={`/jobs/edit/${job._id}`} passHref>
          <Button variant="outline" className="flex items-center justify-center w-full">
            <Edit2 className="mr-2 h-4 w-4" />
            Edit
          </Button>
        </Link>
      </div>
    </Card>
  );
}

export default JobDashboardCard;
