import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Repeat, Tags, Landmark, ChevronRight, Download, Upload, ShieldCheck } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { exportLocalData, importLocalData } from '@/api/localDataClient';
import { resetBudgetMonthMarkers } from '@/lib/budgetActions';
import { Capacitor } from '@capacitor/core';
import ConfirmDialog from '@/components/ConfirmDialog';
import { todayLocal } from '@/lib/date';

export default function More() {
  const { toast } = useToast();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const items = [
    { to: '/recurring', icon: Repeat, label: 'Spese ricorrenti', desc: 'Affitto, abbonamenti e altre spese fisse' },
    { to: '/categories', icon: Tags, label: 'Categorie', desc: 'Gestisci le tue categorie' },
    { to: '/bank', icon: Landmark, label: 'Conti bancari', desc: 'Collegamento automatico disattivato in modalità locale' },
  ];

  async function backup() {
    setBusy(true);
    try {
      const backupData = await exportLocalData();
      const content = JSON.stringify(backupData, null, 2);
      const filename = `app-budget-backup-${todayLocal()}.json`;
      if (Capacitor.isNativePlatform()) {
        const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
        const { Share } = await import('@capacitor/share');
        const file = await Filesystem.writeFile({ path: filename, data: content, directory: Directory.Cache, encoding: Encoding.UTF8 });
        await Share.share({ title: 'App Budget backup', text: 'Backup locale dei dati di App Budget', url: file.uri, dialogTitle: 'Salva o condividi il backup' });
      } else {
        const blob = new Blob([content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }
      toast({ title: 'Backup creato', description: 'Conserva il file in un posto sicuro: contiene i tuoi dati finanziari.' });
    } catch (error) {
      toast({ title: 'Backup non riuscito', description: error.message || 'Impossibile esportare i dati.', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  function chooseRestoreFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) setPendingFile(file);
  }

  async function restore(file) {
    setBusy(true);
    try {
      const data = JSON.parse(await file.text());
      await importLocalData(data);
      resetBudgetMonthMarkers();
      toast({ title: 'Backup ripristinato', description: 'I dati locali sono stati sostituiti con quelli del backup.' });
      window.location.reload();
    } catch (error) {
      toast({ title: 'Ripristino non riuscito', description: error.message || 'Il file non è un backup valido di App Budget.', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 p-4 max-w-md mx-auto">
      <h1 className="text-2xl font-bold tracking-tight pt-2">Altro</h1>
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
        <div className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-primary" /><h2 className="font-semibold">Dati locali e backup</h2></div>
        <p className="text-sm text-muted-foreground">I tuoi dati sono salvati solo su questo dispositivo. Esporta un backup regolarmente e conservane una copia al sicuro: se disinstalli l'app o perdi il telefono, senza backup i dati vanno persi.</p>
        <Button className="w-full gap-2" onClick={backup} disabled={busy}><Download className="w-4 h-4" /> Esporta backup</Button>
        <Button className="w-full gap-2" variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}><Upload className="w-4 h-4" /> Ripristina backup</Button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={chooseRestoreFile} />
      </Card>
      <ConfirmDialog
        open={!!pendingFile}
        onOpenChange={(open) => !open && setPendingFile(null)}
        title="Ripristinare questo backup?"
        description={pendingFile ? `Tutti i dati attuali verranno sostituiti con quelli di "${pendingFile.name}". L'operazione non si può annullare.` : ''}
        confirmLabel="Ripristina"
        onConfirm={() => restore(pendingFile)}
      />
    </div>
  );
}
