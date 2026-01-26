/**
 * Node Registry
 * 
 * Central registry for all node types in the system.
 * Nodes are registered here and can be instantiated, discovered, and managed.
 */

import { NodeType, NodeCategory, NodeMetadata } from './NodeTypes';

type NodeFactory = (id: string, config?: any) => any;
type NodeComponent = React.ComponentType<any>;

interface NodeRegistration {
  metadata: NodeMetadata;
  factory: NodeFactory;
  component: NodeComponent;
}

class NodeRegistry {
  private static instance: NodeRegistry;
  private nodes: Map<NodeType, NodeRegistration> = new Map();
  private nodesByCategory: Map<NodeCategory, NodeType[]> = new Map();

  private constructor() {
    // Initialize category maps
    const categories: NodeCategory[] = [
      'device-management',
      'flashing',
      'security',
      'monitoring',
      'firmware',
      'workflows',
      'trapdoor',
      'utility'
    ];
    categories.forEach(cat => this.nodesByCategory.set(cat, []));
  }

  static getInstance(): NodeRegistry {
    if (!NodeRegistry.instance) {
      NodeRegistry.instance = new NodeRegistry();
    }
    return NodeRegistry.instance;
  }

  /**
   * Register a node type
   */
  register(
    metadata: NodeMetadata,
    factory: NodeFactory,
    component: NodeComponent
  ): void {
    if (this.nodes.has(metadata.type)) {
      console.warn(`Node type ${metadata.type} is already registered. Overwriting...`);
    }

    this.nodes.set(metadata.type, {
      metadata,
      factory,
      component
    });

    // Update category index
    const categoryNodes = this.nodesByCategory.get(metadata.category) || [];
    if (!categoryNodes.includes(metadata.type)) {
      categoryNodes.push(metadata.type);
      this.nodesByCategory.set(metadata.category, categoryNodes);
    }
  }

  /**
   * Get node metadata
   */
  getMetadata(type: NodeType): NodeMetadata | undefined {
    return this.nodes.get(type)?.metadata;
  }

  /**
   * Get node factory
   */
  getFactory(type: NodeType): NodeFactory | undefined {
    return this.nodes.get(type)?.factory;
  }

  /**
   * Get node component
   */
  getComponent(type: NodeType): NodeComponent | undefined {
    return this.nodes.get(type)?.component;
  }

  /**
   * Get all registered node types
   */
  getAllTypes(): NodeType[] {
    return Array.from(this.nodes.keys());
  }

  /**
   * Get all node metadata
   */
  getAllMetadata(): NodeMetadata[] {
    return Array.from(this.nodes.values()).map(reg => reg.metadata);
  }

  /**
   * Get nodes by category
   */
  getByCategory(category: NodeCategory): NodeMetadata[] {
    const types = this.nodesByCategory.get(category) || [];
    return types
      .map(type => this.nodes.get(type)?.metadata)
      .filter((meta): meta is NodeMetadata => meta !== undefined);
  }

  /**
   * Check if node type is registered
   */
  has(type: NodeType): boolean {
    return this.nodes.has(type);
  }

  /**
   * Create a new node instance
   */
  createNode(type: NodeType, id: string, config?: any): any {
    const factory = this.getFactory(type);
    if (!factory) {
      throw new Error(`Node type ${type} is not registered`);
    }
    return factory(id, config);
  }

  /**
   * Get node component for rendering
   */
  getNodeComponent(type: NodeType): NodeComponent {
    const component = this.getComponent(type);
    if (!component) {
      throw new Error(`Node component for type ${type} is not registered`);
    }
    return component;
  }
}

export const nodeRegistry = NodeRegistry.getInstance();
export default nodeRegistry;
