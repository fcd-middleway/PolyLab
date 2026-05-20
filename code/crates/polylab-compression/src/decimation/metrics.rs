//! Decimation metrics for edge collapse prioritization
//!
//! This module defines various metrics for determining which edges
//! should be collapsed first during mesh simplification.

use crate::aif::{AIF, EdgeId};
use rand::Rng;

/// Types of decimation metrics
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum MetricType {
    /// Random selection (baseline)
    Random,
    /// Prioritize short edges
    EdgeLength,
}

impl MetricType {
    /// Compute the cost for collapsing a given edge
    ///
    /// Lower cost = higher priority for collapse
    ///
    /// Returns None if the edge cannot be collapsed (e.g., boundary constraints)
    pub fn compute_cost(&self, aif: &AIF, edge_id: EdgeId) -> Option<f32> {
        match self {
            MetricType::Random => Self::compute_random_cost(),
            MetricType::EdgeLength => Self::compute_edge_length_cost(aif, edge_id),
        }
    }

    /// Random cost (baseline metric)
    fn compute_random_cost() -> Option<f32> {
        let mut rng = rand::thread_rng();
        Some(rng.gen::<f32>())
    }

    /// Edge length cost (prefer collapsing short edges)
    fn compute_edge_length_cost(aif: &AIF, edge_id: EdgeId) -> Option<f32> {
        // Get edge length (returns None if edge doesn't exist)
        aif.edge_length(edge_id)
    }

    /// Get a human-readable name for the metric
    pub fn name(&self) -> &'static str {
        match self {
            MetricType::Random => "Random",
            MetricType::EdgeLength => "Edge Length",
        }
    }

    /// Parse metric from string name
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "random" => Some(MetricType::Random),
            "edge_length" | "edgelength" => Some(MetricType::EdgeLength),
            _ => None,
        }
    }
}

/// Trait for custom decimation metrics
///
/// This trait can be implemented to define custom metrics
/// for edge collapse prioritization.
pub trait DecimationMetric {
    /// Compute the cost for collapsing an edge
    ///
    /// Lower cost = higher priority
    fn compute_cost(&self, aif: &AIF, edge_id: EdgeId) -> Option<f32>;
}

impl DecimationMetric for MetricType {
    fn compute_cost(&self, aif: &AIF, edge_id: EdgeId) -> Option<f32> {
        MetricType::compute_cost(self, aif, edge_id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::aif::AIF;
    use glam::Vec3;

    #[test]
    fn test_metric_from_str() {
        assert_eq!(MetricType::from_str("random"), Some(MetricType::Random));
        assert_eq!(
            MetricType::from_str("edge_length"),
            Some(MetricType::EdgeLength)
        );
        assert_eq!(
            MetricType::from_str("EdgeLength"),
            Some(MetricType::EdgeLength)
        );
        assert_eq!(MetricType::from_str("unknown"), None);
    }

    #[test]
    fn test_metric_name() {
        assert_eq!(MetricType::Random.name(), "Random");
        assert_eq!(MetricType::EdgeLength.name(), "Edge Length");
    }

    #[test]
    fn test_random_metric() {
        let cost1 = MetricType::Random.compute_cost(&AIF::new(), EdgeId::default());
        let cost2 = MetricType::Random.compute_cost(&AIF::new(), EdgeId::default());

        // Both should return Some value
        assert!(cost1.is_some());
        assert!(cost2.is_some());

        // Values should be in [0, 1)
        let c1 = cost1.unwrap();
        let c2 = cost2.unwrap();
        assert!(c1 >= 0.0 && c1 < 1.0);
        assert!(c2 >= 0.0 && c2 < 1.0);
    }

    #[test]
    fn test_edge_length_metric() {
        // Create a simple edge
        let mut aif = AIF::new();
        let v0 = aif.add_vertex(Vec3::new(0.0, 0.0, 0.0));
        let v1 = aif.add_vertex(Vec3::new(3.0, 4.0, 0.0)); // Distance = 5.0

        let edge = aif.add_edge(v0, v1).unwrap();

        let cost = MetricType::EdgeLength.compute_cost(&aif, edge);
        assert!(cost.is_some());
        assert!((cost.unwrap() - 5.0).abs() < 1e-5);
    }

    #[test]
    fn test_edge_length_metric_ordering() {
        // Create two edges of different lengths
        let mut aif = AIF::new();
        let v0 = aif.add_vertex(Vec3::new(0.0, 0.0, 0.0));
        let v1 = aif.add_vertex(Vec3::new(1.0, 0.0, 0.0)); // Distance = 1.0
        let v2 = aif.add_vertex(Vec3::new(5.0, 0.0, 0.0)); // Distance = 5.0

        let short_edge = aif.add_edge(v0, v1).unwrap();
        let long_edge = aif.add_edge(v0, v2).unwrap();

        let cost_short = MetricType::EdgeLength.compute_cost(&aif, short_edge).unwrap();
        let cost_long = MetricType::EdgeLength.compute_cost(&aif, long_edge).unwrap();

        // Short edge should have lower cost (higher priority)
        assert!(cost_short < cost_long);
    }
}
