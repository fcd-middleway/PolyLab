//! Terrain map types (heightmap, slope, flow, materials, etc.)

/// 2D grid of height values representing terrain elevation
#[derive(Clone, Debug)]
pub struct HeightMap {
    pub width: usize,
    pub height: usize,
    pub data: Vec<f32>,
}

impl HeightMap {
    /// Create a new heightmap filled with zeros
    pub fn new(width: usize, height: usize) -> Self {
        Self {
            width,
            height,
            data: vec![0.0; width * height],
        }
    }

    /// Create a new heightmap filled with a specific value
    pub fn filled(width: usize, height: usize, value: f32) -> Self {
        Self {
            width,
            height,
            data: vec![value; width * height],
        }
    }

    /// Get height value at (x, y)
    #[inline]
    pub fn get(&self, x: usize, y: usize) -> Option<f32> {
        if x < self.width && y < self.height {
            Some(self.data[y * self.width + x])
        } else {
            None
        }
    }

    /// Set height value at (x, y)
    #[inline]
    pub fn set(&mut self, x: usize, y: usize, value: f32) -> bool {
        if x < self.width && y < self.height {
            self.data[y * self.width + x] = value;
            true
        } else {
            false
        }
    }

    /// Get mutable reference to height value at (x, y)
    #[inline]
    pub fn get_mut(&mut self, x: usize, y: usize) -> Option<&mut f32> {
        if x < self.width && y < self.height {
            Some(&mut self.data[y * self.width + x])
        } else {
            None
        }
    }

    /// Get the minimum height value
    pub fn min(&self) -> f32 {
        self.data.iter().copied().fold(f32::INFINITY, f32::min)
    }

    /// Get the maximum height value
    pub fn max(&self) -> f32 {
        self.data.iter().copied().fold(f32::NEG_INFINITY, f32::max)
    }

    /// Normalize heights to [0.0, 1.0] range
    pub fn normalize(&mut self) {
        let min = self.min();
        let max = self.max();
        let range = max - min;
        
        if range > 0.0 {
            for h in &mut self.data {
                *h = (*h - min) / range;
            }
        }
    }
}

/// Generic 2D scalar map (used for slope, flow accumulation, moisture, etc.)
#[derive(Clone, Debug)]
pub struct ScalarMap {
    pub width: usize,
    pub height: usize,
    pub data: Vec<f32>,
}

impl ScalarMap {
    /// Create a new scalar map filled with zeros
    pub fn new(width: usize, height: usize) -> Self {
        Self {
            width,
            height,
            data: vec![0.0; width * height],
        }
    }

    /// Create a new scalar map filled with a specific value
    pub fn filled(width: usize, height: usize, value: f32) -> Self {
        Self {
            width,
            height,
            data: vec![value; width * height],
        }
    }

    /// Get value at (x, y)
    #[inline]
    pub fn get(&self, x: usize, y: usize) -> Option<f32> {
        if x < self.width && y < self.height {
            Some(self.data[y * self.width + x])
        } else {
            None
        }
    }

    /// Set value at (x, y)
    #[inline]
    pub fn set(&mut self, x: usize, y: usize, value: f32) -> bool {
        if x < self.width && y < self.height {
            self.data[y * self.width + x] = value;
            true
        } else {
            false
        }
    }

    /// Get mutable reference to value at (x, y)
    #[inline]
    pub fn get_mut(&mut self, x: usize, y: usize) -> Option<&mut f32> {
        if x < self.width && y < self.height {
            Some(&mut self.data[y * self.width + x])
        } else {
            None
        }
    }
}

/// Flow direction using D8 algorithm (8 cardinal directions)
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u8)]
pub enum FlowDirection {
    None = 0,
    East = 1,
    SouthEast = 2,
    South = 3,
    SouthWest = 4,
    West = 5,
    NorthWest = 6,
    North = 7,
    NorthEast = 8,
}

impl FlowDirection {
    /// Get the (dx, dy) offset for this direction
    pub fn offset(&self) -> (i32, i32) {
        match self {
            FlowDirection::None => (0, 0),
            FlowDirection::East => (1, 0),
            FlowDirection::SouthEast => (1, 1),
            FlowDirection::South => (0, 1),
            FlowDirection::SouthWest => (-1, 1),
            FlowDirection::West => (-1, 0),
            FlowDirection::NorthWest => (-1, -1),
            FlowDirection::North => (0, -1),
            FlowDirection::NorthEast => (1, -1),
        }
    }

