import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';

export function ResetButton() {
  const [open, setOpen] = useState(false);
  const { showToast } = useToast();

  const handleConfirm = () => {
    try {
      localStorage.removeItem('snake-neo:difficulty');
      localStorage.removeItem('snake-neo:sound');
      localStorage.removeItem('snake-neo:theme');
      localStorage.removeItem('snake-neo:best-score');
      showToast('Local data reset');
    } catch {
      showToast('Failed to reset data');
    } finally {
      setOpen(false);
    }
  };

  return (
    <>
      <Button
        variant="secondary"
        className="px-4 py-2 border-red-300 text-red-700 dark:border-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
        onClick={() => setOpen(true)}
      >
        Reset local data
      </Button>
      <Modal open={open}>
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Reset local data?</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            This will clear your saved preferences and best local score from this device. Leaderboard entries already
            submitted will remain.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" className="px-4 py-2" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              className="px-4 py-2 bg-red-600 text-white hover:bg-red-500"
              onClick={handleConfirm}
            >
              Reset
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
