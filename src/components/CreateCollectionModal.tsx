'use client';

import React, { useState } from 'react';
import { X, Plus, FileText } from 'lucide-react';
import { Dataset } from '@/data/mockDatasets';
import { Button } from './ui/Button';

interface CreateCollectionModalProps {
  isVisible: boolean;
  onClose: () => void;
  onCreateCollection: (name: string) => void;
  selectedDatasets: string[];
  datasets: Dataset[];
}

export default function CreateCollectionModal({
  isVisible,
  onClose,
  onCreateCollection,
  selectedDatasets,
  datasets
}: CreateCollectionModalProps) {
  const [collectionName, setCollectionName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const selectedDatasetObjects = datasets.filter(dataset => 
    selectedDatasets.includes(dataset.id)
  );

  const handleCreate = async () => {
    if (!collectionName.trim()) return;
    
    setIsCreating(true);
    try {
      onCreateCollection(collectionName.trim());
      setCollectionName('');
      onClose();
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setCollectionName('');
    onClose();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleCreate();
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-gray-900/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-md shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-H2-20-semibold text-gray-900">Create New Collection</h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-md transition-colors"
          >
            <X className="w-5 h-5 text-icon" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6">
          {/* Collection Name Input */}
          <div className="mb-6">
            <label htmlFor="collection-name" className="block text-body-16-medium text-gray-700 mb-2">
              Collection Name
            </label>
            <input
              id="collection-name"
              type="text"
              value={collectionName}
              onChange={(e) => setCollectionName(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter collection name..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500"
              autoFocus
            />
          </div>

          {/* Selected Datasets Preview */}
          <div className="mb-6">
            <h3 className="text-body-16-medium text-gray-700 mb-3">
              Selected Datasets ({selectedDatasets.length})
            </h3>
            <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-md">
              {selectedDatasetObjects.map((dataset) => (
                <div key={dataset.id} className="flex items-center gap-3 p-3 border-b border-gray-100 last:border-b-0">
                  <FileText className="w-4 h-4 text-icon flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-body-16-medium text-gray-900 truncate">
                      {dataset.title}
                    </p>
                    <p className="text-descriptions-12-regular text-gray-500">
                      {dataset.category} • {dataset.size}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={handleCreate}
            disabled={!collectionName.trim() || isCreating}
          >
            <Plus className="w-4 h-4 mr-2 text-icon" />
            {isCreating ? 'Creating...' : 'Create Collection'}
          </Button>
        </div>
      </div>
    </div>
  );
} 