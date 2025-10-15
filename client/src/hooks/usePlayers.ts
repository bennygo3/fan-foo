import { useMemo } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { getPlayers } from "../lib/api";

type Opts = {
    search?: string;
    position?: string;
    page?: number;
    limit?: number;
    staleTime?: number;
}

export function usePlayers({ 
    search = "",
    position = "",
    page = 1,
    limit = 25 ,
    staleTime = 5_000,
} : Opts) {
    const params = useMemo(
        () => ({
            search: search.trim(),
            position: position.trim().toUpperCase(),
            page,
            limit,
        }),
        [search, position, page, limit]
    );

    return useQuery({
        queryKey: ["players", params],      // cache key
        queryFn: () => getPlayers(params),  // fetcher
        placeholderData: keepPreviousData,
        refetchOnWindowFocus: false,
        staleTime,
    });
}