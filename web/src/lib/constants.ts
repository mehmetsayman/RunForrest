import {
  Home,
  Trophy,
  Users,
  User,
  Footprints,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  isCenter?: boolean;
};

export const APP_NAV: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/leaderboard", label: "Rank", icon: Trophy },
  { href: "/run", label: "Run", icon: Footprints, isCenter: true },
  { href: "/community", label: "Crew", icon: Users },
  { href: "/profile", label: "You", icon: User },
];

export const APP_NAME = "RunForrest";
export const APP_TAGLINE = "Proof of Active Lifestyle";
