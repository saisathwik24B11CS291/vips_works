(function () {
  const AUTH_KEYS = ["token", "userRole", "userId", "username"];
  const PATHS = {
    home: "/index.html",
    employerLogin: "/employer/login.html",
    employerSignup: "/employer/signup.html",
    employerDashboard: "/employer/home.html",
    employerProfile: "/employer/profile.html",
    employerSettings: "/employer/settings.html",
    employerNotifications: "/employer/requests.html",
    employerSaved: "/employer/hired-jobs.html",
    workerLogin: "/worker/login.html",
    workerSignup: "/worker/signup.html",
    workerDashboard: "/worker/home.html",
    workerProfile: "/worker/profile.html",
    workerSettings: "/worker/settings.html",
    workerNotifications: "/worker/notifications.html",
    workerSaved: "/worker/job-feed.html",
    help: "/index.html#help"
  };

  const state = {
    user: null,
    drawerOpen: false
  };

  function labelRole(role) {
    return role === "employer" ? "Employer" : role === "worker" ? "Worker" : "Member";
  }

  function getToken() {
    return localStorage.getItem("token");
  }

  function destinationFor(role) {
    return role === "employer" ? PATHS.employerDashboard : PATHS.workerDashboard;
  }

  function profileFor(role) {
    return role === "employer" ? PATHS.employerProfile : PATHS.workerProfile;
  }

  function settingsFor(role) {
    return role === "employer" ? PATHS.employerSettings : PATHS.workerSettings;
  }

  function notificationsFor(role) {
    return role === "employer" ? PATHS.employerNotifications : PATHS.workerNotifications;
  }

  function savedFor(role) {
    return role === "employer" ? PATHS.employerSaved : PATHS.workerSaved;
  }

  function isActive(path) {
    const current = window.location.pathname.replace(/\/$/, "/index.html");
    return current === path;
  }

  function navLink(label, href, extraClass = "") {
    const active = isActive(href) || (href === PATHS.home && ["/", "/index.html"].includes(window.location.pathname));
    return `<a class="vips-nav-link ${active ? "is-active" : ""} ${extraClass}" href="${href}" ${active ? 'aria-current="page"' : ""}>${label}</a>`;
  }

  function chevron() {
    return '<svg class="vips-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  function roleDropdown(role) {
    const sameRole = state.user?.role === role;
    const roleLabel = labelRole(role);
    const active = window.location.pathname.includes(`/${role}/`);
    const links = sameRole
      ? `<a class="vips-dropdown-link" href="${destinationFor(role)}">Continue as ${roleLabel}<span class="vips-dropdown-note">Dashboard</span></a>`
      : `
          <a class="vips-dropdown-link" href="${PATHS[`${role}Login`]}">Login<span class="vips-dropdown-note">${roleLabel}</span></a>
          <a class="vips-dropdown-link" href="${PATHS[`${role}Signup`]}">Sign Up<span class="vips-dropdown-note">New account</span></a>
        `;

    return `
      <div class="vips-nav-item">
        <button class="vips-nav-trigger ${active ? "is-active" : ""}" type="button" aria-haspopup="true" aria-expanded="false">
          ${roleLabel}${chevron()}
        </button>
        <div class="vips-dropdown" role="menu">
          ${links}
        </div>
      </div>
    `;
  }

  function avatarMarkup(user, sizeClass = "") {
    const name = user?.username || "VIPs";
    const initial = name.trim().charAt(0).toUpperCase() || "V";
    const src = user?.profilePicture || user?.photo || user?.avatar;
    if (src) {
      return `<img class="vips-avatar ${sizeClass}" src="${src}" alt="" loading="lazy">`;
    }
    return `<span class="vips-avatar vips-avatar-fallback ${sizeClass}" aria-hidden="true">${initial}</span>`;
  }

  function profileMenu() {
    const user = state.user;
    if (!user) return "";
    const role = user.role;
    return `
      <div class="vips-profile-wrap is-visible">
        <button class="vips-profile-button" type="button" aria-haspopup="true" aria-expanded="false" aria-label="Open profile menu">
          ${avatarMarkup(user)}
          <span class="vips-profile-copy">
            <span class="vips-profile-name">${escapeHtml(user.username || "VIPs User")}</span>
            <span class="vips-profile-role">${labelRole(role)}</span>
          </span>
          ${chevron()}
        </button>
        <div class="vips-profile-menu" role="menu">
          <div class="vips-profile-head">
            ${avatarMarkup(user)}
            <span class="vips-profile-copy">
              <span class="vips-profile-name">${escapeHtml(user.username || "VIPs User")}</span>
              <span class="vips-profile-role">${labelRole(role)}</span>
            </span>
          </div>
          <a class="vips-dropdown-link" href="${profileFor(role)}">My Profile</a>
          <a class="vips-dropdown-link" href="${destinationFor(role)}">Dashboard</a>
          <a class="vips-dropdown-link" href="${settingsFor(role)}">Settings</a>
          <a class="vips-dropdown-link" href="${notificationsFor(role)}">Notifications</a>
          <a class="vips-dropdown-link" href="${savedFor(role)}">Saved Items</a>
          <a class="vips-dropdown-link" href="${PATHS.help}">Help</a>
          <button class="vips-logout-button" type="button" data-vips-logout>Logout</button>
        </div>
      </div>
    `;
  }

  function buildNav() {
    return `
      <header class="vips-topbar" data-vips-nav>
        <div class="vips-nav-shell">
          <a class="vips-brand" href="${PATHS.home}" aria-label="VIPs dashboard">
            <span class="vips-brand-mark" aria-hidden="true">V</span>
            <span class="vips-brand-text">
              <span class="vips-brand-name">VIPs</span>
              <span class="vips-brand-subtitle">Marketplace Network</span>
            </span>
          </a>
          <nav class="vips-nav-links" aria-label="Primary navigation">
            ${navLink("Home", PATHS.home)}
            ${roleDropdown("employer")}
            ${roleDropdown("worker")}
            ${navLink("About", "/index.html#about")}
            ${navLink("Contact", "/index.html#contact")}
            ${navLink("Help", PATHS.help)}
            ${navLink("Support", "/index.html#support")}
          </nav>
          <div class="vips-nav-actions">
            <a class="vips-auth-cta ${state.user ? "" : "is-visible"}" href="${PATHS.employerLogin}">Get Started</a>
            ${profileMenu()}
          </div>
          <button class="vips-mobile-toggle" type="button" aria-label="Open navigation menu" aria-controls="vips-mobile-drawer" aria-expanded="false">
            <span class="vips-mobile-lines" aria-hidden="true"></span>
          </button>
        </div>
      </header>
      <div class="vips-mobile-backdrop" data-vips-drawer-backdrop></div>
      <aside class="vips-mobile-drawer" id="vips-mobile-drawer" aria-label="Mobile navigation" aria-hidden="true">
        ${drawerContent()}
      </aside>
    `;
  }

  function drawerRoleLinks(role) {
    const sameRole = state.user?.role === role;
    const roleLabel = labelRole(role);
    if (sameRole) {
      return `<a class="vips-dropdown-link" href="${destinationFor(role)}">Continue as ${roleLabel}</a>`;
    }
    return `
      <a class="vips-dropdown-link" href="${PATHS[`${role}Login`]}">${roleLabel} Login</a>
      <a class="vips-dropdown-link" href="${PATHS[`${role}Signup`]}">${roleLabel} Sign Up</a>
    `;
  }

  function drawerContent() {
    const user = state.user;
    return `
      ${user ? `
        <div class="vips-drawer-section">
          <div class="vips-drawer-card vips-profile-head">
            ${avatarMarkup(user)}
            <span class="vips-profile-copy">
              <span class="vips-profile-name">${escapeHtml(user.username || "VIPs User")}</span>
              <span class="vips-profile-role">${labelRole(user.role)}</span>
            </span>
          </div>
        </div>
      ` : ""}
      <div class="vips-drawer-section">
        <span class="vips-drawer-label">Navigation</span>
        <a class="vips-dropdown-link" href="${PATHS.home}">Home</a>
        <a class="vips-dropdown-link" href="/index.html#about">About</a>
        <a class="vips-dropdown-link" href="/index.html#contact">Contact</a>
        <a class="vips-dropdown-link" href="${PATHS.help}">Help</a>
        <a class="vips-dropdown-link" href="/index.html#support">Support</a>
      </div>
      <div class="vips-drawer-section">
        <span class="vips-drawer-label">Employer</span>
        ${drawerRoleLinks("employer")}
      </div>
      <div class="vips-drawer-section">
        <span class="vips-drawer-label">Worker</span>
        ${drawerRoleLinks("worker")}
      </div>
      ${user ? `
        <div class="vips-drawer-section">
          <span class="vips-drawer-label">Profile</span>
          <a class="vips-dropdown-link" href="${profileFor(user.role)}">My Profile</a>
          <a class="vips-dropdown-link" href="${destinationFor(user.role)}">Dashboard</a>
          <a class="vips-dropdown-link" href="${settingsFor(user.role)}">Settings</a>
          <a class="vips-dropdown-link" href="${notificationsFor(user.role)}">Notifications</a>
          <a class="vips-dropdown-link" href="${savedFor(user.role)}">Saved Items</a>
          <button class="vips-logout-button" type="button" data-vips-logout>Logout</button>
        </div>
      ` : ""}
    `;
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function clearAuth() {
    AUTH_KEYS.forEach((key) => localStorage.removeItem(key));
    sessionStorage.removeItem("signupVerification");
  }

  async function hydrateAuth() {
    const token = getToken();
    if (!token) return null;
    try {
      const response = await fetch(`${window.location.origin}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) {
        clearAuth();
        state.user = null;
        return null;
      }
      const user = await response.json();
      if (!user?.role) throw new Error("Missing role");
      state.user = user;
      localStorage.setItem("userRole", user.role);
      localStorage.setItem("userId", user._id || user.id || localStorage.getItem("userId") || "");
      if (user.username) localStorage.setItem("username", user.username);
      return user;
    } catch (error) {
      state.user = null;
      return null;
    }
  }

  function setDrawer(open) {
    state.drawerOpen = open;
    const toggle = document.querySelector(".vips-mobile-toggle");
    const drawer = document.querySelector(".vips-mobile-drawer");
    const backdrop = document.querySelector(".vips-mobile-backdrop");
    if (!toggle || !drawer || !backdrop) return;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close navigation menu" : "Open navigation menu");
    drawer.setAttribute("aria-hidden", String(!open));
    drawer.classList.toggle("is-open", open);
    backdrop.classList.toggle("is-open", open);
    document.body.style.overflow = open ? "hidden" : "";
  }

  function bindEvents() {
    document.querySelector(".vips-mobile-toggle")?.addEventListener("click", () => setDrawer(!state.drawerOpen));
    document.querySelector("[data-vips-drawer-backdrop]")?.addEventListener("click", () => setDrawer(false));
    document.querySelectorAll("[data-vips-logout]").forEach((button) => {
      button.addEventListener("click", () => {
        clearAuth();
        state.user = null;
        setDrawer(false);
        window.location.href = PATHS.home;
      });
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") setDrawer(false);
    });
    document.querySelectorAll(".vips-nav-trigger, .vips-profile-button").forEach((button) => {
      button.addEventListener("click", () => {
        const menu = button.parentElement?.querySelector(".vips-dropdown, .vips-profile-menu");
        const open = !menu?.classList.contains("is-open");
        document.querySelectorAll(".vips-dropdown.is-open, .vips-profile-menu.is-open").forEach((item) => item.classList.remove("is-open"));
        document.querySelectorAll(".vips-nav-trigger[aria-expanded='true'], .vips-profile-button[aria-expanded='true']").forEach((item) => item.setAttribute("aria-expanded", "false"));
        if (menu) menu.classList.toggle("is-open", open);
        button.setAttribute("aria-expanded", String(open));
      });
    });
    document.addEventListener("click", (event) => {
      if (event.target.closest(".vips-nav-item, .vips-profile-wrap")) return;
      document.querySelectorAll(".vips-dropdown.is-open, .vips-profile-menu.is-open").forEach((item) => item.classList.remove("is-open"));
      document.querySelectorAll(".vips-nav-trigger[aria-expanded='true'], .vips-profile-button[aria-expanded='true']").forEach((item) => item.setAttribute("aria-expanded", "false"));
    });
  }

  function render() {
    document.querySelector("[data-vips-nav]")?.remove();
    document.querySelector(".vips-mobile-backdrop")?.remove();
    document.querySelector(".vips-mobile-drawer")?.remove();
    document.body.classList.add("has-premium-nav", "vips-page-enter");
    document.body.insertAdjacentHTML("afterbegin", buildNav());
    bindEvents();
    window.VipsI18n?.apply?.();
  }

  async function init() {
    render();
    await hydrateAuth();
    render();
  }

  window.VipsNav = {
    refresh: async function () {
      await hydrateAuth();
      render();
    },
    logout: function () {
      clearAuth();
      state.user = null;
      render();
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
