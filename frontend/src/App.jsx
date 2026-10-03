import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { agentApi } from "./features/agents/agent.api.js";
import { analyticsApi } from "./features/analytics/analytics.api.js";
import { ActivityPage } from "./features/audit-logs/ActivityPage.jsx";
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
import { MenuIcon } from "./shared/components/Icon.jsx";
import { ToastStack } from "./shared/components/Toast.jsx";
import { applyTheme, getStoredTheme } from "./shared/utils/theme.js";
import { getStoredSidebarCollapsed, storeSidebarCollapsed } from "./shared/utils/sidebar.js";
import { initials, ticketNumber } from "./shared/utils/format.js";
import { DRAWER_NAV_QUERY, useMediaQuery } from "./shared/utils/media.js";
import { friendlyErrorMessage } from "./shared/utils/validate.js";

const NOTIFICATION_POLL_MS = 15000;

// Mirrors the ticket layout (header, conversation, properties card) so opening a ticket does not
// reflow once the data lands.
function TicketDetailSkeleton() {
    return (
        <section className="ticket-detail" aria-busy="true">
            <header className="ticket-detail-header">
                <div className="ticket-detail-heading">
                    <span className="skeleton skeleton-block" style={{ height: "22px", width: "min(420px, 70%)" }} />
                </div>
                <span className="skeleton skeleton-block" style={{ height: "14px", width: "240px", marginTop: "8px" }} />
            </header>
            <div className="ticket-detail-layout">
                <div className="ticket-detail-main">
                    <div className="ticket-thread">
                        <div className="ticket-thread-header">
                            <span className="skeleton skeleton-block" style={{ height: "18px", width: "140px" }} />
                        </div>
                        <span className="skeleton skeleton-block" style={{ height: "96px", marginBottom: "12px" }} />
                        <span className="skeleton skeleton-block" style={{ height: "72px" }} />
                    </div>
                </div>
                <aside className="ticket-detail-sidebar">
                    <div className="properties-card">
                        <span className="skeleton skeleton-block" style={{ height: "18px", width: "50%", marginBottom: "16px" }} />
                        <span className="skeleton skeleton-block" style={{ height: "220px" }} />
                    </div>
                </aside>
            </div>
        </section>
    );
}

const PAGE_TITLES = {
    dashboard: "Dashboard",
    tickets: "Tickets",
    "ticket-detail": "Ticket",
    agents: "Agents",
    "canned-responses": "Canned Responses",
    analytics: "Analytics",
    activity: "Activity",
    settings: "Settings",
    profile: "Profile",
};

