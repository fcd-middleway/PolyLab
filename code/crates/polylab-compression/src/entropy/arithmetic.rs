//! Arithmetic (Range) coding for entropy compression.
//!
//! This module implements a range coder with adaptive probability models using
//! a simple and reliable approach based on the classic arithmetic coding algorithm.

use std::io::{self, Write};

/// Maximum cumulative frequency before rescaling.
const MAX_FREQ: u32 = (1 << 14) - 1;

/// Context for adaptive probability modeling.
#[derive(Debug, Clone)]
pub struct Context {
    frequencies: Vec<u32>,
    cumulative: Vec<u32>,
}

impl Context {
    /// Creates a new context with uniform initial probabilities.
    pub fn new(num_symbols: usize) -> Self {
        assert!(num_symbols > 0 && num_symbols <= 256);
        
        let frequencies = vec![1; num_symbols];
        let mut cumulative = vec![0; num_symbols + 1];
        for i in 0..num_symbols {
            cumulative[i + 1] = cumulative[i] + 1;
        }
        
        Self {
            frequencies,
            cumulative,
        }
    }

    /// Gets range for a symbol: (low, high, total).
    fn get_range(&self, symbol: usize) -> (u32, u32, u32) {
        (
            self.cumulative[symbol],
            self.cumulative[symbol + 1],
            *self.cumulative.last().unwrap(),
        )
    }

    /// Finds symbol for a given cumulative value.
    fn find_symbol(&self, value: u32) -> usize {
        for i in 0..self.frequencies.len() {
            if value < self.cumulative[i + 1] {
                return i;
            }
        }
        self.frequencies.len() - 1
    }

    /// Updates frequency after encoding/decoding.
    pub fn update(&mut self, symbol: usize) {
        self.frequencies[symbol] += 1;
        
        // Rebuild cumulative
        self.cumulative[0] = 0;
        for i in 0..self.frequencies.len() {
            self.cumulative[i + 1] = self.cumulative[i] + self.frequencies[i];
        }
        
        // Rescale if needed
        let total = *self.cumulative.last().unwrap();
        if total > MAX_FREQ {
            for freq in &mut self.frequencies {
                *freq = (*freq + 1) / 2;
            }
            self.cumulative[0] = 0;
            for i in 0..self.frequencies.len() {
                self.cumulative[i + 1] = self.cumulative[i] + self.frequencies[i];
            }
        }
    }
}

/// Arithmetic encoder.
pub struct ArithmeticEncoder<W: Write> {
    writer: W,
    contexts: Vec<Context>,
    low: u32,
    high: u32,
    pending_bits: u32,
    byte_buffer: u8,
    bits_in_buffer: usize,
}

impl<W: Write> ArithmeticEncoder<W> {
    /// Creates a new encoder.
    pub fn new(writer: W) -> Self {
        Self {
            writer,
            contexts: Vec::new(),
            low: 0,
            high: u32::MAX,
            pending_bits: 0,
            byte_buffer: 0,
            bits_in_buffer: 0,
        }
    }

    /// Adds a context.
    pub fn add_context(&mut self, num_symbols: usize) -> usize {
        let id = self.contexts.len();
        self.contexts.push(Context::new(num_symbols));
        id
    }

    /// Writes a bit plus pending bits.
    fn write_bit(&mut self, bit: bool) -> io::Result<()> {
        self.byte_buffer = (self.byte_buffer << 1) | if bit { 1 } else { 0 };
        self.bits_in_buffer += 1;
        
        if self.bits_in_buffer == 8 {
            self.writer.write_all(&[self.byte_buffer])?;
            self.byte_buffer = 0;
            self.bits_in_buffer = 0;
        }
        
        // Write pending bits (opposite of bit)
        for _ in 0..self.pending_bits {
            self.byte_buffer = (self.byte_buffer << 1) | if !bit { 1 } else { 0 };
            self.bits_in_buffer += 1;
            
            if self.bits_in_buffer == 8 {
                self.writer.write_all(&[self.byte_buffer])?;
                self.byte_buffer = 0;
                self.bits_in_buffer = 0;
            }
        }
        
        self.pending_bits = 0;
        Ok(())
    }

