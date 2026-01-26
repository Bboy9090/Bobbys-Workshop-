/**
 * Node Palette
 * 
 * Sidebar showing all available node types that can be added to the workspace.
 */

import React, { useState } from 'react';
import { nodeRegistry } from '@/nodes/core/NodeRegistry';
import { NodeCategory } from '@/nodes/core/NodeTypes';
import { cn } from '@/lib/utils';
import { Search } from 'lucide-react';

export interface NodePaletteProps {
  onAddNode?: (nodeType: string) => void;
  className?: string;
}

const categoryLabels: Record<NodeCategory, string> = {
  'device-management': 'Device Management',
  'flashing': 'Flashing',
  'security': 'Security',
  'monitoring': 'Monitoring',
  'firmware': 'Firmware',
  'workflows': 'Workflows',
  'trapdoor': 'Trapdoor',
  'utility': 'Utility'
};

export function NodePalette({ onAddNode, className }: NodePaletteProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<NodeCategory | 'all'>('all');

  const allMetadata = nodeRegistry.getAllMetadata();
  const categories: NodeCategory[] = ['device-management', 'flashing', 'security', 'monitoring', 'firmware', 'workflows', 'trapdoor', 'utility'];

  const filteredNodes = allMetadata.filter(meta => {
    const matchesSearch = !searchQuery || 
      meta.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      meta.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || meta.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleAddNode = (nodeType: string) => {
    onAddNode?.(nodeType);
  };

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="p-4 border-b border-secrets-border">
        <h2 className="text-lg font-semibold text-ink-primary mb-3">Node Palette</h2>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
          <input
            type="text"
            placeholder="Search nodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 bg-secrets-bg border border-secrets-border rounded-lg text-ink-primary text-sm focus:outline-none focus:border-trap-cyan"
          />
        </div>
      </div>

      {/* Categories */}
      <div className="flex gap-2 p-4 border-b border-secrets-border overflow-x-auto">
        <button
          onClick={() => setSelectedCategory('all')}
          className={cn(
            'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors',
            selectedCategory === 'all'
              ? 'bg-trap-cyan/20 text-trap-cyan border border-trap-cyan/50'
              : 'bg-secrets-bg text-ink-secondary hover:text-ink-primary border border-secrets-border'
          )}
        >
          All
        </button>
        {categories.map(category => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors',
              selectedCategory === category
                ? 'bg-trap-cyan/20 text-trap-cyan border border-trap-cyan/50'
                : 'bg-secrets-bg text-ink-secondary hover:text-ink-primary border border-secrets-border'
            )}
          >
            {categoryLabels[category]}
          </button>
        ))}
      </div>

      {/* Node List */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredNodes.length === 0 ? (
          <div className="text-center text-ink-muted text-sm py-8">
            No nodes found
          </div>
        ) : (
          <div className="space-y-2">
            {filteredNodes.map(meta => (
              <button
                key={meta.type}
                onClick={() => handleAddNode(meta.type)}
                className={cn(
                  'w-full p-3 rounded-lg border text-left transition-all',
                  'bg-secrets-surface border-secrets-border',
                  'hover:border-trap-cyan hover:bg-secrets-surface/80',
                  meta.trapdoor && 'border-secret-purple/50'
                )}
              >
                <div className="flex items-start gap-3">
                  {meta.icon && (
                    <div className="flex-shrink-0 text-trap-cyan text-lg">
                      {meta.icon}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-ink-primary text-sm mb-1">
                      {meta.name}
                    </div>
                    {meta.description && (
                      <div className="text-xs text-ink-muted line-clamp-2">
                        {meta.description}
                      </div>
                    )}
                    {meta.trapdoor && (
                      <div className="mt-1 text-xs text-secret-purple">
                        🔒 Trapdoor Node
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
