//! Low-level bit-level I/O primitives.
//!
//! Provides `BitWriter` for writing individual bits to a byte buffer,
//! and `BitReader` for reading bits back.

use std::io::{self, Write};

/// Writer for bit-level output.
///
/// Accumulates bits in a buffer and writes complete bytes to an underlying writer.
/// Bits are written MSB-first (most significant bit first).
///
/// # Example
/// ```
/// use polylab_compression::entropy::BitWriter;
///
/// let mut writer = BitWriter::new(Vec::new());
/// writer.write_bit(true).unwrap();   // Write 1
/// writer.write_bit(false).unwrap();  // Write 0
/// writer.write_bits(0b101, 3).unwrap(); // Write 101
/// let data = writer.finish().unwrap();
/// // Result: 10101000 (padded with zeros)
/// assert_eq!(data, vec![0b10101000]);
/// ```
#[derive(Debug)]
pub struct BitWriter<W: Write> {
    writer: W,
    buffer: u8,      // Current byte being accumulated
    bits_in_buffer: u8, // Number of bits currently in buffer (0-7)
}

impl<W: Write> BitWriter<W> {
    /// Creates a new `BitWriter` wrapping the given writer.
    pub fn new(writer: W) -> Self {
        Self {
            writer,
            buffer: 0,
            bits_in_buffer: 0,
        }
    }

    /// Writes a single bit.
    ///
    /// # Arguments
    /// * `bit` - The bit to write (true = 1, false = 0)
    pub fn write_bit(&mut self, bit: bool) -> io::Result<()> {
        // Shift buffer left and add new bit
        self.buffer = (self.buffer << 1) | (bit as u8);
        self.bits_in_buffer += 1;

        // Flush if buffer is full
        if self.bits_in_buffer == 8 {
            self.flush_buffer()?;
        }

        Ok(())
    }

    /// Writes multiple bits from a u32 value.
    ///
    /// # Arguments
    /// * `value` - The value containing bits to write
    /// * `num_bits` - Number of bits to write (1-32), taken from LSB side of value
    ///
    /// # Panics
    /// Panics if `num_bits` is 0 or greater than 32.
    ///
    /// # Example
    /// ```
    /// use polylab_compression::entropy::BitWriter;
    ///
    /// let mut writer = BitWriter::new(Vec::new());
    /// writer.write_bits(0b1011, 4).unwrap();  // Write 4 bits: 1011
    /// writer.write_bits(0b11, 2).unwrap();    // Write 2 bits: 11
    /// let data = writer.finish().unwrap();
    /// // Result: 10111100 (1011 + 11 + padding)
    /// assert_eq!(data, vec![0b10111100]);
    /// ```
    pub fn write_bits(&mut self, value: u32, num_bits: u8) -> io::Result<()> {
        assert!(num_bits > 0 && num_bits <= 32, "num_bits must be between 1 and 32");

        // Extract bits from MSB to LSB
        for i in (0..num_bits).rev() {
            let bit = (value >> i) & 1 == 1;
            self.write_bit(bit)?;
        }

        Ok(())
    }

    /// Flushes the current byte buffer to the writer, padding with zeros if necessary.
    fn flush_buffer(&mut self) -> io::Result<()> {
        if self.bits_in_buffer > 0 {
            // Pad with zeros on the right if buffer is not full
            let byte = self.buffer << (8 - self.bits_in_buffer);
            self.writer.write_all(&[byte])?;
            self.buffer = 0;
            self.bits_in_buffer = 0;
        }
        Ok(())
    }

    /// Finishes writing, flushes any remaining bits, and returns the underlying writer.
    ///
    /// Any partial byte is padded with zeros on the right.
    pub fn finish(mut self) -> io::Result<W> {
        self.flush_buffer()?;
        Ok(self.writer)
    }
}

// Special implementations for Vec<u8> to provide additional methods
impl BitWriter<Vec<u8>> {
    /// Returns the number of complete bytes written so far (not including bits in buffer).
    pub fn bytes_written(&self) -> usize {
        self.writer.len()
    }
}

