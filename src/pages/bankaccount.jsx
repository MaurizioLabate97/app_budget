import { Card } from '@/components/ui/card';
import { Info, Landmark, WifiOff } from 'lucide-react';

export default function BankAccounts() {
  return (
    <div className="space-y-4 p-4 max-w-md mx-auto">
      <div className="pt-2 flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
          <Landmark className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Conti bancari</h1>
          <p className="text-sm text-muted-foreground">Modalità solo locale</p>
        </div>
      </div>
      <Card className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <WifiOff className="w-5 h-5 mt-0.5 text-muted-foreground shrink-0" />
          <div className="space-y-1">
            <h2 className="font-semibold">Collegamento automatico alla banca disattivato</h2>
            <p className="text-sm text-muted-foreground">Questa versione non si collega a banche o servizi esterni: i tuoi dati finanziari restano su questo dispositivo e l'app funziona anche offline.</p>
          </div>
        </div>
        <div className="flex items-start gap-3 border-t pt-3">
          <Info className="w-5 h-5 mt-0.5 text-muted-foreground shrink-0" />
          <p className="text-sm text-muted-foreground">Per ora inserisci entrate e spese a mano. In futuro si potrà aggiungere l'importazione da file locale, senza login né sincronizzazione cloud.</p>
        </div>
      </Card>
    </div>
  );
}
