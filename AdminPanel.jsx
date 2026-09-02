import React, { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Link2,
  LogOut,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { supabase } from "./config";
import "./admin-ui.css";

const emptyForm = {
  full_name: "",
  email: "",
  password: "",
  title: "",
  url: "",
  logo_url: "",
};

export default function AdminPanel({ user, onLogout }) {
  const [profiles, setProfiles] = useState([]);
  const [links, setLinks] = useState([]);
  const [stats, setStats] = useState({
    users: 0,
    logins: 0,
    transfers: 0,
    todayLogins: 0,
    todayTransfers: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal] = useState(null);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    if (!supabase) return;

    setRefreshing(true);
    const now = new Date();
    const start = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    ).toISOString();

    const [profilesResult, linksResult, loginResult, transferResult] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("id,full_name,role,disabled,created_at,last_login_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("important_links")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("login_events")
          .select("id,created_at", { count: "exact", head: true }),
        supabase
          .from("transfer_events")
          .select("id,created_at", { count: "exact", head: true }),
      ]);

    const [todayLoginsResult, todayTransfersResult] = await Promise.all([
      supabase
        .from("login_events")
        .select("id", { count: "exact", head: true })
        .gte("created_at", start),
      supabase
        .from("transfer_events")
        .select("id", { count: "exact", head: true })
        .gte("created_at", start),
    ]);

    const profileRows = profilesResult.data || [];
    setProfiles(profileRows);
    setLinks(linksResult.data || []);
    setStats({
      users: profileRows.filter((item) => item.role === "user").length,
      logins: loginResult.count || 0,
      transfers: transferResult.count || 0,
      todayLogins: todayLoginsResult.count || 0,
      todayTransfers: todayTransfersResult.count || 0,
    });

    setRefreshing(false);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
  }, []);

  const users = useMemo(
    () => profiles.filter((profile) => profile.role === "user"),
    [profiles]
  );

  const resetForm = () => setForm(emptyForm);

  async function createUser(event) {
    event.preventDefault();
    setMessage("");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      setMessage("Admin session expired. Please login again.");
      return;
    }

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-user-management`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "create",
          full_name: form.full_name,
          email: form.email,
          password: form.password,
        }),
      }
    );

    let result = {};
    try {
      result = await response.json();
    } catch {
      result = {};
    }

    if (!response.ok) {
      setMessage(result.error || "User create failed");
      return;
    }

    setModal(null);
    resetForm();
    await load();
  }

  async function toggleUser(profile) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) return;

    await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-user-management`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: profile.disabled ? "enable" : "disable",
          user_id: profile.id,
        }),
      }
    );

    await load();
  }

  async function addLink(event) {
    event.preventDefault();
    setMessage("");

    const { error } = await supabase.from("important_links").insert({
      title: form.title,
      url: form.url,
      logo_url: form.logo_url || null,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setModal(null);
    resetForm();
    await load();
  }

  async function deleteLink(id) {
    if (!window.confirm("Delete this link?")) return;
    await supabase.from("important_links").delete().eq("id", id);
    await load();
  }

  const closeModal = () => {
    setModal(null);
    setMessage("");
    resetForm();
  };

  return (
    <div className="admin-shell">
      <header className="admin-top">
        <div className="admin-brand">
          <Shield size={22} />
          <div>
            <b>PrintBhejo Admin</b>
            <span>Control Panel</span>
          </div>
        </div>

        <div className="admin-account">
          <span>{user?.email}</span>
          <button onClick={onLogout} type="button">
            <LogOut size={17} /> Logout
          </button>
        </div>
      </header>

      <main className="admin-main">
        <div className="admin-heading">
          <div>
            <h1>Dashboard</h1>
            <p>Analytics automatically refresh every 1 minute.</p>
          </div>
          <button
            className="refresh"
            onClick={load}
            disabled={refreshing}
            type="button"
          >
            <RefreshCw size={17} />
            {refreshing ? "Updating…" : "Refresh"}
          </button>
        </div>

        <section className="stat-grid">
          <Stat icon={<Users />} label="Total Users" value={stats.users} />
          <Stat icon={<Shield />} label="Total Logins" value={stats.logins} />
          <Stat
            icon={<BarChart3 />}
            label="Today's Logins"
            value={stats.todayLogins}
          />
          <Stat
            icon={<BarChart3 />}
            label="Total Transfers"
            value={stats.transfers}
          />
          <Stat
            icon={<BarChart3 />}
            label="Today's Transfers"
            value={stats.todayTransfers}
          />
        </section>

        <div className="admin-columns">
          <section className="admin-card">
            <div className="card-head">
              <h2>User Management</h2>
              <button
                onClick={() => {
                  setMessage("");
                  setModal("user");
                }}
                type="button"
              >
                <UserPlus size={17} /> Add User
              </button>
            </div>

            {loading ? (
              <p>Loading…</p>
            ) : (
              <div className="user-list">
                {users.map((profile) => (
                  <div className="user-row" key={profile.id}>
                    <div>
                      <b>{profile.full_name || "Unnamed user"}</b>
                      <small>{profile.id.slice(0, 8)}…</small>
                    </div>
                    <span className={profile.disabled ? "off" : "on"}>
                      {profile.disabled ? "Disabled" : "Active"}
                    </span>
                    <button onClick={() => toggleUser(profile)} type="button">
                      {profile.disabled ? "Enable" : "Disable"}
                    </button>
                  </div>
                ))}
                {!users.length && <p>No users yet.</p>}
              </div>
            )}
          </section>

          <section className="admin-card">
            <div className="card-head">
              <h2>Important Links</h2>
              <button
                onClick={() => {
                  setMessage("");
                  setModal("link");
                }}
                type="button"
              >
                <Plus size={17} /> Add Link
              </button>
            </div>

            <div className="link-list">
              {links.map((link) => (
                <div className="link-row" key={link.id}>
                  {link.logo_url ? (
                    <img src={link.logo_url} alt="" />
                  ) : (
                    <Link2 />
                  )}
                  <div>
                    <b>{link.title}</b>
                    <small>{link.url}</small>
                  </div>
                  <button
                    onClick={() => deleteLink(link.id)}
                    aria-label="Delete"
                    type="button"
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              ))}
              {!links.length && <p>No links added.</p>}
            </div>
          </section>
        </div>
      </main>

      {modal && (
        <div className="modal-backdrop">
          <div className="admin-modal">
            <button
              className="modal-close"
              onClick={closeModal}
              aria-label="Close"
              type="button"
            >
              <X />
            </button>

            {modal === "user" ? (
              <>
                <h2>Create New User</h2>
                <form onSubmit={createUser}>
                  <input
                    required
                    placeholder="User Name"
                    value={form.full_name}
                    onChange={(event) =>
                      setForm({ ...form, full_name: event.target.value })
                    }
                  />
                  <input
                    required
                    type="email"
                    placeholder="Login ID / Email"
                    value={form.email}
                    onChange={(event) =>
                      setForm({ ...form, email: event.target.value })
                    }
                  />
                  <input
                    required
                    minLength="6"
                    type="password"
                    placeholder="Password (6+ characters)"
                    value={form.password}
                    onChange={(event) =>
                      setForm({ ...form, password: event.target.value })
                    }
                  />
                  {message && <p className="form-error">{message}</p>}
                  <button className="admin-primary" type="submit">
                    Create User
                  </button>
                </form>
              </>
            ) : (
              <>
                <h2>Add Important Link</h2>
                <form onSubmit={addLink}>
                  <input
                    required
                    placeholder="Link Name"
                    value={form.title}
                    onChange={(event) =>
                      setForm({ ...form, title: event.target.value })
                    }
                  />
                  <input
                    required
                    type="url"
                    placeholder="https://example.com"
                    value={form.url}
                    onChange={(event) =>
                      setForm({ ...form, url: event.target.value })
                    }
                  />
                  <input
                    placeholder="Logo URL (optional)"
                    value={form.logo_url}
                    onChange={(event) =>
                      setForm({ ...form, logo_url: event.target.value })
                    }
                  />
                  {message && <p className="form-error">{message}</p>}
                  <button className="admin-primary" type="submit">
                    Add Link
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, value }) {
  return (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>
      <span>{label}</span>
      <strong>{Number(value || 0).toLocaleString()}</strong>
    </div>
  );
}
