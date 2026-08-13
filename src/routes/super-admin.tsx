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
  getUserRoles,
} from "@/integrations/firebase/auth";
import { firebaseAuth } from "@/integrations/firebase/client";
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
  "sourcer",
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

  // User creation state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createRoles, setCreateRoles] = useState<string[]>(["recruiter"]);
  const [creatingUser, setCreatingUser] = useState(false);

  // User edit state
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [editRoles, setEditRoles] = useState<string[]>([]);
  const [updatingRoles, setUpdatingRoles] = useState(false);

  useEffect(() => {
    const unsub = firebaseAuth.onAuthStateChanged(async (firebaseUser: any) => {
      if (firebaseUser) {
        // Check if user is super_admin or hr_admin
        const roles = await getUserRoles(firebaseUser.uid) as any[];
        if (roles.includes("super_admin")) {
          setCurrentUser(firebaseUser);
          loadUsers();
        } else {
          toast.error("Access denied. Authorized administrators only.");
          await firebaseSignOut();
          setCurrentUser(null);
        }
      } else {
        setCurrentUser(null);
      }
      setCheckingAuth(false);
    });
    return unsub;
  }, []);

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await listAllUsersFn();
      setUsers(res as UserRecord[]);
    } catch (err: any) {
      toast.error(err.message || "Failed to load users");
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSigningIn(true);
    try {
      const creds = await signInWithEmail(email, password);
      const roles = await getUserRoles(creds.user.uid) as any[];
      if (roles.includes("super_admin")) {
        setCurrentUser(creds.user);
        loadUsers();
      } else {
        toast.error("Access denied. Authorized administrators only.");
        await firebaseSignOut();
      }
    } catch (err: any) {
      toast.error(err.message || "Sign in failed");
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await firebaseSignOut();
      setCurrentUser(null);
    } catch (err: any) {
      toast.error(err.message || "Sign out failed");
    }
  };

  const handleToggleCreateRole = (role: string) => {
    setCreateRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const handleToggleEditRole = (role: string) => {
    setEditRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
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
          email: createEmail.trim(),
          password: createPassword,
          fullName: createName.trim(),
          roles: createRoles,
        },
      });
      toast.success("User created successfully");
      setShowCreateModal(false);
      setCreateName("");
      setCreateEmail("");
      setCreatePassword("");
      setCreateRoles(["recruiter"]);
      await loadUsers();
    } catch (err: any) {
      toast.error(err.message || "Failed to create user");
    } finally {
      setCreatingUser(false);
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
      <div className="min-h-screen bg-slate-50 text-foreground flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Verifying session...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 text-foreground flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-8 shadow-md space-y-6">
          <div className="text-center space-y-2">
            <div className="size-12 rounded-full bg-primary/10 text-primary mx-auto grid place-items-center">
              <Shield className="size-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Super Admin Portal</h1>
            <p className="text-sm text-muted-foreground">Access restricted to authorized administrators</p>
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
                className="bg-white border-slate-200 focus:border-primary mt-1"
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
                className="bg-white border-slate-200 focus:border-primary mt-1"
                placeholder="••••••••"
              />
            </div>
            <Button type="submit" disabled={signingIn} className="w-full mt-2">
              {signingIn ? "Signing in..." : "Access Dashboard"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">
              Return to landing page
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-foreground flex flex-col">
      <header className="border-b border-slate-200 bg-white px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded bg-primary/10 text-primary grid place-items-center font-bold">
            <Shield className="size-4" />
          </div>
          <span className="font-bold text-lg tracking-tight">TVSE Sync Admin Portal</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-muted-foreground font-mono hidden sm:inline">{currentUser.email}</span>
          <Button variant="ghost" onClick={handleSignOut} className="text-muted-foreground hover:text-foreground hover:bg-slate-100 gap-2">
            <LogOut className="size-4" /> Sign Out
          </Button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Users Management</h1>
            <p className="text-sm text-muted-foreground">View profiles, assign roles, create or delete application users.</p>
          </div>
          <Button onClick={() => setShowCreateModal(true)} className="gap-2">
            <Plus className="size-4" /> Create User
          </Button>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-md">
          {loadingUsers ? (
            <div className="py-20 flex flex-col items-center justify-center gap-2">
              <Loader2 className="size-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading user registry...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="py-20 text-center text-muted-foreground">
              No users found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-slate-50">
                    <th className="p-4">Name</th>
                    <th className="p-4">Email</th>
                    <th className="p-4">Roles</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-medium text-slate-800">{u.full_name || "—"}</td>
                      <td className="p-4 font-mono text-xs text-slate-600">{u.email}</td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1">
                          {u.roles.map((r) => (
                            <span
                              key={r}
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                r === "super_admin"
                                  ? "bg-purple-100 text-purple-800 border border-purple-200"
                                  : r === "hr_admin"
                                  ? "bg-red-100 text-red-800 border border-red-200"
                                  : r === "candidate"
                                  ? "bg-blue-100 text-blue-800 border border-blue-200"
                                  : "bg-slate-100 text-slate-700"
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
                          className="hover:bg-slate-100 hover:text-slate-900 text-muted-foreground size-8"
                        >
                          <Edit2 className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={u.id === currentUser.uid}
                          onClick={() => handleDeleteUser(u.id)}
                          className="hover:bg-red-100 hover:text-red-600 text-muted-foreground size-8"
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

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="text-lg font-bold">Create User Account</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-muted-foreground hover:text-foreground">
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
                  className="bg-white border-slate-200 mt-1"
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
                  className="bg-white border-slate-200 mt-1"
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
                  className="bg-white border-slate-200 mt-1"
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
                            ? "bg-primary/10 border-primary text-primary font-medium"
                            : "bg-white border-slate-200 text-muted-foreground hover:bg-slate-50"
                        }`}
                      >
                        <span>{role}</span>
                        {isSel && <Check className="size-3.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-3 border-t border-slate-200">
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

      {editingUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-lg font-bold">Edit User Roles</h2>
                <p className="text-xs text-muted-foreground">{editingUser.email}</p>
              </div>
              <button onClick={() => setEditingUser(null)} className="text-muted-foreground hover:text-foreground">
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
                            ? "bg-primary/10 border-primary text-primary font-medium"
                            : "bg-white border-slate-200 text-muted-foreground hover:bg-slate-50"
                        }`}
                      >
                        <span>{role}</span>
                        {isSel && <Check className="size-3.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-3 border-t border-slate-200">
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
