/**
 * TreeView Component
 * 
 * Generic tree view component for displaying hierarchical data
 */

import type { SceneNode } from '../types/scene.types';

export class TreeView {
    element: HTMLElement;
    private rootNode: SceneNode | null = null;
    private onNodeClick: ((node: SceneNode) => void) | null = null;
    private onNodeToggleVisible: ((nodeId: string, visible: boolean) => void) | null = null;
    private selectedNodeId: string | null = null;

    constructor() {
        this.element = this.createElement();
    }

    private createElement(): HTMLElement {
        const container = document.createElement('div');
        container.className = 'tree-view';
        return container;
    }

    /**
     * Set the root node of the tree
     */
    setRoot(node: SceneNode): void {
        this.rootNode = node;
        this.render();
    }

    /**
     * Set callback for node click events
     */
    setOnNodeClick(callback: (node: SceneNode) => void): void {
        this.onNodeClick = callback;
    }

    /**
     * Set callback for node visibility toggle
     */
    setOnNodeToggleVisible(callback: (nodeId: string, visible: boolean) => void): void {
        this.onNodeToggleVisible = callback;
    }

    /**
     * Update a node in the tree
     */
    updateNode(nodeId: string, updates: Partial<SceneNode>): void {
        if (!this.rootNode) return;
        
        const node = this.findNode(this.rootNode, nodeId);
        if (node) {
            Object.assign(node, updates);
            this.render();
        }
    }

    /**
     * Add a child node to a parent
     */
    addNode(parentId: string, childNode: SceneNode): void {
        if (!this.rootNode) return;
        
        const parent = this.findNode(this.rootNode, parentId);
        if (parent) {
            if (!parent.children) {
                parent.children = [];
            }
            parent.children.push(childNode);
            this.render();
        }
    }

    /**
     * Remove a node from the tree
     */
    removeNode(nodeId: string): void {
        if (!this.rootNode) return;
        
        this.removeNodeRecursive(this.rootNode, nodeId);
        this.render();
    }

    /**
     * Find a node by ID
     */
    private findNode(root: SceneNode, nodeId: string): SceneNode | null {
        if (root.id === nodeId) return root;
        
        if (root.children) {
            for (const child of root.children) {
                const found = this.findNode(child, nodeId);
                if (found) return found;
            }
        }
        
        return null;
    }

    /**
     * Remove a node recursively
     */
    private removeNodeRecursive(parent: SceneNode, nodeId: string): boolean {
        if (!parent.children) return false;
        
        const index = parent.children.findIndex(child => child.id === nodeId);
        if (index !== -1) {
            parent.children.splice(index, 1);
            return true;
        }
        
        for (const child of parent.children) {
            if (this.removeNodeRecursive(child, nodeId)) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Render the tree
     */
    render(): void {
        this.element.innerHTML = '';
        
        if (!this.rootNode) {
            this.element.innerHTML = '<div class="tree-empty">No scene data</div>';
            return;
        }
        
        const rootElement = this.renderNode(this.rootNode, 0);
        this.element.appendChild(rootElement);
    }

    /**
     * Render a single node and its children
     */
    private renderNode(node: SceneNode, depth: number): HTMLElement {
        const nodeElement = document.createElement('div');
        nodeElement.className = 'tree-node';
        nodeElement.dataset.nodeId = node.id;
        nodeElement.dataset.nodeType = node.type;
        
        // Node header (the clickable line)
        const headerElement = document.createElement('div');
        headerElement.className = 'tree-node-header';
        headerElement.style.paddingLeft = `${depth * 16}px`;
        
        if (this.selectedNodeId === node.id) {
            headerElement.classList.add('selected');
        }
        
        // Expand/collapse button (for folders with children)
        if (node.type === 'folder' || node.type === 'root') {
            const expandButton = document.createElement('button');
            expandButton.className = 'tree-node-expand';
            expandButton.textContent = node.expanded ? '▼' : '▶';
            expandButton.title = node.expanded ? 'Collapse' : 'Expand';
            expandButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleExpand(node.id);
            });
            headerElement.appendChild(expandButton);
        } else {
            // Spacer for alignment
            const spacer = document.createElement('span');
            spacer.className = 'tree-node-spacer';
            spacer.textContent = '  ';
            headerElement.appendChild(spacer);
        }
        
        // Icon
        const iconElement = document.createElement('span');
        iconElement.className = 'tree-node-icon';
        iconElement.textContent = node.icon;
        headerElement.appendChild(iconElement);
        
        // Name
        const nameElement = document.createElement('span');
        nameElement.className = 'tree-node-name';
        nameElement.textContent = node.name;
        headerElement.appendChild(nameElement);
        
        // Visibility toggle (for meshes)
        if (node.type === 'mesh' && node.visible !== undefined) {
            const visibilityButton = document.createElement('button');
            visibilityButton.className = 'tree-node-visibility';
            visibilityButton.textContent = node.visible ? '👁️' : '⚫';
            visibilityButton.title = node.visible ? 'Hide' : 'Show';
            visibilityButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleVisibility(node.id, !node.visible);
            });
            headerElement.appendChild(visibilityButton);
        }
        
        // Click handler for selection
        headerElement.addEventListener('click', () => {
            this.selectNode(node.id);
            if (this.onNodeClick) {
                this.onNodeClick(node);
            }
        });
        
        nodeElement.appendChild(headerElement);
        
        // Children (if expanded)
        if ((node.expanded || node.type === 'root') && node.children && node.children.length > 0) {
            const childrenContainer = document.createElement('div');
            childrenContainer.className = 'tree-node-children';
            
            for (const child of node.children) {
                const childElement = this.renderNode(child, depth + 1);
                childrenContainer.appendChild(childElement);
            }
            
            nodeElement.appendChild(childrenContainer);
        }
        
        return nodeElement;
    }

    /**
     * Toggle node expansion
     */
    private toggleExpand(nodeId: string): void {
        if (!this.rootNode) return;
        
        const node = this.findNode(this.rootNode, nodeId);
        if (node) {
            node.expanded = !node.expanded;
            this.render();
        }
    }

    /**
     * Toggle node visibility
     */
    private toggleVisibility(nodeId: string, visible: boolean): void {
        if (!this.rootNode) return;
        
        const node = this.findNode(this.rootNode, nodeId);
        if (node) {
            node.visible = visible;
            this.render();
            
            if (this.onNodeToggleVisible) {
                this.onNodeToggleVisible(nodeId, visible);
            }
        }
    }

    /**
     * Select a node
     */
    private selectNode(nodeId: string): void {
        this.selectedNodeId = nodeId;
        this.render();
    }

    /**
     * Get currently selected node
     */
    getSelectedNode(): SceneNode | null {
        if (!this.rootNode || !this.selectedNodeId) return null;
        return this.findNode(this.rootNode, this.selectedNodeId);
    }

    destroy(): void {
        this.element.remove();
    }
}
