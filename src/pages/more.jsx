import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Tags, Landmark, ChevronRight, Download, Upload, ShieldCheck } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { exportLocalData, importLocalData } from '@/api/localDataClient';
import { Capacitor } from '@capacitor/core';

export default function More() {
  const { toast } = useToast();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const items = [
    { to: '/categories', icon: Tags, label: 'Categories', desc: 'Manage your categories' },
    { to: '/bank', icon: Landmark, label: 'Bank accounts', desc: 'Automatic connection disabled in local mode' },
  ];

  async function backup() {
    setBusy(true);
    try {
      const backupData = await exportLocalData();
      const content = JSON.stringify(backupData, null, 2);
      const filename = `app-budget-backup-${new Date().toISOString().slice(0, 10)}.json`;
      if (Capacitor.isNativePlatform()) {
        const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
        const { Share } = await import('@capacitor/share');
        const file = await Filesystem.writeFile({ path: filename, data: content, directory: Directory.Cache, encoding: Encoding.UTF8 });
        await Share.share({ title: 'App Budget backup', text: 'Backup locale dei dati di App Budget', url: file.uri, dialogTitle: 'Save or share backup' });
      } else {
        const blob = new Blob([content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }
      toast({ title: 'Backup created', description: 'Keep this file somewhere safe. It contains your financial data.' });
    } catch (error) {
      toast({ title: 'Backup failed', description: error.message || 'Unable to export data.', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  async function restore(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!window.confirm('Restore this backup? The current local data will be replaced.')) return;
    setBusy(true);
    try {
      const data = JSON.parse(await file.text());
      await importLocalData(data);
      toast({ title: 'Backup restored', description: 'Your local data has been replaced with the selected backup.' });
      window.location.reload();
    } catch (error) {
      toast({ title: 'Restore failed', description: error.message || 'The file is not a valid App Budget backup.', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 p-4 max-w-md mx-auto">
      <h1 className="text-2xl font-bold tracking-tight pt-2">More</h1>
      <div className="space-y-2">
        {items.map((item) => (
          <Link key={item.to} to={item.to}>
            <Card className="p-4 flex items-center gap-3 active:bg-muted/50 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><item.icon className="w-5 h-5 text-primary" /></div>
              <div className="flex-1 min-w-0"><p className="font-medium text-sm">{item.label}</p><p className="text-xs text-muted-foreground">{item.desc}</p></div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </Card>
          </Link>
        ))}
      </div>
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-primary" /><h2 className="font-semibold">Local data & backup</h2></div>
        <p className="text-sm text-muted-foreground">Your data is stored on this device. Export backups regularly and keep a copy somewhere safe; uninstalling the app or losing the phone may otherwise mean losing your data.</p>
        <Button className="w-full gap-2" onClick={backup} disabled={busy}><Download className="w-4 h-4" /> Export backup</Button>
        <Button className="w-full gap-2" variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}><Upload className="w-4 h-4" /> Restore backup</Button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={restore} />
      </Card>
    </div>
  );
}
