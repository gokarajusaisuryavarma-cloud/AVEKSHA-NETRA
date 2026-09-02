import cv2
import time


def generate_video_stream(source):
    """
    Generate an MJPEG stream from a video file or RTSP source.
    Optimized for local test-video playback.
    """

    camera = cv2.VideoCapture(source, cv2.CAP_FFMPEG)

    # Faster startup / buffering behavior
    camera.set(cv2.CAP_PROP_BUFFERSIZE, 1)

    if not camera.isOpened():
        print(f"❌ Could not open source: {source}")
        return

    print(f"✅ Stream started: {source}")

    try:
        while True:

            success, frame = camera.read()

            if not success:

                # FILE video reached the end.
                # Restart it so the dashboard keeps showing the test video.
                if isinstance(source, str) and source.lower().endswith(
                    (".mp4", ".avi", ".mov", ".mkv")
                ):
                    print("🔄 Test video ended - restarting")

                    camera.set(cv2.CAP_PROP_POS_FRAMES, 0)

                    success, frame = camera.read()

                    if not success:
                        break
                else:
                    print("⏹️ Stream ended")
                    break

            # Resize large frames for faster browser streaming.
            height, width = frame.shape[:2]

            max_width = 1280

            if width > max_width:

                scale = max_width / width

                frame = cv2.resize(
                    frame,
                    (
                        max_width,
                        int(height * scale)
                    ),
                    interpolation=cv2.INTER_AREA
                )

            # JPEG quality 75 = good quality + much faster streaming
            success, buffer = cv2.imencode(
                ".jpg",
                frame,
                [
                    cv2.IMWRITE_JPEG_QUALITY,
                    75
                ]
            )

            if not success:
                continue

            frame_bytes = buffer.tobytes()

            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n"
                b"Content-Length: "
                + str(len(frame_bytes)).encode()
                + b"\r\n\r\n"
                + frame_bytes
                + b"\r\n"
            )

            # Small delay prevents CPU from being hammered.
            time.sleep(0.01)

    except GeneratorExit:

        print("🛑 Client disconnected")

    except Exception as error:

        print(f"❌ Stream error: {error}")

    finally:

        camera.release()

        print("🛑 Stream released")