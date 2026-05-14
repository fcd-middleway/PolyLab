//! PolyLab Desktop Application
//!
//! Native desktop viewer using winit for windowing and wgpu for rendering.

use pollster;
use std::sync::Arc;
use winit::{
    application::ApplicationHandler,
    event::WindowEvent,
    event_loop::{ActiveEventLoop, ControlFlow, EventLoop},
    window::{Window, WindowId},
};

/// Application state - holds viewer and window
struct App {
    window: Option<Arc<Window>>,
    viewer: Option<AppViewer>,
}

/// Viewer wrapper - holds renderer and pipeline
struct AppViewer {
    renderer: polylab_viewer::Renderer,
    pipeline: wgpu::RenderPipeline,
}

impl ApplicationHandler for App {
    /// Called when app is ready to create window
    fn resumed(&mut self, event_loop: &ActiveEventLoop) {
        if self.window.is_none() {
            // Create window
            let window_attrs = Window::default_attributes()
                .with_title("PolyLab - Desktop Viewer")
                .with_inner_size(winit::dpi::LogicalSize::new(800, 600));

            match event_loop.create_window(window_attrs) {
                Ok(window) => {
                    let window = Arc::new(window);
                    
                    // Initialize viewer (blocking async with pollster)
                    log::info!("Initializing WebGPU renderer...");
                    match pollster::block_on(Self::create_viewer(window.clone())) {
                        Ok(viewer) => {
                            log::info!("Renderer initialized successfully!");
                            self.viewer = Some(viewer);
                            self.window = Some(window);
                            
                            // Request initial redraw
                            if let Some(window) = &self.window {
                                window.request_redraw();
                            }
                        }
                        Err(e) => {
                            log::error!("Failed to initialize renderer: {}", e);
                            event_loop.exit();
                        }
                    }
                }
                Err(e) => {
                    log::error!("Failed to create window: {}", e);
                    event_loop.exit();
                }
            }
        }
    }

    /// Handle window events
    fn window_event(&mut self, event_loop: &ActiveEventLoop, _id: WindowId, event: WindowEvent) {
        match event {
            WindowEvent::CloseRequested => {
                log::info!("Close requested - exiting");
                event_loop.exit();
            }
            
            WindowEvent::RedrawRequested => {
                // Render frame
                if let Some(viewer) = &self.viewer {
                    match viewer.renderer.render(&viewer.pipeline) {
                        Ok(_) => {
                            // Request next frame
                            if let Some(window) = &self.window {
                                window.request_redraw();
                            }
                        }
                        Err(e) => {
                            log::error!("Render error: {}", e);
                        }
                    }
                }
            }
            
            WindowEvent::Resized(new_size) => {
                // Handle resize
                if let Some(viewer) = &mut self.viewer {
                    viewer.renderer.resize(new_size.width, new_size.height);
                    if let Some(window) = &self.window {
                        window.request_redraw();
                    }
                }
            }
            
            _ => {}
        }
    }
}

impl App {
    /// Create viewer from window (async)
    async fn create_viewer(window: Arc<Window>) -> Result<AppViewer, String> {
        // Create renderer using native backend
        let renderer = polylab_viewer::Renderer::new_native(window).await?;

        // Create render pipeline with bind group layout
        let bind_group_layout = renderer.bind_group_layout();
        let pipeline = polylab_viewer::create_render_pipeline(
            renderer.device(),
            renderer.surface_format(),
            &bind_group_layout,
        );

        Ok(AppViewer { renderer, pipeline })
    }
}

fn main() {
    // Initialize logger
    env_logger::Builder::from_default_env()
        .filter_level(log::LevelFilter::Info)
        .init();

    log::info!("Starting PolyLab Desktop Viewer");

    // Create event loop
    let event_loop = EventLoop::new().expect("Failed to create event loop");
    event_loop.set_control_flow(ControlFlow::Poll);

    // Create app
    let mut app = App {
        window: None,
        viewer: None,
    };

    // Run event loop
    event_loop.run_app(&mut app).expect("Event loop error");
}
