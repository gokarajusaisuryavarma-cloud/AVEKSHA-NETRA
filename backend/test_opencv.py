import cv2
import os

video_path = os.path.abspath("test_media/test.mp4")

print("Video path:")
print(video_path)

print("\nFile exists:", os.path.exists(video_path))

cap = cv2.VideoCapture(video_path, cv2.CAP_FFMPEG)

print("Video opened:", cap.isOpened())

if not cap.isOpened():
    print("❌ OpenCV could not open the video")
    cap.release()
    exit()

print("✅ Video opened successfully!")

width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
fps = cap.get(cv2.CAP_PROP_FPS)
total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

print("Width:", width)
print("Height:", height)
print("FPS:", fps)
print("Total frames:", total_frames)

success, frame = cap.read()

if success:
    print("✅ First frame received!")
    print("Frame shape:", frame.shape)
else:
    print("❌ Video opened, but frame could not be read")

cap.release()

print("\n🎉 OpenCV test finished!")