    /// Encodes a symbol.
    pub fn encode_symbol(&mut self, context_id: usize, symbol: usize) -> io::Result<()> {
        assert!(context_id < self.contexts.len());
        
        let context = &self.contexts[context_id];
        let (sym_low, sym_high, total) = context.get_range(symbol);
        
        // Calculate new range
        let range = (self.high as u64) - (self.low as u64) + 1;
        self.high = self.low + (((range * sym_high as u64) / total as u64) - 1) as u32;
        self.low = self.low + ((range * sym_low as u64) / total as u64) as u32;
        
        // Renormalize
        loop {
            if self.high < (1u32 << 31) {
                // Both in lower half
                self.write_bit(false)?;
                self.low <<= 1;
                self.high = (self.high << 1) | 1;
            } else if self.low >= (1u32 << 31) {
                // Both in upper half
                self.write_bit(true)?;
                self.low = (self.low << 1) & u32::MAX;
                self.high = ((self.high << 1) | 1) & u32::MAX;
            } else if self.low >= (1u32 << 30) && self.high < (3u32 << 30) {
                // Straddle middle
                self.pending_bits += 1;
                self.low = (self.low << 1) & !(1u32 << 31);
                self.high = ((self.high << 1) | 1) | (1u32 << 31);
            } else {
                break;
            }
        }
        
        self.contexts[context_id].update(symbol);
        Ok(())
    }

    /// Finishes encoding.
    pub fn finish(mut self) -> io::Result<W> {
        // Flush remaining bits
        self.pending_bits += 1;
        if self.low < (1u32 << 30) {
            self.write_bit(false)?;
        } else {
            self.write_bit(true)?;
        }
        
        // Flush byte buffer
        if self.bits_in_buffer > 0 {
            self.byte_buffer <<= 8 - self.bits_in_buffer;
            self.writer.write_all(&[self.byte_buffer])?;
        }
        
        Ok(self.writer)
    }
}

/// Arithmetic decoder.
pub struct ArithmeticDecoder<'a> {
    data: &'a [u8],
    pos: usize,
    bit_pos: u8,
    contexts: Vec<Context>,
    low: u32,
    high: u32,
    value: u32,
}

impl<'a> ArithmeticDecoder<'a> {
    /// Creates a new decoder.
    pub fn new(data: &'a [u8]) -> Self {
        let mut decoder = Self {
            data,
            pos: 0,
            bit_pos: 0,
            contexts: Vec::new(),
            low: 0,
            high: u32::MAX,
            value: 0,
        };
        
        // Read initial value (32 bits)
        for _ in 0..32 {
            decoder.value = (decoder.value << 1) | decoder.read_bit() as u32;
        }
        
        decoder
    }

    /// Reads a single bit.
    fn read_bit(&mut self) -> bool {
        if self.pos >= self.data.len() {
            return false;
        }
        
        let bit = (self.data[self.pos] >> (7 - self.bit_pos)) & 1;
        self.bit_pos += 1;
        
        if self.bit_pos == 8 {
            self.bit_pos = 0;
            self.pos += 1;
        }
        
        bit == 1
    }

    /// Adds a context.
    pub fn add_context(&mut self, num_symbols: usize) -> usize {
        let id = self.contexts.len();
        self.contexts.push(Context::new(num_symbols));
        id
    }

