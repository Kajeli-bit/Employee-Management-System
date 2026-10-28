import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { FaDownload, FaLock, FaShieldAlt, FaUserSlash } from "react-icons/fa";

import { useAuth } from "../../context/useAuth";
import API_URL from "../../api";
import Loader from "../common/Loader";

const cardClass = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";
const actionButton = "rounded-xl px-3 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 disabled:cursor-not-allowed disabled:opacity-50";

const statusLabel = (enabled) => enabled === null ? "Unavailable" : enabled ? "Enabled" : "Not enabled";

const SecurityCenter = () => {
  const { getToken } = useAuth();
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [reason, setReason] = useState("");
  const [exportReason, setExportReason] = useState("");

  const request = useCallback(async (url, options = {}) => {
    const token = await getToken();
    return axios({
      url: `${API_URL}${url}`,
      ...options,
      headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) },
    });
  }, [getToken]);

  const refresh = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const response = await request("/api/super-user/overview");
      setOverview(response.data.overview);
      setError("");
    } catch (fetchError) {
      setError(fetchError.response?.data?.error || "Security details could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    let active = true;

    request("/api/super-user/overview")
      .then((response) => {
        if (!active) return;
        setOverview(response.data.overview);
        setError("");
      })
      .catch((fetchError) => {
        if (!active) return;
        setError(fetchError.response?.data?.error || "Security details could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [request]);

  const runRecovery = async (account, action) => {
    if (reason.trim().length < 8) {
      setError("Enter a reason of at least 8 characters before changing an account.");
      return;
    }
    const labels = { suspend: "Suspend this account", reactivate: "Reactivate this account", "revoke-sessions": "Sign out all active sessions" };
    if (!window.confirm(`${labels[action]} for ${account.name}? This action is recorded in the security audit.`)) return;
    setBusy(`${account.id}-${action}`);
    setError("");
    setNotice("");
    try {
      const response = await request(`/api/super-user/accounts/${account.id}/recovery`, {
        method: "POST",
        data: { action, reason: reason.trim() },
      });
      setNotice(action === "revoke-sessions" ? `${response.data.revokedSessions} session(s) revoked for ${account.name}.` : `${account.name} is now ${response.data.account.accountStatus}.`);
      setReason("");
      await refresh(true);
    } catch (actionError) {
      setError(actionError.response?.data?.error || "The recovery action failed.");
    } finally {
      setBusy("");
    }
  };

  const exportData = async (event) => {
    event.preventDefault();
    if (exportReason.trim().length < 8) {
      setError("Enter a reason of at least 8 characters to export company data.");
      return;
    }
    setBusy("export");
    setError("");
    setNotice("");
    try {
      const response = await request("/api/super-user/export", {
        method: "POST",
        data: { reason: exportReason.trim() },
        responseType: "blob",
      });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `company-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setExportReason("");
      setNotice("Company export downloaded. The action was recorded in the audit trail.");
      await refresh(true);
    } catch (actionError) {
      setError(actionError.response?.data?.error || "The company export failed.");
    } finally {
      setBusy("");
    }
  };

  if (loading && !overview) return <Loader label="Loading security center…" fullScreen />;

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-800"><FaShieldAlt aria-hidden="true" /> Restricted access</p>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-brand-950 sm:text-4xl">Security &amp; recovery</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Review account protection, recover company access, and inspect recorded privileged actions.</p>
          </div>
          <button type="button" onClick={() => refresh(true)} className={`${actionButton} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}>Refresh review</button>
        </header>

        {error && <div role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}
        {notice && <div role="status" className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}

        {overview && <>
          <section className="grid gap-4 sm:grid-cols-3" aria-label="Security summary">
            <div className={cardClass}><p className="text-sm text-slate-500">Employee directory</p><p className="mt-2 text-2xl font-semibold text-brand-950">{overview.employeeRecords}</p><p className="mt-1 text-xs text-slate-500">Staff records · super-user excluded</p></div>
            <div className={cardClass}><p className="text-sm text-slate-500">Privileged account</p><p className="mt-2 text-lg font-semibold text-brand-950">{overview.superUser?.name || "Not provisioned"}</p><p className="mt-1 text-xs text-slate-500">{overview.superUser?.email || "No separate account"}</p></div>
            <div className={cardClass}><p className="text-sm text-slate-500">Audit chain</p><p className={`mt-2 text-lg font-semibold ${overview.audit.integrity === "verified" ? "text-emerald-700" : "text-rose-700"}`}>{overview.audit.integrity === "verified" ? "Verified" : "Integrity warning"}</p><p className="mt-1 text-xs text-slate-500">{overview.audit.totalEvents} immutable event(s)</p></div>
          </section>

          <section className={`${cardClass} mt-5`}>
            <div className="flex items-start gap-3"><span className="rounded-xl bg-brand-100 p-3 text-brand-800"><FaLock aria-hidden="true" /></span><div><h2 className="text-lg font-semibold text-brand-950">Account recovery</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">Suspend access, restore a suspended account, or revoke every Clerk session. Each action requires a reason and is written to the audit chain.</p></div></div>
            <label className="mt-5 block text-sm font-medium text-slate-700" htmlFor="recovery-reason">Reason for recovery action</label>
            <textarea id="recovery-reason" value={reason} onChange={(event) => setReason(event.target.value)} rows={2} maxLength={500} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100" placeholder="For example: employee reported a lost device" />
            <div className="mt-4 divide-y divide-slate-100">
              {overview.accounts.map((account) => (
                <div key={account.id} className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0"><p className="truncate font-semibold text-brand-950">{account.name} <span className="font-normal text-slate-500">· {account.role}</span></p><p className="truncate text-sm text-slate-500">{account.email} · {account.accountStatus}</p><p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600"><span>MFA: {statusLabel(account.mfaEnabled)}</span><span>TOTP: {statusLabel(account.totpEnabled)}</span><span>Phone MFA: {statusLabel(account.phoneMfaEnabled)}</span></p></div>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    {account.accountStatus === "active" ? <button type="button" disabled={Boolean(busy)} onClick={() => runRecovery(account, "suspend")} className={`${actionButton} bg-rose-50 text-rose-800 hover:bg-rose-100`}><FaUserSlash className="mr-1 inline" aria-hidden="true" />Suspend</button> : <button type="button" disabled={Boolean(busy)} onClick={() => runRecovery(account, "reactivate")} className={`${actionButton} bg-emerald-50 text-emerald-800 hover:bg-emerald-100`}>Reactivate</button>}
                    <button type="button" disabled={Boolean(busy) || account.activeSessionCount === null} onClick={() => runRecovery(account, "revoke-sessions")} className={`${actionButton} border border-slate-300 text-slate-700 hover:bg-slate-50`}>{busy === `${account.id}-revoke-sessions` ? "Revoking…" : `Revoke sessions${account.activeSessionCount !== null ? ` · ${account.activeSessionCount}` : ""}`}</button>
                  </div>
                </div>
              ))}
              {!overview.accounts.length && <p className="py-4 text-sm text-slate-500">No linked accounts are available for recovery.</p>}
            </div>
          </section>

          <section className={`${cardClass} mt-5`}>
            <div className="flex items-start gap-3"><span className="rounded-xl bg-amber-100 p-3 text-amber-800"><FaDownload aria-hidden="true" /></span><div><h2 className="text-lg font-semibold text-brand-950">Company data export</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">Download company records as JSON. The export excludes login credentials and the super-user identity. The reason and export totals are recorded.</p></div></div>
            <form onSubmit={exportData} className="mt-4 flex flex-col gap-3 sm:flex-row">
              <label className="sr-only" htmlFor="export-reason">Reason for export</label>
              <input id="export-reason" value={exportReason} onChange={(event) => setExportReason(event.target.value)} maxLength={500} minLength={8} required className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100" placeholder="Reason for this export" />
              <button type="submit" disabled={Boolean(busy)} className={`${actionButton} bg-brand-800 text-white hover:bg-brand-900`}>{busy === "export" ? "Preparing export…" : "Download JSON"}</button>
            </form>
          </section>

          <section className={`${cardClass} mt-5`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2"><div><h2 className="text-lg font-semibold text-brand-950">Privileged action log</h2><p className="mt-1 text-sm text-slate-600">The newest 100 recorded security and recovery events.</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{overview.audit.integrity}</span></div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm"><thead className="border-y border-slate-200 text-xs text-slate-500"><tr><th className="py-2 pr-4 font-medium">Time</th><th className="py-2 pr-4 font-medium">Action</th><th className="py-2 pr-4 font-medium">Account</th><th className="py-2 pr-4 font-medium">Result</th><th className="py-2 font-medium">Reason</th></tr></thead><tbody className="divide-y divide-slate-100">{overview.audit.events.map((event) => <tr key={event.id}><td className="whitespace-nowrap py-3 pr-4 text-slate-500">{new Date(event.occurredAt).toLocaleString()}</td><td className="py-3 pr-4 font-medium text-brand-950">{event.action}</td><td className="py-3 pr-4 text-slate-700">{event.targetName || "Company"}</td><td className="py-3 pr-4"><span className={`rounded-full px-2 py-1 text-xs font-medium ${event.outcome === "success" ? "bg-emerald-50 text-emerald-800" : event.outcome === "failure" ? "bg-rose-50 text-rose-800" : "bg-amber-50 text-amber-800"}`}>{event.outcome}</span></td><td className="max-w-xs py-3 text-slate-600">{event.reason}</td></tr>)}</tbody></table>
              {!overview.audit.events.length && <p className="py-6 text-center text-sm text-slate-500">No privileged actions have been recorded.</p>}
            </div>
          </section>
        </>}
      </div>
    </main>
  );
};

export default SecurityCenter;
