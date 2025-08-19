import connectToDB from "@/database";
import Job from "@/models/job";
import { auth } from "@clerk/nextjs";
import { NextResponse } from "next/server";

export async function PUT(request) {
  try {
    const { userId } = auth();
    
    if (!userId) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    const { _id, ...updateData } = body;
    
    if (!_id) {
      return NextResponse.json(
        { message: "Job ID is required" },
        { status: 400 }
      );
    }
    
    await connectToDB();
    
    // Check if the job exists and belongs to the current user
    const existingJob = await Job.findById(_id);
    
    if (!existingJob) {
      return NextResponse.json(
        { message: "Job not found" },
        { status: 404 }
      );
    }
    
    if (existingJob.recruiterId !== userId) {
      return NextResponse.json(
        { message: "You don't have permission to update this job" },
        { status: 403 }
      );
    }
    
    // Update the job
    const updatedJob = await Job.findByIdAndUpdate(
      _id,
      { 
        ...updateData,
        updatedAt: new Date() 
      },
      { new: true }
    );
    
    return NextResponse.json({
      message: "Job updated successfully",
      job: updatedJob,
    });
    
  } catch (error) {
    console.error("Error updating job:", error);
    
    return NextResponse.json(
      { message: "Failed to update job", error: error.message },
      { status: 500 }
    );
  }
}