/// Reader for bit-level input.
///
/// Reads individual bits from a byte slice.
/// Bits are read MSB-first (most significant bit first).
///
/// # Example
/// ```
/// use polylab_compression::entropy::BitReader;
///
/// let data = vec![0b10101000]; // 10101 + padding
/// let mut reader = BitReader::new(&data);
/// assert_eq!(reader.read_bit().unwrap(), true);  // 1
/// assert_eq!(reader.read_bit().unwrap(), false); // 0
/// assert_eq!(reader.read_bits(3).unwrap(), 0b101); // 101
/// ```
#[derive(Debug)]
pub struct BitReader<'a> {
    data: &'a [u8],
    byte_pos: usize,     // Current byte position in data
    bit_pos: u8,         // Current bit position within byte (0-7, where 0 is MSB)
}

impl<'a> BitReader<'a> {
    /// Creates a new `BitReader` from a byte slice.
    pub fn new(data: &'a [u8]) -> Self {
        Self {
            data,
            byte_pos: 0,
            bit_pos: 0,
        }
    }

    /// Reads a single bit.
    ///
    /// Returns `Ok(true)` for 1, `Ok(false)` for 0, or an error if no more bits are available.
    pub fn read_bit(&mut self) -> io::Result<bool> {
        if self.byte_pos >= self.data.len() {
            return Err(io::Error::new(
                io::ErrorKind::UnexpectedEof,
                "No more bits to read",
            ));
        }

        let byte = self.data[self.byte_pos];
        let bit = (byte >> (7 - self.bit_pos)) & 1 == 1;

        self.bit_pos += 1;
        if self.bit_pos == 8 {
            self.bit_pos = 0;
            self.byte_pos += 1;
        }

        Ok(bit)
    }

    /// Reads multiple bits into a u32 value.
    ///
    /// # Arguments
    /// * `num_bits` - Number of bits to read (1-32)
    ///
    /// # Returns
    /// The bits read, stored in the LSB side of the u32.
    ///
    /// # Panics
    /// Panics if `num_bits` is 0 or greater than 32.
    ///
    /// # Example
    /// ```
    /// use polylab_compression::entropy::BitReader;
    ///
    /// let data = vec![0b10111100]; // 1011 + 11 + padding
    /// let mut reader = BitReader::new(&data);
    /// assert_eq!(reader.read_bits(4).unwrap(), 0b1011);
    /// assert_eq!(reader.read_bits(2).unwrap(), 0b11);
    /// ```
    pub fn read_bits(&mut self, num_bits: u8) -> io::Result<u32> {
        assert!(num_bits > 0 && num_bits <= 32, "num_bits must be between 1 and 32");

        let mut result = 0u32;
        for _ in 0..num_bits {
            let bit = self.read_bit()?;
            result = (result << 1) | (bit as u32);
        }

        Ok(result)
    }

    /// Returns the number of bits read so far.
    pub fn bits_read(&self) -> usize {
        self.byte_pos * 8 + self.bit_pos as usize
    }

    /// Returns the total number of bits available (including padding).
    pub fn total_bits(&self) -> usize {
        self.data.len() * 8
    }

