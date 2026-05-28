# Rover - Stereoscopic Vision Specifications

**Technical specifications for 3D reconstruction via stereoscopic vision**

---

## 🎯 Objective

Implement 3D reconstruction from two 2D camera images using stereoscopic vision principles. This system will enable the rover to perceive depth and build a 3D map of its environment.

---

## 📐 Stereovision Fundamentals

### Core Principle

Stereovision mimics binocular vision by using two cameras separated by a baseline distance. By comparing corresponding pixels between the left and right images, we can compute disparity (pixel offset), which is inversely proportional to depth.

### Mathematical Foundation

**Disparity to Depth Conversion:**
```
depth = (baseline × focal_length) / disparity
```

Where:
- **baseline**: Physical distance between camera centers (meters)
- **focal_length**: Camera focal length (pixels)
- **disparity**: Horizontal pixel offset between corresponding points (pixels)
- **depth**: Distance from cameras to object (meters)

**Pixel to 3D World Coordinates:**
```
X = (u - cx) × depth / fx
Y = (v - cy) × depth / fy
Z = depth
```

Where:
- **(u, v)**: Pixel coordinates in image
- **(cx, cy)**: Principal point (image center)
- **(fx, fy)**: Focal lengths in pixels
- **(X, Y, Z)**: 3D coordinates in camera space

---

## 🏗️ Recommended Pipeline

### Phase 1: Camera Calibration
**Goal**: Determine intrinsic and extrinsic camera parameters

- **Intrinsic parameters**: Focal length, principal point, lens distortion
- **Extrinsic parameters**: Relative position/rotation between cameras
- **Method**: Checkerboard calibration pattern (OpenCV standard approach)
- **Output**: Camera matrix K, distortion coefficients, rotation R, translation T

### Phase 2: Image Rectification
**Goal**: Transform images so corresponding points lie on the same horizontal line

- **Input**: Raw left/right images + calibration data
- **Process**: Warp images to align epipolar lines horizontally
- **Benefit**: Reduces stereo matching from 2D to 1D search (along scanlines)
- **Output**: Rectified image pair

### Phase 3: Stereo Matching (Disparity Map)
**Goal**: Find corresponding pixels between left and right images

**Algorithms (from simple to advanced)**:
1. **Block Matching (BM)** - Fast but less accurate
2. **Semi-Global Matching (SGM)** - Good balance speed/quality
3. **Deep Learning** (RAFT-Stereo, PSMNet) - Best quality, requires GPU

**Parameters**:
- **min_disparity**: Minimum pixel offset (typically 0)
- **num_disparities**: Max offset range (multiple of 16, e.g., 64, 128)
- **block_size**: Matching window size (odd number, e.g., 5, 9, 15)

**Output**: Disparity map (grayscale image where intensity = disparity)

### Phase 4: 3D Reconstruction
**Goal**: Convert disparity map to 3D point cloud

- **Input**: Disparity map + calibration data
- **Process**: Apply disparity-to-depth formula for each pixel
- **Filtering**: Remove invalid points (disparity = 0 or too large)
- **Output**: Point cloud (X, Y, Z) coordinates

### Phase 5: Mesh Generation (Optional)
**Goal**: Create triangulated surface from point cloud

- **Algorithms**: Poisson reconstruction, Delaunay triangulation, marching cubes
- **Filtering**: Remove noise, outliers, apply smoothing
- **Output**: Triangle mesh compatible with PolyLab viewer

---

## 🔍 Simplified Approach (Recommended for MVP)

Since the rover's pose (position + rotation) is **known** from simulation, we can skip full SLAM (Simultaneous Localization and Mapping) and use a simplified pipeline:

### Assumptions
- Rover position and orientation are provided by simulation
- Cameras are rigidly mounted on rover (fixed relative pose)
- Environment is static (no moving objects)

### Pipeline
1. **Capture** left and right images
2. **Rectify** images using pre-computed calibration
3. **Compute disparity** using fast block matching
4. **Convert to 3D** using known camera parameters
5. **Transform** point cloud to world coordinates using rover pose
6. **Merge** with previous point clouds (incremental mapping)
7. **Visualize** in PolyLab viewer

**Advantages**:
- No need for loop closure detection
- No drift accumulation (pose is ground truth)
- Simpler, faster implementation
- Focus on stereo vision quality

---

