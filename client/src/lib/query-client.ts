import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: { 
            staleTime: 1000 * 60 * 30, // 30 minutes
            cacheTime: 1000 * 60 * 60, // keep in memory for 60 min
            refetchOnWindowFocus: false, // don't refetch when tab regains focus
            retry: 1,
            // staleTime: 30_000, // data is fresh for 30s, will eventually switch back to this
        },
    },
});