'use client';

import React, { useState } from 'react';
import { X, Plus, Folder } from 'lucide-react';
import { Dataset } from '@/data/mockDatasets';
import { useCollections } from '@/contexts/CollectionsContext';
import { Button } from './ui/Button';

interface AddToCollectionModalProps {
  isVisible: boolean;
  onClose: () => void;
  dataset: Dataset | null;
}

export default function AddToCollectionModal({
  isVisible,
  onClose,
  dataset
}: AddToCollectionModalProps) {
  const { collections, updateCollection } = useCollections();
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('');

  // Filter to only show custom collections (not built-in ones)
  const customCollections = collections.filter(collection => collection.id);

  const handleAddToCollection = () => {
    if (!dataset || !selectedCollectionId) return;

    const targetCollection = customCollections.find(c => c.id === selectedCollectionId);
    if (!targetCollection) return;

    // Check if dataset is already in the collection
    if (targetCollection.datasetIds.includes(dataset.id)) {
      alert(`"${dataset.title}" is already in the "${targetCollection.name}" collection.`);
      return;
    }

    // Add dataset to the collection
    updateCollection(selectedCollectionId, {
      datasetIds: [...targetCollection.datasetIds, dataset.id]
    });

    alert(`"${dataset.title}" has been added to "${targetCollection.name}" collection!`);
    onClose();
  };

  const handleClose = () => {
    setSelectedCollectionId('');
    onClose();
  };

  if (!isVisible || !dataset) return null;

  return (
    <div className="fixed inset-0 bg-gray-900/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-md shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-H2-20-semibold text-gray-900">Add to Collection</h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-md transition-colors"
          >
            <X className="w-5 h-5 text-icon" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6">
          {/* Dataset Info */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-body-16-semibold text-gray-900 mb-1">{dataset.title}</h3>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-descriptions-12-semibold bg-blue-100 text-blue-800">
                {dataset.category}
              </span>
              <span className="text-descriptions-12-regular text-gray-500">{dataset.size}</span>
            </div>
          </div>

          {/* Collection Selection */}
          <div className="mb-6">
            <h3 className="text-body-16-medium text-gray-700 mb-3">
              Select Collection
            </h3>
            
            {customCollections.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Folder className="w-8 h-8 mx-auto mb-2 text-icon" />
                <p className="text-descriptions-12-regular">No custom collections found.</p>
                <p className="text-descriptions-12-regular mt-1">Create a collection first to add datasets.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {customCollections.map((collection) => (
                  <label
                    key={collection.id}
                    className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedCollectionId === collection.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="collection"
                      value={collection.id}
                      checked={selectedCollectionId === collection.id}
                      onChange={(e) => setSelectedCollectionId(e.target.value)}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <div className="ml-3 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-body-16-medium">{collection.icon || '📁'}</span>
                        <span className="text-body-16-semibold text-gray-900">{collection.name}</span>
                      </div>
                      <p className="text-descriptions-12-regular text-gray-500 mt-1">
                        {collection.datasetIds.length} dataset{collection.datasetIds.length !== 1 ? 's' : ''} • 
                        Created {collection.createdAt.toLocaleDateString()}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={handleAddToCollection}
            disabled={!selectedCollectionId || customCollections.length === 0}
          >
            <Plus className="w-4 h-4 mr-2 text-icon" />
            Add to Collection
          </Button>
        </div>
      </div>
    </div>
  );
} 