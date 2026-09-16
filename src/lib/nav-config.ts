import {
  LayoutDashboard,
  Server,
  Network,
  HardDrive,
  Users,
  CalendarClock,
  Archive,
  Activity,
  Settings,
  HelpCircle,
  Box,
  type LucideIcon,
} from "@/lib/icons";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Servers", href: "/servers", icon: Server },
      { label: "Plugins & Mods", href: "/plugins", icon: Box },
      { label: "Networks", href: "/networks", icon: Network },
      { label: "Nodes", href: "/nodes", icon: HardDrive },
    ],
  },
  {
    label: "Management",
    items: [
      { label: "Users", href: "/users", icon: Users },
      { label: "Backups", href: "/backups", icon: Archive },
      { label: "Schedules", href: "/schedules", icon: CalendarClock },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Activity", href: "/activity", icon: Activity },
      { label: "Settings", href: "/settings", icon: Settings },
      { label: "Help", href: "/help", icon: HelpCircle },
    ],
  },
];

export const SERVER_DETAIL_NAV = [
  { label: "Overview", segment: "" },
  { label: "Console", segment: "console" },
  { label: "Players", segment: "players" },
  { label: "Files", segment: "files" },
  { label: "Plugins", segment: "plugins" },
  { label: "Worlds", segment: "worlds" },
  { label: "Backups", segment: "backups" },
  { label: "Schedules", segment: "schedules" },
  { label: "Network", segment: "network" },
  { label: "Settings", segment: "settings" },
] as const;
