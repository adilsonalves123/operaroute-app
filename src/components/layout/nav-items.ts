import type { LucideIcon } from "lucide-react";
import type { PermissaoModulo } from "@/lib/equipe/permissions";
import {
  BarChart3,
  Bot,
  ClipboardPen,
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
  Wrench,
  Boxes,
  Gamepad2,
  LifeBuoy,
  Shield,
  Home,
} from "lucide-react";

export type AppNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  modulo: PermissaoModulo;
};

/** Menu principal — igual ao painel dono (lista contínua). */
export const APP_NAV_MAIN: AppNavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, modulo: "dashboard" },
  { href: "/rascunho", label: "Rascunho", icon: ClipboardPen, modulo: "dashboard" },
  { href: "/analise", label: "Análise", icon: LineChart, modulo: "analise" },
  { href: "/pontos", label: "Pontos", icon: MapPin, modulo: "pontos" },
  { href: "/equipamentos", label: "Máquinas", icon: Gamepad2, modulo: "pontos" },
  { href: "/coletas", label: "Coletas", icon: Package, modulo: "coletas" },
  { href: "/financeiro", label: "Financeiro", icon: Wallet, modulo: "financeiro" },
  { href: "/pendencias", label: "Pendências", icon: AlertTriangle, modulo: "pendencias" },
  { href: "/chamados", label: "Manutenção", icon: Wrench, modulo: "chamados" },
  { href: "/estoque", label: "Estoque", icon: Boxes, modulo: "estoque" },
  {
    href: "/produtos-consignados",
    label: "Consignados",
    icon: Package,
    modulo: "estoque",
  },
  { href: "/rotas", label: "Rotas", icon: Route, modulo: "rotas" },
  { href: "/equipe", label: "Equipe", icon: Users, modulo: "equipe" },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3, modulo: "relatorios" },
  { href: "/ia", label: "IA", icon: Bot, modulo: "ia" },
  {
    href: "/universidade",
    label: "Universidade",
    icon: GraduationCap,
    modulo: "universidade",
  },
  { href: "/suporte", label: "Suporte", icon: LifeBuoy, modulo: "suporte" },
  { href: "/auditoria", label: "Auditoria", icon: Shield, modulo: "auditoria" },
];

export const APP_NAV_BOTTOM: AppNavItem[] = [
  {
    href: "/configuracoes",
    label: "Configurações",
    icon: Settings,
    modulo: "configuracoes",
  },
];

export const APP_NAV_ITEMS: AppNavItem[] = [...APP_NAV_MAIN, ...APP_NAV_BOTTOM];

export const MOBILE_TAB_ITEMS: AppNavItem[] = [
  { href: "/dashboard", label: "Início", icon: Home, modulo: "dashboard" },
  { href: "/pontos", label: "Pontos", icon: MapPin, modulo: "pontos" },
  { href: "/coletas", label: "Coleta", icon: Package, modulo: "coletas" },
  { href: "/financeiro", label: "Financeiro", icon: Wallet, modulo: "financeiro" },
];

export const SIDEBAR_COLLAPSED_KEY = "or_sidebar_collapsed";
