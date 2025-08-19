"use server";

import connectToDB from "@/database";
import Application from "@/models/application";
import Feed from "@/models/feed";
import Job from "@/models/job";
import Profile from "@/models/profile";
import { revalidatePath } from "next/cache";
import { stripe } from "@/lib/stripe"; // <-- create this helper (shown below)

// ---------- Job Management ----------
export async function deleteJob(jobId) {
  try {
    await connectToDB();
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
}

export async function updateJobStatus(jobId, status) {
  try {
    await connectToDB();
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
}

// ---------- Profiles ----------
export async function createProfileAction(formData, pathToRevalidate) {
  await connectToDB();
  await Profile.create(formData);
  if (pathToRevalidate) revalidatePath(pathToRevalidate);
}

export async function fetchProfileAction(id) {
  await connectToDB();
  const result = await Profile.findOne({ userId: id });
  return JSON.parse(JSON.stringify(result));
}

// ---------- Jobs ----------
export async function postNewJobAction(formData, pathToRevalidate) {
  await connectToDB();
  await Job.create(formData);
  if (pathToRevalidate) revalidatePath(pathToRevalidate);
}

export async function fetchJobsForRecruiterAction(id) {
  await connectToDB();
  const result = await Job.find({ recruiterId: id });
  return JSON.parse(JSON.stringify(result));
}

export async function fetchJobsForCandidateAction(filterParams = {}) {
  await connectToDB();
  const hasFilters = filterParams && Object.keys(filterParams).length > 0;
  let query = {};
  if (hasFilters) {
    const updatedParams = {};
    for (const key of Object.keys(filterParams)) {
      updatedParams[key] = { $in: String(filterParams[key]).split(",") };
    }
    query = updatedParams;
  }
  const result = await Job.find(query);
  return JSON.parse(JSON.stringify(result));
}

// ---------- Applications ----------
export async function createJobApplicationAction(data, pathToRevalidate) {
  await connectToDB();
  await Application.create(data);
  if (pathToRevalidate) revalidatePath(pathToRevalidate);
}

export async function fetchJobApplicationsForCandidate(candidateID) {
  await connectToDB();
  const result = await Application.find({ candidateUserID: candidateID });
  return JSON.parse(JSON.stringify(result));
}

export async function fetchJobApplicationsForRecruiter(recruiterID) {
  await connectToDB();
  const result = await Application.find({ recruiterUserID: recruiterID });
  return JSON.parse(JSON.stringify(result));
}

export async function updateJobApplicationAction(data, pathToRevalidate) {
  await connectToDB();
  const {
    recruiterUserID,
    name,
    email,
    candidateUserID,
    status,
    jobID,
    _id,
    jobAppliedDate,
  } = data;

  await Application.findOneAndUpdate(
    { _id },
    { recruiterUserID, name, email, candidateUserID, status, jobID, jobAppliedDate },
    { new: true }
  );

  if (pathToRevalidate) revalidatePath(pathToRevalidate);
}

// ---------- Candidate Details ----------
export async function getCandidateDetailsByIDAction(currentCandidateID) {
  await connectToDB();
  const result = await Profile.findOne({ userId: currentCandidateID });
  return JSON.parse(JSON.stringify(result));
}

// ---------- Filters ----------
export async function createFilterCategoryAction() {
  await connectToDB();
  const result = await Job.find({});
  return JSON.parse(JSON.stringify(result));
}

// ---------- Profile Update ----------
export async function updateProfileAction(data, pathToRevalidate) {
  await connectToDB();
  const {
    userId,
    role,
    email,
    isPremiumUser,
    memberShipType,
    memberShipStartDate,
    memberShipEndDate,
    recruiterInfo,
    candidateInfo,
    _id,
  } = data;

  await Profile.findOneAndUpdate(
    { _id },
    {
      userId,
      role,
      email,
      isPremiumUser,
      memberShipType,
      memberShipStartDate,
      memberShipEndDate,
      recruiterInfo,
      candidateInfo,
    },
    { new: true }
  );

  if (pathToRevalidate) revalidatePath(pathToRevalidate);
}

// ---------- Stripe (Prices & Checkout) ----------

/**
 * Prefer using fixed Price IDs created in the Stripe Dashboard.
 * This function creates a new recurring Price dynamically (optional).
 */
export async function createPriceIdAction(data) {
  if (!data?.amount || Number.isNaN(Number(data.amount))) {
    throw new Error("Invalid amount passed to createPriceIdAction.");
  }

  const price = await stripe.prices.create({
    currency: "inr",
    unit_amount: Math.round(Number(data.amount) * 100),
    recurring: { interval: "year" },
    product_data: { name: "Premium Plan" },
  });

  return { success: true, id: price.id };
}

/**
 * Creates a Checkout Session for a subscription.
 * Pass either:
 *  - data.priceId  (recommended), OR
 *  - data.lineItems (fallback: array of { price, quantity } or { amount, currency, name } via price_data)
 */
export async function createStripePaymentAction(data) {
  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (!siteUrl) throw new Error("Missing NEXT_PUBLIC_SITE_URL.");
    
    console.log("Creating Stripe payment with site URL:", siteUrl);

    // Build line_items
    let line_items = [];
    if (data?.priceId) {
      line_items = [{ price: data.priceId, quantity: 1 }];
    } else if (Array.isArray(data?.lineItems) && data.lineItems.length > 0) {
      line_items = data.lineItems; // assume already in Stripe shape
    } else {
      throw new Error("Provide either data.priceId or data.lineItems.");
    }
    
    console.log("Stripe checkout line items:", line_items);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items,
      success_url: `${siteUrl}/membership?status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/membership?status=cancel`,
      // Optional goodies:
      // customer_email: data?.customerEmail,
      allow_promotion_codes: true,
      payment_method_types: ['card'],
    });
    
    console.log("Stripe session created successfully:", session.id);

    // Return URL so the client can redirect
    return { success: true, id: session.id, url: session.url };
  } catch (error) {
    console.error("Stripe checkout session creation failed:", error);
    throw new Error("Failed to create checkout: " + (error.message || "Please try again"));
  }
}

// ---------- Feed ----------
export async function createFeedPostAction(data, pathToRevalidate) {
  await connectToDB();
  await Feed.create(data);
  if (pathToRevalidate) revalidatePath(pathToRevalidate);
}

export async function fetchAllFeedPostsAction() {
  await connectToDB();
  const result = await Feed.find({});
  return JSON.parse(JSON.stringify(result));
}

export async function updateFeedPostAction(data, pathToRevalidate) {
  await connectToDB();
  const { userId, userName, message, image, likes, _id } = data;

  await Feed.findOneAndUpdate(
    { _id },
    { userId, userName, image, message, likes },
    { new: true }
  );

  if (pathToRevalidate) revalidatePath(pathToRevalidate);
}
