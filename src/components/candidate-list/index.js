"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogFooter } from "../ui/dialog";
import {
  getCandidateDetailsByIDAction,
  updateJobApplicationAction,
} from "@/actions";
import { createClient } from "@supabase/supabase-js";
import { MapPin, Briefcase, Mail, Calendar, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter } from "next/navigation";

const supabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ymsijpnegskkoiuerthi.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inltc2lqcG5lZ3Nra29pdWVydGhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTQyMzYzNDYsImV4cCI6MjAyOTgxMjM0Nn0.PM7Nr9qTZFEJsf62eHgkFXKGPqt0gfMdFN6SOJjCP6M"
);

function CandidateList({
  jobApplications,
  currentCandidateDetails,
  setCurrentCandidateDetails,
  showCurrentCandidateDetailsModal,
  setShowCurrentCandidateDetailsModal,
}) {
  const router = useRouter();
  const [profilesByUserId, setProfilesByUserId] = useState({});

  // Fetch candidate profiles for all unique candidateUserIDs
  useEffect(() => {
    const ids = Array.from(
      new Set((jobApplications || []).map((j) => j?.candidateUserID).filter(Boolean))
    );
    let cancelled = false;
    async function run() {
      const entries = await Promise.all(
        ids.map(async (id) => {
          try {
            const p = await getCandidateDetailsByIDAction(id);
            return [id, p];
          } catch (e) {
            console.error("Failed to fetch candidate profile:", id, e);
            return [id, null];
          }
        })
      );
      if (!cancelled) {
        const map = Object.fromEntries(entries);
        setProfilesByUserId(map);
      }
    }
    if (ids.length > 0) run();
    return () => {
      cancelled = true;
    };
  }, [jobApplications]);

  const applicants = useMemo(() => jobApplications || [], [jobApplications]);
  const uniqueApplicants = useMemo(() => {
    const map = new Map();
    for (const item of applicants) {
      const id = item?.candidateUserID;
      if (!id) continue;
      if (!map.has(id)) map.set(id, item);
    }
    return Array.from(map.values());
  }, [applicants]);

  function getInitials(name = "") {
    const parts = String(name).trim().split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]?.toUpperCase() || "").join("") || "?";
  }

  function getResumePublicUrlFromDetails(details) {
    const resume = details?.candidateInfo?.resume;
    if (!resume) return null;
    if (typeof resume === "string" && /^https?:\/\//i.test(resume)) return resume;
    try {
      const { data } = supabaseClient.storage
        .from(process.env.NEXT_PUBLIC_SUPABASE_BUCKET || "job-board-public")
        .getPublicUrl(resume);
      return data?.publicUrl || null;
    } catch {
      return null;
    }
  }
  async function handleFetchCandidateDetails(getCurrentCandidateId) {
    const data = await getCandidateDetailsByIDAction(getCurrentCandidateId);

    if (data) {
      setCurrentCandidateDetails(data);
      setShowCurrentCandidateDetailsModal(true);
    }
  }

  console.log(currentCandidateDetails);
  function getResumePublicUrl() {
    const resume = currentCandidateDetails?.candidateInfo?.resume;
    if (!resume) return null;

    // If resume is already a full URL, return it directly
    if (typeof resume === "string" && /^https?:\/\//i.test(resume)) {
      return resume;
    }

    // Otherwise treat it as a storage path and request a public URL
    try {
      const { data } = supabaseClient.storage
        .from(process.env.NEXT_PUBLIC_SUPABASE_BUCKET || "job-board-public")
        .getPublicUrl(resume);
      return data?.publicUrl || null;
    } catch (e) {
      console.error("Failed to derive public URL for resume:", e);
      return null;
    }
  }

  function handlePreviewResume() {
    const publicUrl = getResumePublicUrl();
    if (!publicUrl) {
      alert("No resume available for this candidate.");
      return;
    }
    const a = document.createElement("a");
    a.href = publicUrl;
    a.setAttribute("target", "_blank");
    a.setAttribute("rel", "noopener noreferrer");
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  async function handleUpdateJobStatus(getCurrentStatus) {
    let cpyJobApplicants = [...jobApplications];
    const indexOfCurrentJobApplicant = cpyJobApplicants.findIndex(
      (item) => item.candidateUserID === currentCandidateDetails?.userId
    );
    const jobApplicantsToUpdate = {
      ...cpyJobApplicants[indexOfCurrentJobApplicant],
      status:
        cpyJobApplicants[indexOfCurrentJobApplicant].status.concat(
          getCurrentStatus
        ),
    };

    console.log(jobApplicantsToUpdate, "jobApplicantsToUpdate");
    await updateJobApplicationAction(jobApplicantsToUpdate, "/jobs");
  }

  console.log(jobApplications);

  return (
    <Fragment>
      <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2 lg:grid-cols-3">
        {uniqueApplicants && uniqueApplicants.length > 0 ? (
          uniqueApplicants.map((item) => {
            const profile = profilesByUserId[item?.candidateUserID];
            const c = profile?.candidateInfo || {};
            const name = c.name || item?.name || "Candidate";
            const email = c.email || item?.email || "";
            const location = c.preferedJobLocation || "";
            const expRaw = String(c.totalExperience || "").trim();
            const expYears = expRaw && expRaw !== "-" ? `${expRaw}y exp` : "";
            const skills = (c.skills || "").split(",").map((s) => s.trim()).filter(Boolean);
            const topSkills = skills.slice(0, 3);
            const moreCount = Math.max(0, skills.length - topSkills.length);
            const resumeUrl = getResumePublicUrlFromDetails(profile);

            return (
              <div key={item._id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-700 font-semibold">
                      {getInitials(name)}
                    </div>
                    <div>
                      <div className="text-base font-semibold text-gray-900">{name}</div>
                      <div className="text-xs text-gray-500">{email}</div>
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-3 text-gray-600 text-sm">
                  {location && (
                    <div className="flex items-center gap-1"><MapPin size={16} />{location}</div>
                  )}
                  {expYears && (
                    <div className="flex items-center gap-1"><Briefcase size={16} />{expYears}</div>
                  )}
                </div>

                {skills.length > 0 && (
                  <div className="mt-4">
                    <div className="text-[11px] uppercase text-gray-500 font-medium mb-2">Top Skills</div>
                    <div className="flex flex-wrap gap-2">
                      {topSkills.map((s, idx) => (
                        <span key={idx} className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800 border border-gray-200">{s}</span>
                      ))}
                      {moreCount > 0 && (
                        <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800 border border-gray-200">+{moreCount}</span>
                      )}
                    </div>
                  </div>
                )}

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    className="h-9 text-sm flex items-center gap-2 justify-center"
                    onClick={() => console.log("Message", item?.candidateUserID)}
                  >
                    <Mail size={16} /> Message
                  </Button>
                  <Button
                    variant="outline"
                    className="h-9 text-sm flex items-center gap-2 justify-center"
                    onClick={() => console.log("Schedule", item?.candidateUserID)}
                  >
                    <Calendar size={16} /> Schedule
                  </Button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Button
                    className="h-9 text-sm flex items-center gap-2 justify-center"
                    disabled={!resumeUrl}
                    onClick={() => router.push(`/candidates/analyze/${item?.candidateUserID}`)}
                  >
                    <FileText size={16} /> Analyze Resume
                  </Button>
                  <Button
                    variant="outline"
                    className="h-9 text-sm flex items-center gap-2 justify-center"
                    onClick={() => handleFetchCandidateDetails(item?.candidateUserID)}
                  >
                    View Details
                  </Button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full text-center py-8">
            <p className="text-gray-500">No candidates have applied yet.</p>
          </div>
        )}
      </div>
      <Dialog
        open={showCurrentCandidateDetailsModal}
        onOpenChange={() => {
          setCurrentCandidateDetails(null);
          setShowCurrentCandidateDetailsModal(false);
        }}
      >
        <DialogContent>
          <Card className="w-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-xl">
                {currentCandidateDetails?.candidateInfo?.name || "N/A"}
              </CardTitle>
              <p className="text-sm text-gray-500">
                Email: {currentCandidateDetails?.email || "N/A"}
              </p>
              <p className="text-sm text-gray-500">
                Phone: {currentCandidateDetails?.candidateInfo?.phoneNumber || "N/A"}
              </p>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-gray-500">Experience</div>
                  <div className="text-gray-900">{(currentCandidateDetails?.candidateInfo?.totalExperience && currentCandidateDetails?.candidateInfo?.totalExperience !== "-") ? `${currentCandidateDetails?.candidateInfo?.totalExperience} Years` : "N/A"}</div>
                </div>
                <div>
                  <div className="text-gray-500">Expected Salary</div>
                  <div className="text-gray-900">{currentCandidateDetails?.candidateInfo?.currentSalary ? `MYR ${currentCandidateDetails?.candidateInfo?.currentSalary}` : "N/A"}</div>
                </div>
                <div>
                  <div className="text-gray-500">Notice Period</div>
                  <div className="text-gray-900">{currentCandidateDetails?.candidateInfo?.noticePeriod ? `${currentCandidateDetails?.candidateInfo?.noticePeriod} Days` : "N/A"}</div>
                </div>
                <div>
                  <div className="text-gray-500">Location</div>
                  <div className="text-gray-900">{currentCandidateDetails?.candidateInfo?.preferedJobLocation || "N/A"}</div>
                </div>
                <div className="sm:col-span-2">
                  <div className="text-gray-500">Education</div>
                  <div className="text-gray-900">
                    {currentCandidateDetails?.candidateInfo?.college || "N/A"}
                    {currentCandidateDetails?.candidateInfo?.graduatedYear ? ` (Class of ${currentCandidateDetails?.candidateInfo?.graduatedYear})` : ""}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">LinkedIn</div>
                  <div className="text-gray-900">
                    {currentCandidateDetails?.candidateInfo?.linkedinProfile ? (
                      <a href={currentCandidateDetails?.candidateInfo?.linkedinProfile} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">View</a>
                    ) : ("N/A")}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">GitHub</div>
                  <div className="text-gray-900">
                    {currentCandidateDetails?.candidateInfo?.githubProfile ? (
                      <a href={currentCandidateDetails?.candidateInfo?.githubProfile} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">View</a>
                    ) : ("N/A")}
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <div className="text-gray-500 mb-2">Skills</div>
                  <div className="flex flex-wrap gap-2">
                    {(() => {
                      const skills = (currentCandidateDetails?.candidateInfo?.skills || "")
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean);
                      if (skills.length === 0) return (<span className="text-gray-900">N/A</span>);
                      return skills.map((skill, idx) => (
                        <span key={idx} className="px-2 py-1 rounded-full border text-xs bg-gray-50 text-gray-800">
                          {skill}
                        </span>
                      ));
                    })()}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </DialogContent>
      </Dialog>
    </Fragment>
  );
}

export default CandidateList;
