/// <reference types="vite/client" />

// Type declarations for CSS module imports
declare module '*.css' {
  const content: string;
  export default content;
}

// Type declarations for WASM module
declare module '*.wasm' {
  const content: string;
  export default content;
}

// WebGPU API types (experimental)
interface Navigator {
  gpu?: GPU;
}

interface GPU {
  requestAdapter(options?: GPURequestAdapterOptions): Promise<GPUAdapter | null>;
}

interface GPURequestAdapterOptions {
  powerPreference?: 'low-power' | 'high-performance';
  forceFallbackAdapter?: boolean;
}

interface GPUAdapter {
  requestDevice(descriptor?: GPUDeviceDescriptor): Promise<GPUDevice>;
  features: GPUSupportedFeatures;
  limits: GPUSupportedLimits;
  info: GPUAdapterInfo;
}

interface GPUDeviceDescriptor {
  label?: string;
  requiredFeatures?: Iterable<GPUFeatureName>;
  requiredLimits?: Record<string, number>;
}

interface GPUDevice {}
interface GPUSupportedFeatures {}
interface GPUSupportedLimits {}
interface GPUAdapterInfo {}
type GPUFeatureName = string;

