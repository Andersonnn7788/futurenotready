import { Inter } from "next/font/google";
import "./globals.css";
import { Suspense } from "react";
import Loading from "./loading";
import CommonLayout from "@/components/common-layout";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "TalentMatch - AI-Powered Talent Acquisition",
  description: "Hire faster. Onboard smarter. One unified workflow from resume to day one with AI-powered matching, automated scheduling, and seamless onboarding.",
};

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={inter.className}>
          <Suspense fallback={<Loading />}>
          <CommonLayout>
            {children}
          </CommonLayout>
          </Suspense>
          <Toaster />
        </body>
      </html>
    </ClerkProvider>
  );
}
