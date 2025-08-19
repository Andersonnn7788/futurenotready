"use client";

import { useState } from "react";
import CandidateList from "@/components/candidate-list";

function CandidatesPageClient({ jobApplications }) {
  const [currentCandidateDetails, setCurrentCandidateDetails] = useState(null);
  const [showCurrentCandidateDetailsModal, setShowCurrentCandidateDetailsModal] = useState(false);

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex items-baseline justify-between border-b border-gray-200 pb-6 pt-24">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900">
          Candidates
        </h1>
      </div>
      <div className="pt-6">
        <CandidateList
          jobApplications={jobApplications}
          currentCandidateDetails={currentCandidateDetails}
          setCurrentCandidateDetails={setCurrentCandidateDetails}
          showCurrentCandidateDetailsModal={showCurrentCandidateDetailsModal}
          setShowCurrentCandidateDetailsModal={setShowCurrentCandidateDetailsModal}
        />
      </div>
    </div>
  );
}

export default CandidatesPageClient;
