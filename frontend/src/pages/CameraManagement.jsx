import { useEffect, useState } from "react";
import "./CameraManagement.css";

const API_BASE = "http://127.0.0.1:8000";

function CameraManagement() {
  const [cameras, setCameras] = useState([]);
  const [loadingCameras, setLoadingCameras] = useState(true);

  const [cameraName, setCameraName] = useState("");
  const [location, setLocation] = useState("");
  const [rtspUrl, setRtspUrl] = useState("");

  const [editingCameraId, setEditingCameraId] = useState(null);
  const [savingCamera, setSavingCamera] = useState(false);

  const fetchCameras = async () => {
    try {
      setLoadingCameras(true);

      const response = await fetch(
        `${API_BASE}/api/cameras`
      );

      if (!response.ok) {
        throw new Error("Failed to load cameras");
      }

      const data = await response.json();

      setCameras(data);

      console.log("Cameras loaded:", data);
    } catch (error) {
      console.error("Camera list error:", error);
    } finally {
      setLoadingCameras(false);
    }
  };

  useEffect(() => {
    fetchCameras();
  }, []);

  // =========================================
  // CLEAR FORM
  // =========================================

  const clearForm = () => {
    setCameraName("");
    setLocation("");
    setRtspUrl("");
    setEditingCameraId(null);
  };

  // =========================================
  // ADD / UPDATE CAMERA
  // =========================================

  const handleAddCamera = async (event) => {
    event.preventDefault();

    try {
      setSavingCamera(true);

      const isEditing = editingCameraId !== null;

      const url = isEditing
        ? `${API_BASE}/api/cameras/${editingCameraId}`
        : `${API_BASE}/api/cameras`;

      const response = await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: cameraName,
          location: location,
          rtsp_url: rtspUrl,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            (isEditing
              ? "Failed to update camera"
              : "Failed to add camera")
        );
      }

      alert(
        isEditing
          ? "Camera updated successfully!"
          : "Camera added successfully!"
      );

      await fetchCameras();

      clearForm();

      console.log(
        isEditing
          ? "Camera updated:"
          : "Camera added:",
        data
      );
    } catch (error) {
      console.error(
        editingCameraId !== null
          ? "Update camera error:"
          : "Add camera error:",
        error
      );

      alert(`Operation failed: ${error.message}`);
    } finally {
      setSavingCamera(false);
    }
  };

  // =========================================
  // EDIT CAMERA
  // =========================================

  const handleEditCamera = (camera) => {
    setEditingCameraId(camera.id);
    setCameraName(camera.name);
    setLocation(camera.location);
    setRtspUrl(camera.rtsp_url || "");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // =========================================
  // DELETE CAMERA
  // =========================================

  const handleDeleteCamera = async (camera) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${camera.name}"?\n\n` +
        `This will remove the camera from the surveillance network.`
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE}/api/cameras/${camera.id}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Failed to delete camera"
        );
      }

      alert("Camera deleted successfully!");

      if (editingCameraId === camera.id) {
        clearForm();
      }

      await fetchCameras();

      console.log("Camera deleted:", data);
    } catch (error) {
      console.error(
        "Delete camera error:",
        error
      );

      alert(
        `Failed to delete camera: ${error.message}`
      );
    }
  };

  // =========================================
  // TEST CONNECTION
  // =========================================

  const handleTestConnection = async () => {
    if (!rtspUrl.trim()) {
      alert("Please enter an RTSP URL");
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE}/api/cameras/test-connection`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: cameraName || "Test Camera",
            location: location || "Unknown",
            rtsp_url: rtspUrl,
          }),
        }
      );

      const data = await response.json();

      console.log(
        "Camera test result:",
        data
      );

      if (data.connected) {
        alert(
          `CAMERA CONNECTED\n\n` +
            `Resolution: ${data.width} × ${data.height}`
        );
      } else {
        alert(
          `CONNECTION FAILED\n\n${data.message}`
        );
      }
    } catch (error) {
      console.error(
        "Camera connection test error:",
        error
      );

      alert(
        `Backend connection failed\n\n${error.message}`
      );
    }
  };

  return (
    <div className="camera-management-page">

      {/* PAGE HEADER */}

      <div className="camera-page-header">
        <div>
          <span className="section-label">
            SURVEILLANCE NETWORK
          </span>

          <h2>Camera Management</h2>

          <p>
            Add and configure surveillance cameras
            for the AVEKSHA NETRA network.
          </p>
        </div>
      </div>


      {/* CAMERA FORM CARD */}

      <div className="camera-management-card">

        <div className="camera-card-header">

          <div>
            <span className="section-label">
              {editingCameraId !== null
                ? "EDIT CAMERA"
                : "NEW CAMERA"}
            </span>

            <h3>
              {editingCameraId !== null
                ? "Update Surveillance Camera"
                : "Add Surveillance Camera"}
            </h3>
          </div>

          <div className="camera-status-badge">
            {editingCameraId !== null
              ? `CAMERA #${editingCameraId}`
              : "CONFIGURATION"}
          </div>

        </div>


        {/* FORM */}

        <form
          className="camera-form"
          onSubmit={handleAddCamera}
        >

          {/* CAMERA NAME */}

          <div className="form-group">

            <label>
              Camera Name
            </label>

            <input
              type="text"
              placeholder="Example: Border Camera 01"
              value={cameraName}
              onChange={(event) =>
                setCameraName(event.target.value)
              }
              required
            />

          </div>


          {/* LOCATION */}

          <div className="form-group">

            <label>
              Location
            </label>

            <input
              type="text"
              placeholder="Example: East Gate"
              value={location}
              onChange={(event) =>
                setLocation(event.target.value)
              }
              required
            />

          </div>


          {/* RTSP URL */}

          <div className="form-group">

            <label>
              RTSP Stream URL
            </label>

            <input
              type="text"
              placeholder="rtsp://username:password@ip:554/..."
              value={rtspUrl}
              onChange={(event) =>
                setRtspUrl(event.target.value)
              }
              required
            />

            <small>
              Enter the RTSP URL provided by your
              surveillance camera or NVR.
            </small>

          </div>


          {/* BUTTONS */}

          <div className="camera-form-actions">

            {editingCameraId !== null && (
              <button
                type="button"
                className="cancel-camera-button"
                onClick={clearForm}
                disabled={savingCamera}
              >
                CANCEL
              </button>
            )}

            <button
              type="button"
              className="test-camera-button"
              onClick={handleTestConnection}
              disabled={savingCamera}
            >
              TEST CONNECTION
            </button>

            <button
              type="submit"
              className="add-camera-button"
              disabled={savingCamera}
            >
              {savingCamera
                ? "SAVING..."
                : editingCameraId !== null
                ? "UPDATE CAMERA"
                : "ADD CAMERA"}
            </button>

          </div>

        </form>

      </div>


      {/* CAMERA LIST */}

      <div className="camera-management-card">

        <div className="camera-card-header">

          <div>
            <span className="section-label">
              SURVEILLANCE NETWORK
            </span>

            <h3>
              Registered Cameras
            </h3>
          </div>

          <div className="camera-status-badge">
            {cameras.length} CAMERAS
          </div>

        </div>


        {loadingCameras ? (

          <div className="camera-list-empty">
            Loading cameras...
          </div>

        ) : cameras.length === 0 ? (

          <div className="camera-list-empty">
            No cameras registered.
          </div>

        ) : (

          <div className="camera-list">

            {cameras.map((camera) => (

              <div
                className="camera-list-item"
                key={camera.id}
              >

                {/* CAMERA INFORMATION */}

                <div className="camera-list-info">

                  <strong>
                    {camera.name}
                  </strong>

                  <span>
                    {camera.location}
                  </span>

                </div>


                {/* CAMERA META + ACTIONS */}

                <div className="camera-list-right">

                  <div className="camera-list-meta">

                    <span>
                      ID #{camera.id}
                    </span>

                    <span>
                      {camera.source_type}
                    </span>

                    <span
                      className={
                        camera.is_active
                          ? "camera-online"
                          : "camera-offline"
                      }
                    >
                      {camera.is_active
                        ? "ACTIVE"
                        : "INACTIVE"}
                    </span>

                  </div>


                  <div className="camera-list-actions">

                    <button
                      type="button"
                      className="edit-camera-button"
                      onClick={() =>
                        handleEditCamera(camera)
                      }
                    >
                      EDIT
                    </button>

                    <button
                      type="button"
                      className="delete-camera-button"
                      onClick={() =>
                        handleDeleteCamera(camera)
                      }
                    >
                      DELETE
                    </button>

                  </div>

                </div>

              </div>

            ))}

          </div>

        )}

      </div>

    </div>
  );
}

export default CameraManagement;