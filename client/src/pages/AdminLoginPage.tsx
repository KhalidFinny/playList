import React, { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, ArrowRight, UserPlus } from "lucide-react";
import { useAdminAuth } from "../features/admin/hooks/useAdminAuth";
import { socket } from "../shared/lib/socket";
import { Alert } from "../shared/components/Alert";
import { Button } from "../shared/components/button";
import { TextField } from "../shared/components/input";
import { Logo } from "../shared/components/Logo";
import { ThemeToggle } from "../shared/components/theme-toggle";
import { transitions } from "../shared/motion/springs";
import type { AdminUser } from "../shared/types";

type AdminLoginResponse = {
  success: boolean;
  token?: string;
  user?: AdminUser;
  error?: string;
};

export function AdminLoginPage() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAdminAuth();

  React.useEffect(() => {
    document.title = isRegistering ? "Register Admin Account | PLAY" : "Admin Login | PLAY";
  }, [isRegistering]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return setError("Missing fields");
    if (isRegistering && !inviteCode) return setError("Invite code is required");

    setLoading(true);
    setError(null);

    const eventName = isRegistering ? "admin_register" : "admin_login";
    const payload = isRegistering
      ? { username, email, password, inviteCode }
      : { username, password };

    socket.emit(eventName, payload, (res: AdminLoginResponse) => {
      setLoading(false);
      if (res.success) {
        if (isRegistering) {
          setIsRegistering(false);
          setPassword("");
          setError("Registration successful. Please log in.");
        } else if (res.token && res.user) {
          login(res.token, res.user);
          navigate({ to: "/admin" });
        }
      } else {
        setError(res.error ?? "Authentication failed");
      }
    });
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-surface px-4 py-12">
      <ThemeToggle className="absolute right-4 top-4" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={transitions.base}
        className="relative z-10 w-full max-w-sm"
      >
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo size={64} className="mb-5" />
          <h1 className="text-headline-large-emphasized">PLAY</h1>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-5 rounded-m3-xl bg-surface-container p-6"
        >
          <AnimatePresence mode="wait">
            {error && (
              <Alert
                type={error.includes("successful") ? "success" : "error"}
                message={error}
                onClose={() => setError(null)}
              />
            )}
          </AnimatePresence>

          <TextField
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />

          <AnimatePresence>
            {isRegistering && (
              <motion.div
                // No height animation here: framer measures `auto` when the
                // animation starts, and the web font loads afterwards, so the
                // container settles on a stale height and clips its content.
                // Animating opacity + y has no measured value to go stale.
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={transitions.fast}
                className="flex flex-col gap-5"
              >
                <TextField
                  label="Corporate email"
                  type="email"
                  required={isRegistering}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
                <TextField
                  label="Invite code"
                  required={isRegistering}
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  autoComplete="off"
                />
              </motion.div>
            )}
          </AnimatePresence>

          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />

          <Button type="submit" disabled={loading} size="md" className="mt-1 w-full">
            {loading ? "Processing…" : isRegistering ? "Register" : "Access hub"}
            {!loading && <ArrowRight size={20} />}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <Button
            type="button"
            variant="text"
            size="sm"
            onClick={() => {
              setIsRegistering(!isRegistering);
              setError(null);
            }}
          >
            {isRegistering ? (
              <>
                <Lock size={18} /> Return to login
              </>
            ) : (
              <>
                <UserPlus size={18} /> Register new admin
              </>
            )}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
