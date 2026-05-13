//! WebGPU initialization and context management
//!
//! This module handles the low-level WebGPU setup: Instance, Adapter, Device, Surface.
//! Separates initialization logic from rendering logic.

use wgpu;
use crate::constants;

/// WebGPU context - encapsulates all GPU resources needed for rendering
///
/// Holds the Device (logical GPU), Queue (command submission), Surface (render target),
/// and configuration. Created once at startup, reused for all frames.
pub struct WebGpuContext {
    /// Logical device - interface to the GPU
    pub device: wgpu::Device,
    
    /// Command queue - submits work to GPU
    pub queue: wgpu::Queue,
    
    /// Surface - render target (canvas in WASM, window in native)
    pub surface: wgpu::Surface<'static>,
    
    /// Surface configuration (format, size, present mode)
    pub config: wgpu::SurfaceConfiguration,
    
    /// Current canvas/window dimensions
    pub size: (u32, u32),
}

impl WebGpuContext {
    /// Initialize WebGPU context from a canvas element (WASM only)
    ///
    /// Creates Instance → Adapter → Device → Surface → Config
    /// This is the heavy lifting that happens once at startup.
    pub async fn new(canvas: web_sys::HtmlCanvasElement) -> Result<Self, String> {
        let width = canvas.width();
        let height = canvas.height();

        // Instance: entry point for WebGPU - creates adapters and surfaces
        let mut instance_desc = wgpu::InstanceDescriptor::new_without_display_handle();
        instance_desc.backends = wgpu::Backends::BROWSER_WEBGPU;
        let instance = wgpu::Instance::new(instance_desc);

        // Surface: render target tied to the canvas
        let surface = instance
            .create_surface(wgpu::SurfaceTarget::Canvas(canvas))
            .map_err(|e| format!("Failed to create surface: {:?}", e))?;

        // Adapter: represents a physical GPU (or emulated GPU)
        let adapter = instance
            .request_adapter(&wgpu::RequestAdapterOptions {
                power_preference: wgpu::PowerPreference::default(),
                compatible_surface: Some(&surface),
                force_fallback_adapter: false,
            })
            .await
            .map_err(|e| format!("Failed to find adapter: {:?}", e))?;

        // Device + Queue: logical interface to GPU + command submission
        let (device, queue) = adapter
            .request_device(&wgpu::DeviceDescriptor {
                label: Some("Main Device"),
                required_features: wgpu::Features::empty(),
                required_limits: wgpu::Limits::default(),
                ..Default::default()
            })
            .await
            .map_err(|e| format!("Failed to create device: {:?}", e))?;

        // Configure surface format and present mode
        let surface_caps = surface.get_capabilities(&adapter);
        let surface_format = surface_caps
            .formats
            .iter()
            .copied()
            .find(|f| f.is_srgb())
            .unwrap_or(surface_caps.formats[0]);

        let config = wgpu::SurfaceConfiguration {
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
            format: surface_format,
            width,
            height,
            present_mode: surface_caps.present_modes[0],
            alpha_mode: surface_caps.alpha_modes[0],
            view_formats: vec![],
            desired_maximum_frame_latency: constants::FRAME_LATENCY,
        };
        surface.configure(&device, &config);

        Ok(Self {
            device,
            queue,
            surface,
            config,
            size: (width, height),
        })
    }

    /// Resize the surface (e.g., when browser window changes)
    pub fn resize(&mut self, new_width: u32, new_height: u32) {
        if new_width > 0 && new_height > 0 {
            self.size = (new_width, new_height);
            self.config.width = new_width;
            self.config.height = new_height;
            self.surface.configure(&self.device, &self.config);
        }
    }
}
