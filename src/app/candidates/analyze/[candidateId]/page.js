import { currentUser } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import AnalyzeClient from "./pageClient";
import { fetchProfileAction, getCandidateDetailsByIDAction } from "@/actions";

export default async function AnalyzePage({ params, searchParams }) {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const profileInfo = await fetchProfileAction(user.id);
  if (!profileInfo || profileInfo.role !== "recruiter") redirect("/");

  const candidateId = params.candidateId;
  const candidateProfile = await getCandidateDetailsByIDAction(candidateId);
  if (!candidateProfile) redirect("/candidates");

  return (
    <AnalyzeClient candidateProfile={candidateProfile} />
  );
}
