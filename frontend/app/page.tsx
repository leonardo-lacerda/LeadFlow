"use client";

import { LandingHeader } from "@/components/landing/header";
import { LandingHero } from "@/components/landing/hero";
import { LandingFeatures } from "@/components/landing/features";
import { LandingHowItWorks } from "@/components/landing/how-it-works";
import { LandingPricing } from "@/components/landing/pricing";
import { LandingFAQ } from "@/components/landing/faq";
import { LandingFooter } from "@/components/landing/footer";

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-black text-white selection:bg-indigo-500/30">
            <LandingHeader />
            <main>
                <LandingHero />
                <LandingFeatures />
                <LandingHowItWorks />
                <LandingPricing />
                <LandingFAQ />
            </main>
            <LandingFooter />
        </div>
    );
}
