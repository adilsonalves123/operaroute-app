"use client";



import Link from "next/link";

import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

import {

  BarChart3,

  Bot,

  ClipboardList,

  GraduationCap,

  LayoutDashboard,

  LineChart,

  MapPin,

  Package,

  Route,

  Settings,

  Users,

  Wallet,

  AlertTriangle,

  Boxes,

  Award,

  FileText,

  ChevronLeft,

  ChevronRight,

} from "lucide-react";

import { useState } from "react";



const menuItems = [

  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },

  { href: "/analise", label: "Análise", icon: LineChart },

  { href: "/pontos", label: "Pontos / Clientes", icon: MapPin },

  { href: "/coletas", label: "Coletas", icon: Package },

  { href: "/financeiro", label: "Financeiro", icon: Wallet },

  { href: "/pendencias", label: "Pendências", icon: AlertTriangle },

  { href: "/estoque", label: "Estoque", icon: Boxes },

  { href: "/rotas", label: "Rotas", icon: Route },

  { href: "/equipe", label: "Equipe", icon: Users },

  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },

  { href: "/ia", label: "IA do Sistema", icon: Bot },

  { href: "/universidade", label: "Universidade", icon: GraduationCap },

  { href: "/certificados", label: "Certificados", icon: Award },

  { href: "/materiais", label: "Materiais", icon: FileText },

  { href: "/configuracoes", label: "Configurações", icon: Settings },

];



interface AppSidebarProps {

  nomeOperacao?: string;

}



export function AppSidebar({ nomeOperacao }: AppSidebarProps) {

  const pathname = usePathname();

  const [collapsed, setCollapsed] = useState(false);



  return (

    <aside

      className={cn(

        "hidden lg:flex flex-col border-r border-blue-500/10 bg-slate-950/50 backdrop-blur-xl transition-all duration-300",

        collapsed ? "w-16" : "w-64"

      )}

    >

      <div className="flex h-16 items-center justify-between border-b border-blue-500/10 px-4">

        {!collapsed && (

          <Link href="/dashboard" className="flex items-center gap-2">

            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-neon/20">

              <Route className="h-4 w-4 text-primary-neon" />

            </div>

            <span className="font-bold text-white">

              Opera<span className="text-primary-neon">Route</span>

            </span>

          </Link>

        )}

        <button

          onClick={() => setCollapsed(!collapsed)}

          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"

        >

          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}

        </button>

      </div>



      {!collapsed && nomeOperacao && (

        <div className="px-4 py-3 border-b border-blue-500/10">

          <p className="text-xs text-slate-500">Operação</p>

          <p className="text-sm font-medium text-white truncate">{nomeOperacao}</p>

        </div>

      )}



      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">

        {menuItems.map((item) => {

          const Icon = item.icon;

          const active = pathname === item.href || pathname.startsWith(item.href + "/");

          return (

            <Link

              key={item.href}

              href={item.href}

              title={collapsed ? item.label : undefined}

              className={cn(

                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition",

                active

                  ? "bg-blue-500/15 text-primary-neon font-medium"

                  : "text-slate-400 hover:bg-slate-800/50 hover:text-white"

              )}

            >

              <Icon className="h-4 w-4 shrink-0" />

              {!collapsed && <span>{item.label}</span>}

            </Link>

          );

        })}

      </nav>

    </aside>

  );

}

