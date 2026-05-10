import { useState } from 'react';
import { DifficultySelector } from '../components/settings/DifficultySelector';
import { ToggleSwitch } from '../components/ui/ToggleSwitch';
import { ResetButton } from '../components/settings/ResetButton';
import { Button } from '../components/ui/Button';
import { useLocalStorage } from '../hooks/useLocalStorage';
import type { Difficulty } from './Game';
import { useToast } from '../components/ui/Toast';

export function Settings() {
  const [storedDifficulty, setStoredDifficulty] = useLocalStorage<Difficulty>('snake-neo:difficulty', 'normal');
  const [storedSound, setStoredSound] = useLocalStorage<boolean>('snake-neo:sound', true);

  const [difficulty, setDifficulty] = useState<Difficulty>(storedDifficulty);
  const [sound, setSound] = useState<boolean>(storedSound);
  const { showToast } = useToast();

  const handleSave = () => {
    setStoredDifficulty(difficulty);
    setStoredSound(sound);
    showToast('Settings saved');
  };

  const handleCancel = () => {
    setDifficulty(storedDifficulty);
    setSound(storedSound);
  };

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight mb-1">Settings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Tune Snake Neo to match your play style.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Difficulty</h2>
        <DifficultySelector value={difficulty} onChange={setDifficulty} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Audio &amp; Visual</h2>
        <div className="space-y-2">
          <ToggleSwitch checked={sound} onChange={setSound} label="Sound effects" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Data</h2>
        <ResetButton />
      </section>

      <div className="flex gap-3 pt-2">
        <Button className="px-4 py-2" onClick={handleSave}>
          Save changes
        </Button>
        <Button variant="secondary" className="px-4 py-2" onClick={handleCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
