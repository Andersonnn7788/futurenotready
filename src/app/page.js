import { currentUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { ArrowRight, Users, Zap, Target, CheckCircle } from "lucide-react";

async function HomePage() {
  const user = await currentUser();
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Hero Section */}
      <section className="relative py-20 text-center">
        <div className="max-w-4xl mx-auto px-4">
          <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-800 px-4 py-2 rounded-full text-sm font-medium mb-8">
            ✨ AI-Powered Talent Acquisition
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold text-gray-900 mb-6 leading-tight">
            Hire faster. <span className="text-blue-600">Onboard smarter.</span>
          </h1>
          
          <p className="text-xl text-gray-600 mb-10 max-w-3xl mx-auto leading-relaxed">
            One unified workflow from resume to day one. Optimize your talent 
            acquisition with AI-powered matching, automated scheduling, and seamless 
            onboarding.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {!user ? (
              <>
                <Link href="/sign-up">
                  <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 text-lg">
                    Try the Demo <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Button variant="outline" size="lg" className="px-8 py-4 text-lg">
                  Watch Demo Video
                </Button>
              </>
            ) : (
              <Link href="/feed">
                <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 text-lg">
                  Go to Dashboard <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Why Choose TalentMatch?
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Our AI-powered platform streamlines every step of your hiring process
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="p-6 hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <Zap className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold mb-3">AI-Powered Matching</h3>
                <p className="text-gray-600">
                  Our advanced algorithms match candidates to roles with 95% accuracy, 
                  saving you hours of screening time.
                </p>
              </CardContent>
            </Card>
            
            <Card className="p-6 hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                  <Target className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Automated Scheduling</h3>
                <p className="text-gray-600">
                  Eliminate back-and-forth emails with smart calendar integration 
                  and automated interview scheduling.
                </p>
              </CardContent>
            </Card>
            
            <Card className="p-6 hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                  <Users className="h-6 w-6 text-purple-600" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Seamless Onboarding</h3>
                <p className="text-gray-600">
                  Get new hires productive from day one with our comprehensive 
                  onboarding workflows and documentation.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
                Transform Your Hiring Process
              </h2>
              <p className="text-lg text-gray-600 mb-8">
                Join thousands of companies that have revolutionized their talent 
                acquisition with our intelligent platform.
              </p>
              
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-gray-700">Reduce time-to-hire by 60%</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-gray-700">Improve candidate quality by 40%</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-gray-700">Save 20+ hours per week on admin tasks</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-gray-700">Increase offer acceptance rate by 35%</span>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-8 rounded-xl shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Ready to Get Started?</h3>
              <p className="text-gray-600 mb-6">
                Experience the future of talent acquisition. No credit card required.
              </p>
              
              {!user ? (
                <div className="space-y-3">
                  <Link href="/sign-up" className="block">
                    <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3">
                      Start Free Trial
                    </Button>
                  </Link>
                  <Link href="/sign-in" className="block">
                    <Button variant="outline" className="w-full py-3">
                      Sign In
                    </Button>
                  </Link>
                </div>
              ) : (
                <Link href="/jobs" className="block">
                  <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3">
                    Browse Jobs
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default HomePage;
