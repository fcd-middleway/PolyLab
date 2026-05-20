//! Entropy coding module for binary compression.
//!
//! This module provides low-level primitives for bit-level I/O and
//! entropy coding (arithmetic coding, range coding, etc.).

pub mod arithmetic;
pub mod bitstream;

pub use arithmetic::{ArithmeticDecoder, ArithmeticEncoder, Context};
pub use bitstream::{BitReader, BitWriter};
