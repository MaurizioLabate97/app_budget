import { QueryCache, QueryClient } from '@tanstack/react-query';
import { subscribeDataChanged } from '@/api/localDataClient';
import { toast } from '@/components/ui/use-toast';
import { keysToInvalidate } from '@/lib/queryKeys';

export const queryClientInstance = new QueryClient({
	queryCache: new QueryCache({
		// Un solo punto per gli errori di lettura, al posto dei try/catch delle pagine.
		onError: (error) =>
			toast({ title: 'Errore', description: error.message, variant: 'destructive' }),
	}),
	defaultOptions: {
		queries: {
			// I dati cambiano solo passando dal data layer, che invalida la cache:
			// tornando su una pagina già vista i dati sono subito pronti.
			staleTime: Infinity,
			refetchOnWindowFocus: false,
			retry: 1,
		},
	},
});

subscribeDataChanged((change) => {
	for (const queryKey of keysToInvalidate(change)) {
		queryClientInstance.invalidateQueries({ queryKey });
	}
});
