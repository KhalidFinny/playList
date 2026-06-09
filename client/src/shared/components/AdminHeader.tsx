import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { LogOut, Menu, X } from "lucide-react";
import { Tabs, type TabItem } from "./Tabs";
import { SecretDoor } from "./SecretDoor";

interface AdminHeaderProps {
  user?: {
    username: string;
    role: string;
  };
  connected?: boolean;
  tabs?: TabItem[];
  activeTab?: string;
  onTabChange?: (id: string) => void;
  onLogout: () => void;
  showBackToHub?: boolean;
  title?: string;
}

export function AdminHeader({
  user,
  connected = true,
  tabs,
  activeTab,
  onTabChange,
  onLogout,
  showBackToHub = false,
  title,
}: AdminHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-8 py-4 sm:py-6 flex justify-between items-center bg-white/10 backdrop-blur-sm">
      <div className="max-w-[1600px] w-full mx-auto flex items-center justify-between">
        {/* Left Section: Branding & Context */}
        <div className="flex items-center gap-3 sm:gap-5">
          <SecretDoor size="xl" />
          <div className="flex flex-col">
            <span className="text-black font-bebas text-3xl sm:text-5xl tracking-tighter leading-none uppercase">
              PLAY LIST
            </span>
            <span className="text-[10px] sm:text-xs text-black/20 font-bold uppercase tracking-[0.2em] leading-none mt-1">
              {title || "Archive Admin"}
            </span>
          </div>

          <div className="hidden lg:block w-px h-8 bg-black/5" />

          {/* Optional Center Tabs — desktop only */}
          {tabs && activeTab && onTabChange && (
            <div className="hidden lg:block ml-4">
              <Tabs tabs={tabs} activeTab={activeTab} onChange={onTabChange} />
            </div>
          )}
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-3 sm:gap-8">
          {/* Connection Status — hide on very small screens */}
          <div className="hidden sm:flex items-center gap-2 sm:gap-4 px-3 sm:px-8 py-2 sm:py-4 bg-black/5 rounded-full">
            <div
              className={`w-2 h-2 rounded-full ${connected ? "bg-green-500 animate-pulse" : "bg-red-500"}`}
            />
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-black/40">
              {connected ? "LIVE" : "OFFLINE"}
            </span>
          </div>

          {/* Connection dot — always visible on very small screens */}
          <div className="sm:hidden">
            <div
              className={`w-2 h-2 rounded-full ${connected ? "bg-green-500 animate-pulse" : "bg-red-500"}`}
            />
          </div>

          {/* User Info — desktop only */}
          {user && (
            <div className="hidden md:flex flex-col items-end">
              <span className="text-base font-bold text-black leading-none">
                {user.username.toUpperCase()}
              </span>
              <span className="text-xs font-bold text-orange-500 uppercase tracking-widest mt-1.5">
                {user.role === "super_admin" ? "Head Admin" : "Station Admin"}
              </span>
            </div>
          )}

          {/* Navigation Links */}
          <div className="flex items-center gap-2 sm:gap-3">
            {showBackToHub && (
              <>
                {/* Desktop: full button */}
                <Link
                  to="/admin"
                  className="hidden sm:inline-flex px-4 sm:px-10 py-3 sm:py-4 bg-[#f8f8f6] hover:bg-black hover:text-white text-xs font-bold uppercase tracking-widest rounded-xl transition-all"
                >
                  Hub
                </Link>
                {/* Mobile: compact icon */}
                <Link
                  to="/admin"
                  className="sm:hidden w-9 h-9 rounded-xl bg-black/5 flex items-center justify-center text-black/30 hover:text-black hover:bg-black/10 transition-all"
                  title="Back to Hub"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                </Link>
              </>
            )}

            <button
              onClick={onLogout}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-black/5 flex items-center justify-center text-black/20 hover:text-red-500 hover:bg-red-50 transition-all active:scale-90"
              title="Logout"
            >
              <LogOut size={18} />
            </button>

            {/* Mobile menu toggle — only when there are tabs */}
            {tabs && tabs.length > 0 && (
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden w-9 h-9 rounded-xl bg-black/5 flex items-center justify-center text-black/40 hover:text-black transition-all"
                title="Menu"
              >
                {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile tab bar shown below header when menu is open */}
      {tabs && activeTab && onTabChange && mobileMenuOpen && (
        <div className="lg:hidden absolute top-full left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-black/5 shadow-lg">
          <div className="flex flex-col p-4 gap-2">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    onTabChange(tab.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold uppercase tracking-widest transition-all ${
                    isActive
                      ? "bg-orange-500/10 text-orange-600"
                      : "text-black/40 hover:bg-black/5 hover:text-black/70"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
}
