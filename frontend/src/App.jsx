import "./App.css";
import { useEffect, useState } from "react";

import Sidebar from "./components/sidebar";
import Topbar from "./components/Topbar";

import Dashboard from "./pages/Dashboard";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import CameraManagement from "./pages/CameraManagement";


function App() {

  // ==================================================
  // AUTHENTICATION STATE
  // ==================================================

  const [currentUser, setCurrentUser] = useState(() => {

    try {

      const savedUser =
        localStorage.getItem("aveksha_user");

      if (!savedUser) {
        return null;
      }

      return JSON.parse(savedUser);

    } catch (error) {

      console.error(
        "User storage error:",
        error
      );

      localStorage.removeItem("aveksha_user");

      return null;
    }

  });


  // ==================================================
  // APPLICATION MODE
  // ==================================================

  const [appMode, setAppMode] = useState(() => {

    const token =
      localStorage.getItem("aveksha_token");

    const savedUser =
      localStorage.getItem("aveksha_user");

    if (token && savedUser) {
      return "command";
    }

    return "landing";

  });


  // ==================================================
  // ACTIVE DASHBOARD PAGE
  // ==================================================

  const [activePage, setActivePage] =
    useState("overview");


  // ==================================================
  // CAMERA STATE
  // ==================================================

  const [cameras, setCameras] = useState([]);

  const [cameraLoading, setCameraLoading] =
    useState(false);


  // ==================================================
  // FETCH CAMERAS
  // ==================================================

  const fetchCameras = async () => {

    setCameraLoading(true);

    try {

      const response = await fetch(
        "https://aveksha-netra-backend.onrender.com/api/cameras"
      );

      if (!response.ok) {

        throw new Error(
          `Camera API failed: ${response.status}`
        );

      }

      const data = await response.json();

      setCameras(
        Array.isArray(data)
          ? data
          : []
      );

    } catch (error) {

      console.error(
        "Camera API error:",
        error
      );

    } finally {

      setCameraLoading(false);

    }

  };


  // ==================================================
  // LOAD CAMERAS
  // ==================================================

  useEffect(() => {

    if (appMode === "command") {

      fetchCameras();

    }

  }, [appMode]);


  // ==================================================
  // LOGIN SUCCESS
  // ==================================================

  const handleLogin = (user) => {

    console.log(
      "Authenticated user:",
      user
    );

    setCurrentUser(user);

    setActivePage("overview");

    setAppMode("command");

  };


  // ==================================================
  // LOGOUT
  // ==================================================

  const handleLogout = () => {

    localStorage.removeItem(
      "aveksha_token"
    );

    localStorage.removeItem(
      "aveksha_user"
    );

    setCurrentUser(null);

    setCameras([]);

    setActivePage("overview");

    setAppMode("landing");

  };


  // ==================================================
  // RETURN TO LANDING
  // ==================================================

  const handleBackToLanding = () => {

    setAppMode("landing");

  };


  // ==================================================
  // LANDING PAGE
  // ==================================================

  if (appMode === "landing") {

    return (

      <Landing

        onLogin={() => {
          setAppMode("login");
        }}

        onRegister={() => {
          setAppMode("register");
        }}

      />

    );

  }


  // ==================================================
  // LOGIN PAGE
  // ==================================================

  if (appMode === "login") {

    return (

      <Login

        onLogin={handleLogin}

        onBack={handleBackToLanding}

        onRegister={() => {
          setAppMode("register");
        }}

      />

    );

  }


  // ==================================================
  // REGISTER PAGE
  // ==================================================

  if (appMode === "register") {

    return (

      <Register

        onRegister={() => {
          setAppMode("login");
        }}

        onBack={handleBackToLanding}

      />

    );

  }


  // ==================================================
  // COMMAND CENTER
  // ==================================================

  return (

    <div className="app-shell">


      {/* ==================================================
          SIDEBAR
          ================================================== */}

      <Sidebar

        activePage={activePage}

        setActivePage={setActivePage}

      />


      {/* ==================================================
          MAIN AREA
          ================================================== */}

      <div className="main-area">


        {/* ==================================================
            TOPBAR
            ================================================== */}

        <Topbar

          user={currentUser}

          onLogout={handleLogout}

        />


        {/* ==================================================
            CONTENT
            ================================================== */}

        <main className="content-area">


          {/* ==================================================
              OVERVIEW
              ================================================== */}

          {activePage === "overview" && (

            <Dashboard
              cameras={cameras}
            />

          )}


          {/* ==================================================
              CAMERAS
              ================================================== */}

          {activePage === "cameras" && (

            <CameraManagement

              cameras={cameras}

              onCameraAdded={() => {
                fetchCameras();
              }}

              onRefresh={() => {
                fetchCameras();
              }}

            />

          )}


          {/* ==================================================
              ALERTS
              ================================================== */}

          {activePage === "alerts" && (

            <div className="coming-soon">

              <span className="section-label">
                THREAT MONITOR
              </span>

              <h2>
                Alert Center
              </h2>

              <p>
                Real-time AI threat alerts will
                appear here.
              </p>

            </div>

          )}


          {/* ==================================================
              EVENTS
              ================================================== */}

          {activePage === "events" && (

            <div className="coming-soon">

              <span className="section-label">
                EVENT MONITOR
              </span>

              <h2>
                Event Monitor
              </h2>

              <p>
                Detection events and surveillance
                history will appear here.
              </p>

            </div>

          )}


          {/* ==================================================
              ANALYTICS
              ================================================== */}

          {activePage === "analytics" && (

            <div className="coming-soon">

              <span className="section-label">
                SYSTEM ANALYTICS
              </span>

              <h2>
                Analytics Center
              </h2>

              <p>
                Detection statistics and operational
                analytics will appear here.
              </p>

            </div>

          )}


        </main>

      </div>

    </div>

  );

}


export default App;