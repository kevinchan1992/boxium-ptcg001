import { Home, Search, TrendingUp, User } from "lucide-react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: Home, label: "首頁", path: "/" },
  { icon: Search, label: "研究", path: "/research" },
  { icon: TrendingUp, label: "格價", path: "/pricing" },
  { icon: User, label: "用戶", path: "/profile" },
];

export function Sidebar() {
  const [location] = useLocation();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-16 border-r border-sidebar-border" style={{ backgroundColor: "#000000" }}>
      <div className="flex flex-col items-center py-4 space-y-6">

        {/* Navigation Items */}
        <nav className="flex flex-col items-center space-y-4 flex-1 mt-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path;
            
            return (
              <Link key={item.path} href={item.path}>
                <div
                  className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center cursor-pointer transition-all",
                    "hover:bg-white/10",
                    isActive ? "bg-[#fedd00] text-[#06038d]" : "text-white"
                  )}
                  title={item.label}
                >
                  <Icon className="w-5 h-5" />
                </div>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
