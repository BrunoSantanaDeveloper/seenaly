import { MenuItem } from "@/types";

// Seenaly product menu only. The template's demo surfaces (dashboards,
// applications, pages, ui, menu-levels, single-menu) were pruned at launch
// prep; their routes remain on disk for clean template merges, they are just
// not reachable from the navigation.
export const leftMenuItems: MenuItem[] = [
  {
    id: "home",
    icon: "NiHome",
    label: "menu-home",
    description: "menu-home-description",
    color: "text-primary",
    href: "/home",
  },
  {
    id: "products",
    icon: "NiTag",
    // Not "menu-products": the template already uses that key for the
    // e-commerce demo menu, and duplicate JSON keys silently collide.
    label: "menu-product-context",
    description: "menu-product-context-description",
    color: "text-primary",
    href: "/products",
  },
  {
    id: "library",
    icon: "NiCamera",
    label: "menu-library",
    description: "menu-library-description",
    color: "text-primary",
    href: "/library",
  },
  {
    id: "experiments",
    icon: "NiFlask",
    label: "menu-learnings",
    description: "menu-learnings-description",
    color: "text-primary",
    href: "/experiments",
  },
  {
    id: "admin",
    icon: "NiCrown",
    label: "menu-admin",
    description: "menu-admin-description",
    color: "text-primary",
    href: "/admin",
    superadminOnly: true,
    children: [
      {
        id: "admin-overview",
        icon: "NiDashboard",
        label: "menu-admin-overview",
        href: "/admin",
        description: "menu-admin-overview-description",
      },
      {
        id: "admin-organizations",
        icon: "NiBuilding",
        label: "menu-admin-organizations",
        href: "/admin/organizations",
        description: "menu-admin-organizations-description",
      },
      {
        id: "admin-billing",
        icon: "NiMoney",
        label: "menu-admin-billing",
        href: "/admin/billing",
        description: "menu-admin-billing-description",
      },
      {
        id: "admin-ai",
        icon: "NiAI",
        label: "menu-admin-ai",
        href: "/admin/ai",
        description: "menu-admin-ai-description",
      },
      {
        id: "admin-knowledge",
        icon: "NiBook",
        label: "menu-admin-knowledge",
        href: "/admin/knowledge",
        description: "menu-admin-knowledge-description",
      },
      {
        id: "admin-audit",
        icon: "NiShieldCheck",
        label: "menu-admin-audit",
        href: "/admin/audit",
        description: "menu-admin-audit-description",
      },
      {
        id: "admin-insights",
        icon: "NiChartLineBar",
        label: "menu-admin-insights",
        href: "/admin/insights",
        description: "menu-admin-insights-description",
      },
      {
        id: "admin-backups",
        icon: "NiArchive",
        label: "menu-admin-backups",
        href: "/admin/backups",
        description: "menu-admin-backups-description",
      },
      {
        id: "admin-announcements",
        icon: "NiAnnouncement",
        label: "menu-admin-announcements",
        href: "/admin/announcements",
        description: "menu-admin-announcements-description",
      },
      {
        id: "admin-help",
        icon: "NiQuestionHexagon",
        label: "menu-admin-help",
        href: "/admin/help",
        description: "menu-admin-help-description",
      },
      {
        id: "admin-blog",
        icon: "NiPen",
        label: "menu-admin-blog",
        href: "/admin/blog",
        description: "menu-admin-blog-description",
      },
    ],
  },
];

export const leftMenuBottomItems: MenuItem[] = [
  { id: "settings", label: "menu-settings", href: "/settings", icon: "NiSettings" },
];
