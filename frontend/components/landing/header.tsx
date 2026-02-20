"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export function LandingHeader() {
    return (
        <header className="fixed top-0 w-full z-50 border-b border-white/10 bg-black/50 backdrop-blur-md">
            <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="h-6 w-6 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg" />
                    <span className="font-bold text-xl text-white">Leadflow</span>
                </div>

                <nav className="hidden md:flex items-center gap-8">
                    <Link href="#signal-layer" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">
                        Signal Layer
                    </Link>
                    <Link href="#how-it-works" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">
                        Como funciona
                    </Link>
                    <Link href="#pricing" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">
                        Precos
                    </Link>
                    <Link href="#faq" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">
                        FAQ
                    </Link>
                </nav>

                <div className="flex items-center gap-4">
                    <Link href="/login">
                        <Button variant="ghost" className="text-gray-300 hover:text-white hover:bg-white/10">
                            Entrar
                        </Button>
                    </Link>
                    <Link href="/register">
                        <Button className="bg-white text-black hover:bg-gray-200">
                            Entrar no Cohort
                        </Button>
                    </Link>
                </div>
            </div>
        </header>
    );
}
