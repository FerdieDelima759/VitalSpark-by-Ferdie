"use client";

import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, useEffect } from "react";
import {
  HiHome,
  HiOutlineHome,
  HiSparkles,
  HiOutlineSparkles,
  HiBolt,
  HiOutlineBolt,
  HiUser,
  HiOutlineUser,
  HiShieldCheck,
  HiOutlineShieldCheck,
} from "react-icons/hi2";
import { MdRestaurant, MdRestaurantMenu } from "react-icons/md";
import { isAdminFromStorage } from "@/utils/sessionStorage";

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  iconOutline: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

const allNavItems: NavItem[] = [
  {
    path: "/",
    label: "Home",
    icon: HiHome,
    iconOutline: HiOutlineHome,
  },
  {
    path: "/meals",
    label: "Meals",
    icon: MdRestaurant,
    iconOutline: MdRestaurantMenu,
  },
  {
    path: "/personal",
    label: "Personal",
    icon: HiSparkles,
    iconOutline: HiOutlineSparkles,
  },
  {
    path: "/workouts",
    label: "Workouts",
    icon: HiBolt,
    iconOutline: HiOutlineBolt,
  },
  {
    path: "/my-profile",
    label: "My Profile",
    icon: HiUser,
    iconOutline: HiOutlineUser,
  },
  {
    path: "/admin",
    label: "Admin",
    icon: HiShieldCheck,
    iconOutline: HiOutlineShieldCheck,
    adminOnly: true,
  },
];

export default function BottomNavBar() {
  const pathname = usePathname();
  const router = useRouter();

  const shouldHideBottomNav =
    pathname === "/workouts/exercise/session" ||
    pathname.startsWith("/workouts/exercise/session/");

  // Read admin status from session storage (synchronous, no API call)
  // Only read once on mount to prevent unnecessary refreshes
  const [isAdmin, setIsAdmin] = useState(() => isAdminFromStorage());

  // Listen for storage changes (in case role is updated elsewhere)
  // Also listen for custom events in case storage is updated in the same window
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "vitalspark_is_admin" || e.key === "vitalspark_user_role") {
        setIsAdmin(isAdminFromStorage());
      }
    };

    // Listen for custom storage events (for same-window updates)
    const handleCustomStorageChange = () => {
      setIsAdmin(isAdminFromStorage());
    };

    window.addEventListener("storage", handleStorageChange);
    // Listen for custom events when session storage is updated in the same window
    window.addEventListener("sessionStorageChange", handleCustomStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener(
        "sessionStorageChange",
        handleCustomStorageChange
      );
    };
  }, []);

  const navItems = useMemo(
    () => allNavItems.filter((item) => !item.adminOnly || isAdmin),
    [isAdmin]
  );

  const isActive = (path: string) => {
    if (path === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(path);
  };

  if (shouldHideBottomNav) {
    return null;
  }

  return (
    <nav className="main-bottom-nav fixed bottom-0 left-0 right-0 z-50 bg-white/95 border-t border-gray-200 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-white/90 dark:bg-slate-900 dark:border-slate-900 dark:shadow-black/40">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-around h-[70px] px-2 pt-1.5 pb-2.5">
          {navItems.map((item) => {
            const active = isActive(item.path);
            const IconComponent = active ? item.icon : item.iconOutline;

            return (
              <button
                key={item.path}
                onClick={() => router.push(item.path)}
                className={`flex flex-col items-center justify-center flex-1 h-full rounded-xl transition-colors ${
                  active
                    ? "text-[#f59e0b] dark:text-amber-300"
                    : "text-[#9ca3af] hover:text-[#6b7280] dark:text-slate-500 dark:hover:text-slate-300"
                }`}
              >
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-lg mb-1 transition-colors ${
                    active
                      ? "bg-amber-100 dark:bg-amber-400/20"
                      : "bg-transparent"
                  }`}
                >
                  <IconComponent className="w-5 h-5" />
                </div>
                <span
                  className={`text-[11px] font-medium ${
                    active
                      ? "text-[#f59e0b] dark:text-amber-300"
                      : "text-[#9ca3af] dark:text-slate-500"
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
