/**
 * Operation Catalog Browser Component
 * 
 * Browse and search available operations with filters
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Search, Filter, Shield, Zap, Activity } from 'lucide-react';

interface Operation {
  id: string;
  displayName: string;
  description: string;
  category: string;
  riskLevel: string;
  requiresConfirmation: boolean;
  requiredCapabilities: string[];
}

export const OperationCatalogBrowser: React.FC<{
  onSelectOperation?: (operation: Operation) => void;
}> = ({ onSelectOperation }) => {
  const [operations, setOperations] = useState<Operation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterRisk, setFilterRisk] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadOperations();
  }, []);

  const loadOperations = async () => {
    try {
      const passcode = localStorage.getItem('trapdoor-passcode') || '';
      const response = await fetch('/api/v1/trapdoor/operations', {
        headers: {
          'X-Secret-Room-Passcode': passcode
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.data && data.data.operations) {
          setOperations(data.data.operations);
        }
      }
    } catch (error) {
      console.error('Failed to load operations:', error);
    }
  };

  const filteredOperations = operations.filter(op => {
    const matchesSearch = op.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         op.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         op.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === 'all' || op.category === filterCategory;
    const matchesRisk = filterRisk === 'all' || op.riskLevel === filterRisk;
    return matchesSearch && matchesCategory && matchesRisk;
  });

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'bg-green-500/20 text-green-400 border-green-500/50';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      case 'high': return 'bg-orange-500/20 text-orange-400 border-orange-500/50';
      case 'destructive': return 'bg-red-500/20 text-red-400 border-red-500/50';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/50';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'diagnostics': return Activity;
      case 'destructive': return Zap;
      default: return Shield;
    }
  };

  const categories = Array.from(new Set(operations.map(op => op.category)));
  const riskLevels = ['low', 'medium', 'high', 'destructive'];

  return (
    <Card className="bg-[#141922] border-[#2FD3FF]/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-white">Operation Catalog</CardTitle>
            <CardDescription className="text-gray-400">
              Browse {operations.length} available operations
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="border-[#2FD3FF]/50"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search operations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-[#0B0F14] border-[#2FD3FF]/50"
          />
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="grid grid-cols-2 gap-4 p-4 bg-[#0B0F14] rounded">
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Category</label>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full bg-[#141922] border border-[#2FD3FF]/50 rounded p-2 text-white text-sm"
              >
                <option value="all">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Risk Level</label>
              <select
                value={filterRisk}
                onChange={(e) => setFilterRisk(e.target.value)}
                className="w-full bg-[#141922] border border-[#2FD3FF]/50 rounded p-2 text-white text-sm"
              >
                <option value="all">All Risk Levels</option>
                {riskLevels.map(risk => (
                  <option key={risk} value={risk}>{risk}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Operations Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
          {filteredOperations.length === 0 ? (
            <div className="col-span-2 text-center py-12">
              <p className="text-gray-400">No operations found</p>
            </div>
          ) : (
            filteredOperations.map((op) => {
              const CategoryIcon = getCategoryIcon(op.category);
              return (
                <div
                  key={op.id}
                  onClick={() => onSelectOperation?.(op)}
                  className="p-4 bg-[#0B0F14] rounded border border-[#2FD3FF]/20 hover:border-[#2FD3FF]/50 cursor-pointer transition-all"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <CategoryIcon className="h-4 w-4 text-[#2FD3FF]" />
                      <h4 className="text-white font-semibold text-sm">{op.displayName}</h4>
                    </div>
                    <Badge className={getRiskColor(op.riskLevel)}>
                      {op.riskLevel}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-400 mb-2">{op.description}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-500">{op.category}</span>
                    {op.requiredCapabilities && op.requiredCapabilities.length > 0 && (
                      <>
                        <span className="text-xs text-gray-500">•</span>
                        <span className="text-xs text-gray-500">
                          {op.requiredCapabilities.join(', ')}
                        </span>
                      </>
                    )}
                  </div>
                  {op.requiresConfirmation && (
                    <div className="mt-2">
                      <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/50 text-xs">
                        <Shield className="h-3 w-3 mr-1" />
                        Confirmation Required
                      </Badge>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
};
