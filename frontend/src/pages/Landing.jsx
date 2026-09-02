import React from "react";
import "./Landing.css";
function Landing({ onLogin, onRegister }) {
  return (
    <div className="landing-page">

      {/* ==================================================
          NAVBAR
      ================================================== */}

      <nav className="landing-navbar">

        <div className="brand">

          <div className="brand-mark">
            AN
          </div>

          <div className="brand-text">
            <strong>AVEKSHA NETRA</strong>
            <span>INTELLIGENT SURVEILLANCE SYSTEM</span>
          </div>

        </div>


        <div className="nav-links">

          <a href="#home">HOME</a>
          <a href="#about">ABOUT</a>
          <a href="#capabilities">CAPABILITIES</a>
          <a href="#how">HOW IT WORKS</a>

        </div>


        <button
          className="nav-login"
          onClick={onLogin}
        >
          LOGIN
        </button>
<button
  className="nav-register"
  onClick={onRegister}
>
  REGISTER
</button>
      </nav>


      {/* ==================================================
          HERO SECTION
      ================================================== */}

      <main
        id="home"
        className="hero-section"
      >

        {/* Digital camouflage background */}

        <div className="camouflage"></div>

        {/* Background grid */}

        <div className="hero-grid"></div>


        <div className="hero-content">

          <div className="system-label">

            <span className="system-dot"></span>

            AI SURVEILLANCE • COMMAND & CONTROL

          </div>


          <h1>

            AVEKSHA

            <span> NETRA</span>

          </h1>


          <div className="hero-line"></div>


          <h2>
            AI-POWERED INTELLIGENT
            <br />
            SURVEILLANCE & THREAT DETECTION
          </h2>


          <p>

            Transforming existing CCTV infrastructure
            into an intelligent real-time surveillance
            network for enhanced situational awareness,
            threat detection and rapid response.

          </p>


          <div className="hero-buttons">

            <button
              className="primary-button"
              onClick={onLogin}
            >

              ENTER COMMAND CENTER

              <span>→</span>

            </button>


            <button
              className="secondary-button"
              onClick={() => {
                document
                  .getElementById("capabilities")
                  ?.scrollIntoView({
                    behavior: "smooth"
                  });
              }}
            >

              EXPLORE SYSTEM

            </button>

          </div>


          <div className="hero-status">

            <div>
              <span className="status-light"></span>
              SYSTEM ONLINE
            </div>

            <div>
              ● 24/7 MONITORING
            </div>

            <div>
              ● AI ENGINE READY
            </div>

          </div>

        </div>


        {/* ==================================================
            RIGHT SIDE VISUAL
        ================================================== */}

        <div className="hero-visual">

          <div className="radar">

            <div className="radar-ring ring-one"></div>

            <div className="radar-ring ring-two"></div>

            <div className="radar-ring ring-three"></div>

            <div className="radar-cross horizontal"></div>

            <div className="radar-cross vertical"></div>

            <div className="radar-sweep"></div>


            <div className="radar-point point-one"></div>
            <div className="radar-point point-two"></div>
            <div className="radar-point point-three"></div>

          </div>


          <div className="visual-card">

            <span>SECTOR STATUS</span>

            <strong>SECURE</strong>

            <small>
              SURVEILLANCE NETWORK ACTIVE
            </small>

          </div>


          <div className="visual-coordinates">

            17° 41' N
            <br />
            78° 27' E

          </div>

        </div>

      </main>


      {/* ==================================================
          ABOUT
      ================================================== */}

      <section
        id="about"
        className="about-section"
      >

        <div className="section-heading">

          <span>
            01 / SYSTEM OVERVIEW
          </span>

          <h2>
            Built for the
            <strong>Modern Battlefield</strong>
          </h2>

        </div>


        <p className="about-text">

          AVEKSHA NETRA is an AI-powered intelligent
          surveillance platform designed to work with
          existing IP-based CCTV infrastructure. The
          system continuously analyses live video streams,
          detects objects and activities, tracks movement,
          identifies threats and delivers actionable alerts
          through a centralized command center.

        </p>

      </section>


      {/* ==================================================
          CAPABILITIES
      ================================================== */}

      <section
        id="capabilities"
        className="capabilities-section"
      >

        <div className="section-heading centered">

          <span>
            02 / INTELLIGENCE
          </span>

          <h2>
            SURVEILLANCE
            <strong>CAPABILITIES</strong>
          </h2>

        </div>


        <div className="capability-grid">

          <Capability
            number="01"
            title="HUMAN DETECTION"
            text="Detect and track personnel in real time."
          />

          <Capability
            number="02"
            title="VEHICLE ANALYSIS"
            text="Detect, classify and track multiple vehicle types."
          />

          <Capability
            number="03"
            title="ANPR"
            text="Automatically identify vehicle registration numbers."
          />

          <Capability
            number="04"
            title="INTRUSION DETECTION"
            text="Identify unauthorized movement across defined zones."
          />

          <Capability
            number="05"
            title="NIGHT MOVEMENT"
            text="Detect suspicious movement during low-light conditions."
          />

          <Capability
            number="06"
            title="REAL-TIME ALERTS"
            text="Generate actionable alerts for significant events."
          />

        </div>

      </section>


      {/* ==================================================
          HOW IT WORKS
      ================================================== */}

      <section
        id="how"
        className="workflow-section"
      >

        <div className="section-heading">

          <span>
            03 / OPERATION
          </span>

          <h2>
            HOW AVEKSHA
            <strong>NETRA WORKS</strong>
          </h2>

        </div>


        <div className="workflow">

          <Workflow
            number="01"
            title="INGEST"
            text="Existing CCTV / RTSP streams"
          />

          <div className="workflow-line"></div>

          <Workflow
            number="02"
            title="ANALYZE"
            text="AI vision and object detection"
          />

          <div className="workflow-line"></div>

          <Workflow
            number="03"
            title="TRACK"
            text="Continuous object tracking"
          />

          <div className="workflow-line"></div>

          <Workflow
            number="04"
            title="RESPOND"
            text="Events, alerts and command action"
          />

        </div>

      </section>


      {/* ==================================================
          FINAL CTA
      ================================================== */}

      <section className="cta-section">

        <div className="cta-box">

          <span>
            AVEKSHA NETRA / COMMAND ACCESS
          </span>

          <h2>
            READY TO ENTER
            <strong>COMMAND CENTER?</strong>
          </h2>

          <p>
            Access the intelligent surveillance
            control system.
          </p>


          <button
            className="primary-button"
            onClick={onLogin}
          >

            LOGIN TO COMMAND CENTER

            <span>→</span>

          </button>

        </div>

      </section>


      {/* ==================================================
          FOOTER
      ================================================== */}

      <footer>

        <div>

          <strong>AVEKSHA NETRA</strong>

          <span>
            AI POWERED INTELLIGENT SURVEILLANCE
          </span>

        </div>


        <div>
          SYSTEM v1.0.0
        </div>

      </footer>

    </div>
  );
}


/* ============================================================
   CAPABILITY COMPONENT
   ============================================================ */

function Capability({
  number,
  title,
  text
}) {

  return (

    <div className="capability-card">

      <div className="capability-number">
        {number}
      </div>

      <div className="capability-icon">
        ◈
      </div>

      <h3>
        {title}
      </h3>

      <p>
        {text}
      </p>

    </div>

  );
}


/* ============================================================
   WORKFLOW COMPONENT
   ============================================================ */

function Workflow({
  number,
  title,
  text
}) {

  return (

    <div className="workflow-item">

      <div className="workflow-number">
        {number}
      </div>

      <h3>
        {title}
      </h3>

      <p>
        {text}
      </p>

    </div>

  );
}


export default Landing;