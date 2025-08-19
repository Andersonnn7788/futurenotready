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
import { useToast } from "@/components/ui/use-toast";

const supabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ymsijpnegskkoiuerthi.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inltc2lqcG5lZ3Nra29pdWVydGhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTQyMzYzNDYsImV4cCI6MjAyOTgxMjM0Nn0.PM7Nr9qTZFEJsf62eHgkFXKGPqt0gfMdFN6SOJjCP6M"
);
const SUPABASE_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_BUCKET || "job-board-public";

function AccountInfo({ profileInfo }) {
  const { toast } = useToast();
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
  // Save original name for UI display
  setCandidateFormData((prev) => ({ ...prev, resumeOriginalName: selected.name }));
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
      console.warn("Direct upload failed; trying server route /api/upload-resume", e);
      try {
        const form = new FormData();
        form.append("file", file);
        if (profileInfo?.userId) form.append("userId", profileInfo.userId);
        const resp = await fetch("/api/upload-resume", { method: "POST", body: form });
        const json = await resp.json();
        if (!resp.ok) {
          throw new Error(json?.error || `Server upload failed with ${resp.status}`);
        }
        setCandidateFormData((prev) => ({ ...prev, resume: json.publicUrl }));
      } catch (serverErr) {
        console.error("Resume upload failed (both client and server):", serverErr);
        const message = serverErr?.message || "Unknown error";
        alert(`Failed to upload resume. ${message}`);
      }
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
      const ri = profileInfo?.recruiterInfo || {};
      setRecruiterFormData({
        name: ri.name || "",
        companyName: ri.companyName || "",
        companyRole: ri.companyRole || "",
        email: ri.email || profileInfo?.email || "",
        phoneNumber: ri.phoneNumber || "",
      });
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
      // derive a friendly name from existing URL/path for UI
      if (formData.resume) {
        try {
          const url = new URL(formData.resume);
          formData.resumeOriginalName = decodeURIComponent(url.pathname.split("/").pop() || "");
        } catch {
          const base = String(formData.resume).split("?")[0];
          formData.resumeOriginalName = decodeURIComponent(base.split("/").pop() || "");
        }
      }
      
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
    // Recruiter required fields: name, companyName, companyRole, email, phoneNumber
    if (profileInfo?.role === "recruiter") {
      const r = recruiterFormData || {};
      const all = [r.name, r.companyName, r.companyRole, r.email, r.phoneNumber];
      return all.every((v) => v && String(v).trim() !== "");
    }
    return true;
  }

  console.log(profileInfo, "candidateFormData UPDATED", candidateFormData);

  async function handleUpdateAccount() {
    // Validate required fields for candidates
    if (profileInfo?.role === "candidate" && !isFormValid()) {
  alert("Please fill in all required fields. Make sure you have Name, Email, Phone Number, and a PDF resume if prompted.");
      return;
    }
    try {
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
      toast({ title: "Profile updated successfully" });
    } catch (e) {
      console.error("Update profile failed:", e);
      toast({ title: "Failed to update profile", description: e?.message || "Please try again" });
    }
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
            isBtnDisabled={
              profileInfo?.role === "candidate"
                ? isUploading || !isFormValid()
                : !isFormValid()
            }
          />
          <div className="mt-4 text-xs text-gray-500">* indicates a required field</div>
        </div>
      </div>
    </div>
  );
}

export default AccountInfo;
