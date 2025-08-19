"use server";

import { connectToDatabase } from "@/database";
import Job from "@/models/job";
import { revalidatePath } from "next/cache";

export const deleteJob = async (jobId) => {
  try {
    await connectToDatabase();
    const deletedJob = await Job.findByIdAndDelete(jobId);
    
    if (!deletedJob) {
      return { success: false, message: "Job not found" };
    }

    // Revalidate the companies page to show updated job listings
    revalidatePath("/companies");
    revalidatePath("/dashboard/jobs");
    
    return { success: true, message: "Job deleted successfully" };
  } catch (error) {
    console.error("Error deleting job:", error);
    return { success: false, message: "Failed to delete job" };
  }
};

export const updateJobStatus = async (jobId, status) => {
  try {
    await connectToDatabase();
    const updatedJob = await Job.findByIdAndUpdate(
      jobId,
      { status, updatedAt: new Date() },
      { new: true }
    );
    
    if (!updatedJob) {
      return { success: false, message: "Job not found" };
    }

    // Revalidate the necessary pages
    revalidatePath("/companies");
    revalidatePath("/dashboard/jobs");
    
    return { success: true, message: `Job status updated to ${status}`, job: updatedJob };
  } catch (error) {
    console.error("Error updating job status:", error);
    return { success: false, message: "Failed to update job status" };
  }
};
