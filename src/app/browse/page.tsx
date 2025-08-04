'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import Browse from '@/components/Browse';
import CreateCollectionModal from '@/components/CreateCollectionModal';
import { mockDatasets } from '@/data/mockDatasets';
import { useCollections } from '@/contexts/CollectionsContext';
import { getNavigationUrl } from '@/lib/utils';

export default function BrowsePage() {
  const [selectedDatasets, setSelectedDatasets] = useState<string[]>([]);
  const [showSelectedPanel, setShowSelectedPanel] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [showCreateCollectionModal, setShowCreateCollectionModal] = useState(false);
  const router = useRouter();
  const { addCollection } = useCollections();

  // Set mounted to true after first render (client-side only)
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Load selected datasets from localStorage only after component mounts
  useEffect(() => {
    if (isMounted) {
      const stored = localStorage.getItem('chatSelectedDatasets');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setSelectedDatasets(parsed);
          }
        } catch (error) {
          console.error('Error loading selected datasets:', error);
        }
      }
    }
  }, [isMounted]);

  // Save selected datasets to localStorage whenever they change (only when mounted)
  useEffect(() => {
    if (isMounted) {
      localStorage.setItem('chatSelectedDatasets', JSON.stringify(selectedDatasets));
    }
  }, [selectedDatasets, isMounted]);

  const handleChatWithData = () => {
    // Navigate to chat page with selected datasets
    router.push(getNavigationUrl('/chat'));
  };

  const handleCloseSidebar = () => {
    setShowSelectedPanel(false);
  };

  const handleReopenSidebar = () => {
    setShowSelectedPanel(true);
  };

  const handleAddToCollection = () => {
    if (selectedDatasets.length === 0) {
      alert('Please select some datasets first');
      return;
    }
    setShowCreateCollectionModal(true);
  };

  const handleCreateCollection = (name: string) => {
    addCollection(name, selectedDatasets);
    // Show success message
    alert(`Collection "${name}" created successfully with ${selectedDatasets.length} datasets!`);
  };

  return (
    <DashboardLayout>
      <div className="relative p-6">
        <Browse 
          datasets={mockDatasets}
          title="Browse All Datasets"
          subtitle="List of all datasets"
          showSelectAll={true}
          selectedDatasets={selectedDatasets}
          onSelectedDatasetsChange={setSelectedDatasets}
          showSelectedPanel={showSelectedPanel}
          onCloseSidebar={handleCloseSidebar}
          onReopenSidebar={handleReopenSidebar}
          onChatWithData={handleChatWithData}
          onAddToCollection={handleAddToCollection}
        />
        
        <CreateCollectionModal
          isVisible={showCreateCollectionModal}
          onClose={() => setShowCreateCollectionModal(false)}
          onCreateCollection={handleCreateCollection}
          selectedDatasets={selectedDatasets}
          datasets={mockDatasets}
        />
      </div>
    </DashboardLayout>
  );
} 