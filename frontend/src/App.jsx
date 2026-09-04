import "./App.css";
import { useEffect, useState } from "react";

import Sidebar from "./components/sidebar";
import Topbar from "./components/Topbar";

import Dashboard from "./pages/Dashboard";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import CameraManagement from "./pages/CameraManagement";
import Alerts from "./pages/Alerts";
import Events from "./pages/Events";
import Analytics from "./pages/Analytics";
import { camerasApi } from "./api";


// ==================================================
// APP
// ==================================================

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
      const data = await camerasApi.getCameras();
      setCameras(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Camera API error:", error);
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

        onLogin={() => {
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
              refreshCameras={fetchCameras}
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
            <Alerts onNavigateToOverview={() => setActivePage("overview")} />
          )}


          {/* ==================================================
              EVENTS
              ================================================== */}

          {activePage === "events" && (
            <Events />
          )}


          {/* ==================================================
              ANALYTICS
              ================================================== */}

          {activePage === "analytics" && (
            <Analytics />
          )}


        </main>

      </div>

    </div>

  );

}


export default App;