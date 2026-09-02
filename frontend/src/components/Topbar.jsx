function Topbar() {
  return (
    <header className="topbar">

      <div className="topbar-left">

        <div className="breadcrumb">
          COMMAND CENTER
          <span>/</span>
          OVERVIEW
        </div>

      </div>

      <div className="topbar-right">

        <div className="operation-status">
          <span className="status-dot"></span>

          SYSTEM OPERATIONAL
        </div>

        <div className="topbar-time">
          LIVE
        </div>

        <div className="operator">
          <div className="operator-avatar">
            OP
          </div>

          <div>
            <strong>OPERATOR</strong>
            <span>CONTROL ROOM</span>
          </div>
        </div>

      </div>

    </header>
  );
}

export default Topbar;