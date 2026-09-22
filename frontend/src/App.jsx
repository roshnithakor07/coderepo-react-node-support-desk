import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { agentApi } from "./features/agents/agent.api.js";
import { analyticsApi } from "./features/analytics/analytics.api.js";
import { authApi } from "./features/auth/auth.api.js";
import { AuthScreen } from "./features/auth/AuthScreen.jsx";
import { cannedResponseApi } from "./features/canned-responses/canned-response.api.js";
import { CannedResponsesPage } from "./features/canned-responses/CannedResponsesPage.jsx";
import { NotificationBell } from "./features/notifications/NotificationBell.jsx";
import { notificationApi } from "./features/notifications/notification.api.js";
import { NewTicketModal } from "./features/tickets/NewTicketModal.jsx";
import { ticketApi } from "./features/tickets/ticket.api.js";
import { TicketDetail } from "./features/tickets/TicketDetail.jsx";
import { TicketList } from "./features/tickets/TicketList.jsx";
import { AgentsPage } from "./features/agents/AgentsPage.jsx";
import { AnalyticsPage } from "./features/analytics/AnalyticsPage.jsx";
import { Dashboard } from "./features/workspace/Dashboard.jsx";
import { ProfilePage } from "./features/workspace/ProfilePage.jsx";
import { settingsApi } from "./features/workspace/settings.api.js";
import { SettingsPage } from "./features/workspace/SettingsPage.jsx";
import { Sidebar } from "./features/workspace/Sidebar.jsx";
import { hasSessionToken, setSessionToken } from "./shared/api/client.js";
import { ToastStack } from "./shared/components/Toast.jsx";
import { applyTheme, getStoredTheme } from "./shared/utils/theme.js";
import { friendlyErrorMessage } from "./shared/utils/validate.js";

const NOTIFICATION_POLL_MS = 15000;