    /// Create from direction index (0-8)
    pub fn from_index(index: u8) -> Self {
        match index {
            1 => FlowDirection::East,
            2 => FlowDirection::SouthEast,
            3 => FlowDirection::South,
            4 => FlowDirection::SouthWest,
            5 => FlowDirection::West,
            6 => FlowDirection::NorthWest,
            7 => FlowDirection::North,
            8 => FlowDirection::NorthEast,
            _ => FlowDirection::None,
        }
    }
}

/// Map storing flow direction for each cell (for hydraulic simulation)
#[derive(Clone, Debug)]
pub struct FlowDirectionMap {
    pub width: usize,
    pub height: usize,
    pub data: Vec<FlowDirection>,
}

impl FlowDirectionMap {
    /// Create a new flow direction map (all directions set to None)
    pub fn new(width: usize, height: usize) -> Self {
        Self {
            width,
            height,
            data: vec![FlowDirection::None; width * height],
        }
    }

    /// Get flow direction at (x, y)
    #[inline]
    pub fn get(&self, x: usize, y: usize) -> Option<FlowDirection> {
        if x < self.width && y < self.height {
            Some(self.data[y * self.width + x])
        } else {
            None
        }
    }

    /// Set flow direction at (x, y)
    #[inline]
    pub fn set(&mut self, x: usize, y: usize, direction: FlowDirection) -> bool {
        if x < self.width && y < self.height {
            self.data[y * self.width + x] = direction;
            true
        } else {
            false
        }
    }
}

/// Multi-layer material weight map (splat map) for rendering
/// Each cell contains weights for N different materials (sum = 1.0)
#[derive(Clone, Debug)]
pub struct MaterialWeightMaps {
    pub width: usize,
    pub height: usize,
    pub num_materials: usize,
    /// Flat array: [mat0_cell0, mat1_cell0, ..., mat0_cell1, mat1_cell1, ...]
    pub data: Vec<f32>,
}

impl MaterialWeightMaps {
    /// Create a new material weight map (all weights = 0)
    pub fn new(width: usize, height: usize, num_materials: usize) -> Self {
        Self {
            width,
            height,
            num_materials,
            data: vec![0.0; width * height * num_materials],
        }
    }

    /// Get material weight at (x, y) for material `material_index`
    #[inline]
    pub fn get(&self, x: usize, y: usize, material_index: usize) -> Option<f32> {
        if x < self.width && y < self.height && material_index < self.num_materials {
            let cell_index = y * self.width + x;
            Some(self.data[cell_index * self.num_materials + material_index])
        } else {
            None
        }
    }

    /// Set material weight at (x, y) for material `material_index`
    #[inline]
    pub fn set(&mut self, x: usize, y: usize, material_index: usize, weight: f32) -> bool {
        if x < self.width && y < self.height && material_index < self.num_materials {
            let cell_index = y * self.width + x;
            self.data[cell_index * self.num_materials + material_index] = weight;
            true
        } else {
            false
        }
    }

    /// Get all material weights at (x, y) as a slice
    pub fn get_weights(&self, x: usize, y: usize) -> Option<&[f32]> {
        if x < self.width && y < self.height {
            let cell_index = y * self.width + x;
            let start = cell_index * self.num_materials;
            let end = start + self.num_materials;
            Some(&self.data[start..end])
        } else {
            None
        }
    }

    /// Get mutable slice of all material weights at (x, y)
    pub fn get_weights_mut(&mut self, x: usize, y: usize) -> Option<&mut [f32]> {
        if x < self.width && y < self.height {
            let cell_index = y * self.width + x;
            let start = cell_index * self.num_materials;
            let end = start + self.num_materials;
            Some(&mut self.data[start..end])
        } else {
            None
        }
    }

    /// Normalize weights at (x, y) so they sum to 1.0
    pub fn normalize_cell(&mut self, x: usize, y: usize) {
        if let Some(weights) = self.get_weights_mut(x, y) {
            let sum: f32 = weights.iter().sum();
            if sum > 0.0 {
                for w in weights.iter_mut() {
                    *w /= sum;
                }
            }
        }
    }
}
