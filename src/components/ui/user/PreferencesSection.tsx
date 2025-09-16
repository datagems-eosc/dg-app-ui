'use client';

import React from 'react';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';

type NotificationSettings = {
  newFeatures: { email: boolean; inApp: boolean };
  datasetLibraryChanges: { email: boolean; inApp: boolean };
  newDatasets: { email: boolean; inApp: boolean };
  systemMaintenance: { email: boolean; inApp: boolean };
  systemErrors: { email: boolean; inApp: boolean };
};

type NotificationCategory = 'newFeatures' | 'datasetLibraryChanges' | 'newDatasets' | 'systemMaintenance' | 'systemErrors';

interface Props {
  notifications: NotificationSettings;
  onEnableAll: () => void;
  onDisableAll: () => void;
  updateNotification: (category: NotificationCategory, type: 'email' | 'inApp', value: boolean) => void;
}

export default function PreferencesSection({ notifications, onEnableAll, onDisableAll, updateNotification }: Props) {
  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-H2-20-semibold text-gray-900">Notification Preferences</h2>
            <p className="text-body-16-regular text-gray-600">Choose how you want to be notified about updates and changes</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onEnableAll}>
              Enable All
            </Button>
            <Button variant="outline" size="sm" onClick={onDisableAll}>
              Disable All
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex items-start justify-between py-4 border-b border-gray-100">
            <div className="flex-1">
              <h3 className="text-body-16-semibold text-gray-900">New Features</h3>
              <p className="text-descriptions-12-regular text-gray-600">
                Get notified when new features are added to the platform
              </p>
            </div>
            <div className="flex items-center gap-8 ml-6">
              <div className="text-center">
                <p className="text-body-16-medium text-gray-700 mb-2">E-mail</p>
                <Checkbox
                  id="new-features-email"
                  checked={notifications.newFeatures.email}
                  onChange={(checked) => updateNotification('newFeatures', 'email', checked)}
                />
              </div>
              <div className="text-center">
                <p className="text-body-16-medium text-gray-700 mb-2">In App</p>
                <Checkbox
                  id="new-features-app"
                  checked={notifications.newFeatures.inApp}
                  onChange={(checked) => updateNotification('newFeatures', 'inApp', checked)}
                />
              </div>
            </div>
          </div>

          <div className="flex items-start justify-between py-4 border-b border-gray-100">
            <div className="flex-1">
              <h3 className="text-body-16-semibold text-gray-900">Dataset Library Changes</h3>
              <p className="text-descriptions-12-regular text-gray-600">
                Receive updates about changes to the datasets library
              </p>
            </div>
            <div className="flex items-center gap-8 ml-6">
              <div className="text-center">
                <p className="text-body-16-medium text-gray-700 mb-2">E-mail</p>
                <Checkbox
                  id="library-changes-email"
                  checked={notifications.datasetLibraryChanges.email}
                  onChange={(checked) => updateNotification('datasetLibraryChanges', 'email', checked)}
                />
              </div>
              <div className="text-center">
                <p className="text-body-16-medium text-gray-700 mb-2">In App</p>
                <Checkbox
                  id="library-changes-app"
                  checked={notifications.datasetLibraryChanges.inApp}
                  onChange={(checked) => updateNotification('datasetLibraryChanges', 'inApp', checked)}
                />
              </div>
            </div>
          </div>

          <div className="flex items-start justify-between py-4 border-b border-gray-100">
            <div className="flex-1">
              <h3 className="text-body-16-semibold text-gray-900">New Datasets</h3>
              <p className="text-descriptions-12-regular text-gray-600">
                Be informed when new datasets are added to the system
              </p>
            </div>
            <div className="flex items-center gap-8 ml-6">
              <div className="text-center">
                <p className="text-body-16-medium text-gray-700 mb-2">E-mail</p>
                <Checkbox
                  id="new-datasets-email"
                  checked={notifications.newDatasets.email}
                  onChange={(checked) => updateNotification('newDatasets', 'email', checked)}
                />
              </div>
              <div className="text-center">
                <p className="text-body-16-medium text-gray-700 mb-2">In App</p>
                <Checkbox
                  id="new-datasets-app"
                  checked={notifications.newDatasets.inApp}
                  onChange={(checked) => updateNotification('newDatasets', 'inApp', checked)}
                />
              </div>
            </div>
          </div>

          <div className="flex items-start justify-between py-4 border-b border-gray-100">
            <div className="flex-1">
              <h3 className="text-body-16-semibold text-gray-900">System Maintenance</h3>
              <p className="text-descriptions-12-regular text-gray-600">
                Get notified about planned system maintenance
              </p>
            </div>
            <div className="flex items-center gap-8 ml-6">
              <div className="text-center">
                <p className="text-body-16-medium text-gray-700 mb-2">E-mail</p>
                <Checkbox
                  id="maintenance-email"
                  checked={notifications.systemMaintenance.email}
                  onChange={(checked) => updateNotification('systemMaintenance', 'email', checked)}
                />
              </div>
              <div className="text-center">
                <p className="text-body-16-medium text-gray-700 mb-2">In App</p>
                <Checkbox
                  id="maintenance-app"
                  checked={notifications.systemMaintenance.inApp}
                  onChange={(checked) => updateNotification('systemMaintenance', 'inApp', checked)}
                />
              </div>
            </div>
          </div>

          <div className="flex items-start justify-between py-4">
            <div className="flex-1">
              <h3 className="text-body-16-semibold text-gray-900">System Errors</h3>
              <p className="text-descriptions-12-regular text-gray-600">
                Receive alerts about errors affecting your data or collections
              </p>
            </div>
            <div className="flex items-center gap-8 ml-6">
              <div className="text-center">
                <p className="text-body-16-medium text-gray-700 mb-2">E-mail</p>
                <Checkbox
                  id="errors-email"
                  checked={notifications.systemErrors.email}
                  onChange={(checked) => updateNotification('systemErrors', 'email', checked)}
                />
              </div>
              <div className="text-center">
                <p className="text-body-16-medium text-gray-700 mb-2">In App</p>
                <Checkbox
                  id="errors-app"
                  checked={notifications.systemErrors.inApp}
                  onChange={(checked) => updateNotification('systemErrors', 'inApp', checked)}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


