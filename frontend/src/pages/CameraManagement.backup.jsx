import { useState } from "react";
import "./CameraManagement.css";

function CameraManagement() {
  const [cameraName, setCameraName] = useState("");
  const [location, setLocation] = useState("");
  const [rtspUrl, setRtspUrl] = useState("");

  const handleAddCamera = async (event) => {
  event.preventDefault();

  try {
    const response = await fetch(
      "https://aveksha-netra-backend.onrender.com/api/cameras",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: cameraName,
          location: location,
          rtsp_url: rtspUrl,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.detail || "Failed to add camera"
      );
    }

    alert("Camera added successfully!");

    console.log("Camera added:", data);

    // Clear form
    setCameraName("");
    setLocation("");
    setRtspUrl("");

  } catch (error) {

    console.error(
      "Add camera error:",
      error
    );

    alert(
      `Failed to add camera: ${error.message}`
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


      {/* ADD CAMERA CARD */}

      <div className="camera-management-card">

        <div className="camera-card-header">

          <div>
            <span className="section-label">
              NEW CAMERA
            </span>

            <h3>
              Add Surveillance Camera
            </h3>
          </div>

          <div className="camera-status-badge">
            CONFIGURATION
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

            <button
              type="button"
              className="test-camera-button"
              onClick={() => {
                console.log(
                  "Testing RTSP:",
                  rtspUrl
                );
              }}
            >
              TEST CONNECTION
            </button>


            <button
              type="submit"
              className="add-camera-button"
            >
              ADD CAMERA
            </button>

          </div>

        </form>

      </div>

    </div>
  );
}

export default CameraManagement;