export default function App() {
    const [theme, setTheme] = useState(getStoredTheme());
    const [isBootstrapping, setIsBootstrapping] = useState(true);
    const [currentUser, setCurrentUser] = useState(null);
    const [authError, setAuthError] = useState("");
    const [authBusy, setAuthBusy] = useState(false);

    const [activeView, setActiveView] = useState("dashboard");
    const contentRef = useRef(null);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(getStoredSidebarCollapsed);
    const isDrawerNav = useMediaQuery(DRAWER_NAV_QUERY);
    const [isNavOpen, setIsNavOpen] = useState(false);
    const menuButtonRef = useRef(null);
    const [selectedTicketId, setSelectedTicketId] = useState(null);
    const [showNewTicketModal, setShowNewTicketModal] = useState(false);
    const [isCreatingTicket, setIsCreatingTicket] = useState(false);
    const [isUpdatingTicket, setIsUpdatingTicket] = useState(false);

    const [tickets, setTickets] = useState([]);
    const [ticketsTotal, setTicketsTotal] = useState(0);
    const [ticketFilters, setTicketFilters] = useState({ page: 1, pageSize: 20, sort: "newest" });
    const [ticketsLoading, setTicketsLoading] = useState(false);
    // "Loaded" separates the very first load (skeletons) from a refetch (keep the old rows, dimmed).
    const [ticketsLoaded, setTicketsLoaded] = useState(false);
    const [ticketCreateError, setTicketCreateError] = useState("");
    const [isReplying, setIsReplying] = useState(false);

    // The dashboard has its own data: counts over everything the viewer may see, and the newest few
    // tickets. Sharing the list's state made the home page follow whatever filter was last applied.
    const [dashboardStats, setDashboardStats] = useState(null);
    const [dashboardTickets, setDashboardTickets] = useState([]);
    const [dashboardLoaded, setDashboardLoaded] = useState(false);
    const [dashboardLoading, setDashboardLoading] = useState(false);
    const [dashboardError, setDashboardError] = useState("");

    const [selectedTicket, setSelectedTicket] = useState(null);
    const [auditTrail, setAuditTrail] = useState(null);

    const [agents, setAgents] = useState([]);
    const [agentsLoading, setAgentsLoading] = useState(false);
    const [agentsLoaded, setAgentsLoaded] = useState(false);
    const [agentError, setAgentError] = useState("");
    const [agentsLoadError, setAgentsLoadError] = useState("");
    const [agentBusy, setAgentBusy] = useState(false);

    const [cannedResponses, setCannedResponses] = useState([]);
    const [cannedLoaded, setCannedLoaded] = useState(false);
    const [cannedError, setCannedError] = useState("");
    const [cannedLoadError, setCannedLoadError] = useState("");
    const [cannedBusy, setCannedBusy] = useState(false);

    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);

    const [analyticsDashboard, setAnalyticsDashboard] = useState(null);
    const [analyticsFilters, setAnalyticsFilters] = useState({});
    const [analyticsLoading, setAnalyticsLoading] = useState(false);
    const [analyticsError, setAnalyticsError] = useState("");

    const [settings, setSettings] = useState(null);
    const [settingsBusy, setSettingsBusy] = useState(false);
    const [settingsError, setSettingsError] = useState("");
    const [settingsLoadError, setSettingsLoadError] = useState("");

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

    useEffect(() => {
        storeSidebarCollapsed(isSidebarCollapsed);
    }, [isSidebarCollapsed]);

    const isDrawerOpen = isDrawerNav && isNavOpen;

    // Every page opens at its own top, so a ticket shows its header first and a list its filters,
    // whatever the previous page was scrolled to.
    useEffect(() => {
        contentRef.current?.scrollTo({ top: 0 });
    }, [activeView, selectedTicketId]);

    const closeNav = useCallback(() => setIsNavOpen(false), []);

    // Widening the window past the drawer breakpoint closes the drawer.
    useEffect(() => {
        if (!isDrawerNav) setIsNavOpen(false);
    }, [isDrawerNav]);

    // While the drawer is open: focus its first link, close it on Escape, and hand focus back to the menu button afterwards.
    useEffect(() => {
        if (!isDrawerOpen) return undefined;
        const menuButton = menuButtonRef.current;
        document.querySelector("#app-sidebar nav button")?.focus();
        function handleKeyDown(event) {
            if (event.key === "Escape") setIsNavOpen(false);
        }
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            menuButton?.focus();
        };
    }, [isDrawerOpen]);

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
            setIsNavOpen(false);
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
            .finally(() => {
                setTicketsLoading(false);
                setTicketsLoaded(true);
            });
    }, [currentUser, ticketFilters, pushToast]);

    useEffect(() => {
        if (currentUser && activeView === "tickets") loadTickets();
    }, [currentUser, activeView, loadTickets]);

    const loadDashboard = useCallback(() => {
        if (!currentUser) return;
        setDashboardLoading(true);
        setDashboardError("");
        Promise.all([ticketApi.stats(), ticketApi.list({ page: 1, pageSize: 6, sort: "newest" })])
            .then(([stats, recent]) => {
                setDashboardStats(stats);
                setDashboardTickets(recent.tickets);
            })
            .catch((error) => setDashboardError(friendlyErrorMessage(error, "Couldn't load your dashboard. Please try again.")))
            .finally(() => {
                setDashboardLoading(false);
                setDashboardLoaded(true);
            });
    }, [currentUser]);

    useEffect(() => {
        if (activeView === "dashboard") loadDashboard();
    }, [activeView, loadDashboard]);

    const loadAgents = useCallback(() => {
        if (!currentUser || currentUser.role === "customer") return;
        setAgentsLoading(true);
        setAgentsLoadError("");
        agentApi
            .list()
            .then(setAgents)
            .catch((error) => setAgentsLoadError(friendlyErrorMessage(error, "Couldn't load agents. Please try again.")))
            .finally(() => {
                setAgentsLoading(false);
                setAgentsLoaded(true);
            });
    }, [currentUser]);

    useEffect(() => {
        if (currentUser && (activeView === "agents" || activeView === "ticket-detail")) loadAgents();
    }, [currentUser, activeView, loadAgents]);

    const loadCannedResponses = useCallback(() => {
        if (!canManage) return;
        setCannedLoadError("");
        cannedResponseApi
            .list()
            .then(setCannedResponses)
            .catch((error) => setCannedLoadError(friendlyErrorMessage(error, "Couldn't load canned responses. Please try again.")))
            .finally(() => setCannedLoaded(true));
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

    const loadAnalytics = useCallback(() => {
        if (!currentUser || currentUser.role !== "admin") return;
        setAnalyticsLoading(true);
        setAnalyticsError("");
        analyticsApi
            .getDashboard(analyticsFilters)
            .then(setAnalyticsDashboard)
            .catch((error) => setAnalyticsError(friendlyErrorMessage(error, "Couldn't load analytics. Please try again.")))
            .finally(() => setAnalyticsLoading(false));
    }, [currentUser, analyticsFilters]);

    useEffect(() => {
        if (activeView === "analytics") loadAnalytics();
    }, [activeView, loadAnalytics]);

    // Settings drive the categories in the new-ticket form, so every role loads them once.
    const loadSettings = useCallback(() => {
        if (!currentUser) return;
        setSettingsLoadError("");
        settingsApi
            .get()
            .then(setSettings)
            .catch((error) => setSettingsLoadError(friendlyErrorMessage(error, "Couldn't load settings. Please try again.")));
    }, [currentUser]);

    useEffect(() => {
        loadSettings();
    }, [loadSettings]);

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

    // Signing in always starts on the home page with the drawer shut and nothing left over from the
    // previous session, so a mobile sign-out / sign-in never lands back on a stale view.
    function startSession(user) {
        setIsNavOpen(false);
        setSelectedTicketId(null);
        setSelectedTicket(null);
        setAuditTrail(null);
        setActiveView("dashboard");
        setTickets([]);
        setTicketsTotal(0);
        setDashboardStats(null);
        setDashboardTickets([]);
        setDashboardLoaded(false);
        setDashboardError("");
        setTicketFilters({ page: 1, pageSize: 20, sort: "newest" });
        setTicketsLoaded(false);
        setAgents([]);
        setAgentsLoaded(false);
        setAgentsLoadError("");
        setCannedResponses([]);
        setCannedLoaded(false);
        setCannedLoadError("");
        setNotifications([]);
        setUnreadCount(0);
        setAnalyticsDashboard(null);
        setAnalyticsFilters({});
        setSettings(null);
        setCurrentUser(user);
    }

    async function handleLogin({ email, password }) {
        setAuthBusy(true);
        setAuthError("");
        try {
            const result = await authApi.login(email, password);
            setSessionToken(result.token);
            startSession(result.user);
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
            startSession(result.user);
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
        setIsNavOpen(false);
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
            loadDashboard();
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
            loadDashboard();
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
        setIsNavOpen(false);
    }

    const analyticsSummary = useMemo(
        () => (analyticsDashboard ? { slaComplianceRate: analyticsDashboard.slaComplianceRate } : null),
        [analyticsDashboard],
    );

    const isTicketView = activeView === "ticket-detail" && selectedTicket;

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
                onOpenProfile={() => {
                    setActiveView("profile");
                    setIsNavOpen(false);
                }}
                onLogout={handleLogout}
                isCollapsed={isSidebarCollapsed && !isDrawerNav}
                onToggleCollapse={() => setIsSidebarCollapsed((value) => !value)}
                isOpen={isDrawerOpen}
                onClose={closeNav}
            />
            {isDrawerOpen && <div className="nav-backdrop" onClick={closeNav} aria-hidden="true" />}
            <div className="app-main" inert={isDrawerOpen}>
                <header className="topbar">
                    <div className="topbar-start">
                        <button
                            type="button"
                            ref={menuButtonRef}
                            className="topbar-menu-button"
                            onClick={() => setIsNavOpen(true)}
                            aria-label="Open navigation"
                            aria-controls="app-sidebar"
                            aria-expanded={isDrawerOpen}
                        >
                            <MenuIcon />
                        </button>
                        {isTicketView ? (
                            <h1 className="topbar-title topbar-breadcrumb">
                                <button type="button" className="breadcrumb-link" onClick={() => handleNavigate("tickets")}>
                                    Tickets
                                </button>
                                <span className="breadcrumb-separator" aria-hidden="true">
                                    /
                                </span>
                                <span aria-current="page">{ticketNumber(selectedTicket._id)}</span>
                            </h1>
                        ) : (
                            <h1 className="topbar-title">{PAGE_TITLES[activeView] || "Support Desk"}</h1>
                        )}
                    </div>
                    <div className="topbar-actions">
                        <NotificationBell
                            notifications={notifications}
                            unreadCount={unreadCount}
                            onMarkRead={handleMarkNotificationsRead}
                            onClear={handleClearNotifications}
                            onOpenTicket={loadTicketDetail}
                        />
                        <button type="button" className="topbar-profile-chip" onClick={() => setActiveView("profile")}>
                            <span className="topbar-profile-avatar">{initials(currentUser.name)}</span>
                            <span className="topbar-profile-name">{currentUser.name}</span>
                        </button>
                    </div>
                </header>

                <main className="app-content" ref={contentRef}>
                    {activeView === "dashboard" && (
                        <Dashboard
                            currentUser={currentUser}
                            tickets={dashboardTickets}
                            stats={dashboardStats}
                            onSelectTicket={loadTicketDetail}
                            onNewTicket={() => setShowNewTicketModal(true)}
                            onViewAllTickets={() => handleNavigate("tickets")}
                            analyticsSummary={analyticsSummary}
                            isLoading={!dashboardLoaded}
                            isRefreshing={dashboardLoading && dashboardLoaded}
                            error={dashboardError}
                            onRetry={loadDashboard}
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
                            isLoading={!ticketsLoaded}
                            isRefreshing={ticketsLoading && ticketsLoaded}
                            role={currentUser.role}
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

                    {activeView === "ticket-detail" && !selectedTicket && <TicketDetailSkeleton />}

                    {activeView === "agents" && (
                        <AgentsPage
                            agents={agents}
                            onCreateAgent={handleCreateAgent}
                            onSetActive={handleSetAgentActive}
                            isAdmin={currentUser.role === "admin"}
                            error={agentError}
                            loadError={agentsLoadError}
                            onRetry={loadAgents}
                            isBusy={agentBusy}
                            isLoading={!agentsLoaded}
                            isRefreshing={agentsLoading && agentsLoaded}
                        />
                    )}

                    {activeView === "canned-responses" && (
                        <CannedResponsesPage
                            responses={cannedResponses}
                            onCreate={handleCreateCannedResponse}
                            onDelete={handleDeleteCannedResponse}
                            currentUser={currentUser}
                            error={cannedError}
                            loadError={cannedLoadError}
                            onRetry={loadCannedResponses}
                            isLoading={!cannedLoaded}
                            isBusy={cannedBusy}
                        />
                    )}

                    {activeView === "activity" && currentUser.role === "admin" && <ActivityPage onOpenTicket={loadTicketDetail} />}

                    {activeView === "analytics" && currentUser.role === "admin" && (
                        <AnalyticsPage
                            dashboard={analyticsDashboard}
                            filters={analyticsFilters}
                            onFilterChange={setAnalyticsFilters}
                            isLoading={analyticsLoading}
                            error={analyticsError}
                            onRetry={loadAnalytics}
                        />
                    )}

                    {activeView === "settings" && currentUser.role === "admin" && (
                        <SettingsPage
                            settings={settings}
                            onSave={handleSaveSettings}
                            isBusy={settingsBusy}
                            error={settingsError}
                            loadError={settingsLoadError}
                            onRetry={loadSettings}
                        />
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
                    categories={settings?.categories}
                    error={ticketCreateError}
                    isBusy={isCreatingTicket}
                />
            )}

            <ToastStack toasts={toasts} onDismiss={dismissToast} />
        </div>
    );
}
