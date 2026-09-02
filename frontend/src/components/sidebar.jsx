function Sidebar({ activePage, setActivePage }) {
  const menuItems = [
    {
      id: "overview",
      icon: "◈",
      label: "Overview",
    },
    {
      id: "cameras",
      icon: "▣",
      label: "Cameras",
    },
    {
      id: "alerts",
      icon: "△",
      label: "Alerts",
    },
    {
      id: "events",
      icon: "≡",
      label: "Events",
    },
    {
      id: "analytics",
      icon: "⌁",
      label: "Analytics",
    },
  ];

  return (
    <aside className="sidebar">

      <div className="sidebar-brand">

        <div className="brand-mark">
          AN
        </div>

        <div>
          <h1>AVEKSHA</h1>
          <span>NETRA</span>
        </div>

      </div>

      <div className="sidebar-section">

        <span className="sidebar-label">
          COMMAND CENTER
        </span>

        <nav>

          {menuItems.map((item) => (
            <button
              key={item.id}
              className={
                activePage === item.id
                  ? "nav-item active"
                  : "nav-item"
              }
              onClick={() => setActivePage(item.id)}
            >

              <span className="nav-icon">
                {item.icon}
              </span>

              <span>
                {item.label}
              </span>

            </button>
          ))}

        </nav>

      </div>

      <div className="sidebar-bottom">

        <div className="system-section">

          <span className="sidebar-label">
            SYSTEM STATUS
          </span>

          <div className="system-item">
            <span className="system-dot online"></span>
            Backend
            <strong>ONLINE</strong>
          </div>

          <div className="system-item">
            <span className="system-dot online"></span>
            Database
            <strong>ONLINE</strong>
          </div>

          <div className="system-item">
            <span className="system-dot standby"></span>
            AI Engine
            <strong>STANDBY</strong>
          </div>

        </div>

        <div className="sidebar-footer">
          <span>AVEKSHA NETRA</span>
          <small>v1.0.0</small>
        </div>

      </div>

    </aside>
  );
}

export default Sidebar;