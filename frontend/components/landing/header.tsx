"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { IconTerminal2 } from "@tabler/icons-react";

export function LandingHeader() {
    return (
        <header className="fixed top-0 w-full z-50 border-b border-white/10 bg-black/50 backdrop-blur-md">
            <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2">
                    <div className="h-6 w-6 bg-white flex items-center justify-center rounded-[4px]">
                        <IconTerminal2 className="h-4 w-4 text-black" />
                    </div>
                    <span className="font-semibold text-xl text-white tracking-tight">Leadflow</span>
                </Link>

                <nav className="hidden md:flex items-center gap-8">
                    <Link href="#signal-layer" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">
                        Camada de Sinais
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
                        <Button variant="ghost" className="text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 rounded-none h-9 px-4">
                            Log in
                        </Button>
                    </Link>
                    <Link href="/register">
                        <Button className="bg-white text-black hover:bg-gray-200 rounded-none text-sm font-medium h-9 px-4">
                            Deploy Engine
                        </Button>
                    </Link>
                </div>
            </div>
        </header>
    );
}

