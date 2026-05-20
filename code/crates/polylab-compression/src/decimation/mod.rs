//! Mesh decimation module
//!
//! This module provides mesh simplification functionality using edge collapse
//! operations with configurable metrics.

pub mod metrics;

pub use metrics::{DecimationMetric, MetricType};

use crate::aif::{AIF, EdgeId};
use std::cmp::Ordering;
use std::collections::BinaryHeap;

/// An edge with its associated cost for decimation
#[derive(Debug, Clone)]
struct EdgeWithCost {
    edge_id: EdgeId,
    cost: f32,
}

impl PartialEq for EdgeWithCost {
    fn eq(&self, other: &Self) -> bool {
        self.cost == other.cost
    }
}

impl Eq for EdgeWithCost {}

impl PartialOrd for EdgeWithCost {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        // Reverse ordering: lower cost = higher priority
        other.cost.partial_cmp(&self.cost)
    }
}

impl Ord for EdgeWithCost {
    fn cmp(&self, other: &Self) -> Ordering {
        self.partial_cmp(other).unwrap_or(Ordering::Equal)
    }
}

/// Priority queue for edge decimation
///
/// Uses a binary heap to efficiently select the next edge to collapse
/// based on the chosen metric.
pub struct DecimationQueue {
    heap: BinaryHeap<EdgeWithCost>,
}

impl DecimationQueue {
    /// Create a new decimation queue
    pub fn new() -> Self {
        Self {
            heap: BinaryHeap::new(),
        }
    }

    /// Create a queue with a given capacity
    pub fn with_capacity(capacity: usize) -> Self {
        Self {
            heap: BinaryHeap::with_capacity(capacity),
        }
    }

    /// Build the queue from an AIF mesh using the specified metric
    pub fn build(aif: &AIF, metric: &MetricType) -> Self {
        let edges: Vec<EdgeId> = aif.edge_ids().collect();
        let mut heap = BinaryHeap::with_capacity(edges.len());

        for edge_id in edges {
            if let Some(cost) = metric.compute_cost(aif, edge_id) {
                heap.push(EdgeWithCost { edge_id, cost });
            }
        }

        Self { heap }
    }

    /// Pop the next edge to collapse
    pub fn pop(&mut self) -> Option<EdgeId> {
        self.heap.pop().map(|e| e.edge_id)
    }

    /// Check if the queue is empty
    pub fn is_empty(&self) -> bool {
        self.heap.is_empty()
    }

    /// Get the number of edges in the queue
    pub fn len(&self) -> usize {
        self.heap.len()
    }
}

impl Default for DecimationQueue {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::aif::AIF;
    use glam::Vec3;

    #[test]
    fn test_edge_with_cost_ordering() {
        let e1 = EdgeWithCost {
            edge_id: EdgeId::default(),
            cost: 1.0,
        };
        let e2 = EdgeWithCost {
            edge_id: EdgeId::default(),
            cost: 2.0,
        };

        // Lower cost should have higher priority
        assert!(e1 > e2);
    }

    #[test]
    fn test_decimation_queue_basic() {
        let queue = DecimationQueue::new();
        assert!(queue.is_empty());
        assert_eq!(queue.len(), 0);
    }

    #[test]
    fn test_decimation_queue_build() {
        // Create a simple triangle
        let mut aif = AIF::new();
        let v0 = aif.add_vertex(Vec3::new(0.0, 0.0, 0.0));
        let v1 = aif.add_vertex(Vec3::new(1.0, 0.0, 0.0));
        let v2 = aif.add_vertex(Vec3::new(0.0, 1.0, 0.0));

        let edges = vec![
            aif.add_edge(v0, v1).unwrap(),
            aif.add_edge(v1, v2).unwrap(),
            aif.add_edge(v2, v0).unwrap(),
        ];

        aif.add_face(edges);

        // Build queue with EdgeLength metric
        let queue = DecimationQueue::build(&aif, &MetricType::EdgeLength);
        assert_eq!(queue.len(), 3);
    }
}
