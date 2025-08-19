"use client";

import { membershipPlans } from "@/utils";
import CommonCard from "../common-card";
import JobIcon from "../job-icon";
import { Button } from "../ui/button";
import {
  createPriceIdAction,
  createStripePaymentAction,
  updateProfileAction,
} from "@/actions";
import { loadStripe } from "@stripe/stripe-js";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
);

function Membership({ profileInfo }) {
  const pathName = useSearchParams();

  async function handlePayment(getCurrentPlan) {
    try {
      console.log("Starting payment process for plan:", getCurrentPlan);
      
      const stripe = await stripePromise;
      if (!stripe) {
        console.error("Failed to initialize Stripe");
        alert("Payment system unavailable. Please try again later.");
        return;
      }
      
      const extractPriceId = await createPriceIdAction({
        amount: Number(getCurrentPlan?.price),
      });

      console.log("Created price ID:", extractPriceId);
      
      if (extractPriceId && extractPriceId.id) {
        sessionStorage.setItem("currentPlan", JSON.stringify(getCurrentPlan));
        
        const result = await createStripePaymentAction({
          lineItems: [
            {
              price: extractPriceId.id,
              quantity: 1,
            },
          ],
        });

        console.log("Checkout session created:", result);

        if (result && result.id) {
          const { error } = await stripe.redirectToCheckout({
            sessionId: result.id,
          });
          
          if (error) {
            console.error("Stripe redirect error:", error);
            alert("Payment failed: " + (error.message || "Please try again."));
          }
        } else {
          console.error("Invalid checkout session result:", result);
          alert("Couldn't create checkout session. Please try again.");
        }
      } else {
        console.error("Failed to create price ID:", extractPriceId);
        alert("Payment setup failed. Please try again.");
      }
    } catch (error) {
      console.error("Payment error:", error);
      alert("Payment process failed: " + (error.message || "Please try again."));
    }
  }

  async function updateProfile() {
    let fetchCurrentPlanFromSessionStroage = null;
    try {
      const raw = sessionStorage.getItem("currentPlan");
      fetchCurrentPlanFromSessionStroage = raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn("Failed to parse currentPlan from sessionStorage:", e);
    }

    const yearsToAdd = (() => {
      const type = fetchCurrentPlanFromSessionStroage?.type;
      const plan = fetchCurrentPlanFromSessionStroage?.plan;
      if (type === "basic") return 1;
      if (plan === "teams") return 2;
      return 5; // enterprise or default
    })();

    const start = new Date();
    const end = new Date(start);
    end.setFullYear(start.getFullYear() + yearsToAdd);

    await updateProfileAction(
      {
        ...profileInfo,
        isPremiumUser: true,
        memberShipType: fetchCurrentPlanFromSessionStroage?.type,
  memberShipStartDate: start.toString(),
  memberShipEndDate: end.toString(),
      },
      "/membership"
    );
  }

  useEffect(() => {
    if (pathName.get("status") === "success") updateProfile();
  }, [pathName]);

  console.log(profileInfo);

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex items-baseline justify-between border-b pb-6 pt-24">
        <h1 className="text-4xl font-bold tracking-tight text-gray-950">
          {profileInfo?.isPremiumUser
            ? "You are a premium user"
            : "Choose Your Best Plan"}
        </h1>
        <div>
          {profileInfo?.isPremiumUser ? (
            <Button className="flex h-11 items-center justify-center px-5">
              {
                membershipPlans.find(
                  (planItem) => planItem.type === profileInfo?.memberShipType
                ).heading
              }
            </Button>
          ) : null}
        </div>
      </div>
      <div className="py-20 pb-24 pt-6">
        <div className="container mx-auto p-0 space-y-8">
          <div className="grid grid-cols-1 gap-x-4 gap-y-8 md:grid-cols-2 lg:grid-cols-3">
            {membershipPlans.map((plan, index) => (
              <CommonCard
                icon={
                  <div className="flex justify-between">
                    <div>
                      <JobIcon />
                    </div>
                    <h1 className="font-bold text-2xl">{plan.heading}</h1>
                  </div>
                }
                title={`$ ${plan.price} /yr`}
                description={plan.type}
                footerContent={
                  profileInfo?.memberShipType === "enterprise" ||
                  (profileInfo?.memberShipType === "basic" && index === 0) ||
                  (profileInfo?.memberShipType === "teams" &&
                  index >= 0 &&
                  index < 2 ? null : (
                    <Button
                      onClick={() => handlePayment(plan)}
                      className="disabled:opacity-65 flex h-11 items-center justify-center px-5"
                    >
                      {profileInfo?.memberShipType === "basic" ||
                      profileInfo?.memberShipType === "teams"
                        ? "Update Plan"
                        : "Get Premium"}
                    </Button>
                  ))
                }
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Membership;