    /// Returns true if all bits have been read.
    pub fn is_eof(&self) -> bool {
        self.byte_pos >= self.data.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_write_single_bit() {
        let mut writer = BitWriter::new(Vec::new());
        writer.write_bit(true).unwrap();
        writer.write_bit(false).unwrap();
        let data = writer.finish().unwrap();
        // 10000000 (padded with zeros)
        assert_eq!(data, vec![0b10000000]);
    }

    #[test]
    fn test_write_full_byte() {
        let mut writer = BitWriter::new(Vec::new());
        writer.write_bit(true).unwrap();
        writer.write_bit(false).unwrap();
        writer.write_bit(true).unwrap();
        writer.write_bit(false).unwrap();
        writer.write_bit(true).unwrap();
        writer.write_bit(true).unwrap();
        writer.write_bit(false).unwrap();
        writer.write_bit(false).unwrap();
        let data = writer.finish().unwrap();
        assert_eq!(data, vec![0b10101100]);
    }

    #[test]
    fn test_write_multiple_bytes() {
        let mut writer = BitWriter::new(Vec::new());
        // Write 10 bits: 1010101010
        for _ in 0..5 {
            writer.write_bit(true).unwrap();
            writer.write_bit(false).unwrap();
        }
        let data = writer.finish().unwrap();
        // Should be: 10101010 10000000 (second byte padded)
        assert_eq!(data, vec![0b10101010, 0b10000000]);
    }

    #[test]
    fn test_write_bits_small() {
        let mut writer = BitWriter::new(Vec::new());
        writer.write_bits(0b1011, 4).unwrap();
        let data = writer.finish().unwrap();
        // 10110000 (padded)
        assert_eq!(data, vec![0b10110000]);
    }

    #[test]
    fn test_write_bits_multiple() {
        let mut writer = BitWriter::new(Vec::new());
        writer.write_bits(0b1011, 4).unwrap();
        writer.write_bits(0b11, 2).unwrap();
        let data = writer.finish().unwrap();
        // 10111100 (1011 + 11 + padding)
        assert_eq!(data, vec![0b10111100]);
    }

    #[test]
    fn test_write_bits_cross_boundary() {
        let mut writer = BitWriter::new(Vec::new());
        writer.write_bits(0b11111111, 8).unwrap();
        writer.write_bits(0b101, 3).unwrap();
        let data = writer.finish().unwrap();
        // 11111111 10100000
        assert_eq!(data, vec![0b11111111, 0b10100000]);
    }

    #[test]
    fn test_write_bits_32() {
        let mut writer = BitWriter::new(Vec::new());
        writer.write_bits(0xABCD1234, 32).unwrap();
        let data = writer.finish().unwrap();
        assert_eq!(data, vec![0xAB, 0xCD, 0x12, 0x34]);
    }

    #[test]
    fn test_read_single_bit() {
        let data = vec![0b10000000];
        let mut reader = BitReader::new(&data);
        assert_eq!(reader.read_bit().unwrap(), true);
        assert_eq!(reader.read_bit().unwrap(), false);
    }

    #[test]
    fn test_read_full_byte() {
        let data = vec![0b10101100];
        let mut reader = BitReader::new(&data);
        assert_eq!(reader.read_bit().unwrap(), true);
        assert_eq!(reader.read_bit().unwrap(), false);
        assert_eq!(reader.read_bit().unwrap(), true);
        assert_eq!(reader.read_bit().unwrap(), false);
        assert_eq!(reader.read_bit().unwrap(), true);
        assert_eq!(reader.read_bit().unwrap(), true);
        assert_eq!(reader.read_bit().unwrap(), false);
        assert_eq!(reader.read_bit().unwrap(), false);
    }

    #[test]
    fn test_read_bits_small() {
        let data = vec![0b10110000];
        let mut reader = BitReader::new(&data);
        assert_eq!(reader.read_bits(4).unwrap(), 0b1011);
    }

    #[test]
    fn test_read_bits_multiple() {
        let data = vec![0b10111100];
        let mut reader = BitReader::new(&data);
        assert_eq!(reader.read_bits(4).unwrap(), 0b1011);
        assert_eq!(reader.read_bits(2).unwrap(), 0b11);
    }

    #[test]
    fn test_read_bits_cross_boundary() {
        let data = vec![0b11111111, 0b10100000];
        let mut reader = BitReader::new(&data);
        assert_eq!(reader.read_bits(8).unwrap(), 0b11111111);
        assert_eq!(reader.read_bits(3).unwrap(), 0b101);
    }

    #[test]
    fn test_read_bits_32() {
        let data = vec![0xAB, 0xCD, 0x12, 0x34];
        let mut reader = BitReader::new(&data);
        assert_eq!(reader.read_bits(32).unwrap(), 0xABCD1234);
    }

    #[test]
    fn test_roundtrip_bits() {
        let mut writer = BitWriter::new(Vec::new());
        writer.write_bit(true).unwrap();
        writer.write_bit(false).unwrap();
        writer.write_bits(0b101, 3).unwrap();
        writer.write_bits(0xFF, 8).unwrap();
        let data = writer.finish().unwrap();

        let mut reader = BitReader::new(&data);
        assert_eq!(reader.read_bit().unwrap(), true);
        assert_eq!(reader.read_bit().unwrap(), false);
        assert_eq!(reader.read_bits(3).unwrap(), 0b101);
        assert_eq!(reader.read_bits(8).unwrap(), 0xFF);
    }

    #[test]
    fn test_roundtrip_various_sizes() {
        let test_cases = vec![
            (0b1, 1),
            (0b101, 3),
            (0b1111, 4),
            (0xAB, 8),
            (0x1234, 16),
            (0xABCD1234, 32),
        ];

        for (value, num_bits) in test_cases {
            let mut writer = BitWriter::new(Vec::new());
            writer.write_bits(value, num_bits).unwrap();
            let data = writer.finish().unwrap();

            let mut reader = BitReader::new(&data);
            let read_value = reader.read_bits(num_bits).unwrap();
            assert_eq!(read_value, value, "Mismatch for {}-bit value 0x{:X}", num_bits, value);
        }
    }

    #[test]
    fn test_read_eof() {
        let data = vec![0b10000000];
        let mut reader = BitReader::new(&data);
        
        // Read all 8 bits
        for _ in 0..8 {
            reader.read_bit().unwrap();
        }

        // Next read should fail
        assert!(reader.read_bit().is_err());
    }

    #[test]
    fn test_bits_read_counter() {
        let data = vec![0b10111100, 0xFF];
        let mut reader = BitReader::new(&data);
        
        assert_eq!(reader.bits_read(), 0);
        reader.read_bit().unwrap();
        assert_eq!(reader.bits_read(), 1);
        reader.read_bits(7).unwrap();
        assert_eq!(reader.bits_read(), 8);
        reader.read_bits(5).unwrap();
        assert_eq!(reader.bits_read(), 13);
    }

    #[test]
    fn test_is_eof() {
        let data = vec![0xFF];
        let mut reader = BitReader::new(&data);
        
        assert!(!reader.is_eof());
        reader.read_bits(8).unwrap();
        assert!(reader.is_eof());
    }

    #[test]
    fn test_empty_data() {
        let data = vec![];
        let mut reader = BitReader::new(&data);
        assert!(reader.is_eof());
        assert!(reader.read_bit().is_err());
    }

    #[test]
    fn test_write_zero_padding() {
        let mut writer = BitWriter::new(Vec::new());
        writer.write_bit(true).unwrap();
        let data = writer.finish().unwrap();
        // Should be padded with zeros: 10000000
        assert_eq!(data, vec![0b10000000]);
        
        // When read back, we get the bit plus padding
        let mut reader = BitReader::new(&data);
        assert_eq!(reader.read_bit().unwrap(), true);
        for _ in 0..7 {
            assert_eq!(reader.read_bit().unwrap(), false);
        }
    }

    #[test]
    #[should_panic(expected = "num_bits must be between 1 and 32")]
    fn test_write_bits_zero() {
        let mut writer = BitWriter::new(Vec::new());
        writer.write_bits(0, 0).unwrap();
    }

    #[test]
    #[should_panic(expected = "num_bits must be between 1 and 32")]
    fn test_write_bits_too_many() {
        let mut writer = BitWriter::new(Vec::new());
        writer.write_bits(0, 33).unwrap();
    }

    #[test]
    #[should_panic(expected = "num_bits must be between 1 and 32")]
    fn test_read_bits_zero() {
        let data = vec![0xFF];
        let mut reader = BitReader::new(&data);
        reader.read_bits(0).unwrap();
    }

    #[test]
    #[should_panic(expected = "num_bits must be between 1 and 32")]
    fn test_read_bits_too_many() {
        let data = vec![0xFF, 0xFF, 0xFF, 0xFF, 0xFF];
        let mut reader = BitReader::new(&data);
        reader.read_bits(33).unwrap();
    }

    #[test]
    fn test_mixed_operations() {
        let mut writer = BitWriter::new(Vec::new());
        writer.write_bit(true).unwrap();
        writer.write_bits(0b110, 3).unwrap();
        writer.write_bit(false).unwrap();
        writer.write_bits(0xF, 4).unwrap();
        writer.write_bit(true).unwrap();
        let data = writer.finish().unwrap();

        let mut reader = BitReader::new(&data);
        assert_eq!(reader.read_bit().unwrap(), true);
        assert_eq!(reader.read_bits(3).unwrap(), 0b110);
        assert_eq!(reader.read_bit().unwrap(), false);
        assert_eq!(reader.read_bits(4).unwrap(), 0xF);
        assert_eq!(reader.read_bit().unwrap(), true);
    }
}
