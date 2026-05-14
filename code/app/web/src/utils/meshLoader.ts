/**
 * Mesh loading utilities
 * 
 * Handles file picker, drag & drop, and mesh loading from .obj files.
 */

/**
 * Callback type for mesh loading events
 */
export type MeshLoadCallback = (objContent: string, filename: string) => Promise<void>;

/**
 * Callback type for loading errors
 */
export type ErrorCallback = (error: string) => void;

/**
 * Create a hidden file input element for mesh loading
 * 
 * @param onLoad - Callback when file is loaded successfully
 * @param onError - Callback when loading fails
 * @returns The hidden file input element
 */
export function createFileInput(
    onLoad: MeshLoadCallback,
    onError: ErrorCallback
): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.obj';
    input.style.display = 'none';

    input.addEventListener('change', async (e) => {
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0];

        if (!file) {
            return;
        }

        try {
            await loadMeshFromFile(file, onLoad, onError);
        } finally {
            // Reset input so the same file can be loaded again
            input.value = '';
        }
    });

    return input;
}

/**
 * Load mesh from a File object
 * 
 * @param file - File object to load
 * @param onLoad - Callback when file is loaded successfully
 * @param onError - Callback when loading fails
 */
export async function loadMeshFromFile(
    file: File,
    onLoad: MeshLoadCallback,
    onError: ErrorCallback
): Promise<void> {
    // Validate file extension
    if (!file.name.toLowerCase().endsWith('.obj')) {
        onError(`Invalid file type: ${file.name}. Only .obj files are supported.`);
        return;
    }

    // Validate file size (max 50 MB)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
        onError(`File too large: ${(file.size / 1024 / 1024).toFixed(2)} MB. Maximum size is 50 MB.`);
        return;
    }

    try {
        const content = await readFileAsText(file);
        await onLoad(content, file.name);
    } catch (error) {
        onError(`Failed to read file: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Read a file as text using FileReader
 * 
 * @param file - File to read
 * @returns Promise that resolves with file content
 */
function readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            const content = e.target?.result;
            if (typeof content === 'string') {
                resolve(content);
            } else {
                reject(new Error('Failed to read file as text'));
            }
        };

        reader.onerror = () => {
            reject(new Error('FileReader error'));
        };

        reader.readAsText(file);
    });
}

/**
 * Setup drag and drop for a drop zone element
 * 
 * @param dropZone - Element to setup as drop zone
 * @param onLoad - Callback when file is dropped and loaded
 * @param onError - Callback when loading fails
 */
export function setupDropZone(
    dropZone: HTMLElement,
    onLoad: MeshLoadCallback,
    onError: ErrorCallback
): void {
    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
    });

    // Visual feedback on drag
    dropZone.addEventListener('dragenter', () => {
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', (e) => {
        // Only remove class if leaving the drop zone entirely
        if (e.target === dropZone) {
            dropZone.classList.remove('drag-over');
        }
    });

    // Handle drop
    dropZone.addEventListener('drop', async (e) => {
        dropZone.classList.remove('drag-over');

        const files = (e as DragEvent).dataTransfer?.files;
        if (!files || files.length === 0) {
            return;
        }

        const file = files[0];
        await loadMeshFromFile(file, onLoad, onError);
    });
}