export default function App() {
    const [theme, setTheme] = useState(getStoredTheme());
    const [isBootstrapping, setIsBootstrapping] = useState(true);
    const [currentUser, setCurrentUser] = useState(null);
    const [authError, setAuthError] = useState("");
    const [authBusy, setAuthBusy] = useState(false);

    const [activeView, setActiveView] = useState("dashboard");
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [selectedTicketId, setSelectedTicketId] = useState(null);
    const [showNewTicketModal, setShowNewTicketModal] = useState(false);
    const [isCreatingTicket, setIsCreatingTicket] = useState(false);
    const [isUpdatingTicket, setIsUpdatingTicket] = useState(false);

    const [tickets, setTickets] = useState([]);
    const [ticketsTotal, setTicketsTotal] = useState(0);
    const [ticketFilters, setTicketFilters] = useState({ page: 1, pageSize: 20 });
    const [ticketsLoading, setTicketsLoading] = useState(false);
    const [ticketCreateError, setTicketCreateError] = useState("");
    const [isReplying, setIsReplying] = useState(false);

    const [selectedTicket, setSelectedTicket] = useState(null);
    const [auditTrail, setAuditTrail] = useState(null);

    const [agents, setAgents] = useState([]);
    const [agentsLoading, setAgentsLoading] = useState(false);
    const [agentError, setAgentError] = useState("");
    const [agentBusy, setAgentBusy] = useState(false);

    const [cannedResponses, setCannedResponses] = useState([]);
    const [cannedError, setCannedError] = useState("");
    const [cannedBusy, setCannedBusy] = useState(false);

    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);

    const [analyticsDashboard, setAnalyticsDashboard] = useState(null);
    const [analyticsFilters, setAnalyticsFilters] = useState({});
    const [analyticsLoading, setAnalyticsLoading] = useState(false);

    const [settings, setSettings] = useState(null);
    const [settingsBusy, setSettingsBusy] = useState(false);
    const [settingsError, setSettingsError] = useState("");

    const [toasts, setToasts] = useState([]);
    const toastIdRef = useRef(0);

    const pushToast = useCallback((type, message) => {
        toastIdRef.current += 1;
        const id = toastIdRef.current;
        setToasts((current) => [...current, { id, type, message }]);
    }, []);

    const dismissToast = useCallback((id) => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
    }, []);

    useEffect(() => {
        applyTheme(theme);
    }, [theme]);

    const canManage = currentUser && (currentUser.role === "admin" || currentUser.role === "agent");

    // Bootstrap session from stored token.
    useEffect(() => {
        if (!hasSessionToken()) {
            setIsBootstrapping(false);
            return;
        }
        authApi
            .me()
            .then((user) => setCurrentUser(user))
            .catch(() => setSessionToken(""))
            .finally(() => setIsBootstrapping(false));
    }, []);

    useEffect(() => {
        function handleExpired() {
            setCurrentUser(null);
            pushToast("info", "Your session expired. Please sign in again.");
        }
        window.addEventListener("support-desk-session-expired", handleExpired);
        return () => window.removeEventListener("support-desk-session-expired", handleExpired);
    }, [pushToast]);

    const loadTickets = useCallback(() => {
        if (!currentUser) return;
        setTicketsLoading(true);
        ticketApi
            .list(ticketFilters)
            .then((result) => {
                setTickets(result.tickets);
                setTicketsTotal(result.total);
            })
            .catch((error) => pushToast("error", friendlyErrorMessage(error, "Couldn't load tickets. Please try again.")))
            .finally(() => setTicketsLoading(false));
    }, [currentUser, ticketFilters, pushToast]);

    useEffect(() => {
        if (currentUser && (activeView === "tickets" || activeView === "dashboard")) loadTickets();
    }, [currentUser, activeView, loadTickets]);

    const loadAgents = useCallback(() => {
        if (!currentUser || currentUser.role === "customer") return;
        setAgentsLoading(true);
        agentApi
            .list()
            .then(setAgents)
            .catch((error) => setAgentError(friendlyErrorMessage(error, "Couldn't load agents. Please try again.")))
            .finally(() => setAgentsLoading(false));
    }, [currentUser]);

    useEffect(() => {
        if (currentUser && (activeView === "agents" || activeView === "ticket-detail")) loadAgents();
    }, [currentUser, activeView, loadAgents]);

    const loadCannedResponses = useCallback(() => {
        if (!canManage) return;
        cannedResponseApi
            .list()
            .then(setCannedResponses)
            .catch((error) => setCannedError(friendlyErrorMessage(error, "Couldn't load canned responses.")));
    }, [canManage]);

    useEffect(() => {
        if (canManage && (activeView === "canned-responses" || activeView === "ticket-detail")) loadCannedResponses();
    }, [canManage, activeView, loadCannedResponses]);

    const loadNotifications = useCallback(() => {
        if (!currentUser) return;
        notificationApi
            .list()
            .then((result) => {
                setNotifications(result.items);
                setUnreadCount(result.unreadCount);
            })
            .catch(() => {});
    }, [currentUser]);

    useEffect(() => {
        if (!currentUser) return undefined;
        loadNotifications();
        const interval = setInterval(loadNotifications, NOTIFICATION_POLL_MS);
        return () => clearInterval(interval);
    }, [currentUser, loadNotifications]);

    useEffect(() => {
        if (!currentUser || currentUser.role !== "admin" || activeView !== "analytics") return;
        setAnalyticsLoading(true);
        analyticsApi
            .getDashboard(analyticsFilters)
            .then(setAnalyticsDashboard)
            .catch(() => pushToast("error", "Couldn't load analytics. Please try again."))
            .finally(() => setAnalyticsLoading(false));
    }, [currentUser, activeView, analyticsFilters, pushToast]);

    useEffect(() => {
        if (!currentUser || activeView !== "settings") return;
        settingsApi.get().then(setSettings);
    }, [currentUser, activeView]);

    function loadTicketDetail(id) {
        if (!id) return;
        setSelectedTicketId(id);
        setActiveView("ticket-detail");
        setSelectedTicket(null);
        setAuditTrail(null);
        ticketApi
            .get(id)
            .then(setSelectedTicket)
            .catch((error) => {
                pushToast("error", friendlyErrorMessage(error, "Couldn't open that ticket."));
                setActiveView("tickets");
            });
        if (currentUser?.role === "admin") {
            ticketApi
                .audit(id)
                .then(setAuditTrail)
                .catch(() => {});
        }
    }

    async function handleLogin({ email, password }) {
        setAuthBusy(true);
        setAuthError("");
        try {
            const result = await authApi.login(email, password);
            setSessionToken(result.token);
            setCurrentUser(result.user);
        } catch (error) {
            setAuthError(friendlyErrorMessage(error, "Couldn't sign in. Please try again."));
        } finally {
            setAuthBusy(false);
        }
    }

    async function handleRegister({ name, email, password }) {
        setAuthBusy(true);
        setAuthError("");
        try {
            const result = await authApi.register({ name, email, password });
            setSessionToken(result.token);
            setCurrentUser(result.user);
            pushToast("success", `Welcome, ${result.user.name.split(" ")[0]}! Your account is ready.`);
        } catch (error) {
            setAuthError(friendlyErrorMessage(error, "Couldn't create your account. Please try again."));
        } finally {
            setAuthBusy(false);
        }
    }

    async function handleLogout() {
        try {
            await authApi.logout();
        } catch {
            // ignore network errors on logout
        }
        setSessionToken("");
        setCurrentUser(null);
        setActiveView("dashboard");
    }

    async function handleCreateTicket(input) {
        setIsCreatingTicket(true);
        setTicketCreateError("");
        try {
            await ticketApi.create(input);
            setShowNewTicketModal(false);
            pushToast("success", "Ticket created successfully.");
            loadTickets();
        } catch (error) {
            setTicketCreateError(friendlyErrorMessage(error, "Failed to create ticket. Please try again."));
        } finally {
            setIsCreatingTicket(false);
        }
    }

    async function handleUpdateTicket(patch) {
        setIsUpdatingTicket(true);
        try {
            const updated = await ticketApi.update(selectedTicketId, patch);
            setSelectedTicket(updated);
            pushToast("success", "Ticket updated.");
            loadTickets();
        } catch (error) {
            pushToast("error", friendlyErrorMessage(error, "Couldn't update the ticket. Please try again."));
        } finally {
            setIsUpdatingTicket(false);
        }
    }

    async function handleAssignTicket(agentId) {
        if (!agentId) return;
        setIsUpdatingTicket(true);
        try {
            const updated = await ticketApi.assign(selectedTicketId, agentId);
            setSelectedTicket(updated);
            pushToast("success", "Ticket reassigned.");
        } catch (error) {
            pushToast("error", friendlyErrorMessage(error, "Couldn't reassign the ticket. Please try again."));
        } finally {
            setIsUpdatingTicket(false);
        }
    }

    async function handleReply(input) {
        setIsReplying(true);
        try {
            const updated = await ticketApi.reply(selectedTicketId, input);
            setSelectedTicket(updated);
            pushToast("success", input.isInternal ? "Internal note added." : "Reply sent.");
            return updated;
        } catch (error) {
            pushToast("error", friendlyErrorMessage(error, "Couldn't send your reply. Please try again."));
            throw error;
        } finally {
            setIsReplying(false);
        }
    }

    async function handleCreateAgent(input) {
        setAgentBusy(true);
        setAgentError("");
        try {
            await agentApi.create(input);
            pushToast("success", "Agent added successfully.");
            loadAgents();
        } catch (error) {
            setAgentError(friendlyErrorMessage(error, "Couldn't add this agent. Please try again."));
            throw error;
        } finally {
            setAgentBusy(false);
        }
    }

    function handleSetAgentActive(id, isActive, verb) {
        agentApi
            .setActive(id, isActive)
            .then(() => {
                pushToast(isActive ? "success" : "warning", `Agent ${verb}d.`);
                loadAgents();
            })
            .catch((error) => pushToast("error", friendlyErrorMessage(error, "Couldn't update this agent. Please try again.")));
    }

    async function handleCreateCannedResponse(input) {
        setCannedBusy(true);
        setCannedError("");
        try {
            await cannedResponseApi.create(input);
            pushToast("success", "Template saved.");
            loadCannedResponses();
        } catch (error) {
            setCannedError(friendlyErrorMessage(error, "Couldn't save this template. Please try again."));
            throw error;
        } finally {
            setCannedBusy(false);
        }
    }

    function handleDeleteCannedResponse(id) {
        cannedResponseApi
            .remove(id)
            .then(() => {
                pushToast("success", "Template deleted.");
                loadCannedResponses();
            })
            .catch((error) => pushToast("error", friendlyErrorMessage(error, "Couldn't delete this template. Please try again.")));
    }

    function handleMarkNotificationsRead() {
        notificationApi.markRead().then(loadNotifications);
    }

    function handleClearNotifications() {
        notificationApi
            .clear()
            .then(() => {
                loadNotifications();
                pushToast("success", "Notifications cleared.");
            })
            .catch(() => pushToast("error", "Couldn't clear notifications. Please try again."));
    }

    async function handleSaveSettings(patch) {
        setSettingsBusy(true);
        setSettingsError("");
        try {
            const updated = await settingsApi.update(patch);
            setSettings(updated);
            pushToast("success", "Settings saved.");
        } catch (error) {
            setSettingsError(friendlyErrorMessage(error, "Couldn't save settings. Please try again."));
        } finally {
            setSettingsBusy(false);
        }
    }

    function handleNavigate(view) {
        setActiveView(view);
        setSelectedTicketId(null);
    }

    const analyticsSummary = useMemo(
        () => (analyticsDashboard ? { slaComplianceRate: analyticsDashboard.slaComplianceRate } : null),
        [analyticsDashboard],
    );

    if (isBootstrapping) {
        return (
            <div className="boot-screen">
                <img src="/favicon.svg" alt="" />
                <p>Loading Support Desk...</p>
            </div>
        );
    }

    if (!currentUser) {
        return (
            <>
                <AuthScreen onLogin={handleLogin} onRegister={handleRegister} error={authError} isBusy={authBusy} />
                <ToastStack toasts={toasts} onDismiss={dismissToast} />
            </>
        );
    }

    return (
        <div className={`app-shell ${isSidebarCollapsed ? "sidebar-collapsed" : ""}`}>
            <Sidebar
                currentUser={currentUser}
                activeView={activeView}
                onNavigate={handleNavigate}
                onOpenProfile={() => setActiveView("profile")}
                isCollapsed={isSidebarCollapsed}
                onToggleCollapse={() => setIsSidebarCollapsed((value) => !value)}
            />
            <div className="app-main">
                <header className="topbar">
                    <div className="topbar-actions">
                        <NotificationBell
                            notifications={notifications}
                            unreadCount={unreadCount}
                            onMarkRead={handleMarkNotificationsRead}
                            onClear={handleClearNotifications}
                            onOpenTicket={loadTicketDetail}
                        />
                    </div>
                </header>

                <main className="app-content">
                    {activeView === "dashboard" && (
                        <Dashboard
                            currentUser={currentUser}
                            tickets={tickets}
                            onSelectTicket={loadTicketDetail}
                            onNewTicket={() => setShowNewTicketModal(true)}
                            onViewAllTickets={() => handleNavigate("tickets")}
                            analyticsSummary={analyticsSummary}
                        />
                    )}

                    {activeView === "tickets" && (
                        <TicketList
                            tickets={tickets}
                            total={ticketsTotal}
                            filters={ticketFilters}
                            onFilterChange={setTicketFilters}
                            onSelectTicket={loadTicketDetail}
                            onNewTicket={() => setShowNewTicketModal(true)}
                            isLoading={ticketsLoading}
                        />
                    )}

                    {activeView === "ticket-detail" && selectedTicket && (
                        <TicketDetail
                            ticket={selectedTicket}
                            currentUser={currentUser}
                            agents={agents}
                            cannedResponses={cannedResponses}
                            auditTrail={auditTrail}
                            onBack={() => handleNavigate("tickets")}
                            onUpdate={handleUpdateTicket}
                            onReply={handleReply}
                            onAssign={handleAssignTicket}
                            isReplying={isReplying}
                            isUpdating={isUpdatingTicket}
                        />
                    )}

                    {activeView === "ticket-detail" && !selectedTicket && (
                        <section className="panel">
                            <span className="skeleton skeleton-block" style={{ height: "2rem", width: "50%" }} />
                            <span className="skeleton skeleton-block" style={{ height: "6rem" }} />
                        </section>
                    )}

                    {activeView === "agents" && (
                        <AgentsPage
                            agents={agents}
                            onCreateAgent={handleCreateAgent}
                            onSetActive={handleSetAgentActive}
                            isAdmin={currentUser.role === "admin"}
                            error={agentError}
                            isBusy={agentBusy}
                            isLoading={agentsLoading}
                        />
                    )}

                    {activeView === "canned-responses" && (
                        <CannedResponsesPage
                            responses={cannedResponses}
                            onCreate={handleCreateCannedResponse}
                            onDelete={handleDeleteCannedResponse}
                            currentUser={currentUser}
                            error={cannedError}
                            isBusy={cannedBusy}
                        />
                    )}

                    {activeView === "analytics" && currentUser.role === "admin" && (
                        <AnalyticsPage dashboard={analyticsDashboard} filters={analyticsFilters} onFilterChange={setAnalyticsFilters} isLoading={analyticsLoading} />
                    )}

                    {activeView === "settings" && currentUser.role === "admin" && (
                        <SettingsPage settings={settings} onSave={handleSaveSettings} isBusy={settingsBusy} error={settingsError} />
                    )}

                    {activeView === "profile" && (
                        <ProfilePage
                            currentUser={currentUser}
                            onLogout={handleLogout}
                            theme={theme}
                            onToggleTheme={() => setTheme((value) => (value === "light" ? "dark" : "light"))}
                        />
                    )}
                </main>
            </div>

            {showNewTicketModal && (
                <NewTicketModal
                    onClose={() => setShowNewTicketModal(false)}
                    onCreate={handleCreateTicket}
                    error={ticketCreateError}
                    isBusy={isCreatingTicket}
                />
            )}

            <ToastStack toasts={toasts} onDismiss={dismissToast} />
        </div>
    );
}
