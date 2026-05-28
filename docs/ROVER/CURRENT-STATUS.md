# Rover - Current Implementation Status

**Real-time tracking of the 3D reconstruction implementation**

---

## 📊 Overall Progress

- [x] **Iteration 1**: Dual Camera Setup (LEFT/RIGHT viewpoints) ✅ **COMPLETE**
- [ ] **Iteration 2**: Calibration & Rectification 🔄 **NEXT**
- [ ] **Iteration 3**: Disparity Computation ⏳ Planned
- [ ] **Iteration 4**: Point Cloud Generation ⏳ Planned
- [ ] **Iteration 5**: Meshing & Integration ⏳ Planned

---

## ✅ Iteration 1: Dual Camera Setup (COMPLETE)

**Goal**: Add synchronized left/right camera viewpoints to enable stereo vision capture.

### Implemented Features

#### 1. LEFT and RIGHT Viewpoint Modes
- Added two new camera modes to `ViewModeController`:
  - **LEFT** - Left camera position
  - **RIGHT** - Right camera position
- Both modes positioned symmetrically around rover centerline
- Synchronized forward direction matching rover heading

#### 2. Camera Positioning Logic
- **Baseline**: 10 cm horizontal offset (5 cm left/right from rover center)
- **Height**: Eye-level camera mount (configurable)
- **Direction**: Forward-facing, aligned with rover orientation
- **Formula**: 
  ```
  leftCameraPos = roverPos + (perpendicular × -0.05)
  rightCameraPos = roverPos + (perpendicular × +0.05)
  ```

#### 3. Keyboard Controls
- **LEFT**: Press `Q` or click "Left Cam" button
- **RIGHT**: Press `E` or click "Right Cam" button
- Smooth camera transitions between modes
- Preserved orbit and follow modes for normal navigation

#### 4. UI Updates
- Added "Left Cam" and "Right Cam" buttons in ViewMode panel
- Visual feedback for active camera mode
- Tooltip indicators for keyboard shortcuts

### Technical Details

**Files Modified**:
- `code/app/web/src/components/ViewModeController.ts` - Added LEFT/RIGHT modes
- `code/app/web/src/components/CameraController.ts` - Implemented stereo positioning logic
- `code/app/web/src/components/MainUI.ts` - Added UI buttons and keyboard bindings

**Camera Parameters** (Current defaults):
- Baseline: 0.10 m (10 cm)
- Mount height: Rover chassis height + offset
- FOV: Standard perspective (configurable via existing camera settings)
- No lens distortion modeled yet (planned for Iteration 2)

**Limitations**:
- No image capture API yet (frames are rendered but not saved)
- No calibration data structure
- Cameras always face forward (no independent look direction)

---

## 🔄 Iteration 2: Calibration & Rectification (NEXT UP)

**Goal**: Implement camera calibration and image rectification pipeline.

### Planned Tasks

#### 2.1. Calibration Data Structure
- [ ] Create `StereoCalibration` class
  - Store intrinsic matrix K (fx, fy, cx, cy)
  - Store distortion coefficients (k1, k2, p1, p2, k3)
  - Store extrinsic R (rotation matrix) and T (translation vector)
  - Serialize/deserialize to JSON

#### 2.2. Calibration UI
- [ ] Add checkerboard pattern generator in scene
- [ ] "Capture Calibration Image" button (left/right pair)
- [ ] Display captured image pairs in gallery
- [ ] "Compute Calibration" button - run OpenCV calibration
- [ ] Display calibration results (reprojection error, camera matrix)

#### 2.3. Rectification Pipeline
- [ ] Compute rectification transforms from calibration data
- [ ] Apply rectification to captured images (GPU shader or CPU)
- [ ] Visualize rectified images side-by-side
- [ ] Verify epipolar lines are horizontal (diagnostic overlay)

#### 2.4. Integration
- [ ] Export calibration to file (JSON)
- [ ] Load calibration from file
- [ ] Validate calibration quality (error threshold)

