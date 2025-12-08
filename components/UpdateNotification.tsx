import React, { useEffect, useState } from 'react';
import { Download, AlertCircle, CheckCircle, Loader2, X } from 'lucide-react';

interface UpdateInfo {
  version: string;
  releaseDate?: string;
}

interface DownloadProgress {
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
}

export default function UpdateNotification() {
  const [updateState, setUpdateState] = useState<'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error'>('idle');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!window.electronAPI) return;

    // Listen for update events
    window.electronAPI.onUpdateChecking(() => {
      setUpdateState('checking');
      setVisible(true);
    });

    window.electronAPI.onUpdateAvailable((info: UpdateInfo) => {
      setUpdateState('available');
      setUpdateInfo(info);
      setVisible(true);
    });

    window.electronAPI.onUpdateNotAvailable(() => {
      setUpdateState('idle');
      // Auto-hide after a few seconds if no update
      setTimeout(() => setVisible(false), 3000);
    });

    window.electronAPI.onUpdateError((err: any) => {
      setUpdateState('error');
      setError(err?.message || 'Update failed');
      setVisible(true);
    });

    window.electronAPI.onUpdateDownloadProgress((progressObj: DownloadProgress) => {
      setUpdateState('downloading');
      setProgress(progressObj);
      setVisible(true);
    });

    window.electronAPI.onUpdateDownloaded((info: UpdateInfo) => {
      setUpdateState('downloaded');
      setUpdateInfo(info);
      setVisible(true);
    });
  }, []);

  const handleDownload = async () => {
    if (!window.electronAPI) return;
    setUpdateState('downloading');
    await window.electronAPI.downloadUpdate();
  };

  const handleInstall = () => {
    if (!window.electronAPI) return;
    window.electronAPI.installUpdate();
  };

  const handleCheckNow = async () => {
    if (!window.electronAPI) return;
    setUpdateState('checking');
    setVisible(true);
    await window.electronAPI.checkForUpdates();
  };

  const handleDismiss = () => {
    setVisible(false);
  };

  if (!visible) {
    // Small button to check for updates when notification is hidden
    return (
      <button
        onClick={handleCheckNow}
        className="text-xs text-gray-500 hover:text-cyan-400 transition-colors flex items-center gap-1.5 px-2 py-1 rounded hover:bg-gray-800/50"
        title="Check for updates"
      >
        <Download className="w-3 h-3" />
        Check Updates
      </button>
    );
  }

  return (
    <div className="space-y-3 bg-gradient-to-br from-blue-900/20 to-cyan-900/20 p-4 rounded-xl border border-blue-700/30 relative">
      {/* Close button */}
      {(updateState === 'error' || updateState === 'idle') && (
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 text-gray-500 hover:text-gray-300 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {/* Checking for update */}
      {updateState === 'checking' && (
        <div className="flex items-center gap-3 text-sm text-gray-300">
          <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
          <span>Checking for updates...</span>
        </div>
      )}

      {/* Update available */}
      {updateState === 'available' && updateInfo && (
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">
              <p className="font-semibold text-white">Update Available</p>
              <p className="text-gray-400 text-xs mt-1">
                Version {updateInfo.version} is ready to download
              </p>
            </div>
          </div>
          <button
            onClick={handleDownload}
            className="w-full bg-cyan-600 hover:bg-cyan-500 text-white py-2 px-4 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            Download Update
          </button>
        </div>
      )}

      {/* Downloading */}
      {updateState === 'downloading' && progress && (
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-cyan-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">
              <p className="font-semibold text-white">Downloading Update</p>
              <p className="text-gray-400 text-xs mt-1">
                {progress.percent.toFixed(1)}% • {(progress.bytesPerSecond / 1024 / 1024).toFixed(2)} MB/s
              </p>
            </div>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Downloaded and ready */}
      {updateState === 'downloaded' && updateInfo && (
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">
              <p className="font-semibold text-white">Update Ready</p>
              <p className="text-gray-400 text-xs mt-1">
                Version {updateInfo.version} has been downloaded
              </p>
            </div>
          </div>
          <button
            onClick={handleInstall}
            className="w-full bg-green-600 hover:bg-green-500 text-white py-2 px-4 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            Restart & Install
          </button>
        </div>
      )}

      {/* Error */}
      {updateState === 'error' && (
        <div className="space-y-2">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">
              <p className="font-semibold text-white">Update Error</p>
              <p className="text-gray-400 text-xs mt-1">{error || 'Failed to check for updates'}</p>
            </div>
          </div>
          <button
            onClick={handleCheckNow}
            className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
