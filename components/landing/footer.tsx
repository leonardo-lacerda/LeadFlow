"use client";

import Link from "next/link";
import { IconBrandTwitter, IconBrandLinkedin, IconBrandInstagram, IconBrandGithub } from "@tabler/icons-react";

export function LandingFooter() {
    return (
        <footer className="bg-black border-t border-white/10 py-12">
            <div className="container mx-auto px-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
                    <div className="col-span-1 md:col-span-1">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="h-6 w-6 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg" />
                            <span className="font-bold text-xl text-white">Leadflow</span>
                        </div>
                        <p className="text-gray-500 text-sm leading-relaxed">
                            Plataforma all-in-one para prospecção B2B.
                            Automatize, escale e feche mais negócios.
                        </p>
                    </div>

                    <div>
                        <h4 className="font-semibold text-white mb-4">Produto</h4>
                        <ul className="space-y-2 text-sm text-gray-400">
                            <li><Link href="#" className="hover:text-indigo-400 transition-colors">Features</Link></li>
                            <li><Link href="#" className="hover:text-indigo-400 transition-colors">Integrações</Link></li>
                            <li><Link href="#" className="hover:text-indigo-400 transition-colors">Preços</Link></li>
                            <li><Link href="#" className="hover:text-indigo-400 transition-colors">Roadmap</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-semibold text-white mb-4">Recursos</h4>
                        <ul className="space-y-2 text-sm text-gray-400">
                            <li><Link href="#" className="hover:text-indigo-400 transition-colors">Blog</Link></li>
                            <li><Link href="#" className="hover:text-indigo-400 transition-colors">Documentação</Link></li>
                            <li><Link href="#" className="hover:text-indigo-400 transition-colors">Comunidade</Link></li>
                            <li><Link href="#" className="hover:text-indigo-400 transition-colors">Suporte</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-semibold text-white mb-4">Legal</h4>
                        <ul className="space-y-2 text-sm text-gray-400">
                            <li><Link href="#" className="hover:text-indigo-400 transition-colors">Privacidade</Link></li>
                            <li><Link href="#" className="hover:text-indigo-400 transition-colors">Termos de Uso</Link></li>
                            <li><Link href="#" className="hover:text-indigo-400 transition-colors">DPA</Link></li>
                        </ul>
                    </div>
                </div>

                <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
                    <p className="text-gray-500 text-sm">
                        © {new Date().getFullYear()} Leadflow Inc. Todos os direitos reservados.
                    </p>
                    <div className="flex items-center gap-4">
                        <Link href="#" className="text-gray-500 hover:text-white transition-colors">
                            <IconBrandTwitter className="h-5 w-5" />
                        </Link>
                        <Link href="#" className="text-gray-500 hover:text-white transition-colors">
                            <IconBrandLinkedin className="h-5 w-5" />
                        </Link>
                        <Link href="#" className="text-gray-500 hover:text-white transition-colors">
                            <IconBrandInstagram className="h-5 w-5" />
                        </Link>
                        <Link href="#" className="text-gray-500 hover:text-white transition-colors">
                            <IconBrandGithub className="h-5 w-5" />
                        </Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