### Technical Considerations
- **OpenCV.js** or Python backend for calibration? (Decision needed)
- **Image capture**: Use canvas `toDataURL()` or WebGL framebuffer?
- **Checkerboard**: Procedural generation or load from texture?
- **Storage**: Local storage, IndexedDB, or server upload?

---

## 📋 Backlog (Future Iterations)

### Iteration 3: Disparity Computation
- Integrate OpenCV.js stereo matching (BM or SGBM)
- Add parameter tuning UI (block size, num disparities, etc.)
- Display disparity map as heatmap
- Compute confidence map

### Iteration 4: Point Cloud Generation
- Convert disparity to depth using calibration
- Transform to world coordinates using rover pose
- Filter outliers (statistical, radius, Z-score)
- Visualize point cloud in PolyLab viewer (additive)

### Iteration 5: Meshing & Integration
- Poisson reconstruction or Delaunay triangulation
- Mesh simplification (target poly count)
- Merge with existing terrain mesh
- Texture mapping from camera images

---

## 🐛 Known Issues

### Current Bugs
- None reported yet (Iteration 1 just completed)

### Potential Issues to Watch
- **Camera sync**: Ensure left/right images captured at exact same frame
- **Rover movement**: Handle camera updates during motion (interpolation?)
- **Performance**: Dual rendering may impact frame rate on low-end devices
- **Calibration drift**: Cameras may need recalibration if baseline changes

---

## 🧪 Testing & Validation

### Iteration 1 Tests (Completed)
- ✅ Keyboard shortcuts (Q/E) switch to LEFT/RIGHT modes correctly
- ✅ UI buttons update active state
- ✅ Camera positions are symmetric around rover center
- ✅ Camera direction matches rover heading
- ✅ Smooth transitions between view modes
- ✅ No collision with existing ORBIT/FOLLOW modes

### Iteration 2 Tests (Planned)
- [ ] Checkerboard pattern renders correctly
- [ ] Calibration produces valid camera matrix
- [ ] Rectified images have horizontal epipolar lines
- [ ] Reprojection error < 0.5 pixels
- [ ] Calibration data persists across sessions

---

## 📝 Notes & Decisions

### Design Choices Made

1. **Baseline Distance** = 10 cm
   - Rationale: Similar to human interpupillary distance (~6.5 cm) but slightly larger for better depth range in outdoor scenes
   - Trade-off: Larger baseline = better far depth resolution but worse close-up accuracy

2. **Camera Mount** = Fixed height, forward-facing
   - Rationale: Simplifies initial implementation; independent camera rotation not needed for now
   - Future: May add tilt/pan for horizon scanning

3. **Calibration Approach** = Checkerboard pattern
   - Rationale: Industry standard, well-supported by OpenCV, accurate
   - Alternative considered: Feature-based calibration (more complex, less reliable)

4. **No SLAM** = Use known rover pose from simulation
   - Rationale: Ground truth pose available, simplifies pipeline, no loop closure needed
   - Trade-off: Not applicable to real-world robotics (but fine for this project)

### Open Questions

- [ ] Should we support adjustable baseline at runtime? (requires recalibration)
- [ ] Do we need color consistency correction between left/right cameras?
- [ ] Should disparity map be computed on GPU (WebGL shader) or CPU (OpenCV.js)?
- [ ] What format for captured images? (PNG, JPEG, raw RGB array?)

---

## 🔗 See Also

- [STEREOVISION-SPECS.md](STEREOVISION-SPECS.md) - Technical specifications and theory
- `code/app/web/src/components/ViewModeController.ts` - View mode implementation
- `code/app/web/src/components/CameraController.ts` - Camera positioning logic

---

**Last updated**: 2026-05-28  
**Iteration 1 completed**: 2026-05-28  
**Next milestone**: Calibration UI (Iteration 2) - ETA TBD