## 🛠️ Technical Hypotheses

### Camera Setup
- **Baseline**: 10-20 cm (similar to human eye spacing)
- **Resolution**: 640×480 or 1280×720 px
- **Field of View (FOV)**: 60-90 degrees horizontal
- **Frame rate**: 10-30 fps (depends on processing speed)

### Stereo Constraints
- **Min depth**: 0.5 meters (closer = disparity too large)
- **Max depth**: 10 meters (farther = disparity too small)
- **Accuracy**: ±5% depth error typical for well-calibrated setup

### Processing
- **Rectification**: Precomputed lookup table (fast)
- **Disparity**: Real-time capable with BM on CPU
- **Point cloud**: Filter outliers (Z-score, statistical)
- **Visualization**: Downsample if > 100k points for smooth rendering

---

## 📊 Data Flow

```
┌─────────────┐
│ Left Camera │ ──┐
└─────────────┘   │
                  ├─▶ [Calibration] ──▶ [Rectification]
┌─────────────┐   │
│Right Camera │ ──┘
└─────────────┘

[Rectification] ──▶ [Disparity Map] ──▶ [3D Point Cloud]

[3D Point Cloud] + [Rover Pose] ──▶ [World Coordinates]

[World Coordinates] ──▶ [Mesh (optional)] ──▶ [PolyLab Viewer]
```

---

## 🔧 Implementation Steps (Iteration Roadmap)

### Iteration 1: Camera Setup ✅ COMPLETE
- Add left/right camera viewpoints to scene
- Synchronize image capture
- Implement keyboard/UI controls
- **Status**: Done (see [CURRENT-STATUS.md](CURRENT-STATUS.md))

### Iteration 2: Calibration & Rectification
- Implement checkerboard calibration UI
- Compute intrinsic/extrinsic parameters
- Generate rectification maps
- Save calibration data

### Iteration 3: Disparity Computation
- Integrate OpenCV or custom block matching
- Tune parameters (block size, num disparities)
- Display disparity map in viewer
- Add quality metrics (match confidence)

### Iteration 4: Point Cloud Generation
- Convert disparity to depth
- Transform to world coordinates
- Filter outliers and noise
- Visualize point cloud

### Iteration 5: Meshing & Integration
- Implement Poisson reconstruction or Delaunay
- Generate textured mesh
- Merge with existing scene
- Add UI for reconstruction quality settings

---

## 📚 Glossary

| Term | Definition |
|------|------------|
| **Baseline** | Distance between left and right camera centers |
| **Disparity** | Horizontal pixel offset between corresponding points in left/right images |
| **Epipolar line** | Line in image where corresponding point must lie (geometric constraint) |
| **Rectification** | Image transformation to make epipolar lines horizontal |
| **Block Matching** | Algorithm that compares image patches to find correspondences |
| **SGM** | Semi-Global Matching - optimizes disparity map globally along scanlines |
| **Point Cloud** | Set of 3D points (X, Y, Z) representing scene geometry |
| **Intrinsic** | Camera-specific parameters (focal length, distortion) |
| **Extrinsic** | Camera pose (position, rotation) relative to world or other camera |
| **SLAM** | Simultaneous Localization and Mapping (not needed here due to known pose) |

---

## 🔗 References

### Libraries
- **OpenCV** (Python/C++): Stereo calibration, rectification, block matching
- **Three.js / PolyLab**: Point cloud and mesh visualization
- **PCL** (Point Cloud Library): Advanced point cloud processing (optional)

### Algorithms
- **Block Matching (BM)**: Fast, local method
- **Semi-Global Matching (SGM)**: Better quality, still real-time capable
- **RAFT-Stereo / PSMNet**: Deep learning approaches (best quality, needs GPU)

### Resources
- [OpenCV Stereo Vision Tutorial](https://docs.opencv.org/4.x/dd/d53/tutorial_py_depthmap.html)
- [Middlebury Stereo Benchmark](https://vision.middlebury.edu/stereo/)
- [Learning OpenCV 3 - Chapter on Stereo](https://www.oreilly.com/library/view/learning-opencv-3/9781491937983/)

---

**Last updated**: 2026-05-28  
**Related**: [CURRENT-STATUS.md](CURRENT-STATUS.md) (Rover Iteration 1 status)  
**Next steps**: See Iteration 2 roadmap above
