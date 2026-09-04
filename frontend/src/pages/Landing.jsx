import React from "react";
import "./Landing.css";

function Landing({ onLogin, onRegister }) {
  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="landing-page">
      {/* ============================================================
          TACTICAL NAVBAR
          ============================================================ */}
      <header className="landing-navbar">
        <div className="navbar-container">
          {/* Brand */}
          <div className="brand" onClick={() => scrollTo("overview")}>
            <div className="brand-mark">AN</div>
            <div className="brand-text">
              <span className="brand-title">AVEKSHA NETRA</span>
              <span className="brand-sub">TACTICAL AI SURVEILLANCE PLATFORM</span>
            </div>
          </div>

          {/* Engine Status Pill */}
          <div className="nav-status-pill">
            <span className="status-dot-pulse"></span>
            <span className="status-text">CORE VISION: ACTIVE</span>
          </div>

          {/* Nav Links */}
          <nav className="nav-links">
            <button type="button" onClick={() => scrollTo("overview")}>OVERVIEW</button>
            <button type="button" onClick={() => scrollTo("capabilities")}>CAPABILITIES</button>
            <button type="button" onClick={() => scrollTo("pipeline")}>PIPELINE</button>
            <button type="button" onClick={() => scrollTo("specifications")}>SPECS</button>
          </nav>

          {/* Nav Actions */}
          <div className="nav-actions">
            <button
              type="button"
              className="nav-btn-login"
              onClick={onLogin}
            >
              [ OPERATOR LOGIN ]
            </button>
            <button
              type="button"
              className="nav-btn-register"
              onClick={onRegister}
            >
              CREATE ACCOUNT →
            </button>
          </div>
        </div>
      </header>

      {/* ============================================================
          HERO SECTION
          ============================================================ */}
      <section id="overview" className="hero-section">
        <div className="hero-grid-bg"></div>
        <div className="hero-radial-glow"></div>

        <div className="hero-container">
          {/* Left Column: Tactical Copy */}
          <div className="hero-copy">
            <div className="classification-badge">
              <span className="badge-brackets">[</span>
              <span className="badge-dot">●</span>
              SYSTEM LEVEL 4 // DEFENSE-GRADE AI COGNITION
              <span className="badge-brackets">]</span>
            </div>

            <h1 className="hero-title">
              REAL-TIME TACTICAL
              <span className="hero-title-accent">SURVEILLANCE INTELLIGENCE</span>
            </h1>

            <p className="hero-description">
              Transform standard CCTV and RTSP camera arrays into an autonomous threat
              detection network. Edge-accelerated neural vision with sub-45ms spatial tracking,
              perimeter violation triggers, and instant operator alert dispatch.
            </p>

            {/* CTAs */}
            <div className="hero-cta-group">
              <button
                type="button"
                className="hero-primary-btn"
                onClick={onLogin}
              >
                ACCESS COMMAND CENTER
                <span className="btn-arrow">→</span>
              </button>

              <button
                type="button"
                className="hero-secondary-btn"
                onClick={onRegister}
              >
                CREATE OPERATOR ACCOUNT
              </button>
            </div>

            {/* Quick Status Strip */}
            <div className="tactical-status-strip">
              <div className="status-item">
                <span className="status-indicator online"></span>
                <span>CORE ENGINE: <strong className="text-emerald">ACTIVE</strong></span>
              </div>
              <div className="status-divider">/</div>
              <div className="status-item">
                <span className="status-indicator online"></span>
                <span>RTSP INGEST: <strong className="text-cyan">READY</strong></span>
              </div>
              <div className="status-divider">/</div>
              <div className="status-item">
                <span className="status-indicator online"></span>
                <span>LATENCY: <strong className="text-amber">&lt;45MS</strong></span>
              </div>
              <div className="status-divider">/</div>
              <div className="status-item">
                <span className="status-indicator online"></span>
                <span>MODEL: <strong>YOLOv8s-TACTICAL</strong></span>
              </div>
            </div>
          </div>

          {/* Right Column: Tactical HUD Radar Visual */}
          <div className="hero-hud-visual">
            <div className="tactical-hud-box">
              {/* Corner markers */}
              <div className="corner-bracket top-left"></div>
              <div className="corner-bracket top-right"></div>
              <div className="corner-bracket bottom-left"></div>
              <div className="corner-bracket bottom-right"></div>

              {/* HUD Header */}
              <div className="hud-header">
                <span className="hud-label">TARGET ACQUISITION RADAR</span>
                <span className="hud-coords">17° 41' 34" N // 78° 27' 42" E</span>
              </div>

              {/* Radar Circle */}
              <div className="radar-circle">
                <div className="radar-ring r1"></div>
                <div className="radar-ring r2"></div>
                <div className="radar-ring r3"></div>
                <div className="radar-crosshair h"></div>
                <div className="radar-crosshair v"></div>
                <div className="radar-sweep-beam"></div>

                {/* Degrees markers */}
                <span className="radar-deg d0">000°</span>
                <span className="radar-deg d90">090°</span>
                <span className="radar-deg d180">180°</span>
                <span className="radar-deg d270">270°</span>

                {/* Target Blips */}
                <div className="target-blip blip-1">
                  <span className="blip-dot"></span>
                  <div className="blip-tag">[ TGT-01: HUMAN 98% ]</div>
                </div>
                <div className="target-blip blip-2">
                  <span className="blip-dot"></span>
                  <div className="blip-tag">[ TGT-02: VEHICLE 94% ]</div>
                </div>
                <div className="target-blip blip-3">
                  <span className="blip-dot"></span>
                  <div className="blip-tag">[ TGT-03: PERIMETER ]</div>
                </div>
              </div>

              {/* HUD Telemetry Footer */}
              <div className="hud-footer">
                <div className="hud-status-line">
                  <span className="hud-dot"></span>
                  <span>SECTOR: <strong>DELTA-09 [SECURE]</strong></span>
                </div>
                <div className="hud-telemetry">
                  <span>ACTIVE FEEDS: <strong>4 ONLINE</strong></span>
                  <span>FPS: <strong>29.8</strong></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          METRICS BAR
          ============================================================ */}
      <section className="metrics-section">
        <div className="metrics-grid">
          <div className="metric-card">
            <span className="metric-tag">LATENCY</span>
            <div className="metric-value text-cyan">&lt; 45ms</div>
            <div className="metric-label">Neural Inference Time</div>
            <div className="metric-desc">Sub-frame deep learning classification running on edge hardware.</div>
          </div>

          <div className="metric-card">
            <span className="metric-tag">CONFIDENCE</span>
            <div className="metric-value text-emerald">99.2%</div>
            <div className="metric-label">Threat Precision</div>
            <div className="metric-desc">High-confidence object tracking with multi-frame verification.</div>
          </div>

          <div className="metric-card">
            <span className="metric-tag">OPERATION</span>
            <div className="metric-value text-amber">24 / 7</div>
            <div className="metric-label">Autonomous Watch</div>
            <div className="metric-desc">Continuous perimeter supervision without operator fatigue.</div>
          </div>

          <div className="metric-card">
            <span className="metric-tag">COMPATIBILITY</span>
            <div className="metric-value text-sky">RTSP / ONVIF</div>
            <div className="metric-label">Universal Ingestion</div>
            <div className="metric-desc">Seamless integration with existing IP cameras and NVR arrays.</div>
          </div>
        </div>
      </section>

      {/* ============================================================
          CAPABILITIES SECTION
          ============================================================ */}
      <section id="capabilities" className="capabilities-section">
        <div className="section-header">
          <div className="section-pretitle">02 // TACTICAL MODULES</div>
          <h2 className="section-title">SURVEILLANCE CAPABILITIES</h2>
          <p className="section-subtitle">
            Autonomous computer vision pipelines designed for defense installations, high-security
            facilities, and smart perimeter control.
          </p>
        </div>

        <div className="capabilities-grid">
          {/* Cap 1 */}
          <div className="capability-card">
            <div className="cap-header">
              <span className="cap-serial">[ CAP-01 ]</span>
              <span className="cap-status operational">OPERATIONAL</span>
            </div>
            <div className="cap-icon">👤</div>
            <h3 className="cap-title">Human Detection &amp; Tracking</h3>
            <p className="cap-desc">
              Real-time person localization, persistent tracking across camera frames, loitering
              dwell-time calculation, and unauthorized personnel boundary alerts.
            </p>
            <div className="cap-footer">
              <span>ACCURACY: 99.1%</span>
              <span>YOLOv8 DETECT</span>
            </div>
          </div>

          {/* Cap 2 */}
          <div className="capability-card">
            <div className="cap-header">
              <span className="cap-serial">[ CAP-02 ]</span>
              <span className="cap-status operational">OPERATIONAL</span>
            </div>
            <div className="cap-icon">🚗</div>
            <h3 className="cap-title">Vehicle Analytics</h3>
            <p className="cap-desc">
              Multi-class categorization of cars, trucks, buses, motorcycles, and emergency vehicles.
              Calculates motion vectors, wrong-way transit, and parking violations.
            </p>
            <div className="cap-footer">
              <span>SPEED ESTIMATION</span>
              <span>MULTI-CLASS</span>
            </div>
          </div>

          {/* Cap 3 */}
          <div className="capability-card">
            <div className="cap-header">
              <span className="cap-serial">[ CAP-03 ]</span>
              <span className="cap-status operational">OPERATIONAL</span>
            </div>
            <div className="cap-icon">🛡️</div>
            <h3 className="cap-title">Perimeter Intrusion Detection</h3>
            <p className="cap-desc">
              User-configurable polygonal virtual tripwires and exclusion zones. Automatically
              triggers immediate high-priority alerts when sterile zones are breached.
            </p>
            <div className="cap-footer">
              <span>VIRTUAL TRIPWIRES</span>
              <span>&lt; 50MS ALARM</span>
            </div>
          </div>

          {/* Cap 4 */}
          <div className="capability-card">
            <div className="cap-header">
              <span className="cap-serial">[ CAP-04 ]</span>
              <span className="cap-status operational">OPERATIONAL</span>
            </div>
            <div className="cap-icon">🌙</div>
            <h3 className="cap-title">Low-Light &amp; Thermal Vision</h3>
            <p className="cap-desc">
              Contrast-adaptive enhancement and motion vectoring tuned for infrared, night vision,
              and low-illumination security environments without false triggers.
            </p>
            <div className="cap-footer">
              <span>NIGHT MODE</span>
              <span>IR COMPATIBLE</span>
            </div>
          </div>

          {/* Cap 5 */}
          <div className="capability-card planned">
            <div className="cap-header">
              <span className="cap-serial">[ CAP-05 ]</span>
              <span className="cap-status planned">PLANNED // COMING SOON</span>
            </div>
            <div className="cap-icon">🔍</div>
            <h3 className="cap-title">Automated Number Plate (ANPR)</h3>
            <p className="cap-desc">
              Optical character recognition for state and regional vehicle registration plates.
              Automated whitelist verification and unauthorized vehicle detection.
            </p>
            <div className="cap-footer">
              <span>OCR RECOGNITION</span>
              <span>WHITELIST SYNC</span>
            </div>
          </div>

          {/* Cap 6 */}
          <div className="capability-card planned">
            <div className="cap-header">
              <span className="cap-serial">[ CAP-06 ]</span>
              <span className="cap-status planned">PLANNED // COMING SOON</span>
            </div>
            <div className="cap-icon">🎯</div>
            <h3 className="cap-title">Facial Recognition &amp; Watchlists</h3>
            <p className="cap-desc">
              512-dimensional facial biometric embedding comparison against authorized personnel
              databases and security watchlists with instant biometric similarity scoring.
            </p>
            <div className="cap-footer">
              <span>BIOMETRIC EMBEDDINGS</span>
              <span>WATCHLIST AUDIT</span>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          PIPELINE / HOW IT WORKS
          ============================================================ */}
      <section id="pipeline" className="pipeline-section">
        <div className="section-header">
          <div className="section-pretitle">03 // ARCHITECTURE FLOW</div>
          <h2 className="section-title">INTELLIGENCE PROCESSING PIPELINE</h2>
          <p className="section-subtitle">
            From raw camera frames to actionable tactical response in under 45 milliseconds.
          </p>
        </div>

        <div className="pipeline-steps">
          {/* Step 1 */}
          <div className="pipeline-step">
            <div className="step-number">01</div>
            <div className="step-tag">INGEST</div>
            <h4 className="step-title">Video Ingestion</h4>
            <p className="step-desc">
              Pulls high-definition video from existing IP cameras, NVRs, and RTSP streams
              over secure local network protocols without proprietary hardware.
            </p>
            <div className="step-detail">RTSP / ONVIF / H.264</div>
          </div>

          <div className="pipeline-connector">→</div>

          {/* Step 2 */}
          <div className="pipeline-step">
            <div className="step-number">02</div>
            <div className="step-tag">INFERENCE</div>
            <h4 className="step-title">Neural Vision</h4>
            <p className="step-desc">
              Frame-by-frame deep neural net inference identifying persons, vehicles, and objects
              with high spatial precision at 30+ frames per second.
            </p>
            <div className="step-detail">YOLOv8s Neural Net</div>
          </div>

          <div className="pipeline-connector">→</div>

          {/* Step 3 */}
          <div className="pipeline-step">
            <div className="step-number">03</div>
            <div className="step-tag">TRACK</div>
            <h4 className="step-title">Spatial Tracking</h4>
            <p className="step-desc">
              Multi-object tracking algorithm assigns persistent track IDs, maintains movement
              trajectories, and filters sensor noise across frame boundaries.
            </p>
            <div className="step-detail">Multi-Object Tracker</div>
          </div>

          <div className="pipeline-connector">→</div>

          {/* Step 4 */}
          <div className="pipeline-step">
            <div className="step-number">04</div>
            <div className="step-tag">EVALUATE</div>
            <h4 className="step-title">Threat Engine</h4>
            <p className="step-desc">
              Heuristic evaluation cross-references tracks with user perimeter zones, curfew hours,
              and loitering rules to trigger actionable threat states.
            </p>
            <div className="step-detail">Rule &amp; Zone Heuristics</div>
          </div>

          <div className="pipeline-connector">→</div>

          {/* Step 5 */}
          <div className="pipeline-step">
            <div className="step-number">05</div>
            <div className="step-tag">DISPATCH</div>
            <h4 className="step-title">Command HUD</h4>
            <p className="step-desc">
              Broadcasts low-latency event alerts to operator screens with bounding-box telemetry,
              evidence captures, and instant alarm sound triggers.
            </p>
            <div className="step-detail">WebSocket HUD Broadcast</div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SPECIFICATIONS MATRIX
          ============================================================ */}
      <section id="specifications" className="specs-section">
        <div className="section-header">
          <div className="section-pretitle">04 // SYSTEM SPECIFICATIONS</div>
          <h2 className="section-title">TECHNICAL ARCHITECTURE</h2>
          <p className="section-subtitle">
            Engineered for high-availability military, enterprise, and infrastructure security deployments.
          </p>
        </div>

        <div className="specs-grid">
          <div className="spec-box">
            <span className="spec-label">COMPUTER VISION CORE</span>
            <strong className="spec-value">Ultralytics YOLOv8s</strong>
            <p className="spec-sub">PyTorch &amp; ONNX Runtime edge inference engine.</p>
          </div>

          <div className="spec-box">
            <span className="spec-label">BACKEND ARCHITECTURE</span>
            <strong className="spec-value">FastAPI / Python 3.10+</strong>
            <p className="spec-sub">Asynchronous non-blocking architecture with WebSockets.</p>
          </div>

          <div className="spec-box">
            <span className="spec-label">STREAM PROCESSING</span>
            <strong className="spec-value">OpenCV Multi-Thread Buffer</strong>
            <p className="spec-sub">Decoupled capture and frame analysis pipelines.</p>
          </div>

          <div className="spec-box">
            <span className="spec-label">OPERATOR COMMAND UI</span>
            <strong className="spec-value">React 19 / Modern Vite</strong>
            <p className="spec-sub">Tactical SOC HUD with sub-millisecond local state synchronization.</p>
          </div>

          <div className="spec-box">
            <span className="spec-label">STORAGE &amp; AUDIT</span>
            <strong className="spec-value">SQLite / SQLAlchemy ORM</strong>
            <p className="spec-sub">Persistent telemetry, event logs, and camera configs.</p>
          </div>

          <div className="spec-box">
            <span className="spec-label">DEPLOYMENT TOPOLOGY</span>
            <strong className="spec-value">Edge Gateway / On-Premise</strong>
            <p className="spec-sub">Full offline operation capability with no mandatory cloud dependency.</p>
          </div>
        </div>
      </section>

      {/* ============================================================
          FINAL CTA BANNER
          ============================================================ */}
      <section className="cta-banner-section">
        <div className="cta-banner-container">
          <div className="corner-bracket top-left"></div>
          <div className="corner-bracket top-right"></div>
          <div className="corner-bracket bottom-left"></div>
          <div className="corner-bracket bottom-right"></div>

          <span className="cta-classification">[ COMMAND CENTER ACCESS ]</span>
          <h2 className="cta-heading">READY TO DEPLOY AVEKSHA NETRA?</h2>
          <p className="cta-text">
            Launch the unified tactical command center to monitor live video feeds, manage automated
            perimeter rules, and review real-time AI security incidents.
          </p>

          <div className="cta-buttons">
            <button
              type="button"
              className="hero-primary-btn"
              onClick={onLogin}
            >
              ACCESS COMMAND CENTER
              <span className="btn-arrow">→</span>
            </button>

            <button
              type="button"
              className="hero-secondary-btn"
              onClick={onRegister}
            >
              CREATE OPERATOR ACCOUNT
            </button>
          </div>
        </div>
      </section>

      {/* ============================================================
          TACTICAL FOOTER
          ============================================================ */}
      <footer className="landing-footer">
        <div className="footer-container">
          <div className="footer-left">
            <div className="footer-brand">
              <span className="footer-logo">AN</span>
              <strong>AVEKSHA NETRA</strong>
            </div>
            <p className="footer-copy">
              AI-POWERED INTELLIGENT SURVEILLANCE &amp; THREAT DETECTION PLATFORM.
            </p>
          </div>

          <div className="footer-right">
            <div className="system-readiness">
              <span className="readiness-dot"></span>
              <span>DEFENSE GRADE // LEVEL 4 READY</span>
            </div>
            <div className="footer-version">
              AVEKSHA NETRA v2.4 • ALL SYSTEMS NOMINAL
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Landing;