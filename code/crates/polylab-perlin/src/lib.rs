//! # PolyLab Perlin Noise Module
//!
//! Procedural terrain generation using Perlin noise algorithm.
//!
//! ## Features
//! - Classic Perlin noise 2D implementation
//! - Fractal Brownian Motion (multi-octave noise)
//! - Terrain mesh generation with configurable parameters
//! - Color gradient based on altitude
//!
//! ## Example
//! ```
//! use polylab_perlin::{TerrainParams, generate_terrain};
//!
//! let params = TerrainParams::default();
//! let mesh = generate_terrain(&params);
//! println!("Generated terrain with {} vertices", mesh.vertices.len());
//! ```

pub mod perlin;
pub mod terrain;

// Re-export main types for convenience
pub use perlin::PerlinNoise;
pub use terrain::{TerrainParams, generate_terrain};
