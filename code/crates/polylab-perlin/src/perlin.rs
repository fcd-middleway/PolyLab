/// Perlin Noise 2D Implementation
///
/// Classic Perlin noise algorithm for procedural terrain generation.
/// Supports multiple octaves for fractal brownian motion.

/// Perlin Noise generator
pub struct PerlinNoise {
    /// Permutation table for gradient selection
    permutation: [u8; 512],
}

impl PerlinNoise {
    /// Create a new Perlin noise generator with a seed
    ///
    /// # Arguments
    /// * `seed` - Random seed for reproducible noise
    pub fn new(seed: u64) -> Self {
        // Generate permutation table from seed
        let mut perm = [0u8; 256];
        for i in 0..256 {
            perm[i] = i as u8;
        }

        // Fisher-Yates shuffle with seed-based RNG
        let mut rng_state = seed;
        for i in (1..256).rev() {
            // Simple LCG (Linear Congruential Generator)
            rng_state = rng_state.wrapping_mul(6364136223846793005).wrapping_add(1);
            let j = (rng_state % (i as u64 + 1)) as usize;
            perm.swap(i, j);
        }

        // Duplicate permutation table to avoid wrapping
        let mut permutation = [0u8; 512];
        for i in 0..256 {
            permutation[i] = perm[i];
            permutation[i + 256] = perm[i];
        }

        PerlinNoise { permutation }
    }

    /// Fade function for smooth interpolation (6t^5 - 15t^4 + 10t^3)
    #[inline]
    fn fade(t: f32) -> f32 {
        t * t * t * (t * (t * 6.0 - 15.0) + 10.0)
    }

    /// Linear interpolation
    #[inline]
    fn lerp(t: f32, a: f32, b: f32) -> f32 {
        a + t * (b - a)
    }

    /// Gradient function - converts hash to a gradient vector
    #[inline]
    fn grad(hash: u8, x: f32, y: f32) -> f32 {
        // Select gradient direction based on hash
        let h = hash & 3;
        match h {
            0 => x + y,
            1 => -x + y,
            2 => x - y,
            3 => -x - y,
            _ => 0.0, // Should never happen
        }
    }

    /// Get 2D Perlin noise value at coordinates (x, y)
    ///
    /// # Arguments
    /// * `x` - X coordinate
    /// * `y` - Y coordinate
    ///
    /// # Returns
    /// Noise value in range [-1.0, 1.0]
    pub fn noise2d(&self, x: f32, y: f32) -> f32 {
        // Find unit grid cell containing point
        let x_floor = x.floor() as i32;
        let y_floor = y.floor() as i32;
        
        let x_int = (x_floor & 255) as usize;
        let y_int = (y_floor & 255) as usize;

        // Relative position within cell (0.0 to 1.0)
        let x_frac = x - x_floor as f32;
        let y_frac = y - y_floor as f32;

        // Fade curves for smooth interpolation
        let u = Self::fade(x_frac);
        let v = Self::fade(y_frac);

        // Hash coordinates of the 4 grid corners
        let aa = self.permutation[self.permutation[x_int] as usize + y_int] as usize;
        let ab = self.permutation[self.permutation[x_int] as usize + y_int + 1] as usize;
        let ba = self.permutation[self.permutation[x_int + 1] as usize + y_int] as usize;
        let bb = self.permutation[self.permutation[x_int + 1] as usize + y_int + 1] as usize;

        // Compute gradients at corners
        let grad_aa = Self::grad(self.permutation[aa], x_frac, y_frac);
        let grad_ba = Self::grad(self.permutation[ba], x_frac - 1.0, y_frac);
        let grad_ab = Self::grad(self.permutation[ab], x_frac, y_frac - 1.0);
        let grad_bb = Self::grad(self.permutation[bb], x_frac - 1.0, y_frac - 1.0);

        // Interpolate results
        let x1 = Self::lerp(u, grad_aa, grad_ba);
        let x2 = Self::lerp(u, grad_ab, grad_bb);
        
        Self::lerp(v, x1, x2)
    }

    /// Get fractal brownian motion (multi-octave) noise value
    ///
    /// # Arguments
    /// * `x` - X coordinate
    /// * `y` - Y coordinate
    /// * `octaves` - Number of noise layers (1-8)
    /// * `persistence` - Amplitude decay per octave (0.1-1.0)
    ///
    /// # Returns
    /// Noise value in range approximately [-1.0, 1.0]
    pub fn fbm(&self, x: f32, y: f32, octaves: u32, persistence: f32) -> f32 {
        let mut total = 0.0;
        let mut amplitude = 1.0;
        let mut frequency = 1.0;
        let mut max_value = 0.0;

        for _ in 0..octaves.min(8) {
            total += self.noise2d(x * frequency, y * frequency) * amplitude;
            max_value += amplitude;
            amplitude *= persistence;
            frequency *= 2.0;
        }

        // Normalize to [-1, 1] range
        total / max_value
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_perlin_noise_deterministic() {
        let perlin = PerlinNoise::new(42);
        let value1 = perlin.noise2d(1.5, 2.3);
        let value2 = perlin.noise2d(1.5, 2.3);
        assert_eq!(value1, value2, "Same coordinates should produce same value");
    }

    #[test]
    fn test_perlin_noise_range() {
        let perlin = PerlinNoise::new(123);
        for i in 0..100 {
            let x = (i as f32) * 0.1;
            let y = (i as f32) * 0.2;
            let value = perlin.noise2d(x, y);
            assert!(
                value >= -1.0 && value <= 1.0,
                "Noise value should be in range [-1, 1], got {}",
                value
            );
        }
    }

    #[test]
    fn test_perlin_noise_continuity() {
        let perlin = PerlinNoise::new(999);
        let value1 = perlin.noise2d(5.0, 3.0);
        let value2 = perlin.noise2d(5.001, 3.0);
        let diff = (value1 - value2).abs();
        assert!(
            diff < 0.1,
            "Close coordinates should have close values, diff: {}",
            diff
        );
    }

    #[test]
    fn test_fbm_octaves() {
        let perlin = PerlinNoise::new(777);
        
        // Use non-zero coordinates to ensure non-zero noise
        let fbm1 = perlin.fbm(2.5, 3.7, 1, 0.5);
        let fbm4 = perlin.fbm(2.5, 3.7, 4, 0.5);
        
        // Both should be in valid range
        assert!(fbm1 >= -1.0 && fbm1 <= 1.0, "FBM1 out of range: {}", fbm1);
        assert!(fbm4 >= -1.0 && fbm4 <= 1.0, "FBM4 out of range: {}", fbm4);
        
        // At least one should be non-zero (extremely unlikely to both be exactly zero)
        assert!(
            fbm1.abs() > 0.001 || fbm4.abs() > 0.001,
            "At least one FBM value should be non-zero"
        );
    }

    #[test]
    fn test_different_seeds_produce_different_noise() {
        let perlin1 = PerlinNoise::new(1);
        let perlin2 = PerlinNoise::new(2);
        
        let value1 = perlin1.noise2d(5.5, 7.3);
        let value2 = perlin2.noise2d(5.5, 7.3);
        
        assert_ne!(value1, value2, "Different seeds should produce different noise");
    }
}
