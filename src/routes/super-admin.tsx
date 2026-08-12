import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  waitForFirebaseUser,
  signInWithEmail,
  firebaseSignOut,
} from "@/integrations/firebase/auth";
import {
  listAllUsersFn,
  adminCreateAnyUserFn,
  adminUpdateUserRolesFn,
  adminDeleteUserFn,
} from "@/lib/admin-users.functions";
import { Shield, Plus, Trash2, Edit2, LogOut, Check, X, ShieldAlert, Loader2 } from "lucide-react";

export const Route = createFileRoute("/super-admin")({
  component: SuperAdminPortal,
});

type UserRecord = {
  id: string;
  full_name: string;
  email: string;
  roles: string[];
};

const ALL_ROLES = [
  "super_admin",
  "hr_admin",
  "recruitment_manager",
  "recruiter",
  "hiring_manager",
  "candidate",
];

function SuperAdminPortal() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Sign in state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signingIn, setSigningIn] = useState(false);

  // Create User form state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createName, setCreateName] = useState("");
  const [createRoles, setCreateRoles] = useState<string[]>(["recruiter"]);
  const [creatingUser, setCreatingUser] = useState(false);

  // Edit Roles state
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [editRoles, setEditRoles] = useState<string[]>([]);
  const [updatingRoles, setUpdatingRoles] = useState(false);

  const navigate = useNavigate();

  const checkAuthAndLoad = async () => {
    setCheckingAuth(true);
    try {
      const user = await waitForFirebaseUser();
      if (user) {
        setCurrentUser(user);
        await loadUsers();
      } else {
        setCurrentUser(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCheckingAuth(false);
    }
  };

  useEffect(() => {
    checkAuthAndLoad();
  }, []);

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const data = await listAllUsersFn();
      setUsers(data as UserRecord[]);
    } catch (err: any) {
      toast.error(err.message || "Failed to load users. Make sure you are a super_admin.");
      // If forbidden, sign out or clear user state
      if (err.message?.includes("Forbidden")) {
        await firebaseSignOut();
        setCurrentUser(null);
      }
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSigningIn(true);
    try {
      await signInWithEmail(email, password);
      toast.success("Signed in successfully");
      await checkAuthAndLoad();
    } catch (err: any) {
      toast.error(err.message || "Invalid credentials");
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await firebaseSignOut();
    setCurrentUser(null);
    setUsers([]);
    toast.success("Signed out");
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (createRoles.length === 0) {
      toast.error("Please select at least one role");
      return;
    }
    setCreatingUser(true);
    try {
      await adminCreateAnyUserFn({
        data: {
          email: createEmail,
          fullName: createName,
          password: createPassword,
          roles: createRoles,
        },
      });
      toast.success("User created successfully");
      setShowCreateModal(false);
      // Reset form
      setCreateEmail("");
      setCreatePassword("");
      setCreateName("");
      setCreateRoles(["recruiter"]);
      await loadUsers();
    } catch (err: any) {
      toast.error(err.message || "Failed to create user");
    } finally {
      setCreatingUser(false);
    }
  };

  const handleToggleCreateRole = (role: string) => {
    if (createRoles.includes(role)) {
      setCreateRoles(createRoles.filter((r) => r !== role));
    } else {
      setCreateRoles([...createRoles, role]);
    }
  };

  const handleToggleEditRole = (role: string) => {
    if (editRoles.includes(role)) {
      setEditRoles(editRoles.filter((r) => r !== role));
    } else {
      setEditRoles([...editRoles, role]);
    }
  };

  const handleSaveRoles = async () => {
    if (!editingUser) return;
    if (editRoles.length === 0) {
      toast.error("Please select at least one role");
      return;
    }
    setUpdatingRoles(true);
    try {
      await adminUpdateUserRolesFn({
        data: {
          targetUserId: editingUser.id,
          roles: editRoles,
        },
      });
      toast.success("Roles updated successfully");
      setEditingUser(null);
      await loadUsers();
    } catch (err: any) {
      toast.error(err.message || "Failed to update roles");
    } finally {
      setUpdatingRoles(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user? This cannot be undone.")) return;
    try {
      await adminDeleteUserFn({
        data: {
          targetUserId: userId,
        },
      });
      toast.success("User deleted successfully");
      await loadUsers();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete user");
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="size-8 animate-spin text-accent" />
          <p className="text-sm text-slate-400">Verifying session...</p>
        </div>
      </div>
    );
  }

  // 1. Sign In Screen
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-6">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="size-10 rounded-lg bg-accent/20 text-accent grid place-items-center">
              <Shield className="size-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Super Admin Portal</h1>
              <p className="text-xs text-slate-400">Access restricted to authorized administrators</p>
            </div>
          </div>

          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-slate-950 border-slate-800 focus:border-accent mt-1"
                placeholder="admin@example.com"
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-slate-950 border-slate-800 focus:border-accent mt-1"
                placeholder="••••••••"
              />
            </div>
            <Button type="submit" disabled={signingIn} className="w-full mt-2">
              {signingIn ? "Signing in..." : "Access Dashboard"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link to="/" className="text-xs text-slate-400 hover:text-slate-200">
              Return to landing page
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 2. Dashboard Screen
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded bg-accent/20 text-accent grid place-items-center font-bold">
            <Shield className="size-4" />
          </div>
          <span className="font-bold text-lg tracking-tight">TalentFlow Admin Portal</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-slate-400 font-mono hidden sm:inline">{currentUser.email}</span>
          <Button variant="ghost" onClick={handleSignOut} className="text-slate-400 hover:text-slate-100 hover:bg-slate-800 gap-2">
            <LogOut className="size-4" /> Sign Out
          </Button>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Users Management</h1>
            <p className="text-sm text-slate-400">View profiles, assign roles, create or delete application users.</p>
          </div>
          <Button onClick={() => setShowCreateModal(true)} className="gap-2">
            <Plus className="size-4" /> Create User
          </Button>
        </div>

        {/* User list */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
          {loadingUsers ? (
            <div className="py-20 flex flex-col items-center justify-center gap-2">
              <Loader2 className="size-8 animate-spin text-accent" />
              <p className="text-sm text-slate-400">Loading user registry...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="py-20 text-center text-slate-400">
              No users found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-950/40">
                    <th className="p-4">Name</th>
                    <th className="p-4">Email</th>
                    <th className="p-4">Roles</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-950/20 transition-colors">
                      <td className="p-4 font-medium text-slate-200">{u.full_name || "—"}</td>
                      <td className="p-4 font-mono text-xs text-slate-300">{u.email}</td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1">
                          {u.roles.map((r) => (
                            <span
                              key={r}
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                r === "super_admin"
                                  ? "bg-purple-950/80 text-purple-300 border border-purple-800"
                                  : r === "hr_admin"
                                  ? "bg-red-950/80 text-red-300 border border-red-800"
                                  : r === "candidate"
                                  ? "bg-blue-950/80 text-blue-300 border border-blue-800"
                                  : "bg-slate-800 text-slate-300"
                              }`}
                            >
                              {r}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-4 text-right space-x-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingUser(u);
                            setEditRoles(u.roles);
                          }}
                          className="hover:bg-slate-800 hover:text-slate-100 text-slate-400 size-8"
                        >
                          <Edit2 className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={u.id === currentUser.uid}
                          onClick={() => handleDeleteUser(u.id)}
                          className="hover:bg-red-950/30 hover:text-red-400 text-slate-400 size-8"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold">Create User Account</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-100">
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3">
              <div>
                <Label htmlFor="create-name">Full Name</Label>
                <Input
                  id="create-name"
                  required
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  className="bg-slate-950 border-slate-800 mt-1"
                />
              </div>
              <div>
                <Label htmlFor="create-email">Email Address</Label>
                <Input
                  id="create-email"
                  type="email"
                  required
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  className="bg-slate-950 border-slate-800 mt-1"
                />
              </div>
              <div>
                <Label htmlFor="create-password">Password</Label>
                <Input
                  id="create-password"
                  type="password"
                  required
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  className="bg-slate-950 border-slate-800 mt-1"
                />
              </div>

              <div>
                <Label className="block mb-2">Assigned Roles</Label>
                <div className="grid grid-cols-2 gap-2">
                  {ALL_ROLES.map((role) => {
                    const isSel = createRoles.includes(role);
                    return (
                      <button
                        type="button"
                        key={role}
                        onClick={() => handleToggleCreateRole(role)}
                        className={`text-xs p-2 rounded border flex items-center justify-between transition-colors ${
                          isSel
                            ? "bg-accent/15 border-accent text-accent font-medium"
                            : "bg-slate-950 border-slate-800 text-slate-400"
                        }`}
                      >
                        <span>{role}</span>
                        {isSel && <Check className="size-3.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-3 border-t border-slate-800">
                <Button type="button" variant="ghost" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={creatingUser}>
                  {creatingUser ? "Creating..." : "Create User"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Roles Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-lg font-bold">Edit User Roles</h2>
                <p className="text-xs text-slate-400">{editingUser.email}</p>
              </div>
              <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-slate-100">
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="block mb-2">Roles for {editingUser.full_name || "User"}</Label>
                <div className="grid grid-cols-2 gap-2">
                  {ALL_ROLES.map((role) => {
                    const isSel = editRoles.includes(role);
                    return (
                      <button
                        type="button"
                        key={role}
                        onClick={() => handleToggleEditRole(role)}
                        className={`text-xs p-2 rounded border flex items-center justify-between transition-colors ${
                          isSel
                            ? "bg-accent/15 border-accent text-accent font-medium"
                            : "bg-slate-950 border-slate-800 text-slate-400"
                        }`}
                      >
                        <span>{role}</span>
                        {isSel && <Check className="size-3.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-3 border-t border-slate-800">
                <Button variant="ghost" onClick={() => setEditingUser(null)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveRoles} disabled={updatingRoles}>
                  {updatingRoles ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
