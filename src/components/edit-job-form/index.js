"use client";

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/use-toast";

async function updateJob(jobData) {
  try {
    const response = await fetch("/api/jobs/update", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(jobData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to update job");
    }

    return await response.json();
  } catch (error) {
    console.error("Error updating job:", error);
    throw error;
  }
}

function EditJobForm({ job, userId }) {
  const router = useRouter();
  const [formData, setFormData] = useState(job);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await updateJob({
        ...formData,
        recruiterId: userId,
      });

      toast({
        title: "Success",
        description: "Job updated successfully",
      });
      
      router.push("/dashboard/jobs");
      router.refresh();
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to update job",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="title">Job Title</Label>
          <Input
            id="title"
            name="title"
            value={formData.title}
            onChange={handleInputChange}
            placeholder="e.g. Full Stack Developer"
            required
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="companyName">Company Name</Label>
          <Input
            id="companyName"
            name="companyName"
            value={formData.companyName}
            onChange={handleInputChange}
            placeholder="e.g. TalentMatch Inc."
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            name="location"
            value={formData.location}
            onChange={handleInputChange}
            placeholder="e.g. New York, NY"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="type">Job Type</Label>
          <select
            id="type"
            name="type"
            value={formData.type}
            onChange={handleInputChange}
            className="w-full rounded-md border border-gray-300 p-2"
            required
          >
            <option value="">Select Job Type</option>
            <option value="Full-time">Full-time</option>
            <option value="Part-time">Part-time</option>
            <option value="Contract">Contract</option>
            <option value="Freelance">Freelance</option>
            <option value="Internship">Internship</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="experience">Experience Level</Label>
          <select
            id="experience"
            name="experience"
            value={formData.experience}
            onChange={handleInputChange}
            className="w-full rounded-md border border-gray-300 p-2"
            required
          >
            <option value="">Select Experience Level</option>
            <option value="Entry">Entry Level</option>
            <option value="Junior">Junior</option>
            <option value="Mid-Level">Mid-Level</option>
            <option value="Senior">Senior</option>
            <option value="Lead">Lead</option>
            <option value="Manager">Manager</option>
            <option value="Executive">Executive</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Job Status</Label>
          <select
            id="status"
            name="status"
            value={formData.status}
            onChange={handleInputChange}
            className="w-full rounded-md border border-gray-300 p-2"
            required
          >
            <option value="active">Active</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="skills">Required Skills (comma separated)</Label>
          <Input
            id="skills"
            name="skills"
            value={formData.skills}
            onChange={handleInputChange}
            placeholder="e.g. JavaScript, React, Node.js"
            required
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="description">Job Description</Label>
          <Textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            placeholder="Enter job description..."
            rows={8}
            required
          />
        </div>
      </div>

      <div className="flex gap-4 justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/dashboard/jobs")}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Updating..." : "Update Job"}
        </Button>
      </div>
    </form>
  );
}

export default EditJobForm;
