import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: { 
            staleTime: 30_000, // data is fresh for 30s
            refetchOnWindowFocus: false // don't refetch when tab regains focus
        },
    },
});