"use client";

import {
  candidateOnboardFormControls,
  initialCandidateAccountFormData,
  initialCandidateFormData,
  initialRecruiterFormData,
  recruiterOnboardFormControls,
} from "@/utils";
import { useEffect, useState } from "react";
import CommonForm from "../common-form";
import { updateProfileAction } from "@/actions";
import { createClient } from "@supabase/supabase-js";

const supabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ymsijpnegskkoiuerthi.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inltc2lqcG5lZ3Nra29pdWVydGhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTQyMzYzNDYsImV4cCI6MjAyOTgxMjM0Nn0.PM7Nr9qTZFEJsf62eHgkFXKGPqt0gfMdFN6SOJjCP6M"
);
const SUPABASE_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_BUCKET || "job-board-public";

function AccountInfo({ profileInfo }) {
  const [candidateFormData, setCandidateFormData] = useState(() => {
    // Initialize with proper data if profileInfo is available during initialization
    if (profileInfo?.role === "candidate" && profileInfo?.candidateInfo) {
      const candidateInfo = profileInfo.candidateInfo;
      return {
        resume: candidateInfo.resume || "",
        name: candidateInfo.name || "",
        email: candidateInfo.email || profileInfo.email || "",
        phoneNumber: candidateInfo.phoneNumber || "",
        preferedJobLocation: candidateInfo.preferedJobLocation || "",
        currentSalary: candidateInfo.currentSalary || "",
        noticePeriod: candidateInfo.noticePeriod || "",
        skills: candidateInfo.skills || "",
        totalExperience: candidateInfo.totalExperience || "",
        college: candidateInfo.college || "",
        graduatedYear: candidateInfo.graduatedYear || "",
        linkedinProfile: candidateInfo.linkedinProfile || "",
        githubProfile: candidateInfo.githubProfile || "",
      };
    }
    return initialCandidateAccountFormData;
  });
  const [recruiterFormData, setRecruiterFormData] = useState(
    initialRecruiterFormData
  );
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  function handleFileChange(event) {
    event.preventDefault();
    const selected = event.target.files?.[0];
    if (!selected) return;

    // Enforce PDF only, up to ~5MB
    const isPdf = selected.type === "application/pdf" || selected.name.toLowerCase().endsWith(".pdf");
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (!isPdf) {
      alert("Please upload a PDF file (.pdf).");
      return;
    }
    if (selected.size > maxSize) {
      alert("File is too large. Max 5MB.");
      return;
    }
    setFile(selected);
  }

  async function handleUploadPdfToSupabase() {
    if (!file) return;
    try {
      setIsUploading(true);
      const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
      const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      // Do not start with a leading slash per Supabase docs; place in a folder per user
      const userFolder = profileInfo?.userId || "anonymous";
      const objectPath = `resumes/${userFolder}/${uniqueName}`;

      const { data, error } = await supabaseClient.storage
        .from(SUPABASE_BUCKET)
        .upload(objectPath, file, {
          cacheControl: "3600",
          upsert: true,
          contentType: "application/pdf",
        });
      console.log("Supabase upload:", data, error);
      if (error) throw error;

      // Get a public URL to persist in DB
      const { data: publicData } = supabaseClient.storage
        .from(SUPABASE_BUCKET)
        .getPublicUrl(objectPath);
      const publicUrl = publicData?.publicUrl || objectPath;

      setCandidateFormData((prev) => ({
        ...prev,
        resume: publicUrl,
      }));
    } catch (e) {
      // Surface more details to help debugging
      console.error("Resume upload failed:", e);
      const message = e?.message || e?.error?.message || e?.error_description || "Unknown error";
      const status = e?.status || e?.statusCode || "";
      alert(`Failed to upload resume. ${status ? `(Status ${status}) ` : ""}${message}`);
    } finally {
      setIsUploading(false);
    }
  }

  useEffect(() => {
    if (file) handleUploadPdfToSupabase();
  }, [file]);

  useEffect(() => {
    console.log("useEffect triggered with profileInfo:", profileInfo);
    
    if (profileInfo?.role === "recruiter") {
      console.log("Setting recruiter data");
      setRecruiterFormData(profileInfo?.recruiterInfo);
    }

    if (profileInfo?.role === "candidate" && profileInfo?.candidateInfo) {
      console.log("=== FORM DATA MAPPING DEBUG ===");
      console.log("Full profileInfo:", JSON.stringify(profileInfo, null, 2));
      
      // Map existing candidateInfo to new form structure
      const candidateInfo = profileInfo.candidateInfo;
      
      const formData = {
        resume: candidateInfo.resume || "",
        name: candidateInfo.name || "",
        email: candidateInfo.email || profileInfo.email || "",
        phoneNumber: candidateInfo.phoneNumber || "",
        preferedJobLocation: candidateInfo.preferedJobLocation || "",
        currentSalary: candidateInfo.currentSalary || "",
        noticePeriod: candidateInfo.noticePeriod || "",
        skills: candidateInfo.skills || "",
        totalExperience: candidateInfo.totalExperience || "",
        college: candidateInfo.college || "",
        graduatedYear: candidateInfo.graduatedYear || "",
        linkedinProfile: candidateInfo.linkedinProfile || "",
        githubProfile: candidateInfo.githubProfile || "",
      };
      
      console.log("New formData being set:", formData);
      setCandidateFormData(formData);
    }
  }, [profileInfo]);

  // Also ensure form data is set when profileInfo changes
  useEffect(() => {
    console.log("Secondary effect - candidateFormData updated:", candidateFormData);
  }, [candidateFormData]);

  // Validation function for candidate form
  function isFormValid() {
    if (profileInfo?.role === "candidate") {
      const hasName = candidateFormData.name && candidateFormData.name.trim() !== "";
      const hasEmail = candidateFormData.email && candidateFormData.email.trim() !== "";
      const hasPhone = candidateFormData.phoneNumber && candidateFormData.phoneNumber.trim() !== "";
  // For existing users updating their profile, resume is optional if already present
  const hasResume = candidateFormData.resume || profileInfo?.candidateInfo?.resume;
      
      console.log("=== VALIDATION DEBUG ===");
      console.log("candidateFormData.name:", candidateFormData.name);
      console.log("candidateFormData.email:", candidateFormData.email);
      console.log("candidateFormData.phoneNumber:", candidateFormData.phoneNumber);
      console.log("candidateFormData.resume:", candidateFormData.resume);
      console.log("profileInfo?.candidateInfo?.resume:", profileInfo?.candidateInfo?.resume);
      console.log("Validation results:", { hasName, hasEmail, hasPhone, hasResume });
      
  // For account updates, only require name, email, and phone number; if no resume exists at all during onboarding flow, require resume
  const isOnboarding = !profileInfo?.candidateInfo?.name && !profileInfo?.candidateInfo?.email && !profileInfo?.candidateInfo?.phoneNumber;
  const isValid = isOnboarding ? hasName && hasEmail && hasPhone && !!hasResume : hasName && hasEmail && hasPhone;
      console.log("Final result:", isValid);
      
      return isValid;
    }
    return true; // Recruiters don't have required fields
  }

  console.log(profileInfo, "candidateFormData UPDATED", candidateFormData);

  async function handleUpdateAccount() {
    // Validate required fields for candidates
    if (profileInfo?.role === "candidate" && !isFormValid()) {
  alert("Please fill in all required fields. Make sure you have Name, Email, Phone Number, and a PDF resume if prompted.");
      return;
    }

    await updateProfileAction(
      profileInfo?.role === "candidate"
        ? {
            _id: profileInfo?._id,
            userId: profileInfo?.userId,
            email: profileInfo?.email,
            role: profileInfo?.role,
            isPremiumUser: profileInfo?.isPremiumUser,
            memberShipType: profileInfo?.memberShipType,
            memberShipStartDate: profileInfo?.memberShipStartDate,
            memberShipEndDate: profileInfo?.memberShipEndDate,
            candidateInfo: {
              ...candidateFormData,
              resume: candidateFormData.resume || profileInfo?.candidateInfo?.resume,
            },
          }
        : {
            _id: profileInfo?._id,
            userId: profileInfo?.userId,
            email: profileInfo?.email,
            role: profileInfo?.role,
            isPremiumUser: profileInfo?.isPremiumUser,
            memberShipType: profileInfo?.memberShipType,
            memberShipStartDate: profileInfo?.memberShipStartDate,
            memberShipEndDate: profileInfo?.memberShipEndDate,
            recruiterInfo: {
              ...recruiterFormData,
            },
          },
      "/account"
    );
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex items-baseline justify-between pb-6 border-b pt-24">
        <h1 className="text-4xl font-bold tracking-tight text-gray-950">
          Account Details
        </h1>
      </div>
      <div className="py-20 pb-24 pt-6">
        <div className="container mx-auto p-0 space-y-8">
          {/** Build controls dynamically so resume isn't required when a resume already exists */}
          {(() => {
            // no-op IIFE to keep JSX tidy
            return null;
          })()}
          {
            /* Determine if resume should be required: required only when there's no saved resume and none newly selected */
          }
          {(() => {
            return null;
          })()}
          {
            /* Dynamic controls for candidate */
          }
          <CommonForm
            action={handleUpdateAccount}
            formControls={
              profileInfo?.role === "candidate"
                ? candidateOnboardFormControls.map((c) =>
                    c.name === "resume"
                      ? {
                          ...c,
                          required: !(candidateFormData.resume || profileInfo?.candidateInfo?.resume),
                        }
                      : c
                  )
                : recruiterOnboardFormControls
            }
            formData={
              profileInfo?.role === "candidate"
                ? candidateFormData
                : recruiterFormData
            }
            setFormData={
              profileInfo?.role === "candidate"
                ? setCandidateFormData
                : setRecruiterFormData
            }
            handleFileChange={profileInfo?.role === "candidate" ? handleFileChange : undefined}
            buttonText="Update Profile"
            isBtnDisabled={profileInfo?.role === "candidate" ? isUploading || !isFormValid() : false}
          />
          {profileInfo?.role === "candidate" && (
            <div className="mt-4 text-sm text-gray-600">
              <p>* Required fields: Name, Email, Phone Number</p>
              <p className="text-xs text-gray-500">Resume upload is optional for profile updates</p>
              {profileInfo?.candidateInfo?.resume && (
                <p className="text-green-600">✓ Resume uploaded: {profileInfo.candidateInfo.resume}</p>
              )}
              <div className="mt-2 text-xs">
                <p>Form validation: {isFormValid() ? "✓ Valid" : "✗ Missing required fields"}</p>
                <div className="mt-2 bg-gray-100 p-2 rounded text-xs">
                  <p><strong>Debug Info:</strong></p>
                  <p>Name: "{candidateFormData.name}" (length: {candidateFormData.name?.length || 0})</p>
                  <p>Email: "{candidateFormData.email}" (length: {candidateFormData.email?.length || 0})</p>
                  <p>Phone: "{candidateFormData.phoneNumber}" (length: {candidateFormData.phoneNumber?.length || 0})</p>
                  <p>Resume: "{candidateFormData.resume || profileInfo?.candidateInfo?.resume || ""}"</p>
                  {isUploading && <p className="text-blue-600">Uploading resume...</p>}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AccountInfo;
