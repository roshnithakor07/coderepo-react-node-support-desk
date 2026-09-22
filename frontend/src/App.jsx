import { useCallback, useEffect, useMemo, useState } from "react";
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
import { applyTheme, getStoredTheme } from "./shared/utils/theme.js";

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

    const [tickets, setTickets] = useState([]);
    const [ticketsTotal, setTicketsTotal] = useState(0);
    const [ticketFilters, setTicketFilters] = useState({ page: 1, pageSize: 20 });
    const [ticketsLoading, setTicketsLoading] = useState(false);
    const [ticketError, setTicketError] = useState("");
    const [isReplying, setIsReplying] = useState(false);

    const [selectedTicket, setSelectedTicket] = useState(null);
    const [auditTrail, setAuditTrail] = useState(null);

    const [agents, setAgents] = useState([]);
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
        }
        window.addEventListener("support-desk-session-expired", handleExpired);
        return () => window.removeEventListener("support-desk-session-expired", handleExpired);
    }, []);

    const loadTickets = useCallback(() => {
        if (!currentUser) return;
        setTicketsLoading(true);
        setTicketError("");
        ticketApi
            .list(ticketFilters)
            .then((result) => {
                setTickets(result.tickets);
                setTicketsTotal(result.total);
            })
            .catch((error) => setTicketError(error.message))
            .finally(() => setTicketsLoading(false));
    }, [currentUser, ticketFilters]);

    useEffect(() => {
        if (currentUser && (activeView === "tickets" || activeView === "dashboard")) loadTickets();
    }, [currentUser, activeView, loadTickets]);

    const loadAgents = useCallback(() => {
        if (!currentUser || currentUser.role === "customer") return;
        agentApi
            .list()
            .then(setAgents)
            .catch((error) => setAgentError(error.message));
    }, [currentUser]);

    useEffect(() => {
        if (currentUser && (activeView === "agents" || activeView === "ticket-detail")) loadAgents();
    }, [currentUser, activeView, loadAgents]);

    const loadCannedResponses = useCallback(() => {
        if (!canManage) return;
        cannedResponseApi
            .list()
            .then(setCannedResponses)
            .catch((error) => setCannedError(error.message));
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
            .finally(() => setAnalyticsLoading(false));
    }, [currentUser, activeView, analyticsFilters]);

    useEffect(() => {
        if (!currentUser || activeView !== "settings") return;
        settingsApi.get().then(setSettings);
    }, [currentUser, activeView]);

    function loadTicketDetail(id) {
        setSelectedTicketId(id);
        setActiveView("ticket-detail");
        setSelectedTicket(null);
        setAuditTrail(null);
        ticketApi
            .get(id)
            .then(setSelectedTicket)
            .catch((error) => setTicketError(error.message));
        if (currentUser?.role === "admin") {
            ticketApi.audit(id).then(setAuditTrail).catch(() => {});
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
            setAuthError(error.message);
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
        } catch (error) {
            setAuthError(error.message);
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
        setTicketError("");
        try {
            await ticketApi.create(input);
            setShowNewTicketModal(false);
            loadTickets();
        } catch (error) {
            setTicketError(error.message);
        }
    }

    async function handleUpdateTicket(patch) {
        const updated = await ticketApi.update(selectedTicketId, patch);
        setSelectedTicket(updated);
        loadTickets();
    }

    async function handleAssignTicket(agentId) {
        if (!agentId) return;
        const updated = await ticketApi.assign(selectedTicketId, agentId);
        setSelectedTicket(updated);
    }

    async function handleReply(input) {
        setIsReplying(true);
        try {
            const updated = await ticketApi.reply(selectedTicketId, input);
            setSelectedTicket(updated);
            return updated;
        } finally {
            setIsReplying(false);
        }
    }

    async function handleCreateAgent(input) {
        setAgentBusy(true);
        setAgentError("");
        try {
            await agentApi.create(input);
            loadAgents();
        } catch (error) {
            setAgentError(error.message);
            throw error;
        } finally {
            setAgentBusy(false);
        }
    }

    function handleSetAgentActive(id, isActive) {
        agentApi.setActive(id, isActive).then(loadAgents);
    }

    async function handleCreateCannedResponse(input) {
        setCannedBusy(true);
        setCannedError("");
        try {
            await cannedResponseApi.create(input);
            loadCannedResponses();
        } catch (error) {
            setCannedError(error.message);
            throw error;
        } finally {
            setCannedBusy(false);
        }
    }

    function handleDeleteCannedResponse(id) {
        cannedResponseApi.remove(id).then(loadCannedResponses);
    }

    function handleMarkNotificationsRead() {
        notificationApi.markRead().then(loadNotifications);
    }

    function handleClearNotifications() {
        notificationApi.clear().then(loadNotifications);
    }

    async function handleSaveSettings(patch) {
        setSettingsBusy(true);
        setSettingsError("");
        try {
            const updated = await settingsApi.update(patch);
            setSettings(updated);
        } catch (error) {
            setSettingsError(error.message);
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
        return <AuthScreen onLogin={handleLogin} onRegister={handleRegister} error={authError} isBusy={authBusy} />;
    }

    return (
        <div className={`app-shell ${isSidebarCollapsed ? "sidebar-collapsed" : ""}`}>
            <Sidebar
                currentUser={currentUser}
                activeView={activeView}
                onNavigate={handleNavigate}
                isCollapsed={isSidebarCollapsed}
                onToggleCollapse={() => setIsSidebarCollapsed((value) => !value)}
            />
            <div className="app-main">
                <header className="topbar">
                    <div />
                    <div className="topbar-actions">
                        <NotificationBell
                            notifications={notifications}
                            unreadCount={unreadCount}
                            onMarkRead={handleMarkNotificationsRead}
                            onClear={handleClearNotifications}
                            onOpenTicket={loadTicketDetail}
                        />
                        <button type="button" className="topbar-profile" onClick={() => setActiveView("profile")}>
                            {currentUser.name}
                        </button>
                    </div>
                </header>

                <main className="app-content">
                    {activeView === "dashboard" && (
                        <Dashboard
                            currentUser={currentUser}
                            tickets={tickets}
                            onSelectTicket={loadTicketDetail}
                            onNewTicket={() => setShowNewTicketModal(true)}
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
                        />
                    )}

                    {activeView === "agents" && (
                        <AgentsPage
                            agents={agents}
                            onCreateAgent={handleCreateAgent}
                            onSetActive={handleSetAgentActive}
                            isAdmin={currentUser.role === "admin"}
                            error={agentError}
                            isBusy={agentBusy}
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

            {showNewTicketModal && <NewTicketModal onClose={() => setShowNewTicketModal(false)} onCreate={handleCreateTicket} error={ticketError} />}
        </div>
    );
}