    /// Decodes a symbol.
    pub fn decode_symbol(&mut self, context_id: usize) -> io::Result<usize> {
        assert!(context_id < self.contexts.len());
        
        let context = &self.contexts[context_id];
        let total = *context.cumulative.last().unwrap();
        
        // Find symbol
        let range = (self.high as u64) - (self.low as u64) + 1;
        let scaled_value = (((self.value as u64 - self.low as u64 + 1) * total as u64 - 1) / range) as u32;
        let symbol = context.find_symbol(scaled_value);
        
        let (sym_low, sym_high, _) = context.get_range(symbol);
        
        // Update range
        self.high = self.low + (((range * sym_high as u64) / total as u64) - 1) as u32;
        self.low = self.low + ((range * sym_low as u64) / total as u64) as u32;
        
        // Renormalize
        loop {
            if self.high < (1u32 << 31) {
                self.low <<= 1;
                self.high = (self.high << 1) | 1;
                self.value = (self.value << 1) | self.read_bit() as u32;
            } else if self.low >= (1u32 << 31) {
                self.low = (self.low << 1) & u32::MAX;
                self.high = ((self.high << 1) | 1) & u32::MAX;
                self.value = ((self.value << 1) | self.read_bit() as u32) & u32::MAX;
            } else if self.low >= (1u32 << 30) && self.high < (3u32 << 30) {
                self.low = (self.low << 1) & !(1u32 << 31);
                self.high = ((self.high << 1) | 1) | (1u32 << 31);
                self.value = ((self.value << 1) | self.read_bit() as u32) ^ (1u32 << 31);
            } else {
                break;
            }
        }
        
        self.contexts[context_id].update(symbol);
        Ok(symbol)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_context_creation() {
        let ctx = Context::new(256);
        assert_eq!(ctx.frequencies.len(), 256);
        assert!(ctx.frequencies.iter().all(|&f| f == 1));
    }

    #[test]
    fn test_context_uniform() {
        let ctx = Context::new(4);
        let (low, high, total) = ctx.get_range(2);
        assert_eq!(low, 2);
        assert_eq!(high, 3);
        assert_eq!(total, 4);
    }

    #[test]
    fn test_context_update() {
        let mut ctx = Context::new(4);
        ctx.update(1);
        let (low, high, total) = ctx.get_range(1);
        assert_eq!(low, 1);
        assert_eq!(high, 3);
        assert_eq!(total, 5);
    }

    #[test]
    fn test_context_find_symbol() {
        let ctx = Context::new(4);
        assert_eq!(ctx.find_symbol(0), 0);
        assert_eq!(ctx.find_symbol(1), 1);
        assert_eq!(ctx.find_symbol(2), 2);
        assert_eq!(ctx.find_symbol(3), 3);
    }

    #[test]
    fn test_roundtrip_single() {
        let mut encoder = ArithmeticEncoder::new(Vec::new());
        encoder.add_context(256);
        encoder.encode_symbol(0, 42).unwrap();
        let compressed = encoder.finish().unwrap();

        let mut decoder = ArithmeticDecoder::new(&compressed);
        decoder.add_context(256);
        let decoded = decoder.decode_symbol(0).unwrap();
        
        assert_eq!(decoded, 42);
    }

    #[test]
    fn test_roundtrip_multiple() {
        let symbols = vec![10, 20, 30, 40, 50];
        
        let mut encoder = ArithmeticEncoder::new(Vec::new());
        encoder.add_context(256);
        for &sym in &symbols {
            encoder.encode_symbol(0, sym).unwrap();
        }
        let compressed = encoder.finish().unwrap();

        let mut decoder = ArithmeticDecoder::new(&compressed);
        decoder.add_context(256);
        for &expected in &symbols {
            let decoded = decoder.decode_symbol(0).unwrap();
            assert_eq!(decoded, expected);
        }
    }

    #[test]
    fn test_roundtrip_text() {
        let text = b"Hello, World!";
        
        let mut encoder = ArithmeticEncoder::new(Vec::new());
        encoder.add_context(256);
        for &byte in text {
            encoder.encode_symbol(0, byte as usize).unwrap();
        }
        let compressed = encoder.finish().unwrap();

        let mut decoder = ArithmeticDecoder::new(&compressed);
        decoder.add_context(256);
        let mut decoded = Vec::new();
        for _ in 0..text.len() {
            decoded.push(decoder.decode_symbol(0).unwrap() as u8);
        }
        
        assert_eq!(decoded, text);
    }

    #[test]
    fn test_multiple_contexts() {
        let mut encoder = ArithmeticEncoder::new(Vec::new());
        let ctx0 = encoder.add_context(100);
        let ctx1 = encoder.add_context(50);
        
        encoder.encode_symbol(ctx0, 42).unwrap();
        encoder.encode_symbol(ctx1, 25).unwrap();
        encoder.encode_symbol(ctx0, 99).unwrap();
        let compressed = encoder.finish().unwrap();

        let mut decoder = ArithmeticDecoder::new(&compressed);
        decoder.add_context(100);
        decoder.add_context(50);
        
        assert_eq!(decoder.decode_symbol(ctx0).unwrap(), 42);
        assert_eq!(decoder.decode_symbol(ctx1).unwrap(), 25);
        assert_eq!(decoder.decode_symbol(ctx0).unwrap(), 99);
    }

    #[test]
    fn test_adaptive_compression() {
        // Repeated symbols should compress better with adaptive model
        let symbols = vec![1, 1, 1, 1, 1, 2, 3];
        
        let mut encoder = ArithmeticEncoder::new(Vec::new());
        encoder.add_context(256);
        for &sym in &symbols {
            encoder.encode_symbol(0, sym).unwrap();
        }
        let compressed = encoder.finish().unwrap();

        let mut decoder = ArithmeticDecoder::new(&compressed);
        decoder.add_context(256);
        for &expected in &symbols {
            assert_eq!(decoder.decode_symbol(0).unwrap(), expected);
        }
    }

    #[test]
    fn test_all_symbols() {
        // Test a variety of symbols
        let symbols = vec![0, 1, 2, 127, 128, 255];
        
        let mut encoder = ArithmeticEncoder::new(Vec::new());
        encoder.add_context(256);
        for &sym in &symbols {
            encoder.encode_symbol(0, sym).unwrap();
        }
        let compressed = encoder.finish().unwrap();

        let mut decoder = ArithmeticDecoder::new(&compressed);
        decoder.add_context(256);
        for &expected in &symbols {
            assert_eq!(decoder.decode_symbol(0).unwrap(), expected);
        }
    }

    #[test]
    fn test_binary_context() {
        let bits = vec![0, 1, 1, 0, 1, 0, 0, 1];
        
        let mut encoder = ArithmeticEncoder::new(Vec::new());
        encoder.add_context(2);
        for &bit in &bits {
            encoder.encode_symbol(0, bit).unwrap();
        }
        let compressed = encoder.finish().unwrap();

        let mut decoder = ArithmeticDecoder::new(&compressed);
        decoder.add_context(2);
        for &expected in &bits {
            assert_eq!(decoder.decode_symbol(0).unwrap(), expected);
        }
    }

    #[test]
    fn test_small_alphabet() {
        let symbols = vec![0, 1, 2, 0, 1, 2, 2, 1, 0];
        
        let mut encoder = ArithmeticEncoder::new(Vec::new());
        encoder.add_context(3);
        for &sym in &symbols {
            encoder.encode_symbol(0, sym).unwrap();
        }
        let compressed = encoder.finish().unwrap();

        let mut decoder = ArithmeticDecoder::new(&compressed);
        decoder.add_context(3);
        for &expected in &symbols {
            assert_eq!(decoder.decode_symbol(0).unwrap(), expected);
        }
    }

    #[test]
    fn test_compression_ratio() {
        // Test that repeated data compresses
        let mut symbols = Vec::new();
        for _ in 0..100 {
            symbols.push(b'A' as usize);
        }
        
        let mut encoder = ArithmeticEncoder::new(Vec::new());
        encoder.add_context(256);
        for &sym in &symbols {
            encoder.encode_symbol(0, sym).unwrap();
        }
        let compressed = encoder.finish().unwrap();

        // Should compress better than 100 bytes
        assert!(compressed.len() < 100);

        let mut decoder = ArithmeticDecoder::new(&compressed);
        decoder.add_context(256);
        for &expected in &symbols {
            assert_eq!(decoder.decode_symbol(0).unwrap(), expected);
        }
    }

    #[test]
    fn test_encode_single_symbol() {
        let mut encoder = ArithmeticEncoder::new(Vec::new());
        encoder.add_context(10);
        encoder.encode_symbol(0, 5).unwrap();
        let _compressed = encoder.finish().unwrap();
    }

    #[test]
    fn test_empty_then_decode() {
        let mut encoder = ArithmeticEncoder::new(Vec::new());
        encoder.add_context(256);
        let _compressed = encoder.finish().unwrap();
    }

    #[test]
    #[should_panic]
    fn test_invalid_context_encode() {
        let mut encoder = ArithmeticEncoder::new(Vec::new());
        encoder.add_context(10);
        encoder.encode_symbol(5, 0).unwrap(); // Context 5 doesn't exist
    }

    #[test]
    #[should_panic]
    fn test_invalid_context_decode() {
        let mut encoder = ArithmeticEncoder::new(Vec::new());
        encoder.add_context(10);
        encoder.encode_symbol(0, 5).unwrap();
        let compressed = encoder.finish().unwrap();

        let mut decoder = ArithmeticDecoder::new(&compressed);
        decoder.add_context(10);
        decoder.decode_symbol(5).unwrap(); // Context 5 doesn't exist
    }
}
